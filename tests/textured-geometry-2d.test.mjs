import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as egret from '@egret/engine';

// Public owned geometry regressions through built package exports.
// Payload, accounting and read-order expectations are independent literals;
// no private production helper supplies an expected-value oracle.
function capability() {
  assert.equal(typeof egret.createEngine, 'function', 'existing public facade must initialize');
  assert.equal(typeof egret.Bitmap, 'function', 'existing Bitmap facade must initialize');
  assert.equal(typeof egret.createTexturedGeometry2D, 'function', 'missing public createTexturedGeometry2D capability');
  assert.equal(typeof egret.isTexturedGeometry2D, 'function', 'missing public isTexturedGeometry2D capability');
  return { create: egret.createTexturedGeometry2D, guard: egret.isTexturedGeometry2D };
}

function triangle(Float = Float64Array, Index = Uint32Array) {
  return {
    positions: new Float([0, 0, 2, 0, 0, 2]),
    uvs: new Float([0, 0, 1, 0, 0, 1]),
    lightColors: new Float([1, 1, 1, 1, 1, 0, 0, 0.5, 0, 1, 0, 0.25]),
    indices: new Index([0, 1, 2]),
  };
}

function empty(Float = Float64Array, Index = Uint32Array) {
  return { positions: new Float(0), uvs: new Float(0), lightColors: new Float(0), indices: new Index(0) };
}

// Catch explicitly: throw undefined must not be mistaken for successful return.
function fault(run, Class, message, ...cause) {
  let threw = false, error;
  try { run(); } catch (value) { threw = true; error = value; }
  assert.equal(threw, true, 'operation must throw');
  assert.ok(error instanceof Class, `expected ${Class.name}`);
  assert.equal(error.message, message);
  if (cause.length) {
    assert.equal(cause.length, 1);
    assert.equal(Object.hasOwn(error, 'cause'), true, 'wrapped descriptor fault retains own cause, even undefined');
    assert.equal(error.cause, cause[0]);
  } else {
    assert.equal(Object.hasOwn(error, 'cause'), false, 'semantic/native faults must not gain a descriptor cause');
  }
  return error;
}

function metadata(value, vertexCount, indexCount, triangleCount, logicalByteLength) {
  assert.deepEqual(
    [value.vertexCount, value.indexCount, value.triangleCount, value.logicalByteLength],
    [vertexCount, indexCount, triangleCount, logicalByteLength],
  );
}

function frozenRecord(value) {
  assert.equal(Object.isFrozen(value), true);
  for (const key of ['vertexCount', 'indexCount', 'triangleCount', 'logicalByteLength', 'positions', 'uvs', 'lightColors', 'indices']) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assert.ok(descriptor, `owned ${key}`);
    assert.equal(descriptor.writable, false);
    assert.equal(descriptor.configurable, false);
    assert.equal('get' in descriptor, false);
  }
  const arrays = [value.positions, value.uvs, value.lightColors, value.indices];
  assert.equal(new Set(arrays).size, 4, 'four independently owned arrays');
  for (const array of arrays) {
    assert.equal(Array.isArray(array), true, 'ordinary canonical array');
    assert.equal(Object.getPrototypeOf(array), Array.prototype);
    assert.equal(Object.isFrozen(array), true);
    assert.deepEqual(Object.keys(array), Array.from({ length: array.length }, (_, index) => String(index)), 'dense without extra enumerable keys');
    for (let index = 0; index < array.length; index++) {
      assert.equal(Object.hasOwn(array, index), true);
      assert.equal(typeof array[index], 'number');
    }
  }
}

