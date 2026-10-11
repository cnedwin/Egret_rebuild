// Experimental DOM-free scene entry. Internal factories retain capture authority.
import { createMeshGeometry3D as createOwnedMeshGeometry3D } from './meshGeometry3D.js';
import type { MeshGeometry3D } from './meshGeometry3D.js';
import { createSceneFrame3D as createOwnedSceneFrame3D } from './sceneFrame3D.js';
import type { SceneInput3D, SceneFrame3D } from './sceneFrame3D.js';

export { isMeshGeometry3D, MeshGeometry3DError, getMeshGeometry3DErrorOrigin } from './meshGeometry3D.js';
export { isSceneFrame3D, Scene3DError, getScene3DErrorOrigin } from './sceneFrame3D.js';
export type { Matrix4 } from './matrix4.js';
export type { MeshGeometry3D, MeshGeometry3DErrorCode, MeshGeometry3DErrorOrigin } from './meshGeometry3D.js';
export type {
    SceneProjectionInput3D, SceneDrawInput3D, SceneInput3D, SceneDraw3D,
    SceneFrame3D, Scene3DErrorCode, Scene3DErrorOrigin,
} from './sceneFrame3D.js';

// Readonly authoring types do not replace runtime Array and identity admission.
export interface MeshGeometry3DInput {
    readonly positions: readonly number[];
    readonly colors: readonly number[];
    readonly indices: readonly number[];
}

// Forward untouched inputs and return the exact owned value or thrown error.
export function createMeshGeometry3D(input: MeshGeometry3DInput): MeshGeometry3D {
    return createOwnedMeshGeometry3D(input);
}
export function createSceneFrame3D(input: SceneInput3D): SceneFrame3D {
    return createOwnedSceneFrame3D(input);
}
