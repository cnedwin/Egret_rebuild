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
/** The page textures a batch of several pages binds for its eight units, in unit order: binding 1, then bindings 3 to 9. */
function unitTextures(draw) {
  const entries = draw.binding.descriptor.entries;
  assert.deepEqual(entries.map(e => e.binding).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  return [1, 3, 4, 5, 6, 7, 8, 9].map(binding => entries.find(e => e.binding === binding).resource.texture);
}
/** The rows of the first `count` regions in the window a sampled draw has bound as its second group. */
function regionRows(events, draw, count) {
  assert.ok(draw.region, 'a sampled draw binds a window of the region table');
  const entries = draw.region.descriptor.entries;
  assert.deepEqual(entries.map(e => e.binding), [0]);
  assert.equal(draw.region.descriptor.layout, draw.pipeline.getBindGroupLayout(1));
  assert.deepEqual([entries[0].resource.offset % 16384, entries[0].resource.size], [0, 16368]);
  const table = writes(events, entries[0].resource.buffer);
  // One write of whole windows: the last is 16,368 bytes, each one before it 16,384.
  assert.equal(table.length, 1); assert.equal(table[0][2], 0); assert.equal((table[0][3].byteLength - 16368) % 16384, 0);
  const words = new Uint32Array(table[0][3].buffer, table[0][3].byteOffset + entries[0].resource.offset, 12 * count);
  return Array.from({ length: count }, (_value, index) => [...words.subarray(12 * index, 12 * index + 12)]);
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

// Break caught: a page option is coerced, or admitted above what the profile lets a frame hold.
test('GPU G01 page options may only lower the profile bounds and refuse before native startup', async () => {
  await withPorts(async f => {
    const make = requireFactory(false), before = f.calls.length;
    const bounds = { maxFrameRegions: 4096, maxFramePageBytes: 67108864, maxReadyPageBytes: 134217728 };
    for (const [key, bound] of Object.entries(bounds)) {
      for (const value of [0, -1, 0.5, NaN, Infinity, bound + 1, '1', null])
        expectCode(() => make(f.options({ [key]: value })), 'OPTIONS_INVALID');
    }
    assert.equal(f.calls.length, before);
    for (const value of [{ maxFrameRegions: 1, maxFramePageBytes: 1, maxReadyPageBytes: 1 }, bounds]) {
      const h = f.sharedHost(value, false); await f.ready(h); await f.close(h);
    }
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
    refusal(f, h, () => h.renderSharedFrame(Object.freeze({ frameId: 1, width: FRAME.width, height: FRAME.height, clearColor: 0, clearAlpha: 0, commands: Object.freeze([]) })), 'FRAME_PROFILE_UNSUPPORTED');
    assert.equal(reads, 0);
    const accepted = await submit(f, h, saved);
    assert.equal(passes(accepted.events).length, 2); assert.equal(h.getStatus().lastSerial, 1);
  });
});

// Break caught: a Host table or loop still sized for the earlier 128 regions of one frame.
test('GPU G03 a frame of 4096 distinct regions of one page is admitted and submitted', async () => {
  await using(async (f, a) => {
    const h = f.sharedHost(); await f.ready(h);
    const page = egret.createImageData2D({ width: 4096, height: 1, pixels: new Uint8Array(4096 * 4).fill(255) });
    for (let x = 0; x < 4096; x++) a.bitmap(await a.resource(page, region(x)));
    const frame = a.capture();
    assert.equal(frame.pages.length, 1); assert.equal(frame.regions.length, 4096); assert.equal(frame.commands.length, 4096);
    const accepted = await submit(f, h, frame);
    assert.equal(h.getStatus().pendingFrames, 0); assert.equal(h.getStatus().lastSerial, 1);
    assert.ok(passes(accepted.events).length >= 1);
    // One more distinct region is refused where the frame is made, before any Host sees it.
    a.bitmap(await a.resource(page, { ...region(0), logicalWidth: 2 }));
    assert.throws(() => a.capture(), e => e instanceof egret.EgretError && e.code === 'FRAME_IMAGE_BUDGET');
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
    assert.equal(sampled.length, 1, 'two regions of one page are one batch');
    assert.deepEqual(sampled[0].args, [12]);
    const selected = sampled.map(draw => draw.binding.descriptor.entries.find(e => e.binding === 1).resource.texture);
    assert.equal(selected[0], pageTextures(r.textures)[0]);
    // The batch reads both regions through one window of the region table, bound as the second group.
    // Each row ends with the region's page and that page's size: page 0, two texels by one.
    assert.deepEqual(regionRows(r.events, sampled[0], 2), [[1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 2, 1], [1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 2, 1]]);
    // A batch of one page binds a block, that page and a sampler, as its pipeline declares.
    assert.deepEqual(sampled[0].binding.descriptor.entries.map(e => e.binding).sort((a, b) => a - b), [0, 1, 2]);
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
    // The two bitmaps are one batch of two pages: the first two units hold the two owners, the other units the first again.
    const draws = uiPass(r).draws; assert.equal(draws.length, 1); assert.deepEqual(draws[0].args, [12]);
    const units = unitTextures(draws[0]);
    assert.deepEqual(new Set(units.slice(0, 2)), new Set(pages)); assert.notEqual(units[0], units[1]);
    assert.deepEqual(units.slice(2), Array(6).fill(units[0]));
    const words = new Uint32Array(selectedUniform(r.events, draws[0]).bytes.slice().buffer, 48, 8);
    assert.deepEqual([...words], [0, 1, ...Array(6).fill(4294967295)]);
    assert.deepEqual(regionRows(r.events, draws[0], 2).map(row => row.slice(8)), [[0, 0, 2, 1], [0, 1, 2, 1]]);
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
test('GPU G08 sampled geometry selects exact 52B attributes, the 128B uniform of its batch and its row of the region table', async () => {
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
    assert.equal(layout.arrayStride, 52);
    assert.deepEqual(layout.attributes.map(x => [x.shaderLocation, x.offset, x.format]),
      [[0, 0, 'float32x2'], [1, 8, 'float32x2'], [2, 16, 'float32x4'], [3, 32, 'float32x3'], [4, 44, 'float32x2']]);
    const vertex = writes(r.events, draw.vertex); assert.equal(vertex.length, 1);
    const values = [...new Float32Array(vertex[0][3].buffer, vertex[0][3].byteOffset, vertex[0][3].byteLength / 4)];
    assert.equal(values.length, 39);
    const rows = []; for (let i = 0; i < values.length; i += 13) rows.push(values.slice(i, i + 13));
    rows.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    // The last two values of a row: the region's place in its window, and the opacity of the draw.
    assert.deepEqual(rows, [
      [1, 2, .125, .25, .5, .25, 1, .5, .25, .5, .75, 0, .25],
      [1, 6, .125, .75, .5, .25, 1, .5, .25, .5, .75, 0, .25],
      [5, 2, .875, .25, .5, .25, 1, .5, .25, .5, .75, 0, .25],
    ]);
    // The block holds neither opacity, region nor page size: only viewport, material, the pages of the eight units,
    // domain, sampler policy, and the kind of draw and its sampling strategy.
    const none = 4294967295;
    expectUniform(selectedUniform(r.events, draw).bytes,
      [8, 8, 0, 0, .5, .25, 1, .5, .25, .5, .75, 0],
      [0, none, none, none, none, none, none, none, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 2, 3]);
    // The region is its row of the table: logical extent and trim, content extent and packed origin, quarter turn,
    // then its page and the page's width and height.
    assert.deepEqual(regionRows(r.events, draw, 1), [[4, 3, 1, 1, 2, 1, 1, 0, 0, 0, 4, 2]]);
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
    assert.equal(draw.pipeline.descriptor.vertex.buffers[0].arrayStride, 52);
    assert.deepEqual(draw.binding.descriptor.entries.map(e => e.binding), [0]);
    expectUniform(selectedUniform(r.events, draw).bytes,
      [8, 8, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0]);
    const upload = writes(r.events, draw.vertex); assert.equal(upload.length, 1);
    const v = new Float32Array(upload[0][3].buffer, upload[0][3].byteOffset, upload[0][3].byteLength / 4);
    assert.equal(v.length, 78);
    // The primitive's alpha stays the light alpha; the node's opacity is the last value of the row.
    for (let i = 0; i < v.length; i += 13) assert.deepEqual([...v.slice(i + 4, i + 13)], [1, 0, 0, .5, 0, 0, 0, 0, .25]);
    assert.equal(pageTextures(r.textures).length, 0);
    // A draw without a region binds no second group, and the frame uploads no region table.
    assert.equal(draw.region, undefined);
    assert.equal(r.events.filter(c => c[0] === 'setBindGroup' && c[1] === 1).length, 0);
    assert.equal(writes(r.events).filter(c => c[3].byteLength >= 16368).length, 0);
  });
});

// Break caught: sort A-B-A, merge through isolate, or refund logical uniforms after a physical merge.
test('GPU G10 adjacent merge joins A-B-A across pages, keeps explicit barriers, and charges the original logical fees', async () => {
  for (const [sequence, expectedDraws] of [[['A', 'A'], 1], [['A', 'B', 'A'], 1], [['A', '|', 'A'], 2]]) {
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
      assert.equal(h.getStatus().pendingUploadBytes, logical * 440 + saved.regions.length * 48, '6*52 + 128 per logical image, and 48 per region of the frame');
      const ds = uiPass(r).draws; assert.equal(ds.length, expectedDraws);
      if (sequence.length === 3 && !sequence.includes('|')) {
        // One draw of eighteen vertices; page A is the first unit and page B the second, in the order they are first drawn.
        assert.equal(ds[0].args[0], 18);
        const units = unitTextures(ds[0]), pages = pageTextures(r.textures);
        assert.equal(pages.length, 2); assert.notEqual(units[0], units[1]);
        assert.deepEqual(new Set(units.slice(0, 2)), new Set(pages)); assert.deepEqual(units.slice(2), Array(6).fill(units[0]));
        assert.deepEqual(regionRows(r.events, ds[0], 2).map(row => row[9]), [0, 1]);
        const upload = writes(r.events, ds[0].vertex)[0][3], v = new Float32Array(upload.buffer, upload.byteOffset, upload.byteLength / 4);
        // The vertices name regions 0, 1, 0: the row of a region names its page.
        assert.deepEqual(Array.from({ length: 3 }, (_value, index) => v[13 * 6 * index + 11]), [0, 1, 0]);
      }
      if (sequence.length === 2) assert.equal(ds[0].args[0], 12, 'the actual merged draw submits twelve vertices');
      await r.finish(); await h.whenIdle();
    });
  }
});

// Break caught: keep the region or the opacity in the batch key, bind a window per draw, or read the table without one.
test('GPU G10 draws of different regions and opacities of one page are one draw through one window of the region table', async () => {
  await using(async (f, a) => {
    const page = source([255, 0, 0, 255, 0, 255, 0, 255]);
    const left = await a.resource(page, region(0)), right = await a.resource(page, region(1));
    const opacities = [1, .5, .25];
    [left, right, left].forEach((item, index) => { const node = a.bitmap(item); node.x = 2 * index; node.alpha = opacities[index]; });
    const solid = a.sprite(); fill(solid); solid.alpha = .75;
    const saved = a.capture();
    assert.deepEqual(saved.commands.map(c => c.kind), ['image', 'image', 'image', 'rect']);
    assert.equal(saved.regions.length, 2);
    const h = f.sharedHost(); await f.ready(h);
    const r = capture(f, () => h.renderSharedFrame(saved)); admitted(r);
    // Fees are those of four logical draws and two regions, whatever is merged.
    assert.equal(h.getStatus().pendingUploadBytes, 4 * 440 + 2 * 48);
    const pass = uiPass(r), ds = pass.draws;
    // Three images in one draw, then the rectangle with its own pipeline.
    assert.deepEqual(ds.map(d => d.args), [[18], [6]]);
    assert.notEqual(ds[0].pipeline, ds[1].pipeline);
    // The window is bound once, for the sampled draw only.
    assert.equal(pass.regions.length, 1); assert.equal(pass.bindings.length, 2);
    assert.equal(ds[0].region, pass.regions[0]);
    assert.deepEqual(regionRows(r.events, ds[0], 2), [[1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 2, 1], [1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 2, 1]]);
    assert.equal(ds[0].region.descriptor.entries[0].resource.offset, 0);
    const upload = writes(r.events, ds[0].vertex); assert.equal(upload.length, 1);
    const v = new Float32Array(upload[0][3].buffer, upload[0][3].byteOffset, upload[0][3].byteLength / 4);
    assert.equal(v.length, 18 * 13);
    // Each vertex names its region and the opacity of its draw.
    assert.deepEqual(Array.from({ length: 18 }, (_value, vertex) => [v[13 * vertex + 11], v[13 * vertex + 12]]),
      [0, 1, 2].flatMap(index => Array(6).fill([index === 1 ? 1 : 0, opacities[index]])));
    const solidRows = writes(r.events, ds[1].vertex)[0][3], s = new Float32Array(solidRows.buffer, solidRows.byteOffset, solidRows.byteLength / 4);
    assert.deepEqual([s[11], s[12]], [0, .75]);
    await r.finish(); await h.whenIdle();
  });
});

// Break caught: create the region table on a device whose largest buffer is smaller than one window.
test('GPU G10 a device whose largest buffer cannot hold one window of the region table refuses a sampled frame before native work', async () => {
  for (const [maxBufferSize, admitted] of [[16367, false], [16368, true]]) {
    await using(async (f, a) => {
      f.limits.maxBufferSize = maxBufferSize;
      const node = a.bitmap(await a.resource()), sampled = a.capture();
      node.visible = false; fill(a.sprite()); const solid = a.capture();
      const h = f.sharedHost(); await f.ready(h);
      if (admitted) assert.equal(uiPass(await submit(f, h, sampled)).draws.length, 1);
      else refusal(f, h, () => h.renderSharedFrame(sampled), 'DEVICE_LIMIT');
      // A frame without a draw that has a region needs no table.
      assert.equal(uiPass(await submit(f, h, solid)).draws.length, 1);
    });
  }
});

// Break caught: start on a device that cannot hold a 52-byte vertex of five attributes, a second group for the region window,
// or the eight pages of a batch.
test('GPU G10 a device one below any limit the batched layout needs is refused at startup, before a pipeline is made', async () => {
  const needed = { maxVertexAttributes: 5, maxVertexBufferArrayStride: 52, maxUniformBufferBindingSize: 16368, maxInterStageShaderVariables: 8,
    maxBindGroups: 2, maxUniformBuffersPerShaderStage: 2, maxBindGroupsPlusVertexBuffers: 3, maxBindingsPerBindGroup: 10, maxSampledTexturesPerShaderStage: 8 };
  for (const [key, least] of Object.entries(needed)) {
    await withPorts(async f => {
      // The fixture's device has exactly the least value of each; a Host starts on it.
      assert.equal(f.limits[key], least);
      f.limits[key] = least - 1;
      const h = f.sharedHost(), start = h.start(); start.catch(() => {});
      await f.pump();
      await assert.rejects(start, hasCode('DEVICE_LIMIT'), key);
      assert.equal(f.pipelines.length, 0, key); assert.equal(f.textures.length, 0, key);
      assert.equal(h.getStatus().state, 'failed');
      await f.close(h);
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

// A pending GPU fence must not consume the CPU space needed to join the next frame.
test('GPU G18 direct dense frames keep one batch while a preceding frame is pending', async () => {
  await using(async (f, a) => {
    const texture = await a.resource();
    const count = 14_000;
    const firstBitmap = a.bitmap(texture);
    for (let index = 1; index < count; index++) a.bitmap(texture);
    const h = f.sharedHost({ maxPendingFrames: 2 });
    await f.ready(h);

    const first = capture(f, () => h.renderSharedFrame(a.capture()));
    admitted(first);
    assert.equal(first.fences.length, 1);
    first.scopes.forEach(scope => scope.resolve(null));
    await tick();
    assert.equal(h.getStatus().pendingFrames, 1);

    firstBitmap.x = 1;
    const frame = a.capture();
    const second = capture(f, () => h.renderSharedFrame(frame));
    admitted(second);
    assert.equal(h.getStatus().pendingFrames, 2);
    const [firstDraw] = uiPass(first).draws;
    const [secondDraw] = uiPass(second).draws;
    assert.equal(uiPass(first).draws.length, 1);
    assert.equal(uiPass(second).draws.length, 1);
    assert.notEqual(firstDraw.vertex, secondDraw.vertex);
    assert.equal(firstDraw.vertex.destroyed, 0);

    const rows = (record, draw) => {
      const [write] = writes(record.events, draw.vertex);
      const bytes = write[3];
      assert.equal(bytes.byteLength, count * 6 * 52);
      return bytes;
    };
    const before = rows(first, firstDraw), after = rows(second, secondDraw);
    const firstSpriteSize = 6 * 52;
    assert.notDeepEqual(before.subarray(0, firstSpriteSize), after.subarray(0, firstSpriteSize));
    assert.deepEqual(before.subarray(firstSpriteSize), after.subarray(firstSpriteSize));
    refusal(f, h, () => h.renderSharedFrame(frame), 'BACKPRESSURE');
    await second.finish();
    await first.finish();
    await h.whenIdle();
    assert.equal(h.getStatus().pendingFrames, 0);
  });
});

// Break caught: never reuse a settled target, reuse stale uniform contents, or destroy pooled owners twice.
test('GPU G12 settled target and buffers reuse while changed opacity uploads in the vertex rows and close destroys once', async () => {
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
    // The opacity is the last value of every vertex row; the block is the same bytes in both frames.
    assert.deepEqual([...warmUniform.bytes], [...firstUniform.bytes]);
    const opacity = (record, draw) => { const rows = writes(record.events, draw.vertex); assert.equal(rows.length, 1);
      const values = new Float32Array(rows[0][3].buffer, rows[0][3].byteOffset, rows[0][3].byteLength / 4);
      return Array.from({ length: values.length / 13 }, (_value, vertex) => values[13 * vertex + 12]); };
    assert.deepEqual(opacity(first, firstDraw), Array(6).fill(1));
    assert.deepEqual(opacity(warm, warmDraw), Array(6).fill(.5));
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
