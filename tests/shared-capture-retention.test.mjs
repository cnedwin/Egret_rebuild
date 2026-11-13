// SPDX-License-Identifier: Apache-2.0
// UNIT: what the shared capture keeps of each node between frames, and that a frame captured with kept
// records holds exactly what a frame captured without them holds, refusals included.
// Scenes are built and changed through the public SDK. The one private import is the built runtime collector
// that captures the Engine's own Stage without reading or writing kept records.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { collectFreshSharedFrameContent } from '../packages/runtime/dist/sharedFrameCapture.js';

const SIZE = { width: 256, height: 256 };
let stages = 0;
async function stage(body) {
  const engine = await egret.createEngine({ host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } } }), scope = engine.createScope();
  const images = [[64, 64], [96, 32]].map(([width, height], page) => egret.createImageData2D({ width, height, pixels: new Uint8Array(width * height * 4).fill(60 + 90 * page) }));
  const textures = [], type = egret.createAssetType('shared-capture-retention-' + ++stages, egret.isTexture);
  engine.assets.register(type, { async load(ref) {
    const [page, cell] = ref.id.split(':').map(Number);
    const texture = cell === 7 ? egret.createTexture(images[page]) : egret.createTextureView(images[page], { packed: { x: 8 * (cell % 4), y: 8 * (cell >> 2), width: 8, height: 8 }, logicalWidth: 8 + (cell % 2), logicalHeight: 8, trimX: cell % 2, trimY: 0, quarterTurn: cell === 3 ? 1 : 0 });
    textures.push(texture); return texture;
  }, dispose(value) { value.dispose(); } });
  try {
    const leases = [[], []];
    for (let page = 0; page < 2; page++) for (let cell = 0; cell < 8; cell++) leases[page].push(scope.use(await engine.assets.acquire(egret.createAssetRef(type, page + ':' + cell), { signal: scope.signal })));
    const add = (node, change = {}, parent = engine.stage) => { scope.use(node); Object.assign(node, change); parent.addChild(node); return node; };
    return await body({ engine, scope, leases, add, type,
      bitmap: (page, cell, change, parent) => add(new egret.Bitmap(leases[page][cell]), change, parent),
      rect: (color, change, parent) => { const node = new egret.Sprite(); node.graphics.beginFill(color, 1).drawRect(0, 0, 10, 6).endFill(); return add(node, change, parent); } });
  } finally { scope.dispose(); await engine.dispose(); for (const texture of textures) if (!texture.isDisposed) texture.dispose(); }
}
const code = cause => cause instanceof egret.EgretError ? 'refused:' + cause.code : (() => { throw cause; })();
/** The content of the frame captured without kept records, then with them; equal, or the same refusal. */
function both(engine) {
  let fresh, kept;
  try { fresh = collectFreshSharedFrameContent(engine.stage); } catch (cause) { fresh = code(cause); }
  try { const { frameId, profile, colorRecipe, targetRepresentation, outputRepresentation, width, height, clearColor, clearAlpha, outputAlpha, ...content } = engine.captureSharedFrame(SIZE); kept = content; } catch (cause) { kept = code(cause); }
  assert.deepEqual(kept, fresh);
  return kept;
}

test('KEEP K01 a scene that is the same again gives its commands again, in a new frame and a new list', () => stage(({ engine, bitmap, rect, add }) => {
  for (let i = 0; i < 6; i++) bitmap(i % 2, i, { x: 20 * i, y: 9 * i, rotation: 7 * i, alpha: 1 - i / 20 });
  rect(0x336699, { x: 40, y: 200 });
  const clipped = add(new egret.DisplayObjectContainer(), { clipRect: { x: 10, y: 10, width: 60, height: 40 }, renderBoundary: 'isolate' });
  bitmap(0, 1, { x: 30, y: 30, scaleX: 9 }, clipped); rect(0x112233, { x: 3 }, clipped);
  const first = engine.captureSharedFrame(SIZE), second = engine.captureSharedFrame(SIZE);
  assert.notEqual(second, first); assert.notEqual(second.commands, first.commands); assert.notEqual(second.regions, first.regions);
  assert.equal(second.frameId, first.frameId + 1);
  assert.equal(second.commands.length, 13);
  second.commands.forEach((command, index) => {
    assert.deepEqual(command, first.commands[index]);
    // A draw is the record of the frame before. A barrier is made for each frame.
    assert.equal(command === first.commands[index], command.kind !== 'barrier', 'command ' + index);
    assert.ok(Object.isFrozen(command));
  });
  // The two draws under the clip share its one list of clips, in both frames.
  assert.equal(second.commands[9].clips, second.commands[10].clips); assert.equal(second.commands[9].clips, first.commands[9].clips);
  assert.equal(second.commands[9].clips.length, 1); assert.equal(second.commands[0].clips.length, 0);
  both(engine);
  // A capture without kept records gives records of its own, and leaves what is kept as it was.
  const fresh = collectFreshSharedFrameContent(engine.stage);
  fresh.commands.forEach((command, index) => assert.notEqual(command, second.commands[index]));
  const third = engine.captureSharedFrame(SIZE);
  third.commands.forEach((command, index) => assert.equal(command === second.commands[index], command.kind !== 'barrier'));
}));

