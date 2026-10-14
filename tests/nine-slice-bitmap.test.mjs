// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

const FRAME = Object.freeze({ width: 20, height: 20, clearColor: 0, clearAlpha: 0 });
const CROP = Object.freeze({ x: 1, y: 1, width: 8, height: 8 });
const INSETS = Object.freeze({ left: 2, top: 2, right: 2, bottom: 2 });
const OPTIONS = Object.freeze({ width: 16, height: 12, insets: INSETS });
const POSITIONS_A = Object.freeze([0,0, 2,0, 14,0, 16,0, 0,2, 2,2, 14,2, 16,2,
  0,10, 2,10, 14,10, 16,10, 0,12, 2,12, 14,12, 16,12]);
const POSITIONS_B = Object.freeze([0,0, 2,0, 10,0, 12,0, 0,2, 2,2, 10,2, 12,2,
  0,14, 2,14, 10,14, 12,14, 0,16, 2,16, 10,16, 12,16]);
const UVS = Object.freeze([0,0, .25,0, .75,0, 1,0, 0,.25, .25,.25, .75,.25, 1,.25,
  0,.75, .25,.75, .75,.75, 1,.75, 0,1, .25,1, .75,1, 1,1]);
const INDICES = Object.freeze([0,1,4,1,5,4, 1,2,5,2,6,5, 2,3,6,3,7,6,
  4,5,8,5,9,8, 5,6,9,6,10,9, 6,7,10,7,11,10,
  8,9,12,9,13,12, 9,10,13,10,14,13, 10,11,14,11,15,14]);
let assetId = 0;

function capability() {
  assert.equal(typeof egret.NineSliceBitmap, 'function', 'NINE_SLICE_BITMAP_MISSING_PUBLIC_CLASS');
}
function code(action, wanted) {
  assert.throws(action, value => value instanceof egret.EgretError && value.code === wanted);
}
function typeFault(action, cause, requireCause = false) {
  assert.throws(action, value => value instanceof TypeError && (!requireCause ||
    (Object.hasOwn(value, 'cause') && value.cause === cause)));
}
function snapshot(f) {
  const frame = f.engine.captureTexturedFrame(FRAME);
  const command = frame.commands.find(value => value.kind === 'mesh');
  assert.ok(command, 'actual mesh command');
  return { frame, command, geometry: frame.geometries[command.geometryIndex] };
}

