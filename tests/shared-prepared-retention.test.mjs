// SPDX-License-Identifier: Apache-2.0
// UNIT: what a Host keeps of the frame it last prepared, and that a frame prepared with kept draws has the
// geometry, rows, charges and refusals of one prepared without them.
// Frames are captured through the public SDK; the private imports are built engine/dist/rendering
// helpers, as AGENTS permits for geometry units. No Host and no native object is involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { prepareSharedDraws2D } from '../packages/engine/dist/rendering/prepareSharedDraws2D.js';
import { packSharedDraws2D } from '../packages/engine/dist/rendering/packSharedDraws2D.js';
import { SharedPreparationRetention2D, SHARED_RETAINED_BYTES_2D, SHARED_RETAINED_DRAWS_2D } from '../packages/engine/dist/rendering/sharedPreparationRetention2D.js';

const LIMITS = Object.freeze({ maxCommands: 65536, maxClipRectangles: 262144, maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxSourceTriangles: 65536, maxFrameGeometryBytes: 16777216, maxTupleComparisons: 1048576, pixelRatio: 1 });
const SIZE = { width: 256, height: 256 };
let stages = 0;
/** One engine without a Host and two pages of regions; `leases[page][cell]` is a 8x8 region of a page. */
async function stage(body) {
  const engine = await egret.createEngine({ host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } } }), scope = engine.createScope();
  const images = [[64, 64], [96, 32]].map(([width, height], page) => egret.createImageData2D({ width, height, pixels: new Uint8Array(width * height * 4).fill(60 + 90 * page) }));
  const textures = new Map(), type = egret.createAssetType('shared-prepared-retention-' + ++stages, egret.isTexture);
  engine.assets.register(type, { async load(ref) {
    const [page, cell] = ref.id.split(':').map(Number);
    const texture = egret.createTextureView(images[page], { packed: { x: 8 * (cell % 4), y: 8 * (cell >> 2), width: 8, height: 8 }, logicalWidth: 8 + (cell % 2), logicalHeight: 8, trimX: cell % 2, trimY: 0, quarterTurn: cell === 3 ? 1 : 0 });
    textures.set(ref.id, texture); return texture;
  }, dispose(value) { value.dispose(); } });
  try {
    const leases = [[], []];
    for (let page = 0; page < 2; page++) for (let cell = 0; cell < 8; cell++) leases[page].push(scope.use(await engine.assets.acquire(egret.createAssetRef(type, page + ':' + cell), { signal: scope.signal })));
    const add = (node, change = {}, parent = engine.stage) => { scope.use(node); Object.assign(node, change); parent.addChild(node); return node; };
    return await body({ engine, scope, leases, add,
      bitmap: (page, cell, change, parent) => add(new egret.Bitmap(leases[page][cell]), change, parent),
      rect: (color, change, parent) => { const node = new egret.Sprite(); node.graphics.beginFill(color, 1).drawRect(0, 0, 10, 6).endFill(); return add(node, change, parent); } });
  } finally { scope.dispose(); await engine.dispose(); for (const texture of textures.values()) if (!texture.isDisposed) texture.dispose(); }
}
/** Everything of a prepared and packed frame a Host goes on to use. */
function result(prepared, packed) {
  return { entries: prepared.entries.map(entry => entry.kind === 'barrier' ? entry : { ordinal: entry.command.ordinal, pageIndex: entry.pageIndex, polygons: entry.polygons, vertexReservation: entry.vertexReservation }),
    upload: prepared.upload, geometryBytes: prepared.geometryBytes, pageBytes: prepared.pageBytes,
    draws: packed.map(entry => 'barrier' in entry ? entry : { data: Array.from(entry.data), vertexCount: entry.vertexCount, uniform: Array.from(entry.uniform), regionWindow: entry.regionWindow, pages: entry.pages }),
    budget: prepared.budget.snapshot() };
}
const refusal = cause => 'refused:' + (cause?.constructor?.name ?? typeof cause) + ':' + (cause?.reason ?? cause?.message);
/** The frame prepared and packed without kept draws, and with them; both as values, or as the refusal. */
function both(frame, retention, limits = LIMITS, size = SIZE) {
  const run = kept => { try { const prepared = prepareSharedDraws2D(frame, size.width, size.height, limits, kept), packed = packSharedDraws2D(prepared); return { prepared, packed, value: result(prepared, packed) }; } catch (cause) { return { value: refusal(cause) }; } };
  const fresh = run(undefined), kept = run(retention);
  assert.deepEqual(kept.value, fresh.value);
  return { fresh, kept };
}
const polygons = run => run.prepared.entries.filter(entry => entry.kind === 'draw').map(entry => entry.polygons);

