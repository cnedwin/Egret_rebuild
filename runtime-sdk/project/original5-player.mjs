// SPDX-License-Identifier: Apache-2.0
import { installPlayerProject } from './player-project.mjs';
import { createOriginal5Display } from './original5-display.mjs';
import { installOriginal5Editor } from './original5-editor.mjs';
import { installOriginal5Text } from './original5-text.mjs';
import { installOriginal5Platform } from './original5-platform.mjs';

const opened = new WeakSet();
const identifier = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;

function checkOptions({width, height, entryClass, frameRate = 30, coreGroup = 'originalCore',
  moduleGroup = 'originalModules', gameGroup = 'originalGame', nativeAbi = 5}) {
  if (nativeAbi !== 4 && nativeAbi !== 5) throw new TypeError('Original native display ABI must be 4 or 5');
  if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 4096) ||
      !Number.isFinite(frameRate) || frameRate <= 0 || frameRate > 120 ||
      typeof entryClass !== 'string' || !identifier.test(entryClass) ||
      entryClass.split('.').some(key => ['constructor', 'prototype', '__proto__'].includes(key))) {
    throw new TypeError('An original 5.x game needs its stage size, frame rate and entry class');
  }
  const groups = [coreGroup, ...(moduleGroup === null ? [] : [moduleGroup]), gameGroup];
  if (new Set(groups).size !== groups.length ||
      groups.some(name => typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name))) {
    throw new TypeError('Expected distinct original 5.x script groups');
  }
  return {coreGroup, moduleGroup, gameGroup, frameRate, nativeAbi};
}

// The package runs in a fresh script isolate. Dispose only globals that we installed.
function expose(installed, name, value) {
  if (name in globalThis) {
    if (globalThis[name] === value) return;
    throw new Error('Original 5.x host already owns ' + name);
  }
  Object.defineProperty(globalThis, name, {value, configurable: true, writable: true});
  installed.set(name, value);
}

function touchInput(egret, stage, nativeAbi) {
  const handler = new egret.sys.TouchHandler(stage);
  if (nativeAbi === 4) stage.$touch = handler;
  const refresh = nativeAbi === 4 ? () => handler.$updateMaxTouches() : () => handler.$initMaxTouches();
  refresh();
  const positions = new Map();
  // The original handler emits TAP on an ordinary up. Cancel an interrupted contact
  // on its captured target without converting an OS cancellation into a purchase or click.
  function cancel(id) {
    const point = positions.get(id);
    positions.delete(id);
    const target = handler.touchDownTarget[id];
    if (!target) return;
    delete handler.touchDownTarget[id];
    handler.useTouchesCount--;
    egret.TouchEvent.dispatchTouchEvent(target, egret.TouchEvent.TOUCH_CANCEL, true, false,
      point.x, point.y, id, false);
  }
  return {
    refresh,
    cancelAll() { for (const id of [...positions.keys()]) cancel(id); },
    send({type, id, x, y}) {
      if (!Number.isInteger(id) || !Number.isFinite(x) || !Number.isFinite(y)) return;
      if (type === 'down' && !positions.has(id)) {
        handler.onTouchBegin(x, y, id);
        if (handler.touchDownTarget[id]) positions.set(id, {x, y});
      } else if (positions.has(id)) {
        if (type === 'move') { positions.set(id, {x, y}); handler.onTouchMove(x, y, id); }
        if (type === 'up') { positions.delete(id); handler.onTouchEnd(x, y, id); }
        if (type === 'cancel') cancel(id);
      }
    }
  };
}

