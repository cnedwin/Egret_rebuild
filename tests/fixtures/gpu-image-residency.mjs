// SPDX-License-Identifier: Apache-2.0
// Original first-party public-port controls, informed by the repository's image
// and textured Host tests. These controls model GPU ports, never the Host/cache.
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { createWebGPUHost, createTexturedWebGPUHost } from '@egret/engine/webgpu';
import { createMeshGeometry3D, createSceneFrame3D } from '@egret/engine/scene3d';
import { createSceneWebGPUHost, createTexturedSceneWebGPUHost } from '@egret/engine/webgpu/scene3d';

export { egret };
export const BUDGET = 33554432;
export const BIG = 4194304;
export const MATRIX = Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
export const tick = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
export const code = name => error => error instanceof egret.EgretError && error.code === 'WEBGPU_' + name;
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  promise.catch(() => {});
  return { promise, resolve, reject };
}
export function watched(promise) {
  const value = { settled: false, rejected: false };
  promise.then(() => { value.settled = true; }, () => { value.settled = true; value.rejected = true; });
  return value;
}
export function image(width = 1, height = 1, pixels = new Uint8Array(width * height * 4)) {
  return egret.createImageData2D({ width, height, pixels });
}
export function view(source = image(), crop = { x: 0, y: 0, width: source.width, height: source.height }) {
  return { source, crop };
}
// Ordinary RenderFrame2D is the public structural protocol; ImageData2D values
// are always genuine immutable SDK values. Textured frames use Engine capture.
export function frame(views = [view()], changes = {}) {
  const images = [...new Set(views.map(v => v.source))];
  return { frameId: 1, width: 8, height: 8, clearColor: 0, clearAlpha: 0,
    images, commands: views.map(v => ({ kind: 'image', matrix: MATRIX,
      rect: { x: 0, y: 0, width: 4, height: 4 }, alpha: 1, clips: [],
      imageIndex: images.indexOf(v.source), sourceRect: v.crop })), ...changes };
}
export function triangleScene(draws = 1) {
  const geometry = createMeshGeometry3D({ positions: [0, 0, -1, 1, 0, -1, 0, 1, -1],
    colors: [1, 0, 0, 0, 1, 0, 0, 0, 1], indices: [0, 1, 2] });
  return createSceneFrame3D({ projection: { kind: 'orthographic', left: -1, right: 1,
    bottom: -1, top: 1, near: 1, far: 3 }, draws: Array.from({ length: draws }, () => ({ geometry,
    modelView: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] })) });
}
export function createGpuFixture({ enforceBudget = true } = {}) {
  const savedNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const calls = [], textures = [], buffers = [], fences = [], scopes = [], maps = [], pipelines = [], trace = [];
  const hooks = {}, hosts = [], unsafeHosts = new WeakSet(), lost = deferred(), listeners = new Set(), oracleFailures = [];
  let open = 0, logicalBytes = 0, peakBytes = 0, width = 8, height = 8;
  // The Host is allowed to catch native callback errors. Oracle assertions must
  // also escape that catch domain, even when unsafe close is the expected result.
  const oracle = run => {
    try { return run(); }
    catch (error) { if (error instanceof assert.AssertionError) oracleFailures.push(error); throw error; }
  };
  const assertOracles = () => { if (oracleFailures.length) throw oracleFailures[0]; };
  const invoke = (name, ...args) => oracle(() => hooks[name]?.(...args));
  const log = (name, ...args) => { calls.push([name, ...args]); return invoke(name, ...args); };
  // Q is an external resource ledger: image descriptors returned by this port,
  // minus only destroy calls that returned normally. It contains no Host state.
  const mark = label => {
    trace.push({ label, bytes: logicalBytes }); peakBytes = Math.max(peakBytes, logicalBytes);
    if (enforceBudget) oracle(() => assert.ok(logicalBytes <= BUDGET, `logical image allocations exceed 32 MiB at ${label}: ${logicalBytes}`));
    return logicalBytes;
  };
  const queue = {
    writeTexture(destination, data, layout, size) { assert.equal(this, queue);
      log('writeTexture', destination, new Uint8Array(data.buffer ?? data, data.byteOffset ?? 0, data.byteLength).slice(), layout, size); },
    writeBuffer(buffer, offset, data) { assert.equal(this, queue);
      log('writeBuffer', buffer, offset, new Uint8Array(data.buffer ?? data, data.byteOffset ?? 0, data.byteLength).slice()); },
    submit(...args) { assert.equal(this, queue); log('submit', ...args); },
    onSubmittedWorkDone() { assert.equal(this, queue); const d = deferred(); fences.push(d); log('fence', d); return d.promise; },
  };
  const limits = { maxTextureDimension2D: 8192, maxBufferSize: 268435456,
    maxVertexBuffers: 1, maxVertexAttributes: 3, maxVertexBufferArrayStride: 32,
    maxColorAttachments: 1, maxColorAttachmentBytesPerSample: 4, maxBindGroups: 1,
    maxBindingsPerBindGroup: 3, maxSampledTexturesPerShaderStage: 1, maxSamplersPerShaderStage: 1,
    maxUniformBuffersPerShaderStage: 1, maxUniformBufferBindingSize: 64,
    maxBindGroupsPlusVertexBuffers: 2, maxInterStageShaderVariables: 2 };
  const sampler = {};
  const device = {
    queue, limits, lost: lost.promise,
    addEventListener(name, callback) { assert.equal(this, device); listeners.add(callback); log('add', name, callback); },
    removeEventListener(name, callback) { assert.equal(this, device); listeners.delete(callback); log('remove', name, callback); },
    destroy() { assert.equal(this, device); log('deviceDestroy'); },
    pushErrorScope(filter) { assert.equal(this, device); open++; log('push', filter); },
    popErrorScope() { assert.equal(this, device); open--; const d = deferred(); scopes.push(d); log('pop', d); return d.promise; },
    createShaderModule(descriptor) { assert.equal(this, device); log('shader', descriptor); return {}; },
    createRenderPipelineAsync(descriptor) {
      assert.equal(this, device); const stride = descriptor.vertex.buffers[0].arrayStride;
      const kind = descriptor.depthStencil ? 'scene' : stride === 16 ? 'image' : stride === 32 ? 'textured' : 'rect';
      const d = deferred(), layout = { kind }, value = { kind,
        getBindGroupLayout(index) { assert.equal(this, value); log('layout', kind, index); return layout; } };
      const p = { ...d, descriptor, value }; pipelines.push(p); log('pipeline', p); return p.promise;
    },
    createSampler(descriptor) { assert.equal(this, device); log('sampler', descriptor); return sampler; },
    createTexture(descriptor) {
      assert.equal(this, device); log('beforeTexture', descriptor);
      const isImage = descriptor.format === 'rgba8unorm' && descriptor.usage === 6;
      const texture = { descriptor, isImage, destroyed: 0, returned: 0, unknown: false,
        logicalBytes: isImage ? 4 * descriptor.size.width * descriptor.size.height : 0 };
      const destroy = function () {
        assert.equal(this, texture); texture.destroyed++; mark('destroy-start');
        try { log('destroyTexture', texture); }
        catch (error) { texture.unknown = true; mark('destroy-throw'); throw error; }
        texture.returned++; logicalBytes -= texture.logicalBytes; mark('destroy-return');
      };
      const createView = function () { assert.equal(this, texture); log('imageView', texture); return { texture }; };
      Object.defineProperties(texture, {
        destroy: { configurable: true, get() { log('destroyGetter', texture); return destroy; } },
        createView: { configurable: true, get() { log('viewGetter', texture); return createView; } },
      });
      textures.push(texture); logicalBytes += texture.logicalBytes; mark('create-return'); log('texture', texture); return texture;
    },
    createBindGroup(descriptor) { assert.equal(this, device); const binding = { descriptor }; log('binding', binding); return binding; },
    createBuffer(descriptor) {
      assert.equal(this, device); log('beforeBuffer', descriptor);
      const buffer = { descriptor, data: new ArrayBuffer(descriptor.size), destroyed: 0, unmapped: 0,
        destroy() { assert.equal(this, buffer); buffer.destroyed++; log('destroyBuffer', buffer); },
        unmap() { assert.equal(this, buffer); buffer.unmapped++; log('unmap', buffer); },
        mapAsync(mode) { assert.equal(this, buffer); const d = deferred(); maps.push(d); log('map', d, buffer, mode); return d.promise; },
        getMappedRange() { assert.equal(this, buffer); log('range', buffer); return buffer.data; } };
      buffers.push(buffer); log('buffer', buffer); return buffer;
    },
    createCommandEncoder() {
      assert.equal(this, device); log('encoder');
      const encoder = {
        beginRenderPass(descriptor) { assert.equal(this, encoder); log('pass', descriptor); const pass = {};
          for (const key of ['setPipeline', 'setViewport', 'setScissorRect', 'setVertexBuffer', 'setIndexBuffer',
            'setBindGroup', 'draw', 'drawIndexed', 'end']) pass[key] = function (...args) { assert.equal(this, pass); log(key, ...args); };
          log('passObject', pass); return pass; },
        copyTextureToBuffer(...args) { assert.equal(this, encoder); log('copy', ...args); },
        finish() { assert.equal(this, encoder); log('finish'); return {}; },
      }; return encoder;
    },
  };
  const context = {
    configure(descriptor) { assert.equal(this, context); log('configure', descriptor); },
    unconfigure() { assert.equal(this, context); log('unconfigure'); },
    getCurrentTexture() { assert.equal(this, context); log('target');
      const target = { createView() { assert.equal(this, target); log('targetView'); return {}; } }; return target; },
  };
  const canvas = { get width() { return width; }, set width(v) { width = v; log('width', v); },
    get height() { return height; }, set height(v) { height = v; log('height', v); },
    getContext(name) { assert.equal(this, canvas); log('context', name); return context; } };
  const provider = { getPreferredCanvasFormat() { assert.equal(this, provider); log('format'); return 'rgba8unorm'; } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: provider } });
  const options = extra => ({ canvas, device: { kind: 'borrow', device }, ...extra });
  const host = (extra = {}, kind = 'ordinary') => {
    const factory = { ordinary: createWebGPUHost, textured: createTexturedWebGPUHost,
      scene: createSceneWebGPUHost, combined: createTexturedSceneWebGPUHost }[kind];
    const value = factory(options(extra)); hosts.push(value); return value;
  };
  const settleScopes = (selected = scopes) => selected.forEach(d => d.resolve(null));
  const pump = async () => { for (let i = 0; i < 8; i++) {
    pipelines.forEach(p => p.resolve(p.value)); settleScopes(); fences.forEach(d => d.resolve()); maps.forEach(d => d.resolve()); await tick();
  } };
  const ready = async h => { const p = h.start(); p.catch(() => {}); await pump(); await p; };
  const close = async (h, unsafe = false, ...expectedCause) => {
    if (unsafe) unsafeHosts.add(h); const p = h.close(); p.catch(() => {}); await pump();
    assertOracles();
    if (unsafe) await assert.rejects(p, error => code('CLOSE_UNSAFE')(error)
      && (expectedCause.length === 0 || error.cause === expectedCause[0])); else await p;
  };
  const capture = run => {
    const s = scopes.length, q = fences.length, m = maps.length, t = textures.length, b = buffers.length;
    let value, error, threw = false;
    try { value = run(); } catch (cause) { error = cause; threw = true; }
    return { value, error, threw, scopes: scopes.slice(s), fences: fences.slice(q), maps: maps.slice(m),
      textures: textures.slice(t), buffers: buffers.slice(b),
      async finish() { settleScopes(this.scopes); this.fences.forEach(d => d.resolve()); this.maps.forEach(d => d.resolve()); await tick(); assertOracles(); } };
  };
  const emitError = cause => { for (const callback of listeners) callback({ error: cause, preventDefault() {} }); };
  const cleanup = async () => {
    // Remove one-shot fault/callback controls before draining intentionally held work.
    for (const name of Object.keys(hooks)) delete hooks[name];
    const outcomes = [];
    for (const h of hosts) {
      const p = h.close(); p.catch(() => {}); await pump();
      try { await p; } catch (error) { outcomes.push({ h, error }); }
    }
    assertOracles();
    for (const { h, error } of outcomes) assert.ok(unsafeHosts.has(h) && code('CLOSE_UNSAFE')(error), 'unexpected close failure');
    assert.equal(open, 0); assert.equal(calls.filter(c => c[0] === 'deviceDestroy').length, 0);
  };
  const restore = () => { if (savedNavigator) Object.defineProperty(globalThis, 'navigator', savedNavigator); else delete globalThis.navigator; };
  return { calls, textures, buffers, fences, scopes, maps, pipelines, trace, hooks, hosts, lost,
    queue, device, limits, sampler, context, canvas, options, host, ready, close, pump, capture,
    settleScopes, emitError, cleanup, restore, mark, assertOracles, allowUnsafe: h => unsafeHosts.add(h),
    get open() { return open; }, get logicalBytes() { return logicalBytes; }, get peakBytes() { return peakBytes; } };
}
export async function withGpu(run, options) {
  const f = createGpuFixture(options);
  try { return await run(f); } finally { try { await f.cleanup(); } finally { f.restore(); } }
}
export const imagesOf = f => f.textures.filter(t => t.isImage);
export const writesOf = f => f.calls.filter(c => c[0] === 'writeTexture');
export const bindingsOf = f => f.calls.filter(c => c[0] === 'binding').map(c => c[1].descriptor.entries[0].resource.texture);
export function admitted(record) { if (record.threw) throw record.error; assert.equal(record.value, undefined); }
export async function submitSafe(f, h, input, render = value => h.renderFrame(value)) {
  const record = f.capture(() => render(input)); admitted(record); await record.finish(); await h.whenIdle(); return record;
}
export function snapshot(f, h) {
  return { calls: f.calls.length, textures: f.textures.length, buffers: f.buffers.length,
    width: f.canvas.width, height: f.canvas.height, status: h.getStatus(),
    textured: h.getTexturedStatus?.(), scene: h.getSceneStatus?.(), logicalBytes: f.logicalBytes };
}
export function refused(f, h, run, expected) {
  const before = snapshot(f, h); assert.throws(run, code(expected));
  assert.deepEqual(snapshot(f, h), before, 'preflight refusal has no native, serial, ledger or surface effects');
}
// A public behavioral LRU oracle: the refusal names the first resident, and
// pressure follows before replay can legitimately touch it. No cache internals
// or expected-algorithm implementation are involved; victim identities are fixed.
export async function refusalLruWitness(f, h, initial, rejections, render = value => h.renderFrame(value), beforeRejections = () => {}) {
  const first = await submitSafe(f, h, initial, render), oldest = first.textures.filter(t => t.isImage);
  assert.equal(oldest.length, 1);
  const atlas = image(16, 16), tail = [], tailViews = Array.from({ length: 255 }, (_, i) =>
    view(atlas, { x: i % 16, y: Math.floor(i / 16), width: 1, height: 1 }));
  for (const item of tailViews) {
    const record = await submitSafe(f, h, frame([item]));
    const created = record.textures.filter(t => t.isImage); assert.equal(created.length, 1); tail.push(created[0]);
  }
  assert.ok([...oldest, ...tail].every(t => t.destroyed === 0), '256 genuine resident resources precede the rejected frame');
  beforeRejections();
  for (const { run, expected } of rejections) refused(f, h, run, expected);
  const start = f.calls.length, pressure = f.capture(() => h.renderFrame(frame())); admitted(pressure);
  assert.deepEqual(f.calls.slice(start).filter(c => c[0] === 'destroyTexture' && c[1].isImage).map(c => c[1]), oldest,
    'refusal must preserve original LRU victim order before any replay touches the older resource');
  assert.equal(oldest[0].destroyed, 1); assert.ok(tail.every(t => t.destroyed === 0));
  await pressure.finish();
  const replay = f.capture(() => h.renderFrame(frame([tailViews[0]]))); admitted(replay);
  assert.equal(replay.textures.filter(t => t.isImage).length, 0); assert.equal(bindingsOf(f).at(-1), tail[0]); await replay.finish();
  assert.equal(h.getStatus().state, 'active');
}
let sequence = 0;
export async function authorFrame() {
  const engine = await egret.createEngine({ host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } } });
  const scope = engine.createScope(), source = image(2, 1, new Uint8Array([255, 64, 0, 255, 0, 128, 255, 128]));
  const texture = egret.createTexture(source, { x: 0, y: 0, width: 1, height: 1 }), name = 'gpu-residency-' + (++sequence);
  const type = egret.createAssetType(name, egret.isTexture), ref = egret.createAssetRef(type, name);
  engine.assets.register(type, { load: async () => texture, dispose: value => value.dispose() });
  const lease = await engine.assets.acquire(ref), bitmap = scope.use(new egret.Bitmap(lease));
  bitmap.sourceRect = { x: 0, y: 0, width: 1, height: 1 }; engine.stage.addChild(bitmap);
  const geometry = light => egret.createTexturedGeometry2D({ positions: new Float64Array([1, 1, 5, 1, 1, 5]),
    uvs: new Float64Array([.25, .5, .25, .5, .25, .5]), lightColors: new Float64Array(12).fill(light), indices: new Uint32Array([0, 1, 2]) });
  const mesh = scope.use(new egret.Mesh2D(lease, geometry(1)));
  const capture = () => engine.captureFrame({ width: 8, height: 8, clearAlpha: 1 });
  const textured = () => engine.captureTexturedFrame({ width: 8, height: 8, clearAlpha: 1 });
  const close = async () => { scope.dispose(); lease.release(); await engine.dispose(); texture.dispose(); };
  return { engine, scope, source, texture, lease, ref, bitmap, mesh, geometry, capture, textured, close };
}
export async function withAuthored(run) { const a = await authorFrame(); try { return await run(a); } finally { await a.close(); } }

