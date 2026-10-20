// SPDX-License-Identifier: Apache-2.0
// Public behavior with genuine Engine frames and owned GPU ports. No native
// recovery brand, shader, pixel, physical-memory or timing-performance claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  usingGpu, requireUpload, requireSession, readyUpload, finishUpload, observe,
  until, turn, tick, hasCode, expectCode, refusal, presentation, ownSignal,
  capture, admitted, submit, triangleScene, MiB,
} from './fixtures/shared-frame-upload-gpu.mjs';

test('GPU U00 genuine ordinary baseline remains available before staging', async () => {
  await usingGpu(async ({ h }) => {
    assert.equal(h.getStatus().state, 'active');
    assert.equal(h.getStatus().pendingFrames, 0);
  });
});

test('GPU U01 staged ready requires upload fence and every validation scope', async () => {
  for (const held of ['fence', 'scope']) await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h);
    const s = f.scopes.length, q = f.fences.length;
    const ticket = h.stageSharedFrame(frame), ready = observe(ticket.ready);
    await until(f, () => f.fences.length > q && f.scopes.length > s, { settle: false });
    assert.equal(f.open, 0, 'no error scope crosses the scheduled-task boundary');
    if (held !== 'fence') f.fences.slice(q).forEach(p => p.resolve());
    f.scopes.slice(s).forEach((p, i) => { if (held !== 'scope' || i !== 0) p.resolve(null); });
    await tick(); await turn();
    assert.equal(ready.settled, false, held + ' remains an original unsettled upload proof');
    assert.equal(h.getStatus().pendingFrames, 1);
    await readyUpload(f, ticket); await finishUpload(f, ticket);
  });
});

test('GPU U02 ready never resizes or presents; submit transfers without reupload', async () => {
  await usingGpu(async ({ f, a, h }) => {
    requireUpload(h); requireSession(h);
    const frame = a.capture({ width: 17, height: 9 }), offset = f.calls.length;
    const ticket = h.stageSharedFrame(frame), result = await readyUpload(f, ticket);
    assert.ok(Object.isFrozen(result));
    assert.deepEqual(result, { generation: h.getSessionStatus().generation, frameId: frame.frameId });
    assert.deepEqual(presentation(f.calls.slice(offset)), []);
    assert.deepEqual([f.canvas.width, f.canvas.height], [8, 8]);
    assert.equal(h.getStatus().lastSerial, 1);
    const before = f.calls.length, submission = ticket.submit(), done = observe(submission.completed);
    assert.ok(Object.isFrozen(submission)); assert.equal(submission.serial, 2);
    assert.equal(submission.frameId, frame.frameId); assert.equal(submission.generation, result.generation);
    assert.equal(done.settled, false);
    const events = f.calls.slice(before);
    assert.equal(events.filter(c => ['writeTexture', 'writeBuffer'].includes(c[0])).length, 0);
    assert.equal(events.filter(c => c[0] === 'submit').length, 1);
    assert.ok(events.some(c => c[0] === 'draw'));
    assert.deepEqual([f.canvas.width, f.canvas.height], [17, 9]);
    await until(f, () => done.settled); await submission.completed;
  });
});

test('GPU U03 staging and ordinary work compete for the same two records', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h);
    const stage = h.stageSharedFrame(frame); await readyUpload(f, stage);
    const ordinary = capture(f, () => h.renderSharedFrame(frame)); admitted(ordinary);
    assert.equal(h.getStatus().pendingFrames, 2);
    refusal(f, h, () => h.stageSharedFrame(frame), 'BACKPRESSURE');
    refusal(f, h, () => h.renderSharedFrame(frame), 'BACKPRESSURE');
    await ordinary.finish(); stage.dispose();
    await until(f, () => h.getStatus().pendingFrames === 0);
  });
});

test('GPU U04 configured one-record limit includes ready-held stages', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h); const stage = h.stageSharedFrame(frame); await readyUpload(f, stage);
    refusal(f, h, () => h.stageSharedFrame(frame), 'BACKPRESSURE');
    refusal(f, h, () => h.renderSharedFrame(frame), 'BACKPRESSURE');
    stage.dispose(); stage.dispose(); expectCode(() => stage.submit(), 'UPLOAD_DISPOSED');
    await until(f, () => h.getStatus().pendingFrames === 0);
  }, { options: { maxPendingFrames: 1 } });
});

