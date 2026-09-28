import {
  getBinary,
  type AtlasData,
  type Position,
  type Structure,
} from "./atlas";

export type SliceSource = "allen" | "paxinos-kim";
export const KIM_SOURCE_LABEL = "Paxinos–Franklin 衍生分区 · Kim v2";
export const KIM_SOURCE_URL =
  "https://figshare.com/articles/dataset/Unified_mouse_brain_atlas_v2/25750983";
export const KIM_PAPER_URL = "https://doi.org/10.1038/s41467-019-13057-w";
export const PAXINOS_BOOK_URL =
  "https://shop.elsevier.com/books/paxinos-and-franklins-the-mouse-brain-in-stereotaxic-coordinates/paxinos/978-0-12-816157-9";

export async function loadKimAnnotation(
  base: AtlasData,
  signal: AbortSignal,
): Promise<AtlasData> {
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
  const response = await fetch("/data/kim-v2/manifest.json", {
    signal: bounded,
  });
  if (!response.ok) throw new Error("Kim 分区目录读取失败");
  const manifest = (await response.json()) as {
    space: string;
    dimensions: Position;
    resolutionUm: number;
    orientation: string;
    storageOrder: string;
    annotation: { url: string };
    ontology: { url: string };
  };
  if (
    manifest.space !== "allen-ccf-v3" ||
    manifest.orientation !== "PIR" ||
    manifest.storageOrder !== "AP-fastest" ||
    manifest.resolutionUm !== base.spacing ||
    !Array.isArray(manifest.dimensions) ||
    manifest.dimensions.length !== 3 ||
    manifest.dimensions.some((n, i) => n !== base.dimensions[i])
  )
    throw new Error("Kim 分区与当前参考体积的坐标不匹配");
  const [buffer, ontology] = await Promise.all([
    getBinary(manifest.annotation.url, bounded),
    fetch(manifest.ontology.url, { signal: bounded }).then((r) => {
      if (!r.ok) throw new Error("Kim 脑区名称读取失败");
      return r.json() as Promise<
        {
          id: number;
          name: string;
          acronym: string;
          color: string;
          structureIdPath: number[];
        }[]
      >;
    }),
  ]);
  if (buffer.byteLength !== base.annotation.byteLength)
    throw new Error("Kim 分区数据长度不正确");
  const structures = new Map<number, Structure>(
    ontology.map((s) => [
      s.id,
      {
        id: s.id,
        name: s.name,
        acronym: s.acronym,
        color_hex_triplet: s.color.replace("#", ""),
        structure_id_path: s.structureIdPath,
      },
    ]),
  );
  return {
    ...base,
    annotation: new Uint32Array(buffer),
    structures,
    meshes: {},
    manifest,
  };
}