export async function openOriginal5Project(services, options) {
  const {coreGroup, moduleGroup, gameGroup, frameRate, nativeAbi} = checkOptions(options);
  const scripts = globalThis.EgretRuntimeScripts;
  if (typeof scripts?.loadGroup !== 'function' || opened.has(scripts) || 'egret' in globalThis) {
    throw new Error('Original 5.x requires a fresh player script isolate');
  }
  services.signal.throwIfAborted();
  opened.add(scripts);
  const display = createOriginal5Display(services, nativeAbi);
  const installed = new Map();
  let closed = false, player, touch, lifecycle, text, editor;
  function close() {
    if (closed) return;
    closed = true;
    services.signal.removeEventListener('abort', close);
    try {
      try { touch?.cancelAll(); } finally { player?.stop(); }
    } finally {
      try { try { editor?.close(); } finally { try { text?.close(); } finally { display.close(); } } } finally {
        for (const [name, value] of installed) {
          if (Object.getOwnPropertyDescriptor(globalThis, name)?.value === value) delete globalThis[name];
        }
      }
    }
  }
  services.signal.addEventListener('abort', close, {once: true});
  async function load(name) {
    await scripts.loadGroup(name);
    services.signal.throwIfAborted();
  }
  try {
    expose(installed, 'global', globalThis);
    expose(installed, 'window', globalThis);
    expose(installed, '__global', globalThis);
    expose(installed, 'egret_native', display.api);
    expose(installed, 'nativeRender', true);
    await load(coreGroup);
    const egret = globalThis.egret;
    if (!egret?.nativeRender || !/^5\.3\.\d+$/.test(egret.Capabilities?.engineVersion ?? '')) {
      throw new Error('The original Egret 5.3.x core must accept the packaged native display ABI');
    }
    display.installGraphics(egret);
    installOriginal5Platform(egret, services, display, options.images, options.remoteRequest);
    text = installOriginal5Text(egret, services, display);
    editor = installOriginal5Editor(egret, services);
    // Browser plugins and channel SDKs can bind their native counterparts before
    // the original classic scripts inspect globals. Only names owned by this session are released.
    await options.installHost?.({egret, services, defineGlobal(name, value) {
      services.signal.throwIfAborted();
      if (typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name) ||
          ['__proto__', 'constructor', 'prototype'].includes(name)) throw new TypeError('Invalid host global');
      expose(installed, name, value);
    }});
    services.signal.throwIfAborted();
    if (moduleGroup) await load(moduleGroup);
    await load(gameGroup);
    if (typeof egret.getDefinitionByName(options.entryClass) !== 'function') {
      throw new Error('Missing original game entry class: ' + options.entryClass);
    }
    const stage = new egret.Stage();
    touch = touchInput(egret, stage, nativeAbi);
    stage.$screen = {
      updateMaxTouches: () => touch.refresh(),
      updateScreenSize: () => player.updateStageSize(options.width, options.height),
      setContentSize(width, height) {
        if (width !== options.width || height !== options.height) {
          throw new Error('Original game stage size must agree with the packaged stage');
        }
        player.updateStageSize(width, height);
      }
    };
    stage.frameRate = frameRate;
    // Native draws bypass the browser RenderBuffer. The real Player still owns
    // startup order, invalidation, the ticker and the entire original display list.
    player = new egret.sys.Player({width: options.width, height: options.height}, stage, options.entryClass);
    egret.lifecycle.stage = stage;
    egret.lifecycle.addLifecycleListener(context => { lifecycle = context; });
    player.updateStageSize(options.width, options.height);
    player.start();
    await options.onReady?.({egret, stage, root: player.root, services});
    services.signal.throwIfAborted();
    return {
      update() { editor.flush(); egret.ticker.update(); text.flush(); },
      input(event) { touch.send(event); },
      pause() { touch.cancelAll(); editor.pause(); lifecycle.pause(); },
      resume() { lifecycle.resume(); },
      close
    };
  } catch (error) {
    close();
    throw error;
  }
}

export function installOriginal5Project(options) {
  checkOptions(options);
  return installPlayerProject({
    width: options.width, height: options.height, clearColor: options.clearColor,
    create: services => openOriginal5Project(services, options)
  });
}
