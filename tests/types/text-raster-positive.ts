import {createTextRasterCache} from '@egret/engine/text';
import {createTextRasterCache as runtimeFactory} from '@egret/runtime/text';
import type {
  TextRasterRequestInput, TextSourceLine, TextRasterRequest, TextBounds2D,
  TextLineMetricsInput, TextPlanInput, TextLineMetrics, TextRasterPlacement,
  TextRasterMetrics, TextRasterPlan, TextRasterLimits, TextMeasureContext,
  TextRasterContext, TextRasterProvider, TextRasterCacheOptions, TextRasterAcquireOptions,
  PreparedTextRaster, TextRasterCacheStatus, TextRasterCache,
} from '@egret/engine/text';
import type {TextRasterRequest as RuntimeRequest,TextRasterPlan as RuntimePlan,
  TextRasterCache as RuntimeCache,PreparedTextRaster as RuntimePrepared} from '@egret/runtime/text';
import type {AssetManager,AssetLease,Texture,CancellationSignal,ScopeValue,ImageData2D} from '@egret/engine';

type Equal<A,B>=(<T>()=>T extends A?1:2)extends(<T>()=>T extends B?1:2)?
  (<T>()=>T extends B?1:2)extends(<T>()=>T extends A?1:2)?true:false:false;
type Assert<T extends true>=T;
type Mutable<T>={-readonly[K in keyof T]:T[K]};
type ReadonlyKeys<T>={[K in keyof T]-?:Equal<Pick<T,K>,Mutable<Pick<T,K>>>extends true?never:K}[keyof T];
type OptionalKeys<T>={[K in keyof T]-?:{}extends Pick<T,K>?K:never}[keyof T];
type InputKeys='text'|'fontFamily'|'fontSize'|'fontWeight'|'fontStyle'|'lineHeight'|'locale'|'direction'|'density'|'fillColor';
type ExactInput=Assert<Equal<TextRasterRequestInput,{
  readonly text:string;readonly fontFamily:string;readonly fontSize:number;readonly fontWeight:number;
  readonly fontStyle:'normal'|'italic';readonly lineHeight:number;readonly locale:string;
  readonly direction:'ltr'|'rtl';readonly density:number;readonly fillColor:number;
}>>;
type InputRequired=Assert<Equal<OptionalKeys<TextRasterRequestInput>,never>>;
type InputReadonly=Assert<Equal<ReadonlyKeys<TextRasterRequestInput>,InputKeys>>;
type RequestProfile=Assert<Equal<TextRasterRequest['profile'],'canvas-explicit-lines-v1'>>;
type RequestFields=Assert<Equal<Pick<TextRasterRequest,InputKeys>,TextRasterRequestInput>>;
type SourceLines=Assert<Equal<TextRasterRequest['sourceLines'],readonly TextSourceLine[]>>;
type Source=Assert<Equal<TextSourceLine,{readonly start:number;readonly end:number;readonly breakEnd:number}>>;
type Bounds=Assert<Equal<TextBounds2D,{readonly x:number;readonly y:number;readonly width:number;readonly height:number}>>;
type LineInput=Assert<Equal<TextLineMetricsInput,{readonly advance:number;readonly hasInk:boolean;readonly inkLeft:number;readonly inkTop:number;readonly inkRight:number;readonly inkBottom:number}>>;
type PlanInput=Assert<Equal<TextPlanInput,{readonly baselineOffset:number;readonly lines:readonly TextLineMetricsInput[]}>>;
type Line=Assert<Equal<TextLineMetrics,{readonly source:TextSourceLine;readonly advance:number;readonly baselineY:number;readonly inkBounds:TextBounds2D|undefined}>>;
type Placement=Assert<Equal<TextRasterPlacement,{readonly pixelLeft:number;readonly pixelTop:number;readonly width:number;readonly height:number;readonly byteLength:number;readonly density:number;readonly x:number;readonly y:number;readonly logicalWidth:number;readonly logicalHeight:number}>>;
type Metrics=Assert<Equal<TextRasterMetrics,{readonly logicalBounds:TextBounds2D;readonly inkBounds:TextBounds2D|undefined;readonly contentBounds:TextBounds2D;readonly lines:readonly TextLineMetrics[];readonly raster:TextRasterPlacement|undefined}>>;
type PlanFields=Assert<Equal<Pick<TextRasterPlan,'request'|'metrics'>,{readonly request:TextRasterRequest;readonly metrics:TextRasterMetrics}>>;
type Limits=Assert<Equal<TextRasterLimits,{readonly maxSourceCodeUnits:8192;readonly maxLines:64;readonly maxFontFamilyCodeUnits:256;readonly maxLocaleCodeUnits:64;readonly maxProviderIdentityCodeUnits:64;readonly maxSourceEdge:4096;readonly maxSourcePixels:1048576;readonly maxMetricMagnitude:1048576;readonly antialiasGuardPixels:2}>>;
type Measure=Assert<Equal<TextMeasureContext,{readonly signal:CancellationSignal;readonly fontGeneration:number;readonly limits:TextRasterLimits;readonly createPlan:(input:TextPlanInput)=>TextRasterPlan}>>;
type Raster=Assert<Equal<TextRasterContext,{readonly signal:CancellationSignal;readonly fontGeneration:number;readonly limits:TextRasterLimits;readonly reservedImageBytes:number;readonly reservedScratchBytes:number}>>;
type ProviderIdentity=Assert<Equal<TextRasterProvider['identity'],string>>;
type ProviderProfile=Assert<Equal<TextRasterProvider['profile'],'canvas-explicit-lines-v1'>>;
type ProviderMeasure=Assert<Equal<TextRasterProvider['measure'],(request:TextRasterRequest,context:TextMeasureContext)=>Promise<TextRasterPlan>>>;
type ProviderRaster=Assert<Equal<TextRasterProvider['rasterize'],(plan:TextRasterPlan,context:TextRasterContext)=>Promise<ImageData2D|undefined>>>;
type ProviderRelease=Assert<Equal<TextRasterProvider['release'],(plan:TextRasterPlan)=>void>>;
type OptionKeys='maxGenerations'|'maxPendingJobs'|'maxWaiters'|'maxCallerLeases'|'maxResidentEntries'|'maxMetadataBytes'|'maxLogicalImageBytes'|'maxPendingRasterBytes';
type Options=Assert<Equal<TextRasterCacheOptions,{readonly provider:TextRasterProvider;readonly maxGenerations?:number;readonly maxPendingJobs?:number;readonly maxWaiters?:number;readonly maxCallerLeases?:number;readonly maxResidentEntries?:number;readonly maxMetadataBytes?:number;readonly maxLogicalImageBytes?:number;readonly maxPendingRasterBytes?:number}>>;
type OptionOptional=Assert<Equal<OptionalKeys<TextRasterCacheOptions>,OptionKeys>>;
type OptionReadonly=Assert<Equal<ReadonlyKeys<TextRasterCacheOptions>,OptionKeys|'provider'>>;
type AcquireOptions=Assert<Equal<TextRasterAcquireOptions,{readonly signal?:CancellationSignal}>>;
type Prepared=Assert<Equal<PreparedTextRaster,
  {readonly kind:'empty';readonly request:TextRasterRequest;readonly metrics:TextRasterMetrics}|
  {readonly kind:'image';readonly request:TextRasterRequest;readonly metrics:TextRasterMetrics;readonly lease:AssetLease<Texture>}>>;