test('GPU U05 genuine frame authority precedes stage option reads', async () => {
  await usingGpu(async ({ f, a, h, frame }) => {
    requireUpload(h); let reads = 0;
    const options = { get signal() { reads++; throw new Error('must not be read'); } };
    refusal(f, h, () => h.stageSharedFrame({ ...frame }, options), 'FRAME_PROFILE_UNSUPPORTED');
    assert.equal(reads, 0);
    refusal(f, h, () => h.stageSharedFrame(a.capture({ outputAlpha: 'opaque', clearAlpha: 1 })), 'FRAME_PROFILE_UNSUPPORTED');
  });
});

test('GPU U06 stage tickets authenticate receiver before lifecycle and transfer once', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h); const ticket = h.stageSharedFrame(frame), ready = observe(ticket.ready);
    refusal(f, h, () => ticket.submit(), 'UPLOAD_NOT_READY');
    const copy = { ...ticket, submit: ticket.submit, dispose: ticket.dispose };
    refusal(f, h, () => copy.submit(), 'UPLOAD_INVALID');
    refusal(f, h, () => copy.dispose(), 'UPLOAD_INVALID');
    refusal(f, h, () => ticket.submit.call({}), 'UPLOAD_INVALID');
    assert.equal(ready.settled, false);
    await readyUpload(f, ticket); const submission = await finishUpload(f, ticket);
    refusal(f, h, () => ticket.submit(), 'UPLOAD_USED');
    ticket.dispose(); ticket.dispose(); await submission.completed;
    const closing = observe(h.close()); await until(f, () => closing.settled);
    expectCode(() => copy.submit(), 'UPLOAD_INVALID');
    expectCode(() => copy.dispose(), 'UPLOAD_INVALID');
  });
});

test('GPU U07 idle captures a ready-held record but excludes a later admission', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h);
    const first = h.stageSharedFrame(frame); await readyUpload(f, first);
    const idle = observe(h.whenIdle());
    const second = h.stageSharedFrame(frame); await readyUpload(f, second);
    await tick(); assert.equal(idle.settled, false);
    await finishUpload(f, first);
    await until(f, () => idle.settled);
    assert.equal(idle.rejected, false); assert.equal(h.getStatus().pendingFrames, 1);
    second.dispose(); await until(f, () => h.getStatus().pendingFrames === 0);
  });
});

test('GPU U08 stage reserves padded readback before a request and binds only at submit', async () => {
  await usingGpu(async ({ f, a, h }) => {
    requireUpload(h);
    const frame = a.capture({ width: 65, height: 3 }), before = f.calls.length;
    const stage = h.stageSharedFrame(frame); await readyUpload(f, stage);
    assert.equal(h.getStatus().pendingReadbackBytes, 512 * 3 + 65 * 3 * 4);
    assert.equal(f.calls.slice(before).filter(c => ['copy', 'map'].includes(c[0])).length, 0);
    const readback = h.requestReadback(), read = observe(readback);
    const submitted = stage.submit(), done = observe(submitted.completed), idle = observe(h.whenIdle());
    await until(f, () => done.settled && f.maps.length > 0, { maps: false });
    await submitted.completed;
    assert.equal(read.settled, false); assert.equal(idle.settled, false);
    assert.equal(h.getStatus().pendingFrames, 1);
    await until(f, () => read.settled && idle.settled);
    const value = await readback;
    assert.deepEqual([value.width, value.height, value.bytes.byteLength], [65, 3, 780]);
    assert.equal(value.generation, submitted.generation);
    assert.equal(value.serial, submitted.serial);
    assert.equal(h.getStatus().pendingReadbackBytes, 0);
  }, { options: { enableReadback: true } });
});

test('GPU U09 ordinary render can bind the request while a stage is waiting', async () => {
  await usingGpu(async ({ f, a, h, frame }) => {
    requireUpload(h);
    const stage = h.stageSharedFrame(a.capture({ width: 13, height: 5 })); await readyUpload(f, stage);
    const ordinaryRead = h.requestReadback(); ordinaryRead.catch(() => {});
    const ordinary = capture(f, () => h.renderSharedFrame(frame)); admitted(ordinary);
    await ordinary.finish(); assert.equal((await ordinaryRead).width, 8);
    const laterRead = h.requestReadback(); laterRead.catch(() => {});
    const submitted = stage.submit(); const done = observe(submitted.completed), read = observe(laterRead);
    await until(f, () => done.settled && read.settled);
    assert.equal((await laterRead).width, 13); assert.equal((await laterRead).serial, submitted.serial);
  }, { options: { enableReadback: true } });
});

