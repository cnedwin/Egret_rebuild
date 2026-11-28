# API reference

English | [简体中文](../../Cns/docs/api-reference.md)

This page lists every name that each entry of `@egret/engine` exports: what kind of thing it is, and the first sentence written above it in the sources. It is written by `node tools/api-reference.mjs` from the built declarations, and `tests/api-reference.test.mjs` fails when it is not what they give; do not edit it by hand. 48 entries, 1546 exports; 22 of them have no sentence in the sources yet.

For which entry to import from, see [What to import](entry-points.md).

## `@egret/engine`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `after` | function | Calls a function once, `seconds` from now on the Engine's clock, as Egret's setTimeout. |
| `animate` | function | A motion of one object: `animate(engine, scope, sprite).to({ x: 100, alpha: 0.5 }, 0.5, 'quadOut').wait(0.2).to({ x: 0 }, 0.5).start()`. |
| `AssetAcquireOptions` | interface | Options of one acquisition: a signal that cancels it. |
| `AssetGroup` | interface | One opaque cleanup owner; members remain borrowed genuine invariant leases. |
| `AssetGroupOptions` | interface | How many of a group's assets load at once. |
| `AssetGroupState` | type | Whether an asset group is loading, ready, failed or disposed. |
| `AssetLease` | class | One independently revocable CPU-value borrow, bound to its originating Engine. |
| `AssetLoadContext` | interface | What a provider is given with each load: the signal that tells it the load is no longer wanted. |
| `AssetManager` | class | CPU acquisition only: demand retains values; completed unused values are evicted. |
| `AssetProvider` | interface | Loads the value an asset reference names, and disposes of it when it is no longer held. |
| `AssetRef` | interface | A stable manager-local identity paired with its invariant value descriptor. |
| `AssetType` | interface | Factory identity prevents equal names from aliasing; the phantom is invariant. |
| `AtlasFrameLayout` | interface | Logical canvas and unpacked placement of a clockwise-packed atlas rectangle. |
| `Bitmap` | class | A leaf borrowing one exact lease; engine affinity outlives clearing its slot. |
| `BitmapBindingTicket` | interface | Publishes borrowed group members once; owns no initial or candidate lease. |
| `BitmapResourceSlot` | interface | Owns only replacement leases; the exact initial Bitmap binding remains borrowed. |
| `BitmapResourceSlotState` | type | Whether a bitmap resource slot is idle, loading a replacement, ready, failed, conflicted or disposed. |
| `BoundsQueryOptions` | interface | Receiver-inclusive node and content budgets for logical local measurement. |
| `BYTE_READER_LIMITS` | value | The largest snapshot a ByteReader reads, in bytes. |
| `BYTE_WRITER_LIMITS` | value | The largest capacity a ByteWriter has, in bytes. |
| `ByteOrder` | type | The order of the bytes of a multi-byte number. |
| `ByteReader` | class | Read-only owned binary snapshot. |
| `ByteWriter` | class | Fixed-capacity owned binary appends. |
| `CancellationController` | class | Owns the mutable signal; consumers receive the read-only cancellation port. |
| `CancellationListener` | type | A DOM-free cancellation listener; it receives no host Event object. |
| `CancellationSignal` | interface | One-way cancellation state. |
| `ClipRectangle2D` | interface | A clip rectangle together with the matrix that places it on the frame. |
| `CoordinateQueryOptions` | interface | Receiver-inclusive ancestor budget; omitted maxNodes defaults to 4096. |
| `copyImageData2DPixels` | function | A fresh copy of an image's pixels, which the caller owns. |
| `createAssetRef` | function | Keep the caller's valid ID byte-for-byte; whitespace is not normalization. |
| `createAssetType` | function | Makes an asset type from a name and a check that a loaded value is of that type. |
| `createEngine` | function | An Engine without a render port: it captures frames and does not render them. |
| `createEngineForProfile` | function | Exact negotiation completes all successful port reads before semantics. |
| `createEventType` | function | Matching uses descriptor object identity; equal key strings do not alias types. |
| `createImageData2D` | function | Copies the pixels into an image this module owns; a wrong size or pixel count is refused with a TypeError. |
| `createNineSliceGeometry2D` | function | Create an owned immutable stretch grid for an existing Mesh2D texture lease. |
| `createSequenceClip` | function | Checks and freezes a sequence from its atlas size and frames; malformed input is refused. |
| `createSharedGeometry2D` | function | Copies and checks a mesh into a shared geometry that renderers can draw; malformed arrays are refused. |
| `createSharedMaterial2D` | function | Checks and freezes a material for shared meshes; values out of range are refused. |
| `createSpriteSheet` | function | Build one exact-name table from a genuine full-image lease without acquiring another resource. |
| `createTexture` | function | A texture of a whole image or of a rectangle of it. |
| `createTexturedGeometry2D` | function | Copies and checks a textured mesh; malformed arrays are refused with a TypeError. |
| `createTextureView` | function | Create an explicit logical view over an authentic straight CPU image. |
| `createTimer` | function | A timer: `createTimer(engine, scope, 1, 5).onTimer(n => …).onComplete(() => …).start()`. |
| `Delayed` | interface | A call to come: `cancel` takes it back if it has not been made. |
| `describeErrorCode` | function | A sentence for an error code: what went wrong and, for the codes a game meets most, what to do. |
| `Diagnostic` | interface | Diagnostics describe this headless lifecycle slice only. |
| `DiagnosticHandler` | type | Observation only: throwing cannot change cleanup or cancellation progress. |
| `DisplayObject` | class | A live display node; detach and terminal dispose are separate operations. |
| `DisplayObjectContainer` | class | Ordered display children with atomic reparenting and ownership-aware cleanup. |
| `DisplaySubtreeTicket` | interface | Borrows all nodes/resources; disposal only revokes this candidate publication. |
| `Disposable` | interface | Synchronous terminal cleanup. |
| `EgretError` | class | Stable machine-readable code, original cause, and associated cleanup failures. |
| `EgretErrorOptions` | interface | What an EgretError can carry besides its code: the error or value that caused it. |
| `Engine` | class | One headless run. |
| `EngineOptions` | interface |  |
| `ErrorLanguage` | type | The languages an error's sentence can be in. |
| `Event` | class | One typed payload with synchronous dispatch state; concurrent reuse is rejected. |
| `EventDispatcher` | class | Synchronous typed listeners with a frozen route and per-dispatch candidates. |
| `EventListenerOptions` | interface |  |
| `EventPhase` | type | Where an event is on its way: going down to its target, at it, or coming back up. |
| `EventType` | interface | Descriptor identity and invariant payload type belong together. |
| `EventTypeOptions` | interface | How events of a type travel: whether they bubble and whether they can be cancelled. |
| `GameClock` | interface | The Engine's game clock: it ticks while running, and handlers are called on each tick. |
| `GameClockHandler` | type | Called on each tick of the game clock. |
| `GameClockOptions` | interface | The longest step the game clock takes in one tick, in seconds. |
| `GameClockState` | type | Whether the game clock is running, paused or closed. |
| `GameClockSubscription` | interface | A handler's place on the game clock; disposing it stops the calls. |
| `GameClockTick` | interface | One tick of the game clock: its number, the seconds so far and the seconds since the last tick. |
| `getErrorLanguage` | function | The language error messages are written in. |
| `Graphics` | class | Drawing state belongs to one node; every shape snapshots its fill and its line. |
| `HitTestOptions` | interface | Receiver-inclusive whole-tree admission precedes all hit arithmetic. |
| `HostAdapter` | interface | Host owns the surface and any borrowed device. |
| `IMAGE_LIMITS_2D` | value | The largest image accepted: its longest edge and its number of pixels. |
| `ImageData2D` | interface | Immutable CPU byte identity; the brand conveys no asset or GPU authority. |
| `ImageData2DInput` | interface | The size and pixels of an image to copy: sRGB RGBA, eight bits a channel, rows top to bottom. |
| `isImageData2D` | function | Whether a value is an image made by `createImageData2D`, without reading any of its properties. |
| `isTexture` | function | Brand-only: disposal does not change the identity of a Texture. |
| `isTexturedGeometry2D` | function | Whether a value is a geometry made by `createTexturedGeometry2D`, without reading any of its properties. |
| `Matrix` | class | A matrix of the plane, as Egret's and a canvas's: a point (x, y) goes to (a·x + c·y + tx, b·x + d·y + ty). |
| `Matrix2D` | interface | Immutable logical-coordinate values shared by CPU capture and render hosts. |
| `MatrixLike` | interface | Anything with a 2D matrix's six numbers. |
| `Mesh2D` | class | A display leaf borrowing an exact lease and an immutable owned geometry. |
| `Motion` | interface | A chain of steps for one object. |
| `MotionEasing` | type | How a step runs from its start to its end: a name, or a function from 0–1 to 0–1 (it may pass both on the way). |
| `MotionEasingName` | type | The name of an easing a motion step can use. |
| `MotionState` | type | Whether a motion is idle, running, paused, finished or stopped. |
| `NineSliceBitmap` | class | A resizable stretch-only leaf borrowing one exact, caller-owned Texture lease. |
| `NineSliceBitmapOptions` | interface | Required local panel dimensions and fixed source-crop borders. |
| `NineSliceGeometry2DOptions` | interface | The size of a nine-slice picture, the size to stretch it to, and the insets whose corners are not stretched. |
| `NineSliceInsets2D` | interface | Border widths in the same units as the unrotated source crop. |
| `Point` | class | A place: `x` and `y`. |
| `Point2D` | interface | An owned logical-coordinate value; query results are frozen at runtime. |
| `Rectangle` | class | A rectangle: its top left corner `x`, `y`, and its `width` and `height`. |
| `Rectangle2D` | interface | An axis-aligned rectangle in its own coordinate space. |
| `RectangleLike` | interface | Anything with a rectangle's x, y, width and height. |
| `Releasable` | interface | Releases a lease; resource ownership and disposal remain with its provider. |
| `RenderEffect2D` | interface | Render-only subtree effect. |
| `RenderGlow2D` | interface | A glow around a node's picture, or, moved by an offset, a drop shadow. |
| `RenderOutline2D` | interface | An outline around a node's picture: its color, width and alpha. |
| `Scope` | class | Synchronous ownership boundary. |
| `ScopeState` | type | Whether a scope is open, disposing what it owns, or closed. |
| `ScopeValue` | type | Scope prefers dispose() when a value implements both cleanup protocols. |
| `SequenceClip` | interface | Public immutable sequence metadata; authentic values come from createSequenceClip. |
| `SequenceClipInput` | interface | The atlas size and the frames of a sequence to make. |
| `SequenceFrameInput` | interface | One frame of a sequence to make: its rectangle on the atlas, how long it shows, and its trim and rotation. |
| `SequencePlayback` | interface | A sequence playing on the game clock: start, pause, resume and stop it, and read its last sample. |
| `SequencePlaybackMode` | type | Whether a sequence plays once and stops on its last frame, or loops. |
| `SequencePlaybackOptions` | interface | Whether a sequence plays once or loops. |
| `SequencePlaybackState` | type | Whether a sequence playback is idle, running, paused, completed, stopped or failed. |
| `SequencePlayer` | class | Explicit absolute-time selection borrowing a target and its exact current lease. |
| `SequenceRegion` | interface | The rectangle of the atlas a sequence shows at one moment, with its trim and rotation. |
| `SequenceSample` | interface | What a sequence shows at a position: its frame and region, and whether it has reached its end or stopped. |
| `setErrorLanguage` | function | The language of the sentence in the message of every error made from now on: English unless set. |
| `Shape` | class | Stable drawing facade; a Sprite never shares or rebinds its Graphics. |
| `SHARED_FRAME_PROFILE_2D` | value | The name of the shared 2D frame profile that hosts and the engine agree on. |
| `SharedBarrierCommand2D` | interface | A command that ends or begins an effect layer: what came before is finished before what comes after is drawn. |
| `SharedBlendSpace2D` | type | Where translucent draws mix with what is under them. |
| `SharedDrawState2D` | interface | What every draw command carries: its order, its material, its matrix, its opacity and its clips. |
| `SharedEffect2D` | interface | Frozen effect inputs captured with the same frame and image ownership. |
| `SharedFloatArray2D` | type | A float array of a shared geometry, in single or double precision. |
| `SharedFrameOptions2D` | interface | The size of a frame to capture, the color it is cleared to, and how its alpha is given. |
| `SharedFrameProfile2D` | type | The type of the shared frame profile name. |
| `SharedGeometry2D` | interface | Immutable CPU geometry identity; the brand grants no asset or GPU authority. |
| `SharedGeometryInput2D` | interface | The positions, texture coordinates, light and dark colors and triangle indices of a mesh to share with a renderer. |
| `SharedGlow2D` | interface | A glow or outline drawn around what an effect layer holds. |
| `SharedImageCommand2D` | interface | A draw command that draws a region of a page. |
| `SharedIndexArray2D` | type | An index array of a shared geometry, in 16 or 32 bits. |
| `SharedMaterial2D` | interface | A checked material for shared meshes; only `createSharedMaterial2D` makes one. |
| `SharedMaterialInput2D` | interface | The colors, blend, sampling and addressing of a material for shared meshes, as plain values to check. |
| `SharedMeshCommand2D` | interface | A draw command that draws a textured or colored mesh. |
| `SharedOutputAlpha2D` | type | How a frame's output alpha is given: premultiplied, or opaque with alpha ignored. |
| `SharedPage2D` | interface | One image that a frame's commands sample from, with how its pixels are represented. |
| `SharedRectangleCommand2D` | interface | A draw command that fills a rectangle with one color. |
| `SharedRegion2D` | interface | A region of a page, by the page's index in the frame. |
| `SharedRenderCommand2D` | type | Any command of a shared frame. |
| `SharedRenderFrame2D` | interface | One captured frame: its size, clear color and color recipe, its commands in draw order, and the pages, regions, materials and geometries they use. |
| `SharedRenderHostAdapter` | interface | A host that draws shared frames of this profile. |
| `Sprite` | class | Stable drawing facade; a Sprite never shares or rebinds its Graphics. |
| `SpriteSheet` | interface | Immutable metadata plus a separately revocable borrow of one original lease. |
| `SpriteSheetFrameInput` | interface | One packed absolute rectangle, indexed by its exact UTF-16 name. |
| `Stage` | class | Created and bound by Engine; there is no implicit global stage. |
| `Texture` | class | An immutable CPU image view with a separate, terminal wrapper lifetime. |
| `TexturedFloatArray2D` | type | A float array of a textured geometry, in single or double precision. |
| `TexturedGeometry2D` | interface | Immutable CPU geometry identity; the brand grants no asset or GPU authority. |
| `TexturedGeometry2DInput` | interface | The positions, texture coordinates and triangle indices of a textured mesh to copy. |
| `TexturedIndexArray2D` | type | An index array of a textured geometry, in 16 or 32 bits. |
| `TextureRegion2D` | interface | A rectangle of an image in whole pixels, from its top left corner. |
| `TextureViewRegion2D` | interface | Owned immutable metadata. |
| `TextureViewRegionInput2D` | interface | A packed page rectangle and its unrotated logical, top-left region. |
| `Timer` | interface | Calls a function every `delay` seconds, `repeatCount` times or until it is stopped, as Egret's Timer. |
| `Tween` | interface | A number tweened on the game clock: start, pause, resume and stop it, and read its value. |
| `TweenEasing` | type | The easing a tween uses. |
| `TweenOptions` | interface | A tween to make: from and to which number, for how long, with which easing, and what it calls. |
| `TweenState` | type | Whether a tween is idle, running, paused, completed, stopped or failed. |

## `@egret/engine/webgpu`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createSharedWebGPUHost` | function | A host that draws shared frames with WebGPU on a canvas. |
| `SharedDeviceSessionState` | type | Shared Host lifecycle metadata. |
| `SharedDeviceSessionStatus` | interface | A frozen observation of one Host, with historical and current failures separate. |
| `SharedFrameSubmission` | interface | Native draw completion is separate from pixel readback and final retirement. |
| `SharedFrameUpload` | interface | A single-use authority over the existing Host-owned pending frame record. |
| `SharedFrameUploadOptions` | interface | Cancellation revokes an unsubmitted upload without releasing unsettled work. |
| `SharedFrameUploadReady` | interface | Upload completion does not imply that this frame has been presented. |
| `SharedHostResourceStatus` | interface | Fresh immutable data; reads do no native work. |
| `SharedWebGPUHost` | interface | A host that draws shared frames with WebGPU: start and stop it, stage frames, read them back, and recover from a lost device. |
| `SharedWebGPUHostOptions` | interface | A shared WebGPU host's own options: its geometry limits, effects, output alpha, blend space and recovery. |
| `SharedWebGPUHostStatus` | interface | A shared WebGPU host as it is now: its host status, the bytes pending, and its resources. |
| `SharedWebGPUReadback` | interface | Pixels read back from a shared frame, with their alpha mode and device generation. |
| `WebGPUHostDiagnostic` | interface | Something a WebGPU host reports: a failure, with how serious it is. |
| `WebGPUHostErrorCode` | type | What went wrong in a WebGPU host. |
| `WebGPUHostFailure` | interface | A failure of a WebGPU host: its code, the frame it happened at, the phase, and its cause. |
| `WebGPUHostOptions` | interface | A WebGPU host to make: its canvas and device, its pixel ratio, its limits, whether it reads back, and what it reports to. |
| `WebGPUHostState` | type | Where a WebGPU host is: new, starting, active, stopped, failed, closing or closed. |
| `WebGPUHostStatus` | interface | A WebGPU host as it is now: its state, frames and bytes pending, and its failures. |
| `WebGPUReadback` | interface | The pixels of a frame read back: its frame, size, format, color space and alpha, and its bytes. |

## `@egret/engine/text`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createTextField` | function | Public explicit entry; shape, proxies and borrowed identities grant no authority. |
| `createTextRasterCache` | function | Explicit CPU text orchestration; this entry owns no browser font or drawing surface. |
| `TextField` | interface | Factory-produced noneditable leaf; the brand has no runtime value. |
| `TextFieldStatus` | interface | Where a text field is: unprepared, ready or disposed, its revisions and its metrics. |

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
| `BitmapButtonOptions` | interface | A bitmap button to make: its engine, scope and input, its skins, and what it does when activated. |
| `BitmapButtonState` | type | Whether a bitmap button is up, pressed, disabled or disposed. |
| `createBitmapButton` | function | Share a genuine input; own only the new private sheet, Bitmap and facade. |
| `createMouseInput` | function | Primary mouse activation for the admitted ordinary desktop Canvas layout profile. |
| `MouseInput` | interface | Scope-owned synchronous input. |
| `MouseInputCancelReason` | type | Why a press was cancelled. |
| `MouseInputEvents` | interface | The event types mouse input dispatches: begin, end, activate and cancel. |
| `MouseInputOptions` | interface | Fixed logical dimensions; browser layout scaling does not change game coordinates. |
| `MouseInputPayload` | interface | A mouse event: which pointer, where on the stage, what made it and which button. |
| `MouseInputState` | type | Whether mouse input is idle, has a button pressed, or has closed. |

## `@egret/engine/web/image`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserPngDecodeOptions` | interface | How the browser decodes a PNG: its orientation, alpha and color space conversion. |
| `BrowserPngPorts` | interface | How the browser decodes a PNG and makes a canvas, for PNG textures. |
| `BrowserTextureProvider` | interface | Loads PNG textures in the browser; close it when done. |
| `BrowserTextureProviderOptions` | interface | A PNG texture provider to make: where it reads bytes from, and the ports it decodes with. |
| `createBrowserTextureProvider` | function | Caller owns async close; managers own issued Textures and their final demand. |

