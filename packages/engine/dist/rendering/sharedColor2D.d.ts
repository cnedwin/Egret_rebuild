import type { ImageData2D } from '@egret/contracts';
/** Selected sRGB transfer. Alpha and tint coefficients are never gamma converted. */
export declare function decodeSharedSRGB(value: number): number;
/** The linear-light value of an sRGB byte, from the written table: the same number in every JavaScript engine. */
export declare function decodeSharedSRGBByte(code: number): number;
export declare function encodeSharedSRGB(value: number): number;
/** Plain Host-owned observation only; no allocator, callback or resource authority. */
export interface SharedPageCopyDiagnostics2D {
    canonicalBytes: number;
    scratchBytes: number;
    highCanonicalBytes: number;
    highScratchBytes: number;
    highTemporaryBytes: number;
    saturated: boolean;
}
/** One actual source copy and one tight canonical output; callers reserve that peak first. */
export declare function copySharedPagePixels(image: ImageData2D, diagnostics?: SharedPageCopyDiagnostics2D): Uint8Array<ArrayBuffer>;
//# sourceMappingURL=sharedColor2D.d.ts.map