import type { RenderFrame2D, TexturedRenderFrame2D } from '@egret/contracts';
import { createSceneFrame3D, isSceneFrame3D, getScene3DErrorOrigin } from '../rendering/sceneFrame3D.js';
import type { SceneFrame3D } from '../rendering/sceneFrame3D.js';
import { packMeshGeometry3D, getMeshPacking3DErrorOrigin } from '../rendering/packMeshGeometry3D.js';
import { createWebGPUMeshPipeline, encodeWebGPUMesh } from './webgpuMeshPass.js';
import { createB1WebGPUHostInternal, createTexturedB1WebGPUHostInternal } from './WebGPUHost.js';
import type { WebGPUHost, WebGPUHostOptions, WebGPUHostStatus, TexturedWebGPUHost, TexturedWebGPUHostOptions } from './WebGPUHost.js';

export interface B1SceneStatus {
    readonly host: WebGPUHostStatus;
    readonly pendingSceneBytes: number;
    readonly pendingUniformBytes: number;
    readonly pendingDepthBytes: number;
}
export interface B1WebGPUHost extends WebGPUHost {
    renderSceneFrame(scene: SceneFrame3D, overlay: RenderFrame2D): undefined;
    getSceneStatus(): B1SceneStatus;
}
export interface TexturedB1WebGPUHost extends B1WebGPUHost, TexturedWebGPUHost {
    renderSceneTexturedFrame(scene: SceneFrame3D, overlay: TexturedRenderFrame2D): undefined;
}
export interface B1BuiltinProtocol {
    readonly version: 'egret.internal.b1/1';
    readonly createSceneFrame3D: typeof createSceneFrame3D;
    readonly isSceneFrame3D: typeof isSceneFrame3D;
    readonly getScene3DErrorOrigin: typeof getScene3DErrorOrigin;
    readonly packMeshGeometry3D: typeof packMeshGeometry3D;
    readonly getMeshPacking3DErrorOrigin: typeof getMeshPacking3DErrorOrigin;
    readonly createWebGPUMeshPipeline: typeof createWebGPUMeshPipeline;
    readonly encodeWebGPUMesh: typeof encodeWebGPUMesh;
}

// Exact built-in identity belongs to this source-bound module. Frozen shape
// alone cannot authenticate a copy/proxy or protect against loader replacement.
const builtin: B1BuiltinProtocol = Object.freeze({
    version: 'egret.internal.b1/1',
    createSceneFrame3D,
    isSceneFrame3D,
    getScene3DErrorOrigin,
    packMeshGeometry3D,
    getMeshPacking3DErrorOrigin,
    createWebGPUMeshPipeline,
    encodeWebGPUMesh,
});
export function getBuiltinB1Protocol(): B1BuiltinProtocol { return builtin; }
export function isBuiltinB1Protocol(value: unknown): value is B1BuiltinProtocol { return value === builtin; }
export function createB1WebGPUHost(options: WebGPUHostOptions): B1WebGPUHost {
    // The ESM backedge is read only on an explicit call, after module evaluation.
    // This module never starts a host or invokes the protocol getter at top level.
    return createB1WebGPUHostInternal(options);
}
/** The same delayed backedge selects one module-owned combined host. */
export function createTexturedB1WebGPUHost(options: TexturedWebGPUHostOptions): TexturedB1WebGPUHost {
    return createTexturedB1WebGPUHostInternal(options);
}
