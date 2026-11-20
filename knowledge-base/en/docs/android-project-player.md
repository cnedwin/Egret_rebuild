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

## Save and resume a game

Pass the project's `storage` service to the existing `createSaveStore` API. System WebView and both V8 profiles read the same Android app-private files. The Android application and the game view's case-sensitive asset root identify the game. Keep the root stable across updates and host changes. Two roots in one application can both use the key `progress` independently. Clearing the application's data clears its local saves. Build the AAR and export the game with save support. An older AAR reports an unsupported storage operation on first use.

```ts
import { createSaveStore } from '@egret/engine/kit';
import { installPlayerProject } from '@egret/android-player-project';

installPlayerProject({
  width: 360, height: 640, clearColor: 0x18281d,
  create({ storage, state }) {
    const progress = createSaveStore({
      key: 'progress', version: 1, storage,
      defaults: () => ({ level: 1 })
    });
    return {
      input(event) {
        if (event.type === 'up') {
          const saved = progress.save({ level: progress.data.level + 1 });
          state({ checkpointSaved: saved });
        }
      }
    };
  }
});
```

Open the store with the same key on the next launch. For a schema change, raise `version` and supply `migrations[n]` to convert version `n` to `n + 1`. The store writes the migrated value back and reports read or write problems through `onProblem`.

Save at checkpoints while the view is active. An acknowledged `save()` has already replaced the previous file atomically. A failed save returns `false` and the store can still contain the new data in memory. If Android stops the process during replacement, the next launch reads the complete old or new checkpoint. A first write interrupted before commit leaves the slot empty. Closing the view rejects new storage operations and delivers `onClosed` after admitted operations finish.

Each stored string, including the save envelope, can occupy up to 1 MiB in UTF-8. The low-level keys accept 1–256 UTF-16 code units and `createSaveStore` accepts keys up to 200 units. Storage calls are synchronous on the script path. Schedule writes at progress checkpoints to keep filesystem work out of the frame loop.

On a Galaxy Z Fold7, System WebView, standard V8 and trimmed V8 took turns running the same signed application. After force-stop and cold launch, two games using the key `progress` kept their own checkpoints. Across host changes, game A advanced from 1 to 2 to 3 while game B advanced from 10 to 20 to 30. Each host migrated a separate v1 checkpoint to v2 exactly once and read the new version on the next launch. All three read back a 1 MiB UTF-8 string containing Chinese text and an emoji, rejected one extra byte and retained the old value.

A separate diagnostic build paused a real write after the temporary file was synced and before the atomic replacement. Killing the process at that point preserved the previous checkpoint on all three hosts. Closing the game view at the same point allowed the accepted write to finish: the game reported success, the replacement preceded `onClosed`, and a fresh process read the exact new file. [Fold7 save measurements](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-saves.json)

## Read a packaged level

List the file in `project.json` under `assets`, for example `"assets": ["levels/harbor.json"]`. Save it as UTF-8. A level can choose an atlas frame by name:

```json
{"关卡":"雾港🌙","图集帧":"lantern","对白":"沿河向东。"}
```

Inside the project factory, with a loaded sprite sheet called `sheet`:

```ts
const text = await services.assets.readText('levels/harbor.json', services.signal);
const level = JSON.parse(text);
const sprite = sheet.createBitmap(level['图集帧']);
services.engine.stage.addChild(sprite);
```

System WebView and both embedded V8 profiles use the same API. Pass an optional `AbortSignal` to cancel a particular request. Closing the project cancels its outstanding reads even if the caller omitted the signal. An aborted read rejects with the signal's reason. A new game view owns a separate set of requests.

Each read accepts up to 256 KiB of encoded data. One leading UTF-8 BOM is removed. Empty files return an empty string. The path must be a declared, project-relative asset, with the same spelling and case as the packaged file. A missing or undeclared file rejects with `NotFoundError`, malformed UTF-8 with `EncodingError`. Invalid paths such as `../level.json` reject with `TypeError`. A size or concurrency limit rejects with `RangeError`. Inspect `error.name` when handling these failures. Each session admits up to eight outstanding reads. Build the AAR and export the game with a version that implements this service.

On a Galaxy Z Fold7, the same UTF-8 level selected the lantern sprite in System WebView, standard V8 and trimmed V8. Each host also reported a missing packaged file and an undeclared path, cancelled a pending read and successfully retried. Closing during the first read produced no game frame or texture upload. Reopening displayed the expected sprite. The test Activity held the I/O queue to make the two pending-read cases reproducible. [Fold7 results and pixel comparison](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-text-assets.json)

## Read a binary level