test('GPU U10 possible readback budget is checked without a current read request', async () => {
  await usingGpu(async ({ f, a, h }) => {
    requireUpload(h);
    refusal(f, h, () => h.stageSharedFrame(a.capture({ width: 65, height: 3 })), 'FRAME_BUDGET');
  }, { options: { enableReadback: true, maxReadbackBytes: 2300 } });
});

test('GPU U11 logical geometry upload and target budget refuse before native work', async () => {
  await usingGpu(async ({ f, a, h }) => {
    requireUpload(h); a.solid(); a.solid(); a.solid();
    const over = a.capture(); assert.equal(over.commands.filter(c => c.kind === 'rect').length, 4);
    refusal(f, h, () => h.stageSharedFrame(over), 'FRAME_BUDGET');
  }, { options: { maxUploadBytes: 1024 } });
  await usingGpu(async ({ f, a, h }) => {
    requireUpload(h);
    refusal(f, h, () => h.stageSharedFrame(a.capture({ width: 9, height: 8 })), 'BACKING_LIMIT');
  }, { options: { maxBackingPixels: 64 } });
});

test('GPU U12 aggregate chunk payload obeys 4 MiB markers and exact page rows', async () => {
  await usingGpu(async ({ f, a, h }) => {
    requireUpload(h); await a.bitmap(1024, 1024, 91); await a.bitmap(1024, 512, 183);
    const frame = a.capture(), markers = [], ranges = new Map();
    let bytes = 0, scheduled = false, tasks = 0;
    const charge = amount => {
      bytes += amount; assert.ok(bytes <= 4 * MiB, 'aggregate image plus geometry payload before next ordinary task marker');
      if (!scheduled) {
        scheduled = true; tasks++;
        markers.push(new Promise(resolve => setTimeout(() => { bytes = 0; scheduled = false; resolve(); }, 0)));
      }
    };
    f.hooks.writeBuffer = (buffer, offset, data) => {
      assert.equal(offset % 4, 0); assert.equal(data.byteLength % 4, 0);
      if (buffer.descriptor.usage === 40) {
        assert.equal(offset % 44, 0); assert.equal(data.byteLength % 44, 0);
      }
      if (buffer.descriptor.usage === 72) assert.equal(data.byteLength % 128, 0);
      charge(data.byteLength);
    };
    f.hooks.writeTexture = (destination, data, layout, size) => {
      const width = size.width ?? size[0], height = size.height ?? size[1];
      const y = destination.origin?.y ?? destination.origin?.[1] ?? 0;
      const row = width * 4, stride = layout.bytesPerRow ?? row, offset = layout.offset ?? 0;
      assert.equal(width, 1024); assert.ok(Number.isInteger(y) && Number.isInteger(height) && height > 0);
      charge(row * height);
      const observed = ranges.get(destination.texture) ?? []; observed.push([y, height]); ranges.set(destination.texture, observed);
      const color = destination.texture.descriptor.size.height === 1024 ? 91 : 183;
      for (let r = 0; r < height; r++) {
        const index = offset + r * stride;
        assert.deepEqual([...data.subarray(index, index + 4)], [color, color, color, 255]);
        assert.deepEqual([...data.subarray(index + row - 4, index + row)], [color, color, color, 255]);
      }
    };
    const stage = h.stageSharedFrame(frame); await readyUpload(f, stage); await Promise.all(markers);
    assert.ok(tasks >= 2); assert.equal(ranges.size, 2);
    for (const [texture, rows] of ranges) {
      let next = 0;
      for (const [y, count] of rows) { assert.equal(y, next); next += count; }
      assert.equal(next, texture.descriptor.size.height);
    }
    assert.equal(f.open, 0); await finishUpload(f, stage);
  });
});

