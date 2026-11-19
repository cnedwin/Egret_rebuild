// SPDX-License-Identifier: Apache-2.0
// One engine and root scope belong to one project view. Only captured Egret commands cross the bridge.
import { createEngine, copyImageData2DPixels } from '@egret/engine';
import { createCapturedProjectEncoder } from '../scene/project-frame.mjs';
import { base64 } from '../scene/commands.mjs';
import { createPlayerRaster } from './player-raster.mjs';
import { createPlayerAssets } from './player-text-assets.mjs';

export function createPlayerProject(definition, native) {
  const encoder = createCapturedProjectEncoder();
  const pageIds = new Map();
  const resident = new Map();
  const lifetime = new AbortController();
  const { assets, textResult } = createPlayerAssets(native, lifetime.signal);
  const frameOptions = Object.freeze({
    width: definition.width, height: definition.height, clearColor: definition.clearColor ?? 0,
    clearAlpha: 1, outputAlpha: 'opaque'
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
        engine = scope = game = undefined;
      }
      if (failures.length) throw new AggregateError(failures, 'Project disposal failed');
      return snapshot;
    });
    return retirement;
  }

  return Object.freeze({
    textResult,
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
          game = await definition.create({
            engine, scope, assets, publishPage, signal: lifetime.signal, raster: createPlayerRaster(native, lifetime.signal),
            edit: text => native.edit(text),
            state: value => native.state(JSON.stringify(value)),
            playSound: path => native.playSound(path)
          });
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
    frame(elapsedMs) {
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
      frameId = (frameId + 1) >>> 0;
      return frame;
    },
    input(event) {
      if (!paused && !stopped) game?.input?.(event);
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
