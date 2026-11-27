// SPDX-License-Identifier: Apache-2.0
import { ByteArray } from './protocol.mjs';

const textMode = 'webSocketTypeString',
  binaryMode = 'webSocketTypeBinary';
const packetLimit = 16 * 1024 * 1024;
function unsupported(message) {
  return Object.assign(new Error(message), { code: 'LEGACY_TRANSPORT_UNSUPPORTED' });
}

/** An injected browser window owns XHR and WebSocket policy, cookies, origins and TLS. */
export function browserTransport(view) {
  return {
    request(options, events) {
      const xhr = new view.XMLHttpRequest();
      xhr.open(options.method, options.url, true);
      xhr.responseType = options.type;
      xhr.timeout = options.timeout;
      xhr.withCredentials = options.credentials;
      for (const [key, value] of options.headers) xhr.setRequestHeader(key, value);
      xhr.onprogress = event => {
        if (event.lengthComputable) events.progress(event.loaded, event.total);
      };
      const detach = () => {
        xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onprogress = null;
      };
      xhr.onerror = xhr.ontimeout = () => {
        detach();
        events.end(false);
      };
      xhr.onload = () => {
        detach();
        events.end(xhr.status < 400, xhr.response, xhr);
      };
      xhr.send(options.body);
      return () => {
        detach();
        xhr.abort();
      };
    },
    socket(url, type, events) {
      const channel = new view.WebSocket(url);
      channel.binaryType = 'arraybuffer';
      channel.onopen = () => events.open();
      channel.onmessage = event => events.data(event.data);
      channel.onerror = () => events.error();
      channel.onclose = () => events.end();
      return {
        send: value => channel.send(value),
        close() {
          channel.onopen = channel.onmessage = channel.onerror = channel.onclose = null;
          channel.close();
        }
      };
    }
  };
}