test('GPU U13 partial upload abort publishes refusal while original proof still owns the slot', async () => {
  await usingGpu(async ({ f, a, h }) => {
    requireUpload(h); await a.bitmap(1024, 1024);
    const signal = ownSignal(), reason = Object.freeze({ abort: 'after-first-write' });
    let writes = 0;
    f.hooks.writeTexture = () => { if (++writes === 1) signal.abort(reason); };
    const stage = h.stageSharedFrame(a.capture(), { signal: signal.signal }), ready = observe(stage.ready);
    await until(f, () => writes > 0 && ready.settled, { settle: false });
    assert.equal(ready.rejected, true); assert.ok(hasCode('UPLOAD_ABORTED')(ready.error)); assert.equal(ready.error.cause, reason);
    assert.equal(h.getStatus().pendingFrames, 1);
    refusal(f, h, () => h.stageSharedFrame(a.capture()), 'BACKPRESSURE');
    delete f.hooks.writeTexture;
    await until(f, () => h.getStatus().pendingFrames === 0);
    assert.equal(signal.stats.removes, 1); assert.equal(signal.listeners.size, 0);
  }, { options: { maxPendingFrames: 1 } });
});

test('GPU U14 already-aborted signal preserves exact reason without admission', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h); const signal = ownSignal(); signal.setAborted(undefined);
    const before = f.calls.length;
    assert.throws(() => h.stageSharedFrame(frame, { signal: signal.signal }),
      error => hasCode('UPLOAD_ABORTED')(error) && error.cause === undefined);
    assert.equal(signal.stats.reasonReads, 1); assert.equal(signal.stats.adds, 0);
    assert.equal(f.calls.length, before); assert.equal(h.getStatus().pendingFrames, 0);
  });
});

test('GPU U15 abort between initial sample and subscription is caught by late sample', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h); const signal = ownSignal(), reason = { late: true };
    signal.hooks.add = () => signal.setAborted(reason);
    const before = f.calls.length;
    assert.throws(() => h.stageSharedFrame(frame, { signal: signal.signal }),
      error => hasCode('UPLOAD_ABORTED')(error) && error.cause === reason);
    assert.equal(signal.stats.abortedReads, 2); assert.equal(signal.stats.reasonReads, 1);
    assert.equal(signal.stats.adds, 1); assert.equal(signal.stats.removes, 1);
    assert.equal(signal.listeners.size, 0); assert.equal(f.calls.length, before);
    await until(f, () => h.getStatus().pendingFrames === 0);
  });
});

test('GPU U16 reason throw and option reentry keep exact cause and terminal priority', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h); const signal = ownSignal(); signal.setAborted('not-read-successfully');
    signal.hooks.reason = () => { throw undefined; };
    const before = f.calls.length;
    assert.throws(() => h.stageSharedFrame(frame, { signal: signal.signal }),
      error => hasCode('UPLOAD_OPTIONS_INVALID')(error) && error.cause === undefined);
    assert.equal(f.calls.length, before); assert.equal(h.getStatus().pendingFrames, 0);
    let inner;
    const options = { get signal() {
      try { h.stageSharedFrame(frame); } catch (error) { inner = error; }
      h.stop(); throw undefined;
    } };
    assert.throws(() => h.stageSharedFrame(frame, options), hasCode('STOPPED'));
    assert.ok(hasCode('REENTRANT')(inner));
    assert.equal(h.getStatus().pendingFrames, 0);
  });
});

test('GPU U17 subscription close unwinds before native writes and removal is once', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h); const signal = ownSignal(), before = f.calls.length;
    let closing;
    signal.hooks.add = () => { closing = observe(h.close()); throw undefined; };
    assert.throws(() => h.stageSharedFrame(frame, { signal: signal.signal }), hasCode('CLOSED'));
    await until(f, () => closing.settled);
    assert.equal(signal.stats.removes, 1); assert.equal(signal.listeners.size, 0);
    assert.equal(f.calls.slice(before).filter(c => ['writeTexture', 'writeBuffer', 'submit'].includes(c[0])).length, 0);
  });
});

test('GPU U18 post-submit abort and dispose do not revoke transferred completion', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h); const signal = ownSignal();
    const stage = h.stageSharedFrame(frame, { signal: signal.signal }); await readyUpload(f, stage);
    const submitted = stage.submit(), completed = observe(submitted.completed);
    signal.abort('after-transfer'); stage.dispose(); stage.dispose();
    assert.equal(signal.stats.removes, 1); assert.equal(signal.listeners.size, 0);
    assert.equal(completed.settled, false);
    await until(f, () => completed.settled); await submitted.completed;
    assert.equal(completed.rejected, false); assert.equal(h.getStatus().lastSerial, 2);
  });
});

