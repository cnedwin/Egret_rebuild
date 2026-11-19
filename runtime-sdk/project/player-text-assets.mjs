// SPDX-License-Identifier: Apache-2.0

const MAX_ASSET_BYTES = 256 * 1024;
const CHUNK_BYTES = 64 * 1024;
const END = Object.freeze({ done: true, value: undefined });

function decodeBytes(encoded, maxBytes) {
  const tooLarge = () => new RangeError('Project binary asset exceeds ' + maxBytes / 1024 + ' KiB');
  if (encoded.length > Math.ceil(maxBytes / 3) * 4) throw tooLarge();
  // Both embedded V8 profiles provide the typed-array codec. Older System WebViews
  // supply atob. Each read returns a fresh buffer owned by the caller.
  const bytes = typeof Uint8Array.fromBase64 === 'function' ? Uint8Array.fromBase64(encoded)
    : Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
  if (bytes.length > maxBytes) throw tooLarge();
  return bytes;
}

function readError(name, path) {
  const message = 'Cannot read project asset: ' + path;
  if (name === 'RangeError') return new RangeError(message);
  if (name === 'TypeError') return new TypeError(message);
  return Object.assign(new Error(message), { name });
}

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

  function cancelNative(id) {
    // A retiring WebView may already have detached Java. Closing the native
    // session also releases its outstanding operations.
    try { native.cancelReadText(id); } catch { /* Local ownership has ended. */ }
  }

  function cancel(id, reason) {
    const request = detach(id);
    if (!request) return;
    request.reject(reason);
    cancelNative(id);
  }

  lifetime.addEventListener('abort', () => {
    for (const id of pending.keys()) cancel(id, lifetime.reason);
  }, { once: true });

  function register(method, path, signal, result, reject) {
    if (lifetime.aborted) throw lifetime.reason;
    if (signal?.aborted) throw signal.reason;
    if (typeof path !== 'string' || !path.length) throw new TypeError('Expected a project asset path');
    if (typeof native[method] !== 'function' || (method === 'openChunks' && typeof native.nextChunk !== 'function') ||
        typeof native.takeTextResult !== 'function' || typeof native.cancelReadText !== 'function')
      throw Object.assign(new Error('This player library does not support ' + method), { name: 'NotSupportedError' });
    // Never reuse an ID: an earlier completion can still be queued after cancellation.
    if (pending.size >= 8 || lastId === 0x7fffffff) throw new RangeError('Project asset read limit reached');
    const id = ++lastId;
    if (signal === lifetime) signal = undefined;
    const abort = () => cancel(id, signal.reason);
    pending.set(id, { signal, abort, result, reject });
    signal?.addEventListener('abort', abort, { once: true });
    return id;
  }

  function take(id, path) {
    const value = native.takeTextResult(id);
    if (typeof value !== 'string') throw new Error('Missing project asset result: ' + path);
    return value;
  }

  function read(method, path, signal) {
    return new Promise((resolve, reject) => {
      const id = register(method, path, signal, status => {
        detach(id);
        try {
          if (status) throw readError(status, path);
          const value = take(id, path);
          resolve(method === 'readBytes' ? decodeBytes(value, MAX_ASSET_BYTES) : value);
        } catch (error) { reject(error); }
      }, reject);
      try {
        if (!native[method](id, path)) throw new RangeError('Project asset read limit reached');
      } catch (error) {
        detach(id);
        reject(error);
      }
    });
  }

  function readChunks(path, signal) {
    let id, waiter, error;
    let done = false, failed = false;

    function fail(reason) {
      failed = true;
      error = reason;
      waiter?.reject(reason);
      waiter = undefined;
    }

    function result(status) {
      if (!waiter) return;
      if (status) {
        detach(id);
        if (status !== 'eof') { fail(readError(status, path)); return; }
        done = true;
        waiter.resolve(END);
      } else {
        try {
          const bytes = decodeBytes(take(id, path), CHUNK_BYTES);
          if (!bytes.length) throw new Error('Missing project asset chunk: ' + path);
          waiter.resolve({ done: false, value: bytes });
        } catch (reason) { cancel(id, reason); }
      }
      waiter = undefined;
    }

    // A parked iterator still owns the native file. Explicit pulls provide
    // backpressure; return() and abort can interrupt a pull already in flight.
    return {
      [Symbol.asyncIterator]() { return this; },
      next() {
        if (done) return Promise.resolve(END);
        if (failed) return Promise.reject(error);
        if (waiter) return Promise.reject(new TypeError('A project asset chunk read is already pending'));
        return new Promise((resolve, reject) => {
          waiter = { resolve, reject };
          try {
            let accepted;
            if (id === undefined) {
              id = register('openChunks', path, signal, result, fail);
              accepted = native.openChunks(id, path);
            } else {
              accepted = native.nextChunk(id);
            }
            if (!accepted) throw new RangeError('Project asset chunk read was not accepted');
          } catch (reason) {
            if (id === undefined) fail(reason);
            else cancel(id, reason);
          }
        });
      },
      return(value) {
        done = true;
        if (detach(id)) cancelNative(id);
        waiter?.resolve(END);
        waiter = undefined;
        return Promise.resolve({ done: true, value });
      }
    };
  }

  function textResult(id, status) { pending.get(id)?.result(status); }

  const assets = Object.freeze({
    readText: (path, signal) => read('readText', path, signal),
    readBytes: (path, signal) => read('readBytes', path, signal),
    readChunks
  });
  return { assets, textResult };
}
