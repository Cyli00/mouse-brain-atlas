import * as THREE from "three";
import type { AtlasData } from "./atlas";
import type { MeshData } from "./mesh-data";

export type MeshSpace = Pick<AtlasData, "dimensions" | "spacing">;

export function createMeshGeometry(source: MeshData, space: MeshSpace): THREE.BufferGeometry {
  const { dimensions, spacing } = space;
  const scale = spacing / 1000;
  const apCenter = (dimensions[0] - 1) / 2;
  const dvCenter = (dimensions[1] - 1) / 2;
  const mlCenter = (dimensions[2] - 1) / 2;
  const vertices = new Float32Array(source.positions.length);
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i] = (source.positions[i + 2] / spacing - mlCenter) * scale;
    vertices[i + 1] = (dvCenter - source.positions[i + 1] / spacing) * scale;
    vertices[i + 2] = (apCenter - source.positions[i] / spacing) * scale;
  }
  const indices = new Uint32Array(source.indices);
  // CCF-to-view reflects one axis, so reverse winding while preserving source data.
  for (let i = 0; i < indices.length; i += 3) {
    const second = indices[i + 1];
    indices[i + 1] = indices[i + 2];
    indices[i + 2] = second;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
