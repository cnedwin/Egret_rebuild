// SPDX-License-Identifier: Apache-2.0
// Public SDK regressions: content and lifetime precede optimization assertions.
// Controlled GPU ports establish behavior, not native pixels or timing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egret, withAuthored } from
  './fixtures/gpu-image-residency.mjs';

const SOURCE_PIXELS = [255, 64, 0, 255, 0, 128, 255, 128];
const CROP = { x: 0, y: 0, width: 1, height: 1 };
const matrix = (tx, ty) => ({ a: 1, b: 0, c: 0, d: 1, tx, ty });
const pixels = source => [...egret.copyImageData2DPixels(source)];

function assertClosed(a) {
  assert.equal(a.scope.state, 'closed');
  assert.equal(a.engine.stage.isDisposed, true);
  assert.equal(a.bitmap.isDisposed, true);
  assert.equal(a.mesh.isDisposed, true);
  assert.equal(a.texture.isDisposed, true);
  assert.throws(() => a.lease.value, { code: 'ASSET_LEASE_RELEASED' });
  assert.throws(() => a.engine.captureFrame({ width: 8, height: 8 }), { code: 'ENGINE_CLOSED' });
  assert.deepEqual(pixels(a.source), SOURCE_PIXELS, 'owned pixels survive producer cleanup');
}

function assertFreshFrozen(first, second, textured) {
  assert.deepEqual([first.frameId, second.frameId], [1, 2]);
  assert.notEqual(first, second);
  assert.notEqual(first.commands, second.commands);
  assert.notEqual(first.images, second.images);
  assert.equal(first.commands.length, 1);
  assert.equal(second.commands.length, 1);
  assert.equal(first.images.length, 1);
  assert.equal(second.images.length, 1);
  assert.deepEqual(second.commands, first.commands);
  assert.equal(second.images[0], first.images[0]);
  if (textured) {
    assert.equal(first.profile, egret.TEXTURED_FRAME_PROFILE_2D);
    assert.equal(second.profile, egret.TEXTURED_FRAME_PROFILE_2D);
    assert.notEqual(first.geometries, second.geometries);
    assert.equal(first.geometries.length, 1);
    assert.equal(second.geometries.length, 1);
    assert.equal(second.geometries[0], first.geometries[0]);
  } else assert.equal(Object.hasOwn(first, 'profile'), false);
  for (const frame of [first, second]) {
    const command = frame.commands[0];
    const records = [frame, frame.commands, frame.images, command, command.matrix,
      command.clips, command.clips[0], command.clips[0].matrix, command.clips[0].rect,
      command.sourceRect, ...(textured ? [frame.geometries] : [command.rect])];
    assert.equal(command.clips.length, 1);
    assert.ok(records.every(record => Object.isFrozen(record)), 'the complete saved value is frozen');
    assert.deepEqual(pixels(frame.images[0]), SOURCE_PIXELS);
  }
}

test('R01 ordinary capture: eligible static image shares frozen matrix and clip records', async () => {
  let authored;
  const saved = await withAuthored(async a => {
    authored = a;
    a.bitmap.x = 1; a.bitmap.y = 2; a.bitmap.alpha = 0.5;
    a.bitmap.clipRect = { x: 0, y: 0, width: 1, height: 1 };
    const first = a.capture(), second = a.capture();
    assertFreshFrozen(first, second, false);
    assert.deepEqual(first.commands[0], {
      kind: 'image', matrix: matrix(1, 2), rect: { x: 0, y: 0, width: 1, height: 1 },
      alpha: 0.5, clips: [{ matrix: matrix(1, 2), rect: { x: 0, y: 0, width: 1, height: 1 } }],
      imageIndex: 0, sourceRect: CROP,
    });
    a.bitmap.x = 3; a.bitmap.alpha = 0.25;
    const changed = a.capture();
    assert.equal(changed.frameId, 3);
    assert.deepEqual(changed.commands[0].matrix, matrix(3, 2));
    assert.equal(changed.commands[0].alpha, 0.25);
    assert.deepEqual(first.commands[0].matrix, matrix(1, 2));
    assert.equal(first.commands[0].alpha, 0.5);
    return { first, second };
  });
  assertClosed(authored);
  assert.deepEqual(pixels(saved.first.images[0]), SOURCE_PIXELS);
  // Only the optimization assertion is expected to fail on unchanged M1.1.
  assert.deepEqual({
    matrix: saved.second.commands[0].matrix === saved.first.commands[0].matrix,
    clip: saved.second.commands[0].clips[0] === saved.first.commands[0].clips[0],
  }, { matrix: true, clip: true }, 'eligible ordinary capture repeats immutable derived records');
});

