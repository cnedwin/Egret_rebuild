// SPDX-License-Identifier: Apache-2.0
import { createImageData2D, IMAGE_LIMITS_2D } from '@egret/contracts';
import type { CancellationSignal } from '@egret/contracts';
import { EgretError } from '@egret/runtime';
import type { ParagraphProvider, ParagraphRaster, ParagraphRequest } from '@egret/engine/paragraph';

interface NativeOwned { delete(): void; }
interface NativeTypeface extends NativeOwned {}
interface NativeFontProvider extends NativeOwned { _registerFont(face: NativeTypeface, alias: number): void; }
interface NativeLine {
    readonly startIndex: number;
    readonly endIndex: number;
    readonly baseline: number;
    readonly ascent: number;
    readonly descent: number;
    readonly height: number;
    readonly width: number;
}
interface NativeRun {
    readonly typeface: NativeTypeface;
    readonly size: number;
    readonly scaleX?: number;
    readonly glyphs: Uint16Array;
    readonly positions: Float32Array;
}
interface NativeShapedLine { readonly runs: readonly NativeRun[]; }
interface NativeParagraph extends NativeOwned {
    layout(width: number): void;
    getLineMetrics(): readonly NativeLine[];
    getHeight(): number;
    getShapedLines(): readonly NativeShapedLine[];
    unresolvedCodepoints(): readonly number[];
    didExceedMaxLines?(): boolean;
    hasLineEllipsis?(index: number): boolean;
}
interface NativeBuilder extends NativeOwned { addText(text: string): void; build(): NativeParagraph | null; }
interface NativeFont extends NativeOwned {
    setSubpixel(enabled: boolean): void;
    setHinting(hinting: unknown): void;
    setEdging(edging: unknown): void;
    getGlyphBounds(glyphs: Uint16Array): Float32Array;
}
interface NativeCanvas {
    clear(color: Float32Array): void;
    scale(x: number, y: number): void;
    translate(x: number, y: number): void;
    drawParagraph(paragraph: NativeParagraph, x: number, y: number): void;
    readPixels(x: number, y: number, info: {
        width: number; height: number; colorType: unknown; alphaType: unknown; colorSpace: unknown;
    }): Uint8Array | null;
}
interface NativeSurface { getCanvas(): NativeCanvas; flush(): void; dispose(): void; }

/** Minimal host-injected CanvasKit port. The adapter performs no module loading. */
export interface CanvasKitParagraphModule {
    readonly Typeface: { MakeTypefaceFromData(bytes: Uint8Array): NativeTypeface | null };
    readonly TypefaceFontProvider: { Make(): NativeFontProvider | null };
    readonly ParagraphBuilder: { MakeFromFontProvider(style: object, fonts: NativeFontProvider): NativeBuilder | null };
    readonly ParagraphStyle: new (style: object) => object;
    readonly Paragraph?: { readonly prototype: { readonly didExceedMaxLines?: unknown; readonly hasLineEllipsis?: unknown } };
    readonly EgretParagraphLayoutVersion?: number;
    readonly Font: new (face: NativeTypeface, size: number, scaleX: number, skewX: number) => NativeFont;
    readonly TextDirection: { readonly LTR: unknown; readonly RTL: unknown };
    readonly TextAlign: { readonly Left: unknown; readonly Right?: unknown; readonly Center?: unknown; readonly Justify?: unknown };
    readonly FontHinting: { readonly Slight: unknown };
    readonly FontEdging: { readonly AntiAlias: unknown };
    readonly ColorType: { readonly RGBA_8888: unknown };
    readonly AlphaType: { readonly Unpremul: unknown };
    readonly ColorSpace: { readonly SRGB: unknown };
    readonly TRANSPARENT: Float32Array;
    readonly HEAPU8: Uint8Array;
    Color4f(red: number, green: number, blue: number, alpha: number): Float32Array;
    MakeSurface(width: number, height: number): NativeSurface | null;
    _malloc(bytes: number): number;
    _free(pointer: number): void;
}
export interface CanvasKitParagraphFont {
    readonly family: string;
    readonly data: Uint8Array;
    /** Caller-declared immutable font identity, preferably the original byte SHA-256. */
    readonly identity: string;
}
export interface CanvasKitParagraphProviderOptions {
    readonly canvasKit: CanvasKitParagraphModule;
    /** Host-declared build identity; omission identifies only this module instance. */
    readonly buildIdentity?: string;
    readonly fonts: readonly CanvasKitParagraphFont[];
}
export interface CanvasKitParagraphProvider extends ParagraphProvider {
    /** Explicitly retires this provider's font wrappers; caches borrow the provider. */
    dispose(): void;
}

