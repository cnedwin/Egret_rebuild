// SPDX-License-Identifier: Apache-2.0
import {createSceneWorld3D} from './sceneWorld3D.js';
import type {SceneWorld3D} from './sceneWorld3D.js';
import {readStaticGlbNodes3D} from './staticGlb3D.js';

// Optional DOM-free authoring entry; capture retains the shared scene identity.
export {createSceneCamera3D,createSceneWorld3D} from './sceneWorld3D.js';
export type {
    SceneWorldCamera3D,SceneWorldCameraInput3D,SceneWorldProjectionInput3D,
    SceneWorld3D,SceneWorldNodeInput3D,SceneLambertWorld3D,
} from './sceneWorld3D.js';
export {createSceneWorldCard3D} from './sceneFrame3D.js';
export type {SceneWorldCard3D,SceneWorldCardInput3D,SceneDirectionalLighting3D} from './sceneFrame3D.js';
export {prepareLambertStaticGlbScene3D,prepareTexturedStaticGlbScene3D,StaticGlb3DError} from './staticGlb3D.js';
export type {PreparedLambertStaticGlb3D,PreparedTexturedStaticGlb3D,StaticGlbImageBinding3D,StaticGlbImageRequest3D,StaticGlb3DErrorCode} from './staticGlb3D.js';

export function loadStaticGlbScene3D(bytes:Uint8Array):SceneWorld3D {
    return createSceneWorld3D(readStaticGlbNodes3D(bytes));
}
