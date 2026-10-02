import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { test } from "node:test";

type Structure = {
  id: number;
  acronym: string;
  name: string;
  color: string;
  parentId: number | null;
  structureIdPath: number[];
};
type Coverage = {
  rootId: number;
  acronym: string;
  regionIds: number[];
  annotationVoxelCount: number;
  coveredVoxelCount: number;
  coverageFraction: number;
  overlapVoxelCount: number;
  uncoveredLabels: { id: number; acronym: string; name: string; voxelCount: number }[];
};
const dataRoot = new URL("../public/data/", import.meta.url);
const ontology: Structure[] = JSON.parse(await readFile(new URL("ontology.json", dataRoot), "utf8"));
const byId = new Map(ontology.map((item) => [item.id, item]));
const catalog: Pick<Structure, "id" | "acronym" | "name">[] = JSON.parse(
  await readFile(new URL("adult-region-ids.json", dataRoot), "utf8"),
);
const manifest: {
  regions: (Structure & { descendantIds: number[]; voxelCount: number })[];
  corticalCoverage: Coverage[];
  provenance: { sources: { filename: string; url: string; sha256: string; bytes: number }[] };
} = JSON.parse(await readFile(new URL("manifest.json", dataRoot), "utf8"));

test("all 107 adult model identities and descendants come from the official ontology", () => {
  assert.equal(catalog.length, 107);
  assert.equal(new Set(catalog.map((item) => item.id)).size, catalog.length);
  assert.deepEqual(catalog.map((item) => item.id), manifest.regions.map((item) => item.id));
  for (const [index, item] of catalog.entries()) {
    const original = byId.get(item.id)!;
    assert.ok(original, `unknown ID ${item.id}`);
    for (const key of ["id", "name", "acronym"] as const)
      assert.equal(item[key], original[key]);
    const region = manifest.regions[index];
    for (const key of ["id", "name", "acronym", "color", "parentId", "structureIdPath"] as const)
      assert.deepEqual(region[key], original[key]);
    assert.deepEqual(region.descendantIds, ontology.filter((s) => s.structureIdPath.includes(item.id)).map((s) => s.id));
    assert.ok(region.voxelCount > 0);
    const source = manifest.provenance.sources.find((s) => s.filename === `${item.id}.obj`)!;
    assert.ok(source, `missing original OBJ provenance for ${item.acronym}`);
    assert.equal(source.url, `https://download.alleninstitute.org/informatics-archive/current-release/mouse_ccf/annotation/ccf_2017/structure_meshes/${item.id}.obj`);
    assert.match(source.sha256, /^[0-9a-f]{64}$/);
    assert.ok(source.bytes > 0);
  }
});

test("cortical models cover every Isocortex voxel once and expose only unresolved parent labels", async () => {
  const raw = gunzipSync(await readFile(new URL("annotation.uint32.gz", dataRoot)));
  const counts = new Map<number, number>();
  for (let offset = 0; offset < raw.length; offset += 4) {
    const id = raw.readUInt32LE(offset);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  assert.deepEqual(manifest.corticalCoverage.map((report) => report.rootId), [315, 695]);
  for (const report of manifest.corticalCoverage) {
    const selected = manifest.regions.filter((region) => region.structureIdPath.includes(report.rootId));
    assert.deepEqual(report.regionIds, selected.map((item) => item.id));
    for (const region of selected)
      assert.equal(selected.filter((other) => region.structureIdPath.includes(other.id)).length, 1);
    let total = 0, covered = 0;
    const missing: Coverage["uncoveredLabels"] = [];
    for (const [id, voxelCount] of [...counts].sort(([a], [b]) => a - b)) {
      const structure = byId.get(id);
      if (!structure?.structureIdPath.includes(report.rootId)) continue;
      const parents = selected.filter((region) => structure.structureIdPath.includes(region.id));
      assert.ok(parents.length <= 1, `overlapping models for ${structure.acronym}`);
      total += voxelCount;
      if (parents.length) covered += voxelCount;
      else missing.push({ id, acronym: structure.acronym, name: structure.name, voxelCount });
    }
    assert.equal(report.annotationVoxelCount, total);
    assert.equal(report.coveredVoxelCount, covered);
    assert.equal(report.coverageFraction, covered / total);
    assert.equal(report.overlapVoxelCount, 0);
    assert.deepEqual(report.uncoveredLabels, missing);
    if (report.rootId === 315) {
      assert.equal(selected.length, 29);
      assert.equal(total, 986098);
      assert.equal(covered, total);
      assert.deepEqual(missing, []);
    } else {
      assert.equal(total, 1700484);
      assert.equal(covered, 1657253);
      assert.deepEqual(missing.map(({ id, voxelCount }) => [id, voxelCount]), [[698, 39798], [1089, 3433]]);
    }
  }
});
