import type { RenderFrame2D, RenderHostAdapter } from '@egret/contracts';
import { EgretError } from '@egret/runtime';
import { copyFrame2D, FrameCopyError, FrameInputReadError } from '../rendering/copyFrame2D.js';
import { prepareRectangles2D, GeometryPreparationError } from '../rendering/prepareRectangles2D.js';
import { packWebGPUVertices, WebGPUPackingError, createWebGPURectanglePipeline, encodeWebGPURectangles } from './webgpuPass.js';
import { observed, deferred, cleanupWebGPUBuffer, observeWebGPUDeviceLoss } from './webgpuLifetime.js';
import type { OwnedWebGPUBuffer } from './webgpuLifetime.js';

export type WebGPUHostState = 'new' | 'starting' | 'active' | 'stopped' | 'failed' | 'closing' | 'closed';
export type WebGPUHostErrorCode =
    'WEBGPU_OPTIONS_INVALID' | 'WEBGPU_UNAVAILABLE' | 'WEBGPU_ADAPTER_UNAVAILABLE' | 'WEBGPU_DEVICE_FAILED' | 'WEBGPU_CONTEXT_UNAVAILABLE' | 'WEBGPU_FORMAT_UNSUPPORTED' |
    'WEBGPU_START_FAILED' | 'WEBGPU_START_CANCELLED' | 'WEBGPU_NOT_STARTED' | 'WEBGPU_STOPPED' | 'WEBGPU_CLOSED' | 'WEBGPU_FAILED' | 'WEBGPU_REENTRANT' |
    'WEBGPU_FRAME_INVALID' | 'WEBGPU_BACKING_LIMIT' | 'WEBGPU_GEOMETRY_RANGE' | 'WEBGPU_PRECISION_UNSUPPORTED' | 'WEBGPU_FRAME_BUDGET' | 'WEBGPU_BACKPRESSURE' |
    'WEBGPU_DEVICE_LIMIT' | 'WEBGPU_SERIAL_EXHAUSTED' | 'WEBGPU_RENDER_FAILED' | 'WEBGPU_VALIDATION' | 'WEBGPU_OUT_OF_MEMORY' | 'WEBGPU_INTERNAL' |
    'WEBGPU_SCOPE_FAILED' | 'WEBGPU_QUEUE_FAILED' | 'WEBGPU_DEVICE_LOST' | 'WEBGPU_UNCAPTURED_ERROR' | 'WEBGPU_READBACK_DISABLED' | 'WEBGPU_READBACK_PENDING' |
    'WEBGPU_READBACK_FAILED' | 'WEBGPU_DIAGNOSTIC_CALLBACK_FAILED' | 'WEBGPU_CLOSE_UNSAFE';
export interface WebGPUHostFailure { readonly code: WebGPUHostErrorCode; readonly serial: number | null; readonly phase: 'startup' | 'frame' | 'readback' | 'device' | 'cleanup' | 'callback'; readonly cause: unknown; }
export interface WebGPUHostDiagnostic extends WebGPUHostFailure { readonly severity: 'error'; }
export interface WebGPUHostOptions {
    readonly canvas: HTMLCanvasElement;
    readonly device?: { readonly kind: 'acquire' } | { readonly kind: 'borrow'; readonly device: GPUDevice };
    readonly pixelRatio?: number; readonly maxBackingPixels?: number; readonly maxCommands?: number; readonly maxClipRectangles?: number;
    readonly maxPreparedVertices?: number; readonly maxClipEdgeTests?: number; readonly maxUploadBytes?: number; readonly maxPendingUploadBytes?: number;
    readonly maxPendingFrames?: number; readonly maxReadbackBytes?: number; readonly enableReadback?: boolean; readonly onDiagnostic?: (diagnostic: WebGPUHostDiagnostic) => unknown;
}
export interface WebGPUReadback { readonly serial: number; readonly frameId: number; readonly width: number; readonly height: number; readonly format: 'rgba8unorm'; readonly sourceFormat: 'rgba8unorm' | 'bgra8unorm'; readonly colorSpace: 'srgb'; readonly alphaMode: 'premultiplied'; readonly bytes: Uint8Array; }
export interface WebGPUHostStatus { readonly state: WebGPUHostState; readonly lastSerial: number; readonly pendingFrames: number; readonly pendingUploadBytes: number; readonly pendingReadbackBytes: number; readonly firstFailure: WebGPUHostFailure | null; readonly callbackFailureCount: number; readonly lastCallbackFailure: WebGPUHostFailure | null; readonly cleanupOutcome: 'not-started' | 'pending' | 'safe' | 'unsafe'; }
export interface WebGPUHost extends RenderHostAdapter { readonly surface: HTMLCanvasElement; start(): Promise<void>; stop(): void; close(): Promise<void>; renderFrame(frame: RenderFrame2D): undefined; whenIdle(): Promise<void>; requestReadback(): Promise<WebGPUReadback>; getStatus(): WebGPUHostStatus; setTimeout(callback: () => void, delayMs: number): () => void; }
type Configuration = Required<Omit<WebGPUHostOptions, 'canvas' | 'device' | 'onDiagnostic'>>;
type Ticket = ReturnType<typeof deferred<WebGPUReadback>> & { bound: boolean };
interface Submission { serial: number; upload: number; readback: number; resources: OwnedWebGPUBuffer[]; outcome: Promise<void>; completion: Promise<void>; failure: EgretError | undefined; unsafe: boolean; retired: boolean; }
const DEFAULTS: Configuration = { pixelRatio: 1, maxBackingPixels: 16777216, maxCommands: 65536, maxClipRectangles: 262144, maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxUploadBytes: 33554432, maxPendingUploadBytes: 67108864, maxPendingFrames: 2, maxReadbackBytes: 67108864, enableReadback: false };
function error(code: WebGPUHostErrorCode, cause?: unknown): EgretError { return new EgretError(code, { cause }); }
/** Private control-flow origin; callers receive only publicError, never this signal. */
class ClassifiedWebGPUFailure {
    public constructor(
        public readonly code: WebGPUHostErrorCode,
        public readonly original: unknown = undefined,
        public readonly publicError: EgretError = error(code, original),
    ) {}
}
function isObject(value: unknown): value is object { return typeof value === 'object' && value !== null; }

