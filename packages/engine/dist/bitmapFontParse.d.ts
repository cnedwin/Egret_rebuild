import type { BitmapFont } from './bitmapFontTypes.js';
/** Whether a value is a font this entry read. */
export declare const isBitmapFont: (value: unknown) => value is BitmapFont;
/**
 * Reads a bitmap font: the text, XML or JSON forms of BMFont (from AngelCode's generator, Hiero, Glyph Designer, Littera and the like),
 * or Egret's own JSON of frames. A string is read as XML when it starts with `<`, as JSON when it starts with `{`, and as text otherwise;
 * white space and a byte order mark before it are left out.
 */
export declare function parseBitmapFont(source: string | object): BitmapFont;
//# sourceMappingURL=bitmapFontParse.d.ts.map