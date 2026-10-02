import test from "node:test";
import assert from "node:assert/strict";
import { brainCircuits } from "../src/data/circuits";
import { brainRegions } from "../src/data/regions";
import { readWorkspaceRoute, workspaceUrl } from "../src/lib/workspace-route";

const config = { embryonic: false, regions: brainRegions, initialId: 382 };

test("workspace routes retain valid selections and separate PF and circuit identities", () => {
  assert.equal(readWorkspaceRoute(config, "?region=invalid").selectedId, 382);
  assert.equal(readWorkspaceRoute(config, "?region=-17").selectedId, 382);
  const white = readWorkspaceRoute(config, "?region=-17&slices=paxinos-kim&presentation=tissue");
  assert.equal(white.selectedId, -17);
  assert.equal(white.mapView, false);
  const circuit = brainCircuits[0];
  const route = readWorkspaceRoute(config, `?region=-17&slices=paxinos-kim&circuit=${circuit.id}`);
  assert.strictEqual(route.circuit, circuit);
  assert.equal(route.selectedId, circuit.nodeIds[0]);
  const selectedNode = circuit.nodeIds.at(-1)!;
  assert.equal(readWorkspaceRoute(config, `?region=${selectedNode}&circuit=${circuit.id}`).selectedId, selectedNode);
  const embryo = readWorkspaceRoute({ ...config, embryonic: true }, `?region=-17&circuit=${circuit.id}&detail=major`);
  assert.equal(embryo.selectedId, 382);
  assert.equal(embryo.circuit, undefined);
  assert.equal(embryo.embryoLevel, "major");
});

test("workspace URL updates preserve stage and unrelated fields while omitting defaults and stale view mode", () => {
  const base = "https://atlas.example/embryo?stage=E13.5&view=old&circuit=old&slices=paxinos-kim&detail=major&presentation=tissue&custom=keep#main";
  const defaults = { selected: 382, embryonic: false, sliceSource: "allen" as const, embryoLevel: "fine" as const, mapView: true };
  const reset = workspaceUrl(base, defaults);
  assert.equal(reset.pathname, "/embryo");
  assert.equal(reset.hash, "#main");
  assert.deepEqual([...reset.searchParams], [["stage", "E13.5"], ["custom", "keep"], ["region", "382"]]);
  const adult = workspaceUrl(base, { ...defaults, selected: -17, sliceSource: "paxinos-kim", mapView: false });
  assert.equal(adult.searchParams.get("slices"), "paxinos-kim");
  assert.equal(readWorkspaceRoute(config, adult.search).selectedId, -17);
  const embryo = workspaceUrl(base, { ...defaults, embryonic: true, sliceSource: "paxinos-kim", embryoLevel: "major" });
  assert.equal(embryo.searchParams.get("detail"), "major");
  assert.equal(embryo.searchParams.has("slices"), false);
});
