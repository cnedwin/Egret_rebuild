// SPDX-License-Identifier: Apache-2.0
import { base64 } from '../scene/commands.mjs';

const limit = 32 * 1024;
let nextSocket = 0;

function encode(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > limit) throw new RangeError('Expected at most 32 KiB');
  return typeof bytes.toBase64 === 'function' ? bytes.toBase64() : base64(bytes);
}

function decode(text) {
  return typeof Uint8Array.fromBase64 === 'function' ? Uint8Array.fromBase64(text) : Uint8Array.from(atob(text), value => value.charCodeAt(0));
}

/** Opt-in network client. Each operation uses the authority and lifetime of the supplied project host. */
export function createPlayerNetwork(host) {
  const call = (value, signal) => host.call('network.request', value, signal);
  return Object.freeze({
    async request(url, { method = 'GET', bytes, contentType, signal } = {}) {
      const result = await call({op: 'http', url, method, body: bytes === undefined ? undefined : encode(bytes), contentType}, signal);
      return {status: result.status, bytes: decode(result.body)};
    },
    async connect(url, signal) {
      if (nextSocket === 0x7fffffff) throw new RangeError('Connection IDs exhausted');
      const id = ++nextSocket;
      try {
        await call({op:'open', id, url}, signal);
      } catch (error) {
        // The handshake may have finished just before cancellation, while its reply was still queued.
        if (signal?.aborted) await call({op:'close', id}).catch(() => {});
        throw error;
      }
      let reading = false;
      return Object.freeze({
        send(bytes, sendSignal) { return call({op:'send', id, body:encode(bytes)}, sendSignal); },
        async receive(readSignal) {
          if (reading) throw new Error('NETWORK_READ_PENDING');
          reading = true;
          try {
            const result = await call({op:'receive', id}, readSignal);
            if (result.done) return result;
            const bytes = decode(result.body);
            // The host keeps this packet until JS has actually received and decoded the reply.
            await call({op:'ack', id, sequence:result.sequence});
            return {done:false, bytes};
          } finally {
            reading = false;
          }
        },
        close() { return call({op:'close', id}); }
      });
    }
  });
}
