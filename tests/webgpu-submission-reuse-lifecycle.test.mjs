// SPDX-License-Identifier: Apache-2.0
// Public emitted SDK lifetime behavior over controlled GPU ports, not native proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egret, tick, code, watched, frame, withGpu, withAuthored, admitted, submitSafe,
  triangleScene, imagesOf, snapshot } from './fixtures/gpu-image-residency.mjs';

const eligible = buffers => buffers.filter(b => [40, 24, 72].includes(b.descriptor.usage));
const selected = calls => calls.filter(c => c[0] === 'setVertexBuffer').map(c => c[2]);
const bound = calls => calls.filter(c => c[0] === 'setBindGroup').map(c => c[2]);
const uniforms = calls => calls.filter(c => c[0] === 'writeBuffer' && c[1].descriptor.usage === 72).map(c => c[1]);
const sameRefs = (actual, expected, message) => {
  assert.ok(expected.length > 0, 'reuse comparison requires an observed selection');
  assert.equal(actual.length, expected.length, message);
  actual.forEach((item, index) => assert.equal(item, expected[index], message));
};
function begin(f, h, input) {
  const start = f.calls.length, record = f.capture(() => h.renderFrame(input)); admitted(record);
  const calls = f.calls.slice(start);
  assert.equal(selected(calls).length, 1); assert.equal(bound(calls).length, 1);
  assert.equal(uniforms(calls).length, 1);
  return { record, calls };
}

test('B02 out-of-order settlement releases only the proved record buffer and binding selections', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 3 }); await f.ready(h); const input = frame();
    const a = begin(f, h, input), b = begin(f, h, input);
    assert.notEqual(selected(a.calls)[0], selected(b.calls)[0]);
    assert.notEqual(uniforms(a.calls)[0], uniforms(b.calls)[0]);
    assert.equal(h.getStatus().pendingUploadBytes, 224);
    await b.record.finish(); assert.equal(h.getStatus().pendingUploadBytes, 112);
    const c = begin(f, h, input);
    sameRefs(selected(c.calls), selected(b.calls), 'only the second proved vertex may return');
    sameRefs(uniforms(c.calls), uniforms(b.calls), 'only the second proved uniform may return');
    sameRefs(bound(c.calls), bound(b.calls));
    assert.ok(eligible(a.record.buffers).every(buffer => buffer.destroyed === 0));
    assert.equal(c.record.buffers.length, 0);
    await c.record.finish(); await a.record.finish(); await h.whenIdle();
    await f.close(h); assert.ok(f.buffers.every(buffer => buffer.destroyed === 1));
  });
});

for (const holds of [['scope'], ['fence'], ['map'], ['scope', 'fence'], ['scope', 'map'], ['fence', 'map'], ['scope', 'fence', 'map']]) {
  test('B03 B09 buffer and original charge stay pending while holding ' + holds.join('+'), async () => {
    await withGpu(async f => {
      const h = f.host({ enableReadback: true, maxPendingFrames: 3 }); await f.ready(h);
      const ticket = h.requestReadback(); ticket.catch(() => {}); const input = frame(), a = begin(f, h, input);
      f.settleScopes(holds.includes('scope') ? a.record.scopes.slice(1) : a.record.scopes);
      if (!holds.includes('fence')) a.record.fences.forEach(d => d.resolve());
      if (!holds.includes('map')) a.record.maps.forEach(d => d.resolve());
      await tick(); assert.equal(h.getStatus().pendingFrames, 1); assert.equal(h.getStatus().pendingUploadBytes, 112);
      assert.ok(h.getStatus().pendingReadbackBytes > 0);
      const b = begin(f, h, input);
      assert.notEqual(selected(b.calls)[0], selected(a.calls)[0]);
      assert.notEqual(uniforms(b.calls)[0], uniforms(a.calls)[0]);
      await b.record.finish(); assert.equal(h.getStatus().pendingFrames, 1);
      assert.equal(h.getStatus().pendingUploadBytes, 112);
      const c = begin(f, h, input);
      sameRefs(selected(c.calls), selected(b.calls)); sameRefs(uniforms(c.calls), uniforms(b.calls));
      sameRefs(bound(c.calls), bound(b.calls));
      assert.ok(eligible(a.record.buffers).every(buffer => buffer.destroyed === 0));
      await c.record.finish(); await a.record.finish(); await ticket; await h.whenIdle();
      assert.equal(h.getStatus().pendingReadbackBytes, 0);
      await f.close(h); assert.ok(f.buffers.every(buffer => buffer.destroyed === 1));
    });
  });
}

