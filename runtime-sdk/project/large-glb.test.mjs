// SPDX-License-Identifier: Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeContentPng } from '../../tools/content/png.mjs';
import { makeTerrainGlb } from '../examples/terrain-glb/prepare.mjs';
import { createProjectGlbLoader } from './world3d-assets.mjs';

test('a packaged terrain GLB cancels between chunks, retries on the same page and retires its resources', async () => {
  const bytes = await makeTerrainGlb(), chunkSize = 64 * 1024;
  assert(bytes.length > 1024 * 1024);
  let requests = 0, readers = 0, published = 0, released = 0, lifetime;
  const pages = new Set();
  const load = createProjectGlbLoader({
    scope: { use(owner) { lifetime = owner; } },
    signal: new AbortController().signal,
    assets: { async *readChunks() {
      readers++;
      try {
        for (let start = 0; start < bytes.length; start += chunkSize) {
          requests++;
          yield bytes.subarray(start, start + chunkSize);
        }
      } finally { readers--; }
    } },
    raster: { decodeEmbeddedPng(path, start, length) {
      assert.equal(path, 'terrain.glb');
      const {width, height, rgba} = decodeContentPng(new Uint8Array(bytes.subarray(start, start + length)));
      assert.equal(width, 16);
      return {width, height, data: rgba};
    } },
    publishPage(page) {
      assert.equal(page, 1);
      assert(!pages.has(page));
      published++;
      pages.add(page);
      return { release() { assert(pages.delete(page)); released++; } };
    }
  }, id => pages.has(id));
  const signal = new AbortController(), reason = new Error('Leave the terrain view');
  await assert.rejects(load('terrain.glb', {
    firstPage: 1, signal: signal.signal,
    onProgress(read, total) {
      assert.equal(total, bytes.length);
      if (read === 2 * chunkSize) signal.abort(reason);
    }
  }), error => error === reason);
  assert.equal(requests, 2);
  assert.equal(readers, 0);
  assert.equal(published, 0);

  const observerError = new Error('View failed');
  await assert.rejects(load('terrain.glb', {firstPage: 1, onProgress() { throw observerError; }}),
    error => error === observerError);
  assert.equal(requests, 3);
  assert.equal(readers, 0);
  assert.equal(published, 0);
  await assert.rejects(load('terrain.glb', {firstPage: 1, onProgress: true}), TypeError);
  assert.equal(requests, 3);

  const progress = [];
  const asset = await load('terrain.glb', {firstPage: 1, onProgress: (read, total) => progress.push([read, total])});
  assert.equal(progress.length, Math.ceil(bytes.length / chunkSize));
  for (const [i, [read, total]] of progress.entries()) {
    assert.equal(read, Math.min((i + 1) * chunkSize, bytes.length));
    assert.equal(total, bytes.length);
  }
  const geometry = asset.geometries[0];
  assert.equal(geometry.vertexCount, 165 * 165);
  assert.equal(geometry.index.count, 164 * 164 * 6);
  assert.equal(asset.textures.length, 1);
  assert.equal(published, 1);
  asset.dispose();
  assert.equal(released, 1);
  assert(geometry.isDisposed && asset.textures[0].isDisposed);
  await load('terrain.glb', {firstPage: 1});
  lifetime.dispose();
  assert.equal(released, 2);
  assert.equal(readers, 0);
  assert.equal(pages.size, 0);
});
