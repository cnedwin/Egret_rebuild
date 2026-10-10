import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// Public borrowed-content transactions use actual manager-issued leases.
// Expected identities and error priorities come from independent fixtures.
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
  const key = ++id, type = egret.createAssetType(`mesh-literal-${key}`, () => true);
  engine.assets.register(type, { load: async () => value, dispose });
  const ref = egret.createAssetRef(type, `mesh-${key}`);
  return { ref, lease: await engine.assets.acquire(ref) };
}
function texture() {
  return egret.createTexture(egret.createImageData2D({ width: 4, height: 4, pixels: new Uint8Array(64) }), { x: 1, y: 1, width: 2, height: 2 });
}
async function fixture(positions, indices) {
  capability();
  const engine = await egret.createEngine({ host: host().adapter });
  try {
    const value = texture(); let disposals = 0;
    const borrowed = await acquire(engine, value, () => { disposals++; value.dispose(); });
    const owned = geometry(positions, indices), node = new egret.Mesh2D(borrowed.lease, owned);
    engine.stage.addChild(node);
    return { engine, texture: value, node, geometry: owned, ...borrowed, disposals: () => disposals };
  } catch (cause) {
    try { await engine.dispose(); }
    catch (cleanupCause) { throw new AggregateError([cause, cleanupCause], 'Mesh fixture construction and Engine cleanup failed'); }
    throw cause;
  }
}
function code(run, want) {
  assert.throws(run, error => error instanceof egret.EgretError && error.code === want);
}
function slot(node, lease, owned) {
  assert.equal(node.textureLease, lease); assert.equal(node.geometry, owned);
}
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

test('D01 exact getter-only Mesh leaf and authentic occupied-empty content', async () => {
  capability();
  assert.equal(egret.Mesh2D.prototype instanceof egret.DisplayObject, true);
  assert.deepEqual(Object.getOwnPropertyNames(egret.Mesh2D.prototype).sort(), ['clear', 'constructor', 'dispose', 'geometry', 'setContent', 'textureLease']);
  for (const name of ['geometry', 'textureLease']) {
    const descriptor = Object.getOwnPropertyDescriptor(egret.Mesh2D.prototype, name);
    assert.equal(typeof descriptor.get, 'function'); assert.equal(descriptor.set, undefined);
  }
  const f = await fixture();
  try {
    slot(f.node, f.lease, f.geometry);
    const zero = geometry([], []), emptyNode = new egret.Mesh2D(f.lease, zero);
    slot(emptyNode, f.lease, zero);
    assert.equal(zero.vertexCount, 0); assert.equal(zero.triangleCount, 0);
    emptyNode.clear(); slot(emptyNode, undefined, undefined); emptyNode.dispose();
    assert.equal(f.lease.value, f.texture);
  } finally { await f.engine.dispose(); }
});

test('D02 geometry authentication precedes every structural or retired lease read', async () => {
  capability();
  const f = await fixture();
  try {
    let reads = 0;
    const proxy = new Proxy(f.geometry, {
      get() { reads++; throw Error('geometry read'); }, ownKeys() { reads++; throw Error('geometry keys'); }, getPrototypeOf() { reads++; throw Error('geometry prototype'); },
    });
    const revoked = Proxy.revocable(f.geometry, {}); revoked.revoke();
    const structural = { get value() { reads++; throw Error('lease value'); } };
    const retired = await f.engine.assets.acquire(f.ref); retired.release();
    for (const invalid of [null, {}, Object.create(Object.getPrototypeOf(f.geometry)), proxy, revoked.proxy]) {
      for (const lease of [f.lease, structural, retired]) code(() => new egret.Mesh2D(lease, invalid), 'MESH_GEOMETRY_INVALID');
    }
    assert.equal(reads, 0); slot(f.node, f.lease, f.geometry);
  } finally { await f.engine.dispose(); }
});

