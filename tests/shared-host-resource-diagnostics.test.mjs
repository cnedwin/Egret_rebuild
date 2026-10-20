// SPDX-License-Identifier: Apache-2.0
// Genuine public captures and owned native ports establish logical accounting,
// not browser pixels, physical memory or authenticated GPU recovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { usingGpu, readyUpload, finishUpload, until as gpuUntil, observe, MiB } from './fixtures/shared-frame-upload-gpu.mjs';
import { hosted, until as glUntil } from './shared-frame-upload-gl-fixture.mjs';

function resources(host) {
  const value = host.getSharedStatus().resources;
  assert.ok(value, 'M15_HOST_RESOURCE_DIAGNOSTICS_MISSING');
  return value;
}
function immutable(value) {
  assert.ok(Object.isFrozen(value));
  for (const [key, item] of Object.entries(value)) {
    if (item && typeof item === 'object') immutable(item);
    else if (key === 'saturated') assert.equal(typeof item, 'boolean');
    else assert.ok(Number.isSafeInteger(item) && item >= 0, key + ' is a bounded logical count');
  }
}
function nondecreasing(previous, current) {
  assert.deepEqual(Object.keys(current), Object.keys(previous));
  for (const [key, item] of Object.entries(previous)) {
    if (item && typeof item === 'object') nondecreasing(item, current[key]);
    else assert.ok(current[key] >= item, key + ' lifetime high water cannot fall');
  }
}
async function withBackend(backend, run) {
  if (backend === 'GPU') return usingGpu(async ({ f, a, h }) => run({
    h, calls: () => f.calls.length,
    capture: () => a.capture(),
    async images(count, width = 512, height = 512) {
      const nodes = [];
      for (let i = 0; i < count; i++) nodes.push((await a.bitmap(width, height)).bitmap);
      return nodes;
    },
    stage: frame => h.stageSharedFrame(frame),
    ready: ticket => readyUpload(f, ticket),
    finish: ticket => finishUpload(f, ticket),
    idle: () => gpuUntil(f, () => h.getStatus().pendingFrames === 0),
    close: async () => { const done = observe(h.close()); await gpuUntil(f, () => done.settled); if (done.rejected) throw done.error; },
  }));
  return hosted(async f => run({
    h: f.host, calls: () => f.ports.events.length,
    capture: () => f.frame(),
    async images(count, width = 512, height = 512) { return (await f.images(count, width, height)).nodes; },
    stage: frame => f.stage(frame), ready: ticket => ticket.ready,
    finish: async ticket => { const submission = ticket.submit(); await submission.completed; return submission; },
    idle: () => glUntil(() => f.host.getStatus().pendingFrames === 0), close: () => f.host.close(),
  }));
}

