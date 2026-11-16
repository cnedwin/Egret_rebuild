// SPDX-License-Identifier: Apache-2.0
/** Attach rejection observation before handing the promise to either host. */
export function deferred() {
    let resolve, reject;
    const promise = new Promise((a, b) => {
        resolve = a;
        reject = b;
    });
    promise.catch(() => undefined);
    return { promise, resolve, reject };
}
//# sourceMappingURL=sharedHostDeferred.js.map