test('RETAIN R01 a frame that is the same again takes every draw from what is kept, and is the frame prepared without it', () => stage(({ engine, bitmap, rect, add }) => {
  for (let i = 0; i < 12; i++) bitmap(i % 2, i % 8, { x: 12 * i, y: 9 * i, rotation: 7 * i, alpha: 1 - i / 20 });
  rect(0x336699, { x: 40, y: 200 });
  const clipped = add(new egret.DisplayObjectContainer(), { clipRect: { x: 10, y: 10, width: 60, height: 40 } });
  bitmap(0, 1, { x: 30, y: 30, scaleX: 9 }, clipped);
  const retention = new SharedPreparationRetention2D();
  const first = both(engine.captureSharedFrame(SIZE), retention);
  assert.equal(retention.draws, 14); assert.ok(retention.bytes > 0 && retention.bytes <= SHARED_RETAINED_BYTES_2D);
  // A second capture is a new frame with a new list of commands of the same values.
  const frame = engine.captureSharedFrame(SIZE), second = both(frame, retention);
  assert.notEqual(frame, first.kept.prepared.frame); assert.notEqual(frame.commands, first.kept.prepared.frame.commands);
  assert.deepEqual(frame.commands, first.kept.prepared.frame.commands);
  polygons(second.kept).forEach((value, index) => assert.equal(value, polygons(first.kept)[index], 'draw ' + index + ' is the kept geometry itself'));
  polygons(second.fresh).forEach((value, index) => assert.notEqual(value, polygons(first.kept)[index]));
  assert.equal(retention.draws, 14);
}));

test('RETAIN R02 a draw that changed is prepared again and the others are not, whether it moved, turned, was clipped, cropped or given another region or page', () => stage(({ engine, bitmap, rect, add, leases }) => {
  const nodes = []; for (let i = 0; i < 8; i++) nodes.push(bitmap(0, i, { x: 20 * i, y: 100 }));
  const box = rect(0x224466, { x: 10, y: 10 });
  const group = add(new egret.DisplayObjectContainer()); const inner = bitmap(1, 2, { x: 90, y: 40 }, group);
  const retention = new SharedPreparationRetention2D();
  let before = both(engine.captureSharedFrame(SIZE), retention);
  const expectChanged = (changed, label) => {
    const after = both(engine.captureSharedFrame(SIZE), retention), was = polygons(before.kept), now = polygons(after.kept);
    assert.deepEqual(now.map((value, index) => value !== was[index]).map((value, index) => value ? index : -1).filter(index => index >= 0), changed, label);
    before = after;
  };
  expectChanged([], 'nothing changed');
  nodes[3].x += 0.5; expectChanged([3], 'moved');
  nodes[5].rotation = 30; expectChanged([5], 'turned');
  nodes[1].scaleX = 2; expectChanged([1], 'scaled');
  nodes[2].textureLease = leases[0][5]; expectChanged([2], 'another region of the page');
  nodes[2].textureLease = leases[1][5]; expectChanged([2], 'the same region of another page');
  // That draw changed twice running, so it was kept without its geometry: at rest it is prepared once more, then found.
  expectChanged([2], 'at rest after two changes'); expectChanged([], 'nothing changed');
  box.graphics.clear(); box.graphics.beginFill(0x224467, 1).drawRect(0, 0, 10, 6).endFill(); expectChanged([8], 'another colour');
  // The opacity is not an input of the geometry, unless it is none: then the draw has none.
  nodes[6].alpha = 0.25; expectChanged([], 'another opacity');
  // A parent that moves changes every draw below it and no other.
  group.x = 3; expectChanged([9], 'a parent moved');
  group.clipRect = { x: 0, y: 0, width: 200, height: 200 }; expectChanged([9], 'a clip rectangle given');
  group.clipRect = { x: 0, y: 0, width: 200, height: 201 }; expectChanged([9], 'the clip rectangle changed');
  nodes[0].sharedMaterial = egret.createSharedMaterial2D({ filter: 'linear', minFilter: 'linear', magFilter: 'linear' }); expectChanged([0], 'another material');
  expectChanged([], 'nothing changed');
  assert.equal(inner.x, 90);
}));

