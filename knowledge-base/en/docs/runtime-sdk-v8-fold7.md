# Android script hosts on Galaxy Z Fold7

English | [简体中文](../../Cns/docs/runtime-sdk-v8-fold7.md)

The Android sample can run the packaged Egret scene using Android System WebView or an embedded V8 engine. A third mode replays the scene's commands directly. All four benchmark paths use the same Rust GLES3 renderer. These measurements cover one arm64 debug application on a Galaxy Z Fold7.

## Observations on Fold7

Same device and scene, Android 17, System WebView 157.0.8103.50. APK sizes are MiB, startup and frame intervals are ms. Startup and frame intervals summarize four runs. Parentheses show the range of process-cold startup times. PSS is the median of three resident samples in one separate run per path. APK size comes from the signed file.

| Path | APK | Process cold (range) | Frame interval p50 / p95 / p99 | Resident PSS (MiB) |
| --- | ---: | ---: | ---: | ---: |
| System WebView | 0.75 | 165.7 (145.4–194.9) | 8.300 / 8.302 / 8.303 | 160.4 |
| V8 with Intl | 22.04 | 103.7 (100.8–106.5) | 8.300 / 8.302 / 8.303 | 145.7 |
| V8 without Intl | 16.49 | 90.0 (88.5–92.3) | 8.300 / 8.302 / 8.303 | 136.9 |
| Native replay | 0.75 | 59.2 (54.8–64.2) | 8.300 / 8.302 / 8.303 | 62.5 |

The next table reports medians of the four per-run p50 values in ms. Request-to-ready already includes generation and transfer. In replay the request selects a stored command packet.

| Path | Generate | Direct transfer | Request to ready | GL queue | GLES CPU submit |
| --- | ---: | ---: | ---: | ---: | ---: |
| System WebView | 0.400 | 0.085 | 1.496 | 0.063 | 0.100 |
| V8 with Intl | 0.685 | 0.014 | 1.147 | 0.059 | 0.082 |
| V8 without Intl | 0.808 | 0.014 | 1.282 | 0.058 | 0.093 |
| Native replay | — | — | 0.001 | 0.103 | 0.110 |

The per-run record contains signed APK identities, frozen scene digests, foreground and resource receipts, and per-frame nanosecond data. In each timing run, relativeFrames.data is a Base64-encoded raw DEFLATE stream containing a JSON array of rows. Read each row in fields order and check the SHA-256 of the inflated bytes. [Device measurements](../../../runtime-sdk/measurements/fold7-v8.json)

The trimmed APK saved 5.55 MiB (25.2%) versus standard. Its startup was faster in all four matched blocks. The standard build had the shorter median request-to-ready interval in all four blocks. All four paths had a frame interval p95 of about 8.30 ms. For a title that already ships locale-aware content, this scene provides no frame-cadence reason to remove `Intl`.

The correctness launch of the standard profile unpacked 10,824,432 bytes of ICU data and acknowledged the first draw at 127.4 ms, including diagnostic checks. All four formal startup values for that profile used the verified file already on disk. In each diagnostic run the recovered context uploaded its atlas again, abandoned one lost context and released the final GPU page. Each live scene released one engine lease. The standard launcher also resumed after backgrounding and released its lease on Back. A separate timed launch interrupted by backgrounding recorded a failure as intended.

The first two complete timing blocks were retained. Android installation stalled before the next complete block, and Android later rejected one activity start after a package replacement. The interrupted block and the zero-frame start remain in the data. Once Android's package manager was ready, blocks three and four ran in the frozen order. Installation and process-reset work preceded the timing origin.

## Choosing a build

| Build | Script execution | Intended use |
| --- | --- | --- |
| System WebView | The OS supplies the script engine. | Default when install size matters or the game needs the existing WebView environment. |
| V8 with internationalization | The APK supplies V8 and its internationalization support. | Bundled games that need the qualified JavaScript host and locale services. |
| V8 without internationalization | The APK supplies a build of the same V8 release without its internationalization support. | Bundled games whose code and dependencies can run without `Intl`. |
| Replay | The base APK reads a previously captured cycle. | Isolate the cost of the renderer, scheduling and native replay. Interactive game code runs in the three live paths. |

The package choice belongs to the application. Check the game’s elapsed-time, locale and platform API requirements before selecting an embedded VM. An app that embeds V8 must ship runtime security updates with its own releases. The sample loads application-bundled game code and exposes the services it needs. Both pinned arm64 V8 builds disable the upstream V8 sandbox in their GN configuration. An isolate in this app process is therefore unsuitable as a security boundary for third-party plug-ins or downloaded scripts. WebView remains independently serviced by the platform. [Javet](https://github.com/caoccao/Javet) · [V8 embedding](https://v8.dev/docs/embed)

The builds use Javet 6.0.3 and V8 15.7.112.19. The two upstream arm64 build configurations differ in `v8_enable_i18n_support`. The standard APK includes matching ICU data. On first use it verifies and unpacks the data to a digest-named file in private app storage. Report that one-time cost separately from subsequent process-cold launches. The base APK supports Android API 26 and above. The embedded builds require API 29 and above to match the upstream native library target. [Upstream Javet sources](https://github.com/caoccao/Javet/tree/5d51b4eb)

## What the four paths share

The scene renders two solid rectangles and 40 animated atlas quads into a 320 × 192 surface, using a single 32 × 8 RGBA page. Each cycle contains 60 distinct command packets, 2,040 bytes each. The three live paths generate the packets with the engine's scene, resource scope and encoder. Replay uses the captured packets. Rust owns the rendering resources in every path. The test compares commands across the entire cycle, reads back the last frame, recreates the GLES context with the atlas retained and accounts for the live texture and scene lease at closure. [Original scene and measurements](runtime-sdk-fold7.md)

## How to read the measurements

Each timing run begins with the app process stopped and the filesystem cache retained. Cold startup runs from Android process birth to the UI thread acknowledging the first submitted GLES draw. Each run warms up for 60 callbacks and then records 300 callbacks, yielding 299 adjacent intervals. The four paths rotate through each position in four blocks. Use the per-run results to see variability. Decode and bridge clocks describe CPU work and scheduling. A display callback interval includes pacing by the OS. Neither clock measures GPU execution or scanout.

Memory is sampled with the scene resident, in a separate run. The WebView path includes its attributable renderer process when Android reports the association. Shared system services can have other clients. Package size means the signed arm64 debug APK on disk. The system-provided WebView does not contribute bytes to this APK. Store download sizes and energy consumption require separate measurements.

The WebView host measures command generation with `performance.now()`, then Base64-encodes, returns, decodes and copies the packet. Its direct transfer timer covers only Android callback parsing, decoding and copying. Embedded V8 uses a monotonic clock exposed to script and measures the copy from a borrowed ArrayBuffer to Android-owned memory. Request-to-ready includes dispatch on the relevant threads for both paths. The direct transfer timers have different boundaries and the clocks have different resolution. Use the two V8 profiles for a controlled comparison of internationalization.

[Android build and launch instructions](../../../runtime-sdk/android/README.md)
