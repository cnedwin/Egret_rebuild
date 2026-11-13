// SPDX-License-Identifier: Apache-2.0
// UNIT: fixed scenes whose captured frame, clipped geometry, vertex rows and draw batches are recorded.
// The captured frame, the clipped geometry and the eleven values a vertex has always had were recorded
// before the capture and preparation paths were made cheaper, and again unchanged before draws of one
// page were batched across regions: a change to those paths has to reproduce every value, property order
// and refusal. The rows as they are uploaded, the uniform blocks and the batches were recorded with batching,
// and again when a batch came to hold several pages: the rows did not change then, the blocks and batches did.
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

const PRINT = process.env.EGRET_PRINT_SHARED_GOLDEN === '1';
/**
 * The four stages of one frame, each reduced to text; a stage that refuses records its refusal and ends the list.
 * `rows11` is the vertex rows without the two values batching added, and without the uniform blocks: what
 * the rows held before. `rows` and `batches` are the rows, blocks and batches as they are uploaded.
 */
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
    budget: prepared.budget.snapshot(), geometryBytes: prepared.geometryBytes, pageBytes: prepared.pageBytes,
    width: prepared.width, height: prepared.height }));
  // The logical upload is a sum, stated here and not recorded: 52 bytes for every reserved vertex and 128 for
  // every draw, 48 for every region of the frame, and the uniform blocks of its effects.
  if (!PRINT) assert.equal(prepared.upload, prepared.entries.reduce((sum, entry) => entry.kind === 'draw' ? sum + 52 * entry.vertexReservation + 128 : sum, 0)
    + 48 * frame.regions.length + prepared.effects.uniformBytes);
  let packed;
  try { packed = packSharedDraws2D(prepared); } catch (cause) { out.push('rows ' + refusal(cause)); return out; }
  const first11 = entry => {
    const columns = entry.vertexCount ? entry.data.length / entry.vertexCount : 0, values = new Float32Array(11 * entry.vertexCount);
    for (let vertex = 0; vertex < entry.vertexCount; vertex++) values.set(entry.data.subarray(vertex * columns, vertex * columns + 11), vertex * 11);
    return values;
  };
  out.push('rows11 ' + text({ entries: packed.map(entry => 'barrier' in entry ? entry : { command: entry.prepared.command.ordinal, data: first11(entry), vertexCount: entry.vertexCount }), budget: prepared.budget.snapshot() }));
  const row = entry => 'barrier' in entry ? entry : { command: entry.prepared.command.ordinal, data: entry.data, vertexCount: entry.vertexCount, uniform: entry.uniform, regionWindow: entry.regionWindow, pages: entry.pages };
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
  const before = createHash('sha256'), uploaded = createHash('sha256'), kinds = new Set();
  for (const shape of SHAPES) await scene(seed, shape, engine => {
    for (const [size, ratio] of VIEWS) for (const stage of stages(engine, size, ratio)) {
      const kind = stage.slice(0, stage.indexOf(' ')), refused = stage.includes(' refused:');
      // A refusal of the rows is part of both recordings.
      for (const hash of kind === 'rows' && refused ? [before, uploaded] : kind === 'rows' || kind === 'batches' ? [uploaded] : [before]) { hash.update(stage); hash.update('\n'); }
      kinds.add(kind + (refused ? '!' : ''));
    }
  });
  return { before: before.digest('hex'), uploaded: uploaded.digest('hex'), kinds };
}

// The captured frame, the clipped geometry without its upload sum, and the eleven first values of every vertex row.
// Recorded from the build before draws were batched across regions, which reproduced the recording made
// before the capture and preparation paths were made cheaper.
const EXPECTED_BEFORE = [
  '3e6e3ca3d12ab01486b17bb21750cef54064dccacd73e20218d85055994f665d',
  'b05a8563dd1b47772fde32483d7a145b5a553b5df7121ddca17d5f27fe6441d8',
  '7f5fcd7b2a75950a93654dc3935e58a1edb0dc7ec39ed6c6464bedb4b56b7086',
  '81a6b0370ff3185092005ed92f51ef6eae28bbd624f416bd9d7bcd6c58eeee67',
  '374a233b0727426415d3e54d47b68a1f94d1dc4d022533b4ff179a5816e31d1c',
  '443bcaf1fc54151a450387b31e64c3de91687b67cad73f247822af7f73f2bbff',
  'd768560f4ecb5208d71f0a6ead23ce9d09068a7bc9e5c54bd21fb143c2d89114',
  'a1b2eb5651358aae4ff0f59af893b0140168b57ab021410ff5704bed5e5bc625',
  '8ab5c210476a9b3e2f4ae504421fc8a747085b7bf605091b66710a4f0edb4d70',
  '1a1e0ff3c04f3acf1b7f22a2fa9dac6dd9ee8b9d45040d3f5783c79584088162',
  '5fa50afccee9827714b1f3dac66e5e40321c5690cbe0d0762dc4b14cb7eb5b60',
  '71005f5030cf8d0f1291c32bc30337102874f02230b0aca406b2f731fcbfecbb',
];
// The rows, uniform blocks and batches as they are uploaded, recorded with batching across regions.
const EXPECTED = [
  'f72520f13c962871f29672572a8e7b0361dd5603772a1c1c2f4d2794ac2d6b4e',
  '65252485cea874456fa6d2cbd3c14370690c83a58a165563b2473558ed0aa492',
  'cc0473a13420d3bdd082f6bee2c198e998af6f60070a9e2136c07efb7b403ea7',
  'fb61788f26e7a3cf1ff70b933fcc579c51dfebf3fb0c991ef40bee65a413fa09',
  'db18e5a9d41d5030aa12ee83d0d3e61cbe037b2d36ffed795ebfed194b3ec103',
  'd3eb8b6207a7b459c225b17885f3c7c546f21b18de2c372c80c3b1d36693752b',
  '247b24e22fba5b0701054c458b16c337b9b27c2f050d39ab464ee5c558dfd382',
  '3dfbdb6b8d5bb1d04eed820fa80dea754c2c9ed92c6d4b5ee9cf1efca6c18499',
  'bee283d1332f29537bef99cc857df89e2493515aa44942fd9a66ebc88d74c501',
  '476f7edcb96dc2b2155cba7b0560b7e65bd9a3c33f74330f17fce64c0e9bf4d6',
  '68ea6f2d88092229beea433f45b29b7cac334356bad9669a2850f8325939f884',
  'e3ecbf3cb832adcb4be43cb9062d2672dad89a8b342e013368dba32f3a2e078f',
];