test('G01 literal empty/triangle payloads, accounting, frozen ownership and opaque authenticity', () => {
  const { create, guard } = capability(); // Before any typed payload allocation.
  const zero = create(empty());
  metadata(zero, 0, 0, 0, 0);
  for (const key of ['positions', 'uvs', 'lightColors', 'indices']) assert.deepEqual(zero[key], []);
  frozenRecord(zero);
  assert.equal(guard(zero), true);

  const input = triangle(), value = create(input), other = create(triangle());
  metadata(value, 3, 3, 1, 204); // 3*64 + 3*4, independent hand-accounted literal.
  assert.deepEqual(value.positions, [0, 0, 2, 0, 0, 2]);
  assert.deepEqual(value.uvs, [0, 0, 1, 0, 0, 1]);
  assert.deepEqual(value.lightColors, [1, 1, 1, 1, 1, 0, 0, 0.5, 0, 1, 0, 0.25]);
  assert.deepEqual(value.indices, [0, 1, 2]);
  frozenRecord(value);
  assert.equal(guard(value), true);
  assert.notEqual(value, other);
  for (const key of ['positions', 'uvs', 'lightColors', 'indices']) {
    assert.notEqual(value[key], input[key]);
    assert.notEqual(value[key], other[key]);
  }

  let reads = 0;
  const forged = new Proxy({ ...value }, {
    get() { reads++; throw Error('guard read'); },
    ownKeys() { reads++; throw Error('guard enumeration'); },
    getPrototypeOf() { reads++; throw Error('guard prototype'); },
  });
  const revoked = Proxy.revocable(value, {}); revoked.revoke();
  for (const candidate of [{ ...value }, forged, new Proxy(value, {}), revoked.proxy, {}, [], null, undefined, 0, 'geometry', () => value]) {
    assert.equal(guard(candidate), false);
  }
  assert.equal(reads, 0, 'identity checks do not consult candidate properties');
});

test('G02 exact ordered descriptor snapshot, getter-fault priority and exact causes', () => {
  const { create, guard } = capability();
  const values = triangle(), reads = [], parent = {};
  let unknown = 0, enumerations = 0;
  for (const key of ['positions', 'uvs', 'lightColors', 'indices']) {
    Object.defineProperty(parent, key, { get() { reads.push(key); return values[key]; } });
  }
  Object.defineProperty(parent, 'unknown', { get() { unknown++; throw Error('unknown property'); } });
  const descriptor = new Proxy(Object.create(parent), { ownKeys() { enumerations++; throw Error('enumeration'); } });
  metadata(create(descriptor), 3, 3, 1, 204);
  assert.deepEqual(reads, ['positions', 'uvs', 'lightColors', 'indices']);
  assert.equal(unknown, 0); assert.equal(enumerations, 0);

  const marker = Object.freeze({ descriptorSentinel: true });
  for (const cause of [marker, undefined]) {
    const log = [], laterFault = {};
    for (const key of ['positions', 'uvs', 'lightColors', 'indices']) {
      Object.defineProperty(laterFault, key, { get() {
        log.push(key);
        if (key === 'indices') throw cause;
        return key === 'positions' ? 'malformed earlier field' : values[key];
      } });
    }
    fault(() => create(laterFault), TypeError, 'Textured geometry descriptor read failed', cause);
    assert.deepEqual(log, ['positions', 'uvs', 'lightColors', 'indices']);
  }

  for (const stop of ['positions', 'uvs', 'lightColors', 'indices']) {
    const log = [], firstFault = {};
    for (const key of ['positions', 'uvs', 'lightColors', 'indices']) {
      Object.defineProperty(firstFault, key, { get() { log.push(key); if (key === stop) throw marker; return values[key]; } });
    }
    fault(() => create(firstFault), TypeError, 'Textured geometry descriptor read failed', marker);
    const expected = {
      positions: ['positions'], uvs: ['positions', 'uvs'],
      lightColors: ['positions', 'uvs', 'lightColors'], indices: ['positions', 'uvs', 'lightColors', 'indices'],
    };
    assert.deepEqual(log, expected[stop], 'first getter fault stops later reads');
  }
  for (const input of [null, undefined, 1, true, 'record', Symbol('record'), () => values]) {
    fault(() => create(input), TypeError, 'Textured geometry descriptor must be an object');
  }

  // Reentry owns a separate transaction. A caught nested fault cannot poison
  // either the successful nested value or the outer descriptor snapshot.
  const reentryReads = [], outerInput = triangle(); let inner;
  const outer = create({
    get positions() {
      reentryReads.push('positions');
      inner = create({
        positions: new Float64Array([10, 20, 12, 20, 10, 22]),
        uvs: new Float64Array([0, 0, 1, 0, 0, 1]),
        lightColors: new Float64Array([0.25, 0.5, 0.75, 1, 1, 0, 0, 0.5, 0, 1, 0, 0.25]),
        indices: new Uint16Array([2, 1, 0]),
      });
      return outerInput.positions;
    },
    get uvs() {
      reentryReads.push('uvs');
      fault(() => create({ ...triangle(), uvs: [] }), TypeError, 'Textured geometry array brand is unsupported');
      assert.equal(guard(inner), true);
      return outerInput.uvs;
    },
    get lightColors() { reentryReads.push('lightColors'); return outerInput.lightColors; },
    get indices() { reentryReads.push('indices'); return outerInput.indices; },
  });
  assert.deepEqual(reentryReads, ['positions', 'uvs', 'lightColors', 'indices']);
  assert.deepEqual(outer.positions, [0, 0, 2, 0, 0, 2]);
  assert.deepEqual(outer.uvs, [0, 0, 1, 0, 0, 1]);
  assert.deepEqual(outer.lightColors, [1, 1, 1, 1, 1, 0, 0, 0.5, 0, 1, 0, 0.25]);
  assert.deepEqual(outer.indices, [0, 1, 2]);
  assert.deepEqual(inner.positions, [10, 20, 12, 20, 10, 22]);
  assert.deepEqual(inner.uvs, [0, 0, 1, 0, 0, 1]);
  assert.deepEqual(inner.lightColors, [0.25, 0.5, 0.75, 1, 1, 0, 0, 0.5, 0, 1, 0, 0.25]);
  assert.deepEqual(inner.indices, [2, 1, 0]);
  assert.equal(guard(inner), true); assert.equal(guard(outer), true); assert.notEqual(inner, outer);
  metadata(inner, 3, 3, 1, 204); metadata(outer, 3, 3, 1, 204);
  for (const key of ['positions', 'uvs', 'lightColors', 'indices']) assert.notEqual(inner[key], outer[key]);
});

