# World3D scene graph and renderers

English | [简体中文](../../Cns/docs/world3d.md)

## Purpose and scope

World3D is Egret's optional retained 3D scene graph. An application builds a tree of cameras, lights and meshes, edits it freely between frames and hands it to a renderer. It complements the immutable [authored 3D scenes](authored-scene3d.md), which stay the route for bounded 3D backgrounds that share one host with ordered 2D content.

The module has three explicit entries. Nothing in them is loaded by the default Engine, Canvas or shared 2D entries.

| Entry | Contents |
| --- | --- |
| `@egret/engine/world3d` | DOM-free core: math, scene graph, geometry, materials, textures, lights, cameras, animation, picking, particles, helpers and the glTF reader |
| `@egret/engine/webgl2/world3d` | WebGL2 renderer, orbit controls, browser loaders, Engine clock binding and a minimal host |
| `@egret/engine/webgpu/world3d` | WebGPU renderer with the same controls, loaders, binding and host |

The design was informed by publicly documented concepts of Three.js: a mutable scene graph with lazy world matrices, a per-frame render list sorted for few state changes, material variants compiled on demand and a mixer that blends animation actions. The implementation is first-party and independently written; no Three.js source was copied or adapted. Names follow Egret conventions: factory functions, a `3D` suffix, explicit ownership and disposal.

## Conventions

- Coordinates are right-handed with +Y up. Cameras and lights look along their local -Z axis. Matrices are column-major `Float32Array(16)`.
- Angles are radians, except the perspective field of view, which is vertical and in degrees.
- Colors are linear RGB. Factories also accept a `0xRRGGBB` sRGB number and convert it. Renderers encode sRGB on output.
- Texture coordinate V = 0 addresses the first stored row. Built-in primitives use V pointing up, so `loadTexture3D` flips rows by default; glTF textures are not flipped.
- Errors are `World3DError` values with a stable `code`, such as `WORLD3D_INPUT_INVALID`, `WORLD3D_BUDGET`, `WORLD3D_DISPOSED`, `WORLD3D_GLTF_INVALID`, `WORLD3D_GLTF_UNSUPPORTED` and `WORLD3D_CONTEXT_UNAVAILABLE`.

## Scene graph

`Object3D` stores position, a unit quaternion and scale in typed arrays, with `setPosition`, `setRotation`, `setQuaternion`, `setScale`, `rotateOnAxis`, `lookAt` and `setMatrix`. Direct array writes require `markTransformDirty()`. Local and world matrices are recomputed only for dirty nodes and their descendants, so a static subtree costs nothing per frame.

Hierarchy uses the familiar Egret names `addChild`, `addChildAt`, `removeChild`, `removeChildren`, `getChildAt` and `numChildren`. A node has one parent; adding it elsewhere moves it. Cycles, a scene as a child and depth beyond 256 are refused. `clone()` copies a subtree and shares geometries and materials by reference.

`Scene3D` is the root and carries the background (a color, a cube texture or nothing), an optional environment cube for image-based lighting and optional linear or exponential fog.

## Geometry, materials and textures

`Geometry3D` holds named `Attribute3D` arrays (`position`, `normal`, `tangent`, `uv`, `uv1`, `color`, `joints`, `weights`), an optional index, material groups and morph targets. Topologies are triangles, lines, line strips and points. Indices are validated against the vertex count. Bounding boxes and spheres are cached and include morph targets conservatively. `computeNormals()` and `computeTangents()` derive missing data.

Primitive factories cover box, plane, sphere, cylinder, cone, torus, capsule and quad. Helpers create grid, axes and box-edge line geometry.

`Material3D` is one class with a `shading` model: unlit, Lambert, Blinn-Phong or metallic-roughness standard. It carries base color and opacity, base color map, normal, metallic-roughness, occlusion and emissive maps, side, alpha mode (opaque, mask, blend), blending, depth test and write, vertex colors, flat shading, wireframe and polygon offset. Scalar and color edits take effect on the next frame. Call `touch()` after a change that alters shader features, such as adding a map or changing the alpha mode.

`Texture3D` wraps owned RGBA8 pixels or an opaque host image, with wrap, filter, mipmap, color space, anisotropy and a UV transform. `CubeTexture3D` takes six faces. `RenderTarget3D` is an off-screen color target whose `texture` can be used as a material map. `createGradientCubeTexture3D` builds a procedural sky.

