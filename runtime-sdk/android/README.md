# Android 2D Runtime sample

English | [简体中文](README.zh-CN.md)

This arm64 debug APK runs the shared 2D scene on a Rust GLES3 renderer. The packaged game runs in Android System WebView by default. Optional builds embed V8. Both script hosts send one encoded command buffer per frame to the native surface. Replay reads the frozen cycle directly. All paths use the same atlas, viewport and Rust executor.

## Build

Install the project Node version, JDK 17, Android platform 35, SDK Build Tools 35.0.0, Android NDK r27c, and Rust with the `aarch64-linux-android` target. Set `JAVA_HOME`, `ANDROID_HOME` and `ANDROID_NDK_HOME` to these installations. The Rust installation must include its matching `share/doc/rust/COPYRIGHT-library.html` for distribution. Build the JS workspace, then generate the scene in a fresh output directory using esbuild 0.28.2.

```text
node runtime-sdk/scene/build.mjs --esbuild <esbuild-module> --out <scene-directory>
node runtime-sdk/android/build.mjs --scene <scene-directory> --output <output-directory>/egret-runtime.apk
```

The APK builder compiles the Rust archive, links the JNI library, compiles Java, packages the game and third-party notices, signs with a local debug identity and checks the signed APK, including nested asset names and 16 KiB ZIP alignment. To reuse an archive built from this source, pass `--rust-lib <archive>` and `--rust-notice <matching-COPYRIGHT-library.html>`. Keep `egret-debug.p12` beside the output APK to update the same installation. Keep the build output and debug key outside the checkout.

## Optional V8 builds

Omit `--v8-profile` for the default System WebView APK. Use a separate output path for each V8 build and the same signing key if comparing them on one phone. The build downloads checksum-pinned Javet archives into the specified cache. The standard build also includes the matching ICU data. An existing populated cache can be reused offline.

```text
node runtime-sdk/android/build.mjs --scene <scene-directory> --v8-profile standard --v8-cache <cache-directory> --keystore <debug-key> --output <standard-directory>/egret-runtime.apk
node runtime-sdk/android/build.mjs --scene <scene-directory> --v8-profile trimmed --v8-cache <cache-directory> --keystore <debug-key> --output <trimmed-directory>/egret-runtime.apk
```

Use `--es mode v8` to run a timed batch in an embedded build. `--es mode native` selects System WebView and `--es mode replay` selects the captured commands. The standard build checks Chinese number formatting at startup. The trimmed build omits `Intl`. Choose a profile against the game and its dependencies. [Build profiles and hardware results](../../knowledge-base/en/docs/runtime-sdk-v8-fold7.md)

## Run on an authorized phone

```text
adb -s <serial> install -r <output-directory>/egret-runtime.apk
adb -s <serial> shell am start -n org.egret.runtime.sample/.GameActivity --es mode native --es runId live-01 --ei warmup 60 --ei samples 300 --ez finish true
adb -s <serial> shell run-as org.egret.runtime.sample cat files/result.json
```

Poll until both `runId` matches and `status` reads `complete`. Repeat with `--es mode replay` and a distinct run ID. Launching from the app icon plays the live scene continuously. Tap the animation to pause or resume. Going to the background keeps the scene lease and retires the GPU page. Returning uploads it to the fresh context and continues at the saved cycle position. Back closes the engine scope and the native renderer. The demo retains only its current frame and cycle position. Its separate `files/demo.json` receipt records foreground transitions and closure. A timed batch leaves its last frame visible unless `finish` was requested. Losing foreground during measurement records an interruption.

For a correctness pass, add `--ez verify true`. The host checks the fixture digests and compares each live frame to the corresponding recorded bytes across at least one full cycle. Add `--ez recover true` to request Android EGL context recreation halfway through the batch and reupload the retained atlas. Run timing separately with both flags omitted. Compare the top-down RGBA hash for the same last cycle index in both modes and the H5 control.

The result includes raw Choreographer timestamps, JS evaluation and decode/queue intervals, CPU-side GL submission, process and activity start to first submitted draw, final host-process PSS and resource release counts. WebView uses an additional renderer process; host PSS alone cannot measure total memory. The JS interval includes building and encoding the frame. Compare the full live and replay paths separately from this component. Display presentation, GPU execution and power require separate observations. Use the same device settings, target resolution and workload when comparing hosts.