test('G03 intrinsic subview copies ignore hostile callbacks and reject nonintrinsic fields', () => {
  const { create } = capability();
  for (const Float of [Float32Array, Float64Array]) for (const Index of [Uint16Array, Uint32Array]) {
    let callbacks = 0;
    class PoisonFloat extends Float { static get [Symbol.species]() { callbacks++; throw Error('float species'); } }
    class PoisonIndex extends Index { static get [Symbol.species]() { callbacks++; throw Error('index species'); } }
    function subview(Constructor, Base, values) {
      const backing = new Base(values.length + 4);
      backing.fill(99); backing.set(values, 2);
      const view = new Constructor(backing.buffer, 2 * Base.BYTES_PER_ELEMENT, values.length);
      for (const key of ['buffer', 'length', 'byteLength', 'byteOffset', 'slice', 'subarray', 'set', 'constructor', Symbol.iterator, Symbol.toStringTag]) {
        Object.defineProperty(view, key, { get() { callbacks++; throw Error('instance helper'); } });
      }
      return view;
    }
    const value = create({
      positions: subview(PoisonFloat, Float, [0.1, 0, 2, 0, 0, 2]),
      uvs: subview(PoisonFloat, Float, [0.1, 0, 1, 0, 0, 1]),
      lightColors: subview(PoisonFloat, Float, [1, 0.1, 1, 1, 1, 0, 0, 0.5, 0, 1, 0, 0.25]),
      indices: subview(PoisonIndex, Index, [0, 1, 2]),
    });
    // These are represented-value literals, not a production conversion oracle.
    const tenth = Float === Float32Array ? 0.10000000149011612 : 0.1;
    assert.deepEqual(value.positions, [tenth, 0, 2, 0, 0, 2]);
    assert.deepEqual(value.uvs, [tenth, 0, 1, 0, 0, 1]);
    assert.deepEqual(value.lightColors, [1, tenth, 1, 1, 1, 0, 0, 0.5, 0, 1, 0, 0.25]);
    assert.deepEqual(value.indices, [0, 1, 2]);
    metadata(value, 3, 3, 1, 204); assert.equal(callbacks, 0);
  }

  for (const field of ['positions', 'uvs', 'lightColors', 'indices']) {
    const good = triangle(); let reads = 0;
    const hostile = {
      get buffer() { reads++; throw Error('buffer'); },
      get length() { reads++; throw Error('length'); },
      get [Symbol.toStringTag]() { reads++; throw Error('tag'); },
      get [Symbol.iterator]() { reads++; throw Error('iterator'); },
    };
    const proxy = new Proxy(good[field], { get() { reads++; throw Error('proxy read'); } });
    const revoked = Proxy.revocable(good[field], {}); revoked.revoke();
    for (const invalid of [[], null, undefined, hostile, proxy, revoked.proxy, new DataView(new ArrayBuffer(32)), new Int32Array(6)]) {
      fault(() => create({ ...good, [field]: invalid }), TypeError, 'Textured geometry array brand is unsupported');
    }
    assert.equal(reads, 0);
  }
  fault(() => create({ ...triangle(), positions: new Uint16Array(6) }), TypeError, 'Textured geometry array brand is unsupported');
  fault(() => create({ ...triangle(), indices: new Float64Array([0, 1, 2]) }), TypeError, 'Textured geometry array brand is unsupported');
});

