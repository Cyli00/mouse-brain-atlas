import { scenePlaneImage, type PlaneDisplay } from "../lib/scene-plane";
import type { BrainCircuit } from "../data/circuits";
import type { BrainRegion } from "../data/regions";
import { circuitEmphasis, CONNECTION_COLORS, sameCircuitTarget, type CircuitTarget } from "../lib/circuit-interaction";
import { useEffect, useId, useRef, useState } from "react";
import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { RotateCcw, Plus, Minus, Focus, CircleHelp, X, ArrowUpRight, Crosshair } from "lucide-react";
import { coordinateMm } from "../lib/coordinates";
import { createSliceGizmo } from "../lib/scene-slice-gizmo";
import { alignSceneCamera, rotateSceneCamera, SCENE_DIRECTIONS, ScenePointerGesture, type SceneDirection } from "../lib/scene-interaction";
import type { Vasculature, VesselFilter } from "../lib/vasculature";
import { createSceneVasculature, vesselColorsFromStyle } from "../lib/scene-vasculature";
import { invalidateMeshCache, loadMeshGeometry } from "../lib/mesh-cache";
import { useI18n } from "../lib/i18n";
import {
  PLANES,
  PLANE_ORDER,
  toWorld,
  fromWorld,
  voxelIndex,
  type AtlasData,
  type PlaneName,
  type Position,
} from "../lib/atlas";
type Props = {
  data: AtlasData;
  apZeroUm?: number;
  mlZeroUm?: number;
  dvZeroUm?: number;
  vasculature?: Vasculature | null;
  vesselFilter?: VesselFilter;
  vesselsAboveOnly?: boolean;
  whiteMatterData?: AtlasData | null;
  sliceData?: AtlasData | null;
  position: Position;
  selected: number;
  color: string;
  opacity: number;
  planeDisplay: PlaneDisplay;
  overlay: boolean;
  contrast: number;
  onPosition: (p: Position) => void;
  onRegionSelect: (id: number) => void;
  onReadRegion: () => void;
  onLocateSlices: () => void;
  isolateRegion: boolean;
  onIsolateRegion: (value: boolean) => void;
  inspectionRequest: number;
  circuit?: BrainCircuit;
  circuitTarget?: CircuitTarget | null;
  circuitFlow?: boolean;
  onCircuitPreview?: (target: CircuitTarget | null) => void;
  onCircuitSelect?: (target: CircuitTarget) => void;
  onCircuitClear?: () => void;
  regions?: BrainRegion[];
  datasetLabel?: string;
};
type SceneAPI = {
  update: (p: Props) => void;
  align: (direction: SceneDirection) => void;
  openOrientation: (x?: number, y?: number) => void;
  zoom: (factor: number) => void;
  focus: () => void;
  focusCircuit: () => void;
  reset: () => void;
};
function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose();
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  materials.forEach((m) => {
    if ("map" in m) (m.map as THREE.Texture | null)?.dispose();
    m.dispose();
  });
}
const SCENE_ARIA_LABEL = "小鼠三维脑视图，点击脑区查看详情，拖动旋转，Ctrl 拖动平移，Shift 显示切面箭头，方向键旋转，Enter 查看所选脑区，F 聚焦，Home 查看全脑";
export function BrainScene(props: Props) {
  const { locale, t, text } = useI18n();
  const host = useRef<HTMLDivElement>(null),
    api = useRef<SceneAPI | null>(null),
    latest = useRef(props);
  latest.current = props;
  const [error, setError] = useState(""),
    [meshStatus, setMeshStatus] = useState("正在载入三维脑表面…"),
    [retry, setRetry] = useState(0);
  const [orientationPosition, setOrientationPosition] = useState<{ x: number; y: number } | null>(null);
  const orientation = useRef<HTMLDivElement>(null);
  const controlHeld = useRef(false);
  const openOrientation = (x?: number, y?: number) => {
    const rect = host.current?.getBoundingClientRect();
    if (!rect) return;
    setOrientationPosition({
      x: Math.max(12, Math.min(x ?? rect.left + rect.width / 2, window.innerWidth - 232)),
      y: Math.max(12, Math.min(y ?? rect.top + rect.height / 2, window.innerHeight - 324)),
    });
  };
  useEffect(() => {
    if (!orientationPosition) return;
    host.current?.querySelector("canvas")?.focus({ preventScroll: true });
    orientation.current?.showPopover();
    orientation.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [orientationPosition]);
  const [circuitStatus, setCircuitStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [rootLoading, setRootLoading] = useState(true);
  const [atlasStatus, setAtlasStatus] = useState("");
  const [hovered, setHovered] = useState<{ id: number; x: number; y: number } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const selectedRegion = props.regions?.find((r) => r.id === props.selected);
  const hoveredRegion = props.regions?.find((r) => r.id === hovered?.id);
  const cardTitle = useId();
  const card = useRef<HTMLElement>(null);
  const previousSelected = useRef(props.selected);
  useEffect(() => {
    if (props.inspectionRequest > 0) setDetailsOpen(true);
  }, [props.inspectionRequest]);
  useEffect(() => {
    if (previousSelected.current !== props.selected && !props.circuit)
      setDetailsOpen(true);
    previousSelected.current = props.selected;
  }, [props.selected, props.circuit]);
  useEffect(() => { setHovered(null); }, [props.isolateRegion, props.circuit, props.selected]);
  useEffect(() => { if (props.circuit) setDetailsOpen(false); }, [props.circuit]);
  const activeEdge = props.circuitTarget?.kind === "edge" ? props.circuit?.edges[props.circuitTarget.index] : undefined;
  const activeNodeId = props.circuitTarget?.kind === "node" ? props.circuitTarget.id : undefined;
  const activeNode = props.regions?.find((r) => r.id === activeNodeId);
  const circuitSelectionLabel = activeEdge
    ? `${props.regions?.find((r) => r.id === activeEdge.from)?.acronym} → ${props.regions?.find((r) => r.id === activeEdge.to)?.acronym}`
    : activeNode?.acronym ?? "投射关系示意";
  const helpId = useId();
  const retryScene = () => {
    const current = latest.current;
    const ids = [
      current.data.rootId ?? 997,
      current.selected,
      ...(current.circuit?.nodeIds ?? []),
      ...(current.regions?.filter((r) => r.id > 0).map((r) => r.id) ?? []),
    ];
    invalidateMeshCache([
      ...ids.flatMap((id) => current.data.meshes[String(id)]?.url ?? []),
      ...(current.selected < 0 ? [current.whiteMatterData?.meshes[String(-current.selected)]?.url].filter((url): url is string => !!url) : []),
    ]);

    setRetry((value) => value + 1);
  };
  useEffect(() => {
    if (!host.current) return;
    const container = host.current,
      abort = new AbortController();
    setReady(false);
    setRootLoading(true);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setRootLoading(false);
      setMeshStatus("");
      setError(
        "当前浏览器无法启用 WebGL。下方三个切片仍可使用，请尝试在支持 WebGL 的浏览器打开。",
      );
      return;
    }
    setError("");
    setMeshStatus("正在载入三维脑表面…");
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const sceneStyle = getComputedStyle(container);
    const sceneColor = sceneStyle.getPropertyValue("--scene-background").trim() || "#eeebf2";
    renderer.setClearColor(sceneColor, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      SCENE_ARIA_LABEL,
    );
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-describedby", helpId);
    renderer.domElement.setAttribute(
      "aria-keyshortcuts",
      "ArrowLeft ArrowRight ArrowUp ArrowDown + - f Home Enter Escape",
    );
    renderer.domElement.tabIndex = 0;
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(
        35,
        1,
        Math.max((props.data.spacing / 1000) * 0.15, 0.002),
        400,
      );
    const modelScale =
      Math.max(
        ...props.data.dimensions.map((n) => (n * props.data.spacing) / 1000),
      ) / 13.2;
    const baseCamera = new THREE.Vector3(-15, 10, 17).normalize();
    const gridSize = new THREE.Vector3(
      ...(props.data.dimensions.map(
        (n) => (n * props.data.spacing) / 1000,
      ) as Position),
    );
    let wholeSphere = new THREE.Sphere(
      new THREE.Vector3(),
      gridSize.length() / 2,
    );
    let framing: "whole" | "region" | "circuit" = "whole";
    let autoFit = true;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    camera.position.copy(baseCamera);
    let controls = new TrackballControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    const configureControls = (orbit: TrackballControls) => {
      orbit.minDistance = Math.max(
        (props.data.spacing / 1000) * 3,
        0.1 * modelScale,
      );
      orbit.maxDistance = gridSize.length() * 12;
      orbit.staticMoving = reducedMotion.matches;
      orbit.dynamicDampingFactor = 0.25;
      orbit.keys = ["", "", ""];
      orbit.rotateSpeed = 2.2;
      orbit.zoomSpeed = 0.85;
      orbit.panSpeed = 0.7;

    };
    configureControls(controls);
    scene.add(new THREE.HemisphereLight("#fffdf9", "#77718c", 1.8));
    const light = new THREE.DirectionalLight("#fffdf9", 2.5);
    light.position.set(-8, 15, 8);
    scene.add(light);
    const light2 = new THREE.DirectionalLight("#c6d4d0", 1.3);
    light2.position.set(8, -2, -8);
    scene.add(light2);
    let root: THREE.Mesh | undefined,
      region: THREE.Mesh | undefined,
      regionAbort: AbortController | undefined,
      lastMeshUrl = "";
    let circuitGroup: THREE.Group | undefined,
      circuitAbort: AbortController | undefined,
      lastCircuit = "";
    const atlasMeshes = new Map<number, THREE.Mesh>();
    const vessels = createSceneVasculature(scene, props.data, vesselColorsFromStyle(sceneStyle));
    let atlasStarted = false;
    let cameraFrame: number | undefined;
    let hoverMesh: THREE.Mesh | null = null;
    type FlowLink = { index: number; group: THREE.Group; curve: THREE.QuadraticBezierCurve3; dots: THREE.Mesh[]; hit: THREE.Mesh };
    let flowLinks: FlowLink[] = [];
    let flowFrame: number | undefined;
    let motionEdges = new Set<number>();
    const motionAllowed = () => flowLinks.length > 0 && motionEdges.size > 0 &&
      !!latest.current.circuitFlow && !!latest.current.circuitTarget && !reducedMotion.matches && !document.hidden;
    const syncFlow = (redraw = true) => {
      if (!motionAllowed()) {
        if (flowFrame !== undefined) cancelAnimationFrame(flowFrame);
        flowFrame = undefined;
        let changed = false;
        flowLinks.forEach((link) => link.dots.forEach((dot) => {
          changed ||= dot.visible;
          dot.visible = false;
        }));
        if (redraw && changed) render();
        return;
      }
      if (flowFrame !== undefined) return;
      const tick = (time: number) => {
        if (abort.signal.aborted || !motionAllowed()) { flowFrame = undefined; return; }
        flowLinks.forEach((link) => link.dots.forEach((dot, i) => {
          dot.visible = motionEdges.has(link.index);
          if (dot.visible) dot.position.copy(link.curve.getPoint((time / 2200 + i / 2) % 1));
        }));
        render();
        flowFrame = requestAnimationFrame(tick);
      };
      flowFrame = requestAnimationFrame(tick);
    };
    const clearCircuit = () => {
      circuitAbort?.abort();
      if (flowFrame !== undefined) cancelAnimationFrame(flowFrame);
      flowFrame = undefined;
      flowLinks = [];
      if (circuitGroup) {
        scene.remove(circuitGroup);
        circuitGroup.traverse((o) => {
          if (o instanceof THREE.Mesh) disposeMesh(o);
          else if (o instanceof THREE.Line) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
        circuitGroup = undefined;
      }
    };
    let gizmo: ReturnType<typeof createSliceGizmo> | undefined;
    let shiftHeld = false;
    let interacting = false;
    const render = () => {
      gizmo?.update();
      if (!abort.signal.aborted) renderer.render(scene, camera);
    };
    const themeObserver = new MutationObserver(() => {
      const style = getComputedStyle(container);
      renderer.setClearColor(style.getPropertyValue("--scene-background").trim(), 1);
      vessels.setColors(vesselColorsFromStyle(style));
      render();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const cameraChanged = () => {
      render();
      if (cameraFrame === undefined) {
        cameraFrame = requestAnimationFrame(() => {
          cameraFrame = undefined;
          if (abort.signal.aborted) return;
          controls.update();
          if (interacting) cameraChanged();
        });
      }
    };
    const startInteraction = () => {
      interacting = true;
      autoFit = false;
      clearHover();

      cameraChanged();
    };
    const endInteraction = () => { interacting = false; cameraChanged(); };
    const setCameraUp = (up: THREE.Vector3) => {
      const target = controls.target.clone();
      controls.dispose();
      camera.up.copy(up);
      controls = new TrackballControls(camera, renderer.domElement);
      controls.target.copy(target);
      configureControls(controls);
      controls.update();
      controls.addEventListener("change", cameraChanged);
      controls.addEventListener("start", startInteraction);
      controls.addEventListener("end", endInteraction);
    };
    const selectedSphere = () => {
      if (region?.geometry.boundingSphere)
        return region.geometry.boundingSphere.clone();
      const focus =
        (latest.current.selected < 0
          ? latest.current.whiteMatterData?.meshes[String(-latest.current.selected)]
          : latest.current.data.meshes[String(latest.current.selected)])?.centroid ??
        latest.current.position;
      return new THREE.Sphere(
        new THREE.Vector3(
          ...toWorld(focus, props.data.dimensions, props.data.spacing),
        ),
        0.6 * modelScale,
      );
    };
    const frameSphere = (sphere: THREE.Sphere, direction?: THREE.Vector3) => {
      const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
      const horizontalHalfFov = Math.atan(
        Math.tan(verticalHalfFov) * camera.aspect,
      );
      const distance = Math.max(
        (sphere.radius /
          Math.sin(Math.min(verticalHalfFov, horizontalHalfFov))) *
          1.12,
        controls.minDistance,
      );
      const offset =
        direction?.clone() ??
        camera.position.clone().sub(controls.target).normalize();
      controls.target.copy(sphere.center);
      camera.position
        .copy(sphere.center)
        .add(offset.normalize().multiplyScalar(distance));
      camera.far = Math.max(
        controls.maxDistance * 2,
        distance + wholeSphere.radius * 4,
      );
      camera.updateProjectionMatrix();
      controls.update();
      render();
    };
    const focusSelected = () => {
      framing = "region";
      autoFit = true;
      frameSphere(selectedSphere());
    };
    const resetWhole = () => {
      framing = "whole";
      autoFit = true;
      setCameraUp(new THREE.Vector3(0, 1, 0));
      frameSphere(wholeSphere, baseCamera);
    };
    const planes = {} as Record<PlaneName, THREE.Mesh>;
    const outlines = {} as Record<PlaneName, THREE.LineSegments>;
    const sliceKeys = {} as Record<PlaneName, string>;
    let previousPlaneData: AtlasData | null = null;
    for (const name of PLANE_ORDER) {
      const material = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      planes[name] = mesh;
      scene.add(mesh);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({
          color: PLANES[name].color,
          transparent: true,
          opacity: 0.9,
        }),
      );
      outlines[name] = edge;
      scene.add(edge);
    }
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.1 * modelScale, 16, 12),
      new THREE.MeshBasicMaterial({ color: "#ec704c", depthTest: false }),
    );
    marker.renderOrder = 10;
    scene.add(marker);
    const loadAtlasMeshes = () => {
      if (atlasStarted) return;
      atlasStarted = true;
      const catalog = (latest.current.regions ?? []).filter((r) => r.id > 0 && props.data.meshes[String(r.id)]);
      let next = 0, completed = 0, failed = 0;
      setAtlasStatus(`正在载入可选脑区 0 / ${catalog.length}`);
      const worker = async () => {
        while (next < catalog.length && !abort.signal.aborted) {
          const entry = catalog[next++];
          try {
            const geometry = await loadMeshGeometry(props.data.meshes[String(entry.id)].url, props.data, abort.signal);
            if (abort.signal.aborted) { geometry.dispose(); return; }
            const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
              color: entry.color, roughness: 0.72, metalness: 0,
              side: THREE.DoubleSide,
            }));
            mesh.userData.regionId = entry.id;
            atlasMeshes.set(entry.id, mesh);
            scene.add(mesh);
            update(latest.current);
          } catch {
            if (!abort.signal.aborted) failed++;
          }
          if (!abort.signal.aborted) {
            completed++;
            setAtlasStatus(completed < catalog.length
              ? `正在载入可选脑区 ${completed} / ${catalog.length}`
              : failed ? `${failed} 个脑区表面未能载入` : "");
          }
        }
      };
      // Bound decoding and uploads so loading the atlas does not block dragging.
      void Promise.all(Array.from({ length: Math.min(4, catalog.length) }, worker));
    };
    function update(p: Props) {
      const world = toWorld(p.position, p.data.dimensions, p.data.spacing);
      const vesselFilter = p.vesselFilter ?? "all";
      const vesselCount = vessels.update({ data: p.vasculature ?? null, filter: vesselFilter,
        aboveOnly: !!p.vesselsAboveOnly, dorsalWorldY: world[1] });
      container.dataset.vascularVessels = String(vesselCount);
      container.dataset.vascularFilter = vesselFilter;
      if (!p.circuit && p.selected > 0) loadAtlasMeshes();
      const selectedData = p.selected < 0 ? p.whiteMatterData : p.data;
      const selectedId = Math.abs(p.selected);
      const selectedInfo = selectedData?.meshes[String(selectedId)];
      const planeData = p.sliceData ?? p.data;
      if (planeData !== previousPlaneData) {
        for (const name of PLANE_ORDER) sliceKeys[name] = "";
        previousPlaneData = planeData;
      }
      const planesVisible = p.planeDisplay !== "off" || shiftHeld;
      const planeMode = p.planeDisplay === "off" ? "transparent" : p.planeDisplay;
      const texturedPlanes = planesVisible && planeMode !== "transparent";
      const d = p.data.dimensions,
        s = p.data.spacing / 1000;
      marker.position.set(...world);
      marker.visible = planesVisible;
      atlasMeshes.forEach((mesh, id) => {
        mesh.visible = !p.circuit && !p.isolateRegion && p.selected > 0 &&
          !(region && region.userData.regionId === id);
        const material = mesh.material as THREE.MeshStandardMaterial;
        const transparent = !!p.vasculature || texturedPlanes;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.opacity = p.vasculature ? 0.025 : texturedPlanes ? 0.08 : 1;
        material.depthWrite = !p.vasculature && !texturedPlanes;
      });
      if (region) {
        const material = region.material as THREE.MeshPhysicalMaterial;
        material.color.set(p.color);
        material.opacity = p.vasculature || texturedPlanes ? 0.1 : p.circuit?.id ? 0.42 : 0.94;
        material.depthWrite = !p.circuit && !p.vasculature && !texturedPlanes;
      }
      if (root)
        (root.material as THREE.MeshPhysicalMaterial).opacity = p.opacity;
      for (const name of PLANE_ORDER) {
        const mesh = planes[name],
          plane = PLANES[name],
          material = mesh.material as THREE.MeshBasicMaterial;
        mesh.visible = planesVisible;
        outlines[name].visible = planesVisible;
        material.opacity = planeMode === "transparent" ? 0.08 : 0.92;
        material.color.set(planeMode === "transparent" ? plane.color : "#ffffff");
        if (planeMode === "transparent" && material.map) {
          material.map.dispose();
          material.map = null;
          material.needsUpdate = true;
          sliceKeys[name] = "";
        }
        const sliceKey = `${planeMode}:${p.position[plane.axis]}:${planeMode === "tissue" ? p.contrast : ""}`;
        if (planesVisible && planeMode !== "transparent" && sliceKeys[name] !== sliceKey) {
          const image = scenePlaneImage(planeData, name, p.position, planeMode, p.contrast);
          let tex = material.map as THREE.DataTexture | null;
          if (tex) {
            tex.image.data = image.data;
          } else {
            tex = new THREE.DataTexture(
              image.data,
              image.width,
              image.height,
              THREE.RGBAFormat,
            );
            // Texture rows follow the 2D slice; Three's UV convention needs a vertical flip.
            tex.flipY = true;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            material.map = tex;
            material.needsUpdate = true;
          }
          tex.needsUpdate = true;
          sliceKeys[name] = sliceKey;
        }
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, 0, 0);
        mesh.scale.set(d[plane.u] * s, d[plane.v] * s, 1);
        if (name === "coronal") mesh.position.z = world[2];
        if (name === "sagittal") {
          mesh.rotation.y = Math.PI / 2;
          mesh.position.x = world[0];
        }
        if (name === "horizontal") {
          mesh.rotation.x = Math.PI / 2;
          mesh.position.y = world[1];
        }
        outlines[name].position.copy(mesh.position);
        outlines[name].rotation.copy(mesh.rotation);
        outlines[name].scale.copy(mesh.scale);
      }
      if (lastMeshUrl !== (selectedInfo?.url ?? "")) {
        lastMeshUrl = selectedInfo?.url ?? "";
        regionAbort?.abort();
        regionAbort = new AbortController();
        const current = regionAbort;
        if (region) {
          scene.remove(region);
          disposeMesh(region);
          region = undefined;
        }
        const info = selectedInfo;
        if (info) {
          setMeshStatus("正在载入所选结构…");
          loadMeshGeometry(info.url, selectedData!, current.signal)
            .then((geometry) => {
              if (current.signal.aborted || abort.signal.aborted) {
                geometry.dispose();
                return;
              }
              region = new THREE.Mesh(
                geometry,
                new THREE.MeshPhysicalMaterial({
                  color: p.color,
                  roughness: 0.45,
                  metalness: 0,
                  transparent: true,
                  opacity: latest.current.circuit ? 0.42 : 0.94,
                  depthWrite: !latest.current.circuit,
                  side: THREE.DoubleSide,
                }),
              );
              region.userData.regionId = p.selected;
              region.renderOrder = 1;
              scene.add(region);
              setMeshStatus("");
              update(latest.current);
              if (framing === "region" && autoFit)
                frameSphere(selectedSphere());
              render();
            })
            .catch((e) => {
              if (!current.signal.aborted && !abort.signal.aborted)
                setMeshStatus(`结构表面加载失败，请重试。${e.message}`);
            });
        } else setMeshStatus("该结构暂无三维表面，可在切片中查看标注。");
      }
      if (lastCircuit !== (p.circuit?.id ?? "")) {
        previewTarget = null;
        renderer.domElement.style.cursor = "grab";
        lastCircuit = p.circuit?.id ?? "";
        clearCircuit();
        setCircuitStatus("");
        if (p.circuit) {
          const group = new THREE.Group();
          circuitGroup = group;
          scene.add(group);
          const current = new AbortController();
          circuitAbort = current;
          const byId = new Map(p.regions?.map((r) => [r.id, r]));
          setCircuitStatus("正在载入环路节点…");
          const pending = p.circuit.nodeIds.map(async (id) => {
            const info = p.data.meshes[String(id)];
            if (!info) throw new Error("缺少环路节点网格");
            const geometry = await loadMeshGeometry(
              info.url,
              p.data,
              current.signal,
            );
            if (current.signal.aborted || abort.signal.aborted) {
              geometry.dispose();
              return;
            }
            const mesh = new THREE.Mesh(
              geometry,
              new THREE.MeshPhysicalMaterial({
                color: byId.get(id)?.color ?? "#6d9691",
                roughness: 0.5,
                transparent: true,
                opacity: 0.55,
                depthWrite: false,
                side: THREE.DoubleSide,
              }),
            );
            mesh.userData.regionId = id;
            mesh.visible = id !== latest.current.selected;
            mesh.renderOrder = 1;
            group.add(mesh);
            update(latest.current);
            render();
          });
          Promise.allSettled(pending).then((results) => {
            if (!current.signal.aborted && !abort.signal.aborted)
              setCircuitStatus(
                results.some((r) => r.status === "rejected")
                  ? "部分环路节点未能载入，请重试。"
                  : "",
              );
          });
          p.circuit.edges.forEach((edge, index) => {
            const source = p.data.meshes[String(edge.from)]?.centroid;
            const target = p.data.meshes[String(edge.to)]?.centroid;
            if (!source || !target) return;
            const from = new THREE.Vector3(...toWorld(source, p.data.dimensions, p.data.spacing));
            const to = new THREE.Vector3(...toWorld(target, p.data.dimensions, p.data.spacing));
            const delta = to.clone().sub(from), length = delta.length();
            if (length < 0.01) return;
            const bend = new THREE.Vector3().crossVectors(delta, new THREE.Vector3(0, 1, 0));
            if (bend.lengthSq() < 0.001) bend.crossVectors(delta, new THREE.Vector3(0, 0, 1));
            const control = from.clone().add(to).multiplyScalar(0.5).add(bend.normalize().multiplyScalar(Math.min(1.2 * modelScale, length * 0.24)));
            const curve = new THREE.QuadraticBezierCurve3(from, control, to);
            const edgeGroup = new THREE.Group();
            edgeGroup.userData.edgeIndex = index;
            const material = () => new THREE.MeshBasicMaterial({ color: CONNECTION_COLORS[edge.kind], depthTest: false, depthWrite: false, transparent: true });
            const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.025 * modelScale, 6, false), material());
            line.renderOrder = 7;
            edgeGroup.add(line);
            const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.10 * modelScale, 0.26 * modelScale, 10), material());
            arrow.position.copy(curve.getPoint(0.88));
            arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(0.88).normalize());
            arrow.renderOrder = 8;
            edgeGroup.add(arrow);
            // A wider invisible tube gives thin schematic links a practical pointer target.
            const hit = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.12 * modelScale, 5, false), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
            hit.userData.edgeIndex = index;
            edgeGroup.add(hit);
            const dots = [0, 1].map(() => {
              const dot = new THREE.Mesh(new THREE.SphereGeometry(0.065 * modelScale, 8, 6), material());
              dot.visible = false; dot.renderOrder = 9; edgeGroup.add(dot); return dot;
            });
            flowLinks.push({ index, group: edgeGroup, curve, dots, hit });
            group.add(edgeGroup);
          });
        }
      }
      const emphasis = p.circuit ? circuitEmphasis(p.circuit, p.circuitTarget ?? null) : null;
      motionEdges = emphasis?.edges ?? new Set();
      circuitGroup?.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          child.visible = child.userData.regionId !== p.selected;
          const relevant = emphasis?.nodes.has(child.userData.regionId);
          (child.material as THREE.MeshPhysicalMaterial).opacity = emphasis?.active ? relevant ? 0.8 : 0.08 : 0.55;
        }
      });
      if (region && p.circuit) (region.material as THREE.MeshPhysicalMaterial).opacity = emphasis?.active ? emphasis.nodes.has(p.selected) ? 0.85 : 0.08 : 0.7;
      flowLinks.forEach((link) => {
        const relevant = emphasis?.edges.has(link.index);
        link.group.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child !== link.hit) (child.material as THREE.MeshBasicMaterial).opacity = relevant ? 0.95 : 0.10;
        });
      });
      syncFlow(false);
      render();
    }
    api.current = {
      update,
      openOrientation(x, y) {
        interacting = false;
        gesture.cancel();
        clearHover();
        setCameraUp(camera.up.clone());
        openOrientation(x, y);
      },
      align(direction) {
        autoFit = false;
        setCameraUp(camera.up.clone());
        alignSceneCamera(camera, controls.target, direction);
        controls.update();
        render();
      },
      zoom(factor) {
        autoFit = false;
        camera.position
          .sub(controls.target)
          .multiplyScalar(factor)
          .add(controls.target);
        controls.update();
        render();
      },
      focus: focusSelected,
      focusCircuit: () => {
        if (!circuitGroup) return;
        const box = new THREE.Box3().setFromObject(circuitGroup);
        if (box.isEmpty()) return;
        framing = "circuit"; autoFit = true;
        frameSphere(box.getBoundingSphere(new THREE.Sphere()));
      },
      reset: resetWhole,
    };
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      controls.handleResize();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (autoFit)
        frameSphere(framing === "region" ? selectedSphere() : framing === "circuit" && circuitGroup ? new THREE.Box3().setFromObject(circuitGroup).getBoundingSphere(new THREE.Sphere()) : wholeSphere);
      else render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    controls.addEventListener("change", cameraChanged);
    controls.addEventListener("start", startInteraction);
    controls.addEventListener("end", endInteraction);
    const keyboard = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing)
        return;
      const key = event.key.toLowerCase();
      if (key === "enter" && !latest.current.circuit) {
        event.preventDefault();
        setDetailsOpen(true);
        requestAnimationFrame(() => card.current?.focus({ preventScroll: true }));
        return;
      }
      if (key === "escape" && !latest.current.circuit) {
        setDetailsOpen(false); setHovered(null); return;
      }
      if (key === "escape" && latest.current.circuit) { latest.current.onCircuitClear?.(); return; }
      if (key === "+" || key === "=" || key === "-") {
        event.preventDefault();
        api.current?.zoom(key === "-" ? 1.15 : 0.85);
      } else if (key === "f" || key === "home") {
        event.preventDefault();

        if (key === "f") focusSelected();
        else resetWhole();
      } else if (
        ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)
      ) {
        event.preventDefault();
        autoFit = false;
        rotateSceneCamera(camera, controls.target,
          key === "arrowleft" ? -Math.PI / 24 : key === "arrowright" ? Math.PI / 24 : 0,
          key === "arrowup" ? -Math.PI / 24 : key === "arrowdown" ? Math.PI / 24 : 0);
        controls.update();

        render();
      }
    };
    renderer.domElement.addEventListener("keydown", keyboard);
    const pick = (event: MouseEvent) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) return;
      const rect = renderer.domElement.getBoundingClientRect(),
        mouse = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, camera);
      if (latest.current.circuit) return;
      const visiblePlanes = Object.values(planes).filter((m) => m.visible);
      const candidates = visiblePlanes.length
        ? visiblePlanes
        : root
          ? [root]
          : [];
      const hit = ray.intersectObjects(candidates).find((intersection) => {
        if (!visiblePlanes.length) return true;
        const position = fromWorld(
          intersection.point.toArray() as Position,
          props.data.dimensions,
          props.data.spacing,
        );
        return (
          props.data.annotation[voxelIndex(position, props.data.dimensions)] !==
          0
        );
      });
      if (hit)
        latest.current.onPosition(
          fromWorld(
            hit.point.toArray() as Position,
            props.data.dimensions,
            props.data.spacing,
          ),
        );
    };
    const gesture = new ScenePointerGesture();
    let hoverFrame: number | undefined;
    let previewTarget: CircuitTarget | null = null;
    const anatomicalHit = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(
        (event.clientX - rect.left) / rect.width * 2 - 1,
        -(event.clientY - rect.top) / rect.height * 2 + 1,
      ), camera);
      const targets = [...atlasMeshes.values(), ...(region ? [region] : [])].filter((mesh) => mesh.visible);
      return ray.intersectObjects(targets, false)[0]?.object as THREE.Mesh | undefined;
    };
    const clearHover = () => {
      if (hoverMesh) {
        (hoverMesh.material as THREE.MeshStandardMaterial).emissive.set(0x000000);
        hoverMesh = null;
        render();
      }
      setHovered(null);
    };
    const circuitHit = (event: MouseEvent): CircuitTarget | null => {
      if (!latest.current.circuit || !circuitGroup) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const targets: THREE.Object3D[] = [
        ...flowLinks.map((link) => link.hit),
        ...circuitGroup.children.filter((child) => child instanceof THREE.Mesh && child.visible),
        ...(region && latest.current.circuit.nodeIds.includes(latest.current.selected) ? [region] : []),
      ];
      const hits = ray.intersectObjects(targets, false);
      const hit = hits.find((h) => h.object.userData.edgeIndex !== undefined) ?? hits[0];
      if (!hit) return null;
      return hit.object.userData.edgeIndex !== undefined ? { kind: "edge", index: hit.object.userData.edgeIndex } : { kind: "node", id: hit.object.userData.regionId };
    };
    const preview = (event: PointerEvent) => {
      gesture.move(event);
      if (event.buttons || event.pointerType === "touch" || shiftHeld) return;
      if (hoverFrame !== undefined) cancelAnimationFrame(hoverFrame);
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = undefined;
        if (latest.current.circuit) {
          const target = circuitHit(event);
          if (!sameCircuitTarget(previewTarget, target)) {
            previewTarget = target;
            latest.current.onCircuitPreview?.(target);
          }
          renderer.domElement.style.cursor = target ? "pointer" : "grab";
        } else {
          const mesh = anatomicalHit(event);
          if (hoverMesh !== mesh) {
            clearHover();
            hoverMesh = mesh ?? null;
            if (hoverMesh) {
              const material = hoverMesh.material as THREE.MeshStandardMaterial;
              material.emissive.copy(material.color).multiplyScalar(0.22);
              render();
            }
          }
          const rect = renderer.domElement.getBoundingClientRect();
          setHovered(mesh ? { id: mesh.userData.regionId, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
          renderer.domElement.style.cursor = mesh ? "pointer" : "grab";
        }
      });
    };
    const leave = () => {
      if (hoverFrame !== undefined) cancelAnimationFrame(hoverFrame);
      hoverFrame = undefined;
      clearHover(); previewTarget = null;
      latest.current.onCircuitPreview?.(null);
      renderer.domElement.style.cursor = "grab";
    };
    const down = (event: PointerEvent) => {
      gesture.down(event); leave();
      renderer.domElement.style.cursor = "grabbing";
    };
    const up = (event: PointerEvent) => {
      renderer.domElement.style.cursor = "grab";
      if (gesture.up(event) && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        if (latest.current.circuit) {
          const target = circuitHit(event);
          if (target) latest.current.onCircuitSelect?.(target);
          else latest.current.onCircuitClear?.();
        } else {
          const mesh = anatomicalHit(event);
          if (mesh) {
            latest.current.onRegionSelect(mesh.userData.regionId);
            setDetailsOpen(true);
          } else setDetailsOpen(false);
        }
      }
    };
    const cancelPointer = () => {
      gesture.cancel();
      interacting = false;
      setCameraUp(camera.up.clone());
      leave();
    };
    const setShift = (value: boolean) => {
      if (shiftHeld === value) return;
      shiftHeld = value;
      if (value && !interacting) setCameraUp(camera.up.clone());
      gizmo?.setVisible(value);
      leave();
      update(latest.current);
    };
    const modifiers = (event: KeyboardEvent) => {
      if (event.key === "Control") controlHeld.current = event.type === "keydown";
      const editing = event.target instanceof HTMLElement &&
        !!event.target.closest("input, textarea, select, [contenteditable=true]");
      if (event.key === "Shift" && (event.type === "keyup" || !editing)) setShift(event.type === "keydown");
    };
    const blur = () => { controlHeld.current = false; setShift(false); cancelPointer(); interacting = false; };
    const routePointer = (event: PointerEvent) => {
      const pan = event.ctrlKey || controlHeld.current;
      if (event.button === 2 && !pan) {
        event.stopImmediatePropagation();
        return;
      }
      if (event.pointerType !== "touch") setShift(event.shiftKey);
      if (event.shiftKey && !pan) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
      // macOS can report Control-click as a secondary button; both routes must pan.
      controls.mouseButtons.LEFT = pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
      controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    };
    gizmo = createSliceGizmo(container, camera, () => latest.current, () => {
      gesture.cancel(); leave();
    });
    window.addEventListener("keydown", modifiers);
    window.addEventListener("keyup", modifiers);
    window.addEventListener("blur", blur);
    renderer.domElement.addEventListener("pointerdown", routePointer, true);
    renderer.domElement.addEventListener("pointercancel", cancelPointer);
    renderer.domElement.addEventListener("pointermove", preview);
    renderer.domElement.addEventListener("pointerleave", leave);
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    const motionPreference = () => {
      controls.staticMoving = reducedMotion.matches;
      syncFlow();
    };
    const visibilityChanged = () => syncFlow();
    reducedMotion.addEventListener("change", motionPreference);
    document.addEventListener("visibilitychange", visibilityChanged);
    renderer.domElement.addEventListener("dblclick", pick);
    const rootInfo = props.data.meshes[String(props.data.rootId ?? 997)];
    if (rootInfo)
      loadMeshGeometry(rootInfo.url, props.data, abort.signal)
        .then((geometry) => {
          if (abort.signal.aborted) {
            geometry.dispose();
            return;
          }
          root = new THREE.Mesh(
            geometry,
            new THREE.MeshPhysicalMaterial({
              color: "#b8b0c6",
              roughness: 0.53,
              metalness: 0,
              transparent: true,
              opacity: latest.current.opacity,
              depthWrite: false,
              side: THREE.DoubleSide,
            }),
          );
          root.renderOrder = 2;
          scene.add(root);
          if (geometry.boundingSphere)
            wholeSphere = geometry.boundingSphere.clone();
          setRootLoading(false);
          if (framing === "whole" && autoFit) frameSphere(wholeSphere);
          render();
        })
        .catch((e) => {
          if (!abort.signal.aborted) {
            setRootLoading(false);
            setError(`全脑表面加载失败：${e.message}`);
          }
        });
    resize();
    update(latest.current);
    setReady(true);
    const lost = (e: Event) => {
      e.preventDefault();
      setReady(false);
      setError("三维图形上下文已中断，请重新载入三维视图。");
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      abort.abort();
      controlHeld.current = false;
      if (cameraFrame !== undefined) cancelAnimationFrame(cameraFrame);
      if (hoverFrame !== undefined) cancelAnimationFrame(hoverFrame);
      regionAbort?.abort();
      clearCircuit();
      vessels.dispose();
      api.current = null;
      observer.disconnect();
      themeObserver.disconnect();
      controls.dispose();
      gizmo?.dispose();
      window.removeEventListener("keydown", modifiers);
      window.removeEventListener("keyup", modifiers);
      window.removeEventListener("blur", blur);
      renderer.domElement.removeEventListener("pointerdown", routePointer, true);
      renderer.domElement.removeEventListener("pointercancel", cancelPointer);
      renderer.domElement.removeEventListener("pointermove", preview);
      renderer.domElement.removeEventListener("pointerleave", leave);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      reducedMotion.removeEventListener("change", motionPreference);
      document.removeEventListener("visibilitychange", visibilityChanged);
      renderer.domElement.removeEventListener("dblclick", pick);
      renderer.domElement.removeEventListener("keydown", keyboard);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) disposeMesh(object);
        else if (object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.data, retry, helpId]);
  useEffect(() => {
    const container = host.current;
    container?.querySelector("canvas")?.setAttribute("aria-label", text(SCENE_ARIA_LABEL));
    container?.querySelector(".slice-gizmo")?.setAttribute("aria-label", text("正交切面位置箭头"));
    container?.querySelectorAll<HTMLElement>(".slice-gizmo [data-axis]").forEach((handle) => {
      handle.setAttribute("aria-label", text(`${handle.dataset.axis} 切面位置`));
    });
  }, [text, props.data, retry]);
  useEffect(
    () => api.current?.update(props),
    [
      props.position,
      props.selected,
      props.color,
      props.opacity,
      props.planeDisplay,
      props.overlay,
      props.contrast,
      props.circuit,
      props.circuitTarget,
      props.circuitFlow,
      props.whiteMatterData,
      props.sliceData,
      props.isolateRegion,
      props.vasculature,
      props.vesselFilter,
      props.vesselsAboveOnly,
    ],
  );
  return (
    <div className="brain-scene" onContextMenu={(event) => {
      event.preventDefault();
      if (event.ctrlKey || controlHeld.current) return;
      api.current?.openOrientation(event.clientX, event.clientY);
    }}>
      <div ref={host} className="three-host" />
      <div className="scene-caption">
        <span className="eyebrow">ANATOMY STUDIO</span>
        <span>{text(props.datasetLabel ?? "Allen CCFv3")}</span>
        <span className="scene-coverage">{props.circuit ? t(`${props.circuit.nodeIds.length} 个环路节点`, `${props.circuit.nodeIds.length} circuit regions`) : props.selected < 0 ? t("当前白质结构", "Selected white matter structure") : t(`${props.regions?.filter((r) => r.id > 0 && props.data.meshes[String(r.id)]).length ?? 0} 个导览脑区`, `${props.regions?.filter((r) => r.id > 0 && props.data.meshes[String(r.id)]).length ?? 0} featured regions`)}</span>
      </div>
      {hovered && hoveredRegion && !props.circuit && (
        <div className="scene-hover-label" style={{
          left: Math.min(hovered.x + 16, Math.max(12, (host.current?.clientWidth ?? 500) - 220)),
          top: Math.max(72, hovered.y - 52),
        }}>
          <span className="region-dot" style={{ background: hoveredRegion.color }} />
          <strong>{text(hoveredRegion.name)}</strong><small>{hoveredRegion.acronym} · {t("点击查看", "Click for details")}</small>
        </div>
      )}
      {detailsOpen && selectedRegion && !props.circuit && (
        <section ref={card} tabIndex={-1} className="scene-region-card" aria-labelledby={cardTitle}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDetailsOpen(false);
              host.current?.querySelector("canvas")?.focus({ preventScroll: true });
            }
          }}>
          <div className="scene-region-meta">
            <span className="region-dot" style={{ background: selectedRegion.color }} />
            <span>{text(selectedRegion.category)}</span>
            <button aria-label={t("关闭脑区详情", "Close region details")} title={t("关闭脑区详情", "Close region details")} onClick={() => {
              setDetailsOpen(false);
              host.current?.querySelector("canvas")?.focus({ preventScroll: true });
            }}><X size={17} /></button>
          </div>
          <h2 id={cardTitle}>{text(selectedRegion.name)}</h2>
          <p className="scene-region-english">{locale === "zh" ? `${selectedRegion.englishName} · ` : ""}{selectedRegion.acronym}</p>
          <p className="scene-region-summary">{text(selectedRegion.summary)}</p>
          <div className="scene-region-actions">
            <button onClick={() => { props.onIsolateRegion(true); api.current?.focus(); }}><Focus size={15} />{t("单独观察", "Isolate structure")}</button>
            <button onClick={props.onLocateSlices}><Crosshair size={15} />{t("定位切片", "Locate in slices")}</button>
          </div>
          <button className="scene-read-more" onClick={() => { setDetailsOpen(false); props.onReadRegion(); }}>
            {t("功能、证据与文献", "Function, evidence and references")} <ArrowUpRight size={16} />
          </button>
        </section>
      )}
      {orientationPosition && (
        <div ref={orientation} popover="auto" className="scene-orientation" role="dialog"
          aria-label={t("正对切面", "Face a slice plane")} style={{ left: orientationPosition.x, top: orientationPosition.y }}
          onToggle={(event) => { if (event.newState === "closed") setOrientationPosition(null); }}>
          <strong>{t("正对切面", "Face a slice plane")}</strong>
          <p>{t("保持切面位置、缩放与观察中心", "Preserves slice positions, zoom and view center")}</p>
          {PLANE_ORDER.map((name) => (
            <div className="scene-orientation-group" key={name} role="group" aria-label={text(PLANES[name].name)}>
              <span className="scene-orientation-plane">
                <span className="region-dot" style={{ background: PLANES[name].color }} />
                {text(PLANES[name].name)}
              </span>
              <div className="scene-orientation-sides">
                {(Object.keys(SCENE_DIRECTIONS) as SceneDirection[])
                  .filter((direction) => SCENE_DIRECTIONS[direction].plane === name)
                  .map((direction) => (
                    <button key={direction} type="button"
                      aria-label={t(`${PLANES[name].name}，从${SCENE_DIRECTIONS[direction].label}观察`,
                        `${text(PLANES[name].name)}, view from ${text(SCENE_DIRECTIONS[direction].label)}`)}
                      onClick={() => {
                        api.current?.align(direction);
                        orientation.current?.hidePopover();
                        host.current?.querySelector("canvas")?.focus({ preventScroll: true });
                      }}>
                      {t(`从${SCENE_DIRECTIONS[direction].label}看`, `From ${text(SCENE_DIRECTIONS[direction].label)}`)}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="scene-actions">
        {!props.circuit && <button className="scene-details-button" disabled={!ready} onClick={() => setDetailsOpen(!detailsOpen)} aria-expanded={detailsOpen} aria-label={t("脑区详情", "Region details")}><span className="desktop-copy">{t("脑区详情", "Region details")}</span><span className="mobile-copy">{t("详情", "Details")}</span></button>}
        {props.circuit && <button className="scene-circuit-focus" type="button" aria-label={t("聚焦整个环路", "Focus entire circuit")} title={t("聚焦整个环路", "Focus entire circuit")} disabled={!ready} onClick={() => api.current?.focusCircuit()}>{t("全环路", "Full circuit")}</button>}
        <button className="scene-orientation-button" type="button" disabled={!ready} aria-label={t("选择观察方向", "Choose view direction")} onClick={() => api.current?.openOrientation()}>{t("视角", "View")}</button>
        <button
          type="button"
          className="scene-focus-button"
          aria-label={t("聚焦所选结构", "Focus selected structure")}
          title={t("聚焦所选结构（F）", "Focus selected structure (F)")}
          disabled={!ready}
          onClick={() => {

            api.current?.focus();
          }}
        >
          <Focus size={17} aria-hidden="true" />
          <span>{t("聚焦所选结构", "Focus selected structure")}</span>
        </button>
        <button
          type="button"
          disabled={!ready}
          className="scene-zoom-in"
          aria-label={t("放大三维脑", "Zoom in on the 3D brain")}
          title={t("放大", "Zoom in")}
          onClick={() => api.current?.zoom(0.85)}
        >
          <Plus size={17} />
        </button>
        <button
          type="button"
          disabled={!ready}
          className="scene-zoom-out"
          aria-label={t("缩小三维脑", "Zoom out of the 3D brain")}
          title={t("缩小", "Zoom out")}
          onClick={() => api.current?.zoom(1.15)}
        >
          <Minus size={17} />
        </button>
        <button
          type="button"
          disabled={!ready}
          className="scene-reset-view"
          aria-label={t("重置三维视角", "Reset 3D view")}
          title={t("查看全脑（Home）", "View the whole brain (Home)")}
          onClick={() => {

            api.current?.reset();
          }}
        >
          <RotateCcw size={16} />
        </button>
      </div>
      <div className="scene-instruction" id={helpId}>
        <span className="desktop-copy">{props.circuit ? t("悬停强调 · 点击保持 · 拖动旋转 · 右键正对切面 · 滚轮缩放 · Esc 清除", "Hover to highlight · Click to hold · Drag to rotate · Right-click for plane views · Scroll to zoom · Esc to clear") : t("点击选区 · 拖动旋转 · Ctrl 平移 · Shift 切面 · 右键正对切面 · 滚轮缩放", "Click to select · Drag to rotate · Ctrl to pan · Shift for slices · Right-click for plane views · Scroll to zoom")}</span>
        <span className="mobile-copy">{t("单指旋转 · 双指缩放与平移", "One finger to rotate · Two fingers to zoom and pan")}</span>
      </div>
      <details className="scene-help">
        <summary>
          <CircleHelp size={16} aria-hidden="true" />
          <span>{t("操作帮助", "Controls")}</span>
        </summary>
        <div className="scene-help-content">
          <p>
            {t("单击彩色脑区打开详情并同步目录和切片。拖动旋转，Ctrl + 拖动平移；按住 Shift 显示正交切面箭头，拖动 AP、DV、ML 箭头移动对应切面，滚轮缩放；触屏单指旋转、双指缩放和平移。", "Click a colored region to open its details and synchronize the catalog and slices. Drag to rotate, Ctrl-drag to pan, and scroll to zoom. Hold Shift to show orthogonal slice handles; drag the AP, DV or ML handle to move its plane. On touchscreens, use one finger to rotate and two fingers to zoom and pan.")}
          </p>
          <p>
            {t("按 Tab 聚焦三维视图后，用方向键旋转，+ / − 缩放，F 聚焦所选结构，Home 返回全脑，Enter 打开详情，Esc 关闭。也可用脑区索引选择被外层遮挡的结构。", "Tab to the 3D view, then use arrow keys to rotate, + / − to zoom, F to focus the selected structure, Home for the whole brain, Enter for details, and Esc to close. Use the region index to select structures hidden beneath outer surfaces.")}
          </p>
          <p>
            {t("在三维视图任意位置右键，可从头侧／尾侧正对冠状面、左侧／右侧正对矢状面、腹侧／背侧正对水平面，保持切面位置、缩放和观察中心。切换脑区后，可用“聚焦所选结构”查看小核团。", "Right-click anywhere in the 3D view to face the coronal plane from the anterior or posterior side, the sagittal plane from the left or right, or the horizontal plane from the ventral or dorsal side. Slice positions, zoom and view center stay fixed. After changing regions, use “Focus selected structure” to inspect small nuclei.")}
          </p>
          <button type="button" disabled={!ready} onClick={() => api.current?.openOrientation()}>{t("正对切面…", "Face a slice plane…")}</button>
        </div>
      </details>
      <div className="axis-legend" aria-label={t("当前交点坐标，毫米", "Current crosshair coordinates, millimetres")}>
        <span className="axis-legend-title">{t("交点 · mm", "Crosshair · mm")}</span>
        {(["coronal", "horizontal", "sagittal"] as const).map((name) => {
          const axis = PLANES[name].axis;
          const label = axis === 0 ? "AP" : axis === 1 ? "DV" : "ML";
          const value = coordinateMm(props.position[axis], axis, props.data.spacing,
            props.apZeroUm, props.mlZeroUm, props.dvZeroUm);
          return <span key={name} data-axis={label}>
            <b style={{ color: PLANES[name].color }}>{label}</b> {value.toFixed(2)}
          </span>;
        })}
      </div>
      {props.circuit && (
        <div className="scene-circuit-label">
          {text(props.circuit.name)} · {text(circuitSelectionLabel)}
        </div>
      )}
      {circuitStatus && (
        <div className="circuit-load-status" role="status">
          {text(circuitStatus)}
          {circuitStatus.includes("未能") && (
            <button type="button" onClick={retryScene}>
              {t("重试", "Retry")}
            </button>
          )}
        </div>
      )}
      {atlasStatus && !props.circuit && (
        <div className="atlas-mesh-status" role="status">
          {text(atlasStatus)}
          {atlasStatus.includes("未能") && <button onClick={retryScene}>{t("重试", "Retry")}</button>}
        </div>
      )}
      {(rootLoading || meshStatus) && (
        <div className="mesh-status" role="status">
          {text(rootLoading ? "正在载入全脑表面…" : meshStatus)}
          {!rootLoading && meshStatus.includes("失败") && (
            <button type="button" onClick={retryScene}>
              {t("重试", "Retry")}
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="scene-error" role="alert">
          <p>{text(error)}</p>
          <button type="button" onClick={retryScene}>
            {t("重新载入三维视图", "Reload 3D view")}
          </button>
        </div>
      )}
    </div>
  );
}
