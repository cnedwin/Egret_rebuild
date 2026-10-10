import type { ClipRectangle2D, Matrix2D, Rectangle2D, RectangleCommand2D } from '@egret/contracts';
import type { RectangleFrame2D } from './RectangleFrame2D.js';

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
export function read(source: object, key: PropertyKey): unknown {
    try { return (source as Record<PropertyKey, unknown>)[key]; }
    catch (cause) { throw new FrameInputReadError(cause); }
}
export interface FrameCopyOptions {
    readonly pixelRatio: number;
    readonly maxBackingPixels: number;
    readonly maxCommands: number;
    readonly maxClipRectangles: number;
}
export function invalid(): never { throw new FrameCopyError('invalid'); }
export function object(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null) invalid();
    return value as Record<string, unknown>;
}
export function finite(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) invalid();
    return value === 0 ? 0 : value;
}
export function opacity(value: unknown): number {
    const number = finite(value);
    if (number < 0 || number > 1) invalid();
    return number;
}
export function rgb(value: unknown): number {
    const number = finite(value);
    if (!Number.isInteger(number) || number < 0 || number > 0xffffff) invalid();
    return number;
}
export interface ArraySnapshot { readonly source: unknown[]; readonly length: number }
export function array(value: unknown, wrapArrayCheck = false): ArraySnapshot {
    // Legacy rectangle checks retain raw faults; only new image checks opt in.
    let isArray: boolean;
    if (wrapArrayCheck) {
        try { isArray = Array.isArray(value); }
        catch (cause) { throw new FrameInputReadError(cause); }
    } else isArray = Array.isArray(value);
    if (!isArray) invalid();
    const source = value as unknown[];
    const length = read(source, 'length');
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) invalid();
    return { source, length };
}
export function transform(value: unknown): Matrix2D {
    const source = object(value);
    return Object.freeze({ a: finite(read(source, 'a')), b: finite(read(source, 'b')), c: finite(read(source, 'c')), d: finite(read(source, 'd')), tx: finite(read(source, 'tx')), ty: finite(read(source, 'ty')) });
}
export function rectangle(value: unknown, matrix: Matrix2D, ratio: number): Rectangle2D {
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
export interface CopiedFrameHeader2D {
    readonly source: Record<string, unknown>; readonly ratio: number;
    readonly clipBudget: number; readonly frameId: number;
    readonly width: number; readonly height: number;
    readonly clearColor: number; readonly clearAlpha: number;
    readonly backingWidth: number; readonly backingHeight: number;
    readonly commandsInput: ArraySnapshot;
}
export function copyFrameHeader2D(input: unknown, options: FrameCopyOptions): CopiedFrameHeader2D {
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
    return { source, ratio, clipBudget, frameId, width, height, clearColor, clearAlpha, backingWidth, backingHeight, commandsInput };
}
export function copyClips2D(item: object, ratio: number, clipBudget: number, clipCount: number, wrapArrayCheck = false): readonly ClipRectangle2D[] {
    const clipsInput = array(read(item, 'clips'), wrapArrayCheck);
    if (clipsInput.length > clipBudget - clipCount) throw new FrameCopyError('budget');
    const clips: ClipRectangle2D[] = [];
    for (let clipIndex = 0; clipIndex < clipsInput.length; clipIndex++) {
        const clip = object(read(clipsInput.source, clipIndex));
        const clipMatrix = transform(read(clip, 'matrix'));
        clips.push(Object.freeze({ matrix: clipMatrix, rect: rectangle(read(clip, 'rect'), clipMatrix, ratio) }));
    }
    return Object.freeze(clips);
}
export function copyRectangleCommand2D(item: object, ratio: number, clipBudget: number, clipCount: number): RectangleCommand2D {
    const matrix = transform(read(item, 'matrix')), rect = rectangle(read(item, 'rect'), matrix, ratio);
    const color = rgb(read(item, 'color')), alpha = opacity(read(item, 'alpha'));
    const clips = copyClips2D(item, ratio, clipBudget, clipCount);
    return Object.freeze({ kind: 'rect', matrix, rect, color, alpha, clips });
}
export function copyFrame2D(input: unknown, options: FrameCopyOptions): { readonly frame: RectangleFrame2D; readonly width: number; readonly height: number } {
    const { ratio, clipBudget, frameId, width, height, clearColor, clearAlpha, backingWidth, backingHeight, commandsInput } = copyFrameHeader2D(input, options);
    const commands: RectangleCommand2D[] = [];
    let clipCount = 0;
    // Snapshot length and read each indexed element once; input iterators have no authority.
    for (let index = 0; index < commandsInput.length; index++) {
        const item = object(read(commandsInput.source, index));
        if (read(item, 'kind') !== 'rect') invalid();
        const command = copyRectangleCommand2D(item, ratio, clipBudget, clipCount);
        clipCount += command.clips.length;
        commands.push(command);
    }
    return { frame: Object.freeze({ frameId, width, height, clearColor, clearAlpha, commands: Object.freeze(commands) }), width: backingWidth, height: backingHeight };
}
