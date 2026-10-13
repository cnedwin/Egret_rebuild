// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserTextureProvider as createProvider } from '@egret/engine/web/image';
import { runProvider, rejection, errorIs, deferred, observe } from './browser-png-fixture.mjs';

const code = name => 'WEB_PNG_' + name;
function control(name, body, options) {
  test(name, { timeout: 10_000 }, async () => runProvider(createProvider, async (provider, fixture) => {
    await fixture.load(); // Complete fresh legal invocation before one assigned fault.
    await body(provider, fixture);
  }, options));
}
function resetFailure(canvas, widthFailure, heightFailure, attempts) {
  const width = Object.getOwnPropertyDescriptor(canvas, 'width');
  const height = Object.getOwnPropertyDescriptor(canvas, 'height');
  Object.defineProperties(canvas, {
    width: { ...width, set(value) {
      if (value === 0) { attempts.push('width'); throw widthFailure; }
      Reflect.apply(width.set, canvas, [value]);
    } },
    height: { ...height, set(value) {
      if (value === 0) { attempts.push('height'); throw heightFailure; }
      Reflect.apply(height.set, canvas, [value]);
    } },
  });
}
control('BIP04 already-cancelled direct load invokes no reader', async (provider, fixture) => {
  const before = fixture.readerCalls.length, reason = { original: 'before source' };
  fixture.controller.abort(reason);
  await rejection(provider.load(fixture.ref, fixture.context), code('CANCELLED'), { cause: reason });
  assert.equal(fixture.readerCalls.length, before);
});
control('BIP04 cancellation while reader is pending retires cleanly without decode', async (provider, fixture) => {
  const task = deferred(), reason = { original: 'pending source' }, before = fixture.decodeCalls.length;
  fixture.controls.readBytes = () => task.promise;
  const observed = observe(provider.load(fixture.ref, fixture.context));
  try { fixture.controller.abort(reason); }
  finally { task.resolve(fixture.bytes); }
  const result = await observed;
  assert.equal(result.fulfilled, false);
  errorIs(code('CANCELLED'), { cause: reason })(result.cause);
  assert.equal(fixture.decodeCalls.length, before);
});
control('BIP04 close remains pending until source settles and keeps identical Promise', async (provider, fixture) => {
  const task = deferred();
  fixture.controls.readBytes = () => task.promise;
  const loading = observe(provider.load(fixture.ref, fixture.context));
  const closing = provider.close(), state = { settled: false };
  void observe(closing).then(result => { state.settled = true; state.result = result; });
  try {
    assert.equal(provider.isClosed, true);
    assert.equal(provider.close(), closing);
    await Promise.resolve();
    assert.equal(state.settled, false);
  } finally { task.resolve(fixture.bytes); }
  const result = await loading;
  assert.equal(result.fulfilled, false); errorIs(code('PROVIDER_CLOSED'))(result.cause);
  await closing;
  assert.equal(fixture.decodeCalls.length, 1, 'only the legal baseline decoded');
});
control('BIP04 source rejection remains primary after cancellation', async (provider, fixture) => {
  const task = deferred();
  fixture.controls.readBytes = () => task.promise;
  const loading = observe(provider.load(fixture.ref, fixture.context));
  fixture.controller.abort('cancelled while source pending');
  task.reject(undefined);
  const result = await loading;
  assert.equal(result.fulfilled, false);
  errorIs(code('READ_FAILED'), { cause: undefined, cleanupErrors: [] })(result.cause);
});
control('BIP04 pending decode cancellation closes its late bitmap without creating a surface', async (provider, fixture) => {
  const task = deferred(), entered = deferred(), reason = { original: 'pending decode' }, surfaces = fixture.canvases.length;
  fixture.controls.decode = () => { entered.resolve(); return task.promise; };
  const loading = observe(provider.load(fixture.ref, fixture.context));
  let late;
  try {
    await entered.promise;
    fixture.controller.abort(reason);
  } finally { late = fixture.makeBitmap(); task.resolve(late); }
  const result = await loading;
  assert.equal(result.fulfilled, false); errorIs(code('CANCELLED'), { cause: reason })(result.cause);
  assert.equal(late.closed, 1);
  assert.equal(fixture.canvases.length, surfaces);
});
control('BIP04 close waits pending controlled decode and safely retires late fulfillment', async (provider, fixture) => {
  const task = deferred(), entered = deferred(), surfaces = fixture.canvases.length;
  fixture.controls.decode = () => { entered.resolve(); return task.promise; };
  const loading = observe(provider.load(fixture.ref, fixture.context));
  let late, closing;
  try { await entered.promise; closing = provider.close(); assert.equal(provider.close(), closing); }
  finally { late = fixture.makeBitmap(); task.resolve(late); }
  const result = await loading;
  assert.equal(result.fulfilled, false); errorIs(code('PROVIDER_CLOSED'))(result.cause);
  await closing;
  assert.equal(late.closed, 1); assert.equal(fixture.canvases.length, surfaces);
});
control('BIP05 decode rejection creates no fictitious returned-handle retirement', async (provider, fixture) => {
  const handles = fixture.bitmaps.length, failure = undefined;
  fixture.controls.decode = () => Promise.reject(failure);
  await rejection(provider.load(fixture.ref, fixture.context), code('DECODE_FAILED'), { cause: failure, cleanupErrors: [] });
  assert.equal(fixture.bitmaps.length, handles);
});
control('BIP05 primitive decoded result refuses without fabricated close or quarantine', async (provider, fixture) => {
  const handles = fixture.bitmaps.length;
  fixture.controls.decode = () => Promise.resolve(17);
  await rejection(provider.load(fixture.ref, fixture.context), code('BITMAP_INVALID'), { cleanupErrors: [] });
  assert.equal(fixture.bitmaps.length, handles);
});
control('BIP05 closable bitmap with wrong dimensions is closed once', async (provider, fixture) => {
  let malformed;
  fixture.controls.decode = () => {
    malformed = fixture.makeBitmap();
    Object.defineProperty(malformed, 'width', { configurable: true, value: 3 });
    return Promise.resolve(malformed);
  };
  await rejection(provider.load(fixture.ref, fixture.context), code('BITMAP_INVALID'), { cleanupErrors: [] });
  assert.equal(malformed.closed, 1);
});
control('BIP05 successful bitmap width getter close prevents height read and drawing', async (provider, fixture) => {
  let late, heightReads = 0;
  const surfaces = fixture.canvases.length;
  fixture.controls.decode = () => {
    late = fixture.makeBitmap();
    Object.defineProperties(late, {
      width: { configurable: true, get() { provider.close(); return 2; } },
      height: { configurable: true, get() { heightReads++; return 1; } },
    });
    return Promise.resolve(late);
  };
  await rejection(provider.load(fixture.ref, fixture.context), code('PROVIDER_CLOSED'));
  assert.equal(late.closed, 1); assert.equal(heightReads, 0); assert.equal(fixture.canvases.length, surfaces);
});
control('BIP05 throwing bitmap getter retains undefined primary over its close side effect', async (provider, fixture) => {
  let late;
  fixture.controls.decode = () => {
    late = fixture.makeBitmap();
    Object.defineProperty(late, 'width', { configurable: true, get() { provider.close(); throw undefined; } });
    return Promise.resolve(late);
  };
  await rejection(provider.load(fixture.ref, fixture.context), code('DESCRIPTOR_READ_FAILED'), { cause: undefined, cleanupErrors: [] });
  assert.equal(late.closed, 1);
});
control('BIP05 unclosable object keeps a quarantine reason without pretending to close', async (provider, fixture) => {
  const handles = fixture.bitmaps.length;
  fixture.controls.decode = () => Promise.resolve({ width: 2, height: 1 });
  await rejection(provider.load(fixture.ref, fixture.context), code('BITMAP_INVALID'), { cleanupErrors: [] });
  assert.equal(fixture.bitmaps.length, handles);
  await rejection(provider.close(), code('CLOSE_INCOMPLETE'));
}, { closeCode: code('CLOSE_INCOMPLETE') });
control('BIP05 throwing retirement descriptor preserves undefined and quarantines unknown ownership', async (provider, fixture) => {
  let late;
  fixture.controls.decode = () => {
    late = fixture.makeBitmap();
    Object.defineProperty(late, 'close', { configurable: true, get() { throw undefined; } });
    return Promise.resolve(late);
  };
  await rejection(provider.load(fixture.ref, fixture.context), code('DESCRIPTOR_READ_FAILED'), { cause: undefined, cleanupErrors: [] });
  assert.equal(late.closed, 0);
  await rejection(provider.close(), code('CLOSE_INCOMPLETE'), { cause: undefined, cleanupErrors: [undefined] });
}, { closeCode: code('CLOSE_INCOMPLETE') });
control('BIP05 repeated bitmap is refused without closing an earlier handle twice', async (provider, fixture) => {
  const prior = fixture.bitmaps[0];
  fixture.controls.decode = () => Promise.resolve(prior);
  await rejection(provider.load(fixture.ref, fixture.context), code('BITMAP_INVALID'), { cleanupErrors: [] });
  assert.equal(prior.closed, 1);
}, { closeCode: code('CLOSE_INCOMPLETE') });
control('BIP05 connected canvas stays borrowed and is neither reset nor detached', async (provider, fixture) => {
  let canvas;
  fixture.controls.createCanvas = () => {
    canvas = fixture.makeCanvas();
    Object.defineProperty(canvas, 'isConnected', { configurable: true, value: true });
    return canvas;
  };
  await rejection(provider.load(fixture.ref, fixture.context), code('SURFACE_INVALID'), { cleanupErrors: [] });
  assert.deepEqual(canvas.resets, []);
  assert.deepEqual([canvas.width, canvas.height, canvas.isConnected], [300,150,true]);
  assert.equal(fixture.bitmaps.at(-1).closed, 1);
}, { closeCode: code('CLOSE_INCOMPLETE') });
control('BIP05 repeated canvas is not resized on behalf of a second owner', async (provider, fixture) => {
  const prior = fixture.canvases[0], resets = [...prior.resets];
  fixture.controls.createCanvas = () => prior;
  await rejection(provider.load(fixture.ref, fixture.context), code('SURFACE_INVALID'), { cleanupErrors: [] });
  assert.deepEqual(prior.resets, resets);
  assert.equal(fixture.bitmaps.at(-1).closed, 1);
}, { closeCode: code('CLOSE_INCOMPLETE') });
control('BIP05 createCanvas closing callback transfers a safe fresh surface only for retirement', async (provider, fixture) => {
  let canvas;
  const draws = fixture.events.filter(item => item === 'context.draw').length;
  fixture.controls.createCanvas = () => { provider.close(); canvas = fixture.makeCanvas(); return canvas; };
  await rejection(provider.load(fixture.ref, fixture.context), code('PROVIDER_CLOSED'));
  assert.deepEqual(canvas.resets, ['width','height']);
  assert.equal(fixture.bitmaps.at(-1).closed, 1);
  assert.equal(fixture.events.filter(item => item === 'context.draw').length, draws);
});
control('BIP05 readback rejects nonclamped bytes and still retires both transients', async (provider, fixture) => {
  let canvas;
  fixture.controls.createCanvas = () => {
    canvas = fixture.makeCanvas();
    canvas.context.getImageData = function () { return { width: 2, height: 1, data: new Uint8Array(8), colorSpace: 'srgb' }; };
    return canvas;
  };
  await rejection(provider.load(fixture.ref, fixture.context), code('READBACK_INVALID'), { cleanupErrors: [] });
  assert.equal(fixture.bitmaps.at(-1).closed, 1); assert.deepEqual(canvas.resets, ['width','height']);
});
control('BIP05 both reset attempts survive undefined first cleanup failure', async (provider, fixture) => {
  const attempts = [], second = new Error('height reset'), handles = fixture.bitmaps.length;
  fixture.controls.createCanvas = () => { const canvas = fixture.makeCanvas(); resetFailure(canvas, undefined, second, attempts); return canvas; };
  await rejection(provider.load(fixture.ref, fixture.context), code('CLEANUP_FAILED'), { cause: undefined, cleanupErrors: [undefined, second] });
  assert.deepEqual(attempts, ['width','height']);
  assert.equal(fixture.bitmaps.length, handles + 1); assert.equal(fixture.bitmaps.at(-1).closed, 1);
  await rejection(provider.close(), code('CLOSE_INCOMPLETE'), { cause: undefined, cleanupErrors: [undefined, second] });
}, { closeCode: code('CLOSE_INCOMPLETE') });
control('BIP05 raster throw remains primary alongside complete cleanup failures', async (provider, fixture) => {
  const first = new Error('width reset'), second = new Error('height reset'), attempts = [];
  fixture.controls.createCanvas = () => {
    const canvas = fixture.makeCanvas();
    canvas.context.drawImage = () => { throw undefined; };
    resetFailure(canvas, first, second, attempts);
    return canvas;
  };
  await rejection(provider.load(fixture.ref, fixture.context), code('RASTER_FAILED'), { cause: undefined, cleanupErrors: [first, second] });
  assert.deepEqual(attempts, ['width','height']);
  await rejection(provider.close(), code('CLOSE_INCOMPLETE'), { cause: first, cleanupErrors: [first, second] });
}, { closeCode: code('CLOSE_INCOMPLETE') });
control('BIP05 close quarantine reasons follow admission order rather than settlement order', async (provider, fixture) => {
  const tasks = [], bothEntered = deferred();
  fixture.controls.decode = () => {
    const pending = deferred(); tasks.push(pending);
    if (tasks.length === 2) bothEntered.resolve();
    return pending.promise;
  };
  const first = observe(provider.load(fixture.ref, fixture.context)), second = observe(provider.load(fixture.ref, fixture.context));
  let secondResult;
  try {
    await bothEntered.promise;
    tasks[1].resolve({ width: 2, height: 1 });
    secondResult = await second;
    assert.equal(secondResult.fulfilled, false); errorIs(code('BITMAP_INVALID'))(secondResult.cause);
  } finally {
    const unknown = fixture.makeBitmap();
    Object.defineProperty(unknown, 'close', { configurable: true, get() { throw undefined; } });
    tasks[0]?.resolve(unknown);
    tasks[1]?.resolve({ width: 2, height: 1 });
  }
  const firstResult = await first;
  assert.equal(firstResult.fulfilled, false); errorIs(code('DESCRIPTOR_READ_FAILED'), { cause: undefined })(firstResult.cause);
  await rejection(provider.close(), code('CLOSE_INCOMPLETE'), { cause: undefined, cleanupErrors: [undefined, secondResult.cause.cause] });
}, { closeCode: code('CLOSE_INCOMPLETE') });

