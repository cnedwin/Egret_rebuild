# API reference

English | [简体中文](../../Cns/docs/api-reference.md)

This page lists every name that each entry of `@egret/engine` exports: what kind of thing it is, and the first sentence written above it in the sources. It is written by `node tools/api-reference.mjs` from the built declarations, and `tests/api-reference.test.mjs` fails when it is not what they give; do not edit it by hand. 43 entries, 1315 exports; 800 of them have no sentence in the sources yet.

For which entry to import from, see [What to import](entry-points.md).

## `@egret/engine`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `animate` | function | A motion of one object: `animate(engine, scope, sprite).to({ x: 100, alpha: 0.5 }, 0.5, 'quadOut').wait(0.2).to({ x: 0 }, 0.5).start()`. |
| `AssetAcquireOptions` | interface |  |
| `AssetGroup` | interface | One opaque cleanup owner; members remain borrowed genuine invariant leases. |
| `AssetGroupOptions` | interface |  |
| `AssetGroupState` | type |  |
| `AssetLease` | class | One independently revocable CPU-value borrow, bound to its originating Engine. |
| `AssetLoadContext` | interface |  |
| `AssetManager` | class | CPU acquisition only: demand retains values; completed unused values are evicted. |
| `AssetProvider` | interface |  |
| `AssetRef` | interface | A stable manager-local identity paired with its invariant value descriptor. |
| `AssetType` | interface | Factory identity prevents equal names from aliasing; the phantom is invariant. |
| `AtlasFrameLayout` | interface | Logical canvas and unpacked placement of a clockwise-packed atlas rectangle. |
| `Bitmap` | class | A leaf borrowing one exact lease; engine affinity outlives clearing its slot. |
| `BitmapBindingTicket` | interface | Publishes borrowed group members once; owns no initial or candidate lease. |
| `BitmapResourceSlot` | interface | Owns only replacement leases; the exact initial Bitmap binding remains borrowed. |
| `BitmapResourceSlotState` | type |  |
| `BoundsQueryOptions` | interface | Receiver-inclusive node and content budgets for logical local measurement. |
| `BYTE_READER_LIMITS` | value |  |
| `BYTE_WRITER_LIMITS` | value |  |
| `ByteOrder` | type |  |
| `ByteReader` | class | Read-only owned binary snapshot. |
| `ByteWriter` | class | Fixed-capacity owned binary appends. |
| `CancellationController` | class | Owns the mutable signal; consumers receive the read-only cancellation port. |
| `CancellationListener` | type | A DOM-free cancellation listener; it receives no host Event object. |
| `CancellationSignal` | interface | One-way cancellation state. |
| `ClipRectangle2D` | interface |  |
| `CoordinateQueryOptions` | interface | Receiver-inclusive ancestor budget; omitted maxNodes defaults to 4096. |
| `copyImageData2DPixels` | function |  |
| `createAssetRef` | function | Keep the caller's valid ID byte-for-byte; whitespace is not normalization. |
| `createAssetType` | function |  |
| `createEngine` | function | An Engine without a render port: it captures frames and does not render them. |
| `createEngineForProfile` | function | Exact negotiation completes all successful port reads before semantics. |
| `createEventType` | function | Matching uses descriptor object identity; equal key strings do not alias types. |
| `createImageData2D` | function |  |
| `createNineSliceGeometry2D` | function | Create an owned immutable stretch grid for an existing Mesh2D texture lease. |
| `createSequenceClip` | function |  |
| `createSharedGeometry2D` | function |  |
| `createSharedMaterial2D` | function |  |
| `createSpriteSheet` | function | Build one exact-name table from a genuine full-image lease without acquiring another resource. |
| `createTexture` | function |  |
| `createTexturedGeometry2D` | function |  |
| `createTextureView` | function | Create an explicit logical view over an authentic straight CPU image. |
| `describeErrorCode` | function | A sentence for an error code: what went wrong and, for the codes a game meets most, what to do. |
| `Diagnostic` | interface | Diagnostics describe this headless lifecycle slice only. |
| `DiagnosticHandler` | type | Observation only: throwing cannot change cleanup or cancellation progress. |
| `DisplayObject` | class | A live display node; detach and terminal dispose are separate operations. |
| `DisplayObjectContainer` | class | Ordered display children with atomic reparenting and ownership-aware cleanup. |
| `DisplaySubtreeTicket` | interface | Borrows all nodes/resources; disposal only revokes this candidate publication. |
| `Disposable` | interface | Synchronous terminal cleanup. |
| `EgretError` | class | Stable machine-readable code, original cause, and associated cleanup failures. |
| `EgretErrorOptions` | interface |  |
| `Engine` | class | One headless run. |
| `EngineOptions` | interface |  |
| `ErrorLanguage` | type | The languages an error's sentence can be in. |
| `Event` | class | One typed payload with synchronous dispatch state; concurrent reuse is rejected. |
| `EventDispatcher` | class | Synchronous typed listeners with a frozen route and per-dispatch candidates. |
| `EventListenerOptions` | interface |  |
| `EventPhase` | type |  |
| `EventType` | interface | Descriptor identity and invariant payload type belong together. |
| `EventTypeOptions` | interface |  |
| `GameClock` | interface |  |
| `GameClockHandler` | type |  |
| `GameClockOptions` | interface |  |
| `GameClockState` | type |  |
| `GameClockSubscription` | interface |  |
| `GameClockTick` | interface |  |
| `getErrorLanguage` | function |  |
| `Graphics` | class | Drawing state belongs to one node; every shape snapshots its fill and its line. |
| `HitTestOptions` | interface | Receiver-inclusive whole-tree admission precedes all hit arithmetic. |
| `HostAdapter` | interface | Host owns the surface and any borrowed device. |
| `IMAGE_LIMITS_2D` | value |  |
| `ImageData2D` | interface | Immutable CPU byte identity; the brand conveys no asset or GPU authority. |
| `ImageData2DInput` | interface |  |
| `isImageData2D` | function |  |
| `isTexture` | function | Brand-only: disposal does not change the identity of a Texture. |
| `isTexturedGeometry2D` | function |  |
| `Matrix2D` | interface | Immutable logical-coordinate values shared by CPU capture and render hosts. |
| `Mesh2D` | class | A display leaf borrowing an exact lease and an immutable owned geometry. |
| `Motion` | interface | A chain of steps for one object. |
| `MotionEasing` | type | How a step runs from its start to its end: a name, or a function from 0–1 to 0–1 (it may pass both on the way). |
| `MotionEasingName` | type |  |
| `MotionState` | type |  |
| `NineSliceBitmap` | class | A resizable stretch-only leaf borrowing one exact, caller-owned Texture lease. |
| `NineSliceBitmapOptions` | interface | Required local panel dimensions and fixed source-crop borders. |
| `NineSliceGeometry2DOptions` | interface |  |
| `NineSliceInsets2D` | interface | Border widths in the same units as the unrotated source crop. |
| `Point2D` | interface | An owned logical-coordinate value; query results are frozen at runtime. |
| `Rectangle2D` | interface |  |
| `Releasable` | interface | Releases a lease; resource ownership and disposal remain with its provider. |
| `RenderEffect2D` | interface | Render-only subtree effect. |
| `RenderGlow2D` | interface |  |
| `RenderOutline2D` | interface |  |
| `Scope` | class | Synchronous ownership boundary. |
| `ScopeState` | type |  |
| `ScopeValue` | type | Scope prefers dispose() when a value implements both cleanup protocols. |
| `SequenceClip` | interface | Public immutable sequence metadata; authentic values come from createSequenceClip. |
| `SequenceClipInput` | interface |  |
| `SequenceFrameInput` | interface |  |
| `SequencePlayback` | interface |  |
| `SequencePlaybackMode` | type |  |
| `SequencePlaybackOptions` | interface |  |
| `SequencePlaybackState` | type |  |
| `SequencePlayer` | class | Explicit absolute-time selection borrowing a target and its exact current lease. |
| `SequenceRegion` | interface |  |
| `SequenceSample` | interface |  |
| `setErrorLanguage` | function | The language of the sentence in the message of every error made from now on: English unless set. |
| `SHARED_FRAME_PROFILE_2D` | value |  |
| `SharedBarrierCommand2D` | interface |  |
| `SharedBlendSpace2D` | type | Where translucent draws mix with what is under them. |
| `SharedDrawState2D` | interface |  |
| `SharedEffect2D` | interface | Frozen effect inputs captured with the same frame and image ownership. |
| `SharedFloatArray2D` | type |  |
| `SharedFrameOptions2D` | interface |  |
| `SharedFrameProfile2D` | type |  |
| `SharedGeometry2D` | interface | Immutable CPU geometry identity; the brand grants no asset or GPU authority. |
| `SharedGeometryInput2D` | interface |  |
| `SharedGlow2D` | interface |  |
| `SharedImageCommand2D` | interface |  |
| `SharedIndexArray2D` | type |  |
| `SharedMaterial2D` | interface |  |
| `SharedMaterialInput2D` | interface |  |
| `SharedMeshCommand2D` | interface |  |
| `SharedOutputAlpha2D` | type |  |
| `SharedPage2D` | interface |  |
| `SharedRectangleCommand2D` | interface |  |
| `SharedRegion2D` | interface |  |
| `SharedRenderCommand2D` | type |  |
| `SharedRenderFrame2D` | interface |  |
| `SharedRenderHostAdapter` | interface |  |
| `Sprite` | class | Stable drawing facade; a Sprite never shares or rebinds its Graphics. |
| `SpriteSheet` | interface | Immutable metadata plus a separately revocable borrow of one original lease. |
| `SpriteSheetFrameInput` | interface | One packed absolute rectangle, indexed by its exact UTF-16 name. |
| `Stage` | class | Created and bound by Engine; there is no implicit global stage. |
| `Texture` | class | An immutable CPU image view with a separate, terminal wrapper lifetime. |
| `TexturedFloatArray2D` | type |  |
| `TexturedGeometry2D` | interface | Immutable CPU geometry identity; the brand grants no asset or GPU authority. |
| `TexturedGeometry2DInput` | interface |  |
| `TexturedIndexArray2D` | type |  |
| `TextureRegion2D` | interface |  |
| `TextureViewRegion2D` | interface | Owned immutable metadata. |
| `TextureViewRegionInput2D` | interface | A packed page rectangle and its unrotated logical, top-left region. |
| `Tween` | interface |  |
| `TweenEasing` | type |  |
| `TweenOptions` | interface |  |
| `TweenState` | type |  |

## `@egret/engine/webgpu`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createSharedWebGPUHost` | function |  |
| `SharedDeviceSessionState` | type | Shared Host lifecycle metadata. |
| `SharedDeviceSessionStatus` | interface | A frozen observation of one Host, with historical and current failures separate. |
| `SharedFrameSubmission` | interface | Native draw completion is separate from pixel readback and final retirement. |
| `SharedFrameUpload` | interface | A single-use authority over the existing Host-owned pending frame record. |
| `SharedFrameUploadOptions` | interface | Cancellation revokes an unsubmitted upload without releasing unsettled work. |
| `SharedFrameUploadReady` | interface | Upload completion does not imply that this frame has been presented. |
| `SharedHostResourceStatus` | interface | Fresh immutable data; reads do no native work. |
| `SharedWebGPUHost` | interface |  |
| `SharedWebGPUHostOptions` | interface |  |
| `SharedWebGPUHostStatus` | interface |  |
| `SharedWebGPUReadback` | interface |  |
| `WebGPUHostDiagnostic` | interface |  |
| `WebGPUHostErrorCode` | type |  |
| `WebGPUHostFailure` | interface |  |
| `WebGPUHostOptions` | interface |  |
| `WebGPUHostState` | type |  |
| `WebGPUHostStatus` | interface |  |
| `WebGPUReadback` | interface |  |

