import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// First-party Apache-2.0 test candidate. Root adopts this file into R/tests.
// Expected capture values are literal, independently authored CPU oracles.
// No private product import, capture helper, instrumented counter or state forgery.
const FRAME = Object.freeze({ width: 64, height: 48 });
const IDENTITY = Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
const A_PIXELS = Object.freeze([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 128]);
const B_PIXELS = Object.freeze([11, 12, 13, 255, 21, 22, 23, 255, 31, 32, 33, 255, 41, 42, 43, 255]);
let assetId = 0;

function prerequisiteFacade() {
  for (const name of ['createEngine', 'Engine', 'AssetManager', 'AssetLease', 'Bitmap', 'Mesh2D', 'Sprite', 'createAssetType', 'createAssetRef', 'createTexture', 'createImageData2D', 'createTexturedGeometry2D', 'isTexturedGeometry2D']) {
    assert.equal(typeof egret[name], 'function', 'existing public prerequisite: ' + name);
  }
}

function ownedGeometry(positions = [0, 0, 1, 0, 0, 1], indices = [0, 1, 2], uvs, lightColors) {
  const vertices = positions.length / 2;
  const input = {
    positions: new Float64Array(positions),
    uvs: new Float64Array(uvs ?? new Array(vertices * 2).fill(0)),
    lightColors: new Float64Array(lightColors ?? new Array(vertices * 4).fill(1)),
    indices: new Uint32Array(indices),
  };
  return { input, geometry: egret.createTexturedGeometry2D(input) };
}

// These are authored public factory inputs, never generated product modules.
// Only vertices 0,1,2 are referenced. All remaining vertices are valid at admission.
function capacityGeometry(vertexCount, triangleCount, { unusedExtreme = false } = {}) {
  const positions = new Float64Array(vertexCount * 2);
  const uvs = new Float64Array(vertexCount * 2);
  const lightColors = new Float64Array(vertexCount * 4).fill(1);
  const indices = new Uint32Array(triangleCount * 3);
  if (vertexCount !== 0) positions.set([0, 0, 1, 0, 0, 1]);
  if (unusedExtreme) positions[positions.length - 2] = Number.MAX_VALUE;
  for (let i = 0; i < indices.length; i += 3) indices.set([0, 1, 2], i);
  return egret.createTexturedGeometry2D({ positions, uvs, lightColors, indices });
}

async function fixture() {
  prerequisiteFacade();
  const diagnostics = [];
  const port = host();
  const engine = await egret.createEngine({ host: port.adapter, onDiagnostic: record => diagnostics.push(record) });
  const nodes = [], resources = [];
  const f = {
    engine, diagnostics, nodes, resources,
    attach(node, parent = engine.stage) { nodes.push(node); parent.addChild(node); return node; },
    sprite(parent = engine.stage) { return f.attach(new egret.Sprite(), parent); },
    mesh(resource, geometry, parent = engine.stage) { return f.attach(new egret.Mesh2D(resource.lease, geometry), parent); },
    bitmap(resource, parent = engine.stage) { return f.attach(new egret.Bitmap(resource.lease), parent); },
    async resource(pixels = A_PIXELS, region) {
      const input = new Uint8Array(pixels);
      const image = egret.createImageData2D({ width: 2, height: 2, pixels: input });
      const texture = egret.createTexture(image, region);
      const item = { input, image, texture, lease: undefined, ref: undefined };
      resources.push(item);
      const key = 'textured-capture-' + (++assetId);
      const type = egret.createAssetType(key, egret.isTexture);
      engine.assets.register(type, { load: async () => texture, dispose: value => value.dispose() });
      item.ref = egret.createAssetRef(type, key);
      item.lease = await engine.assets.acquire(item.ref);
      return item;
    },
    async close() {
      const failures = [];
      // Authoring tracks parents before children. Reverse order avoids recursive
      // cleanup of the 1,200-deep fixture and removes large flat children from tail.
      for (let i = nodes.length - 1; i >= 0; i--) {
        try { nodes[i].dispose(); } catch (cause) { failures.push(cause); }
      }
      for (const item of resources) {
        try { item.lease?.release(); } catch (cause) { failures.push(cause); }
      }
      try { await engine.dispose(); } catch (cause) { failures.push(cause); }
      for (const item of resources) {
        try { item.texture.dispose(); } catch (cause) { failures.push(cause); }
      }
      if (failures.length) throw new AggregateError(failures, 'textured capture fixture cleanup failed');
    },
  };
  return f;
}

async function withFixture(run) {
  const f = await fixture();
  try { return await run(f); } finally { await f.close(); }
}

