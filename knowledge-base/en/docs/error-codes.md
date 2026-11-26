# Error codes

English | [简体中文](../../Cns/docs/error-codes.md)

Every error this SDK throws is an `EgretError` with a `code`. This page lists each code with what it means. It is written by `node tools/error-codes.mjs` from the sources, and `tests/error-codes.test.mjs` fails when this page no longer matches them.

## Reading an error

| Part | Holds |
| --- | --- |
| `error.code` | The code, in capitals. It is stable: a program compares it |
| `error.message` | The code and the sentence below. It is for people and its wording may change. `setErrorLanguage('zh')` from `@egret/engine` puts the Chinese sentence there instead |
| `error.cause` | What made this error happen, when something did: the Host's own error behind `FRAME_RENDER_FAILED`, or what an application callback threw |
| `error.cleanupErrors` | What went wrong while cleaning up after the error, if anything |

A code is an area and what went wrong there. The area is how the code begins, and the ending says what happened: `..._OPTIONS_INVALID` for options that are not valid, `..._CLOSED` and `..._DISPOSED` for something used after its end, `..._REENTRANT` for a call made from inside its own callback, `..._LIMIT` and `..._BUDGET` for a limit that was passed, and `..._FAILED` for a failure whose cause is in `cause`.

Sentences that also say what to do were written for the codes a game meets most. The others are put together from the area and the ending, or written one by one where a code has no ending of the usual kind. `describeErrorCode(code, 'en' | 'zh')` gives the sentence of a code to a program.

The rows are the codes the sources name whole. Some parts put a code together from their area and a short name while running, so a code can be thrown that has no row here; its message carries its sentence all the same, made by the same rule.

## The codes a game meets first

| Code | Meaning |
| --- | --- |
| `FRAME_RENDER_FAILED` | The Host refused or failed to draw the frame. The reason is in cause: a code ending in _BACKPRESSURE means the Host was still busy with earlier frames, which the frame loop of @egret/engine/web/loop avoids. |
| `WEBGL2_BACKPRESSURE` | The WebGL2 Host holds as many unfinished frames as it takes. Draw the next frame later. |
| `WEBGPU_BACKPRESSURE` | The WebGPU Host holds as many unfinished frames as it takes. Draw the next frame later. |
| `CLOCK_DELTA_LIMIT` | The time given to engine.advanceTime is further from the last one than the clock takes in one step. Give it smaller steps, as the frame loop of @egret/engine/web/loop does after a tab was hidden. |
| `OBJECT_DISPOSED` | The object was disposed and can no longer be changed or added. Make a new one, or stop using it after its scope is disposed. |
| `SCOPE_CLOSED` | The scope was disposed, and everything it owned with it. Create a new scope. |
| `ENGINE_CLOSED` | The Engine was closed. Nothing made with it can be used any more. |
| `ENGINE_MISMATCH` | The object belongs to another Engine. A display tree, a scope and their resources all belong to one Engine. |
| `DISPLAY_VALUE_INVALID` | A value given to a display object is not valid: positions, scales, rotation and alpha are finite numbers (an alpha is held to 0 and 1) and visible is a boolean. |
| `FRAME_TRANSFORM_INVALID` | A display object is placed where its corners are not finite numbers. Check its x, y, scale and rotation, and those of its parents. |
| `FRAME_BUDGET_EXCEEDED` | The stage holds more than one frame takes: 65,536 nodes or commands, 256 materials, 4,096 different geometries or 65,536 mesh triangles. A circle of radius 40 is 32 triangles. |
| `FRAME_IMAGE_BUDGET` | The frame uses more images than it takes: 64 pages, 4,096 regions or 64 MiB of distinct pixels. Pack images into fewer atlases. |
| `GRAPHICS_FILL_REQUIRED` | A shape needs a fill or a line. Call beginFill or lineStyle before drawing it. |
| `GRAPHICS_VALUE_INVALID` | A value given to graphics is not valid: coordinates are finite numbers, sizes are not negative, a colour is 0 to 0xffffff and an alpha is a finite number (held to 0 and 1). |
| `ASSET_PROVIDER_MISSING` | No provider is registered for this type of asset. Register one with engine.assets.register before acquiring it. |
| `ASSET_LOAD_FAILED` | A provider failed to load the asset. What it threw is in cause. |
| `BITMAP_TEXTURE_REQUIRED` | A Bitmap is made with a lease of a texture from engine.assets.acquire. |
| `ASYNC_EVENT_HANDLER` | An event listener returned a promise. Listeners run to their end before dispatch returns; start asynchronous work without returning it. |
| `VIDEO_PLAY_REFUSED` | The browser refused to play the video, usually because it has sound and the page has not been pressed yet. Play it muted, or from a press. |
| `WEBGL2_CONTEXT_LOST` | The browser took the WebGL2 context away. The Host restores it when the browser gives it back; frames are refused until then. |
| `WEBGPU_DEVICE_LOST` | The browser took the WebGPU device away. The Host recovers where recovery is enabled; frames are refused until then. |
| `WEBGPU_UNAVAILABLE` | The browser has no WebGPU. Use the WebGL2 Host instead. |

## All codes, by area

### ANIMATION

| Code | Meaning |
| --- | --- |
| `ANIMATION_ALREADY_STARTED` | The animation coordinator was already started. |
| `ANIMATION_APPLY_FAILED` | The apply of the animation coordinator failed. The cause is in cause. |
| `ANIMATION_BINDING_INVALID` | The binding given to the animation coordinator is not valid. |
| `ANIMATION_CALLBACK_FAILED` | A callback the application gave to the animation coordinator threw. What it threw is in cause. |
| `ANIMATION_CALLBACK_RETURN_INVALID` | The callback return given to the animation coordinator is not valid. |
| `ANIMATION_CLEANUP_FAILED` | Cleaning up the animation coordinator failed. Each cause is in cleanupErrors. |
| `ANIMATION_COMMANDS_PENDING` | The commands of the animation coordinator is still pending. |
| `ANIMATION_COMMANDS_REPLACED` | The commands given to an animation for this tick were replaced by later ones before they ran. |
| `ANIMATION_COMMAND_INVALID` | The command given to the animation coordinator is not valid. |
| `ANIMATION_COMMAND_LIMIT` | The command limit of the animation coordinator was passed. |
| `ANIMATION_CONTROLLER_INVALID` | The controller given to the animation coordinator is not valid. |
| `ANIMATION_CONTROLLER_LIMIT` | The controller limit of the animation coordinator was passed. |
| `ANIMATION_COORDINATOR_CLOSED` | The coordinator of the animation coordinator was closed and takes nothing more. |
| `ANIMATION_ENGINE_INVALID` | The engine given to the animation coordinator is not valid. |
| `ANIMATION_EVENT_LIMIT` | The event limit of the animation coordinator was passed. |
| `ANIMATION_EVENT_SEQUENCE_LIMIT` | The event sequence limit of the animation coordinator was passed. |
| `ANIMATION_INVALID` | What was given to the animation coordinator is not valid. |
| `ANIMATION_LIMIT` | A limit of the animation coordinator was passed. |
| `ANIMATION_NOT_STARTED` | The animation coordinator has not been started. |
| `ANIMATION_OPTIONS_INVALID` | The options given to the animation coordinator are not valid: one is missing, of the wrong type or out of range. |
| `ANIMATION_PRECISION_LIMIT` | The precision limit of the animation coordinator was passed. |
| `ANIMATION_RATE_INVALID` | The rate given to the animation coordinator is not valid. |
| `ANIMATION_RATE_ZERO` | A rate of 0 was given to an animation. A rate is above or below zero: pause the animation to hold it still. |
| `ANIMATION_REENTRANT` | The animation coordinator was called again from inside one of its own callbacks. |
| `ANIMATION_SCOPE_INVALID` | The scope given to the animation coordinator is not an open scope of this Engine. |
| `ANIMATION_SEEK_BACKWARDS` | The seek given to the animation coordinator is earlier than the one before it. |
| `ANIMATION_SEEK_INVALID` | The seek given to the animation coordinator is not valid. |
| `ANIMATION_TARGET_BUSY` | The target of the animation coordinator is still busy with an earlier request. |
| `ANIMATION_TERMINAL` | The animation coordinator has ended and cannot be used again. |
| `ANIMATION_TERMINAL_COMMAND` | A command was given for an animation that has ended. |
| `ANIMATION_TICK_INVALID` | The tick given to the animation coordinator is not valid. |
| `ANIMATION_TIME_LIMIT` | The time limit of the animation coordinator was passed. |

### ASSET

| Code | Meaning |
| --- | --- |
| `ASSET_ACQUIRE_CANCELLED` | The request for the asset was cancelled, by its signal or because its scope was disposed. |
| `ASSET_ACQUIRE_FAILED` | The acquire of the asset manager failed. The cause is in cause. |
| `ASSET_CLEANUP_FAILED` | Cleaning up the asset manager failed. Each cause is in cleanupErrors. |
| `ASSET_DISPOSED` | The asset manager was disposed and takes nothing more. |
| `ASSET_ID_EXHAUSTED` | The id counter of the asset manager ran out. Make a new one. |
| `ASSET_LOAD_FAILED` | A provider failed to load the asset. What it threw is in cause. |
| `ASSET_NO_DEMAND` | The load of an asset was stopped because everything that had asked for it gave it up. |
| `ASSET_REF_INVALID` | The ref given to the asset manager is not valid. |
| `ASSET_SIGNAL_FAILED` | The signal of the asset manager failed. The cause is in cause. |
| `ASSET_TYPE_INVALID` | The type given to the asset manager is not valid. |
| `ASSET_TYPE_MISMATCH` | The type given to the asset manager does not match. |
| `ASSET_VALUE_INVALID` | The value given to the asset manager is not valid. |

### ASSET_BUNDLE

| Code | Meaning |
| --- | --- |
| `ASSET_BUNDLE_CHECK_FAILED` | The check of an asset bundle failed. The cause is in cause. |
| `ASSET_BUNDLE_ENTRY_MISSING` | A entry that an asset bundle needs is missing. |
| `ASSET_BUNDLE_FETCH_FAILED` | The fetch of an asset bundle failed. The cause is in cause. |
| `ASSET_BUNDLE_FORMAT_INVALID` | The format given to an asset bundle is not valid. |
| `ASSET_BUNDLE_INVALID` | What was given to an asset bundle is not valid. |
| `ASSET_BUNDLE_RANGE_INVALID` | The range given to an asset bundle is not valid. |

### ASSET_GROUP

| Code | Meaning |
| --- | --- |
| `ASSET_GROUP_ACQUIRE_FAILED` | The acquire of an asset group failed. The cause is in cause. |
| `ASSET_GROUP_CLEANUP_FAILED` | Cleaning up an asset group failed. Each cause is in cleanupErrors. |
| `ASSET_GROUP_DISPOSED` | An asset group was disposed and takes nothing more. |
| `ASSET_GROUP_INVALID` | What was given to an asset group is not valid. |
| `ASSET_GROUP_MEMBER_INVALID` | The member given to an asset group is not valid. |
| `ASSET_GROUP_OPTIONS_INVALID` | The options given to an asset group are not valid: one is missing, of the wrong type or out of range. |
| `ASSET_GROUP_REENTRANT` | An asset group was called again from inside one of its own callbacks. |
| `ASSET_GROUP_REFS_INVALID` | The refs given to an asset group is not valid. |
| `ASSET_GROUP_SCOPE_INVALID` | The scope given to an asset group is not an open scope of this Engine. |

### ASSET_LEASE

| Code | Meaning |
| --- | --- |
| `ASSET_LEASE_FACTORY_REQUIRED` | An asset lease is made by its factory function, not with new. |
| `ASSET_LEASE_RELEASED` | The lease was released and its asset may be gone. Acquire the asset again. |

### ASSET_MANAGER

| Code | Meaning |
| --- | --- |
| `ASSET_MANAGER_CLOSED` | The asset manager was closed and takes nothing more. |
| `ASSET_MANAGER_FACTORY_REQUIRED` | The asset manager is made by its factory function, not with new. |

### ASSET_PROVIDER

| Code | Meaning |
| --- | --- |
| `ASSET_PROVIDER_INVALID` | What was given to an asset provider is not valid. |
| `ASSET_PROVIDER_MISSING` | No provider is registered for this type of asset. Register one with engine.assets.register before acquiring it. |
| `ASSET_PROVIDER_REGISTERED` | A provider is already registered for this type of asset. |

### AUDIO

| Code | Meaning |
| --- | --- |
| `AUDIO_BACKEND_FAILED` | The backend of the audio mixer failed. The cause is in cause. |
| `AUDIO_BUDGET` | A limit of the audio mixer was passed. |
| `AUDIO_BUS_UNKNOWN` | No such bus is known to the audio mixer. |
| `AUDIO_BYTES_INVALID` | The bytes given to the audio mixer is not valid. |
| `AUDIO_CLEANUP_FAILED` | Cleaning up the audio mixer failed. Each cause is in cleanupErrors. |
| `AUDIO_CLOSED` | The audio mixer was closed and takes nothing more. |
| `AUDIO_DECODE_FAILED` | The decode of the audio mixer failed. The cause is in cause. |
| `AUDIO_HOST_UNAVAILABLE` | The page has no Web Audio, or it may not start before the page is pressed. |
| `AUDIO_LISTENER_FAILED` | A listener the application gave to the audio mixer threw. What it threw is in cause. |
| `AUDIO_OPTIONS_INVALID` | The options given to the audio mixer are not valid: one is missing, of the wrong type or out of range. |
| `AUDIO_PLAY_OPTIONS` | The options given to the audio mixer are not valid. |
| `AUDIO_REASON_INVALID` | The reason given to the audio mixer is not valid. |
| `AUDIO_REASON_LIMIT` | The reason limit of the audio mixer was passed. |
| `AUDIO_SOUND_INVALID` | The sound given to the audio mixer is not valid. |
| `AUDIO_SOUND_LIMIT` | The sound limit of the audio mixer was passed. |
| `AUDIO_SOUND_RELEASED` | The sound of the audio mixer was released and can no longer be used. |
| `AUDIO_STREAM_FAILED` | The stream of the audio mixer failed. The cause is in cause. |
| `AUDIO_STREAM_UNSUPPORTED` | The stream is not supported by the audio mixer. |
| `AUDIO_URL_INVALID` | The url given to the audio mixer is not valid. |

