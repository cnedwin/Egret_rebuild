import type { CancellationSignal } from '@egret/contracts';
import type { SharedDeviceSessionStatus, SharedHostResourceStatus } from './sharedDeviceSession.js';
import type { SharedPageCopyDiagnostics2D } from '../rendering/sharedColor2D.js';
import type { RetentionLedgerDiagnostics, NativeUnknownDiagnostics } from './sharedRetentionLedger.js';
import type { SharedFrameUploadOptions, SharedFrameUploadReady, SharedFrameSubmission, SharedFrameUpload } from './sharedFrameUpload.js';
import type { SharedRenderFrame2D, SharedRenderHostAdapter } from '@egret/contracts';
import { SHARED_FRAME_PROFILE_2D } from '@egret/contracts';
import { admitSharedWebGPUOptions } from './sharedWebGPUOptions.js';
import type { SharedWebGPUHostOptions, SharedWebGPUConfiguration } from './sharedWebGPUOptions.js';
import { prepareSharedDraws2D, SharedPreparationError } from '../rendering/prepareSharedDraws2D.js';
import { SharedPreparationRetention2D } from '../rendering/sharedPreparationRetention2D.js';
import { planSharedSubmission2D, packSharedSubmission2D, packSharedRegionWindows2D, SHARED_REGION_WINDOW_STRIDE_2D, SHARED_REGION_WINDOW_BYTES_2D, materializeSharedPages2D, checkSharedCapacity2D, SharedStorageError2D } from './prepareSharedSubmission2D.js';
import type { SharedSubmissionStorage2D, SharedOwnerSnapshot2D } from './prepareSharedSubmission2D.js';
import type { PackedSharedDraw2D } from '../rendering/packSharedDraws2D.js';
import { SHARED_BATCH_PAGES_2D } from '../rendering/packSharedDraws2D.js';
import { prepareSharedBatches2D } from '../rendering/preparedSharedBatches2D.js';
import type { PreparedSharedBatchPlan2D } from '../rendering/preparedSharedBatches2D.js';
import { decodeSharedSRGB } from '../rendering/sharedColor2D.js';
import { createSharedWebGPUPipeline, SHARED_BLENDS, SHARED_PIPELINE_KINDS } from './webgpuSharedPass.js';
import { createSharedEffectPipeline, EFFECT_PASSES } from './sharedEffectShaders.js';
import type { SharedEffectPass } from './sharedEffectShaders.js';
import type { PreparedEffect2D } from '../rendering/sharedEffects2D.js';
import { createSharedResolvePipeline } from './webgpuSharedResolvePass.js';
import { createWebGPURetentionPool } from './webgpuRetentionPool.js';
import type { RetentionHandle, RetentionLease, RetentionPlan, RetentionReturnPlan, RetentionRequest } from './webgpuRetentionPool.js';
export type { SharedWebGPUHostOptions } from './sharedWebGPUOptions.js';
import { readOwnedSharedFrame } from '#egret-textured-frame-state';
import type { ImageData2D } from '@egret/contracts';
import { EgretError } from '@egret/runtime';
import { GeometryPreparationError } from '../rendering/prepareRectangles2D.js';
import { PreparedBatchScratch2D } from '../rendering/preparedBatches2D.js';
import type { ProjectionPlan2D, ProjectionView2D } from './imageProjections2D.js';
import { observed, deferred, cleanupWebGPUBuffer, cleanupWebGPUTexture, observeWebGPUDeviceLoss, observeAuthenticatedWebGPUDeviceLoss } from './webgpuLifetime.js';
import type { OwnedWebGPUBuffer, OwnedWebGPUTexture } from './webgpuLifetime.js';
import { runOwnedPreparationScope } from '../rendering/ownedPreparationFailure2D.js';
import type { SubmissionBufferLease, SubmissionBufferRequest } from './webgpuBufferPool.js';
import { createWebGPUBindingCache } from './webgpuBindingCache.js';
import type { DrawBindingCandidate, DrawBindingKey } from './webgpuBindingCache.js';

export type WebGPUHostState = 'new' | 'starting' | 'active' | 'stopped' | 'failed' | 'closing' | 'closed';
export type WebGPUHostErrorCode =
    'WEBGPU_OPTIONS_INVALID' | 'WEBGPU_UNAVAILABLE' | 'WEBGPU_ADAPTER_UNAVAILABLE' | 'WEBGPU_DEVICE_FAILED' | 'WEBGPU_CONTEXT_UNAVAILABLE' | 'WEBGPU_FORMAT_UNSUPPORTED' |
    'WEBGPU_START_FAILED' | 'WEBGPU_START_CANCELLED' | 'WEBGPU_NOT_STARTED' | 'WEBGPU_STOPPED' | 'WEBGPU_CLOSED' | 'WEBGPU_FAILED' | 'WEBGPU_REENTRANT' |
    'WEBGPU_FRAME_PROFILE_UNSUPPORTED' | 'WEBGPU_FRAME_INVALID' | 'WEBGPU_BACKING_LIMIT' | 'WEBGPU_GEOMETRY_RANGE' | 'WEBGPU_PRECISION_UNSUPPORTED' | 'WEBGPU_FRAME_BUDGET' | 'WEBGPU_BACKPRESSURE' |
    'WEBGPU_DEVICE_LIMIT' | 'WEBGPU_SERIAL_EXHAUSTED' | 'WEBGPU_RENDER_FAILED' | 'WEBGPU_VALIDATION' | 'WEBGPU_OUT_OF_MEMORY' | 'WEBGPU_INTERNAL' |
    'WEBGPU_SCOPE_FAILED' | 'WEBGPU_QUEUE_FAILED' | 'WEBGPU_DEVICE_LOST' | 'WEBGPU_UNCAPTURED_ERROR' | 'WEBGPU_READBACK_DISABLED' | 'WEBGPU_READBACK_PENDING' |
    'WEBGPU_READBACK_FAILED' | 'WEBGPU_DIAGNOSTIC_CALLBACK_FAILED' | 'WEBGPU_CLOSE_UNSAFE' |
    'WEBGPU_UPLOAD_INVALID' | 'WEBGPU_UPLOAD_OPTIONS_INVALID' | 'WEBGPU_UPLOAD_NOT_READY' | 'WEBGPU_UPLOAD_USED' | 'WEBGPU_UPLOAD_DISPOSED' | 'WEBGPU_UPLOAD_ABORTED' | 'WEBGPU_UPLOAD_EXPIRED' | 'WEBGPU_UPLOAD_STALE' |
    'WEBGPU_RECOVERY_DISABLED' | 'WEBGPU_RECOVERY_STATE_INVALID' | 'WEBGPU_RECOVERY_DEVICE_INVALID' | 'WEBGPU_RECOVERY_TIMEOUT' | 'WEBGPU_RECOVERY_FAILED' | 'WEBGPU_RECOVERY_LIMIT' | 'WEBGPU_GENERATION_EXHAUSTED';
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
export interface SharedWebGPUReadback extends Omit<WebGPUReadback,'alphaMode'> { readonly alphaMode:'premultiplied'|'opaque'; readonly generation:number; }
export interface SharedWebGPUHostStatus { readonly host:WebGPUHostStatus; readonly pendingGeometryBytes:number; readonly pendingColorBytes:number; readonly pendingCanonicalBytes:number; readonly resources:SharedHostResourceStatus; }
export interface SharedWebGPUHost extends Pick<SharedRenderHostAdapter,'sharedFrameProfile'|'renderSharedFrame'> {
    readonly surface: HTMLCanvasElement; start(): Promise<void>; stop(): void; close(): Promise<void>; whenIdle(): Promise<void>; getStatus(): WebGPUHostStatus; setTimeout(callback: () => void, delayMs: number): () => void;
    getSessionStatus():SharedDeviceSessionStatus<WebGPUHostFailure>; whenReady():Promise<void>; recover(device?:GPUDevice):Promise<void>;
    stageSharedFrame(frame:SharedRenderFrame2D,options?:SharedFrameUploadOptions):SharedFrameUpload;
    requestReadback():Promise<SharedWebGPUReadback>; getSharedStatus():SharedWebGPUHostStatus;
}
type Ticket = ReturnType<typeof deferred<WebGPUReadback|SharedWebGPUReadback>> & { bound: boolean };
// READY metadata never retains an image, frame, projection, record or callback.
interface ImageResidencyEntry {
    format: 'rgba8unorm'|'rgba8unorm-srgb'; identity: object; epoch: object; bucket: Map<string, ImageResidencyEntry>; cropKey: string; bytes: number;
    resource: OwnedWebGPUTexture | undefined; view: GPUTextureView | undefined;
    pinCount: number; previous: ImageResidencyEntry | undefined; next: ImageResidencyEntry | undefined;
    state: 'cold' | 'ready' | 'detached';
}
interface ImageResidencyCandidate {
    image: ImageData2D; viewIndex: number; entry: ImageResidencyEntry; transferred: boolean;
}
// Rectangles have no sampled-page demand and need no synthetic vertex count.
type ImageResidencyDraw = { readonly kind:'rect' } | {
    readonly kind:'image'|'mesh'; readonly packed:{readonly vertexCount:number}; readonly viewIndex:number;
};
interface ImageResidencyPlan {
    epoch: object; revision: object; victims: ImageResidencyEntry[]; bytes: number; use: ImageResidencyUse;
}
interface ImageResidencyUse {
    epoch: object; hits: Map<number, ImageResidencyEntry>; candidates: Map<number, ImageResidencyCandidate>;
    reserved: number; pinned: boolean; finished: boolean; touchedQueue: boolean;
}
/** Preallocated ownership until a returned target is registered or destroyed. */
interface RawTargetSlot {
    readonly requestId: number;
    texture: GPUTexture | undefined;
    destroy: (() => void) | undefined;
    cleanupAttempted: boolean;
    logicalByteLength?:number;diagnosticUnknown?:boolean;
}
type NativeCapture={
    device:GPUDevice; lost:Promise<GPUDeviceLostInfo>; limits:Record<string,number>;
    add:GPUDevice['addEventListener']; remove:GPUDevice['removeEventListener'];
    write:GPUQueue['writeBuffer']; writeTexture:GPUQueue['writeTexture']; submit:GPUQueue['submit']; fence:GPUQueue['onSubmittedWorkDone'];
    push:GPUDevice['pushErrorScope']; pop:GPUDevice['popErrorScope']; buffer:GPUDevice['createBuffer']; texture:GPUDevice['createTexture'];
    encoder:GPUDevice['createCommandEncoder']; bindGroup:GPUDevice['createBindGroup']; sampler:GPUDevice['createSampler'];
    shader:GPUDevice['createShaderModule']; pipeline:GPUDevice['createRenderPipelineAsync'];
};
const DEVICE_LIMIT_KEYS=['maxTextureDimension2D','maxBufferSize','maxVertexBuffers','maxVertexAttributes','maxVertexBufferArrayStride','maxColorAttachments','maxColorAttachmentBytesPerSample','maxBindGroups','maxBindingsPerBindGroup','maxSampledTexturesPerShaderStage','maxSamplersPerShaderStage','maxUniformBuffersPerShaderStage','maxUniformBufferBindingSize','maxBindGroupsPlusVertexBuffers','maxInterStageShaderVariables'] as const;
interface GenerationOwner {
    readonly number:number; readonly device:GPUDevice; readonly pool:ReturnType<typeof createWebGPURetentionPool>;
    readonly cache:ReturnType<typeof createWebGPUBindingCache>; readonly epoch:object;
    readonly format:'rgba8unorm'|'bgra8unorm'; readonly alpha:'premultiplied'|'opaque';
    readonly fence:GPUQueue['onSubmittedWorkDone']; readonly pop:()=>Promise<GPUError|null>;
    readonly native:{write:GPUQueue['writeBuffer'];writeTexture:GPUQueue['writeTexture'];submit:GPUQueue['submit'];push:GPUDevice['pushErrorScope'];
        buffer:GPUDevice['createBuffer'];texture:GPUDevice['createTexture'];bindGroup:GPUDevice['createBindGroup'];encoder:GPUDevice['createCommandEncoder'];
        configure:GPUCanvasContext['configure'];unconfigure:GPUCanvasContext['unconfigure'];currentTexture:GPUCanvasContext['getCurrentTexture']};
    invalidated:boolean; unknown:boolean;diagnosticUnknown?:boolean;
}
/** `regions` is the region table as its buffer holds it, present when a draw of the frame has a region. */
type SharedPlan={storage:SharedSubmissionStorage2D;imagePlan:ImageResidencyPlan;projections:(Uint8Array<ArrayBuffer>|undefined)[];canonicalBytes:number;ticket:Ticket|undefined;batch:PreparedSharedBatchPlan2D;regions:Uint32Array<ArrayBuffer>|undefined};
interface SharedRecipe {
    effectTargets:{resource:OwnedWebGPUTexture;view:GPUTextureView}[];
    effects:Map<PreparedEffect2D,Map<SharedEffectPass,GPUBindGroup>>;

    vertices:Map<PackedSharedDraw2D,OwnedWebGPUBuffer>; bindings:Map<PackedSharedDraw2D,GPUBindGroup>; regionBindings:Map<PackedSharedDraw2D,GPUBindGroup>;
    color:{resource:OwnedWebGPUTexture;view:GPUTextureView}; resolveBinding:GPUBindGroup;
}
type StageWrite={kind:'buffer';buffer:GPUBuffer;data:Float32Array<ArrayBuffer>|Uint32Array<ArrayBuffer>|Uint8Array<ArrayBuffer>;unit:number;offset:number}
    |{kind:'texture';texture:GPUTexture;data:Uint8Array<ArrayBuffer>;width:number;height:number;offset:number};
interface StageSignal {
    signal:CancellationSignal; add:CancellationSignal['addEventListener']; remove:CancellationSignal['removeEventListener'];
    aborted:boolean; abortFailure:EgretError|undefined; readingReason:boolean;
}
interface StageRecord {
    readonly deadline:number;
    plan:SharedPlan|undefined; readonly frameId:number; readonly generation:number; readonly done:ReturnType<typeof deferred<void>>;
    readonly ready:ReturnType<typeof deferred<SharedFrameUploadReady>>; readonly native:ReturnType<typeof deferred<void>>;
    signal:StageSignal|undefined; phase:'admitted'|'uploading'|'proof'|'ready'|'submitted'|'revoked';
    failure:EgretError|undefined; returned:boolean; listener:(()=>void)|undefined; removeOnce:boolean;
    cancelDeadline:(()=>void)|undefined; recipe:SharedRecipe|undefined; writes:StageWrite[]; cursor:number;
    outcomes:Promise<void>[]; touched:boolean; proofStarted:boolean; proofSettled:boolean; inside:boolean;
}
interface Submission {
    owner?:GenerationOwner; stage?:StageRecord;
    batchPlan: PreparedSharedBatchPlan2D;
    shared?: { frame:SharedRenderFrame2D; draws:PackedSharedDraw2D[]; colorBytes:number; canonicalBytes:number; rawTargets:RawTargetSlot[] };
    serial: number; upload: number; readback: number; textureBytes: number; geometryBytes: number;
    resources: OwnedWebGPUBuffer[]; textures: OwnedWebGPUTexture[]; views: GPUTextureView[]; bindings: GPUBindGroup[];
    projectionPlan: ProjectionPlan2D | undefined; projections: (Uint8Array<ArrayBuffer> | undefined)[];
    imageUse: ImageResidencyUse | undefined;
    bufferPlan: RetentionPlan; bufferClaimed: boolean; bufferLeases: (RetentionLease | undefined)[];
    bufferReturns: RetentionReturnPlan | undefined; retiring: boolean;
    bindingCandidates: (DrawBindingCandidate & { image: ImageResidencyEntry | undefined })[];
    outcome: Promise<void>; completion: Promise<void>; failure: EgretError | undefined; unsafe: boolean; retired: boolean;
}
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
const SHARED_OPTIONS=new WeakMap<object,SharedWebGPUConfiguration>();