type Status=Assert<Equal<TextRasterCacheStatus,{
  readonly closed:boolean;readonly fontGeneration:number;readonly occupiedSlots:number;readonly currentGenerations:number;
  readonly retiredGenerations:number;readonly quarantinedGenerations:number;readonly pendingJobs:number;readonly pendingWaiters:number;
  readonly callerLeaseSlots:number;readonly activeCallerLeases:number;readonly residentEntries:number;readonly residentBytes:number;
  readonly liveImageBytes:number;readonly reservedImageBytes:number;readonly pendingRasterBytes:number;readonly quarantinedImageBytes:number;
  readonly quarantinedRasterBytes:number;readonly metadataBytes:number;readonly idleWaiters:number;readonly cleanupFailureCount:number;readonly lateProviderFailureCount:number;
}>>;
type StatusReadonly=Assert<Equal<ReadonlyKeys<TextRasterCacheStatus>,keyof TextRasterCacheStatus>>;
type Factory=Assert<Equal<typeof createTextRasterCache,(assets:AssetManager,options:TextRasterCacheOptions)=>TextRasterCache>>;
type RuntimeFactory=Assert<Equal<typeof runtimeFactory,typeof createTextRasterCache>>;
type SharedRequest=Assert<Equal<RuntimeRequest,TextRasterRequest>>;
type SharedPlan=Assert<Equal<RuntimePlan,TextRasterPlan>>;
type SharedCache=Assert<Equal<RuntimeCache,TextRasterCache>>;
type SharedPrepared=Assert<Equal<RuntimePrepared,PreparedTextRaster>>;
type Acquire=Assert<Equal<TextRasterCache['acquire'],(request:TextRasterRequestInput,options?:TextRasterAcquireOptions)=>Promise<PreparedTextRaster>>>;
type Invalidate=Assert<Equal<TextRasterCache['invalidate'],()=>void>>;
type StatusMethod=Assert<Equal<TextRasterCache['getStatus'],()=>TextRasterCacheStatus>>;
type Idle=Assert<Equal<TextRasterCache['whenIdle'],()=>Promise<void>>>;
type Dispose=Assert<Equal<TextRasterCache['dispose'],()=>void>>;
type CacheProfile=Assert<Equal<TextRasterCache['profile'],'canvas-explicit-lines-v1'>>;
type CacheIsScopeValue=Assert<TextRasterCache extends ScopeValue?true:false>;

declare const assets:AssetManager;declare const provider:TextRasterProvider;
declare const signal:CancellationSignal;declare const input:TextRasterRequestInput;
const cache:TextRasterCache=createTextRasterCache(assets,{provider,maxResidentEntries:0,maxMetadataBytes:4964});
const prepared:Promise<PreparedTextRaster>=cache.acquire(input,{signal});
function consume(value:PreparedTextRaster):void{
  if(value.kind==='image'){const lease:AssetLease<Texture>=value.lease;const texture:Texture=lease.value;void texture;lease.release();}
  else{const metrics:TextRasterMetrics=value.metrics;void metrics;}
}
void [cache,prepared,consume];
export type {ExactInput,InputRequired,InputReadonly,RequestProfile,RequestFields,SourceLines,Source,Bounds,LineInput,
  PlanInput,Line,Placement,Metrics,PlanFields,Limits,Measure,Raster,ProviderIdentity,ProviderProfile,ProviderMeasure,
  ProviderRaster,ProviderRelease,Options,OptionOptional,OptionReadonly,AcquireOptions,Prepared,Status,StatusReadonly,
  Factory,RuntimeFactory,SharedRequest,SharedPlan,SharedCache,SharedPrepared,Acquire,Invalidate,StatusMethod,Idle,Dispose,CacheProfile,CacheIsScopeValue};
