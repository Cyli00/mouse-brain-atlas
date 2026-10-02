import { useI18n } from "../lib/i18n";

export function SlicePresentationControl({
  mapView,
  onMapView,
}: {
  mapView: boolean;
  onMapView: (value: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="slice-presentation-control"
      role="group"
      aria-label={t("切片显示方式", "Slice display mode")}
    >
      <button
        type="button"
        aria-pressed={mapView}
        onClick={() => onMapView(true)}
      >
        {t("分区图", "Regions")}
      </button>
      <button
        type="button"
        aria-pressed={!mapView}
        onClick={() => onMapView(false)}
      >
        {t("组织图", "Tissue")}
      </button>
    </div>
  );
}
