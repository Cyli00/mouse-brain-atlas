import assert from "node:assert/strict";
import { segmentSlice } from "../src/lib/slice-segmentation";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { before, test } from "node:test";
import {
  PLANES,
  clampPosition,
  fromWorld,
  getBinary,
  isWithin,
  loadAtlas,
  makeSlice,
  nearestRegionPosition,
  planePosition,
  structureAt,
  toWorld,
  voxelIndex,
  type AtlasData,
  type PlaneName,
  type Position,
} from "../src/lib/atlas";
import {
  coordinateMm,
  coordinateVoxel,
  coordinateRange,
  snapCoordinateMm,
} from "../src/lib/coordinates";

type Asset = {
  url: string;
  bytes: number;
  uncompressedBytes: number;
  sha256: string;
  uncompressedSha256: string;
  vertexCount?: number;
  triangleCount?: number;
  boundsUm?: [number, number][];
};
type Region = {
  id: number;
  acronym: string;
  focusVoxel: Position;
  descendantIds: number[];
  boundsVoxel: [number, number][];
  voxelCount: number;
  mesh: Asset;
};
type Manifest = {
  dimensions: Position;
  resolutionUm: number;
  template: Asset;
  annotation: Asset;
  rootMesh: Asset;
  regions: Region[];
};
const dataRoot = new URL("../public/", import.meta.url);
const manifest: Manifest = JSON.parse(
  await readFile(new URL("data/manifest.json", dataRoot), "utf8"),
);
let atlas: AtlasData;

function signedMeshVolumeMm3(raw: Buffer) {
  const vertexCount = raw.readUInt32LE(0);
  let sixTimesVolume = 0;
  // Sum oriented tetrahedra against the origin; outward triangle winding gives positive volume.
  for (let offset = 8 + vertexCount * 12; offset < raw.length; offset += 12) {
    const a = 8 + raw.readUInt32LE(offset) * 12;
    const b = 8 + raw.readUInt32LE(offset + 4) * 12;
    const c = 8 + raw.readUInt32LE(offset + 8) * 12;
    const ax = raw.readFloatLE(a),
      ay = raw.readFloatLE(a + 4),
      az = raw.readFloatLE(a + 8);
    const bx = raw.readFloatLE(b),
      by = raw.readFloatLE(b + 4),
      bz = raw.readFloatLE(b + 8);
    const cx = raw.readFloatLE(c),
      cy = raw.readFloatLE(c + 4),
      cz = raw.readFloatLE(c + 8);
    sixTimesVolume +=
      ax * (by * cz - bz * cy) +
      ay * (bz * cx - bx * cz) +
      az * (bx * cy - by * cx);
  }
  return sixTimesVolume / 6e9;
}

async function withLocalFetch<T>(
  run: () => Promise<T>,
  replace?: { url: string; body: Buffer },
  decodedByBrowser = false,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    assert.match(url, /^\/(data|embryo)\/[a-zA-Z0-9/_.-]+$/);
    const bytes =
      replace?.url === url
        ? replace.body
        : await readFile(new URL(url.slice(1), dataRoot));
    // A real fetch retains this header after decoding the HTTP response body.
    return decodedByBrowser && url.endsWith(".gz")
      ? new Response(gunzipSync(bytes), {
          headers: { "Content-Encoding": "gzip" },
        })
      : new Response(bytes);
  };
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

before(async () => {
  atlas = await withLocalFetch(() =>
    loadAtlas(new AbortController().signal, () => {}),
  );
});