test('KEEP K02 a node that changed gives new commands with the values of a capture without kept records, and no other node does', () => stage(({ engine, bitmap, rect, add, leases }) => {
  const nodes = []; for (let i = 0; i < 6; i++) nodes.push(bitmap(0, i, { x: 20 * i, y: 100 }));
  const box = rect(0x224466, { x: 10, y: 10 });
  const group = add(new egret.DisplayObjectContainer()); bitmap(1, 2, { x: 90, y: 40 }, group); rect(0x445566, { x: 5, y: 60 }, group);
  let before = engine.captureSharedFrame(SIZE);
  const draws = frame => frame.commands.filter(command => command.kind !== 'barrier');
  const expectChanged = (changed, label) => {
    both(engine);
    const after = engine.captureSharedFrame(SIZE), was = draws(before), now = draws(after);
    assert.equal(now.length, was.length, label);
    assert.deepEqual(now.map((command, index) => command !== was[index] ? index : -1).filter(index => index >= 0), changed, label);
    before = after;
  };
  expectChanged([], 'nothing changed');
  nodes[3].x += 0.5; expectChanged([3], 'x'); nodes[3].y -= 2; expectChanged([3], 'y');
  nodes[5].rotation = 30; expectChanged([5], 'rotation'); nodes[1].scaleX = 2; expectChanged([1], 'scaleX'); nodes[1].scaleY = 3; expectChanged([1], 'scaleY');
  nodes[4].anchorOffsetX = 2; expectChanged([4], 'anchorOffsetX'); nodes[4].anchorOffsetY = 1; expectChanged([4], 'anchorOffsetY');
  nodes[0].alpha = 0.5; expectChanged([0], 'alpha');
  // The new region takes the place of the old one in the frame's table, so no other command names another region.
  nodes[2].textureLease = leases[0][6]; expectChanged([2], 'another region'); nodes[2].textureLease = leases[1][7]; expectChanged([2], 'a whole page of another image');
  nodes[2].sourceRect = { x: 1, y: 1, width: 4, height: 4 }; expectChanged([2], 'another crop');
  box.graphics.clear(); box.graphics.beginFill(0x224467, 1).drawRect(0, 0, 10, 6).endFill(); expectChanged([6], 'graphics replaced');
  // A material met after the default one takes the next place in the frame's table and moves no other.
  box.sharedMaterial = egret.createSharedMaterial2D({ blend: 'screen' }); expectChanged([6], 'another material');
  // A parent that moves, fades or takes another material changes every draw below it and no other.
  group.x = 3; expectChanged([7, 8], 'a parent moved'); group.alpha = 0.5; expectChanged([7, 8], 'a parent faded');
  group.sharedMaterial = egret.createSharedMaterial2D({ filter: 'linear', minFilter: 'linear', magFilter: 'linear' }); expectChanged([7, 8], 'a parent given a material');
  // Signed zero is another value: the matrix is derived again, to the same numbers a capture without kept records derives.
  nodes[5].x = 0; expectChanged([5], 'zero'); nodes[5].x = -0; expectChanged([5], 'negative zero'); nodes[5].x = -0; expectChanged([], 'negative zero again');
  expectChanged([], 'nothing changed');
}));

