// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type {
  AudioBackend, AudioBackendBus, AudioBackendSound, AudioBackendVoice, AudioBus, AudioBusOptions, AudioBusSnapshot, AudioEndReason, AudioFade,
  AudioMixer, AudioMixerOptions, AudioMixerSnapshot, AudioMixerState, AudioMusicOptions, AudioPlayOptions, AudioSound, AudioVoice, AudioVoiceState,
} from './audioTypes.js';

interface Bus {
  readonly name: string;
  volume: number;
  muted: boolean;
  voices: number;
  readonly backend: AudioBackendBus;
  readonly face: AudioBus;
}
interface Sound {
  readonly backend: AudioBackendSound;
  readonly bytes: number;
  readonly voices: Set<Voice>;
  released: boolean;
  readonly face: AudioSound;
}
interface Voice {
  readonly id: number;
  readonly sound: Sound;
  readonly bus: Bus;
  readonly loop: boolean;
  readonly music: boolean;
  state: AudioVoiceState;
  reason: AudioEndReason | undefined;
  volume: number;
  rate: number;
  pan: number;
  backend: AudioBackendVoice | undefined;
  /** Names the backend voice whose end is still awaited. */
  token: object | undefined;
  anchorTime: number;
  anchorPosition: number;
  promise: Promise<AudioEndReason> | undefined;
  settle: ((reason: AudioEndReason) => void) | undefined;
  face: AudioVoice;
}
interface Start {
  readonly bus: string | undefined;
  readonly volume: number;
  readonly rate: number;
  readonly pan: number;
  readonly loop: boolean;
  readonly offset: number;
  readonly fadeIn: number;
  readonly maxInstances: number | undefined;
  readonly whileSilent: 'drop' | 'start';
}

const MIB = 1024 * 1024;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const within = (value: unknown, least: number, most: number): value is number => typeof value === 'number' && value >= least && value <= most;
const whole = (value: unknown, least: number, most: number): value is number => Number.isSafeInteger(value) && within(value, least, most);
const named = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 32;
const callable = (value: unknown, keys: readonly string[]): boolean => record(value) && keys.every(key => typeof value[key] === 'function');

/**
 * Volumes, voices and one music over a backend that makes the sound. It keeps no clock of its own
 * and starts no work: a fade is a line the backend follows, and the end of a voice is told by it.
 */