// Only public objects provide the positive model. Record created handles before
// ownership registration so an assertion/setup failure cannot hide a borrow.
async function fixture(crop = CROP, profile = true) {
  capability();
  const renders = [], diagnostics = [], resources = [], nodes = [];
  const port = host({ renderFrame(frame) { renders.push(frame); },
    ...(profile ? { texturedFrameProfile: egret.TEXTURED_FRAME_PROFILE_2D,
      renderTexturedFrame(frame) { renders.push(frame); } } : {}) });
  const engine = profile
    ? await egret.createEngineForProfile({ host: port.adapter, onDiagnostic: value => diagnostics.push(value) }, egret.TEXTURED_FRAME_PROFILE_2D)
    : await egret.createEngine({ host: port.adapter, onDiagnostic: value => diagnostics.push(value) });
  let scope, closed = false;
  const f = { engine, port, renders, diagnostics, resources, nodes,
    add(node, parent = engine.stage) { nodes.push(node); scope.use(node); parent.addChild(node); return node; },
    async acquire(value, validate = () => true) {
      const id = 'nlb-' + (++assetId), record = { value, loads: 0, disposals: 0, lease: undefined };
      resources.push(record);
      const type = egret.createAssetType(id, validate);
      engine.assets.register(type, { async load() { record.loads++; return value; },
        dispose(retired) { record.disposals++; if (egret.isTexture(retired)) retired.dispose(); } });
      record.lease = await engine.assets.acquire(egret.createAssetRef(type, id));
      scope.use(record.lease);
      return record;
    },
    async close() {
      if (closed) return;
      closed = true;
      const failures = [];
      const attempt = action => { try { action(); } catch (cause) { failures.push(cause); } };
      attempt(() => scope?.dispose());
      for (const node of [...nodes].reverse()) attempt(() => node.dispose());
      for (const record of resources) attempt(() => record.lease?.release());
      try { await engine.dispose(); } catch (cause) { failures.push(cause); }
      // Observe provider retirement before fallback disposal of a local Texture.
      const managerDisposed = f.texture?.isDisposed;
      attempt(() => f.texture?.dispose());
      attempt(() => {
        for (const record of resources) if (record.lease) {
          assert.equal(record.loads, 1); assert.equal(record.disposals, 1);
          code(() => record.lease.value, 'ASSET_LEASE_RELEASED');
        }
        if (f.lease) assert.equal(managerDisposed, true);
        assert.equal(scope?.state, 'closed'); assert.equal(engine.stage.isDisposed, true);
        for (const node of nodes) assert.equal(node.isDisposed, true);
        assert.deepEqual(diagnostics, []); assert.equal(port.timers.size, 0);
        assert.equal(port.trace.filter(value => value === 'stop').length, 1);
        assert.equal(port.trace.filter(value => value === 'close').length, 1);
      });
      if (failures.length) throw new AggregateError(failures, 'NineSliceBitmap public fixture cleanup failed');
    },
  };
  try {
    scope = engine.createScope(); f.scope = scope;
    f.image = egret.createImageData2D({ width: 10, height: 10, pixels: new Uint8Array(400).fill(255) });
    f.texture = egret.createTexture(f.image, crop);
    const resource = await f.acquire(f.texture, egret.isTexture);
    f.lease = resource.lease; f.resource = resource;
    return f;
  } catch (cause) {
    try { await f.close(); } catch (cleanupCause) { throw new AggregateError([cause, cleanupCause], 'Public setup and cleanup failed'); }
    throw cause;
  }
}
function construct(f, lease, options) {
  const node = new egret.NineSliceBitmap(lease, options);
  f.nodes.push(node); // Track even an unexpectedly accepted negative construction.
  return node;
}
function leaf(f, options = OPTIONS, parent = f.engine.stage) {
  const node = construct(f, f.lease, options);
  f.scope.use(node); parent.addChild(node); return node;
}
function orderedOptions(onRead = () => {}) {
  const seen = [], insetValues = { left: 2, top: 2, right: 2, bottom: 2 }, insets = {};
  for (const key of ['left', 'top', 'right', 'bottom']) Object.defineProperty(insets, key, {
    get() { seen.push(key); onRead(key); return insetValues[key]; },
  });
  const outerValues = { width: 16, height: 12, insets }, options = {};
  for (const key of ['width', 'height', 'insets']) Object.defineProperty(options, key, {
    get() { seen.push(key); onRead(key); return outerValues[key]; },
  });
  return { options, seen };
}

// L1/L2: public identity and literal source-view agreement, not another grid oracle.
test('NLB01 genuine display leaf captures literal fixed-border geometry and crop', async () => {
  const f = await fixture();
  try {
    const input = { width: 16, height: 12, insets: { ...INSETS } }, panel = leaf(f, input);
    assert.ok(panel instanceof egret.DisplayObject); assert.equal(panel instanceof egret.Mesh2D, false);
    assert.equal(panel instanceof egret.Bitmap, false); assert.equal(panel.textureLease, f.lease);
    assert.equal(panel.targetWidth, 16); assert.equal(panel.targetHeight, 12);
    assert.notEqual(panel.insets, input.insets); assert.deepEqual(panel.insets, INSETS); assert.ok(Object.isFrozen(panel.insets));
    assert.equal('setContent' in panel, false); assert.equal('sourceRect' in panel, false);
    const a = snapshot(f);
    assert.equal(a.frame.profile, egret.TEXTURED_FRAME_PROFILE_2D);
    assert.deepEqual(a.command.sourceRect, CROP);
    assert.deepEqual(a.geometry.positions, POSITIONS_A); assert.deepEqual(a.geometry.uvs, UVS);
    assert.deepEqual(a.geometry.indices, INDICES); assert.equal(a.geometry.triangleCount, 18);
    assert.ok(egret.isTexturedGeometry2D(a.geometry));
    input.width = 4; input.insets.left = 0;
    assert.equal(panel.targetWidth, 16); assert.deepEqual(panel.insets, INSETS);
    assert.deepEqual(egret.copyImageData2DPixels(a.frame.images[0]), egret.copyImageData2DPixels(f.image));
  } finally { await f.close(); }
});

