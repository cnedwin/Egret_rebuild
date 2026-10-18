import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import * as oracle from '../tools/shared-rendering/oracle.mjs';

// Public behavior uses the built SDK through its normal import entry.
// Input, display integration and independent reference cases retain separate labels.

// INPUT cases cover CPU factories. DISPLAY cases require later display wiring.
// ORACLE UNIT cases check this independent reference, not the SDK implementation.
// No test imports product helpers, patches globals, or creates GPU resources.
function factory(name) {
  assert.equal(typeof egret[name], 'function',
    'Public capability absent: ' + name + ' (availability assertion, not semantic RED)');
  return egret[name];
}
function exactError(run, ErrorClass, message, cause) {
  assert.throws(run, error => {
    assert.equal(error.constructor, ErrorClass);
    assert.equal(error.message, message);
    assert.equal(error.code, undefined, 'contracts factories do not invent runtime codes');
    if (arguments.length >= 4) assert.equal(error.cause, cause);
    return true;
  });
}
function runtimeError(run, code, causeClass, causeMessage) {
  assert.throws(run, error => {
    assert.equal(error instanceof egret.EgretError, true);
    assert.equal(error.code, code);
    if (causeClass) assert.equal(error.cause.constructor, causeClass);
    if (causeMessage) assert.equal(error.cause.message, causeMessage);
    return true;
  });
}
function image(width = 8, height = 8) {
  return egret.createImageData2D({ width, height, pixels: new Uint8Array(4 * width * height) });
}
function region(overrides = {}) {
  return {
    packed: { x: 1, y: 2, width: 2, height: 3 },
    logicalWidth: 7, logicalHeight: 8, trimX: 1, trimY: 2, quarterTurn: 0,
    ...overrides,
  };
}
const materialFields = [
  'light', 'dark', 'blend', 'samplingDomain', 'filter', 'addressU',
  'addressV', 'regionIsolation', 'mipLevel', 'minFilter', 'magFilter', 'maxAnisotropy',
];
const materialDefaults = {
  light: [1, 1, 1, 1], dark: [0, 0, 0], blend: 'normal',
  samplingDomain: 'region', filter: 'nearest', addressU: 'clamp-to-edge',
  addressV: 'clamp-to-edge', regionIsolation: 'bounded', mipLevel: 0,
  minFilter: 'nearest', magFilter: 'nearest', maxAnisotropy: 1,
};
function geometryInput(overrides = {}) {
  return {
    positions: new Float64Array([0, 0, 2, 0, 0, 2]),
    uvs: new Float64Array([0, 0, 1, 0, 0, 1]),
    lightColors: new Float64Array(12).fill(1),
    darkColors: new Float64Array(9),
    indices: new Uint16Array([0, 1, 2]),
    ...overrides,
  };
}
function known(object, names) {
  return Object.fromEntries(names.map(name => [name, object[name]]));
}
function nearly(actual, expected, epsilon = 1e-13) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) {
    assert.ok(Math.abs(actual[i] - expected[i]) <= epsilon,
      'channel ' + i + ': ' + actual[i] + ' versus ' + expected[i]);
  }
}

test('INPUT V01 authentic view owns frozen metadata and retains the genuine source', () => {
  const make = factory('createTextureView');
  const pixels = new Uint8Array(8 * 8 * 4);
  pixels.set([19, 29, 39, 49]);
  const source = egret.createImageData2D({ width: 8, height: 8, pixels });
  const input = region(), view = make(source, input);
  pixels.fill(255);
  input.packed.x = 6; input.logicalWidth = 100; input.quarterTurn = 3;
  assert.equal(view instanceof egret.Texture, true);
  assert.equal(egret.isTexture(view), true);
  assert.equal(view.imageData, source);
  assert.deepEqual(view.sourceRect, { x: 1, y: 2, width: 2, height: 3 });
  assert.deepEqual([view.width, view.height], [2, 3]);
  assert.deepEqual(known(view.viewRegion, [
    'packed', 'logicalWidth', 'logicalHeight', 'trimX', 'trimY', 'quarterTurn',
  ]), region());
  assert.notEqual(view.viewRegion, input);
  assert.notEqual(view.viewRegion.packed, input.packed);
  assert.ok(Object.isFrozen(view.viewRegion));
  assert.ok(Object.isFrozen(view.viewRegion.packed));
  assert.throws(() => { view.viewRegion.trimX = 0; }, TypeError);
  assert.deepEqual(Array.from(egret.copyImageData2DPixels(source).slice(0, 4)), [19, 29, 39, 49]);
  const sameBytes = egret.createImageData2D({ width: 8, height: 8, pixels: egret.copyImageData2DPixels(source) });
  const second = make(sameBytes, region());
  assert.notEqual(second.imageData, source, 'equal bytes do not collapse source ownership');
  assert.equal(egret.isTexture({ ...view }), false);
  const metadata = view.viewRegion;
  view.dispose(); view.dispose(); second.dispose();
  assert.equal(view.viewRegion, metadata);
  assert.equal(egret.isTexture(view), true);
  runtimeError(() => view.imageData, 'TEXTURE_DISPOSED');
  assert.equal(egret.copyImageData2DPixels(source)[0], 19, 'wrapper disposal does not destroy source');
  const legacy = egret.createTexture(source);
  assert.equal(legacy.viewRegion, null); legacy.dispose();
});

