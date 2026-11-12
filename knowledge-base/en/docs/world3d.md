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

`loadGltf3D` reads `.glb` bytes or a parsed `.gltf` object and returns scenes, cameras, animations and the created resources with one `dispose()`. It supports meshes, metallic-roughness and unlit materials, texture transforms, node hierarchies, skins, morph targets, animations, cameras, punctual lights and `EXT_mesh_gpu_instancing` nodes, which load as `InstancedMesh3D`. Image decoding and external buffer loading are injected, so the reader stays DOM-free. The reader accepts disjoint scene roots. Occlusion and emissive textures may use texture coordinate set 0 or 1, which is where baked lighting usually lives; they set `texture.channel`, and the same property works on any occlusion or emissive map assigned by hand. Base colour, normal and metallic-roughness textures use set 0. Shared scene roots and other coordinate sets are refused with a typed diagnostic. A single decoded accessor is limited to 128 MiB and the combined decoded accessors are limited to 256 MiB. Generated instance transform matrices share a 64 MiB budget per asset, across nodes and primitives. Meshopt decoding is built in. Draco and Basis payloads use application-supplied adapters; required extensions without an available decoder are refused with `WORLD3D_GLTF_UNSUPPORTED`. See Compressed resources. `loadGltfFromUrl3D` in the browser entries supplies fetch and `createImageBitmap`.

The surface extensions `KHR_materials_transmission`, `KHR_materials_ior`, `KHR_materials_volume`, `KHR_materials_clearcoat` and `KHR_materials_sheen` are read as their plain factors; the textures those extensions may carry are not used.

## Renderers

Both renderers implement `Renderer3D`: `render(scene, camera, target?)`, `setSize`, `resizeToDisplaySize`, `readRenderTargetPixels`, `toneMapping`, `exposure`, `shadowsEnabled`, `info` and `dispose()`. They share the DOM-free render list, the per-frame uniform block and the shadow plan, so both draw the same passes: shadow atlas, opaque draws sorted by material and geometry, skybox, then blended draws back to front.

`createWebGL2Renderer3D(options)` is synchronous and owns its WebGL2 context. It handles context loss and restoration by rebuilding GPU state from the CPU scene.

`createWebGPURenderer3D(options)` is asynchronous. It requests a device or borrows `options.device`. A lost device is reported through `onDeviceLost`; create a new renderer to continue. Point topology draws one-pixel points, and render targets must have depth.

Output is tone mapped (`none`, `reinhard` or `aces`) and sRGB encoded. Normal and premultiplied source-over draws store alpha-weighted linear RGB in the sRGB render target with linear alpha. Raw RGBA8 readback preserves that encoding. Sampling the target as a material's base color map recovers straight linear RGB before shading. `blending: 'premultiplied'` accepts ordinary material color and opacity and premultiplies the shader output. Additive and multiply modes preserve destination alpha. Use normal or premultiplied source-over for transparent targets intended for later source-over composition.

## Compressed resources

A texture source may be a block-compressed mip chain: `{width, height, format, levels}` with `format` one of `bc1`, `bc3`, `bc7`, `etc2-rgb8`, `etc2-rgba8` or `astc-4x4`. The chain is uploaded as stored, so it stays compressed in GPU memory. `renderer.supportsCompressedFormat(format)` reports what the device accepts; desktop GPUs usually offer BC, mobile GPUs ETC2 and ASTC.

`parseKtx23D(bytes, options)` reads a KTX2 container. Uncompressed RGBA8 and the block formats above are used directly. An explicit `options.transcode` retains precedence for supercompressed or unknown-format payloads and returns pixels or a compressed chain for the device. Without this callback, the reader unwraps known formats wrapped in Zstandard or zlib. It checks every mip’s exact expected decoded size before decompression. Basis Universal still needs a transcoder. `loadTexture3D` recognizes KTX2 files by their header.

