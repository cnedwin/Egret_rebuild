import test from 'node:test';
import assert from 'node:assert/strict';
import { request, fixture, errorIs } from './text-raster-public-helpers.mjs';

// Factory-only authority is tested through genuine public objects. No private
// constructor import, fake lease, state hook or new public error is introduced.
test('TF01 supplemental: reflected runtime constructor cannot grant field authority', async (t) => {
  const base = await fixture(t, {}, { maxResidentEntries: 0 });
  const text = await import('@egret/engine/text');
  const scope = base.engine.createScope();
  const field = text.createTextField(base.engine, scope, base.cache);
  base.engine.stage.addChild(field); field.setRequest(request());
  await field.prepare(); await base.cache.whenIdle();
  const before = field.getStatus();
  const frame = base.engine.captureFrame({ width: 80, height: 80 });
  assert.equal(frame.commands.length, 1);
  assert.equal(base.cache.getStatus().activeCallerLeases, 1);
  const Constructor = field.constructor;
  assert.equal(typeof Constructor, 'function');
  let reads = 0;
  const forgedCache = new Proxy({}, { get() {
    reads++; throw new Error('reflected constructor must not read a forged cache port');
  } });
  for (const args of [[scope, forgedCache], [scope, base.cache]]) {
    assert.throws(() => Reflect.construct(Constructor, args),
      errorIs('TEXT_FIELD_INVALID'));
  }
  assert.equal(reads, 0);
  assert.deepEqual(field.getStatus(), before);
  assert.equal(base.cache.getStatus().activeCallerLeases, 1);
  assert.equal(base.state.measure, 1); assert.equal(base.state.raster, 1);
  assert.equal(base.engine.captureFrame({ width: 80, height: 80 }).images[0], frame.images[0]);
  const otherScope = base.engine.createScope();
  const other = text.createTextField(base.engine, otherScope, base.cache);
  other.setRequest(request()); await other.prepare(); await base.cache.whenIdle();
  base.engine.stage.addChild(other);
  const after = base.engine.captureFrame({ width: 80, height: 80 });
  assert.equal(after.commands.length, 2); assert.equal(after.images.length, 1);
  assert.equal(after.images[0], frame.images[0]);
  assert.equal(base.cache.getStatus().activeCallerLeases, 2);
  scope.dispose();
  assert.equal(field.isDisposed, true); assert.equal(other.isDisposed, false);
  assert.equal(base.cache.getStatus().activeCallerLeases, 1);
  otherScope.dispose(); await base.cache.whenIdle();
  assert.equal(base.cache.getStatus().activeCallerLeases, 0);
  assert.equal(base.cache.getStatus().closed, false);
});
