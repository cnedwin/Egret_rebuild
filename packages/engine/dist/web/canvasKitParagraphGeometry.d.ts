import type { ParagraphMetrics, ParagraphRequest, ParagraphTextGeometryData } from '@egret/engine/paragraph';
export interface NativeGeometryLine {
    readonly startIndex: number;
    readonly endIndex: number;
    readonly left?: number;
    readonly width: number;
    readonly baseline: number;
    readonly ascent: number;
    readonly height: number;
}
export interface NativeGeometryParagraph {
    getGlyphInfoAt?(index: number): {
        readonly graphemeClusterTextRange: {
            readonly start: number;
            readonly end: number;
        };
        readonly graphemeLayoutBounds: readonly number[];
        readonly dir: unknown;
        readonly isEllipsis: boolean;
    } | null;
}
/** Copy standard native grapheme advances while the painted paragraph is alive. */
export declare function captureCanvasKitTextGeometry(paragraph: NativeGeometryParagraph, nativeLines: readonly NativeGeometryLine[], request: ParagraphRequest, metrics: ParagraphMetrics, layout: {
    readonly text: string;
    readonly boundaries: Uint32Array | undefined;
}, rtl: unknown, ltr: unknown, native: <T>(work: () => T) => T): ParagraphTextGeometryData;
//# sourceMappingURL=canvasKitParagraphGeometry.d.ts.map