### AUDIO_CUES

| Code | Meaning |
| --- | --- |
| `AUDIO_CUES_INVALID` | What was given to the sound cues is not valid. |

### AUDIO_WAV

| Code | Meaning |
| --- | --- |
| `AUDIO_WAV_INVALID` | What was given to the WAV encoder is not valid. |

### BITMAP

| Code | Meaning |
| --- | --- |
| `BITMAP_INVALID` | What was given to a bitmap is not valid. |
| `BITMAP_LEASE_INVALID` | The lease given to a bitmap is not valid. |
| `BITMAP_MUTATION_REENTRANT` | The mutation of a bitmap was called again from inside one of its own callbacks. |
| `BITMAP_REGION_INVALID` | The region given to a bitmap is not valid. |
| `BITMAP_TEXTURE_INVALID` | The texture given to a bitmap is not valid. |
| `BITMAP_TEXTURE_REQUIRED` | A Bitmap is made with a lease of a texture from engine.assets.acquire. |

### BITMAP_BINDING

| Code | Meaning |
| --- | --- |
| `BITMAP_BINDING_DISPOSED` | A bitmap binding was disposed and takes nothing more. |
| `BITMAP_BINDING_INVALID` | What was given to a bitmap binding is not valid. |
| `BITMAP_BINDING_MEMBERS_INVALID` | The members given to a bitmap binding is not valid. |
| `BITMAP_BINDING_REENTRANT` | A bitmap binding was called again from inside one of its own callbacks. |
| `BITMAP_BINDING_SCOPE_INVALID` | The scope given to a bitmap binding is not an open scope of this Engine. |
| `BITMAP_BINDING_STATE_INVALID` | The state given to a bitmap binding is not valid. |
| `BITMAP_BINDING_TARGETS_INVALID` | The targets given to a bitmap binding is not valid. |

### BITMAP_BUTTON

| Code | Meaning |
| --- | --- |
| `BITMAP_BUTTON_CLEANUP_FAILED` | Cleaning up a bitmap button failed. Each cause is in cleanupErrors. |
| `BITMAP_BUTTON_DISPOSED` | A bitmap button was disposed and takes nothing more. |
| `BITMAP_BUTTON_INPUT_CLOSED` | The input of a bitmap button was closed and takes nothing more. |
| `BITMAP_BUTTON_INVALID` | What was given to a bitmap button is not valid. |
| `BITMAP_BUTTON_OPTIONS_INVALID` | The options given to a bitmap button are not valid: one is missing, of the wrong type or out of range. |
| `BITMAP_BUTTON_SETUP_FAILED` | Setting up a bitmap button failed. The cause is in cause. |
| `BITMAP_BUTTON_SKIN_INVALID` | The skin given to a bitmap button is not valid. |

### BITMAP_FONT

| Code | Meaning |
| --- | --- |
| `BITMAP_FONT_INVALID` | What was given to a bitmap font is not valid. |

### BITMAP_RESOURCE

| Code | Meaning |
| --- | --- |
| `BITMAP_RESOURCE_BINDING_CHANGED` | The binding of a bitmap resource slot changed while a request was on its way. |
| `BITMAP_RESOURCE_CANCELLED` | A bitmap resource slot was cancelled. |
| `BITMAP_RESOURCE_CLEANUP_FAILED` | Cleaning up a bitmap resource slot failed. Each cause is in cleanupErrors. |
| `BITMAP_RESOURCE_DISPOSED` | A bitmap resource slot was disposed and takes nothing more. |
| `BITMAP_RESOURCE_INVALID` | What was given to a bitmap resource slot is not valid. |
| `BITMAP_RESOURCE_LEASE_INVALID` | The lease given to a bitmap resource slot is not valid. |
| `BITMAP_RESOURCE_LIMIT` | A limit of a bitmap resource slot was passed. |
| `BITMAP_RESOURCE_PREPARED_INVALID` | The prepared given to a bitmap resource slot is not valid. |
| `BITMAP_RESOURCE_REPLACE_FAILED` | The replace of a bitmap resource slot failed. The cause is in cause. |
| `BITMAP_RESOURCE_SCOPE_INVALID` | The scope given to a bitmap resource slot is not an open scope of this Engine. |
| `BITMAP_RESOURCE_SUPERSEDED` | A newer request to a bitmap resource slot replaced this one. |
| `BITMAP_RESOURCE_TARGET_BUSY` | The target of a bitmap resource slot is still busy with an earlier request. |
| `BITMAP_RESOURCE_TARGET_INVALID` | The target given to a bitmap resource slot is not valid. |
| `BITMAP_RESOURCE_TEXTURE_REQUIRED` | A texture is required by a bitmap resource slot. |

### BITMAP_TEXT

| Code | Meaning |
| --- | --- |
| `BITMAP_TEXT_CLEANUP_FAILED` | Cleaning up bitmap text failed. Each cause is in cleanupErrors. |
| `BITMAP_TEXT_CLOSED` | Bitmap text was closed and takes nothing more. |
| `BITMAP_TEXT_OPTIONS_INVALID` | The options given to bitmap text are not valid: one is missing, of the wrong type or out of range. |
| `BITMAP_TEXT_TOO_LONG` | What was given to bitmap text is too long. |

### BOUNDS

| Code | Meaning |
| --- | --- |
| `BOUNDS_ARITHMETIC_RANGE` | The arithmetic is out of range for a bounds query. |
| `BOUNDS_CONTENT_LIMIT` | The content limit of a bounds query was passed. |
| `BOUNDS_INPUT_INVALID` | The input given to a bounds query is not valid. |
| `BOUNDS_RECEIVER_INVALID` | The receiver given to a bounds query is not valid. |
| `BOUNDS_TREE_LIMIT` | The tree limit of a bounds query was passed. |

### BROWSER_GAME

| Code | Meaning |
| --- | --- |
| `BROWSER_GAME_IMAGE_FAILED` | The image of the browser game failed. The cause is in cause. |
| `BROWSER_GAME_OPTIONS_INVALID` | The options given to the browser game are not valid: one is missing, of the wrong type or out of range. |

### BROWSER_IMAGE

| Code | Meaning |
| --- | --- |
| `BROWSER_IMAGE_BYTES_INVALID` | The bytes given to the browser image reader is not valid. |
| `BROWSER_IMAGE_DECODE_FAILED` | The decode of the browser image reader failed. The cause is in cause. |
| `BROWSER_IMAGE_FORMAT_UNKNOWN` | No such format is known to the browser image reader. |
| `BROWSER_IMAGE_PROVIDER_INVALID` | The provider given to the browser image reader is not valid. |
| `BROWSER_IMAGE_SIZE_INVALID` | The size given to the browser image reader is not valid. |
| `BROWSER_IMAGE_UNAVAILABLE` | The browser image reader is not available here. |

### BROWSER_STATS

| Code | Meaning |
| --- | --- |
| `BROWSER_STATS_OPTIONS_INVALID` | The options given to the stats panel are not valid: one is missing, of the wrong type or out of range. |

### BROWSER_STORAGE

| Code | Meaning |
| --- | --- |
| `BROWSER_STORAGE_CLOSED` | The browser storage was closed and takes nothing more. |
| `BROWSER_STORAGE_OPTIONS_INVALID` | The options given to the browser storage are not valid: one is missing, of the wrong type or out of range. |
| `BROWSER_STORAGE_UNAVAILABLE` | The browser storage is not available here. |
| `BROWSER_STORAGE_WRITE_FAILED` | The write of the browser storage failed. The cause is in cause. |

### BROWSER_TEXT_EDITOR

| Code | Meaning |
| --- | --- |
| `BROWSER_TEXT_EDITOR_ACTIVATION_CANCELLED` | The activation of the browser text editor was cancelled. |
| `BROWSER_TEXT_EDITOR_BUSY` | The browser text editor is still busy with an earlier request. |
| `BROWSER_TEXT_EDITOR_CLOSED` | The browser text editor was closed and takes nothing more. |
| `BROWSER_TEXT_EDITOR_COMPOSING` | The browser text editor is composing text with an input method. Wait for that to end. |
| `BROWSER_TEXT_EDITOR_ELEMENT_DETACHED` | The element of the browser text editor is no longer in the page. |
| `BROWSER_TEXT_EDITOR_FOCUS` | The browser text editor could not take or keep the focus. |
| `BROWSER_TEXT_EDITOR_FONT_GENERATION` | The fonts given to the browser text editor are not of the generation it expects. |
| `BROWSER_TEXT_EDITOR_INACTIVE` | The browser text editor is not active. |
| `BROWSER_TEXT_EDITOR_OPTIONS` | The options given to the browser text editor are not valid. |
| `BROWSER_TEXT_EDITOR_PLACEMENT_UNSUPPORTED` | The placement is not supported by the browser text editor. |
| `BROWSER_TEXT_EDITOR_PRESENTATION_PENDING` | The presentation of the browser text editor is still pending. |
| `BROWSER_TEXT_EDITOR_REENTRANT` | The browser text editor was called again from inside one of its own callbacks. |
| `BROWSER_TEXT_EDITOR_SURFACE` | The surface given to the browser text editor is not a canvas it can use. |
| `BROWSER_TEXT_EDITOR_TARGET` | The target given to the browser text editor is not valid. |
| `BROWSER_TEXT_EDITOR_UNSUPPORTED` | This is not supported by the browser text editor. |

### BROWSER_TEXT_INPUT

| Code | Meaning |
| --- | --- |
| `BROWSER_TEXT_INPUT_DISPOSED` | The browser text input was disposed and takes nothing more. |
| `BROWSER_TEXT_INPUT_IDLE` | The browser text input has no request in hand. |
| `BROWSER_TEXT_INPUT_OPTIONS` | The options given to the browser text input are not valid. |
| `BROWSER_TEXT_INPUT_REENTRANT` | The browser text input was called again from inside one of its own callbacks. |
| `BROWSER_TEXT_INPUT_REQUEST` | The request given to the browser text input is not valid. |
| `BROWSER_TEXT_INPUT_SURFACE` | The surface given to the browser text input is not a canvas it can use. |

### CAMERA

| Code | Meaning |
| --- | --- |
| `CAMERA_CLEANUP_FAILED` | Cleaning up the camera failed. Each cause is in cleanupErrors. |
| `CAMERA_CLOSED` | The camera was closed and takes nothing more. |
| `CAMERA_LAYER_INVALID` | The layer given to the camera is not valid. |
| `CAMERA_OPTIONS_INVALID` | The options given to the camera are not valid: one is missing, of the wrong type or out of range. |
| `CAMERA_TARGET_INVALID` | The target given to the camera is not valid. |

### CLOCK

| Code | Meaning |
| --- | --- |
| `CLOCK_CALLBACK_FAILED` | A callback the application gave to the game clock threw. What it threw is in cause. |
| `CLOCK_CALLBACK_LIMIT` | The callback limit of the game clock was passed. |
| `CLOCK_CALLBACK_RETURN_INVALID` | The callback return given to the game clock is not valid. |
| `CLOCK_DELTA_LIMIT` | The time given to engine.advanceTime is further from the last one than the clock takes in one step. Give it smaller steps, as the frame loop of @egret/engine/web/loop does after a tab was hidden. |
| `CLOCK_HANDLER_INVALID` | The handler given to the game clock is not valid. |
| `CLOCK_INVALID` | What was given to the game clock is not valid. |
| `CLOCK_OPTIONS_INVALID` | The options given to the game clock are not valid: one is missing, of the wrong type or out of range. |
| `CLOCK_REENTRANT` | engine.advanceTime was called from inside a tick or while a frame was being captured. |
| `CLOCK_SCOPE_INVALID` | The scope given to the game clock is not an open scope of this Engine. |
| `CLOCK_SOURCE_BACKWARDS` | The time given to engine.advanceTime is earlier than the last one. It takes seconds that never go back. |
| `CLOCK_SOURCE_INVALID` | The time given to engine.advanceTime is not a finite number of seconds, zero or more. |
| `CLOCK_SUBSCRIPTION_ID_EXHAUSTED` | The subscription id counter of the game clock ran out. Make a new one. |
| `CLOCK_SUBSCRIPTION_INVALID` | The subscription given to the game clock is not valid. |
| `CLOCK_TICK_ID_EXHAUSTED` | The tick id counter of the game clock ran out. Make a new one. |
| `CLOCK_TIME_RANGE` | The time is out of range for the game clock. |

### CONTENT

| Code | Meaning |
| --- | --- |
| `CONTENT_ENGINE_INVALID` | The engine given to content loading is not valid. |
| `CONTENT_MANIFEST_INVALID` | The manifest given to content loading is not valid. |
| `CONTENT_METADATA_LIMIT` | The metadata limit of content loading was passed. |
| `CONTENT_PROVIDERS_INVALID` | The providers given to content loading is not valid. |
| `CONTENT_RESOURCE_INVALID` | The resource given to content loading is not valid. |
| `CONTENT_ROOTS_INVALID` | The roots given to content loading is not valid. |
| `CONTENT_SCOPE_INVALID` | The scope given to content loading is not an open scope of this Engine. |

### CONTENT_GROUP

| Code | Meaning |
| --- | --- |
| `CONTENT_GROUP_DISPOSED` | A content group was disposed and takes nothing more. |
| `CONTENT_GROUP_INVALID` | What was given to a content group is not valid. |
| `CONTENT_GROUP_LIMIT` | A limit of a content group was passed. |
| `CONTENT_GROUP_NOT_READY` | A content group is not ready yet. |

### CONTENT_LOADER

| Code | Meaning |
| --- | --- |
| `CONTENT_LOADER_DISPOSED` | A content loader was disposed and takes nothing more. |
| `CONTENT_LOADER_INVALID` | What was given to a content loader is not valid. |

### COORDINATE

| Code | Meaning |
| --- | --- |
| `COORDINATE_ARITHMETIC_RANGE` | The arithmetic is out of range for a coordinate query. |
| `COORDINATE_INPUT_INVALID` | The input given to a coordinate query is not valid. |
| `COORDINATE_RECEIVER_INVALID` | The receiver given to a coordinate query is not valid. |
| `COORDINATE_TRANSFORM_SINGULAR` | A display object on the way has a scale of zero, so a stage point has no local point. |
| `COORDINATE_TREE_LIMIT` | The tree limit of a coordinate query was passed. |

