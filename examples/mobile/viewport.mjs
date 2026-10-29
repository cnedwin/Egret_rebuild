// SPDX-License-Identifier: Apache-2.0
// Example policy, not an Engine viewport or input API.
export function measureViewport(cssWidth, deviceDensity, kind) {
  if (!Number.isFinite(cssWidth) || cssWidth <= 0) throw new RangeError('EXAMPLE_WIDTH');
  const width = Math.max(1, Math.min(960, Math.floor(cssWidth)));
  const density = Math.max(1, Math.min(2, Number.isFinite(deviceDensity) && deviceDensity > 0 ? deviceDensity : 1));
  const height = kind === 'resources' ? width * 2 / 3 : kind === 'pointers' ? 240 : kind === 'ui' ? 520 : 680;
  return Object.freeze({width, height, density});
}

/** One owner at a time. A stale initialization must close before another starts. */
export function createMountQueue(mount, changed = () => {}) {
  let pending, active, abort, pump, stopped = false, revision = 0, state = 'starting', model, retired, blocked;
  const errors = [];
  function notify() { changed({state, revision, errors: errors.slice()}); }
  async function retire() {
    if (!active) return;
    const previous = active; active = undefined;
    try { model = previous.snapshot?.(); }
    finally { abort?.abort(); await previous.close(); retired = previous.inspect?.(); }
  }
  function run() {
    if (pump) return pump;
    pump = (async () => {
      while (pending && !stopped) {
        const next = pending; pending = undefined;
        state = 'resizing'; notify();
        await retire();
        if (stopped) break;
        if (pending) continue;
        abort = new AbortController();
        const ownRevision = ++revision;
        let candidate;
        try {
          candidate = await mount(next, abort.signal, model, ownRevision);
          if (stopped || pending || abort.signal.aborted) {
            model = candidate.snapshot?.(); await candidate.close(); retired = candidate.inspect?.();
          } else { active = candidate; state = 'ready'; notify(); }
        } catch (error) {
          if (candidate) await candidate.close();
          // Cancellation is a specific outcome. A cleanup failure during abort is still a failure.
          if (abort.signal.aborted && error?.name === 'AbortError') continue;
          if (abort.signal.aborted || candidate) throw error;
          errors.push(String(error?.code ?? error?.message ?? error)); state = 'failed'; notify();
        }
      }
      if (stopped) { await retire(); state = 'closed'; notify(); }
    })().catch(error => {
      blocked = error; pending = undefined;
      errors.push(String(error?.code ?? error?.message ?? error)); state = 'failed'; notify(); throw error;
    }).finally(() => {
      pump = undefined;
      if ((pending && !stopped) || (stopped && active)) void run().catch(() => {});
    });
    return pump;
  }
  return Object.freeze({
    async request(viewport) {
      if (stopped) return Promise.resolve();
      if (blocked) return Promise.reject(blocked);
      pending = viewport; state = 'resizing'; notify();
      if (!active) abort?.abort();
      await run(); while (pump) await pump; if (blocked) throw blocked;
    },
    async whenIdle() {
      for (;;) {
        while (pump) await pump;
        const current = active; await current?.whenIdle?.();
        if (!pump && current === active) return;
      }
    },
    async close() { stopped = true; pending = undefined; abort?.abort(); await run(); while (pump) await pump; },
    inspect() { return {state, revision, blocked: blocked !== undefined, errors: errors.slice(), application: active?.inspect() ?? null, retired: retired ?? null}; },
    async readback() { await this.whenIdle(); return active?.readback?.(); },
  });
}
