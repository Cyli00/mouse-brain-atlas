# 小鼠脑三维图谱

基于 Allen Mouse Brain Common Coordinate Framework v3 的中文交互图谱。采用官方 50 µm 平均自发荧光模板、2017 脑区标注及官方三维表面网格，参考 Neurotorium 的探索方式。

## 运行

需要 Node.js 20.19+ 或 22.12+。

```sh
npm install
npm run dev
```

打开终端显示的本地地址。构建静态站点：

```sh
npm run build
npm run preview
```

坐标回归测试使用 `npm test`。浏览器测试覆盖四个胚胎阶段、成年坐标、键盘输入、放大切片与窄屏无障碍检查。先运行 `npm run dev -- --port 5187`，再在另一终端运行 `BROWSER_CHANNEL=chrome npm run test:coordinates:browser`，使用本机 Chrome。已安装 Playwright Chromium 时可省略 `BROWSER_CHANNEL`；测试其他本地端口时设置 `ATLAS_TEST_URL`。

三维交互回归运行 `BROWSER_CHANNEL=chrome ATLAS_TEST_URL=http://127.0.0.1:5187 npm run test:scene:browser`，覆盖真实表面点击、悬停、拖动旋转、Ctrl 平移、单区观察、手机触控、环路模式及部分网格失败重试。截图保存在系统临时目录。

## Vercel 部署

在 Vercel 导入仓库根目录。`vercel.json` 已固定 Vite、`npm ci`、`npm run build` 和 `dist`，`package.json` 固定 Node.js 24.x；当前站点不需要环境变量。构建会生成 `dist/embryo/index.html`，Vercel 将 `/embryo` 重写到这个页面入口，阶段参数仍留在浏览器 URL 中。`public/` 内的图谱文件会随 Vite 构建复制到 `dist/`。

