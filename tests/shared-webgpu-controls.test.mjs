// SPDX-License-Identifier: Apache-2.0
// Independent public-SDK controls for shared rendering through controlled GPU ports.
// Controlled ports prove admission, bytes, encoding order and ownership only;
// they do not rasterize, validate WGSL, or prove native pixels/performance.
// Mutation targets are stated with each case. New Host entry absence is an
// availability failure; only later assertions can become semantic RED evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  egret, tick, admitted, requireFactory, withPorts, pageTextures, colorTargets,
  bytesOfTexture, writes, uploads, passes, capture, submit,
} from './fixtures/gpu-shared-rendering.mjs';
import { createMeshGeometry3D, createSceneFrame3D, isSceneFrame3D } from
  '@egret/engine/scene3d';

const PROFILE = 'egret.shared-frame2d/1';
const FRAME = Object.freeze({ width: 8, height: 8 });
const TOP = ['canvas', 'device', 'onDiagnostic', 'pixelRatio', 'maxBackingPixels',
  'maxCommands', 'maxClipRectangles', 'maxPreparedVertices', 'maxClipEdgeTests',
  'maxUploadBytes', 'maxPendingUploadBytes', 'maxPendingFrames', 'maxReadbackBytes',
  'enableReadback', 'maxSourceTriangles', 'maxFrameGeometryBytes',
  'maxPendingGeometryBytes', 'maxTupleComparisons', 'outputAlpha'];
const hasCode = name => e => e instanceof egret.EgretError && e.code === 'WEBGPU_' + name;
const expectCode = (run, name) => assert.throws(run, hasCode(name));
const source = (pixels = [255, 0, 0, 128, 0, 255, 0, 255], width = 2, height = 1) =>
  egret.createImageData2D({ width, height, pixels: new Uint8Array(pixels) });
const region = (x = 0) => ({ packed: { x, y: 0, width: 1, height: 1 },
  logicalWidth: 1, logicalHeight: 1, trimX: 0, trimY: 0, quarterTurn: 0 });
let assetOrdinal = 0;
async function withAuthor(body) {
  const timers = new Set(), resources = [];
  const engine = await egret.createEngine({ host: {
    surface: {}, start() {}, stop() {}, async close() {},
    setTimeout(callback, delay) {
      const value = { callback, delay }; timers.add(value); return () => timers.delete(value);
    },
  } });
  const scope = engine.createScope();
  const a = {
    engine, scope,
    capture(options = FRAME) {
      assert.equal(typeof engine.captureSharedFrame, 'function',
        'captureSharedFrame must be available before semantic Host controls');
      const value = engine.captureSharedFrame(options);
      assert.equal(value.profile, PROFILE); assert.ok(Object.isFrozen(value));
      for (const key of ['commands', 'pages', 'regions', 'materials', 'geometries'])
        assert.ok(Object.isFrozen(value[key]));
      return value;
    },
    add(node, parent = engine.stage) { scope.use(node); parent.addChild(node); return node; },
    sprite(parent) { return a.add(new egret.Sprite(), parent); },
    bitmap(item, parent) { return a.add(new egret.Bitmap(item.lease), parent); },
    mesh(item, geometry, parent) { return a.add(new egret.Mesh2D(item.lease, geometry), parent); },
    async resource(image = source(), selected = region()) {
      const texture = egret.createTextureView(image, selected);
      const record = { image, texture, lease: undefined, disposals: 0 }; resources.push(record);
      const id = 'm13-gpu-' + (++assetOrdinal);
      const type = egret.createAssetType(id, egret.isTexture);
      engine.assets.register(type, { async load() { return texture; },
        dispose(value) { record.disposals++; value.dispose(); } });
      record.lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, id),
        { signal: scope.signal }));
      return record;
    },
  };
  try { return await body(a); }
  finally {
    scope.dispose(); await engine.dispose();
    assert.equal(scope.state, 'closed'); assert.equal(timers.size, 0);
    for (const r of resources) {
      if (r.lease) { assert.equal(r.disposals, 1); assert.equal(r.texture.isDisposed, true); }
      else r.texture.dispose();
    }
  }
}
const using = body => withPorts(f => withAuthor(a => body(f, a)));
function fill(node, color = 0xff0000, alpha = 1) {
  node.graphics.beginFill(color, alpha).drawRect(1, 1, 2, 2).endFill();
}
function status(host) {
  const value = host.getSharedStatus();
  assert.ok(Object.isFrozen(value)); assert.ok(Object.isFrozen(value.host));
  assert.deepEqual(Object.keys(value).sort(),
    ['host', 'pendingCanonicalBytes', 'pendingColorBytes', 'pendingGeometryBytes', 'resources']);
  return value;
}
function refusal(f, host, run, code) {
  const before = { calls: f.calls.length, status: status(host), width: f.canvas.width, height: f.canvas.height };
  expectCode(run, code);
  assert.deepEqual({ calls: f.calls.length, status: status(host), width: f.canvas.width, height: f.canvas.height }, before);
}
function uiPass(record) {
  const rows = passes(record.events);
  assert.ok(rows.length >= 2);
  return rows.at(-2);
}
function selectedUniform(events, draw, binding = 0) {
  assert.ok(draw.binding, 'a real selected binding is required');
  const entry = draw.binding.descriptor.entries.find(e => e.binding === binding);
  assert.ok(entry?.resource.buffer, 'selected uniform resource is required');
  assert.deepEqual([entry.resource.offset, entry.resource.size], [0, 128]);
  const selected = writes(events, entry.resource.buffer);
  assert.equal(selected.length, 1);
  assert.equal(selected[0][2], 0); assert.equal(selected[0][3].byteLength, 128);
  return { buffer: entry.resource.buffer, bytes: selected[0][3] };
}
function selectedResolveTarget(draw, target) {
  assert.ok(draw.binding, 'resolve must select a real target binding');
  const sampled = draw.binding.descriptor.entries.filter(e => e.resource?.texture);
  assert.equal(sampled.length, 1); assert.equal(sampled[0].resource.texture, target);
}
function expectUniform(bytes, floats, uints) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(bytes.byteLength, 128); assert.equal(floats.length, 12); assert.equal(uints.length, 20);
  for (let i = 0; i < floats.length; i++) assert.equal(data.getFloat32(4 * i, true), floats[i], 'f32 offset ' + 4 * i);
  for (let i = 0; i < uints.length; i++) assert.equal(data.getUint32(48 + 4 * i, true), uints[i], 'u32 offset ' + (48 + 4 * i));
}