test('GPU U19 ready-held deadline expires after real ten seconds', { timeout: 20000 }, async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h); const stage = h.stageSharedFrame(frame), result = await readyUpload(f, stage);
    const idle = observe(h.whenIdle());
    await new Promise(resolve => setTimeout(resolve, 10025));
    assert.equal(await stage.ready, result, 'fulfilled readiness is not rewritten');
    expectCode(() => stage.submit(), 'UPLOAD_EXPIRED');
    await until(f, () => idle.settled && h.getStatus().pendingFrames === 0);
    assert.equal(idle.rejected, true); assert.ok(hasCode('UPLOAD_EXPIRED')(idle.error));
  });
});

test('GPU U19b submit refuses an elapsed deadline before the overdue timer can run', { timeout: 20000 }, async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h); const stage = h.stageSharedFrame(frame), result = await readyUpload(f, stage);
    const idle = observe(h.whenIdle()), before = f.calls.length;
    // Block this actual task beyond the fixed product deadline. No clock or
    // scheduler is replaced, and submit runs before yielding to the due timer.
    assert.equal(Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10025), 'timed-out');
    expectCode(() => stage.submit(), 'UPLOAD_EXPIRED');
    assert.deepEqual(presentation(f.calls.slice(before)), []);
    assert.equal(await stage.ready, result, 'fulfilled readiness is not rewritten');
    await until(f, () => idle.settled && h.getStatus().pendingFrames === 0);
    assert.equal(idle.rejected, true); assert.ok(hasCode('UPLOAD_EXPIRED')(idle.error));
  });
});

test('GPU U20 genuine scene staging retains depth and presents scene then overlay once', async () => {
  await usingGpu(async ({ f, h, frame, sceneFrame }) => {
    requireUpload(h, true); let optionReads = 0;
    refusal(f, h, () => h.stageSceneSharedFrame({ ...sceneFrame }, frame,
      { get signal() { optionReads++; throw undefined; } }), 'FRAME_INVALID');
    assert.equal(optionReads, 0);
    const before = f.calls.length, stage = h.stageSceneSharedFrame(sceneFrame, frame);
    await readyUpload(f, stage);
    assert.deepEqual(presentation(f.calls.slice(before)), []);
    assert.ok(h.getSceneStatus().pendingSceneBytes > 0); assert.ok(h.getSceneStatus().pendingDepthBytes > 0);
    const submitStart = f.calls.length; await finishUpload(f, stage);
    const events = f.calls.slice(submitStart);
    assert.equal(events.filter(c => c[0] === 'pass').length, 3);
    assert.equal(events.filter(c => c[0] === 'drawIndexed').length, 1);
    assert.equal(events.filter(c => c[0] === 'submit').length, 1);
    assert.equal(events.filter(c => ['writeBuffer', 'writeTexture'].includes(c[0])).length, 0);
    await until(f, () => h.getStatus().pendingFrames === 0);
    assert.equal(h.getSceneStatus().pendingDepthBytes, 0);
  }, { scene: true });
});

test('GPU U21 ready-held resident page survives complete count-pressure turnover', async () => {
  await usingGpu(async ({ f, a, h }) => {
    requireUpload(h);
    const items = [];
    for (let i = 0; i < 512; i++) { const item = await a.bitmap(1, 1, i % 251); item.bitmap.visible = false; items.push(item); }
    const selected = indices => {
      for (const item of items) item.bitmap.visible = false;
      for (const index of indices) items[index].bitmap.visible = true;
      return a.capture();
    };
    let firstPage;
    for (let base = 0; base < 256; base += 16) {
      const record = capture(f, () => h.renderSharedFrame(selected(Array.from({ length: 16 }, (_, i) => base + i))));
      admitted(record);
      const pages = record.textures.filter(t => t.descriptor.format === 'rgba8unorm-srgb' && t.descriptor.usage === 6);
      assert.equal(pages.length, 16); if (base === 0) firstPage = pages[0];
      await record.finish();
    }
    assert.equal(firstPage.destroyed, 0);
    const before = f.calls.length, stage = h.stageSharedFrame(selected([0]));
    await readyUpload(f, stage);
    assert.equal(f.calls.slice(before).filter(c => c[0] === 'writeTexture').length, 0, 'stage pins a genuine resident hit');
    for (let base = 256; base < 512; base += 16) {
      const record = capture(f, () => h.renderSharedFrame(selected(Array.from({ length: 16 }, (_, i) => base + i))));
      admitted(record); await record.finish();
      assert.equal(firstPage.destroyed, 0, 'pinned resident survives even after all other original entries turn over');
      assert.equal(h.getStatus().pendingFrames, 1);
    }
    const submitStart = f.calls.length; await finishUpload(f, stage);
    assert.equal(f.calls.slice(submitStart).filter(c => c[0] === 'writeTexture').length, 0);
    const selectedTextures = f.calls.slice(submitStart).filter(c => c[0] === 'setBindGroup')
      .flatMap(c => c[2].descriptor.entries).filter(e => e.binding === 1).map(e => e.resource.texture);
    assert.ok(selectedTextures.includes(firstPage), 'submitted stage uses its originally pinned page');
  });
});

