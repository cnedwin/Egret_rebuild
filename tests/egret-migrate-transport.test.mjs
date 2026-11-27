// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLegacyTransport } from '../tools/egret-migrate/compat/transport.mjs';
import { androidChannel, androidTransport } from '../tools/egret-migrate/compat/transport-android.mjs';
import { ByteArray } from '../tools/egret-migrate/compat/protocol.mjs';

class Event {
  constructor(type) {
    this.type = type;
  }
}
class Dispatcher {
  listeners = new Map();
  addEventListener(name, fn) {
    this.listeners.set(name, fn);
  }
  dispatchEvent(event) {
    this.listeners.get(event.type)?.(event);
    return true;
  }
  dispatchEventWith(type) {
    return this.dispatchEvent(new Event(type));
  }
}
const turn = () => new Promise(resolve => setImmediate(resolve));
function fixture(port, channel) {
  const lifetime = new AbortController(),
    errors = [];
  const api = createLegacyTransport({
    EventDispatcher: Dispatcher,
    LegacyEvent: Event,
    port,
    channel,
    signal: lifetime.signal,
    report: e => errors.push(e)
  });
  return { api, lifetime, errors };
}
function defer() {
  let resolve, reject;
  const result = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { result, resolve, reject };
}

test('HTTP open, abort, reuse and teardown suppress stale responses and preserve exact request bytes', async () => {
  const active = [];
  const port = androidTransport({
    request(url, options) {
      const task = defer();
      active.push({ url, options, ...task });
      return task.result;
    }
  });
  const { api, lifetime } = fixture(port);
  const http = new api.HttpRequest(),
    events = [];
  for (const n of ['complete', 'ioError', 'progress']) http.addEventListener(n, () => events.push(n));
  http.open('https://example.test/first', 'POST');
  http.send('起航');
  await turn();
  assert.deepEqual([...active[0].options.bytes], [232, 181, 183, 232, 136, 170]);
  http.open('https://example.test/next');
  http.responseType = api.HttpResponseType.ARRAY_BUFFER;
  http.send();
  await turn();
  assert(active[0].options.signal.aborted);
  active[0].resolve({ status: 200, bytes: new Uint8Array([7]) });
  active[1].resolve({ status: 200, bytes: new Uint8Array([0, 128, 255]) });
  await turn();
  assert.deepEqual(events, ['complete']);
  assert.deepEqual([...new Uint8Array(http.response)], [0, 128, 255]);
  assert.throws(() => http.getResponseHeader('X-Trace'), { code: 'LEGACY_TRANSPORT_UNSUPPORTED' });
  http.open('https://example.test/missing');
  http.responseType = 'text';
  http.send();
  await turn();
  active[2].resolve({ status: 404, bytes: new Uint8Array([65, 0, 66]) });
  await turn();
  assert.equal(http.response, 'A\0B');
  assert.deepEqual(events, ['complete', 'ioError']);
  http.open('https://example.test/closed');
  http.send();
  await turn();
  lifetime.abort();
  assert(active[3].options.signal.aborted);
  active[3].resolve({ status: 200, bytes: new Uint8Array() });
  await turn();
  assert.deepEqual(events, ['complete', 'ioError']);
});

test('binary WSS preserves offsets, UTF frame boundaries and reconnection; a closed session ignores late packets', async () => {
  const peers = [];
  const port = androidTransport({
    async connect(url, signal) {
      const p = {
        url,
        signal,
        sent: [],
        reads: [],
        closed: 0,
        async send(bytes) {
          this.sent.push(bytes.slice());
        },
        receive() {
          const r = defer();
          this.reads.push(r);
          return r.result;
        },
        async close() {
          this.closed++;
        }
      };
      peers.push(p);
      return p;
    }
  });
  const { api, lifetime } = fixture(port);
  const s = new api.WebSocket(),
    events = [],
    received = [];
  assert.throws(() => s.connectByUrl('wss://example.test'), { code: 'LEGACY_TRANSPORT_UNSUPPORTED' });
  s.type = api.WebSocket.TYPE_BINARY;
  s.addEventListener('connect', () => events.push('open'));
  s.addEventListener('close', () => events.push('close'));
  s.addEventListener('ioError', () => events.push('error'));
  s.addEventListener(api.ProgressEvent.SOCKET_DATA, event => {
    const packet = new ByteArray();
    s.readBytes(packet, 2);
    received.push([...new Uint8Array(packet.buffer)]);
    assert.equal(event.bytesLoaded, 0);
  });
  s.connectByUrl('wss://example.test/game');
  await turn();
  const first = peers[0];
  const packet = new ByteArray(new Uint8Array([9, 0, 255, 7]));
  s.writeBytes(packet, 1, 2);
  s.writeUTF('云');
  await turn();
  assert.deepEqual(
    first.sent.map(a => [...a]),
    [
      [0, 255],
      [0, 3, 228, 186, 145]
    ]
  );
  first.reads[0].resolve({ done: false, bytes: new Uint8Array([128, 0, 255]) });
  await turn();
  assert.deepEqual(received, [[0, 0, 128, 0, 255]]);
  s.close();
  assert.equal(first.closed, 1);
  s.connectByUrl('wss://example.test/game');
  await turn();
  first.reads[1].resolve({ done: false, bytes: new Uint8Array([77]) });
  await turn();
  assert.deepEqual(events, ['open', 'close', 'open']);
  assert.equal(received.length, 1);
  lifetime.abort();
  peers[1].reads[0].resolve({ done: false, bytes: new Uint8Array([8]) });
  await turn();
  assert.equal(peers[1].closed, 1);
  assert.deepEqual(events, ['open', 'close', 'open']);
  assert.equal(received.length, 1);
});

