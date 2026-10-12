import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// First-party Apache-2.0 test draft. This source has not been run or admitted
// to the future BW-delivered baseline. Public imports resolve only after the
// draft is independently admitted into a freshly frozen repository test tree.
// Geometry expectations below are independent literals, not product helpers.
const XY_A = Object.freeze([
  0, 0, 2, 0, 14, 0, 16, 0,
  0, 2, 2, 2, 14, 2, 16, 2,
  0, 10, 2, 10, 14, 10, 16, 10,
  0, 12, 2, 12, 14, 12, 16, 12,
]);
const XY_B = Object.freeze([
  0, 0, 2, 0, 10, 0, 12, 0,
  0, 2, 2, 2, 10, 2, 12, 2,
  0, 14, 2, 14, 10, 14, 12, 14,
  0, 16, 2, 16, 10, 16, 12, 16,
]);
const UV = Object.freeze([
  0, 0, 0.25, 0, 0.75, 0, 1, 0,
  0, 0.25, 0.25, 0.25, 0.75, 0.25, 1, 0.25,
  0, 0.75, 0.25, 0.75, 0.75, 0.75, 1, 0.75,
  0, 1, 0.25, 1, 0.75, 1, 1, 1,
]);
const LIGHT = Object.freeze([
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
]);
const INDICES = Object.freeze([
  0, 1, 4, 1, 5, 4, 1, 2, 5, 2, 6, 5, 2, 3, 6, 3, 7, 6,
  4, 5, 8, 5, 9, 8, 5, 6, 9, 6, 10, 9, 6, 7, 10, 7, 11, 10,
  8, 9, 12, 9, 13, 12, 9, 10, 13, 10, 14, 13, 10, 11, 14, 11, 15, 14,
]);
const FRAME = Object.freeze({ width: 64, height: 64 });
const CROP = Object.freeze({ x: 0, y: 0, width: 8, height: 8 });
let assetId = 0;

function options(overrides = {}) {
  return {
    sourceWidth: 8, sourceHeight: 8, targetWidth: 16, targetHeight: 12,
    insets: { left: 2, top: 2, right: 2, bottom: 2 }, ...overrides,
  };
}
function create(input) {
  assert.equal(typeof egret.createNineSliceGeometry2D, 'function',
    'NS1_MISSING_PUBLIC_API:createNineSliceGeometry2D');
  return egret.createNineSliceGeometry2D(input);
}
function geometry(actual, positions, uvs = UV) {
  assert.equal(egret.isTexturedGeometry2D(actual), true);
  assert.equal(actual.vertexCount, 16);
  assert.equal(actual.indexCount, 54);
  assert.equal(actual.triangleCount, 18);
  assert.equal(actual.logicalByteLength, 1240);
  assert.deepEqual(actual.positions, positions);
  assert.deepEqual(actual.uvs, uvs);
  assert.deepEqual(actual.lightColors, LIGHT);
  assert.deepEqual(actual.indices, INDICES);
  for (const value of [actual, actual.positions, actual.uvs, actual.lightColors, actual.indices]) {
    assert.equal(Object.isFrozen(value), true);
  }
  for (const value of [actual.positions, actual.uvs, actual.lightColors, actual.indices]) {
    assert.equal(Array.isArray(value), true, 'retain original public readonly-array representation');
  }
}
function code(run, expected) {
  assert.throws(run, error => error instanceof egret.EgretError && error.code === expected);
}

