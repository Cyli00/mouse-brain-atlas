import assert from "node:assert/strict";
import test from "node:test";
import { PLANES, type Position, type PlaneName } from "../src/lib/atlas";
import { centerSlicePosition, slicePointFromClient, slicePointFromKey, sliceScale } from "../src/lib/slice-interaction";

const dimensions: Position = [94, 125, 37];
const seed: Position = [40, 70, 20];

test("captured slice drags clamp to image edges and preserve the orthogonal depth", () => {
  for (const name of Object.keys(PLANES) as PlaneName[]) {
    const plane = PLANES[name];
    const rect = { left: 100, top: 200, width: 470, height: 625 };
    const start = slicePointFromClient({ clientX: 100, clientY: 200 }, rect, name, seed, dimensions);
    assert.equal(start[plane.u], 0);
    assert.equal(start[plane.v], 0);
    assert.equal(start[plane.axis], seed[plane.axis]);
    const outside = slicePointFromClient({ clientX: 2000, clientY: -100 }, rect, name, seed, dimensions);
    assert.equal(outside[plane.u], dimensions[plane.u] - 1);
    assert.equal(outside[plane.v], 0);
    assert.equal(outside[plane.axis], seed[plane.axis]);
    const last = slicePointFromClient({ clientX: 570, clientY: 825 }, rect, name, seed, dimensions);
    assert.equal(last[plane.u], dimensions[plane.u] - 1);
    assert.equal(last[plane.v], dimensions[plane.v] - 1);
  }
  assert.deepEqual(seed, [40, 70, 20], "pointer calculation must not mutate shared position state");
});

test("resized slice images map a displayed voxel center to the same voxel", () => {
  for (const name of Object.keys(PLANES) as PlaneName[]) {
    const plane = PLANES[name];
    for (const scale of [0.5, 1, 4]) {
      const rect = { left: 13, top: 47, width: dimensions[plane.u] * scale, height: dimensions[plane.v] * scale };
      const point = {
        clientX: rect.left + (seed[plane.u] + 0.5) * scale,
        clientY: rect.top + (seed[plane.v] + 0.5) * scale,
      };
      assert.deepEqual(slicePointFromClient(point, rect, name, seed, dimensions), seed);
    }
  }
  assert.deepEqual(slicePointFromClient({ clientX: 1, clientY: 1 }, { left: 0, top: 0, width: 0, height: 0 }, "coronal", seed, dimensions), seed);
});

test("arrow and page keys move distinct anatomical axes, with five-voxel Shift and bounded ends", () => {
  for (const name of Object.keys(PLANES) as PlaneName[]) {
    const plane = PLANES[name];
    for (const [key, axis, sign] of [
      ["ArrowLeft", plane.u, -1], ["ArrowRight", plane.u, 1],
      ["ArrowUp", plane.v, -1], ["ArrowDown", plane.v, 1],
      ["PageUp", plane.axis, -1], ["PageDown", plane.axis, 1],
    ] as [string, number, number][]) {
      const one: Position = [...seed];
      one[axis] += sign;
      const five: Position = [...seed];
      five[axis] += sign * 5;
      assert.deepEqual(slicePointFromKey(key, false, name, seed, dimensions), one);
      assert.deepEqual(slicePointFromKey(key, true, name, seed, dimensions), five);
    }
    assert.deepEqual(slicePointFromKey("PageUp", true, name, [0, 0, 0], dimensions), [0, 0, 0]);
    const end = dimensions.map((n) => n - 1) as Position;
    assert.deepEqual(slicePointFromKey("PageDown", true, name, end, dimensions), end);
    assert.equal(slicePointFromKey("Escape", false, name, seed, dimensions), null);
  }
});

test("millimeter scale stays physically exact and fits a narrow embryonic hemisphere", () => {
  for (const [width, spacing, expected] of [[228, 50, 1], [37, 40, 0.2], [60, 40, 0.5]] as const) {
    const scale = sliceScale(width, spacing);
    assert.equal(scale.lengthMm, expected);
    assert.ok(scale.widthPercent <= 100 / 3);
    assert.ok(Math.abs((scale.widthPercent / 100) * width * spacing / 1000 - scale.lengthMm) < 1e-12);
  }
});

test("keyboard activation centers only the visible plane and preserves its current slice", () => {
  for (const name of Object.keys(PLANES) as PlaneName[]) {
    const plane = PLANES[name];
    const centered = centerSlicePosition(name, seed, dimensions);
    assert.equal(centered[plane.axis], seed[plane.axis]);
    assert.equal(centered[plane.u], Math.round((dimensions[plane.u] - 1) / 2));
    assert.equal(centered[plane.v], Math.round((dimensions[plane.v] - 1) / 2));
  }
});
