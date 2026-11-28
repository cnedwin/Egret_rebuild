# API 参考

[English](../../en/docs/api-reference.md) | 简体中文

本页列出 `@egret/engine` 每个入口导出的全部名字：它是什么，以及源码中写在它上方的第一句说明。说明取自源码注释，所以是英文。本页由 `node tools/api-reference.mjs` 根据构建出的类型声明生成，`tests/api-reference.test.mjs` 在它与声明不一致时失败；不要手工修改。共 48 个入口、1546 个导出，其中 22 个在源码中还没有说明。

该从哪个入口导入，见[该引哪个入口](entry-points.md)。

## `@egret/engine`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `after` | 函数 | Calls a function once, `seconds` from now on the Engine's clock, as Egret's setTimeout. |
| `animate` | 函数 | A motion of one object: `animate(engine, scope, sprite).to({ x: 100, alpha: 0.5 }, 0.5, 'quadOut').wait(0.2).to({ x: 0 }, 0.5).start()`. |
| `AssetAcquireOptions` | 接口 | Options of one acquisition: a signal that cancels it. |
| `AssetGroup` | 接口 | One opaque cleanup owner; members remain borrowed genuine invariant leases. |
| `AssetGroupOptions` | 接口 | How many of a group's assets load at once. |
| `AssetGroupState` | 类型 | Whether an asset group is loading, ready, failed or disposed. |
| `AssetLease` | 类 | One independently revocable CPU-value borrow, bound to its originating Engine. |
| `AssetLoadContext` | 接口 | What a provider is given with each load: the signal that tells it the load is no longer wanted. |
| `AssetManager` | 类 | CPU acquisition only: demand retains values; completed unused values are evicted. |
| `AssetProvider` | 接口 | Loads the value an asset reference names, and disposes of it when it is no longer held. |
| `AssetRef` | 接口 | A stable manager-local identity paired with its invariant value descriptor. |
| `AssetType` | 接口 | Factory identity prevents equal names from aliasing; the phantom is invariant. |
| `AtlasFrameLayout` | 接口 | Logical canvas and unpacked placement of a clockwise-packed atlas rectangle. |
| `Bitmap` | 类 | A leaf borrowing one exact lease; engine affinity outlives clearing its slot. |
| `BitmapBindingTicket` | 接口 | Publishes borrowed group members once; owns no initial or candidate lease. |
| `BitmapResourceSlot` | 接口 | Owns only replacement leases; the exact initial Bitmap binding remains borrowed. |
| `BitmapResourceSlotState` | 类型 | Whether a bitmap resource slot is idle, loading a replacement, ready, failed, conflicted or disposed. |
| `BoundsQueryOptions` | 接口 | Receiver-inclusive node and content budgets for logical local measurement. |
| `BYTE_READER_LIMITS` | 值 | The largest snapshot a ByteReader reads, in bytes. |
| `BYTE_WRITER_LIMITS` | 值 | The largest capacity a ByteWriter has, in bytes. |
| `ByteOrder` | 类型 | The order of the bytes of a multi-byte number. |
| `ByteReader` | 类 | Read-only owned binary snapshot. |
| `ByteWriter` | 类 | Fixed-capacity owned binary appends. |
| `CancellationController` | 类 | Owns the mutable signal; consumers receive the read-only cancellation port. |
| `CancellationListener` | 类型 | A DOM-free cancellation listener; it receives no host Event object. |
| `CancellationSignal` | 接口 | One-way cancellation state. |
| `ClipRectangle2D` | 接口 | A clip rectangle together with the matrix that places it on the frame. |
| `CoordinateQueryOptions` | 接口 | Receiver-inclusive ancestor budget; omitted maxNodes defaults to 4096. |
| `copyImageData2DPixels` | 函数 | A fresh copy of an image's pixels, which the caller owns. |
| `createAssetRef` | 函数 | Keep the caller's valid ID byte-for-byte; whitespace is not normalization. |
| `createAssetType` | 函数 | Makes an asset type from a name and a check that a loaded value is of that type. |
| `createEngine` | 函数 | An Engine without a render port: it captures frames and does not render them. |
| `createEngineForProfile` | 函数 | Exact negotiation completes all successful port reads before semantics. |
| `createEventType` | 函数 | Matching uses descriptor object identity; equal key strings do not alias types. |
| `createImageData2D` | 函数 | Copies the pixels into an image this module owns; a wrong size or pixel count is refused with a TypeError. |
| `createNineSliceGeometry2D` | 函数 | Create an owned immutable stretch grid for an existing Mesh2D texture lease. |
| `createSequenceClip` | 函数 | Checks and freezes a sequence from its atlas size and frames; malformed input is refused. |
| `createSharedGeometry2D` | 函数 | Copies and checks a mesh into a shared geometry that renderers can draw; malformed arrays are refused. |
| `createSharedMaterial2D` | 函数 | Checks and freezes a material for shared meshes; values out of range are refused. |
| `createSpriteSheet` | 函数 | Build one exact-name table from a genuine full-image lease without acquiring another resource. |
| `createTexture` | 函数 | A texture of a whole image or of a rectangle of it. |
| `createTexturedGeometry2D` | 函数 | Copies and checks a textured mesh; malformed arrays are refused with a TypeError. |
| `createTextureView` | 函数 | Create an explicit logical view over an authentic straight CPU image. |
| `createTimer` | 函数 | A timer: `createTimer(engine, scope, 1, 5).onTimer(n => …).onComplete(() => …).start()`. |
| `Delayed` | 接口 | A call to come: `cancel` takes it back if it has not been made. |
| `describeErrorCode` | 函数 | A sentence for an error code: what went wrong and, for the codes a game meets most, what to do. |
| `Diagnostic` | 接口 | Diagnostics describe this headless lifecycle slice only. |
| `DiagnosticHandler` | 类型 | Observation only: throwing cannot change cleanup or cancellation progress. |
| `DisplayObject` | 类 | A live display node; detach and terminal dispose are separate operations. |
| `DisplayObjectContainer` | 类 | Ordered display children with atomic reparenting and ownership-aware cleanup. |
| `DisplaySubtreeTicket` | 接口 | Borrows all nodes/resources; disposal only revokes this candidate publication. |
| `Disposable` | 接口 | Synchronous terminal cleanup. |
| `EgretError` | 类 | Stable machine-readable code, original cause, and associated cleanup failures. |
| `EgretErrorOptions` | 接口 | What an EgretError can carry besides its code: the error or value that caused it. |
| `Engine` | 类 | One headless run. |
| `EngineOptions` | 接口 |  |
| `ErrorLanguage` | 类型 | The languages an error's sentence can be in. |
| `Event` | 类 | One typed payload with synchronous dispatch state; concurrent reuse is rejected. |
| `EventDispatcher` | 类 | Synchronous typed listeners with a frozen route and per-dispatch candidates. |
| `EventListenerOptions` | 接口 |  |
| `EventPhase` | 类型 | Where an event is on its way: going down to its target, at it, or coming back up. |
| `EventType` | 接口 | Descriptor identity and invariant payload type belong together. |
| `EventTypeOptions` | 接口 | How events of a type travel: whether they bubble and whether they can be cancelled. |
| `GameClock` | 接口 | The Engine's game clock: it ticks while running, and handlers are called on each tick. |
| `GameClockHandler` | 类型 | Called on each tick of the game clock. |
| `GameClockOptions` | 接口 | The longest step the game clock takes in one tick, in seconds. |
| `GameClockState` | 类型 | Whether the game clock is running, paused or closed. |
| `GameClockSubscription` | 接口 | A handler's place on the game clock; disposing it stops the calls. |
| `GameClockTick` | 接口 | One tick of the game clock: its number, the seconds so far and the seconds since the last tick. |
| `getErrorLanguage` | 函数 | The language error messages are written in. |
| `Graphics` | 类 | Drawing state belongs to one node; every shape snapshots its fill and its line. |
| `HitTestOptions` | 接口 | Receiver-inclusive whole-tree admission precedes all hit arithmetic. |
| `HostAdapter` | 接口 | Host owns the surface and any borrowed device. |
| `IMAGE_LIMITS_2D` | 值 | The largest image accepted: its longest edge and its number of pixels. |
| `ImageData2D` | 接口 | Immutable CPU byte identity; the brand conveys no asset or GPU authority. |
| `ImageData2DInput` | 接口 | The size and pixels of an image to copy: sRGB RGBA, eight bits a channel, rows top to bottom. |
| `isImageData2D` | 函数 | Whether a value is an image made by `createImageData2D`, without reading any of its properties. |
| `isTexture` | 函数 | Brand-only: disposal does not change the identity of a Texture. |
| `isTexturedGeometry2D` | 函数 | Whether a value is a geometry made by `createTexturedGeometry2D`, without reading any of its properties. |
| `Matrix` | 类 | A matrix of the plane, as Egret's and a canvas's: a point (x, y) goes to (a·x + c·y + tx, b·x + d·y + ty). |
| `Matrix2D` | 接口 | Immutable logical-coordinate values shared by CPU capture and render hosts. |
| `MatrixLike` | 接口 | Anything with a 2D matrix's six numbers. |
| `Mesh2D` | 类 | A display leaf borrowing an exact lease and an immutable owned geometry. |
| `Motion` | 接口 | A chain of steps for one object. |
| `MotionEasing` | 类型 | How a step runs from its start to its end: a name, or a function from 0–1 to 0–1 (it may pass both on the way). |
| `MotionEasingName` | 类型 | The name of an easing a motion step can use. |
| `MotionState` | 类型 | Whether a motion is idle, running, paused, finished or stopped. |
| `NineSliceBitmap` | 类 | A resizable stretch-only leaf borrowing one exact, caller-owned Texture lease. |
| `NineSliceBitmapOptions` | 接口 | Required local panel dimensions and fixed source-crop borders. |
| `NineSliceGeometry2DOptions` | 接口 | The size of a nine-slice picture, the size to stretch it to, and the insets whose corners are not stretched. |
| `NineSliceInsets2D` | 接口 | Border widths in the same units as the unrotated source crop. |
| `Point` | 类 | A place: `x` and `y`. |
| `Point2D` | 接口 | An owned logical-coordinate value; query results are frozen at runtime. |
| `Rectangle` | 类 | A rectangle: its top left corner `x`, `y`, and its `width` and `height`. |
| `Rectangle2D` | 接口 | An axis-aligned rectangle in its own coordinate space. |
| `RectangleLike` | 接口 | Anything with a rectangle's x, y, width and height. |
| `Releasable` | 接口 | Releases a lease; resource ownership and disposal remain with its provider. |
| `RenderEffect2D` | 接口 | Render-only subtree effect. |
| `RenderGlow2D` | 接口 | A glow around a node's picture, or, moved by an offset, a drop shadow. |
| `RenderOutline2D` | 接口 | An outline around a node's picture: its color, width and alpha. |
| `Scope` | 类 | Synchronous ownership boundary. |
| `ScopeState` | 类型 | Whether a scope is open, disposing what it owns, or closed. |
| `ScopeValue` | 类型 | Scope prefers dispose() when a value implements both cleanup protocols. |
| `SequenceClip` | 接口 | Public immutable sequence metadata; authentic values come from createSequenceClip. |
| `SequenceClipInput` | 接口 | The atlas size and the frames of a sequence to make. |
| `SequenceFrameInput` | 接口 | One frame of a sequence to make: its rectangle on the atlas, how long it shows, and its trim and rotation. |
| `SequencePlayback` | 接口 | A sequence playing on the game clock: start, pause, resume and stop it, and read its last sample. |
| `SequencePlaybackMode` | 类型 | Whether a sequence plays once and stops on its last frame, or loops. |
| `SequencePlaybackOptions` | 接口 | Whether a sequence plays once or loops. |
| `SequencePlaybackState` | 类型 | Whether a sequence playback is idle, running, paused, completed, stopped or failed. |
| `SequencePlayer` | 类 | Explicit absolute-time selection borrowing a target and its exact current lease. |
| `SequenceRegion` | 接口 | The rectangle of the atlas a sequence shows at one moment, with its trim and rotation. |
| `SequenceSample` | 接口 | What a sequence shows at a position: its frame and region, and whether it has reached its end or stopped. |
| `setErrorLanguage` | 函数 | The language of the sentence in the message of every error made from now on: English unless set. |
| `Shape` | 类 | Stable drawing facade; a Sprite never shares or rebinds its Graphics. |
| `SHARED_FRAME_PROFILE_2D` | 值 | The name of the shared 2D frame profile that hosts and the engine agree on. |
| `SharedBarrierCommand2D` | 接口 | A command that ends or begins an effect layer: what came before is finished before what comes after is drawn. |
| `SharedBlendSpace2D` | 类型 | Where translucent draws mix with what is under them. |
| `SharedDrawState2D` | 接口 | What every draw command carries: its order, its material, its matrix, its opacity and its clips. |
| `SharedEffect2D` | 接口 | Frozen effect inputs captured with the same frame and image ownership. |
| `SharedFloatArray2D` | 类型 | A float array of a shared geometry, in single or double precision. |
| `SharedFrameOptions2D` | 接口 | The size of a frame to capture, the color it is cleared to, and how its alpha is given. |
| `SharedFrameProfile2D` | 类型 | The type of the shared frame profile name. |
| `SharedGeometry2D` | 接口 | Immutable CPU geometry identity; the brand grants no asset or GPU authority. |
| `SharedGeometryInput2D` | 接口 | The positions, texture coordinates, light and dark colors and triangle indices of a mesh to share with a renderer. |
| `SharedGlow2D` | 接口 | A glow or outline drawn around what an effect layer holds. |
| `SharedImageCommand2D` | 接口 | A draw command that draws a region of a page. |
| `SharedIndexArray2D` | 类型 | An index array of a shared geometry, in 16 or 32 bits. |
| `SharedMaterial2D` | 接口 | A checked material for shared meshes; only `createSharedMaterial2D` makes one. |
| `SharedMaterialInput2D` | 接口 | The colors, blend, sampling and addressing of a material for shared meshes, as plain values to check. |
| `SharedMeshCommand2D` | 接口 | A draw command that draws a textured or colored mesh. |
| `SharedOutputAlpha2D` | 类型 | How a frame's output alpha is given: premultiplied, or opaque with alpha ignored. |
| `SharedPage2D` | 接口 | One image that a frame's commands sample from, with how its pixels are represented. |
| `SharedRectangleCommand2D` | 接口 | A draw command that fills a rectangle with one color. |
| `SharedRegion2D` | 接口 | A region of a page, by the page's index in the frame. |
| `SharedRenderCommand2D` | 类型 | Any command of a shared frame. |
| `SharedRenderFrame2D` | 接口 | One captured frame: its size, clear color and color recipe, its commands in draw order, and the pages, regions, materials and geometries they use. |
| `SharedRenderHostAdapter` | 接口 | A host that draws shared frames of this profile. |
| `Sprite` | 类 | Stable drawing facade; a Sprite never shares or rebinds its Graphics. |
| `SpriteSheet` | 接口 | Immutable metadata plus a separately revocable borrow of one original lease. |
| `SpriteSheetFrameInput` | 接口 | One packed absolute rectangle, indexed by its exact UTF-16 name. |
| `Stage` | 类 | Created and bound by Engine; there is no implicit global stage. |
| `Texture` | 类 | An immutable CPU image view with a separate, terminal wrapper lifetime. |
| `TexturedFloatArray2D` | 类型 | A float array of a textured geometry, in single or double precision. |
| `TexturedGeometry2D` | 接口 | Immutable CPU geometry identity; the brand grants no asset or GPU authority. |
| `TexturedGeometry2DInput` | 接口 | The positions, texture coordinates and triangle indices of a textured mesh to copy. |
| `TexturedIndexArray2D` | 类型 | An index array of a textured geometry, in 16 or 32 bits. |
| `TextureRegion2D` | 接口 | A rectangle of an image in whole pixels, from its top left corner. |
| `TextureViewRegion2D` | 接口 | Owned immutable metadata. |
| `TextureViewRegionInput2D` | 接口 | A packed page rectangle and its unrotated logical, top-left region. |
| `Timer` | 接口 | Calls a function every `delay` seconds, `repeatCount` times or until it is stopped, as Egret's Timer. |
| `Tween` | 接口 | A number tweened on the game clock: start, pause, resume and stop it, and read its value. |
| `TweenEasing` | 类型 | The easing a tween uses. |
| `TweenOptions` | 接口 | A tween to make: from and to which number, for how long, with which easing, and what it calls. |
| `TweenState` | 类型 | Whether a tween is idle, running, paused, completed, stopped or failed. |

## `@egret/engine/webgpu`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createSharedWebGPUHost` | 函数 | A host that draws shared frames with WebGPU on a canvas. |
| `SharedDeviceSessionState` | 类型 | Shared Host lifecycle metadata. |
| `SharedDeviceSessionStatus` | 接口 | A frozen observation of one Host, with historical and current failures separate. |
| `SharedFrameSubmission` | 接口 | Native draw completion is separate from pixel readback and final retirement. |
| `SharedFrameUpload` | 接口 | A single-use authority over the existing Host-owned pending frame record. |
| `SharedFrameUploadOptions` | 接口 | Cancellation revokes an unsubmitted upload without releasing unsettled work. |
| `SharedFrameUploadReady` | 接口 | Upload completion does not imply that this frame has been presented. |
| `SharedHostResourceStatus` | 接口 | Fresh immutable data; reads do no native work. |
| `SharedWebGPUHost` | 接口 | A host that draws shared frames with WebGPU: start and stop it, stage frames, read them back, and recover from a lost device. |
| `SharedWebGPUHostOptions` | 接口 | A shared WebGPU host's own options: its geometry limits, effects, output alpha, blend space and recovery. |
| `SharedWebGPUHostStatus` | 接口 | A shared WebGPU host as it is now: its host status, the bytes pending, and its resources. |
| `SharedWebGPUReadback` | 接口 | Pixels read back from a shared frame, with their alpha mode and device generation. |
| `WebGPUHostDiagnostic` | 接口 | Something a WebGPU host reports: a failure, with how serious it is. |
| `WebGPUHostErrorCode` | 类型 | What went wrong in a WebGPU host. |
| `WebGPUHostFailure` | 接口 | A failure of a WebGPU host: its code, the frame it happened at, the phase, and its cause. |
| `WebGPUHostOptions` | 接口 | A WebGPU host to make: its canvas and device, its pixel ratio, its limits, whether it reads back, and what it reports to. |
| `WebGPUHostState` | 类型 | Where a WebGPU host is: new, starting, active, stopped, failed, closing or closed. |
| `WebGPUHostStatus` | 接口 | A WebGPU host as it is now: its state, frames and bytes pending, and its failures. |
| `WebGPUReadback` | 接口 | The pixels of a frame read back: its frame, size, format, color space and alpha, and its bytes. |

## `@egret/engine/text`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createTextField` | 函数 | Public explicit entry; shape, proxies and borrowed identities grant no authority. |
| `createTextRasterCache` | 函数 | Explicit CPU text orchestration; this entry owns no browser font or drawing surface. |
| `TextField` | 接口 | Factory-produced noneditable leaf; the brand has no runtime value. |
| `TextFieldStatus` | 接口 | Where a text field is: unprepared, ready or disposed, its revisions and its metrics. |

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
| `BitmapButtonOptions` | 接口 | A bitmap button to make: its engine, scope and input, its skins, and what it does when activated. |
| `BitmapButtonState` | 类型 | Whether a bitmap button is up, pressed, disabled or disposed. |
| `createBitmapButton` | 函数 | Share a genuine input; own only the new private sheet, Bitmap and facade. |
| `createMouseInput` | 函数 | Primary mouse activation for the admitted ordinary desktop Canvas layout profile. |
| `MouseInput` | 接口 | Scope-owned synchronous input. |
| `MouseInputCancelReason` | 类型 | Why a press was cancelled. |
| `MouseInputEvents` | 接口 | The event types mouse input dispatches: begin, end, activate and cancel. |
| `MouseInputOptions` | 接口 | Fixed logical dimensions; browser layout scaling does not change game coordinates. |
| `MouseInputPayload` | 接口 | A mouse event: which pointer, where on the stage, what made it and which button. |
| `MouseInputState` | 类型 | Whether mouse input is idle, has a button pressed, or has closed. |

## `@egret/engine/web/image`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserPngDecodeOptions` | 接口 | How the browser decodes a PNG: its orientation, alpha and color space conversion. |
| `BrowserPngPorts` | 接口 | How the browser decodes a PNG and makes a canvas, for PNG textures. |
| `BrowserTextureProvider` | 接口 | Loads PNG textures in the browser; close it when done. |
| `BrowserTextureProviderOptions` | 接口 | A PNG texture provider to make: where it reads bytes from, and the ports it decodes with. |
| `createBrowserTextureProvider` | 函数 | Caller owns async close; managers own issued Textures and their final demand. |

