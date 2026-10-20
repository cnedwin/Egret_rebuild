// SPDX-License-Identifier: Apache-2.0
// GPU portions only. Structural devices intentionally never prove opt-in native
// recovery. Positive native recovery is verified separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as gpu from '@egret/engine/webgpu';
import * as sceneGpu from '@egret/engine/webgpu/scene3d';
import * as canvas from '@egret/engine/web';
import {
  usingGpu, requireUpload, requireSession, observe, until, tick, turn,
  hasCode, expectCode, capture, admitted, submit, readyUpload, egret, triangleScene,
} from './fixtures/shared-frame-upload-gpu.mjs';

test('GPU H00 existing shared status and ordinary readback remain genuine baseline', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    assert.deepEqual(Object.keys(h.getSharedStatus()).sort(),
      ['host', 'pendingCanonicalBytes', 'pendingColorBytes', 'pendingGeometryBytes', 'resources']);
    const read = h.requestReadback(); read.catch(() => {});
    await submit(f, h, frame);
    assert.deepEqual([(await read).width, (await read).height, (await read).bytes.byteLength], [8, 8, 256]);
  }, { options: { enableReadback: true } });
});

test('GPU H01 initial session barriers and immutable metadata preserve lifecycle', async () => {
  await usingGpu(async ({ f, h }) => {
    requireSession(h);
    const fresh = f.sharedHost(); requireSession(fresh);
    assert.deepEqual(fresh.getSessionStatus(), { state: 'new', generation: 0, attempt: 0,
      firstFailure: null, generationFailure: null });
    assert.ok(Object.isFrozen(fresh.getSessionStatus()));
    await assert.rejects(fresh.whenReady(), hasCode('NOT_STARTED'));
    const start = fresh.start(), ready = fresh.whenReady();
    assert.equal(ready, start); assert.equal(fresh.start(), start);
    assert.equal(fresh.getSessionStatus().state, 'starting');
    await f.pump(); await start;
    const status = fresh.getSessionStatus();
    assert.deepEqual(status, { state: 'ready', generation: 1, attempt: 0,
      firstFailure: null, generationFailure: null });
    assert.equal(fresh.whenReady(), ready); assert.equal(fresh.getStatus().state, 'active');
    fresh.stop(); fresh.stop();
    assert.equal(fresh.getSessionStatus().state, 'stopped');
    assert.equal(fresh.getSessionStatus().generation, 1);
    await assert.rejects(fresh.whenReady(), hasCode('STOPPED'));
    await assert.rejects(fresh.start(), hasCode('STOPPED'));
    const closing = fresh.close(), watched = observe(closing);
    assert.ok(['closing', 'closed'].includes(fresh.getSessionStatus().state));
    await until(f, () => watched.settled); await closing;
    assert.equal(fresh.getSessionStatus().state, 'closed');
    await assert.rejects(fresh.whenReady(), hasCode('CLOSED'));
  });
});

test('GPU H02 stopped initial startup still owns its original unsettled pipeline', async () => {
  await usingGpu(async ({ f, h }) => {
    requireSession(h);
    const fresh = f.sharedHost(); requireSession(fresh);
    const offset = f.pipelines.length, start = fresh.start(), watched = observe(start);
    await until(f, () => f.pipelines.length > offset, { settle: false });
    fresh.stop();
    assert.equal(fresh.getSessionStatus().state, 'stopped');
    assert.equal(watched.settled, false, 'stop does not replace the initial operation with prompt recovery cancellation');
    await assert.rejects(fresh.whenReady(), hasCode('STOPPED'));
    await until(f, () => watched.settled);
    assert.equal(watched.rejected, true); assert.ok(hasCode('START_CANCELLED')(watched.error));
    assert.equal(fresh.getSessionStatus().state, 'stopped');
    assert.equal(f.calls.filter(c => c[0] === 'deviceDestroy').length, 0);
  });
});

test('GPU H03 omitted recovery refuses without a new device or state change', async () => {
  await usingGpu(async ({ f, h }) => {
    requireSession(h); const before = h.getSessionStatus(), calls = f.calls.length;
    await assert.rejects(h.recover(), hasCode('RECOVERY_DISABLED'));
    await assert.rejects(h.recover(f.device), hasCode('RECOVERY_DISABLED'));
    assert.deepEqual(h.getSessionStatus(), before); assert.equal(f.calls.length, calls);
  });
});

test('GPU H04 automatic recovery plus borrow and invalid recovery scalars refuse before startup', async () => {
  await usingGpu(async ({ f, h }) => {
    requireSession(h);
    for (const recovery of [{ mode: 'automatic' }, { mode: 'manual', timeoutMs: 0 },
      { mode: 'manual', timeoutMs: 30001 }, { mode: 'manual', timeoutMs: 1.5 }, { mode: 'other' }]) {
      const calls = f.calls.length;
      expectCode(() => f.sharedHost({ recovery }), 'OPTIONS_INVALID');
      assert.equal(f.calls.length, calls);
    }
  });
});

