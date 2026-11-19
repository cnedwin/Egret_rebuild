// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeProjectFrame } from './project-frame.mjs';

const matrix = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
const page = {width: 8, height: 4};
const other = {width: 8, height: 4};
const ids = new Map([[other, 5], [page, 17]]);
const material = { light: [1, 1, 1, 1], dark: [0, 0, 0], blend: 'normal', filter: 'nearest',
  magFilter: 'nearest', minFilter: 'nearest', addressU: 'clamp-to-edge', addressV: 'clamp-to-edge',
  mipLevel: 0, maxAnisotropy: 1 };
const rect = {x: 0, y: 0, width: 8, height: 4};
const region = {pageIndex: 0, packed: {x: 2, y: 1, width: 4, height: 2}, quarterTurn: 0,
  trimX: 0, trimY: 0, logicalWidth: 4, logicalHeight: 2};
const image = {kind: 'image', rect, regionIndex: 0, materialIndex: 0, opacity: 0.75, matrix, clips: []};
const solid = {...image, kind: 'rect', fillColor: 0x204080, fillAlpha: 0.5};
const frame = { profile: 'egret.shared-frame2d/1', colorRecipe: 'egret.linear-srgb-pma/1',
  targetRepresentation: 'egret.srgb-pma8-target/1', width: 80, height: 64, outputAlpha: 'opaque',
  clearColor: 0x102030, clearAlpha: 1, pages: [page, other].map(source => ({source})),
  regions: [region, {...region, pageIndex: 1}], materials: [material], commands: [] };
const encode = (commands, override = {}, pages = ids) =>
  new DataView(encodeProjectFrame({...frame, commands, ...override}, 42, pages).buffer);

test('project records preserve device page identity, fractional opacity, affine corners and nested scroll clips', () => {
  const clip = {matrix: {...matrix, a: -2, d: 3, tx: 12}, rect: {x: 1, y: 1, width: 3, height: 4}};
  const clip2 = {matrix, rect: {x: 5, y: 5, width: 3, height: 12}};
  const cmd = {...image, clips: [clip, clip2], matrix: {a: 1, b: 2, c: -1, d: 3, tx: 11, ty: 7}};
  const bytes = encode([{kind: 'barrier', reason: 'clip-enter'}, cmd, solid, {...image, regionIndex: 1},
    {kind: 'barrier', reason: 'clip-exit'}]);
  assert.equal(bytes.byteLength, 24 + 3 * 64);
  const words = Array.from({length: 6}, (_, i) => bytes.getUint32(i * 4, true));
  assert.deepEqual(words, [0x32524745, 42, 80, 64, 0x102030ff, 3]);
  assert.equal(bytes.getUint8(24), 17);
  assert.equal(bytes.getUint8(24 + 64), 0);
  assert.equal(bytes.getUint8(24 + 128), 5);
  assert.deepEqual([1, 2, 3].map(i => bytes.getUint8(24+64+i)), [32, 64, 128]);
  assert.equal(bytes.getFloat32(24 + 64 + 4, true), 0.375);
  assert.deepEqual(Array.from({length: 15}, (_, i) => bytes.getFloat32(24 + 4 + i*4, true)),
    [0.75, 11, 7, 19, 23, 7, 19, 0.25, 0.25, 0.75, 0.75, 5, 5, 8, 15]);
});

test('empty intersection clips to zero and unsupported commands, materials, atlas transforms and missing pages fail', () => {
  const bytes = encode([{...solid, clips: [{matrix, rect: {x: 90, y: 4, width: 3, height: 2}}]}]);
  assert.equal(bytes.getFloat32(24+48, true), bytes.getFloat32(24+56, true));
  for (const command of [{...image, kind: 'mesh'}, {kind:'barrier',reason:'effect-enter'},
    {...image, clips: [{matrix: {...matrix, c: 1}, rect}]}]) assert.throws(() => encode([command]), /Unsupported/);
  assert.throws(() => encode([image], {materials: [{...material, blend: 'erase'}]}), /Unsupported/);
  assert.throws(() => encode([image], {materials: [{...material, samplingDomain: 'page'}]}), /Unsupported/);
  assert.throws(() => encode([image], {regions: [{...region, quarterTurn: 1}]}), /Unsupported/);
  assert.throws(() => encode([image], {}, new Map([[other, 5]])), /page/);
  assert.throws(() => encode([image], {}, new Map([[page, 5], [other, 5]])), /page/);
  assert.throws(() => encode(Array(4097).fill(solid)), /limit/);
});

test('a genuine engine capture retains the leased image identity when draw order and visible page set change', async () => {
  const { createAssetType, createAssetRef, createEngine, createImageData2D, createTexture,
    isTexture, Bitmap, Sprite } = await import('@egret/engine');
  const { captureHost } = await import('./scene.mjs');
  const engine = await createEngine({host: captureHost()});
  const scope = engine.createScope();
  const refs = [], resident = new Map();
  let releases = 0;
  try {
    for (const slot of [51, 3]) {
      const source = createImageData2D({width: 1, height: 1, pixels: Uint8Array.of(slot, 2, 3, 127)});
      resident.set(source, slot);
      const type = createAssetType('project-frame-test-' + slot, isTexture);
      engine.assets.register(type, {async load() { return createTexture(source); },
        dispose(texture) { texture.dispose(); releases++; }});
      refs.push(createAssetRef(type, 'page-' + slot));
    }
    const leases = await engine.createAssetGroup(scope, refs).ready;
    const group = scope.use(new Sprite());
    group.x = 4;
    group.y = 7;
    group.alpha = 0.5;
    group.clipRect = {x: 0, y: 0, width: 18, height: 8};
    engine.stage.addChild(group);
    const sprites = leases.map(lease => {
      const bitmap = scope.use(new Bitmap(lease));
      group.addChild(bitmap);
      return bitmap;
    });
    const capture = () => new DataView(encodeProjectFrame(engine.captureSharedFrame({width: 32, height: 32}),
      12, resident).buffer);
    const both = capture();
    assert.deepEqual([both.getUint8(24), both.getUint8(88)], [51, 3]);
    assert.deepEqual([48, 52, 56, 60].map(i => both.getFloat32(24+i, true)), [4, 7, 22, 15]);
    sprites[0].visible = false;
    const only = capture();
    assert.equal(only.byteLength, 88);
    assert.equal(only.getUint8(24), 3);
    assert.equal(only.getFloat32(28, true), 0.5);
  } finally {
    scope.dispose();
    await engine.dispose();
  }
  assert.equal(releases, 2);
});
