import type { BrainReference, BrainRegion } from "./regions";

export const embryoReferences: BrainReference[] = [
  {
    title:
      "A high-resolution spatiotemporal atlas of gene expression of the developing mouse brain",
    authors: "Thompson CL, Ng L, Menon V, et al.",
    year: 2014,
    journal: "Neuron",
    url: "https://doi.org/10.1016/j.neuron.2014.05.033",
    finding:
      "建立涵盖胚胎和出生后阶段的原位杂交图谱、发育解剖层级及参考脑。早期分区和后期核团的组织方式随发育变化，不能把成年脑区缩小后代替胚胎脑。",
  },
  {
    title: "Allen Developing Mouse Brain Reference Atlas",
    authors: "Allen Institute for Brain Science; Luis Puelles",
    year: 2013,
    journal: "Allen 技术文档与发育解剖层级",
    url: "https://brain-map.org/support/documentation/allen-developing-mouse-brain-reference-atlas",
    finding:
      "参考脑按阶段由单个标本的切片重建，分区由矢状面图谱描绘并插值。分区名称采用发育本体，3D 体数据使用 PIR 轴序。",
  },
];

const developmentalEvidence =
  "按 Allen 发育解剖层级解释这一胚胎区室。颜色和边界表示解剖标注，不代表该阶段已具备成熟核团的功能；本页面未加载基因表达或细胞谱系测量。";

type RegionText = [
  number,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];
const regionText: RegionText[] = [
  [
    15739,
    "Tel",
    "端脑泡",
    "Telencephalic vesicle",
    "前脑",
    "#ED985C",
    "端脑泡是发育中的大脑半球原基，图谱在其中区分外套及外套下区。比较四个时点，可以观察这一原基的形状及其与间脑的相邻关系。",
    "观察大脑半球原基及其内部发育分区。",
  ],
  [
    15569,
    "POTel",
    "视前端脑区",
    "Preoptic telencephalon",
    "前脑",
    "#A84D10",
    "Allen 发育层级把视前端脑区归入吻侧次级前脑。它邻近下丘脑，但在这套本体中单独命名，避免直接套用成年图谱的边界。",
    "分辨视前区域与邻近下丘脑的发育区室。",
  ],
  [
    15622,
    "THy",
    "终末下丘脑",
    "Terminal hypothalamus",
    "前脑",
    "#A8663A",
    "终末下丘脑是下丘脑的吻侧发育区室，位于吻侧次级前脑。它与尾侧的柄部下丘脑共同帮助理解胚胎下丘脑的组织。",
    "比较吻侧和尾侧下丘脑的空间关系。",
  ],
  [
    16211,
    "PHy",
    "柄部下丘脑",
    "Peduncular hypothalamus",
    "前脑",
    "#DF7257",
    "柄部下丘脑对应这套发育本体中的尾侧下丘脑，继续区分翼板、基板和底板。名称描述发育区室，不能与成年下丘脑的某一个核团直接对应。",
    "查看下丘脑尾侧区室和背腹分区。",
  ],
  [
    16309,
    "p3",
    "前脑节 3",
    "Prosomere 3",
    "间脑",
    "#FFF9C7",
    "p3 是间脑的一个前脑节，包含前丘脑的发育区域。用它与 p2、p1 的邻接关系，可以读懂 Allen 对胚胎间脑的分段方式。",
    "定位前丘脑相关发育区室。",
  ],
  [
    16375,
    "p2",
    "前脑节 2",
    "Prosomere 2",
    "间脑",
    "#FFF189",
    "p2 是丘脑和上丘脑相关的间脑区室。发育图谱按照前脑节组织这一位置，而不是直接使用成年丘脑核团的精细边界。",
    "观察丘脑相关区室与相邻前脑节。",
  ],
  [
    16509,
    "p1",
    "前脑节 1",
    "Prosomere 1",
    "间脑",
    "#FFE524",
    "p1 对应靠近中脑的间脑区室，包含顶盖前区的发育区域。它是查看间脑和中脑交界的解剖参照。",
    "辨认顶盖前区与中脑之间的边界。",
  ],
  [
    16650,
    "m1",
    "中脑节 1",
    "Mesomere 1",
    "中脑",
    "#17B317",
    "m1 是较吻侧的中脑区室，包含中脑顶盖和被盖的发育分区。沿矢状面观察，可比较它与间脑及尾侧中脑的相对位置。",
    "观察中脑顶盖、被盖的整体布局。",
  ],
  [
    16751,
    "m2",
    "中脑节 2／前峡部",
    "Mesomere 2 / preisthmus",
    "中脑",
    "#00D100",
    "m2 是 Allen 发育本体单列的尾侧中脑区室，又称前峡部。它位于 m1 与后脑峡部之间，有助于把中脑尾端和后脑前端分开。",
    "检查中脑与后脑交界的窄小区室。",
  ],
  [
    16809,
    "PPH",
    "脑桥前后脑",
    "Prepontine hindbrain",
    "后脑",
    "#EA37FF",
    "这一发育区室包含峡部、菱脑节 1 和菱脑节 2。它位于后脑的吻侧，可用于理解早期后脑分段，而不能简单等同于成年脑桥。",
    "查看峡部及 r1、r2 所在的后脑前端。",
  ],
  [
    17092,
    "PH",
    "脑桥部后脑",
    "Pontine hindbrain",
    "后脑",
    "#9442FF",
    "脑桥部后脑由菱脑节 3 和菱脑节 4 组成。这里的命名按发育分段组织，适合与相邻菱脑节比较，不表示成年脑桥核团已完全形成。",
    "定位 r3、r4 及其背腹区室。",
  ],
  [
    17220,
    "PMH",
    "脑桥延髓部后脑",
    "Pontomedullary hindbrain",
    "后脑",
    "#37A7FF",
    "脑桥延髓部后脑包含菱脑节 5 和菱脑节 6，连接更吻侧与更尾侧的后脑区室。三维选择可检查它们在弯曲胚胎脑轴上的位置。",
    "观察 r5、r6 所在的后脑中后段。",
  ],
  [
    17352,
    "MH",
    "延髓部后脑",
    "Medullary hindbrain",
    "后脑",
    "#12D9B9",
    "延髓部后脑是较尾侧的后脑区室，在 Allen 层级中包含菱脑节 7 至 11。本页在脑部标注范围截止，脊髓未纳入表面模型。",
    "定位后脑尾端及其与脊髓方向的关系。",
  ],
];

