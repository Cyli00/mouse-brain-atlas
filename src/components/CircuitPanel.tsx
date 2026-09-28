import "./circuit.css";
import { useId } from "react";
import { ArrowRight, RotateCcw, Box } from "lucide-react";
import type { BrainCircuit } from "../data/circuits";
import type { BrainRegion } from "../data/regions";
import { circuitEmphasis, CONNECTION_COLORS, CONNECTION_LABELS, sameCircuitTarget, type CircuitTarget } from "../lib/circuit-interaction";
import { Reference } from "./Reference";

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
      <h2>{circuit.name}</h2>
      <p className="circuit-subtitle">{circuit.subtitle}</p>
      <div className="circuit-tools">
        <label><input type="checkbox" checked={flow} onChange={(e) => onFlow(e.target.checked)} />流向动画</label>
        <button type="button" onClick={onClear} disabled={!target && !pinned}><RotateCcw size={13} />显示全环路</button>
      </div>
      <div className={`circuit-map${flow ? " flow-enabled" : ""}`} aria-label="环路关系示意图">
        <svg viewBox="0 0 320 270" aria-label="投射连线">
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
              <path className="circuit-edge-hit" d={path} role="button" tabIndex={0} aria-label={`${byId.get(edge.from)?.acronym} 到 ${byId.get(edge.to)?.acronym}，${CONNECTION_LABELS[edge.kind]}`} aria-pressed={sameCircuitTarget(pinned, edgeTarget)} onPointerEnter={() => onPreview(edgeTarget)} onPointerLeave={() => onPreview(null)} onFocus={() => onPreview(edgeTarget)} onBlur={() => onPreview(null)} onClick={() => onSelect(edgeTarget)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(edgeTarget); } }} />
            </g>;
          })}
        </svg>
        {circuit.nodeIds.map((id) => {
          const region = byId.get(id)!;
          const position = positions.get(id)!;
          const nodeTarget: CircuitTarget = { kind: "node", id };
          return <button key={id} type="button" className={`circuit-map-node${sameCircuitTarget(target, nodeTarget) ? " emphasized" : ""}${!emphasis.nodes.has(id) ? " muted" : ""}`} style={{ left: `${position.x / 3.2}%`, top: `${position.y / 2.7}%`, "--node-color": region.color } as React.CSSProperties} aria-label={`${region.name} ${region.acronym}，强调相邻通路`} aria-pressed={sameCircuitTarget(pinned, nodeTarget)} title={region.name} onPointerEnter={() => onPreview(nodeTarget)} onPointerLeave={() => onPreview(null)} onFocus={() => onPreview(nodeTarget)} onBlur={() => onPreview(null)} onClick={() => onSelect(nodeTarget)}><strong>{region.acronym}</strong><span>{region.name}</span>{selected === id && <i aria-label="已定位" />}</button>;
        })}
      </div>
      <div className="circuit-kind-legend" aria-label="投射类型">{[...new Set(circuit.edges.map((edge) => edge.kind))].map((kind) => <span key={kind}><i style={{ backgroundColor: CONNECTION_COLORS[kind] }} />{CONNECTION_LABELS[kind]}</span>)}</div>
      <p className="circuit-map-help">悬停预览 · 点击保持强调 · Esc 清除</p>
      <div className="circuit-selection-note" aria-live="polite">
        {activeEdge ? <><strong>{byId.get(activeEdge.from)?.acronym} → {byId.get(activeEdge.to)?.acronym} · {CONNECTION_LABELS[activeEdge.kind]}</strong><p>{activeEdge.label}</p></> : activeNode ? <><strong>{activeNode.name} · {emphasis.edges.size} 条直接联系</strong><p>突出该节点的输入与输出，其余连线淡化。</p></> : <p>选一个节点或投射，查看它在环路中的关系。</p>}
      </div>
      <button type="button" className="circuit-show-model" onClick={onShowModel}><Box size={14} />观察三维环路<ArrowRight size={14} /></button>
      <details className="circuit-path-directory"><summary>投射清单 · {circuit.edges.length}</summary><div className="circuit-connection-list" aria-label="投射列表">
        {circuit.edges.map((edge, index) => <button key={index} type="button" aria-pressed={sameCircuitTarget(pinned, {kind:"edge", index})} onPointerEnter={() => onPreview({kind:"edge", index})} onPointerLeave={() => onPreview(null)} onFocus={() => onPreview({kind:"edge", index})} onBlur={() => onPreview(null)} onClick={() => onSelect({kind:"edge", index})}><span>{byId.get(edge.from)?.acronym} → {byId.get(edge.to)?.acronym}</span><small style={{color:CONNECTION_COLORS[edge.kind]}}>{CONNECTION_LABELS[edge.kind]}</small></button>)}
      </div></details>
      <p className="circuit-schematic-note">连线与流动仅示意投射方向，不表示轴突轨迹、放电、速度或强度。</p>
      <details className="evidence-disclosure"><summary>环路解说与文献 <span>{circuit.references.length}</span></summary><p className="region-summary">{circuit.description}</p><p className="evidence-text">{circuit.evidence}</p><ol className="references">{circuit.references.map((r, i) => <Reference key={r.url} reference={r} index={i} />)}</ol></details>
    </article>
  );
}
