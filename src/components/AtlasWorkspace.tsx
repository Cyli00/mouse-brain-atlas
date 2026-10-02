import { useI18n } from "../lib/i18n";
import type { PlaneDisplay } from "../lib/scene-plane";
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
  structureAt,
  clampPosition,
  PLANE_ORDER,
  type PlaneName,
  type Position,
} from "../lib/atlas";
import { BrainScene } from "./BrainScene";
import { CoordinateField } from "./CoordinateField";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { VasculatureControls } from "./VasculatureControls";
import { useVasculature } from "../lib/use-vasculature";
import type { VesselFilter } from "../lib/vasculature";
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
import { useWorkspaceAtlas } from "../lib/use-workspace-atlas";
import { readWorkspaceRoute, workspaceUrl } from "../lib/workspace-route";
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
  const { locale, t, text } = useI18n();
  const baseRegions = config.regions;
  const [initial] = useState(() => readWorkspaceRoute(config, location.search));
  const initialCircuit = initial.circuit;
  const [selected, setSelected] = useState(initial.selectedId);
  const { data, position, setPosition, loading, error, move, retry } = useWorkspaceAtlas(config.manifestUrl, selected);
  const apZeroUm = config.apBregmaUm ?? data?.coordinateOriginsUm?.[0];
  const dvZeroUm = data?.coordinateOriginsUm?.[1];
  const mlZeroUm = config.mlMidlineUm ?? data?.coordinateOriginsUm?.[2];
  const [overlay, setOverlay] = useState(true),
    [planeDisplay, setPlaneDisplay] = useState<PlaneDisplay>("off"),
    [opacity, setOpacity] = useState(initialCircuit?.id ? 0.12 : 0.1),
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
  const [isolateRegion, setIsolateRegion] = useState(false);
  const [sceneInspection, setSceneInspection] = useState(0);
  const [showVessels, setShowVessels] = useState(false);
  const [vesselFilter, setVesselFilter] = useState<VesselFilter>("all");
  const [vesselsAboveOnly, setVesselsAboveOnly] = useState(false);
  const vessels = useVasculature(showVessels && !config.embryonic);
  const [expandedPlane, setExpandedPlane] = useState<PlaneName | null>(null);
  const slices = useSliceAtlas(data, !config.embryonic);
  const [mapView, setMapView] = useState(initial.mapView);
  const [embryoLevel, setEmbryoLevel] = useState<EmbryoPartitionLevel>(initial.embryoLevel);
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
  const sliceSelected = slices.source === "allen" ? selected : whiteSelected ? -selected : 0;
  const restoreWhitePosition = useRef(initial.selectedId < 0);
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
    ? `${t("Allen 发育图谱", "Allen developmental atlas")} · ${config.id} · ${embryoLevel === "fine" ? text("精细分区") : text("主要区室")}`
    : slices.source === "allen"
      ? "Allen Institute · CCFv3"
      : text(KIM_SOURCE_LABEL);
  const sliceStructure = displayedSliceData
    ? structureAt(displayedSliceData, position)
    : undefined;
  const sliceProbeName = sliceStructure
    ? `${sliceStructure.acronym} · ${text(sliceStructure.name)}`
    : text("未标注位置");
  const regionDisplay = useRef<DisplaySettings>(displayDefaults(false));
  const workspace = useRef<HTMLElement>(null);
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
    document.title = `${text(region.name)} · ${text(config.title)}`;
    history.replaceState(null, "", workspaceUrl(location.href, {
      selected, circuitId: activeCircuit?.id, embryonic: config.embryonic,
      sliceSource: slices.source, embryoLevel, mapView,
    }));
  }, [region.name, config.title, config.embryonic, selected, activeCircuit, slices.source, embryoLevel, mapView, text]);
  const whiteProbe = whiteMatterData && isWhiteMatterStructure(sliceStructure) ? sliceStructure : undefined;
  const currentStructure = whiteProbe ?? (displayedSliceData === data
    ? sliceStructure : data ? structureAt(data, position) : undefined);
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
    ? `${currentStructure.acronym} · ${text(currentStructure.name)}`
    : text("未标注位置");
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
    if (!activeCircuit) regionDisplay.current = { opacity, planeDisplay };
    setExploreMode("circuits");
    clearCircuitTarget();
    setCircuitId(id);
    focus(circuit.nodeIds[0], true, navigate);
    setPanel("circuit");
    setPlaneDisplay("off");
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
      setPlaneDisplay(regionDisplay.current.planeDisplay);
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
    setPlaneDisplay(settings.planeDisplay);
    setOverlay(true);
    setContrast(config.contrast);
    setIsolateRegion(false);
    setShowVessels(false);
    setVesselFilter("all");
    setVesselsAboveOnly(false);
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
          <span className="brand-word">Mouse Brain Atlas</span>
        </a>
        <nav className="atlas-navigation" aria-label={text("图谱页面")}>
          <a href="/" aria-current={!config.embryonic ? "page" : undefined}>{text("成年小鼠")}</a>
          <a
            href="/embryo"
            aria-current={config.embryonic ? "page" : undefined}
          >{text("胚胎小鼠")}</a>
        </nav>
        <div className="header-actions">
        <a
          className="source-link"
          aria-label={text("Allen Institute 数据，打开原始图谱")}
          href={config.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          <span className="source-link-full">{text("Allen Institute 数据")}</span>
          <span className="source-link-short" aria-hidden="true">Allen</span>
          <ArrowUpRight size={15} />
        </a>
        <LanguageToggle />
        <ThemeToggle />
        </div>
      </header>
      <section aria-label={text("当前图谱")}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {config.embryonic
              ? "DEVELOPING MOUSE BRAIN ATLAS"
              : "ADULT MOUSE BRAIN ATLAS"}
          </span>
          <h1>{text(config.title)}</h1>
        </div>
        <span className="dataset-badge">
          <Database size={14} /> {config.badge}{" "}
          <span className="badge-divider" />{" "}
          <span className="resolution-badge">
            {data?.spacing ?? config.resolutionUm} μm
            {config.embryonic ? text(" 重采样") : text(" 体素")}
          </span>
        </span>
      </div>
      {stageNavigation}
      {config.embryonic && (
        <div className="atlas-notice">
          <Info size={16} />
          <span>{text(config.description)}</span>
        </div>
      )}
      </section>
      <nav className="mobile-workspace-nav" aria-label={text("工作区导航")}>
        <button
          aria-pressed={mobilePane === "catalog"}
          onClick={() => showMobilePane("catalog")}
        >
          <PanelLeft size={17} />{text("脑区导览")}</button>
        <button
          aria-pressed={mobilePane === "viewer"}
          onClick={() => showMobilePane("viewer")}
        >
          <Box size={17} />{text("观察视图")}</button>
        <button
          aria-pressed={mobilePane === "details"}
          onClick={() => showMobilePane("details")}
        >
          <BookOpen size={17} />{text("解说与文献")}</button>
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
            <span className="workspace-view-label"><Layers3 size={16} />{text("三维探索 ")}<small>{text("让解剖关系变得可见")}</small></span>
            <button
              className="workspace-focus-toggle"
              type="button"
              aria-pressed={focusMode}
              onClick={() => setFocusMode(!focusMode)}
            >
              {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {focusMode ? text("显示导览") : text("展开画布")}
            </button>
          </div>
          <section
            className="viewer-panel"
            aria-label={text("三维图谱")}
          >
            <div className="viewer-heading">
              <div className="selected-name">
                <span
                  className="region-dot"
                  style={{ backgroundColor: region.color }}
                />
                <div className="selected-copy">
                  <strong>{whiteSelected && !whiteMatterData ? text("正在载入 PF 白质…") : text(region.name)}</strong>
                  <span>{whiteSelected && !whiteMatterData ? "PF / Kim v2" : locale === "zh" ? region.englishName : region.acronym}</span>
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
                <Crosshair size={15} />{text("定位切片")}</button>
            </div>
            {data ? (
              <BrainScene
                apZeroUm={apZeroUm}
                mlZeroUm={mlZeroUm}
                dvZeroUm={dvZeroUm}
                data={data}
                vasculature={config.embryonic ? null : vessels.data}
                vesselFilter={vesselFilter}
                vesselsAboveOnly={vesselsAboveOnly}
                position={position}
                selected={selected}
                color={region.color}
                opacity={opacity}
                planeDisplay={planeDisplay}
                overlay={overlay}
                contrast={contrast}
                onPosition={move}
                onRegionSelect={(id) => focus(id, false, false)}
                onReadRegion={() => { setPanel("region"); showMobilePane("details"); focusDetails(); }}
                onLocateSlices={() => {
                  focus(selected, false, false);
                  document.getElementById("linked-slices")?.scrollIntoView({ block: "start", behavior: "instant" });
                }}
                isolateRegion={isolateRegion || whiteSelected}
                onIsolateRegion={setIsolateRegion}
                inspectionRequest={sceneInspection}
                circuit={activeCircuit}
                circuitTarget={circuitTarget}
                circuitFlow={circuitFlow}
                onCircuitPreview={setCircuitPreview}
                onCircuitSelect={selectCircuitTarget}
                onCircuitClear={clearCircuitTarget}
                regions={brainRegions}
                datasetLabel={whiteSelected ? text("PF · Kim v2 白质") : config.badge}
                whiteMatterData={whiteMatterData}
                sliceData={config.embryonic ? displayedSliceData : whiteMatterData}

              />
            ) : (
              <div className="viewer-loading" role={error ? "alert" : "status"}>
                {error ? (
                  <>
                    <Info size={28} />
                    <h2>{text("图谱未能载入")}</h2>
                    <p>{text(error)}</p>
                    <button
                      className="primary-button"
                      onClick={retry}
                    >{text("重新载入数据")}</button>
                  </>
                ) : (
                  <>
                    <span className="loader" />
                    <h2>{text("正在准备小鼠脑图谱")}</h2>
                    <p>{text(loading)}</p>
                    <small>{text("正在载入本阶段的参考体积与标注。数据来自 Allen Institute。")}</small>
                  </>
                )}
              </div>
            )}
            <div className="viewer-controls">
              {!activeCircuit && !whiteSelected && (
                <div className="scene-mode-switch" role="group" aria-label={text("三维显示范围")}>
                  <button aria-pressed={!isolateRegion} onClick={() => setIsolateRegion(false)}>{text("分区探索")}</button>
                  <button aria-pressed={isolateRegion} onClick={() => setIsolateRegion(true)}>{text("只看选区")}</button>
                </div>
              )}
              <label className="scene-plane-field">
                <Layers3 size={15} />
                <span>{text("切面")}</span>
                <select aria-label={text("三维切面显示")} value={planeDisplay} disabled={!data}
                  onChange={(event) => setPlaneDisplay(event.target.value as PlaneDisplay)}>
                  <option value="off">{text("不显示切面")}</option>
                  <option value="transparent">{text("显示切面（透明）")}</option>
                  <option value="tissue">{text("显示切面（组织图）")}</option>
                  <option value="regions">{text("显示切面（分区图）")}</option>
                </select>
              </label>
              <div className="opacity-field">
                <label htmlFor="opacity">{text("外壳")}</label>
                <input
                  id="opacity"
                  aria-label={text("脑表面不透明度")}
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
                <RotateCcw size={14} />{text("恢复显示")}</button>
            </div>
            {!config.embryonic && <VasculatureControls
              enabled={showVessels} onEnabled={setShowVessels}
              filter={vesselFilter} onFilter={setVesselFilter}
              aboveOnly={vesselsAboveOnly} onAboveOnly={setVesselsAboveOnly}
              data={vessels.data} error={vessels.error} onRetry={vessels.retry} disabled={!data} />}
          </section>
          <section
            id="linked-slices"
            className="slices-section"
            aria-label={text("三向切片")}
          >
            <div className="section-heading">
              <h2>
                <ScanLine size={16} />{text("正交切片")}<span>{text("点击定位 · 放大查看细节")}</span>
              </h2>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={overlay}
                  onChange={(e) => setOverlay(e.target.checked)}
                  disabled={!slices.data}
                />{text("边界与名称")}</label>
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
                  <span>{text("切片图谱")}</span>
                  <select
                    aria-label={text("切片图谱")}
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
                    <option value="paxinos-kim">{text(KIM_SOURCE_LABEL)}</option>
                  </select>
                </label>
              )}
              <SlicePresentationControl
                mapView={mapView}
                onMapView={setMapView}
              />
              <span className="slice-coordinate-note">
                {config.embryonic
                  ? `${t("Allen 发育图谱", "Allen developmental atlas")} · ${config.id} · ${text("标注边界相对坐标")}`
                  : text("AP · Bregma 近似参考 / ML · 正中线")}
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
                      selected={sliceSelected}
                      overlay={overlay}
                      contrast={contrast}
                      onPosition={move}
                      onExpand={() => setExpandedPlane(name)}
                      apZeroUm={apZeroUm}
                      mlZeroUm={mlZeroUm}
                      dvZeroUm={dvZeroUm}
                      embryonic={config.embryonic}
                      detailed
                      mapView={mapView}
                    />
                  ))
                : PLANE_ORDER.map((name) => (
                    <div key={name} className="slice-placeholder">
                      {slices.error
                        ? text("切片图谱未载入")
                        : data
                          ? text("正在载入分区…")
                          : text("等待体数据载入")}
                    </div>
                  ))}
            </div>
            {!config.embryonic && slices.source === "allen" && data && (
              <div className="slice-source-detail">
                <p>Allen CCFv3 · {allenLabelCount}{text(" 个原始分区标签，含皮层分层。导览与三维表面展示 ")}{baseRegions.length}{text(" 个精选脑区。")}</p>
              </div>
            )}
            {config.embryonic && (
              <div className="slice-source-detail embryo-partition-note">
                <p>{embryoPartitionData ? `${embryoLevel === "fine" ? embryoPartitionData.fineCount : embryoPartitionData.majorCount}${t(" 个", " ")}${embryoLevel === "fine" ? text("原始分区标签") : text("区室及保留标签")}` : text("正在载入发育分区…")}{text(" · 三维显示主要区室，细分边界见切片。")}</p>
                <p>{config.id === "E18.5" ? text("E18.5 原始标注较粗，不代表脑区减少。") : text("分区按发育本体命名，不能直接等同于成年核团。")}{text("单侧标注；40 μm 为重采样间距。")}</p>
              </div>
            )}
            {slices.source === "paxinos-kim" && (
              <div className="slice-source-detail">
                <p>{text("Kim v2 · 2024 修订，源自 FP 第 3 / 4 版分区，非第 5 版原图。白质表面由同一 PF 标签体积重建；脑区表面与环路仍使用 Allen。")}</p>
                <p className="slice-source-probe" aria-live="polite">
                  {slices.error ? (
                    <>
                      <span role="alert">{text("分区加载失败：")}{text(slices.error)}</span>{" "}
                      <button className="text-button" onClick={slices.retry}>{text("重试分区")}</button>
                    </>
                  ) : slices.data ? (
                    <>{text("PF 交点：")}<strong>{sliceProbeName}</strong>{whiteProbe && <span className="category-tag">{text("白质 / 纤维束")}</span>}
                      {whiteProbe && <button className="text-button" onClick={inspectProbe}>{text("查看白质解说")}</button>}
                    </>
                  ) : (
                    <span role="status">{text("正在读取 Paxinos–Franklin 分区…")}</span>
                  )}
                </p>
              </div>
            )}
            <div className="slice-contrast">
              <span>
                {mapView
                  ? text("标签体积重切 · 放大可缩放并查全部分区")
                  : `${text(config.templateLabel)} · ${t("点击切片移动交叉线", "Click a slice to move the crosshair")}`}
              </span>
              <label>{text("灰度窗宽")}<input
                  type="range"
                  min={config.embryonic ? 60 : 150}
                  max={config.maxContrast}
                  step="1"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  aria-label={text("切片灰度窗宽")}
                  disabled={!slices.data || (mapView && planeDisplay !== "tissue")}
                />
              </label>
            </div>
          </section>
          <section
            className="coordinate-bar"
            aria-label={text(config.coordinateLabel)}
          >
            <div className="coordinate-title">
              <Crosshair size={17} />
              <div>
                {text(config.coordinateLabel)}
                <small>
                  {!config.embryonic
                    ? text("mm · ML 左负右正 / DV 为 CCF")
                    : text("mm · 前 / 背 / 内侧边界为零")}
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
                    apZeroUm,
                    mlZeroUm,
                    dvZeroUm,
                  )}
                  {...coordinateRange(
                    data?.dimensions[i] ?? 1,
                    i,
                    data?.spacing ?? config.resolutionUm,
                    apZeroUm,
                    mlZeroUm,
                    dvZeroUm,
                  )}
                  reference={coordinateReference(
                    i,
                    apZeroUm,
                    mlZeroUm,
                    config.embryonic,
                  )}
                  step={data ? data.spacing / 1000 : config.resolutionUm / 1000}
                  midpointPreference={
                    config.embryonic && i !== 1 ? "lower" : "upper"
                  }
                  describedBy={
                    config.embryonic ? "embryo-coordinate-help" : undefined
                  }
                  disabled={!data}
                  onCommit={(value) => {
                    if (data) {
                      const next: Position = [...position];
                      next[i] = coordinateVoxel(
                        value,
                        i,
                        data.spacing,
                        apZeroUm,
                        mlZeroUm,
                        dvZeroUm,
                      );
                      move(next);
                    }
                  }}
                />
              ))}
            </div>
            <div className="current-structure">
              <span>
                {whiteProbe ? text("PF 交点白质结构") : config.embryonic ? text("交点所在区域") : text("Allen 交点所在区域")}
              </span>
              <strong>
                {config.embryonic || slices.source === "allen"
                  ? sliceProbeName
                  : probeRegion
                    ? `${text(probeRegion.name)} · ${currentStructure?.acronym}`
                    : probeName}
              </strong>
            </div>
            <button
              className="probe-inspect-button"
              disabled={!probeRegion}
              onClick={inspectProbe}
              title={
                probeRegion
                  ? t(`查看${probeRegion.name}的解说`, `Read about ${text(probeRegion.name)}`)
                  : text("该位置没有已收录的脑区解说")
              }
            >
              <BookOpen size={15} />
              <span>{text("查看解说")}</span>
              <ArrowRight size={13} />
            </button>
          </section>
          {config.embryonic && (
            <p
              id="embryo-coordinate-help"
              className="slice-coordinate-note coordinate-help"
            >{text("正中线未校准。0 位于相邻切片之间，输入 0 选择标注侧最近切片， 显示实际坐标：AP / ML −0.02 mm，DV +0.02 mm。")}</p>
          )}
        </div>
        <aside className="inspector-panel" aria-label={text("导览与解说")}>
          <div className="inspector-intro"><span className="eyebrow">BRAIN INDEX</span><h2>{text("从一个脑区开始")}</h2><p>{text("点击模型，或在这里查找。")}</p></div>
          <div
            className="inspector-navigation"
            role="group"
            aria-label={text("侧栏内容")}
          >
            <button
              type="button"
              aria-pressed={inspectorView === "catalog"}
              onClick={() => {
                setInspectorView("catalog");
                setMobilePane("catalog");
              }}
            >
              <PanelLeft size={16} />{text("脑区导览")}</button>
            <button
              type="button"
              aria-pressed={inspectorView === "details"}
              onClick={() => {
                setInspectorView("details");
                setMobilePane("details");
              }}
            >
              <BookOpen size={16} />{text("解说与文献")}</button>
          </div>
          <section
            className="region-sidebar"
            aria-label={text("脑区目录")}
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
                setSceneInspection((request) => request + 1);
              }}
              onCircuitSelect={(id) => {
                openCircuit(id);
                setInspectorView("details");
                if (matchMedia("(min-width: 1051px)").matches) focusDetails();
              }}
              searchInputRef={search}
            />
            {!config.embryonic && slices.source === "allen" && (
              <button className="catalog-source-action" onClick={() => slices.setSource("paxinos-kim")}>{text("浏览 PF 白质结构 ")}<ArrowRight size={14} /></button>
            )}
            {!config.embryonic && slices.source === "paxinos-kim" && !whiteMatterData && (
              <div className="catalog-load-state" role={slices.error ? "alert" : "status"}>
                {slices.error ? <>{text("PF 白质未载入 ")}<button onClick={slices.retry}>{text("重试")}</button></> : text("正在载入 PF 白质…")}
              </div>
            )}
          </section>
          <section
            className="detail-panel"
            aria-label={text("脑区信息")}
            hidden={inspectorView !== "details"}
          >
            {panel === "methods" ? (
              <button className="detail-back-button" onClick={() => readPanel(activeCircuit ? "circuit" : "region")}>{text("← 返回解说")}</button>
            ) : activeCircuit ? (
              <div className="detail-tabs">
                <button aria-pressed={panel === "circuit"} onClick={() => setPanel("circuit")}>{text("环路")}</button>
                <button aria-pressed={panel === "region"} onClick={() => setPanel("region")}>{text("所选结构")}</button>
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
                <p role={slices.error ? "alert" : "status"}>{slices.error ? t(`PF 白质解说未载入：${slices.error}`, `PF white matter details could not be loaded: ${text(slices.error)}`) : text("正在载入 PF 白质解说…")}</p>
              ) : panel === "region" ? (
                <article className="region-article" key={region.id}>
                  <div className="region-article-meta">
                    <span className="region-dot" style={{ backgroundColor: region.color }} />
                    <span>{text(region.category)}</span>
                    <span className="region-article-acronym">{region.acronym}</span>
                  </div>
                  <h2>{text(region.name)}</h2>
                  {locale === "zh" && <p className="english-name">{region.englishName}</p>}
                  <p className="region-summary">{text(region.summary)}</p>
                  <section className="region-function" aria-label={config.embryonic ? text("发育解剖") : text("主要功能")}>
                    <h3>{config.embryonic ? text("发育解剖") : text("主要功能")}</h3>
                    <p>{text(region.function)}</p>
                  </section>
                  <details className="evidence-disclosure">
                    <summary>{text("证据与文献 ")}<span>{region.references.length}</span></summary>
                    <p className="evidence-text">{text(region.evidence)}</p>
                    <ol className="references">
                      {region.references.map((r, i) => <Reference key={r.url} reference={r} index={i} />)}
                    </ol>
                    <div className="region-source-meta">
                      <span>{whiteSelected ? "PF / Kim" : "Allen"} ID {Math.abs(region.id)}</span>
                      <a href={whiteSelected ? KIM_SOURCE_URL : config.embryonic ? config.annotationUrl : `https://atlas.brain-map.org/atlas?atlas=1&structure=${region.id}`} target="_blank" rel="noreferrer">{text("原始图谱 ")}<ArrowUpRight size={13} /></a>
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
                    {config.embryonic ? text("阶段数据与参考坐标") : text("数据与坐标参考")}
                  </h2>
                  <p className="region-summary">{text(config.description)}</p>
                  <dl className="data-facts">
                    <div>
                      <dt>{text("体素间距")}</dt>
                      <dd>
                        {data?.spacing ?? config.resolutionUm} ×{" "}
                        {data?.spacing ?? config.resolutionUm} ×{" "}
                        {data?.spacing ?? config.resolutionUm} μm
                      </dd>
                    </div>
                    <div>
                      <dt>{text("体数据尺寸")}</dt>
                      <dd>{data?.dimensions.join(" × ") ?? text("载入后显示")}</dd>
                    </div>
                    <div>
                      <dt>{text("坐标轴顺序")}</dt>
                      <dd>AP / DV / ML</dd>
                    </div>
                    <div>
                      <dt>{text("正方向")}</dt>
                      <dd>{text("前 / 腹侧 / 右")}</dd>
                    </div>
                  </dl>
                  <h3 className="detail-section-heading">{text("切片从哪里来")}</h3>
                  <p className="evidence-text">{text(config.sliceNote)}</p>
                  <h3 className="detail-section-heading">{text("坐标与精度")}</h3>
                  <p className="evidence-text">{text(config.coordinateNote)}</p>
                  {!config.embryonic && (
                    <>
                      <a
                        className="text-button"
                        href={BREGMA_REFERENCE_URL}
                        target="_blank"
                        rel="noreferrer"
                      >{text("IBL 的 Bregma 参考定义 ")}<ArrowUpRight size={14} />
                      </a>
                      <h3 className="detail-section-heading">{text("Paxinos–Franklin 切片选项")}</h3>
                      <p className="evidence-text">{text("分区图从标签体积生成浅色蒙版、边界和缩写，放大后可缩放、查看完整分区列表并定位。组织图使用同一 Allen 平均模板。采用 Chon 等人的 Unified Mouse Brain Atlas，使用作者 2024 年 Kim v2 修订数据。其分区源自 FP 第 3 版，并纳入第 4 版更新；它不是第 5 版书籍的数字复刻。源数据的 20 μm 网格由形状插值得到，本页按最近邻采样至 50 μm，不增加解剖精度。白质目录、切片与三维表面均来自 Kim 标签，独立保存编号。白质表面只表示标注范围，不表示单根轴突、连接方向或纤维追踪结果。")}</p>
                      <div className="method-links">
                        <a
                          href={KIM_PAPER_URL}
                          target="_blank"
                          rel="noreferrer"
                        >{text("Chon 等，2019 · 图谱论文 ")}<ArrowUpRight size={14} />
                        </a>
                        <a
                          href={KIM_SOURCE_URL}
                          target="_blank"
                          rel="noreferrer"
                        >{text("Kim v2 数据 · CC BY 4.0 ")}<ArrowUpRight size={14} />
                        </a>
                        <a
                          href="https://creativecommons.org/licenses/by/4.0/"
                          target="_blank"
                          rel="noreferrer"
                        >{text("Kim 数据许可")}</a>
                        <a
                          href={PAXINOS_BOOK_URL}
                          target="_blank"
                          rel="noreferrer"
                        >{text("Paxinos & Franklin 第 5 版 · 2019")}{" "}
                          <ArrowUpRight size={14} />
                        </a>
                        <a
                          href="/data/kim-v2/manifest.json"
                          target="_blank"
                          rel="noreferrer"
                        >{text("Kim 数据转换与校验值")}</a>
                      </div>
                    </>
                  )}
                  <h3 className="detail-section-heading">{text("脑区定位")}</h3>
                  <p className="evidence-text">{text(config.focusNote)}</p>
                  <h3 className="detail-section-heading">{text("数据使用")}</h3>
                  <p className="evidence-text">{text("Allen 模板、原始标注与网格遵循 Allen Institute 使用条款。")}{!config.embryonic &&
                      text("Kim v2 标注采用 CC BY 4.0，作者、论文、许可和本页转换方法列于上方。")}{text("本项目不改变原始数据许可。")}</p>
                  <h3 className="detail-section-heading">{text("图谱论文")}</h3>
                  <ol className="references">
                    {config.references.map((r, i) => (
                      <Reference key={r.url} reference={r} index={i} />
                    ))}
                  </ol>
                  <div className="method-links">
                    <a href={config.sourceUrl} target="_blank" rel="noreferrer">{text("Allen 体数据说明")}<ArrowUpRight size={14} />
                    </a>
                    <a
                      href="https://alleninstitute.org/legal/terms-of-use"
                      target="_blank"
                      rel="noreferrer"
                    >{text("Allen Institute 使用条款")}<ArrowUpRight size={14} />
                    </a>
                    <a
                      href={config.manifestUrl}
                      target="_blank"
                      rel="noreferrer"
                    >{text("数据清单与校验值")}<ArrowUpRight size={14} />
                    </a>
                  </div>
                </>
              )}
              {panel !== "methods" && <button className="detail-methods-link" onClick={() => readPanel("methods")}><Database size={14} />{text("数据来源与方法 ")}<ArrowRight size={14} /></button>}
            </div>
          </section>
        </aside>
      </main>
      <SliceDialog
        plane={expandedPlane}
        onPlane={setExpandedPlane}
        data={displayedSliceData}
        position={position}
        selected={sliceSelected}
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
        apZeroUm={apZeroUm}
        mlZeroUm={mlZeroUm}
        dvZeroUm={dvZeroUm}
        embryonic={config.embryonic}
        detailed
        mapView={mapView}
        onMapView={setMapView}
      />
      <footer className="page-footer">
        <span>
          <Check size={13} />{text(" 数据来源：Allen Institute")}{!config.embryonic && " · Kim Lab / Chon et al."}
        </span>
        <span>{text("参考 Neurotorium 交互设计 · 用于解剖学习与研究探索")}</span>
      </footer>
    </div>
  );
}
