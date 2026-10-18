// SPDX-License-Identifier: Apache-2.0
// Public Engine capture controls; no GPU execution is implied.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { literalProvider, request } from './text-raster-public-helpers.mjs';

const FRAME = Object.freeze({ width: 64, height: 48 });
const IDENTITY = Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
let resourceOrdinal = 0;
const hasCode = code => error => error instanceof egret.EgretError && error.code === code;
const expectCode = (run, code) => assert.throws(run, hasCode(code));

function requireCapture(engine) {
  assert.equal(typeof engine.captureSharedFrame, 'function',
    'Shared capture capability absent; availability assertion is not a semantic RED');
  assert.equal(egret.SHARED_FRAME_PROFILE_2D, 'egret.shared-frame2d/1');
}
function requireFactory(name) {
  assert.equal(typeof egret[name], 'function', 'Required public CPU input: ' + name);
  return egret[name];
}
function source(width = 8, height = 8, red = 73) {
  const pixels = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set([red, 37, 19, 255], offset);
  return egret.createImageData2D({ width, height, pixels });
}
function viewInput(overrides = {}) {
  return { packed: { x: 1, y: 2, width: 2, height: 3 },
    logicalWidth: 7, logicalHeight: 8, trimX: 1, trimY: 2, quarterTurn: 1, ...overrides };
}
function geometry(empty = false) {
  const make = requireFactory('createSharedGeometry2D');
  return make({
    positions: new Float64Array(empty ? [] : [0, 0, 4, 0, 0, 4]),
    uvs: new Float64Array(empty ? [] : [0, 0, 1, 0, 0, 1]),
    lightColors: new Float64Array(empty ? [] : [1, .5, .25, .5, 1, .5, .25, .5, 1, .5, .25, .5]),
    darkColors: new Float64Array(empty ? [] : [.25, .5, .75, .25, .5, .75, .25, .5, .75]),
    indices: new Uint16Array(empty ? [] : [0, 1, 2]),
  });
}
function fill(sprite, color = 0x204060, alpha = 1, rect = { x: 0, y: 0, width: 2, height: 3 }) {
  sprite.graphics.beginFill(color, alpha).drawRect(rect.x, rect.y, rect.width, rect.height).endFill();
}
async function withScene(body, { renderer = false, render } = {}) {
  const calls = [], diagnostics = [], resources = [], timers = new Set();
  const host = {
    surface: {}, start() {}, stop() {}, async close() {},
    setTimeout(callback, delay) {
      const timer = { callback, delay }; timers.add(timer); return () => timers.delete(timer);
    },
    ...(renderer ? {
      sharedFrameProfile: 'egret.shared-frame2d/1',
      renderSharedFrame(frame) { calls.push(frame); if (render) return render(frame); return undefined; },
    } : {}),
  };
  const options = { host, clock: { maxDeltaSeconds: 1 }, onDiagnostic: value => diagnostics.push(value) };
  const engine = renderer
    ? await egret.createEngineForProfile(options, 'egret.shared-frame2d/1')
    : await egret.createEngine(options);
  const scope = engine.createScope();
  const f = {
    engine, scope, calls, diagnostics,
    capture(options = FRAME) { requireCapture(engine); return engine.captureSharedFrame(options); },
    add(node, parent = engine.stage) { scope.use(node); parent.addChild(node); return node; },
    sprite(parent = engine.stage) { return f.add(new egret.Sprite(), parent); },
    bitmap(item, parent = engine.stage) { return f.add(new egret.Bitmap(item.lease), parent); },
    mesh(item, owned, parent = engine.stage) { return f.add(new egret.Mesh2D(item.lease, owned), parent); },
    async resource(image = source(), region) {
      const texture = region === undefined ? egret.createTexture(image)
        : requireFactory('createTextureView')(image, region);
      const record = { image, texture, lease: undefined, disposals: 0 };
      resources.push(record);
      const type = egret.createAssetType('shared-capture-' + (++resourceOrdinal), egret.isTexture);
      engine.assets.register(type, {
        async load() { return texture; },
        dispose(value) { record.disposals++; value.dispose(); },
      });
      record.ref = egret.createAssetRef(type, 'shared-capture-texture-' + resourceOrdinal);
      record.lease = scope.use(await engine.assets.acquire(record.ref, { signal: scope.signal }));
      return record;
    },
  };
  try {
    assert.ok(engine instanceof egret.Engine);
    assert.ok(scope instanceof egret.Scope);
    return await body(f);
  } finally {
    scope.dispose();
    await engine.dispose();
    assert.equal(scope.state, 'closed');
    assert.equal(timers.size, 0);
    for (const item of resources) {
      if (item.lease !== undefined) {
        assert.equal(item.disposals, 1);
        assert.equal(item.texture.isDisposed, true);
      } else item.texture.dispose();
    }
  }
}

test('CAPTURE C01 pure capture shares the frame counter and does not advance the public clock', async () => {
  await withScene(async f => {
    requireCapture(f.engine);
    let ticks = 0;
    f.engine.clock.onTick(f.scope, () => { ticks++; });
    f.engine.advanceTime(10);
    f.engine.advanceTime(10.125);
    assert.equal(ticks, 1);
    assert.equal(f.engine.clock.elapsedSeconds, .125);
    const first = f.capture(), second = f.capture();
    const ordinary = f.engine.captureFrame(FRAME), textured = f.engine.captureTexturedFrame(FRAME);
    assert.deepEqual([first.frameId, second.frameId, ordinary.frameId, textured.frameId], [1, 2, 3, 4]);
    assert.deepEqual([ticks, f.engine.clock.elapsedSeconds, f.calls.length], [1, .125, 0]);
    assert.equal(first.profile, 'egret.shared-frame2d/1');
    assert.deepEqual([first.width, first.height, first.clearColor, first.clearAlpha, first.outputAlpha],
      [64, 48, 0, 0, 'premultiplied']);
    for (const name of ['commands', 'pages', 'regions', 'materials', 'geometries']) {
      assert.deepEqual(first[name], []);
      assert.notEqual(first[name], second[name]);
      assert.ok(Object.isFrozen(first[name])); assert.ok(Object.isFrozen(second[name]));
    }
    assert.notEqual(first, second); assert.ok(Object.isFrozen(first)); assert.ok(Object.isFrozen(second));
    assert.equal(f.diagnostics.length, 0);
  });
});

test('CAPTURE C02 complete option read precedes validation and failed capture does not consume ID', async () => {
  await withScene(async f => {
    requireCapture(f.engine);
    const trace = [], cause = Object.freeze({ optionFailure: true });
    const input = Object.defineProperties({}, Object.fromEntries([
      'width', 'height', 'clearColor', 'clearAlpha', 'outputAlpha',
    ].map(name => [name, { get() {
      trace.push(name);
      if (name === 'outputAlpha') throw cause;
      return name === 'width' ? -1 : undefined;
    } }])));
    assert.throws(() => f.capture(input), error =>
      hasCode('INVALID_FRAME_OPTIONS')(error) && error.cause === cause);
    assert.deepEqual(trace, ['width', 'height', 'clearColor', 'clearAlpha', 'outputAlpha']);
    for (const patch of [{ width: 0 }, { clearAlpha: NaN }, { outputAlpha: 'encoded' },
      { outputAlpha: 'opaque', clearAlpha: 0 }]) {
      expectCode(() => f.capture({ ...FRAME, ...patch }), 'INVALID_FRAME_OPTIONS');
    }
    const unknown = { ...FRAME, outputAlpha: 'opaque' };
    Object.defineProperty(unknown, 'shader', { get() { throw new Error('unknown option read'); } });
    const first = f.capture(unknown);
    assert.equal(first.frameId, 1); assert.equal(first.clearAlpha, 1);
    assert.equal(first.outputAlpha, 'opaque'); assert.equal(f.calls.length, 0);
  });
});

