// SPDX-License-Identifier: Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProjectGlbLoader } from './world3d-assets.mjs';

function triangleGlb(mimeType = 'image/jpeg', signature = [255, 216, 255]) {
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: 107 }],
    bufferViews: [
      [0, 36],
      [36, 36],
      [72, 24],
      [96, 6],
      [104, 3]
    ].map(([byteOffset, byteLength]) => ({ buffer: 0, byteOffset, byteLength })),
    accessors: [
      [0, 5126, 3, 'VEC3'],
      [1, 5126, 3, 'VEC3'],
      [2, 5126, 3, 'VEC2'],
      [3, 5123, 3, 'SCALAR']
    ].map(([bufferView, componentType, count, type]) => ({ bufferView, componentType, count, type })),
    images: [{ bufferView: 4, mimeType }],
    textures: [{ source: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0
  };
  const doc = new TextEncoder().encode(JSON.stringify(json));
  const len = (doc.length + 3) & ~3,
    bin = 28 + len;
  const out = new Uint8Array(bin + 108),
    v = new DataView(out.buffer);
  for (const [i, n] of [
    [0, 0x46546c67],
    [4, 2],
    [8, out.length],
    [12, len],
    [16, 0x4e4f534a],
    [20 + len, 108],
    [24 + len, 0x004e4942]
  ])
    v.setUint32(i, n, true);
  out.fill(32, 20, 20 + len);
  out.set(doc, 20);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((n, i) => v.setFloat32(bin + 4 * i, n, true));
  v.setUint16(bin + 98, 1, true);
  v.setUint16(bin + 100, 2, true);
  out.set(signature, bin + 104);
  return out;
}

test('packaged GLB routes its original image range to the shared pages and retires each generation once', async () => {
  const glb = triangleGlb(),
    pages = new Map(),
    released = [],
    scope = [];
  const signal = new AbortController();
  let valid = true;
  const services = {
    assets: {
      async *readChunks() {
        yield glb.subarray(0, 5);
        yield glb.subarray(5, 37);
        yield glb.subarray(37, valid ? undefined : glb.length - 1);
      }
    },
    scope: {
      use(resource) {
        scope.push(resource);
      }
    },
    signal: signal.signal,
    raster: {
      decodeEmbeddedJpeg(path, offset, length) {
        assert.equal(path, 'kart.glb');
        assert.equal(length, 3);
        assert.deepEqual([...glb.subarray(offset, offset + length)], [255, 216, 255]);
        return { width: 1, height: 1, data: new Uint8Array([72, 80, 200, 255]) };
      }
    },
    publishPage(id, source) {
      pages.set(id, source);
      return {
        release() {
          released.push(id);
          pages.delete(id);
        }
      };
    }
  };
  const load = createProjectGlbLoader(services, (id) => pages.has(id));
  const a = await load('kart.glb', { firstPage: 7 });
  assert.strictEqual(a.materials[0].map.source, pages.get(7));
  await assert.rejects(load('kart.glb', { firstPage: 7 }), /range unavailable/);
  assert.strictEqual(a.materials[0].map.source, pages.get(7));
  a.dispose();
  a.dispose();
  assert.ok(a.geometries[0].isDisposed);
  const b = await load('kart.glb', { firstPage: 7 });
  valid = false;
  await assert.rejects(load('kart.glb', { firstPage: 8 }), /Incomplete/);
  signal.abort();
  await assert.rejects(load('kart.glb', { firstPage: 8 }), { name: 'AbortError' });
  for (const owner of scope) owner.dispose();
  assert.ok(b.textures[0].isDisposed);
  assert.deepEqual(released, [7, 7]);
  await assert.rejects(load('kart.glb', { firstPage: 8 }), /scope closed/);
  assert.equal(pages.size, 0);
});

test('embedded PNG uses its own package range decoder and retires the shared page', async () => {
  const signature = [137, 80, 78];
  const bytes = triangleGlb('image/png', signature);
  const releases = [];
  const loader = createProjectGlbLoader({
    assets: { async *readChunks() { yield bytes; } },
    signal: new AbortController().signal,
    scope: { use() {} },
    raster: {
      decodeEmbeddedPng(path, offset, length) {
        assert.equal(path, 'hero.glb');
        assert.deepEqual([...bytes.subarray(offset, offset + length)], signature);
        return { width: 1, height: 1, data: new Uint8Array([128, 128, 255, 255]) };
      }
    },
    publishPage(id) { return { release() { releases.push(id); } }; }
  }, () => false);
  const model = await loader('hero.glb', { firstPage: 11 });
  assert.equal(model.textures.length, 1);
  model.dispose();
  assert.deepEqual(releases, [11]);
});

test('closing the owning scope aborts an in-flight native reader before page publication', async () => {
  let owner, reading;
  const started = new Promise((resolve) => {
    reading = resolve;
  });
  const load = createProjectGlbLoader(
    {
      scope: {
        use(resource) {
          owner = resource;
        }
      },
      signal: new AbortController().signal,
      assets: {
        async *readChunks(path, signal) {
          reading();
          await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
        }
      },
      publishPage() {
        assert.fail('late publication');
      }
    },
    () => false
  );
  const pending = load('kart.glb', { firstPage: 2 });
  await started;
  owner.dispose();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('a failed geometry listener still retires sibling textures, pages and other loaded models', async () => {
  const bytes = triangleGlb(),
    pages = new Set();
  let owner;
  const load = createProjectGlbLoader(
    {
      scope: {
        use(resource) {
          owner = resource;
        }
      },
      signal: new AbortController().signal,
      assets: {
        async *readChunks() {
          yield bytes;
        }
      },
      raster: {
        decodeEmbeddedJpeg() {
          return { width: 1, height: 1, data: new Uint8Array(4) };
        }
      },
      publishPage(id) {
        pages.add(id);
        return {
          release() {
            pages.delete(id);
          }
        };
      }
    },
    (id) => pages.has(id)
  );
  const kart = await load('kart.glb', { firstPage: 2 }),
    driver = await load('driver.glb', { firstPage: 3 });
  const failure = new Error('geometry listener');
  kart.geometries[0].onDispose(() => {
    throw failure;
  });
  assert.throws(
    () => owner.dispose(),
    (cause) => cause === failure
  );
  for (const a of [kart, driver])
    for (const r of [...a.geometries, ...a.materials, ...a.textures]) assert.equal(r.isDisposed, true);
  assert.deepEqual([...pages], []);
});
