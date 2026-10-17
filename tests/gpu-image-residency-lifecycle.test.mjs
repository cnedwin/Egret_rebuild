// SPDX-License-Identifier: Apache-2.0
// Public lifecycle and device-port ownership controls; no native device claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egret, tick, code, watched, image, view, frame, withGpu, withAuthored,
  imagesOf, writesOf, bindingsOf, admitted, submitSafe, snapshot, pressureInputs,
  prepareReady, retirementBaseline } from './fixtures/gpu-image-residency.mjs';

const idleRejects = (h, expected, cause) => assert.rejects(h.whenIdle(), error => code(expected)(error) && error.cause === cause);

for (const hold of ['scope', 'fence', 'map']) test('L01 unproven cold is not reused while awaiting ' + hold, async () => {
  await withGpu(async f => {
    const h = f.host({ enableReadback: true }); await f.ready(h); const ticket = h.requestReadback(); ticket.catch(() => {});
    const input = frame(), first = f.capture(() => h.renderFrame(input)); admitted(first);
    if (hold !== 'scope') f.settleScopes(first.scopes); else f.settleScopes(first.scopes.slice(1));
    if (hold !== 'fence') first.fences.forEach(d => d.resolve());
    if (hold !== 'map') first.maps.forEach(d => d.resolve()); await tick();
    assert.equal(h.getStatus().pendingFrames, 1); assert.equal(first.textures[0].destroyed, 0);
    const second = f.capture(() => h.renderFrame(input)); admitted(second);
    assert.equal(second.textures.length, 1); assert.notEqual(second.textures[0], first.textures[0]);
    await second.finish(); assert.equal(second.textures[0].destroyed, 0);
    await first.finish(); await ticket; assert.equal(first.textures[0].destroyed, 1); assert.equal(second.textures[0].destroyed, 0);
    await submitSafe(f, h, input); assert.equal(bindingsOf(f).at(-1), second.textures[0]);
  });
});

for (const boundary of ['beforeTexture', 'viewGetter', 'imageView', 'writeTexture', 'encoder', 'finish', 'submit']) {
  test('SUPPORT L01 synchronous ' + boundary + ' failure waits for asynchronous proofs without promotion', async () => {
    await withGpu(async f => {
      const h = f.host(); await f.ready(h); const fault = { boundary };
      f.hooks[boundary] = () => { throw fault; };
      const r = f.capture(() => h.renderFrame(frame())); assert.equal(r.threw, true);
      assert.ok(code('RENDER_FAILED')(r.error)); assert.equal(r.error.cause, fault);
      assert.equal(h.getStatus().firstFailure.cause, fault); assert.equal(h.getStatus().pendingFrames, 1);
      assert.ok(r.textures.every(t => !t.destroyed));
      delete f.hooks[boundary]; await r.finish(); await idleRejects(h, 'RENDER_FAILED', fault);
      assert.equal(h.getStatus().pendingFrames, 0); assert.ok(r.textures.every(t => t.destroyed === 1));
      await f.close(h); assert.ok(r.textures.every(t => t.destroyed === 1));
    });
  });
}

for (const [index, expected] of [[0, 'VALIDATION'], [1, 'INTERNAL'], [2, 'OUT_OF_MEMORY']]) {
  test('SUPPORT L02 fulfilled error scope ' + index + ' cleans safely without promoting', async () => {
    await withGpu(async f => {
      const h = f.host(); await f.ready(h); const cause = { scope: index };
      const r = f.capture(() => h.renderFrame(frame())); admitted(r); r.scopes[index].resolve(cause);
      await r.finish(); await idleRejects(h, expected, cause); assert.equal(r.textures[0].destroyed, 1);
      await f.close(h); assert.equal(h.getStatus().cleanupOutcome, 'safe');
    });
  });
}

