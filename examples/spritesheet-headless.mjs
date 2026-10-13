// SPDX-License-Identifier: Apache-2.0
// This recording host demonstrates public composition; it does not draw pixels.
import assert from 'node:assert/strict';
import {
  createAssetRef, createAssetType, createEngine, createImageData2D,
  createSequenceClip, createSpriteSheet, createTexture, isTexture,
} from '@egret/engine';

const pixels = new Uint8Array([
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,255,255, 0,0,255,255,
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,0,0, 0,0,0,0, 0,0,0,0,
]);
const input = [
  { name: 'red', x: 0, y: 0, width: 2, height: 2 },
  { name: 'green', x: 2, y: 0, width: 1, height: 2 },
  { name: 'blue', x: 3, y: 0, width: 3, height: 1 },
  { name: '__proto__', x: 3, y: 0, width: 3, height: 1 },
];
const trace = [], timers = new Set(), recorded = [], diagnostics = [], ticks = [];
const host = {
  surface: {},
  start() { trace.push('start'); },
  stop() { trace.push('stop'); },
  async close() { trace.push('close'); },
  renderFrame(frame) { recorded.push(frame); },
  setTimeout(callback, delayMs) {
    const timer = setTimeout(callback, delayMs);
    timers.add(timer);
    return () => { clearTimeout(timer); timers.delete(timer); };
  },
};
const engine = await createEngine({
  host, clock: { maxDeltaSeconds: 0.5 },
  onDiagnostic(value) { diagnostics.push(value); },
});
let loads = 0, disposals = 0, sheet, lease, actor, icon, once, loop;
const observations = [];
try {
  const resources = engine.createScope(), animation = engine.createScope();
  const image = createImageData2D({ width: 6, height: 2, pixels });
  const texture = createTexture(image);
  const type = createAssetType('example-spritesheet-texture', isTexture);
  engine.assets.register(type, {
    async load() { loads++; return texture; },
    dispose(value) { disposals++; value.dispose(); },
  });
  lease = resources.use(await engine.assets.acquire(createAssetRef(type, 'original-colour-atlas')));
  sheet = resources.use(createSpriteSheet(lease, input));
  // The sheet borrows this exact lease. The caller owns each returned Bitmap.
  actor = resources.use(sheet.createBitmap('red'));
  icon = resources.use(sheet.createBitmap('__proto__'));
  actor.x = 1; actor.y = 1;
  icon.x = 4; icon.y = 1;
  engine.stage.addChild(actor);
  engine.stage.addChild(icon);
  const clip = createSequenceClip({
    atlasWidth: sheet.atlasWidth, atlasHeight: sheet.atlasHeight,
    frames: ['red', 'green', 'blue'].map((name, index) => ({
      ...sheet.getRegion(name), durationSeconds: [0.125, 0.25, 0.125][index],
    })),
  });
  engine.clock.onTick(animation, tick => { ticks.push(tick); });
  // Source times below are absolute seconds. Zero seeds the clock without a tick.
  engine.advanceTime(0);
  assert.equal(ticks.length, 0);
  once = engine.createSequencePlayback(animation, actor, clip, { mode: 'once' });
  once.start();
  function record(label, playback) {
    const frame = engine.renderFrame({ width: 8, height: 4, clearColor: 0, clearAlpha: 0 });
    assert.equal(frame.commands.length, 2);
    assert.equal(frame.images.length, 1);
    assert.equal(frame.images[0], image);
    assert.equal(actor.textureLease, lease);
    assert.equal(icon.textureLease, lease);
    assert.deepEqual(frame.commands[1].sourceRect, { x: 3, y: 0, width: 3, height: 1 });
    observations.push({
      label, state: playback.state, elapsedSeconds: playback.elapsedSeconds,
      sample: playback.lastSample, frameId: frame.frameId,
      actorCrop: frame.commands[0].sourceRect, iconCrop: frame.commands[1].sourceRect,
    });
    return frame;
  }
  record('initial-red', once);
  engine.advanceTime(0.125);
  record('once-green', once);
  // Closing the sheet revokes new Bitmap creation; existing objects retain their lease.
  sheet.dispose();
  assert.equal(sheet.isDisposed, true);
  assert.deepEqual(sheet.names, ['red', 'green', 'blue', '__proto__']);
  engine.advanceTime(0.375);
  record('disposed-sheet-once-blue', once);
  engine.advanceTime(0.5);
  record('completed-once-blue', once);
  assert.equal(once.state, 'completed');
  loop = engine.createSequencePlayback(animation, actor, clip, { mode: 'loop' });
  loop.start();
  record('loop-red', loop);
  loop.pause();
  engine.advanceTime(1);
  record('paused-red', loop);
  loop.resume();
  engine.advanceTime(1.125);
  record('resumed-green', loop);
  engine.advanceTime(1.5);
  record('loop-boundary-red', loop);
  assert.equal(ticks.length, 6);
  assert.equal(recorded.length, 8);
  assert.deepEqual(diagnostics, []);
} finally {
  await engine.dispose();
}
assert.deepEqual(trace, ['start', 'stop', 'close']);
assert.equal(timers.size, 0);
assert.equal(loads, 1);
assert.equal(disposals, 1);
assert.equal(engine.clock.state, 'closed');
assert.equal(sheet.isDisposed, true);
assert.equal(actor.isDisposed, true);
assert.equal(icon.isDisposed, true);
assert.equal(loop.isDisposed, true);
assert.throws(() => lease.value, { code: 'ASSET_LEASE_RELEASED' });
assert.deepEqual(diagnostics, []);
console.log(JSON.stringify({
  status: 'SPRITESHEET_HEADLESS_COMPLETE',
  scope: 'Public SpriteSheet composition with a CPU recording host',
  observations, ticks, loads, disposals, hostTrace: trace,
  finalClockState: engine.clock.state, sheetNames: sheet.names,
}, null, 2));
