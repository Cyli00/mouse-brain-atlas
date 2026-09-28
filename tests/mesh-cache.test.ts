import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";
import { gunzipSync } from "node:zlib";
import { invalidateMeshCache, loadMeshGeometry } from "../src/lib/mesh-cache";
import { toWorld, type Position } from "../src/lib/atlas";

const publicRoot = new URL("../public/", import.meta.url);
const manifest: {
  dimensions: Position;
  resolutionUm: number;
  regions: { id: number; mesh: { url: string } }[];
} = JSON.parse(
  await readFile(new URL("data/manifest.json", publicRoot), "utf8"),
);
const url = manifest.regions.find((region) => region.id === 147)!.mesh.url;
const compressed = await readFile(new URL(url.slice(1), publicRoot));
const raw = gunzipSync(compressed);
const space = {
  dimensions: manifest.dimensions,
  spacing: manifest.resolutionUm,
};
const originalFetch = globalThis.fetch;
const allUrls = new Set(manifest.regions.map((region) => region.mesh.url));

afterEach(() => {
  globalThis.fetch = originalFetch;
  invalidateMeshCache(allUrls);
});

function delayedResponses(rejectOnAbort = true) {
  const requests: {
    signal: AbortSignal;
    resolve: (response: Response) => void;
  }[] = [];
  globalThis.fetch = (_, options) =>
    new Promise((resolve, reject) => {
      const signal = options!.signal!;
      requests.push({ signal, resolve });
      if (rejectOnAbort)
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Cancelled", "AbortError")),
          { once: true },
        );
    });
  return requests;
}

test("concurrent and repeated selections share one request but receive independently owned geometries", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(compressed);
  };
  const [a, b] = await Promise.all([
    loadMeshGeometry(url, space, new AbortController().signal),
    loadMeshGeometry(url, space, new AbortController().signal),
  ]);
  const c = await loadMeshGeometry(url, space, new AbortController().signal);
  assert.equal(calls, 1);
  assert.notEqual(a, b);
  assert.notEqual(
    a.getAttribute("position").array,
    b.getAttribute("position").array,
  );
  assert.notEqual(
    a.getAttribute("normal").array,
    b.getAttribute("normal").array,
  );
  assert.notEqual(a.index!.array, b.index!.array);
  const original = b.getAttribute("position").getX(0);
  a.getAttribute("position").setX(0, 999);
  a.dispose();
  assert.equal(b.getAttribute("position").getX(0), original);
  assert.equal(c.getAttribute("position").getX(0), original);
  b.dispose();
  c.dispose();
});

test("cached meshes preserve Allen coordinates and reverse winding only for the display reflection", async () => {
  globalThis.fetch = async () => new Response(compressed);
  const geometry = await loadMeshGeometry(
    url,
    space,
    new AbortController().signal,
  );
  const count = raw.readUInt32LE(0);
  assert.equal(geometry.getAttribute("position").count, count);
  const point = [
    raw.readFloatLE(8),
    raw.readFloatLE(12),
    raw.readFloatLE(16),
  ].map((value) => value / space.spacing) as Position;
  const expected = toWorld(point, space.dimensions, space.spacing);
  const positions = geometry.getAttribute("position");
  [positions.getX(0), positions.getY(0), positions.getZ(0)].forEach(
    (value, axis) => assert.ok(Math.abs(value - expected[axis]) < 1e-6),
  );
  const firstFace = [0, 1, 2].map((index) =>
    raw.readUInt32LE(8 + count * 12 + index * 4),
  );
  assert.deepEqual(
    [...geometry.index!.array.slice(0, 3)],
    [firstFace[0], firstFace[2], firstFace[1]],
  );
  assert.ok(geometry.boundingSphere!.radius > 0);
  geometry.dispose();
});

test("cancelling a selected region does not abort a circuit still using the same mesh", async () => {
  const requests = delayedResponses();
  const region = new AbortController(),
    circuit = new AbortController();
  const a = loadMeshGeometry(url, space, region.signal);
  const b = loadMeshGeometry(url, space, circuit.signal);
  assert.equal(requests.length, 1);
  region.abort();
  await assert.rejects(a, { name: "AbortError" });
  assert.equal(requests[0].signal.aborted, false);
  requests[0].resolve(new Response(compressed));
  const surviving = await b;
  assert.equal(surviving.getAttribute("position").count, 62);
  surviving.dispose();
});

test("the last consumer aborts pending work and a new selection starts a fresh request", async () => {
  const requests = delayedResponses();
  const first = new AbortController(),
    second = new AbortController();
  const a = loadMeshGeometry(url, space, first.signal);
  const b = loadMeshGeometry(url, space, second.signal);
  first.abort();
  second.abort();
  await Promise.all([
    assert.rejects(a, { name: "AbortError" }),
    assert.rejects(b, { name: "AbortError" }),
  ]);
  assert.equal(requests[0].signal.aborted, true);
  const retry = loadMeshGeometry(url, space, new AbortController().signal);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].signal.aborted, false);
  requests[1].resolve(new Response(compressed));
  (await retry).dispose();
});

