import { createImageData2D } from '@egret/contracts';
import type { CancellationSignal, ImageData2D } from '@egret/contracts';
import { EgretError } from '@egret/runtime';
import type {
    TextLineMetricsInput, TextMeasureContext, TextRasterContext, TextRasterPlan,
    TextRasterProvider, TextRasterRequest,
} from '@egret/engine/text';

// This adapter owns transient surfaces only. The existing cache remains the
// authority for requests, plan issuance, generations, budgets and image delivery.
type TextContext = CanvasRenderingContext2D & { lang: string };
interface PlanState {
    used: boolean;
    busy: boolean;
    quarantined: boolean;
    cleanupCause: unknown;
    measureReadbackHint: boolean | undefined;
    rasterReadbackHint: boolean | undefined;
}

function cancelled(signal: CancellationSignal): void {
    if (signal.aborted) throw new EgretError('WEB_TEXT_CANCELLED', { cause: signal.reason });
}

function fontFor(request: TextRasterRequest): string {
    // T1 excludes control characters. Quote one literal family, never a CSS list.
    const family = request.fontFamily.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `${request.fontStyle} ${request.fontWeight} ${request.fontSize}px "${family}"`;
}

function ready(document: Document, font: string, request: TextRasterRequest): void {
    // Readiness cannot certify a face's identity or glyph coverage. Applications
    // own their fonts and explicitly invalidate every affected cache on change.
    if (!document.fonts.check(font, request.text)) throw new EgretError('WEB_TEXT_FONT_NOT_READY');
}

function setState<K extends keyof TextContext>(context: TextContext, key: K, value: TextContext[K]): void {
    if (!(key in context)) throw new EgretError('WEB_TEXT_STATE_UNSUPPORTED');
    context[key] = value;
    if (context[key] !== value) throw new EgretError('WEB_TEXT_STATE_UNSUPPORTED');
}

function drawingState(context: TextContext, request: TextRasterRequest, font: string): void {
    // A legal font setter serializes canonically, so string equality with the
    // input is not a support test. A distinct, below-T1-size sentinel detects an
    // ignored assignment without creating another Canvas or parsing CSS ourselves.
    if (!('font' in context)) throw new EgretError('WEB_TEXT_STATE_UNSUPPORTED');
    context.font = '0.5px serif';
    const sentinel = context.font;
    context.font = font;
    if (typeof context.font !== 'string' || context.font.length === 0 || context.font === sentinel) {
        throw new EgretError('WEB_TEXT_STATE_UNSUPPORTED');
    }
    setState(context, 'lang', request.locale);
    setState(context, 'direction', request.direction);
    setState(context, 'textAlign', 'left');
    setState(context, 'textBaseline', 'alphabetic');
    setState(context, 'fontKerning', 'auto');
    setState(context, 'fontStretch', 'normal');
    setState(context, 'fontVariantCaps', 'normal');
    setState(context, 'letterSpacing', '0px');
    setState(context, 'wordSpacing', '0px');
    setState(context, 'textRendering', 'auto');
    setState(context, 'globalAlpha', 1);
    setState(context, 'globalCompositeOperation', 'source-over');
    setState(context, 'filter', 'none');
    setState(context, 'shadowBlur', 0);
    setState(context, 'shadowOffsetX', 0);
    setState(context, 'shadowOffsetY', 0);
    setState(context, 'shadowColor', 'rgba(0, 0, 0, 0)');
    setState(context, 'fillStyle', `#${request.fillColor.toString(16).padStart(6, '0')}`);
}

function scalar(value: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1048576) {
        throw new RangeError('Canvas text metric must be finite and within T1 magnitude');
    }
    return value;
}

function lineMetrics(metrics: TextMetrics): TextLineMetricsInput {
    const advance = scalar(metrics.width);
    const left = -scalar(metrics.actualBoundingBoxLeft);
    const top = -scalar(metrics.actualBoundingBoxAscent);
    const right = scalar(metrics.actualBoundingBoxRight);
    const bottom = scalar(metrics.actualBoundingBoxDescent);
    if (advance < 0 || left > right || top > bottom) throw new RangeError('Canvas text metric ordering invalid');
    const hasInk = left < right && top < bottom;
    // Native signed zero belongs to raw evidence. T1 requires four canonical
    // zero extents for inkless lines, even if the native empty edge is nonzero.
    return { advance, hasInk, inkLeft: hasInk ? left : 0, inkTop: hasInk ? top : 0,
        inkRight: hasInk ? right : 0, inkBottom: hasInk ? bottom : 0 };
}