### DISPLAY

| Code | Meaning |
| --- | --- |
| `DISPLAY_ACTIVE` | A display object is still active. |
| `DISPLAY_CHILD_CLEANUP_FAILED` | Cleaning up a display object failed. Each cause is in cleanupErrors. |
| `DISPLAY_CYCLE` | A container cannot be added to itself or to one of its own descendants. |
| `DISPLAY_SIZE_UNAVAILABLE` | The object draws nothing, so it has no width or height to scale to a size. Draw it first, or set scaleX and scaleY. |
| `DISPLAY_VALUE_INVALID` | A value given to a display object is not valid: positions, scales, rotation and alpha are finite numbers (an alpha is held to 0 and 1) and visible is a boolean. |

### DISPLAY_EFFECT

| Code | Meaning |
| --- | --- |
| `DISPLAY_EFFECT_INVALID` | What was given to a render effect is not valid. |
| `DISPLAY_EFFECT_MASK_INVALID` | The mask given to a render effect is not valid. |
| `DISPLAY_EFFECT_MASK_UNSUPPORTED` | The mask is not supported by a render effect. |

### DISPLAY_SUBTREE

| Code | Meaning |
| --- | --- |
| `DISPLAY_SUBTREE_LIMIT` | A limit of a prepared display subtree was passed. |
| `DISPLAY_SUBTREE_NODE_INVALID` | The node given to a prepared display subtree is not valid. |
| `DISPLAY_SUBTREE_OVERLAP` | Two prepared display subtrees share a node. |
| `DISPLAY_SUBTREE_OWNER_CLOSED` | The owner of a prepared display subtree was closed and takes nothing more. |
| `DISPLAY_SUBTREE_OWNER_INVALID` | The owner given to a prepared display subtree is not valid. |
| `DISPLAY_SUBTREE_REENTRANT` | A prepared display subtree was called again from inside one of its own callbacks. |
| `DISPLAY_SUBTREE_RETIRED` | A prepared display subtree has been retired and cannot be used again. |
| `DISPLAY_SUBTREE_ROOT_INVALID` | The root given to a prepared display subtree is not valid. |
| `DISPLAY_SUBTREE_SCOPE_INVALID` | The scope given to a prepared display subtree is not an open scope of this Engine. |
| `DISPLAY_SUBTREE_STALE` | What was given to a prepared display subtree has been replaced by a newer one. |
| `DISPLAY_SUBTREE_TARGET_DETACHED` | The target of a prepared display subtree is no longer on the stage. |
| `DISPLAY_SUBTREE_TICKET_INVALID` | The ticket given to a prepared display subtree is not valid. |

### DISPLAY_TREE

| Code | Meaning |
| --- | --- |
| `DISPLAY_TREE_CLEANUP_FAILED` | Cleaning up the display tree failed. Each cause is in cleanupErrors. |
| `DISPLAY_TREE_INVARIANT` | The display tree changed while it was being walked, or a node was reached twice. Do not change the tree from inside a capture or a query. |

### ENGINE

| Code | Meaning |
| --- | --- |
| `ENGINE_ASSETS_CLEANUP_FAILED` | Cleaning up the Engine failed. Each cause is in cleanupErrors. |
| `ENGINE_CLOSED` | The Engine was closed. Nothing made with it can be used any more. |
| `ENGINE_CLOSE_FAILED` | The close of the Engine failed. The cause is in cause. |
| `ENGINE_CLOSE_TIMEOUT` | The close of the Engine took too long. |
| `ENGINE_FACTORY_REQUIRED` | The Engine is made by its factory function, not with new. |
| `ENGINE_MISMATCH` | The object belongs to another Engine. A display tree, a scope and their resources all belong to one Engine. |
| `ENGINE_RENDER_PROFILE_UNSUPPORTED` | The render profile is not supported by the Engine. |
| `ENGINE_SCOPE_CLEANUP_FAILED` | Cleaning up the Engine failed. Each cause is in cleanupErrors. |
| `ENGINE_STAGE_CLEANUP_FAILED` | Cleaning up the Engine failed. Each cause is in cleanupErrors. |
| `ENGINE_START_FAILED` | The start of the Engine failed. The cause is in cause. |

### EVENT

| Code | Meaning |
| --- | --- |
| `EVENT_ACTIVE` | An event is still active. |
| `EVENT_LIMIT` | A limit of an event was passed. |
| `EVENT_LISTENER_CLEANUP_FAILED` | Cleaning up an event failed. Each cause is in cleanupErrors. |
| `EVENT_SUBSCRIPTION_FAILED` | The subscription of an event failed. The cause is in cause. |

### FONT_CONTENT

| Code | Meaning |
| --- | --- |
| `FONT_CONTENT_ASSET` | The asset given to font content is not valid. |
| `FONT_CONTENT_BYTES` | The bytes given to font content are not valid. |
| `FONT_CONTENT_CANCELLED` | Font content was cancelled. |
| `FONT_CONTENT_CLOSED` | Font content was closed and takes nothing more. |
| `FONT_CONTENT_FLAVOR` | The flavor given to font content is not valid. |
| `FONT_CONTENT_GROUP` | The group given to font content is not valid. |
| `FONT_CONTENT_INPUT` | The input given to font content is not valid. |
| `FONT_CONTENT_LIMIT` | A limit of font content was passed. |
| `FONT_CONTENT_LOADER` | The loader given to font content is not valid. |
| `FONT_CONTENT_NOT_READY` | Font content is not ready yet. |
| `FONT_CONTENT_PROFILE` | The profile given to font content is not valid. |
| `FONT_CONTENT_PROVIDER` | The provider given to font content is not valid. |
| `FONT_CONTENT_REF` | The ref given to font content is not valid. |
| `FONT_CONTENT_ROOTS` | The roots given to font content are not valid. |
| `FONT_CONTENT_SCOPE` | The scope given to font content is not valid. |

### FRAME

| Code | Meaning |
| --- | --- |
| `FRAME_BUDGET_EXCEEDED` | The stage holds more than one frame takes: 65,536 nodes or commands, 256 materials, 4,096 different geometries or 65,536 mesh triangles. A circle of radius 40 is 32 triangles. |
| `FRAME_ID_EXHAUSTED` | The id counter of a frame ran out. Make a new one. |
| `FRAME_IMAGES_NEAR_LIMIT` | A warning of the browser game, not an error: a frame holds four fifths of the images a frame takes (64 pages, 4,096 regions, 64 MiB). Labels of createAtlasLabel share pages. |
| `FRAME_IMAGE_BUDGET` | The frame uses more images than it takes: 64 pages, 4,096 regions or 64 MiB of distinct pixels. Pack images into fewer atlases. |
| `FRAME_PROFILE_METADATA_UNSUPPORTED` | The profile metadata is not supported by a frame. |
| `FRAME_REENTRANT` | A frame was asked for while another was being captured. Draw from the frame loop, not from inside a callback of the capture. |
| `FRAME_RENDER_FAILED` | The Host refused or failed to draw the frame. The reason is in cause: a code ending in _BACKPRESSURE means the Host was still busy with earlier frames, which the frame loop of @egret/engine/web/loop avoids. |
| `FRAME_STAGE_INVALID` | A frame is captured from the stage of an Engine, and this is not one. |
| `FRAME_TRANSFORM_INVALID` | A display object is placed where its corners are not finite numbers. Check its x, y, scale and rotation, and those of its parents. |

### FRAME_LOOP

| Code | Meaning |
| --- | --- |
| `FRAME_LOOP_CLOSED` | The frame loop was disposed. Create a new one. |
| `FRAME_LOOP_OPTIONS_INVALID` | The options given to the frame loop are not valid: one is missing, of the wrong type or out of range. |

### GAMEPAD

| Code | Meaning |
| --- | --- |
| `GAMEPAD_AXIS_UNKNOWN` | No such axis is known to gamepad input. |
| `GAMEPAD_BUTTON_UNKNOWN` | No such button is known to gamepad input. |
| `GAMEPAD_CLOSED` | Gamepad input was closed and takes nothing more. |
| `GAMEPAD_HOST_UNAVAILABLE` | The host of gamepad input is not available here. |
| `GAMEPAD_LISTENER_FAILED` | A listener the application gave to gamepad input threw. What it threw is in cause. |
| `GAMEPAD_OPTIONS_INVALID` | The options given to gamepad input are not valid: one is missing, of the wrong type or out of range. |
| `GAMEPAD_REENTRANT` | Gamepad input was called again from inside one of its own callbacks. |
| `GAMEPAD_SAMPLE` | The sample given to gamepad input is not a gamepad sample. |
| `GAMEPAD_STICK_UNKNOWN` | No such stick is known to gamepad input. |

### GESTURE

| Code | Meaning |
| --- | --- |
| `GESTURE_CLOSED` | Gestures was closed and takes nothing more. |
| `GESTURE_OPTIONS_INVALID` | The options given to gestures are not valid: one is missing, of the wrong type or out of range. |

### GRAPHICS

| Code | Meaning |
| --- | --- |
| `GRAPHICS_BUDGET` | The drawing is more than one sprite holds: a path of 8,192 points, a line of 16,384 dashes, a fill with holes or crossings of 16,384 triangles, 16 meshes, or an image repeated beyond 8,192 of its pixels. What the sprite had drawn before stays. Draw the rest into another sprite. |
| `GRAPHICS_FILL_REQUIRED` | A shape needs a fill or a line. Call beginFill or lineStyle before drawing it. |
| `GRAPHICS_VALUE_INVALID` | A value given to graphics is not valid: coordinates are finite numbers, sizes are not negative, a colour is 0 to 0xffffff and an alpha is a finite number (held to 0 and 1). |

### HEADLESS_RUN

| Code | Meaning |
| --- | --- |
| `HEADLESS_RUN_INVALID` | What was given to a headless run is not valid. |

### HIT_TEST

| Code | Meaning |
| --- | --- |
| `HIT_TEST_AREA_INVALID` | The area given to a hit test is not valid. |
| `HIT_TEST_ARITHMETIC_RANGE` | The arithmetic is out of range for a hit test. |
| `HIT_TEST_INPUT_INVALID` | The input given to a hit test is not valid. |
| `HIT_TEST_RECEIVER_INVALID` | The receiver given to a hit test is not valid. |
| `HIT_TEST_TREE_LIMIT` | The tree limit of a hit test was passed. |
| `HIT_TEST_VALUE_INVALID` | The value given to a hit test is not valid. |

### HOVER_INPUT

| Code | Meaning |
| --- | --- |
| `HOVER_INPUT_CALLBACK_FAILED` | A callback the application gave to hover input threw. What it threw is in cause. |
| `HOVER_INPUT_CAPACITY` | Hover input holds as much as it takes. |
| `HOVER_INPUT_CLEANUP_FAILED` | Cleaning up hover input failed. Each cause is in cleanupErrors. |
| `HOVER_INPUT_EVENT_INVALID` | The event given to hover input is not valid. |
| `HOVER_INPUT_EXHAUSTED` | A counter of hover input ran out. Make a new one. |
| `HOVER_INPUT_OPTIONS_INVALID` | The options given to hover input are not valid: one is missing, of the wrong type or out of range. |
| `HOVER_INPUT_REASON` | The reason given to hover input for a leave is not one it knows. |
| `HOVER_INPUT_REENTRANT` | Hover input was called again from inside one of its own callbacks. |
| `HOVER_INPUT_SAMPLE` | The sample given to hover input is not an object with a pointer id, a pointer type, global coordinates and a timestamp. |
| `HOVER_INPUT_SETUP_FAILED` | Setting up hover input failed. The cause is in cause. |
| `HOVER_INPUT_SURFACE_BUSY` | The surface of hover input is still busy with an earlier request. |
| `HOVER_INPUT_SURFACE_INVALID` | The surface given to hover input is not valid. |
| `HOVER_INPUT_VIEWPORT` | The viewport revision given to hover input is not a whole number above the last one. |

### INPUT_ACTIONS

| Code | Meaning |
| --- | --- |
| `INPUT_ACTIONS_INVALID` | What was given to the input actions is not valid. |

### KEYBOARD

| Code | Meaning |
| --- | --- |
| `KEYBOARD_REGISTRATION_CLOSED` | The registration of the keyboard was closed and takes nothing more. |
| `KEYBOARD_TARGET_INELIGIBLE` | The keyboard target cannot take focus now, for instance because it is disabled or not on the stage. |
| `KEYBOARD_TARGET_INVALID` | The target given to the keyboard is not valid. |

### KEYBOARD_FOCUS_SCOPE

| Code | Meaning |
| --- | --- |
| `KEYBOARD_FOCUS_SCOPE_ACTIVE` | A keyboard focus scope is still active. |
| `KEYBOARD_FOCUS_SCOPE_CLOSED` | A keyboard focus scope was closed and takes nothing more. |
| `KEYBOARD_FOCUS_SCOPE_INVALID` | What was given to a keyboard focus scope is not valid. |

### KEYBOARD_INPUT

| Code | Meaning |
| --- | --- |
| `KEYBOARD_INPUT_CANCEL_INVALID` | The cancel given to keyboard input is not valid. |
| `KEYBOARD_INPUT_CLOSED` | Keyboard input was closed and takes nothing more. |
| `KEYBOARD_INPUT_FOCUS_INVALID` | The focus given to keyboard input is not valid. |
| `KEYBOARD_INPUT_HOST_FAILED` | The host of keyboard input failed. The cause is in cause. |
| `KEYBOARD_INPUT_IN_USE` | Keyboard input is already in use. |
| `KEYBOARD_INPUT_KEY_CAPACITY` | The key capacity of keyboard input is full. |
| `KEYBOARD_INPUT_OPTIONS_INVALID` | The options given to keyboard input are not valid: one is missing, of the wrong type or out of range. |
| `KEYBOARD_INPUT_REENTRANT` | Keyboard input was called again from inside one of its own callbacks. |
| `KEYBOARD_INPUT_SAMPLE_INVALID` | The sample given to keyboard input is not valid. |
| `KEYBOARD_INPUT_SURFACE_INVALID` | The surface given to keyboard input is not valid. |

### LAYOUT

