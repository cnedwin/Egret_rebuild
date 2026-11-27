// SPDX-License-Identifier: Apache-2.0
import type { CancellationSignal } from '@egret/contracts';
import { EgretError } from '@egret/runtime';

interface WaitingJob {
  readonly signal: CancellationSignal;
  readonly resolve: (release: () => void) => void;
  readonly reject: (cause: unknown) => void;
  readonly cancel: () => void;
}

/** Per-game image admission. Queued entries own no fetches, decoded images or encoded-byte credits. */
export function createGameImageAdmission(activeLimit: number) {
  const waitingLimit = 256;
  const queue: WaitingJob[] = [];
  let active = 0;

  function permit(): () => void {
    active++;
    let returned = false;
    return () => {
      if (returned) return;
      returned = true;
      active--;
      drain();
    };
  }

  function drain(): void {
    while (active < activeLimit && queue.length !== 0) {
      const next = queue.shift()!;
      next.signal.removeEventListener('abort', next.cancel);
      if (next.signal.aborted) next.reject(next.signal.reason);
      else next.resolve(permit());
    }
  }

  return {
    admit(signal: CancellationSignal): Promise<() => void> {
      if (signal.aborted) return Promise.reject(signal.reason);
      if (active < activeLimit && queue.length === 0) return Promise.resolve(permit());
      if (queue.length >= waitingLimit)
        return Promise.reject(
          new EgretError('WEB_PNG_JOB_LIMIT', { cause: new RangeError('Game image waiting job limit') })
        );
      return new Promise((resolve, reject) => {
        const entry: WaitingJob = {
          signal,
          resolve,
          reject,
          cancel() {
            const index = queue.indexOf(entry);
            if (index < 0) return;
            queue.splice(index, 1);
            signal.removeEventListener('abort', entry.cancel);
            reject(signal.reason);
          }
        };
        queue.push(entry);
        signal.addEventListener('abort', entry.cancel, { once: true });
        // A cancellation between the admission decision and subscription owns no active slot.
        if (signal.aborted) entry.cancel();
      });
    }
  };
}