test('R02 textured capture: eligible static mesh shares frozen matrix and clip records', async () => {
  let authored;
  const saved = await withAuthored(async a => {
    authored = a;
    a.bitmap.visible = false; a.engine.stage.addChild(a.mesh);
    a.mesh.x = 1; a.mesh.alpha = 0.5;
    a.mesh.clipRect = { x: 0, y: 0, width: 8, height: 8 };
    const first = a.textured(), second = a.textured();
    assertFreshFrozen(first, second, true);
    assert.deepEqual(first.commands[0], {
      kind: 'mesh', matrix: matrix(1, 0), alpha: 0.5,
      clips: [{ matrix: matrix(1, 0), rect: { x: 0, y: 0, width: 8, height: 8 } }],
      imageIndex: 0, sourceRect: CROP, geometryIndex: 0,
    });
    assert.deepEqual(first.geometries[0].positions, [1, 1, 5, 1, 1, 5]);
    assert.deepEqual(first.geometries[0].lightColors, Array(12).fill(1));
    a.mesh.x = 2; a.mesh.alpha = 0.25; a.mesh.setContent(a.lease, a.geometry(0.25));
    const changed = a.textured();
    assert.equal(changed.frameId, 3);
    assert.deepEqual(changed.commands[0].matrix, matrix(2, 0));
    assert.equal(changed.commands[0].alpha, 0.25);
    assert.notEqual(changed.geometries[0], first.geometries[0]);
    assert.deepEqual(changed.geometries[0].lightColors, Array(12).fill(0.25));
    assert.deepEqual(first.geometries[0].lightColors, Array(12).fill(1));
    assert.deepEqual(first.commands[0].matrix, matrix(1, 0));
    assert.equal(first.commands[0].alpha, 0.5);
    return { first, second };
  });
  assertClosed(authored);
  assert.deepEqual(pixels(saved.first.images[0]), SOURCE_PIXELS);
  // No private cache/helper import: these are public saved values.
  assert.deepEqual({
    matrix: saved.second.commands[0].matrix === saved.first.commands[0].matrix,
    clip: saved.second.commands[0].clips[0] === saved.first.commands[0].clips[0],
  }, { matrix: true, clip: true }, 'eligible textured capture repeats immutable derived records');
});

// Additional public capture controls. No private state or implementation imports.
import { literalProvider, request } from './text-raster-public-helpers.mjs';