| Code | Meaning |
| --- | --- |
| `LAYOUT_LIMIT` | A limit of a layout was passed. |
| `LAYOUT_OPTIONS_INVALID` | The options given to a layout are not valid: one is missing, of the wrong type or out of range. |
| `LAYOUT_OVERFLOW` | The children do not fit the space the layout was given. |

### MANIFEST_BINDING

| Code | Meaning |
| --- | --- |
| `MANIFEST_BINDING_ASSET_INVALID` | The asset given to a manifest binding is not valid. |
| `MANIFEST_BINDING_ID_EXHAUSTED` | The id counter of a manifest binding ran out. Make a new one. |
| `MANIFEST_BINDING_INVALID` | What was given to a manifest binding is not valid. |
| `MANIFEST_BINDING_MANIFEST_INVALID` | The manifest given to a manifest binding is not valid. |
| `MANIFEST_BINDING_REF_INVALID` | The ref given to a manifest binding is not valid. |

### MANIFEST_GROUP

| Code | Meaning |
| --- | --- |
| `MANIFEST_GROUP_ACQUIRE_FAILED` | The acquire of a manifest group failed. The cause is in cause. |
| `MANIFEST_GROUP_BINDINGS_INVALID` | The bindings given to a manifest group is not valid. |
| `MANIFEST_GROUP_BINDING_INVALID` | The binding given to a manifest group is not valid. |
| `MANIFEST_GROUP_CLEANUP_FAILED` | Cleaning up a manifest group failed. Each cause is in cleanupErrors. |
| `MANIFEST_GROUP_DISPOSED` | A manifest group was disposed and takes nothing more. |
| `MANIFEST_GROUP_INVALID` | What was given to a manifest group is not valid. |
| `MANIFEST_GROUP_LIMIT` | A limit of a manifest group was passed. |
| `MANIFEST_GROUP_MANIFEST_INVALID` | The manifest given to a manifest group is not valid. |
| `MANIFEST_GROUP_NOT_READY` | A manifest group is not ready yet. |
| `MANIFEST_GROUP_OPTIONS_INVALID` | The options given to a manifest group are not valid: one is missing, of the wrong type or out of range. |
| `MANIFEST_GROUP_QUEUE_LIMIT` | The queue limit of a manifest group was passed. |
| `MANIFEST_GROUP_REENTRANT` | A manifest group was called again from inside one of its own callbacks. |
| `MANIFEST_GROUP_ROOTS_INVALID` | The roots given to a manifest group is not valid. |
| `MANIFEST_GROUP_SCOPE_INVALID` | The scope given to a manifest group is not an open scope of this Engine. |

### MESH

| Code | Meaning |
| --- | --- |
| `MESH_GEOMETRY_INVALID` | What was given is not a geometry made by createSharedGeometry2D or createTexturedGeometry2D. |
| `MESH_INVALID` | What was given to a mesh is not valid. |
| `MESH_LEASE_INVALID` | The lease given to a mesh is not valid. |
| `MESH_MUTATION_REENTRANT` | The mutation of a mesh was called again from inside one of its own callbacks. |
| `MESH_TEXTURE_INVALID` | The texture given to a mesh is not valid. |

### MESH_BINDING

| Code | Meaning |
| --- | --- |
| `MESH_BINDING_DISPOSED` | A mesh binding was disposed and takes nothing more. |
| `MESH_BINDING_FACTORY_REQUIRED` | A mesh binding is made by its factory function, not with new. |
| `MESH_BINDING_STALE` | What was given to a mesh binding has been replaced by a newer one. |

### MOTION

| Code | Meaning |
| --- | --- |
| `MOTION_ALREADY_STARTED` | A motion was already started. |
| `MOTION_OPTIONS_INVALID` | The options given to a motion are not valid: one is missing, of the wrong type or out of range. |

### MOUSE_INPUT

| Code | Meaning |
| --- | --- |
| `MOUSE_INPUT_CALLBACK_FAILED` | A callback the application gave to mouse input threw. What it threw is in cause. |
| `MOUSE_INPUT_CLEANUP_FAILED` | Cleaning up mouse input failed. Each cause is in cleanupErrors. |
| `MOUSE_INPUT_EVENT_INVALID` | The event given to mouse input is not valid. |
| `MOUSE_INPUT_INVALID` | What was given to mouse input is not valid. |
| `MOUSE_INPUT_IN_USE` | Mouse input is already in use. |
| `MOUSE_INPUT_OPTIONS_INVALID` | The options given to mouse input are not valid: one is missing, of the wrong type or out of range. |
| `MOUSE_INPUT_REENTRANT` | Mouse input was called again from inside one of its own callbacks. |
| `MOUSE_INPUT_SCOPE_INVALID` | The scope given to mouse input is not an open scope of this Engine. |
| `MOUSE_INPUT_SETUP_FAILED` | Setting up mouse input failed. The cause is in cause. |
| `MOUSE_INPUT_SURFACE_INVALID` | The surface given to mouse input is not valid. |

### NINE_SLICE_BITMAP

| Code | Meaning |
| --- | --- |
| `NINE_SLICE_BITMAP_INVALID` | What was given to a nine-slice bitmap is not valid. |
| `NINE_SLICE_BITMAP_LEASE_INVALID` | The lease given to a nine-slice bitmap is not valid. |
| `NINE_SLICE_BITMAP_TEXTURE_INVALID` | The texture given to a nine-slice bitmap is not valid. |

### PARAGRAPH

| Code | Meaning |
| --- | --- |
| `PARAGRAPH_BACKEND_CLEANUP_FAILED` | Cleaning up a paragraph failed. Each cause is in cleanupErrors. |
| `PARAGRAPH_BACKEND_TERMINAL` | The backend of a paragraph has ended and cannot be used again. |
| `PARAGRAPH_BACKEND_UNAVAILABLE` | The backend of a paragraph is not available here. |
| `PARAGRAPH_BUILD_REFUSED` | The build of a paragraph was refused. |
| `PARAGRAPH_CANCELLED` | A paragraph was cancelled. |
| `PARAGRAPH_DISPOSED` | A paragraph was disposed and takes nothing more. |
| `PARAGRAPH_ELLIPSIS_DOES_NOT_FIT` | The paragraph is too narrow to hold even its ellipsis. |
| `PARAGRAPH_FACTORY_REQUIRED` | A paragraph is made by its factory function, not with new. |
| `PARAGRAPH_FEATURE_UNSUPPORTED` | The feature is not supported by a paragraph. |
| `PARAGRAPH_GEOMETRY_POINT_INVALID` | The geometry point given to a paragraph is not valid. |
| `PARAGRAPH_GEOMETRY_POSITION_INVALID` | The geometry position given to a paragraph is not valid. |
| `PARAGRAPH_GLYPH_UNRESOLVED` | No registered font has a glyph for a character of the paragraph. Add a font that covers it. |
| `PARAGRAPH_IMAGE_LIMIT` | The image limit of a paragraph was passed. |
| `PARAGRAPH_INVALID` | What was given to a paragraph is not valid. |
| `PARAGRAPH_MINIMUM_LINE_HEIGHT_UNSUPPORTED` | The minimum line height is not supported by a paragraph. |
| `PARAGRAPH_NATIVE_GEOMETRY_INVALID` | The native geometry given to a paragraph is not valid. |
| `PARAGRAPH_NATIVE_GLYPH_INVALID` | The native glyph given to a paragraph is not valid. |
| `PARAGRAPH_NATIVE_RANGE_INVALID` | The native range given to a paragraph is not valid. |
| `PARAGRAPH_NATIVE_STYLE_INVALID` | The native style given to a paragraph is not valid. |
| `PARAGRAPH_PREPARE_CANCELLED` | The prepare of a paragraph was cancelled. |
| `PARAGRAPH_RASTER_REFUSED` | The raster of a paragraph was refused. |
| `PARAGRAPH_READBACK_REFUSED` | The readback of a paragraph was refused. |
| `PARAGRAPH_REQUEST_INVALID` | The request given to a paragraph is not valid. |
| `PARAGRAPH_REQUEST_REQUIRED` | A request is required by a paragraph. |
| `PARAGRAPH_REVISION_EXHAUSTED` | The revision counter of a paragraph ran out. Make a new one. |
| `PARAGRAPH_STALE` | What was given to a paragraph has been replaced by a newer one. |

### PARAGRAPH_CACHE

| Code | Meaning |
| --- | --- |
| `PARAGRAPH_CACHE_ALREADY_CREATED` | An asset manager has one paragraph cache for its whole life, shared by every paragraph, UI leaf and text editor of its Engine: keep the first one made and pass it wherever a cache is asked for. A second would keep the same rasters under another budget. |
| `PARAGRAPH_CACHE_BUDGET` | A limit of the paragraph cache was passed. |
| `PARAGRAPH_CACHE_CLOSED` | The paragraph cache was closed and takes nothing more. |
| `PARAGRAPH_CACHE_INVALID` | What was given to the paragraph cache is not valid. |
| `PARAGRAPH_CACHE_OPTIONS_INVALID` | The options given to the paragraph cache are not valid: one is missing, of the wrong type or out of range. |

### PARAGRAPH_FONT

| Code | Meaning |
| --- | --- |
| `PARAGRAPH_FONT_ALLOCATION_REFUSED` | The allocation of a paragraph font was refused. |
| `PARAGRAPH_FONT_ALLOCATION_TERMINAL` | The allocation of a paragraph font has ended and cannot be used again. |
| `PARAGRAPH_FONT_DECODE_REFUSED` | The decode of a paragraph font was refused. |
| `PARAGRAPH_FONT_NOT_REGISTERED` | The paragraph names a font family that was not registered with its font set. |
| `PARAGRAPH_FONT_PROVIDER_REFUSED` | The provider of a paragraph font was refused. |

### PARAGRAPH_FONT_SET

| Code | Meaning |
| --- | --- |
| `PARAGRAPH_FONT_SET_CANCELLED` | A paragraph font set was cancelled. |
| `PARAGRAPH_FONT_SET_CLOSED` | A paragraph font set was closed and takes nothing more. |
| `PARAGRAPH_FONT_SET_DECODE_REFUSED` | The decode of a paragraph font set was refused. |
| `PARAGRAPH_FONT_SET_IDENTITY_COLLISION` | Two fonts of a paragraph font set have the same identity. |
| `PARAGRAPH_FONT_SET_LIMIT` | A limit of a paragraph font set was passed. |
| `PARAGRAPH_FONT_SET_OPTIONS` | The options given to a paragraph font set are not valid. |
| `PARAGRAPH_FONT_SET_PROVIDER` | The provider given to a paragraph font set is not valid. |
| `PARAGRAPH_FONT_SET_RETIRED` | A paragraph font set has been retired and cannot be used again. |

### PARAGRAPH_PROVIDER

| Code | Meaning |
| --- | --- |
| `PARAGRAPH_PROVIDER_BUSY` | The paragraph provider is still busy with an earlier request. |
| `PARAGRAPH_PROVIDER_DISPOSED` | The paragraph provider was disposed and takes nothing more. |
| `PARAGRAPH_PROVIDER_INVALID` | What was given to the paragraph provider is not valid. |
| `PARAGRAPH_PROVIDER_RESULT_INVALID` | The result given to the paragraph provider is not valid. |

### PARTICLE

| Code | Meaning |
| --- | --- |
| `PARTICLE_CLEANUP_FAILED` | Cleaning up a particle emitter failed. Each cause is in cleanupErrors. |
| `PARTICLE_CLOSED` | A particle emitter was closed and takes nothing more. |
| `PARTICLE_OPTIONS_INVALID` | The options given to a particle emitter are not valid: one is missing, of the wrong type or out of range. |

### PHYSICS

| Code | Meaning |
| --- | --- |
| `PHYSICS_BODY_INVALID` | The body given to the physics world is not valid. |
| `PHYSICS_BODY_LIMIT` | The body limit of the physics world was passed. |
| `PHYSICS_CLOSED` | The physics world was closed and takes nothing more. |
| `PHYSICS_JOINT_INVALID` | The joint given to the physics world is not valid. |
| `PHYSICS_LISTENER_FAILED` | A listener the application gave to the physics world threw. What it threw is in cause. |
| `PHYSICS_OPTIONS_INVALID` | The options given to the physics world are not valid: one is missing, of the wrong type or out of range. |
| `PHYSICS_STEP_REENTRANT` | The step of the physics world was called again from inside one of its own callbacks. |

### PLAY

| Code | Meaning |
| --- | --- |
| `PLAY_OPTIONS_INVALID` | The options given to play are not valid: one is missing, of the wrong type or out of range. |
| `PLAY_SFX_UNKNOWN` | No such sfx is known to play. |

### POINTER_INPUT

| Code | Meaning |
| --- | --- |
| `POINTER_INPUT_CALLBACK_FAILED` | A callback the application gave to pointer input threw. What it threw is in cause. |
| `POINTER_INPUT_CAPACITY` | Pointer input holds as much as it takes. |
| `POINTER_INPUT_CLEANUP_FAILED` | Cleaning up pointer input failed. Each cause is in cleanupErrors. |
| `POINTER_INPUT_CLOSED` | Pointer input was closed and takes nothing more. |
| `POINTER_INPUT_DUPLICATE` | The same thing was given twice to pointer input. |
| `POINTER_INPUT_EVENT_INVALID` | The event given to pointer input is not valid. |
| `POINTER_INPUT_EXHAUSTED` | A counter of pointer input ran out. Make a new one. |
| `POINTER_INPUT_HOST_FAILED` | The host of pointer input failed. The cause is in cause. |
| `POINTER_INPUT_NATIVE_FAILED` | The native of pointer input failed. The cause is in cause. |
| `POINTER_INPUT_OPTIONS` | The options given to pointer input are not valid. |
| `POINTER_INPUT_OPTIONS_INVALID` | The options given to pointer input are not valid: one is missing, of the wrong type or out of range. |
| `POINTER_INPUT_REASON` | The reason given to pointer input for a cancel is not one it knows. |
| `POINTER_INPUT_REENTRANT` | Pointer input was called again from inside one of its own callbacks. |
| `POINTER_INPUT_SAMPLE` | The sample given to pointer input is not a pointer sample. |
| `POINTER_INPUT_SETUP_FAILED` | Setting up pointer input failed. The cause is in cause. |
| `POINTER_INPUT_SURFACE_BUSY` | The surface of pointer input is still busy with an earlier request. |
| `POINTER_INPUT_SURFACE_INVALID` | The surface given to pointer input is not valid. |
| `POINTER_INPUT_VIEWPORT` | The viewport revision given to pointer input is not a whole number above the last one. |

