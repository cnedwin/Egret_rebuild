import type { NativeGeometryParagraph } from './canvasKitParagraphGeometry.js';
import type { ParagraphProvider } from '@egret/engine/paragraph';
interface NativeOwned {
    delete(): void;
}
export interface NativeTypeface extends NativeOwned {
}
interface NativeFontProvider extends NativeOwned {
    _registerFont(face: NativeTypeface, alias: number): void;
}
interface NativeLine {
    readonly left?: number;
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
    readonly offsets?: Uint32Array;
    readonly glyphs: Uint16Array;
    readonly positions: Float32Array;
}
interface NativeShapedLine {
    readonly runs: readonly NativeRun[];
}
interface NativeParagraph extends NativeOwned, NativeGeometryParagraph {
    layout(width: number): void;
    getLineMetrics(): readonly NativeLine[];
    getHeight(): number;
    getShapedLines(): readonly NativeShapedLine[];
    unresolvedCodepoints(): readonly number[];
    didExceedMaxLines?(): boolean;
    hasLineEllipsis?(index: number): boolean;
}
interface NativeBuilder extends NativeOwned {
    addText(text: string): void;
    build(): NativeParagraph | null;
    pushStyle?(style: object): void;
    pop?(): void;
}
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
        width: number;
        height: number;
        colorType: unknown;
        alphaType: unknown;
        colorSpace: unknown;
    }): Uint8Array | null;
}
interface NativeSurface {
    getCanvas(): NativeCanvas;
    flush(): void;
    dispose(): void;
}
/** Minimal host-injected CanvasKit port. The adapter performs no module loading. */
export interface CanvasKitParagraphModule {
    readonly Typeface: {
        MakeTypefaceFromData(bytes: Uint8Array): NativeTypeface | null;
        _MakeTypefaceFromData?(pointer: number, length: number): NativeTypeface | null;
    };
    readonly TypefaceFontProvider: {
        Make(): NativeFontProvider | null;
    };
    readonly ParagraphBuilder: {
        readonly prototype?: {
            readonly pushStyle?: unknown;
            readonly pop?: unknown;
        };
        MakeFromFontProvider(style: object, fonts: NativeFontProvider): NativeBuilder | null;
    };
    readonly ParagraphStyle: new (style: object) => object;
    readonly TextStyle?: new (style: object) => object;
    readonly Paragraph?: {
        readonly prototype: {
            readonly didExceedMaxLines?: unknown;
            readonly hasLineEllipsis?: unknown;
            readonly getGlyphInfoAt?: unknown;
            readonly getShapedLines?: unknown;
        };
    };
    readonly EgretParagraphLayoutVersion?: number;
    readonly Font: new (face: NativeTypeface, size: number, scaleX: number, skewX: number) => NativeFont;
    readonly TextDirection: {
        readonly LTR: unknown;
        readonly RTL: unknown;
    };
    readonly TextAlign: {
        readonly Left: unknown;
        readonly Right?: unknown;
        readonly Center?: unknown;
        readonly Justify?: unknown;
    };
    readonly FontHinting: {
        readonly Slight: unknown;
    };
    readonly FontEdging: {
        readonly AntiAlias: unknown;
    };
    readonly ColorType: {
        readonly RGBA_8888: unknown;
    };
    readonly AlphaType: {
        readonly Unpremul: unknown;
    };
    readonly ColorSpace: {
        readonly SRGB: unknown;
    };
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
/**
 * CPU raster adapter using standard CanvasKit paragraph APIs and explicit font bytes.
 * Hosts select a qualified native build; final-line and layout controls share its glyph plan.
 * No private qualification snapshot or its 1024-byte/16-line envelope is used.
 */
/** Internal capability port shared by fixed and generation-aware adapters. */
export declare function canvasKitParagraphCapabilities(ck: CanvasKitParagraphModule): Readonly<{
    styledRuns: boolean;
    textGeometry: boolean;
    textAlign: boolean;
    maxLines: boolean;
}>;
export declare function createCanvasKitParagraphProvider(options: CanvasKitParagraphProviderOptions): CanvasKitParagraphProvider;
/** Internal native ownership port; the public fixed-font API is unchanged. */
export interface NativeFontBorrow {
    readonly face: NativeTypeface;
    release(): void;
}
/** CanvasKit's raw binding takes ownership of the allocation, including a null decode result. */
export declare function decodeCanvasKitFont(ck: CanvasKitParagraphModule, data: Uint8Array): NativeTypeface | null;
export declare function createCanvasKitParagraphProviderOwned(options: CanvasKitParagraphProviderOptions, borrowFont?: (font: CanvasKitParagraphFont) => NativeFontBorrow): CanvasKitParagraphProvider;
export {};
//# sourceMappingURL=CanvasKitParagraphProvider.d.ts.map