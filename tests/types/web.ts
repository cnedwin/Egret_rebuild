declare const canvas: HTMLCanvasElement;

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
