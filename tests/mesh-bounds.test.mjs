import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// Logical indexed-vertex bounds use literal authored points and real leases.
const FRAME = Object.freeze({ width: 64, height: 64 });
let id = 0;
function capability() {
  assert.equal(typeof egret.Bitmap, 'function', 'existing facade initializes');
  assert.equal(typeof egret.createTexturedGeometry2D, 'function', 'geometry prerequisite');
  assert.equal(typeof egret.Mesh2D, 'function', 'Mesh2D public capability');
  assert.equal(typeof egret.DisplayObject.prototype.getBounds, 'function', 'public bounds capability');
}
function geometry(positions = [2, 3, 6, 3, 2, 8], indices = [0, 1, 2]) {
  const n = positions.length / 2;
  return egret.createTexturedGeometry2D({ positions: new Float64Array(positions), uvs: new Float64Array(2 * n), lightColors: new Float64Array(4 * n).fill(1), indices: new Uint32Array(indices) });
}
async function fixture(positions, indices) {
  capability(); let renderCalls = 0;
  const port = host({ renderFrame() { renderCalls++; return undefined; } });
  assert.equal(Object.hasOwn(port.adapter, 'renderFrame'), true);
  const engine = await egret.createEngine({ host: port.adapter });
  try {
    const texture = egret.createTexture(egret.createImageData2D({ width: 4, height: 4, pixels: new Uint8Array(64) }), { x: 1, y: 1, width: 2, height: 2 });
    const key = ++id, type = egret.createAssetType(`mesh-bounds-${key}`, () => true);
    engine.assets.register(type, { load: async () => texture, dispose: value => value.dispose() });
    const ref = egret.createAssetRef(type, `mesh-bounds-${key}`), lease = await engine.assets.acquire(ref);
    const owned = geometry(positions, indices), node = new egret.Mesh2D(lease, owned);
    engine.stage.addChild(node);
    return { engine, texture, lease, geometry: owned, node, port, renderCalls: () => renderCalls };
  } catch (cause) {
    try { await engine.dispose(); }
    catch (cleanupCause) { throw new AggregateError([cause, cleanupCause], 'Mesh fixture construction and Engine cleanup failed'); }
    throw cause;
  }
}
function code(run, want) { assert.throws(run, error => error instanceof egret.EgretError && error.code === want); }
function rectangle(value, x, y, width, height) {
  assert.deepEqual(value, { x, y, width, height }); assert.equal(Object.isFrozen(value), true);
  for (const key of ['x', 'y', 'width', 'height']) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assert.equal(descriptor.writable, false); assert.equal(descriptor.configurable, false); assert.equal('get' in descriptor, false);
  }
  return value;
}
function near(value, literal) {
  assert.equal(Object.isFrozen(value), true);
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(value[key] - literal[key]) <= 1e-10, `${key} within predeclared trigonometric tolerance`);
}
function parentOf(f) {
  const parent = f.engine.stage.addChild(new egret.Sprite()); parent.addChild(f.node); return parent;
}

test('B01 only referenced authored vertices contribute and receiver transforms are excluded', async () => {
  capability();
  const f = await fixture([2, 3, 6, 3, 2, 8, 1e100, -1e100], [0, 1, 2]);
  try {
    const first = rectangle(f.node.getBounds(), 2, 3, 4, 5);
    f.node.x = Number.MAX_VALUE; f.node.y = -Number.MAX_VALUE;
    f.node.scaleX = 0; f.node.scaleY = 0; f.node.rotation = 45;
    rectangle(f.node.getBounds(), 2, 3, 4, 5);
    f.node.x = 0; f.node.y = 0; f.node.rotation = 0; f.node.scaleY = 1; f.node.scaleX = 2 ** 700;
    const parent = parentOf(f);
    // Referenced integer products are exact powers of two. An unused extreme
    // vertex would overflow under this finite descendant matrix if scanned.
    rectangle(parent.getBounds(), 2 ** 701, 3, 2 ** 702, 5);
    rectangle(first, 2, 3, 4, 5);
  } finally { await f.engine.dispose(); }
});

