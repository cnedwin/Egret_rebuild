import type { RenderFrame2D } from '@egret/contracts';
import type { SceneFrame3D } from '../rendering/scene3d.js';
import type { WebGPUHost, WebGPUHostOptions, WebGPUHostStatus } from './webgpu.js';
import { createB1WebGPUHost } from './b1.js';

export type SceneWebGPUHostOptions = WebGPUHostOptions;
export interface SceneWebGPUHostStatus {
    readonly host: WebGPUHostStatus;
    readonly pendingSceneBytes: number;
    readonly pendingUniformBytes: number;
    readonly pendingDepthBytes: number;
}
export interface SceneWebGPUHost extends WebGPUHost {
    renderSceneFrame(scene: SceneFrame3D, overlay: RenderFrame2D): undefined;
    getSceneStatus(): SceneWebGPUHostStatus;
}

// The existing Host owns admission, submission and lifecycle. Creation stays opt-in.
export function createSceneWebGPUHost(options: SceneWebGPUHostOptions): SceneWebGPUHost {
    return createB1WebGPUHost(options);
}
