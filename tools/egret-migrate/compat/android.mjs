// SPDX-License-Identifier: Apache-2.0
import * as sdk from '@egret/engine';
import { createPointerInput } from '@egret/engine/input';
import { createLegacyBindings } from '../legacy-web.mjs';

function rgb(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffff) throw new RangeError('Expected an RGB color');
  return '#' + value.toString(16).padStart(6, '0');
}

// Keep Android glyph metrics and placement in the same coordinate system used by the shared EUI row layout.
function labelFor(raster, initial) {
  const { scope, ...style } = initial;
  const display = scope.use(new sdk.Sprite());
  display.touchEnabled = false;
  let revision = 0,
    lease,
    picture,
    closed = false,
    work = Promise.resolve(),
    key;
  function drop() {
    picture?.dispose();
    picture = undefined;
    lease?.release();
    lease = undefined;
  }
  function set(updates) {
    if (closed) return;
    Object.assign(style, updates);
    const {
      text = '',
      fontSize = 30,
      fontFamily = 'Arial',
      fontWeight = 400,
      italic = false,
      color = 0xffffff,
      strokeWidth = 0,
      strokeColor = 0
    } = style;
    const identity = JSON.stringify([
      text,
      fontSize,
      fontFamily,
      fontWeight,
      italic,
      color,
      strokeWidth,
      strokeWidth ? strokeColor : 0
    ]);
    if (identity === key) return;
    key = identity;
    const wanted = ++revision;
    work = Promise.resolve()
      .then(async () => {
        if (closed || wanted !== revision) return;
        if (!text) {
          drop();
          return;
        }
        const lines = text
          .split(/\r\n|[\r\n]/)
          .map(words => ({ text: words, size: fontSize, weight: fontWeight, italic, fontFamily }));
        const metrics = raster.measureTextInk(lines);
        const pad = strokeWidth + 1;
        let left = 0,
          top = 0,
          right = 0,
          bottom = 0;
        const step = fontSize * 1.25;
        for (const [i, m] of metrics.entries()) {
          const baseline = i * step + m.ascent;
          left = Math.min(left, m.left - pad);
          top = Math.min(top, baseline + m.top - pad);
          right = Math.max(right, m.width, m.right + pad);
          bottom = Math.max(bottom, baseline + m.bottom + pad, baseline + m.descent);
        }
        left = Math.floor(left);
        top = Math.floor(top);
        const runs = lines.map((line, i) => ({
          ...line,
          x: -left,
          y: i * step - top,
          maxWidth: Math.ceil(Math.max(1, metrics[i].width)),
          color: rgb(color),
          strokeWidth,
          strokeColor: rgb(strokeColor)
        }));
        const next = await raster.acquireText(
          Math.max(1, Math.ceil(right) - left),
          Math.max(1, Math.ceil(bottom) - top),
          runs
        );
        if (closed || wanted !== revision) {
          next.release();
          return;
        }
        try {
          if (picture) picture.textureLease = next;
          else picture = display.addChild(new sdk.Bitmap(next));
          picture.x = left;
          picture.y = top;
        } catch (error) {
          next.release();
          throw error;
        }
        lease?.release();
        lease = next;
      })
      .catch(error => {
        if (!closed && wanted === revision) {
          key = undefined;
          throw error;
        }
      });
    void work.catch(() => {});
  }
  function dispose() {
    if (closed) return;
    closed = true;
    drop();
    display.dispose();
  }
  scope.use({ dispose });
  set(style);
  return {
    display,
    set,
    get ready() {
      return work;
    },
    dispose
  };
}

const imageRegistries = new WeakMap();

// Asset IDs keep their type for the lifetime of the Engine, including later mounts.
function imageRegistry(engine) {
  let registry = imageRegistries.get(engine);
  if (registry) return registry;
  const rows = new Map();
  const handles = new WeakMap();
  const type = sdk.createAssetType('egret.android.legacy.png', sdk.isTexture);
  engine.assets.register(type, {
    async load(ref, context) {
      const row = rows.get(ref.id);
      if (!row || row.scope.signal.aborted) throw new Error('Closed Android legacy image binding');
      const { item, services } = row;
      const image = await services.raster.loadPng(item.url, item.width, item.height, context.signal);
      if (context.signal.aborted) throw context.signal.reason;
      if (row.scope.signal.aborted) throw row.scope.signal.reason;
      const texture = sdk.createTexture(image);
      try {
        handles.set(texture, services.publishPage(item.page, image));
      } catch (error) {
        texture.dispose();
        throw error;
      }
      return texture;
    },
    dispose(texture) {
      try {
        handles.get(texture)?.release();
      } finally {
        texture.dispose();
      }
    }
  });
  registry = { type, rows };
  imageRegistries.set(engine, registry);
  return registry;
}

function imageLoader(services, scope, images) {
  const byPath = new Map(),
    byId = new Set();
  for (const item of images) {
    const { url, width, height, page } = item;
    if (
      typeof url !== 'string' ||
      !url.endsWith('.png') ||
      !url.split('/').every(s => /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(s)) ||
      ![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 4096) ||
      width * height > 1048576 ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 223 ||
      byPath.has(url) ||
      byId.has(page)
    )
      throw new TypeError('Invalid or duplicate Android legacy PNG binding');
    byPath.set(url, { url, width, height, page });
    byId.add(page);
  }
  const refs = new Map();
  let registry;
  scope.signal.addEventListener(
    'abort',
    () => {
      for (const ref of refs.values()) {
        if (registry.rows.get(ref.id)?.scope === scope) registry.rows.delete(ref.id);
      }
    },
    { once: true }
  );
  return async url => {
    if (scope.signal.aborted) throw scope.signal.reason;
    const item = byPath.get(url);
    if (!item) throw new Error('Missing Android legacy PNG binding: ' + url);
    let ref = refs.get(url);
    if (!ref) {
      registry ??= imageRegistry(services.engine);
      ref = sdk.createAssetRef(registry.type, 'egret.legacy.png:' + url);
      services.engine.assets.invalidate(ref);
      registry.rows.set(ref.id, { item, scope, services });
      refs.set(url, ref);
    }
    return scope.use(await services.engine.assets.acquire(ref, { signal: scope.signal }));
  };
}