function surface<T>(
    document: Document, width: number, height: number,
    work: (context: TextContext, readbackHint: boolean | undefined) => T,
    cleanupFailure: (errors: readonly unknown[], failed: boolean, cause: unknown) => unknown,
    reportSuccessfulCleanupAtRelease = false,
): T {
    let canvas: HTMLCanvasElement | undefined;
    let context: TextContext | undefined;
    let value: T | undefined;
    let failed = false;
    let cause: unknown;
    const cleanupErrors: unknown[] = [];
    try {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        if (canvas.width !== width || canvas.height !== height) throw new EgretError('WEB_TEXT_STATE_UNSUPPORTED');
        // The hint must precede the surface's very first context acquisition.
        context = (canvas.getContext('2d', { alpha: true, colorSpace: 'srgb', willReadFrequently: true }) as TextContext | null) ?? undefined;
        if (context === undefined || typeof context.getContextAttributes !== 'function') throw new EgretError('WEB_TEXT_STATE_UNSUPPORTED');
        const attributes = context.getContextAttributes();
        if (attributes.alpha !== true || attributes.colorSpace !== 'srgb') throw new EgretError('WEB_TEXT_STATE_UNSUPPORTED');
        const readbackHint = typeof attributes.willReadFrequently === 'boolean' ? attributes.willReadFrequently : undefined;
        value = work(context, readbackHint);
    } catch (error) {
        failed = true; cause = error;
    } finally {
        // Both resets are attempted even when the first throws. Retire local
        // references regardless; successful logical cleanup is not a GC claim.
        if (canvas !== undefined) {
            try {
                canvas.width = 0;
                if (canvas.width !== 0) throw new EgretError('WEB_TEXT_STATE_UNSUPPORTED');
            } catch (error) { cleanupErrors.push(error); }
            try {
                canvas.height = 0;
                if (canvas.height !== 0) throw new EgretError('WEB_TEXT_STATE_UNSUPPORTED');
            } catch (error) { cleanupErrors.push(error); }
        }
        context = undefined; canvas = undefined;
    }
    if (cleanupErrors.length !== 0) {
        const failure = cleanupFailure(cleanupErrors, failed, cause);
        // Only a completed raster can return its internal copy to T1. Its
        // quarantined plan then fails release before any public delivery.
        // An operation throw, including undefined, always remains primary.
        if (failed || !reportSuccessfulCleanupAtRelease) throw failure;
    }
    if (failed) throw cause;
    return value as T;
}