for (const fault of ['scope0', 'scope1', 'scope2', 'fence-reject', 'fence-throw', 'map-reject', 'map-throw', 'output']) {
  test('SUPPORT L02 unsafe proof retains image authority until close: ' + fault, async () => {
    await withGpu(async f => {
      const h = f.host({ enableReadback: true }); await f.ready(h); const cause = { fault };
      const ticket = h.requestReadback(); ticket.catch(() => {}); f.allowUnsafe(h);
      if (fault === 'fence-throw') f.hooks.fence = () => { throw cause; };
      if (fault === 'map-throw') f.hooks.map = () => { throw cause; };
      if (fault === 'output') f.hooks.range = () => { throw cause; };
      const r = f.capture(() => h.renderFrame(frame()));
      if (fault === 'map-throw') { assert.equal(r.threw, true); assert.equal(r.error.cause, cause); } else admitted(r);
      if (fault.startsWith('scope')) r.scopes[Number(fault.at(-1))].reject(cause);
      if (fault === 'fence-reject') r.fences[0].reject(cause);
      if (fault === 'map-reject') r.maps[0].reject(cause);
      // A synchronously thrown fence method created a fixture promise before
      // throwing, but that promise is not proof returned to the Host.
      delete f.hooks.fence; delete f.hooks.map;
      await r.finish(); await assert.rejects(ticket, error => error.cause === cause);
      assert.equal(h.getStatus().pendingFrames, 1); assert.equal(r.textures[0].destroyed, 0);
      delete f.hooks.range; await f.close(h, true); assert.equal(r.textures[0].destroyed, 1);
      assert.equal(h.getStatus().pendingFrames, 0); assert.ok(r.buffers.every(b => b.destroyed === 1));
    });
  });
}

test('L03 multiple warm readers keep shared pins until every reader settles', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 3 }); await f.ready(h);
    const views = Array.from({ length: 8 }, () => view(image(1024, 1024)));
    for (const item of views) await submitSafe(f, h, frame([item]));
    const resident = imagesOf(f).slice(), input = frame([views[0]]), texture = resident[0];
    assert.equal(f.logicalBytes, 33554432); assert.ok(resident.every(t => t.destroyed === 0));
    const a = f.capture(() => h.renderFrame(input)), b = f.capture(() => h.renderFrame(input)); admitted(a); admitted(b);
    assert.equal(a.textures.length, 0); assert.equal(b.textures.length, 0); assert.equal(h.getStatus().pendingUploadBytes, 224);
    const idle = h.whenIdle(), waiting = watched(idle);
    // Reader hits touched the shared resource. Touch every other READY once,
    // in legal <=16MiB batches, to make the shared resource oldest again.
    const touchFirst = f.capture(() => h.renderFrame(frame(views.slice(1, 4)))); admitted(touchFirst); await touchFirst.finish();
    const touchRest = f.capture(() => h.renderFrame(frame(views.slice(4, 8)))); admitted(touchRest); await touchRest.finish();
    await b.finish(); assert.equal(waiting.settled, false);
    assert.equal(texture.destroyed, 0); assert.equal(h.getStatus().pendingFrames, 1);
    const start = f.calls.length, pressure = f.capture(() => h.renderFrame(frame([view(image(1024, 1024))]))); admitted(pressure);
    assert.deepEqual(f.calls.slice(start).filter(c => c[0] === 'destroyTexture').map(c => c[1]), [resident[1]],
      'one remaining shared reader forces eviction of the eligible alternative');
    assert.equal(texture.destroyed, 0); assert.equal(resident[1].destroyed, 1); await pressure.finish();
    await a.finish(); await idle; assert.equal(texture.destroyed, 0);
    const releasedStart = f.calls.length, afterRelease = f.capture(() => h.renderFrame(frame([view(image(1024, 1024))]))); admitted(afterRelease);
    assert.deepEqual(f.calls.slice(releasedStart).filter(c => c[0] === 'destroyTexture').map(c => c[1]), [texture],
      'final reader release restores eviction eligibility without changing LRU order');
    await afterRelease.finish(); await f.close(h); assert.equal(texture.destroyed, 1);
    assert.ok(imagesOf(f).every(t => t.destroyed === 1));
  });
});

