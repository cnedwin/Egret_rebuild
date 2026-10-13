// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyImageData2DPixels, isTexture } from '@egret/engine';
import { createBrowserTextureProvider as createProvider } from '@egret/engine/web/image';
import {
  controlledFixture, runProvider, rejection, errorIs, deferred, observe,
  structuralPng, chunk, header, concat, word, SIGNATURE, RGBA_PIXELS, RGB_PIXELS,
} from './browser-png-fixture.mjs';

const code = name => 'WEB_PNG_' + name;
async function legal(provider, fixture) {
  const value = await fixture.load();
  assert.ok(isTexture(value));
  assert.deepEqual([...copyImageData2DPixels(value.imageData)], [...fixture.pixels]);
  assert.deepEqual(value.sourceRect, { x: 0, y: 0, width: fixture.width, height: fixture.height });
  assert.equal(fixture.bitmaps.at(-1).closed, 1);
  assert.deepEqual(fixture.canvases.at(-1).resets, ['width', 'height']);
  return value;
}
/** A refused mutant follows a complete legal invocation in its own fixture. */
function control(name, body, options) {
  test(name, { timeout: 10_000 }, async () => runProvider(createProvider, async (provider, fixture) => {
    await legal(provider, fixture);
    await body(provider, fixture);
  }, options));
}
async function factoryRefusal(input, name, expected = {}) {
  let accidental, primary, cleanup;
  try { assert.throws(() => { accidental = createProvider(input); }, errorIs(code(name), expected)); }
  catch (cause) { primary = { cause }; }
  try { if (accidental !== undefined) await accidental.close(); }
  catch (cause) { cleanup = { cause }; }
  if (primary && cleanup) throw new AggregateError([primary.cause, cleanup.cause], 'BIP1_FACTORY_CONTROL_AND_CLEANUP_FAILED');
  if (cleanup) throw cleanup.cause;
  if (primary) throw primary.cause;
}
for (const [label, value] of [['undefined', undefined], ['null', null], ['number', 1], ['function', () => {}]]) {
  control('BIP01 options record refuses ' + label, async () => factoryRefusal(value, 'OPTIONS_INVALID'));
}
control('BIP01 facade is frozen, receiver-exact and keeps one close Promise', async provider => {
  assert.ok(Object.isFrozen(provider));
  assert.equal(provider.profile, 'png-rgb-rgba8-browser-normalized-v1');
  assert.equal(provider.isClosed, false);
  const getter = Object.getOwnPropertyDescriptor(provider, 'isClosed').get;
  assert.throws(() => Reflect.apply(getter, {}, []), errorIs(code('PROVIDER_INVALID')));
  await rejection(Reflect.apply(provider.load, {}, []), code('PROVIDER_INVALID'));
  assert.throws(() => Reflect.apply(provider.dispose, {}, []), errorIs(code('PROVIDER_INVALID')));
  assert.throws(() => Reflect.apply(provider.close, {}, []), errorIs(code('PROVIDER_INVALID')));
  const closed = provider.close();
  assert.equal(provider.isClosed, true);
  assert.equal(provider.close(), closed);
  await closed;
  assert.equal(provider.profile, 'png-rgb-rgba8-browser-normalized-v1');
  await rejection(provider.load(undefined, undefined), code('PROVIDER_CLOSED'));
  await rejection(Reflect.apply(provider.load, {}, []), code('PROVIDER_INVALID'));
});
control('BIP02 options and port fields are staged before value validation', async () => {
  const reads = [], failure = undefined;
  await factoryRefusal({
    get readBytes() { reads.push('readBytes'); return 0; },
    get ports() { reads.push('ports'); throw failure; },
    get unknown() { throw new Error('Unknown field was read'); },
  }, 'DESCRIPTOR_READ_FAILED', { cause: failure });
  assert.deepEqual(reads, ['readBytes', 'ports']);
  reads.length = 0;
  await factoryRefusal({
    readBytes: async () => new Uint8Array(),
    ports: {
      get decode() { reads.push('decode'); return 0; },
      get createCanvas() { reads.push('createCanvas'); throw failure; },
    },
  }, 'DESCRIPTOR_READ_FAILED', { cause: failure });
  assert.deepEqual(reads, ['decode', 'createCanvas']);
});
for (const [label, ports] of [['null', null], ['number', 1], ['missing methods', {}], ['wrong callback', { decode: 1, createCanvas() {} }]]) {
  control('BIP02 supplied ports refuse ' + label, async () => factoryRefusal({ readBytes: async () => new Uint8Array(), ports }, 'OPTIONS_INVALID'));
}
control('BIP02 later operation replacement and callback call properties are ignored', async (provider, fixture) => {
  const originalRead = fixture.options.readBytes, originalDecode = fixture.ports.decode, originalCanvas = fixture.ports.createCanvas;
  originalRead.call = originalRead.apply = () => { throw new Error('mutable read invocation'); };
  originalDecode.call = originalDecode.apply = () => { throw new Error('mutable decode invocation'); };
  originalCanvas.call = originalCanvas.apply = () => { throw new Error('mutable canvas invocation'); };
  fixture.options.readBytes = fixture.ports.decode = fixture.ports.createCanvas = () => { throw new Error('replaced operation'); };
  const value = await fixture.load();
  assert.ok(isTexture(value));
  assert.equal(fixture.readerCalls.at(-1).ref, fixture.ref);
  assert.equal(fixture.readerCalls.at(-1).context, fixture.context);
  assert.equal(fixture.readerCalls.at(-1).receiver, fixture.options);
  assert.equal(fixture.decodeCalls.at(-1).receiver, fixture.ports);
});
for (const [label, value] of [['null', null], ['missing fields', {}], ['invalid signal', { signal: null, resourceGeneration: 1, taskId: 1 }], ['invalid generation', { signal: {}, resourceGeneration: 0, taskId: 1 }]]) {
  control('BIP02 context refuses ' + label, async (provider, fixture) => {
    const before = fixture.readerCalls.length;
    await rejection(provider.load(fixture.ref, value), code('CONTEXT_INVALID'));
    assert.equal(fixture.readerCalls.length, before);
  });
}
control('BIP02 context finishes bootstrap before polling signal or numeric validation', async (provider, fixture) => {
  const reads = [], fault = undefined;
  const context = {
    get signal() { reads.push('signal'); return { get aborted() { throw new Error('polled too early'); } }; },
    get resourceGeneration() { reads.push('resourceGeneration'); return 0; },
    get taskId() { reads.push('taskId'); throw fault; },
  };
  await rejection(provider.load(fixture.ref, context), code('DESCRIPTOR_READ_FAILED'), { cause: fault });
  assert.deepEqual(reads, ['signal', 'resourceGeneration', 'taskId']);
});
control('BIP02 successful context getter close prevents the next bootstrap getter', async (provider, fixture) => {
  const reads = [];
  await rejection(provider.load(fixture.ref, {
    get signal() { reads.push('signal'); provider.close(); return fixture.controller.signal; },
    get resourceGeneration() { reads.push('forbidden'); return 1; },
    taskId: 1,
  }), code('PROVIDER_CLOSED'));
  assert.deepEqual(reads, ['signal']);
});
for (const [name, signal] of [
  ['nonboolean aborted', { aborted: 1, reason: 'unused' }],
  ['throwing aborted', { get aborted() { throw undefined; }, reason: 'unused' }],
  ['throwing reason', { aborted: true, get reason() { throw undefined; } }],
]) {
  control('BIP04 signal refuses ' + name, async (provider, fixture) => {
    const expected = name.startsWith('throwing') ? { cause: undefined } : {};
    await rejection(provider.load(fixture.ref, Object.freeze({ signal, resourceGeneration: 1, taskId: 1 })), code('SIGNAL_READ_FAILED'), expected);
  });
}
control('BIP04 reason is not read for an open uncancelled signal', async (provider, fixture) => {
  const signal = { aborted: false, get reason() { throw new Error('unused reason'); } };
  const value = await fixture.load(fixture.ref, Object.freeze({ signal, resourceGeneration: 1, taskId: 1 }));
  assert.ok(isTexture(value));
});
control('BIP04 successful signal getter close takes priority over cancellation', async (provider, fixture) => {
  let reasonReads = 0;
  const signal = { get aborted() { provider.close(); return true; }, get reason() { reasonReads++; return 'cancelled'; } };
  await rejection(provider.load(fixture.ref, { signal, resourceGeneration: 1, taskId: 1 }), code('PROVIDER_CLOSED'));
  assert.equal(reasonReads, 0);
});
control('BIP04 synchronous source throw keeps undefined cause even when source closes', async (provider, fixture) => {
  fixture.controls.readBytes = () => { provider.close(); throw undefined; };
  await rejection(provider.load(fixture.ref, fixture.context), code('READ_FAILED'), { cause: undefined, cleanupErrors: [] });
});
control('BIP04 rejected source preserves original cause and the next clean load works', async (provider, fixture) => {
  const failure = new Error('source failure');
  fixture.controls.readBytes = () => Promise.reject(failure);
  await rejection(provider.load(fixture.ref, fixture.context), code('READ_FAILED'), { cause: failure });
  delete fixture.controls.readBytes;
  assert.ok(isTexture(await fixture.load()));
});
control('BIP02 a reader thenable resolves through Promise machinery', async (provider, fixture) => {
  let resolutions = 0;
  fixture.controls.readBytes = () => ({ then(resolve) { resolutions++; resolve(fixture.bytes); } });
  assert.ok(isTexture(await fixture.load()));
  assert.equal(resolutions, 1);
});
control('BIP02 selected offset bytes are copied before decode mutates reader input', async (provider, fixture) => {
  const original = new Uint8Array(fixture.bytes), backing = new Uint8Array(original.length + 10).fill(91);
  backing.set(original, 4);
  fixture.bytes = backing.subarray(4, 4 + original.length);
  fixture.controls.decode = async (blob, options, source) => {
    assert.equal(blob.type, 'image/png');
    source.bytes.fill(0);
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), original);
    return source.makeBitmap();
  };
  assert.ok(isTexture(await fixture.load()));
  assert.deepEqual([...backing.subarray(0, 4)], [91,91,91,91]);
});
for (const [name, make] of [
  ['clamped array', () => new Uint8ClampedArray(8)],
  ['lookalike', () => ({ buffer: new ArrayBuffer(8), byteOffset: 0, byteLength: 8 })],
  ['shared backing', () => new Uint8Array(new SharedArrayBuffer(8))],
  ['resizable backing', () => new Uint8Array(new ArrayBuffer(8, { maxByteLength: 16 }))],
  ['detached backing', () => { const bytes = new Uint8Array(8); structuredClone(bytes.buffer, { transfer: [bytes.buffer] }); return bytes; }],
]) {
  control('BIP02 binary input refuses ' + name, async (provider, fixture) => {
    fixture.bytes = make();
    const calls = fixture.decodeCalls.length;
    await rejection(provider.load(fixture.ref, fixture.context), code('BYTES_INVALID'));
    assert.equal(fixture.decodeCalls.length, calls);
  });
}
control('BIP02 per-load one-over encoded limit stops before decode', async (provider, fixture) => {
  fixture.bytes = new Uint8Array(8_388_609);
  const calls = fixture.decodeCalls.length;
  await rejection(provider.load(fixture.ref, fixture.context), code('INPUT_LIMIT'));
  assert.equal(fixture.decodeCalls.length, calls);
});
control('BIP02 encoded-byte endpoint reaches controlled decode with exact Blob size', async (provider, fixture) => {
  fixture.bytes = structuralPng({ idats: [chunk('IDAT', new Uint8Array(8_388_608 - 57))] });
  assert.equal(fixture.bytes.length, 8_388_608);
  assert.ok(isTexture(await fixture.load()));
  assert.equal(fixture.decodeCalls.at(-1).blob.size, 8_388_608);
});
control('BIP04 four pending jobs are admitted and fifth refuses before context reads', async (provider, fixture) => {
  const tasks = [];
  fixture.controls.readBytes = () => { const pending = deferred(); tasks.push(pending); return pending.promise; };
  const loads = Array.from({ length: 4 }, () => observe(provider.load(fixture.ref, fixture.context)));
  let contextReads = 0, results;
  try {
    await rejection(provider.load(fixture.ref, { get signal() { contextReads++; throw new Error('cap gate bypass'); } }), code('JOB_LIMIT'));
    assert.equal(contextReads, 0); assert.equal(tasks.length, 4);
  } finally {
    for (const task of tasks) task.resolve(fixture.bytes);
    results = await Promise.all(loads);
    // Own every fulfilled value before a primary assertion can leave this body.
    for (const result of results) if (result.fulfilled) fixture.issued.push(result.value);
  }
  for (const result of results) assert.equal(result.fulfilled, true);
  delete fixture.controls.readBytes;
  assert.ok(isTexture(await fixture.load()), 'clean completed jobs return capacity');
});
const structuralControls = [
  ['signature', () => { const bytes = structuralPng(); bytes[0] = 0; return bytes; }],
  ['truncated chunk', () => structuralPng().subarray(0, 40)],
  ['oversized chunk length', () => concat([new Uint8Array(SIGNATURE), new Uint8Array([128,0,0,0,73,72,68,82])])],
  ['missing first IHDR', () => concat([new Uint8Array(SIGNATURE), chunk('IDAT', [0]), chunk('IEND')])],
  ['wrong IHDR length', () => concat([new Uint8Array(SIGNATURE), chunk('IHDR', [0]), chunk('IDAT', [0]), chunk('IEND')])],
  ['duplicate IHDR', () => structuralPng({ before: [header()] })],
  ['nonconsecutive IDAT', () => structuralPng({ idats: [chunk('IDAT', [0]), chunk('sRGB', [0]), chunk('IDAT', [0])] })],
  ['empty aggregate IDAT', () => structuralPng({ idats: [chunk('IDAT')] })],
  ['nonempty IEND', () => concat([new Uint8Array(SIGNATURE), header(), chunk('IDAT', [0]), chunk('IEND', [1])])],
  ['trailing bytes', () => structuralPng({ trailing: [new Uint8Array([1])] })],
  ['lowercase reserved type bit', () => structuralPng({ before: [chunk('abcd', [0])] })],
  ['later framing wins over unsupported color', () => structuralPng({ color: 3, trailing: [new Uint8Array([1])] })],
];
for (const [name, make] of structuralControls) {
  control('BIP03 structural refusal: ' + name, async (provider, fixture) => {
    fixture.bytes = make(); const calls = fixture.decodeCalls.length;
    await rejection(provider.load(fixture.ref, fixture.context), code('STRUCTURE_INVALID'));
    assert.equal(fixture.decodeCalls.length, calls);
  });
}
const profiles = [
  ['16-bit', { depth: 16 }], ['palette', { color: 3 }], ['interlace', { interlace: 1 }],
  ['animation', { before: [chunk('acTL', concat([word(1), word(0)]))] }],
  ['unknown ancillary', { before: [chunk('vpAg', [0])] }],
  ['gamma without sRGB', { before: [chunk('gAMA', word(45455))] }],
  ['mismatched gamma', { before: [chunk('sRGB', [0]), chunk('gAMA', word(45454))] }],
  ['rendering intent outside profile', { before: [chunk('sRGB', [4])] }],
];
for (const [name, fields] of profiles) {
  control('BIP03 profile refusal: ' + name, async (provider, fixture) => {
    fixture.bytes = structuralPng(fields); const calls = fixture.decodeCalls.length;
    await rejection(provider.load(fixture.ref, fixture.context), code('PROFILE_UNSUPPORTED'));
    assert.equal(fixture.decodeCalls.length, calls);
  });
}
control('BIP03 exact sRGB compatibility metadata is admitted by structural preflight', async (provider, fixture) => {
  const chromaticities = concat([31270,32900,64000,33000,30000,60000,15000,6000].map(word));
  fixture.bytes = structuralPng({ before: [chunk('sRGB', [3]), chunk('gAMA', word(45455)), chunk('cHRM', chromaticities)] });
  assert.ok(isTexture(await fixture.load()));
  fixture.bytes = structuralPng({ color: 2 }); fixture.pixels = new Uint8ClampedArray(RGB_PIXELS);
  assert.deepEqual([...copyImageData2DPixels((await fixture.load()).imageData)], RGB_PIXELS);
});
control('BIP05 decode receives exact frozen options and owned output outlives transient handles', async (provider, fixture) => {
  const value = await fixture.load(), call = fixture.decodeCalls.at(-1);
  assert.deepEqual(Object.keys(call.options), ['imageOrientation', 'premultiplyAlpha', 'colorSpaceConversion']);
  assert.deepEqual(call.options, { imageOrientation: 'from-image', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  assert.ok(Object.isFrozen(call.options));
  assert.notEqual(call.options, fixture.decodeCalls[0].options);
  fixture.bytes.fill(0); fixture.pixels.fill(0);
  assert.deepEqual([...copyImageData2DPixels(value.imageData)], RGBA_PIXELS);
  const saved = value.imageData;
  provider.dispose(value); provider.dispose(value);
  assert.equal(value.isDisposed, true);
  assert.deepEqual([...copyImageData2DPixels(saved)], RGBA_PIXELS);
});
control('BIP05 foreign Texture disposal is refused without destroying its owner', async (provider, fixture) => {
  // Another authentic provider creates a foreign value; no structural forgery is used.
  const otherFixture = controlledFixture(), other = createProvider(otherFixture.options);
  let foreign;
  try {
    foreign = await other.load(otherFixture.ref, otherFixture.context);
    assert.throws(() => provider.dispose(foreign), errorIs(code('VALUE_INVALID')));
    assert.equal(foreign.isDisposed, false);
  } finally { if (foreign !== undefined) other.dispose(foreign); await other.close(); }
});

control('BIP02 admitted 1024-chunk endpoint and one-over chunk limit stay bounded', async (provider, fixture) => {
  fixture.bytes = structuralPng({ idats: Array.from({ length: 1022 }, () => chunk('IDAT', [0])) });
  assert.ok(isTexture(await fixture.load()));
  fixture.bytes = structuralPng({ idats: Array.from({ length: 1023 }, () => chunk('IDAT', [0])) });
  const calls = fixture.decodeCalls.length;
  await rejection(provider.load(fixture.ref, fixture.context), code('INPUT_LIMIT'));
  assert.equal(fixture.decodeCalls.length, calls);
});
control('BIP02 source edge and pixel endpoints reuse existing image limits', async (provider, fixture) => {
  fixture.width = 4096; fixture.height = 1; fixture.pixels = new Uint8ClampedArray(4 * 4096);
  fixture.bytes = structuralPng({ width: 4096, height: 1 });
  assert.equal((await fixture.load()).width, 4096);
  fixture.width = 1024; fixture.height = 1024; fixture.pixels = new Uint8ClampedArray(4 * 1_048_576);
  fixture.bytes = structuralPng({ width: 1024, height: 1024 });
  const image = (await fixture.load()).imageData;
  assert.equal(image.byteLength, 4 * 1_048_576);
  const before = fixture.decodeCalls.length;
  fixture.bytes = structuralPng({ width: 4097, height: 1 });
  await rejection(provider.load(fixture.ref, fixture.context), code('INPUT_LIMIT'));
  fixture.bytes = structuralPng({ width: 1025, height: 1024 });
  await rejection(provider.load(fixture.ref, fixture.context), code('INPUT_LIMIT'));
  assert.equal(fixture.decodeCalls.length, before);
});
control('BIP02 four maximum encoded payloads reach decode while the fifth job still refuses', async (provider, fixture) => {
  fixture.bytes = structuralPng({ idats: [chunk('IDAT', new Uint8Array(8_388_608 - 57))] });
  const pendingDecodes = [], allEntered = deferred();
  fixture.controls.decode = blob => {
    assert.equal(blob.size, 8_388_608);
    const task = deferred(); pendingDecodes.push(task);
    if (pendingDecodes.length === 4) allEntered.resolve();
    return task.promise;
  };
  const pending = Array.from({ length: 4 }, () => observe(provider.load(fixture.ref, fixture.context)));
  let results;
  try {
    await allEntered.promise;
    assert.equal(pendingDecodes.length * fixture.bytes.length, 33_554_432);
    await rejection(provider.load(fixture.ref, fixture.context), code('JOB_LIMIT'));
  } finally {
    for (const task of pendingDecodes) task.resolve(fixture.makeBitmap());
    results = await Promise.all(pending);
    // No assertion here may replace the original cap-check failure.
    for (const result of results) if (result.fulfilled) fixture.issued.push(result.value);
  }
  for (const result of results) assert.equal(result.fulfilled, true);
  // These admitted Blob sizes and four pending operations are observable.
  // They do not measure retained physical memory or create a separate,
  // unreachable aggregate one-over admission case.
});
