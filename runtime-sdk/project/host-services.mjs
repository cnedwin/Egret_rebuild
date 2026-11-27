// SPDX-License-Identifier: Apache-2.0
// The embedded host and WebView exchange a numeric request ID. Provider data is
// pulled exactly once as JSON and never interpolated into executable JavaScript.
export function createHostServices(native, lifetime) {
  const requests = new Map();
  let sequence = 0;

  function release(id) {
    const request = requests.get(id);
    if (request) {
      requests.delete(id);
      request.signal?.removeEventListener('abort', request.abort);
    }
    return request;
  }

  function cancel(id, reason) {
    const request = release(id);
    if (!request) return;
    try { native.hostCancel(id); }
    finally { request.reject(reason ?? Object.assign(new Error('Host call canceled'), {name: 'AbortError'})); }
  }

  lifetime.addEventListener('abort', () => {
    for (const id of requests.keys()) cancel(id, lifetime.reason);
  }, {once: true});

  async function call(action, value, signal) {
    lifetime.throwIfAborted();
    if (signal?.aborted) throw signal.reason ?? Object.assign(new Error('Host call canceled'), {name: 'AbortError'});
    if (typeof native.hostStart !== 'function') {
      throw Object.assign(new Error('This player has no channel service'), {name: 'NotSupportedError'});
    }
    if (typeof action !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(action)) {
      throw new TypeError('Invalid host action');
    }
    const json = JSON.stringify(value);
    // Custom toJSON methods can cancel the caller or close the whole game synchronously.
    lifetime.throwIfAborted();
    if (signal?.aborted) throw signal.reason ?? Object.assign(new Error('Host call canceled'), {name: 'AbortError'});
    if (typeof json !== 'string' || json.length > 65536) throw new RangeError('Expected bounded JSON for a host call');
    if (requests.size >= 32 || sequence === 0x7fffffff) throw new RangeError('Host request capacity reached');
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const abort = () => cancel(id, signal.reason);
      requests.set(id, {resolve, reject, signal, abort});
      try {
        signal?.addEventListener('abort', abort, {once: true});
        if (!native.hostStart(id, action, json)) throw new Error('Host action unavailable: ' + action);
      } catch (error) { release(id); reject(error); }
    });
  }

  function hostResult(id, ok) {
    const request = release(id);
    if (!request) return;
    try {
      const text = native.hostTake(id);
      if (typeof text !== 'string') throw new Error('Missing host reply');
      if (!ok) throw new Error(text);
      request.resolve(JSON.parse(text));
    } catch (error) { request.reject(error); }
  }
  return {host: Object.freeze({call}), hostResult};
}
