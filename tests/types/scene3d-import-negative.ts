// SCENE3D_CASE no-root-scene-factory
import {createSceneFrame3D} from '@egret/engine';
// SCENE3D_CASE no-canvas-scene-factory
import {createMeshGeometry3D} from '@egret/engine/web';
// SCENE3D_CASE no-ordinary-webgpu-scene-factory
import {createSceneWebGPUHost} from '@egret/engine/webgpu';
// SCENE3D_CASE no-packing-public-port
import {packMeshGeometry3D} from '@egret/engine/scene3d';
// SCENE3D_CASE no-protocol-public-port
import {getBuiltinB1Protocol} from '@egret/engine/webgpu/scene3d';
// SCENE3D_CASE no-private-packing-subpath
import {packMeshGeometry3D as privatePack} from '@egret/engine/rendering/packMeshGeometry3D';
// SCENE3D_CASE no-private-protocol-subpath
import {getBuiltinB1Protocol as privateProtocol} from '@egret/engine/web/b1';
// SCENE3D_CASE no-root-matrix-constructor
import {createMatrix4} from '@egret/engine';
import type {Matrix4,SceneFrame3D} from '@egret/engine/scene3d';
import type {SceneWebGPUHost} from '@egret/engine/webgpu/scene3d';
// SCENE3D_CASE matrix-type-not-runtime
void Matrix4;
// SCENE3D_CASE scene-type-not-runtime
void SceneFrame3D;
// SCENE3D_CASE host-type-not-runtime
void SceneWebGPUHost;
