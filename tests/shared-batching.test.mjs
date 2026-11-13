// SPDX-License-Identifier: Apache-2.0
// UNIT: which draws of a shared frame share one batch, and what a vertex row and the region table hold.
// Frames are captured through the public SDK; the private imports are built engine/dist/rendering
// helpers, as AGENTS permits for geometry units. No Host and no native object is involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { prepareSharedDraws2D } from '../packages/engine/dist/rendering/prepareSharedDraws2D.js';
import { packSharedDraws2D, packSharedRegions2D, SHARED_BATCH_PAGES_2D, SHARED_NO_PAGE_2D, SHARED_REGION_WINDOW_2D, SHARED_REGION_WINDOW_BYTES_2D, SHARED_VERTEX_BYTES_2D } from '../packages/engine/dist/rendering/packSharedDraws2D.js';
import { prepareSharedBatches2D } from '../packages/engine/dist/rendering/preparedSharedBatches2D.js';
import { PreparedBatchScratch2D } from '../packages/engine/dist/rendering/preparedBatches2D.js';

const LIMITS = { maxCommands: 65536, maxClipRectangles: 262144, maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxSourceTriangles: 65536, maxFrameGeometryBytes: 16777216, maxTupleComparisons: 1048576, pixelRatio: 1 };
const COLUMNS = 13;
let stages = 0;
/** One engine without a Host, and textures by name: each is a view of one of the pages. */
async function stage(views, body) {
  const engine = await egret.createEngine({ host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } } }), scope = engine.createScope();
  const images = new Map(), textures = new Map();
  // Page 'a' is 64 by 64. Every other page has a size of its own, so that a block that named a page's size would differ.
  const image = page => { let made = images.get(page); if (!made) { const width = page === 'a' ? 64 : 64 + 8 * images.size, height = page === 'a' ? 64 : 32;
    made = egret.createImageData2D({ width, height, pixels: new Uint8Array(width * height * 4).fill(200) }); images.set(page, made); } return made; };
  for (const [name, { page = 'a', ...descriptor }] of Object.entries(views)) textures.set(name, egret.createTextureView(image(page), descriptor));
  const type = egret.createAssetType('shared-batching-' + ++stages, egret.isTexture);
  engine.assets.register(type, { async load(ref) { return textures.get(ref.id); }, dispose(value) { value.dispose(); } });
  try {
    const leases = {};
    for (const name of textures.keys()) leases[name] = scope.use(await engine.assets.acquire(egret.createAssetRef(type, name), { signal: scope.signal }));
    const add = (node, change = {}, parent = engine.stage) => { scope.use(node); Object.assign(node, change); parent.addChild(node); return node; };
    return await body({ engine, scope, leases, add,
      bitmap: (name, change, parent) => add(new egret.Bitmap(leases[name]), change, parent),
      rect: (color, change, parent) => { const node = new egret.Sprite(); node.graphics.beginFill(color, 1).drawRect(0, 0, 8, 8).endFill(); return add(node, change, parent); } });
  } finally { scope.dispose(); await engine.dispose(); for (const texture of textures.values()) if (!texture.isDisposed) texture.dispose(); }
}
/** The frame, its packed draws and its batches, as both Hosts make them. */
function plan(engine, size = { width: 256, height: 256 }) {
  const frame = engine.captureSharedFrame(size), prepared = prepareSharedDraws2D(frame, size.width, size.height, LIMITS);
  const packed = packSharedDraws2D(prepared), scratch = new PreparedBatchScratch2D(), batches = prepareSharedBatches2D(packed, 33554432, scratch);
  const result = { frame, prepared, packed, draws: [...batches.draws], spans: batches.logicalSpans.map(span => [span.first, span.count]) };
  scratch.release(batches);
  return result;
}
const plain = (x, y, width = 8, height = 8) => ({ packed: { x, y, width, height }, logicalWidth: width, logicalHeight: height, trimX: 0, trimY: 0, quarterTurn: 0 });
const column = (draw, index) => Array.from({ length: draw.vertexCount }, (_value, vertex) => draw.data[vertex * COLUMNS + index]);
const words = draw => new Uint32Array(draw.uniform.buffer, draw.uniform.byteOffset, 32), floats = draw => new Float32Array(draw.uniform.buffer, draw.uniform.byteOffset, 32);

