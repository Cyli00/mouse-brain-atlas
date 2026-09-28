import type { EmbryoPartitionLevel } from "../lib/embryo-partitions";

type Props = {
  level: EmbryoPartitionLevel;
  onLevel: (level: EmbryoPartitionLevel) => void;
  disabled: boolean;
};

export function EmbryoPartitionControl({ level, onLevel, disabled }: Props) {
  return (
    <label className="slice-source-field">
      <span>分区层级</span>
      <select
        aria-label="胚胎分区层级"
        value={level}
        disabled={disabled}
        onChange={(event) =>
          onLevel(event.target.value === "major" ? "major" : "fine")
        }
      >
        <option value="fine">精细分区 · 原始标签</option>
        <option value="major">主要区室 · 合并下级</option>
      </select>
    </label>
  );
}
