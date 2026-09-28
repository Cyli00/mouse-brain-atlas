import { useEffect, useState } from "react";
export function CoordinateField({
  axis,
  value,
  min = 0,
  max,
  reference,
  step,
  disabled,
  onCommit,
}: {
  axis: string;
  value: number;
  min?: number;
  max: number;
  reference?: string;
  step: number;
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
    const bounded = Math.max(min, Math.min(max, parsed));
    const next = Math.max(
      min,
      Math.min(max, min + Math.round((bounded - min) / step) * step),
    );
    setDraft(next.toFixed(2));
    onCommit(next);
  };
  return (
    <label>
      <span>{axis}</span>
      <input
        aria-label={`${axis} 坐标，毫米`}
        title={`${reference ? `${reference}；` : ""}${min.toFixed(2)} 至 ${max.toFixed(2)} mm，步长 ${step.toFixed(2)} mm，按 Enter 应用`}
        type="number"
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