Geometries, materials, textures and targets are resources with a `version` and a terminal `dispose()`. Renderers follow the version to refresh GPU copies and retire them when the resource is disposed. The core never references a backend.

## Lights and shadows

Ambient and hemisphere lights add indirect light. Directional, point and spot lights are punctual. A frame uses at most four directional, eight point and four spot lights; additional lights are ignored in traversal order.

Directional and spot lights can cast shadows. Up to four shadow lights share one depth atlas, each with a quarter tile, filtered with a 3x3 comparison kernel. `light.shadow` sets the volume, bias, normal bias and filter radius. Meshes opt in with `castShadow` and `receiveShadow`. A directional light with `shadow.cascades` from 2 to 4 splits its shadow by distance from the camera. Each cascade takes one atlas tile and covers a slice of the view up to `shadow.cascadeDistance`; `shadow.cascadeLambda` moves the split distances between even (0) and logarithmic (1) spacing. Cascade volumes are bounding spheres snapped to whole texels, so shadow edges stay still while the camera moves or turns, and neighbouring cascades blend across their seam. One light per scene is cascaded, and its cascades count toward the four atlas tiles.

## Meshes, instancing, skinning and morphing

`Mesh3D` pairs a geometry with one material or one material per group. `InstancedMesh3D` draws one geometry many times with per-instance matrices and optional RGB or RGBA colors. `Sprite3D` is a camera-facing quad.

Skinning uses `Bone3D` nodes and a `Skeleton3D` with inverse bind matrices; four influences per vertex are blended on the GPU. Morph targets store position and optional normal deltas; a draw blends the eight strongest weights.

`Lod3D` shows one child according to camera distance.

## Animation

`createAnimationClip3D` builds a clip from tracks that target a node by name and animate `position`, `quaternion`, `scale` or morph `weights` with step, linear or cubic interpolation. `AnimationMixer3D` creates one `AnimationAction3D` per clip. Actions repeat, play once or ping-pong, have a weight and time scale, and support `fadeIn`, `fadeOut` and `crossFadeTo`. Concurrent actions on one property are blended by weight; quaternions take the shortest path. `restorePose()` returns the pose captured at binding.

## Picking

`Raycaster3D` intersects a subtree and returns hits sorted by distance, with the world point, face index, interpolated UV and instance index. It tests bounding spheres first, respects material sides and layer masks, and can stop at the first hit per mesh. `setFromCamera` builds the ray from normalized device coordinates; the ray starts on the near plane.

## Particles

`ParticleEmitter3D` simulates particles on the CPU in flat arrays and draws them as one instanced, camera-facing batch. Options cover rate, lifetime, speed, cone spread, gravity, drag, size and color over life, point, sphere or box spawn volumes, world or local simulation space and a seed for a deterministic sequence. `burst(count)` emits immediately. One update step is clamped to 0.25 seconds.

## glTF

`loadGltf3D` reads `.glb` bytes or a parsed `.gltf` object and returns scenes, cameras, animations and the created resources with one `dispose()`. It supports meshes, metallic-roughness and unlit materials, texture transforms, node hierarchies, skins, morph targets, animations, cameras, punctual lights and `EXT_mesh_gpu_instancing` nodes, which load as `InstancedMesh3D`. Image decoding and external buffer loading are injected, so the reader stays DOM-free. The initial reader accepts disjoint scene roots and texture coordinate set 0. It refuses shared scene roots and alternate texture coordinate sets with a typed diagnostic. A single decoded accessor is limited to 128 MiB and the combined decoded accessors are limited to 256 MiB. Draco, meshopt and Basis payloads need a decoder supplied by the caller (see Compressed resources); without one they, and any other required extension, are refused with `WORLD3D_GLTF_UNSUPPORTED`. `loadGltfFromUrl3D` in the browser entries supplies fetch and `createImageBitmap`.

## Renderers

Both renderers implement `Renderer3D`: `render(scene, camera, target?)`, `setSize`, `resizeToDisplaySize`, `readRenderTargetPixels`, `toneMapping`, `exposure`, `shadowsEnabled`, `info` and `dispose()`. They share the DOM-free render list, the per-frame uniform block and the shadow plan, so both draw the same passes: shadow atlas, opaque draws sorted by material and geometry, skybox, then blended draws back to front.

