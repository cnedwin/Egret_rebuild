// TEXT_RASTER_IMPORT_CASE root-factory TS2305
import {createTextRasterCache as rootFactory} from '@egret/engine';
// TEXT_RASTER_IMPORT_CASE runtime-root-factory TS2305
import {createTextRasterCache as runtimeRootFactory} from '@egret/runtime';
// TEXT_RASTER_IMPORT_CASE canvas-factory TS2305
import {createTextRasterCache as canvasFactory} from '@egret/engine/web';
// TEXT_RASTER_IMPORT_CASE gpu-factory TS2305
import {createTextRasterCache as gpuFactory} from '@egret/engine/webgpu';
// TEXT_RASTER_IMPORT_CASE private-manager-authority TS2305
import {requireAssetManagerOwner} from '@egret/runtime/text';
// TEXT_RASTER_IMPORT_CASE private-lease-observer TS2305
import {observeAssetLeaseRetirement} from '@egret/engine/text';
// TEXT_RASTER_IMPORT_CASE private-request-summary TS2305
import {summarizeTextRasterRequest} from '@egret/runtime/text';
// TEXT_RASTER_IMPORT_CASE private-plan-issuer TS2305
import {createTextRasterPlanIssuer} from '@egret/engine/text';
import type {TextRasterRequest} from '@egret/engine/text';
// TEXT_RASTER_IMPORT_CASE type-used-as-value TS2693
const requestConstructor=TextRasterRequest;
void [rootFactory,runtimeRootFactory,canvasFactory,gpuFactory,requireAssetManagerOwner,observeAssetLeaseRetirement,
  summarizeTextRasterRequest,createTextRasterPlanIssuer,requestConstructor];
