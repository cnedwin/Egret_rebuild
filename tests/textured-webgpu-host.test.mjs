import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import * as gpu from '@egret/engine/webgpu';
import { PROFILE, tick, code, exactCause, factory, observe, watched, withGPU, withFrames, noMutation, status } from './textured-webgpu-host-fixtures.mjs';

// First-party Apache-2.0 public-host candidate; frozen static predictions only.
// Genuine captured frames grant authority. Controlled GPU calls prove CPU ABI,
// admission and ownership observations, never native shader/pixel correctness.
const TOP = Object.freeze(['canvas', 'device', 'onDiagnostic', 'pixelRatio', 'maxBackingPixels', 'maxCommands', 'maxClipRectangles', 'maxPreparedVertices', 'maxClipEdgeTests', 'maxUploadBytes', 'maxPendingUploadBytes', 'maxPendingFrames', 'maxReadbackBytes', 'enableReadback', 'maxSourceTriangles', 'maxFrameGeometryBytes', 'maxPendingGeometryBytes', 'maxTupleComparisons']);
const CAPS = Object.freeze({ maxBackingPixels: 16777216, maxCommands: 65536, maxClipRectangles: 262144, maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxUploadBytes: 33554432, maxPendingUploadBytes: 67108864, maxPendingFrames: 2, maxReadbackBytes: 67108864, maxSourceTriangles: 65536, maxFrameGeometryBytes: 16777216, maxPendingGeometryBytes: 33554432, maxTupleComparisons: 1048576 });
function readOptions(f, values = {}, throws = {}) {
  const log = [], input = {};
  const supplied = f.options(values);
  for (const key of TOP) Object.defineProperty(input, key, { get() {
    log.push(key); if (Object.hasOwn(throws, key)) throw throws[key]; return supplied[key];
  } });
  return { input, log };
}
const active = async (f, options = {}) => { const h = f.keep(factory(f.options(options))); await f.ready(h); return h; };
const admitted = proof => { if (proof.thrown) throw proof.cause; assert.equal(proof.value, undefined); };

test('H01 public textured WebGPU factory exists after legacy host baseline', async () => {
  await withFrames(a => withGPU(async f => {
    const old = f.keep(gpu.createWebGPUHost(f.options())); await f.ready(old);
    assert.equal(old.renderFrame(a.legacy), undefined); await f.pump(); await old.whenIdle();
    assert.equal(a.triangle.profile, PROFILE); assert.equal(a.triangle.geometries[0].logicalByteLength, 204);
    assert.equal(a.lease.value, a.texture); assert.equal(egret.isTexturedGeometry2D(a.canonical), true);
    assert.equal(f.pipelines.length, 2); assert.equal(old.getStatus().lastSerial, 1);
    // This is the one required missing-API assertion, after real setup/baseline.
    assert.equal(typeof gpu.createTexturedWebGPUHost, 'function', 'missing createTexturedWebGPUHost');
    assert.deepEqual(Object.keys(gpu).sort(), ['createSharedWebGPUHost', 'createTexturedWebGPUHost', 'createWebGPUHost']);
    assert.equal(Object.hasOwn(egret, 'createTexturedWebGPUHost'), false);
  }));
});

test('H02 snapshots exact eighteen top reads then borrow policy before semantics', async () => {
  await withGPU(async f => {
    const policyLog = [], policy = {};
    Object.defineProperties(policy, { kind: { get() { policyLog.push('kind'); return 'borrow'; } }, device: { get() { policyLog.push('device'); return f.device; } } });
    const o = readOptions(f, { device: policy }); const h = f.keep(factory(o.input));
    assert.deepEqual(o.log, TOP); assert.deepEqual(policyLog, ['kind', 'device']); assert.deepEqual(f.calls, []);
    await f.ready(h); assert.deepEqual(o.log, TOP); assert.deepEqual(policyLog, ['kind', 'device']);
  });
});
test('H02 late top and policy throws outrank earlier semantic faults and preserve arbitrary causes', async () => {
  await withGPU(async f => {
    for (const cause of [{ late: true }, undefined]) {
      const top = readOptions(f, { canvas: 0, pixelRatio: 'bad' }, { maxTupleComparisons: cause });
      assert.throws(() => factory(top.input), exactCause('OPTIONS_INVALID', cause)); assert.deepEqual(top.log, TOP);
      const log = [], policy = {};
      Object.defineProperties(policy, { kind: { get() { log.push('kind'); return 'borrow'; } }, device: { get() { log.push('device'); throw cause; } } });
      const nested = readOptions(f, { canvas: 0, device: policy, onDiagnostic: false });
      assert.throws(() => factory(nested.input), exactCause('OPTIONS_INVALID', cause)); assert.deepEqual(nested.log, TOP); assert.deepEqual(log, ['kind', 'device']);
      assert.deepEqual(f.calls, []);
    }
    let borrowRead = 0; const acquire = { kind: 'acquire', get device() { borrowRead++; throw Error('acquire device read'); } };
    const h = f.keep(factory(f.options({ device: acquire }))); assert.equal(borrowRead, 0); await f.ready(h);
  });
});
test('H02 semantic priority and nonobject policies use no enumeration or browser calls', async () => {
  await withGPU(async f => {
    const cases = [
      [{ canvas: 0, device: 0, onDiagnostic: 0, pixelRatio: 0 }, 'canvas'],
      [{ device: 0, onDiagnostic: 0, pixelRatio: 0 }, 'device'],
      [{ onDiagnostic: 0, pixelRatio: 0 }, 'callback'],
    ];
    for (const [values, meaning] of cases) {
      const o = readOptions(f, values); let result;
      try { factory(o.input); } catch (error) { result = error; }
      assert.ok(code('OPTIONS_INVALID')(result)); assert.equal(result.cause instanceof TypeError, true, meaning);
      // Messages are diagnostic text, not a newly imposed API spelling.
      assert.deepEqual(o.log, TOP); assert.deepEqual(f.calls, []);
    }
    let enumerations = 0, reads = 0;
    const policy = new Proxy({ kind: 'borrow', device: f.device }, {
      ownKeys() { enumerations++; throw Error('policy enumeration'); },
      get(target, key) { reads++; return Reflect.get(target, key); },
    });
    const h = f.keep(factory(f.options({ device: policy }))); assert.equal(enumerations, 0); assert.equal(reads, 2);
    await f.ready(h); assert.equal(reads, 2);
  });
});
test('H02 exact opted-in type/range caps, undefined defaults, pixel ratio and boolean rules', async () => {
  await withGPU(async f => {
    for (const [key, max] of Object.entries(CAPS)) {
      for (const value of [null, '1', {}, Infinity, 1.5]) assert.throws(() => factory(f.options({ [key]: value })), e => code('OPTIONS_INVALID')(e) && e.cause instanceof TypeError, key);
      for (const value of [0, -1, max + 1]) assert.throws(() => factory(f.options({ [key]: value })), e => code('OPTIONS_INVALID')(e) && e.cause instanceof RangeError, key);
      for (const value of [1, max, undefined]) f.keep(factory(f.options({ [key]: value })));
    }
    for (const value of [null, '1', Infinity, NaN]) assert.throws(() => factory(f.options({ pixelRatio: value })), e => code('OPTIONS_INVALID')(e) && e.cause instanceof TypeError);
    for (const value of [0, -1]) assert.throws(() => factory(f.options({ pixelRatio: value })), e => code('OPTIONS_INVALID')(e) && e.cause instanceof RangeError);
    f.keep(factory(f.options({ pixelRatio: .5, enableReadback: false }))); f.keep(factory(f.options({ pixelRatio: Number.MAX_VALUE, enableReadback: true })));
    for (const value of [0, 1, null, 'false']) assert.throws(() => factory(f.options({ enableReadback: value })), e => code('OPTIONS_INVALID')(e) && e.cause instanceof TypeError);
    assert.deepEqual(f.calls, []);
  });
});