test('NLB02 a nonzero-origin smaller Texture view supplies its own source dimensions', async () => {
  const crop = { x: 3, y: 4, width: 4, height: 4 }, f = await fixture(crop);
  try {
    let publicReads = 0;
    for (const name of ['sourceRect', 'width', 'height']) Object.defineProperty(f.texture, name, {
      get() { publicReads++; throw new Error('Texture public getter is not authority'); },
    });
    const panel = leaf(f, { width: 8, height: 6, insets: { left: 1, top: 1, right: 1, bottom: 1 } });
    assert.equal(publicReads, 0);
    const saved = snapshot(f);
    assert.equal(panel.textureLease, f.lease); assert.deepEqual(saved.command.sourceRect, crop);
    assert.deepEqual(saved.geometry.uvs, UVS);
    assert.deepEqual(saved.geometry.positions, [0,0, 1,0, 7,0, 8,0, 0,1, 1,1, 7,1, 8,1,
      0,5, 1,5, 7,5, 8,5, 0,6, 1,6, 7,6, 8,6]);
  } finally { await f.close(); }
});

test('NLB03 private class identity refuses borrowed foreign members without changing content', async () => {
  const f = await fixture();
  try {
    const panel = leaf(f), original = snapshot(f).geometry;
    const mesh = f.add(new egret.Mesh2D(f.lease, original)), bitmap = f.add(new egret.Bitmap(f.lease));
    let reads = 0;
    const hostile = new Proxy({}, { get() { reads++; throw new Error('must not read foreign arguments'); } });
    for (const name of ['setContent', 'clear', 'dispose']) code(() => egret.Mesh2D.prototype[name].call(panel, hostile, hostile), 'MESH_INVALID');
    for (const name of ['textureLease', 'geometry']) code(() => Object.getOwnPropertyDescriptor(egret.Mesh2D.prototype, name).get.call(panel), 'MESH_INVALID');
    for (const invalid of [mesh, bitmap, {}, new Proxy(panel, {})]) {
      code(() => egret.NineSliceBitmap.prototype.resize.call(invalid, hostile, hostile), 'NINE_SLICE_BITMAP_INVALID');
      code(() => egret.NineSliceBitmap.prototype.dispose.call(invalid), 'NINE_SLICE_BITMAP_INVALID');
      for (const name of ['textureLease', 'targetWidth', 'targetHeight', 'insets']) code(() => Object.getOwnPropertyDescriptor(egret.NineSliceBitmap.prototype, name).get.call(invalid), 'NINE_SLICE_BITMAP_INVALID');
    }
    assert.equal(reads, 0); assert.equal(panel.isDisposed, false);
    mesh.setContent(f.lease, original); mesh.clear(); mesh.setContent(f.lease, original);
    assert.equal(mesh.geometry, original); assert.equal(panel.targetWidth, 16);
    mesh.dispose(); bitmap.dispose(); panel.resize(12, 16);
    assert.deepEqual(snapshot(f).geometry.positions, POSITIONS_B);
  } finally { await f.close(); }
});

// L3: legal controls precede each one-callback lifetime mutation.
test('NLB04 ordered inherited getters snapshot once and allow independent constructor reentry', async () => {
  const f = await fixture();
  try {
    const descriptor = orderedOptions();
    const panel = leaf(f, Object.create(descriptor.options));
    assert.deepEqual(descriptor.seen, ['width','height','insets','left','top','right','bottom']);
    let nested;
    const outer = { get width() { nested = leaf(f, { width: 7, height: 9, insets: INSETS }); return 16; }, height: 12, insets: INSETS };
    const second = leaf(f, outer);
    assert.equal(nested.targetWidth, 7); assert.equal(second.targetWidth, 16); assert.equal(panel.targetWidth, 16);
    const ownKeysTrap = new Proxy(OPTIONS, { ownKeys() { throw new Error('unknown keys must not be enumerated'); } });
    const third = leaf(f, ownKeysTrap); assert.equal(third.targetHeight, 12);
    const inheritedInsets = leaf(f, { width: 16, height: 12, insets: Object.create(INSETS) });
    assert.deepEqual(inheritedInsets.insets, INSETS);
  } finally { await f.close(); }
});