/** The sole lifecycle/submission authority; resource helpers only record settled ownership. */
class WebGPUHostImplementation {
    public readonly surface: HTMLCanvasElement;
    private readonly options: SharedWebGPUConfiguration;
    private borrowed: GPUDevice | undefined;
    private borrowedPolicy=false;
    private readonly callback: ((diagnostic: WebGPUHostDiagnostic) => unknown) | undefined;
    private state: WebGPUHostState | 'lost' | 'restoring' = 'new';
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
    private pendingColorBytes=0;
    private pendingCanonicalBytes=0;
    private readonly ledger = new Set<Submission>();
    private readonly batchScratch = new PreparedBatchScratch2D();
    /** The prepared draws of the last frame. A Host that is not active keeps none. */
    private readonly retention = new SharedPreparationRetention2D();
    // Fixed-size observations only; original records/native owners still authorize every transition.
    private readonly resourceCpu:SharedPageCopyDiagnostics2D={canonicalBytes:0,scratchBytes:0,highCanonicalBytes:0,highScratchBytes:0,highTemporaryBytes:0,saturated:false};
    private readonly resourceUnknown:NativeUnknownDiagnostics={knownLogicalBytes:0,objects:0,highKnownLogicalBytes:0,highObjects:0,saturated:false};
    private readonly resourceReuse:RetentionLedgerDiagnostics={current:{idleBytes:0,idleEntries:0,leasedBytes:0,leasedEntries:0,reservedBytes:0,reservedEntries:0,detachedBytes:0,detachedEntries:0,unknownBytes:0,unknownEntries:0},highWater:{idleBytes:0,idleEntries:0,leasedBytes:0,leasedEntries:0,reservedBytes:0,reservedEntries:0,detachedBytes:0,detachedEntries:0,unknownBytes:0,unknownEntries:0},saturated:false};
    private readonly resourceHighPending={frames:0,uploadCreditBytes:0,pageCreditBytes:0,readbackCreditBytes:0,geometryCreditBytes:0,colorCreditBytes:0};
    private readonly resourceHighImages={readyBytes:0,readyEntries:0,pinnedReadyBytes:0,pinnedReadyEntries:0,allocatedLogicalBytes:0,reservedCreditBytes:0};
    private readonly resourceTotals={pageWriteCalls:0,pageWriteBytes:0,readyCapacityEvictions:0};
    private resourceSaturated=false;
    private resourceReadyBytes=0;
    private resourcePinnedBytes=0;
    private resourcePinnedEntries=0;
    private imageEpoch = {};
    private bufferPool = createWebGPURetentionPool(this.imageEpoch,this.resourceReuse);
    private bindingCache = createWebGPUBindingCache(this.imageEpoch);
    // Detached allocations retain an explicit owner even when an earlier native
    // destroy throws. Unknown destruction is charged permanently and never retried.
    private readonly bufferCleanup = new Set<RetentionHandle>();
    private closingBuffers: readonly RetentionHandle[] = [];
    private imageEnabled = false;
    private imageRevision = {};
    private imageDirectory = new WeakMap<ImageData2D, Map<string, ImageResidencyEntry>>();
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
    private readonly sharedPipelines=new Map<string,{pipeline:GPURenderPipeline;layout:GPUBindGroupLayout;regions:GPUBindGroupLayout|undefined}>();
    private readonly sharedSamplers=new Map<string,GPUSampler>();
    private effectPipelines=new Map<SharedEffectPass,{pipeline:GPURenderPipeline;layout:GPUBindGroupLayout}>();
    private resolvePipeline:GPURenderPipeline|undefined;
    private resolveLayout:GPUBindGroupLayout|undefined;
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
    private lossCell: { notify?: (cause: unknown) => void; unknown?:(cause:unknown)=>void } = {};
    private generation=0;
    private attempt=0;
    private episodeAttempts=0;
    private generationFailure:WebGPUHostFailure|null=null;
    private owner:GenerationOwner|undefined;
    private readonly usedDevices=new WeakSet<object>();
    private readiness:ReturnType<typeof deferred<void>>|undefined;
    private readinessPending=false;
    private recoveryAttempt:{barrier:ReturnType<typeof deferred<void>>; actual:Promise<void>; deadline:number; failure:EgretError|undefined; cancelled:boolean; cancelTimer:(()=>void)|undefined}|undefined;
    private stagePumpScheduled=false;
    private cancelStagePump:(()=>void)|undefined;
    private monotonicNow:(()=>number)|undefined;
    private now():number {this.monotonicNow??=globalThis.performance.now.bind(globalThis.performance);return this.monotonicNow();}
    private timers: { set: typeof globalThis.setTimeout; clear: typeof globalThis.clearTimeout } | undefined;

    public constructor(input: SharedWebGPUHostOptions) {
            try{const admitted=admitSharedWebGPUOptions(input);
                this.surface=admitted.surface;Object.defineProperty(this,'surface',{writable:false,configurable:false});
                this.options=admitted.configuration;this.borrowed=admitted.borrowed;this.callback=admitted.callback;SHARED_OPTIONS.set(this,admitted.configuration);
            }catch(cause){throw error('WEBGPU_OPTIONS_INVALID',cause);}
        this.borrowedPolicy=this.borrowed!==undefined;
            Object.defineProperties(this,{sharedFrameProfile:{value:SHARED_FRAME_PROFILE_2D,enumerable:true},
                renderSharedFrame:{value:(frame:SharedRenderFrame2D):undefined=>this.renderSharedOwnedFrame(frame) as undefined,enumerable:true},
                getSessionStatus:{value:()=>Object.freeze({state:this.state==='active'?'ready':this.state,generation:this.generation,attempt:this.attempt,firstFailure:this.firstFailure,generationFailure:this.generationFailure}),enumerable:true},
                whenReady:{value:()=>this.sharedWhenReady(),enumerable:true}, recover:{value:(device?:GPUDevice)=>this.recoverShared(device),enumerable:true},
                stageSharedFrame:{value:(frame:SharedRenderFrame2D,options?:SharedFrameUploadOptions)=>this.renderSharedOwnedFrame(frame,{options}),enumerable:true},
                getSharedStatus:{value:():SharedWebGPUHostStatus=>Object.freeze({host:this.getStatus(),pendingGeometryBytes:this.pendingGeometryBytes,pendingColorBytes:this.pendingColorBytes,pendingCanonicalBytes:this.pendingCanonicalBytes,resources:this.resourceStatus()}),enumerable:true}});
    }
    public getStatus(): WebGPUHostStatus { return Object.freeze({ state: this.state==='lost'?'failed':this.state==='restoring'?'starting':this.state, lastSerial: this.lastSerial, pendingFrames: this.ledger.size, pendingUploadBytes: this.pendingUploadBytes, pendingReadbackBytes: this.pendingReadbackBytes, firstFailure: this.firstFailure, callbackFailureCount: this.callbackFailureCount, lastCallbackFailure: this.lastCallbackFailure, cleanupOutcome: this.cleanupOutcome }); }
    private sampleResourcePending():void {
        this.resourceHighPending.frames=Math.max(this.resourceHighPending.frames,this.ledger.size);
        this.resourceHighPending.uploadCreditBytes=Math.max(this.resourceHighPending.uploadCreditBytes,this.pendingUploadBytes);
        this.resourceHighPending.pageCreditBytes=Math.max(this.resourceHighPending.pageCreditBytes,this.pendingTextureBytes);
        this.resourceHighPending.readbackCreditBytes=Math.max(this.resourceHighPending.readbackCreditBytes,this.pendingReadbackBytes);
        this.resourceHighPending.geometryCreditBytes=Math.max(this.resourceHighPending.geometryCreditBytes,this.pendingGeometryBytes);
        this.resourceHighPending.colorCreditBytes=Math.max(this.resourceHighPending.colorCreditBytes,this.pendingColorBytes);
    }
    private sampleResourceImages():void {
        this.resourceHighImages.readyBytes=Math.max(this.resourceHighImages.readyBytes,this.resourceReadyBytes);
        this.resourceHighImages.readyEntries=Math.max(this.resourceHighImages.readyEntries,this.readyCount);
        this.resourceHighImages.pinnedReadyBytes=Math.max(this.resourceHighImages.pinnedReadyBytes,this.resourcePinnedBytes);
        this.resourceHighImages.pinnedReadyEntries=Math.max(this.resourceHighImages.pinnedReadyEntries,this.resourcePinnedEntries);
        this.resourceHighImages.allocatedLogicalBytes=Math.max(this.resourceHighImages.allocatedLogicalBytes,this.allocatedImageBytes);
        this.resourceHighImages.reservedCreditBytes=Math.max(this.resourceHighImages.reservedCreditBytes,this.reservedImageBytes);
    }
    private resourceTotal(key:keyof typeof this.resourceTotals,amount:number):void {
        const old=this.resourceTotals[key];
        if(amount>Number.MAX_SAFE_INTEGER-old){this.resourceTotals[key]=Number.MAX_SAFE_INTEGER;this.resourceSaturated=true;}
        else this.resourceTotals[key]=old+amount;
    }
    private resourcePageWrite(bytes:number):void {this.resourceTotal('pageWriteCalls',1);this.resourceTotal('pageWriteBytes',bytes);}
    /** Read-only logical observations; no native call, callback or state transition. */
    private resourceStatus():SharedHostResourceStatus {
        return Object.freeze({
            current:Object.freeze({
                pending:Object.freeze({frames:this.ledger.size,uploadCreditBytes:this.pendingUploadBytes,pageCreditBytes:this.pendingTextureBytes,readbackCreditBytes:this.pendingReadbackBytes,geometryCreditBytes:this.pendingGeometryBytes,colorCreditBytes:this.pendingColorBytes}),
                cpu:Object.freeze({canonicalBytes:this.resourceCpu.canonicalBytes,scratchBytes:this.resourceCpu.scratchBytes,temporaryBytes:this.resourceCpu.canonicalBytes+this.resourceCpu.scratchBytes}),
                images:Object.freeze({readyBytes:this.resourceReadyBytes,readyEntries:this.readyCount,pinnedReadyBytes:this.resourcePinnedBytes,pinnedReadyEntries:this.resourcePinnedEntries,allocatedLogicalBytes:this.allocatedImageBytes,reservedCreditBytes:this.reservedImageBytes}),
                reusable:Object.freeze({...this.resourceReuse.current}),
                unknownNative:Object.freeze({knownLogicalBytes:this.resourceUnknown.knownLogicalBytes,objects:this.resourceUnknown.objects}),
            }),
            highWater:Object.freeze({
                pending:Object.freeze({...this.resourceHighPending}),
                cpu:Object.freeze({canonicalBytes:this.resourceCpu.highCanonicalBytes,scratchBytes:this.resourceCpu.highScratchBytes,temporaryBytes:this.resourceCpu.highTemporaryBytes}),
                images:Object.freeze({...this.resourceHighImages}),
                reusable:Object.freeze({...this.resourceReuse.highWater}),
                unknownNative:Object.freeze({knownLogicalBytes:this.resourceUnknown.highKnownLogicalBytes,objects:this.resourceUnknown.highObjects}),
            }),
            totals:Object.freeze({...this.resourceTotals}),
            saturated:this.resourceSaturated||this.resourceCpu.saturated||this.resourceReuse.saturated||this.resourceUnknown.saturated,
        });
    }
    private noteUnknownResource(resource:{logicalByteLength?:number;diagnosticUnknown?:boolean;cleaned?:boolean;settlement?:unknown}):void {
        if(resource.diagnosticUnknown||resource.settlement==='destroyed'||resource.settlement==='context-invalidated')return;
        resource.diagnosticUnknown=true;
        const bytes=resource.logicalByteLength??0,state=this.resourceUnknown;
        if(bytes>Number.MAX_SAFE_INTEGER-state.knownLogicalBytes||state.objects===Number.MAX_SAFE_INTEGER)state.saturated=true;
        state.knownLogicalBytes=Math.min(Number.MAX_SAFE_INTEGER,state.knownLogicalBytes+bytes);
        state.objects=Math.min(Number.MAX_SAFE_INTEGER,state.objects+1);
        state.highKnownLogicalBytes=Math.max(state.highKnownLogicalBytes,state.knownLogicalBytes);state.highObjects=Math.max(state.highObjects,state.objects);
    }
    private noteUnknownRecord(record:Submission):void {
        for(const resource of record.resources)this.noteUnknownResource(resource);
        for(const resource of record.textures)this.noteUnknownResource(resource);
        for(const lease of record.bufferLeases)if(lease)this.noteUnknownResource(lease.handle.resource);
        if(record.imageUse)for(const entry of record.imageUse.hits.values())if(entry.resource)this.noteUnknownResource(entry.resource);
        if(record.shared)for(const raw of record.shared.rawTargets)if(raw.texture!==undefined)this.noteUnknownResource(raw);
    }
    private active(): void {
        if (this.state !== 'active') { this.retention.clear(); throw this.stateError(); }
    }
    private stateError(): EgretError { return error(this.state === 'stopped' ? 'WEBGPU_STOPPED' : this.state === 'closing' || this.state === 'closed' ? 'WEBGPU_CLOSED' : this.state === 'failed' ? 'WEBGPU_FAILED' : this.state==='lost'||this.state==='restoring'?'WEBGPU_DEVICE_LOST':'WEBGPU_NOT_STARTED', (SHARED_OPTIONS.get(this)?.recovery?this.generationFailure:this.firstFailure)?.cause); }
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
    private proofFailed(cause: unknown): void { if(this.owner){this.owner.unknown=true;this.noteUnknownResource(this.owner);} for(const record of this.ledger)this.noteUnknownRecord(record); this.invalidateImageResidency(); if (!this.unsafe) { this.unsafe = true; this.unsafeCause = cause; } }
    private fail(code: WebGPUHostErrorCode, cause: unknown, phase: WebGPUHostFailure['phase'], serial: number | null, unsafe = false): EgretError {
        this.invalidateImageResidency();
        const attempt=this.recoveryAttempt;
        const safeRecovery=attempt&&!attempt.cancelled&&this.state==='restoring'&&!unsafe&&!this.unsafe;
        const failure = Object.freeze({ code, cause, phase:attempt?'device' as const:phase, serial });
        if(safeRecovery)attempt.failure??=error(code,cause);
        if (unsafe) { if(this.owner)this.owner.unknown=true; this.proofFailed(cause); }
        if (this.firstFailure === null) this.firstFailure = failure;
        this.generationFailure=failure;
        if (this.state !== 'closing' && this.state !== 'closed' && this.state !== 'stopped' && !safeRecovery) this.state = 'failed';
        this.cancelTicket(error(code, cause));
        this.diagnose(failure);
        this.revokeStages(error(code,cause));
        return error(code, cause);
    }
    private diagnose(failure:WebGPUHostFailure):void {
        const serial=failure.serial;
        const callback = this.callback;
        if (callback && this.state !== 'closed' && !this.finalizing) {
            queueMicrotask(() => {
                if (this.state === 'closed') return;
                const callbackFailure = (fault: unknown): void => { this.callbackFailureCount = Math.min(Number.MAX_SAFE_INTEGER, this.callbackFailureCount + 1); this.lastCallbackFailure = Object.freeze({ code: 'WEBGPU_DIAGNOSTIC_CALLBACK_FAILED', cause: fault, phase: 'callback', serial }); };
                try { observed(callback.call(undefined, Object.freeze({ ...failure, severity: 'error' as const }))).catch(callbackFailure); }
                catch (fault) { callbackFailure(fault); }
            });
        }
    }
    private cancelTicket(cause: unknown): void { if (this.ticket && !this.ticket.bound) { this.ticket.reject(cause); this.ticket = undefined; } }
    public stop():void {
        if(this.state==='new'||this.state==='starting'||this.state==='active'||this.state==='lost'||this.state==='restoring')this.state='stopped';
        const failure=error('WEBGPU_STOPPED');
        this.revokeRecovery(failure); this.revokeStages(failure);
        this.invalidateImageResidency(); this.cancelTicket(failure);
    }
    public start(): Promise<void> {
        if(this.state==='lost'||this.state==='restoring')return observed(Promise.reject(error('WEBGPU_DEVICE_LOST',this.generationFailure?.cause)));
        if (this.state === 'starting' || this.state === 'active') return this.starting!;
        if (this.state !== 'new') return observed(Promise.reject(this.stateError()));
        const barrier = deferred<void>(); this.starting = barrier.promise; this.startingPending = true; this.state = 'starting';
        if(SHARED_OPTIONS.has(this)){this.readiness=barrier;this.readinessPending=true;}
        // Cache before any getter/call can reenter start or close.
        this.initialize().then(() => { this.startingPending = false; if(this.readiness===barrier)this.readinessPending=false; barrier.resolve(); }, cause => { this.startingPending = false; if(this.readiness===barrier)this.readinessPending=false; barrier.reject(cause); }); return barrier.promise;
    }
    private method<T extends object, K extends keyof T>(object: T, key: K, gate: () => void): T[K] {
        const value = object[key]; gate();
        if (typeof value !== 'function') throw new TypeError(String(key));
        return value.bind(object) as T[K];
    }