## `@egret/engine/text`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createTextField` | function | Public explicit entry; shape, proxies and borrowed identities grant no authority. |
| `createTextRasterCache` | function | Explicit CPU text orchestration; this entry owns no browser font or drawing surface. |
| `TextField` | interface | Factory-produced noneditable leaf; the brand has no runtime value. |
| `TextFieldStatus` | interface |  |

## `@egret/engine/layout`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `LinearLayoutItem` | interface | Caller-authored dimensions in the intended local coordinate system. |
| `LinearLayoutOptions` | interface | Explicit membership and spacing; omitted optional values use planner defaults. |
| `LinearLayoutPlacement` | interface | A rectangle origin and captured dimensions, without a display-object reference. |
| `LinearLayoutPlan` | interface | Immutable numeric result; applying it to a scene remains the caller's operation. |
| `planLinearLayout` | function | Capture ordered numeric inputs, then plan local rectangle origins without scene writes. |

## `@egret/engine/web/input`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BitmapButton` | interface | A frozen exact-receiver facade; its accessor setter remains usable. |
| `BitmapButtonOptions` | interface |  |
| `BitmapButtonState` | type |  |
| `createBitmapButton` | function | Share a genuine input; own only the new private sheet, Bitmap and facade. |
| `createMouseInput` | function | Primary mouse activation for the admitted ordinary desktop Canvas layout profile. |
| `MouseInput` | interface | Scope-owned synchronous input. |
| `MouseInputCancelReason` | type |  |
| `MouseInputEvents` | interface |  |
| `MouseInputOptions` | interface | Fixed logical dimensions; browser layout scaling does not change game coordinates. |
| `MouseInputPayload` | interface |  |
| `MouseInputState` | type |  |

## `@egret/engine/web/image`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserPngDecodeOptions` | interface |  |
| `BrowserPngPorts` | interface |  |
| `BrowserTextureProvider` | interface |  |
| `BrowserTextureProviderOptions` | interface |  |
| `createBrowserTextureProvider` | function | Caller owns async close; managers own issued Textures and their final demand. |

## `@egret/engine/web/text`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createCanvasTextRasterProvider` | function | Caller-owned fonts and explicit cache invalidation; no waiting or font loading. |

## `@egret/engine/webgl2`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createSharedWebGL2Host` | function | Explicit compatibility backend; the Engine retains the original shared-frame contract. |
| `SharedDeviceSessionState` | type | Shared Host lifecycle metadata. |
| `SharedDeviceSessionStatus` | interface | A frozen observation of one Host, with historical and current failures separate. |
| `SharedFrameSubmission` | interface | Native draw completion is separate from pixel readback and final retirement. |
| `SharedFrameUpload` | interface | A single-use authority over the existing Host-owned pending frame record. |
| `SharedFrameUploadOptions` | interface | Cancellation revokes an unsubmitted upload without releasing unsettled work. |
| `SharedFrameUploadReady` | interface | Upload completion does not imply that this frame has been presented. |
| `SharedHostResourceStatus` | interface | Fresh immutable data; reads do no native work. |
| `SharedLayerWebGL2Host` | interface |  |
| `SharedWebGL2FrameTiming` | interface |  |
| `SharedWebGL2Host` | interface |  |
| `SharedWebGL2HostOptions` | interface |  |
| `SharedWebGL2HostStatus` | interface |  |
| `SharedWebGL2Layer2D` | interface |  |
| `SharedWebGL2LayerEffect2D` | interface |  |
| `SharedWebGL2LayerPlacement2D` | interface |  |
| `SharedWebGL2LayerStatus` | interface |  |
| `SharedWebGL2Readback` | interface |  |
| `SharedWebGL2TimingPhase` | type |  |
| `SharedWebGL2TimingSample` | interface |  |
| `WebGL2HostDiagnostic` | interface |  |
| `WebGL2HostErrorCode` | type |  |
| `WebGL2HostFailure` | interface |  |
| `WebGL2HostState` | type |  |
| `WebGL2HostStatus` | interface |  |