test('INPUT V02 image authenticity wins before any view descriptor read', () => {
  const make = factory('createTextureView');
  let reads = 0;
  const invalidRegion = new Proxy({}, { get() { reads++; throw new Error('unread'); } });
  runtimeError(() => make({}, invalidRegion), 'TEXTURE_IMAGE_INVALID', TypeError);
  assert.equal(reads, 0);
});

test('INPUT V03 all six top fields precede packed shape and nested reads', () => {
  const make = factory('createTextureView'), source = image(), trace = [];
  const top = ['packed', 'logicalWidth', 'logicalHeight', 'trimX', 'trimY', 'quarterTurn'];
  const cause = Object.freeze({ lateTop: true });
  const descriptor = Object.defineProperties({}, Object.fromEntries(top.map(name => [name, {
    get() {
      trace.push(name);
      if (name === 'quarterTurn') throw cause;
      return name === 'packed' ? null : -1;
    },
  }])));
  assert.throws(() => make(source, descriptor), error =>
    error.code === 'TEXTURE_VIEW_REGION_INVALID' && error.cause === cause);
  assert.deepEqual(trace, top);
  trace.length = 0;
  const values = region();
  values.packed = Object.defineProperties({}, Object.fromEntries(['x', 'y', 'width', 'height'].map(name => [name, {
    get() { trace.push(name); if (name === 'height') throw cause; return -1; },
  }])));
  assert.throws(() => make(source, values), error =>
    error.code === 'TEXTURE_VIEW_REGION_INVALID' && error.cause === cause);
  assert.deepEqual(trace, ['x', 'y', 'width', 'height']);
});

test('INPUT V04 successful view descriptor fields are read once without unknown fields', () => {
  const make = factory('createTextureView'), trace = [], values = region();
  const top = ['packed', 'logicalWidth', 'logicalHeight', 'trimX', 'trimY', 'quarterTurn'];
  const packed = Object.defineProperties({}, Object.fromEntries(['x', 'y', 'width', 'height'].map(name => [name, {
    get() { trace.push('packed.' + name); return values.packed[name]; },
  }])));
  const input = Object.defineProperties({}, Object.fromEntries(top.map(name => [name, {
    get() { trace.push(name); return name === 'packed' ? packed : values[name]; },
  }])));
  Object.defineProperty(input, 'shader', { get() { throw new Error('unknown field read'); } });
  const view = make(image(), input);
  assert.deepEqual(trace, [...top, 'packed.x', 'packed.y', 'packed.width', 'packed.height']);
  view.dispose();
});

test('INPUT V05 view shape, integer and containment errors remain distinct', () => {
  const make = factory('createTextureView'), source = image();
  for (const input of [undefined, null, [], 1, () => {}]) {
    runtimeError(() => make(source, input), 'TEXTURE_VIEW_REGION_INVALID',
      TypeError, 'Texture view region must be a record');
  }
  runtimeError(() => make(source, region({ logicalWidth: '7' })), 'TEXTURE_VIEW_REGION_INVALID',
    TypeError, 'Texture view region fields must be numbers');
  for (const patch of [
    { logicalWidth: 0 }, { logicalHeight: 2 ** 20 + 1 }, { trimX: -1 },
    { trimY: 0.5 }, { quarterTurn: 4 }, { quarterTurn: NaN }, { logicalWidth: Infinity },
  ]) {
    runtimeError(() => make(source, region(patch)), 'TEXTURE_VIEW_REGION_INVALID',
      RangeError, 'Texture view region integer range');
  }
  runtimeError(() => make(source, region({ packed: { x: 7, y: 0, width: 2, height: 1 } })),
    'TEXTURE_VIEW_REGION_INVALID', RangeError, 'Texture view region exceeds its image');
  runtimeError(() => make(source, region({ logicalWidth: 2 })),
    'TEXTURE_VIEW_REGION_INVALID', RangeError, 'Texture view content exceeds its logical region');
});

test('INPUT V07 packed integer bounds precede logical validation and image containment', () => {
  const make = factory('createTextureView'), source = image();
  for (const field of ['x', 'y', 'width', 'height']) {
    for (const logicalWidth of ['bad', 7]) {
      const input = region({ logicalWidth });
      input.packed = { ...input.packed, [field]: 2 ** 20 + 1 };
      runtimeError(() => make(source, input), 'TEXTURE_VIEW_REGION_INVALID',
        RangeError, 'Texture view region integer range');
    }
  }
});

