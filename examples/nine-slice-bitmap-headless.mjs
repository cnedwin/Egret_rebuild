// SPDX-License-Identifier: Apache-2.0
// A public composition example with a recording host, not a browser pixel test.
import assert from 'node:assert/strict';
import {
  NineSliceBitmap, TEXTURED_FRAME_PROFILE_2D, createAssetRef, createAssetType,
  createEngineForProfile, createImageData2D, createTexture, isTexture,
} from '@egret/engine';

const recorded = [], timers = new Set(), trace = [], diagnostics = [];
const host = {
  surface: {},
  texturedFrameProfile: TEXTURED_FRAME_PROFILE_2D,
  start() { trace.push('start'); },
  stop() { trace.push('stop'); },
  async close() { trace.push('close'); },
  renderFrame(frame) { recorded.push(frame); },
  renderTexturedFrame(frame) { recorded.push(frame); },
  setTimeout(callback, delayMs) {
    const timer = setTimeout(callback, delayMs); timers.add(timer);
    return () => { clearTimeout(timer); timers.delete(timer); };
  },
};
const engine = await createEngineForProfile({
  host, onDiagnostic(value) { diagnostics.push(value); },
}, TEXTURED_FRAME_PROFILE_2D);
let resources, texture, lease, panel, loads = 0, disposals = 0;
let primary, hasPrimary = false, managedDisposed = false;
try {
  resources = engine.createScope();
  texture = createTexture(createImageData2D({
    width: 8, height: 8, pixels: new Uint8Array(256).fill(255),
  }));
  const type = createAssetType('example-panel-texture', isTexture);
  engine.assets.register(type, {
    async load() { loads++; return texture; },
    dispose(value) { disposals++; value.dispose(); },
  });
  // Save each genuine handle before registration; a failed Scope.use cannot hide it.
  lease = await engine.assets.acquire(createAssetRef(type, 'panel'));
  resources.use(lease);
  panel = new NineSliceBitmap(lease, {
    width: 16, height: 12, insets: { left: 2, top: 2, right: 2, bottom: 2 },
  });
  // Reverse Scope cleanup retires the display leaf before the caller's borrow.
  resources.use(panel);
  engine.stage.addChild(panel);
  const saved = engine.renderTexturedFrame({ width: 20, height: 20 });
  const oldGeometry = saved.geometries[0];
  panel.resize(12, 16);
  const resized = engine.renderTexturedFrame({ width: 20, height: 20 });
  assert.deepEqual(panel.getBounds(), { x: 0, y: 0, width: 12, height: 16 });
  assert.notEqual(resized.geometries[0], oldGeometry);
  assert.equal(saved.geometries[0], oldGeometry);
  assert.deepEqual(oldGeometry.positions.slice(-8), [0,12,2,12,14,12,16,12]);
  assert.equal(panel.textureLease, lease);
  assert.equal(loads, 1); assert.equal(disposals, 0);
} catch (cause) {
  hasPrimary = true; primary = cause;
} finally {
  // Attempt every caller-owned cleanup independently, preserving even undefined causes.
  const cleanup = [];
  const attempt = action => { try { action(); } catch (cause) { cleanup.push(cause); } };
  attempt(() => resources?.dispose());
  attempt(() => panel?.dispose());
  attempt(() => lease?.release());
  try { await engine.dispose(); } catch (cause) { cleanup.push(cause); }
  managedDisposed = texture?.isDisposed === true;
  attempt(() => texture?.dispose()); // Covers a Texture not yet managed after setup failure.
  if (hasPrimary && cleanup.length) throw new AggregateError([primary, ...cleanup], 'Panel example and cleanup failed', { cause: primary });
  if (hasPrimary) throw primary;
  if (cleanup.length) throw new AggregateError(cleanup, 'Panel example cleanup failed');
}
assert.equal(recorded.length, 2);
assert.equal(managedDisposed, true); assert.equal(disposals, 1);
assert.equal(panel.textureLease, undefined); assert.equal(resources.state, 'closed');
assert.equal(engine.stage.isDisposed, true); assert.equal(timers.size, 0);
assert.deepEqual(diagnostics, []); assert.deepEqual(trace, ['start','stop','close']);
assert.equal(panel.targetWidth, 12); assert.equal(panel.targetHeight, 16);
console.log(JSON.stringify({
  kind: 'NineSliceBitmap headless composition', sizes: [[16,12],[12,16]],
  recordedFrames: recorded.length, savedFrameGeometryPreserved: true,
  providerLoads: loads, providerDisposals: disposals, pendingTimers: timers.size,
  scopeState: resources.state, nativePixelsVerified: false,
}));
