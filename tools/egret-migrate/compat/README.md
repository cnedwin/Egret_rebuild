# Optional Egret 5 compatibility

[简体中文](README.zh-CN.md) · [HTTP, sockets and channel calls](transport.md)

Egret Migrate includes this module in converted browser games. Existing packet subclasses can extend `egret.ByteArray` and choose `egret.Endian.LITTLE_ENDIAN`. Another host can install the local package (`npm install ./tools/egret-migrate` from a checkout) and import `{ ByteArray, Endian } from '@egret/legacy/protocol'`. This module has no dependencies and uses neither DOM nor host text codecs.

### Project-owned SDK methods

When a legacy game calls methods supplied by its own SDK, pass `provideBindings(base, scope)` to `launchLegacyWeb` or `openLegacyAndroid`. It runs before the first business script. Return additional named values under an enabled `egret`, `eui`, `RES` or `dragonBones` namespace. Existing methods and classes keep their identity. A name collision is reported at startup. Attach asynchronous work to the game scope. For example, `provideBindings: (base, scope) => ({RES: {loadPortrait: id => portraits.acquire(id, scope.signal)}})` retains an application's asset service and its original business call.

### Resource catalog

Use `RES.getResByUrl(url, callback, owner, type)` for a local PNG, UTF-8 text, JSON or an ArrayBuffer. Name and URL reads share the same cache and in-flight load. Pass `RES.ResourceItem.TYPE_BIN` for a binary file with no recognized extension. The Android project must list the source file and bind the dimensions of a PNG in its image declarations. Use the network adapter for operator addresses. Text or binary declarations in the original manifest retain their bytes and their type during conversion. The converter accepts `.txt` and `.csv` for text, and `.bin` and `.dat` for binary files.

`RES.createGroup(name, keys)` accepts resource names and existing groups. `destroyRes(group, false)` keeps resources shared with another loaded group. Closing the owning game cancels outstanding work and suppresses late callbacks. On a cache hit, `getResAsync` resolves its promise before it calls the completion handler on the game clock. Edge compared this order, group release, names, callback receiver and binary bytes with the original 5.3.10 SDK. The Android layout example reads a two-pixel-wide PNG, Chinese text and five binary bytes from the installed package.

### Packet example

```js
const packet = new ByteArray();
packet.endian = Endian.LITTLE_ENDIAN;
packet.writeUnsignedShort(9);
packet.writeUTF('集市');
packet.position = 0;
const id = packet.readUnsignedShort();
const name = packet.readUTF();
```

The adapter supports integer and floating-point fields, Boolean values, UTF-8 strings, offset copies and cursor rewrites. `buffer` returns a copy of the logical payload. `bytes` and `rawBuffer` expose the live reserved storage and can become stale after growth, replacement or clear. Use `readAvailable` to count remaining payload bytes. `bytesAvailable` also counts reserved storage. Setting a position beyond the allocated storage immediately reserves it.

Each packet is bounded to 16 MiB. On malformed UTF-8, an overlong UTF field or truncated reads the adapter throws before consuming the field. Classic UTF decoding omits embedded NULs. The compatible surface is listed in `protocol.d.mts`. Channel handshakes, network transport, the game-specific message schema and server acceptance belong to the importing game and host.

## Single-page MovieClip

Load a JSON resource and its complete atlas page through the existing RES configuration. The factory accepts either constructor arguments or later assignment to `mcDataSet` and `texture`. A cached descriptor can be reused by multiple displays.

```js
const factory = new egret.MovieClipDataFactory(RES.getRes('pilot_json'), RES.getRes('pilot_png'));
const actor = new egret.MovieClip(factory.generateMovieClipData('walk'));
panel.addChild(actor);
actor.gotoAndPlay('step', -1);
```

