import { copyImageData2DPixels, IMAGE_LIMITS_2D, isImageData2D } from '@egret/contracts';
import type { ImageData2D, RenderFrame2D, TextureRegion2D } from '@egret/contracts';

export class ImageProjectionError extends Error {
    public constructor(public readonly reason: 'budget' | 'invalid') {
        super(`Image projection ${reason}`);
    }
}

export interface ProjectionView2D {
    readonly image: ImageData2D;
    readonly region: TextureRegion2D;
    readonly byteLength: number;
}

export interface ProjectionPlan2D {
    readonly views: readonly ProjectionView2D[];
    readonly commandViews: readonly (number | undefined)[];
    readonly projectionBytes: number;
    readonly scratchBytes: number;
}

function reject(reason: 'budget' | 'invalid', onFailure?: (failure: ImageProjectionError) => void): never {
    const failure = new ImageProjectionError(reason);
    // The observer identifies only deliberate admission in this call; owned Map,
    // array, freeze and allocation faults escape without acquiring that authority.
    onFailure?.(failure);
    throw failure;
}
function bounded(value: number, limit: number, onFailure?: (failure: ImageProjectionError) => void): number {
    if (!Number.isSafeInteger(value) || value < 0 || value > limit) reject('budget', onFailure);
    return value;
}

function projectionLength(image: ImageData2D, region: TextureRegion2D, onFailure?: (failure: ImageProjectionError) => void): number {
    const { x, y, width, height } = region;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) ||
        !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
        x < 0 || y < 0 || width <= 0 || height <= 0) reject('invalid', onFailure);
    const right = x + width, bottom = y + height;
    const rowBytes = 4 * width, pixelCount = width * height, byteLength = 4 * pixelCount;
    if (!Number.isSafeInteger(right) || !Number.isSafeInteger(bottom) ||
        right > image.width || bottom > image.height ||
        !Number.isSafeInteger(rowBytes) || !Number.isSafeInteger(pixelCount) ||
        !Number.isSafeInteger(byteLength)) reject('invalid', onFailure);
    return bounded(byteLength, IMAGE_LIMITS_2D.maxProjectionBytes, onFailure);
}

/** Reserve only metadata from an already copied trusted frame, before any pixel allocation. */
export function planImageProjections(frame: RenderFrame2D, mode: 'straight' | 'premultiplied', onFailure?: (failure: ImageProjectionError) => void): ProjectionPlan2D {
    const views: ProjectionView2D[] = [];
    const commandViews: (number | undefined)[] = [];
    const identities = new Map<ImageData2D, Map<string, number>>();
    let projectionBytes = 0, maxSourceCopy = 0;
    for (let commandIndex = 0; commandIndex < frame.commands.length; commandIndex++) {
        const command = frame.commands[commandIndex]!;
        if (command.kind === 'rect') {
            commandViews.push(undefined);
            continue;
        }
        const image = frame.images?.[command.imageIndex];
        // Reauthentication precedes metadata reads; a forged identity cannot supply source bytes.
        if (!isImageData2D(image)) reject('invalid', onFailure);
        let regions = identities.get(image);
        if (regions === undefined) {
            regions = new Map();
            identities.set(image, regions);
        }
        const region = command.sourceRect;
        const key = `${region.x},${region.y},${region.width},${region.height}`;
        let viewIndex = regions.get(key);
        if (viewIndex === undefined) {
            const byteLength = projectionLength(image, region, onFailure);
            bounded(views.length + 1, IMAGE_LIMITS_2D.maxViewsPerFrame, onFailure);
            projectionBytes = bounded(projectionBytes + byteLength, IMAGE_LIMITS_2D.maxProjectionBytes, onFailure);
            maxSourceCopy = bounded(Math.max(maxSourceCopy, image.byteLength), 4 * IMAGE_LIMITS_2D.maxSourcePixels, onFailure);
            viewIndex = views.length;
            views.push(Object.freeze({ image, region, byteLength }));
            regions.set(key, viewIndex);
        }
        // Coverage is deliberately irrelevant: every distinct emitted crop remains owned.
        commandViews.push(viewIndex);
    }
    // Hosts copy views sequentially: all owned crops P plus one live full-source copy M.
    // Canvas also reserves private bitmap backing P; its clamped array is only a buffer view.
    const retainedBytes = bounded(projectionBytes * (mode === 'straight' ? 2 : 1), IMAGE_LIMITS_2D.maxImageScratchBytes, onFailure);
    const scratchBytes = bounded(retainedBytes + maxSourceCopy, IMAGE_LIMITS_2D.maxImageScratchBytes, onFailure);
    return Object.freeze({ views: Object.freeze(views), commandViews: Object.freeze(commandViews), projectionBytes, scratchBytes });
}

/** Return a standalone tight crop; neither source ownership nor another output is exposed. */
export function copyProjectionPixels(view: ProjectionView2D, mode: 'straight' | 'premultiplied'): Uint8Array<ArrayBuffer> {
    const image = view.image;
    if (!isImageData2D(image)) throw new ImageProjectionError('invalid');
    const region = view.region;
    const byteLength = projectionLength(image, region);
    if (view.byteLength !== byteLength) throw new ImageProjectionError('invalid');
    // Native allocation/copy faults escape intact. Only this full-source copy lives during extraction.
    const source = copyImageData2DPixels(image);
    const pixels = new Uint8Array(byteLength);
    const rowBytes = 4 * region.width;
    for (let row = 0; row < region.height; row++) {
        const sourceOffset = (region.y + row) * image.bytesPerRow + 4 * region.x;
        const outputOffset = row * rowBytes;
        for (let byte = 0; byte < rowBytes; byte++) pixels[outputOffset + byte] = source[sourceOffset + byte]!;
    }
    if (mode === 'premultiplied') {
        // Convert the owned crop in place: encoded RGB uses exact integer policy; alpha is unchanged.
        for (let offset = 0; offset < byteLength; offset += 4) {
            const alpha = pixels[offset + 3]!;
            pixels[offset] = Math.floor((pixels[offset]! * alpha + 127) / 255);
            pixels[offset + 1] = Math.floor((pixels[offset + 1]! * alpha + 127) / 255);
            pixels[offset + 2] = Math.floor((pixels[offset + 2]! * alpha + 127) / 255);
        }
    }
    return pixels;
}
