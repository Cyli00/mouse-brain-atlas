import { useCallback, useEffect, useRef, useState } from "react";
import { clampPosition, loadAtlas, type AtlasData, type Position } from "./atlas";

export function useWorkspaceAtlas(manifestUrl: string, selected: number) {
  const [data, setData] = useState<AtlasData | null>(null);
  const [position, setPosition] = useState<Position>([0, 0, 0]);
  const [loading, setLoading] = useState("正在读取图谱数据…");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    const ctrl = new AbortController();
    setError("");
    setData(null);
    loadAtlas(ctrl.signal, setLoading, manifestUrl)
      .then((atlas) => {
        if (!ctrl.signal.aborted) {
          setData(atlas);
          setPosition(atlas.meshes[String(selectedRef.current)]?.centroid ?? [0, 0, 0]);
          setLoading("");
        }
      })
      .catch((error) => {
        if (!ctrl.signal.aborted) {
          setError(error.name === "TimeoutError"
            ? "数据载入超时，请检查连接并重试。"
            : error instanceof TypeError
              ? "无法读取图谱数据，请检查本地服务和网络连接后重试。"
              : error instanceof SyntaxError
                ? "图谱数据目录格式不正确，请检查数据文件后重试。"
                : error.message);
          setLoading("");
        }
      });
    return () => ctrl.abort();
  }, [manifestUrl, attempt]);

  const move = useCallback((position: Position) => {
    if (!data) return;
    const next = clampPosition(position, data.dimensions);
    setPosition((previous) => previous.every((value, axis) => value === next[axis]) ? previous : next);
  }, [data]);
  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);
  return { data, position, setPosition, loading, error, move, retry };
}