test('INPUT V06 odd turns swap content extent while packed dimensions stay unchanged', () => {
  const make = factory('createTextureView'), source = image();
  for (const quarterTurn of [0, 1, 2, 3]) {
    const odd = quarterTurn % 2 === 1;
    const input = region({
      packed: { x: -0, y: -0, width: 2, height: 3 },
      logicalWidth: odd ? 3 : 2, logicalHeight: odd ? 2 : 3,
      trimX: -0, trimY: -0, quarterTurn,
    });
    const view = make(source, input);
    assert.deepEqual([view.width, view.height], [2, 3]);
    for (const value of [view.viewRegion.trimX, view.viewRegion.trimY,
      view.viewRegion.packed.x, view.viewRegion.packed.y]) assert.equal(Object.is(value, -0), false);
    view.dispose();
    runtimeError(() => make(source, { ...input, logicalWidth: input.logicalWidth - 1 }),
      'TEXTURE_VIEW_REGION_INVALID', RangeError, 'Texture view content exceeds its logical region');
  }
  const max = make(source, region({ logicalWidth: 2 ** 20, logicalHeight: 2 ** 20 }));
  assert.equal(max.viewRegion.logicalWidth, 2 ** 20); max.dispose();
});

test('INPUT M01 empty descriptor supplies all immutable identity material fields', () => {
  const make = factory('createSharedMaterial2D'), value = make({});
  assert.deepEqual(known(value, materialFields), materialDefaults);
  assert.ok(Object.isFrozen(value));
  assert.ok(Object.isFrozen(value.light)); assert.ok(Object.isFrozen(value.dark));
  assert.throws(() => { value.light[0] = 0; }, TypeError);
  const linear = make({ filter: 'linear' });
  assert.deepEqual([linear.filter, linear.minFilter, linear.magFilter], ['linear', 'linear', 'linear']);
});

test('INPUT M02 material copies and f32-normalizes all coefficients without caller aliases', () => {
  const make = factory('createSharedMaterial2D');
  const light = [0.1, -0, 1, 0.5], dark = [0.2, 0.3, 0.4];
  const value = make({ light, dark });
  light.fill(0); dark.fill(1);
  assert.deepEqual(value.light, [Math.fround(0.1), 0, 1, 0.5]);
  assert.deepEqual(value.dark, [Math.fround(0.2), Math.fround(0.3), Math.fround(0.4)]);
  assert.notEqual(value.light, light); assert.notEqual(value.dark, dark);
  assert.equal(Object.is(value.light[1], -0), false);
});

test('INPUT M03 all top reads precede tuple brand, shape and coefficient semantics', () => {
  const make = factory('createSharedMaterial2D'), trace = [], cause = { lateTop: true };
  const descriptor = Object.defineProperties({}, Object.fromEntries(materialFields.map(name => [name, {
    get() {
      trace.push(name);
      if (name === 'maxAnisotropy') throw cause;
      return name === 'light' ? null : undefined;
    },
  }])));
  exactError(() => make(descriptor), TypeError, 'Shared material descriptor read failed', cause);
  assert.deepEqual(trace, materialFields);
});

test('INPUT M04 tuple snapshots read own slots in order; later getters beat earlier holes', () => {
  const make = factory('createSharedMaterial2D'), trace = [];
  const light = new Array(4), dark = [0, 0, 0], cause = { darkGetter: true };
  // A hole is a shape fault, but all remaining prescribed slot reads precede it.
  for (const index of [1, 2, 3]) Object.defineProperty(light, index, {
    get() { trace.push('light.' + index); return 1; },
  });
  for (const index of [0, 1, 2]) Object.defineProperty(dark, index, {
    get() { trace.push('dark.' + index); if (index === 2) throw cause; return 0; },
  });
  exactError(() => make({ light, dark }), TypeError, 'Shared material descriptor read failed', cause);
  assert.deepEqual(trace, ['light.1', 'light.2', 'light.3', 'dark.0', 'dark.1', 'dark.2']);
  exactError(() => make({ light: new Array(4) }), RangeError, 'Shared material color tuple shape is invalid');
  let payloadReads = 0;
  const wrongLength = [0, 0];
  Object.defineProperty(wrongLength, 0, { get() { payloadReads++; throw cause; } });
  exactError(() => make({ dark: wrongLength }), RangeError, 'Shared material color tuple shape is invalid');
  assert.equal(payloadReads, 0);
});

