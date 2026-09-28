import * as THREE from "three";
import { getBinary, toWorld, type AtlasData } from "./atlas";

type MeshSpace = Pick<AtlasData, "dimensions" | "spacing">;

type CachedMesh = {
  url: string;
  geometry: THREE.BufferGeometry;
  bytes: number;
};
type PendingMesh = {
  url: string;
  controller: AbortController;
  promise: Promise<THREE.BufferGeometry>;
  consumers: number;
  settled: boolean;
};

const MAX_ENTRIES = 24;
const MAX_BYTES = 32 * 1024 * 1024;
const cache = new Map<string, CachedMesh>();
const pending = new Map<string, PendingMesh>();
let cacheBytes = 0;

function abortError() {
  return new DOMException("网格请求已取消", "AbortError");
}

function removeCached(key: string) {
  const entry = cache.get(key);
  if (!entry) return;
  cache.delete(key);
  cacheBytes -= entry.bytes;
  entry.geometry.dispose();
}

function parseMesh(buffer: ArrayBuffer, data: MeshSpace) {
  if (buffer.byteLength < 8) throw new Error("三维网格文件不完整");
  const header = new DataView(buffer);
  const vertexCount = header.getUint32(0, true);
  const triangleCount = header.getUint32(4, true);
  if (
    !vertexCount ||
    !triangleCount ||
    buffer.byteLength !== 8 + (vertexCount + triangleCount) * 12
  )
    throw new Error("三维网格文件长度异常");
  const source = new Float32Array(buffer, 8, vertexCount * 3);
  const faces = new Uint32Array(
    new Uint32Array(buffer, 8 + vertexCount * 12, triangleCount * 3),
  );
  const vertices = new Float32Array(source.length);
  for (let i = 0; i < vertexCount; i++) {
    const ap = source[i * 3],
      dv = source[i * 3 + 1],
      ml = source[i * 3 + 2];
    if (![ap, dv, ml].every(Number.isFinite))
      throw new Error("三维网格坐标无效");
    vertices.set(
      toWorld(
        [ap / data.spacing, dv / data.spacing, ml / data.spacing],
        data.dimensions,
        data.spacing,
      ),
      i * 3,
    );
  }
  for (let i = 0; i < faces.length; i += 3) {
    if (
      faces[i] >= vertexCount ||
      faces[i + 1] >= vertexCount ||
      faces[i + 2] >= vertexCount
    )
      throw new Error("三维网格索引无效");
    // The PIR-to-view transform reflects one axis, so outward winding must reverse.
    [faces[i + 1], faces[i + 2]] = [faces[i + 2], faces[i + 1]];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(faces, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function remember(key: string, url: string, geometry: THREE.BufferGeometry) {
  const bytes =
    Object.values(geometry.attributes).reduce(
      (sum, attribute) => sum + attribute.array.byteLength,
      0,
    ) + (geometry.index?.array.byteLength ?? 0);
  cache.set(key, { url, geometry, bytes });
  cacheBytes += bytes;
  while (cache.size > MAX_ENTRIES || cacheBytes > MAX_BYTES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    removeCached(oldest);
  }
}

export function loadMeshGeometry(
  url: string,
  data: MeshSpace,
  signal: AbortSignal,
): Promise<THREE.BufferGeometry> {
  if (signal.aborted) return Promise.reject(abortError());
  const key = `${url}|${data.dimensions.join(",")}|${data.spacing}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return Promise.resolve(hit.geometry.clone());
  }
  let entry = pending.get(key);
  if (!entry) {
    const controller = new AbortController();
    const promise = getBinary(url, controller.signal).then((buffer) => {
      if (controller.signal.aborted) throw abortError();
      const geometry = parseMesh(buffer, data);
      remember(key, url, geometry);
      return geometry;
    });
    const request: PendingMesh = {
      url,
      controller,
      consumers: 0,
      settled: false,
      promise,
    };
    request.promise = promise.finally(() => {
      request.settled = true;
      if (pending.get(key) === request) pending.delete(key);
    });
    entry = request;
    pending.set(key, entry);
  }
  const current = entry;
  current.consumers++;
  return new Promise((resolve, reject) => {
    let finished = false;
    const release = () => {
      if (finished) return false;
      finished = true;
      signal.removeEventListener("abort", cancel);
      current.consumers--;
      // Region and circuit meshes can share a request; cancel only after both release it.
      if (!current.consumers && !current.settled) {
        if (pending.get(key) === current) pending.delete(key);
        current.controller.abort();
      }
      return true;
    };
    const cancel = () => {
      if (release()) reject(abortError());
    };
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    current.promise.then(
      (geometry) => {
        if (release()) resolve(geometry.clone());
      },
      (error) => {
        if (release()) reject(error);
      },
    );
  });
}

export function invalidateMeshCache(urls: Iterable<string>) {
  const requested = new Set(urls);
  for (const [key, entry] of cache)
    if (requested.has(entry.url)) removeCached(key);
  for (const [key, entry] of pending)
    if (requested.has(entry.url)) {
      pending.delete(key);
      entry.controller.abort();
    }
}