test('CAPTURE C03 no renderer refusal precedes option reads but pure capture remains available', async () => {
  await withScene(async f => {
    requireCapture(f.engine);
    assert.equal(typeof f.engine.renderSharedFrame, 'function');
    let reads = 0;
    const input = { get width() { reads++; throw new Error('must not read'); } };
    expectCode(() => f.engine.renderSharedFrame(input), 'RENDERER_REQUIRED');
    assert.equal(reads, 0);
    assert.equal(f.capture().frameId, 1);
    assert.equal(f.calls.length, 0);
  });
});

test('CAPTURE C04 capture reentry and clock reentry refuse without spending completion IDs', async () => {
  await withScene(async f => {
    requireCapture(f.engine);
    let nested;
    const first = f.capture({ get width() {
      try { f.capture(); } catch (error) { nested = error; }
      return 64;
    }, height: 48 });
    assert.ok(hasCode('FRAME_REENTRANT')(nested)); assert.equal(first.frameId, 1);
    let duringTick;
    f.engine.clock.onTick(f.scope, () => {
      try { f.capture(); } catch (error) { duringTick = error; }
    });
    f.engine.advanceTime(10); f.engine.advanceTime(10.125);
    assert.ok(hasCode('CLOCK_REENTRANT')(duringTick));
    assert.equal(f.capture().frameId, 2);
  });
});

test('CAPTURE C05 renderer sees one completed frozen frame and failure consumes only its issued ID', async () => {
  const cause = Object.freeze({ hostFailure: true });
  await withScene(async f => {
    requireCapture(f.engine);
    assert.equal(typeof f.engine.renderSharedFrame, 'function');
    assert.throws(() => f.engine.renderSharedFrame(FRAME), error =>
      hasCode('FRAME_RENDER_FAILED')(error) && error.cause === cause);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].frameId, 1); assert.ok(Object.isFrozen(f.calls[0]));
    const next = f.capture(); assert.equal(next.frameId, 2);
    assert.equal(f.calls.length, 1, 'capture does not call the host');
  }, { renderer: true, render() { throw cause; } });
});

function draws(frame) { return frame.commands.filter(command => command.kind !== 'barrier'); }
function drawRegion(frame, command) { return frame.regions[command.regionIndex]; }
function drawSource(frame, command) { return frame.pages[drawRegion(frame, command).pageIndex].source; }
function assertFrozenFrame(frame) {
  const objects = [frame, frame.commands, frame.pages, frame.regions, frame.materials, frame.geometries];
  for (const page of frame.pages) objects.push(page, page.source);
  for (const region of frame.regions) objects.push(region, region.packed);
  for (const material of frame.materials) objects.push(material, material.light, material.dark);
  for (const geometry of frame.geometries) {
    objects.push(geometry, geometry.positions, geometry.uvs, geometry.lightColors, geometry.indices);
    if (geometry.darkColors !== undefined) objects.push(geometry.darkColors);
  }
  for (const command of frame.commands) {
    objects.push(command);
    if (command.kind !== 'barrier') {
      objects.push(command.matrix, command.clips);
      if (command.rect !== undefined) objects.push(command.rect);
      for (const clip of command.clips) objects.push(clip, clip.matrix, clip.rect);
    }
  }
  for (const value of objects) assert.ok(Object.isFrozen(value), 'saved public record is immutable');
  assert.deepEqual(frame.commands.map(command => command.ordinal),
    Array.from({ length: frame.commands.length }, (_, index) => index));
}
const materialKeys = ['light', 'dark', 'blend', 'samplingDomain', 'filter', 'addressU',
  'addressV', 'regionIsolation', 'mipLevel', 'minFilter', 'magFilter', 'maxAnisotropy'];
const materialValues = value => Object.fromEntries(materialKeys.map(key => [key, value[key]]));

test('CAPTURE C06 material inherits as a complete value and null resets inheritance', async () => {
  await withScene(async f => {
    const make = requireFactory('createSharedMaterial2D');
    const parentMaterial = make({ light: [.5, .25, 1, .5], dark: [.25, .5, 0],
      blend: 'screen', filter: 'linear' });
    const equalMaterial = make({ light: [.5, .25, 1, .5], dark: [.25, .5, 0],
      blend: 'screen', filter: 'linear' });
    const identity = make({});
    const parent = f.sprite(); parent.sharedMaterial = parentMaterial; parent.alpha = .5;
    fill(parent, 0x112233, .25);
    const inherited = f.sprite(parent); inherited.alpha = .5; fill(inherited, 0x445566, .5);
    const override = f.sprite(parent); override.sharedMaterial = identity; fill(override, 0x778899, .75);
    const equivalent = f.sprite(parent); equivalent.sharedMaterial = equalMaterial; fill(equivalent, 0xaabbcc);
    const saved = f.capture();
    assert.deepEqual(saved.commands.map(c => c.kind), ['rect', 'rect', 'rect', 'rect']);
    assert.deepEqual(saved.commands.map(c => c.materialIndex), [0, 0, 1, 0]);
    assert.equal(saved.materials.length, 2);
    assert.equal(saved.materials[0], parentMaterial, 'first complete equal material supplies the table row');
    assert.equal(saved.materials[1], identity);
    assert.notEqual(parentMaterial, equalMaterial);
    assert.deepEqual(saved.commands.map(c => c.opacity), [.5, .25, .5, .5]);
    assert.deepEqual(saved.commands.map(c => c.fillAlpha), [.25, .5, .75, 1]);
    assert.deepEqual(saved.commands.map(c => c.fillColor), [0x112233, 0x445566, 0x778899, 0xaabbcc]);
    assert.deepEqual(materialValues(saved.materials[1]), {
      light: [1, 1, 1, 1], dark: [0, 0, 0], blend: 'normal', samplingDomain: 'region',
      filter: 'nearest', addressU: 'clamp-to-edge', addressV: 'clamp-to-edge',
      regionIsolation: 'bounded', mipLevel: 0, minFilter: 'nearest', magFilter: 'nearest', maxAnisotropy: 1,
    }, 'local identity replaces the whole parent value, including dark/blend/filter');
    override.sharedMaterial = null;
    const reset = f.capture();
    assert.deepEqual(reset.commands.map(c => c.materialIndex), [0, 0, 0, 0]);
    assert.deepEqual(reset.materials, [parentMaterial]);
    assert.deepEqual(saved.commands.map(c => c.materialIndex), [0, 0, 1, 0]);
    assert.equal(saved.materials[1], identity);
    assertFrozenFrame(saved); assertFrozenFrame(reset);
  });
});

