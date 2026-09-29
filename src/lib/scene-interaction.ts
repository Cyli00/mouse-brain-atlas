import { Vector3 } from "three";
import type { PlaneName } from "./atlas";

type Pointer = {
  pointerId: number;
  clientX: number;
  clientY: number;
  button: number;
};

export class ScenePointerGesture {
  private pointers = new Set<number>();
  private start: Pointer | null = null;
  private dragged = false;

  down(event: Pointer) {
    this.pointers.add(event.pointerId);
    if (this.pointers.size === 1) {
      this.start = event;
      this.dragged = false;
    } else this.dragged = true;
  }

  move(event: Pointer) {
    if (this.start?.pointerId === event.pointerId &&
      Math.hypot(event.clientX - this.start.clientX, event.clientY - this.start.clientY) >= 5)
      this.dragged = true;
  }

  up(event: Pointer) {
    this.move(event);
    const click = this.pointers.size === 1 && this.start?.pointerId === event.pointerId &&
      this.start.button === 0 && event.button === 0 && !this.dragged;
    this.pointers.delete(event.pointerId);
    if (!this.pointers.size) this.start = null;
    return click;
  }

  cancel() {
    this.pointers.clear();
    this.start = null;
    this.dragged = false;
  }
}

// Rotate both the eye and its up vector, preserving a valid basis across the poles.
export function rotateSceneCamera(
  camera: import("three").PerspectiveCamera,
  target: import("three").Vector3,
  horizontal: number,
  vertical: number,
) {
  const eye = camera.position.clone().sub(target);
  const right = camera.up.clone().cross(eye).normalize();
  eye.applyAxisAngle(camera.up, horizontal).applyAxisAngle(right, vertical);
  camera.up.applyAxisAngle(right, vertical).normalize();
  camera.position.copy(target).add(eye);
  camera.lookAt(target);
}

export const SCENE_DIRECTIONS = {
  anterior: { plane: "coronal", label: "头侧", offset: [0, 0, 1] },
  posterior: { plane: "coronal", label: "尾侧", offset: [0, 0, -1] },
  left: { plane: "sagittal", label: "左侧", offset: [-1, 0, 0] },
  right: { plane: "sagittal", label: "右侧", offset: [1, 0, 0] },
  ventral: { plane: "horizontal", label: "腹侧", offset: [0, -1, 0] },
  dorsal: { plane: "horizontal", label: "背侧", offset: [0, 1, 0] },
} satisfies Record<string, { plane: PlaneName; label: string; offset: [number, number, number] }>;
export type SceneDirection = keyof typeof SCENE_DIRECTIONS;

export function alignSceneCamera(
  camera: import("three").PerspectiveCamera,
  target: import("three").Vector3,
  direction: SceneDirection,
) {
  const distance = camera.position.distanceTo(target);
  const view = SCENE_DIRECTIONS[direction];
  // World +X is right, +Y is dorsal, +Z is anterior; offsets name the observer's side.
  const offset = new Vector3(...view.offset);
  camera.up.set(0, view.plane === "horizontal" ? 0 : 1, view.plane === "horizontal" ? 1 : 0);
  camera.position.copy(target).addScaledVector(offset, distance);
  camera.lookAt(target);
}