// Break caught: early option semantics skip later getters, or default output uses opaque.
test('GPU G01 shared options finish ordered reads and default to premultiplied', async () => {
  await withPorts(async f => {
    const make = requireFactory(), trace = [];
    const policy = Object.defineProperties({}, {
      kind: { get() { trace.push('device.kind'); return 'borrow'; } },
      device: { get() { trace.push('device.device'); return f.device; } },
    });
    const input = Object.defineProperties({}, Object.fromEntries(TOP.map(key => [key, {
      get() { trace.push(key); return key === 'canvas' ? f.canvas : key === 'device' ? policy : undefined; },
    }])));
    const h = make(input); f.hosts.push(h);
    assert.deepEqual(trace, [...TOP, 'device.kind', 'device.device']);
    assert.equal(h.sharedFrameProfile, PROFILE);
    await f.ready(h);
    assert.equal(f.calls.filter(c => c[0] === 'configure').at(-1)[1].alphaMode, 'premultiplied');
    const cause = Object.freeze({ lateOption: true }), badTrace = [];
    const bad = Object.defineProperties({}, Object.fromEntries(TOP.map(key => [key, {
      get() {
        badTrace.push(key); if (key === 'outputAlpha') throw cause;
        return key === 'canvas' ? f.canvas : key === 'maxBackingPixels' ? -1 : undefined;
      },
    }])));
    const before = f.calls.length;
    assert.throws(() => make(bad), e => hasCode('OPTIONS_INVALID')(e) && e.cause === cause);
    assert.deepEqual(badTrace, TOP); assert.equal(f.calls.length, before);
    await f.close(h);
  });
});

// Break caught: scene factory silently defaults or coerces a transparent configuration.
test('GPU G02 shared scene requires explicit opaque options before native startup', async () => {
  await withPorts(async f => {
    const make = requireFactory(true), before = f.calls.length;
    for (const value of [undefined, 'premultiplied', null, 'opaque-ish'])
      expectCode(() => make(f.options({ outputAlpha: value })), 'OPTIONS_INVALID');
    assert.equal(f.calls.length, before);
    const h = f.sharedHost({ outputAlpha: 'opaque' }, true); await f.ready(h);
    assert.equal(f.calls.filter(c => c[0] === 'configure').at(-1)[1].alphaMode, 'opaque');
    assert.equal(typeof h.renderSceneSharedFrame, 'function'); await f.close(h);
  });
});

