// SPDX-License-Identifier: Apache-2.0
/** One queue per game, shared by groups and direct reads. Only leaf I/O consumes a slot. */
export function createResourceReads(signal) {
  const waiting = new Set();
  let limit = 4,
    using = 0,
    pumping = false;
  function pump() {
    if (pumping || signal.aborted) return;
    pumping = true;
    try {
      while (using < limit && waiting.size && !signal.aborted) {
        const job = waiting.values().next().value;
        waiting.delete(job);
        using++;
        let result;
        try {
          job.generation.check();
          result = job.open();
        } catch (error) {
          using--;
          job.reject(error);
          continue;
        }
        Promise.resolve(result)
          .then(job.resolve, job.reject)
          .finally(() => {
            using--;
            pump();
          });
      }
    } finally {
      pumping = false;
    }
  }
  signal.addEventListener(
    'abort',
    () => {
      for (const job of waiting) job.reject(signal.reason);
      waiting.clear();
    },
    { once: true }
  );
  return {
    setLimit(value) {
      if (signal.aborted) throw signal.reason;
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new TypeError('Expected a finite resource loading limit.');
      limit = Math.max(1, Math.ceil(value));
      pump();
    },
    read(name, generation, open) {
      return new Promise((resolve, reject) => {
        generation.check();
        waiting.add({ name, generation, open, resolve, reject });
        pump();
      });
    },
    retire(name) {
      for (const job of waiting) {
        if (job.name !== name) continue;
        waiting.delete(job);
        job.reject(Object.assign(new Error('The queued resource was released.'), { code: 'LEGACY_RESOURCE_RETIRED' }));
      }
    }
  };
}
