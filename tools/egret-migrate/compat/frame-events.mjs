// SPDX-License-Identifier: Apache-2.0
/** Each game owns its frame listeners, including those on displays temporarily off stage. */
export function createFrameEvents(game, stageOfGame, report) {
  const displays = new Set();
  const updates = new Map();
  let clock;
  let active = true;
  const signal = game.scope.signal;
  function syncClock() {
    if (!displays.size && !updates.size) {
      clock?.dispose();
      clock = undefined;
    } else if (!clock && !signal.aborted) {
      clock = game.engine.clock.onTick(game.scope, () => {
        for (const [context, callback] of [...updates]) {
          if (signal.aborted) return;
          if (updates.get(context) === callback) {
            try {
              callback.call(context);
            } catch (error) {
              report(error);
            }
          }
        }
        // Adding a new display during dispatch takes effect on the next broadcast.
        for (const display of [...displays]) {
          if (signal.aborted) return;
          if (display.isDisposed) {
            displays.delete(display);
            continue;
          }
          display.dispatchEventWith('enterFrame');
        }
        syncClock();
      });
    }
  }
  function setActive(value) {
    if (active === value || signal.aborted) return;
    active = value;
    stageOfGame().dispatchEventWith(value ? 'activate' : 'deactivate');
    // A stage listener can close the game or reverse the transition synchronously.
    if (signal.aborted || active !== value) return;
    if (value) lifecycle.onResume?.();
    else lifecycle.onPause?.();
  }
  const lifecycle = {
    onPause: undefined,
    onResume: undefined,
    addLifecycleListener(plugin) {
      if (signal.aborted) throw new Error('Game scope has closed.');
      if (typeof plugin !== 'function') throw new TypeError('Expected a lifecycle listener.');
      const context = {
        pause() {
          setActive(false);
        },
        resume() {
          setActive(true);
        },
        get onUpdate() {
          return updates.get(context);
        },
        set onUpdate(callback) {
          if (signal.aborted) return;
          if (callback == null) updates.delete(context);
          else if (typeof callback === 'function') updates.set(context, callback);
          else throw new TypeError('Expected an update callback.');
          syncClock();
        }
      };
      plugin(context);
    }
  };
  signal.addEventListener(
    'abort',
    () => {
      displays.clear();
      updates.clear();
      syncClock();
    },
    { once: true }
  );
  return {
    lifecycle,
    setActive,
    track(display) {
      if (!signal.aborted) {
        displays.add(display);
        syncClock();
      }
    },
    untrack(display) {
      displays.delete(display);
      syncClock();
    }
  };
}
