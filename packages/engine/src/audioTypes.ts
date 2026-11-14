// SPDX-License-Identifier: Apache-2.0

/**
 * Whether sound comes out. A closed mixer stays closed. A locked one waits for its host: a page
 * may not start its output before the person has touched it. A suspended one was asked to be
 * silent, by the game or by the host, and says by whom in its snapshot.
 */
export type AudioMixerState = 'running' | 'suspended' | 'locked' | 'closed';
/**
 * Why a voice is over: it reached its end; it was stopped; it gave its place to a newer voice; no
 * place could be made for it; it was asked for while nothing could be heard; its sound was
 * released; or the mixer was disposed.
 */
export type AudioEndReason = 'finished' | 'stopped' | 'stolen' | 'limit' | 'silent' | 'released' | 'closed';
export type AudioVoiceState = 'playing' | 'paused' | 'stopping' | 'ended';

/** Decoded samples held by the host. */
export interface AudioBackendSound {
  /** Seconds. */
  readonly duration: number;
  readonly channels: number;
  readonly sampleRate: number;
  release(): void;
}
/** One gain on the way to the output. */
export interface AudioBackendBus {
  /** Reaches the value in a straight line over the seconds given, from where the gain is now. */
  setGain(value: number, seconds: number): void;
  release(): void;
}
export interface AudioBackendStart {
  readonly sound: AudioBackendSound;
  readonly bus: AudioBackendBus;
  /** Seconds into the sound. */
  readonly offset: number;
  readonly loop: boolean;
  readonly rate: number;
  readonly gain: number;
  /** A balance: -1 is the left side alone, 1 the right side alone, 0 the sound as it is. */
  readonly pan: number;
  /** Seconds over which the gain rises from nothing. */
  readonly fadeIn: number;
}
/** One sound being played once. */
export interface AudioBackendVoice {
  setGain(value: number, seconds: number): void;
  setRate(value: number): void;
  setPan(value: number): void;
  /** Stops after the seconds given. The end is told as any other end is. */
  stop(seconds: number): void;
}
/**
 * What a host gives the mixer. Its clock stands still while its output is suspended or has not
 * been let start, and a voice started while it stands still begins when it moves again.
 */
export interface AudioBackend {
  /** Seconds on the clock of the output. */
  readonly time: number;
  /** The bytes of one encoded file. They are the caller's and stay unchanged. */
  decode(bytes: Uint8Array): Promise<AudioBackendSound>;
  /** Without a parent it feeds the output. */
  createBus(parent: AudioBackendBus | undefined): AudioBackendBus;
  /** `ended` is called once, later, when the voice has stopped sounding for any reason. */
  start(request: AudioBackendStart, ended: () => void): AudioBackendVoice;
  suspend(): void;
  resume(): void;
  close(): void;
}