test('INPUT M05 material rejects unsupported tuples, invalid numbers and sampler requests', () => {
  const make = factory('createSharedMaterial2D');
  for (const input of [undefined, null, [], 4, () => {}]) {
    exactError(() => make(input), TypeError, 'Shared material descriptor must be a record');
  }
  for (const light of [null, new Float32Array(4), { 0: 1, 1: 1, 2: 1, 3: 1, length: 4 }]) {
    exactError(() => make({ light }), TypeError, 'Shared material color tuple must be an Array');
  }
  for (const patch of [
    { light: [1 + Number.EPSILON, 1, 1, 1] }, { dark: [0, NaN, 0] },
    { light: [1, 1, 1, '1'] }, { mipLevel: -1 }, { mipLevel: 0.5 },
    { maxAnisotropy: 0 }, { maxAnisotropy: Infinity },
  ]) exactError(() => make(patch), RangeError, 'Shared material numeric range is invalid');
  for (const patch of [
    { blend: 'add' }, { samplingDomain: 'guessed' }, { filter: null },
    { filter: 'linear', minFilter: 'nearest' }, { mipLevel: 1 }, { maxAnisotropy: 2 },
    { addressU: 'repeat' }, { addressV: 'mirror-repeat' },
    { samplingDomain: 'page', regionIsolation: 'strict' },
  ]) exactError(() => make(patch), TypeError, 'Shared material option is unsupported');
});

test('INPUT M06 complete declared material combinations preserve domain and blend identity', () => {
  const make = factory('createSharedMaterial2D');
  for (const blend of ['normal', 'add-accumulate', 'add-preserve', 'multiply-factor', 'screen']) {
    const value = make({ blend, samplingDomain: 'page', filter: 'linear',
      addressU: 'repeat', addressV: 'mirror-repeat' });
    assert.deepEqual(known(value, ['blend', 'samplingDomain', 'filter', 'addressU', 'addressV']),
      { blend, samplingDomain: 'page', filter: 'linear', addressU: 'repeat', addressV: 'mirror-repeat' });
  }
  const strict = make({ regionIsolation: 'strict', filter: 'linear' });
  assert.equal(strict.regionIsolation, 'strict');
  const input = {};
  Object.defineProperty(input, 'shader', { get() { throw new Error('unknown field read'); } });
  assert.deepEqual(known(make(input), materialFields), materialDefaults);
});

test('INPUT G01 shared geometry owns f32-roundtrip arrays and a separate authentic brand', () => {
  const make = factory('createSharedGeometry2D'), input = geometryInput();
  input.positions[0] = 0.1; input.positions[1] = -0;
  input.uvs.set([-0.25, 1.25, 1, 0, 0, 1]);
  input.lightColors[0] = 0.1; input.darkColors[1] = 0.3;
  const value = make(input);
  for (const field of ['positions', 'uvs', 'lightColors', 'darkColors', 'indices']) {
    assert.notEqual(value[field], input[field]);
    assert.equal(Array.isArray(value[field]), true);
    assert.ok(Object.isFrozen(value[field]));
    input[field].fill(0);
  }
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(value.positions, [Math.fround(0.1), 0, 2, 0, 0, 2]);
  assert.deepEqual(value.uvs, [-0.25, 1.25, 1, 0, 0, 1]);
  assert.equal(value.lightColors[0], Math.fround(0.1));
  assert.equal(value.darkColors[1], Math.fround(0.3));
  assert.deepEqual(value.indices, [0, 1, 2]);
  assert.deepEqual([value.vertexCount, value.indexCount, value.triangleCount, value.logicalByteLength],
    [3, 3, 1, 276]);
  assert.equal(Object.is(value.positions[1], -0), false);
  assert.equal(egret.isTexturedGeometry2D(value), false, 'new geometry is not the legacy brand');
});

test('INPUT G02 all five descriptor reads precede typed-array qualification', () => {
  const make = factory('createSharedGeometry2D'), trace = [], cause = { indicesRead: true };
  const fields = ['positions', 'uvs', 'lightColors', 'darkColors', 'indices'];
  const descriptor = Object.defineProperties({}, Object.fromEntries(fields.map(name => [name, {
    get() { trace.push(name); if (name === 'indices') throw cause; return null; },
  }])));
  exactError(() => make(descriptor), TypeError, 'Shared geometry descriptor read failed', cause);
  assert.deepEqual(trace, fields);
});

test('INPUT G03 all array tags precede first backing qualification; instance getters are unused', () => {
  const make = factory('createSharedGeometry2D');
  const resizable = new ArrayBuffer(24, { maxByteLength: 48 });
  exactError(() => make(geometryInput({ positions: new Float32Array(resizable), uvs: [] })),
    TypeError, 'Shared geometry array brand is unsupported');
  const input = geometryInput(); let reads = 0;
  for (const array of Object.values(input)) {
    for (const key of ['buffer', 'byteLength', 'byteOffset', 'length', Symbol.iterator, Symbol.toStringTag]) {
      Object.defineProperty(array, key, { get() { reads++; throw new Error('instance getter'); } });
    }
  }
  const value = make(input);
  assert.equal(value.vertexCount, 3); assert.equal(reads, 0);
});

