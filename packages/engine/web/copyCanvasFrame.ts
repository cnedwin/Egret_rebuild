import { IMAGE_LIMITS_2D, isImageData2D } from '@egret/contracts';
import type { ImageData2D, Matrix2D, Rectangle2D, RenderCommand2D, RenderFrame2D, TextureRegion2D } from '@egret/contracts';
import type { RectangleFrame2D } from '../rendering/RectangleFrame2D.js';
import { EgretError } from '@egret/runtime';

/** Private host boundary: source failures retain their original cause, not its apparent class. */
export class CanvasImageCopyError extends Error {
    public constructor(public readonly reason: 'invalid' | 'read' | 'budget', options?: ErrorOptions) {
        super(`Canvas image copy ${reason}`, options);
    }
}
interface CopyState {
    imageObserved: boolean;
    sourceIteration: boolean;
    readonly onFailure: ((failure: CanvasImageCopyError | EgretError) => void) | undefined;
}
function fail(state: CopyState, failure: CanvasImageCopyError | EgretError): never {
    // Only deliberate construction reports provenance; public instances from owned
    // operations cannot impersonate this invocation's exact escaping failure.
    state.onFailure?.(failure);
    throw failure;
}
function invalid(state: CopyState): never {
    return fail(state, state.imageObserved ? new CanvasImageCopyError('invalid') : new EgretError('CANVAS_FRAME_INVALID'));
}
function sourceOperation<T>(state: CopyState, action: () => T): T {
    let failure: { cause: unknown };
    try { return action(); }
    catch (cause) {
        if (!state.imageObserved) throw cause;
        failure = { cause };
    }
    // Notify after the source catch, so an observer fault is never a source read.
    return fail(state, new CanvasImageCopyError('read', { cause: failure.cause }));
}
function read(state: CopyState, source: Record<string, unknown>, key: string): unknown {
    return sourceOperation(state, () => source[key]);
}
function array(state: CopyState, value: unknown): value is unknown[] {
    return sourceOperation(state, () => Array.isArray(value));
}
function record(state: CopyState, value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null) invalid(state);
    return value as Record<string, unknown>;
}
function finite(state: CopyState, value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) invalid(state);
    return value;
}
function alpha(state: CopyState, value: unknown): number {
    const result = finite(state, value);
    if (result < 0 || result > 1) invalid(state);
    return result;
}
function color(state: CopyState, value: unknown): number {
    const result = finite(state, value);
    if (!Number.isInteger(result) || result < 0 || result > 0xffffff) invalid(state);
    return result;
}
function matrix(state: CopyState, value: unknown, ratio: number): Matrix2D {
    const source = record(state, value);
    const result = {
        a: finite(state, read(state, source, 'a')), b: finite(state, read(state, source, 'b')),
        c: finite(state, read(state, source, 'c')), d: finite(state, read(state, source, 'd')),
        tx: finite(state, read(state, source, 'tx')), ty: finite(state, read(state, source, 'ty')),
    };
    for (const component of Object.values(result)) finite(state, component * ratio);
    return result;
}
function rectangle(state: CopyState, value: unknown, transform: Matrix2D, ratio: number): Rectangle2D {
    const source = record(state, value);
    const result = {
        x: finite(state, read(state, source, 'x')), y: finite(state, read(state, source, 'y')),
        width: finite(state, read(state, source, 'width')), height: finite(state, read(state, source, 'height')),
    };
    if (result.width < 0 || result.height < 0) invalid(state);
    const right = finite(state, result.x + result.width);
    const bottom = finite(state, result.y + result.height);
    // Validate every derived corner before the first bitmap or state mutation.
    for (const x of [result.x, right]) {
        for (const y of [result.y, bottom]) {
            finite(state, finite(state, transform.a * x + transform.c * y + transform.tx) * ratio);
            finite(state, finite(state, transform.b * x + transform.d * y + transform.ty) * ratio);
        }
    }
    return result;
}
function length(state: CopyState, value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid(state);
    return value;
}
function imageTable(state: CopyState, value: unknown): readonly ImageData2D[] {
    if (!array(state, value)) invalid(state);
    const source = value as unknown as Record<string, unknown>;
    const count = length(state, read(state, source, 'length'));
    // Count rejection precedes allocation and every indexed read, including hostile proxies.
    if (count > IMAGE_LIMITS_2D.maxImagesPerFrame) fail(state, new CanvasImageCopyError('budget'));
    const images: ImageData2D[] = [];
    for (let index = 0; index < count; index++) {
        const image = read(state, source, String(index));
        if (!isImageData2D(image)) invalid(state);
        images.push(image);
    }
    // Authenticate the complete table before any metadata read or payload accounting.
    const identities = new Set<ImageData2D>();
    let bytes = 0;
    for (const image of images) {
        if (identities.has(image)) continue;
        identities.add(image);
        bytes += image.byteLength;
        if (!Number.isSafeInteger(bytes) || bytes > IMAGE_LIMITS_2D.maxImageTableBytes) fail(state, new CanvasImageCopyError('budget'));
    }
    return Object.freeze(images);
}
function sourceRegion(state: CopyState, value: unknown, image: ImageData2D): TextureRegion2D {
    const source = record(state, value);
    // New region fields complete their snapshot before semantics; legacy geometry stays immediate.
    const x = read(state, source, 'x'), y = read(state, source, 'y');
    const width = read(state, source, 'width'), height = read(state, source, 'height');
    if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number' ||
        !Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
        x < 0 || y < 0 || width <= 0 || height <= 0 ||
        !Number.isSafeInteger(x + width) || !Number.isSafeInteger(y + height) || x + width > image.width || y + height > image.height) invalid(state);
    return Object.freeze({ x: x === 0 ? 0 : x, y: y === 0 ? 0 : y, width, height });
}
function copyCanvasFrameMode(value: unknown, ratio: number, budget: number, allowImages: boolean, onImageObserved: () => void, onFailure?: (failure: CanvasImageCopyError | EgretError) => void): { frame: RenderFrame2D; width: number; height: number } {
    const state: CopyState = { imageObserved: false, sourceIteration: false, onFailure };
    const source = record(state, value);
    const frameId = finite(state, read(state, source, 'frameId'));
    const width = finite(state, read(state, source, 'width'));
    const height = finite(state, read(state, source, 'height'));
    if (!Number.isSafeInteger(frameId) || frameId <= 0 || width <= 0 || height <= 0) invalid(state);
    const clearColor = color(state, read(state, source, 'clearColor'));
    const clearAlpha = alpha(state, read(state, source, 'clearAlpha'));
    const input = read(state, source, 'commands');
    if (!array(state, input)) invalid(state);
    const commands: RenderCommand2D[] = [];
    let images: readonly ImageData2D[] | undefined;
    let views: Map<ImageData2D, Set<string>> | undefined;
    let viewCount = 0, projectionBytes = 0;
    let traversalFailure: { cause: unknown; source: boolean } | undefined;
    try {
        // Native for-of retains custom iteration and IteratorClose precedence. Only its
        // machinery is source origin; body validation and owned allocation are not.
        state.sourceIteration = true;
        for (const item of input) {
            state.sourceIteration = false;
            const command = record(state, item);
            const kind = read(state, command, 'kind');
            if (allowImages && kind === 'image' && !state.imageObserved) {
                state.imageObserved = true;
                onImageObserved();
                images = imageTable(state, read(state, source, 'images'));
                views = new Map();
            }
            if (kind !== 'rect' && !(allowImages && kind === 'image')) invalid(state);
            const transform = matrix(state, read(state, command, 'matrix'), ratio);
            const rect = rectangle(state, read(state, command, 'rect'), transform, ratio);
            const fill = kind === 'rect' ? color(state, read(state, command, 'color')) : undefined;
            const opacity = alpha(state, read(state, command, 'alpha'));
            const inputClips = read(state, command, 'clips');
            if (!array(state, inputClips)) invalid(state);
            const clips = [];
            if (kind === 'rect') {
                state.sourceIteration = true;
                for (const itemClip of inputClips) {
                    state.sourceIteration = false;
                    const clip = record(state, itemClip);
                    const clipMatrix = matrix(state, read(state, clip, 'matrix'), ratio);
                    clips.push({ matrix: clipMatrix, rect: rectangle(state, read(state, clip, 'rect'), clipMatrix, ratio) });
                    state.sourceIteration = true;
                }
                state.sourceIteration = false;
                commands.push({ kind: 'rect', matrix: transform, rect, color: fill!, alpha: opacity, clips });
            } else {
                const clipSource = inputClips as unknown as Record<string, unknown>;
                const clipCount = length(state, read(state, clipSource, 'length'));
                for (let index = 0; index < clipCount; index++) {
                    const clip = record(state, read(state, clipSource, String(index)));
                    const clipMatrix = matrix(state, read(state, clip, 'matrix'), ratio);
                    clips.push(Object.freeze({ matrix: Object.freeze(clipMatrix), rect: Object.freeze(rectangle(state, read(state, clip, 'rect'), clipMatrix, ratio)) }));
                }
                const inputIndex = read(state, command, 'imageIndex');
                if (typeof inputIndex !== 'number' || !Number.isSafeInteger(inputIndex) || inputIndex < 0 || inputIndex >= images!.length) invalid(state);
                const imageIndex = inputIndex === 0 ? 0 : inputIndex;
                const image = images![imageIndex]!;
                const sourceRect = sourceRegion(state, read(state, command, 'sourceRect'), image);
                const key = `${sourceRect.x},${sourceRect.y},${sourceRect.width},${sourceRect.height}`;
                let regions = views!.get(image);
                if (regions === undefined) { regions = new Set(); views!.set(image, regions); }
                if (!regions.has(key)) {
                    const bytes = 4 * sourceRect.width * sourceRect.height;
                    viewCount++;
                    projectionBytes += bytes;
                    if (viewCount > IMAGE_LIMITS_2D.maxViewsPerFrame || !Number.isSafeInteger(bytes) ||
                        !Number.isSafeInteger(projectionBytes) || projectionBytes > IMAGE_LIMITS_2D.maxProjectionBytes) fail(state, new CanvasImageCopyError('budget'));
                    regions.add(key);
                }
                commands.push(Object.freeze({ kind: 'image', matrix: Object.freeze(transform), rect: Object.freeze(rect), alpha: opacity, clips: Object.freeze(clips), imageIndex, sourceRect }));
            }
            state.sourceIteration = true;
        }
        state.sourceIteration = false;
    } catch (cause) {
        traversalFailure = { cause, source: state.imageObserved && state.sourceIteration };
    }
    if (traversalFailure !== undefined) {
        // Native IteratorClose has already resolved the abrupt completion's precedence.
        if (traversalFailure.source) fail(state, new CanvasImageCopyError('read', { cause: traversalFailure.cause }));
        throw traversalFailure.cause;
    }
    const backingWidth = Math.ceil(width * ratio);
    const backingHeight = Math.ceil(height * ratio);
    if (
        !Number.isSafeInteger(backingWidth) || !Number.isSafeInteger(backingHeight) ||
        backingWidth <= 0 || backingHeight <= 0 ||
        backingWidth > 4294967295 || backingHeight > 4294967295 ||
        backingWidth > Math.floor(budget / backingHeight)
    ) {
        fail(state, new EgretError('CANVAS_BACKING_LIMIT'));
    }
    const frame: RenderFrame2D = images === undefined ? { frameId, width, height, clearColor, clearAlpha, commands } :
        Object.freeze({ frameId, width, height, clearColor, clearAlpha, commands: Object.freeze(commands), images });
    return { frame, width: backingWidth, height: backingHeight };
}
export function copyCanvasFrame(value: unknown, ratio: number, budget: number): { frame: RectangleFrame2D; width: number; height: number } {
    const copied = copyCanvasFrameMode(value, ratio, budget, false, () => {});
    return { ...copied, frame: copied.frame as RectangleFrame2D };
}
export function copyCanvasMixedFrame(value: unknown, ratio: number, budget: number, onImageObserved: () => void, onFailure?: (failure: CanvasImageCopyError | EgretError) => void): { frame: RenderFrame2D; width: number; height: number } {
    return copyCanvasFrameMode(value, ratio, budget, true, onImageObserved, onFailure);
}