test('B02 authored point, line, repeated-index and collinear triangles retain bounds', async () => {
  capability();
  const f = await fixture([4, 7, 9, 7, 4, 12], [0, 0, 0]);
  try {
    rectangle(f.node.getBounds(), 4, 7, 0, 0);
    f.node.setContent(f.lease, geometry([4, 7, 9, 7, 4, 12], [0, 1, 1]));
    rectangle(f.node.getBounds(), 4, 7, 5, 0);
    f.node.setContent(f.lease, geometry([0, 0, 1, 1, 3, 3]));
    rectangle(f.node.getBounds(), 0, 0, 3, 3);
    const h = 2 ** -34;
    f.node.setContent(f.lease, geometry([0, 0, h, h, 3 * h, 3 * h])); f.node.x = 2 ** 19;
    const parent = parentOf(f);
    rectangle(parent.getBounds(), 2 ** 19, 0, 4 * h, 3 * h);
  } finally { await f.engine.dispose(); }
});

test('B03 direct descendant transforms, cached retirement and saved rectangle ownership', async () => {
  capability();
  const f = await fixture();
  try {
    const parent = parentOf(f);
    f.node.x = 10; f.node.y = -3; f.node.scaleX = -2; f.node.scaleY = 3;
    const saved = rectangle(parent.getBounds(), -2, 6, 8, 15);
    f.node.visible = false; f.node.alpha = 0; f.node.clipRect = { x: 0, y: 0, width: 0, height: 0 };
    parent.visible = false; parent.alpha = 0; parent.clipRect = { x: 0, y: 0, width: 0, height: 0 };
    rectangle(parent.getBounds(), -2, 6, 8, 15);
    const before = f.engine.captureFrame(FRAME);
    for (let index = 0; index < 3; index++) rectangle(parent.getBounds(), -2, 6, 8, 15);
    const after = f.engine.captureFrame(FRAME);
    assert.equal(before.frameId, 1); assert.equal(after.frameId, 2); assert.equal(f.renderCalls(), 0);
    f.texture.dispose(); rectangle(parent.getBounds(), -2, 6, 8, 15);
    f.lease.release(); rectangle(parent.getBounds(), -2, 6, 8, 15);
    f.node.clear(); rectangle(f.node.getBounds(), 0, 0, 0, 0); rectangle(parent.getBounds(), 0, 0, 0, 0);
    f.node.dispose(); code(() => f.node.getBounds(), 'OBJECT_DISPOSED');
    rectangle(saved, -2, 6, 8, 15);
    await f.engine.dispose(); rectangle(saved, -2, 6, 8, 15);
    assert.throws(() => { saved.width = 99; }, TypeError);
  } finally { await f.engine.dispose(); }
  const rotated = await fixture([0, 0, 2, 0, 0, 1]);
  try {
    const parent = parentOf(rotated); parent.rotation = 45; rotated.node.rotation = -45;
    near(rotated.engine.stage.getBounds(), { x: 0, y: 0, width: 2, height: 1 });
  } finally { await rotated.engine.dispose(); }
});

test('B04 triangle quota precedes later affine failure and shares authored primitive budget', async () => {
  capability();
  const f = await fixture([1, 2, 3, 2, 1, 4, Number.MAX_VALUE, 0, Number.MAX_VALUE, 1, 0, 1], [0, 1, 2, 3, 4, 5]);
  try {
    const parent = parentOf(f); f.node.scaleX = 2;
    // Immutable authentic indices expose no public read hook. This combined
    // fault pins quota versus arithmetic priority; source review pins indexing.
    code(() => parent.getBounds({ maxPrimitives: 1, maxNodes: 2 }), 'BOUNDS_CONTENT_LIMIT');
    code(() => parent.getBounds({ maxPrimitives: 2, maxNodes: 2 }), 'BOUNDS_ARITHMETIC_RANGE');
    f.node.setContent(f.lease, geometry([], []));
    rectangle(parent.getBounds({ maxPrimitives: 1, maxNodes: 2 }), 0, 0, 0, 0);
    f.node.setContent(f.lease, geometry([4, 7, 9, 7, 4, 12], [0, 0, 0]));
    rectangle(parent.getBounds({ maxPrimitives: 1, maxNodes: 2 }), 8, 7, 0, 0);
    f.node.scaleX = 1; f.node.setContent(f.lease, f.geometry);
    parent.graphics.beginFill(0x123456).drawRect(0, 0, 1, 1);
    code(() => parent.getBounds({ maxPrimitives: 1 }), 'BOUNDS_CONTENT_LIMIT');
    // Replace the intentionally overflowing two-triangle fixture first.
    f.node.setContent(f.lease, geometry());
    rectangle(parent.getBounds({ maxPrimitives: 2 }), 0, 0, 6, 8);
    f.node.clear(); rectangle(parent.getBounds({ maxPrimitives: 1 }), 0, 0, 1, 1);
    rectangle(parent.getBounds({ maxPrimitives: 262144 }), 0, 0, 1, 1);
    code(() => parent.getBounds({ maxPrimitives: 262145 }), 'BOUNDS_INPUT_INVALID');
  } finally { await f.engine.dispose(); }
});

