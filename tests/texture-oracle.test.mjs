import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedUploadRGBA, expectedEncodedOver, assertTexturePixel} from '../tools/texture-oracle.mjs';

// All expected tuples/numerators below are fixed independently of the helper.
const uploadCases = [
  [0, [0, 0, 0, 0]], [1, [1, 0, 0, 1]],
  [127, [127, 16, 4, 127]], [128, [128, 16, 4, 128]],
  [254, [254, 32, 8, 254]], [255, [255, 32, 8, 255]],
];
for (const [alpha, expected] of uploadCases) {
  test('integer upload independently fixes alpha ' + alpha, () => {
    assert.deepEqual(expectedUploadRGBA([255, 32, 8, alpha]), expected);
  });
}
test('upload removes hidden transparent colors and publishes positive zeros', () => {
  assert.deepEqual(expectedUploadRGBA([255, 192, 127, 0]), [0, 0, 0, 0]);
  for (const value of expectedUploadRGBA([-0, -0, -0, -0])) assert.equal(Object.is(value, -0), false);
});
test('upload is fresh caller-owned storage and leaves frozen input unchanged', () => {
  const source = Object.freeze([255, 32, 8, 128]);
  const first = expectedUploadRGBA(source), second = expectedUploadRGBA(source);
  assert.notEqual(first, second);
  first[0] = 9;
  assert.deepEqual(second, [128, 16, 4, 128]);
  assert.deepEqual(source, [255, 32, 8, 128]);
});
test('encoded over applies opacity once over a transparent destination', () => {
  assert.deepEqual(expectedEncodedOver([128, 16, 4, 128], 0.5, [0, 0, 0, 0]), [64, 8, 2, 64]);
});
test('encoded over preserves destination at zero opacity and replaces it at opaque source', () => {
  assert.deepEqual(expectedEncodedOver([128, 16, 4, 128], 0, [16, 32, 64, 255]), [16, 32, 64, 255]);
  assert.deepEqual(expectedEncodedOver([255, 32, 8, 255], 1, [16, 32, 64, 255]), [255, 32, 8, 255]);
});
test('encoded over admits fractional premultiplied units without hidden rounding', () => {
  assert.deepEqual(expectedEncodedOver([0.5, 0.25, 0.125, 1], 0.5, [0, 0, 0, 0]), [0.25, 0.125, 0.0625, 0.5]);
});
test('source-over binary64 view agrees with independently fixed rational numerators', () => {
  // The numerators follow independent hand reduction; this bound only covers
  // a binary64 view of those rationals and grants no native pixel tolerance.
  const actual = expectedEncodedOver([64, 32, 16, 128], 0.5, [16, 32, 64, 255]);
  const fixed = [11216 / 255, 10192 / 255, 14264 / 255, 255];
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(actual[i] - fixed[i]) <= 1e-13);
});
test('source-over order is noncommutative against fixed rational red and blue controls', () => {
  const forward = expectedEncodedOver([128, 0, 0, 128], 1, [0, 0, 128, 128]);
  const reverse = expectedEncodedOver([0, 0, 128, 128], 1, [128, 0, 0, 128]);
  assert.equal(forward[0], 128); assert.equal(reverse[2], 128);
  assert.ok(Math.abs(forward[2] - 16256 / 255) <= 1e-13);
  assert.ok(Math.abs(reverse[0] - 16256 / 255) <= 1e-13);
  assert.ok(Math.abs(forward[3] - 48896 / 255) <= 1e-13);
  assert.notDeepEqual(forward, reverse);
});
test('encoded over returns independent mutable arrays without changing its inputs', () => {
  const source = Object.freeze([128, 16, 4, 128]), destination = Object.freeze([0, 0, 0, 0]);
  const first = expectedEncodedOver(source, 0.5, destination), second = expectedEncodedOver(source, 0.5, destination);
  first[0] = 0;
  assert.notEqual(first, second);
  assert.deepEqual(second, [64, 8, 2, 64]);
  assert.deepEqual(source, [128, 16, 4, 128]); assert.deepEqual(destination, [0, 0, 0, 0]);
});
test('all tuple ports reject nonarrays and wrong lengths without coercion', () => {
  const invalid = [undefined, null, {}, 'abcd', new Uint8Array(4), [], [0, 0, 0], [0, 0, 0, 0, 0]];
  for (const tuple of invalid) {
    assert.throws(() => expectedUploadRGBA(tuple), TypeError);
    assert.throws(() => expectedEncodedOver(tuple, 1, [0, 0, 0, 0]), TypeError);
    assert.throws(() => expectedEncodedOver([0, 0, 0, 0], 1, tuple), TypeError);
    assert.throws(() => assertTexturePixel(tuple, [0, 0, 0, 0], [0, 0, 0, 0], 'actual'), TypeError);
    assert.throws(() => assertTexturePixel([0, 0, 0, 0], tuple, [0, 0, 0, 0], 'expected'), TypeError);
    assert.throws(() => assertTexturePixel([0, 0, 0, 0], [0, 0, 0, 0], tuple, 'bound'), TypeError);
  }
});
test('upload and actual admissions reject fractional bytes, holes and nonprimitive numbers', () => {
  for (const value of [-1, 256, 0.5, NaN, Infinity, -Infinity, '1', 1n, new Number(1), undefined, null]) {
    assert.throws(() => expectedUploadRGBA([value, 0, 0, 0]), TypeError);
    assert.throws(() => assertTexturePixel([value, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], 'actual'), TypeError);
  }
  assert.throws(() => expectedUploadRGBA(Array(4)), TypeError);
});
test('continuous source and destination reject nonfinite, out-of-domain and nonpremultiplied channels', () => {
  for (const tuple of [[-1, 0, 0, 1], [256, 0, 0, 255], [2, 0, 0, 1], [0, 2, 0, 1], [0, 0, 2, 1], [0, 0, 0, 256], [NaN, 0, 0, 1], [0, 0, 0, Infinity], ['1', 0, 0, 1]]) {
    assert.throws(() => expectedEncodedOver(tuple, 1, [0, 0, 0, 0]), TypeError);
    assert.throws(() => expectedEncodedOver([0, 0, 0, 0], 1, tuple), TypeError);
  }
});
test('opacity requires an explicit primitive finite number in the inclusive unit interval', () => {
  for (const opacity of [undefined, null, '0.5', new Number(0.5), -0.1, 1.1, NaN, Infinity, -Infinity]) {
    assert.throws(() => expectedEncodedOver([0, 0, 0, 0], opacity, [0, 0, 0, 0]), TypeError);
  }
});
test('expected channels are finite continuous values without byte rounding or clamping', () => {
  assertTexturePixel([0, 255, 0, 255], [-0.25, 255.25, Number.MIN_VALUE, 255.5], [0.25, 0.25, Number.MIN_VALUE, 0.5], 'continuous');
  for (const value of [NaN, Infinity, -Infinity, '0', new Number(0), undefined, null]) {
    assert.throws(() => assertTexturePixel([0, 0, 0, 0], [value, 0, 0, 0], [0, 0, 0, 0], 'expected'), TypeError);
  }
});
test('per-channel bounds require explicit finite nonnegative primitive values', () => {
  for (const value of [undefined, null, -1, NaN, Infinity, -Infinity, '1', 'UNKNOWN', new Number(1)]) {
    assert.throws(() => assertTexturePixel([0, 0, 0, 0], [0, 0, 0, 0], [value, 0, 0, 0], 'bound'), TypeError);
  }
  assert.throws(() => assertTexturePixel([0, 0, 0, 0], [0, 0, 0, 0], undefined, 'missing'), TypeError);
});
test('pixel id admits one through 256 code units and rejects malformed identifiers', () => {
  assertTexturePixel([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], '像'.repeat(256));
  for (const id of [undefined, null, '', 'x'.repeat(257), 1, new String('x')]) {
    assert.throws(() => assertTexturePixel([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], id), TypeError);
  }
});
test('explicit bounds accept equality and reject the first unit beyond a selected channel', () => {
  assertTexturePixel([12, 20, 30, 40], [10, 20, 30, 40], [2, 0, 0, 0], 'inclusive');
  assert.throws(() => assertTexturePixel([13, 20, 30, 40], [10, 20, 30, 40], [2, 0, 0, 0], 'one-over'), error => error instanceof RangeError && error.message.includes('one-over'));
});
test('every channel uses its own bound instead of another channel maximum', () => {
  for (let channel = 0; channel < 4; channel++) {
    const actual = [10, 20, 30, 40], expected = [10, 20, 30, 40], bounds = [100, 100, 100, 100];
    actual[channel]++; bounds[channel] = 0;
    assert.throws(() => assertTexturePixel(actual, expected, bounds, 'channel-' + channel), RangeError);
  }
});
test('explicit zero bounds distinguish tiny expected fractions and exact byte equality', () => {
  assertTexturePixel([0, 16, 128, 255], [0, 16, 128, 255], [0, 0, 0, 0], 'zero');
  assert.throws(() => assertTexturePixel([0, 0, 0, 0], [Number.MIN_VALUE, 0, 0, 0], [0, 0, 0, 0], 'tiny'), RangeError);
});
test('all malformed tuple components are rejected before a pixel mismatch is reported', () => {
  assert.throws(() => assertTexturePixel([255, 0, 0, 0], [0, 0, 0, NaN], [0, 0, 0, 0], 'late-expected'), TypeError);
  assert.throws(() => assertTexturePixel([255, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, -1], 'late-bound'), TypeError);
});
test('indexed capture reads every component once and never invokes iterator or coercion', () => {
  const reads = [0, 0, 0, 0], tuple = [255, 32, 8, 128];
  for (let index = 0; index < 4; index++) {
    const value = tuple[index];
    Object.defineProperty(tuple, index, {get() {reads[index]++; return value;}});
  }
  Object.defineProperty(tuple, Symbol.iterator, {get() {throw Error('iterator must not be read');}});
  tuple.valueOf = () => {throw Error('coercion must not run');};
  assert.deepEqual(expectedUploadRGBA(tuple), [128, 16, 4, 128]);
  assert.deepEqual(reads, [1, 1, 1, 1]);
});
test('arbitrary original indexed and length getter failures propagate without replacement', () => {
  const cause = Object.freeze({marker: 'original-index-failure'}), tuple = [0, 0, 0, 0];
  Object.defineProperty(tuple, 2, {get() {throw cause;}});
  const calls = [
    () => expectedUploadRGBA(tuple),
    () => expectedEncodedOver(tuple, 1, [0, 0, 0, 0]),
    () => expectedEncodedOver([0, 0, 0, 0], 1, tuple),
    () => assertTexturePixel(tuple, [0, 0, 0, 0], [0, 0, 0, 0], 'actual'),
    () => assertTexturePixel([0, 0, 0, 0], tuple, [0, 0, 0, 0], 'expected'),
    () => assertTexturePixel([0, 0, 0, 0], [0, 0, 0, 0], tuple, 'bound'),
    () => expectedUploadRGBA(new Proxy([0, 0, 0, 0], {get(target, key) {if (key === 'length') throw cause; return Reflect.get(target, key);}})),
  ];
  for (const call of calls) assert.throws(call, error => error === cause);
});
test('an actual admitted upload arithmetic failure propagates the original native cause', () => {
  const original = Math.floor, cause = Object.freeze({marker: 'controlled-floor-failure'});
  let caught;
  Math.floor = () => {throw cause;};
  try {expectedUploadRGBA([255, 32, 8, 128]);} catch (error) {caught = error;} finally {Math.floor = original;}
  assert.equal(caught, cause);
});
test('pixel comparison leaves every caller tuple unchanged and reports the selected literal id', () => {
  const actual = Object.freeze([1, 0, 0, 0]), expected = Object.freeze([0, 0, 0, 0]), bound = Object.freeze([0, 0, 0, 0]);
  assert.throws(() => assertTexturePixel(actual, expected, bound, '独立样例-7'), error => error instanceof RangeError && error.message.includes('独立样例-7'));
  assert.deepEqual(actual, [1, 0, 0, 0]); assert.deepEqual(expected, [0, 0, 0, 0]); assert.deepEqual(bound, [0, 0, 0, 0]);
});
test('literal CPU controls reject double-premultiply, double-opacity and swapped RGBA', () => {
  for (const [actual, expected, bounds] of [
    [[64, 8, 2, 128], [128, 16, 4, 128], [1, 1, 1, 0]],
    [[32, 4, 1, 32], [64, 8, 2, 64], [0, 0, 0, 0]],
    [[4, 16, 128, 128], [128, 16, 4, 128], [0, 0, 0, 0]],
  ]) assert.throws(() => assertTexturePixel(actual, expected, bounds, 'literal-sensitivity'), RangeError);
});
test('literal CPU controls reject reversed order and the wrong encoded transfer', () => {
  assert.throws(() => assertTexturePixel([64, 0, 128, 192], [128, 0, 64, 192], [1, 1, 1, 0], 'order'), RangeError);
  assert.throws(() => assertTexturePixel([55, 13, 4, 255], [128, 64, 32, 255], [1, 1, 1, 0], 'wrong-transfer'), RangeError);
});
