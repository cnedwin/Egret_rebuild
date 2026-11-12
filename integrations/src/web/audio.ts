// SPDX-License-Identifier: Apache-2.0
import { Howl, Howler } from 'howler';
import { IntegrationError } from '../errors.js';

export interface AudioClipSource {
  readonly src: readonly string[];
  /** Specify formats when a URL does not contain a file extension. */
  readonly format?: readonly string[];
  readonly volume?: number;
  readonly loop?: boolean;
  /** Stream through HTML5 Audio when that mode fits the asset. */
  readonly html5?: boolean;
}

export interface AudioDiagnostic {
  readonly event: 'load' | 'loaderror' | 'play' | 'playerror' | 'stop' | 'end';
  readonly clip: string;
  readonly voiceId?: number;
  readonly error?: IntegrationError;
}

export interface AudioBankOptions {
  readonly clips: Readonly<Record<string, AudioClipSource>>;
  readonly onDiagnostic?: (diagnostic: AudioDiagnostic) => void;
}

export interface AudioVoice {
  readonly id: number;
  /** Resolves when the browser reports playback, or rejects on error or cancellation. */
  readonly started: Promise<void>;
  isPlaying(): boolean;
  stop(): void;
  dispose(): void;
}

export interface AudioClipStatus {
  readonly state: 'unloaded' | 'loading' | 'loaded';
  readonly activeVoices: number;
}

export interface AudioBank {
  load(clip: string): Promise<void>;
  /** Start a preloaded clip directly in a user gesture when the browser requires one. */
  play(clip: string): AudioVoice;
  status(clip: string): AudioClipStatus;
  dispose(): void;
}

const MAX_CLIPS = 128;
const MAX_SOURCES = 8;
const MAX_VOICES_PER_CLIP = 32;

interface Pending {
  readonly promise: Promise<void>;
  resolve(): void;
  reject(error: IntegrationError): void;
}

interface Voice {
  readonly id: number;
  readonly pending: Pending;
  nativeId: number | undefined;
}

interface Clip {
  readonly key: string;
  readonly source: AudioClipSource;
  readonly voices: Map<number, Voice>;
  howl: Howl | undefined;
  pendingLoad: Pending | undefined;
}

function invalid(message: string): never {
  throw new IntegrationError('audio', 'invalid-input', message);
}

function waitForOperation(): Pending {
  let resolve!: () => void;
  let reject!: (error: IntegrationError) => void;
  const promise = new Promise<void>((finish, fail) => { resolve = finish; reject = fail; });
  // Playback handles may be used only for stop/status; diagnostics still report failures.
  void promise.catch(() => {});
  return { promise, resolve, reject };
}

function ownedStringList(value: readonly string[], label: string): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_SOURCES) invalid(`${label} must have one to eight entries.`);
  const owned = Array.from(value);
  if (owned.some(item => typeof item !== 'string' || item.trim().length === 0)) invalid(`${label} must contain non-empty strings.`);
  return owned;
}

function findVoice(clip: Clip, nativeId: number): Voice | undefined {
  for (const voice of clip.voices.values()) if (voice.nativeId === nativeId) return voice;
  return undefined;
}

