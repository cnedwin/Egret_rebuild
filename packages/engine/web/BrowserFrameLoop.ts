// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';

/** What the loop asks of an Engine: its clock's limit, time and frames. `F` is what `renderSharedFrame` takes. */
export interface FrameLoopEngine<F> {
  readonly clock: { readonly maxDeltaSeconds: number };
  advanceTime(sourceSeconds: number): unknown;
  renderSharedFrame(options: F): unknown;
}
/** What the loop asks of a Host: how many frames it holds that it has not finished. Both shared Hosts have it. */
export interface FrameLoopHost {
  getStatus(): { readonly pendingFrames: number };
}
export interface BrowserFrameLoopOptions<F> {
  readonly engine: FrameLoopEngine<F>;
  /** The frame to draw: its size and clear colour. A function is called for each frame that is drawn. */
  readonly frame: F | (() => F);
  /** The Host the Engine draws with. With it, a frame is skipped while the Host holds `maxPendingFrames`, instead of being refused. */
  readonly host?: FrameLoopHost;
  /** How many unfinished frames a Host takes; 2, as both shared Hosts take unless they are made with another number. */
  readonly maxPendingFrames?: number;
  /** One step of the game, called before each frame with the seconds since the step before: 0 at first, never more than `maxStepSeconds`. */
  readonly update?: (deltaSeconds: number) => void;
  /** The longest step, in seconds. A tab that was hidden comes back with one step of this length. Defaults to 0.1, and is never more than the Engine's clock takes. */
  readonly maxStepSeconds?: number;
  /** Told once of what stopped the loop. Without it the failure is thrown from the display's callback, where the console shows it. */
  readonly onError?: (error: unknown) => void;
  /** The display's frame callback and its cancellation; `requestAnimationFrame` and `cancelAnimationFrame` by default. */
  readonly requestFrame?: (callback: (milliseconds: number) => void) => number;
  readonly cancelFrame?: (handle: number) => void;
}
export type BrowserFrameLoopState = 'idle' | 'running' | 'failed' | 'closed';
export interface BrowserFrameLoopSnapshot {
  readonly state: BrowserFrameLoopState;
  /** Steps taken, frames drawn, and frames skipped because the Host was busy. */
  readonly steps: number;
  readonly frames: number;
  readonly skipped: number;
  /** The seconds of game time the loop has given the Engine's clock. */
  readonly seconds: number;
  readonly failure: unknown;
}
export interface BrowserFrameLoop {
  readonly state: BrowserFrameLoopState;
  /** Starts, or starts again after `stop`. The time spent stopped is not played back. */
  start(): void;
  stop(): void;
  snapshot(): BrowserFrameLoopSnapshot;
  dispose(): void;
}

const invalid = (): EgretError => new EgretError('FRAME_LOOP_OPTIONS_INVALID');
const backpressure = (error: unknown): boolean => {
  const cause = (error as { readonly cause?: { readonly code?: unknown } } | null)?.cause;
  return typeof cause?.code === 'string' && cause.code.endsWith('_BACKPRESSURE');
};

/**
 * The frame loop of a game in a page. On each frame the display shows, it advances the Engine's clock, which moves
 * tweens and sequences, calls `update`, and draws one frame. It keeps a step short after the page was hidden, and it
 * skips a frame, without failing, while the Host has not finished the frames it holds.
 */
export function createBrowserFrameLoop<F>(options: BrowserFrameLoopOptions<F>): BrowserFrameLoop {
  if (options === null || typeof options !== 'object') throw invalid();
  const { engine, frame, host, update, onError } = options,
    limit = options.maxPendingFrames ?? 2;
  const request =
    options.requestFrame ?? ((callback: (milliseconds: number) => void): number => requestAnimationFrame(callback));
  const cancel = options.cancelFrame ?? ((handle: number): void => cancelAnimationFrame(handle));
  if (
    engine === null ||
    typeof engine !== 'object' ||
    typeof engine.advanceTime !== 'function' ||
    typeof engine.renderSharedFrame !== 'function' ||
    frame === undefined ||
    frame === null ||
    (host !== undefined && (host === null || typeof host !== 'object' || typeof host.getStatus !== 'function')) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    (update !== undefined && typeof update !== 'function') ||
    (onError !== undefined && typeof onError !== 'function') ||
    typeof request !== 'function' ||
    typeof cancel !== 'function'
  )
    throw invalid();
  const clockLimit = engine.clock?.maxDeltaSeconds,
    asked = options.maxStepSeconds ?? 0.1;
  if (typeof clockLimit !== 'number' || !(clockLimit > 0) || typeof asked !== 'number' || !(asked > 0)) throw invalid();
  const maxStep = Math.min(asked, clockLimit);

  let state: BrowserFrameLoopState = 'idle',
    handle: number | undefined,
    last: number | undefined;
  let seconds = 0,
    steps = 0,
    frames = 0,
    skipped = 0,
    failure: unknown;
  const tick = (milliseconds: number): void => {
    handle = undefined;
    if (state !== 'running') return;
    try {
      // The clock is given the loop's own seconds, which never jump: a long gap counts as one step of the longest length.
      const delta = last === undefined ? 0 : Math.min(maxStep, Math.max(0, (milliseconds - last) / 1000));
      last = milliseconds;
      seconds += delta;
      engine.advanceTime(seconds);
      steps++;
      update?.(delta);
      // The update may have stopped or disposed the loop.
      if (state !== 'running') return;
      if (host !== undefined && host.getStatus().pendingFrames >= limit) skipped++;
      else {
        try {
          engine.renderSharedFrame(typeof frame === 'function' ? (frame as () => F)() : frame);
          frames++;
        } catch (error) {
          if (host !== undefined || !backpressure(error)) throw error;
          skipped++;
        }
      }
      handle = request(tick);
    } catch (error) {
      state = 'failed';
      failure = error;
      if (onError === undefined) throw error;
      onError(error);
    }
  };
  const stop = (): void => {
    if (handle !== undefined) {
      cancel(handle);
      handle = undefined;
    }
    if (state === 'running') state = 'idle';
  };
  const loop: BrowserFrameLoop = {
    get state() {
      return state;
    },
    start(): void {
      if (state === 'closed') throw new EgretError('FRAME_LOOP_CLOSED');
      if (state === 'running') return;
      // What stopped the loop is forgotten when it is started again; the gap since it ran is not a step.
      state = 'running';
      failure = undefined;
      last = undefined;
      handle = request(tick);
    },
    stop,
    snapshot: () => Object.freeze({ state, steps, frames, skipped, seconds, failure }),
    dispose(): void {
      stop();
      state = 'closed';
    }
  };
  return Object.freeze(loop);
}