test('CAPTURE C07 each Graphics primitive keeps encoded color and alpha separate from display opacity', async () => {
  await withScene(async f => {
    const parent = f.sprite(); parent.alpha = .5;
    const node = f.sprite(parent); node.alpha = .25;
    node.sharedMaterial = requireFactory('createSharedMaterial2D')({ light: [1, 1, 1, .5] });
    fill(node, 0x204080, .25, { x: 1, y: 2, width: 3, height: 4 });
    fill(node, 0x804020, .75, { x: 5, y: 6, width: 7, height: 8 });
    const frame = f.capture();
    assert.equal(frame.commands.length, 2);
    assert.deepEqual(frame.commands.map(c => [c.fillColor, c.fillAlpha, c.opacity]),
      [[0x204080, .25, .125], [0x804020, .75, .125]]);
    assert.deepEqual(frame.commands.map(c => c.occurrenceId), [0, 1]);
    assert.deepEqual(frame.commands.map(c => c.rect), [
      { x: 1, y: 2, width: 3, height: 4 }, { x: 5, y: 6, width: 7, height: 8 },
    ]);
    assert.equal(frame.materials[0].light[3], .5);
    // The three independent alpha sources remain visible. This is capture
    // evidence, not a claim that the eventual shader multiplies them correctly.
    assert.deepEqual(frame.pages, []); assert.deepEqual(frame.regions, []);
  });
});

test('CAPTURE C08 painter order and A-B-A pages use current first-use tables without sorting', async () => {
  let saved, savedSource;
  await withScene(async f => {
    const a = await f.resource(source(8, 8, 17), viewInput());
    const b = await f.resource(source(8, 8, 99), viewInput({ trimX: 2 }));
    const owned = geometry();
    const first = f.sprite(); fill(first, 0x102030);
    const firstA = f.bitmap(a), middle = f.mesh(b, owned), lastA = f.bitmap(a);
    firstA.x = 1; middle.x = 2; lastA.x = 3;
    saved = f.capture(); savedSource = a.image;
    assert.deepEqual(saved.commands.map(c => c.kind), ['rect', 'image', 'mesh', 'image']);
    assert.deepEqual(saved.commands.map(c => c.occurrenceId), [0, 1, 2, 3]);
    assert.deepEqual(saved.commands.slice(1).map(c => c.regionIndex), [0, 1, 0]);
    assert.deepEqual(saved.commands.slice(1).map(c => c.matrix.tx), [1, 2, 3]);
    assert.deepEqual(saved.pages.map(p => p.source), [a.image, b.image]);
    assert.deepEqual(saved.regions.map(r => r.pageIndex), [0, 1]);
    assert.equal(saved.geometries.length, 1); assert.equal(saved.geometries[0], owned);
    for (const page of saved.pages) {
      assert.equal(page.sourceRepresentation, 'egret.srgb-straight-rgba8/1');
      assert.equal(page.canonicalRepresentation, 'egret.alpha8-capped-srgb-pma8/1');
    }
    const before = JSON.stringify(saved);
    f.engine.stage.setChildIndex(middle, 0);
    const reordered = f.capture();
    assert.deepEqual(reordered.commands.map(c => c.kind), ['mesh', 'rect', 'image', 'image']);
    assert.deepEqual(reordered.pages.map(p => p.source), [b.image, a.image]);
    assert.deepEqual(draws(reordered).filter(c => c.kind !== 'rect').map(c => c.regionIndex), [0, 1, 1]);
    assert.equal(JSON.stringify(saved), before);
    assert.notEqual(saved.commands, reordered.commands);
    for (const name of ['pages', 'regions', 'materials', 'geometries']) assert.notEqual(saved[name], reordered[name]);
    assertFrozenFrame(saved); assertFrozenFrame(reordered);
  });
  assert.equal(saved.pages[0].source, savedSource);
  assert.deepEqual(Array.from(egret.copyImageData2DPixels(saved.pages[0].source).slice(0, 4)),
    [17, 37, 19, 255], 'saved immutable source survives full producer cleanup');
});

test('CAPTURE C09 explicit clip and known-empty boundaries preserve finite literal provenance', async () => {
  await withScene(async f => {
    const outside = f.sprite(); fill(outside, 0x111111);
    const isolated = f.sprite(); isolated.renderBoundary = 'isolate'; isolated.x = 3; isolated.y = 4;
    isolated.clipRect = { x: 0, y: 0, width: 16, height: 16 };
    const first = f.sprite(isolated); first.x = 1; fill(first, 0x222222);
    const unused = await f.resource(); const empty = f.mesh(unused, geometry(true), isolated);
    const last = f.sprite(isolated); last.x = 5; fill(last, 0x333333);
    const after = f.sprite(); fill(after, 0x444444);
    const saved = f.capture();
    assert.deepEqual(saved.commands.map(c => c.kind === 'barrier' ? c.reason : c.kind),
      ['rect', 'explicit-enter', 'clip-enter', 'rect', 'empty', 'rect', 'clip-exit', 'explicit-exit', 'rect']);
    assert.deepEqual(saved.commands.map(c => c.occurrenceId), [0, 1, 2, 3, 4, 5, 2, 1, 6]);
    assert.deepEqual(saved.commands.filter(c => c.kind === 'barrier').map(c => c.boundaryId), [0, 1, 2, 1, 0]);
    const clip = { matrix: { a: 1, b: 0, c: 0, d: 1, tx: 3, ty: 4 },
      rect: { x: 0, y: 0, width: 16, height: 16 } };
    assert.deepEqual(saved.commands[3].clips, [clip]); assert.deepEqual(saved.commands[5].clips, [clip]);
    assert.deepEqual(saved.commands[0].clips, []); assert.deepEqual(saved.commands[8].clips, []);
    assert.deepEqual(saved.commands[3].matrix, { a: 1, b: 0, c: 0, d: 1, tx: 4, ty: 4 });
    assert.deepEqual(saved.pages, []); assert.deepEqual(saved.regions, []); assert.deepEqual(saved.geometries, []);
    assert.equal(saved.materials.length, 1, 'known-empty content creates no unused table rows');
    assertFrozenFrame(saved);
    unused.lease.release();
    expectCode(() => f.capture(), 'ASSET_LEASE_RELEASED');
    empty.clear();
    assert.equal(f.capture().frameId, 2, 'failed resource qualification spends no completed ID');
    // Only a literal zero-index geometry is asserted empty here. A robust
    // clipping/degeneracy discovery made later by Host cannot rewrite this frame.
  });
});

test('CAPTURE C10 reached hidden isolate emits only its pair; a skipped ancestor emits no child events', async () => {
  await withScene(async f => {
    const parent = f.sprite(), isolated = f.sprite(parent);
    isolated.renderBoundary = 'isolate'; isolated.visible = false;
    isolated.clipRect = { x: 0, y: 0, width: 2, height: 2 };
    fill(isolated);
    for (const phase of ['hidden', 'alpha-zero']) {
      if (phase === 'alpha-zero') { isolated.visible = true; isolated.alpha = 0; }
      const frame = f.capture();
      assert.deepEqual(frame.commands, [
        { kind: 'barrier', ordinal: 0, occurrenceId: 0, boundaryId: 0, reason: 'explicit-enter' },
        { kind: 'barrier', ordinal: 1, occurrenceId: 0, boundaryId: 0, reason: 'explicit-exit' },
      ]);
      for (const key of ['pages', 'regions', 'materials', 'geometries']) assert.deepEqual(frame[key], []);
    }
    parent.visible = false;
    assert.deepEqual(f.capture().commands, []);
  });
});