    private sharedWhenReady():Promise<void> {
        if(this.recoveryAttempt)this.checkRecoveryDeadline(this.recoveryAttempt);
        if(this.state==='starting'||this.state==='active'||this.state==='lost'||this.state==='restoring')return this.readiness?.promise??observed(Promise.reject(this.stateError()));
        return observed(Promise.reject(this.stateError()));
    }
    /** Fixed WebIDL getters authenticate the native receiver; method capture never adopts it. */
    private captureNativeDevice(device:GPUDevice,gate:()=>void):NativeCapture {
        if(!isObject(device)||this.usedDevices.has(device))throw new TypeError('Fresh native GPUDevice required');
        const constructor=globalThis.GPUDevice;gate();
        if(typeof constructor!=='function')throw new TypeError('Native GPUDevice unavailable');
        const prototype=constructor.prototype;gate();
        const lostGetter=Object.getOwnPropertyDescriptor(prototype,'lost')?.get;
        const limitsGetter=Object.getOwnPropertyDescriptor(prototype,'limits')?.get;
        if(typeof lostGetter!=='function'||typeof limitsGetter!=='function')throw new TypeError('Native GPUDevice accessors unavailable');
        const lost=observed(lostGetter.call(device) as Promise<GPUDeviceLostInfo>);gate();
        const limitsObject=limitsGetter.call(device) as GPUSupportedLimits;gate();
        const limits:Record<string,number>={};
        for(const key of DEVICE_LIMIT_KEYS){limits[key]=limitsObject[key];gate();if(!Number.isSafeInteger(limits[key])||limits[key]!<=0)throw new TypeError('Device limit');}
        if(limits['maxVertexBuffers']!<1||limits['maxVertexAttributes']!<5||limits['maxVertexBufferArrayStride']!<52||limits['maxColorAttachments']!<1||limits['maxColorAttachmentBytesPerSample']!<4||limits['maxBindGroups']!<2||limits['maxBindingsPerBindGroup']!<2+SHARED_BATCH_PAGES_2D||limits['maxSampledTexturesPerShaderStage']!<SHARED_BATCH_PAGES_2D||limits['maxSamplersPerShaderStage']!<1||limits['maxUniformBuffersPerShaderStage']!<2||limits['maxUniformBufferBindingSize']!<SHARED_REGION_WINDOW_BYTES_2D||limits['maxBindGroupsPlusVertexBuffers']!<3||limits['maxInterStageShaderVariables']!<8)throw new TypeError('Device capabilities');
        const queue=device.queue;gate();
        const capture=<K extends keyof GPUDevice>(key:K):GPUDevice[K]=>this.method(device,key,gate);
        return {device,lost,limits,add:capture('addEventListener'),remove:capture('removeEventListener'),
            write:this.method(queue,'writeBuffer',gate),writeTexture:this.method(queue,'writeTexture',gate),submit:this.method(queue,'submit',gate),fence:this.method(queue,'onSubmittedWorkDone',gate),
            push:capture('pushErrorScope'),pop:capture('popErrorScope'),buffer:capture('createBuffer'),texture:capture('createTexture'),encoder:capture('createCommandEncoder'),bindGroup:capture('createBindGroup'),sampler:capture('createSampler'),shader:capture('createShaderModule'),pipeline:capture('createRenderPipelineAsync')};
    }
    private nativeLoss(owner:GenerationOwner,cause:unknown):void {
        if(this.owner!==owner||owner.invalidated||this.state==='closed')return;
        owner.invalidated=true;
        if(owner.unknown||this.unsafe){this.revokeStages(error('WEBGPU_DEVICE_LOST',cause));return;}
        const wasReady=this.state==='active'&&!this.readinessPending;
        if(wasReady)this.episodeAttempts=0;
        const terminal=this.state==='stopped'||this.state==='closing';
        if(!terminal)this.state='lost';
        const failure=Object.freeze({code:'WEBGPU_DEVICE_LOST' as const,cause,phase:'device' as const,serial:null});
        this.firstFailure??=failure;this.generationFailure=failure;
        const refused=error('WEBGPU_DEVICE_LOST',cause);
        for(const record of this.ledger)if(record.owner===owner){record.failure??=refused;record.stage?.native.reject(refused);}
        if(!terminal&&!this.recoveryAttempt){this.readiness=deferred<void>();this.readinessPending=true;}
        // Confirmed generation loss invalidates CPU retention before ready stages retire.
        // Otherwise context-invalidated settlement reaches a still-active ledger.
        this.invalidateImageResidency();this.revokeStages(refused);this.cancelTicket(refused);this.diagnose(failure);
        if(!terminal&&!this.recoveryAttempt&&SHARED_OPTIONS.get(this)?.recovery?.mode==='automatic'){
            // Publication was revoked synchronously; the one automatic attempt begins in a later microtask.
            queueMicrotask(()=>{if(this.state==='lost'&&!this.recoveryAttempt&&this.episodeAttempts===0)observed(this.recoverShared());});
        }
    }
    private checkRecoveryDeadline(attempt:NonNullable<WebGPUHostImplementation['recoveryAttempt']>):void {
        if(this.recoveryAttempt!==attempt||attempt.cancelled||this.now()<attempt.deadline)return;
        attempt.cancelled=true;this.state='failed';
        const failure=error('WEBGPU_RECOVERY_TIMEOUT');
        this.generationFailure=Object.freeze({code:'WEBGPU_RECOVERY_TIMEOUT',cause:failure,phase:'device',serial:null});this.firstFailure??=this.generationFailure;
        attempt.barrier.reject(failure);this.readinessPending=false;this.revokeStages(failure);this.diagnose(this.generationFailure);
    }
    private revokeRecovery(cause:EgretError):void {
        const attempt=this.recoveryAttempt;
        if(attempt){attempt.cancelled=true;attempt.cancelTimer?.();attempt.cancelTimer=undefined;attempt.barrier.reject(cause);this.readinessPending=false;}
        else if(this.readinessPending&&this.readiness?.promise!==this.starting){this.readiness?.reject(cause);this.readinessPending=false;}
    }
    private recoverShared(device?:GPUDevice):Promise<void> {
        const recovery=SHARED_OPTIONS.get(this)?.recovery;
        try{
            if(!recovery)throw error('WEBGPU_RECOVERY_DISABLED');
            if(this.busy)throw error('WEBGPU_REENTRANT');
            if(this.state==='stopped'||this.state==='closing'||this.state==='closed'||this.state==='failed')throw this.stateError();
            if(this.recoveryAttempt){this.checkRecoveryDeadline(this.recoveryAttempt);return this.recoveryAttempt.barrier.promise;}
            if(this.state!=='lost')throw error('WEBGPU_RECOVERY_STATE_INVALID');
            if(this.episodeAttempts>=3)throw error('WEBGPU_RECOVERY_LIMIT');
            if(this.attempt===Number.MAX_SAFE_INTEGER||this.generation===Number.MAX_SAFE_INTEGER)throw error('WEBGPU_GENERATION_EXHAUSTED');
            let captured:NativeCapture|undefined;
            this.busy=true;this.cpu=deferred<void>();
            try{
                if(this.borrowedPolicy){if(device===undefined)throw new TypeError('Replacement borrowed device required');captured=this.captureNativeDevice(device,()=>{if(this.state!=='lost')throw this.stateError();});}
                else if(device!==undefined)throw new TypeError('Acquire policy does not accept a device');
            }catch(cause){if(this.state!=='lost')throw this.stateError();throw error('WEBGPU_RECOVERY_DEVICE_INVALID',cause);}
            finally{this.busy=false;this.cpu.resolve();}
            const barrier=this.readinessPending&&this.readiness?this.readiness:deferred<void>();
            this.readiness=barrier;this.readinessPending=true;this.attempt++;this.episodeAttempts++;this.state='restoring';
            const attempt={barrier,actual:Promise.resolve(),deadline:this.now()+recovery.timeoutMs,failure:undefined as EgretError|undefined,cancelled:false,cancelTimer:undefined as (()=>void)|undefined};
            this.recoveryAttempt=attempt;
            attempt.cancelTimer=this.ownedTimeout(()=>this.checkRecoveryDeadline(attempt),recovery.timeoutMs);
            const gate=():void=>{this.checkRecoveryDeadline(attempt);if(attempt.cancelled||this.state!=='restoring')throw this.stateError();};
            attempt.actual=observed((async()=>{
                try{
                    if(this.startingPending&&this.starting)await Promise.allSettled([this.starting]);
                    await Promise.allSettled([...this.ledger].map(record=>record.outcome));gate();
                    await this.releaseGeneration();gate();
                    if(this.unsafe)throw error('WEBGPU_CLOSE_UNSAFE',this.unsafeCause);
                    this.imageEpoch={};this.bufferPool=createWebGPURetentionPool(this.imageEpoch,this.resourceReuse);this.bindingCache=createWebGPUBindingCache(this.imageEpoch);
                    this.imageDirectory=new WeakMap();this.lossCell={};this.owner=undefined;this.sharedPipelines.clear();this.sharedSamplers.clear();
                    await this.initialize(captured);
                    this.checkRecoveryDeadline(attempt);
                    if(attempt.cancelled||this.state!=='active')throw this.stateError();
                    this.generationFailure=null;this.readinessPending=false;barrier.resolve();
                }catch(cause){
                    if(!this.startupCancelled()&&!attempt.cancelled){
                        await this.releaseGeneration();this.checkRecoveryDeadline(attempt);
                        if(!this.startupCancelled()&&!attempt.cancelled){
                            this.state=this.unsafe||this.episodeAttempts>=3?'failed':'lost';
                            const code=this.unsafe?'WEBGPU_CLOSE_UNSAFE':this.episodeAttempts>=3?'WEBGPU_RECOVERY_LIMIT':'WEBGPU_RECOVERY_FAILED';
                            const failure=error(code,cause);this.generationFailure=Object.freeze({code,cause,phase:'device',serial:null});this.firstFailure??=this.generationFailure;
                            barrier.reject(failure);this.readinessPending=false;
                        }
                    }
                    if(this.startupCancelled()){barrier.reject(this.stateError());this.readinessPending=false;}
                }finally{
                    attempt.cancelTimer?.();attempt.cancelTimer=undefined;
                    if(this.recoveryAttempt===attempt)this.recoveryAttempt=undefined;
                }
            })());
            return barrier.promise;
        }catch(cause){return observed(Promise.reject(cause));}
    }
    private async releaseGeneration():Promise<void> {
        for(const record of [...this.ledger])if(!record.unsafe){try{this.retire(record);}catch(cause){this.proofFailed(cause);}}
        this.closeBuffers();this.closeImageResidency();
        if(this.configured){this.configured=false;try{this.unconfigure!();}catch(cause){this.proofFailed(cause);}}
        if(this.removeListener){const remove=this.removeListener;this.removeListener=undefined;try{remove();}catch(cause){this.proofFailed(cause);}}
        await Promise.resolve();delete this.lossCell.notify;delete this.lossCell.unknown;
        if(this.destroyDevice){const destroy=this.destroyDevice;this.destroyDevice=undefined;try{destroy();}catch(cause){this.proofFailed(cause);}}
        this.clearNativeReferences();
    }
    private clearNativeReferences():void {
        this.device=undefined;this.owner=undefined;this.context=undefined;this.configure=undefined;this.unconfigure=undefined;this.currentTexture=undefined;
        this.push=undefined;this.pop=undefined;this.write=undefined;this.writeTexture=undefined;this.submit=undefined;this.fence=undefined;
        this.buffer=undefined;this.texture=undefined;this.bindGroup=undefined;this.encoder=undefined;
        this.resolvePipeline=undefined;this.resolveLayout=undefined;this.effectPipelines.clear();
        this.sharedPipelines.clear();this.sharedSamplers.clear();
    }

