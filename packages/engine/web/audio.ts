// SPDX-License-Identifier: Apache-2.0
// Optional browser sound entry keeps Web Audio out of the default Engine graph.
export { createBrowserAudio, createWebAudioBackend } from './BrowserAudio.js';
export type {
  BrowserAudio,
  BrowserAudioOptions,
  BrowserAudioInput,
  BrowserAudioInputOptions,
  BrowserAudioGlide,
  WebAudioBackend,
  WebAudioBackendOptions
} from './BrowserAudio.js';