test('CAPTURE C11 Bitmap views keep logical quads and quarter-turn metadata without double placement', async () => {
  await withScene(async f => {
    const sharedSource = source(), nodes = [];
    for (const quarterTurn of [0, 1, 2, 3]) {
      const item = await f.resource(sharedSource, viewInput({ quarterTurn }));
      const bitmap = f.bitmap(item); bitmap.x = 10 + 5 * quarterTurn; bitmap.y = 20;
      nodes.push(bitmap);
      assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [7, 8]);
    }
    const frame = f.capture();
    assert.deepEqual(frame.commands.map(c => c.kind), ['image', 'image', 'image', 'image']);
    assert.equal(frame.pages.length, 1); assert.equal(frame.pages[0].source, sharedSource);
    assert.equal(frame.regions.length, 4);
    assert.deepEqual(frame.commands.map(c => c.regionIndex), [0, 1, 2, 3]);
    for (let turn = 0; turn < 4; turn++) {
      assert.deepEqual(frame.commands[turn].rect, { x: 0, y: 0, width: 7, height: 8 });
      assert.deepEqual(frame.commands[turn].matrix, { a: 1, b: 0, c: 0, d: 1, tx: 10 + 5 * turn, ty: 20 });
      assert.deepEqual(frame.regions[turn], { pageIndex: 0, ...viewInput({ quarterTurn: turn }) });
    }
    assert.equal(frame.colorRecipe, 'egret.linear-srgb-pma/1');
    assert.equal(frame.targetRepresentation, 'egret.srgb-pma8-target/1');
    assert.equal(frame.outputRepresentation, 'egret.srgb-premultiplied-unorm8/1');
    const old = JSON.stringify(frame);
    nodes[1].x = 40;
    const moved = f.capture();
    assert.equal(moved.commands[1].matrix.tx, 40);
    assert.equal(JSON.stringify(frame), old);
    assertFrozenFrame(frame);
  });
});

test('CAPTURE C12 Mesh retains original geometry identities and dark coefficients without legacy impersonation', async () => {
  await withScene(async f => {
    const item = await f.resource(source(), viewInput());
    const shared = geometry(), legacy = egret.createTexturedGeometry2D({
      positions: new Float64Array([0, 0, 2, 0, 0, 2]), uvs: new Float64Array([0, 0, 1, 0, 0, 1]),
      lightColors: new Float64Array(12).fill(.5), indices: new Uint16Array([0, 1, 2]),
    });
    const first = f.mesh(item, shared), second = f.mesh(item, legacy);
    first.alpha = .5; second.alpha = .25;
    const frame = f.capture();
    assert.deepEqual(frame.commands.map(c => c.kind), ['mesh', 'mesh']);
    assert.deepEqual(frame.commands.map(c => c.geometryIndex), [0, 1]);
    assert.equal(frame.geometries[0], shared); assert.equal(frame.geometries[1], legacy);
    assert.equal(egret.isTexturedGeometry2D(shared), false);
    assert.equal(egret.isTexturedGeometry2D(legacy), true);
    assert.deepEqual(frame.geometries[0].darkColors, [.25, .5, .75, .25, .5, .75, .25, .5, .75]);
    assert.deepEqual(frame.geometries[0].lightColors, [1, .5, .25, .5, 1, .5, .25, .5, 1, .5, .25, .5]);
    assert.equal(Object.hasOwn(legacy, 'darkColors'), false, 'capture does not mutate the old immutable type');
    assert.deepEqual(frame.commands.map(c => c.opacity), [.5, .25]);
    assert.deepEqual(frame.commands.map(c => c.regionIndex), [0, 0]);
    first.setContent(item.lease, geometry());
    const next = f.capture();
    assert.notEqual(next.geometries[0], shared); assert.equal(frame.geometries[0], shared);
  });
});

test('CAPTURE C13 NineSlice uses the view logical domain; incompatible material follows current resource qualification', async () => {
  await withScene(async f => {
    const view = viewInput({ logicalWidth: 8, logicalHeight: 8 });
    const item = await f.resource(source(), view);
    const panel = f.add(new egret.NineSliceBitmap(item.lease, {
      width: 12, height: 16, insets: { left: 2, top: 2, right: 2, bottom: 2 },
    }));
    const frame = f.capture();
    assert.equal(frame.commands.length, 1); assert.equal(frame.commands[0].kind, 'mesh');
    const command = frame.commands[0], owned = frame.geometries[command.geometryIndex];
    assert.deepEqual(owned.positions, [
      0,0, 2,0, 10,0, 12,0, 0,2, 2,2, 10,2, 12,2,
      0,14, 2,14, 10,14, 12,14, 0,16, 2,16, 10,16, 12,16,
    ]);
    assert.deepEqual(owned.uvs, [
      0,0, .25,0, .75,0, 1,0, 0,.25, .25,.25, .75,.25, 1,.25,
      0,.75, .25,.75, .75,.75, 1,.75, 0,1, .25,1, .75,1, 1,1,
    ], 'UVs describe the logical view once; trim and rotation stay in the region');
    assert.deepEqual(drawRegion(frame, command), { pageIndex: 0, ...view });
    assert.deepEqual(command.matrix, IDENTITY);
    panel.sharedMaterial = requireFactory('createSharedMaterial2D')({ samplingDomain: 'page' });
    expectCode(() => f.capture(), 'SHARED_MATERIAL_UNSUPPORTED');
    item.lease.release();
    expectCode(() => f.capture(), 'ASSET_LEASE_RELEASED');
    panel.dispose();
    assert.equal(f.capture().frameId, 2);
    assert.equal(frame.geometries[0], owned); assertFrozenFrame(frame);
  });
});

test('CAPTURE C14 Text consumes only committed raster and desired requests do not trigger preparation', async () => {
  await withScene(async f => {
    requireCapture(f.engine);
    const text = await import('@egret/engine/text'), literal = literalProvider();
    const cache = text.createTextRasterCache(f.engine.assets, { provider: literal.provider, maxResidentEntries: 0 });
    const textScope = f.engine.createScope(), field = text.createTextField(f.engine, textScope, cache);
    f.engine.stage.addChild(field); field.alpha = .5;
    try {
      field.setRequest(request()); await field.prepare();
      const before = { measure: literal.state.measure, raster: literal.state.raster, release: literal.state.release };
      const frame = f.capture();
      assert.equal(frame.commands.length, 1); assert.equal(frame.commands[0].kind, 'image');
      assert.deepEqual(frame.commands[0].rect, { x: -3, y: -1, width: 12, height: 10 });
      assert.equal(frame.commands[0].opacity, .5);
      const original = drawSource(frame, frame.commands[0]);
      assert.deepEqual(Array.from(egret.copyImageData2DPixels(original).slice(0, 4)), [17, 83, 149, 255]);
      field.setRequest(request({ text: 'B', density: 1.5 }));
      const desired = f.capture();
      assert.deepEqual(desired.commands, frame.commands); assert.equal(drawSource(desired, desired.commands[0]), original);
      assert.equal(field.getStatus().committedRevision, 1);
      assert.deepEqual({ measure: literal.state.measure, raster: literal.state.raster, release: literal.state.release }, before,
        'capture does not measure, rasterize, release or commit the desired request');
      await field.prepare();
      const committed = f.capture(), nextSource = drawSource(committed, committed.commands[0]);
      assert.equal(field.getStatus().committedRevision, 2);
      assert.deepEqual([nextSource.width, nextSource.height], [17, 14]);
      assert.deepEqual([committed.commands[0].rect.width, committed.commands[0].rect.height], [34 / 3, 28 / 3]);
      assert.notEqual(nextSource, original);
      assert.equal(drawSource(frame, frame.commands[0]), original);
      field.dispose(); await cache.whenIdle();
      assert.deepEqual(f.capture().commands, []);
      assert.equal(cache.getStatus().activeCallerLeases, 0);
      assertFrozenFrame(frame);
    } finally {
      textScope.dispose(); cache.dispose(); await cache.whenIdle();
    }
    assert.equal(literal.state.release, literal.state.measure);
  });
});