// The old baseline uses a real Engine, immutable CPU image, Texture, manager
// lease, Scope and Mesh. Track actual construction before owner registration
// so partial setup and failed assertions still clean up every created object.
async function oldFixture() {
  for (const name of ['createEngine', 'createImageData2D', 'createTexture', 'createAssetType',
    'createAssetRef', 'createTexturedGeometry2D', 'isTexturedGeometry2D', 'Mesh2D', 'Sprite']) {
    assert.equal(typeof egret[name], 'function', 'old public prerequisite: ' + name);
  }
  const port = host(), diagnostics = [];
  const engine = await egret.createEngine({ host: port.adapter, onDiagnostic: value => diagnostics.push(value) });
  const f = {
    engine, port, diagnostics, nodes: [], scope: undefined, image: undefined,
    texture: undefined, lease: undefined, node: undefined, triangle: undefined,
    disposals: 0, closed: false,
    attach(node, parent = engine.stage) {
      f.nodes.push(node);
      f.scope.use(node);
      parent.addChild(node);
      return node;
    },
    async close() {
      if (f.closed) return;
      f.closed = true;
      const failures = [];
      function attempt(run) { try { run(); } catch (cause) { failures.push(cause); } }
      attempt(() => f.scope?.dispose());
      for (let i = f.nodes.length - 1; i >= 0; i--) attempt(() => f.nodes[i].dispose());
      attempt(() => f.lease?.release());
      try { await engine.dispose(); } catch (cause) { failures.push(cause); }
      // Observe manager retirement before fallback disposal; fallback must not
      // manufacture a successful manager/Scope cleanup observation.
      const managerTextureDisposed = f.texture?.isDisposed;
      attempt(() => f.texture?.dispose());
      attempt(() => {
        if (f.scope) assert.equal(f.scope.state, 'closed');
        for (const node of f.nodes) assert.equal(node.isDisposed, true);
        if (f.lease) {
          code(() => f.lease.value, 'ASSET_LEASE_RELEASED');
          assert.equal(f.disposals, 1);
          assert.equal(managerTextureDisposed, true);
        }
        if (f.texture) assert.equal(f.texture.isDisposed, true);
        assert.equal(engine.stage.isDisposed, true);
        code(() => engine.createScope(), 'ENGINE_CLOSED');
        assert.deepEqual(diagnostics, []);
        assert.equal(port.timers.size, 0);
        assert.equal(port.trace.filter(value => value === 'stop').length, 1);
        assert.equal(port.trace.filter(value => value === 'close').length, 1);
      });
      if (failures.length) throw new AggregateError(failures, 'NS1 old public fixture cleanup failed');
    },
  };
  try {
    f.scope = engine.createScope();
    f.image = egret.createImageData2D({ width: 8, height: 8, pixels: new Uint8Array(256).fill(255) });
    f.texture = egret.createTexture(f.image, CROP);
    const key = 'nine-slice-draft-' + (++assetId);
    const type = egret.createAssetType(key, egret.isTexture);
    engine.assets.register(type, {
      load: async () => f.texture,
      dispose(value) { f.disposals++; value.dispose(); },
    });
    f.lease = await engine.assets.acquire(egret.createAssetRef(type, key));
    f.scope.use(f.lease);
    f.triangle = egret.createTexturedGeometry2D({
      positions: new Float64Array([0, 0, 2, 0, 0, 2]),
      uvs: new Float64Array([0, 0, 1, 0, 0, 1]),
      lightColors: new Float64Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
      indices: new Uint16Array([0, 1, 2]),
    });
    f.node = f.attach(new egret.Mesh2D(f.lease, f.triangle));
    return f;
  } catch (cause) {
    try { await f.close(); }
    catch (cleanupCause) { throw new AggregateError([cause, cleanupCause], 'NS1 setup and cleanup failed'); }
    throw cause;
  }
}

test('NS00 old public baseline completes all cleanup before named missing API RED', async () => {
  const f = await oldFixture();
  let saved;
  try {
    assert.equal(f.scope.state, 'open');
    assert.equal(f.lease.value, f.texture);
    assert.equal(f.node.textureLease, f.lease);
    assert.equal(f.node.geometry, f.triangle);
    assert.equal(egret.isTexturedGeometry2D(f.triangle), true);
    saved = f.engine.captureTexturedFrame(FRAME);
    assert.equal(saved.profile, 'egret.textured-frame2d/1');
    assert.equal(saved.frameId, 1);
    assert.deepEqual(saved.commands.map(value => value.kind), ['mesh']);
    assert.equal(saved.images[0], f.image);
    assert.equal(saved.geometries[0], f.triangle);
    assert.deepEqual(saved.commands[0].sourceRect, CROP);
    assert.deepEqual(saved.geometries[0].positions, [0, 0, 2, 0, 0, 2]);
    assert.deepEqual(saved.geometries[0].indices, [0, 1, 2]);
  } finally { await f.close(); }
  assert.equal(saved.geometries[0], f.triangle);
  assert.deepEqual(saved.geometries[0].positions, [0, 0, 2, 0, 0, 2]);
  assert.equal(Object.isFrozen(saved), true);
  // A setup/capture/cleanup failure never reaches this admission marker.
  console.log('NS00_OLD_PUBLIC_BASELINE_CLEANUP_COMPLETED');
  assert.equal(typeof egret.createNineSliceGeometry2D, 'function',
    'NS00_MISSING_PUBLIC_API:createNineSliceGeometry2D');
});