// Finite literal inputs for the R3 256/255-ready traces. Sources are genuinely
// independent; every group uses at most three large sources plus the small atlas.
export function pressureInputs(smallCount = 248) {
  const large = Array.from({ length: 7 }, () => view(image(1024, 1024)));
  const atlas = image(16, 16), small = Array.from({ length: 256 }, (_, i) => view(atlas,
    { x: i % 16, y: Math.floor(i / 16), width: 1, height: 1 }));
  const prepared = [...large, ...small.slice(0, smallCount)];
  const readers = smallCount === 248
    ? [[...large.slice(1, 4), ...small.slice(0, 124)], [...large.slice(4, 7), ...small.slice(124, 248)]]
    : [[...large.slice(1, 4), ...small.slice(0, 125)], [...large.slice(4, 7), ...small.slice(125, 249)]];
  return { large, small, prepared, readers, filler: small[smallCount], cold: small[smallCount + 1], next: view(image(1024, 1024)) };
}
export async function prepareReady(f, h, inputs) {
  for (const item of inputs.prepared) await submitSafe(f, h, frame([item]));
  const actual = imagesOf(f); assert.equal(actual.length, inputs.prepared.length);
  assert.ok(actual.every(t => t.destroyed === 0), 'genuine READY prerequisite: safe originals remain resident');
  return actual;
}
// Original image retirement is exercised only by the private finite baseline.
// The permanent suite calls this with buffer; READY images have longer lifetime.
export async function retirementBaseline(kind) {
  return withAuthored(a => withGpu(async f => {
    const h = f.host({ maxPendingFrames: 4 }); await f.ready(h);
    const saved = a.capture(), nested = frame([view(image(1, 1, new Uint8Array([1, 2, 3, 255])))]);
    let triggered = 0, pending, upload, inner;
    f.hooks[kind === 'image' ? 'destroyTexture' : 'destroyBuffer'] = resource => {
      if (triggered || (kind === 'image' && !resource.isImage)) return;
      triggered++; pending = h.getStatus().pendingFrames; upload = h.getStatus().pendingUploadBytes;
      inner = f.capture(() => h.renderFrame(nested)); admitted(inner);
      assert.equal(h.getStatus().lastSerial, 2); assert.equal(h.getStatus().pendingFrames, 2);
    };
    const outer = f.capture(() => h.renderFrame(saved)); admitted(outer);
    await outer.finish(); assert.equal(triggered, 1, 'retirement hook must actually run');
    assert.equal(pending, 1); assert.equal(upload, 112); assert.equal(h.getStatus().pendingFrames, 1);
    assert.ok(outer.buffers.every(b => b.destroyed === 1)); if (kind === 'image') assert.equal(outer.textures[0].destroyed, 1);
    await inner.finish(); await h.whenIdle(); await f.close(h);
    console.log(JSON.stringify({ baseline: kind, triggered, outerPending: pending, outerUpload: upload,
      finalSerial: h.getStatus().lastSerial, borrowedDestroyed: 0 }));
  }));
}