export const embryoRegions: BrainRegion[] = regionText.map(
  ([id, acronym, name, englishName, category, color, summary, purpose]) => ({
    id,
    acronym,
    name,
    englishName,
    category,
    color,
    summary,
    function: purpose,
    evidence: developmentalEvidence,
    references: embryoReferences,
  }),
);

export const embryoVentricleIds = new Set([126651562, 126651722, 126651782]);

export const embryoVentricleRegions: BrainRegion[] = [
  { id: 126651562, acronym: "v_F", name: "前脑脑室腔", englishName: "ventricles, forebrain", color: "#C35C2E" },
  { id: 126651722, acronym: "v_M", name: "中脑脑室腔", englishName: "ventricles, midbrain", color: "#17B317" },
  { id: 126651782, acronym: "v_H", name: "后脑脑室腔", englishName: "ventricles, hindbrain", color: "#EA37FF" },
].map((region) => ({
  ...region,
  surfaceRole: "cavity" as const,
  category: "脑室腔",
  summary: "模型由 Allen DevMouse2012 的脑室标签及其子级标签生成，表示脑室腔的范围。脑室腔与脑组织分别显示，边界保留来源标注。",
  function: "检查来源标注中的脑室腔及其与脑组织的空间关系。",
  evidence: "当前打包数据只有 E11.5 含这组脑室标签；其他阶段未生成脑室模型。缺少标签不表示该阶段没有脑室。",
  references: embryoReferences,
}));

export type EmbryoStage = {
  id: string;
  title: string;
  manifestUrl: string;
  resolutionUm: number;
  initialId: number;
  regions: BrainRegion[];
  description: string;
  tissue: string;
  sourceUrl: string;
  reference: BrainReference;
  referenceDrawingIntervalUm: number;
  referenceDrawingLevel: number;
  referenceDrawingSourceUrl: string;
  referenceSpaceId: number;
};

export const embryoStages: EmbryoStage[] = [
  {
    id: "E11.5",
    title: "胚胎第 11.5 天",
    referenceSpaceId: 1,
    description:
      "观察早期前脑、中脑和分段后脑。参考标本为整胚，本页提取其中已有标注的脑部。",
    tissue: "Feulgen-HP yellow · 原始整胚中的脑部",
    referenceDrawingIntervalUm: 40,
    referenceDrawingLevel: 9,
  },
  {
    id: "E13.5",
    title: "胚胎第 13.5 天",
    referenceSpaceId: 2,
    description:
      "端脑泡和间脑分区更易辨认，可沿三切面观察发育区室。当前模型使用这一阶段独立的参考标本。",
    tissue: "Feulgen-HP yellow · 原始整胚中的脑部",
    referenceDrawingIntervalUm: 100,
    referenceDrawingLevel: 10,
  },
  {
    id: "E15.5",
    title: "胚胎第 15.5 天",
    referenceSpaceId: 3,
    description:
      "比较增大的端脑与中脑、后脑之间的位置。切换阶段显示不同标本，不提供同一细胞或同一坐标的追踪。",
    tissue: "Feulgen-HP yellow · 原始整胚中的脑部",
    referenceDrawingIntervalUm: 120,
    referenceDrawingLevel: 10,
  },
  {
    id: "E18.5",
    title: "胚胎第 18.5 天",
    referenceSpaceId: 5,
    description:
      "观察临近出生时的脑部形态。官方这一阶段的解剖标注层级较粗，因此可读到的末级标签少于 E15.5。",
    tissue: "Nissl · 参考脑",
    referenceDrawingIntervalUm: 120,
    referenceDrawingLevel: 5,
  },
].map((stage) => ({
  ...stage,
  manifestUrl: `/embryo/${stage.id}/manifest.json`,
  resolutionUm: 40,
  initialId: 15739,
  regions: stage.id === "E11.5" ? [...embryoRegions, ...embryoVentricleRegions] : embryoRegions,
  referenceDrawingSourceUrl:
    "https://developingmouse.brain-map.org/static/atlas",
  sourceUrl: "https://developingmouse.brain-map.org/static/atlas",
  reference: embryoReferences[0],
}));
