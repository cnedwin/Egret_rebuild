# Textured scene host contract

Original design checkpoint for experimental development preview **0.39.0**: acceptance and release were pending. The contract below defines the developer interface; the later browser result is recorded separately at the end.

Use one explicit WebGPU host to draw an opaque RGB 3D scene followed by an Engine-captured textured 2D overlay on the same canvas. The current scene path covers colored mesh geometry and captured transforms. Complete character rendering, textured materials, lighting and transparent scene sorting remain outside this preview.

## API and setup

The browser entry is `@egret/engine/webgpu/scene3d`. Its existing `createSceneWebGPUHost` stays available. The new public contract is:

```ts
interface TexturedSceneWebGPUHost extends TexturedWebGPUHost, SceneWebGPUHost {
  renderSceneTexturedFrame(
    scene: SceneFrame3D,
    overlay: TexturedRenderFrame2D,
  ): undefined;
}
function createTexturedSceneWebGPUHost(
  options: TexturedWebGPUHostOptions,
): TexturedSceneWebGPUHost;
```

`TexturedWebGPUHostOptions` is the existing canonical type, re-exported from this entry. Set `canvas`; `device` may select acquisition or a borrowed `GPUDevice`. Existing `pixelRatio`, `enableReadback`, `onDiagnostic` and bounded preparation/upload/readback options retain their meanings. Textured options also include `maxSourceTriangles`, `maxFrameGeometryBytes`, `maxPendingGeometryBytes` and `maxTupleComparisons`. No combined-mode option or separate scene-budget option is added. Invalid options and unavailable hardware remain explicit errors; this entry introduces no automatic fallback.

Initialize with `createEngineForProfile({ host }, TEXTURED_FRAME_PROFILE_2D)`. Existing ordinary, scene, textured and Canvas factories retain their contracts. Inherited methods remain available, but `renderSceneFrame` still rejects an owned textured overlay with `WEBGPU_FRAME_PROFILE_UNSUPPORTED`; use `renderSceneTexturedFrame` for this composition. Importing the default Engine entry does not start WebGPU.

## One capture and one combined submission

Given an application-owned browser `canvas`, this example creates a genuine scene and a small display-tree overlay. It is illustrative source, not an executed result.

```ts
import { createEngineForProfile, TEXTURED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createMatrix4, createMeshGeometry3D, createSceneFrame3D } from '@egret/engine/scene3d';
import { createTexturedSceneWebGPUHost } from '@egret/engine/webgpu/scene3d';

const host = createTexturedSceneWebGPUHost({ canvas, enableReadback: true });
const engine = await createEngineForProfile({ host }, TEXTURED_FRAME_PROFILE_2D);
try {
  const scope = engine.createScope();
  const ui = scope.use(new Sprite());
  ui.graphics.beginFill(0x00ff00).drawRect(8, 8, 12, 10).endFill();
  engine.stage.addChild(ui);
  const geometry = createMeshGeometry3D({
    positions: [-0.5, -0.5, -2, 0.5, -0.5, -2, 0, 0.5, -2],
    colors: [1, 0, 0, 0, 1, 0, 0, 0, 1], indices: [0, 1, 2],
  });
  const scene = createSceneFrame3D({
    projection: { kind: 'orthographic', left: -1, right: 1, bottom: -1, top: 1, near: 1, far: 3 },
    draws: [{ geometry, modelView: createMatrix4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) }],
  });
  const overlay = engine.captureTexturedFrame({
    width: 64, height: 48, clearColor: 0x101010, clearAlpha: 1,
  });
  const pixels = host.requestReadback().then(value => ({ value }), error => ({ error }));
  host.renderSceneTexturedFrame(scene, overlay);
  const result = await pixels;
  if ('error' in result) throw result.error;
  console.log(result.value.frameId === overlay.frameId, result.value.serial);
  await host.whenIdle();
} finally {
  await engine.dispose();
}
```

Capture rather than call `engine.renderTexturedFrame` here: that method would submit a separate textured frame. Observe readback rejection immediately and request it before the combined call. Applications must preserve/report rendering and cleanup failures under their own error policy.

## Genuine frames and output

`scene` must come from the public scene factory. `overlay` must be the exact completed Engine-captured frame in the matching loaded SDK identity graph. Shape copies, proxies and fabricated frame objects are rejected. This method does not capture UI, acquire assets, rasterize text or recompute the scene MVP.

Dimensions, clear color and `frameId` come from `overlay`. Set **`clearAlpha: 1` explicitly**; capture defaults to `0`. The host uses captured column-major scene transforms and reverse depth, then draws the overlay in existing top-left logical coordinates and display-tree painter order. Logical dimensions and the host's configured `pixelRatio` determine the backing size.

