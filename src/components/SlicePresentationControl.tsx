export function SlicePresentationControl({
  mapView,
  onMapView,
}: {
  mapView: boolean;
  onMapView: (value: boolean) => void;
}) {
  return (
    <div
      className="slice-presentation-control"
      role="group"
      aria-label="切片显示方式"
    >
      <button
        type="button"
        aria-pressed={mapView}
        onClick={() => onMapView(true)}
      >
        分区图
      </button>
      <button
        type="button"
        aria-pressed={!mapView}
        onClick={() => onMapView(false)}
      >
        组织图
      </button>
    </div>
  );
}
