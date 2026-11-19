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

### Embedded V8 command generation on Galaxy Z Fold7

Moon Herbarium submitted 210 frames per launch at the fixed #386 logical times. Three diagnostic launches per V8 profile traced frames 30–209 on the same device. EGR2 quad encoding was the largest individual step in all six runs. It accounted for 24.7–30.8% of mean dispatch time on each run’s nine slowest dispatches. Capturing the display tree came second.

Each cell below gives the range across three runs of the mean time on those same nine frames, in milliseconds. The Java-to-V8 invocation and its return are included in generation.

| Host | Dispatch to worker | Game command generation | EGR2 encode (within generation) | VM result copy | Validate and snapshot | UI queue wait | UI handler to enqueue |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Standard | 0.108–0.159 | 0.959–1.941 | 0.377–0.751 | 0.126–0.277 | 0.008–0.017 | 0.089–0.161 | 0.008–0.011 |
| Trimmed | 0.129–0.164 | 0.949–1.046 | 0.348–0.421 | 0.122–0.128 | 0.008–0.009 | 0.136–0.142 | 0.010–0.011 |

Eight JS markers read the same Android monotonic clock as the worker and UI markers. Two batches of 96 empty calls per launch measured marker overhead. The median interval was 2.8 µs before the run and 17.1–23.3 µs afterward. All stage readings include that overhead. Dispatch, generation and copy reconstructed the existing per-frame timers within 0.5 µs. [Frame timestamps and marker calibration](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-v8-command-stages.json)

A first candidate wrote quad fields directly into the packet. Its median paired generation gain was 72.5 µs (9.0%) on standard V8 and 90.5 µs (10.8%) on trimmed V8. Both fell short of the 100 µs threshold. The second candidate used a fresh six-pair comparison per profile with the same thresholds. [First candidate and raw samples](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-v8-direct-writer-pairs.json)

The player remembers a quad after the same immutable engine command recurs at the same draw position. Subsequent captures can copy its private 64-byte EGR2 record if the material, viewport, atlas mapping, source dimensions and resident slot still match. Changed bindings are validated and encoded again. Continuously changing draw positions retain only the last command identity. Record storage is bounded by the current draw count (at most 256 KiB of record bytes plus metadata) and is cleared on encoding failure or project close. Each returned packet owns its bytes. Re-exporting changed the SDK code in game.js. Each profile used its original AAR, VM binary, native renderer, game source and assets.

The formal comparison removed the stage probes and used six alternating, matched cold-start pairs per profile on the same Fold7. Values are medians of six run-level nearest-rank p95s, in milliseconds. A separate three-launch native replay read the same recorded commands and had a median dispatch p95 of 0.012 ms. Replay has no script generation or VM copy.

| Host | Build | Generation p95 | Copy p95 | Dispatch to enqueue p95 | Submission interval p95 |
| --- | --- | ---: | ---: | ---: | ---: |
| Standard | Original | 0.834 | 0.142 | 1.276 | 8.727 |
| Standard | Record reuse | 0.702 | 0.156 | 1.111 | 8.824 |
| Trimmed | Original | 0.851 | 0.141 | 1.262 | 8.711 |
| Trimmed | Record reuse | 0.759 | 0.160 | 1.151 | 8.754 |

Standard V8 improved in 6/6 pairs, with median reductions of 0.152 ms and 17.8%. Trimmed V8 improved in 6/6 pairs, with median reductions of 0.114 ms and 13.2%. Each profile had to improve in at least four pairs, with a median gain of at least 0.100 ms and 10%. The paired median dispatch p95 had to hold or improve, and submission-interval p95 could rise by at most 0.250 ms. These host-side intervals cover dispatch through the submission callback. GPU execution, display presentation and power require separate measurements.

Dispatch-to-enqueue p95 fell by a paired median of 0.166 ms for standard V8 and 0.117 ms for trimmed V8. Submission-callback interval p95 rose by 0.088 and 0.030 ms respectively, within the 0.250 ms guard. Median process PSS while holding the terminal frame was 7.1 MiB higher for standard V8 and 4.9 MiB higher for trimmed V8. This first comparison measured total process PSS. The next section follows up with allocator and V8 heap measurements.

Both V8 profiles and both builds reproduced the #386 command and texture tape byte for byte (2,483,048 bytes). Each matched the 1,080 × 1,920 terminal viewport before and after EGL recreation, with eight total texture uploads and eight releases over two contexts. Ordinary interaction, close and reopen also passed. [Paired frame samples, replay and lifecycle receipts](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-v8-command-pairs.json)

A separate Windows x64 Node control isolated the encoder with 81 quads and twelve cold-process pairs per workload. With one quad changing, median run p95 went from 106.85 to 18.45 µs. With every quad changing, it rose from 95.30 to 110.65 µs. The next section tests fully changing quads on the Fold7. [Desktop encoder control](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/desktop-egr2-record-reuse.json)