`createWebGL2Renderer3D(options)` is synchronous and owns its WebGL2 context. It handles context loss and restoration by rebuilding GPU state from the CPU scene.

`createWebGPURenderer3D(options)` is asynchronous. It requests a device or borrows `options.device`. A lost device is reported through `onDeviceLost`; create a new renderer to continue. Point topology draws one-pixel points, and render targets must have depth.

Output is tone mapped (`none`, `reinhard` or `aces`) and sRGB encoded. Normal and premultiplied source-over draws store alpha-weighted linear RGB in the sRGB render target with linear alpha. Raw RGBA8 readback preserves that encoding. Sampling the target as a material's base color map recovers straight linear RGB before shading. `blending: 'premultiplied'` accepts ordinary material color and opacity and premultiplies the shader output. Additive and multiply modes preserve destination alpha. Use normal or premultiplied source-over for transparent targets intended for later source-over composition.

## Compressed resources

A texture source may be a block-compressed mip chain: `{width, height, format, levels}` with `format` one of `bc1`, `bc3`, `bc7`, `etc2-rgb8`, `etc2-rgba8` or `astc-4x4`. The chain is uploaded as stored, so it stays compressed in GPU memory. `renderer.supportsCompressedFormat(format)` reports what the device accepts; desktop GPUs usually offer BC, mobile GPUs ETC2 and ASTC.

`parseKtx23D(bytes, options)` reads a KTX2 container. Uncompressed RGBA8 and the block formats above are used directly. Basis Universal and supercompressed payloads are passed to `options.transcode`, which returns pixels or a compressed chain for the current device. `loadTexture3D` recognizes KTX2 files by their header.

The glTF reader accepts `KHR_texture_basisu`, `EXT_meshopt_compression` and `KHR_draco_mesh_compression` when the matching hook is supplied: `transcodeKtx2`, `decodeMeshopt` or `decodeDraco`. The engine ships no decoder; the hooks let an application plug in the reference WebAssembly decoders without the engine depending on them. A file that requires an extension whose hook is missing is rejected with `WORLD3D_GLTF_UNSUPPORTED`.

## Assets and saved scenes

`registerWorld3DAssets(engine.assets, options)` registers providers for `GLTF_ASSET_3D`, `TEXTURE_ASSET_3D`, `CUBE_TEXTURE_ASSET_3D` and `SCENE_ASSET_3D`. Acquire with `engine.assets.acquire(createAssetRef(GLTF_ASSET_3D, url))`. Leases are reference counted: concurrent requests share one load, cancellation aborts the download, and the last release disposes every GPU-facing resource the asset created. A cube texture id contains `{face}`, replaced by `px`, `nx`, `py`, `ny`, `pz` and `nz`.

`serializeScene3D(root, options)` writes a subtree as a JSON-safe document: transforms, cameras, lights, meshes, instanced meshes, materials, geometries, skeletons and level-of-detail groups. Shared geometries and materials are stored once. Textures with pixel or compressed sources up to 1 MiB are embedded; others are stored by the key `options.textureKey` returns and resolved again by `deserializeScene3D(document, {resolveTexture})`. Particle emitters and screen layers are written as plain nodes and listed in the `skipped` field of the result. `userData` keeps only JSON values. The result of `deserializeScene3D` owns what it created and releases it through `dispose()`.

## Post-processing

`renderer.postProcess` holds the settings; nothing runs until `enabled` is true. The scene is then drawn into a half-float target in scene-referred linear light, and a full-screen chain produces the final image: a dual-filter bloom pyramid (`bloomThreshold`, `bloomKnee`, `bloomIntensity`, `bloomLevels`), tone mapping with `brightness`, `saturation`, `contrast` and `vignette`, and optional FXAA. Both backends run the same passes and match to within one 8-bit step in the comparison tool.

`postProcess.ssao` adds screen-space ambient occlusion from scene depth, tuned by `ssaoRadius` (world units), `ssaoIntensity` and `ssaoBias`. `postProcess.outlineLayers` traces every object that has one of those bits in `layers`, with `outlineColor` and `outlineThickness` in pixels; the outline shows through objects in front, which suits selection and interaction highlights.

