import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  brainRegions,
  type BrainReference,
  type BrainRegion,
} from "../src/data/regions";
import { brainCircuits } from "../src/data/circuits";
import { corticalRegionOutlines } from "../src/data/cortical-regions";
import { embryoStages } from "../src/data/embryo";
import { readWorkspaceRoute, workspaceUrl } from "../src/lib/workspace-route";

const publicRoot = new URL("../public/", import.meta.url);
const readJson = async (url: string) =>
  JSON.parse(
    await readFile(new URL(url.replace(/^\//, ""), publicRoot), "utf8"),
  );
const adultManifest = await readJson("/data/manifest.json");
const adultCatalog: { id: number; acronym: string; name: string }[] =
  await readJson("/data/adult-region-ids.json");
type AdultStructure = {
  id: number;
  acronym: string;
  name: string;
  color: string;
  structureIdPath: number[];
};
const adultOntology: AdultStructure[] = await readJson("/data/ontology.json");
const adultOntologyById = new Map(
  adultOntology.map((structure) => [structure.id, structure]),
);
const adultManifestById = new Map<
  number,
  AdultStructure & { mesh: { url: string }; focusVoxel: number[] }
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

test("all 107 adult directory entries retain official identities and resolve to packaged meshes", () => {
  assert.equal(brainRegions.length, 107);
  assert.equal(new Set(brainRegions.map((region) => region.id)).size, 107);
  const sortedIds = (rows: { id: number }[]) =>
    rows.map((row) => row.id).sort((a, b) => a - b);
  assert.deepEqual(sortedIds(brainRegions), sortedIds(adultCatalog));
  assert.deepEqual(sortedIds(brainRegions), sortedIds(adultManifest.regions));
  const catalogById = new Map(
    adultCatalog.map((region) => [region.id, region]),
  );
  for (const region of brainRegions) {
    const anatomy = adultManifestById.get(region.id)!;
    const official = adultOntologyById.get(region.id)!;
    assert.ok(official, `unknown Allen structure ${region.id}`);
    assert.equal(region.acronym, anatomy.acronym);
    assert.equal(region.acronym, catalogById.get(region.id)!.acronym);
    assert.equal(region.acronym, official.acronym);
    assert.equal(region.englishName, official.name);
    assert.equal(region.englishName, anatomy.name);
    assert.equal(region.englishName, catalogById.get(region.id)!.name);
    assert.equal(region.color, official.color);
    assert.equal(region.color, anatomy.color);
    assert.ok(anatomy.mesh.url.startsWith("/data/meshes/"));
    assert.equal(anatomy.focusVoxel.length, 3);
    verifyRegionText(region);
  }
});

test("new cortical entries preserve anatomical evidence, official hierarchy and shareable selection", () => {
  assert.equal(corticalRegionOutlines.length, 42);
  const directoryById = new Map(brainRegions.map((region) => [region.id, region]));
  const categoryRoots = new Map([
    ["大脑皮层", 315],
    ["嗅觉系统", 698],
    ["海马结构", 1089],
  ]);
  const config = { embryonic: false, regions: brainRegions, initialId: 382 };
  for (const outline of corticalRegionOutlines) {
    const region = directoryById.get(outline.id)!;
    const official = adultOntologyById.get(outline.id)!;
    assert.ok(region, `${outline.acronym} must be selectable`);
    assert.equal(region.name, outline.name);
    assert.equal(region.evidenceScope, "anatomy");
    assert.deepEqual(
      new Set(region.references.map((reference) => reference.url)),
      new Set([
        "https://doi.org/10.1016/j.cell.2020.04.007",
        "https://api.brain-map.org/api/v2/structure_graph_download/1.json",
      ]),
      `${outline.acronym} must cite its anatomical sources`,
    );
    const categoryRoot = categoryRoots.get(region.category);
    assert.ok(categoryRoot, `unsupported cortical category ${region.category}`);
    assert.ok(
      official.structureIdPath.includes(categoryRoot),
      `${outline.acronym} must remain in its official cortical branch`,
    );
    const url = workspaceUrl("https://atlas.example/", {
      selected: region.id,
      embryonic: false,
      sliceSource: "allen",
      embryoLevel: "fine",
      mapView: true,
    });
    assert.equal(readWorkspaceRoute(config, url.search).selectedId, region.id);
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
