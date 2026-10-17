import { readOwnedTexturedFrame } from '#egret-textured-frame-state';
import type { ImageData2D, RenderFrame2D, RenderHostAdapter, TexturedRenderFrame2D, TexturedRenderHostAdapter } from '@egret/contracts';
import { IMAGE_LIMITS_2D, TEXTURED_FRAME_PROFILE_2D } from '@egret/contracts';
import { EgretError } from '@egret/runtime';
import { copyMixedFrame2D } from '../rendering/copyMixedFrame2D.js';
import { FrameCopyError, FrameInputReadError } from '../rendering/copyFrame2D.js';
import { GeometryPreparationError } from '../rendering/prepareRectangles2D.js';
import { prepareMixedDraws2D } from '../rendering/prepareMixedDraws2D.js';
import { ImagePackingAllocationError, packImageVertices2D } from '../rendering/packImageVertices2D.js';
import { packWebGPUVertices, WebGPUPackingError, createWebGPURectanglePipeline, encodeWebGPURectangles } from './webgpuPass.js';
import { createWebGPUImagePipeline, encodeWebGPUImage } from './webgpuImagePass.js';
import { ImageProjectionError, planImageProjections, copyProjectionPixels } from './imageProjections2D.js';
import type { ProjectionPlan2D, ProjectionView2D } from './imageProjections2D.js';
import { observed, deferred, cleanupWebGPUBuffer, cleanupWebGPUTexture, observeWebGPUDeviceLoss } from './webgpuLifetime.js';
import type { OwnedWebGPUBuffer, OwnedWebGPUTexture } from './webgpuLifetime.js';
import type { B1BuiltinProtocol, B1WebGPUHost, TexturedB1WebGPUHost } from './b1.js';
import { admitTexturedFrame2D, TexturedFrameAdmissionError2D } from '../rendering/admitTexturedFrame2D.js';
import { prepareTexturedDraws2D } from '../rendering/prepareTexturedDraws2D.js';
import { TexturedPreparationBudget2D } from '../rendering/texturedPreparationBudget2D.js';
import { TexturedMeshPackingAllocationError } from '../rendering/packTexturedMesh2D.js';
import { runOwnedPreparationScope } from '../rendering/ownedPreparationFailure2D.js';
import { planTexturedImageProjections } from './imageProjections2D.js';
import { prepareTexturedSubmission2D, planTexturedSubmissionStorage2D, packTexturedSubmission2D, isTexturedSubmissionAdmissionError2D } from './prepareTexturedSubmission2D.js';
import type { PackedTexturedDraw2D, TexturedSubmissionOwnerSnapshot2D } from './prepareTexturedSubmission2D.js';
import { admitTexturedWebGPUOptions } from './texturedWebGPUOptions.js';
import type { TexturedWebGPUHostOptions, TexturedWebGPUConfiguration } from './texturedWebGPUOptions.js';
import { createWebGPUTexturedPipeline } from './webgpuTexturedPass.js';
export type { TexturedWebGPUHostOptions } from './texturedWebGPUOptions.js';

export type WebGPUHostState = 'new' | 'starting' | 'active' | 'stopped' | 'failed' | 'closing' | 'closed';
export type WebGPUHostErrorCode =
    'WEBGPU_OPTIONS_INVALID' | 'WEBGPU_UNAVAILABLE' | 'WEBGPU_ADAPTER_UNAVAILABLE' | 'WEBGPU_DEVICE_FAILED' | 'WEBGPU_CONTEXT_UNAVAILABLE' | 'WEBGPU_FORMAT_UNSUPPORTED' |
    'WEBGPU_START_FAILED' | 'WEBGPU_START_CANCELLED' | 'WEBGPU_NOT_STARTED' | 'WEBGPU_STOPPED' | 'WEBGPU_CLOSED' | 'WEBGPU_FAILED' | 'WEBGPU_REENTRANT' |
    'WEBGPU_FRAME_PROFILE_UNSUPPORTED' | 'WEBGPU_FRAME_INVALID' | 'WEBGPU_BACKING_LIMIT' | 'WEBGPU_GEOMETRY_RANGE' | 'WEBGPU_PRECISION_UNSUPPORTED' | 'WEBGPU_FRAME_BUDGET' | 'WEBGPU_BACKPRESSURE' |
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
export interface TexturedWebGPUHostStatus { readonly host: WebGPUHostStatus; readonly pendingGeometryBytes: number; }
export interface TexturedWebGPUHost extends WebGPUHost, Pick<TexturedRenderHostAdapter, 'texturedFrameProfile' | 'renderTexturedFrame'> { getTexturedStatus(): TexturedWebGPUHostStatus; }
type Configuration = Required<Omit<WebGPUHostOptions, 'canvas' | 'device' | 'onDiagnostic'>>;
type Ticket = ReturnType<typeof deferred<WebGPUReadback>> & { bound: boolean };
type PackedDraw = PackedTexturedDraw2D;
interface SharedSubmissionPlan2D {
    frame: RenderFrame2D | TexturedRenderFrame2D; width: number; height: number; draws: PackedDraw[];
    upload: number; geometryBytes: number; projectionPlan: ProjectionPlan2D; projections: Uint8Array<ArrayBuffer>[];
    rowPitch: number; staging: number; output: number; ticket: Ticket | undefined; scene: SceneAdmission | undefined;
}
// READY metadata never retains an image, frame, projection, record or callback.
interface ImageResidencyEntry {
    epoch: object; bucket: Map<string, ImageResidencyEntry>; cropKey: string; bytes: number;
    resource: OwnedWebGPUTexture | undefined; view: GPUTextureView | undefined;
    pinCount: number; previous: ImageResidencyEntry | undefined; next: ImageResidencyEntry | undefined;
    state: 'cold' | 'ready' | 'detached';
}
interface ImageResidencyCandidate {
    image: ImageData2D; viewIndex: number; entry: ImageResidencyEntry; transferred: boolean;
}
interface ImageResidencyPlan {
    epoch: object; revision: object; victims: ImageResidencyEntry[]; bytes: number; use: ImageResidencyUse;
}
interface ImageResidencyUse {
    epoch: object; hits: Map<number, ImageResidencyEntry>; candidates: Map<number, ImageResidencyCandidate>;
    reserved: number; pinned: boolean; finished: boolean; touchedQueue: boolean;
}
interface Submission {
    serial: number; upload: number; readback: number; textureBytes: number; geometryBytes: number;
    sceneBytes: number; uniformBytes: number; depthBytes: number;
    resources: OwnedWebGPUBuffer[]; textures: OwnedWebGPUTexture[]; views: GPUTextureView[]; bindings: GPUBindGroup[];
    frame: RenderFrame2D | TexturedRenderFrame2D | undefined; projectionPlan: ProjectionPlan2D | undefined; projections: Uint8Array<ArrayBuffer>[]; draws: PackedDraw[];
    imageUse: ImageResidencyUse | undefined;
    scene: SceneValue | undefined; meshes: PackedMesh[]; sceneDraws: SceneUploadDraw[];
    outcome: Promise<void>; completion: Promise<void>; failure: EgretError | undefined; unsafe: boolean; retired: boolean;
}
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
// Neither an options field nor a caller-supplied callback selects this mode.
const B1_MODE = Symbol('owned B1 host mode');
const TEXTURED_MODE = Symbol('owned textured host mode');
const TEXTURED_SCENE_MODE = Symbol('owned textured scene host mode');
const TEXTURED_OWNERS = new WeakSet<object>();
const TEXTURED_OPTIONS = new WeakMap<object, TexturedWebGPUConfiguration>();
const B1_PROTOCOL_FIELDS = ['version', 'createSceneFrame3D', 'isSceneFrame3D', 'getScene3DErrorOrigin', 'packMeshGeometry3D', 'getMeshPacking3DErrorOrigin', 'createWebGPUMeshPipeline', 'encodeWebGPUMesh'] as const;
type BuiltinFunctions = Omit<B1BuiltinProtocol, 'version'>;
type SceneValue = ReturnType<BuiltinFunctions['createSceneFrame3D']>;
type PackedMesh = ReturnType<BuiltinFunctions['packMeshGeometry3D']>;
interface SceneUploadDraw { mesh: PackedMesh; uniform: Float32Array<ArrayBuffer>; }
interface SceneAdmission {
    scene: SceneValue; functions: BuiltinFunctions;
    sceneBytes: number; uniformBytes: number; depthBytes: number;
    meshes: PackedMesh[]; draws: SceneUploadDraw[];
}
const B1_LIMITS = { draws: 64, geometries: 64, cpu: 8388608, scene: 4194304, pendingScene: 8388608, uniform: 4096, pendingUniform: 8192, depth: 16777216, pendingDepth: 33554432 } as const;
const B1_OWNERS = new WeakSet<object>();
const B1_FUNCTIONS = new WeakMap<object, BuiltinFunctions>();

