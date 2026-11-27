// SPDX-License-Identifier: Apache-2.0
const StageScaleMode = Object.freeze({
  NO_SCALE: 'noScale',
  SHOW_ALL: 'showAll',
  NO_BORDER: 'noBorder',
  EXACT_FIT: 'exactFit',
  FIXED_WIDTH: 'fixedWidth',
  FIXED_HEIGHT: 'fixedHeight',
  FIXED_NARROW: 'fixedNarrow',
  FIXED_WIDE: 'fixedWide'
});
const OrientationMode = Object.freeze({
  AUTO: 'auto',
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape',
  LANDSCAPE_FLIPPED: 'landscapeFlipped'
});
const RuntimeType = Object.freeze({ WEB: 'web', NATIVE: 'native', RUNTIME2: 'runtime2', WXGAME: 'wxgame' });
const classicFit = {
  contain: 'showAll',
  none: 'noScale',
  cover: 'noBorder',
  stretch: 'exactFit',
  fixedWidth: 'fixedWidth',
  fixedHeight: 'fixedHeight',
  fixedNarrow: 'fixedNarrow',
  fixedWide: 'fixedWide'
};

export function browserEnvironment(view, backend, fit) {
  const nav = view?.navigator,
    ua = nav?.userAgent ?? '',
    platform = nav?.userAgentData?.platform ?? nav?.platform ?? '';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && nav?.maxTouchPoints > 1);
  const android = /Android/i.test(ua) || platform === 'Android';
  const windowsPhone = /Windows Phone/i.test(ua);
  const os = windowsPhone
    ? 'Windows Phone'
    : ios
      ? 'iOS'
      : android
        ? 'Android'
        : /Windows NT/i.test(ua) || /^Win/i.test(platform)
          ? 'Windows PC'
          : /Mac OS/i.test(ua) || /^Mac/i.test(platform)
            ? 'Mac OS'
            : 'Unknown';
  const isMobile = ios || android || windowsPhone || (nav?.userAgentData?.mobile ?? /mobile/i.test(ua));
  const renderMode = backend === 'webgl2' ? 'webgl' : backend === 'webgpu' ? 'webgpu' : 'Unknown';
  return {
    runtimeType: 'web',
    renderMode,
    isMobile,
    os,
    scaleMode: classicFit[fit],
    logger: view?.console ?? globalThis.console
  };
}

export function androidEnvironment(logger) {
  // EgretPlayerView measures the surface with the smaller axis scale. Its GLES3 player draws a fixed design.
  return { runtimeType: 'native', renderMode: 'gles3', isMobile: true, os: 'Android', scaleMode: 'showAll', logger };
}

export function stagePolicy(scope, environment, property, value) {
  if (scope.signal.aborted)
    throw Object.assign(new Error('Legacy binding is closed.'), { code: 'LEGACY_BINDINGS_CLOSED' });
  const current = property === 'orientation' ? 'auto' : environment?.scaleMode;
  if (arguments.length === 4 && current !== value)
    throw Object.assign(
      new Error(
        'The mounted game owns its screen policy. Recreate the view with the new fit or use the native Activity.'
      ),
      { code: 'LEGACY_SCREEN_POLICY_FIXED' }
    );
  return current;
}

export function createHashDomain() {
  const branded = new WeakSet();
  let sequence = 0;
  function stamp(instance) {
    if (!branded.has(instance)) {
      instance.$hashCode = ++sequence;
      branded.add(instance);
    }
  }
  class HashObject {
    constructor() {
      stamp(this);
    }
    get hashCode() {
      return this.$hashCode;
    }
    static [Symbol.hasInstance](instance) {
      return this === HashObject ? branded.has(instance) : Function.prototype[Symbol.hasInstance].call(this, instance);
    }
  }
  Object.defineProperties(HashObject.prototype, {
    __class__: { value: 'egret.HashObject', configurable: true },
    __types__: { value: ['egret.HashObject', 'egret.IHashObject'], configurable: true }
  });
  return { HashObject, stamp };
}

export function legacyHost(scope, stage, environment = {}, identity = createHashDomain()) {
  const Capabilities = {};
  for (const key of ['runtimeType', 'renderMode', 'os', 'isMobile'])
    Object.defineProperty(Capabilities, key, {
      enumerable: true,
      get() {
        return scope.signal.aborted ? undefined : environment[key];
      }
    });
  const instance = Object.freeze({
    get stage() {
      return scope.signal.aborted ? null : stage;
    }
  });

  const log =
    level =>
    (...args) => {
      if (!scope.signal.aborted) environment.logger?.[level]?.(...args);
    };
  return {
    StageScaleMode,
    OrientationMode,
    RuntimeType,
    Capabilities: Object.freeze(Capabilities),
    MainContext: Object.freeze({ instance }),
    HashObject: identity.HashObject,
    createMap: () => Object.create(null),
    log: log('log'),
    warn: log('warn'),
    error: log('error')
  };
}

/** Native V8 may have no console sink. Retain bounded plain-text diagnostics for the player close receipt. */
export function androidLog(sink, capture = false) {
  const messages = [];
  let dropped = 0;
  const counts = { log: 0, warn: 0, error: 0 };
  const logger = {};
  for (const level of ['log', 'warn', 'error'])
    logger[level] = (...args) => {
      counts[level]++;
      sink?.[level]?.(...args);
      if (!capture) return;
      const brief = value => {
        if (value === null || !['object', 'function'].includes(typeof value)) return String(value).slice(0, 256);
        // Formatting is diagnostic only; avoid invoking object conversion hooks and message getters.
        try {
          const message = value instanceof Error && Object.getOwnPropertyDescriptor(value, 'message')?.value;
          if (typeof message === 'string') return message.slice(0, 256);
        } catch {}
        return '[' + typeof value + ']';
      };
      if (messages.length === 32) {
        messages.shift();
        dropped++;
      }
      messages.push({ level, text: args.slice(0, 8).map(brief).join(' ').slice(0, 256) });
    };
  return {
    logger,
    snapshot() {
      return capture
        ? { legacyLog: messages.slice(), legacyLogDropped: dropped, legacyLogCounts: { ...counts } }
        : { legacyLogCounts: { ...counts } };
    }
  };
}