const PROFILES = ['ordinary', 'textured'];
const captureFor = (a, profile) => profile === 'ordinary' ? a.capture() : a.textured();
const errorCode = code => error => error instanceof egret.EgretError && error.code === code;
const ownSprite = a => a.scope.use(new egret.Sprite());
function rectangle(node, color, rect = { x: 0, y: 0, width: 1, height: 1 }) {
  node.graphics.beginFill(color).drawRect(rect.x, rect.y, rect.width, rect.height).endFill();
}
function freshArrays(previous, current, profile) {
  assert.notEqual(current, previous);
  assert.equal(current.frameId, previous.frameId + 1);
  assert.notEqual(current.commands, previous.commands);
  if (previous.images !== undefined || current.images !== undefined) assert.notEqual(current.images, previous.images);
  else assert.equal(profile, 'ordinary', 'only ordinary frames omit an empty image table');
  for (const value of [current, current.commands, ...(current.images === undefined ? [] : [current.images])]) assert.ok(Object.isFrozen(value));
  if (profile === 'textured') {
    assert.notEqual(current.geometries, previous.geometries);
    assert.ok(Object.isFrozen(current.geometries));
  }
}
async function checkedAuthored(body) {
  let authored;
  const result = await withAuthored(async a => { authored = a; a.extraResources = []; return body(a); });
  assertClosed(authored);
  for (const extra of authored.extraResources) {
    assert.equal(extra.texture.isDisposed, true);
    assert.throws(() => extra.lease.value, errorCode('ASSET_LEASE_RELEASED'));
    assert.deepEqual(pixels(extra.source), extra.rgba);
  }
  return result;
}
let assetSequence = 0;
async function extraImage(a, rgba = [23, 61, 229, 255]) {
  const source = egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array(rgba) });
  const texture = egret.createTexture(source);
  const type = egret.createAssetType('incremental-capture-' + (++assetSequence), egret.isTexture);
  a.engine.assets.register(type, { load: async () => texture, dispose: value => value.dispose() });
  const lease = await a.engine.assets.acquire(egret.createAssetRef(type, 'image'));
  a.scope.use(lease);
  const extra = { source, texture, lease, rgba: [...rgba] };
  a.extraResources.push(extra);
  return extra;
}

