# @egret/engine

English | [简体中文](README.zh-CN.md)

The root facade exports type-only `BoundsQueryOptions` and inherited `getBounds`, reusing readonly `Rectangle2D`. Read the [receiver-local bounds contract](../../knowledge-base/en/docs/display-content-bounds-contract.md); layout and hit testing remain pending.

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

## Owned binary reading

The root exports `ByteReader` and the frozen `BYTE_READER_LIMITS`, plus type-only `ByteOrder`. Readers copy an eligible fixed ordinary Uint8Array payload, default to bigEndian, and support bounded atomic scalar/copy reads. Returned bytes are independent copies; disposal clears owned references. Existing Scope may own a reader through its disposable shape. Read the [BR1 contract](../../knowledge-base/en/docs/byte-reader-br1-contract.md) and [recorded verification scope](../../knowledge-base/en/docs/byte-reader-br1-evidence.md). No binary format, text encoding or legacy ByteArray compatibility is promised. The Main integration and publication checks remain pending at this preparation cutoff.

<!-- NS1-DOC-0.41.0-BEGIN -->
## Engineering preview 0.41.0 — nine-slice stretch geometry NS1

**S094 / V045. Finite CPU, types, policy and browser observations accepted; complete publication gates and delivery remain PENDING.** Fixed-border stretch geometry reuses the existing Mesh2D texture lease; resizing replaces geometry. Runtime/engine roots expose one factory and two readonly types while retaining the original owned geometry identity.

Actual CPU checks passed 27/27: 11 NS groups, 6 Mesh groups and 10 geometry checks including nested cases. Positive type diagnostics were 0; the two intentional negative streams contained 41/35 actual diagnostics, totaling 76 precise location records. Strict type and policy guards exited 0; assigned policy controls passed 13/13. The actual browser completed 2 frames and 96 color-channel comparisons with verified cleanup; see the evidence for the exact environment and scope.

The original NSP09 13/12/1 failure and its finite test-input correction remain separate.

ByteWriter 0.40.0 merged through [PR #27](https://github.com/cnedwin/Egret_rebuild/pull/27), with Main `8e1509878252cc2a9295fcc56d7597877d023c85` and tree `ca1f2f176713e388e09016ae22d610c5c1b95201` read back. The mandatory push hook exited 0 with 63 publication and 2724 core checks. Zero remote statuses/check runs do not establish remote CI PASS. Earlier PENDING cutoffs and failure records remain preserved.

[contract](../../knowledge-base/en/docs/nine-slice-geometry-ns1-contract.md) / [evidence](../../knowledge-base/en/docs/nine-slice-geometry-ns1-evidence.md).

This bounded geometry increment contributes to complex 2D UI; it establishes no complete UI/EUI, layout, full Spine, migration, phone energy/performance or native SDK/PC acceptance.
<!-- NS1-DOC-0.41.0-END -->

<!-- BW1-DOC-0.40.0-BEGIN -->
## Owned binary authoring

The root exposes the original `ByteWriter` and frozen `BYTE_WRITER_LIMITS`: fixed capacity, strict integer domains and native IEEE floating conversion. `toUint8Array()` copies only the committed prefix; `Scope.use(writer)` uses existing lifetime ownership. ByteOrder stays type-only and optional host entries add no writer. See the [contract](../../knowledge-base/en/docs/byte-writer-bw1-contract.md) and [evidence](../../knowledge-base/en/docs/byte-writer-bw1-evidence.md) for the complete scope and separate acceptance stages. Package version, experimental status and npm publication conventions remain unchanged.
<!-- BW1-DOC-0.40.0-END -->