test('RETAIN R03 a draw added or removed does not part the later draws from what is kept for them', () => stage(({ engine, bitmap, add }) => {
  const nodes = []; for (let i = 0; i < 10; i++) nodes.push(bitmap(i % 2, i % 8, { x: 15 * i, y: 5 * i }));
  const retention = new SharedPreparationRetention2D();
  const first = polygons(both(engine.captureSharedFrame(SIZE), retention).kept);
  engine.stage.removeChild(nodes[2]);
  const removed = polygons(both(engine.captureSharedFrame(SIZE), retention).kept);
  assert.deepEqual(removed.map(value => first.indexOf(value)), [0, 1, 3, 4, 5, 6, 7, 8, 9]);
  const extra = add(new egret.Bitmap(nodes[0].textureLease), { x: 200, y: 200 }); engine.stage.setChildIndex(extra, 0);
  const added = polygons(both(engine.captureSharedFrame(SIZE), retention).kept);
  assert.deepEqual(added.map(value => removed.indexOf(value)), [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8]);
  // A barrier between the draws is a command of its own and moves them one place as well.
  nodes[5].renderBoundary = 'isolate';
  const isolated = both(engine.captureSharedFrame(SIZE), retention).kept;
  assert.deepEqual(isolated.prepared.frame.commands.map(command => command.kind === 'barrier' ? 'b' : 'd').join(''), 'dddddbdbdddd');
  assert.deepEqual(polygons(isolated).map(value => added.indexOf(value)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'each barrier moves the later draws one more place');
  // Two draws removed at one place are followed as well; three are not, and the draws after them are prepared once and kept again.
  nodes[5].renderBoundary = 'none'; engine.stage.removeChild(nodes[0]); engine.stage.removeChild(nodes[1]);
  const two = polygons(both(engine.captureSharedFrame(SIZE), retention).kept);
  assert.deepEqual(two.map(value => polygons(isolated).indexOf(value)), [0, 3, 4, 5, 6, 7, 8, 9]);
  for (const node of [nodes[3], nodes[4], nodes[5]]) engine.stage.removeChild(node);
  const three = polygons(both(engine.captureSharedFrame(SIZE), retention).kept);
  assert.deepEqual(three.map(value => two.indexOf(value)), [0, -1, -1, -1, -1]);
  assert.deepEqual(polygons(both(engine.captureSharedFrame(SIZE), retention).kept).map((value, index) => value === three[index]), Array(5).fill(true));
}));

test('RETAIN R04 a draw that changes twice running is kept without its geometry until it has been the same once', () => stage(({ engine, bitmap }) => {
  const still = bitmap(0, 0, { x: 10, y: 10 }), mover = bitmap(0, 1, { x: 50, y: 50 });
  const retention = new SharedPreparationRetention2D();
  const step = () => both(engine.captureSharedFrame(SIZE), retention).kept;
  step();
  const whole = retention.bytes;
  mover.x++; step(); assert.equal(retention.bytes, whole, 'changed once: still kept whole');
  mover.x++; const moving = step(); assert.ok(retention.bytes < whole, 'changed twice: kept without geometry or rows');
  const probe = retention.bytes; assert.equal(retention.draws, 2);
  mover.x++; step(); assert.equal(retention.bytes, probe);
  // At rest it is first prepared once more, and kept whole; after that it is found.
  const rested = step(); assert.equal(retention.bytes, whole);
  assert.notEqual(polygons(rested)[1], polygons(moving)[1]);
  const found = step(); assert.equal(polygons(found)[1], polygons(rested)[1]);
  assert.equal(polygons(found)[0], polygons(moving)[0], 'the draw beside it was found throughout');
  assert.equal(still.x, 10);
}));

test('RETAIN R05 another size, pixel ratio or set of limits drops what is kept; the same ones find it again', () => stage(({ engine, bitmap }) => {
  for (let i = 0; i < 6; i++) bitmap(0, i, { x: 20 * i, y: 20 });
  const retention = new SharedPreparationRetention2D();
  const frame = () => engine.captureSharedFrame(SIZE);
  const first = polygons(both(frame(), retention).kept);
  const same = run => polygons(run.kept).every((value, index) => value === first[index]);
  assert.equal(same(both(frame(), retention)), true);
  for (const [limits, size] of [[LIMITS, { width: 256, height: 255 }], [Object.freeze({ ...LIMITS, pixelRatio: 2 }), SIZE], [Object.freeze({ ...LIMITS }), SIZE]]) {
    const other = both(frame(), retention, limits, size);
    assert.equal(polygons(other.kept).some(value => first.includes(value)), false);
    assert.equal(polygons(both(frame(), retention, limits, size).kept).every((value, index) => value === polygons(other.kept)[index]), true);
    // Back under the first size and limits, the frame is prepared anew and kept anew.
    const back = both(frame(), retention); assert.equal(polygons(back.kept).some(value => first.includes(value)), false);
    first.splice(0, first.length, ...polygons(back.kept));
  }
  retention.clear(); assert.equal(retention.draws, 0); assert.equal(retention.bytes, 0);
  assert.equal(polygons(both(frame(), retention).kept).some(value => first.includes(value)), false);
}));

test('RETAIN R06 a frame that is refused leaves what was kept, and its refusal is the one of the frame prepared without kept draws', () => stage(({ engine, bitmap }) => {
  const nodes = []; for (let i = 0; i < 6; i++) nodes.push(bitmap(0, i, { x: 20 * i, y: 20 }));
  const retention = new SharedPreparationRetention2D();
  const first = polygons(both(engine.captureSharedFrame(SIZE), retention).kept), bytes = retention.bytes;
  // The fourth draw is beyond what a coordinate may be: the three before it are found, then the frame is refused.
  nodes[3].x = 1e300;
  const refused = both(engine.captureSharedFrame(SIZE), retention);
  assert.match(refused.kept.value, /^refused:/); assert.equal(retention.draws, 6); assert.equal(retention.bytes, bytes);
  nodes[3].x = 60;
  assert.deepEqual(polygons(both(engine.captureSharedFrame(SIZE), retention).kept).map(value => first.indexOf(value)), [0, 1, 2, 3, 4, 5]);
  // The same when the draws before the refused one had changed, once and twice running: what they kept is neither replaced nor lost.
  nodes[0].x++; nodes[1].x++; both(engine.captureSharedFrame(SIZE), retention);
  nodes[1].x++; const before = polygons(both(engine.captureSharedFrame(SIZE), retention).kept), kept = [retention.draws, retention.bytes];
  nodes[0].x++; nodes[1].x++; nodes[2].x++; nodes[3].x = 1e300;
  assert.match(both(engine.captureSharedFrame(SIZE), retention).kept.value, /^refused:/); assert.deepEqual([retention.draws, retention.bytes], kept);
  nodes[0].x--; nodes[1].x--; nodes[2].x--; nodes[3].x = 60;
  // Draw 1 was kept without geometry and is prepared again; every other draw is found.
  assert.deepEqual(polygons(both(engine.captureSharedFrame(SIZE), retention).kept).map(value => before.indexOf(value)), [0, -1, 2, 3, 4, 5]);
}));

test('RETAIN R07 kept draws are charged what they were charged: a budget they do not fit refuses as the frame prepared without them does', () => stage(({ engine, bitmap, add }) => {
  const clipped = add(new egret.DisplayObjectContainer(), { clipRect: { x: 5, y: 5, width: 100, height: 100 }, rotation: 10 });
  for (let i = 0; i < 20; i++) bitmap(0, i % 8, { x: 9 * i, y: 7 * i, rotation: 13 * i }, clipped);
  const whole = prepareSharedDraws2D(engine.captureSharedFrame(SIZE), SIZE.width, SIZE.height, LIMITS);
  packSharedDraws2D(whole);
  const charged = whole.budget.snapshot();
  assert.ok(charged.preparedVerticesCharged > 0 && charged.predicatesCharged > 0 && charged.tupleComparisonsCharged > 0);
  for (const [name, total] of [['maxPreparedVertices', charged.preparedVerticesCharged], ['maxClipEdgeTests', charged.predicatesCharged], ['maxTupleComparisons', charged.tupleComparisonsCharged]]) {
    // One below what the whole frame is charged, and half of it: the refusal falls in packing, or in the geometry of some draw.
    for (const limit of [total - 1, Math.ceil(total / 2), 1]) {
      const limits = Object.freeze({ ...LIMITS, [name]: limit }), retention = new SharedPreparationRetention2D();
      const first = both(engine.captureSharedFrame(SIZE), retention, limits);
      assert.match(first.kept.value, /^refused:.*:budget$/, name + ' ' + limit);
      // The same frame again, now with whatever the refused frame left kept: none, since it never completed its geometry, or all of it.
      assert.deepEqual(both(engine.captureSharedFrame(SIZE), retention, limits).kept.value, first.kept.value);
    }
    // With exactly the charge, the frame is admitted with and without kept draws, twice.
    const limits = Object.freeze({ ...LIMITS, [name]: total }), retention = new SharedPreparationRetention2D();
    for (let pass = 0; pass < 3; pass++) assert.deepEqual(both(engine.captureSharedFrame(SIZE), retention, limits).kept.value.budget, charged);
  }
}));

test('RETAIN R08 the rows kept with a draw are its own copy; the place of its region and its opacity are written for each frame', () => stage(({ engine, bitmap }) => {
  const a = bitmap(0, 0, { x: 10, y: 10 }), b = bitmap(0, 1, { x: 40, y: 10, alpha: 0.5 });
  const retention = new SharedPreparationRetention2D();
  const first = both(engine.captureSharedFrame(SIZE), retention).kept;
  const rows = draw => Array.from(draw.data), column = (draw, index) => Array.from({ length: draw.vertexCount }, (_value, vertex) => draw.data[13 * vertex + index]);
  const before = first.packed.map(rows);
  // Writing into the rows a Host was given does not reach what is kept.
  for (const draw of first.packed) draw.data.fill(-1);
  const second = both(engine.captureSharedFrame(SIZE), retention).kept;
  assert.deepEqual(second.packed.map(rows), before);
  // Another opacity, and a new first region that moves the others one place in the table.
  b.alpha = 0.125; const c = bitmap(0, 5, { x: 200, y: 200 }); engine.stage.setChildIndex(c, 0);
  const third = both(engine.captureSharedFrame(SIZE), retention).kept;
  assert.deepEqual(third.prepared.frame.commands.map(command => command.regionIndex), [0, 1, 2]);
  assert.deepEqual(third.packed.map(draw => [column(draw, 11)[0], column(draw, 12)[0]]), [[0, 1], [1, 1], [2, 0.125]]);
  assert.equal(polygons(third)[1], polygons(first)[0]); assert.equal(polygons(third)[2], polygons(first)[1]);
  assert.equal(a.x, 10);
}));

test('RETAIN R09 what is kept is bounded: draws beyond the bound are prepared for each frame, with the same result', () => stage(({ engine, bitmap }) => {
  assert.equal(SHARED_RETAINED_DRAWS_2D, 65536); assert.equal(SHARED_RETAINED_BYTES_2D, 33554432);
  // A frame of 20,000 bitmaps, about as many as the largest limits on one frame admit, keeps less than the limit.
  const one = new SharedPreparationRetention2D(); bitmap(0, 0, { x: 5, y: 5 });
  both(engine.captureSharedFrame(SIZE), one);
  assert.equal(one.draws, 1); assert.equal(one.bytes, 1136); assert.ok(20000 * one.bytes < SHARED_RETAINED_BYTES_2D);
  assert.throws(() => new SharedPreparationRetention2D(SHARED_RETAINED_BYTES_2D + 1), RangeError); assert.throws(() => new SharedPreparationRetention2D(-1), RangeError);
  // A lower limit, as a test may give. Geometry is kept first, 824 bytes a draw, then rows, 312 bytes a draw:
  // this limit has room for the geometry of fifteen draws and then for the rows of two of them.
  const count = 40, limit = 15 * 824 + 2 * 312 + 100;
  for (let i = 1; i < count; i++) bitmap(0, i % 8, { x: (i * 7) % 240, y: (i * 11) % 240 });
  const retention = new SharedPreparationRetention2D(limit), frame = engine.captureSharedFrame(SIZE);
  const first = both(frame, retention).kept;
  assert.equal(retention.draws, 15); assert.equal(retention.bytes, 15 * 824 + 2 * 312);
  const second = both(frame, retention).kept;
  assert.equal(retention.draws, 15); assert.equal(retention.bytes, 15 * 824 + 2 * 312);
  // The first fifteen draws are found. The others are prepared again, to the same values.
  assert.deepEqual(polygons(second).map((value, index) => value === polygons(first)[index]), Array.from({ length: count }, (_value, index) => index < 15));
  const none = new SharedPreparationRetention2D(0); both(frame, none); both(frame, none); assert.equal(none.draws, 0); assert.equal(none.bytes, 0);
}));

function random(seed) {
  let state = seed >>> 0;
  const next = () => { state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x9e3779b9 >>> 0; return state >>> 8; };
  const below = bound => next() % bound;
  return { below, pick: values => values[below(values.length)], chance: (numerator, denominator) => below(denominator) < numerator };
}
const MATERIALS = [{}, { light: [1, .5, .25, .5] }, { blend: 'add-accumulate' }, { samplingDomain: 'page' }, { samplingDomain: 'page', filter: 'linear', minFilter: 'linear', magFilter: 'linear', addressU: 'repeat', addressV: 'mirror-repeat' },
  { filter: 'linear', minFilter: 'linear', magFilter: 'linear', regionIsolation: 'strict' }].map(value => egret.createSharedMaterial2D(value));

test('RETAIN R10 scenes changed at random, frame after frame, are prepared with kept draws exactly as without', { timeout: 120000 }, async () => {
  let frames = 0, refusals = 0, found = 0, draws = 0;
  for (let seed = 1; seed <= 6; seed++) await stage(({ engine, add, bitmap, rect, leases, scope }) => {
    const r = random(seed * 104729 + 7), containers = [engine.stage], leaves = [];
    const geometry = egret.createSharedGeometry2D({ positions: new Float64Array([0, 0, 12, 0, 0, 12, 12, 12]), uvs: new Float64Array([0, 0, 1, 0, 0, 1, 1, 1]),
      lightColors: new Float64Array(16).fill(1), darkColors: new Float64Array(12), indices: new Uint16Array([0, 1, 2, 2, 1, 3]) });
    const place = () => ({ x: r.below(260) - 10 + r.below(4) / 4, y: r.below(260) - 10 + r.below(4) / 4 });
    const leaf = parent => {
      const kind = r.below(10);
      if (kind < 6) return bitmap(r.below(2), r.below(8), place(), parent);
      if (kind < 8) return rect(r.below(0xffffff), place(), parent);
      if (kind < 9) return add(new egret.Mesh2D(leases[r.below(2)][r.below(3)], geometry), place(), parent);
      return add(new egret.NineSliceBitmap(leases[0][4], { width: 20 + r.below(20), height: 16 + r.below(10), insets: { left: 2, top: 2, right: 2, bottom: 2 } }), place(), parent);
    };
    for (let i = 0; i < 4; i++) containers.push(add(new egret.DisplayObjectContainer(), place(), r.pick(containers)));
    for (let i = 0; i < 40; i++) leaves.push(leaf(r.pick(containers)));
    const every = () => [...containers.slice(1), ...leaves];
    const changes = [
      () => { const node = r.pick(every()); node.x += r.below(9) - 4; node.y += r.below(9) / 4; },
      () => { r.pick(every()).rotation = r.below(360); },
      () => { const node = r.pick(every()); node.scaleX = 0.5 + r.below(6) / 2; node.scaleY = r.chance(1, 8) ? 0 : 1 + r.below(3); },
      () => { r.pick(every()).alpha = r.pick([0, 0.25, 0.5, 1, 1]); },
      () => { const node = r.pick(every()); node.visible = !node.visible; },
      () => { r.pick(containers.slice(1)).clipRect = r.chance(1, 3) ? undefined : { x: r.below(40), y: r.below(40), width: r.below(200), height: r.below(200) }; },
      () => { r.pick(every()).renderBoundary = r.pick(['none', 'none', 'isolate']); },
      () => { r.pick(every()).sharedMaterial = r.chance(1, 3) ? null : r.pick(MATERIALS); },
      () => { const node = r.pick(leaves); if (node instanceof egret.Bitmap) node.textureLease = leases[r.below(2)][r.below(8)]; },
      () => { const node = r.pick(leaves); if (node instanceof egret.Sprite) { node.graphics.clear(); node.graphics.beginFill(r.below(0xffffff), r.pick([1, 0.5])).drawRect(0, 0, 4 + r.below(30), r.below(20)).endFill(); } },
      () => { const node = r.pick(leaves), parent = node.parent; if (parent) parent.removeChild(node); else r.pick(containers).addChild(node); },
      () => { const node = r.pick(leaves); if (node.parent) node.parent.setChildIndex(node, r.below(node.parent.numChildren)); },
      () => { leaves.push(leaf(r.pick(containers))); },
      () => { r.pick(every()).x = r.pick([1e300, -1e300, 5e15]); },
    ];
    const retention = new SharedPreparationRetention2D(), sizes = [SIZE, SIZE, SIZE, { width: 200, height: 300 }];
    let previous = [];
    for (let step = 0; step < 60; step++) {
      // Most frames change a little or nothing, some a lot; now and then the size changes.
      const count = r.pick([0, 0, 1, 1, 1, 2, 3, 12]);
      for (let i = 0; i < count; i++) { try { r.pick(changes)(); } catch (cause) { if (!(cause instanceof egret.EgretError)) throw cause; } }
      let frame; try { frame = engine.captureSharedFrame(SIZE); } catch (cause) { if (!(cause instanceof egret.EgretError)) throw cause; for (const node of every()) if (Math.abs(node.x) > 1e9) node.x = 0; continue; }
      const size = r.chance(1, 20) ? r.pick(sizes) : SIZE, limits = r.chance(1, 15) ? Object.freeze({ ...LIMITS, maxPreparedVertices: 60 + r.below(200) }) : LIMITS;
      const run = both(frame, retention, limits, size);
      frames++;
      if (typeof run.kept.value === 'string') { refusals++; for (const node of every()) if (Math.abs(node.x) > 1e9) node.x = 0; continue; }
      const now = polygons(run.kept); draws += now.length; found += now.filter(value => previous.includes(value)).length; previous = now;
    }
    assert.ok(scope);
  });
  // The comparison is only evidence if kept draws were found often, some frames were refused, and many frames were prepared.
  assert.ok(frames > 250, 'frames ' + frames); assert.ok(refusals > 10, 'refusals ' + refusals); assert.ok(found > draws / 3, 'found ' + found + ' of ' + draws);
});