test('G04 actual fixed, cross-realm, shared, resizable and detached backing admission', async (t) => {
  const { create } = capability();
  for (const Float of [Float32Array, Float64Array]) for (const Index of [Uint16Array, Uint32Array]) {
    metadata(create(empty(Float, Index)), 0, 0, 0, 0);
  }
  for (const Float of ['Float32Array', 'Float64Array']) for (const Index of ['Uint16Array', 'Uint32Array']) {
    const input = vm.runInNewContext(`({positions:new ${Float}([0,0,2,0,0,2]),uvs:new ${Float}([0,0,1,0,0,1]),lightColors:new ${Float}([1,1,1,1,1,0,0,0.5,0,1,0,0.25]),indices:new ${Index}([0,1,2])})`);
    const value = create(input);
    assert.deepEqual(value.positions, [0, 0, 2, 0, 0, 2]);
    assert.deepEqual(value.uvs, [0, 0, 1, 0, 0, 1]);
    assert.deepEqual(value.lightColors, [1, 1, 1, 1, 1, 0, 0, 0.5, 0, 1, 0, 0.25]);
    assert.deepEqual(value.indices, [0, 1, 2]); metadata(value, 3, 3, 1, 204);
    const foreignEmpty = vm.runInNewContext(`({positions:new ${Float}(0),uvs:new ${Float}(0),lightColors:new ${Float}(0),indices:new ${Index}(0)})`);
    metadata(create(foreignEmpty), 0, 0, 0, 0);
  }
  const fields = ['positions', 'uvs', 'lightColors', 'indices'];
  const nativeBufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
  await t.test('actual SharedArrayBuffer, including cross realm, keeps native error origin', (t) => {
    capability();
    if (typeof SharedArrayBuffer !== 'function') { t.skip('SharedArrayBuffer unavailable: admission untested on this host'); return; }
    const backing = new SharedArrayBuffer(48);
    let nativeError;
    try { Reflect.apply(nativeBufferLength, backing, []); } catch (error) { nativeError = error; }
    assert.ok(nativeError instanceof TypeError, 'native ArrayBuffer getter must reject shared backing');
    for (const Float of [Float32Array, Float64Array]) for (const Index of [Uint16Array, Uint32Array]) {
      const input = triangle(Float, Index);
      input.positions = new Float(new SharedArrayBuffer(6 * Float.BYTES_PER_ELEMENT));
      fault(() => create(input), TypeError, nativeError.message);
    }
    for (const field of fields) for (const zero of [false, true]) {
      const input = zero ? empty() : triangle(), Float = field === 'indices' ? Uint32Array : Float64Array;
      input[field] = new Float(new SharedArrayBuffer(input[field].byteLength));
      fault(() => create(input), TypeError, nativeError.message);
    }
    // Native error formatting depends on the backing receiver's realm. Derive
    // its expected message independently from the same native getter/backing.
    for (const bytes of [48, 0]) {
      const foreign = vm.runInNewContext(`new Float64Array(new SharedArrayBuffer(${bytes}))`);
      let foreignNativeError;
      try { Reflect.apply(nativeBufferLength, foreign.buffer, []); } catch (error) { foreignNativeError = error; }
      assert.ok(foreignNativeError instanceof TypeError);
      assert.equal(Object.hasOwn(foreignNativeError, 'cause'), false);
      fault(() => create({ ...(bytes === 0 ? empty() : triangle()), positions: foreign }), TypeError, foreignNativeError.message);
    }
    // All four brands precede any backing check, even if positions is shared.
    for (const Float of [Float32Array, Float64Array]) for (const later of ['uvs', 'lightColors', 'indices']) {
      const input = triangle(), positions = new Float(new SharedArrayBuffer(6 * Float.BYTES_PER_ELEMENT));
      fault(() => create({ ...input, positions, [later]: [] }), TypeError, 'Textured geometry array brand is unsupported');
      // Proxy brands also fail intrinsically without reading user properties.
      let reads = 0;
      const wrong = new Proxy(input[later], { get() { reads++; throw Error('later proxy property'); } });
      fault(() => create({ ...input, positions, [later]: wrong }), TypeError, 'Textured geometry array brand is unsupported');
      assert.equal(reads, 0);
    }
  });
  await t.test('actual resizable backing, including fixed-length views, is unsupported', (t) => {
    capability();
    const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
    if (!resizable) { t.skip('Resizable ArrayBuffer unavailable: admission untested on this host'); return; }
    const probe = new ArrayBuffer(48, { maxByteLength: 96 });
    assert.equal(Reflect.apply(resizable, probe, []), true, 'fixture must really be resizable');
    for (const field of fields) {
      const input = triangle(), Constructor = field === 'indices' ? Uint32Array : Float64Array;
      const backing = new ArrayBuffer(input[field].byteLength, { maxByteLength: input[field].byteLength + 64 });
      // Explicit element length: reject resizable storage even with a fixed view.
      input[field] = new Constructor(backing, 0, input[field].length);
      fault(() => create(input), TypeError, 'Textured geometry backing is unsupported');
    }
    fault(() => create({ ...empty(), positions: new Float64Array(new ArrayBuffer(0, { maxByteLength: 8 })) }), TypeError, 'Textured geometry backing is unsupported');
    const foreign = vm.runInNewContext('new Float64Array(new ArrayBuffer(48,{maxByteLength:96}),0,6)');
    fault(() => create({ ...triangle(), positions: foreign }), TypeError, 'Textured geometry backing is unsupported');
  });
  await t.test('actual transferred backing, including detached empty, is unsupported', (t) => {
    capability();
    if (typeof structuredClone !== 'function') { t.skip('Transfer unavailable: detached admission untested on this host'); return; }
    const detachedGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'detached')?.get;
    const probe = new ArrayBuffer(0); structuredClone(probe, { transfer: [probe] });
    let attachmentError;
    try { new Uint8Array(probe, 0, 0); } catch (error) { attachmentError = error; }
    assert.ok(attachmentError instanceof TypeError, 'zero-length transfer fixture must really be detached');
    const expectedMessage = detachedGetter ? 'Textured geometry backing is unsupported' : attachmentError.message;
    for (const field of fields) for (const zero of [false, true]) {
      const input = zero ? empty() : triangle(), view = input[field], backing = view.buffer;
      structuredClone(backing, { transfer: [backing] });
      if (detachedGetter) assert.equal(Reflect.apply(detachedGetter, backing, []), true);
      assert.equal(view.byteLength, 0);
      fault(() => create(input), TypeError, expectedMessage);
    }
    // Detachment during the last descriptor read precedes admission, not copying.
    const input = triangle(), backing = input.positions.buffer;
    fault(() => create({ ...input, get indices() { structuredClone(backing, { transfer: [backing] }); return input.indices; } }), TypeError, expectedMessage);
  });
});