## `@egret/engine/web/text`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createCanvasTextRasterProvider` | function | Caller-owned fonts and explicit cache invalidation; no font loading. |

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
| `SharedLayerWebGL2Host` | interface | A shared WebGL2 host that also draws kept layers. |
| `SharedWebGL2FrameTiming` | interface | The timings of a host's frames: totals by phase, the recent samples and how many were dropped. |
| `SharedWebGL2Host` | interface |  |
| `SharedWebGL2HostOptions` | interface | A shared WebGL2 host to make: its canvas, what it reports to, and whether it measures frames. |
| `SharedWebGL2HostStatus` | interface | A shared WebGL2 host as it is now: its resources, host status, bytes pending and retention. |
| `SharedWebGL2Layer2D` | interface | A layer drawn once and kept on the GPU: update it, or dispose of it. |
| `SharedWebGL2LayerEffect2D` | interface | How a kept layer is tinted when it is placed: its bounds and its multiplied and added color. |
| `SharedWebGL2LayerPlacement2D` | interface | Where a kept layer is placed in a frame, how large, and with what effect. |
| `SharedWebGL2LayerStatus` | interface | The kept layers of a host: the bytes they hold, and how many are ready and pending. |
| `SharedWebGL2PageBatching` | type | Same-page batches still merge. |
| `SharedWebGL2Readback` | interface | The pixels of a shared frame read back: its generation and frame, size, format, color space, alpha and bytes. |
| `SharedWebGL2StartupTiming` | interface | Elapsed startup phases in the current successful WebGL2 generation, not GPU execution timers. |
| `SharedWebGL2TimingPhase` | type | A phase of drawing a shared frame that the host can time. |
| `SharedWebGL2TimingSample` | interface | One timed phase of a frame: its generation and frame, the phase, when it began and how long it took. |
| `WebGL2HostDiagnostic` | interface | Something a WebGL2 host reports: a failure, with how serious it is. |
| `WebGL2HostErrorCode` | type | What went wrong in a WebGL2 host. |
| `WebGL2HostFailure` | interface | A failure of a WebGL2 host: its code, the frame and context generation it happened at, the phase, and its cause. |
| `WebGL2HostState` | type | Where a WebGL2 host is: new, starting, active, lost, restoring, stopped, failed, closing or closed. |
| `WebGL2HostStatus` | interface | A WebGL2 host as it is now: its state and generation, frames and bytes pending, and its failures. |

