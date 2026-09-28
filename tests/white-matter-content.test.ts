import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { getWhiteMatterRegions } from '../src/data/white-matter';
import { loadAtlas } from '../src/lib/atlas';
import { loadKimAnnotation } from '../src/lib/slice-atlas';

test('PF white guide covers every packaged white mesh without crossing Allen IDs', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => new Response(await readFile(new URL(`../public${String(input)}`, import.meta.url)));
  try {
    const base = await loadAtlas(new AbortController().signal, () => {});
    const kim = await loadKimAnnotation(base, new AbortController().signal);
    const guide = getWhiteMatterRegions(kim);
    assert.equal(guide.length, 76);
    assert.deepEqual(new Set(guide.map(r => -r.id)), new Set(Object.keys(kim.meshes).map(Number)));
    assert.equal(new Set(guide.map(r => r.id)).size, guide.length);
    for (const r of guide) {
      assert.ok(r.id < 0);
      assert.equal(r.category, '白质结构 · PF');
      assert.match(r.name, /[\u4e00-\u9fff]/);
      assert.ok(r.summary && r.function && r.evidence);
      assert.ok(r.references.length > 0);
      for (const reference of r.references) assert.match(reference.url, /^https:\/\//);
    }
    assert.ok(new Set(guide.map(r => r.function)).size > 50, 'guide needs tract-specific explanations');
    assert.ok(!guide.some(r => r.id === -2461), 'I8 is a nucleus, not white matter');
    for (const id of [851, 2219]) assert.ok(guide.some(r => r.id === -id));
  } finally { globalThis.fetch = originalFetch; }
});
