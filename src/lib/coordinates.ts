export const ALLEN_BREGMA_AP_UM = 5400;
export const ALLEN_MIDLINE_ML_UM = 5700;
export const BREGMA_REFERENCE_URL =
  "https://github.com/int-brain-lab/iblatlas/blob/main/iblatlas/atlas.py";

export function coordinateMm(
  voxel: number,
  axis: number,
  spacing: number,
  apBregmaUm?: number,
  mlMidlineUm?: number,
) {
  const um = voxel * spacing;
  if (axis === 2 && mlMidlineUm !== undefined) return (um - mlMidlineUm) / 1000;
  return (axis === 0 && apBregmaUm !== undefined ? apBregmaUm - um : um) / 1000;
}

export function coordinateVoxel(
  mm: number,
  axis: number,
  spacing: number,
  apBregmaUm?: number,
  mlMidlineUm?: number,
) {
  if (axis === 2 && mlMidlineUm !== undefined)
    return (mm * 1000 + mlMidlineUm) / spacing;
  return (
    (axis === 0 && apBregmaUm !== undefined
      ? apBregmaUm - mm * 1000
      : mm * 1000) / spacing
  );
}

export function coordinateRange(
  size: number,
  axis: number,
  spacing: number,
  apBregmaUm?: number,
  mlMidlineUm?: number,
) {
  const ends = [
    coordinateMm(0, axis, spacing, apBregmaUm, mlMidlineUm),
    coordinateMm(size - 1, axis, spacing, apBregmaUm, mlMidlineUm),
  ];
  return { min: Math.min(...ends), max: Math.max(...ends) };
}

export function coordinateReference(
  axis: number,
  apBregmaUm?: number,
  mlMidlineUm?: number,
) {
  if (axis === 2 && mlMidlineUm !== undefined)
    return "脑正中线为零，左负、右正";
  if (axis === 0 && apBregmaUm !== undefined)
    return "Bregma 近似参考，前正、后负";
  return apBregmaUm === undefined ? "图谱体积原点" : "CCF 体积原点";
}
