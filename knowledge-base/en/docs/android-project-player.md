# Android project player

English | [简体中文](../../Cns/docs/android-project-player.md)

Package a trusted JavaScript or TypeScript game as an Android app, or attach the game to a view inside an existing Activity. Both paths use the same arm64 Android library. By default, Android System WebView executes the bundled scripts. Projects that use the player services can also choose [embedded V8](android-project-player-v8.md). The visible game surface is a `GLSurfaceView` rendered by Rust using OpenGL ES 3. The library declares Android API 26 as its minimum and ships arm64 code for GLES3. The script runtime separately requires a recent Android System WebView with ES2022 and AbortController. Device evidence below applies to the configurations actually exercised.

## Build the library and a game

Run these commands from the engine checkout. Use Node 26.7.0, pnpm 11.25.0, JDK 17, Android SDK Platform 35, Build Tools 35.0.0, NDK r27c and Rust with the `aarch64-linux-android` target. Set `JAVA_HOME`, `ANDROID_HOME` and `ANDROID_NDK_HOME`. Keep the matching Rust installation's `share/doc/rust/COPYRIGHT-library.html` available. Provide the path to an installed esbuild **0.28.2** module for the game export.

```sh
pnpm install --frozen-lockfile
pnpm run build
node runtime-sdk/android/player/build-aar.mjs --out out/egret-player.aar
node runtime-sdk/android/player/create-app.mjs --project runtime-sdk/examples/moon-herbarium --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.herbarium --layout standalone --out out/herbarium
gradle -p out/herbarium assembleDebug
```

The generated Gradle application uses Android Gradle Plugin 8.7.3. Run it with a compatible Gradle installation, or open the generated directory in Android Studio. Find the debug APK under `out/herbarium/build/outputs/apk/debug/`. Use `--layout embedded` and a new output directory for an Activity with native controls that opens, closes and reopens a child game view. The consumer owns its application ID, manifest, signing configuration and release build. A prebuilt Rust archive from this source can be supplied to the AAR builder with `--rust-lib` and `--rust-notice`.

## Export an external game

Pass the full path of your game directory to `--project`. The project can live outside the engine checkout. Its `project.json` declares logical stage dimensions, the local HTML entry, the JS or TS script, packaged images and additional files. Here is a complete descriptor for a game that draws rectangles and loads no external assets.

```json
{
  "width": 360,
  "height": 640,
  "entry": "index.html",
  "script": "main.ts",
  "pages": [],
  "assets": []
}
```

Use `<script src="./game.js"></script>` in `index.html`. The exporter bundles the script and its imports into `game.js`. For image files, add entries such as `{"id":1,"src":"assets/herbs.png","width":240,"height":60}` to `pages`. List short sound files and other runtime assets under `assets`. The game loads its resources, creates engine textures and publishes their image identities. The packaged Moon Herbarium game shows two PNG pages, rasterized Chinese text, an animated character, a clipped list, touch/scroll, a native name editor and a sound effect when an order is filled.

```ts
import { Sprite } from '@egret/engine';
import { installPlayerProject } from '@egret/android-player-project';

installPlayerProject({
  width: 360, height: 640, clearColor: 0x18281d,
  create({ engine, scope }) {
    const marker = scope.use(new Sprite());
    marker.graphics.beginFill(0xc8e9bd, 0.75).drawRect(20, 30, 96, 44).endFill();
    engine.stage.addChild(marker);
    return { input(event) { if (event.type === 'up') marker.x = event.x - 68; } };
  }
});
```

Use `@egret/engine` types and include `runtime-sdk/project/android-player-project.d.ts` or a copy in the game's `tsconfig.json`. The exporter resolves `@egret/android-player-project` to the adapter in this source tree. Each player owns an Engine and Scope. Pass the supplied `signal` into asynchronous loading. `publishPage(id, image)` binds the same `ImageData2D` used by the texture to a slot from 1 through 255. Its handle has an idempotent `release()`. `edit(text)`, `playSound(assetPath)` and `state(value)` call the Android services. A game can implement `input`, `update`, `pause`, `resume`, `close` and `closedSnapshot`. Input carries stage coordinates, pointer ID and movement, or edited/submitted text. `update(elapsedMs)` receives foreground time. The engine clock advances by at most 100 ms per turn and starts a fresh baseline after resume.

## Embed in an existing Activity

Copy the AAR to the app module's `libs/egret-player.aar` and add `implementation files('libs/egret-player.aar')` to its Gradle dependencies. Export into a fresh directory under that module's assets. Replace the example paths with the existing module, game and bundler locations.