Named regions, frame durations, offsets, label ranges and named frame events use a shared Egret 7 texture lease and sequence player. Frame numbers begin at one. The game clock pauses offstage playback. A disposed display drops its player, while RES owns the page. The adapter supports up to 1,024 authored holds, 1,048,576 expanded frames, and finite frame rates through 240. Atlas input must contain named, nonblank regions. Compare game-specific subclass overrides separately.

## Sparse scenes and actor parts

Use the optional `@egret/legacy/scene` module (or `./compat/scene.mjs` in a generated page). The game supplies a registered texture type and its existing asset manager. The callback transfers one fresh lease for each request. Put static pages and synchronized animated parts in the order they should draw.

```js
import { createLegacySceneLayer, createLegacyTileIndex } from '@egret/legacy/scene';
const index = createLegacyTileIndex(cells, 256);
const layer = createLegacySceneLayer({ sdk, game,
  acquire: (key, signal) => game.engine.assets.acquire(sdk.createAssetRef(textureType, key), { signal })
});
game.stage.addChild(layer.display);
layer.update([...index.visible(camera), { id: 'body', asset: 'body-page', x: 80, y: 60, clip },
  { id: 'coat', asset: 'coat-page', x: 80, y: 60, clip: coatClip }]);
layer.seek(actionSeconds);
const results = await layer.settled();
await layer.close();
```

Cells carry `{ id, asset, row, column }`, the camera supplies `{ x, y, width, height }`, and each optional `clip` is a sequence from `sdk.createSequenceClip` for the full page. The default concurrency is four. Refreshing the same visible set keeps ready entries, retries failed entries, and cancels entries that left the viewport. A late lease is released. Parts share the game clock and join at the current phase; use independent layers for separate actor clocks. `settled()` returns each current id with `ready` or `failed` and the error if present. `close()` waits for outstanding acquisitions, including a provider still completing after cancellation.

## Repage a large MovieClip atlas during conversion

Pass `--movie-atlases movie-atlases.json` to `convert`. The mapping is a JSON list, for example `[{"data":"pilot_json","texture":"pilot_png"}]`. Choose the RES names used by the original MovieClip factory. Keep the admitted RES configuration and load those names as usual. `rebuild` retains the mapping.

If the PNG exceeds one engine image, the converter keeps the original in the editable source and places losslessly cropped PNG pages in the Web build. Each page includes its neighboring texels at internal edges. The converter decodes every written page to check RGBA, including RGB under zero alpha. The original frame names, timings and offsets stay in the JSON. A frame crossing pages uses multiple clipped Bitmaps. A normal Bitmap can also display the whole paged texture. Existing per-frame rendering budgets still apply. Nine-slice scaling of this virtual image and sharing it as another sheet or skeleton atlas require a separate adapter.

Source decoding accepts up to 8,192 pixels per edge and 16,777,216 pixels per source. Individual displayed frames can cross several pages within that source. An unadmitted type, ambiguous binding or oversized source returns `MIGRATE_MOVIE_ATLAS`; PNG metadata outside the admitted color profile follows the ordinary resource conversion diagnostic.

## Outlined and spaced labels

A migrated EUI Label accepts `stroke` (outline radius), `strokeColor` and signed `lineSpacing`. For example, `<e:Label text="北门" size="24" stroke="2" strokeColor="#003355" lineSpacing="5"/>` gives a two-unit outline and a 29-unit step between rows. The Canvas text provider measures the extra ink, then strokes and fills each row in one cached texture. Equal requests share a texture. A change of outline width or color gives the label a new result. Width-zero requests keep the original fill-only rendering and cache identity. Programmatic labels can use `game.createLabel({ text, fontSize, strokeWidth, strokeColor })`. A third-party text provider must advertise `supportsStroke: true` and implement outlined measurement and painting to accept nonzero widths.

