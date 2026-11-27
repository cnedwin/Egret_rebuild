// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { bindRoomHandoff, launchLobbyHost, socketOrigin } from '../tools/egret-migrate/lobby-session.mjs';

import { bindTableChoices } from '../tools/egret-migrate/table-session.mjs';

test('both match boundaries drop all active table pickers and their hand page', () => {
  const socket = new EventEmitter();
  const scene = {};
  const choices = bindTableChoices(socket, scene);
  for (const boundary of ['game end', 'game begin']) {
    choices.privateWindow = { cards: [1] };
    choices.globalWindow = scene.globalCardSelectorWindow = { cards: [2] };
    choices.page = 1;
    socket.emit(boundary);
    assert.equal(choices.privateWindow, undefined);
    assert.equal(choices.globalWindow, undefined);
    assert.equal(scene.globalCardSelectorWindow, undefined);
    assert.equal(choices.page, 0);
  }
});

test('the optional room server is an HTTP(S) loopback origin without user data', () => {
  assert.equal(socketOrigin(undefined), null);
  assert.equal(socketOrigin('http://127.0.0.1:45123/'), 'http://127.0.0.1:45123');
  assert.equal(socketOrigin('https://[::1]:8443'), 'https://[::1]:8443');
  for (const value of [
    'https://example.org',
    'ws://localhost',
    'http://user@localhost',
    'http://localhost/room',
    'http://localhost/?token=x',
    'http://localhost/#x',
    'bad'
  ]) {
    assert.throws(() => socketOrigin(value), { code: 'MIGRATE_SOCKET_URL' });
  }
});

test('the room handoff requires the server to acknowledge this room and begin this match', () => {
  const socket = new EventEmitter(),
    seen = [];
  bindRoomHandoff(socket, value => seen.push(value));
  socket.emit('join room', { self: false });
  socket.emit('game begin', 2);
  assert.deepEqual(seen, []);
  socket.emit('join room', { self: true, roomInfo: { roomID: 7319 } });
  socket.emit('set seatID', 0);
  assert.deepEqual(seen, []);
  socket.emit('game begin', 2);
  assert.deepEqual(seen, [{ roomID: 7319, seats: 2, seat: 0 }]);
  socket.emit('leave room', true);
  socket.emit('set seatID', 1);
  socket.emit('game begin', 2);
  assert.equal(seen.length, 1);
  socket.emit('join room', { self: true, roomInfo: { roomID: 8194 } });
  socket.emit('game begin', 2);
  socket.emit('set seatID', 1);
  assert.deepEqual(seen.slice(1), [
    { roomID: 8194, seats: 2, seat: undefined },
    { roomID: 8194, seats: 2, seat: 1 }
  ]);
});

test('the socket opens after the host mounts and listeners are released on disposal or failed startup', async () => {
  const events = [],
    scope = new AbortController(),
    socket = new EventEmitter();
  socket.connect = () => events.push('connect');
  socket.disconnect = () => events.push('disconnect');
  socket.on('join room', () => {});
  const host = { scope, dispose: () => scope.abort() };
  assert.equal(
    await launchLobbyHost(socket, async () => {
      events.push('mounted');
      return host;
    }),
    host
  );
  await host.dispose();
  assert.deepEqual(events, ['mounted', 'connect', 'disconnect']);
  assert.equal(socket.listenerCount('join room'), 0);
  socket.on('room list', () => {});
  await assert.rejects(
    launchLobbyHost(socket, async () => {
      throw new Error('bad theme');
    }),
    /bad theme/
  );
  assert.equal(socket.listenerCount('room list'), 0);
  assert.deepEqual(events.slice(3), ['disconnect']);
});