test('INPUT G04 geometry rejects unsupported brands/backings without changing legacy geometry', () => {
  const make = factory('createSharedGeometry2D');
  for (const input of [undefined, null, 1, 'geometry']) {
    exactError(() => make(input), TypeError, 'Shared geometry descriptor must be an object');
  }
  for (const patch of [
    { positions: [0, 0, 2, 0, 0, 2] }, { uvs: new Int32Array(6) },
    { darkColors: new Uint8Array(9) }, { indices: new Int32Array([0, 1, 2]) },
  ]) exactError(() => make(geometryInput(patch)), TypeError, 'Shared geometry array brand is unsupported');
  exactError(() => make(geometryInput({ positions: new Float32Array(new ArrayBuffer(24, { maxByteLength: 48 })) })),
    TypeError, 'Shared geometry backing is unsupported');
  assert.throws(() => make(geometryInput({ positions: new Float32Array(new SharedArrayBuffer(24)) })), TypeError);
  const detached = new Float32Array(6);
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  assert.throws(() => make(geometryInput({ positions: detached })), TypeError);
  const old = egret.createTexturedGeometry2D(geometryInput());
  assert.equal(egret.isTexturedGeometry2D(old), true);
  assert.equal(old.logicalByteLength, 204, 'legacy 64V+4I fee remains unchanged');
  assert.throws(() => egret.createTexturedGeometry2D(geometryInput({ uvs: new Float64Array([-0.25, 0, 1, 0, 0, 1]) })),
    { name: 'RangeError', message: 'Textured geometry numeric range is invalid' });
});

test('INPUT G05 shared geometry rejects shape before capacity and numeric faults', () => {
  const make = factory('createSharedGeometry2D');
  for (const patch of [
    { positions: new Float32Array(5) }, { uvs: new Float32Array(5) },
    { lightColors: new Float64Array(11) }, { darkColors: new Float64Array(8) },
    { indices: new Uint32Array(4) }, { indices: new Uint16Array(0) },
  ]) exactError(() => make(geometryInput(patch)), RangeError, 'Shared geometry array shape is invalid');
  const oversizedWrongShape = geometryInput({
    positions: new Float32Array(131074), indices: new Uint32Array([0, 1, 2, 0]),
  });
  exactError(() => make(oversizedWrongShape), RangeError, 'Shared geometry array shape is invalid');
  const empty = make({
    positions: new Float32Array(0), uvs: new Float64Array(0), lightColors: new Float32Array(0),
    darkColors: new Float64Array(0), indices: new Uint32Array(0),
  });
  assert.deepEqual([empty.vertexCount, empty.indexCount, empty.triangleCount, empty.logicalByteLength], [0, 0, 0, 0]);
});

test('INPUT G06 shared geometry exact independent byte and index caps are enforced', () => {
  const make = factory('createSharedGeometry2D');
  function sized(vertices, indices) {
    return {
      positions: new Float32Array(2 * vertices), uvs: new Float32Array(2 * vertices),
      lightColors: new Float32Array(4 * vertices), darkColors: new Float32Array(3 * vertices),
      indices: new Uint32Array(indices),
    };
  }
  // 88 * 56,596 + 4 * 72 = 4,980,736 exactly, below the separate V/I caps.
  const exact = make(sized(56596, 72));
  assert.equal(exact.logicalByteLength, 4980736);
  const over = sized(56596, 75); over.positions[0] = NaN;
  exactError(() => make(over), RangeError, 'Shared geometry capacity exceeded');
  const maxIndices = make(sized(3, 196608));
  assert.equal(maxIndices.indexCount, 196608);
  assert.equal(maxIndices.logicalByteLength, 786696);
  exactError(() => make(sized(3, 196611)), RangeError, 'Shared geometry capacity exceeded');
});

test('INPUT G07 geometry numeric checks follow declared f32 conversion and component ranges', () => {
  const make = factory('createSharedGeometry2D');
  for (const [field, bad] of [
    ['positions', NaN], ['positions', 1e100], ['uvs', Infinity], ['uvs', 2 ** 20 + 1],
    ['lightColors', 1 + Number.EPSILON], ['darkColors', -0.001], ['indices', 3],
  ]) {
    const input = geometryInput(); input[field][0] = bad;
    exactError(() => make(input), RangeError, 'Shared geometry numeric range is invalid');
  }
  const input = geometryInput();
  input.uvs[0] = 2 ** 20 + 0.01;
  const rounded = make(input);
  assert.equal(rounded.uvs[0], 2 ** 20, 'UV bounds apply to the declared f32-roundtrip value');
});