## `@egret/engine/web/text`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createCanvasTextRasterProvider` | 函数 | Caller-owned fonts and explicit cache invalidation; no font loading. |

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
| `SharedLayerWebGL2Host` | 接口 | A shared WebGL2 host that also draws kept layers. |
| `SharedWebGL2FrameTiming` | 接口 | The timings of a host's frames: totals by phase, the recent samples and how many were dropped. |
| `SharedWebGL2Host` | 接口 |  |
| `SharedWebGL2HostOptions` | 接口 | A shared WebGL2 host to make: its canvas, what it reports to, and whether it measures frames. |
| `SharedWebGL2HostStatus` | 接口 | A shared WebGL2 host as it is now: its resources, host status, bytes pending and retention. |
| `SharedWebGL2Layer2D` | 接口 | A layer drawn once and kept on the GPU: update it, or dispose of it. |
| `SharedWebGL2LayerEffect2D` | 接口 | How a kept layer is tinted when it is placed: its bounds and its multiplied and added color. |
| `SharedWebGL2LayerPlacement2D` | 接口 | Where a kept layer is placed in a frame, how large, and with what effect. |
| `SharedWebGL2LayerStatus` | 接口 | The kept layers of a host: the bytes they hold, and how many are ready and pending. |
| `SharedWebGL2PageBatching` | 类型 | Same-page batches still merge. |
| `SharedWebGL2Readback` | 接口 | The pixels of a shared frame read back: its generation and frame, size, format, color space, alpha and bytes. |
| `SharedWebGL2StartupTiming` | 接口 | Elapsed startup phases in the current successful WebGL2 generation, not GPU execution timers. |
| `SharedWebGL2TimingPhase` | 类型 | A phase of drawing a shared frame that the host can time. |
| `SharedWebGL2TimingSample` | 接口 | One timed phase of a frame: its generation and frame, the phase, when it began and how long it took. |
| `WebGL2HostDiagnostic` | 接口 | Something a WebGL2 host reports: a failure, with how serious it is. |
| `WebGL2HostErrorCode` | 类型 | What went wrong in a WebGL2 host. |
| `WebGL2HostFailure` | 接口 | A failure of a WebGL2 host: its code, the frame and context generation it happened at, the phase, and its cause. |
| `WebGL2HostState` | 类型 | Where a WebGL2 host is: new, starting, active, lost, restoring, stopped, failed, closing or closed. |
| `WebGL2HostStatus` | 接口 | A WebGL2 host as it is now: its state and generation, frames and bytes pending, and its failures. |

