export const viewerEnglish: Record<string, string> = {
  "冠状面": "Coronal",
  "矢状面": "Sagittal",
  "水平面": "Horizontal",
  "前后轴": "Anterior–posterior axis",
  "背腹轴": "Dorsal–ventral axis",
  "左右轴": "Left–right axis",
  "向前": "anteriorly",
  "向后": "posteriorly",
  "向腹侧": "ventrally",
  "向右": "rightward",
  "头侧": "anterior",
  "尾侧": "posterior",
  "左侧": "left",
  "右侧": "right",
  "腹侧": "ventral",
  "背侧": "dorsal",
  "白质 / 纤维束": "White matter / fiber tracts",
  "投射关系示意": "Schematic projections",
  "兴奋性": "Excitatory",
  "抑制性": "Inhibitory",
  "调节性": "Modulatory",
  "解剖投射": "Anatomical projection",
  "源数据未提供名称": "Name not provided by the source",
  "标注前边界相对坐标，前正、后负": "Relative to the anterior annotation boundary; positive anteriorly, negative posteriorly",
  "标注背侧边界相对坐标，向腹侧增加；不是当前位置的脑表面深度": "Relative to the dorsal annotation boundary, increasing ventrally; this is not depth below the local brain surface",
  "标注内侧边界相对坐标，向右增加；正中线未校准": "Relative to the medial annotation boundary, increasing rightward; the midline is not calibrated",
  "脑正中线为零，左负、右正": "Zero at the brain midline; negative to the left, positive to the right",
  "Bregma 近似参考，前正、后负": "Approximate Bregma reference; positive anteriorly, negative posteriorly",
  "图谱体积原点": "Atlas volume origin",
  "CCF 体积原点": "CCF volume origin",
  "正在载入三维脑表面…": "Loading 3D brain surfaces…",
  "正在载入全脑表面…": "Loading the whole-brain surface…",
  "正在载入所选结构…": "Loading the selected structure…",
  "当前浏览器无法启用 WebGL。下方三个切片仍可使用，请尝试在支持 WebGL 的浏览器打开。": "WebGL is unavailable in this browser. The three slices below remain usable. Try opening the atlas in a browser with WebGL support.",
  "该结构暂无三维表面，可在切片中查看标注。": "A 3D surface is unavailable for this structure. Its annotation is available in the slices.",
  "正在载入环路节点…": "Loading circuit regions…",
  "缺少环路节点网格": "A circuit region mesh is missing",
  "部分环路节点未能载入，请重试。": "Some circuit regions could not be loaded. Please retry.",
  "三维图形上下文已中断，请重新载入三维视图。": "The 3D graphics context was interrupted. Reload the 3D view.",
  "网格请求已取消": "Mesh request cancelled",
  "三维网格文件不完整": "The 3D mesh file is incomplete",
  "三维网格文件长度异常": "The 3D mesh file has an invalid length",
  "三维网格坐标无效": "The 3D mesh coordinates are invalid",
  "三维网格索引无效": "The 3D mesh indices are invalid",
  "未能读取数据目录": "Could not read the dataset manifest",
  "图谱坐标定义无效": "The atlas coordinate definition is invalid",
  "胚胎图谱坐标边界无效": "The embryonic atlas coordinate boundaries are invalid",
  "脑区目录读取失败": "Could not read the region catalog",
  "体数据长度与坐标定义不匹配，请重新载入": "The volume size does not match its coordinate definition. Please reload.",
  "正交切面位置箭头": "Orthogonal slice position handles",
  "小鼠三维脑视图，点击脑区查看详情，拖动旋转，Ctrl 拖动平移，Shift 显示切面箭头，方向键旋转，Enter 查看所选脑区，F 聚焦，Home 查看全脑": "3D mouse brain. Click a region for details, drag to rotate, Ctrl-drag to pan, hold Shift for slice handles, use arrow keys to rotate, Enter for selected region details, F to focus, and Home for the whole brain.",
};

export function translateViewerText(value: string): string | undefined {
  if (Object.hasOwn(viewerEnglish, value)) return viewerEnglish[value];
  let match = /^正在载入可选脑区 (\d+) \/ (\d+)$/.exec(value);
  if (match) return `Loading available regions ${match[1]} / ${match[2]}`;
  match = /^(\d+) 个脑区表面未能载入$/.exec(value);
  if (match) return `${match[1]} region surfaces could not be loaded`;
  match = /^正在载入 (.+) μm 参考体积与脑区标注…$/.exec(value);
  if (match) return `Loading the ${match[1]} μm reference volume and region annotations…`;
  match = /^数据读取失败 \((\d+)\)$/.exec(value);
  if (match) return `Could not read data (${match[1]})`;
  match = /^(AP|DV|ML) 切面位置$/.exec(value);
  if (match) return `${match[1]} slice position`;
  match = /^(结构表面加载失败，请重试。|全脑表面加载失败：)(.*)$/.exec(value);
  if (match) {
    const prefix = match[1].startsWith("结构")
      ? "Could not load the structure surface. Please retry. "
      : "Could not load the whole-brain surface: ";
    return prefix + (translateViewerText(match[2]) ?? match[2]);
  }
  return undefined;
}
