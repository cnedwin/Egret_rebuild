# API 参考

[English](../../en/docs/api-reference.md) | 简体中文

本页列出 `@egret/engine` 每个入口导出的全部名字：它是什么，以及源码中写在它上方的第一句说明。说明取自源码注释，所以是英文。本页由 `node tools/api-reference.mjs` 根据构建出的类型声明生成，`tests/api-reference.test.mjs` 在它与声明不一致时失败；不要手工修改。共 42 个入口、1267 个导出，其中 775 个在源码中还没有说明。

该从哪个入口导入，见[该引哪个入口](entry-points.md)。

## `@egret/engine`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `animate` | 函数 | A motion of one object: `animate(engine, scope, sprite).to({ x: 100, alpha: 0.5 }, 0.5, 'quadOut').wait(0.2).to({ x: 0 }, 0.5).start()`. |
| `AssetAcquireOptions` | 接口 |  |
| `AssetGroup` | 接口 | One opaque cleanup owner; members remain borrowed genuine invariant leases. |
| `AssetGroupOptions` | 接口 |  |
| `AssetGroupState` | 类型 |  |
| `AssetLease` | 类 | One independently revocable CPU-value borrow, bound to its originating Engine. |
| `AssetLoadContext` | 接口 |  |
| `AssetManager` | 类 | CPU acquisition only: demand retains values; completed unused values are evicted. |
| `AssetProvider` | 接口 |  |
| `AssetRef` | 接口 | A stable manager-local identity paired with its invariant value descriptor. |
| `AssetType` | 接口 | Factory identity prevents equal names from aliasing; the phantom is invariant. |
| `AtlasFrameLayout` | 接口 | Logical canvas and unpacked placement of a clockwise-packed atlas rectangle. |
| `Bitmap` | 类 | A leaf borrowing one exact lease; engine affinity outlives clearing its slot. |
| `BitmapBindingTicket` | 接口 | Publishes borrowed group members once; owns no initial or candidate lease. |
| `BitmapResourceSlot` | 接口 | Owns only replacement leases; the exact initial Bitmap binding remains borrowed. |
| `BitmapResourceSlotState` | 类型 |  |
| `BoundsQueryOptions` | 接口 | Receiver-inclusive node and content budgets for logical local measurement. |
| `BYTE_READER_LIMITS` | 值 |  |
| `BYTE_WRITER_LIMITS` | 值 |  |
| `ByteOrder` | 类型 |  |
| `ByteReader` | 类 | Read-only owned binary snapshot. |
| `ByteWriter` | 类 | Fixed-capacity owned binary appends. |
| `CancellationController` | 类 | Owns the mutable signal; consumers receive the read-only cancellation port. |
| `CancellationListener` | 类型 | A DOM-free cancellation listener; it receives no host Event object. |
| `CancellationSignal` | 接口 | One-way cancellation state. |
| `ClipRectangle2D` | 接口 |  |
| `CoordinateQueryOptions` | 接口 | Receiver-inclusive ancestor budget; omitted maxNodes defaults to 4096. |
| `copyImageData2DPixels` | 函数 |  |
| `createAssetRef` | 函数 | Keep the caller's valid ID byte-for-byte; whitespace is not normalization. |
| `createAssetType` | 函数 |  |
| `createEngine` | 函数 | An Engine without a render port: it captures frames and does not render them. |
| `createEngineForProfile` | 函数 | Exact negotiation completes all successful port reads before semantics. |
| `createEventType` | 函数 | Matching uses descriptor object identity; equal key strings do not alias types. |
| `createImageData2D` | 函数 |  |
| `createNineSliceGeometry2D` | 函数 | Create an owned immutable stretch grid for an existing Mesh2D texture lease. |
| `createSequenceClip` | 函数 |  |
| `createSharedGeometry2D` | 函数 |  |
| `createSharedMaterial2D` | 函数 |  |
| `createSpriteSheet` | 函数 | Build one exact-name table from a genuine full-image lease without acquiring another resource. |
| `createTexture` | 函数 |  |
| `createTexturedGeometry2D` | 函数 |  |
| `createTextureView` | 函数 | Create an explicit logical view over an authentic straight CPU image. |
| `describeErrorCode` | 函数 | A sentence for an error code: what went wrong and, for the codes a game meets most, what to do. |
| `Diagnostic` | 接口 | Diagnostics describe this headless lifecycle slice only. |
| `DiagnosticHandler` | 类型 | Observation only: throwing cannot change cleanup or cancellation progress. |
| `DisplayObject` | 类 | A live display node; detach and terminal dispose are separate operations. |
| `DisplayObjectContainer` | 类 | Ordered display children with atomic reparenting and ownership-aware cleanup. |
| `DisplaySubtreeTicket` | 接口 | Borrows all nodes/resources; disposal only revokes this candidate publication. |
| `Disposable` | 接口 | Synchronous terminal cleanup. |
| `EgretError` | 类 | Stable machine-readable code, original cause, and associated cleanup failures. |
| `EgretErrorOptions` | 接口 |  |
| `Engine` | 类 | One headless run. |
| `EngineOptions` | 接口 |  |
| `ErrorLanguage` | 类型 | The languages an error's sentence can be in. |
| `Event` | 类 | One typed payload with synchronous dispatch state; concurrent reuse is rejected. |
| `EventDispatcher` | 类 | Synchronous typed listeners with a frozen route and per-dispatch candidates. |
| `EventListenerOptions` | 接口 |  |
| `EventPhase` | 类型 |  |
| `EventType` | 接口 | Descriptor identity and invariant payload type belong together. |
| `EventTypeOptions` | 接口 |  |
| `GameClock` | 接口 |  |
| `GameClockHandler` | 类型 |  |
| `GameClockOptions` | 接口 |  |
| `GameClockState` | 类型 |  |
| `GameClockSubscription` | 接口 |  |
| `GameClockTick` | 接口 |  |
| `getErrorLanguage` | 函数 |  |
| `Graphics` | 类 | Drawing state belongs to one node; every shape snapshots its fill and its line. |
| `HitTestOptions` | 接口 | Receiver-inclusive whole-tree admission precedes all hit arithmetic. |
| `HostAdapter` | 接口 | Host owns the surface and any borrowed device. |
| `IMAGE_LIMITS_2D` | 值 |  |
| `ImageData2D` | 接口 | Immutable CPU byte identity; the brand conveys no asset or GPU authority. |
| `ImageData2DInput` | 接口 |  |
| `isImageData2D` | 函数 |  |
| `isTexture` | 函数 | Brand-only: disposal does not change the identity of a Texture. |
| `isTexturedGeometry2D` | 函数 |  |
| `Matrix2D` | 接口 | Immutable logical-coordinate values shared by CPU capture and render hosts. |
| `Mesh2D` | 类 | A display leaf borrowing an exact lease and an immutable owned geometry. |
| `Motion` | 接口 | A chain of steps for one object. |
| `MotionEasing` | 类型 | How a step runs from its start to its end: a name, or a function from 0–1 to 0–1 (it may pass both on the way). |
| `MotionEasingName` | 类型 |  |
| `MotionState` | 类型 |  |
| `NineSliceBitmap` | 类 | A resizable stretch-only leaf borrowing one exact, caller-owned Texture lease. |
| `NineSliceBitmapOptions` | 接口 | Required local panel dimensions and fixed source-crop borders. |
| `NineSliceGeometry2DOptions` | 接口 |  |
| `NineSliceInsets2D` | 接口 | Border widths in the same units as the unrotated source crop. |
| `Point2D` | 接口 | An owned logical-coordinate value; query results are frozen at runtime. |
| `Rectangle2D` | 接口 |  |
| `Releasable` | 接口 | Releases a lease; resource ownership and disposal remain with its provider. |
| `RenderEffect2D` | 接口 | Render-only subtree effect. |
| `RenderGlow2D` | 接口 |  |
| `RenderOutline2D` | 接口 |  |
| `Scope` | 类 | Synchronous ownership boundary. |
| `ScopeState` | 类型 |  |
| `ScopeValue` | 类型 | Scope prefers dispose() when a value implements both cleanup protocols. |
| `SequenceClip` | 接口 | Public immutable sequence metadata; authentic values come from createSequenceClip. |
| `SequenceClipInput` | 接口 |  |
| `SequenceFrameInput` | 接口 |  |
| `SequencePlayback` | 接口 |  |
| `SequencePlaybackMode` | 类型 |  |
| `SequencePlaybackOptions` | 接口 |  |
| `SequencePlaybackState` | 类型 |  |
| `SequencePlayer` | 类 | Explicit absolute-time selection borrowing a target and its exact current lease. |
| `SequenceRegion` | 接口 |  |
| `SequenceSample` | 接口 |  |
| `setErrorLanguage` | 函数 | The language of the sentence in the message of every error made from now on: English unless set. |
| `SHARED_FRAME_PROFILE_2D` | 值 |  |
| `SharedBarrierCommand2D` | 接口 |  |
| `SharedDrawState2D` | 接口 |  |
| `SharedEffect2D` | 接口 | Frozen effect inputs captured with the same frame and image ownership. |
| `SharedFloatArray2D` | 类型 |  |
| `SharedFrameOptions2D` | 接口 |  |
| `SharedFrameProfile2D` | 类型 |  |
| `SharedGeometry2D` | 接口 | Immutable CPU geometry identity; the brand grants no asset or GPU authority. |
| `SharedGeometryInput2D` | 接口 |  |
| `SharedGlow2D` | 接口 |  |
| `SharedImageCommand2D` | 接口 |  |
| `SharedIndexArray2D` | 类型 |  |
| `SharedMaterial2D` | 接口 |  |
| `SharedMaterialInput2D` | 接口 |  |
| `SharedMeshCommand2D` | 接口 |  |
| `SharedOutputAlpha2D` | 类型 |  |
| `SharedPage2D` | 接口 |  |
| `SharedRectangleCommand2D` | 接口 |  |
| `SharedRegion2D` | 接口 |  |
| `SharedRenderCommand2D` | 类型 |  |
| `SharedRenderFrame2D` | 接口 |  |
| `SharedRenderHostAdapter` | 接口 |  |
| `Sprite` | 类 | Stable drawing facade; a Sprite never shares or rebinds its Graphics. |
| `SpriteSheet` | 接口 | Immutable metadata plus a separately revocable borrow of one original lease. |
| `SpriteSheetFrameInput` | 接口 | One packed absolute rectangle, indexed by its exact UTF-16 name. |
| `Stage` | 类 | Created and bound by Engine; there is no implicit global stage. |
| `Texture` | 类 | An immutable CPU image view with a separate, terminal wrapper lifetime. |
| `TexturedFloatArray2D` | 类型 |  |
| `TexturedGeometry2D` | 接口 | Immutable CPU geometry identity; the brand grants no asset or GPU authority. |
| `TexturedGeometry2DInput` | 接口 |  |
| `TexturedIndexArray2D` | 类型 |  |
| `TextureRegion2D` | 接口 |  |
| `TextureViewRegion2D` | 接口 | Owned immutable metadata. |
| `TextureViewRegionInput2D` | 接口 | A packed page rectangle and its unrotated logical, top-left region. |
| `Tween` | 接口 |  |
| `TweenEasing` | 类型 |  |
| `TweenOptions` | 接口 |  |
| `TweenState` | 类型 |  |