test('H03 advertisement and ports are exact own descriptors with no default/prototype additions', async () => {
  await withGPU(async f => {
    const h = f.keep(factory(f.options())), old = f.keep(gpu.createWebGPUHost(f.options({ maxCommands: 65537, maxPendingFrames: 3, mode: 'textured', texturedFrameProfile: PROFILE })));
    const d = Object.getOwnPropertyDescriptor(h, 'texturedFrameProfile'); assert.equal(d.value, PROFILE); assert.equal(d.writable, false); assert.equal(d.configurable, false);
    for (const key of ['renderTexturedFrame', 'getTexturedStatus']) { const p = Object.getOwnPropertyDescriptor(h, key); assert.equal(typeof p.value, 'function'); assert.equal(p.writable, false); assert.equal(p.configurable, false); }
    for (const key of ['texturedFrameProfile', 'renderTexturedFrame', 'getTexturedStatus', 'renderSceneFrame', 'getSceneStatus']) {
      assert.equal(key in old, false); assert.equal(Object.hasOwn(Object.getPrototypeOf(old), key), false); assert.equal(Object.hasOwn(Object.getPrototypeOf(h), key), false);
    }
    await f.ready(old); assert.deepEqual(f.pipelines.map(p => p.kind), ['rect', 'image']);
    const oldReads = [], policy = { get kind() { oldReads.push('policy.kind'); return 'borrow'; }, get device() { oldReads.push('policy.device'); return f.device; } };
    const input = {}; for (const key of TOP.slice(0, 14)) Object.defineProperty(input, key, { get() { oldReads.push(key); return key === 'canvas' ? f.canvas : key === 'device' ? policy : undefined; } });
    f.keep(gpu.createWebGPUHost(input)); assert.deepEqual(oldReads, [...TOP.slice(0, 3), 'policy.kind', 'policy.device', ...TOP.slice(3, 14)]);
  });
});
test('H03 captured options, callback, pipeline, queue and pass receivers survive later replacements', async () => {
  await withFrames(a => withGPU(async f => {
    const diagnostics = [], options = f.options({ onDiagnostic: d => diagnostics.push(d) });
    const h = f.keep(factory(options)); await f.ready(h);
    options.onDiagnostic = () => { throw Error('replaced options callback'); }; options.maxUploadBytes = 1;
    for (const key of ['writeBuffer', 'writeTexture', 'submit', 'onSubmittedWorkDone']) f.queue[key] = () => { throw Error('replaced queue method'); };
    for (const key of ['createBuffer', 'createTexture', 'createBindGroup', 'createCommandEncoder']) f.device[key] = () => { throw Error('replaced device method'); };
    for (const p of f.pipelines) p.value.getBindGroupLayout = () => { throw Error('replaced layout'); };
    f.hooks.setPipeline = () => { f.hooks.setPipeline = undefined; f.hooks.passObject = undefined; };
    f.hooks.passObject = pass => {
      const first = pass.setPipeline;
      pass.setPipeline = function (...args) { first.apply(this, args); for (const key of ['setViewport', 'setScissorRect', 'setVertexBuffer', 'setBindGroup', 'draw', 'end']) pass[key] = () => { throw Error('replaced pass method'); }; };
    };
    h.renderTexturedFrame(a.triangle); await f.pump(); assert.equal(h.getStatus().lastSerial, 1);
    const fault = {}; f.hooks.encoder = () => { throw fault; };
    assert.throws(() => h.renderTexturedFrame(a.triangle), exactCause('RENDER_FAILED', fault)); await tick();
    assert.equal(diagnostics.length, 1); assert.equal(diagnostics[0].cause, fault); assert.equal(Object.isFrozen(diagnostics[0]), true);
    await f.pump();
  }));
});