    private async initialize(supplied?:NativeCapture): Promise<void> {
        let stage: WebGPUHostErrorCode = 'WEBGPU_UNAVAILABLE';
        const operation=this.recoveryAttempt;
        const gate=():void=>{
            if(operation){this.checkRecoveryDeadline(operation);if(operation.failure)throw new ClassifiedWebGPUFailure(operation.failure.code as WebGPUHostErrorCode,operation.failure.cause,operation.failure);if(this.recoveryAttempt!==operation||operation.cancelled||this.state!=='restoring')throw new ClassifiedWebGPUFailure('WEBGPU_START_CANCELLED',this.generationFailure?.cause);}
            else this.startupGate();
        };
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
            if (supplied) device=supplied.device;
            else if (this.borrowed) device = this.borrowed;
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
            if (!this.borrowedPolicy) {
                try { this.destroyDevice = this.method(device, 'destroy', cleanupGate); }
                catch (cause) { this.proofFailed(cause); throw cause; }
            }
            const recovery=SHARED_OPTIONS.get(this)?.recovery;
            const native=recovery?(supplied??this.captureNativeDevice(device,gate)):undefined;
            gate();
            const lost=native?.lost??device.lost;
            const add=native?.add??this.method(device,'addEventListener',gate), remove=native?.remove??this.method(device,'removeEventListener',gate);
            const queue=native?undefined:device.queue;gate();
            this.write=native?.write??this.method(queue!,'writeBuffer',gate); this.writeTexture=native?.writeTexture??this.method(queue!,'writeTexture',gate);
            this.submit=native?.submit??this.method(queue!,'submit',gate); this.fence=native?.fence??this.method(queue!,'onSubmittedWorkDone',gate);
            this.push=native?.push??this.method(device,'pushErrorScope',gate); this.pop=native?.pop??this.method(device,'popErrorScope',gate);
            this.buffer=native?.buffer??this.method(device,'createBuffer',gate); this.encoder=native?.encoder??this.method(device,'createCommandEncoder',gate);
            this.texture=native?.texture??this.method(device,'createTexture',gate); this.bindGroup=native?.bindGroup??this.method(device,'createBindGroup',gate);
            const sampler=native?.sampler??this.method(device,'createSampler',gate),shader=native?.shader??this.method(device,'createShaderModule',gate),pipeline=native?.pipeline??this.method(device,'createRenderPipelineAsync',gate);
            const captured:Record<string,number>=native?.limits??{};
            if(!native){const limits=device.limits;gate();for(const key of DEVICE_LIMIT_KEYS){captured[key]=limits[key];gate();if(!Number.isSafeInteger(captured[key])||captured[key]!<=0)throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT');}}
            {
                if(this.generation===Number.MAX_SAFE_INTEGER)throw new ClassifiedWebGPUFailure('WEBGPU_GENERATION_EXHAUSTED');
                const owner:GenerationOwner={number:++this.generation,device,pool:this.bufferPool,cache:this.bindingCache,epoch:this.imageEpoch,format:this.format,alpha:SHARED_OPTIONS.get(this)!.outputAlpha,fence:this.fence!,pop:this.pop!,native:{write:this.write!,writeTexture:this.writeTexture!,submit:this.submit!,push:this.push!,buffer:this.buffer!,texture:this.texture!,bindGroup:this.bindGroup!,encoder:this.encoder!,configure:this.configure!,unconfigure:this.unconfigure!,currentTexture:this.currentTexture!},invalidated:false,unknown:false};
                this.owner=owner;this.usedDevices.add(device);if(recovery)this.borrowed=undefined;
                const cell=this.lossCell;
                if(recovery){cell.notify=cause=>this.nativeLoss(owner,cause);cell.unknown=cause=>{if(this.owner===owner){owner.unknown=true;const failure=this.fail('WEBGPU_DEVICE_LOST',cause,'device',null,true);this.revokeRecovery(failure);this.revokeStages(failure);}};observeAuthenticatedWebGPUDeviceLoss(lost,cell);}
                else{cell.notify=cause=>{this.fail('WEBGPU_DEVICE_LOST',cause,'device',null,true);this.revokeStages(error('WEBGPU_DEVICE_LOST',cause));};observeWebGPUDeviceLoss(lost,cell);}
            }
            gate();stage='WEBGPU_START_FAILED';
            const observedOwner=this.owner;
            const listener=(event:Event):void=>{if(observedOwner&&this.owner!==observedOwner)return;this.fail('WEBGPU_UNCAPTURED_ERROR',(event as GPUUncapturedErrorEvent).error,'device',null);};
            this.removeListener=()=>remove('uncapturederror',listener);add('uncapturederror',listener);gate();
            if (captured['maxVertexBuffers']! < 1 || captured['maxVertexAttributes']! < 5 || captured['maxVertexBufferArrayStride']! < 52 || captured['maxColorAttachments']! < 1 || captured['maxColorAttachmentBytesPerSample']! < 4 || captured['maxBindGroups']! < 2 || captured['maxBindingsPerBindGroup']! < 2 + SHARED_BATCH_PAGES_2D || captured['maxSampledTexturesPerShaderStage']! < SHARED_BATCH_PAGES_2D || captured['maxSamplersPerShaderStage']! < 1 || captured['maxUniformBuffersPerShaderStage']! < 2 || captured['maxUniformBufferBindingSize']! < SHARED_REGION_WINDOW_BYTES_2D || captured['maxBindGroupsPlusVertexBuffers']! < 3 || captured['maxInterStageShaderVariables']! < 8) throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT');
            if(SHARED_OPTIONS.get(this)?.enableEffects&&(captured['maxUniformBufferBindingSize']!<448||captured['maxSampledTexturesPerShaderStage']!<2))throw new ClassifiedWebGPUFailure('WEBGPU_DEVICE_LIMIT');
            this.limits = { maxTextureDimension2D: captured['maxTextureDimension2D']!, maxBufferSize: captured['maxBufferSize']! };
            const scopes: Promise<void>[] = [];
            const pipelines: Promise<GPURenderPipeline>[] = [];
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
                        for(const kind of SHARED_PIPELINE_KINDS)for(const blend of SHARED_BLENDS)createSharedWebGPUPipeline(capturedShader,capturedPipeline,kind,blend);
                        createSharedResolvePipeline(capturedShader,capturedPipeline,this.format,SHARED_OPTIONS.get(this)!.outputAlpha==='opaque');
                        if(SHARED_OPTIONS.get(this)!.enableEffects)for(const mode of EFFECT_PASSES)createSharedEffectPipeline(capturedShader,capturedPipeline,mode);
                        for(const filter of ['nearest','linear'] as const)for(const u of ['clamp-to-edge','repeat','mirror-repeat'] as const)for(const v of ['clamp-to-edge','repeat','mirror-repeat'] as const){
                            const value=sampler({addressModeU:u,addressModeV:v,addressModeW:'clamp-to-edge',minFilter:filter,magFilter:filter,mipmapFilter:'nearest',lodMinClamp:0,lodMaxClamp:0,maxAnisotropy:1});
                            this.sharedSamplers.set(filter+':'+u+':'+v,value);gate();}
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
            // Scope outcomes do not select pipeline roles; the pipelines' own ordered results do.
            const roles = outcomes.slice(scopes.length) as PromiseFulfilledResult<GPURenderPipeline>[];
            {
                let index=0;for(const kind of SHARED_PIPELINE_KINDS)for(const blend of SHARED_BLENDS){const value=roles[index++]!.value;const layout=this.method(value,'getBindGroupLayout',gate)(0);gate();const regions=kind!=='solid'?this.method(value,'getBindGroupLayout',gate)(1):undefined;gate();this.sharedPipelines.set(kind+':'+blend,{pipeline:value,layout,regions});}
                this.resolvePipeline=roles[index++]!.value;this.resolveLayout=this.method(this.resolvePipeline,'getBindGroupLayout',gate)(0);gate();
                if(SHARED_OPTIONS.get(this)!.enableEffects)for(const mode of EFFECT_PASSES){const pipeline=roles[index++]!.value,layout=this.method(pipeline,'getBindGroupLayout',gate)(0);gate();this.effectPipelines.set(mode,{pipeline,layout});}
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
            this.state = 'active'; this.imageEnabled = true; this.generationFailure=null;
        } catch (cause) {
            const classified = cause instanceof ClassifiedWebGPUFailure ? cause : undefined;
            const original = classified ? classified.original : cause;
            if (this.startupCancelled()) {
                throw error('WEBGPU_START_CANCELLED', original);
            }
            if(operation?.cancelled)throw this.stateError();
            if(this.state==='lost'||(!operation&&SHARED_OPTIONS.get(this)?.recovery&&this.readiness?.promise!==this.starting))throw error('WEBGPU_DEVICE_LOST',this.generationFailure?.cause);
            if (classified && this.firstFailure?.code === classified.code) {
                throw classified.publicError;
            }
            // Public EgretError instances are ordinary external causes, regardless of their code.
            throw this.fail(classified ? classified.code : stage, original, 'startup', null);
        }
    }
    private scoped(serial: number | null, phase: 'startup' | 'frame', outcomes: Promise<void>[], gate: () => void, work: () => void): void {
        const owner=this.owner,push=this.push!,pop=this.pop!;
        const scopeFailure=(code:WebGPUHostErrorCode,cause:unknown,unsafe=false):EgretError=>{
            if(owner?.invalidated&&!owner.unknown)return error('WEBGPU_DEVICE_LOST',cause);
            if(owner&&this.owner!==owner){if(unsafe)this.proofFailed(cause);return error(code,cause);}
            return this.fail(code,cause,phase,serial,unsafe);
        };
        const filters: GPUErrorFilter[] = ['out-of-memory', 'internal', 'validation']; let pushed = 0;
        try { for (const filter of filters) { gate(); push(filter); pushed++; gate(); } work(); }
        finally {
            while (pushed > 0) {
                const filter = filters[--pushed]!;
                try {
                    const result = observed(pop()).then(fault => {
                        if (fault) {
                            const code = filter === 'validation' ? 'WEBGPU_VALIDATION' : filter === 'internal' ? 'WEBGPU_INTERNAL' : 'WEBGPU_OUT_OF_MEMORY';
                            throw new ClassifiedWebGPUFailure(code, fault, scopeFailure(code,fault));
                        }
                    }, cause => {
                        throw new ClassifiedWebGPUFailure('WEBGPU_SCOPE_FAILED', cause, scopeFailure('WEBGPU_SCOPE_FAILED',cause,true));
                    });
                    outcomes.push(observed(result));
                } catch (cause) {
                    const failure = new ClassifiedWebGPUFailure('WEBGPU_SCOPE_FAILED', cause, scopeFailure('WEBGPU_SCOPE_FAILED',cause,true));
                    outcomes.push(observed(Promise.reject(failure)));
                }
            }
        }
    }
    private configureSurface(gate: () => void): void {
        gate();
        // A throwing external configure may already have changed the leased context.
        this.configured = true;
        this.configure!({ device: this.device!, format: this.format, colorSpace: 'srgb', alphaMode: SHARED_OPTIONS.get(this)?.outputAlpha ?? 'premultiplied', usage: 16 | (this.options.enableReadback ? 1 : 0) });
        gate();
    }
    private ownedBuffer(size: number, usage: number, record: Submission, gate: () => void): OwnedWebGPUBuffer {
        gate(); const buffer = (record.owner?.native.buffer??this.buffer!)({ size, usage });
        // Record ownership immediately, even if capture getters throw or close reentrantly.
        const resource: OwnedWebGPUBuffer = { buffer, destroy: () => { throw new TypeError('uncaptured destroy'); }, unmap: () => { throw new TypeError('uncaptured unmap'); }, map: () => Promise.reject(new TypeError('uncaptured map')), mappedRange: () => { throw new TypeError('uncaptured range'); }, mapped: false, cleaned: false,logicalByteLength:size };
        if(record.owner)resource.generation=record.owner;
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
        const texture = (record.owner?.native.texture??this.texture!)({ size: { width: view.region.width, height: view.region.height, depthOrArrayLayers: 1 }, dimension: '2d', format: candidate.entry.format, mipLevelCount: 1, sampleCount: 1, usage: 2 | 4 });
        // Register the returned object before any gate or cleanup/view getter can reenter close.
        const resource: OwnedWebGPUTexture = { texture, destroy: () => { throw new TypeError('uncaptured texture destroy'); }, cleaned: false,logicalByteLength:candidate.entry.bytes };
        if(record.owner)resource.generation=record.owner;
        record.textures.push(resource);
        candidate.entry.resource = resource;
        record.imageUse!.reserved -= candidate.entry.bytes;
        this.reservedImageBytes -= candidate.entry.bytes;
        this.allocatedImageBytes += candidate.entry.bytes;this.sampleResourceImages();
        let destroy: () => void;
        try { destroy = this.method(texture, 'destroy', () => undefined); }
        catch (cause) { record.unsafe = true; this.proofFailed(cause); throw cause; }
        Object.assign(resource, { destroy }); gate();
        const createView = this.method(texture, 'createView', gate);
        gate(); const result = createView(); candidate.entry.view = result; record.views.push(result); gate(); return { texture, view: result };
    }
    private planImageResidency(projectionPlan:ProjectionPlan2D,draws:readonly ImageResidencyDraw[],shared=false):ImageResidencyPlan {
        this.active();
        const hits = new Map<number, ImageResidencyEntry>(), candidates = new Map<number, ImageResidencyCandidate>();
        const buckets = new Map<ImageData2D, Map<string, ImageResidencyEntry>>();
        let bytes = 0;
        for (const draw of draws) {
            if (draw.kind === 'rect' || draw.packed.vertexCount === 0 || hits.has(draw.viewIndex) || candidates.has(draw.viewIndex)) continue;
            const view = projectionPlan.views[draw.viewIndex]!, region = view.region;
            const cropKey = (shared?'shared:egret.alpha8-capped-srgb-pma8/1:rgba8unorm-srgb:':'')+`${region.x},${region.y},${region.width},${region.height}`;
            let bucket = this.imageDirectory.get(view.image) ?? buckets.get(view.image);
            if (!bucket) { bucket = new Map(); buckets.set(view.image, bucket); }
            const entry = bucket.get(cropKey);
            if (this.imageEnabled && entry?.epoch === this.imageEpoch && entry.state === 'ready') hits.set(draw.viewIndex, entry);
            else {
                candidates.set(draw.viewIndex, { image: view.image, viewIndex: draw.viewIndex, transferred: false,
                    entry: { format:shared?'rgba8unorm-srgb':'rgba8unorm', identity: {}, epoch: this.imageEpoch, bucket, cropKey, bytes: view.byteLength, resource: undefined,
                        view: undefined, pinCount: 0, previous: undefined, next: undefined, state: 'cold' } });
                bytes += view.byteLength;
            }
        }
        const protectedHits = new Set(hits.values()), victims: ImageResidencyEntry[] = [];
        let available = this.allocatedImageBytes + this.reservedImageBytes, count = this.readyCount;
        for (let entry = this.imageOldest; entry; entry = entry.next) {
            // Every profile of this Host shares one ready residence; a shared Host may lower its bytes.
            if (available + bytes <= (SHARED_OPTIONS.get(this)?.maxReadyPageBytes ?? 33554432) && count + candidates.size <= 256) break;
            if (entry.epoch !== this.imageEpoch || entry.state !== 'ready' || entry.pinCount !== 0 || protectedHits.has(entry)) continue;
            victims.push(entry); available -= entry.bytes; count--;
        }
        return { epoch: this.imageEpoch, revision: this.imageRevision, victims, bytes,
            use: { epoch: this.imageEpoch, hits, candidates, reserved: 0, pinned: false, finished: false, touchedQueue: false } };
    }
    private assertImagePlanCurrent(plan: ImageResidencyPlan): void {
        this.active();
        if (!this.imageEnabled || plan.epoch !== this.imageEpoch || plan.revision !== this.imageRevision) throw new TypeError('stale image plan');
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
    private detachReadyImage(entry: ImageResidencyEntry): void {
        this.imageCleanup.add(entry);
        this.bindingCache.invalidateTexture(entry.identity);
        if (entry.state === 'ready') {
            entry.bucket.delete(entry.cropKey); this.unlinkImageResidency(entry);
            entry.state = 'detached'; this.readyCount--;this.resourceReadyBytes-=entry.bytes;
            if(entry.pinCount>0){this.resourcePinnedBytes-=entry.bytes;this.resourcePinnedEntries--;}this.sampleResourceImages(); this.imageRevision = {};
        }
    }
    private destroyReadyImage(entry: ImageResidencyEntry): void {
        // Registration and dependent-binding invalidation precede native cleanup.
        this.detachReadyImage(entry);
        const resource = entry.resource!;
        if (resource.cleaned) return;
        const failures = cleanupWebGPUTexture(resource);
        if (failures.length) {
            this.noteUnknownResource(resource);this.proofFailed(failures[0]);
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
        for (const entry of use.hits.values()) {if(entry.pinCount===0){this.resourcePinnedBytes+=entry.bytes;this.resourcePinnedEntries++;}entry.pinCount++;}this.sampleResourceImages();
        use.pinned = true;
        for (const entry of use.hits.values()) { this.unlinkImageResidency(entry); this.appendImageResidency(entry); }
        this.imageRevision = {};
        // This phase only transfers metadata. Buffer leases must be attached and
        // claimed before any victim's captured native destroy can reenter.
        for (const entry of plan.victims) {const capacityVictim=entry.state==='ready';this.detachReadyImage(entry);if(capacityVictim&&entry.state==='detached')this.resourceTotal('readyCapacityEvictions',1);}
        use.reserved = plan.bytes; this.reservedImageBytes += plan.bytes;this.sampleResourceImages();
        return use;
    }
    private realizeImageResidency(record: Submission, use: ImageResidencyUse, viewIndex: number, gate: () => void): { texture: GPUTexture; view: GPUTextureView } {
        gate();
        const hit = use.hits.get(viewIndex);
        if (hit) { record.views.push(hit.view!); return { texture: hit.resource!.texture, view: hit.view! }; }
        const candidate = use.candidates.get(viewIndex)!, projection = record.projectionPlan!.views[viewIndex]!;
        const owned = this.ownedTexture(projection, record, gate, candidate);
        if(record.stage){record.stage.writes.push({kind:'texture',texture:owned.texture,data:record.projections[viewIndex]!,width:projection.region.width,height:projection.region.height,offset:0});return owned;}
        // Attempted queue writes retain the original fence obligation, including throws.
        use.touchedQueue = true;
        (record.owner?.native.writeTexture??this.writeTexture!)({ texture: owned.texture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 }, aspect: 'all' }, record.projections[viewIndex]!, { offset: 0, bytesPerRow: 4 * projection.region.width, rowsPerImage: projection.region.height }, { width: projection.region.width, height: projection.region.height, depthOrArrayLayers: 1 });
        if(record.shared)this.resourcePageWrite(record.projections[viewIndex]!.byteLength);
        gate(); return owned;
    }
    private sharedWrite(record:Submission,buffer:GPUBuffer,data:Float32Array<ArrayBuffer>|Uint32Array<ArrayBuffer>|Uint8Array<ArrayBuffer>,unit:number):void {
        if(record.stage){record.stage.writes.push({kind:'buffer',buffer,data,unit,offset:0});return;}
        if(record.imageUse)record.imageUse.touchedQueue=true;
        (record.owner?.native.write??this.write!)(buffer,0,data);
    }
    private isReuseEligible(record: Submission): boolean {
        return this.state === 'active' && this.imageEnabled && (SHARED_OPTIONS.get(this)?.recovery ? !this.generationFailure : !this.firstFailure) && (!record.owner || record.owner===this.owner&&!record.owner.invalidated) && !this.unsafe && !this.finalizing
            && !record.failure && !record.unsafe;
    }
    private isImagePromotionEligible(record: Submission): boolean {
        return this.isReuseEligible(record) && record.imageUse?.epoch === this.imageEpoch;
    }
    private finishImageResidency(record: Submission, allowPromotion: boolean): void {
        const use = record.imageUse;
        if (!use || use.finished) return;
        use.finished = true;
        if (use.pinned) { use.pinned = false; for (const entry of use.hits.values()) {if(entry.state==='ready'&&entry.pinCount===1){this.resourcePinnedBytes-=entry.bytes;this.resourcePinnedEntries--;}entry.pinCount--;}this.sampleResourceImages(); }
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
                    this.appendImageResidency(entry); entry.state = 'ready'; this.readyCount++;this.resourceReadyBytes+=entry.bytes;this.sampleResourceImages();
                    candidate.transferred = true;
                    record.textures.splice(record.textures.indexOf(resource), 1);
                    this.imageRevision = revision;
                } catch (cause) {
                    // No native call occurs during publication; restore the original owner.
                    if (entry.bucket.get(entry.cropKey) === entry) entry.bucket.delete(entry.cropKey);
                    if (entry.state === 'ready') { this.unlinkImageResidency(entry); this.readyCount--;this.resourceReadyBytes-=entry.bytes; entry.state = 'cold';this.sampleResourceImages(); }
                    candidate.transferred = false; failed(cause);
                }
            }
            if (!candidate.transferred && !resource.cleaned) {
                const failures = cleanupWebGPUTexture(resource);
                if (failures.length) {this.noteUnknownResource(resource); for (const cause of failures) failed(cause); }
                else this.allocatedImageBytes -= entry.bytes;
            }
        }
        this.reservedImageBytes -= use.reserved; use.reserved = 0;
        use.hits.clear(); use.candidates.clear(); record.imageUse = undefined;
        this.imageRevision = {};
    }
    private invalidateImageResidency(): void {
        this.imageEnabled = false; this.imageRevision = {};
        this.bufferPool.invalidate(); this.bindingCache.invalidate();
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

    private submissionBuffer(record: Submission, requestId: number, gate: () => void): SubmissionBufferLease {
        gate();
        const existing = record.bufferLeases[requestId];
        if (existing) return existing as SubmissionBufferLease;
        const request = record.bufferPlan.requests[requestId]!;
        if(request.kind!=='buffer')throw new TypeError('Expected buffer lease');
        const resource = this.ownedBuffer(request.byteLength, request.usage, record, gate);
        const lease = (record.owner?.pool??this.bufferPool).registerCreated(request, resource);
        // Slots are preallocated before admission commits, in request order.
        // Transfer from the raw owner without a post-registration allocation.
        record.bufferLeases[requestId] = lease;
        record.resources.length--;
        return lease as SubmissionBufferLease;
    }
    private submissionBinding(record: Submission, key: DrawBindingKey, entries: GPUBindGroupEntry[],
        image: ImageResidencyEntry | undefined, gate: () => void): GPUBindGroup {
        gate();
        const binding = (record.owner?.cache??this.bindingCache).lookup(key) ?? (record.owner?.native.bindGroup??this.bindGroup!)({ layout: key.layout, entries });
        // The record owns the returned binding before checking a native callback's state.
        record.bindings.push(binding); record.bindingCandidates.push({ key, binding, image });
        gate(); return binding;
    }
    // The historical method name is retained, but the single cleanup path is
    // kind-aware for mixed target/buffer victims, returns and terminal close.
    private destroyPooledBuffer(handle: RetentionHandle,pool=this.bufferPool,cache=this.bindingCache): void {
        this.bufferCleanup.add(handle);
        if(handle.kind==='buffer')cache.invalidateBuffer(handle.identity);
        pool.detach(handle);
        if (handle.resource.cleaned) return;
        const failures = handle.kind==='buffer'?cleanupWebGPUBuffer(handle.resource):cleanupWebGPUTexture(handle.resource);
        if(handle.resource.settlement==='context-invalidated')pool.contextInvalidated(handle);else pool.destroyed(handle, failures.length===0);
        if (failures.length) {this.noteUnknownResource(handle.resource); this.proofFailed(failures[0]); throw failures[0]; }
        this.bufferCleanup.delete(handle);
    }
    private closeBuffers(): void {
        this.bufferPool.invalidate(); this.bindingCache.clear();
        this.closingBuffers = this.bufferPool.detachIdleForClose();
        for (const handle of this.closingBuffers) {
            try { this.destroyPooledBuffer(handle); }
            catch (cause) { this.fail('WEBGPU_RENDER_FAILED', cause, 'cleanup', null, true); }
        }
        for (const handle of this.bufferCleanup) {
            if (handle.resource.cleaned) continue;
            try { this.destroyPooledBuffer(handle); }
            catch (cause) { this.fail('WEBGPU_RENDER_FAILED', cause, 'cleanup', null, true); }
        }
        this.closingBuffers = [];
    }

    private sharedOwnerSnapshot():SharedOwnerSnapshot2D {
        this.active();return {pendingFrames:this.ledger.size,pendingUploadBytes:this.pendingUploadBytes,pendingReadbackBytes:this.pendingReadbackBytes,pendingTextureBytes:this.pendingTextureBytes,pendingGeometryBytes:this.pendingGeometryBytes,serial:this.lastSerial,pendingColorBytes:this.pendingColorBytes,pendingCanonicalBytes:this.pendingCanonicalBytes};
    }
    private renderSharedOwnedFrame(input:SharedRenderFrame2D,staging?:{options:SharedFrameUploadOptions|undefined}):undefined|SharedFrameUpload {
        this.active();if(this.busy)throw error('WEBGPU_REENTRANT');
        this.busy=true;this.cpu=deferred<void>();
        let batch:PreparedSharedBatchPlan2D|undefined,signal:StageSignal|undefined,materialized=0;
        try{
            let ownedFailure:object|undefined;
            const trusted=new WeakSet<object>();
            const refuse:(code:WebGPUHostErrorCode)=>never=code=>{const failure=new ClassifiedWebGPUFailure(code);trusted.add(failure);throw failure;};
            let admitted:SharedPlan;
            try{admitted=runOwnedPreparationScope(()=>{
                const options=SHARED_OPTIONS.get(this);if(!options)refuse('WEBGPU_FRAME_PROFILE_UNSUPPORTED');
                const frame=readOwnedSharedFrame(input);
                if(!frame)refuse('WEBGPU_FRAME_PROFILE_UNSUPPORTED');
                if(staging){try{signal=this.captureStageSignal(staging.options);}catch(cause){if(cause instanceof ClassifiedWebGPUFailure)trusted.add(cause);throw cause;}}
                if(frame.outputAlpha!==options.outputAlpha||frame.outputRepresentation!==(options.outputAlpha==='opaque'?'egret.srgb-opaque-unorm8/1':'egret.srgb-premultiplied-unorm8/1'))refuse('WEBGPU_FRAME_PROFILE_UNSUPPORTED');
                if(options.outputAlpha==='opaque'&&frame.clearAlpha!==1)refuse('WEBGPU_FRAME_INVALID');
                const width=Math.ceil(frame.width*options.pixelRatio),height=Math.ceil(frame.height*options.pixelRatio);
                if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width>4294967295||height>4294967295||width>Math.floor(options.maxBackingPixels/height))refuse('WEBGPU_BACKING_LIMIT');
                const prepared=prepareSharedDraws2D(frame,width,height,options,this.retention),ticket=this.ticket&&!this.ticket.bound?this.ticket:undefined;
                const storage=planSharedSubmission2D(prepared,options,this.limits,this.sharedOwnerSnapshot(),staging?options.enableReadback:ticket!==undefined);
                this.active();
                const packed=packSharedSubmission2D(prepared);this.active();
                const demands:ImageResidencyDraw[]=[];
                for(const entry of packed){if('barrier' in entry)continue;const viewIndex=entry.prepared.pageIndex;
                    if(viewIndex===undefined)demands.push({kind:'rect'});
                    else demands.push({kind:entry.prepared.command.kind==='mesh'?'mesh':'image',packed:{vertexCount:entry.vertexCount},viewIndex});}
                for(const group of prepared.effects.groups)if(group.maskPageIndex!==undefined)demands.push({kind:'image',packed:{vertexCount:3},viewIndex:group.maskPageIndex});
                const imagePlan=this.planImageResidency(storage.projectionPlan,demands,true);
                const pages=materializeSharedPages2D(storage,new Set(imagePlan.use.candidates.keys()),this.sharedOwnerSnapshot(),this.resourceCpu);materialized=pages.canonicalBytes;this.active();
                checkSharedCapacity2D(storage,this.sharedOwnerSnapshot(),pages.canonicalBytes);
                batch=prepareSharedBatches2D(packed,this.limits.maxBufferSize,this.batchScratch);this.active();
                const regions=batch.draws.some(draw=>draw.regionWindow>=0)?packSharedRegionWindows2D(prepared.frame):undefined;
                return {storage,imagePlan,...pages,ticket,batch,regions};
            },failure=>{ownedFailure=failure;});}
            catch(cause){
                if(this.state!=='active')throw this.stateError();
                if(cause instanceof ClassifiedWebGPUFailure&&trusted.has(cause))throw cause.publicError;
                if(cause===ownedFailure){
                    if(cause instanceof SharedPreparationError)throw error(cause.reason==='profile'?'WEBGPU_FRAME_PROFILE_UNSUPPORTED':cause.reason==='budget'?'WEBGPU_FRAME_BUDGET':cause.reason==='precision'?'WEBGPU_PRECISION_UNSUPPORTED':'WEBGPU_FRAME_INVALID',cause);
                    if(cause instanceof SharedStorageError2D)throw error(cause.reason==='device'?'WEBGPU_DEVICE_LIMIT':cause.reason==='backpressure'?'WEBGPU_BACKPRESSURE':cause.reason==='serial'?'WEBGPU_SERIAL_EXHAUSTED':'WEBGPU_FRAME_BUDGET',cause);
                    if(cause instanceof GeometryPreparationError)throw error(cause.reason==='range'?'WEBGPU_GEOMETRY_RANGE':cause.reason==='budget'?'WEBGPU_FRAME_BUDGET':'WEBGPU_PRECISION_UNSUPPORTED',cause.cause);
                }
                throw error('WEBGPU_FRAME_INVALID',cause);
            }
            return this.submitShared(admitted,staging?{signal}:undefined);
        }finally{if(!batch?.transferred)this.resourceCpu.canonicalBytes-=materialized;if(batch&&!batch.transferred)this.batchScratch.release(batch);this.busy=false;this.cpu.resolve();}
    }