test('NLB05 every successful known getter checkpoint stops later reads after lease release', async () => {
  for (const key of ['width','height','insets','left','top','right','bottom']) {
    const f = await fixture();
    try {
      leaf(f); // A fresh genuine legal control for this assigned callback.
      const descriptor = orderedOptions(current => { if (current === key) f.lease.release(); });
      code(() => construct(f, f.lease, descriptor.options), 'ASSET_LEASE_RELEASED');
      const order = ['width','height','insets','left','top','right','bottom'];
      assert.deepEqual(descriptor.seen, order.slice(0, order.indexOf(key) + 1));
    } finally { await f.close(); }
  }
});

test('NLB06 successful terminal callbacks precede inset admission and numeric semantics', async () => {
  for (const scenario of ['insets-admission', 'bottom-numeric', 'engine-before-lease']) {
    const f = await fixture();
    try {
      leaf(f);
      if (scenario === 'insets-admission') {
        const revoked = Proxy.revocable({}, {}); revoked.revoke();
        let reads = 0;
        const options = { width: 16, height: 12, get insets() { reads++; f.texture.dispose(); return revoked.proxy; } };
        code(() => construct(f, f.lease, options), 'TEXTURE_DISPOSED'); assert.equal(reads, 1);
      } else if (scenario === 'bottom-numeric') {
        const insets = { left: 2, top: 2, right: 2, get bottom() { f.lease.release(); return 'bad'; } };
        code(() => construct(f, f.lease, { width: -1, height: 12, insets }), 'ASSET_LEASE_RELEASED');
      } else {
        const options = { get width() { void f.engine.dispose(); f.lease.release(); return -1; },
          get height() { throw new Error('later height read'); }, insets: INSETS };
        code(() => construct(f, f.lease, options), 'ENGINE_CLOSED');
      }
    } finally { await f.close(); }
  }
});

test('NLB07 thrown descriptor cause including undefined survives terminal side effects', async () => {
  for (const cause of [undefined, Object.freeze({ original: 'getter-failure' })]) {
    const f = await fixture();
    try {
      leaf(f); let laterReads = 0;
      const options = { get width() { f.lease.release(); throw cause; }, get height() { laterReads++; return 12; }, insets: INSETS };
      typeFault(() => construct(f, f.lease, options), cause, true);
      assert.equal(laterReads, 0);
    } finally { await f.close(); }
  }
  const f = await fixture();
  try {
    leaf(f);
    for (const invalid of [null, [], () => {}, { width: 16, height: 12, insets: [] }]) typeFault(() => construct(f, f.lease, invalid));
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    typeFault(() => construct(f, f.lease, revoked.proxy));
    assert.equal(f.lease.value, f.texture);
  } finally { await f.close(); }
});

// L4/L6: immutable captures, visible replacement and meaningful bounds budgets.
test('NLB08 resize owns fresh geometry, rejects atomically and preserves saved frames', async () => {
  const f = await fixture();
  let a, b, imageBytes;
  try {
    const panel = leaf(f); a = snapshot(f); imageBytes = egret.copyImageData2DPixels(a.frame.images[0]);
    panel.resize(12, 16); b = snapshot(f);
    assert.equal(panel.targetWidth, 12); assert.equal(panel.targetHeight, 16);
    assert.notEqual(a.geometry, b.geometry); assert.deepEqual(a.geometry.positions, POSITIONS_A); assert.deepEqual(b.geometry.positions, POSITIONS_B);
    panel.resize(12, 16); const same = snapshot(f);
    assert.notEqual(same.geometry, b.geometry); assert.deepEqual(same.geometry.positions, POSITIONS_B);
    for (const [width, height, ErrorType] of [[3,16,RangeError],[12,0,RangeError],[Infinity,16,RangeError],[-1,'bad',TypeError]]) {
      assert.throws(() => panel.resize(width, height), ErrorType);
      assert.equal(panel.targetWidth, 12); assert.equal(panel.targetHeight, 16);
      assert.equal(snapshot(f).geometry, same.geometry);
    }
    typeFault(() => construct(f, f.lease, { width: -1, height: 12, insets: { ...INSETS, bottom: 'bad' } }));
    assert.throws(() => construct(f, f.lease, { ...OPTIONS, insets: { ...INSETS, left: Number.MIN_VALUE } }), RangeError);
  } finally { await f.close(); }
  assert.deepEqual(a.geometry.positions, POSITIONS_A); assert.deepEqual(b.geometry.positions, POSITIONS_B);
  assert.deepEqual(egret.copyImageData2DPixels(a.frame.images[0]), imageBytes);
  assert.deepEqual(egret.copyImageData2DPixels(b.frame.images[0]), imageBytes);
});