In the local 5.3.10 corpus, these additions raised the number of individually compiled skins from 230 to 451 out of 929. This measures EXML rule admission. Whole-project class wiring, complete screen operation and equivalence to the original remain separate checks. Windows Edge 158 on an RTX 5090 Laptop rendered three equal rows from one cache entry. The row starts were 36 pixels apart at font size 28 with spacing 8. Changing one outline from green to red left 420 white fill pixels present. Closing the scene released all caller leases.

## Timers, property tweens and type names

Use `RES.setMaxLoadingThread(2)` to cap concurrent local reads across groups, direct URL loads and texture pages. The default is four. Values below one use one slot. A smaller limit lets active reads finish; queued reads use the new limit. Atlas construction reserves no slot while waiting for its page. Releasing a queued resource cancels it before I/O. Closing the view discards waiting and late results, with each group reporting successfully loaded items on its own progress callbacks.

Read device and stage settings through `egret.Capabilities` and `egret.MainContext.instance.stage`. The browser reports the selected backend (`webgl` for WebGL2), platform and mobile status. The Android GLES3 player reports `native`, `Android`, `true` and `gles3` for runtimeType, os, isMobile and renderMode. `RuntimeType.RUNTIME2` identifies the historic 2.0 SDK. Stage width and height use logical game units. `stage.orientation` reports the mounted orientation policy (`auto`); the actual browser space may rotate independently. Change fit when creating the view. Reassigning the same policy is allowed, switching a mounted policy raises `LEGACY_SCREEN_POLICY_FIXED`. Native layouts follow their fixed design and the player's letterboxing. When a view closes, its main-context stage becomes `null`.

In Windows Edge 158 with WebGL2, resizing a fixed-width game's viewport from 720 × 440 to 390 × 844 and back changed its logical stage from 320 × 195 to 320 × 692 and back. The engine sent a resize event for each change, and the mounted policy remained `auto`.

Browser `egret.log/warn/error` forward the original arguments to the console. On Android, pass a `logger` to `openLegacyAndroid` to route them to a project sink. The normal close receipt records per-level counts. With `captureLogs: true` it also retains up to 32 local messages, 256 characters each. The app owns redaction before enabling message capture.

Migrated browser and Android clients expose the same classic timing API through `egret`. Durations are milliseconds. `new egret.Timer(500, 3)` sends `egret.TimerEvent.TIMER` while running and sends `TIMER_COMPLETE` after its third tick. `stop()` retains the count, `start()` begins a fresh interval, and `reset()` clears the count. Changing `delay` while running resets the nominal frame budget. A long frame fires at most once, as in Egret 5. The timer checks elapsed game time and Egret 5's nominal 60 Hz cadence.

```js
const countdown = new egret.Timer(500, 3);
countdown.addEventListener(egret.TimerEvent.TIMER, this.updateCountdown, this);
countdown.start();

const handle = egret.setInterval(this.refreshPrices, this, 2000, 'market');
egret.clearInterval(handle);
egret.setTimeout(this.restock, this, 250, 'north');
egret.callLater(this.relayout, this);
```

`setTimeout` and `setInterval` preserve the receiver and trailing arguments. Each has its own numeric handles and corresponding clear function. Repeating callbacks fire at most once per tick and begin a fresh delay after a late frame. `callLater` processes the current queue after this adapter's timed callbacks. A nested `callLater` runs on the next tick. The game clock pauses these callbacks and resumes from a fresh anchor. Closing the game releases pending callbacks and prevents further scheduling. The vintage SDK's `getTimer()` remains wall-clock time since the binding started and includes pauses.

`getQualifiedClassName`, `getQualifiedSuperclassName`, and `is` read classic reflection metadata written by the original compiler or `registerClass`. Register named interfaces with `registerImplementation('eui.IAssetAdapter', adapter)` and retrieve the current value with `getImplementation`. Each running game owns a separate registry. Registration alone does not connect a particular game or channel provider to an asset load.

