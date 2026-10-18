// SPDX-License-Identifier: Apache-2.0
import { SHARED_FRAME_PROFILE_2D } from '@egret/contracts';
import type { ImageData2D, SharedRenderFrame2D } from '@egret/contracts';
import { readOwnedSharedFrame } from '#egret-textured-frame-state';
import { admitSharedWebGL2Options } from './sharedWebGL2Options.js';
import type { SharedWebGL2HostOptions, SharedSceneWebGL2HostOptions, SharedWebGL2Configuration } from './sharedWebGL2Options.js';
import type { SharedSceneWebGL2Host } from './webgl2Types.js';
import type { SceneFrame3D } from '../rendering/sceneFrame3D.js';
import type { PreparedSharedGLScene } from './sharedWebGL2Scene.js';
import type { SharedWebGL2Host, SharedWebGL2Readback, SharedWebGL2HostStatus, WebGL2HostState, WebGL2HostStatus, WebGL2HostFailure, WebGL2HostErrorCode, WebGL2HostDiagnostic } from './webgl2Types.js';
import { prepareSharedDraws2D, SharedPreparationError } from '../rendering/prepareSharedDraws2D.js';
import { GeometryPreparationError } from '../rendering/prepareRectangles2D.js';
import { packSharedDraws2D } from '../rendering/packSharedDraws2D.js';
import { PreparedBatchScratch2D } from '../rendering/preparedBatches2D.js';
import { prepareSharedBatches2D } from '../rendering/preparedSharedBatches2D.js';
import type { PreparedSharedBatchPlan2D } from '../rendering/preparedSharedBatches2D.js';
import { decodeSharedSRGB } from '../rendering/sharedColor2D.js';
import { runOwnedPreparationScope } from '../rendering/ownedPreparationFailure2D.js';
import { planSharedStorageFees2D, withSharedReadbackLayout2D, checkSharedCapacity2D, materializeSharedPages2D, SharedStorageError2D } from './sharedSubmissionStorage2D.js';
import type { SharedOwnerSnapshot2D, SharedSubmissionStorage2D } from './sharedSubmissionStorage2D.js';
import { planSharedWebGL2Arenas, checkSharedWebGL2ArenaCapacity, qualifySharedWebGL2Alignment } from './sharedWebGL2Arena.js';
import type { SharedWebGL2ArenaPlan } from './sharedWebGL2Arena.js';
import { createRetentionLedger } from './sharedRetentionLedger.js';
import type { RetentionLedger, LedgerLease, LedgerHandle, KeyedRetentionRequest } from './sharedRetentionLedger.js';
import { GLNativeSession, glFailure, isGLFailure } from './webgl2Native.js';
import type { GLNativeOwner } from './webgl2Native.js';
import { sharedWebGL2VertexSource, sharedWebGL2FragmentSource, sharedWebGL2ResolveVertexSource, sharedWebGL2ResolveFragmentSource, sharedWebGL2BlendFactors } from './sharedWebGL2Shaders.js';

