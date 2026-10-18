import { copyImageData2DPixels } from '@egret/contracts';
import type { ImageData2D } from '@egret/contracts';
/** Selected sRGB transfer. Alpha and tint coefficients are never gamma converted. */
export function decodeSharedSRGB(value: number): number { return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }
export function encodeSharedSRGB(value: number): number { return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055; }
const caps = Object.freeze(Array.from({ length: 256 }, (_, alpha) => {
    let code = 0; while (code < 255 && decodeSharedSRGB((code + 1) / 255) <= alpha / 255) code++; return code;
}));
/** One owned source copy and one tight canonical output; callers reserve that peak first. */
export function copySharedPagePixels(image: ImageData2D): Uint8Array<ArrayBuffer> {
    const source = copyImageData2DPixels(image), output = new Uint8Array(source.byteLength);
    for (let offset = 0; offset < source.length; offset += 4) {
        const alpha = source[offset + 3]!, a = alpha / 255, cap = caps[alpha]!;
        for (let channel = 0; channel < 3; channel++) output[offset + channel] = Math.min(cap,
            Math.floor(255 * encodeSharedSRGB(a * decodeSharedSRGB(source[offset + channel]! / 255)) + 0.5));
        output[offset + 3] = alpha;
    }
    return output;
}