for (const profile of PROFILES) {
  test(`IC03 ${profile}: ancestor transform, alpha and ordered clips invalidate descendant values`, async () => {
    await checkedAuthored(async a => {
      const parent = ownSprite(a); parent.x = 1; parent.y = 2;
      parent.scaleX = 2; parent.scaleY = 3; parent.alpha = 0.5;
      parent.clipRect = { x: 0, y: 0, width: 4, height: 4 };
      a.engine.stage.addChild(parent); parent.addChild(a.bitmap);
      a.bitmap.x = 2; a.bitmap.y = 1; a.bitmap.alpha = 0.5; a.bitmap.clipRect = CROP;
      const first = captureFor(a, profile), warm = captureFor(a, profile);
      freshArrays(first, warm, profile);
      assert.equal(first.commands.length, 1); assert.equal(warm.commands.length, 1);
      assert.deepEqual(first.commands[0].matrix, { a: 2, b: 0, c: 0, d: 3, tx: 5, ty: 5 });
      assert.equal(first.commands[0].alpha, 0.25);
      assert.deepEqual(first.commands[0].clips, [
        { matrix: { a: 2, b: 0, c: 0, d: 3, tx: 1, ty: 2 }, rect: { x: 0, y: 0, width: 4, height: 4 } },
        { matrix: first.commands[0].matrix, rect: CROP },
      ]);
      parent.x = 4; parent.alpha = 0.25; parent.clipRect = { x: 0, y: 0, width: 3, height: 4 };
      const changed = captureFor(a, profile);
      freshArrays(warm, changed, profile);
      assert.equal(changed.commands.length, 1);
      assert.deepEqual(changed.commands[0].matrix, { a: 2, b: 0, c: 0, d: 3, tx: 8, ty: 5 });
      assert.equal(changed.commands[0].alpha, 0.125);
      assert.equal(changed.commands[0].clips[0].rect.width, 3);
      assert.equal(changed.commands[0].clips[0].matrix.tx, 4);
      assert.equal(changed.commands[0].clips[1].matrix.tx, 8);
      assert.equal(first.commands[0].clips[0].rect.width, 4);
      assert.equal(first.commands[0].matrix.tx, 5);
      assert.deepEqual(pixels(first.images[0]), SOURCE_PIXELS);
      assert.equal(warm.commands[0].matrix, first.commands[0].matrix);
      assert.equal(warm.commands[0].clips[0], first.commands[0].clips[0]);
      assert.notEqual(changed.commands[0].matrix, warm.commands[0].matrix);
    });
  });

  test(`IC04 ${profile}: indexed reorder, reparent and removeChildren preserve painter order`, async () => {
    await checkedAuthored(async a => {
      a.bitmap.visible = false;
      const left = ownSprite(a), right = ownSprite(a); right.x = 5;
      a.engine.stage.addChild(left); a.engine.stage.addChild(right);
      const nodes = [0xff0000, 0x00ff00, 0x0000ff].map(color => {
        const node = ownSprite(a); rectangle(node, color); left.addChild(node); return node;
      });
      const first = captureFor(a, profile), warm = captureFor(a, profile);
      freshArrays(first, warm, profile);
      assert.deepEqual(first.commands.map(c => c.color), [0xff0000, 0x00ff00, 0x0000ff]);
      left.addChildAt(nodes[0], 2);
      const reordered = captureFor(a, profile);
      assert.deepEqual(reordered.commands.map(c => c.color), [0x00ff00, 0x0000ff, 0xff0000]);
      right.addChildAt(nodes[1], 0);
      const moved = captureFor(a, profile);
      assert.deepEqual(moved.commands.map(c => [c.color, c.matrix.tx]), [[0x0000ff, 0], [0xff0000, 0], [0x00ff00, 5]]);
      left.removeChildren();
      assert.deepEqual(captureFor(a, profile).commands.map(c => c.color), [0x00ff00]);
      assert.equal(nodes[0].isDisposed, false); assert.equal(nodes[2].isDisposed, false);
      left.addChild(nodes[0]);
      assert.deepEqual(captureFor(a, profile).commands.map(c => c.color), [0xff0000, 0x00ff00]);
      assert.deepEqual(first.commands.map(c => [c.color, c.matrix.tx]), [[0xff0000, 0], [0x00ff00, 0], [0x0000ff, 0]]);
      assert.ok(first.commands.every(c => Object.isFrozen(c) && Object.isFrozen(c.rect)));
      assert.equal(warm.commands[0].matrix, first.commands[0].matrix);
    });
  });

  test(`IC05 ${profile}: hidden changes and Graphics clear never resurrect cached content`, async () => {
    await checkedAuthored(async a => {
      a.bitmap.visible = false;
      const parent = ownSprite(a), child = ownSprite(a); parent.addChild(child); a.engine.stage.addChild(parent);
      rectangle(child, 0xff0000);
      const saved = captureFor(a, profile); captureFor(a, profile);
      parent.visible = false; child.x = 3; child.graphics.clear();
      rectangle(child, 0x0000ff, { x: 1, y: 2, width: 2, height: 3 });
      const hidden = captureFor(a, profile);
      assert.equal(hidden.commands.length, 0); assert.equal((hidden.images ?? []).length, 0);
      parent.visible = true;
      const visible = captureFor(a, profile);
      assert.equal(visible.commands.length, 1);
      assert.deepEqual([visible.commands[0].color, visible.commands[0].matrix.tx, visible.commands[0].rect],
        [0x0000ff, 3, { x: 1, y: 2, width: 2, height: 3 }]);
      child.graphics.clear();
      assert.equal(captureFor(a, profile).commands.length, 0);
      assert.throws(() => child.graphics.drawRect(0, 0, 1, 1), errorCode('GRAPHICS_FILL_REQUIRED'));
      assert.deepEqual([saved.commands[0].color, saved.commands[0].matrix.tx, saved.commands[0].rect],
        [0xff0000, 0, CROP]);
    });
  });

  test(`IC06 ${profile}: signed-zero local and parent keys preserve binary64 outcomes`, async () => {
    await checkedAuthored(async a => {
      a.bitmap.scaleX = -1;
      const first = captureFor(a, profile), warm = captureFor(a, profile);
      assert.equal(first.commands.length, 1); assert.equal(warm.commands.length, 1);
      assert.equal(Object.is(first.commands[0].matrix.b, -0), true);
      a.bitmap.rotation = -0;
      const local = captureFor(a, profile);
      assert.equal(Object.is(a.bitmap.rotation, -0), true);
      assert.equal(Object.is(local.commands[0].matrix.b, 0), true);
      a.bitmap.rotation = 0; a.engine.stage.scaleX = -1;
      const parentPositive = captureFor(a, profile); captureFor(a, profile);
      a.engine.stage.rotation = -0;
      const parentNegative = captureFor(a, profile);
      assert.equal(Object.is(parentPositive.commands[0].matrix.b, 0), true);
      assert.equal(Object.is(parentNegative.commands[0].matrix.b, -0), true);
      assert.equal(Object.is(first.commands[0].matrix.b, -0), true);
      assert.deepEqual(pixels(parentNegative.images[0]), SOURCE_PIXELS);
      assert.equal(warm.commands[0].matrix, first.commands[0].matrix);
      assert.notEqual(local.commands[0].matrix, warm.commands[0].matrix);
    });
  });

  test(`IC07 ${profile}: a warm record grants no released-lease entitlement`, async () => {
    await checkedAuthored(async a => {
      const first = captureFor(a, profile), warm = captureFor(a, profile);
      assert.equal(first.commands.length, 1); assert.equal(warm.commands.length, 1);
      a.lease.release();
      assert.throws(() => captureFor(a, profile), errorCode('ASSET_LEASE_RELEASED'));
      a.bitmap.visible = false;
      const hidden = captureFor(a, profile);
      assert.equal(hidden.commands.length, 0); assert.equal(hidden.frameId, warm.frameId + 1);
      a.bitmap.visible = true;
      assert.throws(() => captureFor(a, profile), errorCode('ASSET_LEASE_RELEASED'));
      assert.deepEqual(pixels(first.images[0]), SOURCE_PIXELS);
      assert.deepEqual(first.commands[0].sourceRect, CROP);
      assert.equal(warm.commands[0].matrix, first.commands[0].matrix);
    });
  });

  test(`IC08 ${profile}: failed crop and atomic ticket preparation preserve old warm values`, async () => {
    await checkedAuthored(async a => {
      const extra = await extraImage(a), second = a.scope.use(new egret.Bitmap(a.lease));
      second.x = 2; a.engine.stage.addChild(second);
      const saved = captureFor(a, profile), warm = captureFor(a, profile);
      const cause = { cropRead: true };
      assert.throws(() => { a.bitmap.sourceRect = { get x() { throw cause; }, y: 0, width: 1, height: 1 }; },
        error => error instanceof egret.EgretError && error.code === 'BITMAP_REGION_INVALID' && error.cause === cause);
      const ticket = a.engine.captureBitmapBindings(a.scope, [a.bitmap, second]);
      assert.throws(() => ticket.prepare([extra.lease, {}]), errorCode('BITMAP_LEASE_INVALID'));
      const afterRefusal = captureFor(a, profile);
      assert.deepEqual(afterRefusal.commands, saved.commands);
      assert.equal(a.bitmap.textureLease, a.lease); assert.equal(second.textureLease, a.lease);
      assert.deepEqual(pixels(afterRefusal.images[0]), SOURCE_PIXELS);
      ticket.prepare([extra.lease, extra.lease]); ticket.commit();
      const changed = captureFor(a, profile), changedWarm = captureFor(a, profile);
      assert.equal(changed.commands.length, 2); assert.equal(changed.images.length, 1);
      assert.equal(changed.images[0], extra.source); assert.deepEqual(pixels(changed.images[0]), [23, 61, 229, 255]);
      assert.deepEqual(changed.commands.map(c => c.imageIndex), [0, 0]);
      assert.equal(a.bitmap.textureLease, extra.lease); assert.equal(second.textureLease, extra.lease);
      ticket.dispose();
      assert.equal(captureFor(a, profile).commands.length, 0);
      assert.equal(a.bitmap.textureLease, undefined); assert.equal(second.textureLease, undefined);
      assert.equal(extra.lease.value, extra.texture, 'ticket clearing borrows never releases the resource owner');
      assert.equal(a.lease.value, a.texture);
      assert.deepEqual(pixels(saved.images[0]), SOURCE_PIXELS);
      assert.equal(warm.commands[0].matrix, saved.commands[0].matrix);
      assert.equal(afterRefusal.commands[0].matrix, warm.commands[0].matrix);
      assert.equal(changedWarm.commands[0].matrix, changed.commands[0].matrix);
    });
  });

  test(`IC09 ${profile}: first-use image indexes rebind across independently owned sources`, async () => {
    await checkedAuthored(async a => {
      const extra = await extraImage(a), second = a.scope.use(new egret.Bitmap(extra.lease));
      second.x = 3; a.engine.stage.addChild(second);
      const first = captureFor(a, profile), warm = captureFor(a, profile);
      assert.equal(first.commands.length, 2); assert.deepEqual(first.images, [a.source, extra.source]);
      assert.deepEqual(first.commands.map(c => c.imageIndex), [0, 1]);
      a.engine.stage.setChildIndex(second, 0);
      const reordered = captureFor(a, profile);
      freshArrays(warm, reordered, profile);
      assert.deepEqual(reordered.images, [extra.source, a.source]);
      assert.deepEqual(reordered.commands.map(c => [c.matrix.tx, c.imageIndex]), [[3, 0], [0, 1]]);
      assert.deepEqual(pixels(reordered.images[reordered.commands[0].imageIndex]), [23, 61, 229, 255]);
      assert.deepEqual(pixels(reordered.images[reordered.commands[1].imageIndex]), SOURCE_PIXELS);
      second.visible = false;
      const hidden = captureFor(a, profile);
      assert.deepEqual(hidden.images, [a.source]); assert.deepEqual(hidden.commands.map(c => c.imageIndex), [0]);
      assert.deepEqual(first.images, [a.source, extra.source]);
      assert.deepEqual(first.commands.map(c => c.imageIndex), [0, 1]);
      assert.equal(warm.commands[0].matrix, first.commands[0].matrix);
      assert.equal(reordered.commands[1].matrix, warm.commands[0].matrix,
        'an unchanged node value is reusable even when its current image index changes');
    });
  });

  test(`IC10 ${profile}: desired text does not replace committed content; successful prepare and clear do`, async () => {
    await checkedAuthored(async a => {
      a.bitmap.visible = false;
      const text = await import('@egret/engine/text'), literal = literalProvider();
      const cache = text.createTextRasterCache(a.engine.assets, { provider: literal.provider, maxResidentEntries: 0 });
      const scope = a.engine.createScope(), field = text.createTextField(a.engine, scope, cache);
      a.engine.stage.addChild(field);
      try {
        field.setRequest(request()); await field.prepare();
        const first = captureFor(a, profile), warm = captureFor(a, profile);
        assert.equal(first.commands.length, 1); assert.equal(first.images.length, 1);
        assert.deepEqual([first.commands[0].rect.width, first.commands[0].rect.height], [12, 10]);
        const originalPixels = pixels(first.images[0]);
        assert.deepEqual(originalPixels.slice(0, 4), [17, 83, 149, 255]);
        field.setRequest(request({ text: 'B', density: 1.5 }));
        const desired = captureFor(a, profile);
        assert.deepEqual(desired.commands, first.commands); assert.equal(desired.images[0], first.images[0]);
        assert.equal(field.getStatus().committedRevision, 1);
        await field.prepare();
        const committed = captureFor(a, profile);
        assert.equal(field.getStatus().committedRevision, 2);
        assert.deepEqual([committed.images[0].width, committed.images[0].height], [17, 14]);
        assert.deepEqual([committed.commands[0].rect.width, committed.commands[0].rect.height], [34 / 3, 28 / 3]);
        assert.notEqual(committed.images[0], first.images[0]);
        field.dispose(); await cache.whenIdle();
        assert.equal(captureFor(a, profile).commands.length, 0);
        assert.equal(cache.getStatus().activeCallerLeases, 0);
        assert.deepEqual(pixels(first.images[0]), originalPixels);
        assert.equal(warm.commands[0].matrix, first.commands[0].matrix);
        assert.equal(desired.commands[0].matrix, warm.commands[0].matrix);
      } finally { scope.dispose(); cache.dispose(); await cache.whenIdle(); }
      assert.equal(field.isDisposed, true); assert.equal(scope.state, 'closed');
      assert.equal(cache.getStatus().activeCallerLeases, 0);
      assert.equal(literal.state.release, literal.state.measure);
    });
  });

  test(`IC11 ${profile}: warm text still refuses during Scope closing before leaf cleanup`, async () => {
    await checkedAuthored(async a => {
      a.bitmap.visible = false;
      const text = await import('@egret/engine/text'), literal = literalProvider();
      const cache = text.createTextRasterCache(a.engine.assets, { provider: literal.provider, maxResidentEntries: 0 });
      const scope = a.engine.createScope(), field = text.createTextField(a.engine, scope, cache);
      a.engine.stage.addChild(field);
      try {
        field.setRequest(request()); await field.prepare();
        const saved = captureFor(a, profile), warm = captureFor(a, profile), facts = {};
        assert.equal(saved.commands.length, 1); assert.equal(warm.commands.length, 1);
        scope.signal.addEventListener('abort', () => {
          facts.state = scope.state; facts.disposed = field.isDisposed;
          try { facts.unexpected = captureFor(a, profile); } catch (error) { facts.error = error; }
        });
        scope.dispose(); await cache.whenIdle();
        assert.equal(facts.state, 'closing'); assert.equal(facts.disposed, false);
        assert.equal(facts.unexpected, undefined); assert.ok(errorCode('SCOPE_CLOSED')(facts.error));
        assert.equal(field.isDisposed, true); assert.equal(scope.state, 'closed');
        assert.equal(captureFor(a, profile).commands.length, 0);
        assert.equal(cache.getStatus().activeCallerLeases, 0);
        assert.deepEqual(pixels(saved.images[0]).slice(0, 4), [17, 83, 149, 255]);
        assert.equal(warm.commands[0].matrix, saved.commands[0].matrix);
      } finally { scope.dispose(); cache.dispose(); await cache.whenIdle(); }
      assert.equal(literal.state.release, literal.state.measure);
    });
  });
}