function capture(f) { return f.engine.captureTexturedFrame(FRAME); }
function code(run, expected) {
  assert.throws(run, error => error instanceof egret.EgretError && error.code === expected, 'exact fault: ' + expected);
}
function noRendererFault(f) {
  assert.equal(f.diagnostics.some(record => record.code === 'FRAME_RENDER_FAILED'), false);
}
function emptyFrame(frame, frameId = 1) {
  assert.deepEqual(frame, {
    profile: 'egret.textured-frame2d/1', frameId, width: 64, height: 48,
    clearColor: 0, clearAlpha: 0, commands: [], images: [], geometries: [],
  });
  for (const value of [frame, frame.commands, frame.images, frame.geometries]) assert.equal(Object.isFrozen(value), true);
}
function frozenFrame(frame) {
  for (const value of [frame, frame.commands, frame.images, frame.geometries, ...frame.images, ...frame.geometries]) assert.equal(Object.isFrozen(value), true);
  for (const geometry of frame.geometries) {
    for (const value of [geometry.positions, geometry.uvs, geometry.lightColors, geometry.indices]) assert.equal(Object.isFrozen(value), true);
  }
  for (const command of frame.commands) {
    for (const value of [command, command.matrix, command.clips, command.rect, command.sourceRect].filter(value => value !== undefined)) assert.equal(Object.isFrozen(value), true);
    for (const clip of command.clips) {
      for (const value of [clip, clip.matrix, clip.rect]) assert.equal(Object.isFrozen(value), true);
    }
  }
}
function rectangles(node, count, { width = 1, alpha = 1 } = {}) {
  node.graphics.beginFill(0x112233, alpha);
  for (let i = 0; i < count; i++) node.graphics.drawRect(5, 6, width, 1);
}
function fourClips(f) {
  const outer = f.sprite(); outer.clipRect = { x: 1, y: 2, width: 10, height: 11 };
  const second = f.sprite(outer); second.clipRect = { x: 2, y: 3, width: 9, height: 10 };
  const third = f.sprite(second); third.clipRect = { x: 3, y: 4, width: 8, height: 9 };
  const fourth = f.sprite(third); fourth.clipRect = { x: 4, y: 5, width: 7, height: 8 };
  return fourth;
}

test('C01 default Engine captures frozen clear-only textured frame', async () => {
  await withFixture(async f => {
    // C01 setup proves accepted existing public geometry/Mesh/resource authority
    // before the one required missing-method assertion. No prior frame ID is used.
    assert.equal(f.engine instanceof egret.Engine, true);
    assert.equal(f.engine.assets instanceof egret.AssetManager, true);
    const r = await f.resource();
    assert.equal(r.lease instanceof egret.AssetLease, true);
    assert.equal(r.lease.value, r.texture);
    const g = ownedGeometry().geometry;
    assert.equal(egret.isTexturedGeometry2D(g), true);
    assert.deepEqual(g.positions, [0, 0, 1, 0, 0, 1]);
    const mesh = f.mesh(r, g);
    assert.equal(mesh.geometry, g); assert.equal(mesh.textureLease, r.lease);
    assert.equal(f.engine.stage.getChildAt(0), mesh);
    mesh.clear(); assert.equal(mesh.geometry, undefined); assert.equal(mesh.textureLease, undefined);
    assert.equal(typeof f.engine.captureTexturedFrame, 'function', 'C01 missing captureTexturedFrame');
    assert.equal(egret.TEXTURED_FRAME_PROFILE_2D, 'egret.textured-frame2d/1');
    assert.equal(f.engine.texturedFrameProfile, undefined);
    emptyFrame(capture(f)); noRendererFault(f);
  });
});

test('C02 painter/tables/empty preserves literal order and first-emission identity tables', async t => {
  await t.test('C02_PAINTER_TABLES', async () => withFixture(async f => {
    const a = await f.resource(A_PIXELS), b = await f.resource(B_PIXELS, { x: 1, y: 0, width: 1, height: 2 });
    const h = await f.resource([91, 92, 93, 255, 91, 92, 93, 255, 91, 92, 93, 255, 91, 92, 93, 255]);
    const g1 = ownedGeometry([0, 0, 2, 0, 0, 2]).geometry;
    const g2 = ownedGeometry([0, 0, 3, 0, 0, 3], [2, 1, 0]).geometry;
    const hidden = f.mesh(h, ownedGeometry().geometry); hidden.visible = false; h.lease.release();
    const rect = f.sprite(); rect.graphics.beginFill(0xabcdef).drawRect(10, 20, 2, 3);
    f.bitmap(a); f.mesh(b, g1); f.bitmap(a); f.mesh(b, g2); f.mesh(b, g1);
    const frame = capture(f);
    assert.deepEqual(frame.commands.map(command => command.kind), ['rect', 'image', 'mesh', 'image', 'mesh', 'mesh']);
    assert.deepEqual(frame.images, [a.image, b.image]);
    assert.equal(frame.images[0], a.image); assert.equal(frame.images[1], b.image);
    assert.deepEqual(frame.geometries, [g1, g2]);
    assert.equal(frame.geometries[0], g1); assert.equal(frame.geometries[1], g2);
    assert.deepEqual(frame.commands.filter(command => command.kind === 'mesh').map(command => command.geometryIndex), [0, 1, 0]);
    assert.deepEqual(frame.commands.slice(1).map(command => command.imageIndex), [0, 1, 0, 1, 1]);
    assert.deepEqual(frame.commands[0].rect, { x: 10, y: 20, width: 2, height: 3 });
    assert.deepEqual(frame.commands[2].sourceRect, { x: 1, y: 0, width: 1, height: 2 });
    assert.equal(frame.images.includes(h.image), false); frozenFrame(frame); noRendererFault(f);
    const empty = ownedGeometry([], []).geometry; f.mesh(b, empty);
    const next = capture(f);
    assert.deepEqual(next.commands.map(command => command.kind), ['rect', 'image', 'mesh', 'image', 'mesh', 'mesh', 'mesh']);
    assert.deepEqual(next.geometries, [g1, g2, empty]);
    assert.equal(next.commands[6].geometryIndex, 2); assert.equal(next.commands[6].imageIndex, 1);
    assert.equal(next.geometries[2], empty); assert.equal(empty.triangleCount, 0); frozenFrame(next);
  }));
});

