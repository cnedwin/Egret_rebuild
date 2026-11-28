// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import { createAudioMixer } from '@egret/engine/audio';
import type {
  AudioBackend,
  AudioBackendBus,
  AudioBackendSound,
  AudioBackendStart,
  AudioBackendVoice,
  AudioMixer,
  AudioMixerOptions
} from '@egret/engine/audio';

/** Browser audio to make: its audio context, what unlocks it, whether it pauses when the page is hidden, and its limiter. */
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
  /**
   * A limiter on the way out, so many sounds at once do not clip. `true` uses a gentle setting that leaves
   * ordinary transients alone; an object sets the compressor itself. Off by default.
   */
  readonly limiter?: boolean | BrowserAudioLimiter;
}
/** The compressor of the limiter, in its own units: decibels for threshold and knee, seconds for the times. */
export interface BrowserAudioLimiter {
  readonly threshold?: number;
  readonly knee?: number;
  readonly ratio?: number;
  readonly attack?: number;
  readonly release?: number;
}
const LIMITER = { threshold: -6, knee: 4, ratio: 12, attack: 0.003, release: 0.16 } as const;
/** The Web Audio half of browser sound alone: its output, what unlocks it, whether it pauses when hidden, its limiter. */
export interface WebAudioBackendOptions {
  readonly context?: BaseAudioContext;
  readonly unlockTarget?: EventTarget;
  readonly pauseWhenHidden?: boolean;
  readonly onError?: (cause: unknown) => void;
  readonly limiter?: boolean | BrowserAudioLimiter;
}
/**
 * A backend for `createAudioMixer` that plays through Web Audio. Give `locked` to the mixer as it is made, and then the
 * mixer to `attach`, so the lock follows the first touch and the sound pauses while the page is hidden.
 */
export interface WebAudioBackend extends AudioBackend {
  readonly context: BaseAudioContext;
  /** What every sound passes on its way out, once the mixer has made its master bus. */
  readonly output: AudioNode | undefined;
  /** Whether the output is waiting for the person to touch the page before it may sound. */
  readonly locked: boolean;
  /** The mixer made on this backend: its lock follows the output from now on. Once only. */
  attach(mixer: AudioMixer): void;
  /** Feed a caller-owned Web Audio graph into a named mixer bus after attaching the mixer. */
  createInput(bus: string, options?: BrowserAudioInputOptions): BrowserAudioInput;
}
/** A sound mixer playing through Web Audio, with its context and output node. */
export interface BrowserAudio {
  readonly mixer: AudioMixer;
  readonly context: BaseAudioContext;
  /** What every sound passes on its way out. An analyser of the page can listen here. */
  readonly output: AudioNode;
  /** Feed a caller-owned Web Audio graph into a named mixer bus. */
  createInput(bus: string, options?: BrowserAudioInputOptions): BrowserAudioInput;
  /** The same as disposing the mixer. A scope can own the sound of a game through this. */
  dispose(): void;
}