const moduleIdentities = new WeakMap<object, number>();
let nextModuleIdentity = 1;

function bounded(value: number, low: number, high: number, label: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) {
        throw new RangeError('Paragraph ' + label + ' is outside the admitted range');
    }
    return value;
}
function scalarText(text: string): void {
    if (typeof text !== 'string' || text.length > 8192) throw new RangeError('Paragraph source limit exceeded');
    for (let index = 0; index < text.length; index++) {
        const unit = text.charCodeAt(index);
        if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = text.charCodeAt(++index);
            if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError('Malformed paragraph UTF-16');
        } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new TypeError('Malformed paragraph UTF-16');
    }
}
function token(value: string, limit: number, label: string): void {
    if (typeof value !== 'string' || !value.length || value.length > limit || /[\x00-\x1f\x7f]/.test(value)) {
        throw new TypeError('Invalid paragraph ' + label);
    }
}

/** Transcode CR/CRLF only for layout; keep exact authored UTF16 boundaries. */
function nativeLayoutSource(source: string): { text: string; boundaries: Uint32Array | undefined } {
    if (!source.includes('\r')) return {text: source, boundaries: undefined};
    const units: string[] = [], boundaries = [0];
    for (let index = 0; index < source.length; index++) {
        if (source.charCodeAt(index) === 13) {
            if (source.charCodeAt(index + 1) === 10) index++;
            units.push('\n');
        } else units.push(source.charAt(index));
        boundaries.push(index + 1);
    }
    return {text: units.join(''), boundaries: Uint32Array.from(boundaries)};
}

/**
 * CPU raster adapter using standard CanvasKit paragraph APIs and explicit font bytes.
 * Hosts select a qualified native build; final-line and layout controls share its glyph plan.
 * No private qualification snapshot or its 1024-byte/16-line envelope is used.
 */
