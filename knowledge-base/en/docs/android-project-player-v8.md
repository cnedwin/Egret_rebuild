# Choosing a script host for an Android game

English | [简体中文](../../Cns/docs/android-project-player-v8.md)

A game exported with the [Android project player](android-project-player.md) can use the installed System WebView or include V8 in its AAR. All three builds use the same Rust GLES3 renderer, resource scope and Android view. Choose the script host when building the AAR. The game can still run inside its own Activity or an existing app.

| Build | Script environment | Minimum Android API |
| --- | --- | ---: |
| `webview` (default) | Installed System WebView, local HTML entry and browser APIs | 26 |
| `standard` | V8 15.7.112.19 with JavaScript `Intl` and packaged ICU locale data | 29 |
| `trimmed` | The same V8 version built without `Intl` or its ICU data | 29 |

Use the WebView build for games that rely on the DOM or need the smallest download. For a self-contained VM, choose standard when the game calls `Intl` for locale-aware formats or sorting. A game can display Chinese with all three hosts through Android's fonts. The two embedded profiles select Javet 6.0.3 arm64 artifacts. Build inputs, versions, hashes and licenses are pinned in the [source manifest](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/android/v8-provenance.json).

## Build and run

After the project-player toolchain setup, run these commands from the checkout. Reuse the same game directory and renderer when comparing builds. The cache can be used offline after all selected artifacts and notices have been obtained.

```sh
node runtime-sdk/android/player/build-aar.mjs --v8-profile trimmed --v8-cache out/v8-cache --out out/player-trimmed.aar
node runtime-sdk/android/player/create-app.mjs --aar out/player-trimmed.aar --project runtime-sdk/examples/moon-herbarium --esbuild /path/to/node_modules/esbuild --layout embedded --id org.example.herbarium --out out/herbarium-v8
gradle -p out/herbarium-v8 assembleDebug
```

For the other profiles change `--v8-profile`, the AAR filename and the export directory. The generated app reads the minimum API from the selected library profile. The V8 library includes the VM, its Java binding, consumer shrinker rules and redistribution notices. In the generated debug APK, Gradle stores the native VM library uncompressed and aligned for direct loading. The AAR compresses the same library. Measure the signed APK separately from the AAR and from a store download. The standard build also installs its verified ICU data in the app's private storage on first use.

## Project and lifetime contract

The embedded worker evaluates the exported `game.js` directly. Game code can use the project clock, timers, resource cancellation, stage input, native text editor, audio and binary frame submission. Local HTML scripts and browser globals such as `document` or `Image` require the System WebView host. The player restricts project loading to packaged assets. Applications that need remote content must provide that integration separately. The player executes trusted, packaged game code.

Use the optional `services.raster` to decode a declared PNG, measure text runs or draw them onto a texture. The service uses the same Android decoder and fonts in all three builds. Each page accepts at most 1,048,576 pixels, with up to 4,096 pixels per side. Prepare pages when content loads or text changes. Image transfer for this service uses Base64 during preparation. Frame commands use a binary buffer. Each active V8 session owns one worker and isolate. The Android view accepts a replacement game after `onClosed()` reports resource and VM teardown.

## Measuring the player

The embedded example accepts `--ez egret.timing true` when launched with `adb shell am start`. Its Activity dump includes the player's `timing` object. Collection skips 30 warmup submissions and retains 180 samples. The process and view startup clocks end at the main-thread acknowledgment of the first successful native submission. The frame interval measures the time between those acknowledgments. `dispatchToEnqueueUs` includes scheduling, script generation and transport. `enqueueToCallbackUs` includes the GL queue and the return to the main thread. Compare hosts using the dispatch-to-enqueue interval. The generation timer runs inside JavaScript on WebView and includes the Java-to-V8 method invocation on embedded V8. V8 reports the explicit buffer copy separately. The WebView Java bridge performs its own conversion internally and reports that field as unavailable. GPU execution, display presentation and audible output require separate measurements.

## Galaxy Z Fold7 results

