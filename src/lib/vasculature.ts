import { getBinary } from "./atlas";

export type VesselDiameter = 36 | 48 | 60;
export type Vasculature = {
  positions: Float32Array;
  counts: Record<VesselDiameter, number>;
};
export const VASCULAR_SOURCE = "https://discotechnologies.org/VesSAP/";
export const VASCULAR_PAPER = "https://doi.org/10.1038/s41592-020-0792-1";

export function decodeVasculature(buffer: ArrayBuffer, counts: Record<VesselDiameter, number>): Vasculature {
  if (!Number.isInteger(counts[36]) || counts[36] <= 0 || buffer.byteLength !== counts[36] * 24 ||
      ![48, 60].every((d) => Number.isInteger(counts[d as VesselDiameter]) && counts[d as VesselDiameter] > 0) ||
      counts[60] > counts[48] || counts[48] > counts[36])
    throw new Error("血管文件长度或筛选范围异常");
  const positions = new Float32Array(buffer);
  if (!positions.every(Number.isFinite)) throw new Error("血管坐标无效");
  return { positions, counts };
}

export async function loadVasculature(signal: AbortSignal): Promise<Vasculature> {
  const response = await fetch("/vasculature/adult/manifest.json", { signal });
  if (!response.ok) throw new Error("无法读取血管数据说明");
  const manifest = await response.json();
  if (manifest.stage !== "adult" || manifest.coordinateSpace !== "Allen CCFv3 2017" ||
      manifest.units !== "um" || manifest.axisOrder?.join(",") !== "AP,DV,ML")
    throw new Error("血管坐标系与成年图谱不匹配");
  const buffer = await getBinary("/vasculature/adult/segments.float32.gz", signal);
  return decodeVasculature(buffer, manifest.countsByMinimumDiameterUm);
}
