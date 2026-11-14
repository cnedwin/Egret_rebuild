// SPDX-License-Identifier: Apache-2.0
import type { AssetLease, DisplayObjectContainer, Mesh2D, Texture } from '@egret/runtime';

/** One character of a bitmap font: where it is on its page, where it is drawn from the pen, and how far the pen goes on. */
export interface BitmapGlyph {
  /** The Unicode code point. */
  readonly id: number;
  /** Its rectangle on its page, in pixels. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Where it is drawn from the pen: across, and down from the top of the line. */
  readonly xOffset: number;
  readonly yOffset: number;
  /** How far the pen moves on after it. */
  readonly xAdvance: number;
  /** The index of its page. */
  readonly page: number;
}

/** A bitmap font read from a file: frozen, with its characters and the kerning between pairs of them. */
export interface BitmapFont {
  /** The name of the face, where the file says it. */
  readonly face: string;
  /** The size it was made at, where the file says it. */
  readonly size: number;
  /** From the top of one line to the top of the next. */
  readonly lineHeight: number;
  /** From the top of a line to the baseline. */
  readonly base: number;
  /** The file names of the pages, in the order of their indices. */
  readonly pages: readonly string[];
  /** Every character, in the order of their code points. */
  readonly glyphs: readonly BitmapGlyph[];
  /** The format the font was read from. */
  readonly format: 'text' | 'xml' | 'json' | 'egret';
  glyph(codePoint: number): BitmapGlyph | undefined;
  /** What is added to the advance of `first` when `second` follows it; 0 for a pair it does not name. */
  kerning(first: number, second: number): number;
}

export interface BitmapTextLayoutOptions {
  /** Lines are broken to fit this width: after spaces, and between ideographs. A word wider than it is broken between its characters. */
  readonly maxWidth?: number;
  /** Where each line lies within the widest line, or within `maxWidth` when there is one. Defaults to `left`. */
  readonly align?: 'left' | 'center' | 'right';
  /** Added after each character but the last of a line. Defaults to 0. */
  readonly letterSpacing?: number;
  /** Added between lines. Defaults to 0. */
  readonly lineSpacing?: number;
  /** Whether the kerning of the font is used. Defaults to true. */
  readonly kerning?: boolean;
  /** The character drawn for one the font does not have; none draws nothing and moves the pen by nothing. Defaults to `?` where the font has it. */
  readonly fallback?: string | null;
}

/** One character placed: its rectangle in the text and its rectangle on its page. */
export interface BitmapTextGlyph {
  readonly codePoint: number;
  readonly page: number;
  readonly line: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly sourceX: number;
  readonly sourceY: number;
}

export interface BitmapTextLine {
  readonly text: string;
  /** From the left of its first character's advance to the end of its last, spaces at its end left out. */
  readonly width: number;
  /** Where it starts across, as aligned, and the top of it. */
  readonly x: number;
  readonly y: number;
}

/** Text laid out in a font, from its top left. */
export interface BitmapTextLayout {
  /** The widest line, or `maxWidth` when there is one. */
  readonly width: number;
  readonly height: number;
  readonly lines: readonly BitmapTextLine[];
  readonly glyphs: readonly BitmapTextGlyph[];
  /** Characters the font does not have, the fallback drawn for them or not. */
  readonly missing: number;
}

export interface BitmapTextOptions extends BitmapTextLayoutOptions {
  readonly font: BitmapFont;
  /** A leased texture for each page of the font, in the order of its pages. */
  readonly pages: readonly AssetLease<Texture>[];
  readonly text?: string;
  /** The tint the texture is multiplied by, 0xRRGGBB as it is seen: white in the pages shows as this colour. Defaults to white. */
  readonly color?: number;
}

/** Text drawn in a bitmap font, as one mesh for each page it uses. */
export interface BitmapText {
  readonly state: 'active' | 'closed';
  readonly display: DisplayObjectContainer;
  text: string;
  color: number;
  maxWidth: number | undefined;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineSpacing: number;
  readonly width: number;
  readonly height: number;
  /** The layout as last drawn. */
  readonly layout: BitmapTextLayout;
  /** The meshes, one for each page used, in the order of the pages. */
  readonly meshes: readonly Mesh2D[];
  dispose(): void;
}
