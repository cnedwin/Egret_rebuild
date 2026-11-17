// SPDX-License-Identifier: Apache-2.0
// The forgiving browser picture route: format sniffing, fitting to the 2D
// image limits, canvas readback, the image-element fallback and the provider.
import assert from 'node:assert/strict';
import test from 'node:test';
import { IMAGE_LIMITS_2D } from '@egret/contracts';
import {
  createBrowserImageTextureProvider,
  decodeBrowserImage,
  fitBrowserImageSize,
  sniffBrowserImageFormat,
  textureFromCanvas
} from '@egret/engine/web/kit';

const bytes = (...values) => new Uint8Array(values);
const ascii = text => [...text].map(c => c.charCodeAt(0));

// A canvas whose 2D context paints every pixel with the colour of what was drawn.
function fakePorts(log = []) {
  return {
    log,
    createCanvas(width, height) {
      const canvas = {
        width,
        height,
        getContext: () => ({
          drawImage: (source, x, y, w, h) => log.push(['draw', source.name ?? 'source', w, h]),
          getImageData: (x, y, w, h) => {
            const data = new Uint8ClampedArray(w * h * 4);
            for (let i = 0; i < data.length; i += 4) data.set([10, 20, 30, 255], i);
            return { data };
          }
        })
      };
      return canvas;
    },
    async decode(encoded, type) {
      log.push(['decode', type, encoded.byteLength]);
      return { source: { name: 'decoded' }, width: 8, height: 4, release: () => log.push(['release']) };
    }
  };
}

