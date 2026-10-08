import type { Matrix2D, Rectangle2D, RenderFrame2D } from '@egret/contracts';
import { EgretError } from '@egret/runtime';

function invalid(): never {
    throw new EgretError('CANVAS_FRAME_INVALID');
}
function record(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null) invalid();
    return value as Record<string, unknown>;
}
function finite(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) invalid();
    return value;
}
function alpha(value: unknown): number {
    const result = finite(value);
    if (result < 0 || result > 1) invalid();
    return result;
}
function color(value: unknown): number {
    const result = finite(value);
    if (!Number.isInteger(result) || result < 0 || result > 0xffffff) invalid();
    return result;
}
function matrix(value: unknown, ratio: number): Matrix2D {
    const source = record(value);
    const result = {
        a: finite(source.a), b: finite(source.b),
        c: finite(source.c), d: finite(source.d),
        tx: finite(source.tx), ty: finite(source.ty),
    };
    for (const component of Object.values(result)) finite(component * ratio);
    return result;
}
function rectangle(value: unknown, transform: Matrix2D, ratio: number): Rectangle2D {
    const source = record(value);
    const result = {
        x: finite(source.x), y: finite(source.y),
        width: finite(source.width), height: finite(source.height),
    };
    if (result.width < 0 || result.height < 0) invalid();
    const right = finite(result.x + result.width);
    const bottom = finite(result.y + result.height);
    // Validate every derived corner before the first bitmap or state mutation.
    for (const x of [result.x, right]) {
        for (const y of [result.y, bottom]) {
            finite(finite(transform.a * x + transform.c * y + transform.tx) * ratio);
            finite(finite(transform.b * x + transform.d * y + transform.ty) * ratio);
        }
    }
    return result;
}
export function copyCanvasFrame(value: unknown, ratio: number, budget: number): { frame: RenderFrame2D; width: number; height: number } {
    const source = record(value);
    const frameId = finite(source.frameId);
    const width = finite(source.width);
    const height = finite(source.height);
    if (!Number.isSafeInteger(frameId) || frameId <= 0 || width <= 0 || height <= 0) invalid();
    const clearColor = color(source.clearColor);
    const clearAlpha = alpha(source.clearAlpha);
    const input = source.commands;
    if (!Array.isArray(input)) invalid();
    const commands = [];
    for (const item of input) {
        const command = record(item);
        if (command.kind !== 'rect') invalid();
        const transform = matrix(command.matrix, ratio);
        const rect = rectangle(command.rect, transform, ratio);
        const fill = color(command.color);
        const opacity = alpha(command.alpha);
        const inputClips = command.clips;
        if (!Array.isArray(inputClips)) invalid();
        const clips = [];
        for (const itemClip of inputClips) {
            const clip = record(itemClip);
            const clipMatrix = matrix(clip.matrix, ratio);
            clips.push({ matrix: clipMatrix, rect: rectangle(clip.rect, clipMatrix, ratio) });
        }
        commands.push({ kind: 'rect' as const, matrix: transform, rect, color: fill, alpha: opacity, clips });
    }
    const backingWidth = Math.ceil(width * ratio);
    const backingHeight = Math.ceil(height * ratio);
    if (
        !Number.isSafeInteger(backingWidth) || !Number.isSafeInteger(backingHeight) ||
        backingWidth <= 0 || backingHeight <= 0 ||
        backingWidth > 4294967295 || backingHeight > 4294967295 ||
        backingWidth > Math.floor(budget / backingHeight)
    ) {
        throw new EgretError('CANVAS_BACKING_LIMIT');
    }
    return { frame: { frameId, width, height, clearColor, clearAlpha, commands }, width: backingWidth, height: backingHeight };
}