test('SUPPORT H05 retiring projection charge survives noncandidate cleanup callback', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 4 }); await f.ready(h);
    const views = Array.from({ length: 4 }, () => view(image(1024, 1024))), full = frame(views);
    // Each frame charges all four4MiB crops while one covered draw supplies
    // the noncandidate buffer callback. Image allocation is only4MiB per frame,
    // so the refusal below discriminates original P rather than external Q.
    full.commands = full.commands.map((command, i) => ({ ...command, alpha: i === 0 ? 1 : 0 }));
    const cold = frame(), a = f.capture(() => h.renderFrame(full)), b = f.capture(() => h.renderFrame(full)); admitted(a); admitted(b);
    assert.equal(a.textures.length, 1); assert.equal(b.textures.length, 1); assert.equal(f.logicalBytes, 8388608);
    assert.equal(h.getStatus().pendingFrames, 2); assert.equal(h.getStatus().pendingUploadBytes, 224);
    const target = a.buffers[0]; let observation, entered = 0;
    f.hooks.destroyBuffer = buffer => {
      if (buffer !== target || entered) return; entered++;
      const before = snapshot(f, h), nested = f.capture(() => h.renderFrame(cold));
      observation = { before, nested, after: snapshot(f, h) };
    };
    await a.finish(); delete f.hooks.destroyBuffer;
    assert.equal(entered, 1, 'the original noncandidate retirement hook must actually execute');
    assert.equal(observation.before.status.pendingFrames, 2); assert.equal(observation.before.status.pendingUploadBytes, 224);
    assert.equal(observation.nested.threw, true); assert.ok(code('BACKPRESSURE')(observation.nested.error));
    assert.deepEqual(observation.after, observation.before, 'retiring16MiB plus pending16MiB leaves no4B quota or native/status mutation');
    assert.equal(target.destroyed, 1); assert.equal(h.getStatus().pendingFrames, 1); assert.equal(h.getStatus().pendingUploadBytes, 112);
    const accepted = f.capture(() => h.renderFrame(cold)); admitted(accepted);
    assert.equal(h.getStatus().lastSerial, 3); assert.equal(h.getStatus().pendingFrames, 2);
    await accepted.finish(); await b.finish(); await h.whenIdle(); await f.close(h);
    assert.ok(imagesOf(f).every(t => t.destroyed === 1));
    console.log(JSON.stringify({ case: 'H05', hookCount: entered, retiringProjectionBytes: 16777216,
      otherProjectionBytes: 16777216, nestedRefusal: observation.nested.error.code, callbackUpload: observation.before.status.pendingUploadBytes,
      afterReturnAcceptedSerial: h.getStatus().lastSerial, borrowedDestroyed: 0 }));
  });
});

for (const first of [0, 1]) test('L04 reverse collision completion preserves winner ' + first, async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const input = frame(), records = [f.capture(() => h.renderFrame(input)), f.capture(() => h.renderFrame(input))];
    records.forEach(admitted); await records[first].finish(); const winner = records[first].textures[0];
    assert.equal(winner.destroyed, 0); await records[1 - first].finish();
    assert.equal(records[1 - first].textures[0].destroyed, 1); assert.equal(winner.destroyed, 0);
    await submitSafe(f, h, input); assert.equal(bindingsOf(f).at(-1), winner); assert.equal(imagesOf(f).length, 2);
  });
});

