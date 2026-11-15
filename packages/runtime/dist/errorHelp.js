// SPDX-License-Identifier: Apache-2.0
// A sentence for an error code. A code is an area and what went wrong there, both spelled in capitals: the area is
// read from the longest name the code begins with, and what went wrong from the longest ending it has. The codes a
// game meets most have a sentence of their own, which also says what to do.
/** The areas, longest names first where one begins with another. */
const AREAS = [
    ['ANIMATION', 'the animation coordinator'],
    ['ASSET_GROUP', 'an asset group'],
    ['ASSET_LEASE', 'an asset lease'],
    ['ASSET_MANAGER', 'the asset manager'],
    ['ASSET_PROVIDER', 'an asset provider'],
    ['ASSET', 'the asset manager'],
    ['AUDIO', 'the audio mixer'],
    ['BITMAP_BINDING', 'a bitmap binding'],
    ['BITMAP_BUTTON', 'a bitmap button'],
    ['BITMAP_FONT', 'a bitmap font'],
    ['BITMAP_RESOURCE', 'a bitmap resource slot'],
    ['BITMAP_TEXT', 'bitmap text'],
    ['BITMAP', 'a bitmap'],
    ['BOUNDS', 'a bounds query'],
    ['BROWSER_GAME', 'the browser game'],
    ['BROWSER_STATS', 'the stats panel'],
    ['BROWSER_TEXT_EDITOR', 'the browser text editor'],
    ['BROWSER_TEXT_INPUT', 'the browser text input'],
    ['CAMERA', 'the camera'],
    ['CLOCK', 'the game clock'],
    ['CONTENT_GROUP', 'a content group'],
    ['CONTENT_LOADER', 'a content loader'],
    ['CONTENT', 'content loading'],
    ['COORDINATE', 'a coordinate query'],
    ['DISPLAY_EFFECT', 'a render effect'],
    ['DISPLAY_SUBTREE', 'a prepared display subtree'],
    ['DISPLAY_TREE', 'the display tree'],
    ['DISPLAY', 'a display object'],
    ['ENGINE', 'the Engine'],
    ['EVENT', 'an event'],
    ['FONT_CONTENT', 'font content'],
    ['FRAME_LOOP', 'the frame loop'],
    ['FRAME', 'a frame'],
    ['GAMEPAD', 'gamepad input'],
    ['GRAPHICS', 'graphics'],
    ['HIT_TEST', 'a hit test'],
    ['HOVER_INPUT', 'hover input'],
    ['KEYBOARD_FOCUS_SCOPE', 'a keyboard focus scope'],
    ['KEYBOARD_INPUT', 'keyboard input'],
    ['KEYBOARD', 'the keyboard'],
    ['LAYOUT', 'a layout'],
    ['MANIFEST_BINDING', 'a manifest binding'],
    ['MANIFEST_GROUP', 'a manifest group'],
    ['MOTION', 'a motion'],
    ['MESH_BINDING', 'a mesh binding'],
    ['MESH', 'a mesh'],
    ['MOUSE_INPUT', 'mouse input'],
    ['NINE_SLICE_BITMAP', 'a nine-slice bitmap'],
    ['PARAGRAPH_CACHE', 'the paragraph cache'],
    ['PARAGRAPH_FONT_SET', 'a paragraph font set'],
    ['PARAGRAPH_FONT', 'a paragraph font'],
    ['PARAGRAPH_PROVIDER', 'the paragraph provider'],
    ['PARAGRAPH', 'a paragraph'],
    ['PARTICLE', 'a particle emitter'],
    ['PHYSICS', 'the physics world'],
    ['POINTER_INPUT', 'pointer input'],
    ['SCOPE', 'a scope'],
    ['SEQUENCE_RESET', 'a sequence reset slot'],
    ['SEQ_PLAYBACK', 'a sequence playback'],
    ['SEQ_PLAYER', 'a sequence player'],
    ['SEQ', 'a sequence'],
    ['SHARED_MATERIAL', 'a shared material'],
    ['SPINE_DISPLAY', 'a Spine display'],
    ['SPINE_INSTANCE', 'a Spine instance'],
    ['SPINE_RESET', 'a Spine reset slot'],
    ['SPINE', 'Spine'],
    ['SPRITE_SHEET', 'a sprite sheet'],
    ['STAGE', 'the stage'],
    ['TEXTURE_VIEW', 'a texture view'],
    ['TEXTURE', 'a texture'],
    ['TEXT_CACHE', 'the text cache'],
    ['TEXT_FIELD', 'a text field'],
    ['TEXT_PLAN', 'a text plan'],
    ['TEXT', 'text'],
    ['TILEMAP', 'a tile map'],
    ['TWEEN', 'a tween'],
    ['UI_CONTROL', 'a UI control'],
    ['UI_KEYBOARD', 'UI keyboard navigation'],
    ['UI_LAYER', 'a UI layer'],
    ['UI_SEMANTICS', 'UI semantics'],
    ['UI_TEXT_EDITOR', 'the UI text editor'],
    ['UI_THEME', 'a UI theme'],
    ['UI', 'the UI'],
    ['VIDEO', 'a video'],
    ['WEBGL2_LAYER', 'a WebGL2 layer'],
    ['WEBGL2_READBACK', 'a WebGL2 readback'],
    ['WEBGL2_UPLOAD', 'a staged WebGL2 upload'],
    ['WEBGL2', 'the WebGL2 Host'],
    ['WEBGPU_READBACK', 'a WebGPU readback'],
    ['WEBGPU_RECOVERY', 'WebGPU device recovery'],
    ['WEBGPU_UPLOAD', 'a staged WebGPU upload'],
    ['WEBGPU', 'the WebGPU Host'],
    ['WEB_PNG', 'the browser image provider'],
    ['WEB_RESOURCE', 'the browser resource source'],
    ['WEB_TEXT', 'the browser text provider']
];
/** What went wrong, by ending, longest first. `{a}` is the area, `{o}` what stands between the area and the ending. */
const ENDINGS = [
    ['OPTIONS_INVALID', 'The options given to {a} are not valid: one is missing, of the wrong type or out of range.'],
    ['SCOPE_INVALID', 'The scope given to {a} is not an open scope of this Engine.'],
    ['CLEANUP_FAILED', 'Cleaning up {a} failed. Each cause is in cleanupErrors.'],
    ['SETUP_FAILED', 'Setting up {a} failed. The cause is in cause.'],
    ['CALLBACK_FAILED', 'A callback the application gave to {a} threw. What it threw is in cause.'],
    ['LISTENER_FAILED', 'A listener the application gave to {a} threw. What it threw is in cause.'],
    ['FACTORY_REQUIRED', '{A} is made by its factory function, not with new.'],
    ['ALREADY_STARTED', '{A} was already started.'],
    ['ALREADY_CREATED', '{A} was already created.'],
    ['NOT_STARTED', '{A} has not been started.'],
    ['NOT_READY', '{A} is not ready yet.', 'The {o} of {a} is not ready yet.'],
    ['BUDGET_EXCEEDED', 'A limit of {a} was passed.'],
    ['CAP_EXCEEDED', 'A limit of {a} was passed.'],
    ['IN_USE', '{A} is already in use.', 'The {o} given to {a} is already in use.'],
    ['OPTIONS', 'The options given to {a} are not valid.'],
    ['INVALID', 'What was given to {a} is not valid.', 'The {o} given to {a} is not valid.'],
    ['FAILED', '{A} failed. The cause is in cause.', 'The {o} of {a} failed. The cause is in cause.'],
    ['CLOSED', '{A} was closed and takes nothing more.', 'The {o} of {a} was closed and takes nothing more.'],
    ['DISPOSED', '{A} was disposed and takes nothing more.', 'The {o} of {a} was disposed and takes nothing more.'],
    ['RELEASED', '{A} was released and can no longer be used.', 'The {o} of {a} was released and can no longer be used.'],
    ['TERMINAL', '{A} has ended and cannot be used again.', 'The {o} of {a} has ended and cannot be used again.'],
    [
        'RETIRED',
        '{A} has been retired and cannot be used again.',
        'The {o} of {a} has been retired and cannot be used again.'
    ],
    [
        'REENTRANT',
        '{A} was called again from inside one of its own callbacks.',
        'The {o} of {a} was called again from inside one of its own callbacks.'
    ],
    ['LIMIT', 'A limit of {a} was passed.', 'The {o} limit of {a} was passed.'],
    ['BUDGET', 'A limit of {a} was passed.', 'The {o} limit of {a} was passed.'],
    ['CAPACITY', '{A} holds as much as it takes.', 'The {o} capacity of {a} is full.'],
    ['EXHAUSTED', 'A counter of {a} ran out. Make a new one.', 'The {o} counter of {a} ran out. Make a new one.'],
    ['UNSUPPORTED', 'This is not supported by {a}.', 'The {o} is not supported by {a}.'],
    ['UNAVAILABLE', '{A} is not available here.', 'The {o} of {a} is not available here.'],
    ['BUSY', '{A} is still busy with an earlier request.', 'The {o} of {a} is still busy with an earlier request.'],
    ['ACTIVE', '{A} is still active.', 'The {o} of {a} is still active.'],
    ['PENDING', '{A} still has work pending.', 'The {o} of {a} is still pending.'],
    [
        'STALE',
        'What was given to {a} has been replaced by a newer one.',
        'The {o} given to {a} has been replaced by a newer one.'
    ],
    ['SUPERSEDED', 'A newer request to {a} replaced this one.'],
    ['CHANGED', '{A} changed while a request was on its way.', 'The {o} of {a} changed while a request was on its way.'],
    ['CANCELLED', '{A} was cancelled.', 'The {o} of {a} was cancelled.'],
    ['ABORTED', '{A} was aborted.', 'The {o} of {a} was aborted.'],
    ['REQUIRED', 'Something {a} needs was not given.', 'A {o} is required by {a}.'],
    ['UNKNOWN', 'What was named is not known to {a}.', 'No such {o} is known to {a}.'],
    ['MISSING', 'Something {a} needs is missing.', 'A {o} that {a} needs is missing.'],
    ['DUPLICATE', 'The same thing was given twice to {a}.', 'The same {o} was given twice to {a}.'],
    ['MISMATCH', 'Two things given to {a} do not belong together.', 'The {o} given to {a} does not match.'],
    ['RANGE', 'A number is out of range for {a}.', 'The {o} is out of range for {a}.'],
    ['TIMEOUT', '{A} took too long.', 'The {o} of {a} took too long.'],
    ['EXPIRED', '{A} took too long and was given up.', 'The {o} of {a} took too long and was given up.'],
    ['LOST', '{A} was lost.', 'The {o} of {a} was lost.'],
    [
        'BACKWARDS',
        'A time given to {a} is earlier than the one before it.',
        'The {o} given to {a} is earlier than the one before it.'
    ],
    ['BACKPRESSURE', '{A} holds as many unfinished frames as it takes. Draw the next frame later.'],
    ['REFUSED', '{A} was refused.', 'The {o} of {a} was refused.'],
    ['NOT_FOUND', 'What was named was not found by {a}.', 'The {o} named was not found by {a}.'],
    ['NOT_REGISTERED', 'What was named is not registered with {a}.', 'The {o} named is not registered.'],
    ['TOO_LONG', 'What was given to {a} is too long.', 'The {o} given to {a} is too long.'],
    ['TOO_SMALL', 'What was given to {a} is too small.', 'The {o} given to {a} is too small.'],
    ['DISABLED', '{A} is turned off. Turn it on with the option of its factory.'],
    ['STOPPED', '{A} was stopped and takes nothing more.'],
    ['USED', '{A} was already used once and cannot be used again.'],
    ['UNPREPARED', '{A} has not been prepared yet.'],
    ['UNRESOLVED', 'Something {a} needs could not be found.', 'A {o} that {a} needs could not be found.']
];
/** Codes with a sentence of their own. */
const WRITTEN = {
    BROWSER_TEXT_EDITOR_COMPOSING: 'The browser text editor is composing text with an input method. Wait for that to end.',
    BROWSER_TEXT_EDITOR_ELEMENT_DETACHED: 'The element of the browser text editor is no longer in the page.',
    BROWSER_TEXT_EDITOR_FOCUS: 'The browser text editor could not take or keep the focus.',
    BROWSER_TEXT_EDITOR_FONT_GENERATION: 'The fonts given to the browser text editor are not of the generation it expects.',
    BROWSER_TEXT_EDITOR_INACTIVE: 'The browser text editor is not active.',
    BROWSER_TEXT_EDITOR_SURFACE: 'The surface given to the browser text editor is not a canvas it can use.',
    BROWSER_TEXT_EDITOR_TARGET: 'The target given to the browser text editor is not valid.',
    BROWSER_TEXT_INPUT_IDLE: 'The browser text input has no request in hand.',
    BROWSER_TEXT_INPUT_REQUEST: 'The request given to the browser text input is not valid.',
    BROWSER_TEXT_INPUT_SURFACE: 'The surface given to the browser text input is not a canvas it can use.',
    DISPLAY_SUBTREE_OVERLAP: 'Two prepared display subtrees share a node.',
    DISPLAY_SUBTREE_TARGET_DETACHED: 'The target of a prepared display subtree is no longer on the stage.',
    PARAGRAPH_FONT_SET_IDENTITY_COLLISION: 'Two fonts of a paragraph font set have the same identity.',
    PARAGRAPH_FONT_SET_PROVIDER: 'The provider given to a paragraph font set is not valid.',
    SEQUENCE_RESET_NOT_PREPARED: 'The sequence reset slot has not been prepared.',
    SEQUENCE_RESET_PRESERVE_TIMELINE: 'The timeline cannot be kept through this reset of a sequence.',
    SEQUENCE_RESET_TARGET_CLAIMED: 'The target of a sequence reset slot is already held by another.',
    SPINE_INSTANCE_FAULTED: 'The Spine instance failed earlier and can no longer be used.',
    SPINE_INSTANCE_NONFINITE_POSE: 'A pose of the Spine instance has a number that is not finite.',
    SPINE_INSTANCE_RESET_NOT_PRISTINE: 'The Spine instance cannot be reset this way: it is no longer as it was when it was made.',
    SPINE_INSTANCE_SEEK_BACKWARD_EVENTS: 'A seek backwards would pass events of the Spine instance, which are not played backwards.',
    SPINE_INSTANCE_SEEK_HISTORY: 'The Spine instance cannot seek that far back: its history does not reach there.',
    SPINE_RESET_NOT_PREPARED: 'The Spine reset slot has not been prepared.',
    SPINE_RESET_PRESERVE_ANIMATION: 'The animation cannot be kept through this reset of a Spine display.',
    SPINE_RESET_PRESERVE_SKIN: 'The skin cannot be kept through this reset of a Spine display.',
    SPINE_RESET_PRESERVE_STATE: 'The state cannot be kept through this reset of a Spine display.',
    SPINE_RESET_TARGET_CLAIMED: 'The target of a Spine reset slot is already held by another.',
    TEXT_EDIT_COMPOSING: 'The text is being composed with an input method, and this edit cannot be made until that ends.',
    TEXT_EDIT_SELECTION: 'The selection given to a text edit is not valid.',
    TEXT_EDIT_VALUE: 'The value given to a text edit is not valid.',
    UI_EDITOR_FONTS_DECODE: 'A font of the UI text editor could not be decoded.',
    UI_EDITOR_FONTS_FAMILY: 'A font family given to the UI text editor is not valid.',
    UI_EDITOR_FONTS_PROFILE: 'A font given to the UI text editor is not of a profile it reads.',
    UI_TEXT_EDITOR_COMPOSING: 'The UI text editor is composing text with an input method. Wait for that to end.',
    UI_TEXT_EDITOR_STYLE: 'The style given to the UI text editor is not valid.',
    WEB_RESOURCE_DEADLINE_EXCEEDED: 'A request of the browser resource source took longer than its deadline.',
    WEB_RESOURCE_HTTP_STATUS: 'The server answered a request of the browser resource source with a status that is not success.',
    FONT_CONTENT_ASSET: 'The asset given to font content is not valid.',
    FONT_CONTENT_BYTES: 'The bytes given to font content are not valid.',
    FONT_CONTENT_FLAVOR: 'The flavor given to font content is not valid.',
    FONT_CONTENT_GROUP: 'The group given to font content is not valid.',
    FONT_CONTENT_INPUT: 'The input given to font content is not valid.',
    FONT_CONTENT_LOADER: 'The loader given to font content is not valid.',
    FONT_CONTENT_PROFILE: 'The profile given to font content is not valid.',
    FONT_CONTENT_PROVIDER: 'The provider given to font content is not valid.',
    FONT_CONTENT_REF: 'The ref given to font content is not valid.',
    FONT_CONTENT_ROOTS: 'The roots given to font content are not valid.',
    FONT_CONTENT_SCOPE: 'The scope given to font content is not valid.',
    ANIMATION_COMMANDS_REPLACED: 'The commands given to an animation for this tick were replaced by later ones before they ran.',
    ANIMATION_RATE_ZERO: 'A rate of 0 was given to an animation. A rate is above or below zero: pause the animation to hold it still.',
    ANIMATION_TERMINAL_COMMAND: 'A command was given for an animation that has ended.',
    ASSET_NO_DEMAND: 'The load of an asset was stopped because everything that had asked for it gave it up.',
    GAMEPAD_SAMPLE: 'The sample given to gamepad input is not a gamepad sample.',
    HOVER_INPUT_REASON: 'The reason given to hover input for a leave is not one it knows.',
    HOVER_INPUT_SAMPLE: 'The sample given to hover input is not an object with a pointer id, a pointer type, global coordinates and a timestamp.',
    HOVER_INPUT_VIEWPORT: 'The viewport revision given to hover input is not a whole number above the last one.',
    POINTER_INPUT_REASON: 'The reason given to pointer input for a cancel is not one it knows.',
    POINTER_INPUT_SAMPLE: 'The sample given to pointer input is not a pointer sample.',
    POINTER_INPUT_VIEWPORT: 'The viewport revision given to pointer input is not a whole number above the last one.',
    KEYBOARD_TARGET_INELIGIBLE: 'The keyboard target cannot take focus now, for instance because it is disabled or not on the stage.',
    SEQUENCE_RESET_PRESERVE_STATE: 'A sequence is reset keeping its place only while it is running or paused, with no command waiting.',
    SPINE_LOADER_RECEIVER: 'A method of the Spine loader was called apart from the loader. Call it on the loader: loader.load(...).',
    UI_CONTROL_DIRECTION: 'The direction given to a UI control is not two finite numbers.',
    UI_CONTROL_RADIUS: 'The radius given to a UI control is not a finite number above zero.',
    UI_LAYER_BASE: 'The base layer of a UI is always open. It is not opened or closed by name.',
    UI_LAYER_MANAGER_OWNED: 'This Engine already has a UI layer manager. An Engine has one.',
    UI_LAYER_ROOT_OWNED: 'This UI root already belongs to a layer.',
    UI_LAYOUT_UNSTABLE: 'The layout of the UI did not settle in eight rounds: a size keeps changing something it depends on.',
    UI_ROW_NOT_REALIZED: 'The row is not on screen now, so there is nothing of it to act on. Scroll it into view first.',
    UI_ROW_RETAINED: 'A row that is in use was removed from its list or changed under it.',
    UI_SEMANTICS_DESCRIPTION: 'A field of a UI semantics entry is not valid. The entry and the field are in cause.',
    UI_SEMANTICS_FOCUS: 'More than one entry of UI semantics is focused, or the focused one is inert. The entry is in cause.',
    UI_SEMANTICS_PARENT: 'An entry of UI semantics is not inside the kind of entry its role needs.',
    UI_SEMANTICS_RELATION: 'An entry of UI semantics names another entry that is not in the tree. The entry is in cause.',
    UI_SEMANTICS_REVISION: 'The revision given to UI semantics is older than the one it has.',
    UI_SOURCE_REVISION: 'The rows of a list changed while the UI was reading them under one revision.',
    UI_STALE_PREPARATION: 'The prepared UI no longer matches the UI it was prepared for. Prepare it again.',
    UI_TREE_SHAPE: 'A new description of the UI has other nodes, or a node of another kind, than the tree it updates.',
    WEBGL2_CLOSE_UNSAFE: 'The WebGL2 Host could not release everything it made while closing. The cause is in cause.',
    WEBGL2_VALIDATION: 'WebGL2 refused an operation of the Host as not valid. The cause is in cause.',
    WEBGPU_CLOSE_UNSAFE: 'The WebGPU Host could not release everything it made while closing. The cause is in cause.',
    WEBGPU_INTERNAL: 'WebGPU reported an internal error. The cause is in cause.',
    WEBGPU_VALIDATION: 'WebGPU refused an operation of the Host as not valid. The cause is in cause.',
    WEB_PNG_CLOSE_INCOMPLETE: 'The browser image provider closed, but not everything it held could be released. The reasons are in cleanupErrors.',
    WEB_RESOURCE_CLOSE_INCOMPLETE: 'The browser resource source closed, but not everything it held could be released. The reasons are in cleanupErrors.',
    TWEEN_OPTIONS_INVALID: 'The options of a tween are not valid: from and to are finite numbers, durationSeconds is above zero, and onUpdate is a function that returns nothing.',
    OBJECT_DISPOSED: 'The object was disposed and can no longer be changed or added. Make a new one, or stop using it after its scope is disposed.',
    ENGINE_CLOSED: 'The Engine was closed. Nothing made with it can be used any more.',
    ENGINE_MISMATCH: 'The object belongs to another Engine. A display tree, a scope and their resources all belong to one Engine.',
    SCOPE_CLOSED: 'The scope was disposed, and everything it owned with it. Create a new scope.',
    FRAME_RENDER_FAILED: 'The Host refused or failed to draw the frame. The reason is in cause: a code ending in _BACKPRESSURE means the Host was still busy with earlier frames, which the frame loop of @egret/engine/web/loop avoids.',
    FRAME_BUDGET_EXCEEDED: 'The stage holds more than one frame takes: 65,536 nodes or commands, 256 materials, 4,096 different geometries or 65,536 mesh triangles. A circle of radius 40 is 32 triangles.',
    FRAME_IMAGE_BUDGET: 'The frame uses more images than it takes: 64 pages, 4,096 regions or 64 MiB of distinct pixels. Pack images into fewer atlases.',
    FRAME_TRANSFORM_INVALID: 'A display object is placed where its corners are not finite numbers. Check its x, y, scale and rotation, and those of its parents.',
    FRAME_STAGE_INVALID: 'A frame is captured from the stage of an Engine, and this is not one.',
    FRAME_REENTRANT: 'A frame was asked for while another was being captured. Draw from the frame loop, not from inside a callback of the capture.',
    INVALID_FRAME_OPTIONS: 'The frame options are not valid: width and height are whole numbers above zero, clearColor is 0 to 0xffffff and clearAlpha is 0 to 1.',
    INVALID_RENDERER: 'The Host given to the Engine does not draw this kind of frame.',
    RENDERER_REQUIRED: 'The Engine was asked to draw and was created without a Host that draws. Give createEngine a Host from createSharedWebGL2Host or createSharedWebGPUHost.',
    OWNERSHIP_CONFLICT: 'The object already belongs to another scope. An object is given to one scope with scope.use, once.',
    DISPLAY_VALUE_INVALID: 'A value given to a display object is not valid: positions, scales and rotation are finite numbers, alpha is 0 to 1 and visible is a boolean.',
    DISPLAY_SIZE_UNAVAILABLE: 'The object draws nothing, so it has no width or height to scale to a size. Draw it first, or set scaleX and scaleY.',
    DISPLAY_CYCLE: 'A container cannot be added to itself or to one of its own descendants.',
    DISPLAY_TREE_INVARIANT: 'The display tree changed while it was being walked, or a node was reached twice. Do not change the tree from inside a capture or a query.',
    STAGE_ROOT_ONLY: 'The stage is the root of the tree: it cannot be added to a container or disposed by itself.',
    NOT_A_CHILD: 'The display object is not a child of this container.',
    INVALID_INDEX: 'The child index is not a whole number within the container.',
    INVALID_DISPLAY_OBJECT: 'What was given is not a display object made by this SDK.',
    INVALID_DISPLAY_CONTAINER: 'What was given is not a display container made by this SDK.',
    GRAPHICS_VALUE_INVALID: 'A value given to graphics is not valid: coordinates are finite numbers, sizes are not negative, a colour is 0 to 0xffffff and an alpha is 0 to 1.',
    GRAPHICS_FILL_REQUIRED: 'A shape needs a fill or a line. Call beginFill or lineStyle before drawing it.',
    GRAPHICS_BUDGET: 'The drawing is more than one sprite holds: a path of 8,192 points, a line of 16,384 dashes, a fill with holes or crossings of 16,384 triangles, 16 meshes, or an image repeated beyond 8,192 of its pixels. What the sprite had drawn before stays. Draw the rest into another sprite.',
    CLOCK_DELTA_LIMIT: 'The time given to engine.advanceTime is further from the last one than the clock takes in one step. Give it smaller steps, as the frame loop of @egret/engine/web/loop does after a tab was hidden.',
    CLOCK_SOURCE_BACKWARDS: 'The time given to engine.advanceTime is earlier than the last one. It takes seconds that never go back.',
    CLOCK_SOURCE_INVALID: 'The time given to engine.advanceTime is not a finite number of seconds, zero or more.',
    CLOCK_REENTRANT: 'engine.advanceTime was called from inside a tick or while a frame was being captured.',
    FRAME_LOOP_CLOSED: 'The frame loop was disposed. Create a new one.',
    ASSET_LOAD_FAILED: 'A provider failed to load the asset. What it threw is in cause.',
    ASSET_PROVIDER_MISSING: 'No provider is registered for this type of asset. Register one with engine.assets.register before acquiring it.',
    ASSET_PROVIDER_REGISTERED: 'A provider is already registered for this type of asset.',
    ASSET_ACQUIRE_CANCELLED: 'The request for the asset was cancelled, by its signal or because its scope was disposed.',
    ASSET_LEASE_RELEASED: 'The lease was released and its asset may be gone. Acquire the asset again.',
    BITMAP_TEXTURE_REQUIRED: 'A Bitmap is made with a lease of a texture from engine.assets.acquire.',
    TEXTURE_DISPOSED: 'The texture was disposed and can no longer be shown.',
    SHARED_MATERIAL_UNSUPPORTED: 'The material cannot be used on this object: a mesh made for a region samples by region, not by page.',
    MESH_GEOMETRY_INVALID: 'What was given is not a geometry made by createSharedGeometry2D or createTexturedGeometry2D.',
    UI_MANAGED_GEOMETRY: 'The position and size of this object are managed by the UI. Change its layout, not its x, y or scale.',
    OPTIONS_INVALID: 'The options given are not valid: one is missing, of the wrong type or out of range.',
    NOT_READY: 'This is not ready yet. Wait for what it was made from to finish loading.',
    INVALID_EVENT: 'What was dispatched is not an Event made with an event type of this SDK.',
    INVALID_EVENT_DISPATCHER: 'What was given is not an event dispatcher made by this SDK.',
    INVALID_PRIORITY: 'A listener priority is a whole number.',
    INVALID_TIMEOUT: 'A timeout is a whole number of milliseconds, zero or more.',
    UI_DUPLICATE_ID: 'Two parts of the UI were given the same id.',
    UI_DUPLICATE_KEY: 'Two rows of a list were given the same key.',
    UI_UNKNOWN_KEY: 'No row of the list has this key.',
    UI_UNKNOWN_LIST: 'No list of the UI has this id.',
    UI_LIST_NOT_FOUND: 'No list of the UI has this id.',
    UI_CONTROL_UNKNOWN_ITEM: 'The control has no item of this id.',
    UI_LAYOUT_CYCLE: 'The layout of the UI depends on itself: a size is given in terms of a size it decides.',
    LAYOUT_OVERFLOW: 'The children do not fit the space the layout was given.',
    PARAGRAPH_FONT_NOT_REGISTERED: 'The paragraph names a font family that was not registered with its font set.',
    PARAGRAPH_GLYPH_UNRESOLVED: 'No registered font has a glyph for a character of the paragraph. Add a font that covers it.',
    PARAGRAPH_ELLIPSIS_DOES_NOT_FIT: 'The paragraph is too narrow to hold even its ellipsis.',
    COORDINATE_TRANSFORM_SINGULAR: 'A display object on the way has a scale of zero, so a stage point has no local point.',
    TEXTURE_VIEW_REGION_IMMUTABLE: 'The region of a texture view is fixed when it is made. Make another view.',
    WEBGPU_UNCAPTURED_ERROR: 'The WebGPU device reported an error outside any operation of the Host. What it reported is in cause.',
    WEBGL2_CONTEXT_RESTORING: 'The WebGL2 context is being restored. Frames are taken again once it is back.',
    ASYNC_EVENT_HANDLER: 'An event listener returned a promise. Listeners run to their end before dispatch returns; start asynchronous work without returning it.',
    HOST_IN_USE: 'The Host already draws for another Engine. Each Engine needs a Host of its own.',
    SURFACE_IN_USE: 'The canvas is already used by another Host or input.',
    VIDEO_PLAY_REFUSED: 'The browser refused to play the video, usually because it has sound and the page has not been pressed yet. Play it muted, or from a press.',
    AUDIO_HOST_UNAVAILABLE: 'The page has no Web Audio, or it may not start before the page is pressed.',
    WEBGL2_CONTEXT_UNAVAILABLE: 'The browser gave no WebGL2 context for the canvas. The canvas may already have another kind of context, or WebGL2 is turned off.',
    WEBGL2_CONTEXT_LOST: 'The browser took the WebGL2 context away. The Host restores it when the browser gives it back; frames are refused until then.',
    WEBGL2_OUT_OF_MEMORY: 'The graphics device ran out of memory. Use fewer or smaller textures.',
    WEBGL2_FRAME_BUDGET: 'The frame is larger than the Host was made to take. Its limits are options of createSharedWebGL2Host.',
    WEBGL2_NOT_STARTED: 'The Host has not started. An Engine starts its Host; wait for createEngine to resolve before drawing.',
    WEBGPU_ADAPTER_UNAVAILABLE: 'The browser offers no WebGPU adapter. Use the WebGL2 Host instead.',
    WEBGPU_UNAVAILABLE: 'The browser has no WebGPU. Use the WebGL2 Host instead.',
    WEBGPU_DEVICE_LOST: 'The browser took the WebGPU device away. The Host recovers where recovery is enabled; frames are refused until then.',
    WEBGPU_OUT_OF_MEMORY: 'The graphics device ran out of memory. Use fewer or smaller textures.',
    WEBGPU_FRAME_BUDGET: 'The frame is larger than the Host was made to take. Its limits are options of createSharedWebGPUHost.',
    WEBGPU_NOT_STARTED: 'The Host has not started. An Engine starts its Host; wait for createEngine to resolve before drawing.'
};
import { ZH_AREAS, ZH_ENDINGS, ZH_WRITTEN } from './errorHelpZh.js';
const TABLES = {
    en: {
        areas: AREAS,
        endings: ENDINGS,
        written: WRITTEN,
        other: (area, rest) => 'A problem with ' + area + ': ' + rest + '.',
        cache: new Map()
    },
    zh: {
        areas: ZH_AREAS,
        endings: ZH_ENDINGS,
        written: ZH_WRITTEN,
        other: (area, rest) => area + '出现问题：`' + rest + '`。',
        cache: new Map()
    }
};
let language = 'en';
/**
 * The language of the sentence in the message of every error made from now on: English unless set. The code of an
 * error is the same in every language.
 */