    private captureStageSignal(options:SharedFrameUploadOptions|undefined):StageSignal|undefined {
        const gate=():void=>this.active();
        try{
            if(options!==undefined&&!isObject(options))throw new TypeError('Upload options');
            const signal=options?.signal;gate();
            if(signal===undefined)return undefined;
            if(!isObject(signal))throw new TypeError('Upload signal');
            const add=this.method(signal,'addEventListener',gate),remove=this.method(signal,'removeEventListener',gate);
            const aborted=signal.aborted;gate();if(typeof aborted!=='boolean')throw new TypeError('Signal aborted');
            const captured:StageSignal={signal,add,remove,aborted:false,abortFailure:undefined,readingReason:false};
            if(aborted){const failure=this.stageAbortReason(captured);throw new ClassifiedWebGPUFailure(failure.code as WebGPUHostErrorCode,failure.cause,failure);}
            return captured;
        }catch(cause){
            if(this.state!=='active')throw this.stateError();
            if(cause instanceof ClassifiedWebGPUFailure)throw cause;
            throw new ClassifiedWebGPUFailure('WEBGPU_UPLOAD_OPTIONS_INVALID',cause);
        }
    }
    private stageAbortReason(signal:StageSignal):EgretError {
        if(signal.abortFailure)return signal.abortFailure;
        signal.aborted=true;signal.readingReason=true;
        let failure:EgretError;
        try{const reason=signal.signal.reason;failure=error('WEBGPU_UPLOAD_ABORTED',reason);}
        catch(cause){failure=error('WEBGPU_UPLOAD_OPTIONS_INVALID',cause);}
        signal.readingReason=false;
        if(this.state!=='active')failure=this.stateError();
        signal.abortFailure=failure;return failure;
    }
    private stageGate(record:Submission):void {
        this.active();
        if(record.owner!==this.owner||record.owner?.invalidated)throw error('WEBGPU_UPLOAD_STALE');
        if(record.stage&&!record.stage.failure&&record.stage.phase!=='submitted'&&this.now()>=record.stage.deadline)this.revokeStage(record,error('WEBGPU_UPLOAD_EXPIRED'));
        this.active();
        if(record.stage?.failure)throw record.stage.failure;
        if(record.stage?.phase==='revoked')throw error('WEBGPU_UPLOAD_ABORTED');
    }
    private removeStageListener(stage:StageRecord):void {
        if(stage.removeOnce)return;stage.removeOnce=true;
        stage.cancelDeadline?.();stage.cancelDeadline=undefined;
        const listener=stage.listener,signal=stage.signal;stage.listener=undefined;stage.signal=undefined;
        if(listener&&signal)signal.remove('abort',listener);
    }
    /** A retained public ticket closes over only its cleared record, never admission arguments. */
    private createStageHandle(record:Submission):SharedFrameUpload {
        const stage=record.stage!;
        const host=this;
        const handle=Object.freeze({
            ready:stage.ready.promise,
            submit(this:unknown):SharedFrameSubmission {if(this!==handle)throw error('WEBGPU_UPLOAD_INVALID');return host.submitStage(record);},
            dispose(this:unknown):void {if(this!==handle)throw error('WEBGPU_UPLOAD_INVALID');if(stage.phase==='submitted'||stage.phase==='revoked')return;host.revokeStage(record,error('WEBGPU_UPLOAD_DISPOSED'));}
        }) as unknown as SharedFrameUpload;

        return handle;
    }
    private admitStageRecord(record:Submission,p:SharedPlan,done:ReturnType<typeof deferred<void>>,signal:StageSignal|undefined,deadline:number):SharedFrameUpload {
        const stage:StageRecord={deadline,plan:p,frameId:p.storage.prepared.frame.frameId,generation:record.owner!.number,done,ready:deferred<SharedFrameUploadReady>(),native:deferred<void>(),signal,phase:'admitted',
            failure:undefined,returned:false,listener:undefined,removeOnce:false,cancelDeadline:undefined,recipe:undefined,writes:[],cursor:0,outcomes:[],touched:false,proofStarted:false,proofSettled:false,inside:false};
        record.stage=stage;
        record.completion=observed(done.promise.then(()=>{if(record.failure)throw record.failure;}));
        const handle=this.createStageHandle(record);
        try{
            stage.cancelDeadline=this.ownedTimeout(()=>this.revokeStage(record,error('WEBGPU_UPLOAD_EXPIRED')),10000);
            if(signal){
                stage.listener=()=>{
                    if(signal.aborted||stage.phase==='submitted'||stage.phase==='revoked')return;
                    // Revoke authority before the controlled reason getter, but publish its tagged result afterwards.
                    stage.phase='revoked';signal.aborted=true;
                    const failure=this.stageAbortReason(signal);this.revokeStage(record,failure);
                };
                signal.add('abort',stage.listener,{once:true});this.active();
                const aborted=signal.signal.aborted;this.active();
                if(typeof aborted!=='boolean')throw new TypeError('Signal aborted');
                if(aborted&&!signal.aborted)stage.listener();
                if(stage.failure)throw stage.failure;
            }
            this.stageGate(record);
            for(const handle of record.bufferPlan.victims)this.bufferCleanup.add(handle);
            this.beginImageResidency(record,p.imagePlan);
            this.bufferPool.claim(record.bufferPlan);record.bufferClaimed=true;
            this.stageGate(record);stage.returned=true;this.scheduleStagePump();return handle;
        }catch(cause){
            const failure=this.state!=='active'?this.stateError():stage.failure??error('WEBGPU_UPLOAD_OPTIONS_INVALID',cause);
            // No native operation has begun. Subscription failures unwind this exact charged record synchronously.
            stage.phase='revoked';stage.failure=failure;record.failure=failure;stage.ready.reject(failure);stage.native.reject(failure);
            try{this.removeStageListener(stage);}catch{}
            try{this.retire(record);}finally{done.resolve();}
            throw failure;
        }
    }
    private revokeStages(cause:EgretError):void {
        // Latch every authority before the first captured signal-removal callback can reenter.
        const affected:Submission[]=[];
        for(const record of this.ledger){const stage=record.stage;if(stage&&stage.phase!=='submitted'&&!stage.failure){stage.phase='revoked';stage.failure=cause;record.failure??=cause;stage.ready.reject(cause);stage.native.reject(cause);affected.push(record);}}
        for(const record of affected)this.finishStageRevocation(record);
    }
    private revokeStage(record:Submission,cause:EgretError):void {
        const stage=record.stage!;if(stage.phase==='submitted'||stage.failure)return;
        stage.phase='revoked';stage.failure=this.state==='active'?cause:this.stateError();record.failure??=stage.failure;
        stage.ready.reject(stage.failure);stage.native.reject(stage.failure);this.finishStageRevocation(record);
    }
    private finishStageRevocation(record:Submission):void {
        const stage=record.stage!;
        try{this.removeStageListener(stage);}catch(cause){stage.failure??=error('WEBGPU_UPLOAD_OPTIONS_INVALID',cause);record.failure??=stage.failure;}
        if(![...this.ledger].some(item=>item.stage?.phase==='admitted'||item.stage?.phase==='uploading')){this.cancelStagePump?.();this.cancelStagePump=undefined;this.stagePumpScheduled=false;}
        if(!stage.returned||stage.inside)return;
        if(stage.proofSettled)this.retireStage(record);
        else if(!stage.proofStarted)this.proveStage(record);
    }
    private retireStage(record:Submission):void {
        const stage=record.stage!;
        // Scope rejection and observer failure are Host/owner classifications.
        // Latch them before the shared retirement sink can release this record.
        if(this.unsafe||record.owner?.unknown)record.unsafe=true;
        try{if(!record.unsafe)this.retire(record);}
        catch(cause){record.unsafe=true;record.failure??=this.fail('WEBGPU_RENDER_FAILED',cause,'cleanup',record.serial,true);}
        finally{stage.writes.length=0;stage.recipe=undefined;stage.done.resolve();}
    }
    private scheduleStagePump():void {
        if(this.stagePumpScheduled)return;this.stagePumpScheduled=true;
        this.cancelStagePump=this.ownedTimeout(()=>{this.cancelStagePump=undefined;this.stagePumpScheduled=false;this.pumpStages();},0);
    }
    private pumpStages():void {
        if(this.busy){this.scheduleStagePump();return;}
        let remaining=4194304,more=false;
        this.busy=true;this.cpu=deferred<void>();
        try{
            for(const record of this.ledger){
                const stage=record.stage;if(!stage||(stage.phase!=='admitted'&&stage.phase!=='uploading'))continue;
                if(remaining===0){more=true;continue;}
                stage.inside=true;
                const gate=():void=>this.stageGate(record);
                try{
                    gate();stage.phase='uploading';
                    this.scoped(null,'frame',stage.outcomes,gate,()=>{
                        if(!stage.recipe){
                            for(const entry of stage.plan!.imagePlan.victims){gate();this.destroyReadyImage(entry);gate();}
                            for(const handle of record.bufferPlan.victims){gate();this.destroyPooledBuffer(handle);gate();}
                            const color=record.bufferPlan.requests.find(request=>request.kind==='color')!.id;
                            stage.recipe=this.prepareSharedGPU(record,stage.plan!,color,gate);
                        }
                        while(stage.cursor<stage.writes.length){
                            const write=stage.writes[stage.cursor]!;
                            const unit=write.kind==='buffer'?write.unit:4*write.width;
                            const available=write.kind==='buffer'?write.data.byteLength-write.offset:4*write.width*write.height-write.offset;
                            const count=Math.min(available,Math.floor(remaining/unit)*unit);
                            if(count===0){more=true;break;}
                            gate();stage.touched=true;if(record.imageUse)record.imageUse.touchedQueue=true;
                            if(write.kind==='buffer'){
                                const view=new Uint8Array(write.data.buffer,write.data.byteOffset+write.offset,count);
                                record.owner!.native.write(write.buffer,write.offset,view);
                            }else{
                                const row=write.width*4,rows=count/row;
                                record.owner!.native.writeTexture({texture:write.texture,mipLevel:0,origin:{x:0,y:write.offset/row,z:0},aspect:'all'},
                                    write.data,{offset:write.offset,bytesPerRow:row,rowsPerImage:rows},{width:write.width,height:rows,depthOrArrayLayers:1});
                                this.resourcePageWrite(count);
                            }
                            write.offset+=count;remaining-=count;gate();
                            if(count===available)stage.cursor++;
                        }
                    });
                }catch(cause){
                    const failure=stage.failure??(this.state!=='active'?this.stateError():cause instanceof ClassifiedWebGPUFailure?cause.publicError:this.fail('WEBGPU_RENDER_FAILED',cause,'frame',null));
                    this.revokeStage(record,failure);
                }finally{stage.inside=false;}
                if(stage.failure||stage.cursor===stage.writes.length)this.proveStage(record);else more=true;
            }
        }finally{this.busy=false;this.cpu.resolve();}
        if(more&&this.state==='active')this.scheduleStagePump();
    }
    private proveStage(record:Submission):void {
        const stage=record.stage!;if(stage.proofStarted)return;
        stage.proofStarted=true;if(!stage.failure)stage.phase='proof';
        const outcomes=[...stage.outcomes];
        if(stage.touched){
            try{outcomes.push(observed(record.owner!.fence()).catch(cause=>{throw this.recordAsyncFailure(record,'WEBGPU_QUEUE_FAILED',cause,'frame');}));}
            catch(cause){outcomes.push(observed(Promise.reject(this.recordAsyncFailure(record,'WEBGPU_QUEUE_FAILED',cause,'frame'))));}
        }
        observed(Promise.allSettled(outcomes).then(results=>{
            stage.proofSettled=true;
            const rejected=results.find(result=>result.status==='rejected');
            if(rejected?.status==='rejected'&&!stage.failure){const cause=rejected.reason;this.revokeStage(record,cause instanceof ClassifiedWebGPUFailure?cause.publicError:cause as EgretError);}
            if(!stage.failure){
                try{this.stageGate(record);stage.phase='ready';stage.ready.resolve(Object.freeze({generation:stage.generation,frameId:stage.frameId}));}
                catch(cause){this.revokeStage(record,cause as EgretError);}
            }
            if(stage.failure)this.retireStage(record);
        })).catch(cause=>{record.unsafe=true;record.failure=this.fail('WEBGPU_RENDER_FAILED',cause,'cleanup',null,true);stage.ready.reject(record.failure);stage.done.resolve();});
    }
    private submitStage(record:Submission):SharedFrameSubmission {
        const stage=record.stage!;
        this.active();if(this.busy)throw error('WEBGPU_REENTRANT');
        if(stage.generation!==this.generation||this.owner?.invalidated)throw error('WEBGPU_UPLOAD_STALE');
        if(stage.phase==='submitted')throw error('WEBGPU_UPLOAD_USED');
        if(!stage.failure&&this.now()>=stage.deadline)this.revokeStage(record,error('WEBGPU_UPLOAD_EXPIRED'));
        this.active();
        if(stage.failure)throw stage.failure;
        if(stage.phase!=='ready')throw error('WEBGPU_UPLOAD_NOT_READY');
        if(this.lastSerial===Number.MAX_SAFE_INTEGER)throw error('WEBGPU_SERIAL_EXHAUSTED');
        this.busy=true;this.cpu=deferred<void>();
        const plan=stage.plan!,{storage}=plan,{frame,width,height}=storage.prepared;
        let ticket:Ticket|undefined,staging:OwnedWebGPUBuffer|undefined,synchronous:EgretError|undefined,submitted=false,touched=false;
        const outcomes:Promise<unknown>[]=[];
        try{
            record.serial=++this.lastSerial;stage.phase='submitted';
            if(record.imageUse)record.imageUse.touchedQueue=false;
            ticket=this.ticket&&!this.ticket.bound?this.ticket:undefined;if(ticket)ticket.bound=true;
            this.removeStageListener(stage);
            const gate=():void=>{this.active();if(record.owner!==this.owner||record.owner?.invalidated)throw error('WEBGPU_UPLOAD_STALE');};
            this.scoped(record.serial,'frame',outcomes as Promise<void>[],gate,()=>{
                const oldWidth=this.surface.width;gate();const oldHeight=this.surface.height;gate();
                if(oldWidth!==width){this.surface.width=width;gate();}if(oldHeight!==height){this.surface.height=height;gate();}
                const actualWidth=this.surface.width;gate();const actualHeight=this.surface.height;gate();
                if(actualWidth!==width||actualHeight!==height)throw new Error('Canvas rejected dimensions');
                if(oldWidth!==width||oldHeight!==height)this.configureSurface(gate);
                staging=ticket?this.ownedBuffer(storage.staging,9,record,gate):undefined;
                touched=true;submitted=this.drawSharedGPU(record,plan,stage.recipe!,staging,ticket,gate);
            });
        }catch(cause){synchronous=this.state!=='active'?this.stateError():cause instanceof ClassifiedWebGPUFailure?cause.publicError:this.fail('WEBGPU_RENDER_FAILED',cause,'frame',record.serial);record.failure=synchronous;}
        try{
            this.finishSubmission(record,ticket,stage.done,outcomes,touched,synchronous,submitted,staging,frame.frameId,width,height,storage.rowPitch,storage.output);
            return Object.freeze({generation:stage.generation,frameId:frame.frameId,serial:record.serial,completed:stage.native.promise});
        }finally{this.busy=false;this.cpu.resolve();}
    }
    private recordAsyncFailure(record:Submission,code:WebGPUHostErrorCode,cause:unknown,phase:WebGPUHostFailure['phase']):EgretError {
        const owner=record.owner;
        if(owner?.invalidated&&!owner.unknown&&!record.unsafe)return record.failure??error('WEBGPU_DEVICE_LOST',cause);
        record.unsafe=true;if(owner)owner.unknown=true;
        if(owner&&this.owner!==owner){this.proofFailed(cause);return error(code,cause);}
        return this.fail(code,cause,phase,record.serial,true);
    }

