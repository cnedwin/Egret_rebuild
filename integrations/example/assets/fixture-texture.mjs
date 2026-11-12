// SPDX-License-Identifier: Apache-2.0
// An original 2×2 sRGB RGBA8 texture. The second mip is one magenta texel.
export function createFixtureKtx2() {
    const identifier = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];
    const indexOffset = 80;
    const dfdOffset = indexOffset + 2 * 24;
    const dfdLength = 4 + 24 + 4 * 16;
    const orientation = new TextEncoder().encode('KTXorientation\0rd\0');
    const kvdOffset = dfdOffset + dfdLength;
    const kvdLength = 4 + Math.ceil(orientation.length / 4) * 4;
    const mipOffset = kvdOffset + kvdLength;
    const baseOffset = mipOffset + 4;
    const bytes = new Uint8Array(baseOffset + 16);
    const data = new DataView(bytes.buffer);
    const word = (offset, value) => data.setUint32(offset, value, true);
    const half = (offset, value) => data.setUint16(offset, value, true);
    const wide = (offset, value) => data.setBigUint64(offset, BigInt(value), true);

    bytes.set(identifier);
    word(12, 43); // VK_FORMAT_R8G8B8A8_SRGB.
    word(16, 1);
    word(20, 2);
    word(24, 2);
    word(36, 1);
    word(40, 2);
    word(48, dfdOffset);
    word(52, dfdLength);
    word(56, kvdOffset);
    word(60, kvdLength);

    // Level index entries are ordered largest first. Payloads are ordered smallest first.
    wide(indexOffset, baseOffset);
    wide(indexOffset + 8, 16);
    wide(indexOffset + 16, 16);
    wide(indexOffset + 24, mipOffset);
    wide(indexOffset + 32, 4);
    wide(indexOffset + 40, 4);

    word(dfdOffset, dfdLength);
    half(dfdOffset + 8, 2); // Basic descriptor version.
    half(dfdOffset + 10, dfdLength - 4);
    bytes.set([1, 1, 2, 0], dfdOffset + 12); // RGBSDA, BT.709, sRGB, straight alpha.
    bytes[dfdOffset + 20] = 4;
    for (const [channel, type] of [0, 1, 2, 0x1f].entries()) {
        const sample = dfdOffset + 28 + channel * 16;
        half(sample, channel * 8);
        bytes[sample + 2] = 7;
        bytes[sample + 3] = type;
        word(sample + 12, 255);
    }

    word(kvdOffset, orientation.length);
    bytes.set(orientation, kvdOffset + 4);
    bytes.set([255, 0, 255, 255], mipOffset);
    bytes.set([
        255, 0, 0, 255, 0, 255, 0, 255,
        0, 0, 255, 255, 255, 255, 255, 255,
    ], baseOffset);
    return bytes;
}