部署预览中直接打开 `/`、`/embryo?stage=E11.5` 和 `/embryo?stage=E18.5`，再检查 `/data/manifest.json`、`/data/kim-v2/manifest.json` 与 `/embryo/E11.5/manifest.json` 是否能读取。正式公开前请核对 [Allen Institute 使用条款](https://alleninstitute.org/legal/terms-of-use)与页面署名。

`dist/` 可以由静态服务器托管。所有图谱数据位于 `public/data/`，无需 Allen API 密钥。数据请求始终发往本地站点；功能文献通过外部链接打开。图谱按网站根路径部署。

## 使用

- 左侧脑区索引与右侧三维工作台联动，采用雾紫、墨蓝和鼠尾草绿界面配色。模型保留 Allen 脑区颜色，二维切片位于画布下方。
- 悬停彩色脑区查看名称，单击打开详情卡并同步目录、URL 和切片定位。“单独观察”隔离并聚焦选区，“功能、证据与文献”打开完整解说。目录可选择被外层遮挡的内部结构。
- 拖动三维脑旋转，Shift + 拖动或右键拖动平移，滚轮缩放；触屏单指旋转、双指缩放平移。三维切面默认隐藏，可手动打开后双击切面定位。画布支持 Enter 打开详情、Esc 关闭、F 聚焦和 Home 返回全脑。
- “展开画布”隐藏左侧索引。切片对照向下延伸，不压缩三维高度。PF 模式增加白质分类、所选白质三维显示及对应功能文献。
- 点击或拖动任意切片，三个视角同步更新。聚焦切片后可用方向键移动，Shift 加方向键移动五个体素。
- 切片下方滑杆改变该切面的深度。AP、DV、ML 坐标可输入毫米值，按 Enter 或离开输入框应用；越界值限制到图谱范围。
- 成年 AP 以 Bregma 近似位置为 0，前正、后负；ML 以脑正中线为零，左负、右正；DV 仍从 CCF 体积顶部计量。切片图谱可选择 Allen 或 Paxinos–Franklin 分区的 Kim v2，切换保留交点，放大视图同步。
- 开关脑区标注、调整灰度窗宽和脑表面透明度。索引中提供 65 个脑区的中文解说及对应文献。部分细小核团提供解剖来源和精度限制，避免把大脑区说明外推为细胞级功能。

三维依赖 WebGL；WebGL 不可用时仍可使用切片。需要支持 DecompressionStream 的现代浏览器。已加载的体数据可在浏览器内离线操作，未加载的三维网格仍需访问本地服务器。没有 service worker 或安装式离线缓存。

## 工作区操作

- 右上角 Allen Institute 数据链接右侧的月亮／太阳按钮切换日间与夜间模式。夜间使用夜蓝紫、电光黄和霓虹青配色，刷新及切换图谱后保留偏好。

- 窄屏幕使用“脑区导览 / 观察视图 / 解说与文献”切换，选中脑区后自动返回视图。
- 按 `/` 进入目录搜索；分类卡片、类别筛选和结果数量帮助浏览全部脑区。空结果可以跨类别搜索或清除搜索与筛选。
- “聚焦脑区”放大当前结构，适合查看小核团。三维图像获得键盘焦点后，方向键旋转、加减号缩放、`F` 聚焦、`Home` 查看全脑。
- 每个切片标题栏的放大按钮打开独立预览。方向键移动交点，`Page Up/Down` 换层，`Shift` 每次五步，`Enter` 或空格在当前平面内居中，`Esc` 关闭并返回原按钮。
- “交点所在区域”与已选脑区独立。点击“查看解说”查找交点最近的已收录父区，保留当前位置。
- 进入环路时记录普通脑区的切面和不透明度设置，退出后恢复。“恢复显示”只还原当前模式显示设置；相机由单独的视角复位按钮控制。

同一页面内脑区网格缓存有 24 项、32 MiB 上限。血管图层关闭后保留几何体，再开启时复用；离开工作区时释放，三类血管共用 3 个材质。切片分区结果按图谱分别缓存，最多 12 个切面，标签、底图及边界字符串预算为 16 MiB；预览、放大和三维复用结果。三维对像素的修改使用副本，不影响二维图像。平面内移动十字线不会重复生成同一位图。

## 成年脑区与环路

成年图谱已扩展到 65 区，其中 13 个中脑条目、9 个脑桥条目、12 个延髓条目。包含上丘、下丘、PAG、黑质、VTA、缝核、脚桥核、蓝斑、臂旁核、孤束核、迷走及舌下神经核、前庭和耳蜗核群等。可按中脑、脑桥和延髓筛选，或搜索中英文名称、缩写与分类。

“经典环路”提供基底节输出分支、背侧缝核与 VTA／伏隔核投射、上丘至 PAG 逃逸通路、NTS 至 PB 至 CEA 进食抑制通路。三维中显示实际脑区表面和带方向的关系示意；点击节点能定位切片。连线不是实测纤维轨迹，细胞类型、实验范围和省略分支在说明中逐项标注。

## 胚胎独立页面

打开 `/embryo`，或通过页首“胚胎小鼠”导航进入。支持 E11.5、E13.5、E15.5、E18.5 四个独立参考标本。每阶段有 13 个发育分区、真实组织学体数据与匹配标注，体数据按 40 μm 等方间距重采样，曲面通过标注重建。四阶段数据合计约 11 MB，按当前阶段加载。

原始体积部分包含整胚；页面仅保留已标注脑部及脑室，单侧标注未镜像补全。这些分区采用发育期本体，不能直接套用成年脑区功能。40 μm 是显示采样，不是解剖边界精度。本页未应用跨时点坐标变换，不能将相同坐标视为同一解剖位置。

胚胎 AP、DV、ML 分别以当前阶段标注脑部的最前边界、最背侧边界、单侧内侧边界为局部零点；AP 前正后负，ML 向右增加，DV 向腹侧增加。这些是标注边界相对坐标，ML 未校准解剖正中线，DV 不表示当前位置的脑表面深度，不能换算为成年 Bregma 坐标。四阶段零平面均位于相邻切片之间；输入 0 时选择标注侧最近切片，实际显示 AP / ML −0.02 mm、DV +0.02 mm。

完整来源与处理见 [EMBRYO_DATA.md](EMBRYO_DATA.md)。重新准备胚胎数据需要 Python 3.10+、NumPy、SciPy、scikit-image 和 curl：

```sh
uv run --with numpy --with scipy --with scikit-image python scripts/prepare_embryo_data.py
```

`npm test` 会验证四阶段的真实体数据、区域定位点、网格校验值与脑区目录。

## 数据与坐标

- 成年“血管网络”按需加载 MICe 单标本的 14 项具名血管表面，可选择静脉窦、主要动脉或主要静脉，保留交点背侧裁切。已移除按 μm 直径筛选的旧网络，不显示未命名微血管。该层未覆盖完整脑膜血管及桥静脉，跨图谱配准误差和复现方法见 [DATA_SOURCES.md](DATA_SOURCES.md)。
- 体素网格为 264 × 160 × 228，间距 50 µm，共 9,630,720 个体素。
- 存储轴为 AP、DV、ML，AP 最快，索引 `ap + 264 * (dv + 160 * ml)`。
- 底层 CCF 体素索引沿后、腹侧、右增大，原始体素位置等于索引乘以 0.05 mm；页面显示的 AP 和 ML 读数按下述零点换算。
- 三个视图由同一体积重切，二维画面保持物理比例。三维纹理像素中心和体素坐标一致。
- 三维脑与脑区采用 Allen 官方表面，未用简单几何体近似。它们是官方提供的重建结果，本项目没有重新配准单只动物的连续组织切片。
- 平均模板来自多只动物，不是某只动物的原始切片。底层坐标以 CCF 原点为基准；成年 AP 显示为 `5.40 − CCF AP` 毫米，采用 IBL 近似 Bregma 参考，未做颅骨配准或倾角/缩放校正。
- 父级脑区包含其所有后代标签。官方平滑网格与 50 µm 体素边界存在差异，所选区域边界的最大测得差异约 190 µm。

完整来源、格式、使用条件见 [DATA_SOURCES.md](DATA_SOURCES.md)。每个文件的 SHA-256、官方下载地址和脑区范围记录在 [manifest.json](public/data/manifest.json)。Allen 数据遵循其研究与非商业用途条款，本项目没有重新授予数据许可。

## 重建数据包

现有数据已完整保存，可直接运行。重新下载与转换需要 Python 3.10+、curl 和网络连接，脚本默认将官方原文件缓存到系统临时目录。

```sh
python3 scripts/prepare_allen_data.py --resolution 50
python3 scripts/verify_allen_data.py
```

脚本支持 25、50、100 µm 网格；提高分辨率会增加下载量和浏览器内存使用。默认采用 50 µm，成年数据的压缩二进制合计约 9.97 MiB，解压后的模板及标注合计约 55.1 MiB。

## 校验

```sh
npm test
npm run build
python3 scripts/verify_allen_data.py
```

自动测试覆盖真实体数据解码、HTTP 自动解压兼容、损坏响应、三平面方向、共同交点、坐标往返、脑区定位、父级标注、文件完整性及网格范围。交互与布局还需要真实浏览器检查。

完整浏览器回归运行 `BROWSER_CHANNEL=chrome npm run test:browser`，使用同一个 5187 本地服务并串行运行，避免多个 WebGL 测试争用资源。单项命令仍可单独执行。

## 项目结构

- `src/lib/mesh-geometry.ts`：脑区与血管共用的坐标转换和网格构建。
- `src/lib/scene-vasculature.ts`：血管显示、分类、裁切、主题与资源生命周期。
- `src/lib/use-workspace-atlas.ts` / `workspace-route.ts`：图谱加载、交点更新和 URL 状态。
- `src/lib/atlas.ts`：体数据、坐标、切片与本体逻辑。
- `src/components/BrainScene.tsx`：Three.js 三维脑、切面、环路示意与定位。
- `src/components/AtlasWorkspace.tsx`：成年与胚胎页面的共享交互。
- `src/components/SliceView.tsx`：切片与键盘、指针控制。
- `src/data/regions.ts`：65 个成年脑区说明与文献。
- `src/data/circuits.ts`：有来源和证据范围的环路关系。
- `src/data/embryo.ts`：四个胚胎阶段与发育分区说明。
- `scripts/`：可重现的数据准备和验证，共用 `data_assets.py` 的二进制编码、压缩和校验。
- `tests/atlas.test.ts`：真实数据与坐标回归测试。
