import { useEffect, useState } from "react";
import type { AtlasData } from "./atlas";
import { loadKimAnnotation, type SliceSource } from "./slice-atlas";

export function useSliceAtlas(base: AtlasData | null, enabled: boolean) {
  const [source, setSource] = useState<SliceSource>(() =>
    enabled &&
    new URLSearchParams(location.search).get("slices") === "paxinos-kim"
      ? "paxinos-kim"
      : "allen",
  );
  const [cached, setCached] = useState<{
    base: AtlasData;
    data: AtlasData;
  } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const kim = cached?.base === base ? cached.data : null;
  useEffect(() => {
    setError("");
    if (!enabled || !base || source !== "paxinos-kim" || kim) return;
    const ctrl = new AbortController();
    loadKimAnnotation(base, ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) setCached({ base, data });
      })
      .catch((e) => {
        if (!ctrl.signal.aborted)
          setError(e instanceof Error ? e.message : "分区读取失败");
      });
    return () => ctrl.abort();
  }, [base, enabled, source, kim, attempt]);
  return {
    source,
    setSource,
    error,
    data: source === "allen" ? base : kim,
    retry: () => setAttempt((n) => n + 1),
  };
}