test('SUPPORT L05 unresolved fence retains record and cached close Promise', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const r = f.capture(() => h.renderFrame(frame())); admitted(r);
    f.settleScopes(r.scopes); const closing = h.close(), state = watched(closing); assert.equal(h.close(), closing);
    await tick(); assert.equal(state.settled, false); assert.equal(h.getStatus().pendingFrames, 1);
    assert.equal(h.getStatus().cleanupOutcome, 'pending'); assert.equal(r.textures[0].destroyed, 0);
    r.fences[0].resolve(); await f.pump(); await closing; assert.equal(r.textures[0].destroyed, 1);
  });
});

for (const lateReject of [false, true]) test('SUPPORT L06 Engine timeout preserves surface until late ' + (lateReject ? 'reject' : 'safe'), async () => {
  await withGpu(async f => {
    const h = f.host(), diagnostics = [], creation = egret.createEngine({ host: h, shutdownTimeoutMs: 17, onDiagnostic: d => diagnostics.push(d) });
    await f.pump(); const engine = await creation, r = f.capture(() => h.renderFrame(frame())); admitted(r); f.settleScopes(r.scopes);
    const savedSet = globalThis.setTimeout, savedClear = globalThis.clearTimeout; let timeout;
    globalThis.setTimeout = (fn, delay) => { assert.equal(delay, 17); timeout = fn; return 1; }; globalThis.clearTimeout = () => {};
    try {
      const disposal = engine.dispose(); disposal.catch(() => {}); await tick(); assert.equal(typeof timeout, 'function'); timeout();
      await assert.rejects(disposal, e => e.code === 'ENGINE_CLOSE_TIMEOUT');
      const denied = f.host(); await assert.rejects(egret.createEngine({ host: denied }), e => e.code === 'SURFACE_IN_USE');
      assert.equal(r.textures[0].destroyed, 0); assert.equal(h.getStatus().pendingFrames, 1);
      if (lateReject) { f.allowUnsafe(h); r.fences[0].reject({ late: true }); } else r.fences[0].resolve();
      await f.pump(); assert.equal(engine.dispose(), disposal);
      if (lateReject) {
        await assert.rejects(h.close(), code('CLOSE_UNSAFE')); assert.ok(diagnostics.some(d => d.code === 'HOST_CLOSE_LATE_FAILURE'));
        const stillDenied = f.host(); await assert.rejects(egret.createEngine({ host: stillDenied }), e => e.code === 'SURFACE_IN_USE');
      } else {
        await h.close(); const successor = f.host(), p = egret.createEngine({ host: successor, shutdownTimeoutMs: 17 }); await f.pump(); const next = await p;
        const closeNext = next.dispose(); await f.pump(); await closeNext;
      }
      assert.equal(r.textures[0].destroyed, 1);
    } finally { globalThis.setTimeout = savedSet; globalThis.clearTimeout = savedClear; await f.pump(); }
  });
});

test('SUPPORT R03 original noncandidate buffer retirement actively reenters render', async () => {
  await retirementBaseline('buffer');
});

for (const boundary of ['texture', 'destroyGetter', 'imageView', 'writeTexture', 'submit']) {
  test('SUPPORT R04 synchronous busy ' + boundary + ' callback catches REENTRANT', async () => {
    await withGpu(async f => {
      const h = f.host(); await f.ready(h); let triggered = 0;
      f.hooks[boundary] = () => {
        if (triggered++) return; const before = snapshot(f, h);
        assert.throws(() => h.renderFrame(frame()), code('REENTRANT')); assert.deepEqual(snapshot(f, h), before);
      };
      const r = f.capture(() => h.renderFrame(frame())); admitted(r); assert.ok(triggered > 0);
      assert.equal(h.getStatus().lastSerial, 1); assert.equal(f.calls.filter(c => c[0] === 'submit').length, 1);
      delete f.hooks[boundary]; await r.finish(); await f.close(h);
    });
  });
}

