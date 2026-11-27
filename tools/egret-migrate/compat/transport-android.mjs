// SPDX-License-Identifier: Apache-2.0
import { ByteArray } from './protocol.mjs';

function unsupported(message) {
  throw Object.assign(new Error(message), { code: 'LEGACY_TRANSPORT_UNSUPPORTED' });
}

// A bare cropped V8 may not have TextEncoder/TextDecoder. Preserve embedded NULs in HTTP text.
function text(bytes) {
  if (typeof TextDecoder === 'function') return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const encoded = Array.from(bytes, value => '%' + value.toString(16).padStart(2, '0')).join('');
  return decodeURIComponent(encoded).replace(/^\uFEFF/, '');
}

function bodyBytes(value) {
  if (value == null) return undefined;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') {
    const packet = new ByteArray();
    packet.writeUTFBytes(value);
    return new Uint8Array(packet.buffer);
  }
  unsupported('The Android HTTP adapter accepts UTF-8 text and bytes.');
}

/** Inject createPlayerNetwork(services.host). APK permissions, trust and exact origins remain with the SDK. */
export function androidTransport(network) {
  if (!network) return undefined;
  return {
    request(options, events) {
      const method = options.method.toUpperCase();
      if (
        !['GET', 'POST'].includes(method) ||
        !['text', 'arraybuffer'].includes(options.type) ||
        options.credentials ||
        !Number.isSafeInteger(options.timeout) ||
        options.timeout < 0
      )
        unsupported('Android HTTP supports GET/POST and text/arraybuffer without browser cookies.');
      let contentType;
      for (const [key, value] of options.headers) {
        if (key.toLowerCase() !== 'content-type') unsupported('Unsupported Android request header: ' + key);
        contentType = value;
      }
      const bytes = bodyBytes(options.body);
      if (method === 'GET' && bytes !== undefined) unsupported('Android GET cannot carry request data.');
      const controller = new AbortController();
      const timer =
        options.timeout > 0
          ? setTimeout(() => controller.abort(new Error('HTTP timeout')), options.timeout)
          : undefined;
      const headers = {
        getResponseHeader() {
          return unsupported('The Android bridge does not expose HTTP response headers.');
        },
        getAllResponseHeaders() {
          return unsupported('The Android bridge does not expose HTTP response headers.');
        }
      };
      Promise.resolve()
        .then(() => {
          if (controller.signal.aborted) throw controller.signal.reason;
          return network.request(options.url, { method, bytes, contentType, signal: controller.signal });
        })
        .then(result => ({
          ok: result.status > 0 && result.status < 400,
          data: options.type === 'text' ? text(result.bytes) : result.bytes.slice().buffer
        }))
        .then(
          result => {
            clearTimeout(timer);
            events.end(result.ok, result.data, headers);
          },
          () => {
            clearTimeout(timer);
            events.end(false);
          }
        );
      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    },
    // The native provider accepts only allowlisted TLS origins, including the classic host/port overload.
    socketUrl(host, port) {
      return 'wss://' + host + ':' + port;
    },
    socket(url, type, events) {
      if (type !== 'webSocketTypeBinary')
        unsupported('The Android socket accepts binary WSS frames. Set TYPE_BINARY before connecting.');
      if (typeof url !== 'string' || !url.startsWith('wss://'))
        unsupported('Pass the allowed wss:// origin to connectByUrl.');
      const controller = new AbortController();
      let peer,
        queued = 0,
        sending = Promise.resolve();
      function finish(error) {
        if (controller.signal.aborted) return;
        try {
          if (error) events.error();
        } finally {
          events.end();
        }
      }
      Promise.resolve()
        .then(() => {
          if (controller.signal.aborted) throw controller.signal.reason;
          return network.connect(url, controller.signal);
        })
        .then(async connection => {
          peer = connection;
          if (controller.signal.aborted) {
            await peer.close();
            return;
          }
          events.open();
          while (!controller.signal.aborted) {
            const frame = await peer.receive(controller.signal);
            if (controller.signal.aborted) return;
            if (frame.done) {
              finish(false);
              return;
            }
            events.data(frame.bytes);
          }
        })
        .catch(() => finish(true));
      return {
        send(buffer) {
          if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > 32768 || queued >= 8)
            unsupported('Android socket send queue is full or the packet exceeds 32 KiB.');
          const bytes = new Uint8Array(buffer);
          queued++;
          sending = sending
            .then(async () => {
              if (!controller.signal.aborted) await peer.send(bytes, controller.signal);
            })
            .catch(() => finish(true))
            .finally(() => {
              queued--;
            });
        },
        close() {
          controller.abort();
          if (peer) void peer.close().catch(() => {});
        }
      };
    }
  };
}

/** A project explicitly maps legacy outbound calls to native actions and reply names. */
export function androidChannel(host, routes) {
  if (routes === undefined) return undefined;
  const mapped = new Map();
  for (const [name, route] of Object.entries(routes)) {
    if (
      !name ||
      !route ||
      !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(route.action) ||
      typeof route.action !== 'string' ||
      route.action.startsWith('egret.') ||
      route.action === 'network.request' ||
      (route.callback !== undefined && (typeof route.callback !== 'string' || !route.callback))
    )
      unsupported('Invalid SDK channel action mapping.');
    mapped.set(name, { action: route.action, callback: route.callback });
  }
  return {
    async call(name, value, signal, dispatch) {
      const route = mapped.get(name);
      if (!route) unsupported('Unmapped legacy channel call: ' + name);
      if (typeof value !== 'string') unsupported('Classic channel payloads must be strings.');
      const reply = await host.call(route.action, value, signal);
      if (signal.aborted || !route.callback) return;
      if (typeof reply !== 'string') unsupported('The native channel must return the original callback string.');
      dispatch(route.callback, reply);
    }
  };
}
