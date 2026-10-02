import { useEffect, useRef } from "react";
import { X, ScanLine } from "lucide-react";
import {
  PLANES,
  PLANE_ORDER,
  type AtlasData,
  type PlaneName,
  type Position,
} from "../lib/atlas";
import { SliceView } from "./SliceView";
import { SlicePresentationControl } from "./SlicePresentationControl";
import { useI18n } from "../lib/i18n";
type Props = {
  plane: PlaneName | null;
  onPlane: (plane: PlaneName | null) => void;
  data: AtlasData | null;
  position: Position;
  selected: number;
  overlay: boolean;
  onOverlay: (value: boolean) => void;
  contrast: number;
  onPosition: (p: Position) => void;
  probeName: string;
  sourceLabel?: string;
  partitionControl?: React.ReactNode;
  apZeroUm?: number;
  mlZeroUm?: number;
  dvZeroUm?: number;
  embryonic?: boolean;
  detailed?: boolean;
  mapView?: boolean;
  onMapView: (value: boolean) => void;
};
export function SliceDialog(props: Props) {
  const { t, text } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (props.plane && props.data) {
      if (!node.open) node.showModal();
    } else if (node.open) node.close();
  }, [props.plane, props.data]);
  return (
    <dialog
      ref={dialog}
      className="slice-dialog"
      aria-labelledby="slice-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        props.onPlane(null);
      }}
      onClose={() => props.onPlane(null)}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onPlane(null);
      }}
    >
      <div className="slice-dialog-content">
        <header className="slice-dialog-heading">
          <div>
            <span className="eyebrow">
              {t("正交切片", "Orthogonal slices")} · {props.sourceLabel ? text(props.sourceLabel) : t("放大查看", "Expanded view")}
            </span>
            <h2 id="slice-dialog-title">
              {props.plane ? text(PLANES[props.plane].name) : t("切片", "Slice")}
            </h2>
          </div>
          <button
            className="icon-button"
            autoFocus
            aria-label={t("关闭放大切片", "Close expanded slice")}
            onClick={() => props.onPlane(null)}
          >
            <X size={20} />
          </button>
        </header>
        <div className="slice-dialog-tools">
          <div className="segmented-control" aria-label={t("切换放大切面", "Choose expanded slice plane")}>
            {PLANE_ORDER.map((name) => (
              <button
                key={name}
                aria-pressed={props.plane === name}
                onClick={() => props.onPlane(name)}
              >
                {text(PLANES[name].name)}
              </button>
            ))}
          </div>
          {props.partitionControl}
          {props.detailed && (
            <SlicePresentationControl
              mapView={!!props.mapView}
              onMapView={props.onMapView}
            />
          )}
          <label className="check-field">
            <input
              type="checkbox"
              checked={props.overlay}
              onChange={(e) => props.onOverlay(e.target.checked)}
            />
            {props.detailed ? t("边界与名称", "Boundaries and names") : t("脑区标注", "Region labels")}
          </label>
        </div>
        {props.data && props.plane && (
          <SliceView
            key={props.plane}
            data={props.data}
            name={props.plane}
            position={props.position}
            selected={props.selected}
            overlay={props.overlay}
            contrast={props.contrast}
            onPosition={props.onPosition}
            expanded
            apZeroUm={props.apZeroUm}
            mlZeroUm={props.mlZeroUm}
            dvZeroUm={props.dvZeroUm}
            embryonic={props.embryonic}
            detailed={props.detailed}
            mapView={props.mapView}
          />
        )}
        <footer className="slice-dialog-footer">
          <ScanLine size={17} />
          <div>
            <span>{t("交点所在区域", "Region at crosshair")}</span>
            <strong>{text(props.probeName)}</strong>
          </div>
          <span className="keyboard-hint">{t("Esc 关闭", "Esc to close")}</span>
        </footer>
      </div>
    </dialog>
  );
}