test('D03 exact resource errors and private authority despite hostile public getters', async () => {
  capability();
  const f = await fixture();
  try {
    let reads = 0;
    const proxy = new Proxy(f.lease, { get() { reads++; throw Error('lease proxy read'); }, getPrototypeOf() { reads++; throw Error('lease proxy prototype'); } });
    for (const invalid of [{}, proxy]) code(() => new egret.Mesh2D(invalid, f.geometry), 'MESH_LEASE_INVALID');
    const wrong = await acquire(f.engine, {});
    code(() => new egret.Mesh2D(wrong.lease, f.geometry), 'MESH_TEXTURE_INVALID');
    const released = await f.engine.assets.acquire(f.ref); released.release();
    code(() => new egret.Mesh2D(released, f.geometry), 'ASSET_LEASE_RELEASED');
    const dead = texture(), retired = await acquire(f.engine, dead); dead.dispose();
    code(() => new egret.Mesh2D(retired.lease, f.geometry), 'TEXTURE_DISPOSED');
    const restoreTexture = poison(f.texture, ['imageData', 'sourceRect', 'width', 'height', 'isDisposed'], () => reads++);
    try {
      const restoreLease = poison(egret.AssetLease.prototype, ['value'], () => reads++);
      try {
        const node = new egret.Mesh2D(f.lease, f.geometry);
        slot(node, f.lease, f.geometry); node.setContent(f.lease, f.geometry);
        slot(node, f.lease, f.geometry); node.dispose();
      } finally { restoreLease(); }
    } finally { restoreTexture(); }
    assert.equal(reads, 0); assert.equal(f.lease.value, f.texture);
  } finally { await f.engine.dispose(); }
});

test('D04 receiver, lifecycle and affinity priorities preserve the complete prior slot', async () => {
  capability();
  const f = await fixture(); let foreign;
  try {
    foreign = await fixture();
    let reads = 0;
    const invalidInput = new Proxy({}, { get() { reads++; throw Error('input read'); } });
    const invalidReceivers = [{}, null, Object.create(egret.Mesh2D.prototype), new Proxy(f.node, {})];
    for (const receiver of invalidReceivers) {
      for (const name of ['geometry', 'textureLease']) {
        const get = Object.getOwnPropertyDescriptor(egret.Mesh2D.prototype, name).get;
        code(() => Reflect.apply(get, receiver, []), 'MESH_INVALID');
      }
      code(() => Reflect.apply(egret.Mesh2D.prototype.setContent, receiver, [invalidInput, invalidInput]), 'MESH_INVALID');
      code(() => Reflect.apply(egret.Mesh2D.prototype.clear, receiver, []), 'MESH_INVALID');
      code(() => Reflect.apply(egret.Mesh2D.prototype.dispose, receiver, []), 'MESH_INVALID');
    }
    assert.equal(reads, 0);
    const wrong = await acquire(f.engine, {});
    const dead = texture(), disposed = await acquire(f.engine, dead); dead.dispose();
    const released = await f.engine.assets.acquire(f.ref); released.release();
    function fails(lease, owned, want) { code(() => f.node.setContent(lease, owned), want); slot(f.node, f.lease, f.geometry); }
    fails({}, {}, 'MESH_GEOMETRY_INVALID');
    fails({}, f.geometry, 'MESH_LEASE_INVALID');
    fails(foreign.lease, {}, 'MESH_GEOMETRY_INVALID');
    fails(foreign.lease, f.geometry, 'ENGINE_MISMATCH');
    foreign.texture.dispose(); fails(foreign.lease, f.geometry, 'ENGINE_MISMATCH');
    foreign.lease.release(); fails(foreign.lease, f.geometry, 'ENGINE_MISMATCH');
    fails(released, f.geometry, 'ASSET_LEASE_RELEASED');
    fails(wrong.lease, f.geometry, 'MESH_TEXTURE_INVALID');
    fails(disposed.lease, f.geometry, 'TEXTURE_DISPOSED');
    f.node.clear(); slot(f.node, undefined, undefined);
    code(() => foreign.engine.stage.addChild(f.node), 'ENGINE_MISMATCH');
    assert.equal(f.node.parent, f.engine.stage);
    code(() => f.node.setContent(foreign.lease, f.geometry), 'ENGINE_MISMATCH');
    slot(f.node, undefined, undefined);
    f.node.setContent(f.lease, f.geometry);
    f.engine.stage.removeChild(f.node); assert.equal(f.node.isDisposed, false);
    await f.engine.dispose(); assert.equal(f.node.isDisposed, false);
    code(() => f.node.setContent({}, {}), 'ENGINE_CLOSED');
    code(() => f.node.clear(), 'ENGINE_CLOSED'); slot(f.node, f.lease, f.geometry);
    f.node.dispose(); slot(f.node, undefined, undefined);
    code(() => f.node.setContent({}, {}), 'OBJECT_DISPOSED');
    code(() => f.node.clear(), 'OBJECT_DISPOSED'); f.node.dispose();
  } finally {
    try { if (foreign) await foreign.engine.dispose(); }
    finally { await f.engine.dispose(); }
  }
});