/** The sole lifecycle/submission authority; resource helpers only record settled ownership. */
class WebGPUHostImplementation implements WebGPUHost {
    public readonly surface: HTMLCanvasElement;
    private readonly options: Configuration;
    private readonly borrowed: GPUDevice | undefined;
    private readonly callback: ((diagnostic: WebGPUHostDiagnostic) => unknown) | undefined;
    private state: WebGPUHostState = 'new';
    private starting: Promise<void> | undefined;
    private closing: Promise<void> | undefined;
    private busy = false;
    private cpu = deferred<void>();
    private firstFailure: WebGPUHostFailure | null = null;
    private callbackFailureCount = 0;
    private lastCallbackFailure: WebGPUHostFailure | null = null;
    private cleanupOutcome: WebGPUHostStatus['cleanupOutcome'] = 'not-started';
    private unsafeCause: unknown;
    private unsafe = false;
    private finalizing = false;
    private lastSerial = 0;
    private pendingUploadBytes = 0;
    private pendingReadbackBytes = 0;
    private readonly ledger = new Set<Submission>();
    private ticket: Ticket | undefined;
    private device: GPUDevice | undefined;
    private destroyDevice: (() => void) | undefined;
    private context: GPUCanvasContext | undefined;
    private configure: ((configuration: GPUCanvasConfiguration) => void) | undefined;
    private unconfigure: (() => void) | undefined;
    private currentTexture: (() => GPUTexture) | undefined;
    private configured = false;
    private format: 'rgba8unorm' | 'bgra8unorm' = 'rgba8unorm';
    private limits = { maxTextureDimension2D: 0, maxBufferSize: 0 };
    private pipeline: GPURenderPipeline | undefined;
    private push: ((filter: GPUErrorFilter) => void) | undefined;
    private pop: (() => Promise<GPUError | null>) | undefined;
    private write: GPUQueue['writeBuffer'] | undefined;
    private submit: GPUQueue['submit'] | undefined;
    private fence: GPUQueue['onSubmittedWorkDone'] | undefined;
    private buffer: GPUDevice['createBuffer'] | undefined;
    private encoder: GPUDevice['createCommandEncoder'] | undefined;
    private removeListener: (() => void) | undefined;
    // Pending borrowed device.lost retains only this detachable cell after lease return.
    private readonly lossCell: { notify?: (cause: unknown) => void } = {};
    private timers: { set: typeof globalThis.setTimeout; clear: typeof globalThis.clearTimeout } | undefined;

