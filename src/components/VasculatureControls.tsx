import { VASCULAR_PAPER, VASCULAR_SOURCE, VESSEL_GROUP_LABELS, filterVessels, type Vasculature, type VesselFilter, type VesselGroup } from "../lib/vasculature";

const VESSEL_GROUPS: VesselGroup[] = ["sinus", "artery", "vein"];

type Props = {
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  filter: VesselFilter;
  aboveOnly: boolean;
  onAboveOnly: (value: boolean) => void;
  onFilter: (value: VesselFilter) => void;
  data: Vasculature | null;
  error: string;
  onRetry: () => void;
  disabled: boolean;
};

export function VasculatureControls(p: Props) {
  const selectedVessels = p.data ? filterVessels(p.data, p.filter) : [];
  const selectedCount = selectedVessels.length.toLocaleString("zh-CN");
  const loadStatus = !p.enabled ? "MICe · 按需加载"
    : p.error ? "血管加载失败"
    : !p.data ? "正在载入血管…"
    : selectedVessels.length === 0 ? "当前类别无具名血管"
    : `${selectedCount} 项血管结构${p.aboveOnly ? " · 裁切前" : ""}`;

  return <div className="vascular-controls" data-enabled={p.enabled}>
    <div className="vascular-control-row">
      <label className="check-field vascular-toggle">
        <input type="checkbox" checked={p.enabled} disabled={p.disabled}
          onChange={(e) => p.onEnabled(e.target.checked)} aria-describedby="vascular-description" />
        血管网络
      </label>
        <label className="vascular-filter">血管类别
          <select value={p.filter} disabled={!p.enabled || p.disabled}
            onChange={(e) => p.onFilter(e.target.value as VesselFilter)}>
            <option value="all">全部主要血管</option>
            {VESSEL_GROUPS.map((group) => <option key={group} value={group}>{VESSEL_GROUP_LABELS[group]}</option>)}
          </select>
        </label>
        <label className="check-field vascular-above">
          <input type="checkbox" checked={p.aboveOnly} disabled={!p.enabled || p.disabled}
            onChange={(e) => p.onAboveOnly(e.target.checked)} />
          仅显示交点水平面以上的血管
        </label>
        <span className="vascular-load-status" role="status">
          {loadStatus}
        </span>
      <details className="vascular-source" onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.currentTarget.open = false;
          e.currentTarget.querySelector("summary")?.focus();
        }
      }}>
        <summary>来源与局限</summary>
        <div>
          <p><a href={VASCULAR_SOURCE} target="_blank" rel="noreferrer">MICe 血管图谱</a> · 单标本 · <a href={VASCULAR_PAPER} target="_blank" rel="noreferrer">原始研究</a></p>
          <p id="vascular-description">显示静脉窦、主要动脉与主要静脉，未包含完整的脑膜细小血管及桥静脉。</p>
          <p>静脉窦保留原始标签。动静脉显示较粗部分及其连接，省略细末梢与部分细小环路；简化后的断端不代表真实血管终点。</p>
          <p>跨图谱配准到 Allen CCFv3，仅用于解剖参考。单标本不能代表个体血管位置；图中空白处也可能存在血管。</p>
          {p.data && <>
            <h2>所选类别 · {selectedCount} 项血管结构</h2>
            {p.aboveOnly && <p>下列为裁切前的血管清单；三维只显示交点水平面以上的部分。</p>}
            {selectedVessels.length > 0 ? <ul className="vascular-name-list">
              {selectedVessels.map((vessel) => <li key={vessel.id}>
                <span className="vascular-swatch" data-group={vessel.group} aria-hidden="true" />
                <span>{vessel.name}</span>
                <span className="vascular-group-label">{VESSEL_GROUP_LABELS[vessel.group]}</span>
              </li>)}
            </ul> : <p>当前类别无具名血管。</p>}
          </>}
        </div>
      </details>
    </div>
    {p.enabled && <div className="vascular-context">
      <ul className="vascular-legend" aria-label="血管类别图例">
        {VESSEL_GROUPS.map((group) => <li key={group}>
          <span className="vascular-swatch" data-group={group} aria-hidden="true" />{VESSEL_GROUP_LABELS[group]}
        </li>)}
      </ul>
      <p className="vascular-note">MICe 单标本 · 动静脉省略细末梢 · 未覆盖完整脑膜血管及桥静脉{p.aboveOnly && " · 仅显示交点背侧部分，随 DV 更新"}</p>
    </div>}
    {p.error && <p className="vascular-error" role="alert">{p.error} <button className="text-button" onClick={p.onRetry}>重试血管</button></p>}
  </div>;
}
