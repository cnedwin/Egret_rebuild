import {createTextRasterCache} from '@egret/engine/text';
import type {TextRasterRequestInput,TextRasterRequest,TextRasterPlan,TextRasterCache,TextRasterCacheOptions,
  TextRasterCacheStatus,TextRasterMetrics,PreparedTextRaster,TextRasterProvider,TextMeasureContext,TextPlanInput} from '@egret/engine/text';
import type {AssetManager} from '@egret/engine';
declare const assets:AssetManager;declare const provider:TextRasterProvider;
declare const input:TextRasterRequestInput;declare const request:TextRasterRequest;declare const metrics:TextRasterMetrics;
declare const plan:TextRasterPlan;declare const cache:TextRasterCache;declare const status:TextRasterCacheStatus;
declare const options:TextRasterCacheOptions;declare const context:TextMeasureContext;

// TEXT_RASTER_CASE missing-factory-arguments TS2554
createTextRasterCache();
// TEXT_RASTER_CASE extra-factory-argument TS2554
createTextRasterCache(assets,{provider},assets);
// TEXT_RASTER_CASE structural-manager TS2740
createTextRasterCache({}, {provider});
// TEXT_RASTER_CASE unknown-option TS2353
const unknownOption:TextRasterCacheOptions={provider,futureBudget:1};
// TEXT_RASTER_CASE wrong-quota-number TS2322
const wrongQuota:TextRasterCacheOptions={provider,maxPendingJobs:'1'};
// TEXT_RASTER_CASE readonly-option TS2540
options.maxWaiters=1;
// TEXT_RASTER_CASE readonly-input TS2540
input.text='changed';
// TEXT_RASTER_CASE wrong-direction TS2322
const wrongDirection:TextRasterRequestInput={...input,direction:'auto'};
// TEXT_RASTER_CASE structural-request-brand TS2741
const structuralRequest:TextRasterRequest={...input,profile:'canvas-explicit-lines-v1',providerIdentity:'literal.t1',fontGeneration:1,sourceLines:[]};
// TEXT_RASTER_CASE structural-plan-brand TS2741
const structuralPlan:TextRasterPlan={request,metrics};
// TEXT_RASTER_CASE structural-cache-brand TS2741
const structuralCache:TextRasterCache={profile:'canvas-explicit-lines-v1',acquire:cache.acquire,invalidate:cache.invalidate,getStatus:cache.getStatus,whenIdle:cache.whenIdle,dispose:cache.dispose};
// TEXT_RASTER_CASE readonly-source-lines TS2339
request.sourceLines.push({start:0,end:0,breakEnd:0});
// TEXT_RASTER_CASE readonly-plan TS2540
plan.metrics=metrics;
// TEXT_RASTER_CASE readonly-bounds TS2540
metrics.contentBounds.x=0;
// TEXT_RASTER_CASE readonly-status TS2540
status.pendingWaiters=0;
// TEXT_RASTER_CASE readonly-context-function TS2540
context.createPlan=(_input:TextPlanInput)=>plan;
declare const empty:Extract<PreparedTextRaster,{kind:'empty'}>;
// TEXT_RASTER_CASE empty-has-no-lease TS2339
empty.lease;
// TEXT_RASTER_CASE wrong-profile TS2322
const wrongProfile:TextRasterProvider['profile']='canvas-v2';

void [unknownOption,wrongQuota,wrongDirection,structuralRequest,structuralPlan,structuralCache,wrongProfile];