control('BIP05 bitmap-close failure does not prevent either Canvas reset attempt', async (provider, fixture) => {
  const attempts = [], widthFailure = new Error('width'), heightFailure = new Error('height');
  fixture.controls.decode = () => {
    const bitmap = fixture.makeBitmap();
    Object.defineProperty(bitmap, 'close', { configurable: true, value: function () {
      assert.equal(this, bitmap); attempts.push('bitmap'); throw undefined;
    } });
    return Promise.resolve(bitmap);
  };
  fixture.controls.createCanvas = () => {
    const canvas = fixture.makeCanvas();
    resetFailure(canvas, widthFailure, heightFailure, attempts);
    return canvas;
  };
  await rejection(provider.load(fixture.ref, fixture.context), code('CLEANUP_FAILED'), {
    cause: undefined, cleanupErrors: [undefined,widthFailure,heightFailure],
  });
  assert.deepEqual(attempts, ['bitmap','width','height']);
  await rejection(provider.close(), code('CLOSE_INCOMPLETE'), {
    cause: undefined, cleanupErrors: [undefined,widthFailure,heightFailure],
  });
}, { closeCode: code('CLOSE_INCOMPLETE') });
control('BIP05 later throwing readback field wins over earlier invalid width', async (provider, fixture) => {
  const reads = [];
  fixture.controls.createCanvas = () => {
    const canvas = fixture.makeCanvas();
    canvas.context.getImageData = () => ({
      get width() { reads.push('width'); return 3; },
      get height() { reads.push('height'); return 1; },
      get data() { reads.push('data'); return fixture.pixels; },
      get colorSpace() { reads.push('colorSpace'); throw undefined; },
    });
    return canvas;
  };
  await rejection(provider.load(fixture.ref, fixture.context), code('DESCRIPTOR_READ_FAILED'), { cause: undefined, cleanupErrors: [] });
  assert.deepEqual(reads, ['width','height','data','colorSpace']);
  assert.equal(fixture.bitmaps.at(-1).closed, 1);
  assert.deepEqual(fixture.canvases.at(-1).resets, ['width','height']);
});
control('BIP04 one quarantined job leaves only three further occupied slots', async (provider, fixture) => {
  fixture.controls.decode = () => Promise.resolve({ width: 2, height: 1 });
  await rejection(provider.load(fixture.ref, fixture.context), code('BITMAP_INVALID'));
  delete fixture.controls.decode;
  const tasks = [];
  fixture.controls.readBytes = () => { const task = deferred(); tasks.push(task); return task.promise; };
  const pending = Array.from({ length: 3 }, () => observe(provider.load(fixture.ref, fixture.context)));
  let results;
  try {
    await rejection(provider.load(fixture.ref, fixture.context), code('JOB_LIMIT'));
    assert.equal(tasks.length, 3);
  } finally {
    for (const task of tasks) task.resolve(fixture.bytes);
    results = await Promise.all(pending);
    // Track successes even when the preceding assertion throws undefined.
    for (const result of results) if (result.fulfilled) fixture.issued.push(result.value);
  }
  for (const result of results) assert.equal(result.fulfilled, true);
}, { closeCode: code('CLOSE_INCOMPLETE') });
