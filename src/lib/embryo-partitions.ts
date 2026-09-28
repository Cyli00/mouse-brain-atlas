import type { AtlasData } from "./atlas";

export type EmbryoPartitionLevel = "fine" | "major";

export function embryoPartitions(data: AtlasData, majorIds: ReadonlySet<number>) {
  const presentIds = new Set(data.annotation);
  presentIds.delete(0);
  const remap = new Map<number, number>();
  for (const id of presentIds) {
    const path = data.structures.get(id)?.structure_id_path ?? [];
    // Retain labels outside the curated tissue compartments, including ventricles.
    remap.set(id, [...path].reverse().find((ancestor) => majorIds.has(ancestor)) ?? id);
  }
  const annotation = new Uint32Array(data.annotation.length);
  for (let i = 0; i < annotation.length; i++) {
    const id = data.annotation[i];
    annotation[i] = id ? remap.get(id)! : 0;
  }
  return {
    fine: data,
    major: { ...data, annotation } satisfies AtlasData,
    fineCount: presentIds.size,
    majorCount: new Set(remap.values()).size,
  };
}
