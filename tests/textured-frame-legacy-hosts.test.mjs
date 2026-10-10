import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { createCanvasHost } from '@egret/engine/web';
import { createWebGPUHost } from '@egret/engine/webgpu';
import { deferred, flush, host as makeHost } from './helpers.mjs';

const PROFILE = 'egret.textured-frame2d/1';
const OPTIONS = Object.freeze({ width: 8, height: 8 });
const HEADER_READS = Object.freeze(['frameId', 'width', 'height', 'clearColor', 'clearAlpha', 'commands']);

function exactCode(error, code, cause = undefined) {
  assert.ok(error instanceof egret.EgretError); assert.equal(error.code, code); assert.equal(error.cause, cause); return true;
}

function geometry(empty = false) {
  return egret.createTexturedGeometry2D({
    positions: new Float64Array(empty ? [] : [0, 0, 2, 0, 0, 2]),
    uvs: new Float64Array(empty ? [] : [0, 0, 1, 0, 0, 1]),
    lightColors: new Float64Array(empty ? [] : [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    indices: new Uint16Array(empty ? [] : [0, 1, 2]),
  });
}

async function ownedFrames() {
  // Capture only genuine public values. Frame identity survives Engine/resource retirement.
  const engine = await egret.createEngine({ host: makeHost({ renderFrame() { throw new Error('Capture fixture must not submit'); } }).adapter });
  let lease;
  try {
    assert.equal(typeof engine.captureTexturedFrame, 'function');
    const clear = engine.captureTexturedFrame(OPTIONS);
    const rect = new egret.Sprite(); rect.graphics.beginFill(0x123456).drawRect(1, 1, 2, 2); engine.stage.addChild(rect);
    const rectangles = engine.captureTexturedFrame(OPTIONS), legacy = engine.captureFrame(OPTIONS);
    const image = egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([21, 34, 55, 255]) });
    const texture = egret.createTexture(image), type = egret.createAssetType('legacy-refusal-texture', egret.isTexture);
    engine.assets.register(type, { async load() { return texture; }, dispose(value) { value.dispose(); } });
    lease = await engine.assets.acquire(egret.createAssetRef(type, 'legacy-refusal'));
    const bitmap = new egret.Bitmap(lease), mesh = new egret.Mesh2D(lease, geometry());
    engine.stage.addChild(bitmap); engine.stage.addChild(mesh);
    const mixed = engine.captureTexturedFrame(OPTIONS);
    rect.graphics.clear(); bitmap.textureLease = undefined; mesh.setContent(lease, geometry(true));
    const emptyMesh = engine.captureTexturedFrame(OPTIONS);
    assert.deepEqual([clear.commands.length, rectangles.commands.map(c => c.kind), mixed.commands.map(c => c.kind), emptyMesh.commands.map(c => c.kind)], [0, ['rect'], ['rect', 'image', 'mesh'], ['mesh']]);
    assert.equal(emptyMesh.geometries[0].triangleCount, 0);
    for (const frame of [clear, rectangles, mixed, emptyMesh]) {
      assert.equal(frame.profile, PROFILE); assert.ok(Object.isFrozen(frame)); assert.ok(Object.isFrozen(frame.commands));
      assert.ok(Object.isFrozen(frame.images)); assert.ok(Object.isFrozen(frame.geometries));
    }
    return Object.freeze({ clear, rectangles, mixed, emptyMesh, legacy });
  } finally { lease?.release(); await engine.dispose(); }
}