    public constructor(input: WebGPUHostOptions) {
        try {
            if (!isObject(input)) throw new TypeError('options');
            const canvas = input.canvas, policy = input.device, callback = input.onDiagnostic;
            if (!isObject(canvas)) throw new TypeError('canvas');
            let borrowed: GPUDevice | undefined;
            if (policy !== undefined) {
                if (!isObject(policy)) throw new TypeError('device policy');
                const kind = policy.kind;
                if (kind === 'borrow') { const device = policy.device; if (!isObject(device)) throw new TypeError('device'); borrowed = device; }
                else if (kind !== 'acquire') throw new TypeError('device kind');
            }
            const values = {} as Configuration;
            for (const key of Object.keys(DEFAULTS) as (keyof Configuration)[]) {
                const supplied = input[key], value = supplied === undefined ? DEFAULTS[key] : supplied;
                if (key === 'enableReadback' ? typeof value !== 'boolean' : typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || (key !== 'pixelRatio' && !Number.isSafeInteger(value))) throw new TypeError(key);
                Object.defineProperty(values, key, { value, enumerable: true });
            }
            if (callback !== undefined && typeof callback !== 'function') throw new TypeError('diagnostic callback');
            this.surface = canvas; Object.defineProperty(this, 'surface', { writable: false, configurable: false });
            this.options = Object.freeze(values); this.borrowed = borrowed; this.callback = callback;
        } catch (cause) { throw error('WEBGPU_OPTIONS_INVALID', cause); }
    }
    public getStatus(): WebGPUHostStatus { return Object.freeze({ state: this.state, lastSerial: this.lastSerial, pendingFrames: this.ledger.size, pendingUploadBytes: this.pendingUploadBytes, pendingReadbackBytes: this.pendingReadbackBytes, firstFailure: this.firstFailure, callbackFailureCount: this.callbackFailureCount, lastCallbackFailure: this.lastCallbackFailure, cleanupOutcome: this.cleanupOutcome }); }
    private active(): void {
        if (this.state !== 'active') throw this.stateError();
    }
    private stateError(): EgretError { return error(this.state === 'stopped' ? 'WEBGPU_STOPPED' : this.state === 'closing' || this.state === 'closed' ? 'WEBGPU_CLOSED' : this.state === 'failed' ? 'WEBGPU_FAILED' : 'WEBGPU_NOT_STARTED', this.firstFailure?.cause); }
    private startupCancelled(): boolean {
        return this.state === 'stopped' || this.state === 'closing' || this.state === 'closed';
    }
    private startupGate(): void {
        if (this.state === 'failed' && this.firstFailure) {
            throw new ClassifiedWebGPUFailure(this.firstFailure.code, this.firstFailure.cause);
        }
        if (this.state !== 'starting') {
            throw new ClassifiedWebGPUFailure('WEBGPU_START_CANCELLED', this.firstFailure?.cause);
        }
    }
    private proofFailed(cause: unknown): void { if (!this.unsafe) { this.unsafe = true; this.unsafeCause = cause; } }
    private fail(code: WebGPUHostErrorCode, cause: unknown, phase: WebGPUHostFailure['phase'], serial: number | null, unsafe = false): EgretError {
        const failure = Object.freeze({ code, cause, phase, serial });
        if (unsafe) this.proofFailed(cause);
        if (this.firstFailure === null) this.firstFailure = failure;
        if (this.state !== 'closing' && this.state !== 'closed' && this.state !== 'stopped') this.state = 'failed';
        this.cancelTicket(error(code, cause));
        const callback = this.callback;
        if (callback && this.state !== 'closed' && !this.finalizing) {
            queueMicrotask(() => {
                if (this.state === 'closed') return;
                const callbackFailure = (fault: unknown): void => { this.callbackFailureCount = Math.min(Number.MAX_SAFE_INTEGER, this.callbackFailureCount + 1); this.lastCallbackFailure = Object.freeze({ code: 'WEBGPU_DIAGNOSTIC_CALLBACK_FAILED', cause: fault, phase: 'callback', serial }); };
                try { observed(callback.call(undefined, Object.freeze({ ...failure, severity: 'error' as const }))).catch(callbackFailure); }
                catch (fault) { callbackFailure(fault); }
            });
        }
        return error(code, cause);
    }
    private cancelTicket(cause: unknown): void { if (this.ticket && !this.ticket.bound) { this.ticket.reject(cause); this.ticket = undefined; } }
    public stop(): void { if (this.state === 'new' || this.state === 'starting' || this.state === 'active') this.state = 'stopped'; this.cancelTicket(error('WEBGPU_STOPPED')); }
    public start(): Promise<void> {
        if (this.state === 'starting' || this.state === 'active') return this.starting!;
        if (this.state !== 'new') return observed(Promise.reject(this.stateError()));
        const barrier = deferred<void>(); this.starting = barrier.promise; this.state = 'starting';
        // Cache before any getter/call can reenter start or close.
        this.initialize().then(barrier.resolve, barrier.reject); return barrier.promise;
    }
    private method<T extends object, K extends keyof T>(object: T, key: K, gate: () => void): T[K] {
        const value = object[key]; gate();
        if (typeof value !== 'function') throw new TypeError(String(key));
        return value.bind(object) as T[K];
    }
    private async initialize(): Promise<void> {
        let stage: WebGPUHostErrorCode = 'WEBGPU_UNAVAILABLE';
        const gate = (): void => this.startupGate();
        try {
            const navigatorValue = globalThis.navigator;
            gate();
            const gpu = navigatorValue?.gpu;
            gate();
            if (!gpu) throw new ClassifiedWebGPUFailure('WEBGPU_UNAVAILABLE');
            const preferred = this.method(gpu, 'getPreferredCanvasFormat', gate);
            const format = preferred();
            gate();
            if (format !== 'rgba8unorm' && format !== 'bgra8unorm') throw new ClassifiedWebGPUFailure('WEBGPU_FORMAT_UNSUPPORTED');
            this.format = format;
            stage = 'WEBGPU_CONTEXT_UNAVAILABLE';
            const getContext = this.method(this.surface, 'getContext', gate);
            const context = getContext('webgpu') as GPUCanvasContext | null;
            gate();
            if (!context) throw new ClassifiedWebGPUFailure('WEBGPU_CONTEXT_UNAVAILABLE');
            this.context = context;
            this.configure = this.method(context, 'configure', gate); this.unconfigure = this.method(context, 'unconfigure', gate); this.currentTexture = this.method(context, 'getCurrentTexture', gate);
            let device: GPUDevice;
            if (this.borrowed) device = this.borrowed;
            else {
                stage = 'WEBGPU_ADAPTER_UNAVAILABLE';
                const request = this.method(gpu, 'requestAdapter', gate);
                const adapter = await observed(request());
                gate();
                if (!adapter) throw new ClassifiedWebGPUFailure('WEBGPU_ADAPTER_UNAVAILABLE');
                stage = 'WEBGPU_DEVICE_FAILED';
                const acquire = this.method(adapter, 'requestDevice', gate);
                device = await observed(acquire());
            }
            // Acquire ownership before checking cancellation so close can clean a late device.
            this.device = device;
            stage = 'WEBGPU_START_FAILED';
            const cleanupGate = (): void => undefined;
            if (!this.borrowed) {
                try { this.destroyDevice = this.method(device, 'destroy', cleanupGate); }
                catch (cause) { this.proofFailed(cause); throw cause; }
            }
            const lost = device.lost;
            this.lossCell.notify = cause => { this.fail('WEBGPU_DEVICE_LOST', cause, 'device', null, true); };
            observeWebGPUDeviceLoss(lost, this.lossCell);
            gate(); stage = 'WEBGPU_START_FAILED';
            const add = this.method(device, 'addEventListener', gate), remove = this.method(device, 'removeEventListener', gate);
            const listener = (event: Event): void => { this.fail('WEBGPU_UNCAPTURED_ERROR', (event as GPUUncapturedErrorEvent).error, 'device', null); };
            add('uncapturederror', listener); this.removeListener = () => remove('uncapturederror', listener); gate();
            const queue = device.queue; gate(); this.write = this.method(queue, 'writeBuffer', gate); this.submit = this.method(queue, 'submit', gate); this.fence = this.method(queue, 'onSubmittedWorkDone', gate);
            this.push = this.method(device, 'pushErrorScope', gate); this.pop = this.method(device, 'popErrorScope', gate);
            this.buffer = this.method(device, 'createBuffer', gate); this.encoder = this.method(device, 'createCommandEncoder', gate);
            const shader = this.method(device, 'createShaderModule', gate), pipeline = this.method(device, 'createRenderPipelineAsync', gate);
            const limits = device.limits; gate();
            const captured: Record<string, number> = {};
            for (const key of ['maxTextureDimension2D', 'maxBufferSize', 'maxVertexBuffers', 'maxVertexAttributes', 'maxVertexBufferArrayStride', 'maxColorAttachments', 'maxColorAttachmentBytesPerSample'] as const) { captured[key] = limits[key]; gate(); if (!Number.isSafeInteger(captured[key]) || captured[key]! <= 0) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT'); }
            if (captured['maxVertexBuffers']! < 1 || captured['maxVertexAttributes']! < 2 || captured['maxVertexBufferArrayStride']! < 24 || captured['maxColorAttachments']! < 1 || captured['maxColorAttachmentBytesPerSample']! < 4) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT');
            this.limits = { maxTextureDimension2D: captured['maxTextureDimension2D']!, maxBufferSize: captured['maxBufferSize']! };
            const scopes: Promise<void>[] = [];
            let promise: Promise<GPURenderPipeline> | undefined;
            let synchronous: { readonly cause: unknown } | undefined;
            try {
                this.scoped(null, 'startup', scopes, gate, () => {
                    promise = observed(createWebGPURectanglePipeline(d => {
                        gate();
                        const module = shader(d);
                        gate();
                        return module;
                    }, d => {
                        gate();
                        const result = observed(pipeline(d));
                        promise = result;
                        gate();
                        return result;
                    }, this.format));
                });
            } catch (cause) {
                // Occurrence is independent of the arbitrary thrown value, including undefined.
                synchronous = { cause };
            }
            // Pop all scopes before awaiting independently observed async pipeline work.
            const outcomes = await Promise.allSettled([...scopes, ...(promise ? [promise] : [])]);
            if (synchronous && this.startupCancelled()) throw synchronous.cause;
            gate();
            if (synchronous) throw synchronous.cause;
            const rejected = outcomes.find(outcome => outcome.status === 'rejected');
            if (rejected?.status === 'rejected') throw rejected.reason;
            this.pipeline = (outcomes[outcomes.length - 1] as PromiseFulfilledResult<GPURenderPipeline>).value;
            const configureScopes: Promise<void>[] = [];
            let configureFailure: { readonly cause: unknown } | undefined;
            try {
                this.scoped(null, 'startup', configureScopes, gate, () => this.configureSurface(gate));
            } catch (cause) {
                configureFailure = { cause };
            }
            const configured = await Promise.allSettled(configureScopes);
            if (configureFailure && this.startupCancelled()) throw configureFailure.cause;
            gate();
            if (configureFailure) throw configureFailure.cause;
            const failed = configured.find(outcome => outcome.status === 'rejected');
            if (failed?.status === 'rejected') throw failed.reason;
            this.state = 'active';
        } catch (cause) {
            const classified = cause instanceof ClassifiedWebGPUFailure ? cause : undefined;
            const original = classified ? classified.original : cause;
            if (this.startupCancelled()) {
                throw error('WEBGPU_START_CANCELLED', original);
            }
            if (classified && this.firstFailure?.code === classified.code) {
                throw classified.publicError;
            }
            // Public EgretError instances are ordinary external causes, regardless of their code.
            throw this.fail(classified ? classified.code : stage, original, 'startup', null);
        }
    }
    private scoped(serial: number | null, phase: 'startup' | 'frame', outcomes: Promise<void>[], gate: () => void, work: () => void): void {
        const filters: GPUErrorFilter[] = ['out-of-memory', 'internal', 'validation']; let pushed = 0;
        try { for (const filter of filters) { gate(); this.push!(filter); pushed++; gate(); } work(); }
        finally {
            while (pushed > 0) {
                const filter = filters[--pushed]!;
                try {
                    const result = observed(this.pop!()).then(fault => {
                        if (fault) {
                            const code = filter === 'validation' ? 'WEBGPU_VALIDATION' : filter === 'internal' ? 'WEBGPU_INTERNAL' : 'WEBGPU_OUT_OF_MEMORY';
                            throw new ClassifiedWebGPUFailure(code, fault, this.fail(code, fault, phase, serial));
                        }
                    }, cause => {
                        throw new ClassifiedWebGPUFailure('WEBGPU_SCOPE_FAILED', cause, this.fail('WEBGPU_SCOPE_FAILED', cause, phase, serial, true));
                    });
                    outcomes.push(observed(result));
                } catch (cause) {
                    const failure = new ClassifiedWebGPUFailure('WEBGPU_SCOPE_FAILED', cause, this.fail('WEBGPU_SCOPE_FAILED', cause, phase, serial, true));
                    outcomes.push(observed(Promise.reject(failure)));
                }
            }
        }
    }
    private configureSurface(gate: () => void): void {
        gate();
        // A throwing external configure may already have changed the leased context.
        this.configured = true;
        this.configure!({ device: this.device!, format: this.format, colorSpace: 'srgb', alphaMode: 'premultiplied', usage: 16 | (this.options.enableReadback ? 1 : 0) });
        gate();
    }
    private ownedBuffer(size: number, usage: number, record: Submission, gate: () => void): OwnedWebGPUBuffer {
        gate(); const buffer = this.buffer!({ size, usage });
        // Record ownership immediately, even if capture getters throw or close reentrantly.
        const resource: OwnedWebGPUBuffer = { buffer, destroy: () => { throw new TypeError('uncaptured destroy'); }, unmap: () => { throw new TypeError('uncaptured unmap'); }, map: () => Promise.reject(new TypeError('uncaptured map')), mappedRange: () => { throw new TypeError('uncaptured range'); }, mapped: false, cleaned: false };
        record.resources.push(resource);
        let destroy: () => void;
        try { destroy = this.method(buffer, 'destroy', () => undefined); }
        catch (cause) { record.unsafe = true; this.proofFailed(cause); throw cause; }
        Object.assign(resource, { destroy }); gate();
        const unmap = this.method(buffer, 'unmap', gate), map = this.method(buffer, 'mapAsync', gate), mappedRange = this.method(buffer, 'getMappedRange', gate);
        Object.assign(resource, { unmap, map, mappedRange }); gate(); return resource;
    }
    private preflight(input: RenderFrame2D) {
        try {
            const copied = copyFrame2D(input, this.options); this.active();
            const prepared = prepareRectangles2D(copied.frame, copied.width, copied.height, this.options);
            if (copied.width > this.limits.maxTextureDimension2D || copied.height > this.limits.maxTextureDimension2D) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT');
            const packed = packWebGPUVertices(prepared, copied.width, copied.height, { maxUploadBytes: this.options.maxUploadBytes, maxBufferSize: this.limits.maxBufferSize });
            let rowPitch = 0, staging = 0, output = 0;
            const ticket = this.ticket && !this.ticket.bound ? this.ticket : undefined;
            if (ticket) {
                rowPitch = Math.ceil(copied.width * 4 / 256) * 256; staging = rowPitch * copied.height; output = copied.width * copied.height * 4;
                if (![rowPitch, staging, output, staging + output].every(Number.isSafeInteger) || staging + output > this.options.maxReadbackBytes) throw new ClassifiedWebGPUFailure('WEBGPU_FRAME_BUDGET');
                if (staging > this.limits.maxBufferSize) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT');
            }
            if (this.ledger.size >= this.options.maxPendingFrames || packed.data.byteLength > this.options.maxPendingUploadBytes - this.pendingUploadBytes || staging + output > this.options.maxReadbackBytes - this.pendingReadbackBytes) throw new ClassifiedWebGPUFailure('WEBGPU_BACKPRESSURE');
            if (this.lastSerial === Number.MAX_SAFE_INTEGER) throw new ClassifiedWebGPUFailure('WEBGPU_SERIAL_EXHAUSTED');
            this.active(); return { ...copied, ...packed, rowPitch, staging, output, ticket };
        } catch (cause) {
            if (this.state !== 'active') throw this.stateError();
            if (cause instanceof ClassifiedWebGPUFailure) throw cause.publicError;
            if (cause instanceof FrameInputReadError) throw error('WEBGPU_FRAME_INVALID', cause.cause);
            if (cause instanceof FrameCopyError) throw error(cause.reason === 'backing' ? 'WEBGPU_BACKING_LIMIT' : cause.reason === 'budget' ? 'WEBGPU_FRAME_BUDGET' : 'WEBGPU_FRAME_INVALID', cause.cause);
            if (cause instanceof GeometryPreparationError) throw error(cause.reason === 'range' ? 'WEBGPU_GEOMETRY_RANGE' : cause.reason === 'budget' ? 'WEBGPU_FRAME_BUDGET' : 'WEBGPU_PRECISION_UNSUPPORTED', cause.cause);
            if (cause instanceof WebGPUPackingError) throw error(cause.reason === 'device' ? 'WEBGPU_DEVICE_LIMIT' : cause.reason === 'budget' ? 'WEBGPU_FRAME_BUDGET' : 'WEBGPU_PRECISION_UNSUPPORTED', cause.cause);
            throw error('WEBGPU_FRAME_INVALID', cause);
        }
    }
    public renderFrame(input: RenderFrame2D): undefined {
        if (this.busy) throw error('WEBGPU_REENTRANT'); this.active(); this.busy = true; this.cpu = deferred<void>();
        try {
            const p = this.preflight(input), serial = ++this.lastSerial, done = deferred<void>();
            const record: Submission = { serial, upload: p.data.byteLength, readback: p.staging + p.output, resources: [], outcome: done.promise, completion: done.promise, failure: undefined, unsafe: false, retired: false };
            this.ledger.add(record); this.pendingUploadBytes += record.upload; this.pendingReadbackBytes += record.readback;
            // Bind precisely the unbound ticket whose capacity this preflight reserved.
            const ticket = p.ticket;
            if (ticket) ticket.bound = true;
            const outcomes: Promise<unknown>[] = []; let touchedQueue = false, synchronous: EgretError | undefined, result: WebGPUReadback | undefined, staging: OwnedWebGPUBuffer | undefined, submitted = false;
            const gate = (): void => this.active();
            try {
                this.scoped(serial, 'frame', outcomes as Promise<void>[], gate, () => {
                    const oldWidth = this.surface.width; gate(); const oldHeight = this.surface.height; gate();
                    if (oldWidth !== p.width) { this.surface.width = p.width; gate(); }
                    if (oldHeight !== p.height) { this.surface.height = p.height; gate(); }
                    const width = this.surface.width; gate(); const height = this.surface.height; gate(); if (width !== p.width || height !== p.height) throw new Error('Canvas rejected dimensions');
                    if (oldWidth !== p.width || oldHeight !== p.height) this.configureSurface(gate);
                    let vertex: OwnedWebGPUBuffer | undefined;
                    if (record.upload) { vertex = this.ownedBuffer(record.upload, 32 | 8, record, gate); touchedQueue = true; this.write!(vertex.buffer, 0, p.data as Float32Array<ArrayBuffer>); gate(); }
                    staging = ticket ? this.ownedBuffer(p.staging, 1 | 8, record, gate) : undefined;
                    const texture = this.currentTexture!(); gate(); const view = this.method(texture, 'createView', gate)(); gate();
                    const encoder = this.encoder!(); gate(); const begin = this.method(encoder, 'beginRenderPass', gate), finish = this.method(encoder, 'finish', gate), copy = ticket ? this.method(encoder, 'copyTextureToBuffer', gate) : undefined;
                    const color = p.frame.clearColor, alpha = p.frame.clearAlpha;
                    const pass = begin({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: { r: ((color >>> 16) & 255) / 255 * alpha, g: ((color >>> 8) & 255) / 255 * alpha, b: (color & 255) / 255 * alpha, a: alpha } }] }); gate();
                    // Capture each pass method once; wrappers check terminal state after every call.
                    const captured = {} as GPURenderPassEncoder;
                    for (const key of ['setPipeline', 'setViewport', 'setScissorRect', 'setVertexBuffer', 'draw'] as const) {
                        const method = this.method(pass, key, gate) as (...args: unknown[]) => unknown;
                        Object.defineProperty(captured, key, { value: (...args: unknown[]) => { gate(); const value = method(...args); gate(); return value; } });
                    }
                    const end = this.method(pass, 'end', gate); encodeWebGPURectangles(captured, this.pipeline!, vertex?.buffer, p.ranges, p.width, p.height); end(); gate();
                    if (staging) { try { copy!({ texture }, { buffer: staging.buffer, bytesPerRow: p.rowPitch, rowsPerImage: p.height }, { width: p.width, height: p.height, depthOrArrayLayers: 1 }); } catch (cause) { throw new ClassifiedWebGPUFailure('WEBGPU_READBACK_FAILED', cause, this.fail('WEBGPU_READBACK_FAILED', cause, 'readback', serial)); } gate(); }
                    const commands = finish(); gate(); touchedQueue = true; this.submit!([commands]); submitted = true; gate();
                });
            } catch (cause) {
                synchronous = cause instanceof ClassifiedWebGPUFailure ? cause.publicError : this.fail('WEBGPU_RENDER_FAILED', cause, 'frame', serial);
                record.failure = synchronous;
            }
            // No asynchronous readback closure is formed inside the current-texture scope.
            if (submitted && staging && !synchronous) {
                try { outcomes.push(this.readPixels(staging, record, p.frame.frameId, p.width, p.height, p.rowPitch, p.output).then(value => { result = value; })); }
                catch (cause) { record.unsafe = true; synchronous = this.fail('WEBGPU_READBACK_FAILED', cause, 'readback', serial, true); record.failure = synchronous; }
            }
            // A successful/attempted write is queue work even if encoding prevented submit.
            if (touchedQueue) {
                try { outcomes.push(observed(this.fence!()).catch(cause => { record.unsafe = true; throw this.fail('WEBGPU_QUEUE_FAILED', cause, 'frame', serial, true); })); }
                catch (cause) { record.unsafe = true; outcomes.push(observed(Promise.reject(this.fail('WEBGPU_QUEUE_FAILED', cause, 'frame', serial, true)))); }
            }
            const settled = Promise.allSettled(outcomes).then(results => {
                const rejected = results.find(value => value.status === 'rejected');
                if (rejected?.status === 'rejected') {
                    record.failure ??= rejected.reason instanceof ClassifiedWebGPUFailure ? rejected.reason.publicError : rejected.reason as EgretError;
                }
                if (this.unsafe) record.unsafe = true;
                if (!record.unsafe) this.retire(record);
                if (ticket) {
                    if (record.failure) ticket.reject(record.failure);
                    else if (this.firstFailure) ticket.reject(error(this.firstFailure.code, this.firstFailure.cause));
                    else if (result) ticket.resolve(result);
                    else ticket.reject(error('WEBGPU_READBACK_FAILED'));
                    if (this.ticket === ticket) this.ticket = undefined;
                }
                done.resolve();
            });
            observed(settled).catch(cause => { record.unsafe = true; record.failure = this.fail('WEBGPU_RENDER_FAILED', cause, 'cleanup', serial, true); ticket?.reject(record.failure); done.resolve(); });
            record.completion = observed(done.promise.then(() => { if (record.failure) throw record.failure; if (this.firstFailure && (this.firstFailure.serial === null || this.firstFailure.serial <= serial)) throw error(this.firstFailure.code, this.firstFailure.cause); }));
            if (synchronous) throw synchronous;
            return undefined;
        } finally { this.busy = false; this.cpu.resolve(); }
    }
    private readPixels(staging: OwnedWebGPUBuffer, record: Submission, frameId: number, width: number, height: number, rowPitch: number, output: number): Promise<WebGPUReadback> {
        const mapping = observed(staging.map(1));
        return observed(mapping.then(() => {
            staging.mapped = true; const mapped = new Uint8Array(staging.mappedRange()), bytes = new Uint8Array(output);
            for (let y = 0; y < height; y++) bytes.set(mapped.subarray(y * rowPitch, y * rowPitch + width * 4), y * width * 4);
            if (this.format === 'bgra8unorm') for (let i = 0; i < bytes.length; i += 4) { const blue = bytes[i]!; bytes[i] = bytes[i + 2]!; bytes[i + 2] = blue; }
            return Object.freeze({ serial: record.serial, frameId, width, height, format: 'rgba8unorm' as const, sourceFormat: this.format, colorSpace: 'srgb' as const, alphaMode: 'premultiplied' as const, bytes });
        }).catch(cause => { record.unsafe = true; throw this.fail('WEBGPU_READBACK_FAILED', cause, 'readback', record.serial, true); }));
    }
    private retire(record: Submission): void {
        if (record.retired) return;
        record.retired = true;
        for (const resource of record.resources) {
            for (const cause of cleanupWebGPUBuffer(resource)) {
                // Completion safety is independent of an already recorded rendering failure.
                const cleanupFailure = this.fail('WEBGPU_RENDER_FAILED', cause, 'cleanup', record.serial, true);
                record.unsafe = true;
                record.failure ??= cleanupFailure;
            }
        }
        this.ledger.delete(record); this.pendingUploadBytes -= record.upload; this.pendingReadbackBytes -= record.readback;
    }
    public requestReadback(): Promise<WebGPUReadback> {
        try { this.active(); if (!this.options.enableReadback) throw error('WEBGPU_READBACK_DISABLED'); if (this.ticket) throw error('WEBGPU_READBACK_PENDING'); this.ticket = { ...deferred<WebGPUReadback>(), bound: false }; return this.ticket.promise; }
        catch (cause) { return observed(Promise.reject(cause)); }
    }
    public whenIdle(): Promise<void> {
        if (this.cleanupOutcome === 'unsafe') return observed(Promise.reject(error('WEBGPU_CLOSE_UNSAFE', this.unsafeCause)));
        if (this.firstFailure) return observed(Promise.reject(error(this.firstFailure.code, this.firstFailure.cause)));
        if (this.state === 'closed') return Promise.resolve();
        const serial = this.lastSerial, pending = [...this.ledger].map(record => record.completion); if (this.starting) pending.push(this.starting);
        return observed(Promise.allSettled(pending).then(results => { const failed = results.find(result => result.status === 'rejected'); if (failed?.status === 'rejected') throw failed.reason; if (this.firstFailure && (this.firstFailure.serial === null || this.firstFailure.serial <= serial)) throw error(this.firstFailure.code, this.firstFailure.cause); }));
    }
    public close(): Promise<void> {
        if (this.closing) return this.closing;
        const barrier = deferred<void>(); this.closing = barrier.promise; this.state = 'closing'; this.cleanupOutcome = 'pending'; this.cancelTicket(error('WEBGPU_CLOSED'));
        this.cleanup().then(barrier.resolve, barrier.reject); return barrier.promise;
    }
    private async cleanup(): Promise<void> {
        if (this.starting) await Promise.allSettled([this.starting]);
        if (this.busy) await this.cpu.promise;
        await Promise.allSettled([...this.ledger].map(record => record.outcome));
        if (this.fence && !this.unsafe) { try { await observed(this.fence()); } catch (cause) { this.proofFailed(cause); } }
        this.finalizing = true;
        for (const record of [...this.ledger]) this.retire(record);
        if (this.configured) { this.configured = false; try { this.unconfigure!(); } catch (cause) { this.proofFailed(cause); } }
        if (this.removeListener) { const remove = this.removeListener; this.removeListener = undefined; try { remove(); } catch (cause) { this.proofFailed(cause); } }
        // Deliver a loss queued by a cleanup boundary before detaching the leased observer.
        await Promise.resolve();
        // The safe return boundary ends the borrowed lease; deliberate owned destruction is ignored.
        delete this.lossCell.notify;
        if (this.destroyDevice) { const destroy = this.destroyDevice; this.destroyDevice = undefined; try { destroy(); } catch (cause) { this.proofFailed(cause); } }
        this.cleanupOutcome = this.unsafe ? 'unsafe' : 'safe'; this.state = 'closed';
        if (this.unsafe) throw error('WEBGPU_CLOSE_UNSAFE', this.unsafeCause);
    }
    public setTimeout(callback: () => void, delayMs: number): () => void {
        this.timers ??= { set: globalThis.setTimeout.bind(globalThis), clear: globalThis.clearTimeout.bind(globalThis) };
        const timer = this.timers.set(callback, delayMs); let cancelled = false; const clear = this.timers.clear;
        return () => { if (!cancelled) { cancelled = true; clear(timer); } };
    }
}
export function createWebGPUHost(options: WebGPUHostOptions): WebGPUHost { return new WebGPUHostImplementation(options); }