/** Initial levels for an external input. Optional pan and lowpass enable those processors. */
export interface BrowserAudioInputOptions {
  /** 0 to 1. Defaults to 1. */
  readonly volume?: number;
  /** Independent attenuation, 0 to 1. Defaults to 1. */
  readonly duck?: number;
  /** Native equal-power stereo pan, -1 to 1. Omitted means no panner. */
  readonly pan?: number;
  /** Initial lowpass cutoff in Hz, greater than zero and no higher than Nyquist. Omit to bypass. */
  readonly lowpass?: number;
}
/** An exponential approach to a parameter's new value, with a time constant in seconds. */
export interface BrowserAudioGlide {
  /** (0, 60]; by default a short linear ramp prevents steps. */
  readonly timeConstant?: number;
}
/** A mixer-owned input strip; its upstream generators, decoded buffers and transport are caller-owned. */
export interface BrowserAudioInput {
  readonly input: AudioNode;
  readonly disposed: boolean;
  setVolume(value: number, options?: BrowserAudioGlide): void;
  setDuck(value: number, options?: BrowserAudioGlide): void;
  /** Present only when pan was requested and the host has a native stereo panner. */
  readonly setPan?: (value: number, options?: BrowserAudioGlide) => void;
  /** Present only if a lowpass filter was requested. */
  readonly setLowpass?: (frequency: number, options?: BrowserAudioGlide) => void;
  dispose(): void;
}
interface NamedInputBus {
  readonly node: GainNode;
  readonly inputs: Set<BrowserAudioInput>;
}
/** A straight line a gain follows, kept here because a browser does not always say where a gain is. */
interface Line {
  readonly from: number;
  readonly to: number;
  readonly start: number;
  readonly end: number;
}
interface TargetLine {
  readonly from: number;
  readonly to: number;
  readonly start: number;
  readonly timeConstant: number;
}
interface Pair {
  readonly target: EventTarget;
  readonly type: string;
  readonly listener: EventListener;
}
interface Strip {
  readonly gain: GainNode;
  setGain(value: number, seconds: number): void;
  setPan(pan: number): void;
  release(): void;
}
/** A file a media element plays as it reads it, and the node that brings it into the graph. */
interface Stream {
  readonly element: HTMLAudioElement;
  readonly node: MediaElementAudioSourceNode;
}
/** Shorter than a click can be heard, long enough that a step in volume makes none. */
const SMOOTH = 0.005;
/** Bound caller-owned strips separately from decoded/streamed voices. */
const MAX_INPUTS = 64;
const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const gestures = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;
const passive: AddEventListenerOptions = Object.freeze({ capture: true, passive: true });
const at = (line: Line, time: number): number =>
  time >= line.end
    ? line.to
    : time <= line.start
      ? line.from
      : line.from + ((line.to - line.from) * (time - line.start)) / (line.end - line.start);

/**
 * A Web Audio backend for a mixer the page makes itself with `createAudioMixer`:
 *
 *     const backend = createWebAudioBackend();
 *     const mixer = createAudioMixer({ backend, locked: backend.locked });
 *     backend.attach(mixer);
 *
 * `createBrowserAudio` does these three steps in one call.
 */
