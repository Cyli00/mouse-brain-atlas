import { useEffect, useState } from "react";
import { loadVasculature, type Vasculature } from "./vasculature";

export function useVasculature(enabled: boolean) {
  const [data, setData] = useState<Vasculature | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || data) return;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(new DOMException("血管数据加载超时", "TimeoutError")), 45_000);
    let active = true;
    setError("");
    loadVasculature(abort.signal).then((loaded) => {
      if (active && !abort.signal.aborted) setData(loaded);
    }).catch((e) => {
      if (active) setError(e instanceof Error ? e.message : "血管数据未能载入");
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); abort.abort(); };
  }, [enabled, data, attempt]);
  return { data: enabled ? data : null, error: enabled ? error : "", retry: () => setAttempt((n) => n + 1) };
}