// Break caught: structural frame lookalikes or inherited old ports bypass completion authority.
test('GPU G03 clone, proxy and wrong profile refuse before payload and native effects', async () => {
  await using(async (f, a) => {
    const h = f.sharedHost(); await f.ready(h);
    const saved = a.capture(); let reads = 0;
    const clone = { ...saved };
    Object.defineProperty(clone, 'commands', { get() { reads++; throw new Error('payload'); } });
    const proxy = new Proxy(saved, { get() { reads++; throw new Error('proxy payload'); } });
    refusal(f, h, () => h.renderSharedFrame(clone), 'FRAME_PROFILE_UNSUPPORTED');
    refusal(f, h, () => h.renderSharedFrame(proxy), 'FRAME_PROFILE_UNSUPPORTED');
    refusal(f, h, () => h.renderSharedFrame(a.engine.captureFrame(FRAME)), 'FRAME_PROFILE_UNSUPPORTED');
    if (typeof h.renderFrame === 'function')
      refusal(f, h, () => h.renderFrame(proxy), 'FRAME_PROFILE_UNSUPPORTED');
    assert.equal(reads, 0);
    const accepted = await submit(f, h, saved);
    assert.equal(passes(accepted.events).length, 2); assert.equal(h.getStatus().lastSerial, 1);
  });
});

// Break caught: upload per region/crop instead of authentic page, or warm admission copies/uploads again.
test('GPU G04 two regions share one exact canonical page and READY replay uploads zero', async () => {
  await using(async (f, a) => {
    const pixels = [255, 0, 0, 128, 0, 255, 0, 255], page = source(pixels);
    const left = await a.resource(page, region(0)), right = await a.resource(page, region(1));
    a.bitmap(left); const b = a.bitmap(right); b.x = 2;
    const first = a.capture(), second = a.capture();
    assert.notEqual(first, second); assert.notEqual(first.commands, second.commands);
    assert.equal(first.pages.length, 1); assert.equal(first.regions.length, 2);
    assert.equal(first.pages[0].source, page);
    assert.deepEqual([...egret.copyImageData2DPixels(page)], pixels);
    const h = f.sharedHost(); await f.ready(h);
    const r = capture(f, () => h.renderSharedFrame(first)); admitted(r);
    assert.deepEqual([status(h).pendingCanonicalBytes, status(h).pendingColorBytes], [8, 256]);
    assert.equal(pageTextures(r.textures).length, 1);
    const cold = uploads(r.events); assert.equal(cold.length, 1);
    assert.deepEqual([...cold[0][2]], [187, 0, 0, 128, 0, 255, 0, 255]);
    assert.deepEqual(cold[0][4], { width: 2, height: 1, depthOrArrayLayers: 1 });
    const sampled = uiPass(r).draws;
    assert.equal(sampled.length, 2, 'different regions are not implicitly batch compatible');
    const selected = sampled.map(draw => draw.binding.descriptor.entries.find(e => e.binding === 1).resource.texture);
    assert.equal(selected[0], pageTextures(r.textures)[0]); assert.equal(selected[1], selected[0]);
    await r.finish(); await h.whenIdle();
    const warm = await submit(f, h, second);
    assert.equal(uploads(warm.events).length, 0); assert.equal(pageTextures(warm.textures).length, 0);
    assert.equal(uiPass(warm).draws[0].binding.descriptor.entries.find(e => e.binding === 1).resource.texture, selected[0]);
    assert.deepEqual([...egret.copyImageData2DPixels(page)], pixels);
  });
});

// Break caught: canonical bytes are used as resource ownership identity.
test('GPU G05 equal pixel bytes from different genuine sources remain separate page owners', async () => {
  await using(async (f, a) => {
    const p = source(), q = source(); assert.notEqual(p, q);
    const x = await a.resource(p), y = await a.resource(q);
    a.bitmap(x); a.bitmap(y);
    const saved = a.capture(); assert.equal(saved.pages.length, 2);
    const h = f.sharedHost(); await f.ready(h);
    const r = await submit(f, h, saved);
    const pages = pageTextures(r.textures), actual = uploads(r.events);
    assert.equal(pages.length, 2); assert.equal(actual.length, 2);
    assert.notEqual(pages[0], pages[1]); assert.deepEqual(actual[0][2], actual[1][2]);
    assert.deepEqual(new Set(uiPass(r).draws.map(d => d.binding.descriptor.entries.find(e => e.binding === 1).resource.texture)), new Set(pages));
  });
});