test('G05 shape before capacity before numeric ranges; exact limits and unused vertices', () => {
  const { create } = capability();
  const shape = input => fault(() => create(input), RangeError, 'Textured geometry array shape is invalid');
  const capacity = input => fault(() => create(input), RangeError, 'Textured geometry capacity exceeded');
  const numeric = input => fault(() => create(input), RangeError, 'Textured geometry numeric range is invalid');
  for (const overrides of [
    { positions: new Float64Array(5) }, { uvs: new Float64Array(5) }, { lightColors: new Float64Array(11) },
    { positions: new Float64Array(4), uvs: new Float64Array(4), lightColors: new Float64Array(8) },
    { indices: new Uint32Array(0) }, { indices: new Uint32Array(1) }, { indices: new Uint32Array(2) }, { indices: new Uint32Array(4) },
  ]) shape({ ...triangle(), ...overrides });
  shape({ ...empty(), indices: new Uint32Array([0, 0, 0]) });
  shape({ ...triangle(), positions: new Float64Array([NaN, 0, 2, 0, 0, 2]), uvs: new Float64Array(5) });

  function sized(vertices, indices) {
    return { positions: new Float64Array(vertices * 2), uvs: new Float64Array(vertices * 2), lightColors: new Float64Array(vertices * 4), indices: new Uint32Array(indices) };
  }
  const maximum = create(sized(65536, 196608));
  metadata(maximum, 65536, 196608, 65536, 4980736);
  assert.equal(maximum.positions.length, 131072); assert.equal(maximum.uvs.length, 131072);
  assert.equal(maximum.lightColors.length, 262144); assert.equal(maximum.indices.length, 196608);
  assert.equal(maximum.indices[196607], 0); assert.equal(Object.isFrozen(maximum), true);
  metadata(create(sized(65536, 3)), 65536, 3, 1, 4194316);
  const last = sized(65536, 3); last.indices.set([65535, 0, 65535]);
  assert.deepEqual(create(last).indices, [65535, 0, 65535]);
  capacity(sized(65537, 3)); capacity(sized(3, 196611));
  shape(sized(3, 196609)); // First above the index count cap also fails triangle shape.
  shape({ ...sized(65537, 3), uvs: new Float64Array(2) });
  const tooLargeAndBad = sized(65537, 3); tooLargeAndBad.positions[0] = NaN;
  capacity(tooLargeAndBad);

  for (const field of ['uvs', 'lightColors']) for (const bad of [-0.0001, 1.0001, NaN, Infinity, -Infinity]) {
    const input = triangle(); input[field][input[field].length - 1] = bad; numeric(input);
  }
  for (const bad of [NaN, Infinity, -Infinity]) for (const component of [6, 7]) {
    const input = {
      ...triangle(), positions: new Float64Array([0, 0, 2, 0, 0, 2, 99, 99]),
      uvs: new Float64Array([0, 0, 1, 0, 0, 1, 0.5, 0.5]),
      lightColors: new Float64Array([1, 1, 1, 1, 1, 0, 0, 0.5, 0, 1, 0, 0.25, 1, 1, 1, 1]),
    };
    input.positions[component] = bad; numeric(input); // Fourth vertex is never referenced.
  }
  for (const field of ['uvs', 'lightColors']) {
    const input = sized(4, 3); input.indices.set([0, 1, 2]);
    input[field][input[field].length - 1] = 2; numeric(input); // Unused UV/color also validated.
  }
  const badIndex = triangle(); badIndex.indices[2] = 3; numeric(badIndex);
  const uintMax = triangle(); uintMax.indices[1] = 4294967295; numeric(uintMax);
  const collinear = create({ ...triangle(), positions: new Float64Array([0, 0, 1, 1, 2, 2]), indices: new Uint16Array([0, 0, 2]) });
  assert.deepEqual(collinear.positions, [0, 0, 1, 1, 2, 2]); assert.deepEqual(collinear.indices, [0, 0, 2]);
  metadata(collinear, 3, 3, 1, 204);
  const repeated = create({ ...triangle(), positions: new Float64Array([0, 0, 0, 0, 0, 0]) });
  assert.deepEqual(repeated.positions, [0, 0, 0, 0, 0, 0]); metadata(repeated, 3, 3, 1, 204);
});

