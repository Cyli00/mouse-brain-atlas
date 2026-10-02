import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { embryoRegions } from "../src/data/embryo";
import { loadAtlas, PLANES, type PlaneName } from "../src/lib/atlas";
import { embryoPartitions } from "../src/lib/embryo-partitions";
import { segmentSlice } from "../src/lib/slice-segmentation";

const root = new URL("../public/", import.meta.url);

test("embryo partition levels preserve stage labels, tissue masks and ventricular labels", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    assert.match(url, /^\/embryo\/[a-zA-Z0-9/_.-]+$/);
    return new Response(await readFile(new URL(url.slice(1), root)));
  };
  let preservedOutsideCompartments = 0;
  try {
    for (const [stage, count] of [["E11.5", 222], ["E13.5", 657], ["E15.5", 693], ["E18.5", 71]] as const) {
      await t.test(stage, async () => {
        const data = await loadAtlas(new AbortController().signal, () => {}, `/embryo/${stage}/manifest.json`);
        const originalLabels = data.annotation.slice();
        const majorIds = new Set(embryoRegions.map((region) => region.id));
        const partition = embryoPartitions(data, majorIds);
        assert.equal(partition.fine, data);
        assert.equal(partition.fineCount, count);
        assert.ok(partition.majorCount < count);
        assert.equal(partition.major.template, data.template);
        assert.equal(partition.major.dimensions, data.dimensions);
        assert.equal(partition.major.spacing, data.spacing);
        assert.deepEqual(data.annotation, originalLabels, "switching layers must not mutate source labels");
        for (let i = 0; i < originalLabels.length; i++) {
          const source = originalLabels[i], coarse = partition.major.annotation[i];
          assert.equal(source === 0, coarse === 0, "brain and cavity masks stay unchanged");
          if (!source) continue;
          const path = data.structures.get(source)!.structure_id_path;
          assert.ok(path.includes(coarse));
          if (!path.some((id) => majorIds.has(id))) {
            assert.equal(coarse, source, "labels outside curated compartments must not be merged into tissue");
            preservedOutsideCompartments++;
          } else assert.ok(majorIds.has(coarse));
        }
        for (const displayed of [partition.fine, partition.major]) {
          for (const plane of Object.keys(PLANES) as PlaneName[]) {
            const depth = Math.floor(data.dimensions[PLANES[plane].axis] / 2);
            const section = segmentSlice(displayed, plane, depth);
            assert.ok(section.regions.length > 0);
            assert.deepEqual(new Set(section.regions.map(r => r.id)), new Set([...section.labels].filter(Boolean)));
            for (const region of section.regions) {
              assert.equal(section.labels[Math.floor(region.v) * section.width + Math.floor(region.u)], region.id);
              assert.equal(region.whiteMatter, false, "adult PF white-matter IDs must not leak into the developmental ontology");
            }
          }
        }
      });
    }
    assert.ok(preservedOutsideCompartments > 0, "E11.5 includes non-compartment labels; later stage crops may contain none");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
