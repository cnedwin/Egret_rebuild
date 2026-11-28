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
/** An observational CPU sample for one browser callback. Render return is not GPU completion or presentation. */
export interface BrowserFrameTiming {
  readonly id: number;
  readonly rafTimestampMs: number;
  readonly callbackStartMs: number;
  readonly callbackEndMs: number;
  readonly updateMs: number;
  readonly decisionMs: number;
  readonly hostCheckMs: number;
  readonly prepareMs: number;
  readonly renderMs: number;
  /** CPU duration of afterFrame, present only when that callback is configured. */
  readonly afterFrameMs?: number;
  /** Observed only when the loop actually checked Host admission. */
  readonly pendingFrames?: number;
  readonly outcome: 'retained' | 'backpressure' | 'rendered' | 'retry' | 'interrupted' | 'failed';
}
/** A frame loop to run: its engine, frame and host, its update, how long a step and a catch-up may be, and its frame requests. */
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
  /** After the update, return false to retain the frame already displayed. Time and input still advance. */
  readonly shouldRender?: () => boolean;
  /** Optional presentation-only preparation after the wanted-frame and Host admission checks. The Host may still refuse the attempt. */
  readonly beforeRender?: () => void;
  /** Synchronous presentation work at the end of each live display turn, after the primary frame decision/submission. */
  readonly afterFrame?: () => void;
  /** Opt-in bounded recovery of a failed render call, never of clock/update/preparation errors. */
  readonly renderRetry?: {
    readonly maxConsecutive: number;
    readonly shouldRetry: (error: unknown, consecutiveFailure: number) => boolean;
  };
  /** The longest step, in seconds. A tab that was hidden comes back with one step of this length. Defaults to 0.1, and is never more than the Engine's clock takes. */
  readonly maxStepSeconds?: number;
  /**
   * How much of a long gap is played back. A frame that took longer than `maxStepSeconds` is given as several
   * steps of at most that length, up to this many seconds in all, before one frame is drawn; the rest of the gap
   * is dropped. 0, the default, gives one step of the longest length, so a slow device plays slower instead of
   * jumping. A tab that comes back from being hidden still loses the time it was hidden beyond this.
   */
  readonly catchUpSeconds?: number;
  /** Opt-in CPU timings on the browser time origin. Observer exceptions do not affect the loop. */
  readonly onFrameTiming?: (sample: BrowserFrameTiming) => void;
  /** Told once of what stopped the loop. Without it the failure is thrown from the display's callback, where the console shows it. */
  readonly onError?: (error: unknown) => void;
  /** The display's frame callback and its cancellation; `requestAnimationFrame` and `cancelAnimationFrame` by default. */
  readonly requestFrame?: (callback: (milliseconds: number) => void) => number;
  readonly cancelFrame?: (handle: number) => void;
}
/** Whether a frame loop is idle, running, failed or closed. */
export type BrowserFrameLoopState = 'idle' | 'running' | 'failed' | 'closed';
/** A frame loop as it is now: its state, its steps, frames and skipped frames, its seconds and any failure. */
export interface BrowserFrameLoopSnapshot {
  readonly state: BrowserFrameLoopState;
  /** Steps taken, frames drawn, and frames skipped because the Host was busy. */
  readonly steps: number;
  readonly frames: number;
  readonly skipped: number;
  /** The seconds of game time the loop has given the Engine's clock. */
  readonly seconds: number;
  readonly failure: unknown;
  /** Number of render failures explicitly accepted for retry, present only with a configured policy. */
  readonly recoveredRenderFailures?: number;
}
/** Steps the Engine and draws a frame on each animation frame of the browser. */
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
  const { engine, frame, host, update, shouldRender, beforeRender, afterFrame, onError, renderRetry, onFrameTiming } =
      options,
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
    (shouldRender !== undefined && typeof shouldRender !== 'function') ||
    (beforeRender !== undefined && typeof beforeRender !== 'function') ||
    (afterFrame !== undefined && typeof afterFrame !== 'function') ||
    (renderRetry !== undefined &&
      (renderRetry === null ||
        typeof renderRetry !== 'object' ||
        !Number.isSafeInteger(renderRetry.maxConsecutive) ||
        renderRetry.maxConsecutive < 1 ||
        renderRetry.maxConsecutive > 8 ||
        typeof renderRetry.shouldRetry !== 'function')) ||
    (onError !== undefined && typeof onError !== 'function') ||
    (onFrameTiming !== undefined && typeof onFrameTiming !== 'function') ||
    typeof request !== 'function' ||
    typeof cancel !== 'function'
  )
    throw invalid();
  const clockLimit = engine.clock?.maxDeltaSeconds,
    asked = options.maxStepSeconds ?? 0.1,
    catchUp = options.catchUpSeconds ?? 0;
  if (
    typeof clockLimit !== 'number' ||
    !(clockLimit > 0) ||
    typeof asked !== 'number' ||
    !(asked > 0) ||
    typeof catchUp !== 'number' ||
    !(catchUp >= 0) ||
    !Number.isFinite(catchUp)
  )
    throw invalid();
  const maxStep = Math.min(asked, clockLimit);
  // Steps of one long frame are capped too, so a stalled page cannot spend a frame catching up forever.
  const maxStepsPerFrame = Math.max(1, Math.ceil(Math.max(catchUp, maxStep) / maxStep));

  let state: BrowserFrameLoopState = 'idle',
    handle: number | undefined,
    last: number | undefined;
  const retryLimit = renderRetry?.maxConsecutive ?? 0;
  const shouldRetry = renderRetry?.shouldRetry;
  let consecutiveRenderFailures = 0,
    recoveredRenderFailures = 0;
  let timingId = 0;
  let seconds = 0,
    steps = 0,
    frames = 0,
    skipped = 0,
    failure: unknown;
  const currentTick = (): boolean => state === 'running' && handle === undefined;
  const isClosed = (): boolean => state === 'closed';
  const tick = (milliseconds: number): void => {
    handle = undefined;
    if (state !== 'running') return;
    const started = onFrameTiming === undefined ? 0 : performance.now();
    const durations =
      onFrameTiming === undefined
        ? undefined
        : { updateMs: 0, decisionMs: 0, hostCheckMs: 0, prepareMs: 0, renderMs: 0, afterFrameMs: 0 };
    type Phase = 'updateMs' | 'decisionMs' | 'hostCheckMs' | 'prepareMs' | 'renderMs' | 'afterFrameMs';
    let phase: Phase | undefined = 'updateMs',
      phaseStart = started;
    let outcome: BrowserFrameTiming['outcome'] = 'interrupted',
      observedPending: number | undefined;
    const nextPhase =
      durations === undefined
        ? undefined
        : (next?: Phase): void => {
            const now = performance.now();
            if (phase !== undefined) durations[phase] += now - phaseStart;
            phase = next;
            phaseStart = now;
          };
    try {
      // The clock is given the loop's own seconds, which never jump. A long gap counts as one step of the longest
      // length, or, with catchUpSeconds, as several such steps up to that much time.
      const gap = last === undefined ? 0 : Math.max(0, (milliseconds - last) / 1000);
      last = milliseconds;
      let owed = catchUp > 0 ? Math.min(gap, Math.max(catchUp, maxStep)) : Math.min(gap, maxStep);
      for (let step = 0; step < maxStepsPerFrame; step++) {
        const delta = Math.min(maxStep, owed);
        owed -= delta;
        seconds += delta;
        engine.advanceTime(seconds);
        steps++;
        if (!currentTick()) return;
        update?.(delta);
        // The update may have stopped or disposed the loop.
        if (!currentTick()) return;
        if (!(owed > 1e-9)) break;
      }
      nextPhase?.('decisionMs');
      const wantsFrame = shouldRender?.() ?? true;
      if (!currentTick()) return;
      if (wantsFrame) {
        nextPhase?.('hostCheckMs');
        const pending = host?.getStatus().pendingFrames;
        observedPending = pending;
        if (!currentTick()) return;
        if (pending !== undefined && pending >= limit) {
          skipped++;
          outcome = 'backpressure';
          nextPhase?.();
        } else {
          nextPhase?.('prepareMs');
          beforeRender?.();
          if (!currentTick()) return;
          const optionsForFrame = typeof frame === 'function' ? (frame as () => F)() : frame;
          if (!currentTick()) return;
          nextPhase?.('renderMs');
          try {
            engine.renderSharedFrame(optionsForFrame);
            nextPhase?.();
            outcome = 'rendered';
            frames++;
            consecutiveRenderFailures = 0;
          } catch (error) {
            nextPhase?.();
            if (host === undefined && backpressure(error)) {
              skipped++;
              outcome = 'backpressure';
            } else {
              const attempt = consecutiveRenderFailures + 1;
              let retry = false;
              if (shouldRetry !== undefined && attempt <= retryLimit) {
                try {
                  retry = shouldRetry(error, attempt) === true;
                } catch (decisionError) {
                  throw new EgretError('FRAME_LOOP_RENDER_RETRY_FAILED', {
                    cause: new AggregateError([error, decisionError], 'Render retry decision failed')
                  });
                }
              }
              if (!currentTick()) return;
              if (!retry) throw error;
              consecutiveRenderFailures = attempt;
              recoveredRenderFailures++;
              outcome = 'retry';
            }
          }
        }
      } else {
        outcome = 'retained';
        nextPhase?.();
      }
      // A retained or temporarily refused primary frame can still accompany
      // another presentation surface. Do not run a superseded turn's work.
      if (afterFrame !== undefined && currentTick()) {
        nextPhase?.('afterFrameMs');
        afterFrame();
        nextPhase?.();
      }
      if (state === 'running' && handle === undefined) handle = request(tick);
    } catch (error) {
      nextPhase?.();
      outcome = 'failed';
      // A callback may have disposed the loop or explicitly queued a restart
      // before throwing. An error must not resurrect disposal or leave that request live.
      if (!isClosed()) state = 'failed';
      const queued = handle;
      handle = undefined;
      let reported = error;
      if (queued !== undefined) {
        try {
          cancel(queued);
        } catch (cancelError) {
          reported = new EgretError('FRAME_LOOP_CANCEL_FAILED', {
            cause: new AggregateError([error, cancelError], 'Frame failure and queued-request cancellation failed')
          });
        }
      }
      failure = reported;
      if (onError === undefined) throw reported;
      onError(reported);
    } finally {
      if (onFrameTiming !== undefined && durations !== undefined) {
        nextPhase?.();
        const { afterFrameMs, ...measured } = durations;
        const sample = Object.freeze({
          id: ++timingId,
          rafTimestampMs: milliseconds,
          callbackStartMs: started,
          callbackEndMs: performance.now(),
          ...measured,
          ...(afterFrame === undefined ? {} : { afterFrameMs }),
          outcome,
          ...(observedPending === undefined ? {} : { pendingFrames: observedPending })
        });
        try {
          onFrameTiming(sample);
        } catch {
          /* Diagnostics never change clock or rendering outcomes. */
        }
      }
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
      consecutiveRenderFailures = 0;
      last = undefined;
      handle = request(tick);
    },
    stop,
    snapshot: () =>
      Object.freeze({
        state,
        steps,
        frames,
        skipped,
        seconds,
        failure,
        ...(renderRetry === undefined ? {} : { recoveredRenderFailures })
      }),
    dispose(): void {
      stop();
      state = 'closed';
    }
  };
  return Object.freeze(loop);
}