// The Host below is only the public Engine lifecycle port. It does not render,
// emulate capture, or manufacture leases; genuine Engine/Scope own all values.
let assetOrdinal = 0;
async function withTexture(texture, body) {
  const engine = await egret.createEngine({ host: {
    surface: {}, start() {}, stop() {}, async close() {},
    setTimeout(callback, delay) { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
  } });
  const scope = engine.createScope();
  let disposed = 0;
  try {
    const type = egret.createAssetType('m13-input-' + (++assetOrdinal), egret.isTexture);
    engine.assets.register(type, { async load() { return texture; }, dispose(value) { disposed++; value.dispose(); } });
    const ref = egret.createAssetRef(type, 'view');
    const lease = scope.use(await engine.assets.acquire(ref, { signal: scope.signal }));
    await body({ engine, scope, lease, texture, ref, disposed: () => disposed });
  } finally {
    scope.dispose();
    await engine.dispose();
  }
  assert.equal(disposed, 1, 'the real provider cleans the sole lease once');
}
function materialAccessor() {
  const descriptor = Object.getOwnPropertyDescriptor(egret.DisplayObject.prototype, 'sharedMaterial');
  assert.equal(typeof descriptor?.get, 'function', 'sharedMaterial public getter is required');
  assert.equal(typeof descriptor?.set, 'function', 'sharedMaterial public setter is required');
}

test('DISPLAY D01 real Bitmap uses logical view extent and refuses every crop write atomically', async () => {
  const make = factory('createTextureView');
  await withTexture(make(image(), region({ quarterTurn: 1 })), async ({ engine, scope, lease, texture }) => {
    const bitmap = scope.use(new egret.Bitmap(lease));
    engine.stage.addChild(bitmap);
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [7, 8]);
    assert.equal(bitmap.textureLease, lease);
    const before = bitmap.sourceRect;
    let reads = 0;
    const crop = new Proxy({}, { get() { reads++; throw new Error('crop must not be read'); } });
    for (const value of [undefined, crop, { x: 0, y: 0, width: 1, height: 1 }]) {
      runtimeError(() => { bitmap.sourceRect = value; }, 'TEXTURE_VIEW_REGION_IMMUTABLE');
      assert.equal(bitmap.sourceRect, before);
      assert.equal(bitmap.textureLease, lease);
    }
    assert.equal(reads, 0);
    texture.dispose();
    runtimeError(() => { bitmap.sourceRect = crop; }, 'TEXTURE_DISPOSED');
    assert.equal(reads, 0, 'current resource liveness precedes new immutable refusal');
  });
});

test('DISPLAY D02 shared material authentic setter rejects clones and preserves the old value', async () => {
  const make = factory('createSharedMaterial2D'); materialAccessor();
  await withTexture(egret.createTexture(image()), async ({ engine, scope, lease }) => {
    const bitmap = scope.use(new egret.Bitmap(lease));
    engine.stage.addChild(bitmap);
    assert.equal(bitmap.sharedMaterial, null);
    const material = make({ light: [0.2, 0.4, 0.6, 0.8] });
    bitmap.sharedMaterial = material;
    assert.equal(bitmap.sharedMaterial, material);
    let reads = 0;
    const proxy = new Proxy(material, { get() { reads++; throw new Error('brand must not read'); } });
    for (const invalid of [undefined, {}, { ...material }, Object.create(Object.getPrototypeOf(material)), proxy]) {
      runtimeError(() => { bitmap.sharedMaterial = invalid; }, 'DISPLAY_VALUE_INVALID');
      assert.equal(bitmap.sharedMaterial, material);
    }
    assert.equal(reads, 0);
    bitmap.sharedMaterial = null;
    assert.equal(bitmap.sharedMaterial, null);
    assert.equal(bitmap.renderBoundary, 'none');
    bitmap.renderBoundary = 'isolate';
    assert.equal(bitmap.renderBoundary, 'isolate');
    runtimeError(() => { bitmap.renderBoundary = undefined; }, 'DISPLAY_VALUE_INVALID');
    assert.equal(bitmap.renderBoundary, 'isolate');
  });
});

test('DISPLAY D03 Mesh accepts genuine shared geometry, rejects lookalikes and clears to undefined', async () => {
  const make = factory('createSharedGeometry2D');
  const geometry = make(geometryInput());
  await withTexture(egret.createTexture(image()), async ({ engine, scope, lease, texture }) => {
    const mesh = scope.use(new egret.Mesh2D(lease, geometry));
    engine.stage.addChild(mesh);
    assert.equal(mesh.geometry, geometry); assert.equal(mesh.textureLease, lease);
    let reads = 0;
    const fakeLease = { get value() { reads++; throw new Error('lease must not be read'); } };
    const forged = new Proxy(geometry, { get() { reads++; throw new Error('geometry must not be read'); } });
    for (const invalid of [{ ...geometry }, Object.create(Object.getPrototypeOf(geometry)), forged]) {
      runtimeError(() => new egret.Mesh2D(fakeLease, invalid), 'MESH_GEOMETRY_INVALID');
      runtimeError(() => mesh.setContent(lease, invalid), 'MESH_GEOMETRY_INVALID');
      assert.equal(mesh.geometry, geometry); assert.equal(mesh.textureLease, lease);
    }
    assert.equal(reads, 0);
    mesh.clear(); assert.equal(mesh.geometry, undefined); assert.equal(mesh.textureLease, undefined);
    assert.equal(lease.value, texture, 'clear does not adopt or release the caller lease');
    mesh.setContent(lease, geometry);
    mesh.dispose(); assert.equal(mesh.geometry, undefined); assert.equal(mesh.textureLease, undefined);
    assert.equal(lease.value, texture);
  });
});

