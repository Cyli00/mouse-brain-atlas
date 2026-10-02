import * as THREE from "three";
import { createMeshGeometry, type MeshSpace } from "./mesh-geometry";
import type { Vasculature, VesselFilter, VesselGroup } from "./vasculature";

type VesselColors = Record<VesselGroup, string>;
type VesselState = {
  data: Vasculature | null;
  filter: VesselFilter;
  aboveOnly: boolean;
  dorsalWorldY: number;
};

export function vesselColorsFromStyle(style: Pick<CSSStyleDeclaration, "getPropertyValue">): VesselColors {
  return {
    sinus: style.getPropertyValue("--vessel-sinus").trim(),
    artery: style.getPropertyValue("--vessel-artery").trim(),
    vein: style.getPropertyValue("--vessel-vein").trim(),
  };
}

export function createSceneVasculature(scene: THREE.Scene, space: MeshSpace, initialColors: VesselColors) {
  const group = new THREE.Group();
  group.name = "vasculature";
  group.visible = false;
  scene.add(group);
  const materials = new Map<VesselGroup, THREE.MeshStandardMaterial>();
  const meshes: { group: VesselGroup; mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> }[] = [];
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const clipPlanes = [clipPlane];
  let residentData: Vasculature | null = null;
  let colors = initialColors;
  let filter: VesselFilter = "all";
  let clippingEnabled = false;
  let visibleCount = 0;
  let disposed = false;

  function clearGeometry() {
    for (const { mesh } of meshes) mesh.geometry.dispose();
    meshes.length = 0;
    group.clear();
    residentData = null;
    visibleCount = 0;
  }

  function materialFor(kind: VesselGroup) {
    let material = materials.get(kind);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: colors[kind], roughness: 0.6, metalness: 0, side: THREE.DoubleSide,
        clippingPlanes: clippingEnabled ? clipPlanes : null,
      });
      materials.set(kind, material);
    }
    return material;
  }

  return {
    update(state: VesselState): number {
      if (disposed) return 0;
      // The workspace retains loaded data when the layer is disabled. Keep its
      // GPU geometry too, so reopening does not transform vertices or rebuild normals.
      group.visible = !!state.data;
      if (!state.data) return 0;
      const replaced = state.data !== residentData;
      if (replaced) {
        clearGeometry();
        for (const vessel of state.data.vessels) {
          const mesh = new THREE.Mesh(createMeshGeometry(vessel, space), materialFor(vessel.group));
          mesh.name = vessel.name;
          meshes.push({ group: vessel.group, mesh });
          group.add(mesh);
        }
        residentData = state.data;
      }
      if (replaced || filter !== state.filter) {
        filter = state.filter;
        visibleCount = 0;
        for (const entry of meshes) {
          entry.mesh.visible = filter === "all" || entry.group === filter;
          if (entry.mesh.visible) visibleCount++;
        }
      }
      if (clippingEnabled !== state.aboveOnly) {
        clippingEnabled = state.aboveOnly;
        for (const material of materials.values()) {
          material.clippingPlanes = clippingEnabled ? clipPlanes : null;
          material.needsUpdate = true;
        }
      }
      // World +Y is dorsal. Moving the shared plane updates its uniform, without
      // recompiling materials or touching geometry; AP/ML moves leave it alone.
      if (clippingEnabled && clipPlane.constant !== -state.dorsalWorldY)
        clipPlane.constant = -state.dorsalWorldY;
      return visibleCount;
    },
    setColors(next: VesselColors) {
      for (const [kind, material] of materials)
        if (colors[kind] !== next[kind]) material.color.set(next[kind]);
      colors = next;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      clearGeometry();
      for (const material of materials.values()) material.dispose();
      materials.clear();
    },
  };
}
