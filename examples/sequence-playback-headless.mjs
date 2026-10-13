// SPDX-License-Identifier: Apache-2.0
// A public-entry CPU scene example; captured frames do not prove GPU rendering.
import assert from 'node:assert/strict';
import {
  Bitmap, createAssetRef, createAssetType, createEngine, createImageData2D,
  createSequenceClip, createTexture, isTexture,
} from '@egret/engine';

const pixels = new Uint8Array([
  255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255,
  0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255,
  255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255,
  0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255,
]);
const diagnostics = [];
const host = {
  surface: {},
  async close() {},
  setTimeout(callback, delayMs) {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};
let loads = 0, disposals = 0;
const engine = await createEngine({ host, onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
const observations = [];
let playback, lease;
try {
  const scope = engine.createScope();
  const image = createImageData2D({ width: 6, height: 2, pixels });
  const texture = createTexture(image);
  const atlasType = createAssetType('example-sequence-atlas', isTexture);
  engine.assets.register(atlasType, {
    async load() { loads++; return texture; },
    dispose(value) { disposals++; value.dispose(); },
  });
  // Reverse Scope cleanup stops playback before releasing the Bitmap and lease.
  lease = scope.use(await engine.assets.acquire(createAssetRef(atlasType, 'original-colour-atlas')));
  const bitmap = scope.use(new Bitmap(lease));
  engine.stage.addChild(bitmap);
  const clip = createSequenceClip({
    atlasWidth: 6, atlasHeight: 2,
    frames: [
      { x: 0, y: 0, width: 2, height: 2, durationSeconds: 0.125 },
      { x: 2, y: 0, width: 1, height: 2, durationSeconds: 0.25 },
      { x: 3, y: 0, width: 3, height: 1, durationSeconds: 0.125 },
    ],
  });
  // Creation is inert; start applies the first frame using the existing lease.
  playback = engine.createSequencePlayback(scope, bitmap, clip);
  playback.start();
  engine.advanceTime(10);
  function capture(label) {
    const frame = engine.captureFrame({ width: 8, height: 4, clearColor: 0, clearAlpha: 0 });
    observations.push({
      label, state: playback.state, elapsedSeconds: playback.elapsedSeconds,
      sample: playback.lastSample, frameId: frame.frameId,
      crop: frame.commands[0].sourceRect,
    });
  }
  capture('started-red');
  engine.advanceTime(10.125);
  capture('green');
  playback.pause();
  engine.advanceTime(10.375);
  capture('paused-green');
  // Resume anchors the held time to the current clock, excluding the pause gap.
  playback.resume();
  engine.advanceTime(10.625);
  capture('resumed-blue');
  engine.advanceTime(10.75);
  capture('completed-blue');
  assert.equal(playback.state, 'completed');
  assert.equal(playback.elapsedSeconds, 0.5);
  assert.equal(playback.isDisposed, true);
  assert.equal(lease.value, texture);
  assert.deepEqual(diagnostics, []);
} finally {
  await engine.dispose();
}
assert.equal(loads, 1);
assert.equal(disposals, 1);
assert.deepEqual(diagnostics, []);
console.log(JSON.stringify({
  scope: 'CPU-only explicit-clock sequence playback',
  observations, loads, disposals,
  finalState: playback.state, retainedSample: playback.lastSample,
}, null, 2));