`postProcess.custom = createCustomPost3D({key, glsl, wgsl, uniforms})` adds an application pass after occlusion and bloom and before tone mapping. Its function `customPost(color, uv)` may call `sceneColor(uv)` and `sceneDepth(uv)`, the distance from the camera plane in world units, which is enough for depth fog, contact shadows and edge effects. Sixteen floats arrive as `uPostCustom[0..3]` in GLSL and `params.custom[0..3]` in WGSL. UV rows run bottom-up in GLSL and top-down in WGSL, so an offset in V points the opposite way on the two backends.

While post-processing is on, canvas multisampling does not apply; FXAA takes its place. The scene background colour is tone mapped together with the scene. `new RenderTarget3D(width, height, {format: 'rgba16f'})` gives applications the same half-float storage for their own passes; such targets skip tone mapping and cannot be read back as bytes. A WebGL2 device without float colour buffers falls back to 8-bit storage.

## 2D and 3D on one surface

`createScreenLayer3D(source, options)` draws a texture source across the whole surface as part of the scene. An overlay is blended after the scene; an `order: 'underlay'` layer is drawn first and covered by it. With `autoUpdate` the source is uploaded again each frame, so a canvas that the 2D stage renders into becomes an interface above, or a backdrop below, the 3D content in a single presented surface.

## Animation state machine

`createAnimationStateMachine3D(mixer)` drives a mixer from named states. A state plays one clip, or a `blend` of several clips selected by a numeric parameter; blended clips are time-scaled to a common cycle so their phases stay aligned. Transitions name a source state (or `*`), a target, a cross-fade `duration`, parameter `conditions` and an optional `exitTime`. `set(name, value)` writes a number or boolean, and `trigger(name)` raises a flag that the first matching transition consumes. A fade can be interrupted: every state continues from the weight it had reached. `addEvent(state, normalizedTime, callback)` fires on each pass, and `onStateChange` reports every switch. Call `update(deltaSeconds)` once per frame; it advances the mixer.

## Physics

`createPhysicsWorld3D(options)` creates a small rigid-body world for gameplay. Shapes are spheres, boxes, capsules and infinite planes; bodies are `static`, `kinematic` or `dynamic`. `world.step(deltaSeconds)` advances in fixed steps and then copies each body's pose to its `node`. Pairs are found by sweep and prune and resolved by a warm-started impulse solver with friction and restitution. Resting bodies sleep until something moving touches them. `layer` and `mask` filter collisions, `isTrigger` bodies report overlaps without pushing, and `onContactBegin` and `onContactEnd` report pairs.

Level geometry collides as a triangle mesh: `world.createBody({shape: {type: 'mesh', mesh: createMeshShape3D(levelRoot)}})`. `createMeshShape3D` accepts a geometry, or an object whose meshes are merged with their world transforms baked in. Mesh bodies are static, and triangles are solid on their front side. Spheres, capsules, the character controller and rays collide with the exact triangles; boxes rest on them through their corners. A bounding-volume hierarchy keeps the cost proportional to nearby triangles, and contacts at triangle seams are filtered so bodies cross them smoothly.

`world.raycast(origin, direction, maxDistance, mask)` returns the nearest solid body with the hit point and normal, and `world.overlapSphere(center, radius, mask)` lists solid bodies in a volume. `createCharacterController3D(world, options)` is a kinematic capsule: `move(dx, dy, dz)` slides along obstacles and reports `isGrounded`, `groundNormal` and `groundBody`.

The solver has no joints, continuous collision detection, convex hulls or moving triangle meshes. Fast, small bodies can pass through thin geometry; keep walls thicker than the distance a body moves in one step.

## Curves, outlines and more geometries

Curves (`LineCurve3D`, `QuadraticBezierCurve3D`, `CubicBezierCurve3D`, `CatmullRomCurve3D`, `CurvePath3D`) answer `getPoint(t)`, the constant-speed `getPointAt(u)`, tangents, lengths and twist-free frames. `Path2D3D` and `Shape3D` build flat outlines with `moveTo`, `lineTo`, `quadraticCurveTo`, `bezierCurveTo` and `arc`; a shape may carry holes.

