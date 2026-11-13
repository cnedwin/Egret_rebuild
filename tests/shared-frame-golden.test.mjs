// SPDX-License-Identifier: Apache-2.0
// UNIT: fixed scenes whose captured frame, clipped geometry, vertex rows and draw batches were
// recorded before the capture and preparation paths were made cheaper. A change to those paths has
// to reproduce every value, property order, logical charge and refusal recorded here.
// The private imports are built engine/dist/rendering helpers, as AGENTS permits for geometry units.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as egret from '@egret/engine';
import { prepareSharedDraws2D } from '../packages/engine/dist/rendering/prepareSharedDraws2D.js';
import { packSharedDraws2D } from '../packages/engine/dist/rendering/packSharedDraws2D.js';
import { prepareSharedBatches2D } from '../packages/engine/dist/rendering/preparedSharedBatches2D.js';
import { PreparedBatchScratch2D } from '../packages/engine/dist/rendering/preparedBatches2D.js';

const LIMITS = { maxCommands: 65536, maxClipRectangles: 262144, maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxSourceTriangles: 65536, maxFrameGeometryBytes: 16777216, maxTupleComparisons: 1048576 };
function random(seed) {
  let state = seed >>> 0;
  const next = () => { state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x9e3779b9 >>> 0; return state >>> 8; };
  const below = bound => next() % bound;
  return { below, pick: values => values[below(values.length)], chance: (numerator, denominator) => below(denominator) < numerator };
}

/** Every number keeps its sign of zero, every object its property order, every buffer its bytes. */
function write(value, pages, out) {
  if (typeof value === 'number') out.push(Object.is(value, -0) ? '-0' : String(value));
  else if (typeof value === 'string') out.push(JSON.stringify(value));
  else if (value === undefined || value === null || typeof value === 'boolean') out.push(String(value));
  else if (ArrayBuffer.isView(value)) out.push(value.constructor.name, '<', createHash('sha256').update(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)).digest('hex'), '>');
  else if (Array.isArray(value)) { out.push('['); for (const item of value) { write(item, pages, out); out.push(','); } out.push(']'); }
  else if (egret.isImageData2D(value)) out.push('image#', String(pages.indexOf(value)), ':', String(value.width), 'x', String(value.height));
  else if (typeof value === 'object') { out.push('{'); for (const key of Object.keys(value)) { out.push(key, ':'); write(value[key], pages, out); out.push(','); } out.push('}'); }
  else out.push(typeof value);
}
const refusal = cause => 'refused:' + (cause?.constructor?.name ?? typeof cause) + ':' + (cause?.code ?? cause?.reason ?? cause?.message);

/** The four stages of one frame, each reduced to text; a stage that refuses records its refusal and ends the list. */
function stages(engine, size, pixelRatio) {
  const out = [], pages = [];
  let frame;
  try { frame = engine.captureSharedFrame(size); } catch (cause) { return ['capture ' + refusal(cause)]; }
  for (const page of frame.pages) pages.push(page.source);
  const text = value => { const parts = []; write(value, pages, parts); return parts.join(''); };
  const { frameId, ...content } = frame;
  out.push('capture ' + text(content));
  const width = Math.ceil(frame.width * pixelRatio), height = Math.ceil(frame.height * pixelRatio);
  let prepared;
  try { prepared = prepareSharedDraws2D(frame, width, height, { ...LIMITS, pixelRatio }); } catch (cause) { out.push('geometry ' + refusal(cause)); return out; }
  out.push('geometry ' + text({
    entries: prepared.entries.map(entry => entry.kind === 'barrier' ? entry : {
      kind: entry.kind, command: entry.command.ordinal, material: frame.materials.indexOf(entry.material),
      region: entry.region === undefined ? undefined : frame.regions.indexOf(entry.region), pageIndex: entry.pageIndex,
      polygons: entry.polygons, vertexReservation: entry.vertexReservation }),
    budget: prepared.budget.snapshot(), geometryBytes: prepared.geometryBytes, pageBytes: prepared.pageBytes, upload: prepared.upload,
    width: prepared.width, height: prepared.height }));
  let packed;
  try { packed = packSharedDraws2D(prepared); } catch (cause) { out.push('rows ' + refusal(cause)); return out; }
  const row = entry => 'barrier' in entry ? entry : { command: entry.prepared.command.ordinal, data: entry.data, vertexCount: entry.vertexCount, uniform: entry.uniform };
  out.push('rows ' + text({ entries: packed.map(row), budget: prepared.budget.snapshot() }));
  const scratch = new PreparedBatchScratch2D(), plan = prepareSharedBatches2D(packed, 33554432, scratch);
  out.push('batches ' + text({ draws: plan.draws.map(row), spans: plan.logicalSpans, bytes: plan.bytes }));
  scratch.release(plan);
  return out;
}

