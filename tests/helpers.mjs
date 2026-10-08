export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// An explicit headless adapter controls only the injected host boundary.
// Its timer never guesses how the implementation stores or orders resources.
export function host(overrides = {}) {
  const trace = [];
  const timers = new Set();
  const adapter = {
    surface: {},
    start() { trace.push("start"); },
    stop() { trace.push("stop"); },
    async close() { trace.push("close"); },
    setTimeout(callback, delayMs) {
      const timer = { callback, delayMs };
      timers.add(timer);
      return () => timers.delete(timer);
    },
    ...overrides,
  };
  return {
    adapter,
    trace,
    timers,
    expire() { for (const timer of [...timers]) { timers.delete(timer); timer.callback(); } },
  };
}

export async function flush() {
  for (let index = 0; index < 8; index++) await Promise.resolve();
}
