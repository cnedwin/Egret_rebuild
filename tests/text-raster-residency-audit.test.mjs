import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fixture, request, assertImage, release } from './text-raster-public-helpers.mjs';

// This private bookkeeping audit appends one read-only diagnostic to the actual
// compiled cache module. It changes no algorithm or on-disk source. It establishes
// retained references, not native memory usage, garbage collection or font output.
const target = new URL('../packages/runtime/dist/text/TextRasterCache.js', import.meta.url);
const before = createHash('sha256').update(readFileSync(target)).digest('hex');
let loadCount = 0;
const hooks = registerHooks({ load(url, context, nextLoad) {
  const loaded = nextLoad(url, context);
  if (url !== target.href) return loaded;
  loadCount++;
  return { ...loaded, source: `${loaded.source}\nexport function __textRetainedAudit(cache) {
    const state = stateOf(cache);
    return Object.freeze({ residentRows: state.residentLru.length,
      leaseRefs: state.residentLru.filter(value => value.residentLease !== undefined).length,
      generations: state.generations.size });
  }\n` };
} });
const { __textRetainedAudit } = await import(target.href);
hooks.deregister();
assert.equal(loadCount, 1);

for (const capacity of [1, 32]) {
  test(`private revoked-residency audit clears ${capacity} retained records`, async (t) => {
    const f = await fixture(t, {}, { maxResidentEntries: capacity });
    for (let index = 0; index < capacity; index++) {
      const value = await f.cache.acquire(request({ text: `A${index}` }));
      assertImage(value); release(value); await f.cache.whenIdle();
    }
    assert.deepEqual(__textRetainedAudit(f.cache), {
      residentRows: capacity, leaseRefs: capacity, generations: capacity });
    assert.equal(f.cache.getStatus().residentEntries, capacity);
    // The real manager revokes leases before its owned-cache closing hook.
    f.engine.assets.dispose();
    await f.cache.whenIdle();
    assert.equal(f.cache.getStatus().metadataBytes, 4096);
    assert.equal(f.cache.getStatus().residentEntries, 0);
    assert.equal(f.cache.getStatus().currentGenerations, 0);
    assert.equal(f.cache.getStatus().retiredGenerations, 0);
    assert.deepEqual(__textRetainedAudit(f.cache), {
      residentRows: 0, leaseRefs: 0, generations: 0 });
    assert.equal(createHash('sha256').update(readFileSync(target)).digest('hex'), before);
  });
}
