// SPDX-License-Identifier: Apache-2.0
// Public CPU captures and scene records; native depth/pixels remain separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host as makeHost } from './helpers.mjs';

const FRAME = Object.freeze({ width: 192, height: 128, clearColor: 0, clearAlpha: 1 });
const PIXELS = Object.freeze([255, 0, 0, 255, 0, 255, 0, 255]);
const PROJECTION = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.125, 0, 0, 0, 1.125, 1]);
const application = () => import('../examples/resource-scene/gpu-scene.mjs');

async function fixture(t, textured = true) {
  const diagnostics = [], counts = { loads: 0, disposals: 0 };
  const h = makeHost({ renderFrame() {}, ...(textured ? {
    texturedFrameProfile: egret.TEXTURED_FRAME_PROFILE_2D, renderTexturedFrame() {},
  } : {}) });
  const engine = textured
    ? await egret.createEngineForProfile({ host: h.adapter, onDiagnostic: value => diagnostics.push(value) }, egret.TEXTURED_FRAME_PROFILE_2D)
    : await egret.createEngine({ host: h.adapter, onDiagnostic: value => diagnostics.push(value) });
  let state = 'ready';
  t.after(async () => {
    state = 'closing'; await engine.dispose(); state = 'closed';
    assert.deepEqual(diagnostics, []); assert.equal(counts.disposals, 1);
    assert.equal(h.timers.size, 0);
  });
  const scope = engine.createScope(), inputScope = engine.createScope();
  const image = egret.createImageData2D({ width: 2, height: 1, pixels: new Uint8Array(PIXELS) });
  const texture = egret.createTexture(image), type = egret.createAssetType('resource-scene GPU badge', egret.isTexture);
  engine.assets.register(type, {
    load() { counts.loads += 1; return texture; },
    dispose(value) { counts.disposals += 1; value.dispose(); },
  });
  const lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, 'literal-red-green')));
  const before = scope.use(new egret.Sprite()), ordinary = scope.use(new egret.Bitmap(lease));
  ordinary.x = 8; ordinary.y = 8; ordinary.width = 16; ordinary.height = 8;
  const after = scope.use(new egret.Sprite());
  engine.stage.addChild(before); engine.stage.addChild(ordinary); engine.stage.addChild(after);
  const capture = () => textured ? engine.captureTexturedFrame(FRAME) : engine.captureFrame(FRAME);
  const healthy = capture();
  assert.equal(healthy.commands.length, 1); assert.equal(healthy.commands[0].kind, 'image');
  assert.equal(healthy.images[0], image); assert.equal(lease.value, texture); assert.equal(counts.loads, 1);
  const session = Object.freeze({
    scene: Object.freeze({ engine, inputScope, badgeLease: lease, badge: ordinary }),
    inspect() { return Object.freeze({ state }); },
  });
  return { engine, lease, image, texture, ordinary, before, after, session, counts, capture,
    setState(value) { state = value; },
    async close() { state = 'closing'; await engine.dispose(); state = 'closed'; },
  };
}