Run `node --test tests/egret-migrate-clock.test.mjs`. To include the 5.x reference comparison, set `EGRET_LEGACY_MODULES` to a trusted SDK's `libs/modules` directory containing `egret/egret.js` and `game/game.js`. The reference scripts execute only for this opt-in comparison. The tests compare event order, counts, pause, clear, callback arguments, deferred nesting and named type lookups. Live game server timing and channel SDK integration need separate acceptance.

Both migrated hosts expose `egret.getTimer()`, `egret.Tween`, `egret.Ease` and `egret.getDefinitionByName()`. The timer returns elapsed wall-clock milliseconds from binding initialization, including pauses. Property tweens advance on the game's existing clock and stop with its scope. They accept the engine's scaled and bounded tick intervals.

```js
egret.Tween.removeTweens(pin);
egret.Tween.get(pin, { loop: true })
  .to({ alpha: 0.3 }, 160, egret.Ease.sineInOut)
  .wait(40)
  .to({ alpha: 1 }, 160)
  .call(onPulse, panel, [pin]);
const Scene = egret.getDefinitionByName('market.Shop');
```

The adapter supports `get`, `removeTweens`, `removeAllTweens`, `to`, `wait`, `set`, `call` and `setPaused`, including the `paused`, `override` and `loop` options. It interpolates numeric properties and applies discrete values at the end. Multiple actions crossed by one update run in their original order. Linear, quadratic, cubic, quartic, quintic, sine and circular curves support in/out/in-out variants where applicable. Applications using timeline seeking, plugins, onChange events, tick-based duration or independent advancement through global pause still require adaptation.

A name resolves to its registered class, a known EUI custom control or precompiled skin constructor, or an own definition in the loaded classic namespace. Missing definitions return `null`. Explicitly register closure-local classes with `egret.registerClass(Shop, 'market.Shop')` before using their names. A static EXML descriptor alone has no constructor to return.

The original 5.3.10 tween library and the adapter agreed at nine sampled observations over a chained move, wait, callback, loop and removal, and at 30 easing samples. The source-only commercial survey found 93 `Tween.get` uses, 137 `removeTweens` uses and 19 loop settings. These are counts of references in the surveyed project.

Reproduce the independent courier sample by compiling its original TypeScript and packaging the exact output as `courier.js`. The last preparation step verifies the compiler receipt and digest.

```sh
node tools/egret-migrate/bin.mjs compile-classic --source runtime-sdk/examples/legacy-courier/original --compiler <trusted-typescript.js> --groups runtime-sdk/examples/legacy-courier/original/groups.json --target es2015 --out ./courier-code
node runtime-sdk/examples/legacy-courier/prepare.mjs ./courier-game --classic-build ./courier-code
```

## Use the same legacy entry in the Android player

Import `openLegacyAndroid` from `@egret/legacy/android` and return its result from the player project's `create(services)`. Pass the fixed stage dimensions, portable project ID, classic script group name, entry class name, compiled theme, RES configuration and image bindings. The adapter installs Egret, EUI and RES before evaluating that group. The display tree, pointer routing, asset leases and native text pages belong to the current player view. Closing removes this view's bindings. A paused touch cannot activate a button on resume. The game can change routes, levels and screens within this session. To restart the whole game, close its player view and create a new one with the same application and project identity. A classic script group runs once per V8 isolate. Calling `openLegacyAndroid` again in that isolate raises `LEGACY_ANDROID_NEW_VIEW_REQUIRED` before registering globals or reserving resources.

For a project-owned precompiled theme, enable EUI using its static descriptor (or `{ skins: {}, exmls: [] }`). Use `prepareTheme` to load the reviewed registry group and any custom class dependencies, then install the factories on that same EUI host. The player awaits this step before loading the business group and constructing the first control. The independent Edge factory comparison exercises generated skin constructors. The Fold7 courier run described below uses compiled static EXML.

