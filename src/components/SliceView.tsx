import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Maximize2 } from "lucide-react";
import { coordinateMm, coordinateReference } from "../lib/coordinates";
import {
  PLANES,
  makeSlice,
  planePosition,
  type AtlasData,
  type PlaneName,
  type Position,
} from "../lib/atlas";
import {
  ANATOMICAL_AXES,
  centerSlicePosition,
  slicePointFromClient,
  slicePointFromKey,
  sliceScale,
} from "../lib/slice-interaction";
import {
  segmentSlice,
  segmentationImage,
  layoutSliceLabels,
} from "../lib/slice-segmentation";
export function SliceView({
  data,
  name,
  position,
  selected,
  overlay,
  contrast,
  onPosition,
  onExpand,
  expanded = false,
  apBregmaUm,
  mlMidlineUm,
  detailed = false,
  mapView = false,
}: {
  data: AtlasData;
  name: PlaneName;
  position: Position;
  selected: number;
  overlay: boolean;
  contrast: number;
  onPosition: (p: Position) => void;
  onExpand?: () => void;
  expanded?: boolean;
  apBregmaUm?: number;
  mlMidlineUm?: number;
  detailed?: boolean;
  mapView?: boolean;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const currentPosition = useRef(position);
  currentPosition.current = position;
  const instructionsId = useId();
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [zoom, setZoom] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const p = PLANES[name];
  const width = data.dimensions[p.u],
    height = data.dimensions[p.v];
  const depth = position[p.axis];
  const segmentation = useMemo(
    () => (detailed ? segmentSlice(data, name, depth) : null),
    [data, name, depth, detailed],
  );
  const displayedSize = {
    width: imageSize.width * zoom,
    height: imageSize.height * zoom,
  };
  const labels = useMemo(
    () =>
      segmentation && overlay
        ? layoutSliceLabels(
            segmentation,
            displayedSize.width,
            displayedSize.height,
          )
        : [],
    [segmentation, overlay, displayedSize.width, displayedSize.height],
  );
  const bitmapSelection = overlay ? selected : 0;
  const axis = ANATOMICAL_AXES[p.axis];
  const increasing =
    p.axis === 0 && apBregmaUm !== undefined ? "向前" : axis.increasing;
  const reference = coordinateReference(p.axis, apBregmaUm, mlMidlineUm);
  const scale = sliceScale(width, data.spacing);
  const depthMm = coordinateMm(
    position[p.axis],
    p.axis,
    data.spacing,
    apBregmaUm,
    mlMidlineUm,
  ).toFixed(2);
  const instructions =
    "点击或拖动定位交点；方向键在切面内移动，Page Up / Page Down 切换相邻切片，按住 Shift 每次移动 5 个体素，Enter 或空格将交点放到切面中央。";
  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const resize = () => {
      const style = getComputedStyle(element);
      const w =
          element.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight),
        h =
          element.clientHeight -
          parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom);
      const ratio = width / height;
      const fittedWidth = Math.max(1, Math.min(w, h * ratio));
      setImageSize({ width: fittedWidth, height: fittedWidth / ratio });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, [width, height]);
  useEffect(() => {
    // makeSlice replaces both in-plane indices for every pixel; only depth affects the bitmap.
    const slicePosition: Position = [0, 0, 0];
    slicePosition[PLANES[name].axis] = depth;
    canvas.current
      ?.getContext("2d")
      ?.putImageData(
        mapView && segmentation
          ? segmentationImage(segmentation, data)
          : makeSlice(
              data,
              name,
              slicePosition,
              bitmapSelection,
              overlay,
              contrast,
            ),
        0,
        0,
      );
  }, [
    data,
    name,
    depth,
    bitmapSelection,
    overlay,
    contrast,
    segmentation,
    mapView,
  ]);
  const move = (e: React.PointerEvent<HTMLButtonElement>) => {
    onPosition(
      slicePointFromClient(
        e,
        e.currentTarget.getBoundingClientRect(),
        name,
        currentPosition.current,
        data.dimensions,
      ),
    );
  };
  const releasePointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return (
    <section
      className={`slice-card${expanded ? " slice-card-expanded" : ""}${mapView ? " slice-card-map" : ""}`}
      style={{ "--plane-color": p.color } as React.CSSProperties}
      aria-label={`${p.name}预览`}
    >
      <div className="slice-heading">
        <h3>
          <span className="plane-dot" />
          {p.name}
          <span>{p.english}</span>
        </h3>
        <div className="slice-heading-actions">
          <span
            className="mono"
            title={`${axis.name}，${reference}；坐标增加表示${increasing}`}
          >
            {axis.abbreviation} {depthMm} <small>mm</small>
          </span>
          {onExpand && !expanded && (
            <button
              type="button"
              className="slice-expand-button"
              aria-label={`放大查看${p.name}`}
              aria-haspopup="dialog"
              title={`放大查看${p.name}`}
              onClick={onExpand}
            >
              <Maximize2 size={15} />
            </button>
          )}
        </div>
      </div>
      {expanded && detailed && (
        <div className="slice-zoom-tools">
          <span>缩放查看小分区</span>
          <div role="group" aria-label="分区图缩放">
            {[1, 2, 3, 4].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={zoom === value}
                onClick={() => setZoom(value)}
              >
                {value}×
              </button>
            ))}
          </div>
          <span>缩写自动避让，完整名称见下方列表</span>
        </div>
      )}
      <div
        ref={stage}
        className={`slice-stage${zoom > 1 ? " slice-stage-zoomed" : ""}`}
      >
        <button
          className="slice-image"
          type="button"
          style={displayedSize}
          aria-label={`${p.name}定位，${ANATOMICAL_AXES.map((a, i) => `${a.abbreviation} ${coordinateMm(position[i], i, data.spacing, apBregmaUm, mlMidlineUm).toFixed(2)} 毫米`).join("，")}`}
          aria-describedby={instructionsId}
          title={instructions}
          onPointerDown={(e) => {
            if (!e.isPrimary || e.button !== 0) return;
            activePointer.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            move(e);
          }}
          onPointerMove={(e) => {
            if (activePointer.current === e.pointerId) move(e);
          }}
          onPointerUp={(e) => {
            if (activePointer.current !== e.pointerId) return;
            move(e);
            releasePointer(e);
          }}
          onPointerCancel={releasePointer}
          onClick={(e) => {
            // A drag produces a pointer click too; only keyboard activation should center the crosshair.
            if (e.detail === 0)
              onPosition(
                centerSlicePosition(
                  name,
                  currentPosition.current,
                  data.dimensions,
                ),
              );
          }}
          onLostPointerCapture={(e) => {
            if (activePointer.current === e.pointerId)
              activePointer.current = null;
          }}
          onKeyDown={(e) => {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            const next = slicePointFromKey(
              e.key,
              e.shiftKey,
              name,
              currentPosition.current,
              data.dimensions,
            );
            if (!next) return;
            e.preventDefault();
            onPosition(next);
          }}
        >
          <canvas
            ref={canvas}
            width={width}
            height={height}
            aria-hidden="true"
          />
          {segmentation && overlay && (
            <svg
              className="slice-region-overlay"
              width={displayedSize.width}
              height={displayedSize.height}
              aria-hidden="true"
            >
              <g transform={`scale(${displayedSize.width / width})`}>
                <path
                  className="slice-region-boundaries"
                  d={segmentation.boundaryPath}
                  vectorEffect="non-scaling-stroke"
                />
                {p.u === 2 && mlMidlineUm !== undefined && (
                  <line
                    className="slice-midline"
                    x1={mlMidlineUm / data.spacing + 0.5}
                    x2={mlMidlineUm / data.spacing + 0.5}
                    y1={0}
                    y2={height}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
              {labels.map((label) => (
                <text
                  key={label.key}
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="slice-region-label"
                >
                  {label.acronym}
                </text>
              ))}
            </svg>
          )}
          <span
            className="crosshair crosshair-v"
            aria-hidden="true"
            style={{ left: `${((position[p.u] + 0.5) / width) * 100}%` }}
          />
          <span
            className="crosshair crosshair-h"
            aria-hidden="true"
            style={{ top: `${((position[p.v] + 0.5) / height) * 100}%` }}
          />
          <span
            className="crosshair-center"
            aria-hidden="true"
            style={{
              left: `${((position[p.u] + 0.5) / width) * 100}%`,
              top: `${((position[p.v] + 0.5) / height) * 100}%`,
            }}
          />
          <span
            className="scale-mark"
            style={{ width: `${scale.widthPercent}%` }}
            aria-hidden="true"
          >
            {Number(scale.lengthMm.toFixed(3))} mm
          </span>
        </button>
        <span className="orient top" aria-hidden="true">
          {p.direction[2]}
        </span>
        <span className="orient bottom" aria-hidden="true">
          {p.direction[3]}
        </span>
        <span className="orient left" aria-hidden="true">
          {p.direction[0]}
        </span>
        <span className="orient right" aria-hidden="true">
          {p.direction[1]}
        </span>
      </div>
      <label className="slice-slider">
        <span title={`${axis.name}，${reference}；${increasing}增加`}>
          {axis.abbreviation}
        </span>
        <input
          aria-label={`${p.name}深度，${axis.name}`}
          aria-valuetext={`${depthMm} 毫米，${reference}；第 ${position[p.axis] + 1} 层，共 ${data.dimensions[p.axis]} 层；坐标增加表示${increasing}`}
          type="range"
          min="0"
          max={data.dimensions[p.axis] - 1}
          value={position[p.axis]}
          onChange={(e) => {
            const next: Position = [...position];
            next[p.axis] = Number(e.target.value);
            onPosition(next);
          }}
        />
        <span>
          {position[p.axis] + 1}/{data.dimensions[p.axis]}
        </span>
      </label>
      <p
        className="slice-instructions"
        id={instructionsId}
        title={instructions}
      >
        方向键定位 · Page Up / Down 换层 · Shift × 5 · Enter 居中
      </p>
      {expanded && segmentation && (
        <details className="slice-region-directory">
          <summary>
            本切面全部分区 · {segmentation.regions.length} 个 · 点击名称定位
          </summary>
          <div className="slice-region-list">
            {segmentation.regions.length === 0 ? (
              <p>本切面没有标注分区。</p>
            ) : (
              segmentation.regions.map((region) => (
                <button
                  type="button"
                  key={region.id}
                  onClick={() => {
                    onPosition(
                      planePosition(
                        name,
                        currentPosition.current,
                        Math.floor(region.u),
                        Math.floor(region.v),
                      ),
                    );
                    const viewport = stage.current,
                      surface = canvas.current?.parentElement;
                    if (zoom > 1 && viewport && surface)
                      viewport.scrollTo({
                        left:
                          surface.offsetLeft +
                          (region.u / width) * displayedSize.width -
                          viewport.clientWidth / 2,
                        top:
                          surface.offsetTop +
                          (region.v / height) * displayedSize.height -
                          viewport.clientHeight / 2,
                        behavior: "instant",
                      });
                  }}
                >
                  <strong>{region.acronym}</strong>
                  <span>{region.name}</span>
                </button>
              ))
            )}
          </div>
        </details>
      )}
    </section>
  );
}
