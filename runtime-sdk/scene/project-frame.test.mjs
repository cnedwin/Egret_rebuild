// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCapturedProjectEncoder, encodeProjectFrame } from './project-frame.mjs';

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
  assert.throws(() => encode([image], {regions: [{...region, quarterTurn: 1}]}), /atlas/);
  assert.throws(() => encode([image], {}, new Map([[other, 5]])), /page/);
  assert.throws(() => encode([image], {}, new Map([[page, 5], [other, 5]])), /page/);
  assert.throws(() => encode(Array(4097).fill(solid)), /limit/);
});

test('sparse EGR3 entries preserve logical corners, packed UVs and drawable order on cache hits', () => {
  const packed = {...region, trimX: 1, trimY: 2, logicalWidth: 9, logicalHeight: 8};
  const regions = [region, ...[0, 1, 2, 3].map(quarterTurn => ({...packed, quarterTurn}))];
  const draws = regions.map((_, regionIndex) => ({...image, regionIndex}));
  const commands = [solid, draws[1], {kind: 'barrier', reason: 'explicit-enter'}, draws[0], ...draws.slice(2)];
  const input = {...frame, commands, regions}, writer = createCapturedProjectEncoder();
  const originalRecords = encode([solid, ...Array(5).fill(image)]);
  const tableStart = originalRecords.byteLength;
  for (let i = 0; i < 3; i++) {
    const packet = writer.encode(input, 42, ids), view = new DataView(packet.buffer);
    assert.deepEqual(packet, encodeProjectFrame(input, 42, ids));
    assert.equal(view.getUint32(0, true), 0x33524745);
    assert.equal(view.getUint32(20, true), 6);
    assert.equal(packet.length, tableStart + 4*24);
    assert.deepEqual(packet.slice(4, tableStart), new Uint8Array(originalRecords.buffer).slice(4));
    const words = Array.from({length: 24}, (_, word) => view.getUint32(tableStart + word*4, true));
    assert.deepEqual(words, [1,9,8,1,2,0, 3,9,8,1,2,1, 4,9,8,1,2,2, 5,9,8,1,2,3]);
    packet.fill(0); // Cached commands and atlas metadata belong to the encoder.
  }
  const changed = {...input, regions: regions.map(r => ({...r, trimY: 0}))};
  assert.deepEqual(writer.encode(changed, 43, ids), encodeProjectFrame(changed, 43, ids));
  const plain = {...input, regions: regions.map(() => region)};
  assert.deepEqual(writer.encode(plain, 42, ids), new Uint8Array(originalRecords.buffer));
});

test('atlas metadata rejects out-of-range texels, malformed logical sizes and transformed page-domain draws', () => {
  const mapped = {...region, quarterTurn: 1, trimX: 1, trimY: 2, logicalWidth: 3, logicalHeight: 6};
  for (const fields of [{quarterTurn: 4}, {quarterTurn: 0.5}, {logicalWidth: 2}, {logicalHeight: 5},
    {trimX: -1}, {trimY: 0.5}, {trimX: Number.NaN}, {logicalWidth: 1048577}, {logicalHeight: 0}]) {
    assert.throws(() => encode([image], {regions: [{...mapped, ...fields}]}), /atlas/);
  }
  for (const fields of [{x: -1}, {x: 1.5}, {width: 0}, {width: 7}, {height: 4}]) {
    assert.throws(() => encode([image], {regions: [{...mapped, packed: {...region.packed, ...fields}}]}), /atlas/);
  }
  const wholePage = {...region, packed: {x: 0, y: 0, width: 8, height: 4}, logicalWidth: 8, logicalHeight: 4};
  const materials = [{...material, samplingDomain: 'page'}];
  assert.equal(encode([image], {regions: [wholePage], materials}).getUint32(0, true), 0x32524745);
  for (const fields of [{trimX: 1, logicalWidth: 9}, {logicalHeight: 8}, {quarterTurn: 2}]) {
    assert.throws(() => encode([image], {regions: [{...wholePage, ...fields}], materials}), /page/);
  }
  const maximum = encode(Array(4096).fill(image), {regions: [{...mapped, logicalWidth: 1048576}]});
  const last = maximum.byteLength - 24;
  assert.equal(maximum.byteLength, 24 + 4096*(64 + 24));
  assert.equal(maximum.getUint32(last, true), 4095);
  assert.equal(maximum.getUint32(last + 4, true), 1048576);
});