// Break caught: opaque Host returns the old premultiplied literal or reads pre-resolve target.
// The controlled mapping returns zero bytes; this test deliberately makes no pixel-alpha claim.
test('GPU G06 opaque readback keeps public metadata and copies the resolved canvas', async () => {
  await using(async (f, a) => {
    const h = f.sharedHost({ outputAlpha: 'opaque', enableReadback: true }); await f.ready(h);
    const saved = a.capture({ ...FRAME, outputAlpha: 'opaque', clearAlpha: 1 });
    const ticket = h.requestReadback(); ticket.catch(() => {});
    const r = capture(f, () => h.renderSharedFrame(saved)); admitted(r);
    assert.equal(r.maps.length, 1); await r.finish();
    const result = await ticket; await h.whenIdle();
    assert.deepEqual([result.serial, result.frameId, result.width, result.height, result.format,
      result.sourceFormat, result.colorSpace, result.alphaMode, result.bytes.byteLength],
    [1, saved.frameId, 8, 8, 'rgba8unorm', 'rgba8unorm', 'srgb', 'opaque', 256]);
    assert.ok(result.bytes instanceof Uint8Array);
    const copy = r.events.find(c => c[0] === 'copy'); assert.ok(copy);
    assert.equal(copy[1].texture, f.canvasTextures.at(-1));
    const ps = passes(r.events); assert.equal(ps.length, 2);
    assert.equal(ps[1].descriptor.colorAttachments[0].view, f.canvasViews.at(-1));
    assert.equal(status(h).pendingColorBytes, 0);
    const staging = r.buffers.find(b => b.descriptor.usage === 9);
    assert.ok(staging); assert.deepEqual([staging.unmapped, staging.destroyed], [1, 1]);
  });
});

// Break caught: render directly to canvas, create an implicit white page, or resolve more than once.
test('GPU G07 solid pass clears one linear working target and resolves once without a white page', async () => {
  await using(async (f, a) => {
    fill(a.sprite());
    const h = f.sharedHost(); await f.ready(h);
    const r = await submit(f, h, a.capture({ ...FRAME, clearColor: 0x808080, clearAlpha: .5 }));
    const target = colorTargets(r.textures); assert.equal(target.length, 1);
    assert.equal(pageTextures(r.textures).length, 0); assert.equal(uploads(r.events).length, 0);
    const ps = passes(r.events); assert.equal(ps.length, 2);
    assert.equal(ps[0].descriptor.colorAttachments[0].view.texture, target[0]);
    const clear = ps[0].descriptor.colorAttachments[0];
    assert.equal(clear.loadOp, 'clear'); assert.equal(clear.clearValue.a, .5);
    // Permit only descriptor f32 rounding; native target quantization is a separate oracle.
    for (const c of ['r', 'g', 'b']) assert.ok(Math.abs(clear.clearValue[c] - .10793025005694963) < 1e-8);
    assert.equal(ps[1].descriptor.colorAttachments[0].view, f.canvasViews.at(-1));
    assert.equal(ps[1].draws.length, 1); assert.equal(ps[1].vertices.length, 0);
    selectedResolveTarget(ps[1].draws[0], target[0]);
    assert.equal(ps[1].draws[0].pipeline.kind, 'resolve');
    assert.equal(ps[1].draws[0].pipeline.descriptor.fragment.targets[0].format, 'rgba8unorm');
    assert.equal(ps[1].draws[0].pipeline.descriptor.fragment.targets[0].blend, undefined);
    assert.equal(r.events.filter(c => c[0] === 'submit').length, 1);
  });
});

