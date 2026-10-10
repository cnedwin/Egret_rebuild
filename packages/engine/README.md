# @egret/engine

English | [简体中文](README.zh-CN.md)

The root facade exports type-only `Point2D`/`CoordinateQueryOptions` and inherits `localToGlobal`/`globalToLocal` on display classes. Read the [coordinate contract](../../knowledge-base/en/docs/display-coordinate-query-contract.md).

Egret's experimental public facade assembles `@egret/runtime` and `@egret/contracts`. It manages logical lifecycle, display/frame access, CPU assets and exclusive surface reservations; hosts manage physical resources and safe return. The root entry remains DOM-free. The separate `@egret/engine/web` entry exports `createCanvasHost`; `@egret/engine/webgpu` explicitly enables WebGPU. Engine pins `robust-predicates` 3.0.3 for rendering preparation.

## Public API and lifecycle

`createEngine` accepts an explicit `HostAdapter`, an optional positive-integer shutdown deadline and a diagnostic callback. It provides an `Engine`, its `Stage`, `Scope`, assets service and a single shutdown Promise. Internal assembly interfaces are not exported by the public facade.

`createEngine` reserves the surface before awaiting `host.start`; startup failure still enters cleanup. Shutdown starts immediately and waits for the current frame call to exit, then handles Scope, Stage and the CPU asset manager, stops the host and waits for `close` within bounds. Only successful close releases the reservation. Timeouts or rejection preserve isolation; late success may release it. Engine does not destroy borrowed surfaces or devices; this slice provides no forced-release or recovery entry.

Scope or Stage cleanup failures do not stop later steps. `EgretError` retains the original cause and cleanup errors collected in order.

## Display and frame execution

`DisplayObject` exposes `x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `visible` and `clipRect`. `Sprite.graphics` owns rectangle fills. `Engine.captureFrame` creates an immutable `RenderFrame2D`; `renderFrame` also submits it to the synchronous host port fixed at creation. Capture remains available without a render port, while rendering rejects. Frame reads and execution reject reentry; cleanup waits for the frame call to exit.

Canvas DOM types and execution stay in the web subentry. Read the [display and frame contract](../../knowledge-base/en/docs/display-and-frame-execution-contract.md) for exact behavior and the [implementation record](../../knowledge-base/en/docs/display-and-frame-implementation-record.md) for version-bound evidence.

## WebGPU use

Supply an `HTMLCanvasElement` as `canvas`. Optional readback arms the next accepted frame; `renderFrame` returns `undefined` synchronously. `result.bytes` is caller-owned premultiplied RGBA, rather than browser composition. `whenIdle` snapshots submitted work; only successful `close` proves safe return. Engine wrapping preserves the original cause. See the [WebGPU example](../../examples/webgpu/README.md).

```ts
import { createEngine, Sprite } from '@egret/engine';
import { createWebGPUHost } from '@egret/engine/webgpu';

const host = createWebGPUHost({ canvas, enableReadback: true });
const engine = await createEngine({ host });
const rect = new Sprite();
rect.graphics.beginFill(0x00ff00).drawRect(4, 4, 16, 16);
engine.stage.addChild(rect);
const pixels = host.requestReadback();
engine.renderFrame({ width: 48, height: 40, clearColor: 0, clearAlpha: 0 });
const result = await pixels;
await engine.dispose();
```

## Verification and scope

From the repository root, run `node tools/verify.mjs`, `node examples/headless.mjs` and `node examples/assets.mjs`. Affected rendering changes also require the corresponding real-browser gate described in the [collaboration agreement](../../AGENTS.md). Package guides describe interfaces; historical counts and delivery records live in the [knowledge base](../../knowledge-base/en/README.md) and its [changelog](../../knowledge-base/en/CHANGELOG.md).

Full text, texture, animation, UI and 3D execution, Native SDKs, target-device performance, editors, Agent services and complete legacy-project migration have separate acceptance obligations. Internal CPU scene, sequence and conversion work does not make those capabilities public or complete.

Package version `0.0.0`, protocol `1.0` and experimental API status remain unchanged. `private: true` prevents accidental npm publication. See the [source record](../../source-origin.json) for attribution and [publication guide](../../PUBLICATION.md) for delivery policy. First-party code and this document use [Apache-2.0](../../LICENSE).

## Explicit sequence animation

`createSequenceClip` owns validated atlas timing; `SequencePlayer` applies caller-supplied absolute seconds to one Bitmap and exact borrowed lease. Construction changes no crop; disposal releases no caller resource. There is no automatic scheduler. See the [contract and acceptance scope](../../knowledge-base/en/docs/sequence-player-contract.md) and public `examples/sequence-player` / `tools/sequence-player` guides.
