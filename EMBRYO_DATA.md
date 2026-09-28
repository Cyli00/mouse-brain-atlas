# 胚胎小鼠脑数据

本页使用 Allen Developing Mouse Brain Atlas 的真实阶段参考体数据。每个时点来自独立参考标本，不是成年 CCF 的缩放模型，也不是同一标本的连续成像。

## 数据内容

| 阶段  | Allen reference space | 原始体数据尺寸 AP × DV × ML | 网页尺寸 AP × DV × ML | 网页保留的末级标签 |
| ----- | --------------------- | --------------------------- | --------------------- | ------------------ |
| E11.5 | 1                     | 345 × 371 × 158             | 94 × 125 × 37         | 222                |
| E13.5 | 2                     | 552 × 673 × 340             | 152 × 90 × 37         | 657                |
| E15.5 | 3                     | 704 × 982 × 386             | 175 × 101 × 50        | 693                |
| E18.5 | 5                     | 581 × 370 × 278             | 202 × 112 × 60        | 71                 |

原始体素间距均为 16 × 16 × 20 μm。网页体素间距为 40 × 40 × 40 μm。每阶段提供 13 个重点发育区室的可选曲面；切片标注保留更多细分标签。E18.5 官方分区较粗，标签较少不代表生物学结构变少。