// Break caught: drop dark coefficients, mix alpha factors, reinterpret u32 uniform fields, or upload old32B ABI.
test('GPU G08 sampled geometry selects exact 44B attributes and complete 128B uniform', async () => {
  await using(async (f, a) => {
    const page = source(new Array(32).fill(255), 4, 2);
    const item = await a.resource(page, { packed: { x: 1, y: 0, width: 2, height: 1 },
      logicalWidth: 4, logicalHeight: 3, trimX: 1, trimY: 1, quarterTurn: 0 });
    const geometry = egret.createSharedGeometry2D({
      positions: new Float32Array([1, 2, 5, 2, 1, 6]),
      uvs: new Float32Array([.125, .25, .875, .25, .125, .75]),
      lightColors: new Float32Array([.5, .25, 1, .5, .5, .25, 1, .5, .5, .25, 1, .5]),
      darkColors: new Float32Array([.25, .5, .75, .25, .5, .75, .25, .5, .75]),
      indices: new Uint16Array([0, 1, 2]),
    });
    const mesh = a.mesh(item, geometry); mesh.alpha = .25;
    mesh.sharedMaterial = egret.createSharedMaterial2D({ light: [.5, .25, 1, .5],
      dark: [.25, .5, .75], filter: 'linear', regionIsolation: 'strict' });
    const saved = a.capture(); assert.equal(saved.geometries[0], geometry);
    const h = f.sharedHost(); await f.ready(h);
    const r = await submit(f, h, saved), draws = uiPass(r).draws;
    assert.equal(draws.length, 1); const draw = draws[0];
    const layout = draw.pipeline.descriptor.vertex.buffers[0];
    assert.equal(layout.arrayStride, 44);
    assert.deepEqual(layout.attributes.map(x => [x.shaderLocation, x.offset, x.format]),
      [[0, 0, 'float32x2'], [1, 8, 'float32x2'], [2, 16, 'float32x4'], [3, 32, 'float32x3']]);
    const vertex = writes(r.events, draw.vertex); assert.equal(vertex.length, 1);
    const values = [...new Float32Array(vertex[0][3].buffer, vertex[0][3].byteOffset, vertex[0][3].byteLength / 4)];
    assert.equal(values.length, 33);
    const rows = []; for (let i = 0; i < values.length; i += 11) rows.push(values.slice(i, i + 11));
    rows.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    assert.deepEqual(rows, [
      [1, 2, .125, .25, .5, .25, 1, .5, .25, .5, .75],
      [1, 6, .125, .75, .5, .25, 1, .5, .25, .5, .75],
      [5, 2, .875, .25, .5, .25, 1, .5, .25, .5, .75],
    ]);
    expectUniform(selectedUniform(r.events, draw).bytes,
      [8, 8, .25, 0, .5, .25, 1, .5, .25, .5, .75, 0],
      [4, 3, 1, 1, 2, 1, 1, 0, 2, 1, 0, 0, 0, 0, 1, 1, 4, 2, 2, 3]);
    const entries = draw.binding.descriptor.entries;
    assert.deepEqual(entries.map(e => e.binding).sort((a, b) => a - b), [0, 1, 2]);
    assert.equal(entries.find(e => e.binding === 1).resource.texture, pageTextures(r.textures)[0]);
    assert.equal(entries.find(e => e.binding === 2).resource.descriptor.magFilter, 'linear');
  });
});

// Break caught: fold primitive alpha into display opacity twice or allocate a white page for solid.
test('GPU G09 solid layout keeps primitive alpha separate and unused uniform fields canonical', async () => {
  await using(async (f, a) => {
    const node = a.sprite(); node.alpha = .25; fill(node, 0xff0000, .5);
    const h = f.sharedHost(); await f.ready(h);
    const r = await submit(f, h, a.capture()), draws = uiPass(r).draws;
    assert.equal(draws.length, 1); const draw = draws[0];
    assert.equal(draw.pipeline.descriptor.vertex.buffers[0].arrayStride, 44);
    assert.deepEqual(draw.binding.descriptor.entries.map(e => e.binding), [0]);
    expectUniform(selectedUniform(r.events, draw).bytes,
      [8, 8, .25, 0, 1, 1, 1, 1, 0, 0, 0, 0],
      [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0]);
    const upload = writes(r.events, draw.vertex); assert.equal(upload.length, 1);
    const v = new Float32Array(upload[0][3].buffer, upload[0][3].byteOffset, upload[0][3].byteLength / 4);
    assert.equal(v.length, 66);
    for (let i = 0; i < v.length; i += 11) assert.deepEqual([...v.slice(i + 4, i + 11)], [1, 0, 0, .5, 0, 0, 0]);
    assert.equal(pageTextures(r.textures).length, 0);
  });
});