test('H04 genuine profile Engine routes captured ports and saved frames survive asset release', async () => {
  await withGPU(async f => {
    const h = await active(f), diagnostics = [];
    const engine = await egret.createEngineForProfile({ host: h, onDiagnostic: d => diagnostics.push(d) }, PROFILE);
    const texture = egret.createTexture(egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([255, 64, 0, 255]) }));
    const type = egret.createAssetType('profile-host-route', egret.isTexture), ref = egret.createAssetRef(type, 'one');
    engine.assets.register(type, { load: async () => texture, dispose: value => value.dispose() }); const lease = await engine.assets.acquire(ref);
    const geometry = egret.createTexturedGeometry2D({ positions: new Float64Array([1, 1, 5, 1, 1, 5]), uvs: new Float64Array(6).fill(.5), lightColors: new Float64Array(12).fill(1), indices: new Uint32Array([0, 1, 2]) });
    const node = new egret.Mesh2D(lease, geometry); engine.stage.addChild(node);
    try {
      const saved = engine.renderTexturedFrame({ width: 8, height: 8 }); assert.equal(saved.profile, PROFILE); assert.equal(h.getStatus().lastSerial, 1);
      lease.release(); engine.assets.invalidate(ref); assert.throws(() => lease.value, e => e.code === 'ASSET_LEASE_RELEASED');
      node.dispose(); await tick(); texture.dispose();
      let lateReads = 0; for (const key of ['imageData', 'sourceRect']) Object.defineProperty(texture, key, { get() { lateReads++; throw Error('late runtime read'); } });
      h.renderTexturedFrame(saved); assert.equal(h.getTexturedStatus().pendingGeometryBytes, 408);
      const disposed = observe(engine.dispose()); await tick(); assert.equal(h.getTexturedStatus().pendingGeometryBytes, 408); assert.ok(f.textures.every(t => t.destroyed === 0));
      await f.pump(); await disposed; assert.equal(lateReads, 0); assert.deepEqual(diagnostics, []);
      const replay = await active(f); replay.renderTexturedFrame(saved); await f.pump(); assert.equal(lateReads, 0);
      assert.deepEqual([...f.calls.filter(c => c[0] === 'writeTexture').at(-1)[2]], [255, 64, 0, 255]);
    } finally { node.dispose(); lease.release(); const p = observe(engine.dispose()); await f.pump(); await p; texture.dispose(); }
  });
});
test('H04 public authentication and state guards reject hostile objects without property reads', async () => {
  await withFrames(a => withGPU(async f => {
    let reads = 0; const foreign = new Proxy({}, { get() { reads++; throw Error('foreign get'); }, ownKeys() { reads++; throw Error('foreign keys'); }, getPrototypeOf() { reads++; throw Error('foreign prototype'); } });
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    const h = f.keep(factory(f.options())); assert.throws(() => h.renderTexturedFrame(foreign), code('NOT_STARTED')); assert.equal(reads, 0);
    await f.ready(h); f.calls.length = 0;
    for (const value of [{}, foreign, revoked.proxy, new Proxy(a.triangle, {})]) assert.throws(() => h.renderTexturedFrame(value), code('FRAME_INVALID'));
    assert.equal(reads, 0); noMutation(f); status(h, { serial: 0, frames: 0, geometry: 0, upload: 0 });
    const old = f.keep(gpu.createWebGPUHost(f.options())); await f.ready(old); f.calls.length = 0;
    assert.throws(() => old.renderFrame(a.triangle), code('FRAME_PROFILE_UNSUPPORTED')); assert.deepEqual(f.calls, []); assert.equal(old.getStatus().lastSerial, 0);
    h.stop(); assert.throws(() => h.renderTexturedFrame(foreign), code('STOPPED')); assert.equal(reads, 0);
    await f.close(h); assert.throws(() => h.renderTexturedFrame(foreign), code('CLOSED')); assert.equal(reads, 0);
  }));
});
test('H04 opted-in active-before-busy and legacy busy-before-active remain distinct', async () => {
  await withFrames(a => withGPU(async f => {
    for (const textured of [true, false]) {
      const h = f.keep(textured ? factory(f.options()) : gpu.createWebGPUHost(f.options())); await f.ready(h);
      let observed;
      if (textured) {
        f.hooks.writeTexture = () => { try { h.renderTexturedFrame({}); } catch (error) { observed = error; } };
        h.renderTexturedFrame(a.triangle); assert.ok(code('REENTRANT')(observed)); assert.equal(h.getStatus().state, 'active'); delete f.hooks.writeTexture; await f.pump();
      }
      f.hooks.target = () => { h.stop(); try { if (textured) h.renderTexturedFrame({}); else h.renderFrame({}); } catch (error) { observed = error; } };
      assert.throws(() => textured ? h.renderTexturedFrame(a.triangle) : h.renderFrame(a.legacy), code('RENDER_FAILED'));
      assert.ok(code(textured ? 'STOPPED' : 'REENTRANT')(observed)); delete f.hooks.target; await f.pump();
    }
  }));
});
test('H04 configured admission failures leave no serial, ledger, ticket or GPU mutation and allow reuse', async () => {
  await withFrames(a => {
    const cases = [
      [{ maxSourceTriangles: 1 }, a.twoTriangles, a.triangle, 'FRAME_BUDGET', {}],
      [{ maxFrameGeometryBytes: 204 }, a.twoTriangles, a.triangle, 'FRAME_BUDGET', {}],
      [{ maxUploadBytes: 112 }, a.repeated, a.triangle, 'FRAME_BUDGET', {}],
      [{ maxUploadBytes: 112 }, a.triangle, a.invisible, 'DEVICE_LIMIT', { maxBufferSize: 95 }],
      [{ maxPreparedVertices: 3 }, a.repeated, a.triangle, 'FRAME_BUDGET', {}],
      [{ maxCommands: 1 }, a.repeated, a.triangle, 'FRAME_BUDGET', {}],
      [{ maxClipEdgeTests: 1 }, a.triangle, a.legacy, 'FRAME_BUDGET', {}],
      [{ maxReadbackBytes: 2303, enableReadback: true }, a.triangle, a.small, 'FRAME_BUDGET', {}],
      [{ enableReadback: true }, a.triangle, a.small, 'DEVICE_LIMIT', { maxBufferSize: 2047 }],
      [{ maxBackingPixels: 63 }, a.triangle, a.small, 'BACKING_LIMIT', {}],
      [{}, a.triangle, a.small, 'DEVICE_LIMIT', { maxTextureDimension2D: 7 }],
      [{}, a.range, a.triangle, 'GEOMETRY_RANGE', {}],
      [{}, a.rankPrecision, a.triangle, 'PRECISION_UNSUPPORTED', {}],
    ];
    return (async () => { for (const [options, rejected, reusable, wanted, limits] of cases) await withGPU(async f => {
      Object.assign(f.limits, limits); const h = await active(f, options); const ticket = options.enableReadback ? observe(h.requestReadback()) : undefined;
      f.calls.length = 0; assert.throws(() => h.renderTexturedFrame(rejected), code(wanted)); noMutation(f);
      assert.equal(h.getStatus().state, 'active'); assert.equal(h.getStatus().firstFailure, null); status(h, { serial: 0, frames: 0, geometry: 0, upload: 0 });
      if (reusable === a.legacy) h.renderFrame(reusable); else h.renderTexturedFrame(reusable);
      await f.pump(); await h.whenIdle(); assert.equal(h.getStatus().lastSerial, 1);
      if (ticket) { const result = await ticket; assert.equal(result.serial, 1); assert.equal(result.frameId, reusable.frameId); }
    }); })();
  });
});
test('H04 external packed allocation and GPU budget-shaped causes retain distinct fault authority', async () => {
  await withFrames(a => {
    return (async () => {
      await withGPU(async f => {
        const h = await active(f, { enableReadback: true }), ticket = observe(h.requestReadback()); const Native = globalThis.Float32Array;
        const cause = new egret.EgretError('WEBGPU_FRAME_BUDGET', { cause: { nested: true } }); let attempts = 0; f.calls.length = 0;
        try { globalThis.Float32Array = new Proxy(Native, { construct(target, args, newTarget) { if (args[0] === 24) { attempts++; throw cause; } return Reflect.construct(target, args, newTarget); } });
          assert.throws(() => h.renderTexturedFrame(a.triangle), exactCause('FRAME_INVALID', cause)); assert.equal(attempts, 1); noMutation(f); status(h, { serial: 0, frames: 0, geometry: 0, upload: 0 });
        } finally { globalThis.Float32Array = Native; }
        h.renderTexturedFrame(a.triangle); await f.pump(); assert.equal((await ticket).serial, 1); await h.whenIdle();
      });
      for (const boundary of ['buffer', 'writeBuffer']) for (const cause of [new egret.EgretError('WEBGPU_FRAME_BUDGET', { cause: { nested: true } }), null, undefined]) await withGPU(async f => {
        const h = await active(f); f.hooks[boundary] = () => { throw cause; };
        assert.throws(() => h.renderTexturedFrame(a.triangle), exactCause('RENDER_FAILED', cause)); assert.equal(h.getStatus().state, 'failed'); assert.equal(h.getStatus().firstFailure.cause, cause); await f.pump();
        assert.throws(() => h.renderTexturedFrame({}), exactCause('FAILED', cause));
      });
    })();
  });
});