下载文件来自 [Allen 官方数据目录](https://download.alleninstitute.org/informatics-archive/current-release/mouse_annotation/)。各阶段文件名分别以 `E11pt5`、`E13pt5`、`E15pt5`、`E18pt5` 开头，使用 `*_atlasVolume.zip` 和 `*_DevMouse2012_annotation.zip`。灰度参考体为 uint8，注释为 uint32。

体数据标签对应 [Allen structure graph 17](https://api.brain-map.org/api/v2/structure_graph_download/17.json)。这与基因表达手动评分所用的 graph 112755225 不同。所有非零原始标签均已检查能在 graph 17 中找到。

## 重建和显示

1. 读取官方 MetaImage 头与原始数组，验证体积、字节序和模板／标注尺寸一致。
2. 取前脑 F、中脑 M、后脑 H 及其脑室的已有标签，裁剪到共同包围盒并保留两网页体素的边距。原始整胚中的脊髓、身体及仅被标为纤维束的部分不在显示范围内。
3. 将灰度用三线性插值、解剖标签用最近邻采样到 40 μm 等方网格。保留灰度方向及 0–255 的原始强度标度，升级到 uint16 以复用网页读取器。在所保留标签以外将灰度设为 0。
4. 对已重采样标签的联合掩膜及 13 个区室分别运行 marching cubes，等值面取 0.5。按 AP、DV、ML 轴顺序输出朝外的三角面，检查每个闭合网格的有向体积为正。仅为封闭边界补一层零值背景；没有平滑、镜像、跨阶段变形或生成解剖结构。
5. 以 gzip 打包体数据和网格。每个 `manifest.json` 保存下载来源、原始文件 SHA-256、输出文件 SHA-256、体积尺寸、裁剪起点、原始头和处理说明。

根曲面覆盖保留的脑组织及脑室。`rootId=15565` 是发育层级的 NP 上级节点，用于渲染入口；这里没有把整个神经板或脊髓全部显示出来。

源标注仅覆盖一个半球。本页只显示已有标注及其匹配灰度，没有通过镜像补成双侧脑。脑室也保留了官方标签，不能把其体积解释为神经组织体积。

## 精细分区模式

页面默认显示“精细分区 · 原始标签”，使用各阶段已打包的非零标签，不把完整本体中的未描绘节点当作可显示区域。这是 Allen 发育分区，不是成年 Paxinos–Franklin 的胚胎版本。二维分区图、组织图、边界与名称开关、放大和全部分区列表沿用成年切片的交互。

“主要区室 · 合并下级”按 graph 17 的祖先路径合并到导览收录的 13 个发育区室；不在这些区室下的标签原样保留，脑室不会被并入组织。两种显示保留同一体素位置、背景掩膜和灰度数据，不重采样。三维中的组织切面同步使用当前层级，三维表面和解说仍对应这 13 个主要区室。点击切面列表定位实际标签，交点显示该标签的官方缩写与名称；“查看解说”查找最近的已收录祖先区室。

当前阶段的分区层级和分区图／组织图选择写入 URL，刷新可恢复；切换发育阶段回到该阶段默认精细分区。E18.5 的标签数量明显少于 E15.5 是源标注粒度差异，不能据此推断生物学结构消失。

## 坐标与精度

[Allen 官方参考模型文档](https://brain-map.org/support/documentation/allen-developing-mouse-brain-reference-atlas)明确规定原始数组使用 PIR 方向，x 向后、y 向腹侧、z 向右；官方 Matlab 示例也把 x 固定为冠状面、z 固定为矢状面。网页保留这一 AP-fastest 数组顺序。

原始 MetaImage 文件同时含有 `AnatomicalOrientation=RAI`、单位 `TransformMatrix` 和 `Offset=0 0 -160`。该头字段与文档的数组方向约定不一致。本实现保留原始头以供核查，按官方数组与切面文档解释坐标，没有因该字段额外翻转或换轴。

网页显示裁剪后的阶段局部坐标。`cropOffsetNativeVoxel` 记录裁剪起点；`originUmInNativeReference` 记录带原始 Offset 的起点。在 AP、DV、ML 轴上，网页体素索引乘以 40 μm，再加这个原点，即对应阶段参考空间的位置。它不是成年 CCF 或 Bregma 坐标，本页也没有加载或应用 Allen 的跨时点坐标变换，因此不能把不同阶段相同的网页坐标视为同一解剖位置。

Allen 的三维标签由间隔矢状面图谱描绘插值得到。40 μm 网页采样和原始 16 × 16 × 20 μm 重建间距都不代表边界具有同等解剖精度。插值痕迹和阶段间不同标注粒度会保留在曲面中。

[当前官方二维参考图谱页面](https://developingmouse.brain-map.org/static/atlas)列出 E11.5、E13.5、E15.5、E18.5 的描绘间隔为 40、100、120、120 μm，标称层级为 9、10、10、5。这些数值描述当前二维参考图谱，不把它们视为已验证的 `DevMouse2012` 体文件的原始描绘间距。页面配置用 `referenceDrawingIntervalUm` 和 `referenceDrawingLevel` 明确标识这一来源。

原始体文件的实际非零标签已另行检查。按 graph 17 的 `st_level` 字段，E11.5 的标签涵盖 1、3、5、9 层级；E13.5 涵盖 5、6、9、10；E15.5 涵盖 5、9、10；E18.5 主要为 5，但 CSPall、DPall、MPall 三个标签是 7。因此官方二维图谱的标称层级不是体文件全部标签的最大层级。ZIP 内的注释文件时间戳为 2013 年 5 月；文件名中的 `DevMouse2012` 不能单独当作下载文件的制作年份。

## 复现

需要 Python 3.10+、numpy、scipy、scikit-image 和 curl。

```sh
python3 scripts/prepare_embryo_data.py --cache /tmp/mice-embryo-source
```

脚本下载四个时点，输出到 `public/embryo/`。`--stages E15.5` 可单独构建一阶段，`--resolution 80` 可生成更小的浏览体积。切換分辨率后需要同步调整页面阶段配置中的采样间距。原始下载缓存默认放在系统临时目录。

## 引用与使用条件

- Thompson CL, Ng L, Menon V, et al. _A high-resolution spatiotemporal atlas of gene expression of the developing mouse brain_. Neuron, 2014, 83(2):309–323. [doi:10.1016/j.neuron.2014.05.033](https://doi.org/10.1016/j.neuron.2014.05.033)。这是发育图谱的原始研究。
- Allen Institute for Brain Science. [Allen Developing Mouse Brain Reference Atlas](https://brain-map.org/support/documentation/allen-developing-mouse-brain-reference-atlas)。说明阶段参考数据、发育本体和三维体数据格式。
- Allen Institute for Brain Science. [Reference atlas technical white paper](https://developingmouse.brain-map.org/docs/ReferenceAtlas.pdf)。说明发育层级的区分方式。该链接是 2010 年白皮书，网页图谱在 2013 年另有标注更新。

数据版权属于 Allen Institute。请遵守其[使用条款](https://alleninstitute.org/legal/terms-of-use)和[引用政策](https://alleninstitute.org/citation-policy/)。条款允许按要求署名的研究和其他非商业使用；商业使用需要另行取得 Allen Institute 书面许可。
