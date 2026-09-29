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

test("keyboard rotation crosses both poles and completes a full revolution", async () => {
  const { PerspectiveCamera, Vector3 } = await import("three");
  const { rotateSceneCamera } = await import("../src/lib/scene-interaction");
  const camera = new PerspectiveCamera();
  const target = new Vector3(3, -2, 1);
  camera.position.copy(target).add(new Vector3(0, 0, 10));
  const start = camera.position.clone();
  for (let i = 0; i < 48; i++) {
    const previous = camera.position.clone();
    rotateSceneCamera(camera, target, 0, Math.PI / 24);
    assert.ok(camera.position.distanceTo(previous) > 1);
    assert.ok(Math.abs(camera.position.distanceTo(target) - 10) < 1e-8);
    assert.ok(Math.abs(camera.up.dot(camera.position.clone().sub(target))) < 1e-8);
  }
  assert.ok(camera.position.distanceTo(start) < 1e-8);
});

test("all six anatomical views preserve center, distance and zoom, with the correct side and up axis", async () => {
  const { PerspectiveCamera, Vector3 } = await import("three");
  const { alignSceneCamera } = await import("../src/lib/scene-interaction");
  const { toWorld } = await import("../src/lib/atlas");
  const target = new Vector3(4, -3, 2);
  const originalTarget = target.clone();
  const camera = new PerspectiveCamera(35, 1.4);
  camera.position.set(-12, 7, 15);
  camera.zoom = 1.7;
  const distance = camera.position.distanceTo(target);
  // Independent voxel landmarks: AP increases caudally, DV ventrally, ML to the right.
  const dimensions: [number, number, number] = [21, 21, 21];
  for (const [direction, landmark, topLandmark] of [
    ["anterior", [0, 10, 10], [10, 0, 10]],
    ["posterior", [20, 10, 10], [10, 0, 10]],
    ["left", [10, 10, 0], [10, 0, 10]],
    ["right", [10, 10, 20], [10, 0, 10]],
    ["ventral", [10, 20, 10], [0, 10, 10]],
    ["dorsal", [10, 0, 10], [0, 10, 10]],
  ] as const) {
    alignSceneCamera(camera, target, direction);
    const side = new Vector3(...toWorld([...landmark], dimensions, 100)).normalize();
    const up = new Vector3(...toWorld([...topLandmark], dimensions, 100)).normalize();
    assert.ok(camera.position.clone().sub(target).normalize().distanceTo(side) < 1e-10, direction);
    assert.ok(camera.getWorldDirection(new Vector3()).distanceTo(side.negate()) < 1e-10, direction);
    assert.ok(camera.up.distanceTo(up) < 1e-10, direction);
    assert.ok(Math.abs(camera.position.distanceTo(target) - distance) < 1e-10);
    assert.deepEqual(target, originalTarget);
    assert.equal(camera.zoom, 1.7);
    assert.equal(camera.fov, 35);
  }
});
