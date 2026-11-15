import { Shape3D } from './Curves3D.js';
import type { Geometry3D } from './Geometry3D.js';
export declare const TEXT3D_LIMITS: Readonly<{
    readonly maxCharacters: 4096;
    readonly maxFontBytes: 67108864;
    readonly maxGlyphPoints: 65536;
    readonly maxCompositeDepth: 8;
}>;
/**
 * One glyph in font units. `commands` is a flat list of pen commands:
 * 0 x y (start a contour), 1 x y (line), 2 cx cy x y (quadratic curve) and
 * 3 c1x c1y c2x c2y x y (cubic curve).
 */
export interface GlyphOutline3D {
    readonly advance: number;
    readonly commands: readonly number[];
}
export interface FontSource3D {
    readonly unitsPerEm: number;
    readonly ascender: number;
    readonly descender: number;
    /** Distance between baselines in font units. */
    readonly lineHeight: number;
    readonly familyName?: string;
    /** Outline for a Unicode code point, or undefined when the font lacks it. */
    readonly glyph: (codePoint: number) => GlyphOutline3D | undefined;
}
export interface TextLayoutOptions3D {
    /** Height of the em square in world units. Defaults to 1. */
    readonly size?: number;
    /** Segments used for each curved piece of an outline. Defaults to 6. */
    readonly curveSegments?: number;
    /** Extra space after each character, in world units. */
    readonly letterSpacing?: number;
    /** Multiplier on the font's own line spacing. */
    readonly lineHeight?: number;
    /** How lines are placed against x = 0. Defaults to 'left'. */
    readonly align?: 'left' | 'center' | 'right';
}
export interface TextGeometryOptions3D extends TextLayoutOptions3D {
    /** Thickness along +Z. Zero gives flat text. Defaults to a fifth of the size. */
    readonly depth?: number;
    /** Subdivisions along the depth. */
    readonly steps?: number;
}
export declare class Font3D {
    #private;
    readonly unitsPerEm: number;
    readonly ascender: number;
    readonly descender: number;
    readonly lineHeight: number;
    readonly familyName: string;
    constructor(source: FontSource3D);
    /** Outline of a code point; decoded once and kept. */
    glyph(codePoint: number): GlyphOutline3D | undefined;
    hasGlyph(character: string): boolean;
    /** Width of the widest line, in world units. */
    measureText(text: string, options?: TextLayoutOptions3D): number;
    /** Lines of placed glyphs: pen position of each glyph and the line's width, in world units. */
    private layout;
    /**
     * Outlines of a text as shapes in the XY plane: the first baseline lies
     * on y = 0 and further lines go down. Counters such as the inside of an
     * "o" become holes.
     */
    generateShapes(text: string, options?: TextLayoutOptions3D): Shape3D[];
    private glyphShapes;
}
/**
 * Read a font in the typeface JSON format (the `*.typeface.json` files used
 * with web 3D libraries). Accepts the parsed object or its text.
 */
export declare function parseTypefaceFont3D(input: string | Record<string, unknown>): Font3D;
/**
 * Read a TrueType font: a .ttf file, an OpenType file with TrueType (glyf)
 * outlines, or the first font of a .ttc collection. Glyphs are decoded on
 * demand, so large fonts cost only what the text uses. OpenType fonts with
 * PostScript (CFF) outlines are not supported.
 */
export declare function parseTrueTypeFont3D(input: ArrayBuffer | ArrayBufferView): Font3D;
/** Outlines of a text as flat shapes; see Font3D.generateShapes. */
export declare function createTextShapes3D(text: string, font: Font3D, options?: TextLayoutOptions3D): Shape3D[];
/**
 * Text as a mesh geometry in the XY plane, facing +Z, with the first
 * baseline on y = 0. With depth it has two material groups like any
 * extrusion: 0 for the faces, 1 for the sides. The text must contain at
 * least one visible character.
 */
export declare function createTextGeometry3D(text: string, font: Font3D, options?: TextGeometryOptions3D): Geometry3D;
//# sourceMappingURL=Text3D.d.ts.map