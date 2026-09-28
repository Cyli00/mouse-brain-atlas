import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import {
  segmentSlice,
  segmentationImage,
  layoutSliceLabels,
} from "../src/lib/slice-segmentation";
import { WHITE_MATTER_COLOR } from "../src/lib/white-matter";
import {
  planePosition,
  voxelIndex,
  type AtlasData,
  type Position,
  type PlaneName,
  type Structure,
} from "../src/lib/atlas";

// segmentationImage targets the browser canvas API; tests only need its pixel buffer.
(globalThis as Record<string, unknown>).ImageData ??= class {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

function synthetic(rows: number[][]): AtlasData {
  const d: Position = [1, rows.length, rows[0].length];
  const annotation = new Uint32Array(d[1] * d[2]);
  rows.forEach((row, v) =>
    row.forEach((id, u) => (annotation[voxelIndex([0, v, u], d)] = id)),
  );
  return {
    dimensions: d,
    spacing: 50,
    annotation,
    template: new Uint16Array(annotation.length),
    meshes: {},
    manifest: {},
    structures: new Map(
      [1, 2].map((id) => [
        id,
        {
          id,
          acronym: `R${id}`,
          name: `Region ${id}`,
          color_hex_triplet: "abcdef",
          structure_id_path: [id],
        },
      ]),
    ),
  };
}

test("segmentation retains internal interfaces, holes, and separate bilateral components", () => {  const data = synthetic([
    [1, 1, 1, 0, 2],
    [1, 0, 1, 0, 2],
    [1, 1, 1, 0, 1],
  ]);
  const s = segmentSlice(data, "coronal", 0);
  assert.equal(s.components.filter((c) => c.id === 1).length, 2);
  assert.equal(s.regions.length, 2);
  assert.equal(
    s.components.reduce((n, c) => n + c.area, 0),
    11,
  );
  assert.ok(
    s.boundaryPath.includes("M1,1H2"),
    "the hole's border must not vanish",
  );
  assert.ok(
    s.boundaryPath.includes("M4,2H5"),
    "different labels must have an internal boundary",
  );
  for (const c of s.components)
    assert.equal(
      s.labels[Math.floor(c.v) * s.width + Math.floor(c.u)],
      c.id,
      "anchor is inside its own region, never at a centroid in the hole",
    );
  const empty = segmentSlice(
    synthetic([
      [0, 0],
      [0, 0],
    ]),
    "coronal",
    0,
  );
  assert.deepEqual(empty.regions, []);
  assert.equal(empty.boundaryPath, "");
});

test("white matter structures are flagged, outlined, and colored by the shared helper", () => {
  const build = (rows: number[][], structures: Structure[]): AtlasData => {
    const d: Position = [1, rows.length, rows[0].length];
    const annotation = new Uint32Array(d[1] * d[2]);
    rows.forEach((row, v) =>
      row.forEach((id, u) => (annotation[voxelIndex([0, v, u], d)] = id)),
    );
    return {
      dimensions: d,
      spacing: 50,
      annotation,
      template: new Uint16Array(annotation.length),
      meshes: {},
      manifest: {},
      structures: new Map(structures.map((s) => [s.id, s])),
    };
  };
  const stub = (
    id: number,
    acronym: string,
    structure_id_path: number[],
  ): Structure => ({
    id,
    acronym,
    name: acronym,
    color_hex_triplet: "abcdef",
    structure_id_path,
  });
  const data = build(
    [
      [1, 1, 2, 2],
      [17, 17, 0, 0],
    ],
    [
      stub(1, "GR", [997, 8, 343, 1]),
      stub(2, "TR", [997, 8, 1009, 2]),
      stub(17, "InWh", [997, 8, 343, 313, 339, 2476, 294, 17]),
    ],
  );
  const s = segmentSlice(data, "coronal", 0);
  const byId = new Map(s.regions.map((r) => [r.id, r]));
  assert.equal(byId.get(1)?.whiteMatter, false, "grey matter stays grey");
  assert.equal(byId.get(2)?.whiteMatter, true, "1009 path marks a tract");
  assert.equal(
    byId.get(17)?.whiteMatter,
    true,
    "collicular white layer is white matter outside the 1009 path",
  );
  // White outline covers the grey/white interface and the tract's outer rim,
  // but never the internal edge between two grey voxels.
  assert.ok(s.whiteMatterPath.includes("M0,1H4"));
  assert.ok(s.whiteMatterPath.includes("M2,0V2"));
  assert.ok(s.whiteMatterPath.includes("M2,0H4"));
  assert.ok(s.boundaryPath.includes("M0,0H4"), "grey rim is in the full boundary");
  assert.ok(
    !s.whiteMatterPath.includes("M0,0H4"),
    "the white outline skips rims that only touch grey tissue",
  );
  const image = segmentationImage(s, data) as unknown as {
    data: Uint8ClampedArray;
  };
  const whiteHex = WHITE_MATTER_COLOR.slice(1);
  const expected = [0, 2, 4].map((start) =>
    Math.round(255 * 0.86 + parseInt(whiteHex.slice(start, start + 2), 16) * 0.14),
  );
  const tract = byId.get(2)!;
  const at =
    (Math.floor(tract.v) * s.width + Math.floor(tract.u)) * 4;
  assert.deepEqual([...image.data.slice(at, at + 3)], expected);
  const grey = byId.get(1)!;
  const greyAt = (Math.floor(grey.v) * s.width + Math.floor(grey.u)) * 4;
  assert.notDeepEqual([...image.data.slice(greyAt, greyAt + 3)], expected);

  // 851 Op (retinal axon layer, under SC sensory 302) and 2219 SMV (a thin
  // white lamina filed under the ventricular branch) are explicit exceptions.
  const exceptions = segmentSlice(
    build(
      [[851, 2219, 2461]],
      [
        stub(851, "Op", [997, 8, 343, 313, 339, 2476, 302, 851]),
        stub(2219, "SMV", [997, 8, 73, 145, 2219]),
        stub(2461, "I8", [997, 8, 1009, 967, 933, 2461]),
      ],
    ),
    "coronal",
    0,
  );
  const exceptionById = new Map(exceptions.regions.map((r) => [r.id, r]));
  assert.equal(
    exceptionById.get(851)?.whiteMatter,
    true,
    "Op (851) is a retinal-fiber white layer outside the fiber-tract path",
  );
  assert.equal(
    exceptionById.get(2219)?.whiteMatter,
    true,
    "SMV (2219) is a white lamina despite sitting under the ventricular branch",
  );
  assert.equal(
    exceptionById.get(2461)?.whiteMatter,
    false,
    "I8 (2461) is a nucleus misfiled under fiber tracts, never white matter",
  );
});

test("real Kim sections enumerate every present ID and position each region inside its actual mask in all planes", async () => {
  const raw = gunzipSync(
    await readFile(
      new URL("../public/data/kim-v2/annotation.uint32.gz", import.meta.url),
    ),
  );
  const ontology = JSON.parse(
    await readFile(
      new URL("../public/data/kim-v2/ontology.json", import.meta.url),
      "utf8",
    ),
  );
  const data: AtlasData = {
    dimensions: [264, 160, 228],
    spacing: 50,
    annotation: new Uint32Array(raw.buffer, raw.byteOffset, raw.length / 4),
    template: new Uint16Array(),
    meshes: {},
    manifest: {},
    structures: new Map(
      ontology.map(
        (s: {
          id: number;
          name: string;
          acronym: string;
          color: string;
          structureIdPath: number[];
        }) => [
          s.id,
          {
            id: s.id,
            name: s.name,
            acronym: s.acronym,
            color_hex_triplet: s.color.slice(1),
            structure_id_path: s.structureIdPath,
          },
        ],
      ),
    ),
  };
  for (const [name, depth, position] of [
    ["coronal", 189, [189, 0, 0]],
    ["sagittal", 114, [0, 0, 114]],
    ["horizontal", 60, [0, 60, 0]],
  ] as [PlaneName, number, Position][]) {
    const s = segmentSlice(data, name, depth);
    assert.deepEqual(
      new Set(s.regions.map((r) => r.id)),
      new Set([...s.labels].filter(Boolean)),
    );
    for (const c of s.components) {
      const p = planePosition(name, position, Math.floor(c.u), Math.floor(c.v));
      assert.equal(data.annotation[voxelIndex(p, data.dimensions)], c.id);
    }
    const small = layoutSliceLabels(s, 228, 160);
    const large = layoutSliceLabels(s, s.width * 5, s.height * 5);
    assert.ok(large.length > small.length);
    for (const label of large)
      assert.equal(
        s.labels[Math.floor(label.v) * s.width + Math.floor(label.u)],
        label.id,
      );
    if (name === "coronal") {
      const names = new Set(s.regions.map((r) => r.acronym));
      for (const name of ["DMPAG", "DLPAG", "LPAG", "SuG", "InG", "InWh", "Aq"])
        assert.ok(names.has(name), name);
      const byAcronym = new Map(s.regions.map((r) => [r.acronym, r]));
      assert.ok(
        byAcronym.get("InWh")?.whiteMatter,
        "InWh (id 17) is white matter despite sitting outside the fiber-tract path",
      );
      assert.ok(
        byAcronym.get("Op")?.whiteMatter,
        "Op (851) carries retinal fibers and counts as white matter",
      );
      assert.equal(byAcronym.get("DMPAG")?.whiteMatter, false);
      assert.equal(byAcronym.get("Aq")?.whiteMatter, false);
      assert.ok(
        s.whiteMatterPath.length > 0,
        "PF slices expose a dedicated white-matter outline",
      );
      assert.ok(
        s.regions.some((r) => r.whiteMatter),
        "the section lists at least one white-matter structure",
      );
    }
    if (name === "sagittal") {
      const byAcronym = new Map(s.regions.map((r) => [r.acronym, r]));
      assert.ok(
        byAcronym.get("SMV")?.whiteMatter,
        "even the 7-voxel SMV (2219) stays reachable and marked white",
      );
    }
  }
});