function canvasFixture() {
  const targetCalls = [], privateCalls = [], hooks = Object.create(null);
  const invoke = (name, ...args) => hooks[name]?.(...args);
  const context = {
    isContextLost() { targetCalls.push(['loss']); return invoke('loss') ?? false; },
    getContextAttributes() { targetCalls.push(['attributes']); return { colorSpace: 'srgb' }; },
  };
  for (const name of ['setTransform', 'save', 'restore', 'beginPath', 'rect', 'clip', 'clearRect', 'fillRect', 'drawImage']) {
    context[name] = (...args) => { targetCalls.push([name, ...args]); invoke(name, ...args); };
  }
  for (const name of ['globalAlpha', 'globalCompositeOperation', 'fillStyle', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'filter', 'imageSmoothingEnabled']) {
    let value;
    Object.defineProperty(context, name, { configurable: true, get() { return value; }, set(next) { value = next; targetCalls.push([name, next]); invoke(name, next); } });
  }
  const ownerDocument = { createElement(tag) {
    privateCalls.push(['createElement', tag]); assert.equal(tag, 'canvas');
    let width = 0, height = 0;
    const privateContext = {
      getContextAttributes() { privateCalls.push(['attributes']); return { colorSpace: 'srgb' }; },
      putImageData(...args) { privateCalls.push(['putImageData', ...args]); },
    };
    return {
      get width() { return width; }, set width(value) { width = value; privateCalls.push(['width', value]); },
      get height() { return height; }, set height(value) { height = value; privateCalls.push(['height', value]); },
      getContext(...args) { privateCalls.push(['context', ...args]); return privateContext; },
    };
  } };
  let width = 8, height = 8;
  const canvas = {
    get width() { targetCalls.push(['width.get']); return width; }, set width(value) { width = value; targetCalls.push(['width.set', value]); },
    get height() { targetCalls.push(['height.get']); return height; }, set height(value) { height = value; targetCalls.push(['height.set', value]); },
    get ownerDocument() { privateCalls.push(['ownerDocument']); return ownerDocument; },
    getContext(kind) { targetCalls.push(['context', kind]); assert.equal(kind, '2d'); return context; },
  };
  class ControlledImageData {
    constructor(data, imageWidth, imageHeight, settings) {
      privateCalls.push(['ImageData', data, imageWidth, imageHeight, settings]);
      this.data = data; this.width = imageWidth; this.height = imageHeight; this.colorSpace = 'srgb';
    }
  }
  function render(host, frame) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'ImageData');
    Object.defineProperty(globalThis, 'ImageData', { configurable: true, writable: true, value: ControlledImageData });
    try { return host.renderFrame(frame); }
    finally { if (previous !== undefined) Object.defineProperty(globalThis, 'ImageData', previous); else delete globalThis.ImageData; }
  }
  return { targetCalls, privateCalls, context, canvas, hooks, render, reset() { targetCalls.length = 0; privateCalls.length = 0; }, noCalls() { assert.deepEqual(targetCalls, []); assert.deepEqual(privateCalls, []); } };
}