test('B06 readback staging is fresh mapped once and destroyed while eligible buffers return', async () => {
  await withGpu(async f => {
    const h = f.host({ enableReadback: true }); await f.ready(h); const input = frame(), runs = [];
    for (let i = 0; i < 3; i++) {
      const ticket = h.requestReadback(); ticket.catch(() => {}); const run = begin(f, h, input);
      await run.record.finish(); const output = await ticket; await h.whenIdle(); runs.push(run);
      assert.equal(output.width, 8); assert.equal(output.height, 8); assert.equal(output.bytes.byteLength, 256);
      const staging = run.record.buffers.filter(b => b.descriptor.usage === 9);
      assert.equal(staging.length, 1); assert.equal(staging[0].unmapped, 1); assert.equal(staging[0].destroyed, 1);
      assert.ok(eligible(f.buffers).every(b => b.destroyed === 0));
    }
    assert.equal(eligible(f.buffers).length, 2); assert.equal(f.buffers.filter(b => b.descriptor.usage === 9).length, 3);
    for (const run of runs) sameRefs(selected(run.calls), selected(runs[0].calls));
    await f.close(h); assert.ok(f.buffers.every(b => b.destroyed === 1));
  });
});

test('B06 clear-only frames create neither zero-size buffers nor bindings', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h);
    await submitSafe(f, h, frame([])); await submitSafe(f, h, frame([]));
    assert.equal(f.buffers.length, 0); assert.equal(f.calls.filter(c => c[0] === 'binding').length, 0);
    assert.equal(h.getStatus().pendingUploadBytes, 0); await f.close(h);
  });
});

for (const proof of ['scope', 'fence', 'map']) test('B09 rejected ' + proof + ' quarantines a reused warm buffer until unsafe close', async () => {
  await withGpu(async f => {
    const h = f.host({ enableReadback: true }); await f.ready(h); const input = frame();
    const warm = begin(f, h, input); await warm.record.finish(); await h.whenIdle();
    const ticket = h.requestReadback(); ticket.catch(() => {}); const active = begin(f, h, input), cause = { proof };
    sameRefs(selected(active.calls), selected(warm.calls)); sameRefs(bound(active.calls), bound(warm.calls));
    f.allowUnsafe(h);
    ({ scope: active.record.scopes, fence: active.record.fences, map: active.record.maps }[proof])[0].reject(cause);
    await active.record.finish(); await assert.rejects(ticket, error => error.cause === cause);
    await assert.rejects(h.whenIdle(), error => error.cause === cause);
    assert.equal(h.getStatus().pendingFrames, 1); assert.equal(h.getStatus().pendingUploadBytes, 112);
    assert.ok(eligible(f.buffers).every(b => b.destroyed === 0));
    const before = snapshot(f, h); assert.throws(() => h.renderFrame(input), code('FAILED')); assert.deepEqual(snapshot(f, h), before);
    await f.close(h, true); assert.ok(f.buffers.every(b => b.destroyed === 1));
  });
});

for (const boundary of ['beforeBuffer', 'writeBuffer', 'binding', 'encoder', 'finish', 'submit']) {
  test('B08 warm native ' + boundary + ' throw keeps first cause and cleans every captured owner once', async () => {
    await withGpu(async f => {
      const h = f.host(); await f.ready(h); const original = frame(); await submitSafe(f, h, original);
      const input = { ...original, commands: [original.commands[0], original.commands[0]] }, cause = { boundary }; let invoked = 0;
      f.hooks[boundary] = () => { invoked++; throw cause; };
      const record = f.capture(() => h.renderFrame(input));
      assert.equal(record.threw, true); assert.ok(code('RENDER_FAILED')(record.error)); assert.equal(record.error.cause, cause);
      assert.ok(invoked > 0); assert.equal(h.getStatus().firstFailure.cause, cause); delete f.hooks[boundary];
      await record.finish(); await assert.rejects(h.whenIdle(), error => error.cause === cause);
      await f.close(h); assert.ok(f.buffers.every(b => b.destroyed === 1));
      assert.equal(h.getStatus().pendingFrames, 0); assert.equal(h.getStatus().firstFailure.cause, cause);
    });
  });
}