test('DISPLAY D04 legacy Mesh still preserves binary64 geometry and ordinary crop behavior', async () => {
  const input = geometryInput(); input.positions[0] = 0.1;
  const legacy = egret.createTexturedGeometry2D(input);
  assert.equal(legacy.positions[0], 0.1);
  await withTexture(egret.createTexture(image()), async ({ engine, scope, lease }) => {
    const mesh = scope.use(new egret.Mesh2D(lease, legacy));
    const bitmap = scope.use(new egret.Bitmap(lease));
    engine.stage.addChild(mesh); engine.stage.addChild(bitmap);
    assert.equal(mesh.geometry, legacy); assert.equal(egret.isTexturedGeometry2D(mesh.geometry), true);
    bitmap.sourceRect = { x: 2, y: 3, width: 4, height: 2 };
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [4, 2]);
    bitmap.sourceRect = undefined;
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [8, 8]);
    mesh.clear(); assert.equal(mesh.geometry, undefined);
  });
  // JS runtime assertions cannot establish the default generic type.
  // A strict type fixture must retain Mesh2D<T> getter T | undefined separately.
});

test('ORACLE UNIT O01 alpha8 cap is maximal and canonical pixels obey the adopted representation', () => {
  assert.deepEqual(oracle.canonicalPixel([255, 255, 255, 128]), [187, 187, 187, 128]);
  assert.deepEqual(oracle.canonicalPixel([255, 255, 255, 235]), [245, 245, 245, 235]);
  assert.deepEqual(oracle.canonicalPixel([255, 50, 99, 0]), [0, 0, 0, 0]);
  assert.deepEqual(oracle.canonicalPixel([128, 64, 255, 255]), [128, 64, 255, 255]);
  for (let alpha = 0; alpha < 256; alpha++) {
    const cap = oracle.alpha8Caps[alpha];
    assert.ok(oracle.decodeSrgb(cap / 255) <= alpha / 255);
    if (cap !== 255) assert.ok(oracle.decodeSrgb((cap + 1) / 255) > alpha / 255);
  }
});

test('ORACLE UNIT O02 quarter turns map independent labeled texels and trim remains virtual', () => {
  // Logical content is two columns by three rows; labels are encoded R bytes.
  const layouts = [
    { width: 2, height: 3, labels: [16, 32, 48, 64, 80, 96] },
    { width: 3, height: 2, labels: [80, 48, 16, 96, 64, 32] },
    { width: 2, height: 3, labels: [96, 80, 64, 48, 32, 16] },
    { width: 3, height: 2, labels: [32, 64, 96, 16, 48, 80] },
  ];
  for (let quarterTurn = 0; quarterTurn < 4; quarterTurn++) {
    const layout = layouts[quarterTurn];
    const page = oracle.canonicalPage(layout.width, layout.height, layout.labels.flatMap(r => [r, 0, 0, 255]));
    const view = { packed: { x: 0, y: 0, width: layout.width, height: layout.height },
      logicalWidth: 4, logicalHeight: 5, trimX: 1, trimY: 1, quarterTurn };
    for (const [x, y, code] of [[0, 0, 16], [1, 0, 32], [0, 1, 48], [1, 1, 64], [0, 2, 80], [1, 2, 96]]) {
      nearly(oracle.sampleRegion(page, view, x + 1.5, y + 1.5, 'nearest'),
        [oracle.decodeSrgb(code / 255), 0, 0, 1]);
    }
    assert.deepEqual(oracle.sampleRegion(page, view, 0.5, 0.5, 'nearest'), [0, 0, 0, 0]);
    assert.deepEqual(oracle.sampleRegion(page, view, -10, 2, 'linear'), [0, 0, 0, 0]);
  }
  const red = oracle.canonicalPage(1, 1, [255, 0, 0, 255]);
  const trimmed = { packed: { x: 0, y: 0, width: 1, height: 1 },
    logicalWidth: 3, logicalHeight: 3, trimX: 1, trimY: 1, quarterTurn: 0 };
  nearly(oracle.sampleRegion(red, trimmed, 1, 1), [0.25, 0, 0, 0.25]);
  nearly(oracle.sampleRegion(red, trimmed, 1, 1.5), [0.5, 0, 0, 0.5]);
});

