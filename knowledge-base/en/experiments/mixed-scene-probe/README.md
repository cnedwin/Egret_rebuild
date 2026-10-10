# Local Mixed Graphics Experiment

English | [简体中文](../../../Cns/experiments/mixed-scene-probe/README.md)

Run `node run-headless.cjs <已有Playwright模块路径>` here to start a new temporary headless test browser and loopback-only local page; close browser/server at completion. No engine installation, historical project execution, or user-browser data is needed. Prefer existing Chromium, otherwise try installed Edge.

Actual round environment: Edge 154.0.4258.62, WebGL2,256×192 target. A procedural 12-triangle perspective cube is drawn. Adjacent compatible UI rectangles become vertex data and one actual draw, binding texture/blend/scissor by batch headers. Text is a Canvas-generated English texture; skeletons are two rigidly transformed segments; image frames are a 3×1 color-fixture atlas. This is not complete font/animation/3D asset import.

First CPU reference reads original rect/clip/pipeline/color per pixel/command without batch builder/executor. Current six commands produce three actual draws;49,152 pixels/196,608 channels have maximum error 1 within predefined ±3 tolerance. Deliberately ignoring clip/pipeline produces GPU pixel counterexamples. Separate checks cover perspective mesh/UI, two fixed skeleton frames, two atlas frames, and resource rebuilding after actual contextlost/restored.

Evidence chain, relative to knowledge-base root:

- `evidence/mixed-scene-probe-empty-results.json`: empty renderer one pass/six failures; recovery only compared equal output and allowed blank images to pass. This weakness is retained.
- `evidence/mixed-scene-probe-strict-empty-results.json`: nonempty guards make empty renderer zero passes/seven failures.
- `evidence/mixed-scene-probe-shared-builder-results.json`: seven passes after implementation, but first CPU reference still shared the builder; no independent batching comparison claim.
- `evidence/mixed-scene-probe-results.json`: corrected independent per-command oracle, actually rerun with seven passes/zero failures and no page/console errors.

Five page/renderer/server/runner source files per version: `history/empty-renderer/`, `history/strict-empty/`, `history/shared-builder-oracle/`. Initial shared batch module: `history/batch-state-probe/model.mjs`; later two versions have their own `batch-model-snapshot.mjs`. Original reports retain shared-module name `../batch-state-probe/model.mjs`; historical hashes map to these snapshots. Restore the complete structure temporarily to avoid overwriting current evidence. Historical directories are not current execution entry points.

Recovery compares pixels at one fixed frame only, without gameplay/animation-event recovery. Generated text is in recovered output but has no independent quality oracle. Renderer strings do not independently certify acceleration. No PBR/lighting, skinning constraints/attachments, filters/arbitrary masks, actual mini-game/native hosts, WebGPU scene backend, phones, GPU timing/energy, or legacy-migration acceptance.

Documentation location changed on October 10, 2026. Run the recorded experiment commands from the unchanged shared directory `knowledge-base/experiments/mixed-scene-probe` relative to the repository root. This reading-file relocation does not rerun the experiment or alter its original evidence.
