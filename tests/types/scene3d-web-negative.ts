import type {SceneWebGPUHost} from '@egret/engine/webgpu/scene3d';
import type {SceneFrame3D} from '@egret/engine/scene3d';
declare const host: SceneWebGPUHost;
declare const scene: SceneFrame3D;
// SCENE3D_CASE invalid-overlay-type
host.renderSceneFrame(scene,scene);
// SCENE3D_CASE readonly-scene-host-status
host.getSceneStatus().pendingDepthBytes=0;
// SCENE3D_CASE readonly-nested-host-status
host.getSceneStatus().host.lastSerial=0;

import {createTexturedSceneWebGPUHost} from '@egret/engine/webgpu/scene3d';
import type {TexturedSceneWebGPUHost} from '@egret/engine/webgpu/scene3d';
import type {RenderFrame2D,TexturedRenderFrame2D} from '@egret/engine';
import type {MeshGeometry3D} from '@egret/engine/scene3d';
declare const combinedHost: TexturedSceneWebGPUHost;
declare const combinedOverlay: TexturedRenderFrame2D;
declare const ordinaryOverlay: RenderFrame2D;
declare const geometryWithoutScene: MeshGeometry3D;
declare const combinedCanvas: HTMLCanvasElement;
declare const combinedDevice: GPUDevice;
// SCENE3D_CASE combined-no-ordinary-overlay
combinedHost.renderSceneTexturedFrame(scene,ordinaryOverlay);
// SCENE3D_CASE combined-no-geometry-as-scene
combinedHost.renderSceneTexturedFrame(geometryWithoutScene,combinedOverlay);
// SCENE3D_CASE combined-overlay-required
combinedHost.renderSceneTexturedFrame(scene);
// SCENE3D_CASE combined-sync-not-promise
const combinedPromise: Promise<void> = combinedHost.renderSceneTexturedFrame(scene,combinedOverlay);
// SCENE3D_CASE combined-existing-option-type
createTexturedSceneWebGPUHost({canvas:combinedCanvas,device:{kind:'borrow',device:combinedDevice},maxFrameGeometryBytes:'204'});