## `@egret/engine/world3d`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `AlphaMode3D` | 类型 | How a material's alpha is used: ignored, cut at a threshold, or blended. |
| `ANIMATION3D_LIMITS` | 值 | The most tracks, keys and actions animations hold. |
| `ANIMATION_TEXTURE3D_LIMITS` | 值 | The most bone matrices, clips and frames a second an animation texture holds. |
| `AnimationAction3D` | 类 | One clip playing on a mixer: play, stop and reset it, fade it in or out, or cross-fade to another. |
| `AnimationClip3D` | 类 | A named animation: its tracks and its length in seconds. |
| `AnimationInterpolation3D` | 类型 | How a track goes between its keys: it steps, moves in a line, or follows a cubic spline. |
| `AnimationLoop3D` | 类型 | How an action plays its clip: over and over, once, or back and forth. |
| `AnimationMixer3D` | 类 | Plays clips on the subtree under `root`, blending concurrent actions by weight. |
| `AnimationPath3D` | 类型 | What an animation track moves: a node's position, rotation, scale, or morph weights. |
| `AnimationStateMachine3D` | 类 | Plays clips by state, moving between states when their conditions are met. |
| `AnimationTexture3D` | 类 | Bone matrices of one skinned mesh for every frame of a set of clips. |
| `AnimationTrack3D` | 接口 | One track of a clip: the node it moves, what it moves, its keys and its interpolation. |
| `AnimationTrackInput3D` | 接口 | A track to make: the node it moves by name, what it moves, its key times and values, and its interpolation. |
| `ArrowHelper3D` | 类 | Arrow from `origin` along `direction`; change them and call update(). |
| `Attribute3D` | 类 | One attribute of a geometry, such as positions: its data, how many numbers each vertex has, and whether they are normalized. |
| `ATTRIBUTE_3D` | 值 | Well-known attribute names understood by the built-in materials. |
| `AttributeArray3D` | 类型 | An array of vertex data. |
| `BakeAnimationOptions3D` | 接口 | How many frames a second clips are baked at. |
| `bakeAnimationTexture3D` | 函数 | Sample clips into an animation texture. |
| `BakedClip3D` | 接口 | One clip baked into an animation texture: its name, first frame, frame count and length. |
| `BasisModule3D` | 接口 | The parts of an initialized Basis Universal transcoder module (`await BASIS()`) this adapter calls. |
| `BATCH3D_LIMITS` | 值 | The most items, vertices and line points a batch holds. |
| `BatchedMesh3D` | 类 | Many geometries drawn as one mesh with one material and one draw call. |
| `Blending3D` | 类型 | How a material's color mixes with what is behind it. |
| `BodyType3D` | 类型 | Whether a body never moves, is moved by code, or is moved by the simulation. |
| `Bone3D` | 类 | A bone of a skeleton. |
| `box3Empty` | 函数 | Sets a box to empty. |
| `box3ExpandByPoint` | 函数 | Grows a box to hold a point. |
| `box3IsEmpty` | 函数 | Whether a box is empty. |
| `box3Transform` | 函数 | Axis-aligned bounds of a transformed box (Arvo's method). |
| `box3Union` | 函数 | The box that holds two boxes. |
| `BoxGeometryOptions3D` | 接口 | A box to make: its width, height and depth, and their segments. |
| `BoxHelper3D` | 类 | Wire box around an object's world bounds. |
| `Camera3D` | 类 | A camera: its projection, and calls that turn screen points into rays and world points into screen points. |
| `CameraHelper3D` | 类 | Outline of a camera's view volume. |
| `CapsuleGeometryOptions3D` | 接口 | A capsule to make: its radius, height and segments. |
| `CatmullRomCurve3D` | 类 | Smooth curve through every control point. |
| `CatmullRomKind3D` | 类型 | How a Catmull-Rom curve is parameterized between its points. |
| `CharacterController3D` | 类 | Kinematic capsule that slides along the world instead of being simulated. |
| `CharacterControllerOptions3D` | 接口 | A character controller to make: its radius and height, where it starts, the steepest slope it climbs, and what it collides with. |
| `CharacterMotor3D` | 类 | A walking, jumping character. |
| `CharacterMotorOptions3D` | 接口 | How a character moves: its jump and gravity, the steps it climbs, its acceleration and air control, and its grace time to jump. |
| `CircleGeometryOptions3D` | 接口 | A circle to make: its radius, segments and arc. |
| `clamp` | 函数 | The value, kept between `min` and `max`. |
| `Cloth3D` | 类 | A rectangular sheet. |
| `CLOTH3D_LIMITS` | 值 | The most points and colliders cloth and ropes hold. |
| `ClothOptions3D` | 接口 | A cloth to make: its columns and rows, where it starts and which way it spreads, and how stiff it is. |
| `colorFromHex` | 函数 | Decode a 0xRRGGBB sRGB color into linear RGB in [0, 1]. |
| `ColorInput3D` | 类型 | A color as 0xRRGGBB sRGB hex or linear RGB components. |
| `CompoundChild3D` | 接口 | One part of a compound shape, placed in the body's local frame. |
| `COMPRESSED_BLOCK_BYTES_3D` | 值 | Bytes per 4x4 block of each compressed format. |
| `CompressedFormat3D` | 类型 | Block-compressed GPU formats that can be uploaded without transcoding. |
| `CompressedPixels3D` | 接口 | A pre-compressed mip chain, largest level first. |
| `COMPRESSION3D_LIMITS` | 值 | The most bytes a decompression gives. |
| `computeObjectBounds3D` | 函数 | World-space bounds of an object and its descendants as [minX, minY, minZ, maxX, maxY, maxZ]. |
| `connectPhysics3D` | 函数 | Connects to a physics world run in a worker, through a message port. |
| `ConvexHullShape3D` | 类 | A convex hull as a physics shape. |
| `createAmbientLight3D` | 函数 | Uniform light from every direction. |
| `createAnimationClip3D` | 函数 | Makes a clip from its name and tracks; malformed tracks are refused. |
| `createAnimationStateMachine3D` | 函数 | Makes an animation state machine that drives a mixer. |
| `createArrowHelper3D` | 函数 | Makes an arrow from a point in a direction. |
| `createAxesGeometry3D` | 函数 | Three colored segments from the origin along +X (red), +Y (green) and +Z (blue). |
| `createAxesHelper3D` | 函数 | Ready-made axes node colored X red, Y green, Z blue. |
| `createBasisTranscoder3D` | 函数 | Turn an initialized Basis Universal transcoder module into the `transcodeKtx2` option. |
| `createBatchedMesh3D` | 函数 | Makes a mesh that draws many geometries with one material in one draw. |
| `createBoxEdgesGeometry3D` | 函数 | The twelve edges of an axis-aligned box given as [minX, minY, minZ, maxX, maxY, maxZ]. |
| `createBoxGeometry3D` | 函数 | Axis-aligned box centered on the origin with one material group per face (+X, -X, +Y, -Y, +Z, -Z). |
| `createBoxHelper3D` | 函数 | Makes lines that show an object's bounding box. |
| `createCameraHelper3D` | 函数 | Makes lines that show what a camera sees. |
| `createCapsuleGeometry3D` | 函数 | Capsule along Y; `height` is the length of the cylindrical middle section. |
| `createCharacterController3D` | 函数 | Makes a capsule that walks and slides along what it hits, for a character. |
| `createCharacterMotor3D` | 函数 | Makes a character motor that walks, jumps and climbs steps in a physics world. |
| `createCircleGeometry3D` | 函数 | Flat disc or sector in the XY plane, facing +Z. |
| `createCloth3D` | 函数 | Makes a sheet of cloth that hangs, folds and blows. |
| `createConeGeometry3D` | 函数 | Makes a cone. |
| `createConvexHullShape3D` | 函数 | Build a convex hull shape from a geometry's vertices, or from a flat list of points. |
| `createCubeTextureFromEquirect3D` | 函数 | Build a cube texture from an equirectangular panorama. |
| `createCustomShader3D` | 函数 | Makes a material drawn by shaders of your own. |
| `createCylinderGeometry3D` | 函数 | Cylinder or truncated cone along Y. |
| `createDecal3D` | 函数 | A decal mesh on a target mesh, added as its child so it moves with it. |
| `createDecalGeometry3D` | 函数 | Cut the part of a mesh's surface that lies inside the decal box. |
| `createDirectionalLight3D` | 函数 | Parallel rays, such as sunlight. |
| `createDodecahedronGeometry3D` | 函数 | Makes a dodecahedron. |
| `createDracoDecoder3D` | 函数 | Turn an initialized Draco decoder module into the `decodeDraco` option of the glTF loader. |
| `createEdgesGeometry3D` | 函数 | Line segments for outline and crease edges only: edges with one face, or whose two faces meet at more than `thresholdAngle` radians. |
| `createExtrudeGeometry3D` | 函数 | Give an outline thickness. |
| `createFatLine3D` | 函数 | Makes a line of a given thickness through points. |
| `createFollowCamera3D` | 函数 | Makes a camera that follows a target and keeps out of walls. |
| `createGeometry3D` | 函数 | Build a geometry from plain arrays; missing normals are computed for triangles. |
| `createGeometryBuilder3D` | 函数 | A builder that merges placed, coloured parts into one geometry. |
| `createGlassMaterial3D` | 函数 | A standard material set up as glass: smooth and see-through, with reflections kept. |
| `createGpuParticles3D` | 函数 | Makes particles simulated on the GPU. |
| `createGradientCubeTexture3D` | 函数 | Procedural sky cube: a vertical gradient from `ground` through `horizon` to `zenith`, in sRGB. |
| `createGridGeometry3D` | 函数 | Square grid of lines on the XZ plane, centered at the origin. |
| `createGridHelper3D` | 函数 | Ready-made grid node for editors and debug views. |
| `createHeightField3D` | 函数 | Makes a grid of heights for terrain and physics. |
| `createHeightFieldFromPixels3D` | 函数 | Height field with one sample per pixel of a decoded RGBA image; the image's top row is the -Z edge. |
| `createHemisphereLight3D` | 函数 | Sky color from above blending to a ground color from below (world Y axis). |
| `createIcosahedronGeometry3D` | 函数 | Makes an icosahedron. |
| `createJelly3D` | 函数 | Makes an object squash, stretch and wobble like jelly as it moves. |
| `createJellyShader3D` | 函数 | The vertex hook a jelly drives. |
| `createLambertMaterial3D` | 函数 | Diffuse-only lighting; the cheapest lit model. |
| `createLatheGeometry3D` | 函数 | Revolve a profile of [x, y] points (x is the distance from the Y axis) around Y. |
| `createLightHelper3D` | 函数 | Makes lines that show where a light is and where it shines. |
| `createLineMaterial3D` | 函数 | Unlit line or point material; pair it with a 'lines', 'line-strip' or 'points' geometry. |
| `createMatcapMaterial3D` | 函数 | Lighting baked into a sphere image: the surface color is looked up by the view-space normal, so no lights are needed. |
| `createMeshShape3D` | 函数 | Build a collision mesh from a geometry or the unskinned, non-instanced triangle meshes under an object. |
| `createNavCrowd3D` | 函数 | Makes a crowd of agents that move along a navigation mesh and keep apart. |
| `createNavMesh3D` | 函数 | Build a navigation mesh from level geometry: a geometry, or an object whose meshes are merged with their world transforms. |
| `createOctahedronGeometry3D` | 函数 | Makes an octahedron. |
| `createOrthographicCamera3D` | 函数 | Makes an orthographic camera. |
| `createParticleEmitter3D` | 函数 | Makes a particle emitter. |
| `createPerspectiveCamera3D` | 函数 | Makes a perspective camera. |
| `createPhongMaterial3D` | 函数 | Diffuse plus Blinn-Phong specular highlights. |
| `createPhysicsWorld3D` | 函数 | Makes a 3D physics world. |
| `createPlaneGeometry3D` | 函数 | Plane in the XY plane facing +Z. |
| `createPointLight3D` | 函数 | Makes a light that shines from a point in every direction. |
| `createPolyhedronGeometry3D` | 函数 | Project a convex solid's triangles onto a sphere, subdividing each `detail` times. |
| `createQuadGeometry3D` | 函数 | Unit quad in XY used by sprites: corners at +-0.5, facing +Z. |
| `createRagdoll3D` | 函数 | Makes a ragdoll of physics bodies that a skeleton follows. |
| `createRingGeometry3D` | 函数 | Flat ring in the XY plane, facing +Z. |
| `createRope3D` | 函数 | Makes a rope of points that hangs and swings. |
| `createScreenLayer3D` | 函数 | Makes a picture drawn over the whole screen, above or below the scene. |
| `createSdfGeometry3D` | 函数 | The mesh of the field's surface, with smooth normals and linear vertex colours (draw it with a material that has `vertexColors: true`). |
| `createSdfLod3D` | 函数 | The model in levels of detail, as a Lod3D whose children are the meshes of the levels, nearest first. |
| `createSdfRig3D` | 函数 | A rig of `shape`: its mesh, made as `createSdfGeometry3D` makes it, skinned to bones at the joints of the model. |
| `createShapeGeometry3D` | 函数 | Fill one or more outlines in the XY plane, facing +Z. |
| `createSkeletonHelper3D` | 函数 | Makes lines that show the bones of a skeleton. |
| `createSkinnedInstancedMesh3D` | 函数 | Makes many skinned instances of one mesh, each playing baked clips from an animation texture. |
| `createSolidTexture3D` | 函数 | Single-color 1x1 texture, useful as a placeholder or constant map. |
| `createSphereGeometry3D` | 函数 | UV sphere with poles on the Y axis. |
| `createSpotLight3D` | 函数 | Makes a light that shines from a point in a cone. |
| `createSprite3D` | 函数 | Makes a sprite: a picture that always faces the camera. |
| `createSpriteMaterial3D` | 函数 | Camera-facing unlit quad material for Sprite3D. |
| `createStandardMaterial3D` | 函数 | Physically based metallic-roughness model, matching glTF 2.0 materials. |
| `createSurfaceMaterial3D` | 函数 | A standard material with a surface drawn by the shader, over its colour or its vertex colours (on unless `vertexColors: false`): `createSurfaceMaterial3D({ surface: 'wood' })` for a crate made in code. |
| `createTerrain3D` | 函数 | Makes terrain from a height field, drawn in chunks at levels of detail. |
| `createTerrainMaterial3D` | 函数 | A standard material whose color is a blend of ground textures, such as sand, grass, rock and snow, painted by a weight map. |
| `createTerrainStream3D` | 函数 | Makes terrain that loads and unloads tiles around a point. |
| `createTetrahedronGeometry3D` | 函数 | Makes a tetrahedron. |
| `createTextGeometry3D` | 函数 | Text as a mesh geometry in the XY plane, facing +Z, with the first baseline on y = 0. |
| `createTextShapes3D` | 函数 | Outlines of a text as flat shapes; see Font3D.generateShapes. |
| `createToonMaterial3D` | 函数 | Cel shading: diffuse light quantized into `steps` flat bands. |
| `createTorusGeometry3D` | 函数 | Torus around the Z axis. |
| `createTorusKnotGeometry3D` | 函数 | Makes a torus knot. |
| `createTrail3D` | 函数 | Makes a ribbon that follows a moving object and fades behind it. |
| `createTransformGizmo3D` | 函数 | Makes a transform gizmo seen by a camera. |
| `createTubeGeometry3D` | 函数 | Sweep a circle along a curve, using twist-free frames. |
| `createUnlitMaterial3D` | 函数 | Constant color, unaffected by lights. |
| `createVehicle3D` | 函数 | Makes a vehicle of wheels on raycast suspension under a chassis body. |
| `createVolumetricFog3D` | 函数 | Makes fog that light shines through. |
| `createWater3D` | 函数 | Makes a water surface with waves, reflections and foam. |
| `createWaterMaterial3D` | 函数 | The material Water3D uses, for a water surface on your own geometry: a standard material that refracts, with the wave hooks attached. |
| `createWireframeGeometry3D` | 函数 | Line segments for every triangle edge, each drawn once. |
| `CubeTexture3D` | 类 | Six square faces in +X, -X, +Y, -Y, +Z, -Z order. |
| `CubicBezierCurve3D` | 类 | A cubic Bézier curve through four control points. |
| `Curve3D` | 类 | Base for every curve: subclasses implement getPoint(t) for t in [0, 1]. |
| `CURVE3D_LIMITS` | 值 | The most points and divisions a curve has. |
| `CurvePath3D` | 类 | Several curves joined end to end and traversed as one, by length. |
| `CustomShader3D` | 接口 | A fragment hook that post-processes a material's shaded color. |
| `CylinderGeometryOptions3D` | 接口 | A cylinder to make: its top and bottom radius, height, segments, and whether its ends are open. |
| `DECAL3D_LIMITS` | 值 | The most triangles a decal has. |
| `DecalOptions3D` | 接口 | A decal to make: where it goes and which way it faces, its size and depth, its rotation, and the steepest surface it covers. |
| `decodeMeshopt3D` | 函数 | Decode one EXT_meshopt_compression buffer view. |
| `decompressZstd3D` | 函数 | Decompress Zstandard data: one or more frames, including skippable ones. |
| `DEG_TO_RAD_3D` | 值 | Degrees times this are radians. |
| `DeserializedScene3D` | 接口 | A scene loaded back: its root, cameras, geometries, materials and textures. |
| `DeserializeOptions3D` | 接口 | How a scene is loaded back: how each texture key is turned into a texture. |
| `deserializeScene3D` | 函数 | Rebuild a subtree from data produced by serializeScene3D. |
| `DisposeListener3D` | 类型 | Called when something is disposed of. |
| `DracoModule3D` | 接口 | The parts of an initialized Draco decoder module (`await DracoDecoderModule()`) this adapter calls. |
| `EPSILON_3D` | 值 | How close two numbers must be to count as equal. |
| `EquirectOptions3D` | 接口 | How an equirectangular image is turned into a cube: its size, exposure and brightest value. |
| `exportGlb3D` | 函数 | The model as the bytes of a .glb file: a geometry alone (with a plain material that shows its vertex colours), or an object and everything under it. |
| `ExtrudeGeometryOptions3D` | 接口 | An extrusion to make: how deep, in how many steps, and along which path. |
| `FatLine3D` | 类 | A polyline drawn as a ribbon of triangles that turns to face the camera, so it can be wider than the one pixel that plain lines allow. |
| `FatLineOptions3D` | 接口 | A thick line to make: its width, whether that width is in screen pixels, its color and whether it closes. |
| `findGridPath3D` | 函数 | Shortest path on a grid of cells, for tile maps. |
| `Fog3D` | 类型 | Fog that fades a scene into a color: linearly between two distances, or exponentially by a density. |
| `FollowCamera3D` | 类 | Third-person camera: orbits a target at a distance, and moves closer when a wall would hide the target, easing back out afterwards. |
| `FollowCameraOptions3D` | 接口 | How a follow camera keeps behind its target: its distance and height, its angles, and what it keeps clear of. |
| `Font3D` | 类 | A font that gives the outlines of text for 3D text geometry. |
| `FontSource3D` | 接口 | A font for 3D text: its metrics, family, and its glyphs' outlines. |
| `frustumFromMatrix` | 函数 | The six planes of the frustum a projection-view matrix sees. |
| `frustumIntersectsBox` | 函数 | Whether a box is at least partly inside a frustum. |
| `frustumIntersectsSphere` | 函数 | Whether a sphere is at least partly inside a frustum. |
| `Geometry3D` | 类 | The vertices of a mesh: its attributes and indices, its groups and morph targets, and calls that compute normals and tangents. |
| `GEOMETRY3D_LIMITS` | 值 | The most vertices, indices, morph targets and groups a geometry has. |
| `GeometryBuilder3D` | 接口 | Joins many geometries, each placed, into one. |
| `GeometryGroup3D` | 接口 | A range of a geometry's indices drawn with one of its mesh's materials. |
| `GeometryInput3D` | 接口 | A geometry to make: its positions, and its normals, texture coordinates, colors and indices where given. |
| `GeometryPart3D` | 接口 | One geometry added to a builder: where, turned and scaled how, and its color. |
| `GizmoHandle3D` | 类型 | A single axis, a plane spanned by two axes, or 'xyz' for the center handle of the scale mode. |
| `GizmoMode3D` | 类型 | Whether a gizmo moves, turns or scales what it is attached to. |
| `GizmoSpace3D` | 类型 | Whether a gizmo's axes are the world's or the object's own. |
| `GlbExportOptions3D` | 接口 | How a model is written. |
| `GltfAsset3D` | 接口 | A loaded glTF file: its scenes, animations, cameras, materials, textures and geometries. |
| `GltfDracoRequest3D` | 接口 | Draco data a glTF file needs decoded: its bytes and the attributes and component types it holds. |
| `GltfDracoResult3D` | 接口 | Decoded Draco data: its attributes by name and its indices. |
| `GltfImageRequest3D` | 接口 | An image a glTF file needs decoded: its index, media type, and its bytes or URI. |
| `GltfLoadOptions3D` | 接口 | How a glTF file's parts are loaded: its images, its other buffers, and its KTX2, meshopt and Draco data. |
| `GltfMeshoptRequest3D` | 接口 | Meshopt data a glTF file needs decoded: its bytes, count, stride, mode and filter. |
| `GlyphOutline3D` | 接口 | One glyph in font units. |
| `GpuParticles3D` | 类 | An instanced, camera-facing quad per particle. |
| `GpuParticlesOptions3D` | 接口 | GPU particles to make: how many and how long they live, how they move, grow, turn and fade, where they come from and how they blend. |
| `GridPathOptions3D` | 接口 | How a grid path is found: whether it moves diagonally, and how many cells it visits at most. |
| `HDR3D_LIMITS` | 值 | The largest HDR image read. |
| `HdrImage3D` | 接口 | Linear RGB floats, three per pixel, top row first. |
| `HeightField3D` | 类 | Heights on a regular grid in the XZ plane. |
| `HeightFieldOptions3D` | 接口 | A height field to make: its columns and rows, its size, and its heights or a function that gives them. |
| `HeightImageOptions3D` | 接口 | How an image becomes heights: the field's size, its lowest and highest height, and how heights are encoded. |
| `inflate3D` | 函数 | Decompress a zlib stream, or a bare deflate stream when `raw` is set. |
| `InstanceBlendOptions3D` | 接口 | How an instance blends two baked clips: from when, how fast, whether they loop and stay in step. |
| `InstanceClipOptions3D` | 接口 | How an instance plays a baked clip: from when, how fast, whether it loops and how long it fades. |
| `InstancedMesh3D` | 类 | Draw one geometry many times in a single call with per-instance transforms and colors. |
| `isCompressedPixels3D` | 函数 | Whether a value holds compressed pixels. |
| `isKtx23D` | 函数 | True when `bytes` starts with the KTX 2.0 file identifier. |
| `isTexturePixels3D` | 函数 | Whether a value holds plain pixels. |
| `Jelly3D` | 类 | Makes everything drawn under `target` behave like jelly. |
| `JellyOptions3D` | 接口 | How a jelly wobbles: its stiffness and damping, how far it squashes, how it reacts, and how it idles. |
| `Joint3D` | 类 | A constraint between two bodies, or between a body and the world. |
| `JointOptions3D` | 接口 | A joint to make: its kind, the two bodies and anchors, its axis and limits, its motor and spring. |
| `JointType3D` | 类型 | The kind of a joint: a point, a hinge, fixed, a distance or a slider. |
| `Ktx2Info3D` | 接口 | What a KTX2 file holds: its format, size, levels and supercompression. |
| `Ktx2Options3D` | 接口 | How a KTX2 file is transcoded for the GPU in use. |
| `Ktx2Result3D` | 接口 | A transcoded KTX2 texture: its pixels and color space. |
| `LatheGeometryOptions3D` | 接口 | A lathe to make: its segments and the arc it turns through. |
| `Light3D` | 类 | A light in a scene: its kind and its shadow. |
| `LIGHT3D_LIMITS` | 值 | The most directional, point, tiled point and spot lights a scene lights, and the most shadows. |
| `LightHelper3D` | 类 | Shows where a light is and where it points: a ray for directional, a cone for spot, a range sphere for point lights. |
| `LightOptions3D` | 接口 | A light to make: its color and intensity, and whether it casts shadows. |
| `LightShadow3D` | 接口 | How a light casts shadows: its map size, biases, range, extent, softness and cascades. |
| `LightType3D` | 类型 | The kind of a light: ambient, hemisphere, directional, point or spot. |
| `linearColor3D` | 函数 | A hex colour as seen on screen in the linear RGB the renderer lights, for vertex colours written by hand. |
| `linearToSrgb` | 函数 | Turns a linear color value into an sRGB one. |
| `LineCurve3D` | 类 | A straight line between two points, as a curve. |
| `LineHelper3D` | 类 | Shared base: a line mesh whose vertices are rewritten by update(). |
| `loadGltf3D` | 函数 | Parse a glTF 2.0 asset from .glb bytes, .gltf JSON bytes or an already parsed JSON object. |
| `Lod3D` | 类 | Shows exactly one child depending on the distance to the camera. |
| `mat3NormalFromMat4` | 函数 | 3x3 inverse transpose of the upper-left block, written as nine column-major floats. |
| `mat4Compose` | 函数 | Affine matrix from translation, unit quaternion and scale. |
| `mat4Copy` | 函数 | Copies a 4x4 matrix. |
| `mat4Decompose` | 函数 | Split an affine matrix; a negative determinant is folded into scale X. |
| `mat4Determinant` | 函数 | The determinant of a 4x4 matrix. |
| `mat4Identity` | 函数 | Sets a 4x4 matrix to the identity. |
| `mat4Invert` | 函数 | Returns false and leaves `out` untouched when the matrix is singular. |
| `mat4LookAt` | 函数 | World matrix of an object at `eye` whose negative Z axis points at `target`. |
| `mat4MaxScaleOnAxis` | 函数 | The largest scale a 4x4 matrix applies along an axis. |
| `mat4Multiply` | 函数 | out = a * b: with column vectors, b applies first. |
| `mat4Orthographic` | 函数 | Sets a 4x4 matrix to an orthographic projection. |
| `mat4Perspective` | 函数 | Right-handed perspective projection to clip depth [-1, 1]. |
| `Material3D` | 类 | One material class carries the superset of surface parameters; `shading` selects the lighting model. |
| `MaterialOptions3D` | 接口 | A material to make: its color and maps, its sides and alpha, its blending and depth, and its emission, normals and occlusion. |
| `mergeGeometries3D` | 函数 | Join geometries that share the same attribute set into one. |
| `mergeVertices3D` | 函数 | Weld vertices whose every attribute matches within `tolerance`, producing an indexed geometry. |
| `Mesh3D` | 类 | A geometry drawn with materials, with its morph weights and skeleton. |
| `MESH3D_LIMITS` | 值 | The most bones, instances and materials a mesh has. |
| `MESHOPT3D_LIMITS` | 值 | The largest stride and count of meshopt data. |
| `MeshoptFilter3D` | 类型 | The filter meshopt data was encoded with. |
| `MeshoptMode3D` | 类型 | What meshopt data encodes: vertex attributes, triangles or indices. |
| `MorphTarget3D` | 接口 | A morph target: the positions, and normals, it moves a geometry toward. |
| `NavAgent3D` | 类 | An agent of a crowd: where it is and how it moves; give it a target, or stop it. |
| `NavAgentOptions3D` | 接口 | An agent to add: where it starts, its radius, speed and acceleration, and the node it moves. |
| `NavCrowd3D` | 类 | Agents walking on one navigation mesh. |
| `NAVIGATION3D_LIMITS` | 值 | The most triangles, agents and grid cells navigation holds. |
| `NavLocation3D` | 接口 | Where a point is on a navigation mesh: its triangle and the point itself. |
| `NavMesh3D` | 类 | The walkable surface of a level: find paths, nearest points and ray hits on it, and set the cost of its areas. |
| `NavMeshOptions3D` | 接口 | A navigation mesh to make: the steepest walkable slope, and how close vertices are welded. |
| `NavPath3D` | 接口 | A path found on a navigation mesh: its points, whether it reaches the goal, and its length. |
| `NavPathOptions3D` | 接口 | How a path is found: the agent's radius, whether it follows the ground, and how far its ends may snap. |
| `NavPoint3D` | 类型 | A point on a navigation mesh as x, y and z. |
| `NumericArray3D` | 类型 | An array of numbers the 3D math writes into. |
| `Object3D` | 类 | A node of a 3D scene: its children, place, rotation and scale, and calls that move and find nodes. |
| `Object3DKind` | 类型 | What kind of node an object is. |
| `OrthographicCameraOptions3D` | 接口 | An orthographic camera to make: the height it sees, its aspect ratio and near and far planes. |
| `parseKtx23D` | 函数 | Read a KTX 2.0 file holding one 2D texture and its mip chain. |
| `parseRgbe3D` | 函数 | Decode a Radiance .hdr file (flat or run-length encoded, -Y +X orientation). |
| `parseTrueTypeFont3D` | 函数 | Read a TrueType font: a .ttf file, an OpenType file with TrueType (glyf) outlines, or the first font of a .ttc collection. |
| `parseTypefaceFont3D` | 函数 | Read a font in the typeface JSON format (the `*.typeface.json` files used with web 3D libraries). |
| `ParticleEmitter3D` | 类 | Emits particles on the CPU: burst some, update it each frame, or reset it. |
| `ParticleEmitterOptions3D` | 接口 | An emitter to make: how many particles and how often, how long they live, how they move, grow, change color and fade, and where they are born. |
| `PARTICLES3D_LIMITS` | 值 | The most particles an emitter holds, and the longest step it takes. |
| `ParticleShape3D` | 类型 | The shape particles are born in. |
| `Path2D3D` | 类 | A 2D outline built with pen commands; used as a contour or a hole. |
| `PerspectiveCameraOptions3D` | 接口 | A perspective camera to make: its vertical field of view, aspect ratio and near and far planes. |
| `PhongMaterialOptions3D` | 接口 | A Phong material's specular color and shininess. |
| `PHYSICS3D_LIMITS` | 值 | The most bodies, substeps, solver steps, contacts a pair keeps and parts of a compound. |
| `PHYSICS_HULL3D_LIMITS` | 值 | The most points a convex hull keeps and is made from. |
| `PHYSICS_MESH3D_LIMITS` | 值 | The most triangles a mesh shape has, and how many a leaf of its tree holds. |
| `PhysicsClient3D` | 类 | The page's end of a remote physics world. |
| `PhysicsContact3D` | 接口 | What a pair of solid bodies did to each other in one step. |
| `PhysicsPort3D` | 接口 | A Worker, a worker's global scope, a MessagePort: anything that posts and receives messages. |
| `PhysicsRaycastHit3D` | 接口 | What a ray hit: the body, where, its normal and how far. |
| `PhysicsShapeCastHit3D` | 接口 | What a cast shape hit: the body, how far it went, where, and the normal. |
| `PhysicsWorld3D` | 类 | A 3D physics world: add bodies and joints, step it, and cast rays and shapes through it. |
| `PhysicsWorldOptions3D` | 接口 | A physics world to make: its gravity, its step and substeps, its solver iterations, and whether bodies sleep. |
| `PlanarReflection3D` | 类 | A mirror camera and the target it draws into. |
| `PlanarReflectionPass3D` | 接口 | Output and inclusion settings shared by reflection draws and program preparation. |
| `PlaneGeometryOptions3D` | 接口 | A plane to make: its width and height, and their segments. |
| `Point2D` | 类型 | A point in 2D as x and y. |
| `Point3D` | 类型 | A point in 3D as x, y and z. |
| `PointLightOptions3D` | 接口 | A point light to make: how far it reaches. |
| `PolyhedronOptions3D` | 接口 | A regular solid to make: its radius, how often it is subdivided, and whether it is smooth. |
| `projectToViewport3D` | 函数 | Projects a world point into a viewport of `width` by `height` pixels through `camera`. |
| `QuadraticBezierCurve3D` | 类 | A quadratic Bézier curve through three control points. |
| `quatCopy` | 函数 | Copies a quaternion. |
| `quatFromAxisAngle` | 函数 | A quaternion that turns by an angle about an axis. |
| `quatFromEuler` | 函数 | Intrinsic XYZ Euler angles in radians (rotate X, then Y, then Z in local axes). |
| `quatFromRotationMatrix` | 函数 | Rotation part of a matrix without scale or shear. |
| `quatIdentity` | 函数 | Sets a quaternion to no rotation. |
| `quatMultiply` | 函数 | Multiplies two quaternions: the rotation of b, then a. |
| `quatNormalize` | 函数 | Scales a quaternion to length 1. |
| `quatSlerp` | 函数 | Shortest-arc spherical interpolation; falls back to nlerp for close inputs. |
| `quatToEuler` | 函数 | Inverse of quatFromEuler; writes radians into out[0..2]. |
| `Ragdoll3D` | 类 | Bodies and joints for a skeleton, created from the current pose by activate() and removed again by deactivate(). |
| `RAGDOLL3D_LIMITS` | 值 | The most parts a ragdoll has. |
| `RagdollJoint3D` | 接口 | How a ragdoll part is joined to its parent: the joint's kind, axis and limits. |
| `RagdollOptions3D` | 接口 | A ragdoll to make: its layers, friction, bounce and damping. |
| `RagdollPart3D` | 接口 | One part of a ragdoll: its bone, shape and mass, its offset, its parent and its joint. |
| `Raycaster3D` | 类 | Casts rays through a scene, from a point or from the camera through a screen point. |
| `RaycastHit3D` | 接口 | What a ray hit: how far, where, the object, its face, its texture coordinate and its instance. |
| `RaycastOptions3D` | 接口 | How a ray is cast: its near and far distances, its layers, and whether only the first hit is wanted. |
| `rayIntersectBox` | 函数 | Slab test; returns the entry distance (0 when the origin is inside) or -1. |
| `rayIntersectSphere` | 函数 | Distance along the ray to the sphere, or -1 when it misses. |
| `rayIntersectTriangle` | 函数 | Moller-Trumbore. |
| `ReflectionRenderer3D` | 接口 | Anything that can draw a scene into a render target: both first-party renderers qualify. |
| `RemoteBody3D` | 类 | The page's stand-in for a body that lives behind the port. |
| `RemoteBodyOptions3D` | 接口 | A body to add to a physics world in a worker. |
| `RemoteJoint3D` | 类 | A joint of a physics world in a worker; remove it to take it out. |
| `RemoteJointOptions3D` | 接口 | A joint to add to a physics world in a worker. |
| `RemoteRaycastHit3D` | 接口 | What a ray hit in a physics world in a worker. |
| `RemoteShape3D` | 类型 | Shapes that can be described in a message. |
| `RenderItem3D` | 接口 | One thing to draw: its mesh, geometry and material, its range, its depth and order. |
| `RenderList3D` | 类 | What a camera sees, sorted for drawing: opaque and transparent items, shadow casters and lights. |
| `RenderStats3D` | 接口 | What building a render list counted: nodes visited, culled, and lights dropped. |
| `RenderTarget3D` | 类 | Off-screen color target. |
| `RenderTargetFormat3D` | 类型 | Color storage of a render target: 8-bit sRGB, or half-float linear for values above 1. |
| `RenderTargetOptions3D` | 接口 | A render target to make: its format, its depth, and its filters and wrapping. |
| `Resource3D` | 类 | CPU-side resource with a version counter and terminal disposal. |
| `retargetAnimationClip3D` | 函数 | A clip for the target rig that moves it as `clip` moves the source rig. |
| `RetargetOptions3D` | 接口 | How a clip is moved to another skeleton: from where to where, which bones match, the root, scale and frame rate. |
| `RigidBody3D` | 类 | A body in a physics world: its kind, shape and mass, its material and layers, and calls that move and push it. |
| `RigidBodyOptions3D` | 接口 | A body to add: its kind, shape and mass, where it is, its material and damping, its layers, and the node it moves. |
| `RingGeometryOptions3D` | 接口 | A ring to make: its inner and outer radius, segments and arc. |
| `Rope3D` | 类 | A rope or cable. |
| `RopeOptions3D` | 接口 | A rope to make: from where to where, in how many segments, how slack, and which ends are pinned. |
| `sampleAnimationTrack3D` | 函数 | Evaluate one track at `time` into `out`; `hint` caches the last key index. |
| `Scene3D` | 类 | Root of a renderable graph; owns environment-wide settings. |
| `SCENE_DOCUMENT_FORMAT_3D` | 值 | The format name of a saved scene document. |
| `SCENE_DOCUMENT_VERSION_3D` | 值 | The version of the scene document format. |
| `SceneDocument3D` | 接口 | A scene saved as JSON: its nodes, geometries, materials, textures and skeletons, and what was skipped. |
| `ScreenLayer3D` | 类 | Full-screen image drawn in the same pass as the 3D scene, typically the canvas of a 2D stage. |
| `ScreenLayerOptions3D` | 接口 | A screen layer to make: its order and opacity, whether it updates itself, and which way its rows run. |
| `SdfBone3D` | 接口 | A bone of a rig: where it turns, what it moves, and the bone it hangs from. |
| `sdfBox` | 函数 | A box of `size` [width, height, depth], its edges rounded by `round` (0 for sharp; more than half the smallest side is taken as that). |
| `sdfCapsule` | 函数 | A rounded limb from `from` to `to`: `radius` thick at the start, `radiusEnd` (the same unless given) at the end. |
| `sdfCone` | 函数 | An upright cone of `height` along y, `bottom` wide at its foot and `top` (0 for a point) at its head. |
| `sdfCylinder` | 函数 | An upright cylinder of `radius` and `height` along y, its rims rounded by `round` (at most the radius or half the height). |
| `sdfDisplace` | 函数 | The surface pushed in and out by smooth noise: rocks, bark, rough earth, a lumpy creature. |
| `SdfDisplaceOptions3D` | 接口 | What `sdfDisplace` does: how far, how fine and which noise. |
| `sdfEllipsoid` | 函数 | A stretched ball with `radii` [x, y, z]: heads, bodies, eggs and stones. |
| `sdfExtrude` | 函数 | A flat `outline` of points [x, y] in the xy plane, closed, pushed `depth` deep along z about its middle, its edges rounded by `round`: signs, gables, blades, stars, letters, tiles, cut-out shapes. |
| `SdfGroupOptions3D` | 接口 | A group of shapes: `smooth` is how far, in the model's units, the blend between them reaches. |
| `sdfIntersect` | 函数 | What the shapes have in common; with `smooth`, its edges rounded. |
| `sdfLathe` | 函数 | A shape turned about the y axis from its `profile`: points [radius, height] going round a closed outline, as a potter draws half a vase. |
| `SdfLodOptions3D` | 接口 | How a model is made in levels: the mesh options, its material, and each level's triangles and distance. |
| `SdfMeshOptions3D` | 接口 | How a field becomes a mesh. |
| `sdfMirror` | 函数 | The shape and its mirror image across the plane through the origin square to `axis` ('x' unless given): make one eye, ear, arm or leg on the positive side and get the pair. |
| `SdfOptions3D` | 接口 | Where a shape goes and how it looks: moved by `at`, turned by `rotation`, scaled by `scale`, painted `color`. |
| `sdfPattern` | 函数 | `shape` with a pattern painted over its colours, in the coordinates of the model; the surface does not move. |
| `SdfPatternOptions3D` | 接口 | A pattern painted over a shape's colours. |
| `SdfPoseKey3D` | 类型 | A pose key: a time in seconds, the bone's turn as Euler angles in radians, and optionally how far it moves. |
| `SdfRig3D` | 接口 | A model that moves: its root to add to a scene, its skinned mesh, its bones by name, and its animation. |
| `SdfRigOptions3D` | 接口 | How a rig is made: the options of its mesh, its material, and how wide a joint bends. |
| `sdfRound` | 函数 | The shape grown by `radius` all round, its edges rounded by as much. |
| `SdfShape3D` | 类 | A shape as a signed distance field: negative inside, positive outside, zero on the surface. |
| `sdfShell` | 函数 | A hollow skin of the shape, `thickness` thick: bowls, pots, helmets, when cut open. |
| `sdfSphere` | 函数 | A ball of `radius`. |
| `sdfSubtract` | 函数 | `base` with `cut` taken away; with `smooth`, the edges of the hollow rounded. |
| `sdfTorus` | 函数 | A ring lying flat: `radius` to the middle of the tube, `tube` the tube's radius. |
| `sdfUnion` | 函数 | The shapes joined into one; with `smooth`, blended where they meet. |
| `SERIALIZE3D_LIMITS` | 值 | The most nodes, embedded texture bytes and document bytes a scene document has. |
| `SerializeOptions3D` | 接口 | How a scene is saved: the key each texture is saved by. |
| `serializeScene3D` | 函数 | Write the subtree under `root` as JSON-safe data. |
| `servePhysics3D` | 函数 | Run a physics world on this end of a port and answer the messages of a PhysicsClient3D. |
| `setColor3D` | 函数 | Writes a color into a float array as red, green and blue. |
| `Shading3D` | 类型 | How a material is lit: not at all, Lambert, Phong, physically based, toon, or by a matcap. |
| `Shape3D` | 类 | A filled outline with optional holes. |
| `ShapeDefinition3D` | 类型 | The shape of a body: a sphere, box, capsule, plane, convex hull, triangle mesh, or several moving as one. |
| `Side3D` | 类型 | Which sides of a material's triangles are drawn. |
| `signedArea2D` | 函数 | The signed area of a 2D polygon: positive when its points run counterclockwise. |
| `simplifyGeometry3D` | 函数 | A copy of an indexed triangle geometry with fewer triangles; the geometry given is not changed. |
| `SimplifyOptions3D` | 接口 | How far to simplify. |
| `SimplifyResult3D` | 接口 | How a simplification went. |
| `Skeleton3D` | 类 | Ordered bones with their inverse bind matrices; one instance may drive many meshes. |
| `SkeletonHelper3D` | 类 | A line from every bone to its parent bone. |
| `SkinnedInstancedMesh3D` | 类 | Many copies of one skinned mesh in a single draw call, each at its own place in its own clip. |
| `sphereFromBox` | 函数 | The sphere around a box. |
| `SphereGeometryOptions3D` | 接口 | A sphere to make: its radius and segments. |
| `sphereTransform` | 函数 | Moves and scales a sphere by a 4x4 matrix. |
| `SpotLightOptions3D` | 接口 | A spot light to make: its cone's angle and soft edge. |
| `Sprite3D` | 类 | Camera-facing textured quad. |
| `SpriteMaterialOptions3D` | 接口 | A sprite material: whether sprites shrink with distance, and their rotation. |
| `srgbToLinear` | 函数 | Turns an sRGB color value into a linear one. |
| `StandardMaterialOptions3D` | 接口 | A physically based material's metalness and roughness, and how much the environment lights it. |
| `STATE_MACHINE3D_LIMITS` | 值 | The most states and transitions a state machine has, and how many transitions it takes in one update. |
| `StateBlendEntry3D` | 接口 | One clip of a blend state and the parameter value it shows at. |
| `StateCondition3D` | 接口 | A condition of a transition: a parameter compared with a value. |
| `StateConditionOperator3D` | 类型 | How a condition compares a parameter with its value. |
| `StateOptions3D` | 接口 | A state to add: its clip or blend, whether it loops, its speed, and what it calls on entering and leaving. |
| `StateParameter3D` | 类型 | The value of a state machine parameter. |
| `StrandOptions3D` | 接口 | How a strand of points behaves: its gravity, damping, iterations, thickness, and what it collides with. |
| `SurfaceKind3D` | 类型 | The surfaces the shader can draw. |
| `SurfaceMaterialOptions3D` | 接口 | A material with a surface: the standard material's options and how the surface looks. |
| `surfaceShaderSources3D` | 函数 | The shader sources of a surface: its height, the colour it gives and the relief it gives, in GLSL and WGSL. |
| `Terrain3D` | 类 | A height field drawn as a grid of chunk meshes. |
| `TERRAIN3D_LIMITS` | 值 | The largest height field, chunk and number of levels and chunks terrain has, and the most streamed tiles. |
| `TerrainMaterialOptions3D` | 接口 | A terrain material's layers, their weights, and how often they repeat. |
| `TerrainOptions3D` | 接口 | Terrain to make: its chunks, levels of detail and their distance, its skirts, texture scale and colors. |
| `TerrainStream3D` | 类 | Terrain loaded in tiles around the camera: read heights, and update it as the camera moves. |
| `TerrainStreamOptions3D` | 接口 | Streamed terrain to make: its tile size and view distance, how a tile is loaded, and what is called as tiles come and go. |
| `TerrainTile3D` | 接口 | One tile of streamed terrain: where it is, its height field and terrain. |
| `TEXT3D_LIMITS` | 值 | The most characters, font bytes and glyph points 3D text has. |
| `TextGeometryOptions3D` | 接口 | 3D text to make: how deep it is extruded, and in how many steps. |
| `TextLayoutOptions3D` | 接口 | How 3D text is laid out: its size, curve detail, spacing, line height and alignment. |
| `Texture3D` | 类 | A texture for 3D materials; set its source to change its picture. |
| `TEXTURE3D_LIMITS` | 值 | The largest texture edge and size. |
| `TextureColorSpace3D` | 类型 | Whether a texture's values are sRGB colors or linear data. |
| `TextureFilter3D` | 类型 | How a texture is sampled: the nearest texel, or blended. |
| `TextureOptions3D` | 接口 | A texture to make: its name, wrapping and filters, its mipmaps and color space, whether it is flipped, and its anisotropy. |
| `TexturePixels3D` | 接口 | Tightly packed straight-alpha RGBA8 rows, top row first. |
| `TextureSource3D` | 类型 | What a texture is made from: pixels, compressed pixels, or an image the browser decoded. |
| `TextureWrap3D` | 类型 | What a texture does past its edges: repeats, clamps or mirrors. |
| `toNonIndexedGeometry3D` | 函数 | Copy with every triangle owning its vertices, as needed for per-face data. |
| `Topology3D` | 类型 | How a geometry's vertices are joined: as triangles, lines, a strip of lines, or points. |
| `TorusGeometryOptions3D` | 接口 | A torus to make: its radius, tube and segments. |
| `TorusKnotGeometryOptions3D` | 接口 | A torus knot to make: its radius and tube, segments, and its windings p and q. |
| `Trail3D` | 类 | Add the trail to the scene itself, not under the object it follows: its vertices are world positions. |
| `TRAIL3D_LIMITS` | 值 | The most points a trail has. |
| `TrailOptions3D` | 接口 | A trail to make: what it follows, how long it lasts, how far apart its points are, and how its width, color and opacity change. |
| `transformGeometry3D` | 函数 | Bake a 4x4 transform into positions, normals and tangents, in place. |
| `TransformGizmo3D` | 类 | Handles to move, turn or scale an object by dragging them, with snapping. |
| `TransformGizmoOptions3D` | 接口 | A gizmo to make: its mode, its space and its size. |
| `TransitionOptions3D` | 接口 | A transition to add: from and to which state, how long it fades, its conditions, its exit time and whether it can be interrupted. |
| `TriangleMeshBuffers3D` | 接口 | The arrays of a triangle mesh shape, its hierarchy included: what `exportBuffers` gives and `fromBuffers` takes. |
| `TriangleMeshShape3D` | 类 |  |
| `triangulateShape3D` | 函数 | Triangulate an outline with holes by ear clipping. |
| `TubeGeometryOptions3D` | 接口 | A tube to make along a curve: its segments, radius and whether it closes. |
| `vec3Add` | 函数 | Adds two vectors. |
| `vec3Copy` | 函数 | Copies a vector. |
| `vec3Cross` | 函数 | The cross product of two vectors. |
| `vec3Distance` | 函数 | The distance between two points. |
| `vec3Dot` | 函数 | The dot product of two vectors. |
| `vec3Length` | 函数 | The length of a vector. |
| `vec3Lerp` | 函数 | The point a fraction of the way from one vector to another. |
| `vec3Normalize` | 函数 | A zero-length input yields the zero vector instead of NaN. |
| `vec3Scale` | 函数 | Multiplies a vector by a number. |
| `vec3Set` | 函数 | Sets a vector's x, y and z. |
| `vec3Sub` | 函数 | Takes one vector from another. |
| `vec3TransformDirection` | 函数 | Transform a direction (w = 0) by the upper 3x3; the result is not normalized. |
| `vec3TransformMat4` | 函数 | Transform a point (w = 1) with perspective division. |
| `vec3TransformQuat` | 函数 | Turns a vector by a quaternion. |
| `Vehicle3D` | 类 | Drives a chassis body on ray wheels. |
| `VEHICLE3D_LIMITS` | 值 | The most wheels a vehicle has. |
| `VehicleOptions3D` | 接口 | A vehicle to make: its wheels, its engine and brakes, its steering, its top speed and how it rolls. |
| `ViewportPoint3D` | 接口 | Where a world point falls in a viewport, for labels, markers and pointers drawn over the picture. |
| `VolumetricFog3D` | 类 | Add one to the scene's root and keep `receiveShadow` on. |
| `VolumetricFogOptions3D` | 接口 | Volumetric fog to make: its color and density, its height and falloff, its distance, and how much the sun and lights shine through it. |
| `Water3D` | 类 | A horizontal water surface. |
| `WaterOptions3D` | 接口 | Water to make: its size and detail, its waves and ripples, its colors and clarity, its reflections, foam and caustics. |
| `Wheel3D` | 接口 | A wheel of a vehicle: its suspension and grip, and whether it touches the ground. |
| `WheelOptions3D` | 接口 | A wheel to add: where, its radius and suspension, whether it steers or drives, its grip and the node it turns. |
| `WORLD3D_LIMITS` | 值 | How deep a scene nests, how many children a node has, and how long a name is, at most. |
| `World3DError` | 类 | Stable machine-readable code plus a human-readable detail and the original cause. |
| `World3DErrorCode` | 类型 | What went wrong in the 3D world. |

## `@egret/engine/webgl2/world3d`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `Atmosphere3D` | 类 | Height fog and light shafts for `renderer.postProcess.custom`. |
| `AtmosphereOptions3D` | 接口 | An atmosphere to make: its fog's color, density and height, and its light shafts. |
| `AudioListener3D` | 类 | Ears of the scene. |
| `AudioListenerOptions3D` | 接口 | An audio listener to make: its audio context and volume. |
| `CanvasFontOptions3D` | 接口 | A canvas font to make: the page's font family, weight and style, how finely it is traced, and how much it is smoothed. |
| `captureCubeTexture3D` | 函数 | Render six 90-degree views from `position` and return them as a cube texture with mipmaps. |
| `createAtmosphere3D` | 函数 | Makes height fog and light shafts for a scene. |
| `createAudioListener3D` | 函数 | Makes the listener 3D sounds are heard by, usually on the camera. |
| `createCanvasFont3D` | 函数 | A `Font3D` whose glyphs are traced from the page's own fonts, for 3D text in any script the page can draw, such as the Chinese of a road sign, without a font file. |
| `createCustomPost3D` | 函数 | Makes a post-processing pass of your own shader. |
| `createDynamicResolution3D` | 函数 | Makes a resolution scale that drops when frames are slow and rises when they are fast. |
| `createFlyControls3D` | 函数 | Makes fly controls for a camera on an element. |
| `createFollowControls3D` | 函数 | Makes follow controls for a follow camera on an element. |
| `createOrbitControls3D` | 函数 | Makes orbit controls for a camera on an element. |
| `createOverlayScreenMarkers3D` | 函数 | A display layer for World3DOverlay. |
| `createPositionalAudio3D` | 函数 | Makes a sound that plays from a place in the scene. |
| `createPostProcessSettings3D` | 函数 | Post-processing settings with every effect off. |
| `createScreenMarkers3D` | 函数 | A layer of page elements that follow scene points. |
| `createTransformControls3D` | 函数 | Makes transform controls for a camera on an element. |
| `createWebGL2Renderer3D` | 函数 | Makes a renderer that draws 3D scenes with WebGL2. |
| `createWorld3DApp` | 函数 | Starts a World3D game on `canvas`: an Engine, a renderer for the chosen backend and quality, and a frame loop. |
| `createWorld3DHost` | 函数 | Host adapter that reserves `canvas` for one Engine. |
| `createWorld3DOverlay` | 函数 | Lays a transparent 2D stage over `canvas` (the 3D canvas, which must sit in a positioned parent) and starts it. |
| `createWorld3DStats` | 函数 | Makes a panel that shows a 3D view's frame times and draws. |
| `createWorld3DView` | 函数 | Makes a view that draws a scene on each tick of the Engine's clock. |
| `CUBE_TEXTURE_ASSET_3D` | 值 | A cube texture. |
| `CubeCaptureOptions3D` | 接口 | How a cube is captured around a point: its size, near and far planes, and layers. |
| `CustomPost3D` | 接口 | A full-screen hook that runs after ambient occlusion and bloom and before tone mapping. |
| `DynamicResolution3D` | 接口 | A drawing resolution that follows the frame rate: down quickly when frames are slow, up slowly when they are not. |
| `DynamicResolutionOptions3D` | 接口 | How dynamic resolution moves: its least and greatest scale, its step, and the frame rates and times that move it. |
| `FlyControls3D` | 类 | Moves a camera with the keyboard and mouse, walking or flying. |
| `FlyControlsKeys3D` | 接口 | The keys of fly controls: forward, back, left, right, up, down and sprint. |
| `FlyControlsOptions3D` | 接口 | Fly controls to make: how fast they move and look, whether they fly, use pointer lock or damp, and their keys. |
| `FollowControls3D` | 类 | Turns and zooms a follow camera with the mouse and touch. |
| `FollowControlsOptions3D` | 接口 | Follow controls to make: how fast they turn and zoom. |
| `GLTF_ASSET_3D` | 值 | A loaded glTF file. |
| `GltfUrlLoadOptions3D` | 接口 | glTF loading options: download limits plus the optional KTX2, meshopt and Draco decoders. |
| `isSoftwareRendered3D` | 函数 | Whether WebGL here is drawn by software (SwiftShader, llvmpipe and the like), as in a headless browser, a virtual machine or a page whose graphics card is blocked. |
| `loadCubeTexture3D` | 函数 | Load six square images in +X, -X, +Y, -Y, +Z, -Z order as a cube texture. |
| `loadGltfFromUrl3D` | 函数 | Load a .glb or .gltf file; relative buffer and image URIs resolve against `url`. |
| `LoadOptions3D` | 接口 | How a 3D asset is loaded: a signal that cancels it, and the most bytes it reads. |
| `loadTexture3D` | 函数 | Load an image or KTX2 file as a texture. |
| `OrbitControls3D` | 类 | Turns a camera around a target, pans and zooms it, with the mouse and touch. |
| `OrbitControlsOptions3D` | 接口 | Orbit controls to make: their target, distances and angles, how fast they turn, pan and zoom, and which of these are on. |
| `OverlayScreenMarker3D` | 接口 | A borrowed native display marker; the layer owns its holder, not its artwork. |
| `OverlayScreenMarkerOptions3D` | 接口 | Options for a native display marker; its visible footprint is kept within the selected part of the overlay. |
| `OverlayScreenMarkers3D` | 接口 | A layer of native display objects over the 3D picture. |
| `OverlayScreenMarkersOptions3D` | 接口 | The native stage and the actual 3D canvas whose scene the camera projects. |
| `pickWorld3DBackend` | 函数 | The backend asked for by the address (`backend=webgpu`), or `fallback`. |
| `pickWorld3DQuality` | 函数 | The picture quality for this device: the address's `quality`, then a stored choice, then `low` for software rendering, a finger or a window shorter than 600 pixels, `medium` for 4 GB of memory or less, and `high` otherwise. |
| `play3d` | 函数 | Starts a 3D game in the page. |
| `play3dAttached` | 函数 | Starts transparent Play above an existing 3D canvas. |
| `Play3DAttachedOptions` | 接口 | A Play interface over a caller-configured 3D surface, sharing the Play clock and Scope. |
| `Play3DAttachedSession` | 接口 |  |
| `Play3DGame` | 接口 | Everything a small 3D game is given: its scene and camera, its input, and calls that make, move and light things. |
| `Play3DOptions` | 接口 | A small 3D game to start: its setup and update, and the options of a 2D play game. |
| `PLAY_LOOKS_3D` | 值 | The looks every game is given, by name. |
| `PlayBurst3D` | 接口 | A burst of particles: its color and count, how fast and how long they fly, their size and gravity. |
| `PlayCamera3D` | 接口 | The camera: where it is and what it looks at, by plain numbers. |
| `PlayFollow3D` | 接口 | How the camera follows: where it sits behind, how smoothly, and whether it turns with the target. |
| `PlayLamp3D` | 类 | A lamp: light from a point of the world that fades out by `range`. |
| `PlayLampOptions3D` | 接口 | A lamp to light: how bright, and how far it reaches. |
| `PlayLook3D` | 接口 | How a 3D play game looks: its background and sky, its ground, its light and sun, and its fog. |
| `PlayLookName3D` | 类型 | What `play3d` gives: everything `play` gives for the interface and the game's time, and a world of things. |
| `PlayPlace3D` | 接口 | Where a thing is made. |
| `PlayThing3D` | 类 | A thing of the world: a box, a ball, a cylinder or a cone. |
| `PlayWeather3D` | 类型 | What falls from the sky: snow, rain, or nothing. |
| `PlayWeatherOptions3D` | 接口 | Weather to show: how much rain or snow. |
| `PositionalAudio3D` | 类 | A sound placed in the scene. |
| `PositionalAudioOptions3D` | 接口 | A positional sound to make: its buffer and volume, how it fades with distance, its cone, rate, and whether it is spatial. |
| `POST3D_LIMITS` | 值 | The most bloom levels. |
| `PostProcessSettings3D` | 接口 | What is done to a frame after it is drawn: bloom, antialiasing, color, vignette, ambient occlusion, depth of field and outlines. |
| `registerWorld3DAssets` | 函数 | Register the World3D asset providers on an AssetManager. |
| `Renderer3D` | 接口 | What both world3d backends provide; views and tools depend on this only. |
| `Renderer3DInfo` | 接口 | What a renderer drew in its last frame: draws, triangles, culled nodes, lights, shadow maps and resources. |
| `SCENE_ASSET_3D` | 值 | A scene document written by serializeScene3D. |
| `ScreenMarker3D` | 接口 | A marker over the screen that follows a point of the scene: its element and where it is. |
| `ScreenMarkerInsets3D` | 接口 | CSS-pixel margins for independent edges. |
| `ScreenMarkerOptions3D` | 接口 | A screen marker to add: what it points at, its offset, whether it sticks to the screen's edge, and how far it shows. |
| `ScreenMarkers3D` | 接口 | Elements over the screen that follow points of the scene: add them, and update them each frame. |
| `ScreenMarkersOptions3D` | 接口 | Screen markers to make: the container they go in, and the camera they follow. |
| `startWorld3DLoop` | 函数 | Advance the Engine clock once per display frame. |
| `TEXTURE_ASSET_3D` | 值 | A 2D texture loaded from an image or KTX2 file. |
| `TextureLoadOptions3D` | 接口 | Texture loading options; `transcodeKtx2` handles KTX2 payloads the built-in reader cannot use directly. |
| `ToneMapping3D` | 类型 | How a renderer maps bright colors into the screen's range. |
| `TransformControls3D` | 类 | Drags a transform gizmo with the mouse and touch to move, turn or scale an object. |
| `WebGL2GeometryPreparationOptions` | 接口 | Bounded, cooperative preparation of the renderer's ordinary geometry cache. |
| `WebGL2ProgramVariant3D` | 接口 | One material program for an expected draw. |
| `WebGL2Renderer3D` | 类 | Draws 3D scenes with WebGL2: set its size, render a scene from a camera, and read what it drew. |
| `WebGL2Renderer3DOptions` | 接口 | A WebGL2 renderer to make: its canvas and context, its tone mapping and exposure, its shadows, and what is called when the context is lost and restored. |
| `WORLD3D_QUALITY_PRESETS` | 值 | The three qualities. |
| `World3DApp` | 接口 | A 3D app: its Engine, renderer and view, its quality and resolution, and calls that show a scene and start and stop it. |
| `World3DAppOptions` | 接口 | A 3D app to make: its backend and quality, dynamic resolution, tone mapping and failure callbacks. |
| `World3DAssetOptions` | 接口 | How a 3D app loads assets: how URLs are resolved, how many bytes, and how textures and compressed data are decoded. |
| `World3DBackend` | 类型 | Which GPU interface a 3D app draws with. |
| `World3DClockSource` | 接口 | The part of an Engine this view needs: its explicit game clock. |
| `World3DDeviceHints` | 接口 | What `pickWorld3DQuality` reads about the device. |
| `World3DFrameMetrics` | 接口 | What a frame drew: its draws and triangles, its CPU time, and its passes and reflections. |
| `World3DFramePass` | 接口 | One pass of a frame: its view and kind, its size, its draws and triangles, and its times. |
| `World3DGpuTiming` | 类型 | How long a pass took on the GPU, or why that is not known. |
| `World3DLoopOptions` | 接口 |  |
| `World3DLoopSource` | 接口 | What drives a 3D view: an Engine's clock and the call that advances it. |
| `World3DLoopTiming` | 接口 | A 3D RAF callback and its CPU clock advance, on the same time origin as 2D loop timings. |
| `World3DOverlay` | 接口 | A 2D game drawn on a canvas over a 3D view. |
| `World3DOverlayOptions` | 接口 | A 2D overlay to make over a 3D view: its size, backend, pixel ratio, update, and whether it lets input through. |
| `World3DOverlayStartupTiming` | 接口 |  |
| `World3DPassKind` | 类型 | What a pass drew: color, shadows, a depth prepass, an outline mask or post-processing. |
| `World3DQuality` | 类型 | How much a 3D app draws: low, medium or high quality. |
| `World3DQualityPreset` | 接口 | What one picture quality turns on. |
| `World3DShowOptions` | 接口 | What a 3D app shows: its update, mixers and controls. |
| `World3DStats` | 接口 | Frame times, frame rate, draws and triangles of a 3D view, measured each frame. |
| `World3DStatsOptions` | 接口 | 3D stats to make: the container they show in, how they smooth, and how often they refresh. |
| `World3DView` | 类 | Draws a scene from a camera on each tick of the Engine, updating its mixers and controls. |
| `World3DViewKind` | 类型 | Which view a pass drew: the main one, a reflection, or offscreen. |
| `World3DViewOptions` | 接口 | A 3D view to make: its renderer, scene and camera, its mixers and controls, its update, and how it resizes. |
| `World3DViewTiming` | 接口 | CPU phases of a World3D view tick; a rendered result is not GPU completion. |

## `@egret/engine/webgpu/world3d`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `Atmosphere3D` | 类 | Height fog and light shafts for `renderer.postProcess.custom`. |
| `AtmosphereOptions3D` | 接口 | An atmosphere to make: its fog's color, density and height, and its light shafts. |
| `AudioListener3D` | 类 | Ears of the scene. |
| `AudioListenerOptions3D` | 接口 | An audio listener to make: its audio context and volume. |
| `CanvasFontOptions3D` | 接口 | A canvas font to make: the page's font family, weight and style, how finely it is traced, and how much it is smoothed. |
| `captureCubeTexture3D` | 函数 | Render six 90-degree views from `position` and return them as a cube texture with mipmaps. |
| `createAtmosphere3D` | 函数 | Makes height fog and light shafts for a scene. |
| `createAudioListener3D` | 函数 | Makes the listener 3D sounds are heard by, usually on the camera. |
| `createCanvasFont3D` | 函数 | A `Font3D` whose glyphs are traced from the page's own fonts, for 3D text in any script the page can draw, such as the Chinese of a road sign, without a font file. |
| `createCustomPost3D` | 函数 | Makes a post-processing pass of your own shader. |
| `createDynamicResolution3D` | 函数 | Makes a resolution scale that drops when frames are slow and rises when they are fast. |
| `createFlyControls3D` | 函数 | Makes fly controls for a camera on an element. |
| `createFollowControls3D` | 函数 | Makes follow controls for a follow camera on an element. |
| `createOrbitControls3D` | 函数 | Makes orbit controls for a camera on an element. |
| `createOverlayScreenMarkers3D` | 函数 | A display layer for World3DOverlay. |
| `createPositionalAudio3D` | 函数 | Makes a sound that plays from a place in the scene. |
| `createPostProcessSettings3D` | 函数 | Post-processing settings with every effect off. |
| `createScreenMarkers3D` | 函数 | A layer of page elements that follow scene points. |
| `createTransformControls3D` | 函数 | Makes transform controls for a camera on an element. |
| `createWebGPURenderer3D` | 函数 | Acquire a device (unless one is borrowed) and create the WebGPU renderer. |
| `createWorld3DApp` | 函数 | Starts a World3D game on `canvas`: an Engine, a renderer for the chosen backend and quality, and a frame loop. |
| `createWorld3DHost` | 函数 | Host adapter that reserves `canvas` for one Engine. |
| `createWorld3DOverlay` | 函数 | Lays a transparent 2D stage over `canvas` (the 3D canvas, which must sit in a positioned parent) and starts it. |
| `createWorld3DStats` | 函数 | Makes a panel that shows a 3D view's frame times and draws. |
| `createWorld3DView` | 函数 | Makes a view that draws a scene on each tick of the Engine's clock. |
| `CUBE_TEXTURE_ASSET_3D` | 值 | A cube texture. |
| `CubeCaptureOptions3D` | 接口 | How a cube is captured around a point: its size, near and far planes, and layers. |
| `CustomPost3D` | 接口 | A full-screen hook that runs after ambient occlusion and bloom and before tone mapping. |
| `DynamicResolution3D` | 接口 | A drawing resolution that follows the frame rate: down quickly when frames are slow, up slowly when they are not. |
| `DynamicResolutionOptions3D` | 接口 | How dynamic resolution moves: its least and greatest scale, its step, and the frame rates and times that move it. |
| `FlyControls3D` | 类 | Moves a camera with the keyboard and mouse, walking or flying. |
| `FlyControlsKeys3D` | 接口 | The keys of fly controls: forward, back, left, right, up, down and sprint. |
| `FlyControlsOptions3D` | 接口 | Fly controls to make: how fast they move and look, whether they fly, use pointer lock or damp, and their keys. |
| `FollowControls3D` | 类 | Turns and zooms a follow camera with the mouse and touch. |
| `FollowControlsOptions3D` | 接口 | Follow controls to make: how fast they turn and zoom. |
| `GLTF_ASSET_3D` | 值 | A loaded glTF file. |
| `GltfUrlLoadOptions3D` | 接口 | glTF loading options: download limits plus the optional KTX2, meshopt and Draco decoders. |
| `isSoftwareRendered3D` | 函数 | Whether WebGL here is drawn by software (SwiftShader, llvmpipe and the like), as in a headless browser, a virtual machine or a page whose graphics card is blocked. |
| `loadCubeTexture3D` | 函数 | Load six square images in +X, -X, +Y, -Y, +Z, -Z order as a cube texture. |
| `loadGltfFromUrl3D` | 函数 | Load a .glb or .gltf file; relative buffer and image URIs resolve against `url`. |
| `LoadOptions3D` | 接口 | How a 3D asset is loaded: a signal that cancels it, and the most bytes it reads. |
| `loadTexture3D` | 函数 | Load an image or KTX2 file as a texture. |
| `OrbitControls3D` | 类 | Turns a camera around a target, pans and zooms it, with the mouse and touch. |
| `OrbitControlsOptions3D` | 接口 | Orbit controls to make: their target, distances and angles, how fast they turn, pan and zoom, and which of these are on. |
| `OverlayScreenMarker3D` | 接口 | A borrowed native display marker; the layer owns its holder, not its artwork. |
| `OverlayScreenMarkerOptions3D` | 接口 | Options for a native display marker; its visible footprint is kept within the selected part of the overlay. |
| `OverlayScreenMarkers3D` | 接口 | A layer of native display objects over the 3D picture. |
| `OverlayScreenMarkersOptions3D` | 接口 | The native stage and the actual 3D canvas whose scene the camera projects. |
| `pickWorld3DBackend` | 函数 | The backend asked for by the address (`backend=webgpu`), or `fallback`. |
| `pickWorld3DQuality` | 函数 | The picture quality for this device: the address's `quality`, then a stored choice, then `low` for software rendering, a finger or a window shorter than 600 pixels, `medium` for 4 GB of memory or less, and `high` otherwise. |
| `play3dAttached` | 函数 | Starts transparent Play above an existing 3D canvas. |
| `Play3DAttachedOptions` | 接口 | A Play interface over a caller-configured 3D surface, sharing the Play clock and Scope. |
| `Play3DAttachedSession` | 接口 |  |
| `PositionalAudio3D` | 类 | A sound placed in the scene. |
| `PositionalAudioOptions3D` | 接口 | A positional sound to make: its buffer and volume, how it fades with distance, its cone, rate, and whether it is spatial. |
| `POST3D_LIMITS` | 值 | The most bloom levels. |
| `PostProcessSettings3D` | 接口 | What is done to a frame after it is drawn: bloom, antialiasing, color, vignette, ambient occlusion, depth of field and outlines. |
| `registerWorld3DAssets` | 函数 | Register the World3D asset providers on an AssetManager. |
| `Renderer3D` | 接口 | What both world3d backends provide; views and tools depend on this only. |
| `Renderer3DInfo` | 接口 | What a renderer drew in its last frame: draws, triangles, culled nodes, lights, shadow maps and resources. |
| `SCENE_ASSET_3D` | 值 | A scene document written by serializeScene3D. |
| `ScreenMarker3D` | 接口 | A marker over the screen that follows a point of the scene: its element and where it is. |
| `ScreenMarkerInsets3D` | 接口 | CSS-pixel margins for independent edges. |
| `ScreenMarkerOptions3D` | 接口 | A screen marker to add: what it points at, its offset, whether it sticks to the screen's edge, and how far it shows. |
| `ScreenMarkers3D` | 接口 | Elements over the screen that follow points of the scene: add them, and update them each frame. |
| `ScreenMarkersOptions3D` | 接口 | Screen markers to make: the container they go in, and the camera they follow. |
| `startWorld3DLoop` | 函数 | Advance the Engine clock once per display frame. |
| `TEXTURE_ASSET_3D` | 值 | A 2D texture loaded from an image or KTX2 file. |
| `TextureLoadOptions3D` | 接口 | Texture loading options; `transcodeKtx2` handles KTX2 payloads the built-in reader cannot use directly. |
| `ToneMapping3D` | 类型 | How a renderer maps bright colors into the screen's range. |
| `TransformControls3D` | 类 | Drags a transform gizmo with the mouse and touch to move, turn or scale an object. |
| `WebGPURenderer3D` | 类 | Draws 3D scenes with WebGPU: set its size, render a scene from a camera, and read what it drew. |
| `WebGPURenderer3DOptions` | 接口 | A WebGPU renderer to make: its canvas and device, its tone mapping and exposure, its shadows, and what is called when the device is lost. |
| `WORLD3D_QUALITY_PRESETS` | 值 | The three qualities. |
| `World3DApp` | 接口 | A 3D app: its Engine, renderer and view, its quality and resolution, and calls that show a scene and start and stop it. |
| `World3DAppOptions` | 接口 | A 3D app to make: its backend and quality, dynamic resolution, tone mapping and failure callbacks. |
| `World3DAssetOptions` | 接口 | How a 3D app loads assets: how URLs are resolved, how many bytes, and how textures and compressed data are decoded. |
| `World3DBackend` | 类型 | Which GPU interface a 3D app draws with. |
| `World3DClockSource` | 接口 | The part of an Engine this view needs: its explicit game clock. |
| `World3DDeviceHints` | 接口 | What `pickWorld3DQuality` reads about the device. |
| `World3DLoopOptions` | 接口 |  |
| `World3DLoopSource` | 接口 | What drives a 3D view: an Engine's clock and the call that advances it. |
| `World3DLoopTiming` | 接口 | A 3D RAF callback and its CPU clock advance, on the same time origin as 2D loop timings. |
| `World3DOverlay` | 接口 | A 2D game drawn on a canvas over a 3D view. |
| `World3DOverlayOptions` | 接口 | A 2D overlay to make over a 3D view: its size, backend, pixel ratio, update, and whether it lets input through. |
| `World3DOverlayStartupTiming` | 接口 |  |
| `World3DQuality` | 类型 | How much a 3D app draws: low, medium or high quality. |
| `World3DQualityPreset` | 接口 | What one picture quality turns on. |
| `World3DShowOptions` | 接口 | What a 3D app shows: its update, mixers and controls. |
| `World3DStats` | 接口 | Frame times, frame rate, draws and triangles of a 3D view, measured each frame. |
| `World3DStatsOptions` | 接口 | 3D stats to make: the container they show in, how they smooth, and how often they refresh. |
| `World3DView` | 类 | Draws a scene from a camera on each tick of the Engine, updating its mixers and controls. |
| `World3DViewOptions` | 接口 | A 3D view to make: its renderer, scene and camera, its mixers and controls, its update, and how it resizes. |
| `World3DViewTiming` | 接口 | CPU phases of a World3D view tick; a rendered result is not GPU completion. |

## `@egret/engine/resources`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `ContentBinding` | 接口 | One resource a content loader binds: its id, its kind and its manifest binding. |
| `ContentGroup` | 接口 | All returned values are borrowed until this group or its owning Scope retires. |
| `ContentLoader` | 接口 | One manifest/source identity; multiple groups share the existing asset manager. |
| `ContentProviderFactory` | 类型 | Makes the providers that load a content loader's resources, given what they bind. |
| `ContentProviders` | 接口 | Host providers own byte integrity/UTF-8 decoding; the core validates artifact semantics. |
| `createContentLoader` | 函数 | One manifest/source catalog, independent of global IDs and of other loaders. |
| `createFontContentLoader` | 函数 | One typed font catalog over the existing manager and genuine dependency groups. |
| `createManifestAssetBinding` | 函数 | Binds one asset of an admitted manifest to an asset type, for its group to load. |
| `FontContentAsset` | 接口 | A loaded font: its id, family and identity, its size and format, and a copy of its bytes. |
| `FontContentBinding` | 接口 | One font a font content loader binds: its id, family and manifest binding. |
| `FontContentGroup` | 接口 | Fonts loaded together: wait for them, read them, and dispose of them together. |
| `FontContentLoader` | 接口 | Loads groups of fonts from a manifest. |
| `FontContentProviderFactory` | 类型 | Makes the provider that loads the bytes of a font content loader's fonts. |
| `ManifestAssetBinding` | 接口 | A genuine invariant ref paired with one exact admitted manifest entry. |
| `ManifestAssetGroup` | 接口 | Scope-owned dependency group. |
| `ManifestBinding` | 接口 | Immutable resource metadata; only the optional binding factory creates it. |
| `ManifestGroupOptions` | 接口 | How urgently a manifest group loads: for what is needed now, or in the background. |

## `@egret/engine/web/resources`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createManifestByteSource` | 函数 | Reads a manifest's files from a base URL, checking each one's length and SHA-256. |
| `createManifestContentLoader` | 函数 | Integrity-checked PNG/UTF-8 transport plus the DOM-free content assembly. |
| `createManifestFontContentLoader` | 函数 | Fonts share the authenticated byte transport and the Engine's existing resource manager. |
| `createManifestTextureProvider` | 函数 | Source authentication precedes every caller-controlled options read. |
| `ManifestByteSource` | 接口 | Reads a manifest's files over the network and checks their digests. |
| `ManifestByteSourceOptions` | 接口 | A manifest byte source to make: its profile, the URL it fetches from, its deadline and retries. |
| `ManifestByteSourceStatus` | 接口 | How many reads a byte source has now and at most, and whether it was full. |
| `ManifestContentLoader` | 接口 | A content loader for a manifest in the browser: its status, and a call that closes it. |
| `ManifestFontContentLoader` | 接口 | A font content loader for a manifest, with the byte source it reads from. |
| `ManifestTextureProvider` | 接口 | A texture provider for a manifest's images, with its status. |
| `ManifestTextureProviderOptions` | 接口 | A manifest texture provider to make: the ports it decodes with. |
| `ManifestTextureProviderStatus` | 接口 | How many textures a manifest texture provider holds now and at most, and whether it was full. |

## `@egret/engine/input`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createKeyboardInput` | 函数 | Keyboard input for the stage: key events go to the focused target, and focus moves with Tab. |
| `createPointerInput` | 函数 | Pointer input for the stage: touches, mouse buttons and pens become contacts delivered to the nodes under them. |
| `PointerCancelReason` | 类型 | Why a pointer was cancelled. |
| `PointerContact` | 接口 | A retained value: sequence orders all contacts on this router. |
| `PointerEventKind` | 类型 | What happened to a pointer: it went down, moved, went up or was cancelled. |
| `PointerInput` | 接口 | Scope-owned input for an explicitly supplied logical host stream. |
| `PointerInputEvents` | 接口 | The event types pointer input dispatches: begin, move, end, cancel and tap. |
| `PointerInputOptions` | 接口 | Pointer input to make: its engine and scope, the surface's size, its limits, and what is called. |
| `PointerNotification` | 接口 | A pointer contact and the target it went to, and why it was cancelled. |
| `PointerRouterState` | 类型 | Whether a pointer router passes input on, holds it, or has closed. |
| `PointerSample` | 接口 | One pointer's state at one moment: which pointer it is, what made it and where it is. |
| `PointerSession` | 接口 | Only the creating router admits this frozen identity; host IDs may be reused. |
| `PointerType` | 类型 | What made a pointer: a mouse, a finger or a pen. |
| `PointerUpdate` | 接口 | Where a pointer is on the stage, which buttons it holds, and when, with its pressure and size where the device gives them. |

## `@egret/engine/web/gestures`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createDragAndDrop` | 函数 | Drag and drop as games do it: the dragged object stays where it is, a picture of it follows the finger in `layer`, and letting go over a target that accepts what is carried calls its `drop`. |
| `createGestures` | 函数 | Recognizes gestures on an object. |
| `DragAndDrop` | 接口 | Sources and targets of drag and drop. |
| `DragAndDropOptions` | 接口 | Drag and drop to make: its engine, scope and input, and the layer the picture that follows the finger is drawn in. |
| `DragSource` | 接口 | Something that can be dragged: what it carries, and the picture that follows the finger. |
| `DropTarget` | 接口 | A place something can be dropped, and what it does with what is dropped on it. |
| `GestureDrag` | 接口 | A drag: where it is, how far it moved since the last, and since it started. |
| `GestureOptions` | 接口 | What to recognize on an object, and what is called. |
| `GesturePinch` | 接口 | Two fingers: how far apart against how they started, how far they turned, in degrees, and their middle. |
| `GesturePoint` | 接口 | Where a gesture is: on the stage, and in the object's own units. |
| `Gestures` | 接口 | Recognized gestures of an object; ended with `dispose` or with its scope. |
| `GestureSwipe` | 接口 | A swipe: its main direction, its speed in stage units a second, and how far it went. |

## `@egret/engine/web/view`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `Badges` | 接口 | Red dots that add up: a dot on `mail/system` shows on `mail` too. |
| `checkView` | 函数 | Checks a description: every part of a known kind with only the fields of its kind, names that are names and are used once, and portrait parts with the same names, of the same kinds, as the others. |
| `CompactOptions` | 接口 | How a number is written short: in Chinese with 万 and 亿, or in English with K, M, B and T. |
| `createBadges` | 函数 | Makes a tree of red dots. |
| `createRequest` | 函数 | Wraps what a button sends, such as a purchase, so that it is sent once at a time and its state can be shown. |
| `DEFAULT_VIEW_SKIN` | 值 | A dark skin that reads on any game: words in white on slate cards, blue buttons and a green accent. |
| `formatCompact` | 函数 | A number written short for a screen: 999, 12.3K and 4.5M in English; 9999, 1.2万 and 3.4亿 in Chinese. |
| `keyCap` | 函数 | The words of a key or a button, as a player reads them on a key cap. |
| `planView` | 函数 | Plans where each part of a view goes on a screen: the parts for its shape, each rectangle in the game's units. |
| `Request` | 接口 | A request a button sends: whether it is out, what it came back with, and the failure if it failed. |
| `TABLET_SHORT_SIDE` | 值 | The shorter side, in CSS pixels, from which a screen is a tablet's for the `tablet` parts of a view. |
| `ViewAnchor` | 类型 | Where in its panel a part is placed when the panel lays its parts out freely: an edge, a corner or the middle. |
| `ViewBar` | 接口 | How full something is: a value from 0 to 1. |
| `ViewButton` | 接口 | A button with words on it. |
| `ViewDescription` | 接口 | A screen as data: its parts, the parts while the screen is taller than wide, and how it sits. |
| `ViewFrame` | 接口 | Where a view goes: the screen the game shows and the part of it that is safe, in the game's units. |
| `ViewImage` | 接口 | A picture contained in its layout box and centred with its original aspect ratio. |
| `ViewPanel` | 接口 | A panel: a card that is drawn, or only a place that holds parts. |
| `ViewParagraphStyle` | 接口 | Width-wrapped text in an explicitly sized view part. |
| `ViewPart` | 类型 | Any part of a view. |
| `ViewPlan` | 接口 | Where every part of a view goes on one screen. |
| `ViewPlannedPart` | 接口 | A part where it goes: its place in the tree, what it is, and its rectangle in the game's units. |
| `ViewRect` | 接口 | A rectangle in the game's units. |
| `ViewSize` | 类型 | A width or height: units of the game, a share of the panel such as `'50%'`, or all that is left (`'fill'`). |
| `ViewSkin` | 接口 | The colours and sizes a view is drawn with, where its parts do not give their own. |
| `ViewSpace` | 接口 | Empty space: in a row or a column, `'fill'` pushes what follows to the end. |
| `ViewText` | 接口 | A line of words. |
| `ViewToggle` | 接口 | A switch that is on or off, with words before it. |
| `ViewVariant` | 类型 | Which parts of a view are used: `root` (`'landscape'`), `portrait`, `tablet` or `tabletPortrait`. |

## `@egret/engine/web/pointer`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createBrowserPointerInput` | 函数 | Pointer Events adapter for the explicit connected, untransformed Canvas profile. |
| `PointerInput` | 接口 | Scope-owned input for an explicitly supplied logical host stream. |
| `PointerInputOptions` | 接口 | Pointer input to make: its engine and scope, the surface's size, its limits, and what is called. |

## `@egret/engine/ui`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `ActionControl` | 接口 | A button control: whether it is pressed, how often it was activated, and calls that press or disable it. |
| `ActionControlOptions` | 接口 | An action control to make: its input and target, and what is called when it is activated or pressed. |
| `ActionKeysOptions` | 接口 | Space or Enter, released, activates. |
| `ControlKeys` | 接口 | Keys bound to a control: which are pressed now; dispose of it to unbind them. |
| `ControlKeysOptions` | 类型 | Keys for one control: an action, a toggle, a text field or a selection group. |
| `ControlKeysSource` | 接口 | The keyboard input, or anything that delivers its three key events. |
| `createActionControl` | 函数 | A button on a target: a captured press and release activates it by default. |
| `createControlKeys` | 函数 | Binds the keyboard to a control: Space and Enter press an action or a toggle, arrows move a selection. |
| `createHoverControl` | 函数 | Tells whether a pointer hovers over a target. |
| `createMovementControl` | 函数 | A virtual stick on a target: dragging from its contact origin or a fixed center gives a direction. |
| `createRangeControl` | 函数 | A slider on a target: dragging along its track or pressing keys sets a value between its least and greatest. |
| `createScrollControl` | 函数 | Scrolls content past a viewport along one axis, by wheel, by dragging a thumb, or by calls. |
| `createSelectionGroup` | 函数 | Radio buttons or tabs: one item of the group is selected at a time. |
| `createTextFieldControl` | 函数 | A text field on a target: pressing it opens the platform's editing, and the value is committed or cancelled. |
| `createToggleControl` | 函数 | A checkbox or switch on a target: a press and release inside it toggles it. |
| `createUiLayerManager` | 函数 | Optional Root composition. |
| `createUiRoot` | 函数 | One owned transaction domain over the genuine display and input authorities. |
| `createUiScreenStack` | 函数 | Makes a screen stack. |
| `createUiTheme` | 函数 | Checks and freezes a theme from its description. |
| `HoverControl` | 接口 | Whether a pointer hovers over a target; dispose of it to stop. |
| `HoverControlOptions` | 接口 | Hover, toggle and single-selection state for controls an application draws itself. |
| `LayoutNode` | 类型 | A node of a UI layout tree: a leaf, a stack of children, or a virtual list. |
| `MovementControl` | 接口 | A virtual stick: where it points now, whether it is held, and calls that set or disable it. |
| `MovementControlOptions` | 接口 | A movement control to make: its input and target, its geometry, and what it calls. |
| `MovementKeysOptions` | 接口 | The keys that are down give the direction; opposite keys cancel each other. |
| `MovementValue` | 接口 | Reusable movement and action controls over the existing contact stream. |
| `RangeAxis` | 类型 | One value out of a range, for a slider an application draws itself: a volume, a share, an amount. |
| `RangeControl` | 接口 | A slider: its value and range, whether it is dragged, and calls that set or step it. |
| `RangeControlOptions` | 接口 | A range control to make: its input and target, its axis and track, its range and step, and what it calls. |
| `RangeKeysOptions` | 接口 | Arrow keys move the value by one step, Page Up and Page Down by a page of steps, Home and End go to its ends. |
| `registerScreenOccluder` | 函数 | Name a genuinely painted UI face that may cover a control without taking its input. |
| `RowBindContext` | 接口 | What binding a row is given: the record, its place, the theme and density, its scope, signal and target. |
| `RowBinding` | 接口 | What a bound row shows, and its measured height. |
| `RowRetention` | 接口 | A row kept bound after it leaves the viewport; release it to let it go. |
| `RowUnbindInfo` | 接口 | A row that was unbound: its key, its binding and content versions, and why. |
| `ScreenOccluder` | 接口 |  |
| `ScreenOccluderOptions` | 接口 |  |
| `ScreenOccluderRect` | 接口 |  |
| `ScrollAxis` | 类型 | The scroll position of one axis of a clipped viewport an application draws itself. |
| `ScrollControl` | 接口 | Scrolling along one axis: the offset and its maximum, the thumb, and calls that scroll by lines, pages or to the ends. |
| `ScrollControlOptions` | 接口 | A scroll control to make: its axis, the lengths of its viewport and content, its wheel and thumb, and what it calls. |
| `ScrollKeysOptions` | 接口 | The arrow keys of its axis, Page Up, Page Down, Home and End. |
| `ScrollThumb` | 接口 | Where the thumb is on its track and how long it is. |
| `ScrollThumbOptions` | 接口 | A scroll thumb to drag: its input and target, its track's length and its shortest length. |
| `ScrollWheelOptions` | 接口 | How the wheel scrolls: the hover input, the target, and how far one line is. |
| `SelectionGroup` | 接口 | One of several: a radio group, a segmented control, or a listbox with a single selection. |
| `SelectionGroupOptions` | 接口 | A selection group to make: its input and items, the one selected, whether it wraps, and what it calls. |
| `SelectionItem` | 接口 | One item of a selection group: its key, its target and whether it can be chosen. |
| `SelectionKeysOptions` | 接口 | Arrow keys move the selection, Home and End go to its ends. |
| `selectUiSkin` | 函数 | The name a skin gives to the state of a control: of the states that hold, the first in `order` that the skin has a name for, and `default` when it has none. |
| `TextFieldChange` | 接口 | A text field's value after a change, and whether a composition is under way. |
| `TextFieldControl` | 接口 | A text field: its value and draft, whether it is being edited, and calls that edit, commit or cancel. |
| `TextFieldControlOptions` | 接口 | A text field to make: its input, target and editor, its value and limits, its labels, and what it calls. |
| `TextFieldEditor` | 接口 | Shows one field at a time. |
| `TextFieldKeysOptions` | 接口 | The field opens when the key is released, so that the key types nothing into it. |
| `TextFieldRectangle` | 接口 | The state of a text field an application draws itself: its text, and whether it is being edited. |
| `TextFieldSession` | 接口 | What the control adds to the presentation of a field when it opens one. |
| `ToggleControl` | 接口 | A checkbox or switch: whether it is checked and pressed, and calls that toggle or set it. |
| `ToggleControlOptions` | 接口 | A toggle to make: its input and target, whether it starts checked, and what it calls. |
| `ToggleKeysOptions` | 接口 | Keys for a toggle: which kind of toggle, the control, and what is called when its press changes. |
| `UiCommitResult` | 接口 | What a commit did, and any errors after it. |
| `UiCounters` | 接口 | What a UI root counted in its last passes: layouts, records, rows, bindings and measurements. |
| `UiInvalidationKind` | 类型 | What of a UI root has to be done again: its layout, its content, or both. |
| `UiKeyboardOptions` | 接口 | Explicit namespace prevents independently authored panels from sharing focus IDs. |
| `UiLayerAnchor` | 接口 | Where a layer is placed beside its target: on which side, how aligned, and how far from it. |
| `UiLayerCommitResult` | 接口 | What committing the layers did, and any errors after the commit. |
| `UiLayerManager` | 接口 | Stage intents, publish participating roots, then sync before editor placement/capture. |
| `UiLayerManagerOptions` | 接口 | A layer manager to make: its engine, scope and input, its viewport and limits. |
| `UiLayerOptions` | 接口 | A layer to open: its id and root, its kind and anchor, where focus goes, how it closes, and its backdrop. |
| `UiLayerRegistration` | 接口 | An open layer; dispose of it to close it. |
| `UiLayerSnapshot` | 接口 | The layers as they are now: committed and desired stacks, each layer, and counters. |
| `UiLayerTarget` | 类型 | What a layer is anchored to: a leaf of the tree, or a row of a list. |
| `UiLeafContent` | 接口 | What a leaf shows, prepared for the size it is given. |
| `UiLeafPrepareContext` | 接口 | Detached content is prepared at the leaf's available inner width. |
| `UiLimits` | 接口 | How far past the viewport a list keeps rows, and how many rows it keeps resident and retained. |
| `UiPreparation` | 接口 | Where a preparation is, and the revisions it works from. |
| `UiRoot` | 接口 | A tree of UI laid out in a viewport: change its tree, theme or input, then prepare and commit it. |
| `UiRootOptions` | 接口 | A UI root to make: its theme, engine and scope, its viewport, density and tree, its input, and its limits. |
| `UiRowPointerNotification` | 类型 | A pointer that began, moved, ended or was cancelled on a row of a list. |
| `UiRowSnapshot` | 接口 | One row as committed: its key and place, its versions, its box and whether it shows. |
| `UiScreenContext` | 接口 | What a screen is given when it is made: its parameters, how it closes itself, and whether it is covered. |
| `UiScreenDefinition` | 接口 | A kind of screen: its name, its layer, what the back key does on it, and how it is made. |
| `UiScreenHandle` | 接口 | What a screen is told. |
| `UiScreenLayer` | 类型 | Where a screen goes: a page of the stack, a popup over the pages, or a modal, of which one is shown at a time. |
| `UiScreenStack` | 接口 | Pages, popups and modals, opened and closed in turn. |
| `UiScreenStackOptions` | 接口 | A screen stack to make: how many screens it holds, and who is told of failures nothing else is told of. |
| `UiScreenStackSnapshot` | 接口 | The stack as it is now, by the screens' ids. |
| `UiSkinState` | 类型 | Which named states of a control are on, to choose its skin. |
| `UiSkinStateName` | 类型 | The states of a control that a skin may have a name for. |
| `UiSnapshot` | 接口 | A UI root as committed: its theme, revisions, origin, viewport, density and boxes. |
| `UiTheme` | 接口 | Every factory result is a distinct immutable generation, including equal descriptors. |
| `UiThemeDescriptor` | 接口 | A theme to make: its id, colors, spacing, type and skins. |
| `UiThemeNode` | 接口 | How a node of a theme is filled and spaced. |
| `UiThemeSkin` | 接口 | Skin names resolve through application-owned, typed asset references, never URLs. |
| `UiThemeTypography` | 接口 | A theme's type: its font family, size and line height. |
| `VirtualDataSource` | 接口 | The records of a virtual list, and how a row is bound to a record and unbound from it. |
| `VirtualListHandle` | 接口 | A virtual list of a UI root: reveal a record, change its source or scroll, and read its snapshot. |
| `VirtualListRevealOptions` | 接口 | Alignment within the list's authored viewport; tall rows can remain clipped. |
| `VirtualListSnapshot` | 接口 | A virtual list as committed: its rows, scroll offset and extent, its anchor and counters. |
| `VirtualRecord` | 接口 | One record of a virtual list: its key, its content version, its estimated height and its value. |

## `@egret/engine/animation`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createSequenceController` | 函数 | Opt-in sequence controls share Engine ownership but never create a second timer. |
| `createSequenceResetSlot` | 函数 | One ordinary sole-child container; all candidates use existing content and clock ownership. |
| `SequenceController` | 接口 | Receiver-checked owned handle; time is driven only by its genuine Engine. |
| `SequenceControllerEvent` | 类型 | An event a sequence controller reports: a marker it passed, or the end of its plays. |
| `SequenceControllerOptions` | 接口 | How a sequence controller plays: how many times, how fast, which markers it reports and where. |
| `SequenceControllerState` | 类型 | Whether a sequence controller is idle, running, paused, completed, stopped or faulted. |
| `SequenceControllerStatus` | 接口 | Where a sequence controller is: its state, its time and position, and its last sample and issue. |
| `SequenceEventSource` | 类型 | What caused a controller event: starting, the clock, a seek or a control call. |
| `SequenceMarker` | 接口 | Immutable authored marker; its input index breaks equal-time ties. |
| `SequenceResetActive` | 接口 | The sequence a reset slot shows now, and whether the slot owns it or borrows it. |
| `SequenceResetInitial` | 接口 | The sequence a reset slot starts with: its version label, its bitmap and its controller. |
| `SequenceResetRequest` | 接口 | A request to replace a slot's sequence with another version, loaded from a content loader. |
| `SequenceResetSlot` | 接口 | Holds a bitmap's sequence and replaces it with a new version without a gap. |
| `SequenceResetState` | 类型 | Where a reset request is: loading, ready, prepared, committed, cancelled or failed. |
| `SequenceResetTicket` | 接口 | One pending replacement: wait for it to be ready, then commit it or dispose of it. |
| `SequenceSeekRequest` | 接口 | Where to seek to, and whether the events passed over are reported. |

## `@egret/engine/paragraph`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createParagraph` | 函数 | Optional paragraph assembly authenticates Engine, Scope and exact cache profile. |
| `createParagraphCache` | 函数 | A fixed optional profile shares Engine/AssetManager leases and their shutdown authority. |

## `@egret/engine/web/paragraph`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `CanvasKitFontSetProvider` | 接口 | Loads font sets for CanvasKit paragraphs. |
| `CanvasKitFontSetProviderOptions` | 接口 | A CanvasKit font set provider to make: its CanvasKit and build identity. |
| `CanvasKitParagraphFont` | 接口 | One font for CanvasKit paragraphs: its family, bytes and identity. |
| `CanvasKitParagraphModule` | 接口 | Minimal host-injected CanvasKit port. |
| `CanvasKitParagraphProvider` | 接口 | Lays out and draws paragraphs with CanvasKit; dispose of it when done. |
| `CanvasKitParagraphProviderOptions` | 接口 | A CanvasKit paragraph provider to make: its CanvasKit, build identity and fonts. |
| `CanvasParagraphCanvas` | 接口 | What the provider draws with: a canvas whose 2D context measures and fills words. |
| `CanvasParagraphContext` | 接口 | The part of a 2D context the provider uses. |
| `CanvasParagraphProvider` | 接口 | Lays out and draws paragraphs with a canvas's 2D context; dispose of it when done. |
| `CanvasParagraphProviderOptions` | 接口 | A canvas paragraph provider to make. |
| `chooseParagraphProvider` | 函数 | Creates the paragraph provider the device can afford. |
| `createCanvasKitFontSetProvider` | 函数 | A stable cache provider routes immutable generations; it never mutates a live native font table. |
| `createCanvasKitParagraphProvider` | 函数 | Lays out and draws paragraphs with CanvasKit and the fonts it is given. |
| `createCanvasParagraphProvider` | 函数 | Lays out and draws paragraphs with a canvas's 2D context, with no WebAssembly. |
| `ParagraphBackend` | 类型 | The two paragraph providers of `@egret/engine/web/paragraph`. |
| `ParagraphBackendReason` | 类型 | Why a provider was chosen. |
| `ParagraphDevice` | 接口 | What the choice reads of the device. |
| `ParagraphFontSet` | 接口 | A set of fonts loaded for paragraphs: its key and families; dispose of it when done. |
| `ParagraphProviderChoice` | 接口 | The provider chosen, which of the two it is, and why. |
| `ParagraphProviderChoiceOptions` | 接口 | How to choose: which provider is wanted, how to load CanvasKit, and the canvas provider's options. |

## `@egret/engine/web/keyboard`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createBrowserKeyboardInput` | 函数 | Canvas-local native keyboard bridge. |
| `KeyboardCancelPayload` | 接口 | A key that was let go of without its key up, and why. |
| `KeyboardCancelReason` | 类型 | Why a held key was let go of without its key up. |
| `KeyboardFocusChange` | 接口 | Focus that moved: from which target to which, why, and whether it is shown. |
| `KeyboardFocusOptions` | 接口 | How focus is given: whether it is shown, and why it moved. |
| `KeyboardFocusPayload` | 接口 | A target that gained or lost focus, the other target, why, and whether focus is shown. |
| `KeyboardInput` | 接口 | Synchronous logical focus; text editing and IME are outside this channel. |
| `KeyboardInputEvents` | 接口 | The event types keyboard input dispatches: key down and up, cancel, and focus in and out. |
| `KeyboardInputOptions` | 接口 | Keyboard input to make: its engine and scope, its limits, and what is called when focus moves. |
| `KeyboardInputSnapshot` | 接口 | Keyboard input as it is now: its state, the focused target, and the keys held. |
| `KeyboardKeyPayload` | 接口 | A key event and the target it went to. |
| `KeyboardSample` | 接口 | One key as the host gives it: its code and key, whether it repeats, and the modifiers held. |
| `KeyboardTargetOptions` | 接口 | A target to register: its id, its display object, its place in Tab order and whether it is disabled. |
| `KeyboardTargetRegistration` | 接口 | A registered target: change it, or dispose of it to take it out. |

## `@egret/engine/web/text-input`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserTextInput` | 接口 | A native text field over the canvas, for typing with the platform's keyboard and input methods. |
| `BrowserTextInputChange` | 接口 | The value after a change, and whether a composition is under way. |
| `BrowserTextInputEnterHint` | 类型 | What the Enter key of an on-screen keyboard says. |
| `BrowserTextInputMode` | 类型 | Which on-screen keyboard to ask for. |
| `BrowserTextInputOptions` | 接口 | Browser text input to make: its canvas and size, the element it goes into, and whether keys are kept from the game. |
| `BrowserTextInputRectangle` | 接口 | Rectangle in logical stage units, the units of the display tree and of pointer input. |
| `BrowserTextInputRequest` | 接口 | One editing session. |
| `BrowserTextInputSnapshot` | 接口 | Browser text input as it is now: its state, value and composition. |
| `createBrowserTextInput` | 函数 | Platform text entry over a canvas: a native field placed on a rectangle of the stage, so that input methods (Chinese, Japanese, Korean), on-screen keyboards, paste and accessibility work as the platform provides them. |

## `@egret/engine/web/wechat-text-input`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createWechatTextInput` | 函数 | Text input through WeChat's keyboard, with the object of `createBrowserTextInput`. |
| `WechatKeyboard` | 接口 | The part of `wx` the text input uses. |
| `WechatKeyboardEvent` | 接口 | What a keyboard event of WeChat carries: the text in the keyboard's field. |
| `WechatKeyboardListener` | 类型 | A listener of WeChat's keyboard events. |
| `WechatTextInputOptions` | 接口 | WeChat text input to make: the keyboard to use, and where errors of the game's callbacks go. |

## `@egret/engine/ui/editing`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createUiTextEditor` | 函数 | A text editor drawn by the engine, its text and selection kept by the platform's text input. |
| `TextEditSelection` | 接口 | Source offsets are UTF-16, never glyph indices or guessed advance widths. |
| `UiTextEditor` | 接口 | A text editor: its content, the calls that set its value, selection and style, and the geometry of its text. |
| `UiTextEditorChange` | 接口 | A change to a text editor's content or selection, and what made it. |
| `UiTextEditorFontSet` | 接口 | Fonts for an editor as a font provider gives them, such as a set of `createBrowserEditorFontProvider`. |
| `UiTextEditorOptions` | 接口 | A text editor to make: its engine, scope and cache, its mode, value and limits, its style and size, and what it calls. |
| `UiTextEditorSetOptions` | 接口 | How a value is set: the selection after it, the revision it expects, and whether a composition is cancelled. |
| `UiTextEditorSnapshot` | 接口 | A text editor as it is now: its content revision, style, and whether the native editor shows. |
| `UiTextEditorStyle` | 接口 | How a text editor's text looks: its fonts and size, line height, locale and direction, colors and alignment. |
| `UiTextEditorStyleInput` | 接口 | A style to give an editor: as its style, but `fontSet` may be the font set itself, whose key is taken, and whose families are taken unless `fontFamilies` is given. |
| `UiTextEditorTarget` | 类型 | What a text editor is drawn in: a leaf of the tree, or a row of a list. |

## `@egret/engine/web/editing`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserEditorFontProvider` | 接口 | Loads font sets for browser text editors. |
| `BrowserEditorFontProviderOptions` | 接口 | An editor font provider to make: its engine and scope, its paragraph provider and deadline. |
| `BrowserEditorFontSet` | 接口 | Fonts loaded for a text editor: its key, families and identities; dispose of it when done. |
| `BrowserTextEditor` | 接口 | A UI text editor edited through a native element over the canvas: activate, finish or cancel editing. |
| `BrowserTextEditorOptions` | 接口 | A browser text editor to make: its editor, root and target, its canvas, fonts and size, its label and keyboard, and what it calls. |
| `BrowserTextEditorSnapshot` | 接口 | A browser text editor as it is now: its state, revisions, native element and font. |
| `createBrowserEditorFontProvider` | 函数 | CSS registration is a consumer of existing immutable font resources, not another asset cache. |
| `createBrowserTextEditor` | 函数 | One visible native editor over an authenticated committed UI binding. |
| `EditorParagraphFontLoader` | 接口 | Loads the paragraph fonts a text editor uses. |

## `@egret/engine/input/hover`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createHoverInput` | 函数 | Hover and wheel routing over the display tree of a started Engine. |
| `HoverInput` | 接口 | Scope-owned hover and wheel routing for an explicitly supplied logical host stream. |
| `HoverInputEvents` | 接口 | The event types hover input dispatches: enter, move, leave and wheel. |
| `HoverInputOptions` | 接口 | Hover input to make: its engine and scope, the surface's size, its limits, and what is called. |
| `HoverInputState` | 类型 | Whether hover input passes input on, holds it, or has closed. |
| `HoverLeaveReason` | 类型 | Why a target stopped being hovered: the pointer went to another target or to none, left the surface, pressed, or was cancelled by the platform; the target stopped being a possible target; the mapping of the surface changed; the window or the page went away; or the input was suspended, disposed or failed. |
| `HoverNotification` | 接口 | A target that a pointer entered, moved over or left, and why it left. |
| `HoverPoint` | 接口 | A retained value: sequence orders every hover and wheel observation of this input. |
| `HoverPointerType` | 类型 | Pointers that can be over the scene without pressing it. |
| `HoverSample` | 接口 | A pointer moving over the surface without a press: which pointer, where and when. |
| `HoverState` | 接口 | Where a pointer hovers and the target under it. |
| `HoverTransition` | 接口 | A point of an enter or a leave, with the other end of the movement when there is one. |
| `WheelNotification` | 接口 | A wheel turn and the target it went to, and whether that target took it. |
| `WheelPoint` | 接口 | A wheel sample in order, with the viewport it was taken in. |
| `WheelSample` | 接口 | A turn of a wheel: where the pointer is, how far it turned in each axis, in what unit and when. |
| `WheelUnit` | 类型 | What a wheel's deltas count: pixels, lines or pages. |

## `@egret/engine/web/hover`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserHoverInputOptions` | 接口 | Browser hover input to make: its canvas, how far a page of wheel scrolls, and what is called on an error. |
| `createBrowserHoverInput` | 函数 | Hover and wheel of the page for the canvas of a started Engine, in the same connected, untransformed profile as the pointer adapter. |
| `WheelPagePolicy` | 类型 | Whether a wheel over the canvas also scrolls the page: only when nothing consumed it, never (the canvas owns the wheel), or always (the listener is passive and cannot hold the page). |

## `@egret/engine/input/gamepad`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `bindGamepadKeys` | 函数 | Drives a keyboard input from the pads: the keys a UI already answers, held and repeated as a pad holds them. |
| `createGamepadInput` | 函数 | Pads as a stream of samples a host gives it: what is held, how far a stick is pushed, and what changed since the last look. |
| `GamepadButtonChange` | 接口 | A button that was pressed or released: on which pad, which button, how far and when. |
| `GamepadButtonName` | 类型 | The buttons of a pad in the standard layout, by where they are: `a` is the lower face button. |
| `GamepadButtonSample` | 接口 | A gamepad button now: whether it is pressed, and how far, 0 to 1. |
| `GamepadConnectionChange` | 接口 | A gamepad that was connected or disconnected: its pad, id, mapping and time. |
| `GamepadInput` | 接口 | Pads as a stream of samples. |
| `GamepadInputOptions` | 接口 | How gamepads are read: the dead zone, how many pads, and what is called on buttons and connections. |
| `GamepadKeyAction` | 类型 | What a button does: a key, with the way the focus moves when nobody took the key; or a move of the focus alone. |
| `GamepadKeys` | 接口 | Keyboard keys held by a gamepad; dispose of it to release them. |
| `GamepadKeysOptions` | 接口 | How a gamepad presses keyboard keys: which pad, the map of buttons and stick to keys, and the repeat. |
| `GamepadKeyTarget` | 接口 | The part of a keyboard input that a pad drives. |
| `GamepadPad` | 接口 | A pad that is connected, as of the last sample. |
| `GamepadSample` | 接口 | What a host says of one pad at one moment. |
| `GamepadStick` | 接口 | Where a stick points, each axis -1 to 1, with the dead zone taken out. |
| `GamepadStickName` | 类型 | Which stick of a gamepad: the left or the right. |

## `@egret/engine/web/gamepad`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserGamepadInput` | 接口 | Gamepads read from the browser: poll them each frame, and make one rumble. |
| `BrowserGamepadInputOptions` | 接口 | Browser gamepad input to make: what is called on an error. |
| `createBrowserGamepadInput` | 函数 | The pads of a page. |
| `GamepadRumble` | 接口 | A rumble to play: how long, and how strong its weak and strong motors run. |

## `@egret/engine/camera`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `Camera2D` | 接口 | A view of a 2D world: where it looks, how close, what it follows, and how it shakes. |
| `Camera2DOptions` | 接口 | A 2D camera to make: the world it moves, the view's size, where it looks and how far it zooms, its bounds and its shake. |
| `CameraFollowOptions` | 接口 | How the camera follows a target: how smoothly, the box it may move in unfollowed, and the offset. |
| `CameraLayerOptions` | 接口 | How a layer moves and zooms with the camera, for parallax. |
| `CameraPoint` | 接口 | A point in world coordinates. |
| `CameraRect` | 接口 | A rectangle in world coordinates. |
| `CameraShakeOptions` | 接口 | How much a shake adds to the camera's trauma. |
| `CameraSnapshot` | 接口 | The camera as it is now: where it looks, its zoom and rotation, its trauma and its view. |
| `CameraTarget` | 类型 | What the camera follows: a display object inside the world, or a function that says where to look. |
| `createCamera2D` | 函数 | A camera over a container that holds the world. |

## `@egret/engine/tilemap`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createTileMap` | 函数 | A map drawn from its tilesets. |
| `importTiledMap` | 函数 | Reads a map saved by Tiled as JSON (`.tmj`, or `.json`), orthogonal, with tile layers as arrays or as base64 without compression, finite or infinite, object layers and groups. |
| `ObjectLayerData` | 接口 | A layer of objects: its name, offset, opacity and objects. |
| `TILE_FLIP_MASK` | 值 | The top three bits of a global id say how the tile is turned; the rest is the id. |
| `TileAnimationFrame` | 接口 | One frame of an animated tile: the tile it shows and for how long. |
| `TiledImportOptions` | 接口 | Tilesets kept in files of their own, for importing a map from Tiled. |
| `TileInfo` | 接口 | What a cell holds: its tile, tileset and flips, and the tile's properties. |
| `TileLayerData` | 接口 | A layer of tiles: its name, size, offset, opacity and parallax, and its tiles' global ids. |
| `TileMap` | 接口 | A map drawn: one container for each tile layer, cut into chunks of meshes that can be left out when they cannot be seen. |
| `TileMapChunk` | 接口 | A chunk of a layer drawn as one: its first cell, whether it shows, and its meshes. |
| `TileMapData` | 接口 | A map as plain, frozen data: what a tile map is made from. |
| `TileMapLayer` | 接口 | A layer as drawn: its name and data, its display object and its chunks. |
| `TileMapLayerData` | 类型 | A layer of a map: tiles or objects. |
| `TileMapObject` | 接口 | An object of an object layer: its place and size, its shape or tile, its text and properties. |
| `TileMapOptions` | 接口 | A tile map to make: its map, its tileset textures and the size of its chunks. |
| `TileMapProperties` | 类型 | The properties of a map, layer, tile or object, by name. |
| `TileMapPropertyValue` | 类型 | The value of a tile map property. |
| `TileSetData` | 接口 | A tileset: its tiles' size and count, its image, and the properties and animations of its tiles. |

## `@egret/engine/particles`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createParticleEmitter` | 函数 | A stream of particles over one texture, drawn as one mesh that is built again each update. |
| `ParticleBurstSite` | 接口 | A place and a count for one burst in a batch. |
| `ParticleEmitter` | 接口 | Particles drawn as one mesh. |
| `ParticleEmitterOptions` | 接口 | An emitter to make: its texture and how many particles, and how they are born, move, grow, fade and turn. |
| `ParticleRange` | 类型 | A value picked once for each particle, evenly between the two ends; a number is both ends. |
| `ParticleShape` | 类型 | Where particles are born, around the place of the emitter. |
| `ParticleSnapshot` | 接口 | An emitter as it is now: how many particles live, were born and were refused, and its time. |
| `ParticleView` | 接口 | One live particle: where it is and how fast it moves, its age, scale, alpha, color and rotation. |

## `@egret/engine/physics2d`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createPhysicsWorld` | 函数 | A world of bodies that move, meet and push each other apart, in fixed steps, without turning. |
| `PhysicsBody` | 接口 | A body in the physics world: its place and motion, its material and layers, and the calls that push it. |
| `PhysicsBodyKind` | 类型 | A static body never moves; a kinematic one moves by its speed alone and pushes; a dynamic one is moved by everything. |
| `PhysicsBodyOptions` | 接口 | A body to add: its kind and shape, where it is and how it moves, its material, its layers and what it moves. |
| `PhysicsContact` | 接口 | Two bodies that began or ended touching, with the normal between them. |
| `PhysicsJoint` | 接口 | A joint of the world: its kind, its bodies and its length, which can change, as a rope that is wound in. |
| `PhysicsJointOptions` | 接口 | A joint to add between two bodies, or between a body and a fixed point of the world. |
| `PhysicsMoveResult` | 接口 | Where a moved body ended up, and the normals of what it hit on the way. |
| `PhysicsRayHit` | 接口 | What a ray hit: the body, where, its normal, and how far along the ray. |
| `PhysicsShape` | 类型 | A shape about the place of its body. |
| `PhysicsSnapshot` | 接口 | The physics world as it is now: its bodies, contacts and steps. |
| `PhysicsTileColliders` | 接口 | A grid of solid tiles to collide with: its size in tiles, its tile size, which are solid and where it is. |
| `PhysicsVector` | 接口 | A 2D vector of the physics world. |
| `PhysicsWorld` | 接口 | A world of 2D bodies that collide, without turning: simple, steady physics for a 2D game. |
| `PhysicsWorldOptions` | 接口 | A physics world to make: its gravity, its step and iterations, and its limits. |

## `@egret/engine/bitmapfont`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BitmapFont` | 接口 | A bitmap font read from a file: frozen, with its characters and the kerning between pairs of them. |
| `BitmapGlyph` | 接口 | One character of a bitmap font: where it is on its page, where it is drawn from the pen, and how far the pen goes on. |
| `BitmapText` | 接口 | Text drawn in a bitmap font, as one mesh for each page it uses. |
| `BitmapTextGlyph` | 接口 | One character placed: its rectangle in the text and its rectangle on its page. |
| `BitmapTextLayout` | 接口 | Text laid out in a font, from its top left. |
| `BitmapTextLayoutOptions` | 接口 | How bitmap text is laid out: its width, alignment, spacing and kerning, and the character to fall back on. |
| `BitmapTextLine` | 接口 | One laid out line of bitmap text: its characters, width and place. |
| `BitmapTextOptions` | 接口 | Bitmap text to make: its font, pages, text and color, and how it is laid out. |
| `createBitmapText` | 函数 | Draws text in a bitmap font as one mesh for each page it uses, laid out again whenever what it shows changes. |
| `layoutBitmapText` | 函数 | Lays text out in a bitmap font without drawing it: its lines, where each character goes, and its size. |
| `parseBitmapFont` | 函数 | Reads a bitmap font: the text, XML or JSON forms of BMFont (from AngelCode's generator, Hiero, Glyph Designer, Littera and the like), or Egret's own JSON of frames. |

## `@egret/engine/video`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createVideo` | 函数 | A video as a display object: each new picture its source gives becomes, through the Engine's assets, the texture of one Bitmap. |
| `Video` | 接口 | A video shown as a display object: each new picture of its source becomes the texture of one Bitmap. |
| `VideoFrame` | 接口 | One picture of a video, the time of the video it shows. |
| `VideoOptions` | 接口 | A video to show: the asset manager that leases its pictures, and its source. |
| `VideoSnapshot` | 接口 | A video as it is now: its state, its pictures shown and skipped, and its times. |
| `VideoSource` | 接口 | What a video player reads its pictures from and is driven through. |
| `VideoSourceState` | 类型 | Where a source is: still opening, able to show a frame, playing, paused, at its end, or unable to play. |
| `VideoState` | 类型 | Whether a video is loading, ready, playing, paused, ended, failed or closed. |

## `@egret/engine/web/video`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserVideo` | 接口 | A video played by a video element, its pictures leased as textures. |
| `BrowserVideoOptions` | 接口 | A browser video to make: its assets, its source or stream or element, and whether it loops, is muted and how loud. |
| `BrowserVideoSource` | 接口 | One file of a film offered in several: its address and, when known, its media type. |
| `createBrowserVideo` | 函数 | A video played by a page's video element and shown as a display object. |

## `@egret/engine/web/loop`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserFrameLoop` | 接口 | Steps the Engine and draws a frame on each animation frame of the browser. |
| `BrowserFrameLoopOptions` | 接口 | A frame loop to run: its engine, frame and host, its update, how long a step and a catch-up may be, and its frame requests. |
| `BrowserFrameLoopSnapshot` | 接口 | A frame loop as it is now: its state, its steps, frames and skipped frames, its seconds and any failure. |
| `BrowserFrameLoopState` | 类型 | Whether a frame loop is idle, running, failed or closed. |
| `BrowserFrameTiming` | 接口 | An observational CPU sample for one browser callback. |
| `createBrowserFrameLoop` | 函数 | The frame loop of a game in a page. |
| `FrameLoopEngine` | 接口 | What the loop asks of an Engine: its clock's limit, time and frames. |
| `FrameLoopHost` | 接口 | What the loop asks of a Host: how many frames it holds that it has not finished. |

## `@egret/engine/web/screen`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `isScreenPin` | 函数 | Whether `pin` is a pin: only its six names, finite numbers, and at most one of each axis. |
| `pinBox` | 函数 | Where `box` goes in `area` by `pin`: the place of its top left corner, in the units of both. |
| `planScreen` | 函数 | Fits a stage to a space on a screen. |
| `ScreenFit` | 类型 | How a stage fills a space: see `ScreenPlanOptions.fit`. |
| `ScreenInsets` | 接口 | How far in from each edge a notch, rounded corners or a home bar reach, in the pixels of the space given. |
| `ScreenPin` | 接口 | Where a box is held in an area: on each axis a distance in from one edge, or from the middle. |
| `ScreenPlan` | 接口 | Where the stage goes, and what of it is shown and safe to touch. |
| `ScreenPlanOptions` | 接口 | What to fit: the space on the screen, the designs, how they fit and what covers the edges. |
| `ScreenRect` | 接口 | A rectangle in stage units. |
| `ScreenSize` | 接口 | A width and a height above 0. |
| `ScreenUiScale` | 接口 | Bounds on the screen's CSS pixels per unit of an independently laid-out interface. |

## `@egret/engine/kit`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `ASSET_BUNDLE_HEADER_BYTES` | 值 | How many bytes from the start must be read to know the index's length: the header. |
| `assetBundleCheck` | 函数 | FNV-1a over the bytes, as eight hex digits. |
| `AssetBundleEntry` | 接口 | One file in an asset bundle: its name, where its bytes are, its type and tags, and its check. |
| `AssetBundleIndex` | 接口 | The table of an asset bundle: its size, where its data begins, and its entries. |
| `AssetBundleInput` | 接口 | One file to put in a bundle. |
| `AudioCueDefinition` | 接口 | A named sound effect: its takes, its bus and volume, and how often and how many at once it plays. |
| `AudioCuePlayOptions` | 接口 | How one play of a cue differs: its volume, pan and rate. |
| `AudioCues` | 接口 | Sound effects by name, each with its takes, cool-down and voice limit. |
| `AudioCuesOptions` | 接口 | The clock and the random numbers cues choose by; give your own for tests and replays. |
| `createAudioCues` | 函数 | Names the sound effects of a game over `mixer`. |
| `createInputActions` | 函数 | Makes the actions of `map`. |
| `createMemorySaveStorage` | 函数 | Storage kept in memory: for tests, for a page without browser storage, or for a game played once. |
| `createRandom` | 函数 | A generator from a seed (a number or string) or a saved state. |
| `createSaveStore` | 函数 |  |
| `createTextTable` | 函数 | Makes a table of a game's words in its languages. |
| `describeInputBinding` | 函数 | A readable name for a binding, for settings screens: `Key:KeyW` is `W`, `Mouse:0` is `Left button`. |
| `encodeWav` | 函数 | 16-bit PCM WAV bytes from channels of samples between -1 and 1, all the same length. |
| `hashSeed` | 函数 | Turns a string or number into a 32-bit seed. |
| `HeadlessGame` | 接口 | What a headless run needs of a game: its state and one step of its rules. |
| `HeadlessRunOptions` | 接口 | A game run without a screen: the game and player to make for each seed, when it is done, and the step. |
| `HeadlessRunResult` | 接口 | What one seed's headless run did: whether it finished, its seconds and steps, its timings and its summary. |
| `InputActionDefinition` | 接口 | An action and the controls that drive it. |
| `InputActionKind` | 类型 | Whether an action is a button, one axis, or a vector of two. |
| `InputActionMap` | 类型 | Actions by name, with the controls that drive each. |
| `InputActions` | 接口 | Named actions driven by keys, buttons and sticks: what is pressed now, values, rebinding and saving. |
| `InputBinding` | 类型 | One physical control, written as a short string: `Key:KeyW` (a `KeyboardEvent.code`), `Mouse:0` (a button number), `Pad:a` or `Pad:7` (a standard gamepad button name or number), `Pad:leftStick` / `Pad:rightStick` (a stick, for vector actions), `Pad:leftStickX+` (one half of a stick axis, for buttons and axes), and `Touch:<name>` for an on-screen control. |
| `InputBindingSlot` | 类型 | A slot of an action that a binding can be put in: `bindings`, `negative`, `positive`, `up`, ... |
| `InputBindingsSave` | 接口 | Bindings as saved, to load back with `loadBindings`. |
| `InputVector` | 接口 | The value of a vector action, each axis -1 to 1. |
| `pickLanguage` | 函数 | The language of `languages` that best matches what the player's browser or system asks for (`navigator.languages`, given here as a list, such as `['zh-CN', 'en']`): an exact match first, then the same main language (`zh-TW` asks for `zh`). |
| `pickQualityFiles` | 函数 | Names of the form `<base>-<tier>.<ext>` grouped by base and chosen for `quality`, as a bundle or a folder lists them: `hero-high.glb`, `hero-low.glb` and `hall.webp` give `hero-low.glb` (for `medium`) and `hall.webp`. |
| `pickQualityVariant` | 函数 | Of several variants of one asset, the one for `quality`: an exact tier, or else the nearest below, or else the nearest above. |
| `planAssetBundleRanges` | 函数 | Ranges of the file that hold the named entries, joined where they touch or lie within `gap` bytes. |
| `QUALITY_TIERS` | 值 | Quality tiers from lowest to highest, as World3D names them. |
| `QualityTier` | 类型 | One of the quality tiers, from the lowest to the highest. |
| `Random` | 接口 | Random numbers from a seed, repeatable: numbers, ranges, choices, shuffles and normal values. |
| `RandomState` | 类型 | Four 32-bit words. |
| `readAssetBundleHeader` | 函数 | The index length a header gives, so a reader can ask for exactly the bytes of the index. |
| `readAssetBundleIndex` | 函数 | The index of a bundle from its first bytes: at least the header and the index. |
| `runHeadless` | 函数 | Plays the game once per seed with the stand-in player and reports each run. |
| `SaveProblem` | 接口 | A problem with a save: what kind, which key, and its cause. |
| `SaveProblemKind` | 类型 | What went wrong with a save: unreadable, invalid, too new or too old, or a migration or write that failed. |
| `SaveRule` | 类型 | What a field must be beyond the type of its default: one of a list of values, a number in a range (`int` for a whole number), or a check of one's own. |
| `SaveShape` | 接口 | The check and the fill of a save of the shape of its defaults. |
| `SaveStorage` | 接口 | Where a save is kept: strings by key. |
| `SaveStore` | 接口 | A saved value: read it, change it and save it, reset or remove it, export or import it. |
| `SaveStoreOptions` | 接口 | A save to keep: its key and version, its defaults and migrations, its check and its storage. |
| `shapeOf` | 函数 | The check and the fill of a save whose new game is `defaults` (the data, or the function a save store is given). |
| `sliceAssetBundle` | 函数 | The bytes of one entry from bytes of the bundle that start at `start` (0 for the whole file), checked against the index. |
| `TextTable` | 接口 | A game's words in its languages: the current one, a word by key, and who is told when the language changes. |
| `TextTableOptions` | 接口 | A text table to make: the words of each language, the language to start in and the one to fall back to. |
| `TextTableWords` | 类型 | The words of one language, by key. |
| `writeAssetBundle` | 函数 | One file holding every input, in the order given, each starting at a multiple of four bytes. |

## `@egret/engine/web/kit`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `bindBrowserInputActions` | 函数 | Listens to the page for the controls of `actions`. |
| `BrowserAssetBundle` | 接口 | An asset bundle opened in the browser: its index and entries, and calls that read an entry's bytes. |
| `BrowserAssetBundleOptions` | 接口 | An asset bundle to open: how it is fetched and from where, whether it is read whole, and the cache it is kept in. |
| `BrowserDecodedImage` | 接口 | A decoded image: its source, size, and a call that releases it. |
| `BrowserImageCanvas` | 接口 | A canvas to draw a decoded image into. |
| `BrowserImageContext` | 接口 | The drawing context of such a canvas: draw an image and read its pixels. |
| `BrowserImageFormat` | 类型 | The picture formats the browser route recognises by their first bytes. |
| `BrowserImageOptions` | 接口 | How images are decoded: the largest size accepted, and the ports used. |
| `BrowserImagePorts` | 接口 | How the browser makes a canvas and decodes an image, for image textures. |
| `BrowserImageSource` | 类型 | What `textureFromCanvas` and `decodeBrowserImage` can read pixels from. |
| `BrowserImageTextureProviderOptions` | 接口 | Where an image texture provider reads the bytes of each image from. |
| `BrowserInputActions` | 接口 | Input actions driven by the browser's keys, pointers and gamepads: poll them each frame. |
| `BrowserInputActionsOptions` | 接口 | Where input actions read the browser: which element takes keys and pointers, whether gamepads count, and which keys pass through. |
| `browserLanguages` | 函数 | The languages the player's browser asks for, most wanted first, such as `['zh-CN', 'en']`; empty where unknown. |
| `browserSaveStorage` | 函数 | The page's local storage as a save storage, or a memory stand-in where the page has none (a private window, a blocked site): every call is guarded, so a save never throws for want of storage. |
| `BrowserTextDownloadOptions` | 接口 |  |
| `BrowserTextFile` | 接口 | A text file explicitly chosen by the player. |
| `BrowserTextFileOptions` | 接口 |  |
| `BundleCache` | 接口 | Where fetched bundle entries are kept between visits; used as `cache` of `openBrowserAssetBundle`. |
| `createBrowserImageTextureProvider` | 函数 | An asset provider that reads bytes with `readBytes` and decodes them with the browser. |
| `createTouchButton` | 函数 | Makes `element` an on-screen button that holds `binding` (such as `Touch:jump`) while a finger is on it. |
| `createTouchStick` | 函数 | A stick that appears where a finger lands in its zone of `element` and follows it. |
| `decodeBrowserImage` | 函数 | Decodes PNG, JPEG, WebP, GIF or AVIF bytes with the browser and returns a texture of them. |
| `downloadBrowserTextFile` | 函数 | Offer the caller's text as a local download from a fresh user activation. |
| `fitBrowserImageSize` | 函数 | The size a picture is read at: its own, or scaled down evenly to fit both limits. |
| `IndexedDBSaveStorage` | 接口 | Save storage kept in IndexedDB: flush pending writes, and close it. |
| `IndexedDBSaveStorageOptions` | 接口 | IndexedDB save storage to open: its database name, the IndexedDB to use, and what is called on an error. |
| `openBrowserAssetBundle` | 函数 | Opens the bundle at `url`, reading its index. |
| `openBrowserBundleCache` | 函数 | A bundle cache in the Cache API under `name`. |
| `openIndexedDBSaveStorage` | 函数 | A save storage over IndexedDB. |
| `pickBrowserTextFile` | 函数 | Show the platform's single-file chooser from a fresh user activation. |
| `prefersReducedMotion` | 函数 | Whether the player has asked the system for less motion (`prefers-reduced-motion: reduce`): then leave out shakes, flashes, parallax and large moves that are only for show. |
| `sniffBrowserImageFormat` | 函数 | The picture format the bytes start with, or undefined when they start like none of them. |
| `textureFromCanvas` | 函数 | Reads a canvas, image or bitmap as a texture of straight RGBA bytes, scaled down when it is larger than the limits. |
| `TouchControl` | 接口 | Touch controls on the page: their elements; dispose of them to take them off. |
| `TouchStickOptions` | 接口 | A touch stick to put on the page: its binding, radius, the zone it appears in and its class. |
| `watchReducedMotion` | 函数 | Calls `listener` with the new answer whenever the player changes it. |

## `@egret/engine/web/game`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserGame` | 接口 | A game in a canvas: its Engine, host and stage, its frame loop and input, and calls that load textures and make labels. |
| `BrowserGameAtlasLabel` | 接口 | A line of text drawn on a page of images shared with other such labels. |
| `BrowserGameBackend` | 类型 | Which GPU interface a browser game draws with. |
| `BrowserGameFit` | 类型 | How the canvas fills the element it is in: not at all, whole inside it, covering it, stretched to it, filling it with a stage that grows around the design (`'expand'`), or filling it as the stage scale modes of Egret 5 did (`'fixedWidth'`, `'fixedHeight'`, `'fixedNarrow'`, `'fixedWide'`; see `planScreen` of `@egret/engine/web/screen`). |
| `BrowserGameFrameTiming` | 接口 | A loop sample with the game's image-budget refusal distinguished from a submitted frame. |
| `BrowserGameFrameUsage` | 接口 | What the last frame drawn held of a frame's images, against what one frame may hold. |
| `BrowserGameGlyphFont` | 接口 | Spread font and pages into createBitmapText; retire all borrowers before releasing the shared page. |
| `BrowserGameGlyphFontOptions` | 接口 |  |
| `BrowserGameLabel` | 接口 | A line of text on the stage whose words can be set like a value. |
| `BrowserGameLabelCreateOptions` | 接口 | A label to make: its words and style, and the scope that owns it. |
| `BrowserGameLabelOptions` | 接口 | A text label to make: its text, font, size and weight, line height, color, locale and direction. |
| `BrowserGameOptions` | 接口 |  |
| `BrowserGameParagraphLabel` | 接口 |  |
| `BrowserGameParagraphLabelCreateOptions` | 接口 | The initial wrapping width is required; ownership defaults to the game's scope. |
| `BrowserGameParagraphLabelOptions` | 接口 | Style and width for a wrapped native label. |
| `BrowserGameRenderMode` | 类型 | Continuous presentation or a retained frame, with the same simulation clock in either mode. |
| `BrowserGameStartupTiming` | 接口 | Wall-clock preparation durations, and the first accepted SDK submission (not GPU completion or presentation). |
| `BrowserGameWarning` | 接口 | Something to know before it shows: `FRAME_IMAGES_NEAR_LIMIT` when a frame holds four fifths of what a frame may hold of images, `FRAME_IMAGE_BUDGET` when a frame held more and was not drawn (the loop goes on), `LABEL_NOT_DRAWN` when a label's words could not be drawn, `LABEL_CACHE_NEAR_LIMIT` when the labels hold four fifths of the text cache, and from `play`, `PLAY_MADE_EVERY_FRAME` when `update` made a text, a shape or a sprite in each of the last 60 frames. |
| `BrowserStatsPanel` | 接口 | A panel over the canvas showing frame rate and frame times: sample each frame. |
| `BrowserStatsPanelOptions` | 接口 | A stats panel to make: the canvas it sits over, its label, and how often it updates. |
| `BrowserStatsSample` | 接口 | What a game knows at one frame of the display. |
| `BrowserStatsSnapshot` | 接口 | The numbers the panel shows, as of its last refresh. |
| `createBrowserGame` | 函数 | Makes a game ready to draw: `await createBrowserGame({ canvas, width, height, update })`, then add display objects to `game.stage`. |
| `createBrowserStatsPanel` | 函数 | Puts a panel over the canvas that shows frame rate and frame times. |

## `@egret/engine/play`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `composeMusic` | 函数 | Writes a piece. |
| `isSfxRecipe` | 函数 | Whether a value is a recipe `synthesizeSfx` takes. |
| `MUSIC_MOODS` | 值 | The moods play music can be made in. |
| `MUSIC_PARTS` | 值 | The parts of a piece, from the quietest moment to the most intense. |
| `musicMix` | 函数 | How loud each part is at an intensity from 0 to 1: the pad always, then the bass, the drums and the tune. |
| `MusicMood` | 类型 | The moods there are. |
| `MusicOptions` | 接口 | Music to make: its mood, seed, tempo and length in bars. |
| `MusicPart` | 类型 | One part of a piece of play music. |
| `MusicPiece` | 接口 | A piece of music made from a seed: its mood, tempo, length and parts. |
| `play` | 函数 | Starts a game in the page. |
| `PlayActivationSource` | 类型 | Where an activation came from. |
| `PlayBar` | 类 | A bar of health, time or power. |
| `PlayBarOptions` | 接口 | A bar to show, as for health: where and how large, its value and maximum, its colors and layer. |
| `PlayBurstOptions` | 接口 | A burst of particles: its color and count, how fast and how long they fly, their size and gravity. |
| `PlayButton` | 类型 | A button: a sprite whose middle is at (x, y), with its words in `label`. |
| `PlayButtonOptions` | 接口 | A button to show: where, how large, its colors, text size and layer. |
| `PlayFloatingStickOptions` | 接口 | A floating stick starts under a fresh touch in this part of the Play design. |
| `PlayGame` | 接口 | Everything a small game is given: its world, UI and view, keys and pointer, sound and random numbers, and calls that make, move, test and time things. |
| `PlayImageOptions` | 接口 | An image to show: where, how large, whether smoothed, and its layer. |
| `PlayKeys` | 接口 | The keyboard of a play game: what is held, pressed and released, and axes from the arrow and WASD keys. |
| `PlayMenuOptions` | 接口 | A menu to show: its title, where it goes, how wide and its color. |
| `PlayMotion` | 类型 | A tween of `game.tween`: a motion that can be waited for. |
| `PlayMusic` | 接口 | The music of a play game: play or stop it, and set its intensity, volume and mood. |
| `PlayOptions` | 接口 | A whole small game to start: its size and background, where it goes on the page, its setup and update, its seed, backend and save key. |
| `PlayPin` | 接口 | A node held against the edges of the screen: `set` holds it otherwise, `dispose` lets it go. |
| `PlayPinOptions` | 接口 | What a node is pinned to: the safe part, unless given, or the whole screen. |
| `PlayPointer` | 接口 |  |
| `PlayPointerLockOptions` | 接口 | The pointer of a play game: where it is, what it pressed, swipes, wheel and pointer lock. |
| `PlayPointerLockResult` | 接口 |  |
| `PlaySayOptions` | 接口 | A line of dialogue: who says it, the choices offered, its color and how fast it types. |
| `PlaySelectChoice` | 接口 | A valued item in a native, scrollable selection dialog. |
| `PlaySelectOptions` | 接口 | The current selection, visible title, cancellation label and skin. |
| `PlaySfx` | 接口 | The sound effects of a play game: play or loop one by name, define new ones, and set the volume. |
| `PlayStickOptions` | 接口 | A touch stick to show: where, how large, and whether it shows without touch. |
| `PlayTapActivation` | 类型 | The information supplied to game.onTap. |
| `PlayText` | 类 | A line of text: a sprite to place, fade, tween and remove like any other, with words that can be changed. |
| `PlayTextOptions` | 接口 | Text to show: where, how large, its color and alignment, whether bold, its layer, baseline and locale. |
| `PlayTiles` | 接口 | A map of tiles: read and change its cells, and push a sprite out of its solid ones. |
| `PlayTilesOptions` | 接口 | A map of tiles to make: the size of a tile, where its top left corner is, its colours, which characters are solid, and its layer. |
| `PlayToastHandle` | 接口 |  |
| `PlayToastOptions` | 接口 | A toast to show: duration, color and optional safe-area placement/skin. |
| `PlayToastPlacement` | 接口 | A notice's position in the safe area. |
| `PlayTouchButtonOptions` | 接口 | A touch button to show: where, the key it presses, how large, its color, and whether it shows without touch. |
| `PlayUiScale` | 接口 | The size on the screen that play's views keep: at least `min` and at most `max` CSS pixels a unit of theirs. |
| `PlayViewActivation` | 类型 | The second argument of a view's tap binding; target and currentTarget are part names, if named. |
| `PlayViewEditOptions` | 类型 | Native text input over the current clipped rectangle of a named view part. |
| `ScreenPin` | 接口 | Where a box is held in an area: on each axis a distance in from one edge, or from the middle. |
| `SFX_PRESETS` | 值 | The effects every game is given, by name. |
| `SfxRecipe` | 类型 | An effect: one tone, or several played one after another. |
| `SfxTone` | 接口 | One tone of an effect. |
| `SfxWave` | 类型 | The wave of a tone. |
| `synthesizeSfx` | 函数 | The samples of an effect, one channel, from -1 to 1. |
| `verticalPlayWords` | 函数 | Words written top to bottom in columns from right to left, as rows a line of text draws: one character under another, marks turned to their upright forms, a `\n` or `column` characters ending a column, and an ideographic space where a column is shorter than the longest. |
| `wrapPlayWords` | 函数 | Breaks words into lines no wider than `units`: at a space where there is one, between any two wide characters. |

## `@egret/engine/audio`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `AudioBackend` | 接口 | What a host gives the mixer. |
| `AudioBackendBus` | 接口 | One gain on the way to the output. |
| `AudioBackendSound` | 接口 | Decoded samples held by the host, or a file it plays as it reads it. |
| `AudioBackendStart` | 接口 | What the mixer asks a backend to start: the sound, its bus, where and how it plays. |
| `AudioBackendVoice` | 接口 | One sound being played once. |
| `AudioBus` | 接口 | A group of voices with one volume and one mute, such as music or effects. |
| `AudioBusOptions` | 接口 | A bus to make: its name, its volume and whether it is muted. |
| `AudioBusSnapshot` | 接口 | A bus as it is now: its name, volume, mute and voices. |
| `AudioEndReason` | 类型 | Why a voice is over: it reached its end; it was stopped; it gave its place to a newer voice; no place could be made for it; it was asked for while nothing could be heard; its sound was released; or the mixer was disposed. |
| `AudioFade` | 接口 | How long a change of volume takes. |
| `AudioMixer` | 接口 | Plays sounds and music on buses through a backend, within its limits of voices and memory. |
| `AudioMixerOptions` | 接口 | A mixer to make: its backend and buses, and how many voices, sounds and decoded bytes it holds. |
| `AudioMixerSnapshot` | 接口 | The mixer as it is now: its state, buses, voices, sounds, decoded bytes and music. |
| `AudioMixerState` | 类型 | Whether sound comes out. |
| `AudioMusicOptions` | 接口 | How music is played: its bus, volume, fade, loop and start, and whether the same piece restarts. |
| `AudioPlayOptions` | 接口 | How a sound is played: its bus, volume, rate, pan, loop, start and fade. |
| `AudioSound` | 接口 | A sound the mixer can play: its length, channels and rate, and whether it is decoded or streamed. |
| `AudioVoice` | 接口 | One sound playing: its state and position, and the calls that change or stop it. |
| `AudioVoiceState` | 类型 | Whether a voice is playing, paused, fading out to stop, or has ended. |
| `createAudioMixer` | 函数 | Volumes, voices and one music over a backend that makes the sound. |

## `@egret/engine/web/audio`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserAudio` | 接口 | A sound mixer playing through Web Audio, with its context and output node. |
| `BrowserAudioGlide` | 接口 | An exponential approach to a parameter's new value, with a time constant in seconds. |
| `BrowserAudioInput` | 接口 | A mixer-owned input strip; its upstream generators, decoded buffers and transport are caller-owned. |
| `BrowserAudioInputOptions` | 接口 | Initial levels for an external input. |
| `BrowserAudioOptions` | 接口 | Browser audio to make: its audio context, what unlocks it, whether it pauses when the page is hidden, and its limiter. |
| `createBrowserAudio` | 函数 | Sound for a page on Web Audio. |
| `createWebAudioBackend` | 函数 | A Web Audio backend for a mixer the page makes itself with `createAudioMixer`: const backend = createWebAudioBackend(); const mixer = createAudioMixer({ backend, locked: backend.locked }); backend.attach(mixer); `createBrowserAudio` does these three steps in one call. |
| `WebAudioBackend` | 接口 | A backend for `createAudioMixer` that plays through Web Audio. |
| `WebAudioBackendOptions` | 接口 | The Web Audio half of browser sound alone: its output, what unlocks it, whether it pauses when hidden, its limiter. |

## `@egret/engine/ui/semantics`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createUiListSemantics` | 函数 | Semantic nodes for a list control and its rows, kept in step with the control. |
| `createUiSemantics` | 函数 | A semantic tree for the controls an application draws. |
| `SemanticAction` | 类型 | What assistive technology may ask of a node: its activation, or the keyboard focus. |
| `SemanticBounds` | 接口 | A rectangle in the logical coordinates of the stage, the ones picking uses. |
| `semanticBoundsOf` | 函数 | The rectangle on the stage that encloses a display object and what it holds, for the bounds of a node. |
| `semanticBoxOf` | 函数 | The rectangle on the stage of a box a managed UI root laid out: a leaf, a row, a column or a list, by its id in the tree of the root. |
| `SemanticChecked` | 类型 | Whether a node is checked, not checked, or partly checked. |
| `SemanticDescription` | 接口 | What a node is at this moment, read from the control that draws it. |
| `SemanticExtent` | 接口 | How many rows and columns a grid has in all, whether or not all of them are published. |
| `SemanticListRow` | 接口 | What one row of a list says: its name, whether it is selected or disabled, its level and its place. |
| `SemanticListSource` | 接口 | What is read of a managed UI root. |
| `SemanticNode` | 接口 | A node of the semantic tree; remove it to take it out. |
| `SemanticNodeOptions` | 接口 | A node to add: its id, role and parent, how it is described, and what it does when activated or focused. |
| `SemanticOrientation` | 类型 | Whether a node runs across or down. |
| `SemanticPosition` | 接口 | Where an item stands in its whole set, from one. |
| `SemanticRange` | 接口 | The value of a range node and its least and greatest value. |
| `SemanticRole` | 类型 | What a control is to someone who cannot see the canvas. |
| `SemanticSnapshot` | 接口 | The semantic tree as published: its revisions, its nodes and the focused one. |
| `SemanticSnapshotNode` | 接口 | One published node. |
| `SemanticSort` | 类型 | How the rows of a grid are ordered by one of its columns. |
| `SemanticsState` | 类型 | Whether a semantic tree is active or closed. |
| `UiListSemantics` | 接口 | The semantic nodes of a list control and its rows; sync it when the rows change. |
| `UiListSemanticsOptions` | 接口 | Semantics for a list control: its tree and list, its role and name, and how its rows are described. |
| `UiSemantics` | 接口 | The semantic tree of a UI the application draws: what each control is, what it is called and what state it is in. |
| `UiSemanticsOptions` | 接口 | A semantic tree to make: how many nodes it holds. |

## `@egret/engine/ui/testing`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `createUiTester` | 函数 | Makes a tester over a semantic tree. |
| `UiTester` | 接口 | Finds controls by name and drives them through the semantic tree. |
| `UiTesterOptions` | 接口 | What a tester reads and drives: a semantic tree, how time moves, and the screen stack if there is one. |
| `UiTesterState` | 接口 | The state of a found control, as its node says it. |

## `@egret/engine/web/semantics`

| 名字 | 种类 | 说明 |
| --- | --- | --- |
| `BrowserSemantics` | 接口 | The semantic tree projected as elements over the canvas, for screen readers: sync it after the tree changes. |
| `BrowserSemanticsOptions` | 接口 | Browser semantics to make: the semantic tree, the canvas and its size, its label, and what is called on an error. |
| `createBrowserSemantics` | 函数 | Projects a semantic tree to the page, for assistive technology. |
