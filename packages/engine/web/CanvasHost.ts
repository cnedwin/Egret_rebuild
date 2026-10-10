import type { Matrix2D, RenderFrame2D, RenderHostAdapter } from '@egret/contracts';
import { EgretError } from '@egret/runtime';
import { CanvasImageCopyError, copyCanvasMixedFrame } from './copyCanvasFrame.js';
import { copyProjectionPixels, ImageProjectionError, planImageProjections } from './imageProjections2D.js';
import type { ProjectionPlan2D } from './imageProjections2D.js';
import { createCanvasImageProjection } from './canvasImageProjection.js';

export interface CanvasHostOptions {
    readonly canvas: HTMLCanvasElement;
    readonly pixelRatio?: number;
    readonly maxBackingPixels?: number;
}
export interface CanvasHost extends RenderHostAdapter {
    readonly surface: HTMLCanvasElement;
    start(): void;
    stop(): void;
}
function cssColor(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
}

/** Owns drawing state while active; the borrowed DOM element remains external. */
class CanvasHostImplementation implements CanvasHost {
    public readonly surface: HTMLCanvasElement;
    private readonly ratio: number;
    private readonly budget: number;
    private state: 'new' | 'active' | 'closed' = 'new';
    private context: CanvasRenderingContext2D | undefined;
    private busy = false;
    private idleResolve: (() => void) | undefined;
    private closing: Promise<void> | undefined;

