// SPDX-License-Identifier: Apache-2.0
// Public atlas-frame contracts: legacy compatibility, placement and binding identity.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

const PROFILE = 'trim-rotation-v1';
const OPTIONS = { width: 24, height: 16, clearColor: 0, clearAlpha: 0 };
const A = { x: 0, y: 0, width: 2, height: 3 };
const B = { x: 3, y: 0, width: 2, height: 3 };
const FULL = { x: 0, y: 0, width: 6, height: 6 };
const LA = { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 1, packedRotation: 0 };
const LB = { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 2, packedRotation: 90 };
// Spec's complete 6x6 raw RGBA, authored literally; no placement/sampler oracle.
const PIXELS = [
  255,0,0,255, 0,255,0,255, 0,0,0,0, 255,255,0,255, 255,0,0,255, 0,0,0,0,
  0,0,255,255, 255,255,0,255, 0,0,0,0, 255,0,255,255, 0,255,0,255, 0,0,0,0,
  255,0,255,255, 0,255,255,255, 0,0,0,0, 0,255,255,255, 0,0,255,255, 0,0,0,0,
  0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
  0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
  0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
];
let nextId = 0;
const frames = () => [
  { name: 'A', ...A, layout: { ...LA } },
  { name: 'B', ...B, layout: { ...LB } },
];
const clipInput = () => ({ atlasWidth: 6, atlasHeight: 6, frames: [
  { ...A, durationSeconds: 0.125, layout: { ...LA } },
  { ...B, durationSeconds: 0.25, layout: { ...LB } },
] });
function refusal(operation, code, clipFamily, cause) {
  let caught = false, error;
  try { operation(); } catch (value) { caught = true; error = value; }
  assert.equal(caught, true, 'must really throw, including a source throw undefined');
  if (clipFamily) {
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'SequenceClipError');
  } else assert.ok(error instanceof egret.EgretError);
  assert.equal(error.code, code);
  if (cause.length) {
    assert.equal(Object.hasOwn(error, 'cause'), true, 'a thrown undefined cause must be retained');
    assert.equal(error.cause, cause[0], 'retain exact source cause');
  }
  return error;
}
function refuses(operation, code, ...cause) { return refusal(operation, code, false, cause); }
function refusesClip(operation, code, ...cause) { return refusal(operation, code, true, cause); }
function matrix(actual, expected, tolerance = 0) {
  for (const key of ['a', 'b', 'c', 'd', 'tx', 'ty']) {
    assert.ok(Number.isFinite(actual[key]), `finite ${key}`);
    assert.ok(Math.abs(actual[key] - expected[key]) <= tolerance,
      `${key}: actual ${actual[key]}, literal ${expected[key]}`);
  }
}
function captures(f) {
  return [f.engine.captureFrame(OPTIONS), f.engine.captureTexturedFrame(OPTIONS)];
}
function onlyImage(frame) {
  assert.equal(frame.commands.length, 1);
  assert.equal(frame.commands[0].kind, 'image');
  return frame.commands[0];
}
async function scene(run) {
  const port = host(), diagnostics = [];
  const engine = await egret.createEngine({ host: port.adapter, onDiagnostic: value => diagnostics.push(value) });
  const resources = engine.createScope(), nodes = engine.createScope();
  const bindings = engine.createScope();
  let disposals = 0;
  const image = egret.createImageData2D({ width: 6, height: 6, pixels: new Uint8Array(PIXELS) });
  const texture = egret.createTexture(image);
  const type = egret.createAssetType('P04 heldout atlas', egret.isTexture);
  engine.assets.register(type, { load: async () => texture,
    dispose(value) { disposals++; value.dispose(); } });
  const ref = egret.createAssetRef(type, `heldout-atlas-${++nextId}`);
  try {
    const lease = resources.use(await engine.assets.acquire(ref));
    await run({ engine, resources, nodes, bindings, lease, ref, texture, image,
      sheet: () => nodes.use(egret.createSpriteSheet(lease, frames(), PROFILE)),
      clip: () => egret.createSequenceClip(clipInput(), PROFILE),
      attach(bitmap) { nodes.use(bitmap); engine.stage.addChild(bitmap); return bitmap; } });
  } finally {
    bindings.dispose(); nodes.dispose(); resources.dispose(); await engine.dispose();
    assert.equal(disposals, 1);
    assert.deepEqual(diagnostics, []);
    assert.deepEqual(port.trace, ['start', 'stop', 'close']);
    assert.equal(port.timers.size, 0);
  }
}