test('C03 hidden/zero skips retired entitlement and overflowing descendants before compose', async t => {
  for (const scenario of ['INVISIBLE', 'OWN_ZERO', 'ROUNDED_ZERO']) {
    await t.test('C03_SUPPRESSED_' + scenario, async () => withFixture(async f => {
      const r = await f.resource(), parent = f.sprite();
      const mesh = f.mesh(r, ownedGeometry().geometry, parent);
      parent.scaleX = Number.MAX_VALUE; mesh.scaleX = 2;
      if (scenario === 'INVISIBLE') parent.visible = false;
      if (scenario === 'OWN_ZERO') parent.alpha = 0;
      if (scenario === 'ROUNDED_ZERO') { parent.alpha = Number.MIN_VALUE; mesh.alpha = 0.5; }
      r.lease.release(); emptyFrame(capture(f)); noRendererFault(f);
    }));
  }
  await t.test('C03_VISIBLE_RETIRED', async () => withFixture(async f => {
    const r = await f.resource(); f.mesh(r, ownedGeometry().geometry); r.lease.release();
    code(() => capture(f), 'ASSET_LEASE_RELEASED'); noRendererFault(f);
  }));
  await t.test('C03_VISIBLE_TRANSFORM_OVERFLOW', async () => withFixture(async f => {
    const r = await f.resource(), parent = f.sprite(); parent.scaleX = Number.MAX_VALUE;
    const mesh = f.mesh(r, ownedGeometry().geometry, parent); mesh.scaleX = 2;
    code(() => capture(f), 'FRAME_TRANSFORM_INVALID'); noRendererFault(f);
  }));
});

test('C04 clips/outside validates own clip arithmetic and never raster-suppresses visible Mesh', async t => {
  await t.test('C04_ZERO_ANCESTOR_CLIP', async () => withFixture(async f => {
    const r = await f.resource(), parent = f.sprite();
    parent.clipRect = { x: 0, y: 0, width: 0, height: 1 }; parent.scaleX = Number.MAX_VALUE;
    const mesh = f.mesh(r, ownedGeometry().geometry, parent); mesh.scaleX = 2;
    r.lease.release(); emptyFrame(capture(f)); noRendererFault(f);
  }));
  for (const scenario of ['RECT_SUM', 'AFFINE']) {
    await t.test('C04_OWN_CLIP_OVERFLOW_BEFORE_ZERO_' + scenario, async () => withFixture(async f => {
      const r = await f.resource(), parent = f.sprite(); f.mesh(r, ownedGeometry().geometry, parent);
      if (scenario === 'RECT_SUM') parent.clipRect = { x: Number.MAX_VALUE, y: 0, width: Number.MAX_VALUE, height: 0 };
      else { parent.scaleX = 2; parent.clipRect = { x: Number.MAX_VALUE, y: 0, width: 0, height: 1 }; }
      r.lease.release(); code(() => capture(f), 'FRAME_TRANSFORM_INVALID'); noRendererFault(f);
    }));
  }
  await t.test('C04_OUTSIDE_RETIRED', async () => withFixture(async f => {
    const r = await f.resource(), mesh = f.mesh(r, ownedGeometry().geometry); mesh.x = 10000;
    r.lease.release(); code(() => capture(f), 'ASSET_LEASE_RELEASED'); noRendererFault(f);
  }));
  await t.test('C04_OUTSIDE_REFERENCED_OVERFLOW', async () => withFixture(async f => {
    const r = await f.resource(), g = ownedGeometry([Number.MAX_VALUE, 0, 1, 0, 0, 1]).geometry;
    const mesh = f.mesh(r, g); mesh.x = 10000; mesh.scaleX = 2;
    code(() => capture(f), 'FRAME_TRANSFORM_INVALID'); noRendererFault(f);
  }));
  for (const scenario of ['FINITE_OUTSIDE', 'SINGULAR', 'AUTHORED_COLLINEAR']) {
    await t.test('C04_EMITS_' + scenario, async () => withFixture(async f => {
      const r = await f.resource();
      const g = ownedGeometry(scenario === 'AUTHORED_COLLINEAR' ? [0, 0, 1, 1, 2, 2] : [0, 0, 1, 0, 0, 1]).geometry;
      const mesh = f.mesh(r, g);
      if (scenario === 'FINITE_OUTSIDE') mesh.x = 10000;
      if (scenario === 'SINGULAR') mesh.scaleX = 0;
      const frame = capture(f); assert.equal(frame.commands.length, 1); assert.equal(frame.commands[0].kind, 'mesh');
      assert.equal(frame.geometries[0], g); assert.equal(frame.images[0], r.image);
      if (scenario === 'FINITE_OUTSIDE') assert.equal(frame.commands[0].matrix.tx, 10000);
      if (scenario === 'SINGULAR') assert.equal(frame.commands[0].matrix.a, 0);
      frozenFrame(frame); noRendererFault(f);
    }));
  }
});