```js
import { registerLegacyThemeFactories } from '@egret/legacy/theme-factories';

async function prepareTheme({ eui, egret }) {
  await EgretRuntimeScripts.loadGroup('theme');
  registerLegacyThemeFactories(eui, themeManifest, { egret });
}
// Include prepareTheme in the options passed to openLegacyAndroid.
```

Declare PNGs by their packaged path, dimensions and native page ID (1–223). Also list the PNGs and JSON files in the player project's assets. For example, bind `{ url: 'north.png', page: 1, width: 8, height: 8 }` to the image resource whose URL is `north.png`. Local JSON comes from the packaged resource reader. The native text cache distinguishes the font family, weight, italic style and outline. One page supports up to 1,048,576 pixels. Review the conversion's unsupported types and remaining host calls for each original game.

After preparing the [courier example](../../../runtime-sdk/examples/legacy-courier/main.mjs) with the preceding commands, use a trimmed V8 player AAR built from the matching SDK:

```sh
node runtime-sdk/android/player/create-app.mjs --project ./courier-game --aar <trimmed-player.aar> --esbuild <esbuild-module> --id org.egret.sample.courier --layout embedded --out ./courier-app
gradle -p ./courier-app assembleDebug
adb install -r ./courier-app/build/outputs/apk/debug/EgretGame-debug.apk
adb shell am start -n org.egret.sample.courier/org.egret.example.LibraryActivity
```

Open the game and press the route button. The heading changes from 北门驿站 to 南门渡口, the marker changes from blue to orange and the saved route becomes 1. Windows Edge 158 and a Galaxy Z Fold7 running trimmed V8 15.7.112.19 used identical 2,365-byte output from the Egret TypeScript-Plus compiler. Both reported the same selection, Chinese heading, marker width, stored value, loaded route and control count before and after the press. The captured orange marker occupied 2,209 pixels on the desktop and 48,400 display pixels on the phone at their respective scales. The browser closed with zero leases. In the same Android activity, closing the first view and opening a new one restored route 1 (南门渡口). The next press returned to 北门驿站 and saved 0. At each close the phone released all five published pages, retained zero text bytes and reported zero abandoned uploads. This sample used bundled local data and injected pointer input; it exercises neither a live game server nor a channel SDK.

## Programmatic layouts, blend modes and rich text

A migrated board can assign `new eui.HorizontalLayout()`, `new eui.VerticalLayout()` or a row-major `new eui.TileLayout()` to `group.layout`. Changing the gap, padding or supported alignment reflows the group. TileLayout accepts equal cells and a requested column count. Set `scroller.viewport` to the group, then set `scrollPolicyH` and `scrollPolicyV` to `eui.ScrollPolicy.AUTO`, `ON` or `OFF`. Horizontal and vertical drags use the clipped viewport, including its empty trailing edge. Inertial scrolling, elastic overshoot and general virtual tile renderers need separate migration. `egret.BlendMode.ADD` and `NORMAL` use the engine's shared material in display order. Scripted touch dispatch preserves the target's local coordinates in capture, target and bubble listeners.

For a Chinese link in a read-only `egret.TextField`, assign parsed text or an array of legacy text elements. Set `touchEnabled` and listen on the field. A link fires after its visible layout has committed. Its event's `text` contains the part following `event:`. Replacing the content, removing the field, or closing the view retires its text pages.

```js
const title = new egret.TextField();
title.width = 240;
title.size = 20;
title.touchEnabled = true;
title.textFlow = new egret.HtmlTextParser().parser(
  '<a href="event:open:gate"><font color="#18f570"><b>北门</b></font></a><font color="#ff9840">驿站</font>'
);
title.addEventListener(egret.TextEvent.LINK, event => visit(event.text), this);
```