test('H05 exact third-pipeline hardware minima are read once before creation', async () => {
  for (const [key, minimum] of [['maxVertexBuffers', 1], ['maxVertexAttributes', 3], ['maxVertexBufferArrayStride', 32], ['maxInterStageShaderVariables', 2], ['maxBindingsPerBindGroup', 3], ['maxUniformBufferBindingSize', 16]]) await withGPU(async f => {
    f.limits[key] = minimum - 1; const h = f.keep(factory(f.options())); const starting = observe(h.start()); await f.pump(); await assert.rejects(starting, code('DEVICE_LIMIT'));
    assert.equal(f.pipelines.length, 0); assert.equal(f.calls.some(c => ['configure', 'shader', 'texture', 'buffer'].includes(c[0])), false);
    if (['maxVertexAttributes', 'maxVertexBufferArrayStride', 'maxInterStageShaderVariables'].includes(key)) {
      const old = f.keep(gpu.createWebGPUHost(f.options())); await f.ready(old); assert.deepEqual(f.pipelines.map(p => p.kind), ['rect', 'image']);
    }
  });
  await withGPU(async f => {
    const reads = new Map(); for (const key of Object.keys(f.limits)) { const value = f.limits[key]; Object.defineProperty(f.limits, key, { get() { reads.set(key, (reads.get(key) ?? 0) + 1); return value; } }); }
    const h = await active(f); assert.equal(reads.size, 15); assert.ok([...reads.values()].every(count => count === 1));
    assert.deepEqual(f.pipelines.map(p => p.kind), ['rect', 'image', 'textured']); await f.close(h); assert.ok([...reads.values()].every(count => count === 1));
  });
});
test('H05 third pipeline owns balanced scopes and exact CPU descriptor ABI', async () => {
  await withGPU(async f => {
    const h = f.keep(factory(f.options())), starting = observe(h.start()); await tick();
    assert.deepEqual(f.pipelines.map(p => p.kind), ['rect', 'image', 'textured']); assert.equal(f.open, 0); assert.equal(f.scopes.length, 3);
    f.pipelines.slice(0, 2).forEach(p => p.resolve(p.value)); f.settleScopes(); await tick(); assert.equal(h.getStatus().state, 'starting'); assert.equal(f.calls.some(c => c[0] === 'configure'), false);
    f.pipelines[2].resolve(f.pipelines[2].value); await f.pump(); await starting;
    const descriptor = f.pipelines[2].descriptor;
    assert.deepEqual(descriptor.vertex.buffers, [{ arrayStride: 32, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }, { shaderLocation: 1, offset: 8, format: 'float32x2' }, { shaderLocation: 2, offset: 16, format: 'float32x4' }] }]);
    assert.equal(descriptor.primitive.topology, 'triangle-list'); assert.equal(descriptor.primitive.cullMode, 'none'); assert.equal(descriptor.depthStencil, undefined); assert.equal(descriptor.multisample.count, 1);
    const blend = { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }; assert.deepEqual(descriptor.fragment.targets[0].blend, { color: blend, alpha: blend });
    assert.deepEqual(f.calls.filter(c => c[0] === 'layout').map(c => c.slice(1)), [['image', 0], ['textured', 0]]);
    assert.deepEqual(f.calls.find(c => c[0] === 'sampler')[1], { addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge', magFilter: 'nearest', minFilter: 'nearest', mipmapFilter: 'nearest', lodMinClamp: 0, lodMaxClamp: 0, maxAnisotropy: 1 });
    // Descriptor ABI is fixed. Shader algebra/interpolation is independently
    // source-reviewed and later native-verified; no fragile variable-name regex.
    assert.equal(typeof descriptor.vertex.module.descriptor.code, 'string'); assert.ok(descriptor.vertex.module.descriptor.code.length > 0);
  });
});
test('H05 third startup faults including undefined drain already-started peers before close', async () => {
  for (const boundary of ['shader', 'pipeline', 'sampler', 'layout']) for (const cause of [{ boundary }, undefined]) await withGPU(async f => {
    let shaderCount = 0;
    f.hooks[boundary] = value => {
      if (boundary === 'shader' && ++shaderCount !== 3) return;
      if (boundary === 'pipeline' && value.kind !== 'textured') return;
      if (boundary === 'layout' && value !== 'textured') return;
      throw cause;
    };
    const h = f.keep(factory(f.options())), starting = observe(h.start()), state = watched(starting); await tick(); f.settleScopes(); await tick();
    if (boundary !== 'layout') assert.equal(state.settled, false, 'started peer promises are owned');
    await f.pump(); await assert.rejects(starting, exactCause('START_FAILED', cause)); assert.equal(f.open, 0); assert.equal(f.calls.some(c => c[0] === 'configure'), false);
  });
});
test('H05 reentrant stop/close after returning third promise preserves cancellation and ownership', async () => {
  for (const action of ['stop', 'close']) await withGPU(async f => {
    const h = f.keep(factory(f.options())); let closing;
    f.hooks.pipeline = p => { if (p.kind === 'textured') { if (action === 'stop') h.stop(); else closing = observe(h.close()); } };
    const starting = observe(h.start()); await tick(); assert.equal(f.open, 0); assert.equal(f.pipelines.length, 3);
    const state = watched(closing ?? starting); f.settleScopes(); f.pipelines.slice(0, 2).forEach(p => p.resolve(p.value)); await tick(); assert.equal(state.settled, false);
    f.pipelines[2].reject(undefined); await f.pump(); await assert.rejects(starting, code('START_CANCELLED')); if (closing) await closing;
    assert.equal(f.calls.some(c => c[0] === 'configure' || c[0] === 'layout'), false); assert.equal(f.calls.filter(c => c[0] === 'deviceDestroy').length, 0);
  });
});
test('H05 late acquired device belongs to cancelled startup and is destroyed once', async () => {
  await withGPU(async f => {
    const h = f.keep(factory(f.options({ device: { kind: 'acquire' } }))), starting = observe(h.start());
    f.adapterResult.resolve(f.adapter); await tick(); assert.equal(f.calls.filter(c => c[0] === 'requestDevice').length, 1);
    const closing = observe(h.close()), state = watched(closing); await tick(); assert.equal(state.settled, false);
    f.deviceResult.resolve(f.device); await f.pump(); await assert.rejects(starting, code('START_CANCELLED')); await closing;
    assert.equal(f.calls.filter(c => c[0] === 'deviceDestroy').length, 1); assert.equal(h.close(), closing);
  });
});

