# Procedural 3D scene with screen UI

English | [简体中文](README.zh-CN.md)

This experimental S3D1 example imports only the built public entries `@egret/engine`, `@egret/engine/scene3d` and `@egret/engine/webgpu/scene3d`. It creates two immutable indexed XYZ/RGB quads, supplies camera-space model-view matrices, captures ordinary screen UI through a genuine Engine Stage, and submits scene then UI through one scene Host. The original preparation record marks native verification **PENDING**.

Use the repository's existing Node.js 24.19.0, pnpm 11.25.0 and TypeScript 7.0.2 setup. From the repository root, build with `node tools/build.mjs`, then run `node tools/serve-canvas.mjs`. Open the printed loopback origin at `/examples/scene3d/index.html`. Use a browser with WebGPU support; no launch flags or software adapter requests are needed. Stop the server with Ctrl+C.

The target is 64×64 logical pixels at pixelRatio 1, enlarged by CSS for inspection. Red at z=-3 covers blue at z=-7 under an orthographic camera with near=1/far=9 and reversed zero-to-one depth. The immutable scene uses identity model-view input. White, magenta and green UI follow genuine display painter order. The 2×2 magenta image is authored locally from sixteen opaque RGBA bytes, owned by ImageData2D, wrapped in a Texture, and borrowed by Bitmap through an AssetManager lease owned by Scope. It loads no URL, decoder or font.

Redraw performs one `engine.captureFrame()` and one `host.renderSceneFrame(scene, overlay)`, followed by `host.whenIdle()`. The image checkbox changes only its parent Sprite's local `{x:0,y:0,width:4,height:8}` clip, then explicitly redraws. There is no render loop or clock advancement. Close removes the owned listener pairs, awaits setup, calls `engine.dispose()` to retire Scope, Stage, assets and Host, then zeros and removes the canvas. A Host whose Engine startup failed is closed directly.

This is a bounded opaque procedural route with a restrictive exact-normal-f32 profile. It is not a mutable scene graph, camera pose API, lighting/material/asset importer, transparent scene sorter, character animation, Native SDK or performance acceptance. The fixed S1/S2/SN1 native stage belongs to `tools/verify-webgpu-b1.mjs`; its independent literal pixels and raw readbacks are separate from the original seven B1 baselines and five controls. First-party code and inline pixel assets use Apache-2.0.