const MATERIALS = [
  {}, { light: [1, .5, .25, .5] }, { dark: [.25, .125, .5] }, { blend: 'add-accumulate' }, { blend: 'screen' }, { blend: 'multiply-factor' },
  { samplingDomain: 'page' }, { samplingDomain: 'page', filter: 'linear', addressU: 'repeat', addressV: 'mirror-repeat' },
  { filter: 'linear' }, { filter: 'linear', regionIsolation: 'strict' }, { light: [.5, .5, .5, 1], dark: [.5, 0, 0], filter: 'linear' },
];
function image(size, seed) {
  const pixels = new Uint8Array(size * size * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set([(seed * 37 + offset) & 255, (offset >> 3) & 255, seed & 255, 255 - ((offset >> 5) & 127)], offset);
  return egret.createImageData2D({ width: size, height: size, pixels });
}

/** One seeded scene on a fresh Engine; `shape` picks the family of content. */
async function scene(seed, shape, body) {
  const r = random(seed * 7919 + 17);
  const engine = await egret.createEngine({ host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } } });
  const scope = engine.createScope(), textures = [];
  try {
    const leases = [];
    const lease = async texture => {
      const type = egret.createAssetType('shared-golden-' + seed + '-' + shape + '-' + leases.length, egret.isTexture);
      engine.assets.register(type, { async load() { return texture; }, dispose(value) { value.dispose(); } });
      const value = scope.use(await engine.assets.acquire(egret.createAssetRef(type, 'texture-' + leases.length), { signal: scope.signal }));
      leases.push(value); textures.push(texture); return value;
    };
    const atlas = image(32, seed), second = image(16, seed + 1);
    const plain = await lease(egret.createTexture(atlas)), other = await lease(egret.createTexture(second));
    const views = [
      await lease(egret.createTextureView(atlas, { packed: { x: 2, y: 3, width: 6, height: 5 }, logicalWidth: 9, logicalHeight: 8, trimX: 1, trimY: 2, quarterTurn: 0 })),
      await lease(egret.createTextureView(atlas, { packed: { x: 10, y: 4, width: 4, height: 7 }, logicalWidth: 9, logicalHeight: 6, trimX: 1, trimY: 1, quarterTurn: 1 })),
      await lease(egret.createTextureView(atlas, { packed: { x: 16, y: 16, width: 8, height: 8 }, logicalWidth: 8, logicalHeight: 8, trimX: 0, trimY: 0, quarterTurn: 2 })),
      await lease(egret.createTextureView(second, { packed: { x: 1, y: 1, width: 5, height: 3 }, logicalWidth: 7, logicalHeight: 7, trimX: 2, trimY: 1, quarterTurn: 3 })),
    ];
    const materials = MATERIALS.map(options => egret.createSharedMaterial2D(options));
    const triangle = egret.createSharedGeometry2D({ positions: new Float64Array([0, 0, 9, 1, 2, 8]), uvs: new Float64Array([0, 0, 1, 0, 0, 1]),
      lightColors: new Float64Array([1, .5, .25, .5, 1, 1, 1, 1, .25, .5, 1, .75]), darkColors: new Float64Array([.25, .5, .75, 0, 0, 0, .5, .25, 0]), indices: new Uint16Array([0, 1, 2]) });
    const quad = egret.createSharedGeometry2D({ positions: new Float64Array([0, 0, 8, 0, 8, 6, 0, 6]), uvs: new Float64Array([0, 0, 1, 0, 1, 1, 0, 1]),
      lightColors: new Float64Array(16).fill(1), darkColors: new Float64Array(12), indices: new Uint16Array([0, 1, 2, 0, 2, 3]) });
    const place = node => {
      node.x = r.below(240) - 40 + (r.chance(1, 4) ? .5 : 0); node.y = r.below(160) - 30 + (r.chance(1, 5) ? .25 : 0);
      if (r.chance(1, 3)) { node.scaleX = r.pick([.5, 2, -1, 1.5, 3]); node.scaleY = r.pick([.5, 2, 1, -1.25]); }
      if (shape !== 'axis' && r.chance(1, 3)) node.rotation = r.pick([90, 180, 270, 30, 37.5, -12]);
      if (r.chance(1, 6)) { node.anchorOffsetX = r.below(8); node.anchorOffsetY = r.below(8); }
      if (r.chance(1, 4)) node.alpha = r.pick([.5, .25, 0, .75]);
      if (r.chance(1, 14)) node.visible = false;
      if (r.chance(1, 6)) node.sharedMaterial = r.pick(materials);
      // Values the capture or the preparation has to refuse, so refusals and their order are recorded too.
      if (shape === 'extreme' && r.chance(1, 14)) node.x = r.pick([2e6, 1e-40, -3e6, 1e300, 5e5]);
      if (shape === 'extreme' && r.chance(1, 18)) node.scaleX = r.pick([1e200, 1e-200, 1e160, 4096]);
    };
    const leaf = parent => {
      const kind = shape === 'rects' ? 0 : shape === 'bitmaps' ? 1 + r.below(2) : r.below(shape === 'meshes' || shape === 'extreme' ? 5 : 4);
      let node;
      if (kind === 0) {
        node = new egret.Sprite();
        for (let count = 1 + r.below(3); count > 0; count--) node.graphics.beginFill(r.below(0x1000000), r.pick([1, 1, .5, 0])).drawRect(r.below(6), r.below(6), r.pick([12, 4, 0, 30]), r.pick([12, 6, 20])).endFill();
      } else if (kind === 1) {
        node = new egret.Bitmap(r.pick([plain, other]));
        if (r.chance(2, 3)) { const cell = r.below(16); node.sourceRect = { x: (cell % 4) * 4, y: (cell >> 2) * 4, width: 4, height: 4 }; }
      } else if (kind === 2) node = new egret.Bitmap(r.pick(views));
      else if (kind === 3) { node = new egret.Sprite(); node.graphics.beginFill(0x336699, 1).drawRect(0, 0, 400, 300).endFill(); }
      else node = new egret.Mesh2D(r.pick([plain, views[0], views[2]]), r.pick([triangle, quad]));
      scope.use(node); place(node); parent.addChild(node);
    };
    const branch = (parent, depth) => {
      const node = scope.use(new egret.DisplayObjectContainer());
      place(node);
      if (shape !== 'rects' && r.chance(1, 3)) node.clipRect = { x: r.below(20), y: r.below(20), width: r.pick([60, 120, 8, 0]), height: r.pick([50, 90, 6]) };
      if (r.chance(1, 8)) node.renderBoundary = 'isolate';
      parent.addChild(node);
      for (let count = 2 + r.below(5); count > 0; count--) { if (depth < 3 && r.chance(1, 3)) branch(node, depth + 1); else leaf(node); }
    };
    for (let count = 3 + r.below(4); count > 0; count--) branch(engine.stage, 0);
    for (let count = r.below(4); count > 0; count--) leaf(engine.stage);
    return body(engine, r);
  } finally { scope.dispose(); await engine.dispose(); for (const texture of textures) if (!texture.isDisposed) texture.dispose(); }
}

