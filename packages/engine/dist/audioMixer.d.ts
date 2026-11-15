import type { AudioMixer, AudioMixerOptions } from './audioTypes.js';
/**
 * Volumes, voices and one music over a backend that makes the sound. It keeps no clock of its own
 * and starts no work: a fade is a line the backend follows, and the end of a voice is told by it.
 */
export declare function createAudioMixer(options: AudioMixerOptions): AudioMixer;
//# sourceMappingURL=audioMixer.d.ts.map