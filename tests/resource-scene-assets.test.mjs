// SPDX-License-Identifier: Apache-2.0
// Encoding checks use Node's zlib only. They do not establish native PNG/font rendering.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync, deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ASSET_NAMES, ASSET_SPECS, assetOracle } from '../tools/resource-scene/oracle.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const assetRoot = 'examples/resource-scene/assets/';
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const read = relative => readFileSync(path.join(root, relative));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = (relative, raw = read(relative)) => ({ path: relative, bytes: raw.length, sha256: digest(raw) });

// Independent bit-at-a-time PNG CRC, rather than an encoder's table or helper.
function crc32(raw) {
  let crc = 0xffffffff;
  for (const byte of raw) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function decodeLiteralPng(raw, expected) {
  assert.ok(raw.length >= 57 && raw.length <= 65536, 'bounded original PNG bytes');
  assert.deepEqual(raw.subarray(0, 8), signature, 'PNG signature');
  const chunks = [];
  let offset = 8;
  while (offset < raw.length) {
    assert.ok(offset + 12 <= raw.length, 'complete PNG chunk header/trailer');
    const length = raw.readUInt32BE(offset);
    assert.ok(length <= raw.length - offset - 12, 'PNG chunk stays within original bytes');
    const end = offset + 12 + length;
    const typeBytes = raw.subarray(offset + 4, offset + 8);
    assert.ok([...typeBytes].every(byte => (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122)), 'literal PNG chunk type bytes must be ASCII letters');
    assert.equal(crc32(raw.subarray(offset + 4, offset + 8 + length)), raw.readUInt32BE(offset + 8 + length), 'PNG CRC');
    chunks.push({ type: typeBytes.toString('ascii'), data: raw.subarray(offset + 8, offset + 8 + length) });
    offset = end;
  }
  assert.equal(offset, raw.length, 'all original PNG bytes consumed');
  assert.deepEqual(chunks.map(chunk => chunk.type), ['IHDR', 'IDAT', 'IEND'], 'untagged three-chunk PNG');
  const ihdr = chunks[0].data;
  assert.equal(ihdr.length, 13);
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4);
  assert.equal(width, expected.width); assert.equal(height, expected.height);
  assert.deepEqual([...ihdr.subarray(8)], [8, expected.colorType, 0, 0, 0], '8-bit RGB/RGBA, filter method 0, no interlace');
  assert.equal(chunks[2].data.length, 0, 'empty IEND');
  assert.ok(chunks[1].data.length > 0, 'actual compressed image data');
  const components = expected.colorType === 6 ? 4 : 3;
  assert.ok(expected.colorType === 6 || expected.colorType === 2);
  const stride = width * components;
  const scanlines = inflateSync(chunks[1].data, { maxOutputLength: height * (stride + 1) });
  assert.equal(scanlines.length, height * (stride + 1), 'complete inflated rows');
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    assert.equal(scanlines[y * (stride + 1)], 0, 'each row uses literal PNG filter 0');
    for (let x = 0; x < width; x += 1) {
      const source = y * (stride + 1) + 1 + x * components;
      const target = (y * width + x) * 4;
      rgba.set(scanlines.subarray(source, source + 3), target);
      rgba[target + 3] = components === 4 ? scanlines[source + 3] : 255;
    }
  }
  return { width, height, rgba, scanlines, chunks };
}

function exactAsset(name, decoded) {
  const expected = assetOracle(name);
  assert.equal(decoded.width, expected.width, name + ' width');
  assert.equal(decoded.height, expected.height, name + ' height');
  assert.deepEqual(decoded.rgba, expected.rgba, name + ': every RGBA channel matches independent predicates');
  return decoded.rgba.length;
}

const retainedPins = [
  { path: 'tools/browser-png/assets/rgb-red-green.png', bytes: 72, sha256: '917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d' },
  { path: 'examples/canvas-text/assets/ahem.ttf', bytes: 22572, sha256: 'f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc' },
  { path: 'examples/canvas-text/assets/Ahem-README.txt', bytes: 2456, sha256: 'e5314468f94f7d9caf62bd8f6871ebf81c96827254043dac95814c943852d40e' },
  { path: 'examples/canvas-text/assets/Ahem-COPYING.txt', bytes: 1928, sha256: '3100f58a80de8fcd9dee4280dc4e52a45cc25a2084006e6b8fb5750708a388f8' },
];
const notoCopies = [
  { path: assetRoot + 'NotoSansSC-fixed.woff2', bytes: 1796, sha256: '9e435555e47102d40ace35211158051b45c131bce1fc7c1daca871b2386ec895' },
  { path: assetRoot + 'NotoSansSC.source.css', bytes: 348, sha256: 'afa8bcf0f8a6d2e5b13ed4912a26083371abaad6163bbc564e6e3d88a83a24ed' },
  { path: assetRoot + 'NotoSansSC-OFL.txt', bytes: 4388, sha256: '1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9' },
];

