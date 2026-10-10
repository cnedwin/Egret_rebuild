import type { ProjectionView2D } from './imageProjections2D.js';

/** Realize one owned straight-sRGB crop in an unattached private source canvas. */
export function createCanvasImageProjection(view: ProjectionView2D, pixels: Uint8Array<ArrayBuffer>, ownerDocument: Document): HTMLCanvasElement {
    const canvas = ownerDocument.createElement('canvas');
    canvas.width = view.region.width;
    canvas.height = view.region.height;
    if (canvas.width !== view.region.width || canvas.height !== view.region.height) throw new Error('Private Canvas backing unavailable');
    const context = canvas.getContext('2d', { colorSpace: 'srgb' });
    if (context === null || context.getContextAttributes().colorSpace !== 'srgb') throw new Error('Private sRGB Canvas context unavailable');
    // ImageData retains this buffer view. A byte clone would exceed the reserved 2P+M ledger.
    const clamped = new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength);
    const data = new ImageData(clamped, view.region.width, view.region.height, { colorSpace: 'srgb' });
    if (data.colorSpace !== 'srgb') throw new Error('sRGB ImageData unavailable');
    context.putImageData(data, 0, 0);
    return canvas;
}