test('GPU U21b cancellation before the first upload retires an admitted resident victim', async () => {
  await usingGpu(async ({ f, a, h }) => {
    requireUpload(h); const items = [], pages = [];
    for (let i = 0; i < 257; i++) { const item = await a.bitmap(1, 1, i % 251); item.bitmap.visible = false; items.push(item); }
    const selected = indices => {
      for (const item of items) item.bitmap.visible = false;
      for (const index of indices) items[index].bitmap.visible = true;
      return a.capture();
    };
    for (let base = 0; base < 256; base += 16) {
      const record = capture(f, () => h.renderSharedFrame(selected(Array.from({ length: 16 }, (_, i) => base + i))));
      admitted(record); pages.push(...record.textures.filter(t => t.descriptor.format === 'rgba8unorm-srgb' && t.descriptor.usage === 6));
      await record.finish();
    }
    assert.equal(pages.length, 256); assert.equal(pages.filter(t => t.destroyed !== 0).length, 0);
    const frame = selected([256]), before = f.calls.length, stage = h.stageSharedFrame(frame), ready = observe(stage.ready);
    stage.dispose();
    await until(f, () => ready.settled && h.getStatus().pendingFrames === 0);
    assert.equal(ready.rejected, true); assert.ok(hasCode('UPLOAD_DISPOSED')(ready.error));
    assert.equal(f.calls.slice(before).filter(c => ['writeTexture', 'texture', 'writeBuffer', 'buffer'].includes(c[0])).length, 0);
    assert.equal(pages.filter(t => t.destroyed === 1).length, 1, 'original admitted victim is destroyed before Host close');
    const replacement = capture(f, () => h.renderSharedFrame(frame)); admitted(replacement); await replacement.finish();
  });
});

test('GPU U22 recursive reason event is latched once and a reason-close wins', async () => {
  for (const closes of [false, true]) await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h); const signal = ownSignal(), reason = Object.freeze({ first: true });
    let closing;
    signal.hooks.reason = () => {
      signal.abort({ recursive: true });
      if (closes) { closing = observe(h.close()); throw undefined; }
    };
    const stage = h.stageSharedFrame(frame, { signal: signal.signal }), ready = observe(stage.ready);
    signal.abort(reason);
    await tick();
    assert.equal(ready.settled, true); assert.equal(ready.rejected, true);
    assert.ok(hasCode(closes ? 'CLOSED' : 'UPLOAD_ABORTED')(ready.error));
    // ownSignal's getter returns its current value after the callback. The once
    // read remains the oracle; no copied cancellation algorithm chooses a reason.
    assert.equal(signal.stats.reasonReads, 1); assert.equal(signal.stats.removes, 1);
    assert.equal(signal.listeners.size, 0);
    await until(f, () => closes ? closing.settled : h.getStatus().pendingFrames === 0);
  });
});

test('GPU U23 healthy subscription throw preserves undefined and removes once', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h); const signal = ownSignal(), before = f.calls.length;
    signal.hooks.add = () => { throw undefined; };
    assert.throws(() => h.stageSharedFrame(frame, { signal: signal.signal }),
      error => hasCode('UPLOAD_OPTIONS_INVALID')(error) && error.cause === undefined);
    assert.equal(signal.stats.removes, 1); assert.equal(signal.listeners.size, 0);
    assert.equal(signal.stats.reasonReads, 0); assert.equal(f.calls.length, before);
    await until(f, () => h.getStatus().pendingFrames === 0);
  });
});