test('NLB09 intentional zero center, zero borders and fractional sizes retain geometry semantics', async () => {
  for (const options of [{ width: 4, height: 4, insets: INSETS },
    { width: 1, height: 1, insets: { left: 0, top: 0, right: 0, bottom: 0 } },
    { width: 6.5, height: 7.5, insets: { left: .5, top: .5, right: .5, bottom: .5 } }]) {
    const f = await fixture();
    try {
      const panel = leaf(f, options), saved = snapshot(f);
      assert.equal(saved.geometry.vertexCount, 16); assert.equal(saved.geometry.triangleCount, 18);
      assert.deepEqual(panel.getBounds(), { x: 0, y: 0, width: options.width, height: options.height });
    } finally { await f.close(); }
  }
});

test('NLB10 transformed cached bounds charge each triangle and hitArea remains authored', async () => {
  const f = await fixture();
  try {
    const parent = f.add(new egret.Sprite()); parent.x = 3; parent.y = 4; parent.scaleX = 2; parent.scaleY = 3;
    const panel = leaf(f, OPTIONS, parent); panel.x = 1; panel.y = 2;
    panel.hitArea = { x: 0, y: 0, width: 3, height: 3 }; const hitArea = panel.hitArea;
    assert.deepEqual(panel.getBounds(), { x: 0, y: 0, width: 16, height: 12 });
    assert.deepEqual(parent.getBounds(), { x: 1, y: 2, width: 16, height: 12 });
    assert.deepEqual(f.engine.stage.getBounds(), { x: 5, y: 10, width: 32, height: 36 });
    code(() => panel.getBounds({ maxPrimitives: 17 }), 'BOUNDS_CONTENT_LIMIT');
    assert.deepEqual(panel.getBounds({ maxPrimitives: 18 }), { x: 0, y: 0, width: 16, height: 12 });
    panel.resize(12, 16); assert.equal(panel.hitArea, hitArea);
    panel.visible = false; panel.alpha = 0; panel.clipRect = { x: 0, y: 0, width: 0, height: 0 };
    f.lease.release(); assert.deepEqual(panel.getBounds(), { x: 0, y: 0, width: 12, height: 16 });
  } finally { await f.close(); }
});

// L5: leaf retirement does not own or revive any manager-issued borrow.
test('NLB11 resource guards, cross-Engine attachment and post-disposal metadata', async () => {
  const f = await fixture(), other = await fixture();
  try {
    const panel = leaf(f), insets = panel.insets, ordinary = f.add(new egret.Bitmap(f.lease));
    code(() => other.engine.stage.addChild(panel), 'ENGINE_MISMATCH');
    assert.equal(panel.parent, f.engine.stage);
    code(() => other.scope.use(panel), 'OWNERSHIP_CONFLICT');
    const unowned = construct(f, f.lease, OPTIONS);
    code(() => other.scope.use(unowned), 'ENGINE_MISMATCH');
    assert.equal(unowned.isDisposed, false); unowned.dispose();
    panel.dispose(); panel.dispose();
    assert.equal(panel.textureLease, undefined); assert.equal(panel.insets, insets);
    assert.equal(panel.targetWidth, 16); assert.equal(panel.targetHeight, 12);
    assert.equal(f.lease.value, f.texture); assert.equal(ordinary.textureLease, f.lease);
    assert.equal(f.resource.disposals, 0);
    code(() => panel.resize(-1, 'bad'), 'OBJECT_DISPOSED'); code(() => panel.getBounds(), 'OBJECT_DISPOSED');
    const wrong = await f.acquire({ unrelated: true });
    code(() => construct(f, wrong.lease, OPTIONS), 'NINE_SLICE_BITMAP_TEXTURE_INVALID');
    let reads = 0;
    const fake = new Proxy({}, { get() { reads++; throw new Error('fake lease read'); } });
    code(() => construct(f, fake, OPTIONS), 'NINE_SLICE_BITMAP_LEASE_INVALID'); assert.equal(reads, 0);
  } finally { await f.close(); await other.close(); }
  assert.equal(f.resource.disposals, 1);
});

