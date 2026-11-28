// SPDX-License-Identifier: Apache-2.0
// The linear-light value of each sRGB byte is a written number, not a power computed when a game runs: JavaScript
// engines differ in the last bit of a power, and a prepared frame must hold the same numbers in all of them.
// The table is the contracts' one; the runtime, the engine core and rendering all import it from there. The private
// import is a built engine/dist/rendering helper, as AGENTS permits for geometry units.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeSRGBByte } from '@egret/contracts';
import { decodeSharedSRGB, decodeSharedSRGBByte } from '../packages/engine/dist/rendering/sharedColor2D.js';

test('SRT01 the written table holds the recorded numbers, one ulp at most from the transfer function', () => {
  const values = Float64Array.from({ length: 256 }, (_, code) => decodeSRGBByte(code));
  // Little-endian IEEE 754 doubles, as every supported platform stores them.
  assert.equal(
    createHash('sha256').update(new Uint8Array(values.buffer)).digest('hex'),
    '145b17b23c87fbcc4311d4d22dc15aa62e87719367d51313e3a11156fa57eb66'
  );
  for (let code = 0; code < 256; code++) {
    assert.ok(Object.is(decodeSharedSRGBByte(code), values[code]), 'shared ' + code);
    // Whatever this engine's power gives is within a few last bits of the written number.
    const computed = decodeSharedSRGB(code / 255);
    assert.ok(Math.abs(computed - values[code]) <= 4 * Number.EPSILON * values[code], 'near ' + code);
  }
  assert.deepEqual([values[0], values[255]], [0, 1]);
  for (let code = 1; code < 256; code++) assert.ok(values[code] > values[code - 1], 'rising ' + code);
  // Only the low eight bits are read.
  assert.equal(decodeSRGBByte(0x1234ff), 1);
  assert.equal(decodeSRGBByte(256), 0);
});
