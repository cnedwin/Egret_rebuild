import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPixel, assertZero } from '../tools/webgpu-oracle.mjs';

test('literal painter overlap rejects reversal and double premultiplication', () => {
  for (const actual of [[128,0,64,191], [32,0,64,191]]) {
    assert.throws(() => assertPixel(actual, [64,0,128,191], 'painter-overlap'), /painter-overlap/);
  }
});
test('common UNORM tolerance is two inclusive and never three', () => {
  assertPixel([126,2,0,126], [128,0,0,128], 'rounding');
  assert.throws(() => assertPixel([125,0,0,128], [128,0,0,128], 'rounding'), /rounding/);
});
test('transparent black is exact, including hidden RGB', () => {
  assertPixel([0,0,0,0], [0,0,0,0], 'clear');
  assert.throws(() => assertPixel([1,0,0,0], [0,0,0,0], 'clear'), /clear/);
});
test('empty reset scans every byte, rather than only selected sample points', () => {
  const bytes = new Uint8Array(48*40*4);
  assertZero(bytes, 'empty-reset-all-zero');
  bytes[bytes.length - 3] = 1;
  assert.throws(() => assertZero(bytes, 'empty-reset-all-zero'), /empty-reset-all-zero/);
});