test('GPU00 genuine public textured Engine, lease and Mesh capture baseline', async t => {
  const f = await fixture(t);
  const geometry = egret.createTexturedGeometry2D({
    positions: new Float32Array([0, 0, 16, 0, 16, 8, 0, 8]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    lightColors: new Float32Array(16).fill(1), indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  });
  const baseline = f.engine.createScope().use(new egret.Mesh2D(f.lease, geometry));
  f.engine.stage.addChild(baseline);
  const frame = f.capture();
  assert.equal(frame.profile, 'egret.textured-frame2d/1');
  assert.equal(frame.commands[1].kind, 'mesh'); assert.equal(frame.geometries[0], geometry);
  assert.equal(frame.images[frame.commands[1].imageIndex], f.image);
  f.engine.stage.removeChild(baseline); baseline.dispose();
  assert.equal(f.lease.value, f.texture); assert.equal(f.counts.disposals, 0);
});

test('GPU01 composition replaces the ordinary badge at its exact painter index with a genuine borrowed Mesh', async t => {
  const f = await fixture(t), app = await application();
  const publicHost = await import('@egret/engine/webgpu/scene3d');
  assert.equal(app.createTexturedSceneWebGPUHost, publicHost.createTexturedSceneWebGPUHost);
  const view = app.createResourceSceneGPU({ session: f.session });
  assert.equal(Object.isFrozen(view), true);
  assert.deepEqual(Object.keys(view).sort(), ['badge', 'scene', 'sceneWithReversedDrawOrder', 'sceneWithWrongDepth']);
  assert.ok(view.badge instanceof egret.Mesh2D); assert.equal(view.badge.textureLease, f.lease);
  assert.equal(f.ordinary.isDisposed, true); assert.equal(f.ordinary.parent, undefined);
  assert.equal(f.engine.stage.numChildren, 3);
  assert.equal(f.engine.stage.getChildAt(0), f.before);
  assert.equal(f.engine.stage.getChildAt(1), view.badge);
  assert.equal(f.engine.stage.getChildAt(2), f.after);
  assert.equal(f.lease.value, f.texture); assert.equal(f.counts.loads, 1); assert.equal(f.counts.disposals, 0);
  const frame = f.capture(), command = frame.commands[0], geometry = frame.geometries[command.geometryIndex];
  assert.equal(frame.commands.length, 1); assert.equal(command.kind, 'mesh');
  assert.deepEqual(command.matrix, { a: 1, b: 0, c: 0, d: 1, tx: 8, ty: 8 });
  assert.deepEqual(command.sourceRect, { x: 0, y: 0, width: 2, height: 1 });
  assert.equal(frame.images[command.imageIndex], f.image);
  assert.equal(geometry, view.badge.geometry);
  assert.deepEqual(geometry.positions, [0, 0, 16, 0, 16, 8, 0, 8]);
  assert.deepEqual(geometry.uvs, [0, 0, 1, 0, 1, 1, 0, 1]);
  assert.deepEqual(geometry.lightColors, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(geometry.indices, [0, 1, 2, 0, 2, 3]);
});

test('GPU02 authored public scenes retain literal geometry and reverse-depth projection independent of draw order', async t => {
  const f = await fixture(t), app = await application();
  const sceneSDK = await import('@egret/engine/scene3d');
  const view = app.createResourceSceneGPU({ session: f.session });
  for (const scene of [view.scene, view.sceneWithReversedDrawOrder, view.sceneWithWrongDepth]) {
    assert.equal(sceneSDK.isSceneFrame3D(scene), true); assert.equal(Object.isFrozen(scene), true);
    assert.equal(scene.draws.length, 2);
    for (const draw of scene.draws) {
      assert.equal(sceneSDK.isMeshGeometry3D(draw.geometry), true);
      assert.deepEqual(draw.mvp, PROJECTION); assert.equal(Object.isFrozen(draw.mvp), true);
      assert.deepEqual(draw.geometry.indices, [0, 1, 2, 0, 2, 3]);
    }
  }
  const [red, blue] = view.scene.draws;
  assert.deepEqual(red.geometry.positions, [-0.5, 0.5, -3, 0.5, 0.5, -3, 0.5, -0.5, -3, -0.5, -0.5, -3]);
  assert.deepEqual(blue.geometry.positions, [-0.75, 0.75, -7, 0.75, 0.75, -7, 0.75, -0.75, -7, -0.75, -0.75, -7]);
  assert.deepEqual(red.geometry.colors, [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]);
  assert.deepEqual(blue.geometry.colors, [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  assert.equal(red.mvp[10] * -3 + red.mvp[14], 0.75);
  assert.equal(blue.mvp[10] * -7 + blue.mvp[14], 0.25);
  assert.equal(view.sceneWithReversedDrawOrder.draws[0].geometry, blue.geometry);
  assert.equal(view.sceneWithReversedDrawOrder.draws[1].geometry, red.geometry);
});

test('GPU03 wrong-depth control changes genuine XYZ depth while preserving color, extent and projection', async t => {
  const f = await fixture(t), app = await application();
  const view = app.createResourceSceneGPU({ session: f.session });
  const [red, blue] = view.sceneWithWrongDepth.draws;
  assert.deepEqual(red.geometry.positions, [-0.5, 0.5, -7, 0.5, 0.5, -7, 0.5, -0.5, -7, -0.5, -0.5, -7]);
  assert.deepEqual(blue.geometry.positions, [-0.75, 0.75, -3, 0.75, 0.75, -3, 0.75, -0.75, -3, -0.75, -0.75, -3]);
  assert.deepEqual(red.geometry.colors, [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]);
  assert.deepEqual(blue.geometry.colors, [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  assert.deepEqual(red.mvp, PROJECTION); assert.deepEqual(blue.mvp, PROJECTION);
  assert.equal(red.mvp[10] * -7 + red.mvp[14], 0.25);
  assert.equal(blue.mvp[10] * -3 + blue.mvp[14], 0.75);
});

test('GPU04 Engine-owned Mesh retirement releases only the original scope borrow and preserves the saved CPU frame', async t => {
  const f = await fixture(t), app = await application();
  const view = app.createResourceSceneGPU({ session: f.session }), saved = f.capture();
  const geometry = saved.geometries[0], scene = view.scene;
  await f.close();
  assert.equal(view.badge.isDisposed, true); assert.equal(view.badge.textureLease, undefined);
  assert.equal(f.counts.disposals, 1);
  assert.throws(() => f.lease.value, { code: 'ASSET_LEASE_RELEASED' });
  assert.equal(saved.images[0], f.image); assert.equal(saved.geometries[0], geometry);
  assert.deepEqual([...egret.copyImageData2DPixels(saved.images[0])], PIXELS);
  assert.deepEqual(geometry.positions, [0, 0, 16, 0, 16, 8, 0, 8]);
  assert.equal(scene.draws[0].geometry.positions[2], -3);
});

test('GPU05 repeated conversion refuses before replacing or releasing the installed borrowed Mesh', async t => {
  const f = await fixture(t), app = await application();
  const view = app.createResourceSceneGPU({ session: f.session }), before = f.capture();
  assert.throws(() => app.createResourceSceneGPU({ session: f.session }), { code: 'RESOURCE_SCENE_GPU_BADGE_REQUIRED' });
  assert.equal(f.engine.stage.getChildAt(1), view.badge); assert.equal(f.engine.stage.numChildren, 3);
  assert.equal(view.badge.isDisposed, false); assert.equal(f.lease.value, f.texture);
  assert.equal(f.counts.loads, 1); assert.equal(f.counts.disposals, 0);
  const after = f.capture(); assert.deepEqual(after.commands, before.commands);
  assert.equal(after.images[0], before.images[0]); assert.equal(after.geometries[0], before.geometries[0]);
});

test('GPU06 nonready composition refuses without retiring the healthy ordinary badge', async t => {
  const f = await fixture(t), app = await application(); f.setState('starting');
  assert.throws(() => app.createResourceSceneGPU({ session: f.session }), { code: 'RESOURCE_SCENE_GPU_NOT_READY' });
  assert.equal(f.ordinary.isDisposed, false); assert.equal(f.engine.stage.getChildAt(1), f.ordinary);
  assert.equal(f.capture().commands[0].kind, 'image'); assert.equal(f.lease.value, f.texture);
  assert.equal(f.counts.disposals, 0);
});

test('GPU07 ordinary Canvas composition refuses genuine textured negotiation and GPU badge conversion', async t => {
  const f = await fixture(t, false), app = await application();
  await assert.rejects(egret.createEngineForProfile({ host: makeHost({ renderFrame() {} }).adapter }, egret.TEXTURED_FRAME_PROFILE_2D),
    { code: 'ENGINE_RENDER_PROFILE_UNSUPPORTED' });
  assert.throws(() => app.createResourceSceneGPU({ session: f.session }), { code: 'RESOURCE_SCENE_GPU_PROFILE_REQUIRED' });
  assert.equal(f.ordinary.isDisposed, false); assert.equal(f.capture().commands[0].kind, 'image');
  assert.equal(f.lease.value, f.texture); assert.equal(f.counts.disposals, 0);
});
