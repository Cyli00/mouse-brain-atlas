import { getBinary } from "./atlas";
import { decodeMeshData, type MeshData } from "./mesh-data";

export type VesselGroup = "sinus" | "artery" | "vein";
export type VesselFilter = "all" | VesselGroup;
export type VesselMesh = MeshData & { id: number; name: string; group: VesselGroup };
export type Vasculature = { vessels: VesselMesh[] };
export type VesselEntry = {
  id: number; name: string; group: VesselGroup; url: string;
  vertexCount: number; triangleCount: number;
};
export const VASCULAR_SOURCE = "https://www.mouseimaging.ca/technologies/mouse_atlas/cerebral_vasc_atlas.html";
export const VASCULAR_PAPER = "https://doi.org/10.1016/j.neuroimage.2006.12.040";
export const VESSEL_GROUP_LABELS: Record<VesselGroup, string> = {
  sinus: "静脉窦", artery: "主要动脉", vein: "主要静脉",
};

export function filterVessels(data: Vasculature, filter: VesselFilter): VesselMesh[] {
  return filter === "all" ? data.vessels : data.vessels.filter((vessel) => vessel.group === filter);
}

export function readVesselManifest(manifest: unknown): VesselEntry[] {
  const m = manifest as Record<string, unknown> | null;
  if (!m || m.version !== 1 || m.stage !== "adult" || m.coordinateSpace !== "Allen CCFv3 2017" ||
      m.units !== "um" || !Array.isArray(m.axisOrder) || m.axisOrder.join(",") !== "AP,DV,ML")
    throw new Error("血管坐标系与成年图谱不匹配");
  if (!Array.isArray(m.vessels) || !m.vessels.length || m.vessels.length > 100)
    throw new Error("血管目录为空或格式异常");
  const ids = new Set<number>();
  for (const entry of m.vessels) {
    if (!entry || !Number.isInteger(entry.id) || entry.id <= 0 || ids.has(entry.id) ||
        typeof entry.name !== "string" || !entry.name.trim() ||
        typeof entry.group !== "string" || !Object.hasOwn(VESSEL_GROUP_LABELS, entry.group) ||
        typeof entry.url !== "string" || !/^\/vasculature\/mice\/meshes\/\d+\.bin\.gz$/.test(entry.url) ||
        !Number.isInteger(entry.vertexCount) || entry.vertexCount <= 0 ||
        !Number.isInteger(entry.triangleCount) || entry.triangleCount <= 0)
      throw new Error("血管目录条目无效");
    ids.add(entry.id);
  }
  return m.vessels;
}

export function decodeVesselMesh(buffer: ArrayBuffer, entry: VesselEntry): VesselMesh {
  const mesh = decodeMeshData(buffer);
  if (mesh.positions.length !== entry.vertexCount * 3 || mesh.indices.length !== entry.triangleCount * 3)
    throw new Error("血管网格与目录不匹配");
  const maximum = [14200, 9000, 12400];
  for (let i = 0; i < mesh.positions.length; i++) {
    if (mesh.positions[i] < -1000 || mesh.positions[i] > maximum[i % 3])
      throw new Error("血管坐标超出成年图谱范围");
  }
  return { id: entry.id, name: entry.name, group: entry.group, ...mesh };
}

export async function loadVasculature(signal: AbortSignal): Promise<Vasculature> {
  const response = await fetch("/vasculature/mice/manifest.json", { signal });
  if (!response.ok) throw new Error("无法读取血管数据说明");
  const entries = readVesselManifest(await response.json());
  const abort = new AbortController();
  const requestSignal = AbortSignal.any([signal, abort.signal]);
  const vessels: VesselMesh[] = new Array(entries.length);
  let next = 0;
  const worker = async () => {
    while (next < entries.length) {
      requestSignal.throwIfAborted();
      const index = next++;
      const entry = entries[index];
      vessels[index] = decodeVesselMesh(await getBinary(entry.url, requestSignal), entry);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker));
    return { vessels };
  } catch (error) {
    abort.abort();
    throw error;
  }
}
