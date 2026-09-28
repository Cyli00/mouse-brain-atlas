import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import {
  FIBER_TRACTS_ROOT_ID,
  WHITE_MATTER_COLOR,
  WHITE_MATTER_EXCEPTION_IDS,
  WHITE_MATTER_LABEL,
  isWhiteMatterStructure,
} from "../src/lib/white-matter";
import { loadAtlas, structureAt, voxelIndex } from "../src/lib/atlas";
import { loadKimAnnotation } from "../src/lib/slice-atlas";
import { getWhiteMatterRegions } from "../src/data/white-matter";

const root = new URL("../public/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("data/kim-v2/manifest.json", root), "utf8"),
);
const ontology = JSON.parse(
  await readFile(new URL("data/kim-v2/ontology.json", root), "utf8"),
) as { id: number; name: string; acronym: string; structureIdPath: number[] }[];
const byId = new Map(ontology.map((s) => [s.id, s]));
// The shared helper takes snake_case structure_id_path; adapt the published
// camelCase ontology records once for all tests.
const asHelper = (s: { id: number; structureIdPath: number[] }) => ({
  id: s.id,
  structure_id_path: s.structureIdPath,
});
const annotationRaw = gunzipSync(
  await readFile(new URL(manifest.annotation.url.slice(1), root)),
);
const annotation = new Uint32Array(
  annotationRaw.buffer,
  annotationRaw.byteOffset,
  annotationRaw.length / 4,
);
const dims = manifest.dimensions as [number, number, number];

type Region = {
  id: number;
  classification: string;
  mesh: {
    url: string;
    sha256: string;
    uncompressedSha256: string;
    vertexCount: number;
    triangleCount: number;
    boundsUm: [number, number][];
  };
  voxelCount: number;
  focusVoxel: [number, number, number];
  boundsVoxel: [number, number][];
};
const regions = manifest.whiteMatterRegions as Region[];

test("white-matter helper classifies by ontology path and explicit exceptions only", () => {
  assert.equal(WHITE_MATTER_COLOR, "#80613d");
  assert.equal(WHITE_MATTER_LABEL, "白质 / 纤维束");
  assert.deepEqual([...WHITE_MATTER_EXCEPTION_IDS], [17, 42, 851, 2219]);
  assert.equal(FIBER_TRACTS_ROOT_ID, 1009);
  assert.equal(isWhiteMatterStructure(undefined), false);
  assert.equal(isWhiteMatterStructure(asHelper(byId.get(2461)!)), false);
  assert.equal(
    isWhiteMatterStructure({ id: 776, structure_id_path: [997, 8, 1009, 776] }),
    true,
  );
  // All four exceptions live outside the fiber-tracts subtree.
  for (const id of WHITE_MATTER_EXCEPTION_IDS) {
    const s = byId.get(id)!;
    assert.ok(!s.structureIdPath.includes(1009), s.name);
    assert.equal(isWhiteMatterStructure(asHelper(s)), true);
  }
  assert.match(byId.get(851)!.name, /Optic layer/);
  assert.match(byId.get(2219)!.name, /superior medullary velum/i);
  // Nuclei named after tracts are gray matter; name matching must never classify.
  for (const id of [619, 628, 634, 998, 2308]) {
    const s = byId.get(id)!;
    assert.match(s.name, /tract|commissure|stria/i);
    assert.equal(isWhiteMatterStructure(asHelper(s)), false, s.name);
  }
  assert.equal(isWhiteMatterStructure(asHelper(byId.get(997)!)), false);
  // The helper and the Python classifier must agree on the whole ontology.
  for (const s of ontology)
    assert.equal(
      isWhiteMatterStructure(asHelper(s)),
      s.id !== 2461 && (s.structureIdPath.includes(1009) || WHITE_MATTER_EXCEPTION_IDS.includes(s.id)),
    );
});

test("manifest covers exactly the white-matter labels present in the volume", () => {
  assert.ok(Array.isArray(regions) && regions.length > 0);
  assert.deepEqual(
    regions.map((r) => r.id),
    [...regions.map((r) => r.id)].sort((a, b) => a - b),
  );
  const present = new Set(annotation);
  present.delete(0);
  const expected = ontology
    .filter((s) => isWhiteMatterStructure(asHelper(s)) && present.has(s.id))
    .map((s) => s.id);
  assert.deepEqual(
    regions.map((r) => r.id).sort((a, b) => a - b),
    expected.sort((a, b) => a - b),
    "every present white-matter label needs a region, and nothing else",
  );
  for (const r of regions) {
    const s = byId.get(r.id);
    assert.ok(s && isWhiteMatterStructure(asHelper(s)), `region ${r.id} not white matter`);
    assert.equal(
      r.classification,
      s.structureIdPath.includes(1009)
        ? "fiber-tracts-subtree"
        : r.id === 2219
          ? "superior-medullary-velum-exception"
          : "superior-colliculus-white-layer-exception",
    );
    assert.ok(r.voxelCount > 0);
  }
  // Ontology-only structures are reported, not silently dropped or faked.
  const missing = manifest.whiteMatterProvenance.ontologyWithoutVoxels as number[];
  assert.ok(missing.includes(1009), "fiber tracts root has no voxels of its own");
  assert.ok(missing.includes(54), "mfb has no voxels in the v2 volume");
  for (const id of missing) {
    const s = byId.get(id)!;
    assert.ok(isWhiteMatterStructure(asHelper(s)));
    assert.ok(!present.has(id), `${id} reported missing but has voxels`);
  }
  assert.equal(
    regions.length + missing.length,
    manifest.whiteMatterProvenance.ontologyStructureCount,
  );
});