/** Creates a browser-owned bank; each clip and voice belongs to this bank's lifecycle. */
export function createAudioBank(options: AudioBankOptions): AudioBank {
  if (typeof window === 'undefined' || typeof document === 'undefined' || Howler.noAudio) {
    throw new IntegrationError('audio', 'platform-unavailable', 'Browser audio is unavailable on this host.');
  }
  if (!options || typeof options !== 'object') invalid('Audio bank options must be an object.');
  const { clips: definitions, onDiagnostic } = options;
  if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) invalid('Audio bank clips must be an object.');
  if (onDiagnostic !== undefined && typeof onDiagnostic !== 'function') invalid('onDiagnostic must be a function.');
  const entries = Object.entries(definitions);
  if (entries.length < 1 || entries.length > MAX_CLIPS) invalid('Audio bank must define one to 128 clips.');
  const clips = new Map<string, Clip>();
  for (const [key, value] of entries) {
    if (key.trim().length === 0 || !value || typeof value !== 'object') invalid('Each audio clip requires a name and a source.');
    const { src, format, volume = 1, loop = false, html5 = false } = value;
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) invalid('Clip volume must be between 0 and 1.');
    if (typeof loop !== 'boolean' || typeof html5 !== 'boolean') invalid('Clip loop and html5 options must be booleans.');
    const source = { src: ownedStringList(src, `${key}.src`), volume, loop, html5,
      ...(format === undefined ? {} : { format: ownedStringList(format, `${key}.format`) }) };
    clips.set(key, { key, source, voices: new Map(), howl: undefined, pendingLoad: undefined });
  }
  let disposed = false;
  let nextVoiceId = 1;

  function getClip(key: string): Clip {
    if (disposed) throw new IntegrationError('audio', 'disposed', 'The audio bank has been disposed.');
    return clips.get(key) ?? invalid(`Unknown audio clip ${key}.`);
  }

  function report(diagnostic: AudioDiagnostic): void {
    // Observers do not own or interrupt native playback and cleanup.
    try { onDiagnostic?.(Object.freeze(diagnostic)); }
    catch { /* Diagnostics are observational. */ }
  }

  function failLoad(clip: Clip, howl: Howl, cause: unknown): void {
    if (clip.howl !== howl) return;
    const error = new IntegrationError('audio', 'operation-failed', `Could not load audio clip ${clip.key}.`, { cause });
    clip.howl = undefined;
    clip.pendingLoad?.reject(error);
    clip.pendingLoad = undefined;
    for (const voice of clip.voices.values()) voice.pending.reject(error);
    clip.voices.clear();
    // A later explicit request can retry using a fresh Howl. Late events from this one are ignored.
    try { howl.unload(); }
    catch { /* The original load error remains the operation result. */ }
    report({ event: 'loaderror', clip: clip.key, error });
  }

  function failVoice(clip: Clip, voice: Voice, cause: unknown): void {
    clip.voices.delete(voice.id);
    const error = new IntegrationError('audio', 'operation-failed', `Could not play audio clip ${clip.key}.`, { cause });
    voice.pending.reject(error);
    if (voice.nativeId !== undefined) {
      try { clip.howl?.stop(voice.nativeId); }
      catch { /* The original playback error remains the operation result. */ }
    }
    report({ event: 'playerror', clip: clip.key, voiceId: voice.id, error });
  }

  function instanceFor(clip: Clip): Howl {
    if (clip.howl) return clip.howl;
    const source = clip.source;
    try {
      const howl = new Howl({
        src: [...source.src],
        ...(source.format === undefined ? {} : { format: [...source.format] }),
        volume: source.volume ?? 1, loop: source.loop ?? false, html5: source.html5 ?? false,
        preload: false,
        onload: () => {
          if (clip.howl !== howl) return;
          clip.pendingLoad?.resolve();
          clip.pendingLoad = undefined;
          report({ event: 'load', clip: clip.key });
        },
        onloaderror: (_id, error: unknown) => failLoad(clip, howl, error),
        onplay: id => {
          if (clip.howl !== howl) return;
          const voice = findVoice(clip, id);
          if (!voice) return;
          voice.pending.resolve();
          report({ event: 'play', clip: clip.key, voiceId: voice.id });
        },
        onplayerror: (id, cause: unknown) => {
          if (clip.howl !== howl) return;
          const voice = findVoice(clip, id);
          if (voice) failVoice(clip, voice, cause);
        },
        onend: id => {
          if (clip.howl !== howl) return;
          const voice = findVoice(clip, id);
          if (!voice) return;
          if (!source.loop) clip.voices.delete(voice.id);
          voice.pending.resolve();
          report({ event: 'end', clip: clip.key, voiceId: voice.id });
        },
      });
      clip.howl = howl;
      return howl;
    } catch (cause) {
      throw new IntegrationError('audio', 'operation-failed', `Could not create audio clip ${clip.key}.`, { cause });
    }
  }

  function loadClip(clip: Clip, howl: Howl): Promise<void> {
    if (howl.state() === 'loaded') return Promise.resolve();
    if (clip.pendingLoad) return clip.pendingLoad.promise;
    const pending = waitForOperation();
    clip.pendingLoad = pending;
    try { if (howl.state() !== 'loading') howl.load(); }
    catch (cause) { failLoad(clip, howl, cause); }
    return pending.promise;
  }

  function startVoice(clip: Clip, howl: Howl, voice: Voice): void {
    if (clip.howl !== howl || clip.voices.get(voice.id) !== voice) return;
    try {
      const nativeId = howl.play();
      if (!Number.isSafeInteger(nativeId) || nativeId < 1) throw new Error('Howler did not return a voice ID.');
      voice.nativeId = nativeId;
    } catch (cause) { failVoice(clip, voice, cause); }
  }

  return Object.freeze({
    async load(key: string): Promise<void> {
      const clip = getClip(key);
      return loadClip(clip, instanceFor(clip));
    },
    play(key: string): AudioVoice {
      const clip = getClip(key);
      if (clip.voices.size >= MAX_VOICES_PER_CLIP || !Number.isSafeInteger(nextVoiceId)) {
        throw new IntegrationError('audio', 'limit-exceeded', `Too many voices for ${clip.key}.`);
      }
      const howl = instanceFor(clip);
      const voice: Voice = { id: nextVoiceId++, pending: waitForOperation(), nativeId: undefined };
      clip.voices.set(voice.id, voice);
      if (howl.state() === 'loaded') startVoice(clip, howl, voice);
      else {
        // Resume within the caller's gesture, then play only if the voice is still owned after decoding.
        const context = Howler.ctx;
        if (Howler.usingWebAudio && context?.state === 'suspended') void context.resume().catch(() => {});
        void loadClip(clip, howl).then(() => startVoice(clip, howl, voice), () => {});
      }

      function stop(): void {
        if (clip.voices.get(voice.id) !== voice) return;
        clip.voices.delete(voice.id);
        voice.pending.reject(new IntegrationError('audio', 'aborted', `Playback stopped for ${clip.key}.`));
        try { if (voice.nativeId !== undefined) howl.stop(voice.nativeId); }
        catch (cause) { throw new IntegrationError('audio', 'operation-failed', `Could not stop audio clip ${clip.key}.`, { cause }); }
        report({ event: 'stop', clip: clip.key, voiceId: voice.id });
      }
      return Object.freeze({ id: voice.id, started: voice.pending.promise,
        isPlaying: () => clip.voices.get(voice.id) === voice && voice.nativeId !== undefined && howl.playing(voice.nativeId),
        stop, dispose: stop });
    },
    status(key: string): AudioClipStatus {
      const clip = getClip(key);
      return Object.freeze({ state: clip.howl?.state() ?? 'unloaded', activeVoices: clip.voices.size });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      const error = new IntegrationError('audio', 'disposed', 'The audio bank has been disposed.');
      let firstFailure: IntegrationError | undefined;
      for (const clip of clips.values()) {
        clip.pendingLoad?.reject(error);
        clip.pendingLoad = undefined;
        for (const voice of clip.voices.values()) voice.pending.reject(error);
        clip.voices.clear();
        const howl = clip.howl;
        clip.howl = undefined;
        try { howl?.unload(); }
        catch (cause) {
          firstFailure ??= new IntegrationError('audio', 'operation-failed', `Could not unload audio clip ${clip.key}.`, { cause });
        }
      }
      clips.clear();
      if (firstFailure) throw firstFailure;
    },
  });
}
