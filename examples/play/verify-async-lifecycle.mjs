// SPDX-License-Identifier: Apache-2.0
// Run against the built public entries on a browser GPU. Gates control setup ordering independently of network speed.
import { play } from '@egret/engine/play';
import { play3d } from '@egret/engine/webgl2/world3d';

// Fix the rendering workload to the same preset as the earlier Play lifecycle qualification.
function createLifecycleWorld(options) {
  return play3d({
    ...options,
    setup(game) {
      game.app.setQuality('low');
      return options.setup?.(game);
    }
  });
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function gate() {
  let open;
  const promise = new Promise(resolve => {
    open = resolve;
  });
  return { promise, open };
}

// Observe deliberate rejections immediately, including nested calls from setup.
function outcome(promise) {
  return promise.then(
    () => ({ ok: true }),
    error => ({ ok: false, error })
  );
}

async function bounded(promise, operation) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(operation + ' did not settle')), 8000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function frames(count = 3) {
  for (let index = 0; index < count; index++) await new Promise(resolve => requestAnimationFrame(resolve));
}

function mark(game) {
  return {
    flat: game.rect(20, 20, 8, 8, 0xff8020),
    solid: game.scene ? game.box(1, 1, 1, 0x80ff20) : undefined
  };
}

function retired(marker) {
  return (
    marker.flat.isDisposed &&
    (!marker.solid ||
      (marker.solid.removed && marker.solid.node.geometry.isDisposed && marker.solid.node.material.isDisposed))
  );
}

function active(marker, game) {
  return (
    marker.flat.parent === game.world &&
    !marker.flat.isDisposed &&
    (!marker.solid || (marker.solid.node.parent === game.scene && !marker.solid.removed))
  );
}

function backendMatches(game, backend) {
  check(game.browser.backend === backend, 'Play did not use the requested backend');
  if (game.app) check(game.app.backend === backend && !game.app.fellBack, 'World3D did not use the requested backend');
}

async function restartCases(create, options) {
  const entered = gate(),
    release = gate(),
    setupFailure = new Error('fixture asset rejected');
  const markers = [];
  let phase = 'initial',
    starts = 0,
    updates = 0,
    reenter = true,
    nested;
  let game;
  try {
    game = await create({
      ...options,
      async setup(current) {
        starts++;
        markers.push(mark(current));
        if (phase === 'held') {
          if (reenter) {
            reenter = false;
            nested = current.restart();
            outcome(nested);
          }
          entered.open();
          await release.promise;
        }
        if (phase === 'failure') throw setupFailure;
      },
      update() {
        updates++;
      }
    });
    backendMatches(game, options.backend);
    await frames();
    check(updates > 0, 'The initial game did not update');
    phase = 'held';
    const before = updates,
      first = game.restart(),
      second = game.restart();
    const firstResult = outcome(first);
    outcome(second);
    await bounded(entered.promise, 'held setup');
    await frames();
    check(first === second && first === nested, 'An overlapping or reentrant restart got another promise');
    check(starts === 2 && updates === before, 'An overlapping request duplicated setup or ran a partial frame');
    release.open();
    check((await bounded(firstResult, 'shared restart')).ok, 'Shared restart rejected');
    await frames();
    check(updates > before && active(markers[1], game) && retired(markers[0]), 'The replacement did not take over');

    phase = 'failure';
    const beforeFailure = updates;
    const failure = await outcome(game.restart());
    check(!failure.ok && failure.error === setupFailure, 'Restart did not report the setup failure');
    await frames();
    check(updates === beforeFailure && retired(markers[2]), 'Failed setup left updates or partial objects alive');
    phase = 'retry';
    await game.restart();
    await frames();
    check(
      starts === 4 && updates > beforeFailure && markers.slice(0, 3).every(retired) && active(markers[3], game),
      'Retry did not leave exactly its new generation active'
    );
    return { setups: starts, updatesHeld: true, samePromise: true, priorObjectsRetired: 3, retryActive: true };
  } finally {
    release.open();
    await game?.dispose();
  }
}

