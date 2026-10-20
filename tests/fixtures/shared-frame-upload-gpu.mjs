// SPDX-License-Identifier: Apache-2.0
// Original public-SDK fixture. Owned ports observe scheduling and ownership;
// they neither authenticate native devices nor execute shaders.
import assert from 'node:assert/strict';
import { egret, withPorts, capture, admitted, submit, tick } from './gpu-shared-rendering.mjs';
import { triangleScene } from './gpu-image-residency.mjs';
export { egret, capture, admitted, submit, tick, triangleScene };
export const MiB = 1048576;
export const turn = () => new Promise(resolve => setTimeout(resolve, 0));
export const hasCode = name => error => error instanceof egret.EgretError && error.code === 'WEBGPU_' + name;
export function expectCode(run, name) { assert.throws(run, hasCode(name)); }
export function observe(promise) {
  const result = { settled: false, rejected: false, value: undefined, error: undefined };
  promise.then(value => { result.settled = true; result.value = value; },
    error => { result.settled = true; result.rejected = true; result.error = error; });
  return result;
}
export async function until(f, predicate, { settle = true, maps = true, rounds = 256 } = {}) {
  for (let i = 0; i < rounds && !predicate(); i++) {
    if (settle) {
      f.pipelines.forEach(p => p.resolve(p.value));
      f.scopes.forEach(p => p.resolve(null));
      f.fences.forEach(p => p.resolve());
      if (maps) f.maps.forEach(p => p.resolve());
    }
    await tick(); await turn(); f.assertOracles();
  }
  assert.ok(predicate(), 'owned operations did not reach the finite expected observation');
}
export function requireUpload(h, scene = false) {
  assert.equal(typeof h[scene ? 'stageSceneSharedFrame' : 'stageSharedFrame'], 'function',
    'M15_GPU_UPLOAD_MISSING: genuine ordinary baseline completed; optional staging API absent');
}
export function requireSession(h) {
  for (const key of ['getSessionStatus', 'whenReady', 'recover'])
    assert.equal(typeof h[key], 'function',
      'M15_GPU_SESSION_MISSING: genuine ordinary baseline completed; optional ' + key + ' absent');
}
export async function readyUpload(f, ticket) {
  const watched = observe(ticket.ready); await until(f, () => watched.settled);
  return await ticket.ready;
}
export async function finishUpload(f, ticket) {
  const submission = ticket.submit(), completed = observe(submission.completed);
  await until(f, () => completed.settled); await submission.completed; return submission;
}
export function quietSnapshot(f, h) {
  return { calls: f.calls.length, status: h.getStatus(), shared: h.getSharedStatus(),
    width: f.canvas.width, height: f.canvas.height };
}
export function refusal(f, h, run, name) {
  const before = quietSnapshot(f, h); expectCode(run, name);
  assert.deepEqual(quietSnapshot(f, h), before, 'refused preflight changes no native call, serial, charge or surface');
}
export const presentation = events => events.filter(c =>
  ['width', 'height', 'configure', 'target', 'pass', 'draw', 'drawIndexed', 'copy', 'map'].includes(c[0]));
