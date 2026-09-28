---
version: alpha
colors:
  primary: "#256b63"
  background: "#f5f7f8"
  surface: "#ffffff"
  ink: "#243c46"
  muted: "#657780"
  border: "#dde5e7"
typography:
  display:
    fontFamily: "Georgia, Noto Serif SC, serif"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    lineHeight: "1.7"
  mono:
    fontFamily: "SFMono-Regular, Consolas, monospace"
rounded:
  control: "8px"
  panel: "14px"
spacing:
  unit: "6px"
  panel: "24px"
---

## Overview

面向中文读者的科学探索工具。参考 Neurotorium 的脑区浏览、解说与切面控制，把实际 Allen 脑数据放在第一屏。浅色实验室工作台、低饱和脑组织颜色、彩色正交切面是视觉中心。避免营销首页、装饰性数据卡和虚构脑形状。

## Colors

src/styles.css 的 :root 是运行时唯一 token 来源，以上 frontmatter 记录相同值。primary 用于选择和主要操作，surface 用于面板，ink 与 muted 用于文字。切面颜色在 src/lib/atlas.ts 的 PLANES 中定义并在 2D、3D 和滑杆间复用。Allen ontology 的脑区颜色只描述数据，不承担状态含义。

## Typography

中文采用系统黑体，英文标题少量采用 Georgia。坐标使用等宽字。正文 16px，控件 14px，次要元数据不小于 12px。中英文脑区名称并列便于文献查找。

## Layout

以三维画布为主，右侧只保留一个导览与解说面板。默认“三维探索”，可切换“正交切片”或“联动对照”；不把三个功能挤进固定屏幕高度。三维面板高 clamp(520px, 100dvh − 256px, 980px)，其中标题与操作栏约 108px；对照模式保证三维面板至少 520px，切片在其下自然延伸。展开画布时隐藏右侧面板。1050px 及以下以“脑区导览 / 观察视图 / 解说与文献”切换，导览和解说采用页面自然滚动。桌面右侧面板内部滚动，页面仍可滚动到坐标和完整对照内容。

## Elevation & Depth

白色面板和细边框定义区域，三维视图保持浅灰背景，无装饰渐变。只给浮动控件轻阴影。

## Shapes

面板 14px 圆角，控件 8px 圆角。脑表面采用 Allen 官方网格或真实脑区标注的重建曲面。

## Components

原生按钮、range、number、checkbox 保留键盘交互。SliceView 是三种切面的共享组件，CoordinateField 统一坐标输入。搜索是本地即时过滤，支持中文输入法且有清除按钮，不写入 URL。数据初次加载有状态提示，失败有重试；体数据完整后切片离线可用，尚未加载的网格仍需要本地服务器。

全局 scrollbar-color 和 WebKit fallback 统一滚动条；forced-colors 使用系统色。按钮提供 hover、focus-visible、pressed、disabled。默认不自动旋转；尊重减少动态效果偏好。三维选择有目录和坐标输入替代方式。

## Do's and Don'ts

- 保持三维切面、切片和坐标输入使用同一 voxel 状态。
- 标注真实分辨率及重采样限制，文献直接链接到原始研究。
- 不把平均自发荧光模板称为单只小鼠的原始组织切片。
- 成年 AP 使用 IBL 的 5.40 mm Bregma 近似参考，明确标记近似，不暗示已做颅骨配准。ML 以正中线为零，DV 保留 CCF 原点。

## 成年与发育图谱

页首常驻成年、胚胎两条导航。胚胎页采用同一工作区，增加四个真实发育时点的阶段导航，独立显示阶段坐标与单侧标注说明。保留原有颜色与排版。经典环路使用脑区的真实三维网格和带方向的示意连线；兴奋、抑制、调节、解剖投射以文字及颜色共同区分。65 区目录在原侧栏内滚动，搜索支持中文名称、英文名称和缩写。详细跨页面行为见 UX-CONTRACT.md。

环路关系颜色的唯一运行时来源是 CircuitPanel.tsx 的 CONNECTION_COLORS，三维箭头与文字图例复用。兴奋性 #9e6530、抑制性 #5b6fa1、调节性 #9a5176、解剖投射 #426f69；这些颜色不表示纤维束测量。

## 操作与阅读密度

页首导航为 66px，页面标题和数据规格同一行，优先给三维结构足够的可视空间。导览首页用两列解剖分类卡片，包含实际脑区颜色、名称及收录数量。进入分类或搜索后显示具体脑区卡片，点击定位并打开完整解说。分类首页省略重复的筛选和选区摘要，搜索及分类内保留筛选、结果数和选中状态。筛选接受原生操作系统 select 菜单。正文 15–16px，交互标签 13–14px，元数据至少 12px。

切片放大由共享 SliceDialog 实现，保留真实比例、解剖方向和物理标尺。原生 dialog 提供背景隔离、焦点循环及返回触发器。层级变量由 styles.css 的 --z-sticky、--z-overlay、--z-dialog 统一定义；原生弹窗进入浏览器 top layer。三维操作帮助使用非模态原生 details。

三维主操作“聚焦脑区”与全脑视角按钮位于视图下缘，切片深度和交点解说放在图像附近。选区与探针读数分开，不用交点移动隐式改写所选脑区。显示状态的恢复遵循 UX-CONTRACT.md。

切片图谱采用原生 select，在 Allen 与“Paxinos–Franklin 衍生分区 · Kim v2”间切换。选择器位于三切片上方，来源和版本说明紧邻切片；放大视图显示同一来源。Kim 分区与 Allen 共用灰度模板和交点，独立显示分区名称，不用 Allen 选区编号高亮 Kim 标签。AP 数字输入支持负数，统一由 src/lib/coordinates.ts 换算。

## 分区图与正中线

成年 ML 统一以 CCF ML 5.70 mm 的正中矢状面为零，左负、右正，胚胎保留局部原点。Kim/FP 衍生分区默认用浅色蒙版、青色边界和带白色描边的深色缩写，组织图可切换回灰度模板。边界与文字只来自真实标签。slice-segmentation.ts 负责轮廓、连通区域和内部标签锚点；SliceView 负责三切面共用的渲染。放大视图提供 1–4 倍缩放和完整分区列表。缩写按显示尺寸避让，列表不省略小区域。

## 本次布局依据

按用户指定的 HoloBrain 参考站 https://hughyau.com/brain/#lang=zh 调整信息层级。参考站交互页面加载超时，因此核对了其公开 HTML/CSS 中的大画布、单侧信息面板、卡片和移动端面板结构，没有声称完成参考站全部交互体验，也未复制其实现或科学内容。保留本项目的浅色工作台、图谱颜色和数据语义。