function deferred<T>(): {promise:Promise<T>;resolve:(value:T)=>void;reject:(cause:unknown)=>void} {
    let resolve!:(value:T)=>void, reject!:(cause:unknown)=>void;
    const promise = new Promise<T>((a,b)=>{resolve=a;reject=b;}); promise.catch(()=>undefined);
    return {promise,resolve,reject};
}
const schedule = globalThis.setTimeout.bind(globalThis), cancel = globalThis.clearTimeout.bind(globalThis);
const clock = ():number => performance.now();
const ATTRIBUTES = Object.freeze({alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
interface Request { readonly id:number; readonly byteLength:number; readonly role:'vertex'|'uniform'|'color'|'depth'|'index'; readonly width:number; readonly height:number; }
type Lease = LedgerLease<Request,GLNativeOwner>;
type Handle = LedgerHandle<Request,GLNativeOwner>;
type Ticket = ReturnType<typeof deferred<SharedWebGL2Readback>> & {bound:boolean};
interface Page {readonly source:ImageData2D;readonly native:GLNativeOwner;readonly generation:number;ready:boolean;pins:number;}
interface Record2D {
    readonly serial:number;readonly generation:number;readonly storage:SharedSubmissionStorage2D;
    readonly arena:SharedWebGL2ArenaPlan;readonly batch:PreparedSharedBatchPlan2D;
    readonly canonicalBytes:number; projections:(Uint8Array<ArrayBuffer>|undefined)[];
    readonly done:ReturnType<typeof deferred<void>>;readonly leases:Lease[];readonly pages:Page[];
    readonly native:GLNativeSession;readonly pool:RetentionLedger<Request,GLNativeOwner>;
    readonly scene:PreparedSharedGLScene|undefined;
    readonly rawOwners:GLNativeOwner[];
    readback:SharedWebGL2Readback|undefined;
    ticket:Ticket|undefined;pbo:GLNativeOwner|undefined;sync:GLNativeOwner|undefined;
    failure:unknown;retired:boolean;deadline:number;
}
interface Limits {texture:number;renderbuffer:number;viewportWidth:number;viewportHeight:number;alignment:number;}

class SharedGLHost implements SharedWebGL2Host {
    public readonly surface:HTMLCanvasElement;
    public readonly sharedFrameProfile = SHARED_FRAME_PROFILE_2D;
    private readonly options:SharedWebGL2Configuration;
    private readonly callback:((event:WebGL2HostDiagnostic)=>unknown)|undefined;
    private state:WebGL2HostState = 'new';
    private generation = 0;
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
    private phase:'initialize'|'render'|'poll'|undefined;
    private token:object = {};
    private lossToken:object|undefined;
    private native:GLNativeSession|undefined;
    private context:WebGL2RenderingContext|undefined;
    private lostNative:(()=>boolean)|undefined;
    private pool = createRetentionLedger<Request,GLNativeOwner>(this.token);
    private readonly scratch = new PreparedBatchScratch2D();
    private readonly records = new Set<Record2D>();
    private readonly settledHandles = new WeakSet<object>();
    private readonly pages = new Map<ImageData2D,Page>();
    private ticket:Ticket|undefined;
    private limits:Limits|undefined;
    private framebuffer:WebGLFramebuffer|undefined;
    private program:WebGLProgram|undefined;
    private resolveProgram:WebGLProgram|undefined;
    private drawVAO:WebGLVertexArrayObject|undefined;
    private resolveVAO:WebGLVertexArrayObject|undefined;
    private sceneVAO:WebGLVertexArrayObject|undefined;
    private sceneProgram:WebGLProgram|undefined;
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
        try { const admitted = admitSharedWebGL2Options(input,sceneMode); this.surface=admitted.surface;this.options=admitted.configuration;this.callback=admitted.callback; }
        catch(cause) {throw glFailure('WEBGL2_OPTIONS_INVALID',cause);}
        Object.defineProperty(this,'surface',{writable:false,configurable:false});
        Object.defineProperty(this,'sharedFrameProfile',{writable:false,configurable:false});
        if(sceneMode)Object.defineProperties(this,{
            renderSceneSharedFrame:{value:(scene:SceneFrame3D,overlay:SharedRenderFrame2D):undefined=>this.renderOwned(overlay,scene,true),enumerable:true},
            getSceneStatus:{value:()=>{const owner=this.snapshot();return Object.freeze({host:this.getStatus(),pendingSceneBytes:owner.pendingSceneBytes,pendingUniformBytes:owner.pendingUniformBytes,pendingDepthBytes:owner.pendingDepthBytes});},enumerable:true},
        });
        this.cpu.resolve();
    }
    private stateError():Error {
        const code:WebGL2HostErrorCode = this.state==='lost'?'WEBGL2_CONTEXT_LOST':this.state==='restoring'?'WEBGL2_CONTEXT_RESTORING':
            this.state==='stopped'?'WEBGL2_STOPPED':this.state==='closing'||this.state==='closed'?'WEBGL2_CLOSED':this.state==='failed'?'WEBGL2_FAILED':'WEBGL2_NOT_STARTED';
        return glFailure(code,this.generationFailure?.cause);
    }
    private active():void {if(this.state!=='active')throw this.stateError();}
    private generationGate(token:object):void {
        if(token!==this.token || this.state==='lost' || this.state==='closed')throw this.stateError();
        if(this.phase==='render'&&this.state!=='active')throw this.stateError();
        if(this.phase==='initialize'&&this.state!=='starting'&&this.state!=='restoring')throw this.stateError();
        if(this.lostNative?.()) {this.onLoss();throw glFailure('WEBGL2_CONTEXT_LOST');}
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
        this.state='stopped';this.ready?.reject(glFailure('WEBGL2_STOPPED'));this.cancelRestore();this.rejectUnbound(glFailure('WEBGL2_STOPPED'));
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
        this.native?.lose();this.pool.invalidate();this.pages.clear();this.rejectUnbound(cause);
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
        if(!this.busy)this.retireLost();
    }
    private retireLost():void {for(const record of [...this.records])if(record.native.invalidated)this.retire(record);}
    private async initialize(restoring:boolean):Promise<void> {
        const barrier=this.ready!;
        this.busy=true;this.cpu=deferred<void>();this.phase='initialize';
        try{
            if((restoring&&this.state!=='restoring')||(!restoring&&this.state!=='starting'))throw this.stateError();
            if(restoring&&(clock()>=this.restoreDeadline||this.records.size||this.unsafe))throw glFailure('WEBGL2_RESTORE_TIMEOUT');
            if(this.generation>=Number.MAX_SAFE_INTEGER)throw glFailure('WEBGL2_GENERATION_EXHAUSTED');
            // Fixed native handles never cross a context generation, including partial startup.
            this.framebuffer=undefined;this.program=undefined;this.resolveProgram=undefined;
            this.drawVAO=undefined;this.resolveVAO=undefined;this.sceneVAO=undefined;this.sceneProgram=undefined;
            this.limits=undefined;this.native=undefined;
            this.generation++;this.token={};const token=this.token;
            this.pool=createRetentionLedger<Request,GLNativeOwner>(token);
            if(this.sceneMode){this.sceneFunctions=await import('./sharedWebGL2Scene.js');this.generationGate(token);}
            const context=this.surface.getContext('webgl2',ATTRIBUTES) as WebGL2RenderingContext|null;
            if(!context)throw glFailure('WEBGL2_CONTEXT_UNAVAILABLE');
            this.context=context;
            this.lostNative=context.isContextLost.bind(context);
            this.generationGate(token);
            if(!restoring)this.bindListeners();
            const native=new GLNativeSession(context,()=>this.generationGate(token));this.native=native;
            const gl=native.gl,attrs=gl.getContextAttributes();
            if(context.canvas!==this.surface||!attrs||Object.entries(ATTRIBUTES).some(([key,value])=>(attrs as unknown as Record<string,unknown>)[key]!==value))throw glFailure('WEBGL2_CONTEXT_ATTRIBUTES_UNSUPPORTED');
            // Explicitly request the one supported drawing-buffer color space when exposed.
            if('drawingBufferColorSpace' in context){context.drawingBufferColorSpace='srgb';this.generationGate(token);if(context.drawingBufferColorSpace!=='srgb')throw glFailure('WEBGL2_FORMAT_UNSUPPORTED');}
            const integer=(name:number,min:number):number=>{const value:unknown=gl.getParameter(name);if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min)throw glFailure('WEBGL2_CONTEXT_LIMIT');return value;};
            const alignment=integer(gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT,4);try{qualifySharedWebGL2Alignment(alignment);}catch(cause){throw glFailure('WEBGL2_CONTEXT_LIMIT',cause);}
            integer(gl.MAX_UNIFORM_BLOCK_SIZE,128);integer(gl.MAX_UNIFORM_BUFFER_BINDINGS,1);integer(gl.MAX_VERTEX_UNIFORM_BLOCKS,1);integer(gl.MAX_FRAGMENT_UNIFORM_BLOCKS,1);integer(gl.MAX_TEXTURE_IMAGE_UNITS,1);integer(gl.MAX_VERTEX_ATTRIBS,4);
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
            mutable.pendingGeometryBytes+=r.storage.prepared.geometryBytes;mutable.pendingColorBytes+=r.storage.colorBytes;mutable.pendingCanonicalBytes+=r.canonicalBytes;
            mutable.pendingSceneBytes+=r.scene?.sceneBytes??0;mutable.pendingUniformBytes+=r.scene?.uniformBytes??0;mutable.pendingDepthBytes+=r.scene?.depthBytes??0;}
        return owner;
    }
    private arenaOwner():{pendingVertexArenaBytes:number;pendingUniformArenaBytes:number} {
        let pendingVertexArenaBytes=0,pendingUniformArenaBytes=0;for(const r of this.records){pendingVertexArenaBytes+=r.arena.vertexBytes;pendingUniformArenaBytes+=r.arena.uniformBytes;}return {pendingVertexArenaBytes,pendingUniformArenaBytes};
    }
    public renderSharedFrame(input:SharedRenderFrame2D):undefined {
        return this.renderOwned(input);
    }
    private renderOwned(input:SharedRenderFrame2D,sceneInput?:SceneFrame3D,withScene=false):undefined {
        this.active();if(this.busy)throw glFailure('WEBGL2_REENTRANT');
        this.busy=true;this.cpu=deferred<void>();this.phase='render';let batch:PreparedSharedBatchPlan2D|undefined;
        try{
            let owned:object|undefined;
            let admitted:{storage:SharedSubmissionStorage2D;arena:SharedWebGL2ArenaPlan;batch:PreparedSharedBatchPlan2D;canonicalBytes:number;projections:(Uint8Array<ArrayBuffer>|undefined)[];ticket:Ticket|undefined;hits:Map<number,Page>;scene:PreparedSharedGLScene|undefined};
            try{admitted=runOwnedPreparationScope(()=>{
                const frame=readOwnedSharedFrame(input);if(!frame)throw glFailure('WEBGL2_FRAME_PROFILE_UNSUPPORTED');
                if(withScene&&(!this.sceneFunctions||!this.sceneFunctions.isSceneFrame3D(sceneInput)))throw glFailure('WEBGL2_FRAME_INVALID');
                const options=this.options;
                if(frame.outputAlpha!==options.outputAlpha||frame.outputRepresentation!==(options.outputAlpha==='opaque'?'egret.srgb-opaque-unorm8/1':'egret.srgb-premultiplied-unorm8/1'))throw glFailure('WEBGL2_FRAME_PROFILE_UNSUPPORTED');
                if(options.outputAlpha==='opaque'&&frame.clearAlpha!==1)throw glFailure('WEBGL2_FRAME_INVALID');
                const width=Math.ceil(frame.width*options.pixelRatio),height=Math.ceil(frame.height*options.pixelRatio);
                if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width>4294967295||height>4294967295||width>Math.floor(options.maxBackingPixels/height))throw glFailure('WEBGL2_BACKING_LIMIT');
                const sceneFees=withScene?this.sceneFunctions!.admitSharedGLScene(sceneInput,width,height):undefined;
                const prepared=prepareSharedDraws2D(frame,width,height,options),ticket=this.ticket&&!this.ticket.bound?this.ticket:undefined;
                const fees=planSharedStorageFees2D(prepared,options,sceneFees),layout=withSharedReadbackLayout2D(fees,{rowPitch:ticket?4*width:0,staging:ticket?fees.colorBytes:0,output:ticket?fees.colorBytes:0});
                const limits=this.limits!;
                if(width>limits.texture||height>limits.texture||width>limits.viewportWidth||height>limits.viewportHeight)throw glFailure('WEBGL2_CONTEXT_LIMIT');
                if(withScene&&(width>limits.renderbuffer||height>limits.renderbuffer))throw glFailure('WEBGL2_CONTEXT_LIMIT');
                const views=frame.pages.map(page=>{const image=page.source;if(image.width>limits.texture||image.height>limits.texture)throw glFailure('WEBGL2_CONTEXT_LIMIT');return {image,region:{x:0,y:0,width:image.width,height:image.height},byteLength:image.byteLength};});
                const storage:SharedSubmissionStorage2D={...layout,projectionPlan:{views,commandViews:[],projectionBytes:prepared.pageBytes,scratchBytes:0}};
                checkSharedCapacity2D(storage,this.snapshot());
                const scene=withScene?this.sceneFunctions!.prepareSharedGLScene(sceneInput,width,height):undefined;this.active();
                const packed=packSharedDraws2D(prepared);this.active();
                const cold=new Set<number>(),hits=new Map<number,Page>();
                for(const draw of packed){if('barrier' in draw||!draw.vertexCount||draw.prepared.pageIndex===undefined)continue;
                    const index=draw.prepared.pageIndex,source=frame.pages[index]!.source,hit=this.pages.get(source);
                    if(hit?.ready&&hit.generation===this.generation&&hit.native.outcome==='owned')hits.set(index,hit);else cold.add(index);}
                const pages=materializeSharedPages2D(storage,cold,this.snapshot());this.active();
                checkSharedCapacity2D(storage,this.snapshot(),pages.canonicalBytes);
                batch=prepareSharedBatches2D(packed,options.maxUploadBytes,this.scratch);this.active();
                const arena=planSharedWebGL2Arenas(batch.draws,scene?.uniforms??[],limits.alignment);checkSharedWebGL2ArenaCapacity(arena,this.arenaOwner());
                return {storage,arena,batch,...pages,ticket,hits,scene};
            },failure=>{owned=failure;});}
            catch(cause){
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
            return this.submit(admitted);
        }finally{if(batch&&!batch.transferred)this.scratch.release(batch);this.phase=undefined;this.busy=false;this.retireLost();this.cpu.resolve();}
    }
    private submit(p:{storage:SharedSubmissionStorage2D;arena:SharedWebGL2ArenaPlan;batch:PreparedSharedBatchPlan2D;canonicalBytes:number;projections:(Uint8Array<ArrayBuffer>|undefined)[];ticket:Ticket|undefined;hits:Map<number,Page>;scene:PreparedSharedGLScene|undefined}):undefined {
        const native=this.native!,gl=native.gl,{width,height,frame}=p.storage.prepared;
        const requests:KeyedRetentionRequest<Request>[]=[];
        const add=(role:Request['role'],byteLength:number):number=>{const id=requests.length;
            const target=role==='color'||role==='depth';
            const request=Object.freeze({id,role,byteLength,width:target?width:0,height:target?height:0});
            requests.push({request,key:role+':'+byteLength+':'+request.width+':'+request.height});return id;};
        const vertex=p.arena.vertexBytes?add('vertex',p.arena.vertexBytes):-1,uniform=p.arena.uniformBytes?add('uniform',p.arena.uniformBytes):-1,color=add('color',p.storage.colorBytes);
        const depth=p.scene?add('depth',p.scene.depthBytes):-1;
        const meshes=p.scene?.meshes.map(mesh=>({mesh,vertex:mesh.vertexBytes?add('vertex',mesh.vertexBytes):-1,index:mesh.indexBytes?add('index',mesh.indexBytes):-1}))??[];
        const plan=this.pool.plan(requests);
        this.active();checkSharedCapacity2D(p.storage,this.snapshot(),p.canonicalBytes);checkSharedWebGL2ArenaCapacity(p.arena,this.arenaOwner());
        for(const [index,hit] of p.hits)if(this.pages.get(frame.pages[index]!.source)!==hit||!hit.ready)throw glFailure('WEBGL2_FRAME_INVALID');
        const record:Record2D={serial:this.serial+1,generation:this.generation,storage:p.storage,arena:p.arena,batch:p.batch,canonicalBytes:p.canonicalBytes,projections:p.projections,done:deferred<void>(),leases:[],pages:[],native,pool:this.pool,scene:p.scene,rawOwners:[],readback:undefined,ticket:p.ticket,pbo:undefined,sync:undefined,failure:undefined,retired:false,deadline:clock()+30000};
        for(const lease of plan.leases)record.leases[lease.requestId]=lease;
        this.records.add(record);this.serial=record.serial;p.batch.transferred=true;
        if(p.ticket)p.ticket.bound=true;
        native.recordOwners=record.rawOwners;
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
            if(this.surface.width!==width)this.surface.width=width;this.generationGate(this.token);
            if(this.surface.height!==height)this.surface.height=height;this.generationGate(this.token);
            if(this.surface.width!==width||this.surface.height!==height)throw new Error('Canvas rejected dimensions');
            if(this.context!.drawingBufferWidth!==width||this.context!.drawingBufferHeight!==height)throw glFailure('WEBGL2_BACKING_LIMIT');
            this.generationGate(this.token);
            native.reset(width,height);
            const pageTextures=new Map<number,Page>();
            for(const [index,hit] of p.hits){hit.pins++;record.pages.push(hit);pageTextures.set(index,hit);}
            for(let index=0;index<p.projections.length;index++){
                const pixels=p.projections[index];if(!pixels)continue;
                const source=frame.pages[index]!.source,owner=native.create('Texture',source.byteLength);
                const page:Page={source,native:owner,generation:this.generation,ready:false,pins:1};record.pages.push(page);pageTextures.set(index,page);
                native.texture(owner,source.width,source.height,false);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,source.width,source.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            }
            if(vertex>=0){gl.bindBuffer(gl.ARRAY_BUFFER,record.leases[vertex]!.handle.resource.value as WebGLBuffer);for(const range of p.arena.sharedRanges)gl.bufferSubData(gl.ARRAY_BUFFER,range.vertexOffset,range.draw.data);}
            if(uniform>=0){gl.bindBuffer(gl.UNIFORM_BUFFER,record.leases[uniform]!.handle.resource.value as WebGLBuffer);for(const range of p.arena.sharedRanges)gl.bufferSubData(gl.UNIFORM_BUFFER,range.uniformOffset,range.draw.uniform);for(const range of p.arena.sceneRanges)gl.bufferSubData(gl.UNIFORM_BUFFER,range.uniformOffset,range.uniform);}
            for(const item of meshes){
                if(item.vertex>=0){gl.bindBuffer(gl.ARRAY_BUFFER,record.leases[item.vertex]!.handle.resource.value as WebGLBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,item.mesh.vertices);}
                if(item.index>=0){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,record.leases[item.index]!.handle.resource.value as WebGLBuffer);gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER,0,item.mesh.indices);}
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer!);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,record.leases[color]!.handle.resource.value as WebGLTexture,0);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth>=0?record.leases[depth]!.handle.resource.value as WebGLRenderbuffer:null);native.attachment(true);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0]);const c=frame.clearColor,a=frame.clearAlpha;
            gl.clearColor(a*decodeSharedSRGB(((c>>>16)&255)/255),a*decodeSharedSRGB(((c>>>8)&255)/255),a*decodeSharedSRGB((c&255)/255),a);gl.clear(gl.COLOR_BUFFER_BIT);
            if(p.scene){
                gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.depthFunc(gl.GREATER);gl.clearDepth(0);gl.clear(gl.DEPTH_BUFFER_BIT);
                gl.useProgram(this.sceneProgram!);gl.bindVertexArray(this.sceneVAO!);
                for(let i=0;i<p.scene.draws.length;i++){const draw=p.scene.draws[i]!,item=meshes.find(value=>value.mesh===draw.mesh)!;if(!draw.mesh.indexCount)continue;
                    gl.bindBuffer(gl.ARRAY_BUFFER,record.leases[item.vertex]!.handle.resource.value as WebGLBuffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,record.leases[item.index]!.handle.resource.value as WebGLBuffer);
                    for(const [index,offset] of [[0,0],[1,12]]){gl.enableVertexAttribArray(index!);gl.vertexAttribPointer(index!,3,gl.FLOAT,false,24,offset!);gl.vertexAttribDivisor(index!,0);}
                    gl.bindBufferRange(gl.UNIFORM_BUFFER,0,record.leases[uniform]!.handle.resource.value as WebGLBuffer,p.arena.sceneRanges[i]!.uniformOffset,64);gl.drawElements(gl.TRIANGLES,draw.mesh.indexCount,gl.UNSIGNED_INT,0);
                }
                gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
            }
            gl.useProgram(this.program!);gl.bindVertexArray(this.drawVAO!);
            if(vertex>=0){gl.bindBuffer(gl.ARRAY_BUFFER,record.leases[vertex]!.handle.resource.value as WebGLBuffer);
                for(const [index,size,offset] of [[0,2,0],[1,2,8],[2,4,16],[3,3,32]]){gl.enableVertexAttribArray(index!);gl.vertexAttribPointer(index!,size!,gl.FLOAT,false,44,offset!);gl.vertexAttribDivisor(index!,0);}}
            gl.uniform1i(gl.getUniformLocation(this.program!,'page'),0);gl.enable(gl.BLEND);
            for(const range of p.arena.sharedRanges){const draw=range.draw,page=draw.prepared.pageIndex;
                gl.bindTexture(gl.TEXTURE_2D,page===undefined?null:pageTextures.get(page)!.native.value as WebGLTexture);
                gl.bindBufferRange(gl.UNIFORM_BUFFER,0,record.leases[uniform]!.handle.resource.value as WebGLBuffer,range.uniformOffset,128);
                const blend=sharedWebGL2BlendFactors(draw.prepared.material.blend);gl.blendFuncSeparate(...blend);gl.drawArrays(gl.TRIANGLES,range.firstVertex,draw.vertexCount);}
            gl.disable(gl.BLEND);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.drawBuffers([gl.BACK]);native.attachment(false);
            gl.useProgram(this.resolveProgram!);gl.bindVertexArray(this.resolveVAO!);gl.bindTexture(gl.TEXTURE_2D,record.leases[color]!.handle.resource.value as WebGLTexture);
            gl.uniform1i(gl.getUniformLocation(this.resolveProgram!,'workingTexture'),0);gl.uniform1i(gl.getUniformLocation(this.resolveProgram!,'opaque'),this.options.outputAlpha==='opaque'?1:0);gl.drawArrays(gl.TRIANGLES,0,3);
            if(record.ticket){record.pbo=native.create('Buffer',p.storage.staging);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,record.pbo.value as WebGLBuffer);gl.bufferData(gl.PIXEL_PACK_BUFFER,p.storage.staging,gl.STREAM_READ);
                gl.readBuffer(gl.BACK);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,0);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);}
            native.check();
        }catch(cause){
            record.failure=this.note(isGLFailure(cause)?cause.code as WebGL2HostErrorCode:'WEBGL2_RENDER_FAILED',isGLFailure(cause)?cause.cause:cause,'frame',record.serial);
            if(this.state==='active')this.state='failed';
        }
        // Even a partially issued draw owns a completion proof before resources can be reused.
        if(!native.invalidated){
            const old=this.phase;this.phase='poll';
            try{this.detachContainers(native);record.sync=native.create('Sync');record.deadline=clock()+30000;gl.flush();native.check();}
            catch(cause){record.failure??=this.note('WEBGL2_SYNC_FAILED',cause,'frame',record.serial);
                if(!native.invalidated){this.unsafe=true;this.markUnknown(record);}}
            finally{this.phase=old;}
        }
        native.recordOwners=undefined;
        if(native.invalidated)this.retireLost();else if(!record.sync)this.retire(record);else this.schedulePump();
        if(record.failure)throw record.failure;
        return undefined;
    }
    private disposeHandle(handle:Handle,native:GLNativeSession,pool:RetentionLedger<Request,GLNativeOwner>):void {
        if(this.settledHandles.has(handle))return;
        pool.detach(handle);const safe=native.cleanup(handle.resource);
        if(native.invalidated){native.lose();pool.invalidate();this.onLoss();}
        pool.settled(handle,safe?(handle.resource.outcome==='context-invalidated'?'context-invalidated':'destroyed'):'unknown');
        this.settledHandles.add(handle);
        if(!safe)this.unsafe=true;
    }
    private schedulePump():void {if(this.pump!==undefined||this.records.size===0)return;this.pump=schedule(()=>{this.pump=undefined;this.poll();},0);}
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
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);
        if(this.framebuffer){gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,null,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,null);}
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(null);
    }
    private poll():void {
        if(this.busy){this.schedulePump();return;}
        this.busy=true;this.cpu=deferred<void>();this.phase='poll';
        try{for(const record of [...this.records]){
            if(record.native.invalidated){this.retire(record);continue;}
            if(!record.sync)continue;
            try{if(clock()>=record.deadline)throw glFailure('WEBGL2_SYNC_TIMEOUT');
                const gl=record.native.gl,result=gl.clientWaitSync(record.sync.value as WebGLSync,0,0);
                if(result===gl.TIMEOUT_EXPIRED){if(clock()<record.deadline)continue;throw glFailure('WEBGL2_SYNC_TIMEOUT');}
                if(result!==gl.ALREADY_SIGNALED&&result!==gl.CONDITION_SATISFIED)throw glFailure('WEBGL2_SYNC_FAILED',result);
                record.native.check();if(clock()>=record.deadline)throw glFailure('WEBGL2_SYNC_TIMEOUT');
                if(record.ticket&&!record.failure){
                    const {width,height,frame}=record.storage.prepared,bytes=new Uint8Array(record.storage.output);
                    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,record.pbo!.value as WebGLBuffer);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,bytes);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);record.native.check();
                    // Flip in place with scalar swaps: no additional full-image or row allocation.
                    const pitch=4*width;for(let y=0;y<Math.floor(height/2);y++)for(let x=0;x<pitch;x++){const a=y*pitch+x,b=(height-1-y)*pitch+x,temp=bytes[a]!;bytes[a]=bytes[b]!;bytes[b]=temp;}
                    if(clock()>=record.deadline)throw glFailure('WEBGL2_SYNC_TIMEOUT');
                    record.readback=Object.freeze({generation:record.generation,serial:record.serial,frameId:frame.frameId,width,height,format:'rgba8unorm',sourceFormat:'rgba8unorm',colorSpace:'srgb',alphaMode:this.options.outputAlpha,bytes});
                }
            }catch(cause){record.failure??=this.note(isGLFailure(cause)?cause.code as WebGL2HostErrorCode:'WEBGL2_READBACK_FAILED',cause,'readback',record.serial);
                if(!record.native.invalidated){this.unsafe=true;this.markUnknown(record);}if(this.state==='active')this.state='failed';}
            this.retire(record);
        }}finally{this.phase=undefined;this.busy=false;this.retireLost();this.cpu.resolve();this.schedulePump();}
    }
    private markUnknown(record:Record2D):void {
        // A failed completion proof keeps every possibly in-use allocation charged.
        record.pool.invalidate();
        for(const lease of record.leases)if(lease&&!this.settledHandles.has(lease.handle)){lease.handle.resource.outcome='unknown';record.pool.settled(lease.handle,'unknown');this.settledHandles.add(lease.handle);}
        for(const owner of record.rawOwners)if(owner.outcome==='owned')owner.outcome='unknown';
        for(const page of record.pages)page.native.outcome='unknown';
        if(record.pbo)record.pbo.outcome='unknown';if(record.sync)record.sync.outcome='unknown';
    }
    private retire(record:Record2D):void {
        if(record.retired)return;record.retired=true;
        const native=record.native;
        try{
            if(native.invalidated)record.pool.invalidate();
            if(record.failure||this.state!=='active'||native.invalidated||this.unsafe){
                for(const lease of record.leases)if(lease)this.disposeHandle(lease.handle,native,record.pool);
            }else{
                const returns=record.pool.reserveReturns(record.leases);
                try{record.pool.publishReturns(returns);}catch(cause){for(const handle of record.pool.cancelReturns(returns))this.disposeHandle(handle,native,record.pool);throw cause;}
                for(const handle of returns.transient)this.disposeHandle(handle,native,record.pool);
            }
            for(const page of record.pages){page.pins--;
                if(!record.failure&&!native.invalidated&&this.state==='active'&&!this.unsafe){
                    const existing=this.pages.get(page.source);
                    if(existing===page)continue; // An existing residence adds no new bytes or entry.
                    if(existing){if(page.pins===0&&!native.cleanup(page.native))this.unsafe=true;continue;}
                    let bytes=0;for(const current of this.pages.values())bytes+=current.source.byteLength;
                    for(const [key,victim] of this.pages){if((this.pages.size<256&&bytes+page.source.byteLength<=33554432)||victim.pins>0)continue;
                        this.pages.delete(key);bytes-=victim.source.byteLength;if(!native.cleanup(victim.native))this.unsafe=true;}
                    if(!this.unsafe&&this.pages.size<256&&bytes+page.source.byteLength<=33554432){page.ready=true;this.pages.set(page.source,page);}
                    else if(page.pins===0&&!native.cleanup(page.native))this.unsafe=true;
                }else if(page.pins===0){if(this.pages.get(page.source)===page)this.pages.delete(page.source);if(!native.cleanup(page.native))this.unsafe=true;}
            }
            if(record.pbo&&!native.cleanup(record.pbo))this.unsafe=true;
            if(record.sync&&!native.cleanup(record.sync))this.unsafe=true;
        }catch(cause){this.unsafe=true;record.failure??=this.note('WEBGL2_CLOSE_UNSAFE',cause,'cleanup',record.serial);}
        finally{
            if(native.cleanupFailure)this.unsafe=true;
            if(this.unsafe){record.failure??=this.note('WEBGL2_CLOSE_UNSAFE',native.cleanupFailure?.cause,'cleanup',record.serial);
                if(this.state!=='closing'&&this.state!=='closed'&&this.state!=='stopped')this.state='failed';}
            record.projections=[];this.scratch.release(record.batch);this.records.delete(record);
            if(record.ticket){if(record.failure)record.ticket.reject(record.failure);else if(record.readback)record.ticket.resolve(record.readback);else record.ticket.reject(glFailure('WEBGL2_READBACK_FAILED'));
                if(this.ticket===record.ticket)this.ticket=undefined;}
            if(record.failure)record.done.reject(record.failure);else record.done.resolve();
        }
    }
    public close():Promise<void> {
        if(this.closing)return this.closing;
        const barrier=deferred<void>();this.closing=barrier.promise;this.state='closing';this.cleanupOutcome='pending';this.cancelRestore();
        const failure=glFailure('WEBGL2_CLOSED');this.ready?.reject(failure);this.rejectUnbound(failure);
        const cpu=this.cpu.promise;
        void cpu.then(async()=>{
            await Promise.allSettled([...this.records].map(record=>record.done.promise));
            let failure=this.native?.cleanupFailure;
            const attempt=(cleanup:()=>void):void=>{try{cleanup();}catch(cause){this.unsafe=true;failure??={cause};}};
            // Teardown steps are independent; a failed detach must not abandon known owners.
            attempt(()=>{if(this.native&&!this.native.invalidated){try{this.detachContainers(this.native);this.native.check();}catch(cause){if(!this.native.invalidated)throw cause;}}});
            attempt(()=>{for(const handle of this.pool.detachIdleForClose())attempt(()=>this.disposeHandle(handle,this.native!,this.pool));});
            attempt(()=>this.pool.invalidate());this.pages.clear();
            attempt(()=>{if(this.native&&!this.native.cleanupAll())this.unsafe=true;});
            failure??=this.native?.cleanupFailure;
            attempt(()=>this.removeListeners?.());this.removeListeners=undefined;
            if(this.pump!==undefined){const pump=this.pump;this.pump=undefined;attempt(()=>cancel(pump));}
            this.state='closed';this.cleanupOutcome=this.unsafe?'unsafe':'safe';
            if(this.unsafe)barrier.reject(glFailure('WEBGL2_CLOSE_UNSAFE',failure?.cause));else barrier.resolve();
        });return this.closing;
    }
    public getStatus():WebGL2HostStatus {
        const owner=this.snapshot();return Object.freeze({state:this.state,generation:this.generation,lastSerial:this.serial,pendingFrames:owner.pendingFrames,pendingUploadBytes:owner.pendingUploadBytes,pendingReadbackBytes:owner.pendingReadbackBytes,firstFailure:this.firstFailure,generationFailure:this.generationFailure,callbackFailureCount:this.callbackFailureCount,lastCallbackFailure:this.lastCallbackFailure,cleanupOutcome:this.cleanupOutcome});
    }
    public getSharedStatus():SharedWebGL2HostStatus {
        const owner=this.snapshot(),unknown=this.native?.unknown()??{bytes:0,objects:0};
        return Object.freeze({host:this.getStatus(),pendingGeometryBytes:owner.pendingGeometryBytes,pendingColorBytes:owner.pendingColorBytes,pendingCanonicalBytes:owner.pendingCanonicalBytes,
            retention:Object.freeze({...this.pool.getStatus(),unknownNativeBytes:this.retiredUnknownBytes+unknown.bytes,unknownNativeObjects:this.retiredUnknownObjects+unknown.objects})});
    }
}

/** Explicit compatibility backend; the Engine retains the original shared-frame contract. */
export function createSharedWebGL2Host(options:SharedWebGL2HostOptions):SharedWebGL2Host {return new SharedGLHost(options);}
/** Internal fixed scene assembly, reached only from the separate package entry. */
export function createSharedSceneWebGL2HostInternal(options:SharedSceneWebGL2HostOptions):SharedSceneWebGL2Host {return new SharedGLHost(options,true) as unknown as SharedSceneWebGL2Host;}
