import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { segmentSlice, layoutSliceLabels } from "../src/lib/slice-segmentation";
import {
  planePosition,
  voxelIndex,
  type AtlasData,
  type Position,
  type PlaneName,
} from "../src/lib/atlas";

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

test("segmentation retains internal interfaces, holes, and separate bilateral components", () => {
  const data = synthetic([
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
    }
  }
});