test('CAPTURE C15 committed Sequence trim layout is converted once and capture never selects time', async () => {
  await withScene(async f => {
    const item = await f.resource(source(6, 6)), bitmap = f.bitmap(item);
    bitmap.x = 5; bitmap.y = 7;
    const clip = egret.createSequenceClip({ atlasWidth: 6, atlasHeight: 6, frames: [
      { name: 'A', x: 0, y: 0, width: 2, height: 3, durationSeconds: .125,
        layout: { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 1, packedRotation: 0 } },
      { name: 'B', x: 3, y: 0, width: 2, height: 3, durationSeconds: .25,
        layout: { sourceWidth: 4, sourceHeight: 5, trimX: 1, trimY: 2, packedRotation: 90 } },
    ] }, 'trim-rotation-v1');
    const player = f.scope.use(new egret.SequencePlayer(bitmap, clip));
    const selected = player.applyAt(.125), saved = f.capture();
    assert.equal(selected.frameIndex, 1);
    assert.deepEqual(bitmap.sourceRect, { x: 3, y: 0, width: 2, height: 3 });
    assert.equal(saved.commands.length, 1);
    assert.deepEqual(saved.commands[0].rect, { x: 0, y: 0, width: 4, height: 5 });
    assert.deepEqual(saved.commands[0].matrix, { a: 1, b: 0, c: 0, d: 1, tx: 5, ty: 7 });
    assert.deepEqual(drawRegion(saved, saved.commands[0]), {
      pageIndex: 0, packed: { x: 3, y: 0, width: 2, height: 3 },
      logicalWidth: 4, logicalHeight: 5, trimX: 1, trimY: 2, quarterTurn: 1,
    });
    const repeat = f.capture();
    assert.equal(player.lastSample, selected);
    assert.equal(f.engine.clock.elapsedSeconds, 0);
    assert.deepEqual(repeat.commands, saved.commands);
    const old = f.engine.captureFrame(FRAME);
    assert.deepEqual(old.commands[0].rect, { x: 0, y: 0, width: 2, height: 3 });
    assert.deepEqual(old.commands[0].matrix, { a: 0, b: -1, c: 1, d: 0, tx: 6, ty: 11 });
    player.applyAt(0);
    const changed = f.capture();
    assert.deepEqual(drawRegion(changed, changed.commands[0]), {
      pageIndex: 0, packed: { x: 0, y: 0, width: 2, height: 3 },
      logicalWidth: 4, logicalHeight: 5, trimX: 1, trimY: 1, quarterTurn: 0,
    });
    assert.equal(drawRegion(saved, saved.commands[0]).quarterTurn, 1);
    assert.equal(player.lastSample.frameIndex, 0);
  });
});

test('CAPTURE C16 old profiles refuse new visible metadata without consuming frame IDs', async () => {
  for (const kind of ['view', 'material', 'isolate']) {
    await withScene(async f => {
      let node, reset;
      if (kind === 'view') {
        const item = await f.resource(source(), viewInput());
        node = f.bitmap(item);
        const legacy = await f.resource();
        reset = () => { node.textureLease = legacy.lease; };
      } else {
        node = f.sprite(); fill(node);
        if (kind === 'material') {
          node.sharedMaterial = requireFactory('createSharedMaterial2D')({});
          reset = () => { node.sharedMaterial = null; };
        } else {
          node.renderBoundary = 'isolate';
          reset = () => { node.renderBoundary = 'none'; };
        }
      }
      requireCapture(f.engine);
      for (const method of ['captureFrame', 'captureTexturedFrame']) {
        expectCode(() => f.engine[method](FRAME), 'FRAME_PROFILE_METADATA_UNSUPPORTED');
      }
      assert.equal(f.capture().frameId, 1);
      reset();
      assert.equal(f.engine.captureFrame(FRAME).frameId, 2);
      assert.equal(f.engine.captureTexturedFrame(FRAME).frameId, 3);
    });
  }
  await withScene(async f => {
    const item = await f.resource(), mesh = f.mesh(item, geometry());
    requireCapture(f.engine);
    expectCode(() => f.engine.captureTexturedFrame(FRAME), 'FRAME_PROFILE_METADATA_UNSUPPORTED');
    // Ordinary Mesh's pre-existing refusal ordering is a separate legacy
    // obligation; this case does not rename it to a new metadata error.
    assert.equal(f.capture().frameId, 1);
    mesh.clear(); assert.equal(f.engine.captureTexturedFrame(FRAME).frameId, 2);
  });
});

test('CAPTURE C17 current exact lease is requalified despite same-source saved frames', async () => {
  let saved;
  await withScene(async f => {
    const item = await f.resource(source(), viewInput()), bitmap = f.bitmap(item);
    saved = f.capture();
    const secondLease = f.scope.use(await f.engine.assets.acquire(item.ref, { signal: f.scope.signal }));
    assert.notEqual(secondLease, item.lease); assert.equal(secondLease.value, item.texture);
    bitmap.textureLease = secondLease;
    item.lease.release();
    const valid = f.capture();
    assert.equal(valid.frameId, 2); assert.equal(drawSource(valid, valid.commands[0]), item.image);
    secondLease.release();
    expectCode(() => f.capture(), 'ASSET_LEASE_RELEASED');
    bitmap.textureLease = undefined;
    assert.equal(f.capture().frameId, 3);
    assert.equal(drawSource(saved, saved.commands[0]), item.image);
    assertFrozenFrame(saved);
  });
  assert.deepEqual(Array.from(egret.copyImageData2DPixels(drawSource(saved, saved.commands[0])).slice(0, 4)),
    [73, 37, 19, 255]);
});

test('CAPTURE C18 pure capture retains legal geometry UVs beyond the GPU periodic qualification', async () => {
  await withScene(async f => {
    const item = await f.resource(source(2, 2));
    const owned = requireFactory('createSharedGeometry2D')({
      positions: new Float64Array([0, 0, 4, 0, 0, 4]),
      uvs: new Float64Array([2 ** 20, 0, 2 ** 20, 1, 2 ** 20, .5]),
      lightColors: new Float64Array(12).fill(1), darkColors: new Float64Array(9),
      indices: new Uint16Array([0, 1, 2]),
    });
    const mesh = f.mesh(item, owned);
    mesh.sharedMaterial = requireFactory('createSharedMaterial2D')({
      samplingDomain: 'page', addressU: 'repeat', addressV: 'repeat',
    });
    const frame = f.capture();
    assert.equal(frame.commands.length, 1); assert.equal(frame.commands[0].kind, 'mesh');
    assert.equal(frame.geometries[0], owned);
    assert.deepEqual(frame.geometries[0].uvs, [2 ** 20, 0, 2 ** 20, 1, 2 ** 20, .5]);
    assert.equal(f.calls.length, 0);
    // This is explicitly not GPU admission: page q and periodic 8192 checks
    // belong to Host preparation. No Host is asked to render this frame here.
  });
});