const SHAPES = ['rects', 'axis', 'bitmaps', 'mixed', 'meshes', 'extreme'];
const VIEWS = [[{ width: 200, height: 120 }, 1], [{ width: 96, height: 64 }, 2], [{ width: 333, height: 211 }, 1.5], [{ width: 16, height: 16 }, 1]];
async function digest(seed) {
  const hash = createHash('sha256'), kinds = new Set();
  for (const shape of SHAPES) await scene(seed, shape, engine => {
    for (const [size, ratio] of VIEWS) for (const stage of stages(engine, size, ratio)) { hash.update(stage); hash.update('\n'); kinds.add(stage.slice(0, stage.indexOf(' ')) + (stage.includes(' refused:') ? '!' : '')); }
  });
  return { digest: hash.digest('hex'), kinds };
}

// Recorded from the capture and preparation paths as they stood before this file was added.
const EXPECTED = [
  '81944ba80ef96d7ace1efbbe364362a820bf3a6fbfe6bb52c2b74734dd8d3ba3',
  '111388dfcaf3e6bafb8b6ef04fa5ed507d0dba5894e4ef8366ec6b1bab45bc23',
  '264618099d9dc0a063d5057ab122b9faf9c5184be0a55cef4852a7099ad84cc4',
  '4069a07e98021b4d821ffe5ffae0cb0e1d03f702841e337694419c6d996f14be',
  'f870fc7adacea2c975b29301f68b42ad5a017eed2fc405c716e3a668985746bb',
  '3e51b7fca35fd47cbc08793ee4e8f575db15f7f966c77f4b42919da7d6c2df62',
  'dc06e87148f381854ee20cb9b1aea3b1409b1d856103e4b2c62c1f107c525e3f',
  '4097584ef3bff3079c539e2a0df525eb9eade5d6534e1a1d665f9d633da09e5f',
  '25738e51e2ac74679630ae08749fe639af898c2501fff3a00fa583498cccac75',
  '79a01e82d217ae9054c3b01296bb373e6b58dc5c158c7a555e015a1e5b266fa1',
  'b40a8b31728641147a5abcc913f028bad5563bb6b9e68595a960e8240a10341a',
  'ef0183b081e9dda03ffe5621f8b2391811e33bdab45217bde82f6fd46764ace9',
];