test('H04/L02 painter barriers preserve order, shared crop and per-command bindings without depth/MVP', async () => {
  await withFrames(a => withGPU(async f => {
    const h = await active(f); h.renderTexturedFrame(a.ordered);
    assert.deepEqual(f.calls.filter(c => c[0] === 'setPipeline').map(c => c[1].kind), ['rect', 'rect', 'textured', 'image', 'textured']);
    assert.equal(f.calls.filter(c => c[0] === 'pass').length, 1); assert.equal(f.calls.find(c => c[0] === 'pass')[1].depthStencilAttachment, undefined);
    assert.equal(f.textures.length, 1); assert.equal(f.calls.filter(c => c[0] === 'writeTexture').length, 1);
    assert.deepEqual([...f.calls.find(c => c[0] === 'writeTexture')[2]], [255, 64, 0, 255]);
    const bindings = f.calls.filter(c => c[0] === 'binding').map(c => c[1].descriptor); assert.equal(bindings.length, 3);
    assert.deepEqual(bindings.map(b => b.layout.kind), ['textured', 'image', 'textured']); assert.ok(bindings.every(b => b.entries[0].resource === bindings[0].entries[0].resource));
    assert.ok(bindings.every(b => b.entries[1].resource === f.sampler)); assert.equal(new Set(bindings.map(b => b.entries[2].resource.buffer)).size, 3);
    assert.ok(bindings.every(b => b.entries[2].resource.size === 16)); assert.equal(f.buffers.filter(b => b.descriptor.usage === 72).length, 3);
    assert.equal(f.textures.some(t => t.descriptor.format === 'depth32float'), false); await f.pump();
  }));
});

