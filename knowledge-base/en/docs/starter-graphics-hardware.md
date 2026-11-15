# Starter and Graphics hardware verification

English | [简体中文](../../Cns/docs/starter-graphics-hardware.md)

The November 15, 2026 run covers [drawn-object hit testing and taps](https://github.com/cnedwin/Egret_rebuild/pull/311), [motion and PNG loading](https://github.com/cnedwin/Egret_rebuild/pull/312), [display members, browser fit and labels](https://github.com/cnedwin/Egret_rebuild/pull/313), [gradient conversion and shared geometry](https://github.com/cnedwin/Egret_rebuild/pull/314), and [edge smoothing](https://github.com/cnedwin/Egret_rebuild/pull/315). The tested source is `a918a5045676a7aa27b4b2e0e9c5a3e7f91c6c70`, built from frozen main `bf400bfb96920327106bc8c915004d373d10a9d4` plus the fixes described below. The [shared 2D hardware report](shared-2d-hardware-results.md) provides the prior evidence for blending, filters and device recovery.

## Starter

Installed Edge 157.0.4341.46 on Windows 11 used the RTX 5090 Laptop GPU. Chrome 157.0.8103.78 on the Galaxy Z Fold7 used the Adreno 830. WebGPU reported a non-fallback adapter on both devices. Each device covered automatic WebGPU selection, a controlled no-adapter WebGL2 fallback and all four fit modes on both forced backends. The checks covered clipped input coordinates after live holder resizing, the `480 × 270` logical canvas and `720 × 405` backing store at ratio 1.5, transformed display hits, motion to a coin, the label output, PNG loading and deduplication and disposal. The desktop path used a browser mouse. The phone path used the Chrome DevTools Protocol to send touch contacts to the physical device.

On Windows, the existing `cover` verifier required exact equality at the centre, where the browser reported `240.000034` for 240. It now uses an off-centre point and a tolerance of one projected CSS pixel, and still checks that the coin was collected. On the Fold7, an initial WebGPU row sampled the ring hole as the moving hero crossed it. Sampling before motion isolated the hole. Both original receipts were retained.

All ten startup and fit cases per device passed, including the isolated Fold7 rerun. The route's first observed completed frame across the forced fits was 156.1–164.8 ms on Windows WebGL2, 294.1–316.7 ms on Windows WebGPU, 1,320.9–1,368.0 ms on Fold7 WebGL2 and 1,312.9–1,421.5 ms on Fold7 WebGPU. These are single observations per fit on an already running browser, from page navigation through the test's completion observation.

The starter pressure fixture moves 1,200 rectangles for 80 browser callback intervals. It also takes 20 serial samples of CPU render and submission followed by a separate API idle wait. Times are in ms.

| Device | Backend | Callback interval p95 | Render and submit p95 | Idle wait p95 |
| --- | --- | ---: | ---: | ---: |
| Windows | WebGL2 | 4.2 | 2.5 | 6.2 |
| Windows | WebGPU | 4.3 | 2.1 | 3.4 |
| Fold7 | WebGL2 | 16.6 | 13.1 | 5.2 |
| Fold7 | WebGPU | 16.6 | 10.9 | 8.0 |

## Graphics

Each device and backend passed 32 native backing-pixel checks, covering boundary coverage, unchanged interiors, linear gradient stops, hole pixels, and geometry replay after a redraw. The shared-shape checks observe identical geometry for equal drawings, distinct geometry for a different radius or colour, and reuse when the original drawing is restored. The separate pressure fixture checks radial colour.

Before the fix, each Windows backend showed 4,182 of 96,224 deep-interior texels drifting by more than two byte values when edge smoothing was enabled on a translucent three-stop radial gradient. The maximum channel change was 200. Adaptive refinement left unequal adjacent subdivisions, after which smoothing treated internal edges as outlines. The fix carries original boundary membership through each split and feathers only those edges. The same probe after the fix found zero interior texels outside tolerance on both backends on both devices. `GS05` also checks this boundary rule without a graphics device.

The first stress input, 16 distinct radial shapes, was refused on both Windows backends. WebGL2 reported `WEBGL2_GEOMETRY_RANGE` with a tuple-comparison budget failure during clipping, and WebGPU reported `WEBGPU_FRAME_BUDGET`. The defaults were kept. The measured workload uses six radial shapes with 15,398 source triangles and 879,712 logical geometry bytes in the initial capture. All four device and backend combinations preserved geometry identity for 40 transform-only captures and matched the expected reuse and separation for 12 alternating recolour redraws.

The 40 serial pressure frames record the browser callback interval, CPU capture, inclusive Host submission and total CPU capture through API completion. The cold column is a separate five-call draw sample for a radius-200 radial gradient on a fresh shape, before capture. Times are in ms.

| Device | Backend | Callback interval p95 | Capture p95 | Host submission p95 | Total p95 | Cold draw median / max |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Windows | WebGL2 | 16.7 | 1.5 | 4.5 | 11.3 | 28.1 / 29.7 |
| Windows | WebGPU | 8.4 | 1.5 | 3.2 | 8.6 | 27.5 / 28.7 |
| Fold7 | WebGL2 | 24.9 | 7.0 | 8.5 | 19.9 | 34.5 / 52.6 |
| Fold7 | WebGPU | 33.2 | 11.6 | 8.8 | 23.2 | 34.4 / 45.6 |

Large radial redraws still incur the cold tessellation cost. The serial workload waits for completion on every frame and its callback intervals include that wait.

These samples cover the specified short browser workloads. Chrome touch events, live CSS resizing and fixed backing-ratio checks do not exercise Android OS rotation, folding or human input. Submission and completion timings include CPU and browser effects. GPU execution time, presentation latency, thermal behaviour and power remain unmeasured here. This run does not change the acceptance status of [#55](https://github.com/cnedwin/Egret_rebuild/issues/55) or [#92](https://github.com/cnedwin/Egret_rebuild/issues/92).