function gpuFixture() {
  // This complete test-owned device controls only the native boundary, not pixels.
  const calls = [], buffers = [], textures = [], fences = [], lost = deferred(), listeners = new Map();
  let scopeDepth = 0;
  const queue = {
    writeBuffer(...args) { assert.equal(this, queue); calls.push(['writeBuffer', ...args]); },
    writeTexture(...args) { assert.equal(this, queue); calls.push(['writeTexture', ...args]); },
    submit(...args) { assert.equal(this, queue); calls.push(['submit', ...args]); },
    onSubmittedWorkDone() { assert.equal(this, queue); const fence = deferred(); fences.push(fence); calls.push(['fence']); return fence.promise; },
  };
  const device = {
    queue, lost: lost.promise,
    limits: { maxTextureDimension2D: 8192, maxBufferSize: 268435456, maxVertexBuffers: 1, maxVertexAttributes: 2, maxVertexBufferArrayStride: 24, maxColorAttachments: 1, maxColorAttachmentBytesPerSample: 4, maxBindGroups: 1, maxBindingsPerBindGroup: 3, maxSampledTexturesPerShaderStage: 1, maxSamplersPerShaderStage: 1, maxUniformBuffersPerShaderStage: 1, maxUniformBufferBindingSize: 16, maxBindGroupsPlusVertexBuffers: 2, maxInterStageShaderVariables: 1 },
    addEventListener(kind, listener) { assert.equal(this, device); listeners.set(kind, listener); calls.push(['addListener', kind]); },
    removeEventListener(kind, listener) { assert.equal(this, device); assert.equal(listeners.get(kind), listener); listeners.delete(kind); calls.push(['removeListener', kind]); },
    destroy() { calls.push(['deviceDestroy']); },
    pushErrorScope(kind) { assert.equal(this, device); scopeDepth++; calls.push(['pushScope', kind]); },
    popErrorScope() { assert.equal(this, device); assert.ok(scopeDepth > 0); scopeDepth--; calls.push(['popScope']); return Promise.resolve(null); },
    createShaderModule(descriptor) { assert.equal(this, device); calls.push(['shader', descriptor]); return {}; },
    createRenderPipelineAsync(descriptor) {
      assert.equal(this, device); calls.push(['pipeline', descriptor]);
      const pipeline = { getBindGroupLayout(index) { assert.equal(this, pipeline); calls.push(['layout', index]); return {}; } };
      return Promise.resolve(pipeline);
    },
    createSampler(descriptor) { assert.equal(this, device); calls.push(['sampler', descriptor]); return {}; },
    createBindGroup(descriptor) { assert.equal(this, device); calls.push(['bindGroup', descriptor]); return {}; },
    createTexture(descriptor) {
      assert.equal(this, device); const texture = { destroyed: 0, createView() { assert.equal(this, texture); calls.push(['imageView']); return {}; }, destroy() { assert.equal(this, texture); texture.destroyed++; calls.push(['destroyTexture']); } };
      textures.push(texture); calls.push(['createTexture', descriptor]); return texture;
    },
    createBuffer(descriptor) {
      assert.equal(this, device); const data = new ArrayBuffer(descriptor.size);
      const buffer = { data, destroyed: 0, destroy() { assert.equal(this, buffer); buffer.destroyed++; calls.push(['destroyBuffer']); }, unmap() { calls.push(['unmap']); }, mapAsync() { calls.push(['map']); return Promise.resolve(); }, getMappedRange() { calls.push(['mappedRange']); return data; } };
      buffers.push(buffer); calls.push(['createBuffer', descriptor]); return buffer;
    },
    createCommandEncoder() {
      assert.equal(this, device); calls.push(['encoder']);
      const encoder = {
        beginRenderPass(descriptor) {
          assert.equal(this, encoder); calls.push(['pass', descriptor]);
          const pass = {};
          for (const key of ['setPipeline', 'setViewport', 'setScissorRect', 'setVertexBuffer', 'setBindGroup', 'draw', 'end']) {
            pass[key] = function (...args) { assert.equal(this, pass); calls.push([key, ...args]); };
          }
          return pass;
        },
        copyTextureToBuffer(...args) { assert.equal(this, encoder); calls.push(['copyTextureToBuffer', ...args]); },
        finish() { assert.equal(this, encoder); calls.push(['finish']); return {}; },
      };
      return encoder;
    },
  };
  const context = {
    configure(descriptor) { assert.equal(this, context); calls.push(['configure', descriptor]); },
    unconfigure() { assert.equal(this, context); calls.push(['unconfigure']); },
    getCurrentTexture() { assert.equal(this, context); calls.push(['targetTexture']); return { createView() { calls.push(['targetView']); return {}; } }; },
  };
  let width = 8, height = 8;
  const canvas = {
    getContext(kind) { calls.push(['context', kind]); assert.equal(kind, 'webgpu'); return context; },
    get width() { calls.push(['width.get']); return width; }, set width(value) { width = value; calls.push(['width.set', value]); },
    get height() { calls.push(['height.get']); return height; }, set height(value) { height = value; calls.push(['height.set', value]); },
  };
  async function start(host) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: { getPreferredCanvasFormat() { calls.push(['preferredFormat']); return 'rgba8unorm'; } } } });
    try { await host.start(); assert.equal(scopeDepth, 0); }
    finally { if (previous !== undefined) Object.defineProperty(globalThis, 'navigator', previous); else delete globalThis.navigator; }
  }
  async function settle() { for (let round = 0; round < 6; round++) { for (const fence of fences) fence.resolve(); await flush(); } }
  async function close(host, unsafeCause) {
    const closing = host.close(); await settle();
    if (arguments.length === 2) await assert.rejects(closing, error => exactCode(error, 'WEBGPU_CLOSE_UNSAFE', unsafeCause));
    else await closing;
    assert.equal(calls.filter(call => call[0] === 'deviceDestroy').length, 0);
    assert.equal(listeners.size, 0); assert.equal(scopeDepth, 0);
  }
  return { calls, buffers, textures, fences, device, canvas, context, lost, start, settle, close, reset() { calls.length = 0; }, host() { return createWebGPUHost({ canvas, device: { kind: 'borrow', device } }); } };
}

