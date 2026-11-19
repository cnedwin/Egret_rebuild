// SPDX-License-Identifier: Apache-2.0

// One request table belongs to one game view. Native workers signal readiness
// with an ID; only the owning script host takes the decoded text.
export function createPlayerTextAssets(native, lifetime) {
  const pending = new Map();
  let lastId = 0;

  function detach(id) {
    const request = pending.get(id);
    if (request) {
      pending.delete(id);
      request.signal?.removeEventListener('abort', request.abort);
    }
    return request;
  }

  function cancel(id, reason) {
    const request = detach(id);
    if (!request) return;
    request.reject(reason);
    // A retiring WebView can already have detached its Java bridge. The native
    // session also releases every outstanding read when the view closes.
    try { native.cancelReadText(id); } catch { /* The local read is already settled. */ }
  }

  lifetime.addEventListener('abort', () => {
    for (const id of pending.keys()) cancel(id, lifetime.reason);
  }, { once: true });

  function readText(path, signal) {
    return new Promise((resolve, reject) => {
      if (lifetime.aborted) throw lifetime.reason;
      if (signal?.aborted) throw signal.reason;
      if (typeof path !== 'string' || !path.length) throw new TypeError('Expected a project asset path');
      if (typeof native.readText !== 'function' || typeof native.takeTextResult !== 'function' ||
          typeof native.cancelReadText !== 'function')
        throw Object.assign(new Error('This player library does not support packaged text'), { name: 'NotSupportedError' });
      // Never reuse an ID: an earlier completion can still be queued after cancellation.
      if (pending.size >= 8 || lastId === 0x7fffffff) throw new RangeError('Project text read limit reached');
      const id = ++lastId;
      if (signal === lifetime) signal = undefined;
      const abort = () => cancel(id, signal.reason);
      signal?.addEventListener('abort', abort, { once: true });
      pending.set(id, { path, signal, abort, resolve, reject });
      try {
        if (!native.readText(id, path)) throw new RangeError('Project text read limit reached');
      } catch (error) {
        detach(id);
        reject(error);
      }
    });
  }

  function textResult(id, errorName) {
    const request = detach(id);
    if (!request) return;
    try {
      if (errorName) {
        const message = 'Cannot read project asset: ' + request.path;
        if (errorName === 'RangeError') throw new RangeError(message);
        if (errorName === 'TypeError') throw new TypeError(message);
        throw Object.assign(new Error(message), { name: errorName });
      }
      const text = native.takeTextResult(id);
      if (typeof text !== 'string') throw new Error('Missing project text result: ' + request.path);
      request.resolve(text);
    } catch (error) {
      request.reject(error);
    }
  }

  return { assets: Object.freeze({ readText }), textResult };
}
