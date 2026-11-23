# Android project player

English | [简体中文](../../Cns/docs/android-project-player.md)

Package a trusted JavaScript or TypeScript game as an arm64 Android app, or embed its view in an existing Activity. The project player defaults to trimmed V8 and draws through Rust and OpenGL ES 3 on a `GLSurfaceView`. Embedded V8 requires Android API 29. Games that use JavaScript `Intl` can select standard V8. The explicit System WebView build supports API 26 with a recent WebView that provides ES2022 and AbortController. [Choosing a script host](android-project-player-v8.md)

## Build the library and a game

Run these commands from the engine checkout. Use Node 26.7.0, pnpm 11.25.0, JDK 17, Android SDK Platform 36, Build Tools 35.0.0, NDK r27c and Rust with the `aarch64-linux-android` target. Set `JAVA_HOME`, `ANDROID_HOME` and `ANDROID_NDK_HOME`. Keep the matching Rust installation's `share/doc/rust/COPYRIGHT-library.html` available. Provide the path to an installed esbuild **0.28.2** module for the game export.

```sh
pnpm install --frozen-lockfile
pnpm run build
node runtime-sdk/android/player/build-aar.mjs --out out/egret-player.aar
node runtime-sdk/android/player/create-app.mjs --project runtime-sdk/examples/moon-herbarium --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.herbarium --layout standalone --out out/herbarium
gradle -p out/herbarium assembleDebug
```

The generated application targets Android API 36. Build it with Android Gradle Plugin 8.9.1, Gradle 8.11.1 and JDK 17. Find the debug APK under `out/herbarium/build/outputs/apk/debug/`. Use `--layout embedded` and a new output directory for an Activity with native controls that opens, closes and reopens a child game view. The consumer owns its application ID, manifest, signing configuration and release build. A prebuilt Rust archive from this source can be supplied to the AAR builder with `--rust-lib` and `--rust-notice`.

## Build a signed local release

Use the same application ID, signing certificate and game asset root for successive releases. Increase the version code each time. The name appears in the launcher and the version name is the player-facing version. The launcher icon accepts square PNGs from 1 to 2,048 pixels per edge and up to 8 MiB. Version codes are positive 32-bit integers. Generate each project in a fresh directory.

Before running Gradle, provide these four environment variables from your local credential store or CI secrets. `EGRET_ANDROID_KEYSTORE` is the absolute path of an external keystore and `EGRET_ANDROID_KEY_ALIAS` identifies its key. `EGRET_ANDROID_STORE_PASSWORD` and `EGRET_ANDROID_KEY_PASSWORD` unlock them. Keep the keystore and credentials outside the generated project. Release builds enable R8 optimization and require all four settings. The debug build uses its usual Android debug key.

```sh
node runtime-sdk/android/player/create-app.mjs --project runtime-sdk/examples/moon-herbarium --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.herbarium --name "Moon Herbarium" --icon /path/to/icon.png --version-code 1 --version-name 1.0 --out out/herbarium-v1
gradle -p out/herbarium-v1 assembleRelease bundleRelease
```

The signed AAB and APK are under `build/outputs/bundle/release/` and `build/outputs/apk/release/`. Verify the AAB signature with JDK `jarsigner` and the APK with Android Build Tools `apksigner`. Compare both signer certificates with the external key. The APK can be installed directly. For an AAB upgrade test, run the following commands on each version with its own output filename. Here `bundletool` stands for `java -jar /path/to/bundletool-all-1.18.3.jar`. Each password file contains the corresponding keystore or key password and stays on your machine.

```sh
bundletool validate --bundle=out/herbarium-v1/build/outputs/bundle/release/EgretGame-release.aab
bundletool build-apks --bundle=out/herbarium-v1/build/outputs/bundle/release/EgretGame-release.aab --output=out/herbarium-v1/game-v1.apks --connected-device --ks=/private/game.jks --ks-key-alias=game --ks-pass=file:/private/store-password --key-pass=file:/private/key-password
bundletool install-apks --apks=out/herbarium-v1/game-v1.apks
```

