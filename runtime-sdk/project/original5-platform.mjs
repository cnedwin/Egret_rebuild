// SPDX-License-Identifier: Apache-2.0
// The original RES processors create these host objects and own their event listeners.
function packagedPath(url) {
  if (typeof url !== 'string') throw new TypeError('Expected a packaged asset URL');
  const name = url.split(/[?#]/, 1)[0].replace(/^\.\//, '');
  if (!name || name.includes(':') || name.includes('\\') ||
      name.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Unsupported packaged asset path: ' + url);
  }
  return name;
}

function makeLoader(egret, lifetime) {
  return class extends egret.EventDispatcher {
    #pending;
    abort() { this.#pending?.abort(); }

    run(operation, assign, discard) {
      this.abort();
      if (lifetime.aborted) return;
      const owner = new AbortController();
      this.#pending = owner;
      const abort = () => owner.abort();
      lifetime.addEventListener('abort', abort, { once: true });
      const detach = () => {
        lifetime.removeEventListener('abort', abort);
        if (this.#pending === owner) this.#pending = undefined;
      };
      owner.signal.addEventListener('abort', detach, { once: true });
      // A 5.x RES processor subscribes *after* calling send() or load().
      Promise.resolve().then(() => {
        owner.signal.throwIfAborted();
        return operation(owner.signal);
      }).then(result => {
        if (owner.signal.aborted) { discard?.(result); return; }
        try { assign(result); }
        catch (error) {
          discard?.(result);
          detach();
          this.dispatchEventWith(egret.IOErrorEvent.IO_ERROR, false, String(error?.message ?? error));
          return;
        }
        detach();
        this.dispatchEventWith(egret.Event.COMPLETE);
      }, error => {
        if (owner.signal.aborted) return;
        detach();
        this.dispatchEventWith(egret.IOErrorEvent.IO_ERROR, false, String(error?.message ?? error));
      });
    }
  };
}

async function readAssetBytes(assets, path, signal) {
  const parts = [];
  let length = 0;
  for await (const part of assets.readChunks(path, signal)) {
    parts.push(part);
    length += part.byteLength;
  }
  if (parts.length === 1) {
    const part = parts[0];
    if (part.byteOffset === 0 && part.byteLength === part.buffer.byteLength) return part.buffer;
  }
  const output = new Uint8Array(length);
  let at = 0;
  for (const part of parts) { output.set(part, at); at += part.byteLength; }
  return output.buffer;
}

/** Install platform endpoints on the customer's own 5.x core, before loading EUI/RES or game scripts. */
export function installOriginal5Platform(egret, services, display, images = [], remoteRequest) {
  const entries = new Map();
  for (const image of images) {
    const path = packagedPath(image.path);
    if (path !== image.path || entries.has(path) || ![image.width, image.height].every(
      value => Number.isInteger(value) && value > 0 && value <= 4096)) {
      throw new Error('Invalid or duplicate original game image: ' + path);
    }
    entries.set(path, image);
  }
  egret.Capabilities.runtimeType = egret.RuntimeType.NATIVE;
  egret.Capabilities.isMobile = true;
  egret.Capabilities.os = 'Android';
  const store = services.storage;
  Object.assign(egret.localStorage, {
    getItem: key => store.getItem(key),
    setItem(key, value) { store.setItem(key, String(value)); return true; },
    removeItem: key => store.removeItem(key)
  });

  const Loader = makeLoader(egret, services.signal);
  egret.HttpRequest = class extends Loader {
    responseType = 'text';
    response = null;
    #headers = new Map();
    open(url, method = 'GET') {
      this.abort();
      this.#headers.clear();
      this.response = null;
      this.url = url;
      this.method = String(method).toUpperCase();
    }
    setRequestHeader(key, value) { this.#headers.set(String(key), String(value)); }
    send(body) {
      const {url, method, responseType} = this;
      const headers = Object.fromEntries(this.#headers);
      this.run(signal => {
        if (typeof url !== 'string') throw new TypeError('Call open() before send()');
        if (responseType !== 'text' && responseType !== 'arraybuffer') {
          throw new Error('Unsupported original game response type: ' + responseType);
        }
        if (/^https:\/\//i.test(url) && remoteRequest) {
          return remoteRequest({url, method, headers, body, responseType, signal});
        }
        const name = packagedPath(url);
        if (method !== 'GET' || body != null) throw new Error('Packaged game assets require GET');
        return responseType === 'arraybuffer'
          ? readAssetBytes(services.assets, name, signal)
          : services.assets.readText(name, signal);
      }, response => { this.response = response; });
    }
  };
  egret.ImageLoader = class extends Loader {
    data = null;
    load(url) {
      this.data = null;
      this.run(async signal => {
        const name = packagedPath(url);
        const entry = entries.get(name);
        if (!entry) throw new Error('Original game image is undeclared: ' + name);
        const image = await services.raster.loadPng(name, entry.width, entry.height, signal);
        signal.throwIfAborted();
        const source = await display.imageSource(image);
        if (signal.aborted) {
          display.releaseImageSource(source);
          signal.throwIfAborted();
        }
        return source;
      }, source => { this.data = new egret.BitmapData(source); }, source => display.releaseImageSource(source));
    }
  };
}