test("every white-matter mesh is non-empty, checksummed and consistent with the label voxels", async () => {
  const spacing = manifest.resolutionUm;
  for (const r of regions) {
    const compressed = await readFile(new URL(r.mesh.url.slice(1), root));
    assert.equal(
      createHash("sha256").update(compressed).digest("hex"),
      r.mesh.sha256,
      r.mesh.url,
    );
    const raw = gunzipSync(compressed);
    assert.equal(
      createHash("sha256").update(raw).digest("hex"),
      r.mesh.uncompressedSha256,
    );
    const view = new DataView(raw.buffer, raw.byteOffset, raw.length);
    const vertexCount = view.getUint32(0, true);
    const triangleCount = view.getUint32(4, true);
    assert.equal(vertexCount, r.mesh.vertexCount);
    assert.equal(triangleCount, r.mesh.triangleCount);
    assert.ok(vertexCount >= 4 && triangleCount >= 4, `mesh ${r.id} too small`);
    assert.equal(raw.length, 8 + (vertexCount + triangleCount) * 12);
    const vertices = new Float32Array(raw.buffer, raw.byteOffset + 8, vertexCount * 3);
    const faces = new Uint32Array(
      raw.buffer,
      raw.byteOffset + 8 + vertexCount * 12,
      triangleCount * 3,
    );
    let maxFace = 0;
    for (const index of faces) if (index > maxFace) maxFace = index;
    assert.ok(maxFace < vertexCount);
    // Mesh bounds must enclose the real label voxels and stay within one
    // half-voxel shell of them (level-0.5 isosurface of the padded mask).
    for (let axis = 0; axis < 3; axis++) {
      let lo = Infinity,
        hi = -Infinity;
      for (let i = axis; i < vertices.length; i += 3) {
        if (vertices[i] < lo) lo = vertices[i];
        if (vertices[i] > hi) hi = vertices[i];
      }
      const [vLo, vHi] = r.boundsVoxel[axis];
      assert.ok(lo <= vLo * spacing + 1e-3, `${r.id} axis ${axis} min`);
      assert.ok(hi >= vHi * spacing - 1e-3, `${r.id} axis ${axis} max`);
      assert.ok(lo >= (vLo - 0.5) * spacing - 1e-3, `${r.id} axis ${axis} shell min`);
      assert.ok(hi <= (vHi + 1.5) * spacing + 1e-3, `${r.id} axis ${axis} shell max`);
    }
    // focusVoxel must be a real voxel of this exact label.
    assert.equal(
      annotation[voxelIndex(r.focusVoxel, dims)],
      r.id,
      `focusVoxel of ${r.id} is not inside the label`,
    );
    assert.ok(r.focusVoxel.every((v, i) => v >= 0 && v < dims[i]));
  }
});

test("small labels and disjoint components survive reconstruction", () => {
  // Preserve even the smallest painted tracts.
  for (const [id, minimum] of [
    [753, 36],
    [949, 38],
  ] as const) {
    const r = regions.find((x) => x.id === id)!;
    assert.ok(r, `label ${id} missing`);
    assert.ok(r.voxelCount <= minimum * 2);
    assert.ok(r.mesh.triangleCount > 0);
  }
  // Ontology exceptions must be present with real voxels and meshes.
  for (const id of WHITE_MATTER_EXCEPTION_IDS) {
    const r = regions.find((x) => x.id === id);
    assert.ok(r, `exception ${id} missing`);
    assert.ok(r.voxelCount > 0 && r.mesh.triangleCount > 0);
  }
  // The corpus callosum spans both hemispheres; mesh must cover both sides.
  const cc = regions.find((r) => r.id === 776)!;
  assert.ok(cc.boundsVoxel[2][0] < dims[2] / 2 && cc.boundsVoxel[2][1] >= dims[2] / 2);
});

test("loadKimAnnotation exposes PF white-matter meshes under raw Kim IDs", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    init?.signal?.throwIfAborted();
    const url = String(input);
    return new Response(await readFile(new URL(url.slice(1), root)));
  };
  try {
    const base = await loadAtlas(new AbortController().signal, () => {});
    const kim = await loadKimAnnotation(base, new AbortController().signal);
    assert.equal(Object.keys(kim.meshes).length, regions.length);
    for (const r of regions) {
      const mesh = kim.meshes[String(r.id)];
      assert.ok(mesh, `mesh for ${r.id} not loaded`);
      assert.equal(mesh.url, r.mesh.url);
      assert.deepEqual(mesh.centroid, r.focusVoxel);
      assert.equal(base.meshes[String(r.id)], undefined);
    }
    // A known white-matter point resolves to a white-matter structure.
    const cc = regions.find((r) => r.id === 776)!;
    const hit = structureAt(kim, cc.focusVoxel);
    assert.ok(
      hit &&
        isWhiteMatterStructure({
          id: hit.id,
          structure_id_path: hit.structure_id_path,
        }),
    );
    // Catalog adapter negates IDs, keeps raw mesh keys and tags the category.
    const catalog = getWhiteMatterRegions(kim);
    assert.equal(catalog.length, regions.length);
    for (const entry of catalog) {
      assert.ok(entry.id < 0);
      assert.ok(kim.meshes[String(-entry.id)]);
      assert.equal(entry.category, "白质结构 · PF");
      assert.equal(entry.color, WHITE_MATTER_COLOR);
      assert.ok(entry.name && entry.englishName && entry.references.length);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
