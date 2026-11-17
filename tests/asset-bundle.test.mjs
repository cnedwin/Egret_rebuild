// SPDX-License-Identifier: Apache-2.0
// Asset bundles: writing, reading the index, slicing and checking entries,
// planning ranges, and fetching over HTTP with and without byte ranges.
import assert from 'node:assert/strict';
import test from 'node:test';
import { planAssetBundleRanges, readAssetBundleIndex, sliceAssetBundle, writeAssetBundle } from '@egret/engine/kit';
import { openBrowserAssetBundle } from '@egret/engine/web/kit';

const bytes = (n, seed) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) & 255);
const INPUTS = [
  { name: 'models/hero-high.glb', bytes: bytes(5000, 1), type: 'model/gltf-binary', tags: ['hero', 'high'] },
  { name: 'models/hero-low.glb', bytes: bytes(1203, 2), type: 'model/gltf-binary', tags: ['hero', 'low'] },
  { name: 'art/hall.webp', bytes: bytes(77, 3), type: 'image/webp', tags: ['scene'] },
  { name: 'sound/step.wav', bytes: bytes(0, 4) }
];

test('AB01 a bundle holds every entry in order, aligned, and gives each back checked', () => {
  const file = writeAssetBundle(INPUTS);
  const index = readAssetBundleIndex(file);
  assert.equal(index.size, file.length);
  assert.deepEqual(
    index.entries.map(e => e.name),
    INPUTS.map(i => i.name)
  );
  for (const entry of index.entries) assert.equal(entry.offset % 4, 0);
  for (const input of INPUTS) assert.deepEqual(sliceAssetBundle(index, input.name, file), input.bytes);
  assert.equal(index.entries[3].type, 'application/octet-stream');
  assert.deepEqual(index.entries[0].tags, ['hero', 'high']);
  const broken = file.slice();
  broken[index.entries[0].offset + 10] ^= 1;
  assert.throws(() => sliceAssetBundle(index, 'models/hero-high.glb', broken), { code: 'ASSET_BUNDLE_CHECK_FAILED' });
  assert.throws(() => sliceAssetBundle(index, 'nothing', file), { code: 'ASSET_BUNDLE_ENTRY_MISSING' });
});

test('AB02 bad inputs and bad files are refused', () => {
  for (const inputs of [
    [],
    [{ name: '../x', bytes: bytes(1, 1) }],
    [{ name: 'a', bytes: [1] }],
    [INPUTS[0], INPUTS[0]]
  ])
    assert.throws(() => writeAssetBundle(inputs), { code: 'ASSET_BUNDLE_INVALID' });
  assert.throws(() => readAssetBundleIndex(bytes(64, 9)), { code: 'ASSET_BUNDLE_FORMAT_INVALID' });
  const file = writeAssetBundle(INPUTS);
  assert.throws(() => readAssetBundleIndex(file.subarray(0, 20)), { code: 'ASSET_BUNDLE_FORMAT_INVALID' });
});

test('AB03 ranges join neighbours and keep distant entries apart', () => {
  const index = readAssetBundleIndex(writeAssetBundle(INPUTS));
  const near = planAssetBundleRanges(index, ['art/hall.webp', 'models/hero-high.glb']);
  assert.equal(near.length, 1);
  assert.deepEqual(near[0].names, ['models/hero-high.glb', 'art/hall.webp']);
  const apart = planAssetBundleRanges(index, ['models/hero-high.glb', 'art/hall.webp'], 0);
  assert.equal(apart.length, 2);
});

// A host over the bytes of a file: with ranges or without.
function host(file, { ranges = true } = {}) {
  const log = [];
  const fetch = async (url, init = {}) => {
    const range = init.headers?.Range;
    log.push(range ?? 'whole');
    if (ranges && range) {
      const [, a, b] = /^bytes=(\d+)-(\d+)$/.exec(range);
      const start = Number(a),
        end = Math.min(Number(b), file.length - 1);
      const part = file.slice(start, end + 1);
      return new Response(part, { status: 206, headers: { 'Content-Range': `bytes ${start}-${end}/${file.length}` } });
    }
    return new Response(file.slice(), { status: 200 });
  };
  return { fetch, log };
}

test('AB04 over a host that serves ranges only the index and the entries asked for are fetched', async () => {
  const big = [...INPUTS, { name: 'models/far.glb', bytes: bytes(200000, 5), tags: ['high'] }];
  const file = writeAssetBundle(big);
  const { fetch, log } = host(file);
  const bundle = await openBrowserAssetBundle('pack.bin', { fetch });
  assert.equal(bundle.ranged, true);
  assert.deepEqual(
    bundle.entries('hero').map(e => e.name),
    ['models/hero-high.glb', 'models/hero-low.glb']
  );
  assert.deepEqual(
    bundle.entries('high').map(e => e.name),
    ['models/hero-high.glb', 'models/far.glb']
  );
  const got = await bundle.read(['models/hero-low.glb', 'art/hall.webp']);
  assert.deepEqual(got.get('models/hero-low.glb'), big[1].bytes);
  assert.deepEqual(got.get('art/hall.webp'), big[2].bytes);
  assert.ok(bundle.transferred < file.length / 2, `${bundle.transferred} of ${file.length}`);
  assert.equal(log.length, 2, 'the head, then one range for two neighbours');
  assert.deepEqual(await bundle.get('models/far.glb'), big[4].bytes);
});

test('AB05 a host that ignores ranges gives the whole file once, and that is kept', async () => {
  const file = writeAssetBundle(INPUTS);
  const { fetch, log } = host(file, { ranges: false });
  const bundle = await openBrowserAssetBundle('pack.bin', { fetch });
  assert.equal(bundle.ranged, false);
  assert.deepEqual(await bundle.get('art/hall.webp'), INPUTS[2].bytes);
  assert.deepEqual(await bundle.get('models/hero-high.glb'), INPUTS[0].bytes);
  assert.equal(log.length, 1);
  const missing = { fetch: async () => new Response('', { status: 404 }) };
  await assert.rejects(openBrowserAssetBundle('gone.bin', missing), { code: 'ASSET_BUNDLE_FETCH_FAILED' });
  await assert.rejects(openBrowserAssetBundle('', {}), { code: 'ASSET_BUNDLE_INVALID' });
});