test('GPU U24 signal and methods are captured once; healthy reason and unknown options are unread', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h); const signal = ownSignal();
    const add = signal.signal.addEventListener, remove = signal.signal.removeEventListener;
    let signalReads = 0, addReads = 0, removeReads = 0;
    Object.defineProperties(signal.signal, {
      addEventListener: { configurable: true, get() { addReads++; return add; } },
      removeEventListener: { configurable: true, get() { removeReads++; return remove; } },
    });
    const options = { get signal() { signalReads++; return signal.signal; },
      get allocator() { throw new Error('unknown option read'); } };
    const stage = h.stageSharedFrame(frame, options);
    Object.defineProperties(signal.signal, {
      addEventListener: { get() { throw new Error('reread add'); } },
      removeEventListener: { get() { throw new Error('reread remove'); } },
    });
    await readyUpload(f, stage); stage.dispose();
    await until(f, () => h.getStatus().pendingFrames === 0);
    assert.deepEqual([signalReads, addReads, removeReads], [1, 1, 1]);
    assert.equal(signal.stats.abortedReads, 2); assert.equal(signal.stats.reasonReads, 0);
    assert.equal(signal.stats.adds, 1); assert.equal(signal.stats.removes, 1);
  });
});

// Terminal accounting for new stages remains stricter than legacy immediate close.
for (const proof of ['fence', 'scope']) test('GPU U25 unknown staged ' + proof + ' proof stays charged after unsafe close', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h); f.allowUnsafe(h);
    const scopeStart = f.scopes.length, fenceStart = f.fences.length, callStart = f.calls.length;
    const fault = { proof }, stage = h.stageSharedFrame(frame), ready = observe(stage.ready);
    await until(f, () => f.scopes.length > scopeStart && f.fences.length > fenceStart, { settle: false });
    if (proof === 'fence') f.fences[fenceStart].reject(fault);
    else f.scopes[scopeStart].reject(fault);
    await until(f, () => ready.settled);
    assert.equal(ready.rejected, true);
    assert.equal(h.getStatus().firstFailure.cause, fault);
    assert.equal(h.getStatus().pendingFrames, 1);
    assert.ok(h.getStatus().pendingUploadBytes > 0);
    const closing = observe(h.close()); await until(f, () => closing.settled);
    assert.equal(closing.rejected, true); assert.ok(hasCode('CLOSE_UNSAFE')(closing.error));
    assert.equal(h.getStatus().cleanupOutcome, 'unsafe');
    assert.equal(h.getStatus().pendingFrames, 1, 'actual callback settlement is not safe retirement proof');
    assert.ok(h.getStatus().pendingUploadBytes > 0);
    assert.equal(h.getStatus().firstFailure.cause, fault);
    assert.deepEqual(presentation(f.calls.slice(callStart)), []);
    assert.equal(f.calls.filter(c => c[0] === 'deviceDestroy').length, 0);
    assert.ok(f.buffers.every(b => b.destroyed <= 1));
    assert.ok(f.textures.every(t => t.destroyed <= 1));
    assert.equal(h.close(), h.close(), 'close never retries unknown cleanup');
  });
});

test('GPU U26 fulfilled validation fault keeps known stage cleanup safe', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireUpload(h);
    const scopeStart = f.scopes.length, fenceStart = f.fences.length, callStart = f.calls.length;
    const fault = { validation: true }, stage = h.stageSharedFrame(frame), ready = observe(stage.ready);
    await until(f, () => f.scopes.length > scopeStart && f.fences.length > fenceStart, { settle: false });
    f.scopes[scopeStart].resolve(fault);
    await until(f, () => ready.settled && h.getStatus().pendingFrames === 0);
    assert.equal(ready.rejected, true); assert.ok(hasCode('VALIDATION')(ready.error));
    assert.equal(ready.error.cause, fault); assert.equal(h.getStatus().firstFailure.cause, fault);
    const closing = observe(h.close()); await until(f, () => closing.settled);
    assert.equal(closing.rejected, false); assert.equal(h.getStatus().cleanupOutcome, 'safe');
    assert.equal(h.getStatus().pendingFrames, 0); assert.equal(h.getStatus().pendingUploadBytes, 0);
    assert.deepEqual(presentation(f.calls.slice(callStart)), []);
    assert.equal(f.calls.filter(c => c[0] === 'deviceDestroy').length, 0);
    assert.ok(f.buffers.every(b => b.destroyed <= 1)); assert.ok(f.textures.every(t => t.destroyed <= 1));
  });
});