for (const backend of ['GPU', 'GL']) {
  test(backend + ' resource snapshots are immutable and reads perform no native work', async () => withBackend(backend, async p => {
    const value = resources(p.h), saved = JSON.stringify(value), calls = p.calls();
    immutable(value); assert.equal(value.saturated, false);
    assert.equal(value.current.pending.frames, p.h.getStatus().pendingFrames);
    for (let i = 0; i < 4; i++) assert.deepEqual(resources(p.h), value);
    assert.equal(p.calls(), calls);
    await p.images(1, 4, 4); const ticket = p.stage(p.capture()); await p.ready(ticket); await p.finish(ticket); await p.idle();
    assert.equal(JSON.stringify(value), saved, 'a prior snapshot does not mutate');
    const beforeClose = resources(p.h); await p.close(); const closed = resources(p.h);
    immutable(closed); nondecreasing(beforeClose.highWater, closed.highWater);
    assert.deepEqual(closed.totals, beforeClose.totals);
    assert.equal(closed.current.pending.frames, 0); assert.equal(closed.current.images.readyBytes, 0);
    assert.equal(closed.current.reusable.idleBytes, 0); assert.equal(closed.current.unknownNative.objects, 0);
  }));

  test(backend + ' sixteen cold pages expose actual synchronous copy overlap and warm pins', async () => withBackend(backend, async p => {
    resources(p.h); await p.images(16); const frame = p.capture(); assert.equal(frame.pages.length, 16);
    const first = p.stage(frame); await p.ready(first); const cold = resources(p.h);
    assert.equal(cold.current.pending.frames, 1);
    assert.equal(cold.current.cpu.canonicalBytes, 16 * MiB); assert.equal(cold.current.cpu.scratchBytes, 0);
    assert.equal(cold.highWater.cpu.scratchBytes, MiB);
    assert.equal(cold.highWater.cpu.temporaryBytes, 17 * MiB, 'last canonical allocation overlaps its actual source copy');
    assert.equal(cold.totals.pageWriteBytes, 16 * MiB);
    await p.finish(first); await p.idle(); const settled = resources(p.h);
    assert.equal(settled.current.cpu.temporaryBytes, 0); assert.equal(settled.current.images.readyBytes, 16 * MiB);
    assert.equal(settled.current.images.pinnedReadyBytes, 0);
    const warm = p.stage(frame); await p.ready(warm); const held = resources(p.h);
    assert.equal(held.current.cpu.canonicalBytes, 0); assert.equal(held.current.images.pinnedReadyBytes, 16 * MiB);
    assert.equal(held.current.images.pinnedReadyEntries, 16); assert.equal(held.current.images.readyEntries, 16);
    assert.equal(held.totals.pageWriteBytes, settled.totals.pageWriteBytes);
    assert.equal(held.highWater.cpu.temporaryBytes, cold.highWater.cpu.temporaryBytes);
    warm.dispose(); await p.idle(); assert.equal(resources(p.h).current.images.pinnedReadyBytes, 0);
  }));

  test(backend + ' two staged aliases charge records separately and pin each READY page once', async () => withBackend(backend, async p => {
    resources(p.h); await p.images(1, 64, 64); const frame = p.capture();
    const initial = p.stage(frame); await p.ready(initial); await p.finish(initial); await p.idle();
    const one = p.stage(frame), two = p.stage(frame); await p.ready(one); await p.ready(two);
    const held = resources(p.h); assert.equal(held.current.pending.frames, 2);
    assert.equal(held.current.pending.pageCreditBytes, 2 * 64 * 64 * 4);
    assert.equal(held.current.images.readyBytes, 64 * 64 * 4);
    assert.equal(held.current.images.pinnedReadyBytes, 64 * 64 * 4);
    assert.equal(held.current.images.pinnedReadyEntries, 1);
    one.dispose(); await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(resources(p.h).current.images.pinnedReadyEntries, 1);
    await p.finish(two); await p.idle(); const settled = resources(p.h);
    assert.equal(settled.current.images.pinnedReadyEntries, 0);
    assert.equal(settled.current.reusable.leasedEntries, 0);
    assert.equal(settled.current.reusable.reservedEntries, 0);
    assert.ok(settled.current.reusable.idleEntries > 0);
    assert.ok(settled.highWater.reusable.leasedEntries > 0);
  }));

  test(backend + ' forty one-MiB pages cause real READY eviction and later reupload', async () => withBackend(backend, async p => {
    resources(p.h); const nodes = [];
    for (let i = 0; i < 40; i++) {
      if (nodes.length) nodes.at(-1).visible = false;
      const [node] = await p.images(1); nodes.push(node);
      const ticket = p.stage(p.capture()); await p.ready(ticket); await p.finish(ticket); await p.idle();
      const state = resources(p.h);
      assert.ok(state.current.images.readyBytes <= 32 * MiB);
      assert.ok(state.current.reusable.idleBytes + state.current.reusable.reservedBytes <= 32 * MiB);
    }
    const full = resources(p.h); assert.equal(full.totals.pageWriteBytes, 40 * MiB);
    assert.ok(full.totals.readyCapacityEvictions >= 8);
    const warm = p.stage(p.capture()); await p.ready(warm); await p.finish(warm); await p.idle();
    assert.equal(resources(p.h).totals.pageWriteBytes, full.totals.pageWriteBytes);
    nodes.at(-1).visible = false; nodes[0].visible = true;
    const reloaded = p.stage(p.capture()); await p.ready(reloaded); await p.finish(reloaded); await p.idle();
    assert.equal(resources(p.h).totals.pageWriteBytes, full.totals.pageWriteBytes + MiB);
    assert.ok(resources(p.h).totals.readyCapacityEvictions > full.totals.readyCapacityEvictions);
  }));
}

test('GPU unknown staged proof remains visible after unsafe close', async () => usingGpu(async ({ f, a, h }) => {
  resources(h); await a.bitmap(64, 64); f.allowUnsafe(h);
  const scopeStart = f.scopes.length, fenceStart = f.fences.length;
  const ticket = h.stageSharedFrame(a.capture()), ready = observe(ticket.ready);
  await gpuUntil(f, () => f.scopes.length > scopeStart && f.fences.length > fenceStart, { settle: false });
  f.scopes[scopeStart].reject(new Error('unobserved native validation outcome'));
  await gpuUntil(f, () => ready.settled); assert.equal(ready.rejected, true);
  const closing = observe(h.close()); await gpuUntil(f, () => closing.settled); assert.equal(closing.rejected, true);
  const state = resources(h); assert.equal(state.current.pending.frames, 1);
  assert.ok(state.current.unknownNative.objects > 0);
  assert.ok(state.current.unknownNative.knownLogicalBytes > 0);
  assert.equal(state.current.images.readyBytes, 0);
  const count = f.calls.length; assert.deepEqual(resources(h), state); assert.equal(f.calls.length, count);
}));