There is one surface owner, two render passes and one queue submission: the scene clears color and uses depth; the UI loads that color with no depth attachment; any readback follows both passes. Empty content retains this ordering and depth reservation. UI is always above the scene. The synchronous return is exactly `undefined`, which does not prove GPU completion. Use `whenIdle()` and the existing failure/diagnostic contract. Readback `frameId` equals `overlay.frameId`; the shared host `serial` advances even when a captured frame is reused.

## Joint budgets, separate meanings

Whole-frame storage admission precedes scene/overlay payload packing and GPU mutation. Buffer uploads share `U = S + M + U2`; texture pixels do not become part of that buffer-upload counter.

| Facet | Qualification and outstanding charge |
| --- | --- |
| Combined buffer upload `U` | `maxUploadBytes`; outstanding `maxPendingUploadBytes` |
| Scene geometry `S` and uniforms `M` | `S <= 4194304`; `M = 64n <= 4096`; outstanding limits `8388608` and `8192` |
| Scene depth `D` | `D = 4WH <= 16777216`; outstanding limit `33554432`, including empty scenes |
| Textured source geometry `G` | `maxFrameGeometryBytes`, hard maximum `16777216`; `maxPendingGeometryBytes`, hard maximum `33554432` |
| Projected texture pixels `T` | per-frame maximum `16777216`; outstanding maximum `33554432`, separate from `U` |
| Selected readback `R` | `rowPitch = 256 * ceil(4W / 256)`; `R = rowPitch * H + 4WH`; `maxReadbackBytes` covers the selected and outstanding readback storage |

`W` and `H` are qualified backing dimensions; `n` is scene draw count. Existing scene metadata, preparation-work, hardware and pending-frame limits also apply. These facets belong to one pending record and are not a total process/GPU memory measurement. `getStatus()`, `getTexturedStatus()` and `getSceneStatus()` expose the existing facets of that same owner. Earlier scene hardware admission retains its priority over later overlay/joint checks.

## Refusal and shutdown

Host state precedes reentry and input authentication: new/starting gives `WEBGPU_NOT_STARTED`, stopped gives `WEBGPU_STOPPED`, closing/closed gives `WEBGPU_CLOSED`, and failed gives `WEBGPU_FAILED`. Only active proceeds; busy gives `WEBGPU_REENTRANT`. Scene identity is checked before overlay identity. An unclassified current preparation fault becomes `WEBGPU_FRAME_INVALID` with its cause; a concurrent state change wins over that fault.

A normal admission refusal leaves the serial, charges, canvas and GPU untouched and leaves an armed readback ticket unbound for a later accepted frame. Stop/close or terminal failure may cancel it. After submission work is committed, attempted writes and synchronous encoding failures are fenced and cleaned up under the existing owner; serial/charges are not rolled back as though no attempt occurred.

One Engine reserves the canvas. Captured frames do not gain Engine/Scope affinity: display/resource ownership is enforced during capture, and a genuine completed value remains usable after its producer Scope closes. Scope cleanup aborts first and releases in reverse acquisition order. Engine disposal refuses new captures immediately, then closes Scopes, Stage and assets before stopping/closing the host; an earlier snapshot can still be submitted from cleanup while that host remains active.

`close()` changes state synchronously, shares one closing Promise, cancels an unbound ticket and drains startup, active CPU work and accepted GPU work. Held fences keep charges until retirement. Terminal retirement may release accounting even when cleanup is unsafe: **zero counters do not prove safe close or safe owner/device return**. Unsafe close rejects `WEBGPU_CLOSE_UNSAFE` and preserves its failure cause. A borrowed device remains caller-owned and is not destroyed by this host.

## Remaining scope and provenance

This contract is original Egret first-party work; third-party dependencies and their licenses remain separately recorded. It makes no performance, physical-device, native-runtime or complete-product acceptance claim. Complete UI, resources/animation, broader 3D and platform hosts, utilities, AI tools and migration `R008/V006` remain separate work. FullSpine `R020/V020` remains **OPEN**.

<!-- CHOST-ACTUAL-BROWSER-SUCCESSOR -->
**Actual browser successor:** the default headless Edge **155.0.4283.45** run completed **2** genuine frames. All **24** fixed pixels (**12** per frame) matched exact RGBA expectations; each **16384**-byte normalized buffer is preserved in the shared record. Applying the first overlap expectation to the second buffer rejected the changed UI order at **(34, 32)**, without another rendered frame. Host safe close, resource/Scope/lease/Engine cleanup, application device destruction and cooperative browser closure passed. This establishes the bounded composition only; OS process retirement, physical hardware, phones, performance, complete 3D and full Spine remain separate. Full prepush and GitHub delivery are PENDING at this successor cutoff.
