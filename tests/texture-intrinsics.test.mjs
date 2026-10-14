// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageData2D, createTexture, isTexture } from '@egret/engine';

// A normal isolated test worker restores the global function before fallback cleanup.
test('TXI01 genuine Texture operations retain the original freeze intrinsic', () => {
  const image = createImageData2D({ width: 4, height: 4, pixels: new Uint8Array(64).fill(255) });
  const original = createTexture(image);
  assert.equal(isTexture(original), true);
  assert.equal(original.imageData, image);
  assert.equal(original.isDisposed, false);
  const freeze = Object.freeze;
  let replacementCalls = 0, cropped;
  try {
    Object.freeze = value => { replacementCalls++; return freeze(value); };
    assert.equal(original.imageData, image);
    cropped = createTexture(image, { x: 1, y: 1, width: 2, height: 2 });
    assert.equal(isTexture(cropped), true);
    assert.equal(cropped.imageData, image);
    assert.deepEqual(cropped.sourceRect, { x: 1, y: 1, width: 2, height: 2 });
    original.dispose(); cropped.dispose();
    assert.equal(original.isDisposed, true); assert.equal(cropped.isDisposed, true);
  } finally {
    Object.freeze = freeze;
    original.dispose(); cropped?.dispose();
  }
  assert.equal(Object.freeze, freeze);
  assert.equal(replacementCalls, 0, 'TEXTURE_CAPTURED_FREEZE_REQUIRED');
});
