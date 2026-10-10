# Explicit-time sequence example

English | [简体中文](README.zh-CN.md)

Build with the repository's fixed Node (`node tools/build.mjs`), serve the repository root with an ordinary local HTTP static server, then open `/examples/sequence-player/`. The explicit import map resolves public package entries and their package dependencies. The example imports only `@egret/engine` and the selected public browser backend. WebGPU requires a compatible browser and secure context (localhost).

Choose Canvas or WebGPU in the UI, or use `?backend=canvas&mode=once` / `?backend=webgpu&mode=loop`. Changing a selection reloads the page. Time buttons supply absolute seconds without a timer. At 0 / 0.125 / 0.375 seconds the selected frames are red 2×2 / green 1×2 / blue 3×1. At 0.5 seconds once holds blue with `atEnd: true`; loop returns to red with `atEnd: false`. The displayed Bitmap is scaled by 32 with origin (16,16), so its visible sizes are 64×64 / 32×64 / 96×32.

The inline 6×2 RGBA atlas is independently authored here and loaded once. Save green captures an immutable frame. Replay renders that frame through the public host. Retire disposes the player and Bitmap and releases the caller's lease, then replays the saved green image; its owned pixels remain available. Close releases remaining caller resources and closes the Engine. The player itself borrows resources and installs no cleanup subscription.

This reproducible example is not native browser acceptance. Real Canvas/WebGPU pixel checks, saved-frame replay, performance and target-device acceptance require separate recorded execution. No claims about transparent filtering or full animation migration are made.