test('NS01 authentic frozen owned 16-vertex geometry matches independent full literals', () => {
  const input = options(), a = create(input);
  geometry(a, XY_A);
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(input.insets), false);
  input.sourceWidth = 1;
  input.targetWidth = 999;
  input.insets.left = 700;
  input.insets = null;
  geometry(a, XY_A);
  assert.throws(() => { a.positions[0] = 7; }, TypeError);
  const b = create(options());
  geometry(b, XY_A);
  assert.notEqual(b, a);
  for (const name of ['positions', 'uvs', 'lightColors', 'indices']) assert.notEqual(b[name], a[name]);
});

test('NS02 zero insets and intentional zero target center retain all canonical cells', () => {
  const zero = create(options({ insets: { left: 0, top: 0, right: 0, bottom: 0 } }));
  geometry(zero, [
    0, 0, 0, 0, 16, 0, 16, 0,
    0, 0, 0, 0, 16, 0, 16, 0,
    0, 12, 0, 12, 16, 12, 16, 12,
    0, 12, 0, 12, 16, 12, 16, 12,
  ], [
    0, 0, 0, 0, 1, 0, 1, 0,
    0, 0, 0, 0, 1, 0, 1, 0,
    0, 1, 0, 1, 1, 1, 1, 1,
    0, 1, 0, 1, 1, 1, 1, 1,
  ]);
  geometry(create(options({ targetWidth: 4, targetHeight: 4 })), [
    0, 0, 2, 0, 2, 0, 4, 0,
    0, 2, 2, 2, 2, 2, 4, 2,
    0, 2, 2, 2, 2, 2, 4, 2,
    0, 4, 2, 4, 2, 4, 4, 4,
  ]);
  const fractional = create(options({ targetWidth: 0.30000000000000004, targetHeight: 4,
    insets: { left: 0.1, top: 2, right: 0.2, bottom: 2 } }));
  assert.deepEqual(fractional.positions.slice(0, 8), [0, 0, 0.1, 0, 0.1, 0, 0.30000000000000004, 0]);
  assert.equal(fractional.indexCount, 54);
});

test('NS03 descriptor, source-center and target-size refusals preserve corners', () => {
  for (const input of [null, [], options({ insets: null }), options({ insets: [] })]) {
    assert.throws(() => create(input), TypeError);
  }
  for (const input of [
    options({ sourceWidth: 0 }), options({ targetHeight: -1 }),
    options({ insets: { left: -1, top: 2, right: 2, bottom: 2 } }),
    options({ sourceWidth: 4 }), options({ sourceHeight: 4 }),
    options({ targetWidth: 3 }), options({ targetHeight: 3 }),
  ]) assert.throws(() => create(input), RangeError);
  geometry(create(options()), XY_A, UV);
});

test('NS04 fractional borders are literal Float64 cuts and signed zero is normalized', () => {
  const a = create(options({ sourceWidth: 4, sourceHeight: 4, targetWidth: 8, targetHeight: 6,
    insets: { left: 0.5, top: -0, right: 1.5, bottom: 0.25 } }));
  geometry(a, [
    0, 0, 0.5, 0, 6.5, 0, 8, 0,
    0, 0, 0.5, 0, 6.5, 0, 8, 0,
    0, 5.75, 0.5, 5.75, 6.5, 5.75, 8, 5.75,
    0, 6, 0.5, 6, 6.5, 6, 8, 6,
  ], [
    0, 0, 0.125, 0, 0.625, 0, 1, 0,
    0, 0, 0.125, 0, 0.625, 0, 1, 0,
    0, 0.9375, 0.125, 0.9375, 0.625, 0.9375, 1, 0.9375,
    0, 1, 0.125, 1, 0.625, 1, 1, 1,
  ]);
  for (const values of [a.positions, a.uvs]) for (const value of values) assert.equal(Object.is(value, -0), false);
});

