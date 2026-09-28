import { AtlasWorkspace } from "./components/AtlasWorkspace";
import { brainRegions, atlasReferences } from "./data/regions";
import { embryoStages, embryoReferences } from "./data/embryo";
import type { AtlasConfig } from "./lib/atlas-config";
import { ALLEN_BREGMA_AP_UM, ALLEN_MIDLINE_ML_UM } from "./lib/coordinates";
const adult: AtlasConfig = {
  id: "adult",
  embryonic: false,
  title: "成年小鼠脑三维图谱",
  manifestUrl: "/data/manifest.json",
  initialId: 382,
  regions: brainRegions,
  references: atlasReferences,
  badge: "CCFv3 · 2017",
  resolutionUm: 50,
  contrast: 350,
  maxContrast: 516,
  templateLabel: "平均自发荧光模板",
  coordinateLabel: "AP · Bregma / ML · 正中线",
  apBregmaUm: ALLEN_BREGMA_AP_UM,
  mlMidlineUm: ALLEN_MIDLINE_ML_UM,
  description:
    "使用 Allen CCFv3 的 2017 年标注、平均自发荧光模板与官方脑区表面。目录覆盖皮层、海马、间脑、基底节、中脑、脑桥和延髓等主要区域。",
  sliceNote:
    "三个切面从同一平均模板按体素重切，并叠加对应位置的 Allen 标注。它们不是某一只小鼠的原始组织切片。三维表面采用 Allen 官方网格，与体数据共享 CCF 坐标。",
  coordinateNote:
    "AP 采用 IBL 的 Bregma 近似参考位置：CCF AP = 5.40 mm，前正、后负。ML 以成年模板正中矢状面 CCF ML = 5.70 mm 为零，左负、右正。每步 50 μm，仅转换显示和输入，未进行颅骨配准、倾角或缩放校正，不等同于书籍或个体手术坐标。DV 仍从 CCF 体积顶部计量，向腹侧增加。放大不能提高 50 μm 图谱的解剖分辨率。",
  focusNote:
    "选择脑区会定位到左半球中实际属于该区的体素。父级脑区包含其后代标签。平滑网格与重采样切片边界可能存在细微差异。环路连接的是定位点，不代表轴突的真实走行。",
  sourceUrl: "https://portal.brain-map.org/atlases-and-data/ccf",
  annotationUrl: "https://atlas.brain-map.org/atlas?atlas=1",
};
export default function App() {
  if (location.pathname.replace(/\/$/, "") !== "/embryo")
    return <AtlasWorkspace config={adult} />;
  const requested = new URLSearchParams(location.search).get("stage");
  const stage = embryoStages.find((s) => s.id === requested) ?? embryoStages[0];
  if (requested !== stage.id) {
    const url = new URL(location.href);
    url.searchParams.set("stage", stage.id);
    history.replaceState(null, "", url);
  }
  const config: AtlasConfig = {
    id: stage.id,
    embryonic: true,
    title: `胚胎小鼠脑图谱 · ${stage.id}`,
    manifestUrl: stage.manifestUrl,
    initialId: stage.initialId,
    regions: stage.regions,
    references: embryoReferences,
    badge: `DevMouse · ${stage.id}`,
    resolutionUm: stage.resolutionUm,
    contrast: 230,
    maxContrast: 255,
    templateLabel: stage.tissue,
    coordinateLabel: "阶段参考坐标",
    description: stage.description,
    sliceNote:
      "使用 Allen Developing Mouse Brain Atlas 的原始三维组织学参考体积和相配的发育期标注。按脑部标注范围裁剪并重采样至等方体素，三维表面由该阶段脑区标签重建。未使用成年脑缩放替代，也未镜像生成未标注的半球。",
    coordinateNote:
      "AP 以该阶段标注脑部前缘为零、前正后负；DV 以背缘为零、向腹侧增加；ML 以单侧标注内侧缘近似正中线为零，左负右正。三个零点均取自该阶段标注表面的包围边界，不是手术定位点。40 μm 是重采样间距，不代表边界精度。原始采样和裁剪偏移保存在数据清单中。各时点不是同一只动物的纵向扫描，也没有加载跨时点配准；相同读数不代表同一解剖位置，更不能与成年 CCF 或 Bregma 坐标对应。",
    focusNote:
      "只显示真实标注覆盖的一侧脑组织。选择发育分区后，定位点落在该阶段的有效标签内。相同分区名称不能直接推断成年期功能；三维边界的精细程度受原始切片和采样间距限制。",
    sourceUrl: stage.sourceUrl,
    annotationUrl: "https://developingmouse.brain-map.org/static/atlas",
  };
  return (
    <AtlasWorkspace
      key={stage.id}
      config={config}
      stageNavigation={
        <section className="development-timeline" aria-label="选择胚胎发育阶段">
          <div className="timeline-intro">
            <strong>胚胎发育阶段</strong>
            <span>独立参考标本 · 单侧标注</span>
          </div>
          <nav aria-label="发育时点">
            {embryoStages.map((s) => (
              <a
                key={s.id}
                href={`/embryo?stage=${s.id}`}
                aria-current={s.id === stage.id ? "page" : undefined}
              >
                <strong>{s.id}</strong>
                <span>第 {s.id.slice(1)} 天</span>
              </a>
            ))}
          </nav>
        </section>
      }
    />
  );
}