test("a late response from an aborted selection cannot replace a later successful cache entry", async () => {
  const requests = delayedResponses(false);
  const old = new AbortController();
  const stale = loadMeshGeometry(url, space, old.signal);
  old.abort();
  await assert.rejects(stale, { name: "AbortError" });
  const current = loadMeshGeometry(url, space, new AbortController().signal);
  requests[1].resolve(new Response(compressed));
  (await current).dispose();
  requests[0].resolve(new Response(new Uint8Array([1, 2, 3])));
  await new Promise((resolve) => setImmediate(resolve));
  const hit = await loadMeshGeometry(url, space, new AbortController().signal);
  assert.equal(requests.length, 2);
  assert.equal(hit.getAttribute("position").count, 62);
  hit.dispose();
});

test("bad responses are not cached and explicit retry invalidates completed or pending entries", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(calls === 1 ? new Uint8Array([1, 2, 3]) : compressed);
  };
  await assert.rejects(
    loadMeshGeometry(url, space, new AbortController().signal),
    /不完整/,
  );
  const recovered = await loadMeshGeometry(
    url,
    space,
    new AbortController().signal,
  );
  assert.equal(calls, 2);
  invalidateMeshCache([url]);
  const refreshed = await loadMeshGeometry(
    url,
    space,
    new AbortController().signal,
  );
  assert.equal(calls, 3);
  recovered.dispose();
  refreshed.dispose();
  invalidateMeshCache([url]);
  const requests = delayedResponses();
  const pending = loadMeshGeometry(url, space, new AbortController().signal);
  invalidateMeshCache([url]);
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(requests[0].signal.aborted, true);
});

test("the geometry cache evicts old selections while keeping recently visited real regions", async () => {
  const fixtures = manifest.regions
    .slice(0, 26)
    .map((region) => region.mesh.url);
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    const path = String(input);
    requests.push(path);
    return new Response(await readFile(new URL(path.slice(1), publicRoot)));
  };
  for (const path of fixtures)
    (
      await loadMeshGeometry(path, space, new AbortController().signal)
    ).dispose();
  assert.equal(requests.length, 26);
  (
    await loadMeshGeometry(
      fixtures.at(-1)!,
      space,
      new AbortController().signal,
    )
  ).dispose();
  assert.equal(requests.length, 26);
  (
    await loadMeshGeometry(fixtures[0], space, new AbortController().signal)
  ).dispose();
  assert.equal(requests.length, 27);
});

test("the byte budget evicts a large mesh before the entry-count limit is exceeded", async () => {
  type Asset = { url: string; vertexCount: number; uncompressedBytes: number };
  type Dataset = {
    dimensions: Position;
    resolutionUm: number;
    rootMesh: Asset;
    regions: { mesh: Asset }[];
  };
  const paths = [
    "data/manifest.json",
    ...["E11.5", "E13.5", "E15.5", "E18.5"].map(
      (stage) => `embryo/${stage}/manifest.json`,
    ),
  ];
  const datasets: Dataset[] = await Promise.all(
    paths.map(async (path) =>
      JSON.parse(await readFile(new URL(path, publicRoot), "utf8")),
    ),
  );
  const largest = datasets
    .flatMap((dataset) =>
      [dataset.rootMesh, ...dataset.regions.map((region) => region.mesh)].map(
        (asset) => ({
          asset,
          space: {
            dimensions: dataset.dimensions,
            spacing: dataset.resolutionUm,
          },
          bytes: asset.uncompressedBytes - 8 + asset.vertexCount * 12,
        }),
      ),
    )
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 24);
  assert.ok(
    largest.reduce((total, fixture) => total + fixture.bytes, 0) >
      32 * 1024 * 1024,
  );
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls++;
    return new Response(
      await readFile(new URL(String(input).slice(1), publicRoot)),
    );
  };
  for (const fixture of largest) {
    allUrls.add(fixture.asset.url);
    (
      await loadMeshGeometry(
        fixture.asset.url,
        fixture.space,
        new AbortController().signal,
      )
    ).dispose();
  }
  assert.equal(calls, 24);
  const recent = largest.at(-1)!;
  (
    await loadMeshGeometry(
      recent.asset.url,
      recent.space,
      new AbortController().signal,
    )
  ).dispose();
  assert.equal(calls, 24);
  const oldest = largest[0];
  (
    await loadMeshGeometry(
      oldest.asset.url,
      oldest.space,
      new AbortController().signal,
    )
  ).dispose();
  assert.equal(calls, 25);
});
