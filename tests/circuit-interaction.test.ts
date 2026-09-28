import assert from 'node:assert/strict';
import test from 'node:test';
import { brainCircuits } from '../src/data/circuits';
import { circuitEmphasis, sameCircuitTarget } from '../src/lib/circuit-interaction';
const circuit = brainCircuits.find(c => c.id === 'hippocampal-trisynaptic')!;
test('node emphasis includes incoming and outgoing edges but not unrelated hops', () => {
 const result = circuitEmphasis(circuit, {kind:'node',id:726});
 assert.deepEqual([...result.edges],[0,1]);
 assert.deepEqual(new Set(result.nodes),new Set([909,726,463]));
 assert.equal(result.nodes.has(382),false);
});
test('edge emphasis preserves direction and limits emphasis to its endpoints', () => {
 const result = circuitEmphasis(circuit,{kind:'edge',index:2});
 assert.deepEqual([...result.edges],[2]); assert.deepEqual([...result.nodes],[463,382]);
});
test('cleared or stale emphasis restores the whole circuit', () => {
 for(const target of [null,{kind:'node',id:-776},{kind:'edge',index:99}] as const) {
  const result=circuitEmphasis(circuit,target); assert.equal(result.active,false); assert.equal(result.edges.size,circuit.edges.length); assert.equal(result.nodes.size,circuit.nodeIds.length);
 }
 assert.equal(sameCircuitTarget({kind:'edge',index:1},{kind:'node',id:1}),false);
 assert.equal(sameCircuitTarget(null,null),true);
});
