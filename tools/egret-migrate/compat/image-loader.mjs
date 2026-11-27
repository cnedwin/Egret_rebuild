// SPDX-License-Identifier: Apache-2.0
/** The owner controls decoded image leases. A superseded request may share its native read with RES. */
export function classicImageLoader(EventDispatcher, game, adopt, observe, checkOrigin) {
  function origin(value) {
    if (value !== null && value !== 'anonymous')
      throw new TypeError('ImageLoader supports the default and anonymous CORS modes.');
    return value;
  }
  const signal = game.scope.signal;
  return class ImageLoader extends EventDispatcher {
    static #defaultOrigin = null;
    static get crossOrigin() {
      return ImageLoader.#defaultOrigin;
    }
    static set crossOrigin(value) {
      ImageLoader.#defaultOrigin = origin(value);
    }
    #mode;
    #request;
    #data = null;
    get data() {
      return this.#data;
    }
    get crossOrigin() {
      return this.#mode ?? null;
    }
    set crossOrigin(value) {
      this.#mode = origin(value);
    }
    load(url) {
      if (signal.aborted) throw signal.reason;
      if (typeof url !== 'string' || !url || url.length > 8192) throw new TypeError('Expected an image URL.');
      this.close();
      const mode = this.#mode === undefined ? ImageLoader.crossOrigin : this.#mode;
      const token = {};
      this.#request = token;
      this.#data = null;
      const active = () => this.#request === token && !signal.aborted;
      observe(
        Promise.resolve().then(async () => {
          if (!active()) return;
          let lease;
          try {
            checkOrigin?.(url, mode);
            lease = await game.loadTexture(url);
            if (!active()) {
              lease.release();
              return;
            }
            this.#data = adopt(lease);
          } catch (error) {
            if (!active()) return;
            lease?.release();
            this.#request = undefined;
            if (this.hasEventListener('ioError')) this.dispatchEventWith('ioError');
            else throw error;
            return;
          }
          this.#request = undefined;
          this.dispatchEventWith('complete');
        })
      );
    }
    close() {
      this.#request = undefined;
    }
  };
}
