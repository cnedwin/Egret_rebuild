// SPDX-License-Identifier: Apache-2.0

const MAX_ASSET_BYTES = 256 * 1024;

function decodeBytes(encoded) {
  if (encoded.length > Math.ceil(MAX_ASSET_BYTES / 3) * 4) throw new RangeError('Project binary asset exceeds 256 KiB');
  // Both embedded V8 profiles provide the typed-array codec. Older System WebViews
  // supply atob. Each read returns a fresh buffer owned by the caller.
  const bytes = typeof Uint8Array.fromBase64 === 'function' ? Uint8Array.fromBase64(encoded)
    : Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
  if (bytes.length > MAX_ASSET_BYTES) throw new RangeError('Project binary asset exceeds 256 KiB');
  return bytes;
}

// Text and bytes share one session request table. Keep the #391 cancel, take and
// completion channel compatible with games exported for the text-only player.
export function createPlayerAssets(native, lifetime) {
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

  function read(method, path, signal) {
    return new Promise((resolve, reject) => {
      if (lifetime.aborted) throw lifetime.reason;
      if (signal?.aborted) throw signal.reason;
      if (typeof path !== 'string' || !path.length) throw new TypeError('Expected a project asset path');
      if (typeof native[method] !== 'function' || typeof native.takeTextResult !== 'function' ||
          typeof native.cancelReadText !== 'function')
        throw Object.assign(new Error('This player library does not support ' + method), { name: 'NotSupportedError' });
      // Never reuse an ID: an earlier completion can still be queued after cancellation.
      if (pending.size >= 8 || lastId === 0x7fffffff) throw new RangeError('Project asset read limit reached');
      const id = ++lastId;
      if (signal === lifetime) signal = undefined;
      const abort = () => cancel(id, signal.reason);
      signal?.addEventListener('abort', abort, { once: true });
      pending.set(id, { method, path, signal, abort, resolve, reject });
      try {
        if (!native[method](id, path)) throw new RangeError('Project asset read limit reached');
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
      const value = native.takeTextResult(id);
      if (typeof value !== 'string') throw new Error('Missing project asset result: ' + request.path);
      request.resolve(request.method === 'readBytes' ? decodeBytes(value) : value);
    } catch (error) {
      request.reject(error);
    }
  }

  const assets = Object.freeze({
    readText: (path, signal) => read('readText', path, signal),
    readBytes: (path, signal) => read('readBytes', path, signal)
  });
  return { assets, textResult };
}
