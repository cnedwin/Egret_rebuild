// Positional sound with a pitch that follows a playing voice, and buffers made from samples: from the notes of Tea
// Horse Road, whose engine note followed the truck's speed. Web Audio is played by a small stand-in here.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudioListener3D, createPositionalAudio3D } from '@egret/engine/webgl2/world3d';

class Param {
  constructor(value) {
    this.value = value;
    this.events = [];
  }
  setValueAtTime(value, at) {
    this.value = value;
    this.events.push(['set', value, at]);
  }
  linearRampToValueAtTime(value, at) {
    this.events.push(['ramp', value, at]);
  }
  cancelScheduledValues(at) {
    this.events.push(['cancel', at]);
  }
}
const node = extra => ({ connect() {}, disconnect() {}, ...extra });
function fakeContext() {
  return {
    currentTime: 2,
    sampleRate: 48000,
    destination: node(),
    listener: {},
    createGain: () => node({ gain: new Param(1) }),
    createPanner: () =>
      node({
        positionX: new Param(0),
        positionY: new Param(0),
        positionZ: new Param(0),
        orientationX: new Param(0),
        orientationY: new Param(0),
        orientationZ: new Param(-1)
      }),
    createBufferSource: () =>
      node({ playbackRate: new Param(1), start() {}, stop() {}, onended: null, buffer: null, loop: false }),
    createBuffer(channels, length, rate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: index => data[index] };
    }
  };
}

test('SN01 setting playbackRate changes the voices playing now, at once or gliding, and those to come', () => {
  const listener = createAudioListener3D({ context: fakeContext() });
  const engine = createPositionalAudio3D(listener, { loop: true, spatial: false, buffer: {} });
  const voice = engine.play();
  assert.equal(voice.playbackRate.value, 1);
  engine.playbackRate = 1.5;
  assert.equal(voice.playbackRate.value, 1.5, 'the playing voice follows');
  engine.setPlaybackRate(2, 0.25);
  assert.deepEqual(voice.playbackRate.events.at(-1), ['ramp', 2, 2.25]);
  assert.equal(engine.playbackRate, 2);
  const next = engine.play();
  assert.equal(next.playbackRate.value, 2, 'a voice to come starts at the new rate');
  for (const bad of [0, -1, 20, Number.NaN, '2'])
    assert.throws(
      () => (engine.playbackRate = bad),
      error => error.code === 'WORLD3D_INPUT_INVALID'
    );
  assert.throws(
    () => engine.setPlaybackRate(1, -1),
    error => error.code === 'WORLD3D_INPUT_INVALID'
  );
});

test('SN02 a buffer is made from samples, mono or by channel, clamped to -1..1', () => {
  const listener = createAudioListener3D({ context: fakeContext() });
  const mono = listener.bufferFrom(new Float32Array([0, 0.5, 2, -3]));
  assert.equal(mono.numberOfChannels, 1);
  assert.equal(mono.sampleRate, 48000);
  assert.deepEqual([...mono.getChannelData(0)], [0, 0.5, 1, -1]);
  const stereo = listener.bufferFrom(
    [
      [0.1, 0.2],
      [0.3, 0.4]
    ],
    22050
  );
  assert.equal(stereo.numberOfChannels, 2);
  assert.equal(stereo.sampleRate, 22050);
  assert.ok(Math.abs(stereo.getChannelData(1)[1] - 0.4) < 1e-6);
  for (const bad of [[], [[0.1], [0.1, 0.2]], new Float32Array(0)])
    assert.throws(
      () => listener.bufferFrom(bad),
      error => error.code === 'WORLD3D_INPUT_INVALID'
    );
  assert.throws(
    () => listener.bufferFrom([0], 10),
    error => error.code === 'WORLD3D_INPUT_INVALID'
  );
  const sound = createPositionalAudio3D(listener, { buffer: mono });
  assert.equal(sound.buffer, mono);
});
