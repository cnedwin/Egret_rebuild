// SPDX-License-Identifier: Apache-2.0
// Both hosts load this same classic entry. Their test bootstrap owns the local endpoint and result sink.
globalThis.ClassicTransportProbe = class ClassicTransportProbe extends egret.DisplayObjectContainer {
  constructor() {
    super();
    this.exercise().then(globalThis.reportClassicTransport,
      error => globalThis.reportClassicTransport({ error: String(error) }));
  }
  async exercise() {
    const { http, socket } = globalThis.classicTestEndpoints;
    const data = new egret.ByteArray();
    data.endian = egret.Endian.LITTLE_ENDIAN;
    data.writeUnsignedShort(0x0702);
    data.writeUTF('起航');
    data.writeByte(255);
    data.writeByte(0);
    function check(bytes) {
      const input = new egret.ByteArray(bytes);
      input.endian = egret.Endian.LITTLE_ENDIAN;
      if (input.readUnsignedShort() !== 0x0702 || input.readUTF() !== '起航' ||
          input.readUnsignedByte() !== 255 || input.readUnsignedByte() !== 0 || input.readAvailable !== 0)
        throw new Error('Invalid echoed packet');
      return [...new Uint8Array(bytes)];
    }
    const httpPacket = await new Promise((resolve, reject) => {
      const request = new egret.HttpRequest();
      request.responseType = egret.HttpResponseType.ARRAY_BUFFER;
      request.addEventListener(egret.Event.COMPLETE, () => {
        try { resolve(check(request.response)); } catch (error) { reject(error); }
      }, this);
      request.addEventListener(egret.IOErrorEvent.IO_ERROR, () => reject(new Error('HTTP failed')), this);
      request.open(http, egret.HttpMethod.POST);
      request.setRequestHeader('Content-Type', 'application/octet-stream');
      request.send(data.buffer);
    });
    const connections = [], frames = [];
    for (let round = 0; round < 2; round++) {
      const peer = new egret.WebSocket();
      peer.type = egret.WebSocket.TYPE_BINARY;
      const receive = new Promise((resolve, reject) => {
        peer.addEventListener(egret.Event.CONNECT, () => { connections.push('open'); peer.writeBytes(data); }, this);
        peer.addEventListener(egret.Event.CLOSE, () => connections.push('close'), this);
        peer.addEventListener(egret.IOErrorEvent.IO_ERROR, () => reject(new Error('Socket failed')), this);
        peer.addEventListener(egret.ProgressEvent.SOCKET_DATA, () => {
          try {
            const incoming = new egret.ByteArray();
            peer.readBytes(incoming);
            resolve(check(incoming.buffer));
          } catch (error) { reject(error); }
        }, this);
      });
      peer.connectByUrl(socket);
      frames.push(await receive);
      // Keep the second connection until game/view disposal.
      if (round === 0) peer.close();
    }
    const channel = await new Promise(resolve => {
      egret.ExternalInterface.addCallback('echoed', resolve);
      egret.ExternalInterface.call('echo', '启航 / 42');
    });
    return { finished: true, httpPacket, frames, connections, channel };
  }
};