// Break caught: sort A-B-A, merge through isolate, or refund logical uniforms after a physical merge.
test('GPU G10 adjacent merge retains A-B-A and explicit barriers with original logical fees', async () => {
  for (const [sequence, expectedDraws] of [[['A', 'A'], 1], [['A', 'B', 'A'], 3], [['A', '|', 'A'], 2]]) {
    await using(async (f, a) => {
      const aa = await a.resource(source()), bb = await a.resource(source());
      for (const symbol of sequence) {
        if (symbol === '|') { const node = a.sprite(); node.renderBoundary = 'isolate'; }
        else { const node = a.bitmap(symbol === 'A' ? aa : bb); node.alpha = .5; }
      }
      const saved = a.capture(), logical = sequence.filter(x => x !== '|').length;
      if (sequence.includes('|')) assert.deepEqual(saved.commands.filter(c => c.kind === 'barrier').map(c => c.reason),
        ['explicit-enter', 'explicit-exit']);
      const h = f.sharedHost(); await f.ready(h);
      const r = capture(f, () => h.renderSharedFrame(saved)); admitted(r);
      assert.equal(h.getStatus().pendingUploadBytes, logical * 392, '6*44 + 128 per logical image');
      const ds = uiPass(r).draws; assert.equal(ds.length, expectedDraws);
      const images = ds.map(d => d.binding.descriptor.entries.find(e => e.binding === 1).resource.texture);
      if (sequence.length === 3 && !sequence.includes('|')) {
        assert.equal(images[0], images[2]); assert.notEqual(images[0], images[1]);
      }
      if (sequence.length === 2) assert.equal(ds[0].args[0], 12, 'the actual merged draw submits twelve vertices');
      await r.finish(); await h.whenIdle();
    });
  }
});

// Break caught: return a target on fence alone or before unresolved scope/map obligations.
test('GPU G11 accepted target stays exclusive while any fence, scope or map remains pending', async () => {
  for (const held of ['fence', 'scope', 'map']) {
    await using(async (f, a) => {
      fill(a.sprite()); const saved = a.capture();
      const h = f.sharedHost({ enableReadback: true }); await f.ready(h);
      const ticket = h.requestReadback(); ticket.catch(() => {});
      const first = capture(f, () => h.renderSharedFrame(saved)); admitted(first);
      assert.equal(first.fences.length, 1); assert.equal(first.scopes.length, 3); assert.equal(first.maps.length, 1);
      if (held !== 'fence') first.fences.forEach(x => x.resolve());
      first.scopes.forEach((x, i) => { if (held !== 'scope' || i !== 0) x.resolve(null); });
      if (held !== 'map') first.maps.forEach(x => x.resolve());
      await tick(); assert.equal(h.getStatus().pendingFrames, 1);
      const firstTarget = colorTargets(first.textures); assert.equal(firstTarget.length, 1);
      assert.equal(status(h).pendingColorBytes, 256); assert.equal(firstTarget[0].destroyed, 0);
      const second = capture(f, () => h.renderSharedFrame(saved)); admitted(second);
      const secondTarget = colorTargets(second.textures); assert.equal(secondTarget.length, 1);
      assert.notEqual(firstTarget[0], secondTarget[0]);
      assert.equal(passes(second.events)[0].descriptor.colorAttachments[0].view.texture, secondTarget[0]);
      assert.equal(status(h).pendingColorBytes, 512);
      await second.finish(); await first.finish(); await ticket; await h.whenIdle();
      assert.equal(status(h).pendingColorBytes, 0);
    });
  }
});

// Break caught: never reuse a settled target, reuse stale uniform contents, or destroy pooled owners twice.
test('GPU G12 settled target and buffers reuse while changed opacity uploads and close destroys once', async () => {
  await using(async (f, a) => {
    const node = a.sprite(); fill(node);
    const h = f.sharedHost(); await f.ready(h);
    const firstFrame = a.capture(), first = await submit(f, h, firstFrame);
    const firstTarget = colorTargets(first.textures); assert.equal(firstTarget.length, 1);
    assert.equal(uiPass(first).draws.length, 1);
    const firstDraw = uiPass(first).draws[0], firstUniform = selectedUniform(first.events, firstDraw);
    assert.ok(firstDraw.vertex, 'first actual vertex selection is required');
    node.alpha = .5; const next = a.capture();
    assert.notEqual(next, firstFrame); assert.notEqual(next.commands, firstFrame.commands);
    assert.equal(firstFrame.commands[0].opacity, 1); assert.equal(next.commands[0].opacity, .5);
    const warm = await submit(f, h, next);
    assert.equal(colorTargets(warm.textures).length, 0);
    assert.equal(passes(warm.events)[0].descriptor.colorAttachments[0].view.texture, firstTarget[0]);
    assert.equal(uiPass(warm).draws.length, 1);
    const warmDraw = uiPass(warm).draws[0], warmUniform = selectedUniform(warm.events, warmDraw);
    assert.ok(warmDraw.vertex, 'warm actual vertex selection is required');
    assert.equal(warmDraw.vertex, firstDraw.vertex); assert.equal(warmUniform.buffer, firstUniform.buffer);
    assert.equal(new DataView(firstUniform.bytes.buffer, firstUniform.bytes.byteOffset, firstUniform.bytes.byteLength).getFloat32(8, true), 1);
    assert.equal(new DataView(warmUniform.bytes.buffer, warmUniform.bytes.byteOffset, warmUniform.bytes.byteLength).getFloat32(8, true), .5);
    await f.close(h); await f.close(h);
    assert.ok(f.textures.length > 0); assert.ok(f.buffers.length > 0);
    assert.ok(f.textures.every(t => t.destroyed === 1)); assert.ok(f.buffers.every(b => b.destroyed === 1));
    assert.equal(h.getStatus().cleanupOutcome, 'safe');
  });
});

