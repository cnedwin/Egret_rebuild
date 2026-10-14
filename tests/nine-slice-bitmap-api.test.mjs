// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// Complete genuine old-public composition and cleanup before the assigned RED.
test('NLB00 genuine leased NS1 baseline precedes the named missing leaf export', async () => {
  const port = host(), engine = await egret.createEngine({ host: port.adapter });
  let scope, lease, texture, mesh, loads = 0, disposals = 0;
  try {
    scope = engine.createScope();
    const image = egret.createImageData2D({ width: 8, height: 8, pixels: new Uint8Array(256).fill(255) });
    texture = egret.createTexture(image);
    const type = egret.createAssetType('nlb-old-baseline', egret.isTexture);
    engine.assets.register(type, { async load() { loads++; return texture; }, dispose(value) { disposals++; value.dispose(); } });
    lease = await engine.assets.acquire(egret.createAssetRef(type, 'panel'));
    scope.use(lease);
    const geometry = egret.createNineSliceGeometry2D({ sourceWidth: 8, sourceHeight: 8, targetWidth: 16, targetHeight: 12,
      insets: { left: 2, top: 2, right: 2, bottom: 2 } });
    mesh = new egret.Mesh2D(lease, geometry);
    scope.use(mesh); engine.stage.addChild(mesh);
    const frame = engine.captureTexturedFrame({ width: 20, height: 20 });
    assert.equal(frame.profile, egret.TEXTURED_FRAME_PROFILE_2D);
    assert.deepEqual(frame.commands.map(value => value.kind), ['mesh']);
    assert.equal(frame.geometries[0], geometry);
    assert.deepEqual(mesh.getBounds(), { x: 0, y: 0, width: 16, height: 12 });
    assert.equal(lease.value, texture);
  } finally {
    scope?.dispose(); mesh?.dispose(); lease?.release();
    await engine.dispose();
    const managedDisposed = texture?.isDisposed;
    texture?.dispose();
    assert.equal(loads, 1); assert.equal(disposals, 1); assert.equal(managedDisposed, true);
    assert.equal(scope.state, 'closed'); assert.equal(engine.stage.isDisposed, true);
    assert.equal(port.timers.size, 0);
    assert.equal(port.trace.filter(value => value === 'close').length, 1);
  }
  assert.equal(typeof egret.NineSliceBitmap, 'function', 'NINE_SLICE_BITMAP_MISSING_PUBLIC_CLASS');
  assert.equal('NineSliceBitmapOptions' in egret, false, 'options are erased');
});