test('B05 shared geometry still charges every triangle occurrence, with exact node and lifetime caps', async () => {
  capability();
  const f = await fixture();
  try {
    const indices = new Uint32Array(196608);
    for (let offset = 0; offset < 196608; offset += 3) indices.set([0, 1, 2], offset);
    const large = geometry([2, 3, 6, 3, 2, 8], indices);
    assert.equal(large.triangleCount, 65536);
    f.node.setContent(f.lease, large);
    rectangle(f.node.getBounds(), 2, 3, 4, 5);
    const parent = parentOf(f), second = parent.addChild(new egret.Mesh2D(f.lease, large));
    assert.equal(second.geometry, f.node.geometry);
    code(() => parent.getBounds(), 'BOUNDS_CONTENT_LIMIT');
    code(() => parent.getBounds({ maxPrimitives: 131071 }), 'BOUNDS_CONTENT_LIMIT');
    rectangle(parent.getBounds({ maxPrimitives: 131072 }), 2, 3, 4, 5);
    rectangle(parent.getBounds({ maxPrimitives: 262144 }), 2, 3, 4, 5);
    const third = parent.addChild(new egret.Mesh2D(f.lease, large)), fourth = parent.addChild(new egret.Mesh2D(f.lease, large));
    rectangle(parent.getBounds({ maxPrimitives: 262144 }), 2, 3, 4, 5);
    const fifth = parent.addChild(new egret.Mesh2D(f.lease, large));
    code(() => parent.getBounds({ maxPrimitives: 262144 }), 'BOUNDS_CONTENT_LIMIT');
    for (const extra of [second, third, fourth, fifth]) extra.dispose();
    const positions = new Float64Array(131072); positions.set([2, 3, 6, 3, 2, 8]);
    const sparse = egret.createTexturedGeometry2D({ positions, uvs: new Float64Array(131072), lightColors: new Float64Array(262144).fill(1), indices: new Uint32Array([0, 1, 2]) });
    assert.equal(sparse.vertexCount, 65536); assert.equal(sparse.triangleCount, 1);
    f.node.setContent(f.lease, sparse);
    rectangle(parent.getBounds({ maxPrimitives: 1, maxNodes: 2 }), 2, 3, 4, 5);
    code(() => parent.getBounds({ maxNodes: 1 }), 'BOUNDS_TREE_LIMIT');
    f.node.visible = false;
    rectangle(parent.getBounds({ maxNodes: 2, maxPrimitives: 1 }), 2, 3, 4, 5);
    f.node.setContent(f.lease, geometry([], []));
    code(() => parent.getBounds({ maxNodes: 1 }), 'BOUNDS_TREE_LIMIT');
    rectangle(parent.getBounds({ maxNodes: 2, maxPrimitives: 1 }), 0, 0, 0, 0);
    parent.removeChild(f.node); assert.equal(f.node.isDisposed, false);
    await f.engine.dispose(); assert.equal(f.node.isDisposed, false);
    code(() => f.node.getBounds(), 'ENGINE_CLOSED');
    f.node.dispose(); code(() => f.node.getBounds(), 'OBJECT_DISPOSED');
  } finally { await f.engine.dispose(); }
});