test('ORACLE UNIT O03 page wrap uses original page coordinates instead of region clamping', () => {
  const page = oracle.canonicalPage(2, 1, [255, 0, 0, 255, 0, 0, 255, 255]);
  nearly(oracle.samplePage(page, 0, 0.5, { addressU: 'repeat' }), [0.5, 0, 0.5, 1]);
  nearly(oracle.samplePage(page, 0, 0.5, { addressU: 'clamp-to-edge' }), [1, 0, 0, 1]);
  nearly(oracle.samplePage(page, -0.5, 0.5, { addressU: 'repeat', filter: 'nearest' }), [0, 0, 1, 1]);
  nearly(oracle.samplePage(page, -0.5, 0.5, { addressU: 'mirror-repeat', filter: 'nearest' }), [1, 0, 0, 1]);
  assert.deepEqual([-3, -2, -1, 0, 1, 2, 3, 4].map(i => oracle.addressIndex(i, 2, 'mirror-repeat')),
    [1, 1, 0, 0, 1, 1, 0, 0]);
  const view = { packed: { x: 0, y: 0, width: 1, height: 1 },
    logicalWidth: 1, logicalHeight: 1, trimX: 0, trimY: 0, quarterTurn: 0 };
  nearly(oracle.sampleRegion(page, view, 1, 0.5), [1, 0, 0, 1]);
  nearly(oracle.samplePage(page, 1, 0.5), [0.5, 0, 0.5, 1]);
});

test('ORACLE UNIT O04 vertex and material two-color apply both tint alphas exactly once', () => {
  nearly(oracle.shadeTwoColor([0.2, 0.1, 0, 0.5], {
    materialLight: [0.25, 0.5, 1, 0.5], materialDark: [0.75, 0.25, 0], opacity: 0.5,
  }), [0.06875, 0.0375, 0, 0.125]);
  nearly(oracle.shadeTwoColor([0.2, 0.1, 0, 0.5], {
    vertexLight: [0.5, 1, 1, 0.5], vertexDark: [0.5, 0, 0],
    materialLight: [1, 1, 1, 0.5], opacity: 0.5,
  }), [0.03125, 0.0125, 0, 0.0625]);
});

test('ORACLE UNIT O05 five blend equations differ before target quantization', () => {
  const source = [0.2, 0.2, 0.2, 0.5], destination = [0.1, 0.1, 0.1, 0.25];
  for (const [mode, rgb, alpha] of [
    ['normal', 0.25, 0.625], ['add-accumulate', 0.3, 0.75],
    ['add-preserve', 0.3, 0.25], ['multiply-factor', 0.07, 0.625], ['screen', 0.28, 0.625],
  ]) nearly(oracle.blendLinear(source, destination, mode), [rgb, rgb, rgb, alpha]);
  assert.throws(() => oracle.compositeToTarget([0, 0, 0, 0], source, 'add-preserve'),
    /initialized opaque target/);
  assert.equal(oracle.compositeToTarget([0, 0, 0, 255], source, 'add-preserve', 'opaque')[3], 255);
});

test('ORACLE UNIT O06 attachment writes are uncapped and final transparent resolve guards PMA', () => {
  const target = oracle.quantizeTarget([0.5, 0, 0, 0.5]);
  assert.deepEqual(target, [188, 0, 0, 128]);
  const decoded = oracle.decodeStoredPixel(target);
  assert.ok(decoded[0] > decoded[3], 'target quantization may temporarily exceed alpha');
  assert.deepEqual(oracle.resolveTarget(target), [128, 0, 0, 128]);
  assert.deepEqual(oracle.resolveTarget([255, 255, 255, 0]), [0, 0, 0, 0]);
  assert.deepEqual(oracle.clearTarget(0xffffff, 1, 'opaque'), [255, 255, 255, 255]);
  assert.throws(() => oracle.clearTarget(0, 0, 'opaque'), /alpha one/);
});

test('ORACLE UNIT O07 each write quantizes before the next blend and layer order is observable', () => {
  const red = { source: [0.5, 0, 0, 0.5] }, blue = { source: [0, 0, 0.5, 0.5] };
  const forward = oracle.renderPixel({ layers: [red, blue] });
  assert.deepEqual(forward.targetWrites[0], [188, 0, 0, 128]);
  // The second red term is D(188/255) * (1 - .5), not an unquantized .25.
  // Independent fixed byte: Q8(E(0.5 * D(188/255))) = 137.
  assert.equal(forward.targetWrites[1][0], 137);
  assert.equal(forward.targetWrites[1][3], 192);
  const reverse = oracle.renderPixel({ layers: [blue, red] });
  assert.notDeepEqual(forward.rgba, reverse.rgba);
  for (const pixel of [forward.rgba, reverse.rgba]) {
    for (let c = 0; c < 3; c++) assert.ok(pixel[c] <= pixel[3]);
  }
});