test('H01 Canvas legacy port refuses authentic clear-only textured frame before target mutation', async () => {
  const frames = await ownedFrames(), f = canvasFixture(), host = createCanvasHost({ canvas: f.canvas });
  try {
    host.start(); f.reset();
    for (const frame of [frames.clear, frames.rectangles, frames.mixed, frames.emptyMesh]) {
      assert.throws(() => f.render(host, frame), error => exactCode(error, 'CANVAS_FRAME_PROFILE_UNSUPPORTED'));
      f.noCalls();
    }
    assert.equal(f.render(host, frames.legacy), undefined);
    assert.deepEqual(f.targetCalls.filter(call => call[0].endsWith('.set')), [['width.set', 8], ['height.set', 8]]);
    assert.equal(f.targetCalls.filter(call => call[0] === 'fillRect').length, 2);
    assert.deepEqual(f.privateCalls, []);
  } finally { await host.close(); }
});

test('H02 default WebGPU legacy port refuses authentic textured frames before queue serial or ledger mutation', async () => {
  const frames = await ownedFrames(), f = gpuFixture(), host = f.host();
  try {
    await f.start(host); f.reset();
    const baseline = host.getStatus();
    assert.equal(baseline.state, 'active'); assert.equal(baseline.lastSerial, 0); assert.equal(baseline.pendingFrames, 0);
    for (const frame of [frames.clear, frames.rectangles, frames.mixed, frames.emptyMesh]) {
      assert.throws(() => host.renderFrame(frame), error => exactCode(error, 'WEBGPU_FRAME_PROFILE_UNSUPPORTED'));
      assert.deepEqual(f.calls, []); assert.equal(f.buffers.length, 0); assert.equal(f.textures.length, 0); assert.equal(f.fences.length, 0);
      assert.deepEqual(host.getStatus(), baseline);
    }
    assert.equal(host.renderFrame(frames.legacy), undefined);
    assert.equal(host.getStatus().lastSerial, 1); assert.equal(host.getStatus().pendingFrames, 1);
    assert.equal(host.getStatus().pendingUploadBytes, 144); assert.equal(host.getStatus().pendingReadbackBytes, 0);
    assert.equal(f.buffers.length, 1); assert.equal(f.textures.length, 0); assert.equal(f.fences.length, 1);
    assert.equal(f.calls.filter(call => call[0] === 'writeBuffer').length, 1); assert.equal(f.calls.filter(call => call[0] === 'submit').length, 1);
    await f.settle(); await host.whenIdle(); assert.equal(host.getStatus().pendingFrames, 0); assert.equal(f.buffers[0].destroyed, 1);
  } finally { await f.close(host); }
});