## `@egret/engine/world3d`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `AlphaMode3D` | type | How a material's alpha is used: ignored, cut at a threshold, or blended. |
| `ANIMATION3D_LIMITS` | value | The most tracks, keys and actions animations hold. |
| `ANIMATION_TEXTURE3D_LIMITS` | value | The most bone matrices, clips and frames a second an animation texture holds. |
| `AnimationAction3D` | class | One clip playing on a mixer: play, stop and reset it, fade it in or out, or cross-fade to another. |
| `AnimationClip3D` | class | A named animation: its tracks and its length in seconds. |
| `AnimationInterpolation3D` | type | How a track goes between its keys: it steps, moves in a line, or follows a cubic spline. |
| `AnimationLoop3D` | type | How an action plays its clip: over and over, once, or back and forth. |
| `AnimationMixer3D` | class | Plays clips on the subtree under `root`, blending concurrent actions by weight. |
| `AnimationPath3D` | type | What an animation track moves: a node's position, rotation, scale, or morph weights. |
| `AnimationStateMachine3D` | class | Plays clips by state, moving between states when their conditions are met. |
| `AnimationTexture3D` | class | Bone matrices of one skinned mesh for every frame of a set of clips. |
| `AnimationTrack3D` | interface | One track of a clip: the node it moves, what it moves, its keys and its interpolation. |
| `AnimationTrackInput3D` | interface | A track to make: the node it moves by name, what it moves, its key times and values, and its interpolation. |
| `ArrowHelper3D` | class | Arrow from `origin` along `direction`; change them and call update(). |
| `Attribute3D` | class | One attribute of a geometry, such as positions: its data, how many numbers each vertex has, and whether they are normalized. |
| `ATTRIBUTE_3D` | value | Well-known attribute names understood by the built-in materials. |
| `AttributeArray3D` | type | An array of vertex data. |
| `BakeAnimationOptions3D` | interface | How many frames a second clips are baked at. |
| `bakeAnimationTexture3D` | function | Sample clips into an animation texture. |
| `BakedClip3D` | interface | One clip baked into an animation texture: its name, first frame, frame count and length. |
| `BasisModule3D` | interface | The parts of an initialized Basis Universal transcoder module (`await BASIS()`) this adapter calls. |
| `BATCH3D_LIMITS` | value | The most items, vertices and line points a batch holds. |
| `BatchedMesh3D` | class | Many geometries drawn as one mesh with one material and one draw call. |
| `Blending3D` | type | How a material's color mixes with what is behind it. |
| `BodyType3D` | type | Whether a body never moves, is moved by code, or is moved by the simulation. |
| `Bone3D` | class | A bone of a skeleton. |
| `box3Empty` | function | Sets a box to empty. |
| `box3ExpandByPoint` | function | Grows a box to hold a point. |
| `box3IsEmpty` | function | Whether a box is empty. |
| `box3Transform` | function | Axis-aligned bounds of a transformed box (Arvo's method). |
| `box3Union` | function | The box that holds two boxes. |
| `BoxGeometryOptions3D` | interface | A box to make: its width, height and depth, and their segments. |
| `BoxHelper3D` | class | Wire box around an object's world bounds. |
| `Camera3D` | class | A camera: its projection, and calls that turn screen points into rays and world points into screen points. |
| `CameraHelper3D` | class | Outline of a camera's view volume. |
| `CapsuleGeometryOptions3D` | interface | A capsule to make: its radius, height and segments. |
| `CatmullRomCurve3D` | class | Smooth curve through every control point. |
| `CatmullRomKind3D` | type | How a Catmull-Rom curve is parameterized between its points. |
| `CharacterController3D` | class | Kinematic capsule that slides along the world instead of being simulated. |
| `CharacterControllerOptions3D` | interface | A character controller to make: its radius and height, where it starts, the steepest slope it climbs, and what it collides with. |
| `CharacterMotor3D` | class | A walking, jumping character. |
| `CharacterMotorOptions3D` | interface | How a character moves: its jump and gravity, the steps it climbs, its acceleration and air control, and its grace time to jump. |
| `CircleGeometryOptions3D` | interface | A circle to make: its radius, segments and arc. |
| `clamp` | function | The value, kept between `min` and `max`. |
| `Cloth3D` | class | A rectangular sheet. |
| `CLOTH3D_LIMITS` | value | The most points and colliders cloth and ropes hold. |
| `ClothOptions3D` | interface | A cloth to make: its columns and rows, where it starts and which way it spreads, and how stiff it is. |
| `colorFromHex` | function | Decode a 0xRRGGBB sRGB color into linear RGB in [0, 1]. |
| `ColorInput3D` | type | A color as 0xRRGGBB sRGB hex or linear RGB components. |
| `CompoundChild3D` | interface | One part of a compound shape, placed in the body's local frame. |
| `COMPRESSED_BLOCK_BYTES_3D` | value | Bytes per 4x4 block of each compressed format. |
| `CompressedFormat3D` | type | Block-compressed GPU formats that can be uploaded without transcoding. |
| `CompressedPixels3D` | interface | A pre-compressed mip chain, largest level first. |
| `COMPRESSION3D_LIMITS` | value | The most bytes a decompression gives. |
| `computeObjectBounds3D` | function | World-space bounds of an object and its descendants as [minX, minY, minZ, maxX, maxY, maxZ]. |
| `connectPhysics3D` | function | Connects to a physics world run in a worker, through a message port. |
| `ConvexHullShape3D` | class | A convex hull as a physics shape. |
| `createAmbientLight3D` | function | Uniform light from every direction. |
| `createAnimationClip3D` | function | Makes a clip from its name and tracks; malformed tracks are refused. |
| `createAnimationStateMachine3D` | function | Makes an animation state machine that drives a mixer. |
| `createArrowHelper3D` | function | Makes an arrow from a point in a direction. |
| `createAxesGeometry3D` | function | Three colored segments from the origin along +X (red), +Y (green) and +Z (blue). |
| `createAxesHelper3D` | function | Ready-made axes node colored X red, Y green, Z blue. |
| `createBasisTranscoder3D` | function | Turn an initialized Basis Universal transcoder module into the `transcodeKtx2` option. |
| `createBatchedMesh3D` | function | Makes a mesh that draws many geometries with one material in one draw. |
| `createBoxEdgesGeometry3D` | function | The twelve edges of an axis-aligned box given as [minX, minY, minZ, maxX, maxY, maxZ]. |
| `createBoxGeometry3D` | function | Axis-aligned box centered on the origin with one material group per face (+X, -X, +Y, -Y, +Z, -Z). |
| `createBoxHelper3D` | function | Makes lines that show an object's bounding box. |
| `createCameraHelper3D` | function | Makes lines that show what a camera sees. |
| `createCapsuleGeometry3D` | function | Capsule along Y; `height` is the length of the cylindrical middle section. |
| `createCharacterController3D` | function | Makes a capsule that walks and slides along what it hits, for a character. |
| `createCharacterMotor3D` | function | Makes a character motor that walks, jumps and climbs steps in a physics world. |
| `createCircleGeometry3D` | function | Flat disc or sector in the XY plane, facing +Z. |
| `createCloth3D` | function | Makes a sheet of cloth that hangs, folds and blows. |
| `createConeGeometry3D` | function | Makes a cone. |
| `createConvexHullShape3D` | function | Build a convex hull shape from a geometry's vertices, or from a flat list of points. |
| `createCubeTextureFromEquirect3D` | function | Build a cube texture from an equirectangular panorama. |
| `createCustomShader3D` | function | Makes a material drawn by shaders of your own. |
| `createCylinderGeometry3D` | function | Cylinder or truncated cone along Y. |
| `createDecal3D` | function | A decal mesh on a target mesh, added as its child so it moves with it. |
| `createDecalGeometry3D` | function | Cut the part of a mesh's surface that lies inside the decal box. |
| `createDirectionalLight3D` | function | Parallel rays, such as sunlight. |
| `createDodecahedronGeometry3D` | function | Makes a dodecahedron. |
| `createDracoDecoder3D` | function | Turn an initialized Draco decoder module into the `decodeDraco` option of the glTF loader. |
| `createEdgesGeometry3D` | function | Line segments for outline and crease edges only: edges with one face, or whose two faces meet at more than `thresholdAngle` radians. |
| `createExtrudeGeometry3D` | function | Give an outline thickness. |
| `createFatLine3D` | function | Makes a line of a given thickness through points. |
| `createFollowCamera3D` | function | Makes a camera that follows a target and keeps out of walls. |
| `createGeometry3D` | function | Build a geometry from plain arrays; missing normals are computed for triangles. |
| `createGeometryBuilder3D` | function | A builder that merges placed, coloured parts into one geometry. |
| `createGlassMaterial3D` | function | A standard material set up as glass: smooth and see-through, with reflections kept. |
| `createGpuParticles3D` | function | Makes particles simulated on the GPU. |
| `createGradientCubeTexture3D` | function | Procedural sky cube: a vertical gradient from `ground` through `horizon` to `zenith`, in sRGB. |
| `createGridGeometry3D` | function | Square grid of lines on the XZ plane, centered at the origin. |
| `createGridHelper3D` | function | Ready-made grid node for editors and debug views. |
| `createHeightField3D` | function | Makes a grid of heights for terrain and physics. |
| `createHeightFieldFromPixels3D` | function | Height field with one sample per pixel of a decoded RGBA image; the image's top row is the -Z edge. |
| `createHemisphereLight3D` | function | Sky color from above blending to a ground color from below (world Y axis). |
| `createIcosahedronGeometry3D` | function | Makes an icosahedron. |
| `createJelly3D` | function | Makes an object squash, stretch and wobble like jelly as it moves. |
| `createJellyShader3D` | function | The vertex hook a jelly drives. |
| `createLambertMaterial3D` | function | Diffuse-only lighting; the cheapest lit model. |
| `createLatheGeometry3D` | function | Revolve a profile of [x, y] points (x is the distance from the Y axis) around Y. |
| `createLightHelper3D` | function | Makes lines that show where a light is and where it shines. |
| `createLineMaterial3D` | function | Unlit line or point material; pair it with a 'lines', 'line-strip' or 'points' geometry. |
| `createMatcapMaterial3D` | function | Lighting baked into a sphere image: the surface color is looked up by the view-space normal, so no lights are needed. |
| `createMeshShape3D` | function | Build a collision mesh from a geometry or the unskinned, non-instanced triangle meshes under an object. |
| `createNavCrowd3D` | function | Makes a crowd of agents that move along a navigation mesh and keep apart. |
| `createNavMesh3D` | function | Build a navigation mesh from level geometry: a geometry, or an object whose meshes are merged with their world transforms. |
| `createOctahedronGeometry3D` | function | Makes an octahedron. |
| `createOrthographicCamera3D` | function | Makes an orthographic camera. |
| `createParticleEmitter3D` | function | Makes a particle emitter. |
| `createPerspectiveCamera3D` | function | Makes a perspective camera. |
| `createPhongMaterial3D` | function | Diffuse plus Blinn-Phong specular highlights. |
| `createPhysicsWorld3D` | function | Makes a 3D physics world. |
| `createPlaneGeometry3D` | function | Plane in the XY plane facing +Z. |
| `createPointLight3D` | function | Makes a light that shines from a point in every direction. |
| `createPolyhedronGeometry3D` | function | Project a convex solid's triangles onto a sphere, subdividing each `detail` times. |
| `createQuadGeometry3D` | function | Unit quad in XY used by sprites: corners at +-0.5, facing +Z. |
| `createRagdoll3D` | function | Makes a ragdoll of physics bodies that a skeleton follows. |
| `createRingGeometry3D` | function | Flat ring in the XY plane, facing +Z. |
| `createRope3D` | function | Makes a rope of points that hangs and swings. |
| `createScreenLayer3D` | function | Makes a picture drawn over the whole screen, above or below the scene. |
| `createSdfGeometry3D` | function | The mesh of the field's surface, with smooth normals and linear vertex colours (draw it with a material that has `vertexColors: true`). |
| `createSdfLod3D` | function | The model in levels of detail, as a Lod3D whose children are the meshes of the levels, nearest first. |
| `createSdfRig3D` | function | A rig of `shape`: its mesh, made as `createSdfGeometry3D` makes it, skinned to bones at the joints of the model. |
| `createShapeGeometry3D` | function | Fill one or more outlines in the XY plane, facing +Z. |
| `createSkeletonHelper3D` | function | Makes lines that show the bones of a skeleton. |
| `createSkinnedInstancedMesh3D` | function | Makes many skinned instances of one mesh, each playing baked clips from an animation texture. |
| `createSolidTexture3D` | function | Single-color 1x1 texture, useful as a placeholder or constant map. |
| `createSphereGeometry3D` | function | UV sphere with poles on the Y axis. |
| `createSpotLight3D` | function | Makes a light that shines from a point in a cone. |
| `createSprite3D` | function | Makes a sprite: a picture that always faces the camera. |
| `createSpriteMaterial3D` | function | Camera-facing unlit quad material for Sprite3D. |
| `createStandardMaterial3D` | function | Physically based metallic-roughness model, matching glTF 2.0 materials. |
| `createSurfaceMaterial3D` | function | A standard material with a surface drawn by the shader, over its colour or its vertex colours (on unless `vertexColors: false`): `createSurfaceMaterial3D({ surface: 'wood' })` for a crate made in code. |
| `createTerrain3D` | function | Makes terrain from a height field, drawn in chunks at levels of detail. |
| `createTerrainMaterial3D` | function | A standard material whose color is a blend of ground textures, such as sand, grass, rock and snow, painted by a weight map. |
| `createTerrainStream3D` | function | Makes terrain that loads and unloads tiles around a point. |
| `createTetrahedronGeometry3D` | function | Makes a tetrahedron. |
| `createTextGeometry3D` | function | Text as a mesh geometry in the XY plane, facing +Z, with the first baseline on y = 0. |
| `createTextShapes3D` | function | Outlines of a text as flat shapes; see Font3D.generateShapes. |
| `createToonMaterial3D` | function | Cel shading: diffuse light quantized into `steps` flat bands. |
| `createTorusGeometry3D` | function | Torus around the Z axis. |
| `createTorusKnotGeometry3D` | function | Makes a torus knot. |
| `createTrail3D` | function | Makes a ribbon that follows a moving object and fades behind it. |
| `createTransformGizmo3D` | function | Makes a transform gizmo seen by a camera. |
| `createTubeGeometry3D` | function | Sweep a circle along a curve, using twist-free frames. |
| `createUnlitMaterial3D` | function | Constant color, unaffected by lights. |
| `createVehicle3D` | function | Makes a vehicle of wheels on raycast suspension under a chassis body. |
| `createVolumetricFog3D` | function | Makes fog that light shines through. |
| `createWater3D` | function | Makes a water surface with waves, reflections and foam. |
| `createWaterMaterial3D` | function | The material Water3D uses, for a water surface on your own geometry: a standard material that refracts, with the wave hooks attached. |
| `createWireframeGeometry3D` | function | Line segments for every triangle edge, each drawn once. |
| `CubeTexture3D` | class | Six square faces in +X, -X, +Y, -Y, +Z, -Z order. |
| `CubicBezierCurve3D` | class | A cubic Bézier curve through four control points. |
| `Curve3D` | class | Base for every curve: subclasses implement getPoint(t) for t in [0, 1]. |
| `CURVE3D_LIMITS` | value | The most points and divisions a curve has. |
| `CurvePath3D` | class | Several curves joined end to end and traversed as one, by length. |
| `CustomShader3D` | interface | A fragment hook that post-processes a material's shaded color. |
| `CylinderGeometryOptions3D` | interface | A cylinder to make: its top and bottom radius, height, segments, and whether its ends are open. |
| `DECAL3D_LIMITS` | value | The most triangles a decal has. |
| `DecalOptions3D` | interface | A decal to make: where it goes and which way it faces, its size and depth, its rotation, and the steepest surface it covers. |
| `decodeMeshopt3D` | function | Decode one EXT_meshopt_compression buffer view. |
| `decompressZstd3D` | function | Decompress Zstandard data: one or more frames, including skippable ones. |
| `DEG_TO_RAD_3D` | value | Degrees times this are radians. |
| `DeserializedScene3D` | interface | A scene loaded back: its root, cameras, geometries, materials and textures. |
| `DeserializeOptions3D` | interface | How a scene is loaded back: how each texture key is turned into a texture. |
| `deserializeScene3D` | function | Rebuild a subtree from data produced by serializeScene3D. |
| `DisposeListener3D` | type | Called when something is disposed of. |
| `DracoModule3D` | interface | The parts of an initialized Draco decoder module (`await DracoDecoderModule()`) this adapter calls. |
| `EPSILON_3D` | value | How close two numbers must be to count as equal. |
| `EquirectOptions3D` | interface | How an equirectangular image is turned into a cube: its size, exposure and brightest value. |
| `exportGlb3D` | function | The model as the bytes of a .glb file: a geometry alone (with a plain material that shows its vertex colours), or an object and everything under it. |
| `ExtrudeGeometryOptions3D` | interface | An extrusion to make: how deep, in how many steps, and along which path. |
| `FatLine3D` | class | A polyline drawn as a ribbon of triangles that turns to face the camera, so it can be wider than the one pixel that plain lines allow. |
| `FatLineOptions3D` | interface | A thick line to make: its width, whether that width is in screen pixels, its color and whether it closes. |
| `findGridPath3D` | function | Shortest path on a grid of cells, for tile maps. |
| `Fog3D` | type | Fog that fades a scene into a color: linearly between two distances, or exponentially by a density. |
| `FollowCamera3D` | class | Third-person camera: orbits a target at a distance, and moves closer when a wall would hide the target, easing back out afterwards. |
| `FollowCameraOptions3D` | interface | How a follow camera keeps behind its target: its distance and height, its angles, and what it keeps clear of. |
| `Font3D` | class | A font that gives the outlines of text for 3D text geometry. |
| `FontSource3D` | interface | A font for 3D text: its metrics, family, and its glyphs' outlines. |
| `frustumFromMatrix` | function | The six planes of the frustum a projection-view matrix sees. |
| `frustumIntersectsBox` | function | Whether a box is at least partly inside a frustum. |
| `frustumIntersectsSphere` | function | Whether a sphere is at least partly inside a frustum. |
| `Geometry3D` | class | The vertices of a mesh: its attributes and indices, its groups and morph targets, and calls that compute normals and tangents. |
| `GEOMETRY3D_LIMITS` | value | The most vertices, indices, morph targets and groups a geometry has. |
| `GeometryBuilder3D` | interface | Joins many geometries, each placed, into one. |
| `GeometryGroup3D` | interface | A range of a geometry's indices drawn with one of its mesh's materials. |
| `GeometryInput3D` | interface | A geometry to make: its positions, and its normals, texture coordinates, colors and indices where given. |
| `GeometryPart3D` | interface | One geometry added to a builder: where, turned and scaled how, and its color. |
| `GizmoHandle3D` | type | A single axis, a plane spanned by two axes, or 'xyz' for the center handle of the scale mode. |
| `GizmoMode3D` | type | Whether a gizmo moves, turns or scales what it is attached to. |
| `GizmoSpace3D` | type | Whether a gizmo's axes are the world's or the object's own. |
| `GlbExportOptions3D` | interface | How a model is written. |
| `GltfAsset3D` | interface | A loaded glTF file: its scenes, animations, cameras, materials, textures and geometries. |
| `GltfDracoRequest3D` | interface | Draco data a glTF file needs decoded: its bytes and the attributes and component types it holds. |
| `GltfDracoResult3D` | interface | Decoded Draco data: its attributes by name and its indices. |
| `GltfImageRequest3D` | interface | An image a glTF file needs decoded: its index, media type, and its bytes or URI. |
| `GltfLoadOptions3D` | interface | How a glTF file's parts are loaded: its images, its other buffers, and its KTX2, meshopt and Draco data. |
| `GltfMeshoptRequest3D` | interface | Meshopt data a glTF file needs decoded: its bytes, count, stride, mode and filter. |
| `GlyphOutline3D` | interface | One glyph in font units. |
| `GpuParticles3D` | class | An instanced, camera-facing quad per particle. |
| `GpuParticlesOptions3D` | interface | GPU particles to make: how many and how long they live, how they move, grow, turn and fade, where they come from and how they blend. |
| `GridPathOptions3D` | interface | How a grid path is found: whether it moves diagonally, and how many cells it visits at most. |
| `HDR3D_LIMITS` | value | The largest HDR image read. |
| `HdrImage3D` | interface | Linear RGB floats, three per pixel, top row first. |
| `HeightField3D` | class | Heights on a regular grid in the XZ plane. |
| `HeightFieldOptions3D` | interface | A height field to make: its columns and rows, its size, and its heights or a function that gives them. |
| `HeightImageOptions3D` | interface | How an image becomes heights: the field's size, its lowest and highest height, and how heights are encoded. |
| `inflate3D` | function | Decompress a zlib stream, or a bare deflate stream when `raw` is set. |
| `InstanceBlendOptions3D` | interface | How an instance blends two baked clips: from when, how fast, whether they loop and stay in step. |
| `InstanceClipOptions3D` | interface | How an instance plays a baked clip: from when, how fast, whether it loops and how long it fades. |
| `InstancedMesh3D` | class | Draw one geometry many times in a single call with per-instance transforms and colors. |
| `isCompressedPixels3D` | function | Whether a value holds compressed pixels. |
| `isKtx23D` | function | True when `bytes` starts with the KTX 2.0 file identifier. |
| `isTexturePixels3D` | function | Whether a value holds plain pixels. |
| `Jelly3D` | class | Makes everything drawn under `target` behave like jelly. |
| `JellyOptions3D` | interface | How a jelly wobbles: its stiffness and damping, how far it squashes, how it reacts, and how it idles. |
| `Joint3D` | class | A constraint between two bodies, or between a body and the world. |
| `JointOptions3D` | interface | A joint to make: its kind, the two bodies and anchors, its axis and limits, its motor and spring. |
| `JointType3D` | type | The kind of a joint: a point, a hinge, fixed, a distance or a slider. |
| `Ktx2Info3D` | interface | What a KTX2 file holds: its format, size, levels and supercompression. |
| `Ktx2Options3D` | interface | How a KTX2 file is transcoded for the GPU in use. |
| `Ktx2Result3D` | interface | A transcoded KTX2 texture: its pixels and color space. |
| `LatheGeometryOptions3D` | interface | A lathe to make: its segments and the arc it turns through. |
| `Light3D` | class | A light in a scene: its kind and its shadow. |
| `LIGHT3D_LIMITS` | value | The most directional, point, tiled point and spot lights a scene lights, and the most shadows. |
| `LightHelper3D` | class | Shows where a light is and where it points: a ray for directional, a cone for spot, a range sphere for point lights. |
| `LightOptions3D` | interface | A light to make: its color and intensity, and whether it casts shadows. |
| `LightShadow3D` | interface | How a light casts shadows: its map size, biases, range, extent, softness and cascades. |
| `LightType3D` | type | The kind of a light: ambient, hemisphere, directional, point or spot. |
| `linearColor3D` | function | A hex colour as seen on screen in the linear RGB the renderer lights, for vertex colours written by hand. |
| `linearToSrgb` | function | Turns a linear color value into an sRGB one. |
| `LineCurve3D` | class | A straight line between two points, as a curve. |
| `LineHelper3D` | class | Shared base: a line mesh whose vertices are rewritten by update(). |
| `loadGltf3D` | function | Parse a glTF 2.0 asset from .glb bytes, .gltf JSON bytes or an already parsed JSON object. |
| `Lod3D` | class | Shows exactly one child depending on the distance to the camera. |
| `mat3NormalFromMat4` | function | 3x3 inverse transpose of the upper-left block, written as nine column-major floats. |
| `mat4Compose` | function | Affine matrix from translation, unit quaternion and scale. |
| `mat4Copy` | function | Copies a 4x4 matrix. |
| `mat4Decompose` | function | Split an affine matrix; a negative determinant is folded into scale X. |
| `mat4Determinant` | function | The determinant of a 4x4 matrix. |
| `mat4Identity` | function | Sets a 4x4 matrix to the identity. |
| `mat4Invert` | function | Returns false and leaves `out` untouched when the matrix is singular. |
| `mat4LookAt` | function | World matrix of an object at `eye` whose negative Z axis points at `target`. |
| `mat4MaxScaleOnAxis` | function | The largest scale a 4x4 matrix applies along an axis. |
| `mat4Multiply` | function | out = a * b: with column vectors, b applies first. |
| `mat4Orthographic` | function | Sets a 4x4 matrix to an orthographic projection. |
| `mat4Perspective` | function | Right-handed perspective projection to clip depth [-1, 1]. |
| `Material3D` | class | One material class carries the superset of surface parameters; `shading` selects the lighting model. |
| `MaterialOptions3D` | interface | A material to make: its color and maps, its sides and alpha, its blending and depth, and its emission, normals and occlusion. |
| `mergeGeometries3D` | function | Join geometries that share the same attribute set into one. |
| `mergeVertices3D` | function | Weld vertices whose every attribute matches within `tolerance`, producing an indexed geometry. |
| `Mesh3D` | class | A geometry drawn with materials, with its morph weights and skeleton. |
| `MESH3D_LIMITS` | value | The most bones, instances and materials a mesh has. |
| `MESHOPT3D_LIMITS` | value | The largest stride and count of meshopt data. |
| `MeshoptFilter3D` | type | The filter meshopt data was encoded with. |
| `MeshoptMode3D` | type | What meshopt data encodes: vertex attributes, triangles or indices. |
| `MorphTarget3D` | interface | A morph target: the positions, and normals, it moves a geometry toward. |
| `NavAgent3D` | class | An agent of a crowd: where it is and how it moves; give it a target, or stop it. |
| `NavAgentOptions3D` | interface | An agent to add: where it starts, its radius, speed and acceleration, and the node it moves. |
| `NavCrowd3D` | class | Agents walking on one navigation mesh. |
| `NAVIGATION3D_LIMITS` | value | The most triangles, agents and grid cells navigation holds. |
| `NavLocation3D` | interface | Where a point is on a navigation mesh: its triangle and the point itself. |
| `NavMesh3D` | class | The walkable surface of a level: find paths, nearest points and ray hits on it, and set the cost of its areas. |
| `NavMeshOptions3D` | interface | A navigation mesh to make: the steepest walkable slope, and how close vertices are welded. |
| `NavPath3D` | interface | A path found on a navigation mesh: its points, whether it reaches the goal, and its length. |
| `NavPathOptions3D` | interface | How a path is found: the agent's radius, whether it follows the ground, and how far its ends may snap. |
| `NavPoint3D` | type | A point on a navigation mesh as x, y and z. |
| `NumericArray3D` | type | An array of numbers the 3D math writes into. |
| `Object3D` | class | A node of a 3D scene: its children, place, rotation and scale, and calls that move and find nodes. |
| `Object3DKind` | type | What kind of node an object is. |
| `OrthographicCameraOptions3D` | interface | An orthographic camera to make: the height it sees, its aspect ratio and near and far planes. |
| `parseKtx23D` | function | Read a KTX 2.0 file holding one 2D texture and its mip chain. |
| `parseRgbe3D` | function | Decode a Radiance .hdr file (flat or run-length encoded, -Y +X orientation). |
| `parseTrueTypeFont3D` | function | Read a TrueType font: a .ttf file, an OpenType file with TrueType (glyf) outlines, or the first font of a .ttc collection. |
| `parseTypefaceFont3D` | function | Read a font in the typeface JSON format (the `*.typeface.json` files used with web 3D libraries). |
| `ParticleEmitter3D` | class | Emits particles on the CPU: burst some, update it each frame, or reset it. |
| `ParticleEmitterOptions3D` | interface | An emitter to make: how many particles and how often, how long they live, how they move, grow, change color and fade, and where they are born. |
| `PARTICLES3D_LIMITS` | value | The most particles an emitter holds, and the longest step it takes. |
| `ParticleShape3D` | type | The shape particles are born in. |
| `Path2D3D` | class | A 2D outline built with pen commands; used as a contour or a hole. |
| `PerspectiveCameraOptions3D` | interface | A perspective camera to make: its vertical field of view, aspect ratio and near and far planes. |
| `PhongMaterialOptions3D` | interface | A Phong material's specular color and shininess. |
| `PHYSICS3D_LIMITS` | value | The most bodies, substeps, solver steps, contacts a pair keeps and parts of a compound. |
| `PHYSICS_HULL3D_LIMITS` | value | The most points a convex hull keeps and is made from. |
| `PHYSICS_MESH3D_LIMITS` | value | The most triangles a mesh shape has, and how many a leaf of its tree holds. |
| `PhysicsClient3D` | class | The page's end of a remote physics world. |
| `PhysicsContact3D` | interface | What a pair of solid bodies did to each other in one step. |
| `PhysicsPort3D` | interface | A Worker, a worker's global scope, a MessagePort: anything that posts and receives messages. |
| `PhysicsRaycastHit3D` | interface | What a ray hit: the body, where, its normal and how far. |
| `PhysicsShapeCastHit3D` | interface | What a cast shape hit: the body, how far it went, where, and the normal. |
| `PhysicsWorld3D` | class | A 3D physics world: add bodies and joints, step it, and cast rays and shapes through it. |
| `PhysicsWorldOptions3D` | interface | A physics world to make: its gravity, its step and substeps, its solver iterations, and whether bodies sleep. |
| `PlanarReflection3D` | class | A mirror camera and the target it draws into. |
| `PlanarReflectionPass3D` | interface | Output and inclusion settings shared by reflection draws and program preparation. |
| `PlaneGeometryOptions3D` | interface | A plane to make: its width and height, and their segments. |
| `Point2D` | type | A point in 2D as x and y. |
| `Point3D` | type | A point in 3D as x, y and z. |
| `PointLightOptions3D` | interface | A point light to make: how far it reaches. |
| `PolyhedronOptions3D` | interface | A regular solid to make: its radius, how often it is subdivided, and whether it is smooth. |
| `projectToViewport3D` | function | Projects a world point into a viewport of `width` by `height` pixels through `camera`. |
| `QuadraticBezierCurve3D` | class | A quadratic Bézier curve through three control points. |
| `quatCopy` | function | Copies a quaternion. |
| `quatFromAxisAngle` | function | A quaternion that turns by an angle about an axis. |
| `quatFromEuler` | function | Intrinsic XYZ Euler angles in radians (rotate X, then Y, then Z in local axes). |
| `quatFromRotationMatrix` | function | Rotation part of a matrix without scale or shear. |
| `quatIdentity` | function | Sets a quaternion to no rotation. |
| `quatMultiply` | function | Multiplies two quaternions: the rotation of b, then a. |
| `quatNormalize` | function | Scales a quaternion to length 1. |
| `quatSlerp` | function | Shortest-arc spherical interpolation; falls back to nlerp for close inputs. |
| `quatToEuler` | function | Inverse of quatFromEuler; writes radians into out[0..2]. |
| `Ragdoll3D` | class | Bodies and joints for a skeleton, created from the current pose by activate() and removed again by deactivate(). |
| `RAGDOLL3D_LIMITS` | value | The most parts a ragdoll has. |
| `RagdollJoint3D` | interface | How a ragdoll part is joined to its parent: the joint's kind, axis and limits. |
| `RagdollOptions3D` | interface | A ragdoll to make: its layers, friction, bounce and damping. |
| `RagdollPart3D` | interface | One part of a ragdoll: its bone, shape and mass, its offset, its parent and its joint. |
| `Raycaster3D` | class | Casts rays through a scene, from a point or from the camera through a screen point. |
| `RaycastHit3D` | interface | What a ray hit: how far, where, the object, its face, its texture coordinate and its instance. |
| `RaycastOptions3D` | interface | How a ray is cast: its near and far distances, its layers, and whether only the first hit is wanted. |
| `rayIntersectBox` | function | Slab test; returns the entry distance (0 when the origin is inside) or -1. |
| `rayIntersectSphere` | function | Distance along the ray to the sphere, or -1 when it misses. |
| `rayIntersectTriangle` | function | Moller-Trumbore. |
| `ReflectionRenderer3D` | interface | Anything that can draw a scene into a render target: both first-party renderers qualify. |
| `RemoteBody3D` | class | The page's stand-in for a body that lives behind the port. |
| `RemoteBodyOptions3D` | interface | A body to add to a physics world in a worker. |
| `RemoteJoint3D` | class | A joint of a physics world in a worker; remove it to take it out. |
| `RemoteJointOptions3D` | interface | A joint to add to a physics world in a worker. |
| `RemoteRaycastHit3D` | interface | What a ray hit in a physics world in a worker. |
| `RemoteShape3D` | type | Shapes that can be described in a message. |
| `RenderItem3D` | interface | One thing to draw: its mesh, geometry and material, its range, its depth and order. |
| `RenderList3D` | class | What a camera sees, sorted for drawing: opaque and transparent items, shadow casters and lights. |
| `RenderStats3D` | interface | What building a render list counted: nodes visited, culled, and lights dropped. |
| `RenderTarget3D` | class | Off-screen color target. |
| `RenderTargetFormat3D` | type | Color storage of a render target: 8-bit sRGB, or half-float linear for values above 1. |
| `RenderTargetOptions3D` | interface | A render target to make: its format, its depth, and its filters and wrapping. |
| `Resource3D` | class | CPU-side resource with a version counter and terminal disposal. |
| `retargetAnimationClip3D` | function | A clip for the target rig that moves it as `clip` moves the source rig. |
| `RetargetOptions3D` | interface | How a clip is moved to another skeleton: from where to where, which bones match, the root, scale and frame rate. |
| `RigidBody3D` | class | A body in a physics world: its kind, shape and mass, its material and layers, and calls that move and push it. |
| `RigidBodyOptions3D` | interface | A body to add: its kind, shape and mass, where it is, its material and damping, its layers, and the node it moves. |
| `RingGeometryOptions3D` | interface | A ring to make: its inner and outer radius, segments and arc. |
| `Rope3D` | class | A rope or cable. |
| `RopeOptions3D` | interface | A rope to make: from where to where, in how many segments, how slack, and which ends are pinned. |
| `sampleAnimationTrack3D` | function | Evaluate one track at `time` into `out`; `hint` caches the last key index. |
| `Scene3D` | class | Root of a renderable graph; owns environment-wide settings. |
| `SCENE_DOCUMENT_FORMAT_3D` | value | The format name of a saved scene document. |
| `SCENE_DOCUMENT_VERSION_3D` | value | The version of the scene document format. |
| `SceneDocument3D` | interface | A scene saved as JSON: its nodes, geometries, materials, textures and skeletons, and what was skipped. |
| `ScreenLayer3D` | class | Full-screen image drawn in the same pass as the 3D scene, typically the canvas of a 2D stage. |
| `ScreenLayerOptions3D` | interface | A screen layer to make: its order and opacity, whether it updates itself, and which way its rows run. |
| `SdfBone3D` | interface | A bone of a rig: where it turns, what it moves, and the bone it hangs from. |
| `sdfBox` | function | A box of `size` [width, height, depth], its edges rounded by `round` (0 for sharp; more than half the smallest side is taken as that). |
| `sdfCapsule` | function | A rounded limb from `from` to `to`: `radius` thick at the start, `radiusEnd` (the same unless given) at the end. |
| `sdfCone` | function | An upright cone of `height` along y, `bottom` wide at its foot and `top` (0 for a point) at its head. |
| `sdfCylinder` | function | An upright cylinder of `radius` and `height` along y, its rims rounded by `round` (at most the radius or half the height). |
| `sdfDisplace` | function | The surface pushed in and out by smooth noise: rocks, bark, rough earth, a lumpy creature. |
| `SdfDisplaceOptions3D` | interface | What `sdfDisplace` does: how far, how fine and which noise. |
| `sdfEllipsoid` | function | A stretched ball with `radii` [x, y, z]: heads, bodies, eggs and stones. |
| `sdfExtrude` | function | A flat `outline` of points [x, y] in the xy plane, closed, pushed `depth` deep along z about its middle, its edges rounded by `round`: signs, gables, blades, stars, letters, tiles, cut-out shapes. |
| `SdfGroupOptions3D` | interface | A group of shapes: `smooth` is how far, in the model's units, the blend between them reaches. |
| `sdfIntersect` | function | What the shapes have in common; with `smooth`, its edges rounded. |
| `sdfLathe` | function | A shape turned about the y axis from its `profile`: points [radius, height] going round a closed outline, as a potter draws half a vase. |
| `SdfLodOptions3D` | interface | How a model is made in levels: the mesh options, its material, and each level's triangles and distance. |
| `SdfMeshOptions3D` | interface | How a field becomes a mesh. |
| `sdfMirror` | function | The shape and its mirror image across the plane through the origin square to `axis` ('x' unless given): make one eye, ear, arm or leg on the positive side and get the pair. |
| `SdfOptions3D` | interface | Where a shape goes and how it looks: moved by `at`, turned by `rotation`, scaled by `scale`, painted `color`. |
| `sdfPattern` | function | `shape` with a pattern painted over its colours, in the coordinates of the model; the surface does not move. |
| `SdfPatternOptions3D` | interface | A pattern painted over a shape's colours. |
| `SdfPoseKey3D` | type | A pose key: a time in seconds, the bone's turn as Euler angles in radians, and optionally how far it moves. |
| `SdfRig3D` | interface | A model that moves: its root to add to a scene, its skinned mesh, its bones by name, and its animation. |
| `SdfRigOptions3D` | interface | How a rig is made: the options of its mesh, its material, and how wide a joint bends. |
| `sdfRound` | function | The shape grown by `radius` all round, its edges rounded by as much. |
| `SdfShape3D` | class | A shape as a signed distance field: negative inside, positive outside, zero on the surface. |
| `sdfShell` | function | A hollow skin of the shape, `thickness` thick: bowls, pots, helmets, when cut open. |
| `sdfSphere` | function | A ball of `radius`. |
| `sdfSubtract` | function | `base` with `cut` taken away; with `smooth`, the edges of the hollow rounded. |
| `sdfTorus` | function | A ring lying flat: `radius` to the middle of the tube, `tube` the tube's radius. |
| `sdfUnion` | function | The shapes joined into one; with `smooth`, blended where they meet. |
| `SERIALIZE3D_LIMITS` | value | The most nodes, embedded texture bytes and document bytes a scene document has. |
| `SerializeOptions3D` | interface | How a scene is saved: the key each texture is saved by. |
| `serializeScene3D` | function | Write the subtree under `root` as JSON-safe data. |
| `servePhysics3D` | function | Run a physics world on this end of a port and answer the messages of a PhysicsClient3D. |
| `setColor3D` | function | Writes a color into a float array as red, green and blue. |
| `Shading3D` | type | How a material is lit: not at all, Lambert, Phong, physically based, toon, or by a matcap. |
| `Shape3D` | class | A filled outline with optional holes. |
| `ShapeDefinition3D` | type | The shape of a body: a sphere, box, capsule, plane, convex hull, triangle mesh, or several moving as one. |
| `Side3D` | type | Which sides of a material's triangles are drawn. |
| `signedArea2D` | function | The signed area of a 2D polygon: positive when its points run counterclockwise. |
| `simplifyGeometry3D` | function | A copy of an indexed triangle geometry with fewer triangles; the geometry given is not changed. |
| `SimplifyOptions3D` | interface | How far to simplify. |
| `SimplifyResult3D` | interface | How a simplification went. |
| `Skeleton3D` | class | Ordered bones with their inverse bind matrices; one instance may drive many meshes. |
| `SkeletonHelper3D` | class | A line from every bone to its parent bone. |
| `SkinnedInstancedMesh3D` | class | Many copies of one skinned mesh in a single draw call, each at its own place in its own clip. |
| `sphereFromBox` | function | The sphere around a box. |
| `SphereGeometryOptions3D` | interface | A sphere to make: its radius and segments. |
| `sphereTransform` | function | Moves and scales a sphere by a 4x4 matrix. |
| `SpotLightOptions3D` | interface | A spot light to make: its cone's angle and soft edge. |
| `Sprite3D` | class | Camera-facing textured quad. |
| `SpriteMaterialOptions3D` | interface | A sprite material: whether sprites shrink with distance, and their rotation. |
| `srgbToLinear` | function | Turns an sRGB color value into a linear one. |
| `StandardMaterialOptions3D` | interface | A physically based material's metalness and roughness, and how much the environment lights it. |
| `STATE_MACHINE3D_LIMITS` | value | The most states and transitions a state machine has, and how many transitions it takes in one update. |
| `StateBlendEntry3D` | interface | One clip of a blend state and the parameter value it shows at. |
| `StateCondition3D` | interface | A condition of a transition: a parameter compared with a value. |
| `StateConditionOperator3D` | type | How a condition compares a parameter with its value. |
| `StateOptions3D` | interface | A state to add: its clip or blend, whether it loops, its speed, and what it calls on entering and leaving. |
| `StateParameter3D` | type | The value of a state machine parameter. |
| `StrandOptions3D` | interface | How a strand of points behaves: its gravity, damping, iterations, thickness, and what it collides with. |
| `SurfaceKind3D` | type | The surfaces the shader can draw. |
| `SurfaceMaterialOptions3D` | interface | A material with a surface: the standard material's options and how the surface looks. |
| `surfaceShaderSources3D` | function | The shader sources of a surface: its height, the colour it gives and the relief it gives, in GLSL and WGSL. |
| `Terrain3D` | class | A height field drawn as a grid of chunk meshes. |
| `TERRAIN3D_LIMITS` | value | The largest height field, chunk and number of levels and chunks terrain has, and the most streamed tiles. |
| `TerrainMaterialOptions3D` | interface | A terrain material's layers, their weights, and how often they repeat. |
| `TerrainOptions3D` | interface | Terrain to make: its chunks, levels of detail and their distance, its skirts, texture scale and colors. |
| `TerrainStream3D` | class | Terrain loaded in tiles around the camera: read heights, and update it as the camera moves. |
| `TerrainStreamOptions3D` | interface | Streamed terrain to make: its tile size and view distance, how a tile is loaded, and what is called as tiles come and go. |
| `TerrainTile3D` | interface | One tile of streamed terrain: where it is, its height field and terrain. |
| `TEXT3D_LIMITS` | value | The most characters, font bytes and glyph points 3D text has. |
| `TextGeometryOptions3D` | interface | 3D text to make: how deep it is extruded, and in how many steps. |
| `TextLayoutOptions3D` | interface | How 3D text is laid out: its size, curve detail, spacing, line height and alignment. |
| `Texture3D` | class | A texture for 3D materials; set its source to change its picture. |
| `TEXTURE3D_LIMITS` | value | The largest texture edge and size. |
| `TextureColorSpace3D` | type | Whether a texture's values are sRGB colors or linear data. |
| `TextureFilter3D` | type | How a texture is sampled: the nearest texel, or blended. |
| `TextureOptions3D` | interface | A texture to make: its name, wrapping and filters, its mipmaps and color space, whether it is flipped, and its anisotropy. |
| `TexturePixels3D` | interface | Tightly packed straight-alpha RGBA8 rows, top row first. |
| `TextureSource3D` | type | What a texture is made from: pixels, compressed pixels, or an image the browser decoded. |
| `TextureWrap3D` | type | What a texture does past its edges: repeats, clamps or mirrors. |
| `toNonIndexedGeometry3D` | function | Copy with every triangle owning its vertices, as needed for per-face data. |
| `Topology3D` | type | How a geometry's vertices are joined: as triangles, lines, a strip of lines, or points. |
| `TorusGeometryOptions3D` | interface | A torus to make: its radius, tube and segments. |
| `TorusKnotGeometryOptions3D` | interface | A torus knot to make: its radius and tube, segments, and its windings p and q. |
| `Trail3D` | class | Add the trail to the scene itself, not under the object it follows: its vertices are world positions. |
| `TRAIL3D_LIMITS` | value | The most points a trail has. |
| `TrailOptions3D` | interface | A trail to make: what it follows, how long it lasts, how far apart its points are, and how its width, color and opacity change. |
| `transformGeometry3D` | function | Bake a 4x4 transform into positions, normals and tangents, in place. |
| `TransformGizmo3D` | class | Handles to move, turn or scale an object by dragging them, with snapping. |
| `TransformGizmoOptions3D` | interface | A gizmo to make: its mode, its space and its size. |
| `TransitionOptions3D` | interface | A transition to add: from and to which state, how long it fades, its conditions, its exit time and whether it can be interrupted. |
| `TriangleMeshBuffers3D` | interface | The arrays of a triangle mesh shape, its hierarchy included: what `exportBuffers` gives and `fromBuffers` takes. |
| `TriangleMeshShape3D` | class |  |
| `triangulateShape3D` | function | Triangulate an outline with holes by ear clipping. |
| `TubeGeometryOptions3D` | interface | A tube to make along a curve: its segments, radius and whether it closes. |
| `vec3Add` | function | Adds two vectors. |
| `vec3Copy` | function | Copies a vector. |
| `vec3Cross` | function | The cross product of two vectors. |
| `vec3Distance` | function | The distance between two points. |
| `vec3Dot` | function | The dot product of two vectors. |
| `vec3Length` | function | The length of a vector. |
| `vec3Lerp` | function | The point a fraction of the way from one vector to another. |
| `vec3Normalize` | function | A zero-length input yields the zero vector instead of NaN. |
| `vec3Scale` | function | Multiplies a vector by a number. |
| `vec3Set` | function | Sets a vector's x, y and z. |
| `vec3Sub` | function | Takes one vector from another. |
| `vec3TransformDirection` | function | Transform a direction (w = 0) by the upper 3x3; the result is not normalized. |
| `vec3TransformMat4` | function | Transform a point (w = 1) with perspective division. |
| `vec3TransformQuat` | function | Turns a vector by a quaternion. |
| `Vehicle3D` | class | Drives a chassis body on ray wheels. |
| `VEHICLE3D_LIMITS` | value | The most wheels a vehicle has. |
| `VehicleOptions3D` | interface | A vehicle to make: its wheels, its engine and brakes, its steering, its top speed and how it rolls. |
| `ViewportPoint3D` | interface | Where a world point falls in a viewport, for labels, markers and pointers drawn over the picture. |
| `VolumetricFog3D` | class | Add one to the scene's root and keep `receiveShadow` on. |
| `VolumetricFogOptions3D` | interface | Volumetric fog to make: its color and density, its height and falloff, its distance, and how much the sun and lights shine through it. |
| `Water3D` | class | A horizontal water surface. |
| `WaterOptions3D` | interface | Water to make: its size and detail, its waves and ripples, its colors and clarity, its reflections, foam and caustics. |
| `Wheel3D` | interface | A wheel of a vehicle: its suspension and grip, and whether it touches the ground. |
| `WheelOptions3D` | interface | A wheel to add: where, its radius and suspension, whether it steers or drives, its grip and the node it turns. |
| `WORLD3D_LIMITS` | value | How deep a scene nests, how many children a node has, and how long a name is, at most. |
| `World3DError` | class | Stable machine-readable code plus a human-readable detail and the original cause. |
| `World3DErrorCode` | type | What went wrong in the 3D world. |

## `@egret/engine/webgl2/world3d`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `Atmosphere3D` | class | Height fog and light shafts for `renderer.postProcess.custom`. |
| `AtmosphereOptions3D` | interface | An atmosphere to make: its fog's color, density and height, and its light shafts. |
| `AudioListener3D` | class | Ears of the scene. |
| `AudioListenerOptions3D` | interface | An audio listener to make: its audio context and volume. |
| `CanvasFontOptions3D` | interface | A canvas font to make: the page's font family, weight and style, how finely it is traced, and how much it is smoothed. |
| `captureCubeTexture3D` | function | Render six 90-degree views from `position` and return them as a cube texture with mipmaps. |
| `createAtmosphere3D` | function | Makes height fog and light shafts for a scene. |
| `createAudioListener3D` | function | Makes the listener 3D sounds are heard by, usually on the camera. |
| `createCanvasFont3D` | function | A `Font3D` whose glyphs are traced from the page's own fonts, for 3D text in any script the page can draw, such as the Chinese of a road sign, without a font file. |
| `createCustomPost3D` | function | Makes a post-processing pass of your own shader. |
| `createDynamicResolution3D` | function | Makes a resolution scale that drops when frames are slow and rises when they are fast. |
| `createFlyControls3D` | function | Makes fly controls for a camera on an element. |
| `createFollowControls3D` | function | Makes follow controls for a follow camera on an element. |
| `createOrbitControls3D` | function | Makes orbit controls for a camera on an element. |
| `createOverlayScreenMarkers3D` | function | A display layer for World3DOverlay. |
| `createPositionalAudio3D` | function | Makes a sound that plays from a place in the scene. |
| `createPostProcessSettings3D` | function | Post-processing settings with every effect off. |
| `createScreenMarkers3D` | function | A layer of page elements that follow scene points. |
| `createTransformControls3D` | function | Makes transform controls for a camera on an element. |
| `createWebGL2Renderer3D` | function | Makes a renderer that draws 3D scenes with WebGL2. |
| `createWorld3DApp` | function | Starts a World3D game on `canvas`: an Engine, a renderer for the chosen backend and quality, and a frame loop. |
| `createWorld3DHost` | function | Host adapter that reserves `canvas` for one Engine. |
| `createWorld3DOverlay` | function | Lays a transparent 2D stage over `canvas` (the 3D canvas, which must sit in a positioned parent) and starts it. |
| `createWorld3DStats` | function | Makes a panel that shows a 3D view's frame times and draws. |
| `createWorld3DView` | function | Makes a view that draws a scene on each tick of the Engine's clock. |
| `CUBE_TEXTURE_ASSET_3D` | value | A cube texture. |
| `CubeCaptureOptions3D` | interface | How a cube is captured around a point: its size, near and far planes, and layers. |
| `CustomPost3D` | interface | A full-screen hook that runs after ambient occlusion and bloom and before tone mapping. |
| `DynamicResolution3D` | interface | A drawing resolution that follows the frame rate: down quickly when frames are slow, up slowly when they are not. |
| `DynamicResolutionOptions3D` | interface | How dynamic resolution moves: its least and greatest scale, its step, and the frame rates and times that move it. |
| `FlyControls3D` | class | Moves a camera with the keyboard and mouse, walking or flying. |
| `FlyControlsKeys3D` | interface | The keys of fly controls: forward, back, left, right, up, down and sprint. |
| `FlyControlsOptions3D` | interface | Fly controls to make: how fast they move and look, whether they fly, use pointer lock or damp, and their keys. |
| `FollowControls3D` | class | Turns and zooms a follow camera with the mouse and touch. |
| `FollowControlsOptions3D` | interface | Follow controls to make: how fast they turn and zoom. |
| `GLTF_ASSET_3D` | value | A loaded glTF file. |
| `GltfUrlLoadOptions3D` | interface | glTF loading options: download limits plus the optional KTX2, meshopt and Draco decoders. |
| `isSoftwareRendered3D` | function | Whether WebGL here is drawn by software (SwiftShader, llvmpipe and the like), as in a headless browser, a virtual machine or a page whose graphics card is blocked. |
| `loadCubeTexture3D` | function | Load six square images in +X, -X, +Y, -Y, +Z, -Z order as a cube texture. |
| `loadGltfFromUrl3D` | function | Load a .glb or .gltf file; relative buffer and image URIs resolve against `url`. |
| `LoadOptions3D` | interface | How a 3D asset is loaded: a signal that cancels it, and the most bytes it reads. |
| `loadTexture3D` | function | Load an image or KTX2 file as a texture. |
| `OrbitControls3D` | class | Turns a camera around a target, pans and zooms it, with the mouse and touch. |
| `OrbitControlsOptions3D` | interface | Orbit controls to make: their target, distances and angles, how fast they turn, pan and zoom, and which of these are on. |
| `OverlayScreenMarker3D` | interface | A borrowed native display marker; the layer owns its holder, not its artwork. |
| `OverlayScreenMarkerOptions3D` | interface | Options for a native display marker; its visible footprint is kept within the selected part of the overlay. |
| `OverlayScreenMarkers3D` | interface | A layer of native display objects over the 3D picture. |
| `OverlayScreenMarkersOptions3D` | interface | The native stage and the actual 3D canvas whose scene the camera projects. |
| `pickWorld3DBackend` | function | The backend asked for by the address (`backend=webgpu`), or `fallback`. |
| `pickWorld3DQuality` | function | The picture quality for this device: the address's `quality`, then a stored choice, then `low` for software rendering, a finger or a window shorter than 600 pixels, `medium` for 4 GB of memory or less, and `high` otherwise. |
| `play3d` | function | Starts a 3D game in the page. |
| `play3dAttached` | function | Starts transparent Play above an existing 3D canvas. |
| `Play3DAttachedOptions` | interface | A Play interface over a caller-configured 3D surface, sharing the Play clock and Scope. |
| `Play3DAttachedSession` | interface |  |
| `Play3DGame` | interface | Everything a small 3D game is given: its scene and camera, its input, and calls that make, move and light things. |
| `Play3DOptions` | interface | A small 3D game to start: its setup and update, and the options of a 2D play game. |
| `PLAY_LOOKS_3D` | value | The looks every game is given, by name. |
| `PlayBurst3D` | interface | A burst of particles: its color and count, how fast and how long they fly, their size and gravity. |
| `PlayCamera3D` | interface | The camera: where it is and what it looks at, by plain numbers. |
| `PlayFollow3D` | interface | How the camera follows: where it sits behind, how smoothly, and whether it turns with the target. |
| `PlayLamp3D` | class | A lamp: light from a point of the world that fades out by `range`. |
| `PlayLampOptions3D` | interface | A lamp to light: how bright, and how far it reaches. |
| `PlayLook3D` | interface | How a 3D play game looks: its background and sky, its ground, its light and sun, and its fog. |
| `PlayLookName3D` | type | What `play3d` gives: everything `play` gives for the interface and the game's time, and a world of things. |
| `PlayPlace3D` | interface | Where a thing is made. |
| `PlayThing3D` | class | A thing of the world: a box, a ball, a cylinder or a cone. |
| `PlayWeather3D` | type | What falls from the sky: snow, rain, or nothing. |
| `PlayWeatherOptions3D` | interface | Weather to show: how much rain or snow. |
| `PositionalAudio3D` | class | A sound placed in the scene. |
| `PositionalAudioOptions3D` | interface | A positional sound to make: its buffer and volume, how it fades with distance, its cone, rate, and whether it is spatial. |
| `POST3D_LIMITS` | value | The most bloom levels. |
| `PostProcessSettings3D` | interface | What is done to a frame after it is drawn: bloom, antialiasing, color, vignette, ambient occlusion, depth of field and outlines. |
| `registerWorld3DAssets` | function | Register the World3D asset providers on an AssetManager. |
| `Renderer3D` | interface | What both world3d backends provide; views and tools depend on this only. |
| `Renderer3DInfo` | interface | What a renderer drew in its last frame: draws, triangles, culled nodes, lights, shadow maps and resources. |
| `SCENE_ASSET_3D` | value | A scene document written by serializeScene3D. |
| `ScreenMarker3D` | interface | A marker over the screen that follows a point of the scene: its element and where it is. |
| `ScreenMarkerInsets3D` | interface | CSS-pixel margins for independent edges. |
| `ScreenMarkerOptions3D` | interface | A screen marker to add: what it points at, its offset, whether it sticks to the screen's edge, and how far it shows. |
| `ScreenMarkers3D` | interface | Elements over the screen that follow points of the scene: add them, and update them each frame. |
| `ScreenMarkersOptions3D` | interface | Screen markers to make: the container they go in, and the camera they follow. |
| `startWorld3DLoop` | function | Advance the Engine clock once per display frame. |
| `TEXTURE_ASSET_3D` | value | A 2D texture loaded from an image or KTX2 file. |
| `TextureLoadOptions3D` | interface | Texture loading options; `transcodeKtx2` handles KTX2 payloads the built-in reader cannot use directly. |
| `ToneMapping3D` | type | How a renderer maps bright colors into the screen's range. |
| `TransformControls3D` | class | Drags a transform gizmo with the mouse and touch to move, turn or scale an object. |
| `WebGL2GeometryPreparationOptions` | interface | Bounded, cooperative preparation of the renderer's ordinary geometry cache. |
| `WebGL2ProgramVariant3D` | interface | One material program for an expected draw. |
| `WebGL2Renderer3D` | class | Draws 3D scenes with WebGL2: set its size, render a scene from a camera, and read what it drew. |
| `WebGL2Renderer3DOptions` | interface | A WebGL2 renderer to make: its canvas and context, its tone mapping and exposure, its shadows, and what is called when the context is lost and restored. |
| `WORLD3D_QUALITY_PRESETS` | value | The three qualities. |
| `World3DApp` | interface | A 3D app: its Engine, renderer and view, its quality and resolution, and calls that show a scene and start and stop it. |
| `World3DAppOptions` | interface | A 3D app to make: its backend and quality, its dynamic resolution, its tone mapping, and what is called on an error or a lost device. |
| `World3DAssetOptions` | interface | How a 3D app loads assets: how URLs are resolved, how many bytes, and how textures and compressed data are decoded. |
| `World3DBackend` | type | Which GPU interface a 3D app draws with. |
| `World3DClockSource` | interface | The part of an Engine this view needs: its explicit game clock. |
| `World3DDeviceHints` | interface | What `pickWorld3DQuality` reads about the device. |
| `World3DFrameMetrics` | interface | What a frame drew: its draws and triangles, its CPU time, and its passes and reflections. |
| `World3DFramePass` | interface | One pass of a frame: its view and kind, its size, its draws and triangles, and its times. |
| `World3DGpuTiming` | type | How long a pass took on the GPU, or why that is not known. |
| `World3DLoopOptions` | interface |  |
| `World3DLoopSource` | interface | What drives a 3D view: an Engine's clock and the call that advances it. |
| `World3DLoopTiming` | interface | A 3D RAF callback and its CPU clock advance, on the same time origin as 2D loop timings. |
| `World3DOverlay` | interface | A 2D game drawn on a canvas over a 3D view. |
| `World3DOverlayOptions` | interface | A 2D overlay to make over a 3D view: its size, backend, pixel ratio, update, and whether it lets input through. |
| `World3DOverlayStartupTiming` | interface |  |
| `World3DPassKind` | type | What a pass drew: color, shadows, a depth prepass, an outline mask or post-processing. |
| `World3DQuality` | type | How much a 3D app draws: low, medium or high quality. |
| `World3DQualityPreset` | interface | What one picture quality turns on. |
| `World3DShowOptions` | interface | What a 3D app shows: its update, mixers and controls. |
| `World3DStats` | interface | Frame times, frame rate, draws and triangles of a 3D view, measured each frame. |
| `World3DStatsOptions` | interface | 3D stats to make: the container they show in, how they smooth, and how often they refresh. |
| `World3DView` | class | Draws a scene from a camera on each tick of the Engine, updating its mixers and controls. |
| `World3DViewKind` | type | Which view a pass drew: the main one, a reflection, or offscreen. |
| `World3DViewOptions` | interface | A 3D view to make: its renderer, scene and camera, its mixers and controls, its update, and how it resizes. |
| `World3DViewTiming` | interface | CPU phases of a World3D view tick; a rendered result is not GPU completion. |

## `@egret/engine/webgpu/world3d`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `Atmosphere3D` | class | Height fog and light shafts for `renderer.postProcess.custom`. |
| `AtmosphereOptions3D` | interface | An atmosphere to make: its fog's color, density and height, and its light shafts. |
| `AudioListener3D` | class | Ears of the scene. |
| `AudioListenerOptions3D` | interface | An audio listener to make: its audio context and volume. |
| `CanvasFontOptions3D` | interface | A canvas font to make: the page's font family, weight and style, how finely it is traced, and how much it is smoothed. |
| `captureCubeTexture3D` | function | Render six 90-degree views from `position` and return them as a cube texture with mipmaps. |
| `createAtmosphere3D` | function | Makes height fog and light shafts for a scene. |
| `createAudioListener3D` | function | Makes the listener 3D sounds are heard by, usually on the camera. |
| `createCanvasFont3D` | function | A `Font3D` whose glyphs are traced from the page's own fonts, for 3D text in any script the page can draw, such as the Chinese of a road sign, without a font file. |
| `createCustomPost3D` | function | Makes a post-processing pass of your own shader. |
| `createDynamicResolution3D` | function | Makes a resolution scale that drops when frames are slow and rises when they are fast. |
| `createFlyControls3D` | function | Makes fly controls for a camera on an element. |
| `createFollowControls3D` | function | Makes follow controls for a follow camera on an element. |
| `createOrbitControls3D` | function | Makes orbit controls for a camera on an element. |
| `createOverlayScreenMarkers3D` | function | A display layer for World3DOverlay. |
| `createPositionalAudio3D` | function | Makes a sound that plays from a place in the scene. |
| `createPostProcessSettings3D` | function | Post-processing settings with every effect off. |
| `createScreenMarkers3D` | function | A layer of page elements that follow scene points. |
| `createTransformControls3D` | function | Makes transform controls for a camera on an element. |
| `createWebGPURenderer3D` | function | Acquire a device (unless one is borrowed) and create the WebGPU renderer. |
| `createWorld3DApp` | function | Starts a World3D game on `canvas`: an Engine, a renderer for the chosen backend and quality, and a frame loop. |
| `createWorld3DHost` | function | Host adapter that reserves `canvas` for one Engine. |
| `createWorld3DOverlay` | function | Lays a transparent 2D stage over `canvas` (the 3D canvas, which must sit in a positioned parent) and starts it. |
| `createWorld3DStats` | function | Makes a panel that shows a 3D view's frame times and draws. |
| `createWorld3DView` | function | Makes a view that draws a scene on each tick of the Engine's clock. |
| `CUBE_TEXTURE_ASSET_3D` | value | A cube texture. |
| `CubeCaptureOptions3D` | interface | How a cube is captured around a point: its size, near and far planes, and layers. |
| `CustomPost3D` | interface | A full-screen hook that runs after ambient occlusion and bloom and before tone mapping. |
| `DynamicResolution3D` | interface | A drawing resolution that follows the frame rate: down quickly when frames are slow, up slowly when they are not. |
| `DynamicResolutionOptions3D` | interface | How dynamic resolution moves: its least and greatest scale, its step, and the frame rates and times that move it. |
| `FlyControls3D` | class | Moves a camera with the keyboard and mouse, walking or flying. |
| `FlyControlsKeys3D` | interface | The keys of fly controls: forward, back, left, right, up, down and sprint. |
| `FlyControlsOptions3D` | interface | Fly controls to make: how fast they move and look, whether they fly, use pointer lock or damp, and their keys. |
| `FollowControls3D` | class | Turns and zooms a follow camera with the mouse and touch. |
| `FollowControlsOptions3D` | interface | Follow controls to make: how fast they turn and zoom. |
| `GLTF_ASSET_3D` | value | A loaded glTF file. |
| `GltfUrlLoadOptions3D` | interface | glTF loading options: download limits plus the optional KTX2, meshopt and Draco decoders. |
| `isSoftwareRendered3D` | function | Whether WebGL here is drawn by software (SwiftShader, llvmpipe and the like), as in a headless browser, a virtual machine or a page whose graphics card is blocked. |
| `loadCubeTexture3D` | function | Load six square images in +X, -X, +Y, -Y, +Z, -Z order as a cube texture. |
| `loadGltfFromUrl3D` | function | Load a .glb or .gltf file; relative buffer and image URIs resolve against `url`. |
| `LoadOptions3D` | interface | How a 3D asset is loaded: a signal that cancels it, and the most bytes it reads. |
| `loadTexture3D` | function | Load an image or KTX2 file as a texture. |
| `OrbitControls3D` | class | Turns a camera around a target, pans and zooms it, with the mouse and touch. |
| `OrbitControlsOptions3D` | interface | Orbit controls to make: their target, distances and angles, how fast they turn, pan and zoom, and which of these are on. |
| `OverlayScreenMarker3D` | interface | A borrowed native display marker; the layer owns its holder, not its artwork. |
| `OverlayScreenMarkerOptions3D` | interface | Options for a native display marker; its visible footprint is kept within the selected part of the overlay. |
| `OverlayScreenMarkers3D` | interface | A layer of native display objects over the 3D picture. |
| `OverlayScreenMarkersOptions3D` | interface | The native stage and the actual 3D canvas whose scene the camera projects. |
| `pickWorld3DBackend` | function | The backend asked for by the address (`backend=webgpu`), or `fallback`. |
| `pickWorld3DQuality` | function | The picture quality for this device: the address's `quality`, then a stored choice, then `low` for software rendering, a finger or a window shorter than 600 pixels, `medium` for 4 GB of memory or less, and `high` otherwise. |
| `play3dAttached` | function | Starts transparent Play above an existing 3D canvas. |
| `Play3DAttachedOptions` | interface | A Play interface over a caller-configured 3D surface, sharing the Play clock and Scope. |
| `Play3DAttachedSession` | interface |  |
| `PositionalAudio3D` | class | A sound placed in the scene. |
| `PositionalAudioOptions3D` | interface | A positional sound to make: its buffer and volume, how it fades with distance, its cone, rate, and whether it is spatial. |
| `POST3D_LIMITS` | value | The most bloom levels. |
| `PostProcessSettings3D` | interface | What is done to a frame after it is drawn: bloom, antialiasing, color, vignette, ambient occlusion, depth of field and outlines. |
| `registerWorld3DAssets` | function | Register the World3D asset providers on an AssetManager. |
| `Renderer3D` | interface | What both world3d backends provide; views and tools depend on this only. |
| `Renderer3DInfo` | interface | What a renderer drew in its last frame: draws, triangles, culled nodes, lights, shadow maps and resources. |
| `SCENE_ASSET_3D` | value | A scene document written by serializeScene3D. |
| `ScreenMarker3D` | interface | A marker over the screen that follows a point of the scene: its element and where it is. |
| `ScreenMarkerInsets3D` | interface | CSS-pixel margins for independent edges. |
| `ScreenMarkerOptions3D` | interface | A screen marker to add: what it points at, its offset, whether it sticks to the screen's edge, and how far it shows. |
| `ScreenMarkers3D` | interface | Elements over the screen that follow points of the scene: add them, and update them each frame. |
| `ScreenMarkersOptions3D` | interface | Screen markers to make: the container they go in, and the camera they follow. |
| `startWorld3DLoop` | function | Advance the Engine clock once per display frame. |
| `TEXTURE_ASSET_3D` | value | A 2D texture loaded from an image or KTX2 file. |
| `TextureLoadOptions3D` | interface | Texture loading options; `transcodeKtx2` handles KTX2 payloads the built-in reader cannot use directly. |
| `ToneMapping3D` | type | How a renderer maps bright colors into the screen's range. |
| `TransformControls3D` | class | Drags a transform gizmo with the mouse and touch to move, turn or scale an object. |
| `WebGPURenderer3D` | class | Draws 3D scenes with WebGPU: set its size, render a scene from a camera, and read what it drew. |
| `WebGPURenderer3DOptions` | interface | A WebGPU renderer to make: its canvas and device, its tone mapping and exposure, its shadows, and what is called when the device is lost. |
| `WORLD3D_QUALITY_PRESETS` | value | The three qualities. |
| `World3DApp` | interface | A 3D app: its Engine, renderer and view, its quality and resolution, and calls that show a scene and start and stop it. |
| `World3DAppOptions` | interface | A 3D app to make: its backend and quality, its dynamic resolution, its tone mapping, and what is called on an error or a lost device. |
| `World3DAssetOptions` | interface | How a 3D app loads assets: how URLs are resolved, how many bytes, and how textures and compressed data are decoded. |
| `World3DBackend` | type | Which GPU interface a 3D app draws with. |
| `World3DClockSource` | interface | The part of an Engine this view needs: its explicit game clock. |
| `World3DDeviceHints` | interface | What `pickWorld3DQuality` reads about the device. |
| `World3DLoopOptions` | interface |  |
| `World3DLoopSource` | interface | What drives a 3D view: an Engine's clock and the call that advances it. |
| `World3DLoopTiming` | interface | A 3D RAF callback and its CPU clock advance, on the same time origin as 2D loop timings. |
| `World3DOverlay` | interface | A 2D game drawn on a canvas over a 3D view. |
| `World3DOverlayOptions` | interface | A 2D overlay to make over a 3D view: its size, backend, pixel ratio, update, and whether it lets input through. |
| `World3DOverlayStartupTiming` | interface |  |
| `World3DQuality` | type | How much a 3D app draws: low, medium or high quality. |
| `World3DQualityPreset` | interface | What one picture quality turns on. |
| `World3DShowOptions` | interface | What a 3D app shows: its update, mixers and controls. |
| `World3DStats` | interface | Frame times, frame rate, draws and triangles of a 3D view, measured each frame. |
| `World3DStatsOptions` | interface | 3D stats to make: the container they show in, how they smooth, and how often they refresh. |
| `World3DView` | class | Draws a scene from a camera on each tick of the Engine, updating its mixers and controls. |
| `World3DViewOptions` | interface | A 3D view to make: its renderer, scene and camera, its mixers and controls, its update, and how it resizes. |
| `World3DViewTiming` | interface | CPU phases of a World3D view tick; a rendered result is not GPU completion. |

## `@egret/engine/resources`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `ContentBinding` | interface | One resource a content loader binds: its id, its kind and its manifest binding. |
| `ContentGroup` | interface | All returned values are borrowed until this group or its owning Scope retires. |
| `ContentLoader` | interface | One manifest/source identity; multiple groups share the existing asset manager. |
| `ContentProviderFactory` | type | Makes the providers that load a content loader's resources, given what they bind. |
| `ContentProviders` | interface | Host providers own byte integrity/UTF-8 decoding; the core validates artifact semantics. |
| `createContentLoader` | function | One manifest/source catalog, independent of global IDs and of other loaders. |
| `createFontContentLoader` | function | One typed font catalog over the existing manager and genuine dependency groups. |
| `createManifestAssetBinding` | function | Binds one asset of an admitted manifest to an asset type, for its group to load. |
| `FontContentAsset` | interface | A loaded font: its id, family and identity, its size and format, and a copy of its bytes. |
| `FontContentBinding` | interface | One font a font content loader binds: its id, family and manifest binding. |
| `FontContentGroup` | interface | Fonts loaded together: wait for them, read them, and dispose of them together. |
| `FontContentLoader` | interface | Loads groups of fonts from a manifest. |
| `FontContentProviderFactory` | type | Makes the provider that loads the bytes of a font content loader's fonts. |
| `ManifestAssetBinding` | interface | A genuine invariant ref paired with one exact admitted manifest entry. |
| `ManifestAssetGroup` | interface | Scope-owned dependency group. |
| `ManifestBinding` | interface | Immutable resource metadata; only the optional binding factory creates it. |
| `ManifestGroupOptions` | interface | How urgently a manifest group loads: for what is needed now, or in the background. |

## `@egret/engine/web/resources`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createManifestByteSource` | function | Reads a manifest's files from a base URL, checking each one's length and SHA-256. |
| `createManifestContentLoader` | function | Integrity-checked PNG/UTF-8 transport plus the DOM-free content assembly. |
| `createManifestFontContentLoader` | function | Fonts share the authenticated byte transport and the Engine's existing resource manager. |
| `createManifestTextureProvider` | function | Source authentication precedes every caller-controlled options read. |
| `ManifestByteSource` | interface | Reads a manifest's files over the network and checks their digests. |
| `ManifestByteSourceOptions` | interface | A manifest byte source to make: its profile, the URL it fetches from, its deadline and retries. |
| `ManifestByteSourceStatus` | interface | How many reads a byte source has now and at most, and whether it was full. |
| `ManifestContentLoader` | interface | A content loader for a manifest in the browser: its status, and a call that closes it. |
| `ManifestFontContentLoader` | interface | A font content loader for a manifest, with the byte source it reads from. |
| `ManifestTextureProvider` | interface | A texture provider for a manifest's images, with its status. |
| `ManifestTextureProviderOptions` | interface | A manifest texture provider to make: the ports it decodes with. |
| `ManifestTextureProviderStatus` | interface | How many textures a manifest texture provider holds now and at most, and whether it was full. |

## `@egret/engine/input`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createKeyboardInput` | function | Keyboard input for the stage: key events go to the focused target, and focus moves with Tab. |
| `createPointerInput` | function | Pointer input for the stage: touches, mouse buttons and pens become contacts delivered to the nodes under them. |
| `PointerCancelReason` | type | Why a pointer was cancelled. |
| `PointerContact` | interface | A retained value: sequence orders all contacts on this router. |
| `PointerEventKind` | type | What happened to a pointer: it went down, moved, went up or was cancelled. |
| `PointerInput` | interface | Scope-owned input for an explicitly supplied logical host stream. |
| `PointerInputEvents` | interface | The event types pointer input dispatches: begin, move, end, cancel and tap. |
| `PointerInputOptions` | interface | Pointer input to make: its engine and scope, the surface's size, its limits, and what is called. |
| `PointerNotification` | interface | A pointer contact and the target it went to, and why it was cancelled. |
| `PointerRouterState` | type | Whether a pointer router passes input on, holds it, or has closed. |
| `PointerSample` | interface | One pointer's state at one moment: which pointer it is, what made it and where it is. |
| `PointerSession` | interface | Only the creating router admits this frozen identity; host IDs may be reused. |
| `PointerType` | type | What made a pointer: a mouse, a finger or a pen. |
| `PointerUpdate` | interface | Where a pointer is on the stage, which buttons it holds, and when, with its pressure and size where the device gives them. |

## `@egret/engine/web/gestures`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createDragAndDrop` | function | Drag and drop as games do it: the dragged object stays where it is, a picture of it follows the finger in `layer`, and letting go over a target that accepts what is carried calls its `drop`. |
| `createGestures` | function | Recognizes gestures on an object. |
| `DragAndDrop` | interface | Sources and targets of drag and drop. |
| `DragAndDropOptions` | interface | Drag and drop to make: its engine, scope and input, and the layer the picture that follows the finger is drawn in. |
| `DragSource` | interface | Something that can be dragged: what it carries, and the picture that follows the finger. |
| `DropTarget` | interface | A place something can be dropped, and what it does with what is dropped on it. |
| `GestureDrag` | interface | A drag: where it is, how far it moved since the last, and since it started. |
| `GestureOptions` | interface | What to recognize on an object, and what is called. |
| `GesturePinch` | interface | Two fingers: how far apart against how they started, how far they turned, in degrees, and their middle. |
| `GesturePoint` | interface | Where a gesture is: on the stage, and in the object's own units. |
| `Gestures` | interface | Recognized gestures of an object; ended with `dispose` or with its scope. |
| `GestureSwipe` | interface | A swipe: its main direction, its speed in stage units a second, and how far it went. |

## `@egret/engine/web/view`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `Badges` | interface | Red dots that add up: a dot on `mail/system` shows on `mail` too. |
| `checkView` | function | Checks a description: every part of a known kind with only the fields of its kind, names that are names and are used once, and portrait parts with the same names, of the same kinds, as the others. |
| `CompactOptions` | interface | How a number is written short: in Chinese with 万 and 亿, or in English with K, M, B and T. |
| `createBadges` | function | Makes a tree of red dots. |
| `createRequest` | function | Wraps what a button sends, such as a purchase, so that it is sent once at a time and its state can be shown. |
| `DEFAULT_VIEW_SKIN` | value | A dark skin that reads on any game: words in white on slate cards, blue buttons and a green accent. |
| `formatCompact` | function | A number written short for a screen: 999, 12.3K and 4.5M in English; 9999, 1.2万 and 3.4亿 in Chinese. |
| `keyCap` | function | The words of a key or a button, as a player reads them on a key cap. |
| `planView` | function | Plans where each part of a view goes on a screen: the parts for its shape, each rectangle in the game's units. |
| `Request` | interface | A request a button sends: whether it is out, what it came back with, and the failure if it failed. |
| `TABLET_SHORT_SIDE` | value | The shorter side, in CSS pixels, from which a screen is a tablet's for the `tablet` parts of a view. |
| `ViewAnchor` | type | Where in its panel a part is placed when the panel lays its parts out freely: an edge, a corner or the middle. |
| `ViewBar` | interface | How full something is: a value from 0 to 1. |
| `ViewButton` | interface | A button with words on it. |
| `ViewDescription` | interface | A screen as data: its parts, the parts while the screen is taller than wide, and how it sits. |
| `ViewFrame` | interface | Where a view goes: the screen the game shows and the part of it that is safe, in the game's units. |
| `ViewImage` | interface | A picture contained in its layout box and centred with its original aspect ratio. |
| `ViewPanel` | interface | A panel: a card that is drawn, or only a place that holds parts. |
| `ViewParagraphStyle` | interface | Width-wrapped text in an explicitly sized view part. |
| `ViewPart` | type | Any part of a view. |
| `ViewPlan` | interface | Where every part of a view goes on one screen. |
| `ViewPlannedPart` | interface | A part where it goes: its place in the tree, what it is, and its rectangle in the game's units. |
| `ViewRect` | interface | A rectangle in the game's units. |
| `ViewSize` | type | A width or height: units of the game, a share of the panel such as `'50%'`, or all that is left (`'fill'`). |
| `ViewSkin` | interface | The colours and sizes a view is drawn with, where its parts do not give their own. |
| `ViewSpace` | interface | Empty space: in a row or a column, `'fill'` pushes what follows to the end. |
| `ViewText` | interface | A line of words. |
| `ViewToggle` | interface | A switch that is on or off, with words before it. |
| `ViewVariant` | type | Which parts of a view are used: `root` (`'landscape'`), `portrait`, `tablet` or `tabletPortrait`. |

## `@egret/engine/web/pointer`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createBrowserPointerInput` | function | Pointer Events adapter for the explicit connected, untransformed Canvas profile. |
| `PointerInput` | interface | Scope-owned input for an explicitly supplied logical host stream. |
| `PointerInputOptions` | interface | Pointer input to make: its engine and scope, the surface's size, its limits, and what is called. |

## `@egret/engine/ui`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `ActionControl` | interface | A button control: whether it is pressed, how often it was activated, and calls that press or disable it. |
| `ActionControlOptions` | interface | An action control to make: its input and target, and what is called when it is activated or pressed. |
| `ActionKeysOptions` | interface | Space or Enter, released, activates. |
| `ControlKeys` | interface | Keys bound to a control: which are pressed now; dispose of it to unbind them. |
| `ControlKeysOptions` | type | Keys for one control: an action, a toggle, a text field or a selection group. |
| `ControlKeysSource` | interface | The keyboard input, or anything that delivers its three key events. |
| `createActionControl` | function | A button on a target: a captured press and release activates it by default. |
| `createControlKeys` | function | Binds the keyboard to a control: Space and Enter press an action or a toggle, arrows move a selection. |
| `createHoverControl` | function | Tells whether a pointer hovers over a target. |
| `createMovementControl` | function | A virtual stick on a target: dragging from its contact origin or a fixed center gives a direction. |
| `createRangeControl` | function | A slider on a target: dragging along its track or pressing keys sets a value between its least and greatest. |
| `createScrollControl` | function | Scrolls content past a viewport along one axis, by wheel, by dragging a thumb, or by calls. |
| `createSelectionGroup` | function | Radio buttons or tabs: one item of the group is selected at a time. |
| `createTextFieldControl` | function | A text field on a target: pressing it opens the platform's editing, and the value is committed or cancelled. |
| `createToggleControl` | function | A checkbox or switch on a target: a press and release inside it toggles it. |
| `createUiLayerManager` | function | Optional Root composition. |
| `createUiRoot` | function | One owned transaction domain over the genuine display and input authorities. |
| `createUiScreenStack` | function | Makes a screen stack. |
| `createUiTheme` | function | Checks and freezes a theme from its description. |
| `HoverControl` | interface | Whether a pointer hovers over a target; dispose of it to stop. |
| `HoverControlOptions` | interface | Hover, toggle and single-selection state for controls an application draws itself. |
| `LayoutNode` | type | A node of a UI layout tree: a leaf, a stack of children, or a virtual list. |
| `MovementControl` | interface | A virtual stick: where it points now, whether it is held, and calls that set or disable it. |
| `MovementControlOptions` | interface | A movement control to make: its input and target, its geometry, and what it calls. |
| `MovementKeysOptions` | interface | The keys that are down give the direction; opposite keys cancel each other. |
| `MovementValue` | interface | Reusable movement and action controls over the existing contact stream. |
| `RangeAxis` | type | One value out of a range, for a slider an application draws itself: a volume, a share, an amount. |
| `RangeControl` | interface | A slider: its value and range, whether it is dragged, and calls that set or step it. |
| `RangeControlOptions` | interface | A range control to make: its input and target, its axis and track, its range and step, and what it calls. |
| `RangeKeysOptions` | interface | Arrow keys move the value by one step, Page Up and Page Down by a page of steps, Home and End go to its ends. |
| `registerScreenOccluder` | function | Name a genuinely painted UI face that may cover a control without taking its input. |
| `RowBindContext` | interface | What binding a row is given: the record, its place, the theme and density, its scope, signal and target. |
| `RowBinding` | interface | What a bound row shows, and its measured height. |
| `RowRetention` | interface | A row kept bound after it leaves the viewport; release it to let it go. |
| `RowUnbindInfo` | interface | A row that was unbound: its key, its binding and content versions, and why. |
| `ScreenOccluder` | interface |  |
| `ScreenOccluderOptions` | interface |  |
| `ScreenOccluderRect` | interface |  |
| `ScrollAxis` | type | The scroll position of one axis of a clipped viewport an application draws itself. |
| `ScrollControl` | interface | Scrolling along one axis: the offset and its maximum, the thumb, and calls that scroll by lines, pages or to the ends. |
| `ScrollControlOptions` | interface | A scroll control to make: its axis, the lengths of its viewport and content, its wheel and thumb, and what it calls. |
| `ScrollKeysOptions` | interface | The arrow keys of its axis, Page Up, Page Down, Home and End. |
| `ScrollThumb` | interface | Where the thumb is on its track and how long it is. |
| `ScrollThumbOptions` | interface | A scroll thumb to drag: its input and target, its track's length and its shortest length. |
| `ScrollWheelOptions` | interface | How the wheel scrolls: the hover input, the target, and how far one line is. |
| `SelectionGroup` | interface | One of several: a radio group, a segmented control, or a listbox with a single selection. |
| `SelectionGroupOptions` | interface | A selection group to make: its input and items, the one selected, whether it wraps, and what it calls. |
| `SelectionItem` | interface | One item of a selection group: its key, its target and whether it can be chosen. |
| `SelectionKeysOptions` | interface | Arrow keys move the selection, Home and End go to its ends. |
| `selectUiSkin` | function | The name a skin gives to the state of a control: of the states that hold, the first in `order` that the skin has a name for, and `default` when it has none. |
| `TextFieldChange` | interface | A text field's value after a change, and whether a composition is under way. |
| `TextFieldControl` | interface | A text field: its value and draft, whether it is being edited, and calls that edit, commit or cancel. |
| `TextFieldControlOptions` | interface | A text field to make: its input, target and editor, its value and limits, its labels, and what it calls. |
| `TextFieldEditor` | interface | Shows one field at a time. |
| `TextFieldKeysOptions` | interface | The field opens when the key is released, so that the key types nothing into it. |
| `TextFieldRectangle` | interface | The state of a text field an application draws itself: its text, and whether it is being edited. |
| `TextFieldSession` | interface | What the control adds to the presentation of a field when it opens one. |
| `ToggleControl` | interface | A checkbox or switch: whether it is checked and pressed, and calls that toggle or set it. |
| `ToggleControlOptions` | interface | A toggle to make: its input and target, whether it starts checked, and what it calls. |
| `ToggleKeysOptions` | interface | Keys for a toggle: which kind of toggle, the control, and what is called when its press changes. |
| `UiCommitResult` | interface | What a commit did, and any errors after it. |
| `UiCounters` | interface | What a UI root counted in its last passes: layouts, records, rows, bindings and measurements. |
| `UiInvalidationKind` | type | What of a UI root has to be done again: its layout, its content, or both. |
| `UiKeyboardOptions` | interface | Explicit namespace prevents independently authored panels from sharing focus IDs. |
| `UiLayerAnchor` | interface | Where a layer is placed beside its target: on which side, how aligned, and how far from it. |
| `UiLayerCommitResult` | interface | What committing the layers did, and any errors after the commit. |
| `UiLayerManager` | interface | Stage intents, publish participating roots, then sync before editor placement/capture. |
| `UiLayerManagerOptions` | interface | A layer manager to make: its engine, scope and input, its viewport and limits. |
| `UiLayerOptions` | interface | A layer to open: its id and root, its kind and anchor, where focus goes, how it closes, and its backdrop. |
| `UiLayerRegistration` | interface | An open layer; dispose of it to close it. |
| `UiLayerSnapshot` | interface | The layers as they are now: committed and desired stacks, each layer, and counters. |
| `UiLayerTarget` | type | What a layer is anchored to: a leaf of the tree, or a row of a list. |
| `UiLeafContent` | interface | What a leaf shows, prepared for the size it is given. |
| `UiLeafPrepareContext` | interface | Detached content is prepared at the leaf's available inner width. |
| `UiLimits` | interface | How far past the viewport a list keeps rows, and how many rows it keeps resident and retained. |
| `UiPreparation` | interface | Where a preparation is, and the revisions it works from. |
| `UiRoot` | interface | A tree of UI laid out in a viewport: change its tree, theme or input, then prepare and commit it. |
| `UiRootOptions` | interface | A UI root to make: its theme, engine and scope, its viewport, density and tree, its input, and its limits. |
| `UiRowPointerNotification` | type | A pointer that began, moved, ended or was cancelled on a row of a list. |
| `UiRowSnapshot` | interface | One row as committed: its key and place, its versions, its box and whether it shows. |
| `UiScreenContext` | interface | What a screen is given when it is made: its parameters, how it closes itself, and whether it is covered. |
| `UiScreenDefinition` | interface | A kind of screen: its name, its layer, what the back key does on it, and how it is made. |
| `UiScreenHandle` | interface | What a screen is told. |
| `UiScreenLayer` | type | Where a screen goes: a page of the stack, a popup over the pages, or a modal, of which one is shown at a time. |
| `UiScreenStack` | interface | Pages, popups and modals, opened and closed in turn. |
| `UiScreenStackOptions` | interface | A screen stack to make: how many screens it holds, and who is told of failures nothing else is told of. |
| `UiScreenStackSnapshot` | interface | The stack as it is now, by the screens' ids. |
| `UiSkinState` | type | Which named states of a control are on, to choose its skin. |
| `UiSkinStateName` | type | The states of a control that a skin may have a name for. |
| `UiSnapshot` | interface | A UI root as committed: its theme, revisions, origin, viewport, density and boxes. |
| `UiTheme` | interface | Every factory result is a distinct immutable generation, including equal descriptors. |
| `UiThemeDescriptor` | interface | A theme to make: its id, colors, spacing, type and skins. |
| `UiThemeNode` | interface | How a node of a theme is filled and spaced. |
| `UiThemeSkin` | interface | Skin names resolve through application-owned, typed asset references, never URLs. |
| `UiThemeTypography` | interface | A theme's type: its font family, size and line height. |
| `VirtualDataSource` | interface | The records of a virtual list, and how a row is bound to a record and unbound from it. |
| `VirtualListHandle` | interface | A virtual list of a UI root: reveal a record, change its source or scroll, and read its snapshot. |
| `VirtualListRevealOptions` | interface | Alignment within the list's authored viewport; tall rows can remain clipped. |
| `VirtualListSnapshot` | interface | A virtual list as committed: its rows, scroll offset and extent, its anchor and counters. |
| `VirtualRecord` | interface | One record of a virtual list: its key, its content version, its estimated height and its value. |

## `@egret/engine/animation`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createSequenceController` | function | Opt-in sequence controls share Engine ownership but never create a second timer. |
| `createSequenceResetSlot` | function | One ordinary sole-child container; all candidates use existing content and clock ownership. |
| `SequenceController` | interface | Receiver-checked owned handle; time is driven only by its genuine Engine. |
| `SequenceControllerEvent` | type | An event a sequence controller reports: a marker it passed, or the end of its plays. |
| `SequenceControllerOptions` | interface | How a sequence controller plays: how many times, how fast, which markers it reports and where. |
| `SequenceControllerState` | type | Whether a sequence controller is idle, running, paused, completed, stopped or faulted. |
| `SequenceControllerStatus` | interface | Where a sequence controller is: its state, its time and position, and its last sample and issue. |
| `SequenceEventSource` | type | What caused a controller event: starting, the clock, a seek or a control call. |
| `SequenceMarker` | interface | Immutable authored marker; its input index breaks equal-time ties. |
| `SequenceResetActive` | interface | The sequence a reset slot shows now, and whether the slot owns it or borrows it. |
| `SequenceResetInitial` | interface | The sequence a reset slot starts with: its version label, its bitmap and its controller. |
| `SequenceResetRequest` | interface | A request to replace a slot's sequence with another version, loaded from a content loader. |
| `SequenceResetSlot` | interface | Holds a bitmap's sequence and replaces it with a new version without a gap. |
| `SequenceResetState` | type | Where a reset request is: loading, ready, prepared, committed, cancelled or failed. |
| `SequenceResetTicket` | interface | One pending replacement: wait for it to be ready, then commit it or dispose of it. |
| `SequenceSeekRequest` | interface | Where to seek to, and whether the events passed over are reported. |

## `@egret/engine/paragraph`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createParagraph` | function | Optional paragraph assembly authenticates Engine, Scope and exact cache profile. |
| `createParagraphCache` | function | A fixed optional profile shares Engine/AssetManager leases and their shutdown authority. |

## `@egret/engine/web/paragraph`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `CanvasKitFontSetProvider` | interface | Loads font sets for CanvasKit paragraphs. |
| `CanvasKitFontSetProviderOptions` | interface | A CanvasKit font set provider to make: its CanvasKit and build identity. |
| `CanvasKitParagraphFont` | interface | One font for CanvasKit paragraphs: its family, bytes and identity. |
| `CanvasKitParagraphModule` | interface | Minimal host-injected CanvasKit port. |
| `CanvasKitParagraphProvider` | interface | Lays out and draws paragraphs with CanvasKit; dispose of it when done. |
| `CanvasKitParagraphProviderOptions` | interface | A CanvasKit paragraph provider to make: its CanvasKit, build identity and fonts. |
| `CanvasParagraphCanvas` | interface | What the provider draws with: a canvas whose 2D context measures and fills words. |
| `CanvasParagraphContext` | interface | The part of a 2D context the provider uses. |
| `CanvasParagraphProvider` | interface | Lays out and draws paragraphs with a canvas's 2D context; dispose of it when done. |
| `CanvasParagraphProviderOptions` | interface | A canvas paragraph provider to make. |
| `chooseParagraphProvider` | function | Creates the paragraph provider the device can afford. |
| `createCanvasKitFontSetProvider` | function | A stable cache provider routes immutable generations; it never mutates a live native font table. |
| `createCanvasKitParagraphProvider` | function | Lays out and draws paragraphs with CanvasKit and the fonts it is given. |
| `createCanvasParagraphProvider` | function | Lays out and draws paragraphs with a canvas's 2D context, with no WebAssembly. |
| `ParagraphBackend` | type | The two paragraph providers of `@egret/engine/web/paragraph`. |
| `ParagraphBackendReason` | type | Why a provider was chosen. |
| `ParagraphDevice` | interface | What the choice reads of the device. |
| `ParagraphFontSet` | interface | A set of fonts loaded for paragraphs: its key and families; dispose of it when done. |
| `ParagraphProviderChoice` | interface | The provider chosen, which of the two it is, and why. |
| `ParagraphProviderChoiceOptions` | interface | How to choose: which provider is wanted, how to load CanvasKit, and the canvas provider's options. |

## `@egret/engine/web/keyboard`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createBrowserKeyboardInput` | function | Canvas-local native keyboard bridge. |
| `KeyboardCancelPayload` | interface | A key that was let go of without its key up, and why. |
| `KeyboardCancelReason` | type | Why a held key was let go of without its key up. |
| `KeyboardFocusChange` | interface | Focus that moved: from which target to which, why, and whether it is shown. |
| `KeyboardFocusOptions` | interface | How focus is given: whether it is shown, and why it moved. |
| `KeyboardFocusPayload` | interface | A target that gained or lost focus, the other target, why, and whether focus is shown. |
| `KeyboardInput` | interface | Synchronous logical focus; text editing and IME are outside this channel. |
| `KeyboardInputEvents` | interface | The event types keyboard input dispatches: key down and up, cancel, and focus in and out. |
| `KeyboardInputOptions` | interface | Keyboard input to make: its engine and scope, its limits, and what is called when focus moves. |
| `KeyboardInputSnapshot` | interface | Keyboard input as it is now: its state, the focused target, and the keys held. |
| `KeyboardKeyPayload` | interface | A key event and the target it went to. |
| `KeyboardSample` | interface | One key as the host gives it: its code and key, whether it repeats, and the modifiers held. |
| `KeyboardTargetOptions` | interface | A target to register: its id, its display object, its place in Tab order and whether it is disabled. |
| `KeyboardTargetRegistration` | interface | A registered target: change it, or dispose of it to take it out. |

## `@egret/engine/web/text-input`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserTextInput` | interface | A native text field over the canvas, for typing with the platform's keyboard and input methods. |
| `BrowserTextInputChange` | interface | The value after a change, and whether a composition is under way. |
| `BrowserTextInputEnterHint` | type | What the Enter key of an on-screen keyboard says. |
| `BrowserTextInputMode` | type | Which on-screen keyboard to ask for. |
| `BrowserTextInputOptions` | interface | Browser text input to make: its canvas and size, the element it goes into, and whether keys are kept from the game. |
| `BrowserTextInputRectangle` | interface | Rectangle in logical stage units, the units of the display tree and of pointer input. |
| `BrowserTextInputRequest` | interface | One editing session. |
| `BrowserTextInputSnapshot` | interface | Browser text input as it is now: its state, value and composition. |
| `createBrowserTextInput` | function | Platform text entry over a canvas: a native field placed on a rectangle of the stage, so that input methods (Chinese, Japanese, Korean), on-screen keyboards, paste and accessibility work as the platform provides them. |

## `@egret/engine/web/wechat-text-input`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createWechatTextInput` | function | Text input through WeChat's keyboard, with the object of `createBrowserTextInput`. |
| `WechatKeyboard` | interface | The part of `wx` the text input uses. |
| `WechatKeyboardEvent` | interface | What a keyboard event of WeChat carries: the text in the keyboard's field. |
| `WechatKeyboardListener` | type | A listener of WeChat's keyboard events. |
| `WechatTextInputOptions` | interface | WeChat text input to make: the keyboard to use, and where errors of the game's callbacks go. |

## `@egret/engine/ui/editing`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createUiTextEditor` | function | A text editor drawn by the engine, its text and selection kept by the platform's text input. |
| `TextEditSelection` | interface | Source offsets are UTF-16, never glyph indices or guessed advance widths. |
| `UiTextEditor` | interface | A text editor: its content, the calls that set its value, selection and style, and the geometry of its text. |
| `UiTextEditorChange` | interface | A change to a text editor's content or selection, and what made it. |
| `UiTextEditorFontSet` | interface | Fonts for an editor as a font provider gives them, such as a set of `createBrowserEditorFontProvider`. |
| `UiTextEditorOptions` | interface | A text editor to make: its engine, scope and cache, its mode, value and limits, its style and size, and what it calls. |
| `UiTextEditorSetOptions` | interface | How a value is set: the selection after it, the revision it expects, and whether a composition is cancelled. |
| `UiTextEditorSnapshot` | interface | A text editor as it is now: its content revision, style, and whether the native editor shows. |
| `UiTextEditorStyle` | interface | How a text editor's text looks: its fonts and size, line height, locale and direction, colors and alignment. |
| `UiTextEditorStyleInput` | interface | A style to give an editor: as its style, but `fontSet` may be the font set itself, whose key is taken, and whose families are taken unless `fontFamilies` is given. |
| `UiTextEditorTarget` | type | What a text editor is drawn in: a leaf of the tree, or a row of a list. |

## `@egret/engine/web/editing`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserEditorFontProvider` | interface | Loads font sets for browser text editors. |
| `BrowserEditorFontProviderOptions` | interface | An editor font provider to make: its engine and scope, its paragraph provider and deadline. |
| `BrowserEditorFontSet` | interface | Fonts loaded for a text editor: its key, families and identities; dispose of it when done. |
| `BrowserTextEditor` | interface | A UI text editor edited through a native element over the canvas: activate, finish or cancel editing. |
| `BrowserTextEditorOptions` | interface | A browser text editor to make: its editor, root and target, its canvas, fonts and size, its label and keyboard, and what it calls. |
| `BrowserTextEditorSnapshot` | interface | A browser text editor as it is now: its state, revisions, native element and font. |
| `createBrowserEditorFontProvider` | function | CSS registration is a consumer of existing immutable font resources, not another asset cache. |
| `createBrowserTextEditor` | function | One visible native editor over an authenticated committed UI binding. |
| `EditorParagraphFontLoader` | interface | Loads the paragraph fonts a text editor uses. |

## `@egret/engine/input/hover`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createHoverInput` | function | Hover and wheel routing over the display tree of a started Engine. |
| `HoverInput` | interface | Scope-owned hover and wheel routing for an explicitly supplied logical host stream. |
| `HoverInputEvents` | interface | The event types hover input dispatches: enter, move, leave and wheel. |
| `HoverInputOptions` | interface | Hover input to make: its engine and scope, the surface's size, its limits, and what is called. |
| `HoverInputState` | type | Whether hover input passes input on, holds it, or has closed. |
| `HoverLeaveReason` | type | Why a target stopped being hovered: the pointer went to another target or to none, left the surface, pressed, or was cancelled by the platform; the target stopped being a possible target; the mapping of the surface changed; the window or the page went away; or the input was suspended, disposed or failed. |
| `HoverNotification` | interface | A target that a pointer entered, moved over or left, and why it left. |
| `HoverPoint` | interface | A retained value: sequence orders every hover and wheel observation of this input. |
| `HoverPointerType` | type | Pointers that can be over the scene without pressing it. |
| `HoverSample` | interface | A pointer moving over the surface without a press: which pointer, where and when. |
| `HoverState` | interface | Where a pointer hovers and the target under it. |
| `HoverTransition` | interface | A point of an enter or a leave, with the other end of the movement when there is one. |
| `WheelNotification` | interface | A wheel turn and the target it went to, and whether that target took it. |
| `WheelPoint` | interface | A wheel sample in order, with the viewport it was taken in. |
| `WheelSample` | interface | A turn of a wheel: where the pointer is, how far it turned in each axis, in what unit and when. |
| `WheelUnit` | type | What a wheel's deltas count: pixels, lines or pages. |

## `@egret/engine/web/hover`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserHoverInputOptions` | interface | Browser hover input to make: its canvas, how far a page of wheel scrolls, and what is called on an error. |
| `createBrowserHoverInput` | function | Hover and wheel of the page for the canvas of a started Engine, in the same connected, untransformed profile as the pointer adapter. |
| `WheelPagePolicy` | type | Whether a wheel over the canvas also scrolls the page: only when nothing consumed it, never (the canvas owns the wheel), or always (the listener is passive and cannot hold the page). |

## `@egret/engine/input/gamepad`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `bindGamepadKeys` | function | Drives a keyboard input from the pads: the keys a UI already answers, held and repeated as a pad holds them. |
| `createGamepadInput` | function | Pads as a stream of samples a host gives it: what is held, how far a stick is pushed, and what changed since the last look. |
| `GamepadButtonChange` | interface | A button that was pressed or released: on which pad, which button, how far and when. |
| `GamepadButtonName` | type | The buttons of a pad in the standard layout, by where they are: `a` is the lower face button. |
| `GamepadButtonSample` | interface | A gamepad button now: whether it is pressed, and how far, 0 to 1. |
| `GamepadConnectionChange` | interface | A gamepad that was connected or disconnected: its pad, id, mapping and time. |
| `GamepadInput` | interface | Pads as a stream of samples. |
| `GamepadInputOptions` | interface | How gamepads are read: the dead zone, how many pads, and what is called on buttons and connections. |
| `GamepadKeyAction` | type | What a button does: a key, with the way the focus moves when nobody took the key; or a move of the focus alone. |
| `GamepadKeys` | interface | Keyboard keys held by a gamepad; dispose of it to release them. |
| `GamepadKeysOptions` | interface | How a gamepad presses keyboard keys: which pad, the map of buttons and stick to keys, and the repeat. |
| `GamepadKeyTarget` | interface | The part of a keyboard input that a pad drives. |
| `GamepadPad` | interface | A pad that is connected, as of the last sample. |
| `GamepadSample` | interface | What a host says of one pad at one moment. |
| `GamepadStick` | interface | Where a stick points, each axis -1 to 1, with the dead zone taken out. |
| `GamepadStickName` | type | Which stick of a gamepad: the left or the right. |

## `@egret/engine/web/gamepad`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserGamepadInput` | interface | Gamepads read from the browser: poll them each frame, and make one rumble. |
| `BrowserGamepadInputOptions` | interface | Browser gamepad input to make: what is called on an error. |
| `createBrowserGamepadInput` | function | The pads of a page. |
| `GamepadRumble` | interface | A rumble to play: how long, and how strong its weak and strong motors run. |

## `@egret/engine/camera`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `Camera2D` | interface | A view of a 2D world: where it looks, how close, what it follows, and how it shakes. |
| `Camera2DOptions` | interface | A 2D camera to make: the world it moves, the view's size, where it looks and how far it zooms, its bounds and its shake. |
| `CameraFollowOptions` | interface | How the camera follows a target: how smoothly, the box it may move in unfollowed, and the offset. |
| `CameraLayerOptions` | interface | How a layer moves and zooms with the camera, for parallax. |
| `CameraPoint` | interface | A point in world coordinates. |
| `CameraRect` | interface | A rectangle in world coordinates. |
| `CameraShakeOptions` | interface | How much a shake adds to the camera's trauma. |
| `CameraSnapshot` | interface | The camera as it is now: where it looks, its zoom and rotation, its trauma and its view. |
| `CameraTarget` | type | What the camera follows: a display object inside the world, or a function that says where to look. |
| `createCamera2D` | function | A camera over a container that holds the world. |

## `@egret/engine/tilemap`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createTileMap` | function | A map drawn from its tilesets. |
| `importTiledMap` | function | Reads a map saved by Tiled as JSON (`.tmj`, or `.json`), orthogonal, with tile layers as arrays or as base64 without compression, finite or infinite, object layers and groups. |
| `ObjectLayerData` | interface | A layer of objects: its name, offset, opacity and objects. |
| `TILE_FLIP_MASK` | value | The top three bits of a global id say how the tile is turned; the rest is the id. |
| `TileAnimationFrame` | interface | One frame of an animated tile: the tile it shows and for how long. |
| `TiledImportOptions` | interface | Tilesets kept in files of their own, for importing a map from Tiled. |
| `TileInfo` | interface | What a cell holds: its tile, tileset and flips, and the tile's properties. |
| `TileLayerData` | interface | A layer of tiles: its name, size, offset, opacity and parallax, and its tiles' global ids. |
| `TileMap` | interface | A map drawn: one container for each tile layer, cut into chunks of meshes that can be left out when they cannot be seen. |
| `TileMapChunk` | interface | A chunk of a layer drawn as one: its first cell, whether it shows, and its meshes. |
| `TileMapData` | interface | A map as plain, frozen data: what a tile map is made from. |
| `TileMapLayer` | interface | A layer as drawn: its name and data, its display object and its chunks. |
| `TileMapLayerData` | type | A layer of a map: tiles or objects. |
| `TileMapObject` | interface | An object of an object layer: its place and size, its shape or tile, its text and properties. |
| `TileMapOptions` | interface | A tile map to make: its map, its tileset textures and the size of its chunks. |
| `TileMapProperties` | type | The properties of a map, layer, tile or object, by name. |
| `TileMapPropertyValue` | type | The value of a tile map property. |
| `TileSetData` | interface | A tileset: its tiles' size and count, its image, and the properties and animations of its tiles. |

## `@egret/engine/particles`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createParticleEmitter` | function | A stream of particles over one texture, drawn as one mesh that is built again each update. |
| `ParticleBurstSite` | interface | A place and a count for one burst in a batch. |
| `ParticleEmitter` | interface | Particles drawn as one mesh. |
| `ParticleEmitterOptions` | interface | An emitter to make: its texture and how many particles, and how they are born, move, grow, fade and turn. |
| `ParticleRange` | type | A value picked once for each particle, evenly between the two ends; a number is both ends. |
| `ParticleShape` | type | Where particles are born, around the place of the emitter. |
| `ParticleSnapshot` | interface | An emitter as it is now: how many particles live, were born and were refused, and its time. |
| `ParticleView` | interface | One live particle: where it is and how fast it moves, its age, scale, alpha, color and rotation. |

## `@egret/engine/physics2d`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createPhysicsWorld` | function | A world of bodies that move, meet and push each other apart, in fixed steps, without turning. |
| `PhysicsBody` | interface | A body in the physics world: its place and motion, its material and layers, and the calls that push it. |
| `PhysicsBodyKind` | type | A static body never moves; a kinematic one moves by its speed alone and pushes; a dynamic one is moved by everything. |
| `PhysicsBodyOptions` | interface | A body to add: its kind and shape, where it is and how it moves, its material, its layers and what it moves. |
| `PhysicsContact` | interface | Two bodies that began or ended touching, with the normal between them. |
| `PhysicsJoint` | interface | A joint of the world: its kind, its bodies and its length, which can change, as a rope that is wound in. |
| `PhysicsJointOptions` | interface | A joint to add between two bodies, or between a body and a fixed point of the world. |
| `PhysicsMoveResult` | interface | Where a moved body ended up, and the normals of what it hit on the way. |
| `PhysicsRayHit` | interface | What a ray hit: the body, where, its normal, and how far along the ray. |
| `PhysicsShape` | type | A shape about the place of its body. |
| `PhysicsSnapshot` | interface | The physics world as it is now: its bodies, contacts and steps. |
| `PhysicsTileColliders` | interface | A grid of solid tiles to collide with: its size in tiles, its tile size, which are solid and where it is. |
| `PhysicsVector` | interface | A 2D vector of the physics world. |
| `PhysicsWorld` | interface | A world of 2D bodies that collide, without turning: simple, steady physics for a 2D game. |
| `PhysicsWorldOptions` | interface | A physics world to make: its gravity, its step and iterations, and its limits. |

## `@egret/engine/bitmapfont`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BitmapFont` | interface | A bitmap font read from a file: frozen, with its characters and the kerning between pairs of them. |
| `BitmapGlyph` | interface | One character of a bitmap font: where it is on its page, where it is drawn from the pen, and how far the pen goes on. |
| `BitmapText` | interface | Text drawn in a bitmap font, as one mesh for each page it uses. |
| `BitmapTextGlyph` | interface | One character placed: its rectangle in the text and its rectangle on its page. |
| `BitmapTextLayout` | interface | Text laid out in a font, from its top left. |
| `BitmapTextLayoutOptions` | interface | How bitmap text is laid out: its width, alignment, spacing and kerning, and the character to fall back on. |
| `BitmapTextLine` | interface | One laid out line of bitmap text: its characters, width and place. |
| `BitmapTextOptions` | interface | Bitmap text to make: its font, pages, text and color, and how it is laid out. |
| `createBitmapText` | function | Draws text in a bitmap font as one mesh for each page it uses, laid out again whenever what it shows changes. |
| `layoutBitmapText` | function | Lays text out in a bitmap font without drawing it: its lines, where each character goes, and its size. |
| `parseBitmapFont` | function | Reads a bitmap font: the text, XML or JSON forms of BMFont (from AngelCode's generator, Hiero, Glyph Designer, Littera and the like), or Egret's own JSON of frames. |

## `@egret/engine/video`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createVideo` | function | A video as a display object: each new picture its source gives becomes, through the Engine's assets, the texture of one Bitmap. |
| `Video` | interface | A video shown as a display object: each new picture of its source becomes the texture of one Bitmap. |
| `VideoFrame` | interface | One picture of a video, the time of the video it shows. |
| `VideoOptions` | interface | A video to show: the asset manager that leases its pictures, and its source. |
| `VideoSnapshot` | interface | A video as it is now: its state, its pictures shown and skipped, and its times. |
| `VideoSource` | interface | What a video player reads its pictures from and is driven through. |
| `VideoSourceState` | type | Where a source is: still opening, able to show a frame, playing, paused, at its end, or unable to play. |
| `VideoState` | type | Whether a video is loading, ready, playing, paused, ended, failed or closed. |

## `@egret/engine/web/video`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserVideo` | interface | A video played by a video element, its pictures leased as textures. |
| `BrowserVideoOptions` | interface | A browser video to make: its assets, its source or stream or element, and whether it loops, is muted and how loud. |
| `BrowserVideoSource` | interface | One file of a film offered in several: its address and, when known, its media type. |
| `createBrowserVideo` | function | A video played by a page's video element and shown as a display object. |

## `@egret/engine/web/loop`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserFrameLoop` | interface | Steps the Engine and draws a frame on each animation frame of the browser. |
| `BrowserFrameLoopOptions` | interface | A frame loop to run: its engine, frame and host, its update, how long a step and a catch-up may be, and its frame requests. |
| `BrowserFrameLoopSnapshot` | interface | A frame loop as it is now: its state, its steps, frames and skipped frames, its seconds and any failure. |
| `BrowserFrameLoopState` | type | Whether a frame loop is idle, running, failed or closed. |
| `BrowserFrameTiming` | interface | An observational CPU sample for one browser callback. |
| `createBrowserFrameLoop` | function | The frame loop of a game in a page. |
| `FrameLoopEngine` | interface | What the loop asks of an Engine: its clock's limit, time and frames. |
| `FrameLoopHost` | interface | What the loop asks of a Host: how many frames it holds that it has not finished. |

## `@egret/engine/web/screen`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `isScreenPin` | function | Whether `pin` is a pin: only its six names, finite numbers, and at most one of each axis. |
| `pinBox` | function | Where `box` goes in `area` by `pin`: the place of its top left corner, in the units of both. |
| `planScreen` | function | Fits a stage to a space on a screen. |
| `ScreenFit` | type | How a stage fills a space: see `ScreenPlanOptions.fit`. |
| `ScreenInsets` | interface | How far in from each edge a notch, rounded corners or a home bar reach, in the pixels of the space given. |
| `ScreenPin` | interface | Where a box is held in an area: on each axis a distance in from one edge, or from the middle. |
| `ScreenPlan` | interface | Where the stage goes, and what of it is shown and safe to touch. |
| `ScreenPlanOptions` | interface | What to fit: the space on the screen, the designs, how they fit and what covers the edges. |
| `ScreenRect` | interface | A rectangle in stage units. |
| `ScreenSize` | interface | A width and a height above 0. |
| `ScreenUiScale` | interface | Bounds on the screen's CSS pixels per unit of an independently laid-out interface. |

## `@egret/engine/kit`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `ASSET_BUNDLE_HEADER_BYTES` | value | How many bytes from the start must be read to know the index's length: the header. |
| `assetBundleCheck` | function | FNV-1a over the bytes, as eight hex digits. |
| `AssetBundleEntry` | interface | One file in an asset bundle: its name, where its bytes are, its type and tags, and its check. |
| `AssetBundleIndex` | interface | The table of an asset bundle: its size, where its data begins, and its entries. |
| `AssetBundleInput` | interface | One file to put in a bundle. |
| `AudioCueDefinition` | interface | A named sound effect: its takes, its bus and volume, and how often and how many at once it plays. |
| `AudioCuePlayOptions` | interface | How one play of a cue differs: its volume, pan and rate. |
| `AudioCues` | interface | Sound effects by name, each with its takes, cool-down and voice limit. |
| `AudioCuesOptions` | interface | The clock and the random numbers cues choose by; give your own for tests and replays. |
| `createAudioCues` | function | Names the sound effects of a game over `mixer`. |
| `createInputActions` | function | Makes the actions of `map`. |
| `createMemorySaveStorage` | function | Storage kept in memory: for tests, for a page without browser storage, or for a game played once. |
| `createRandom` | function | A generator from a seed (a number or string) or a saved state. |
| `createSaveStore` | function |  |
| `createTextTable` | function | Makes a table of a game's words in its languages. |
| `describeInputBinding` | function | A readable name for a binding, for settings screens: `Key:KeyW` is `W`, `Mouse:0` is `Left button`. |
| `encodeWav` | function | 16-bit PCM WAV bytes from channels of samples between -1 and 1, all the same length. |
| `hashSeed` | function | Turns a string or number into a 32-bit seed. |
| `HeadlessGame` | interface | What a headless run needs of a game: its state and one step of its rules. |
| `HeadlessRunOptions` | interface | A game run without a screen: the game and player to make for each seed, when it is done, and the step. |
| `HeadlessRunResult` | interface | What one seed's headless run did: whether it finished, its seconds and steps, its timings and its summary. |
| `InputActionDefinition` | interface | An action and the controls that drive it. |
| `InputActionKind` | type | Whether an action is a button, one axis, or a vector of two. |
| `InputActionMap` | type | Actions by name, with the controls that drive each. |
| `InputActions` | interface | Named actions driven by keys, buttons and sticks: what is pressed now, values, rebinding and saving. |
| `InputBinding` | type | One physical control, written as a short string: `Key:KeyW` (a `KeyboardEvent.code`), `Mouse:0` (a button number), `Pad:a` or `Pad:7` (a standard gamepad button name or number), `Pad:leftStick` / `Pad:rightStick` (a stick, for vector actions), `Pad:leftStickX+` (one half of a stick axis, for buttons and axes), and `Touch:<name>` for an on-screen control. |
| `InputBindingSlot` | type | A slot of an action that a binding can be put in: `bindings`, `negative`, `positive`, `up`, ... |
| `InputBindingsSave` | interface | Bindings as saved, to load back with `loadBindings`. |
| `InputVector` | interface | The value of a vector action, each axis -1 to 1. |
| `pickLanguage` | function | The language of `languages` that best matches what the player's browser or system asks for (`navigator.languages`, given here as a list, such as `['zh-CN', 'en']`): an exact match first, then the same main language (`zh-TW` asks for `zh`). |
| `pickQualityFiles` | function | Names of the form `<base>-<tier>.<ext>` grouped by base and chosen for `quality`, as a bundle or a folder lists them: `hero-high.glb`, `hero-low.glb` and `hall.webp` give `hero-low.glb` (for `medium`) and `hall.webp`. |
| `pickQualityVariant` | function | Of several variants of one asset, the one for `quality`: an exact tier, or else the nearest below, or else the nearest above. |
| `planAssetBundleRanges` | function | Ranges of the file that hold the named entries, joined where they touch or lie within `gap` bytes. |
| `QUALITY_TIERS` | value | Quality tiers from lowest to highest, as World3D names them. |
| `QualityTier` | type | One of the quality tiers, from the lowest to the highest. |
| `Random` | interface | Random numbers from a seed, repeatable: numbers, ranges, choices, shuffles and normal values. |
| `RandomState` | type | Four 32-bit words. |
| `readAssetBundleHeader` | function | The index length a header gives, so a reader can ask for exactly the bytes of the index. |
| `readAssetBundleIndex` | function | The index of a bundle from its first bytes: at least the header and the index. |
| `runHeadless` | function | Plays the game once per seed with the stand-in player and reports each run. |
| `SaveProblem` | interface | A problem with a save: what kind, which key, and its cause. |
| `SaveProblemKind` | type | What went wrong with a save: unreadable, invalid, too new or too old, or a migration or write that failed. |
| `SaveRule` | type | What a field must be beyond the type of its default: one of a list of values, a number in a range (`int` for a whole number), or a check of one's own. |
| `SaveShape` | interface | The check and the fill of a save of the shape of its defaults. |
| `SaveStorage` | interface | Where a save is kept: strings by key. |
| `SaveStore` | interface | A saved value: read it, change it and save it, reset or remove it, export or import it. |
| `SaveStoreOptions` | interface | A save to keep: its key and version, its defaults and migrations, its check and its storage. |
| `shapeOf` | function | The check and the fill of a save whose new game is `defaults` (the data, or the function a save store is given). |
| `sliceAssetBundle` | function | The bytes of one entry from bytes of the bundle that start at `start` (0 for the whole file), checked against the index. |
| `TextTable` | interface | A game's words in its languages: the current one, a word by key, and who is told when the language changes. |
| `TextTableOptions` | interface | A text table to make: the words of each language, the language to start in and the one to fall back to. |
| `TextTableWords` | type | The words of one language, by key. |
| `writeAssetBundle` | function | One file holding every input, in the order given, each starting at a multiple of four bytes. |

## `@egret/engine/web/kit`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `bindBrowserInputActions` | function | Listens to the page for the controls of `actions`. |
| `BrowserAssetBundle` | interface | An asset bundle opened in the browser: its index and entries, and calls that read an entry's bytes. |
| `BrowserAssetBundleOptions` | interface | An asset bundle to open: how it is fetched and from where, whether it is read whole, and the cache it is kept in. |
| `BrowserDecodedImage` | interface | A decoded image: its source, size, and a call that releases it. |
| `BrowserImageCanvas` | interface | A canvas to draw a decoded image into. |
| `BrowserImageContext` | interface | The drawing context of such a canvas: draw an image and read its pixels. |
| `BrowserImageFormat` | type | The picture formats the browser route recognises by their first bytes. |
| `BrowserImageOptions` | interface | How images are decoded: the largest size accepted, and the ports used. |
| `BrowserImagePorts` | interface | How the browser makes a canvas and decodes an image, for image textures. |
| `BrowserImageSource` | type | What `textureFromCanvas` and `decodeBrowserImage` can read pixels from. |
| `BrowserImageTextureProviderOptions` | interface | Where an image texture provider reads the bytes of each image from. |
| `BrowserInputActions` | interface | Input actions driven by the browser's keys, pointers and gamepads: poll them each frame. |
| `BrowserInputActionsOptions` | interface | Where input actions read the browser: which element takes keys and pointers, whether gamepads count, and which keys pass through. |
| `browserLanguages` | function | The languages the player's browser asks for, most wanted first, such as `['zh-CN', 'en']`; empty where unknown. |
| `browserSaveStorage` | function | The page's local storage as a save storage, or a memory stand-in where the page has none (a private window, a blocked site): every call is guarded, so a save never throws for want of storage. |
| `BrowserTextDownloadOptions` | interface |  |
| `BrowserTextFile` | interface | A text file explicitly chosen by the player. |
| `BrowserTextFileOptions` | interface |  |
| `BundleCache` | interface | Where fetched bundle entries are kept between visits; used as `cache` of `openBrowserAssetBundle`. |
| `createBrowserImageTextureProvider` | function | An asset provider that reads bytes with `readBytes` and decodes them with the browser. |
| `createTouchButton` | function | Makes `element` an on-screen button that holds `binding` (such as `Touch:jump`) while a finger is on it. |
| `createTouchStick` | function | A stick that appears where a finger lands in its zone of `element` and follows it. |
| `decodeBrowserImage` | function | Decodes PNG, JPEG, WebP, GIF or AVIF bytes with the browser and returns a texture of them. |
| `downloadBrowserTextFile` | function | Offer the caller's text as a local download from a fresh user activation. |
| `fitBrowserImageSize` | function | The size a picture is read at: its own, or scaled down evenly to fit both limits. |
| `IndexedDBSaveStorage` | interface | Save storage kept in IndexedDB: flush pending writes, and close it. |
| `IndexedDBSaveStorageOptions` | interface | IndexedDB save storage to open: its database name, the IndexedDB to use, and what is called on an error. |
| `openBrowserAssetBundle` | function | Opens the bundle at `url`, reading its index. |
| `openBrowserBundleCache` | function | A bundle cache in the Cache API under `name`. |
| `openIndexedDBSaveStorage` | function | A save storage over IndexedDB. |
| `pickBrowserTextFile` | function | Show the platform's single-file chooser from a fresh user activation. |
| `prefersReducedMotion` | function | Whether the player has asked the system for less motion (`prefers-reduced-motion: reduce`): then leave out shakes, flashes, parallax and large moves that are only for show. |
| `sniffBrowserImageFormat` | function | The picture format the bytes start with, or undefined when they start like none of them. |
| `textureFromCanvas` | function | Reads a canvas, image or bitmap as a texture of straight RGBA bytes, scaled down when it is larger than the limits. |
| `TouchControl` | interface | Touch controls on the page: their elements; dispose of them to take them off. |
| `TouchStickOptions` | interface | A touch stick to put on the page: its binding, radius, the zone it appears in and its class. |
| `watchReducedMotion` | function | Calls `listener` with the new answer whenever the player changes it. |

## `@egret/engine/web/game`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserGame` | interface | A game in a canvas: its Engine, host and stage, its frame loop and input, and calls that load textures and make labels. |
| `BrowserGameAtlasLabel` | interface | A line of text drawn on a page of images shared with other such labels. |
| `BrowserGameBackend` | type | Which GPU interface a browser game draws with. |
| `BrowserGameFit` | type | How the canvas fills the element it is in: not at all, whole inside it, covering it, stretched to it, filling it with a stage that grows around the design (`'expand'`), or filling it as the stage scale modes of Egret 5 did (`'fixedWidth'`, `'fixedHeight'`, `'fixedNarrow'`, `'fixedWide'`; see `planScreen` of `@egret/engine/web/screen`). |
| `BrowserGameFrameTiming` | interface | A loop sample with the game's image-budget refusal distinguished from a submitted frame. |
| `BrowserGameFrameUsage` | interface | What the last frame drawn held of a frame's images, against what one frame may hold. |
| `BrowserGameGlyphFont` | interface | Spread font and pages into createBitmapText; retire all borrowers before releasing the shared page. |
| `BrowserGameGlyphFontOptions` | interface |  |
| `BrowserGameLabel` | interface | A line of text on the stage whose words can be set like a value. |
| `BrowserGameLabelCreateOptions` | interface | A label to make: its words and style, and the scope that owns it. |
| `BrowserGameLabelOptions` | interface | A text label to make: its text, font, size and weight, line height, color, locale and direction. |
| `BrowserGameOptions` | interface |  |
| `BrowserGameParagraphLabel` | interface |  |
| `BrowserGameParagraphLabelCreateOptions` | interface | The initial wrapping width is required; ownership defaults to the game's scope. |
| `BrowserGameParagraphLabelOptions` | interface | Style and width for a wrapped native label. |
| `BrowserGameRenderMode` | type | Continuous presentation or a retained frame, with the same simulation clock in either mode. |
| `BrowserGameStartupTiming` | interface | Wall-clock preparation durations, and the first accepted SDK submission (not GPU completion or presentation). |
| `BrowserGameWarning` | interface | Something to know before it shows: `FRAME_IMAGES_NEAR_LIMIT` when a frame holds four fifths of what a frame may hold of images, `FRAME_IMAGE_BUDGET` when a frame held more and was not drawn (the loop goes on), `LABEL_NOT_DRAWN` when a label's words could not be drawn, `LABEL_CACHE_NEAR_LIMIT` when the labels hold four fifths of the text cache, and from `play`, `PLAY_MADE_EVERY_FRAME` when `update` made a text, a shape or a sprite in each of the last 60 frames. |
| `BrowserStatsPanel` | interface | A panel over the canvas showing frame rate and frame times: sample each frame. |
| `BrowserStatsPanelOptions` | interface | A stats panel to make: the canvas it sits over, its label, and how often it updates. |
| `BrowserStatsSample` | interface | What a game knows at one frame of the display. |
| `BrowserStatsSnapshot` | interface | The numbers the panel shows, as of its last refresh. |
| `createBrowserGame` | function | Makes a game ready to draw: `await createBrowserGame({ canvas, width, height, update })`, then add display objects to `game.stage`. |
| `createBrowserStatsPanel` | function | Puts a panel over the canvas that shows frame rate and frame times. |

## `@egret/engine/play`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `composeMusic` | function | Writes a piece. |
| `isSfxRecipe` | function | Whether a value is a recipe `synthesizeSfx` takes. |
| `MUSIC_MOODS` | value | The moods play music can be made in. |
| `MUSIC_PARTS` | value | The parts of a piece, from the quietest moment to the most intense. |
| `musicMix` | function | How loud each part is at an intensity from 0 to 1: the pad always, then the bass, the drums and the tune. |
| `MusicMood` | type | The moods there are. |
| `MusicOptions` | interface | Music to make: its mood, seed, tempo and length in bars. |
| `MusicPart` | type | One part of a piece of play music. |
| `MusicPiece` | interface | A piece of music made from a seed: its mood, tempo, length and parts. |
| `play` | function | Starts a game in the page. |
| `PlayActivationSource` | type | Where an activation came from. |
| `PlayBar` | class | A bar of health, time or power. |
| `PlayBarOptions` | interface | A bar to show, as for health: where and how large, its value and maximum, its colors and layer. |
| `PlayBurstOptions` | interface | A burst of particles: its color and count, how fast and how long they fly, their size and gravity. |
| `PlayButton` | type | A button: a sprite whose middle is at (x, y), with its words in `label`. |
| `PlayButtonOptions` | interface | A button to show: where, how large, its colors, text size and layer. |
| `PlayFloatingStickOptions` | interface | A floating stick starts under a fresh touch in this part of the Play design. |
| `PlayGame` | interface | Everything a small game is given: its world, UI and view, keys and pointer, sound and random numbers, and calls that make, move, test and time things. |
| `PlayImageOptions` | interface | An image to show: where, how large, whether smoothed, and its layer. |
| `PlayKeys` | interface | The keyboard of a play game: what is held, pressed and released, and axes from the arrow and WASD keys. |
| `PlayMenuOptions` | interface | A menu to show: its title, where it goes, how wide and its color. |
| `PlayMotion` | type | A tween of `game.tween`: a motion that can be waited for. |
| `PlayMusic` | interface | The music of a play game: play or stop it, and set its intensity, volume and mood. |
| `PlayOptions` | interface | A whole small game to start: its size and background, where it goes on the page, its setup and update, its seed, backend and save key. |
| `PlayPin` | interface | A node held against the edges of the screen: `set` holds it otherwise, `dispose` lets it go. |
| `PlayPinOptions` | interface | What a node is pinned to: the safe part, unless given, or the whole screen. |
| `PlayPointer` | interface |  |
| `PlayPointerLockOptions` | interface | The pointer of a play game: where it is, what it pressed, swipes, wheel and pointer lock. |
| `PlayPointerLockResult` | interface |  |
| `PlaySayOptions` | interface | A line of dialogue: who says it, the choices offered, its color and how fast it types. |
| `PlaySelectChoice` | interface | A valued item in a native, scrollable selection dialog. |
| `PlaySelectOptions` | interface | The current selection, visible title, cancellation label and skin. |
| `PlaySfx` | interface | The sound effects of a play game: play or loop one by name, define new ones, and set the volume. |
| `PlayStickOptions` | interface | A touch stick to show: where, how large, and whether it shows without touch. |
| `PlayTapActivation` | type | The information supplied to game.onTap. |
| `PlayText` | class | A line of text: a sprite to place, fade, tween and remove like any other, with words that can be changed. |
| `PlayTextOptions` | interface | Text to show: where, how large, its color and alignment, whether bold, its layer, baseline and locale. |
| `PlayTiles` | interface | A map of tiles: read and change its cells, and push a sprite out of its solid ones. |
| `PlayTilesOptions` | interface | A map of tiles to make: the size of a tile, where its top left corner is, its colours, which characters are solid, and its layer. |
| `PlayToastHandle` | interface |  |
| `PlayToastOptions` | interface | A toast to show: duration, color and optional safe-area placement/skin. |
| `PlayToastPlacement` | interface | A notice's position in the safe area. |
| `PlayTouchButtonOptions` | interface | A touch button to show: where, the key it presses, how large, its color, and whether it shows without touch. |
| `PlayUiScale` | interface | The size on the screen that play's views keep: at least `min` and at most `max` CSS pixels a unit of theirs. |
| `PlayViewActivation` | type | The second argument of a view's tap binding; target and currentTarget are part names, if named. |
| `PlayViewEditOptions` | type | Native text input over the current clipped rectangle of a named view part. |
| `ScreenPin` | interface | Where a box is held in an area: on each axis a distance in from one edge, or from the middle. |
| `SFX_PRESETS` | value | The effects every game is given, by name. |
| `SfxRecipe` | type | An effect: one tone, or several played one after another. |
| `SfxTone` | interface | One tone of an effect. |
| `SfxWave` | type | The wave of a tone. |
| `synthesizeSfx` | function | The samples of an effect, one channel, from -1 to 1. |
| `verticalPlayWords` | function | Words written top to bottom in columns from right to left, as rows a line of text draws: one character under another, marks turned to their upright forms, a `\n` or `column` characters ending a column, and an ideographic space where a column is shorter than the longest. |
| `wrapPlayWords` | function | Breaks words into lines no wider than `units`: at a space where there is one, between any two wide characters. |

## `@egret/engine/audio`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `AudioBackend` | interface | What a host gives the mixer. |
| `AudioBackendBus` | interface | One gain on the way to the output. |
| `AudioBackendSound` | interface | Decoded samples held by the host, or a file it plays as it reads it. |
| `AudioBackendStart` | interface | What the mixer asks a backend to start: the sound, its bus, where and how it plays. |
| `AudioBackendVoice` | interface | One sound being played once. |
| `AudioBus` | interface | A group of voices with one volume and one mute, such as music or effects. |
| `AudioBusOptions` | interface | A bus to make: its name, its volume and whether it is muted. |
| `AudioBusSnapshot` | interface | A bus as it is now: its name, volume, mute and voices. |
| `AudioEndReason` | type | Why a voice is over: it reached its end; it was stopped; it gave its place to a newer voice; no place could be made for it; it was asked for while nothing could be heard; its sound was released; or the mixer was disposed. |
| `AudioFade` | interface | How long a change of volume takes. |
| `AudioMixer` | interface | Plays sounds and music on buses through a backend, within its limits of voices and memory. |
| `AudioMixerOptions` | interface | A mixer to make: its backend and buses, and how many voices, sounds and decoded bytes it holds. |
| `AudioMixerSnapshot` | interface | The mixer as it is now: its state, buses, voices, sounds, decoded bytes and music. |
| `AudioMixerState` | type | Whether sound comes out. |
| `AudioMusicOptions` | interface | How music is played: its bus, volume, fade, loop and start, and whether the same piece restarts. |
| `AudioPlayOptions` | interface | How a sound is played: its bus, volume, rate, pan, loop, start and fade. |
| `AudioSound` | interface | A sound the mixer can play: its length, channels and rate, and whether it is decoded or streamed. |
| `AudioVoice` | interface | One sound playing: its state and position, and the calls that change or stop it. |
| `AudioVoiceState` | type | Whether a voice is playing, paused, fading out to stop, or has ended. |
| `createAudioMixer` | function | Volumes, voices and one music over a backend that makes the sound. |

## `@egret/engine/web/audio`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserAudio` | interface | A sound mixer playing through Web Audio, with its context and output node. |
| `BrowserAudioGlide` | interface | An exponential approach to a parameter's new value, with a time constant in seconds. |
| `BrowserAudioInput` | interface | A mixer-owned input strip; its upstream generators, decoded buffers and transport are caller-owned. |
| `BrowserAudioInputOptions` | interface | Initial levels for an external input. |
| `BrowserAudioOptions` | interface | Browser audio to make: its audio context, what unlocks it, whether it pauses when the page is hidden, and its limiter. |
| `createBrowserAudio` | function | Sound for a page on Web Audio. |
| `createWebAudioBackend` | function | A Web Audio backend for a mixer the page makes itself with `createAudioMixer`: const backend = createWebAudioBackend(); const mixer = createAudioMixer({ backend, locked: backend.locked }); backend.attach(mixer); `createBrowserAudio` does these three steps in one call. |
| `WebAudioBackend` | interface | A backend for `createAudioMixer` that plays through Web Audio. |
| `WebAudioBackendOptions` | interface | The Web Audio half of browser sound alone: its output, what unlocks it, whether it pauses when hidden, its limiter. |

## `@egret/engine/ui/semantics`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createUiListSemantics` | function | Semantic nodes for a list control and its rows, kept in step with the control. |
| `createUiSemantics` | function | A semantic tree for the controls an application draws. |
| `SemanticAction` | type | What assistive technology may ask of a node: its activation, or the keyboard focus. |
| `SemanticBounds` | interface | A rectangle in the logical coordinates of the stage, the ones picking uses. |
| `semanticBoundsOf` | function | The rectangle on the stage that encloses a display object and what it holds, for the bounds of a node. |
| `semanticBoxOf` | function | The rectangle on the stage of a box a managed UI root laid out: a leaf, a row, a column or a list, by its id in the tree of the root. |
| `SemanticChecked` | type | Whether a node is checked, not checked, or partly checked. |
| `SemanticDescription` | interface | What a node is at this moment, read from the control that draws it. |
| `SemanticExtent` | interface | How many rows and columns a grid has in all, whether or not all of them are published. |
| `SemanticListRow` | interface | What one row of a list says: its name, whether it is selected or disabled, its level and its place. |
| `SemanticListSource` | interface | What is read of a managed UI root. |
| `SemanticNode` | interface | A node of the semantic tree; remove it to take it out. |
| `SemanticNodeOptions` | interface | A node to add: its id, role and parent, how it is described, and what it does when activated or focused. |
| `SemanticOrientation` | type | Whether a node runs across or down. |
| `SemanticPosition` | interface | Where an item stands in its whole set, from one. |
| `SemanticRange` | interface | The value of a range node and its least and greatest value. |
| `SemanticRole` | type | What a control is to someone who cannot see the canvas. |
| `SemanticSnapshot` | interface | The semantic tree as published: its revisions, its nodes and the focused one. |
| `SemanticSnapshotNode` | interface | One published node. |
| `SemanticSort` | type | How the rows of a grid are ordered by one of its columns. |
| `SemanticsState` | type | Whether a semantic tree is active or closed. |
| `UiListSemantics` | interface | The semantic nodes of a list control and its rows; sync it when the rows change. |
| `UiListSemanticsOptions` | interface | Semantics for a list control: its tree and list, its role and name, and how its rows are described. |
| `UiSemantics` | interface | The semantic tree of a UI the application draws: what each control is, what it is called and what state it is in. |
| `UiSemanticsOptions` | interface | A semantic tree to make: how many nodes it holds. |

## `@egret/engine/ui/testing`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `createUiTester` | function | Makes a tester over a semantic tree. |
| `UiTester` | interface | Finds controls by name and drives them through the semantic tree. |
| `UiTesterOptions` | interface | What a tester reads and drives: a semantic tree, how time moves, and the screen stack if there is one. |
| `UiTesterState` | interface | The state of a found control, as its node says it. |

## `@egret/engine/web/semantics`

| Name | Kind | What the sources say |
| --- | --- | --- |
| `BrowserSemantics` | interface | The semantic tree projected as elements over the canvas, for screen readers: sync it after the tree changes. |
| `BrowserSemanticsOptions` | interface | Browser semantics to make: the semantic tree, the canvas and its size, its label, and what is called on an error. |
| `createBrowserSemantics` | function | Projects a semantic tree to the page, for assistive technology. |