test("each embryo stage loads its own real coordinate space, labels and mesh assets", async (t) => {
  type Stage = {
    stage: string;
    manifest: string;
    dimensions: Position;
    resolutionUm: number;
    regionIds: number[];
  };
  const index: { stages: Stage[] } = JSON.parse(
    await readFile(new URL("embryo/index.json", dataRoot), "utf8"),
  );
  assert.deepEqual(
    index.stages.map((stage) => stage.stage),
    ["E11.5", "E13.5", "E15.5", "E18.5"],
  );
  const expectedDimensions: Record<string, Position> = {
    "E11.5": [94, 125, 37],
    "E13.5": [152, 90, 37],
    "E15.5": [175, 101, 50],
    "E18.5": [202, 112, 60],
  };
  for (const stage of index.stages)
    await t.test(stage.stage, async () => {
      const stageManifest: Manifest & {
        stage: string;
        rootId: number;
        hemisphere: string;
        ontology: { graphId: number };
      } = JSON.parse(
        await readFile(new URL(stage.manifest.slice(1), dataRoot), "utf8"),
      );
      const data = await withLocalFetch(() =>
        loadAtlas(new AbortController().signal, () => {}, stage.manifest),
      );
      assert.equal(stageManifest.stage, stage.stage);
      assert.equal(stageManifest.rootId, 15565);
      assert.equal(stageManifest.ontology.graphId, 17);
      assert.match(stageManifest.hemisphere, /unilateral.*not mirrored/i);
      assert.deepEqual(data.dimensions, expectedDimensions[stage.stage]);
      assert.deepEqual(data.dimensions, stage.dimensions);
      assert.deepEqual(data.dimensions, stageManifest.dimensions);
      assert.equal(data.spacing, 40);
      assert.equal(data.spacing, stage.resolutionUm);
      assert.equal(data.rootId, stageManifest.rootId);
      const bounds = stageManifest.rootMesh.boundsUm!;
      const origins: Position = [bounds[0][0], bounds[1][0], bounds[2][1]];
      assert.deepEqual(data.coordinateOriginsUm, origins);
      const toMm = (voxel: number, axis: number) =>
        coordinateMm(voxel, axis, data.spacing, origins[0], origins[2], origins[1]);
      const toVoxel = (mm: number, axis: number) =>
        coordinateVoxel(mm, axis, data.spacing, origins[0], origins[2], origins[1]);
      for (let axis = 0; axis < 3; axis++)
        for (let voxel = 0; voxel < data.dimensions[axis]; voxel++) {
          assert.equal(Math.round(toVoxel(toMm(voxel, axis), axis)), voxel);
        }
      for (let axis = 0; axis < 3; axis++)
        assert.equal(toMm(origins[axis] / data.spacing, axis), 0);
      for (let axis = 0; axis < 3; axis++) {
        const { min, max } = coordinateRange(
          data.dimensions[axis], axis, data.spacing,
          origins[0], origins[2], origins[1],
        );
        const preference = axis === 1 ? "upper" : "lower";
        const snap = (mm: number) =>
          snapCoordinateMm(mm, min, max, data.spacing / 1000, preference);
        const zeroSlice = Math.round(toVoxel(snap(0), axis));
        assert.equal(toMm(zeroSlice, axis), axis === 1 ? 0.02 : -0.02);
        const stride = axis === 0 ? 1
          : axis === 1 ? data.dimensions[0]
          : data.dimensions[0] * data.dimensions[1];
        assert.ok(
          data.annotation.some((label, i) =>
            label !== 0 && Math.floor(i / stride) % data.dimensions[axis] === zeroSlice,
          ),
          `${stage.stage} axis ${axis}: zero input must select a slice containing annotation`,
        );
        for (let voxel = 0; voxel < data.dimensions[axis]; voxel++)
          assert.equal(
            Math.round(toVoxel(snap(toMm(voxel, axis)), axis)),
            voxel,
            "valid coordinates, including padding, must not move",
          );
      }
      assert.ok(toMm(0, 0) > 0);
      assert.ok(toMm(0, 1) < 0);
      assert.ok(toMm(0, 2) < 0);
      assert.equal(
        data.meshes[String(data.rootId)].url,
        stageManifest.rootMesh.url,
      );
      assert.equal(
        data.meshes["997"],
        undefined,
        "embryos must not load the adult root mesh",
      );
      assert.deepEqual(
        stageManifest.regions.map((region) => region.id),
        stage.regionIds,
      );
      const count = data.dimensions.reduce((total, value) => total * value, 1);
      assert.equal(data.template.length, count);
      assert.equal(data.annotation.length, count);
      const labels = new Set(data.annotation);
      labels.delete(0);
      for (const label of labels)
        assert.ok(
          data.structures.has(label),
          `${stage.stage}: unknown annotation ${label}`,
        );

      const [nx, ny] = data.dimensions;
      const regionsForLabel = new Map<number, Region[]>();
      const measured = new Map(
        stageManifest.regions.map((region) => [
          region.id,
          {
            count: 0,
            bounds: [
              [Infinity, -Infinity],
              [Infinity, -Infinity],
              [Infinity, -Infinity],
            ],
          },
        ]),
      );
      for (const region of stageManifest.regions) {
        const expectedIds = [...data.structures.values()]
          .filter((structure) => isWithin(structure, region.id))
          .map((structure) => structure.id)
          .sort((a, b) => a - b);
        assert.deepEqual(
          [...region.descendantIds].sort((a, b) => a - b),
          expectedIds,
        );
        for (const id of region.descendantIds)
          regionsForLabel.set(id, [...(regionsForLabel.get(id) ?? []), region]);
        region.focusVoxel.forEach((value, axis) =>
          assert.ok(
            Number.isInteger(value) &&
              value >= 0 &&
              value < data.dimensions[axis],
          ),
        );
        assert.ok(
          isWithin(structureAt(data, region.focusVoxel), region.id),
          `${stage.stage}: ${region.acronym} focus`,
        );
        assert.deepEqual(
          fromWorld(
            toWorld(region.focusVoxel, data.dimensions, data.spacing),
            data.dimensions,
            data.spacing,
          ),
          region.focusVoxel,
        );
      }
      for (let index = 0; index < data.annotation.length; index++) {
        const regions = regionsForLabel.get(data.annotation[index]);
        if (!regions) continue;
        const point = [
          index % nx,
          Math.floor(index / nx) % ny,
          Math.floor(index / (nx * ny)),
        ];
        for (const region of regions) {
          const stats = measured.get(region.id)!;
          stats.count++;
          point.forEach((value, axis) => {
            stats.bounds[axis][0] = Math.min(stats.bounds[axis][0], value);
            stats.bounds[axis][1] = Math.max(stats.bounds[axis][1], value);
          });
        }
      }
      for (const region of stageManifest.regions) {
        const stats = measured.get(region.id)!;
        assert.equal(stats.count, region.voxelCount, region.acronym);
        assert.deepEqual(stats.bounds, region.boundsVoxel, region.acronym);
        for (let axis = 0; axis < 3; axis++) {
          assert.deepEqual(
            region.mesh.boundsUm![axis],
            [
              (stats.bounds[axis][0] - 0.5) * data.spacing,
              (stats.bounds[axis][1] + 0.5) * data.spacing,
            ],
            `${stage.stage}: ${region.acronym} marching-cubes extent`,
          );
        }
      }
      for (const asset of [
        stageManifest.template,
        stageManifest.annotation,
        stageManifest.rootMesh,
        ...stageManifest.regions.map((region) => region.mesh),
      ]) {
        const compressed = await readFile(
          new URL(asset.url.slice(1), dataRoot),
        );
        assert.equal(compressed.length, asset.bytes, asset.url);
        assert.equal(
          createHash("sha256").update(compressed).digest("hex"),
          asset.sha256,
          asset.url,
        );
        const raw = gunzipSync(compressed);
        assert.equal(raw.length, asset.uncompressedBytes, asset.url);
        assert.equal(
          createHash("sha256").update(raw).digest("hex"),
          asset.uncompressedSha256,
          asset.url,
        );
        if (!asset.vertexCount) continue;
        const vertices = raw.readUInt32LE(0),
          triangles = raw.readUInt32LE(4);
        assert.equal(vertices, asset.vertexCount);
        assert.equal(triangles, asset.triangleCount);
        assert.equal(raw.length, 8 + 12 * (vertices + triangles));
        for (let offset = 8 + vertices * 12; offset < raw.length; offset += 4)
          assert.ok(raw.readUInt32LE(offset) < vertices);
        const signedVolume = signedMeshVolumeMm3(raw);
        assert.ok(
          Number.isFinite(signedVolume) && signedVolume > 0,
          `${asset.url}: native mesh triangles must face outward, signed volume ${signedVolume} mm³`,
        );
        for (let axis = 0; axis < 3; axis++) {
          let min = Infinity,
            max = -Infinity;
          for (let vertex = 0; vertex < vertices; vertex++) {
            const value = raw.readFloatLE(8 + vertex * 12 + axis * 4);
            assert.ok(Number.isFinite(value));
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
          assert.deepEqual([min, max], asset.boundsUm![axis]);
          assert.ok(
            min >= -data.spacing / 2 &&
              max <= (data.dimensions[axis] - 0.5) * data.spacing,
          );
        }
      }
    });
});

test("the browser loader reads the actual Allen volume and preserves its binary dimensions", () => {
  assert.deepEqual(atlas.dimensions, [264, 160, 228]);
  assert.equal(atlas.spacing, 50);
  assert.equal(atlas.rootId, 997);
  assert.equal(manifest.regions.length, 65);
  const count = 264 * 160 * 228;
  assert.equal(atlas.template.length, count);
  assert.equal(atlas.annotation.length, count);
  assert.equal(atlas.template.byteLength, manifest.template.uncompressedBytes);
  assert.equal(
    atlas.annotation.byteLength,
    manifest.annotation.uncompressedBytes,
  );
  assert.equal(atlas.structures.get(382)?.acronym, "CA1");
  assert.equal(atlas.structures.get(972)?.name, "Prelimbic area");
});

test("the loader rejects a truncated annotation volume instead of displaying misregistered data", async () => {
  await withLocalFetch(
    () =>
      assert.rejects(
        loadAtlas(new AbortController().signal, () => {}),
        /体数据长度与坐标定义不匹配/,
      ),
    { url: manifest.annotation.url, body: gzipSync(Buffer.alloc(4)) },
  );
});

test("already-decoded HTTP gzip volumes and meshes load without a second decompression", async () => {
  await withLocalFetch(
    async () => {
      const decoded = await loadAtlas(new AbortController().signal, () => {});
      assert.deepEqual(decoded.dimensions, atlas.dimensions);
      assert.equal(
        createHash("sha256").update(decoded.template).digest("hex"),
        manifest.template.uncompressedSha256,
      );
      assert.equal(
        createHash("sha256").update(decoded.annotation).digest("hex"),
        manifest.annotation.uncompressedSha256,
      );
      const mesh = await getBinary(manifest.rootMesh.url);
      assert.equal(mesh.byteLength, manifest.rootMesh.uncompressedBytes);
      assert.equal(
        createHash("sha256").update(new Uint8Array(mesh)).digest("hex"),
        manifest.rootMesh.uncompressedSha256,
      );
    },
    undefined,
    true,
  );
});

test("empty and one-byte raw responses reach the volume validation error rather than a header-read crash", async () => {
  for (const body of [Buffer.alloc(0), Buffer.from([0x1f])]) {
    await withLocalFetch(
      () =>
        assert.rejects(
          loadAtlas(new AbortController().signal, () => {}),
          /体数据长度与坐标定义不匹配/,
        ),
      { url: manifest.annotation.url, body },
    );
  }
});

test("a truncated response with gzip magic is rejected instead of treated as decoded bytes", async () => {
  await withLocalFetch(() => assert.rejects(getBinary(manifest.rootMesh.url)), {
    url: manifest.rootMesh.url,
    body: Buffer.from([0x1f, 0x8b]),
  });
});

test("AP is the fastest raster axis and boundary indices cover exactly the volume", () => {
  const d = atlas.dimensions;
  assert.equal(voxelIndex([0, 0, 0], d), 0);
  assert.equal(voxelIndex([1, 0, 0], d), 1);
  assert.equal(voxelIndex([0, 1, 0], d), 264);
  assert.equal(voxelIndex([0, 0, 1], d), 264 * 160);
  assert.equal(voxelIndex([263, 159, 227], d), atlas.annotation.length - 1);
  assert.deepEqual(clampPosition([-3, Infinity, 500], d), [0, 0, 227]);
  assert.deepEqual(clampPosition([12.49, 67.51, NaN], d), [12, 68, 0]);
});

test("slice clicks preserve the fixed anatomical axis and map the two displayed axes correctly", () => {
  const p: Position = [91, 65, 114];
  assert.deepEqual(planePosition("coronal", p, 20, 30), [91, 30, 20]);
  assert.deepEqual(planePosition("sagittal", p, 20, 30), [20, 30, 114]);
  assert.deepEqual(planePosition("horizontal", p, 20, 30), [30, 65, 20]);
  assert.deepEqual(PLANES.coronal.direction, ["L", "R", "D", "V"]);
  assert.deepEqual(PLANES.sagittal.direction, ["A", "P", "D", "V"]);
  assert.deepEqual(PLANES.horizontal.direction, ["L", "R", "A", "P"]);
  assert.deepEqual(p, [91, 65, 114]);
});

test("world coordinates preserve anatomical directions, millimeter spacing and landmark round trips", () => {
  const d = atlas.dimensions;
  const center: Position = [131.5, 79.5, 113.5];
  assert.deepEqual(toWorld(center, d, 50), [0, 0, 0]);
  const origin = toWorld([0, 0, 0], d, 50);
  origin.forEach((coordinate, axis) =>
    assert.ok(Math.abs(coordinate - [-5.675, 3.975, 6.575][axis]) < 1e-12),
  );
  const landmarks: Position[] = manifest.regions.map(
    (region) => region.focusVoxel,
  );
  for (const ap of [0, 263])
    for (const dv of [0, 159])
      for (const ml of [0, 227]) landmarks.push([ap, dv, ml]);
  for (const p of landmarks)
    assert.deepEqual(fromWorld(toWorld(p, d, 50), d, 50), p);
  for (const [step, worldAxis, sign] of [
    [[1, 0, 0], 2, -1],
    [[0, 1, 0], 1, -1],
    [[0, 0, 1], 0, 1],
  ] as [Position, number, number][]) {
    const moved = toWorld(step, d, 50);
    assert.ok(
      Math.abs(moved[worldAxis] - origin[worldAxis] - sign * 0.05) < 1e-12,
    );
  }
});

test("all curated jump points lie in their own real Allen region, including descendant layers", () => {
  for (const region of manifest.regions) {
    region.focusVoxel.forEach((coordinate, axis) => {
      assert.ok(
        Number.isInteger(coordinate) &&
          coordinate >= 0 &&
          coordinate < atlas.dimensions[axis],
      );
    });
    const label = structureAt(atlas, region.focusVoxel);
    assert.ok(label, `${region.acronym} must have an annotation at its focus`);
    assert.ok(
      isWithin(label, region.id),
      `${region.acronym} focus must be inside its ontology subtree`,
    );
    const expected = [...atlas.structures.values()]
      .filter((s) => isWithin(s, region.id))
      .map((s) => s.id)
      .sort((a, b) => a - b);
    assert.deepEqual(
      [...region.descendantIds].sort((a, b) => a - b),
      expected,
    );
  }
  const pl = manifest.regions.find((region) => region.id === 972)!;
  const layer = structureAt(atlas, pl.focusVoxel)!;
  assert.notEqual(
    layer.id,
    972,
    "the PL focus exercises a descendant annotation rather than a parent-only equality",
  );
  assert.ok(isWithin(layer, 972));
  assert.ok(!isWithin(layer, 382));
  assert.ok(!isWithin(undefined, 972));
});

test("region fallback search chooses an actual left-hemisphere voxel and handles an absent ID", () => {
  const position = nearestRegionPosition(atlas, 972);
  assert.ok(position);
  assert.ok(position[2] < atlas.dimensions[2] / 2);
  assert.ok(isWithin(structureAt(atlas, position), 972));
  assert.equal(nearestRegionPosition(atlas, -1), null);
});

class TestImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {
    assert.equal(data.length, width * height * 4);
  }
}