test('SHG01 captured frames, clipped geometry, vertex rows and batches reproduce the recorded values', async () => {
  const seen = new Set(), actual = [];
  const before = [];
  for (let seed = 1; seed <= 12; seed++) { const result = await digest(seed); before.push(result.before); actual.push(result.uploaded); for (const kind of result.kinds) seen.add(kind); }
  if (PRINT) { console.log(JSON.stringify({ before, actual, kinds: [...seen].sort() }, null, 1)); return; }
  // The recording is only evidence when all four stages completed somewhere and both early stages also refused somewhere.
  for (const kind of ['capture', 'geometry', 'rows11', 'rows', 'batches', 'capture!', 'geometry!']) assert.ok(seen.has(kind), kind);
  assert.deepEqual(before, EXPECTED_BEFORE);
  assert.deepEqual(actual, EXPECTED);
});

const code = action => { try { action(); return 'ok'; } catch (cause) { return cause instanceof egret.EgretError ? cause.code : 'THROWN:' + cause?.message; } };
async function stageOf(body, size = 8) {
  const engine = await egret.createEngine({ host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } } }), scope = engine.createScope();
  const type = egret.createAssetType('shared-golden-order-' + (stageOf.count = (stageOf.count ?? 0) + 1), egret.isTexture), texture = egret.createTexture(image(size, 3));
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
  // 4,097 distinct regions of one page exceed the regions one frame admits; the transform refusal comes first in drawing order.
  const regions = [];
  for (let y = 0; y < 72; y++) for (let x = 0; x < 72; x++) regions.push({ x, y, width: 1, height: 1 });
  for (const region of regions.slice(0, 4097)) { const bitmap = scope.use(new egret.Bitmap(lease)); bitmap.sourceRect = region; second.addChild(bitmap); }
  assert.equal(code(() => engine.captureSharedFrame({ width: 32, height: 32 })), 'FRAME_IMAGE_BUDGET');
  first.scaleX = 1e200; a.scaleX = 1e200;
  assert.equal(code(() => engine.captureSharedFrame({ width: 32, height: 32 })), 'FRAME_TRANSFORM_INVALID');
  // A subtree that is not drawn contributes no refusal of visible content.
  first.visible = false;
  assert.equal(code(() => engine.captureSharedFrame({ width: 32, height: 32 })), 'FRAME_IMAGE_BUDGET');
  second.alpha = 0;
  assert.equal(code(() => engine.captureSharedFrame({ width: 32, height: 32 })), 'ok');
}, 72));

test('SHG04 every draw owns its own range of the frame\'s vertex rows and uniform blocks', async () => {
  await scene(5, 'mixed', engine => {
    const frame = engine.captureSharedFrame({ width: 200, height: 120 });
    const packed = packSharedDraws2D(prepareSharedDraws2D(frame, 200, 120, { ...LIMITS, pixelRatio: 1 })).filter(entry => !('barrier' in entry));
    assert.ok(packed.length > 8 && packed.some(entry => entry.vertexCount > 0));
    let rowsEnd = 0, blocksEnd = 0;
    for (const entry of packed) {
      assert.equal(entry.data.byteLength, entry.vertexCount * 52); assert.equal(entry.uniform.byteLength, 128);
      // Ranges follow one another in command order and never overlap, so writing one draw cannot change another.
      if (entry.data.byteLength > 0) { assert.ok(entry.data.byteOffset >= rowsEnd); rowsEnd = entry.data.byteOffset + entry.data.byteLength; }
      assert.ok(entry.uniform.byteOffset >= blocksEnd); blocksEnd = entry.uniform.byteOffset + 128;
      // A copy made through the view has exactly the draw's bytes, which is how the hosts upload it.
      assert.deepEqual(new Float32Array(entry.data), Float32Array.from(entry.data));
      assert.equal(new Uint8Array(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength).length, entry.vertexCount * 52);
    }
  });
});
