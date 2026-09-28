import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { loadAtlas, structureAt } from "../src/lib/atlas";
import { loadKimAnnotation } from "../src/lib/slice-atlas";

const root = new URL("../public/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("data/kim-v2/manifest.json", root), "utf8"),
);

test("published Kim assets have valid checksums, complete ID coverage, and independently verified orientation", async () => {
  const compressed = await readFile(
    new URL(manifest.annotation.url.slice(1), root),
  );
  const raw = gunzipSync(compressed);
  assert.equal(
    createHash("sha256").update(compressed).digest("hex"),
    manifest.annotation.sha256,
  );
  assert.equal(
    createHash("sha256").update(raw).digest("hex"),
    manifest.annotation.uncompressedSha256,
  );
  assert.equal(raw.length, 264 * 160 * 228 * 4);
  const ontologyBytes = await readFile(
    new URL(manifest.ontology.url.slice(1), root),
  );
  assert.equal(
    createHash("sha256").update(ontologyBytes).digest("hex"),
    manifest.ontology.sha256,
  );
  const ontology = JSON.parse(ontologyBytes.toString());
  const ids = new Set(ontology.map((s: { id: number }) => s.id));
  const labels = new Uint32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  const present = new Set(labels);
  for (const id of present)
    assert.ok(id === 0 || ids.has(id), `No ontology for label ${id}`);
  assert.equal(present.size - 1, 1103);
  assert.deepEqual(manifest.unmappedLabelIds, [728]);
  assert.match(
    ontology.find((s: { id: number }) => s.id === 728).name,
    /源数据未提供名称/,
  );
  for (const s of ontology) {
    assert.equal(s.structureIdPath.at(-1), s.id);
    for (const id of s.structureIdPath) assert.ok(ids.has(id));
  }
  assert.ok(manifest.referenceValidation.pearsonEveryFifthVoxel > 0.99);
  assert.equal(manifest.sourceResolutionUm, 20);
  assert.match(manifest.basis, /not a 5th edition/);
});

test("Kim loading shares only geometry and template, keeps its own labels, rejects wrong grids and supports retry", async () => {
  const originalFetch = globalThis.fetch;
  let failure: "none" | "network" | "grid" | "truncated" = "none";
  globalThis.fetch = async (input, init) => {
    init?.signal?.throwIfAborted();
    const url = String(input);
    if (url.includes("kim-v2") && failure === "network")
      return new Response(null, { status: 503 });
    if (url.endsWith("kim-v2/manifest.json") && failure === "grid")
      return Response.json({ ...manifest, dimensions: [660, 400, 570] });
    if (url.endsWith("kim-v2/annotation.uint32.gz") && failure === "truncated")
      return new Response(new Uint8Array(4));
    return new Response(await readFile(new URL(url.slice(1), root)));
  };
  try {
    const base = await loadAtlas(new AbortController().signal, () => {});
    const kim = await loadKimAnnotation(base, new AbortController().signal);
    assert.equal(kim.template, base.template);
    assert.deepEqual(kim.dimensions, base.dimensions);
    assert.notEqual(kim.annotation, base.annotation);
    assert.notEqual(kim.structures, base.structures);
    assert.deepEqual(
      kim.meshes,
      {},
      "Allen meshes must not be claimed as FP meshes",
    );
    // A named hippocampal point checks AP/DV order independently of the loader.
    assert.match(
      structureAt(kim, [159, 57, 53])?.name ?? "",
      /CA1|hippocampus/i,
    );
    for (const [mode, message] of [
      ["network", /目录读取失败/],
      ["grid", /坐标不匹配/],
      ["truncated", /长度不正确/],
    ] as const) {
      failure = mode;
      await assert.rejects(
        loadKimAnnotation(base, new AbortController().signal),
        message,
      );
    }
    failure = "none";
    const retried = await loadKimAnnotation(base, new AbortController().signal);
    assert.equal(retried.annotation.length, base.annotation.length);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(loadKimAnnotation(base, controller.signal), {
      name: "AbortError",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
