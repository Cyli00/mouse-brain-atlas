import type { BrainCircuit } from '../data/circuits';

export type CircuitTarget = { kind: 'node'; id: number } | { kind: 'edge'; index: number };
export const CONNECTION_COLORS = {
  excitatory: '#9e6530', inhibitory: '#5b6fa1', modulatory: '#9a5176', projection: '#426f69',
};
export const CONNECTION_LABELS = {
  excitatory: '兴奋性', inhibitory: '抑制性', modulatory: '调节性', projection: '解剖投射',
};
export function sameCircuitTarget(a: CircuitTarget | null, b: CircuitTarget | null) {
  return a?.kind === b?.kind && (a?.kind === 'node' ? b?.kind === 'node' && a.id === b.id : a?.kind === 'edge' ? b?.kind === 'edge' && a.index === b.index : true);
}
export function circuitEmphasis(circuit: BrainCircuit, target: CircuitTarget | null) {
  const valid = target?.kind === 'node' ? circuit.nodeIds.includes(target.id) : target?.kind === 'edge' ? !!circuit.edges[target.index] : false;
  const edges = new Set<number>();
  const nodes = new Set<number>();
  circuit.edges.forEach((edge, index) => {
    if (!valid || (target?.kind === 'edge' ? target.index === index : target?.kind === 'node' && (edge.from === target.id || edge.to === target.id))) {
      edges.add(index); nodes.add(edge.from); nodes.add(edge.to);
    }
  });
  return { nodes, edges, active: valid };
}