for (const boundary of ['texture', 'destroyGetter', 'viewGetter', 'imageView', 'writeTexture', 'submit']) {
  for (const terminal of ['stop', 'close', 'uncaptured']) test('SUPPORT R01 native ' + boundary + ' callback ' + terminal, async () => {
    await withGpu(async f => {
      const h = f.host(); await f.ready(h); const cause = { boundary, terminal }; let triggered = 0, closing;
      if (terminal === 'uncaptured') f.allowUnsafe(h);
      f.hooks[boundary] = () => {
        if (triggered++) return;
        if (terminal === 'stop') h.stop();
        if (terminal === 'close') { closing = h.close(); closing.catch(() => {}); }
        if (terminal === 'uncaptured') f.emitError(cause);
      };
      const r = f.capture(() => h.renderFrame(frame())); assert.equal(r.threw, true); assert.ok(code('RENDER_FAILED')(r.error));
      assert.ok(triggered > 0); assert.equal(imagesOf(f).length, 1); delete f.hooks[boundary];
      await r.finish();
      if (terminal === 'uncaptured') { assert.equal(h.getStatus().firstFailure.cause, cause); await f.close(h); }
      else { await f.close(h); if (closing) await closing; }
      assert.equal(r.textures[0].destroyed, 1); assert.equal(h.getStatus().pendingFrames, 0);
    });
  });
}

test('SUPPORT R01 queued loss is distinct from delivered notification and synchronous error event', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const cause = { loss: true }; f.allowUnsafe(h); let checked = false;
    f.hooks.writeTexture = () => {
      f.lost.resolve(cause); assert.equal(h.getStatus().state, 'active'); assert.equal(h.getStatus().firstFailure, null); checked = true;
    };
    const r = f.capture(() => h.renderFrame(frame())); admitted(r); assert.equal(checked, true);
    assert.equal(f.calls.filter(c => c[0] === 'submit').length, 1, 'queued Promise notification does not synchronously change Host');
    await tick(); assert.equal(h.getStatus().firstFailure.cause, cause);
    const before = snapshot(f, h); assert.throws(() => h.renderFrame(frame()), code('FAILED')); assert.deepEqual(snapshot(f, h), before);
    delete f.hooks.writeTexture; await r.finish(); assert.equal(r.textures[0].destroyed, 0); await f.close(h, true);
    assert.equal(r.textures[0].destroyed, 1);
  });
});

for (const terminal of ['stop', 'close', 'uncaptured', 'throw']) test('R02 noncandidate cleanup ' + terminal + ' suppresses promotion', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const cause = { cleanup: terminal }; let count = 0, closing;
    if (terminal === 'uncaptured' || terminal === 'throw') f.allowUnsafe(h);
    f.hooks.destroyBuffer = () => {
      if (count++) return;
      if (terminal === 'stop') h.stop();
      if (terminal === 'close') { closing = h.close(); closing.catch(() => {}); }
      if (terminal === 'uncaptured') f.emitError(cause);
      if (terminal === 'throw') throw cause;
    };
    const r = f.capture(() => h.renderFrame(frame())); admitted(r); await r.finish(); assert.ok(count > 0);
    assert.equal(r.textures[0].destroyed, 1, 'failed/nonactive qualification cannot publish READY');
    delete f.hooks.destroyBuffer;
    if (terminal === 'throw') { assert.equal(h.getStatus().firstFailure.cause, cause); await f.close(h, true, cause); }
    else await f.close(h);
    if (closing) await closing;
    assert.equal(r.textures[0].destroyed, 1); assert.ok(r.buffers.every(b => b.destroyed === 1));
  });
});