### QUALITY_VARIANT

| Code | Meaning |
| --- | --- |
| `QUALITY_VARIANT_INVALID` | What was given to the quality variants is not valid. |
| `QUALITY_VARIANT_MISSING` | Something the quality variants needs is missing. |

### RANDOM

| Code | Meaning |
| --- | --- |
| `RANDOM_RANGE_INVALID` | The range given to the random number generator is not valid. |
| `RANDOM_SEED_INVALID` | The seed given to the random number generator is not valid. |

### SAVE_STORE

| Code | Meaning |
| --- | --- |
| `SAVE_STORE_OPTIONS_INVALID` | The options given to the save store are not valid: one is missing, of the wrong type or out of range. |

### SCOPE

| Code | Meaning |
| --- | --- |
| `SCOPE_CLEANUP_FAILED` | Cleaning up a scope failed. Each cause is in cleanupErrors. |
| `SCOPE_CLOSED` | The scope was disposed, and everything it owned with it. Create a new scope. |
| `SCOPE_FACTORY_REQUIRED` | A scope is made by its factory function, not with new. |
| `SCOPE_LATE_CLEANUP_FAILED` | Cleaning up a scope failed. Each cause is in cleanupErrors. |
| `SCOPE_REGISTRATION_ACTIVE` | The registration of a scope is still active. |

### SEQ

| Code | Meaning |
| --- | --- |
| `SEQ_ATLAS_MISMATCH` | The atlas given to a sequence does not match. |
| `SEQ_BINDING_CHANGED` | The binding of a sequence changed while a request was on its way. |
| `SEQ_BUDGET` | A limit of a sequence was passed. |
| `SEQ_CLIP_INVALID` | The clip given to a sequence is not valid. |
| `SEQ_INPUT_INVALID` | The input given to a sequence is not valid. |
| `SEQ_READ_FAILED` | The read of a sequence failed. The cause is in cause. |
| `SEQ_REGION_INVALID` | The region given to a sequence is not valid. |
| `SEQ_TIME_INVALID` | The time given to a sequence is not valid. |

### SEQUENCE_RESET

| Code | Meaning |
| --- | --- |
| `SEQUENCE_RESET_CANCELLED` | A sequence reset slot was cancelled. |
| `SEQUENCE_RESET_CLEANUP_FAILED` | Cleaning up a sequence reset slot failed. Each cause is in cleanupErrors. |
| `SEQUENCE_RESET_CONTROLLER_CHANGED` | The controller of a sequence reset slot changed while a request was on its way. |
| `SEQUENCE_RESET_DISPOSED` | A sequence reset slot was disposed and takes nothing more. |
| `SEQUENCE_RESET_INITIAL_INVALID` | The initial given to a sequence reset slot is not valid. |
| `SEQUENCE_RESET_LOADER_INVALID` | The loader given to a sequence reset slot is not valid. |
| `SEQUENCE_RESET_NOT_PREPARED` | The sequence reset slot has not been prepared. |
| `SEQUENCE_RESET_NOT_READY` | A sequence reset slot is not ready yet. |
| `SEQUENCE_RESET_OPTIONS_INVALID` | The options given to a sequence reset slot are not valid: one is missing, of the wrong type or out of range. |
| `SEQUENCE_RESET_POSTCOMMIT_FAILED` | The postcommit of a sequence reset slot failed. The cause is in cause. |
| `SEQUENCE_RESET_PRESERVE_STATE` | A sequence is reset keeping its place only while it is running or paused, with no command waiting. |
| `SEQUENCE_RESET_PRESERVE_TIMELINE` | The timeline cannot be kept through this reset of a sequence. |
| `SEQUENCE_RESET_REENTRANT` | A sequence reset slot was called again from inside one of its own callbacks. |
| `SEQUENCE_RESET_RESOURCE_MISMATCH` | The resource given to a sequence reset slot does not match. |
| `SEQUENCE_RESET_RETIRED` | A sequence reset slot has been retired and cannot be used again. |
| `SEQUENCE_RESET_TARGET_CHANGED` | The target of a sequence reset slot changed while a request was on its way. |
| `SEQUENCE_RESET_TARGET_CLAIMED` | The target of a sequence reset slot is already held by another. |
| `SEQUENCE_RESET_TARGET_INVALID` | The target given to a sequence reset slot is not valid. |

### SEQ_PLAYBACK

| Code | Meaning |
| --- | --- |
| `SEQ_PLAYBACK_ALREADY_STARTED` | A sequence playback was already started. |
| `SEQ_PLAYBACK_CREATION_REENTRANT` | The creation of a sequence playback was called again from inside one of its own callbacks. |
| `SEQ_PLAYBACK_INVALID` | What was given to a sequence playback is not valid. |
| `SEQ_PLAYBACK_LIMIT` | A limit of a sequence playback was passed. |
| `SEQ_PLAYBACK_NOT_STARTED` | A sequence playback has not been started. |
| `SEQ_PLAYBACK_OPTIONS_INVALID` | The options given to a sequence playback are not valid: one is missing, of the wrong type or out of range. |
| `SEQ_PLAYBACK_REENTRANT` | A sequence playback was called again from inside one of its own callbacks. |
| `SEQ_PLAYBACK_SCOPE_INVALID` | The scope given to a sequence playback is not an open scope of this Engine. |
| `SEQ_PLAYBACK_TARGET_BUSY` | The target of a sequence playback is still busy with an earlier request. |
| `SEQ_PLAYBACK_TERMINAL` | A sequence playback has ended and cannot be used again. |
| `SEQ_PLAYBACK_TIME_RANGE` | The time is out of range for a sequence playback. |

### SEQ_PLAYER

| Code | Meaning |
| --- | --- |
| `SEQ_PLAYER_DISPOSED` | A sequence player was disposed and takes nothing more. |
| `SEQ_PLAYER_INVALID` | What was given to a sequence player is not valid. |

### SHARED_MATERIAL

| Code | Meaning |
| --- | --- |
| `SHARED_MATERIAL_UNSUPPORTED` | The material cannot be used on this object: a mesh made for a region samples by region, not by page. |

### SPINE

| Code | Meaning |
| --- | --- |
| `SPINE_GROUP_RELEASE_FAILED` | The group release of Spine failed. The cause is in cause. |
| `SPINE_LOADER_RECEIVER` | A method of the Spine loader was called apart from the loader. Call it on the loader: loader.load(...). |
| `SPINE_LOADER_RELEASE_FAILED` | The loader release of Spine failed. The cause is in cause. |
| `SPINE_METADATA_LIMIT` | The metadata limit of Spine was passed. |
| `SPINE_SETUP_FAILED` | Setting up Spine failed. The cause is in cause. |
| `SPINE_SETUP_RELEASE_FAILED` | The setup release of Spine failed. The cause is in cause. |
| `SPINE_SOURCE_RELEASE_FAILED` | The source release of Spine failed. The cause is in cause. |

### SPINE_DISPLAY

| Code | Meaning |
| --- | --- |
| `SPINE_DISPLAY_CLEANUP_FAILED` | Cleaning up a Spine display failed. Each cause is in cleanupErrors. |
| `SPINE_DISPLAY_COMMAND_LIMIT` | The command limit of a Spine display was passed. |
| `SPINE_DISPLAY_GEOMETRY_INVALID` | The geometry given to a Spine display is not valid. |
| `SPINE_DISPLAY_GEOMETRY_LIMIT` | The geometry limit of a Spine display was passed. |
| `SPINE_DISPLAY_INSTANCE_INVALID` | The instance given to a Spine display is not valid. |
| `SPINE_DISPLAY_PAGE_OR_BLEND_INVALID` | The page or blend given to a Spine display is not valid. |
| `SPINE_DISPLAY_SAMPLING_UNSUPPORTED` | The sampling is not supported by a Spine display. |

### SPINE_INSTANCE

| Code | Meaning |
| --- | --- |
| `SPINE_INSTANCE_ADVANCE_FAILED` | The advance of a Spine instance failed. The cause is in cause. |
| `SPINE_INSTANCE_ANIMATION_INVALID` | The animation given to a Spine instance is not valid. |
| `SPINE_INSTANCE_ASSET_INVALID` | The asset given to a Spine instance is not valid. |
| `SPINE_INSTANCE_COMMAND_LIMIT` | The command limit of a Spine instance was passed. |
| `SPINE_INSTANCE_DISPLAY_ACTIVE` | The display of a Spine instance is still active. |
| `SPINE_INSTANCE_DISPOSED` | A Spine instance was disposed and takes nothing more. |
| `SPINE_INSTANCE_ENTRY_LIMIT` | The entry limit of a Spine instance was passed. |
| `SPINE_INSTANCE_FAULTED` | The Spine instance failed earlier and can no longer be used. |
| `SPINE_INSTANCE_LISTENER_FAILED` | A listener the application gave to a Spine instance threw. What it threw is in cause. |
| `SPINE_INSTANCE_NONFINITE_POSE` | A pose of the Spine instance has a number that is not finite. |
| `SPINE_INSTANCE_OPTIONS_INVALID` | The options given to a Spine instance are not valid: one is missing, of the wrong type or out of range. |
| `SPINE_INSTANCE_OUTPUT_INVALID` | The output given to a Spine instance is not valid. |
| `SPINE_INSTANCE_PAUSED_INVALID` | The paused given to a Spine instance is not valid. |
| `SPINE_INSTANCE_PLAYBACK_STEP_LIMIT` | The playback step limit of a Spine instance was passed. |
| `SPINE_INSTANCE_POSTCOMMIT_FAILED` | The postcommit of a Spine instance failed. The cause is in cause. |
| `SPINE_INSTANCE_RATE_INVALID` | The rate given to a Spine instance is not valid. |
| `SPINE_INSTANCE_REENTRANT` | A Spine instance was called again from inside one of its own callbacks. |
| `SPINE_INSTANCE_RENDER_FAILED` | The render of a Spine instance failed. The cause is in cause. |
| `SPINE_INSTANCE_RESET_FAILED` | The reset of a Spine instance failed. The cause is in cause. |
| `SPINE_INSTANCE_RESET_NOT_PRISTINE` | The Spine instance cannot be reset this way: it is no longer as it was when it was made. |
| `SPINE_INSTANCE_SEEK_ACTIVE` | The seek of a Spine instance is still active. |
| `SPINE_INSTANCE_SEEK_BACKWARD_EVENTS` | A seek backwards would pass events of the Spine instance, which are not played backwards. |
| `SPINE_INSTANCE_SEEK_EVENT_LIMIT` | The seek event limit of a Spine instance was passed. |
| `SPINE_INSTANCE_SEEK_FAILED` | The seek of a Spine instance failed. The cause is in cause. |
| `SPINE_INSTANCE_SEEK_HISTORY` | The Spine instance cannot seek that far back: its history does not reach there. |
| `SPINE_INSTANCE_SEEK_INVALID` | The seek given to a Spine instance is not valid. |
| `SPINE_INSTANCE_SEEK_LIMIT` | The seek limit of a Spine instance was passed. |
| `SPINE_INSTANCE_SEEK_NOT_READY` | The seek of a Spine instance is not ready yet. |
| `SPINE_INSTANCE_SKINS_INVALID` | The skins given to a Spine instance is not valid. |
| `SPINE_INSTANCE_SKIN_INVALID` | The skin given to a Spine instance is not valid. |
| `SPINE_INSTANCE_STEP_LIMIT` | The step limit of a Spine instance was passed. |
| `SPINE_INSTANCE_TICK_INVALID` | The tick given to a Spine instance is not valid. |
| `SPINE_INSTANCE_TRACK_INVALID` | The track given to a Spine instance is not valid. |
| `SPINE_INSTANCE_TRANSFORM_INVALID` | The transform given to a Spine instance is not valid. |

### SPINE_RESET

| Code | Meaning |
| --- | --- |
| `SPINE_RESET_CANCELLED` | A Spine reset slot was cancelled. |
| `SPINE_RESET_CLEANUP_FAILED` | Cleaning up a Spine reset slot failed. Each cause is in cleanupErrors. |
| `SPINE_RESET_DISPOSED` | A Spine reset slot was disposed and takes nothing more. |
| `SPINE_RESET_INITIAL_INVALID` | The initial given to a Spine reset slot is not valid. |
| `SPINE_RESET_LOADER_INVALID` | The loader given to a Spine reset slot is not valid. |
| `SPINE_RESET_NOT_PREPARED` | The Spine reset slot has not been prepared. |
| `SPINE_RESET_NOT_READY` | A Spine reset slot is not ready yet. |
| `SPINE_RESET_OPTIONS_INVALID` | The options given to a Spine reset slot are not valid: one is missing, of the wrong type or out of range. |
| `SPINE_RESET_POSTCOMMIT_FAILED` | The postcommit of a Spine reset slot failed. The cause is in cause. |
| `SPINE_RESET_PRESERVE_ANIMATION` | The animation cannot be kept through this reset of a Spine display. |
| `SPINE_RESET_PRESERVE_SKIN` | The skin cannot be kept through this reset of a Spine display. |
| `SPINE_RESET_PRESERVE_STATE` | The state cannot be kept through this reset of a Spine display. |
| `SPINE_RESET_REENTRANT` | A Spine reset slot was called again from inside one of its own callbacks. |
| `SPINE_RESET_RETIRED` | A Spine reset slot has been retired and cannot be used again. |
| `SPINE_RESET_SCOPE_CLOSED` | The scope of a Spine reset slot was closed and takes nothing more. |
| `SPINE_RESET_TARGET_CHANGED` | The target of a Spine reset slot changed while a request was on its way. |
| `SPINE_RESET_TARGET_CLAIMED` | The target of a Spine reset slot is already held by another. |
| `SPINE_RESET_TARGET_INVALID` | The target given to a Spine reset slot is not valid. |

### SPRITE_SHEET

