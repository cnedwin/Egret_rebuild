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
