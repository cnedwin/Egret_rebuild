# November desktop and Android GPU verification

English | [简体中文](../../Cns/docs/november-browser-hardware.md)

On the Windows RTX 5090 Laptop, shrinking a mipmapped image in WebGL2 could make the image disappear. The public mipmap example reproduced this with no game assets. On both Windows and Android, the documented example server returned HTTP 404 for the new 3D model gallery. Both fixes were tested on the devices that reproduced them.

The inventory covers the 98 first-parent merges from November 17 (UTC+8) through [84a56177, PR #442](https://github.com/cnedwin/Egret_rebuild/pull/442). The [measurement record](https://github.com/cnedwin/Egret_rebuild/blob/main/docs/evidence/november-browser-hardware.json) groups every PR by its main verification route and names the workloads sampled. Native Android changes use the existing [Fold7 installation, gameplay, resource, bridge and replay measurements](https://github.com/cnedwin/Egret_rebuild/tree/84a56177/runtime-sdk/measurements). Changes confined to build tools, documentation, packaging and CI retain their own checks.

## Fixes and controls

| Observation | Correction and verification |
| --- | --- |
| In Edge WebGL2 on the NVIDIA D3D11 driver, three minified regions all read the background value 32. The unfiltered control remained visible. The same page rendered correctly on Fold7. | A multi-level texture now uses `NEAREST_MIPMAP_NEAREST` for minification. The single-level and magnification paths retain nearest sampling. The Windows single-variable probe reproduced the change with the same uploaded bytes. On the production build the three regions read 188 with zero spread and no red bleed on Windows WebGL2 and WebGPU. Fold7 WebGL2 passed the same pixel checks after the fix. |
| The gallery link served by `pnpm example:browser` returned 404. | The server admits the gallery entry points and files from its model registry. Both devices opened all 24 models and responded to the size switch and orbit controls. An HTTP regression checks each registered route and an unrelated file. |
| The Windows Lanterns example verifier treated any existing gold light as a failure. Its first run counted 41 gold samples before the first shrine and 156 after it. | The verifier measures the additional lit area when the shrine activates. With the shrine's lighting and particles disabled the control rose only from 44 to 47 and was rejected. With the game intact, all seven official desktop scenarios completed, including all three shrines and restart. |
| A button inside a half-scale parent had only 22 CSS pixels of hit width after requesting 44. On both devices and backends only its center responded; all four corner taps missed. | Padding now maps a CSS square through the full ancestor transform into local coordinates. Direct, half-scale and rotated/mirrored buttons accepted all five test points on each of the four device/backend combinations. Degenerate transforms retain a finite local fallback. |

## Tested on the same source

Windows used foreground Edge 158.0.4370.33 and an RTX 5090 Laptop GPU. The Galaxy Z Fold7 (SM-F966U1) used Android 17, Chrome 157.0.8103.78 and Adreno 830. WebGL2 and WebGPU were explicitly selected for the paired workloads.

| Workload | What the device checks covered |
| --- | --- |
| World3D and Play3D | 24 procedural models, two posed rigs, GLB geometry and color round-trip, moving cloth, culling, sky and fog, navigation and spatial sound state, canvas font, overlays, pointer capture and Play3D. Twelve images on each device passed the existing cross-backend thresholds. Additional views covered near-light selection, implicit and explicit blending, screen markers and animation transfer between rigs with different bone axes. |
| Shared 2D and Play | Gradient strokes, masks, transformed corners, alpha clamping, crossing zero scale, linear and sRGB blending, HUD focus and input, save migration, and the Story game through its ending. On each backend the solid and texture-sampled paths drew 34,560 matching white pixels. On WebGL2, 240 draw commands batched into two observed native draws including presentation. In a six-frame 3D reflection control, measured and reported WebGL draw counts agreed at 2, 1, 1, 2, 1, 1. |
| Content, physics and browser services | JSON and binary skeletons built from the same source loaded two atlas pages. Native 96 × 48 readback gave identical image halves, with 72 red and 144 blue pixels in each. Groups, instances and source values drained on close. Distance and rope constraints, contact-triggered removal, a rejected recursive step and save rollback/reopen were exercised on both devices. The default audio path decoded all 14 presets before setup; opting out made zero default decode calls and allowed one caller-owned context. |

On Fold7, Breakout, Platformer, Memory and Lanterns3D completed and restarted on each backend. The Lanterns shrine gained 59 (WebGL2) and 54 (WebGPU) gold samples. The legacy timer, slow-frame catch-up, hidden-mask pixels, and tile updates also passed on Windows and Fold7.

Five browser image sources, IndexedDB storage and offline bundle replacement, particle blending, video MIME selection with 404 recovery, horizontal wheel handling, and reduced-motion behavior passed on both backends of each device. On Windows the wheel assertion follows the delta delivered by the browser at the actual display scale.

For #435 the same 1,024 × 1,700 game atlas was converted in a foreground Windows browser using the old and new implementations. The new path was faster in 12 of 12 pairs; the median paired reduction was 1.475 ms (6.500 to 5.025 ms). The mixed-alpha control was faster in 7 of 12 pairs (median saving 0.150 ms). The mid-alpha control was faster in 4 of 12 pairs (median slowdown 0.200 ms). Neither control showed a consistent gain. Output bytes agreed. These CPU conversion measurements cover neither game frame time nor GPU duration.

## Updates merged during the run

[#443](https://github.com/cnedwin/Egret_rebuild/pull/443) and [#444](https://github.com/cnedwin/Egret_rebuild/pull/444) landed during collection. The second pass uses 41cb0cb8. On both devices and backends, hard edges increased axis-aligned box face normals from 86.08% to 100% at the same triangle count. Camera movement selected and drew 1,800, 432, 96 and again 1,800 triangles. Returning to the near view reproduced its pixels. The CLI-baked 89,584-byte, 3,000-triangle crate matched the mesh made at runtime when both received the same wood material. All seven procedural surfaces changed color and lighting when their color and relief inputs were enabled separately.

The updated interactive gallery built 24 models in 7.89–8.02 s on Windows and 10.20–14.80 s on Fold7 in these individual launches. The Windows and Fold7 callback p95 values across the subsequent 90 intervals were 4.3 ms and 41.5–41.6 ms respectively. These single launches do not establish a performance regression between versions.

A UI leaf also created a real browser label under its own scope. Its 30-unit text height matched its committed layout; releasing the leaf removed all glyph pixels while the game's scope stayed open on all four paths.

## Frame intervals and outstanding scope

The fixed 119,000-triangle workload ran for 60 measured foreground callbacks per backend. Times are milliseconds. The CPU column measures the render call on the page thread.

| Device | WebGL2 callback p95 | WebGPU callback p95 | CPU p95, GL / GPU |
| --- | ---: | ---: | ---: |
| Windows | 4.2 | 4.2 | 0.2 / 0.3 |
| Fold7 | 16.7 | 16.7 | 1.3 / 1.7 |

The interactive gallery has a different camera and viewport. On Fold7 its 24 models took 9.23 s (WebGL2) and 11.43 s (WebGPU) to build in the observed openings; 90 subsequent callback intervals had p95 of 41.5 and 41.2 ms. This makes initial model construction and frame pacing measurable targets for the example. GPU time, power and sustained thermal behavior require separate measurements.

Phone input was injected into a browser on the physical device. Human listening, assistive-technology use, physical gamepads, Safari/iPhone and other GPU families require separate evidence. The short device workloads have no bearing on the performance budgets of #55 or #92. The Spine fixture is original numerical content; commercial Editor-export coverage has its own corpus.
