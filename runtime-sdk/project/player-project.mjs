// SPDX-License-Identifier: Apache-2.0
// One engine and root scope belong to one project view. Only captured Egret commands cross the bridge.
import { createEngine, copyImageData2DPixels } from '@egret/engine';
import { createCapturedProjectEncoder } from '../scene/project-frame.mjs';
import { base64 } from '../scene/commands.mjs';
import { createPlayerRaster } from './player-raster.mjs';
import { createPlayerTextPages } from './player-text-pages.mjs';
import { createHostServices } from './host-services.mjs';
import { createPlayerAssets } from './player-text-assets.mjs';

const MAX_SAVE_BYTES = 1024 * 1024;
// In Unicode mode a surrogate pair is one code point outside this range.
const unpairedSurrogate = /[\uD800-\uDFFF]/u;

function checkSaveText(text, maxBytes) {
  if (text.length > maxBytes) throw new RangeError('Save value exceeds 1 MiB of UTF-8');
  if (unpairedSurrogate.test(text)) throw new TypeError('Save text contains an unpaired surrogate');
  // Each well-formed UTF-16 code unit costs at most three UTF-8 bytes. Count
  // the excess over one byte per unit only when the length alone is inconclusive.
  if (text.length * 3 <= maxBytes) return;
  let bytes = text.length;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0x80) continue;
    bytes += unit < 0x800 ? 1 : 2;
    if (unit >= 0xd800 && unit <= 0xdbff) i++;
    if (bytes > maxBytes) throw new RangeError('Save value exceeds 1 MiB of UTF-8');
  }
}

function createPlayerStorage(native, lifetime) {
  function check(key, method) {
    if (lifetime.aborted) throw lifetime.reason;
    if (typeof native[method] !== 'function')
      throw Object.assign(new Error('This player library does not support project saves'), {name: 'NotSupportedError'});
    if (typeof key !== 'string') throw new TypeError('Expected a string save key');
    if (key.length < 1 || key.length > 256) throw new RangeError('Save keys must have 1–256 UTF-16 code units');
    if (unpairedSurrogate.test(key)) throw new TypeError('Save key contains an unpaired surrogate');
  }
  return Object.freeze({
    getItem(key) {
      check(key, 'saveRead');
      const raw = native.saveRead(key);
      if (typeof raw !== 'string') throw new Error('Missing Android save response');
      const result = JSON.parse(raw);
      if (result && typeof result === 'object' && Object.keys(result).length === 1) {
        if (Object.hasOwn(result, 'error') && typeof result.error === 'string') throw new Error(result.error);
        if (Object.hasOwn(result, 'value') && (result.value === null || typeof result.value === 'string'))
          return result.value;
      }
      throw new Error('Invalid Android save response');
    },
    setItem(key, value) {
      check(key, 'saveWrite');
      if (typeof value !== 'string') throw new TypeError('Expected a string save value');
      checkSaveText(value, MAX_SAVE_BYTES);
      // Native success acknowledges the commit. Closing the session after admission
      // must not turn that success into an error or cause the caller to retry it.
      if (native.saveWrite(key, value) !== true) throw new Error('Android save write failed');
    },
    removeItem(key) {
      check(key, 'saveRemove');
      if (native.saveRemove(key) !== true) throw new Error('Android save removal failed');
    }
  });
}