test('NS05 inherited accessors read once in exact order without unknown-key enumeration', () => {
  const reads = [], outer = {}, borders = {};
  for (const [name, value] of [['left', 2], ['top', 2], ['right', 2], ['bottom', 2]]) {
    Object.defineProperty(borders, name, { get() { reads.push(name); return value; } });
  }
  const inherited = Object.create(borders);
  for (const [name, value] of [['sourceWidth', 8], ['sourceHeight', 8], ['targetWidth', 16],
    ['targetHeight', 12], ['insets', inherited]]) {
    Object.defineProperty(outer, name, { get() { reads.push(name); return value; } });
  }
  Object.defineProperty(outer, 'unused', { enumerable: true, get() { throw Error('unknown key read'); } });
  const input = new Proxy(Object.create(outer), { ownKeys() { throw Error('unknown key enumeration'); } });
  geometry(create(input), XY_A);
  assert.deepEqual(reads, ['sourceWidth', 'sourceHeight', 'targetWidth', 'targetHeight', 'insets', 'left', 'top', 'right', 'bottom']);
});

test('NS06 all primitive type checks precede ranges without coercion', () => {
  let coercions = 0;
  const boxed = { valueOf() { coercions++; throw Error('coercion'); } };
  for (const value of [boxed, '2', undefined]) {
    assert.throws(() => create(options({ sourceWidth: -1,
      insets: { left: 2, top: 2, right: 2, bottom: value } })), TypeError);
  }
  assert.equal(coercions, 0);
  assert.throws(() => create(options({ sourceWidth: -1 })), RangeError);
  geometry(create(options()), XY_A);
});

test('NS07 throwing ordered reads retain cause, stop later reads and outrank scalar ranges', () => {
  const sentinel = Error('authored getter fault'), reads = [];
  const outer = {
    get sourceWidth() { reads.push('sourceWidth'); return 8; },
    get sourceHeight() { reads.push('sourceHeight'); return 8; },
    get targetWidth() { reads.push('targetWidth'); throw sentinel; },
    get targetHeight() { reads.push('targetHeight'); throw Error('must not read'); },
    get insets() { reads.push('insets'); throw Error('must not read'); },
  };
  assert.throws(() => create(outer), error => error instanceof TypeError && error.cause === sentinel);
  assert.deepEqual(reads, ['sourceWidth', 'sourceHeight', 'targetWidth']);
  reads.length = 0;
  const borders = {
    get left() { reads.push('left'); return 2; },
    get top() { reads.push('top'); return 2; },
    get right() { reads.push('right'); throw sentinel; },
    get bottom() { reads.push('bottom'); throw Error('must not read'); },
  };
  assert.throws(() => create(options({ sourceWidth: -1, insets: borders })),
    error => error instanceof TypeError && error.cause === sentinel);
  assert.deepEqual(reads, ['left', 'top', 'right']);
  geometry(create(options()), XY_A);
});

test('NS08 descriptor reentry keeps outer staged dimensions and inner geometry independent', () => {
  const input = options();
  let inner, calls = 0;
  input.insets = {
    get left() {
      calls++;
      inner = create(options({ targetWidth: 12, targetHeight: 16 }));
      input.sourceWidth = 3;
      input.targetWidth = 1;
      return 2;
    },
    top: 2, right: 2, bottom: 2,
  };
  const outer = create(input);
  assert.equal(calls, 1);
  geometry(outer, XY_A);
  geometry(inner, XY_B);
  assert.notEqual(outer, inner);
});

test('NS09 overflow and accidental target/source-UV collapse refuse; positive Float64 edge survives', () => {
  for (const input of [
    options({ sourceWidth: Infinity }), options({ targetHeight: NaN }),
    options({ sourceWidth: Number.MAX_VALUE, targetWidth: Number.MAX_VALUE,
      insets: { left: Number.MAX_VALUE, top: 2, right: Number.MAX_VALUE, bottom: 2 } }),
    options({ targetWidth: 1152921504606846976 }),
    options({ sourceWidth: 1152921504606846976 }),
    options({ sourceWidth: Number.MAX_VALUE,
      insets: { left: Number.MIN_VALUE, top: 2, right: 0, bottom: 2 } }),
  ]) assert.throws(() => create(input), RangeError);
  const precise = create(options({ targetWidth: 16.000000000000004 }));
  geometry(precise, [
    0, 0, 2, 0, 14.000000000000004, 0, 16.000000000000004, 0,
    0, 2, 2, 2, 14.000000000000004, 2, 16.000000000000004, 2,
    0, 10, 2, 10, 14.000000000000004, 10, 16.000000000000004, 10,
    0, 12, 2, 12, 14.000000000000004, 12, 16.000000000000004, 12,
  ]);
  assert.notEqual(precise.positions[6], 16, 'CPU geometry must not silently round to Float32');
});