test('IC12 textured: geometry indexes use current first occurrence while saved tables remain frozen', async () => {
  await checkedAuthored(async a => {
    a.bitmap.visible = false;
    const secondGeometry = a.geometry(0.25), second = a.scope.use(new egret.Mesh2D(a.lease, secondGeometry));
    second.x = 2; a.engine.stage.addChild(a.mesh); a.engine.stage.addChild(second);
    const first = a.textured(), warm = a.textured();
    assert.equal(first.commands.length, 2); assert.equal(first.geometries.length, 2);
    assert.deepEqual(first.commands.map(c => c.geometryIndex), [0, 1]);
    assert.deepEqual(first.geometries[0].lightColors, Array(12).fill(1));
    assert.deepEqual(first.geometries[1].lightColors, Array(12).fill(0.25));
    a.engine.stage.setChildIndex(second, 0);
    const reordered = a.textured();
    assert.deepEqual(reordered.commands.map(c => [c.matrix.tx, c.geometryIndex, c.imageIndex]), [[2, 0, 0], [0, 1, 0]]);
    assert.equal(reordered.geometries[0], first.geometries[1]); assert.equal(reordered.geometries[1], first.geometries[0]);
    assert.equal(reordered.images.length, 1); assert.deepEqual(pixels(reordered.images[0]), SOURCE_PIXELS);
    assert.deepEqual(first.commands.map(c => c.geometryIndex), [0, 1]);
    assert.equal(first.geometries[1], secondGeometry);
    assert.equal(warm.commands[0].matrix, first.commands[0].matrix);
    assert.equal(reordered.commands[1].matrix, warm.commands[0].matrix);
  });
});

test('IC13 ordinary: disposing the genuine Stage before first capture preserves legacy acceptance', async () => {
  await checkedAuthored(async a => {
    a.engine.stage.dispose();
    assert.equal(a.engine.stage.isDisposed, true);
    const first = a.capture(), second = a.capture();
    freshArrays(first, second, 'ordinary');
    assert.equal(first.commands.length, 0); assert.equal(second.commands.length, 0);
    assert.equal(first.images, undefined); assert.equal(second.images, undefined);
    assert.throws(() => a.textured(), errorCode('OBJECT_DISPOSED'));
    const third = a.capture(); assert.equal(third.frameId, 3); assert.equal(third.commands.length, 0);
    assert.equal(a.lease.value, a.texture, 'Stage cleanup does not consume the caller resource lease');
  });
});
