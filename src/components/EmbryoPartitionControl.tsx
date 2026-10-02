import type { EmbryoPartitionLevel } from "../lib/embryo-partitions";
import { useI18n } from "../lib/i18n";

type Props = {
  level: EmbryoPartitionLevel;
  onLevel: (level: EmbryoPartitionLevel) => void;
  disabled: boolean;
};

export function EmbryoPartitionControl({ level, onLevel, disabled }: Props) {
  const { t } = useI18n();
  return (
    <label className="slice-source-field">
      <span>{t("分区层级", "Annotation level")}</span>
      <select
        aria-label={t("胚胎分区层级", "Embryonic annotation level")}
        value={level}
        disabled={disabled}
        onChange={(event) =>
          onLevel(event.target.value === "major" ? "major" : "fine")
        }
      >
        <option value="fine">{t("精细分区 · 原始标签", "Fine regions · original labels")}</option>
        <option value="major">{t("主要区室 · 合并下级", "Major divisions · grouped labels")}</option>
      </select>
    </label>
  );
}