// Break caught: give target and buffer independent32MiB idle quotas, retry unknown destruction,
// or report device-loss cleanup as a safe borrowed-surface return.
test('GPU G13 shared retention is jointly bounded and terminal faults retain unsafe evidence', async () => {
  await using(async (f, a) => {
    fill(a.sprite()); const h = f.sharedHost(); await f.ready(h);
    const r = await submit(f, h, a.capture({ width: 4096, height: 2048 }));
    const targets = colorTargets(r.textures); assert.equal(targets.length, 1);
    assert.equal(bytesOfTexture(targets[0]), 33554432);
    assert.ok(r.buffers.some(b => b.descriptor.usage === 40)); assert.ok(r.buffers.some(b => b.descriptor.usage === 72));
    const idleBytes = f.buffers.filter(b => b.destroyed === 0).reduce((n, b) => n + b.descriptor.size, 0)
      + f.textures.filter(t => t.destroyed === 0 && !pageTextures([t]).length).reduce((n, t) => n + bytesOfTexture(t), 0);
    assert.ok(idleBytes <= 33554432, 'real idle targets plus buffers share one32MiB cap');
  });
  for (const fault of ['destroy', 'loss']) {
    await using(async (f, a) => {
      fill(a.sprite()); const h = f.sharedHost(); await f.ready(h);
      const r = await submit(f, h, a.capture()), target = colorTargets(r.textures)[0];
      assert.ok(target); const cause = Object.freeze({ fault });
      if (fault === 'destroy') f.hooks.destroyTexture = t => { if (t === target) throw cause; };
      else { f.lost.resolve(cause); await tick(); assert.equal(h.getStatus().state, 'failed'); }
      f.allowUnsafe(h); await f.close(h, true, cause); await f.close(h, true, cause);
      assert.equal(target.destroyed, 1, 'unknown/native cleanup is attempted once');
      assert.equal(h.getStatus().cleanupOutcome, 'unsafe');
      expectCode(() => h.renderSharedFrame(a.capture()), 'CLOSED');
    });
  }
});