    private submissionTarget(record:Submission,requestId:number,gate:()=>void):{resource:OwnedWebGPUTexture;view:GPUTextureView} {
        gate();const request=record.bufferPlan.requests[requestId]!;
        if(request.kind==='buffer')throw new TypeError('Expected target lease');
        let lease=record.bufferLeases[requestId];
        if(!lease){
            const raw=record.shared?.rawTargets.find(slot=>slot.requestId===requestId);
            if(!raw)throw new TypeError('Missing raw target owner');
            // The slot already exists: retain the returned native object before
            // allocating its registered wrapper or reading any external method.
            raw.logicalByteLength=request.byteLength;
            raw.texture=(record.owner?.native.texture??this.texture!)({size:{width:request.width,height:request.height,depthOrArrayLayers:1},dimension:'2d',format:request.format,mipLevelCount:1,sampleCount:1,usage:request.usage});
            const texture=raw.texture;
            try{raw.destroy=this.method(texture,'destroy',()=>undefined);}catch(cause){record.unsafe=true;this.proofFailed(cause);throw cause;}gate();
            const resource:OwnedWebGPUTexture={texture,destroy:raw.destroy,cleaned:false,logicalByteLength:request.byteLength,...(raw.diagnosticUnknown?{diagnosticUnknown:true}:{})};if(record.owner)resource.generation=record.owner;
            lease=(record.owner?.pool??this.bufferPool).registerCreated(request,resource);record.bufferLeases[requestId]=lease;
            // Only the completed, recorded registration transfers ownership.
            raw.texture=undefined;raw.destroy=undefined;
        }
        if(lease.handle.kind==='buffer')throw new TypeError('Target lease kind');
        const resource=lease.handle.resource,view=this.method(resource.texture,'createView',gate)();record.views.push(view);gate();return {resource,view};
    }
    private submitShared(p:SharedPlan,stageInput?:{signal:StageSignal|undefined}):undefined|SharedFrameUpload {
        const {storage,imagePlan,batch}=p,{prepared}=storage,{frame,width,height}=prepared;
        this.assertImagePlanCurrent(imagePlan);
        const requests:RetentionRequest[]=[];
        const buffer=(role:SubmissionBufferRequest['role'],usage:SubmissionBufferRequest['usage'],byteLength:number):void=>{if(byteLength>0)requests.push({kind:'buffer',id:requests.length,role,usage,byteLength});};
        for(const draw of batch.draws){buffer('vertex',40,draw.data.byteLength);buffer('uniform',72,128);}
        if(p.regions)buffer('uniform',72,p.regions.byteLength);
        for(const group of prepared.effects.groups)buffer('uniform',72,group.uniform.byteLength);
        const colorId=requests.length;
        requests.push({kind:'color',id:colorId,width,height,format:'rgba8unorm-srgb',usage:20,byteLength:storage.colorBytes,sampleCount:1,mipLevelCount:1,depthOrArrayLayers:1,recipe:'egret.srgb-pma8-target/1'});
        for(let i=0;i<prepared.effects.targetCount;i++)requests.push({kind:'color',id:requests.length,width,height,format:'rgba8unorm-srgb',usage:20,byteLength:storage.colorBytes,sampleCount:1,mipLevelCount:1,depthOrArrayLayers:1,recipe:'egret.srgb-pma8-target/1'});
        const bufferPlan=this.bufferPool.plan(requests),bufferLeases:(RetentionLease|undefined)[]=new Array(requests.length).fill(undefined);
        for(const lease of bufferPlan.leases)bufferLeases[lease.requestId]=lease;
        const rawTargets:RawTargetSlot[]=[{requestId:colorId,texture:undefined,destroy:undefined,cleanupAttempted:false}];
        for(let i=0;i<prepared.effects.targetCount;i++)rawTargets.push({requestId:colorId+1+i,texture:undefined,destroy:undefined,cleanupAttempted:false});
        this.assertImagePlanCurrent(imagePlan);checkSharedCapacity2D(storage,this.sharedOwnerSnapshot(),p.canonicalBytes);
        const stageDeadline=stageInput?this.now()+10000:0;
        this.active();
        const owner=this.owner;
        // This shared-only path requires the exact prepared generation before charging a record.
        if(!owner||owner.invalidated||owner.number!==this.generation||owner.device!==this.device
            ||owner.epoch!==imagePlan.epoch||owner.pool!==this.bufferPool)throw error('WEBGPU_DEVICE_LOST',this.generationFailure?.cause);
        const serial=stageInput?0:++this.lastSerial,done=deferred<void>();
        const record:Submission={owner,batchPlan:batch,shared:{frame,draws:batch.draws,colorBytes:storage.colorBytes+storage.effectBytes,canonicalBytes:p.canonicalBytes,rawTargets},
            serial,upload:storage.upload,readback:storage.staging+storage.output,textureBytes:prepared.pageBytes,geometryBytes:prepared.geometryBytes,
            resources:[],textures:[],views:[],bindings:[],projectionPlan:storage.projectionPlan,projections:p.projections,imageUse:undefined,
            bufferPlan,bufferClaimed:false,bufferLeases,bufferReturns:undefined,retiring:false,bindingCandidates:[],
            outcome:done.promise,completion:done.promise,failure:undefined,unsafe:false,retired:false};
        this.ledger.add(record);batch.transferred=true;
        this.pendingUploadBytes+=record.upload;this.pendingReadbackBytes+=record.readback;this.pendingTextureBytes+=record.textureBytes;this.pendingGeometryBytes+=record.geometryBytes;
        // Active targets and retained canonical CPU arrays have separate ledgers.
        // Neither is an upload byte or a second idle retention allowance.
        this.pendingColorBytes+=storage.colorBytes+storage.effectBytes;this.pendingCanonicalBytes+=p.canonicalBytes;this.sampleResourcePending();
        if(stageInput)return this.admitStageRecord(record,p,done,stageInput.signal,stageDeadline);
        const ticket=p.ticket;if(ticket)ticket.bound=true;
        const outcomes:Promise<unknown>[]=[];let touchedQueue=false,synchronous:EgretError|undefined,staging:OwnedWebGPUBuffer|undefined,submitted=false;
        const gate=():void=>this.active();
        try{
            for(const handle of bufferPlan.victims)this.bufferCleanup.add(handle);
            this.beginImageResidency(record,imagePlan);
            this.bufferPool.claim(bufferPlan);record.bufferClaimed=true;
            for(const entry of imagePlan.victims){gate();this.destroyReadyImage(entry);gate();}
            for(const handle of bufferPlan.victims){gate();this.destroyPooledBuffer(handle);gate();}
            this.scoped(serial,'frame',outcomes as Promise<void>[],gate,()=>{
                const oldWidth=this.surface.width;gate();const oldHeight=this.surface.height;gate();
                if(oldWidth!==width){this.surface.width=width;gate();}if(oldHeight!==height){this.surface.height=height;gate();}
                const actualWidth=this.surface.width;gate();const actualHeight=this.surface.height;gate();if(actualWidth!==width||actualHeight!==height)throw new Error('Canvas rejected dimensions');
                if(oldWidth!==width||oldHeight!==height)this.configureSurface(gate);
                const recipe=this.prepareSharedGPU(record,p,colorId,gate);
                staging=ticket?this.ownedBuffer(storage.staging,9,record,gate):undefined;
                touchedQueue=true;submitted=this.drawSharedGPU(record,p,recipe,staging,ticket,gate);
            });
        }catch(cause){synchronous=cause instanceof ClassifiedWebGPUFailure?cause.publicError:this.fail('WEBGPU_RENDER_FAILED',cause,'frame',serial);record.failure=synchronous;}
        return this.finishSubmission(record,ticket,done,outcomes,touchedQueue,synchronous,submitted,staging,frame.frameId,width,height,storage.rowPitch,storage.output);
    }
    /** The pipeline of a draw: without a region, of one page, or of several pages. */
    private sharedRole(draw:PackedSharedDraw2D):{pipeline:GPURenderPipeline;layout:GPUBindGroupLayout;regions:GPUBindGroupLayout|undefined} {
        return this.sharedPipelines.get((draw.pages.length===0?'solid:':draw.pages.length>1?'paged:':'sampled:')+draw.prepared.material.blend)!;
    }
    private prepareSharedGPU(record:Submission,p:SharedPlan,colorId:number,gate:()=>void):SharedRecipe {
        const {batch}=p,imageUse=record.imageUse!;
                const realized=new Map<number,{texture:GPUTexture;view:GPUTextureView}>();
                for(const draw of batch.draws)for(const index of draw.pages)if(!realized.has(index))realized.set(index,this.realizeImageResidency(record,imageUse,index,gate));
                for(const group of p.storage.prepared.effects.groups){const index=group.maskPageIndex;if(index!==undefined&&!realized.has(index))realized.set(index,this.realizeImageResidency(record,imageUse,index,gate));}
                let requestId=0;const vertices=new Map<PackedSharedDraw2D,OwnedWebGPUBuffer>(),bindings=new Map<PackedSharedDraw2D,GPUBindGroup>();
                for(const draw of batch.draws){const vertex=this.submissionBuffer(record,requestId++,gate).handle.resource,lease=this.submissionBuffer(record,requestId++,gate),uniform=lease.handle.resource;
                    vertices.set(draw,vertex);this.sharedWrite(record,vertex.buffer,draw.data,52);gate();this.sharedWrite(record,uniform.buffer,draw.uniform,128);gate();
                    const source=draw.prepared,index=source.pageIndex,sampled=index!==undefined,role=this.sharedRole(draw);
                    const image=sampled?imageUse.hits.get(index)??imageUse.candidates.get(index)!.entry:undefined;
                    const view=sampled?realized.get(index)!.view:undefined,sampler=sampled?this.sharedSamplers.get(source.material.filter+':'+source.material.addressU+':'+source.material.addressV):undefined;
                    const key:DrawBindingKey={session:this.imageEpoch,layout:role.layout,texture:image?.identity,view,sampler,uniform:lease.handle,offset:0,size:128};
                    const entries:GPUBindGroupEntry[]=[{binding:0,resource:{buffer:uniform.buffer,offset:0,size:128}}];
                    if(sampled)entries.push({binding:1,resource:view!},{binding:2,resource:sampler!});
                    // A batch of several pages has a view for each of the eight units of its pipeline. A unit the batch does not name
                    // holds the first page again; no vertex selects it. The cache knows a group by one page, so this group is made
                    // for the record and kept by it alone.
                    if(draw.pages.length>1){for(let unit=1;unit<SHARED_BATCH_PAGES_2D;unit++)entries.push({binding:2+unit,resource:unit<draw.pages.length?realized.get(draw.pages[unit]!)!.view:view!});
                        const binding=(record.owner?.native.bindGroup??this.bindGroup!)({layout:role.layout,entries});record.bindings.push(binding);gate();bindings.set(draw,binding);}
                    else bindings.set(draw,this.submissionBinding(record,key,entries,image,gate));
                }
                // One buffer holds the region table of the record. A sampled draw binds its window of it as a second
                // group, made once for each pipeline and window the record uses and kept by the record alone.
                const regionBindings=new Map<PackedSharedDraw2D,GPUBindGroup>();
                if(p.regions){const table=this.submissionBuffer(record,requestId++,gate).handle.resource;this.sharedWrite(record,table.buffer,p.regions,16);gate();
                    const made=new Map<GPUBindGroupLayout,Map<number,GPUBindGroup>>();
                    for(const draw of batch.draws){if(draw.regionWindow<0)continue;
                        const layout=this.sharedRole(draw).regions!;
                        let byWindow=made.get(layout);if(!byWindow){byWindow=new Map();made.set(layout,byWindow);}
                        let binding=byWindow.get(draw.regionWindow);
                        if(!binding){binding=(record.owner?.native.bindGroup??this.bindGroup!)({layout,entries:[{binding:0,resource:{buffer:table.buffer,offset:draw.regionWindow*SHARED_REGION_WINDOW_STRIDE_2D,size:SHARED_REGION_WINDOW_BYTES_2D}}]});record.bindings.push(binding);gate();byWindow.set(draw.regionWindow,binding);}
                        regionBindings.set(draw,binding);}
                }
                const effectUniforms=new Map<PreparedEffect2D,OwnedWebGPUBuffer>();
                for(const group of p.storage.prepared.effects.groups){const uniform=this.submissionBuffer(record,requestId++,gate).handle.resource;this.sharedWrite(record,uniform.buffer,group.uniform,16);gate();effectUniforms.set(group,uniform);}
                const effectTargets=[];for(let i=0;i<p.storage.prepared.effects.targetCount;i++)effectTargets.push(this.submissionTarget(record,colorId+1+i,gate));
                const effects=new Map<PreparedEffect2D,Map<SharedEffectPass,GPUBindGroup>>();
                for(const group of p.storage.prepared.effects.groups){
                    const bindings=new Map<SharedEffectPass,GPUBindGroup>(),source=effectTargets[(group.depth-1)*2]!,scratch=effectTargets[(group.depth-1)*2+1]!;
                    for(const mode of EFFECT_PASSES){const role=this.effectPipelines.get(mode)!;const entries:GPUBindGroupEntry[]=[{binding:0,resource:{buffer:effectUniforms.get(group)!.buffer,offset:0,size:448}},{binding:1,resource:(mode==='vertical'?scratch:source).view}];
                        if(mode==='composite')entries.push({binding:2,resource:group.maskPageIndex===undefined?source.view:realized.get(group.maskPageIndex)!.view});
                        const binding=record.owner!.native.bindGroup({layout:role.layout,entries});record.bindings.push(binding);gate();bindings.set(mode,binding);}
                    effects.set(group,bindings);
                }
                const color=this.submissionTarget(record,colorId,gate);
                const resolveBinding=record.owner!.native.bindGroup({layout:this.resolveLayout!,entries:[{binding:0,resource:color.view}]});record.bindings.push(resolveBinding);gate();

        return {vertices,bindings,regionBindings,color,resolveBinding,effectTargets,effects};
    }
    private drawSharedGPU(record:Submission,p:SharedPlan,recipe:SharedRecipe,staging:OwnedWebGPUBuffer|undefined,ticket:Ticket|undefined,gate:()=>void):true {
        const {storage,batch}=p,{frame,width,height}=storage.prepared,serial=record.serial;
        const {vertices,bindings,color,resolveBinding}=recipe;
                const texture=record.owner!.native.currentTexture();gate();const canvasView=this.method(texture,'createView',gate)();gate();
                const encoder=record.owner!.native.encoder();gate();const begin=this.method(encoder,'beginRenderPass',gate),finish=this.method(encoder,'finish',gate),copy=ticket?this.method(encoder,'copyTextureToBuffer',gate):undefined;
                const c=frame.clearColor,a=frame.clearAlpha;
                const attachment:GPURenderPassColorAttachment={view:color.view,loadOp:'clear',storeOp:'store',clearValue:{r:a*decodeSharedSRGB(((c>>>16)&255)/255),g:a*decodeSharedSRGB(((c>>>8)&255)/255),b:a*decodeSharedSRGB((c&255)/255),a}};
                const capture=(pass:GPURenderPassEncoder,keys:readonly (keyof GPURenderPassEncoder)[]):GPURenderPassEncoder=>{const captured={} as GPURenderPassEncoder;for(const key of keys){const method=this.method(pass,key,gate) as (...args:unknown[])=>unknown;Object.defineProperty(captured,key,{value:(...args:unknown[])=>{gate();const result=method(...args);gate();return result;}});}return captured;};
                const openPass=(view:GPUTextureView,clear:boolean,initial=false)=>{
                    const colors:GPURenderPassColorAttachment=initial?attachment:{view,loadOp:clear?'clear':'load',storeOp:'store',...(clear?{clearValue:{r:0,g:0,b:0,a:0}}:{})};
                    const raw=begin({colorAttachments:[colors]});gate();
                    return {pass:capture(raw,['setPipeline','setViewport','setScissorRect','setVertexBuffer','setBindGroup','draw']),end:this.method(raw,'end',gate)};
                };
                let active=openPass(color.view,false,true);
                const drawOne=(draw:PackedSharedDraw2D):void=>{const role=this.sharedRole(draw);
                    active.pass.setPipeline(role.pipeline);active.pass.setViewport(0,0,width,height,0,1);active.pass.setScissorRect(0,0,width,height);active.pass.setVertexBuffer(0,vertices.get(draw)!.buffer);active.pass.setBindGroup(0,bindings.get(draw)!);if(draw.regionWindow>=0)active.pass.setBindGroup(1,recipe.regionBindings.get(draw)!);active.pass.draw(draw.vertexCount);};
                if(storage.prepared.effects.groups.length===0){for(const draw of batch.draws)drawOne(draw);}
                else{
                    const byOrdinal=new Map(batch.draws.map(draw=>[draw.prepared.command.ordinal,draw]));
                    const enters=new Map(storage.prepared.effects.groups.map(group=>[group.enter,group])),exits=new Map(storage.prepared.effects.groups.map(group=>[group.exit,group]));
                    const effectPass=(group:PreparedEffect2D,mode:SharedEffectPass,view:GPUTextureView,clear:boolean):void=>{
                        const run=openPass(view,clear);run.pass.setPipeline(this.effectPipelines.get(mode)!.pipeline);run.pass.setViewport(0,0,width,height,0,1);run.pass.setScissorRect(0,0,width,height);run.pass.setBindGroup(0,recipe.effects.get(group)!.get(mode)!);run.pass.draw(3);run.end();gate();};
                    for(const command of frame.commands){const enter=enters.get(command.ordinal),exit=exits.get(command.ordinal);
                        if(enter){active.end();gate();active=openPass(recipe.effectTargets[(enter.depth-1)*2]!.view,true);}
                        else if(exit){active.end();gate();const source=recipe.effectTargets[(exit.depth-1)*2]!,scratch=recipe.effectTargets[(exit.depth-1)*2+1]!;
                            if(exit.radius>0){effectPass(exit,'horizontal',scratch.view,true);effectPass(exit,'vertical',source.view,true);}
                            const parent=exit.depth===1?color:recipe.effectTargets[(exit.depth-2)*2]!;effectPass(exit,'composite',parent.view,false);active=openPass(parent.view,false);
                        }else{const draw=byOrdinal.get(command.ordinal);if(draw)drawOne(draw);}
                    }
                }
                active.end();gate();
                const resolveRaw=begin({colorAttachments:[{view:canvasView,loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:0}}]});gate();
                const resolve=capture(resolveRaw,['setPipeline','setViewport','setScissorRect','setBindGroup','draw']),endResolve=this.method(resolveRaw,'end',gate);
                resolve.setPipeline(this.resolvePipeline!);resolve.setViewport(0,0,width,height,0,1);resolve.setScissorRect(0,0,width,height);resolve.setBindGroup(0,resolveBinding);resolve.draw(3);endResolve();gate();
                if(staging){try{copy!({texture},{buffer:staging.buffer,bytesPerRow:storage.rowPitch,rowsPerImage:height},{width,height,depthOrArrayLayers:1});}catch(cause){throw new ClassifiedWebGPUFailure('WEBGPU_READBACK_FAILED',cause,this.fail('WEBGPU_READBACK_FAILED',cause,'readback',serial));}gate();}
                const commands=finish();gate();record.owner!.native.submit([commands]);gate();