On 19 November 2026, Moon Herbarium ran on one Android 17 device with an Adreno 830. Each debug APK contained the same six game files and Rust renderer, verified byte for byte. Each host had a separate first-install run followed by three force-stopped process starts in rotating order. Those starts used warm filesystem caches and an already installed ICU file for standard V8. The table shows medians across the three runs. PSS includes the attributable WebView renderer process.

| Host | APK (MiB) | First submission (ms) | Submission interval p95 (ms) | Dispatch to enqueue p50 (ms) | PSS (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| System WebView | 1.69 | 332.1 | 16.18 | 3.18 | 237.2 |
| Standard V8 | 69.27 | 250.9 | 8.90 | 1.01 | 216.3 |
| Trimmed V8 | 61.80 | 250.8 | 8.89 | 1.01 | 216.9 |

All three hosts completed a prescription, scrolled the inventory, edited a name with the system keyboard and started and released the sound effect. Across hosts the same 2,038,968 stationary game pixels matched exactly after excluding the moving character’s path. Each host restored its EGL context after a background transition with matching stationary pixels, released all 14 logical textures on close and opened the game again. A separately built R8-minified trimmed-V8 consumer also opened, closed and reopened on the phone.

The native replay benchmark uses a separate frozen EGR1 workload. The Moon Herbarium measurements cover the three live script hosts above. [Device record](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-v8.json) · [Native replay comparison](runtime-sdk-v8-fold7.md)

## Comparing the same game against native replay

The generated embedded Activity offers three opt-in benchmark modes in a debuggable app. In `capture`, the game runs its first 210 submissions at a fixed logical time of `frameIndex × 1000 / 120` milliseconds. The recorder saves the submitted EGR2 command bytes and straight-RGBA page versions, including replacements and removals. It publishes the complete tape atomically in app-private storage. A capture is limited to 64 MiB and 4,096 distinct page versions. Each app retains its latest complete capture. If another capture replaces it, replay checks the requested digest before drawing.

`live` runs the game at the same logical times without recording. `replay` preloads the verified tape and dispatches the same packets to the existing GLES3 renderer without starting a script VM. All lanes ignore gameplay input and hold the last frame, index 209. Recreating the EGL context redraws that frame with the restored pages. Collect timings in separate live and replay launches. Startup of replay includes reading and verifying the tape. Resident PSS after the terminal frame includes the preloaded tape.

For an embedded sample exported with application ID `org.example.herbarium`, run:

```sh
adb shell am start -S -n org.example.herbarium/org.egret.example.LibraryActivity --es egret.benchmark capture
adb shell dumpsys activity org.example.herbarium/org.egret.example.LibraryActivity
```

Read `benchmark.sha256` after `benchmark.complete` becomes true. Keep the app data between runs. Use the following commands in separate runs and read the Activity dump after each run completes. Replace `CAPTURE_SHA256` with the reported lower-case digest.

```sh
adb shell am start -S -n org.example.herbarium/org.egret.example.LibraryActivity --es egret.benchmark live --ez egret.timing true
adb shell am start -S -n org.example.herbarium/org.egret.example.LibraryActivity --es egret.benchmark replay --es egret.replaySha256 CAPTURE_SHA256 --ez egret.timing true
```

The native lane has no script generation or script-to-host copy measurement. For a common comparison, use the dispatch-to-enqueue and submission-callback intervals. Timing starts after the warmup for each lane. A difference in these intervals includes host scheduling and queueing. GPU execution and display presentation need their own instrumentation.

### Fold7 results for the fixed workload

Each lane had four process-cold starts and occupied every position in the run order once. Each start skipped 30 warmup frames and recorded 180 submissions, for 2,880 samples overall. Each run uses nearest-rank p95, then the table reports medians across the four runs. PSS was read while holding the final frame and includes the attributable WebView renderer process.

| Lane | Process start to first callback (ms) | Submission interval p95 (ms) | Dispatch to enqueue p95 (ms) | Resident PSS (MiB) |
| --- | ---: | ---: | ---: | ---: |
| System WebView | 329.5 | 15.885 | 7.221 | 222.1 |
| Standard V8 | 247.9 | 8.830 | 2.291 | 202.0 |
| Trimmed V8 | 244.3 | 8.788 | 2.296 | 200.4 |
| Native command replay | 75.2 | 8.812 | 0.012 | 118.4 |

Each of the 210 frames draws 81 quads. Excluding frame IDs, the recording contains 26 distinct command bodies. Native replay spends little time dispatching commands. Both embedded V8 hosts approach its p95 submission interval on this scene. The WebView dispatch-to-enqueue path warrants closer inspection. Its difference includes thread scheduling, command generation and transport; a single copy or GPU execution cannot be identified from this timing.

The three script hosts produced byte-identical files of 2,483,048 bytes. All 2,073,600 pixels of the held viewport matched in all four lanes, including the moving character. For an independent visual check, 280 opaque character texel samples matched the authored atlas on each lane. Each lane restored the same image after EGL recreation, with eight total page uploads and eight releases by close. A mismatched digest was rejected in the debug app; the R8-minified release followed the ordinary game path. [Four-lane record and raw samples](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-project-replay.json)

### WebView command transport on Galaxy Z Fold7

The 7.221 ms p95 above prompted a closer look at Moon Herbarium. Three fresh, process-cold launches of the original WebView transport recorded 180 frames each after the same 30-frame warmup. The interval from the JS command call to Java receiving the array accounted for 65.2–69.5% of mean dispatch time on each run's slowest nine frames. That interval includes argument conversion, delivery and scheduling.

| Mean on the same nine slowest dispatches (ms) | Run 1 | Run 2 | Run 3 |
| --- | ---: | ---: | ---: |
| Dispatch to JS entry | 1.009 | 0.951 | 1.149 |
| Game command generation | 0.733 | 0.800 | 0.900 |
| View and length checks | 0.022 | 0.000 | 0.011 |
| JS call to Java method entry | 4.422 | 3.719 | 5.224 |
| Java validation and frame snapshot | 0.038 | 0.026 | 0.033 |
| Wait for the UI handler | 0.152 | 0.196 | 0.180 |
| UI handler to enqueue marker | 0.017 | 0.010 | 0.019 |
| Total dispatch to enqueue | 6.392 | 5.702 | 7.515 |

Each run aligned the JS and Android clocks with 24 round trips at each end. For each round trip, expand the clock-offset interval by the observed 100 µs JS timer quantum and 1 µs rounding allowance on both sides. Intersect the 24 intervals in each batch and interpolate linearly between their midpoints at the mean round-trip centers. Endpoint half-widths ranged from 42.6 to 94.4 µs. All 540 dispatch intervals reconstructed the original timer within 1 µs. Short JS operations may fall within one timer tick. [Frame timestamps and calibration samples](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-webview-bridge-diagnostic.json)

The WebView player now sends four command bytes per signed 32-bit array element when the view offset and length are word-aligned. Each 5,208-byte packet crosses the synchronous bridge in 1,302 elements. Java restores the original bytes in native byte order and takes the existing texture-page snapshot before posting the frame. Other slices use the byte-array path.

With the diagnostic probe removed, six process-cold pairs alternated AB and BA on the same phone, WebView 157 and GLES3 renderer. Across runs, the median dispatch p95 went from 6.562 to 3.593 ms. Across matched pairs, the median absolute reduction was 2.894 ms and the median relative reduction was 44.1%. All six pairs improved. The acceptance rule fixed before measurement required at least four improved pairs, a median reduction of at least 0.500 ms and at least 10%. The median submission-callback interval p95 went from 11.024 to 8.930 ms. These are host-side timings; GPU execution, display presentation and power were outside this comparison.

Both builds produced the same 2,483,048-byte capture for all 210 submissions. All 2,073,600 pixels of the held viewport matched before and after EGL recreation. Each build uploaded and released eight textures across two contexts and completed a separate ordinary close and reopen. [Paired samples, package identities and correctness results](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-webview-bridge-pairs.json)
