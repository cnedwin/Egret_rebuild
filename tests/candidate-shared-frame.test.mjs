// SPDX-License-Identifier: Apache-2.0
// Preparation only: no execution receipt is implied by these public behavior drafts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deferred } from './helpers.mjs';
import { egret, FRAME, fixture, candidate, requireCandidate, hasCode, expectCode,
  imageDraw, frameShape, fieldSnapshot, assertFrozenFrame } from './candidate-shared-frame-fixture.mjs';

test('CANDIDATE C00 genuine ordinary commit changes complete geometry and public bounds', async () => fixture(async f => {
  const before = fieldSnapshot(f), old = f.capture(), prepared = await f.prepare();
  assert.deepEqual(fieldSnapshot(f), before);
  prepared.ticket.commit(); const committed = f.capture();
  assert.equal(imageDraw(committed).rect.width, 64); assert.equal(f.target.naturalWidth, 64);
  assert.deepEqual(f.inner.getBounds(), { x: 0, y: 0, width: 64, height: 64 });
  assert.deepEqual(f.outer.getBounds(), { x: 3, y: 4, width: 64, height: 128 });
  assert.notDeepEqual(frameShape(old), frameShape(committed));
  assert.equal(f.old.lease.value.isDisposed, false); assert.deepEqual(f.disposals, []);
}));

test('CANDIDATE C01 publish-before-capture control visibly violates the old-binding isolation oracle', async () => fixture(async f => {
  const old = fieldSnapshot(f), prepared = await f.prepare();
  // Deliberate caller mistake: this is not the candidate implementation.
  f.target.textureLease = prepared.lease;
  assert.notEqual(f.target.textureLease, old.lease); assert.equal(imageDraw(f.capture()).rect.width, 64);
  expectCode(() => prepared.ticket.commit(), 'BITMAP_RESOURCE_BINDING_CHANGED');
}));

test('CANDIDATE B01 availability follows genuine Engine, group, ticket and ordinary capture baseline', async () => fixture(async f => {
  const prepared = await f.prepare(); assert.equal(f.target.textureLease, f.old.lease);
  requireCandidate(f.engine);
  const saved = candidate(f, prepared.ticket); assert.equal(saved.profile, 'egret.shared-frame2d/1');
  assert.equal(saved.pages[0].source, prepared.image); assertFrozenFrame(saved);
}));

test('CANDIDATE B02 16-to-64 transformed/clipped witness matches separately committed reference without live pollution', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine);
  const fields = fieldSnapshot(f), ordinary = frameShape(f.capture());
  const legacy = f.engine.captureFrame(FRAME), textured = f.engine.captureTexturedFrame(FRAME);
  const saved = candidate(f, prepared.ticket), draw = imageDraw(saved);
  assert.deepEqual(draw.rect, { x: 0, y: 0, width: 64, height: 64 });
  assert.deepEqual(draw.matrix, { a: 2, b: 0, c: 0, d: 3, tx: 11, ty: 13 });
  assert.deepEqual(draw.clips, [
    { matrix: { a: 2, b: 0, c: 0, d: 1.5, tx: 5, ty: 7 }, rect: { x: 0, y: 0, width: 50, height: 46 } },
    { matrix: { a: 2, b: 0, c: 0, d: 3, tx: 11, ty: 13 }, rect: { x: 2, y: 1, width: 40, height: 32 } },
  ]);
  // Literal axis-aligned witness arithmetic, not a copied scene or clipping algorithm.
  assert.deepEqual([Math.max(11, 5, 15), Math.max(13, 7, 16), Math.min(11 + 2 * draw.rect.width, 105, 95),
    Math.min(13 + 3 * draw.rect.height, 76, 112)], [15, 16, 95, 76]);
  assert.deepEqual([Math.max(11, 5, 15), Math.max(13, 7, 16), Math.min(11 + 2 * 16, 105, 95),
    Math.min(13 + 3 * 16, 76, 112)], [15, 16, 43, 61]);
  await fixture(async reference => {
    const replacement = await reference.prepare(); replacement.ticket.commit();
    assert.deepEqual(frameShape(saved), frameShape(reference.capture()));
  });
  assert.deepEqual(fieldSnapshot(f), fields); assert.deepEqual(frameShape(f.capture()), ordinary);
  for (const [next, previous] of [[f.engine.captureFrame(FRAME), legacy], [f.engine.captureTexturedFrame(FRAME), textured]]) {
    const { frameId: ignoredNext, ...nextContent } = next, { frameId: ignoredOld, ...oldContent } = previous;
    assert.deepEqual(nextContent, oldContent);
  }
  assert.equal(f.neighbor.x, 140); assert.equal(f.neighbor.y, 1);
  prepared.ticket.commit(); assert.equal(f.target.textureLease, prepared.lease);
  assert.deepEqual(frameShape(f.capture()), frameShape(saved));
}));

