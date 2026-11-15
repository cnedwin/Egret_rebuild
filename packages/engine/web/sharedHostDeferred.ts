// SPDX-License-Identifier: Apache-2.0
/** Attach rejection observation before handing the promise to either host. */
export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (cause: unknown) => void } {
  let resolve!: (value: T) => void, reject!: (cause: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  promise.catch(() => undefined);
  return { promise, resolve, reject };
}