async function closeWhileLoading(create, options, initial) {
  const entered = gate(),
    release = gate(),
    continued = gate();
  let game,
    starts = 0,
    updates = 0,
    attempts = 0,
    attached = 0;
  let pending;
  try {
    const started = create({
      ...options,
      async setup(current) {
        starts++;
        game = current;
        if (starts === 1 && !initial) return;
        entered.open();
        await release.promise;
        try {
          // The old loader uses the public handle it received before the game closed.
          for (const add of [
            () => current.rect(3, 3, 2, 2, 0xff8020),
            ...(current.scene ? [() => current.box(1, 1, 1, 0xff8020)] : [])
          ]) {
            attempts++;
            try {
              const item = add();
              if (item.parent === current.world || (item.node && item.node.parent === current.scene)) attached++;
            } catch {
              /* Admission after close may explicitly refuse. */
            }
          }
        } finally {
          continued.open();
        }
      },
      update() {
        updates++;
      }
    });
    if (initial) pending = outcome(started);
    else {
      game = await started;
      pending = outcome(game.restart());
    }
    await bounded(entered.promise, 'loading setup');
    backendMatches(game, options.backend);
    const atClose = updates,
      close = game.dispose();
    check(close === game.dispose(), 'Concurrent disposal did not share the close promise');
    await bounded(close, 'close with setup still held');
    const canceled = await bounded(pending, 'canceling pending setup before the loader resolved');
    check(!canceled.ok && canceled.error?.code === 'SCOPE_CLOSED', 'Closing did not cancel the pending setup');
    release.open();
    await bounded(continued.promise, 'late setup completion');
    await frames();
    const canvases = options.parent.querySelectorAll('canvas').length;
    check(
      attempts === (game.scene ? 2 : 1) &&
        attached === 0 &&
        canvases === 0 &&
        updates === atClose &&
        game.scope.state === 'closed' &&
        (!game.app || game.app.scope.state === 'closed'),
      'A late completion updated, attached objects or kept an owned surface after close'
    );
    return { setups: starts, lateAttempts: attempts, attached, canvases, canceled: canceled.error.code };
  } finally {
    release.open();
    await game?.dispose();
  }
}

function containsFailure(error, marker) {
  if (error === marker) return true;
  if (!error || typeof error !== 'object') return false;
  return [error.cause, ...(error.errors ?? []), ...(error.cleanupErrors ?? [])].some(cause =>
    containsFailure(cause, marker)
  );
}

async function worldCloseFailure(options) {
  const game = await createLifecycleWorld(options);
  const failure = new Error('fixture World3D cleanup failed');
  const scope = game.app.engine.createScope();
  let retired = 0;
  try {
    scope.use({
      dispose() {
        retired++;
      }
    });
    scope.use({
      dispose() {
        throw failure;
      }
    });
    const closing = game.dispose();
    const observed = outcome(closing);
    check(game.dispose() === closing, 'Close failure was not shared');
    const result = await bounded(observed, 'World3D cleanup error');
    check(
      !result.ok && containsFailure(result.error, failure),
      'The game close promise lost its World3D cleanup error'
    );
    check(
      retired === 1 &&
        game.app.scope.state === 'closed' &&
        game.scope.state === 'closed' &&
        options.parent.querySelectorAll('canvas').length === 0,
      'A failed close skipped remaining owners'
    );
    return { errorReachedCaller: true, independentResourcesRetired: retired, bothScopesClosed: true };
  } finally {
    await outcome(game.dispose());
  }
}

// Force a synchronous mount failure after the real DOM canvas, observer and
// resize listener have been acquired. Hold their identities even if Play removes
// the outer holder; a detached holder can otherwise hide a leaked canvas.
async function mountFailure(options) {
  const sentinel = new Error('resize listener failed during Play3D mount');
  const OriginalObserver = window.ResizeObserver;
  const add = window.addEventListener;
  let under,
    observer,
    disconnected = false,
    listener,
    resizeCalls = 0;
  const nativeBounds = HTMLCanvasElement.prototype.getBoundingClientRect;
  window.ResizeObserver = class extends OriginalObserver {
    observe(target, ...args) {
      super.observe(target, ...args);
      const previous = target.previousElementSibling;
      if (previous instanceof HTMLCanvasElement && previous.style.position === 'absolute') {
        under = previous;
        observer = this;
      }
    }
    disconnect() {
      if (this === observer) disconnected = true;
      return super.disconnect();
    }
  };
  window.addEventListener = function (type, callback, ...rest) {
    add.call(this, type, callback, ...rest);
    if (type === 'resize' && under && !listener) {
      listener = callback;
      throw sentinel;
    }
  };
  try {
    const receipt = await outcome(play3d(options));
    check(!receipt.ok && receipt.error === sentinel, 'The original synchronous mount error did not reach the caller');
    HTMLCanvasElement.prototype.getBoundingClientRect = function () {
      resizeCalls++;
      return nativeBounds.call(this);
    };
    window.dispatchEvent(new Event('resize'));
    check(
      under && listener && disconnected && !under.parentNode && resizeCalls === 0,
      'Partial Play3D mount was retained'
    );
    return {
      originalError: true,
      underCanvasDetached: true,
      observerDisconnected: true,
      staleResizeCalls: resizeCalls
    };
  } finally {
    window.addEventListener = add;
    window.ResizeObserver = OriginalObserver;
    HTMLCanvasElement.prototype.getBoundingClientRect = nativeBounds;
    if (listener) window.removeEventListener('resize', listener);
  }
}