function pixel(image: ImageData, u: number, v: number) {
  return [
    ...image.data.slice(
      (v * image.width + u) * 4,
      (v * image.width + u) * 4 + 4,
    ),
  ];
}

test("all three slice images share the same physical intersection and use the stated image orientation", () => {
  const original = globalThis.ImageData;
  globalThis.ImageData = TestImageData as unknown as typeof ImageData;
  try {
    for (const p of [
      [159, 57, 53],
      [62, 56, 105],
      [107, 84, 67],
    ] as Position[]) {
      const coronal = makeSlice(atlas, "coronal", p, 382, true, 300);
      const sagittal = makeSlice(atlas, "sagittal", p, 382, true, 300);
      const horizontal = makeSlice(atlas, "horizontal", p, 382, true, 300);
      assert.deepEqual([coronal.width, coronal.height], [228, 160]);
      assert.deepEqual([sagittal.width, sagittal.height], [264, 160]);
      assert.deepEqual([horizontal.width, horizontal.height], [228, 264]);
      assert.deepEqual(pixel(coronal, p[2], p[1]), pixel(sagittal, p[0], p[1]));
      assert.deepEqual(
        pixel(coronal, p[2], p[1]),
        pixel(horizontal, p[2], p[0]),
      );
    }
    const tiny: AtlasData = {
      ...atlas,
      dimensions: [5, 4, 3],
      template: Uint16Array.from({ length: 60 }, (_, i) => i + 5),
      annotation: new Uint32Array(60),
      structures: new Map(),
    };
    const p: Position = [2, 1, 1];
    const definitions: [
      PlaneName,
      number,
      number,
      (u: number, v: number) => number,
    ][] = [
      ["coronal", 3, 4, (u, v) => 2 + 5 * v + 20 * u],
      ["sagittal", 5, 4, (u, v) => u + 5 * v + 20],
      ["horizontal", 3, 5, (u, v) => v + 5 + 20 * u],
    ];
    for (const [name, width, height, indexAt] of definitions) {
      const image = makeSlice(tiny, name, p, 0, false, 300);
      for (let v = 0; v < height; v++)
        for (let u = 0; u < width; u++) {
          const gray = new Uint8ClampedArray([
            Math.pow((indexAt(u, v) + 5) / 300, 0.7) * 235,
          ])[0];
          assert.deepEqual(
            pixel(image, u, v),
            [gray, gray, gray, 255],
            `${name} at (${u}, ${v})`,
          );
        }
    }
  } finally {
    if (original) globalThis.ImageData = original;
    else delete (globalThis as { ImageData?: typeof ImageData }).ImageData;
  }
});

