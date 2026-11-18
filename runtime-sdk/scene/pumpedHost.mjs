// SPDX-License-Identifier: Apache-2.0
// The fixture performs asynchronous work only while opening or closing. A bare
// isolate pumps these deadlines alongside its promise jobs on the owning thread.
export function createPumpedHost(now) {
  const pending = new Set();
  return {
    surface: {},
    close: async () => {},
    setTimeout(callback, delay) {
      const timer = { callback, deadline: now() + delay };
      pending.add(timer);
      return () => pending.delete(timer);
    },
    poll() {
      const current = now();
      for (const timer of [...pending]) {
        if (timer.deadline <= current && pending.delete(timer)) timer.callback();
      }
    }
  };
}
