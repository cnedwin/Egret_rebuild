// SPDX-License-Identifier: Apache-2.0
import { captureTextAtlas, logicalCrop } from './text-atlas.mjs';
const maxEncodedBytes = 64 * 1024;
const maxPixels = 1024 * 1024;
const pngPrefix = 'iVBORw0KGgo';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function problem(message) {
  return Object.assign(new Error(message), { code: 'LEGACY_TEXTURE_SOURCE_UNSUPPORTED' });
}

export function exactImageSize(width, height) {
  if (![width, height].every(v => Number.isInteger(v) && v > 0 && v <= 4096) || width * height > maxPixels)
    throw problem('Image dimensions exceed the migration texture budget.');
  return { width, height };
}

function encodedPng(type, data) {
  if (type === 'arraybuffer') {
    if (!(data instanceof ArrayBuffer) || !data.byteLength || data.byteLength > maxEncodedBytes)
      throw problem('Expected a PNG ArrayBuffer of at most 64 KiB.');
    const bytes = new Uint8Array(data);
    let result = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const bits = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
      result +=
        alphabet[bits >>> 18] +
        alphabet[(bits >>> 12) & 63] +
        (i + 1 < bytes.length ? alphabet[(bits >>> 6) & 63] : '=') +
        (i + 2 < bytes.length ? alphabet[bits & 63] : '=');
    }
    data = result;
  } else if (type !== 'base64') throw problem('Expected base64 or arraybuffer.');
  if (
    typeof data !== 'string' ||
    data.length > Math.ceil(maxEncodedBytes / 3) * 4 ||
    !data.startsWith(pngPrefix) ||
    data.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(data) ||
    (data.length / 4) * 3 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0) > maxEncodedBytes
  )
    throw problem('Expected a bounded base64 PNG.');
  // Validate IHDR before either host starts decoding compressed pixels.
  const head = [];
  for (let i = 0; i + 3 < data.length && head.length < 24; i += 4) {
    const n =
      (alphabet.indexOf(data[i]) << 18) |
      (alphabet.indexOf(data[i + 1]) << 12) |
      (alphabet.indexOf(data[i + 2]) << 6) |
      alphabet.indexOf(data[i + 3]);
    head.push((n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  }
  if (head.length < 24 || head.slice(8, 16).join(',') !== '0,0,0,13,73,72,68,82') throw problem('Invalid PNG header.');
  const u32 = i => head[i] * 16777216 + head[i + 1] * 65536 + head[i + 2] * 256 + head[i + 3];
  return { data, ...exactImageSize(u32(16), u32(20)) };
}

// Every drawable record points into the same lease map used by RES and Bitmap.
// A cropped Texture holds geometry metadata only. The page owner retires its storage.
export function createLegacyTextures(sdk, game, entries, HashObject, ports, observe, readField, isContainer) {
  const dataRows = new WeakMap(),
    textureRows = new WeakMap(),
    byLease = new WeakMap(),
    adoptedData = new WeakMap();
  const signal = game.scope.signal;
  const assertOpen = () => {
    if (signal.aborted) throw signal.reason ?? problem('Game has closed.');
  };
  // A long-lived RES page must not keep an abandoned Bitmap or crop alive. The
  // subscriber retains its callback and explicitly disconnects on replacement.
  function subscribe(list, callback) {
    const ref = new WeakRef(callback);
    if (list.size >= 256) for (const item of list) if (!item.deref()) list.delete(item);
    list.add(ref);
    return () => {
      if (ref.deref() === callback) list.delete(ref);
    };
  }
  function notify(list) {
    for (const item of [...list]) {
      const callback = item.deref();
      if (callback) callback();
      else list.delete(item);
    }
  }
  function publish(texture, entry) {
    if (entry) entries.set(texture, entry);
    else entries.delete(texture);
    const row = textureRows.get(texture);
    if (signal.aborted) {
      row.listeners.clear();
      return;
    }
    notify(row.listeners);
  }
  function changeData(data, lease) {
    const row = dataRows.get(data);
    row.lease = lease;
    notify(row.listeners);
  }
  function retireData(data, owner) {
    const row = dataRows.get(data);
    if (!row || row.closed || (row.borrowed && !owner)) return;
    row.closed = true;
    const lease = row.lease;
    try {
      changeData(data, undefined);
    } finally {
      row.listeners.clear();
      if (!row.borrowed) lease?.release();
      row.source = undefined;
    }
  }
  function start(data, acquire, callback) {
    const row = dataRows.get(data);
    observe(
      Promise.resolve()
        .then(() => {
          if (signal.aborted || row.closed) return;
          return acquire();
        })
        .then(lease => {
          if (!lease) return;
          if (signal.aborted || row.closed) {
            lease.release();
            return;
          }
          row.width = lease.value.width;
          row.height = lease.value.height;
          changeData(data, lease);
          if (!signal.aborted && !row.closed) callback?.(data);
        })
        .catch(error => {
          if (!signal.aborted && !row.closed) throw error;
        })
    );
    return data;
  }
  class BitmapData extends HashObject {
    constructor(source) {
      super();
      assertOpen();
      const row = { width: 0, height: 0, source, listeners: new Set() };
      dataRows.set(this, row);
      if (source != null) {
        if (!ports.imageSource) throw problem('This host cannot read a browser image element.');
        Object.assign(row, exactImageSize(source.naturalWidth ?? source.width, source.naturalHeight ?? source.height));
        start(this, () => ports.imageSource(source));
      }
    }
    static create(type, input, callback) {
      assertOpen();
      if (callback != null && typeof callback !== 'function') throw new TypeError('Expected an image callback.');
      if (!ports.pngBytes) throw problem('The host has no runtime PNG decoder.');
      const png = encodedPng(type, input);
      return start(new BitmapData(), () => ports.pngBytes(png), callback);
    }
    get width() {
      return dataRows.get(this).width;
    }
    get height() {
      return dataRows.get(this).height;
    }
    get source() {
      return dataRows.get(this).source;
    }
    $dispose() {
      retireData(this, false);
    }
  }
  function borrowedData(lease) {
    let value = byLease.get(lease);
    if (value) return value;
    value = new BitmapData();
    Object.assign(dataRows.get(value), { width: lease.value.width, height: lease.value.height, lease, borrowed: true });
    byLease.set(lease, value);
    return value;
  }
  function bind(texture, data, frame, entry) {
    const row = textureRows.get(texture);
    row.disconnect?.();
    row.derived?.dispose();
    row.derived = undefined;
    row.data = data;
    row.frame = frame;
    const d = dataRows.get(data);
    const refresh = () => {
      row.derived?.dispose();
      row.derived = undefined;
      if (signal.aborted || !d?.lease || d.closed) {
        publish(texture, undefined);
        return;
      }
      if (!frame || entry) {
        publish(texture, entry ?? d.lease);
        return;
      }
      const sheet = sdk.createSpriteSheet(
        d.lease,
        [
          {
            name: 'crop',
            x: frame.x,
            y: frame.y,
            width: frame.width,
            height: frame.height,
            layout: {
              sourceWidth: frame.sourceWidth,
              sourceHeight: frame.sourceHeight,
              trimX: frame.offsetX,
              trimY: frame.offsetY,
              packedRotation: 0
            }
          }
        ],
        'trim-rotation-v1'
      );
      row.derived = sheet;
      publish(texture, { sheet, name: 'crop', page: d.lease, frame });
    };
    refresh();
    row.disconnect = undefined;
    if (d && !d.closed) {
      row.disconnect = subscribe(d.listeners, refresh);
    }
  }
  class Texture extends HashObject {
    constructor() {
      super();
      assertOpen();
      this.disposeBitmapData = true;
      textureRows.set(this, { listeners: new Set() });
    }
    get bitmapData() {
      return textureRows.get(this).data;
    }
    set bitmapData(data) {
      assertOpen();
      if (data != null && !dataRows.has(data)) throw problem('BitmapData belongs to a different game.');
      if (dataRows.get(data)?.logical || textureRows.get(this).atlas)
        throw problem('A logical render target is published through its own atlas.');
      bind(this, data, undefined);
    }
    get textureWidth() {
      const row = textureRows.get(this);
      return row.frame?.sourceWidth ?? row.data?.width ?? 0;
    }
    get textureHeight() {
      const row = textureRows.get(this);
      return row.frame?.sourceHeight ?? row.data?.height ?? 0;
    }
    dispose() {
      const row = textureRows.get(this),
        data = row.data;
      row.virtual?.stop();
      row.releaseFrame?.();
      row.releaseFrame = undefined;
      bind(this, undefined, undefined);
      if (data && this.disposeBitmapData) retireData(data, false);
    }
  }
  const activeLogical = new Set();
  signal.addEventListener(
    'abort',
    () => {
      for (const view of [...activeLogical]) view.stop();
    },
    { once: true }
  );
  function logicalView(texture, atlas, frame) {
    const view = { users: 0, serial: 0, scheduled: false, lease: undefined, dead: false };
    const current = id => !view.dead && !atlas.closed && !signal.aborted && view.users > 0 && view.serial === id;
    const refresh = () => {
      view.serial++;
      if (!view.users || view.dead || atlas.closed || signal.aborted || view.scheduled) return;
      view.scheduled = true;
      observe(
        Promise.resolve().then(async () => {
          view.scheduled = false;
          const id = view.serial;
          if (!current(id)) return;
          const page = atlas.page;
          const area = frame ?? {
            x: 0,
            y: 0,
            width: page?.width,
            height: page?.height,
            sourceWidth: page?.width,
            sourceHeight: page?.height,
            offsetX: 0,
            offsetY: 0
          };
          const runs = page && logicalCrop(page, area);
          let next;
          try {
            if (runs?.length) next = await ports.atlasRaster(area.width, area.height, runs);
            if (!current(id)) {
              next?.release();
              return;
            }
            const old = view.lease;
            view.lease = next;
            try {
              publish(texture, next);
            } finally {
              old?.release();
            }
          } catch (error) {
            if (current(id)) throw error;
          }
        })
      );
    };
    function drop() {
      view.serial++;
      atlas.views.delete(view);
      activeLogical.delete(view);
      const old = view.lease;
      view.lease = undefined;
      try {
        publish(texture, undefined);
      } finally {
        old?.release();
      }
    }
    Object.assign(view, {
      refresh,
      attach() {
        if (view.dead || atlas.closed || signal.aborted) return;
        if (++view.users === 1) {
          atlas.views.add(view);
          activeLogical.add(view);
          refresh();
        }
      },
      detach() {
        if (view.users > 0 && --view.users === 0) drop();
      },
      stop() {
        if (view.dead) return;
        view.dead = true;
        view.users = 0;
        drop();
      }
    });
    return view;
  }
  class RenderTexture extends Texture {
    constructor() {
      super();
      const row = textureRows.get(this);
      const data = new BitmapData();
      row.data = data;
      dataRows.get(data).logical = true;
      row.atlas = { page: undefined, views: new Set(), closed: false };
      row.virtual = logicalView(this, row.atlas);
    }
    drawToTexture(display, clip, scale = 1) {
      assertOpen();
      const row = textureRows.get(this);
      if (row.atlas.closed) return false;
      if (!ports.atlasRaster) throw problem('The host has no text atlas rasterizer.');
      const page = captureTextAtlas(display, clip, scale, readField, isContainer);
      if (!page) return false;
      row.atlas.page = page;
      Object.assign(dataRows.get(row.data), { width: page.width, height: page.height });
      for (const view of row.atlas.views) view.refresh();
      return true;
    }
    dispose() {
      const row = textureRows.get(this);
      if (row.atlas.closed) return;
      row.atlas.closed = true;
      row.atlas.page = undefined;
      row.virtual.stop();
      for (const view of [...row.atlas.views]) view.stop();
      super.dispose();
    }
  }
  class SpriteSheet extends HashObject {
    #base;
    #frames = new Map();
    #owned = new Set();
    constructor(texture) {
      super();
      assertOpen();
      if (
        !textureRows.has(texture) ||
        !texture.bitmapData ||
        (textureRows.get(texture).virtual && !textureRows.get(texture).atlas)
      )
        throw problem('Expected a single-page texture or the original logical text atlas.');
      this.#base = texture;
    }
    getTexture(name) {
      return this.#frames.get(name);
    }
    createTexture(
      name,
      x,
      y,
      width,
      height,
      offsetX = 0,
      offsetY = 0,
      sourceWidth = offsetX + width,
      sourceHeight = offsetY + height
    ) {
      assertOpen();
      const base = textureRows.get(this.#base);
      if (!base?.data || (!base.atlas?.page && !entries.has(this.#base)))
        throw problem('The source texture is not ready.');
      if (typeof name !== 'string' || !name || name.length > 256 || this.#owned.size >= 2048)
        throw problem('Invalid frame name or frame table limit.');
      const original = base.frame;
      const frame = {
        x: x + (original?.x ?? 0) - (original?.offsetX ?? 0),
        y: y + (original?.y ?? 0) - (original?.offsetY ?? 0),
        width,
        height,
        offsetX,
        offsetY,
        sourceWidth,
        sourceHeight
      };
      const texture = new Texture();
      texture.disposeBitmapData = false;
      if (base.atlas) {
        if (!base.atlas.page || base.atlas.closed) throw problem('The logical atlas has closed.');
        logicalCrop(base.atlas.page, frame);
        const child = textureRows.get(texture);
        child.frame = frame;
        child.data = base.data;
        child.virtual = logicalView(texture, base.atlas, frame);
      } else bind(texture, base.data, frame);
      this.#owned.add(texture);
      textureRows.get(texture).releaseFrame = () => {
        this.#owned.delete(texture);
        if (this.#frames.get(name) === texture) this.#frames.delete(name);
      };
      this.#frames.set(name, texture);
      return texture;
    }
    dispose() {
      for (const texture of this.#owned) texture.dispose();
      this.#frames.clear();
      if (this.#base && !dataRows.get(this.#base.bitmapData)?.borrowed) this.#base.dispose();
      this.#base = undefined;
    }
  }
  function adopt(lease, entry) {
    const texture = new Texture();
    texture.disposeBitmapData = false;
    const data = borrowedData(lease);
    adoptedData.set(texture, data);
    bind(texture, data, entry?.frame, entry);
    return texture;
  }
  return {
    types: { Texture, BitmapData, SpriteSheet, RenderTexture },
    ownImage(lease) {
      const data = new BitmapData();
      Object.assign(dataRows.get(data), { width: lease.value.width, height: lease.value.height, lease });
      return data;
    },
    adopt,
    retire(texture, ownsPage) {
      const data = adoptedData.get(texture);
      adoptedData.delete(texture);
      texture.dispose();
      if (ownsPage && data) retireData(data, true);
    },
    has: value => textureRows.has(value),
    watch(texture, fn) {
      const row = textureRows.get(texture);
      if (!row) return;
      if (row.atlas?.page && row.atlas.page.width * row.atlas.page.height > maxPixels)
        throw problem('Display a child crop of the large logical text atlas.');
      const off = subscribe(row.listeners, fn);
      row.virtual?.attach();
      return () => {
        off();
        row.virtual?.detach();
      };
    }
  };
}