test('CANDIDATE B03 full Texture view metadata replaces old crop and automatic geometry', async () => fixture(async f => {
  const view = { packed: { x: 2, y: 3, width: 4, height: 7 }, logicalWidth: 64, logicalHeight: 48,
    trimX: 5, trimY: 6, quarterTurn: 1 };
  f.target.sourceRect = { x: 2, y: 1, width: 3, height: 5 };
  const prepared = await f.prepare({ width: 16, height: 16, view }); requireCandidate(f.engine);
  const fields = fieldSnapshot(f), saved = candidate(f, prepared.ticket), draw = imageDraw(saved);
  assert.deepEqual(draw.rect, { x: 0, y: 0, width: 64, height: 48 });
  assert.deepEqual(saved.regions[draw.regionIndex], { pageIndex: 0, ...view });
  assert.deepEqual(fieldSnapshot(f), fields);
  f.target.sharedMaterial = egret.createSharedMaterial2D({ samplingDomain: 'page' });
  const pageView = candidate(f, prepared.ticket);
  assert.deepEqual(imageDraw(pageView).rect, { x: 5, y: 6, width: 7, height: 4 });
  assert.deepEqual(fieldSnapshot(f), fields);
  prepared.ticket.commit(); assert.deepEqual(frameShape(f.capture()), frameShape(pageView));
}));

test('CANDIDATE B04 repeated captures share ordinary frame IDs and never commit, render or tick', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine);
  let ticks = 0; f.engine.clock.onTick(f.bindingScope, () => { ticks++; });
  f.engine.advanceTime(10); f.engine.advanceTime(10.125);
  const before = f.capture(), first = candidate(f, prepared.ticket), second = candidate(f, prepared.ticket);
  const after = f.engine.captureTexturedFrame(FRAME);
  assert.deepEqual([first.frameId, second.frameId, after.frameId], [before.frameId + 1, before.frameId + 2, before.frameId + 3]);
  assert.notEqual(first, second); assert.deepEqual(frameShape(first), frameShape(second));
  assert.equal(f.target.textureLease, f.old.lease); assert.equal(ticks, 1); assert.equal(f.engine.clock.elapsedSeconds, .125);
  assert.deepEqual(f.port.trace, ['start']); prepared.ticket.commit();
}));

test('CANDIDATE B05 ticket authenticity and phase precede caller option reads', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine);
  let reads = 0; const options = { get width() { reads++; throw Error('must not read options'); } };
  const spoof = new Proxy({}, { get() { throw Error('must not read ticket'); } });
  for (const value of [null, undefined, {}, { ...prepared.ticket }, new Proxy(prepared.ticket, {}), spoof]) {
    expectCode(() => candidate(f, value, options), 'BITMAP_BINDING_INVALID');
  }
  await fixture(async foreign => {
    const other = await foreign.prepare(); expectCode(() => candidate(f, other.ticket, options), 'BITMAP_BINDING_INVALID');
  });
  const captured = f.engine.captureBitmapBindings(f.bindingScope, [f.target]);
  expectCode(() => candidate(f, captured, options), 'BITMAP_BINDING_STATE_INVALID');
  captured.dispose(); expectCode(() => candidate(f, captured, options), 'BITMAP_BINDING_DISPOSED');
  prepared.ticket.commit(); expectCode(() => candidate(f, prepared.ticket, options), 'BITMAP_BINDING_STATE_INVALID');
  assert.equal(reads, 0);
}));

test('CANDIDATE B06 shared busy barrier applies across candidate, ordinary and clock callbacks', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine); const errors = [];
  const before = f.capture();
  const saved = candidate(f, prepared.ticket, { get width() {
    for (const invoke of [() => candidate(f, prepared.ticket), () => f.capture(), () => f.engine.captureFrame(FRAME)]) {
      try { invoke(); } catch (error) { errors.push(error); }
    }
    return 160;
  }, height: 128 });
  assert.equal(errors.length, 3); assert.ok(errors.every(hasCode('FRAME_REENTRANT'))); assert.equal(saved.frameId, before.frameId + 1);
  let tickError; f.engine.clock.onTick(f.bindingScope, () => { try { candidate(f, prepared.ticket); } catch (error) { tickError = error; } });
  f.engine.advanceTime(20); f.engine.advanceTime(20.125); assert.ok(hasCode('CLOCK_REENTRANT')(tickError));
  assert.equal(f.capture().frameId, saved.frameId + 1);
}));