// Break: new metadata is probed in the default/explicit-undefined legacy path.
test('AH01 omitted and undefined profiles leave new throwing getters unread', async () => {
  await scene(async f => {
    for (const profile of ['omitted', 'undefined']) {
      let reads = 0;
      const sheetFrame = { name: 'old', ...A };
      const sequenceFrame = { ...A, durationSeconds: 0.125 };
      for (const record of [sheetFrame, sequenceFrame]) for (const key of ['layout', 'rotated', 'trimmed']) {
        Object.defineProperty(record, key, { get() { reads++; throw undefined; } });
      }
      const sheet = f.nodes.use(profile === 'omitted'
        ? egret.createSpriteSheet(f.lease, [sheetFrame])
        : egret.createSpriteSheet(f.lease, [sheetFrame], undefined));
      assert.deepEqual(sheet.getRegion('old'), { x: 0, y: 0, width: 2, height: 3 });
      const input = { atlasWidth: 6, atlasHeight: 6, frames: [sequenceFrame] };
      const clip = profile === 'omitted' ? egret.createSequenceClip(input)
        : egret.createSequenceClip(input, undefined);
      const bitmap = f.attach(sheet.createBitmap('old'));
      const player = f.nodes.use(new egret.SequencePlayer(bitmap, clip));
      assert.deepEqual(player.applyAt(0).region, { x: 0, y: 0, width: 2, height: 3 });
      assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [2, 3]);
      assert.equal(reads, 0);
      bitmap.dispose();
    }
  });
});

// Break: one shared validator makes SS validate early, clip stage late, or loses undefined.
test('AH02 SS stages the entire table while clip rejects each frame before reading the next', async () => {
  await scene(async f => {
    // Genuine successful controls prevent an always-rejecting profile from satisfying errors.
    assert.deepEqual(f.sheet().getRegion('B'), { ...B, layout: LB });
    const control = f.attach(new egret.Bitmap(f.lease));
    assert.equal(f.nodes.use(new egret.SequencePlayer(control, f.clip())).applyAt(0.125).frameIndex, 1);
    control.dispose();
    for (const defect of ['missing', 'array', 'rotation']) {
      const ss = frames(), seq = clipInput();
      for (const first of [ss[0], seq.frames[0]]) {
        if (defect === 'missing') delete first.layout;
        if (defect === 'array') first.layout = [];
        if (defect === 'rotation') first.layout.packedRotation = 45;
      }
      let sheetReads = 0, clipReads = 0;
      Object.defineProperty(ss[1].layout, 'sourceWidth', { get() { sheetReads++; throw undefined; } });
      Object.defineProperty(seq.frames[1].layout, 'sourceWidth', { get() { clipReads++; throw undefined; } });
      refuses(() => egret.createSpriteSheet(f.lease, ss, PROFILE), 'SPRITE_SHEET_READ_FAILED', undefined);
      assert.equal(sheetReads, 1);
      refusesClip(() => egret.createSequenceClip(seq, PROFILE),
        defect === 'rotation' ? 'SEQ_REGION_INVALID' : 'SEQ_INPUT_INVALID');
      assert.equal(clipReads, 0);
    }
    const seq = clipInput();
    Object.defineProperty(seq.frames[0].layout, 'trimY', { get() { throw undefined; } });
    refusesClip(() => egret.createSequenceClip(seq, PROFILE), 'SEQ_READ_FAILED', undefined);
  });
});

// Break: constructor incorrectly refuses the current cropped Bitmap or loses sheet layout.
test('AH03 a cropped sheet Bitmap is a legal player target and owns stable logical dimensions', async () => {
  await scene(async f => {
    const sheet = f.sheet(), bitmap = f.attach(sheet.createBitmap('A'));
    assert.equal(bitmap.textureLease, f.lease);
    assert.deepEqual(bitmap.sourceRect, { x: 0, y: 0, width: 2, height: 3 });
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [4, 5]);
    const clip = egret.createSequenceClip({ atlasWidth: 6, atlasHeight: 6, frames: [
      { ...sheet.getRegion('A'), durationSeconds: 0.125 },
      { ...sheet.getRegion('B'), durationSeconds: 0.25 },
    ] }, PROFILE);
    const player = f.nodes.use(new egret.SequencePlayer(bitmap, clip));
    assert.equal(player.lastSample, undefined);
    sheet.dispose();
    const saved = player.applyAt(0.125);
    assert.deepEqual(saved, { frameIndex: 1, region: { ...B, layout: LB },
      positionSeconds: 0.125, atEnd: false, stopped: false });
    assert.ok(Object.isFrozen(saved.region.layout));
    assert.deepEqual(bitmap.getBounds(), { x: 0, y: 0, width: 4, height: 5 });
    player.applyAt(0);
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [4, 5]);
    assert.deepEqual(saved.region, { ...B, layout: LB });
    assert.deepEqual(f.texture.sourceRect, { x: 0, y: 0, width: 6, height: 6 });
  });
});