for (const terminal of ['stop', 'close', 'uncaptured', 'loss']) test('B08 G03 warm write callback ' + terminal + ' disables future reuse and closes each owner once', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const input = frame(); await submitSafe(f, h, input);
    const old = eligible(f.buffers), cause = { terminal }; let invoked = 0, closing;
    f.hooks.writeBuffer = () => {
      if (invoked++) return;
      if (terminal === 'stop') h.stop();
      if (terminal === 'close') { closing = h.close(); closing.catch(() => {}); }
      if (terminal === 'uncaptured') f.emitError(cause);
      if (terminal === 'loss') { f.allowUnsafe(h); f.lost.resolve(cause); assert.equal(h.getStatus().state, 'active'); }
    };
    const record = f.capture(() => h.renderFrame(input)); assert.ok(invoked > 0);
    if (terminal === 'loss') admitted(record); else { assert.equal(record.threw, true); assert.ok(code('RENDER_FAILED')(record.error)); }
    delete f.hooks.writeBuffer; await tick();
    if (terminal === 'uncaptured' || terminal === 'loss') assert.equal(h.getStatus().firstFailure.cause, cause);
    const before = snapshot(f, h);
    assert.throws(() => h.renderFrame(input), code(terminal === 'stop' ? 'STOPPED' : terminal === 'close' ? 'CLOSED' : 'FAILED'));
    assert.deepEqual(snapshot(f, h), before); await record.finish();
    await f.close(h, terminal === 'loss'); if (closing) await closing;
    assert.equal(f.buffers.length, old.length, 'warm callback operated on the original retained allocation');
    assert.ok(f.buffers.every(b => b.destroyed === 1));
  });
});

test('B08 throwing idle buffer destruction is attempted once and preserves unsafe cause', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); await submitSafe(f, h, frame());
    const buffers = eligible(f.buffers); assert.ok(buffers.every(b => b.destroyed === 0));
    const cause = { destroy: true }; f.allowUnsafe(h); let attempts = 0;
    f.hooks.destroyBuffer = () => { attempts++; throw cause; };
    await f.close(h, true, cause); assert.equal(attempts, buffers.length);
    delete f.hooks.destroyBuffer; await f.close(h, true, cause);
    assert.ok(buffers.every(b => b.destroyed === 1)); assert.equal(attempts, buffers.length);
    assert.equal(h.getStatus().cleanupOutcome, 'unsafe');
  });
});

for (const terminal of ['stop', 'close', 'uncaptured', 'throw']) test('B08 warm allocation destroy getter ' + terminal + ' retains captured and unknown owners', async () => {
  await withGpu(async f => {
    const originalCreate = f.device.createBuffer, cause = { getter: terminal }; let reads = 0, native, closing, armed = false;
    f.device.createBuffer = function (descriptor) {
      const buffer = originalCreate.call(this, descriptor); if (!armed) return buffer;
      const destroy = buffer.destroy; native = buffer;
      Object.defineProperty(buffer, 'destroy', { configurable: true, get() {
        reads++;
        if (terminal === 'stop') h.stop();
        if (terminal === 'close') { closing = h.close(); closing.catch(() => {}); }
        if (terminal === 'uncaptured') f.emitError(cause);
        if (terminal === 'throw') throw cause;
        return destroy;
      } });
      return buffer;
    };
    const h = f.host(); await f.ready(h); const input = frame(); await submitSafe(f, h, input); armed = true;
    if (terminal === 'throw') f.allowUnsafe(h);
    try {
      const record = f.capture(() => h.renderFrame({ ...input, commands: [input.commands[0], input.commands[0]] }));
      assert.equal(record.threw, true); assert.ok(code('RENDER_FAILED')(record.error)); assert.equal(reads, 1); assert.ok(native);
      await record.finish();
      if (terminal === 'throw') { assert.equal(record.error.cause, cause); await f.close(h, true, cause); }
      else await f.close(h);
      if (closing) await closing;
      assert.equal(reads, 1, 'captured native methods are never reacquired during cleanup');
      assert.equal(native.destroyed, terminal === 'throw' ? 0 : 1);
      assert.ok(f.buffers.filter(b => b !== native).every(b => b.destroyed === 1));
      assert.equal(h.getStatus().pendingFrames, 0);
    } finally { f.device.createBuffer = originalCreate; }
  });
});

