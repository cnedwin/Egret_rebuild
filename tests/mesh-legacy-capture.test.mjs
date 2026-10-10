import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// Legacy frames preserve their existing shape, skips and painter traversal.
const FRAME = Object.freeze({ width: 64, height: 64 });
let id = 0;
function capability() {
  assert.equal(typeof egret.Bitmap, 'function', 'existing facade initializes');
  assert.equal(typeof egret.createTexturedGeometry2D, 'function', 'geometry prerequisite');
  assert.equal(typeof egret.Mesh2D, 'function', 'Mesh2D public capability');
}
function geometry(positions = [2, 3, 6, 3, 2, 8], indices = [0, 1, 2]) {
  const n = positions.length / 2;
  return egret.createTexturedGeometry2D({ positions: new Float64Array(positions), uvs: new Float64Array(2 * n), lightColors: new Float64Array(4 * n).fill(1), indices: new Uint32Array(indices) });
}
async function acquire(engine, value, dispose = () => {}) {
  const key = ++id, type = egret.createAssetType(`mesh-legacy-${key}`, () => true);
  engine.assets.register(type, { load: async () => value, dispose });
  const ref = egret.createAssetRef(type, `mesh-legacy-${key}`);
  return { ref, lease: await engine.assets.acquire(ref) };
}
async function constructFixture(positions, indices, renderable, attach) {
  capability(); const diagnostics = [], renderedFrames = []; let renderCalls = 0;
  // Install the own render port before the Engine captures renderer authority.
  const port = renderable ? host({ renderFrame(frame) { renderCalls++; renderedFrames.push(frame); return undefined; } }) : host();
  assert.equal(Object.hasOwn(port.adapter, 'renderFrame'), renderable);
  if (renderable) assert.equal(typeof port.adapter.renderFrame, 'function');
  const engine = await egret.createEngine({ host: port.adapter, onDiagnostic: record => diagnostics.push(record) });
  try {
    const image = egret.createImageData2D({ width: 4, height: 4, pixels: new Uint8Array(64) });
    const texture = egret.createTexture(image, { x: 1, y: 1, width: 2, height: 2 });
    const borrowed = await acquire(engine, texture, value => value.dispose());
    const owned = geometry(positions, indices), node = new egret.Mesh2D(borrowed.lease, owned);
    if (attach) engine.stage.addChild(node);
    return { engine, node, texture, image, geometry: owned, ...borrowed, port, diagnostics, renderedFrames, renderCalls: () => renderCalls };
  } catch (cause) {
    try { await engine.dispose(); }
    catch (cleanupCause) { throw new AggregateError([cause, cleanupCause], 'Mesh fixture construction and Engine cleanup failed'); }
    throw cause;
  }
}
function fixture(positions, indices) { return constructFixture(positions, indices, false, true); }
function legacyRenderableFixture(positions, indices, { attach = true } = {}) { return constructFixture(positions, indices, true, attach); }
function code(run, want) { assert.throws(run, error => error instanceof egret.EgretError && error.code === want); }
function noRenderFailure(f) { assert.equal(f.diagnostics.some(record => record.code === 'FRAME_RENDER_FAILED'), false); }
function emptyFrame(frame, frameId) {
  assert.deepEqual(frame, { frameId, width: 64, height: 64, clearColor: 0, clearAlpha: 0, commands: [] });
  assert.equal(Object.hasOwn(frame, 'images'), false); assert.equal(Object.isFrozen(frame), true); assert.equal(Object.isFrozen(frame.commands), true);
}
function parentOf(f) { const parent = f.engine.stage.addChild(new egret.Sprite()); parent.addChild(f.node); return parent; }
function poison(target, keys, onRead) {
  const saved = [];
  function restore() {
    for (let i = saved.length - 1; i >= 0; i--) {
      const [key, descriptor] = saved[i];
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else assert.equal(Reflect.deleteProperty(target, key), true);
    }
  }
  try {
    for (const key of keys) {
      saved.push([key, Object.getOwnPropertyDescriptor(target, key)]);
      Object.defineProperty(target, key, { configurable: true, get() { onRead(); throw Error('overridden public getter'); } });
    }
  } catch (cause) { restore(); throw cause; }
  return restore;
}

test('L01 visible occupied Mesh refuses before renderer invocation, even empty or retired', async () => {
  capability();
  for (const scenario of ['occupied', 'empty', 'released', 'disposedTexture', 'rejectedReplacement']) {
    const f = scenario === 'empty' ? await legacyRenderableFixture([], []) : await legacyRenderableFixture();
    try {
      if (scenario === 'released') f.lease.release();
      if (scenario === 'disposedTexture') f.texture.dispose();
      if (scenario === 'rejectedReplacement') {
        const wrong = await acquire(f.engine, {});
        code(() => f.node.setContent(wrong.lease, f.geometry), 'MESH_TEXTURE_INVALID');
        assert.equal(f.node.textureLease, f.lease); assert.equal(f.node.geometry, f.geometry);
      }
      code(() => f.engine.captureFrame(FRAME), 'FRAME_MESH_UNSUPPORTED');
      code(() => f.engine.renderFrame(FRAME), 'FRAME_MESH_UNSUPPORTED');
      assert.equal(f.renderCalls(), 0); assert.deepEqual(f.renderedFrames, []); noRenderFailure(f);
    } finally { await f.engine.dispose(); }
  }
});

