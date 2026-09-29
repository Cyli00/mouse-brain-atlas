import { VASCULAR_PAPER, VASCULAR_SOURCE, type Vasculature, type VesselDiameter } from "../lib/vasculature";

type Props = {
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  diameter: VesselDiameter;
  aboveOnly: boolean;
  onAboveOnly: (value: boolean) => void;
  onDiameter: (value: VesselDiameter) => void;
  data: Vasculature | null;
  error: string;
  onRetry: () => void;
  disabled: boolean;
};

export function VasculatureControls(p: Props) {
  return <div className="vascular-controls" data-enabled={p.enabled}>
    <div className="vascular-control-row">
      <label className="check-field vascular-toggle">
        <input type="checkbox" checked={p.enabled} disabled={p.disabled}
          onChange={(e) => p.onEnabled(e.target.checked)} aria-describedby="vascular-description" />
        <span className="vascular-swatch" aria-hidden="true" />
        血管网络
      </label>
        <label className="vascular-filter">显示直径
          <select aria-label="血管最小源直径" value={p.diameter} disabled={!p.enabled}
            onChange={(e) => p.onDiameter(Number(e.target.value) as VesselDiameter)}>
            <option value={60}>≥ 60 μm</option><option value={48}>≥ 48 μm</option><option value={36}>≥ 36 μm</option>
          </select>
        </label>
        <label className="check-field vascular-above">
          <input type="checkbox" checked={p.aboveOnly} disabled={!p.enabled || p.disabled}
            onChange={(e) => p.onAboveOnly(e.target.checked)} />
          仅显示交点水平面以上的血管
        </label>
        <span className="vascular-load-status" role="status">
          {p.enabled ? p.error ? "血管加载失败" : p.data ? p.aboveOnly ? "显示交点水平面以上部分" : `${p.data.counts[p.diameter].toLocaleString("zh-CN")} 个血管段` : "正在载入血管…" : "成年标本 · 按需加载"}
        </span>
      <details className="vascular-source" onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.currentTarget.open = false;
          e.currentTarget.querySelector("summary")?.focus();
        }
      }}>
        <summary>来源与局限</summary>
        <div id="vascular-description">
          <p><a href={VASCULAR_SOURCE} target="_blank" rel="noreferrer">VesSAP</a> / <a href="https://github.com/jocpae/VesselGraph" target="_blank" rel="noreferrer">VesselGraph</a> · 成年 BL6J-no1 单标本 · CC BY-NC 4.0。</p>
          <p>按作者变换映射到 Allen CCFv3。连线连接实测血管节点，近似血管走向，不是管壁表面；不区分动脉、静脉。直径为配准前的源数据估计，省略小于 36 μm 的血管。</p>
          <p>仅叠加在三维视图。不能据此判断个体血管位置或规划注射路径。<a href={VASCULAR_PAPER} target="_blank" rel="noreferrer">原始研究</a></p>
        </div>
      </details>
    </div>
    {p.enabled && <p className="vascular-note">单标本血管网络图 · 脑区表面淡化显示 · 连线不表示管壁或血流方向{p.aboveOnly && " · 以上指背侧，随 DV 交点位置更新"}</p>}
    {p.error && <p className="vascular-error" role="alert">{p.error} <button className="text-button" onClick={p.onRetry}>重试血管</button></p>}
  </div>;
}
