import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { decodeVasculature } from "../src/lib/vasculature";

test("packaged adult vessels have verified bytes, CCF coordinates and nested diameter levels", async () => {
  const base = new URL("../public/vasculature/adult/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", base), "utf8"));
  const zipped = await readFile(new URL("segments.float32.gz", base));
  assert.equal(createHash("sha256").update(zipped).digest("hex"), manifest.segments.sha256);
  const bytes = Uint8Array.from(gunzipSync(zipped));
  const data = decodeVasculature(bytes.buffer, manifest.countsByMinimumDiameterUm);
  assert.equal(data.positions.length, manifest.segmentCount * 6);
  assert.equal(manifest.stage, "adult");
  assert.deepEqual(manifest.axisOrder, ["AP", "DV", "ML"]);
  for (let i = 0; i < data.positions.length; i++) {
    assert.ok(data.positions[i] > -1000 && data.positions[i] < [14200, 9000, 12400][i % 3]);
  }
  for (const [name, hash] of Object.entries(manifest.transforms))
    assert.equal(createHash("sha256").update(await readFile(new URL(name, base))).digest("hex"), hash);
});

test("invalid vascular buffers cannot be displayed as anatomy", () => {
  assert.throws(() => decodeVasculature(new ArrayBuffer(20), { 36: 1, 48: 1, 60: 1 }));
  assert.throws(() => decodeVasculature(new ArrayBuffer(24), { 36: 1, 48: 2, 60: 1 }));
  const corrupt = new Float32Array([NaN, 1, 2, 3, 4, 5]);
  assert.throws(() => decodeVasculature(corrupt.buffer, { 36: 1, 48: 1, 60: 1 }));
});
