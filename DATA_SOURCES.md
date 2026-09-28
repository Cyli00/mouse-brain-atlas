# Allen 小鼠脑数据

本项目使用 Allen Institute for Brain Science 发布的真实 CCFv3 参考体积和区域表面网格。数据不是程序生成的脑形状。浏览器中的切片由同一份三维参考体积按任意体素位置重切，三维区域来自 Allen 官方 OBJ 网格。

## 数据版本与来源

已打包数据采用 CCFv3 的 2017 年注释版本，体素间距为 50 µm，维度为 264 × 160 × 228。选择这一版本是为了让模板、2017 年区域网格和注释保持一致；它不是 Allen 最新发布的所有注释版本。

| 数据 | 官方来源 | 本项目处理 |
| --- | --- | --- |
| 平均荧光模板 | [average_template_50.nrrd](https://download.alleninstitute.org/informatics-archive/current-release/mouse_ccf/average_template/average_template_50.nrrd) | 无损提取 uint16 体素，重新 gzip 压缩 |
| 脑区标注 | [annotation_50.nrrd](https://download.alleninstitute.org/informatics-archive/current-release/mouse_ccf/annotation/ccf_2017/annotation_50.nrrd) | 无损提取 uint32 Allen 结构 ID，未重新编号 |
| 脑区本体 | [structure graph 1](https://api.brain-map.org/api/v2/structure_graph_download/1.json) | 将树展开为数组，保留 ID、名称、缩写、颜色、父 ID 与完整祖先路径 |
| 整脑和 65 个区域网格 | [2017 structure meshes](https://download.alleninstitute.org/informatics-archive/current-release/mouse_ccf/annotation/ccf_2017/structure_meshes/) | 保留官方顶点和三角形，转换成 float32/uint32 二进制；渲染时重算法线 |

平均模板是 1,675 只小鼠脑的形状和背景荧光强度平均，原始成像方式是连续双光子断层成像。它不是单只小鼠的组织学切片序列，也不是 MRI。三维重建与配准由 Allen 完成；本项目负责获取、无损打包、区域表面显示和三正交平面的实时重切。[Wang et al., 2020](https://doi.org/10.1016/j.cell.2020.04.007)

成年小鼠图谱现包含 65 个区域与 root 997 整脑网格。完整 ID、缩写和 Allen 名称保存在 `public/data/adult-region-ids.json`，此文件也是数据制备脚本的输入。所有 65 个区域均有官方 OBJ 网格和 50 µm 标注中的实际体素。

| 范围 | 主要区域 |
| --- | --- |
| 皮层、嗅觉和海马 | PL、ILA、MOp、SSp、VISp、AUDp、MOB、ENT、DG、CA1、CA3 |
| 基底节与边缘相关区域 | STR、CP、ACB、GPe、GPi、STN、BLA、CEA、BST、LS |
| 丘脑与下丘脑 | TH、MD、VAL、VM、PVT、RE、HY、LHA、ZI |
| 中脑 | MB、SCs、SCm、IC、PAG、SNc、SNr、VTA、MRN、RN、DR、IPN、PPN |
| 脑桥 | P、LC、PB、PRNc、PRNr、LDT、V、SOC、NLL |
| 延髓、前庭核和小脑 | MY、NTS、DMX、XII、IO、GRN、VII、MV、LAV、SUV、SPIV、CN、CB |

上述分组方便查阅，不替代 Allen 的解剖本体。区域保留完整祖先路径，父区域包括其所有下属结构。比如 Allen 本体将 PPN 归入 MB、STN 归入 HY、CEA 和 LS 归入 STR；因此父区域与具体核团的体积会重叠，不能把目录中的体积直接相加。以 `structureIdPath` 判断包含关系，不以缩写或解说主题推断。

## 坐标与取样

体素数组不转置，按 AP、DV、ML 轴存储，AP 变化最快。数组索引公式为：

```text
index = ap + 264 * (dv + 160 * ml)
CCF coordinate in µm = [ap, dv, ml] * 50
```

AP 增大指向尾侧，DV 增大指向腹侧，ML 增大指向右侧。这是 Allen 文档定义的 PIR 方向。原始 NRRD 头中的 `space` 字段写为 `left-posterior-superior`，与其文档中的解剖轴约定不一致。本项目保留原始头信息供核验，按 Allen 的 AP、SI、LR 数组和 PIR 解剖约定解释数据。[Allen API 文档](https://community.brain-map.org/t/api-allen-brain-connectivity/2988)

三维网格也保留 Allen 的微米坐标。前端对模板、标注和网格应用同一个三维显示变换。冠状面固定 AP，水平面固定 DV，矢状面固定 ML。底层仍为 CCF 原点坐标。成年 AP 的读数与输入采用下述 Bregma 近似参考；ML 以正中线为零，DV 保留 CCF 原点。

### 成年 AP 的 Bregma 参考

依据 [IBL iblatlas 的坐标定义](https://github.com/int-brain-lab/iblatlas/blob/main/iblatlas/atlas.py)，采用 Allen CCF 中的 Bregma AP = 5400 μm。页面只转换 AP：`AP_mm = (5400 - ap_voxel * spacing_um) / 1000`，前正、后负。反向输入使用同一个函数族，吸附到最近体素。50 μm 数据的第 108 号体素索引为 AP 0，显示层号为 109；范围为 −7.75 至 +5.40 mm。

这是有来源的近似参考，并非 CCF 原生的精确颅骨标定，也未做倾角、缩放或个体配准。DV 不使用 IBL 的参考偏移，仍表示距 CCF 顶部的距离；ML 以 CCF ML = 5.70 mm 的正中矢状面为零，左负、右正。胚胎坐标不变。实现集中在 `src/lib/coordinates.ts`，普通切片、放大切片和输入框共用。

### Paxinos–Franklin 分区选项

使用 Chon、Vanselow、Cheng 和 Kim 的 [Enhanced and unified anatomical labeling for a common mouse brain atlas](https://doi.org/10.1038/s41467-019-13057-w)，配套数据为作者发布的 [Unified mouse brain atlas v2，2024](https://figshare.com/articles/dataset/Unified_mouse_brain_atlas_v2/25750983)，固定 Figshare article version 1。作者以 FP 第 3 版分区为基础，纳入第 4 版更新，再结合 MRI 和细胞标记调整到 Allen CCF。源数据许可证为 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，本项目的修改是轴重排、反向、最近邻重采样以及本体格式转换。

出版社目前标记 [第 5 版，2019](https://shop.elsevier.com/books/paxinos-and-franklins-the-mouse-brain-in-stereotaxic-coordinates/paxinos/978-0-12-816157-9)为最新版。本项目的 Kim v2 选项不是第 5 版的数字复刻，也不使用用户 PDF 的图像或提取轮廓。已评估的现成工具包括 [SHARCQ](https://github.com/wildrootlab/SHARCQ)，提供 Allen / Chon 分区切换，以及 [BrainGlobe atlas API](https://github.com/brainglobe/brainglobe-atlasapi)，提供 Kim 体数据和三维网格支持。[3dBAR](https://github.com/pmajka/3dbar)的 FP 路线从第 3 版 PDF 提取 SVG，与本次要求不符，未采用。

转换脚本为 `scripts/prepare_kim_data.py`。输入三个文件的 MD5 必须匹配作者公开值；输出 manifest 保存源文件 SHA-256、转换步骤与输出校验值。

- 作者 NIfTI 数组为 570 × 400 × 660，20 μm 网格；其标签经作者形状插值生成，网格间距不等于实际边界精度。NIfTI 的 spacing 字段为占位值，按作者元数据与 BrainGlobe 导入器解释。
- 方向依据 [BrainGlobe 官方 Kim v2 导入脚本](https://github.com/brainglobe/brainglobe-atlasapi/blob/main/atlas_scripts/kim_mouse_isotropic.py)。RSP 指原点位于右、上、后侧，并不是正方向。转置 `(2, 1, 0)` 后反转 AP 和 ML，得到与本项目一致的 AP 向后、DV 向腹侧、ML 向右。
- 在 Allen 50 μm 采样位置取最近邻标签，得到 264 × 160 × 228 体积。每个轴源索引为 `floor(index * 50 / 20 + 0.5)`。未平滑标签、未拟合新的配准。
- 配套 Kim 参考模板做相同转换，与本地 Allen 模板每第五个体素对比，Pearson 相关系数为 0.996625。该核验用于检查轴向和整体重合，不声称所有分区边界一致。
- 输出保留 1103 个非零标签。作者标签体积含 ID 728，但其 CSV 本体无此项；界面显示“源数据未提供名称 · ID 728”，不借用 Allen 的同编号名称。
- 切片来源切换只替换标注体积与本体，共用现有 Allen 灰度模板。三维模型、脑区目录、解说与环路继续使用 Allen。两个来源不按 ID 自动对应，不把 Allen 高亮或解说套到 Kim 分区。

复现示例，Python 需要 numpy：

```bash
python scripts/prepare_kim_data.py \
  --annotation /tmp/UnifiedAtlas_Label_v2_20um-isotropic.nii \
  --template /tmp/UnifiedAtlas_template_coronal_20um-isotropic.nii \
  --ontology /tmp/UnifiedAtlas_Label_ontology_v2.csv
```

三个输入的作者下载地址分别是 `https://ndownloader.figshare.com/files/46096131`、`https://ndownloader.figshare.com/files/46096122` 和 `https://ndownloader.figshare.com/files/46096116`。

`focusVoxel` 是区域左半球内的真实标注体素，选择它是为了让脑区跳转落在脑区中。`centroidVoxel` 是整个双侧区域的体素重心，可能位于两侧之间，不应直接作为区域内部点。50 µm 分辨率会丢失更小的结构和边界细节；浏览器中的插值放大不会提高原始分辨率。

小核团的显示精度尤其有限。例如当前 LC 标注总共只有 113 个 50 µm 体素，官方网格含 62 个顶点。该区域可以定位，但不能据此判断单个细胞、核团内部细分或实验注射边界。网格和标注也不是彼此的逐体素复制；官方平滑表面与 50 µm 标注之间最大的区域包围盒差为 221.79 µm，出现在 BST。manifest 为每个区域记录实测差值，不移动或拉伸网格来掩盖差异。

区域参考图谱提供空间标签，不能单独证明两个脑区之间存在连接。回路图中的节点位置可以取自这些数据，边的方向、作用和证据应来自对应的示踪或干预研究。区域中心之间的示意线不是 Allen 测得的轴突路径，也不能表示所有细胞都具有同一种递质或功能。

功能解说优先引用与物种、结构和具体结论相符的原始研究。需要综述交代通路背景时，先检查 Cell、Nature、Science 主刊是否有直接对应的综述，再考虑专业综述；不为追求期刊名称引用主题不符的文章。综述汇集的实验不能表述为该综述新做的实验。对未检索到的证据只说明“本页所引文献未提供”，不推断整个领域不存在相关研究。

## 文件格式

`public/data/manifest.json` 包含尺寸、间距、坐标、每个源文件的 URL 和 SHA-256，以及压缩和解压后体积文件、网格文件的字节数与 SHA-256。

- `template.uint16.gz` 解压后为 little-endian uint16。实测强度范围是 0 到 516，未做归一化或滤波。
- `annotation.uint32.gz` 解压后为 little-endian uint32。0 表示未标注背景，其他值是 Allen 结构 ID。
- `ontology.json` 是完整的平铺本体，`structureIdPath` 包括自身 ID。
- `adult-region-ids.json` 是可重建的成年脑区清单，包含 65 项 ID、缩写和名称。`manifest.regions` 补充了网格、定位体素、祖先和子区域关系及空间检验结果。
- `meshes/<id>.bin.gz` 解压后前 8 字节是两个 little-endian uint32，依次为顶点数和三角形数；之后为 `顶点数 × 3` 个 float32 坐标和 `三角形数 × 3` 个 uint32 顶点索引。坐标单位为 µm，顺序是 AP、DV、ML。没有简化表面网格。

## 重新获取与验证

需要 Python 3.10 或更新版本以及 curl，无需额外 Python 库。下载缓存默认保存在系统临时目录，不放进仓库。

```sh
python3 scripts/prepare_allen_data.py --resolution 50
python3 scripts/verify_allen_data.py
```

脚本也支持 `--resolution 100` 和 `--resolution 25`。这两个选项使用对应的官方分辨率文件，不对已有体积自行下采样。运行后应以生成的 manifest 为准，前端不可硬编码维度。`--cache` 可指定下载缓存，`--output` 可指定输出目录，`--regions` 可指定另一份成年脑区清单。gzip 设置固定时间戳，同一源数据得到相同的二进制输出；manifest 记录每次制备时间。验证脚本检查所有体积和网格的 SHA-256、定位点、区域体素数、包围盒与网格索引，并按本体祖先同时累计重叠区域。

## 使用条件与引用

数据版权属于 Allen Institute for Brain Science，按其 [Terms of Use](https://alleninstitute.org/legal/terms-of-use) 使用。该条款允许带来源署名的研究及其他非商业用途，商业使用须取得 Allen Institute 的书面许可。数据未在本项目中改为 MIT 或 CC BY 许可。公开展示或发表时应遵循其[引用政策](https://alleninstitute.org/citation-policy/)，同时引用实际文件链接与数据集论文。

Wang Q, Ding S-L, Li Y, et al. The Allen Mouse Brain Common Coordinate Framework: A 3D Reference Atlas. *Cell*. 2020;181(4):936–953.e20. [doi:10.1016/j.cell.2020.04.007](https://doi.org/10.1016/j.cell.2020.04.007).

本项目与 Allen Institute 无隶属关系。

## 成年血管网络

血管来源为 Todorov 等 2020 的 [VesSAP](https://doi.org/10.1038/s41592-020-0792-1) 和 Paetzold 等 2021 的 [VesselGraph](https://github.com/jocpae/VesselGraph)，使用成年 BL6J-no1 单标本。Allen 的参考图谱下载目录未列出可直接使用的独立血管网络；本层是第三方数据，不能称为 Allen 官方血管图谱。数据及衍生文件遵循 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)，不随应用代码改变许可。

源图含 5,614,677 条边。网页保留源平均半径至少 6 体素的 154,045 条边；源体素为 3 μm，即估计直径至少 36 μm。默认显示至少 48 μm 的 39,214 条边，另可选择至少 60 μm 的 13,967 条边。文件按源半径降序排列，筛选取前缀，不随机抽样。线段连接作者提取的实测节点，近似节点间走向，不重建管壁和完整曲率，也没有动静脉或血流标签。显示线宽不表示实际管径。直径阈值来自变形前标本，不能作为 CCF 中的局部管径测量。

配准采用 [VesSAP 数据服务器](https://discotechnologies.org/VesSAP/)发布的该标本 `TransformParameters.0.FullRes.txt` 和 `TransformParameters.1.FullRes.txt`。作者把 Allen 标签映射到标本空间，Elastix 的重采样变换把标本点映射回参考空间。按其 [Compose 定义](https://elastix.dev/doxygen/classelastix_1_1TransformBase.html)，先应用 Euler ZXY 刚体变换，再应用三次 B-spline。这里的参数单位不是毫米，固定网格间距 0.1 对应标本 3 μm；输出 ML、AP、DV 重排为本项目的 AP、DV、ML。恢复作者由 10 μm 到 3 μm 网格重采样的体素中心偏移，最终 `CCF_um = transformed_[AP,DV,ML] * 30 - 3.5`。没有通过拉伸脑外形拟合血管。

用独立发布的标签结果核验这条坐标转换，2026-09-28 的结果如下。

| 检查 | 匹配数 | 范围与限制 |
| --- | --- | --- |
| 作者配准结果与 Allen 10 μm 标签 | 639 / 641，99.688% | 来自配准结果文件前部的非零抽样点，不覆盖整个体积 |
| 左右半球方向 | 641 / 641，100% | 作者用负 ID 标记左半球，与 CCF ML < 5700 μm 一致 |
| 图节点所属脑区组 | 16,794 / 16,869，99.555% | 从全脑节点按每 211 项抽样，与作者发布的脑区组比较，排除背景、root 和本地本体无对应组的项目 |

作者配准 NIfTI 用 float32 保存 ID，大整数会舍入，核验时把 Allen ID 转为同一精度。脑区组采用作者的颜色分组，并接受本体祖先组。这些数值验证转换复现，不能解释为独立解剖标志点误差或个体血管定位精度。Allen 官方 `annotation_10.nrrd` 的 SHA-256 为 `a9e9654ef491f0af107dc0a61bd720dabe7f36e8f3e9239532bf3dbdc94ef24c`。

`public/vasculature/adult/manifest.json` 保存源图地址、SHA-256、变换文件校验值和输出校验值。`scripts/prepare_vasculature.py` 需要 numpy、scipy、pandas，使用完整 `C57BL_6_no1.zip` 可复现网页文件。`tests/fixtures/vascular-registration.json.gz` 保存从作者文件抽出的核验点及原始标签，沿用相同数据许可。`scripts/verify_vasculature.py --annotation-raw <Allen_10um_uint32_payload> --report <临时报告路径>` 可重新核验，两个一致率均须达到 99%。

另一候选是 [Demeulenaere 等的 3D ULM 数据](https://zenodo.org/records/6328308)，CC BY 4.0。实查其密度 MAT 只有 588 × 651 × 651 数组，没有原点、轴向或配准矩阵，因此未接入本页。

本次范围仅限成年血管。胚胎 E11.5、E13.5、E15.5、E18.5 暂无本项目已核验的血管层。[Walls 等的早期胚胎血管图谱](https://doi.org/10.1371/journal.pone.0002853)覆盖 E8.0–E10.0，阶段不匹配；[Berrios-Otero 等的胚胎脑动脉研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC2859666/)提供相关成像研究，但此次未取得可直接接入的体数据及本页四阶段配准。胚胎界面保持原样，不显示血管入口，不把成年血管缩放到胚胎。

### ML 正中线与分区图显示

成年 ML 采用本模板的正中矢状面 CCF ML = 5700 μm。换算 `ML_mm = (ml_voxel * spacing_um - 5700) / 1000`，左负、右正。50 μm 网格第 114 号索引为 ML 0。模板镜像核验中，左右索引和为 228 的配对平均绝对强度差为 1.20386，优于以存储范围端点中点配对的 4.50803。偶数长度数组包含左右不对称的末端采样范围，不能用 `(228 - 1) / 2` 把原点放在两个体素之间。此定义是当前模板中线，不是 IBL 所用的 5739 μm Bregma ML 近似值。

分区图由同一 Kim 标签体积实时重切。像素之间标签不同的位置生成边界，内部孔洞与相邻分区接口保留。用连通区域和到边界的距离选内部文字锚点，避免凹形区域的质心落在其他脑区。图中文字按屏幕尺寸避让，完整分区列表保留全部 ID。50 μm 栅格边界存在台阶，不用曲线平滑制造不存在的精度。

在 AP −4.05 mm 冠状面可读到 119 个非零标签，包括 DMPAG、DLPAG、LPAG、SuG、InG、InWh 和 Aq。参考截图的 AP −4.03 mm 不在 50 μm 采样网格上。本数据还经过原作者的边界调整，因此不宣称复现书籍 Figure 64 的全部结构和位置。

## PF 白质表面与导览

`prepare_kim_white_matter.py` 从已打包的 50 μm Kim v2 标签逐一重建表面，使用精确标签掩膜、marching cubes 0.5 等值面；不平滑、不减面，并保留全部连通部分。76 个有体素的白质标签都有独立网格与位于该标签内的定位点。manifest 记录网格校验值、边界、体素数及无体素的本体节点；未绘制或重采样后无体素的节点不伪造网格。

分类按 fiber tracts 1009 子树，加上上丘白层 17、42、851 和上髓帆 2219。源本体挂在纤维束下的 I8 间质核 2461 是核团，明确排除。Op 的有髓纤维依据 Byun 等 2016，doi:10.1002/cne.23952；上髓帆的白质薄板形态参照 Brogna 等人体解剖研究，doi:10.1007/s00701-020-04418-2，仅作为解剖说明而非小鼠功能实验证据。功能解说分别给出通路文献与证据局限，表面不是轴突示踪或弥散纤维追踪。

## 新增经典环路

海马三突触及内嗅区直接到 CA1 的支路参考 Kohara 等 2014，doi:10.1038/nn.3614；该研究也说明经典简图之外存在 CA2 等通路。MD 与前额叶回路参考 Schmitt 等 2017，doi:10.1038/nature22073。CEA 到腹外侧 PAG 的冻结通路参考 Tovote 等 2016，doi:10.1038/nature17996，抑制性输入通过去抑制产生行为输出，不等于抑制整个 PAG。基底节增加 GPe→STN 和 STN→SNr，分别依据 Chu 等 2015，doi:10.1016/j.neuron.2014.12.022 与 Fife 等 2017，doi:10.7554/eLife.27689。所有曲线及流动均为方向示意，不表示轴突轨迹、连接强度或传导速度。