test('C05 source occurrences charge full metadata before visible faults or suppression', async t => {
  const full = capacityGeometry(3, 65536), one = capacityGeometry(3, 1);
  assert.equal(full.triangleCount, 65536); assert.equal(one.triangleCount, 1);
  await t.test('C05_SOURCE_EXACT_65536_ONCE', async () => withFixture(async f => {
    const r = await f.resource(); f.mesh(r, full);
    const frame = capture(f); assert.equal(frame.commands.length, 1); assert.equal(frame.geometries[0], full);
    assert.equal(frame.commands[0].geometryIndex, 0); noRendererFault(f);
  }));
  for (const scenario of ['ACTIVE', 'RETIRED', 'AFFINE_OVERFLOW']) {
    await t.test('C05_SOURCE_SHARED_DUPLICATE_' + scenario, async () => withFixture(async f => {
      const r = await f.resource(); const first = f.mesh(r, full); f.mesh(r, full);
      if (scenario === 'RETIRED') r.lease.release();
      if (scenario === 'AFFINE_OVERFLOW') first.scaleX = Number.MAX_VALUE;
      // Referenced x=1 would be finite with MAX scale, so force a genuine
      // composition overflow on the first node before its visible payload work.
      if (scenario === 'AFFINE_OVERFLOW') { const parent = f.sprite(); parent.scaleX = 2; parent.addChild(first); f.engine.stage.setChildIndex(parent, 0); }
      code(() => capture(f), 'FRAME_BUDGET_EXCEEDED'); noRendererFault(f);
    }));
  }
  for (const scenario of ['HIDDEN', 'ZERO_ALPHA', 'SINGULAR', 'ZERO_CLIP']) {
    await t.test('C05_SOURCE_SMALLEST_OVER_65537_' + scenario, async () => withFixture(async f => {
      const r = await f.resource(), branch = f.sprite(); f.mesh(r, full, branch); f.mesh(r, one, branch);
      if (scenario === 'HIDDEN') branch.visible = false;
      if (scenario === 'ZERO_ALPHA') branch.alpha = 0;
      if (scenario === 'SINGULAR') branch.scaleX = 0;
      if (scenario === 'ZERO_CLIP') branch.clipRect = { x: 0, y: 0, width: 0, height: 1 };
      code(() => capture(f), 'FRAME_BUDGET_EXCEEDED'); noRendererFault(f);
    }));
  }
  await t.test('C05_REFERENCED_TUPLES_ONLY_NO_SECOND_SOURCE_DEBIT', async () => withFixture(async f => {
    const r = await f.resource(), large = capacityGeometry(65536, 1, { unusedExtreme: true });
    assert.equal(large.vertexCount, 65536); assert.equal(large.triangleCount, 1);
    const mesh = f.mesh(r, large); mesh.scaleX = 2;
    const frame = capture(f); assert.equal(frame.commands.length, 1); assert.equal(frame.geometries[0], large);
    assert.deepEqual(frame.commands[0].matrix, { a: 2, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
    assert.equal(frame.geometries[0].positions[131070], Number.MAX_VALUE); noRendererFault(f);
  }));
  // Combined faults prove ordering; index-read counts are source-audit evidence.
});

test('C06 nodes/units includes Stage hidden primitives occupied empty slots and clear zero', async t => {
  await t.test('C06_NODES_EXACT_65536_AND_SMALLEST_OVER_65537', async () => withFixture(async f => {
    for (let i = 0; i < 65535; i++) f.sprite();
    assert.equal(f.engine.stage.numChildren, 65535); emptyFrame(capture(f));
    f.sprite(); assert.equal(f.engine.stage.numChildren, 65536);
    code(() => capture(f), 'FRAME_BUDGET_EXCEEDED'); noRendererFault(f);
  }));
  for (const scenario of ['VISIBLE', 'HIDDEN', 'ZERO_SIZE', 'PRIMITIVE_ALPHA_ZERO']) {
    await t.test('C06_UNITS_EXACT_65536_AND_SMALLEST_OVER_65537_' + scenario, async () => withFixture(async f => {
      const node = f.sprite(); if (scenario === 'HIDDEN') node.visible = false;
      const options = { width: scenario === 'ZERO_SIZE' ? 0 : 1, alpha: scenario === 'PRIMITIVE_ALPHA_ZERO' ? 0 : 1 };
      rectangles(node, 65536, options);
      const frame = capture(f); assert.equal(frame.commands.length, scenario === 'VISIBLE' ? 65536 : 0);
      assert.deepEqual(frame.images, []); assert.deepEqual(frame.geometries, []);
      rectangles(node, 1, options); code(() => capture(f), 'FRAME_BUDGET_EXCEEDED'); noRendererFault(f);
    }));
  }
  await t.test('C06_OCCUPIED_BITMAP_EMPTY_MESH_ONE_EACH_CLEARED_ZERO', async () => withFixture(async f => {
    const r = await f.resource(), rect = f.sprite(); rectangles(rect, 65534);
    const bitmap = f.bitmap(r), empty = ownedGeometry([], []).geometry, mesh = f.mesh(r, empty);
    const emptyBitmap = f.bitmap(r); emptyBitmap.textureLease = undefined;
    const exact = capture(f); assert.equal(exact.commands.length, 65536);
    assert.deepEqual(exact.commands.slice(-2).map(command => command.kind), ['image', 'mesh']);
    assert.deepEqual(exact.geometries, [empty]); assert.equal(exact.geometries[0], empty);
    rectangles(rect, 1); code(() => capture(f), 'FRAME_BUDGET_EXCEEDED');
    bitmap.textureLease = undefined; mesh.clear();
    const cleared = capture(f); assert.equal(cleared.commands.length, 65535);
    assert.deepEqual(cleared.images, []); assert.deepEqual(cleared.geometries, []);
    rectangles(rect, 1); assert.equal(capture(f).commands.length, 65536); noRendererFault(f);
  }));
  await t.test('C06_OVER_UNITS_PRECEDES_VISIBLE_RETIRED_MESH', async () => withFixture(async f => {
    const r = await f.resource(); f.mesh(r, ownedGeometry().geometry);
    const node = f.sprite(); rectangles(node, 65536); r.lease.release();
    code(() => capture(f), 'FRAME_BUDGET_EXCEEDED'); noRendererFault(f);
  }));
  // Commands share this 65,536-unit admission boundary: no independent public
  // command+1 witness exists. Debit-before-append is a separate source audit.
});

test('C07 storage includes hidden unique identities and exact smallest reachable byte excess', async t => {
  await t.test('C07_UNIQUE_GEOMETRIES_EXACT_128_HIDDEN_SMALLEST_OVER_129', async () => withFixture(async f => {
    const r = await f.resource(), geometries = [];
    for (let i = 0; i < 128; i++) { const g = ownedGeometry([], []).geometry; geometries.push(g); f.mesh(r, g); }
    const exact = capture(f); assert.equal(exact.commands.length, 128); assert.deepEqual(exact.geometries, geometries);
    for (let i = 0; i < 128; i++) assert.equal(exact.geometries[i], geometries[i]);
    const extra = f.mesh(r, ownedGeometry([], []).geometry); extra.visible = false;
    code(() => capture(f), 'FRAME_BUDGET_EXCEEDED'); noRendererFault(f);
  }));
  await t.test('C07_REPEATED_IDENTITY_STORES_ONCE', async () => withFixture(async f => {
    const r = await f.resource(), large = capacityGeometry(65536, 1);
    assert.equal(large.logicalByteLength, 4194316);
    for (let i = 0; i < 128; i++) f.mesh(r, large);
    const frame = capture(f); assert.equal(frame.commands.length, 128);
    assert.equal(frame.geometries.length, 1); assert.equal(frame.geometries[0], large);
    assert.equal(frame.commands.every(command => command.geometryIndex === 0), true); noRendererFault(f);
  }));
  const first = capacityGeometry(65536, 1), second = capacityGeometry(65536, 1), third = capacityGeometry(65536, 1);
  const fourthExact = capacityGeometry(65533, 13), fourthOver = capacityGeometry(65534, 8);
  assert.notEqual(first, second); assert.notEqual(second, third);
  assert.deepEqual([first.logicalByteLength, second.logicalByteLength, third.logicalByteLength, fourthExact.logicalByteLength], [4194316, 4194316, 4194316, 4194268]);
  assert.equal(fourthOver.logicalByteLength, 4194272);
  await t.test('C07_STORAGE_EXACT_16777216_WITH_16_TRIANGLES', async () => withFixture(async f => {
    const r = await f.resource(); for (const g of [first, second, third, fourthExact]) f.mesh(r, g);
    const frame = capture(f); assert.equal(frame.commands.length, 4);
    assert.deepEqual(frame.geometries, [first, second, third, fourthExact]);
    assert.deepEqual(frame.geometries.map(g => g.triangleCount), [1, 1, 1, 13]);
    assert.equal(frame.geometries.reduce((sum, g) => sum + g.logicalByteLength, 0), 16777216); noRendererFault(f);
  }));
  await t.test('C07_STORAGE_SMALLEST_OVER_16777220_WITH_11_TRIANGLES_BEFORE_RETIRED', async () => withFixture(async f => {
    const r = await f.resource(); f.mesh(r, first);
    for (const g of [second, third, fourthOver]) { const node = f.mesh(r, g); node.visible = false; }
    r.lease.release(); code(() => capture(f), 'FRAME_BUDGET_EXCEEDED'); noRendererFault(f);
  }));
  // Independent integer accounting: 64*N+12*t is a multiple of four, so +4
  // above 16,777,216 is the smallest reachable excess. No impossible byte+1.
});

test('C08 clip refs charges every emitted occurrence at exact and smallest-over unit counts', async t => {
  await t.test('C08_CLIP_REFERENCES_EXACT_262144_WITH_65536_UNITS', async () => withFixture(async f => {
    const fourth = fourClips(f), node = f.sprite(fourth); rectangles(node, 65536);
    const frame = capture(f); assert.equal(frame.commands.length, 65536);
    assert.equal(frame.commands.reduce((sum, command) => sum + command.clips.length, 0), 262144);
    assert.equal(frame.commands.every(command => command.clips.length === 4), true);
    assert.deepEqual(frame.commands[0].clips, [
      { matrix: IDENTITY, rect: { x: 1, y: 2, width: 10, height: 11 } },
      { matrix: IDENTITY, rect: { x: 2, y: 3, width: 9, height: 10 } },
      { matrix: IDENTITY, rect: { x: 3, y: 4, width: 8, height: 9 } },
      { matrix: IDENTITY, rect: { x: 4, y: 5, width: 7, height: 8 } },
    ]);
    assert.deepEqual(frame.commands[65535].clips, frame.commands[0].clips); frozenFrame(frame); noRendererFault(f);
  }));
  await t.test('C08_CLIP_REFERENCES_SMALLEST_OVER_262145_STILL_65536_UNITS', async () => withFixture(async f => {
    const fourth = fourClips(f), node = f.sprite(fourth); rectangles(node, 65535);
    const fifth = f.sprite(fourth); fifth.clipRect = { x: 5, y: 6, width: 6, height: 7 }; rectangles(fifth, 1);
    // 65,535*4 + 1*5 = 262,145, with exactly 65,536 primitives.
    code(() => capture(f), 'FRAME_BUDGET_EXCEEDED'); noRendererFault(f);
  }));
  // Hidden authoring metadata remains charged by C06; hidden branches emit no
  // clip references. Source audit must prove debit precedes clip flattening.
});

test('C09 ownership saves exact frozen image geometry crop order across later authoring and retirement', async () => {
  const f = await fixture(); let saved, a, b, g1, g2;
  const assertSaved = () => {
    assert.equal(saved.frameId, 1); assert.equal(saved.profile, 'egret.textured-frame2d/1');
    assert.equal(saved.width, 64); assert.equal(saved.height, 48); assert.equal(saved.clearColor, 0); assert.equal(saved.clearAlpha, 0);
    assert.deepEqual(saved.commands, [
      {
        kind: 'mesh', matrix: { a: 2, b: 0, c: 0, d: 3, tx: 12, ty: 23 }, alpha: 0.25,
        clips: [
          { matrix: { a: 1, b: 0, c: 0, d: 1, tx: 10, ty: 20 }, rect: { x: 0, y: 0, width: 30, height: 40 } },
          { matrix: { a: 2, b: 0, c: 0, d: 3, tx: 12, ty: 23 }, rect: { x: 0, y: 0, width: 4, height: 5 } },
        ],
        imageIndex: 0, sourceRect: { x: 1, y: 0, width: 1, height: 2 }, geometryIndex: 0,
      },
      {
        kind: 'image', matrix: { a: 1, b: 0, c: 0, d: 1, tx: 10, ty: 20 }, alpha: 0.5,
        clips: [{ matrix: { a: 1, b: 0, c: 0, d: 1, tx: 10, ty: 20 }, rect: { x: 0, y: 0, width: 30, height: 40 } }],
        rect: { x: 0, y: 0, width: 2, height: 1 }, imageIndex: 1, sourceRect: { x: 0, y: 1, width: 2, height: 1 },
      },
      {
        kind: 'mesh', matrix: { a: 1, b: 0, c: 0, d: 1, tx: 10, ty: 20 }, alpha: 0.5,
        clips: [{ matrix: { a: 1, b: 0, c: 0, d: 1, tx: 10, ty: 20 }, rect: { x: 0, y: 0, width: 30, height: 40 } }],
        imageIndex: 0, sourceRect: { x: 1, y: 0, width: 1, height: 2 }, geometryIndex: 1,
      },
    ]);
    assert.deepEqual(saved.commands.map(command => command.kind), ['mesh', 'image', 'mesh']);
    assert.deepEqual(saved.images, [a.image, b.image]); assert.equal(saved.images[0], a.image); assert.equal(saved.images[1], b.image);
    assert.deepEqual(saved.geometries, [g1, g2]); assert.equal(saved.geometries[0], g1); assert.equal(saved.geometries[1], g2);
    assert.deepEqual(saved.commands.map(command => command.imageIndex), [0, 1, 0]);
    assert.deepEqual(saved.commands.filter(command => command.kind === 'mesh').map(command => command.geometryIndex), [0, 1]);
    assert.deepEqual(saved.commands.map(command => command.sourceRect), [
      { x: 1, y: 0, width: 1, height: 2 }, { x: 0, y: 1, width: 2, height: 1 }, { x: 1, y: 0, width: 1, height: 2 },
    ]);
    assert.deepEqual(saved.commands[0].matrix, { a: 2, b: 0, c: 0, d: 3, tx: 12, ty: 23 });
    assert.equal(saved.commands[0].alpha, 0.25);
    assert.deepEqual(saved.commands[0].clips, [
      { matrix: { a: 1, b: 0, c: 0, d: 1, tx: 10, ty: 20 }, rect: { x: 0, y: 0, width: 30, height: 40 } },
      { matrix: { a: 2, b: 0, c: 0, d: 3, tx: 12, ty: 23 }, rect: { x: 0, y: 0, width: 4, height: 5 } },
    ]);
    assert.deepEqual(g1.positions, [0, 0, 2, 0, 0, 2]); assert.deepEqual(g1.uvs, [0, 0, 1, 0, 0, 1]);
    assert.deepEqual(g1.lightColors, [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0.5]); assert.deepEqual(g1.indices, [0, 1, 2]);
    assert.deepEqual(g2.positions, [0, 0, 3, 0, 0, 3]); assert.deepEqual(g2.indices, [2, 1, 0]);
    assert.deepEqual(g2.uvs, [0, 0, 0, 0, 0, 0]); assert.deepEqual(g2.lightColors, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    for (const g of [g1, g2]) {
      assert.equal(g.vertexCount, 3); assert.equal(g.indexCount, 3); assert.equal(g.triangleCount, 1); assert.equal(g.logicalByteLength, 204);
    }
    assert.deepEqual(Array.from(egret.copyImageData2DPixels(saved.images[0])), A_PIXELS);
    assert.deepEqual(Array.from(egret.copyImageData2DPixels(saved.images[1])), B_PIXELS); frozenFrame(saved);
  };
  try {
    const cropA = { x: 1, y: 0, width: 1, height: 2 }, cropB = { x: 0, y: 1, width: 2, height: 1 };
    a = await f.resource(A_PIXELS, cropA); b = await f.resource(B_PIXELS, cropB);
    const firstOwned = ownedGeometry([0, 0, 2, 0, 0, 2], [0, 1, 2], [0, 0, 1, 0, 0, 1], [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0.5]);
    const secondOwned = ownedGeometry([0, 0, 3, 0, 0, 3], [2, 1, 0]); g1 = firstOwned.geometry; g2 = secondOwned.geometry;
    const parent = f.sprite(); parent.x = 10; parent.y = 20; parent.alpha = 0.5; parent.clipRect = { x: 0, y: 0, width: 30, height: 40 };
    const first = f.mesh(a, g1, parent); first.x = 2; first.y = 3; first.scaleX = 2; first.scaleY = 3; first.alpha = 0.5;
    first.clipRect = { x: 0, y: 0, width: 4, height: 5 };
    const bitmap = f.bitmap(b, parent), second = f.mesh(a, g2, parent);
    saved = capture(f); assertSaved();
    for (const input of [firstOwned.input, secondOwned.input]) {
      input.positions.fill(99); input.uvs.fill(0.5); input.lightColors.fill(0); input.indices.fill(0);
    }
    a.input.fill(99); b.input.fill(99); cropA.y = 1; cropA.height = 1; cropB.x = 1; cropB.width = 1;
    assertSaved(); first.setContent(b.lease, g2);
    const replaced = capture(f); assert.deepEqual(replaced.images, [b.image, a.image]); assert.deepEqual(replaced.geometries, [g2]);
    assert.equal(replaced.geometries[0], g2); assertSaved();
    first.clear(); assert.deepEqual(capture(f).commands.map(command => command.kind), ['image', 'mesh']); assertSaved();
    first.dispose(); assert.deepEqual(capture(f).commands.map(command => command.kind), ['image', 'mesh']); assertSaved();
    a.lease.release(); code(() => capture(f), 'ASSET_LEASE_RELEASED'); assertSaved();
    second.visible = false; assert.deepEqual(capture(f).commands.map(command => command.kind), ['image']);
    const liveMesh = f.mesh(b, g2, parent); assert.equal(b.lease.value, b.texture);
    assert.deepEqual(capture(f).commands.map(command => command.kind), ['image', 'mesh']);
    a.texture.dispose(); assertSaved(); b.texture.dispose(); code(() => capture(f), 'TEXTURE_DISPOSED');
    bitmap.visible = false; code(() => capture(f), 'TEXTURE_DISPOSED');
    liveMesh.visible = false; const hidden = capture(f); assert.deepEqual(hidden.commands, []); assert.deepEqual(hidden.images, []); assert.deepEqual(hidden.geometries, []);
    b.lease.release(); assertSaved(); noRendererFault(f);
  } finally { await f.close(); }
  assertSaved();
  // Saved public values demonstrate immutable ownership. Absence of private
  // leaf/Texture/lease retention requires source review, not this public test.
});

function poison(target, keys, onRead) {
  const saved = [];
  const restore = () => {
    for (let i = saved.length - 1; i >= 0; i--) {
      const [key, descriptor] = saved[i];
      if (descriptor === undefined) assert.equal(Reflect.deleteProperty(target, key), true);
      else Object.defineProperty(target, key, descriptor);
    }
  };
  try {
    for (const key of keys) {
      saved.push([key, Object.getOwnPropertyDescriptor(target, key)]);
      Object.defineProperty(target, key, { configurable: true, get() { onRead(); throw new Error('C10 overridden public getter'); } });
    }
  } catch (cause) { restore(); throw cause; }
  return restore;
}

test('C10 authority ignores public overrides and captures a 1200-deep authentic tree', async t => {
  await t.test('C10_PUBLIC_AUTHORITY_POISON_ZERO_READS', async () => withFixture(async f => {
    const r = await f.resource(A_PIXELS, { x: 1, y: 0, width: 1, height: 2 }), g = ownedGeometry().geometry;
    const parent = f.sprite(); parent.x = 7; parent.y = 9; parent.clipRect = { x: 0, y: 0, width: 20, height: 21 };
    const mesh = f.mesh(r, g, parent); mesh.x = 2; mesh.y = 3;
    const restorers = []; let reads = 0;
    try {
      for (const node of [f.engine.stage, parent, mesh]) {
        restorers.push(poison(node, ['children', 'numChildren', 'getChildAt', 'parent', 'visible', 'alpha', 'x', 'y', 'scaleX', 'scaleY', 'rotation', 'clipRect'], () => reads++));
      }
      restorers.push(poison(mesh, ['geometry', 'textureLease'], () => reads++));
      // Authentic leases are frozen, so the overridable getter is on the public
      // prototype. Exact descriptors are restored before any fixture disposal.
      restorers.push(poison(egret.AssetLease.prototype, ['value'], () => reads++));
      restorers.push(poison(r.texture, ['imageData', 'sourceRect', 'width', 'height', 'isDisposed'], () => reads++));
      const frame = capture(f); assert.equal(frame.commands.length, 1); assert.equal(frame.commands[0].kind, 'mesh');
      assert.equal(frame.geometries[0], g); assert.equal(frame.images[0], r.image);
      assert.deepEqual(frame.commands[0].matrix, { a: 1, b: 0, c: 0, d: 1, tx: 9, ty: 12 });
      assert.deepEqual(frame.commands[0].sourceRect, { x: 1, y: 0, width: 1, height: 2 });
      assert.deepEqual(frame.commands[0].clips, [{ matrix: { a: 1, b: 0, c: 0, d: 1, tx: 7, ty: 9 }, rect: { x: 0, y: 0, width: 20, height: 21 } }]);
      assert.equal(reads, 0); frozenFrame(frame); noRendererFault(f);
    } finally { for (let i = restorers.length - 1; i >= 0; i--) restorers[i](); }
  }));
  await t.test('C10_DEPTH_1200_DEEPEST_OUTWARD_CLEANUP', async () => withFixture(async f => {
    const r = await f.resource(), g = ownedGeometry().geometry;
    let parent = f.engine.stage;
    for (let i = 0; i < 1200; i++) { const child = f.sprite(parent); child.x = 1; parent = child; }
    const mesh = f.mesh(r, g, parent); mesh.x = 2;
    const frame = capture(f); assert.equal(frame.commands.length, 1); assert.equal(frame.geometries[0], g);
    assert.deepEqual(frame.commands[0].matrix, { a: 1, b: 0, c: 0, d: 1, tx: 1202, ty: 0 });
    assert.deepEqual(frame.commands[0].clips, []); noRendererFault(f);
  }));
});
