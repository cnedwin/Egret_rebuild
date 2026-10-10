import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import * as gpu from '@egret/engine/webgpu';

// First-party Apache-2.0 candidate. Boundary-control ideas derive from the
// repository tests/webgpu-host.test.mjs and webgpu-image-host.test.mjs; exact
// original identities and selected lines are recorded in HANDOFF/input manifest.
// This helper imports neither those registering test modules nor product helpers.
export const PROFILE = 'egret.textured-frame2d/1';
export const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  promise.catch(() => {});
  return { promise, resolve, reject };
}
export const code = name => error => error instanceof egret.EgretError && error.code === 'WEBGPU_' + name;
export const exactCause = (name, cause) => error => code(name)(error) && error.cause === cause;
export function factory(options) {
  assert.equal(typeof gpu.createTexturedWebGPUHost, 'function', 'missing createTexturedWebGPUHost');
  return gpu.createTexturedWebGPUHost(options);
}
export function observe(promise) { promise.catch(() => {}); return promise; }
export function watched(promise) {
  const value = { settled: false, rejected: false };
  promise.then(() => { value.settled = true; }, () => { value.settled = true; value.rejected = true; });
  return value;
}

// Controls actual browser/device boundaries only. Independently settled scope,
// queue and map promises never inspect the host's ledger or private state.
export function controlledGPU() {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const calls = [], buffers = [], textures = [], pipelines = [], scopes = [], fences = [], maps = [], hosts = [];
  const hooks = {}, lost = deferred(), adapterResult = deferred(), deviceResult = deferred();
  const unsafeHosts = new WeakSet();
  let open = 0, width = 8, height = 8;
  const invoke = (name, ...args) => hooks[name]?.(...args);
  const log = (name, ...args) => { calls.push([name, ...args]); return invoke(name, ...args); };
  const queue = {
    writeTexture(...args) { assert.equal(this, queue); log('writeTexture', args[0], new Uint8Array(args[1]).slice(), args[2], args[3]); },
    writeBuffer(buffer, offset, data) { assert.equal(this, queue); log('writeBuffer', buffer, offset, new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice()); },
    submit(...args) { assert.equal(this, queue); log('submit', ...args); },
    onSubmittedWorkDone() { assert.equal(this, queue); const d = deferred(); fences.push(d); log('fence', d); return d.promise; },
  };
  const limits = {
    maxTextureDimension2D: 8192, maxBufferSize: 268435456, maxVertexBuffers: 1,
    maxVertexAttributes: 3, maxVertexBufferArrayStride: 32, maxColorAttachments: 1,
    maxColorAttachmentBytesPerSample: 4, maxBindGroups: 1, maxBindingsPerBindGroup: 3,
    maxSampledTexturesPerShaderStage: 1, maxSamplersPerShaderStage: 1,
    maxUniformBuffersPerShaderStage: 1, maxUniformBufferBindingSize: 16,
    maxBindGroupsPlusVertexBuffers: 2, maxInterStageShaderVariables: 2,
  };
  const sampler = {};
  const device = {
    queue, limits, lost: lost.promise,
    addEventListener(...args) { assert.equal(this, device); log('add', ...args); },
    removeEventListener(...args) { assert.equal(this, device); log('remove', ...args); },
    destroy() { assert.equal(this, device); log('deviceDestroy'); },
    pushErrorScope(filter) { assert.equal(this, device); open++; log('push', filter); },
    popErrorScope() { assert.equal(this, device); open--; const d = deferred(); scopes.push(d); log('pop', d); return d.promise; },
    createShaderModule(descriptor) { assert.equal(this, device); log('shader', descriptor); return { descriptor }; },
    createRenderPipelineAsync(descriptor) {
      assert.equal(this, device);
      const stride = descriptor.vertex.buffers[0].arrayStride;
      const kind = stride === 24 ? 'rect' : stride === 16 ? 'image' : stride === 32 ? 'textured' : 'unexpected';
      const d = deferred(), layout = { kind };
      const value = { kind, getBindGroupLayout(index) { assert.equal(this, value); log('layout', kind, index); return layout; } };
      const record = { ...d, kind, descriptor, value, layout };
      pipelines.push(record); log('pipeline', record); return record.promise;
    },
    createSampler(descriptor) { assert.equal(this, device); log('sampler', descriptor); return sampler; },
    createTexture(descriptor) {
      assert.equal(this, device);
      const texture = { descriptor, destroyed: 0,
        destroy() { assert.equal(this, texture); texture.destroyed++; log('destroyTexture', texture); },
        createView() { assert.equal(this, texture); log('imageView', texture); return { texture }; },
      };
      textures.push(texture); log('texture', texture); return texture;
    },
    createBindGroup(descriptor) { assert.equal(this, device); const binding = { descriptor }; log('binding', binding); return binding; },
    createBuffer(descriptor) {
      assert.equal(this, device);
      const buffer = { descriptor, data: new ArrayBuffer(descriptor.size), destroyed: 0, unmapped: 0,
        destroy() { assert.equal(this, buffer); buffer.destroyed++; log('destroyBuffer', buffer); },
        unmap() { assert.equal(this, buffer); buffer.unmapped++; log('unmap', buffer); },
        mapAsync(mode) { assert.equal(this, buffer); const d = deferred(); maps.push(d); log('map', d, buffer, mode); return d.promise; },
        getMappedRange() { assert.equal(this, buffer); log('range', buffer); return buffer.data; },
      };
      buffers.push(buffer); log('buffer', buffer); return buffer;
    },
    createCommandEncoder() {
      assert.equal(this, device); log('encoder');
      const encoder = {
        beginRenderPass(descriptor) {
          assert.equal(this, encoder); log('pass', descriptor);
          const pass = {};
          for (const key of ['setPipeline', 'setViewport', 'setScissorRect', 'setVertexBuffer', 'setBindGroup', 'draw', 'end']) {
            pass[key] = function (...args) { assert.equal(this, pass); log(key, ...args); };
          }
          invoke('passObject', pass); return pass;
        },
        copyTextureToBuffer(...args) { assert.equal(this, encoder); log('copy', ...args); },
        finish() { assert.equal(this, encoder); log('finish'); return {}; },
      };
      return encoder;
    },
  };
  const context = {
    configure(descriptor) { assert.equal(this, context); log('configure', descriptor); },
    unconfigure() { assert.equal(this, context); log('unconfigure'); },
    getCurrentTexture() {
      assert.equal(this, context); log('target');
      const target = { createView() { assert.equal(this, target); log('targetView'); return {}; } };
      return target;
    },
  };
  const canvas = {
    get width() { return width; }, set width(value) { width = value; log('width', value); },
    get height() { return height; }, set height(value) { height = value; log('height', value); },
    getContext(name) { assert.equal(this, canvas); log('context', name); return context; },
  };
  const adapter = { requestDevice() { assert.equal(this, adapter); log('requestDevice'); return deviceResult.promise; } };
  const provider = {
    getPreferredCanvasFormat() { assert.equal(this, provider); log('format'); return 'rgba8unorm'; },
    requestAdapter() { assert.equal(this, provider); log('requestAdapter'); return adapterResult.promise; },
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: provider } });
  const options = extra => ({ canvas, device: { kind: 'borrow', device }, ...extra });
  const keep = host => { hosts.push(host); return host; };
  const settleScopes = selected => (selected ?? scopes).forEach(d => d.resolve(null));
  const resolvePipelines = () => pipelines.forEach(d => d.resolve(d.value));
  const pump = async () => {
    for (let i = 0; i < 8; i++) {
      adapterResult.resolve(adapter); deviceResult.resolve(device); resolvePipelines(); settleScopes();
      fences.forEach(d => d.resolve()); maps.forEach(d => d.resolve()); await tick();
    }
  };
  const ready = async host => { const p = observe(host.start()); await pump(); await p; };
  const close = async (host, unsafe = false) => {
    if (unsafe) unsafeHosts.add(host);
    const p = observe(host.close()); await pump();
    if (unsafe) await assert.rejects(p, code('CLOSE_UNSAFE')); else await p;
    return undefined;
  };
  const proof = run => {
    const s = scopes.length, q = fences.length, m = maps.length;
    let thrown = false, cause, value;
    try { value = run(); } catch (error) { thrown = true; cause = error; }
    const result = { scopes: scopes.slice(s), fences: fences.slice(q), maps: maps.slice(m), thrown, cause, value };
    result.settleScopes = () => settleScopes(result.scopes);
    result.resolveFences = () => result.fences.forEach(d => d.resolve());
    result.resolveMaps = () => result.maps.forEach(d => d.resolve());
    result.finish = async () => { result.settleScopes(); result.resolveFences(); result.resolveMaps(); await tick(); };
    return result;
  };
  const cleanup = async () => {
    const outcomes = hosts.map(host => observe(host.close()).then(() => ({ host }), cause => ({ host, cause })));
    await pump();
    for (const result of await Promise.all(outcomes)) {
      if (Object.hasOwn(result, 'cause')) assert.ok(unsafeHosts.has(result.host) && code('CLOSE_UNSAFE')(result.cause), 'unexpected fixture cleanup failure');
    }
    assert.equal(open, 0, 'balanced external scopes');
  };
  const restore = () => {
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else delete globalThis.navigator;
  };
  return { calls, buffers, textures, pipelines, scopes, fences, maps, hosts, hooks, lost, adapterResult, deviceResult,
    queue, device, limits, sampler, provider, adapter, context, canvas, options, keep, settleScopes, resolvePipelines,
    pump, ready, close, proof, cleanup, restore, allowUnsafe: host => unsafeHosts.add(host), get open() { return open; } };
}
export async function withGPU(run) {
  const f = controlledGPU();
  try { return await run(f); } finally { try { await f.cleanup(); } finally { f.restore(); } }
}
export function noMutation(f) {
  assert.deepEqual(f.calls, [], 'unadmitted frame performs no controlled GPU/target calls');
  assert.equal(f.buffers.length, 0); assert.equal(f.textures.length, 0);
}
export function status(host, { serial, frames, geometry, upload, readback = 0 }) {
  const base = host.getStatus(), extra = host.getTexturedStatus();
  assert.equal(Object.isFrozen(base), true); assert.equal(Object.isFrozen(extra), true); assert.equal(Object.isFrozen(extra.host), true);
  assert.deepEqual(Object.keys(extra), ['host', 'pendingGeometryBytes']); assert.deepEqual(extra.host, base);
  assert.equal(Object.hasOwn(base, 'pendingGeometryBytes'), false);
  assert.equal(base.lastSerial, serial); assert.equal(base.pendingFrames, frames);
  assert.equal(base.pendingUploadBytes, upload); assert.equal(base.pendingReadbackBytes, readback);
  assert.equal(extra.pendingGeometryBytes, geometry);
}
let sequence = 0;
// Genuine public capture only: accepted Engine, AssetManager registration and
// acquisition, caller lease, immutable Texture and canonical public geometry.
// The plain headless host is the documented injected boundary, with no textured
// advertisement, registrar, capture helper or private frame authority.
export async function authorFrames() {
  const adapter = { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } };
  const engine = await egret.createEngine({ host: adapter });
  assert.equal(engine instanceof egret.Engine, true); assert.equal(engine.assets instanceof egret.AssetManager, true);
  const legacy = engine.captureFrame({ width: 8, height: 8 });
  const nodes = [], resources = [];
  const image = egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([255, 64, 0, 255]) });
  const texture = egret.createTexture(image), name = 'textured-host-' + (++sequence);
  const type = egret.createAssetType(name, egret.isTexture), ref = egret.createAssetRef(type, name);
  engine.assets.register(type, { load: async () => texture, dispose: value => value.dispose() });
  const lease = await engine.assets.acquire(ref); resources.push({ texture, lease, ref });
  assert.equal(lease instanceof egret.AssetLease, true); assert.equal(lease.value, texture);
  const geometry = (positions = [1, 1, 5, 1, 1, 5], indices = [0, 1, 2]) => egret.createTexturedGeometry2D({
    positions: new Float64Array(positions), uvs: new Float64Array(positions.length).fill(.5),
    lightColors: new Float64Array(positions.length * 2).fill(1), indices: new Uint32Array(indices),
  });
  const addMesh = (value, alpha = 1) => { const node = new egret.Mesh2D(lease, value); node.alpha = alpha; nodes.push(node); engine.stage.addChild(node); return node; };
  const clear = () => { for (const node of nodes.splice(0)) node.dispose(); };
  const capture = (options = { width: 8, height: 8 }) => engine.captureTexturedFrame(options);
  const canonical = geometry(); addMesh(canonical); const triangle = capture();
  assert.equal(canonical.logicalByteLength, 204); assert.equal(triangle.geometries.length, 1);
  assert.equal(triangle.geometries[0].logicalByteLength, 204); assert.equal(triangle.commands[0].kind, 'mesh');
  assert.equal(Object.isFrozen(triangle), true); assert.equal(Object.isFrozen(triangle.geometries[0].positions), true);
  clear(); addMesh(canonical); addMesh(canonical); const repeated = capture();
  clear(); const two = geometry([1, 1, 5, 1, 1, 5], [0, 1, 2, 0, 1, 2]); addMesh(two); const twoTriangles = capture();
  clear(); addMesh(geometry([2 ** 20 + 1, 1, 2 ** 20 + 5, 1, 2 ** 20 + 1, 5])); const range = capture();
  // Frozen G04: authored A=+2^-70, represented translation T=-2^-66 before clipping.
  clear(); const h = 2 ** -34;
  const precisionMesh = addMesh(geometry([0, 0, h, h, 3 * h, 13 * h / 4]));
  precisionMesh.x = 2 ** 19; precisionMesh.y = 0;
  const rankPrecision = capture({ width: 8, height: 8 });
  clear(); addMesh(canonical); const small = capture({ width: 4, height: 4 });
  clear(); addMesh(geometry([1, 1, 1 + 2 ** -30, 1, 1, 1 + 2 ** -30])); const collapsed = capture();
  clear(); const outside = addMesh(canonical); outside.x = 20; const invisible = capture(); clear();
  const addRect = () => { const node = new egret.Sprite(); node.graphics.beginFill(0x112233).drawRect(1, 1, 2, 2); nodes.push(node); engine.stage.addChild(node); return node; };
  addRect();
  const emptyBarrier = addMesh(canonical); emptyBarrier.x = 20;
  addRect(); addMesh(canonical); const bitmap = new egret.Bitmap(lease); nodes.push(bitmap); engine.stage.addChild(bitmap);
  addMesh(canonical); const ordered = capture();
  const close = async () => { clear(); lease.release(); await engine.dispose(); texture.dispose(); };
  return { engine, adapter, texture, image, lease, ref, geometry, canonical, triangle, repeated, twoTriangles, collapsed, invisible,
    ordered, legacy, range, rankPrecision, small, clear, capture, addMesh, addRect, resources, close };
}
export async function withFrames(run) { const a = await authorFrames(); try { return await run(a); } finally { await a.close(); } }