| Code | Meaning |
| --- | --- |
| `SPRITE_SHEET_ATLAS_INVALID` | The atlas given to a sprite sheet is not valid. |
| `SPRITE_SHEET_BITMAP_FAILED` | The bitmap of a sprite sheet failed. The cause is in cause. |
| `SPRITE_SHEET_DISPOSED` | A sprite sheet was disposed and takes nothing more. |
| `SPRITE_SHEET_FRAME_UNKNOWN` | No such frame is known to a sprite sheet. |
| `SPRITE_SHEET_INPUT_INVALID` | The input given to a sprite sheet is not valid. |
| `SPRITE_SHEET_INVALID` | What was given to a sprite sheet is not valid. |
| `SPRITE_SHEET_LEASE_INVALID` | The lease given to a sprite sheet is not valid. |
| `SPRITE_SHEET_LIMIT` | A limit of a sprite sheet was passed. |
| `SPRITE_SHEET_NAME_INVALID` | The name given to a sprite sheet is not valid. |
| `SPRITE_SHEET_READ_FAILED` | The read of a sprite sheet failed. The cause is in cause. |
| `SPRITE_SHEET_REENTRANT` | A sprite sheet was called again from inside one of its own callbacks. |
| `SPRITE_SHEET_REGION_INVALID` | The region given to a sprite sheet is not valid. |

### STAGE

| Code | Meaning |
| --- | --- |
| `STAGE_FACTORY_REQUIRED` | The stage is made by its factory function, not with new. |
| `STAGE_ROOT_ONLY` | The stage is the root of the tree: it cannot be added to a container or disposed by itself. |

### TEXT

| Code | Meaning |
| --- | --- |
| `TEXT_ACQUIRE_CANCELLED` | The acquire of text was cancelled. |
| `TEXT_ASSETS_INVALID` | The assets given to text is not valid. |
| `TEXT_COUNTER_EXHAUSTED` | The counter counter of text ran out. Make a new one. |
| `TEXT_EDIT_ACTIVE` | The edit of text is still active. |
| `TEXT_EDIT_CLOSED` | The edit of text was closed and takes nothing more. |
| `TEXT_EDIT_COMPOSING` | The text is being composed with an input method, and this edit cannot be made until that ends. |
| `TEXT_EDIT_OPTIONS` | The options given to text are not valid. |
| `TEXT_EDIT_REVISION_EXHAUSTED` | The edit revision counter of text ran out. Make a new one. |
| `TEXT_EDIT_SELECTION` | The selection given to a text edit is not valid. |
| `TEXT_EDIT_STALE` | The edit given to text has been replaced by a newer one. |
| `TEXT_EDIT_VALUE` | The value given to a text edit is not valid. |
| `TEXT_MEASURE_FAILED` | The measure of text failed. The cause is in cause. |
| `TEXT_PROVIDER_INVALID` | The provider given to text is not valid. |
| `TEXT_RASTER_FAILED` | The raster of text failed. The cause is in cause. |
| `TEXT_RASTER_RESULT_INVALID` | The raster result given to text is not valid. |
| `TEXT_REQUEST_INVALID` | The request given to text is not valid. |
| `TEXT_REQUEST_LIMIT` | The request limit of text was passed. |
| `TEXT_RESOURCE_FAILED` | The resource of text failed. The cause is in cause. |
| `TEXT_SIGNAL_FAILED` | The signal of text failed. The cause is in cause. |
| `TEXT_TABLE_INVALID` | The table given to text is not valid. |

### TEXTURE

| Code | Meaning |
| --- | --- |
| `TEXTURE_DISPOSED` | The texture was disposed and can no longer be shown. |
| `TEXTURE_FACTORY_REQUIRED` | A texture is made by its factory function, not with new. |
| `TEXTURE_IMAGE_INVALID` | The image given to a texture is not valid. |
| `TEXTURE_INVALID` | What was given to a texture is not valid. |
| `TEXTURE_REGION_INVALID` | The region given to a texture is not valid. |

### TEXTURE_VIEW

| Code | Meaning |
| --- | --- |
| `TEXTURE_VIEW_REGION_IMMUTABLE` | The region of a texture view is fixed when it is made. Make another view. |
| `TEXTURE_VIEW_REGION_INVALID` | The region given to a texture view is not valid. |

### TEXT_CACHE

| Code | Meaning |
| --- | --- |
| `TEXT_CACHE_ALREADY_CREATED` | An asset manager has one text cache for its whole life, shared by every text field and label of its Engine: keep the first one made and pass it wherever a cache is asked for. A browser game makes it for its labels. |
| `TEXT_CACHE_BUDGET` | A limit of the text cache was passed. |
| `TEXT_CACHE_CLEANUP_FAILED` | Cleaning up the text cache failed. Each cause is in cleanupErrors. |
| `TEXT_CACHE_CLOSED` | The text cache was closed and takes nothing more. |
| `TEXT_CACHE_INVALID` | What was given to the text cache is not valid. |
| `TEXT_CACHE_NAMESPACE_FAILED` | The namespace of the text cache failed. The cause is in cause. |
| `TEXT_CACHE_OPTIONS_INVALID` | The options given to the text cache are not valid: one is missing, of the wrong type or out of range. |
| `TEXT_CACHE_REENTRANT` | The text cache was called again from inside one of its own callbacks. |

### TEXT_FIELD

| Code | Meaning |
| --- | --- |
| `TEXT_FIELD_BUSY` | A text field is still busy with an earlier request. |
| `TEXT_FIELD_CLEANUP_FAILED` | Cleaning up a text field failed. Each cause is in cleanupErrors. |
| `TEXT_FIELD_DISPOSED` | A text field was disposed and takes nothing more. |
| `TEXT_FIELD_INVALID` | What was given to a text field is not valid. |
| `TEXT_FIELD_REVISION_LIMIT` | The revision limit of a text field was passed. |
| `TEXT_FIELD_SUPERSEDED` | A newer request to a text field replaced this one. |
| `TEXT_FIELD_UNPREPARED` | A text field has not been prepared yet. |

### TEXT_PLAN

| Code | Meaning |
| --- | --- |
| `TEXT_PLAN_ALREADY_CREATED` | A text plan was already created. |
| `TEXT_PLAN_INVALID` | What was given to a text plan is not valid. |
| `TEXT_PLAN_RELEASE_FAILED` | The release of a text plan failed. The cause is in cause. |
| `TEXT_PLAN_SCOPE_CLOSED` | The scope of a text plan was closed and takes nothing more. |

### TILEMAP

| Code | Meaning |
| --- | --- |
| `TILEMAP_CELL_INVALID` | The cell given to a tile map is not valid. |
| `TILEMAP_CLEANUP_FAILED` | Cleaning up a tile map failed. Each cause is in cleanupErrors. |
| `TILEMAP_CLOSED` | A tile map was closed and takes nothing more. |
| `TILEMAP_COMPRESSION_UNSUPPORTED` | The compression is not supported by a tile map. |
| `TILEMAP_DATA_INVALID` | The data given to a tile map is not valid. |
| `TILEMAP_DRAW_FAILED` | The draw of a tile map failed. The cause is in cause. |
| `TILEMAP_LAYER_UNKNOWN` | No such layer is known to a tile map. |
| `TILEMAP_LAYER_UNSUPPORTED` | The layer is not supported by a tile map. |
| `TILEMAP_OPTIONS_INVALID` | The options given to a tile map are not valid: one is missing, of the wrong type or out of range. |
| `TILEMAP_ORIENTATION_UNSUPPORTED` | The orientation is not supported by a tile map. |
| `TILEMAP_TEXTURE_MISSING` | A texture that a tile map needs is missing. |
| `TILEMAP_TILESET_MISSING` | A tileset that a tile map needs is missing. |
| `TILEMAP_TILESET_UNSUPPORTED` | The tileset is not supported by a tile map. |
| `TILEMAP_TILE_INVALID` | The tile given to a tile map is not valid. |

### TIMER

| Code | Meaning |
| --- | --- |
| `TIMER_OPTIONS_INVALID` | The options given to a timer are not valid: one is missing, of the wrong type or out of range. |

### TWEEN

| Code | Meaning |
| --- | --- |
| `TWEEN_ALREADY_STARTED` | A tween was already started. |
| `TWEEN_CALLBACK_RETURN_INVALID` | The callback return given to a tween is not valid. |
| `TWEEN_COMPLETE_FAILED` | The complete of a tween failed. The cause is in cause. |
| `TWEEN_INVALID` | What was given to a tween is not valid. |
| `TWEEN_NOT_STARTED` | A tween has not been started. |
| `TWEEN_OPTIONS_INVALID` | The options of a tween are not valid: from and to are finite numbers, durationSeconds is above zero, and onUpdate is a function that returns nothing. |
| `TWEEN_RANGE_INVALID` | The range given to a tween is not valid. |
| `TWEEN_REENTRANT` | A tween was called again from inside one of its own callbacks. |
| `TWEEN_SCOPE_INVALID` | The scope given to a tween is not an open scope of this Engine. |
| `TWEEN_TERMINAL` | A tween has ended and cannot be used again. |
| `TWEEN_TIME_RANGE` | The time is out of range for a tween. |
| `TWEEN_UPDATE_FAILED` | The update of a tween failed. The cause is in cause. |

### UI

| Code | Meaning |
| --- | --- |
| `UI_BUSY` | The UI is still busy with an earlier request. |
| `UI_CAP_EXCEEDED` | A limit of the UI was passed. |
| `UI_CLEANUP_FAILED` | Cleaning up the UI failed. Each cause is in cleanupErrors. |
| `UI_CLOSED` | The UI was closed and takes nothing more. |
| `UI_CONTENT_INVALID` | What a UI leaf or row gave as its content cannot be shown there. The leaf or row, and the reason, are in cause. |
| `UI_DUPLICATE_ID` | Two parts of the UI were given the same id. |
| `UI_DUPLICATE_KEY` | Two rows of a list were given the same key. |
| `UI_EDITOR_FONTS_CANCELLED` | The editor fonts of the UI was cancelled. |
| `UI_EDITOR_FONTS_CLOSED` | The editor fonts of the UI was closed and takes nothing more. |
| `UI_EDITOR_FONTS_DECODE` | A font of the UI text editor could not be decoded. |
| `UI_EDITOR_FONTS_FAMILY` | A font family given to the UI text editor is not valid. |
| `UI_EDITOR_FONTS_INVALID` | The editor fonts given to the UI is not valid. |
| `UI_EDITOR_FONTS_LIMIT` | The editor fonts limit of the UI was passed. |
| `UI_EDITOR_FONTS_OPTIONS` | The options given to the UI are not valid. |
| `UI_EDITOR_FONTS_PROFILE` | A font given to the UI text editor is not of a profile it reads. |
| `UI_EDITOR_FONTS_TIMEOUT` | The editor fonts of the UI took too long. |
| `UI_EDITOR_FONTS_UNSUPPORTED` | The editor fonts is not supported by the UI. |
| `UI_ENGINE_INVALID` | The engine given to the UI is not valid. |
| `UI_INPUT_BUSY` | The input of the UI is still busy with an earlier request. |
| `UI_INPUT_CLOSED` | The input of the UI was closed and takes nothing more. |
| `UI_INPUT_INVALID` | The input given to the UI is not valid. |
| `UI_INVALID` | What was given to the UI is not valid. |
| `UI_LAYOUT_CYCLE` | The layout of the UI depends on itself: a size is given in terms of a size it decides. |
| `UI_LAYOUT_UNSTABLE` | The layout of the UI did not settle in eight rounds: a size keeps changing something it depends on. |
| `UI_LIMIT` | A limit of the UI was passed. |
| `UI_LIST_NOT_FOUND` | No list of the UI has this id. |
| `UI_MANAGED_GEOMETRY` | The position and size of this object are managed by the UI. Change its layout, not its x, y or scale. |
| `UI_NOT_READY` | The UI is not ready yet. |
| `UI_OWNER_INVALID` | The owner given to the UI is not valid. |
| `UI_PENDING_LIMIT` | The pending limit of the UI was passed. |
| `UI_PREPARATION_INVALID` | The preparation given to the UI is not valid. |
| `UI_PREPARE_FAILED` | The prepare of the UI failed. The cause is in cause. |
| `UI_REVISION_EXHAUSTED` | The revision counter of the UI ran out. Make a new one. |
| `UI_ROW_NOT_REALIZED` | The row is not on screen now, so there is nothing of it to act on. Scroll it into view first. |
| `UI_ROW_RETAINED` | A row that is in use was removed from its list or changed under it. |
| `UI_SCOPE_INVALID` | The scope given to the UI is not an open scope of this Engine. |
| `UI_SOURCE_INVALID` | The source given to the UI is not valid. |
| `UI_SOURCE_REVISION` | The rows of a list changed while the UI was reading them under one revision. |
| `UI_STAGE_TRANSFORM_UNSUPPORTED` | The stage transform is not supported by the UI. |
| `UI_STALE` | What was given to the UI has been replaced by a newer one. |
| `UI_STALE_PREPARATION` | The prepared UI no longer matches the UI it was prepared for. Prepare it again. |
| `UI_TREE_SHAPE` | A new description of the UI has other nodes, or a node of another kind, than the tree it updates. |
| `UI_UNKNOWN_KEY` | No row of the list has this key. |
| `UI_UNKNOWN_LIST` | No list of the UI has this id. |
| `UI_VALUE_INVALID` | The value given to the UI is not valid. |

### UI_BADGE

| Code | Meaning |
| --- | --- |
| `UI_BADGE_PATH_INVALID` | A red dot was given a path that is not names joined by /, or a count that is not a number or true or false. |

### UI_COMPACT

| Code | Meaning |
| --- | --- |
| `UI_COMPACT_INVALID` | A short number was asked of what is not a number, or with a locale other than 'en' or 'zh' or digits outside 0 to 3. |

### UI_CONTROL

| Code | Meaning |
| --- | --- |
| `UI_CONTROL_CLOSED` | A UI control was closed and takes nothing more. |
| `UI_CONTROL_DIRECTION` | The direction given to a UI control is not two finite numbers. |
| `UI_CONTROL_OPTIONS` | The options given to a UI control are not valid. |
| `UI_CONTROL_RADIUS` | The radius given to a UI control is not a finite number above zero. |
| `UI_CONTROL_UNKNOWN_ITEM` | The control has no item of this id. |

### UI_KEYBOARD

