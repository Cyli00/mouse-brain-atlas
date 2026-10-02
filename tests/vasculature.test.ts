import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { decodeVesselMesh, filterVessels, readVesselManifest, type VesselEntry } from "../src/lib/vasculature";

test("MICe major vessels preserve named labels, valid surfaces and anatomical laterality", async () => {
  const base = new URL("../public/vasculature/mice/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", base), "utf8"));
  const entries = readVesselManifest(manifest);
  assert.deepEqual(entries.map((v) => v.id).sort((a, b) => a - b),
    [5, 8, 11, 20, 21, 24, 30, 34, 35, 101, 190, 191, 192, 246]);
  const vessels = await Promise.all(entries.map(async (entry) => {
    const metadata = manifest.vessels.find((v: VesselEntry) => v.id === entry.id);
    const zipped = await readFile(new URL(`meshes/${entry.id}.bin.gz`, base));
    assert.equal(zipped.byteLength, metadata.bytes);
    assert.equal(createHash("sha256").update(zipped).digest("hex"), metadata.sha256);
    const vessel = decodeVesselMesh(Uint8Array.from(gunzipSync(zipped)).buffer, entry);
    assert.ok(vessel.positions.length > 30);
    return vessel;
  }));
  const data = { vessels };
  assert.equal(filterVessels(data, "sinus").length, 5);
  assert.equal(filterVessels(data, "artery").length, 5);
  assert.equal(filterVessels(data, "vein").length, 4);
  assert.equal(filterVessels(data, "all").length, 14);
  const meanML = (id: number) => {
    const vertices = vessels.find((v) => v.id === id)!.positions;
    let sum = 0;
    for (let i = 2; i < vertices.length; i += 3) sum += vertices[i];
    return sum / (vertices.length / 3);
  };
  for (const [left, right] of [[246, 30], [24, 101], [190, 191], [5, 8], [21, 20], [34, 192]]) {
    assert.ok(meanML(left) < 5700, `left MICe label ${left} must remain left of midline`);
    assert.ok(meanML(right) > 5700, `right MICe label ${right} must remain right of midline`);
  }
  assert.ok(Math.abs(meanML(11) - 5700) < 600, "superior sagittal sinus follows the midline");
});

const entry: VesselEntry = { id: 11, name: "上矢状窦", group: "sinus", url: "/vasculature/mice/meshes/11.bin.gz", vertexCount: 3, triangleCount: 1 };
const manifest = { version: 1, stage: "adult", coordinateSpace: "Allen CCFv3 2017", units: "um", axisOrder: ["AP", "DV", "ML"], vessels: [entry] };

test("native-space, unclassified, duplicate or remote meshes cannot masquerade as CCF vessels", () => {
  assert.deepEqual(readVesselManifest(manifest), [entry]);
  for (const altered of [
    { ...manifest, coordinateSpace: "CBA MRI" },
    { ...manifest, axisOrder: ["ML", "AP", "DV"] },
    { ...manifest, vessels: [] },
    { ...manifest, vessels: [entry, entry] },
    { ...manifest, vessels: [{ ...entry, group: "capillary" }] },
    { ...manifest, vessels: [{ ...entry, group: ["artery"] }] },
    { ...manifest, vessels: [{ ...entry, url: "https://example.com/vessels" }] },
  ]) assert.throws(() => readVesselManifest(altered));
});

test("invalid vascular coordinates, topology and mismatched metadata are rejected", () => {
  const buffer = new ArrayBuffer(56);
  new Uint32Array(buffer, 0, 2).set([3, 1]);
  new Float32Array(buffer, 8, 9).set([5000, 1000, 5700, 5100, 1000, 5700, 5100, 1100, 5700]);
  const indices = new Uint32Array(buffer, 44, 3);
  indices.set([0, 1, 2]);
  assert.equal(decodeVesselMesh(buffer, entry).indices.length, 3);
  assert.throws(() => decodeVesselMesh(buffer.slice(0, 20), entry));
  assert.throws(() => decodeVesselMesh(buffer, { ...entry, vertexCount: 4 }));
  indices[2] = 3;
  assert.throws(() => decodeVesselMesh(buffer, entry));
  indices[2] = 2;
  new Float32Array(buffer, 8, 9)[0] = NaN;
  assert.throws(() => decodeVesselMesh(buffer, entry));
  new Float32Array(buffer, 8, 9)[0] = 15000;
  assert.throws(() => decodeVesselMesh(buffer, entry));
});
