import { useEffect, useState } from "react";
import { snapCoordinateMm } from "../lib/coordinates";
import { useI18n } from "../lib/i18n";
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
  const { t, text } = useI18n();
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
        aria-label={t(`${axis} 坐标，毫米`, `${axis} coordinate, millimetres`)}
        aria-describedby={describedBy}
        title={t(`${reference ? `${reference}；` : ""}${min.toFixed(2)} 至 ${max.toFixed(2)} mm，步长 ${step.toFixed(2)} mm，按 Enter 应用`,
          `${reference ? `${text(reference)}; ` : ""}${min.toFixed(2)} to ${max.toFixed(2)} mm, step ${step.toFixed(2)} mm; press Enter to apply`)}
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