## `@egret/engine/webgpu`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createSharedWebGPUHost` | 函数 |  |
| `SharedDeviceSessionState` | 类型 | Shared Host lifecycle metadata. |
| `SharedDeviceSessionStatus` | 接口 | A frozen observation of one Host, with historical and current failures separate. |
| `SharedFrameSubmission` | 接口 | Native draw completion is separate from pixel readback and final retirement. |
| `SharedFrameUpload` | 接口 | A single-use authority over the existing Host-owned pending frame record. |
| `SharedFrameUploadOptions` | 接口 | Cancellation revokes an unsubmitted upload without releasing unsettled work. |
| `SharedFrameUploadReady` | 接口 | Upload completion does not imply that this frame has been presented. |
| `SharedHostResourceStatus` | 接口 | Fresh immutable data; reads do no native work. |
| `SharedWebGPUHost` | 接口 |  |
| `SharedWebGPUHostOptions` | 接口 |  |
| `SharedWebGPUHostStatus` | 接口 |  |
| `SharedWebGPUReadback` | 接口 |  |
| `WebGPUHostDiagnostic` | 接口 |  |
| `WebGPUHostErrorCode` | 类型 |  |
| `WebGPUHostFailure` | 接口 |  |
| `WebGPUHostOptions` | 接口 |  |
| `WebGPUHostState` | 类型 |  |
| `WebGPUHostStatus` | 接口 |  |
| `WebGPUReadback` | 接口 |  |

## `@egret/engine/text`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createTextField` | 函数 | Public explicit entry; shape, proxies and borrowed identities grant no authority. |
| `createTextRasterCache` | 函数 | Explicit CPU text orchestration; this entry owns no browser font or drawing surface. |
| `TextField` | 接口 | Factory-produced noneditable leaf; the brand has no runtime value. |
| `TextFieldStatus` | 接口 |  |

## `@egret/engine/layout`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `LinearLayoutItem` | 接口 | Caller-authored dimensions in the intended local coordinate system. |
| `LinearLayoutOptions` | 接口 | Explicit membership and spacing; omitted optional values use planner defaults. |
| `LinearLayoutPlacement` | 接口 | A rectangle origin and captured dimensions, without a display-object reference. |
| `LinearLayoutPlan` | 接口 | Immutable numeric result; applying it to a scene remains the caller's operation. |
| `planLinearLayout` | 函数 | Capture ordered numeric inputs, then plan local rectangle origins without scene writes. |

## `@egret/engine/web/input`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BitmapButton` | 接口 | A frozen exact-receiver facade; its accessor setter remains usable. |
| `BitmapButtonOptions` | 接口 |  |
| `BitmapButtonState` | 类型 |  |
| `createBitmapButton` | 函数 | Share a genuine input; own only the new private sheet, Bitmap and facade. |
| `createMouseInput` | 函数 | Primary mouse activation for the admitted ordinary desktop Canvas layout profile. |
| `MouseInput` | 接口 | Scope-owned synchronous input. |
| `MouseInputCancelReason` | 类型 |  |
| `MouseInputEvents` | 接口 |  |
| `MouseInputOptions` | 接口 | Fixed logical dimensions; browser layout scaling does not change game coordinates. |
| `MouseInputPayload` | 接口 |  |
| `MouseInputState` | 类型 |  |

## `@egret/engine/web/image`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserPngDecodeOptions` | 接口 |  |
| `BrowserPngPorts` | 接口 |  |
| `BrowserTextureProvider` | 接口 |  |
| `BrowserTextureProviderOptions` | 接口 |  |
| `createBrowserTextureProvider` | 函数 | Caller owns async close; managers own issued Textures and their final demand. |

## `@egret/engine/web/text`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createCanvasTextRasterProvider` | 函数 | Caller-owned fonts and explicit cache invalidation; no waiting or font loading. |

## `@egret/engine/webgl2`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createSharedWebGL2Host` | 函数 | Explicit compatibility backend; the Engine retains the original shared-frame contract. |
| `SharedDeviceSessionState` | 类型 | Shared Host lifecycle metadata. |
| `SharedDeviceSessionStatus` | 接口 | A frozen observation of one Host, with historical and current failures separate. |
| `SharedFrameSubmission` | 接口 | Native draw completion is separate from pixel readback and final retirement. |
| `SharedFrameUpload` | 接口 | A single-use authority over the existing Host-owned pending frame record. |
| `SharedFrameUploadOptions` | 接口 | Cancellation revokes an unsubmitted upload without releasing unsettled work. |
| `SharedFrameUploadReady` | 接口 | Upload completion does not imply that this frame has been presented. |
| `SharedHostResourceStatus` | 接口 | Fresh immutable data; reads do no native work. |
| `SharedLayerWebGL2Host` | 接口 |  |
| `SharedWebGL2FrameTiming` | 接口 |  |
| `SharedWebGL2Host` | 接口 |  |
| `SharedWebGL2HostOptions` | 接口 |  |
| `SharedWebGL2HostStatus` | 接口 |  |
| `SharedWebGL2Layer2D` | 接口 |  |
| `SharedWebGL2LayerEffect2D` | 接口 |  |
| `SharedWebGL2LayerPlacement2D` | 接口 |  |
| `SharedWebGL2LayerStatus` | 接口 |  |
| `SharedWebGL2Readback` | 接口 |  |
| `SharedWebGL2TimingPhase` | 类型 |  |
| `SharedWebGL2TimingSample` | 接口 |  |
| `WebGL2HostDiagnostic` | 接口 |  |
| `WebGL2HostErrorCode` | 类型 |  |
| `WebGL2HostFailure` | 接口 |  |
| `WebGL2HostState` | 类型 |  |
| `WebGL2HostStatus` | 接口 |  |