        return true;
    }
    private finishSubmission(record:Submission,ticket:Ticket|undefined,done:ReturnType<typeof deferred<void>>,outcomes:Promise<unknown>[],touchedQueue:boolean,synchronous:EgretError|undefined,submitted:boolean,staging:OwnedWebGPUBuffer|undefined,frameId:number,width:number,height:number,rowPitch:number,output:number):undefined {
        const serial=record.serial;let result:WebGPUReadback|SharedWebGPUReadback|undefined;
        const nativeOutcomes=[...outcomes],nativeFailure=synchronous;
        if(submitted&&staging&&!synchronous){
            try{outcomes.push(this.readPixels(staging,record,frameId,width,height,rowPitch,output).then(value=>{result=value;}));}
            catch(cause){synchronous=this.recordAsyncFailure(record,'WEBGPU_READBACK_FAILED',cause,'readback');record.failure=synchronous;}
        }
        if(touchedQueue||record.imageUse?.touchedQueue){
            let proof:Promise<void>;
            try{proof=observed((record.owner?.fence??this.fence!)()).catch(cause=>{throw this.recordAsyncFailure(record,'WEBGPU_QUEUE_FAILED',cause,'frame');});}
            catch(cause){proof=observed(Promise.reject(this.recordAsyncFailure(record,'WEBGPU_QUEUE_FAILED',cause,'frame')));}
            outcomes.push(proof);nativeOutcomes.push(proof);
        }
        if(record.stage){
            const stage=record.stage;
            observed(Promise.allSettled(nativeOutcomes).then(results=>{
                const rejected=results.find(value=>value.status==='rejected');
                if(nativeFailure)stage.native.reject(nativeFailure);
                else if(record.owner?.invalidated)stage.native.reject(record.failure??error('WEBGPU_DEVICE_LOST'));
                else if(rejected?.status==='rejected')stage.native.reject(rejected.reason instanceof ClassifiedWebGPUFailure?rejected.reason.publicError:rejected.reason);
                else stage.native.resolve();
            }));
        }
        const settled=Promise.allSettled(outcomes).then(results=>{
            const rejected=results.find(value=>value.status==='rejected');
            if(rejected?.status==='rejected')record.failure??=rejected.reason instanceof ClassifiedWebGPUFailure?rejected.reason.publicError:rejected.reason as EgretError;
            if(this.unsafe)record.unsafe=true;
            if(!record.unsafe)this.retire(record);
            if(ticket){
                if(record.failure)ticket.reject(record.failure);
                else if(!SHARED_OPTIONS.get(this)?.recovery&&this.firstFailure)ticket.reject(error(this.firstFailure.code,this.firstFailure.cause));
                else if(result)ticket.resolve(result);
                else ticket.reject(error('WEBGPU_READBACK_FAILED'));
                if(this.ticket===ticket)this.ticket=undefined;
            }
            done.resolve();
        });
        observed(settled).catch(cause=>{record.unsafe=true;record.failure=this.fail('WEBGPU_RENDER_FAILED',cause,'cleanup',serial,true);ticket?.reject(record.failure);done.resolve();});
        record.completion=observed(done.promise.then(()=>{
            if(record.failure)throw record.failure;
            if(!SHARED_OPTIONS.get(this)?.recovery&&this.firstFailure&&(this.firstFailure.serial===null||this.firstFailure.serial<=serial))throw error(this.firstFailure.code,this.firstFailure.cause);
        }));
        if(synchronous)throw synchronous;return undefined;
    }
    private readPixels(staging:OwnedWebGPUBuffer,record:Submission,frameId:number,width:number,height:number,rowPitch:number,output:number):Promise<WebGPUReadback|SharedWebGPUReadback> {
        const owner=record.owner,format=owner?.format??this.format,alpha=owner?.alpha??'premultiplied';
        const mapping=observed(staging.map(1));
        return observed(mapping.then(()=>{
            if(owner?.invalidated)throw record.failure??error('WEBGPU_DEVICE_LOST');
            staging.mapped=true;const mapped=new Uint8Array(staging.mappedRange()),bytes=new Uint8Array(output);
            if(owner?.invalidated)throw record.failure??error('WEBGPU_DEVICE_LOST');
            for(let y=0;y<height;y++)bytes.set(mapped.subarray(y*rowPitch,y*rowPitch+width*4),y*width*4);
            if(format==='bgra8unorm')for(let i=0;i<bytes.length;i+=4){const blue=bytes[i]!;bytes[i]=bytes[i+2]!;bytes[i+2]=blue;}
            const value={serial:record.serial,frameId,width,height,format:'rgba8unorm' as const,sourceFormat:format,colorSpace:'srgb' as const,alphaMode:alpha,bytes};
            return owner?Object.freeze({...value,generation:owner.number}):Object.freeze({...value,alphaMode:'premultiplied' as const});
        }).catch(cause=>{throw this.recordAsyncFailure(record,'WEBGPU_READBACK_FAILED',cause,'readback');}));
    }
    private retire(record: Submission): void {
        if (record.retired || record.retiring) return;
        record.retiring = true;
        const pool=record.owner?.pool??this.bufferPool,cache=record.owner?.cache??this.bindingCache;
        if(record.unsafe||record.owner?.unknown)this.noteUnknownRecord(record);
        const failed = (cause: unknown): void => {
            const failure = this.fail('WEBGPU_RENDER_FAILED', cause, 'cleanup', record.serial, true);
            record.failure ??= failure; record.unsafe = true;
        };
        const cleanLease = (index: number): void => {
            const lease = record.bufferLeases[index];
            if (!lease) return;
            try { this.destroyPooledBuffer(lease.handle,pool,cache); } catch (cause) { failed(cause); }
            // The persistent detached owner retains unknown destruction. If its
            // registration failed before cleanup, keep this record's exact slot.
            if (lease.handle.resource.cleaned) record.bufferLeases[index] = undefined;
        };
        try {
            // Admission can detach victims before the first scheduled task. Their existing
            // cleanup ownership must settle even when the stage is revoked before that task.
            if(record.stage?.plan&&record.imageUse){
                for(const entry of record.stage.plan.imagePlan.victims){
                    if(entry.state==='detached'&&this.imageCleanup.has(entry)&&!entry.resource!.cleaned){
                        try{this.destroyReadyImage(entry);}catch(cause){failed(cause);}
                    }
                }
            }
            if(record.stage&&record.bufferClaimed){
                for(const handle of record.bufferPlan.victims){
                    if(this.bufferCleanup.has(handle)&&!handle.resource.cleaned){
                        try{this.destroyPooledBuffer(handle,pool,cache);}catch(cause){failed(cause);}
                    }
                }
            }
            if (!record.bufferClaimed) record.bufferLeases.fill(undefined);
            if (!record.bufferReturns && this.isReuseEligible(record)) {
                const leases = record.bufferLeases.filter((lease): lease is RetentionLease => lease !== undefined);
                // Any later metadata failure leaves this exact reservation and
                // every lease reachable from the unretired ledger record.
                record.bufferReturns = pool.reserveReturns(leases);
            }
            const retained = new Set(record.bufferReturns?.retained);
            for (const resource of record.resources) for (const cause of cleanupWebGPUBuffer(resource)) failed(cause);
            for (let index = 0; index < record.bufferLeases.length; index++) {
                const lease = record.bufferLeases[index];
                if (lease && !retained.has(lease.handle)) cleanLease(index);
            }
            for (const resource of record.textures) {
                let candidateOwned = false;
                if (record.imageUse) for (const candidate of record.imageUse.candidates.values()) {
                    if (candidate.entry.resource === resource) { candidateOwned = true; break; }
                }
                if (candidateOwned) continue;
                for (const cause of cleanupWebGPUTexture(resource)) failed(cause);
            }
            if (record.shared) for (const raw of record.shared.rawTargets) {
                if (raw.texture === undefined || raw.cleanupAttempted) continue;
                // Unknown cleanup is terminal. Keep the exact native owner and
                // the submission charge; neither close nor a later retire retries.
                raw.cleanupAttempted = true;
                try {
                    if (!raw.destroy) throw new TypeError('Target destruction method was not captured');
                    if(!record.owner?.invalidated)raw.destroy();
                    raw.texture = undefined; raw.destroy = undefined;
                } catch (cause) { failed(cause); }
            }
            this.finishImageResidency(record, !this.finalizing);
            if (record.bufferReturns) {
                let published = false;
                if (this.isReuseEligible(record)) {
                    try { pool.publishReturns(record.bufferReturns); published = true; }
                    catch (cause) { failed(cause); }
                }
                if (published) {
                    // The pool is now the sole native owner. Clear only the
                    // transferred slots before any subsequent metadata work.
                    for (let index = 0; index < record.bufferLeases.length; index++) {
                        const lease = record.bufferLeases[index];
                        if (lease && retained.has(lease.handle)) record.bufferLeases[index] = undefined;
                    }
                    record.bufferReturns = undefined;
                } else {
                    pool.cancelReturns(record.bufferReturns);
                    record.bufferReturns = undefined;
                    for (let index = 0; index < record.bufferLeases.length; index++) cleanLease(index);
                    retained.clear();
                }
            }
            if (this.isReuseEligible(record)) {
                try {
                    cache.publish(record.bindingCandidates.filter(candidate => retained.has(candidate.key.uniform as RetentionHandle)
                        && (!candidate.image || candidate.image.state === 'ready' && !candidate.image.resource!.cleaned)));
                } catch (cause) { failed(cause); }
            }
            // An uncompleted ownership transfer must retain both its ledger
            // charge and record for explicit close; never silently drop it.
            if (record.bufferLeases.some(lease => lease !== undefined)) throw new TypeError('Unfinished buffer cleanup');
            if (record.shared?.rawTargets.some(raw => raw.texture !== undefined)) throw new TypeError('Unfinished target cleanup');
            // New staged/recovery authority retains unknown charges. Legacy immediate
            // retirement releases logical accounting only after its once cleanup;
            // unsafe outcome and persistent detached owners remain quarantined.
            if((record.stage||SHARED_OPTIONS.get(this)?.recovery)&&(record.unsafe||record.resources.some(resource=>resource.settlement==='unknown')||record.textures.some(resource=>resource.settlement==='unknown')))throw new TypeError('Unknown native ownership remains charged');
            this.ledger.delete(record); this.pendingUploadBytes -= record.upload; this.pendingReadbackBytes -= record.readback; this.pendingTextureBytes -= record.textureBytes;
            this.pendingGeometryBytes -= record.geometryBytes;
            if(record.shared){this.pendingColorBytes-=record.shared.colorBytes;this.pendingCanonicalBytes-=record.shared.canonicalBytes;this.resourceCpu.canonicalBytes-=record.shared.canonicalBytes;record.shared.draws.length=0;delete record.shared;}
            record.resources.length = 0; record.textures.length = 0; record.views.length = 0; record.bindings.length = 0;
            record.projections.length = 0; record.projectionPlan = undefined;
            record.bufferLeases.length = 0; record.bindingCandidates.length = 0;
            this.batchScratch.release(record.batchPlan); record.retired = true;
            if(record.stage){record.stage.writes.length=0;record.stage.recipe=undefined;record.stage.outcomes.length=0;record.stage.plan=undefined;}
            delete record.owner;
        } catch (cause) { failed(cause); throw cause; }
        finally { record.retiring = false; }
    }
    public requestReadback(): Promise<WebGPUReadback|SharedWebGPUReadback> {
        try { this.active(); if (!this.options.enableReadback) throw error('WEBGPU_READBACK_DISABLED'); if (this.ticket) throw error('WEBGPU_READBACK_PENDING'); this.ticket = { ...deferred<WebGPUReadback|SharedWebGPUReadback>(), bound: false }; return this.ticket.promise; }
        catch (cause) { return observed(Promise.reject(cause)); }
    }
    public whenIdle(): Promise<void> {
        if (this.cleanupOutcome === 'unsafe') return observed(Promise.reject(error('WEBGPU_CLOSE_UNSAFE', this.unsafeCause)));
        const shared=SHARED_OPTIONS.has(this),recovery=SHARED_OPTIONS.get(this)?.recovery;
        if(shared&&(recovery||[...this.ledger].some(record=>record.stage))){
            const pending=[...this.ledger].map(record=>record.completion);
            const capturedFailure=this.state==='lost'||this.state==='failed'?this.generationFailure:null;
            if(this.startingPending&&this.starting)pending.push(this.starting);
            const attempt=this.recoveryAttempt;
            if(attempt)pending.push(attempt.barrier.promise,attempt.actual);
            return observed(Promise.allSettled(pending).then(results=>{
                const rejected=results.find(result=>result.status==='rejected');if(rejected?.status==='rejected')throw rejected.reason;
                if(capturedFailure)throw error(capturedFailure.code,capturedFailure.cause);
            }));
        }
        if (this.firstFailure) return observed(Promise.reject(error(this.firstFailure.code, this.firstFailure.cause)));
        if (this.state === 'closed') return Promise.resolve();
        const serial = this.lastSerial, pending = [...this.ledger].map(record => record.completion); if (this.starting) pending.push(this.starting);
        return observed(Promise.allSettled(pending).then(results => { const failed = results.find(result => result.status === 'rejected'); if (failed?.status === 'rejected') throw failed.reason; if (this.firstFailure && (this.firstFailure.serial === null || this.firstFailure.serial <= serial)) throw error(this.firstFailure.code, this.firstFailure.cause); }));
    }
    public close(): Promise<void> {
        if (this.closing) return this.closing;
        this.invalidateImageResidency();
       
        const barrier = deferred<void>(); this.closing = barrier.promise; this.state = 'closing'; this.cleanupOutcome = 'pending'; this.retention.clear();
        this.revokeRecovery(error('WEBGPU_CLOSED'));this.revokeStages(error('WEBGPU_CLOSED'));this.cancelTicket(error('WEBGPU_CLOSED'));
        this.cleanup().then(barrier.resolve, barrier.reject); return barrier.promise;
    }
    private async cleanup(): Promise<void> {
        if (this.starting) await Promise.allSettled([this.starting]);
        if(this.recoveryAttempt)await Promise.allSettled([this.recoveryAttempt.actual]);
        if (this.busy) await this.cpu.promise;
        await Promise.allSettled([...this.ledger].map(record => record.outcome));
        if (this.fence && !this.unsafe && !this.owner?.invalidated) { try { await observed(this.fence()); } catch (cause) { this.proofFailed(cause); } }
        this.finalizing = true;
        for (const record of [...this.ledger]) {
            try { this.retire(record); }
            catch (cause) { this.fail('WEBGPU_RENDER_FAILED', cause, 'cleanup', record.serial, true); }
        }
        this.closeBuffers();
        this.closeImageResidency();
        if (this.configured) { this.configured = false; try { this.unconfigure!(); } catch (cause) { this.proofFailed(cause); } }
        if (this.removeListener) { const remove = this.removeListener; this.removeListener = undefined; try { remove(); } catch (cause) { this.proofFailed(cause); } }
        // Deliver a loss queued by a cleanup boundary before detaching the leased observer.
        await Promise.resolve();
        // The safe return boundary ends the borrowed lease; deliberate owned destruction is ignored.
        delete this.lossCell.notify;delete this.lossCell.unknown;
        if (this.destroyDevice) { const destroy = this.destroyDevice; this.destroyDevice = undefined; try { destroy(); } catch (cause) { this.proofFailed(cause); } }
        if(SHARED_OPTIONS.get(this)?.recovery&&!this.unsafe){this.borrowed=undefined;this.clearNativeReferences();}
        this.cleanupOutcome = this.unsafe ? 'unsafe' : 'safe'; this.state = 'closed';
        if (this.unsafe) throw error('WEBGPU_CLOSE_UNSAFE', this.unsafeCause);
    }
    public setTimeout(callback:()=>void,delayMs:number):()=>void {return this.ownedTimeout(callback,delayMs);}
    private ownedTimeout(callback: () => void, delayMs: number): () => void {
        this.timers ??= { set: globalThis.setTimeout.bind(globalThis), clear: globalThis.clearTimeout.bind(globalThis) };
        const timer = this.timers.set(callback, delayMs); let cancelled = false; const clear = this.timers.clear;
        return () => { if (!cancelled) { cancelled = true; clear(timer); } };
    }
}
export function createSharedWebGPUHost(options:SharedWebGPUHostOptions):SharedWebGPUHost {return new WebGPUHostImplementation(options) as unknown as SharedWebGPUHost;}