| Code | Meaning |
| --- | --- |
| `UI_KEYBOARD_CLOSED` | UI keyboard navigation was closed and takes nothing more. |
| `UI_KEYBOARD_ID_INVALID` | The id given to UI keyboard navigation is not valid. |
| `UI_KEYBOARD_INVALID` | What was given to UI keyboard navigation is not valid. |
| `UI_KEYBOARD_STOP_INVALID` | The stop given to UI keyboard navigation is not valid. |
| `UI_KEYBOARD_SYNC_FAILED` | The sync of UI keyboard navigation failed. The cause is in cause. |
| `UI_KEYBOARD_UNAVAILABLE` | UI keyboard navigation is not available here. |

### UI_LAYER

| Code | Meaning |
| --- | --- |
| `UI_LAYER_ANCHOR_INVALID` | The anchor given to a UI layer is not valid. |
| `UI_LAYER_BASE` | The base layer of a UI is always open. It is not opened or closed by name. |
| `UI_LAYER_CLEANUP_FAILED` | Cleaning up a UI layer failed. Each cause is in cleanupErrors. |
| `UI_LAYER_CLOSED` | A UI layer was closed and takes nothing more. |
| `UI_LAYER_ID_DUPLICATE` | The same id was given twice to a UI layer. |
| `UI_LAYER_ID_INVALID` | The id given to a UI layer is not valid. |
| `UI_LAYER_INPUT_MISMATCH` | The input given to a UI layer does not match. |
| `UI_LAYER_MANAGER_OWNED` | This Engine already has a UI layer manager. An Engine has one. |
| `UI_LAYER_ROOT_OWNED` | This UI root already belongs to a layer. |
| `UI_LAYER_UNKNOWN` | What was named is not known to a UI layer. |
| `UI_LAYER_VIEWPORT_TOO_SMALL` | The viewport given to a UI layer is too small. |

### UI_REQUEST

| Code | Meaning |
| --- | --- |
| `UI_REQUEST_INVALID` | A request sends with a function. The reason is in cause. |

### UI_SCREEN

| Code | Meaning |
| --- | --- |
| `UI_SCREEN_OPTIONS_INVALID` | The options given to the screen fit are not valid: one is missing, of the wrong type or out of range. |

### UI_SCREENS

| Code | Meaning |
| --- | --- |
| `UI_SCREENS_ALREADY_OPEN` | This screen is open, or opening, with other parameters. Close it first, or open it with the same parameters. |
| `UI_SCREENS_CLOSED` | The screen stack was closed and takes nothing more. |
| `UI_SCREENS_DEFINITION_INVALID` | The definition given to the screen stack is not valid. |
| `UI_SCREENS_FULL` | The screen stack holds as many screens as it was made for. Close one first, or give maxScreens. |
| `UI_SCREENS_OPTIONS_INVALID` | The options given to the screen stack are not valid: one is missing, of the wrong type or out of range. |

### UI_SEMANTICS

| Code | Meaning |
| --- | --- |
| `UI_SEMANTICS_CAPACITY` | UI semantics holds as much as it takes. |
| `UI_SEMANTICS_CLEANUP_FAILED` | Cleaning up UI semantics failed. Each cause is in cleanupErrors. |
| `UI_SEMANTICS_CLOSED` | UI semantics was closed and takes nothing more. |
| `UI_SEMANTICS_DESCRIBE_FAILED` | The describe of UI semantics failed. The cause is in cause. |
| `UI_SEMANTICS_DESCRIPTION` | A field of a UI semantics entry is not valid. The entry and the field are in cause. |
| `UI_SEMANTICS_DUPLICATE` | The same thing was given twice to UI semantics. |
| `UI_SEMANTICS_EXHAUSTED` | A counter of UI semantics ran out. Make a new one. |
| `UI_SEMANTICS_FOCUS` | More than one entry of UI semantics is focused, or the focused one is inert. The entry is in cause. |
| `UI_SEMANTICS_LISTENER_FAILED` | A listener the application gave to UI semantics threw. What it threw is in cause. |
| `UI_SEMANTICS_OPTIONS` | The options given to UI semantics are not valid. |
| `UI_SEMANTICS_PARENT` | An entry of UI semantics is not inside the kind of entry its role needs. |
| `UI_SEMANTICS_REENTRANT` | UI semantics was called again from inside one of its own callbacks. |
| `UI_SEMANTICS_RELATION` | An entry of UI semantics names another entry that is not in the tree. The entry is in cause. |
| `UI_SEMANTICS_REVISION` | The revision given to UI semantics is older than the one it has. |
| `UI_SEMANTICS_SURFACE_BUSY` | The surface of UI semantics is still busy with an earlier request. |
| `UI_SEMANTICS_SURFACE_INVALID` | The surface given to UI semantics is not valid. |

### UI_TESTER

| Code | Meaning |
| --- | --- |
| `UI_TESTER_AMBIGUOUS` | More than one thing on the screen has that name. Add a role, what it is in, or #n. What the screen holds is in cause. |
| `UI_TESTER_NOT_FOUND` | Nothing on the screen has that name. What the screen holds is in cause. |
| `UI_TESTER_OPTIONS_INVALID` | The options given to the UI tester are not valid: one is missing, of the wrong type or out of range. |
| `UI_TESTER_QUERY_INVALID` | The query given to the UI tester is not valid. |
| `UI_TESTER_REFUSED` | The control was found but the action was refused: it is disabled, behind a dialog or has no such action. |

### UI_TEXT_EDITOR

| Code | Meaning |
| --- | --- |
| `UI_TEXT_EDITOR_CLOSED` | The UI text editor was closed and takes nothing more. |
| `UI_TEXT_EDITOR_COMPOSING` | The UI text editor is composing text with an input method. Wait for that to end. |
| `UI_TEXT_EDITOR_HOST_IN_USE` | The host given to the UI text editor is already in use. |
| `UI_TEXT_EDITOR_INVALID` | What was given to the UI text editor is not valid. |
| `UI_TEXT_EDITOR_LIMIT` | A limit of the UI text editor was passed. |
| `UI_TEXT_EDITOR_OPTIONS` | The options given to the UI text editor are not valid. |
| `UI_TEXT_EDITOR_PLACEMENT_UNSUPPORTED` | The placement is not supported by the UI text editor. |
| `UI_TEXT_EDITOR_REVISION_EXHAUSTED` | The revision counter of the UI text editor ran out. Make a new one. |
| `UI_TEXT_EDITOR_ROOT_CLOSED` | The root of the UI text editor was closed and takes nothing more. |
| `UI_TEXT_EDITOR_ROOT_INVALID` | The root given to the UI text editor is not valid. |
| `UI_TEXT_EDITOR_STALE` | What was given to the UI text editor has been replaced by a newer one. |
| `UI_TEXT_EDITOR_STYLE` | The style given to the UI text editor is not valid. |

### UI_THEME

| Code | Meaning |
| --- | --- |
| `UI_THEME_INVALID` | What was given to a UI theme is not valid. |
| `UI_THEME_LIMIT` | A limit of a UI theme was passed. |
| `UI_THEME_METRICS_CHANGED` | The metrics of a UI theme changed while a request was on its way. |
| `UI_THEME_TOKEN_MISSING` | A token that a UI theme needs is missing. |

### UI_VIEW

| Code | Meaning |
| --- | --- |
| `UI_VIEW_BINDING_INVALID` | A binding gives what its part cannot take, or is not a function. Which, and why, are in cause. |
| `UI_VIEW_BINDING_UNKNOWN` | A binding names a part the view does not have. The names it has are in cause. |
| `UI_VIEW_FRAME_INVALID` | The frame given to a UI view is not valid. |
| `UI_VIEW_INVALID` | A view description is not valid. Which part, and what is wrong with it, are in cause. |
| `UI_VIEW_NAME_UNKNOWN` | The view has no part of that name. The names it has are in cause. |
| `UI_VIEW_VARIANT_MISMATCH` | The portrait parts of a view do not have the same names, of the same kinds, as the others. The names are in cause. |

### VIDEO

| Code | Meaning |
| --- | --- |
| `VIDEO_CLEANUP_FAILED` | Cleaning up a video failed. Each cause is in cleanupErrors. |
| `VIDEO_CLOSED` | A video was closed and takes nothing more. |
| `VIDEO_FRAME_INVALID` | The frame given to a video is not valid. |
| `VIDEO_LISTENER_FAILED` | A listener the application gave to a video threw. What it threw is in cause. |
| `VIDEO_OPTIONS_INVALID` | The options given to a video are not valid: one is missing, of the wrong type or out of range. |
| `VIDEO_PLAY_REFUSED` | The browser refused to play the video, usually because it has sound and the page has not been pressed yet. Play it muted, or from a press. |
| `VIDEO_UNAVAILABLE` | A video is not available here. |

### WEBGL2

| Code | Meaning |
| --- | --- |
| `WEBGL2_BACKING_LIMIT` | The backing limit of the WebGL2 Host was passed. |
| `WEBGL2_BACKPRESSURE` | The WebGL2 Host holds as many unfinished frames as it takes. Draw the next frame later. |
| `WEBGL2_CLOSED` | The WebGL2 Host was closed and takes nothing more. |
| `WEBGL2_CLOSE_UNSAFE` | The WebGL2 Host could not release everything it made while closing. The cause is in cause. |
| `WEBGL2_CONTEXT_ATTRIBUTES_UNSUPPORTED` | The context attributes is not supported by the WebGL2 Host. |
| `WEBGL2_CONTEXT_LIMIT` | The context limit of the WebGL2 Host was passed. |
| `WEBGL2_CONTEXT_LOST` | The browser took the WebGL2 context away. The Host restores it when the browser gives it back; frames are refused until then. |
| `WEBGL2_CONTEXT_RESTORING` | The WebGL2 context is being restored. Frames are taken again once it is back. |
| `WEBGL2_CONTEXT_UNAVAILABLE` | The browser gave no WebGL2 context for the canvas. The canvas may already have another kind of context, or WebGL2 is turned off. |
| `WEBGL2_DIAGNOSTIC_CALLBACK_FAILED` | A callback the application gave to the WebGL2 Host threw. What it threw is in cause. |
| `WEBGL2_FAILED` | The WebGL2 Host failed. The cause is in cause. |
| `WEBGL2_FORMAT_UNSUPPORTED` | The format is not supported by the WebGL2 Host. |
| `WEBGL2_FRAME_BUDGET` | The frame is larger than the Host was made to take. Its limits are options of createSharedWebGL2Host. |
| `WEBGL2_FRAME_INVALID` | The frame given to the WebGL2 Host is not valid. |
| `WEBGL2_FRAME_PROFILE_UNSUPPORTED` | The frame profile is not supported by the WebGL2 Host. |
| `WEBGL2_GENERATION_EXHAUSTED` | The generation counter of the WebGL2 Host ran out. Make a new one. |
| `WEBGL2_GEOMETRY_RANGE` | The geometry is out of range for the WebGL2 Host. |
| `WEBGL2_NOT_STARTED` | The Host has not started. An Engine starts its Host; wait for createEngine to resolve before drawing. |
| `WEBGL2_OPTIONS_INVALID` | The options given to the WebGL2 Host are not valid: one is missing, of the wrong type or out of range. |
| `WEBGL2_OUT_OF_MEMORY` | The graphics device ran out of memory. Use fewer or smaller textures. |
| `WEBGL2_PRECISION_UNSUPPORTED` | The precision is not supported by the WebGL2 Host. |
| `WEBGL2_REENTRANT` | The WebGL2 Host was called again from inside one of its own callbacks. |
| `WEBGL2_RENDER_FAILED` | The render of the WebGL2 Host failed. The cause is in cause. |
| `WEBGL2_RESTORE_FAILED` | The restore of the WebGL2 Host failed. The cause is in cause. |
| `WEBGL2_RESTORE_TIMEOUT` | The restore of the WebGL2 Host took too long. |
| `WEBGL2_SERIAL_EXHAUSTED` | The serial counter of the WebGL2 Host ran out. Make a new one. |
| `WEBGL2_START_CANCELLED` | The start of the WebGL2 Host was cancelled. |
| `WEBGL2_START_FAILED` | The start of the WebGL2 Host failed. The cause is in cause. |
| `WEBGL2_STOPPED` | The WebGL2 Host was stopped and takes nothing more. |
| `WEBGL2_SYNC_FAILED` | The sync of the WebGL2 Host failed. The cause is in cause. |
| `WEBGL2_SYNC_TIMEOUT` | The sync of the WebGL2 Host took too long. |
| `WEBGL2_VALIDATION` | WebGL2 refused an operation of the Host as not valid. The cause is in cause. |

### WEBGL2_LAYER

| Code | Meaning |
| --- | --- |
| `WEBGL2_LAYER_BUDGET` | A limit of a WebGL2 layer was passed. |
| `WEBGL2_LAYER_DISPOSED` | A WebGL2 layer was disposed and takes nothing more. |
| `WEBGL2_LAYER_EFFECT_INVALID` | The effect given to a WebGL2 layer is not valid. |
| `WEBGL2_LAYER_INVALID` | What was given to a WebGL2 layer is not valid. |
| `WEBGL2_LAYER_NOT_READY` | A WebGL2 layer is not ready yet. |
| `WEBGL2_LAYER_PENDING` | A WebGL2 layer still has work pending. |

### WEBGL2_READBACK

| Code | Meaning |
| --- | --- |
| `WEBGL2_READBACK_DISABLED` | A WebGL2 readback is turned off. Turn it on with the option of its factory. |
| `WEBGL2_READBACK_FAILED` | A WebGL2 readback failed. The cause is in cause. |
| `WEBGL2_READBACK_PENDING` | A WebGL2 readback still has work pending. |

### WEBGL2_UPLOAD

| Code | Meaning |
| --- | --- |
| `WEBGL2_UPLOAD_ABORTED` | A staged WebGL2 upload was aborted. |
| `WEBGL2_UPLOAD_DISPOSED` | A staged WebGL2 upload was disposed and takes nothing more. |
| `WEBGL2_UPLOAD_EXPIRED` | A staged WebGL2 upload took too long and was given up. |
| `WEBGL2_UPLOAD_INVALID` | What was given to a staged WebGL2 upload is not valid. |
| `WEBGL2_UPLOAD_NOT_READY` | A staged WebGL2 upload is not ready yet. |
| `WEBGL2_UPLOAD_OPTIONS_INVALID` | The options given to a staged WebGL2 upload are not valid: one is missing, of the wrong type or out of range. |
| `WEBGL2_UPLOAD_STALE` | What was given to a staged WebGL2 upload has been replaced by a newer one. |
| `WEBGL2_UPLOAD_USED` | A staged WebGL2 upload was already used once and cannot be used again. |

