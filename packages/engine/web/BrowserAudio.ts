// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import { createAudioMixer } from '@egret/engine/audio';
import type { AudioBackend, AudioBackendBus, AudioBackendSound, AudioBackendStart, AudioBackendVoice, AudioMixer, AudioMixerOptions } from '@egret/engine/audio';

export interface BrowserAudioOptions extends Omit<AudioMixerOptions, 'backend' | 'locked'> {
  /** An output the page made. It is used as it is and is not closed with the mixer. Without it one is made. */
  readonly context?: BaseAudioContext;
  /** Where the first touch or key of the person is listened for. Defaults to the document. */
  readonly unlockTarget?: EventTarget;
  /** Silence while the page is hidden. Defaults to true. */
  readonly pauseWhenHidden?: boolean;
  /**
   * Told what failed where nothing could be returned: in a listener of the page, or after the
   * output was asked to start or stop. Without it the failure is reported to the page.
   */
  readonly onError?: (cause: unknown) => void;
}
export interface BrowserAudio {
  readonly mixer: AudioMixer;
  readonly context: BaseAudioContext;
  /** What every sound passes on its way out. An analyser of the page can listen here. */
  readonly output: AudioNode;
  /** The same as disposing the mixer. A scope can own the sound of a game through this. */
  dispose(): void;
}

/** A straight line a gain follows, kept here because a browser does not always say where a gain is. */
interface Line { readonly from: number; readonly to: number; readonly start: number; readonly end: number; }
interface Pair { readonly target: EventTarget; readonly type: string; readonly listener: EventListener; }
/** Shorter than a click can be heard, long enough that a step in volume makes none. */
const SMOOTH = 0.005;
const gestures = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;
const passive: AddEventListenerOptions = Object.freeze({ capture: true, passive: true });
const at = (line: Line, time: number): number => time >= line.end ? line.to : time <= line.start ? line.from
  : line.from + (line.to - line.from) * (time - line.start) / (line.end - line.start);

/**
 * Sound for a page on Web Audio. A page may not sound before the person has touched it: until
 * then the mixer is locked, music asked for waits, and the first touch or key lets it start.
 */