### Fully changing draw records and held-frame memory on Fold7

The stress scene changes the transform of all 81 quads on every tick. All 16,929 adjacent record comparisons across 210 frames changed. Both V8 profiles and both encoder versions produced the same command tape. The complete 1080 × 1920 device captures matched across the eight builds, including after EGL recreation. Each build used two textures, with four uploads and four releases across the two contexts. A separate ideal image differed from the device capture at 4,141 pixels within a 22 × 195 region at the right edge. The hardware comparisons include that area.

Each profile had six matched cold-start pairs with a lightweight encoder timer and a separate six pairs without it. In the table, a positive difference means the #388 version took longer. Values are medians of within-pair p95 differences. Generation and dispatch come from the uninstrumented runs.

| Embedded V8 | Encoder p95 change | Pairs with higher encoder p95 | Generation p95 change | Dispatch-to-enqueue p95 change |
| --- | ---: | ---: | ---: | ---: |
| Standard | +8 µs (+2.14%) | 4/6 | +170.5 µs | +190.5 µs |
| Trimmed | +9.5 µs (+2.63%) | 6/6 | +3 µs | +7.5 µs |

One trimmed pair had a 330 µs higher encoder p95. Both median differences were below the 5% investigation threshold and the median empty-clock intervals of 19 and 18 µs. The trimmed signal was consistent in direction; neither profile met the predeclared rule for a material encoder regression. The larger standard-profile generation delta includes work outside the encoder. [Per-frame measurements, fixture and pixel checks](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-v8-fully-changing-quads.json)

For the original Moon Herbarium scene, 16 fresh cold starts balanced the order of the four production-build combinations. Sampling four seconds after the terminal frame gave median paired PSS increases of 4.83 MiB on standard V8 and 3.02 MiB on trimmed V8. Scudo allocator mappings rose by about 8.45 and 7.06 MiB, partly offset by lower anonymous read/write residency. The stock graphics totals changed by 0 and −216 KiB. These measurements describe resident process memory at one point in time.

Each diagnostic APK contained both frozen game bundles. Within each V8 profile, the two encoders used the same package and UID in separate cold processes. Within a process, the game, isolate, GPU resources and terminal image stayed alive across the interventions. With the cache still populated, asking Android's allocator to return unused pages reduced the difference in Android’s Native Heap summary (private dirty allocator pages) by 4,332 KiB on standard V8 and 5,096 KiB on trimmed V8, with less than 1.5 KiB change in the difference in allocated bytes. A subsequent V8 low-memory notification reduced that allocation difference from about 4.09 MB to −0.29 MB and from 3.52 MB to 0.26 MB. Clearing the 81 cached records (5,184 bytes of payload) reduced used V8 heap by a paired median of roughly 23 KiB relative to the baseline no-op. The corresponding process PSS changes were +18 KiB and zero. The raw results include the reversed standard-profile pair and the variation in graphics accounting between diagnostic launches. Purge and low-memory calls ran only in the diagnostic APKs. [Memory categories and matched interventions](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-v8-record-memory.json)

Four additional process-scoped heap profiles sampled native allocations on the Fold7. Both the standard and trimmed library build IDs matched the local V8 symbol files. At dumps bracketing terminal frame +4 seconds, sampled outstanding compiler Zone allocations increased by about 45 KiB in the standard comparison and 2.37 MiB in the trimmed comparison. The standard difference was smaller than one sampling interval (64 KiB). Each comparison has one profile per encoder, some stacks could not be unwound, and allocator residency includes freed pages. The profiles establish that V8 compiler work held native allocations during these captures; they cannot assign the entire PSS difference to a specific engine function. The initial four truncated traces were excluded. [Native allocation profiles and sampling limits](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-v8-native-allocation-stacks.json)

In a separate control, the same app waited at the terminal frame, serviced the ordinary V8 task queue and entered JavaScript once without advancing the game. The measured V8 malloc counter was unchanged across those steps; the later diagnostic low-memory notification reduced it. Servicing the queue again provided no evidence of an outstanding-task problem. This investigation keeps the #388 encoder and the host’s existing scheduling and memory policy. [Idle-task control](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-v8-idle-pump.json)

Finally, a fresh comparison on the original #386 scene used six uninstrumented cold-start pairs per profile. Standard V8 reduced generation p95 in all six pairs by a median 108 µs (12.9%). Trimmed V8 improved in five of six by 127.5 µs (15.4%). Both met the original acceptance rule. Dispatch to enqueue improved by 110.5 and 133 µs; the submission interval increased by 44.5 µs on standard and fell by 8.5 µs on trimmed. Each profile reproduced the original 2,483,048-byte command and texture tape and the full 1080 × 1920 viewport before and after EGL recreation, with eight uploads and eight releases over two contexts. [Original-scene paired recheck and recovery results](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7-v8-quad-recheck.json)
