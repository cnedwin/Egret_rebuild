// SPDX-License-Identifier: Apache-2.0
// Controls of the GPU ports a WebGPU Host calls. They model the ports, never the Host or its caches.
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';

export { egret };
const BUDGET = 33554432;
export const tick = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
export const code = name => error => error instanceof egret.EgretError && error.code === 'WEBGPU_' + name;
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  promise.catch(() => {});
  return { promise, resolve, reject };
}
export function image(width = 1, height = 1, pixels = new Uint8Array(width * height * 4)) {
  return egret.createImageData2D({ width, height, pixels });
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
    queue, device, limits, sampler, context, canvas, options, ready, close, pump, capture,
    settleScopes, emitError, cleanup, restore, mark, assertOracles, allowUnsafe: h => unsafeHosts.add(h),
    get open() { return open; }, get logicalBytes() { return logicalBytes; }, get peakBytes() { return peakBytes; } };
}
export function admitted(record) { if (record.threw) throw record.error; assert.equal(record.value, undefined); }
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
