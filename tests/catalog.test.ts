import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  brainRegions,
  type BrainReference,
  type BrainRegion,
} from "../src/data/regions";
import { brainCircuits } from "../src/data/circuits";
import { embryoStages } from "../src/data/embryo";

const publicRoot = new URL("../public/", import.meta.url);
const readJson = async (url: string) =>
  JSON.parse(
    await readFile(new URL(url.replace(/^\//, ""), publicRoot), "utf8"),
  );
const adultManifest = await readJson("/data/manifest.json");
const adultCatalog: { id: number; acronym: string; name: string }[] =
  await readJson("/data/adult-region-ids.json");
const adultManifestById = new Map<
  number,
  { id: number; acronym: string; mesh: { url: string }; focusVoxel: number[] }
>(adultManifest.regions.map((region: { id: number }) => [region.id, region]));

function verifyReference(reference: BrainReference) {
  for (const key of ["title", "authors", "journal", "finding"] as const) {
    assert.ok(reference[key]?.trim(), `reference needs ${key}`);
  }
  assert.ok(Number.isInteger(reference.year) && reference.year >= 1900);
  assert.equal(new URL(reference.url).protocol, "https:");
}

function verifyRegionText(region: BrainRegion) {
  for (const key of [
    "acronym",
    "name",
    "englishName",
    "category",
    "summary",
    "function",
    "evidence",
  ] as const) {
    assert.ok(region[key]?.trim(), `${region.id} needs ${key}`);
  }
  assert.match(region.color, /^#[0-9a-f]{6}$/i);
  assert.ok(region.references.length > 0, `${region.acronym} needs evidence`);
  region.references.forEach(verifyReference);
}

test("all 65 adult region descriptions resolve to the same Allen IDs as the packaged meshes", () => {
  assert.equal(brainRegions.length, 65);
  assert.equal(new Set(brainRegions.map((region) => region.id)).size, 65);
  const sortedIds = (rows: { id: number }[]) =>
    rows.map((row) => row.id).sort((a, b) => a - b);
  assert.deepEqual(sortedIds(brainRegions), sortedIds(adultCatalog));
  assert.deepEqual(sortedIds(brainRegions), sortedIds(adultManifest.regions));
  const catalogById = new Map(
    adultCatalog.map((region) => [region.id, region]),
  );
  for (const region of brainRegions) {
    const anatomy = adultManifestById.get(region.id)!;
    assert.equal(region.acronym, anatomy.acronym);
    assert.equal(region.acronym, catalogById.get(region.id)!.acronym);
    assert.ok(anatomy.mesh.url.startsWith("/data/meshes/"));
    assert.equal(anatomy.focusVoxel.length, 3);
    verifyRegionText(region);
  }
});

test("circuit nodes and directed edges all resolve to selectable adult structures and citations", () => {
  assert.equal(brainCircuits.length, 7);
  assert.equal(
    new Set(brainCircuits.map((circuit) => circuit.id)).size,
    brainCircuits.length,
  );
  const kinds = new Set([
    "excitatory",
    "inhibitory",
    "modulatory",
    "projection",
  ]);
  for (const circuit of brainCircuits) {
    for (const key of [
      "id",
      "name",
      "subtitle",
      "description",
      "evidence",
    ] as const) {
      assert.ok(circuit[key].trim(), `circuit needs ${key}`);
    }
    assert.ok(circuit.nodeIds.length >= 2);
    const nodes = new Set(circuit.nodeIds);
    assert.equal(
      nodes.size,
      circuit.nodeIds.length,
      `${circuit.id} has duplicate nodes`,
    );
    for (const id of nodes)
      assert.ok(
        adultManifestById.has(id),
        `${circuit.id} has unavailable node ${id}`,
      );
    assert.ok(circuit.edges.length > 0);
    const connected = new Set<number>();
    const directedEdges = new Set<string>();
    for (const edge of circuit.edges) {
      assert.ok(
        nodes.has(edge.from) && nodes.has(edge.to),
        `${circuit.id} has a dangling edge`,
      );
      assert.notEqual(
        edge.from,
        edge.to,
        `${circuit.id} has an unintended self loop`,
      );
      assert.ok(kinds.has(edge.kind));
      assert.ok(edge.label.trim());
      const key = `${edge.from}:${edge.to}:${edge.kind}`;
      assert.ok(!directedEdges.has(key), `${circuit.id} has a duplicate edge`);
      directedEdges.add(key);
      connected.add(edge.from);
      connected.add(edge.to);
    }
    assert.deepEqual(
      [...connected].sort((a, b) => a - b),
      [...nodes].sort((a, b) => a - b),
    );
    assert.ok(
      circuit.references.length > 0,
      `${circuit.id} needs original evidence`,
    );
    circuit.references.forEach(verifyReference);
  }
});

test("embryo stage controls and descriptions resolve to each stage's own reference space", async () => {
  const index: {
    stages: {
      stage: string;
      manifest: string;
      regionIds: number[];
      resolutionUm: number;
    }[];
  } = await readJson("/embryo/index.json");
  assert.deepEqual(
    embryoStages.map((stage) => stage.id),
    index.stages.map((stage) => stage.stage),
  );
  for (const stage of embryoStages) {
    const entry = index.stages.find((item) => item.stage === stage.id)!;
    const manifest = await readJson(entry.manifest);
    assert.equal(stage.manifestUrl, entry.manifest);
    assert.equal(stage.resolutionUm, entry.resolutionUm);
    assert.equal(stage.referenceSpaceId, manifest.referenceSpaceId);
    assert.ok(
      entry.regionIds.includes(stage.initialId),
      `${stage.id} initial selection needs a mesh`,
    );
    assert.deepEqual(
      stage.regions.map((region) => region.id).sort((a, b) => a - b),
      [...entry.regionIds].sort((a, b) => a - b),
    );
    assert.ok(
      Number.isFinite(stage.referenceDrawingIntervalUm) &&
        stage.referenceDrawingIntervalUm > 0,
    );
    assert.ok(
      Number.isInteger(stage.referenceDrawingLevel) &&
        stage.referenceDrawingLevel > 0,
    );
    assert.equal(new URL(stage.referenceDrawingSourceUrl).protocol, "https:");
    assert.ok(stage.description.trim() && stage.tissue.trim());
    assert.equal(new URL(stage.sourceUrl).protocol, "https:");
    verifyReference(stage.reference);
    const regionsById = new Map<number, { acronym: string }>(
      manifest.regions.map((region: { id: number }) => [region.id, region]),
    );
    for (const region of stage.regions) {
      assert.equal(region.acronym, regionsById.get(region.id)!.acronym);
      assert.ok(
        !adultManifestById.has(region.id),
        "developmental labels must not silently reuse an adult ID",
      );
      verifyRegionText(region);
    }
  }
});