Further builders: `createCircleGeometry3D`, `createRingGeometry3D`, `createTorusKnotGeometry3D`, `createTetrahedronGeometry3D`, `createOctahedronGeometry3D`, `createIcosahedronGeometry3D`, `createDodecahedronGeometry3D`, `createPolyhedronGeometry3D`, `createLatheGeometry3D`, `createTubeGeometry3D`, `createShapeGeometry3D` and `createExtrudeGeometry3D` (straight or along a curve; caps and walls are separate material groups; bevels are not generated). Utilities: `createEdgesGeometry3D`, `createWireframeGeometry3D`, `mergeGeometries3D`, `mergeVertices3D`, `toNonIndexedGeometry3D` and `transformGeometry3D`.

## Stylized and custom materials

`createToonMaterial3D({steps})` quantizes diffuse light into flat bands. `createMatcapMaterial3D({matcap})` looks colour up from a sphere image by the view-space normal and needs no lights. A standard material gains a lacquer layer with `clearcoat` and `clearcoatRoughness`.

`material.shader = createCustomShader3D({key, glsl, wgsl, uniforms})` adds a fragment hook to any material. The hook is a function named `customFragment` that receives the shaded linear colour with alpha, the world position, the normal and the UV, and returns the new colour; it may `discard`. Sixteen floats are available as `uCustom[0..3]` in GLSL and `material.custom[0..3]` in WGSL; write `shader.uniforms` each frame for time-driven effects. Supply source for each backend you ship; a backend without source draws the material unchanged. Call `material.touch()` after assigning a different shader.

The same object may carry a vertex hook, `glslVertex` and `wgslVertex`: a function named `customVertex` that receives the world position, local position, normal, UV and vertex colour and returns the displaced world position. It runs in the visible pass and in every shadow map, so foliage that sways in the wind casts a shadow that sways with it. A vertex hook may use only its arguments and the custom parameters, because camera data is not bound while shadows are drawn.

## Point-light shadows, environments and views

One point light may cast shadows (`createPointLight3D({castShadow: true})`). It renders four maps through the faces of a tetrahedron, so every direction is covered with ordinary perspective maps and the same filtering as other lights. It takes the whole atlas and applies when no directional or spot light casts shadows.

`parseRgbe3D(bytes)` decodes a Radiance `.hdr` file and `createCubeTextureFromEquirect3D(image, {size, exposure, maxValue})` turns a panorama into a cube texture for `scene.background` and `scene.environment`. Cube faces are stored in 8 bits after exposure and highlight compression. `captureCubeTexture3D(renderer, scene, position, options)` bakes the scene around a point into a cube texture for local reflections; it reads pixels back and is meant for load time.

`renderer.viewport = [x, y, width, height]` (0 to 1, origin at the bottom left) limits drawing to part of the output, and `renderer.autoClear = false` keeps what earlier views drew. Together they give split screens, inset maps and picture-in-picture from several `render()` calls in one frame.

`scene.clippingPlanes` holds up to four world-space planes as `[nx, ny, nz, d]`; fragments on the negative side are not drawn, for cutaways and water-line reflections. `scene.overrideMaterial` draws every mesh with one material.

## Helpers, first-person controls and sound

`createBoxHelper3D`, `createArrowHelper3D`, `createCameraHelper3D`, `createLightHelper3D` and `createSkeletonHelper3D` are line nodes that follow their subject; call `update()` after it moves. `computeObjectBounds3D(object)` returns world bounds of a subtree.

`createFlyControls3D(camera, element, options)` looks with pointer lock or drag and moves with the keyboard, either flying or walking on a level plane. `createAudioListener3D()` and `createPositionalAudio3D(listener, options)` place Web Audio sources in the scene with distance attenuation and cones; call `listener.update()` each frame and `listener.resume()` from a user gesture.

## Coming from Three.js

