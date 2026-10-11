import {createSceneWebGPUHost} from '@egret/engine/webgpu/scene3d';
import type {SceneWebGPUHostOptions} from '@egret/engine/webgpu/scene3d';
declare const options: SceneWebGPUHostOptions;
const host=createSceneWebGPUHost(options);
void host;
// This isolated no-DOM probe records actual declaration dependency diagnostics.
// Root names each observed dependency file/line/code before acceptance.
