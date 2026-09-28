import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLEN_BREGMA_AP_UM,
  ALLEN_MIDLINE_ML_UM,
  coordinateMm,
  coordinateVoxel,
  coordinateRange,
} from "../src/lib/coordinates";

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

test("AP conversion never silently changes DV, ML, or embryonic reference coordinates", () => {
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
    "embryos must retain their own local origin",
  );
  assert.equal(
    coordinateMm(40, 1, 50, ALLEN_BREGMA_AP_UM, ALLEN_MIDLINE_ML_UM),
    2,
  );
});