for (const terminal of ['stop', 'close', 'uncaptured', 'throw']) test('R02 duplicate cleanup ' + terminal + ' preserves single owners', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const input = frame(), cause = { duplicate: terminal }; let entered = 0, closing;
    const a = f.capture(() => h.renderFrame(input)), b = f.capture(() => h.renderFrame(input)); admitted(a); admitted(b);
    await b.finish(); assert.equal(b.textures[0].destroyed, 0, 'winner is genuinely READY');
    if (terminal === 'uncaptured' || terminal === 'throw') f.allowUnsafe(h);
    f.hooks.destroyTexture = t => {
      if (t !== a.textures[0]) return; entered++;
      if (terminal === 'stop') h.stop();
      if (terminal === 'close') { closing = h.close(); closing.catch(() => {}); }
      if (terminal === 'uncaptured') f.emitError(cause);
      if (terminal === 'throw') throw cause;
    };
    await a.finish(); assert.equal(entered, 1); assert.equal(a.textures[0].destroyed, 1);
    if (terminal !== 'close') assert.equal(b.textures[0].destroyed, 0); delete f.hooks.destroyTexture;
    if (terminal === 'throw') { assert.equal(h.getStatus().firstFailure.cause, cause); await f.close(h, true, cause); }
    else await f.close(h);
    if (closing) await closing;
    assert.equal(a.textures[0].destroyed, 1); assert.equal(b.textures[0].destroyed, 1);
  });
});

test('SUPPORT R02 primary encode fault and independent image cleanup throw retain both causes', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const primary = { encode: true }, cleanup = { cleanup: true }; f.allowUnsafe(h);
    f.hooks.finish = () => { throw primary; }; f.hooks.destroyTexture = () => { throw cleanup; };
    const r = f.capture(() => h.renderFrame(frame([view(image()), view(image())])));
    assert.equal(r.threw, true); assert.equal(r.error.cause, primary); delete f.hooks.finish; await r.finish();
    assert.equal(h.getStatus().firstFailure.cause, primary); assert.ok(r.textures.every(t => t.destroyed === 1));
    delete f.hooks.destroyTexture; const closing = h.close(); closing.catch(() => {}); await f.pump();
    await assert.rejects(closing, error => code('CLOSE_UNSAFE')(error) && error.cause === cleanup);
    assert.equal(h.getStatus().firstFailure.cause, primary); assert.ok(r.textures.every(t => t.destroyed === 1));
    assert.equal(f.logicalBytes, 8, 'throw leaves externally unknown charged allocation');
  });
});

test('SUPPORT R01 uncapturable disposer is not reacquired or invented', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const cause = { getter: true }; let attempts = 0; f.allowUnsafe(h);
    f.hooks.destroyGetter = () => { attempts++; throw cause; };
    const r = f.capture(() => h.renderFrame(frame())); assert.equal(r.threw, true); assert.equal(r.error.cause, cause);
    delete f.hooks.destroyGetter; await r.finish(); await f.close(h, true, cause);
    assert.equal(attempts, 1); assert.equal(r.textures[0].destroyed, 0); assert.equal(f.logicalBytes, 4);
  });
});

for (const terminal of ['stop', 'close', 'uncaptured', 'throw', 'queued-loss']) {
  test('R05 B06 synchronous READY destroy ' + terminal + ' gates following creation', async () => {
    await withGpu(async f => {
      const h = f.host({ maxPendingFrames: 4 }); await f.ready(h); const p = pressureInputs(249), ready = await prepareReady(f, h, p);
      const a = f.capture(() => h.renderFrame(frame(p.readers[0]))), b = f.capture(() => h.renderFrame(frame(p.readers[1]))); admitted(a); admitted(b);
      const cause = { ready: terminal }; let entered = 0, closing;
      if (['uncaptured', 'throw', 'queued-loss'].includes(terminal)) f.allowUnsafe(h);
      f.hooks.destroyTexture = t => {
        if (t !== ready[0]) return; entered++; assert.equal(f.logicalBytes, 29361124);
        if (terminal === 'stop') h.stop();
        if (terminal === 'close') { closing = h.close(); closing.catch(() => {}); }
        if (terminal === 'uncaptured') f.emitError(cause);
        if (terminal === 'throw') throw cause;
        if (terminal === 'queued-loss') { f.lost.resolve(cause); assert.equal(h.getStatus().state, 'active'); }
      };
      const r = f.capture(() => h.renderFrame(frame([p.filler]))); assert.equal(entered, 1);
      if (terminal === 'queued-loss') { admitted(r); assert.equal(r.textures.length, 1); await tick(); assert.equal(h.getStatus().firstFailure.cause, cause); }
      else { assert.equal(r.threw, true); assert.equal(r.textures.length, 0, 'observed terminal/throw prevents reserve/create'); }
      delete f.hooks.destroyTexture; await r.finish(); await a.finish(); await b.finish();
      if (terminal === 'throw') { assert.equal(r.error.cause, cause); assert.equal(h.getStatus().firstFailure.cause, cause); }
      if (['throw', 'queued-loss'].includes(terminal)) await f.close(h, true, cause); else await f.close(h);
      if (closing) await closing;
      assert.equal(ready[0].destroyed, 1, 'attempted READY destroy is not retried');
      assert.ok(imagesOf(f).every(t => t.destroyed <= 1));
    });
  });
}

