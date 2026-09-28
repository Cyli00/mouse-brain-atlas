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
  apBregmaUm?: number;
  mlMidlineUm?: number;
  detailed?: boolean;
  mapView?: boolean;
  onMapView: (value: boolean) => void;
};
export function SliceDialog(props: Props) {
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
              正交切片 · {props.sourceLabel ?? "放大查看"}
            </span>
            <h2 id="slice-dialog-title">
              {props.plane ? PLANES[props.plane].name : "切片"}
            </h2>
          </div>
          <button
            className="icon-button"
            autoFocus
            aria-label="关闭放大切片"
            onClick={() => props.onPlane(null)}
          >
            <X size={20} />
          </button>
        </header>
        <div className="slice-dialog-tools">
          <div className="segmented-control" aria-label="切换放大切面">
            {PLANE_ORDER.map((name) => (
              <button
                key={name}
                aria-pressed={props.plane === name}
                onClick={() => props.onPlane(name)}
              >
                {PLANES[name].name}
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
            {props.detailed ? "边界与名称" : "脑区标注"}
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
            apBregmaUm={props.apBregmaUm}
            mlMidlineUm={props.mlMidlineUm}
            detailed={props.detailed}
            mapView={props.mapView}
          />
        )}
        <footer className="slice-dialog-footer">
          <ScanLine size={17} />
          <div>
            <span>交点所在区域</span>
            <strong>{props.probeName}</strong>
          </div>
          <span className="keyboard-hint">Esc 关闭</span>
        </footer>
      </div>
    </dialog>
  );
}