### WEBGPU

| Code | Meaning |
| --- | --- |
| `WEBGPU_ADAPTER_UNAVAILABLE` | The browser offers no WebGPU adapter. Use the WebGL2 Host instead. |
| `WEBGPU_BACKING_LIMIT` | The backing limit of the WebGPU Host was passed. |
| `WEBGPU_BACKPRESSURE` | The WebGPU Host holds as many unfinished frames as it takes. Draw the next frame later. |
| `WEBGPU_CLOSED` | The WebGPU Host was closed and takes nothing more. |
| `WEBGPU_CLOSE_UNSAFE` | The WebGPU Host could not release everything it made while closing. The cause is in cause. |
| `WEBGPU_CONTEXT_UNAVAILABLE` | The context of the WebGPU Host is not available here. |
| `WEBGPU_DEVICE_FAILED` | The device of the WebGPU Host failed. The cause is in cause. |
| `WEBGPU_DEVICE_LIMIT` | The device limit of the WebGPU Host was passed. |
| `WEBGPU_DEVICE_LOST` | The browser took the WebGPU device away. The Host recovers where recovery is enabled; frames are refused until then. |
| `WEBGPU_DIAGNOSTIC_CALLBACK_FAILED` | A callback the application gave to the WebGPU Host threw. What it threw is in cause. |
| `WEBGPU_FAILED` | The WebGPU Host failed. The cause is in cause. |
| `WEBGPU_FORMAT_UNSUPPORTED` | The format is not supported by the WebGPU Host. |
| `WEBGPU_FRAME_BUDGET` | The frame is larger than the Host was made to take. Its limits are options of createSharedWebGPUHost. |
| `WEBGPU_FRAME_INVALID` | The frame given to the WebGPU Host is not valid. |
| `WEBGPU_FRAME_PROFILE_UNSUPPORTED` | The frame profile is not supported by the WebGPU Host. |
| `WEBGPU_GENERATION_EXHAUSTED` | The generation counter of the WebGPU Host ran out. Make a new one. |
| `WEBGPU_GEOMETRY_RANGE` | The geometry is out of range for the WebGPU Host. |
| `WEBGPU_INTERNAL` | WebGPU reported an internal error. The cause is in cause. |
| `WEBGPU_NOT_STARTED` | The Host has not started. An Engine starts its Host; wait for createEngine to resolve before drawing. |
| `WEBGPU_OPTIONS_INVALID` | The options given to the WebGPU Host are not valid: one is missing, of the wrong type or out of range. |
| `WEBGPU_OUT_OF_MEMORY` | The graphics device ran out of memory. Use fewer or smaller textures. |
| `WEBGPU_PRECISION_UNSUPPORTED` | The precision is not supported by the WebGPU Host. |
| `WEBGPU_QUEUE_FAILED` | The queue of the WebGPU Host failed. The cause is in cause. |
| `WEBGPU_REENTRANT` | The WebGPU Host was called again from inside one of its own callbacks. |
| `WEBGPU_RENDER_FAILED` | The render of the WebGPU Host failed. The cause is in cause. |
| `WEBGPU_SCOPE_FAILED` | The scope of the WebGPU Host failed. The cause is in cause. |
| `WEBGPU_SERIAL_EXHAUSTED` | The serial counter of the WebGPU Host ran out. Make a new one. |
| `WEBGPU_START_CANCELLED` | The start of the WebGPU Host was cancelled. |
| `WEBGPU_START_FAILED` | The start of the WebGPU Host failed. The cause is in cause. |
| `WEBGPU_STOPPED` | The WebGPU Host was stopped and takes nothing more. |
| `WEBGPU_UNAVAILABLE` | The browser has no WebGPU. Use the WebGL2 Host instead. |
| `WEBGPU_UNCAPTURED_ERROR` | The WebGPU device reported an error outside any operation of the Host. What it reported is in cause. |
| `WEBGPU_VALIDATION` | WebGPU refused an operation of the Host as not valid. The cause is in cause. |

### WEBGPU_READBACK

| Code | Meaning |
| --- | --- |
| `WEBGPU_READBACK_DISABLED` | A WebGPU readback is turned off. Turn it on with the option of its factory. |
| `WEBGPU_READBACK_FAILED` | A WebGPU readback failed. The cause is in cause. |
| `WEBGPU_READBACK_PENDING` | A WebGPU readback still has work pending. |

### WEBGPU_RECOVERY

| Code | Meaning |
| --- | --- |
| `WEBGPU_RECOVERY_DEVICE_INVALID` | The device given to WebGPU device recovery is not valid. |
| `WEBGPU_RECOVERY_DISABLED` | WebGPU device recovery is turned off. Turn it on with the option of its factory. |
| `WEBGPU_RECOVERY_FAILED` | WebGPU device recovery failed. The cause is in cause. |
| `WEBGPU_RECOVERY_LIMIT` | A limit of WebGPU device recovery was passed. |
| `WEBGPU_RECOVERY_STATE_INVALID` | The state given to WebGPU device recovery is not valid. |
| `WEBGPU_RECOVERY_TIMEOUT` | WebGPU device recovery took too long. |

### WEBGPU_UPLOAD

| Code | Meaning |
| --- | --- |
| `WEBGPU_UPLOAD_ABORTED` | A staged WebGPU upload was aborted. |
| `WEBGPU_UPLOAD_DISPOSED` | A staged WebGPU upload was disposed and takes nothing more. |
| `WEBGPU_UPLOAD_EXPIRED` | A staged WebGPU upload took too long and was given up. |
| `WEBGPU_UPLOAD_INVALID` | What was given to a staged WebGPU upload is not valid. |
| `WEBGPU_UPLOAD_NOT_READY` | A staged WebGPU upload is not ready yet. |
| `WEBGPU_UPLOAD_OPTIONS_INVALID` | The options given to a staged WebGPU upload are not valid: one is missing, of the wrong type or out of range. |
| `WEBGPU_UPLOAD_STALE` | What was given to a staged WebGPU upload has been replaced by a newer one. |
| `WEBGPU_UPLOAD_USED` | A staged WebGPU upload was already used once and cannot be used again. |

### WEB_PNG

| Code | Meaning |
| --- | --- |
| `WEB_PNG_BITMAP_INVALID` | The bitmap given to the browser image provider is not valid. |
| `WEB_PNG_BLOB_FAILED` | The blob of the browser image provider failed. The cause is in cause. |
| `WEB_PNG_BYTES_INVALID` | The bytes given to the browser image provider is not valid. |
| `WEB_PNG_CANCELLED` | The browser image provider was cancelled. |
| `WEB_PNG_CLEANUP_FAILED` | Cleaning up the browser image provider failed. Each cause is in cleanupErrors. |
| `WEB_PNG_CLOSE_INCOMPLETE` | The browser image provider closed, but not everything it held could be released. The reasons are in cleanupErrors. |
| `WEB_PNG_CONTEXT_INVALID` | The context given to the browser image provider is not valid. |
| `WEB_PNG_DECODE_FAILED` | The decode of the browser image provider failed. The cause is in cause. |
| `WEB_PNG_DESCRIPTOR_READ_FAILED` | The descriptor read of the browser image provider failed. The cause is in cause. |
| `WEB_PNG_INPUT_LIMIT` | The input limit of the browser image provider was passed. |
| `WEB_PNG_JOB_LIMIT` | The job limit of the browser image provider was passed. |
| `WEB_PNG_OPTIONS_INVALID` | The options given to the browser image provider are not valid: one is missing, of the wrong type or out of range. |
| `WEB_PNG_PROFILE_UNSUPPORTED` | The profile is not supported by the browser image provider. |
| `WEB_PNG_PROVIDER_CLOSED` | The provider of the browser image provider was closed and takes nothing more. |
| `WEB_PNG_PROVIDER_INVALID` | The provider given to the browser image provider is not valid. |
| `WEB_PNG_RASTER_FAILED` | The raster of the browser image provider failed. The cause is in cause. |
| `WEB_PNG_READBACK_INVALID` | The readback given to the browser image provider is not valid. |
| `WEB_PNG_READ_FAILED` | The read of the browser image provider failed. The cause is in cause. |
| `WEB_PNG_SIGNAL_READ_FAILED` | The signal read of the browser image provider failed. The cause is in cause. |
| `WEB_PNG_STRUCTURE_INVALID` | The structure given to the browser image provider is not valid. |
| `WEB_PNG_SURFACE_INVALID` | The surface given to the browser image provider is not valid. |
| `WEB_PNG_UNAVAILABLE` | The browser image provider is not available here. |
| `WEB_PNG_VALUE_INVALID` | The value given to the browser image provider is not valid. |

### WEB_RESOURCE

| Code | Meaning |
| --- | --- |
| `WEB_RESOURCE_BINDINGS_INVALID` | The bindings given to the browser resource source is not valid. |
| `WEB_RESOURCE_BODY_FAILED` | The body of the browser resource source failed. The cause is in cause. |
| `WEB_RESOURCE_CANCELLED` | The browser resource source was cancelled. |
| `WEB_RESOURCE_CLOSE_INCOMPLETE` | The browser resource source closed, but not everything it held could be released. The reasons are in cleanupErrors. |
| `WEB_RESOURCE_CONTEXT_INVALID` | The context given to the browser resource source is not valid. |
| `WEB_RESOURCE_DEADLINE_EXCEEDED` | A request of the browser resource source took longer than its deadline. |
| `WEB_RESOURCE_FETCH_FAILED` | The fetch of the browser resource source failed. The cause is in cause. |
| `WEB_RESOURCE_HTTP_STATUS` | The server answered a request of the browser resource source with a status that is not success. |
| `WEB_RESOURCE_INPUT_LIMIT` | The input limit of the browser resource source was passed. |
| `WEB_RESOURCE_INTEGRITY_MISMATCH` | The integrity given to the browser resource source does not match. |
| `WEB_RESOURCE_LENGTH_MISMATCH` | The length given to the browser resource source does not match. |
| `WEB_RESOURCE_MANIFEST_INVALID` | The manifest given to the browser resource source is not valid. |
| `WEB_RESOURCE_OPTIONS_INVALID` | The options given to the browser resource source are not valid: one is missing, of the wrong type or out of range. |
| `WEB_RESOURCE_QUEUE_LIMIT` | The queue limit of the browser resource source was passed. |
| `WEB_RESOURCE_REF_INVALID` | The ref given to the browser resource source is not valid. |
| `WEB_RESOURCE_RESPONSE_INVALID` | The response given to the browser resource source is not valid. |
| `WEB_RESOURCE_SOURCE_CLOSED` | The source of the browser resource source was closed and takes nothing more. |
| `WEB_RESOURCE_SOURCE_INVALID` | The source given to the browser resource source is not valid. |
| `WEB_RESOURCE_UNAVAILABLE` | The browser resource source is not available here. |
| `WEB_RESOURCE_URL_INVALID` | The url given to the browser resource source is not valid. |

### WEB_TEXT

| Code | Meaning |
| --- | --- |
| `WEB_TEXT_CANCELLED` | The browser text provider was cancelled. |
| `WEB_TEXT_CLEANUP_FAILED` | Cleaning up the browser text provider failed. Each cause is in cleanupErrors. |
| `WEB_TEXT_FONT_NOT_READY` | The font of the browser text provider is not ready yet. |
| `WEB_TEXT_PLAN_INVALID` | The plan given to the browser text provider is not valid. |
| `WEB_TEXT_PLAN_LIMIT` | The plan limit of the browser text provider was passed. |
| `WEB_TEXT_PROVIDER_INVALID` | The provider given to the browser text provider is not valid. |
| `WEB_TEXT_STATE_UNSUPPORTED` | The state is not supported by the browser text provider. |
| `WEB_TEXT_UNAVAILABLE` | The browser text provider is not available here. |

### WORLD3D_OVERLAY

| Code | Meaning |
| --- | --- |
| `WORLD3D_OVERLAY_OPTIONS_INVALID` | The options given to the World3D overlay are not valid: one is missing, of the wrong type or out of range. |

### Other codes

| Code | Meaning |
| --- | --- |
| `ASYNC_EVENT_HANDLER` | An event listener returned a promise. Listeners run to their end before dispatch returns; start asynchronous work without returning it. |
| `HOST_IN_USE` | The Host already draws for another Engine. Each Engine needs a Host of its own. |
| `INVALID_DISPLAY_CONTAINER` | What was given is not a display container made by this SDK. |
| `INVALID_DISPLAY_OBJECT` | What was given is not a display object made by this SDK. |
| `INVALID_EVENT` | What was dispatched is not an Event made with an event type of this SDK. |
| `INVALID_EVENT_DISPATCHER` | What was given is not an event dispatcher made by this SDK. |
| `INVALID_FRAME_OPTIONS` | The frame options are not valid: width and height are whole numbers above zero, clearColor is 0 to 0xffffff and clearAlpha is 0 to 1. |
| `INVALID_INDEX` | The child index is not a whole number within the container. |
| `INVALID_PRIORITY` | A listener priority is a whole number. |
| `INVALID_RENDERER` | The Host given to the Engine does not draw this kind of frame. |
| `INVALID_TIMEOUT` | A timeout is a whole number of milliseconds, zero or more. |
| `NOT_A_CHILD` | The display object is not a child of this container. |
| `NOT_READY` | This is not ready yet. Wait for what it was made from to finish loading. |
| `OBJECT_DISPOSED` | The object was disposed and can no longer be changed or added. Make a new one, or stop using it after its scope is disposed. |
| `OPTIONS_INVALID` | The options given are not valid: one is missing, of the wrong type or out of range. |
| `OWNERSHIP_CONFLICT` | The object already belongs to another scope. An object is given to one scope with scope.use, once. |
| `RENDERER_REQUIRED` | The Engine was asked to draw and was created without a Host that draws. Give createEngine a Host from createSharedWebGL2Host or createSharedWebGPUHost. |
| `SURFACE_IN_USE` | The canvas is already used by another Host or input. |