test('CANDIDATE B07 option reads preserve cause/order and refusal spends no frame ID or prepared authority', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine); const before = f.capture(), trace = [];
  const options = Object.defineProperties({}, Object.fromEntries(['width', 'height', 'clearColor', 'clearAlpha', 'outputAlpha'].map(key => [key, {
    get() { trace.push(key); if (key === 'outputAlpha') throw undefined; return key === 'width' ? -1 : undefined; },
  }])));
  assert.throws(() => candidate(f, prepared.ticket, options), error => hasCode('INVALID_FRAME_OPTIONS')(error) && error.cause === undefined);
  assert.deepEqual(trace, ['width', 'height', 'clearColor', 'clearAlpha', 'outputAlpha']);
  expectCode(() => candidate(f, prepared.ticket, { ...FRAME, outputAlpha: 'opaque', clearAlpha: 0 }), 'INVALID_FRAME_OPTIONS');
  const valid = { ...FRAME, outputAlpha: 'opaque' }; Object.defineProperty(valid, 'overrides', { get() { throw Error('unselected option read'); } });
  const saved = candidate(f, prepared.ticket, valid); assert.equal(saved.frameId, before.frameId + 1); assert.equal(saved.clearAlpha, 1);
  prepared.ticket.commit(); assert.equal(f.target.textureLease, prepared.lease);
}));

test('CANDIDATE B08 option getter binding ABA invalidates capture before any candidate publication', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine); const before = f.capture();
  expectCode(() => candidate(f, prepared.ticket, { get width() { f.target.textureLease = f.old.lease; return 160; }, height: 128 }),
    'BITMAP_RESOURCE_BINDING_CHANGED');
  assert.equal(f.target.textureLease, f.old.lease); assert.equal(f.target.naturalWidth, 16);
  expectCode(() => prepared.ticket.commit(), 'BITMAP_RESOURCE_BINDING_CHANGED');
  assert.equal(f.capture().frameId, before.frameId + 1); assert.deepEqual(f.disposals, []);
}));

test('CANDIDATE B09 ticket Scope close during caller read revokes capture and preserves old scene', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine); const before = f.capture();
  expectCode(() => candidate(f, prepared.ticket, { get width() { f.bindingScope.dispose(); return 160; }, height: 128 }), 'SCOPE_CLOSED');
  assert.equal(f.target.textureLease, f.old.lease); assert.equal(f.capture().frameId, before.frameId + 1);
  assert.equal(prepared.lease.value.isDisposed, false); assert.deepEqual(f.disposals, []);
}));

test('CANDIDATE B10 old and candidate entitlements are fresh even for hidden ticket targets', async () => {
  for (const selected of ['old', 'candidate']) await fixture(async f => {
    const prepared = await f.prepare(); requireCandidate(f.engine); f.target.visible = false;
    const before = f.capture(); (selected === 'old' ? f.old.lease : prepared.lease).release();
    expectCode(() => candidate(f, prepared.ticket), 'ASSET_LEASE_RELEASED');
    assert.equal(f.capture().frameId, before.frameId + 1);
    assert.equal(f.target.textureLease, f.old.lease);
  });
});

test('CANDIDATE B11 target mutation guard and private state reads ignore public own accessors', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine);
  let forbiddenReads = 0;
  for (const key of ['textureLease', 'sourceRect', 'naturalWidth', 'naturalHeight', 'getBounds']) {
    Object.defineProperty(f.target, key, { configurable: true, get() { forbiddenReads++; throw Error('public Bitmap property read'); } });
  }
  try { assert.equal(imageDraw(candidate(f, prepared.ticket)).rect.width, 64); }
  finally { for (const key of ['textureLease', 'sourceRect', 'naturalWidth', 'naturalHeight', 'getBounds']) delete f.target[key]; }
  assert.equal(forbiddenReads, 0);
  let nestedError;
  f.target.sourceRect = { get x() { try { candidate(f, prepared.ticket); } catch (error) { nestedError = error; } return 0; }, y: 0, width: 8, height: 8 };
  assert.ok(hasCode('BITMAP_MUTATION_REENTRANT')(nestedError));
  assert.equal(f.target.naturalWidth, 8); assert.equal(f.target.textureLease, f.old.lease);
}));

