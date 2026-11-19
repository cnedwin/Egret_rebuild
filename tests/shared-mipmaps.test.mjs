// SPDX-License-Identifier: Apache-2.0
// Smaller copies of a page: a material that asks for them (`mipmapFilter: 'linear'`), the levels made on the CPU in
// the page's own encoding, how many of them a draw may read, and both Hosts uploading every level. The ports are
// controlled: they prove bytes and calls, not pixels. examples/mipmaps/verify.mjs draws them in a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { createSharedWebGL2Host } from '@egret/engine/webgl2';
import { glPorts } from './fixtures/gl-shared-rendering.mjs';
import { withPorts, pageTextures, uploads, capture, admitted } from './fixtures/gpu-shared-rendering.mjs';
import { prepareSharedDraws2D } from '../packages/engine/dist/rendering/prepareSharedDraws2D.js';
import { packSharedDraws2D } from '../packages/engine/dist/rendering/packSharedDraws2D.js';
import {
  copySharedPagePixels,
  sharedPageChainBytes2D,
  sharedPageLevelLayout2D,
  sharedPageLevels2D
} from '../packages/engine/dist/rendering/sharedColor2D.js';
import { boxStats, mipmapChecks } from '../examples/mipmaps/verify.mjs';

const LIMITS = {
  maxCommands: 65536,
  maxClipRectangles: 262144,
  maxPreparedVertices: 1048576,
  maxClipEdgeTests: 4194304,
  maxSourceTriangles: 65536,
  maxFrameGeometryBytes: 16777216,
  maxTupleComparisons: 1048576,
  pixelRatio: 1
};
const decode = code => (code / 255 <= 0.04045 ? code / 255 / 12.92 : ((code / 255 + 0.055) / 1.055) ** 2.4);
const encode = value => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
const checker = (width, height, on = [255, 255, 255, 255], off = [0, 0, 0, 255]) => {
  const pixels = new Uint8Array(4 * width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) pixels.set((x + y) % 2 ? on : off, 4 * (y * width + x));
  return egret.createImageData2D({ width, height, pixels });
};
const MIPMAPPED = { filter: 'linear', mipmapFilter: 'linear' };

// Break caught: count levels or bytes of a page that is not square, or round an odd size up.
test('MIP01 a page has a level for each halving down to one texel, odd sizes rounded down', () => {
  assert.equal(sharedPageLevels2D(1, 1), 1);
  assert.equal(sharedPageLevels2D(256, 256), 9);
  assert.equal(sharedPageLevels2D(5, 3), 3);
  assert.equal(sharedPageLevels2D(1, 300), 9);
  assert.deepEqual(sharedPageLevelLayout2D(5, 3, 3), [
    { width: 5, height: 3, offset: 0 },
    { width: 2, height: 1, offset: 60 },
    { width: 1, height: 1, offset: 68 }
  ]);
  assert.equal(sharedPageChainBytes2D(256, 256, 9), 4 * (65536 + 16384 + 4096 + 1024 + 256 + 64 + 16 + 4 + 1));
  assert.equal(sharedPageChainBytes2D(7, 9, 1), 4 * 63);
});

// Break caught: average the encoded bytes instead of linear light, forget alpha, or let a level exceed its alpha.
test('MIP02 each level is the mean in linear light, premultiplied, of the four texels above it', () => {
  // Opaque black and white: every texel of every smaller level is linear 0.5, sRGB 188.
  const grey = copySharedPagePixels(checker(8, 8), undefined, 4);
  assert.equal(grey.length, sharedPageChainBytes2D(8, 8, 4));
  for (const { width, height, offset } of sharedPageLevelLayout2D(8, 8, 4).slice(1))
    for (let i = 0; i < width * height; i++)
      assert.deepEqual([...grey.subarray(offset + 4 * i, offset + 4 * i + 4)], [188, 188, 188, 255]);
  // The page itself is as it is without levels.
  assert.deepEqual([...grey.subarray(0, 256)], [...copySharedPagePixels(checker(8, 8))]);
  // Opaque red beside clear: half the alpha, and red that is premultiplied by it.
  const half = copySharedPagePixels(checker(2, 2, [255, 0, 0, 255], [0, 0, 0, 0]), undefined, 2);
  // Red is capped where the encoded value of the alpha is: no channel shows more light than its alpha holds.
  let cap = 0;
  while (cap < 255 && decode(cap + 1) <= 128 / 255) cap++;
  const red = Math.min(cap, Math.floor(255 * encode(decode(255) / 2) + 0.5));
  assert.equal(red, 187);
  assert.deepEqual([...half.subarray(16)], [red, 0, 0, 128]);
  // An odd column is left out of the next level, as a GPU leaves it out.
  const pixels = new Uint8Array(4 * 3).fill(255);
  pixels.set([0, 0, 0, 255], 8);
  const odd = copySharedPagePixels(egret.createImageData2D({ width: 3, height: 1, pixels }), undefined, 2);
  assert.deepEqual([...odd.subarray(12)], [255, 255, 255, 255]);
});

