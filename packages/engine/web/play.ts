// SPDX-License-Identifier: Apache-2.0
// Optional entry for a whole small game from one call: the canvas, the loop, keys and a pointer to ask each frame,
// sound effects made in code, overlap tests, timers, text, tweens, the small effects of a hit, and bars, notices,
// boxes of words and menus.
export { play, PlayText } from './BrowserPlay.js';
export type {
  PlayBurstOptions,
  PlayButton,
  PlayButtonOptions,
  PlayGame,
  PlayImageOptions,
  PlayKeys,
  PlayMusic,
  PlayMotion,
  PlayOptions,
  PlayPointer,
  PlaySfx,
  PlayTextOptions,
  PlayTiles,
  PlayTilesOptions
} from './BrowserPlay.js';
export { PlayBar, verticalPlayWords, wrapPlayWords } from './playWidgets.js';
export type { PlayBarOptions, PlayMenuOptions, PlaySayOptions, PlayToastOptions } from './playWidgets.js';
export { SFX_PRESETS, isSfxRecipe, synthesizeSfx } from './playSfx.js';
export { MUSIC_MOODS, MUSIC_PARTS, composeMusic, musicMix } from './playMusic.js';
export type { MusicMood, MusicOptions, MusicPart, MusicPiece } from './playMusic.js';
export type { PlayStickOptions, PlayTouchButtonOptions } from './playTouch.js';
export type { SfxRecipe, SfxTone, SfxWave } from './playSfx.js';
