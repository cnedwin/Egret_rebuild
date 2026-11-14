// SPDX-License-Identifier: Apache-2.0
/** Optional bitmap fonts: BMFont and Egret fonts read, text laid out in them, and drawn as one mesh for each page. */
export { parseBitmapFont } from './bitmapFontParse.js';
export { createBitmapText, layoutBitmapText } from './bitmapText.js';
export type {
  BitmapFont, BitmapGlyph, BitmapText, BitmapTextGlyph, BitmapTextLayout, BitmapTextLayoutOptions, BitmapTextLine, BitmapTextOptions,
} from './bitmapFontTypes.js';
