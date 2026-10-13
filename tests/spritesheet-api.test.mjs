// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// Original SS1 pixels and literal crops are independent of the missing factory.
// The bottom blue columns are transparent, unlike the older sequence fixture.
const PIXELS = Object.freeze([
  255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255,
  0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255,
  255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);
const RED = Object.freeze({ x: 0, y: 0, width: 2, height: 2 });
const GREEN = Object.freeze({ x: 2, y: 0, width: 1, height: 2 });
const FRAME = Object.freeze({ width: 8, height: 4, clearColor: 0, clearAlpha: 0 });

test('SS01 genuine atlas, sequence and clock cleanup precede the named SpriteSheet factory', async t => {
  const port = host();
  const diagnostics = [];
  const engine = await egret.createEngine({
    host: port.adapter,
    clock: { maxDeltaSeconds: 0.5 },
    onDiagnostic(diagnostic) { diagnostics.push(diagnostic); },
  });
  let resources, playbackScope, texture, lease, bitmap, player, playback, subscription;
  let loads = 0, disposals = 0;
  let baselineFailure;
  try {
    resources = engine.createScope();
    playbackScope = engine.createScope();
    const image = egret.createImageData2D({ width: 6, height: 2, pixels: new Uint8Array(PIXELS) });
    texture = egret.createTexture(image);
    const type = egret.createAssetType('spritesheet-api-baseline-texture', egret.isTexture);
    engine.assets.register(type, {
      async load() { loads++; return texture; },
      dispose(value) { disposals++; value.dispose(); },
    });
    lease = resources.use(await engine.assets.acquire(egret.createAssetRef(type, 'spritesheet-api-baseline-atlas')));
    bitmap = resources.use(new egret.Bitmap(lease));
    engine.stage.addChild(bitmap);
    const clip = egret.createSequenceClip({
      atlasWidth: 6, atlasHeight: 2,
      frames: [
        { ...RED, durationSeconds: 0.125 },
        { ...GREEN, durationSeconds: 0.25 },
        { x: 3, y: 0, width: 3, height: 1, durationSeconds: 0.125 },
      ],
    });
    player = resources.use(new egret.SequencePlayer(bitmap, clip));
    assert.deepEqual(player.applyAt(0), {
      frameIndex: 0, region: RED, positionSeconds: 0, atEnd: false, stopped: false,
    });
    const manualSample = player.applyAt(0.125);
    assert.deepEqual(manualSample, {
      frameIndex: 1, region: GREEN, positionSeconds: 0.125, atEnd: false, stopped: false,
    });
    assert.equal(player.lastSample, manualSample);
    assert.ok(Object.isFrozen(manualSample) && Object.isFrozen(manualSample.region));
    const manualFrame = engine.captureFrame(FRAME);
    assert.equal(manualFrame.commands.length, 1);
    assert.equal(manualFrame.commands[0].kind, 'image');
    assert.deepEqual(manualFrame.commands[0].sourceRect, GREEN);
    assert.equal(manualFrame.images[0], image);

    // Retire the explicit player before the genuine Engine-clock controller uses
    // the same Bitmap. Neither this baseline nor capture supplies a second clock.
    player.dispose();
    assert.equal(player.isDisposed, true);
    const ticks = [];
    subscription = engine.clock.onTick(playbackScope, tick => { ticks.push(tick); return undefined; });
    assert.equal(engine.advanceTime(0), undefined);
    assert.deepEqual(ticks, []);
    playback = engine.createSequencePlayback(playbackScope, bitmap, clip, { mode: 'once' });
    playback.start();
    assert.equal(playback.state, 'running');
    assert.deepEqual(playback.lastSample, {
      frameIndex: 0, region: RED, positionSeconds: 0, atEnd: false, stopped: false,
    });
    const redFrame = engine.captureFrame(FRAME);
    assert.deepEqual(redFrame.commands[0].sourceRect, RED);
    assert.equal(redFrame.images[0], image);
    assert.equal(playback.elapsedSeconds, 0);
    assert.deepEqual(ticks, []);

    // These are absolute source seconds: initial zero anchors without a tick,
    // then 0.125 advances one literal delta and selects the original green crop.
    const tick = engine.advanceTime(0.125);
    assert.deepEqual(tick, { tickId: 1, elapsedSeconds: 0.125, deltaSeconds: 0.125 });
    assert.equal(ticks.length, 1);
    assert.equal(ticks[0], tick);
    assert.ok(Object.isFrozen(tick));
    const selected = playback.lastSample;
    assert.deepEqual(selected, {
      frameIndex: 1, region: GREEN, positionSeconds: 0.125, atEnd: false, stopped: false,
    });
    assert.ok(Object.isFrozen(selected) && Object.isFrozen(selected.region));
    assert.equal(playback.elapsedSeconds, 0.125);
    const frame = engine.captureFrame(FRAME);
    assert.equal(frame.commands.length, 1);
    assert.equal(frame.commands[0].kind, 'image');
    assert.equal(frame.commands[0].imageIndex, 0);
    assert.deepEqual(frame.commands[0].sourceRect, GREEN);
    assert.deepEqual(frame.commands[0].rect, { x: 0, y: 0, width: 1, height: 2 });
    assert.equal(frame.images.length, 1);
    assert.equal(frame.images[0], image);
    assert.deepEqual([...egret.copyImageData2DPixels(frame.images[0])], PIXELS);
    assert.equal(playback.lastSample, selected, 'SPRITE_SHEET_BASELINE_CAPTURE_IS_INERT');
    assert.equal(bitmap.textureLease, lease);
    assert.equal(lease.value, texture);
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [1, 2]);
    assert.deepEqual([clip.frameCount, clip.durationSeconds], [3, 0.5]);
    assert.deepEqual([resources.state, playbackScope.state], ['open', 'open']);
    assert.deepEqual([loads, disposals, port.timers.size], [1, 0, 0]);
    assert.deepEqual(port.trace, ['start']);
    assert.deepEqual(diagnostics, []);
  } catch (cause) {
    // Preserve even an undefined thrown occurrence without substituting a RED.
    baselineFailure = { cause };
  } finally {
    try {
      await engine.dispose();
      // Before its first provider return, a Texture is still caller-owned.
      if (texture !== undefined && loads === 0 && !texture.isDisposed) texture.dispose();
      assert.deepEqual(port.trace, ['start', 'stop', 'close']);
      assert.equal(port.timers.size, 0);
      assert.deepEqual(diagnostics, []);
      assert.deepEqual([loads, disposals], [1, 1]);
      assert.equal(engine.clock.state, 'closed');
      assert.equal(engine.stage.isDisposed, true);
      assert.equal(engine.stage.numChildren, 0);
      if (resources !== undefined) assert.equal(resources.state, 'closed');
      if (playbackScope !== undefined) assert.equal(playbackScope.state, 'closed');
      if (subscription !== undefined) assert.equal(subscription.isDisposed, true);
      if (player !== undefined) assert.equal(player.isDisposed, true);
      if (playback !== undefined) {
        assert.equal(playback.state, 'stopped');
        assert.equal(playback.isDisposed, true);
      }
      if (bitmap !== undefined) {
        assert.equal(bitmap.isDisposed, true);
        assert.equal(bitmap.parent, undefined);
        assert.equal(bitmap.textureLease, undefined);
      }
      if (texture !== undefined) assert.equal(texture.isDisposed, true);
      if (lease !== undefined) assert.throws(() => lease.value, { code: 'ASSET_LEASE_RELEASED' });
    } catch (cause) {
      // A cleanup error prevents the completion marker and remains independently
      // visible alongside any earlier baseline error; it cannot become API RED.
      t.diagnostic('SPRITE_SHEET_BASELINE_CLEANUP_FAILED');
      if (baselineFailure !== undefined) {
        throw new AggregateError([baselineFailure.cause, cause], 'SPRITE_SHEET_BASELINE_AND_CLEANUP_FAILED');
      }
      throw cause;
    }
  }
  if (baselineFailure !== undefined) throw baselineFailure.cause;
  console.log('SPRITE_SHEET_BASELINE_COMPLETE');
  assert.equal(typeof egret.createSpriteSheet, 'function', 'SPRITE_SHEET_FACTORY_REQUIRED');
});
