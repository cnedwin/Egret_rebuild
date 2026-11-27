# Optional Egret 5 packet compatibility

[简体中文](README.zh-CN.md)

Egret Migrate includes this module in converted browser games. Existing packet subclasses can extend `egret.ByteArray` and choose `egret.Endian.LITTLE_ENDIAN`. Another host can install the local package (`npm install ./tools/egret-migrate` from a checkout) and import `{ ByteArray, Endian } from '@egret/legacy/protocol'`. This module has no dependencies and uses neither DOM nor host text codecs.

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

Import `openLegacyAndroid` from `@egret/legacy/android` and return its result from the player project's `create(services)`. Pass the fixed stage dimensions, portable project ID, classic script group name, entry class name, compiled theme, RES configuration and image bindings. The adapter installs Egret, EUI and RES before evaluating that group. The display tree, pointer routing, asset leases and native text pages belong to the current player view. Closing removes this view's bindings. A paused touch cannot activate a button on resume.

Declare PNGs by their packaged path, dimensions and native page ID (1–223). Also list the PNGs and JSON files in the player project's assets. For example, bind `{ url: 'north.png', page: 1, width: 8, height: 8 }` to the image resource whose URL is `north.png`. Local JSON comes from the packaged resource reader. The native text cache distinguishes the font family, weight, italic style and outline. One page supports up to 1,048,576 pixels. Review the conversion's unsupported types and remaining host calls for each original game.

After preparing the [courier example](../../../runtime-sdk/examples/legacy-courier/main.mjs) with the preceding commands, use a trimmed V8 player AAR built from the matching SDK:

```sh
node runtime-sdk/android/player/create-app.mjs --project ./courier-game --aar <trimmed-player.aar> --esbuild <esbuild-module> --id org.egret.sample.courier --layout embedded --out ./courier-app
gradle -p ./courier-app assembleDebug
adb install -r ./courier-app/build/outputs/apk/debug/EgretGame-debug.apk
adb shell am start -n org.egret.sample.courier/org.egret.example.LibraryActivity
```

Open the game and press the route button. The heading changes from 北门驿站 to 南门渡口, the marker changes from blue to orange and the saved route becomes 1. Windows Edge 158 and a Galaxy Z Fold7 running trimmed V8 15.7.112.19 used identical 2,365-byte output from the Egret TypeScript-Plus compiler. Both reported the same selection, Chinese heading, marker width, stored value, loaded route and control count before and after the press. The captured orange marker occupied 2,209 pixels on the desktop and 48,400 display pixels on the phone at their respective scales. The browser closed with zero leases and the phone released all five published pages. This sample used bundled local data and injected pointer input; it exercises neither a live game server nor a channel SDK.