export function createCanvasKitParagraphProvider(options: CanvasKitParagraphProviderOptions): CanvasKitParagraphProvider {
    const ck = options.canvasKit;
    const supplied = options.fonts;
    if (!Array.isArray(supplied) || supplied.length < 1 || supplied.length > 16) throw new RangeError('Paragraph font count');
    const families = new Set<string>();
    let fontBytes = 0;
    // Snapshot bytes before invoking the host's decoder. Identity is a declaration,
    // not a claim that this synchronous adapter recomputes a cryptographic hash.
    const inputs = supplied.map(font => {
        token(font.family, 256, 'font family'); token(font.identity, 512, 'font identity');
        if (families.has(font.family)) throw new TypeError('Duplicate paragraph font family');
        families.add(font.family);
        if (!(font.data instanceof Uint8Array) || !font.data.byteLength) throw new TypeError('Paragraph font bytes required');
        fontBytes += font.data.byteLength;
        if (fontBytes > 33554432) throw new RangeError('Paragraph font byte limit exceeded');
        return { family: font.family, identity: font.identity, data: Uint8Array.from(font.data) };
    });
    let moduleIdentity = moduleIdentities.get(ck);
    if (moduleIdentity === undefined) { moduleIdentity = nextModuleIdentity++; moduleIdentities.set(ck, moduleIdentity); }
    if (options.buildIdentity !== undefined) token(options.buildIdentity, 512, 'build identity');
    // Capture enum ports before publication; prepare never invokes late enum getters.
    const alignments = Object.freeze({left: ck.TextAlign.Left, right: ck.TextAlign.Right,
        center: ck.TextAlign.Center, justify: ck.TextAlign.Justify});
    const capabilities = Object.freeze({
        textAlign: alignments.right !== undefined && alignments.center !== undefined && alignments.justify !== undefined,
        maxLines: ck.EgretParagraphLayoutVersion === 1 && typeof ck.Paragraph?.prototype?.didExceedMaxLines === 'function'
            && typeof ck.Paragraph?.prototype?.hasLineEllipsis === 'function',
    });
    const identity = 'egret.canvaskit-paragraph.v2:' + JSON.stringify([options.buildIdentity ?? 'host-module-' + moduleIdentity, inputs.map(font => [font.family, font.identity]), capabilities.textAlign, capabilities.maxLines]);
    if (identity.length > 8192) throw new RangeError('Paragraph combined provider identity limit exceeded');
    const roots: NativeOwned[] = [];
    let closed = false;
    let fatal = false;
    let busy = false;
    const native = <T>(work: () => T): T => {
        if (fatal) throw new EgretError('PARAGRAPH_BACKEND_TERMINAL');
        try { return work(); }
        catch (cause) {
            if (cause instanceof WebAssembly.RuntimeError || /Aborted\(/.test(String(cause))) fatal = true;
            throw cause;
        }
    };
    const retire = (owned: NativeOwned[], surface?: NativeSurface): void => {
        if (fatal) return; // A trapped generation cannot be used for native cleanup.
        const failures: unknown[] = [];
        if (surface !== undefined) {
            try { native(() => surface.dispose()); } catch (cause) { failures.push(cause); }
        }
        for (const item of owned.reverse()) {
            if (fatal) break;
            try { native(() => item.delete()); } catch (cause) { failures.push(cause); }
        }
        owned.length = 0;
        if (failures.length) {
            closed = true;
            throw new EgretError('PARAGRAPH_BACKEND_CLEANUP_FAILED', { cause: failures[0], cleanupErrors: failures });
        }
    };
    let fontProvider: NativeFontProvider;
    try {
        const created = native(() => ck.TypefaceFontProvider.Make());
        if (created === null) throw new EgretError('PARAGRAPH_FONT_PROVIDER_REFUSED');
        fontProvider = created; roots.push(created);
        for (const font of inputs) {
            const face = native(() => ck.Typeface.MakeTypefaceFromData(font.data));
            if (face === null) throw new EgretError('PARAGRAPH_FONT_DECODE_REFUSED');
            roots.push(face);
            const alias = new TextEncoder().encode(font.family + '\0');
            const pointer = native(() => ck._malloc(alias.byteLength));
            if (!Number.isSafeInteger(pointer) || pointer <= 0 || pointer + alias.byteLength > ck.HEAPU8.byteLength) {
                fatal = true;
                throw new EgretError('PARAGRAPH_FONT_ALLOCATION_TERMINAL');
            }
            try {
                ck.HEAPU8.set(alias, pointer);
                native(() => fontProvider._registerFont(face, pointer));
            } finally { if (!fatal) native(() => ck._free(pointer)); }
        }
    } catch (cause) {
        try { retire(roots); } catch { /* Keep the original initialization refusal. */ }
        throw cause;
    }
    // Native streams now own the decoded font copies. No input byte arrays are
    // retained by the returned provider; the face roots remain explicitly owned.
    inputs.length = 0;
    const check = (signal: CancellationSignal): void => {
        if (closed) throw new EgretError('PARAGRAPH_PROVIDER_DISPOSED');
        if (fatal) throw new EgretError('PARAGRAPH_BACKEND_TERMINAL');
        if (signal.aborted) throw new EgretError('PARAGRAPH_PREPARE_CANCELLED', { cause: signal.reason });
    };
    const provider: CanvasKitParagraphProvider = Object.freeze({
        identity, capabilities,
        async prepare(this: CanvasKitParagraphProvider, request: ParagraphRequest, context: { signal: CancellationSignal }): Promise<ParagraphRaster> {
            if (this !== provider || busy) throw new EgretError('PARAGRAPH_PROVIDER_BUSY');
            check(context.signal);
            const sourceText = request.text;
            scalarText(sourceText);
            const layoutSource = nativeLayoutSource(sourceText);
            bounded(request.width, 0.25, 4096, 'width');
            bounded(request.fontSize, 1, 512, 'font size');
            bounded(request.density, 0.25, 4, 'density');
            if (request.lineHeight !== undefined) bounded(request.lineHeight, 1, 1024, 'line height');
            if (!Number.isInteger(request.fillColor) || request.fillColor < 0 || request.fillColor > 0xffffff) throw new RangeError('Paragraph fill color');
            token(request.locale, 64, 'locale');
            if (request.direction !== 'ltr' && request.direction !== 'rtl') throw new TypeError('Paragraph direction');
            if (!Array.isArray(request.fontFamilies) || request.fontFamilies.length < 1 || request.fontFamilies.some(family => !families.has(family))) {
                throw new EgretError('PARAGRAPH_FONT_NOT_REGISTERED');
            }
            const textAlign = request.textAlign ?? 'left', maxLines = request.maxLines;
            if (!['left','right','center','start','end','justify'].includes(textAlign)) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
            if (maxLines !== undefined && (!Number.isSafeInteger(maxLines) || maxLines < 1 || maxLines > 8193)) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
            if ((textAlign !== 'left' && !capabilities.textAlign) || (maxLines !== undefined && !capabilities.maxLines)) throw new EgretError('PARAGRAPH_FEATURE_UNSUPPORTED');
            const physicalAlign = textAlign === 'start' ? (request.direction === 'rtl' ? 'right' : 'left')
                : textAlign === 'end' ? (request.direction === 'rtl' ? 'left' : 'right') : textAlign;
            const alignment = alignments[physicalAlign];
            busy = true;
            const owned: NativeOwned[] = [];
            let surface: NativeSurface | undefined;
            let failed = false;
            try {
                const color = ck.Color4f((request.fillColor >>> 16) / 255, ((request.fillColor >>> 8) & 255) / 255, (request.fillColor & 255) / 255, 1);
                const style = new ck.ParagraphStyle({
                    textStyle: { color, fontFamilies: [...request.fontFamilies], fontSize: request.fontSize, locale: request.locale },
                    textDirection: request.direction === 'rtl' ? ck.TextDirection.RTL : ck.TextDirection.LTR,
                    textAlign: alignment, applyRoundingHack: false,
                    ...(maxLines === undefined ? {} : {maxLines, ellipsis: '\u2026'}),
                    ...(request.lineHeight === undefined ? {} : { strutStyle: {
                        strutEnabled: true, fontFamilies: [...request.fontFamilies], fontSize: request.fontSize,
                        heightMultiplier: request.lineHeight / request.fontSize, halfLeading: true, forceStrutHeight: false,
                    } }),
                });
                const builder = native(() => ck.ParagraphBuilder.MakeFromFontProvider(style, fontProvider));
                if (builder === null) throw new EgretError('PARAGRAPH_BUILD_REFUSED');
                owned.push(builder);
                native(() => builder.addText(layoutSource.text));
                const paragraph = native(() => builder.build());
                if (paragraph === null) throw new EgretError('PARAGRAPH_BUILD_REFUSED');
                owned.push(paragraph);
                native(() => paragraph.layout(request.width));
                if (native(() => paragraph.unresolvedCodepoints()).length) throw new EgretError('PARAGRAPH_GLYPH_UNRESOLVED');
                const lines = native(() => paragraph.getLineMetrics()).map(line => {
                    if (!Number.isInteger(line.startIndex) || !Number.isInteger(line.endIndex) || line.startIndex < 0 || line.endIndex < line.startIndex || line.endIndex > layoutSource.text.length) {
                        throw new EgretError('PARAGRAPH_NATIVE_RANGE_INVALID');
                    }
                    const start = layoutSource.boundaries?.[line.startIndex] ?? line.startIndex;
                    const end = layoutSource.boundaries?.[line.endIndex] ?? line.endIndex;
                    return Object.freeze({ start, end,
                        baseline: bounded(line.baseline, -1048576, 1048576, 'baseline'),
                        ascent: bounded(line.ascent, 0, 1048576, 'ascent'), descent: bounded(line.descent, 0, 1048576, 'descent'),
                        height: bounded(line.height, 0, 1048576, 'line height'), width: bounded(line.width, 0, 1048576, 'line width') });
                });
                const height = bounded(native(() => paragraph.getHeight()), 0, 1048576, 'height');
                if (request.lineHeight !== undefined && lines.some(line => line.height + 0.0001 < request.lineHeight!)) throw new EgretError('PARAGRAPH_MINIMUM_LINE_HEIGHT_UNSUPPORTED');
                // Use actual native overflow state, including a fully fitting last line.
                // The visible line count alone cannot distinguish fit from truncation.
                if (maxLines !== undefined && (typeof paragraph.didExceedMaxLines !== 'function' || typeof paragraph.hasLineEllipsis !== 'function')) throw new EgretError('PARAGRAPH_FEATURE_UNSUPPORTED');
                const truncated = maxLines === undefined ? undefined : native(() => paragraph.didExceedMaxLines!());
                if (maxLines !== undefined && (lines.length > maxLines || typeof truncated !== 'boolean')) throw new EgretError('PARAGRAPH_NATIVE_RANGE_INVALID');
                // The native marker query distinguishes real truncation from a
                // blank last line when the marker cannot fit. Refuse that result
                // before touching committed UI or terminally poisoning the backend.
                if (truncated === true && native(() => paragraph.hasLineEllipsis!(lines.length - 1)) !== true) throw new EgretError('PARAGRAPH_ELLIPSIS_DOES_NOT_FIT');
                const metrics = Object.freeze({ width: request.width, height, lines: Object.freeze(lines), ...(truncated === undefined ? {} : {truncated}) });
                const shaped = native(() => paragraph.getShapedLines());
                // getShapedLines returns owned temporary face wrappers, including
                // repeats. Register every wrapper before inspecting any glyph data.
                for (const line of shaped) for (const run of line.runs) owned.push(run.typeface);
                let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
                for (const line of shaped) for (const run of line.runs) {
                    if (!run.glyphs.length) continue;
                    const font = native(() => new ck.Font(run.typeface, run.size, run.scaleX ?? 1, 0));
                    owned.push(font);
                    native(() => font.setSubpixel(true));
                    native(() => font.setHinting(ck.FontHinting.Slight));
                    native(() => font.setEdging(ck.FontEdging.AntiAlias));
                    const bounds = native(() => font.getGlyphBounds(run.glyphs));
                    if (bounds.length !== run.glyphs.length * 4 || run.positions.length < run.glyphs.length * 2) throw new EgretError('PARAGRAPH_NATIVE_GLYPH_INVALID');
                    for (let index = 0; index < run.glyphs.length; index++) {
                        // Synthetic ellipsis glyphs are not covered by source-only
                        // unresolvedCodepoints; refuse visible missing glyphs as well.
                        if (truncated === true && run.glyphs[index] === 0) throw new EgretError('PARAGRAPH_GLYPH_UNRESOLVED');
                        const x = bounded(run.positions[index * 2]!, -1048576, 1048576, 'glyph x');
                        const y = bounded(run.positions[index * 2 + 1]!, -1048576, 1048576, 'glyph y');
                        const l = bounded(bounds[index * 4]!, -1048576, 1048576, 'glyph left');
                        const t = bounded(bounds[index * 4 + 1]!, -1048576, 1048576, 'glyph top');
                        const r = bounded(bounds[index * 4 + 2]!, -1048576, 1048576, 'glyph right');
                        const b = bounded(bounds[index * 4 + 3]!, -1048576, 1048576, 'glyph bottom');
                        if (r > l && b > t) { left = Math.min(left, x + l); top = Math.min(top, y + t); right = Math.max(right, x + r); bottom = Math.max(bottom, y + b); }
                    }
                }
                check(context.signal);
                if (!(left < right && top < bottom)) return Object.freeze({ metrics, image: undefined, offsetX: 0, offsetY: 0 });
                const pixelLeft = Math.floor(left * request.density) - 2;
                const pixelTop = Math.floor(top * request.density) - 2;
                const width = Math.ceil(right * request.density) + 2 - pixelLeft;
                const rasterHeight = Math.ceil(bottom * request.density) + 2 - pixelTop;
                if (width > IMAGE_LIMITS_2D.maxSourceEdge || rasterHeight > IMAGE_LIMITS_2D.maxSourceEdge || width * rasterHeight > IMAGE_LIMITS_2D.maxSourcePixels) throw new EgretError('PARAGRAPH_IMAGE_LIMIT');
                const created = native(() => ck.MakeSurface(width, rasterHeight));
                if (created === null) throw new EgretError('PARAGRAPH_RASTER_REFUSED');
                surface = created;
                const canvas = native(() => created.getCanvas()); // Borrowed from surface.
                native(() => canvas.clear(ck.TRANSPARENT));
                native(() => canvas.scale(request.density, request.density));
                native(() => canvas.translate(-pixelLeft / request.density, -pixelTop / request.density));
                native(() => canvas.drawParagraph(paragraph, 0, 0));
                native(() => created.flush());
                const raw = native(() => canvas.readPixels(0, 0, { width, height: rasterHeight,
                    colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB }));
                if (raw === null || raw.byteLength !== width * rasterHeight * 4) throw new EgretError('PARAGRAPH_READBACK_REFUSED');
                const image = createImageData2D({ width, height: rasterHeight, pixels: Uint8Array.from(raw) });
                check(context.signal);
                return Object.freeze({ metrics, image, offsetX: pixelLeft / request.density, offsetY: pixelTop / request.density });
            } catch (cause) { failed = true; throw cause; }
            finally {
                try { retire(owned, surface); } catch (cause) { if (!failed) throw cause; }
                finally { busy = false; }
            }
        },
        dispose(this: CanvasKitParagraphProvider): void {
            if (this !== provider) throw new EgretError('PARAGRAPH_PROVIDER_INVALID');
            if (closed) return;
            if (busy) throw new EgretError('PARAGRAPH_PROVIDER_BUSY');
            closed = true;
            retire(roots);
            if (fatal) throw new EgretError('PARAGRAPH_BACKEND_TERMINAL');
        },
    });
    return provider;
}