/** The sole lifecycle/submission authority; resource helpers only record settled ownership. */
class WebGPUHostImplementation implements WebGPUHost {
    public readonly surface: HTMLCanvasElement;
    private readonly options: Configuration;
    private readonly borrowed: GPUDevice | undefined;
    private readonly callback: ((diagnostic: WebGPUHostDiagnostic) => unknown) | undefined;
    private state: WebGPUHostState = 'new';
    private starting: Promise<void> | undefined;
    private startingPending = false;
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
    private pendingTextureBytes = 0;
    private pendingGeometryBytes = 0;
    private pendingSceneBytes = 0;
    private pendingUniformBytes = 0;
    private pendingDepthBytes = 0;
    private readonly ledger = new Set<Submission>();
    private readonly imageEpoch = {};
    private imageEnabled = false;
    private imageRevision = {};
    private readonly imageDirectory = new WeakMap<ImageData2D, Map<string, ImageResidencyEntry>>();
    private imageOldest: ImageResidencyEntry | undefined;
    private imageNewest: ImageResidencyEntry | undefined;
    private readyCount = 0;
    private allocatedImageBytes = 0;
    private reservedImageBytes = 0;
    private readonly imageCleanup = new Set<ImageResidencyEntry>();
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
    private imagePipeline: GPURenderPipeline | undefined;
    private imageLayout: GPUBindGroupLayout | undefined;
    private texturedPipeline: GPURenderPipeline | undefined;
    private texturedLayout: GPUBindGroupLayout | undefined;
    private meshPipeline: GPURenderPipeline | undefined;
    private meshLayout: GPUBindGroupLayout | undefined;
    private sampler: GPUSampler | undefined;
    private push: ((filter: GPUErrorFilter) => void) | undefined;
    private pop: (() => Promise<GPUError | null>) | undefined;
    private write: GPUQueue['writeBuffer'] | undefined;
    private writeTexture: GPUQueue['writeTexture'] | undefined;
    private submit: GPUQueue['submit'] | undefined;
    private fence: GPUQueue['onSubmittedWorkDone'] | undefined;
    private buffer: GPUDevice['createBuffer'] | undefined;
    private texture: GPUDevice['createTexture'] | undefined;
    private bindGroup: GPUDevice['createBindGroup'] | undefined;
    private encoder: GPUDevice['createCommandEncoder'] | undefined;
    private removeListener: (() => void) | undefined;
    // Pending borrowed device.lost retains only this detachable cell after lease return.
    private readonly lossCell: { notify?: (cause: unknown) => void } = {};
    private timers: { set: typeof globalThis.setTimeout; clear: typeof globalThis.clearTimeout } | undefined;