test('CAPTURE R01 ticket preparation preserves old views and commit publishes complete logical regions', async () => {
  await withScene(async f => {
    const oldViews = [viewInput(), viewInput({ logicalWidth: 5, logicalHeight: 6,
      trimX: 1, trimY: 1, quarterTurn: 0 })];
    const nextViews = [viewInput({ logicalWidth: 9, logicalHeight: 6,
      trimX: 4, trimY: 1, quarterTurn: 2 }), viewInput({ logicalWidth: 6,
      logicalHeight: 9, trimX: 1, trimY: 5, quarterTurn: 3 })];
    const old = [await f.resource(source(8, 8, 31), oldViews[0]),
      await f.resource(source(8, 8, 63), oldViews[1])];
    const next = [await f.resource(source(8, 8, 127), nextViews[0]),
      await f.resource(source(8, 8, 191), nextViews[1])];
    const targets = old.map(item => f.bitmap(item));
    const saved = f.capture(), savedBytes = JSON.stringify(saved);
    assert.equal(saved.commands.length, 2);
    const oldCrops = targets.map(target => target.sourceRect);
    const ticket = f.engine.captureBitmapBindings(f.scope, targets);
    ticket.prepare(next.map(item => item.lease));
    const prepared = f.capture();
    assert.deepEqual(prepared.commands, saved.commands);
    assert.deepEqual(prepared.regions, saved.regions);
    for (let index = 0; index < 2; index++) {
      assert.equal(targets[index].textureLease, old[index].lease);
      assert.equal(targets[index].sourceRect, oldCrops[index]);
      assert.equal(drawSource(prepared, prepared.commands[index]), old[index].image);
      assert.deepEqual(drawRegion(saved, saved.commands[index]), { pageIndex: index, ...oldViews[index] });
    }
    ticket.commit();
    const committed = f.capture();
    assert.equal(committed.commands.length, 2);
    for (let index = 0; index < 2; index++) {
      const target = targets[index], command = committed.commands[index], view = nextViews[index];
      assert.equal(target.textureLease, next[index].lease);
      assert.deepEqual(target.sourceRect, view.packed);
      assert.deepEqual([target.naturalWidth, target.naturalHeight], [view.logicalWidth, view.logicalHeight]);
      assert.deepEqual(command.rect, { x: 0, y: 0, width: view.logicalWidth, height: view.logicalHeight });
      assert.deepEqual(drawRegion(committed, command), { pageIndex: index, ...view });
      assert.equal(drawSource(committed, command), next[index].image);
    }
    assert.equal(JSON.stringify(saved), savedBytes);
    assertFrozenFrame(saved); assertFrozenFrame(committed);
    ticket.dispose(); ticket.dispose();
    for (const target of targets) {
      assert.equal(target.textureLease, undefined); assert.equal(target.sourceRect, undefined);
      assert.deepEqual([target.naturalWidth, target.naturalHeight], [0, 0]);
    }
    // The ticket clears its publication; all four leases still belong to the caller.
    for (const item of [...old, ...next]) {
      assert.equal(item.lease.value, item.texture);
      assert.equal(item.disposals, 0); assert.equal(item.texture.isDisposed, false);
    }
    assert.equal(JSON.stringify(saved), savedBytes);
    assert.equal(f.diagnostics.length, 0);
  });
});

test('CAPTURE R02 latest slot intent preserves complete view metadata and releases obsolete resources', async () => {
  const disposed = new Map(), loaded = [], textures = new Map();
  await withScene(async f => {
    const views = {
      A: viewInput(),
      B: viewInput({ logicalWidth: 9, logicalHeight: 6, trimX: 4, trimY: 1, quarterTurn: 2 }),
      C: viewInput({ logicalWidth: 6, logicalHeight: 9, trimX: 1, trimY: 5, quarterTurn: 3 }),
    };
    const images = { A: source(8, 8, 31), B: source(8, 8, 127), C: source(8, 8, 191) };
    const resolvers = new Map();
    const type = egret.createAssetType('shared-view-slot-' + (++resourceOrdinal), egret.isTexture);
    f.engine.assets.register(type, {
      load(reference) {
        loaded.push(reference.id);
        const texture = requireFactory('createTextureView')(images[reference.id], views[reference.id]);
        textures.set(reference.id, texture); disposed.set(texture, 0);
        if (reference.id === 'A') return Promise.resolve(texture);
        return new Promise(resolve => resolvers.set(reference.id, () => resolve(texture)));
      },
      dispose(texture) { disposed.set(texture, disposed.get(texture) + 1); texture.dispose(); },
    });
    const ref = id => egret.createAssetRef(type, id);
    const initial = f.scope.use(await f.engine.assets.acquire(ref('A'), { signal: f.scope.signal }));
    const bitmap = f.add(new egret.Bitmap(initial));
    const slot = f.engine.createBitmapResourceSlot(f.scope, bitmap);
    const observe = promise => {
      const outcome = { state: 'pending', value: undefined, error: undefined };
      promise.then(value => { outcome.state = 'fulfilled'; outcome.value = value; },
        error => { outcome.state = 'rejected'; outcome.error = error; });
      return outcome;
    };
    // One ordinary event-loop turn observes queued provider/manager promises, not a product hook.
    const settle = () => new Promise(resolve => setImmediate(resolve));
    const saved = f.capture(), savedBytes = JSON.stringify(saved);
    try {
      const obsolete = observe(slot.replace(ref('B')));
      const current = observe(slot.replace(ref('C')));
      await settle();
      assert.equal(obsolete.state, 'rejected');
      assert.ok(hasCode('BITMAP_RESOURCE_SUPERSEDED')(obsolete.error));
      assert.equal(current.state, 'pending'); assert.equal(slot.state, 'pending');
      assert.deepEqual(loaded, ['A', 'B', 'C']);
      assert.equal(bitmap.textureLease, initial);
      const pending = f.capture();
      assert.equal(pending.commands.length, 1);
      assert.deepEqual(pending.regions, saved.regions);
      assert.equal(drawSource(pending, pending.commands[0]), images.A);
      resolvers.get('C')(); await settle();
      assert.deepEqual([current.state, current.value, slot.state], ['fulfilled', undefined, 'ready']);
      const committed = f.capture();
      assert.equal(committed.commands.length, 1);
      assert.equal(bitmap.textureLease.value, textures.get('C'));
      assert.notEqual(bitmap.textureLease, initial);
      assert.deepEqual(bitmap.sourceRect, views.C.packed);
      assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [6, 9]);
      assert.deepEqual(committed.commands[0].rect, { x: 0, y: 0, width: 6, height: 9 });
      assert.deepEqual(drawRegion(committed, committed.commands[0]), { pageIndex: 0, ...views.C });
      assert.equal(drawSource(committed, committed.commands[0]), images.C);
      resolvers.get('B')(); await settle();
      assert.equal(disposed.get(textures.get('B')), 1);
      assert.equal(textures.get('B').isDisposed, true);
      const afterLate = f.capture();
      assert.deepEqual(afterLate.commands, committed.commands);
      assert.deepEqual(afterLate.regions, committed.regions);
      assert.equal(drawSource(afterLate, afterLate.commands[0]), images.C);
      assert.equal(disposed.get(textures.get('C')), 0);
      slot.dispose(); slot.dispose(); await settle();
      assert.equal(slot.state, 'disposed'); assert.equal(bitmap.textureLease, undefined);
      assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [0, 0]);
      assert.equal(disposed.get(textures.get('C')), 1);
      assert.equal(disposed.get(textures.get('A')), 0);
      assert.equal(initial.value, textures.get('A'));
      assert.equal(JSON.stringify(saved), savedBytes); assertFrozenFrame(saved);
      assert.equal(f.diagnostics.length, 0);
    } finally {
      slot.dispose();
      for (const resolve of resolvers.values()) resolve();
      await settle();
    }
  });
  assert.deepEqual(loaded, ['A', 'B', 'C']);
  for (const texture of textures.values()) {
    assert.equal(disposed.get(texture), 1); assert.equal(texture.isDisposed, true);
  }
});