// Break caught: accept smaller copies with the nearest filter, accept an unknown value, or lose the field in a copy.
test('MIP03 a material asks for smaller copies with the linear filter only', () => {
  assert.equal(egret.createSharedMaterial2D({}).mipmapFilter, 'none');
  assert.equal(egret.createSharedMaterial2D(MIPMAPPED).mipmapFilter, 'linear');
  assert.throws(() => egret.createSharedMaterial2D({ mipmapFilter: 'linear' }), TypeError);
  assert.throws(() => egret.createSharedMaterial2D({ filter: 'linear', mipmapFilter: 'nearest' }), TypeError);
  assert.throws(() => egret.createSharedMaterial2D({ filter: 'linear', mipmapFilter: true }), TypeError);
  // The thirteenth read of a descriptor, after the twelve there were.
  const read = [];
  egret.createSharedMaterial2D(new Proxy(MIPMAPPED, { get: (target, key) => (read.push(key), target[key]) }));
  assert.equal(read.at(-1), 'mipmapFilter');
  assert.equal(read.length, 13);
});

/** A frame of the given bitmaps, each `[image, region, material, scale]`, prepared and packed. */
async function framed(bitmaps, run) {
  const engine = await egret.createEngine({
      host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout: () => () => {} }
    }),
    scope = engine.createScope();
  try {
    let ordinal = 0;
    const nodes = [];
    for (const [image, region, material, scale = 0.25] of bitmaps) {
      const id = 'mip-' + ordinal++,
        texture = egret.createTextureView(image, region),
        type = egret.createAssetType(id, egret.isTexture);
      engine.assets.register(type, { load: async () => texture, dispose: value => value.dispose() });
      const lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, id), { signal: scope.signal }));
      const bitmap = scope.use(new egret.Bitmap(lease));
      if (material) bitmap.sharedMaterial = egret.createSharedMaterial2D(material);
      bitmap.scaleX = bitmap.scaleY = scale;
      bitmap.x = 4 * nodes.length;
      engine.stage.addChild(bitmap);
      nodes.push(bitmap);
    }
    const capture = () => engine.captureSharedFrame({ width: 64, height: 64 });
    await run({ engine, nodes, capture });
  } finally {
    scope.dispose();
    await engine.dispose();
  }
}
const whole = (width, height) => ({
  packed: { x: 0, y: 0, width, height },
  logicalWidth: width,
  logicalHeight: height,
  trimX: 0,
  trimY: 0,
  quarterTurn: 0
});
/** Words 8 to 10 of each packed draw's block: whether it reads smaller copies, the deepest level, and how. */
const mipWords = packed =>
  packed
    .filter(entry => !('barrier' in entry))
    .map(entry => [...new Uint32Array(entry.uniform.buffer, entry.uniform.byteOffset + 48 + 32, 3)]);

// Break caught: upload a page a draw reads smaller copies of without them, count its bytes without them, or give every page levels.
test('MIP04 a page sampled with smaller copies is prepared with all its levels and their bytes', async () => {
  const sampled = checker(64, 32),
    plain = checker(16, 16);
  await framed(
    [
      [sampled, whole(64, 32), MIPMAPPED],
      [plain, whole(16, 16), { filter: 'linear' }]
    ],
    async ({ capture }) => {
      const frame = capture(),
        prepared = prepareSharedDraws2D(frame, 64, 64, LIMITS);
      const index = frame.pages.findIndex(page => page.source === sampled),
        other = frame.pages.findIndex(page => page.source === plain);
      assert.equal(prepared.pageLevels[index], 7);
      assert.equal(prepared.pageLevels[other], 1);
      assert.equal(prepared.pageBytes, sharedPageChainBytes2D(64, 32, 7) + plain.byteLength);
    }
  );
});

// Break caught: let a region sharing its page read levels on which its edges cut a neighbour's texels.
test('MIP05 a draw reads every level of a whole page, and of a shared page only those its region fills exactly', async () => {
  const page = checker(128, 64),
    region = (x, y, width, height, extra = {}) => ({
      packed: { x, y, width, height },
      logicalWidth: width,
      logicalHeight: height,
      trimX: 0,
      trimY: 0,
      quarterTurn: 0,
      ...extra
    });
  await framed(
    [
      [checker(256, 256), whole(256, 256), MIPMAPPED],
      [page, region(0, 0, 64, 64), MIPMAPPED],
      [page, region(64, 16, 32, 48), MIPMAPPED],
      [page, region(6, 0, 20, 20), MIPMAPPED],
      [page, region(64, 0, 64, 64, { logicalWidth: 68, logicalHeight: 64, trimX: 4 }), MIPMAPPED],
      [page, region(0, 0, 64, 64), { filter: 'linear' }]
    ],
    async ({ capture }) => {
      const words = mipWords(packSharedDraws2D(prepareSharedDraws2D(capture(), 64, 64, LIMITS)));
      assert.deepEqual(words, [
        // The whole page, by the size of each level: all eight smaller levels.
        [1, 8, 1],
        // A region of a page shared with another: as many levels as every edge halves exactly.
        [1, 6, 0],
        [1, 4, 0],
        [1, 1, 0],
        // A trim of 4 halves twice.
        [1, 2, 0],
        // Without smaller copies the words stay zero.
        [0, 0, 0]
      ]);
    }
  );
});

