export type Position = [number, number, number];
export type PlaneName = "coronal" | "sagittal" | "horizontal";
export const PLANES = {
  coronal: {
    name: "冠状面",
    english: "Coronal",
    axis: 0,
    u: 2,
    v: 1,
    color: "#a65372",
    direction: ["L", "R", "D", "V"],
  },
  sagittal: {
    name: "矢状面",
    english: "Sagittal",
    axis: 2,
    u: 0,
    v: 1,
    color: "#477ead",
    direction: ["A", "P", "D", "V"],
  },
  horizontal: {
    name: "水平面",
    english: "Horizontal",
    axis: 1,
    u: 2,
    v: 0,
    color: "#8a772a",
    direction: ["L", "R", "A", "P"],
  },
} as const;
export const PLANE_ORDER: PlaneName[] = ["coronal", "sagittal", "horizontal"];
export type Structure = {
  id: number;
  acronym: string;
  name: string;
  color_hex_triplet: string;
  structure_id_path: number[];
};
export type MeshInfo = { url: string; centroid?: Position };
export type AtlasData = {
  dimensions: Position;
  rootId?: number;
  spacing: number;
  template: Uint16Array;
  annotation: Uint32Array;
  structures: Map<number, Structure>;
  meshes: Record<string, MeshInfo>;
  manifest: Record<string, unknown>;
  coordinateOriginsUm?: Position;
};
export function voxelIndex(p: Position, d: Position) {
  return p[0] + d[0] * (p[1] + d[1] * p[2]);
}
export function clampPosition(p: Position, d: Position): Position {
  return p.map((n, i) =>
    Math.max(0, Math.min(d[i] - 1, Math.round(Number.isFinite(n) ? n : 0))),
  ) as Position;
}
export function planePosition(
  name: PlaneName,
  p: Position,
  u: number,
  v: number,
): Position {
  const next: Position = [...p];
  next[PLANES[name].u] = u;
  next[PLANES[name].v] = v;
  return next;
}
export function toWorld(p: Position, d: Position, spacing: number): Position {
  const s = spacing / 1000;
  return [
    (p[2] - (d[2] - 1) / 2) * s,
    ((d[1] - 1) / 2 - p[1]) * s,
    ((d[0] - 1) / 2 - p[0]) * s,
  ];
}
export function fromWorld(p: Position, d: Position, spacing: number): Position {
  const s = spacing / 1000;
  return clampPosition(
    [
      (d[0] - 1) / 2 - p[2] / s,
      (d[1] - 1) / 2 - p[1] / s,
      p[0] / s + (d[2] - 1) / 2,
    ],
    d,
  );
}
export function isWithin(
  structure: Structure | undefined,
  id: number,
): boolean {
  return (
    !!structure &&
    (structure.id === id || structure.structure_id_path.includes(id))
  );
}
export function structureAt(data: AtlasData, p: Position) {
  return data.structures.get(data.annotation[voxelIndex(p, data.dimensions)]);
}
export async function getBinary(
  url: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`数据读取失败 (${response.status})`);
  const buffer = await response.arrayBuffer();
  const header = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  // Hosts may serve .gz with Content-Encoding, in which case fetch already decompresses it.
  if (header[0] !== 0x1f || header[1] !== 0x8b) return buffer;
  return new Response(
    new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip")),
  ).arrayBuffer();
}
export function nearestRegionPosition(
  data: AtlasData,
  id: number,
): Position | null {
  const { dimensions: d } = data;
  const labels = new Set(
    [...data.structures.values()]
      .filter((s) => isWithin(s, id))
      .map((s) => s.id),
  );
  let sum: Position = [0, 0, 0],
    count = 0;
  // One hemisphere avoids placing a bilateral region's centroid outside the actual region.
  for (let ml = 0; ml < d[2] / 2; ml++)
    for (let dv = 0; dv < d[1]; dv++)
      for (let ap = 0; ap < d[0]; ap++)
        if (labels.has(data.annotation[voxelIndex([ap, dv, ml], d)])) {
          sum[0] += ap;
          sum[1] += dv;
          sum[2] += ml;
          count++;
        }
  if (!count) return null;
  sum = sum.map((x) => x / count) as Position;
  let best: Position = [0, 0, 0],
    distance = Infinity;
  for (let ml = 0; ml < d[2] / 2; ml++)
    for (let dv = 0; dv < d[1]; dv++)
      for (let ap = 0; ap < d[0]; ap++)
        if (labels.has(data.annotation[voxelIndex([ap, dv, ml], d)])) {
          const dist =
            (ap - sum[0]) ** 2 + (dv - sum[1]) ** 2 + (ml - sum[2]) ** 2;
          if (dist < distance) {
            distance = dist;
            best = [ap, dv, ml];
          }
        }
  return best;
}
export function makeSlice(
  data: AtlasData,
  name: PlaneName,
  position: Position,
  selected: number,
  overlay: boolean,
  contrast: number,
): ImageData {
  const plane = PLANES[name],
    width = data.dimensions[plane.u],
    height = data.dimensions[plane.v];
  const pixels = new Uint8ClampedArray(width * height * 4);
  const colors = new Map<number, [number, number, number, boolean]>();
  for (const s of data.structures.values()) {
    const c = s.color_hex_triplet || "879fa1";
    colors.set(s.id, [
      parseInt(c.slice(0, 2), 16),
      parseInt(c.slice(2, 4), 16),
      parseInt(c.slice(4, 6), 16),
      isWithin(s, selected),
    ]);
  }
  for (let v = 0; v < height; v++)
    for (let u = 0; u < width; u++) {
      const i = voxelIndex(
          planePosition(name, position, u, v),
          data.dimensions,
        ),
        out = (v * width + u) * 4,
        label = data.annotation[i],
        val = data.template[i];
      if (!label && !val) {
        pixels[out] = 19;
        pixels[out + 1] = 29;
        pixels[out + 2] = 36;
        pixels[out + 3] = 255;
        continue;
      }
      const gray = Math.min(245, Math.pow(val / contrast, 0.7) * 235),
        c = colors.get(label),
        mix = overlay && c ? (c[3] ? 0.72 : 0.26) : 0;
      pixels[out] = gray * (1 - mix) + (c?.[0] ?? 0) * mix;
      pixels[out + 1] = gray * (1 - mix) + (c?.[1] ?? 0) * mix;
      pixels[out + 2] = gray * (1 - mix) + (c?.[2] ?? 0) * mix;
      pixels[out + 3] = 255;
    }
  return new ImageData(pixels, width, height);
}
export type AtlasManifest = {
  stage?: string;
  dimensions: Position;
  resolutionUm: number;
  template: { url: string };
  annotation: { url: string };
  ontology: { url: string };
  rootMesh: MeshInfo & {
    boundsUm?: [[number, number], [number, number], [number, number]];
  };
  rootId?: number;
  regions: { id: number; mesh: MeshInfo; focusVoxel: Position }[];
};
export async function loadAtlas(
  signal: AbortSignal,
  onProgress: (text: string) => void,
  manifestUrl = "/data/manifest.json",
): Promise<AtlasData> {
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(60000)]);
  const response = await fetch(manifestUrl, { signal: bounded });
  if (!response.ok) throw new Error("未能读取数据目录");
  const manifest: AtlasManifest = await response.json();
  const d = manifest.dimensions;
  if (
    !Array.isArray(d) ||
    d.length !== 3 ||
    d.some((v) => !Number.isInteger(v) || v < 1) ||
    !Number.isFinite(manifest.resolutionUm) ||
    manifest.resolutionUm <= 0
  )
    throw new Error("图谱坐标定义无效");
  const bounds = manifest.rootMesh.boundsUm;
  if (manifest.stage && (
    !Array.isArray(bounds) ||
    bounds.length !== 3 ||
    bounds.some(
      (range) =>
        !Array.isArray(range) ||
        range.length !== 2 ||
        !range.every(Number.isFinite) ||
        range[0] > range[1],
    )
  ))
    throw new Error("胚胎图谱坐标边界无效");
  const coordinateOriginsUm: Position | undefined =
    manifest.stage && bounds
      ? [bounds[0][0], bounds[1][0], bounds[2][1]]
      : undefined;
  onProgress(`正在载入 ${manifest.resolutionUm} μm 参考体积与脑区标注…`);
  const [templateBuffer, annotationBuffer, ontology] = await Promise.all([
    getBinary(manifest.template.url, bounded),
    getBinary(manifest.annotation.url, bounded),
    fetch(manifest.ontology.url, { signal: bounded }).then((r) => {
      if (!r.ok) throw new Error("脑区目录读取失败");
      return r.json();
    }),
  ]);
  const count = d[0] * d[1] * d[2];
  if (
    templateBuffer.byteLength !== count * 2 ||
    annotationBuffer.byteLength !== count * 4
  )
    throw new Error("体数据长度与坐标定义不匹配，请重新载入");
  const structures = new Map<number, Structure>(
    ontology.map(
      (s: {
        id: number;
        acronym: string;
        name: string;
        color: string;
        structureIdPath: number[];
      }) => [
        s.id,
        {
          id: s.id,
          acronym: s.acronym,
          name: s.name,
          color_hex_triplet: s.color.replace("#", ""),
          structure_id_path: s.structureIdPath,
        },
      ],
    ),
  );
  const meshes: Record<string, MeshInfo> = {
    [String(manifest.rootId ?? 997)]: manifest.rootMesh,
  };
  manifest.regions.forEach((r) => {
    meshes[String(r.id)] = { ...r.mesh, centroid: r.focusVoxel };
  });
  return {
    dimensions: d,
    rootId: manifest.rootId ?? 997,
    spacing: manifest.resolutionUm,
    template: new Uint16Array(templateBuffer),
    annotation: new Uint32Array(annotationBuffer),
    structures,
    meshes,
    manifest: manifest as unknown as Record<string, unknown>,
    coordinateOriginsUm,
  };
}
