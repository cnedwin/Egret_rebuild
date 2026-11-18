# The first Android 2D host on Galaxy Z Fold7

English | [简体中文](../../Cns/docs/runtime-sdk-fold7.md)

All three paths drew the same final image on one Fold7. With the 2,040-byte frame packet, producing and returning a live packet through Android System WebView took 1.50–1.57 ms at the median across runs. Live Rust draw submission took 0.088–0.110 ms on the GL thread. This identifies the script bridge as the larger CPU-side interval for this workload. [Architecture](runtime-sdk.md) · [per-run data](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7.json)

## What ran

The three paths used the same 320 × 192 backing buffer, two solid quads, 40 animated atlas quads and one 32 × 8 RGBA8 page. The live app ran the Egret scene in a detached WebView, then Rust GLES3 drew a native surface. Replay read 60 captured command packets cyclically and used the same Rust executor. Chrome used Egret’s existing SharedFrame2D WebGL2 executor. The APK contains arm64 debug code built against engine revision `859bd0ee`. [Build and run the sample](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/android/README.md)

Measured on Android 17 with Chrome/157.0.8103.78, Adreno 830 and USB power. All runs used aspect-fit presentation. The physical rendering resolution is fixed; browser controls can change the CSS viewport independently of the drawing buffer. The device stayed awake and unlocked during acquisition. Initial/final battery temperatures across the nine short runs were 30.0–30.2 °C, with thermal status 0.

## Repeat the H5 measurement

Serve the generated scene directory over HTTP and open its index.html in foreground Chrome on the phone. After the page title becomes egret-ready, the console calls below reproduce one timing run, followed by its untimed pixel and cleanup checks. Use a fresh navigation for each startup sample.

```js
const bench = globalThis.EgretRuntimeBenchmark;
const startup = await bench.ready;
const timing = await bench.run(60, 300);
const image = await bench.pixels(59);
const cleanup = await bench.close();
```

## Frame intervals and startup

Each row is one run, in execution order, after 60 warm-up frames. Percentiles use nearest rank. H5 records 300 consecutive requestAnimationFrame intervals. Each Android recording contains 300 Choreographer callback timestamps and therefore 299 adjacent intervals. CPU submit is wall time spent on the submitting thread. The startup column uses the clock endpoints described below.

| Run | Path | Frame interval p50 / p95 / p99 (ms) | CPU submit p50 (ms) | First frame (ms) |
| ---: | --- | --- | ---: | ---: |
| 1 | H5 | 16.600 / 16.700 / 16.700 | 3.800 | 540.9 |
| 2 | Native live | 8.289 / 8.290 / 8.290 | 0.110 | 158.1 |
| 3 | Native replay | 8.288 / 8.291 / 8.292 | 0.121 | 53.0 |
| 4 | Native live | 8.288 / 8.290 / 8.291 | 0.088 | 168.5 |
| 5 | Native replay | 8.288 / 8.291 / 8.291 | 0.110 | 59.8 |
| 6 | H5 | 16.600 / 16.700 / 16.700 | 3.800 | 567.1 |
| 7 | Native replay | 8.288 / 8.290 / 8.294 | 0.123 | 63.8 |
| 8 | H5 | 16.600 / 16.700 / 16.700 | 3.800 | 534.6 |
| 9 | Native live | 8.288 / 8.291 / 8.291 | 0.107 | 169.4 |

H5 starts at fresh navigation in an existing Chrome process over a USB loopback connection, and stops when the first renderSharedFrame call returns. From scene initialization to the same point measured 32.0–33.4 ms. Navigation to the first GPU retirement measured 536.0–569.0 ms. Android starts at OS process birth and stops when the UI callback acknowledges the first GL-thread draw. From Activity creation to that acknowledgement measured 143.1–157.5 ms live and 42.0–51.5 ms in replay. Filesystem caches were retained. Visible scanout and first input latency were outside the instruments.

H5 waits for the shared host to retire its previous GPU work before requesting another callback. Android admits one packet at a time and requests its next callback after GL submission returns to the UI thread. The observed callback cadences include these scheduling choices. A speedup ratio would require matched pacing, backpressure and presentation endpoints.

## Bridge and memory

On the live path, the JS-local median was 0.60–0.70 ms, including game capture, packet encoding and Base64. The median residual was 0.99–1.05 ms, computed by subtracting that frame’s JS-local elapsed time from its request-to-bytes-ready elapsed time. The residual includes VM scheduling and return, JSON parsing, Base64 decoding and the Java buffer copy. In replay, selecting a stored packet took 0.001 ms at the median. These elapsed times include waiting and carry JS timer quantization.

H5 sampled Chrome browser-process PSS immediately before and after timing, then read pixels and closed its resource scope. End PSS was 269.4–270.3 MiB. The APK sampled its host process after the final readback and GL page release, before JS lease teardown. Live was 107.0–107.5 MiB and replay 60.7–61.0 MiB. These endpoint samples exclude isolated renderer/GPU services, and Chrome parent PSS can include unrelated browser state. Peak game memory and whole-device energy require separate instruments.

### Resident process samples

A separate run kept the scene resident and sampled PSS three times per path. For H5 the samples followed 60 measured callbacks while the page retained its resources. The two APK modes each started in a fresh app process and kept drawing during sampling. Values below are ranges of these observations, in MiB.

| Path | Host or browser process | Attributed renderer | Observed subtotal |
| --- | ---: | ---: | ---: |
| H5 | 271.7–275.2 | 52.7 | 324.4–327.9 |
| Native live | 100.4–103.3 | 45.4–50.5 | 148.6–150.9 |
| Native replay | 59.0–59.4 | none attributed | 59.0–59.4 |

The Android service binding identifies a WebView renderer owned by the app. For Chrome, a performance.mark from the owned page identified one OS PID in the trace. CDP classified it as a renderer, Android identified it as a Chrome sandboxed process, and dumpsys meminfo --local returned its PSS. Subtotals add only the named processes at each sample. Other browser state can contribute to the Chrome parent, and shared GPU services and the system compositor remain outside these sums.

Opening the installed app through the launcher, sending it to the background, returning and closing it produced 973 completed frames, 2 resumed sessions, 2 atlas uploads, 2 GL releases and one engine-lease release.

## Pixels, recovery and teardown

H5, live and replay produced the same complete top-down RGBA digest at cycle slot 59 in every timed run. An untimed native diagnostic verified all 60 live packets against the frozen replay, checked asset digests and forced an EGL context recreation. Both APK modes reported two device creations, two atlas uploads, one abandoned old context and one final GL page release. The live app released one engine asset lease. H5 released its single lease and closed with zero pending frames, upload bytes and readback bytes. An earlier APK exposed mixed path separators in nested assets on Windows; the corrected APK verifies the final signed ZIP entries. See the [per-run data](https://github.com/cnedwin/Egret_rebuild/blob/main/runtime-sdk/measurements/fold7.json) for the APK, command cycle, atlas and image digests.