test('retained original badge and Ahem font/legal baseline have exact independent identities', () => {
  for (const expected of retainedPins) assert.deepEqual(pin(expected.path), expected);
  assert.deepEqual(pin('tools/browser-png/assets/provenance.json'), {
    path: 'tools/browser-png/assets/provenance.json', bytes: 1944, sha256: '63f67036e2b386ab027d34b802b08a378c8f5a85e11c19043b819d827daf4dcc',
  });
  assert.deepEqual(pin('examples/canvas-text/assets/provenance.json'), {
    path: 'examples/canvas-text/assets/provenance.json', bytes: 1509, sha256: '2a970cd2a600ed8af4fa44bee7fcf30d505b2d2d32c2bac0747816445dcfac2d',
  });
  const badge = decodeLiteralPng(read(retainedPins[0].path), { width: 2, height: 1, colorType: 2 });
  assert.deepEqual([...badge.rgba], [255, 0, 0, 255, 0, 255, 0, 255]);
  const rights = JSON.parse(read('examples/canvas-text/assets/provenance.json')).rights;
  assert.match(rights, /public domain/i); assert.match(rights, /Creative Commons Zero/);
  assert.doesNotMatch(rights, /license\s*:\s*Apache-2\.0/i);
});

for (const name of ASSET_NAMES) test('original P02 PNG has complete independent pixels: ' + name, () => {
  const decoded = decodeLiteralPng(read(assetRoot + name), ASSET_SPECS[name]);
  exactAsset(name, decoded);
});

test('all six original assets cover exactly 8192 independently expected RGBA channels', () => {
  let channels = 0;
  for (const name of ASSET_NAMES) channels += exactAsset(name, decodeLiteralPng(read(assetRoot + name), ASSET_SPECS[name]));
  assert.equal(channels, 8192);
});

test('asset provenance binds exact originals, independent rights and the actual authoring source', () => {
  const provenance = JSON.parse(read(assetRoot + 'provenance.json'));
  assert.equal(provenance.schemaVersion, 1);
  assert.equal(provenance.artifact, 'egret-resource-scene-assets');
  assert.ok(Array.isArray(provenance.records));
  assert.deepEqual(provenance.records.map(row => row.path).sort(), ASSET_NAMES.map(name => assetRoot + name).sort());
  const generator = pin('tools/resource-scene/author-assets.mjs');
  for (const row of provenance.records) {
    const name = row.path.slice(assetRoot.length);
    assert.deepEqual({ path: row.path, bytes: row.bytes, sha256: row.sha256 }, pin(row.path));
    assert.equal(row.origin, 'first-party'); assert.equal(row.license, 'Apache-2.0');
    assert.deepEqual(row.generator, generator, 'all six originals identify the actual fixed encoder source');
    for (const field of ['width', 'height', 'bitDepth', 'colorType', 'interlace']) {
      if (Object.hasOwn(row, field)) assert.equal(row[field], ASSET_SPECS[name][field]);
    }
  }
  assert.ok(Array.isArray(provenance.reused));
  const originals = [...retainedPins, ...notoCopies];
  assert.deepEqual(provenance.reused.map(row => row.path).sort(), originals.map(row => row.path).sort());
  for (const expected of originals) {
    assert.deepEqual(pin(expected.path), expected, 'unaltered retained original/copy');
    const row = provenance.reused.find(value => value.path === expected.path);
    assert.deepEqual({ path: row.path, bytes: row.bytes, sha256: row.sha256 }, expected);
    assert.equal(typeof row.origin, 'string'); assert.ok(row.origin.length > 0);
    assert.equal(typeof row.rights, 'string');
    if (expected.path.includes('/canvas-text/')) {
      if (expected.path.endsWith('/ahem.ttf')) {
        assert.match(row.rights, /public domain/i);
        assert.match(row.rights, /(?:CC0|Creative Commons Zero)/i);
      }
      assert.doesNotMatch(row.rights, /Apache-2\.0|OFL-1\.1/);
    } else if (expected.path.endsWith('.css')) {
      assert.match(row.rights, /provenance/i);
      assert.doesNotMatch(row.rights, /Apache-2\.0/);
    } else if (expected.path.includes('NotoSansSC')) assert.match(row.rights, /OFL-1\.1/);
    else assert.match(row.rights, /Apache-2\.0/);
  }
  const woff2 = read(notoCopies[0].path);
  assert.equal(woff2.subarray(0, 4).toString('ascii'), 'wOF2');
  assert.equal(woff2.readUInt32BE(8), woff2.length, 'original WOFF2 container length only, not glyph coverage');
});

