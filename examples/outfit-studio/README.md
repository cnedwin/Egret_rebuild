# Egret Outfit Studio

English | [简体中文](README.zh-CN.md)

The default compact view of Outfit Studio joins an editable character roster, two Spine instances, a sequence effect, a two-panel backdrop and a native rename dialog in one Engine. The two characters start on the same atlas pages and carry independent outfits and playback state.

From the repository root, run `pnpm setup:dev` and then `node examples/outfit-studio/serve.mjs`. Open the printed local address and select WebGPU or WebGL2. The desktop view uses a 960 × 520 logical surface with pixel ratio 1. Use the mouse or Tab and Enter to choose a character and apply an outfit. Open Details, choose Rename, and select the field to edit it. Save checks the name against the scene's font set and commits it to the project. A refused name keeps the dialog open for a new draft. Cancel discards the draft. A mouse action requires release within the pressed row.

Swap palette stages a new Spine asset through the shared scene Host. The previous frame stays visible during loading. If loading or staging fails, the current character and project remain usable and the same row can retry the change. Each successful swap starts the chosen actor's animation through the existing RESET policy. Close releases the view, playback, fonts, asset groups and Host. Reload opens the authored project again.

Edit `project.json` and restart the server to see the change. The two stable entity IDs identify the characters and their `name`, `outfit` and `palette` fields. `Export project` downloads the current committed snapshot. To open it, run `node examples/outfit-studio/serve.mjs --project <path-to-snapshot>`. Playback time, selection and the draft belong to the current session. The sample reuses the existing project store and shared resource manager. [Example project](project.json)

The Studio uses the original programmatic Spine and sequence sources from `animation-outfits`. The second palette exchanges the two existing page colors and builds a fresh manifest identity. The studio code and original scene geometry are Apache-2.0. [Animation provenance](../animation-outfits/PROVENANCE.md) · [CanvasKit and Noto assets](../paragraph-panel/vendor/README.md) · [Spine runtime terms](../../third-party/spine-core-4.3.13.LICENSE) · [JSONC parser attribution](../../third-party/jsonc-parser-3.3.1.LICENSE)

Run `node examples/outfit-studio/verify.mjs <absolute-Playwright-package> <new-absolute-output-directory>` with Playwright 1.62.1 and installed Edge. The batch exercises both actual browser backends, mouse and keyboard, rejected names, drag-out releases, palette failure and retry, export and reopen, and cleanup. It records three cold HTTP samples per backend through the first completed frame with interaction enabled. The recorded transfer is uncompressed loopback HTTP. [Verification summary](verification-summary.json)

## Fixed scene profiles

Use the same server and choose **Fixed desktop** or **Mobile touch**. The default address keeps the compact project. The fixed routes expand the original two-character snapshot with six stable reference actors. All eight can be selected through the catalogue. The command-line verifier reopens the exported fixed snapshot and checks the IDs and authored edits. Opening an exported project in the browser UI is tracked in [#91](https://github.com/cnedwin/Egret_rebuild/issues/91). [Fixed workload and layout](workload.mjs)

| Profile | Logical surface and render ratio | Initial catalogue |
| --- | --- | --- |
| X-D60/1, `?profile=x-d60&backend=webgpu` | 1024 × 768 at 1 | 32 visible rows, at most 48 containers |
| X-MTouch/1, `?profile=x-mtouch&backend=webgl2` | 360 × 640 portrait or 640 × 360 landscape at 2 | 8 visible rows, at most 24 containers |

Each fixed scene has 6,000 ordered authored display nodes, 600 visible UI nodes including active row descendants, eight nested clips, an alpha mask, a radius-two blur and 50,000 variable-height catalogue records. The eight Spine instances each use 120 bones, 96 slots, 2,000 weighted mesh vertices and two active tracks. They share the initial two atlas pages. Eighty independently phased sequences and two flat 2D backdrop panels complete the current scene. The form uses the existing CanvasKit/Noto set for English, Chinese, Arabic and the admitted 🆕 glyph. [Original weighted geometry](author-x.mjs)

On a phone, hold **+** to move and use a second contact on **■** to act. Drag the scene with one finger or pan, pinch and rotate with two. The map keeps two gesture owners and refuses an additional map contact. Swipe the catalogue to scroll or tap the committed record to select. A drag at its edge can move the drawer by up to 12 logical pixels. Opening a modal cancels held contacts. Rotation rebinds the view and closes its transient draft while keeping the authored snapshot, catalogue position and animation state. The keyboard resizes the fitted view at the current logical orientation. CSS safe-area insets and letterboxing map to the logical surface independently of the render ratio.

## Fixed profile verification

With installed Edge and Playwright 1.62.1, run `node examples/outfit-studio/verify-fixed.mjs <absolute-Playwright-package> <new-output-directory> --check`. To record timings, use `--timing` with a fresh output directory. Each backend/state warms for 30 seconds before five 60-second windows. The advancing states move the first 60 or all 6,000 ordered nodes by alternating 0 and 0.25 logical pixels, then advance one 1/60-second clock tick. The static state holds its initial pose.

### Historical mixed-scene results

The table and Android results were recorded with the original two depth quads. The current two-panel example can still run the fixture for development checks. Formal [#92](https://github.com/cnedwin/Egret_rebuild/issues/92) timing requires equivalent mixed composition or a reviewed successor profile.

| Backend | State | Synchronous elapsed p95 (ms) | Host-inclusive p95 (ms) | Completed-frame interval p95 (ms) | p99 (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| WebGPU | static | 33.9 | 30.1 | 41.1 | 76.8 |
| WebGPU | sparse | 75 | 35.1 | 82.4 | 89 |
| WebGPU | full | 74 | 34.6 | 82.2 | 88.6 |
| WebGL2 | static | 37.9 | 34.4 | 46.3 | 85.4 |
| WebGL2 | sparse | 80.7 | 40.5 | 87.5 | 91.4 |
| WebGL2 | full | 87.8 | 38.9 | 96 | 104 |

The table uses medians of the per-window percentiles. Each synchronous elapsed sample sums animation, capture and the synchronous Host span for one frame. The Host span includes preparation, packing and submission. Driver waits or preemption can contribute to elapsed time, so the 8 ms comparison is diagnostic. The completed-frame interval targets were missed. Formal whole-engine CPU, preparation and GPU timing remain open. The raw traces keep UI elapsed and fixture mutation separate. The startup record uses uncompressed loopback transport.

On physical Android Chrome, both backends completed 100 controlled touch responses and the multi-contact, scroll, modal, system keyboard, rotation and Home/resume cases. The response p95 was 412.4 ms on WebGPU and 383.6 ms on WebGL2 against the 100 ms target. The test injects touch contacts through CDP and observes matching completed frames. Human touch and CJK composition, iPhone Safari, compressed startup and the sustained lifecycle campaign remain open. [Recorded evidence and source hashes](fixed-verification-summary.json) · [M4 acceptance plan](../../knowledge-base/en/docs/m4-core-acceptance-plan.md)