/** Caller-owned fonts and explicit cache invalidation; no waiting or font loading. */
export function createCanvasTextRasterProvider(): TextRasterProvider {
    let owner: Document | undefined;
    try {
        if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.document === document
            && typeof document.createElement === 'function' && typeof document.fonts?.check === 'function'
            && typeof HTMLCanvasElement === 'function' && typeof HTMLCanvasElement.prototype.getContext === 'function'
            && typeof CanvasRenderingContext2D === 'function') owner = document;
    } catch (cause) {
        throw new EgretError('WEB_TEXT_UNAVAILABLE', { cause });
    }
    if (owner === undefined) throw new EgretError('WEB_TEXT_UNAVAILABLE');
    const capturedDocument = owner;

    // One provider can serve several caches. Quarantined slots are never refunded.
    let occupied = 0;
    const plans = new WeakMap<TextRasterPlan, PlanState>();
    const released = new WeakSet<TextRasterPlan>();
    const provider: TextRasterProvider = Object.freeze({
        identity: 'egret.canvas-text.wc1',
        profile: 'canvas-explicit-lines-v1',
        async measure(this: TextRasterProvider, request: TextRasterRequest, context: TextMeasureContext): Promise<TextRasterPlan> {
            if (this !== provider) throw new EgretError('WEB_TEXT_PROVIDER_INVALID');
            if (occupied >= 4) throw new EgretError('WEB_TEXT_PLAN_LIMIT');
            occupied++;
            let issued: TextRasterPlan | undefined;
            let quarantined = false;
            try {
                cancelled(context.signal);
                if (request.providerIdentity !== provider.identity || request.profile !== provider.profile
                    || request.fontGeneration !== context.fontGeneration) throw new EgretError('WEB_TEXT_PLAN_INVALID');
                const font = fontFor(request);
                ready(capturedDocument, font, request);
                cancelled(context.signal);
                const plan = surface(capturedDocument, 1, 1, (canvas, readbackHint) => {
                    drawingState(canvas, request, font);
                    canvas.setTransform(1, 0, 0, 1, 0, 0);
                    const lines = request.sourceLines.map(line => lineMetrics(canvas.measureText(request.text.slice(line.start, line.end))));
                    cancelled(context.signal);
                    // Exactly one authentic invocation issuer owns all plan geometry.
                    issued = context.createPlan({ baselineOffset: request.fontSize, lines });
                    plans.set(issued, { used: false, busy: true, quarantined: false, cleanupCause: undefined,
                        measureReadbackHint: readbackHint, rasterReadbackHint: undefined });
                    cancelled(context.signal);
                    return issued;
                }, (errors, failed, cause) => {
                    quarantined = true;
                    if (issued === undefined) return new EgretError('WEB_TEXT_CLEANUP_FAILED', {
                        cause: failed ? cause : errors[0], cleanupErrors: errors,
                    });
                    const state = plans.get(issued)!;
                    state.quarantined = true; state.cleanupCause = errors[0];
                    return failed ? cause : errors[0];
                });
                cancelled(context.signal);
                return plan;
            } finally {
                if (issued !== undefined) plans.get(issued)!.busy = false;
                if (issued === undefined && !quarantined) occupied--;
            }
        },
        async rasterize(this: TextRasterProvider, plan: TextRasterPlan, context: TextRasterContext): Promise<ImageData2D | undefined> {
            if (this !== provider) throw new EgretError('WEB_TEXT_PROVIDER_INVALID');
            const state = plans.get(plan);
            if (state === undefined || state.used || state.busy || state.quarantined) throw new EgretError('WEB_TEXT_PLAN_INVALID');
            // Consume before reading caller-visible context state: a failed raster
            // attempt is not a retry port, and reentry cannot overlap this plan.
            state.used = true; state.busy = true;
            try {
                const request = plan.request;
                const placement = plan.metrics.raster;
                const bytes = placement?.byteLength ?? 0;
                if (context.fontGeneration !== request.fontGeneration || context.reservedImageBytes !== bytes
                    || context.reservedScratchBytes !== 2 * bytes) throw new EgretError('WEB_TEXT_PLAN_INVALID');
                cancelled(context.signal);
                const font = fontFor(request);
                ready(capturedDocument, font, request);
                cancelled(context.signal);
                if (placement === undefined) return undefined;
                const image = surface(capturedDocument, placement.width, placement.height, (canvas, readbackHint) => {
                    state.rasterReadbackHint = readbackHint;
                    drawingState(canvas, request, font);
                    canvas.setTransform(request.density, 0, 0, request.density, -placement.pixelLeft, -placement.pixelTop);
                    for (const line of plan.metrics.lines) {
                        canvas.fillText(request.text.slice(line.source.start, line.source.end), 0, line.baselineY);
                    }
                    cancelled(context.signal);
                    const pixels = canvas.getImageData(0, 0, placement.width, placement.height);
                    if (pixels.width !== placement.width || pixels.height !== placement.height
                        || !(pixels.data instanceof Uint8ClampedArray) || !(pixels.data.buffer instanceof ArrayBuffer)
                        || pixels.data.byteLength !== bytes || pixels.colorSpace !== 'srgb') {
                        throw new TypeError('Canvas text readback must be exact tight sRGB rgba8 bytes');
                    }
                    cancelled(context.signal);
                    // A view allocates no second pixel buffer. The existing public
                    // image constructor makes the one owned immutable pixel copy.
                    const view = new Uint8Array(pixels.data.buffer, pixels.data.byteOffset, pixels.data.byteLength);
                    const result = createImageData2D({ width: placement.width, height: placement.height, pixels: view });
                    cancelled(context.signal);
                    return result;
                }, (errors, failed, cause) => {
                    state.quarantined = true; state.cleanupCause = errors[0];
                    return failed ? cause : errors[0];
                }, true);
                cancelled(context.signal);
                return image;
            } finally { state.busy = false; }
        },
        release(this: TextRasterProvider, plan: TextRasterPlan): void {
            if (this !== provider) throw new EgretError('WEB_TEXT_PROVIDER_INVALID');
            const state = plans.get(plan);
            if (state === undefined) {
                if (released.has(plan)) return;
                throw new EgretError('WEB_TEXT_PLAN_INVALID');
            }
            if (state.busy) throw new EgretError('WEB_TEXT_PLAN_INVALID');
            // Close identity before reporting failure. A release reentry/repeat
            // cannot refund quarantine or expose this plan to another raster.
            plans.delete(plan); released.add(plan);
            if (state.quarantined) throw state.cleanupCause;
            occupied--;
        },
    });
    return provider;
}
