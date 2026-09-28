import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLEN_BREGMA_AP_UM,
  ALLEN_MIDLINE_ML_UM,
  coordinateMm,
  coordinateVoxel,
  coordinateRange,
  coordinateReference,
  snapCoordinateMm,
} from "../src/lib/coordinates";

test("coordinate input resolves midpoint ties consistently without moving nearby values", () => {
  for (const min of [-7.9, -2.3, -1.9, -1.38, -0.1, -0.06]) {
    for (const delta of [-1e-14, 0, 1e-14]) {
      assert.ok(
        Math.abs(snapCoordinateMm(delta, min, 1, 0.04, "lower") + 0.02) < 1e-12,
      );
      assert.ok(
        Math.abs(snapCoordinateMm(delta, min, 1, 0.04, "upper") - 0.02) < 1e-12,
      );
    }
    for (const preference of ["lower", "upper"] as const) {
      assert.ok(
        Math.abs(snapCoordinateMm(-0.001, min, 1, 0.04, preference) + 0.02) < 1e-12,
      );
      assert.ok(
        Math.abs(snapCoordinateMm(0.001, min, 1, 0.04, preference) - 0.02) < 1e-12,
      );
    }
  }
  assert.equal(snapCoordinateMm(-100, -1, 1, 0.05), -1);
  assert.equal(snapCoordinateMm(100, -1, 1, 0.05), 1);
  for (const [min, max] of [
    [-7.75, 5.4],
    [0, 7.95],
    [-5.7, 5.65],
  ])
    assert.ok(Math.abs(snapCoordinateMm(0, min, max, 0.05)) < 1e-12);
});

test("embryo references describe annotation boundaries without claiming calibrated landmarks", () => {
  assert.match(coordinateReference(0, 60, 1380, true), /标注前边界相对坐标/);
  assert.match(coordinateReference(1, 60, 1380, true), /不是当前位置的脑表面深度/);
  assert.match(coordinateReference(2, 60, 1380, true), /正中线未校准/);
  assert.match(
    coordinateReference(2, ALLEN_BREGMA_AP_UM, ALLEN_MIDLINE_ML_UM),
    /脑正中线为零/,
  );
});

test("adult AP zero is the IBL Bregma landmark, anterior positive and posterior negative", () => {
  assert.equal(coordinateMm(108, 0, 50, ALLEN_BREGMA_AP_UM), 0);
  assert.equal(coordinateMm(88, 0, 50, ALLEN_BREGMA_AP_UM), 1);
  assert.equal(coordinateMm(128, 0, 50, ALLEN_BREGMA_AP_UM), -1);
  assert.deepEqual(coordinateRange(264, 0, 50, ALLEN_BREGMA_AP_UM), {
    min: -7.75,
    max: 5.4,
  });
  assert.equal(coordinateVoxel(-2.55, 0, 50, ALLEN_BREGMA_AP_UM), 159);
});

test("all AP samples round-trip without moving the underlying slice", () => {
  for (const spacing of [10, 25, 50, 100])
    for (let i = 0; i < 13200 / spacing; i++) {
      const mm = coordinateMm(i, 0, spacing, ALLEN_BREGMA_AP_UM);
      assert.equal(
        Math.round(coordinateVoxel(mm, 0, spacing, ALLEN_BREGMA_AP_UM)),
        i,
      );
    }
});

test("adult AP conversion leaves unconfigured DV and ML coordinates unchanged", () => {
  for (const axis of [1, 2]) {
    assert.equal(coordinateMm(40, axis, 50, ALLEN_BREGMA_AP_UM), 2);
    assert.equal(coordinateVoxel(2, axis, 50, ALLEN_BREGMA_AP_UM), 40);
  }
  assert.equal(coordinateMm(40, 0, 40), 1.6);
  assert.deepEqual(coordinateRange(94, 0, 40), { min: 0, max: 3.72 });
});

test("adult ML has its zero at the template midline, left negative and right positive", () => {
  const toMm = (i: number) =>
    coordinateMm(i, 2, 50, ALLEN_BREGMA_AP_UM, ALLEN_MIDLINE_ML_UM);
  assert.equal(toMm(114), 0);
  assert.equal(toMm(94), -1);
  assert.equal(toMm(134), 1);
  assert.equal(toMm(53), -3.05);
  assert.deepEqual(
    coordinateRange(228, 2, 50, ALLEN_BREGMA_AP_UM, ALLEN_MIDLINE_ML_UM),
    { min: -5.7, max: 5.65 },
  );
  for (let i = 0; i < 228; i++)
    assert.equal(
      Math.round(
        coordinateVoxel(
          toMm(i),
          2,
          50,
          ALLEN_BREGMA_AP_UM,
          ALLEN_MIDLINE_ML_UM,
        ),
      ),
      i,
    );
  assert.equal(
    coordinateMm(114, 2, 40),
    4.56,
    "default ML coordinates retain the volume origin",
  );
  assert.equal(
    coordinateMm(40, 1, 50, ALLEN_BREGMA_AP_UM, ALLEN_MIDLINE_ML_UM),
    2,
  );
});
