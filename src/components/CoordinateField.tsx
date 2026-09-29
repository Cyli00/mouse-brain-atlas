import { useEffect, useState } from "react";
import { snapCoordinateMm } from "../lib/coordinates";
export function CoordinateField({
  axis,
  value,
  min = 0,
  max,
  reference,
  step,
  midpointPreference = "upper",
  describedBy,
  disabled,
  onCommit,
}: {
  axis: string;
  value: number;
  min?: number;
  max: number;
  reference?: string;
  step: number;
  midpointPreference?: "lower" | "upper";
  describedBy?: string;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value.toFixed(2));
  useEffect(() => setDraft(value.toFixed(2)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(parsed)) {
      setDraft(value.toFixed(2));
      return;
    }
    const next = snapCoordinateMm(parsed, min, max, step, midpointPreference);
    setDraft(next.toFixed(2));
    onCommit(next);
  };
  return (
    <label>
      <span>{axis}</span>
      <input
        aria-label={`${axis} 坐标，毫米`}
        aria-describedby={describedBy}
        title={`${reference ? `${reference}；` : ""}${min.toFixed(2)} 至 ${max.toFixed(2)} mm，步长 ${step.toFixed(2)} mm，按 Enter 应用`}
        type="number"
        enterKeyHint="done"
        min={min}
        max={max}
        step={step}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(value.toFixed(2));
          }
        }}
      />
    </label>
  );
}