// Rewrite compressed row bytes only for negative controls; no art recipe is used.
function changedPng(original, expected, change) {
  const decoded = decodeLiteralPng(original, expected);
  const rows = Buffer.from(decoded.scanlines); change(rows, decoded.width);
  const compressed = deflateSync(rows);
  const parts = [signature];
  for (const chunk of decoded.chunks) {
    const data = chunk.type === 'IDAT' ? compressed : chunk.data;
    const type = Buffer.from(chunk.type, 'ascii');
    const header = Buffer.alloc(4), checksum = Buffer.alloc(4);
    header.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
    parts.push(header, type, data, checksum);
  }
  return Buffer.concat(parts);
}

test('valid-CRC wrong-color PNG is rejected by the complete independent art comparison', () => {
  const name = 'outfit-A.png', original = read(assetRoot + name);
  exactAsset(name, decodeLiteralPng(original, ASSET_SPECS[name]));
  const mutant = changedPng(original, ASSET_SPECS[name], (rows, width) => {
    const offset = 6 * (1 + width * 4) + 1 + 5 * 4;
    rows.set([0, 255, 0, 255], offset);
  });
  const decoded = decodeLiteralPng(mutant, ASSET_SPECS[name]);
  assert.deepEqual([...decoded.rgba.subarray((6 * 16 + 5) * 4, (6 * 16 + 5) * 4 + 4)], [0, 255, 0, 255]);
  assert.throws(() => exactAsset(name, decoded), { code: 'ERR_ASSERTION' });
});

test('valid-CRC swapped atlas frames are rejected despite equal size, colors and channel count', () => {
  const name = 'atlas-v1.png', original = read(assetRoot + name);
  exactAsset(name, decodeLiteralPng(original, ASSET_SPECS[name]));
  const mutant = changedPng(original, ASSET_SPECS[name], (rows, width) => {
    for (let y = 0; y < 16; y += 1) {
      const start = y * (1 + width * 4) + 1;
      const firstPose = Buffer.from(rows.subarray(start, start + 64));
      rows.copyWithin(start, start + 64, start + 128);
      rows.set(firstPose, start + 64);
    }
  });
  const decoded = decodeLiteralPng(mutant, ASSET_SPECS[name]);
  assert.equal(decoded.rgba.length, 32 * 16 * 4);
  assert.deepEqual([...decoded.rgba.subarray((12 * 32 + 4) * 4, (12 * 32 + 4) * 4 + 4)], [0, 0, 0, 0]);
  assert.throws(() => exactAsset(name, decoded), { code: 'ERR_ASSERTION' });
});

test('CRC and original encoding-profile corruption cannot masquerade as an art mismatch', () => {
  const name = 'outfit-A.png', original = read(assetRoot + name);
  exactAsset(name, decodeLiteralPng(original, ASSET_SPECS[name]));
  const corrupt = Buffer.from(original); corrupt[corrupt.length - 1] ^= 1;
  assert.throws(() => decodeLiteralPng(corrupt, ASSET_SPECS[name]), /PNG CRC/);
  const filtered = changedPng(original, ASSET_SPECS[name], rows => { rows[0] = 1; });
  assert.throws(() => decodeLiteralPng(filtered, ASSET_SPECS[name]), /literal PNG filter 0/);
});

test('CRC-valid high-bit chunk type is refused before ASCII decoding can erase its invalid bit', () => {
  const name = 'outfit-A.png', original = read(assetRoot + name);
  exactAsset(name, decodeLiteralPng(original, ASSET_SPECS[name]));
  const invalid = Buffer.from(original);
  assert.equal(invalid.subarray(12, 16).toString('ascii'), 'IHDR');
  invalid[12] |= 0x80;
  invalid.writeUInt32BE(crc32(invalid.subarray(12, 29)), 29);
  assert.equal(crc32(invalid.subarray(12, 29)), invalid.readUInt32BE(29), 'control has a valid updated IHDR CRC');
  assert.equal(invalid[12], 0xc9, 'the original type byte is outside ASCII letters');
  assert.equal(invalid.subarray(12, 16).toString('ascii'), 'IHDR', 'ASCII decoding alone would hide the invalid high bit');
  assert.throws(() => decodeLiteralPng(invalid, ASSET_SPECS[name]), /chunk type bytes must be ASCII letters/);
  assert.deepEqual(read(assetRoot + name), original, 'the actual original PNG remains unchanged');
});
