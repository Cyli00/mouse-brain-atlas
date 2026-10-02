import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { embryoStages, embryoVentricleIds, embryoVentricleRegions } from "../src/data/embryo";

type Structure = { id: number; name: string; acronym: string; color: string; structureIdPath: number[] };
type Mesh = { url: string; boundsUm: number[][] };
type Region = Structure & { anatomyKind: string; voxelCount: number; mesh: Mesh };
const root = new URL("../public/", import.meta.url);
const readAsset = (url: string) => readFile(new URL(url.replace(/^\//, ""), root));
const tissueRoots = new Set([15566, 16649, 16808]);

async function assertMeshBoundary(mesh: Mesh, annotation: Uint32Array, dimensions: number[], mask: Set<number>) {
  const raw = gunzipSync(await readAsset(mesh.url));
  const [nx, ny, nz] = dimensions;
  const contains = ([x, y, z]: number[]) => x >= 0 && y >= 0 && z >= 0 && x < nx && y < ny && z < nz
    && mask.has(annotation[(z * ny + y) * nx + x]);
  for (let i = 0; i < raw.readUInt32LE(0); i++) {
    const vertex = [0, 1, 2].map((axis) => raw.readFloatLE(8 + i * 12 + axis * 4) / 40);
    const samples: boolean[] = [];
    for (const x of new Set([Math.floor(vertex[0]), Math.ceil(vertex[0])]))
      for (const y of new Set([Math.floor(vertex[1]), Math.ceil(vertex[1])]))
        for (const z of new Set([Math.floor(vertex[2]), Math.ceil(vertex[2])])) samples.push(contains([x, y, z]));
    assert.ok(samples.some(Boolean) && samples.some((value) => !value), `${mesh.url}: vertex must separate its source label mask from background`);
  }
}

test("developmental meshes cover retained source labels once and separate tissue from ventricular space", async (t) => {
  const ontology: Structure[] = JSON.parse(await readFile(new URL("embryo/ontology.json", root), "utf8"));
  const byId = new Map(ontology.map((structure) => [structure.id, structure]));
  const tissueIds = new Set(ontology.filter((structure) => structure.structureIdPath.some((id) => tissueRoots.has(id))).map((structure) => structure.id));
  const expectedCounts: Record<string, [number, number]> = {
    "E11.5": [41193, 45082], "E13.5": [146488, 0], "E15.5": [308794, 0], "E18.5": [483281, 0],
  };
  for (const ventricle of embryoVentricleRegions) {
    const source = byId.get(ventricle.id)!;
    assert.equal(ventricle.englishName, source.name);
    assert.equal(ventricle.acronym, source.acronym);
    assert.equal(ventricle.color, source.color);
    assert.equal(ventricle.category, "脑室腔");
  }
  for (const stage of embryoStages) await t.test(stage.id, async () => {
    const manifest = JSON.parse((await readAsset(stage.manifestUrl)).toString());
    const raw = gunzipSync(await readAsset(manifest.annotation.url));
    const annotation = new Uint32Array(raw.buffer, raw.byteOffset, raw.length / 4);
    const regions: Region[] = manifest.regions;
    assert.deepEqual(stage.regions.map((region) => region.id), regions.map((region) => region.id));
    assert.match(manifest.hemisphere, /incomplete source annotation; not mirrored/);
    assert.deepEqual(manifest.axisOrder, ["AP", "DV", "ML"]);
    assert.equal(manifest.orientation, "PIR");
    let tissueCount = 0, cavityCount = 0;
    const membership = new Map<number, number[]>();
    for (const structure of ontology) membership.set(structure.id, regions.filter((region) => structure.structureIdPath.includes(region.id)).map((region) => region.id));
    for (const id of annotation) {
      if (!id) continue;
      const represented = membership.get(id)!;
      assert.equal(represented.length, 1, `${stage.id}: source label ${id} must belong to exactly one displayed mesh`);
      if (tissueIds.has(id)) {
        tissueCount++;
        assert.equal(embryoVentricleIds.has(represented[0]), false);
      } else {
        cavityCount++;
        assert.equal(embryoVentricleIds.has(represented[0]), true);
      }
    }
    assert.deepEqual([tissueCount, cavityCount], expectedCounts[stage.id]);
    assert.equal(manifest.meshCoverage.brainTissueVoxelCount, tissueCount);
    assert.equal(manifest.meshCoverage.ventricularVoxelCount, cavityCount);
    assert.equal(manifest.meshCoverage.retainedVoxelCount, tissueCount + cavityCount);
    assert.equal(regions.reduce((sum, region) => sum + region.voxelCount, 0), tissueCount + cavityCount);
    await assertMeshBoundary(manifest.rootMesh, annotation, manifest.dimensions, tissueIds);
    for (const region of regions.filter((region) => embryoVentricleIds.has(region.id))) {
      assert.equal(region.anatomyKind, "ventricular-space");
      assert.ok(region.voxelCount > 0);
      assert.deepEqual(region.structureIdPath, byId.get(region.id)!.structureIdPath);
      const labels = new Set(ontology.filter((structure) => structure.structureIdPath.includes(region.id)).map((structure) => structure.id));
      await assertMeshBoundary(region.mesh, annotation, manifest.dimensions, labels);
    }
  });
});
