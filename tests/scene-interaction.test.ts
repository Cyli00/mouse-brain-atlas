import assert from "node:assert/strict";
import test from "node:test";
import { ScenePointerGesture } from "../src/lib/scene-interaction";

const pointer = (x: number, y: number, pointerId = 1, button = 0) =>
  ({ clientX: x, clientY: y, pointerId, button });

test("a stationary primary click selects, a pan or secondary click does not", () => {
  const gesture = new ScenePointerGesture();
  gesture.down(pointer(10, 10));
  assert.equal(gesture.up(pointer(12, 11)), true);
  gesture.down(pointer(10, 10, 1, 2));
  assert.equal(gesture.up(pointer(10, 10, 1, 2)), false);
  gesture.down(pointer(10, 10));
  assert.equal(gesture.up(pointer(20, 10)), false);
});

test("a drag returning to its starting point never becomes a click", () => {
  const gesture = new ScenePointerGesture();
  gesture.down(pointer(10, 10));
  gesture.move(pointer(100, 100));
  gesture.move(pointer(10, 10));
  assert.equal(gesture.up(pointer(10, 10)), false);
});

test("pinch release, cancellation, and unmatched release do not select a region", () => {
  const gesture = new ScenePointerGesture();
  gesture.down(pointer(10, 10));
  gesture.down(pointer(20, 20, 2));
  assert.equal(gesture.up(pointer(20, 20, 2)), false);
  assert.equal(gesture.up(pointer(10, 10)), false);
  gesture.down(pointer(10, 10));
  gesture.cancel();
  assert.equal(gesture.up(pointer(10, 10)), false);
  gesture.down(pointer(10, 10));
  assert.equal(gesture.up(pointer(10, 10)), true);
});