test('CAPTURE R03 NineSlice resize changes logical positions once and retains trim rotation and saved geometry', async () => {
  await withScene(async f => {
    const view = viewInput({ logicalWidth: 8, logicalHeight: 8 });
    const item = await f.resource(source(), view);
    const panel = f.add(new egret.NineSliceBitmap(item.lease, {
      width: 12, height: 16, insets: { left: 2, top: 2, right: 2, bottom: 2 },
    }));
    const saved = f.capture(), savedBytes = JSON.stringify(saved);
    assert.equal(saved.commands.length, 1);
    const oldGeometry = saved.geometries[saved.commands[0].geometryIndex];
    panel.resize(20, 10);
    assert.deepEqual([panel.targetWidth, panel.targetHeight], [20, 10]);
    const resized = f.capture();
    assert.equal(resized.commands.length, 1); assert.equal(resized.commands[0].kind, 'mesh');
    const next = resized.geometries[resized.commands[0].geometryIndex];
    assert.notEqual(next, oldGeometry);
    assert.deepEqual(next.positions, [
      0,0, 2,0, 18,0, 20,0, 0,2, 2,2, 18,2, 20,2,
      0,8, 2,8, 18,8, 20,8, 0,10, 2,10, 18,10, 20,10,
    ]);
    assert.deepEqual(next.uvs, [
      0,0, .25,0, .75,0, 1,0, 0,.25, .25,.25, .75,.25, 1,.25,
      0,.75, .25,.75, .75,.75, 1,.75, 0,1, .25,1, .75,1, 1,1,
    ]);
    assert.deepEqual(drawRegion(resized, resized.commands[0]), { pageIndex: 0, ...view });
    assert.equal(drawSource(resized, resized.commands[0]), item.image);
    assert.deepEqual(resized.commands[0].matrix, IDENTITY);
    assert.equal(JSON.stringify(saved), savedBytes); assertFrozenFrame(saved); assertFrozenFrame(resized);
    panel.dispose();
    assert.equal(item.lease.value, item.texture);
    assert.equal(item.disposals, 0);
  });
});

test('CAPTURE R04 Sequence refuses explicit full-page views and existing players detect binding replacement first', async () => {
  await withScene(async f => {
    const full = { packed: { x: 0, y: 0, width: 8, height: 8 },
      logicalWidth: 8, logicalHeight: 8, trimX: 0, trimY: 0, quarterTurn: 0 };
    const original = await f.resource(source(8, 8, 31));
    const explicit = await f.resource(source(8, 8, 191), full);
    const bitmap = f.bitmap(original), viewBitmap = f.bitmap(explicit);
    const clip = egret.createSequenceClip({ atlasWidth: 8, atlasHeight: 8, frames: [
      { x: 0, y: 0, width: 2, height: 2, durationSeconds: .125 },
      { x: 2, y: 0, width: 2, height: 2, durationSeconds: .125 },
    ] });
    expectCode(() => new egret.SequencePlayer(viewBitmap, clip, 'invalid'), 'SEQ_INPUT_INVALID');
    assert.throws(() => new egret.SequencePlayer(viewBitmap, {}, 'once'), error =>
      error instanceof Error && error.name === 'SequenceClipError' && error.code === 'SEQ_CLIP_INVALID');
    expectCode(() => new egret.SequencePlayer(viewBitmap, clip), 'SEQ_ATLAS_MISMATCH');
    assert.equal(viewBitmap.textureLease, explicit.lease);
    assert.deepEqual(viewBitmap.sourceRect, full.packed);
    const player = f.scope.use(new egret.SequencePlayer(bitmap, clip));
    const selected = player.applyAt(.125), saved = f.capture(), savedBytes = JSON.stringify(saved);
    assert.equal(selected.frameIndex, 1);
    assert.deepEqual(bitmap.sourceRect, { x: 2, y: 0, width: 2, height: 2 });
    bitmap.textureLease = explicit.lease;
    original.lease.release();
    // Changed exact binding precedes both the old lease's release and invalid time.
    expectCode(() => player.applyAt(NaN), 'SEQ_BINDING_CHANGED');
    assert.equal(player.lastSample, selected);
    assert.equal(bitmap.textureLease, explicit.lease);
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [8, 8]);
    const current = f.capture();
    assert.equal(current.commands.length, 2);
    for (const command of current.commands) {
      assert.deepEqual(drawRegion(current, command), { pageIndex: 0, ...full });
      assert.equal(drawSource(current, command), explicit.image);
    }
    assert.equal(JSON.stringify(saved), savedBytes); assertFrozenFrame(saved);
    player.dispose(); assert.equal(explicit.lease.value, explicit.texture);
  });
});

test('CAPTURE R05 SpriteSheet rejects explicit full-page views before reading frame descriptors', async () => {
  await withScene(async f => {
    const full = { packed: { x: 0, y: 0, width: 8, height: 8 },
      logicalWidth: 8, logicalHeight: 8, trimX: 0, trimY: 0, quarterTurn: 0 };
    const legacy = await f.resource(source());
    const explicit = await f.resource(source(), full);
    const sheet = f.scope.use(egret.createSpriteSheet(legacy.lease, [{ name: 'icon', x: 0, y: 0, width: 2, height: 2 }]));
    f.add(sheet.createBitmap('icon'));
    const ordinary = f.capture();
    assert.equal(ordinary.commands.length, 1);
    assert.deepEqual(ordinary.commands[0].rect, { x: 0, y: 0, width: 2, height: 2 });
    assert.equal(drawSource(ordinary, ordinary.commands[0]), legacy.image);
    let descriptorReads = 0;
    const cause = Object.freeze({ descriptorMustRemainUnread: true });
    const unread = () => { descriptorReads++; throw cause; };
    const descriptors = new Proxy([{ name: 'icon', x: 0, y: 0, width: 2, height: 2 }], {
      get: unread, getOwnPropertyDescriptor: unread, ownKeys: unread,
    });
    expectCode(() => egret.createSpriteSheet(explicit.lease, descriptors), 'SPRITE_SHEET_ATLAS_INVALID');
    assert.equal(descriptorReads, 0);
    explicit.lease.release();
    expectCode(() => egret.createSpriteSheet(explicit.lease, descriptors), 'ASSET_LEASE_RELEASED');
    assert.equal(descriptorReads, 0);
    assert.equal(f.capture().commands.length, 1);
    assertFrozenFrame(ordinary);
  });
});

test('CAPTURE R06 shared profile negotiation preserves exact advertisement and port-read precedence', async () => {
  let optionReads = 0;
  await assert.rejects(egret.createEngineForProfile({
    get host() { optionReads++; throw new Error('unsupported profile must not inspect options'); },
  }, 'egret.shared-frame2d/2'), hasCode('ENGINE_RENDER_PROFILE_UNSUPPORTED'));
  assert.equal(optionReads, 0);
  const trace = [], cause = Object.freeze({ legacyPortRead: true });
  const host = {
    get sharedFrameProfile() { trace.push('sharedFrameProfile'); return 'wrong'; },
    get renderSharedFrame() { trace.push('renderSharedFrame'); return 7; },
    get renderFrame() { trace.push('renderFrame'); throw cause; },
  };
  await assert.rejects(egret.createEngineForProfile({
    get host() { trace.push('host'); return host; },
    get onDiagnostic() { throw new Error('port admission must complete first'); },
  }, 'egret.shared-frame2d/1'), error => hasCode('INVALID_RENDERER')(error) && error.cause === cause);
  assert.deepEqual(trace, ['host', 'sharedFrameProfile', 'renderSharedFrame', 'renderFrame']);
  for (const [advertisement, shared, legacy, expected] of [
    ['egret.shared-frame2d/2', () => undefined, undefined, 'ENGINE_RENDER_PROFILE_UNSUPPORTED'],
    ['egret.shared-frame2d/1', 7, undefined, 'INVALID_RENDERER'],
    ['egret.shared-frame2d/1', () => undefined, 7, 'INVALID_RENDERER'],
  ]) {
    const reads = [];
    const invalidHost = {
      get sharedFrameProfile() { reads.push('sharedFrameProfile'); return advertisement; },
      get renderSharedFrame() { reads.push('renderSharedFrame'); return shared; },
      get renderFrame() { reads.push('renderFrame'); return legacy; },
      start() { assert.fail('invalid ports must not start a Host'); },
    };
    await assert.rejects(egret.createEngineForProfile({
      host: invalidHost,
      get onDiagnostic() { throw new Error('invalid ports must not inspect remaining options'); },
    }, 'egret.shared-frame2d/1'), hasCode(expected));
    assert.deepEqual(reads, ['sharedFrameProfile', 'renderSharedFrame', 'renderFrame']);
  }
});