test("packed volumes and every official mesh match their recorded hashes, sizes and mesh indices", async () => {
  const meshes = [
    manifest.rootMesh,
    ...manifest.regions.map((region) => region.mesh),
  ];
  for (const asset of [manifest.template, manifest.annotation, ...meshes]) {
    const compressed = await readFile(new URL(asset.url.slice(1), dataRoot));
    assert.equal(compressed.byteLength, asset.bytes, asset.url);
    assert.equal(
      createHash("sha256").update(compressed).digest("hex"),
      asset.sha256,
      asset.url,
    );
    const raw = gunzipSync(compressed);
    assert.equal(raw.byteLength, asset.uncompressedBytes, asset.url);
    assert.equal(
      createHash("sha256").update(raw).digest("hex"),
      asset.uncompressedSha256,
      asset.url,
    );
    if (!asset.vertexCount) continue;
    const vertexCount = raw.readUInt32LE(0),
      triangleCount = raw.readUInt32LE(4);
    assert.equal(vertexCount, asset.vertexCount);
    assert.equal(triangleCount, asset.triangleCount);
    assert.equal(raw.length, 8 + vertexCount * 12 + triangleCount * 12);
    for (let offset = 8 + vertexCount * 12; offset < raw.length; offset += 4)
      assert.ok(raw.readUInt32LE(offset) < vertexCount);
    const signedVolume = signedMeshVolumeMm3(raw);
    assert.ok(
      Number.isFinite(signedVolume) && signedVolume > 0,
      `${asset.url}: native mesh triangles must face outward, signed volume ${signedVolume} mm³`,
    );
    for (let axis = 0; axis < 3; axis++) {
      let min = Infinity,
        max = -Infinity;
      for (let vertex = 0; vertex < vertexCount; vertex++) {
        const value = raw.readFloatLE(8 + vertex * 12 + axis * 4);
        assert.ok(Number.isFinite(value));
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      assert.deepEqual([min, max], asset.boundsUm![axis]);
      assert.ok(
        min >= -atlas.spacing &&
          max <= (atlas.dimensions[axis] + 1) * atlas.spacing,
      );
    }
  }
});

test("official mesh extents align with independently counted annotation extents within 0.25 mm", () => {
  const regionsForLabel = new Map<number, Region[]>();
  const measurements = new Map(
    manifest.regions.map((region) => [
      region.id,
      {
        count: 0,
        bounds: [
          [Infinity, -Infinity],
          [Infinity, -Infinity],
          [Infinity, -Infinity],
        ],
      },
    ]),
  );
  for (const region of manifest.regions)
    for (const id of region.descendantIds) {
      const parents = regionsForLabel.get(id) ?? [];
      parents.push(region);
      regionsForLabel.set(id, parents);
    }
  const [nx, ny] = atlas.dimensions;
  for (let index = 0; index < atlas.annotation.length; index++) {
    const regions = regionsForLabel.get(atlas.annotation[index]);
    if (!regions) continue;
    const p = [
      index % nx,
      Math.floor(index / nx) % ny,
      Math.floor(index / (nx * ny)),
    ];
    for (const region of regions) {
      const measured = measurements.get(region.id)!;
      measured.count++;
      for (let axis = 0; axis < 3; axis++) {
        measured.bounds[axis][0] = Math.min(measured.bounds[axis][0], p[axis]);
        measured.bounds[axis][1] = Math.max(measured.bounds[axis][1], p[axis]);
      }
    }
  }
  for (const region of manifest.regions) {
    const measured = measurements.get(region.id)!;
    assert.equal(measured.count, region.voxelCount, region.acronym);
    assert.deepEqual(measured.bounds, region.boundsVoxel, region.acronym);
    for (let axis = 0; axis < 3; axis++)
      for (let side = 0; side < 2; side++) {
        // Allen's smoothed surface is not an exact isosurface of its coarser 50 µm annotation.
        const differenceUm = Math.abs(
          region.mesh.boundsUm![axis][side] -
            measured.bounds[axis][side] * atlas.spacing,
        );
        assert.ok(
          differenceUm < 250,
          `${region.acronym} axis ${axis} extent differs by ${differenceUm} µm`,
        );
      }
  }
});


test("adult Allen fine sections retain cortical layers and every visible label", () => {
  const present = new Set(atlas.annotation);
  present.delete(0);
  assert.equal(present.size, 670);
  for (const acronym of ["VISp1", "VISp2/3", "VISp4", "VISp5", "VISp6a", "VISp6b"]) {
    const layer = [...atlas.structures.values()].find(s => s.acronym === acronym);
    assert.ok(layer && present.has(layer.id), `${acronym} is a real labeled cortical layer`);
  }
  for (const plane of ["coronal", "sagittal", "horizontal"] as PlaneName[]) {
    const section = segmentSlice(atlas, plane, [159, 57, 53][PLANES[plane].axis]);
    assert.ok(section.regions.length > 20);
    assert.deepEqual(new Set(section.regions.map(r => r.id)), new Set([...section.labels].filter(Boolean)));
    for (const region of section.regions) {
      assert.equal(section.labels[Math.floor(region.v) * section.width + Math.floor(region.u)], region.id);
      assert.equal(region.acronym, atlas.structures.get(region.id)?.acronym);
    }
  }
});