// Break caught: accept a forged scene, use the old encoded vertex payload, clear twice, or resolve twice.
test('GPU G14 linear B1 retains scene authority and emits scene, UI, then one resolve', async () => {
  await using(async (f, a) => {
    const geometry = createMeshGeometry3D({ positions: [0, 0, -1, 1, 0, -1, 0, 1, -1],
      colors: [.5, .25, .75, .25, .75, .5, .75, .5, .25], indices: [0, 1, 2] });
    const scene = createSceneFrame3D({ projection: { kind: 'orthographic', left: -1, right: 1,
      bottom: -1, top: 1, near: 1, far: 3 }, draws: [{ geometry,
      modelView: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }] });
    assert.equal(isSceneFrame3D(scene), true);
    const sprite = a.sprite(); fill(sprite, 0xff0000, .5);
    const overlay = a.capture({ ...FRAME, outputAlpha: 'opaque', clearAlpha: 1 });
    const h = f.sharedHost({ outputAlpha: 'opaque' }, true); await f.ready(h);
    let reads = 0; const fake = { ...scene };
    Object.defineProperty(fake, 'draws', { get() { reads++; throw new Error('fake scene'); } });
    refusal(f, h, () => h.renderSceneSharedFrame(fake, overlay), 'FRAME_INVALID');
    refusal(f, h, () => h.renderSceneSharedFrame(scene, a.capture()), 'FRAME_PROFILE_UNSUPPORTED');
    assert.equal(reads, 0);
    const r = await submit(f, h, overlay, value => h.renderSceneSharedFrame(scene, value));
    const ps = passes(r.events); assert.equal(ps.length, 3);
    const working = colorTargets(r.textures); assert.equal(working.length, 1);
    assert.equal(ps[0].descriptor.colorAttachments[0].view.texture, working[0]);
    assert.equal(ps[0].descriptor.colorAttachments[0].loadOp, 'clear');
    assert.equal(ps[0].descriptor.depthStencilAttachment.depthClearValue, 0);
    assert.equal(ps[1].descriptor.depthStencilAttachment, undefined);
    assert.equal(ps[1].descriptor.colorAttachments[0].loadOp, 'load');
    assert.equal(ps[1].descriptor.colorAttachments[0].view.texture, working[0]);
    assert.equal(ps[2].descriptor.colorAttachments[0].view, f.canvasViews.at(-1));
    assert.equal(ps[0].draws.length, 1); assert.equal(ps[0].draws[0].kind, 'drawIndexed');
    assert.equal(ps[1].draws.length, 1); assert.equal(ps[2].draws.length, 1);
    selectedResolveTarget(ps[2].draws[0], working[0]);
    const sceneDraw = ps[0].draws[0];
    assert.equal(sceneDraw.pipeline.descriptor.depthStencil.depthCompare, 'greater');
    assert.equal(sceneDraw.pipeline.descriptor.depthStencil.depthWriteEnabled, true);
    assert.equal(sceneDraw.pipeline.descriptor.fragment.targets[0].format, 'rgba8unorm-srgb');
    const w = writes(r.events, sceneDraw.vertex); assert.equal(w.length, 1);
    const v = [...new Float32Array(w[0][3].buffer, w[0][3].byteOffset, w[0][3].byteLength / 4)];
    assert.equal(v.length, 18);
    assert.deepEqual(v.slice(3, 6), [.21404114365577698, .05087608844041824, .5225215554237366]);
    assert.deepEqual(v.slice(9, 12), [.05087608844041824, .5225215554237366, .21404114365577698]);
    assert.deepEqual(v.slice(15, 18), [.5225215554237366, .21404114365577698, .05087608844041824]);
    assert.equal(r.events.filter(c => c[0] === 'submit').length, 1);
    assert.deepEqual([h.getSceneStatus().pendingSceneBytes, h.getSceneStatus().pendingUniformBytes,
      h.getSceneStatus().pendingDepthBytes], [0, 0, 0]);
  });
});

// Evidence boundaries:
// - The base fixture does not execute shaders or rasterize. Literal conversion
//   bytes and selected upload/pass identities are controls, not native pixel proof.
// - No public API exposes reserved/unknown pool internals; G13 sees actual native
//   owners plus unsafe close. Detailed atomic reservation/unknown charges need the
//   separately reviewed finite private retention UNIT, not invented public keys.
// - Exact blending/filtering/quality tolerances require the independent native
//   schedule. No test here substitutes mock output bytes for those observations.

// Break caught: drop an allocated target and refund its charge when its cleanup
// method cannot be captured before registration. This is a controlled port fault.
test('GPU G15 unregistered target cleanup failure retains its pending ownership charge', async () => {
  await using(async (f, a) => {
    fill(a.sprite()); const saved=a.capture(),h=f.sharedHost();await f.ready(h);
    const cause=Object.freeze({fault:'raw-target-destroy-getter'});let reads=0;
    f.hooks.destroyGetter=texture=>{
      if(colorTargets([texture]).length){reads++;throw cause;}
    };
    f.allowUnsafe(h);
    const attempt=capture(f,()=>h.renderSharedFrame(saved));
    assert.equal(attempt.threw,true);assert.equal(attempt.error.cause,cause);
    const targets=colorTargets(attempt.textures);assert.equal(targets.length,1);
    assert.equal(reads,1);assert.equal(targets[0].destroyed,0);
    await attempt.finish();await f.close(h,true,cause);
    assert.equal(h.getStatus().cleanupOutcome,'unsafe');
    assert.equal(h.getSharedStatus().pendingColorBytes,256,
      'unknown allocation remains charged even when capture failed before pool registration');
    assert.equal(h.getStatus().pendingFrames,1,'the raw target owner remains retained');
    await f.close(h,true,cause);
    assert.equal(reads,1,'terminal cleanup cannot guess or re-read a failed method');
    assert.equal(targets[0].destroyed,0);
    assert.equal(h.getSharedStatus().pendingColorBytes,256);
    expectCode(()=>h.renderSharedFrame(saved),'CLOSED');
  });
});
