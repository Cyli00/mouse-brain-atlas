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
  type SliceRegion,
} from "../lib/slice-segmentation";
import { WHITE_MATTER_LABEL } from "../lib/white-matter";
import "./white-matter.css";
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
  apZeroUm,
  mlZeroUm,
  dvZeroUm,
  embryonic = false,
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
  apZeroUm?: number;
  mlZeroUm?: number;
  dvZeroUm?: number;
  embryonic?: boolean;
  detailed?: boolean;
  mapView?: boolean;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);
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
  const whiteRegions = useMemo(
    () => segmentation?.regions.filter((r) => r.whiteMatter) ?? [],
    [segmentation],
  );
  const greyRegions = useMemo(
    () => segmentation?.regions.filter((r) => !r.whiteMatter) ?? [],
    [segmentation],
  );
  const showWhiteMatterLegend = detailed && whiteRegions.length > 0;
  const locateRegion = (region: SliceRegion) => {
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
  };
  const renderRegion = (region: SliceRegion) => (
    <button
      type="button"
      key={region.id}
      className={region.whiteMatter ? "slice-region-white" : undefined}
      onClick={() => locateRegion(region)}
    >
      <strong>
        {region.whiteMatter ? `\u25aa ${region.acronym}` : region.acronym}
      </strong>
      <span>{region.name}</span>
    </button>
  );
  const axis = ANATOMICAL_AXES[p.axis];
  const increasing =
    p.axis === 0 && apZeroUm !== undefined ? "向前" : axis.increasing;
  const reference = coordinateReference(p.axis, apZeroUm, mlZeroUm, embryonic);
  const scale = sliceScale(width, data.spacing);
  const depthMm = coordinateMm(
    position[p.axis],
    p.axis,
    data.spacing,
    apZeroUm,
    mlZeroUm,
    dvZeroUm,
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
    touchStart.current = null;
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
          aria-label={`${p.name}定位，${ANATOMICAL_AXES.map((a, i) => `${a.abbreviation} ${coordinateMm(position[i], i, data.spacing, apZeroUm, mlZeroUm, dvZeroUm).toFixed(2)} 毫米`).join("，")}`}
          aria-describedby={instructionsId}
          title={instructions}
          onPointerDown={(e) => {
            if (e.pointerType === "touch" && !e.isPrimary && touchStart.current) touchStart.current.moved = true;
            if (!e.isPrimary || e.button !== 0) return;
            activePointer.current = e.pointerId;
            if (e.pointerType === "touch") {
              touchStart.current = { x: e.clientX, y: e.clientY, moved: false };
              return;
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            move(e);
          }}
          onPointerMove={(e) => {
            if (activePointer.current !== e.pointerId) return;
            if (touchStart.current) {
              if (Math.hypot(e.clientX - touchStart.current.x, e.clientY - touchStart.current.y) > 8)
                touchStart.current.moved = true;
              return;
            }
            move(e);
          }}
          onPointerUp={(e) => {
            if (activePointer.current !== e.pointerId) return;
            // Touch scrolls the page; only a stationary tap commits a slice position.
            const start = touchStart.current;
            if (!start || (!start.moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) <= 8)) move(e);
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
            if (activePointer.current === e.pointerId) {
              activePointer.current = null;
              touchStart.current = null;
            }
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
                {detailed && segmentation.whiteMatterPath && (
                  <path
                    className="slice-white-matter-boundary"
                    d={segmentation.whiteMatterPath}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {!embryonic && p.u === 2 && mlZeroUm !== undefined && (
                  <line
                    className="slice-midline"
                    x1={mlZeroUm / data.spacing + 0.5}
                    x2={mlZeroUm / data.spacing + 0.5}
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
                  className={`slice-region-label${label.whiteMatter ? " slice-white-matter-label" : ""}`}
                >
                  {label.text}
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
        <span className="desktop-copy">方向键定位 · Page Up / Down 换层 · Shift × 5 · Enter 居中</span>
        <span className="mobile-copy">点按图像定位 · 滑杆调整深度</span>
      </p>
      {showWhiteMatterLegend && (
        <p className="slice-white-matter-legend">
          <span className="slice-white-matter-swatch" aria-hidden="true" />
          <span>
            <strong aria-hidden="true">▪ </strong>前缀缩写与暖棕边界 =
            {WHITE_MATTER_LABEL}；其余为脑区与其他结构
          </span>
        </p>
      )}
      {expanded && segmentation && (
        <details className="slice-region-directory">
          <summary>
            本切面全部分区 · {segmentation.regions.length} 个 · 点击名称定位
          </summary>
          <div className="slice-region-list">
            {segmentation.regions.length === 0 ? (
              <p>本切面没有标注分区。</p>
            ) : detailed ? (
              <>
                {whiteRegions.length > 0 && (
                  <section
                    className="slice-region-group"
                    aria-label={WHITE_MATTER_LABEL}
                  >
                    <h4>
                      {WHITE_MATTER_LABEL} · {whiteRegions.length} 个
                    </h4>
                    {whiteRegions.map(renderRegion)}
                  </section>
                )}
                {greyRegions.length > 0 && (
                  <section
                    className="slice-region-group"
                    aria-label="脑区与其他结构"
                  >
                    <h4>脑区与其他结构 · {greyRegions.length} 个</h4>
                    {greyRegions.map(renderRegion)}
                  </section>
                )}
              </>
            ) : (
              segmentation.regions.map(renderRegion)
            )}
          </div>
        </details>
      )}
    </section>
  );
}
