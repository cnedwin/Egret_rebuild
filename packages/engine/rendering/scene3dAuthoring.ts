// SPDX-License-Identifier: Apache-2.0
import {createSceneWorld3D} from './sceneWorld3D.js';
import type {SceneWorld3D} from './sceneWorld3D.js';
import {readStaticGlbNodes3D} from './staticGlb3D.js';

// Optional DOM-free authoring entry; capture retains the shared scene identity.
export {createSceneCamera3D,createSceneWorld3D} from './sceneWorld3D.js';
export type {
    SceneWorldCamera3D,SceneWorldCameraInput3D,SceneWorldProjectionInput3D,
    SceneWorld3D,SceneWorldNodeInput3D,
} from './sceneWorld3D.js';
export {StaticGlb3DError} from './staticGlb3D.js';
export type {StaticGlb3DErrorCode} from './staticGlb3D.js';

export function loadStaticGlbScene3D(bytes:Uint8Array):SceneWorld3D {
    return createSceneWorld3D(readStaticGlbNodes3D(bytes));
}
