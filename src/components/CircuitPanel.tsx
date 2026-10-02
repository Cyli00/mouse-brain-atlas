import "./circuit.css";
import { useId } from "react";
import { ArrowRight, RotateCcw, Box } from "lucide-react";
import type { BrainCircuit } from "../data/circuits";
import type { BrainRegion } from "../data/regions";
import { circuitEmphasis, CONNECTION_COLORS, CONNECTION_LABELS, sameCircuitTarget, type CircuitTarget } from "../lib/circuit-interaction";
import { Reference } from "./Reference";
import { useI18n } from "../lib/i18n";

const connectionEnglish = { excitatory: "Excitatory", inhibitory: "Inhibitory", modulatory: "Modulatory", projection: "Anatomical projection" };

export function CircuitPanel({ circuit, regions, selected, target, pinned, flow, onPreview, onSelect, onClear, onFlow, onShowModel }: {
  circuit: BrainCircuit;
  regions: BrainRegion[];
  selected: number;
  target: CircuitTarget | null;
  pinned: CircuitTarget | null;
  flow: boolean;
  onPreview: (target: CircuitTarget | null) => void;
  onSelect: (target: CircuitTarget) => void;
  onClear: () => void;
  onFlow: (enabled: boolean) => void;
  onShowModel: () => void;
}) {
  const { locale, t, text } = useI18n();
  const regionName = (region: BrainRegion) => locale === "en" ? region.englishName : region.name;
  const connectionLabel = (kind: keyof typeof CONNECTION_LABELS) => t(CONNECTION_LABELS[kind], connectionEnglish[kind]);
  const uid = useId().replace(/:/g, "");
  const byId = new Map(regions.map((r) => [r.id, r]));
  const emphasis = circuitEmphasis(circuit, target);
  const positions = new Map(circuit.nodeIds.map((id, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / circuit.nodeIds.length;
    return [id, circuit.nodeIds.length === 2 ? { x: 80 + index * 160, y: 125 } : { x: 160 + Math.sin(angle) * 105, y: 135 - Math.cos(angle) * 88 }];
  }));
  const activeEdge = target?.kind === "edge" ? circuit.edges[target.index] : undefined;
  const activeNode = target?.kind === "node" ? byId.get(target.id) : undefined;
  return (
    <article className="circuit-article" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClear(); } }}>
      <h2>{text(circuit.name)}</h2>
      <p className="circuit-subtitle">{text(circuit.subtitle)}</p>
      <div className="circuit-tools">
        <label><input type="checkbox" checked={flow} onChange={(e) => onFlow(e.target.checked)} />{t("流向动画", "Animate flow")}</label>
        <button type="button" onClick={onClear} disabled={!target && !pinned}><RotateCcw size={13} />{t("显示全环路", "Show full circuit")}</button>
      </div>
      <div className={`circuit-map${flow ? " flow-enabled" : ""}`} aria-label={t("环路关系示意图", "Circuit diagram")}>
        <svg viewBox="0 0 320 270" aria-label={t("投射连线", "Projection connections")}>
          <defs>{Object.entries(CONNECTION_COLORS).map(([kind, color]) => <marker key={kind} id={`${uid}-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill={color} /></marker>)}</defs>
          {circuit.edges.map((edge, index) => {
            const a = positions.get(edge.from)!, b = positions.get(edge.to)!;
            const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
            const pad = Math.min(0.38, 1 / Math.max(Math.abs(dx) / 47, Math.abs(dy) / 29));
            const start = { x: a.x + dx * pad, y: a.y + dy * pad }, end = { x: b.x - dx * pad, y: b.y - dy * pad };
            const path = `M${start.x},${start.y} Q${(a.x+b.x)/2-dy/length*22},${(a.y+b.y)/2+dx/length*22} ${end.x},${end.y}`;
            const relevant = emphasis.edges.has(index);
            const edgeTarget: CircuitTarget = { kind: "edge", index };
            return <g key={index} className={`circuit-map-edge${emphasis.active && relevant ? " emphasized" : ""}${!relevant ? " muted" : ""}`} style={{ "--connection-color": CONNECTION_COLORS[edge.kind] } as React.CSSProperties}>
              <path className="circuit-edge-line" d={path} markerEnd={`url(#${uid}-${edge.kind})`} />
              {emphasis.active && relevant && <path className="circuit-edge-flow" d={path} />}
              <path className="circuit-edge-hit" d={path} role="button" tabIndex={0} aria-label={t(`${byId.get(edge.from)?.acronym} 到 ${byId.get(edge.to)?.acronym}，${CONNECTION_LABELS[edge.kind]}`, `${byId.get(edge.from)?.acronym} to ${byId.get(edge.to)?.acronym}, ${connectionLabel(edge.kind)}`)} aria-pressed={sameCircuitTarget(pinned, edgeTarget)} onPointerEnter={() => onPreview(edgeTarget)} onPointerLeave={() => onPreview(null)} onFocus={() => onPreview(edgeTarget)} onBlur={() => onPreview(null)} onClick={() => onSelect(edgeTarget)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(edgeTarget); } }} />
            </g>;
          })}
        </svg>
        {circuit.nodeIds.map((id) => {
          const region = byId.get(id)!;
          const position = positions.get(id)!;
          const nodeTarget: CircuitTarget = { kind: "node", id };
          return <button key={id} type="button" className={`circuit-map-node${sameCircuitTarget(target, nodeTarget) ? " emphasized" : ""}${!emphasis.nodes.has(id) ? " muted" : ""}`} style={{ left: `${position.x / 3.2}%`, top: `${position.y / 2.7}%`, "--node-color": region.color } as React.CSSProperties} aria-label={t(`${region.name} ${region.acronym}，强调相邻通路`, `${region.englishName} ${region.acronym}, highlight adjacent pathways`)} aria-pressed={sameCircuitTarget(pinned, nodeTarget)} title={regionName(region)} onPointerEnter={() => onPreview(nodeTarget)} onPointerLeave={() => onPreview(null)} onFocus={() => onPreview(nodeTarget)} onBlur={() => onPreview(null)} onClick={() => onSelect(nodeTarget)}><strong>{region.acronym}</strong><span>{regionName(region)}</span>{selected === id && <i aria-label={t("已定位", "Located")} />}</button>;
        })}
      </div>
      <div className="circuit-kind-legend" aria-label={t("投射类型", "Projection types")}>{[...new Set(circuit.edges.map((edge) => edge.kind))].map((kind) => <span key={kind}><i style={{ backgroundColor: CONNECTION_COLORS[kind] }} />{connectionLabel(kind)}</span>)}</div>
      <p className="circuit-map-help"><span className="desktop-copy">{t("悬停预览 · 点击保持强调 · Esc 清除", "Hover to preview · Click to keep a highlight · Esc to clear")}</span><span className="mobile-copy">{t("点按节点查看关系 · “显示全环路”取消强调", "Tap a node to explore · Show full circuit to clear highlights")}</span></p>
      <div className="circuit-selection-note" aria-live="polite">
        {activeEdge ? <><strong>{byId.get(activeEdge.from)?.acronym} → {byId.get(activeEdge.to)?.acronym} · {connectionLabel(activeEdge.kind)}</strong><p>{text(activeEdge.label)}</p></> : activeNode ? <><strong>{regionName(activeNode)} · {t(`${emphasis.edges.size} 条直接联系`, `${emphasis.edges.size} direct connections`)}</strong><p>{t("突出该节点的输入与输出，其余连线淡化。", "Inputs and outputs of this node are highlighted; other connections are dimmed.")}</p></> : <p>{t("选一个节点或投射，查看它在环路中的关系。", "Select a node or projection to explore its connections.")}</p>}
      </div>
      <button type="button" className="circuit-show-model" onClick={onShowModel}><Box size={14} />{t("观察三维环路", "View 3D circuit")}<ArrowRight size={14} /></button>
      <details className="circuit-path-directory"><summary>{t("投射清单", "Projection list")} · {circuit.edges.length}</summary><div className="circuit-connection-list" aria-label={t("投射列表", "Projection list")}>
        {circuit.edges.map((edge, index) => <button key={index} type="button" aria-pressed={sameCircuitTarget(pinned, {kind:"edge", index})} onPointerEnter={() => onPreview({kind:"edge", index})} onPointerLeave={() => onPreview(null)} onFocus={() => onPreview({kind:"edge", index})} onBlur={() => onPreview(null)} onClick={() => onSelect({kind:"edge", index})}><span>{byId.get(edge.from)?.acronym} → {byId.get(edge.to)?.acronym}</span><small style={{color:CONNECTION_COLORS[edge.kind]}}>{connectionLabel(edge.kind)}</small></button>)}
      </div></details>
      <p className="circuit-schematic-note">{t("连线与流动仅示意投射方向，不表示轴突轨迹、放电、速度或强度。", "Connections and animation show projection direction only, not axon trajectories, firing, speed or strength.")}</p>
      <details className="evidence-disclosure"><summary>{t("环路解说与文献", "Circuit details and sources")} <span>{circuit.references.length}</span></summary><p className="region-summary">{text(circuit.description)}</p><p className="evidence-text">{text(circuit.evidence)}</p><ol className="references">{circuit.references.map((r, i) => <Reference key={r.url} reference={r} index={i} />)}</ol></details>
    </article>
  );
}