test('H03 old host state and busy priorities precede new-frame refusal and input reads', async () => {
  const frames = await ownedFrames();
  const c = canvasFixture(), canvasHost = createCanvasHost({ canvas: c.canvas });
  try {
    c.reset(); assert.throws(() => c.render(canvasHost, frames.clear), error => exactCode(error, 'CANVAS_HOST_NOT_STARTED')); c.noCalls();
    canvasHost.start(); c.reset(); let nestedReads = 0;
    const nested = new Proxy(frames.clear, { get() { nestedReads++; throw new Error('Nested frame must remain unread'); } });
    const source = new Proxy(frames.legacy, { get(target, key, receiver) {
      if (key === 'width') {
        assert.throws(() => c.render(canvasHost, frames.clear), error => exactCode(error, 'CANVAS_FRAME_REENTRANT'));
        assert.throws(() => c.render(canvasHost, nested), error => exactCode(error, 'CANVAS_FRAME_REENTRANT'));
      }
      return Reflect.get(target, key, receiver);
    } });
    assert.equal(c.render(canvasHost, source), undefined); assert.equal(nestedReads, 0);
    c.reset(); let closing;
    const closes = new Proxy(frames.legacy, { get(target, key, receiver) {
      if (key === 'width') {
        closing = canvasHost.close();
        assert.throws(() => c.render(canvasHost, frames.clear), error => exactCode(error, 'CANVAS_HOST_CLOSED'));
        assert.throws(() => c.render(canvasHost, nested), error => exactCode(error, 'CANVAS_HOST_CLOSED'));
      }
      return Reflect.get(target, key, receiver);
    } });
    assert.throws(() => c.render(canvasHost, closes), error => exactCode(error, 'CANVAS_HOST_CLOSED'));
    c.noCalls(); assert.equal(nestedReads, 0); await closing;
    assert.throws(() => c.render(canvasHost, frames.clear), error => exactCode(error, 'CANVAS_HOST_CLOSED')); c.noCalls();
  } finally { await canvasHost.close(); }

  const g = gpuFixture(), gpuHost = g.host();
  try {
    assert.throws(() => gpuHost.renderFrame(frames.clear), error => exactCode(error, 'WEBGPU_NOT_STARTED')); assert.deepEqual(g.calls, []);
    await g.start(gpuHost); g.reset(); let nestedReads = 0;
    const nested = new Proxy(frames.clear, { get() { nestedReads++; throw new Error('Nested frame must remain unread'); } });
    const source = new Proxy(frames.legacy, { get(target, key, receiver) {
      if (key === 'frameId') {
        assert.throws(() => gpuHost.renderFrame(frames.clear), error => exactCode(error, 'WEBGPU_REENTRANT'));
        assert.throws(() => gpuHost.renderFrame(nested), error => exactCode(error, 'WEBGPU_REENTRANT'));
      }
      return Reflect.get(target, key, receiver);
    } });
    assert.equal(gpuHost.renderFrame(source), undefined); assert.equal(nestedReads, 0);
    await g.settle(); await gpuHost.whenIdle(); g.reset(); const baseline = gpuHost.getStatus();
    const stops = new Proxy(frames.legacy, { get(target, key, receiver) {
      if (key === 'frameId') {
        gpuHost.stop();
        // Existing legacy WebGPU checks busy before active, including after stop.
        assert.throws(() => gpuHost.renderFrame(frames.clear), error => exactCode(error, 'WEBGPU_REENTRANT'));
        assert.throws(() => gpuHost.renderFrame(nested), error => exactCode(error, 'WEBGPU_REENTRANT'));
      }
      return Reflect.get(target, key, receiver);
    } });
    assert.throws(() => gpuHost.renderFrame(stops), error => exactCode(error, 'WEBGPU_STOPPED'));
    assert.deepEqual(g.calls, []); assert.equal(nestedReads, 0); assert.equal(gpuHost.getStatus().lastSerial, baseline.lastSerial); assert.equal(gpuHost.getStatus().pendingFrames, 0);
    assert.throws(() => gpuHost.renderFrame(frames.clear), error => exactCode(error, 'WEBGPU_STOPPED'));
    const closing = gpuHost.close();
    assert.throws(() => gpuHost.renderFrame(frames.clear), error => exactCode(error, 'WEBGPU_CLOSED'));
    await g.settle(); await closing;
    assert.throws(() => gpuHost.renderFrame(frames.clear), error => exactCode(error, 'WEBGPU_CLOSED'));
  } finally { await g.close(gpuHost); }

  const failed = gpuFixture(), failedHost = failed.host(), cause = Object.freeze({ label: 'controlled device loss' });
  try {
    await failed.start(failedHost); failed.reset(); failed.lost.reject(cause); await flush();
    assert.equal(failedHost.getStatus().state, 'failed'); assert.equal(failedHost.getStatus().firstFailure.cause, cause);
    assert.throws(() => failedHost.renderFrame(frames.clear), error => exactCode(error, 'WEBGPU_FAILED', cause));
    assert.deepEqual(failed.calls, []);
  } finally { await failed.close(failedHost, cause); }
});

