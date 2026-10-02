import * as THREE from "three";
import { getBinary } from "./atlas";
import { decodeMeshData } from "./mesh-data";
import { createMeshGeometry, type MeshSpace } from "./mesh-geometry";

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
      const geometry = createMeshGeometry(decodeMeshData(buffer), data);
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
