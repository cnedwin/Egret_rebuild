// SPDX-License-Identifier: Apache-2.0
// Browser Canvas CPU work only. Cache admission, plans and leases remain with their original owners.
import type { CancellationSignal } from '@egret/contracts';
import { EgretError } from '@egret/runtime';

/** Schedule one complete synchronous piece of Canvas work, without changing its result. */
export type CanvasWorkSchedule = <T>(job: () => T, signal: CancellationSignal) => Promise<Awaited<T>>;

interface Pending {
  start(): void;
  cancel(cause: unknown): void;
}

/** Optional budget between display frames; a single Canvas operation cannot be interrupted. */
export function createBrowserTextWork(
  budgetMs: number,
  budgetWhen?: () => boolean
): { schedule: CanvasWorkSchedule; dispose(): void } {
  const queue: Pending[] = [];
  let spent = 0,
    count = 0,
    closed = false,
    draining = false,
    frame: number | undefined,
    timer: ReturnType<typeof setTimeout> | undefined;
  // A count bound also covers clocks with coarse or zero measured duration.
  const maxJobs = 8,
    maxQueued = 512;
  const doc = typeof document === 'undefined' ? undefined : document;

  function cancelBoundary(): void {
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (timer !== undefined) clearTimeout(timer);
    frame = undefined;
    timer = undefined;
  }
  function boundary(): void {
    cancelBoundary();
    if (closed) return;
    spent = count = 0;
    drain();
  }
  function next(): void {
    if (closed || frame !== undefined || timer !== undefined || (count === 0 && queue.length === 0)) return;
    // A background tab can suspend rAF entirely. Use an ordinary task there,
    // not a microtask drain. The owner can still retire every queued job at once.
    if (doc?.hidden === true) timer = setTimeout(boundary, 50);
    else frame = requestAnimationFrame(boundary);
  }
  function visibility(): void {
    if (frame === undefined && timer === undefined) return;
    cancelBoundary();
    next();
  }
  doc?.addEventListener?.('visibilitychange', visibility);

  function drain(): void {
    if (closed || draining) return;
    draining = true;
    try {
      while (queue.length > 0 && count < maxJobs && spent < budgetMs) {
        const task = queue.shift()!;
        const started = performance.now();
        count++;
        task.start();
        spent += Math.max(0, performance.now() - started);
      }
    } finally {
      draining = false;
      next();
    }
  }

  const schedule: CanvasWorkSchedule = <T>(job: () => T, signal: CancellationSignal) =>
    new Promise<Awaited<T>>((resolve, reject) => {
      if (closed) return reject(new EgretError('SCOPE_CLOSED'));
      if (signal.aborted) return reject(new EgretError('WEB_TEXT_CANCELLED', { cause: signal.reason }));
      // Decide at admission only. Switching the policy cannot accelerate an old queued job.
      let paced = true;
      if (budgetWhen !== undefined) {
        const decision = budgetWhen();
        if (typeof decision !== 'boolean') return reject(new EgretError('BROWSER_GAME_OPTIONS_INVALID'));
        // The application's callback can synchronously cancel the request or dispose the host.
        if (closed) return reject(new EgretError('SCOPE_CLOSED'));
        if (signal.aborted) return reject(new EgretError('WEB_TEXT_CANCELLED', { cause: signal.reason }));
        paced = decision;
      }
      if (paced && queue.length >= maxQueued) return reject(new EgretError('TEXT_CACHE_BUDGET'));
      let pending = true;
      const retire = (): boolean => {
        if (!pending) return false;
        pending = false;
        try {
          signal.removeEventListener('abort', abort);
        } catch (cause) {
          reject(cause);
          return false;
        }
        return true;
      };
      const entry: Pending = {
        start() {
          if (!retire()) return;
          try {
            if (closed) return reject(new EgretError('SCOPE_CLOSED'));
            if (signal.aborted) return reject(new EgretError('WEB_TEXT_CANCELLED', { cause: signal.reason }));
            void Promise.resolve(job()).then(resolve, reject);
          } catch (cause) {
            reject(cause);
          }
        },
        cancel(cause) {
          if (retire()) reject(cause);
        }
      };
      const abort = (): void => {
        const at = queue.indexOf(entry);
        if (at >= 0) queue.splice(at, 1);
        try {
          entry.cancel(new EgretError('WEB_TEXT_CANCELLED', { cause: signal.reason }));
        } catch (cause) {
          entry.cancel(cause);
        }
      };
      try {
        signal.addEventListener('abort', abort, { once: true });
        if (!pending || signal.aborted) {
          abort();
          return;
        }
        if (closed) {
          entry.cancel(new EgretError('SCOPE_CLOSED'));
          return;
        }
        if (paced) {
          queue.push(entry);
          drain();
        } else {
          entry.start();
        }
      } catch (cause) {
        const at = queue.indexOf(entry);
        if (at >= 0) queue.splice(at, 1);
        entry.cancel(cause);
      }
    });

  return Object.freeze({
    schedule,
    dispose() {
      if (closed) return;
      closed = true;
      cancelBoundary();
      doc?.removeEventListener?.('visibilitychange', visibility);
      for (const entry of queue.splice(0)) entry.cancel(new EgretError('SCOPE_CLOSED'));
    }
  });
}