export function setErrorLanguage(value) {
    if (value !== 'en' && value !== 'zh')
        throw new TypeError('The language of errors is "en" or "zh".');
    language = value;
}
export function getErrorLanguage() {
    return language;
}
const words = (tokens) => tokens.join(' ').toLowerCase();
/**
 * A sentence for an error code: what went wrong and, for the codes a game meets most, what to do. It is in the
 * language given, or the one set by `setErrorLanguage`. A code this SDK does not know gives an empty string.
 */
export function describeErrorCode(code, inLanguage = language) {
    const tables = TABLES[inLanguage];
    if (typeof code !== 'string' || tables === undefined)
        return '';
    const cache = tables.cache, known = cache.get(code);
    if (known !== undefined)
        return known;
    let text = tables.written[code] ?? '';
    if (text === '' && /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(code)) {
        const area = tables.areas.find(([prefix]) => code === prefix || code.startsWith(prefix + '_'));
        // A code without a known area has a sentence only when it is written above.
        if (area === undefined) {
            if (cache.size < 2048)
                cache.set(code, '');
            return '';
        }
        const name = area[1], rest = code
            .slice(area[0].length + 1)
            .split('_')
            .filter(part => part !== '');
        const ending = tables.endings.find(([suffix]) => {
            const parts = suffix.split('_');
            return rest.length >= parts.length && rest.slice(-parts.length).join('_') === suffix;
        });
        if (ending !== undefined) {
            const object = words(rest.slice(0, rest.length - ending[0].split('_').length));
            text = (object !== '' && ending[2] !== undefined ? ending[2] : ending[1])
                .replaceAll('{A}', name.charAt(0).toUpperCase() + name.slice(1))
                .replaceAll('{a}', name)
                .replaceAll('{o}', object);
        }
        else if (rest.length !== 0)
            text = tables.other(name, words(rest));
    }
    if (cache.size < 2048)
        cache.set(code, text);
    return text;
}
//# sourceMappingURL=errorHelp.js.map