test('CAPTURE R07 shared and optional legacy ports are captured once with their original Host receiver', async () => {
  const reads = [], calls = [], lifecycle = [], diagnostics = [], timers = new Set();
  let sealed = false;
  const read = (name, value) => {
    if (sealed) throw new Error('negotiated port reread: ' + name);
    reads.push(name); return value;
  };
  const host = {
    surface: {},
    get sharedFrameProfile() { return read('sharedFrameProfile', 'egret.shared-frame2d/1'); },
    get renderSharedFrame() { return read('renderSharedFrame', function (frame) {
      calls.push({ kind: 'shared', receiver: this, frame }); return undefined;
    }); },
    get renderFrame() { return read('renderFrame', function (frame) {
      calls.push({ kind: 'legacy', receiver: this, frame }); return undefined;
    }); },
    get texturedFrameProfile() { throw new Error('unselected textured advertisement'); },
    get renderTexturedFrame() { throw new Error('unselected textured port'); },
    start() { lifecycle.push(['start', this]); },
    stop() { lifecycle.push(['stop', this]); },
    async close() { lifecycle.push(['close', this]); },
    setTimeout(callback, delay) {
      const timer = { callback, delay }; timers.add(timer); return () => timers.delete(timer);
    },
  };
  const engine = await egret.createEngineForProfile({
    host, onDiagnostic: value => diagnostics.push(value),
  }, 'egret.shared-frame2d/1');
  const scope = engine.createScope();
  try {
    assert.deepEqual(reads, ['sharedFrameProfile', 'renderSharedFrame', 'renderFrame']);
    sealed = true;
    const sprite = scope.use(new egret.Sprite()); fill(sprite);
    engine.stage.addChild(sprite); requireCapture(engine);
    const captured = engine.captureSharedFrame(FRAME);
    assert.equal(calls.length, 0);
    const rendered = engine.renderSharedFrame(FRAME), legacy = engine.renderFrame(FRAME);
    assert.deepEqual([captured.frameId, rendered.frameId, legacy.frameId], [1, 2, 3]);
    assert.equal(rendered.profile, 'egret.shared-frame2d/1');
    assert.equal(captured.commands.length, 1); assert.equal(rendered.commands.length, 1);
    assert.deepEqual(rendered.commands, captured.commands);
    assert.deepEqual(calls.map(call => call.kind), ['shared', 'legacy']);
    assert.equal(calls[0].receiver, host); assert.equal(calls[0].frame, rendered);
    assert.equal(calls[1].receiver, host); assert.equal(calls[1].frame, legacy);
    assert.deepEqual(reads, ['sharedFrameProfile', 'renderSharedFrame', 'renderFrame']);
    assertFrozenFrame(captured); assertFrozenFrame(rendered);
  } finally { scope.dispose(); await engine.dispose(); }
  assert.deepEqual(lifecycle.map(row => row[0]), ['start', 'stop', 'close']);
  assert.ok(lifecycle.every(row => row[1] === host));
  assert.equal(timers.size, 0); assert.equal(scope.state, 'closed');
  assert.deepEqual(diagnostics, []);
});

test('CAPTURE R08 oversized legacy Sequence layout stays legacy-valid and shared refusal follows lease qualification', async () => {
  await withScene(async f => {
    const item = await f.resource(source(2, 2)), bitmap = f.bitmap(item);
    const clip = egret.createSequenceClip({ atlasWidth: 2, atlasHeight: 2, frames: [
      { x: 0, y: 0, width: 1, height: 1, durationSeconds: .125,
        layout: { sourceWidth: 1048577, sourceHeight: 2, trimX: 0, trimY: 0, packedRotation: 0 } },
    ] }, 'trim-rotation-v1');
    const player = f.scope.use(new egret.SequencePlayer(bitmap, clip));
    const selected = player.applyAt(0);
    assert.equal(selected.frameIndex, 0);
    assert.deepEqual([bitmap.naturalWidth, bitmap.naturalHeight], [1048577, 2]);
    const legacy = f.engine.captureFrame(FRAME);
    assert.equal(legacy.commands.length, 1);
    assert.equal(legacy.commands[0].kind, 'image');
    assert.deepEqual(legacy.commands[0].sourceRect, { x: 0, y: 0, width: 1, height: 1 });
    assert.deepEqual(legacy.commands[0].rect, { x: 0, y: 0, width: 1, height: 1 });
    assert.equal(legacy.images[legacy.commands[0].imageIndex], item.image);
    expectCode(() => f.capture(), 'FRAME_PROFILE_METADATA_UNSUPPORTED');
    assert.equal(player.lastSample, selected);
    item.lease.release();
    expectCode(() => f.capture(), 'ASSET_LEASE_RELEASED');
    bitmap.dispose();
    assert.equal(f.capture().frameId, legacy.frameId + 1, 'Neither refused shared capture spends an ID');
    assert.equal(legacy.images[legacy.commands[0].imageIndex], item.image);
  });
});

test('CAPTURE R09 old Mesh arithmetic and current lease retain precedence over new metadata', async () => {
  for (const metadata of ['material', 'view', 'boundary']) await withScene(async f => {
    const original = await f.resource();
    const legacy = egret.createTexturedGeometry2D({
      positions: new Float64Array([Number.MAX_VALUE, 0, 1, 0, 0, 1]),
      uvs: new Float64Array([0, 0, 1, 0, 0, 1]),
      lightColors: new Float64Array(12).fill(1), indices: new Uint16Array([0, 1, 2]),
    });
    const mesh = f.mesh(original, legacy); mesh.scaleX = 2;
    expectCode(() => f.engine.captureTexturedFrame(FRAME), 'FRAME_TRANSFORM_INVALID');
    let current = original;
    if (metadata === 'material') mesh.sharedMaterial = egret.createSharedMaterial2D({});
    else if (metadata === 'boundary') mesh.renderBoundary = 'isolate';
    else { current = await f.resource(source(), viewInput()); mesh.setContent(current.lease, legacy); }
    expectCode(() => f.engine.captureTexturedFrame(FRAME), 'FRAME_TRANSFORM_INVALID');
    mesh.scaleX = 1;
    expectCode(() => f.engine.captureTexturedFrame(FRAME), 'FRAME_PROFILE_METADATA_UNSUPPORTED');
    current.lease.release();
    expectCode(() => f.engine.captureTexturedFrame(FRAME), 'ASSET_LEASE_RELEASED');
    mesh.dispose();
    assert.equal(f.engine.captureTexturedFrame(FRAME).frameId, 1);
  });
});
