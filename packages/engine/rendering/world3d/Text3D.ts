// SPDX-License-Identifier: Apache-2.0
// Text as geometry: a font supplies glyph outlines, the outlines become flat
// shapes, and the shapes are filled or given depth. Fonts are read either
// straight from a TrueType file (.ttf, or .otf/.ttc with TrueType outlines)
// or from the typeface JSON format used by web 3D tools. Layout is simple
// left-to-right text with line breaks; there is no shaping, so scripts that
// need joined or reordered letters are not laid out correctly.
import {World3DError, requireFinite3D, requirePositive3D} from './core3D.js';
import {Path2D3D, Shape3D, signedArea2D} from './Curves3D.js';
import type {Point2D} from './Curves3D.js';
import type {Geometry3D} from './Geometry3D.js';
import {createExtrudeGeometry3D, createShapeGeometry3D} from './geometries3D.js';

export const TEXT3D_LIMITS = Object.freeze({maxCharacters: 4096, maxFontBytes: 67108864, maxGlyphPoints: 65536, maxCompositeDepth: 8} as const);

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

function inside(point: Point2D, polygon: readonly Point2D[]): boolean {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i]!, b = polygon[j]!;
        if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
}

export class Font3D {
    readonly unitsPerEm: number;
    readonly ascender: number;
    readonly descender: number;
    readonly lineHeight: number;
    readonly familyName: string;
    readonly #source: FontSource3D;
    readonly #cache = new Map<number, GlyphOutline3D | undefined>();