test('CANDIDATE B12 saved frame survives await and non-binding scene edits; commit does not invent scene conflict', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine); const saved = candidate(f, prepared.ticket), shape = frameShape(saved);
  const gate = deferred(); const resumed = gate.promise.then(() => {
    assert.deepEqual(frameShape(saved), shape); prepared.ticket.commit();
  });
  f.target.x = 9; f.outer.alpha = .5; f.inner.clipRect = { x: 1, y: 2, width: 20, height: 25 };
  f.neighbor.x = 100; f.engine.stage.setChildIndex(f.neighbor, 0);
  gate.resolve(); await resumed;
  assert.equal(f.target.textureLease, prepared.lease); assert.deepEqual(frameShape(saved), shape);
  const current = f.capture(); assert.notDeepEqual(frameShape(current), shape);
  assert.equal(imageDraw(current).matrix.tx, 29); assert.equal(imageDraw(current).opacity, .5);
  assert.equal(current.commands[0].kind, 'rect'); assert.equal(f.neighbor.x, 100);
}));

test('CANDIDATE B13 saved frame stays immutable but binding edits during await still reject commit', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine); const saved = candidate(f, prepared.ticket), shape = frameShape(saved);
  const gate = deferred(), resumed = gate.promise.then(() => expectCode(() => prepared.ticket.commit(), 'BITMAP_RESOURCE_BINDING_CHANGED'));
  f.target.sourceRect = { x: 0, y: 0, width: 8, height: 8 }; gate.resolve(); await resumed;
  assert.deepEqual(frameShape(saved), shape); assert.equal(f.target.textureLease, f.old.lease);
  assert.equal(imageDraw(f.capture()).rect.width, 8); assert.equal(prepared.lease.value.isDisposed, false);
}));

test('CANDIDATE B14 candidate resource participates in the existing 64-image frame cap', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine);
  f.add(new egret.Bitmap(f.old.lease));
  const extras = [];
  for (let index = 0; index < 63; index++) {
    const item = await f.resource(1, 1, [index, 19, 37, 255]); extras.push(f.add(new egret.Bitmap(item.lease)));
  }
  const before = f.capture(); assert.equal(before.pages.length, 64);
  expectCode(() => candidate(f, prepared.ticket), 'FRAME_IMAGE_BUDGET');
  extras[0].dispose(); const accepted = candidate(f, prepared.ticket);
  assert.equal(accepted.pages.length, 64); assert.equal(accepted.frameId, before.frameId + 1);
  assert.equal(f.target.textureLease, f.old.lease);
}));

test('CANDIDATE B15 hidden all-tree authoring admission is shared by ordinary and candidate capture', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine);
  const hidden = f.add(new egret.Sprite()); hidden.visible = false; hidden.graphics.beginFill(0x112233);
  // Target Bitmap plus neighbor rect plus these 65534 hidden rects reaches the existing 65536 unit cap.
  for (let index = 0; index < 65534; index++) hidden.graphics.drawRect(0, 0, 1, 1);
  hidden.graphics.endFill(); const before = candidate(f, prepared.ticket);
  hidden.graphics.beginFill(0x112233).drawRect(0, 0, 1, 1).endFill();
  expectCode(() => candidate(f, prepared.ticket), 'FRAME_BUDGET_EXCEEDED');
  expectCode(() => f.capture(), 'FRAME_BUDGET_EXCEEDED');
  hidden.dispose(); assert.equal(candidate(f, prepared.ticket).frameId, before.frameId + 1);
}));

test('CANDIDATE B16 capture refuses after Engine close and retains a completed immutable snapshot', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine); const saved = candidate(f, prepared.ticket), shape = frameShape(saved);
  const closing = f.engine.dispose(); expectCode(() => candidate(f, prepared.ticket), 'ENGINE_CLOSED');
  await closing; expectCode(() => candidate(f, prepared.ticket), 'ENGINE_CLOSED');
  assert.deepEqual(frameShape(saved), shape); assertFrozenFrame(saved);
}));

