// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {createSequenceController} from '@egret/engine/animation';
import {host} from './helpers.mjs';

async function fixture() {
  const port = host();
  const engine = await egret.createEngine({host: port.adapter});
  const resources = engine.createScope();
  const image = egret.createImageData2D({width: 2, height: 1,
    pixels: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255])});
  const texture = egret.createTexture(image);
  const type = egret.createAssetType('sequence-controller-integration', egret.isTexture);
  let loads = 0, releases = 0;
  engine.assets.register(type, {async load() { loads++; return texture; },
    dispose(value) { releases++; value.dispose(); }});
  const lease = resources.use(await engine.assets.acquire(egret.createAssetRef(type, 'atlas')));
  const clip = egret.createSequenceClip({atlasWidth: 2, atlasHeight: 1, frames: [
    {x: 0, y: 0, width: 1, height: 1, durationSeconds: 0.5},
    {x: 1, y: 0, width: 1, height: 1, durationSeconds: 0.5},
  ]});
  return {engine, resources, clip, port,
    bitmap: () => resources.use(new egret.Bitmap(lease)),
    controller(scope, bitmap) { return createSequenceController(engine, scope, bitmap, clip,
      {profile: 'egret.sequence-control/1'}); },
    async close() {
      await engine.dispose();
      assert.deepEqual([loads, releases], [1, 1]);
      assert.equal(port.timers.size, 0);
    },
  };
}
function code(action, expected) { assert.throws(action, error => error.code === expected); }

test('SCI01 original and optional profiles claim idle targets in both orders', async () => {
  const f = await fixture();
  try {
    const oldScope = f.engine.createScope(), newScope = f.engine.createScope();
    const target = f.bitmap();
    const old = f.engine.createSequencePlayback(oldScope, target, f.clip);
    code(() => f.controller(newScope, target), 'ANIMATION_TARGET_BUSY');
    assert.equal(old.state, 'idle');
    old.stop();
    const next = f.controller(newScope, target);
    code(() => f.engine.createSequencePlayback(oldScope, target, f.clip), 'SEQ_PLAYBACK_TARGET_BUSY');
    oldScope.dispose();
    assert.equal(next.getStatus().state, 'idle', 'historical old handle cannot release the new claim');
    const other = f.engine.createScope();
    code(() => f.engine.createSequencePlayback(other, target, f.clip), 'SEQ_PLAYBACK_TARGET_BUSY');
    next.dispose();
    const final = f.engine.createSequencePlayback(other, target, f.clip);
    newScope.dispose();
    assert.equal(final.state, 'idle');
    code(() => f.controller(f.engine.createScope(), target), 'ANIMATION_TARGET_BUSY');
    final.start();
    assert.equal(final.lastSample.frameIndex, 0);
  } finally { await f.close(); }
});

test('SCI02 combined 256 target claims preserve original capacity-before-payload refusal', async () => {
  const f = await fixture();
  try {
    const scope = f.engine.createScope();
    const modern = Array.from({length: 64}, () => f.controller(scope, f.bitmap()));
    for (let i = 0; i < 192; i++) f.engine.createSequencePlayback(scope, f.bitmap(), f.clip);
    let reads = 0;
    code(() => f.engine.createSequencePlayback(scope, null, null,
      {get mode() { reads++; return 'once'; }}), 'SEQ_PLAYBACK_LIMIT');
    assert.equal(reads, 0);
    modern[0].stop();
    const target = f.bitmap();
    const old = f.engine.createSequencePlayback(scope, target, f.clip);
    assert.equal(old.state, 'idle');
    code(() => f.engine.createSequencePlayback(scope, target, f.clip), 'SEQ_PLAYBACK_LIMIT');
    modern[0].dispose();
    code(() => f.engine.createSequencePlayback(scope, target, f.clip), 'SEQ_PLAYBACK_LIMIT');
  } finally { await f.close(); }
});

test('SCI03 cross-profile option reentry cannot overfill the shared inventory', async () => {
  const f = await fixture();
  try {
    const scope = f.engine.createScope();
    for (let i = 0; i < 63; i++) f.controller(scope, f.bitmap());
    for (let i = 0; i < 192; i++) f.engine.createSequencePlayback(scope, f.bitmap(), f.clip);
    const lateTarget = f.bitmap(), refusedTarget = f.bitmap();
    let accepted, reads = 0;
    code(() => f.engine.createSequencePlayback(scope, refusedTarget, f.clip, {
      get mode() { reads++; accepted = f.controller(scope, lateTarget); return 'once'; },
    }), 'SEQ_PLAYBACK_LIMIT');
    assert.equal(reads, 1);
    assert.equal(accepted.getStatus().state, 'idle');
    accepted.stop();
    const recovered = f.engine.createSequencePlayback(scope, refusedTarget, f.clip);
    recovered.start();
    assert.equal(recovered.lastSample.frameIndex, 0);
  } finally { await f.close(); }
});

test('SCI04 optional assembly captures original Engine clock and Scope lifetime operations', async () => {
  const f = await fixture();
  try {
    const scope = f.engine.createScope();
    const originalClock = f.engine.clock;
    const originalDispose = Object.getPrototypeOf(scope).dispose;
    const shadow = () => { throw new Error('public shadow must not become authority'); };
    Object.defineProperty(f.engine, 'clock', {get: shadow, configurable: true});
    Object.defineProperty(f.engine, 'createScope', {value: shadow, configurable: true});
    Object.defineProperty(scope, 'signal', {get: shadow, configurable: true});
    Object.defineProperty(scope, 'state', {get: shadow, configurable: true});
    Object.defineProperty(scope, 'use', {value: shadow, configurable: true});
    const controller = f.controller(scope, f.bitmap());
    controller.start();
    f.engine.advanceTime(0);
    f.engine.advanceTime(0.25);
    assert.equal(originalClock.elapsedSeconds, 0.25);
    assert.equal(controller.getStatus().elapsedSeconds, 0.25);
    Reflect.apply(originalDispose, scope, []);
    assert.equal(controller.getStatus().state, 'stopped');
    assert.equal(controller.getStatus().isDisposed, true);
  } finally { await f.close(); }
});

test('SCI05 the optional controller does not expand root public exports', () => {
  assert.equal('createSequenceController' in egret, false);
  assert.equal(typeof createSequenceController, 'function');
});