// Break: cw90 sign/packed-width/trim is wrong, M*S order reversed, or image S contaminates clips.
test('AH04 both capture profiles retain literal packed placement and separate parent clip space', async () => {
  await scene(async f => {
    const parent = f.nodes.use(new egret.Sprite());
    parent.x = 2; parent.y = 2; f.engine.stage.addChild(parent);
    const bitmap = f.nodes.use(f.sheet().createBitmap('A')); parent.addChild(bitmap);
    const player = f.nodes.use(new egret.SequencePlayer(bitmap, f.clip()));
    for (const frame of captures(f)) {
      const command = onlyImage(frame);
      matrix(command.matrix, { a: 1, b: 0, c: 0, d: 1, tx: 3, ty: 3 });
      assert.deepEqual(command.sourceRect, { x: 0, y: 0, width: 2, height: 3 });
    }
    player.applyAt(0.125);
    for (const frame of captures(f)) {
      const command = onlyImage(frame);
      matrix(command.matrix, { a: 0, b: -1, c: 1, d: 0, tx: 3, ty: 6 });
      assert.deepEqual(command.rect, { x: 0, y: 0, width: 2, height: 3 });
      assert.deepEqual(command.sourceRect, { x: 3, y: 0, width: 2, height: 3 });
      assert.deepEqual([...egret.copyImageData2DPixels(frame.images[0])], PIXELS);
    }
    parent.rotation = 90; parent.anchorOffsetX = 1; parent.anchorOffsetY = 1;
    parent.clipRect = { x: 0, y: 0, width: 3, height: 4 };
    for (const frame of captures(f)) {
      const command = onlyImage(frame);
      // Only trig display transforms use <=1e-12; no native pixel tolerance is asserted here.
      matrix(command.matrix, { a: 1, b: 0, c: 0, d: 1, tx: -1, ty: 2 }, 1e-12);
      assert.equal(command.clips.length, 1);
      matrix(command.clips[0].matrix, { a: 0, b: 1, c: -1, d: 0, tx: 3, ty: 1 }, 1e-12);
      assert.deepEqual(command.clips[0].rect, { x: 0, y: 0, width: 3, height: 4 });
      assert.deepEqual(command.rect, { x: 0, y: 0, width: 2, height: 3 });
    }
    assert.deepEqual(bitmap.getBounds(), { x: 0, y: 0, width: 4, height: 5 });
  });
});

// Break: ordinary setter preserves hidden layout, exact-lease assignment fails to reset,
// or player cannot reapply its frame after either authorized ordinary mutation.
test('AH05 sourceRect and same exact lease reset layout before player reapplies it', async () => {
  await scene(async f => {
    const bitmap = f.attach(f.sheet().createBitmap('A'));
    const player = f.nodes.use(new egret.SequencePlayer(bitmap, f.clip()));
    player.applyAt(0.125);
    bitmap.sourceRect = { ...B, layout: LB };
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [2, 3]);
    assert.deepEqual(bitmap.getBounds(), { x: 0, y: 0, width: 2, height: 3 });
    for (const frame of captures(f)) matrix(onlyImage(frame).matrix,
      { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
    player.applyAt(0.125);
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [4, 5]);
    bitmap.textureLease = f.lease;
    assert.deepEqual(bitmap.sourceRect, FULL);
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [6, 6]);
    player.applyAt(0.125);
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [4, 5]);
    for (const frame of captures(f)) matrix(onlyImage(frame).matrix,
      { a: 0, b: -1, c: 1, d: 0, tx: 1, ty: 4 });
  });
});

// Break: opt-in player compares Texture equality instead of exact lease identity,
// or publishes a new lastSample before a refused application.
test('AH06 a different lease for the same Texture still refuses without committing sample', async () => {
  await scene(async f => {
    const bitmap = f.attach(f.sheet().createBitmap('A'));
    const player = f.nodes.use(new egret.SequencePlayer(bitmap, f.clip()));
    const previous = player.applyAt(0.125);
    const replacement = f.resources.use(await f.engine.assets.acquire(f.ref));
    assert.notEqual(replacement, f.lease); assert.equal(replacement.value, f.texture);
    bitmap.textureLease = replacement;
    refuses(() => player.applyAt(0), 'SEQ_BINDING_CHANGED');
    assert.equal(player.lastSample, previous);
    assert.equal(bitmap.textureLease, replacement);
    assert.deepEqual(bitmap.sourceRect, { x: 0, y: 0, width: 6, height: 6 });
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [6, 6]);
  });
});

// Break: same-crop fast path skips binding identity mutation while clearing layout,
// allowing a stale ticket to publish over a changed static layout Bitmap.
test('AH07 same packed crop clearing static sheet layout invalidates a captured ticket', async () => {
  await scene(async f => {
    const bitmap = f.attach(f.sheet().createBitmap('B'));
    const ticket = f.engine.captureBitmapBindings(f.bindings, [bitmap]);
    const candidate = f.resources.use(await f.engine.assets.acquire(f.ref));
    ticket.prepare([candidate]);
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [4, 5]);
    bitmap.sourceRect = { x: 3, y: 0, width: 2, height: 3 };
    assert.deepEqual(bitmap.sourceRect, { x: 3, y: 0, width: 2, height: 3 });
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [2, 3]);
    refuses(() => ticket.commit(), 'BITMAP_RESOURCE_BINDING_CHANGED');
    assert.equal(bitmap.textureLease, f.lease);
    assert.deepEqual(bitmap.sourceRect, { x: 3, y: 0, width: 2, height: 3 });
    ticket.dispose();
    assert.equal(bitmap.textureLease, f.lease, 'failed ticket owns no publication to clear');
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [2, 3]);
  });
});