The reader supports nested `font`, `b`, `i`, `u` and `a`, literal newlines, five named XML entities, event links, font size and family, fill and outline. Read-only EUI Labels also use their arranged box. Each fragment uses host font measurement, the existing text raster/cache and engine scope. Admission allows 256 source runs, 16,384 UTF-16 units and 256 wrapped fragments per field. Visible fragments share the host's existing text-page budget, including pages used by other labels. The native cache exposes refusal, release and size counters when that budget is reached. External URL navigation, arbitrary HTML, mixed-direction shaping across style boundaries and editable rich text require a separate implementation.

The [layout board](../../../runtime-sdk/examples/legacy-layout/board.js) loads an original PNG, a UTF-8 caption and binary data through `RES.getResByUrl`. Its green control cycles the layouts and blend modes. Drag the horizontal panel twice, starting the second drag on its empty edge. Tap the orange caption and the green linked characters. Only the green link opens the gate.

```sh
node runtime-sdk/examples/legacy-layout/verify-browser.mjs --engine <egret2d.mjs> --playwright <playwright/index.mjs> --channel msedge --out ./edge-board-evidence
node runtime-sdk/android/player/create-app.mjs --project runtime-sdk/examples/legacy-layout --aar <trimmed-player.aar> --esbuild <esbuild-module> --id org.egret.sample.layout --layout embedded --out ./layout-app
gradle -p ./layout-app assembleDebug
adb install -r ./layout-app/build/outputs/apk/debug/EgretGame-debug.apk
adb shell am start -n org.egret.sample.layout/org.egret.example.LibraryActivity
```

On Windows Edge 158, WebGL2 ran on an RTX 5090 Laptop through ANGLE D3D11. The 320 × 180 capture contained 228 green and 224 orange glyph pixels above the fixture's color thresholds. On a Galaxy Z Fold7, Android 17 with trimmed V8 15.7.112.19 and GLES3 produced 4,892 and 6,099 at the phone's display scale. Both hosts emitted one `open:gate` after a tap on each color and reported `north-gate-board` from the injected project resource method. The red/blue overlap sampled magenta, red and magenta across the three modes. The Fold7 released all three uploaded pages on close, including two text pages. Text occupied zero bytes and abandoned uploads were zero. Input on the physical devices was injected. The original Egret 5 parser and dispatcher matched three independent markup samples and the non-bubbling link event payload in Edge.

## Classic textures and shared atlas pages

A single-page RES image and an admitted packed frame are `egret.Texture` objects. `new egret.SpriteSheet(page).createTexture(name, x, y, width, height, offsetX?, offsetY?, textureWidth?, textureHeight?)` borrows the existing GPU page. Nested crops use the base frame's packed origin and trim. Reusing a name replaces its lookup while existing bitmaps keep their frame. A sheet owns up to 2,048 live child textures, including replaced names. Dispose a child to make room. Disposing a sheet releases its child crops. RES owns its pages until `destroyRes` or game close.

```js
const page = await RES.getResAsync('buttons_png');
const sheet = new egret.SpriteSheet(page);
const icon = sheet.createTexture('accept', 2, 0, 2, 2);
const button = new egret.Bitmap(icon);

egret.BitmapData.create('base64', pngBase64, data => {
  const texture = new egret.Texture();
  texture.bitmapData = data;
  button.texture = texture;
  // When the view no longer needs the dynamic image, call texture.dispose().
});
```

`BitmapData.create` accepts a PNG as plain Base64 or an ArrayBuffer. Both hosts accept up to 64 KiB compressed, 4,096 pixels per side and 1,048,576 decoded pixels. The callback runs after the asset is ready. In a browser, `new egret.BitmapData(loadedImage)` also accepts a readable same-origin image or canvas. Native games use the packaged PNG or byte API. Android dynamic PNG pages share the player's existing allocator with text and occupy slots 224–255. Actual availability depends on active pages. Encoded JPEG/GIF, general GPU render-to-texture, and slicing across multiple physical pages remain outside this API.