    constructor(source: FontSource3D) {
        if (!source || typeof source.glyph !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'font');
        this.unitsPerEm = requirePositive3D(source.unitsPerEm, 'font unitsPerEm');
        this.ascender = requireFinite3D(source.ascender, 'font ascender');
        this.descender = requireFinite3D(source.descender, 'font descender');
        this.lineHeight = requirePositive3D(source.lineHeight, 'font lineHeight');
        this.familyName = source.familyName ?? '';
        this.#source = source;
    }
    /** Outline of a code point; decoded once and kept. */
    glyph(codePoint: number): GlyphOutline3D | undefined {
        if (this.#cache.has(codePoint)) return this.#cache.get(codePoint);
        const glyph = this.#source.glyph(codePoint);
        this.#cache.set(codePoint, glyph);
        return glyph;
    }
    hasGlyph(character: string): boolean { return this.glyph(character.codePointAt(0) ?? -1) !== undefined; }
    /** Width of the widest line, in world units. */
    measureText(text: string, options: TextLayoutOptions3D = {}): number {
        let widest = 0;
        for (const line of this.layout(text, options)) widest = Math.max(widest, line.width);
        return widest;
    }
    /** Lines of placed glyphs: pen position of each glyph and the line's width, in world units. */
    private layout(text: string, options: TextLayoutOptions3D): {glyphs: {glyph: GlyphOutline3D; x: number}[]; width: number}[] {
        if (typeof text !== 'string') throw new World3DError('WORLD3D_INPUT_INVALID', 'text');
        if (text.length > TEXT3D_LIMITS.maxCharacters) throw new World3DError('WORLD3D_BUDGET', 'text length');
        const scale = requirePositive3D(options.size ?? 1, 'text size') / this.unitsPerEm, spacing = requireFinite3D(options.letterSpacing ?? 0, 'letterSpacing');
        const fallback = this.glyph(63), lines: {glyphs: {glyph: GlyphOutline3D; x: number}[]; width: number}[] = [];
        for (const line of text.split('\n')) {
            const glyphs: {glyph: GlyphOutline3D; x: number}[] = [];
            let x = 0, width = 0;
            for (const character of line) {
                const code = character.codePointAt(0)!;
                if (code === 13) continue;
                // A missing character shows as a question mark, or as a gap when the font lacks that too.
                const glyph = this.glyph(code) ?? fallback;
                if (!glyph) { x += this.unitsPerEm * 0.5 * scale + spacing; continue; }
                glyphs.push({glyph, x});
                width = x + glyph.advance * scale;
                x = width + spacing;
            }
            lines.push({glyphs, width});
        }
        return lines;
    }
    /**
     * Outlines of a text as shapes in the XY plane: the first baseline lies
     * on y = 0 and further lines go down. Counters such as the inside of an
     * "o" become holes.
     */
    generateShapes(text: string, options: TextLayoutOptions3D = {}): Shape3D[] {
        const size = requirePositive3D(options.size ?? 1, 'text size'), scale = size / this.unitsPerEm, segments = Math.min(Math.max(Math.floor(options.curveSegments ?? 6), 1), 64);
        const lineStep = this.lineHeight * scale * requirePositive3D(options.lineHeight ?? 1, 'lineHeight'), align = options.align ?? 'left';
        const shapes: Shape3D[] = [];
        this.layout(text, options).forEach((line, row) => {
            const shift = align === 'center' ? -line.width / 2 : align === 'right' ? -line.width : 0, y = -row * lineStep;
            for (const placed of line.glyphs) this.glyphShapes(placed.glyph, placed.x + shift, y, scale, segments, shapes);
        });
        return shapes;
    }
    private glyphShapes(glyph: GlyphOutline3D, offsetX: number, offsetY: number, scale: number, segments: number, out: Shape3D[]): void {
        const c = glyph.commands, contours: Point2D[][] = [];
        let current: Point2D[] | undefined, x = 0, y = 0;
        const at = (i: number): number => c[i]! * scale;
        for (let i = 0; i < c.length;) {
            const op = c[i++]!;
            if (op === 0) { contours.push(current = []); x = at(i) + offsetX; y = at(i + 1) + offsetY; i += 2; current.push([x, y]); continue; }
            if (!current) throw new World3DError('WORLD3D_INPUT_INVALID', 'glyph outline');
            if (op === 1) { x = at(i) + offsetX; y = at(i + 1) + offsetY; i += 2; current.push([x, y]); }
            else if (op === 2) {
                const cx = at(i) + offsetX, cy = at(i + 1) + offsetY, ex = at(i + 2) + offsetX, ey = at(i + 3) + offsetY;
                i += 4;
                for (let s = 1; s <= segments; s++) { const t = s / segments, k = 1 - t; current.push([k * k * x + 2 * k * t * cx + t * t * ex, k * k * y + 2 * k * t * cy + t * t * ey]); }
                x = ex; y = ey;
            } else if (op === 3) {
                const ax = at(i) + offsetX, ay = at(i + 1) + offsetY, bx = at(i + 2) + offsetX, by = at(i + 3) + offsetY, ex = at(i + 4) + offsetX, ey = at(i + 5) + offsetY;
                i += 6;
                for (let s = 1; s <= segments; s++) {
                    const t = s / segments, k = 1 - t, p = k * k * k, q = 3 * k * k * t, r = 3 * k * t * t, w = t * t * t;
                    current.push([p * x + q * ax + r * bx + w * ex, p * y + q * ay + r * by + w * ey]);
                }
                x = ex; y = ey;
            } else throw new World3DError('WORLD3D_INPUT_INVALID', 'glyph outline');
        }
        // Drop repeated points and outlines without area.
        const rings: {points: Point2D[]; area: number}[] = [];
        for (const contour of contours) {
            const points: Point2D[] = [];
            for (const p of contour) { const last = points[points.length - 1]; if (!last || Math.abs(last[0] - p[0]) > 1e-9 || Math.abs(last[1] - p[1]) > 1e-9) points.push(p); }
            const first = points[0], last = points[points.length - 1];
            if (points.length > 1 && first && last && Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) points.pop();
            const area = points.length >= 3 ? Math.abs(signedArea2D(points)) : 0;
            if (area > 1e-12) rings.push({points, area});
        }
        // An outline inside an even number of others is solid; inside an odd number, a hole of the smallest one around it.
        const depth = rings.map((ring, i) => rings.reduce((n, other, j) => n + (i !== j && inside(ring.points[0]!, other.points) ? 1 : 0), 0));
        const solids = new Map<number, Shape3D>();
        rings.forEach((ring, i) => { if (depth[i]! % 2 === 0) { const shape = new Shape3D(ring.points); solids.set(i, shape); out.push(shape); } });
        rings.forEach((ring, i) => {
            if (depth[i]! % 2 === 0) return;
            let owner = -1;
            for (const j of solids.keys()) if (depth[j] === depth[i]! - 1 && inside(ring.points[0]!, rings[j]!.points) && (owner < 0 || rings[j]!.area < rings[owner]!.area)) owner = j;
            if (owner < 0) return;
            const hole = new Path2D3D();
            for (const p of ring.points) hole.moveTo(p[0], p[1]);
            solids.get(owner)!.holes.push(hole);
        });
    }
}

// ---- typeface JSON ------------------------------------------------------------
/**
 * Read a font in the typeface JSON format (the `*.typeface.json` files used
 * with web 3D libraries). Accepts the parsed object or its text.
 */
export function parseTypefaceFont3D(input: string | Record<string, unknown>): Font3D {
    let json: Record<string, unknown>;
    try { json = typeof input === 'string' ? JSON.parse(input) as Record<string, unknown> : input; }
    catch (cause) { throw new World3DError('WORLD3D_INPUT_INVALID', 'typeface JSON', cause); }
    const glyphs = json?.['glyphs'] as Record<string, {ha?: number; o?: string}> | undefined;
    if (!glyphs || typeof glyphs !== 'object') throw new World3DError('WORLD3D_INPUT_INVALID', 'typeface JSON has no glyphs');
    const unitsPerEm = Number(json['resolution'] ?? 1000), box = json['boundingBox'] as {yMin?: number; yMax?: number} | undefined;
    const ascender = Number(json['ascender'] ?? box?.yMax ?? unitsPerEm * 0.8), descender = Number(json['descender'] ?? box?.yMin ?? -unitsPerEm * 0.2);
    const lineHeight = box && Number.isFinite(box.yMax) && Number.isFinite(box.yMin) ? box.yMax! - box.yMin! + Number(json['underlineThickness'] ?? 0) : ascender - descender;
    return new Font3D({
        unitsPerEm, ascender, descender, lineHeight: lineHeight > 0 ? lineHeight : unitsPerEm, familyName: typeof json['familyName'] === 'string' ? json['familyName'] : '',
        glyph(codePoint) {
            const entry = glyphs[String.fromCodePoint(codePoint)];
            if (!entry) return undefined;
            const tokens = (entry.o ?? '').split(' '), commands: number[] = [];
            const number = (i: number): number => requireFinite3D(Number(tokens[i]), 'typeface outline');
            for (let i = 0; i < tokens.length;) {
                const op = tokens[i++];
                // Curves list their end point first, then the control points.
                if (op === 'm') { commands.push(0, number(i), number(i + 1)); i += 2; }
                else if (op === 'l') { commands.push(1, number(i), number(i + 1)); i += 2; }
                else if (op === 'q') { commands.push(2, number(i + 2), number(i + 3), number(i), number(i + 1)); i += 4; }
                else if (op === 'b') { commands.push(3, number(i + 2), number(i + 3), number(i + 4), number(i + 5), number(i), number(i + 1)); i += 6; }
                else if (op === 'z' || op === '' || op === undefined) continue;
                else throw new World3DError('WORLD3D_INPUT_INVALID', 'typeface outline command');
            }
            return {advance: Number(entry.ha ?? 0), commands};
        },
    });
}

// ---- TrueType -----------------------------------------------------------------
/**
 * Read a TrueType font: a .ttf file, an OpenType file with TrueType (glyf)
 * outlines, or the first font of a .ttc collection. Glyphs are decoded on
 * demand, so large fonts cost only what the text uses. OpenType fonts with
 * PostScript (CFF) outlines are not supported.
 */
export function parseTrueTypeFont3D(input: ArrayBuffer | ArrayBufferView): Font3D {
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : undefined;
    if (!bytes || bytes.length < 12) throw new World3DError('WORLD3D_INPUT_INVALID', 'font data');
    if (bytes.length > TEXT3D_LIMITS.maxFontBytes) throw new World3DError('WORLD3D_BUDGET', 'font size');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    try {
        let start = 0, tag = view.getUint32(0);
        if (tag === 0x74746366) { start = view.getUint32(12); tag = view.getUint32(start); }   // 'ttcf'
        if (tag === 0x4f54544f) throw new World3DError('WORLD3D_INPUT_INVALID', 'fonts with PostScript (CFF) outlines are not supported');
        if (tag !== 0x00010000 && tag !== 0x74727565) throw new World3DError('WORLD3D_INPUT_INVALID', 'not a TrueType font');
        const tables = new Map<string, number>(), count = view.getUint16(start + 4);
        for (let i = 0; i < count; i++) {
            const at = start + 12 + i * 16;
            tables.set(String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3)), view.getUint32(at + 8));
        }
        const table = (name: string): number => {
            const offset = tables.get(name);
            if (offset === undefined) throw new World3DError('WORLD3D_INPUT_INVALID', name === 'glyf' ? 'the font has no TrueType outlines' : 'font table ' + name);
            return offset;
        };
        const head = table('head'), hhea = table('hhea'), hmtx = table('hmtx'), loca = table('loca'), glyf = table('glyf'), cmap = table('cmap');
        const unitsPerEm = view.getUint16(head + 18), longOffsets = view.getInt16(head + 50) !== 0, glyphCount = view.getUint16(table('maxp') + 4);
        const ascender = view.getInt16(hhea + 4), descender = view.getInt16(hhea + 6), lineGap = view.getInt16(hhea + 8), metrics = view.getUint16(hhea + 34);

