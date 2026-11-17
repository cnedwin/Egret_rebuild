// SPDX-License-Identifier: Apache-2.0
// Optional entry for a whole small game from one call: the canvas, the loop, keys and a pointer to ask each frame,
// sound effects made in code, overlap tests, timers, text, tweens and the small effects of a hit.
export { play, PlayText } from './BrowserPlay.js';
export type {
  PlayBurstOptions,
  PlayButton,
  PlayButtonOptions,
  PlayGame,
  PlayKeys,
  PlayMotion,
  PlayOptions,
  PlayPointer,
  PlaySfx,
  PlayTextOptions
} from './BrowserPlay.js';
export { SFX_PRESETS, isSfxRecipe, synthesizeSfx } from './playSfx.js';
export type { SfxRecipe, SfxTone, SfxWave } from './playSfx.js';
