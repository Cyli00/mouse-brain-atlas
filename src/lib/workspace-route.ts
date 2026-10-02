import { brainCircuits } from "../data/circuits";
import type { AtlasConfig } from "./atlas-config";
import type { EmbryoPartitionLevel } from "./embryo-partitions";
import type { SliceSource } from "./slice-atlas";

export function readWorkspaceRoute(
  config: Pick<AtlasConfig, "embryonic" | "regions" | "initialId">,
  search: string,
) {
  const params = new URLSearchParams(search);
  const requestedId = Number(params.get("region"));
  const circuit = config.embryonic ? undefined
    : brainCircuits.find((item) => item.id === params.get("circuit"));
  const isWhiteMatter = !config.embryonic && requestedId < 0 && params.get("slices") === "paxinos-kim";
  const selectedId = circuit
    ? circuit.nodeIds.includes(requestedId) ? requestedId : circuit.nodeIds[0]
    : isWhiteMatter || config.regions.some((region) => region.id === requestedId)
      ? requestedId : config.initialId;
  return {
    selectedId,
    circuit,
    mapView: params.get("presentation") !== "tissue",
    embryoLevel: (params.get("detail") === "major" ? "major" : "fine") as EmbryoPartitionLevel,
  };
}

export function workspaceUrl(href: string, state: {
  selected: number;
  circuitId?: string;
  embryonic: boolean;
  sliceSource: SliceSource;
  embryoLevel: EmbryoPartitionLevel;
  mapView: boolean;
}) {
  const url = new URL(href);
  url.searchParams.set("region", String(state.selected));
  if (state.circuitId) url.searchParams.set("circuit", state.circuitId);
  else url.searchParams.delete("circuit");
  if (!state.embryonic && state.sliceSource === "paxinos-kim")
    url.searchParams.set("slices", state.sliceSource);
  else url.searchParams.delete("slices");
  if (state.embryonic && state.embryoLevel === "major") url.searchParams.set("detail", "major");
  else url.searchParams.delete("detail");
  if (!state.mapView) url.searchParams.set("presentation", "tissue");
  else url.searchParams.delete("presentation");
  url.searchParams.delete("view");
  return url;
}