| Three.js | World3D |
| --- | --- |
| `Scene`, `Object3D`, `Group`, `Mesh`, `InstancedMesh`, `SkinnedMesh`, `LOD`, `Sprite` | `Scene3D`, `Object3D`, `Mesh3D`, `InstancedMesh3D`, `Mesh3D.bind(skeleton)`, `Lod3D`, `createSprite3D` |
| `PerspectiveCamera`, `OrthographicCamera` | `createPerspectiveCamera3D`, `createOrthographicCamera3D` |
| `BufferGeometry`, `BufferAttribute` | `Geometry3D`, `Attribute3D`, `createGeometry3D` |
| `BoxGeometry` ... `TorusKnotGeometry`, `ExtrudeGeometry`, `LatheGeometry`, `TubeGeometry`, `ShapeGeometry`, `EdgesGeometry` | `createBoxGeometry3D` ... `createTorusKnotGeometry3D`, `createExtrudeGeometry3D`, `createLatheGeometry3D`, `createTubeGeometry3D`, `createShapeGeometry3D`, `createEdgesGeometry3D` |
| `BufferGeometryUtils.mergeGeometries`, `mergeVertices` | `mergeGeometries3D`, `mergeVertices3D` |
| `Curve`, `CatmullRomCurve3`, `Shape`, `Path` | `Curve3D`, `CatmullRomCurve3D`, `Shape3D`, `Path2D3D` |
| `MeshBasicMaterial`, `MeshLambertMaterial`, `MeshPhongMaterial`, `MeshStandardMaterial` | `createUnlitMaterial3D`, `createLambertMaterial3D`, `createPhongMaterial3D`, `createStandardMaterial3D` |
| `MeshToonMaterial`, `MeshMatcapMaterial`, `MeshPhysicalMaterial.clearcoat` | `createToonMaterial3D`, `createMatcapMaterial3D`, `material.clearcoat` |
| `ShaderMaterial`, `onBeforeCompile`, `customDepthMaterial` | `createCustomShader3D` assigned to `material.shader`; its vertex hook also shapes shadows |
| `LineBasicMaterial`, `PointsMaterial`, `SpriteMaterial` | `createLineMaterial3D`, `createSpriteMaterial3D` with a `lines` or `points` geometry |
| `Texture`, `DataTexture`, `CanvasTexture`, `CompressedTexture`, `CubeTexture`, `WebGLRenderTarget` | `Texture3D` (pixels, images, canvases or compressed chains), `CubeTexture3D`, `RenderTarget3D` |
| `AmbientLight`, `HemisphereLight`, `DirectionalLight`, `PointLight`, `SpotLight` | `createAmbientLight3D`, `createHemisphereLight3D`, `createDirectionalLight3D`, `createPointLight3D`, `createSpotLight3D` |
| `light.shadow`, `CSM` | `light.shadow`, `light.shadow.cascades` |
| `Fog`, `FogExp2`, `scene.background`, `scene.environment` | `scene.fog`, `scene.background`, `scene.environment` |
| `AnimationMixer`, `AnimationClip`, `AnimationAction` | `AnimationMixer3D`, `AnimationClip3D`, `AnimationAction3D`, plus `AnimationStateMachine3D` |
| `Raycaster` | `Raycaster3D` |
| `GLTFLoader`, `KTX2Loader`, `DRACOLoader`, `MeshoptDecoder`, `RGBELoader`, `TextureLoader` | `loadGltfFromUrl3D` with decoder hooks, `parseKtx23D`, `parseRgbe3D`, `loadTexture3D` |
| `LoadingManager`, `Cache` | `registerWorld3DAssets` on the Engine `AssetManager` |
| `ObjectLoader`, `toJSON` | `deserializeScene3D`, `serializeScene3D` |
| `WebGLRenderer`, `WebGPURenderer`, `setViewport`, `autoClear` | `createWebGL2Renderer3D`, `createWebGPURenderer3D`, `renderer.viewport`, `renderer.autoClear` |
| `EffectComposer`, `UnrealBloomPass`, `OutputPass`, `FXAAShader`, `SSAOPass`, `OutlinePass`, `ShaderPass`, `DepthTexture` | `renderer.postProcess` with `ssao`, `outlineLayers` and `custom` (`sceneDepth`) |
| `renderer.clippingPlanes`, `scene.overrideMaterial` | `scene.clippingPlanes`, `scene.overrideMaterial` |
| `CubeCamera`, `PMREMGenerator.fromEquirectangular` | `captureCubeTexture3D`, `createCubeTextureFromEquirect3D` |
| `OrbitControls`, `PointerLockControls`, `FlyControls` | `createOrbitControls3D`, `createFlyControls3D` |
| `AudioListener`, `PositionalAudio` | `createAudioListener3D`, `createPositionalAudio3D` |
| `BoxHelper`, `ArrowHelper`, `CameraHelper`, light helpers, `SkeletonHelper`, `GridHelper`, `AxesHelper` | the matching `create...Helper3D` functions |
| physics add-ons such as cannon-es or Rapier, trimesh colliders | `createPhysicsWorld3D`, `createCharacterController3D`, `createMeshShape3D` |