test('mapped channel replies use the registered legacy callback and cannot survive view close', async () => {
  const calls = [];
  const channel = androidChannel(
    {
      call(action, value, signal) {
        const task = defer();
        calls.push({ action, value, signal, ...task });
        return task.result;
      }
    },
    { login: { action: 'channel.login', callback: 'loginResult' } }
  );
  const { api, lifetime, errors } = fixture(undefined, channel);
  const result = [];
  api.ExternalInterface.addCallback('loginResult', s => result.push(s));
  api.ExternalInterface.call('login', '开始');
  assert.equal(calls[0].action, 'channel.login');
  assert.equal(calls[0].value, '开始');
  calls[0].resolve('完成');
  await turn();
  assert.deepEqual(result, ['完成']);
  api.ExternalInterface.call('unknown', '');
  await turn();
  assert.equal(errors[0].code, 'LEGACY_TRANSPORT_UNSUPPORTED');
  api.ExternalInterface.call('login', 'late');
  lifetime.abort();
  calls[1].resolve('later');
  await turn();
  assert.deepEqual(result, ['完成']);
  assert.equal(calls[1].signal.aborted, true);
});

test('close before native dispatch allocates nothing; host overload uses WSS; synchronous callback registration cleans up', async () => {
  let io = 0,
    subscriptions = 0,
    unsubscribed = 0;
  const network = {
    async request() {
      io++;
    },
    async connect() {
      io++;
    }
  };
  let lifetime;
  const channel = {
    subscribe() {
      subscriptions++;
      lifetime.abort();
      return () => unsubscribed++;
    }
  };
  const f = fixture(androidTransport(network), channel);
  lifetime = f.lifetime;
  const http = new f.api.HttpRequest();
  http.open('https://example.test');
  http.send();
  const s = new f.api.WebSocket();
  s.type = f.api.WebSocket.TYPE_BINARY;
  s.connect('example.test', 443);
  f.api.ExternalInterface.addCallback('reply', () => {});
  await turn();
  assert.equal(io, 0);
  assert.equal(subscriptions, 1);
  assert.equal(unsubscribed, 1);
  assert.equal(androidTransport(network).socketUrl('example.test', 443), 'wss://example.test:443');
});

test('an embedded transport can deliver a synchronous handshake and report an identifiable IO error', () => {
  const sent = [];
  const port = {
    socket(_url, _mode, events) {
      events.open();
      return { send: value => sent.push(value), close() {} };
    },
    request(_options, events) {
      events.end(false);
      return () => {};
    }
  };
  const { api, lifetime } = fixture(port);
  const peer = new api.WebSocket();
  peer.addEventListener('connect', () => peer.writeUTF('ready'));
  peer.connect('example.test', 80);
  assert.deepEqual(sent, ['ready']);
  const request = new api.HttpRequest();
  let error;
  request.addEventListener('ioError', event => {
    error = event;
  });
  request.open('https://example.test');
  request.send();
  assert(error instanceof api.IOErrorEvent);
  lifetime.abort();
});

test('teardown retires every channel and socket even when a vendor cleanup throws', () => {
  const callbacks = new Map(),
    removed = [],
    delivered = [];
  const channel = {
    subscribe(name, fn) {
      callbacks.set(name, fn);
      return () => {
        removed.push(name);
        if (name === 'one') throw new Error('SDK cleanup');
      };
    }
  };
  const port = {
    socket() {
      return {
        close() {
          throw new Error('native socket cleanup');
        }
      };
    }
  };
  const { api, lifetime, errors } = fixture(port, channel);
  for (const name of ['one', 'two']) api.ExternalInterface.addCallback(name, value => delivered.push(value));
  const socket = new api.WebSocket();
  socket.connectByUrl('ws://example.test');
  lifetime.abort();
  for (const fn of callbacks.values()) fn('late');
  assert.deepEqual(delivered, []);
  assert.deepEqual(removed, ['one', 'two']);
  assert.equal(socket.connected, false);
  assert.equal(errors[0].errors.length, 2);
});
