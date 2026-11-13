// SPDX-License-Identifier: Apache-2.0
import { sharedEffectGLSL, EFFECT_PASSES } from './sharedEffectShaders.js';
import type { SharedEffectPass } from './sharedEffectShaders.js';
import type { PreparedEffect2D } from '../rendering/sharedEffects2D.js';
import { SHARED_FRAME_PROFILE_2D } from '@egret/contracts';
import type { CancellationSignal, ImageData2D, SharedRenderFrame2D } from '@egret/contracts';
import type { SharedDeviceSessionStatus, SharedHostResourceStatus } from './sharedDeviceSession.js';
import type { SharedFrameUpload, SharedFrameUploadOptions, SharedFrameUploadReady, SharedFrameSubmission } from './sharedFrameUpload.js';
import { readOwnedSharedFrame } from '#egret-textured-frame-state';
import { admitSharedWebGL2Options } from './sharedWebGL2Options.js';
import type { SharedWebGL2HostOptions, SharedSceneWebGL2HostOptions, SharedWebGL2Configuration } from './sharedWebGL2Options.js';
import type { SharedSceneWebGL2Host, SharedWebGL2FrameTiming, SharedWebGL2TimingPhase, SharedWebGL2TimingSample } from './webgl2Types.js';
import type { SceneFrame3D } from '../rendering/sceneFrame3D.js';
import type { PreparedSharedGLScene } from './sharedWebGL2Scene.js';
import type { SharedLayerWebGL2Host, SharedWebGL2Layer2D, SharedWebGL2LayerEffect2D, SharedWebGL2LayerPlacement2D, SharedWebGL2LayerStatus, SharedWebGL2Readback, SharedWebGL2HostStatus, WebGL2HostState, WebGL2HostStatus, WebGL2HostFailure, WebGL2HostErrorCode, WebGL2HostDiagnostic } from './webgl2Types.js';
import { prepareSharedDraws2D, SharedPreparationError } from '../rendering/prepareSharedDraws2D.js';
import { GeometryPreparationError } from '../rendering/prepareRectangles2D.js';
import { packSharedDraws2D } from '../rendering/packSharedDraws2D.js';
import { PreparedBatchScratch2D } from '../rendering/preparedBatches2D.js';
import { prepareSharedBatches2D } from '../rendering/preparedSharedBatches2D.js';
import type { PreparedSharedBatchPlan2D } from '../rendering/preparedSharedBatches2D.js';
import { decodeSharedSRGB } from '../rendering/sharedColor2D.js';
import type { SharedPageCopyDiagnostics2D } from '../rendering/sharedColor2D.js';
import { runOwnedPreparationScope } from '../rendering/ownedPreparationFailure2D.js';
import { attachSharedSceneSources2D, planSharedStorageFees2D, withSharedReadbackLayout2D, checkSharedCapacity2D, materializeSharedPages2D, SharedStorageError2D } from './sharedSubmissionStorage2D.js';
import type { SharedOwnerSnapshot2D, SharedSubmissionStorage2D } from './sharedSubmissionStorage2D.js';
import { planSharedWebGL2Arenas, checkSharedWebGL2ArenaCapacity, qualifySharedWebGL2Alignment } from './sharedWebGL2Arena.js';
import type { SharedWebGL2ArenaPlan } from './sharedWebGL2Arena.js';
import { createRetentionLedger } from './sharedRetentionLedger.js';
import type { RetentionLedger, LedgerLease, LedgerHandle, LedgerPlan, KeyedRetentionRequest, RetentionLedgerDiagnostics, NativeUnknownDiagnostics } from './sharedRetentionLedger.js';
import { GLNativeSession, glFailure, isGLFailure } from './webgl2Native.js';
import type { GLNativeOwner, GLNativeResourceDiagnostics } from './webgl2Native.js';
import { sharedWebGL2VertexSource, sharedWebGL2FragmentSource, sharedWebGL2ResolveVertexSource, sharedWebGL2ResolveFragmentSource, sharedWebGL2BlendFactors, sharedWebGL2LayerVertexSource, sharedWebGL2LayerFragmentSource, sharedWebGL2LayerEffectFragmentSource } from './sharedWebGL2Shaders.js';

function deferred<T>(): {promise:Promise<T>;resolve:(value:T)=>void;reject:(cause:unknown)=>void} {
    let resolve!:(value:T)=>void, reject!:(cause:unknown)=>void;
    const promise = new Promise<T>((a,b)=>{resolve=a;reject=b;}); promise.catch(()=>undefined);
    return {promise,resolve,reject};
}
const schedule = globalThis.setTimeout.bind(globalThis), cancel = globalThis.clearTimeout.bind(globalThis);
const invoke = Reflect.apply;
const clock = ():number => performance.now();
const TIMING_CAPACITY = 2048;
const TIMING_PHASES = ['texture-prepare','texture-upload','working-framebuffer-validation','default-framebuffer-validation','submit','fence-poll',
    'completion-error-query','retire','sync-delete-error-query'] as const satisfies readonly SharedWebGL2TimingPhase[];
