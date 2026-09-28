import { embryoPartitions, type EmbryoPartitionLevel } from "../lib/embryo-partitions";
import { EmbryoPartitionControl } from "./EmbryoPartitionControl";
import { sameCircuitTarget, type CircuitTarget } from "../lib/circuit-interaction";
import { getWhiteMatterRegions } from "../data/white-matter";
import { isWhiteMatterStructure } from "../lib/white-matter";
import { RegionBrowser } from "./RegionBrowser";
import { SliceDialog } from "./SliceDialog";
import {
  nearestCatalogRegion,
  displayDefaults,
  type DisplaySettings,
} from "../lib/explorer-state";
import type { AtlasConfig } from "../lib/atlas-config";
import { brainCircuits } from "../data/circuits";
import { Reference } from "./Reference";
import { CircuitPanel } from "./CircuitPanel";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  ArrowUpRight,
  Crosshair,
  BookOpen,
  Layers3,
  Database,
  Info,
  RotateCcw,
  Check,
  PanelLeft,
  Maximize2,
  Minimize2,
  Box,
  ScanLine,
  ArrowRight,
} from "lucide-react";

import {
  loadAtlas,
  structureAt,
  clampPosition,
  PLANE_ORDER,
  type PlaneName,
  type AtlasData,
  type Position,
} from "../lib/atlas";
import { BrainScene } from "./BrainScene";
import { CoordinateField } from "./CoordinateField";
import { SliceView } from "./SliceView";
import { SlicePresentationControl } from "./SlicePresentationControl";
import {
  coordinateMm,
  coordinateVoxel,
  coordinateRange,
  coordinateReference,
  BREGMA_REFERENCE_URL,
} from "../lib/coordinates";
import { useSliceAtlas } from "../lib/use-slice-atlas";
import {
  KIM_SOURCE_LABEL,
  KIM_SOURCE_URL,
  KIM_PAPER_URL,
  PAXINOS_BOOK_URL,
} from "../lib/slice-atlas";
export function AtlasWorkspace({
  config,
  stageNavigation,
}: {
  config: AtlasConfig;
  stageNavigation?: React.ReactNode;
}) {
  const baseRegions = config.regions;
  const initialParam = Number(
    new URLSearchParams(location.search).get("region"),
  );
  const initialCircuit = !config.embryonic
    ? brainCircuits.find(
        (c) => c.id === new URLSearchParams(location.search).get("circuit"),
      )
    : undefined;
  const initialId = initialCircuit
    ? initialCircuit.nodeIds.includes(initialParam)
      ? initialParam
      : initialCircuit.nodeIds[0]
    : (!config.embryonic && initialParam < 0 && new URLSearchParams(location.search).get("slices") === "paxinos-kim") || baseRegions.some((r) => r.id === initialParam)
      ? initialParam
      : config.initialId;
  const [data, setData] = useState<AtlasData | null>(null),
    [loading, setLoading] = useState("正在读取图谱数据…"),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [position, setPosition] = useState<Position>([0, 0, 0]),
    [selected, setSelected] = useState(initialId),
    [overlay, setOverlay] = useState(true),
    [showPlanes, setShowPlanes] = useState(!initialCircuit),
    [opacity, setOpacity] = useState(initialCircuit?.id ? 0.12 : 0.22),
    [contrast, setContrast] = useState(config.contrast),
    [panel, setPanel] = useState<"region" | "methods" | "circuit">(
      initialCircuit ? "circuit" : "region",
    );
  const [exploreMode, setExploreMode] = useState<"regions" | "circuits">(
    initialCircuit ? "circuits" : "regions",
  );
  const [circuitId, setCircuitId] = useState<string | null>(
    initialCircuit?.id ?? null,
  );
  const activeCircuit = !config.embryonic
    ? brainCircuits.find((c) => c.id === circuitId)
    : undefined;
  const [circuitPinned, setCircuitPinned] = useState<CircuitTarget | null>(null);
  const [circuitPreview, setCircuitPreview] = useState<CircuitTarget | null>(null);
  const [circuitFlow, setCircuitFlow] = useState(true);
  const circuitTarget = circuitPreview ?? circuitPinned;
  const clearCircuitTarget = () => { setCircuitPinned(null); setCircuitPreview(null); };
  const selectCircuitTarget = (target: CircuitTarget) => {
    setCircuitPinned((old) => sameCircuitTarget(old, target) ? null : target);
    if (target.kind === "node") focus(target.id, true, false);
  };
  const [mobilePane, setMobilePane] = useState<
    "catalog" | "viewer" | "details"
  >("viewer");
  const [inspectorView, setInspectorView] = useState<"catalog" | "details">(
    initialCircuit ? "details" : "catalog",
  );
  const [focusMode, setFocusMode] = useState(false);
  const [expandedPlane, setExpandedPlane] = useState<PlaneName | null>(null);
  const slices = useSliceAtlas(data, !config.embryonic);
  const [mapView, setMapView] = useState(() =>
    new URLSearchParams(location.search).get("presentation") !== "tissue",
  );
  const [embryoLevel, setEmbryoLevel] = useState<EmbryoPartitionLevel>(() =>
    new URLSearchParams(location.search).get("detail") === "major" ? "major" : "fine",
  );
  const embryoPartitionData = useMemo(
    () => config.embryonic && data
      ? embryoPartitions(data, new Set(baseRegions.map((r) => r.id)))
      : null,
    [config.embryonic, data, baseRegions],
  );
  const displayedSliceData = config.embryonic && embryoPartitionData
    ? embryoPartitionData[embryoLevel]
    : slices.data;
  const whiteMatterData = !config.embryonic && slices.source === "paxinos-kim" ? slices.data : null;
  const whiteRegions = useMemo(() => whiteMatterData ? getWhiteMatterRegions(whiteMatterData) : [], [whiteMatterData]);
  const brainRegions = useMemo(() => [...baseRegions, ...whiteRegions], [baseRegions, whiteRegions]);
  const whiteSelected = selected < 0;
  const restoreWhitePosition = useRef(initialId < 0);
  useEffect(() => {
    if (!whiteSelected || !whiteMatterData) return;
    if (!whiteRegions.some((r) => r.id === selected)) {
      setSelected(config.initialId);
      return;
    }
    if (restoreWhitePosition.current) {
      const target = whiteMatterData.meshes[String(-selected)]?.centroid;
      if (target) setPosition(target);
      restoreWhitePosition.current = false;
    }
  }, [whiteMatterData, whiteRegions, whiteSelected, selected, config.initialId]);
  const allenLabelCount = useMemo(() => {
    if (config.embryonic || !data) return 0;
    const ids = new Set(data.annotation);
    ids.delete(0);
    return ids.size;
  }, [config.embryonic, data]);
  const sliceSourceLabel = config.embryonic
    ? `Allen 发育图谱 · ${config.id} · ${embryoLevel === "fine" ? "精细分区" : "主要区室"}`
    : slices.source === "allen"
      ? "Allen Institute · CCFv3"
      : KIM_SOURCE_LABEL;
  const sliceStructure = displayedSliceData
    ? structureAt(displayedSliceData, position)
    : undefined;
  const sliceProbeName = sliceStructure
    ? `${sliceStructure.acronym} · ${sliceStructure.name}`
    : "未标注位置";
  const regionDisplay = useRef<DisplaySettings>(displayDefaults(false));
  const workspace = useRef<HTMLElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const search = useRef<HTMLInputElement>(null);
  const detailContent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (detailContent.current) detailContent.current.scrollTop = 0;
  }, [circuitId, panel]);
  useEffect(() => {
    if (panel === "region" && detailContent.current)
      detailContent.current.scrollTop = 0;
  }, [selected, panel]);
  const region = brainRegions.find((r) => r.id === selected) ?? baseRegions.find((r) => r.id === config.initialId)!;
  useEffect(() => {
    const ctrl = new AbortController();
    setError("");
    setData(null);
    loadAtlas(ctrl.signal, setLoading, config.manifestUrl)
      .then((atlas) => {
        if (!ctrl.signal.aborted) {
          setData(atlas);
          setPosition(
            atlas.meshes[String(selectedRef.current)]?.centroid ?? [0, 0, 0],
          );
          setLoading("");
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) {
          setError(
            e.name === "TimeoutError"
              ? "数据载入超时，请检查连接并重试。"
              : e instanceof TypeError
                ? "无法读取图谱数据，请检查本地服务和网络连接后重试。"
                : e instanceof SyntaxError
                  ? "图谱数据目录格式不正确，请检查数据文件后重试。"
                  : e.message,
          );
          setLoading("");
        }
      });
    return () => ctrl.abort();
  }, [attempt]);
  useEffect(() => {
    document.title = `${region.name} · ${config.title}`;
    const url = new URL(location.href);
    url.searchParams.set("region", String(selected));
    if (activeCircuit) url.searchParams.set("circuit", activeCircuit.id);
    else url.searchParams.delete("circuit");
    if (!config.embryonic && slices.source === "paxinos-kim")
      url.searchParams.set("slices", slices.source);
    else url.searchParams.delete("slices");
    if (config.embryonic && embryoLevel === "major")
      url.searchParams.set("detail", "major");
    else url.searchParams.delete("detail");
    if (!mapView)
      url.searchParams.set("presentation", "tissue");
    else url.searchParams.delete("presentation");
    url.searchParams.delete("view");
    history.replaceState(null, "", url);
  }, [region, selected, activeCircuit, slices.source, embryoLevel, mapView]);
  const whiteProbe = whiteMatterData && isWhiteMatterStructure(sliceStructure) ? sliceStructure : undefined;
  const currentStructure = whiteProbe ?? (data ? structureAt(data, position) : undefined);
  const catalogIds = useMemo(
    () => new Set(brainRegions.map((r) => r.id)),
    [brainRegions],
  );
  const probeId = whiteProbe ? -whiteProbe.id : nearestCatalogRegion(
    currentStructure?.structure_id_path,
    catalogIds,
  );
  const probeRegion = brainRegions.find((r) => r.id === probeId);
  const probeName = currentStructure
    ? `${currentStructure.acronym} · ${currentStructure.name}`
    : "未标注位置";
  const showMobilePane = (pane: "catalog" | "viewer" | "details") => {
    setMobilePane(pane);
    if (pane === "catalog" || pane === "details") {
      setInspectorView(pane);
      setFocusMode(false);
    }
    if (matchMedia("(max-width: 1050px)").matches)
      requestAnimationFrame(() =>
        workspace.current?.scrollIntoView({
          block: "start",
          behavior: "instant",
        }),
      );
  };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key !== "/" ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target.closest(
          "input,textarea,select,[contenteditable=true],dialog[open]",
        )
      )
        return;
      event.preventDefault();
      if (exploreMode !== "regions") changeMode("regions");
      showMobilePane("catalog");
      requestAnimationFrame(() => search.current?.focus());
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [exploreMode]);
  const move = (p: Position) => {
    if (data) {
      const next = clampPosition(p, data.dimensions);
      setPosition((previous) =>
        previous.every((value, i) => value === next[i]) ? previous : next,
      );
    }
  };
  const focus = (id: number, keepCircuit = false, navigate = true) => {
    setSelected(id);
    if (!keepCircuit) setPanel("region");
    const target = id < 0 ? whiteMatterData?.meshes[String(-id)]?.centroid : data?.meshes[String(id)]?.centroid;
    if (target && data) setPosition(clampPosition(target, data.dimensions));
    if (navigate) showMobilePane("viewer");
  };
  const openCircuit = (id: string, navigate = true) => {
    const circuit = brainCircuits.find((c) => c.id === id);
    if (!circuit) return;
    if (!activeCircuit) regionDisplay.current = { opacity, showPlanes };
    setExploreMode("circuits");
    clearCircuitTarget();
    setCircuitId(id);
    focus(circuit.nodeIds[0], true, navigate);
    setPanel("circuit");
    setShowPlanes(false);
    setOpacity(0.12);
  };
  const changeMode = (mode: "regions" | "circuits") => {
    if (mode === exploreMode) {
      if (mode === "circuits") setPanel("circuit");
      return;
    }
    if (mode === "circuits") {
      if (activeCircuit) setPanel("circuit");
      else openCircuit(brainCircuits[0].id, false);
    } else {
      clearCircuitTarget();
      setCircuitId(null);
      setExploreMode("regions");
      setPanel("region");
      setOpacity(regionDisplay.current.opacity);
      setShowPlanes(regionDisplay.current.showPlanes);
    }
  };
  const inspectProbe = () => {
    if (!probeId) return;
    if (activeCircuit) changeMode("regions");
    setSelected(probeId);
    setPanel("region");
    showMobilePane("details");
  };
  const focusDetails = () => requestAnimationFrame(() => detailContent.current?.focus({ preventScroll: true }));
  const readPanel = (next: "region" | "methods" | "circuit") => {
    setPanel(next);
    focusDetails();
  };
  const restoreDisplay = () => {
    const settings = displayDefaults(!!activeCircuit);
    setOpacity(settings.opacity);
    setShowPlanes(settings.showPlanes);
    setOverlay(true);
    setContrast(config.contrast);
  };
  return (
    <div
      className={`app-shell ${config.embryonic ? "embryo-atlas" : "adult-atlas"}`}
    >
      <header className="masthead">
        <a href="#main" className="brand">
          <span className="brand-mark">
            <Brain size={26} strokeWidth={1.35} />
          </span>
          <span className="brand-word">
            murine<span>小鼠脑图谱</span>
          </span>
        </a>
        <nav className="atlas-navigation" aria-label="图谱页面">
          <a href="/" aria-current={!config.embryonic ? "page" : undefined}>
            成年小鼠
          </a>
          <a
            href="/embryo"
            aria-current={config.embryonic ? "page" : undefined}
          >
            胚胎小鼠<span>发育图谱</span>
          </a>
        </nav>
        <a
          className="source-link"
          href={config.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Allen Institute 数据
          <ArrowUpRight size={15} />
        </a>
      </header>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {config.embryonic
              ? "DEVELOPING MOUSE BRAIN ATLAS"
              : "ADULT MOUSE BRAIN ATLAS"}
          </span>
          <h1>{config.title}</h1>
        </div>
        <span className="dataset-badge">
          <Database size={14} /> {config.badge}{" "}
          <span className="badge-divider" />{" "}
          <span className="resolution-badge">
            {data?.spacing ?? config.resolutionUm} μm
            {config.embryonic ? " 重采样" : " 体素"}
          </span>
        </span>
      </div>
      {stageNavigation}
      {config.embryonic && (
        <div className="atlas-notice">
          <Info size={16} />
          <span>{config.description}</span>
        </div>
      )}
      <nav className="mobile-workspace-nav" aria-label="工作区导航">
        <button
          aria-pressed={mobilePane === "catalog"}
          onClick={() => showMobilePane("catalog")}
        >
          <PanelLeft size={17} />
          脑区导览
        </button>
        <button
          aria-pressed={mobilePane === "viewer"}
          onClick={() => showMobilePane("viewer")}
        >
          <Box size={17} />
          观察视图
        </button>
        <button
          aria-pressed={mobilePane === "details"}
          onClick={() => showMobilePane("details")}
        >
          <BookOpen size={17} />
          解说与文献
        </button>
      </nav>
      <main
        ref={workspace}
        id="main"
        className="workspace"
        data-mobile-pane={mobilePane}
        data-focus={focusMode}
        data-inspector={inspectorView}
      >
        <div className="visual-column">
          <div className="workspace-toolbar">
            <span className="workspace-view-label"><Layers3 size={16} />联动对照</span>
            <button
              className="workspace-focus-toggle"
              type="button"
              aria-pressed={focusMode}
              onClick={() => setFocusMode(!focusMode)}
            >
              {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {focusMode ? "显示导览" : "展开画布"}
            </button>
          </div>
          <section
            className="viewer-panel"
            aria-label="三维图谱"
          >
            <div className="viewer-heading">
              <div className="selected-name">
                <span
                  className="region-dot"
                  style={{ backgroundColor: region.color }}
                />
                <div className="selected-copy">
                  <strong>{whiteSelected && !whiteMatterData ? "正在载入 PF 白质…" : region.name}</strong>
                  <span>{whiteSelected && !whiteMatterData ? "PF / Kim v2" : region.englishName}</span>
                </div>
                <span className="selected-acronym">{whiteSelected && !whiteMatterData ? Math.abs(selected) : region.acronym}</span>
              </div>
              <button
                className="text-button"
                disabled={!data}
                onClick={() => {
                  focus(selected, !!activeCircuit);
                  document.getElementById("linked-slices")?.scrollIntoView({ block: "start", behavior: "instant" });
                }}
              >
                <Crosshair size={15} />
                定位切片
              </button>
            </div>
            {data ? (
              <BrainScene
                data={data}
                position={position}
                selected={selected}
                color={region.color}
                opacity={opacity}
                showPlanes={showPlanes}
                overlay={overlay}
                contrast={contrast}
                onPosition={move}
                circuit={activeCircuit}
                circuitTarget={circuitTarget}
                circuitFlow={circuitFlow}
                onCircuitPreview={setCircuitPreview}
                onCircuitSelect={selectCircuitTarget}
                onCircuitClear={clearCircuitTarget}
                regions={brainRegions}
                datasetLabel={whiteSelected ? "PF · Kim v2 白质" : config.badge}
                whiteMatterData={whiteMatterData}
                sliceData={config.embryonic ? displayedSliceData : whiteMatterData}

              />
            ) : (
              <div className="viewer-loading" role={error ? "alert" : "status"}>
                {error ? (
                  <>
                    <Info size={28} />
                    <h2>图谱未能载入</h2>
                    <p>{error}</p>
                    <button
                      className="primary-button"
                      onClick={() => setAttempt((n) => n + 1)}
                    >
                      重新载入数据
                    </button>
                  </>
                ) : (
                  <>
                    <span className="loader" />
                    <h2>正在准备小鼠脑图谱</h2>
                    <p>{loading}</p>
                    <small>
                      正在载入本阶段的参考体积与标注。数据来自 Allen Institute。
                    </small>
                  </>
                )}
              </div>
            )}
            <div className="viewer-controls">
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={showPlanes}
                  onChange={(e) => setShowPlanes(e.target.checked)}
                  disabled={!data}
                />
                <Layers3 size={15} />
                <span>显示切面</span>
              </label>
              <div className="opacity-field">
                <label htmlFor="opacity">不透明度</label>
                <input
                  id="opacity"
                  aria-label="脑表面不透明度"
                  type="range"
                  min=".05"
                  max=".8"
                  step=".01"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  disabled={!data}
                />
                <span>{Math.round(opacity * 100)}%</span>
              </div>
              <button
                className="text-button reset-button"
                disabled={!data}
                onClick={restoreDisplay}
              >
                <RotateCcw size={14} />
                恢复显示
              </button>
            </div>
          </section>
          <section
            id="linked-slices"
            className="slices-section"
            aria-label="三向切片"
          >
            <div className="section-heading">
              <h2>
                <ScanLine size={16} />
                正交切片<span>点击定位 · 放大查看细节</span>
              </h2>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={overlay}
                  onChange={(e) => setOverlay(e.target.checked)}
                  disabled={!slices.data}
                />
                边界与名称
              </label>
            </div>
            <div className="slice-source-bar">
              {config.embryonic ? (
                <EmbryoPartitionControl
                  level={embryoLevel}
                  onLevel={setEmbryoLevel}
                  disabled={!data}
                />
              ) : (
                <label className="slice-source-field">
                  <span>切片图谱</span>
                  <select
                    aria-label="切片图谱"
                    value={slices.source}
                    onChange={(e) => {
                      if (whiteSelected) setSelected(config.initialId);
                      slices.setSource(
                        e.target.value === "paxinos-kim"
                          ? "paxinos-kim"
                          : "allen",
                      );
                    }}
                  >
                    <option value="allen">Allen Institute · CCFv3</option>
                    <option value="paxinos-kim">{KIM_SOURCE_LABEL}</option>
                  </select>
                </label>
              )}
              <SlicePresentationControl
                mapView={mapView}
                onMapView={setMapView}
              />
              <span className="slice-coordinate-note">
                {config.embryonic
                  ? `Allen 发育图谱 · ${config.id}`
                  : "AP · Bregma 近似参考 / ML · 正中线"}
              </span>
            </div>
            <div className="slice-grid">
              {displayedSliceData
                ? PLANE_ORDER.map((name) => (
                    <SliceView
                      key={name}
                      data={displayedSliceData!}
                      name={name}
                      position={position}
                      selected={slices.source === "allen" ? selected : whiteSelected ? -selected : 0}
                      overlay={overlay}
                      contrast={contrast}
                      onPosition={move}
                      onExpand={() => setExpandedPlane(name)}
                      apBregmaUm={config.apBregmaUm}
                      mlMidlineUm={config.mlMidlineUm}
                      detailed
                      mapView={mapView}
                    />
                  ))
                : PLANE_ORDER.map((name) => (
                    <div key={name} className="slice-placeholder">
                      {slices.error
                        ? "切片图谱未载入"
                        : data
                          ? "正在载入分区…"
                          : "等待体数据载入"}
                    </div>
                  ))}
            </div>
            {!config.embryonic && slices.source === "allen" && data && (
              <div className="slice-source-detail">
                <p>Allen CCFv3 · {allenLabelCount} 个原始分区标签，含皮层分层。导览与三维表面展示 {baseRegions.length} 个精选脑区。</p>
              </div>
            )}
            {config.embryonic && (
              <div className="slice-source-detail embryo-partition-note">
                <p>{embryoPartitionData ? `${embryoLevel === "fine" ? embryoPartitionData.fineCount : embryoPartitionData.majorCount} 个${embryoLevel === "fine" ? "原始分区标签" : "区室及保留标签"}` : "正在载入发育分区…"} · 三维显示主要区室，细分边界见切片。</p>
                <p>{config.id === "E18.5" ? "E18.5 原始标注较粗，不代表脑区减少。" : "分区按发育本体命名，不能直接等同于成年核团。"}单侧标注；40 μm 为重采样间距。</p>
              </div>
            )}
            {slices.source === "paxinos-kim" && (
              <div className="slice-source-detail">
                <p>
                  Kim v2 · 2024 修订，源自 FP 第 3 / 4 版分区，非第 5
                  版原图。白质表面由同一 PF 标签体积重建；脑区表面与环路仍使用 Allen。
                </p>
                <p className="slice-source-probe" aria-live="polite">
                  {slices.error ? (
                    <>
                      <span role="alert">分区加载失败：{slices.error}</span>{" "}
                      <button className="text-button" onClick={slices.retry}>
                        重试分区
                      </button>
                    </>
                  ) : slices.data ? (
                    <>
                      PF 交点：<strong>{sliceProbeName}</strong>{whiteProbe && <span className="category-tag">白质 / 纤维束</span>}
                      {whiteProbe && <button className="text-button" onClick={inspectProbe}>查看白质解说</button>}
                    </>
                  ) : (
                    <span role="status">正在读取 Paxinos–Franklin 分区…</span>
                  )}
                </p>
              </div>
            )}
            <div className="slice-contrast">
              <span>
                {mapView
                  ? "标签体积重切 · 放大可缩放并查全部分区"
                  : `${config.templateLabel} · 点击切片移动交叉线`}
              </span>
              <label>
                灰度窗宽
                <input
                  type="range"
                  min={config.embryonic ? 60 : 150}
                  max={config.maxContrast}
                  step="1"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  aria-label="切片灰度窗宽"
                  disabled={!slices.data || mapView}
                />
              </label>
            </div>
          </section>
          <section
            className="coordinate-bar"
            aria-label={config.coordinateLabel}
          >
            <div className="coordinate-title">
              <Crosshair size={17} />
              <div>
                {config.coordinateLabel}
                <small>
                  {config.apBregmaUm !== undefined
                    ? "mm · ML 左负右正 / DV 为 CCF"
                    : "mm · 阶段体积原点"}
                </small>
              </div>
            </div>
            <div className="coordinate-fields">
              {["AP", "DV", "ML"].map((axis, i) => (
                <CoordinateField
                  key={axis}
                  axis={axis}
                  value={coordinateMm(
                    position[i],
                    i,
                    data?.spacing ?? config.resolutionUm,
                    config.apBregmaUm,
                    config.mlMidlineUm,
                  )}
                  {...coordinateRange(
                    data?.dimensions[i] ?? 1,
                    i,
                    data?.spacing ?? config.resolutionUm,
                    config.apBregmaUm,
                    config.mlMidlineUm,
                  )}
                  reference={coordinateReference(
                    i,
                    config.apBregmaUm,
                    config.mlMidlineUm,
                  )}
                  step={data ? data.spacing / 1000 : config.resolutionUm / 1000}
                  disabled={!data}
                  onCommit={(value) => {
                    if (data) {
                      const next: Position = [...position];
                      next[i] = coordinateVoxel(
                        value,
                        i,
                        data.spacing,
                        config.apBregmaUm,
                        config.mlMidlineUm,
                      );
                      move(next);
                    }
                  }}
                />
              ))}
            </div>
            <div className="current-structure">
              <span>
                {whiteProbe ? "PF 交点白质结构" : config.embryonic ? "交点所在区域" : "Allen 交点所在区域"}
              </span>
              <strong>
                {config.embryonic || slices.source === "allen"
                  ? sliceProbeName
                  : probeRegion
                    ? `${probeRegion.name} · ${currentStructure?.acronym}`
                    : probeName}
              </strong>
            </div>
            <button
              className="probe-inspect-button"
              disabled={!probeRegion}
              onClick={inspectProbe}
              title={
                probeRegion
                  ? `查看${probeRegion.name}的解说`
                  : "该位置没有已收录的脑区解说"
              }
            >
              <BookOpen size={15} />
              <span>查看解说</span>
              <ArrowRight size={13} />
            </button>
          </section>
        </div>
        <aside className="inspector-panel" aria-label="导览与解说">
          <div
            className="inspector-navigation"
            role="group"
            aria-label="侧栏内容"
          >
            <button
              type="button"
              aria-pressed={inspectorView === "catalog"}
              onClick={() => {
                setInspectorView("catalog");
                setMobilePane("catalog");
              }}
            >
              <PanelLeft size={16} />
              脑区导览
            </button>
            <button
              type="button"
              aria-pressed={inspectorView === "details"}
              onClick={() => {
                setInspectorView("details");
                setMobilePane("details");
              }}
            >
              <BookOpen size={16} />
              解说与文献
            </button>
          </div>
          <section
            className="region-sidebar"
            aria-label="脑区目录"
            hidden={inspectorView !== "catalog"}
          >
            <RegionBrowser
              regions={brainRegions}
              selected={selected}
              embryonic={config.embryonic}
              mode={exploreMode}
              onModeChange={changeMode}
              activeCircuitId={activeCircuit?.id}
              onSelect={(id) => {
                focus(id);
                setInspectorView("details");
                if (matchMedia("(min-width: 1051px)").matches) focusDetails();
              }}
              onCircuitSelect={(id) => {
                openCircuit(id);
                setInspectorView("details");
                if (matchMedia("(min-width: 1051px)").matches) focusDetails();
              }}
              searchInputRef={search}
            />
            {!config.embryonic && slices.source === "allen" && (
              <button className="catalog-source-action" onClick={() => slices.setSource("paxinos-kim")}>浏览 PF 白质结构 <ArrowRight size={14} /></button>
            )}
            {!config.embryonic && slices.source === "paxinos-kim" && !whiteMatterData && (
              <div className="catalog-load-state" role={slices.error ? "alert" : "status"}>
                {slices.error ? <>PF 白质未载入 <button onClick={slices.retry}>重试</button></> : "正在载入 PF 白质…"}
              </div>
            )}
          </section>
          <section
            className="detail-panel"
            aria-label="脑区信息"
            hidden={inspectorView !== "details"}
          >
            {panel === "methods" ? (
              <button className="detail-back-button" onClick={() => readPanel(activeCircuit ? "circuit" : "region")}>← 返回解说</button>
            ) : activeCircuit ? (
              <div className="detail-tabs">
                <button aria-pressed={panel === "circuit"} onClick={() => setPanel("circuit")}>环路</button>
                <button aria-pressed={panel === "region"} onClick={() => setPanel("region")}>所选结构</button>
              </div>
            ) : null}
            <div ref={detailContent} className="detail-content" tabIndex={-1}>
              {panel === "circuit" && activeCircuit ? (
                <CircuitPanel
                  circuit={activeCircuit}
                  regions={brainRegions}
                  selected={selected}
                  target={circuitTarget}
                  pinned={circuitPinned}
                  flow={circuitFlow}
                  onPreview={setCircuitPreview}
                  onSelect={selectCircuitTarget}
                  onClear={clearCircuitTarget}
                  onFlow={setCircuitFlow}
                  onShowModel={() => {
                    showMobilePane("viewer");
                    document.querySelector(".viewer-panel")?.scrollIntoView({ block: "start", behavior: "instant" });
                  }}
                />
              ) : panel === "region" && whiteSelected && !whiteMatterData ? (
                <p role={slices.error ? "alert" : "status"}>{slices.error ? `PF 白质解说未载入：${slices.error}` : "正在载入 PF 白质解说…"}</p>
              ) : panel === "region" ? (
                <article className="region-article" key={region.id}>
                  <div className="region-article-meta">
                    <span className="region-dot" style={{ backgroundColor: region.color }} />
                    <span>{region.category}</span>
                    <span className="region-article-acronym">{region.acronym}</span>
                  </div>
                  <h2>{region.name}</h2>
                  <p className="english-name">{region.englishName}</p>
                  <p className="region-summary">{region.summary}</p>
                  <section className="region-function" aria-label={config.embryonic ? "发育解剖" : "主要功能"}>
                    <h3>{config.embryonic ? "发育解剖" : "主要功能"}</h3>
                    <p>{region.function}</p>
                  </section>
                  <details className="evidence-disclosure">
                    <summary>证据与文献 <span>{region.references.length}</span></summary>
                    <p className="evidence-text">{region.evidence}</p>
                    <ol className="references">
                      {region.references.map((r, i) => <Reference key={r.url} reference={r} index={i} />)}
                    </ol>
                    <div className="region-source-meta">
                      <span>{whiteSelected ? "PF / Kim" : "Allen"} ID {Math.abs(region.id)}</span>
                      <a href={whiteSelected ? KIM_SOURCE_URL : config.embryonic ? config.annotationUrl : `https://atlas.brain-map.org/atlas?atlas=1&structure=${region.id}`} target="_blank" rel="noreferrer">原始图谱 <ArrowUpRight size={13} /></a>
                    </div>
                  </details>
                </article>
              ) : (
                <>
                  <div className="detail-kicker">
                    <Database size={17} />
                    <span>DATA & METHODS</span>
                  </div>
                  <h2>
                    {config.embryonic ? "阶段数据与参考坐标" : "数据与坐标参考"}
                  </h2>
                  <p className="region-summary">{config.description}</p>
                  <dl className="data-facts">
                    <div>
                      <dt>体素间距</dt>
                      <dd>
                        {data?.spacing ?? config.resolutionUm} ×{" "}
                        {data?.spacing ?? config.resolutionUm} ×{" "}
                        {data?.spacing ?? config.resolutionUm} μm
                      </dd>
                    </div>
                    <div>
                      <dt>体数据尺寸</dt>
                      <dd>{data?.dimensions.join(" × ") ?? "载入后显示"}</dd>
                    </div>
                    <div>
                      <dt>坐标轴顺序</dt>
                      <dd>AP / DV / ML</dd>
                    </div>
                    <div>
                      <dt>正方向</dt>
                      <dd>
                        {config.apBregmaUm !== undefined
                          ? "前 / 腹侧 / 右"
                          : "后 / 腹侧 / 右"}
                      </dd>
                    </div>
                  </dl>
                  <h3 className="detail-section-heading">切片从哪里来</h3>
                  <p className="evidence-text">{config.sliceNote}</p>
                  <h3 className="detail-section-heading">坐标与精度</h3>
                  <p className="evidence-text">{config.coordinateNote}</p>
                  {!config.embryonic && (
                    <>
                      <a
                        className="text-button"
                        href={BREGMA_REFERENCE_URL}
                        target="_blank"
                        rel="noreferrer"
                      >
                        IBL 的 Bregma 参考定义 <ArrowUpRight size={14} />
                      </a>
                      <h3 className="detail-section-heading">
                        Paxinos–Franklin 切片选项
                      </h3>
                      <p className="evidence-text">
                        分区图从标签体积生成浅色蒙版、边界和缩写，放大后可缩放、查看完整分区列表并定位。组织图使用同一
                        Allen 平均模板。采用 Chon 等人的 Unified Mouse Brain
                        Atlas，使用作者 2024 年 Kim v2 修订数据。其分区源自 FP
                        第 3 版，并纳入第 4 版更新；它不是第 5
                        版书籍的数字复刻。源数据的 20 μm
                        网格由形状插值得到，本页按最近邻采样至 50
                        μm，不增加解剖精度。白质目录、切片与三维表面均来自 Kim 标签，独立保存编号。白质表面只表示标注范围，不表示单根轴突、连接方向或纤维追踪结果。
                      </p>
                      <div className="method-links">
                        <a
                          href={KIM_PAPER_URL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Chon 等，2019 · 图谱论文 <ArrowUpRight size={14} />
                        </a>
                        <a
                          href={KIM_SOURCE_URL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Kim v2 数据 · CC BY 4.0 <ArrowUpRight size={14} />
                        </a>
                        <a
                          href="https://creativecommons.org/licenses/by/4.0/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Kim 数据许可
                        </a>
                        <a
                          href={PAXINOS_BOOK_URL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Paxinos & Franklin 第 5 版 · 2019{" "}
                          <ArrowUpRight size={14} />
                        </a>
                        <a
                          href="/data/kim-v2/manifest.json"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Kim 数据转换与校验值
                        </a>
                      </div>
                    </>
                  )}
                  <h3 className="detail-section-heading">脑区定位</h3>
                  <p className="evidence-text">{config.focusNote}</p>
                  <h3 className="detail-section-heading">数据使用</h3>
                  <p className="evidence-text">
                    Allen 模板、原始标注与网格遵循 Allen Institute 使用条款。
                    {!config.embryonic &&
                      "Kim v2 标注采用 CC BY 4.0，作者、论文、许可和本页转换方法列于上方。"}
                    本项目不改变原始数据许可。
                  </p>
                  <h3 className="detail-section-heading">图谱论文</h3>
                  <ol className="references">
                    {config.references.map((r, i) => (
                      <Reference key={r.url} reference={r} index={i} />
                    ))}
                  </ol>
                  <div className="method-links">
                    <a href={config.sourceUrl} target="_blank" rel="noreferrer">
                      Allen 体数据说明
                      <ArrowUpRight size={14} />
                    </a>
                    <a
                      href="https://alleninstitute.org/legal/terms-of-use"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Allen Institute 使用条款
                      <ArrowUpRight size={14} />
                    </a>
                    <a
                      href={config.manifestUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      数据清单与校验值
                      <ArrowUpRight size={14} />
                    </a>
                  </div>
                </>
              )}
              {panel !== "methods" && <button className="detail-methods-link" onClick={() => readPanel("methods")}><Database size={14} />数据来源与方法 <ArrowRight size={14} /></button>}
            </div>
          </section>
        </aside>
      </main>
      <SliceDialog
        plane={expandedPlane}
        onPlane={setExpandedPlane}
        data={displayedSliceData}
        position={position}
        selected={slices.source === "allen" ? selected : whiteSelected ? -selected : 0}
        overlay={overlay}
        onOverlay={setOverlay}
        contrast={contrast}
        onPosition={move}
        probeName={sliceProbeName}
        sourceLabel={sliceSourceLabel}
        partitionControl={config.embryonic ? (
          <EmbryoPartitionControl
            level={embryoLevel}
            onLevel={setEmbryoLevel}
            disabled={!data}
          />
        ) : undefined}
        apBregmaUm={config.apBregmaUm}
        mlMidlineUm={config.mlMidlineUm}
        detailed
        mapView={mapView}
        onMapView={setMapView}
      />
      <footer className="page-footer">
        <span>
          <Check size={13} /> 数据来源：Allen Institute
          {!config.embryonic && " · Kim Lab / Chon et al."}
        </span>
        <span>参考 Neurotorium 交互设计 · 用于解剖学习与研究探索</span>
      </footer>
    </div>
  );
}
