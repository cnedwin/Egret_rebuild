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
export {
    Texture3D, CubeTexture3D, RenderTarget3D, createSolidTexture3D, createGradientCubeTexture3D, isTexturePixels3D, TEXTURE3D_LIMITS,
} from './Texture3D.js';
export type {
    TextureWrap3D, TextureFilter3D, TextureColorSpace3D, TexturePixels3D, TextureSource3D, TextureOptions3D, RenderTargetOptions3D, RenderTargetFormat3D,
} from './Texture3D.js';
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
    createStandardMaterial3D, createGlassMaterial3D, createCustomShader3D, createToonMaterial3D, createMatcapMaterial3D, createSpriteMaterial3D,
} from './Material3D.js';
export type {
    Shading3D, CustomShader3D, Side3D, AlphaMode3D, Blending3D, ColorInput3D, MaterialOptions3D, PhongMaterialOptions3D,
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
export {ParticleEmitter3D, createParticleEmitter3D, PARTICLES3D_LIMITS} from './Particles3D.js';
export type {ParticleShape3D, ParticleEmitterOptions3D} from './Particles3D.js';
export {
    Lod3D, ScreenLayer3D, createScreenLayer3D, createGridGeometry3D, createAxesGeometry3D, createBoxEdgesGeometry3D, createLineMaterial3D, createGridHelper3D,
    createAxesHelper3D,
} from './helpers3D.js';
export type {ScreenLayerOptions3D} from './helpers3D.js';
export {isCompressedPixels3D, COMPRESSED_BLOCK_BYTES_3D} from './Texture3D.js';
export type {CompressedFormat3D, CompressedPixels3D} from './Texture3D.js';
export {isKtx23D, parseKtx23D} from './Ktx23D.js';
export type {Ktx2Info3D, Ktx2Result3D, Ktx2Options3D} from './Ktx23D.js';
export type {GltfMeshoptRequest3D, GltfDracoRequest3D, GltfDracoResult3D} from './Gltf3D.js';
export {SCENE_DOCUMENT_FORMAT_3D, SCENE_DOCUMENT_VERSION_3D, SERIALIZE3D_LIMITS, serializeScene3D, deserializeScene3D} from './Serialize3D.js';
export type {SceneDocument3D, SerializeOptions3D, DeserializeOptions3D, DeserializedScene3D} from './Serialize3D.js';
export {STATE_MACHINE3D_LIMITS, AnimationStateMachine3D, createAnimationStateMachine3D} from './StateMachine3D.js';
export type {StateParameter3D, StateConditionOperator3D, StateCondition3D, StateBlendEntry3D, StateOptions3D, TransitionOptions3D} from './StateMachine3D.js';
export {Joint3D} from './Physics3D.js';
export type {JointType3D, JointOptions3D} from './Physics3D.js';
export {PHYSICS3D_LIMITS, RigidBody3D, PhysicsWorld3D, CharacterController3D, createPhysicsWorld3D, createCharacterController3D} from './Physics3D.js';
export type {
    BodyType3D, ShapeDefinition3D, RigidBodyOptions3D, PhysicsRaycastHit3D, PhysicsWorldOptions3D, CharacterControllerOptions3D,
} from './Physics3D.js';
export {
    CURVE3D_LIMITS, Curve3D, LineCurve3D, QuadraticBezierCurve3D, CubicBezierCurve3D, CatmullRomCurve3D, CurvePath3D, Path2D3D, Shape3D,
    signedArea2D, triangulateShape3D,
} from './Curves3D.js';
export type {Point3D, Point2D, CatmullRomKind3D} from './Curves3D.js';
export {
    createCircleGeometry3D, createRingGeometry3D, createTorusKnotGeometry3D, createPolyhedronGeometry3D, createTetrahedronGeometry3D,
    createOctahedronGeometry3D, createIcosahedronGeometry3D, createDodecahedronGeometry3D, createLatheGeometry3D, createTubeGeometry3D,
    createShapeGeometry3D, createExtrudeGeometry3D, createWireframeGeometry3D, createEdgesGeometry3D, toNonIndexedGeometry3D,
    mergeGeometries3D, mergeVertices3D, transformGeometry3D,
} from './geometries3D.js';
export type {
    CircleGeometryOptions3D, RingGeometryOptions3D, TorusKnotGeometryOptions3D, PolyhedronOptions3D, LatheGeometryOptions3D,
    TubeGeometryOptions3D, ExtrudeGeometryOptions3D,
} from './geometries3D.js';
export {
    computeObjectBounds3D, LineHelper3D, BoxHelper3D, ArrowHelper3D, CameraHelper3D, LightHelper3D, SkeletonHelper3D,
    createBoxHelper3D, createArrowHelper3D, createCameraHelper3D, createLightHelper3D, createSkeletonHelper3D,
} from './debug3D.js';
export {HDR3D_LIMITS, parseRgbe3D, createCubeTextureFromEquirect3D} from './Hdr3D.js';
export type {HdrImage3D, EquirectOptions3D} from './Hdr3D.js';
export {PHYSICS_MESH3D_LIMITS, TriangleMeshShape3D, createMeshShape3D} from './PhysicsMesh3D.js';
export {BATCH3D_LIMITS, BatchedMesh3D, FatLine3D, createBatchedMesh3D, createFatLine3D} from './Batch3D.js';
export type {FatLineOptions3D} from './Batch3D.js';
export {PHYSICS_HULL3D_LIMITS, ConvexHullShape3D, createConvexHullShape3D} from './PhysicsHull3D.js';
export {TEXT3D_LIMITS, Font3D, parseTypefaceFont3D, parseTrueTypeFont3D, createTextShapes3D, createTextGeometry3D} from './Text3D.js';
export type {GlyphOutline3D, FontSource3D, TextLayoutOptions3D, TextGeometryOptions3D} from './Text3D.js';
export {TransformGizmo3D, createTransformGizmo3D} from './Gizmo3D.js';
export type {GizmoMode3D, GizmoSpace3D, GizmoHandle3D, TransformGizmoOptions3D} from './Gizmo3D.js';