Differences to keep in mind: factories replace constructors; colours are linear RGB arrays or hex numbers; vectors and quaternions are typed arrays changed through `setPosition`, `setRotation`, `setScale` and `lookAt`; resources are released with `dispose()`; and errors are `World3DError` with a `code`.

## Engine integration

A World3D canvas is separate from the 2D stage surface. `createWorld3DHost(canvas)` returns a host for applications whose only surface is the 3D canvas. `startWorld3DLoop(engine)` advances the explicit Engine clock once per display frame and re-anchors it after a gap longer than the clock's delta limit.

`createWorld3DView(engine, scope, options)` subscribes to the Engine clock under a Scope. Each tick resizes the drawing buffer when needed, calls `onUpdate`, advances mixers, controls and particle emitters, and renders. Closing the Scope ends the view. The renderer, scene and controls stay owned by their creator; register them with `scope.use(...)` to retire them with the Scope.

For a 2D interface above a 3D scene, either stack a transparent shared 2D host canvas over the World3D canvas or draw the 2D canvas as a screen layer (see 2D and 3D on one surface). Interleaving individual 2D display objects between 3D objects in depth remains the job of the authored scene path.

`createOrbitControls3D(camera, element, options)` provides orbit, pan and zoom with Pointer Events, including two-finger pan and pinch, damping and optional automatic rotation.

## Example and checks

The [World3D example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/world3d/README.md) shows lights, shadows, instancing, skinning, morphing, particles, a render target, picking and orbit controls on either backend.

Headless tests `tests/world3d-core.test.mjs`, `tests/world3d-animation-picking.test.mjs`, `tests/world3d-gltf.test.mjs`, `tests/world3d-renderer-lifetime.test.mjs`, `tests/world3d-extended.test.mjs` and `tests/world3d-parity.test.mjs` cover the DOM-free core, the asset providers, the state machine and physics through the public entries.

`tools/verify-world3d.mjs --playwright <installed-playwright-module> --output <new-directory> [--channel msedge]` renders sixteen fixed scenes into a render target on both backends and compares the images. The newer scenes cover cascaded shadows, post-processing, a compressed texture, screen layers, a scene restored from its saved document, stylized and custom materials, point-light shadows, screen-space occlusion with outlines and clipping, and a vertex hook with its shadows. During development all sixteen ran in headless Chromium with software rendering. The desktop review ran the first fourteen cases in Edge 157 on an NVIDIA RTX 5090 Laptop GPU without renderer override flags. The visible sample presented on both backends with antialiasing and stopped advancing frames on disposal.

`tools/bench-world3d.mjs --playwright <installed-playwright-module>` measures the CPU time of `render()` for fixed workloads on both backends, as a baseline for regressions rather than an absolute score.

## Open items

- The desktop review forced WebGL2 context loss and restored the target pixels. It also forced WebGPU device loss and verified notification and refusal of subsequent work. Wider device and recovery coverage remains open.
- One physical Android Chrome 157 device presented both backends, responded to an automated shadow toggle, and stopped frame updates on disposal. Performance, human gestures and a broader mobile device matrix remain open.
- Cascaded and point-light shadows, post-processing, compressed textures, screen layers, toon, matcap, clearcoat and custom shaders, viewports and probes have run only under software rendering so far, where both backends matched; they, the seven newer comparison scenes and the benchmark still need a pass on physical desktop and mobile GPUs. First-person controls and spatial audio have not been exercised by a person.
- Not implemented: bundled Basis, meshopt or Draco decoders, float-precision environment prefiltering, transmission and sheen, a depth-of-field pass, transform gizmos, text geometry, physics joints, convex hulls and moving mesh colliders.