test('L01 geometry charges stay per pending replay while settled buffers return out of order', async () => {
  await withFrames(a => withGPU(async f => {
    // Keep both logical draws executable so the original four-buffer reuse
    // and out-of-order retirement assertions remain meaningful after batching.
    f.limits.maxBufferSize = 96;
    const h = await active(f, { maxPendingGeometryBytes: 408 });
    const one = f.proof(() => h.renderTexturedFrame(a.triangle)); admitted(one); const first = f.buffers.slice();
    const two = f.proof(() => h.renderTexturedFrame(a.triangle)); admitted(two); const second = f.buffers.slice(first.length);
    assert.equal(first.length, 2); assert.equal(second.length, 2); assert.ok(second.every(buffer => !first.includes(buffer)));
    status(h, { serial: 2, frames: 2, geometry: 408, upload: 224 });
    await two.finish(); status(h, { serial: 2, frames: 1, geometry: 204, upload: 112 }); assert.ok(f.buffers.every(b => b.destroyed === 0));
    await one.finish(); status(h, { serial: 2, frames: 0, geometry: 0, upload: 0 });
    await two.finish(); await one.finish(); status(h, { serial: 2, frames: 0, geometry: 0, upload: 0 });
    const repeat = f.proof(() => h.renderTexturedFrame(a.repeated)); admitted(repeat); status(h, { serial: 3, frames: 1, geometry: 204, upload: 224 });
    const writes = f.calls.filter(c => c[0] === 'writeBuffer').slice(-4);
    assert.equal(f.buffers.length, 4); assert.equal(new Set(writes.map(c => c[1])).size, 4); assert.ok(writes.every(c => f.buffers.includes(c[1])));
    await repeat.finish(); assert.ok(f.buffers.every(b => b.destroyed === 0));
    // Out-of-order proof elects the second cold texture; replay borrows that winner.
    assert.equal(f.textures.length, 2); assert.deepEqual(f.textures.map(t => t.destroyed), [1, 0]);
    const closing = observe(h.close()); await f.pump(); await closing;
    assert.ok(f.buffers.every(b => b.destroyed === 1)); assert.ok(f.textures.every(t => t.destroyed === 1));
    await h.close(); assert.ok(f.buffers.every(b => b.destroyed === 1));
  }));
});

test('L01 geometry cap407 rejects second replay before serial and keeps armed ticket reusable', async () => {
  await withFrames(a => withGPU(async f => {
    const h = await active(f, { maxPendingGeometryBytes: 407, enableReadback: true }); const one = f.proof(() => h.renderTexturedFrame(a.triangle)); admitted(one);
    const ticket = observe(h.requestReadback()); f.calls.length = 0;
    assert.throws(() => h.renderTexturedFrame(a.triangle), code('BACKPRESSURE')); assert.deepEqual(f.calls, []); status(h, { serial: 1, frames: 1, geometry: 204, upload: 112 });
    await one.finish(); const selected = f.proof(() => h.renderTexturedFrame(a.triangle)); admitted(selected); await selected.finish();
    const readback = await ticket; assert.equal(readback.serial, 2); assert.equal(readback.frameId, a.triangle.frameId); status(h, { serial: 2, frames: 0, geometry: 0, upload: 0 });
  }));
});
test('L02 upload upper bounds retain packed collapse and admission224/223 without refund', async () => {
  await withFrames(a => {
    return (async () => { for (const maximum of [224, 223]) await withGPU(async f => {
      const h = await active(f, { maxPendingUploadBytes: maximum }); const one = f.proof(() => h.renderTexturedFrame(a.collapsed)); admitted(one);
      status(h, { serial: 1, frames: 1, geometry: 204, upload: 112 }); assert.equal(f.buffers.length, 0); assert.equal(f.textures.length, 0);
      assert.deepEqual(f.calls.filter(c => ['setPipeline', 'setVertexBuffer', 'setBindGroup', 'draw', 'binding', 'writeBuffer', 'writeTexture'].includes(c[0])), []);
      f.calls.length = 0;
      if (maximum === 223) { assert.throws(() => h.renderTexturedFrame(a.triangle), code('BACKPRESSURE')); assert.deepEqual(f.calls, []); status(h, { serial: 1, frames: 1, geometry: 204, upload: 112 }); }
      else { const two = f.proof(() => h.renderTexturedFrame(a.triangle)); admitted(two); status(h, { serial: 2, frames: 2, geometry: 408, upload: 224 }); await two.finish(); }
      await one.finish(); assert.equal(h.getTexturedStatus().pendingGeometryBytes, 0); assert.equal(h.getStatus().pendingUploadBytes, 0);
    }); })();
  });
});
test('L02 ticket binds once and every proof holds exclusive buffers before bounded idle retention', async () => {
  await withFrames(a => {
    return (async () => { for (const order of ['map-first', 'fence-first']) await withGPU(async f => {
      const h = await active(f, { enableReadback: true }), ticket = observe(h.requestReadback()), settled = watched(ticket);
      const selected = f.proof(() => h.renderTexturedFrame(a.triangle)); admitted(selected); const selectedBuffers = f.buffers.slice();
      const replay = f.proof(() => h.renderTexturedFrame(a.triangle)); admitted(replay); const replayBuffers = f.buffers.slice(selectedBuffers.length);
      assert.equal(selectedBuffers.length, 3); assert.equal(replayBuffers.length, 2); assert.ok(replayBuffers.every(buffer => !selectedBuffers.includes(buffer)));
      assert.equal(selected.maps.length, 1); assert.equal(replay.maps.length, 0); status(h, { serial: 2, frames: 2, geometry: 408, upload: 224, readback: 2304 });
      if (order === 'map-first') selected.resolveMaps(); else selected.resolveFences(); selected.settleScopes(); await tick(); assert.equal(settled.settled, false);
      await replay.finish(); status(h, { serial: 2, frames: 1, geometry: 204, upload: 112, readback: 2304 }); assert.ok(f.buffers.every(b => b.destroyed === 0));
      if (order === 'map-first') selected.resolveFences(); else selected.resolveMaps(); await tick(); const result = await ticket;
      assert.equal(result.serial, 1); assert.equal(result.frameId, a.triangle.frameId); assert.equal(result.bytes.byteLength, 256);
      status(h, { serial: 2, frames: 0, geometry: 0, upload: 0 }); const staging = f.buffers.find(b => b.descriptor.usage === 9); assert.equal(staging.unmapped, 1); assert.equal(staging.destroyed, 1);
      await h.whenIdle(); assert.ok(f.buffers.filter(b => b !== staging).every(b => b.destroyed === 0));
      const closing = observe(h.close()); await f.pump(); await closing; assert.ok(f.buffers.every(b => b.destroyed === 1));
      await h.close(); assert.ok(f.buffers.every(b => b.destroyed === 1));
    }); })();
  });
});

