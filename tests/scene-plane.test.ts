import assert from "node:assert/strict";
import test from "node:test";
import { PLANES, PLANE_ORDER, voxelIndex, type AtlasData, type Position } from "../src/lib/atlas";
import { scenePlaneImage } from "../src/lib/scene-plane";

(globalThis as Record<string, unknown>).ImageData ??= class {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(width: number, height: number);
  constructor(data: Uint8ClampedArray, width: number, height: number);
  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
    this.width = typeof dataOrWidth === "number" ? dataOrWidth : widthOrHeight;
    this.height = typeof dataOrWidth === "number" ? widthOrHeight : height!;
    this.data = typeof dataOrWidth === "number" ? new Uint8ClampedArray(this.width * this.height * 4) : dataOrWidth;
  }
};

test("3D tissue and region textures follow each anatomical plane and exclude unlabelled space", () => {
  const dimensions: Position = [4, 4, 4];
  const annotation = new Uint32Array(64);
  for (let z = 0; z < 4; z++) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++)
    annotation[voxelIndex([x, y, z], dimensions)] = (x + y + z) % 3;
  const data: AtlasData = {
    dimensions, annotation, spacing: 50,
    template: new Uint16Array(64).fill(100), meshes: {}, manifest: {},
    structures: new Map([
      [1, { id: 1, name: "Red region", acronym: "R", color_hex_triplet: "ff0000", structure_id_path: [1] }],
      [2, { id: 2, name: "Blue region", acronym: "B", color_hex_triplet: "0000ff", structure_id_path: [2] }],
    ]),
  };
  const position: Position = [1, 2, 3];
  for (const name of PLANE_ORDER) {
    const plane = PLANES[name];
    const tissue = scenePlaneImage(data, name, position, "tissue", 200);
    const regions = scenePlaneImage(data, name, position, "regions", 200);
    const differentContrast = scenePlaneImage(data, name, position, "regions", 800);
    assert.deepEqual(regions.data, differentContrast.data, "partition colors must not follow the tissue window");
    assert.notDeepEqual(tissue.data, regions.data);
    for (let v = 0; v < 4; v++) for (let u = 0; u < 4; u++) {
      const point: Position = [...position]; point[plane.u] = u; point[plane.v] = v;
      const alpha = annotation[voxelIndex(point, dimensions)] ? 255 : 0;
      const pixel = (v * 4 + u) * 4;
      assert.equal(tissue.data[pixel + 3], alpha);
      assert.equal(regions.data[pixel + 3], alpha);
      assert.equal(tissue.data[pixel], tissue.data[pixel + 1]);
      assert.equal(tissue.data[pixel + 1], tissue.data[pixel + 2]);
    }
  }
  assert.deepEqual(position, [1, 2, 3]);
});