List the file under `assets` in `project.json`, for example `"assets": ["levels/harbor.bin"]`. Call `readBytes` on the same project service as `readText`. Each successful read returns a fresh `Uint8Array` containing the exact bytes in the package, including zero bytes, a leading BOM or invalid UTF-8. An empty file yields an array of length zero.

This level uses the four ASCII bytes `EGB1` as its signature. The next byte selects an atlas frame. The layout belongs to the game.

```ts
const bytes = await services.assets.readBytes('levels/harbor.bin', services.signal);
if (bytes.length < 5 || bytes[0] !== 0x45 || bytes[1] !== 0x47 ||
    bytes[2] !== 0x42 || bytes[3] !== 0x31) throw new Error('Invalid level header');
const frame = ['gate', 'lantern'][bytes[4]];
if (frame === undefined) throw new Error('Unknown atlas frame');
services.engine.stage.addChild(sheet.createBitmap(frame));
```

`readText` and `readBytes` accept files up to 256 KiB and share the view’s eight request slots with chunk readers. Use the optional signal to cancel a read. Closing the view cancels its outstanding requests, and a reopened view starts with its own reader. The same manifest and path errors apply to both methods. This release carries binary results across the Android script bridge as Base64 during loading. Applications receive bytes. Build the AAR and export the game with a version supporting `readBytes`; a text-only player rejects a binary read with `NotSupportedError`.

On a Galaxy Z Fold7, each host checked all 196,613 bytes of the same packaged level and selected the lantern frame. The full 1080 × 1920 game surface matched the expected image on open and reopen. In the cancellation and close tests, the real APK stream supplied 8,192 bytes. A test wrapper then paused the second read before it requested more bytes from Android. The player interrupted the worker, the stream closed once and the byte count stayed at 8,192. Retry loaded the complete level. Closing during startup submitted zero frames and uploaded zero textures. These observations cover an active read at a controlled chunk boundary. [Fold7 binary asset results](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-binary-assets.json)

## Read a large packaged file

Declare the file in the same `assets` list. Use `services.assets.readChunks(path, signal?)` when the game can consume the data incrementally. This also works for small and empty files. For example, a level parser that accepts bytes incrementally can use the following loop.

```ts
for await (const bytes of services.assets.readChunks('levels/world.bin', services.signal)) {
  parser.append(bytes);
}
parser.finish();
```

The first pull opens the file. Each pull returns a fresh `Uint8Array` of up to 64 KiB. The final block can be shorter. End of file ends the loop, including for an empty file. Between pulls the reader holds one shared request slot and at most one native stream. A short final block closes the stream immediately. The next pull reports the end and frees the slot. It requests the next block only when the consumer calls `next()`. Await each pull before starting the next one. A simultaneous second pull rejects with `TypeError`. The bridge encodes one block at a time as Base64 and decodes it before returning the byte array. A parser that retains earlier blocks or assembles the whole file will use additional memory.

Breaking out of the loop releases the reader. When calling `next()` manually, use `return()` in a `finally` block on early exit. An abort signal or view closure also releases the reader, including between pulls. To retry, create a new iterator. Reading starts at byte zero. If the installed AAR lacks chunk support, the first pull rejects with `NotSupportedError`.

On a Galaxy Z Fold7, all three hosts checked the same 8,388,645-byte APK asset byte by byte. Opening, retrying after cancellation and reopening after view closure each produced 128 full blocks and a 37-byte tail. With the first block already delivered and 8,192 bytes read from the second, both cancellation and view closure interrupted the worker and closed its stream once. Initial and reopened images matched the expected 1080 × 1920 frame at every pixel.

| Process | Before reading, median PSS (KiB) | During reading, highest sampled PSS (KiB) | Samples during reading |
| --- | ---: | ---: | ---: |
| WebView app | 203,393 | 206,267 | 22 |
| WebView renderer | 33,438 | 41,839 | 22 |
| Standard V8 app | 208,031 | 222,846 | 30 |
| Trimmed V8 app | 210,492 | 224,655 | 31 |

Each host ran one additional scan after warm-up. The test consumer waited 100 ms after processing each block to allow process sampling. Android PSS counts each process’s proportional share of resident memory, including its runtime and rendering state. The WebView app and renderer peaks can occur at different times. The record includes the sampling intervals, RSS and post-read values. [Fold7 measurements](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-asset-chunks.json)

### Continuous reads on Galaxy Z Fold7

The player encodes each chunk in its existing arm64 library. It converts 48 input bytes at a time with NEON, handles the tail with scalar code, and returns exactly the Base64 ASCII bytes used to construct the Java string. Games continue to receive owned byte arrays.

