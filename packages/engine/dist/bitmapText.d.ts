import type { BitmapFont, BitmapText, BitmapTextLayout, BitmapTextLayoutOptions, BitmapTextOptions } from './bitmapFontTypes.js';
/** Lays text out in a bitmap font without drawing it: its lines, where each character goes, and its size. */
export declare function layoutBitmapText(font: BitmapFont, text: string, options?: BitmapTextLayoutOptions): BitmapTextLayout;
/** Draws text in a bitmap font as one mesh for each page it uses, laid out again whenever what it shows changes. */
export declare function createBitmapText(options: BitmapTextOptions): BitmapText;
//# sourceMappingURL=bitmapText.d.ts.map