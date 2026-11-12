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

Directional and spot lights can cast shadows. Up to four shadow lights share one depth atlas, each with a quarter tile, filtered with a 3x3 comparison kernel. `light.shadow` sets the volume, bias, normal bias and filter radius. Meshes opt in with `castShadow` and `receiveShadow`. Point-light shadows and cascades are not implemented.

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

`loadGltf3D` reads `.glb` bytes or a parsed `.gltf` object and returns scenes, cameras, animations and the created resources with one `dispose()`. It supports meshes, metallic-roughness and unlit materials, texture transforms, node hierarchies, skins, morph targets, animations, cameras and punctual lights. Image decoding and external buffer loading are injected, so the reader stays DOM-free. The initial reader accepts disjoint scene roots and texture coordinate set 0. It refuses shared scene roots and alternate texture coordinate sets with a typed diagnostic. A single decoded accessor is limited to 128 MiB and the combined decoded accessors are limited to 256 MiB. Draco, meshopt and Basis compression and other required extensions are refused with `WORLD3D_GLTF_UNSUPPORTED`. `loadGltfFromUrl3D` in the browser entries supplies fetch and `createImageBitmap`.

## Renderers

Both renderers implement `Renderer3D`: `render(scene, camera, target?)`, `setSize`, `resizeToDisplaySize`, `readRenderTargetPixels`, `toneMapping`, `exposure`, `shadowsEnabled`, `info` and `dispose()`. They share the DOM-free render list, the per-frame uniform block and the shadow plan, so both draw the same passes: shadow atlas, opaque draws sorted by material and geometry, skybox, then blended draws back to front.

`createWebGL2Renderer3D(options)` is synchronous and owns its WebGL2 context. It handles context loss and restoration by rebuilding GPU state from the CPU scene.

`createWebGPURenderer3D(options)` is asynchronous. It requests a device or borrows `options.device`. A lost device is reported through `onDeviceLost`; create a new renderer to continue. Point topology draws one-pixel points, and render targets must have depth.

Output is tone mapped (`none`, `reinhard` or `aces`) and sRGB encoded. Normal and premultiplied source-over draws store alpha-weighted linear RGB in the sRGB render target with linear alpha. Raw RGBA8 readback preserves that encoding. Sampling the target as a material's base color map recovers straight linear RGB before shading. `blending: 'premultiplied'` accepts ordinary material color and opacity and premultiplies the shader output. Additive and multiply modes preserve destination alpha. Use normal or premultiplied source-over for transparent targets intended for later source-over composition.

## Engine integration

A World3D canvas is separate from the 2D stage surface. `createWorld3DHost(canvas)` returns a host for applications whose only surface is the 3D canvas. `startWorld3DLoop(engine)` advances the explicit Engine clock once per display frame and re-anchors it after a gap longer than the clock's delta limit.

`createWorld3DView(engine, scope, options)` subscribes to the Engine clock under a Scope. Each tick resizes the drawing buffer when needed, calls `onUpdate`, advances mixers, controls and particle emitters, and renders. Closing the Scope ends the view. The renderer, scene and controls stay owned by their creator; register them with `scope.use(...)` to retire them with the Scope.

For a 2D interface above a 3D scene, stack a transparent shared 2D host canvas over the World3D canvas. Drawing World3D content and ordered 2D content in one host remains the job of the authored scene path.

`createOrbitControls3D(camera, element, options)` provides orbit, pan and zoom with Pointer Events, including two-finger pan and pinch, damping and optional automatic rotation.

## Example and checks

The [World3D example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/world3d/README.md) shows lights, shadows, instancing, skinning, morphing, particles, a render target, picking and orbit controls on either backend.

Headless tests `tests/world3d-core.test.mjs`, `tests/world3d-animation-picking.test.mjs` and `tests/world3d-gltf.test.mjs` cover the DOM-free core through the public entry.

`tools/verify-world3d.mjs --playwright <installed-playwright-module> --output <new-directory> [--channel msedge]` renders seven fixed scenes into a render target on both backends and compares the images. During development it ran in headless Chromium with software rendering. The desktop review also ran all seven cases in Edge 157 on an NVIDIA RTX 5090 Laptop GPU without renderer override flags. The visible sample presented on both backends with antialiasing and stopped advancing frames on disposal.

## Open items

- The desktop review forced WebGL2 context loss and restored the target pixels. It also forced WebGPU device loss and verified notification and refusal of subsequent work. Wider device and recovery coverage remains open.
- One physical Android Chrome 157 device presented both backends, responded to an automated shadow toggle, and stopped frame updates on disposal. Performance, human gestures and a broader mobile device matrix remain open.
- Not implemented: point-light and cascaded shadows, post-processing, compressed textures and geometry, HDR environment prefiltering, clear coat and transmission materials, and physics.