test('G06 caller mutations cannot change owned geometry; signed-zero and representation equivalence', () => {
  const { create, guard } = capability();
  const input = triangle(), backings = Object.values(input).map(view => new Uint8Array(view.buffer));
  const value = create(input);
  for (const view of Object.values(input)) view.fill(1);
  for (const backing of backings) backing.fill(255);
  assert.deepEqual(value.positions, [0, 0, 2, 0, 0, 2]);
  assert.deepEqual(value.uvs, [0, 0, 1, 0, 0, 1]);
  assert.deepEqual(value.lightColors, [1, 1, 1, 1, 1, 0, 0, 0.5, 0, 1, 0, 0.25]);
  assert.deepEqual(value.indices, [0, 1, 2]);
  for (const key of ['positions', 'uvs', 'lightColors', 'indices']) {
    const array = value[key];
    assert.throws(() => { array[0] = 42; }, TypeError);
    assert.throws(() => { array.length = 0; }, TypeError);
    assert.throws(() => { array.push(42); }, TypeError);
    assert.throws(() => Object.defineProperty(array, '0', { value: 42 }), TypeError);
    assert.equal(Reflect.set(array, '0', 42), false);
    assert.equal(Reflect.deleteProperty(array, '0'), false);
    assert.throws(() => { value[key] = []; }, TypeError);
  }
  for (const key of ['vertexCount', 'indexCount', 'triangleCount', 'logicalByteLength']) {
    assert.throws(() => { value[key] = 42; }, TypeError);
    assert.throws(() => Object.defineProperty(value, key, { value: 42 }), TypeError);
    assert.equal(Reflect.set(value, key, 42), false); assert.equal(Reflect.deleteProperty(value, key), false);
  }
  assert.deepEqual(value.positions, [0, 0, 2, 0, 0, 2]);
  assert.deepEqual(value.uvs, [0, 0, 1, 0, 0, 1]);
  assert.deepEqual(value.lightColors, [1, 1, 1, 1, 1, 0, 0, 0.5, 0, 1, 0, 0.25]);
  assert.deepEqual(value.indices, [0, 1, 2]); metadata(value, 3, 3, 1, 204);
  assert.equal(guard(value), true); frozenRecord(value);

  const zeroInput = {
    positions: new Float64Array([-0, -0, 2, -0, -0, 2]), uvs: new Float64Array([-0, -0, 1, -0, -0, 1]),
    lightColors: new Float64Array([-0, 1, 1, 1, 1, -0, -0, 0.5, -0, 1, -0, 0.25]), indices: new Uint16Array([0, 1, 2]),
  };
  const normalized = create(zeroInput);
  assert.deepEqual(normalized.positions, [0, 0, 2, 0, 0, 2]);
  assert.deepEqual(normalized.uvs, [0, 0, 1, 0, 0, 1]);
  assert.deepEqual(normalized.lightColors, [0, 1, 1, 1, 1, 0, 0, 0.5, 0, 1, 0, 0.25]);
  for (const key of ['positions', 'uvs', 'lightColors', 'indices']) for (const component of normalized[key]) assert.equal(Object.is(component, -0), false);
  // Every fixture component is exactly representable in both floating types.
  const f32u16 = create(triangle(Float32Array, Uint16Array));
  const f64u32 = create(triangle(Float64Array, Uint32Array));
  assert.deepEqual(f32u16, f64u32); metadata(f32u16, 3, 3, 1, 204); metadata(f64u32, 3, 3, 1, 204);
});