`EXT_meshopt_compression` is decoded by the engine itself: `decodeMeshopt3D` implements the vertex, triangle and index-sequence codecs and the octahedral, quaternion and exponential filters in TypeScript, so such files load with no extra option. A `decodeMeshopt` hook, if given, replaces it, for example with the WebAssembly decoder for very large files. The KTX2 reader also unwraps Zstandard and zlib supercompression around levels it can read (`decompressZstd3D` and `inflate3D` are exported for other uses); Zstandard dictionaries are not supported. Format references are the [KTX 2.0 specification](https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html), the [EXT_meshopt_compression bitstream specification](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression), [RFC 1950](https://www.rfc-editor.org/rfc/rfc1950), [RFC 1951](https://www.rfc-editor.org/rfc/rfc1951) and [RFC 8878](https://www.rfc-editor.org/rfc/rfc8878).

`KHR_draco_mesh_compression` and Basis Universal textures (`KHR_texture_basisu`) still need their official WebAssembly decoders, which the engine does not ship. The application loads the module and wraps it: `decodeDraco: createDracoDecoder3D(dracoModule)` and `transcodeKtx2: createBasisTranscoder3D(basisModule, format => renderer.supportsCompressedFormat(format))`. The Basis adapter picks the best compressed format the device supports and falls back to plain RGBA. A file that requires Draco without the hook is rejected with `WORLD3D_GLTF_UNSUPPORTED`. Both adapters were written against the modules' documented interfaces and tested with stand-ins; they have not yet been run against the real modules.

## Assets and saved scenes

`registerWorld3DAssets(engine.assets, options)` registers providers for `GLTF_ASSET_3D`, `TEXTURE_ASSET_3D`, `CUBE_TEXTURE_ASSET_3D` and `SCENE_ASSET_3D`. Acquire with `engine.assets.acquire(createAssetRef(GLTF_ASSET_3D, url))`. Leases are reference counted: concurrent requests share one load, cancellation aborts the download, and the last release disposes every GPU-facing resource the asset created. A cube texture id contains `{face}`, replaced by `px`, `nx`, `py`, `ny`, `pz` and `nz`.

`serializeScene3D(root, options)` writes a subtree as a JSON-safe document: transforms, cameras, lights, meshes, instanced meshes, materials, geometries, skeletons and level-of-detail groups. Shared geometries and materials are stored once. Textures with pixel or compressed sources up to 1 MiB are embedded and retain their UV channel. Other textures are stored using the key returned by `options.textureKey`, and `deserializeScene3D(document, {resolveTexture})` uses the caller's resolved texture. Particle emitters and screen layers are written as plain nodes and listed in the `skipped` field of the result. `userData` keeps only JSON values. The result of `deserializeScene3D` owns what it created and releases it through `dispose()`.

## Post-processing

`renderer.postProcess` holds the settings; nothing runs until `enabled` is true. The scene is then drawn into a half-float target in scene-referred linear light, and a full-screen chain produces the final image: a dual-filter bloom pyramid (`bloomThreshold`, `bloomKnee`, `bloomIntensity`, `bloomLevels`), tone mapping with `brightness`, `saturation`, `contrast` and `vignette`, and optional FXAA. Both backends run the same passes and match to within one 8-bit step in the comparison tool.

`postProcess.ssao` adds screen-space ambient occlusion from scene depth, tuned by `ssaoRadius` (world units), `ssaoIntensity` and `ssaoBias`. `postProcess.outlineLayers` traces every object that has one of those bits in `layers`, with `outlineColor` and `outlineThickness` in pixels; the outline shows through foreground objects and uses the base silhouette before material alpha cutouts or custom vertex displacement.

`postProcess.dof` blurs what lies nearer or farther than `dofFocus` plus or minus `dofRange` (world units), up to `dofRadius` pixels. Sharp pixels gather nothing, so focused objects keep crisp edges against a blurred backdrop.

`postProcess.custom = createCustomPost3D({key, glsl, wgsl, uniforms})` adds an application pass after occlusion and bloom and before tone mapping. Its function `customPost(color, uv)` may call `sceneColor(uv)` and `sceneDepth(uv)`, the distance from the camera plane in world units, which is enough for depth fog, contact shadows and edge effects. Sixteen floats arrive as `uPostCustom[0..3]` in GLSL and `params.custom[0..3]` in WGSL. The post pass reconstructs depth from the sampled screen coordinates and the inverse projection matrix. This covers off-center and oblique projections when the camera fills the post-processing target. Assign a complete invertible matrix to `camera.customProjection` to use a custom projection. UV rows run bottom-up in GLSL and top-down in WGSL, so an offset in V points the opposite way on the two backends.

While post-processing is on, canvas multisampling does not apply; FXAA takes its place. The scene background colour is tone mapped together with the scene. `new RenderTarget3D(width, height, {format: 'rgba16f'})` gives applications the same half-float storage for their own passes; such targets skip tone mapping and cannot be read back as bytes. A WebGL2 device without float colour buffers falls back to 8-bit storage.

## 2D and 3D on one surface

`createScreenLayer3D(source, options)` draws a texture source across the whole surface as part of the scene. An overlay is blended after the scene; an `order: 'underlay'` layer is drawn first and covered by it. With `autoUpdate` the source is uploaded again each frame, so a canvas that the 2D stage renders into becomes an interface above, or a backdrop below, the 3D content in a single presented surface.

## Animation state machine

`createAnimationStateMachine3D(mixer)` drives a mixer from named states. A state plays one clip, or a `blend` of several clips selected by a numeric parameter; blended clips are time-scaled to a common cycle so their phases stay aligned. Transitions name a source state (or `*`), a target, a cross-fade `duration`, parameter `conditions` and an optional `exitTime`. `set(name, value)` writes a number or boolean, and `trigger(name)` raises a flag that the first matching transition consumes. A fade can be interrupted: every state continues from the weight it had reached. `addEvent(state, normalizedTime, callback)` fires on each pass, and `onStateChange` reports every switch. Call `update(deltaSeconds)` once per frame; it advances the mixer.

## Physics

`createPhysicsWorld3D(options)` creates a small rigid-body world for gameplay. Shapes are spheres, boxes, capsules and infinite planes; bodies are `static`, `kinematic` or `dynamic`. `world.step(deltaSeconds)` advances in fixed steps and then copies each body's pose to its `node`. Pairs are found by sweep and prune and resolved by a warm-started impulse solver with friction and restitution. Resting bodies sleep until something moving touches them. `layer` and `mask` filter collisions, `isTrigger` bodies report overlaps without pushing, and `onContactBegin` and `onContactEnd` report pairs.

Level geometry collides as a triangle mesh: `world.createBody({shape: {type: 'mesh', mesh: createMeshShape3D(levelRoot)}})`. `createMeshShape3D` accepts a triangle geometry or an object subtree. It merges non-instanced, unskinned triangle meshes using their base geometry and current world transforms. Mesh bodies are static, or kinematic for moving platforms, and triangles are solid on their front side. Spheres, capsules, the character controller and rays collide with the exact triangles; boxes rest on them through their corners. A bounding-volume hierarchy keeps the cost proportional to nearby triangles, and contacts at triangle seams are filtered so bodies cross them smoothly.

`world.raycast(origin, direction, maxDistance, mask)` returns the nearest solid body with the hit point and normal, and `world.overlapSphere(center, radius, mask)` lists solid bodies in a volume. `createCharacterController3D(world, options)` is a kinematic capsule: `move(dx, dy, dz)` slides along obstacles and reports `isGrounded`, `groundNormal` and `groundBody`.

`createCharacterMotor3D(world, options)` builds a walking, jumping character on that capsule. After `world.step()`, call `motor.update(deltaSeconds, wishX, wishZ, jump)` with the horizontal velocity the player asks for. The motor applies gravity and jumping (`jumpSpeed`, with a short `coyoteTime` after walking off a ledge), ground and air acceleration (`acceleration`, `airControl`), climbs ledges up to `stepHeight` and stays on the ground when walking down steps and slopes, and stops rising under a ceiling. A kinematic or dynamic body under its feet carries it along, including around a turning platform; `motor.carriedYaw` is the turn to add to the character's facing, and leaving a moving platform keeps its speed. Walking into dynamic bodies pushes them at the character's pace, limited by `pushForce`. Move platforms with velocities, not by writing positions, so the motor can see how they move. Low steps are climbed by the capsule's rounded foot at reduced speed; long staircases walk better over a ramp collider. `motor.teleport(x, y, z)` repositions the character and clears its motion. A non-finite coordinate is rejected before any position or motion changes.

`createFollowCamera3D(camera, target, {world, distance, height, yaw, pitch})` keeps a camera behind an object, and moves it closer at once when a solid body would hide the target, easing back out over `recovery` seconds. `moveDirection(forward, right)` turns stick or key input into a world direction relative to the view. The browser entries add `createFollowControls3D(camera, element, target, options)`: drag to look around, scroll or pinch for distance, with the rig in `controls.follow`. Call `controls.dispose()` when removing the controls. It releases their pointer captures and restores the previous inline `touch-action` while the controls still own that style.

A body's `node` is placed at the body when it is added to the world, and follows it after every step unless the body is static.

`{type: 'convex', hull: createConvexHullShape3D(geometryOrPoints)}` is a convex solid for moving props; more than 64 corners are reduced to the most extreme ones. Hulls collide exactly with planes and, through their corners, with meshes; against spheres, capsules, boxes and other hulls they use face planes and corner containment, and where two edges cross without any corner inside the other solid, a contact is placed between those edges.

`world.createJoint(options)` connects two bodies, or pins one to the world, from world-space anchors: `point` (ball and socket), `hinge` (with an `axis`), `fixed` (weld) and `distance` (a rod, or a `rope` that goes slack). Jointed bodies do not collide with each other unless `collideConnected` is set.

A hinge takes `limits: [min, max]`, in radians from the pose it was created in, and a motor: `motorSpeed` is the turning speed it drives toward and `maxMotorTorque` the strength it may use; a motor with zero speed acts as a brake. A point joint takes `coneLimit`, the widest angle the two bodies may swing apart around `axis`. `joint.angle` reports the current angle, counted as bodyA turning relative to bodyB or the world. Limits and motor values may be changed at any time.

`continuous: true` on a body is for projectiles and other small, fast things: each step its travel is cut short at the first surface on its path, so it cannot pass through a thin wall. The path is probed along the line of the body's center, which catches what the body would hit head-on but not what only its side would graze.

The solver has no sliding or spring joints. Without `continuous`, fast, small bodies can pass through thin geometry; keep walls thicker than the distance a body moves in one step.

## Curves, outlines and more geometries

Curves (`LineCurve3D`, `QuadraticBezierCurve3D`, `CubicBezierCurve3D`, `CatmullRomCurve3D`, `CurvePath3D`) answer `getPoint(t)`, the constant-speed `getPointAt(u)`, tangents, lengths and twist-free frames. `Path2D3D` and `Shape3D` build flat outlines with `moveTo`, `lineTo`, `quadraticCurveTo`, `bezierCurveTo` and `arc`; a shape may carry holes.

Further builders: `createCircleGeometry3D`, `createRingGeometry3D`, `createTorusKnotGeometry3D`, `createTetrahedronGeometry3D`, `createOctahedronGeometry3D`, `createIcosahedronGeometry3D`, `createDodecahedronGeometry3D`, `createPolyhedronGeometry3D`, `createLatheGeometry3D`, `createTubeGeometry3D`, `createShapeGeometry3D` and `createExtrudeGeometry3D` (straight or along a curve; caps and walls are separate material groups; bevels are not generated). Utilities: `createEdgesGeometry3D`, `createWireframeGeometry3D`, `mergeGeometries3D`, `mergeVertices3D`, `toNonIndexedGeometry3D` and `transformGeometry3D`.

## Stylized and custom materials

`createToonMaterial3D({steps})` quantizes diffuse light into flat bands. `createMatcapMaterial3D({matcap})` looks colour up from a sphere image by the view-space normal and needs no lights. A standard material gains a lacquer layer with `clearcoat` and `clearcoatRoughness`, a soft cloth rim with `sheen`, `sheenColor` and `sheenRoughness`, and see-through glass with `transmission` (`createGlassMaterial3D`). A transmitting surface shows what was drawn before it: the renderer copies the picture once the opaque objects and the background are done, and the surface reads that copy, tinted by its color and blurred by its roughness, while keeping its own reflections. `thickness` (world units) together with `ior` bends the view as a solid block would; a thickness of zero is a thin sheet that does not bend it. `attenuationColor` and `attenuationDistance` deepen the tint with the distance travelled inside. Transmitting materials are drawn with the transparent objects whatever their `alphaMode`. Only one layer is seen: other see-through and transparent objects behind such a surface do not show through it, and the bending is worked out at the entry surface alone, so a glass ball magnifies what is behind it instead of turning it upside down.

Any lit material accepts `lightMap` and `lightMapIntensity` for baked lighting, added to its indirect light. The map is sampled with its `channel`, normally 1 so the bake can use a second, non-overlapping UV set.

`material.shader = createCustomShader3D({key, glsl, wgsl, uniforms})` adds a fragment hook to any material. The hook is a function named `customFragment` that receives the shaded linear colour with alpha, the world position, the normal and the UV, and returns the new colour; it may `discard`. Sixteen floats are available as `uCustom[0..3]` in GLSL and `material.custom[0..3]` in WGSL; write `shader.uniforms` each frame for time-driven effects. Supply source for each backend you ship; a backend without source draws the material unchanged. Call `material.touch()` after assigning a different shader.

The same object may carry a vertex hook, `glslVertex` and `wgslVertex`: a function named `customVertex` that receives the world position, local position, normal, UV and vertex colour and returns the displaced world position. It runs in the visible pass and in every shadow map, so foliage that sways in the wind casts a shadow that sways with it. A vertex hook may use only its arguments and the custom parameters, because camera data is not bound while shadows are drawn.

## Point-light shadows, environments and views

One point light may cast shadows (`createPointLight3D({castShadow: true})`). It renders four maps through the faces of a tetrahedron, so every direction is covered with ordinary perspective maps and the same filtering as other lights. It takes the whole atlas and applies when no directional or spot light casts shadows.

`parseRgbe3D(bytes)` decodes a Radiance `.hdr` file and `createCubeTextureFromEquirect3D(image, {size, exposure, maxValue})` turns a panorama into a cube texture for `scene.background` and `scene.environment`. Cube faces are stored in 8 bits after exposure and highlight compression. `captureCubeTexture3D(renderer, scene, position, options)` bakes the scene around a point into a cube texture for local reflections; it reads pixels back and is meant for load time.

`renderer.viewport = [x, y, width, height]` (0 to 1, origin at the bottom left) limits drawing to part of the output, and `renderer.autoClear = false` keeps what earlier views drew. Together they give split screens, inset maps and picture-in-picture from several `render()` calls in one frame.

`scene.clippingPlanes` holds up to four world-space planes as `[nx, ny, nz, d]`; fragments on the negative side are not drawn, for cutaways and water-line reflections. `scene.overrideMaterial` draws every mesh with one material.

## Batches and wide lines

`createBatchedMesh3D(material)` draws many different geometries that share one material in a single call. `addGeometry(geometry, matrix)` returns an id; `setMatrixAt`, `setVisibleAt`, `setColorAt` and `deleteGeometry` change one item afterwards. The combined buffers are rebuilt only when something changed, so it suits props that move rarely.

`createFatLine3D(points, {width, screenSpace, closed, color})` draws a polyline as a ribbon that turns to face the camera, with mitred joints. The width is in world units, or in pixels with `screenSpace` when `resolutionHeight` is set to the output height.

## Text

`createTextGeometry3D(text, font, {size, depth, align, letterSpacing, lineHeight, curveSegments})` turns a string into a mesh geometry in the XY plane with its first baseline on y = 0. With `depth` it is an extrusion with two material groups, faces and sides; with `depth: 0` it is flat. `createTextShapes3D` returns the outlines alone, and `font.measureText` the width.

A font comes from `parseTrueTypeFont3D(bytes)`, which reads a `.ttf` file directly (also an OpenType file with TrueType outlines, or the first font of a `.ttc` collection), or from `parseTypefaceFont3D(json)` for the typeface JSON format used with web 3D libraries. Glyphs are decoded when first used, so a large Chinese, Japanese or Korean font costs only what the text needs. Fonts with PostScript (CFF) outlines are rejected. Characters are placed left to right one after another with no kerning or shaping, so scripts that join or reorder letters, such as Arabic or Devanagari, are not laid out correctly. Extrusions have sharp edges; bevels are not generated.

## Transform gizmo

`createTransformControls3D(camera, element)` from the browser entry gives handles for moving, turning and resizing an object with the pointer. Add `controls.gizmo` to the scene, `attach(object)`, and call `controls.update()` once per frame. `mode` is `'translate'`, `'rotate'` or `'scale'`; `space` is `'world'` or `'local'`; `translationSnap`, `rotationSnap` and `scaleSnap` on the gizmo set step sizes. The handles keep a constant size on screen and draw over the scene.

Create the transform controls before orbit or fly controls on the same element: a press that lands on a handle is then kept from them. `gizmo.onDraggingChanged` reports the start and end of a drag for applications that pause camera controls themselves, and `gizmo.onChange` reports every change.

The gizmo itself, `createTransformGizmo3D(camera)` from the core entry, takes no input events. It is driven with world-space rays through `hover`, `beginDrag`, `drag`, `endDrag` and `cancelDrag`, so it also works from a controller or a test.

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
| `MeshToonMaterial`, `MeshMatcapMaterial`, `MeshPhysicalMaterial` clearcoat, sheen, transmission, `ior`, `thickness` and attenuation, `lightMap` | `createToonMaterial3D`, `createMatcapMaterial3D`, `material.clearcoat`, `material.sheen`, `createGlassMaterial3D` with `material.ior` and `material.thickness`, `material.lightMap` |
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
| `EffectComposer`, `UnrealBloomPass`, `OutputPass`, `FXAAShader`, `SSAOPass`, `OutlinePass`, `BokehPass`, `ShaderPass`, `DepthTexture` | `renderer.postProcess` with `ssao`, `outlineLayers`, `dof` and `custom` (`sceneDepth`) |
| `BatchedMesh`, `Line2` | `createBatchedMesh3D`, `createFatLine3D` |
| `TextGeometry`, `FontLoader`, `TTFLoader` | `createTextGeometry3D`, `parseTypefaceFont3D`, `parseTrueTypeFont3D` |
| `TransformControls` | `createTransformControls3D`, `createTransformGizmo3D` |
| `renderer.clippingPlanes`, `scene.overrideMaterial` | `scene.clippingPlanes`, `scene.overrideMaterial` |
| `CubeCamera`, `PMREMGenerator.fromEquirectangular` | `captureCubeTexture3D`, `createCubeTextureFromEquirect3D` |
| `OrbitControls`, `PointerLockControls`, `FlyControls` | `createOrbitControls3D`, `createFlyControls3D` |
| `AudioListener`, `PositionalAudio` | `createAudioListener3D`, `createPositionalAudio3D` |
| `BoxHelper`, `ArrowHelper`, `CameraHelper`, light helpers, `SkeletonHelper`, `GridHelper`, `AxesHelper` | the matching `create...Helper3D` functions |
| character controllers and third-person cameras from add-on libraries | `createCharacterMotor3D`, `createFollowCamera3D`, `createFollowControls3D` |
| physics add-ons such as cannon-es or Rapier, trimesh and convex colliders, constraints | `createPhysicsWorld3D`, `createCharacterController3D`, `createMeshShape3D`, `createConvexHullShape3D`, `world.createJoint` |

Differences to keep in mind: factories replace constructors; colours are linear RGB arrays or hex numbers; vectors and quaternions are typed arrays changed through `setPosition`, `setRotation`, `setScale` and `lookAt`; resources are released with `dispose()`; and errors are `World3DError` with a `code`.

## Engine integration

A World3D canvas is separate from the 2D stage surface. `createWorld3DHost(canvas)` returns a host for applications whose only surface is the 3D canvas. `startWorld3DLoop(engine)` advances the explicit Engine clock once per display frame and re-anchors it after a gap longer than the clock's delta limit.

`createWorld3DView(engine, scope, options)` subscribes to the Engine clock under a Scope. Each tick resizes the drawing buffer when needed, calls `onUpdate`, advances mixers, controls and particle emitters, and renders. Closing the Scope ends the view. The renderer, scene and controls stay owned by their creator; register them with `scope.use(...)` to retire them with the Scope.

For a 2D interface above a 3D scene, either stack a transparent shared 2D host canvas over the World3D canvas or draw the 2D canvas as a screen layer (see 2D and 3D on one surface). Interleaving individual 2D display objects between 3D objects in depth remains the job of the authored scene path.

`createOrbitControls3D(camera, element, options)` provides orbit, pan and zoom with Pointer Events, including two-finger pan and pinch, damping and optional automatic rotation.

## Example and checks

The [World3D example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/world3d/README.md) shows lights, shadows, instancing, skinning, morphing, particles, a render target, picking and orbit controls on either backend.

Headless tests `tests/world3d-core.test.mjs`, `tests/world3d-animation-picking.test.mjs`, `tests/world3d-gltf.test.mjs`, `tests/world3d-renderer-lifetime.test.mjs`, `tests/world3d-extended.test.mjs`, `tests/world3d-decoders.test.mjs` and `tests/world3d-parity.test.mjs` cover the DOM-free core, the asset providers, the state machine and physics through the public entries.

`tools/verify-world3d.mjs --playwright <installed-playwright-module> --output <new-directory> [--channel msedge]` renders twenty fixed scenes into a render target on both backends and compares the images. The newer scenes cover cascaded shadows, post-processing, a compressed texture, screen layers, a scene restored from its saved document, stylized and custom materials, point-light shadows, screen-space occlusion with outlines and clipping, a vertex hook with its shadows, sheen, glass, light maps, a batch and a wide line, depth of field, refraction through glass, and text with transform gizmos. During development all twenty ran in headless Chromium with software rendering. The desktop review ran the first sixteen cases in Edge 157 on an NVIDIA RTX 5090 Laptop GPU without renderer override flags. The visible sample presented on both backends with antialiasing and stopped advancing frames on disposal.

`tools/bench-world3d.mjs --playwright <installed-playwright-module>` measures the CPU time of `render()` for fixed workloads on both backends, as a baseline for regressions rather than an absolute score. The workloads cover static and moving meshes, shadows, instancing, many lights, skinning, a batch, glass over a scene and the post-processing chain. It also times one physics step for resting box stacks, spheres on a triangle mesh and a jointed chain. GPU execution time is not measured.

## Open items

- The desktop review forced WebGL2 context loss and restored the target pixels. It also forced WebGPU device loss and verified notification and refusal of subsequent work. Wider device and recovery coverage remains open.
- One physical Android Chrome 157 device presented both backends, responded to an automated shadow toggle, and stopped frame updates on disposal. On the same device class the latest review also checked screen-space effects, vertex displacement and shadows, and oblique projection depth on WebGL2 and WebGPU.
- Broader mobile and device recovery coverage, dedicated viewport and reflection-probe checks, performance measurements, and human verification of first-person controls and spatial audio remain open.
- The four newest comparison scenes (sheen, glass and light maps; depth of field; refraction; text with transform gizmos), joints, convex hulls, continuous collision and the transform controls have run only under software rendering and in headless tests; they still need a pass on physical GPUs and by hand.
- Not implemented: Draco and Basis Universal decoding without the official modules, float-precision environment prefiltering, more than one layer of refraction, bevelled extrusions, text shaping and CFF fonts, sliding and spring joints, and continuous collision for spinning or wide bodies.