export interface AudioBusOptions {
  readonly name: string;
  /** 0 to 1. Defaults to 1. */
  readonly volume?: number;
  readonly muted?: boolean;
}
export interface AudioMixerOptions {
  readonly backend: AudioBackend;
  /** Named volumes under the master one. Defaults to 'music' and 'effects'. */
  readonly buses?: readonly (string | AudioBusOptions)[];
  /** The master volume, 0 to 1. Defaults to 1. */
  readonly volume?: number;
  readonly muted?: boolean;
  /** The host has not let the output start yet. */
  readonly locked?: boolean;
  /** Voices that are not over, 1 to 256. Defaults to 32. */
  readonly maxVoices?: number;
  /** Sounds that are not released, 1 to 4096. Defaults to 256. */
  readonly maxSounds?: number;
  /** Decoded samples held at once, as bytes of 32-bit samples. Defaults to 128 MiB. */
  readonly maxDecodedBytes?: number;
}
export interface AudioFade {
  /** Seconds, 0 to 60. Defaults to 0. */
  readonly fade?: number;
}
export interface AudioBus {
  readonly name: string;
  readonly volume: number;
  readonly muted: boolean;
  /** Voices on this bus that are not over. */
  readonly voices: number;
  setVolume(value: number, options?: AudioFade): void;
  setMuted(muted: boolean): void;
}
export interface AudioSound {
  readonly duration: number;
  readonly channels: number;
  readonly sampleRate: number;
  /** What the decoded samples are counted as against the budget of the mixer. */
  readonly decodedBytes: number;
  readonly state: 'ready' | 'released';
  /** Ends its voices and gives the samples back. A scope can own a sound through this. */
  release(): void;
}
export interface AudioPlayOptions {
  /** Defaults to 'effects' when the mixer has that bus, otherwise to the first bus. */
  readonly bus?: string;
  /** 0 to 1. Defaults to 1. */
  readonly volume?: number;
  /** Speed and pitch together, 0.25 to 4. Defaults to 1. */
  readonly rate?: number;
  /** A balance: -1 is the left side alone, 1 the right side alone. Defaults to 0, the sound as it is. */
  readonly pan?: number;
  readonly loop?: boolean;
  /** Seconds into the sound, below its duration. Defaults to 0. */
  readonly offset?: number;
  /** Seconds, 0 to 60. Defaults to 0. */
  readonly fadeIn?: number;
  /** At most this many voices of this sound: the oldest gives its place. */
  readonly maxInstances?: number;
  /**
   * What happens when nothing can be heard: 'drop' ends the voice at once, 'start' starts it
   * so that it is heard when the output runs again. Defaults to 'drop'.
   */
  readonly whileSilent?: 'drop' | 'start';
}
export interface AudioMusicOptions {
  /** Defaults to 'music' when the mixer has that bus, otherwise to the first bus. */
  readonly bus?: string;
  readonly volume?: number;
  /** Seconds over which the new music rises and the old one falls. Defaults to 0. */
  readonly fade?: number;
  /** Defaults to true. */
  readonly loop?: boolean;
  readonly offset?: number;
  /** Start again even when this sound is already the music. */
  readonly restart?: boolean;
}
export interface AudioVoice {
  readonly id: number;
  readonly sound: AudioSound;
  readonly bus: string;
  readonly state: AudioVoiceState;
  readonly endReason: AudioEndReason | undefined;
  readonly volume: number;
  readonly rate: number;
  readonly pan: number;
  readonly loop: boolean;
  /** Seconds into the sound, by the clock of the output. */
  readonly position: number;
  /** Settles when the voice is over. It never rejects. */
  readonly ended: Promise<AudioEndReason>;
  setVolume(value: number, options?: AudioFade): void;
  setRate(value: number): void;
  setPan(value: number): void;
  pause(): void;
  resume(): void;
  stop(options?: AudioFade): void;
}
export interface AudioBusSnapshot {
  readonly name: string;
  readonly volume: number;
  readonly muted: boolean;
  readonly voices: number;
}
export interface AudioMixerSnapshot {
  readonly state: AudioMixerState;
  readonly locked: boolean;
  /** Who asked for silence, in the order they asked. */
  readonly suspendedBy: readonly string[];
  readonly master: AudioBusSnapshot;
  readonly buses: readonly AudioBusSnapshot[];
  readonly voices: number;
  readonly sounds: number;
  readonly decodedBytes: number;
  /** The id of the voice that is the music. */
  readonly music: number | undefined;
  /** Voices started since the mixer was made, and those that were over before they sounded or gave their place. */
  readonly started: number;
  readonly dropped: { readonly silent: number; readonly limit: number; readonly stolen: number };
}
export interface AudioMixer {
  readonly state: AudioMixerState;
  readonly master: AudioBus;
  readonly buses: readonly AudioBus[];
  /** The music now, while it is not being stopped. */
  readonly music: AudioVoice | undefined;
  bus(name: string): AudioBus;
  /** Decodes one encoded file. The bytes stay the caller's. */
  decode(bytes: Uint8Array | ArrayBuffer): Promise<AudioSound>;
  play(sound: AudioSound, options?: AudioPlayOptions): AudioVoice;
  /** One music at a time: the one before it is stopped over the same fade. */
  playMusic(sound: AudioSound, options?: AudioMusicOptions): AudioVoice;
  stopMusic(options?: AudioFade): void;
  /** Stops every voice, or every voice of one bus. */
  stopAll(options?: AudioFade & { readonly bus?: string }): void;
  /** Asks for silence under a name. Every name that asked has to let go before sound returns. */
  suspend(reason?: string): void;
  resume(reason?: string): void;
  /** For the host: whether it lets the output start. */
  setLocked(locked: boolean): void;
  /** Told the new state each time it changes. */
  subscribe(listener: (state: AudioMixerState) => void): () => void;
  snapshot(): AudioMixerSnapshot;
  /** Ends every voice, releases every sound and closes the backend. A scope can own the mixer through this. */
  dispose(): void;
}