test('SHG01 captured frames, clipped geometry, vertex rows and batches reproduce the recorded values', async () => {
  const seen = new Set(), actual = [];
  for (let seed = 1; seed <= 12; seed++) { const result = await digest(seed); actual.push(result.digest); for (const kind of result.kinds) seen.add(kind); }
  if (process.env.EGRET_PRINT_SHARED_GOLDEN === '1') console.log(JSON.stringify({ actual, kinds: [...seen].sort() }, null, 1));
  // The recording is only evidence when all four stages completed somewhere and both early stages also refused somewhere.
  for (const kind of ['capture', 'geometry', 'rows', 'batches', 'capture!', 'geometry!']) assert.ok(seen.has(kind), kind);
  assert.deepEqual(actual, EXPECTED);
});

const code = action => { try { action(); return 'ok'; } catch (cause) { return cause instanceof egret.EgretError ? cause.code : 'THROWN:' + cause?.message; } };
async function stageOf(body) {
  const engine = await egret.createEngine({ host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } } }), scope = engine.createScope();
  const type = egret.createAssetType('shared-golden-order-' + (stageOf.count = (stageOf.count ?? 0) + 1), egret.isTexture), texture = egret.createTexture(image(8, 3));
  engine.assets.register(type, { async load() { return texture; }, dispose(value) { value.dispose(); } });
  try {
    const lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, 'page'), { signal: scope.signal }));
    return await body(engine, scope, lease);
  } finally { scope.dispose(); await engine.dispose(); if (!texture.isDisposed) texture.dispose(); }
}
/** 21,846 triangles: three uses exceed the 65,536 triangles one frame admits. */
function heavyGeometry() {
  const triangles = 21846, indices = new Uint16Array(triangles * 3);
  for (let offset = 0; offset < indices.length; offset += 3) { indices[offset + 1] = 1; indices[offset + 2] = 2; }
  return egret.createSharedGeometry2D({ positions: new Float64Array([0, 0, 4, 0, 0, 4]), uvs: new Float64Array([0, 0, 1, 0, 0, 1]),
    lightColors: new Float64Array(12).fill(1), darkColors: new Float64Array(9), indices });
}

