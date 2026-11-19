// SPDX-License-Identifier: Apache-2.0
// Pictures drawn smaller than they are, with and without their smaller copies (`mipmapFilter: 'linear'`).
// The top row is a page of one-texel black and white squares drawn at about an eighth of its size: without the copies it
// shimmers into stray black and white, with them it is an even grey. The bottom row is a region of a page shared
// with a red neighbour, drawn at about a quarter: the grey stays grey, with no red from beside it. `?backend=webgl2` or
// `webgpu` chooses the Host. The first frames draw the picture of the second square without its copies and then
// with them, so the Host has to upload the page again with its levels. `examples/mipmaps/verify.mjs` reads the result.
import {
  Bitmap,
  createAssetRef,
  createAssetType,
  createImageData2D,
  createSharedMaterial2D,
  createTextureView,
  isTexture
} from '@egret/engine';
import { createBrowserGame } from '@egret/engine/web/game';

const query = new URLSearchParams(location.search);
const report = (window.__mipmaps = { frames: 0, errors: [], boxes: {} });
const checker = (width, height, red) => {
  const pixels = new Uint8Array(4 * width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const o = 4 * (y * width + x);
      if (red !== undefined && x >= red) pixels.set([255, 0, 0, 255], o);
      else pixels.set((x + y) % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255], o);
    }
  return createImageData2D({ width, height, pixels });
};
const PAGES = {
  // A whole page, 256 by 256, and a page of two 64 by 64 regions: a checker on the left and red on the right.
  whole: [checker(256, 256), { x: 0, y: 0, width: 256, height: 256 }],
  shared: [checker(128, 64, 64), { x: 0, y: 0, width: 64, height: 64 }]
};
let game;
try {
  game = await createBrowserGame({
    canvas: document.querySelector('#scene'),
    width: 400,
    height: 200,
    pixelRatio: 1,
    clearColor: 0x202020,
    backend: query.get('backend') ?? 'auto',
    update() {
      report.frames++;
      // From the twentieth frame the second square samples the copies its page had no levels for until then.
      if (report.frames === 20) copies.sharedMaterial = mipmapped;
    },
    onError(cause) {
      report.errors.push(String(cause?.code ?? cause?.message ?? cause));
    }
  });
} catch (cause) {
  report.errors.push(String(cause?.code ?? cause?.message ?? cause));
  throw cause;
}
report.backend = game.backend;
const { engine, scope } = game;
const type = createAssetType('mipmap-pages', isTexture);
engine.assets.register(type, {
  async load(ref) {
    const [image, packed] = PAGES[ref.id];
    return createTextureView(image, {
      packed,
      logicalWidth: packed.width,
      logicalHeight: packed.height,
      trimX: 0,
      trimY: 0,
      quarterTurn: 0
    });
  },
  dispose(value) {
    value.dispose();
  }
});
const lease = async id => scope.use(await engine.assets.acquire(createAssetRef(type, id), { signal: scope.signal }));
const whole = await lease('whole'),
  shared = await lease('shared');
const linear = createSharedMaterial2D({ filter: 'linear' }),
  mipmapped = createSharedMaterial2D({ filter: 'linear', mipmapFilter: 'linear' });
const place = (texture, material, x, y, scale, name) => {
  const bitmap = scope.use(new Bitmap(texture));
  bitmap.sharedMaterial = material;
  bitmap.x = x;
  bitmap.y = y;
  bitmap.scaleX = bitmap.scaleY = scale;
  engine.stage.addChild(bitmap);
  report.boxes[name] = { x, y, width: bitmap.width, height: bitmap.height };
  return bitmap;
};
place(whole, linear, 20, 20, 0.13, 'plain');
const copies = place(whole, linear, 80, 20, 0.13, 'copies');
place(whole, mipmapped, 140, 20, 0.19, 'fifth');
place(shared, mipmapped, 20, 100, 0.23, 'region');
place(shared, linear, 80, 100, 0.23, 'plainRegion');
report.ready = true;
// What stopped the Host, if anything did: the check reads it with the pixels.
report.hostFailure = () => game.host.getStatus().firstFailure?.code;