The test used the same 8 MiB + 37-byte level as the preceding acceptance run. Both sides used the same non-debuggable, unminified QA consumer with the same signing key, script and compressed asset. The baseline used the previous Java encoder. Each host ran four adjacent pairs of fresh launches with both run orders represented. Each launch completed three warm-up scans after opening, followed by nine timed scans without delays between chunks. Each scan ended at EOF. The test retained that scan’s chunks and verified every byte after stopping its timer.

| Script host | Baseline (MiB/s) | Candidate (MiB/s) | Median paired change | Faster pairs |
| --- | --- | --- | --- | --- |
| WebView | 47.1 | 73.0 | +56.5% | 4/4 |
| Standard V8 | 103.9 | 117.4 | +14.9% | 4/4 |
| Trimmed V8 | 100.4 | 119.5 | +19.0% | 4/4 |

The next table gives milliseconds per file in separate instrumented runs, from baseline to candidate. The request/notification residual includes transport and scheduling outside the measured native span. The raw record also separates reader and owner queue time. Each column reports its own median.

| Script host | APK read | Base64 encoding and string construction | String retrieval over the bridge | JS Base64 decode | Request and notification residual |
| --- | --- | --- | --- | --- | --- |
| WebView | 8.1 → 7.0 | 58.7 → 27.6 | 54.7 → 45.0 | 11.6 → 9.9 | 22.1 → 21.3 |
| Standard V8 | 6.3 → 6.4 | 47.1 → 26.9 | 16.0 → 15.6 | 8.6 → 8.2 | 8.7 → 8.6 |
| Trimmed V8 | 5.5 → 6.6 | 45.9 → 26.8 | 13.5 → 15.9 | 7.7 → 8.1 | 7.5 → 7.3 |

In each memory-test launch the game streamed and checked the same file 96 times, retaining only the current chunk. These are the largest samples across two launches per version, with WebView’s bound renderer measured separately. PSS and RSS include the runtime, renderer and application. Samples cannot resolve shorter peaks or isolate the encoder’s allocations.

| Process | Highest sampled PSS (KiB) | Highest sampled RSS (KiB) |
| --- | --- | --- |
| WebView app | 195,961 → 196,163 | 342,016 → 342,408 |
| WebView renderer | 71,269 → 69,969 | 180,808 → 178,792 |
| Standard V8 app | 259,923 → 261,003 | 380,788 → 381,720 |
| Trimmed V8 app | 257,403 → 250,639 | 378,332 → 370,772 |

The largest application PSS sample was slightly higher with the new encoder for WebView and standard V8, and lower for trimmed V8. The sampling supports a throughput improvement on this device. It does not establish a general reduction in memory use.

The Fold7 also exercised cancellation and view closure during the second chunk, then checked the retry and reopened game. The record lists per-launch measurements, asset identities, resource counts and pixel comparisons. [Measurement record](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-chunk-throughput.json)

### WebView chunk delivery on Galaxy Z Fold7

