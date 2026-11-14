// SPDX-License-Identifier: Apache-2.0
/** Optional sound for a 2D game, free of the DOM; importing it creates no output and starts no work. */
export { createAudioMixer } from './audioMixer.js';
export type {
  AudioBackend, AudioBackendBus, AudioBackendSound, AudioBackendStart, AudioBackendVoice, AudioBus, AudioBusOptions, AudioBusSnapshot, AudioEndReason, AudioFade,
  AudioMixer, AudioMixerOptions, AudioMixerSnapshot, AudioMixerState, AudioMusicOptions, AudioPlayOptions, AudioSound, AudioVoice, AudioVoiceState,
} from './audioTypes.js';