test('SHG02 a whole-tree admission refusal outranks an earlier refusal of visible content', async () => stageOf(async (engine, scope, lease) => {
  const overflow = scope.use(new egret.Sprite()), inner = scope.use(new egret.Sprite());
  overflow.graphics.beginFill(1, 1).drawRect(0, 0, 4, 4).endFill(); inner.graphics.beginFill(2, 1).drawRect(0, 0, 4, 4).endFill();
  // The product of the two scales is not finite, which the visible pass refuses at the inner node.
  const outer = scope.use(new egret.DisplayObjectContainer()); outer.scaleX = 1e200; inner.scaleX = 1e200;
  engine.stage.addChild(outer); outer.addChild(inner); engine.stage.addChild(overflow);
  assert.equal(code(() => engine.captureSharedFrame({ width: 32, height: 32 })), 'FRAME_TRANSFORM_INVALID');
  // Three later meshes exceed the triangle allowance, which is charged for the whole tree first.
  const geometry = heavyGeometry(), hidden = scope.use(new egret.DisplayObjectContainer());
  hidden.visible = false; engine.stage.addChild(hidden);
  for (let count = 0; count < 2; count++) hidden.addChild(scope.use(new egret.Mesh2D(lease, geometry)));
  assert.equal(code(() => engine.captureSharedFrame({ width: 32, height: 32 })), 'FRAME_TRANSFORM_INVALID');
  // The third use sits in a subtree that is not drawn; the charge does not depend on visibility.
  hidden.addChild(scope.use(new egret.Mesh2D(lease, geometry)));
  assert.equal(code(() => engine.captureSharedFrame({ width: 32, height: 32 })), 'FRAME_BUDGET_EXCEEDED');
  inner.scaleX = 1;
  assert.equal(code(() => engine.captureSharedFrame({ width: 32, height: 32 })), 'FRAME_BUDGET_EXCEEDED');
  hidden.removeChild(hidden.getChildAt(0));
  assert.equal(code(() => engine.captureSharedFrame({ width: 32, height: 32 })), 'ok');
}));

test('SHG03 the first refusal of visible content in drawing order is the one reported', async () => stageOf(async (engine, scope, lease) => {
  const first = scope.use(new egret.DisplayObjectContainer()), second = scope.use(new egret.DisplayObjectContainer());
  const a = scope.use(new egret.Sprite()), b = scope.use(new egret.Bitmap(lease));
  a.graphics.beginFill(1, 1).drawRect(0, 0, 4, 4).endFill();
  engine.stage.addChild(first); engine.stage.addChild(second); first.addChild(a); second.addChild(b);
  // 129 distinct regions of one page exceed the regions one frame admits; the transform refusal comes first in drawing order.
  const regions = [];
  for (const [width, height] of [[1, 1], [1, 2], [2, 1]]) for (let y = 0; y + height <= 8; y++) for (let x = 0; x + width <= 8; x++) regions.push({ x, y, width, height });
  for (const region of regions.slice(0, 129)) { const bitmap = scope.use(new egret.Bitmap(lease)); bitmap.sourceRect = region; second.addChild(bitmap); }
  assert.equal(code(() => engine.captureSharedFrame({ width: 32, height: 32 })), 'FRAME_IMAGE_BUDGET');
  first.scaleX = 1e200; a.scaleX = 1e200;
  assert.equal(code(() => engine.captureSharedFrame({ width: 32, height: 32 })), 'FRAME_TRANSFORM_INVALID');
  // A subtree that is not drawn contributes no refusal of visible content.
  first.visible = false;
  assert.equal(code(() => engine.captureSharedFrame({ width: 32, height: 32 })), 'FRAME_IMAGE_BUDGET');
  second.alpha = 0;
  assert.equal(code(() => engine.captureSharedFrame({ width: 32, height: 32 })), 'ok');
}));

test('SHG04 every draw owns its own range of the frame\'s vertex rows and uniform blocks', async () => {
  await scene(5, 'mixed', engine => {
    const frame = engine.captureSharedFrame({ width: 200, height: 120 });
    const packed = packSharedDraws2D(prepareSharedDraws2D(frame, 200, 120, { ...LIMITS, pixelRatio: 1 })).filter(entry => !('barrier' in entry));
    assert.ok(packed.length > 8 && packed.some(entry => entry.vertexCount > 0));
    let rowsEnd = 0, blocksEnd = 0;
    for (const entry of packed) {
      assert.equal(entry.data.byteLength, entry.vertexCount * 44); assert.equal(entry.uniform.byteLength, 128);
      // Ranges follow one another in command order and never overlap, so writing one draw cannot change another.
      if (entry.data.byteLength > 0) { assert.ok(entry.data.byteOffset >= rowsEnd); rowsEnd = entry.data.byteOffset + entry.data.byteLength; }
      assert.ok(entry.uniform.byteOffset >= blocksEnd); blocksEnd = entry.uniform.byteOffset + 128;
      // A copy made through the view has exactly the draw's bytes, which is how the hosts upload it.
      assert.deepEqual(new Float32Array(entry.data), Float32Array.from(entry.data));
      assert.equal(new Uint8Array(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength).length, entry.vertexCount * 44);
    }
  });
});
