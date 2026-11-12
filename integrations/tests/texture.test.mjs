// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { IntegrationError } from '@egret/integrations/errors';
import { decodeKtx2Rgba8, inspectKtx2 } from '@egret/integrations/texture';
import { createFixtureKtx2 } from '../example/assets/fixture-texture.mjs';

const pixels = [
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 255, 255,
];

function fault(code) {
    return (error) => error instanceof IntegrationError && error.integration === 'ktx2' && error.code === code;
}

test('KTX2 inspection returns frozen level metadata and original file offsets', () => {
    const bytes = createFixtureKtx2();
    const texture = inspectKtx2(bytes);
    assert.equal(texture.width, 2);
    assert.equal(texture.height, 2);
    assert.equal(texture.vkFormat, 43);
    assert.equal(texture.supercompressionScheme, 0);
    assert.deepEqual(texture.levels.map(({ width, height, byteLength }) => [width, height, byteLength]), [[2, 2, 16], [1, 1, 4]]);
    assert(texture.levels[1].byteOffset < texture.levels[0].byteOffset);
    const base = texture.levels[0];
    assert.deepEqual(Array.from(bytes.subarray(base.byteOffset, base.byteOffset + base.byteLength)), pixels);
    assert(Object.isFrozen(texture) && Object.isFrozen(texture.levels) && texture.levels.every(Object.isFrozen));
});

test('KTX2 decode emits straight top-left RGBA8 with pixels independent of input and prior results', () => {
    const fixture = createFixtureKtx2();
    const backing = new Uint8Array(fixture.length + 10);
    backing.set(fixture, 5);
    const bounded = backing.subarray(5, 5 + fixture.length);
    const first = decodeKtx2Rgba8(bounded);
    assert.deepEqual(first, {
        width: 2, height: 2, pixels: Uint8Array.from(pixels),
        format: 'rgba8unorm', colorSpace: 'srgb', alphaMode: 'straight', origin: 'top-left',
    });
    assert.deepEqual(decodeKtx2Rgba8(bounded, 1).pixels, Uint8Array.of(255, 0, 255, 255));
    first.pixels[0] = 4;
    const copy = decodeKtx2Rgba8(bounded);
    assert.equal(copy.pixels[0], 255);
    backing.fill(0);
    assert.deepEqual(copy.pixels, Uint8Array.from(pixels));
    assert.throws(() => decodeKtx2Rgba8(fixture, 2), fault('invalid-input'));
    assert.throws(() => decodeKtx2Rgba8(fixture, -1), fault('invalid-input'));
});

test('KTX2 admission rejects out-of-view offsets, overlapping mips and inconsistent metadata lengths', () => {
    const fixture = createFixtureKtx2();
    const backing = new Uint8Array(fixture.length * 2);
    backing.set(fixture);
    const bounded = backing.subarray(0, fixture.length);
    new DataView(backing.buffer).setBigUint64(80, BigInt(fixture.length), true);
    assert.throws(() => inspectKtx2(bounded), fault('invalid-input'));
    const overlap = createFixtureKtx2();
    const overlapHeader = new DataView(overlap.buffer);
    overlapHeader.setBigUint64(80, overlapHeader.getBigUint64(104, true), true);
    assert.throws(() => inspectKtx2(overlap), fault('invalid-input'));
    const malformed = createFixtureKtx2();
    const malformedHeader = new DataView(malformed.buffer);
    malformedHeader.setUint32(malformedHeader.getUint32(56, true), 0xffffffff, true);
    assert.throws(() => inspectKtx2(malformed), fault('invalid-input'));
    assert.throws(() => inspectKtx2(fixture.subarray(0, 103)), fault('invalid-input'));
    assert.throws(() => inspectKtx2(new Uint16Array(100)), fault('invalid-input'));
});

test('KTX2 inspection keeps genuine zlib-compressed mip lengths separate from RGBA8 decode', () => {
    const raw = createFixtureKtx2();
    const { levels } = inspectKtx2(raw);
    const payloadStart = levels[1].byteOffset;
    const smaller = deflateSync(raw.subarray(payloadStart, payloadStart + levels[1].byteLength));
    const larger = deflateSync(Uint8Array.from(pixels));
    const compressed = new Uint8Array(payloadStart + smaller.length + larger.length);
    compressed.set(raw.subarray(0, payloadStart));
    compressed.set(smaller, payloadStart);
    compressed.set(larger, payloadStart + smaller.length);
    const header = new DataView(compressed.buffer);
    header.setUint32(44, 3, true);
    header.setBigUint64(80, BigInt(payloadStart + smaller.length), true);
    header.setBigUint64(88, BigInt(larger.length), true);
    header.setBigUint64(112, BigInt(smaller.length), true);
    const inspected = inspectKtx2(compressed);
    assert.equal(inspected.supercompressionScheme, 3);
    assert.deepEqual(inspected.levels.map(({ byteLength, uncompressedByteLength }) => [byteLength, uncompressedByteLength]), [
        [larger.length, 16], [smaller.length, 4],
    ]);
    assert.throws(() => decodeKtx2Rgba8(compressed), fault('unsupported'));
});

test('KTX2 refuses mislabelled color and orientation and enforces its dimension budget', () => {
    const bytes = createFixtureKtx2();
    const header = new DataView(bytes.buffer);
    const dfd = header.getUint32(48, true);
    bytes[dfd + 14] = 1; // Linear transfer in place of sRGB.
    assert.throws(() => decodeKtx2Rgba8(bytes), fault('unsupported'));
    bytes[dfd + 14] = 2;
    const kvd = header.getUint32(56, true);
    bytes[kvd + 4 + 'KTXorientation'.length + 2] = 'u'.charCodeAt(0);
    assert.throws(() => decodeKtx2Rgba8(bytes), fault('unsupported'));
    header.setUint32(20, 16385, true);
    assert.throws(() => inspectKtx2(bytes), fault('limit-exceeded'));
});