        // Pick the richest Unicode character map: full range first, then the basic plane.
        let map = -1, format = 0;
        const subtables = view.getUint16(cmap + 2);
        for (let i = 0; i < subtables; i++) {
            const platform = view.getUint16(cmap + 4 + i * 8), encoding = view.getUint16(cmap + 6 + i * 8), offset = cmap + view.getUint32(cmap + 8 + i * 8), kind = view.getUint16(offset);
            const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
            if (unicode && (kind === 12 || kind === 4) && kind > format) { map = offset; format = kind; }
        }
        if (map < 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'the font has no Unicode character map');
        const glyphIndex = (code: number): number => {
            if (format === 12) {
                let low = 0, high = view.getUint32(map + 12) - 1;
                while (low <= high) {
                    const middle = (low + high) >> 1, at = map + 16 + middle * 12, first = view.getUint32(at);
                    if (code < first) high = middle - 1; else if (code > view.getUint32(at + 4)) low = middle + 1; else return view.getUint32(at + 8) + code - first;
                }
                return 0;
            }
            if (code > 0xffff) return 0;
            const segments = view.getUint16(map + 6) >> 1, ends = map + 14, starts = ends + segments * 2 + 2, deltas = starts + segments * 2, ranges = deltas + segments * 2;
            let low = 0, high = segments - 1;
            while (low <= high) {
                const middle = (low + high) >> 1;
                if (code > view.getUint16(ends + middle * 2)) low = middle + 1;
                else if (code < view.getUint16(starts + middle * 2)) high = middle - 1;
                else {
                    const range = view.getUint16(ranges + middle * 2), delta = view.getUint16(deltas + middle * 2);
                    if (range === 0) return (code + delta) & 0xffff;
                    const glyph = view.getUint16(ranges + middle * 2 + range + (code - view.getUint16(starts + middle * 2)) * 2);
                    return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
                }
            }
            return 0;
        };
        const glyphRange = (index: number): [number, number] => longOffsets ? [view.getUint32(loca + index * 4), view.getUint32(loca + index * 4 + 4)]
            : [view.getUint16(loca + index * 2) * 2, view.getUint16(loca + index * 2 + 2) * 2];
        /** Append a glyph's contours as point lists [x, y, onCurve, ...], one list per contour. */
        const contoursOf = (index: number, out: number[][], level: number): void => {
            if (index >= glyphCount || level > TEXT3D_LIMITS.maxCompositeDepth) return;
            const [from, to] = glyphRange(index);
            if (to <= from) return;   // no outline, as for a space
            let at = glyf + from;
            const contours = view.getInt16(at);
            at += 10;
            if (contours >= 0) {
                const ends: number[] = [];
                for (let i = 0; i < contours; i++) { ends.push(view.getUint16(at)); at += 2; }
                const points = contours > 0 ? ends[contours - 1]! + 1 : 0;
                if (points > TEXT3D_LIMITS.maxGlyphPoints) throw new World3DError('WORLD3D_BUDGET', 'glyph points');
                at += 2 + view.getUint16(at);   // skip hinting instructions
                const flags = new Uint8Array(points);
                for (let i = 0; i < points;) {
                    const flag = view.getUint8(at++);
                    flags[i++] = flag;
                    if (flag & 8) { let repeat = view.getUint8(at++); while (repeat-- > 0 && i < points) flags[i++] = flag; }
                }
                const xs = new Int32Array(points), ys = new Int32Array(points);
                let value = 0;
                for (let i = 0; i < points; i++) {
                    const flag = flags[i]!;
                    if (flag & 2) { const delta = view.getUint8(at++); value += flag & 16 ? delta : -delta; } else if (!(flag & 16)) { value += view.getInt16(at); at += 2; }
                    xs[i] = value;
                }
                value = 0;
                for (let i = 0; i < points; i++) {
                    const flag = flags[i]!;
                    if (flag & 4) { const delta = view.getUint8(at++); value += flag & 32 ? delta : -delta; } else if (!(flag & 32)) { value += view.getInt16(at); at += 2; }
                    ys[i] = value;
                }
                let first = 0;
                for (const end of ends) {
                    const contour: number[] = [];
                    for (let i = first; i <= end; i++) contour.push(xs[i]!, ys[i]!, flags[i]! & 1);
                    if (contour.length >= 9) out.push(contour);
                    first = end + 1;
                }
                return;
            }
            // A composite glyph places other glyphs, each with its own offset and optional scale.
            for (let more = true; more;) {
                const flags = view.getUint16(at), component = view.getUint16(at + 2);
                at += 4;
                let dx = 0, dy = 0;
                if (flags & 1) { if (flags & 2) { dx = view.getInt16(at); dy = view.getInt16(at + 2); } at += 4; }
                else { if (flags & 2) { dx = view.getInt8(at); dy = view.getInt8(at + 1); } at += 2; }
                let a = 1, b = 0, c = 0, d = 1;
                if (flags & 8) { a = d = view.getInt16(at) / 16384; at += 2; }
                else if (flags & 0x40) { a = view.getInt16(at) / 16384; d = view.getInt16(at + 2) / 16384; at += 4; }
                else if (flags & 0x80) { a = view.getInt16(at) / 16384; b = view.getInt16(at + 2) / 16384; c = view.getInt16(at + 4) / 16384; d = view.getInt16(at + 6) / 16384; at += 8; }
                const before = out.length;
                contoursOf(component, out, level + 1);
                for (let i = before; i < out.length; i++) {
                    const contour = out[i]!;
                    for (let k = 0; k < contour.length; k += 3) { const x = contour[k]!, y = contour[k + 1]!; contour[k] = a * x + c * y + dx; contour[k + 1] = b * x + d * y + dy; }
                }
                more = (flags & 0x20) !== 0;
            }
        };
        return new Font3D({
            unitsPerEm, ascender, descender, lineHeight: Math.max(ascender - descender + lineGap, 1),
            glyph(codePoint) {
                const index = glyphIndex(codePoint);
                if (index === 0 || index >= glyphCount) return undefined;
                try {
                    const advance = view.getUint16(hmtx + Math.min(index, metrics - 1) * 4), contours: number[][] = [], commands: number[] = [];
                    contoursOf(index, contours, 0);
                    for (const contour of contours) {
                        // Curves are quadratic; two control points in a row imply an on-curve point halfway between them.
                        const n = contour.length / 3, x = (i: number): number => contour[i * 3]!, y = (i: number): number => contour[i * 3 + 1]!, on = (i: number): boolean => contour[i * 3 + 2] === 1;
                        let sx: number, sy: number, from = 0, to = n;
                        if (on(0)) { sx = x(0); sy = y(0); from = 1; }
                        else if (on(n - 1)) { sx = x(n - 1); sy = y(n - 1); to = n - 1; }
                        else { sx = (x(0) + x(n - 1)) / 2; sy = (y(0) + y(n - 1)) / 2; }
                        commands.push(0, sx, sy);
                        let pending = false, cx = 0, cy = 0;
                        for (let i = from; i < to; i++) {
                            if (on(i)) {
                                if (pending) commands.push(2, cx, cy, x(i), y(i)); else commands.push(1, x(i), y(i));
                                pending = false;
                            } else {
                                if (pending) commands.push(2, cx, cy, (cx + x(i)) / 2, (cy + y(i)) / 2);
                                cx = x(i); cy = y(i); pending = true;
                            }
                        }
                        if (pending) commands.push(2, cx, cy, sx, sy);
                    }
                    return {advance, commands};
                } catch (cause) {
                    if (cause instanceof World3DError) throw cause;
                    throw new World3DError('WORLD3D_INPUT_INVALID', 'font glyph data', cause);
                }
            },
        });
    } catch (cause) {
        if (cause instanceof World3DError) throw cause;
        throw new World3DError('WORLD3D_INPUT_INVALID', 'font data', cause);
    }
}

/** Outlines of a text as flat shapes; see Font3D.generateShapes. */
export function createTextShapes3D(text: string, font: Font3D, options: TextLayoutOptions3D = {}): Shape3D[] {
    if (!(font instanceof Font3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'font');
    return font.generateShapes(text, options);
}
/**
 * Text as a mesh geometry in the XY plane, facing +Z, with the first
 * baseline on y = 0. With depth it has two material groups like any
 * extrusion: 0 for the faces, 1 for the sides. The text must contain at
 * least one visible character.
 */
export function createTextGeometry3D(text: string, font: Font3D, options: TextGeometryOptions3D = {}): Geometry3D {
    const shapes = createTextShapes3D(text, font, options);
    if (shapes.length === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'the text has no visible characters');
    const depth = requireFinite3D(options.depth ?? (options.size ?? 1) * 0.2, 'text depth');
    return depth > 0 ? createExtrudeGeometry3D(shapes, {depth, ...(options.steps !== undefined ? {steps: options.steps} : {})}) : createShapeGeometry3D(shapes);
}