for (const kind of ['ordinary', 'textured', 'scene', 'combined']) test('P03 all-warm ' + kind + ' backpressure has no effects and preserves the armed readback', async () => {
  await withAuthored(a => withGpu(async f => {
    const h = f.host({ enableReadback: true, maxPendingFrames: 1 }, kind); await f.ready(h);
    if (kind === 'textured' || kind === 'combined') a.engine.stage.addChild(a.mesh);
    const scene = triangleScene(), input = kind === 'ordinary' || kind === 'scene' ? a.capture() : a.textured();
    const render = value => ({ ordinary: () => h.renderFrame(value), textured: () => h.renderTexturedFrame(value),
      scene: () => h.renderSceneFrame(scene, value), combined: () => h.renderSceneTexturedFrame(scene, value) }[kind])();
    await submitSafe(f, h, input, render);
    const active = f.capture(() => render(input)); admitted(active);
    const ticket = h.requestReadback(); ticket.catch(() => {}); const before = snapshot(f, h);
    assert.throws(() => render(input), code('BACKPRESSURE')); assert.deepEqual(snapshot(f, h), before);
    await active.finish(); await h.whenIdle();
    const reused = f.capture(() => render(input)); admitted(reused); await reused.finish();
    assert.equal((await ticket).serial, 3); await h.whenIdle(); await f.close(h);
    assert.ok(f.buffers.every(b => b.destroyed === 1));
  }));
});

for (const lateReject of [false, true]) test('B09 Engine timeout preserves warm owners and surface until late ' + (lateReject ? 'rejection' : 'success'), async () => {
  await withGpu(async f => {
    const h = f.host(), diagnostics = [];
    const creating = egret.createEngine({ host: h, shutdownTimeoutMs: 17, onDiagnostic: d => diagnostics.push(d) });
    await f.pump(); const engine = await creating, input = frame(); await submitSafe(f, h, input);
    const original = eligible(f.buffers), active = begin(f, h, input); f.settleScopes(active.record.scopes);
    const savedSet = globalThis.setTimeout, savedClear = globalThis.clearTimeout; let timeout;
    globalThis.setTimeout = (callback, delay) => { assert.equal(delay, 17); timeout = callback; return 1; };
    globalThis.clearTimeout = () => {};
    try {
      const disposal = engine.dispose(); disposal.catch(() => {}); await tick(); assert.equal(typeof timeout, 'function'); timeout();
      await assert.rejects(disposal, e => e.code === 'ENGINE_CLOSE_TIMEOUT');
      const denied = f.host(); await assert.rejects(egret.createEngine({ host: denied }), e => e.code === 'SURFACE_IN_USE');
      assert.ok(original.every(b => b.destroyed === 0)); assert.equal(h.getStatus().pendingUploadBytes, 112);
      const closeState = watched(h.close()); await tick(); assert.equal(closeState.settled, false);
      if (lateReject) { f.allowUnsafe(h); active.record.fences[0].reject({ late: true }); } else active.record.fences[0].resolve();
      await f.pump(); assert.equal(engine.dispose(), disposal);
      if (lateReject) {
        await assert.rejects(h.close(), code('CLOSE_UNSAFE')); assert.ok(diagnostics.some(d => d.code === 'HOST_CLOSE_LATE_FAILURE'));
        const stillDenied = f.host(); await assert.rejects(egret.createEngine({ host: stillDenied }), e => e.code === 'SURFACE_IN_USE');
      } else {
        await h.close(); const successor = f.host(), nextCreation = egret.createEngine({ host: successor, shutdownTimeoutMs: 17 });
        await f.pump(); const next = await nextCreation, closing = next.dispose(); await f.pump(); await closing;
      }
      assert.equal(eligible(f.buffers).length, original.length); assert.ok(original.every(b => b.destroyed === 1));
      assert.ok(imagesOf(f).every(t => t.destroyed === 1));
    } finally { globalThis.setTimeout = savedSet; globalThis.clearTimeout = savedClear; await f.pump(); }
  });
});
