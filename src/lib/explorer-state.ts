import type { PlaneDisplay } from "./scene-plane";

export function nearestCatalogRegion(
  path: readonly number[] | undefined,
  catalog: ReadonlySet<number>,
): number | null {
  if (!path) return null;
  for (let i = path.length - 1; i >= 0; i--)
    if (catalog.has(path[i])) return path[i];
  return null;
}
export type DisplaySettings = { opacity: number; planeDisplay: PlaneDisplay };
export function displayDefaults(circuit: boolean): DisplaySettings {
  return circuit
    ? { opacity: 0.12, planeDisplay: "off" }
    : { opacity: 0.1, planeDisplay: "off" };
}
