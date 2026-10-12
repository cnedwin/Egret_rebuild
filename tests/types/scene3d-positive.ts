import { createMeshGeometry3D, isMeshGeometry3D, MeshGeometry3DError, getMeshGeometry3DErrorOrigin, createSceneFrame3D, isSceneFrame3D, Scene3DError, getScene3DErrorOrigin } from '@egret/engine/scene3d';
import type { Matrix4, MeshGeometry3DInput, MeshGeometry3D, MeshGeometry3DErrorCode, MeshGeometry3DErrorOrigin, SceneProjectionInput3D, SceneDrawInput3D, SceneInput3D, SceneDraw3D, SceneFrame3D, Scene3DErrorCode, Scene3DErrorOrigin } from '@egret/engine/scene3d';
const matrix: Matrix4 = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const input: MeshGeometry3DInput = { positions: [0,0,-1,1,0,-1,0,1,-1], colors: [1,0,0,0,1,0,0,0,1], indices: [0,1,2] };
const geometry: MeshGeometry3D = createMeshGeometry3D(input);
const projection: SceneProjectionInput3D = { kind:'orthographic', left:-1, right:1, bottom:-1, top:1, near:0, far:2 };
const draw: SceneDrawInput3D = { geometry, modelView:matrix };
const authoring: SceneInput3D = { projection, draws:[draw] };
const frame: SceneFrame3D = createSceneFrame3D(authoring);
const captured: SceneDraw3D | undefined = frame.draws[0];
const meshCode: MeshGeometry3DErrorCode = 'MESH3D_INPUT_INVALID';
const sceneCode: Scene3DErrorCode = 'SCENE3D_PRECISION_UNSUPPORTED';
const meshOrigin: MeshGeometry3DErrorOrigin | undefined = getMeshGeometry3DErrorOrigin(new MeshGeometry3DError(meshCode));
const sceneOrigin: Scene3DErrorOrigin | undefined = getScene3DErrorOrigin(new Scene3DError(sceneCode));
declare const unknownValue: unknown;
if (isMeshGeometry3D(unknownValue)) { const owned: MeshGeometry3D = unknownValue; void owned.logicalBytes; }
if (isSceneFrame3D(unknownValue)) { const owned: SceneFrame3D = unknownValue; void owned.uniformBytes; }
void captured; void meshOrigin; void sceneOrigin;
// Output interfaces are structural typing, not a TypeScript authenticity proof.

// Ordinary editor/JSON authoring arrays become typed owned tuples without
// assertions. These public imports intentionally require the successor API.
import { createMatrix4, multiplyMatrix4, Math3DError } from '@egret/engine/scene3d';
import type { Math3DErrorCode } from '@egret/engine/scene3d';
const authoredParentSource: readonly number[] = [0,1,0,0,-1,0,0,0,0,0,1,0,0,0,0,1];
const authoredLocalSource: readonly number[] = [1,0,0,0,0,1,0,0,0,0,1,0,3,0,0,1];
const authoredParent: Matrix4 = createMatrix4(authoredParentSource);
const authoredLocal: Matrix4 = createMatrix4(authoredLocalSource);
const authoredProduct: Matrix4 = multiplyMatrix4(authoredParent, authoredLocal);
const composedDraw: SceneDrawInput3D = { geometry, modelView:authoredProduct };
const composedInput: SceneInput3D = { projection, draws:[composedDraw] };
const composedFrame: SceneFrame3D = createSceneFrame3D(composedInput);
const mathCode: Math3DErrorCode = 'MATH3D_INPUT_READ_FAILED';
const mathCause: unknown = { id:'typed-public-matrix-cause' };
const mathError: Math3DError = new Math3DError(mathCode, mathCause);
const observedMathCode: Math3DErrorCode = mathError.code;
const observedMathCause: unknown = mathError.cause;
const standardError: Error = mathError;
void composedFrame; void observedMathCode; void observedMathCause; void standardError;
