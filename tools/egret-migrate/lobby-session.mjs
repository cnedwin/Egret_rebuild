// SPDX-License-Identifier: Apache-2.0
// The default origin belongs to the generated page. A separate local game server must be explicit.
export function socketOrigin(value) {
  if (value === undefined) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    // Report the same CLI diagnostic for a malformed URL and an unsupported origin.
  }
  if (
    !url ||
    !['http:', 'https:'].includes(url.protocol) ||
    !(url.hostname === 'localhost' || url.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(url.hostname)) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw Object.assign(new Error('Use an HTTP(S) loopback origin without credentials, path, query or fragment.'), {
      code: 'MIGRATE_SOCKET_URL'
    });
  }
  return url.origin;
}

export function bindRoomHandoff(socket, show) {
  let roomID, seats, seat;
  function reset() {
    roomID = seats = seat = undefined;
  }
  function publish() {
    if (roomID !== undefined && seats !== undefined) show({ roomID, seats, seat });
  }

  socket.on('join room', data => {
    if (data?.self === true && Number.isInteger(data.roomInfo?.roomID)) {
      reset();
      roomID = data.roomInfo.roomID;
    }
  });
  socket.on('leave room', self => {
    if (self === true) reset();
  });
  socket.on('disconnect', reset);
  socket.on('game begin', count => {
    if (roomID === undefined || !Number.isInteger(count) || count < 1) return;
    if (seats !== undefined) seat = undefined;
    seats = count;
    publish();
  });
  socket.on('set seatID', value => {
    if (roomID === undefined || !Number.isInteger(value) || value < 0) return;
    seat = value;
    publish();
  });
}

export function createLobbyRoot({ eui, RES, UI, socket, manifest, resourceRoot, group, theme, status }) {
  const message = new eui.Label();
  message.x = 32;
  message.y = 40;
  message.size = 30;
  message.textColor = 0xffffff;
  UI.sceneGame.addChild(message);

  return new (class extends eui.UILayer {
    async createChildren() {
      super.createChildren();
      await RES.loadConfig(manifest, resourceRoot + '/');
      await RES.loadGroup(group);
      const loaded = new eui.Theme(theme, this.stage);
      await new Promise(resolve => loaded.addEventListener(eui.UIEvent.COMPLETE, resolve, this));

      // Keep the original scenes in charge of list selection and room membership. Only the server starts a game.
      bindRoomHandoff(socket, ({ roomID, seats, seat }) => {
        const room = UI.sceneRoom;
        if (room.parent) {
          room.parent.addChild(UI.sceneGame);
          room.parent.removeChild(room);
        }
        const text =
          '房间 ' + roomID + ' · 对局已开始 · ' + seats + ' 人' + (seat === undefined ? '' : ' · 座位 ' + seat);
        message.text = text;
        status.textContent = text;
      });
      socket.on('connect_error', () => {
        status.className = 'connection-error';
        status.textContent = '无法连接房间服务器，请检查本机服务后刷新。';
      });
      socket.on('disconnect', () => {
        status.className = 'connection-error';
        status.textContent = '与房间服务器的连接已断开。';
      });
      this.addChild(UI.sceneLobby);
    }
  })();
}

export async function launchLobbyHost(socket, openHost) {
  let host,
    released = false;
  const release = () => {
    if (released) return;
    released = true;
    socket.removeAllListeners();
    socket.disconnect();
  };
  try {
    host = await openHost();
    if (host.scope.signal.aborted) throw new Error('The room host closed before the scene mounted.');
    host.scope.signal.addEventListener('abort', release, { once: true });
    // The legacy scenes may queue the first room-list request during mount. Connect once their handlers are ready.
    socket.connect();
    return host;
  } catch (error) {
    release();
    try {
      await host?.dispose();
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], 'Room host startup and cleanup failed.');
    }
    throw error;
  }
}