test('BATCH B01 draws of different regions and opacities of one page are one batch, and each vertex names its region and opacity', () => stage({
  first: plain(0, 0), second: plain(8, 0, 6, 4), trimmed: { packed: { x: 16, y: 0, width: 5, height: 7 }, logicalWidth: 9, logicalHeight: 12, trimX: 2, trimY: 3, quarterTurn: 0 },
  turned: { packed: { x: 24, y: 0, width: 4, height: 9 }, logicalWidth: 9, logicalHeight: 4, trimX: 0, trimY: 0, quarterTurn: 1 },
}, ({ engine, bitmap }) => {
  const opacities = [1, .5, .25, .75, .1, 1];
  ['first', 'second', 'trimmed', 'turned', 'first', 'trimmed'].forEach((name, index) => bitmap(name, { x: 10 + 20 * index, y: 30 + 7 * index, alpha: opacities[index] }));
  const { frame, packed, draws, spans } = plan(engine);
  assert.equal(frame.regions.length, 4); assert.equal(frame.pages.length, 1); assert.equal(frame.commands.length, 6);
  assert.equal(SHARED_VERTEX_BYTES_2D, 4 * COLUMNS);
  // Six draws, one batch, six logical draws in it.
  assert.deepEqual(spans, [[0, 6]]); assert.equal(draws.length, 1);
  const batch = draws[0];
  assert.equal(batch.vertexCount, 36); assert.equal(batch.data.byteLength, 36 * SHARED_VERTEX_BYTES_2D); assert.equal(batch.regionWindow, 0);
  // The batch is the six draws' own rows one after another, unchanged.
  assert.deepEqual(Array.from(batch.data), packed.flatMap(draw => Array.from(draw.data)));
  packed.forEach((draw, index) => {
    const command = frame.commands[index];
    assert.equal(draw.vertexCount, 6); assert.equal(draw.regionWindow, 0);
    // The twelfth value is the region's place in its window, the thirteenth the opacity as f32, the same at every vertex.
    assert.deepEqual(column(draw, 11), Array(6).fill(command.regionIndex));
    assert.deepEqual(column(draw, 12), Array(6).fill(Math.fround(opacities[index])));
    // The light alpha is the vertex's own: opacity is not multiplied into it.
    assert.deepEqual(column(draw, 7), Array(6).fill(1));
    // The block names neither region nor opacity, so the six blocks are the same bytes.
    assert.deepEqual(Array.from(draw.uniform), Array.from(packed[0].uniform));
    assert.deepEqual(draw.pages, [0]);
  });
  assert.deepEqual(Array.from(floats(batch).subarray(0, 4)), [256, 256, 0, 0]);
  // The first unit holds the frame's one page. The block names no region and no page size.
  assert.deepEqual(Array.from(words(batch).subarray(12, 20)), [0, ...Array(7).fill(SHARED_NO_PAGE_2D)]);
  assert.deepEqual(Array.from(words(batch).subarray(20, 23)), [0, 0, 0]);
  assert.deepEqual(Array.from(words(batch).subarray(28, 31)), [0, 0, 1]);
  // A batch of one page is given the block of its first draw, not a copy.
  assert.equal(batch.uniform, packed[0].uniform); assert.deepEqual(batch.pages, [0]);
}));

