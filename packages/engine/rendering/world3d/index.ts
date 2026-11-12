// SPDX-License-Identifier: Apache-2.0
// Optional DOM-free 3D entry: scene graph, geometry, materials, lights,
// cameras, animation, picking and glTF loading. Rendering backends live in
// separate explicit entries and consume these objects without mutating them.
export {World3DError} from './core3D.js';
export type {World3DErrorCode, DisposeListener3D} from './core3D.js';
export {Resource3D} from './core3D.js';
export * from './math3D.js';
export {Object3D, Scene3D, WORLD3D_LIMITS} from './Object3D.js';
export type {Object3DKind, Fog3D} from './Object3D.js';
export {Texture3D, CubeTexture3D, createSolidTexture3D, isTexturePixels3D, TEXTURE3D_LIMITS} from './Texture3D.js';
export type {TextureWrap3D, TextureFilter3D, TextureColorSpace3D, TexturePixels3D, TextureSource3D, TextureOptions3D} from './Texture3D.js';
export {Attribute3D, Geometry3D, createGeometry3D, ATTRIBUTE_3D, GEOMETRY3D_LIMITS} from './Geometry3D.js';
export type {AttributeArray3D, Topology3D, GeometryGroup3D, MorphTarget3D, GeometryInput3D} from './Geometry3D.js';
export {
    createBoxGeometry3D, createPlaneGeometry3D, createSphereGeometry3D, createCylinderGeometry3D,
    createConeGeometry3D, createTorusGeometry3D, createCapsuleGeometry3D, createQuadGeometry3D,
} from './primitives3D.js';
export type {
    BoxGeometryOptions3D, PlaneGeometryOptions3D, SphereGeometryOptions3D, CylinderGeometryOptions3D,
    TorusGeometryOptions3D, CapsuleGeometryOptions3D,
} from './primitives3D.js';
export {
    Material3D, setColor3D, createUnlitMaterial3D, createLambertMaterial3D, createPhongMaterial3D,
    createStandardMaterial3D, createSpriteMaterial3D,
} from './Material3D.js';
export type {
    Shading3D, Side3D, AlphaMode3D, Blending3D, ColorInput3D, MaterialOptions3D, PhongMaterialOptions3D,
    StandardMaterialOptions3D, SpriteMaterialOptions3D,
} from './Material3D.js';
export {Camera3D, createPerspectiveCamera3D, createOrthographicCamera3D} from './Camera3D.js';
export type {PerspectiveCameraOptions3D, OrthographicCameraOptions3D} from './Camera3D.js';
export {
    Light3D, createAmbientLight3D, createHemisphereLight3D, createDirectionalLight3D, createPointLight3D,
    createSpotLight3D, LIGHT3D_LIMITS,
} from './Light3D.js';
export type {LightType3D, LightShadow3D, LightOptions3D, PointLightOptions3D, SpotLightOptions3D} from './Light3D.js';
export {Mesh3D, InstancedMesh3D, Sprite3D, createSprite3D, Bone3D, Skeleton3D, MESH3D_LIMITS} from './Mesh3D.js';
export {
    AnimationClip3D, AnimationAction3D, AnimationMixer3D, createAnimationClip3D, sampleAnimationTrack3D, ANIMATION3D_LIMITS,
} from './Animation3D.js';
export type {
    AnimationPath3D, AnimationInterpolation3D, AnimationLoop3D, AnimationTrackInput3D, AnimationTrack3D,
} from './Animation3D.js';
export {Raycaster3D} from './Raycast3D.js';
export type {RaycastHit3D, RaycastOptions3D} from './Raycast3D.js';
export {RenderList3D} from './RenderList3D.js';
export type {RenderItem3D, RenderStats3D} from './RenderList3D.js';
export {loadGltf3D} from './Gltf3D.js';
export type {GltfImageRequest3D, GltfLoadOptions3D, GltfAsset3D} from './Gltf3D.js';