    public constructor(input: WebGPUHostOptions, mode?: typeof B1_MODE | typeof TEXTURED_MODE | typeof TEXTURED_SCENE_MODE) {
        if (mode === TEXTURED_MODE || mode === TEXTURED_SCENE_MODE) {
            try {
                const admitted = admitTexturedWebGPUOptions(input);
                this.surface = admitted.surface; Object.defineProperty(this, 'surface', { writable: false, configurable: false });
                this.options = admitted.configuration; this.borrowed = admitted.borrowed; this.callback = admitted.callback;
                TEXTURED_OPTIONS.set(this, admitted.configuration); TEXTURED_OWNERS.add(this);
            } catch (cause) { throw error('WEBGPU_OPTIONS_INVALID', cause); }
        } else {
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
        if (mode === B1_MODE || mode === TEXTURED_SCENE_MODE) {
            // Keep mode and the captured function table in module-owned weak
            // storage; no instance field exposes the token or a mutable registry.
            B1_OWNERS.add(this);
            // Same owner and inherited ordinary lifecycle. Scene methods are
            // own closures only on B1 instances; no ordinary prototype gains them.
            Object.defineProperties(this, {
                renderSceneFrame: { value: (scene: SceneValue, overlay: RenderFrame2D): undefined => this.render(overlay, scene), enumerable: true },
                getSceneStatus: { value: () => Object.freeze({ host: this.getStatus(), pendingSceneBytes: this.pendingSceneBytes, pendingUniformBytes: this.pendingUniformBytes, pendingDepthBytes: this.pendingDepthBytes }), enumerable: true },
            });
        }
        if (mode === TEXTURED_MODE || mode === TEXTURED_SCENE_MODE) {
            // Own immutable ports preserve the ordinary and B1 prototypes.
            Object.defineProperties(this, {
                texturedFrameProfile: { value: TEXTURED_FRAME_PROFILE_2D, enumerable: true },
                renderTexturedFrame: { value: (frame: TexturedRenderFrame2D): undefined => this.renderTexturedOwnedFrame(frame), enumerable: true },
                getTexturedStatus: { value: (): TexturedWebGPUHostStatus => Object.freeze({ host: this.getStatus(), pendingGeometryBytes: this.pendingGeometryBytes }), enumerable: true },
            });
        }
        if (mode === TEXTURED_SCENE_MODE) {
            // Explicit opt-in owns both protocols and one submission authority.
            Object.defineProperty(this, 'renderSceneTexturedFrame', {
                value: (scene: SceneValue, overlay: TexturedRenderFrame2D): undefined => this.renderSceneTexturedOwnedFrame(scene, overlay),
                enumerable: true,
            });
        }
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
    private proofFailed(cause: unknown): void { this.invalidateImageResidency(); if (!this.unsafe) { this.unsafe = true; this.unsafeCause = cause; } }
    private fail(code: WebGPUHostErrorCode, cause: unknown, phase: WebGPUHostFailure['phase'], serial: number | null, unsafe = false): EgretError {
        this.invalidateImageResidency();
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
    public stop(): void { this.invalidateImageResidency(); if (this.state === 'new' || this.state === 'starting' || this.state === 'active') this.state = 'stopped'; this.cancelTicket(error('WEBGPU_STOPPED')); }
    public start(): Promise<void> {
        // A B1 loader can stop/close reentrantly while startup is still owned.
        // Reuse its pending barrier; settled terminal states keep their errors.
        if (B1_OWNERS.has(this) && this.startingPending) return this.starting!;
        if (this.state === 'starting' || this.state === 'active') return this.starting!;
        if (this.state !== 'new') return observed(Promise.reject(this.stateError()));
        const barrier = deferred<void>(); this.starting = barrier.promise; this.startingPending = true; this.state = 'starting';
        // Cache before any getter/call can reenter start or close.
        this.initialize().then(() => { this.startingPending = false; barrier.resolve(); }, cause => { this.startingPending = false; barrier.reject(cause); }); return barrier.promise;
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
            if (B1_OWNERS.has(this)) {
                stage = 'WEBGPU_START_FAILED';
                // Observe the literal import immediately. The existing starting
                // barrier drains it even when a loader boundary calls stop/close.
                const loading = observed(import('./b1.js'));
                const namespace = await loading;
                gate();
                const getter = namespace.getBuiltinB1Protocol; gate();
                const predicate = namespace.isBuiltinB1Protocol; gate();
                if (typeof getter !== 'function' || typeof predicate !== 'function') throw new TypeError('B1 built-in exports');
                const protocol = getter(); gate();
                if (!predicate(protocol)) throw new TypeError('B1 built-in identity');
                gate();
                if (Object.getPrototypeOf(protocol) !== Object.prototype || Object.getOwnPropertySymbols(protocol).length !== 0) throw new TypeError('B1 built-in object');
                const keys = Object.keys(protocol);
                if (keys.length !== B1_PROTOCOL_FIELDS.length || keys.some((key, index) => key !== B1_PROTOCOL_FIELDS[index])) throw new TypeError('B1 built-in keys');
                const functions = {} as BuiltinFunctions;
                for (const key of B1_PROTOCOL_FIELDS) {
                    const descriptor = Object.getOwnPropertyDescriptor(protocol, key);
                    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable || descriptor.writable || descriptor.configurable) throw new TypeError('B1 built-in descriptor');
                    const value: unknown = descriptor.value;
                    if (key === 'version') {
                        if (value !== 'egret.internal.b1/1') throw new TypeError('B1 built-in version');
                    } else {
                        if (typeof value !== 'function') throw new TypeError('B1 built-in function');
                        // Capture each actual function once into the owner table.
                        Object.defineProperty(functions, key, { value, enumerable: true });
                    }
                }
                if (!Object.isFrozen(protocol)) throw new TypeError('B1 built-in freeze');
                B1_FUNCTIONS.set(this, Object.freeze(functions));
                gate();
            }
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
            const queue = device.queue; gate(); this.write = this.method(queue, 'writeBuffer', gate); this.writeTexture = this.method(queue, 'writeTexture', gate); this.submit = this.method(queue, 'submit', gate); this.fence = this.method(queue, 'onSubmittedWorkDone', gate);
            this.push = this.method(device, 'pushErrorScope', gate); this.pop = this.method(device, 'popErrorScope', gate);
            this.buffer = this.method(device, 'createBuffer', gate); this.encoder = this.method(device, 'createCommandEncoder', gate);
            this.texture = this.method(device, 'createTexture', gate); this.bindGroup = this.method(device, 'createBindGroup', gate);
            const sampler = this.method(device, 'createSampler', gate);
            const shader = this.method(device, 'createShaderModule', gate), pipeline = this.method(device, 'createRenderPipelineAsync', gate);
            const limits = device.limits; gate();
            const captured: Record<string, number> = {};
            for (const key of ['maxTextureDimension2D', 'maxBufferSize', 'maxVertexBuffers', 'maxVertexAttributes', 'maxVertexBufferArrayStride', 'maxColorAttachments', 'maxColorAttachmentBytesPerSample', 'maxBindGroups', 'maxBindingsPerBindGroup', 'maxSampledTexturesPerShaderStage', 'maxSamplersPerShaderStage', 'maxUniformBuffersPerShaderStage', 'maxUniformBufferBindingSize', 'maxBindGroupsPlusVertexBuffers', 'maxInterStageShaderVariables'] as const) { captured[key] = limits[key]; gate(); if (!Number.isSafeInteger(captured[key]) || captured[key]! <= 0) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT'); }
            if (captured['maxVertexBuffers']! < 1 || captured['maxVertexAttributes']! < (TEXTURED_OWNERS.has(this) ? 3 : 2) || captured['maxVertexBufferArrayStride']! < (TEXTURED_OWNERS.has(this) ? 32 : 24) || captured['maxColorAttachments']! < 1 || captured['maxColorAttachmentBytesPerSample']! < 4 || captured['maxBindGroups']! < 1 || captured['maxBindingsPerBindGroup']! < 3 || captured['maxSampledTexturesPerShaderStage']! < 1 || captured['maxSamplersPerShaderStage']! < 1 || captured['maxUniformBuffersPerShaderStage']! < 1 || captured['maxUniformBufferBindingSize']! < (B1_OWNERS.has(this) ? 64 : 16) || captured['maxBindGroupsPlusVertexBuffers']! < 2 || captured['maxInterStageShaderVariables']! < (TEXTURED_OWNERS.has(this) ? 2 : 1)) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT');
            this.limits = { maxTextureDimension2D: captured['maxTextureDimension2D']!, maxBufferSize: captured['maxBufferSize']! };
            const scopes: Promise<void>[] = [];
            const pipelines: Promise<GPURenderPipeline>[] = [];
            const builtin = B1_FUNCTIONS.get(this);
            const capturedShader = (descriptor: GPUShaderModuleDescriptor): GPUShaderModule => {
                gate(); const module = shader(descriptor); gate(); return module;
            };
            const capturedPipeline = (descriptor: GPURenderPipelineDescriptor): Promise<GPURenderPipeline> => {
                gate(); const result = observed(pipeline(descriptor));
                // A later call/gate can throw; close must still drain every already started peer.
                pipelines.push(result); gate(); return result;
            };
            let synchronous: { readonly cause: unknown } | undefined;
            try {
                this.scoped(null, 'startup', scopes, gate, () => {
                    createWebGPURectanglePipeline(capturedShader, capturedPipeline, this.format);
                    createWebGPUImagePipeline(capturedShader, capturedPipeline, this.format);
                    // The same captured boundary immediately owns this third
                    // Promise; no scene pipeline or import starts in ordinary mode.
                    if (builtin) builtin.createWebGPUMeshPipeline(capturedShader, capturedPipeline, this.format);
                    if (TEXTURED_OWNERS.has(this)) createWebGPUTexturedPipeline(capturedShader, capturedPipeline, this.format);
                    gate();
                    this.sampler = sampler({ addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge', magFilter: 'nearest', minFilter: 'nearest', mipmapFilter: 'nearest', lodMinClamp: 0, lodMaxClamp: 0, maxAnisotropy: 1 });
                    gate();
                });
            } catch (cause) {
                // Occurrence is independent of the arbitrary thrown value, including undefined.
                synchronous = { cause };
            }
            // Pop all scopes before awaiting independently observed async pipeline work.
            const outcomes = await Promise.allSettled([...scopes, ...pipelines]);
            if (synchronous && this.startupCancelled()) throw synchronous.cause;
            gate();
            if (synchronous) throw synchronous.cause;
            const rejected = outcomes.find(outcome => outcome.status === 'rejected');
            if (rejected?.status === 'rejected') throw rejected.reason;
            // Scope outcomes do not select pipeline roles. Their own ordered
            // results retain the old two/three roles and add scene2/textured3.
            const roles = outcomes.slice(scopes.length) as PromiseFulfilledResult<GPURenderPipeline>[];
            this.pipeline = roles[0]!.value;
            this.imagePipeline = roles[1]!.value;
            // Auto group0 is valid only after image pipeline settlement; no scopes span an await.
            const layout = this.method(this.imagePipeline, 'getBindGroupLayout', gate);
            gate(); this.imageLayout = layout(0); gate();
            if (builtin) {
                this.meshPipeline = roles[2]!.value;
                const meshLayout = this.method(this.meshPipeline, 'getBindGroupLayout', gate);
                this.meshLayout = meshLayout(0); gate();
            }
            if (TEXTURED_OWNERS.has(this)) {
                this.texturedPipeline = roles[builtin ? 3 : 2]!.value;
                const texturedLayout = this.method(this.texturedPipeline, 'getBindGroupLayout', gate);
                this.texturedLayout = texturedLayout(0); gate();
            }
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
            this.state = 'active'; this.imageEnabled = true;
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
    private ownedTexture(view: ProjectionView2D, record: Submission, gate: () => void, candidate: ImageResidencyCandidate): { texture: GPUTexture; view: GPUTextureView } {
        gate();
        const texture = this.texture!({ size: { width: view.region.width, height: view.region.height, depthOrArrayLayers: 1 }, dimension: '2d', format: 'rgba8unorm', mipLevelCount: 1, sampleCount: 1, usage: 2 | 4 });
        // Register the returned object before any gate or cleanup/view getter can reenter close.
        const resource: OwnedWebGPUTexture = { texture, destroy: () => { throw new TypeError('uncaptured texture destroy'); }, cleaned: false };
        record.textures.push(resource);
        candidate.entry.resource = resource;
        record.imageUse!.reserved -= candidate.entry.bytes;
        this.reservedImageBytes -= candidate.entry.bytes;
        this.allocatedImageBytes += candidate.entry.bytes;
        let destroy: () => void;
        try { destroy = this.method(texture, 'destroy', () => undefined); }
        catch (cause) { record.unsafe = true; this.proofFailed(cause); throw cause; }
        Object.assign(resource, { destroy }); gate();
        const createView = this.method(texture, 'createView', gate);
        gate(); const result = createView(); candidate.entry.view = result; record.views.push(result); gate(); return { texture, view: result };
    }
    private planImageResidency(p: SharedSubmissionPlan2D): ImageResidencyPlan {
        this.active();
        const hits = new Map<number, ImageResidencyEntry>(), candidates = new Map<number, ImageResidencyCandidate>();
        const buckets = new Map<ImageData2D, Map<string, ImageResidencyEntry>>();
        let bytes = 0;
        for (const draw of p.draws) {
            if (draw.kind === 'rect' || draw.packed.vertexCount === 0 || hits.has(draw.viewIndex) || candidates.has(draw.viewIndex)) continue;
            const view = p.projectionPlan.views[draw.viewIndex]!, region = view.region;
            const cropKey = `${region.x},${region.y},${region.width},${region.height}`;
            let bucket = this.imageDirectory.get(view.image) ?? buckets.get(view.image);
            if (!bucket) { bucket = new Map(); buckets.set(view.image, bucket); }
            const entry = bucket.get(cropKey);
            if (this.imageEnabled && entry?.epoch === this.imageEpoch && entry.state === 'ready') hits.set(draw.viewIndex, entry);
            else {
                candidates.set(draw.viewIndex, { image: view.image, viewIndex: draw.viewIndex, transferred: false,
                    entry: { epoch: this.imageEpoch, bucket, cropKey, bytes: view.byteLength, resource: undefined,
                        view: undefined, pinCount: 0, previous: undefined, next: undefined, state: 'cold' } });
                bytes += view.byteLength;
            }
        }
        const protectedHits = new Set(hits.values()), victims: ImageResidencyEntry[] = [];
        let available = this.allocatedImageBytes + this.reservedImageBytes, count = this.readyCount;
        for (let entry = this.imageOldest; entry; entry = entry.next) {
            if (available + bytes <= 33554432 && count + candidates.size <= 256) break;
            if (entry.epoch !== this.imageEpoch || entry.state !== 'ready' || entry.pinCount !== 0 || protectedHits.has(entry)) continue;
            victims.push(entry); available -= entry.bytes; count--;
        }
        return { epoch: this.imageEpoch, revision: this.imageRevision, victims, bytes,
            use: { epoch: this.imageEpoch, hits, candidates, reserved: 0, pinned: false, finished: false, touchedQueue: false } };
    }
    private unlinkImageResidency(entry: ImageResidencyEntry): void {
        if (entry.previous) entry.previous.next = entry.next; else this.imageOldest = entry.next;
        if (entry.next) entry.next.previous = entry.previous; else this.imageNewest = entry.previous;
        entry.previous = undefined; entry.next = undefined;
    }
    private appendImageResidency(entry: ImageResidencyEntry): void {
        entry.previous = this.imageNewest; entry.next = undefined;
        if (this.imageNewest) this.imageNewest.next = entry; else this.imageOldest = entry;
        this.imageNewest = entry;
    }
    private destroyReadyImage(entry: ImageResidencyEntry): void {
        // Register the cache owner before removing any lookup/LRU ownership.
        this.imageCleanup.add(entry);
        if (entry.state === 'ready') {
            entry.bucket.delete(entry.cropKey); this.unlinkImageResidency(entry);
            entry.state = 'detached'; this.readyCount--; this.imageRevision = {};
        }
        const resource = entry.resource!;
        if (resource.cleaned) return;
        const failures = cleanupWebGPUTexture(resource);
        if (failures.length) {
            this.proofFailed(failures[0]);
            throw failures[0];
        }
        // The native callback ran with the entire detached allocation charged.
        this.allocatedImageBytes -= entry.bytes; this.imageCleanup.delete(entry);
    }
    private beginImageResidency(record: Submission, plan: ImageResidencyPlan): ImageResidencyUse {
        this.active();
        if (!this.busy || !this.imageEnabled || plan.epoch !== this.imageEpoch || plan.revision !== this.imageRevision) throw new TypeError('stale image plan');
        const use = plan.use; record.imageUse = use;
        for (const candidate of use.candidates.values()) this.imageDirectory.set(candidate.image, candidate.entry.bucket);
        // Pin the complete hit set before touching order or entering any native call.
        for (const entry of use.hits.values()) entry.pinCount++;
        use.pinned = true;
        for (const entry of use.hits.values()) { this.unlinkImageResidency(entry); this.appendImageResidency(entry); }
        this.imageRevision = {};
        for (const entry of plan.victims) {
            this.active();
            this.destroyReadyImage(entry);
            this.active();
        }
        this.active();
        use.reserved = plan.bytes; this.reservedImageBytes += plan.bytes;
        return use;
    }
    private realizeImageResidency(record: Submission, use: ImageResidencyUse, viewIndex: number, gate: () => void): { texture: GPUTexture; view: GPUTextureView } {
        gate();
        const hit = use.hits.get(viewIndex);
        if (hit) { record.views.push(hit.view!); return { texture: hit.resource!.texture, view: hit.view! }; }
        const candidate = use.candidates.get(viewIndex)!, projection = record.projectionPlan!.views[viewIndex]!;
        const owned = this.ownedTexture(projection, record, gate, candidate);
        // Attempted queue writes retain the original fence obligation, including throws.
        use.touchedQueue = true;
        this.writeTexture!({ texture: owned.texture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 }, aspect: 'all' }, record.projections[viewIndex]!, { offset: 0, bytesPerRow: 4 * projection.region.width, rowsPerImage: projection.region.height }, { width: projection.region.width, height: projection.region.height, depthOrArrayLayers: 1 });
        gate(); return owned;
    }
    private isImagePromotionEligible(record: Submission): boolean {
        return this.state === 'active' && this.imageEnabled && !this.firstFailure && !this.unsafe && !this.finalizing
            && !record.failure && !record.unsafe && record.imageUse?.epoch === this.imageEpoch;
    }
    private finishImageResidency(record: Submission, allowPromotion: boolean): void {
        const use = record.imageUse;
        if (!use || use.finished) return;
        use.finished = true;
        if (use.pinned) { use.pinned = false; for (const entry of use.hits.values()) entry.pinCount--; }
        const failed = (cause: unknown): void => {
            const failure = this.fail('WEBGPU_RENDER_FAILED', cause, 'cleanup', record.serial, true);
            record.unsafe = true; record.failure ??= failure;
        };
        for (const candidate of use.candidates.values()) {
            const entry = candidate.entry, resource = entry.resource;
            if (!resource || candidate.transferred) continue;
            // Re-read qualification, winner and slot after every earlier cleanup callback.
            if (allowPromotion && this.isImagePromotionEligible(record) && entry.epoch === this.imageEpoch
                && !entry.bucket.has(entry.cropKey) && this.readyCount < 256) {
                try {
                    const revision = {};
                    entry.bucket.set(entry.cropKey, entry);
                    this.appendImageResidency(entry); entry.state = 'ready'; this.readyCount++;
                    candidate.transferred = true;
                    record.textures.splice(record.textures.indexOf(resource), 1);
                    this.imageRevision = revision;
                } catch (cause) {
                    // No native call occurs during publication; restore the original owner.
                    if (entry.bucket.get(entry.cropKey) === entry) entry.bucket.delete(entry.cropKey);
                    if (entry.state === 'ready') { this.unlinkImageResidency(entry); this.readyCount--; entry.state = 'cold'; }
                    candidate.transferred = false; failed(cause);
                }
            }
            if (!candidate.transferred && !resource.cleaned) {
                const failures = cleanupWebGPUTexture(resource);
                if (failures.length) { for (const cause of failures) failed(cause); }
                else this.allocatedImageBytes -= entry.bytes;
            }
        }
        this.reservedImageBytes -= use.reserved; use.reserved = 0;
        use.hits.clear(); use.candidates.clear(); record.imageUse = undefined;
        this.imageRevision = {};
    }
    private invalidateImageResidency(): void {
        this.imageEnabled = false; this.imageRevision = {};
    }
    private closeImageResidency(): void {
        this.invalidateImageResidency();
        while (this.imageOldest) {
            const entry = this.imageOldest;
            try { this.destroyReadyImage(entry); }
            catch (cause) { this.fail('WEBGPU_RENDER_FAILED', cause, 'cleanup', null, true); }
            // Registration failure leaves the directory owner intact, never lost.
            if (entry === this.imageOldest) break;
        }
        for (const entry of this.imageCleanup) {
            if (entry.resource!.cleaned) continue;
            try { this.destroyReadyImage(entry); }
            catch (cause) { this.fail('WEBGPU_RENDER_FAILED', cause, 'cleanup', null, true); }
        }
    }

    private ownedDepth(width: number, height: number, record: Submission, gate: () => void): GPUTextureView {
        gate();
        const texture = this.texture!({ size: { width, height, depthOrArrayLayers: 1 }, dimension: '2d', format: 'depth32float', mipLevelCount: 1, sampleCount: 1, usage: 16 });
        // Ownership precedes every gate and getter, including a getter that
        // calls close. A failed cleanup capture is never retried by retirement.
        const resource: OwnedWebGPUTexture = { texture, destroy: () => { throw new TypeError('uncaptured depth destroy'); }, cleaned: false };
        record.textures.push(resource);
        let destroy: () => void;
        try { destroy = this.method(texture, 'destroy', () => undefined); }
        catch (cause) { record.unsafe = true; this.proofFailed(cause); throw cause; }
        Object.assign(resource, { destroy }); gate();
        const createView = this.method(texture, 'createView', gate);
        const view = createView(); record.views.push(view); gate(); return view;
    }
    private admitScene(value: unknown): SceneAdmission {
        const functions = B1_FUNCTIONS.get(this);
        // Only the actual CPU module's identity predicate grants access to
        // immutable fields. Foreign objects/proxies receive no property reads.
        if (!functions || !functions.isSceneFrame3D(value)) throw new ClassifiedWebGPUFailure('WEBGPU_FRAME_INVALID');
        const scene = value, count = scene.draws.length, distinct = scene.geometries.length;
        if (count > B1_LIMITS.draws || distinct > B1_LIMITS.geometries) throw new ClassifiedWebGPUFailure('WEBGPU_FRAME_BUDGET');
        let cpuBytes = 0, sceneBytes = 0;
        const uniformBytes = 64 * count;
        for (const geometry of scene.geometries) {
            const vertexBytes = 24 * geometry.vertexCount, indexBytes = 4 * geometry.indexCount;
            cpuBytes += 8 * (6 * geometry.vertexCount + geometry.indexCount);
            sceneBytes += vertexBytes + indexBytes;
            if (vertexBytes > this.limits.maxBufferSize || indexBytes > this.limits.maxBufferSize) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT');
        }
        if (![cpuBytes, sceneBytes, uniformBytes].every(Number.isSafeInteger) || cpuBytes > B1_LIMITS.cpu || sceneBytes > B1_LIMITS.scene || uniformBytes > B1_LIMITS.uniform) throw new ClassifiedWebGPUFailure('WEBGPU_FRAME_BUDGET');
        if (cpuBytes !== scene.cpuLogicalBytes || sceneBytes !== scene.sceneBytes || uniformBytes !== scene.uniformBytes) throw new ClassifiedWebGPUFailure('WEBGPU_FRAME_INVALID');
        if (count > 0 && 64 > this.limits.maxBufferSize) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT');
        return { scene, functions, sceneBytes, uniformBytes, depthBytes: 0, meshes: [], draws: [] };
    }
    private packScene(plan: SceneAdmission, trustedFailures?: WeakSet<object>): void {
        const packed = new Map<SceneValue['geometries'][number], PackedMesh>();
        for (const geometry of plan.scene.geometries) {
            let mesh: PackedMesh;
            try { mesh = plan.functions.packMeshGeometry3D(geometry); }
            catch (cause) {
                // Origin is queried only at this trusted invocation boundary;
                // a foreign class/code is never authority for helper mapping.
                const origin = plan.functions.getMeshPacking3DErrorOrigin(cause);
                const code = origin === 'budget' ? 'WEBGPU_FRAME_BUDGET' : origin === 'validation' && (cause as { code: string }).code === 'MESH3D_PACK_F32_UNSUPPORTED' ? 'WEBGPU_PRECISION_UNSUPPORTED' : 'WEBGPU_FRAME_INVALID';
                const failure = new ClassifiedWebGPUFailure(code, cause);
                trustedFailures?.add(failure); throw failure;
            }
            this.active(); packed.set(geometry, mesh); plan.meshes.push(mesh);
        }
        for (const draw of plan.scene.draws) {
            const mesh = packed.get(draw.geometry);
            if (!mesh) {
                const failure = new ClassifiedWebGPUFailure('WEBGPU_FRAME_INVALID');
                trustedFailures?.add(failure); throw failure;
            }
            // CPU MVP is an immutable 16-number tuple. Upload its column-major
            // float32 ABI directly: no elements property, transpose or Y flip.
            const uniform = new Float32Array(draw.mvp);
            this.active(); plan.draws.push({ mesh, uniform });
        }
    }
    private preflight(input: RenderFrame2D, sceneInput?: unknown) {
        try {
            const scene = arguments.length === 2 ? this.admitScene(sceneInput) : undefined;
            const copied = copyMixedFrame2D(input, this.options); this.active();
            if (scene) {
                if (copied.frame.clearAlpha !== 1) throw new ClassifiedWebGPUFailure('WEBGPU_FRAME_INVALID');
                scene.depthBytes = 4 * copied.width * copied.height;
                if (!Number.isSafeInteger(scene.depthBytes) || scene.depthBytes > B1_LIMITS.depth) throw new ClassifiedWebGPUFailure('WEBGPU_FRAME_BUDGET');
            }
            // Reserve every scene byte, including each empty draw's uniform,
            // before existing UI packing consumes its remaining upload budget.
            const reserved = scene ? scene.sceneBytes + scene.uniformBytes : 0;
            if (reserved > this.options.maxUploadBytes) throw new ClassifiedWebGPUFailure('WEBGPU_FRAME_BUDGET');
            const prepared = prepareMixedDraws2D(copied.frame, copied.width, copied.height, this.options);
            let projectionPlan: ProjectionPlan2D;
            let projectionFailure: ImageProjectionError | undefined;
            try {
                projectionPlan = planImageProjections(copied.frame, 'premultiplied', failure => { projectionFailure = failure; });
            } catch (cause) {
                // Fence owned planner faults before the broader helper-class mappings.
                // An old admission object or undefined is not authority for this call.
                if (projectionFailure !== undefined && projectionFailure === cause) throw new ClassifiedWebGPUFailure(projectionFailure.reason === 'budget' ? 'WEBGPU_FRAME_BUDGET' : 'WEBGPU_FRAME_INVALID', cause);
                throw new ClassifiedWebGPUFailure('WEBGPU_FRAME_INVALID', cause);
            }
            if (copied.width > this.limits.maxTextureDimension2D || copied.height > this.limits.maxTextureDimension2D) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT');
            for (const view of projectionPlan.views) {
                if (view.region.width > this.limits.maxTextureDimension2D || view.region.height > this.limits.maxTextureDimension2D) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT');
            }
            const draws: PackedDraw[] = [];
            let upload = reserved;
            for (const draw of prepared) {
                const remainingUpload = this.options.maxUploadBytes - upload;
                if (draw.kind === 'rect') {
                    // Preserve rectangle caller-budget-before-device precedence without a concat copy.
                    const packed = packWebGPUVertices(draw.prepared, copied.width, copied.height, { maxUploadBytes: remainingUpload, maxBufferSize: this.limits.maxBufferSize });
                    upload += packed.data.byteLength; draws.push({ kind: 'rect', packed });
                } else {
                    let packed: ReturnType<typeof packImageVertices2D>;
                    try { packed = packImageVertices2D(draw.prepared, copied.width, copied.height, Math.min(remainingUpload, this.limits.maxBufferSize)); }
                    catch (cause) {
                        if (cause instanceof ImagePackingAllocationError) throw new ClassifiedWebGPUFailure('WEBGPU_FRAME_INVALID', cause.original);
                        // This conversion is confined to the trusted packer, never a GPU/caller throw.
                        if (cause instanceof GeometryPreparationError && cause.reason === 'budget' && this.limits.maxBufferSize < remainingUpload) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT', cause.cause);
                        throw cause;
                    }
                    upload += packed.data.byteLength;
                    if (packed.vertexCount > 0) {
                        if (16 > this.options.maxUploadBytes - upload) throw new ClassifiedWebGPUFailure('WEBGPU_FRAME_BUDGET');
                        if (16 > this.limits.maxBufferSize) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT');
                        upload += 16;
                    }
                    const command = copied.frame.commands[draw.commandIndex]!;
                    draws.push({ kind: 'image', packed, viewIndex: projectionPlan.commandViews[draw.commandIndex]!, alpha: command.alpha, uniform: undefined });
                }
            }
            let rowPitch = 0, staging = 0, output = 0;
            const ticket = this.ticket && !this.ticket.bound ? this.ticket : undefined;
            if (ticket) {
                rowPitch = Math.ceil(copied.width * 4 / 256) * 256; staging = rowPitch * copied.height; output = copied.width * copied.height * 4;
                if (![rowPitch, staging, output, staging + output].every(Number.isSafeInteger) || staging + output > this.options.maxReadbackBytes) throw new ClassifiedWebGPUFailure('WEBGPU_FRAME_BUDGET');
                if (staging > this.limits.maxBufferSize) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT');
            }
            const capacity = (): void => {
                if (this.ledger.size >= this.options.maxPendingFrames || upload > this.options.maxPendingUploadBytes - this.pendingUploadBytes || staging + output > this.options.maxReadbackBytes - this.pendingReadbackBytes || projectionPlan.projectionBytes > IMAGE_LIMITS_2D.maxPendingTextureBytes - this.pendingTextureBytes) throw new ClassifiedWebGPUFailure('WEBGPU_BACKPRESSURE');
                if (scene && (scene.sceneBytes > B1_LIMITS.pendingScene - this.pendingSceneBytes || scene.uniformBytes > B1_LIMITS.pendingUniform - this.pendingUniformBytes || scene.depthBytes > B1_LIMITS.pendingDepth - this.pendingDepthBytes)) throw new ClassifiedWebGPUFailure('WEBGPU_BACKPRESSURE');
            };
            capacity();
            if (this.lastSerial === Number.MAX_SAFE_INTEGER) throw new ClassifiedWebGPUFailure('WEBGPU_SERIAL_EXHAUSTED');
            // Retain all crops P, copying sequentially with only one full-source clone M live.
            // Coverage does not refund admission, even when no GPU texture needs realization.
            let projections: Uint8Array<ArrayBuffer>[];
            try {
                projections = projectionPlan.views.map(view => copyProjectionPixels(view, 'premultiplied'));
                for (const draw of draws) if (draw.kind === 'image' && draw.packed.vertexCount > 0) draw.uniform = new Float32Array([draw.alpha, 0, 0, 0]);
            } catch (cause) { throw new ClassifiedWebGPUFailure('WEBGPU_FRAME_INVALID', cause); }
            // Only whole admitted frames reach the trusted scene allocations.
            // Reentrant stop/close is observed again before any ledger mutation.
            if (scene) this.packScene(scene);
            this.active(); capacity();
            return { ...copied, draws, upload, geometryBytes: 0, projectionPlan, projections, rowPitch, staging, output, ticket, scene };
        } catch (cause) {
            if (this.state !== 'active') throw this.stateError();
            if (cause instanceof ClassifiedWebGPUFailure) throw cause.publicError;
            if (cause instanceof FrameInputReadError) throw error('WEBGPU_FRAME_INVALID', cause.cause);
            if (cause instanceof FrameCopyError) throw error(cause.reason === 'backing' ? 'WEBGPU_BACKING_LIMIT' : cause.reason === 'budget' ? 'WEBGPU_FRAME_BUDGET' : 'WEBGPU_FRAME_INVALID', cause.cause);
            if (cause instanceof ImageProjectionError) throw error(cause.reason === 'budget' ? 'WEBGPU_FRAME_BUDGET' : 'WEBGPU_FRAME_INVALID', cause);
            if (cause instanceof GeometryPreparationError) throw error(cause.reason === 'range' ? 'WEBGPU_GEOMETRY_RANGE' : cause.reason === 'budget' ? 'WEBGPU_FRAME_BUDGET' : 'WEBGPU_PRECISION_UNSUPPORTED', cause.cause);
            if (cause instanceof WebGPUPackingError) throw error(cause.reason === 'device' ? 'WEBGPU_DEVICE_LIMIT' : cause.reason === 'budget' ? 'WEBGPU_FRAME_BUDGET' : 'WEBGPU_PRECISION_UNSUPPORTED', cause.cause);
            throw error('WEBGPU_FRAME_INVALID', cause);
        }
    }
    private texturedOwnerSnapshot(): TexturedSubmissionOwnerSnapshot2D {
        this.active();
        return { pendingFrames: this.ledger.size, pendingUploadBytes: this.pendingUploadBytes, pendingReadbackBytes: this.pendingReadbackBytes,
            pendingTextureBytes: this.pendingTextureBytes, pendingGeometryBytes: this.pendingGeometryBytes, serial: this.lastSerial };
    }
    private texturedSceneOwnerSnapshot(): TexturedSubmissionOwnerSnapshot2D {
        return { ...this.texturedOwnerSnapshot(), pendingSceneBytes: this.pendingSceneBytes,
            pendingUniformBytes: this.pendingUniformBytes, pendingDepthBytes: this.pendingDepthBytes };
    }
    /** Mapping requires the exact failure captured by this owned invocation. */
    private ownedTexturedPreparationError(cause: object): EgretError {
        if (cause instanceof ImagePackingAllocationError || cause instanceof TexturedMeshPackingAllocationError) return error('WEBGPU_FRAME_INVALID', cause.original);
        if (cause instanceof TexturedFrameAdmissionError2D) return error(cause.reason === 'backing' ? 'WEBGPU_BACKING_LIMIT' : cause.reason === 'budget' ? 'WEBGPU_FRAME_BUDGET' : 'WEBGPU_FRAME_INVALID', cause);
        if (cause instanceof ImageProjectionError) return error(cause.reason === 'budget' ? 'WEBGPU_FRAME_BUDGET' : 'WEBGPU_FRAME_INVALID', cause);
        if (cause instanceof GeometryPreparationError) return error(cause.reason === 'range' ? 'WEBGPU_GEOMETRY_RANGE' : cause.reason === 'budget' ? 'WEBGPU_FRAME_BUDGET' : 'WEBGPU_PRECISION_UNSUPPORTED', cause.cause);
        if (cause instanceof WebGPUPackingError) return error(cause.reason === 'device' ? 'WEBGPU_DEVICE_LIMIT' : cause.reason === 'budget' ? 'WEBGPU_FRAME_BUDGET' : 'WEBGPU_PRECISION_UNSUPPORTED', cause.cause);
        if (isTexturedSubmissionAdmissionError2D(cause)) return error(cause.reason === 'device' ? 'WEBGPU_DEVICE_LIMIT' : cause.reason === 'backpressure' ? 'WEBGPU_BACKPRESSURE' : cause.reason === 'serial' ? 'WEBGPU_SERIAL_EXHAUSTED' : 'WEBGPU_FRAME_BUDGET', cause);
        return error('WEBGPU_FRAME_INVALID', cause);
    }
    private preflightTextured(frame: TexturedRenderFrame2D): SharedSubmissionPlan2D {
        let ownedFailure: object | undefined;
        try {
            return runOwnedPreparationScope(() => {
                const options = TEXTURED_OPTIONS.get(this)!;
                const budget = new TexturedPreparationBudget2D(options);
                const admitted = admitTexturedFrame2D(frame, options, budget);
                // Register every image/Mesh crop before preparation can suppress coverage.
                const projectionPlan = planTexturedImageProjections(frame);
                const draws = prepareTexturedDraws2D(admitted, options, budget);
                const ticket = this.ticket && !this.ticket.bound ? this.ticket : undefined;
                const plan = prepareTexturedSubmission2D({ admitted, draws, projectionPlan, options, hardware: this.limits,
                    owner: this.texturedOwnerSnapshot(), readback: ticket !== undefined }, budget, () => this.texturedOwnerSnapshot());
                return { ...plan, ticket };
            }, failure => { ownedFailure = failure; });
        } catch (cause) {
            // Stop/close/terminal state wins even when a concurrent owned allocation throws.
            if (this.state !== 'active') throw this.stateError();
            if (ownedFailure !== undefined && ownedFailure === cause) {
                throw this.ownedTexturedPreparationError(cause);
            }
            // Matching classes/codes, previous tokens and arbitrary native throws are foreign.
            throw error('WEBGPU_FRAME_INVALID', cause);
        }
    }
    private preflightTexturedScene(sceneInput: SceneValue, overlayInput: TexturedRenderFrame2D): SharedSubmissionPlan2D {
        let ownedFailure: object | undefined;
        // A token from another invocation, including an allocation hook's old
        // private failure, cannot authorize this combined scene classification.
        let trustedSceneFailures: WeakSet<object> | undefined;
        try {
            // This allocation may itself fail or reenter close. Keep it inside
            // the same state-first failure boundary as all later preparation.
            const sceneFailures = new WeakSet<object>();
            trustedSceneFailures = sceneFailures; this.active();
            const sceneFailure: (code: WebGPUHostErrorCode) => never = code => {
                const failure = new ClassifiedWebGPUFailure(code);
                sceneFailures.add(failure); throw failure;
            };
            return runOwnedPreparationScope(() => {
                const functions = B1_FUNCTIONS.get(this);
                // Authenticate both immutable inputs before either payload read.
                if (!functions || !functions.isSceneFrame3D(sceneInput)) sceneFailure('WEBGPU_FRAME_INVALID');
                const frame = readOwnedTexturedFrame(overlayInput);
                if (frame === undefined) sceneFailure('WEBGPU_FRAME_INVALID');
                let scene: SceneAdmission;
                try { scene = this.admitScene(sceneInput); }
                catch (cause) {
                    // Genuine metadata admission invokes no caller payload or GPU.
                    if (cause instanceof ClassifiedWebGPUFailure) sceneFailures.add(cause);
                    throw cause;
                }
                if (frame.clearAlpha !== 1) sceneFailure('WEBGPU_FRAME_INVALID');
                const options = TEXTURED_OPTIONS.get(this)!;
                const budget = new TexturedPreparationBudget2D(options);
                const admitted = admitTexturedFrame2D(frame, options, budget);
                const projectionPlan = planTexturedImageProjections(frame);
                const draws = prepareTexturedDraws2D(admitted, options, budget);
                // Reserve this exact ticket once; preparation may request a later one.
                const ticket = this.ticket && !this.ticket.bound ? this.ticket : undefined;
                const storage = planTexturedSubmissionStorage2D({ admitted, draws, projectionPlan, options, hardware: this.limits,
                    owner: this.texturedSceneOwnerSnapshot(), readback: ticket !== undefined,
                    sceneReservation: { sceneBytes: scene.sceneBytes, uniformBytes: scene.uniformBytes,
                        maxSceneBytes: B1_LIMITS.scene, maxUniformBytes: B1_LIMITS.uniform, maxDepthBytes: B1_LIMITS.depth,
                        maxPendingSceneBytes: B1_LIMITS.pendingScene, maxPendingUniformBytes: B1_LIMITS.pendingUniform, maxPendingDepthBytes: B1_LIMITS.pendingDepth } });
                scene.depthBytes = storage.sceneStorage!.depthBytes;
                // Whole admission precedes both domains' payload allocations.
                this.packScene(scene, sceneFailures); this.active();
                const plan = packTexturedSubmission2D(storage, budget, () => this.texturedSceneOwnerSnapshot(), undefined, () => this.active());
                this.active();
                return { ...plan, ticket, scene };
            }, failure => { ownedFailure = failure; });
        } catch (cause) {
            if (this.state !== 'active') throw this.stateError();
            // B1 control flow is private; 2D mapping also needs this invocation.
            if (cause instanceof ClassifiedWebGPUFailure && trustedSceneFailures?.has(cause)) throw cause.publicError;
            if (ownedFailure !== undefined && ownedFailure === cause) throw this.ownedTexturedPreparationError(cause);
            throw error('WEBGPU_FRAME_INVALID', cause);
        }
    }
    private renderSceneTexturedOwnedFrame(scene: SceneValue, overlay: TexturedRenderFrame2D): undefined {
        this.active(); if (this.busy) throw error('WEBGPU_REENTRANT');
        this.busy = true; this.cpu = deferred<void>();
        try { return this.submitPrepared(this.preflightTexturedScene(scene, overlay)); }
        finally { this.busy = false; this.cpu.resolve(); }
    }
    private renderTexturedOwnedFrame(input: TexturedRenderFrame2D): undefined {
        this.active(); if (this.busy) throw error('WEBGPU_REENTRANT');
        this.busy = true; this.cpu = deferred<void>();
        try {
            const frame = readOwnedTexturedFrame(input);
            if (frame === undefined) throw error('WEBGPU_FRAME_INVALID');
            return this.submitPrepared(this.preflightTextured(frame));
        } finally { this.busy = false; this.cpu.resolve(); }
    }
    public renderFrame(input: RenderFrame2D): undefined {
        return this.render(input);
    }
    private render(input: RenderFrame2D, sceneInput?: unknown): undefined {
        if (this.busy) throw error('WEBGPU_REENTRANT'); this.active(); this.busy = true; this.cpu = deferred<void>();
        try {
            // Preserve the legacy busy/state priority, then refuse the new owned protocol.
            if (readOwnedTexturedFrame(input) !== undefined) throw error('WEBGPU_FRAME_PROFILE_UNSUPPORTED');
            const p = arguments.length === 2 ? this.preflight(input, sceneInput) : this.preflight(input);
            return this.submitPrepared(p);
        } finally { this.busy = false; this.cpu.resolve(); }
    }
    /** One queue, scope, fence, readback and retirement owner for every supported plan. */
    private submitPrepared(p: SharedSubmissionPlan2D): undefined {
        const imagePlan = this.planImageResidency(p);
        const serial = ++this.lastSerial, done = deferred<void>();
        const record: Submission = { serial, upload: p.upload, readback: p.staging + p.output, textureBytes: p.projectionPlan.projectionBytes, geometryBytes: p.geometryBytes, sceneBytes: p.scene?.sceneBytes ?? 0, uniformBytes: p.scene?.uniformBytes ?? 0, depthBytes: p.scene?.depthBytes ?? 0, resources: [], textures: [], views: [], bindings: [], imageUse: undefined, frame: p.frame, projectionPlan: p.projectionPlan, projections: p.projections, draws: p.draws, scene: p.scene?.scene, meshes: p.scene?.meshes ?? [], sceneDraws: p.scene?.draws ?? [], outcome: done.promise, completion: done.promise, failure: undefined, unsafe: false, retired: false };
        this.ledger.add(record); this.pendingUploadBytes += record.upload; this.pendingReadbackBytes += record.readback; this.pendingTextureBytes += record.textureBytes;
        this.pendingSceneBytes += record.sceneBytes; this.pendingUniformBytes += record.uniformBytes; this.pendingDepthBytes += record.depthBytes;
        this.pendingGeometryBytes += record.geometryBytes;
        // Bind precisely the unbound ticket whose capacity this preflight reserved.
        const ticket = p.ticket;
        if (ticket) ticket.bound = true;
        const outcomes: Promise<unknown>[] = []; let touchedQueue = false, synchronous: EgretError | undefined, result: WebGPUReadback | undefined, staging: OwnedWebGPUBuffer | undefined, submitted = false;
        const gate = (): void => this.active();
        try {
            const imageUse = this.beginImageResidency(record, imagePlan);
            this.scoped(serial, 'frame', outcomes as Promise<void>[], gate, () => {
                const oldWidth = this.surface.width; gate(); const oldHeight = this.surface.height; gate();
                if (oldWidth !== p.width) { this.surface.width = p.width; gate(); }
                if (oldHeight !== p.height) { this.surface.height = p.height; gate(); }
                const width = this.surface.width; gate(); const height = this.surface.height; gate(); if (width !== p.width || height !== p.height) throw new Error('Canvas rejected dimensions');
                if (oldWidth !== p.width || oldHeight !== p.height) this.configureSurface(gate);
                const realized = new Map<number, { texture: GPUTexture; view: GPUTextureView }>();
                for (const draw of p.draws) {
                    if (draw.kind === 'rect' || draw.packed.vertexCount === 0 || realized.has(draw.viewIndex)) continue;
                    realized.set(draw.viewIndex, this.realizeImageResidency(record, imageUse, draw.viewIndex, gate));
                }
                const vertices = new Map<PackedDraw, OwnedWebGPUBuffer>();
                const bindings = new Map<PackedDraw, GPUBindGroup>();
                for (const draw of p.draws) {
                    if (draw.packed.data.byteLength === 0) continue;
                    const vertex = this.ownedBuffer(draw.packed.data.byteLength, 32 | 8, record, gate);
                    vertices.set(draw, vertex); touchedQueue = true; this.write!(vertex.buffer, 0, draw.packed.data as Float32Array<ArrayBuffer>); gate();
                    if (draw.kind !== 'rect') {
                        const uniform = this.ownedBuffer(16, 64 | 8, record, gate);
                        touchedQueue = true; this.write!(uniform.buffer, 0, draw.uniform!); gate();
                        gate(); const binding = this.bindGroup!({ layout: draw.kind === 'mesh' ? this.texturedLayout! : this.imageLayout!, entries: [{ binding: 0, resource: realized.get(draw.viewIndex)!.view }, { binding: 1, resource: this.sampler! }, { binding: 2, resource: { buffer: uniform.buffer, offset: 0, size: 16 } }] });
                        record.bindings.push(binding); bindings.set(draw, binding); gate();
                    }
                }
                let meshes: Map<PackedMesh, { vertex: OwnedWebGPUBuffer | undefined; index: OwnedWebGPUBuffer | undefined }> | undefined;
                let sceneBindings: Map<SceneUploadDraw, GPUBindGroup> | undefined;
                if (p.scene) {
                    meshes = new Map(); sceneBindings = new Map();
                    // The identity-keyed CPU plan packs and uploads each geometry
                    // once. Every draw, even an empty one, owns its 64-byte MVP.
                    // RGB remains the packer's encoded float32 payload; the
                    // opaque mesh pipeline adds no color-space conversion.
                    for (const mesh of p.scene.meshes) {
                        const vertex = mesh.vertexBytes > 0 ? this.ownedBuffer(mesh.vertexBytes, 32 | 8, record, gate) : undefined;
                        const index = mesh.indexBytes > 0 ? this.ownedBuffer(mesh.indexBytes, 16 | 8, record, gate) : undefined;
                        meshes.set(mesh, { vertex, index });
                        if (vertex) { touchedQueue = true; this.write!(vertex.buffer, 0, mesh.vertices); gate(); }
                        if (index) { touchedQueue = true; this.write!(index.buffer, 0, mesh.indices); gate(); }
                    }
                    for (const draw of p.scene.draws) {
                        const uniform = this.ownedBuffer(64, 64 | 8, record, gate);
                        touchedQueue = true; this.write!(uniform.buffer, 0, draw.uniform); gate();
                        const binding = this.bindGroup!({ layout: this.meshLayout!, entries: [{ binding: 0, resource: { buffer: uniform.buffer, offset: 0, size: 64 } }] });
                        record.bindings.push(binding); sceneBindings.set(draw, binding); gate();
                    }
                }
                const depth = p.scene ? this.ownedDepth(p.width, p.height, record, gate) : undefined;
                staging = ticket ? this.ownedBuffer(p.staging, 1 | 8, record, gate) : undefined;
                const texture = this.currentTexture!(); gate(); const view = this.method(texture, 'createView', gate)(); gate();
                const encoder = this.encoder!(); gate(); const begin = this.method(encoder, 'beginRenderPass', gate), finish = this.method(encoder, 'finish', gate), copy = ticket ? this.method(encoder, 'copyTextureToBuffer', gate) : undefined;
                const color = p.frame.clearColor, alpha = p.frame.clearAlpha;
                const attachment: GPURenderPassColorAttachment = { view, loadOp: 'clear', storeOp: 'store', clearValue: { r: ((color >>> 16) & 255) / 255 * alpha, g: ((color >>> 8) & 255) / 255 * alpha, b: (color & 255) / 255 * alpha, a: alpha } };
                if (p.scene) {
                    // One target and encoder: reverse-depth scene first, then a
                    // depth-free painter pass that loads the stored scene color.
                    const scenePass = begin({ colorAttachments: [attachment], depthStencilAttachment: { view: depth!, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' } }); gate();
                    const capturedScene = {} as GPURenderPassEncoder;
                    const sceneMethods: (keyof GPURenderPassEncoder)[] = p.scene.draws.some(draw => draw.mesh.indexCount > 0) ? ['setPipeline', 'setViewport', 'setScissorRect', 'setVertexBuffer', 'setIndexBuffer', 'setBindGroup', 'drawIndexed'] : [];
                    for (const key of sceneMethods) {
                        const method = this.method(scenePass, key, gate) as (...args: unknown[]) => unknown;
                        Object.defineProperty(capturedScene, key, { value: (...args: unknown[]) => { gate(); const value = method(...args); gate(); return value; } });
                    }
                    const endScene = this.method(scenePass, 'end', gate);
                    for (const draw of p.scene.draws) {
                        if (draw.mesh.indexCount === 0) continue;
                        const mesh = meshes!.get(draw.mesh)!;
                        p.scene.functions.encodeWebGPUMesh(capturedScene, this.meshPipeline!, mesh.vertex!.buffer, mesh.index!.buffer, sceneBindings!.get(draw)!, draw.mesh.indexCount, p.width, p.height);
                    }
                    endScene(); gate();
                }
                const pass = begin({ colorAttachments: [p.scene ? { view, loadOp: 'load', storeOp: 'store' } : attachment] }); gate();
                // Capture each pass method once; wrappers check terminal state after every call.
                const captured = {} as GPURenderPassEncoder;
                const clearOnlyRectangles = p.draws.length === 0 && p.frame.images === undefined;
                const hasImage = p.draws.some(draw => draw.kind !== 'rect' && draw.packed.vertexCount > 0);
                const hasDraw = clearOnlyRectangles || p.draws.some(draw => draw.kind === 'rect' || draw.packed.vertexCount > 0);
                const methods: (keyof GPURenderPassEncoder)[] = hasDraw ? ['setPipeline', 'setViewport', 'setScissorRect', 'setVertexBuffer', 'draw'] : [];
                if (hasImage) methods.push('setBindGroup');
                for (const key of methods) {
                    const method = this.method(pass, key, gate) as (...args: unknown[]) => unknown;
                    Object.defineProperty(captured, key, { value: (...args: unknown[]) => { gate(); const value = method(...args); gate(); return value; } });
                }
                const end = this.method(pass, 'end', gate);
                if (clearOnlyRectangles) encodeWebGPURectangles(captured, this.pipeline!, undefined, [], p.width, p.height);
                for (const draw of p.draws) {
                    if (draw.kind === 'rect') encodeWebGPURectangles(captured, this.pipeline!, vertices.get(draw)?.buffer, draw.packed.ranges, p.width, p.height);
                    else if (draw.packed.vertexCount > 0) encodeWebGPUImage(captured, draw.kind === 'mesh' ? this.texturedPipeline! : this.imagePipeline!, vertices.get(draw)!.buffer, bindings.get(draw)!, draw.packed.vertexCount, p.width, p.height);
                }
                end(); gate();
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
        if (touchedQueue || record.imageUse?.touchedQueue) {
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
        for (const resource of record.textures) {
            let candidateOwned = false;
            if (record.imageUse) for (const candidate of record.imageUse.candidates.values()) {
                if (candidate.entry.resource === resource) { candidateOwned = true; break; }
            }
            if (candidateOwned) continue;
            for (const cause of cleanupWebGPUTexture(resource)) {
                const cleanupFailure = this.fail('WEBGPU_RENDER_FAILED', cause, 'cleanup', record.serial, true);
                record.unsafe = true;
                record.failure ??= cleanupFailure;
            }
        }
        this.finishImageResidency(record, !this.finalizing);
        this.ledger.delete(record); this.pendingUploadBytes -= record.upload; this.pendingReadbackBytes -= record.readback; this.pendingTextureBytes -= record.textureBytes;
        this.pendingSceneBytes -= record.sceneBytes; this.pendingUniformBytes -= record.uniformBytes; this.pendingDepthBytes -= record.depthBytes;
        this.pendingGeometryBytes -= record.geometryBytes;
        record.resources.length = 0; record.textures.length = 0; record.views.length = 0; record.bindings.length = 0;
        record.projections.length = 0; record.draws.length = 0; record.frame = undefined; record.projectionPlan = undefined;
        record.meshes.length = 0; record.sceneDraws.length = 0; record.scene = undefined;
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
        this.invalidateImageResidency();
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
        this.closeImageResidency();
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
/** Opt-in factory; runtime identity comes exclusively from completed Engine captures. */
export function createTexturedWebGPUHost(options: TexturedWebGPUHostOptions): TexturedWebGPUHost {
    return new WebGPUHostImplementation(options, TEXTURED_MODE) as unknown as TexturedWebGPUHost;
}
export function createB1WebGPUHostInternal(options: WebGPUHostOptions): B1WebGPUHost {
    // The closed constructor branch installs the two own methods. Keep them
    // out of the ordinary class type/prototype; this assertion adds no authority.
    return new WebGPUHostImplementation(options, B1_MODE) as unknown as B1WebGPUHost;
}
export function createTexturedB1WebGPUHostInternal(options: TexturedWebGPUHostOptions): TexturedB1WebGPUHost {
    return new WebGPUHostImplementation(options, TEXTURED_SCENE_MODE) as unknown as TexturedB1WebGPUHost;
}