// Break caught: allocate one level, upload level 0 only, or keep a page with one level for a draw that now reads more.
test('MIP06 the WebGL2 Host allocates and uploads every level, and uploads a kept page again when a draw first reads its copies', async () => {
  const image = checker(8, 4);
  await framed([[image, whole(8, 4), { filter: 'linear' }]], async ({ nodes, capture }) => {
    const f = glPorts(),
      host = createSharedWebGL2Host({ canvas: f.canvas });
    await host.start();
    const gl = f.gl,
      render = async () => {
        const before = f.events.length;
        host.renderSharedFrame(capture());
        await host.whenIdle();
        const events = f.events.slice(before);
        return {
          storage: events.filter(row => row[0] === 'texStorage2D' && row[3] === gl.RGBA8).map(row => row.slice(1)),
          levels: events.filter(row => row[0] === 'texSubImage2D').map(row => [row[2], row[5], row[6], row[9].length])
        };
      };
    const first = await render();
    assert.deepEqual(first.storage, [[gl.TEXTURE_2D, 1, gl.RGBA8, 8, 4]]);
    assert.deepEqual(first.levels, [[0, 8, 4, 128]]);
    // The same page again, kept: nothing is uploaded.
    assert.deepEqual((await render()).levels, []);
    // Now a draw reads its copies: the page is made again with four levels, each uploaded.
    nodes[0].sharedMaterial = egret.createSharedMaterial2D(MIPMAPPED);
    const upgraded = await render();
    assert.deepEqual(upgraded.storage, [[gl.TEXTURE_2D, 4, gl.RGBA8, 8, 4]]);
    assert.deepEqual(upgraded.levels, [
      [0, 8, 4, 128],
      [1, 4, 2, 32],
      [2, 2, 1, 8],
      [3, 1, 1, 4]
    ]);
    // Each level texel of a checker is the grey of its mean.
    assert.deepEqual(
      [...f.events.filter(row => row[0] === 'texSubImage2D' && row[2] === 3).at(-1)[9]],
      [188, 188, 188, 255]
    );
    // MAX_LEVEL of that texture names its deepest level.
    assert.ok(f.events.some(row => row[0] === 'texParameteri' && row[2] === gl.TEXTURE_MAX_LEVEL && row[3] === 3));
    await host.close();
    assert.equal(f.live().length, 0);
  });
});

// Break caught: create the WebGPU page with one level, write level 0 only, or serve a one-level page from residency.
test('MIP07 the WebGPU Host creates a page with every level and writes each', async () => {
  const image = checker(8, 4);
  await withPorts(async f => {
    await framed([[image, whole(8, 4), MIPMAPPED]], async ({ capture: frame }) => {
      const host = f.sharedHost();
      await f.ready(host);
      const record = capture(f, () => host.renderSharedFrame(frame()));
      admitted(record);
      const pages = pageTextures(record.textures);
      assert.equal(pages.length, 1);
      assert.equal(pages[0].descriptor.mipLevelCount, 4);
      assert.deepEqual(
        uploads(record.events).map(row => [row[1].mipLevel, row[4].width, row[4].height, row[2].length]),
        [
          [0, 8, 4, 128],
          [1, 4, 2, 32],
          [2, 2, 1, 8],
          [3, 1, 1, 4]
        ]
      );
      await record.finish();
      await host.whenIdle();
    });
  });
});

// Break caught: judge the browser check by a spread that a shimmering picture also has, or miss red from a neighbour.
test('MIP08 the browser check calls a picture with copies even grey and one without them uneven', () => {
  const even = { pixels: 900, mean: 188, spread: 0, redness: 0 },
    uneven = { pixels: 900, mean: 184, spread: 31, redness: 0 };
  assert.deepEqual(
    Object.values(mipmapChecks({ plain: uneven, copies: even, fifth: even, region: even, plainRegion: uneven })),
    [true, true, true, true]
  );
  const checks = mipmapChecks({
    plain: uneven,
    copies: uneven,
    fifth: even,
    region: { ...even, redness: 40 },
    plainRegion: uneven
  });
  assert.deepEqual([checks.copiesAreGrey, checks.regionIsGreyWithoutRed], [false, false]);
  const read = (x, y) => (x % 2 === y % 2 ? [255, 255, 255] : [0, 0, 0]);
  const stats = boxStats(read, { x: 0, y: 0, width: 10, height: 10 });
  assert.equal(stats.pixels, 64);
  assert.ok(stats.spread > 100);
});