export function createBrowserAudio(options: BrowserAudioOptions = {}): BrowserAudio {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new EgretError('AUDIO_OPTIONS_INVALID');
  const { context: given, unlockTarget, pauseWhenHidden = true, onError, ...configuration } = options;
  const Live = globalThis.AudioContext, page = globalThis.document;
  if ((given !== undefined && (given === null || typeof given !== 'object')) || typeof pauseWhenHidden !== 'boolean' || (onError !== undefined && typeof onError !== 'function')
    || (unlockTarget !== undefined && (unlockTarget === null || typeof unlockTarget.addEventListener !== 'function'))) throw new EgretError('AUDIO_OPTIONS_INVALID');
  if (given === undefined && typeof Live !== 'function') throw new EgretError('AUDIO_HOST_UNAVAILABLE');
  const context: BaseAudioContext = given ?? new Live();
  /** Only an output that runs in real time can be suspended, resumed and locked. */
  const live = typeof Live === 'function' && context instanceof Live ? context : undefined;
  const buffers = new WeakMap<AudioBackendSound, AudioBuffer>();
  const nodes = new WeakMap<AudioBackendBus, GainNode>();
  const pairs: Pair[] = [];
  const armed: Pair[] = [];
  let closed = false, desired = true, output: GainNode | undefined, silent: AudioBuffer | undefined;

  function report(cause: unknown): void {
    if (onError !== undefined) onError(cause);
    else if (typeof globalThis.reportError === 'function') globalThis.reportError(cause);
  }
  function ramp(parameter: AudioParam, line: Line | undefined, value: number, seconds: number): Line {
    const time = context.currentTime;
    // The first value of a gain is where it starts, not a movement.
    if (line === undefined) { parameter.value = value; return { from: value, to: value, start: time, end: time }; }
    const from = at(line, time), end = time + Math.max(seconds, SMOOTH);
    parameter.cancelScheduledValues(time);
    parameter.setValueAtTime(from, time);
    parameter.linearRampToValueAtTime(value, end);
    return { from, to: value, start: time, end };
  }
  function listen(list: Pair[], target: EventTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener, passive);
    list.push({ target, type, listener });
  }
  function unlisten(list: Pair[]): void {
    for (const pair of list.splice(0).reverse()) try { pair.target.removeEventListener(pair.type, pair.listener, passive); } catch (cause) { report(cause); }
  }
  /** After the output or what is wanted of it changed: the lock of the mixer follows the output. */
  function settle(): void {
    if (closed || live === undefined) return;
    try {
      if (live.state === 'running') {
        unlisten(armed);
        mixer.setLocked(false);
        if (!desired) live.suspend().catch(report);
      } else if (desired) {
        arm();
        mixer.setLocked(true);
      }
    } catch (cause) { report(cause); }
  }
  /** An output that refused to start is waited for as a locked one is: the next touch asks again. */
  function refused(cause: unknown): void {
    report(cause);
    settle();
  }
  /** A touch or a key is what lets a page sound. A silent sample started inside it is what some phones ask for. */
  const unlock: EventListener = () => {
    if (closed || live === undefined) return;
    try {
      silent ??= live.createBuffer(1, 1, live.sampleRate);
      const source = live.createBufferSource();
      source.buffer = silent;
      source.connect(live.destination);
      source.start(0);
      live.resume().then(settle, refused);
    } catch (cause) { report(cause); }
  };
  function arm(): void {
    const target = unlockTarget ?? page;
    if (armed.length > 0 || target === undefined) return;
    for (const type of gestures) listen(armed, target, type, unlock);
  }

  const backend: AudioBackend = {
    get time(): number { return context.currentTime; },
    async decode(bytes: Uint8Array): Promise<AudioBackendSound> {
      // Decoding takes the buffer it is given away from its owner: it is given a copy.
      const copy = bytes.slice().buffer;
      const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
        const result = context.decodeAudioData(copy, resolve, reject) as Promise<AudioBuffer> | undefined;
        if (result !== undefined && typeof result.then === 'function') result.then(resolve, reject);
      });
      const sound: AudioBackendSound = { duration: buffer.duration, channels: buffer.numberOfChannels, sampleRate: buffer.sampleRate, release(): void { buffers.delete(sound); } };
      buffers.set(sound, buffer);
      return sound;
    },
    createBus(parent: AudioBackendBus | undefined): AudioBackendBus {
      const node = context.createGain(), target = parent === undefined ? context.destination : nodes.get(parent);
      if (target === undefined) throw new EgretError('AUDIO_BACKEND_FAILED');
      node.connect(target);
      output ??= node;
      let line: Line | undefined;
      const bus: AudioBackendBus = {
        setGain(value: number, seconds: number): void { line = ramp(node.gain, line, value, seconds); },
        release(): void { nodes.delete(bus); node.disconnect(); },
      };
      nodes.set(bus, node);
      return bus;
    },
    start(request: AudioBackendStart, ended: () => void): AudioBackendVoice {
      const buffer = buffers.get(request.sound), bus = nodes.get(request.bus);
      if (buffer === undefined) throw new EgretError('AUDIO_BACKEND_FAILED');
      if (bus === undefined) throw new EgretError('AUDIO_BACKEND_FAILED');
      const source = context.createBufferSource(), gain = context.createGain(), time = context.currentTime;
      let sides: { readonly left: GainNode; readonly right: GainNode; readonly nodes: readonly AudioNode[] } | undefined, line: Line, over = false;
      source.buffer = buffer;
      source.loop = request.loop;
      source.playbackRate.value = request.rate;
      if (request.fadeIn > 0) {
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(request.gain, time + request.fadeIn);
        line = { from: 0, to: request.gain, start: time, end: time + request.fadeIn };
      } else line = ramp(gain.gain, undefined, request.gain, 0);
      /**
       * A pan is a balance: towards one side the other side falls in a straight line, and the middle is the sound as it is.
       * A voice in the middle needs no nodes for it. They are put in the first time it leaves the middle.
       */
      function place(pan: number): void {
        if (sides === undefined) {
          if (pan === 0) return;
          const splitter = context.createChannelSplitter(2), merger = context.createChannelMerger(2), left = context.createGain(), right = context.createGain();
          // One channel is heard on both sides before the sides are told apart.
          gain.channelCount = 2; gain.channelCountMode = 'explicit'; gain.channelInterpretation = 'speakers';
          gain.disconnect();
          gain.connect(splitter);
          splitter.connect(left, 0); splitter.connect(right, 1);
          left.connect(merger, 0, 0); right.connect(merger, 0, 1);
          merger.connect(bus!);
          sides = { left, right, nodes: [splitter, left, right, merger] };
        }
        sides.left.gain.value = 1 - Math.max(0, pan);
        sides.right.gain.value = 1 + Math.min(0, pan);
      }
      source.connect(gain);
      gain.connect(bus);
      place(request.pan);
      source.onended = (): void => {
        if (over) return;
        over = true;
        source.onended = null;
        try { for (const node of [source, gain, ...sides?.nodes ?? []]) node.disconnect(); } catch (cause) { report(cause); }
        ended();
      };
      source.start(0, request.offset);
      return {
        setGain(value: number, seconds: number): void { line = ramp(gain.gain, line, value, seconds); },
        setRate(value: number): void { source.playbackRate.value = value; },
        setPan(value: number): void { place(value); },
        stop(seconds: number): void {
          if (over) return;
          source.stop(seconds > 0 ? context.currentTime + seconds : 0);
        },
      };
    },
    suspend(): void {
      desired = false;
      if (live !== undefined && live.state === 'running') live.suspend().catch(report);
    },
    resume(): void {
      desired = true;
      if (live !== undefined && live.state !== 'running') live.resume().then(settle, refused);
    },
    close(): void {
      if (closed) return;
      closed = true;
      unlisten(armed);
      unlisten(pairs);
      if (live !== undefined && given === undefined) live.close().catch(report);
    },
  };

  let mixer: AudioMixer;
  try {
    mixer = createAudioMixer({ ...configuration, backend, locked: live !== undefined && live.state !== 'running' });
  } catch (cause) {
    if (live !== undefined && given === undefined) live.close().catch(report);
    throw cause;
  }
  if (live !== undefined) {
    try {
      listen(pairs, live, 'statechange', settle);
      if (pauseWhenHidden && page !== undefined) {
        const visibility: EventListener = () => {
          try { if (page.visibilityState === 'hidden') mixer.suspend('hidden'); else mixer.resume('hidden'); } catch (cause) { report(cause); }
        };
        listen(pairs, page, 'visibilitychange', visibility);
        if (page.visibilityState === 'hidden') mixer.suspend('hidden');
      }
      if (live.state !== 'running') arm();
    } catch (cause) {
      try { mixer.dispose(); } catch { /* the first failure is the one told */ }
      throw cause;
    }
  }

  return Object.freeze({
    mixer, context, output: output!,
    dispose(): void { mixer.dispose(); },
  });
}
