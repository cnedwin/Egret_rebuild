# Choosing a script host for an Android game

English | [简体中文](../../Cns/docs/android-project-player-v8.md)

A game exported with the [Android project player](android-project-player.md) can use the installed System WebView or include V8 in its AAR. All three builds use the same Rust GLES3 renderer, resource scope and Android view. Choose the script host when building the AAR. The game can still run inside its own Activity or an existing app.

| Build | Script environment | Minimum Android API |
| --- | --- | ---: |
| `webview` (default) | Installed System WebView, local HTML entry and browser APIs | 26 |
| `standard` | V8 15.7.112.19 with JavaScript `Intl` and packaged ICU locale data | 29 |
| `trimmed` | The same V8 version built without `Intl` or its ICU data | 29 |

Use the WebView build for games that rely on the DOM or need the smallest download. For a self-contained VM, choose standard when the game calls `Intl` for locale-aware formats or sorting. A game can display Chinese with all three hosts through Android's fonts. The two embedded profiles select Javet 6.0.3 arm64 artifacts. Build inputs, versions, hashes and licenses are pinned in the [source manifest](../../../runtime-sdk/android/v8-provenance.json).

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

The native replay benchmark uses a separate frozen EGR1 workload. The Moon Herbarium measurements cover the three live script hosts above. [Device record](../../../runtime-sdk/measurements/fold7-project-v8.json) · [Native replay comparison](runtime-sdk-v8-fold7.md)
