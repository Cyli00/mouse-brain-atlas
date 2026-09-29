import { makeSlice, PLANES, type AtlasData, type PlaneName, type Position } from "./atlas";
import { segmentationImage, segmentSlice } from "./slice-segmentation";

export type PlaneDisplay = "off" | "transparent" | "tissue" | "regions";

export function scenePlaneImage(
  data: AtlasData,
  name: PlaneName,
  position: Position,
  mode: "tissue" | "regions",
  contrast: number,
) {
  const plane = PLANES[name];
  const segmentation = mode === "regions" ? segmentSlice(data, name, position[plane.axis]) : null;
  const image = segmentation
    ? segmentationImage(segmentation, data)
    : makeSlice(data, name, position, 0, false, contrast);
  const strides = [1, data.dimensions[0], data.dimensions[0] * data.dimensions[1]];
  const base = position[plane.axis] * strides[plane.axis];
  for (let v = 0; v < image.height; v++) {
    for (let u = 0; u < image.width; u++) {
      const pixel = v * image.width + u;
      const label = data.annotation[base + u * strides[plane.u] + v * strides[plane.v]];
      if (!label) image.data[pixel * 4 + 3] = 0;
      else if (segmentation && (
        (u > 0 && segmentation.labels[pixel - 1] !== label) ||
        (v > 0 && segmentation.labels[pixel - image.width] !== label)
      )) {
        // Mark true label interfaces; a one-voxel line stays attached to the atlas grid.
        image.data.set([50, 172, 208, 255], pixel * 4);
      }
    }
  }
  return image;
}