export function createAudioMixer(options: AudioMixerOptions): AudioMixer {
  if (!record(options)) throw new EgretError('AUDIO_OPTIONS_INVALID');
  const { backend, buses: busOptions = ['music', 'effects'], volume = 1, muted = false, locked: startLocked = false,
    maxVoices = 32, maxSounds = 256, maxDecodedBytes = 128 * MIB } = options;
  if (!callable(backend, ['decode', 'createBus', 'start', 'suspend', 'resume', 'close']) || !Array.isArray(busOptions) || busOptions.length < 1 || busOptions.length > 16
    || !within(volume, 0, 1) || typeof muted !== 'boolean' || typeof startLocked !== 'boolean'
    || !whole(maxVoices, 1, 256) || !whole(maxSounds, 1, 4096) || !whole(maxDecodedBytes, 1, Number.MAX_SAFE_INTEGER)) throw new EgretError('AUDIO_OPTIONS_INVALID');
  const wanted: Required<AudioBusOptions>[] = [];
  for (const item of busOptions as readonly unknown[]) {
    const bus = typeof item === 'string' ? { name: item } : item;
    if (!record(bus)) throw new EgretError('AUDIO_OPTIONS_INVALID');
    const { name, volume: level = 1, muted: quiet = false } = bus;
    if (!named(name) || name === 'master' || wanted.some(other => other.name === name) || !within(level, 0, 1) || typeof quiet !== 'boolean') throw new EgretError('AUDIO_OPTIONS_INVALID');
    wanted.push({ name, volume: level, muted: quiet });
  }

  /** The backend is the host's: what it throws is told as one code, with the cause kept. */
  function guard<T>(action: () => T): T {
    try { return action(); } catch (cause) { throw new EgretError('AUDIO_BACKEND_FAILED', { cause }); }
  }
  function now(): number {
    const value = guard(() => backend.time);
    if (!within(value, 0, Number.MAX_VALUE)) throw new EgretError('AUDIO_BACKEND_FAILED');
    return value;
  }
  function fadeOf(value: unknown): number {
    if (value === undefined) return 0;
    if (!record(value)) throw new EgretError('AUDIO_OPTIONS_INVALID');
    const fade = value['fade'] ?? 0;
    if (!within(fade, 0, 60)) throw new EgretError('AUDIO_OPTIONS_INVALID');
    return fade;
  }

  const voices = new Set<Voice>();
  const sounds = new Set<Sound>();
  const known = new WeakMap<object, Sound>();
  const listeners = new Set<(state: AudioMixerState) => void>();
  const suspendedBy: string[] = [];
  const dropped = { silent: 0, limit: 0, stolen: 0 };
  let closed = false, locked = startLocked, decoding = 0, decodedBytes = 0, started = 0, ids = 0;
  let music: Voice | undefined;

  function makeBus(name: string, level: number, quiet: boolean, parent: AudioBackendBus | undefined): Bus {
    const raw = guard(() => backend.createBus(parent));
    if (!callable(raw, ['setGain', 'release'])) throw new EgretError('AUDIO_BACKEND_FAILED');
    const apply = (seconds: number): void => { guard(() => raw.setGain(bus.muted ? 0 : bus.volume, seconds)); };
    const bus: Bus = {
      name, volume: level, muted: quiet, voices: 0, backend: raw,
      face: Object.freeze({
        name,
        get volume(): number { return bus.volume; },
        get muted(): boolean { return bus.muted; },
        get voices(): number { return name === 'master' ? voices.size : bus.voices; },
        setVolume(value: number, fade?: AudioFade): void {
          const seconds = fadeOf(fade);
          if (!within(value, 0, 1)) throw new EgretError('AUDIO_OPTIONS_INVALID');
          if (closed) return;
          bus.volume = value;
          apply(seconds);
        },
        setMuted(value: boolean): void {
          if (typeof value !== 'boolean') throw new EgretError('AUDIO_OPTIONS_INVALID');
          if (closed) return;
          bus.muted = value;
          apply(0);
        },
      }),
    };
    try { apply(0); } catch (cause) {
      try { raw.release(); } catch { /* the first failure is the one told */ }
      throw cause;
    }
    return bus;
  }
  const master = makeBus('master', volume, muted, undefined);
  const buses: Bus[] = [];
  try {
    for (const bus of wanted) buses.push(makeBus(bus.name, bus.volume, bus.muted, master.backend));
  } catch (cause) {
    for (const bus of [...buses, master]) try { bus.backend.release(); } catch { /* the first failure is the one told */ }
    throw cause;
  }
  const faces = Object.freeze(buses.map(bus => bus.face));
  const fallback = (name: string): Bus => buses.find(bus => bus.name === name) ?? buses[0]!;
  const effects = fallback('effects'), melody = fallback('music');
  function busOf(name: unknown): Bus {
    const bus = buses.find(candidate => candidate.name === name);
    if (bus === undefined) throw new EgretError('AUDIO_BUS_UNKNOWN');
    return bus;
  }

  let told: AudioMixerState = current();
  function current(): AudioMixerState {
    return closed ? 'closed' : locked ? 'locked' : suspendedBy.length > 0 ? 'suspended' : 'running';
  }
  /** Every listener is told, whatever an earlier one did. The first failure is thrown afterwards. */
  function announce(): void {
    const next = current();
    if (next === told) return;
    told = next;
    const failures: unknown[] = [];
    for (const listener of [...listeners]) {
      if (!listeners.has(listener)) continue;
      try { listener(next); } catch (cause) { failures.push(cause); }
    }
    if (failures.length > 0) throw new EgretError('AUDIO_LISTENER_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
  }
  function open(): void {
    if (closed) throw new EgretError('AUDIO_CLOSED');
  }

  function positionOf(voice: Voice): number {
    const raw = voice.backend;
    if (raw === undefined) return voice.anchorPosition;
    const duration = voice.sound.backend.duration;
    if (typeof raw.position === 'function') {
      // A host that reads the sound as it plays knows the place itself.
      const place = guard(() => raw.position!());
      if (!within(place, 0, Number.MAX_VALUE)) throw new EgretError('AUDIO_BACKEND_FAILED');
      return Math.min(place, duration);
    }
    const place = voice.anchorPosition + Math.max(0, now() - voice.anchorTime) * voice.rate;
    return voice.loop ? place % duration : Math.min(place, duration);
  }
  /** The one place a voice ends. The host is asked to silence it only after the mixer has let go of it. */
  function end(voice: Voice, reason: AudioEndReason, halt: boolean): void {
    if (voice.state === 'ended') return;
    const raw = voice.backend;
    if (reason === 'finished') voice.anchorPosition = voice.sound.backend.duration;
    else try { voice.anchorPosition = positionOf(voice); } catch { /* the last position known stays */ }
    voice.state = 'ended'; voice.reason = reason; voice.backend = undefined; voice.token = undefined;
    if (voices.delete(voice)) { voice.sound.voices.delete(voice); voice.bus.voices--; }
    if (music === voice) music = undefined;
    if (reason === 'silent' || reason === 'limit' || reason === 'stolen') dropped[reason]++;
    const settle = voice.settle;
    voice.settle = undefined;
    settle?.(reason);
    if (halt && raw !== undefined) guard(() => { raw.stop(0); });
  }
  function launch(voice: Voice, offset: number, fadeIn: number): void {
    const at = now(), token = {};
    voice.token = token;
    let raw: AudioBackendVoice;
    try {
      raw = guard(() => backend.start(Object.freeze({
        sound: voice.sound.backend, bus: voice.bus.backend, offset, loop: voice.loop, rate: voice.rate, gain: voice.volume, pan: voice.pan, fadeIn,
      }), () => {
        if (voice.token === token) end(voice, voice.state === 'stopping' ? 'stopped' : 'finished', false);
      }));
      if (!callable(raw, ['setGain', 'setRate', 'setPan', 'stop'])) throw new EgretError('AUDIO_BACKEND_FAILED');
    } catch (cause) {
      if (voice.token === token) voice.token = undefined;
      throw cause;
    }
    // A host that told the end before it returned has nothing left to stop.
    if (voice.token !== token) return;
    voice.backend = raw; voice.anchorTime = at; voice.anchorPosition = offset;
  }
  function stopVoice(voice: Voice, fade: number): void {
    if (voice.state === 'ended') return;
    const raw = voice.backend;
    if (fade === 0 || raw === undefined) { end(voice, 'stopped', true); return; }
    if (voice.state === 'stopping') return;
    voice.state = 'stopping';
    if (music === voice) music = undefined;
    try { guard(() => { raw.setGain(0, fade); raw.stop(fade); }); } catch (cause) {
      // A host that could not fade is not waited for.
      try { end(voice, 'stopped', true); } catch { /* the first failure is the one told */ }
      throw cause;
    }
  }

  function faceOf(voice: Voice): AudioVoice {
    return Object.freeze({
      id: voice.id, sound: voice.sound.face, bus: voice.bus.name, loop: voice.loop,
      get state(): AudioVoiceState { return voice.state; },
      get endReason(): AudioEndReason | undefined { return voice.reason; },
      get volume(): number { return voice.volume; },
      get rate(): number { return voice.rate; },
      get pan(): number { return voice.pan; },
      get position(): number { return positionOf(voice); },
      get ended(): Promise<AudioEndReason> {
        voice.promise ??= voice.reason !== undefined ? Promise.resolve(voice.reason) : new Promise<AudioEndReason>(resolve => { voice.settle = resolve; });
        return voice.promise;
      },
      setVolume(value: number, fade?: AudioFade): void {
        const seconds = fadeOf(fade);
        if (!within(value, 0, 1)) throw new EgretError('AUDIO_OPTIONS_INVALID');
        if (voice.state === 'ended') return;
        voice.volume = value;
        const raw = voice.backend;
        if (raw !== undefined && voice.state === 'playing') guard(() => { raw.setGain(value, seconds); });
      },
      setRate(value: number): void {
        if (!within(value, 0.25, 4)) throw new EgretError('AUDIO_OPTIONS_INVALID');
        if (voice.state === 'ended') return;
        const raw = voice.backend;
        if (raw !== undefined) {
          const position = positionOf(voice), at = now();
          guard(() => { raw.setRate(value); });
          voice.anchorPosition = position; voice.anchorTime = at;
        }
        voice.rate = value;
      },
      setPan(value: number): void {
        if (!within(value, -1, 1)) throw new EgretError('AUDIO_OPTIONS_INVALID');
        if (voice.state === 'ended') return;
        const raw = voice.backend;
        if (raw !== undefined) guard(() => { raw.setPan(value); });
        voice.pan = value;
      },
      pause(): void {
        const raw = voice.backend;
        if (voice.state !== 'playing' || raw === undefined) return;
        const position = positionOf(voice);
        if (!voice.loop && position >= voice.sound.backend.duration) { end(voice, 'finished', true); return; }
        voice.state = 'paused'; voice.backend = undefined; voice.token = undefined; voice.anchorPosition = position;
        guard(() => { raw.stop(0); });
      },
      resume(): void {
        if (voice.state !== 'paused') return;
        launch(voice, voice.anchorPosition, 0);
        if (voice.backend !== undefined) voice.state = 'playing';
      },
      stop(fade?: AudioFade): void { stopVoice(voice, fadeOf(fade)); },
    });
  }
  function soundOf(value: unknown): Sound {
    const sound = record(value) ? known.get(value) : undefined;
    if (sound === undefined) throw new EgretError('AUDIO_SOUND_INVALID');
    if (sound.released) throw new EgretError('AUDIO_SOUND_RELEASED');
    return sound;
  }
  function startOf(sound: Sound, value: unknown, forMusic: boolean): Start {
    if (value !== undefined && !record(value)) throw new EgretError('AUDIO_PLAY_OPTIONS');
    const given = value ?? {};
    const pick = (key: string, otherwise: unknown): unknown => given[key] === undefined ? otherwise : given[key];
    const bus = given['bus'], level = pick('volume', 1), loop = pick('loop', forMusic), offset = pick('offset', 0), fadeIn = pick(forMusic ? 'fade' : 'fadeIn', 0);
    // Music is one voice at its own speed in the middle; it waits for the output instead of being dropped.
    const rate = forMusic ? 1 : pick('rate', 1), pan = forMusic ? 0 : pick('pan', 0), maxInstances = forMusic ? undefined : given['maxInstances'];
    const whileSilent = forMusic ? 'start' : pick('whileSilent', 'drop'), restart = forMusic ? given['restart'] : undefined;
    if ((bus !== undefined && typeof bus !== 'string') || !within(level, 0, 1) || !within(rate, 0.25, 4) || !within(pan, -1, 1) || typeof loop !== 'boolean'
      || !within(offset, 0, sound.backend.duration) || offset === sound.backend.duration || !within(fadeIn, 0, 60)
      || (maxInstances !== undefined && !whole(maxInstances, 1, 256)) || (whileSilent !== 'drop' && whileSilent !== 'start')
      || (restart !== undefined && typeof restart !== 'boolean')) throw new EgretError('AUDIO_PLAY_OPTIONS');
    return { bus, volume: level, rate, pan, loop, offset, fadeIn, maxInstances, whileSilent };
  }
  function start(sound: Sound, request: Start, forMusic: boolean): Voice {
    const bus = request.bus === undefined ? (forMusic ? melody : effects) : busOf(request.bus);
    const voice: Voice = {
      id: ++ids, sound, bus, loop: request.loop, music: forMusic, state: 'playing', reason: undefined,
      volume: request.volume, rate: request.rate, pan: request.pan, backend: undefined, token: undefined,
      anchorTime: 0, anchorPosition: request.offset, promise: undefined, settle: undefined, face: undefined as unknown as AudioVoice,
    };
    voice.face = faceOf(voice);
    if (request.whileSilent === 'drop' && current() !== 'running') { end(voice, 'silent', false); return voice; }
    // The oldest voice that may give its place: never the music, and a loop only to its own sound.
    const victims: Voice[] = [];
    // A stream has one place: whatever plays it gives way, the music too.
    if (sound.backend.streamed === true) victims.push(...sound.voices);
    else if (request.maxInstances !== undefined) {
      const own = [...sound.voices].filter(other => !other.music);
      if (sound.voices.size >= request.maxInstances) {
        const surplus = sound.voices.size - request.maxInstances + 1;
        if (own.length < surplus) { end(voice, 'limit', false); return voice; }
        victims.push(...own.slice(0, surplus));
      }
    }
    if (voices.size - victims.length >= maxVoices) {
      const victim = [...voices].find(other => !other.music && !other.loop && !victims.includes(other));
      if (victim === undefined) { end(voice, 'limit', false); return voice; }
      victims.push(victim);
    }
    const failures: unknown[] = [];
    for (const victim of victims) try { end(victim, 'stolen', true); } catch (cause) { failures.push(cause); }
    voices.add(voice); sound.voices.add(voice); bus.voices++;
    try {
      launch(voice, request.offset, request.fadeIn);
      if (failures.length > 0) throw failures[0];
    } catch (cause) {
      // Nothing was started for the caller: the voice is not told as one that was dropped.
      const raw = voice.backend;
      voice.state = 'ended'; voice.reason = 'stopped'; voice.backend = undefined; voice.token = undefined;
      voices.delete(voice); sound.voices.delete(voice); bus.voices--;
      if (raw !== undefined) try { raw.stop(0); } catch { /* the first failure is the one told */ }
      throw cause;
    }
    started++;
    return voice;
  }

  /** What the backend gave is checked, counted and made a sound, or given back. */
  function adopt(raw: AudioBackendSound, streamed: boolean): AudioSound {
    const discard = (code: string): never => {
      const cleanupErrors: unknown[] = [];
      if (record(raw) && typeof raw.release === 'function') try { raw.release(); } catch (cause) { cleanupErrors.push(cause); }
      throw new EgretError(code, { cleanupErrors });
    };
    if (!record(raw) || typeof raw.release !== 'function' || !within(raw.duration, Number.MIN_VALUE, 86400) || !whole(raw.channels, 1, 32)
      || !within(raw.sampleRate, 1, 768000) || (raw.streamed === true) !== streamed) return discard('AUDIO_BACKEND_FAILED');
    const size = streamed ? 0 : Math.ceil(raw.duration * raw.sampleRate) * raw.channels * 4;
    if (closed) return discard('AUDIO_CLOSED');
    if (decodedBytes + size > maxDecodedBytes) return discard('AUDIO_BUDGET');
    const sound: Sound = {
      backend: raw, bytes: size, voices: new Set(), released: false,
      face: Object.freeze({
        duration: raw.duration, channels: raw.channels, sampleRate: raw.sampleRate, decodedBytes: size, streamed,
        get state(): 'ready' | 'released' { return sound.released ? 'released' : 'ready'; },
        release(): void {
          if (sound.released) return;
          const failures = retire(sound, 'released');
          if (failures.length > 0) throw new EgretError('AUDIO_BACKEND_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
        },
      }),
    };
    sounds.add(sound); known.set(sound.face, sound); decodedBytes += size;
    return sound.face;
  }
  async function decode(bytes: Uint8Array | ArrayBuffer): Promise<AudioSound> {
    open();
    const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
    if (!(view instanceof Uint8Array) || view.byteLength === 0) throw new EgretError('AUDIO_BYTES_INVALID');
    if (sounds.size + decoding >= maxSounds) throw new EgretError('AUDIO_SOUND_LIMIT');
    decoding++;
    let raw: AudioBackendSound;
    try { raw = await backend.decode(view); } catch (cause) { throw new EgretError('AUDIO_DECODE_FAILED', { cause }); } finally { decoding--; }
    return adopt(raw, false);
  }
  async function stream(url: string): Promise<AudioSound> {
    open();
    if (typeof url !== 'string' || url.length === 0 || url.length > 4096) throw new EgretError('AUDIO_URL_INVALID');
    if (typeof backend.openStream !== 'function') throw new EgretError('AUDIO_STREAM_UNSUPPORTED');
    if (sounds.size + decoding >= maxSounds) throw new EgretError('AUDIO_SOUND_LIMIT');
    decoding++;
    let raw: AudioBackendSound;
    try { raw = await backend.openStream(url); } catch (cause) { throw new EgretError('AUDIO_STREAM_FAILED', { cause }); } finally { decoding--; }
    return adopt(raw, true);
  }
  /** Ends the voices of a sound and gives its samples back. What failed is returned, not thrown. */
  function retire(sound: Sound, reason: AudioEndReason): unknown[] {
    const failures: unknown[] = [];
    sound.released = true;
    for (const voice of [...sound.voices]) try { end(voice, reason, true); } catch (cause) { failures.push(cause); }
    sounds.delete(sound); decodedBytes -= sound.bytes;
    try { sound.backend.release(); } catch (cause) { failures.push(cause); }
    return failures;
  }
  const picture = (bus: Bus): AudioBusSnapshot => Object.freeze({ name: bus.name, volume: bus.volume, muted: bus.muted, voices: bus.face.voices });

  return Object.freeze({
    get state(): AudioMixerState { return current(); },
    master: master.face,
    buses: faces,
    get music(): AudioVoice | undefined { return music?.face; },
    bus: (name: string): AudioBus => busOf(name).face,
    decode,
    stream,
    play(sound: AudioSound, playOptions?: AudioPlayOptions): AudioVoice {
      open();
      const entry = soundOf(sound);
      return start(entry, startOf(entry, playOptions, false), false).face;
    },
    playMusic(sound: AudioSound, musicOptions?: AudioMusicOptions): AudioVoice {
      open();
      const entry = soundOf(sound), request = startOf(entry, musicOptions, true), before = music;
      if (request.bus !== undefined) busOf(request.bus);
      if (before !== undefined && before.sound === entry && musicOptions?.restart !== true) {
        if (musicOptions?.volume !== undefined) before.face.setVolume(request.volume, { fade: request.fadeIn });
        return before.face;
      }
      const next = start(entry, request, true);
      if (next.state === 'ended') return next.face;
      music = next;
      if (before !== undefined) stopVoice(before, request.fadeIn);
      return next.face;
    },
    stopMusic(fade?: AudioFade): void {
      const seconds = fadeOf(fade);
      if (music !== undefined) stopVoice(music, seconds);
    },
    stopAll(stopOptions?: AudioFade & { readonly bus?: string }): void {
      const seconds = fadeOf(stopOptions), only = stopOptions?.bus === undefined ? undefined : busOf(stopOptions.bus);
      const failures: unknown[] = [];
      for (const voice of [...voices]) if (only === undefined || voice.bus === only) try { stopVoice(voice, seconds); } catch (cause) { failures.push(cause); }
      if (failures.length > 0) throw new EgretError('AUDIO_BACKEND_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
    },
    suspend(reason: string = 'game'): void {
      if (!named(reason)) throw new EgretError('AUDIO_REASON_INVALID');
      if (closed || suspendedBy.includes(reason)) return;
      if (suspendedBy.length >= 8) throw new EgretError('AUDIO_REASON_LIMIT');
      if (suspendedBy.length === 0) guard(() => { backend.suspend(); });
      suspendedBy.push(reason);
      announce();
    },
    resume(reason: string = 'game'): void {
      if (!named(reason)) throw new EgretError('AUDIO_REASON_INVALID');
      const index = suspendedBy.indexOf(reason);
      if (closed || index < 0) return;
      if (suspendedBy.length === 1) guard(() => { backend.resume(); });
      suspendedBy.splice(index, 1);
      announce();
    },
    setLocked(value: boolean): void {
      if (typeof value !== 'boolean') throw new EgretError('AUDIO_OPTIONS_INVALID');
      if (closed) return;
      locked = value;
      announce();
    },
    subscribe(listener: (state: AudioMixerState) => void): () => void {
      if (typeof listener !== 'function') throw new EgretError('AUDIO_OPTIONS_INVALID');
      open();
      listeners.add(listener);
      return (): void => { listeners.delete(listener); };
    },
    snapshot: (): AudioMixerSnapshot => Object.freeze({
      state: current(), locked, suspendedBy: Object.freeze([...suspendedBy]), master: picture(master), buses: Object.freeze(buses.map(picture)),
      voices: voices.size, sounds: sounds.size, decodedBytes, music: music?.id, started, dropped: Object.freeze({ ...dropped }),
    }),
    dispose(): void {
      if (closed) return;
      closed = true;
      const failures: unknown[] = [];
      for (const voice of [...voices]) try { end(voice, 'closed', true); } catch (cause) { failures.push(cause); }
      for (const sound of [...sounds]) failures.push(...retire(sound, 'closed'));
      for (const bus of [...buses, master]) try { bus.backend.release(); } catch (cause) { failures.push(cause); }
      try { backend.close(); } catch (cause) { failures.push(cause); }
      try { announce(); } catch (cause) { failures.push(cause); }
      listeners.clear();
      if (failures.length > 0) throw new EgretError('AUDIO_CLEANUP_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
    },
  });
}
