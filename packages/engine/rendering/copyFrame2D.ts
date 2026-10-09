import type { ClipRectangle2D, Matrix2D, Rectangle2D, RectangleCommand2D, RenderFrame2D } from '@egret/contracts';

/** Only our validation uses this error; arbitrary input/allocation faults escape intact. */
export class FrameCopyError extends Error {
    public constructor(public readonly reason: 'invalid' | 'backing' | 'budget', cause: unknown = undefined) {
        super(`Frame copy ${reason}`, { cause });
    }
}
/** A getter may throw an old validation error; origin, rather than its class, controls mapping. */
export class FrameInputReadError extends Error {
    public constructor(cause: unknown) { super('Frame input read failed', { cause }); }
}
function read(source: object, key: PropertyKey): unknown {
    try { return (source as Record<PropertyKey, unknown>)[key]; }
    catch (cause) { throw new FrameInputReadError(cause); }
}
export interface FrameCopyOptions {
    readonly pixelRatio: number;
    readonly maxBackingPixels: number;
    readonly maxCommands: number;
    readonly maxClipRectangles: number;
}
function invalid(): never { throw new FrameCopyError('invalid'); }
function object(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null) invalid();
    return value as Record<string, unknown>;
}
function finite(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) invalid();
    return value === 0 ? 0 : value;
}
function opacity(value: unknown): number {
    const number = finite(value);
    if (number < 0 || number > 1) invalid();
    return number;
}
function rgb(value: unknown): number {
    const number = finite(value);
    if (!Number.isInteger(number) || number < 0 || number > 0xffffff) invalid();
    return number;
}
function array(value: unknown): { readonly source: unknown[]; readonly length: number } {
    if (!Array.isArray(value)) invalid();
    const length = read(value, 'length');
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) invalid();
    return { source: value, length };
}
function transform(value: unknown): Matrix2D {
    const source = object(value);
    return Object.freeze({ a: finite(read(source, 'a')), b: finite(read(source, 'b')), c: finite(read(source, 'c')), d: finite(read(source, 'd')), tx: finite(read(source, 'tx')), ty: finite(read(source, 'ty')) });
}
function rectangle(value: unknown, matrix: Matrix2D, ratio: number): Rectangle2D {
    const source = object(value);
    const x = finite(read(source, 'x')), y = finite(read(source, 'y')), width = finite(read(source, 'width')), height = finite(read(source, 'height'));
    if (width < 0 || height < 0) invalid();
    const right = finite(x + width), bottom = finite(y + height);
    // Check every arithmetic operation, including cancellation-prone partial sums.
    for (const px of [x, right]) for (const py of [y, bottom]) {
        finite(finite(finite(finite(matrix.a * px) + finite(matrix.c * py)) + matrix.tx) * ratio);
        finite(finite(finite(finite(matrix.b * px) + finite(matrix.d * py)) + matrix.ty) * ratio);
    }
    return Object.freeze({ x, y, width, height });
}
export function copyFrame2D(input: unknown, options: FrameCopyOptions): { readonly frame: RenderFrame2D; readonly width: number; readonly height: number } {
    const ratio = options.pixelRatio, pixelBudget = options.maxBackingPixels;
    const commandBudget = options.maxCommands, clipBudget = options.maxClipRectangles;
    const source = object(input);
    const frameId = finite(read(source, 'frameId')), width = finite(read(source, 'width')), height = finite(read(source, 'height'));
    if (!Number.isSafeInteger(frameId) || frameId <= 0 || width <= 0 || height <= 0) invalid();
    const clearColor = rgb(read(source, 'clearColor')), clearAlpha = opacity(read(source, 'clearAlpha'));
    const backingWidth = Math.ceil(width * ratio), backingHeight = Math.ceil(height * ratio);
    if (!Number.isSafeInteger(backingWidth) || !Number.isSafeInteger(backingHeight) || backingWidth <= 0 || backingHeight <= 0 || backingWidth > 4294967295 || backingHeight > 4294967295 || backingWidth > Math.floor(pixelBudget / backingHeight)) throw new FrameCopyError('backing');
    const commandsInput = array(read(source, 'commands'));
    if (commandsInput.length > commandBudget) throw new FrameCopyError('budget');
    const commands: RectangleCommand2D[] = [];
    let clipCount = 0;
    // Snapshot length and read each indexed element once; input iterators have no authority.
    for (let index = 0; index < commandsInput.length; index++) {
        const item = object(read(commandsInput.source, index));
        if (read(item, 'kind') !== 'rect') invalid();
        const matrix = transform(read(item, 'matrix')), rect = rectangle(read(item, 'rect'), matrix, ratio);
        const color = rgb(read(item, 'color')), alpha = opacity(read(item, 'alpha'));
        const clipsInput = array(read(item, 'clips'));
        if (clipsInput.length > clipBudget - clipCount) throw new FrameCopyError('budget');
        clipCount += clipsInput.length;
        const clips: ClipRectangle2D[] = [];
        for (let clipIndex = 0; clipIndex < clipsInput.length; clipIndex++) {
            const clip = object(read(clipsInput.source, clipIndex));
            const clipMatrix = transform(read(clip, 'matrix'));
            clips.push(Object.freeze({ matrix: clipMatrix, rect: rectangle(read(clip, 'rect'), clipMatrix, ratio) }));
        }
        commands.push(Object.freeze({ kind: 'rect', matrix, rect, color, alpha, clips: Object.freeze(clips) }));
    }
    return { frame: Object.freeze({ frameId, width, height, clearColor, clearAlpha, commands: Object.freeze(commands) }), width: backingWidth, height: backingHeight };
}
