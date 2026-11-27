// SPDX-License-Identifier: Apache-2.0
// Classic tweens advance together on the owning Egret 7 game clock. A single
// tick may cross several actions, including the boundary between two steps.
const unchanged = value => value;
const power = exponent => value => value ** exponent;
const reverse = curve => value => 1 - curve(1 - value);
const symmetric = curve => value => (value < 0.5 ? curve(value * 2) / 2 : 1 - curve(2 - value * 2) / 2);

const curves = {
  quad: power(2),
  cubic: power(3),
  quart: power(4),
  quint: power(5),
  sine: value => 1 - Math.cos((value * Math.PI) / 2),
  circ: value => 1 - Math.sqrt(1 - value * value)
};
const ease = { linear: unchanged };
for (const [name, curve] of Object.entries(curves)) {
  ease[name + 'In'] = curve;
  ease[name + 'Out'] = reverse(curve);
  ease[name + 'InOut'] = symmetric(curve);
}
const Ease = Object.freeze(ease);

function unsupported(message) {
  throw Object.assign(new Error(message), { code: 'LEGACY_TWEEN_UNSUPPORTED' });
}

function properties(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) unsupported('Expected a tween property object.');
  const entries = Object.entries(input);
  if (entries.some(([name]) => ['__proto__', 'prototype', 'constructor'].includes(name)))
    unsupported('Unsupported tween property name.');
  return entries;
}

function timeline(target, options, activate, deactivate, closed) {
  const entries = [],
    initial = new Map(),
    queued = new Map();
  let length = 0,
    elapsed = 0,
    before = -1,
    paused = true;
  function append(fields) {
    for (const [name, value] of fields) {
      if (!initial.has(name)) initial.set(name, target[name] ?? null);
      queued.set(name, value);
    }
  }
  function write(fields, receiver) {
    for (const [name, value] of fields) {
      if (closed()) return;
      receiver[name] = value;
    }
  }
  function action(callback) {
    entries.push({ at: length, callback });
  }

  const handle = {
    get duration() {
      return length;
    },
    get position() {
      return Math.max(0, before);
    },
    get paused() {
      return paused;
    },
    setPaused(value) {
      if (paused === Boolean(value)) return this;
      paused = Boolean(value);
      if (paused) deactivate(record);
      else activate(record);
      return this;
    },
    to(values, duration = 0, curve) {
      if (curve !== undefined && curve !== null && typeof curve !== 'function')
        unsupported('Expected an easing function.');
      const fields = properties(values),
        from = new Map(queued);
      append(fields);
      const ms = Number(duration) || 0;
      if (!Number.isFinite(ms)) unsupported('Expected a finite tween duration.');
      if (ms > 0) {
        entries.push({ at: length, until: length + ms, from, to: new Map(queued), curve: curve || unchanged });
        length += ms;
      }
      action(() => write(fields, target));
      return this;
    },
    wait(duration, passive = false) {
      if (duration == null) return this;
      if (!Number.isFinite(duration)) unsupported('Expected a finite wait duration.');
      if (duration > 0) {
        entries.push({
          at: length,
          until: length + duration,
          from: new Map(queued),
          to: new Map(queued),
          curve: unchanged,
          passive
        });
        length += duration;
      }
      return this;
    },
    call(callback, receiver, args = []) {
      if (typeof callback !== 'function' || !Array.isArray(args))
        unsupported('Expected a callback and argument array.');
      action(() => callback.apply(receiver || target, args));
      return this;
    },
    set(values, receiver = target) {
      const fields = properties(values);
      append(fields);
      action(() => write(fields, receiver || target));
      return this;
    }
  };
  const record = {
    target,
    handle,
    advance(ms) {
      if (paused || closed()) return;
      elapsed += ms;
      const repeat = options.loop === true && length > 0;
      const position = repeat && elapsed > length ? elapsed % length || length : Math.min(elapsed, length);
      if (position === before) return;
      const previous = before;
      before = position;
      if (!repeat && elapsed >= length) handle.setPaused(true);
      const current = entries.find(
        entry => entry.until !== undefined && entry.at <= position && position <= entry.until
      );
      for (const entry of entries.slice()) {
        if (closed()) return;
        if (entry.callback) {
          const crossed =
            position < previous
              ? entry.at > previous || entry.at <= position
              : entry.at > previous && entry.at <= position;
          if (crossed) entry.callback();
        } else if (entry === current && !entry.passive) {
          const fraction = (position - entry.at) / (entry.until - entry.at);
          const ratio = entry.curve(fraction, 0, 1, 1);
          for (const [key, first] of initial) {
            if (closed()) return;
            const a = entry.from.has(key) ? entry.from.get(key) : first;
            const b = entry.to.has(key) ? entry.to.get(key) : a;
            target[key] = ratio === 1 ? b : typeof a === 'number' && typeof b === 'number' ? a + (b - a) * ratio : a;
          }
        }
      }
    }
  };
  if (!options.paused) handle.setPaused(false);
  return handle;
}

