import { copyImageData2DPixels } from '@egret/contracts';
import type { ImageData2D } from '@egret/contracts';
/** Selected sRGB transfer. Alpha and tint coefficients are never gamma converted. */
export function decodeSharedSRGB(value: number): number { return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }
export function encodeSharedSRGB(value: number): number { return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055; }
const caps = Object.freeze(Array.from({ length: 256 }, (_, alpha) => {
    let code = 0; while (code < 255 && decodeSharedSRGB((code + 1) / 255) <= alpha / 255) code++; return code;
}));
/** Plain Host-owned observation only; no allocator, callback or resource authority. */
export interface SharedPageCopyDiagnostics2D {
    canonicalBytes:number; scratchBytes:number;
    highCanonicalBytes:number; highScratchBytes:number; highTemporaryBytes:number; saturated:boolean;
}
function sampleCopy(diagnostics:SharedPageCopyDiagnostics2D):void {
    diagnostics.highCanonicalBytes=Math.max(diagnostics.highCanonicalBytes,diagnostics.canonicalBytes);
    diagnostics.highScratchBytes=Math.max(diagnostics.highScratchBytes,diagnostics.scratchBytes);
    const excess=diagnostics.canonicalBytes>Number.MAX_SAFE_INTEGER-diagnostics.scratchBytes;
    if(excess)diagnostics.saturated=true;
    diagnostics.highTemporaryBytes=Math.max(diagnostics.highTemporaryBytes,excess?Number.MAX_SAFE_INTEGER:diagnostics.canonicalBytes+diagnostics.scratchBytes);
}
/** One actual source copy and one tight canonical output; callers reserve that peak first. */
export function copySharedPagePixels(image: ImageData2D, diagnostics?:SharedPageCopyDiagnostics2D): Uint8Array<ArrayBuffer> {
    let source:ReturnType<typeof copyImageData2DPixels>|undefined,output:Uint8Array<ArrayBuffer>|undefined;
    try {
        source=copyImageData2DPixels(image);
        if(diagnostics){diagnostics.scratchBytes+=source.byteLength;sampleCopy(diagnostics);}
        output=new Uint8Array(source.byteLength);
        if(diagnostics){diagnostics.canonicalBytes+=output.byteLength;sampleCopy(diagnostics);}
        for (let offset = 0; offset < source.length; offset += 4) {
            const alpha = source[offset + 3]!, a = alpha / 255, cap = caps[alpha]!;
            for (let channel = 0; channel < 3; channel++) output[offset + channel] = Math.min(cap,
                Math.floor(255 * encodeSharedSRGB(a * decodeSharedSRGB(source[offset + channel]! / 255)) + 0.5));
            output[offset + 3] = alpha;
        }
        return output;
    } catch(cause) {
        if(diagnostics&&output)diagnostics.canonicalBytes-=output.byteLength;
        throw cause;
    } finally {
        if(diagnostics&&source)diagnostics.scratchBytes-=source.byteLength;
    }
}