// Collection-only P1 witness for a future independently reviewed full-copy
// mutation. Healthy synchronous eviction and the assigned retirement callback
// are recorded separately; no healthy phase assertion can hide the latter.
// The ordinary GREEN tests always keep the enforcing external Q ledger.
export async function collectP1Witness() {
  return withGpu(async f => {
    const h = f.host({ maxPendingFrames: 4 }); await f.ready(h); f.allowUnsafe(h);
    const p = pressureInputs(249), ready = await prepareReady(f, h, p);
    const a = f.capture(() => h.renderFrame(frame(p.readers[0]))), b = f.capture(() => h.renderFrame(frame(p.readers[1]))); admitted(a); admitted(b);
    const events = []; let phase = 'submit', nested;
    f.hooks.destroyTexture = t => {
      if (t !== ready[0]) return;
      const before = { phase, q: f.mark('witness-nested-before'), serial: h.getStatus().lastSerial, pending: h.getStatus().pendingFrames };
      nested = f.capture(() => h.renderFrame(frame([p.next])));
      events.push({ ...before, afterQ: f.mark('witness-nested-after'), afterSerial: h.getStatus().lastSerial,
        returnedUndefined: !nested.threw && nested.value === undefined, errorCode: nested.error?.code ?? null,
        imageCreates: nested.textures.filter(t => t.isImage).length });
    };
    const cold = f.capture(() => h.renderFrame(frame([p.filler]))); phase = 'retirement';
    await cold.finish(); if (nested) await nested.finish(); await a.finish(); await b.finish();
    const result = { readyCount: ready.length, readyPrerequisite: true, events, coldThrew: cold.threw,
      coldErrorCode: cold.error?.code ?? null, peakQ: f.peakBytes, trace: undefined, finalSerial: h.getStatus().lastSerial };
    delete f.hooks.destroyTexture;
    const closing = h.close(); closing.catch(() => {}); await f.pump();
    try { await closing; result.close = 'safe'; } catch (error) { result.close = error.code; }
    // Include terminal READY cleanup events after the close outcome is observed.
    result.trace = [...f.trace];
    return result;
  }, { enforceBudget: false });
}