export function createWebAudioBackend(options: WebAudioBackendOptions = {}): WebAudioBackend {
  if (options === null || typeof options !== 'object' || Array.isArray(options))
    throw new EgretError('AUDIO_OPTIONS_INVALID');
  const { context: given, unlockTarget, pauseWhenHidden = true, onError, limiter: limit } = options;
  const standard = globalThis.AudioContext,
    prefixed = (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext,
    Live = typeof standard === 'function' ? standard : prefixed,
    page = globalThis.document;
  if (
    (given !== undefined && (given === null || typeof given !== 'object')) ||
    typeof pauseWhenHidden !== 'boolean' ||
    (onError !== undefined && typeof onError !== 'function') ||
    (unlockTarget !== undefined && (unlockTarget === null || typeof unlockTarget.addEventListener !== 'function')) ||
    (limit !== undefined && typeof limit !== 'boolean' && (limit === null || typeof limit !== 'object'))
  )
    throw new EgretError('AUDIO_OPTIONS_INVALID');
  const context: BaseAudioContext =
    given ??
    (() => {
      if (typeof Live !== 'function') throw new EgretError('AUDIO_HOST_UNAVAILABLE');
      return new Live();
    })();
  /** Only an output that runs in real time can be suspended, resumed and locked. */
  const live = typeof Live === 'function' && context instanceof Live ? context : undefined;
  const buffers = new WeakMap<AudioBackendSound, AudioBuffer>();
  // The limiter sits between the master volume and the speakers.
  let limiter: DynamicsCompressorNode | undefined;
  if (limit) {
    const settings = { ...LIMITER, ...(limit === true ? {} : limit) };
    for (const value of Object.values(settings))
      if (!Number.isFinite(value)) throw new EgretError('AUDIO_OPTIONS_INVALID');
    limiter = context.createDynamicsCompressor();
    limiter.threshold.value = settings.threshold;
    limiter.knee.value = settings.knee;
    limiter.ratio.value = settings.ratio;
    limiter.attack.value = settings.attack;
    limiter.release.value = settings.release;
    limiter.connect(context.destination);
  }
  const nodes = new WeakMap<AudioBackendBus, GainNode>();
  const namedInputs = new Map<string, NamedInputBus>();
  const inputs = new Set<BrowserAudioInput>();
  const streams = new WeakMap<AudioBackendSound, Stream>();
  /** The media elements that should be heard now. */
  const sounding = new Set<HTMLAudioElement>();
  const pairs: Pair[] = [];
  const armed: Pair[] = [];
  let mixer: AudioMixer | undefined;
  let closed = false,
    desired = true,
    output: GainNode | undefined,
    silent: AudioBuffer | undefined;

  function report(cause: unknown): void {
    if (onError !== undefined) onError(cause);
    else if (typeof globalThis.reportError === 'function') globalThis.reportError(cause);
  }
  function ramp(parameter: AudioParam, line: Line | undefined, value: number, seconds: number): Line {
    const time = context.currentTime;
    // The first value of a gain is where it starts, not a movement.
    if (line === undefined) {
      parameter.value = value;
      return { from: value, to: value, start: time, end: time };
    }
    const from = at(line, time),
      end = time + Math.max(seconds, SMOOTH);
    parameter.cancelScheduledValues(time);
    parameter.setValueAtTime(from, time);
    parameter.linearRampToValueAtTime(value, end);
    return { from, to: value, start: time, end };
  }
  /** Continuous parameter automation for a strip, even when a new glide interrupts the old one. */
  function parameterControl(
    parameter: AudioParam,
    initial: number,
    valid: (value: unknown) => boolean,
    active: () => boolean
  ) {
    parameter.value = initial;
    const time = context.currentTime;
    let line: Line | TargetLine = { from: initial, to: initial, start: time, end: time };
    return (value: number, options?: BrowserAudioGlide): void => {
      if (
        !valid(value) ||
        (options !== undefined && (options === null || typeof options !== 'object' || Array.isArray(options)))
      )
        throw new EgretError('AUDIO_OPTIONS_INVALID');
      const constant = options?.timeConstant;
      if (constant !== undefined && !inRange(constant, Number.MIN_VALUE, 60))
        throw new EgretError('AUDIO_OPTIONS_INVALID');
      if (!active()) return;
      const now = context.currentTime;
      const from =
        'timeConstant' in line
          ? line.to + (line.from - line.to) * Math.exp(-Math.max(0, now - line.start) / line.timeConstant)
          : at(line, now);
      parameter.cancelScheduledValues(now);
      parameter.setValueAtTime(from, now);
      if (constant === undefined) {
        const end = now + SMOOTH;
        parameter.linearRampToValueAtTime(value, end);
        line = { from, to: value, start: now, end };
      } else {
        parameter.setTargetAtTime(value, now, constant);
        line = { from, to: value, start: now, timeConstant: constant };
      }
    };
  }

  function disconnectAll(stages: readonly AudioNode[]): unknown[] {
    const failures: unknown[] = [];
    for (const stage of stages)
      try {
        stage.disconnect();
      } catch (cause) {
        failures.push(cause);
      }
    return failures;
  }

  function createInput(name: string, inputOptions: BrowserAudioInputOptions = {}): BrowserAudioInput {
    if (closed) throw new EgretError('AUDIO_CLOSED');
    if (mixer === undefined) throw new EgretError('AUDIO_OPTIONS_INVALID');
    const bus = namedInputs.get(name);
    if (bus === undefined) throw new EgretError('AUDIO_BUS_UNKNOWN');
    if (inputOptions === null || typeof inputOptions !== 'object' || Array.isArray(inputOptions))
      throw new EgretError('AUDIO_OPTIONS_INVALID');
    const { volume = 1, duck = 1, pan, lowpass } = inputOptions;
    const isLevel = (value: unknown): boolean => inRange(value, 0, 1);
    const isPan = (value: unknown): boolean => inRange(value, -1, 1);
    const isCutoff = (value: unknown): boolean => inRange(value, Number.MIN_VALUE, context.sampleRate / 2);
    if (
      !isLevel(volume) ||
      !isLevel(duck) ||
      (pan !== undefined && !isPan(pan)) ||
      (lowpass !== undefined && !isCutoff(lowpass))
    )
      throw new EgretError('AUDIO_OPTIONS_INVALID');
    if (inputs.size >= MAX_INPUTS) throw new EgretError('AUDIO_BUDGET');
    const stages: AudioNode[] = [];
    let disposed = false;
    const active = (): boolean => !disposed;
    const stage = <T extends AudioNode>(node: T): T => {
      stages.push(node);
      return node;
    };
    try {
      const input = stage(context.createGain());
      const filter = lowpass === undefined ? undefined : stage(context.createBiquadFilter());
      if (filter !== undefined) filter.type = 'lowpass';
      const setLowpass =
        filter === undefined ? undefined : parameterControl(filter.frequency, lowpass!, isCutoff, active);
      const gain = stage(context.createGain());
      const setVolume = parameterControl(gain.gain, volume, isLevel, active);
      // An older host can still render the input in the middle, precisely as a game without a panner does.
      const panner =
        pan === undefined || typeof context.createStereoPanner !== 'function'
          ? undefined
          : stage(context.createStereoPanner());
      const setPan = panner === undefined ? undefined : parameterControl(panner.pan, pan!, isPan, active);
      const attenuation = stage(context.createGain());
      const setDuck = parameterControl(attenuation.gain, duck, isLevel, active);
      for (let i = 0; i < stages.length; i++) stages[i]!.connect(stages[i + 1] ?? bus.node);
      const face: BrowserAudioInput = Object.freeze({
        input,
        get disposed(): boolean {
          return disposed;
        },
        setVolume,
        setDuck,
        ...(setPan === undefined ? {} : { setPan }),
        ...(setLowpass === undefined ? {} : { setLowpass }),
        dispose(): void {
          if (disposed) return;
          disposed = true;
          inputs.delete(face);
          bus.inputs.delete(face);
          const failed = disconnectAll(stages);
          if (failed.length)
            throw new EgretError('AUDIO_CLEANUP_FAILED', { cause: failed[0], cleanupErrors: failed.slice(1) });
        }
      });
      inputs.add(face);
      bus.inputs.add(face);
      return face;
    } catch (cause) {
      const failed = disconnectAll(stages);
      throw new EgretError('AUDIO_BACKEND_FAILED', { cause, cleanupErrors: failed });
    }
  }

  function listen(list: Pair[], target: EventTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener, passive);
    list.push({ target, type, listener });
  }
  function unlisten(list: Pair[]): void {
    for (const pair of list.splice(0).reverse())
      try {
        pair.target.removeEventListener(pair.type, pair.listener, passive);
      } catch (cause) {
        report(cause);
      }
  }
  /** After the output or what is wanted of it changed: the lock of the mixer follows the output. */
  function settle(): void {
    if (closed || live === undefined) return;
    try {
      follow();
      if (live.state === 'running') {
        unlisten(armed);
        mixer?.setLocked(false);
        if (!desired) live.suspend().catch(report);
      } else if (desired) {
        arm();
        mixer?.setLocked(true);
      }
    } catch (cause) {
      report(cause);
    }
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
      // A media element is let play by the touch it is started in.
      if (desired) for (const element of sounding) if (element.paused) element.play().catch(held);
      live.resume().then(settle, refused);
    } catch (cause) {
      report(cause);
    }
  };
  function arm(): void {
    const target = unlockTarget ?? page;
    if (armed.length > 0 || target === undefined) return;
    for (const type of gestures) listen(armed, target, type, unlock);
  }

  /** The way of one voice from what makes its sound to its bus: its gain, and its two sides once it leaves the middle. */
  function makeStrip(input: AudioNode, bus: GainNode, request: AudioBackendStart): Strip {
    const gain = context.createGain(),
      time = context.currentTime;
    let sides: { readonly left: GainNode; readonly right: GainNode; readonly nodes: readonly AudioNode[] } | undefined,
      line: Line;
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
        const splitter = context.createChannelSplitter(2),
          merger = context.createChannelMerger(2),
          left = context.createGain(),
          right = context.createGain();
        // One channel is heard on both sides before the sides are told apart.
        gain.channelCount = 2;
        gain.channelCountMode = 'explicit';
        gain.channelInterpretation = 'speakers';
        gain.disconnect();
        gain.connect(splitter);
        splitter.connect(left, 0);
        splitter.connect(right, 1);
        left.connect(merger, 0, 0);
        right.connect(merger, 0, 1);
        merger.connect(bus);
        sides = { left, right, nodes: [splitter, left, right, merger] };
      }
      sides.left.gain.value = 1 - Math.max(0, pan);
      sides.right.gain.value = 1 + Math.min(0, pan);
    }
    input.connect(gain);
    gain.connect(bus);
    place(request.pan);
    return {
      gain,
      setGain(value: number, seconds: number): void {
        line = ramp(gain.gain, line, value, seconds);
      },
      setPan: place,
      release(): void {
        for (const node of [gain, ...(sides?.nodes ?? [])]) node.disconnect();
      }
    };
  }
  /** What a media element was refused: without a touch it waits for one; a pause that overtook it is nothing. */
  function held(cause: unknown): void {
    const name = (cause as { name?: unknown } | null)?.name;
    if (name === 'NotAllowedError') arm();
    else if (name !== 'AbortError') report(cause);
  }
  /** A media element keeps its own time. It is made to play while the output runs and to wait while it does not. */
  function follow(): void {
    const run = desired && (live === undefined || live.state === 'running');
    for (const element of sounding) {
      if (run && element.paused) element.play().catch(held);
      else if (!run && !element.paused) element.pause();
    }
  }
  function startStream(
    stream: Stream,
    bus: GainNode,
    request: AudioBackendStart,
    ended: () => void
  ): AudioBackendVoice {
    const { element, node } = stream,
      strip = makeStrip(node, bus, request);
    let over = false,
      timer: AudioBufferSourceNode | undefined;
    function finish(): void {
      if (over) return;
      over = true;
      sounding.delete(element);
      try {
        element.removeEventListener('ended', finish);
        element.pause();
        if (timer !== undefined) {
          timer.onended = null;
          timer.stop();
          timer.disconnect();
        }
        node.disconnect(strip.gain);
        strip.release();
      } catch (cause) {
        report(cause);
      }
      ended();
    }
    element.loop = request.loop;
    element.playbackRate = request.rate;
    // A rate is speed and pitch together, as it is for a decoded sound.
    if ('preservesPitch' in element) element.preservesPitch = false;
    if (element.currentTime !== request.offset) element.currentTime = request.offset;
    element.addEventListener('ended', finish);
    sounding.add(element);
    follow();
    return {
      setGain: strip.setGain,
      setRate(value: number): void {
        element.playbackRate = value;
      },
      setPan: strip.setPan,
      stop(seconds: number): void {
        if (over) return;
        if (seconds <= 0) {
          finish();
          return;
        }
        // The end of a fade is a time on the clock of the output: a silent source that stops then tells it.
        silent ??= context.createBuffer(1, 1, context.sampleRate);
        timer = context.createBufferSource();
        timer.buffer = silent;
        timer.loop = true;
        timer.connect(context.destination);
        timer.onended = finish;
        timer.start(0);
        timer.stop(context.currentTime + seconds);
      },
      position: (): number => element.currentTime
    };
  }

  const backend: WebAudioBackend = {
    context,
    get output(): AudioNode | undefined {
      return output;
    },
    get locked(): boolean {
      return live !== undefined && live.state !== 'running';
    },
    attach(made: AudioMixer): void {
      if (mixer !== undefined || made === null || typeof made !== 'object')
        throw new EgretError('AUDIO_OPTIONS_INVALID');
      mixer = made;
      if (live === undefined) return;
      listen(pairs, live, 'statechange', settle);
      if (pauseWhenHidden && page !== undefined) {
        const visibility: EventListener = () => {
          try {
            if (page.visibilityState === 'hidden') made.suspend('hidden');
            else made.resume('hidden');
          } catch (cause) {
            report(cause);
          }
        };
        listen(pairs, page, 'visibilitychange', visibility);
        if (page.visibilityState === 'hidden') made.suspend('hidden');
      }
      if (live.state !== 'running') arm();
    },
    createInput,
    get time(): number {
      return context.currentTime;
    },
    async decode(bytes: Uint8Array): Promise<AudioBackendSound> {
      // Decoding takes the buffer it is given away from its owner: it is given a copy.
      const copy = bytes.slice().buffer;
      const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
        const result = context.decodeAudioData(copy, resolve, reject) as Promise<AudioBuffer> | undefined;
        if (result !== undefined && typeof result.then === 'function') result.then(resolve, reject);
      });
      const sound: AudioBackendSound = {
        duration: buffer.duration,
        channels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate,
        release(): void {
          buffers.delete(sound);
        }
      };
      buffers.set(sound, buffer);
      return sound;
    },
    async openStream(url: string): Promise<AudioBackendSound> {
      const Element = globalThis.Audio;
      if (typeof Element !== 'function' || live === undefined) throw new EgretError('AUDIO_HOST_UNAVAILABLE');
      const element = new Element();
      element.preload = 'auto';
      // A file of another origin is asked for in the way that lets its samples into the graph, or not at all.
      element.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        const done = (): void => {
          element.removeEventListener('loadedmetadata', loaded);
          element.removeEventListener('error', failed);
        };
        const loaded = (): void => {
          done();
          resolve();
        };
        const failed = (): void => {
          done();
          reject(element.error ?? new EgretError('AUDIO_STREAM_FAILED'));
        };
        element.addEventListener('loadedmetadata', loaded);
        element.addEventListener('error', failed);
        element.src = url;
      });
      const node = live.createMediaElementSource(element);
      const sound: AudioBackendSound = {
        duration: element.duration,
        channels: node.channelCount,
        sampleRate: live.sampleRate,
        streamed: true,
        release(): void {
          streams.delete(sound);
          sounding.delete(element);
          element.pause();
          element.removeAttribute('src');
          element.load();
          node.disconnect();
        }
      };
      streams.set(sound, { element, node });
      return sound;
    },
    createBus(parent: AudioBackendBus | undefined, name?: string): AudioBackendBus {
      if (name !== undefined && namedInputs.has(name)) throw new EgretError('AUDIO_OPTIONS_INVALID');
      const node = context.createGain(),
        target = parent === undefined ? (limiter ?? context.destination) : nodes.get(parent);
      if (target === undefined) throw new EgretError('AUDIO_BACKEND_FAILED');
      node.connect(target);
      output ??= node;
      let line: Line | undefined;
      const bus: AudioBackendBus = {
        setGain(value: number, seconds: number): void {
          line = ramp(node.gain, line, value, seconds);
        },
        release(): void {
          nodes.delete(bus);
          const failures: unknown[] = [];
          if (name !== undefined) {
            const entry = namedInputs.get(name);
            if (entry?.node === node) {
              namedInputs.delete(name);
              for (const input of [...entry.inputs])
                try {
                  input.dispose();
                } catch (cause) {
                  failures.push(cause);
                }
            }
          }
          failures.push(...disconnectAll([node]));
          if (failures.length)
            throw new EgretError('AUDIO_CLEANUP_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
        }
      };
      nodes.set(bus, node);
      if (name !== undefined) namedInputs.set(name, { node, inputs: new Set() });
      return bus;
    },
    start(request: AudioBackendStart, ended: () => void): AudioBackendVoice {
      const bus = nodes.get(request.bus),
        stream = streams.get(request.sound);
      if (bus === undefined) throw new EgretError('AUDIO_BACKEND_FAILED');
      if (stream !== undefined) return startStream(stream, bus, request, ended);
      const buffer = buffers.get(request.sound);
      if (buffer === undefined) throw new EgretError('AUDIO_BACKEND_FAILED');
      const source = context.createBufferSource(),
        strip = makeStrip(source, bus, request);
      let over = false;
      source.buffer = buffer;
      source.loop = request.loop;
      source.playbackRate.value = request.rate;
      source.onended = (): void => {
        if (over) return;
        over = true;
        source.onended = null;
        try {
          source.disconnect();
          strip.release();
        } catch (cause) {
          report(cause);
        }
        ended();
      };
      source.start(0, request.offset);
      return {
        setGain: strip.setGain,
        setRate(value: number): void {
          source.playbackRate.value = value;
        },
        setPan: strip.setPan,
        stop(seconds: number): void {
          if (over) return;
          source.stop(seconds > 0 ? context.currentTime + seconds : 0);
        }
      };
    },
    suspend(): void {
      desired = false;
      follow();
      if (live !== undefined && live.state === 'running') live.suspend().catch(report);
    },
    resume(): void {
      desired = true;
      follow();
      // Asked even of an output that still runs: a suspension on its way would otherwise be the last word.
      if (live !== undefined) live.resume().then(settle, refused);
    },
    close(): void {
      if (closed) return;
      closed = true;
      // The standalone backend can be closed too, not only through the mixer that owns its buses.
      for (const input of [...inputs])
        try {
          input.dispose();
        } catch (cause) {
          report(cause);
        }
      namedInputs.clear();
      unlisten(armed);
      unlisten(pairs);
      limiter?.disconnect();
      if (live !== undefined && given === undefined) live.close().catch(report);
    }
  };

  return backend;
}

/**
 * Sound for a page on Web Audio. A page may not sound before the person has touched it: until
 * then the mixer is locked, music asked for waits, and the first touch or key lets it start.
 */
export function createBrowserAudio(options: BrowserAudioOptions = {}): BrowserAudio {
  if (options === null || typeof options !== 'object' || Array.isArray(options))
    throw new EgretError('AUDIO_OPTIONS_INVALID');
  const {
    context: _context,
    unlockTarget: _target,
    pauseWhenHidden: _hidden,
    onError: _error,
    limiter: _limiter,
    ...configuration
  } = options;
  // The backend reads its own options and no others.
  const backend = createWebAudioBackend(options);
  let mixer: AudioMixer;
  try {
    mixer = createAudioMixer({ ...configuration, backend, locked: backend.locked });
  } catch (cause) {
    backend.close();
    throw cause;
  }
  try {
    backend.attach(mixer);
  } catch (cause) {
    try {
      mixer.dispose();
    } catch {
      /* the first failure is the one told */
    }
    throw cause;
  }
  return Object.freeze({
    mixer,
    context: backend.context,
    output: backend.output!,
    createInput: backend.createInput,
    dispose(): void {
      mixer.dispose();
    }
  });
}