Run `node --test tests/egret-migrate-textures.test.mjs`. A generated 4 × 2 PNG was exercised in Windows Edge 158 (RTX 5090 Laptop, WebGL2) and on a Fold7 (Android 17, trimmed V8 15.7.112.19, GLES3). Both displayed the red crop from RES and the green crop decoded from bytes. Four Edge samples matched exact RGB values, including an already-loaded HTML image. The Fold7 released both native pages at close.

### Tabs, progress skins and bitmap scores

`eui.TabBar` accepts an `eui.ArrayCollection`, selects the first item when required, and uses a nonvirtual horizontal row with justified widths by default. A tab still uses its own renderer and skin. ViewStack-backed synchronization requires a separate adapter. Assigning `egret.TextField.default_fontFamily` changes the family for subsequently constructed text fields and EUI labels. Existing labels retain their chosen family. Listen to `eui.UIEvent.MOVE` on the component. A real change to `setLayoutBoundsPosition(x,y)` emits one non-bubbling event; direct x/y assignments coalesce on the host clock.

`eui.ProgressBar` consumes the `thumb` and `labelDisplay` skin parts. Set `minimum`, `maximum`, `snapInterval`, `value`, `direction` or `labelFunction` as needed. `slideDuration = 0` shows changes immediately. A positive duration uses the shared game clock. In the independent old-runtime comparison, a 120-unit row arranged 20/40/20-unit tabs as 30/60/30. A right-to-left bar set to 43 of 80 with a five-unit step reported 45 and clipped its thumb to the last 68 units. The same cases pass on the migration host.

For a bitmap score, declare an Egret single-page JSON `.fnt` as `type: "font"` in RES. Its local PNG is included when converting. A regular image alias may share that PNG. Add `--with bitmapfont` to the usual `node tools/pack-single-file.mjs` build and pass that edition to the browser converter. npm/ES-module hosts can supply `createBitmapText` and `parseBitmapFont` from `@egret/engine/bitmapfont` in the same engine graph. The classic Android adapter includes these operations. A loaded font owns one image lease. `eui.BitmapLabel.font` accepts its RES name or the loaded value. Explicitly releasing the font removes the attached meshes. After reacquisition, assign the new font to the label.

```js
await RES.loadGroup('board');
const score = new eui.BitmapLabel('12');
score.font = 'digits';
this.addChild(score);
```

Run `node runtime-sdk/examples/legacy-bitmap-score/verify-browser.mjs --engine <font-enabled-egret2d.mjs> --playwright <playwright/index.mjs> --out ./score-evidence`. To run the Android sample, use the layout APK command above with `--project runtime-sdk/examples/legacy-bitmap-score`. Tap the orange button twice to release and reload the font. Edge 158/RTX 5090 Laptop and Fold7/GLES3 matched all five pixel probes before release, after release and after reload, including the trimmed glyph origin, clipped edge and direction of the progress bar. The two glyphs measure 8 × 5 including transparent advances, then 0 × 0 on font release and 8 × 5 after reacquisition. Egret 5.3.10, Edge and Fold7 agree on the loaded dimensions. Fold7 recorded two uploads, two releases and zero abandoned uploads. All 37 supplied legacy font descriptors parsed and 455 glyphs had paired pages. Multiline spacing for mixed source heights, missing glyphs/spaces, and OS font substitution remain separate fidelity checks. The custom single-line score is the verified workload.

## Text-only RenderTexture

Use `new egret.RenderTexture().drawToTexture(container, clip, 1)` for a translated tree of read-only TextFields and plain DisplayObjectContainers. It captures text, position, color and type style immediately, even off stage. Later mutations of the source take effect on the next drawToTexture. Within a 2,048 × 2,048 logical page, existing named SpriteSheet crops keep their identity and update to the new snapshot when displayed. The host rasterizes only referenced crops. Empty crops use no texture. A stale or released bitmap cannot publish an earlier raster over a new one.