test('BI01 the format is read from the first bytes', () => {
  assert.equal(sniffBrowserImageFormat(bytes(0x89, ...ascii('PNG'), 13, 10, 26, 10)), 'png');
  assert.equal(sniffBrowserImageFormat(bytes(0xff, 0xd8, 0xff, 0xe0)), 'jpeg');
  assert.equal(sniffBrowserImageFormat(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBPVP8 '))), 'webp');
  assert.equal(sniffBrowserImageFormat(bytes(...ascii('GIF89a'))), 'gif');
  assert.equal(sniffBrowserImageFormat(bytes(0, 0, 0, 28, ...ascii('ftypavif'))), 'avif');
  assert.equal(sniffBrowserImageFormat(bytes(1, 2, 3, 4)), undefined);
  assert.equal(sniffBrowserImageFormat(bytes()), undefined);
});

test('BI02 large pictures are scaled down evenly to the limits, small ones kept', () => {
  assert.deepEqual(fitBrowserImageSize(640, 480), { width: 640, height: 480 });
  const big = fitBrowserImageSize(4000, 3000);
  assert.ok(big.width * big.height <= IMAGE_LIMITS_2D.maxSourcePixels);
  assert.ok(Math.abs(big.width / big.height - 4 / 3) < 0.01);
  const long = fitBrowserImageSize(10000, 100);
  assert.ok(long.width <= IMAGE_LIMITS_2D.maxSourceEdge);
  assert.deepEqual(fitBrowserImageSize(1000, 1000, { maxPixels: 250000 }), { width: 500, height: 500 });
  assert.deepEqual(fitBrowserImageSize(1000, 500, { maxEdge: 100 }), { width: 100, height: 50 });
  assert.throws(() => fitBrowserImageSize(0, 10), { code: 'BROWSER_IMAGE_SIZE_INVALID' });
  assert.throws(() => fitBrowserImageSize(NaN, 10), { code: 'BROWSER_IMAGE_SIZE_INVALID' });
});

test('BI03 a painted canvas becomes a texture of its read-back bytes and is emptied after', () => {
  const ports = fakePorts();
  const made = [];
  const create = ports.createCanvas;
  ports.createCanvas = (w, h) => {
    const canvas = create(w, h);
    made.push(canvas);
    return canvas;
  };
  const texture = textureFromCanvas({ name: 'painted', width: 3, height: 2 }, { ports });
  assert.equal(texture.width, 3);
  assert.equal(texture.height, 2);
  assert.deepEqual(ports.log, [['draw', 'painted', 3, 2]]);
  assert.equal(made[0].width, 0);
  texture.dispose();
});

test('BI04 decoding goes through the ports and releases what decoding held', async () => {
  const ports = fakePorts();
  const texture = await decodeBrowserImage(bytes(0xff, 0xd8, 0xff, 0xdb, 1, 2), { ports });
  assert.equal(texture.width, 8);
  assert.equal(texture.height, 4);
  assert.deepEqual(ports.log, [['decode', 'image/jpeg', 6], ['draw', 'decoded', 8, 4], ['release']]);
  texture.dispose();
  await assert.rejects(decodeBrowserImage(bytes(1, 2, 3), { ports }), { code: 'BROWSER_IMAGE_FORMAT_UNKNOWN' });
  await assert.rejects(decodeBrowserImage(new Uint8Array(0), { ports }), { code: 'BROWSER_IMAGE_BYTES_INVALID' });
  const failing = { ...fakePorts(), decode: async () => Promise.reject(new Error('broken')) };
  await assert.rejects(decodeBrowserImage(bytes(0x89, ...ascii('PNG')), { ports: failing }), {
    code: 'BROWSER_IMAGE_DECODE_FAILED'
  });
});

test('BI05 without ports, an image element decodes what createImageBitmap refuses', async () => {
  const saved = {
    document: globalThis.document,
    createImageBitmap: globalThis.createImageBitmap,
    OffscreenCanvas: globalThis.OffscreenCanvas,
    create: URL.createObjectURL,
    revoke: URL.revokeObjectURL
  };
  const log = [];
  try {
    globalThis.createImageBitmap = async () => {
      log.push('bitmap refused');
      throw new Error('unsupported options');
    };
    delete globalThis.OffscreenCanvas;
    URL.createObjectURL = blob => (log.push('url ' + blob.type), 'blob:test');
    URL.revokeObjectURL = address => log.push('revoke ' + address);
    globalThis.document = {
      createElement(kind) {
        if (kind === 'img')
          return { name: 'img', naturalWidth: 5, naturalHeight: 5, decode: async () => log.push('img decoded') };
        return fakePorts(log).createCanvas(0, 0);
      }
    };
    const texture = await decodeBrowserImage(bytes(...ascii('GIF89a'), 1, 0, 1, 0));
    assert.equal(texture.width, 5);
    assert.deepEqual(log.slice(0, 4), ['bitmap refused', 'url image/gif', 'img decoded', 'revoke blob:test']);
    assert.deepEqual(log[4], ['draw', 'img', 5, 5]);
    texture.dispose();
  } finally {
    globalThis.createImageBitmap = saved.createImageBitmap;
    if (saved.OffscreenCanvas) globalThis.OffscreenCanvas = saved.OffscreenCanvas;
    URL.createObjectURL = saved.create;
    URL.revokeObjectURL = saved.revoke;
    if (saved.document === undefined) delete globalThis.document;
    else globalThis.document = saved.document;
  }
});

test('BI06 the provider reads bytes, honours cancellation and disposes textures', async () => {
  const ports = fakePorts();
  const provider = createBrowserImageTextureProvider({
    ports,
    readBytes: async ref => (assert.equal(ref.id, 'hero.webp'), bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')))
  });
  const texture = await provider.load({ id: 'hero.webp' }, {});
  assert.equal(texture.width, 8);
  provider.dispose(texture);
  const controller = new AbortController();
  controller.abort(new Error('gone'));
  await assert.rejects(provider.load({ id: 'hero.webp' }, { signal: controller.signal }), /gone/);
  assert.throws(() => createBrowserImageTextureProvider({}), { code: 'BROWSER_IMAGE_PROVIDER_INVALID' });
});
