export const ALLEN_BREGMA_AP_UM = 5400;
export const ALLEN_MIDLINE_ML_UM = 5700;
export const BREGMA_REFERENCE_URL =
  "https://github.com/int-brain-lab/iblatlas/blob/main/iblatlas/atlas.py";

export function coordinateMm(
  voxel: number,
  axis: number,
  spacing: number,
  apZeroUm?: number,
  mlZeroUm?: number,
  dvZeroUm = 0,
) {
  const um = voxel * spacing;
  if (axis === 2 && mlZeroUm !== undefined) return (um - mlZeroUm) / 1000;
  if (axis === 1) return (um - dvZeroUm) / 1000;
  return (axis === 0 && apZeroUm !== undefined ? apZeroUm - um : um) / 1000;
}

export function coordinateVoxel(
  mm: number,
  axis: number,
  spacing: number,
  apZeroUm?: number,
  mlZeroUm?: number,
  dvZeroUm = 0,
) {
  if (axis === 2 && mlZeroUm !== undefined)
    return (mm * 1000 + mlZeroUm) / spacing;
  if (axis === 1) return (mm * 1000 + dvZeroUm) / spacing;
  return (
    (axis === 0 && apZeroUm !== undefined
      ? apZeroUm - mm * 1000
      : mm * 1000) / spacing
  );
}

export function coordinateRange(
  size: number,
  axis: number,
  spacing: number,
  apZeroUm?: number,
  mlZeroUm?: number,
  dvZeroUm = 0,
) {
  const ends = [
    coordinateMm(0, axis, spacing, apZeroUm, mlZeroUm, dvZeroUm),
    coordinateMm(size - 1, axis, spacing, apZeroUm, mlZeroUm, dvZeroUm),
  ];
  return { min: Math.min(...ends), max: Math.max(...ends) };
}

export function snapCoordinateMm(
  mm: number,
  min: number,
  max: number,
  step: number,
  midpointPreference: "lower" | "upper" = "upper",
) {
  const bounded = Math.max(min, Math.min(max, mm));
  const index = (bounded - min) / step;
  const lower = Math.floor(index);
  // Surface origins lie halfway between slices. Resolve ties explicitly so
  // floating-point error cannot send a boundary input to the empty side.
  const atMidpoint = Math.abs(index - lower - 0.5) < 1e-9;
  const nearest = atMidpoint
    ? lower + (midpointPreference === "upper" ? 1 : 0)
    : Math.round(index);
  return Math.max(min, Math.min(max, min + nearest * step));
}

export function coordinateReference(
  axis: number,
  apZeroUm?: number,
  mlZeroUm?: number,
  embryonic = false,
) {
  if (embryonic) {
    if (axis === 0) return "标注前边界相对坐标，前正、后负";
    if (axis === 1)
      return "标注背侧边界相对坐标，向腹侧增加；不是当前位置的脑表面深度";
    return "标注内侧边界相对坐标，向右增加；正中线未校准";
  }
  if (axis === 2 && mlZeroUm !== undefined)
    return "脑正中线为零，左负、右正";
  if (axis === 0 && apZeroUm !== undefined)
    return "Bregma 近似参考，前正、后负";
  return apZeroUm === undefined ? "图谱体积原点" : "CCF 体积原点";
}