export function createPlayerProject(definition, native, composeWorld, extendServices) {
  const encoder = createCapturedProjectEncoder();
  const pageIds = new Map();
  const resident = new Map();
  const textPageIds = new Set();
  const lifetime = new AbortController();
  const editorEvents = new Map();
  let nextEditorId = 1;
  const { host, hostResult } = createHostServices(native, lifetime.signal);
  const { assets, textResult } = createPlayerAssets(native, lifetime.signal);
  const frameOptions = Object.freeze({
    width: definition.width, height: definition.height, clearColor: definition.clearColor ?? 0,
    clearAlpha: composeWorld ? 0 : 1, outputAlpha: composeWorld ? 'premultiplied' : 'opaque'
  });
  let engine, scope, game, opening, closing, retirement, frameId = 0;
  let paused = false, stopped = false, lastTime = -1, pagesReleased = 0;
  let anchor, simulationSeconds = 0;

  // The handle captures only its ID and its own identity. Keeping a stale handle
  // in a Scope cannot pin the pixels or evict a later publication of the same image.
  function pageHandle(id) {
    const handle = Object.freeze({
      release() {
        const current = resident.get(id);
        if (current?.handle !== handle) return false;
        native.releasePage(id);
        pageIds.delete(current.image);
        resident.delete(id);
        pagesReleased++;
        return true;
      }
    });
    return handle;
  }

  function publishPage(id, image) {
    if (textPageIds.has(id)) throw new Error('Texture page belongs to an active text lease');
    return publish(id, image);
  }

  function reserveTextPage(minimum = 1) {
    let id = 255;
    while (id >= minimum && (resident.has(id) || textPageIds.has(id))) id--;
    if (id < minimum) throw new Error('No free dynamic texture page');
    textPageIds.add(id);
    let handle;
    return {
      publish(image) { handle = publish(id, image); },
      release() {
        try { handle?.release(); } finally { textPageIds.delete(id); }
      }
    };
  }

  function publish(id, image) {
    if (stopped) throw new Error('Project closed');
    if (!Number.isInteger(id) || id < 1 || id > 255) throw new RangeError('Texture page ID');
    const old = resident.get(id);
    if (old && old.image === image) return old.handle;
    if (pageIds.has(image)) throw new Error('Texture already bound to another page');
    const bytes = copyImageData2DPixels(image);
    native.page(id, image.width, image.height, typeof bytes.toBase64 === 'function' ? bytes.toBase64() : base64(bytes));
    if (old) pageIds.delete(old.image);
    const handle = pageHandle(id);
    pageIds.set(image, id);
    resident.set(id, { image, handle });
    return handle;
  }

  function disposeOnce() {
    retirement ??= Promise.resolve().then(async () => {
      const failures = [];
      let snapshot;
      try { await game?.close?.(); } catch (error) { failures.push(error); }
      try { scope?.dispose(); } catch (error) { failures.push(error); }
      try { await engine?.dispose(); } catch (error) { failures.push(error); }
      for (const { handle } of resident.values()) {
        try { handle.release(); } catch (error) { failures.push(error); }
      }
      try { snapshot = { ...game?.closedSnapshot?.(), pagesReleased }; }
      catch (error) { failures.push(error); }
      finally {
        encoder.clear();
        pageIds.clear();
        resident.clear();
        // The optional World3D capture owns a pooled draw list of the last scene.
        composeWorld = extendServices = undefined;
        engine = scope = game = undefined;
      }
      if (failures.length) throw new AggregateError(failures, 'Project disposal failed');
      return snapshot;
    });
    return retirement;
  }

  return Object.freeze({
    textResult, hostResult,
    ...(composeWorld && {
      worldGeometryBatch(epoch, frameId, ordinal) {
        if (stopped || !game) throw new Error('Project unavailable');
        return composeWorld.geometryBatch(epoch, frameId, ordinal);
      },
      recoverWorldFrame(epoch, frameId) {
        if (stopped || !game) throw new Error('Project unavailable');
        return composeWorld.recover(epoch, frameId);
      }
    }),
    start() {
      if (stopped) return Promise.reject(new Error('Project closed'));
      opening ??= (async () => {
        try {
          engine = await createEngine({ host: {
            surface: {}, close: async () => {},
            setTimeout(callback, milliseconds) {
              const timer = setTimeout(callback, milliseconds);
              return () => clearTimeout(timer);
            }
          } });
          if (stopped) return;
          scope = engine.createScope();
          const raster = createPlayerRaster(native, lifetime.signal);
          const services = {
            engine, scope, assets, host, publishPage, signal: lifetime.signal,
            publishTransientPage(image) {
              // App-declared classic image pages occupy 1..223. Dynamic PNG and text share the remaining slots.
              const reservation = reserveTextPage(224);
              try { reservation.publish(image); return reservation; }
              catch (error) { reservation.release(); throw error; }
            },
            raster: raster && Object.freeze({ ...raster, ...createPlayerTextPages(engine, raster.drawText, reserveTextPage, lifetime.signal) }),
            storage: createPlayerStorage(native, lifetime.signal),
            music: Object.freeze({
              play(path, {loop = true, signal} = {}) {
                return host.call('egret.music.play', {path, loop}, signal);
              },
              stop() { return host.call('egret.music.stop', null); }
            }),
            waitForBack: signal => host.call('egret.waitForBack', null, signal),
            edit: text => native.edit(text),
            editText(options = {}, signal) {
              const text = options.text ?? '';
              if (typeof text !== 'string' || text.length > 8192) throw new RangeError('Expected up to 8192 UTF-16 units');
              const request = {text, multiline: options.multiline === true};
              if (options.inputMode !== undefined) {
                if (!['text','tel'].includes(options.inputMode)) throw new RangeError('Unsupported keyboard type');
                request.inputMode = options.inputMode;
              }
              if (options.maxLength !== undefined) {
                if (!Number.isInteger(options.maxLength) || options.maxLength < 1 || options.maxLength > 8192)
                  throw new RangeError('Expected a maximum of 1 through 8192 UTF-16 units');
                request.maxLength = options.maxLength;
              }
              if (options.digitsOnly === true) request.digitsOnly = true;
              const {onFocus,onChange} = options;
              if (onFocus === undefined && onChange === undefined) return host.call('egret.editText',request,signal);
              if ((onFocus !== undefined && typeof onFocus !== 'function') || (onChange !== undefined && typeof onChange !== 'function'))
                throw new TypeError('Expected text editor callbacks');
              // The UI may report its last change after cancel or after a replacement dialog opens.
              // Keep the native session identity until this call settles and ignore aborted events.
              if (nextEditorId > 0x7fffffff) throw new RangeError('Text editor session limit reached');
              const id = nextEditorId++;
              request.editorId = id;
              editorEvents.set(id,{onFocus,onChange,signal});
              try {
                return host.call('egret.editText',request,signal).finally(()=>editorEvents.delete(id));
              } catch(error) { editorEvents.delete(id);throw error; }
            },
            state: value => native.state(JSON.stringify(value)),
            playSound: path => native.playSound(path)
          };
          game = await definition.create(extendServices ? extendServices(services, id => resident.has(id)) : services);
          if (paused && !stopped) game.pause?.();
        } catch (error) {
          stopped = true;
          lifetime.abort();
          try { await disposeOnce(); }
          catch (cleanup) { throw new AggregateError([error, cleanup], 'Project initialization and disposal failed'); }
          throw error;
        }
      })();
      return opening;
    },
    frame(elapsedMs, epoch, previousFrameId) {
      if (stopped || !game) throw new Error('Project unavailable');
      if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new RangeError('Frame clock');
      if (!paused && elapsedMs >= lastTime) {
        // Match the browser frame loop's default single capped step after a stall.
        const gap = anchor === undefined ? 0 : (elapsedMs - anchor) / 1000;
        simulationSeconds += Math.min(gap, 0.1, engine.clock.maxDeltaSeconds);
        anchor = lastTime = elapsedMs;
        engine.advanceTime(simulationSeconds);
        game.update?.(elapsedMs);
      }
      const frame = encoder.encode(engine.captureSharedFrame(frameOptions), frameId, pageIds);
      const output = composeWorld ? composeWorld(game.world3D(), frame, pageIds, epoch, previousFrameId) : frame;
      frameId = (frameId + 1) >>> 0;
      return output;
    },
    input(event) {
      if (paused || stopped) return;
      if (event.type === 'editorFocus' || event.type === 'editorChange') {
        const session = editorEvents.get(event.id);
        if (!session || session.signal?.aborted) return;
        if (event.type === 'editorFocus') session.onFocus?.();
        else if (typeof event.text === 'string') session.onChange?.(event.text);
        return;
      }
      game?.input?.(event);
    },
    pause() {
      if (!paused && !stopped) { paused = true; game?.pause?.(); }
    },
    resume() {
      if (paused && !stopped) { paused = false; anchor = undefined; game?.resume?.(); }
    },
    close() {
      if (closing) return closing;
      stopped = true;
      closing = Promise.resolve().then(async () => {
        try { await opening; } catch { /* Startup has initiated disposal. */ }
        return disposeOnce();
      });
      lifetime.abort();
      // A pending scope-owned acquisition may be what the factory is awaiting.
      if (!game) scope?.dispose();
      return closing;
    }
  });
}

export function installPlayerProject(definition) {
  const project = createPlayerProject(definition, globalThis.EgretNativePlayer);
  globalThis.EgretPlayerProject = project;
  return project;
}
