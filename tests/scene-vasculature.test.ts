import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createSceneVasculature } from "../src/lib/scene-vasculature";
import type { Vasculature, VesselGroup } from "../src/lib/vasculature";

const space = { dimensions: [264, 160, 228] as [number, number, number], spacing: 50 };
const colors = { sinus: "#74569b", artery: "#a33e4b", vein: "#3b6e9c" };
function fixture(): Vasculature {
  return { vessels: (["sinus", "artery", "artery", "vein"] as VesselGroup[]).map((group, index) => ({
    id: index + 1, name: `vessel-${index}`, group,
    positions: new Float32Array([1000, 2000, 3000, 1050, 2000, 3000, 1000, 2050, 3000]),
    indices: new Uint32Array([0, 1, 2]),
  })) };
}
function setup() {
  const scene = new THREE.Scene();
  const layer = createSceneVasculature(scene, space, colors);
  const data = fixture();
  const state = { data, filter: "all" as const, aboveOnly: false, dorsalWorldY: 1 };
  const mesh = (index: number) => scene.getObjectByName(`vessel-${index}`) as
    THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  return { scene, layer, data, state, mesh };
}

test("hiding and reopening vessels reuses geometry, normals, and category materials", () => {
  const { scene, layer, data, state, mesh } = setup();
  const original = data.vessels.map((vessel) => ({
    positions: new Float32Array(vessel.positions), indices: new Uint32Array(vessel.indices),
  }));
  assert.equal(layer.update(state), 4);
  const geometries = data.vessels.map((_, index) => mesh(index).geometry);
  const normals = geometries.map((geometry) => geometry.getAttribute("normal"));
  assert.equal(mesh(1).material, mesh(2).material, "same-category vessels share a material");
  let disposed = 0;
  geometries.forEach((geometry) => geometry.addEventListener("dispose", () => disposed++));
  for (let toggle = 0; toggle < 10; toggle++) {
    assert.equal(layer.update({ ...state, data: null }), 0);
    assert.equal(scene.getObjectByName("vasculature")?.visible, false);
    assert.equal(layer.update(state), 4);
    data.vessels.forEach((_, index) => {
      assert.equal(mesh(index).geometry, geometries[index]);
      assert.equal(mesh(index).geometry.getAttribute("normal"), normals[index]);
    });
  }
  assert.equal(disposed, 0);
  data.vessels.forEach((vessel, index) => {
    assert.deepEqual(vessel.positions, original[index].positions);
    assert.deepEqual(vessel.indices, original[index].indices);
  });
  layer.dispose();
  assert.equal(disposed, 4);
});

test("filtering and clipping update only visibility and shared plane uniforms", () => {
  const { layer, state, mesh } = setup();
  layer.update(state);
  const geometry = mesh(1).geometry;
  const material = mesh(1).material;
  assert.equal(layer.update({ ...state, filter: "artery" }), 2);
  assert.equal(mesh(0).visible, false);
  assert.equal(mesh(1).visible, true);
  assert.equal(mesh(3).visible, false);
  const clipped = { ...state, filter: "artery" as const, aboveOnly: true };
  layer.update(clipped);
  const plane = material.clippingPlanes![0];
  const version = material.version;
  assert.equal(plane.constant, -1);
  assert.equal(mesh(0).material.clippingPlanes![0], plane);
  for (let update = 0; update < 100; update++) layer.update(clipped);
  layer.update({ ...clipped, dorsalWorldY: 2 });
  assert.equal(plane.constant, -2);
  assert.equal(material.version, version, "plane movement must not recompile vessel materials");
  assert.equal(mesh(1).geometry, geometry);
  layer.update({ ...clipped, aboveOnly: false });
  assert.equal(material.clippingPlanes, null);
  assert.equal(material.version, version + 1, "only a clipping mode change invalidates the shader");
  layer.dispose();
});

test("hidden vessels receive theme/filter changes on reopening without rebuilding", () => {
  const { layer, state, mesh } = setup();
  layer.update(state);
  const geometry = mesh(1).geometry;
  const material = mesh(1).material;
  layer.update({ ...state, data: null });
  layer.setColors({ ...colors, artery: "#ff8e9c" });
  assert.equal(layer.update({ ...state, filter: "vein", aboveOnly: true, dorsalWorldY: 3 }), 1);
  assert.equal(mesh(1).geometry, geometry);
  assert.equal(material.color.getHexString(), "ff8e9c");
  assert.equal(material.clippingPlanes![0].constant, -3);
  assert.equal(mesh(1).visible, false);
  assert.equal(mesh(3).visible, true);
  layer.dispose();
});

test("data replacement and disposal release owned geometry exactly once", () => {
  const { scene, layer, state, mesh } = setup();
  layer.update(state);
  const oldGeometry = mesh(0).geometry;
  let geometryDisposals = 0;
  let materialDisposals = 0;
  for (let index = 0; index < 4; index++)
    mesh(index).geometry.addEventListener("dispose", () => geometryDisposals++);
  const materials = new Set([0, 1, 2, 3].map((index) => mesh(index).material));
  materials.forEach((material) => material.addEventListener("dispose", () => materialDisposals++));
  layer.update({ ...state, data: fixture() });
  assert.equal(geometryDisposals, 4);
  assert.notEqual(mesh(0).geometry, oldGeometry);
  assert.equal(materialDisposals, 0, "category materials remain reusable across data replacements");
  for (let index = 0; index < 4; index++)
    mesh(index).geometry.addEventListener("dispose", () => geometryDisposals++);
  layer.dispose();
  layer.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(geometryDisposals, 8);
  assert.equal(materialDisposals, 3);
  assert.equal(layer.update(state), 0, "disposed layers must not allocate resources again");
});