test('KEEP K03 a command is given again only at its own place: a node added before it, a region table or a material table that moved, make it anew', () => stage(({ engine, bitmap, rect, add }) => {
  const a = bitmap(0, 0, { x: 10 }), b = bitmap(0, 1, { x: 30 }), c = rect(0x101010, { x: 50 });
  const first = engine.captureSharedFrame(SIZE);
  const extra = bitmap(0, 2, { x: 70 }); engine.stage.setChildIndex(extra, 0);
  both(engine);
  const second = engine.captureSharedFrame(SIZE);
  assert.deepEqual(second.commands.map(command => [command.ordinal, command.regionIndex]), [[0, 0], [1, 1], [2, 2], [3, undefined]]);
  for (const command of second.commands) assert.equal(first.commands.includes(command), false);
  // The records below a command are still the kept ones: the matrix and the rectangle of each node.
  assert.equal(second.commands[1].matrix, first.commands[0].matrix); assert.equal(second.commands[1].rect, first.commands[0].rect);
  assert.equal(second.commands[3].matrix, first.commands[2].matrix); assert.equal(second.commands[3].rect, first.commands[2].rect);
  // A material met first by an earlier node moves the indexes of the materials after it.
  b.sharedMaterial = egret.createSharedMaterial2D({ blend: 'screen' }); both(engine);
  const third = engine.captureSharedFrame(SIZE);
  extra.sharedMaterial = egret.createSharedMaterial2D({ blend: 'multiply-factor' }); both(engine);
  const fourth = engine.captureSharedFrame(SIZE);
  assert.deepEqual(third.commands.map(command => command.materialIndex), [0, 0, 1, 0]); assert.deepEqual(fourth.commands.map(command => command.materialIndex), [0, 1, 2, 1]);
  // The first command names material 0 in both frames, and is the same record: which material that is, the frame's table says.
  assert.deepEqual(fourth.commands.map((command, index) => command === third.commands[index]), [true, false, false, false]);
  assert.notEqual(fourth.materials[0], third.materials[0]);
  assert.equal(a.x, 10); assert.equal(c.x, 50);
}));

test('KEEP K04 nothing kept stands for a check: a node whose resource, text or tree is no longer valid is refused as without kept records', () => stage(async ({ engine, scope, bitmap, add, type }) => {
  const still = bitmap(0, 0, { x: 10 });
  const own = engine.createScope(), lease = own.use(await engine.assets.acquire(egret.createAssetRef(type, '1:5'), { signal: scope.signal }));
  const leased = add(new egret.Bitmap(lease), { x: 40 });
  engine.captureSharedFrame(SIZE); engine.captureSharedFrame(SIZE);
  // The lease is released behind a node that did not change.
  own.dispose();
  assert.equal(both(engine), 'refused:ASSET_LEASE_RELEASED');
  engine.stage.removeChild(leased);
  assert.equal(typeof both(engine), 'object');
  // More pages than a frame admits: the count is taken for every frame, whatever is kept.
  const images = []; for (let i = 0; i < 65; i++) images.push(egret.createImageData2D({ width: 2, height: 2, pixels: new Uint8Array(16).fill(i) }));
  const many = egret.createAssetType('shared-capture-retention-many-' + stages, egret.isTexture), made = [];
  engine.assets.register(many, { async load(ref) { const texture = egret.createTexture(images[Number(ref.id)]); made.push(texture); return texture; }, dispose(value) { value.dispose(); } });
  const nodes = []; for (let i = 0; i < 64; i++) nodes.push(add(new egret.Bitmap(scope.use(await engine.assets.acquire(egret.createAssetRef(many, String(i)), { signal: scope.signal }))), { x: i }));
  assert.equal(both(engine), 'refused:FRAME_IMAGE_BUDGET');
  engine.stage.removeChild(still);
  const admitted = both(engine); assert.equal(admitted.pages.length, 64);
  engine.stage.addChild(still);
  assert.equal(both(engine), 'refused:FRAME_IMAGE_BUDGET');
  for (const texture of made) if (!texture.isDisposed) texture.dispose();
  assert.equal(nodes.length, 64);
}));

