import {
  createTexturedWebGPUHost,
  type TexturedWebGPUHost, type TexturedWebGPUHostOptions,
  type TexturedWebGPUHostStatus,
} from '@egret/engine/webgpu';
import type { RenderFrame2D, TexturedRenderFrame2D, TexturedFrameProfile2D } from '@egret/engine';

declare const canvas: HTMLCanvasElement;
declare const gpuDevice: GPUDevice;
const device = { kind: 'borrow', device: gpuDevice } as const;
declare const host: TexturedWebGPUHost;
declare const options: TexturedWebGPUHostOptions;
declare const status: TexturedWebGPUHostStatus;
declare const legacy: RenderFrame2D;
declare const frame: TexturedRenderFrame2D;

// TEXTURED_GPU_CASE unknown-option TS2353
const unknown: TexturedWebGPUHostOptions = { canvas, device, futureBudget: 1 };
// TEXTURED_GPU_CASE readonly-source-option TS2540
options.maxSourceTriangles = 1;
// TEXTURED_GPU_CASE readonly-frame-option TS2540
options.maxFrameGeometryBytes = 1;
// TEXTURED_GPU_CASE readonly-pending-option TS2540
options.maxPendingGeometryBytes = 1;
// TEXTURED_GPU_CASE readonly-tuple-option TS2540
options.maxTupleComparisons = 1;
// TEXTURED_GPU_CASE readonly-current-geometry TS2540
status.pendingGeometryBytes = 1;
// TEXTURED_GPU_CASE readonly-nested-host TS2540
status.host = host.getStatus();
// TEXTURED_GPU_CASE readonly-nested-serial TS2540
status.host.lastSerial = 1;
// TEXTURED_GPU_CASE wrong-source-number TS2322
const badSource: TexturedWebGPUHostOptions = { canvas, device, maxSourceTriangles: '1' };
// TEXTURED_GPU_CASE wrong-frame-number TS2322
const badFrame: TexturedWebGPUHostOptions = { canvas, device, maxFrameGeometryBytes: '1' };
// TEXTURED_GPU_CASE wrong-pending-number TS2322
const badPending: TexturedWebGPUHostOptions = { canvas, device, maxPendingGeometryBytes: '1' };
// TEXTURED_GPU_CASE wrong-tuple-number TS2322
const badTuple: TexturedWebGPUHostOptions = { canvas, device, maxTupleComparisons: '1' };
// TEXTURED_GPU_CASE missing-factory-argument TS2554
createTexturedWebGPUHost();
// TEXTURED_GPU_CASE extra-factory-argument TS2554
createTexturedWebGPUHost({ canvas, device }, { canvas, device });
// TEXTURED_GPU_CASE legacy-frame-on-new-port TS2739
host.renderTexturedFrame(legacy);
// TEXTURED_GPU_CASE async-new-port TS2322
const asyncPort: TexturedWebGPUHost['renderTexturedFrame'] = async (_frame: TexturedRenderFrame2D) => undefined;
// TEXTURED_GPU_CASE invalid-profile-literal TS2322
const wrongProfile: TexturedFrameProfile2D = 'egret.textured-frame2d/2';
// TEXTURED_GPU_CASE root-factory-import TS2305
import { createTexturedWebGPUHost as rootFactory } from '@egret/engine';
// TEXTURED_GPU_CASE canvas-factory-import TS2305
import { createTexturedWebGPUHost as canvasFactory } from '@egret/engine/web';

void [unknown, badSource, badFrame, badPending, badTuple, asyncPort, wrongProfile, rootFactory, canvasFactory, frame];