export async function runPlayLifecycle(backend) {
  const parent = document.createElement('div');
  parent.style.cssText = 'position:relative;width:128px;height:96px';
  document.body.appendChild(parent);
  const options = { parent, width: 128, height: 96, backend };
  const unhandled = [];
  const observe = event => {
    unhandled.push(String(event.reason));
  };
  window.addEventListener('unhandledrejection', observe);
  try {
    const result = { backend, mountFailure: await mountFailure(options) };
    for (const [name, create] of [
      ['play', play],
      ['play3d', createLifecycleWorld]
    ]) {
      result[name] = {
        restart: await restartCases(create, options),
        closeDuringRestart: await closeWhileLoading(create, options, false),
        closeDuringStartup: await closeWhileLoading(create, options, true)
      };
    }
    result.play3d.cleanupFailure = await worldCloseFailure(options);
    await frames();
    check(unhandled.length === 0, 'Unhandled browser rejections: ' + unhandled.join(', '));
    return { ...result, ok: true, unhandledRejections: unhandled.length };
  } finally {
    window.removeEventListener('unhandledrejection', observe);
    parent.remove();
  }
}

// The driver clicks the returned CSS coordinates with real browser input. DOM dispatch would skip native pointer capture.
let tapSession;
async function tapControl(create, options, mode) {
  const entered = gate(),
    sentinel = new Error(mode + ' asset failed to load'),
    errors = [];
  const pointers = [];
  let setups = 0,
    updates = 0,
    taps = 0,
    observed,
    stage = 'initial';
  const game = await create({
    ...options,
    setup(current) {
      setups++;
      if (stage === 'fail') throw sentinel;
      const target =
        mode === 'mesh'
          ? current.box(2, 2, 2, 0xff6020)
          : current.rect(options.width / 2, options.height / 2, 80, 60, 0xff6020, current.ui);
      current.onTap(target, () => {
        taps++;
        stage = 'fail';
        const failedRestart = current.restart();
        observed = outcome(failedRestart);
        entered.open();
        return failedRestart;
      });
    },
    update() {
      updates++;
    },
    onError(error) {
      errors.push(error);
    }
  });
  backendMatches(game, options.backend);
  const capture = event => pointers.push({ type: event.pointerType, trusted: event.isTrusted });
  game.canvas.addEventListener('pointerdown', capture);
  return {
    center() {
      const rect = game.canvas.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
    async retry() {
      await bounded(entered.promise, mode + ' tap callback');
      const result = await bounded(observed, mode + ' tap restart');
      check(!result.ok && result.error === sentinel, mode + ' tap lost its restart error');
      await frames();
      const before = updates,
        priorErrors = errors.length;
      check(
        errors.every(error => error === sentinel),
        mode + ' received an unexpected callback error'
      );
      stage = 'retry';
      await game.restart();
      await frames(5);
      check(
        taps === 1 &&
          setups === 3 &&
          updates > before &&
          game.browser.loop.state === 'running' &&
          errors.length === priorErrors,
        mode + ' retry stopped on an earlier tap error'
      );
      check(pointers.length === 1 && pointers[0].trusted, mode + ' did not receive exactly one driver pointerdown');
      return {
        taps,
        setups,
        pointer: pointers[0],
        reportedBeforeRetry: priorErrors,
        updatesAfterRetry: updates - before,
        state: game.browser.loop.state
      };
    },
    async close() {
      game.canvas.removeEventListener('pointerdown', capture);
      await game.dispose();
    }
  };
}

export async function beginInput(backend) {
  check(!tapSession, 'Finish the prior lifecycle input case first');
  const panels = document.createElement('div');
  panels.style.cssText = 'position:fixed;top:0;left:0;display:flex;z-index:2147483647';
  document.body.appendChild(panels);
  const controls = [],
    unhandled = [];
  const observe = event => unhandled.push(String(event.reason));
  window.addEventListener('unhandledrejection', observe);
  async function close() {
    try {
      await Promise.all(controls.map(control => control.close()));
    } finally {
      window.removeEventListener('unhandledrejection', observe);
      panels.remove();
    }
  }
  try {
    for (const [create, mode] of [
      [createLifecycleWorld, 'mesh'],
      [play, 'flat UI']
    ]) {
      const parent = document.createElement('div');
      parent.style.cssText = 'width:128px;height:96px;position:relative';
      panels.appendChild(parent);
      controls.push(await tapControl(create, { parent, backend, width: 128, height: 96 }, mode));
    }
    await frames();
    tapSession = { controls, close, unhandled };
    return { scene: controls[0].center(), overlay: controls[1].center() };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function readInput() {
  check(tapSession, 'Start the lifecycle input case first');
  const { controls, close, unhandled } = tapSession;
  try {
    const mesh = await controls[0].retry(),
      flatUI = await controls[1].retry();
    await frames();
    check(unhandled.length === 0, 'A rejected tap restart escaped browser error handling');
    return { ok: true, mesh, flatUI, unhandledRejections: unhandled.length };
  } finally {
    tapSession = undefined;
    await close();
  }
}