## `@egret/engine/world3d`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `AlphaMode3D` | 类型 |  |
| `ANIMATION3D_LIMITS` | 值 |  |
| `ANIMATION_TEXTURE3D_LIMITS` | 值 |  |
| `AnimationAction3D` | 类 |  |
| `AnimationClip3D` | 类 |  |
| `AnimationInterpolation3D` | 类型 |  |
| `AnimationLoop3D` | 类型 |  |
| `AnimationMixer3D` | 类 | Plays clips on the subtree under `root`, blending concurrent actions by weight. |
| `AnimationPath3D` | 类型 |  |
| `AnimationStateMachine3D` | 类 |  |
| `AnimationTexture3D` | 类 | Bone matrices of one skinned mesh for every frame of a set of clips. |
| `AnimationTrack3D` | 接口 |  |
| `AnimationTrackInput3D` | 接口 |  |
| `ArrowHelper3D` | 类 | Arrow from `origin` along `direction`; change them and call update(). |
| `Attribute3D` | 类 |  |
| `ATTRIBUTE_3D` | 值 | Well-known attribute names understood by the built-in materials. |
| `AttributeArray3D` | 类型 |  |
| `BakeAnimationOptions3D` | 接口 |  |
| `bakeAnimationTexture3D` | 函数 | Sample clips into an animation texture. |
| `BakedClip3D` | 接口 |  |
| `BasisModule3D` | 接口 | The parts of an initialized Basis Universal transcoder module (`await BASIS()`) this adapter calls. |
| `BATCH3D_LIMITS` | 值 |  |
| `BatchedMesh3D` | 类 | Many geometries drawn as one mesh with one material and one draw call. |
| `Blending3D` | 类型 |  |
| `BodyType3D` | 类型 |  |
| `Bone3D` | 类 |  |
| `box3Empty` | 函数 |  |
| `box3ExpandByPoint` | 函数 |  |
| `box3IsEmpty` | 函数 |  |
| `box3Transform` | 函数 | Axis-aligned bounds of a transformed box (Arvo's method). |
| `box3Union` | 函数 |  |
| `BoxGeometryOptions3D` | 接口 |  |
| `BoxHelper3D` | 类 | Wire box around an object's world bounds. |
| `Camera3D` | 类 |  |
| `CameraHelper3D` | 类 | Outline of a camera's view volume. |
| `CapsuleGeometryOptions3D` | 接口 |  |
| `CatmullRomCurve3D` | 类 | Smooth curve through every control point. |
| `CatmullRomKind3D` | 类型 |  |
| `CharacterController3D` | 类 | Kinematic capsule that slides along the world instead of being simulated. |
| `CharacterControllerOptions3D` | 接口 |  |
| `CharacterMotor3D` | 类 | A walking, jumping character. |
| `CharacterMotorOptions3D` | 接口 |  |
| `CircleGeometryOptions3D` | 接口 |  |
| `clamp` | 函数 |  |
| `Cloth3D` | 类 | A rectangular sheet. |
| `CLOTH3D_LIMITS` | 值 |  |
| `ClothOptions3D` | 接口 |  |
| `colorFromHex` | 函数 | Decode a 0xRRGGBB sRGB color into linear RGB in [0, 1]. |
| `ColorInput3D` | 类型 | A color as 0xRRGGBB sRGB hex or linear RGB components. |
| `CompoundChild3D` | 接口 | One part of a compound shape, placed in the body's local frame. |
| `COMPRESSED_BLOCK_BYTES_3D` | 值 | Bytes per 4x4 block of each compressed format. |
| `CompressedFormat3D` | 类型 | Block-compressed GPU formats that can be uploaded without transcoding. |
| `CompressedPixels3D` | 接口 | A pre-compressed mip chain, largest level first. |
| `COMPRESSION3D_LIMITS` | 值 |  |
| `computeObjectBounds3D` | 函数 | World-space bounds of an object and its descendants as [minX, minY, minZ, maxX, maxY, maxZ]. |
| `connectPhysics3D` | 函数 |  |
| `ConvexHullShape3D` | 类 |  |
| `createAmbientLight3D` | 函数 | Uniform light from every direction. |
| `createAnimationClip3D` | 函数 |  |
| `createAnimationStateMachine3D` | 函数 |  |
| `createArrowHelper3D` | 函数 |  |
| `createAxesGeometry3D` | 函数 | Three colored segments from the origin along +X (red), +Y (green) and +Z (blue). |
| `createAxesHelper3D` | 函数 | Ready-made axes node colored X red, Y green, Z blue. |
| `createBasisTranscoder3D` | 函数 | Turn an initialized Basis Universal transcoder module into the `transcodeKtx2` option. |
| `createBatchedMesh3D` | 函数 |  |
| `createBoxEdgesGeometry3D` | 函数 | The twelve edges of an axis-aligned box given as [minX, minY, minZ, maxX, maxY, maxZ]. |
| `createBoxGeometry3D` | 函数 | Axis-aligned box centered on the origin with one material group per face (+X, -X, +Y, -Y, +Z, -Z). |
| `createBoxHelper3D` | 函数 |  |
| `createCameraHelper3D` | 函数 |  |
| `createCapsuleGeometry3D` | 函数 | Capsule along Y; `height` is the length of the cylindrical middle section. |
| `createCharacterController3D` | 函数 |  |
| `createCharacterMotor3D` | 函数 |  |
| `createCircleGeometry3D` | 函数 | Flat disc or sector in the XY plane, facing +Z. |
| `createCloth3D` | 函数 |  |
| `createConeGeometry3D` | 函数 |  |
| `createConvexHullShape3D` | 函数 | Build a convex hull shape from a geometry's vertices, or from a flat list of points. |
| `createCubeTextureFromEquirect3D` | 函数 | Build a cube texture from an equirectangular panorama. |
| `createCustomShader3D` | 函数 |  |
| `createCylinderGeometry3D` | 函数 | Cylinder or truncated cone along Y. |
| `createDecal3D` | 函数 | A decal mesh on a target mesh, added as its child so it moves with it. |
| `createDecalGeometry3D` | 函数 | Cut the part of a mesh's surface that lies inside the decal box. |
| `createDirectionalLight3D` | 函数 | Parallel rays, such as sunlight. |
| `createDodecahedronGeometry3D` | 函数 |  |
| `createDracoDecoder3D` | 函数 | Turn an initialized Draco decoder module into the `decodeDraco` option of the glTF loader. |
| `createEdgesGeometry3D` | 函数 | Line segments for outline and crease edges only: edges with one face, or whose two faces meet at more than `thresholdAngle` radians. |
| `createExtrudeGeometry3D` | 函数 | Give an outline thickness. |
| `createFatLine3D` | 函数 |  |
| `createFollowCamera3D` | 函数 |  |
| `createGeometry3D` | 函数 | Build a geometry from plain arrays; missing normals are computed for triangles. |
| `createGeometryBuilder3D` | 函数 | A builder that merges placed, coloured parts into one geometry. |
| `createGlassMaterial3D` | 函数 | A standard material set up as glass: smooth and see-through, with reflections kept. |
| `createGpuParticles3D` | 函数 |  |
| `createGradientCubeTexture3D` | 函数 | Procedural sky cube: a vertical gradient from `ground` through `horizon` to `zenith`, in sRGB bytes. |
| `createGridGeometry3D` | 函数 | Square grid of lines on the XZ plane, centered at the origin. |
| `createGridHelper3D` | 函数 | Ready-made grid node for editors and debug views. |
| `createHeightField3D` | 函数 |  |
| `createHeightFieldFromPixels3D` | 函数 | Height field with one sample per pixel of a decoded RGBA image; the image's top row is the -Z edge. |
| `createHemisphereLight3D` | 函数 | Sky color from above blending to a ground color from below (world Y axis). |
| `createIcosahedronGeometry3D` | 函数 |  |
| `createJelly3D` | 函数 |  |
| `createJellyShader3D` | 函数 | The vertex hook a jelly drives. |
| `createLambertMaterial3D` | 函数 | Diffuse-only lighting; the cheapest lit model. |
| `createLatheGeometry3D` | 函数 | Revolve a profile of [x, y] points (x is the distance from the Y axis) around Y. |
| `createLightHelper3D` | 函数 |  |
| `createLineMaterial3D` | 函数 | Unlit line or point material; pair it with a 'lines', 'line-strip' or 'points' geometry. |
| `createMatcapMaterial3D` | 函数 | Lighting baked into a sphere image: the surface color is looked up by the view-space normal, so no lights are needed. |
| `createMeshShape3D` | 函数 | Build a collision mesh from a geometry or the unskinned, non-instanced triangle meshes under an object. |
| `createNavCrowd3D` | 函数 |  |
| `createNavMesh3D` | 函数 | Build a navigation mesh from level geometry: a geometry, or an object whose meshes are merged with their world transforms. |
| `createOctahedronGeometry3D` | 函数 |  |
| `createOrthographicCamera3D` | 函数 |  |
| `createParticleEmitter3D` | 函数 |  |
| `createPerspectiveCamera3D` | 函数 |  |
| `createPhongMaterial3D` | 函数 | Diffuse plus Blinn-Phong specular highlights. |
| `createPhysicsWorld3D` | 函数 |  |
| `createPlaneGeometry3D` | 函数 | Plane in the XY plane facing +Z. |
| `createPointLight3D` | 函数 |  |
| `createPolyhedronGeometry3D` | 函数 | Project a convex solid's triangles onto a sphere, subdividing each `detail` times. |
| `createQuadGeometry3D` | 函数 | Unit quad in XY used by sprites: corners at +-0.5, facing +Z. |
| `createRagdoll3D` | 函数 |  |
| `createRingGeometry3D` | 函数 | Flat ring in the XY plane, facing +Z. |
| `createRope3D` | 函数 |  |
| `createScreenLayer3D` | 函数 |  |
| `createShapeGeometry3D` | 函数 | Fill one or more outlines in the XY plane, facing +Z. |
| `createSkeletonHelper3D` | 函数 |  |
| `createSkinnedInstancedMesh3D` | 函数 |  |
| `createSolidTexture3D` | 函数 | Single-color 1x1 texture, useful as a placeholder or constant map. |
| `createSphereGeometry3D` | 函数 | UV sphere with poles on the Y axis. |
| `createSpotLight3D` | 函数 |  |
| `createSprite3D` | 函数 |  |
| `createSpriteMaterial3D` | 函数 | Camera-facing unlit quad material for Sprite3D. |
| `createStandardMaterial3D` | 函数 | Physically based metallic-roughness model, matching glTF 2.0 materials. |
| `createTerrain3D` | 函数 |  |
| `createTerrainMaterial3D` | 函数 | A standard material whose color is a blend of ground textures, such as sand, grass, rock and snow, painted by a weight map. |
| `createTerrainStream3D` | 函数 |  |
| `createTetrahedronGeometry3D` | 函数 |  |
| `createTextGeometry3D` | 函数 | Text as a mesh geometry in the XY plane, facing +Z, with the first baseline on y = 0. |
| `createTextShapes3D` | 函数 | Outlines of a text as flat shapes; see Font3D.generateShapes. |
| `createToonMaterial3D` | 函数 | Cel shading: diffuse light quantized into `steps` flat bands. |
| `createTorusGeometry3D` | 函数 | Torus around the Z axis. |
| `createTorusKnotGeometry3D` | 函数 |  |
| `createTrail3D` | 函数 |  |
| `createTransformGizmo3D` | 函数 |  |
| `createTubeGeometry3D` | 函数 | Sweep a circle along a curve, using twist-free frames. |
| `createUnlitMaterial3D` | 函数 | Constant color, unaffected by lights. |
| `createVehicle3D` | 函数 |  |
| `createVolumetricFog3D` | 函数 |  |
| `createWater3D` | 函数 |  |
| `createWaterMaterial3D` | 函数 | The material Water3D uses, for a water surface on your own geometry: a standard material that refracts, with the wave hooks attached. |
| `createWireframeGeometry3D` | 函数 | Line segments for every triangle edge, each drawn once. |
| `CubeTexture3D` | 类 | Six square faces in +X, -X, +Y, -Y, +Z, -Z order. |
| `CubicBezierCurve3D` | 类 |  |
| `Curve3D` | 类 | Base for every curve: subclasses implement getPoint(t) for t in [0, 1]. |
| `CURVE3D_LIMITS` | 值 |  |
| `CurvePath3D` | 类 | Several curves joined end to end and traversed as one, by length. |
| `CustomShader3D` | 接口 | A fragment hook that post-processes a material's shaded color. |
| `CylinderGeometryOptions3D` | 接口 |  |
| `DECAL3D_LIMITS` | 值 |  |
| `DecalOptions3D` | 接口 |  |
| `decodeMeshopt3D` | 函数 | Decode one EXT_meshopt_compression buffer view. |
| `decompressZstd3D` | 函数 | Decompress Zstandard data: one or more frames, including skippable ones. |
| `DEG_TO_RAD_3D` | 值 |  |
| `DeserializedScene3D` | 接口 |  |
| `DeserializeOptions3D` | 接口 |  |
| `deserializeScene3D` | 函数 | Rebuild a subtree from data produced by serializeScene3D. |
| `DisposeListener3D` | 类型 |  |
| `DracoModule3D` | 接口 | The parts of an initialized Draco decoder module (`await DracoDecoderModule()`) this adapter calls. |
| `EPSILON_3D` | 值 |  |
| `EquirectOptions3D` | 接口 |  |
| `ExtrudeGeometryOptions3D` | 接口 |  |
| `FatLine3D` | 类 | A polyline drawn as a ribbon of triangles that turns to face the camera, so it can be wider than the one pixel that plain lines allow. |
| `FatLineOptions3D` | 接口 |  |
| `findGridPath3D` | 函数 | Shortest path on a grid of cells, for tile maps. |
| `Fog3D` | 类型 |  |
| `FollowCamera3D` | 类 | Third-person camera: orbits a target at a distance, and moves closer when a wall would hide the target, easing back out afterwards. |
| `FollowCameraOptions3D` | 接口 |  |
| `Font3D` | 类 |  |
| `FontSource3D` | 接口 |  |
| `frustumFromMatrix` | 函数 |  |
| `frustumIntersectsBox` | 函数 |  |
| `frustumIntersectsSphere` | 函数 |  |
| `Geometry3D` | 类 |  |
| `GEOMETRY3D_LIMITS` | 值 |  |
| `GeometryBuilder3D` | 接口 |  |
| `GeometryGroup3D` | 接口 |  |
| `GeometryInput3D` | 接口 |  |
| `GeometryPart3D` | 接口 |  |
| `GizmoHandle3D` | 类型 | A single axis, a plane spanned by two axes, or 'xyz' for the center handle of the scale mode. |
| `GizmoMode3D` | 类型 |  |
| `GizmoSpace3D` | 类型 |  |
| `GltfAsset3D` | 接口 |  |
| `GltfDracoRequest3D` | 接口 |  |
| `GltfDracoResult3D` | 接口 |  |
| `GltfImageRequest3D` | 接口 |  |
| `GltfLoadOptions3D` | 接口 |  |
| `GltfMeshoptRequest3D` | 接口 |  |
| `GlyphOutline3D` | 接口 | One glyph in font units. |
| `GpuParticles3D` | 类 | An instanced, camera-facing quad per particle. |
| `GpuParticlesOptions3D` | 接口 |  |
| `GridPathOptions3D` | 接口 |  |
| `HDR3D_LIMITS` | 值 |  |
| `HdrImage3D` | 接口 | Linear RGB floats, three per pixel, top row first. |
| `HeightField3D` | 类 | Heights on a regular grid in the XZ plane. |
| `HeightFieldOptions3D` | 接口 |  |
| `HeightImageOptions3D` | 接口 |  |
| `inflate3D` | 函数 | Decompress a zlib stream, or a bare deflate stream when `raw` is set. |
| `InstanceBlendOptions3D` | 接口 |  |
| `InstanceClipOptions3D` | 接口 |  |
| `InstancedMesh3D` | 类 | Draw one geometry many times in a single call with per-instance transforms and colors. |
| `isCompressedPixels3D` | 函数 |  |
| `isKtx23D` | 函数 | True when `bytes` starts with the KTX 2.0 file identifier. |
| `isTexturePixels3D` | 函数 |  |
| `Jelly3D` | 类 | Makes everything drawn under `target` behave like jelly. |
| `JellyOptions3D` | 接口 |  |
| `Joint3D` | 类 | A constraint between two bodies, or between a body and the world. |
| `JointOptions3D` | 接口 |  |
| `JointType3D` | 类型 |  |
| `Ktx2Info3D` | 接口 |  |
| `Ktx2Options3D` | 接口 |  |
| `Ktx2Result3D` | 接口 |  |
| `LatheGeometryOptions3D` | 接口 |  |
| `Light3D` | 类 |  |
| `LIGHT3D_LIMITS` | 值 |  |
| `LightHelper3D` | 类 | Shows where a light is and where it points: a ray for directional, a cone for spot, a range sphere for point lights. |
| `LightOptions3D` | 接口 |  |
| `LightShadow3D` | 接口 |  |
| `LightType3D` | 类型 |  |
| `linearColor3D` | 函数 | A hex colour as seen on screen in the linear RGB the renderer lights, for vertex colours written by hand. |
| `linearToSrgb` | 函数 |  |
| `LineCurve3D` | 类 |  |
| `LineHelper3D` | 类 | Shared base: a line mesh whose vertices are rewritten by update(). |
| `loadGltf3D` | 函数 | Parse a glTF 2.0 asset from .glb bytes, .gltf JSON bytes or an already parsed JSON object. |
| `Lod3D` | 类 | Shows exactly one child depending on the distance to the camera. |
| `mat3NormalFromMat4` | 函数 | 3x3 inverse transpose of the upper-left block, written as nine column-major floats. |
| `mat4Compose` | 函数 | Affine matrix from translation, unit quaternion and scale. |
| `mat4Copy` | 函数 |  |
| `mat4Decompose` | 函数 | Split an affine matrix; a negative determinant is folded into scale X. |
| `mat4Determinant` | 函数 |  |
| `mat4Identity` | 函数 |  |
| `mat4Invert` | 函数 | Returns false and leaves `out` untouched when the matrix is singular. |
| `mat4LookAt` | 函数 | World matrix of an object at `eye` whose negative Z axis points at `target`. |
| `mat4MaxScaleOnAxis` | 函数 |  |
| `mat4Multiply` | 函数 | out = a * b: with column vectors, b applies first. |
| `mat4Orthographic` | 函数 |  |
| `mat4Perspective` | 函数 | Right-handed perspective projection to clip depth [-1, 1]. |
| `Material3D` | 类 | One material class carries the superset of surface parameters; `shading` selects the lighting model. |
| `MaterialOptions3D` | 接口 |  |
| `mergeGeometries3D` | 函数 | Join geometries that share the same attribute set into one. |
| `mergeVertices3D` | 函数 | Weld vertices whose every attribute matches within `tolerance`, producing an indexed geometry. |
| `Mesh3D` | 类 |  |
| `MESH3D_LIMITS` | 值 |  |
| `MESHOPT3D_LIMITS` | 值 |  |
| `MeshoptFilter3D` | 类型 |  |
| `MeshoptMode3D` | 类型 |  |
| `MorphTarget3D` | 接口 |  |
| `NavAgent3D` | 类 |  |
| `NavAgentOptions3D` | 接口 |  |
| `NavCrowd3D` | 类 | Agents walking on one navigation mesh. |
| `NAVIGATION3D_LIMITS` | 值 |  |
| `NavLocation3D` | 接口 |  |
| `NavMesh3D` | 类 |  |
| `NavMeshOptions3D` | 接口 |  |
| `NavPath3D` | 接口 |  |
| `NavPathOptions3D` | 接口 |  |
| `NavPoint3D` | 类型 |  |
| `NumericArray3D` | 类型 |  |
| `Object3D` | 类 |  |
| `Object3DKind` | 类型 |  |
| `OrthographicCameraOptions3D` | 接口 |  |
| `parseKtx23D` | 函数 | Read a KTX 2.0 file holding one 2D texture and its mip chain. |
| `parseRgbe3D` | 函数 | Decode a Radiance .hdr file (flat or run-length encoded, -Y +X orientation). |
| `parseTrueTypeFont3D` | 函数 | Read a TrueType font: a .ttf file, an OpenType file with TrueType (glyf) outlines, or the first font of a .ttc collection. |
| `parseTypefaceFont3D` | 函数 | Read a font in the typeface JSON format (the `*.typeface.json` files used with web 3D libraries). |
| `ParticleEmitter3D` | 类 |  |
| `ParticleEmitterOptions3D` | 接口 |  |
| `PARTICLES3D_LIMITS` | 值 |  |
| `ParticleShape3D` | 类型 |  |
| `Path2D3D` | 类 | A 2D outline built with pen commands; used as a contour or a hole. |
| `PerspectiveCameraOptions3D` | 接口 |  |
| `PhongMaterialOptions3D` | 接口 |  |
| `PHYSICS3D_LIMITS` | 值 |  |
| `PHYSICS_HULL3D_LIMITS` | 值 |  |
| `PHYSICS_MESH3D_LIMITS` | 值 |  |
| `PhysicsClient3D` | 类 | The page's end of a remote physics world. |
| `PhysicsContact3D` | 接口 | What a pair of solid bodies did to each other in one step. |
| `PhysicsPort3D` | 接口 | A Worker, a worker's global scope, a MessagePort: anything that posts and receives messages. |
| `PhysicsRaycastHit3D` | 接口 |  |
| `PhysicsShapeCastHit3D` | 接口 |  |
| `PhysicsWorld3D` | 类 |  |
| `PhysicsWorldOptions3D` | 接口 |  |
| `PlanarReflection3D` | 类 | A mirror camera and the target it draws into. |
| `PlanarReflectionPass3D` | 接口 | Output and inclusion settings shared by reflection draws and program preparation. |
| `PlaneGeometryOptions3D` | 接口 |  |
| `Point2D` | 类型 |  |
| `Point3D` | 类型 |  |
| `PointLightOptions3D` | 接口 |  |
| `PolyhedronOptions3D` | 接口 |  |
| `projectToViewport3D` | 函数 | Projects a world point into a viewport of `width` by `height` pixels through `camera`. |
| `QuadraticBezierCurve3D` | 类 |  |
| `quatCopy` | 函数 |  |
| `quatFromAxisAngle` | 函数 |  |
| `quatFromEuler` | 函数 | Intrinsic XYZ Euler angles in radians (rotate X, then Y, then Z in local axes). |
| `quatFromRotationMatrix` | 函数 | Rotation part of a matrix without scale or shear. |
| `quatIdentity` | 函数 |  |
| `quatMultiply` | 函数 |  |
| `quatNormalize` | 函数 |  |
| `quatSlerp` | 函数 | Shortest-arc spherical interpolation; falls back to nlerp for close inputs. |
| `quatToEuler` | 函数 | Inverse of quatFromEuler; writes radians into out[0..2]. |
| `Ragdoll3D` | 类 | Bodies and joints for a skeleton, created from the current pose by activate() and removed again by deactivate(). |
| `RAGDOLL3D_LIMITS` | 值 |  |
| `RagdollJoint3D` | 接口 |  |
| `RagdollOptions3D` | 接口 |  |
| `RagdollPart3D` | 接口 |  |
| `Raycaster3D` | 类 |  |
| `RaycastHit3D` | 接口 |  |
| `RaycastOptions3D` | 接口 |  |
| `rayIntersectBox` | 函数 | Slab test; returns the entry distance (0 when the origin is inside) or -1. |
| `rayIntersectSphere` | 函数 | Distance along the ray to the sphere, or -1 when it misses. |
| `rayIntersectTriangle` | 函数 | Moller-Trumbore. |
| `ReflectionRenderer3D` | 接口 | Anything that can draw a scene into a render target: both first-party renderers qualify. |
| `RemoteBody3D` | 类 | The page's stand-in for a body that lives behind the port. |
| `RemoteBodyOptions3D` | 接口 |  |
| `RemoteJoint3D` | 类 |  |
| `RemoteJointOptions3D` | 接口 |  |
| `RemoteRaycastHit3D` | 接口 |  |
| `RemoteShape3D` | 类型 | Shapes that can be described in a message. |
| `RenderItem3D` | 接口 |  |
| `RenderList3D` | 类 |  |
| `RenderStats3D` | 接口 |  |
| `RenderTarget3D` | 类 | Off-screen color target. |
| `RenderTargetFormat3D` | 类型 | Color storage of a render target: 8-bit sRGB, or half-float linear for values above 1. |
| `RenderTargetOptions3D` | 接口 |  |
| `Resource3D` | 类 | CPU-side resource with a version counter and terminal disposal. |
| `retargetAnimationClip3D` | 函数 | A clip for the target rig that moves it as `clip` moves the source rig. |
| `RetargetOptions3D` | 接口 |  |
| `RigidBody3D` | 类 |  |
| `RigidBodyOptions3D` | 接口 |  |
| `RingGeometryOptions3D` | 接口 |  |
| `Rope3D` | 类 | A rope or cable. |
| `RopeOptions3D` | 接口 |  |
| `sampleAnimationTrack3D` | 函数 | Evaluate one track at `time` into `out`; `hint` caches the last key index. |
| `Scene3D` | 类 | Root of a renderable graph; owns environment-wide settings. |
| `SCENE_DOCUMENT_FORMAT_3D` | 值 |  |
| `SCENE_DOCUMENT_VERSION_3D` | 值 |  |
| `SceneDocument3D` | 接口 |  |
| `ScreenLayer3D` | 类 | Full-screen image drawn in the same pass as the 3D scene, typically the canvas of a 2D stage. |
| `ScreenLayerOptions3D` | 接口 |  |
| `SERIALIZE3D_LIMITS` | 值 |  |
| `SerializeOptions3D` | 接口 |  |
| `serializeScene3D` | 函数 | Write the subtree under `root` as JSON-safe data. |
| `servePhysics3D` | 函数 | Run a physics world on this end of a port and answer the messages of a PhysicsClient3D. |
| `setColor3D` | 函数 |  |
| `Shading3D` | 类型 |  |
| `Shape3D` | 类 | A filled outline with optional holes. |
| `ShapeDefinition3D` | 类型 |  |
| `Side3D` | 类型 |  |
| `signedArea2D` | 函数 |  |
| `Skeleton3D` | 类 | Ordered bones with their inverse bind matrices; one instance may drive many meshes. |
| `SkeletonHelper3D` | 类 | A line from every bone to its parent bone. |
| `SkinnedInstancedMesh3D` | 类 | Many copies of one skinned mesh in a single draw call, each at its own place in its own clip. |
| `sphereFromBox` | 函数 |  |
| `SphereGeometryOptions3D` | 接口 |  |
| `sphereTransform` | 函数 |  |
| `SpotLightOptions3D` | 接口 |  |
| `Sprite3D` | 类 | Camera-facing textured quad. |
| `SpriteMaterialOptions3D` | 接口 |  |
| `srgbToLinear` | 函数 |  |
| `StandardMaterialOptions3D` | 接口 |  |
| `STATE_MACHINE3D_LIMITS` | 值 |  |
| `StateBlendEntry3D` | 接口 |  |
| `StateCondition3D` | 接口 |  |
| `StateConditionOperator3D` | 类型 |  |
| `StateOptions3D` | 接口 |  |
| `StateParameter3D` | 类型 |  |
| `StrandOptions3D` | 接口 |  |
| `Terrain3D` | 类 | A height field drawn as a grid of chunk meshes. |
| `TERRAIN3D_LIMITS` | 值 |  |
| `TerrainMaterialOptions3D` | 接口 |  |
| `TerrainOptions3D` | 接口 |  |
| `TerrainStream3D` | 类 |  |
| `TerrainStreamOptions3D` | 接口 |  |
| `TerrainTile3D` | 接口 |  |
| `TEXT3D_LIMITS` | 值 |  |
| `TextGeometryOptions3D` | 接口 |  |
| `TextLayoutOptions3D` | 接口 |  |
| `Texture3D` | 类 |  |
| `TEXTURE3D_LIMITS` | 值 |  |
| `TextureColorSpace3D` | 类型 |  |
| `TextureFilter3D` | 类型 |  |
| `TextureOptions3D` | 接口 |  |
| `TexturePixels3D` | 接口 | Tightly packed straight-alpha RGBA8 rows, top row first. |
| `TextureSource3D` | 类型 |  |
| `TextureWrap3D` | 类型 |  |
| `toNonIndexedGeometry3D` | 函数 | Copy with every triangle owning its vertices, as needed for per-face data. |
| `Topology3D` | 类型 |  |
| `TorusGeometryOptions3D` | 接口 |  |
| `TorusKnotGeometryOptions3D` | 接口 |  |
| `Trail3D` | 类 | Add the trail to the scene itself, not under the object it follows: its vertices are world positions. |
| `TRAIL3D_LIMITS` | 值 |  |
| `TrailOptions3D` | 接口 |  |
| `transformGeometry3D` | 函数 | Bake a 4x4 transform into positions, normals and tangents, in place. |
| `TransformGizmo3D` | 类 |  |
| `TransformGizmoOptions3D` | 接口 |  |
| `TransitionOptions3D` | 接口 |  |
| `TriangleMeshShape3D` | 类 |  |
| `triangulateShape3D` | 函数 | Triangulate an outline with holes by ear clipping. |
| `TubeGeometryOptions3D` | 接口 |  |
| `vec3Add` | 函数 |  |
| `vec3Copy` | 函数 |  |
| `vec3Cross` | 函数 |  |
| `vec3Distance` | 函数 |  |
| `vec3Dot` | 函数 |  |
| `vec3Length` | 函数 |  |
| `vec3Lerp` | 函数 |  |
| `vec3Normalize` | 函数 | A zero-length input yields the zero vector instead of NaN. |
| `vec3Scale` | 函数 |  |
| `vec3Set` | 函数 |  |
| `vec3Sub` | 函数 |  |
| `vec3TransformDirection` | 函数 | Transform a direction (w = 0) by the upper 3x3; the result is not normalized. |
| `vec3TransformMat4` | 函数 | Transform a point (w = 1) with perspective division. |
| `vec3TransformQuat` | 函数 |  |
| `Vehicle3D` | 类 | Drives a chassis body on ray wheels. |
| `VEHICLE3D_LIMITS` | 值 |  |
| `VehicleOptions3D` | 接口 |  |
| `ViewportPoint3D` | 接口 | Where a world point falls in a viewport, for labels, markers and pointers drawn over the picture. |
| `VolumetricFog3D` | 类 | Add one to the scene's root and keep `receiveShadow` on. |
| `VolumetricFogOptions3D` | 接口 |  |
| `Water3D` | 类 | A horizontal water surface. |
| `WaterOptions3D` | 接口 |  |
| `Wheel3D` | 接口 |  |
| `WheelOptions3D` | 接口 |  |
| `WORLD3D_LIMITS` | 值 |  |
| `World3DError` | 类 | Stable machine-readable code plus a human-readable detail and the original cause. |
| `World3DErrorCode` | 类型 |  |

## `@egret/engine/webgl2/world3d`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `Atmosphere3D` | 类 | Height fog and light shafts for `renderer.postProcess.custom`. |
| `AtmosphereOptions3D` | 接口 |  |
| `AudioListener3D` | 类 | Ears of the scene. |
| `AudioListenerOptions3D` | 接口 |  |
| `captureCubeTexture3D` | 函数 | Render six 90-degree views from `position` and return them as a cube texture with mipmaps. |
| `createAtmosphere3D` | 函数 |  |
| `createAudioListener3D` | 函数 |  |
| `createCustomPost3D` | 函数 |  |
| `createDynamicResolution3D` | 函数 |  |
| `createFlyControls3D` | 函数 |  |
| `createFollowControls3D` | 函数 |  |
| `createOrbitControls3D` | 函数 |  |
| `createPositionalAudio3D` | 函数 |  |
| `createPostProcessSettings3D` | 函数 |  |
| `createScreenMarkers3D` | 函数 | A layer of page elements that follow scene points. |
| `createTransformControls3D` | 函数 |  |
| `createWebGL2Renderer3D` | 函数 |  |
| `createWorld3DApp` | 函数 | Starts a World3D game on `canvas`: an Engine, a renderer for the chosen backend and quality, and a frame loop. |
| `createWorld3DHost` | 函数 | Host adapter that reserves `canvas` for one Engine. |
| `createWorld3DOverlay` | 函数 | Lays a transparent 2D stage over `canvas` (the 3D canvas, which must sit in a positioned parent) and starts it. |
| `createWorld3DStats` | 函数 |  |
| `createWorld3DView` | 函数 |  |
| `CUBE_TEXTURE_ASSET_3D` | 值 | A cube texture. |
| `CubeCaptureOptions3D` | 接口 |  |
| `CustomPost3D` | 接口 | A full-screen hook that runs after ambient occlusion and bloom and before tone mapping. |
| `DynamicResolution3D` | 接口 | A drawing resolution that follows the frame rate: down quickly when frames are slow, up slowly when they are not. |
| `DynamicResolutionOptions3D` | 接口 |  |
| `FlyControls3D` | 类 |  |
| `FlyControlsKeys3D` | 接口 |  |
| `FlyControlsOptions3D` | 接口 |  |
| `FollowControls3D` | 类 |  |
| `FollowControlsOptions3D` | 接口 |  |
| `GLTF_ASSET_3D` | 值 | A loaded glTF file. |
| `GltfUrlLoadOptions3D` | 接口 | glTF loading options: download limits plus the optional KTX2, meshopt and Draco decoders. |
| `isSoftwareRendered3D` | 函数 | Whether WebGL here is drawn by software (SwiftShader, llvmpipe and the like), as in a headless browser, a virtual machine or a page whose graphics card is blocked. |
| `loadCubeTexture3D` | 函数 | Load six square images in +X, -X, +Y, -Y, +Z, -Z order as a cube texture. |
| `loadGltfFromUrl3D` | 函数 | Load a .glb or .gltf file; relative buffer and image URIs resolve against `url`. |
| `LoadOptions3D` | 接口 |  |
| `loadTexture3D` | 函数 | Load an image or KTX2 file as a texture. |
| `OrbitControls3D` | 类 |  |
| `OrbitControlsOptions3D` | 接口 |  |
| `pickWorld3DBackend` | 函数 | The backend asked for by the address (`backend=webgpu`), or `fallback`. |
| `pickWorld3DQuality` | 函数 | The picture quality for this device: the address's `quality`, then a stored choice, then `low` for software rendering, a finger or a window shorter than 600 pixels, `medium` for 4 GB of memory or less, and `high` otherwise. |
| `PositionalAudio3D` | 类 | A sound placed in the scene. |
| `PositionalAudioOptions3D` | 接口 |  |
| `POST3D_LIMITS` | 值 |  |
| `PostProcessSettings3D` | 接口 |  |
| `registerWorld3DAssets` | 函数 | Register the World3D asset providers on an AssetManager. |
| `Renderer3D` | 接口 | What both world3d backends provide; views and tools depend on this only. |
| `Renderer3DInfo` | 接口 |  |
| `SCENE_ASSET_3D` | 值 | A scene document written by serializeScene3D. |
| `ScreenMarker3D` | 接口 |  |
| `ScreenMarkerOptions3D` | 接口 |  |
| `ScreenMarkers3D` | 接口 |  |
| `ScreenMarkersOptions3D` | 接口 |  |
| `startWorld3DLoop` | 函数 | Advance the Engine clock once per display frame. |
| `TEXTURE_ASSET_3D` | 值 | A 2D texture loaded from an image or KTX2 file. |
| `TextureLoadOptions3D` | 接口 | Texture loading options; `transcodeKtx2` handles KTX2 payloads the built-in reader cannot use directly. |
| `ToneMapping3D` | 类型 |  |
| `TransformControls3D` | 类 |  |
| `WebGL2ProgramVariant3D` | 接口 | One material program for an expected draw. |
| `WebGL2Renderer3D` | 类 |  |
| `WebGL2Renderer3DOptions` | 接口 |  |
| `WORLD3D_QUALITY_PRESETS` | 值 | The three qualities. |
| `World3DApp` | 接口 |  |
| `World3DAppOptions` | 接口 |  |
| `World3DAssetOptions` | 接口 |  |
| `World3DBackend` | 类型 |  |
| `World3DClockSource` | 接口 | The part of an Engine this view needs: its explicit game clock. |
| `World3DDeviceHints` | 接口 | What `pickWorld3DQuality` reads about the device. |
| `World3DFrameMetrics` | 接口 |  |
| `World3DFramePass` | 接口 |  |
| `World3DGpuTiming` | 类型 |  |
| `World3DLoopSource` | 接口 |  |
| `World3DOverlay` | 接口 |  |
| `World3DOverlayOptions` | 接口 |  |
| `World3DPassKind` | 类型 |  |
| `World3DQuality` | 类型 |  |
| `World3DQualityPreset` | 接口 | What one picture quality turns on. |
| `World3DShowOptions` | 接口 |  |
| `World3DStats` | 接口 |  |
| `World3DStatsOptions` | 接口 |  |
| `World3DView` | 类 |  |
| `World3DViewKind` | 类型 |  |
| `World3DViewOptions` | 接口 |  |

## `@egret/engine/webgpu/world3d`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `Atmosphere3D` | 类 | Height fog and light shafts for `renderer.postProcess.custom`. |
| `AtmosphereOptions3D` | 接口 |  |
| `AudioListener3D` | 类 | Ears of the scene. |
| `AudioListenerOptions3D` | 接口 |  |
| `captureCubeTexture3D` | 函数 | Render six 90-degree views from `position` and return them as a cube texture with mipmaps. |
| `createAtmosphere3D` | 函数 |  |
| `createAudioListener3D` | 函数 |  |
| `createCustomPost3D` | 函数 |  |
| `createDynamicResolution3D` | 函数 |  |
| `createFlyControls3D` | 函数 |  |
| `createFollowControls3D` | 函数 |  |
| `createOrbitControls3D` | 函数 |  |
| `createPositionalAudio3D` | 函数 |  |
| `createPostProcessSettings3D` | 函数 |  |
| `createScreenMarkers3D` | 函数 | A layer of page elements that follow scene points. |
| `createTransformControls3D` | 函数 |  |
| `createWebGPURenderer3D` | 函数 | Acquire a device (unless one is borrowed) and create the WebGPU renderer. |
| `createWorld3DApp` | 函数 | Starts a World3D game on `canvas`: an Engine, a renderer for the chosen backend and quality, and a frame loop. |
| `createWorld3DHost` | 函数 | Host adapter that reserves `canvas` for one Engine. |
| `createWorld3DOverlay` | 函数 | Lays a transparent 2D stage over `canvas` (the 3D canvas, which must sit in a positioned parent) and starts it. |
| `createWorld3DStats` | 函数 |  |
| `createWorld3DView` | 函数 |  |
| `CUBE_TEXTURE_ASSET_3D` | 值 | A cube texture. |
| `CubeCaptureOptions3D` | 接口 |  |
| `CustomPost3D` | 接口 | A full-screen hook that runs after ambient occlusion and bloom and before tone mapping. |
| `DynamicResolution3D` | 接口 | A drawing resolution that follows the frame rate: down quickly when frames are slow, up slowly when they are not. |
| `DynamicResolutionOptions3D` | 接口 |  |
| `FlyControls3D` | 类 |  |
| `FlyControlsKeys3D` | 接口 |  |
| `FlyControlsOptions3D` | 接口 |  |
| `FollowControls3D` | 类 |  |
| `FollowControlsOptions3D` | 接口 |  |
| `GLTF_ASSET_3D` | 值 | A loaded glTF file. |
| `GltfUrlLoadOptions3D` | 接口 | glTF loading options: download limits plus the optional KTX2, meshopt and Draco decoders. |
| `isSoftwareRendered3D` | 函数 | Whether WebGL here is drawn by software (SwiftShader, llvmpipe and the like), as in a headless browser, a virtual machine or a page whose graphics card is blocked. |
| `loadCubeTexture3D` | 函数 | Load six square images in +X, -X, +Y, -Y, +Z, -Z order as a cube texture. |
| `loadGltfFromUrl3D` | 函数 | Load a .glb or .gltf file; relative buffer and image URIs resolve against `url`. |
| `LoadOptions3D` | 接口 |  |
| `loadTexture3D` | 函数 | Load an image or KTX2 file as a texture. |
| `OrbitControls3D` | 类 |  |
| `OrbitControlsOptions3D` | 接口 |  |
| `pickWorld3DBackend` | 函数 | The backend asked for by the address (`backend=webgpu`), or `fallback`. |
| `pickWorld3DQuality` | 函数 | The picture quality for this device: the address's `quality`, then a stored choice, then `low` for software rendering, a finger or a window shorter than 600 pixels, `medium` for 4 GB of memory or less, and `high` otherwise. |
| `PositionalAudio3D` | 类 | A sound placed in the scene. |
| `PositionalAudioOptions3D` | 接口 |  |
| `POST3D_LIMITS` | 值 |  |
| `PostProcessSettings3D` | 接口 |  |
| `registerWorld3DAssets` | 函数 | Register the World3D asset providers on an AssetManager. |
| `Renderer3D` | 接口 | What both world3d backends provide; views and tools depend on this only. |
| `Renderer3DInfo` | 接口 |  |
| `SCENE_ASSET_3D` | 值 | A scene document written by serializeScene3D. |
| `ScreenMarker3D` | 接口 |  |
| `ScreenMarkerOptions3D` | 接口 |  |
| `ScreenMarkers3D` | 接口 |  |
| `ScreenMarkersOptions3D` | 接口 |  |
| `startWorld3DLoop` | 函数 | Advance the Engine clock once per display frame. |
| `TEXTURE_ASSET_3D` | 值 | A 2D texture loaded from an image or KTX2 file. |
| `TextureLoadOptions3D` | 接口 | Texture loading options; `transcodeKtx2` handles KTX2 payloads the built-in reader cannot use directly. |
| `ToneMapping3D` | 类型 |  |
| `TransformControls3D` | 类 |  |
| `WebGPURenderer3D` | 类 |  |
| `WebGPURenderer3DOptions` | 接口 |  |
| `WORLD3D_QUALITY_PRESETS` | 值 | The three qualities. |
| `World3DApp` | 接口 |  |
| `World3DAppOptions` | 接口 |  |
| `World3DAssetOptions` | 接口 |  |
| `World3DBackend` | 类型 |  |
| `World3DClockSource` | 接口 | The part of an Engine this view needs: its explicit game clock. |
| `World3DDeviceHints` | 接口 | What `pickWorld3DQuality` reads about the device. |
| `World3DLoopSource` | 接口 |  |
| `World3DOverlay` | 接口 |  |
| `World3DOverlayOptions` | 接口 |  |
| `World3DQuality` | 类型 |  |
| `World3DQualityPreset` | 接口 | What one picture quality turns on. |
| `World3DShowOptions` | 接口 |  |
| `World3DStats` | 接口 |  |
| `World3DStatsOptions` | 接口 |  |
| `World3DView` | 类 |  |
| `World3DViewOptions` | 接口 |  |

## `@egret/engine/resources`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `ContentBinding` | 接口 |  |
| `ContentGroup` | 接口 | All returned values are borrowed until this group or its owning Scope retires. |
| `ContentLoader` | 接口 | One manifest/source identity; multiple groups share the existing asset manager. |
| `ContentProviderFactory` | 类型 |  |
| `ContentProviders` | 接口 | Host providers own byte integrity/UTF-8 decoding; the core validates artifact semantics. |
| `createContentLoader` | 函数 | One manifest/source catalog, independent of global IDs and of other loaders. |
| `createFontContentLoader` | 函数 | One typed font catalog over the existing manager and genuine dependency groups. |
| `createManifestAssetBinding` | 函数 |  |
| `FontContentAsset` | 接口 |  |
| `FontContentBinding` | 接口 |  |
| `FontContentGroup` | 接口 |  |
| `FontContentLoader` | 接口 |  |
| `FontContentProviderFactory` | 类型 |  |
| `ManifestAssetBinding` | 接口 | A genuine invariant ref paired with one exact admitted manifest entry. |
| `ManifestAssetGroup` | 接口 | Scope-owned dependency group. |
| `ManifestBinding` | 接口 | Immutable resource metadata; only the optional binding factory creates it. |
| `ManifestGroupOptions` | 接口 |  |

## `@egret/engine/web/resources`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createManifestByteSource` | 函数 |  |
| `createManifestContentLoader` | 函数 | Integrity-checked PNG/UTF-8 transport plus the DOM-free content assembly. |
| `createManifestFontContentLoader` | 函数 | Fonts share the authenticated byte transport and the Engine's existing resource manager. |
| `createManifestTextureProvider` | 函数 | Source authentication precedes every caller-controlled options read. |
| `ManifestByteSource` | 接口 |  |
| `ManifestByteSourceOptions` | 接口 |  |
| `ManifestByteSourceStatus` | 接口 |  |
| `ManifestContentLoader` | 接口 |  |
| `ManifestFontContentLoader` | 接口 |  |
| `ManifestTextureProvider` | 接口 |  |
| `ManifestTextureProviderOptions` | 接口 |  |
| `ManifestTextureProviderStatus` | 接口 |  |

## `@egret/engine/input`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createKeyboardInput` | 函数 |  |
| `createPointerInput` | 函数 |  |
| `PointerCancelReason` | 类型 |  |
| `PointerContact` | 接口 | A retained value: sequence orders all contacts on this router. |
| `PointerEventKind` | 类型 |  |
| `PointerInput` | 接口 | Scope-owned input for an explicitly supplied logical host stream. |
| `PointerInputEvents` | 接口 |  |
| `PointerInputOptions` | 接口 |  |
| `PointerNotification` | 接口 |  |
| `PointerRouterState` | 类型 |  |
| `PointerSample` | 接口 |  |
| `PointerSession` | 接口 | Only the creating router admits this frozen identity; host IDs may be reused. |
| `PointerType` | 类型 |  |
| `PointerUpdate` | 接口 |  |

## `@egret/engine/web/pointer`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createBrowserPointerInput` | 函数 | Pointer Events adapter for the explicit connected, untransformed Canvas profile. |
| `PointerInput` | 接口 | Scope-owned input for an explicitly supplied logical host stream. |
| `PointerInputOptions` | 接口 |  |

## `@egret/engine/ui`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `ActionControl` | 接口 |  |
| `ActionControlOptions` | 接口 |  |
| `ActionKeysOptions` | 接口 | Space or Enter, released, activates. |
| `ControlKeys` | 接口 |  |
| `ControlKeysOptions` | 类型 |  |
| `ControlKeysSource` | 接口 | The keyboard input, or anything that delivers its three key events. |
| `createActionControl` | 函数 |  |
| `createControlKeys` | 函数 |  |
| `createHoverControl` | 函数 |  |
| `createMovementControl` | 函数 |  |
| `createRangeControl` | 函数 |  |
| `createScrollControl` | 函数 |  |
| `createSelectionGroup` | 函数 |  |
| `createTextFieldControl` | 函数 |  |
| `createToggleControl` | 函数 |  |
| `createUiLayerManager` | 函数 | Optional Root composition. |
| `createUiRoot` | 函数 | One owned transaction domain over the genuine display and input authorities. |
| `createUiTheme` | 函数 |  |
| `HoverControl` | 接口 |  |
| `HoverControlOptions` | 接口 | Hover, toggle and single-selection state for controls an application draws itself. |
| `LayoutNode` | 类型 |  |
| `MovementControl` | 接口 |  |
| `MovementControlOptions` | 接口 |  |
| `MovementKeysOptions` | 接口 | The keys that are down give the direction; opposite keys cancel each other. |
| `MovementValue` | 接口 | Reusable movement and action controls over the existing contact stream. |
| `RangeAxis` | 类型 | One value out of a range, for a slider an application draws itself: a volume, a share, an amount. |
| `RangeControl` | 接口 |  |
| `RangeControlOptions` | 接口 |  |
| `RangeKeysOptions` | 接口 | Arrow keys move the value by one step, Page Up and Page Down by a page of steps, Home and End go to its ends. |
| `RowBindContext` | 接口 |  |
| `RowBinding` | 接口 |  |
| `RowRetention` | 接口 |  |
| `RowUnbindInfo` | 接口 |  |
| `ScrollAxis` | 类型 | The scroll position of one axis of a clipped viewport an application draws itself. |
| `ScrollControl` | 接口 |  |
| `ScrollControlOptions` | 接口 |  |
| `ScrollKeysOptions` | 接口 | The arrow keys of its axis, Page Up, Page Down, Home and End. |
| `ScrollThumb` | 接口 |  |
| `ScrollThumbOptions` | 接口 |  |
| `ScrollWheelOptions` | 接口 |  |
| `SelectionGroup` | 接口 | One of several: a radio group, a segmented control, or a listbox with a single selection. |
| `SelectionGroupOptions` | 接口 |  |
| `SelectionItem` | 接口 |  |
| `SelectionKeysOptions` | 接口 | Arrow keys move the selection, Home and End go to its ends. |
| `selectUiSkin` | 函数 | The name a skin gives to the state of a control: of the states that hold, the first in `order` that the skin has a name for, and `default` when it has none. |
| `TextFieldChange` | 接口 |  |
| `TextFieldControl` | 接口 |  |
| `TextFieldControlOptions` | 接口 |  |
| `TextFieldEditor` | 接口 | Shows one field at a time. |
| `TextFieldKeysOptions` | 接口 | The field opens when the key is released, so that the key types nothing into it. |
| `TextFieldRectangle` | 接口 | The state of a text field an application draws itself: its text, and whether it is being edited. |
| `TextFieldSession` | 接口 | What the control adds to the presentation of a field when it opens one. |
| `ToggleControl` | 接口 |  |
| `ToggleControlOptions` | 接口 |  |
| `ToggleKeysOptions` | 接口 |  |
| `UiCommitResult` | 接口 |  |
| `UiCounters` | 接口 |  |
| `UiInvalidationKind` | 类型 |  |
| `UiKeyboardOptions` | 接口 | Explicit namespace prevents independently authored panels from sharing focus IDs. |
| `UiLayerAnchor` | 接口 |  |
| `UiLayerCommitResult` | 接口 |  |
| `UiLayerManager` | 接口 | Stage intents, publish participating roots, then sync before editor placement/capture. |
| `UiLayerManagerOptions` | 接口 |  |
| `UiLayerOptions` | 接口 |  |
| `UiLayerRegistration` | 接口 |  |
| `UiLayerSnapshot` | 接口 |  |
| `UiLayerTarget` | 类型 |  |
| `UiLeafContent` | 接口 |  |
| `UiLeafPrepareContext` | 接口 | Detached content is prepared at the leaf's available inner width. |
| `UiLimits` | 接口 |  |
| `UiPreparation` | 接口 |  |
| `UiRoot` | 接口 |  |
| `UiRootOptions` | 接口 |  |
| `UiRowPointerNotification` | 类型 |  |
| `UiRowSnapshot` | 接口 |  |
| `UiSkinState` | 类型 |  |
| `UiSkinStateName` | 类型 | The states of a control that a skin may have a name for. |
| `UiSnapshot` | 接口 |  |
| `UiTheme` | 接口 | Every factory result is a distinct immutable generation, including equal descriptors. |
| `UiThemeDescriptor` | 接口 |  |
| `UiThemeNode` | 接口 |  |
| `UiThemeSkin` | 接口 | Skin names resolve through application-owned, typed asset references, never URLs. |
| `UiThemeTypography` | 接口 |  |
| `VirtualDataSource` | 接口 |  |
| `VirtualListHandle` | 接口 |  |
| `VirtualListRevealOptions` | 接口 | Alignment within the list's authored viewport; tall rows can remain clipped. |
| `VirtualListSnapshot` | 接口 |  |
| `VirtualRecord` | 接口 |  |

## `@egret/engine/animation`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createSequenceController` | 函数 | Opt-in sequence controls share Engine ownership but never create a second timer. |
| `createSequenceResetSlot` | 函数 | One ordinary sole-child container; all candidates use existing content and clock ownership. |
| `SequenceController` | 接口 | Receiver-checked owned handle; time is driven only by its genuine Engine. |
| `SequenceControllerEvent` | 类型 |  |
| `SequenceControllerOptions` | 接口 |  |
| `SequenceControllerState` | 类型 |  |
| `SequenceControllerStatus` | 接口 |  |
| `SequenceEventSource` | 类型 |  |
| `SequenceMarker` | 接口 | Immutable authored marker; its input index breaks equal-time ties. |
| `SequenceResetActive` | 接口 |  |
| `SequenceResetInitial` | 接口 |  |
| `SequenceResetRequest` | 接口 |  |
| `SequenceResetSlot` | 接口 |  |
| `SequenceResetState` | 类型 |  |
| `SequenceResetTicket` | 接口 |  |
| `SequenceSeekRequest` | 接口 |  |

## `@egret/engine/paragraph`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createParagraph` | 函数 | Optional paragraph assembly authenticates Engine, Scope and exact cache profile. |
| `createParagraphCache` | 函数 | A fixed optional profile shares Engine/AssetManager leases and their shutdown authority. |

## `@egret/engine/web/paragraph`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `CanvasKitFontSetProvider` | 接口 |  |
| `CanvasKitFontSetProviderOptions` | 接口 |  |
| `CanvasKitParagraphFont` | 接口 |  |
| `CanvasKitParagraphModule` | 接口 | Minimal host-injected CanvasKit port. |
| `CanvasKitParagraphProvider` | 接口 |  |
| `CanvasKitParagraphProviderOptions` | 接口 |  |
| `createCanvasKitFontSetProvider` | 函数 | A stable cache provider routes immutable generations; it never mutates a live native font table. |
| `createCanvasKitParagraphProvider` | 函数 |  |
| `ParagraphFontSet` | 接口 |  |

## `@egret/engine/web/keyboard`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createBrowserKeyboardInput` | 函数 | Canvas-local native keyboard bridge. |
| `KeyboardCancelPayload` | 接口 |  |
| `KeyboardCancelReason` | 类型 |  |
| `KeyboardFocusChange` | 接口 |  |
| `KeyboardFocusOptions` | 接口 |  |
| `KeyboardFocusPayload` | 接口 |  |
| `KeyboardInput` | 接口 | Synchronous logical focus; text editing and IME are outside this channel. |
| `KeyboardInputEvents` | 接口 |  |
| `KeyboardInputOptions` | 接口 |  |
| `KeyboardInputSnapshot` | 接口 |  |
| `KeyboardKeyPayload` | 接口 |  |
| `KeyboardSample` | 接口 |  |
| `KeyboardTargetOptions` | 接口 |  |
| `KeyboardTargetRegistration` | 接口 |  |

## `@egret/engine/web/text-input`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserTextInput` | 接口 |  |
| `BrowserTextInputChange` | 接口 |  |
| `BrowserTextInputEnterHint` | 类型 |  |
| `BrowserTextInputMode` | 类型 |  |
| `BrowserTextInputOptions` | 接口 |  |
| `BrowserTextInputRectangle` | 接口 | Rectangle in logical stage units, the units of the display tree and of pointer input. |
| `BrowserTextInputRequest` | 接口 | One editing session. |
| `BrowserTextInputSnapshot` | 接口 |  |
| `createBrowserTextInput` | 函数 | Platform text entry over a canvas: a native field placed on a rectangle of the stage, so that input methods (Chinese, Japanese, Korean), on-screen keyboards, paste and accessibility work as the platform provides them. |

## `@egret/engine/ui/editing`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createUiTextEditor` | 函数 |  |
| `TextEditSelection` | 接口 | Source offsets are UTF-16, never glyph indices or guessed advance widths. |
| `UiTextEditor` | 接口 |  |
| `UiTextEditorChange` | 接口 |  |
| `UiTextEditorOptions` | 接口 |  |
| `UiTextEditorSetOptions` | 接口 |  |
| `UiTextEditorSnapshot` | 接口 |  |
| `UiTextEditorStyle` | 接口 |  |
| `UiTextEditorTarget` | 类型 |  |

## `@egret/engine/web/editing`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserEditorFontProvider` | 接口 |  |
| `BrowserEditorFontProviderOptions` | 接口 |  |
| `BrowserEditorFontSet` | 接口 |  |
| `BrowserTextEditor` | 接口 |  |
| `BrowserTextEditorOptions` | 接口 |  |
| `BrowserTextEditorSnapshot` | 接口 |  |
| `createBrowserEditorFontProvider` | 函数 | CSS registration is a consumer of existing immutable font resources, not another asset cache. |
| `createBrowserTextEditor` | 函数 | One visible native editor over an authenticated committed UI binding. |
| `EditorParagraphFontLoader` | 接口 |  |

## `@egret/engine/input/hover`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createHoverInput` | 函数 | Hover and wheel routing over the display tree of a started Engine. |
| `HoverInput` | 接口 | Scope-owned hover and wheel routing for an explicitly supplied logical host stream. |
| `HoverInputEvents` | 接口 |  |
| `HoverInputOptions` | 接口 |  |
| `HoverInputState` | 类型 |  |
| `HoverLeaveReason` | 类型 | Why a target stopped being hovered: the pointer went to another target or to none, left the surface, pressed, or was cancelled by the platform; the target stopped being a possible target; the mapping of the surface changed; the window or the page went away; or the input was suspended, disposed or failed. |
| `HoverNotification` | 接口 |  |
| `HoverPoint` | 接口 | A retained value: sequence orders every hover and wheel observation of this input. |
| `HoverPointerType` | 类型 | Pointers that can be over the scene without pressing it. |
| `HoverSample` | 接口 |  |
| `HoverState` | 接口 |  |
| `HoverTransition` | 接口 | A point of an enter or a leave, with the other end of the movement when there is one. |
| `WheelNotification` | 接口 |  |
| `WheelPoint` | 接口 |  |
| `WheelSample` | 接口 |  |
| `WheelUnit` | 类型 |  |

## `@egret/engine/web/hover`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserHoverInputOptions` | 接口 |  |
| `createBrowserHoverInput` | 函数 | Hover and wheel of the page for the canvas of a started Engine, in the same connected, untransformed profile as the pointer adapter. |
| `WheelPagePolicy` | 类型 | Whether a wheel over the canvas also scrolls the page: only when nothing consumed it, never (the canvas owns the wheel), or always (the listener is passive and cannot hold the page). |

## `@egret/engine/input/gamepad`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `bindGamepadKeys` | 函数 | Drives a keyboard input from the pads: the keys a UI already answers, held and repeated as a pad holds them. |
| `createGamepadInput` | 函数 | Pads as a stream of samples a host gives it: what is held, how far a stick is pushed, and what changed since the last look. |
| `GamepadButtonChange` | 接口 |  |
| `GamepadButtonName` | 类型 | The buttons of a pad in the standard layout, by where they are: `a` is the lower face button. |
| `GamepadButtonSample` | 接口 |  |
| `GamepadConnectionChange` | 接口 |  |
| `GamepadInput` | 接口 | Pads as a stream of samples. |
| `GamepadInputOptions` | 接口 |  |
| `GamepadKeyAction` | 类型 | What a button does: a key, with the way the focus moves when nobody took the key; or a move of the focus alone. |
| `GamepadKeys` | 接口 |  |
| `GamepadKeysOptions` | 接口 |  |
| `GamepadKeyTarget` | 接口 | The part of a keyboard input that a pad drives. |
| `GamepadPad` | 接口 | A pad that is connected, as of the last sample. |
| `GamepadSample` | 接口 | What a host says of one pad at one moment. |
| `GamepadStick` | 接口 |  |
| `GamepadStickName` | 类型 |  |

## `@egret/engine/web/gamepad`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserGamepadInput` | 接口 |  |
| `BrowserGamepadInputOptions` | 接口 |  |
| `createBrowserGamepadInput` | 函数 | The pads of a page. |
| `GamepadRumble` | 接口 |  |

## `@egret/engine/camera`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `Camera2D` | 接口 | A view of a 2D world: where it looks, how close, what it follows, and how it shakes. |
| `Camera2DOptions` | 接口 |  |
| `CameraFollowOptions` | 接口 |  |
| `CameraLayerOptions` | 接口 |  |
| `CameraPoint` | 接口 |  |
| `CameraRect` | 接口 |  |
| `CameraShakeOptions` | 接口 |  |
| `CameraSnapshot` | 接口 |  |
| `CameraTarget` | 类型 | What the camera follows: a display object inside the world, or a function that says where to look. |
| `createCamera2D` | 函数 | A camera over a container that holds the world. |

## `@egret/engine/tilemap`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createTileMap` | 函数 | A map drawn from its tilesets. |
| `importTiledMap` | 函数 | Reads a map saved by Tiled as JSON (`.tmj`, or `.json`), orthogonal, with tile layers as arrays or as base64 without compression, finite or infinite, object layers and groups. |
| `ObjectLayerData` | 接口 |  |
| `TILE_FLIP_MASK` | 值 | The top three bits of a global id say how the tile is turned; the rest is the id. |
| `TileAnimationFrame` | 接口 |  |
| `TiledImportOptions` | 接口 |  |
| `TileInfo` | 接口 |  |
| `TileLayerData` | 接口 |  |
| `TileMap` | 接口 | A map drawn: one container for each tile layer, cut into chunks of meshes that can be left out when they cannot be seen. |
| `TileMapChunk` | 接口 |  |
| `TileMapData` | 接口 | A map as plain, frozen data: what a tile map is made from. |
| `TileMapLayer` | 接口 |  |
| `TileMapLayerData` | 类型 |  |
| `TileMapObject` | 接口 |  |
| `TileMapOptions` | 接口 |  |
| `TileMapProperties` | 类型 |  |
| `TileMapPropertyValue` | 类型 |  |
| `TileSetData` | 接口 |  |

## `@egret/engine/particles`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createParticleEmitter` | 函数 | A stream of particles over one texture, drawn as one mesh that is built again each update. |
| `ParticleEmitter` | 接口 | Particles drawn as one mesh. |
| `ParticleEmitterOptions` | 接口 |  |
| `ParticleRange` | 类型 | A value picked once for each particle, evenly between the two ends; a number is both ends. |
| `ParticleShape` | 类型 | Where particles are born, around the place of the emitter. |
| `ParticleSnapshot` | 接口 |  |
| `ParticleView` | 接口 |  |

## `@egret/engine/physics2d`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createPhysicsWorld` | 函数 | A world of bodies that move, meet and push each other apart, in fixed steps, without turning. |
| `PhysicsBody` | 接口 |  |
| `PhysicsBodyKind` | 类型 | A static body never moves; a kinematic one moves by its speed alone and pushes; a dynamic one is moved by everything. |
| `PhysicsBodyOptions` | 接口 |  |
| `PhysicsContact` | 接口 |  |
| `PhysicsMoveResult` | 接口 |  |
| `PhysicsRayHit` | 接口 |  |
| `PhysicsShape` | 类型 | A shape about the place of its body. |
| `PhysicsSnapshot` | 接口 |  |
| `PhysicsTileColliders` | 接口 |  |
| `PhysicsVector` | 接口 |  |
| `PhysicsWorld` | 接口 | A world of 2D bodies that collide, without turning: simple, steady physics for a 2D game. |
| `PhysicsWorldOptions` | 接口 |  |

## `@egret/engine/bitmapfont`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BitmapFont` | 接口 | A bitmap font read from a file: frozen, with its characters and the kerning between pairs of them. |
| `BitmapGlyph` | 接口 | One character of a bitmap font: where it is on its page, where it is drawn from the pen, and how far the pen goes on. |
| `BitmapText` | 接口 | Text drawn in a bitmap font, as one mesh for each page it uses. |
| `BitmapTextGlyph` | 接口 | One character placed: its rectangle in the text and its rectangle on its page. |
| `BitmapTextLayout` | 接口 | Text laid out in a font, from its top left. |
| `BitmapTextLayoutOptions` | 接口 |  |
| `BitmapTextLine` | 接口 |  |
| `BitmapTextOptions` | 接口 |  |
| `createBitmapText` | 函数 | Draws text in a bitmap font as one mesh for each page it uses, laid out again whenever what it shows changes. |
| `layoutBitmapText` | 函数 | Lays text out in a bitmap font without drawing it: its lines, where each character goes, and its size. |
| `parseBitmapFont` | 函数 | Reads a bitmap font: the text, XML or JSON forms of BMFont (from AngelCode's generator, Hiero, Glyph Designer, Littera and the like), or Egret's own JSON of frames. |

## `@egret/engine/video`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createVideo` | 函数 | A video as a display object: each new picture its source gives becomes, through the Engine's assets, the texture of one Bitmap. |
| `Video` | 接口 | A video shown as a display object: each new picture of its source becomes the texture of one Bitmap. |
| `VideoFrame` | 接口 | One picture of a video, the time of the video it shows. |
| `VideoOptions` | 接口 |  |
| `VideoSnapshot` | 接口 |  |
| `VideoSource` | 接口 | What a video player reads its pictures from and is driven through. |
| `VideoSourceState` | 类型 | Where a source is: still opening, able to show a frame, playing, paused, at its end, or unable to play. |
| `VideoState` | 类型 |  |

## `@egret/engine/web/video`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserVideo` | 接口 |  |
| `BrowserVideoOptions` | 接口 |  |
| `createBrowserVideo` | 函数 | A video played by a page's video element and shown as a display object. |

## `@egret/engine/web/loop`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserFrameLoop` | 接口 |  |
| `BrowserFrameLoopOptions` | 接口 |  |
| `BrowserFrameLoopSnapshot` | 接口 |  |
| `BrowserFrameLoopState` | 类型 |  |
| `createBrowserFrameLoop` | 函数 | The frame loop of a game in a page. |
| `FrameLoopEngine` | 接口 | What the loop asks of an Engine: its clock's limit, time and frames. |
| `FrameLoopHost` | 接口 | What the loop asks of a Host: how many frames it holds that it has not finished. |

## `@egret/engine/kit`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `ASSET_BUNDLE_HEADER_BYTES` | 值 | How many bytes from the start must be read to know the index's length: the header. |
| `assetBundleCheck` | 函数 | FNV-1a over the bytes, as eight hex digits. |
| `AssetBundleEntry` | 接口 |  |
| `AssetBundleIndex` | 接口 |  |
| `AssetBundleInput` | 接口 | One file to put in a bundle. |
| `AudioCueDefinition` | 接口 |  |
| `AudioCuePlayOptions` | 接口 |  |
| `AudioCues` | 接口 |  |
| `AudioCuesOptions` | 接口 |  |
| `createAudioCues` | 函数 | Names the sound effects of a game over `mixer`. |
| `createInputActions` | 函数 | Makes the actions of `map`. |
| `createMemorySaveStorage` | 函数 | Storage kept in memory: for tests, for a page without browser storage, or for a game played once. |
| `createRandom` | 函数 | A generator from a seed (a number or string) or a saved state. |
| `createSaveStore` | 函数 | Opens the save under `options.key`, migrating an older one. |
| `describeInputBinding` | 函数 | A readable name for a binding, for settings screens: `Key:KeyW` is `W`, `Mouse:0` is `Left button`. |
| `encodeWav` | 函数 | 16-bit PCM WAV bytes from channels of samples between -1 and 1, all the same length. |
| `hashSeed` | 函数 | Turns a string or number into a 32-bit seed. |
| `HeadlessGame` | 接口 | What a headless run needs of a game: its state and one step of its rules. |
| `HeadlessRunOptions` | 接口 |  |
| `HeadlessRunResult` | 接口 |  |
| `InputActionDefinition` | 接口 | An action and the controls that drive it. |
| `InputActionKind` | 类型 |  |
| `InputActionMap` | 类型 |  |
| `InputActions` | 接口 |  |
| `InputBinding` | 类型 | One physical control, written as a short string: `Key:KeyW` (a `KeyboardEvent.code`), `Mouse:0` (a button number), `Pad:a` or `Pad:7` (a standard gamepad button name or number), `Pad:leftStick` / `Pad:rightStick` (a stick, for vector actions), `Pad:leftStickX+` (one half of a stick axis, for buttons and axes), and `Touch:<name>` for an on-screen control. |
| `InputBindingSlot` | 类型 | A slot of an action that a binding can be put in: `bindings`, `negative`, `positive`, `up`, ... |
| `InputBindingsSave` | 接口 |  |
| `InputVector` | 接口 |  |
| `pickQualityFiles` | 函数 | Names of the form `<base>-<tier>.<ext>` grouped by base and chosen for `quality`, as a bundle or a folder lists them: `hero-high.glb`, `hero-low.glb` and `hall.webp` give `hero-low.glb` (for `medium`) and `hall.webp`. |
| `pickQualityVariant` | 函数 | Of several variants of one asset, the one for `quality`: an exact tier, or else the nearest below, or else the nearest above. |
| `planAssetBundleRanges` | 函数 | Ranges of the file that hold the named entries, joined where they touch or lie within `gap` bytes. |
| `QUALITY_TIERS` | 值 | Quality tiers from lowest to highest, as World3D names them. |
| `QualityTier` | 类型 |  |
| `Random` | 接口 |  |
| `RandomState` | 类型 | Four 32-bit words. |
| `readAssetBundleHeader` | 函数 | The index length a header gives, so a reader can ask for exactly the bytes of the index. |
| `readAssetBundleIndex` | 函数 | The index of a bundle from its first bytes: at least the header and the index. |
| `runHeadless` | 函数 | Plays the game once per seed with the stand-in player and reports each run. |
| `SaveProblem` | 接口 |  |
| `SaveProblemKind` | 类型 |  |
| `SaveStorage` | 接口 | Where a save is kept: strings by key. |
| `SaveStore` | 接口 |  |
| `SaveStoreOptions` | 接口 |  |
| `sliceAssetBundle` | 函数 | The bytes of one entry from bytes of the bundle that start at `start` (0 for the whole file), checked against the index. |
| `writeAssetBundle` | 函数 | One file holding every input, in the order given, each starting at a multiple of four bytes. |

## `@egret/engine/web/kit`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `bindBrowserInputActions` | 函数 | Listens to the page for the controls of `actions`. |
| `BrowserAssetBundle` | 接口 |  |
| `BrowserAssetBundleOptions` | 接口 |  |
| `BrowserDecodedImage` | 接口 |  |
| `BrowserImageCanvas` | 接口 |  |
| `BrowserImageContext` | 接口 |  |
| `BrowserImageFormat` | 类型 | The picture formats the browser route recognises by their first bytes. |
| `BrowserImageOptions` | 接口 |  |
| `BrowserImagePorts` | 接口 |  |
| `BrowserImageSource` | 类型 | What `textureFromCanvas` and `decodeBrowserImage` can read pixels from. |
| `BrowserImageTextureProviderOptions` | 接口 |  |
| `BrowserInputActions` | 接口 |  |
| `BrowserInputActionsOptions` | 接口 |  |
| `browserSaveStorage` | 函数 | The page's local storage as a save storage, or a memory stand-in where the page has none (a private window, a blocked site): every call is guarded, so a save never throws for want of storage. |
| `BundleCache` | 接口 | Where fetched bundle entries are kept between visits; used as `cache` of `openBrowserAssetBundle`. |
| `createBrowserImageTextureProvider` | 函数 | An asset provider that reads bytes with `readBytes` and decodes them with the browser. |
| `createTouchButton` | 函数 | Makes `element` an on-screen button that holds `binding` (such as `Touch:jump`) while a finger is on it. |
| `createTouchStick` | 函数 | A stick that appears where a finger lands in its zone of `element` and follows it. |
| `decodeBrowserImage` | 函数 | Decodes PNG, JPEG, WebP, GIF or AVIF bytes with the browser and returns a texture of them. |
| `fitBrowserImageSize` | 函数 | The size a picture is read at: its own, or scaled down evenly to fit both limits. |
| `IndexedDBSaveStorage` | 接口 |  |
| `IndexedDBSaveStorageOptions` | 接口 |  |
| `openBrowserAssetBundle` | 函数 | Opens the bundle at `url`, reading its index. |
| `openBrowserBundleCache` | 函数 | A bundle cache in the Cache API under `name`. |
| `openIndexedDBSaveStorage` | 函数 | A save storage over IndexedDB. |
| `sniffBrowserImageFormat` | 函数 | The picture format the bytes start with, or undefined when they start like none of them. |
| `textureFromCanvas` | 函数 | Reads a canvas, image or bitmap as a texture of straight RGBA bytes, scaled down when it is larger than the limits. |
| `TouchControl` | 接口 |  |
| `TouchStickOptions` | 接口 |  |

## `@egret/engine/web/game`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserGame` | 接口 |  |
| `BrowserGameBackend` | 类型 |  |
| `BrowserGameFit` | 类型 | How the canvas fills the element it is in: not at all, whole inside it, covering it, or stretched to it. |
| `BrowserGameLabel` | 接口 | A line of text on the stage whose words can be set like a value. |
| `BrowserGameLabelOptions` | 接口 |  |
| `BrowserGameOptions` | 接口 |  |
| `BrowserStatsPanel` | 接口 |  |
| `BrowserStatsPanelOptions` | 接口 |  |
| `BrowserStatsSample` | 接口 | What a game knows at one frame of the display. |
| `BrowserStatsSnapshot` | 接口 | The numbers the panel shows, as of its last refresh. |
| `createBrowserGame` | 函数 | Makes a game ready to draw: `await createBrowserGame({ canvas, width, height, update })`, then add display objects to `game.stage`. |
| `createBrowserStatsPanel` | 函数 |  |

## `@egret/engine/audio`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `AudioBackend` | 接口 | What a host gives the mixer. |
| `AudioBackendBus` | 接口 | One gain on the way to the output. |
| `AudioBackendSound` | 接口 | Decoded samples held by the host, or a file it plays as it reads it. |
| `AudioBackendStart` | 接口 |  |
| `AudioBackendVoice` | 接口 | One sound being played once. |
| `AudioBus` | 接口 |  |
| `AudioBusOptions` | 接口 |  |
| `AudioBusSnapshot` | 接口 |  |
| `AudioEndReason` | 类型 | Why a voice is over: it reached its end; it was stopped; it gave its place to a newer voice; no place could be made for it; it was asked for while nothing could be heard; its sound was released; or the mixer was disposed. |
| `AudioFade` | 接口 |  |
| `AudioMixer` | 接口 |  |
| `AudioMixerOptions` | 接口 |  |
| `AudioMixerSnapshot` | 接口 |  |
| `AudioMixerState` | 类型 | Whether sound comes out. |
| `AudioMusicOptions` | 接口 |  |
| `AudioPlayOptions` | 接口 |  |
| `AudioSound` | 接口 |  |
| `AudioVoice` | 接口 |  |
| `AudioVoiceState` | 类型 |  |
| `createAudioMixer` | 函数 | Volumes, voices and one music over a backend that makes the sound. |

## `@egret/engine/web/audio`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserAudio` | 接口 |  |
| `BrowserAudioOptions` | 接口 |  |
| `createBrowserAudio` | 函数 | Sound for a page on Web Audio. |

## `@egret/engine/ui/semantics`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createUiListSemantics` | 函数 |  |
| `createUiSemantics` | 函数 | A semantic tree for the controls an application draws. |
| `SemanticAction` | 类型 | What assistive technology may ask of a node: its activation, or the keyboard focus. |
| `SemanticBounds` | 接口 | A rectangle in the logical coordinates of the stage, the ones picking uses. |
| `semanticBoundsOf` | 函数 | The rectangle on the stage that encloses a display object and what it holds, for the bounds of a node. |
| `semanticBoxOf` | 函数 | The rectangle on the stage of a box a managed UI root laid out: a leaf, a row, a column or a list, by its id in the tree of the root. |
| `SemanticChecked` | 类型 |  |
| `SemanticDescription` | 接口 | What a node is at this moment, read from the control that draws it. |
| `SemanticExtent` | 接口 | How many rows and columns a grid has in all, whether or not all of them are published. |
| `SemanticListRow` | 接口 |  |
| `SemanticListSource` | 接口 | What is read of a managed UI root. |
| `SemanticNode` | 接口 |  |
| `SemanticNodeOptions` | 接口 |  |
| `SemanticOrientation` | 类型 |  |
| `SemanticPosition` | 接口 | Where an item stands in its whole set, from one. |
| `SemanticRange` | 接口 |  |
| `SemanticRole` | 类型 | What a control is to someone who cannot see the canvas. |
| `SemanticSnapshot` | 接口 |  |
| `SemanticSnapshotNode` | 接口 | One published node. |
| `SemanticSort` | 类型 | How the rows of a grid are ordered by one of its columns. |
| `SemanticsState` | 类型 |  |
| `UiListSemantics` | 接口 |  |
| `UiListSemanticsOptions` | 接口 |  |
| `UiSemantics` | 接口 | The semantic tree of a UI the application draws: what each control is, what it is called and what state it is in. |
| `UiSemanticsOptions` | 接口 |  |

## `@egret/engine/web/semantics`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserSemantics` | 接口 |  |
| `BrowserSemanticsOptions` | 接口 |  |
| `createBrowserSemantics` | 函数 | Projects a semantic tree to the page, for assistive technology. |
