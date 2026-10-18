import { createSceneFrame3D, isSceneFrame3D, getScene3DErrorOrigin } from '../rendering/sceneFrame3D.js';
import { packSharedMeshGeometry3D, getSharedMeshPacking3DErrorOrigin } from '../rendering/packSharedMeshGeometry3D.js';
import { createSharedWebGPUMeshPipeline, encodeSharedWebGPUMesh } from './webgpuSharedMeshPass.js';
import { createSharedSceneWebGPUHostInternal } from './WebGPUHost.js';
import type { SharedSceneWebGPUHostOptions, SharedSceneWebGPUHost } from './WebGPUHost.js';
// A separate exact eight-field identity preserves the old built-in protocol.
const builtin=Object.freeze({version:'egret.internal.shared-b1/1' as const,createSceneFrame3D,isSceneFrame3D,getScene3DErrorOrigin,
    packMeshGeometry3D:packSharedMeshGeometry3D,getMeshPacking3DErrorOrigin:getSharedMeshPacking3DErrorOrigin,
    createWebGPUMeshPipeline:createSharedWebGPUMeshPipeline,encodeWebGPUMesh:encodeSharedWebGPUMesh});
export type SharedB1BuiltinProtocol=typeof builtin;
export function getBuiltinSharedB1Protocol():SharedB1BuiltinProtocol{return builtin;}
export function isBuiltinSharedB1Protocol(value:unknown):value is SharedB1BuiltinProtocol{return value===builtin;}
export function createSharedSceneWebGPUHost(options:SharedSceneWebGPUHostOptions):SharedSceneWebGPUHost{return createSharedSceneWebGPUHostInternal(options);}