test('captured quads follow current atlas bindings and viewport even when the command is reused', () => {
  const writer = createCapturedProjectEncoder();
  let id = 0;
  function compare(input, slots = ids) {
    const expected = encodeProjectFrame(input, ++id, slots);
    const actual = writer.encode(input, id, slots);
    assert.deepEqual(actual, expected);
    return actual;
  }
  const input = {...frame, commands: [image, solid]};
  compare(input);
  compare(input).fill(255); // The consumer can overwrite even the packet which warmed the cache.
  compare(input).fill(128);
  compare(input);
  compare({...input, width: 40, height: 20});
  compare(input, new Map([[page, 12], [other, 6]]));
  const shifted = {...region, packed: {...region.packed, x: 0}};
  compare({...input, regions: [shifted]});
  const larger = {width: 16, height: 8};
  compare({...input, pages: [{source: larger}]}, new Map([[larger, 17]]));
  compare({...input, commands: [solid, image]});
  compare({...input, commands: []});
  compare(input);
  assert.throws(() => writer.encode({...input, materials: [{...material, blend: 'erase'}]}, id, ids), /material/);
  assert.throws(() => writer.encode({...input, regions: [{...region, quarterTurn: 1}]}, id, ids), /atlas/);
  assert.throws(() => writer.encode(input, id, new Map()), /page/);
  writer.clear();
  compare(input);
  const invalid = {...input, materials: [], get regions() { throw new Error('Region read too early'); }};
  assert.throws(() => encodeProjectFrame(invalid, id, ids), /Unsupported project material/);
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

test('a public sprite sheet and sequence keep their logical frame when its packed rotation changes', async () => {
  const {createAssetType, createAssetRef, createEngine, createImageData2D, createTexture,
    createSpriteSheet, createSequenceClip, isTexture, SequencePlayer} = await import('@egret/engine');
  const {captureHost} = await import('./scene.mjs');
  const engine = await createEngine({host: captureHost()}), scope = engine.createScope();
  try {
    const source = createImageData2D({width: 8, height: 4, pixels: new Uint8Array(8*4*4)});
    const type = createAssetType('android-atlas-sequence', isTexture);
    engine.assets.register(type, {async load() { return createTexture(source); }, dispose(texture) { texture.dispose(); }});
    const lease = scope.use(await engine.assets.acquire(createAssetRef(type, 'sheet')));
    const frames = [
      {name: 'front', x: 1, y: 0, width: 3, height: 2,
        layout: {sourceWidth: 7, sourceHeight: 6, trimX: 1, trimY: 2, packedRotation: 0}},
      {name: 'side', x: 4, y: 0, width: 2, height: 3,
        layout: {sourceWidth: 7, sourceHeight: 6, trimX: 2, trimY: 1, packedRotation: 90}}
    ];
    const sheet = scope.use(createSpriteSheet(lease, frames, 'trim-rotation-v1'));
    const bitmap = scope.use(sheet.createBitmap('front'));
    bitmap.x = 14;
    bitmap.scaleX = -2;
    engine.stage.addChild(bitmap);
    const clip = createSequenceClip({atlasWidth: 8, atlasHeight: 4,
      frames: frames.map(f => ({...f, durationSeconds: 0.5}))}, 'trim-rotation-v1');
    const player = scope.use(new SequencePlayer(bitmap, clip));
    const writer = createCapturedProjectEncoder(), pages = new Map([[source, 19]]);
    for (const [time, mapping, uv] of [
      [0, [0,7,6,1,2,0], [1/8,0,4/8,2/4]],
      [0.5, [0,7,6,2,1,1], [4/8,0,6/8,3/4]]
    ]) {
      player.applyAt(time);
      const bytes = writer.encode(engine.captureSharedFrame({width: 32, height: 32}), 1, pages);
      const view = new DataView(bytes.buffer);
      assert.equal(bytes.length, 112);
      assert.equal(view.getUint32(0, true), 0x33524745);
      assert.equal(bytes[24], 19);
      assert.deepEqual(Array.from({length: 6}, (_, i) => view.getFloat32(32 + 4*i, true)), [14,0,0,0,14,6]);
      assert.deepEqual(Array.from({length: 4}, (_, i) => view.getFloat32(56 + 4*i, true)), uv);
      assert.deepEqual(Array.from({length: 6}, (_, i) => view.getUint32(88 + 4*i, true)), mapping);
    }
  } finally {
    scope.dispose();
    await engine.dispose();
  }
});
