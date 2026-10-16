// SPDX-License-Identifier: Apache-2.0
// Controlled browser port only: this CPU composition is not native acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, visible, fulfilled, rejected, flush, CROP_A } from './bitmap-resource-slot-fixtures.mjs';
import { controlledBrowser } from './bitmap-resource-slot-controlled-browser.mjs';

test('BRS30 independent BitmapButtons retain shared input/skins while controlling an ordinary slot', async () => {
  const browser = controlledBrowser(); let f;
  browser.install();
  try {
    const { createBitmapButton, createMouseInput } = await import('@egret/engine/web/input');
    f = await scene({ hostOverrides: { surface: browser.canvas } });
    const controls = f.engine.createScope(), input = createMouseInput({ engine: f.engine, scope: controls, width: 32, height: 32 });
    const skins = {
      up: { x: 0, y: 0, width: 1, height: 1 },
      pressed: { x: 1, y: 0, width: 1, height: 1 },
      disabled: { x: 0, y: 1, width: 1, height: 1 },
    };
    let pending; const activations = [], reason = Object.freeze({ cancel: 'independent Button' });
    const options = { engine: f.engine, scope: controls, input, textureLease: f.initialLease, skins };
    const request = createBitmapButton({ ...options, onActivate() { activations.push('replace'); pending = f.replace('B'); } });
    const cancel = createBitmapButton({ ...options, onActivate() { activations.push('cancel'); f.slot.cancel(reason); } });
    Object.assign(request.display, { x: 8, y: 8 }); Object.assign(cancel.display, { x: 12, y: 8 });
    f.engine.stage.addChild(request.display); f.engine.stage.addChild(cancel.display);
    function click(x, y) {
      const point = { clientX: 10 + x * 200 / 32, clientY: 20 + y * 160 / 32 };
      browser.emit(browser.canvas, 'pointerdown', point); browser.emit(browser.window, 'pointerup', point);
    }
    click(8.5, 8.5); assert.ok(pending); assert.equal(f.slot.state, 'pending'); visible(f);
    click(12.5, 8.5);
    assert.equal((await rejected(pending, 'BITMAP_RESOURCE_CANCELLED')).cause, reason);
    assert.equal(input.state, 'idle'); assert.equal(request.state, 'up'); assert.equal(cancel.state, 'up'); visible(f);
    click(8.5, 8.5); f.job('B').resolve(f.values.get('B')); await fulfilled(pending); visible(f, 'B');
    click(12.5, 8.5); assert.equal(f.slot.state, 'ready');
    assert.deepEqual(activations, ['replace', 'cancel', 'replace', 'cancel']);
    assert.equal(request.display.textureLease, f.initialLease); assert.equal(cancel.display.textureLease, f.initialLease);
    assert.deepEqual(request.display.sourceRect, skins.up); assert.deepEqual(cancel.display.sourceRect, skins.up);
    assert.equal(f.initialLease.value, f.values.get('A')); assert.equal(f.count(f.values.get('A')), 0);
    f.slot.dispose(); assert.equal(f.bitmap.textureLease, undefined);
    request.enabled = false; assert.equal(request.state, 'disabled'); assert.deepEqual(request.display.sourceRect, skins.disabled);
    request.enabled = true; assert.equal(request.state, 'up'); assert.equal(input.state, 'idle');
    assert.equal(cancel.state, 'up'); assert.equal(f.initialLease.value, f.values.get('A')); await flush();
  } finally {
    try { if (f !== undefined) await f.close(); }
    finally { browser.recover(); browser.restore(); }
  }
});
