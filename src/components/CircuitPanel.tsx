import { ArrowRight, Crosshair } from "lucide-react";
import type { BrainCircuit } from "../data/circuits";
import type { BrainRegion } from "../data/regions";
import { Reference } from "./Reference";
export const CONNECTION_COLORS = {
  excitatory: "#9e6530",
  inhibitory: "#5b6fa1",
  modulatory: "#9a5176",
  projection: "#426f69",
};
const CONNECTION_LABELS = {
  excitatory: "兴奋性",
  inhibitory: "抑制性",
  modulatory: "调节性",
  projection: "解剖投射",
};
export function CircuitPanel({
  circuit,
  regions,
  selected,
  onFocus,
}: {
  circuit: BrainCircuit;
  regions: BrainRegion[];
  selected: number;
  onFocus: (id: number) => void;
}) {
  const byId = new Map(regions.map((r) => [r.id, r]));
  return (
    <>
      <div className="detail-kicker">
        <span>神经环路</span>
        <span>CIRCUIT</span>
      </div>
      <h2>{circuit.name}</h2>
      <p className="english-name">{circuit.subtitle}</p>
      <p className="region-summary">{circuit.description}</p>
      <div className="circuit-disclaimer">
        三维连线表示文献支持的投射关系，连接区域内定位点。它们不是实测轴突轨迹，也不表示投射强度。
      </div>
      <h3 className="detail-section-heading">环路节点</h3>
      <div className="circuit-node-list">
        {circuit.nodeIds.map((id) => {
          const region = byId.get(id);
          return region ? (
            <button
              key={id}
              aria-pressed={id === selected}
              onClick={() => onFocus(id)}
            >
              <span
                className="region-dot"
                style={{ backgroundColor: region.color }}
              />
              <span>
                {region.name}
                <small>{region.acronym}</small>
              </span>
              <Crosshair size={14} />
            </button>
          ) : null;
        })}
      </div>
      <h3 className="detail-section-heading">投射方向</h3>
      <ol className="circuit-edges">
        {circuit.edges.map((edge, i) => (
          <li key={i}>
            <div>
              <button onClick={() => onFocus(edge.from)}>
                {byId.get(edge.from)?.acronym}
              </button>
              <ArrowRight
                size={15}
                style={{ color: CONNECTION_COLORS[edge.kind] }}
              />
              <button onClick={() => onFocus(edge.to)}>
                {byId.get(edge.to)?.acronym}
              </button>
              <span>{CONNECTION_LABELS[edge.kind]}</span>
            </div>
            <p>{edge.label}</p>
          </li>
        ))}
      </ol>
      <h3 className="detail-section-heading">证据与适用范围</h3>
      <p className="evidence-text">{circuit.evidence}</p>
      <div className="references-heading">
        <h3>文献支持</h3>
        <span>{circuit.references.length} 篇</span>
      </div>
      <ol className="references">
        {circuit.references.map((r, i) => (
          <Reference key={r.url} reference={r} index={i} />
        ))}
      </ol>
    </>
  );
}
