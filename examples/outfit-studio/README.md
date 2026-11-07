# Egret Outfit Studio

English | [简体中文](README.zh-CN.md)

This first desktop slice of M4.1 joins an editable character roster, two Spine instances, a sequence effect, a procedural 3D background and a native rename dialog in one Engine. The two characters start on the same atlas pages and carry independent outfits and playback state.

From the repository root, run `pnpm setup:dev` and then `node examples/outfit-studio/serve.mjs`. Open the printed local address and select WebGPU or WebGL2. The desktop view uses a 960 × 520 logical surface with pixel ratio 1. Use the mouse or Tab and Enter to choose a character and apply an outfit. Open Details, choose Rename, and select the field to edit it. Save checks the name against the scene's font set and commits it to the project. A refused name keeps the dialog open for a new draft. Cancel discards the draft. A mouse action requires release within the pressed row.

Swap palette stages a new Spine asset through the shared scene Host. The previous frame stays visible during loading. If loading or staging fails, the current character and project remain usable and the same row can retry the change. Each successful swap starts the chosen actor's animation through the existing RESET policy. Close releases the view, playback, fonts, asset groups and Host. Reload opens the authored project again.

Edit `project.json` and restart the server to see the change. The two stable entity IDs identify the characters and their `name`, `outfit` and `palette` fields. `Export project` downloads the current committed snapshot. To open it, run `node examples/outfit-studio/serve.mjs --project <path-to-snapshot>`. Playback time, selection and the draft belong to the current session. The sample reuses the existing project store and shared resource manager. [Example project](project.json)

The Studio uses the original programmatic Spine and sequence sources from `animation-outfits`. The second palette exchanges the two existing page colors and builds a fresh manifest identity. The studio code and original scene geometry are Apache-2.0. [Animation provenance](../animation-outfits/PROVENANCE.md) · [CanvasKit and Noto assets](../paragraph-panel/vendor/README.md) · [Spine runtime terms](../../third-party/spine-core-4.3.13.LICENSE) · [JSONC parser attribution](../../third-party/jsonc-parser-3.3.1.LICENSE)

Run `node examples/outfit-studio/verify.mjs <absolute-Playwright-package> <new-absolute-output-directory>` with Playwright 1.62.1 and installed Edge. The batch exercises both actual browser backends, mouse and keyboard, rejected names, drag-out releases, palette failure and retry, export and reopen, and cleanup. It records three cold HTTP samples per backend through the first completed frame with interaction enabled. The recorded transfer is uncompressed loopback HTTP. [Verification summary](verification-summary.json)

This is the desktop development slice under M4.1. The full mixed X workloads, formal performance and recovery targets, and device qualification follow the existing plan. [M4 acceptance plan](../../knowledge-base/en/docs/m4-core-acceptance-plan.md)
