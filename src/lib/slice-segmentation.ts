import {
  PLANES,
  planePosition,
  voxelIndex,
  type AtlasData,
  type PlaneName,
  type Position,
} from "./atlas";

export type SliceComponent = {
  id: number;
  key: number;
  u: number;
  v: number;
  area: number;
};
export type SliceRegion = SliceComponent & {
  acronym: string;
  name: string;
  color: string;
};
export type SliceSegmentation = {
  width: number;
  height: number;
  labels: Uint32Array;
  boundaryPath: string;
  components: SliceComponent[];
  regions: SliceRegion[];
};

export function segmentSlice(
  data: AtlasData,
  name: PlaneName,
  depth: number,
): SliceSegmentation {
  const plane = PLANES[name],
    width = data.dimensions[plane.u],
    height = data.dimensions[plane.v];
  const position: Position = [0, 0, 0];
  position[plane.axis] = depth;
  const labels = new Uint32Array(width * height);
  for (let v = 0; v < height; v++)
    for (let u = 0; u < width; u++)
      labels[v * width + u] =
        data.annotation[
          voxelIndex(planePosition(name, position, u, v), data.dimensions)
        ];
  const at = (u: number, v: number) =>
    u < 0 || v < 0 || u >= width || v >= height ? 0 : labels[v * width + u];
  const edges: string[] = [];
  // Draw each interface once, merging collinear voxel edges without moving anatomical boundaries.
  for (let v = 0; v <= height; v++) {
    let start = -1;
    for (let u = 0; u <= width; u++) {
      const edge = u < width && at(u, v - 1) !== at(u, v);
      if (edge && start < 0) start = u;
      if (!edge && start >= 0) {
        edges.push(`M${start},${v}H${u}`);
        start = -1;
      }
    }
  }
  for (let u = 0; u <= width; u++) {
    let start = -1;
    for (let v = 0; v <= height; v++) {
      const edge = v < height && at(u - 1, v) !== at(u, v);
      if (edge && start < 0) start = v;
      if (!edge && start >= 0) {
        edges.push(`M${u},${start}V${v}`);
        start = -1;
      }
    }
  }
  // Distance to the nearest label edge gives an interior anchor even for crescents or rings.
  const distance = new Uint16Array(labels.length);
  for (let v = 0; v < height; v++)
    for (let u = 0; u < width; u++) {
      const i = v * width + u,
        id = labels[i];
      distance[i] = !id
        ? 0
        : [at(u - 1, v), at(u + 1, v), at(u, v - 1), at(u, v + 1)].some(
              (n) => n !== id,
            )
          ? 1
          : 65534;
      if (u) distance[i] = Math.min(distance[i], distance[i - 1] + 1);
      if (v) distance[i] = Math.min(distance[i], distance[i - width] + 1);
    }
  for (let v = height - 1; v >= 0; v--)
    for (let u = width - 1; u >= 0; u--) {
      const i = v * width + u;
      if (u + 1 < width)
        distance[i] = Math.min(distance[i], distance[i + 1] + 1);
      if (v + 1 < height)
        distance[i] = Math.min(distance[i], distance[i + width] + 1);
    }
  const seen = new Uint8Array(labels.length),
    queue = new Int32Array(labels.length);
  const components: SliceComponent[] = [];
  for (let seed = 0; seed < labels.length; seed++) {
    if (!labels[seed] || seen[seed]) continue;
    const id = labels[seed];
    let count = 1,
      sumU = 0,
      sumV = 0;
    queue[0] = seed;
    seen[seed] = 1;
    for (let head = 0; head < count; head++) {
      const i = queue[head],
        u = i % width,
        v = Math.floor(i / width);
      sumU += u;
      sumV += v;
      for (const next of [
        u ? i - 1 : -1,
        u + 1 < width ? i + 1 : -1,
        v ? i - width : -1,
        v + 1 < height ? i + width : -1,
      ]) {
        if (next >= 0 && !seen[next] && labels[next] === id) {
          seen[next] = 1;
          queue[count++] = next;
        }
      }
    }
    let best = seed,
      score = -Infinity;
    for (let j = 0; j < count; j++) {
      const i = queue[j];
      const candidate =
        distance[i] * 1e6 -
        ((i % width) - sumU / count) ** 2 -
        (Math.floor(i / width) - sumV / count) ** 2;
      if (candidate > score) {
        score = candidate;
        best = i;
      }
    }
    components.push({
      id,
      key: seed,
      u: (best % width) + 0.5,
      v: Math.floor(best / width) + 0.5,
      area: count,
    });
  }
  const grouped = new Map<number, SliceRegion>();
  for (const component of components) {
    const old = grouped.get(component.id),
      structure = data.structures.get(component.id);
    if (!old || component.area > old.area)
      grouped.set(component.id, {
        ...component,
        acronym: structure?.acronym ?? `ID ${component.id}`,
        name: structure?.name ?? "源数据未提供名称",
        color: `#${structure?.color_hex_triplet ?? "879fa1"}`,
      });
  }
  return {
    width,
    height,
    labels,
    boundaryPath: edges.join(""),
    components,
    regions: [...grouped.values()].sort((a, b) =>
      a.acronym.localeCompare(b.acronym, "en"),
    ),
  };
}

export function segmentationImage(
  segmentation: SliceSegmentation,
  data: AtlasData,
): ImageData {
  const pixels = new Uint8ClampedArray(segmentation.labels.length * 4);
  const colors = new Map<number, number[]>();
  for (const region of segmentation.regions) {
    const hex = data.structures.get(region.id)?.color_hex_triplet ?? "879fa1";
    colors.set(
      region.id,
      [0, 2, 4].map(
        (start) =>
          255 * 0.86 + parseInt(hex.slice(start, start + 2), 16) * 0.14,
      ),
    );
  }
  for (let i = 0; i < segmentation.labels.length; i++) {
    const color = colors.get(segmentation.labels[i]) ?? [255, 255, 255];
    pixels.set([...color, 255], i * 4);
  }
  return new ImageData(pixels, segmentation.width, segmentation.height);
}

export function layoutSliceLabels(
  segmentation: SliceSegmentation,
  screenWidth: number,
  screenHeight: number,
) {
  const scale = screenWidth / segmentation.width,
    byId = new Map(segmentation.regions.map((r) => [r.id, r]));
  const placed: { x: number; y: number; width: number; height: number }[] = [];
  return [...segmentation.components]
    .sort((a, b) => b.area - a.area || a.key - b.key)
    .flatMap((c) => {
      const region = byId.get(c.id)!;
      const width = Math.max(16, region.acronym.length * 6.5 + 4),
        height = 15;
      const x = c.u * scale,
        y = c.v * scale;
      const box = { x: x - width / 2, y: y - height / 2, width, height };
      if (
        c.area * scale * scale < 70 ||
        box.x < 0 ||
        box.y < 0 ||
        box.x + width > screenWidth ||
        box.y + height > screenHeight ||
        placed.some(
          (p) =>
            box.x < p.x + p.width + 3 &&
            box.x + width + 3 > p.x &&
            box.y < p.y + p.height + 2 &&
            box.y + height + 2 > p.y,
        )
      )
        return [];
      placed.push(box);
      return [{ ...c, acronym: region.acronym, name: region.name, x, y }];
    });
}