test('L02 independent scope retains geometry after map and queue success before ticket resolution', async () => {
  await withFrames(a => withGPU(async f => {
    const h = await active(f, { enableReadback: true }), ticket = observe(h.requestReadback()), done = watched(ticket);
    const p = f.proof(() => h.renderTexturedFrame(a.triangle)); admitted(p); p.resolveFences(); p.resolveMaps(); await tick();
    assert.equal(done.settled, false); status(h, { serial: 1, frames: 1, geometry: 204, upload: 112, readback: 2304 }); assert.ok(f.buffers.every(b => b.destroyed === 0));
    p.settleScopes(); await ticket; status(h, { serial: 1, frames: 0, geometry: 0, upload: 0 });
  }));
});

test('L03 attempted writes and encoding/submit faults fence peers and fresh whenIdle fails immediately', async () => {
  await withFrames(a => {
    return (async () => { for (const boundary of ['writeTexture', 'encoder', 'submit']) await withGPU(async f => {
      const h = await active(f), cause = { boundary }; f.hooks[boundary] = () => { throw cause; };
      const p = f.proof(() => h.renderTexturedFrame(a.triangle)); assert.equal(p.thrown, true); assert.ok(exactCause('RENDER_FAILED', cause)(p.cause)); assert.equal(p.fences.length, 1);
      status(h, { serial: 1, frames: 1, geometry: 204, upload: 112 }); assert.ok(f.textures.every(t => t.destroyed === 0));
      const idle = observe(h.whenIdle()), immediate = watched(idle); await tick(); assert.equal(immediate.settled, true); await assert.rejects(idle, exactCause('RENDER_FAILED', cause));
      p.resolveFences(); await tick(); assert.equal(h.getTexturedStatus().pendingGeometryBytes, 204); p.settleScopes(); await tick();
      status(h, { serial: 1, frames: 0, geometry: 0, upload: 0 }); assert.equal(h.getStatus().firstFailure.cause, cause);
    }); })();
  });
});
test('L03 healthy whenIdle snapshots exclude later submissions and ordinary frames share the ledger', async () => {
  await withFrames(a => withGPU(async f => {
    const h = await active(f), one = f.proof(() => h.renderTexturedFrame(a.triangle)); admitted(one);
    const idle = observe(h.whenIdle()), done = watched(idle), two = f.proof(() => h.renderFrame(a.legacy)); admitted(two);
    status(h, { serial: 2, frames: 2, geometry: 204, upload: 112 }); f.calls.length = 0;
    assert.throws(() => h.renderTexturedFrame(a.triangle), code('BACKPRESSURE')); assert.deepEqual(f.calls, []);
    await one.finish(); await idle; assert.equal(done.settled, true); status(h, { serial: 2, frames: 1, geometry: 0, upload: 0 });
    await two.finish(); await h.whenIdle(); status(h, { serial: 2, frames: 0, geometry: 0, upload: 0 });
  }));
});
test('L03 unsafe proof quarantines geometry until peer drain and common close retirement', async () => {
  await withFrames(a => {
    return (async () => { for (const proof of ['fence', 'scope', 'map', 'loss']) await withGPU(async f => {
      const h = await active(f, { enableReadback: true }), cause = { proof }, ticket = observe(h.requestReadback()); f.allowUnsafe(h);
      const p = f.proof(() => h.renderTexturedFrame(a.triangle)); admitted(p);
      if (proof === 'fence') p.fences[0].reject(cause); if (proof === 'scope') p.scopes[0].reject(cause); if (proof === 'map') p.maps[0].reject(cause); if (proof === 'loss') f.lost.resolve(cause);
      await tick(); const expected = proof === 'fence' ? 'QUEUE_FAILED' : proof === 'scope' ? 'SCOPE_FAILED' : proof === 'map' ? 'READBACK_FAILED' : 'DEVICE_LOST';
      const idle = observe(h.whenIdle()); await assert.rejects(idle, exactCause(expected, cause));
      const closing = observe(h.close()), closed = watched(closing); await tick(); assert.equal(closed.settled, false);
      status(h, { serial: 1, frames: 1, geometry: 204, upload: 112, readback: 2304 }); assert.ok(f.textures.every(t => t.destroyed === 0)); assert.ok(f.buffers.every(b => b.destroyed === 0));
      await p.finish(); await assert.rejects(ticket); await f.pump(); await assert.rejects(closing, exactCause('CLOSE_UNSAFE', cause));
      status(h, { serial: 1, frames: 0, geometry: 0, upload: 0 }); assert.ok(f.textures.every(t => t.destroyed === 1)); assert.ok(f.buffers.every(b => b.destroyed === 1));
      assert.equal(f.calls.filter(c => c[0] === 'deviceDestroy').length, 0); await assert.rejects(h.whenIdle(), exactCause('CLOSE_UNSAFE', cause));
    }); })();
  });
});