test('BATCH B02 the region table holds every region of the frame in frame order, with content extents in logical orientation', () => stage({
  whole: plain(0, 0, 64, 64), trimmed: { packed: { x: 16, y: 2, width: 5, height: 7 }, logicalWidth: 9, logicalHeight: 12, trimX: 2, trimY: 3, quarterTurn: 0 },
  turn1: { packed: { x: 24, y: 1, width: 4, height: 9 }, logicalWidth: 9, logicalHeight: 4, trimX: 0, trimY: 0, quarterTurn: 1 },
  turn2: { packed: { x: 30, y: 3, width: 4, height: 9 }, logicalWidth: 6, logicalHeight: 11, trimX: 1, trimY: 2, quarterTurn: 2 },
  turn3: { packed: { x: 40, y: 5, width: 4, height: 9 }, logicalWidth: 10, logicalHeight: 5, trimX: 1, trimY: 1, quarterTurn: 3 },
}, ({ engine, bitmap }) => {
  for (const name of ['turn3', 'whole', 'trimmed', 'turn1', 'turn2']) bitmap(name);
  const { frame } = plan(engine), table = packSharedRegions2D(frame);
  assert.equal(table.length, 12 * 5);
  // Regions are numbered in the order the frame first uses them.
  assert.deepEqual(Array.from(table), [
    10, 5, 1, 1, 9, 4, 40, 5, 3, 0, 64, 64,
    64, 64, 0, 0, 64, 64, 0, 0, 0, 0, 64, 64,
    9, 12, 2, 3, 5, 7, 16, 2, 0, 0, 64, 64,
    9, 4, 0, 0, 9, 4, 24, 1, 1, 0, 64, 64,
    6, 11, 1, 2, 4, 9, 30, 3, 2, 0, 64, 64,
  ]);
  frame.regions.forEach((region, index) => {
    const odd = region.quarterTurn % 2 === 1, row = Array.from(table.subarray(12 * index, 12 * index + 12));
    assert.deepEqual(row, [region.logicalWidth, region.logicalHeight, region.trimX, region.trimY,
      odd ? region.packed.height : region.packed.width, odd ? region.packed.width : region.packed.height, region.packed.x, region.packed.y, region.quarterTurn,
      region.pageIndex, frame.pages[region.pageIndex].source.width, frame.pages[region.pageIndex].source.height]);
  });
  assert.equal(SHARED_REGION_WINDOW_BYTES_2D, 48 * SHARED_REGION_WINDOW_2D);
}));

test('BATCH B03 a batch ends at another material, clip, kind of draw or boundary, and never reorders', () => stage({
  a: plain(0, 0), b: plain(8, 0), other: { page: 'b', ...plain(0, 0) },
}, ({ engine, add, bitmap, rect, leases }) => {
  const reset = () => engine.stage.removeChildren();
  const spans = () => plan(engine).spans;
  // Another page does not end a batch: page A, page B, page A are one batch in their order.
  bitmap('a'); bitmap('b'); bitmap('other'); bitmap('a'); bitmap('b');
  assert.deepEqual(spans(), [[0, 5]]);
  // Another material.
  reset(); bitmap('a'); bitmap('b', { sharedMaterial: egret.createSharedMaterial2D({ filter: 'linear', minFilter: 'linear', magFilter: 'linear' }) }); bitmap('a'); bitmap('b');
  assert.deepEqual(spans(), [[0, 1], [1, 1], [2, 2]]);
  // Another clip: a clip rectangle opens and closes with a barrier, so clipped draws batch with one another
  // and not with the draws outside it.
  reset(); bitmap('a');
  const clipped = add(new egret.DisplayObjectContainer(), { clipRect: { x: 0, y: 0, width: 100, height: 100 } });
  bitmap('b', { x: 4 }, clipped); bitmap('a', { x: 20 }, clipped); bitmap('b', { x: 40 });
  const withClip = plan(engine);
  assert.deepEqual(withClip.frame.commands.map(command => command.kind), ['image', 'barrier', 'image', 'image', 'barrier', 'image']);
  assert.deepEqual(withClip.frame.commands.map(command => command.clips?.length), [0, undefined, 1, 1, undefined, 0]);
  assert.deepEqual(withClip.spans, [[0, 1], [2, 2], [5, 1]]);
  // A solid rectangle between two bitmaps of one page.
  reset(); bitmap('a'); rect(0x336699, { x: 30 }); bitmap('b', { x: 60 });
  assert.deepEqual(spans(), [[0, 1], [1, 1], [2, 1]]);
  // A mesh and a bitmap of one region are different kinds of draw.
  reset(); bitmap('a');
  add(new egret.Mesh2D(leases.a, egret.createSharedGeometry2D({ positions: new Float64Array([0, 0, 8, 0, 0, 8]), uvs: new Float64Array([0, 0, 1, 0, 0, 1]),
    lightColors: new Float64Array(12).fill(1), darkColors: new Float64Array(9), indices: new Uint16Array([0, 1, 2]) })), { x: 40 });
  bitmap('b', { x: 80 });
  assert.deepEqual(spans(), [[0, 1], [1, 1], [2, 1]]);
  // An isolating boundary is a barrier between its draws and their neighbours.
  reset(); bitmap('a');
  const isolated = add(new egret.DisplayObjectContainer(), { renderBoundary: 'isolate' });
  bitmap('b', { x: 20 }, isolated); bitmap('a', { x: 40 }, isolated); bitmap('b', { x: 60 });
  const result = plan(engine);
  assert.deepEqual(result.frame.commands.map(command => command.kind), ['image', 'barrier', 'image', 'image', 'barrier', 'image']);
  assert.deepEqual(result.spans, [[0, 1], [2, 2], [5, 1]]);
  // A draw that prepares no vertex, here one wholly outside the frame, is in no batch; the draws on either side of it are not joined.
  reset(); bitmap('a'); bitmap('b', { x: 5000 }); bitmap('a', { x: 20 });
  const outside = plan(engine);
  assert.deepEqual(outside.packed.map(draw => draw.vertexCount), [6, 0, 6]);
  assert.deepEqual(outside.spans, [[0, 1], [2, 1]]);
}));

