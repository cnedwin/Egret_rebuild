// SPDX-License-Identifier: Apache-2.0
/** Classic timers fire at most once per frame. All callbacks belong to this game's clock and lifetime. */
export function classicClock(game, events, now) {
  const { scope } = game;
  const active = new Map();
  let subscription;
  let later = [];
  function assertOpen() {
    if (scope.signal.aborted)
      throw Object.assign(new Error('Legacy binding is closed.'), { code: 'LEGACY_BINDINGS_CLOSED' });
  }
  function releaseIfIdle() {
    if (!active.size && !later.length) {
      subscription?.dispose();
      subscription = undefined;
    }
  }
  function remove(tick) {
    active.delete(tick);
    releaseIfIdle();
  }
  function subscribe() {
    subscription ??= game.engine.clock.onTick(scope, frame => {
      const milliseconds = frame.deltaSeconds * 1000;
      // Snapshot once. A callback registered by another callback starts on a subsequent frame.
      for (const [tick, registration] of [...active]) {
        if (active.get(tick) !== registration) continue;
        // The first tick may cover time before a timer was started by an input event.
        // Clamp against active game time so background time cannot count on resume.
        const elapsed =
          registration.startedAt === undefined
            ? milliseconds
            : Math.min(milliseconds, Math.max(0, now() - registration.startedAt));
        registration.startedAt = undefined;
        tick(elapsed);
      }
      const pending = later;
      later = [];
      try {
        for (const item of pending) {
          if (scope.signal.aborted) break;
          item.fn.apply(item.receiver, item.args);
        }
      } finally {
        releaseIfIdle();
      }
    });
  }
  function add(tick) {
    assertOpen();
    if (!active.has(tick)) active.set(tick, { startedAt: now() });
    subscribe();
  }

  function delayed(repeat) {
    const items = new Map();
    let serial = 0;
    function clear(key) {
      items.delete(key);
      if (!items.size) remove(advance);
    }
    function advance(elapsed) {
      for (const [key, item] of [...items]) {
        if (!items.has(key) || scope.signal.aborted) continue;
        item.remaining -= elapsed;
        if (item.remaining > 0) continue;
        if (repeat) item.remaining = item.delay;
        else clear(key);
        item.fn.apply(item.receiver, item.args);
      }
    }
    function schedule(fn, receiver, delay, ...args) {
      assertOpen();
      if (typeof fn !== 'function' || !Number.isFinite(delay))
        throw new TypeError('Expected a callback and a finite delay in milliseconds.');
      const key = ++serial;
      items.set(key, { fn, receiver, delay, remaining: delay, args });
      add(advance);
      return key;
    }
    return { schedule, clear, release: () => items.clear() };
  }

  const once = delayed(false),
    intervals = delayed(true);
  const services = {
    setTimeout: once.schedule,
    clearTimeout: once.clear,
    setInterval: intervals.schedule,
    clearInterval: intervals.clear,
    callLater(fn, receiver, ...args) {
      assertOpen();
      if (typeof fn !== 'function') throw new TypeError('Expected a deferred callback.');
      later.push({ fn, receiver, args });
      subscribe();
    }
  };
  const liveTimers = new Set();
  if (events) {
    const { Event, EventDispatcher } = events;
    class TimerEvent extends Event {
      static TIMER = 'timer';
      static TIMER_COMPLETE = 'timerComplete';
      static dispatchTimerEvent(target, type, bubbles = false, cancelable = false) {
        return target.dispatchEvent(new TimerEvent(type, bubbles, cancelable));
      }
      updateAfterEvent() {
        // Continuous hosts already draw the next frame. On-demand hosts explicitly invalidate it.
        if (!scope.signal.aborted) game.invalidate?.();
      }
    }
    class Timer extends EventDispatcher {
      #delay = 0;
      #count = 0;
      #running = false;
      #since = 0;
      #interval = 0;
      #frames = 0;
      constructor(delay, repeatCount = 0) {
        super();
        this.delay = delay;
        this.repeatCount = repeatCount | 0;
      }
      get delay() {
        return this.#delay;
      }
      set delay(value) {
        if (!Number.isFinite(value)) throw new RangeError('Expected a finite timer delay.');
        const milliseconds = Math.max(1, value);
        if (this.#delay === milliseconds) return;
        this.#delay = milliseconds;
        this.#interval = Math.round(milliseconds * 60);
        this.#frames = this.#interval;
      }
      get currentCount() {
        return this.#count;
      }
      get running() {
        return this.#running;
      }
      start() {
        assertOpen();
        if (this.#running) return;
        this.#since = 0;
        this.#frames = this.#interval;
        this.#running = true;
        liveTimers.add(this);
        add(this.#advance);
      }
      stop() {
        if (!this.#running) return;
        this.#running = false;
        liveTimers.delete(this);
        remove(this.#advance);
      }
      reset() {
        this.stop();
        this.#count = 0;
      }
      #advance = elapsed => {
        this.#since += elapsed;
        // Egret 5 checks the real interval and also carries a nominal 60 Hz frame budget.
        if (this.#since >= this.#delay) this.#frames = this.#interval;
        else {
          this.#frames -= 1000;
          if (this.#frames > 0) return;
          this.#frames += this.#interval;
        }
        this.#since = 0;
        const count = ++this.#count;
        const complete = this.repeatCount > 0 && count >= this.repeatCount;
        if (this.repeatCount === 0 || count <= this.repeatCount) TimerEvent.dispatchTimerEvent(this, TimerEvent.TIMER);
        if (complete && !scope.signal.aborted) {
          this.stop();
          TimerEvent.dispatchTimerEvent(this, TimerEvent.TIMER_COMPLETE);
        }
      };
    }
    for (const [type, name, baseName] of [
      [Timer, 'egret.Timer', 'egret.EventDispatcher'],
      [TimerEvent, 'egret.TimerEvent', 'egret.Event']
    ]) {
      Object.defineProperties(type.prototype, {
        __class__: { value: name, writable: true, configurable: true },
        __types__: { value: [name, baseName], writable: true, configurable: true }
      });
    }
    Object.assign(services, { TimerEvent, Timer });
  }
  scope.signal.addEventListener(
    'abort',
    () => {
      for (const item of liveTimers) item.stop();
      once.release();
      intervals.release();
      later = [];
      active.clear();
      subscription?.dispose();
      subscription = undefined;
    },
    { once: true }
  );
  return services;
}