test('D05 replacement, clear and dispose preserve independent same-entry caller borrows', async () => {
  capability();
  const f = await fixture();
  try {
    const a = f.lease, b = await f.engine.assets.acquire(f.ref);
    assert.notEqual(a, b); assert.equal(a.value, f.texture); assert.equal(b.value, f.texture); assert.equal(f.disposals(), 0);
    const replacement = geometry([10, 20, 12, 20, 10, 22]);
    f.node.setContent(b, replacement); slot(f.node, b, replacement);
    assert.equal(a.value, f.texture); assert.equal(b.value, f.texture); assert.equal(f.disposals(), 0);
    a.release(); code(() => a.value, 'ASSET_LEASE_RELEASED'); assert.equal(b.value, f.texture); assert.equal(f.disposals(), 0);
    f.node.clear(); f.node.clear(); slot(f.node, undefined, undefined);
    assert.equal(b.value, f.texture); assert.equal(f.disposals(), 0);
    f.node.setContent(b, replacement); f.node.dispose(); f.node.dispose(); slot(f.node, undefined, undefined);
    assert.equal(b.value, f.texture); assert.equal(f.disposals(), 0);
    b.release(); assert.equal(f.disposals(), 1);
  } finally { await f.engine.dispose(); }
  const retired = await fixture();
  try {
    retired.lease.release(); code(() => retired.lease.value, 'ASSET_LEASE_RELEASED');
    retired.node.clear(); slot(retired.node, undefined, undefined);
    assert.equal(retired.node.isDisposed, false); assert.equal(retired.disposals(), 1);
  } finally { await retired.engine.dispose(); }
});

test('D06 disposal clears before base cleanup and terminal reentry keeps the caller lease', async () => {
  capability();
  const f = await fixture();
  try {
    const sentinel = Object.freeze({ cleanupFailure: true }); let calls = 0;
    const geometryGet = Object.getOwnPropertyDescriptor(egret.Mesh2D.prototype, 'geometry').get;
    const leaseGet = Object.getOwnPropertyDescriptor(egret.Mesh2D.prototype, 'textureLease').get;
    class Observed extends egret.Mesh2D {
      clearListeners() {
        calls++;
        assert.equal(Reflect.apply(geometryGet, this, []), undefined);
        assert.equal(Reflect.apply(leaseGet, this, []), undefined);
        this.dispose();
        code(() => this.setContent(f.lease, f.geometry), 'OBJECT_DISPOSED');
        code(() => this.clear(), 'OBJECT_DISPOSED');
        throw sentinel;
      }
    }
    const node = new Observed(f.lease, f.geometry);
    assert.throws(() => node.dispose(), error => error === sentinel);
    assert.equal(node.isDisposed, true); slot(node, undefined, undefined);
    node.dispose(); assert.equal(calls, 1);
    assert.equal(f.lease.value, f.texture); assert.equal(f.disposals(), 0);
    assert.equal(egret.isTexturedGeometry2D(f.geometry), true);
    for (const value of [f.geometry, f.geometry.positions, f.geometry.uvs, f.geometry.lightColors, f.geometry.indices]) assert.equal(Object.isFrozen(value), true);
    assert.deepEqual(f.geometry.positions, [2, 3, 6, 3, 2, 8]);
  } finally { await f.engine.dispose(); }
});