test('KEEP K06 a node at rest is still checked: a texture or a node disposed behind it is refused as without kept records', () => stage(async ({ engine, scope, bitmap, rect, add, leases, type }) => {
  for (let i = 0; i < 6; i++) bitmap(0, i, { x: 12 * i });
  const group = add(new egret.DisplayObjectContainer(), { x: 5 });
  rect(0x336699, { x: 3 }, group); const inner = bitmap(1, 2, { y: 30 }, group);
  // Three captures: every node gives its commands, then gives them again, at rest.
  const first = both(engine), second = both(engine), third = both(engine);
  third.commands.forEach((command, index) => { assert.equal(command, second.commands[index]); assert.equal(command, first.commands[index]); });
  // A texture disposed behind a bitmap that did not change.
  const own = engine.createScope(), lease = own.use(await engine.assets.acquire(egret.createAssetRef(type, '1:6'), { signal: scope.signal }));
  const leased = add(new egret.Bitmap(lease), { x: 90 });
  both(engine); both(engine);
  lease.value.dispose();
  assert.equal(both(engine), 'refused:TEXTURE_DISPOSED'); assert.equal(both(engine), 'refused:TEXTURE_DISPOSED');
  engine.stage.removeChild(leased); own.dispose();
  const after = both(engine);
  after.commands.forEach((command, index) => assert.equal(command, third.commands[index], 'the nodes before it rest as they did'));
  // A node disposed where it stands, behind nodes that did not change.
  const short = engine.createScope(), node = short.use(new egret.Sprite());
  node.graphics.beginFill(0x112233, 1).drawRect(0, 0, 4, 4).endFill(); group.addChild(node);
  both(engine); both(engine);
  short.dispose();
  const disposed = both(engine);
  assert.ok(disposed === 'refused:OBJECT_DISPOSED' || typeof disposed === 'object', String(disposed));
  if (node.parent) node.parent.removeChild(node);
  assert.equal(typeof both(engine), 'object'); assert.equal(inner.y, 30);
}));

test('KEEP K07 a node at rest is still charged: draws that no longer fit the frame behind a change before them are refused as without kept records', { timeout: 120000 }, () => stage(({ engine, rect, add }) => {
  // One draw outside every clip, then 32,768 draws under eight clips: eight clip references each, the most a frame admits.
  const outside = add(new egret.DisplayObjectContainer()), mover = rect(0x445566, { x: 1 }, outside);
  let innermost = engine.stage;
  for (let depth = 0; depth < 8; depth++) innermost = add(new egret.DisplayObjectContainer(), { clipRect: { x: 0, y: 0, width: 200 + depth, height: 200 } }, innermost);
  for (let i = 0; i < 32768; i++) rect(0x778899, { x: i % 180, y: (i >> 8) % 180 }, innermost);
  const first = both(engine); assert.equal(typeof first, 'object');
  const second = both(engine);
  assert.equal(second.commands[20000], first.commands[20000]); assert.equal(second.commands.length, 1 + 16 + 32768);
  // The first draw moves under the eight clips, to the front of the others. Every other draw has the place and the
  // inputs it had, and rests; with eight more clip references before them, the last of them no longer fits.
  innermost.addChildAt(mover, 0);
  assert.equal(both(engine), 'refused:FRAME_BUDGET_EXCEEDED'); assert.equal(both(engine), 'refused:FRAME_BUDGET_EXCEEDED');
  outside.addChild(mover);
  const back = both(engine); assert.equal(typeof back, 'object');
  assert.equal(back.commands[20000], first.commands[20000]);
}));

function random(seed) {
  let state = seed >>> 0;
  const next = () => { state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x9e3779b9 >>> 0; return state >>> 8; };
  const below = bound => next() % bound;
  return { below, pick: values => values[below(values.length)], chance: (numerator, denominator) => below(denominator) < numerator };
}
const MATERIALS = [{}, { light: [1, .5, .25, .5] }, { blend: 'add-accumulate' }, { samplingDomain: 'page' }, { filter: 'linear', minFilter: 'linear', magFilter: 'linear', regionIsolation: 'strict' }].map(value => egret.createSharedMaterial2D(value));

