// SPDX-License-Identifier: Apache-2.0
// A transform that is all but the identity (a shake that has died away, a turn
// of a millionth of a degree) is drawn as the identity instead of refused.
import assert from 'node:assert/strict';
import test from 'node:test';
import { coordinate } from '../packages/engine/dist/rendering/prepareRectangles2D.js';

test('TT01 magnitudes below 2^-100 are taken as zero; ordinary and large ones are kept', () => {
  for (const tiny of [1e-31, -1e-35, 2 ** -101, 5e-324, -5e-324])
    assert.equal(Object.is(coordinate(tiny), 0), true, String(tiny));
  for (const kept of [2 ** -100, 1e-30, -1e-7, 0.5, 123.25, 2 ** 20, -(2 ** 20)]) assert.equal(coordinate(kept), kept);
  assert.equal(Object.is(coordinate(-0), 0), true);
});

test('TT02 numbers that are not finite or are beyond the range are still refused', () => {
  for (const bad of [NaN, Infinity, -Infinity, 2 ** 20 + 1, -(2 ** 21)])
    assert.throws(
      () => coordinate(bad),
      error => error?.reason === 'range' || error?.cause?.reason === 'range' || /range/.test(String(error))
    );
});
