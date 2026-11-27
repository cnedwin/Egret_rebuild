// SPDX-License-Identifier: Apache-2.0
/** The same classic entry runs with a generated WAV on the original Web player and each migrated host. */
globalThis.SoundBoard = class SoundBoard extends egret.DisplayObjectContainer {
  constructor() {
    super();
    this.trace = [];
    globalThis.soundBoard = this;
    this.label = 'opening';
    this.addEventListener(
      egret.Event.ADDED_TO_STAGE,
      () => {
        RES.loadConfig('tracks.json', '')
          .then(() => RES.getResAsync('tone'))
          .then(sound => {
            this.track = sound;
            this.seconds = sound.length;
            this.label = 'ready';
          })
          .catch(error => {
            this.error = String(error);
          });
      },
      this
    );
  }
  play(name) {
    const channel = this.track.play(0, 1);
    channel.volume = 0.05;
    channel.addEventListener(
      egret.Event.SOUND_COMPLETE,
      event => {
        this.trace.push({ name, target: event.target === channel, type: event.type });
        this.label = 'ended';
      },
      this
    );
    this.channel = channel;
    return channel;
  }
  exercise() {
    this.label = 'playing';
    const first = this.play('stopped');
    first.stop();
    const replaced = this.play('replaced');
    this.play('natural');
    replaced.volume = 0.1;
    replaced.stop();
  }
  release() {
    this.channel?.stop();
    return RES.destroyRes('tone');
  }
};