test('L04 reentrant resource cleanup marks retirement once before stop/close and exact debits', async () => {
  await withFrames(a => withGPU(async f => {
    const h = await active(f, { enableReadback: true }), ticket = observe(h.requestReadback()); let closing, attempts = 0;
    f.hooks.destroyBuffer = () => { attempts++; h.stop(); closing ??= observe(h.close()); };
    const p = f.proof(() => h.renderTexturedFrame(a.triangle)); admitted(p); await p.finish(); await ticket; await f.pump(); await closing;
    assert.equal(attempts, f.buffers.length); assert.ok(f.buffers.every(b => b.destroyed === 1)); assert.ok(f.textures.every(t => t.destroyed === 1));
    assert.equal(f.buffers.find(b => b.descriptor.usage === 9).unmapped, 1); status(h, { serial: 1, frames: 0, geometry: 0, upload: 0 });
    await p.finish(); await h.close(); assert.equal(attempts, f.buffers.length); assert.equal(f.calls.filter(c => c[0] === 'deviceDestroy').length, 0);
  }));
});
test('L04 destroy/unmap failure preserves first render fault and performs each cleanup once', async () => {
  await withFrames(a => {
    return (async () => { for (const boundary of ['destroyBuffer', 'unmap']) await withGPU(async f => {
      const h = await active(f, { enableReadback: true }), first = { validation: true }, cleanup = { boundary }, ticket = observe(h.requestReadback()); f.allowUnsafe(h);
      f.hooks[boundary] = () => { throw cleanup; }; const p = f.proof(() => h.renderTexturedFrame(a.triangle)); admitted(p); p.scopes[0].resolve(first); await p.finish();
      await assert.rejects(ticket, exactCause('VALIDATION', first)); assert.equal(h.getStatus().firstFailure.cause, first);
      const closing = observe(h.close()); await f.pump(); await assert.rejects(closing, exactCause('CLOSE_UNSAFE', cleanup));
      status(h, { serial: 1, frames: 0, geometry: 0, upload: 0 }); assert.ok(f.buffers.every(b => b.destroyed === 1)); assert.ok(f.textures.every(t => t.destroyed === 1));
      assert.equal(f.buffers.find(b => b.descriptor.usage === 9).unmapped, 1); assert.equal(h.getStatus().firstFailure.cause, first); assert.equal(h.close(), closing);
    }); })();
  });
});

test('L05 close owns CPU reentry, peer outcomes, final fence and loss observer through safe return', async () => {
  await withFrames(a => withGPU(async f => {
    const h = await active(f); let closing;
    f.hooks.buffer = () => { closing ??= observe(h.close()); };
    const p = f.proof(() => h.renderTexturedFrame(a.triangle)); assert.equal(p.thrown, true); assert.ok(code('RENDER_FAILED')(p.cause)); assert.ok(closing);
    const done = watched(closing); await tick(); assert.equal(done.settled, false); status(h, { serial: 1, frames: 1, geometry: 204, upload: 112 });
    delete f.hooks.buffer; await p.finish(); await tick(); assert.equal(done.settled, false, 'final fence still owned');
    const final = f.fences.at(-1); assert.ok(final); assert.equal(p.fences.includes(final), false); assert.equal(f.calls.filter(c => c[0] === 'remove').length, 0);
    final.resolve(); await tick(); await closing;
    assert.equal(f.calls.filter(c => c[0] === 'remove').length, 1); assert.equal(h.getStatus().cleanupOutcome, 'safe'); status(h, { serial: 1, frames: 0, geometry: 0, upload: 0 });
    const first = h.getStatus().firstFailure; f.lost.resolve({ afterReturn: true }); await tick(); assert.equal(h.getStatus().firstFailure, first);
  }));
});
test('L05 Engine timeout retains surface until late safe return or permanently quarantines unsafe close', async () => {
  for (const unsafe of [false, true]) await withFrames(a => withGPU(async f => {
    const h = await active(f), engine = await egret.createEngineForProfile({ host: h, shutdownTimeoutMs: 17 }, PROFILE);
    const p = f.proof(() => h.renderTexturedFrame(a.triangle)); admitted(p); p.settleScopes();
    const set = globalThis.setTimeout, clear = globalThis.clearTimeout; let timeout;
    globalThis.setTimeout = (callback, delay) => { assert.equal(delay, 17); timeout = callback; return 1; }; globalThis.clearTimeout = () => {};
    try {
      const disposed = observe(engine.dispose()); await tick(); assert.equal(typeof timeout, 'function'); timeout(); await assert.rejects(disposed, e => e.code === 'ENGINE_CLOSE_TIMEOUT');
      const reserved = async () => {
        const denied = f.keep(gpu.createWebGPUHost(f.options())); denied.start = () => { throw Error('reserved surface was started'); };
        await assert.rejects(egret.createEngine({ host: denied }), e => e.code === 'SURFACE_IN_USE');
      };
      await reserved(); assert.equal(h.getTexturedStatus().pendingGeometryBytes, 204); assert.ok(f.textures.every(t => t.destroyed === 0));
      if (unsafe) { f.allowUnsafe(h); p.fences[0].reject({ unsafe: true }); } else p.resolveFences();
      await f.pump(); if (unsafe) { await assert.rejects(h.close(), code('CLOSE_UNSAFE')); await reserved(); }
      else {
        await h.close(); const next = f.keep(factory(f.options())), creation = observe(egret.createEngineForProfile({ host: next, shutdownTimeoutMs: 17 }, PROFILE)); await f.pump(); const second = await creation;
        const disposal = observe(second.dispose()); await f.pump(); await disposal;
      }
      assert.equal(h.getTexturedStatus().pendingGeometryBytes, 0); assert.ok(f.textures.every(t => t.destroyed === 1)); assert.equal(f.calls.filter(c => c[0] === 'deviceDestroy').length, 0);
    } finally { globalThis.setTimeout = set; globalThis.clearTimeout = clear; }
  }));
});
