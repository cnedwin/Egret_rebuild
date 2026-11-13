import { createCanvasHost } from '@egret/engine/web';
import type { CanvasHost, CanvasHostOptions } from '@egret/engine/web';
import type { RenderHostAdapter } from '@egret/engine';
declare const canvas: HTMLCanvasElement;
const options: CanvasHostOptions = { canvas, pixelRatio: 1.5, maxBackingPixels: 100000 };
const host: CanvasHost = createCanvasHost(options);
const port: RenderHostAdapter = host;
const surface: HTMLCanvasElement = host.surface;
void port; void surface;
// @ts-expect-error fixed borrowed surface
host.surface = canvas;
// @ts-expect-error browser canvas is required
createCanvasHost({canvas:{}});

import { createSharedWebGPUHost } from '@egret/engine/webgpu';
import type { SharedWebGPUHost, WebGPUHostStatus, SharedWebGPUReadback } from '@egret/engine/webgpu';
declare const device: GPUDevice;
const gpuHost: SharedWebGPUHost = createSharedWebGPUHost({canvas, device:{kind:'borrow',device}, enableReadback:true});
const started: Promise<void> = gpuHost.start();
const status: WebGPUHostStatus = gpuHost.getStatus();
const pixels: Promise<SharedWebGPUReadback> = gpuHost.requestReadback();
void started; void status; void pixels;
// @ts-expect-error borrowed queue has no independent public injection
createSharedWebGPUHost({canvas,device:{kind:'borrow',device,queue:device.queue}});
// @ts-expect-error readback usage is boolean
createSharedWebGPUHost({canvas,enableReadback:1});
// @ts-expect-error fixed surface
gpuHost.surface=canvas;