/** The same public classes run on both engine hosts. Request identity prevents stale events after reuse. */
export function createLegacyTransport({ EventDispatcher, LegacyEvent, signal, port, channel, report }) {
  const active = new Set(),
    subscriptions = new Map();
  function ensure() {
    if (signal.aborted) throw signal.reason;
  }
  function track(cancel) {
    ensure();
    active.add(cancel);
  }
  signal.addEventListener(
    'abort',
    () => {
      const cleanups = [...active];
      active.clear();
      for (const record of subscriptions.values()) {
        record.listener = undefined;
        if (record.remove) cleanups.push(record.remove);
      }
      subscriptions.clear();
      const errors = [];
      for (const cleanup of cleanups) {
        try {
          cleanup();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) report(new AggregateError(errors, 'Could not close every legacy transport cleanly.'));
    },
    { once: true }
  );

  class ProgressEvent extends LegacyEvent {
    static PROGRESS = 'progress';
    static SOCKET_DATA = 'socketData';
    constructor(type, bubbles = false, cancelable = false, bytesLoaded = 0, bytesTotal = 0) {
      super(type, bubbles, cancelable);
      this.bytesLoaded = bytesLoaded;
      this.bytesTotal = bytesTotal;
    }
    static dispatchProgressEvent(target, type, loaded = 0, total = 0) {
      return target.dispatchEvent(new ProgressEvent(type, false, false, loaded, total));
    }
  }
  class IOErrorEvent extends LegacyEvent {
    static IO_ERROR = 'ioError';
    static dispatchIOErrorEvent(target) {
      return target.dispatchEvent(new IOErrorEvent(IOErrorEvent.IO_ERROR));
    }
  }
  class HttpRequest extends EventDispatcher {
    responseType = 'text';
    timeout = 0;
    withCredentials = false;
    #value = null;
    #url;
    #method;
    #headers = new Map();
    #reply;
    #pending;
    get response() {
      return this.#value;
    }
    open(url, method = 'GET') {
      ensure();
      this.abort();
      this.#url = url;
      this.#method = method;
      this.#value = null;
      this.#reply = undefined;
    }
    setRequestHeader(name, value) {
      this.#headers.set(String(name), String(value));
    }
    getAllResponseHeaders() {
      return this.#reply ? (this.#reply.getAllResponseHeaders() ?? '') : null;
    }
    getResponseHeader(name) {
      return this.#reply ? (this.#reply.getResponseHeader(name) ?? '') : null;
    }
    abort() {
      this.#pending?.();
    }
    send(body = null) {
      ensure();
      if (this.#url === undefined || this.#pending) throw new Error('Open an idle HttpRequest before sending.');
      if (!port) throw unsupported('This host has no HTTP service.');
      const token = { stop: undefined, cancelled: false };
      const cancel = () => {
        if (this.#pending !== cancel) return;
        this.#pending = undefined;
        active.delete(cancel);
        token.cancelled = true;
        token.stop?.();
      };
      track(cancel);
      this.#pending = cancel;
      const events = {
        progress: (loaded, total) => {
          if (this.#pending === cancel) ProgressEvent.dispatchProgressEvent(this, 'progress', loaded, total);
        },
        end: (ok, value, reply) => {
          if (this.#pending !== cancel) return;
          this.#pending = undefined;
          active.delete(cancel);
          this.#value = value ?? null;
          this.#reply = reply;
          if (ok) this.dispatchEventWith('complete');
          else IOErrorEvent.dispatchIOErrorEvent(this);
        }
      };
      try {
        token.stop = port.request(
          {
            url: this.#url,
            method: this.#method,
            type: this.responseType,
            timeout: this.timeout,
            credentials: this.withCredentials,
            headers: new Map(this.#headers),
            body
          },
          events
        );
        if (token.cancelled) token.stop?.();
      } catch (error) {
        cancel();
        throw error;
      }
    }
  }

  class WebSocket extends EventDispatcher {
    static TYPE_STRING = textMode;
    static TYPE_BINARY = binaryMode;
    #type = textMode;
    #active;
    #connected = false;
    #text = '';
    #input = new ByteArray();
    get connected() {
      return this.#connected;
    }
    get type() {
      return this.#type;
    }
    set type(value) {
      if (value !== textMode && value !== binaryMode) throw unsupported('Unknown legacy socket mode.');
      if (this.#active && value !== this.#type) throw unsupported('Select a socket mode before connecting.');
      this.#type = value;
    }
    connect(host, number) {
      const url = port?.socketUrl?.(host, number) ?? 'ws://' + host + ':' + number;
      this.connectByUrl(url);
    }
    connectByUrl(url) {
      ensure();
      if (this.#active) return;
      if (!port) throw unsupported('This host has no WebSocket service.');
      const record = { channel: undefined };
      const retire = () => {
        if (this.#active !== record) return;
        this.#active = undefined;
        this.#connected = false;
        active.delete(retire);
        this.#text = '';
        this.#input.clear();
        record.channel?.close();
      };
      const fail = () => {
        if (this.#active === record) IOErrorEvent.dispatchIOErrorEvent(this);
      };
      record.retire = retire;
      this.#active = record;
      track(retire);
      try {
        const events = {
          open: () => {
            if (this.#active === record) {
              this.#connected = true;
              this.dispatchEventWith('connect');
            }
          },
          data: value => {
            if (this.#active !== record) return;
            try {
              if (typeof value === 'string' && this.type === textMode) {
                if (this.#text.length + value.length > packetLimit)
                  throw new RangeError('Socket text exceeds the receive budget');
                this.#text += value;
              } else if (this.type === binaryMode && (value instanceof ArrayBuffer || value instanceof Uint8Array)) {
                if (this.#input.length + value.byteLength > packetLimit)
                  throw new RangeError('Socket packet exceeds the receive budget');
                this.#input.position = this.#input.length;
                this.#input.writeBytes(new ByteArray(value));
              } else throw unsupported('Unexpected socket frame type.');
            } catch {
              try {
                fail();
              } finally {
                if (this.#active === record) this.close();
              }
              return;
            }
            ProgressEvent.dispatchProgressEvent(this, 'socketData');
          },
          error: fail,
          end: () => {
            if (this.#active === record) {
              retire();
              this.dispatchEventWith('close');
            }
          }
        };
        // An embedded port may hand back events before returning its channel.
        const pending = [];
        const guarded = Object.fromEntries(
          Object.entries(events).map(([name, dispatch]) => [
            name,
            (...args) => (record.channel ? dispatch(...args) : pending.push([dispatch, args]))
          ])
        );
        record.channel = port.socket(url, this.#type, guarded);
        if (this.#active !== record) record.channel.close();
        else for (const [dispatch, args] of pending) dispatch(...args);
      } catch (error) {
        retire();
        throw error;
      }
    }
    close() {
      if (!this.#active) return;
      this.#active.retire();
      if (!signal.aborted) this.dispatchEventWith('close');
    }
    flush() {} // Each write queues a complete message, as in the classic 5.3 transport.
    writeUTF(text) {
      if (!this.#connected) return;
      if (this.type === textMode) this.#active.channel.send(text);
      else {
        const bytes = new ByteArray();
        bytes.writeUTF(text);
        this.#active.channel.send(bytes.buffer);
      }
    }
    writeBytes(bytes, offset = 0, length = 0) {
      if (!this.#connected) return;
      if (this.type !== binaryMode) throw unsupported('writeBytes requires TYPE_BINARY.');
      const out = new ByteArray();
      out.writeBytes(bytes, offset, length);
      this.#active.channel.send(out.buffer);
    }
    readBytes(bytes, offset = 0, length = 0) {
      if (this.type !== binaryMode) throw unsupported('readBytes requires TYPE_BINARY.');
      this.#input.position = 0;
      this.#input.readBytes(bytes, offset, length);
      this.#input.clear();
    }
    readUTF() {
      if (this.type === textMode) {
        const text = this.#text;
        this.#text = '';
        return text;
      }
      this.#input.position = 0;
      const text = this.#input.readUTF();
      this.#input.clear();
      return text;
    }
  }

  const ExternalInterface = Object.freeze({
    call(name, value) {
      ensure();
      if (!channel) throw unsupported('The project has not installed an ExternalInterface channel.');
      const pending = channel.call(name, value, signal, (target, data) => {
        if (!signal.aborted) subscriptions.get(target)?.listener?.(data);
      });
      if (pending?.then)
        void pending.catch(error => {
          if (!signal.aborted) report(error);
        });
    },
    addCallback(name, listener) {
      ensure();
      if (!channel || typeof name !== 'string' || !name || typeof listener !== 'function')
        throw unsupported('Expected a channel callback and a registered external host.');
      const record = subscriptions.get(name);
      if (record) {
        record.listener = listener;
        return;
      }
      const next = { listener, remove: undefined };
      subscriptions.set(name, next);
      try {
        next.remove = channel.subscribe?.(name, value => {
          if (!signal.aborted) next.listener?.(value);
        });
        if (signal.aborted) next.remove?.();
      } catch (error) {
        subscriptions.delete(name);
        throw error;
      }
    }
  });
  return {
    HttpRequest,
    HttpMethod: Object.freeze({ GET: 'GET', POST: 'POST' }),
    HttpResponseType: Object.freeze({ TEXT: 'text', ARRAY_BUFFER: 'arraybuffer' }),
    WebSocket,
    ProgressEvent,
    IOErrorEvent,
    ExternalInterface
  };
}