## `@egret/engine/world3d`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `AlphaMode3D` | type |  |
| `ANIMATION3D_LIMITS` | value |  |
| `ANIMATION_TEXTURE3D_LIMITS` | value |  |
| `AnimationAction3D` | class |  |
| `AnimationClip3D` | class |  |
| `AnimationInterpolation3D` | type |  |
| `AnimationLoop3D` | type |  |
| `AnimationMixer3D` | class | Plays clips on the subtree under `root`, blending concurrent actions by weight. |
| `AnimationPath3D` | type |  |
| `AnimationStateMachine3D` | class |  |
| `AnimationTexture3D` | class | Bone matrices of one skinned mesh for every frame of a set of clips. |
| `AnimationTrack3D` | interface |  |
| `AnimationTrackInput3D` | interface |  |
| `ArrowHelper3D` | class | Arrow from `origin` along `direction`; change them and call update(). |
| `Attribute3D` | class |  |
| `ATTRIBUTE_3D` | value | Well-known attribute names understood by the built-in materials. |
| `AttributeArray3D` | type |  |
| `BakeAnimationOptions3D` | interface |  |
| `bakeAnimationTexture3D` | function | Sample clips into an animation texture. |
| `BakedClip3D` | interface |  |
| `BasisModule3D` | interface | The parts of an initialized Basis Universal transcoder module (`await BASIS()`) this adapter calls. |
| `BATCH3D_LIMITS` | value |  |
| `BatchedMesh3D` | class | Many geometries drawn as one mesh with one material and one draw call. |
| `Blending3D` | type |  |
| `BodyType3D` | type |  |
| `Bone3D` | class |  |
| `box3Empty` | function |  |
| `box3ExpandByPoint` | function |  |
| `box3IsEmpty` | function |  |
| `box3Transform` | function | Axis-aligned bounds of a transformed box (Arvo's method). |
| `box3Union` | function |  |
| `BoxGeometryOptions3D` | interface |  |
| `BoxHelper3D` | class | Wire box around an object's world bounds. |
| `Camera3D` | class |  |
| `CameraHelper3D` | class | Outline of a camera's view volume. |
| `CapsuleGeometryOptions3D` | interface |  |
| `CatmullRomCurve3D` | class | Smooth curve through every control point. |
| `CatmullRomKind3D` | type |  |
| `CharacterController3D` | class | Kinematic capsule that slides along the world instead of being simulated. |
| `CharacterControllerOptions3D` | interface |  |
| `CharacterMotor3D` | class | A walking, jumping character. |
| `CharacterMotorOptions3D` | interface |  |
| `CircleGeometryOptions3D` | interface |  |
| `clamp` | function |  |
| `Cloth3D` | class | A rectangular sheet. |
| `CLOTH3D_LIMITS` | value |  |
| `ClothOptions3D` | interface |  |
| `colorFromHex` | function | Decode a 0xRRGGBB sRGB color into linear RGB in [0, 1]. |
| `ColorInput3D` | type | A color as 0xRRGGBB sRGB hex or linear RGB components. |
| `CompoundChild3D` | interface | One part of a compound shape, placed in the body's local frame. |
| `COMPRESSED_BLOCK_BYTES_3D` | value | Bytes per 4x4 block of each compressed format. |
| `CompressedFormat3D` | type | Block-compressed GPU formats that can be uploaded without transcoding. |
| `CompressedPixels3D` | interface | A pre-compressed mip chain, largest level first. |
| `COMPRESSION3D_LIMITS` | value |  |
| `computeObjectBounds3D` | function | World-space bounds of an object and its descendants as [minX, minY, minZ, maxX, maxY, maxZ]. |
| `connectPhysics3D` | function |  |
| `ConvexHullShape3D` | class |  |
| `createAmbientLight3D` | function | Uniform light from every direction. |
| `createAnimationClip3D` | function |  |
| `createAnimationStateMachine3D` | function |  |
| `createArrowHelper3D` | function |  |
| `createAxesGeometry3D` | function | Three colored segments from the origin along +X (red), +Y (green) and +Z (blue). |
| `createAxesHelper3D` | function | Ready-made axes node colored X red, Y green, Z blue. |
| `createBasisTranscoder3D` | function | Turn an initialized Basis Universal transcoder module into the `transcodeKtx2` option. |
| `createBatchedMesh3D` | function |  |
| `createBoxEdgesGeometry3D` | function | The twelve edges of an axis-aligned box given as [minX, minY, minZ, maxX, maxY, maxZ]. |
| `createBoxGeometry3D` | function | Axis-aligned box centered on the origin with one material group per face (+X, -X, +Y, -Y, +Z, -Z). |
| `createBoxHelper3D` | function |  |
| `createCameraHelper3D` | function |  |
| `createCapsuleGeometry3D` | function | Capsule along Y; `height` is the length of the cylindrical middle section. |
| `createCharacterController3D` | function |  |
| `createCharacterMotor3D` | function |  |
| `createCircleGeometry3D` | function | Flat disc or sector in the XY plane, facing +Z. |
| `createCloth3D` | function |  |
| `createConeGeometry3D` | function |  |
| `createConvexHullShape3D` | function | Build a convex hull shape from a geometry's vertices, or from a flat list of points. |
| `createCubeTextureFromEquirect3D` | function | Build a cube texture from an equirectangular panorama. |
| `createCustomShader3D` | function |  |
| `createCylinderGeometry3D` | function | Cylinder or truncated cone along Y. |
| `createDecal3D` | function | A decal mesh on a target mesh, added as its child so it moves with it. |
| `createDecalGeometry3D` | function | Cut the part of a mesh's surface that lies inside the decal box. |
| `createDirectionalLight3D` | function | Parallel rays, such as sunlight. |
| `createDodecahedronGeometry3D` | function |  |
| `createDracoDecoder3D` | function | Turn an initialized Draco decoder module into the `decodeDraco` option of the glTF loader. |
| `createEdgesGeometry3D` | function | Line segments for outline and crease edges only: edges with one face, or whose two faces meet at more than `thresholdAngle` radians. |
| `createExtrudeGeometry3D` | function | Give an outline thickness. |
| `createFatLine3D` | function |  |
| `createFollowCamera3D` | function |  |
| `createGeometry3D` | function | Build a geometry from plain arrays; missing normals are computed for triangles. |
| `createGeometryBuilder3D` | function | A builder that merges placed, coloured parts into one geometry. |
| `createGlassMaterial3D` | function | A standard material set up as glass: smooth and see-through, with reflections kept. |
| `createGpuParticles3D` | function |  |
| `createGradientCubeTexture3D` | function | Procedural sky cube: a vertical gradient from `ground` through `horizon` to `zenith`, in sRGB bytes. |
| `createGridGeometry3D` | function | Square grid of lines on the XZ plane, centered at the origin. |
| `createGridHelper3D` | function | Ready-made grid node for editors and debug views. |
| `createHeightField3D` | function |  |
| `createHeightFieldFromPixels3D` | function | Height field with one sample per pixel of a decoded RGBA image; the image's top row is the -Z edge. |
| `createHemisphereLight3D` | function | Sky color from above blending to a ground color from below (world Y axis). |
| `createIcosahedronGeometry3D` | function |  |
| `createJelly3D` | function |  |
| `createJellyShader3D` | function | The vertex hook a jelly drives. |
| `createLambertMaterial3D` | function | Diffuse-only lighting; the cheapest lit model. |
| `createLatheGeometry3D` | function | Revolve a profile of [x, y] points (x is the distance from the Y axis) around Y. |
| `createLightHelper3D` | function |  |
| `createLineMaterial3D` | function | Unlit line or point material; pair it with a 'lines', 'line-strip' or 'points' geometry. |
| `createMatcapMaterial3D` | function | Lighting baked into a sphere image: the surface color is looked up by the view-space normal, so no lights are needed. |
| `createMeshShape3D` | function | Build a collision mesh from a geometry or the unskinned, non-instanced triangle meshes under an object. |
| `createNavCrowd3D` | function |  |
| `createNavMesh3D` | function | Build a navigation mesh from level geometry: a geometry, or an object whose meshes are merged with their world transforms. |
| `createOctahedronGeometry3D` | function |  |
| `createOrthographicCamera3D` | function |  |
| `createParticleEmitter3D` | function |  |
| `createPerspectiveCamera3D` | function |  |
| `createPhongMaterial3D` | function | Diffuse plus Blinn-Phong specular highlights. |
| `createPhysicsWorld3D` | function |  |
| `createPlaneGeometry3D` | function | Plane in the XY plane facing +Z. |
| `createPointLight3D` | function |  |
| `createPolyhedronGeometry3D` | function | Project a convex solid's triangles onto a sphere, subdividing each `detail` times. |
| `createQuadGeometry3D` | function | Unit quad in XY used by sprites: corners at +-0.5, facing +Z. |
| `createRagdoll3D` | function |  |
| `createRingGeometry3D` | function | Flat ring in the XY plane, facing +Z. |
| `createRope3D` | function |  |
| `createScreenLayer3D` | function |  |
| `createShapeGeometry3D` | function | Fill one or more outlines in the XY plane, facing +Z. |
| `createSkeletonHelper3D` | function |  |
| `createSkinnedInstancedMesh3D` | function |  |
| `createSolidTexture3D` | function | Single-color 1x1 texture, useful as a placeholder or constant map. |
| `createSphereGeometry3D` | function | UV sphere with poles on the Y axis. |
| `createSpotLight3D` | function |  |
| `createSprite3D` | function |  |
| `createSpriteMaterial3D` | function | Camera-facing unlit quad material for Sprite3D. |
| `createStandardMaterial3D` | function | Physically based metallic-roughness model, matching glTF 2.0 materials. |
| `createTerrain3D` | function |  |
| `createTerrainMaterial3D` | function | A standard material whose color is a blend of ground textures, such as sand, grass, rock and snow, painted by a weight map. |
| `createTerrainStream3D` | function |  |
| `createTetrahedronGeometry3D` | function |  |
| `createTextGeometry3D` | function | Text as a mesh geometry in the XY plane, facing +Z, with the first baseline on y = 0. |
| `createTextShapes3D` | function | Outlines of a text as flat shapes; see Font3D.generateShapes. |
| `createToonMaterial3D` | function | Cel shading: diffuse light quantized into `steps` flat bands. |
| `createTorusGeometry3D` | function | Torus around the Z axis. |
| `createTorusKnotGeometry3D` | function |  |
| `createTrail3D` | function |  |
| `createTransformGizmo3D` | function |  |
| `createTubeGeometry3D` | function | Sweep a circle along a curve, using twist-free frames. |
| `createUnlitMaterial3D` | function | Constant color, unaffected by lights. |
| `createVehicle3D` | function |  |
| `createVolumetricFog3D` | function |  |
| `createWater3D` | function |  |
| `createWaterMaterial3D` | function | The material Water3D uses, for a water surface on your own geometry: a standard material that refracts, with the wave hooks attached. |
| `createWireframeGeometry3D` | function | Line segments for every triangle edge, each drawn once. |
| `CubeTexture3D` | class | Six square faces in +X, -X, +Y, -Y, +Z, -Z order. |
| `CubicBezierCurve3D` | class |  |
| `Curve3D` | class | Base for every curve: subclasses implement getPoint(t) for t in [0, 1]. |
| `CURVE3D_LIMITS` | value |  |
| `CurvePath3D` | class | Several curves joined end to end and traversed as one, by length. |
| `CustomShader3D` | interface | A fragment hook that post-processes a material's shaded color. |
| `CylinderGeometryOptions3D` | interface |  |
| `DECAL3D_LIMITS` | value |  |
| `DecalOptions3D` | interface |  |
| `decodeMeshopt3D` | function | Decode one EXT_meshopt_compression buffer view. |
| `decompressZstd3D` | function | Decompress Zstandard data: one or more frames, including skippable ones. |
| `DEG_TO_RAD_3D` | value |  |
| `DeserializedScene3D` | interface |  |
| `DeserializeOptions3D` | interface |  |
| `deserializeScene3D` | function | Rebuild a subtree from data produced by serializeScene3D. |
| `DisposeListener3D` | type |  |
| `DracoModule3D` | interface | The parts of an initialized Draco decoder module (`await DracoDecoderModule()`) this adapter calls. |
| `EPSILON_3D` | value |  |
| `EquirectOptions3D` | interface |  |
| `ExtrudeGeometryOptions3D` | interface |  |
| `FatLine3D` | class | A polyline drawn as a ribbon of triangles that turns to face the camera, so it can be wider than the one pixel that plain lines allow. |
| `FatLineOptions3D` | interface |  |
| `findGridPath3D` | function | Shortest path on a grid of cells, for tile maps. |
| `Fog3D` | type |  |
| `FollowCamera3D` | class | Third-person camera: orbits a target at a distance, and moves closer when a wall would hide the target, easing back out afterwards. |
| `FollowCameraOptions3D` | interface |  |
| `Font3D` | class |  |
| `FontSource3D` | interface |  |
| `frustumFromMatrix` | function |  |
| `frustumIntersectsBox` | function |  |
| `frustumIntersectsSphere` | function |  |
| `Geometry3D` | class |  |
| `GEOMETRY3D_LIMITS` | value |  |
| `GeometryBuilder3D` | interface |  |
| `GeometryGroup3D` | interface |  |
| `GeometryInput3D` | interface |  |
| `GeometryPart3D` | interface |  |
| `GizmoHandle3D` | type | A single axis, a plane spanned by two axes, or 'xyz' for the center handle of the scale mode. |
| `GizmoMode3D` | type |  |
| `GizmoSpace3D` | type |  |
| `GltfAsset3D` | interface |  |
| `GltfDracoRequest3D` | interface |  |
| `GltfDracoResult3D` | interface |  |
| `GltfImageRequest3D` | interface |  |
| `GltfLoadOptions3D` | interface |  |
| `GltfMeshoptRequest3D` | interface |  |
| `GlyphOutline3D` | interface | One glyph in font units. |
| `GpuParticles3D` | class | An instanced, camera-facing quad per particle. |
| `GpuParticlesOptions3D` | interface |  |
| `GridPathOptions3D` | interface |  |
| `HDR3D_LIMITS` | value |  |
| `HdrImage3D` | interface | Linear RGB floats, three per pixel, top row first. |
| `HeightField3D` | class | Heights on a regular grid in the XZ plane. |
| `HeightFieldOptions3D` | interface |  |
| `HeightImageOptions3D` | interface |  |
| `inflate3D` | function | Decompress a zlib stream, or a bare deflate stream when `raw` is set. |
| `InstanceBlendOptions3D` | interface |  |
| `InstanceClipOptions3D` | interface |  |
| `InstancedMesh3D` | class | Draw one geometry many times in a single call with per-instance transforms and colors. |
| `isCompressedPixels3D` | function |  |
| `isKtx23D` | function | True when `bytes` starts with the KTX 2.0 file identifier. |
| `isTexturePixels3D` | function |  |
| `Jelly3D` | class | Makes everything drawn under `target` behave like jelly. |
| `JellyOptions3D` | interface |  |
| `Joint3D` | class | A constraint between two bodies, or between a body and the world. |
| `JointOptions3D` | interface |  |
| `JointType3D` | type |  |
| `Ktx2Info3D` | interface |  |
| `Ktx2Options3D` | interface |  |
| `Ktx2Result3D` | interface |  |
| `LatheGeometryOptions3D` | interface |  |
| `Light3D` | class |  |
| `LIGHT3D_LIMITS` | value |  |
| `LightHelper3D` | class | Shows where a light is and where it points: a ray for directional, a cone for spot, a range sphere for point lights. |
| `LightOptions3D` | interface |  |
| `LightShadow3D` | interface |  |
| `LightType3D` | type |  |
| `linearColor3D` | function | A hex colour as seen on screen in the linear RGB the renderer lights, for vertex colours written by hand. |
| `linearToSrgb` | function |  |
| `LineCurve3D` | class |  |
| `LineHelper3D` | class | Shared base: a line mesh whose vertices are rewritten by update(). |
| `loadGltf3D` | function | Parse a glTF 2.0 asset from .glb bytes, .gltf JSON bytes or an already parsed JSON object. |
| `Lod3D` | class | Shows exactly one child depending on the distance to the camera. |
| `mat3NormalFromMat4` | function | 3x3 inverse transpose of the upper-left block, written as nine column-major floats. |
| `mat4Compose` | function | Affine matrix from translation, unit quaternion and scale. |
| `mat4Copy` | function |  |
| `mat4Decompose` | function | Split an affine matrix; a negative determinant is folded into scale X. |
| `mat4Determinant` | function |  |
| `mat4Identity` | function |  |
| `mat4Invert` | function | Returns false and leaves `out` untouched when the matrix is singular. |
| `mat4LookAt` | function | World matrix of an object at `eye` whose negative Z axis points at `target`. |
| `mat4MaxScaleOnAxis` | function |  |
| `mat4Multiply` | function | out = a * b: with column vectors, b applies first. |
| `mat4Orthographic` | function |  |
| `mat4Perspective` | function | Right-handed perspective projection to clip depth [-1, 1]. |
| `Material3D` | class | One material class carries the superset of surface parameters; `shading` selects the lighting model. |
| `MaterialOptions3D` | interface |  |
| `mergeGeometries3D` | function | Join geometries that share the same attribute set into one. |
| `mergeVertices3D` | function | Weld vertices whose every attribute matches within `tolerance`, producing an indexed geometry. |
| `Mesh3D` | class |  |
| `MESH3D_LIMITS` | value |  |
| `MESHOPT3D_LIMITS` | value |  |
| `MeshoptFilter3D` | type |  |
| `MeshoptMode3D` | type |  |
| `MorphTarget3D` | interface |  |
| `NavAgent3D` | class |  |
| `NavAgentOptions3D` | interface |  |
| `NavCrowd3D` | class | Agents walking on one navigation mesh. |
| `NAVIGATION3D_LIMITS` | value |  |
| `NavLocation3D` | interface |  |
| `NavMesh3D` | class |  |
| `NavMeshOptions3D` | interface |  |
| `NavPath3D` | interface |  |
| `NavPathOptions3D` | interface |  |
| `NavPoint3D` | type |  |
| `NumericArray3D` | type |  |
| `Object3D` | class |  |
| `Object3DKind` | type |  |
| `OrthographicCameraOptions3D` | interface |  |
| `parseKtx23D` | function | Read a KTX 2.0 file holding one 2D texture and its mip chain. |
| `parseRgbe3D` | function | Decode a Radiance .hdr file (flat or run-length encoded, -Y +X orientation). |
| `parseTrueTypeFont3D` | function | Read a TrueType font: a .ttf file, an OpenType file with TrueType (glyf) outlines, or the first font of a .ttc collection. |
| `parseTypefaceFont3D` | function | Read a font in the typeface JSON format (the `*.typeface.json` files used with web 3D libraries). |
| `ParticleEmitter3D` | class |  |
| `ParticleEmitterOptions3D` | interface |  |
| `PARTICLES3D_LIMITS` | value |  |
| `ParticleShape3D` | type |  |
| `Path2D3D` | class | A 2D outline built with pen commands; used as a contour or a hole. |
| `PerspectiveCameraOptions3D` | interface |  |
| `PhongMaterialOptions3D` | interface |  |
| `PHYSICS3D_LIMITS` | value |  |
| `PHYSICS_HULL3D_LIMITS` | value |  |
| `PHYSICS_MESH3D_LIMITS` | value |  |
| `PhysicsClient3D` | class | The page's end of a remote physics world. |
| `PhysicsContact3D` | interface | What a pair of solid bodies did to each other in one step. |
| `PhysicsPort3D` | interface | A Worker, a worker's global scope, a MessagePort: anything that posts and receives messages. |
| `PhysicsRaycastHit3D` | interface |  |
| `PhysicsShapeCastHit3D` | interface |  |
| `PhysicsWorld3D` | class |  |
| `PhysicsWorldOptions3D` | interface |  |
| `PlanarReflection3D` | class | A mirror camera and the target it draws into. |
| `PlanarReflectionPass3D` | interface | Output and inclusion settings shared by reflection draws and program preparation. |
| `PlaneGeometryOptions3D` | interface |  |
| `Point2D` | type |  |
| `Point3D` | type |  |
| `PointLightOptions3D` | interface |  |
| `PolyhedronOptions3D` | interface |  |
| `projectToViewport3D` | function | Projects a world point into a viewport of `width` by `height` pixels through `camera`. |
| `QuadraticBezierCurve3D` | class |  |
| `quatCopy` | function |  |
| `quatFromAxisAngle` | function |  |
| `quatFromEuler` | function | Intrinsic XYZ Euler angles in radians (rotate X, then Y, then Z in local axes). |
| `quatFromRotationMatrix` | function | Rotation part of a matrix without scale or shear. |
| `quatIdentity` | function |  |
| `quatMultiply` | function |  |
| `quatNormalize` | function |  |
| `quatSlerp` | function | Shortest-arc spherical interpolation; falls back to nlerp for close inputs. |
| `quatToEuler` | function | Inverse of quatFromEuler; writes radians into out[0..2]. |
| `Ragdoll3D` | class | Bodies and joints for a skeleton, created from the current pose by activate() and removed again by deactivate(). |
| `RAGDOLL3D_LIMITS` | value |  |
| `RagdollJoint3D` | interface |  |
| `RagdollOptions3D` | interface |  |
| `RagdollPart3D` | interface |  |
| `Raycaster3D` | class |  |
| `RaycastHit3D` | interface |  |
| `RaycastOptions3D` | interface |  |
| `rayIntersectBox` | function | Slab test; returns the entry distance (0 when the origin is inside) or -1. |
| `rayIntersectSphere` | function | Distance along the ray to the sphere, or -1 when it misses. |
| `rayIntersectTriangle` | function | Moller-Trumbore. |
| `ReflectionRenderer3D` | interface | Anything that can draw a scene into a render target: both first-party renderers qualify. |
| `RemoteBody3D` | class | The page's stand-in for a body that lives behind the port. |
| `RemoteBodyOptions3D` | interface |  |
| `RemoteJoint3D` | class |  |
| `RemoteJointOptions3D` | interface |  |
| `RemoteRaycastHit3D` | interface |  |
| `RemoteShape3D` | type | Shapes that can be described in a message. |
| `RenderItem3D` | interface |  |
| `RenderList3D` | class |  |
| `RenderStats3D` | interface |  |
| `RenderTarget3D` | class | Off-screen color target. |
| `RenderTargetFormat3D` | type | Color storage of a render target: 8-bit sRGB, or half-float linear for values above 1. |
| `RenderTargetOptions3D` | interface |  |
| `Resource3D` | class | CPU-side resource with a version counter and terminal disposal. |
| `retargetAnimationClip3D` | function | A clip for the target rig that moves it as `clip` moves the source rig. |
| `RetargetOptions3D` | interface |  |
| `RigidBody3D` | class |  |
| `RigidBodyOptions3D` | interface |  |
| `RingGeometryOptions3D` | interface |  |
| `Rope3D` | class | A rope or cable. |
| `RopeOptions3D` | interface |  |
| `sampleAnimationTrack3D` | function | Evaluate one track at `time` into `out`; `hint` caches the last key index. |
| `Scene3D` | class | Root of a renderable graph; owns environment-wide settings. |
| `SCENE_DOCUMENT_FORMAT_3D` | value |  |
| `SCENE_DOCUMENT_VERSION_3D` | value |  |
| `SceneDocument3D` | interface |  |
| `ScreenLayer3D` | class | Full-screen image drawn in the same pass as the 3D scene, typically the canvas of a 2D stage. |
| `ScreenLayerOptions3D` | interface |  |
| `SERIALIZE3D_LIMITS` | value |  |
| `SerializeOptions3D` | interface |  |
| `serializeScene3D` | function | Write the subtree under `root` as JSON-safe data. |
| `servePhysics3D` | function | Run a physics world on this end of a port and answer the messages of a PhysicsClient3D. |
| `setColor3D` | function |  |
| `Shading3D` | type |  |
| `Shape3D` | class | A filled outline with optional holes. |
| `ShapeDefinition3D` | type |  |
| `Side3D` | type |  |
| `signedArea2D` | function |  |
| `Skeleton3D` | class | Ordered bones with their inverse bind matrices; one instance may drive many meshes. |
| `SkeletonHelper3D` | class | A line from every bone to its parent bone. |
| `SkinnedInstancedMesh3D` | class | Many copies of one skinned mesh in a single draw call, each at its own place in its own clip. |
| `sphereFromBox` | function |  |
| `SphereGeometryOptions3D` | interface |  |
| `sphereTransform` | function |  |
| `SpotLightOptions3D` | interface |  |
| `Sprite3D` | class | Camera-facing textured quad. |
| `SpriteMaterialOptions3D` | interface |  |
| `srgbToLinear` | function |  |
| `StandardMaterialOptions3D` | interface |  |
| `STATE_MACHINE3D_LIMITS` | value |  |
| `StateBlendEntry3D` | interface |  |
| `StateCondition3D` | interface |  |
| `StateConditionOperator3D` | type |  |
| `StateOptions3D` | interface |  |
| `StateParameter3D` | type |  |
| `StrandOptions3D` | interface |  |
| `Terrain3D` | class | A height field drawn as a grid of chunk meshes. |
| `TERRAIN3D_LIMITS` | value |  |
| `TerrainMaterialOptions3D` | interface |  |
| `TerrainOptions3D` | interface |  |
| `TerrainStream3D` | class |  |
| `TerrainStreamOptions3D` | interface |  |
| `TerrainTile3D` | interface |  |
| `TEXT3D_LIMITS` | value |  |
| `TextGeometryOptions3D` | interface |  |
| `TextLayoutOptions3D` | interface |  |
| `Texture3D` | class |  |
| `TEXTURE3D_LIMITS` | value |  |
| `TextureColorSpace3D` | type |  |
| `TextureFilter3D` | type |  |
| `TextureOptions3D` | interface |  |
| `TexturePixels3D` | interface | Tightly packed straight-alpha RGBA8 rows, top row first. |
| `TextureSource3D` | type |  |
| `TextureWrap3D` | type |  |
| `toNonIndexedGeometry3D` | function | Copy with every triangle owning its vertices, as needed for per-face data. |
| `Topology3D` | type |  |
| `TorusGeometryOptions3D` | interface |  |
| `TorusKnotGeometryOptions3D` | interface |  |
| `Trail3D` | class | Add the trail to the scene itself, not under the object it follows: its vertices are world positions. |
| `TRAIL3D_LIMITS` | value |  |
| `TrailOptions3D` | interface |  |
| `transformGeometry3D` | function | Bake a 4x4 transform into positions, normals and tangents, in place. |
| `TransformGizmo3D` | class |  |
| `TransformGizmoOptions3D` | interface |  |
| `TransitionOptions3D` | interface |  |
| `TriangleMeshShape3D` | class |  |
| `triangulateShape3D` | function | Triangulate an outline with holes by ear clipping. |
| `TubeGeometryOptions3D` | interface |  |
| `vec3Add` | function |  |
| `vec3Copy` | function |  |
| `vec3Cross` | function |  |
| `vec3Distance` | function |  |
| `vec3Dot` | function |  |
| `vec3Length` | function |  |
| `vec3Lerp` | function |  |
| `vec3Normalize` | function | A zero-length input yields the zero vector instead of NaN. |
| `vec3Scale` | function |  |
| `vec3Set` | function |  |
| `vec3Sub` | function |  |
| `vec3TransformDirection` | function | Transform a direction (w = 0) by the upper 3x3; the result is not normalized. |
| `vec3TransformMat4` | function | Transform a point (w = 1) with perspective division. |
| `vec3TransformQuat` | function |  |
| `Vehicle3D` | class | Drives a chassis body on ray wheels. |
| `VEHICLE3D_LIMITS` | value |  |
| `VehicleOptions3D` | interface |  |
| `ViewportPoint3D` | interface | Where a world point falls in a viewport, for labels, markers and pointers drawn over the picture. |
| `VolumetricFog3D` | class | Add one to the scene's root and keep `receiveShadow` on. |
| `VolumetricFogOptions3D` | interface |  |
| `Water3D` | class | A horizontal water surface. |
| `WaterOptions3D` | interface |  |
| `Wheel3D` | interface |  |
| `WheelOptions3D` | interface |  |
| `WORLD3D_LIMITS` | value |  |
| `World3DError` | class | Stable machine-readable code plus a human-readable detail and the original cause. |
| `World3DErrorCode` | type |  |

## `@egret/engine/webgl2/world3d`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `Atmosphere3D` | class | Height fog and light shafts for `renderer.postProcess.custom`. |
| `AtmosphereOptions3D` | interface |  |
| `AudioListener3D` | class | Ears of the scene. |
| `AudioListenerOptions3D` | interface |  |
| `captureCubeTexture3D` | function | Render six 90-degree views from `position` and return them as a cube texture with mipmaps. |
| `createAtmosphere3D` | function |  |
| `createAudioListener3D` | function |  |
| `createCustomPost3D` | function |  |
| `createDynamicResolution3D` | function |  |
| `createFlyControls3D` | function |  |
| `createFollowControls3D` | function |  |
| `createOrbitControls3D` | function |  |
| `createPositionalAudio3D` | function |  |
| `createPostProcessSettings3D` | function |  |
| `createScreenMarkers3D` | function | A layer of page elements that follow scene points. |
| `createTransformControls3D` | function |  |
| `createWebGL2Renderer3D` | function |  |
| `createWorld3DApp` | function | Starts a World3D game on `canvas`: an Engine, a renderer for the chosen backend and quality, and a frame loop. |
| `createWorld3DHost` | function | Host adapter that reserves `canvas` for one Engine. |
| `createWorld3DOverlay` | function | Lays a transparent 2D stage over `canvas` (the 3D canvas, which must sit in a positioned parent) and starts it. |
| `createWorld3DStats` | function |  |
| `createWorld3DView` | function |  |
| `CUBE_TEXTURE_ASSET_3D` | value | A cube texture. |
| `CubeCaptureOptions3D` | interface |  |
| `CustomPost3D` | interface | A full-screen hook that runs after ambient occlusion and bloom and before tone mapping. |
| `DynamicResolution3D` | interface | A drawing resolution that follows the frame rate: down quickly when frames are slow, up slowly when they are not. |
| `DynamicResolutionOptions3D` | interface |  |
| `FlyControls3D` | class |  |
| `FlyControlsKeys3D` | interface |  |
| `FlyControlsOptions3D` | interface |  |
| `FollowControls3D` | class |  |
| `FollowControlsOptions3D` | interface |  |
| `GLTF_ASSET_3D` | value | A loaded glTF file. |
| `GltfUrlLoadOptions3D` | interface | glTF loading options: download limits plus the optional KTX2, meshopt and Draco decoders. |
| `isSoftwareRendered3D` | function | Whether WebGL here is drawn by software (SwiftShader, llvmpipe and the like), as in a headless browser, a virtual machine or a page whose graphics card is blocked. |
| `loadCubeTexture3D` | function | Load six square images in +X, -X, +Y, -Y, +Z, -Z order as a cube texture. |
| `loadGltfFromUrl3D` | function | Load a .glb or .gltf file; relative buffer and image URIs resolve against `url`. |
| `LoadOptions3D` | interface |  |
| `loadTexture3D` | function | Load an image or KTX2 file as a texture. |
| `OrbitControls3D` | class |  |
| `OrbitControlsOptions3D` | interface |  |
| `pickWorld3DBackend` | function | The backend asked for by the address (`backend=webgpu`), or `fallback`. |
| `pickWorld3DQuality` | function | The picture quality for this device: the address's `quality`, then a stored choice, then `low` for software rendering, a finger or a window shorter than 600 pixels, `medium` for 4 GB of memory or less, and `high` otherwise. |
| `play3d` | function | Starts a 3D game in the page. |
| `Play3DGame` | interface |  |
| `Play3DOptions` | interface |  |
| `PLAY_LOOKS_3D` | value | The looks every game is given, by name. |
| `PlayBurst3D` | interface |  |
| `PlayCamera3D` | interface | The camera: where it is and what it looks at, by plain numbers. |
| `PlayFollow3D` | interface |  |
| `PlayLook3D` | interface |  |
| `PlayLookName3D` | type | What `play3d` gives: everything `play` gives for the interface and the game's time, and a world of things. |
| `PlayPlace3D` | interface | Where a thing is made. |
| `PlayThing3D` | class | A thing of the world: a box, a ball, a cylinder or a cone. |
| `PositionalAudio3D` | class | A sound placed in the scene. |
| `PositionalAudioOptions3D` | interface |  |
| `POST3D_LIMITS` | value |  |
| `PostProcessSettings3D` | interface |  |
| `registerWorld3DAssets` | function | Register the World3D asset providers on an AssetManager. |
| `Renderer3D` | interface | What both world3d backends provide; views and tools depend on this only. |
| `Renderer3DInfo` | interface |  |
| `SCENE_ASSET_3D` | value | A scene document written by serializeScene3D. |
| `ScreenMarker3D` | interface |  |
| `ScreenMarkerOptions3D` | interface |  |
| `ScreenMarkers3D` | interface |  |
| `ScreenMarkersOptions3D` | interface |  |
| `startWorld3DLoop` | function | Advance the Engine clock once per display frame. |
| `TEXTURE_ASSET_3D` | value | A 2D texture loaded from an image or KTX2 file. |
| `TextureLoadOptions3D` | interface | Texture loading options; `transcodeKtx2` handles KTX2 payloads the built-in reader cannot use directly. |
| `ToneMapping3D` | type |  |
| `TransformControls3D` | class |  |
| `WebGL2ProgramVariant3D` | interface | One material program for an expected draw. |
| `WebGL2Renderer3D` | class |  |
| `WebGL2Renderer3DOptions` | interface |  |
| `WORLD3D_QUALITY_PRESETS` | value | The three qualities. |
| `World3DApp` | interface |  |
| `World3DAppOptions` | interface |  |
| `World3DAssetOptions` | interface |  |
| `World3DBackend` | type |  |
| `World3DClockSource` | interface | The part of an Engine this view needs: its explicit game clock. |
| `World3DDeviceHints` | interface | What `pickWorld3DQuality` reads about the device. |
| `World3DFrameMetrics` | interface |  |
| `World3DFramePass` | interface |  |
| `World3DGpuTiming` | type |  |
| `World3DLoopSource` | interface |  |
| `World3DOverlay` | interface |  |
| `World3DOverlayOptions` | interface |  |
| `World3DPassKind` | type |  |
| `World3DQuality` | type |  |
| `World3DQualityPreset` | interface | What one picture quality turns on. |
| `World3DShowOptions` | interface |  |
| `World3DStats` | interface |  |
| `World3DStatsOptions` | interface |  |
| `World3DView` | class |  |
| `World3DViewKind` | type |  |
| `World3DViewOptions` | interface |  |

## `@egret/engine/webgpu/world3d`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `Atmosphere3D` | class | Height fog and light shafts for `renderer.postProcess.custom`. |
| `AtmosphereOptions3D` | interface |  |
| `AudioListener3D` | class | Ears of the scene. |
| `AudioListenerOptions3D` | interface |  |
| `captureCubeTexture3D` | function | Render six 90-degree views from `position` and return them as a cube texture with mipmaps. |
| `createAtmosphere3D` | function |  |
| `createAudioListener3D` | function |  |
| `createCustomPost3D` | function |  |
| `createDynamicResolution3D` | function |  |
| `createFlyControls3D` | function |  |
| `createFollowControls3D` | function |  |
| `createOrbitControls3D` | function |  |
| `createPositionalAudio3D` | function |  |
| `createPostProcessSettings3D` | function |  |
| `createScreenMarkers3D` | function | A layer of page elements that follow scene points. |
| `createTransformControls3D` | function |  |
| `createWebGPURenderer3D` | function | Acquire a device (unless one is borrowed) and create the WebGPU renderer. |
| `createWorld3DApp` | function | Starts a World3D game on `canvas`: an Engine, a renderer for the chosen backend and quality, and a frame loop. |
| `createWorld3DHost` | function | Host adapter that reserves `canvas` for one Engine. |
| `createWorld3DOverlay` | function | Lays a transparent 2D stage over `canvas` (the 3D canvas, which must sit in a positioned parent) and starts it. |
| `createWorld3DStats` | function |  |
| `createWorld3DView` | function |  |
| `CUBE_TEXTURE_ASSET_3D` | value | A cube texture. |
| `CubeCaptureOptions3D` | interface |  |
| `CustomPost3D` | interface | A full-screen hook that runs after ambient occlusion and bloom and before tone mapping. |
| `DynamicResolution3D` | interface | A drawing resolution that follows the frame rate: down quickly when frames are slow, up slowly when they are not. |
| `DynamicResolutionOptions3D` | interface |  |
| `FlyControls3D` | class |  |
| `FlyControlsKeys3D` | interface |  |
| `FlyControlsOptions3D` | interface |  |
| `FollowControls3D` | class |  |
| `FollowControlsOptions3D` | interface |  |
| `GLTF_ASSET_3D` | value | A loaded glTF file. |
| `GltfUrlLoadOptions3D` | interface | glTF loading options: download limits plus the optional KTX2, meshopt and Draco decoders. |
| `isSoftwareRendered3D` | function | Whether WebGL here is drawn by software (SwiftShader, llvmpipe and the like), as in a headless browser, a virtual machine or a page whose graphics card is blocked. |
| `loadCubeTexture3D` | function | Load six square images in +X, -X, +Y, -Y, +Z, -Z order as a cube texture. |
| `loadGltfFromUrl3D` | function | Load a .glb or .gltf file; relative buffer and image URIs resolve against `url`. |
| `LoadOptions3D` | interface |  |
| `loadTexture3D` | function | Load an image or KTX2 file as a texture. |
| `OrbitControls3D` | class |  |
| `OrbitControlsOptions3D` | interface |  |
| `pickWorld3DBackend` | function | The backend asked for by the address (`backend=webgpu`), or `fallback`. |
| `pickWorld3DQuality` | function | The picture quality for this device: the address's `quality`, then a stored choice, then `low` for software rendering, a finger or a window shorter than 600 pixels, `medium` for 4 GB of memory or less, and `high` otherwise. |
| `PositionalAudio3D` | class | A sound placed in the scene. |
| `PositionalAudioOptions3D` | interface |  |
| `POST3D_LIMITS` | value |  |
| `PostProcessSettings3D` | interface |  |
| `registerWorld3DAssets` | function | Register the World3D asset providers on an AssetManager. |
| `Renderer3D` | interface | What both world3d backends provide; views and tools depend on this only. |
| `Renderer3DInfo` | interface |  |
| `SCENE_ASSET_3D` | value | A scene document written by serializeScene3D. |
| `ScreenMarker3D` | interface |  |
| `ScreenMarkerOptions3D` | interface |  |
| `ScreenMarkers3D` | interface |  |
| `ScreenMarkersOptions3D` | interface |  |
| `startWorld3DLoop` | function | Advance the Engine clock once per display frame. |
| `TEXTURE_ASSET_3D` | value | A 2D texture loaded from an image or KTX2 file. |
| `TextureLoadOptions3D` | interface | Texture loading options; `transcodeKtx2` handles KTX2 payloads the built-in reader cannot use directly. |
| `ToneMapping3D` | type |  |
| `TransformControls3D` | class |  |
| `WebGPURenderer3D` | class |  |
| `WebGPURenderer3DOptions` | interface |  |
| `WORLD3D_QUALITY_PRESETS` | value | The three qualities. |
| `World3DApp` | interface |  |
| `World3DAppOptions` | interface |  |
| `World3DAssetOptions` | interface |  |
| `World3DBackend` | type |  |
| `World3DClockSource` | interface | The part of an Engine this view needs: its explicit game clock. |
| `World3DDeviceHints` | interface | What `pickWorld3DQuality` reads about the device. |
| `World3DLoopSource` | interface |  |
| `World3DOverlay` | interface |  |
| `World3DOverlayOptions` | interface |  |
| `World3DQuality` | type |  |
| `World3DQualityPreset` | interface | What one picture quality turns on. |
| `World3DShowOptions` | interface |  |
| `World3DStats` | interface |  |
| `World3DStatsOptions` | interface |  |
| `World3DView` | class |  |
| `World3DViewOptions` | interface |  |

## `@egret/engine/resources`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `ContentBinding` | interface |  |
| `ContentGroup` | interface | All returned values are borrowed until this group or its owning Scope retires. |
| `ContentLoader` | interface | One manifest/source identity; multiple groups share the existing asset manager. |
| `ContentProviderFactory` | type |  |
| `ContentProviders` | interface | Host providers own byte integrity/UTF-8 decoding; the core validates artifact semantics. |
| `createContentLoader` | function | One manifest/source catalog, independent of global IDs and of other loaders. |
| `createFontContentLoader` | function | One typed font catalog over the existing manager and genuine dependency groups. |
| `createManifestAssetBinding` | function |  |
| `FontContentAsset` | interface |  |
| `FontContentBinding` | interface |  |
| `FontContentGroup` | interface |  |
| `FontContentLoader` | interface |  |
| `FontContentProviderFactory` | type |  |
| `ManifestAssetBinding` | interface | A genuine invariant ref paired with one exact admitted manifest entry. |
| `ManifestAssetGroup` | interface | Scope-owned dependency group. |
| `ManifestBinding` | interface | Immutable resource metadata; only the optional binding factory creates it. |
| `ManifestGroupOptions` | interface |  |

## `@egret/engine/web/resources`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createManifestByteSource` | function |  |
| `createManifestContentLoader` | function | Integrity-checked PNG/UTF-8 transport plus the DOM-free content assembly. |
| `createManifestFontContentLoader` | function | Fonts share the authenticated byte transport and the Engine's existing resource manager. |
| `createManifestTextureProvider` | function | Source authentication precedes every caller-controlled options read. |
| `ManifestByteSource` | interface |  |
| `ManifestByteSourceOptions` | interface |  |
| `ManifestByteSourceStatus` | interface |  |
| `ManifestContentLoader` | interface |  |
| `ManifestFontContentLoader` | interface |  |
| `ManifestTextureProvider` | interface |  |
| `ManifestTextureProviderOptions` | interface |  |
| `ManifestTextureProviderStatus` | interface |  |

## `@egret/engine/input`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createKeyboardInput` | function |  |
| `createPointerInput` | function |  |
| `PointerCancelReason` | type |  |
| `PointerContact` | interface | A retained value: sequence orders all contacts on this router. |
| `PointerEventKind` | type |  |
| `PointerInput` | interface | Scope-owned input for an explicitly supplied logical host stream. |
| `PointerInputEvents` | interface |  |
| `PointerInputOptions` | interface |  |
| `PointerNotification` | interface |  |
| `PointerRouterState` | type |  |
| `PointerSample` | interface |  |
| `PointerSession` | interface | Only the creating router admits this frozen identity; host IDs may be reused. |
| `PointerType` | type |  |
| `PointerUpdate` | interface |  |

## `@egret/engine/web/pointer`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createBrowserPointerInput` | function | Pointer Events adapter for the explicit connected, untransformed Canvas profile. |
| `PointerInput` | interface | Scope-owned input for an explicitly supplied logical host stream. |
| `PointerInputOptions` | interface |  |

## `@egret/engine/ui`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `ActionControl` | interface |  |
| `ActionControlOptions` | interface |  |
| `ActionKeysOptions` | interface | Space or Enter, released, activates. |
| `ControlKeys` | interface |  |
| `ControlKeysOptions` | type |  |
| `ControlKeysSource` | interface | The keyboard input, or anything that delivers its three key events. |
| `createActionControl` | function |  |
| `createControlKeys` | function |  |
| `createHoverControl` | function |  |
| `createMovementControl` | function |  |
| `createRangeControl` | function |  |
| `createScrollControl` | function |  |
| `createSelectionGroup` | function |  |
| `createTextFieldControl` | function |  |
| `createToggleControl` | function |  |
| `createUiLayerManager` | function | Optional Root composition. |
| `createUiRoot` | function | One owned transaction domain over the genuine display and input authorities. |
| `createUiTheme` | function |  |
| `HoverControl` | interface |  |
| `HoverControlOptions` | interface | Hover, toggle and single-selection state for controls an application draws itself. |
| `LayoutNode` | type |  |
| `MovementControl` | interface |  |
| `MovementControlOptions` | interface |  |
| `MovementKeysOptions` | interface | The keys that are down give the direction; opposite keys cancel each other. |
| `MovementValue` | interface | Reusable movement and action controls over the existing contact stream. |
| `RangeAxis` | type | One value out of a range, for a slider an application draws itself: a volume, a share, an amount. |
| `RangeControl` | interface |  |
| `RangeControlOptions` | interface |  |
| `RangeKeysOptions` | interface | Arrow keys move the value by one step, Page Up and Page Down by a page of steps, Home and End go to its ends. |
| `RowBindContext` | interface |  |
| `RowBinding` | interface |  |
| `RowRetention` | interface |  |
| `RowUnbindInfo` | interface |  |
| `ScrollAxis` | type | The scroll position of one axis of a clipped viewport an application draws itself. |
| `ScrollControl` | interface |  |
| `ScrollControlOptions` | interface |  |
| `ScrollKeysOptions` | interface | The arrow keys of its axis, Page Up, Page Down, Home and End. |
| `ScrollThumb` | interface |  |
| `ScrollThumbOptions` | interface |  |
| `ScrollWheelOptions` | interface |  |
| `SelectionGroup` | interface | One of several: a radio group, a segmented control, or a listbox with a single selection. |
| `SelectionGroupOptions` | interface |  |
| `SelectionItem` | interface |  |
| `SelectionKeysOptions` | interface | Arrow keys move the selection, Home and End go to its ends. |
| `selectUiSkin` | function | The name a skin gives to the state of a control: of the states that hold, the first in `order` that the skin has a name for, and `default` when it has none. |
| `TextFieldChange` | interface |  |
| `TextFieldControl` | interface |  |
| `TextFieldControlOptions` | interface |  |
| `TextFieldEditor` | interface | Shows one field at a time. |
| `TextFieldKeysOptions` | interface | The field opens when the key is released, so that the key types nothing into it. |
| `TextFieldRectangle` | interface | The state of a text field an application draws itself: its text, and whether it is being edited. |
| `TextFieldSession` | interface | What the control adds to the presentation of a field when it opens one. |
| `ToggleControl` | interface |  |
| `ToggleControlOptions` | interface |  |
| `ToggleKeysOptions` | interface |  |
| `UiCommitResult` | interface |  |
| `UiCounters` | interface |  |
| `UiInvalidationKind` | type |  |
| `UiKeyboardOptions` | interface | Explicit namespace prevents independently authored panels from sharing focus IDs. |
| `UiLayerAnchor` | interface |  |
| `UiLayerCommitResult` | interface |  |
| `UiLayerManager` | interface | Stage intents, publish participating roots, then sync before editor placement/capture. |
| `UiLayerManagerOptions` | interface |  |
| `UiLayerOptions` | interface |  |
| `UiLayerRegistration` | interface |  |
| `UiLayerSnapshot` | interface |  |
| `UiLayerTarget` | type |  |
| `UiLeafContent` | interface |  |
| `UiLeafPrepareContext` | interface | Detached content is prepared at the leaf's available inner width. |
| `UiLimits` | interface |  |
| `UiPreparation` | interface |  |
| `UiRoot` | interface |  |
| `UiRootOptions` | interface |  |
| `UiRowPointerNotification` | type |  |
| `UiRowSnapshot` | interface |  |
| `UiSkinState` | type |  |
| `UiSkinStateName` | type | The states of a control that a skin may have a name for. |
| `UiSnapshot` | interface |  |
| `UiTheme` | interface | Every factory result is a distinct immutable generation, including equal descriptors. |
| `UiThemeDescriptor` | interface |  |
| `UiThemeNode` | interface |  |
| `UiThemeSkin` | interface | Skin names resolve through application-owned, typed asset references, never URLs. |
| `UiThemeTypography` | interface |  |
| `VirtualDataSource` | interface |  |
| `VirtualListHandle` | interface |  |
| `VirtualListRevealOptions` | interface | Alignment within the list's authored viewport; tall rows can remain clipped. |
| `VirtualListSnapshot` | interface |  |
| `VirtualRecord` | interface |  |

## `@egret/engine/animation`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createSequenceController` | function | Opt-in sequence controls share Engine ownership but never create a second timer. |
| `createSequenceResetSlot` | function | One ordinary sole-child container; all candidates use existing content and clock ownership. |
| `SequenceController` | interface | Receiver-checked owned handle; time is driven only by its genuine Engine. |
| `SequenceControllerEvent` | type |  |
| `SequenceControllerOptions` | interface |  |
| `SequenceControllerState` | type |  |
| `SequenceControllerStatus` | interface |  |
| `SequenceEventSource` | type |  |
| `SequenceMarker` | interface | Immutable authored marker; its input index breaks equal-time ties. |
| `SequenceResetActive` | interface |  |
| `SequenceResetInitial` | interface |  |
| `SequenceResetRequest` | interface |  |
| `SequenceResetSlot` | interface |  |
| `SequenceResetState` | type |  |
| `SequenceResetTicket` | interface |  |
| `SequenceSeekRequest` | interface |  |

## `@egret/engine/paragraph`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createParagraph` | function | Optional paragraph assembly authenticates Engine, Scope and exact cache profile. |
| `createParagraphCache` | function | A fixed optional profile shares Engine/AssetManager leases and their shutdown authority. |

## `@egret/engine/web/paragraph`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `CanvasKitFontSetProvider` | interface |  |
| `CanvasKitFontSetProviderOptions` | interface |  |
| `CanvasKitParagraphFont` | interface |  |
| `CanvasKitParagraphModule` | interface | Minimal host-injected CanvasKit port. |
| `CanvasKitParagraphProvider` | interface |  |
| `CanvasKitParagraphProviderOptions` | interface |  |
| `createCanvasKitFontSetProvider` | function | A stable cache provider routes immutable generations; it never mutates a live native font table. |
| `createCanvasKitParagraphProvider` | function |  |
| `ParagraphFontSet` | interface |  |

## `@egret/engine/web/keyboard`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createBrowserKeyboardInput` | function | Canvas-local native keyboard bridge. |
| `KeyboardCancelPayload` | interface |  |
| `KeyboardCancelReason` | type |  |
| `KeyboardFocusChange` | interface |  |
| `KeyboardFocusOptions` | interface |  |
| `KeyboardFocusPayload` | interface |  |
| `KeyboardInput` | interface | Synchronous logical focus; text editing and IME are outside this channel. |
| `KeyboardInputEvents` | interface |  |
| `KeyboardInputOptions` | interface |  |
| `KeyboardInputSnapshot` | interface |  |
| `KeyboardKeyPayload` | interface |  |
| `KeyboardSample` | interface |  |
| `KeyboardTargetOptions` | interface |  |
| `KeyboardTargetRegistration` | interface |  |

## `@egret/engine/web/text-input`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserTextInput` | interface |  |
| `BrowserTextInputChange` | interface |  |
| `BrowserTextInputEnterHint` | type |  |
| `BrowserTextInputMode` | type |  |
| `BrowserTextInputOptions` | interface |  |
| `BrowserTextInputRectangle` | interface | Rectangle in logical stage units, the units of the display tree and of pointer input. |
| `BrowserTextInputRequest` | interface | One editing session. |
| `BrowserTextInputSnapshot` | interface |  |
| `createBrowserTextInput` | function | Platform text entry over a canvas: a native field placed on a rectangle of the stage, so that input methods (Chinese, Japanese, Korean), on-screen keyboards, paste and accessibility work as the platform provides them. |

## `@egret/engine/ui/editing`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createUiTextEditor` | function |  |
| `TextEditSelection` | interface | Source offsets are UTF-16, never glyph indices or guessed advance widths. |
| `UiTextEditor` | interface |  |
| `UiTextEditorChange` | interface |  |
| `UiTextEditorOptions` | interface |  |
| `UiTextEditorSetOptions` | interface |  |
| `UiTextEditorSnapshot` | interface |  |
| `UiTextEditorStyle` | interface |  |
| `UiTextEditorTarget` | type |  |

## `@egret/engine/web/editing`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserEditorFontProvider` | interface |  |
| `BrowserEditorFontProviderOptions` | interface |  |
| `BrowserEditorFontSet` | interface |  |
| `BrowserTextEditor` | interface |  |
| `BrowserTextEditorOptions` | interface |  |
| `BrowserTextEditorSnapshot` | interface |  |
| `createBrowserEditorFontProvider` | function | CSS registration is a consumer of existing immutable font resources, not another asset cache. |
| `createBrowserTextEditor` | function | One visible native editor over an authenticated committed UI binding. |
| `EditorParagraphFontLoader` | interface |  |

## `@egret/engine/input/hover`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createHoverInput` | function | Hover and wheel routing over the display tree of a started Engine. |
| `HoverInput` | interface | Scope-owned hover and wheel routing for an explicitly supplied logical host stream. |
| `HoverInputEvents` | interface |  |
| `HoverInputOptions` | interface |  |
| `HoverInputState` | type |  |
| `HoverLeaveReason` | type | Why a target stopped being hovered: the pointer went to another target or to none, left the surface, pressed, or was cancelled by the platform; the target stopped being a possible target; the mapping of the surface changed; the window or the page went away; or the input was suspended, disposed or failed. |
| `HoverNotification` | interface |  |
| `HoverPoint` | interface | A retained value: sequence orders every hover and wheel observation of this input. |
| `HoverPointerType` | type | Pointers that can be over the scene without pressing it. |
| `HoverSample` | interface |  |
| `HoverState` | interface |  |
| `HoverTransition` | interface | A point of an enter or a leave, with the other end of the movement when there is one. |
| `WheelNotification` | interface |  |
| `WheelPoint` | interface |  |
| `WheelSample` | interface |  |
| `WheelUnit` | type |  |

## `@egret/engine/web/hover`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserHoverInputOptions` | interface |  |
| `createBrowserHoverInput` | function | Hover and wheel of the page for the canvas of a started Engine, in the same connected, untransformed profile as the pointer adapter. |
| `WheelPagePolicy` | type | Whether a wheel over the canvas also scrolls the page: only when nothing consumed it, never (the canvas owns the wheel), or always (the listener is passive and cannot hold the page). |

## `@egret/engine/input/gamepad`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `bindGamepadKeys` | function | Drives a keyboard input from the pads: the keys a UI already answers, held and repeated as a pad holds them. |
| `createGamepadInput` | function | Pads as a stream of samples a host gives it: what is held, how far a stick is pushed, and what changed since the last look. |
| `GamepadButtonChange` | interface |  |
| `GamepadButtonName` | type | The buttons of a pad in the standard layout, by where they are: `a` is the lower face button. |
| `GamepadButtonSample` | interface |  |
| `GamepadConnectionChange` | interface |  |
| `GamepadInput` | interface | Pads as a stream of samples. |
| `GamepadInputOptions` | interface |  |
| `GamepadKeyAction` | type | What a button does: a key, with the way the focus moves when nobody took the key; or a move of the focus alone. |
| `GamepadKeys` | interface |  |
| `GamepadKeysOptions` | interface |  |
| `GamepadKeyTarget` | interface | The part of a keyboard input that a pad drives. |
| `GamepadPad` | interface | A pad that is connected, as of the last sample. |
| `GamepadSample` | interface | What a host says of one pad at one moment. |
| `GamepadStick` | interface |  |
| `GamepadStickName` | type |  |

## `@egret/engine/web/gamepad`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserGamepadInput` | interface |  |
| `BrowserGamepadInputOptions` | interface |  |
| `createBrowserGamepadInput` | function | The pads of a page. |
| `GamepadRumble` | interface |  |

## `@egret/engine/camera`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `Camera2D` | interface | A view of a 2D world: where it looks, how close, what it follows, and how it shakes. |
| `Camera2DOptions` | interface |  |
| `CameraFollowOptions` | interface |  |
| `CameraLayerOptions` | interface |  |
| `CameraPoint` | interface |  |
| `CameraRect` | interface |  |
| `CameraShakeOptions` | interface |  |
| `CameraSnapshot` | interface |  |
| `CameraTarget` | type | What the camera follows: a display object inside the world, or a function that says where to look. |
| `createCamera2D` | function | A camera over a container that holds the world. |

## `@egret/engine/tilemap`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createTileMap` | function | A map drawn from its tilesets. |
| `importTiledMap` | function | Reads a map saved by Tiled as JSON (`.tmj`, or `.json`), orthogonal, with tile layers as arrays or as base64 without compression, finite or infinite, object layers and groups. |
| `ObjectLayerData` | interface |  |
| `TILE_FLIP_MASK` | value | The top three bits of a global id say how the tile is turned; the rest is the id. |
| `TileAnimationFrame` | interface |  |
| `TiledImportOptions` | interface |  |
| `TileInfo` | interface |  |
| `TileLayerData` | interface |  |
| `TileMap` | interface | A map drawn: one container for each tile layer, cut into chunks of meshes that can be left out when they cannot be seen. |
| `TileMapChunk` | interface |  |
| `TileMapData` | interface | A map as plain, frozen data: what a tile map is made from. |
| `TileMapLayer` | interface |  |
| `TileMapLayerData` | type |  |
| `TileMapObject` | interface |  |
| `TileMapOptions` | interface |  |
| `TileMapProperties` | type |  |
| `TileMapPropertyValue` | type |  |
| `TileSetData` | interface |  |

## `@egret/engine/particles`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createParticleEmitter` | function | A stream of particles over one texture, drawn as one mesh that is built again each update. |
| `ParticleEmitter` | interface | Particles drawn as one mesh. |
| `ParticleEmitterOptions` | interface |  |
| `ParticleRange` | type | A value picked once for each particle, evenly between the two ends; a number is both ends. |
| `ParticleShape` | type | Where particles are born, around the place of the emitter. |
| `ParticleSnapshot` | interface |  |
| `ParticleView` | interface |  |

## `@egret/engine/physics2d`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createPhysicsWorld` | function | A world of bodies that move, meet and push each other apart, in fixed steps, without turning. |
| `PhysicsBody` | interface |  |
| `PhysicsBodyKind` | type | A static body never moves; a kinematic one moves by its speed alone and pushes; a dynamic one is moved by everything. |
| `PhysicsBodyOptions` | interface |  |
| `PhysicsContact` | interface |  |
| `PhysicsMoveResult` | interface |  |
| `PhysicsRayHit` | interface |  |
| `PhysicsShape` | type | A shape about the place of its body. |
| `PhysicsSnapshot` | interface |  |
| `PhysicsTileColliders` | interface |  |
| `PhysicsVector` | interface |  |
| `PhysicsWorld` | interface | A world of 2D bodies that collide, without turning: simple, steady physics for a 2D game. |
| `PhysicsWorldOptions` | interface |  |

## `@egret/engine/bitmapfont`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BitmapFont` | interface | A bitmap font read from a file: frozen, with its characters and the kerning between pairs of them. |
| `BitmapGlyph` | interface | One character of a bitmap font: where it is on its page, where it is drawn from the pen, and how far the pen goes on. |
| `BitmapText` | interface | Text drawn in a bitmap font, as one mesh for each page it uses. |
| `BitmapTextGlyph` | interface | One character placed: its rectangle in the text and its rectangle on its page. |
| `BitmapTextLayout` | interface | Text laid out in a font, from its top left. |
| `BitmapTextLayoutOptions` | interface |  |
| `BitmapTextLine` | interface |  |
| `BitmapTextOptions` | interface |  |
| `createBitmapText` | function | Draws text in a bitmap font as one mesh for each page it uses, laid out again whenever what it shows changes. |
| `layoutBitmapText` | function | Lays text out in a bitmap font without drawing it: its lines, where each character goes, and its size. |
| `parseBitmapFont` | function | Reads a bitmap font: the text, XML or JSON forms of BMFont (from AngelCode's generator, Hiero, Glyph Designer, Littera and the like), or Egret's own JSON of frames. |

## `@egret/engine/video`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createVideo` | function | A video as a display object: each new picture its source gives becomes, through the Engine's assets, the texture of one Bitmap. |
| `Video` | interface | A video shown as a display object: each new picture of its source becomes the texture of one Bitmap. |
| `VideoFrame` | interface | One picture of a video, the time of the video it shows. |
| `VideoOptions` | interface |  |
| `VideoSnapshot` | interface |  |
| `VideoSource` | interface | What a video player reads its pictures from and is driven through. |
| `VideoSourceState` | type | Where a source is: still opening, able to show a frame, playing, paused, at its end, or unable to play. |
| `VideoState` | type |  |

## `@egret/engine/web/video`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserVideo` | interface |  |
| `BrowserVideoOptions` | interface |  |
| `createBrowserVideo` | function | A video played by a page's video element and shown as a display object. |

## `@egret/engine/web/loop`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserFrameLoop` | interface |  |
| `BrowserFrameLoopOptions` | interface |  |
| `BrowserFrameLoopSnapshot` | interface |  |
| `BrowserFrameLoopState` | type |  |
| `createBrowserFrameLoop` | function | The frame loop of a game in a page. |
| `FrameLoopEngine` | interface | What the loop asks of an Engine: its clock's limit, time and frames. |
| `FrameLoopHost` | interface | What the loop asks of a Host: how many frames it holds that it has not finished. |

## `@egret/engine/kit`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `ASSET_BUNDLE_HEADER_BYTES` | value | How many bytes from the start must be read to know the index's length: the header. |
| `assetBundleCheck` | function | FNV-1a over the bytes, as eight hex digits. |
| `AssetBundleEntry` | interface |  |
| `AssetBundleIndex` | interface |  |
| `AssetBundleInput` | interface | One file to put in a bundle. |
| `AudioCueDefinition` | interface |  |
| `AudioCuePlayOptions` | interface |  |
| `AudioCues` | interface |  |
| `AudioCuesOptions` | interface |  |
| `createAudioCues` | function | Names the sound effects of a game over `mixer`. |
| `createInputActions` | function | Makes the actions of `map`. |
| `createMemorySaveStorage` | function | Storage kept in memory: for tests, for a page without browser storage, or for a game played once. |
| `createRandom` | function | A generator from a seed (a number or string) or a saved state. |
| `createSaveStore` | function | Opens the save under `options.key`, migrating an older one. |
| `describeInputBinding` | function | A readable name for a binding, for settings screens: `Key:KeyW` is `W`, `Mouse:0` is `Left button`. |
| `encodeWav` | function | 16-bit PCM WAV bytes from channels of samples between -1 and 1, all the same length. |
| `hashSeed` | function | Turns a string or number into a 32-bit seed. |
| `HeadlessGame` | interface | What a headless run needs of a game: its state and one step of its rules. |
| `HeadlessRunOptions` | interface |  |
| `HeadlessRunResult` | interface |  |
| `InputActionDefinition` | interface | An action and the controls that drive it. |
| `InputActionKind` | type |  |
| `InputActionMap` | type |  |
| `InputActions` | interface |  |
| `InputBinding` | type | One physical control, written as a short string: `Key:KeyW` (a `KeyboardEvent.code`), `Mouse:0` (a button number), `Pad:a` or `Pad:7` (a standard gamepad button name or number), `Pad:leftStick` / `Pad:rightStick` (a stick, for vector actions), `Pad:leftStickX+` (one half of a stick axis, for buttons and axes), and `Touch:<name>` for an on-screen control. |
| `InputBindingSlot` | type | A slot of an action that a binding can be put in: `bindings`, `negative`, `positive`, `up`, ... |
| `InputBindingsSave` | interface |  |
| `InputVector` | interface |  |
| `pickQualityFiles` | function | Names of the form `<base>-<tier>.<ext>` grouped by base and chosen for `quality`, as a bundle or a folder lists them: `hero-high.glb`, `hero-low.glb` and `hall.webp` give `hero-low.glb` (for `medium`) and `hall.webp`. |
| `pickQualityVariant` | function | Of several variants of one asset, the one for `quality`: an exact tier, or else the nearest below, or else the nearest above. |
| `planAssetBundleRanges` | function | Ranges of the file that hold the named entries, joined where they touch or lie within `gap` bytes. |
| `QUALITY_TIERS` | value | Quality tiers from lowest to highest, as World3D names them. |
| `QualityTier` | type |  |
| `Random` | interface |  |
| `RandomState` | type | Four 32-bit words. |
| `readAssetBundleHeader` | function | The index length a header gives, so a reader can ask for exactly the bytes of the index. |
| `readAssetBundleIndex` | function | The index of a bundle from its first bytes: at least the header and the index. |
| `runHeadless` | function | Plays the game once per seed with the stand-in player and reports each run. |
| `SaveProblem` | interface |  |
| `SaveProblemKind` | type |  |
| `SaveStorage` | interface | Where a save is kept: strings by key. |
| `SaveStore` | interface |  |
| `SaveStoreOptions` | interface |  |
| `sliceAssetBundle` | function | The bytes of one entry from bytes of the bundle that start at `start` (0 for the whole file), checked against the index. |
| `writeAssetBundle` | function | One file holding every input, in the order given, each starting at a multiple of four bytes. |

## `@egret/engine/web/kit`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `bindBrowserInputActions` | function | Listens to the page for the controls of `actions`. |
| `BrowserAssetBundle` | interface |  |
| `BrowserAssetBundleOptions` | interface |  |
| `BrowserDecodedImage` | interface |  |
| `BrowserImageCanvas` | interface |  |
| `BrowserImageContext` | interface |  |
| `BrowserImageFormat` | type | The picture formats the browser route recognises by their first bytes. |
| `BrowserImageOptions` | interface |  |
| `BrowserImagePorts` | interface |  |
| `BrowserImageSource` | type | What `textureFromCanvas` and `decodeBrowserImage` can read pixels from. |
| `BrowserImageTextureProviderOptions` | interface |  |
| `BrowserInputActions` | interface |  |
| `BrowserInputActionsOptions` | interface |  |
| `browserSaveStorage` | function | The page's local storage as a save storage, or a memory stand-in where the page has none (a private window, a blocked site): every call is guarded, so a save never throws for want of storage. |
| `BundleCache` | interface | Where fetched bundle entries are kept between visits; used as `cache` of `openBrowserAssetBundle`. |
| `createBrowserImageTextureProvider` | function | An asset provider that reads bytes with `readBytes` and decodes them with the browser. |
| `createTouchButton` | function | Makes `element` an on-screen button that holds `binding` (such as `Touch:jump`) while a finger is on it. |
| `createTouchStick` | function | A stick that appears where a finger lands in its zone of `element` and follows it. |
| `decodeBrowserImage` | function | Decodes PNG, JPEG, WebP, GIF or AVIF bytes with the browser and returns a texture of them. |
| `fitBrowserImageSize` | function | The size a picture is read at: its own, or scaled down evenly to fit both limits. |
| `IndexedDBSaveStorage` | interface |  |
| `IndexedDBSaveStorageOptions` | interface |  |
| `openBrowserAssetBundle` | function | Opens the bundle at `url`, reading its index. |
| `openBrowserBundleCache` | function | A bundle cache in the Cache API under `name`. |
| `openIndexedDBSaveStorage` | function | A save storage over IndexedDB. |
| `sniffBrowserImageFormat` | function | The picture format the bytes start with, or undefined when they start like none of them. |
| `textureFromCanvas` | function | Reads a canvas, image or bitmap as a texture of straight RGBA bytes, scaled down when it is larger than the limits. |
| `TouchControl` | interface |  |
| `TouchStickOptions` | interface |  |

## `@egret/engine/web/game`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserGame` | interface |  |
| `BrowserGameBackend` | type |  |
| `BrowserGameFit` | type | How the canvas fills the element it is in: not at all, whole inside it, covering it, or stretched to it. |
| `BrowserGameLabel` | interface | A line of text on the stage whose words can be set like a value. |
| `BrowserGameLabelOptions` | interface |  |
| `BrowserGameOptions` | interface |  |
| `BrowserStatsPanel` | interface |  |
| `BrowserStatsPanelOptions` | interface |  |
| `BrowserStatsSample` | interface | What a game knows at one frame of the display. |
| `BrowserStatsSnapshot` | interface | The numbers the panel shows, as of its last refresh. |
| `createBrowserGame` | function | Makes a game ready to draw: `await createBrowserGame({ canvas, width, height, update })`, then add display objects to `game.stage`. |
| `createBrowserStatsPanel` | function |  |

## `@egret/engine/play`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `composeMusic` | function | Writes a piece. |
| `isSfxRecipe` | function | Whether a value is a recipe `synthesizeSfx` takes. |
| `MUSIC_MOODS` | value |  |
| `MUSIC_PARTS` | value | The parts of a piece, from the quietest moment to the most intense. |
| `musicMix` | function | How loud each part is at an intensity from 0 to 1: the pad always, then the bass, the drums and the tune. |
| `MusicMood` | type | The moods there are. |
| `MusicOptions` | interface |  |
| `MusicPart` | type |  |
| `MusicPiece` | interface |  |
| `play` | function | Starts a game in the page. |
| `PlayBar` | class | A bar of health, time or power. |
| `PlayBarOptions` | interface |  |
| `PlayBurstOptions` | interface |  |
| `PlayButton` | type | A button: a sprite whose middle is at (x, y), with its words in `label`. |
| `PlayButtonOptions` | interface |  |
| `PlayGame` | interface |  |
| `PlayImageOptions` | interface |  |
| `PlayKeys` | interface |  |
| `PlayMenuOptions` | interface |  |
| `PlayMotion` | type | A tween of `game.tween`: a motion that can be waited for. |
| `PlayMusic` | interface |  |
| `PlayOptions` | interface |  |
| `PlayPointer` | interface |  |
| `PlaySayOptions` | interface |  |
| `PlaySfx` | interface |  |
| `PlayStickOptions` | interface |  |
| `PlayText` | class | A line of text: a sprite to place, fade, tween and remove like any other, with words that can be changed. |
| `PlayTextOptions` | interface |  |
| `PlayToastOptions` | interface |  |
| `PlayTouchButtonOptions` | interface |  |
| `SFX_PRESETS` | value | The effects every game is given, by name. |
| `SfxRecipe` | type | An effect: one tone, or several played one after another. |
| `SfxTone` | interface | One tone of an effect. |
| `SfxWave` | type | The wave of a tone. |
| `synthesizeSfx` | function | The samples of an effect, one channel, from -1 to 1. |
| `wrapPlayWords` | function | Breaks words into lines no wider than `units`: at a space where there is one, between any two wide characters. |

## `@egret/engine/audio`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `AudioBackend` | interface | What a host gives the mixer. |
| `AudioBackendBus` | interface | One gain on the way to the output. |
| `AudioBackendSound` | interface | Decoded samples held by the host, or a file it plays as it reads it. |
| `AudioBackendStart` | interface |  |
| `AudioBackendVoice` | interface | One sound being played once. |
| `AudioBus` | interface |  |
| `AudioBusOptions` | interface |  |
| `AudioBusSnapshot` | interface |  |
| `AudioEndReason` | type | Why a voice is over: it reached its end; it was stopped; it gave its place to a newer voice; no place could be made for it; it was asked for while nothing could be heard; its sound was released; or the mixer was disposed. |
| `AudioFade` | interface |  |
| `AudioMixer` | interface |  |
| `AudioMixerOptions` | interface |  |
| `AudioMixerSnapshot` | interface |  |
| `AudioMixerState` | type | Whether sound comes out. |
| `AudioMusicOptions` | interface |  |
| `AudioPlayOptions` | interface |  |
| `AudioSound` | interface |  |
| `AudioVoice` | interface |  |
| `AudioVoiceState` | type |  |
| `createAudioMixer` | function | Volumes, voices and one music over a backend that makes the sound. |

## `@egret/engine/web/audio`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserAudio` | interface |  |
| `BrowserAudioOptions` | interface |  |
| `createBrowserAudio` | function | Sound for a page on Web Audio. |

## `@egret/engine/ui/semantics`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createUiListSemantics` | function |  |
| `createUiSemantics` | function | A semantic tree for the controls an application draws. |
| `SemanticAction` | type | What assistive technology may ask of a node: its activation, or the keyboard focus. |
| `SemanticBounds` | interface | A rectangle in the logical coordinates of the stage, the ones picking uses. |
| `semanticBoundsOf` | function | The rectangle on the stage that encloses a display object and what it holds, for the bounds of a node. |
| `semanticBoxOf` | function | The rectangle on the stage of a box a managed UI root laid out: a leaf, a row, a column or a list, by its id in the tree of the root. |
| `SemanticChecked` | type |  |
| `SemanticDescription` | interface | What a node is at this moment, read from the control that draws it. |
| `SemanticExtent` | interface | How many rows and columns a grid has in all, whether or not all of them are published. |
| `SemanticListRow` | interface |  |
| `SemanticListSource` | interface | What is read of a managed UI root. |
| `SemanticNode` | interface |  |
| `SemanticNodeOptions` | interface |  |
| `SemanticOrientation` | type |  |
| `SemanticPosition` | interface | Where an item stands in its whole set, from one. |
| `SemanticRange` | interface |  |
| `SemanticRole` | type | What a control is to someone who cannot see the canvas. |
| `SemanticSnapshot` | interface |  |
| `SemanticSnapshotNode` | interface | One published node. |
| `SemanticSort` | type | How the rows of a grid are ordered by one of its columns. |
| `SemanticsState` | type |  |
| `UiListSemantics` | interface |  |
| `UiListSemanticsOptions` | interface |  |
| `UiSemantics` | interface | The semantic tree of a UI the application draws: what each control is, what it is called and what state it is in. |
| `UiSemanticsOptions` | interface |  |

## `@egret/engine/web/semantics`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserSemantics` | interface |  |
| `BrowserSemanticsOptions` | interface |  |
| `createBrowserSemantics` | function | Projects a semantic tree to the page, for assistive technology. |
