// SPDX-License-Identifier: Apache-2.0
import {createAssetRef, createAssetType, createTexture, isTexture} from '@egret/engine';

// A 5.x BitmapData owns a decoded image. Its SpriteSheet textures borrow packed regions
// of that same page. The last BitmapData releases the page and its CPU texture lease.
export function createOriginal5Images(services) {
  const sources = new WeakMap();
  const rows = new Map();
  const activePages = new Set();
  const type = createAssetType('egret.android.original5.image', isTexture);
  let nextSource = 0;
  let closed = false;

  services.engine.assets.register(type, {
    async load(ref) {
      const row = rows.get(ref.id);
      if (!row || closed) throw new Error('Original 5 image source is closed');
      return createTexture(row.image);
    },
    dispose(texture) { texture.dispose(); }
  });

  async function imageSource(image) {
    if (closed || services.signal.aborted) throw new Error('Original 5 project closed');
    const ref = createAssetRef(type, 'original5.page:' + ++nextSource);
    const row = {image, ref, leases: 0, page: undefined, gpu: undefined, lease: undefined};
    rows.set(ref.id, row);
    try {
      row.lease = await services.engine.assets.acquire(ref, {signal: services.signal});
      if (closed || services.signal.aborted) throw new Error('Original 5 project closed');
      const source = Object.freeze({width: image.width, height: image.height});
      sources.set(source, row);
      return source;
    } catch (error) {
      row.lease?.release();
      rows.delete(ref.id);
      throw error;
    }
  }

  function releasePage(row) {
    row.gpu?.release();
    activePages.delete(row.page);
    row.gpu = undefined;
    row.page = undefined;
  }

  function hold(source) {
    const row = sources.get(source);
    if (!row || closed || !rows.has(row.ref.id)) throw new Error('Expected an active original 5 image source');
    if (!row.leases) {
      let page = 1;
      while (page <= 223 && activePages.has(page)) page++;
      if (page > 223) throw new RangeError('Original 5 image page budget exhausted');
      row.gpu = services.publishPage(page, row.image);
      row.page = page;
      activePages.add(page);
    }
    row.leases++;
    let released = false;
    return {
      lease: row.lease,
      release() {
        if (released) return;
        released = true;
        if (--row.leases === 0 && rows.has(row.ref.id)) {
          releasePage(row);
          releaseImageSource(source);
        }
      }
    };
  }

  function releaseImageSource(source) {
    const row = sources.get(source);
    if (!row || closed || !rows.has(row.ref.id)) return false;
    if (row.leases) throw new Error('Release original 5 BitmapData before its image source');
    sources.delete(source);
    rows.delete(row.ref.id);
    row.lease.release();
    services.engine.assets.invalidate(row.ref);
    return true;
  }

  function close() {
    if (closed) return;
    closed = true;
    for (const row of rows.values()) {
      releasePage(row);
      row.lease?.release();
      services.engine.assets.invalidate(row.ref);
    }
    rows.clear();
  }
  return {imageSource, releaseImageSource, hold, close};
}