test('H04 proxies lookalikes and revoked inputs gain no identity and retain legacy reads', async () => {
  const frames = await ownedFrames();
  const c = canvasFixture(), canvasHost = createCanvasHost({ canvas: c.canvas });
  const g = gpuFixture(), gpuHost = g.host();
  try {
    canvasHost.start(); await g.start(gpuHost);
    for (const [kind, render, reset, noMutation, retire] of [
      ['Canvas', frame => c.render(canvasHost, frame), () => c.reset(), () => c.noCalls(), async () => {}],
      ['WebGPU', frame => gpuHost.renderFrame(frame), () => g.reset(), () => assert.deepEqual(g.calls, []), async () => { await g.settle(); await gpuHost.whenIdle(); }],
    ]) {
      for (const authentic of [frames.legacy, frames.clear]) {
        const reads = []; let ownReads = 0;
        const proxy = new Proxy(authentic, {
          get(target, key, receiver) {
            if (key === 'profile' || key === 'images' || key === 'geometries') throw new Error(`Legacy ${kind} read new metadata`);
            reads.push(key); return Reflect.get(target, key, receiver);
          },
          ownKeys() { ownReads++; throw new Error('Unexpected own-key trap'); },
          getOwnPropertyDescriptor() { ownReads++; throw new Error('Unexpected own-property trap'); },
        });
        // A Proxy is not the privately registered exact object. Its clear/rect
        // structural fields follow the old route; this is no new-host acceptance.
        reset(); assert.equal(render(proxy), undefined); assert.deepEqual(reads, HEADER_READS); assert.equal(ownReads, 0); await retire();
      }
      const plain = { frameId: 71, width: 8, height: 8, clearColor: 0, clearAlpha: 0, commands: [] };
      Object.defineProperty(plain, 'profile', { get() { throw new Error('Plain profile getter'); } });
      Object.defineProperty(plain, 'images', { get() { throw new Error('Plain images getter'); } });
      Object.defineProperty(plain, 'geometries', { get() { throw new Error('Plain geometries getter'); } });
      reset(); assert.equal(render(plain), undefined); await retire();
      const revoked = Proxy.revocable(frames.clear, {}); revoked.revoke(); reset();
      assert.throws(() => render(revoked.proxy), error => {
        assert.ok(error instanceof egret.EgretError); assert.equal(error.code, kind === 'Canvas' ? 'CANVAS_RENDER_FAILED' : 'WEBGPU_FRAME_INVALID');
        assert.ok(error.cause instanceof TypeError); return true;
      });
      noMutation();
      reset(); assert.equal(render(frames.legacy), undefined); await retire();
    }
  } finally { await canvasHost.close(); await g.close(gpuHost); }
});
