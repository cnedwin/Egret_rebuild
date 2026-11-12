// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { zipSync } from 'fflate';
import { ARCHIVE_LIMITS, unzipAssets, zipAssets } from '@egret/integrations/archive';

const encoder = new TextEncoder();
const text = value => encoder.encode(value);

test('deterministic archives round trip names, bytes, empty files and ordering', () => {
    const assets = [
        { path: '地区/地图.json', bytes: text('map') },
        { path: 'empty.dat', bytes: new Uint8Array(0) },
        { path: 'actors/state.dat', bytes: text('state'.repeat(100)) },
    ];
    const zip = zipAssets(assets);
    assert.deepEqual(zip, zipAssets([...assets].reverse()));
    assert.deepEqual(unzipAssets(zip), assets.toSorted((a, b) => a.path < b.path ? -1 : 1));
    assets[0].bytes[0] = 0;
    assert.equal(new TextDecoder().decode(unzipAssets(zip).at(-1).bytes), 'map');
    assert.deepEqual(unzipAssets(zipAssets([])), []);
});

test('refuse duplicate, escaped and unbounded archive declarations', () => {
    assert.throws(() => zipAssets([{ path: '../outside', bytes: text('x') }]), { code: 'invalid-input' });
    assert.throws(() => zipAssets([{ path: 'a', bytes: text('x') }, { path: 'a', bytes: text('y') }]), { code: 'invalid-input' });
    assert.throws(() => unzipAssets(zipSync({ '../outside': text('x') })), { code: 'invalid-input' });
    const archive = zipAssets([{ path: 'readme.txt', bytes: text('hello') }]);
    const view = new DataView(archive.buffer);
    const directory = view.getUint32(archive.length - 22 + 16, true);
    view.setUint32(directory + 24, ARCHIVE_LIMITS.fileBytes + 1, true);
    assert.throws(() => unzipAssets(archive), { code: 'limit-exceeded' });
});

test('ZIP decoding rejects corrupt stored bytes and lying DEFLATE lengths', () => {
    const stored = zipSync({ 'test.txt': text('abc') }, { level: 0 });
    const storedView = new DataView(stored.buffer);
    stored[30 + storedView.getUint16(26, true)] ^= 1;
    assert.throws(() => unzipAssets(stored), { code: 'invalid-input' });
    const deflated = zipAssets([{ path: 'test.txt', bytes: text('abcd'.repeat(50)) }]);
    const view = new DataView(deflated.buffer);
    const directory = view.getUint32(deflated.length - 22 + 16, true);
    view.setUint32(22, 6, true);
    view.setUint32(directory + 24, 6, true);
    assert.throws(() => unzipAssets(deflated), { code: 'invalid-input' });
});