for (const domain of ['outer-transient', 'inner-ready']) for (const terminal of ['stop', 'close', 'uncaptured', 'throw', 'queued-loss']) {
  test('R05 B07 ' + domain + ' destroy ' + terminal + ' retains charge and captured ownership', async () => {
    await withGpu(async f => {
      const h = f.host({ maxPendingFrames: 4 }); await f.ready(h); const p = pressureInputs(248), ready = await prepareReady(f, h, p);
      const a = f.capture(() => h.renderFrame(frame(p.readers[0]))), b = f.capture(() => h.renderFrame(frame(p.readers[1]))); admitted(a); admitted(b);
      const filler = f.capture(() => h.renderFrame(frame([p.filler]))), cold = f.capture(() => h.renderFrame(frame([p.cold]))); admitted(filler); admitted(cold);
      await filler.finish(); const transient = cold.textures[0], target = domain === 'outer-transient' ? transient : ready[0];
      const cause = { domain, terminal }; let entered = 0, inner, closing;
      if (['uncaptured', 'throw', 'queued-loss'].includes(terminal)) f.allowUnsafe(h);
      const terminalAction = () => {
        if (terminal === 'stop') h.stop();
        if (terminal === 'close') { closing = h.close(); closing.catch(() => {}); }
        if (terminal === 'uncaptured') f.emitError(cause);
        if (terminal === 'throw') throw cause;
        if (terminal === 'queued-loss') { f.lost.resolve(cause); assert.equal(h.getStatus().state, 'active'); }
      };
      f.hooks.destroyTexture = t => {
        if (t === target) { entered++; assert.equal(f.logicalBytes, 29361128); assert.equal(transient.returned, 0); terminalAction(); }
        if (t !== transient || (domain === 'outer-transient' && terminal !== 'queued-loss')) return;
        inner = f.capture(() => h.renderFrame(frame([p.next])));
        if (terminal === 'queued-loss') { admitted(inner); assert.equal(inner.textures.length, 1); assert.equal(h.getStatus().lastSerial, 260); }
        else { assert.equal(inner.threw, true); assert.equal(inner.textures.length, 0); }
      };
      await cold.finish(); assert.equal(entered, 1); delete f.hooks.destroyTexture;
      if (terminal === 'queued-loss') { await tick(); assert.equal(h.getStatus().firstFailure.cause, cause); }
      if (inner) await inner.finish(); await a.finish(); await b.finish();
      if (terminal === 'throw') {
        assert.equal(h.getStatus().firstFailure.cause, cause);
        if (inner) assert.equal(inner.error.cause, cause);
      }
      if (['throw', 'queued-loss'].includes(terminal)) await f.close(h, true, cause); else await f.close(h);
      if (closing) await closing;
      assert.equal(target.destroyed, 1); assert.ok(imagesOf(f).every(t => t.destroyed <= 1));
      if (terminal === 'throw') assert.equal(target.returned, 0, 'throw never proves charge release');
    });
  });
}