The Android player retains synchronous retrieval of Base64 chunks for WebView. Three alternatives delivered the correct bytes but took longer to read the complete file. This comparison used the player from [PR #398](https://github.com/cnedwin/Egret_rebuild/pull/398) as its baseline.

On a Galaxy Z Fold7 running Android 17 and System WebView 157.0.8103.50, the test read the same 8,388,645-byte packaged level in 128 full 64 KiB chunks and one 37-byte tail. Two instrumented launches measured 46.75 and 44.35 ms per file across 129 synchronous result calls. Java spent 0.187 and 0.194 ms respectively retrieving the results, including entry to the reader lock. In a separate control with the same call count, returning strings of the actual chunk lengths cost 24.7 and 23.8 ms more per file than returning four-character strings. This establishes that return size matters. The share of time spent on copying, conversion and scheduling inside Chromium remains unknown.

Each pair used fresh processes on the same device with identically signed, non-debuggable APKs and the same game script on both sides. After three warm-up reads, each process timed nine reads through EOF and verified every byte outside the timed interval. The timings below are per-process medians in milliseconds per file. Each arrow runs from that pair’s #398 baseline to its candidate.

| Candidate | Paired results | Reason for retaining the existing path |
| --- | --- | --- |
| Send each Base64 chunk in a window message | 102.3 → 158.0, 114.1 → 162.6, 112.8 → 167.5, 112.4 → 195.8 | All 129 chunks arrived with zero synchronous retrievals. Throughput fell from 71.05 to 48.48 MiB/s, with a median paired change of −34.0%. Separate probes measured about 24 ms per file constructing the messages and 58–59 ms calling Android to post them. The extra delay accumulated before JS received them. |
| Return a string with one code unit per byte | 113.8 → 230.3 and 111.6 → 234.9 | All byte values survived, including embedded NULs. On the original level, synchronous retrieval rose from 50.2 to 134.9 ms and JS decoding from 10.3 to 35.6 ms. A separate pair on a high-entropy file of the same size took 106.5 → 275.5 ms. |
| Hand off one private message port per stream | 117.3 → 148.9 and 106.0 → 167.4 | Each file used one port handoff and 129 payloads, avoiding a request ID on every chunk. Throughput still fell by 21.2% and 36.7% in opposite run orders. |

Only the window-message candidate proceeded to the full memory and lifecycle comparison. Each version ran two independent windows of 96 consecutive reads, retaining just the current chunk. Observed peak PSS rose from 204,072 to 231,749 KiB in the app and from 67,918 to 168,191 KiB in the WebView renderer. These are separate process samples whose peaks can occur at different times.

Both versions passed cancellation and view closure after 73,728 bytes had been read, with exactly one stream close in each case. Retry and reopen returned the complete file. The initial and reopened game surfaces each matched all 2,073,600 expected pixels. Standard and trimmed V8 retain their device results from #398. [Three-host baseline measurements](https://github.com/cnedwin/Egret_rebuild/blob/c9b3db2502eb9c311ab8108d1ac324b64eb9db2f/runtime-sdk/measurements/fold7-project-chunk-throughput.json)

## Embed in an existing Activity

Copy the AAR to the app module's `libs/egret-player.aar` and add `implementation files('libs/egret-player.aar')` to its Gradle dependencies. Export into a fresh directory under that module's assets. Replace the example paths with the existing module, game and bundler locations.

```sh
node runtime-sdk/android/player/export-project.mjs --project /projects/my-game --esbuild /path/to/node_modules/esbuild --out /projects/my-app/app/src/main/assets/game
```

Construct `new org.egret.runtime.player.EgretPlayerView(activity, "game", listener)` on the main thread and add it to a layout. Forward Activity `onResume()` and `onPause()` to the view. Call `close()` when retiring it. Wait for `listener.onClosed()` before opening a replacement. `onReady()` acknowledges the first successful native submission. `onError(String)` reports failures and `onState(String)` receives game-supplied JSON. `getDiagnostics()` returns a snapshot of session counters and the project close receipt. The complete Activity implementations are in `runtime-sdk/android/player/consumers/`.

## Rendering scope and evidence

The player draws rectangles, image quads and indexed texture meshes in capture order. A frame can contain up to 4,096 draws and 360,472 command bytes. It supports affine transforms, neutral material colors, normal source-over, translucent fills and textures, nearest sampling, and intersecting axis-aligned clips. The native executor composites in linear premultiplied color and resolves to display sRGB. The view fits the opaque logical stage to its available area and maps input to stage coordinates. Offscreen effects, rotated clips and other blend or filtering policies are outside this draw profile.

### Indexed texture meshes

Use `Mesh2D` with an existing texture lease and indexed triangles. Publish each atlas page through the same player service used for bitmaps. A changing pose can replace the geometry on its binding while keeping the page resident. The native player preserves the order of meshes and surrounding UI draws. The supported material uses neutral light and dark colors, normal source-over, nearest sampling and normalized UVs in [0,1]. View-domain sampling supports packed regions, transparent trim and quarter-turn rotation. Page-domain meshes interpret UVs against the whole texture page, including when the bound view is cropped.

A frame containing a mesh uses EGR4. Each mesh carries its transformed vertices, UVs and local triangle indices. The renderer submits the indices to GLES3 and uses the existing clip, compositing and texture-page lifetime rules. Commands are validated before drawing, including index bounds, page residency and the frame byte budget. The same AAR and project export revision should be used for a mesh game. A recording can interleave EGR2, EGR3 and EGR4 frames.

The [Kite Courier example](https://github.com/cnedwin/Egret_rebuild/tree/main/runtime-sdk/examples/indexed-mesh) draws two nine-vertex meshes from separate atlas pages. One UI strip crosses the cape behind the face, and another sits in front of the face. The Fold7 capture covered 17 distinct poses in 210 submissions. The three script hosts produced identical command tapes. Native replay consumed the WebView capture.

| Fold7 execution path | JS bridge payload per frame | UI-thread submission-callback interval p95 |
| --- | ---: | ---: |
| System WebView | 948 bytes (237 words) | 8.882 ms |
| Standard V8 | 948 bytes | 8.898 ms |
| Trimmed V8 | 948 bytes | 8.955 ms |
| Native command replay | 0 bytes | 8.773 ms |

The packet consumed by GLES3 was 948 bytes in every lane. The bridge figures count command data and exclude initial texture uploads and transport overhead. Each timing is the median of four process-level p95s, with 30 warm-up submissions and 180 measured callback intervals per process. The timer measures the interval between two successful native submission callbacks received on the Android UI thread. GPU completion and display presentation were outside this measurement.

All four paths produced identical 1080 × 1920 surfaces at the final pose, both before and after EGL context recreation. Against an independent CPU rasterization, all 2,030,094 pixels away from color boundaries matched. Of the remaining pixels, 22 matched the color of a neighboring texel within the same mesh and 21 matched a neighboring layer at a silhouette. Every differing color appeared in the expected 3 × 3 neighborhood. Each execution uploaded both atlas pages once per context and recorded four page releases by close. The three game sessions released both logical textures, and replay released its tape. [Fold7 measurements](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-indexed-mesh.json)

### Packed sprite sheets and animation frames

Sprite sheets and sequence animations describe the original canvas with `sourceWidth` and `sourceHeight`, the trimmed image position with `trimX` and `trimY`, and clockwise packing with `packedRotation` (0° or 90°). For a region with any of the four quarter-turns, use `createTextureView` with `quarterTurn` set to 0, 1, 2 or 3. Position and scale the bitmap using the original logical dimensions. The player keeps the trimmed margins transparent and selects the nearest logical texel before mapping it into the packed image. These rules also apply when the bitmap is mirrored or switches animation frames. For bitmap quads, page-domain sampling requires a whole, untrimmed, unrotated page.

Build the player AAR and export the game from the same revision when using mapped atlas frames. Ordinary frames still produce EGR2 bytes. Quad-only frames containing mapped draws use EGR3, which appends a 24-byte entry per mapped quad after the usual 64-byte records. Each entry identifies the draw ordinal, logical size, trim offset and quarter-turn. Both packet types use the same uploaded texture and can occur in the same capture and replay. A game using mapped quads requires an EGR3-capable player.

On a Galaxy Z Fold7, a test game exchanged each packed sprite with an independently expanded bitmap at the same screen position. All 581,256 sampled pixel pairs matched per tested script host, across four rotations, mirroring, clipping and half-pixel placement. Drawing the two images at different screen positions produced 18 differing samples per rotation in the half-pixel row. Exchanging the textures showed that the discrepancy followed the screen position. The record includes the capture, replay and resource checks. [Fold7 atlas measurements](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-atlas.json)

The Rust unit checks cover packet validity, resource IDs, alpha conversion, clip rounding and EGR1 compatibility. JavaScript checks also capture a real Engine with two leased pages and change its visible page set. A Windows offscreen EGL 1.5 test used ANGLE SwiftShader to read all 48 pixels of a small composite. Half-white over black returned RGBA (188,188,188,255), an overlapping translucent red page returned (224,137,137,255), and the second opaque green page returned (0,255,0,255). A mirrored atlas edge retained its own texel. A transparent clear resolved to (128,0,0,128). These are desktop software-renderer observations.

On 19 November 2026 both Gradle apps ran on a Galaxy Z Fold7 with Android 17, System WebView 157 and Adreno 830. The six game files and the native renderer matched byte for byte across the two APKs. In both apps, injected taps filled a prescription, a drag scrolled the list, the Android keyboard opened, and the sound player started and released one effect. After background and resume, the second EGL context restored four pages. Comparing the static inventory region against its pre-background screenshot gave zero changed pixels out of 152,106 in the standalone game and 103,500 in the host. The host closed the game with all 14 logical textures released, kept its native controls and opened a fresh game. The local debug builds measured 701,200 bytes for the AAR, 1,767,567 for the standalone APK and 1,767,575 for the host APK. These profiles share the installed System WebView. Frame speed, audible output and human IME composition were outside this run. [Device and artifact record](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-player.json)

The earlier EGR1 specimen has separate optional Javet/V8 builds with and without Intl, along with its frozen replay and Galaxy Z Fold7 timing/PSS measurements. Those results describe the original specimen and its script hosts. The measurements above used the default System WebView AAR. [Earlier specimen and measurements](runtime-sdk-v8-fold7.md)

The project adapter, Android view, Rust renderer and sample are first-party contributions. The AAR includes project LICENSE/NOTICE and the Rust library, NDK/toolchain and robust-predicates notices under `assets/egret-player-licenses/`. Keep these packaged notices and the applicable licenses for each game's assets when distributing an app.
