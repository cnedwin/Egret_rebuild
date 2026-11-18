// SPDX-License-Identifier: Apache-2.0
import {
  Bitmap, Sprite, copyImageData2DPixels, createAssetRef, createAssetType, createEngine,
  createImageData2D, createTexture, isTexture
} from '@egret/engine';

export const WIDTH = 320;
export const HEIGHT = 192;
export const CYCLE = 60;
export const PAGE = Object.freeze({ id: 1, width: 32, height: 8 });
export const FRAME = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x474763,
  clearAlpha: 1, outputAlpha: 'opaque' });
const tile = 8;
const swatches = [0x63bcbc, 0xe18963, 0xbce189, 0xbc89e1];
const ref = createAssetType('egret-runtime-fixture-atlas-v1', isTexture);

export function captureHost() {
  return {
    surface: {},
    close: async () => {},
    setTimeout(callback, delay) {
      const handle = setTimeout(callback, delay);
      return () => clearTimeout(handle);
    }
  };
}

function makeAtlas() {
  const pixels = new Uint8Array(PAGE.width * PAGE.height * 4);
  for (let y = 0; y < PAGE.height; y++) {
    for (let x = 0; x < PAGE.width; x++) {
      const variant = Math.floor(x / tile);
      const local = x % tile;
      const color = y === 0 || local === 0 ? 0x000000
        : (local + y + variant) % 6 === 1 ? 0xffffff : swatches[variant];
      pixels.set([color >>> 16, (color >>> 8) & 255, color & 255, 255], (y * PAGE.width + x) * 4);
    }
  }
  return createImageData2D({ width: PAGE.width, height: PAGE.height, pixels });
}

// Both execution paths own the texture through this group. Closing the scene
// returns the lease to the same engine provider that created it.
export async function createScene(host = captureHost()) {
  const engine = await createEngine({ host });
  const scope = engine.createScope();
  let page;
  let releases = 0;
  try {
    engine.assets.register(ref, {
      async load() {
        page = makeAtlas();
        return createTexture(page);
      },
      dispose(texture) {
        texture.dispose();
        releases++;
      }
    });
    const group = engine.createAssetGroup(scope, [createAssetRef(ref, 'interface')]);
    const [lease] = await group.ready;
    const panel = new Sprite();
    scope.use(panel);
    engine.stage.addChild(panel);
    panel.x = 8;
    panel.y = 8;
    panel.graphics.beginFill(0x636389).drawRect(0, 0, 304, 176).endFill();
    panel.graphics.beginFill(0x8989bc).drawRect(4, 4, 296, 20).endFill();
    const cards = [];
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 10; column++) {
        const bitmap = new Bitmap(lease);
        scope.use(bitmap);
        bitmap.x = 8 + column * 29;
        bitmap.y = 32 + row * 34;
        bitmap.scaleX = 3;
        bitmap.scaleY = 3;
        panel.addChild(bitmap);
        cards.push(bitmap);
      }
    }
    const regions = Array.from({ length: 4 }, (_, i) => ({ x: i * tile, y: 0, width: tile, height: tile }));
    let closing;
    return {
      page,
      pageBytes: () => copyImageData2DPixels(page),
      capture(index) {
        if (!Number.isSafeInteger(index) || index < 0) throw new RangeError('Invalid frame index');
        const phase = index % CYCLE;
        for (let i = 0; i < cards.length; i++) {
          cards[i].sourceRect = regions[(i + Math.floor(phase / 5)) % regions.length];
          cards[i].y = 32 + Math.floor(i / 10) * 34 + ((phase + i) % 6);
        }
        return engine.captureSharedFrame(FRAME);
      },
      close() {
        closing ??= (async () => {
          try { scope.dispose(); } finally { await engine.dispose(); }
          if (releases !== 1) throw new Error('Expected one atlas release, got ' + releases);
          return { releases };
        })();
        return closing;
      }
    };
  } catch (error) {
    try { scope.dispose(); } finally { await engine.dispose(); }
    throw error;
  }
}