```js
const target = new egret.RenderTexture();
const clip = new egret.Rectangle(0, 0, 2048, 2048);
target.drawToTexture(labels, clip);
const atlas = new egret.SpriteSheet(target);
// Egret 5 WebGL packed a render target from the bottom edge.
const title = atlas.createTexture('title', 32, 2048 - 22 - 34, 40, 34);
const bitmap = new egret.Bitmap(title);
labels.removeChildren();
```

Logical crops use untrimmed rectangles of at most 1,048,576 pixels. Draw accepts up to 1,024 visited nodes, 256 measured fragments and 8,192 UTF-16 code units. Rich fill, typeface and outline reuse the host text path. Underlines, masks, non-translation transforms, arbitrary graphics, nested crops of logical crop textures, and embedded bitmaps require other rendering paths. Reading pixels or exporting the entire logical atlas is outside this profile.

On the same Windows Edge 158 hardware, the original 5.3.10 WebGL viewport showed colored ink at (4, 4)–(29, 20) inside a 40 × 34 bottom-origin crop. The migrated WebGL2 path produced (4, 5)–(29, 21). The corresponding top-origin crop remained blank in both runs. Repainting the same crop changed red to green, preserving position and orientation. Edge antialiasing differed by renderer and color. On the Fold7 GLES3 player the red and green ink occupied the same physical bounds, (625, 421)–(734, 498), and closing released both uploaded text pages with zero abandoned uploads.

### ImageLoader

Set `egret.ImageLoader.crossOrigin = 'anonymous'` before loading a browser image from another origin. An instance can override the default. The remote server must return an appropriate CORS header. The engine's existing image loader reads and decodes the image. On Android, supply a PNG path in the application's declared image bindings. A successful request sets `loader.data` to a `BitmapData` and dispatches `complete`. An unreadable image dispatches `ioError`. Assign the data to `texture.bitmapData` to display it. A subsequent `load()`, the compatibility adapter's `close()`, and owner close suppress outdated events. A shared read can finish for other consumers; the retired caller releases its lease.

Edge 158 made two requests to a separate loopback origin without sending its test cookie. The server's missing CORS header produced an error, and allowing anonymous reads loaded a 4 × 2 PNG. The Fold7 reported the same failure/success sequence for an undeclared and a declared image. A request replaced before admission emitted no event. Declared package reads shared their texture page with RES.

### State-only children and generated bindings

An Egret 5.3.10 release factory may emit `eui.AddItems` for `includeIn` and `eui.Binding.$bindProperties` for `text="{data.name}"`. The generated-factory adapter resolves the original child and sibling at state entry. It supports first, last, before and after insertion in a named container or the skin host. The same part can leave and re-enter multiple times. A part explicitly moved to a different parent remains there on state exit. Closing the view also disposes its detached state-only parts.

Bindings starting at `hostComponent` can follow a changed `data` object or a property of that object. Template literals and observed values combine using the original JavaScript addition rules. Leaving the stage releases observers and re-entering reads the current model. Generated calls with unsupported paths report a factory error. The covered entry is the reviewed generated skin provider. Arbitrary application calls into the internal Watcher API require separate coverage.

`tests/fixtures/migrate-theme-factories/Dispatch.exml` and `dispatch.thm.json` contain an editable sample and the factory generated from it with the original compiler. Run `node --test --test-name-pattern "5.3 generated state" tests/egret-migrate-eui.test.mjs`. Original 5.3.10 and Edge 158/WebGL2 followed the same five observations. Opening inserted the caption before its sibling and the badge after the root group. Closing and reopening restored both in the same order. Reattaching with a new model displayed the new caption and count. The Egret 7 run also verified observer removal and disposal of the hidden parts.

For a browser game with an editable field, build its single-file engine with `--with text-input`. Use `--with bitmapfont,text-input` when the same game also uses bitmap fonts. A module consumer can supply `createBrowserTextInput` from the optional `@egret/engine/web/text-input` entry alongside its game functions. The Android player uses its native editor.
