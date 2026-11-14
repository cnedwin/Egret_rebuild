# Shared 2D hardware results

English | [简体中文](../../Cns/docs/shared-2d-hardware-results.md)

## Graphics, blending and filters

The source baseline was [db9772ee](https://github.com/cnedwin/Egret_rebuild/commit/db9772ee104e77b5c34e4c59bbc6f7dde7e90419). The tested fix is commit `435b394b`. The later `e4ac428e` checkout changed only the three repository ledgers through [#307](https://github.com/cnedwin/Egret_rebuild/pull/307) and was used for the last four Android control cases. The fix renames the WGSL spread shader's reserved `from` identifier and makes the filter example verifier read native backing pixels. Tests use the existing examples and independent pixel equations. Protocol input remains separate from human interaction.

The original Windows Edge 157.0.4341.46 run on an RTX 5090 Laptop GPU passed Graphics and blend cases and failed the WebGL2 filter screenshot oracle at fractional layout boundaries. At the glow edge, the screenshot returned RGB (199, 149, 56) against (206, 155, 57). Native WebGL2 readback on the same engine and scene returned (207, 155, 57), within the original tolerance. At GPU startup, Dawn rejected the separate WebGPU spread shader at `CreateShaderModule` because `from` is reserved. The fix keeps the filter math and screenshot evidence, and compares expected texels against the GPU-completed backing image at integer coordinates.

| Device | WebGL2 | WebGPU |
| --- | --- | --- |
| Windows Edge 157.0.4341.46, RTX 5090 Laptop | 10 scoped cases passed | 10 scoped cases passed |
| Galaxy Z Fold7 Chrome 157.0.8103.78, Adreno 830 | 10 scoped cases passed | 10 scoped cases passed |

Each backend has three Graphics cases, two blend cases, two filter cases and three stress cases. Filter samples include 16 positions around each of six tiles, both enabled and disabled. Blend verifies transparent erase against the page compositor as well as native RGBA. Stress uses a 640 × 360 backing buffer, 60 serial completed frames at each of 4,096 distinct triangle geometries, 500 overlapping blend pairs and eight filter groups. Geometry refuses the next unique item. The filter lane checks a new graphics generation and matching witnesses after native loss and recovery, and closes its ownership scope. Resource counters are logical. The serial intervals are diagnostics for these workloads.

The first Fold7 interaction probes did not observe the expected control transitions. A follow-up encountered a visual viewport offset after scrolling. The final probes convert layout coordinates to the visible viewport, wait for the expected state before reading pixels and record browser-dispatched touch events. During the Android runs, the device was checked periodically for awake and unlocked state, and the original stay-awake setting and browser tab inventory were restored.

## Paired shared-frame timing

The comparison isolates [#285](https://github.com/cnedwin/Egret_rebuild/pull/285), [#287](https://github.com/cnedwin/Egret_rebuild/pull/287) and [#288](https://github.com/cnedwin/Egret_rebuild/pull/288) between [af7a08c2](https://github.com/cnedwin/Egret_rebuild/commit/af7a08c22e275087a8ce57575076ce689e12e92f) and [8b607c4d](https://github.com/cnedwin/Egret_rebuild/commit/8b607c4dde8cf1045084a37eb45b3458896d9e65). ABBA order pairs runs on each device with matching browser, native backend, fixed inputs and 1,280 × 720 backing resolution. Each row uses 40 serial samples and 120 paced rAF attempts with admission and drain accounting. A separate GPU timer cohort attempts 40 samples where supported. Readback and timer queries run outside the pacing samples. Unavailable and disjoint GPU results have no duration.

| Windows workload | Backend | Median preparation change by pair (ms) | Median Host submission change by pair (ms) | rAF p95 change by pair (ms) |
| --- | --- | ---: | ---: | ---: |
| 5,000 fully changed clipped bitmaps | WebGPU | −0.55 / −1.10 | −1.10 / −1.00 | 0 / 0 |
| 5,000 fully changed clipped bitmaps | WebGL2 | −1.40 / −0.75 | −1.20 / −1.05 | −3.80 / 0 |
| 5,000 moving rectangles | WebGPU | −0.60 / −0.75 | −1.05 / −0.80 | −4.00 / 0 |
| 5,000 moving rectangles | WebGL2 | −1.70 / −0.85 | −2.00 / −1.20 | −4.20 / −0.10 |

Windows recorded CPU reductions on the selected dense workloads. Static and sparse results were mixed. The first final WebGPU rectangles row lost Windows foreground during its final preparation or cleanup phase. The targeted repeat satisfied the same foreground guard and replaced that row in the reported comparison. WebGPU timestamp medians were zero at the exposed precision, and WebGL2 GPU timing varied between pairs. The evidence establishes no steady GPU speedup or universal frame-pacing gain.

| Fold7 workload | Backend | Median preparation change (ms) | Median Host submission change (ms) | rAF p95 change (ms) | rAF p99 change (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| 5,000 fully changed clipped bitmaps | WebGPU | −1.00 / −1.50 | +4.60 / +0.80 | 0 / 0 | 0 / 0 |
| 5,000 fully changed clipped bitmaps | WebGL2 | −2.65 / −0.05 | +0.35 / +0.25 | +16.50 / +0.10 | 0 / +0.10 |
| 5,000 moving rectangles | WebGPU | −2.50 / −2.50 | −1.35 / +2.00 | 0 / 0 | 0 / −16.50 |
| 5,000 moving rectangles | WebGL2 | −3.00 / −0.80 | −0.75 / −1.85 | 0 / −16.50 | 0 / 0 |

On Fold7, the isolated full-dirty clipped bitmap preparation cost fell on both backends in both pairs. Inclusive Host submission became slower. WebGPU refusals out of 120 attempts were 0 / 16 / 11 / 9 in ABBA order. WebGL2 refusals were 4 / 12 / 12 / 7, and its callback p95 was 16.7 / 33.2 / 33.2 / 33.1 ms. WebGPU showed an unchanged 1.966 ms timer median for that load. WebGL2 had no usable GPU timer. Battery sensor readings ranged from 31.5 to 32.4 °C and record the sampled conditions only.

A separate instrumented WebGPU run on Fold7 reproduced full-dirty Host submission increases of +3.20 / +1.05 ms. The largest measured synchronous span was preparation inside the Host (+2.35 / +1.20 ms). Standalone capture was +1.95 / +1.00 ms and the later native submission span was +0.30 / +0.10 ms. The in-Host result differs from the isolated preparation cohort. These are synchronous wall spans from an instrumented run, and can include runtime scheduling or garbage collection. Attribution within that span remains open. Static Host submission moved in opposite directions in the instrumented pairs.

The fixed comparisons measure the selected changes. [#55](https://github.com/cnedwin/Egret_rebuild/issues/55) owns the earlier formal frame-pacing acceptance, and [#92](https://github.com/cnedwin/Egret_rebuild/issues/92) owns formal mixed-scene and long-duration qualification.