test('R02 stop disables lookup synchronously but keeps READY until explicit close', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); await submitSafe(f, h, frame()); const texture = imagesOf(f)[0];
    assert.equal(texture.destroyed, 0); const before = f.calls.length; h.stop(); assert.equal(f.calls.length, before);
    assert.equal(texture.destroyed, 0); assert.throws(() => h.renderFrame(frame()), code('STOPPED'));
    await h.whenIdle(); assert.equal(texture.destroyed, 0); await f.close(h); assert.equal(texture.destroyed, 1);
  });
});

test('R02 delivered loss invalidates READY and close retains borrowed device observer ordering', async () => {
  await withGpu(async f => {
    const h = f.host(); await f.ready(h); const input = frame(); await submitSafe(f, h, input); const texture = imagesOf(f)[0];
    assert.equal(texture.destroyed, 0); const cause = { delivered: true }; f.allowUnsafe(h); f.lost.resolve(cause); await tick();
    assert.equal(h.getStatus().firstFailure.cause, cause); const before = snapshot(f, h);
    assert.throws(() => h.renderFrame(input), code('FAILED')); assert.deepEqual(snapshot(f, h), before);
    assert.equal(texture.destroyed, 0); await f.close(h, true); assert.equal(texture.destroyed, 1);
    assert.ok(f.calls.findIndex(c => c[0] === 'destroyTexture') < f.calls.findIndex(c => c[0] === 'remove'));
  });
});

test('R05 delivered loss before B06 submit refuses before any active READY eviction', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 4 }); await f.ready(h); const p = pressureInputs(249), ready = await prepareReady(f, h, p);
    const a = f.capture(() => h.renderFrame(frame(p.readers[0]))), b = f.capture(() => h.renderFrame(frame(p.readers[1]))); admitted(a); admitted(b);
    const cause = { deliveredBeforeBegin: true }; f.allowUnsafe(h); f.lost.resolve(cause); await tick();
    assert.equal(h.getStatus().firstFailure.cause, cause); const before = snapshot(f, h);
    assert.throws(() => h.renderFrame(frame([p.filler])), code('FAILED')); assert.deepEqual(snapshot(f, h), before);
    assert.ok(ready.every(t => !t.destroyed)); await a.finish(); await b.finish(); await f.close(h, true);
    assert.ok(ready.every(t => t.destroyed === 1));
  });
});

test('R05 delivered loss before B07 settlement moves cleanup to closing and rejects nested render', async () => {
  await withGpu(async f => {
    const h = f.host({ maxPendingFrames: 4 }); await f.ready(h); const p = pressureInputs(248); await prepareReady(f, h, p);
    const a = f.capture(() => h.renderFrame(frame(p.readers[0]))), b = f.capture(() => h.renderFrame(frame(p.readers[1]))); admitted(a); admitted(b);
    const filler = f.capture(() => h.renderFrame(frame([p.filler]))), cold = f.capture(() => h.renderFrame(frame([p.cold]))); admitted(filler); admitted(cold);
    await filler.finish(); const cause = { deliveredBeforeRetire: true }; f.allowUnsafe(h); f.lost.resolve(cause); await tick();
    assert.equal(h.getStatus().firstFailure.cause, cause); let entered = 0;
    f.hooks.destroyTexture = t => {
      if (t !== cold.textures[0]) return; entered++; assert.equal(h.getStatus().state, 'closing');
      const before = snapshot(f, h); assert.throws(() => h.renderFrame(frame([p.next])), code('CLOSED')); assert.deepEqual(snapshot(f, h), before);
    };
    await cold.finish(); assert.equal(entered, 0, 'unsafe record remains quarantined until close');
    await a.finish(); await b.finish(); await f.close(h, true); assert.equal(entered, 1); assert.equal(cold.textures[0].destroyed, 1);
  });
});
