import test from "node:test";
import assert from "node:assert/strict";
import { nearestCatalogRegion } from "../src/lib/explorer-state.ts";
test("probe inspection chooses the nearest curated anatomical ancestor, not a broad parent", () => {
  assert.equal(
    nearestCatalogRegion([997, 8, 343, 313, 339, 294, 42], new Set([313, 294])),
    294,
  );
  assert.equal(
    nearestCatalogRegion([15565, 15566, 15739, 15800], new Set([15739])),
    15739,
  );
  assert.equal(nearestCatalogRegion([997, 1009], new Set([294])), null);
  assert.equal(nearestCatalogRegion(undefined, new Set([294])), null);
});
