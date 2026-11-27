// SPDX-License-Identifier: Apache-2.0
import { createAssetRef, createAssetType, createTexture, isTexture } from '@egret/engine';

const maxSlots = 32;
const maxBytes = 8 * 1024 * 1024;

function number(value, min, max, name) {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError('Invalid text ' + name);
  return value;
}

function rgb(value) {
  if (typeof value !== 'string' || !/^#[a-f\d]{6}$/i.test(value)) throw new TypeError('Expected #RRGGBB');
  return value.toLowerCase();
}

function capture(width, height, runs) {
  if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 4096) || width * height > 1048576)
    throw new RangeError('Invalid raster dimensions');
  if (!Array.isArray(runs) || runs.length > 256) throw new RangeError('Expected at most 256 text runs');
  let units = 0;
  const words = runs.map(run => {
    const { text, size, weight = 400, x, y, maxWidth, color, fontFamily = 'sans-serif', italic = false, strokeWidth = 0, strokeColor = '#000000' } = run;
    if (typeof text !== 'string' || text.length > 4096 || (units += text.length) > 8192)
      throw new RangeError('A cached text page accepts at most 8192 UTF-16 units and 4096 per run');
    if (typeof fontFamily !== 'string' || !fontFamily || fontFamily.length > 256 || typeof italic !== 'boolean')
      throw new TypeError('Invalid text style');
    number(strokeWidth, 0, 512, 'outline radius');
    return {
      text, fontFamily, italic, size: number(size, 1, 256, 'size'), weight: Math.trunc(number(weight, 1, 1000, 'weight')),
      x: number(x, -4096, 4096, 'x'), y: number(y, -4096, 4096, 'y'),
      maxWidth: number(maxWidth, 0, 4096, 'width'), color: rgb(color),
      ...(strokeWidth > 0 ? { strokeWidth, strokeColor: rgb(strokeColor) } : {})
    };
  });
  return { width, height, runs: words };
}

/** A project owns one set of slots. The AssetManager controls concurrent loads, caller leases and final cleanup. */
export function createPlayerTextPages(engine, drawText, reservePage, lifetime) {
  const type = createAssetType('egret.android.raster.text', isTexture);
  const slots = Array.from({ length: maxSlots }, (_, i) => createAssetRef(type, 'egret.android.raster.text.' + i));
  const byKey = new Map(), byId = new Map(), textures = new WeakMap();
  let bytes = 0, hits = 0, rasterizations = 0, releases = 0, refusals = 0;

  function forget(row) {
    if (byId.get(row.ref.id) !== row) return;
    byId.delete(row.ref.id);
    byKey.delete(row.key);
    bytes -= row.bytes;
  }

  engine.assets.register(type, {
    load(ref) {
      const row = byId.get(ref.id);
      if (!row) throw new Error('Text page has no source');
      let page, texture;
      try {
        page = reservePage();
        const { width, height, runs } = row.descriptor;
        texture = createTexture(drawText(width, height, runs));
        page.publish(texture.imageData);
        textures.set(texture, { row, page });
        row.painted = true;
        rasterizations++;
        return texture;
      } catch (error) {
        try { page?.release(); } finally { texture?.dispose(); forget(row); }
        throw error;
      }
    },
    dispose(texture) {
      const { row, page } = textures.get(texture);
      try { page.release(); }
      finally {
        texture.dispose();
        textures.delete(texture);
        forget(row);
        releases++;
      }
    }
  });
  return Object.freeze({
    async acquireText(width, height, runs) {
      if (lifetime.aborted) throw lifetime.reason;
      const descriptor = capture(width, height, runs), key = JSON.stringify(descriptor);
      // A game-provided run or array getter can close its view while the descriptor is being read.
      if (lifetime.aborted) throw lifetime.reason;
      let row = byKey.get(key);
      if (row) hits++;
      else {
        const ref = slots.find(slot => !byId.has(slot.id)), charge = width * height * 4;
        if (!ref || charge > maxBytes - bytes) {
          refusals++;
          throw new RangeError('Android text page budget reached');
        }
        row = { ref, key, descriptor, bytes: charge, waiting: 0, painted: false };
        byKey.set(key, row);
        byId.set(ref.id, row);
        bytes += charge;
      }
      row.waiting++;
      try { return await engine.assets.acquire(row.ref, { signal: lifetime }); }
      finally {
        if (--row.waiting === 0 && !row.painted) forget(row);
      }
    },
    textPageUsage() {
      return Object.freeze({ occupied: byKey.size, bytes, hits, rasterizations, releases, refusals, maxSlots, maxBytes });
    }
  });
}
