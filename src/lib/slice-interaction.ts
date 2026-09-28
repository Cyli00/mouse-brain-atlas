import { clampPosition, PLANES, planePosition, type PlaneName, type Position } from "./atlas";

export const ANATOMICAL_AXES = [
  { abbreviation: "AP", name: "前后轴", increasing: "向后" },
  { abbreviation: "DV", name: "背腹轴", increasing: "向腹侧" },
  { abbreviation: "ML", name: "左右轴", increasing: "向右" },
] as const;

export function slicePointFromClient(
  point: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
  name: PlaneName,
  position: Position,
  dimensions: Position,
): Position {
  if (rect.width <= 0 || rect.height <= 0) return clampPosition(position, dimensions);
  const plane = PLANES[name];
  return clampPosition(
    planePosition(
      name,
      position,
      Math.floor(((point.clientX - rect.left) / rect.width) * dimensions[plane.u]),
      Math.floor(((point.clientY - rect.top) / rect.height) * dimensions[plane.v]),
    ),
    dimensions,
  );
}

export function slicePointFromKey(
  key: string,
  shift: boolean,
  name: PlaneName,
  position: Position,
  dimensions: Position,
): Position | null {
  const plane = PLANES[name];
  const next: Position = [...position];
  const step = shift ? 5 : 1;
  if (key === "ArrowLeft") next[plane.u] -= step;
  else if (key === "ArrowRight") next[plane.u] += step;
  else if (key === "ArrowUp") next[plane.v] -= step;
  else if (key === "ArrowDown") next[plane.v] += step;
  else if (key === "PageUp") next[plane.axis] -= step;
  else if (key === "PageDown") next[plane.axis] += step;
  else return null;
  return clampPosition(next, dimensions);
}

export function centerSlicePosition(name: PlaneName, position: Position, dimensions: Position): Position {
  const plane = PLANES[name];
  return clampPosition(planePosition(name, position, (dimensions[plane.u] - 1) / 2, (dimensions[plane.v] - 1) / 2), dimensions);
}

export function sliceScale(widthVoxels: number, spacingUm: number) {
  const widthMm = (widthVoxels * spacingUm) / 1000;
  const lengthMm = [1, 0.5, 0.2, 0.1].find((length) => length <= widthMm / 3) ?? widthMm / 4;
  return { lengthMm, widthPercent: (lengthMm / widthMm) * 100 };
}