test('NS10 real Mesh resize preserves saved geometry/frame, painter order, clip and borrowed lifetimes', async () => {
  const f = await oldFixture();
  let first, second, a, b;
  try {
    a = create(options());
    b = create(options({ targetWidth: 12, targetHeight: 16 }));
    const parent = f.attach(new egret.Sprite());
    parent.x = 10; parent.y = 20; parent.scaleX = 2; parent.scaleY = 3; parent.alpha = 0.5;
    parent.clipRect = { x: 0, y: 0, width: 30, height: 40 };
    parent.graphics.beginFill(0x112233).drawRect(0, 0, 2, 3);
    parent.addChild(f.node);
    f.node.x = 1; f.node.y = 2; f.node.alpha = 0.5;
    f.node.clipRect = { x: 0, y: 0, width: 16, height: 12 };
    f.node.setContent(f.lease, a);
    const after = f.attach(new egret.Sprite(), parent);
    after.graphics.beginFill(0x445566).drawRect(1, 1, 2, 2);
    first = f.engine.captureTexturedFrame(FRAME);
    assert.equal(first.frameId, 1);
    assert.deepEqual(first.commands.map(value => value.kind), ['rect', 'mesh', 'rect']);
    assert.equal(first.geometries[0], a);
    assert.equal(first.images[0], f.image);
    assert.deepEqual(first.commands[1], {
      kind: 'mesh', matrix: { a: 2, b: 0, c: 0, d: 3, tx: 12, ty: 26 }, alpha: 0.25,
      clips: [
        { matrix: { a: 2, b: 0, c: 0, d: 3, tx: 10, ty: 20 }, rect: { x: 0, y: 0, width: 30, height: 40 } },
        { matrix: { a: 2, b: 0, c: 0, d: 3, tx: 12, ty: 26 }, rect: { x: 0, y: 0, width: 16, height: 12 } },
      ], imageIndex: 0, sourceRect: CROP, geometryIndex: 0,
    });
    f.node.setContent(f.lease, b);
    f.node.clipRect = { x: 0, y: 0, width: 12, height: 16 };
    parent.setChildIndex(after, 0);
    second = f.engine.captureTexturedFrame(FRAME);
    assert.equal(second.frameId, 2);
    assert.deepEqual(second.commands.map(value => value.kind), ['rect', 'rect', 'mesh']);
    assert.equal(second.images[0], f.image);
    assert.equal(second.geometries[0], b);
    assert.equal(second.commands[2].geometryIndex, 0);
    assert.deepEqual(second.commands[2].sourceRect, CROP);
    assert.deepEqual(second.commands[2].matrix, { a: 2, b: 0, c: 0, d: 3, tx: 12, ty: 26 });
    assert.equal(second.commands[2].alpha, 0.25);
    assert.deepEqual(second.commands[2].clips[1].rect, { x: 0, y: 0, width: 12, height: 16 });
    assert.equal(first.geometries[0], a);
    assert.deepEqual(first.commands.map(value => value.kind), ['rect', 'mesh', 'rect']);
    assert.deepEqual(first.commands[1].clips[1].rect, { x: 0, y: 0, width: 16, height: 12 });
    geometry(a, XY_A); geometry(b, XY_B);
    assert.notEqual(a, b);
    f.node.clear();
    assert.equal(f.node.geometry, undefined);
    assert.equal(f.node.textureLease, undefined);
    assert.equal(f.lease.value, f.texture);
    assert.equal(f.disposals, 0);
    f.node.dispose();
    assert.equal(f.lease.value, f.texture);
    assert.equal(f.disposals, 0);
    f.scope.dispose();
    assert.equal(f.scope.state, 'closed');
    assert.equal(parent.isDisposed, true);
    assert.equal(after.isDisposed, true);
    code(() => f.lease.value, 'ASSET_LEASE_RELEASED');
    assert.equal(f.texture.isDisposed, true);
    assert.equal(f.disposals, 1);
    // Scope retirement cannot revoke already captured immutable CPU values.
    assert.equal(first.images[0], f.image);
    assert.equal(second.images[0], f.image);
    assert.equal(first.geometries[0], a);
    assert.equal(second.geometries[0], b);
    geometry(first.geometries[0], XY_A); geometry(second.geometries[0], XY_B);
    for (const value of [first, second, first.commands, second.commands, first.geometries, second.geometries]) {
      assert.equal(Object.isFrozen(value), true);
    }
  } finally { await f.close(); }
  geometry(first.geometries[0], XY_A); geometry(second.geometries[0], XY_B);
});