test('BATCH B07 a batch of several pages names them by texture unit, and every row of the region table names its page and the page size', () => stage({
  a: plain(0, 0), a2: plain(8, 0), b: { page: 'b', ...plain(0, 0) }, c: { page: 'c', ...plain(4, 4) }, c2: { page: 'c', ...plain(16, 4) },
}, ({ engine, bitmap }) => {
  // Pages in the order the frame first uses them: c, a, b. Draws: c a b a2 c2 b.
  ['c', 'a', 'b', 'a2', 'c2', 'b'].forEach((name, index) => bitmap(name, { x: 12 * index, alpha: 1 - index / 10 }));
  const { frame, packed, draws, spans } = plan(engine);
  assert.equal(frame.pages.length, 3); assert.equal(frame.regions.length, 5);
  const sizes = frame.pages.map(page => [page.source.width, page.source.height]);
  assert.equal(new Set(sizes.map(String)).size, 3);
  assert.deepEqual(spans, [[0, 6]]); assert.equal(draws.length, 1);
  const batch = draws[0];
  // The units are the pages in the order the batch first draws them.
  assert.deepEqual(batch.pages, [0, 1, 2]);
  assert.deepEqual(Array.from(words(batch).subarray(12, 20)), [0, 1, 2, ...Array(5).fill(SHARED_NO_PAGE_2D)]);
  // Each draw as it was packed names its own page alone, and its block is otherwise the batch's.
  assert.deepEqual(packed.map(draw => draw.pages), [[0], [1], [2], [1], [0], [2]]);
  packed.forEach(draw => {
    assert.deepEqual(Array.from(words(draw).subarray(12, 20)), [draw.pages[0], ...Array(7).fill(SHARED_NO_PAGE_2D)]);
    assert.deepEqual(Array.from(draw.uniform.subarray(0, 48)), Array.from(batch.uniform.subarray(0, 48)));
    assert.deepEqual(Array.from(draw.uniform.subarray(80)), Array.from(batch.uniform.subarray(80)));
  });
  // The batch's block is its own; the first draw's block still names one page.
  assert.notEqual(batch.uniform, packed[0].uniform); assert.notEqual(batch.uniform.buffer, packed[0].uniform.buffer);
  // The rows are the six draws' own rows, unchanged: a vertex names its region, and the region's row its page.
  assert.deepEqual(Array.from(batch.data), packed.flatMap(draw => Array.from(draw.data)));
  const table = packSharedRegions2D(frame);
  frame.regions.forEach((region, index) => assert.deepEqual(Array.from(table.subarray(12 * index + 9, 12 * index + 12)), [region.pageIndex, ...sizes[region.pageIndex]]));
  assert.deepEqual(frame.commands.map(command => frame.regions[command.regionIndex].pageIndex), [0, 1, 2, 1, 0, 2]);
}));

