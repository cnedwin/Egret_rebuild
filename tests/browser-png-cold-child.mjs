// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';

const mode = process.argv[2];
assert.equal(process.argv.length, 3);
assert.ok(['baseline', 'trap-image', 'trap-root', 'capability'].includes(mode));
const imageNames = ['createBrowserTextureProvider', 'BrowserPngDecodeOptions', 'BrowserPngPorts',
  'BrowserTextureProviderOptions', 'BrowserTextureProvider'];
let reads = 0;
const result = { mode, browserGlobalReads: null };
function finish(primary, cleanup) {
  if (primary && cleanup) throw new AggregateError([primary.cause, cleanup.cause], 'BIP_COLD_PRIMARY_AND_CLEANUP_FAILED');
  if (cleanup) throw cleanup.cause;
  if (primary) throw primary.cause;
}
/** Existing public CPU resources and genuine manager ownership, no image ports. */
async function baseline() {
  const egret = await import('@egret/engine');
  const trace = [], timers = new Set(), adapter = { surface: {}, start() { trace.push('start'); }, stop() { trace.push('stop'); },
    async close() { trace.push('close'); }, setTimeout(callback, delayMs) {
      const token = { callback, delayMs }; timers.add(token); return () => timers.delete(token);
    } };
  let engine, texture, primary, cleanup;
  try {
    engine = await egret.createEngine({ host: adapter });
    texture = egret.createTexture(egret.createImageData2D({ width: 2, height: 1,
      pixels: new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0]) }));
    const type = egret.createAssetType('bip-cold-existing-texture', egret.isTexture);
    const ref = egret.createAssetRef(type, 'original.png');
    engine.assets.register(type, { async load(actual) { assert.equal(actual, ref); return texture; }, dispose(value) { assert.equal(value, texture); value.dispose(); } });
    const scope = engine.createScope(), lease = scope.use(await engine.assets.acquire(ref));
    const sheet = scope.use(egret.createSpriteSheet(lease, [{ name: 'red', x: 0, y: 0, width: 1, height: 1 }]));
    const bitmap = scope.use(sheet.createBitmap('red'));
    engine.stage.addChild(bitmap);
    const image = texture.imageData;
    sheet.dispose();
    assert.equal(bitmap.textureLease, lease);
    assert.deepEqual([...egret.copyImageData2DPixels(image)], [255, 0, 0, 255, 0, 0, 0, 0]);
    for (const name of imageNames) assert.equal(name in egret, false);
  } catch (cause) { primary = { cause }; }
  try {
    if (engine !== undefined) await engine.dispose();
    if (texture !== undefined) { texture.dispose(); assert.equal(texture.isDisposed, true); }
    if (engine !== undefined) { assert.deepEqual(trace, ['start', 'stop', 'close']); assert.equal(timers.size, 0); }
  } catch (cause) { cleanup = { cause }; }
  finish(primary, cleanup);
  result.publicBaselineCompleted = true;
}
if (mode === 'baseline' || mode === 'capability') {
  await baseline(); // Complete genuine caller/Engine cleanup before optional import.
  const image = await import('@egret/engine/web/image');
  assert.deepEqual(Object.keys(image), ['createBrowserTextureProvider']);
  result.optionalKeys = Object.keys(image);
  if (mode === 'capability') {
    assert.equal(Object.hasOwn(globalThis, 'window'), false);
    assert.equal(Object.hasOwn(globalThis, 'document'), false);
    let accidental, primary, cleanup;
    try {
      assert.throws(() => { accidental = image.createBrowserTextureProvider({ async readBytes() { return new Uint8Array([1]); } }); }, error => error.code === 'WEB_PNG_UNAVAILABLE');
    } catch (cause) { primary = { cause }; }
    try { if (accidental !== undefined) await accidental.close(); }
    catch (cause) { cleanup = { cause }; }
    finish(primary, cleanup);
    result.defaultCapabilityRefusal = 'WEB_PNG_UNAVAILABLE';
  }
} else {
  // Each trap mode is a fresh process: no product has been imported here yet.
  const names = ['window', 'document', 'ImageBitmap', 'createImageBitmap', 'Blob'];
  const saved = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  let primary, cleanup;
  try {
    for (const [name, original] of saved) {
      assert.ok(original === undefined || original.configurable);
      Object.defineProperty(globalThis, name, { configurable: true, get() { reads++; throw new Error('BIP_COLD_GLOBAL_READ:' + name); } });
    }
    if (mode === 'trap-image') {
      const image = await import('@egret/engine/web/image');
      assert.deepEqual(Object.keys(image), ['createBrowserTextureProvider']);
      result.optionalKeys = Object.keys(image);
    } else {
      const egret = await import('@egret/engine');
      for (const name of imageNames) assert.equal(name in egret, false);
      result.rootExcludesBrowserPng = true;
    }
    assert.equal(reads, 0);
  } catch (cause) { primary = { cause }; }
  try {
    for (const [name, descriptor] of saved) {
      if (descriptor === undefined) assert.equal(Reflect.deleteProperty(globalThis, name), true);
      else Object.defineProperty(globalThis, name, descriptor);
      assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, name), descriptor);
    }
    result.descriptorsRestored = true;
  } catch (cause) { cleanup = { cause }; }
  finish(primary, cleanup);
}
if (mode.startsWith('trap-')) result.browserGlobalReads = reads;
console.log('BIP_COLD_PASS ' + JSON.stringify(result));
