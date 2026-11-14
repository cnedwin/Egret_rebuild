# What to import

English | [简体中文](../../Cns/docs/entry-points.md)

`@egret/engine` has one main entry and 39 smaller ones. This page says which one a task needs. The [starter example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/starter/README.md) uses the main entry and `@egret/engine/web/game`, which loads a Host for it, and nothing else.

## How the entries are arranged

- **`@egret/engine`** is the core: the Engine, the stage, display objects, events, assets and scopes. It runs without a page, in Node as well.
- **`@egret/engine/webgpu` and `@egret/engine/webgl2`** are the two Hosts that draw in a browser. A game imports one, or chooses at run time.
- **A feature has one entry**, such as `@egret/engine/particles`. It also runs without a page.
- **`@egret/engine/web/...` connects a feature to the browser.** Where a feature needs the page, it comes as a pair: `@egret/engine/audio` mixes sound, and `@egret/engine/web/audio` plays it through the page. Tests and tools use the first alone.

Every factory is named `create...` and returns an object with `dispose()`.

## By task

| I want to | Import | From |
| --- | --- | --- |
| Start an Engine and draw a stage | `createEngineForProfile`, `SHARED_FRAME_PROFILE_2D`, `Sprite`, `Bitmap`, `DisplayObjectContainer` | `@egret/engine` |
| Draw with WebGPU | `createSharedWebGPUHost` | `@egret/engine/webgpu` |
| Draw with WebGL2 | `createSharedWebGL2Host` | `@egret/engine/webgl2` |
| Start a game in a page with one call: Host, Engine, input and loop | `createBrowserGame` | `@egret/engine/web/game` |
| ... and see frames a second and what a frame holds | `createBrowserStatsPanel`, or `stats: true` | `@egret/engine/web/game` |
| Run the game on each frame the display shows | `createBrowserFrameLoop` | `@egret/engine/web/loop` |
| Load an image as a texture | `createBrowserTextureProvider` | `@egret/engine/web/image` |
| Load atlases, sequences and fonts from a built manifest | `createContentLoader`, `createFontContentLoader`, `createManifestAssetBinding` | `@egret/engine/resources` |
| ... and fetch their bytes in a page | `createManifestByteSource`, `createManifestFontContentLoader` | `@egret/engine/web/resources` |
| Play a frame sequence | `createSequenceController`, `createSequenceResetSlot` | `@egret/engine/animation` |
| Tween a value | `engine.createTween(scope, options)` | `@egret/engine` |
| Touch, mouse and pen on display objects | `createPointerInput` | `@egret/engine/input` |
| ... from the page's pointer events | `createBrowserPointerInput` | `@egret/engine/web/pointer` |
| Keyboard | `createKeyboardInput` | `@egret/engine/input` |
| ... from the page's key events | `createBrowserKeyboardInput` | `@egret/engine/web/keyboard` |
| Mouse hover and the wheel | `createHoverInput` | `@egret/engine/input/hover` |
| ... from the page | `createBrowserHoverInput` | `@egret/engine/web/hover` |
| Gamepads | `createGamepadInput`, `bindGamepadKeys` | `@egret/engine/input/gamepad` |
| ... from the browser | `createBrowserGamepadInput` | `@egret/engine/web/gamepad` |
| A mouse-only button on a bitmap | `createMouseInput`, `createBitmapButton` | `@egret/engine/web/input` |
| A camera that follows, zooms and shakes | `createCamera2D` | `@egret/engine/camera` |
| A tile map, also from Tiled | `createTileMap`, `importTiledMap` | `@egret/engine/tilemap` |
| Particles | `createParticleEmitter` | `@egret/engine/particles` |
| Collision and physics | `createPhysicsWorld` | `@egret/engine/physics2d` |
| Text from a bitmap font | `parseBitmapFont`, `createBitmapText` | `@egret/engine/bitmapfont` |
| A line of text | `createTextField`, `createTextRasterCache` | `@egret/engine/text` |
| ... rasterized by the page's canvas | `createCanvasTextRasterProvider` | `@egret/engine/web/text` |
| Styled, multilingual paragraphs | `createParagraph`, `createParagraphCache` | `@egret/engine/paragraph` |
| ... shaped by CanvasKit | `createCanvasKitParagraphProvider`, `createCanvasKitFontSetProvider` | `@egret/engine/web/paragraph` |
| A platform text field over the stage | `createBrowserTextInput` | `@egret/engine/web/text-input` |
| Buttons, toggles, sliders, lists, scrolling, popups, themes | `createUiRoot`, `createActionControl`, `createToggleControl`, `createRangeControl`, `createScrollControl`, `createSelectionGroup`, `createUiLayerManager`, `createUiTheme` | `@egret/engine/ui` |
| Rows and columns | `planLinearLayout` | `@egret/engine/layout` |
| Text editing inside managed UI | `createUiTextEditor` | `@egret/engine/ui/editing` |
| ... with the platform's editor | `createBrowserTextEditor`, `createBrowserEditorFontProvider` | `@egret/engine/web/editing` |
| Roles and names for assistive technology | `createUiSemantics`, `createUiListSemantics` | `@egret/engine/ui/semantics` |
| ... projected to the page | `createBrowserSemantics` | `@egret/engine/web/semantics` |
| Sound: music, effects, groups, fades | `createAudioMixer` | `@egret/engine/audio` |
| ... played by Web Audio | `createBrowserAudio` | `@egret/engine/web/audio` |
| Video on a display object | `createVideo` | `@egret/engine/video` |
| ... from a video element, a file or a stream | `createBrowserVideo` | `@egret/engine/web/video` |
| Blend modes and filters | `blendMode` and `renderEffect` on a display object | `@egret/engine` |
| Read and write bytes | `ByteReader`, `ByteWriter` | `@egret/engine` |
| A 3D scene | scene, meshes, materials, lights, animation, physics | `@egret/engine/world3d` |
| ... drawn with WebGL2 or WebGPU | `createWebGL2Renderer3D`, `createWebGPURenderer3D`, `createWorld3DView` | `@egret/engine/webgl2/world3d`, `@egret/engine/webgpu/world3d` |
| Spine skeletons, JSON or binary | `createSpineContentLoader`, `createSpineDisplay`, `createSpineInstance` | `@egret/spine`; `createManifestSpineContentLoader` from `@egret/spine/web` in a page |

## In a page without a bundler

An example page lists the entries it uses in an import map, one line each, and the three names every page needs: `@egret/runtime`, `@egret/contracts` and `robust-predicates`. Copy the map of the [starter](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/starter/index.html) and add a line for each further entry; the file an entry is built to is its `import` path in [`packages/engine/package.json`](https://github.com/cnedwin/Egret_rebuild/blob/main/packages/engine/package.json).

With a package manager and a bundler no map is needed: see [using the preview from a clean project](clean-consumer.md).