test('BATCH B08 a batch holds eight pages; a ninth starts the next batch, which numbers its units anew', () => {
  const views = {}; for (let page = 0; page < 10; page++) views['p' + page] = { page: 'page-' + page, ...plain(0, 0) };
  return stage(views, ({ engine, bitmap }) => {
    assert.equal(SHARED_BATCH_PAGES_2D, 8);
    // Pages 0 to 7, page 3 again, then pages 8 and 9 and page 0 again.
    const order = [0, 1, 2, 3, 4, 5, 6, 7, 3, 8, 9, 0];
    order.forEach((page, index) => bitmap('p' + page, { x: 10 * index }));
    const { frame, draws, spans } = plan(engine);
    assert.equal(frame.pages.length, 10);
    assert.deepEqual(spans, [[0, 9], [9, 3]]);
    assert.deepEqual(draws[0].pages, [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(Array.from(words(draws[0]).subarray(12, 20)), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(draws[1].pages, [8, 9, 0]);
    assert.deepEqual(Array.from(words(draws[1]).subarray(12, 20)), [8, 9, 0, ...Array(5).fill(SHARED_NO_PAGE_2D)]);
    assert.equal(draws[0].vertexCount, 54); assert.equal(draws[1].vertexCount, 18);
  });
});

test('BATCH B09 a draw without a region names no page, and never shares a batch with one that has a region', () => stage({ a: plain(0, 0) }, ({ engine, bitmap, rect }) => {
  rect(0x102030); rect(0x405060, { x: 10 }); bitmap('a', { x: 20 }); bitmap('a', { x: 30 }); rect(0x708090, { x: 40 });
  const { packed, draws, spans } = plan(engine);
  assert.deepEqual(spans, [[0, 2], [2, 2], [4, 1]]);
  assert.deepEqual(packed.map(draw => draw.pages), [[], [], [0], [0], []]);
  assert.deepEqual(draws.map(draw => draw.pages), [[], [0], []]);
  // The block of a solid draw keeps eight zero words where a sampled one names its pages.
  assert.deepEqual(Array.from(words(draws[0]).subarray(12, 20)), Array(8).fill(0));
}));

test('BATCH B04 solid rectangles of different colour and opacity are one batch and read no region table', () => stage({ a: plain(0, 0) }, ({ engine, rect }) => {
  rect(0xff0000, { alpha: 1 }); rect(0x00ff00, { x: 20, alpha: .5 }); rect(0x0000ff, { x: 40, alpha: .25 });
  const { frame, packed, draws, spans } = plan(engine);
  assert.equal(frame.regions.length, 0); assert.equal(packSharedRegions2D(frame).length, 0);
  assert.deepEqual(spans, [[0, 3]]); assert.equal(draws[0].vertexCount, 18); assert.equal(draws[0].regionWindow, -1);
  packed.forEach((draw, index) => { assert.deepEqual(column(draw, 11), Array(6).fill(0)); assert.deepEqual(column(draw, 12), Array(6).fill([1, .5, .25][index])); });
  // The page extent of a draw without a page is one by one, and its kind zero.
  assert.deepEqual(Array.from(words(draws[0]).subarray(12, 32)), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0]);
}));

test('BATCH B05 a batch spans one window of 341 regions; the 342nd region starts the next window at slot zero', async () => {
  const views = {};
  for (let index = 0; index < 344; index++) views['r' + index] = plain(2 * (index % 32), 2 * Math.floor(index / 32), 2, 2);
  await stage(views, ({ engine, bitmap }) => {
    assert.equal(SHARED_REGION_WINDOW_2D, 341);
    for (let index = 0; index < 344; index++) bitmap('r' + index, { x: index % 100, y: Math.floor(index / 100) });
    // Back into the first window, then the second again: order is kept, so each change of window is a new batch.
    bitmap('r5'); bitmap('r6'); bitmap('r343'); bitmap('r342');
    const { frame, packed, spans } = plan(engine);
    assert.equal(frame.regions.length, 344);
    assert.deepEqual(spans, [[0, 341], [341, 3], [344, 2], [346, 2]]);
    assert.deepEqual([340, 341, 342, 343, 344, 346].map(index => [packed[index].regionWindow, packed[index].data[11]]), [[0, 340], [1, 0], [1, 1], [1, 2], [0, 5], [1, 2]]);
    assert.equal(packSharedRegions2D(frame).length, 12 * 344);
  });
});

test('BATCH B06 batching refunds no logical charge: every draw keeps its vertex and block fee, and every region its table row', () => stage({ a: plain(0, 0), b: plain(8, 0) }, ({ engine, bitmap, rect }) => {
  bitmap('a'); bitmap('b', { x: 20 }); bitmap('a', { x: 40 }); rect(0xffffff, { x: 60 });
  const { frame, prepared, draws } = plan(engine);
  assert.equal(draws.length, 2);
  assert.equal(prepared.upload, 4 * (6 * 52 + 128) + 2 * 48);
  assert.equal(frame.regions.length, 2);
}));