export function ownSignal() {
  let aborted = false, reason;
  const listeners = new Set(), stats = { adds: 0, removes: 0, abortedReads: 0, reasonReads: 0 };
  const hooks = {};
  const signal = {
    get aborted() { stats.abortedReads++; hooks.aborted?.(); return aborted; },
    get reason() { stats.reasonReads++; hooks.reason?.(); return reason; },
    addEventListener(type, callback) {
      assert.equal(this, signal); assert.equal(type, 'abort'); stats.adds++;
      listeners.add(callback); hooks.add?.();
    },
    removeEventListener(type, callback) {
      assert.equal(this, signal); assert.equal(type, 'abort'); stats.removes++;
      listeners.delete(callback); hooks.remove?.();
    },
  };
  return { signal, hooks, stats, listeners,
    setAborted(value) { aborted = true; reason = value; },
    abort(value) { aborted = true; reason = value; for (const fn of [...listeners]) fn.call(signal); },
  };
}
let assetId = 0;
async function withAuthor(run) {
  const timers = new Set(), resources = [];
  const engine = await egret.createEngine({ host: {
    surface: {}, start() {}, stop() {}, async close() {},
    setTimeout(callback, delay) { const token = { callback, delay }; timers.add(token); return () => timers.delete(token); },
  } });
  const scope = engine.createScope();
  const a = {
    engine, scope,
    capture(options = {}) { return engine.captureSharedFrame({ width: 8, height: 8, ...options }); },
    add(node) { scope.use(node); engine.stage.addChild(node); return node; },
    solid() { const s = a.add(new egret.Sprite()); s.graphics.beginFill(0xff0000).drawRect(0, 0, 2, 2).endFill(); return s; },
    async bitmap(width = 1, height = 1, value = 127) {
      const pixels = new Uint8Array(width * height * 4).fill(value);
      for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
      const source = egret.createImageData2D({ width, height, pixels });
      const texture = egret.createTextureView(source, { packed: { x: 0, y: 0, width, height },
        logicalWidth: width, logicalHeight: height, trimX: 0, trimY: 0, quarterTurn: 0 });
      const name = 'm15-gpu-upload-' + (++assetId), type = egret.createAssetType(name, egret.isTexture);
      const record = { texture, disposed: 0 }; resources.push(record);
      engine.assets.register(type, { async load() { return texture; },
        dispose(item) { record.disposed++; item.dispose(); } });
      const lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, name), { signal: scope.signal }));
      const bitmap = a.add(new egret.Bitmap(lease)); return { bitmap, source, texture, pixels };
    },
  };
  try { return await run(a); }
  finally {
    scope.dispose(); await engine.dispose();
    assert.equal(scope.state, 'closed'); assert.equal(timers.size, 0);
    for (const r of resources) { assert.equal(r.disposed, 1); assert.equal(r.texture.isDisposed, true); }
  }
}
// Handles actual queued tasks before the existing fixture restores navigator.
// All owned deferred native outcomes are settled, including after a test throws.
export async function usingGpu(run, { scene = false, options = {} } = {}) {
  return withPorts(f => withAuthor(async a => {
    // Complete the owned writeBuffer port's optional range parameters. The base
    // fixture copies the observed payload; this adapter records the actual range
    // selected by a native call, without touching a global or SDK implementation.
    const originalWriteBuffer = f.queue.writeBuffer;
    f.queue.writeBuffer = function (buffer, offset, data, dataOffset = 0, size) {
      assert.equal(this, f.queue);
      const unit = data.BYTES_PER_ELEMENT ?? 1;
      const start = (data.byteOffset ?? 0) + dataOffset * unit;
      const length = size === undefined ? data.byteLength - dataOffset * unit : size * unit;
      assert.ok(Number.isSafeInteger(start) && Number.isSafeInteger(length) && length >= 0);
      originalWriteBuffer.call(this, buffer, offset, new Uint8Array(data.buffer ?? data, start, length));
    };
    a.solid();
    const h = f.sharedHost(scene ? { outputAlpha: 'opaque', ...options } : options, scene);
    const sceneFrame = scene ? triangleScene() : undefined;
    const frame = a.capture(scene ? { outputAlpha: 'opaque', clearAlpha: 1 } : {});
    try {
      await f.ready(h);
      await submit(f, h, frame, scene ? value => h.renderSceneSharedFrame(sceneFrame, value) : undefined);
      assert.equal(h.getStatus().pendingFrames, 0);
      assert.equal(h.getStatus().lastSerial, 1, 'genuine ordinary submission precedes every optional API assertion');
      return await run({ f, a, h, frame, sceneFrame });
    } finally {
      for (const key of Object.keys(f.hooks)) delete f.hooks[key];
      const closing = f.hosts.map(host => observe(host.close()));
      await until(f, () => closing.every(p => p.settled));
      // The underlying fixture checks expected safe/unsafe close outcomes itself.
    }
  }));
}
