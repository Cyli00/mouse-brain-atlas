import * as THREE from "three";
import { PLANES, PLANE_ORDER, toWorld, type AtlasData, type Position } from "./atlas";
import { coordinateMm } from "./coordinates";

type SliceState = {
  data: AtlasData;
  position: Position;
  onPosition: (position: Position) => void;
  apZeroUm?: number;
  mlZeroUm?: number;
  dvZeroUm?: number;
};

export function createSliceGizmo(
  container: HTMLElement,
  camera: THREE.PerspectiveCamera,
  state: () => SliceState,
  onStart: () => void,
) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.classList.add("slice-gizmo");
  svg.style.display = "none";
  svg.setAttribute("aria-label", "正交切面位置箭头");
  container.append(svg);
  let drag: { pointerId: number; axis: number; x: number; y: number; value: number;
    dx: number; dy: number; scale: number; element: SVGGElement } | null = null;
  const handles = PLANE_ORDER.map((name) => {
    const axis = PLANES[name].axis;
    const label = ["AP", "DV", "ML"][axis];
    const group = document.createElementNS(ns, "g");
    group.setAttribute("role", "slider");
    group.setAttribute("tabindex", "0");
    group.setAttribute("aria-label", `${label} 切面位置`);
    group.dataset.axis = label;
    group.style.color = PLANES[name].color;
    const line = document.createElementNS(ns, "path");
    line.setAttribute("class", "slice-gizmo-arrow");
    const hit = document.createElementNS(ns, "circle");
    hit.setAttribute("r", "21");
    const text = document.createElementNS(ns, "text");
    text.textContent = label;
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dy", ".35em");
    group.append(line, hit, text);
    svg.append(group);
    const projection = { dx: 0, dy: -1, scale: 1 };
    group.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      onStart();
      group.focus({ preventScroll: true });
      group.setPointerCapture(event.pointerId);
      drag = { pointerId: event.pointerId, axis, x: event.clientX, y: event.clientY,
        value: state().position[axis], ...projection, element: group };
      group.classList.add("dragging");
    });
    group.addEventListener("keydown", (event) => {
      const delta = ["ArrowRight", "ArrowUp"].includes(event.key) ? 1
        : ["ArrowLeft", "ArrowDown"].includes(event.key) ? -1 : 0;
      if (!delta) return;
      event.preventDefault(); event.stopPropagation();
      move(axis, state().position[axis] + delta);
    });
    return { axis, group, line, hit, text, projection };
  });
  function move(axis: number, value: number) {
    const current = state();
    const position: Position = [...current.position];
    position[axis] = Math.max(0, Math.min(current.data.dimensions[axis] - 1, Math.round(value)));
    if (position[axis] !== current.position[axis]) current.onPosition(position);
  }
  function finish() {
    if (!drag) return;
    const { element, pointerId } = drag;
    drag = null;
    element.classList.remove("dragging");
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  }
  svg.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    // Lock the projected axis at drag start so moving the slice cannot change sensitivity.
    const distance = (event.clientX - drag.x) * drag.dx + (event.clientY - drag.y) * drag.dy;
    move(drag.axis, drag.value + distance / drag.scale);
  });
  svg.addEventListener("pointerup", finish);
  svg.addEventListener("pointercancel", finish);
  svg.addEventListener("lostpointercapture", finish);
  function update() {
    if (svg.style.display === "none") return;
    const current = state();
    const { width, height } = container.getBoundingClientRect();
    camera.updateMatrixWorld();
    const project = (position: Position) => {
      const point = new THREE.Vector3(...toWorld(position, current.data.dimensions, current.data.spacing)).project(camera);
      return new THREE.Vector2((point.x + 1) * width / 2, (1 - point.y) * height / 2);
    };
    const origin = project(current.position);
    handles.forEach(({ axis, group, line, hit, text, projection }) => {
      const next: Position = [...current.position]; next[axis] += 1;
      const vector = project(next).sub(origin);
      const length = vector.length();
      // A camera-aligned axis has no screen projection; give it a stable diagonal handle.
      if (length < 0.15) vector.set(axis === 2 ? 1 : -1, axis === 1 ? 1 : -1).normalize();
      else vector.divideScalar(length);
      projection.dx = vector.x; projection.dy = vector.y;
      projection.scale = Math.max(length, 0.4);
      const tip = origin.clone().addScaledVector(vector, 86);
      const end = origin.clone().addScaledVector(vector, 60);
      const back = end.clone().addScaledVector(vector, -9);
      const side = new THREE.Vector2(-vector.y, vector.x).multiplyScalar(5);
      line.setAttribute("d", `M${origin.x},${origin.y} L${end.x},${end.y} M${back.x + side.x},${back.y + side.y} L${end.x},${end.y} L${back.x - side.x},${back.y - side.y}`);
      hit.setAttribute("cx", String(tip.x)); hit.setAttribute("cy", String(tip.y));
      text.setAttribute("x", String(tip.x)); text.setAttribute("y", String(tip.y));
      group.setAttribute("aria-valuemin", "0");
      group.setAttribute("aria-valuemax", String(current.data.dimensions[axis] - 1));
      group.setAttribute("aria-valuenow", String(current.position[axis]));
      group.setAttribute("aria-valuetext", `${coordinateMm(current.position[axis], axis, current.data.spacing, current.apZeroUm, current.mlZeroUm, current.dvZeroUm).toFixed(2)} mm`);
    });
  }
  return {
    update,
    setVisible(visible: boolean) {
      if (!visible) finish();
      svg.style.display = visible ? "block" : "none";
      update();
    },
    dispose() { finish(); svg.remove(); },
  };
}
