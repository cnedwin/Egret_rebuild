// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// Literal pixels, crops and seconds come from the existing public contracts,
// independently of the proposed clock-driven playback implementation.
const RED = Object.freeze({ x: 0, y: 0, width: 2, height: 2 });
const GREEN = Object.freeze({ x: 2, y: 0, width: 1, height: 2 });
const ATLAS = Object.freeze([
  255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255,
  0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255,
  255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255,
  0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255,
]);

test('SQP00 genuine sequence/clock baseline precedes the named playback factory', async t => {
  const port = host();
  const diagnostics = [];
  const engine = await egret.createEngine({
    host: port.adapter,
    onDiagnostic(diagnostic) { diagnostics.push(diagnostic); },
  });
  let loads = 0, disposals = 0;
  let scope, texture, lease, bitmap, player, subscription;
  let primaryFailure;
  try {
    scope = engine.createScope();
    const image = egret.createImageData2D({ width: 6, height: 2, pixels: new Uint8Array(ATLAS) });
    texture = egret.createTexture(image);
    const type = egret.createAssetType('sequence-playback-baseline-texture', egret.isTexture);
    engine.assets.register(type, {
      async load() { loads++; return texture; },
      dispose(value) { disposals++; value.dispose(); },
    });
    lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, 'sequence-playback-baseline-atlas')));
    bitmap = scope.use(new egret.Bitmap(lease));
    engine.stage.addChild(bitmap);
    const clip = egret.createSequenceClip({
      atlasWidth: 6, atlasHeight: 2,
      frames: [
        { ...RED, durationSeconds: 0.125 },
        { ...GREEN, durationSeconds: 0.25 },
        { x: 3, y: 0, width: 3, height: 1, durationSeconds: 0.125 },
      ],
    });
    player = scope.use(new egret.SequencePlayer(bitmap, clip));
    assert.equal(scope.state, 'open');
    assert.equal(clip.frameCount, 3);
    assert.equal(clip.durationSeconds, 0.5);
    assert.deepEqual(player.applyAt(0), {
      frameIndex: 0, region: RED, positionSeconds: 0, atEnd: false, stopped: false,
    }, 'SEQ_PLAYBACK_BASELINE_RED_FRAME');
    const sample = player.applyAt(0.125);
    assert.deepEqual(sample, {
      frameIndex: 1, region: GREEN, positionSeconds: 0.125, atEnd: false, stopped: false,
    }, 'SEQ_PLAYBACK_BASELINE_GREEN_FRAME');
    assert.equal(player.lastSample, sample);
    assert.ok(Object.isFrozen(sample) && Object.isFrozen(sample.region));

    const ticks = [];
    subscription = engine.clock.onTick(scope, tick => { ticks.push(tick); return undefined; });
    assert.equal(engine.advanceTime(10), undefined);
    assert.deepEqual(ticks, []);
    const tick = engine.advanceTime(10.125);
    assert.deepEqual(tick, { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
    assert.equal(ticks.length, 1);
    assert.equal(ticks[0], tick);
    assert.ok(Object.isFrozen(tick));

    const frame = engine.captureFrame({ width: 8, height: 4, clearColor: 0, clearAlpha: 0 });
    assert.equal(frame.commands.length, 1);
    assert.equal(frame.commands[0].kind, 'image');
    assert.equal(frame.commands[0].imageIndex, 0);
    assert.deepEqual(frame.commands[0].sourceRect, GREEN);
    assert.deepEqual(frame.commands[0].rect, { x: 0, y: 0, width: 1, height: 2 });
    assert.equal(frame.images.length, 1);
    assert.equal(frame.images[0], image);
    assert.deepEqual([...egret.copyImageData2DPixels(frame.images[0])], ATLAS);
    assert.equal(bitmap.textureLease, lease);
    assert.equal(lease.value, texture);
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [1, 2]);
    assert.deepEqual([loads, disposals, port.timers.size], [1, 0, 0]);
    assert.deepEqual(port.trace, ['start']);
    assert.deepEqual(diagnostics, []);

    // Inspect only the missing named capability after every genuine prerequisite.
    console.log('SEQ_PLAYBACK_GENUINE_BASELINE_COMPLETE');
    assert.equal(typeof engine.createSequencePlayback, 'function', 'SEQUENCE_PLAYBACK_FACTORY_REQUIRED');
  } catch (cause) {
    primaryFailure = { cause };
  } finally {
    try {
      await engine.dispose();
      assert.deepEqual(port.trace, ['start', 'stop', 'close']);
      assert.equal(port.timers.size, 0);
      assert.deepEqual(diagnostics, []);
      assert.deepEqual([loads, disposals], [1, 1]);
      assert.equal(scope.state, 'closed');
      assert.equal(subscription.isDisposed, true);
      assert.equal(player.isDisposed, true);
      assert.equal(bitmap.textureLease, undefined);
      assert.equal(texture.isDisposed, true);
      assert.throws(() => lease.value, { code: 'ASSET_LEASE_RELEASED' });
      console.log('SEQ_PLAYBACK_GENUINE_TEARDOWN_COMPLETE');
    } catch (cause) {
      if (primaryFailure === undefined) throw cause;
      // Keep the original refusal; this explicit cleanup-failure marker makes
      // a later saved-result reviewer reject the run as a qualified named RED.
      t.diagnostic('SEQ_PLAYBACK_TEARDOWN_FAILED');
      console.error(cause);
    }
  }
  if (primaryFailure !== undefined) throw primaryFailure.cause;
});