test('L02 old subtree skips and rounded-zero alpha preserve empty legacy frame shape', async () => {
  capability();
  for (const scenario of ['ownInvisible', 'ancestorInvisible', 'ownAlphaZero', 'ancestorAlphaZero', 'ownZeroWidthClip', 'ancestorZeroHeightClip', 'cleared']) {
    const f = await fixture();
    try {
      let parent;
      if (scenario.startsWith('ancestor')) parent = parentOf(f);
      if (scenario === 'ownInvisible') f.node.visible = false;
      if (scenario === 'ancestorInvisible') parent.visible = false;
      if (scenario === 'ownAlphaZero') f.node.alpha = 0;
      if (scenario === 'ancestorAlphaZero') parent.alpha = 0;
      if (scenario === 'ownZeroWidthClip') f.node.clipRect = { x: 0, y: 0, width: 0, height: 1 };
      if (scenario === 'ancestorZeroHeightClip') parent.clipRect = { x: 0, y: 0, width: 1, height: 0 };
      f.lease.release();
      if (scenario === 'cleared') f.node.clear();
      emptyFrame(f.engine.captureFrame(FRAME), 1);
    } finally { await f.engine.dispose(); }
  }
  const rounded = await fixture();
  try {
    const parent = parentOf(rounded); parent.alpha = 1e-200; rounded.node.alpha = 1e-200;
    rounded.lease.release(); emptyFrame(rounded.engine.captureFrame(FRAME), 1);
    parent.scaleX = Number.MAX_VALUE; rounded.node.scaleX = 2;
    code(() => rounded.engine.captureFrame(FRAME), 'FRAME_TRANSFORM_INVALID');
  } finally { await rounded.engine.dispose(); }
});

test('L03 preceding Graphics and Bitmap errors, painter order and private visual authority persist', async () => {
  capability();
  const overflow = await fixture();
  try {
    const rect = overflow.engine.stage.addChild(new egret.Sprite());
    rect.graphics.beginFill(1).drawRect(Number.MAX_VALUE, 0, Number.MAX_VALUE, 1);
    overflow.engine.stage.setChildIndex(rect, 0);
    code(() => overflow.engine.captureFrame(FRAME), 'FRAME_TRANSFORM_INVALID');
  } finally { await overflow.engine.dispose(); }
  const retired = await fixture();
  try {
    const bitmap = retired.engine.stage.addChild(new egret.Bitmap(retired.lease));
    retired.engine.stage.setChildIndex(bitmap, 0); retired.lease.release();
    code(() => retired.engine.captureFrame(FRAME), 'ASSET_LEASE_RELEASED');
    retired.engine.stage.setChildIndex(retired.node, 0);
    code(() => retired.engine.captureFrame(FRAME), 'FRAME_MESH_UNSUPPORTED');
  } finally { await retired.engine.dispose(); }
  const f = await fixture();
  try {
    const rect = f.engine.stage.addChild(new egret.Sprite()); rect.graphics.beginFill(0xff0000).drawRect(10, 20, 2, 3);
    f.engine.stage.addChild(new egret.Bitmap(f.lease));
    f.node.visible = false;
    let frame = f.engine.captureFrame(FRAME);
    assert.deepEqual(frame.commands.map(command => command.kind), ['rect', 'image']);
    assert.deepEqual(frame.commands[0].rect, { x: 10, y: 20, width: 2, height: 3 });
    assert.deepEqual(frame.commands[1].rect, { x: 0, y: 0, width: 2, height: 2 });
    assert.deepEqual(frame.commands[1].sourceRect, { x: 1, y: 1, width: 2, height: 2 });
    assert.equal(frame.commands[1].imageIndex, 0); assert.equal(frame.images[0], f.image);
    f.node.clear(); frame = f.engine.captureFrame(FRAME);
    assert.deepEqual(frame.commands.map(command => command.kind), ['rect', 'image']);
    f.node.setContent(f.lease, f.geometry);
    let reads = 0;
    for (const visible of [true, false]) {
      f.node.visible = visible;
      const restoreNode = poison(f.node, ['geometry', 'textureLease', 'visible', 'x'], () => reads++);
      try {
        const restoreTexture = poison(f.texture, ['imageData', 'sourceRect', 'width', 'height', 'isDisposed'], () => reads++);
        try {
          const restoreLease = poison(egret.AssetLease.prototype, ['value'], () => reads++);
          try {
            if (visible) code(() => f.engine.captureFrame(FRAME), 'FRAME_MESH_UNSUPPORTED');
            else assert.deepEqual(f.engine.captureFrame(FRAME).commands.map(command => command.kind), ['rect', 'image']);
          } finally { restoreLease(); }
        } finally { restoreTexture(); }
      } finally { restoreNode(); }
    }
    assert.equal(reads, 0);
  } finally { await f.engine.dispose(); }
});

test('L04 refusal consumes no frame ID and leaves the shared capture/render barrier usable', async () => {
  capability();
  const f = await legacyRenderableFixture(undefined, undefined, { attach: false });
  try {
    assert.equal(f.node.parent, undefined);
    emptyFrame(f.engine.captureFrame(FRAME), 1);
    f.engine.stage.addChild(f.node);
    code(() => f.engine.captureFrame(FRAME), 'FRAME_MESH_UNSUPPORTED');
    code(() => f.engine.renderFrame(FRAME), 'FRAME_MESH_UNSUPPORTED');
    assert.equal(f.renderCalls(), 0); assert.deepEqual(f.renderedFrames, []); noRenderFailure(f);
    f.node.clear(); emptyFrame(f.engine.captureFrame(FRAME), 2); assert.equal(f.renderCalls(), 0);
    f.node.setContent(f.lease, f.geometry); f.node.visible = false;
    const returned = f.engine.renderFrame(FRAME); emptyFrame(returned, 3);
    assert.equal(f.renderCalls(), 1); assert.equal(f.renderedFrames.length, 1);
    assert.equal(f.renderedFrames[0], returned); noRenderFailure(f);
  } finally { await f.engine.dispose(); }
});