    public constructor(options: CanvasHostOptions) {
        if (typeof options !== 'object' || options === null) throw new EgretError('CANVAS_HOST_INVALID');
        const canvas = options.canvas;
        const inputRatio = options.pixelRatio;
        const inputBudget = options.maxBackingPixels;
        const ratio = inputRatio === undefined ? 1 : inputRatio;
        const budget = inputBudget === undefined ? 16777216 : inputBudget;
        if (
            typeof canvas !== 'object' || canvas === null ||
            typeof canvas.getContext !== 'function' ||
            typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio <= 0 ||
            !Number.isSafeInteger(budget) || budget <= 0
        ) {
            throw new EgretError('CANVAS_HOST_INVALID');
        }
        this.surface = canvas;
        Object.defineProperty(this, 'surface', { writable: false, configurable: false });
        this.ratio = ratio;
        this.budget = budget;
    }
    public start(): void {
        if (this.state === 'closed') throw new EgretError('CANVAS_HOST_CLOSED');
        if (this.state === 'active') return;
        const context = this.surface.getContext('2d');
        if ((this.state as string) === 'closed') throw new EgretError('CANVAS_HOST_CLOSED');
        if (context === null) throw new EgretError('CANVAS_CONTEXT_UNAVAILABLE');
        this.context = context;
        this.state = 'active';
    }
    public stop(): void {
        this.state = 'closed';
    }
    public close(): Promise<void> {
        this.stop();
        this.closing ??= this.busy ? new Promise<void>(resolve => { this.idleResolve = resolve; }) : Promise.resolve();
        return this.closing;
    }
    public setTimeout(callback: () => void, delayMs: number): () => void {
        const timer = globalThis.setTimeout(callback, delayMs);
        return () => globalThis.clearTimeout(timer);
    }
    private assertActive(): void {
        if (this.state === 'closed') throw new EgretError('CANVAS_HOST_CLOSED');
        if (this.state === 'new') throw new EgretError('CANVAS_HOST_NOT_STARTED');
    }
    private transform(context: CanvasRenderingContext2D, matrix: Matrix2D): void {
        context.setTransform(matrix.a * this.ratio, matrix.b * this.ratio, matrix.c * this.ratio, matrix.d * this.ratio, matrix.tx * this.ratio, matrix.ty * this.ratio);
    }
    public renderFrame(input: RenderFrame2D): undefined {
        this.assertActive();
        if (this.busy) throw new EgretError('CANVAS_FRAME_REENTRANT');
        this.busy = true;
        let sawImage = false;
        let targetMutationAttempted = false;
        let copyFailure: CanvasImageCopyError | EgretError | undefined;
        const native = <T>(action: () => T): T => {
            try { return action(); }
            catch (cause) {
                if (sawImage) throw new EgretError('CANVAS_RENDER_FAILED', { cause });
                throw cause;
            }
        };
        try {
            let copied;
            try {
                copied = copyCanvasMixedFrame(input, this.ratio, this.budget, () => { sawImage = true; }, failure => { copyFailure = failure; });
            } catch (cause) {
                // Input reentry closes the gate before either source or validation error mapping.
                if (sawImage) this.assertActive();
                if (sawImage) {
                    // Never trust a class, old token or undefined equality from an owned fault.
                    if (copyFailure !== undefined && copyFailure === cause) {
                        if (copyFailure instanceof CanvasImageCopyError) throw new EgretError(copyFailure.reason === 'budget' ? 'CANVAS_FRAME_BUDGET' : 'CANVAS_FRAME_INVALID', { cause: copyFailure.reason === 'read' ? copyFailure.cause : copyFailure });
                        throw copyFailure; // Genuine deliberate backing failure retains identity.
                    }
                    throw new EgretError('CANVAS_RENDER_FAILED', { cause });
                }
                throw cause;
            }
            const { frame, width, height } = copied;
            this.assertActive();
            let projections: ProjectionPlan2D | undefined;
            if (sawImage) {
                let projectionFailure: ImageProjectionError | undefined;
                try {
                    // Admission consumes only the trusted snapshot, before any native byte copy.
                    projections = planImageProjections(frame, 'straight', failure => { projectionFailure = failure; });
                } catch (cause) {
                    if (projectionFailure !== undefined && projectionFailure === cause) throw new EgretError(projectionFailure.reason === 'budget' ? 'CANVAS_FRAME_BUDGET' : 'CANVAS_FRAME_INVALID', { cause });
                    throw new EgretError('CANVAS_RENDER_FAILED', { cause });
                }
            }
            const context = this.context!;
            if (native(() => context.isContextLost?.())) throw new EgretError('CANVAS_CONTEXT_LOST');
            const sources: HTMLCanvasElement[] = [];
            const projectionPixels: Uint8Array<ArrayBuffer>[] = [];
            if (projections !== undefined) {
                try {
                    if (context.getContextAttributes().colorSpace !== 'srgb') throw new Error('Target sRGB Canvas context unavailable');
                    const ownerDocument = this.surface.ownerDocument;
                    for (const view of projections.views) {
                        const pixels = copyProjectionPixels(view, 'straight');
                        // Retain every admitted output for this submission; zero coverage does
                        // not release P or excuse its private bitmap from the 2P+M reservation.
                        projectionPixels.push(pixels);
                        sources.push(createCanvasImageProjection(view, pixels, ownerDocument));
                    }
                } catch (cause) {
                    // DOM, constructors and byte allocation are native origin even when they
                    // throw a public error-class instance that resembles trusted admission.
                    throw new EgretError('CANVAS_RENDER_FAILED', { cause });
                }
                this.assertActive();
            }
            // Reset every frame, even at identical dimensions, to discard incoming clips.
            // A throwing setter may already mutate the target: every later failure is terminal.
            targetMutationAttempted = true;
            native(() => { this.surface.width = width; this.surface.height = height; });
            if (native(() => this.surface.width !== width || this.surface.height !== height)) throw new EgretError('CANVAS_BACKING_LIMIT');
            if (native(() => context.isContextLost?.())) throw new EgretError('CANVAS_CONTEXT_LOST');
            native(() => {
                context.setTransform(1, 0, 0, 1, 0, 0);
                context.globalCompositeOperation = 'source-over';
                context.globalAlpha = 1;
                context.shadowColor = 'rgba(0,0,0,0)';
                context.shadowBlur = 0;
                context.shadowOffsetX = 0;
                context.shadowOffsetY = 0;
                if ('filter' in context) context.filter = 'none';
                if (sawImage) context.imageSmoothingEnabled = false;
                context.clearRect(0, 0, width, height);
                context.fillStyle = cssColor(frame.clearColor);
                context.globalAlpha = frame.clearAlpha;
                context.fillRect(0, 0, width, height);
            });
            let commandIndex = 0;
            for (const command of frame.commands) {
                // A direct close during drawing closes the gate at command boundaries.
                if (this.state === 'closed') break;
                native(() => {
                    context.save();
                    try {
                        for (const clip of command.clips) {
                            this.transform(context, clip.matrix);
                            context.beginPath();
                            context.rect(clip.rect.x, clip.rect.y, clip.rect.width, clip.rect.height);
                            context.clip();
                        }
                        this.transform(context, command.matrix);
                        if (command.kind === 'rect') context.fillStyle = cssColor(command.color);
                        context.globalAlpha = command.alpha;
                        if (command.kind === 'rect') context.fillRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height);
                        else context.drawImage(sources[projections!.commandViews[commandIndex]!]!, command.rect.x, command.rect.y, command.rect.width, command.rect.height);
                    } finally {
                        context.restore();
                    }
                });
                commandIndex++;
            }
            native(() => context.beginPath());
            // Native allocation may fail lazily on first draw, after dimensions assign.
            if (native(() => context.isContextLost?.())) throw new EgretError('CANVAS_CONTEXT_LOST');
            return undefined;
        } catch (cause) {
            if (targetMutationAttempted) this.state = 'closed';
            if (cause instanceof EgretError) throw cause;
            throw new EgretError('CANVAS_RENDER_FAILED', { cause });
        } finally {
            this.busy = false;
            this.idleResolve?.();
            this.idleResolve = undefined;
        }
    }
}
export function createCanvasHost(options: CanvasHostOptions): CanvasHost {
    return new CanvasHostImplementation(options);
}