test('CANDIDATE B17 complete two-target view and second-target conflict never publish a prefix', async () => fixture(async f => {
  const secondOld = await f.resource(3, 5, [19, 53, 23, 255], undefined, f.oldScope);
  const second = f.add(new egret.Bitmap(secondOld.lease)); second.x = 40;
  const ticket = f.engine.captureBitmapBindings(f.bindingScope, [f.target, second]);
  const left = await f.resource(64, 64), right = await f.resource(9, 7);
  ticket.prepare([left.lease, right.lease]); requireCandidate(f.engine);
  const saved = candidate(f, ticket), images = saved.commands.filter(command => command.kind === 'image');
  assert.deepEqual(images.map(command => [command.rect.width, command.rect.height]), [[64, 64], [9, 7]]);
  assert.equal(f.target.textureLease, f.old.lease); assert.equal(second.textureLease, secondOld.lease);
  second.textureLease = secondOld.lease;
  expectCode(() => candidate(f, ticket), 'BITMAP_RESOURCE_BINDING_CHANGED');
  expectCode(() => ticket.commit(), 'BITMAP_RESOURCE_BINDING_CHANGED');
  assert.equal(f.target.textureLease, f.old.lease); assert.equal(second.textureLease, secondOld.lease);
  assert.equal(imageDraw(f.capture()).rect.width, 16); assert.deepEqual(f.disposals, []);
}));

test('CANDIDATE B18 Engine close from an option getter shares the existing frame idle barrier', async () => fixture(async f => {
  const prepared = await f.prepare(); requireCandidate(f.engine); let closing;
  expectCode(() => candidate(f, prepared.ticket, { get width() { closing = f.engine.dispose(); return 160; }, height: 128 }), 'ENGINE_CLOSED');
  assert.ok(closing instanceof Promise); await closing;
  assert.deepEqual(f.port.trace, ['start', 'stop', 'close']);
}));

test('CANDIDATE B19 disposal and source lifetime revoke candidate capture without owning replacement leases', async () => {
  for (const selected of ['ticket', 'target', 'texture']) await fixture(async f => {
    const prepared = await f.prepare(); requireCandidate(f.engine);
    const cause = selected === 'ticket' ? 'BITMAP_BINDING_DISPOSED' : selected === 'target' ? 'OBJECT_DISPOSED' : 'TEXTURE_DISPOSED';
    if (selected === 'ticket') prepared.ticket.dispose();
    else if (selected === 'target') f.target.dispose();
    else prepared.texture.dispose();
    expectCode(() => candidate(f, prepared.ticket), cause);
    assert.equal(f.old.lease.value.isDisposed, false); assert.deepEqual(f.disposals, []);
    if (selected !== 'texture') assert.equal(prepared.lease.value.isDisposed, false);
  });
});

test('CANDIDATE B20 terminal or committed ticket state outranks a caller-thrown undefined option', async () => {
  for (const selected of ['ticket', 'scope', 'engine', 'commit']) await fixture(async f => {
    const prepared = await f.prepare(); requireCandidate(f.engine); let closing;
    const expected = selected === 'ticket' ? 'BITMAP_BINDING_DISPOSED' : selected === 'scope' ? 'SCOPE_CLOSED'
      : selected === 'engine' ? 'ENGINE_CLOSED' : 'BITMAP_BINDING_STATE_INVALID';
    expectCode(() => candidate(f, prepared.ticket, { get width() {
      if (selected === 'ticket') prepared.ticket.dispose();
      else if (selected === 'scope') f.bindingScope.dispose();
      else if (selected === 'engine') closing = f.engine.dispose();
      else prepared.ticket.commit();
      throw undefined;
    }, height: 128 }), expected);
    if (closing !== undefined) await closing;
    else assert.equal(f.target.textureLease, selected === 'commit' ? prepared.lease : f.old.lease);
  });
});

test('CANDIDATE B21 failed options do not enter target, binding or lease capture preflight', async () => {
  for (const selected of ['lease', 'target', 'binding']) await fixture(async f => {
    const prepared = await f.prepare(); requireCandidate(f.engine); const cause = Object.freeze({ failedOptions: selected });
    assert.throws(() => candidate(f, prepared.ticket, { get width() {
      if (selected === 'lease') prepared.lease.release();
      else if (selected === 'target') f.target.dispose();
      else f.target.textureLease = f.old.lease;
      throw cause;
    }, height: 128 }), error => hasCode('INVALID_FRAME_OPTIONS')(error) && error.cause === cause);
    const expected = selected === 'lease' ? 'ASSET_LEASE_RELEASED' : selected === 'target' ? 'OBJECT_DISPOSED' : 'BITMAP_RESOURCE_BINDING_CHANGED';
    expectCode(() => candidate(f, prepared.ticket), expected);
  });
});