```sh
node runtime-sdk/android/player/export-project.mjs --project /projects/my-game --esbuild /path/to/node_modules/esbuild --out /projects/my-app/app/src/main/assets/game
```

Construct `new org.egret.runtime.player.EgretPlayerView(activity, "game", listener)` on the main thread and add it to a layout. Forward Activity `onResume()` and `onPause()` to the view. Call `close()` when retiring it. Wait for `listener.onClosed()` before opening a replacement. `onReady()` acknowledges the first successful native submission. `onError(String)` reports failures and `onState(String)` receives game-supplied JSON. `getDiagnostics()` returns a snapshot of session counters and the project close receipt. The complete Activity implementations are in `runtime-sdk/android/player/consumers/`.

## Rendering scope and evidence

The player draws up to 4,096 rectangles and image quads per frame in capture order. It supports affine transforms, neutral material colors, normal source-over, translucent fills and textures, nearest sampling, and intersecting axis-aligned clips. The native executor composites in linear premultiplied color and resolves to display sRGB. The view fits the opaque logical stage to its available area and maps input to stage coordinates. Meshes, effects, rotated clips and other blend or filtering policies are outside this draw profile.

### Packed sprite sheets and animation frames

Sprite sheets and sequence animations describe the original canvas with `sourceWidth` and `sourceHeight`, the trimmed image position with `trimX` and `trimY`, and clockwise packing with `packedRotation` (0° or 90°). For a region with any of the four quarter-turns, use `createTextureView` with `quarterTurn` set to 0, 1, 2 or 3. Position and scale the bitmap using the original logical dimensions. The player keeps the trimmed margins transparent and selects the nearest logical texel before mapping it into the packed image. These rules also apply when the bitmap is mirrored or switches animation frames. Page-domain sampling requires a whole, untrimmed, unrotated page.

Build the player AAR and export the game from the same revision when using mapped atlas frames. Ordinary frames still produce EGR2 bytes. Frames containing mapped draws use EGR3, which appends a 24-byte entry per mapped quad after the usual 64-byte records. Each entry identifies the draw ordinal, logical size, trim offset and quarter-turn. Both packet types use the same uploaded texture and can occur in the same capture and replay. Older player libraries require EGR2 project frames.

On a Galaxy Z Fold7, a test game exchanged each packed sprite with an independently expanded bitmap at the same screen position. All 581,256 sampled pixel pairs matched per tested script host, across four rotations, mirroring, clipping and half-pixel placement. Drawing the two images at different screen positions produced 18 differing samples per rotation in the half-pixel row. Exchanging the textures showed that the discrepancy followed the screen position. The record includes the capture, replay and resource checks. [Fold7 atlas measurements](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-atlas.json)

The Rust unit checks cover packet validity, resource IDs, alpha conversion, clip rounding and EGR1 compatibility. JavaScript checks also capture a real Engine with two leased pages and change its visible page set. A Windows offscreen EGL 1.5 test used ANGLE SwiftShader to read all 48 pixels of a small composite. Half-white over black returned RGBA (188,188,188,255), an overlapping translucent red page returned (224,137,137,255), and the second opaque green page returned (0,255,0,255). A mirrored atlas edge retained its own texel. A transparent clear resolved to (128,0,0,128). These are desktop software-renderer observations.

On 19 November 2026 both Gradle apps ran on a Galaxy Z Fold7 with Android 17, System WebView 157 and Adreno 830. The six game files and the native renderer matched byte for byte across the two APKs. In both apps, injected taps filled a prescription, a drag scrolled the list, the Android keyboard opened, and the sound player started and released one effect. After background and resume, the second EGL context restored four pages. Comparing the static inventory region against its pre-background screenshot gave zero changed pixels out of 152,106 in the standalone game and 103,500 in the host. The host closed the game with all 14 logical textures released, kept its native controls and opened a fresh game. The local debug builds measured 701,200 bytes for the AAR, 1,767,567 for the standalone APK and 1,767,575 for the host APK. These profiles share the installed System WebView. Frame speed, audible output and human IME composition were outside this run. [Device and artifact record](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-player.json)

The earlier EGR1 specimen has separate optional Javet/V8 builds with and without Intl, along with its frozen replay and Galaxy Z Fold7 timing/PSS measurements. Those results describe the original specimen and its script hosts. The measurements above used the default System WebView AAR. [Earlier specimen and measurements](runtime-sdk-v8-fold7.md)

The project adapter, Android view, Rust renderer and sample are first-party contributions. The AAR includes project LICENSE/NOTICE and the Rust library, NDK/toolchain and robust-predicates notices under `assets/egret-player-licenses/`. Keep these packaged notices and the applicable licenses for each game's assets when distributing an app.