test('GPU H05 a structural device cannot establish even an initial opt-in generation', async () => {
  await usingGpu(async ({ f, h }) => {
    requireSession(h);
    const before = f.pipelines.length, opted = f.sharedHost({ recovery: { mode: 'manual' } });
    const start = opted.start(), watched = observe(start);
    await until(f, () => watched.settled);
    assert.equal(watched.rejected, true); assert.ok(watched.error instanceof egret.EgretError);
    assert.equal(opted.getSessionStatus().state, 'failed');
    assert.equal(opted.getSessionStatus().generation, 0);
    assert.equal(f.pipelines.length, before, 'no reconstruction can follow fake native authentication');
    assert.equal(f.calls.filter(c => c[0] === 'deviceDestroy').length, 0);
  });
});

test('GPU H06 omitted recovery retains legacy terminal loss and unsafe close', async () => {
  for (const rejected of [false, true]) await usingGpu(async ({ f, h, frame }) => {
    requireSession(h); const cause = Object.freeze({ legacy: rejected ? 'observer-reject' : 'fulfilled' });
    const idleBefore = h.whenIdle(); await idleBefore;
    const record = capture(f, () => h.renderSharedFrame(frame)); admitted(record);
    const idleDuring = observe(h.whenIdle());
    if (rejected) f.lost.reject(cause); else f.lost.resolve(cause);
    await tick();
    assert.equal(h.getSessionStatus().state, 'failed'); assert.equal(h.getStatus().state, 'failed');
    assert.equal(h.getStatus().firstFailure.cause, cause);
    f.allowUnsafe(h);
    await record.finish(); await until(f, () => idleDuring.settled);
    assert.equal(idleDuring.rejected, true); await idleBefore;
    await f.close(h, true, cause);
    assert.equal(h.getStatus().cleanupOutcome, 'unsafe');
    assert.equal(f.calls.filter(c => c[0] === 'deviceDestroy').length, 0);
  });
});

test('GPU H07 stop revokes a ready-held stage before listener cleanup reentry', async () => {
  await usingGpu(async ({ f, h, frame }) => {
    requireSession(h); requireUpload(h);
    let listener, removed = 0, nested;
    const signal = { aborted: false, reason: undefined,
      addEventListener(_type, fn) { listener = fn; },
      removeEventListener(_type, fn) {
        assert.equal(fn, listener); removed++;
        try { stage.submit(); } catch (error) { nested = error; }
      },
    };
    const stage = h.stageSharedFrame(frame, { signal }); await readyUpload(f, stage);
    h.stop();
    assert.equal(h.getSessionStatus().state, 'stopped'); assert.equal(removed, 1);
    assert.ok(hasCode('STOPPED')(nested)); expectCode(() => stage.submit(), 'STOPPED');
    await until(f, () => h.getStatus().pendingFrames === 0);
    await assert.rejects(h.whenReady(), hasCode('STOPPED'));
  });
});

test('GPU H08 generation is shared-only; legacy readback runtime keys remain unchanged', async () => {
  await usingGpu(async ({ f, a, h, frame }) => {
    requireSession(h);
    const shared = h.requestReadback(); shared.catch(() => {}); await submit(f, h, frame);
    const sharedValue = await shared;
    assert.equal(sharedValue.generation, h.getSessionStatus().generation);
    const originalKeys = ['alphaMode', 'bytes', 'colorSpace', 'format', 'frameId', 'height', 'serial', 'sourceFormat', 'width'];
    assert.deepEqual(Object.keys(sharedValue).sort(), [...originalKeys, 'generation'].sort());
    for (const kind of ['ordinary', 'textured', 'scene', 'combined']) {
      const legacy = f.host({ enableReadback: true }, kind); await f.ready(legacy);
      for (const key of ['getSessionStatus', 'whenReady', 'recover', 'stageSharedFrame', 'stageSceneSharedFrame'])
        assert.equal(key in legacy, false, 'legacy ' + kind + ' must not gain ' + key);
      const read = legacy.requestReadback(); read.catch(() => {});
      const ordinary = a.engine.captureFrame({ width: 8, height: 8, clearAlpha: 1 });
      const textured = a.engine.captureTexturedFrame({ width: 8, height: 8, clearAlpha: 1 });
      const scene = triangleScene();
      const record = capture(f, () => kind === 'combined' ? legacy.renderSceneTexturedFrame(scene, textured)
        : kind === 'scene' ? legacy.renderSceneFrame(scene, ordinary)
        : kind === 'textured' ? legacy.renderTexturedFrame(textured) : legacy.renderFrame(ordinary));
      admitted(record); await record.finish();
      const value = await read; assert.deepEqual(Object.keys(value).sort(), originalKeys);
      assert.equal('generation' in value, false); await legacy.whenIdle();
    }
    for (const entry of [egret, canvas, gpu, sceneGpu])
      for (const name of ['SharedDeviceSessionState', 'SharedDeviceSessionStatus', 'SharedFrameUploadOptions',
        'SharedFrameUploadReady', 'SharedFrameSubmission', 'SharedFrameUpload'])
        assert.equal(Object.hasOwn(entry, name), false, name + ' remains erased');
  }, { options: { enableReadback: true } });
});