test('NLB12 release/Texture retirement outrank bad resize and do not change last metadata', async () => {
  for (const scenario of ['lease', 'texture']) {
    const f = await fixture();
    try {
      const panel = leaf(f); panel.resize(12, 16);
      if (scenario === 'lease') f.lease.release(); else f.texture.dispose();
      code(() => panel.resize(-1, 'bad'), scenario === 'lease' ? 'ASSET_LEASE_RELEASED' : 'TEXTURE_DISPOSED');
      assert.equal(panel.targetWidth, 12); assert.equal(panel.targetHeight, 16); assert.equal(panel.textureLease, f.lease);
    } finally { await f.close(); }
  }
  const f = await fixture();
  try {
    const panel = construct(f, f.lease, OPTIONS); // Deliberately unowned so Engine closes without disposing this leaf.
    await f.engine.dispose();
    code(() => panel.resize(-1, 'bad'), 'ENGINE_CLOSED');
    panel.dispose(); code(() => panel.resize(-1, 'bad'), 'OBJECT_DISPOSED'); assert.equal(panel.textureLease, undefined);
  } finally { await f.close(); }
});

// L7/L8: real owned frames use existing routes; this is no browser pixel claim.
test('NLB13 recording textured render preserves sibling order and ordinary profile refusals', async () => {
  const f = await fixture();
  try {
    const panel = leaf(f), sprite = f.add(new egret.Sprite()); sprite.graphics.beginFill(0xff0000).drawRect(0,0,2,2);
    f.add(new egret.Bitmap(f.lease)); panel.alpha = .5; panel.clipRect = { x: 0, y: 0, width: 8, height: 6 };
    const frame = f.engine.renderTexturedFrame(FRAME);
    assert.equal(f.renders.length, 1); assert.equal(f.renders[0], frame);
    assert.deepEqual(frame.commands.map(value => value.kind), ['mesh','rect','image']);
    assert.equal(frame.commands[0].alpha, .5); assert.deepEqual(frame.commands[0].clips[0].rect, { x: 0, y: 0, width: 8, height: 6 });
    code(() => f.engine.captureFrame(FRAME), 'FRAME_MESH_UNSUPPORTED');
    code(() => f.engine.renderFrame(FRAME), 'FRAME_MESH_UNSUPPORTED'); assert.equal(f.renders.length, 1);
  } finally { await f.close(); }
  const legacy = await fixture(CROP, false);
  try {
    const panel = leaf(legacy); legacy.lease.release();
    code(() => legacy.engine.renderFrame(FRAME), 'FRAME_MESH_UNSUPPORTED'); assert.equal(legacy.renders.length, 0);
    panel.visible = false; assert.deepEqual(legacy.engine.captureFrame(FRAME).commands, []);
    panel.visible = true; panel.alpha = 0; assert.deepEqual(legacy.engine.captureFrame(FRAME).commands, []);
    panel.alpha = 1; panel.clipRect = { x: 0, y: 0, width: 0, height: 4 };
    assert.deepEqual(legacy.engine.captureFrame(FRAME).commands, []); assert.equal(legacy.renders.length, 0);
  } finally { await legacy.close(); }
  const unsupported = host();
  await assert.rejects(egret.createEngineForProfile({ host: unsupported.adapter }, egret.TEXTURED_FRAME_PROFILE_2D), value => value instanceof egret.EgretError && value.code === 'ENGINE_RENDER_PROFILE_UNSUPPORTED');
  assert.deepEqual(unsupported.trace, []); assert.equal(unsupported.timers.size, 0);
});