function createFrameTiming() {
    const totals = Object.fromEntries(TIMING_PHASES.map(phase=>[phase,{count:0,totalMs:0,maxMs:0}])) as
        Record<SharedWebGL2TimingPhase,{count:number;totalMs:number;maxMs:number}>;
    return {totals,samples:[] as SharedWebGL2TimingSample[],next:0,dropped:0};
}
const ATTRIBUTES = Object.freeze({alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
interface Request { readonly id:number; readonly byteLength:number; readonly role:'vertex'|'uniform'|'color'|'depth'|'index'; readonly width:number; readonly height:number; }
type Lease = LedgerLease<Request,GLNativeOwner>;
type Handle = LedgerHandle<Request,GLNativeOwner>;
type Ticket = ReturnType<typeof deferred<SharedWebGL2Readback>> & {bound:boolean};
interface Page {readonly source:ImageData2D;readonly native:GLNativeOwner;readonly generation:number;ready:boolean;pins:number;}
const MAX_LAYER_HANDLES=512;
const MAX_LAYER_EXTENT=2048;
const MAX_LAYER_BYTES=32*1024*1024;
interface LayerRevision {
    readonly owner:GLNativeOwner;
    readonly native:GLNativeSession;
    pins:number;
    retained:boolean;
}
interface LayerSlot {ready:LayerRevision|undefined;pending:LayerWrite|undefined;wasReady:boolean;disposed:boolean;}
interface LayerWrite {
    readonly slot:LayerSlot;
    readonly done:ReturnType<typeof deferred<void>>;
    submitted:boolean;
    revision:LayerRevision|undefined;
}
interface LayerEffect {
    readonly left:number;readonly top:number;readonly right:number;readonly bottom:number;
    readonly scale:readonly [number,number,number];
    readonly emission:readonly [number,number,number];
}
interface LayerRead {
    readonly revision:LayerRevision;
    readonly x:number;readonly y:number;readonly width:number;readonly height:number;
    readonly effect:LayerEffect|undefined;
}
interface LayerProgram {
    readonly program:WebGLProgram;
    readonly origin:WebGLUniformLocation|null;
    readonly extent:WebGLUniformLocation|null;
    readonly viewport:WebGLUniformLocation|null;
    readonly texture:WebGLUniformLocation|null;
    readonly effect: {
        readonly min:WebGLUniformLocation|null;
        readonly max:WebGLUniformLocation|null;
        readonly scaleRG:WebGLUniformLocation|null;
        readonly scaleBAddR:WebGLUniformLocation|null;
        readonly addGB:WebGLUniformLocation|null;
    }|undefined;
}
type LayerInput={readonly write:LayerWrite}|{readonly placements:readonly SharedWebGL2LayerPlacement2D[]};
interface PreparedRecord {
    layerWrite:LayerWrite|undefined;layerReads:LayerRead[]|undefined;
    storage:SharedSubmissionStorage2D;arena:SharedWebGL2ArenaPlan;batch:PreparedSharedBatchPlan2D;
    canonicalBytes:number;projections:(Uint8Array<ArrayBuffer>|undefined)[];ticket:Ticket|undefined;
    hits:Map<number,Page>;scene:PreparedSharedGLScene|undefined;
}
interface RecordLayout {
    vertex:number;uniform:number;color:number;depth:number;effectTargets:number[];effectUniforms:number[];
    meshes:{mesh:PreparedSharedGLScene['meshes'][number];vertex:number;index:number}[];
    pageTextures:Map<number,Page>;
}
interface UploadSignal {
    readonly source:CancellationSignal;readonly add:CancellationSignal['addEventListener'];readonly remove:CancellationSignal['removeEventListener'];
    readonly token:object;listener:()=>void;subscribed:boolean;aborted:boolean;failure:Error|undefined;control:UploadControl|undefined;
}
interface UploadControl {
    readonly token:object;readonly generation:number;readonly frameId:number;readonly end:number;
    readonly ready:ReturnType<typeof deferred<SharedFrameUploadReady>>;
    record:Record2D|undefined;signal:UploadSignal|undefined;timer:ReturnType<typeof schedule>|undefined;
    phase:'admitted'|'uploading'|'ready'|'submitted'|'retired';transferred:boolean;revoked:boolean;failure:Error|undefined;
}
type UploadWrite = {kind:'page';page:Page;pixels:Uint8Array<ArrayBuffer>;row:number}
    | {kind:'buffer';target:number;lease:number;offset:number;data:Float32Array<ArrayBuffer>|Uint32Array<ArrayBuffer>|Uint8Array<ArrayBuffer>;unit:number;cursor:number};
interface UploadWork {
    readonly control:UploadControl;readonly requests:KeyedRetentionRequest<Request>[];
    readonly plan:LedgerPlan<Request,GLNativeOwner>;readonly layout:RecordLayout;
    readonly writes:UploadWrite[];
    claimed:boolean;allocated:boolean;writeIndex:number;
}
interface StageInput {readonly options:SharedFrameUploadOptions|undefined;readonly token:object;readonly end:number;signal:UploadSignal|undefined;}
interface Record2D {
    serial:number;readonly generation:number;readonly storage:SharedSubmissionStorage2D;
    readonly arena:SharedWebGL2ArenaPlan;readonly batch:PreparedSharedBatchPlan2D;
    readonly canonicalBytes:number; reservedPageBytes:number; projections:(Uint8Array<ArrayBuffer>|undefined)[];
    readonly done:ReturnType<typeof deferred<void>>;readonly leases:Lease[];readonly pages:Page[];
    readonly native:GLNativeSession;readonly pool:RetentionLedger<Request,GLNativeOwner>;
    readonly scene:PreparedSharedGLScene|undefined;
    readonly rawOwners:GLNativeOwner[];
    readback:SharedWebGL2Readback|undefined;
    ticket:Ticket|undefined;pbo:GLNativeOwner|undefined;sync:GLNativeOwner|undefined;
    failure:unknown;retired:boolean;deadline:number;
    layerWrite?:LayerWrite;
    layerReads?:LayerRead[];
    upload?:UploadWork;
    completion?:ReturnType<typeof deferred<void>>;
}
interface Limits {texture:number;renderbuffer:number;viewportWidth:number;viewportHeight:number;alignment:number;}

class SharedGLHost implements SharedLayerWebGL2Host {
    public readonly surface:HTMLCanvasElement;
    public readonly sharedFrameProfile = SHARED_FRAME_PROFILE_2D;
    private readonly options:SharedWebGL2Configuration;
    private readonly callback:((event:WebGL2HostDiagnostic)=>unknown)|undefined;
    private state:WebGL2HostState = 'new';
    private generation = 0;
    private attempt = 0;
    private serial = 0;
    private firstFailure:WebGL2HostFailure|null = null;
    private generationFailure:WebGL2HostFailure|null = null;
    private callbackFailureCount = 0;
    private lastCallbackFailure:WebGL2HostFailure|null = null;
    private cleanupOutcome:WebGL2HostStatus['cleanupOutcome'] = 'not-started';
    private ready:ReturnType<typeof deferred<void>>|undefined;
    private starting:Promise<void>|undefined;
    private closing:Promise<void>|undefined;
    private cpu = deferred<void>();
    private busy = false;
    private phase:'initialize'|'render'|'upload'|'poll'|undefined;
    private uploading:Record2D|undefined;
    private token:object = {};
    private lossToken:object|undefined;
    private native:GLNativeSession|undefined;
    private context:WebGL2RenderingContext|undefined;
    private lostNative:(()=>boolean)|undefined;
    // Fixed-size observations only; original records/native owners still authorize every transition.
    private readonly frameTiming: ReturnType<typeof createFrameTiming> | undefined;
    private readonly resourceCpu:SharedPageCopyDiagnostics2D={canonicalBytes:0,scratchBytes:0,highCanonicalBytes:0,highScratchBytes:0,highTemporaryBytes:0,saturated:false};
    private readonly resourceUnknown:NativeUnknownDiagnostics={knownLogicalBytes:0,objects:0,highKnownLogicalBytes:0,highObjects:0,saturated:false};
    private readonly resourceReuse:RetentionLedgerDiagnostics={current:{idleBytes:0,idleEntries:0,leasedBytes:0,leasedEntries:0,reservedBytes:0,reservedEntries:0,detachedBytes:0,detachedEntries:0,unknownBytes:0,unknownEntries:0},highWater:{idleBytes:0,idleEntries:0,leasedBytes:0,leasedEntries:0,reservedBytes:0,reservedEntries:0,detachedBytes:0,detachedEntries:0,unknownBytes:0,unknownEntries:0},saturated:false,unknownNative:this.resourceUnknown};
    private readonly resourceHighPending={frames:0,uploadCreditBytes:0,pageCreditBytes:0,readbackCreditBytes:0,geometryCreditBytes:0,colorCreditBytes:0,sceneCreditBytes:0,uniformCreditBytes:0,depthCreditBytes:0};
    private readonly resourceHighImages={readyBytes:0,readyEntries:0,pinnedReadyBytes:0,pinnedReadyEntries:0,allocatedLogicalBytes:0,reservedCreditBytes:0};
    private readonly resourceTotals={pageWriteCalls:0,pageWriteBytes:0,readyCapacityEvictions:0};
    private resourceSaturated=false;
    private resourceReadyBytes=0;
    private resourcePinnedBytes=0;
    private resourcePinnedEntries=0;
    private readonly resourceNative:GLNativeResourceDiagnostics={pageBytes:0,highPageBytes:0,reservedPageBytes:0,highReservedPageBytes:0,unknown:this.resourceUnknown,totals:this.resourceTotals,saturated:false};
    private pool = createRetentionLedger<Request,GLNativeOwner>(this.token,this.resourceReuse);
    private readonly scratch = new PreparedBatchScratch2D();
    private readonly records = new Set<Record2D>();
    private readonly settledHandles = new WeakSet<object>();
    private readonly pages = new Map<ImageData2D,Page>();
    private readonly layers=new Map<SharedWebGL2Layer2D,LayerSlot>();
    private readonly layerGarbage=new Set<LayerRevision>();
    private layerBytes=0;
    private layerProgram:LayerProgram|undefined;
    private layerEffectProgram:LayerProgram|undefined;
    private ticket:Ticket|undefined;
    private limits:Limits|undefined;
    private framebuffer:WebGLFramebuffer|undefined;
    private program:WebGLProgram|undefined;
    private effectPrograms=new Map<SharedEffectPass,WebGLProgram>();
    private resolveProgram:WebGLProgram|undefined;
    private drawVAO:WebGLVertexArrayObject|undefined;
    private resolveVAO:WebGLVertexArrayObject|undefined;
    private sceneVAO:WebGLVertexArrayObject|undefined;
    private sceneProgram:WebGLProgram|undefined;
    private sceneCardProgram:{program:WebGLProgram;page:WebGLUniformLocation}|undefined;
    private sceneTextureProgram: {program: WebGLProgram; page: WebGLUniformLocation} | undefined;
    private sceneLambertProgram: {program: WebGLProgram; page: WebGLUniformLocation} | undefined;
    private sceneFunctions:typeof import('./sharedWebGL2Scene.js')|undefined;
    private pump:ReturnType<typeof schedule>|undefined;
    private restoreTimer:ReturnType<typeof schedule>|undefined;
    private restoreDeadline = 0;
    private restoreAttempt = false;
    private removeListeners:(()=>void)|undefined;
    private unsafe = false;
    private retiredUnknownBytes = 0;
    private retiredUnknownObjects = 0;

    public constructor(input:SharedWebGL2HostOptions,private readonly sceneMode=false) {
        try { const admitted = admitSharedWebGL2Options(input,sceneMode); this.surface=admitted.surface;this.options=admitted.configuration;this.callback=admitted.callback;this.frameTiming=admitted.measureSharedFrames?createFrameTiming():undefined; }
        catch(cause) {throw glFailure('WEBGL2_OPTIONS_INVALID',cause);}
        Object.defineProperty(this,'surface',{writable:false,configurable:false});
        Object.defineProperty(this,'sharedFrameProfile',{writable:false,configurable:false});
        if(sceneMode)Object.defineProperties(this,{
            renderSceneSharedFrame:{value:(scene:SceneFrame3D,overlay:SharedRenderFrame2D):undefined=>this.renderOwned(overlay,scene,true),enumerable:true},
            stageSceneSharedFrame:{value:(scene:SceneFrame3D,overlay:SharedRenderFrame2D,options?:SharedFrameUploadOptions):SharedFrameUpload=>this.stageOwned(overlay,scene,true,options),enumerable:true},
            getSceneStatus:{value:()=>{const owner=this.snapshot();return Object.freeze({host:this.getStatus(),pendingSceneBytes:owner.pendingSceneBytes,pendingUniformBytes:owner.pendingUniformBytes,pendingDepthBytes:owner.pendingDepthBytes});},enumerable:true},
        });
        this.cpu.resolve();
    }
    private recordTiming(phase: SharedWebGL2TimingPhase, startMs: number, generation: number, serial: number|null): void {
        const timing=this.frameTiming!, durationMs=clock()-startMs, total=timing.totals[phase];
        if(!Number.isFinite(durationMs)||durationMs<0)return;
        if(total.count<Number.MAX_SAFE_INTEGER){total.count++;total.totalMs+=durationMs;total.maxMs=Math.max(total.maxMs,durationMs);}
        if(timing.samples.length===TIMING_CAPACITY)timing.dropped=Math.min(timing.dropped+1,Number.MAX_SAFE_INTEGER);
        timing.samples[timing.next]={phase,startMs,durationMs,generation,serial};
        timing.next=(timing.next+1)%TIMING_CAPACITY;
    }

    public getSharedFrameTiming(): SharedWebGL2FrameTiming | null {
        const timing=this.frameTiming;
        if(!timing)return null;
        const first=timing.samples.length===TIMING_CAPACITY?timing.next:0;
        const recent=Array.from({length:timing.samples.length},(_,index)=>Object.freeze({...timing.samples[(first+index)%TIMING_CAPACITY]!}));
        const totals=Object.fromEntries(TIMING_PHASES.map(phase=>[phase,Object.freeze({...timing.totals[phase]})])) as SharedWebGL2FrameTiming['totals'];
        return Object.freeze({totals:Object.freeze(totals),recent:Object.freeze(recent),dropped:timing.dropped});
    }

    private reservePageDiagnostics(record:Record2D):void {
        this.resourceNative.reservedPageBytes+=record.reservedPageBytes;
        this.resourceNative.highReservedPageBytes=Math.max(this.resourceNative.highReservedPageBytes,this.resourceNative.reservedPageBytes);
        this.sampleResourcePending();this.sampleResourceImages();
    }
    private pinPageDiagnostics(page:Page):void {
        if(page.pins===0&&this.pages.get(page.source)===page){this.resourcePinnedBytes+=page.source.byteLength;this.resourcePinnedEntries++;this.sampleResourceImages();}
    }
    private sampleResourcePending():void {const owner=this.snapshot();
        this.resourceHighPending.frames=Math.max(this.resourceHighPending.frames,owner.pendingFrames);
        this.resourceHighPending.uploadCreditBytes=Math.max(this.resourceHighPending.uploadCreditBytes,owner.pendingUploadBytes);
        this.resourceHighPending.pageCreditBytes=Math.max(this.resourceHighPending.pageCreditBytes,owner.pendingTextureBytes);
        this.resourceHighPending.readbackCreditBytes=Math.max(this.resourceHighPending.readbackCreditBytes,owner.pendingReadbackBytes);
        this.resourceHighPending.geometryCreditBytes=Math.max(this.resourceHighPending.geometryCreditBytes,owner.pendingGeometryBytes);
        this.resourceHighPending.colorCreditBytes=Math.max(this.resourceHighPending.colorCreditBytes,owner.pendingColorBytes);
        this.resourceHighPending.sceneCreditBytes=Math.max(this.resourceHighPending.sceneCreditBytes,owner.pendingSceneBytes);
        this.resourceHighPending.uniformCreditBytes=Math.max(this.resourceHighPending.uniformCreditBytes,owner.pendingUniformBytes);
        this.resourceHighPending.depthCreditBytes=Math.max(this.resourceHighPending.depthCreditBytes,owner.pendingDepthBytes);
    }
    private sampleResourceImages():void {
        this.resourceHighImages.readyBytes=Math.max(this.resourceHighImages.readyBytes,this.resourceReadyBytes);
        this.resourceHighImages.readyEntries=Math.max(this.resourceHighImages.readyEntries,this.pages.size);
        this.resourceHighImages.pinnedReadyBytes=Math.max(this.resourceHighImages.pinnedReadyBytes,this.resourcePinnedBytes);
        this.resourceHighImages.pinnedReadyEntries=Math.max(this.resourceHighImages.pinnedReadyEntries,this.resourcePinnedEntries);
        this.resourceHighImages.allocatedLogicalBytes=Math.max(this.resourceHighImages.allocatedLogicalBytes,this.resourceNative.pageBytes);
        this.resourceHighImages.reservedCreditBytes=Math.max(this.resourceHighImages.reservedCreditBytes,this.resourceNative.reservedPageBytes);
    }
    private resourceTotal(key:keyof typeof this.resourceTotals,amount:number):void {
        const old=this.resourceTotals[key];
        if(amount>Number.MAX_SAFE_INTEGER-old){this.resourceTotals[key]=Number.MAX_SAFE_INTEGER;this.resourceSaturated=true;}
        else this.resourceTotals[key]=old+amount;
    }
    /** Read-only logical observations; no native call, callback or state transition. */
    private resourceStatus():SharedHostResourceStatus {const owner=this.snapshot();
        return Object.freeze({
            current:Object.freeze({
                pending:Object.freeze({frames:owner.pendingFrames,uploadCreditBytes:owner.pendingUploadBytes,pageCreditBytes:owner.pendingTextureBytes,readbackCreditBytes:owner.pendingReadbackBytes,geometryCreditBytes:owner.pendingGeometryBytes,colorCreditBytes:owner.pendingColorBytes,sceneCreditBytes:owner.pendingSceneBytes,uniformCreditBytes:owner.pendingUniformBytes,depthCreditBytes:owner.pendingDepthBytes}),
                cpu:Object.freeze({canonicalBytes:this.resourceCpu.canonicalBytes,scratchBytes:this.resourceCpu.scratchBytes,temporaryBytes:this.resourceCpu.canonicalBytes+this.resourceCpu.scratchBytes}),
                images:Object.freeze({readyBytes:this.resourceReadyBytes,readyEntries:this.pages.size,pinnedReadyBytes:this.resourcePinnedBytes,pinnedReadyEntries:this.resourcePinnedEntries,allocatedLogicalBytes:this.resourceNative.pageBytes,reservedCreditBytes:this.resourceNative.reservedPageBytes}),
                reusable:Object.freeze({...this.resourceReuse.current}),
                unknownNative:Object.freeze({knownLogicalBytes:this.resourceUnknown.knownLogicalBytes,objects:this.resourceUnknown.objects}),
            }),
            highWater:Object.freeze({
                pending:Object.freeze({...this.resourceHighPending}),
                cpu:Object.freeze({canonicalBytes:this.resourceCpu.highCanonicalBytes,scratchBytes:this.resourceCpu.highScratchBytes,temporaryBytes:this.resourceCpu.highTemporaryBytes}),
                images:Object.freeze({...this.resourceHighImages,allocatedLogicalBytes:this.resourceNative.highPageBytes,reservedCreditBytes:this.resourceNative.highReservedPageBytes}),
                reusable:Object.freeze({...this.resourceReuse.highWater}),
                unknownNative:Object.freeze({knownLogicalBytes:this.resourceUnknown.highKnownLogicalBytes,objects:this.resourceUnknown.highObjects}),
            }),
            totals:Object.freeze({...this.resourceTotals}),
            saturated:this.resourceSaturated||this.resourceCpu.saturated||this.resourceReuse.saturated||this.resourceUnknown.saturated||this.resourceNative.saturated,
        });
    }
    private stateError():Error {
        const code:WebGL2HostErrorCode = this.state==='lost'?'WEBGL2_CONTEXT_LOST':this.state==='restoring'?'WEBGL2_CONTEXT_RESTORING':
            this.state==='stopped'?'WEBGL2_STOPPED':this.state==='closing'||this.state==='closed'?'WEBGL2_CLOSED':this.state==='failed'?'WEBGL2_FAILED':'WEBGL2_NOT_STARTED';
        return glFailure(code,this.generationFailure?.cause);
    }
    private active():void {if(this.state!=='active')throw this.stateError();}
    private generationState(token:object):void {
        if(token!==this.token || this.state==='lost' || this.state==='closed')throw this.stateError();
        if((this.phase==='render'||this.phase==='upload')&&this.state!=='active')throw this.stateError();
        if(this.phase==='upload'&&this.uploading?.upload?.control.revoked)throw this.uploading.upload.control.failure??glFailure('WEBGL2_UPLOAD_ABORTED');
        if(this.phase==='initialize'&&this.state!=='starting'&&this.state!=='restoring')throw this.stateError();
    }
    private generationGate(token:object):void {
        this.generationState(token);
        if(this.lostNative?.()) {this.onLoss();throw glFailure('WEBGL2_CONTEXT_LOST');}
        // The captured native loss observation may itself reenter the Host.
        this.generationState(token);
        if(this.state==='restoring'&&clock()>=this.restoreDeadline)throw glFailure('WEBGL2_RESTORE_TIMEOUT');
    }
    private note(code:WebGL2HostErrorCode,cause:unknown,phase:WebGL2HostFailure['phase'],serial:number|null=null):Error {
        const failure=Object.freeze({code,cause,phase,serial,generation:this.generation});
        this.firstFailure??=failure;this.generationFailure??=failure;
        const callback=this.callback;
        if(callback)queueMicrotask(()=>{
            if(this.state==='closed')return;
            const failed=(fault:unknown):void=>{this.callbackFailureCount=Math.min(Number.MAX_SAFE_INTEGER,this.callbackFailureCount+1);
                this.lastCallbackFailure=Object.freeze({code:'WEBGL2_DIAGNOSTIC_CALLBACK_FAILED',cause:fault,phase:'callback',serial,generation:failure.generation});};
            try{Promise.resolve(callback.call(undefined,Object.freeze({...failure,severity:'error' as const}))).catch(failed);}catch(fault){failed(fault);}
        });
        return glFailure(code,cause);
    }
    private rejectUnbound(cause:unknown):void {if(this.ticket&&!this.ticket.bound){this.ticket.reject(cause);this.ticket=undefined;}}
    public start():Promise<void> {
        if(this.state==='starting'||this.state==='active')return this.starting!;
        if(this.state!=='new'){const result=deferred<void>();result.reject(this.stateError());return result.promise;}
        this.state='starting';this.ready=deferred<void>();this.starting=this.ready.promise;
        // Store the public barrier before any externally controlled canvas method.
        queueMicrotask(()=>{void this.initialize(false);});return this.starting;
    }
    public whenReady():Promise<void> {
        if(this.state==='starting'||this.state==='active'||this.state==='lost'||this.state==='restoring')return this.ready!.promise;
        const result=deferred<void>();result.reject(this.stateError());return result.promise;
    }
    public whenIdle():Promise<void> {
        const result=deferred<void>();
        const refused=this.state!=='active'&&this.state!=='stopped'?this.stateError():undefined;
        Promise.allSettled([...this.records].map(record=>record.done.promise)).then(outcomes=>{
            const first=outcomes.find(row=>row.status==='rejected');
            if(first?.status==='rejected')result.reject(first.reason);else if(refused)result.reject(refused);else result.resolve();
        });
        return result.promise;
    }
    public requestReadback():Promise<SharedWebGL2Readback> {
        const result=deferred<SharedWebGL2Readback>();
        if(this.state!=='active')result.reject(this.stateError());
        else if(!this.options.enableReadback)result.reject(glFailure('WEBGL2_READBACK_DISABLED'));
        else if(this.ticket)result.reject(glFailure('WEBGL2_READBACK_PENDING'));
        else this.ticket={...result,bound:false};
        return result.promise;
    }
    public stop():void {
        if(this.state==='closed'||this.state==='closing'||this.state==='failed'||this.state==='stopped')return;
        this.state='stopped';const failure=glFailure('WEBGL2_STOPPED');
        this.ready?.reject(failure);this.cancelRestore();this.rejectUnbound(failure);this.revokeUploads(failure);
    }
    public setTimeout(callback:()=>void,delayMs:number):()=>void {
        const id=schedule(callback,delayMs);return ()=>cancel(id);
    }
    private cancelRestore():void {if(this.restoreTimer!==undefined){cancel(this.restoreTimer);this.restoreTimer=undefined;}}
    private bindListeners():void {
        const lost=(event:Event):void=>{if(!this.lostNative?.())return;event.preventDefault();this.onLoss();};
        const restored=():void=>{
            if(this.state!=='lost'||this.restoreAttempt||this.lostNative?.())return;
            this.restoreAttempt=true;this.state='restoring';
            void this.cpu.promise.then(()=>this.initialize(true));
        };
        const add=this.surface.addEventListener.bind(this.surface),remove=this.surface.removeEventListener.bind(this.surface);
        let a=false,b=false;
        this.removeListeners=()=>{
            let failure:{cause:unknown}|undefined;
            // Listener cleanup is independent: one failing removal cannot skip the other.
            if(a){a=false;try{remove('webglcontextlost',lost);}catch(cause){failure={cause};}}
            if(b){b=false;try{remove('webglcontextrestored',restored);}catch(cause){failure??={cause};}}
            if(failure)throw failure.cause;
        };
        a=true;add('webglcontextlost',lost);b=true;add('webglcontextrestored',restored);
    }
    private onLoss():void {
        if(this.state==='closed'||this.state==='lost'||this.lossToken===this.token)return;
        const wasClosing=this.state==='closing',wasStopped=this.state==='stopped';
        const canRestore=this.state==='active'||this.state==='restoring';
        this.lossToken=this.token;
        const cause=this.note('WEBGL2_CONTEXT_LOST',undefined,'context');
        this.native?.lose();
        for(const slot of this.layers.values())this.dropLayer(slot);
        this.pool.invalidate();this.pages.clear();this.resourceReadyBytes=0;this.resourcePinnedBytes=0;this.resourcePinnedEntries=0;this.sampleResourceImages();this.rejectUnbound(cause);
        for(const handle of this.pool.detachIdleForClose())if(!this.settledHandles.has(handle)){
            this.pool.settled(handle,'context-invalidated');this.settledHandles.add(handle);
        }
        for(const record of this.records)record.failure??=cause;
        if(canRestore&&!this.unsafe){
            this.ready?.reject(cause);this.cancelRestore();
            this.state='lost';this.ready=deferred<void>();this.restoreAttempt=false;this.restoreDeadline=clock()+this.options.restoreTimeoutMs;
            this.restoreTimer=schedule(()=>{
                this.restoreTimer=undefined;
                if(this.state!=='lost'&&this.state!=='restoring')return;
                const failure=this.note('WEBGL2_RESTORE_TIMEOUT',undefined,'restore');this.state='failed';this.ready!.reject(failure);
            },this.options.restoreTimeoutMs);
        }else{this.state=wasClosing?'closing':wasStopped?'stopped':'failed';this.ready?.reject(cause);this.cancelRestore();}
        this.revokeUploads(cause);
        if(!this.busy){this.retireLost();this.sweepLayers();}
    }
    private retireLost():void {for(const record of [...this.records])if(record.native.invalidated)this.retire(record);}
    private async initialize(restoring:boolean):Promise<void> {
        const barrier=this.ready!;
        this.busy=true;this.cpu=deferred<void>();this.phase='initialize';
        try{
            if((restoring&&this.state!=='restoring')||(!restoring&&this.state!=='starting'))throw this.stateError();
            if(restoring&&(clock()>=this.restoreDeadline||this.records.size||this.unsafe))throw glFailure('WEBGL2_RESTORE_TIMEOUT');
            if(this.generation>=Number.MAX_SAFE_INTEGER||(restoring&&this.attempt>=Number.MAX_SAFE_INTEGER))throw glFailure('WEBGL2_GENERATION_EXHAUSTED');
            if(restoring)this.attempt++;
            // Fixed native handles never cross a context generation, including partial startup.
            this.framebuffer=undefined;this.program=undefined;this.resolveProgram=undefined;this.layerProgram=undefined;this.layerEffectProgram=undefined;this.effectPrograms.clear();
            this.drawVAO=undefined;this.resolveVAO=undefined;this.sceneVAO=undefined;this.sceneProgram=undefined;this.sceneCardProgram=undefined;this.sceneTextureProgram=undefined;this.sceneLambertProgram=undefined;
            this.limits=undefined;this.native=undefined;
            this.generation++;this.token={};const token=this.token;
            this.pool=createRetentionLedger<Request,GLNativeOwner>(token,this.resourceReuse);
            if(this.sceneMode){this.sceneFunctions=await import('./sharedWebGL2Scene.js');this.generationGate(token);}
            const context=this.surface.getContext('webgl2',ATTRIBUTES) as WebGL2RenderingContext|null;
            if(!context)throw glFailure('WEBGL2_CONTEXT_UNAVAILABLE');
            this.context=context;
            this.lostNative=context.isContextLost.bind(context);
            this.generationGate(token);
            if(!restoring)this.bindListeners();
            const generation=this.generation;
            const native=new GLNativeSession(context,()=>this.generationGate(token),this.resourceNative,
                this.frameTiming?(phase,started,serial)=>this.recordTiming(phase,started,generation,serial):undefined);
            this.native=native;
            const gl=native.gl,attrs=gl.getContextAttributes();
            if(context.canvas!==this.surface||!attrs||Object.entries(ATTRIBUTES).some(([key,value])=>(attrs as unknown as Record<string,unknown>)[key]!==value))throw glFailure('WEBGL2_CONTEXT_ATTRIBUTES_UNSUPPORTED');
            // Explicitly request the one supported drawing-buffer color space when exposed.
            if('drawingBufferColorSpace' in context){context.drawingBufferColorSpace='srgb';this.generationGate(token);if(context.drawingBufferColorSpace!=='srgb')throw glFailure('WEBGL2_FORMAT_UNSUPPORTED');}
            const integer=(name:number,min:number):number=>{const value:unknown=gl.getParameter(name);if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min)throw glFailure('WEBGL2_CONTEXT_LIMIT');return value;};
            const alignment=integer(gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT,4);try{qualifySharedWebGL2Alignment(alignment);}catch(cause){throw glFailure('WEBGL2_CONTEXT_LIMIT',cause);}
            integer(gl.MAX_UNIFORM_BLOCK_SIZE,this.options.enableEffects?448:128);integer(gl.MAX_UNIFORM_BUFFER_BINDINGS,1);integer(gl.MAX_VERTEX_UNIFORM_BLOCKS,1);integer(gl.MAX_FRAGMENT_UNIFORM_BLOCKS,1);integer(gl.MAX_TEXTURE_IMAGE_UNITS,this.options.enableEffects?2:1);integer(gl.MAX_VERTEX_ATTRIBS,4);
            const dims=gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
            if(!dims||dims.length!==2||![dims[0],dims[1]].every(n=>n!==undefined&&Number.isSafeInteger(n)&&n>0))throw glFailure('WEBGL2_CONTEXT_LIMIT');
            this.limits={alignment,texture:integer(gl.MAX_TEXTURE_SIZE,1),renderbuffer:integer(gl.MAX_RENDERBUFFER_SIZE,1),viewportWidth:dims[0]!,viewportHeight:dims[1]!};
            for(const type of [gl.VERTEX_SHADER,gl.FRAGMENT_SHADER]){const p=gl.getShaderPrecisionFormat(type,gl.HIGH_FLOAT);if(!p||p.precision<23||p.rangeMin<126||p.rangeMax<127)throw glFailure('WEBGL2_CONTEXT_LIMIT');}
            gl.bindFramebuffer(gl.FRAMEBUFFER,null);native.attachment(false);
            this.framebuffer=native.create('Framebuffer').value as WebGLFramebuffer;
            const target=native.create('Texture',4);native.reset(1,1);native.texture(target,1,1,true);
            gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.value as WebGLTexture,0);
            native.attachment(true);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,null,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
            if(!native.cleanup(target))throw glFailure('WEBGL2_CLOSE_UNSAFE',native.cleanupFailure?.cause);
            this.program=native.program(sharedWebGL2VertexSource,sharedWebGL2FragmentSource);
            native.block(this.program,'DrawUniform',['viewportOpacity','materialLight','materialDark','logicalTrim','contentOrigin','packedTurnDomain','samplerPolicy','pageExecution'],128);
            this.resolveProgram=native.program(sharedWebGL2ResolveVertexSource,sharedWebGL2ResolveFragmentSource);
            if(this.options.enableEffects)for(const mode of EFFECT_PASSES){
                const program=native.program(sharedWebGL2ResolveVertexSource,sharedEffectGLSL(mode));
                const index=gl.getUniformBlockIndex(program,'Effect');if(index===gl.INVALID_INDEX)throw glFailure('WEBGL2_CONTEXT_LIMIT');
                gl.uniformBlockBinding(program,index,0);this.effectPrograms.set(mode,program);
            }
            this.drawVAO=native.create('VertexArray').value as WebGLVertexArrayObject;
            this.resolveVAO=native.create('VertexArray').value as WebGLVertexArrayObject;
            if(this.sceneFunctions){
                this.sceneProgram=native.program(this.sceneFunctions.SHARED_GL_SCENE_VERTEX,this.sceneFunctions.SHARED_GL_SCENE_FRAGMENT);
                native.block(this.sceneProgram,'SceneDraw',['uMVP'],64);
                const index=gl.getUniformIndices(this.sceneProgram,['uMVP'])!;
                if((gl.getActiveUniforms(this.sceneProgram,index,35389) as number[])[0]!==16||(gl.getActiveUniforms(this.sceneProgram,index,35390) as boolean[])[0]!==false)throw glFailure('WEBGL2_CONTEXT_LIMIT');
                this.sceneVAO=native.create('VertexArray').value as WebGLVertexArrayObject;
            }
            native.check();this.generationGate(token);
            this.state='active';this.generationFailure=null;this.cancelRestore();barrier.resolve();
        }catch(cause){
            // A distinct attempted generation may already own a new recovery barrier.
            // This cancelled attempt can settle only the barrier captured on entry.
            if(this.state==='lost'&&this.ready!==barrier){barrier.reject(glFailure('WEBGL2_CONTEXT_LOST',cause));return;}
            const code=isGLFailure(cause)?cause.code as WebGL2HostErrorCode:restoring?'WEBGL2_RESTORE_FAILED':'WEBGL2_START_FAILED';
            const failure=this.note(code,isGLFailure(cause)?cause.cause:cause,restoring?'restore':'startup');
            if(this.state!=='closing'&&this.state!=='closed'&&this.state!=='stopped')this.state='failed';
            this.cancelRestore();barrier.reject(failure);
        }finally{this.phase=undefined;this.busy=false;this.retireLost();this.cpu.resolve();}
    }
    private snapshot():SharedOwnerSnapshot2D {
        const owner:SharedOwnerSnapshot2D={pendingFrames:this.records.size,pendingUploadBytes:0,pendingReadbackBytes:0,pendingTextureBytes:0,pendingGeometryBytes:0,pendingColorBytes:0,pendingCanonicalBytes:0,pendingSceneBytes:0,pendingUniformBytes:0,pendingDepthBytes:0,serial:this.serial};
        // At most two accepted records; counters derive from their still-owned immutable fees.
        const mutable=owner as {-readonly [K in keyof SharedOwnerSnapshot2D]:SharedOwnerSnapshot2D[K]};
        for(const r of this.records){mutable.pendingUploadBytes+=r.storage.upload;mutable.pendingReadbackBytes+=r.storage.staging+r.storage.output;mutable.pendingTextureBytes+=r.storage.prepared.pageBytes;
            mutable.pendingGeometryBytes+=r.storage.prepared.geometryBytes;mutable.pendingColorBytes+=r.storage.colorBytes+r.storage.effectBytes;mutable.pendingCanonicalBytes+=r.canonicalBytes;
            mutable.pendingSceneBytes+=r.scene?.sceneBytes??0;mutable.pendingUniformBytes+=r.scene?.uniformBytes??0;mutable.pendingDepthBytes+=r.scene?.depthBytes??0;}
        return owner;
    }
    private arenaOwner():{pendingVertexArenaBytes:number;pendingUniformArenaBytes:number} {
        let pendingVertexArenaBytes=0,pendingUniformArenaBytes=0;for(const r of this.records){pendingVertexArenaBytes+=r.arena.vertexBytes;pendingUniformArenaBytes+=r.arena.uniformBytes;}return {pendingVertexArenaBytes,pendingUniformArenaBytes};
    }

    public createSharedLayer2D():SharedWebGL2Layer2D {
        this.active();
        if(this.busy)throw glFailure('WEBGL2_REENTRANT');
        if(this.layers.size>=MAX_LAYER_HANDLES)throw glFailure('WEBGL2_LAYER_BUDGET');
        const slot:LayerSlot={ready:undefined,pending:undefined,wasReady:false,disposed:false};
        const host=this;
        const handle:SharedWebGL2Layer2D=Object.freeze({
            get state(){
                if(slot.disposed||host.state==='closing'||host.state==='closed')return 'disposed';
                if(host.state==='active'&&slot.ready?.owner.outcome==='owned')return 'ready';
                return slot.wasReady?'stale':'empty';
            },
            update:(frame:SharedRenderFrame2D)=>this.updateLayer(slot,frame),
            dispose:()=>this.disposeLayer(handle,slot),
        });
        this.layers.set(handle,slot);
        return handle;
    }
    public getSharedLayerStatus():SharedWebGL2LayerStatus {
        let readyLayers=0,pendingLayers=0;
        for(const slot of this.layers.values()){
            if(slot.ready?.owner.outcome==='owned')readyLayers++;
            if(slot.pending)pendingLayers++;
        }
        return Object.freeze({readyLayers,pendingLayers,residentBytes:this.layerBytes});
    }
    public renderSharedFrameWithLayers(frame:SharedRenderFrame2D,layers:readonly SharedWebGL2LayerPlacement2D[]):undefined {
        return this.renderOwned(frame,undefined,false,undefined,{placements:layers});
    }
    private updateLayer(slot:LayerSlot,frame:SharedRenderFrame2D):Promise<void> {
        const done=deferred<void>();
        const write:LayerWrite={slot,done,submitted:false,revision:undefined};
        try{
            if(slot.disposed)throw glFailure('WEBGL2_LAYER_DISPOSED');
            this.active();
            if(this.busy)throw glFailure('WEBGL2_REENTRANT');
            if(slot.pending)throw glFailure('WEBGL2_LAYER_PENDING');
            slot.pending=write;
            this.renderOwned(frame,undefined,false,undefined,{write});
        }catch(cause){
            if(!write.submitted&&slot.pending===write)slot.pending=undefined;
            done.reject(cause);
        }
        return done.promise;
    }
    private disposeLayer(handle:SharedWebGL2Layer2D,slot:LayerSlot):void {
        if(slot.disposed)return;
        slot.disposed=true;
        this.layers.delete(handle);
        slot.pending?.done.reject(glFailure('WEBGL2_LAYER_DISPOSED'));
        this.dropLayer(slot);
        if(!this.busy){
            this.busy=true;this.cpu=deferred<void>();this.phase='poll';
            try{this.sweepLayers();}
            finally{this.phase=undefined;this.busy=false;this.retireLost();this.cpu.resolve();}
        }
    }
    private dropLayer(slot:LayerSlot):void {
        const revision=slot.ready;
        slot.ready=undefined;
        if(revision){
            revision.retained=false;
            if(revision.pins===0)this.layerGarbage.add(revision);
        }
    }
    private sweepLayers():void {
        for(const revision of this.layerGarbage){
            this.layerGarbage.delete(revision);this.layerBytes-=revision.owner.bytes;
            const native=revision.native;
            if(!native.cleanup(revision.owner)){
                this.unsafe=true;
                const failure=this.note('WEBGL2_CLOSE_UNSAFE',native.cleanupFailure?.cause,'cleanup');
                if(this.state==='active'){this.state='failed';this.revokeUploads(failure);}
            }
            if(native.invalidated&&native===this.native)this.onLoss();
        }
    }
    private readLayers(input:readonly SharedWebGL2LayerPlacement2D[],frameWidth:number,frameHeight:number):LayerRead[] {
        if(!Array.isArray(input))throw glFailure('WEBGL2_LAYER_INVALID');
        const count=input.length;
        if(count>MAX_LAYER_HANDLES)throw glFailure('WEBGL2_LAYER_BUDGET');
        if(!Number.isSafeInteger(count)||count<0)throw glFailure('WEBGL2_LAYER_INVALID');
        const reads:LayerRead[]=[];
        const ratio=this.options.pixelRatio;
        for(let index=0;index<count;index++){
            const item=input[index];
            if(!item||typeof item!=='object')throw glFailure('WEBGL2_LAYER_INVALID');
            const {layer,x,y,width,height,effect}=item;
            const light=effect===undefined?undefined:this.readLayerEffect(effect,frameWidth,frameHeight);
            this.active();
            const slot=this.layers.get(layer);
            if(!slot)throw glFailure('WEBGL2_LAYER_INVALID');
            const revision=slot.ready;
            if(!revision||revision.native!==this.native||revision.owner.outcome!=='owned')throw glFailure('WEBGL2_LAYER_NOT_READY');
            if(typeof x!=='number'||typeof y!=='number'||typeof width!=='number'||typeof height!=='number'||width<=0||height<=0)throw glFailure('WEBGL2_LAYER_INVALID');
            const physicalX=x*ratio,physicalY=y*ratio,physicalWidth=width*ratio,physicalHeight=height*ratio;
            if(![physicalX,physicalY,physicalWidth,physicalHeight,physicalX+physicalWidth,physicalY+physicalHeight]
                .every(value=>Number.isFinite(value)&&Math.abs(value)<=8388608))throw glFailure('WEBGL2_LAYER_INVALID');
            const visibleLight=light&&light.left<physicalX+physicalWidth&&light.right>physicalX&&
                light.top<physicalY+physicalHeight&&light.bottom>physicalY?light:undefined;
            reads.push({revision,x:physicalX,y:physicalY,width:physicalWidth,height:physicalHeight,effect:visibleLight});
        }
        // A later placement getter may have disposed an earlier revision.
        if(reads.some(read=>!read.revision.retained))throw glFailure('WEBGL2_LAYER_NOT_READY');
        return reads;
    }

    private readLayerEffect(input:SharedWebGL2LayerEffect2D,frameWidth:number,frameHeight:number):LayerEffect|undefined {
        if(!this.options.enableEffects||!input||typeof input!=='object')throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
        const {bounds,multiply,add}=input;
        if(!bounds||typeof bounds!=='object')throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
        const {x,y,width,height}=bounds;
        if(typeof x!=='number'||typeof y!=='number'||typeof width!=='number'||typeof height!=='number'||width<=0||height<=0)throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
        const ratio=this.options.pixelRatio,left=x*ratio,top=y*ratio,right=(x+width)*ratio,bottom=(y+height)*ratio;
        if(![left,top,right,bottom].every(value=>Number.isFinite(value)&&Math.abs(value)<=8388608)||
            right<=left||bottom<=top)throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
        const scale=multiply===undefined?undefined:this.readLayerColor(multiply,4);
        const emission=add===undefined?undefined:this.readLayerColor(add,1);
        if((!scale||scale.every(value=>value===1))&&(!emission||emission.every(value=>value===0)))return undefined;
        // Ceil-sized backing buffers can contain centers beyond the logical frame.
        const clippedLeft=Math.max(0,left),clippedTop=Math.max(0,top);
        const clippedRight=Math.min(frameWidth*ratio,right),clippedBottom=Math.min(frameHeight*ratio,bottom);
        if(clippedRight<=clippedLeft||clippedBottom<=clippedTop)return undefined;
        return {left:clippedLeft,top:clippedTop,right:clippedRight,bottom:clippedBottom,
            scale:scale??[1,1,1],emission:emission??[0,0,0]};
    }
    private readLayerColor(input:readonly [number,number,number],max:number):readonly [number,number,number] {
        if(!Array.isArray(input)||input.length!==3)throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
        const rgb=[input[0],input[1],input[2]] as const;
        if(!rgb.every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max))throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
        return rgb;
    }

    private finishLayerRecord(record:Record2D):void {
        for(const read of record.layerReads??[])this.unpinLayer(read.revision);
        const write=record.layerWrite;
        if(!write){this.sweepLayers();return;}
        const {slot,revision}=write;
        let failure=record.failure;
        if(!failure&&slot.disposed)failure=glFailure('WEBGL2_LAYER_DISPOSED');
        if(!failure&&(this.state!=='active'||record.native.invalidated))failure=this.stateError();
        if(!failure&&this.unsafe)failure=glFailure('WEBGL2_CLOSE_UNSAFE',record.native.cleanupFailure?.cause);
        if(!failure&&revision?.owner.outcome!=='owned')failure=glFailure('WEBGL2_RENDER_FAILED');
        if(!failure&&revision){
            // Publish after the completion proof. Readers of the old revision keep their own pins.
            this.dropLayer(slot);revision.retained=true;slot.ready=revision;slot.wasReady=true;
        }
        if(revision)this.unpinLayer(revision);
        this.sweepLayers();
        if(!failure&&this.unsafe)failure=glFailure('WEBGL2_CLOSE_UNSAFE',record.native.cleanupFailure?.cause);
        if(!failure&&(this.state!=='active'||record.native.invalidated))failure=this.stateError();
        slot.pending=undefined;
        if(!failure&&slot.disposed)failure=glFailure('WEBGL2_LAYER_DISPOSED');
        if(failure)write.done.reject(failure);else write.done.resolve();
    }
    private unpinLayer(revision:LayerRevision):void {
        revision.pins--;
        if(revision.pins===0&&!revision.retained)this.layerGarbage.add(revision);
    }

    public renderSharedFrame(input:SharedRenderFrame2D):undefined {
        return this.renderOwned(input);
    }
    public stageSharedFrame(input:SharedRenderFrame2D,options?:SharedFrameUploadOptions):SharedFrameUpload {
        return this.stageOwned(input,undefined,false,options);
    }
    private stageOwned(input:SharedRenderFrame2D,scene:SceneFrame3D|undefined,withScene:boolean,options:SharedFrameUploadOptions|undefined):SharedFrameUpload {
        this.active();if(this.busy)throw glFailure('WEBGL2_REENTRANT');
        return this.renderOwned(input,scene,withScene,{options,token:this.token,end:clock()+10000,signal:undefined});
    }
    private renderOwned(input:SharedRenderFrame2D,sceneInput?:SceneFrame3D,withScene?:boolean,staging?:undefined,layerInput?:LayerInput):undefined;
    private renderOwned(input:SharedRenderFrame2D,sceneInput:SceneFrame3D|undefined,withScene:boolean,staging:StageInput):SharedFrameUpload;
    private renderOwned(input:SharedRenderFrame2D,sceneInput?:SceneFrame3D,withScene=false,staging?:StageInput,layerInput?:LayerInput):undefined|SharedFrameUpload {
        this.active();if(this.busy)throw glFailure('WEBGL2_REENTRANT');
        this.busy=true;this.cpu=deferred<void>();this.phase='render';let batch:PreparedSharedBatchPlan2D|undefined;let materialized=0;
        try{
            let owned:object|undefined;
            let admitted:PreparedRecord;
            try{admitted=runOwnedPreparationScope(()=>{
                const frame=readOwnedSharedFrame(input);if(!frame)throw glFailure('WEBGL2_FRAME_PROFILE_UNSUPPORTED');
                if(withScene&&(!this.sceneFunctions||!this.sceneFunctions.isSceneFrame3D(sceneInput)))throw glFailure('WEBGL2_FRAME_INVALID');
                if(staging)staging.signal=this.captureSignal(staging.options,staging.token);
                const layerWrite=layerInput&&'write' in layerInput?layerInput.write:undefined;
                const layerReads=layerInput&&'placements' in layerInput?this.readLayers(layerInput.placements,frame.width,frame.height):undefined;
                const options=layerWrite?{...this.options,pixelRatio:1}:this.options;
                const alpha=layerWrite?'premultiplied':options.outputAlpha;
                if(frame.outputAlpha!==alpha||frame.outputRepresentation!==(alpha==='opaque'?'egret.srgb-opaque-unorm8/1':'egret.srgb-premultiplied-unorm8/1'))throw glFailure('WEBGL2_FRAME_PROFILE_UNSUPPORTED');
                if(alpha==='opaque'&&frame.clearAlpha!==1)throw glFailure('WEBGL2_FRAME_INVALID');
                if(layerWrite){
                    if(frame.clearAlpha!==0||!Number.isInteger(frame.width)||!Number.isInteger(frame.height)||
                        frame.commands.some(command=>command.kind==='barrier'?command.effect!==undefined:
                            command.kind==='mesh'||frame.materials[command.materialIndex]?.blend!=='normal'))throw glFailure('WEBGL2_LAYER_INVALID');
                    if(frame.width>MAX_LAYER_EXTENT||frame.height>MAX_LAYER_EXTENT||
                        this.layerBytes+frame.width*frame.height*4>MAX_LAYER_BYTES)throw glFailure('WEBGL2_LAYER_BUDGET');
                }
                const width=Math.ceil(frame.width*options.pixelRatio),height=Math.ceil(frame.height*options.pixelRatio);
                if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width>4294967295||height>4294967295||width>Math.floor(options.maxBackingPixels/height))throw glFailure('WEBGL2_BACKING_LIMIT');
                const sceneFees=withScene?this.sceneFunctions!.admitSharedGLScene(sceneInput,width,height):undefined;
                const overlay=prepareSharedDraws2D(frame,width,height,options);
                const attached = sceneFees ? attachSharedSceneSources2D(overlay, sceneFees.frame.cards ?? [], sceneFees.frame.draws) : undefined;
                const prepared=attached?.prepared??overlay,cardViews=attached?.cardViews??[];
                const ticket=!layerWrite&&!staging&&this.ticket&&!this.ticket.bound?this.ticket:undefined;
                const reserve=staging?options.enableReadback:!!ticket;
                const fees=planSharedStorageFees2D(prepared,options,sceneFees),layout=withSharedReadbackLayout2D(fees,{rowPitch:reserve?4*width:0,staging:reserve?fees.colorBytes:0,output:reserve?fees.colorBytes:0});
                const limits=this.limits!;
                if(width>limits.texture||height>limits.texture||width>limits.viewportWidth||height>limits.viewportHeight)throw glFailure('WEBGL2_CONTEXT_LIMIT');
                if(withScene&&(width>limits.renderbuffer||height>limits.renderbuffer))throw glFailure('WEBGL2_CONTEXT_LIMIT');
                const projectionPlan=attached?.projectionPlan??{
                    views:frame.pages.map(({source:image})=>({image,region:{x:0,y:0,width:image.width,height:image.height},byteLength:image.byteLength})),
                    commandViews:[],projectionBytes:prepared.pageBytes,scratchBytes:0,
                };
                if(projectionPlan.views.some(({image})=>image.width>limits.texture||image.height>limits.texture))throw glFailure('WEBGL2_CONTEXT_LIMIT');
                const storage:SharedSubmissionStorage2D={...layout,projectionPlan};
                checkSharedCapacity2D(storage,this.snapshot());
                const scene=withScene?this.sceneFunctions!.prepareSharedGLScene(sceneInput,width,height,cardViews,attached?.textureViews):undefined;this.active();
                const packed=packSharedDraws2D(prepared);this.active();
                const cold=new Set<number>(),hits=new Map<number,Page>();
                const trackPage=(index:number):void=>{
                    const hit=this.pages.get(projectionPlan.views[index]!.image);
                    if(hit?.ready&&hit.generation===this.generation&&hit.native.outcome==='owned')hits.set(index,hit);else cold.add(index);
                };
                for(const draw of packed){if('barrier' in draw||!draw.vertexCount||draw.prepared.pageIndex===undefined)continue;trackPage(draw.prepared.pageIndex);}
                for(const group of prepared.effects.groups)if(group.maskPageIndex!==undefined)trackPage(group.maskPageIndex);
                for(const index of cardViews)trackPage(index);
                for(const index of attached?.textureViews.values()??[])trackPage(index);
                const timingNative=cold.size?this.native:undefined, started=timingNative?.startTiming();
                let pages:ReturnType<typeof materializeSharedPages2D>;
                try{pages=materializeSharedPages2D(storage,cold,this.snapshot(),this.resourceCpu);}
                finally{timingNative?.finishTiming('texture-prepare',started);}
                materialized=pages.canonicalBytes;this.active();
                checkSharedCapacity2D(storage,this.snapshot(),pages.canonicalBytes);
                batch=prepareSharedBatches2D(packed,options.maxUploadBytes,this.scratch);this.active();
                const arena=planSharedWebGL2Arenas(batch.draws,scene?.uniforms??[],limits.alignment);checkSharedWebGL2ArenaCapacity(arena,this.arenaOwner());
                return {storage,arena,batch,...pages,ticket,hits,scene,layerWrite,layerReads};
            },failure=>{owned=failure;});}
            catch(cause){
                if(staging)this.stageLife(staging.token);
                if(this.state!=='active')throw this.stateError();
                if(isGLFailure(cause))throw cause;
                if(cause===owned){
                    if(cause instanceof SharedPreparationError)throw glFailure(cause.reason==='profile'?'WEBGL2_FRAME_PROFILE_UNSUPPORTED':cause.reason==='budget'?'WEBGL2_FRAME_BUDGET':cause.reason==='precision'?'WEBGL2_PRECISION_UNSUPPORTED':'WEBGL2_FRAME_INVALID',cause);
                    if(cause instanceof SharedStorageError2D)throw glFailure(cause.reason==='device'?'WEBGL2_CONTEXT_LIMIT':cause.reason==='backpressure'?'WEBGL2_BACKPRESSURE':cause.reason==='serial'?'WEBGL2_SERIAL_EXHAUSTED':'WEBGL2_FRAME_BUDGET',cause);
                    if(cause instanceof GeometryPreparationError)throw glFailure('WEBGL2_GEOMETRY_RANGE',cause);
                    if(this.sceneFunctions&&cause instanceof this.sceneFunctions.SharedGLScenePreparationError)throw glFailure(cause.reason==='budget'?'WEBGL2_FRAME_BUDGET':cause.reason==='precision'?'WEBGL2_PRECISION_UNSUPPORTED':cause.reason==='backing'?'WEBGL2_BACKING_LIMIT':'WEBGL2_FRAME_INVALID',cause);
                }
                throw glFailure('WEBGL2_FRAME_INVALID',cause);
            }
            return staging?this.admitUpload(admitted,staging):this.submit(admitted);
        }finally{if(!batch?.transferred)this.resourceCpu.canonicalBytes-=materialized;if(batch&&!batch.transferred)this.scratch.release(batch);this.sweepLayers();this.phase=undefined;this.busy=false;this.retireLost();this.cpu.resolve();}
    }
    private planRecord(p:PreparedRecord):{requests:KeyedRetentionRequest<Request>[];plan:LedgerPlan<Request,GLNativeOwner>;layout:RecordLayout} {
        const {width,height}=p.storage.prepared;
        const requests:KeyedRetentionRequest<Request>[]=[];
        const add=(role:Request['role'],byteLength:number):number=>{const id=requests.length;
            const target=role==='color'||role==='depth';
            const request=Object.freeze({id,role,byteLength,width:target?width:0,height:target?height:0});
            requests.push({request,key:role+':'+byteLength+':'+request.width+':'+request.height});return id;};
        const vertex=p.arena.vertexBytes?add('vertex',p.arena.vertexBytes):-1,uniform=p.arena.uniformBytes?add('uniform',p.arena.uniformBytes):-1,color=p.layerWrite?-1:add('color',p.storage.colorBytes);
        const effectTargets=Array.from({length:p.storage.prepared.effects.targetCount},()=>add('color',p.storage.colorBytes));
        const effectUniforms=p.storage.prepared.effects.groups.map(group=>add('uniform',group.uniform.byteLength));
        const depth=p.scene?add('depth',p.scene.depthBytes):-1;
        const meshes=p.scene?.meshes.map(mesh=>({mesh,vertex:mesh.vertexBytes?add('vertex',mesh.vertexBytes):-1,index:mesh.indexBytes?add('index',mesh.indexBytes):-1}))??[];
        const plan=this.pool.plan(requests);
        this.active();checkSharedCapacity2D(p.storage,this.snapshot(),p.canonicalBytes);checkSharedWebGL2ArenaCapacity(p.arena,this.arenaOwner());
        for(const [index,hit] of p.hits)if(this.pages.get(p.storage.projectionPlan.views[index]!.image)!==hit||!hit.ready)throw glFailure('WEBGL2_FRAME_INVALID');
        return {requests,plan,layout:{vertex,uniform,color,depth,meshes,effectTargets,effectUniforms,pageTextures:new Map()}};
    }
    private stageLife(token:object):void {
        this.active();if(token!==this.token)throw glFailure('WEBGL2_UPLOAD_STALE');
    }
    private signalRead<T>(token:object,read:()=>T):T {
        let value:T;
        try{value=read();}catch(cause){this.stageLife(token);throw glFailure('WEBGL2_UPLOAD_OPTIONS_INVALID',cause);}
        this.stageLife(token);return value;
    }
    private captureSignal(options:SharedFrameUploadOptions|undefined,token:object):UploadSignal|undefined {
        if(options===undefined)return undefined;
        if(typeof options!=='object'||options===null)throw glFailure('WEBGL2_UPLOAD_OPTIONS_INVALID');
        const source=this.signalRead(token,()=>options.signal);if(source===undefined)return undefined;
        if(typeof source!=='object'||source===null)throw glFailure('WEBGL2_UPLOAD_OPTIONS_INVALID');
        const aborted=this.signalRead(token,()=>source.aborted);
        if(typeof aborted!=='boolean')throw glFailure('WEBGL2_UPLOAD_OPTIONS_INVALID');
        if(aborted)throw this.abortFailure(source,token);
        const add=this.signalRead(token,()=>source.addEventListener),remove=this.signalRead(token,()=>source.removeEventListener);
        if(typeof add!=='function'||typeof remove!=='function')throw glFailure('WEBGL2_UPLOAD_OPTIONS_INVALID');
        const captured:UploadSignal={source,add,remove,token,listener:()=>undefined,subscribed:false,aborted:false,failure:undefined,control:undefined};
        captured.listener=()=>{
            if(captured.subscribed&&captured.control&&!captured.control.revoked)this.observeAbort(captured);
        };
        return captured;
    }
    private abortFailure(source:CancellationSignal,token:object):Error {
        try{const reason=source.reason;this.stageLife(token);return glFailure('WEBGL2_UPLOAD_ABORTED',reason);}
        catch(cause){this.stageLife(token);return glFailure('WEBGL2_UPLOAD_OPTIONS_INVALID',cause);}
    }
    private observeAbort(signal:UploadSignal):void {
        const control=signal.control;
        if(signal.aborted||control?.revoked||control?.transferred||control?.phase==='retired')return;
        // Latch before a reason getter can recursively deliver another abort.
        signal.aborted=true;if(control)control.revoked=true;
        const ownsSection=!this.busy;
        if(ownsSection){this.busy=true;this.cpu=deferred<void>();this.phase='poll';}
        try{
            let error:Error;
            try{error=this.abortFailure(signal.source,signal.token);}catch(terminal){error=terminal as Error;}
            signal.failure=error;if(control)this.revokeUpload(control,error);
        }
        finally{if(ownsSection){this.phase=undefined;this.busy=false;this.retireLost();this.cpu.resolve();this.schedulePump();}}
    }
    private removeUploadSignal(control:UploadControl):void {
        const signal=control.signal;
        if(!signal?.subscribed)return;
        signal.subscribed=false;
        try{invoke(signal.remove,signal.source,['abort',signal.listener]);}
        catch(cause){
            let error:Error;
            try{this.stageLife(control.token);error=glFailure('WEBGL2_UPLOAD_OPTIONS_INVALID',cause);}
            catch(terminal){error=terminal as Error;}
            control.failure??=error;if(control.record)control.record.failure??=error;control.ready.reject(error);
        }
    }
    private clearUploadAdmission(control:UploadControl):void {
        if(control.timer!==undefined){const timer=control.timer;control.timer=undefined;cancel(timer);}
        this.removeUploadSignal(control);
    }
    private revokeUpload(control:UploadControl,error:Error):void {
        if(control.transferred||control.phase==='retired')return;
        const ownsSection=!this.busy;
        if(ownsSection){this.busy=true;this.cpu=deferred<void>();this.phase='poll';}
        try{
            control.revoked=true;control.failure??=error;
            const record=control.record;if(record)record.failure??=control.failure;
            control.ready.reject(control.failure);this.clearUploadAdmission(control);
            // A running native section always installs its original proof in finally.
            if(record&&ownsSection&&!record.sync)this.retire(record);
            else this.schedulePump();
        }finally{if(ownsSection){this.phase=undefined;this.busy=false;this.retireLost();this.cpu.resolve();this.schedulePump();}}
    }
    private revokeUploads(error:Error):void {
        // Revoke every publication before the first external listener removal.
        const controls=[...this.records].flatMap(record=>!record.retired&&record.upload&&!record.upload.control.transferred?[record.upload.control]:[]);
        for(const control of controls){control.revoked=true;control.failure??=error;control.record!.failure??=control.failure;control.ready.reject(control.failure);}
        for(const control of controls)this.revokeUpload(control,error);
    }
    private admitUpload(p:PreparedRecord,input:StageInput):SharedFrameUpload {
        this.stageLife(input.token);
        const {requests,plan,layout}=this.planRecord(p),native=this.native!;
        const control:UploadControl={token:input.token,generation:this.generation,frameId:p.storage.prepared.frame.frameId,end:input.end,
            ready:deferred<SharedFrameUploadReady>(),record:undefined,signal:input.signal,timer:undefined,phase:'admitted',transferred:false,revoked:false,failure:undefined};
        const record:Record2D={serial:0,generation:this.generation,storage:p.storage,arena:p.arena,batch:p.batch,
            canonicalBytes:p.canonicalBytes,reservedPageBytes:p.canonicalBytes,projections:p.projections,done:deferred<void>(),leases:[],pages:[],native,pool:this.pool,
            scene:p.scene,rawOwners:[],readback:undefined,ticket:undefined,pbo:undefined,sync:undefined,failure:undefined,retired:false,deadline:0};
        record.upload={control,requests,plan,layout,writes:[],claimed:false,allocated:false,writeIndex:0};
        control.record=record;this.records.add(record);p.batch.transferred=true;this.reservePageDiagnostics(record);
        try{
            const signal=input.signal;
            if(signal){
                signal.control=control;signal.subscribed=true;
                try{invoke(signal.add,signal.source,['abort',signal.listener,{once:true}]);}
                catch(cause){this.stageLife(input.token);throw signal.failure??glFailure('WEBGL2_UPLOAD_OPTIONS_INVALID',cause);}
                this.stageLife(input.token);if(signal.failure)throw signal.failure;
                const aborted=this.signalRead(input.token,()=>signal.source.aborted);
                if(typeof aborted!=='boolean')throw glFailure('WEBGL2_UPLOAD_OPTIONS_INVALID');
                if(aborted)this.observeAbort(signal);
                this.stageLife(input.token);if(signal.failure)throw signal.failure;
            }
            if(clock()>=control.end)throw glFailure('WEBGL2_UPLOAD_EXPIRED');
            if(control.failure)throw control.failure;
            record.pool.claim(plan);record.upload.claimed=true;
            for(const lease of plan.leases)record.leases[lease.requestId]=lease;
            // All ready page hits are pinned before any victim is cleaned.
            for(const [index,page] of p.hits){this.pinPageDiagnostics(page);page.pins++;record.pages.push(page);layout.pageTextures.set(index,page);}
            const owner=this;
            const handle=Object.freeze({ready:control.ready.promise,
                submit(this:unknown):SharedFrameSubmission{if(this!==handle)throw glFailure('WEBGL2_UPLOAD_INVALID');return owner.submitUpload(control);},
                dispose(this:unknown):void{if(this!==handle)throw glFailure('WEBGL2_UPLOAD_INVALID');owner.revokeUpload(control,glFailure('WEBGL2_UPLOAD_DISPOSED'));},
            }) as unknown as SharedFrameUpload;
            control.timer=schedule(()=>this.revokeUpload(control,glFailure('WEBGL2_UPLOAD_EXPIRED')),Math.max(0,control.end-clock()));
            this.schedulePump();return handle;
        }catch(cause){
            let error:Error;
            try{this.stageLife(input.token);error=control.failure??(isGLFailure(cause)?cause:glFailure('WEBGL2_UPLOAD_OPTIONS_INVALID',cause));}
            catch(terminal){error=terminal as Error;}
            this.revokeUpload(control,error);this.retire(record);throw error;
        }
    }
    private allocateUpload(record:Record2D):void {
        const work=record.upload!,native=record.native,gl=native.gl,{width,height}=record.storage.prepared;
        for(const victim of work.plan.victims)this.disposeHandle(victim,native,record.pool);
        if(this.unsafe)throw glFailure('WEBGL2_CLOSE_UNSAFE');
        for(const entry of work.requests){if(record.leases[entry.request.id])continue;
            const request=entry.request,owner=native.create(request.role==='color'?'Texture':request.role==='depth'?'Renderbuffer':'Buffer',request.byteLength);
            const lease=record.pool.registerCreated(entry,owner);record.leases[request.id]=lease;owner.accounting='retention';
            if(request.role==='color')native.texture(owner,width,height,true);
            else if(request.role==='depth'){gl.bindRenderbuffer(gl.RENDERBUFFER,owner.value as WebGLRenderbuffer);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT32F,width,height);}
            else{const target=request.role==='vertex'?gl.ARRAY_BUFFER:request.role==='index'?gl.ELEMENT_ARRAY_BUFFER:gl.UNIFORM_BUFFER;gl.bindBuffer(target,owner.value as WebGLBuffer);gl.bufferData(target,request.byteLength,gl.DYNAMIC_DRAW);}
        }
        for(let index=0;index<record.projections.length;index++){
            const pixels=record.projections[index];if(!pixels)continue;
            const source=record.storage.projectionPlan.views[index]!.image,owner=native.create('Texture',source.byteLength,undefined,record);
            const page:Page={source,native:owner,generation:record.generation,ready:false,pins:1};
            record.pages.push(page);work.layout.pageTextures.set(index,page);
            native.texture(owner,source.width,source.height,false);work.writes.push({kind:'page',page,pixels,row:0});
        }
        const buffer=(target:number,lease:number,offset:number,data:Float32Array<ArrayBuffer>|Uint32Array<ArrayBuffer>|Uint8Array<ArrayBuffer>,unit:number):void=>{
            if(data.byteLength)work.writes.push({kind:'buffer',target,lease,offset,data,unit,cursor:0});
        };
        const {vertex,uniform,meshes}=work.layout;
        for(const range of record.arena.sharedRanges){buffer(gl.ARRAY_BUFFER,vertex,range.vertexOffset,range.draw.data,44);buffer(gl.UNIFORM_BUFFER,uniform,range.uniformOffset,range.draw.uniform,128);}
        for(const range of record.arena.sceneRanges)buffer(gl.UNIFORM_BUFFER,uniform,range.uniformOffset,range.uniform,range.uniformSize);
        for(const item of meshes){if(item.vertex>=0)buffer(gl.ARRAY_BUFFER,item.vertex,0,item.mesh.vertices,24);if(item.index>=0)buffer(gl.ELEMENT_ARRAY_BUFFER,item.index,0,item.mesh.indices,4);}
        for(let i=0;i<record.storage.prepared.effects.groups.length;i++)buffer(gl.UNIFORM_BUFFER,work.layout.effectUniforms[i]!,0,record.storage.prepared.effects.groups[i]!.uniform,16);
        work.allocated=true;
    }
    private uploadChunk(record:Record2D):void {
        const work=record.upload!,control=work.control,native=record.native,gl=native.gl;
        if(control.revoked){this.retire(record);return;}
        this.phase='upload';this.uploading=record;native.recordOwners=record.rawOwners;
        control.phase='uploading';let issued=false;
        try{
            this.stageLife(control.token);
            if(clock()>=control.end){this.revokeUpload(control,glFailure('WEBGL2_UPLOAD_EXPIRED'));throw control.failure;}
            issued=true;
            native.reset(record.storage.prepared.width,record.storage.prepared.height);
            if(!work.allocated)this.allocateUpload(record);
            let remaining=4194304;
            while(work.writeIndex<work.writes.length){
                const write=work.writes[work.writeIndex]!;
                if(write.kind==='page'){
                    const {source}=write.page,stride=source.width*4;
                    if(stride>4194304)throw glFailure('WEBGL2_FRAME_BUDGET');
                    const rows=Math.min(source.height-write.row,Math.floor(remaining/stride));if(rows===0)break;
                    gl.bindTexture(gl.TEXTURE_2D,write.page.native.value as WebGLTexture);
                    const bytes=rows*stride,offset=write.row*stride;
                    gl.texSubImage2D(gl.TEXTURE_2D,0,0,write.row,source.width,rows,gl.RGBA,gl.UNSIGNED_BYTE,write.pixels.subarray(offset,offset+bytes));
                    write.row+=rows;remaining-=bytes;if(write.row===source.height)work.writeIndex++;
                }else{
                    const bytes=Math.min(write.data.byteLength-write.cursor,Math.floor(remaining/write.unit)*write.unit);if(bytes===0)break;
                    gl.bindBuffer(write.target,record.leases[write.lease]!.handle.resource.value as WebGLBuffer);
                    const view=new Uint8Array(write.data.buffer,write.data.byteOffset+write.cursor,bytes);
                    gl.bufferSubData(write.target,write.offset+write.cursor,view);write.cursor+=bytes;remaining-=bytes;
                    if(write.cursor===write.data.byteLength)work.writeIndex++;
                }
                if(clock()>=control.end){this.revokeUpload(control,glFailure('WEBGL2_UPLOAD_EXPIRED'));throw control.failure;}
            }
            native.check();
        }catch(cause){
            if(!record.failure){const error=this.note(isGLFailure(cause)?cause.code as WebGL2HostErrorCode:'WEBGL2_RENDER_FAILED',isGLFailure(cause)?cause.cause:cause,'frame');record.failure=error;
                if(this.state==='active'){this.state='failed';this.revokeUploads(error);}else this.revokeUpload(control,error);}
        }finally{
            // Even cancellation after a write needs the real original GL proof.
            this.uploading=undefined;this.phase='poll';
            try{if(issued)this.issueUploadFence(record);else if(record.failure)this.retire(record);}
            finally{native.recordOwners=undefined;}
        }
    }
    private issueUploadFence(record:Record2D):void {
        const native=record.native;
        if(!native.invalidated){
            try{this.detachContainers(native);record.sync=native.create('Sync');record.deadline=clock()+30000;native.gl.flush();native.check();}
            catch(cause){record.failure??=this.note('WEBGL2_SYNC_FAILED',cause,'frame',record.serial||null);
                if(!native.invalidated){this.unsafe=true;this.markUnknown(record);
                    if(this.state==='active'){this.state='failed';this.revokeUploads(record.failure as Error);}}
                if(record.upload&&!record.upload.control.transferred)this.revokeUpload(record.upload.control,record.failure as Error);}
        }
        if(native.invalidated||!record.sync)this.retire(record);
    }
    private submitUpload(control:UploadControl):SharedFrameSubmission {
        this.stageLife(control.token);if(this.busy)throw glFailure('WEBGL2_REENTRANT');
        if(control.transferred)throw glFailure('WEBGL2_UPLOAD_USED');
        if(clock()>=control.end)this.revokeUpload(control,glFailure('WEBGL2_UPLOAD_EXPIRED'));
        if(control.failure)throw control.failure;
        if(control.phase!=='ready'||!control.record)throw glFailure('WEBGL2_UPLOAD_NOT_READY');
        if(this.serial>=Number.MAX_SAFE_INTEGER)throw glFailure('WEBGL2_SERIAL_EXHAUSTED');
        const record=control.record,work=record.upload!,native=record.native;
        const submitted=native.startTiming();
        this.busy=true;this.cpu=deferred<void>();this.phase='render';
        try{
            this.generationGate(control.token);
            const ticket=this.ticket&&!this.ticket.bound?this.ticket:undefined;
            record.serial=++this.serial;if(this.frameTiming)native.timingSerial=record.serial;record.ticket=ticket;if(ticket)ticket.bound=true;
            record.completion=deferred<void>();control.transferred=true;control.phase='submitted';
            this.clearUploadAdmission(control);native.recordOwners=record.rawOwners;
            let issued=false;
            try{
                // Removal is caller-owned code. Recheck before even reading or
                // resizing the visible target, and unwind unstarted transfer.
                this.stageLife(control.token);if(record.failure)throw record.failure;
                this.generationGate(control.token);issued=true;
                this.prepareSurface(record);this.drawRecord(record,work.layout);
            }catch(cause){
                record.failure??=!issued&&isGLFailure(cause)?cause:this.note(isGLFailure(cause)?cause.code as WebGL2HostErrorCode:'WEBGL2_RENDER_FAILED',isGLFailure(cause)?cause.cause:cause,'frame',record.serial);
                if(this.state==='active'&&(issued||!isGLFailure(cause))){this.state='failed';this.revokeUploads(record.failure as Error);}
            }
            this.phase='poll';if(issued)this.issueUploadFence(record);else this.retire(record);native.recordOwners=undefined;
            this.schedulePump();if(record.failure){record.completion.reject(record.failure);throw record.failure;}
            return Object.freeze({generation:record.generation,frameId:control.frameId,serial:record.serial,completed:record.completion.promise});
        }finally{
            if(submitted!==undefined){native.finishTiming('submit',submitted);native.timingSerial=null;}
            native.recordOwners=undefined;this.phase=undefined;this.busy=false;this.retireLost();this.cpu.resolve();
        }
    }
    private submit(p:PreparedRecord):undefined {
        const native=this.native!,gl=native.gl,{width,height}=p.storage.prepared;
        const {requests,plan,layout}=this.planRecord(p),{vertex,uniform,depth,meshes}=layout;
        const record:Record2D={serial:this.serial+1,generation:this.generation,storage:p.storage,arena:p.arena,batch:p.batch,canonicalBytes:p.canonicalBytes,reservedPageBytes:p.canonicalBytes,projections:p.projections,done:deferred<void>(),leases:[],pages:[],native,pool:this.pool,scene:p.scene,rawOwners:[],readback:undefined,ticket:p.ticket,pbo:undefined,sync:undefined,failure:undefined,retired:false,deadline:clock()+30000};
        for(const lease of plan.leases)record.leases[lease.requestId]=lease;
        this.records.add(record);this.serial=record.serial;p.batch.transferred=true;this.reservePageDiagnostics(record);
        if(p.ticket)p.ticket.bound=true;
        if(p.layerWrite){record.layerWrite=p.layerWrite;p.layerWrite.submitted=true;}
        if(p.layerReads){
            record.layerReads=p.layerReads;
            for(const read of p.layerReads)read.revision.pins++;
        }
        native.recordOwners=record.rawOwners;
        const submitted=native.startTiming();
        if(submitted!==undefined)native.timingSerial=record.serial;
        try{
            this.pool.claim(plan);
            for(const victim of plan.victims)this.disposeHandle(victim,native,this.pool);
            if(this.unsafe)throw glFailure('WEBGL2_CLOSE_UNSAFE');
            for(const entry of requests){if(record.leases[entry.request.id])continue;
                const owner=native.create(entry.request.role==='color'?'Texture':entry.request.role==='depth'?'Renderbuffer':'Buffer',entry.request.byteLength);
                const lease=this.pool.registerCreated(entry,owner);record.leases[entry.request.id]=lease;owner.accounting='retention';
                if(entry.request.role==='color')native.texture(owner,width,height,true);
                else if(entry.request.role==='depth'){gl.bindRenderbuffer(gl.RENDERBUFFER,owner.value as WebGLRenderbuffer);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT32F,width,height);}
                else{const target=entry.request.role==='vertex'?gl.ARRAY_BUFFER:entry.request.role==='index'?gl.ELEMENT_ARRAY_BUFFER:gl.UNIFORM_BUFFER;gl.bindBuffer(target,owner.value as WebGLBuffer);gl.bufferData(target,entry.request.byteLength,gl.DYNAMIC_DRAW);}
            }
            if(record.layerWrite){
                const owner=native.create('Texture',p.storage.colorBytes);
                const revision:LayerRevision={native,owner,pins:1,retained:false};
                record.layerWrite.revision=revision;this.layerBytes+=owner.bytes;
                native.reset(width,height);native.texture(owner,width,height,true);
            }else this.prepareSurface(record);
            const pageTextures=layout.pageTextures;
            for(const [index,hit] of p.hits){this.pinPageDiagnostics(hit);hit.pins++;record.pages.push(hit);pageTextures.set(index,hit);}
            for(let index=0;index<p.projections.length;index++){
                const pixels=p.projections[index];if(!pixels)continue;
                const source=p.storage.projectionPlan.views[index]!.image,owner=native.create('Texture',source.byteLength,undefined,record);
                const page:Page={source,native:owner,generation:this.generation,ready:false,pins:1};record.pages.push(page);pageTextures.set(index,page);
                native.texture(owner,source.width,source.height,false);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,source.width,source.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            }
            if(vertex>=0){gl.bindBuffer(gl.ARRAY_BUFFER,record.leases[vertex]!.handle.resource.value as WebGLBuffer);for(const range of p.arena.sharedRanges)gl.bufferSubData(gl.ARRAY_BUFFER,range.vertexOffset,range.draw.data);}
            if(uniform>=0){gl.bindBuffer(gl.UNIFORM_BUFFER,record.leases[uniform]!.handle.resource.value as WebGLBuffer);for(const range of p.arena.sharedRanges)gl.bufferSubData(gl.UNIFORM_BUFFER,range.uniformOffset,range.draw.uniform);for(const range of p.arena.sceneRanges)gl.bufferSubData(gl.UNIFORM_BUFFER,range.uniformOffset,range.uniform);}
            for(const item of meshes){
                if(item.vertex>=0){gl.bindBuffer(gl.ARRAY_BUFFER,record.leases[item.vertex]!.handle.resource.value as WebGLBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,item.mesh.vertices);}
                if(item.index>=0){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,record.leases[item.index]!.handle.resource.value as WebGLBuffer);gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER,0,item.mesh.indices);}
            }
            for(let i=0;i<record.storage.prepared.effects.groups.length;i++){gl.bindBuffer(gl.UNIFORM_BUFFER,record.leases[layout.effectUniforms[i]!]!.handle.resource.value as WebGLBuffer);gl.bufferSubData(gl.UNIFORM_BUFFER,0,record.storage.prepared.effects.groups[i]!.uniform);}
            this.drawRecord(record,layout);
        }catch(cause){
            record.failure=this.note(isGLFailure(cause)?cause.code as WebGL2HostErrorCode:'WEBGL2_RENDER_FAILED',isGLFailure(cause)?cause.cause:cause,'frame',record.serial);
            if(this.state==='active'){this.state='failed';this.revokeUploads(record.failure as Error);}
        }
        // Even a partially issued draw owns a completion proof before resources can be reused.
        if(!native.invalidated){
            const old=this.phase;this.phase='poll';
            try{this.detachContainers(native);record.sync=native.create('Sync');record.deadline=clock()+30000;gl.flush();native.check();}
            catch(cause){record.failure??=this.note('WEBGL2_SYNC_FAILED',cause,'frame',record.serial);
                if(!native.invalidated){this.unsafe=true;this.markUnknown(record);}}
            finally{this.phase=old;}
        }
        if(submitted!==undefined){native.finishTiming('submit',submitted);native.timingSerial=null;}
        native.recordOwners=undefined;
        if(native.invalidated)this.retireLost();else if(!record.sync)this.retire(record);else this.schedulePump();
        if(record.failure)throw record.failure;
        return undefined;
    }
    private prepareSurface(record:Record2D):void {
        const native=record.native,{width,height}=record.storage.prepared;
            if(this.surface.width!==width)this.surface.width=width;this.generationGate(this.token);
            if(this.surface.height!==height)this.surface.height=height;this.generationGate(this.token);
            if(this.surface.width!==width||this.surface.height!==height)throw new Error('Canvas rejected dimensions');
            if(this.context!.drawingBufferWidth!==width||this.context!.drawingBufferHeight!==height)throw glFailure('WEBGL2_BACKING_LIMIT');
            this.generationGate(this.token);
            native.reset(width,height);
    }

    private drawLayers(record:Record2D,width:number,height:number):void {
        const reads=record.layerReads;
        if(!reads?.length)return;
        const native=record.native,gl=native.gl;
        gl.bindVertexArray(this.resolveVAO!);gl.activeTexture(gl.TEXTURE0);
        gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
        let current:LayerProgram|undefined;
        for(const read of reads){
            const variant=this.getLayerProgram(native,read.effect!==undefined);
            if(current!==variant){
                current=variant;
                gl.useProgram(variant.program);gl.uniform1i(variant.texture,0);gl.uniform2f(variant.viewport,width,height);
            }
            if(read.effect&&variant.effect){
                const {left,top,right,bottom,scale,emission}=read.effect,loc=variant.effect;
                gl.uniform2f(loc.min,left,top);gl.uniform2f(loc.max,right,bottom);
                gl.uniform2f(loc.scaleRG,scale[0],scale[1]);gl.uniform2f(loc.scaleBAddR,scale[2],emission[0]);gl.uniform2f(loc.addGB,emission[1],emission[2]);
            }
            gl.bindTexture(gl.TEXTURE_2D,read.revision.owner.value as WebGLTexture);
            gl.uniform2f(variant.origin,read.x,read.y);gl.uniform2f(variant.extent,read.width,read.height);
            gl.drawArrays(gl.TRIANGLES,0,6);
        }
        gl.bindTexture(gl.TEXTURE_2D,null);
    }


    private getLayerProgram(native:GLNativeSession,effect:boolean):LayerProgram {
        const existing=effect?this.layerEffectProgram:this.layerProgram;
        if(existing)return existing;
        const gl=native.gl,program=native.program(sharedWebGL2LayerVertexSource,
            effect?sharedWebGL2LayerEffectFragmentSource:sharedWebGL2LayerFragmentSource);
        const location=(name:string)=>gl.getUniformLocation(program,name);
        const variant:LayerProgram={program,origin:location('origin'),extent:location('extent'),
            viewport:location('viewportSize'),texture:location('layerTexture'),
            effect:effect?{min:location('effectMin'),max:location('effectMax'),scaleRG:location('multiplyRG'),
                scaleBAddR:location('multiplyBAddR'),addGB:location('addGB')}:undefined};
        if(effect)this.layerEffectProgram=variant;else this.layerProgram=variant;
        return variant;
    }

    private getSceneCardProgram(native:GLNativeSession):NonNullable<SharedGLHost['sceneCardProgram']> {
        if(this.sceneCardProgram)return this.sceneCardProgram;
        const functions=this.sceneFunctions!,gl=native.gl,owners=native.recordOwners;
        // Programs belong to the context generation, including when first used by a staged frame.
        native.recordOwners=undefined;
        try{
            const program=native.program(functions.SHARED_GL_SCENE_CARD_VERTEX,functions.SHARED_GL_SCENE_CARD_FRAGMENT);
            const block=gl.getUniformBlockIndex(program,'SceneCard');
            if(block===gl.INVALID_INDEX||gl.getActiveUniformBlockParameter(program,block,gl.UNIFORM_BLOCK_DATA_SIZE)!==112)throw glFailure('WEBGL2_CONTEXT_LIMIT');
            const indices=gl.getUniformIndices(program,['uCardMVP','uCardBounds','uCardRegion','uCardCutoff']);
            if(!indices||indices.length!==4||indices.some(index=>index===gl.INVALID_INDEX))throw glFailure('WEBGL2_CONTEXT_LIMIT');
            const offsets=gl.getActiveUniforms(program,indices,gl.UNIFORM_OFFSET) as number[];
            if(offsets.length!==4||offsets.some((value,i)=>value!==[0,64,80,96][i]))throw glFailure('WEBGL2_CONTEXT_LIMIT');
            if((gl.getActiveUniforms(program,[indices[0]!],35389) as number[])[0]!==16||(gl.getActiveUniforms(program,[indices[0]!],35390) as boolean[])[0]!==false)throw glFailure('WEBGL2_CONTEXT_LIMIT');
            const page=gl.getUniformLocation(program,'uCardPage');
            if(!page)throw glFailure('WEBGL2_CONTEXT_LIMIT');
            gl.uniformBlockBinding(program,block,0);
            const variant={program,page};
            this.sceneCardProgram=variant;
            return variant;
        }finally{native.recordOwners=owners;}
    }

    private getSceneTextureProgram(native: GLNativeSession, lambert: boolean): NonNullable<SharedGLHost['sceneTextureProgram']> {
        const existing = lambert ? this.sceneLambertProgram : this.sceneTextureProgram;
        if (existing) return existing;
        const functions = this.sceneFunctions!, gl = native.gl, owners = native.recordOwners;
        // The linked program belongs to the context, independently of the frame that first uses it.
        native.recordOwners = undefined;
        try {
            const program = lambert
                ? native.program(functions.SHARED_GL_SCENE_LAMBERT_VERTEX, functions.SHARED_GL_SCENE_LAMBERT_FRAGMENT)
                : native.program(functions.SHARED_GL_SCENE_TEXTURE_VERTEX, functions.SHARED_GL_SCENE_TEXTURE_FRAGMENT);
            const names = lambert ? ['uMVP','uNormal0','uNormal1','uNormal2','uLight'] : ['uMVP'];
            const indices = gl.getUniformIndices(program, names);
            if (!indices || indices.some(index => index === gl.INVALID_INDEX)) throw glFailure('WEBGL2_CONTEXT_LIMIT');
            if (lambert) {
                const block = gl.getUniformBlockIndex(program, 'SceneLambert');
                if (block === gl.INVALID_INDEX || gl.getActiveUniformBlockParameter(program, block, gl.UNIFORM_BLOCK_DATA_SIZE) !== 128) {
                    throw glFailure('WEBGL2_CONTEXT_LIMIT');
                }
                const offsets = gl.getActiveUniforms(program, indices, gl.UNIFORM_OFFSET) as number[];
                if (offsets.length !== names.length || offsets.some((offset, i) => offset !== [0,64,80,96,112][i])) {
                    throw glFailure('WEBGL2_CONTEXT_LIMIT');
                }
                gl.uniformBlockBinding(program, block, 0);
            } else native.block(program, 'SceneDraw', names, 64);
            if ((gl.getActiveUniforms(program, [indices[0]!], 35389) as number[])[0] !== 16
                || (gl.getActiveUniforms(program, [indices[0]!], 35390) as boolean[])[0] !== false) {
                throw glFailure('WEBGL2_CONTEXT_LIMIT');
            }
            const page = gl.getUniformLocation(program, 'uScenePage');
            if (!page) throw glFailure('WEBGL2_CONTEXT_LIMIT');
            const result = {program, page};
            if (lambert) this.sceneLambertProgram = result;
            else this.sceneTextureProgram = result;
            return result;
        } finally {
            native.recordOwners = owners;
        }
    }

    private drawRecord(record:Record2D,layout:RecordLayout):void {
        const native=record.native,gl=native.gl,{width,height,frame}=record.storage.prepared;
        const {vertex,uniform,color,depth,meshes,pageTextures}=layout;
            const colorTexture=(record.layerWrite?.revision?.owner??record.leases[color]!.handle.resource).value as WebGLTexture;
            gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer!);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,colorTexture,0);
            const depthBuffer=depth>=0?record.leases[depth]!.handle.resource.value as WebGLRenderbuffer:null;
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depthBuffer);native.workingAttachment(colorTexture,depthBuffer);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0]);const c=frame.clearColor,a=frame.clearAlpha;
            gl.clearColor(a*decodeSharedSRGB(((c>>>16)&255)/255),a*decodeSharedSRGB(((c>>>8)&255)/255),a*decodeSharedSRGB((c&255)/255),a);gl.clear(gl.COLOR_BUFFER_BIT);
            if(record.scene){
                gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.depthFunc(gl.GREATER);gl.clearDepth(0);gl.clear(gl.DEPTH_BUFFER_BIT);
                gl.useProgram(this.sceneProgram!);gl.bindVertexArray(this.sceneVAO!);
                let activeSceneRole: 'plain' | 'texture' | 'lambert' = 'plain';
                for (let i = 0; i < record.scene.draws.length; i++) {
                    const draw = record.scene.draws[i]!;
                    if (!draw.mesh.indexCount) continue;
                    const item = meshes.find(value => value.mesh === draw.mesh)!;
                    const pageIndex = draw.pageIndex;
                    const textured = pageIndex !== undefined;
                    const role = draw.lambert ? 'lambert' : textured ? 'texture' : 'plain';
                    if (activeSceneRole !== role) {
                        if (activeSceneRole === 'lambert') gl.disableVertexAttribArray(3);
                        activeSceneRole = role;
                        if (textured) {
                            if (draw.lambert) gl.frontFace(gl.CCW);
                            const variant = this.getSceneTextureProgram(native, draw.lambert === true);
                            gl.useProgram(variant.program);
                            gl.activeTexture(gl.TEXTURE0);
                            gl.uniform1i(variant.page, 0);
                        } else {
                            gl.disableVertexAttribArray(2);
                            gl.useProgram(this.sceneProgram!);
                        }
                    }
                    gl.bindBuffer(gl.ARRAY_BUFFER, record.leases[item.vertex]!.handle.resource.value as WebGLBuffer);
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, record.leases[item.index]!.handle.resource.value as WebGLBuffer);
                    const stride = draw.lambert ? 44 : textured ? 32 : 24;
                    for (const [index, offset] of [[0, 0], [1, 12]] as const) {
                        gl.enableVertexAttribArray(index);
                        gl.vertexAttribPointer(index, 3, gl.FLOAT, false, stride, offset);
                        gl.vertexAttribDivisor(index, 0);
                    }
                    if (pageIndex !== undefined) {
                        gl.enableVertexAttribArray(2);
                        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 24);
                        gl.vertexAttribDivisor(2, 0);
                        gl.bindTexture(gl.TEXTURE_2D, pageTextures.get(pageIndex)!.native.value as WebGLTexture);
                    }
                    if (draw.lambert) {
                        gl.enableVertexAttribArray(3);
                        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 32);
                        gl.vertexAttribDivisor(3, 0);
                    }
                    const range = record.arena.sceneRanges[i]!;
                    gl.bindBufferRange(gl.UNIFORM_BUFFER, 0, record.leases[uniform]!.handle.resource.value as WebGLBuffer, range.uniformOffset, range.uniformSize);
                    gl.drawElements(gl.TRIANGLES, draw.mesh.indexCount, gl.UNSIGNED_INT, 0);
                }
                if (activeSceneRole === 'lambert') gl.disableVertexAttribArray(3);
                if (activeSceneRole !== 'plain') gl.disableVertexAttribArray(2);
                if(record.scene.cards.length){
                    const variant=this.getSceneCardProgram(native);
                    gl.useProgram(variant.program);gl.bindVertexArray(this.resolveVAO!);
                    gl.activeTexture(gl.TEXTURE0);gl.uniform1i(variant.page,0);
                    for(let i=0;i<record.scene.cards.length;i++){
                        const card=record.scene.cards[i]!,range=record.arena.sceneRanges[record.scene.draws.length+i]!;
                        gl.bindTexture(gl.TEXTURE_2D,pageTextures.get(card.pageIndex)!.native.value as WebGLTexture);
                        gl.bindBufferRange(gl.UNIFORM_BUFFER,0,record.leases[uniform]!.handle.resource.value as WebGLBuffer,range.uniformOffset,range.uniformSize);
                        gl.drawArrays(gl.TRIANGLES,0,6);
                    }
                }
                gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
            }
            const bindDraw=():void=>{
                gl.activeTexture(gl.TEXTURE0);gl.useProgram(this.program!);gl.bindVertexArray(this.drawVAO!);
                if(vertex>=0){gl.bindBuffer(gl.ARRAY_BUFFER,record.leases[vertex]!.handle.resource.value as WebGLBuffer);
                    for(const [index,size,offset] of [[0,2,0],[1,2,8],[2,4,16],[3,3,32]]){gl.enableVertexAttribArray(index!);gl.vertexAttribPointer(index!,size!,gl.FLOAT,false,44,offset!);gl.vertexAttribDivisor(index!,0);}}
                gl.uniform1i(gl.getUniformLocation(this.program!,'page'),0);gl.enable(gl.BLEND);
            };
            const drawOne=(range:SharedWebGL2ArenaPlan['sharedRanges'][number]):void=>{const draw=range.draw,page=draw.prepared.pageIndex;
                gl.bindTexture(gl.TEXTURE_2D,page===undefined?null:pageTextures.get(page)!.native.value as WebGLTexture);
                gl.bindBufferRange(gl.UNIFORM_BUFFER,0,record.leases[uniform]!.handle.resource.value as WebGLBuffer,range.uniformOffset,128);
                const blend=sharedWebGL2BlendFactors(draw.prepared.material.blend);gl.blendFuncSeparate(...blend);gl.drawArrays(gl.TRIANGLES,range.firstVertex,draw.vertexCount);};
            this.drawLayers(record,width,height);
            bindDraw();
            if(record.storage.prepared.effects.groups.length===0){for(const range of record.arena.sharedRanges)drawOne(range);}
            else{
                const targets=layout.effectTargets.map(id=>record.leases[id]!.handle.resource.value as WebGLTexture);
                const setTarget=(target:WebGLTexture,clear:boolean):void=>{gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer!);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,null);native.workingAttachment(target,null);if(clear){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}};
                const groups=record.storage.prepared.effects.groups,enters=new Map(groups.map(g=>[g.enter,g])),exits=new Map(groups.map(g=>[g.exit,g]));
                const ranges=new Map(record.arena.sharedRanges.map(range=>[range.draw.prepared.command.ordinal,range]));
                const effectPass=(group:PreparedEffect2D,mode:SharedEffectPass,target:WebGLTexture,source:WebGLTexture):void=>{
                    setTarget(target,mode!=='composite');const program=this.effectPrograms.get(mode)!;
                    gl.useProgram(program);gl.bindVertexArray(this.resolveVAO!);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,source);gl.uniform1i(gl.getUniformLocation(program,'sourceTexture'),0);
                    if(mode==='composite'){gl.activeTexture(gl.TEXTURE1);gl.bindSampler(1,null);gl.bindTexture(gl.TEXTURE_2D,group.maskPageIndex===undefined?source:pageTextures.get(group.maskPageIndex)!.native.value as WebGLTexture);gl.uniform1i(gl.getUniformLocation(program,'maskTexture'),1);gl.activeTexture(gl.TEXTURE0);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);}else gl.disable(gl.BLEND);
                    gl.bindBufferRange(gl.UNIFORM_BUFFER,0,record.leases[layout.effectUniforms[groups.indexOf(group)]!]!.handle.resource.value as WebGLBuffer,0,448);gl.drawArrays(gl.TRIANGLES,0,3);
                    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);
                };
                for(const command of frame.commands){const enter=enters.get(command.ordinal),exit=exits.get(command.ordinal);
                    if(enter){setTarget(targets[(enter.depth-1)*2]!,true);bindDraw();}
                    else if(exit){const source=targets[(exit.depth-1)*2]!,scratch=targets[(exit.depth-1)*2+1]!;
                        if(exit.radius>0){effectPass(exit,'horizontal',scratch,source);effectPass(exit,'vertical',source,scratch);}
                        const parent=exit.depth===1?colorTexture:targets[(exit.depth-2)*2]!;
                        effectPass(exit,'composite',parent,source);bindDraw();
                    }else{const range=ranges.get(command.ordinal);if(range)drawOne(range);}
                }
            }
            if(record.layerWrite){native.check();return;}
            gl.disable(gl.BLEND);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.drawBuffers([gl.BACK]);native.attachment(false);
            gl.useProgram(this.resolveProgram!);gl.bindVertexArray(this.resolveVAO!);gl.bindTexture(gl.TEXTURE_2D,colorTexture);
            gl.uniform1i(gl.getUniformLocation(this.resolveProgram!,'workingTexture'),0);gl.uniform1i(gl.getUniformLocation(this.resolveProgram!,'opaque'),this.options.outputAlpha==='opaque'?1:0);gl.drawArrays(gl.TRIANGLES,0,3);
            if(record.ticket){record.pbo=native.create('Buffer',record.storage.staging);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,record.pbo.value as WebGLBuffer);gl.bufferData(gl.PIXEL_PACK_BUFFER,record.storage.staging,gl.STREAM_READ);
                gl.readBuffer(gl.BACK);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,0);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);}
            native.check();
    }
    private disposeHandle(handle:Handle,native:GLNativeSession,pool:RetentionLedger<Request,GLNativeOwner>):void {
        if(this.settledHandles.has(handle))return;
        pool.detach(handle);const safe=native.cleanup(handle.resource);
        if(native.invalidated){native.lose();pool.invalidate();this.onLoss();}
        pool.settled(handle,safe?(handle.resource.outcome==='context-invalidated'?'context-invalidated':'destroyed'):'unknown');
        this.settledHandles.add(handle);
        if(!safe)this.unsafe=true;
    }
    private schedulePump():void {
        if(this.pump!==undefined||![...this.records].some(record=>!record.retired&&(!record.upload||record.sync||record.failure||record.upload.control.phase!=='ready')))return;
        this.pump=schedule(()=>{this.pump=undefined;this.poll();},0);
    }
    private detachContainers(native:GLNativeSession):void {
        const gl=native.gl;
        // Zero offsets explicitly clear fixed VAO references without a placeholder buffer.
        for(const [vao,layout] of [[this.drawVAO,[[0,2],[1,2],[2,4],[3,3]]],[this.sceneVAO,[[0,3],[1,3]]]] as const){
            if(!vao)continue;gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,null);
            for(const [index,size] of layout){gl.disableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(index,0);}
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,null);
        }
        gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,null);
        gl.bindBufferRange(gl.UNIFORM_BUFFER,0,null,0,128);gl.bindBuffer(gl.UNIFORM_BUFFER,null);
        if(this.options.enableEffects){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,null);}
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);
        if(this.framebuffer){gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,null,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,null);}
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(null);
    }
    private poll():void {
        if(this.busy){this.schedulePump();return;}
        this.busy=true;this.cpu=deferred<void>();this.phase='poll';
        let uploaded=false;
        try{for(const record of [...this.records]){
            if(record.retired)continue;
            if(record.native.invalidated){this.retire(record);continue;}
            const work=record.upload;
            if(work&&!work.control.transferred&&!record.sync){
                if(record.failure){this.retire(record);continue;}
                if(work.control.phase!=='ready'&&!uploaded){uploaded=true;this.uploadChunk(record);}
                continue;
            }
            if(!record.sync)continue;
            try{if(clock()>=record.deadline)throw glFailure('WEBGL2_SYNC_TIMEOUT');
                const native=record.native,gl=native.gl,started=native.startTiming();
                let result:number;
                if(started!==undefined)native.timingSerial=record.serial||null;
                try{result=gl.clientWaitSync(record.sync.value as WebGLSync,0,0);}
                finally{native.finishTiming('fence-poll',started);}
                if(result===gl.TIMEOUT_EXPIRED){if(clock()<record.deadline)continue;throw glFailure('WEBGL2_SYNC_TIMEOUT');}
                if(result!==gl.ALREADY_SIGNALED&&result!==gl.CONDITION_SATISFIED)throw glFailure('WEBGL2_SYNC_FAILED',result);
                const checked=native.startTiming();
                try{native.check();}finally{native.finishTiming('completion-error-query',checked);}
                if(clock()>=record.deadline)throw glFailure('WEBGL2_SYNC_TIMEOUT');
                if(work&&!work.control.transferred){
                    const sync=record.sync;record.sync=undefined;
                    if(!record.native.cleanup(sync))throw glFailure('WEBGL2_CLOSE_UNSAFE',record.native.cleanupFailure?.cause);
                    if(record.native.invalidated){record.native.lose();this.onLoss();this.retire(record);continue;}
                    if(record.failure){this.retire(record);continue;}
                    this.stageLife(work.control.token);
                    if(clock()>=work.control.end){this.revokeUpload(work.control,glFailure('WEBGL2_UPLOAD_EXPIRED'));this.retire(record);continue;}
                    if(work.writeIndex===work.writes.length){
                        work.control.phase='ready';
                        work.control.ready.resolve(Object.freeze({generation:record.generation,frameId:work.control.frameId}));
                    }
                    continue;
                }
                if(record.failure)record.completion?.reject(record.failure);else record.completion?.resolve();
                if(record.ticket&&!record.failure){
                    const {width,height,frame}=record.storage.prepared,bytes=new Uint8Array(record.storage.output);
                    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,record.pbo!.value as WebGLBuffer);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,bytes);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);record.native.check();
                    // Flip in place with scalar swaps: no additional full-image or row allocation.
                    const pitch=4*width;for(let y=0;y<Math.floor(height/2);y++)for(let x=0;x<pitch;x++){const a=y*pitch+x,b=(height-1-y)*pitch+x,temp=bytes[a]!;bytes[a]=bytes[b]!;bytes[b]=temp;}
                    if(clock()>=record.deadline)throw glFailure('WEBGL2_SYNC_TIMEOUT');
                    record.readback=Object.freeze({generation:record.generation,serial:record.serial,frameId:frame.frameId,width,height,format:'rgba8unorm',sourceFormat:'rgba8unorm',colorSpace:'srgb',alphaMode:this.options.outputAlpha,bytes});
                }
            }catch(cause){record.failure??=this.note(isGLFailure(cause)?cause.code as WebGL2HostErrorCode:'WEBGL2_READBACK_FAILED',cause,'readback',record.serial||null);
                if(!record.native.invalidated){this.unsafe=true;this.markUnknown(record);}
                if(this.state==='active'){this.state='failed';this.revokeUploads(record.failure as Error);}}
            finally{if(this.frameTiming)record.native.timingSerial=null;}
            this.retire(record);
        }}finally{this.phase=undefined;this.busy=false;this.retireLost();this.cpu.resolve();this.schedulePump();}
    }
    private markUnknown(record:Record2D):void {
        // A failed completion proof keeps every possibly in-use allocation charged.
        record.pool.invalidate();
        for(const lease of record.leases)if(lease&&!this.settledHandles.has(lease.handle)){lease.handle.resource.outcome='unknown';record.native.observeResource(lease.handle.resource);record.pool.settled(lease.handle,'unknown');this.settledHandles.add(lease.handle);}
        for(const owner of record.rawOwners)if(owner.outcome==='owned'){owner.outcome='unknown';record.native.observeResource(owner);}
        for(const page of record.pages){page.native.outcome='unknown';record.native.observeResource(page.native);}
        for(const read of record.layerReads??[]){
            read.revision.owner.outcome='unknown';record.native.observeResource(read.revision.owner);
        }
        if(record.pbo){record.pbo.outcome='unknown';record.native.observeResource(record.pbo);}if(record.sync){record.sync.outcome='unknown';record.native.observeResource(record.sync);}
    }
    private retire(record:Record2D):void {
        if(record.retired)return;record.retired=true;
        const native=record.native,work=record.upload;
        const started=native.startTiming(), previousSerial=native.timingSerial;
        if(started!==undefined)native.timingSerial=record.serial||null;
        if(work){work.control.phase='retired';this.clearUploadAdmission(work.control);}
        try{
            if(work?.claimed)for(const victim of work.plan.victims)this.disposeHandle(victim,native,record.pool);
            if(native.invalidated)record.pool.invalidate();
            if(record.failure||this.state!=='active'||native.invalidated||this.unsafe){
                for(const lease of record.leases)if(lease)this.disposeHandle(lease.handle,native,record.pool);
            }else{
                const returns=record.pool.reserveReturns(record.leases);
                try{record.pool.publishReturns(returns);}catch(cause){for(const handle of record.pool.cancelReturns(returns))this.disposeHandle(handle,native,record.pool);throw cause;}
                for(const handle of returns.transient)this.disposeHandle(handle,native,record.pool);
            }
            for(const page of record.pages){if(this.pages.get(page.source)===page&&page.pins===1){this.resourcePinnedBytes-=page.source.byteLength;this.resourcePinnedEntries--;}page.pins--;this.sampleResourceImages();
                if(!record.failure&&!native.invalidated&&this.state==='active'&&!this.unsafe){
                    const existing=this.pages.get(page.source);
                    if(existing===page)continue; // An existing residence adds no new bytes or entry.
                    if(existing){if(page.pins===0&&!native.cleanup(page.native))this.unsafe=true;continue;}
                    let bytes=0;for(const current of this.pages.values())bytes+=current.source.byteLength;
                    for(const [key,victim] of this.pages){if((this.pages.size<256&&bytes+page.source.byteLength<=33554432)||victim.pins>0)continue;
                        this.pages.delete(key);bytes-=victim.source.byteLength;this.resourceReadyBytes-=victim.source.byteLength;this.resourceTotal('readyCapacityEvictions',1);this.sampleResourceImages();if(!native.cleanup(victim.native))this.unsafe=true;}
                    if(!this.unsafe&&this.pages.size<256&&bytes+page.source.byteLength<=33554432){page.ready=true;this.pages.set(page.source,page);this.resourceReadyBytes+=page.source.byteLength;if(page.pins>0){this.resourcePinnedBytes+=page.source.byteLength;this.resourcePinnedEntries++;}this.sampleResourceImages();}
                    else if(page.pins===0&&!native.cleanup(page.native))this.unsafe=true;
                }else if(page.pins===0){if(this.pages.get(page.source)===page){this.pages.delete(page.source);this.resourceReadyBytes-=page.source.byteLength;this.sampleResourceImages();}if(!native.cleanup(page.native))this.unsafe=true;}
            }
            if(record.pbo&&!native.cleanup(record.pbo))this.unsafe=true;
            if(record.sync&&!native.cleanup(record.sync))this.unsafe=true;
            if(work||record.layerWrite)for(const owner of record.rawOwners){
                // A native create may return an owner and then fail its gate before
                // registration. This original record still owns that raw result.
                if(owner===record.layerWrite?.revision?.owner||owner.accounting==='retention'||record.pages.some(page=>page.native===owner&&(page.pins>0||this.pages.get(page.source)===page)))continue;
                if(!native.cleanup(owner))this.unsafe=true;
            }
        }catch(cause){this.unsafe=true;record.failure??=this.note('WEBGL2_CLOSE_UNSAFE',cause,'cleanup',record.serial);}
        finally{
            if(native.cleanupFailure)this.unsafe=true;
            this.finishLayerRecord(record);
            if(this.unsafe){record.failure??=this.note('WEBGL2_CLOSE_UNSAFE',native.cleanupFailure?.cause,'cleanup',record.serial);
                if(this.state!=='closing'&&this.state!=='closed'&&this.state!=='stopped'){this.state='failed';this.revokeUploads(record.failure as Error);}}
            this.resourceCpu.canonicalBytes-=record.canonicalBytes;this.resourceNative.reservedPageBytes-=record.reservedPageBytes;record.reservedPageBytes=0;record.projections=[];this.scratch.release(record.batch);this.records.delete(record);
            if(record.ticket){if(record.failure)record.ticket.reject(record.failure);else if(record.readback)record.ticket.resolve(record.readback);else record.ticket.reject(glFailure('WEBGL2_READBACK_FAILED'));
                if(this.ticket===record.ticket)this.ticket=undefined;}
            if(record.failure)record.done.reject(record.failure);else record.done.resolve();
            if(record.failure)record.completion?.reject(record.failure);else record.completion?.resolve();
            if(work){
                if(record.failure){work.control.failure??=record.failure as Error;work.control.ready.reject(record.failure);}
                if(work.control.signal)work.control.signal.control=undefined;
                work.control.signal=undefined;work.control.record=undefined;work.writes.length=0;work.layout.pageTextures.clear();
            }
            if(started!==undefined){native.finishTiming('retire',started);native.timingSerial=previousSerial;}
        }
    }
    public close():Promise<void> {
        if(this.closing)return this.closing;
        const barrier=deferred<void>();this.closing=barrier.promise;this.state='closing';this.cleanupOutcome='pending';this.cancelRestore();
        const failure=glFailure('WEBGL2_CLOSED');this.ready?.reject(failure);this.rejectUnbound(failure);this.revokeUploads(failure);
        for(const slot of this.layers.values())this.dropLayer(slot);
        this.layers.clear();
        const cpu=this.cpu.promise;
        void cpu.then(async()=>{
            await Promise.allSettled([...this.records].map(record=>record.done.promise));
            let failure=this.native?.cleanupFailure;
            const attempt=(cleanup:()=>void):void=>{try{cleanup();}catch(cause){this.unsafe=true;failure??={cause};}};
            // Teardown steps are independent; a failed detach must not abandon known owners.
            attempt(()=>{if(this.native&&!this.native.invalidated){try{this.detachContainers(this.native);this.native.check();}catch(cause){if(!this.native.invalidated)throw cause;}}});
            attempt(()=>{for(const handle of this.pool.detachIdleForClose())attempt(()=>this.disposeHandle(handle,this.native!,this.pool));});
            attempt(()=>this.pool.invalidate());this.pages.clear();this.resourceReadyBytes=0;this.resourcePinnedBytes=0;this.resourcePinnedEntries=0;this.sampleResourceImages();
            attempt(()=>this.sweepLayers());
            attempt(()=>{if(this.native&&!this.native.cleanupAll())this.unsafe=true;});
            failure??=this.native?.cleanupFailure;
            attempt(()=>this.removeListeners?.());this.removeListeners=undefined;
            if(this.pump!==undefined){const pump=this.pump;this.pump=undefined;attempt(()=>cancel(pump));}
            this.state='closed';this.cleanupOutcome=this.unsafe?'unsafe':'safe';
            if(this.unsafe)barrier.reject(glFailure('WEBGL2_CLOSE_UNSAFE',failure?.cause));else barrier.resolve();
        });return this.closing;
    }
    public getSessionStatus():SharedDeviceSessionStatus<WebGL2HostFailure> {
        return Object.freeze({state:this.state==='active'?'ready':this.state,generation:this.generation,attempt:this.attempt,
            firstFailure:this.firstFailure,generationFailure:this.generationFailure});
    }
    public getStatus():WebGL2HostStatus {
        const owner=this.snapshot();return Object.freeze({state:this.state,generation:this.generation,lastSerial:this.serial,pendingFrames:owner.pendingFrames,pendingUploadBytes:owner.pendingUploadBytes,pendingReadbackBytes:owner.pendingReadbackBytes,firstFailure:this.firstFailure,generationFailure:this.generationFailure,callbackFailureCount:this.callbackFailureCount,lastCallbackFailure:this.lastCallbackFailure,cleanupOutcome:this.cleanupOutcome});
    }
    public getSharedStatus():SharedWebGL2HostStatus {
        const owner=this.snapshot(),unknown=this.native?.unknown()??{bytes:0,objects:0},retention=this.pool.getStatus();
        return Object.freeze({host:this.getStatus(),pendingGeometryBytes:owner.pendingGeometryBytes,pendingColorBytes:owner.pendingColorBytes,pendingCanonicalBytes:owner.pendingCanonicalBytes,
            resources:this.resourceStatus(),retention:Object.freeze({idleBytes:retention.idleBytes,idleEntries:retention.idleEntries,reservedBytes:retention.reservedBytes,reservedEntries:retention.reservedEntries,unknownBytes:retention.unknownBytes,unknownEntries:retention.unknownEntries,unknownNativeBytes:this.retiredUnknownBytes+unknown.bytes,unknownNativeObjects:this.retiredUnknownObjects+unknown.objects})});
    }
}

/** Explicit compatibility backend; the Engine retains the original shared-frame contract. */
export function createSharedWebGL2Host(options:SharedWebGL2HostOptions):SharedLayerWebGL2Host {return new SharedGLHost(options);}
/** Internal fixed scene assembly, reached only from the separate package entry. */
export function createSharedSceneWebGL2HostInternal(options:SharedSceneWebGL2HostOptions):SharedSceneWebGL2Host {return new SharedGLHost(options,true) as unknown as SharedSceneWebGL2Host;}