For the upgrade check, use a game that saves through `services.storage` (see “Save and resume a game” below). Install the first APK set, open the game and save a checkpoint. Export a second project using the same game root and application ID, `--version-code 2` and `--version-name 1.1`. Build and sign it with the same key, then install its APK set over the first installation. Force-stop and reopen the game, check the installed version and read the checkpoint in the game. Keep the app installed and its data intact between versions. [Local bundletool commands](https://developer.android.com/tools/bundletool)

On a Galaxy Z Fold7, bundletool installed version 101 (1.0.1) and upgraded it in place to 102 (1.0.2). Both builds used the same external test certificate. After a cold launch, version 102 read the four moves and the score of 147 saved by version 101. The saved record had the same checksum. One more move raised the score to 168. Android retained the application UID and original installation time across the update. [Fold7 upgrade record](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-local-release.json)

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

The player draws rectangles, textured quads and indexed meshes in capture order. Each frame supports up to 4,096 draws and 360,472 command bytes. It composites in linear premultiplied color and resolves to display sRGB. The view fits the opaque logical stage and maps input back into stage coordinates. The command profile supports affine transforms, intersecting axis-aligned clips, normal source-over, multiply-factor and additive accumulation, with nearest or linear sampling at mip level zero. Offscreen effects, rotated clips and general alpha masks remain outside this profile.

### Indexed texture meshes

Use `Mesh2D` with an existing texture lease and indexed triangles. Publish each atlas page through the same player service used for bitmaps. A changing pose can replace the geometry on its binding while keeping the page resident. The native player preserves the order of meshes and surrounding UI draws. Meshes support normalized UVs in [0,1] and per-vertex light tint. Material-level light and dark colors retain their neutral defaults. View-domain sampling supports packed regions, transparent trim and quarter-turn rotation. Page-domain meshes interpret UVs against the whole texture page, including when the bound view is cropped.

A frame containing a neutral nearest-sampled mesh uses EGR4. EGR5 extends the same records for shadow and additive blending, linear filtering, per-vertex light and the engine-owned solid Graphics texture. Each mesh carries its transformed vertices, UVs and local triangle indices. The renderer submits the indices to GLES3 and uses the existing clip, compositing and texture-page lifetime rules. Commands are validated before drawing, including index bounds, page residency and the frame byte budget. The same AAR and project export revision should be used for a mesh game. A recording can interleave EGR2 through EGR5 frames.

The [Kite Courier example](https://github.com/cnedwin/Egret_rebuild/tree/main/runtime-sdk/examples/indexed-mesh) draws two nine-vertex meshes from separate atlas pages. One UI strip crosses the cape behind the face, and another sits in front of the face. The Fold7 capture covered 17 distinct poses in 210 submissions. The three script hosts produced identical command tapes. Native replay consumed the WebView capture.

| Fold7 execution path | JS bridge payload per frame | UI-thread submission-callback interval p95 |
| --- | ---: | ---: |
| System WebView | 948 bytes (237 words) | 8.882 ms |
| Standard V8 | 948 bytes | 8.898 ms |
| Trimmed V8 | 948 bytes | 8.955 ms |
| Native command replay | 0 bytes | 8.773 ms |

The packet consumed by GLES3 was 948 bytes in every lane. The bridge figures count command data and exclude initial texture uploads and transport overhead. Each timing is the median of four process-level p95s, with 30 warm-up submissions and 180 measured callback intervals per process. The timer measures the interval between two successful native submission callbacks received on the Android UI thread. GPU completion and display presentation were outside this measurement.

All four paths produced identical 1080 × 1920 surfaces at the final pose, both before and after EGL context recreation. Against an independent CPU rasterization, all 2,030,094 pixels away from color boundaries matched. Of the remaining pixels, 22 matched the color of a neighboring texel within the same mesh and 21 matched a neighboring layer at a silhouette. Every differing color appeared in the expected 3 × 3 neighborhood. Each execution uploaded both atlas pages once per context and recorded four page releases by close. The three game sessions released both logical textures, and replay released its tape. [Fold7 measurements](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-indexed-mesh.json)

### Race a textured GLB kart on Android

The local Android export of *Jinxiu Rally* uses the original one-lap race, eight-driver simulation and course. Tuan's chassis and seated driver come from the game's original GLBs. Each contains an embedded 768 × 768 JPEG. The original race rules, fitted models and track data come from the specified game checkout. [Browser game](https://cnedwin.github.io/PortedGamesEgret/Rally/) · [Game source and artwork](https://github.com/cnedwin/PortedGamesEgret/tree/ce6144533b890be992bea9eb09cb344457f8364c/Rally)

Build the workspace and the trimmed-V8 AAR as described above. Use a checkout of PortedGamesEgret at `ce6144533b890be992bea9eb09cb344457f8364c` and two fresh output directories. The exporter checks its inputs before copying game files into the local project. The engine repository includes the adapter. The game checkout supplies the game code, assets and their notices.

```sh
node runtime-sdk/examples/rally/prepare.mjs /path/to/PortedGamesEgret/Rally out/rally-game
node runtime-sdk/android/player/create-app.mjs --project out/rally-game --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.rally --name Rally --out out/rally-app
gradle -p out/rally-app assembleRelease
```

In a World3D project, call `await services.loadGlb('panda-kart.glb', { firstPage: 1 })` for a GLB listed in `project.json` assets. Add the returned `scene` to the game world. Reserve one free texture page per distinct image, starting at the specified ID. The loader reads through the existing cancellable chunk reader. Android decodes embedded JPEG and PNG images directly from the declared APK asset, and the shared texture-page registry owns its pixels. The 3D material uses UV0 and a repeating sRGB sampler with linear filtering and mipmaps. Its GPU texture can be rebuilt from the same page after an EGL context change. Call `asset.dispose()` for early retirement, or leave cleanup to the project scope. A failed read or a page conflict does not replace a previously published asset.

The panda chassis and driver alone use 531,520 bytes of indexed geometry in a textured frame. E3D2 therefore allows up to 2 MiB per packet. It includes visible mesh data and references texture pages by ID. The 2D and Roll3D packet limits remain 360,472 bytes.

The browser loads all twelve track GLBs. This export reads the two player GLBs without changing their mesh, UVs or embedded image bytes, and fits them with the original game's placement functions. The low-detail view keeps the drivable circuit and grades, start grid, bridge, hazards, pickups and other competitors. Road surface, distant terrain, vegetation, spectator areas, effects and HUD use a simpler presentation. Audio, water reflections and the full browser art set are outside this qualification.

The first phone build accelerated before the first driving contact. It also stopped drawing during the opening section. The input adapter now waits for that contact as the browser does. The encoder reports the byte and geometry limits separately. An offline sweep reproduced the 64-geometry limit on the old winding-road layout. Grouping static road and terrain tiles more coarsely keeps both limits intact. A 3,030-view sweep of the updated route peaked at 50 distinct geometries. These figures describe a diagnostic sweep. The physical presentation measurements below come from separate runs.

On the same Galaxy Z Fold7, Tuan completed the 1,817.51 m Stroll circuit from the same grid with seed 7. Both runs reached the eight-racer results screen in eighth place with ten coins. The browser recorded 1:49.18 and the signed APK recorded 1:46.25. Touch input was injected through each game's normal controls. The separately driven laps did not receive an identical sequence of steering inputs.

| Moving window | Chrome WebGL2, intervals / p95 | Trimmed V8 and GLES3, intervals / p95 |
| --- | ---: | ---: |
| A | 380 / 16.581 ms | 369 / 16.582 ms |
| B | 373 / 16.581 ms | 368 / 16.581 ms |

Both runs used an 873 × 325 render buffer with a 60 Hz presentation cadence. The measurements are intervals between presentations of the game layer. The longest observed intervals were 16.583 ms in Chrome and 33.159 ms in the APK. The four timed windows contained no interval of 34 ms or more. The two scenes draw different amounts of scenery. GPU execution time, power and long-run thermal behavior were not measured. [Fold7 race, pixels and frame timings](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-rally-glb.json)

With both karts stationary at the starting grid, the panda markings, green bamboo and yellow chassis were visible in both captures. In four predefined color regions the largest difference in coverage was 1.17 percentage points. The browser also draws a separate badge on the rear of the kart. In a separate Android Activity close and reopen on the same APK, the player recorded 23 page publications and 23 releases and returned to the ready screen.

### Animate Lin Chong on Android

The Snow Temple character example uses the original game rules and pose code to drive Lin Chong’s 47 joints. The GLB contains two skinned primitives and no animation clips. The outfit uses three images for base color, metallic/roughness and normals. The hands use vertex color. The original spear follows the pose and its tip brightens during the strike. The local preparer verifies the game inputs and packages the required attribution. Supply the game checkout separately. [Game source and asset notes](https://github.com/cnedwin/PortedGamesEgret/tree/4172514ea4369fd9aaf433403423340e8db072ee/SnowTemple)

Build the trimmed-V8 AAR and configure a local release signer as described above. The preparer writes to a fresh directory. Serve that directory over HTTP and open `browser.html` for the browser reference. The top three controls hold the same idle, walking and spear-strike poses in both builds. Hold the lower-left control to walk or press the lower-right control to strike.

```sh
node runtime-sdk/examples/snowtemple/prepare.mjs /path/to/PortedGamesEgret/SnowTemple out/snowtemple
node runtime-sdk/android/player/create-app.mjs --project out/snowtemple --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.snowtemple --name SnowTemple --out out/snowtemple-app
gradle -p out/snowtemple-app assembleRelease
```

Use `services.loadGlb` to acquire the model and texture pages in the game’s resource scope. The GLES3 player retains positions, indices, joint indices and weights. Acknowledged frames share one matrix palette per visible skeleton across its primitives. Full frames also carry the mesh definitions for recovery. Color textures use sRGB sampling. Normals and the green roughness and blue metallic channels use linear sampling. The skinning path accepts opaque indexed Standard meshes with four influences per vertex and up to 56 joints per palette. Normal maps use tangents derived from UV coordinates. The encoder rejects a normal-mapped mesh with an authored tangent attribute.

On one Galaxy Z Fold7, the three browser and APK checkpoints produced matching bone-palette hashes. The first complete frame carried 1,856,976 bytes. All 1,483 measured incremental frames carried 7,716 bytes each, including 3,008 bytes of bone matrices and zero geometry definitions. Returning from the background recreated the GLES context and reproduced the idle stage pixel for pixel. Close released all eight project pages. [Device results and comparison method](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-snowtemple-skinned-character.json)

### Fight a swordsman in the fodder yard

Prepare a local copy of the encounter, then use the signed Release build instructions above or serve the output folder and open `browser.html`. Omitting `--yard` selects the single-character example. Both hosts run the original movement, enemy AI and hit rules against the same character and weapon assets. The encounter starts Lin Chong six metres from one swordsman. Hold the lower-left control to approach, then tap the lower-right control to strike. A landed hit holds the current pose for inspection. Tap the attack control again to continue.

```sh
node runtime-sdk/examples/snowtemple/prepare.mjs /path/to/PortedGamesEgret/SnowTemple out/snowtemple-yard --yard
```

When visible skinned geometry would overflow a complete 2 MiB frame, the player sends complete mesh definitions in ordered batches. Each geometry packet and each draw packet stays within 2 MiB. The batches belong to one device epoch and logical frame. GLES prepares them before drawing either character. Later draws reference the resident meshes and update the pose, transforms, materials and HUD. On context recreation the player resends the required geometry before presenting the restored fight.

This path admits up to 64 visible geometries and 16 MiB of encoded geometry definitions. During replacement, staged definitions and the active generation can coexist in CPU and GPU memory. Existing E3D1–6 frames remain compatible. Both hosts of the new multipart protocol must understand its E3G1 geometry and E3D7 draw packets. A single definition plus its packet header must fit within 2 MiB. Games using larger individual meshes must split those meshes when preparing the content. The recorder accepts its existing frame formats and reports an unsupported format when it encounters a multibatch scene.

With injected touch on a physical Galaxy Z Fold7, the browser and signed trimmed-V8 APK registered both spear hits at simulation ticks 101 and 128, reducing the swordsman’s health from 84 to 71 and then 56. The eight mesh definitions crossed the bridge in packets of 2,001,236 and 1,540,608 bytes on initial load and once per GLES context recreation. Across both observed combat intervals the geometry traffic was zero. Both hosts retained poses and health across backgrounding. Each reproduced its own 3D pixels exactly when restored, both before contact and during the hit. The final APK restored the scene twice. Its two combat intervals contained 298 and 335 draw packets. At close, all 66 texture uploads across the three GLES contexts had matching releases and all 22 project pages were returned. [Fold7 measurements](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-snowtemple-yard-encounter.json)

### Play the complete yard duel

Prepare the same two-character project for the browser and Android. Serve the output directory and open `browser.html` for the WebGL2 version, or use the Release APK instructions above with the same directory.

```sh
node runtime-sdk/examples/snowtemple/prepare.mjs /path/to/PortedGamesEgret/SnowTemple out/snowtemple-duel --duel
node out/snowtemple-duel/check-duel.mjs
```

Hold the left control to approach. Tap the right control to close to spear range and attempt one thrust, or keep it pressed to attack repeatedly. Once the fight starts, releasing both controls lets the swordsman continue attacking. A hit updates the HUD while the fight continues. The original game’s `death` event for the swordsman awards this duel to Lin Chong. Its `fall` event awards the duel to the swordsman. The result appears on the deciding hit. The scene advances another 45 simulation steps to show the defeated character falling, then holds the final pose. Restart returns both characters to their starting positions and health and clears the previous round’s inputs and hits. The `--yard` option remains available for inspecting individual strikes. [Game rules and assets](https://github.com/cnedwin/PortedGamesEgret/tree/4172514ea4369fd9aaf433403423340e8db072ee/SnowTemple)

On one Galaxy Z Fold7, Chrome WebGL2 and the signed trimmed-V8 GLES3 APK produced the same ordered damage events through both endings using injected touch. Holding the thrust control won in six spear hits. After restart, tapping it once struck the swordsman and left him on 71 HP. His first counter reduced Lin Chong from 120 to 109 HP, and the eleventh counter felled him. Both defeated characters completed their authored fall on screen. After restarting from defeat, the next tap landed the opening thrust again (84 → 71 HP). The scene reuses the resident geometry and context recovery verified in #453. [Fold7 results](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-snowtemple-duel.json)

### Fight both chapter parties in the fodder yard

Use the chapter profile to play the two encounters in order. Serve the generated directory and open `browser.html`, or pass the same directory to the Android project player for a trimmed-V8 Release APK.

```sh
node runtime-sdk/examples/snowtemple/prepare.mjs /path/to/PortedGamesEgret/SnowTemple out/snowtemple-parties --encounters
node out/snowtemple-parties/check-encounters.mjs
```

Select **Fight party** to pursue and attack opponents in the current group, **Single thrust** to approach and strike once, or **Stand** to stop attacking. The first party consists of two swordsmen and an archer. When a dropped manual page opens, pick one of its three lessons to resume. The original chapter rules bring in a shield bearer, a swordsman and two archers after the first party falls. Both groups share one game instance. Lin Chong keeps his health, position and inventory. Choose how to fight the new group using the same controls. **Restart** begins a new run with the original first party. [Original game](https://github.com/cnedwin/PortedGamesEgret/tree/4172514ea4369fd9aaf433403423340e8db072ee/SnowTemple)

On a Galaxy Z Fold7, Chrome WebGL2 and the signed trimmed-V8 GLES3 APK ran the same touch sequence. Lin Chong entered the second fight with 104 HP and the selected lesson. A queued thrust hit an archer (58 → 45 HP). Both versions recorded the same damage through Lin Chong’s defeat and the same opening hit after restart. The 440,900-byte rattan shield uses the packaged chunk reader. Geometry residency and context restoration use the earlier device results linked in the measurement. [Fold7 comparison](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-snowtemple-yard-parties.json)

### Resident geometry in live Android frames

The trimmed V8 and WebView project hosts can use the same incremental World3D protocol when the game bundle and player are built from this revision. An older host or bundle continues to send full frames. A full E3D1 or E3D2 packet defines every visible mesh. After the GL thread confirms a successful submission in the same EGL generation, E3D3 or E3D4 can refer to those meshes by ID. Each packet still carries the current camera, lights, ordered draw records, material and texture references, and the complete 2D HUD. Only new or changed mesh definitions cross the bridge. On a camera-only frame with an unchanged visible set, geometry uses zero bridge bytes.

A successful frame retires geometry that has left the visible set. Re-entry sends its definition again. Geometry or vertex-layout changes use the normal engine attribute and layout revisions. Replacing meshes becomes permanent after the world, HUD and final color resolve succeed. The limit of 64 geometries and the byte limit for a fully expanded frame also apply to incremental frames.

On a new EGL context the player starts from a full frame and rebuilds the texture pages. If the receiver loses its predecessor within the same generation, the host reconstructs the rejected frame with its original draw list, HUD and texture snapshot, then retries the same ID without advancing the game. The recorder keeps the first and last frames self-contained. Between them it stores the successfully submitted packets, including references to resident geometry. The live benchmark also retains its last frame in full.

Four paired runs on a Galaxy Z Fold7 used the existing two textured Rally GLBs at the eight-car starting grid. Only the camera moved. The visible list held 1,332 draws in all 1,440 measured frames. Each arm used a signed trimmed-V8 Release APK with the same measurement probes and an 873 × 325 GLES3 render buffer. The table gives the median of four run p95s for each timing metric.

| Metric | Full frames | Incremental frames |
| --- | ---: | ---: |
| Geometry bytes per steady frame, including definition headers | 918,648 | 0 |
| Total bridge bytes per steady frame | 1,047,640 | 128,996 |
| V8-to-Java copy p95 | 1.800 ms | 0.397 ms |
| Dispatch to render enqueue p95 | 8.048 ms | 6.584 ms |
| Native draw submission on CPU p95 | 4.921 ms | 3.478 ms |
| Game-layer presentation interval p95 | 16.58 ms | 16.58 ms |

All four pairs improved copy and submission time. Presentation cadence held steady. Both configurations held 918,168 bytes of vertex/index payload across 40 meshes in each of the CPU and GLES copies. Process PSS varied in both directions. After EGL recreation the first packet contained all 40 definitions. The game-area pixels matched across builds and before and after recovery. The recovery and close run for each build counted 80 mesh creations and 80 deletions, with 10 texture-page uploads and 10 releases. This earlier run verified EGL reconstruction. Storing all 210 frames in full would have exceeded the 64 MiB tape limit. [Paired measurements and method](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-rally-geometry-residency.json)

### Recording and replaying the Rally starting grid

On a Galaxy Z Fold7, trimmed V8 recorded 210 ticks of the eight-car starting grid with both textured GLBs and the moving camera. A fresh process verified the saved file and played it with GLES3 without starting a script VM. The file was **33,705,061 bytes (32.14 MiB)** including five texture-page versions. Frames 0 and 209 were full packets. The 208 interior frames reused geometry. Expanding all 210 command packets individually produced 220,004,400 bytes before counting pages and file metadata.

For every tick, native replay matched the capture's 873 × 325 RGBA output, the order of all 1,332 World3D draws, and the HUD command bytes. In a separate replay, Android recreated EGL while frame 90 was in flight. The player resubmitted that frame in full and finished at frame 209. A separate context recreation redrew the held terminal image. Each recovery session closed with 80 mesh creations and 80 deletions, and 10 texture-page uploads and 10 releases.

Three cold replays with pixel readback and order hashing disabled recorded game-layer presentation p95s of **16.581, 16.582 and 16.579 ms**. The corresponding submission-callback interval p95s were **19.456, 20.107 and 20.176 ms**. These measurements cover the starting-grid sequence on one phone. [Fold7 recording, frame order, recovery and timings](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-rally-resident-tape.json)

### Recording a Rally standing start

Trimmed V8 recorded 210 ticks on a Galaxy Z Fold7 with the original eight-car race simulation, chase camera and both textured panda models. Recording began with all cars stationary. The seven AI drivers moved at the green light on frame 14. On frame 16 an automated right-steering contact enabled the game's automatic throttle. Left and right turns followed. The player's start-to-end ground displacement was 15.14 m. The frame numbers start at zero, and the simulation advances at 120 ticks per second.

| Measure | Fold7 result |
|---|---|
| V8 frame commands received by the Android player | 29,984,264 bytes, including 17,923,648 bytes of draw matrices. The file also stores 4,911,392 bytes of RGBA texture pages. |
| Geometry reuse | The full first and last commands contained 918,648 and 910,756 bytes of geometry definitions. Of the 208 incremental frames, 202 sent no definitions. Six sent 64,836 bytes for four newly visible geometries and three that returned to view. No incremental frame resent continuously resident geometry. |
| Recording size | 34,899,699 bytes (33.28 MiB) including 37 texture-page versions, within the 64 MiB limit. |
| Native replay p95, three cold launches | Game-layer presentation intervals were 16.580, 16.581 and 16.582 ms. Submission-callback intervals were 20.400, 20.624 and 19.656 ms. The signed debuggable APK requested 60 Hz. Pixel readback and draw-order hashing were disabled during timing. |

Each of the eight chassis parts could be matched to its submitted world matrix in all 210 frames. The seven opponents shared one chassis geometry. As the cars steered and moved, the geometry and material of each sampled part stayed the same. Native replay matched all 210 distinct RGBA frames, the HUD and the order of 280,057 indexed World3D draws. On EGL recreation during replay, frame 101 was rebuilt in full and playback continued to frame 209. The held terminal image was also restored. All six runs closed with balanced mesh and texture-page counts and zero resident geometry payload. These measurements cover this driving start on one phone. [Fold7 capture, bridge and playback measurements](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-rally-driving-replay.json)

### Roll3D on the Android player

Roll the ball to collect all four stars, including the one on the raised platform. The flat score updates after each pickup. Touch **Play again** on the result screen to start a fresh round. The Android export reads the existing level file and binds it to the native host. The two versions use the same movement, collisions, follow camera, spinning stars, particle bursts and restart logic. [Original browser game](https://github.com/cnedwin/Egret_rebuild/blob/dfc3a00010e9e9e9d4fa26c4a3f5a42a82d92b82/examples/play/roll3d.mjs)

From a built checkout, use a fresh directory for the prepared game and the Android project. Supply the trimmed-V8 AAR and external signing settings from the local release instructions above.

```sh
node runtime-sdk/examples/roll3d/prepare.mjs out/roll3d-game
node runtime-sdk/android/player/create-app.mjs --project out/roll3d-game --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.roll3d --name Roll3D --out out/roll3d-app
gradle -p out/roll3d-app assembleRelease
```

A game can opt in with `installWorld3DPlayerProject` from `@egret/android-player-world3d`. Implement `world3D()` on the returned game object to supply its live `{scene, camera}` after each update. Add normal 2D display objects to the player stage for the HUD. World3D builds the camera-visible draw list. The E3D1 packet carries indexed positions and normals, transforms, Standard material parameters, the camera and lights, followed by the existing transparent 2D frame. GLES3 draws the scene with depth testing before it composites the HUD. Geometry shared between draws is uploaded once per context while its contents remain resident and unchanged. A full E3D1 packet contains the geometry required to replay it on a fresh context.

The profile matches this game's low quality setting: opaque, front-sided, untextured Standard materials, indexed triangles, ambient and hemisphere lighting, one directional light, and ACES at unit exposure. This comparison omits shadows, multisampling and post-processing. The existing 2D entry continues to emit EGR frames. [Fold7 measurements](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-roll3d.json)

The first APK left the camera at its default aspect ratio of 1 on a 16:9 stage. The ball appeared wide and the raised platform shifted to the right. The player now sets the camera aspect from the stage dimensions before frustum culling and draw capture. On the same Fold7, all 12 opening-scene landmarks were within 1/255 per RGB channel after the correction. In the sampled windows around the ball, platform and front star, the color silhouettes overlapped by 95.3%, 98.5% and 97.0%. Text layout and rotating edges are evaluated separately from those scene landmarks.

On the Fold7, both versions registered all four stars, including the jump to the raised platform, showed the victory screen and reset the score to 0/4 when the replay button was tapped. Touch events were injected on the phone. The Android test used the locally signed arm64 Release APK. A separate timing run recorded the intervals between frames presented by Android's compositor. Each active window alternated short left and right holds.

| Presented-frame p95 (ms) | Idle | Movement A | Movement B |
| --- | ---: | ---: | ---: |
| Chrome, WebGL2 | 16.581 | 16.579 | 16.582 |
| Android, trimmed V8 and GLES3 | 16.578 | 16.580 | 16.582 |

Both versions drew the 3D scene at 578 × 325 with a display cadence near 60 Hz. Chrome used a separate 1920 × 1080 overlay. For this timing run the APK drew its HUD into the same 578 × 325 buffer. All six short windows had zero intervals of 34 ms or more. At its default 1780 × 1001 surface and 120 Hz mode, the APK separately recorded an idle p95 of 8.289 ms over 802 intervals. The measurements describe display cadence on this phone. GPU execution time, power and sustained thermal performance remain unmeasured.

### Play the first act of Lantern Shadows on Android

The reference is the existing browser game at commit `7b774670`. Its playbill scrolls, the notched South Gate banner reveals the scenery, and the player can attack, jump and summon up to 100 shadow doubles. Defeating ten soldiers and Nezha opens the result screen and saves the first-act record. The Android project uses the original rules, Tiled level, Spine poses and record format. The native display tree lays out the playbill and controls. It clips the scrolling list to a rectangle and draws the fixed banner silhouette as triangles. The Android benchmark covers the first act in silence. Audio was outside the browser comparison. [Pinned game source](https://github.com/cnedwin/PortedGamesEgret/tree/7b774670237666d73247cc793c55530f7f7c1e5f/LanternShadows)

Start with the matching game checkout and locally built trimmed-V8 AAR. Prepare the game into a fresh directory with the JDK on your path. Supply the external signing settings from the release instructions above.

```sh
node runtime-sdk/examples/lantern-shadows/prepare.mjs /path/to/PortedGamesEgret/LanternShadows out/lantern-game
node runtime-sdk/android/player/create-app.mjs --project out/lantern-game --aar out/egret-player.aar --esbuild /path/to/node_modules/esbuild --id org.example.lanternshadows --name "Lantern Shadows" --out out/lantern-app
gradle -p out/lantern-app assembleRelease
```

The preparer reads locally supplied game sources and artwork. It includes game provenance and the upstream license notices in the generated project. Keep the applicable game and Spine rights when distributing a build. [Spine runtime license](https://github.com/cnedwin/PortedGamesEgret/tree/7b774670237666d73247cc793c55530f7f7c1e5f/LanternShadows/vendor/%40esotericsoftware__spine-core)

On the Galaxy Z Fold7 with Android 17, both Chrome 157 (WebGL2) and the signed arm64 trimmed-V8 APK (GLES3) completed the first act through normal controls. The browser run earned C with a best combo of 13. The native run earned B with a best combo of 22. Reloading the browser page and force-stopping and reopening the APK each restored that run's exact record in the playbill. These are independent playthroughs with different inputs. The recorded times measure progress within each game session.

On the same phone the eight preselected scenery samples differed by at most 6/255 per RGB channel. Three landmarks on the idle hero fell within the preselected 16/255 tolerance. The independently timed idle captures also show differences along the moving puppet's silhouette. The browser uses its HTML playbill and the APK uses a native-stage playbill. Both scroll inside the viewport and show the scenery through the banner notch. [Device measurements and comparison method](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-lantern-shadows.json)

A second stationary opening run captured 15 idle poses on each backend. The pair closest in game-clock midpoint (25 ms apart) had whole-character silhouette overlap of 0.869 and a 95th-percentile maximum RGB-channel difference of 61/255. Selecting the closest upper-body shape and checking the lower body independently gave lower-body overlap of 0.881 and whole-character difference of 52/255 at p95. The capture brackets span roughly 0.9 seconds in these pairs. The two sequences confirm the character and pose while leaving residual edge differences unresolved.

The Release APK used for measurement includes a read-only Activity observer for game state. It receives the same score shown on screen and never supplies input or writes a save.

The packaged Spine reader accepts supplementary characters and rejects isolated UTF-16 surrogate code units on trimmed V8, including configurations without ICU property tables. The original Android run stopped during script parsing before this correction.

### Packed sprite sheets and animation frames

Sprite sheets and sequence animations describe the original canvas with `sourceWidth` and `sourceHeight`, the trimmed image position with `trimX` and `trimY`, and clockwise packing with `packedRotation` (0° or 90°). For a region with any of the four quarter-turns, use `createTextureView` with `quarterTurn` set to 0, 1, 2 or 3. Position and scale the bitmap using the original logical dimensions. The player keeps the trimmed margins transparent and selects the nearest logical texel before mapping it into the packed image. These rules also apply when the bitmap is mirrored or switches animation frames. For bitmap quads, page-domain sampling requires a whole, untrimmed, unrotated page.

Build the player AAR and export the game from the same revision when using mapped atlas frames. Ordinary frames still produce EGR2 bytes. Quad-only frames containing mapped draws use EGR3, which appends a 24-byte entry per mapped quad after the usual 64-byte records. Each entry identifies the draw ordinal, logical size, trim offset and quarter-turn. Both packet types use the same uploaded texture and can occur in the same capture and replay. A game using mapped quads requires an EGR3-capable player.

On a Galaxy Z Fold7, a test game exchanged each packed sprite with an independently expanded bitmap at the same screen position. All 581,256 sampled pixel pairs matched per tested script host, across four rotations, mirroring, clipping and half-pixel placement. Drawing the two images at different screen positions produced 18 differing samples per rotation in the half-pixel row. Exchanging the textures showed that the discrepancy followed the screen position. The record includes the capture, replay and resource checks. [Fold7 atlas measurements](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-atlas.json)

The Rust unit checks cover packet validity, resource IDs, alpha conversion, clip rounding and EGR1 compatibility. JavaScript checks also capture a real Engine with two leased pages and change its visible page set. A Windows offscreen EGL 1.5 test used ANGLE SwiftShader to read all 48 pixels of a small composite. Half-white over black returned RGBA (188,188,188,255), an overlapping translucent red page returned (224,137,137,255), and the second opaque green page returned (0,255,0,255). A mirrored atlas edge retained its own texel. A transparent clear resolved to (128,0,0,128). These are desktop software-renderer observations.

On 19 November 2026 both Gradle apps ran on a Galaxy Z Fold7 with Android 17, System WebView 157 and Adreno 830. The six game files and the native renderer matched byte for byte across the two APKs. In both apps, injected taps filled a prescription, a drag scrolled the list, the Android keyboard opened, and the sound player started and released one effect. After background and resume, the second EGL context restored four pages. Comparing the static inventory region against its pre-background screenshot gave zero changed pixels out of 152,106 in the standalone game and 103,500 in the host. The host closed the game with all 14 logical textures released, kept its native controls and opened a fresh game. The local debug builds measured 701,200 bytes for the AAR, 1,767,567 for the standalone APK and 1,767,575 for the host APK. These profiles share the installed System WebView. Frame speed, audible output and human IME composition were outside this run. [Device and artifact record](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-player.json)

The earlier EGR1 specimen has separate optional Javet/V8 builds with and without Intl, along with its frozen replay and Galaxy Z Fold7 timing/PSS measurements. Those results describe the original specimen and its script hosts. The measurements above used the System WebView AAR selected for that run. [Earlier specimen and measurements](runtime-sdk-v8-fold7.md)

The project adapter, Android view, Rust renderer and sample are first-party contributions. The AAR includes project LICENSE/NOTICE and the Rust library, NDK/toolchain and robust-predicates notices under `assets/egret-player-licenses/`. Keep these packaged notices and the applicable licenses for each game's assets when distributing an app.
