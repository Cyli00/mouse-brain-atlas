import type { BrainCircuit } from "../data/circuits";
import type { BrainRegion } from "../data/regions";
import { CONNECTION_COLORS } from "./CircuitPanel";
import { useEffect, useId, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RotateCcw, Plus, Minus, Focus, CircleHelp } from "lucide-react";
import { invalidateMeshCache, loadMeshGeometry } from "../lib/mesh-cache";
import {
  PLANES,
  PLANE_ORDER,
  toWorld,
  fromWorld,
  voxelIndex,
  makeSlice,
  type AtlasData,
  type PlaneName,
  type Position,
} from "../lib/atlas";
type Props = {
  data: AtlasData;
  position: Position;
  selected: number;
  color: string;
  opacity: number;
  showPlanes: boolean;
  overlay: boolean;
  contrast: number;
  onPosition: (p: Position) => void;
  circuit?: BrainCircuit;
  regions?: BrainRegion[];
  datasetLabel?: string;
};
type SceneAPI = {
  update: (p: Props) => void;
  view: (name: string) => void;
  zoom: (factor: number) => void;
  focus: () => void;
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
export function BrainScene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    api = useRef<SceneAPI | null>(null),
    latest = useRef(props);
  latest.current = props;
  const [error, setError] = useState(""),
    [meshStatus, setMeshStatus] = useState("正在载入三维脑表面…"),
    [retry, setRetry] = useState(0);
  const [view, setView] = useState("3d");
  const [circuitStatus, setCircuitStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [rootLoading, setRootLoading] = useState(true);
  const helpId = useId();
  const retryScene = () => {
    const current = latest.current;
    const ids = [
      current.data.rootId ?? 997,
      current.selected,
      ...(current.circuit?.nodeIds ?? []),
    ];
    invalidateMeshCache(
      ids.flatMap((id) => current.data.meshes[String(id)]?.url ?? []),
    );
    setView("3d");
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
    renderer.setClearColor("#edf2f3", 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "小鼠三维脑视图，方向键旋转，加减键缩放，F 聚焦脑区，Home 查看全脑",
    );
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-describedby", helpId);
    renderer.domElement.setAttribute(
      "aria-keyshortcuts",
      "ArrowLeft ArrowRight ArrowUp ArrowDown + - f Home",
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
    let framing: "whole" | "region" = "whole";
    let autoFit = true;
    camera.position.copy(baseCamera);
    let controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    const configureControls = (orbit: OrbitControls) => {
      orbit.minDistance = Math.max(
        (props.data.spacing / 1000) * 3,
        0.1 * modelScale,
      );
      orbit.maxDistance = gridSize.length() * 12;
      orbit.enableDamping = false;
      orbit.enablePan = true;
    };
    configureControls(controls);
    scene.add(new THREE.HemisphereLight("#ffffff", "#99a5af", 2.4));
    const light = new THREE.DirectionalLight("#ffffff", 3);
    light.position.set(-8, 15, 8);
    scene.add(light);
    const light2 = new THREE.DirectionalLight("#b5d9df", 1.6);
    light2.position.set(8, -2, -8);
    scene.add(light2);
    let root: THREE.Mesh | undefined,
      region: THREE.Mesh | undefined,
      regionAbort: AbortController | undefined,
      lastId = -1;
    let circuitGroup: THREE.Group | undefined,
      circuitAbort: AbortController | undefined,
      lastCircuit = "";
    const clearCircuit = () => {
      circuitAbort?.abort();
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
    const render = () => {
      if (!abort.signal.aborted) renderer.render(scene, camera);
    };
    const startInteraction = () => {
      autoFit = false;
    };
    const setCameraUp = (up: THREE.Vector3) => {
      if (camera.up.equals(up)) return;
      const target = controls.target.clone();
      controls.dispose();
      camera.up.copy(up);
      // OrbitControls captures the up axis at construction; rebuild it when a preset changes that axis.
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(target);
      configureControls(controls);
      controls.addEventListener("change", render);
      controls.addEventListener("start", startInteraction);
    };
    const selectedSphere = () => {
      if (region?.geometry.boundingSphere)
        return region.geometry.boundingSphere.clone();
      const focus =
        latest.current.data.meshes[String(latest.current.selected)]?.centroid ??
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
    function update(p: Props) {
      const world = toWorld(p.position, p.data.dimensions, p.data.spacing),
        d = p.data.dimensions,
        s = p.data.spacing / 1000;
      marker.position.set(...world);
      if (region) {
        const material = region.material as THREE.MeshPhysicalMaterial;
        material.color.set(p.color);
        material.opacity = p.circuit?.id ? 0.42 : 0.94;
        material.depthWrite = !p.circuit;
      }
      if (root)
        (root.material as THREE.MeshPhysicalMaterial).opacity = p.opacity;
      for (const name of PLANE_ORDER) {
        const mesh = planes[name],
          plane = PLANES[name],
          material = mesh.material as THREE.MeshBasicMaterial;
        mesh.visible = p.showPlanes;
        outlines[name].visible = p.showPlanes;
        const sliceKey = `${p.position[plane.axis]}:${p.overlay ? p.selected : 0}:${p.overlay}:${p.contrast}`;
        if (p.showPlanes && sliceKeys[name] !== sliceKey) {
          const image = makeSlice(
            p.data,
            name,
            p.position,
            p.selected,
            p.overlay,
            p.contrast,
          );
          const strides = [1, d[0], d[0] * d[1]];
          const base = p.position[plane.axis] * strides[plane.axis];
          for (let v = 0; v < image.height; v++)
            for (let u = 0; u < image.width; u++) {
              const index = base + u * strides[plane.u] + v * strides[plane.v];
              if (!p.data.annotation[index])
                image.data[(v * image.width + u) * 4 + 3] = 0;
            }
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
      if (lastId !== p.selected) {
        lastId = p.selected;
        regionAbort?.abort();
        regionAbort = new AbortController();
        const current = regionAbort;
        if (region) {
          scene.remove(region);
          disposeMesh(region);
          region = undefined;
        }
        const info = p.data.meshes[String(p.selected)];
        if (info) {
          setMeshStatus("正在载入所选脑区…");
          loadMeshGeometry(info.url, p.data, current.signal)
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
              region.renderOrder = 1;
              scene.add(region);
              setMeshStatus("");
              if (framing === "region" && autoFit)
                frameSphere(selectedSphere());
              render();
            })
            .catch((e) => {
              if (!current.signal.aborted && !abort.signal.aborted)
                setMeshStatus(`脑区表面加载失败，请重试。${e.message}`);
            });
        } else setMeshStatus("该脑区暂无三维表面，可在切片中查看标注。");
      }
      if (lastCircuit !== (p.circuit?.id ?? "")) {
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
          for (const edge of p.circuit.edges) {
            const source = p.data.meshes[String(edge.from)]?.centroid,
              target = p.data.meshes[String(edge.to)]?.centroid;
            if (!source || !target) continue;
            const from = new THREE.Vector3(
                ...toWorld(source, p.data.dimensions, p.data.spacing),
              ),
              to = new THREE.Vector3(
                ...toWorld(target, p.data.dimensions, p.data.spacing),
              );
            const vector = to.clone().sub(from),
              length = vector.length();
            if (length < 0.01) continue;
            const arrow = new THREE.ArrowHelper(
              vector.normalize(),
              from,
              length,
              CONNECTION_COLORS[edge.kind],
              Math.min(0.28 * modelScale, length * 0.25),
              Math.min(0.13 * modelScale, length * 0.12),
            );
            arrow.line.geometry = arrow.line.geometry.clone();
            arrow.cone.geometry = arrow.cone.geometry.clone();
            // Render schematic connections after transparent anatomy so internal arrows stay legible.
            for (const material of [
              arrow.line.material,
              arrow.cone.material,
            ] as THREE.Material[]) {
              material.depthTest = false;
              material.depthWrite = false;
              material.transparent = true;
            }
            const connection = new THREE.Mesh(
              new THREE.TubeGeometry(
                new THREE.LineCurve3(from, to),
                1,
                0.035 * modelScale,
                6,
                false,
              ),
              new THREE.MeshBasicMaterial({
                color: CONNECTION_COLORS[edge.kind],
                depthTest: false,
                depthWrite: false,
                transparent: true,
              }),
            );
            connection.renderOrder = 7;
            group.add(connection);
            arrow.line.renderOrder = 8;
            arrow.cone.renderOrder = 8;
            group.add(arrow);
          }
        }
      }
      circuitGroup?.children.forEach((child) => {
        if (child instanceof THREE.Mesh)
          child.visible = child.userData.regionId !== p.selected;
      });
      render();
    }
    api.current = {
      update,
      view(name) {
        autoFit = true;
        setCameraUp(
          name === "horizontal"
            ? new THREE.Vector3(0, 0, -1)
            : new THREE.Vector3(0, 1, 0),
        );
        let direction = baseCamera;
        if (name === "coronal") direction = new THREE.Vector3(0, 0, 1);
        else if (name === "sagittal") direction = new THREE.Vector3(1, 0, 0);
        else if (name === "horizontal") {
          direction = new THREE.Vector3(0, 1, 0);
        }
        frameSphere(
          framing === "region" ? selectedSphere() : wholeSphere,
          direction,
        );
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
      reset: resetWhole,
    };
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (autoFit)
        frameSphere(framing === "region" ? selectedSphere() : wholeSphere);
      else render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    controls.addEventListener("change", render);
    controls.addEventListener("start", startInteraction);
    const keyboard = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing)
        return;
      const key = event.key.toLowerCase();
      if (key === "+" || key === "=" || key === "-") {
        event.preventDefault();
        api.current?.zoom(key === "-" ? 1.15 : 0.85);
      } else if (key === "f" || key === "home") {
        event.preventDefault();
        setView("3d");
        if (key === "f") focusSelected();
        else resetWhole();
      } else if (
        ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)
      ) {
        event.preventDefault();
        autoFit = false;
        const rotation = new THREE.Quaternion().setFromUnitVectors(
          camera.up,
          new THREE.Vector3(0, 1, 0),
        );
        const offset = camera.position
          .clone()
          .sub(controls.target)
          .applyQuaternion(rotation);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        const step = Math.PI / 24;
        if (key === "arrowleft") spherical.theta -= step;
        if (key === "arrowright") spherical.theta += step;
        if (key === "arrowup") spherical.phi -= step;
        if (key === "arrowdown") spherical.phi += step;
        spherical.phi = THREE.MathUtils.clamp(
          spherical.phi,
          0.02,
          Math.PI - 0.02,
        );
        offset.setFromSpherical(spherical).applyQuaternion(rotation.invert());
        camera.position.copy(controls.target).add(offset);
        controls.update();
        setView("3d");
        render();
      }
    };
    renderer.domElement.addEventListener("keydown", keyboard);
    const pick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect(),
        mouse = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, camera);
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
              color: "#c4c5ba",
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
      regionAbort?.abort();
      clearCircuit();
      api.current = null;
      observer.disconnect();
      controls.dispose();
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
  useEffect(
    () => api.current?.update(props),
    [
      props.position,
      props.selected,
      props.color,
      props.opacity,
      props.showPlanes,
      props.overlay,
      props.contrast,
      props.circuit,
    ],
  );
  return (
    <div className="brain-scene">
      <div ref={host} className="three-host" />
      <div className="scene-caption">
        <span className="eyebrow">三维结构</span>
        <span>{props.datasetLabel ?? "Allen CCFv3"}</span>
      </div>
      <div className="view-switch" aria-label="三维观察方向">
        {[
          ["3d", "自由视角"],
          ["coronal", "冠状"],
          ["sagittal", "矢状"],
          ["horizontal", "水平"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={!ready}
            aria-pressed={view === value}
            onClick={() => {
              setView(value);
              api.current?.view(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="scene-actions">
        <button
          type="button"
          className="scene-focus-button"
          aria-label="聚焦所选脑区"
          title="聚焦所选脑区（F）"
          disabled={!ready}
          onClick={() => {
            setView("3d");
            api.current?.focus();
          }}
        >
          <Focus size={17} aria-hidden="true" />
          <span>聚焦脑区</span>
        </button>
        <button
          type="button"
          disabled={!ready}
          aria-label="放大三维脑"
          title="放大"
          onClick={() => api.current?.zoom(0.85)}
        >
          <Plus size={17} />
        </button>
        <button
          type="button"
          disabled={!ready}
          aria-label="缩小三维脑"
          title="缩小"
          onClick={() => api.current?.zoom(1.15)}
        >
          <Minus size={17} />
        </button>
        <button
          type="button"
          disabled={!ready}
          aria-label="重置三维视角"
          title="查看全脑（Home）"
          onClick={() => {
            setView("3d");
            api.current?.reset();
          }}
        >
          <RotateCcw size={16} />
        </button>
      </div>
      <div className="scene-instruction" id={helpId}>
        拖动旋转 · 滚轮缩放 · {props.showPlanes ? "双击切面定位" : "双击脑表面定位"}
      </div>
      <details className="scene-help">
        <summary>
          <CircleHelp size={16} aria-hidden="true" />
          <span>操作帮助</span>
        </summary>
        <div className="scene-help-content">
          <p>
            拖动旋转视角，滚轮缩放；双指可在触屏上缩放和平移。双击有标注的切面可联动定位。
          </p>
          <p>
            按 Tab 聚焦三维视图后，用方向键旋转，+ / − 缩放，F
            聚焦所选脑区，Home 返回全脑。
          </p>
          <p>
            切换脑区后，可用“聚焦脑区”查看小核团。观察方向按钮沿当前观察范围切换视角。
          </p>
        </div>
      </details>
      <div className="axis-legend">
        <span style={{ color: PLANES.coronal.color }}>AP</span>
        <span style={{ color: PLANES.horizontal.color }}>DV</span>
        <span style={{ color: PLANES.sagittal.color }}>ML</span>
      </div>
      {props.circuit && (
        <div className="scene-circuit-label">
          {props.circuit.name} · 投射关系示意
        </div>
      )}
      {circuitStatus && (
        <div className="circuit-load-status" role="status">
          {circuitStatus}
          {circuitStatus.includes("未能") && (
            <button type="button" onClick={retryScene}>
              重试
            </button>
          )}
        </div>
      )}
      {(rootLoading || meshStatus) && (
        <div className="mesh-status" role="status">
          {rootLoading ? "正在载入全脑表面…" : meshStatus}
          {!rootLoading && meshStatus.includes("失败") && (
            <button type="button" onClick={retryScene}>
              重试
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="scene-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={retryScene}>
            重新载入三维视图
          </button>
        </div>
      )}
    </div>
  );
}