test('G07 canonical ownership survives indexed inheritance introduced during descriptor reads', () => {
  const {create} = capability();
  const input = triangle(), positions = input.positions;
  const define = Object.defineProperty;
  const priorIndex = Object.getOwnPropertyDescriptor(Array.prototype, '0');
  const priorGet = Object.getOwnPropertyDescriptor(Object.prototype, 'get');
  const priorSet = Object.getOwnPropertyDescriptor(Object.prototype, 'set');
  let indexedCallbacks = 0, descriptorCallbacks = 0, value;
  define(input, 'positions', {get() {
    define(Array.prototype, '0', {__proto__:null, configurable:true, set() { indexedCallbacks++; }});
    define(Object.prototype, 'get', {__proto__:null, configurable:true, get() { descriptorCallbacks++; return undefined; }});
    define(Object.prototype, 'set', {__proto__:null, configurable:true, get() { descriptorCallbacks++; return undefined; }});
    return positions;
  }});
  try { value = create(input); }
  finally {
    // Restore before assertions or test-framework work observes these prototypes.
    delete Object.prototype.get; delete Object.prototype.set;
    if (priorGet) define(Object.prototype, 'get', priorGet);
    if (priorSet) define(Object.prototype, 'set', priorSet);
    if (priorIndex) define(Array.prototype, '0', priorIndex);
    else delete Array.prototype[0];
  }
  assert.equal(indexedCallbacks, 0, 'Owned payload creation bypasses inherited indexed setters');
  assert.equal(descriptorCallbacks, 0, 'Own-property descriptors do not read inherited accessor fields');
  for (const field of ['positions','uvs','lightColors','indices']) {
    assert.equal(Object.hasOwn(value[field], '0'), true, 'Every canonical first component is an own slot');
    assert.equal(Object.isFrozen(value[field]), true);
  }
  assert.deepEqual(value.positions, [0,0,2,0,0,2]);
  assert.deepEqual(value.uvs, [0,0,1,0,0,1]);
  assert.deepEqual(value.lightColors, [1,1,1,1,1,0,0,0.5,0,1,0,0.25]);
  assert.deepEqual(value.indices, [0,1,2]);
  assert.equal(egret.isTexturedGeometry2D(value), true);
});