test('KEEP K05 scenes changed at random, frame after frame, are captured with kept records exactly as without', { timeout: 120000 }, async () => {
  let frames = 0, refusals = 0, again = 0, draws = 0;
  for (let seed = 1; seed <= 8; seed++) await stage(({ engine, add, bitmap, rect, leases }) => {
    const r = random(seed * 15485863 + 11), containers = [engine.stage], leaves = [];
    const geometry = egret.createSharedGeometry2D({ positions: new Float64Array([0, 0, 12, 0, 0, 12, 12, 12]), uvs: new Float64Array([0, 0, 1, 0, 0, 1, 1, 1]),
      lightColors: new Float64Array(16).fill(1), darkColors: new Float64Array(12), indices: new Uint16Array([0, 1, 2, 2, 1, 3]) });
    const place = () => ({ x: r.below(260) - 10 + r.below(4) / 4, y: r.below(260) - 10 + r.below(4) / 4 });
    const leaf = parent => {
      const kind = r.below(10);
      if (kind < 5) return bitmap(r.below(2), r.below(8), place(), parent);
      if (kind < 8) { const node = rect(r.below(0xffffff), place(), parent); if (r.chance(1, 2)) node.graphics.beginFill(r.below(0xffffff), 0.5).drawRect(4, 4, r.below(9), 8).endFill(); return node; }
      if (kind < 9) return add(new egret.Mesh2D(leases[r.below(2)][r.below(3)], geometry), place(), parent);
      return add(new egret.NineSliceBitmap(leases[0][4], { width: 20 + r.below(20), height: 16 + r.below(10), insets: { left: 2, top: 2, right: 2, bottom: 2 } }), place(), parent);
    };
    for (let i = 0; i < 5; i++) containers.push(add(new egret.DisplayObjectContainer(), place(), r.pick(containers)));
    for (let i = 0; i < 40; i++) leaves.push(leaf(r.pick(containers)));
    const every = () => [...containers.slice(1), ...leaves];
    const changes = [
      () => { const node = r.pick(every()); node.x += r.below(9) - 4; node.y += r.below(9) / 4; },
      () => { r.pick(every()).rotation = r.below(720) - 360; },
      () => { const node = r.pick(every()); node.scaleX = r.pick([0, -1, 0.5, 2]); node.scaleY = 1 + r.below(3); },
      () => { const node = r.pick(every()); node.anchorOffsetX = r.below(5); node.anchorOffsetY = r.below(5); },
      () => { r.pick(every()).alpha = r.pick([0, 0.25, 0.5, 1, 1]); },
      () => { const node = r.pick(every()); node.visible = !node.visible; },
      () => { r.pick(containers.slice(1)).clipRect = r.chance(1, 3) ? undefined : { x: r.below(40), y: r.below(40), width: r.pick([0, 50, 200]), height: r.below(200) }; },
      () => { r.pick(every()).renderBoundary = r.pick(['none', 'none', 'isolate']); },
      () => { r.pick(every()).sharedMaterial = r.chance(1, 3) ? null : r.pick(MATERIALS); },
      () => { const node = r.pick(leaves); if (node instanceof egret.Bitmap) node.textureLease = leases[r.below(2)][r.below(8)]; },
      () => { const node = r.pick(leaves); if (node instanceof egret.Bitmap && node.textureLease) node.sourceRect = r.chance(1, 3) ? undefined : { x: r.below(3), y: r.below(3), width: 1 + r.below(4), height: 1 + r.below(4) }; },
      () => { const node = r.pick(leaves); if (node instanceof egret.Sprite) { if (r.chance(1, 2)) node.graphics.clear(); node.graphics.beginFill(r.below(0xffffff), r.pick([1, 0.5, 0])).drawRect(0, 0, r.below(30), r.below(20)).endFill(); } },
      () => { const node = r.pick(leaves), parent = node.parent; if (parent) parent.removeChild(node); else r.pick(containers).addChild(node); },
      () => { const node = r.pick(leaves); if (node.parent) node.parent.setChildIndex(node, r.below(node.parent.numChildren)); },
      () => { const node = r.pick(leaves); r.pick(containers).addChild(node); },
      () => { leaves.push(leaf(r.pick(containers))); },
      () => { r.pick(every()).x = r.pick([1e308, -1e308, Number.MAX_VALUE]); },
    ];
    let previous = [];
    for (let step = 0; step < 80; step++) {
      const count = r.pick([0, 0, 1, 1, 1, 2, 3, 12]);
      for (let i = 0; i < count; i++) { try { r.pick(changes)(); } catch (cause) { if (!(cause instanceof egret.EgretError)) throw cause; } }
      const content = both(engine); frames++;
      if (typeof content === 'string') { refusals++; for (const node of every()) if (Math.abs(node.x) > 1e9) node.x = 0; continue; }
      const now = content.commands.filter(command => command.kind !== 'barrier'); draws += now.length; again += now.filter(command => previous.includes(command)).length; previous = now;
    }
  });
  // The comparison is only evidence if commands were often given again, some frames were refused, and many frames were captured.
  assert.ok(frames >= 600, 'frames ' + frames); assert.ok(refusals > 10, 'refusals ' + refusals); assert.ok(again > draws / 4, 'again ' + again + ' of ' + draws);
});