function globalBindings(api) {
  const installed = [];
  function release() {
    for (const [name, value] of installed)
      if (Object.getOwnPropertyDescriptor(globalThis, name)?.value === value) delete globalThis[name];
  }
  try {
    for (const [name, value] of Object.entries(api)) {
      if (value === undefined) continue;
      if (name in globalThis) throw new Error('Legacy namespace already installed: ' + name);
      Object.defineProperty(globalThis, name, { configurable: true, writable: false, value });
      installed.push([name, value]);
    }
  } catch (error) {
    release();
    throw error;
  }
  return release;
}

// Classic groups execute once per JS isolate. Their constructors close over the first binding set.
const usedScriptHosts = new WeakSet();

/** Mount one legacy game per player view. Reopening the complete game requires a fresh player view. */
export async function openLegacyAndroid(services, options) {
  const { width, height, entry, scriptGroup, projectId } = options;
  if (
    typeof entry !== 'string' ||
    typeof scriptGroup !== 'string' ||
    typeof projectId !== 'string' ||
    !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(entry) ||
    entry.split('.').some(n => ['__proto__', 'prototype', 'constructor'].includes(n)) ||
    !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(scriptGroup) ||
    !/^p_[A-Za-z0-9_-]{1,126}$/.test(projectId) ||
    ![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 4096)
  )
    throw new TypeError('Expected a converted entry, a V8 group, a portable project ID and a fixed stage');
  const scripts = globalThis.EgretRuntimeScripts,
    { engine, raster } = services;
  if (typeof scripts?.loadGroup !== 'function' || typeof raster?.acquireText !== 'function')
    throw new Error('This project needs the V8 script-group player and the native text page port');
  if (usedScriptHosts.has(scripts))
    throw Object.assign(new Error('Create a new Egret player view to reopen this legacy game.'), {
      code: 'LEGACY_ANDROID_NEW_VIEW_REQUIRED'
    });
  if (services.signal.aborted) throw services.signal.reason;
  const scope = engine.createScope(),
    contacts = new Map();
  usedScriptHosts.add(scripts);
  let groupRequested = false;
  let visibility,
    removeGlobals,
    closed = false;
  function close() {
    if (closed) return;
    closed = true;
    contacts.clear();
    services.signal.removeEventListener('abort', close);
    try {
      scope.dispose();
    } finally {
      removeGlobals?.();
    }
  }
  try {
    const pointer = createPointerInput({ engine, scope, width, height });
    const game = {
      engine,
      scope,
      stage: engine.stage,
      pointer,
      loadTexture: imageLoader(services, scope, options.images ?? []),
      createLabel: initial => labelFor(raster, initial)
    };
    const { api, mount } = createLegacyBindings(sdk, game, options, {
      storage: () => services.storage,
      readJson: async item => JSON.parse(await services.assets.readText(item.url, scope.signal)),
      measureLine: (text, _font, style) => raster.measureText([{ text, ...style }])[0],
      graphemes: text => raster.graphemes(text),
      onVisibility(listener) {
        visibility = listener;
        return () => {
          visibility = undefined;
        };
      }
    });
    removeGlobals = globalBindings(api);
    scope.signal.addEventListener('abort', () => removeGlobals(), { once: true });
    services.signal.addEventListener('abort', close, { once: true });
    if (services.signal.aborted) throw services.signal.reason;
    // Once evaluation begins, even a failed group may already have installed global declarations.
    groupRequested = true;
    if (options.prepareTheme) {
      if (!api.eui) throw new TypeError('Supply a theme descriptor to prepare legacy EUI skin factories.');
      await options.prepareTheme(api);
      if (scope.signal.aborted) throw scope.signal.reason;
    }
    await scripts.loadGroup(scriptGroup);
    if (scope.signal.aborted) throw scope.signal.reason;
    let entryType = globalThis;
    for (const name of entry.split('.'))
      entryType = entryType && Object.getOwnPropertyDescriptor(entryType, name)?.value;
    if (typeof entryType !== 'function')
      throw new Error('Legacy game entry not exported by ' + scriptGroup + ': ' + entry);
    await mount(new entryType());
    if (scope.signal.aborted) throw scope.signal.reason;
    let stamp = 0;
    return {
      input(event) {
        if (closed || !['down', 'move', 'up', 'cancel'].includes(event.type)) return;
        const update = { globalX: event.x, globalY: event.y, buttons: event.type === 'up' ? 0 : 1, timestamp: ++stamp };
        const session = contacts.get(event.id);
        if (event.type === 'down') {
          if (session) pointer.cancel(session, 'pointercancel');
          const next = pointer.begin({ ...update, pointerId: event.id, pointerType: 'touch' });
          if (next) contacts.set(event.id, next);
        } else if (session) {
          if (event.type === 'move') pointer.move(session, update);
          else {
            contacts.delete(event.id);
            if (event.type === 'cancel') pointer.cancel(session, 'pointercancel');
            else pointer.end(session, update);
          }
        }
      },
      pause() {
        contacts.clear();
        pointer.setInteractive(false);
        visibility?.(true);
      },
      resume() {
        pointer.setInteractive(true);
        visibility?.(false);
      },
      close
    };
  } catch (error) {
    if (!groupRequested) usedScriptHosts.delete(scripts);
    close();
    throw error;
  }
}