/** Resolve only registered own names; dispose cuts every timeline at its current value. */
export function createLegacyGameServices(game, resolveKnown, now = Date.now) {
  const epoch = now(),
    registered = new Map(),
    active = new Set();
  const scope = game.scope;
  let timer;
  function deactivate(record) {
    active.delete(record);
    if (!active.size) {
      timer?.dispose();
      timer = undefined;
    }
  }
  function activate(record) {
    if (scope.signal.aborted) return;
    active.add(record);
    timer ??= game.engine.clock.onTick(scope, tick => {
      // Egret 5 gives the most recently started tween the first update on this target.
      for (const item of [...active].reverse()) item.advance(tick.deltaSeconds * 1000);
    });
  }
  function removeTweens(target) {
    for (const item of [...active]) if (item.target === target) item.handle.setPaused(true);
  }
  scope.signal.addEventListener(
    'abort',
    () => {
      for (const item of [...active]) item.handle.setPaused(true);
      registered.clear();
    },
    { once: true }
  );
  function safeName(name) {
    return (
      typeof name === 'string' &&
      // Keep reflection names usable on both stock and no-ICU V8, including CJK class names.
      name
        .split('.')
        .every(part => /^[$A-Z_a-z\u3400-\u4dbf\u4e00-\u9fff][$\w\u3400-\u4dbf\u4e00-\u9fff]*$/.test(part)) &&
      !name.split('.').some(part => ['__proto__', 'prototype', 'constructor'].includes(part))
    );
  }
  return {
    getTimer: () => Math.floor(now() - epoch),
    getDefinitionByName(name) {
      if (scope.signal.aborted) return null;
      if (!safeName(name)) return null;
      if (registered.has(name)) return registered.get(name);
      return resolveKnown(name) ?? null;
    },
    registerClass(type, name, interfaces = []) {
      if (scope.signal.aborted)
        throw Object.assign(new Error('Legacy binding is closed.'), { code: 'LEGACY_BINDINGS_CLOSED' });
      if (typeof type !== 'function' || !safeName(name) || !Array.isArray(interfaces) || !interfaces.every(safeName))
        throw new TypeError('Expected a named legacy class and interface names.');
      Object.defineProperties(type.prototype, {
        __class__: { value: name, writable: true },
        __types__: { value: [...new Set([name, ...interfaces, ...(type.prototype.__types__ ?? [])])], writable: true }
      });
      registered.set(name, type);
    },
    Tween: Object.freeze({
      get(target, settings, pluginData, override) {
        if (scope.signal.aborted)
          throw Object.assign(new Error('Legacy binding is closed.'), { code: 'LEGACY_BINDINGS_CLOSED' });
        if (!target || !['object', 'function'].includes(typeof target)) unsupported('Expected a tween target.');
        const options = settings ?? {};
        if (pluginData != null || Object.keys(options).some(key => !['paused', 'override', 'loop'].includes(key)))
          unsupported('Only paused, override and loop options are supported.');
        if (override || options.override) removeTweens(target);
        return timeline(target, options, activate, deactivate, () => scope.signal.aborted);
      },
      removeTweens,
      removeAllTweens() {
        for (const item of [...active]) item.handle.setPaused(true);
      }
    }),
    Ease
  };
}
