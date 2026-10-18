# WebGL2 shared-profile executor contract

English | [简体中文](../../Cns/docs/webgl2-executor-contract.md)

2026-10-18 · M1.4 implementation contract draft · Full acceptance and delivery pending

## Scope and evidence

M1.3 supplies the implemented [shared render profile](shared-render-profile-contract.md), genuine immutable frames, texture-page identity, materials, ordered geometry preparation and bounded opaque B1 composition. The implemented optional WebGL2 executor consumes those same values. Engine, Stage, Scope, clock, AssetManager, leases and frame authority remain shared. The executor owns GL state, native resources and context generations. No custom shader API, general backend registry or general 3D renderer is added.

The optional entries, shared storage and retention integration, fixed scene assembly and Host lifecycle are implemented in the current source. This draft describes that selected contract; implementation is separate from acceptance. The exact framebuffer/color route has a separately recorded raw native qualification, while the four-case SDK smoke result applies only to its recorded older emission. Neither result substitutes for the final source version's full pixel, lifetime, depth and state checks. Public strict declarations, full local gates and protected delivery require their own actual receipts. Unsupported qualification stops the route; color equations and thresholds are not adjusted to fit observed output.

M1.4 includes actual WebGL context restoration. M1.5 separately owns unified device sessions, manifests, staged reload and sustained recovery. Readiness does not prove a matching recovered frame within two seconds, shaped reload within five seconds, ten loss cycles or a thirty-minute run. Full Spine R020/V020 and M1.2 formal timing remain OPEN. See the [M1 plan](m1-rendering-resource-plan.md).

## Optional API

| Entry | Sole runtime export | Erased exports |
| --- | --- | --- |
| `@egret/engine/webgl2` | `createSharedWebGL2Host(options): SharedWebGL2Host` | `SharedWebGL2Host`, `SharedWebGL2HostOptions`, `SharedWebGL2HostStatus`, `SharedWebGL2Readback`, `WebGL2HostState`, `WebGL2HostErrorCode`, `WebGL2HostFailure`, `WebGL2HostDiagnostic`, `WebGL2HostStatus` |
| `@egret/engine/webgl2/scene3d` | `createSharedSceneWebGL2Host(options): SharedSceneWebGL2Host` | `SharedSceneWebGL2Host`, `SharedSceneWebGL2HostOptions` |

The default Engine, Canvas and existing WebGPU entries keep their interfaces. Ordinary GL does not load the optional scene assembly. Scene assembly is fixed first-party code, never a caller-provided protocol.

`SharedWebGL2Host` exposes the following exact members:

- `surface: HTMLCanvasElement`, `sharedFrameProfile: SharedFrameProfile2D` with existing value `SHARED_FRAME_PROFILE_2D`.
- `start(): Promise<void>`, `stop(): void`, `close(): Promise<void>`, `setTimeout(callback: () => void, delayMs: number): () => void`.
- `renderSharedFrame(frame: SharedRenderFrame2D): undefined`, `whenIdle(): Promise<void>`, `whenReady(): Promise<void>`.
- `requestReadback(): Promise<SharedWebGL2Readback>`, `getStatus(): WebGL2HostStatus`, `getSharedStatus(): SharedWebGL2HostStatus`.

It has no `renderFrame` or `renderTexturedFrame` compatibility method. Existing `createEngineForProfile` negotiates it without a new profile or core branch. The scene Host adds `renderSceneSharedFrame(scene: SceneFrame3D, overlay: SharedRenderFrame2D): undefined` and `getSceneStatus()`, returning immutable `{host, pendingSceneBytes, pendingUniformBytes, pendingDepthBytes}`. Both inputs must be genuine public values; scene output and overlay are opaque.

`SharedWebGL2HostOptions` requires `canvas: HTMLCanvasElement`; `onDiagnostic?: (diagnostic: WebGL2HostDiagnostic) => unknown` is optional. The remaining options are:

| Option | Default and maximum, except pixelRatio |
| --- | ---: |
| pixelRatio | 1; finite positive, subject to backing admission |
| maxBackingPixels | 16,777,216 |
| maxCommands / maxClipRectangles | 65,536 / 262,144 |
| maxPreparedVertices / maxClipEdgeTests | 1,048,576 / 4,194,304 |
| maxSourceTriangles / maxTupleComparisons | 65,536 / 1,048,576 |
| maxUploadBytes / maxPendingUploadBytes | 33,554,432 / 67,108,864 |
| maxFrameGeometryBytes / maxPendingGeometryBytes | 16,777,216 / 33,554,432 |
| maxPendingFrames / maxReadbackBytes | 2 / 67,108,864 |
| enableReadback | false; boolean only |
| outputAlpha | `'premultiplied'` by default; or `'opaque'` |
| restoreTimeoutMs | 10,000 default; positive safe integer at most 30,000 |

Scene options require explicit `outputAlpha: 'opaque'`. Numeric caps can only be lowered; except pixelRatio, numeric options are positive safe integers. Unknown properties are not read. Successful reads occur once, before validation, in this order: `canvas`, `onDiagnostic`, `pixelRatio`, `maxBackingPixels`, `maxCommands`, `maxClipRectangles`, `maxPreparedVertices`, `maxClipEdgeTests`, `maxUploadBytes`, `maxPendingUploadBytes`, `maxPendingFrames`, `maxReadbackBytes`, `enableReadback`, `maxSourceTriangles`, `maxFrameGeometryBytes`, `maxPendingGeometryBytes`, `maxTupleComparisons`, `outputAlpha`, `restoreTimeoutMs`. Getter failures preserve their original cause under `WEBGL2_OPTIONS_INVALID`.

The Host requests `canvas.getContext('webgl2', {alpha:true, premultipliedAlpha:true, antialias:false, depth:false, stencil:false, preserveDrawingBuffer:false})`, verifies actual attributes and capabilities, and establishes all used state. Both output modes retain alpha storage; opaque writes alpha one. The caller grants exclusive GL state access during the lease. The browser may return an existing same-type context; historical exclusivity cannot be detected. No raw-context/device option, arbitrary attributes, extension selector, power preference, shader or resource-provider callback is accepted.

## Status, failures and lifetime

`WebGL2HostState` is exactly `new | starting | active | lost | restoring | stopped | failed | closing | closed`. Immutable `WebGL2HostStatus` contains `state`, `generation`, `lastSerial`, `pendingFrames`, `pendingUploadBytes`, `pendingReadbackBytes`, `firstFailure`, `generationFailure`, `callbackFailureCount`, `lastCallbackFailure` and `cleanupOutcome: 'not-started' | 'pending' | 'safe' | 'unsafe'`. Generation is zero before startup and increases as a positive safe integer for every initialization attempt. An internal token authorizes native work; the number does not. Serials remain monotonic across recoveries.

`SharedWebGL2HostStatus` contains `host: WebGL2HostStatus`, `pendingGeometryBytes`, `pendingColorBytes`, `pendingCanonicalBytes` and `retention`. The immutable retention snapshot has `idleBytes`, `idleEntries`, `reservedBytes`, `reservedEntries`, `unknownBytes`, `unknownEntries`, `unknownNativeBytes`, `unknownNativeObjects`. Idle and reserved are disjoint; unknown native fields cover non-pool pages/PBOs/objects. Known sizes stay charged; programs and syncs contribute object counts without invented byte estimates. These are accounting charges, not measured VRAM. Private actual vertex/uniform arena counters do not add public fields.

`WebGL2HostFailure` contains `code`, `serial: number | null`, `generation`, `phase: 'startup' | 'frame' | 'readback' | 'context' | 'restore' | 'cleanup' | 'callback'`, and original `cause`. `WebGL2HostDiagnostic` adds `severity: 'error'`. The first lifetime failure is retained; `generationFailure` clears only when permitted recovery successfully publishes a new active generation. Diagnostic re-entry and rejected callback promises are contained and recorded separately.

`WebGL2HostErrorCode` is the finite set with prefix `WEBGL2_`: `OPTIONS_INVALID`, `CONTEXT_UNAVAILABLE`, `CONTEXT_ATTRIBUTES_UNSUPPORTED`, `FORMAT_UNSUPPORTED`, `START_FAILED`, `START_CANCELLED`, `NOT_STARTED`, `STOPPED`, `CLOSED`, `FAILED`, `REENTRANT`, `FRAME_PROFILE_UNSUPPORTED`, `FRAME_INVALID`, `BACKING_LIMIT`, `GEOMETRY_RANGE`, `PRECISION_UNSUPPORTED`, `FRAME_BUDGET`, `BACKPRESSURE`, `CONTEXT_LIMIT`, `SERIAL_EXHAUSTED`, `GENERATION_EXHAUSTED`, `RENDER_FAILED`, `VALIDATION`, `OUT_OF_MEMORY`, `CONTEXT_LOST`, `CONTEXT_RESTORING`, `RESTORE_FAILED`, `RESTORE_TIMEOUT`, `READBACK_DISABLED`, `READBACK_PENDING`, `READBACK_FAILED`, `SYNC_FAILED`, `SYNC_TIMEOUT`, `DIAGNOSTIC_CALLBACK_FAILED`, `CLOSE_UNSAFE`. Errors retain original causes without exposing resource or shader contents.

| Call or event | Required behavior |
| --- | --- |
| start from new | Store one startup promise before re-entry; transition starting to active only after complete initialization. |
| start while starting/active | Return the same startup promise. |
| start while lost/restoring | Reject the corresponding context-state error; `whenReady` waits for recovery. |
| start while stopped/failed/closing/closed | Reject STOPPED/FAILED/CLOSED; never return an old success. |
| loss during initial startup | Revoke initialization, reject CONTEXT_LOST, clean up and fail terminally unless already closing. |
| confirmed active loss | Revoke the token, enter lost, reject affected outcomes/tickets and begin one bounded recovery cycle. |
| eligible actual restore | Enter restoring, reconcile old CPU/known owners, recheck deadline, rebuild/requalify under a fresh token and publish active only if still eligible. |
| another loss during restoration | Revoke that attempted generation; a distinct actual loss may begin a new bounded cycle. Duplicate loss events never extend one deadline. |
| absent or late restoration | Fail RESTORE_TIMEOUT; a late event cannot activate the Host. |
| stop/close | Synchronously prohibit new submissions and recovery. Stop is irreversible. Close enters closing and repeated calls return the same promise. Accepted work retains finite retirement ownership. |

An already-returned pending startup promise keeps its identity after re-entrant stop/close but must reject; subsequent start calls follow current state. `whenReady` is non-async and returns a stored promise: startup promise while starting, one resolved promise per active generation, or one promise per loss/recovery cycle. New and terminal states reject their corresponding error. Calls add no Host waiter list, per-call listener or timer, and do not initiate restoration. Caller-added promise reactions remain caller state.

Recovery owns one monotonic deadline and at most one timer. `restoreTimeoutMs` covers waiting for the event, old CPU quiescence and rebuilding. Every resumed checkpoint and final active publication checks time and lifecycle epoch. Suspended JavaScript may delay rejection delivery, never authorize late success. Settled cycles release their timer and continuations. A fixed internal 30,000 ms fence deadline uses the same rule; it is a waiting policy, not a performance guarantee.

`whenIdle` snapshots the records accepted at the call and the call-time Host state. It waits for those records' cleanup and reports their failure; it does not join later work or a future generation. A snapshot containing pending records affected by loss rejects even if recovery completes first. An empty snapshot taken while already idle need not be invalidated by a later loss. A fresh active snapshot can succeed despite the historical first failure. Lost/restoring snapshots reject the corresponding call-time context state after already-owned cleanup settles.

Engine commits a genuine frame and frame ID before calling Host. A synchronous GL refusal therefore may consume that ID and becomes `FRAME_RENDER_FAILED`, while Engine remains open. A later loss rejects Host outcomes/readback and emits diagnostics without retroactively throwing from the returned Engine call. Capture, leases, Stage/Scope and clock identity remain usable while Engine is open; recovery does not restart, pause or advance the clock or cancel its ordinary timers.

## Submission, cleanup and readback

Preserve this order: genuine frame/profile/output/backing/scene admission; shared logical preparation; joint fees, native capability and initial pending checks; required scene/shared packing; page-residency plan; cold-page peak reservation/materialization and capacity recheck; optional adjacency batching; actual arena plan/capacity; current-plan/final-capacity checks and serial/owner commit; native realization and submission. Batching never refunds logical fees. Required allocations cannot hide behind optional concat fallback.

Every continuation carries its original generation token and lifecycle epoch. Stale work may settle its own owner but cannot call invalid GL, change a later generation, publish readiness or fulfill an old ticket from a new canvas. Closing retains only narrow retirement authority for already-issued fences/PBOs in a still-live context. A synthetic DOM event with a healthy context proves no native invalidation.

Three cleanup outcomes remain distinct. Confirmed native loss invalidates known objects, recorded as context-invalidated rather than rendered/completed/deleted. CPU arrays, entered callbacks, scheduled polls and listeners must separately finish or cancel. Unknown creation/deletion/publication outcomes retain full charges permanently, disable acceptance/reuse and make close unsafe; later loss cannot erase them. Product cleanup never invokes context loss to manufacture that proof. Safe close requires all known native and CPU obligations settled and no unknown owner. Unsafe close rejects and preserves existing Engine surface quarantine.

Each generation owns one shared program, one fixed-output resolve program and an extra B1 program only for scene; corresponding VAOs number at most three. One working FBO attaches the accepted record's leased color/depth allocations. No per-draw program/VAO or target-combination cache is added. Establish every depended-on framebuffer, draw/read buffer, viewport, vertex/UBO/texture, blend, mask, depth/scissor/cull/stencil/dither/sample and pixel-store state; check completeness when attachments change. Detach stored native references on eviction and close. Resize checks actual drawing-buffer dimensions.

Within the synchronous render call, uploads/draws/resolve are followed by the ticket owner's `readPixels` into its dedicated PIXEL_PACK_BUFFER, then fence and flush. The copy command occurs before return or yield; later extraction reads that PBO, never the current canvas. One bounded retirement pump owns at most one timer for at most two accepted records, uses zero-timeout fence polling on later event-loop tasks and progresses without further renders. No spin loop or glFinish is used. Fence timeout or unproved cleanup retains ownership and fails unsafe; a fence alone does not authorize reuse.

`requestReadback` is active-only and requires enableReadback. One outstanding ticket binds to the next accepted submission; another rejects READBACK_PENDING. Pure admission refusal preserves the unbound ticket; stop/loss/close/terminal failure rejects it. The immutable result contains `serial`, `frameId`, `generation`, `width`, `height`, `format: 'rgba8unorm'`, `sourceFormat: 'rgba8unorm'`, `colorSpace: 'srgb'`, `alphaMode: 'premultiplied' | 'opaque'`, and `bytes: Uint8Array` with independently owned top-left rows. This format promise requires successful qualification. PBO and output each cost `4*width*height`, both against maxReadbackBytes. PACK_ALIGNMENT is 1 with zero row/skip settings; normalize rows exactly once without an uncharged full-size copy.

## Allocation and color boundaries

Shared vertices retain 44B stride and offsets 0/8/16/32. The original 128B uniform has float vec4 blocks at 0/16/32 and uint uvec4 blocks at 48/64/80/96/112. GLSL highp/std140 linked offsets and block size must match. B1 retains 24B vertices, 64B uniforms and Uint32 indices, including index 65,535.

Each accepted record uses at most one shared vertex arena and one combined shared/B1 UBO arena. Original typed payloads upload into native ranges; no full-frame CPU concat is added. For N physical shared batches and M scene draws, query A and require a safe integer with `4 <= A <= 256 && A % 4 === 0`. Use `s128=ceil(128/A)*A`, `s64=ceil(64/A)*A`; vertex V is the exact payload sum and U is `N*s128+M*s64`. UI range i starts at `i*s128`, scene range j at `N*s128+j*s64`, with sizes 128/64. Allocate and charge final padding but upload only original bytes. No draw means no arena; MAX_UNIFORM_BLOCK_SIZE constrains a block, not the whole arena. No power-of-two assumption is made.

| Actual arena cap | Per record | Two pending records |
| --- | ---: | ---: |
| V | 33,554,432 B | 67,108,864 B |
| U | 16,793,600 B | 33,587,200 B |

Original joint upload and lower caller caps still apply. Whole arenas remain exclusive until the record's fence/PBO/CPU obligations settle. Safe returns compete with all buffers/color/depth in one 32 MiB/4,096 idle-plus-reserved budget; oversized safe owners are deleted. B1 adds at most 128 geometry buffers, giving at most 130 draw-related buffers per scene record, excluding pages/targets/PBOs/sync/fixed state. These are accounting/object bounds, not measured speed or memory. Keep 64 pages/16 MiB logical demand, 32 MiB/256 READY pages, 32 MiB cold CPU peak and 8 MiB batch scratch.

Canonical capped page bytes remain RGBA8. Integer taps decode before logical nearest/linear interpolation, preserving page/region addressing, trim, quarter turns, virtual transparency, strict isolation and the 8,192 periodic / 2^20 nonperiodic qualifications. Physical filtering is NEAREST with levels zero; POT and NPOT use the same recipe. No 16F or assumed hardware-sRGB filtering path is introduced.

The qualified route uses a single-sample SRGB8_ALPHA8 working target and ordinary unsigned-normalized eight-bit RGBA default storage with LINEAR attachment encoding. Request/record sRGB canvas interpretation separately. Preserve five FUNC_ADD blend recipes, per-write target quantization, disabled dithering and one final resolve. For decoded target (C,a), transparent resolve is `(a*E(clamp(C,0,a)/a), a)`, zero at alpha zero; opaque resolve is `(E(clamp(C,0,1)),1)`. Add-preserve remains opaque-only. Manual sampling permits no framebuffer-feedback blending.

B1 uses `zGL=2*zExisting-w`, clear depth zero/GREATER/depth writes, perspective interpolation, then depth-disabled UI, one clear and one resolve. Backing-space Y mapping, working-target fetch and lower-left readback normalization must form a consistent fixed mapping.

Native qualification records actual attributes, component type/sizes and attachment encodings using BACK on the bound default DRAW_FRAMEBUFFER and COLOR_ATTACHMENT0 on the working FBO. It must verify working completeness, stored readPixels interpretation, final transfer and black/white composition with fixed literal witnesses. `drawingBufferColorSpace` alone is insufficient. Unsupported exact configuration rejects FORMAT_UNSUPPORTED; no unverified format, new drawingBufferStorage dependency or post-observation compensating transfer is substituted.

## Reproducing the finite pixel matrix

The explicit standalone entry is `tools/verify-shared-webgl2.mjs`. After preparing the documented pinned toolchain and built packages, run it from the repository root with installed Playwright 1.62.1 and a fresh absolute output directory outside the repository and dependency owners:

    node tools/verify-shared-webgl2.mjs --playwright <absolute-installed-playwright-directory> --channel msedge --output <absolute-fresh-output-directory>

It launches default headless Edge with no additional graphics flags. The entry retains the original 30 cases, 321 points, 1,236 channels and 104 bleed witnesses, followed by eleven fresh baseline / assigned mutation / healthy restoration triples: 63 fresh browser contexts in total. Each assigned mutation preserves its unique source anchor and reviewed original/changed raw hashes, and can change only one served emitted module. The repository product files remain untouched. Existing shared WebGPU cases, controls, scalar oracle and thresholds are retained separately.

The collector records its complete finite input closure, raw RGBA, black/white PNG captures, per-context results and cleanup receipts. Its `result.json` is authoritative only for the selected run's recorded inputs and acceptance domain; zero process exit alone is insufficient. Missing capability, incomplete cleanup or changed inputs cannot pass. This pixel entry establishes no native recovery/depth/state acceptance, performance, phone or cross-device support; those obligations require separate recorded results. The [evidence record](webgl2-executor-evidence.md) separates observed private/public results, independent review, complete gates and delivery.

## Finite acceptance and provenance

Acceptance separates public API/strict boundaries, controlled behavior, private metadata units, native qualification, native pixels/lifetime, performance and delivery. Public behavior consumes genuine built SDK values; private unit imports require exact policy permission. Freeze the source closure, cases, thresholds and controls before execution.

Required groups cover option/receiver/Engine semantics; exact-fit/+1 fees and A=4/12/16/256 with A=3 refusal; A=12 mixed ranges and padding; whole-owner retirement and unknown cleanup; two immediate submissions with delayed A readback after B overwrites canvas; stable readiness promises/deadlines/stale work/close races; and real WEBGL_lose_context loss, restoration, saved-frame replay and safe close. Missing extension or actual restoration is INCOMPLETE.

Reuse the original 30 cases/321 points, independent scalar reference and Q0 `[0,0,0,0]`, Q1 `[1,1,1,1]`, Q2 `[2,2,2,1]`, Q3 `[3,3,3,2]` channel limits over their declared fixtures, up to four effective color writes. Bounded forbidden-blue bleed is at most one; strict bleed and transparent safe areas are exact zero. Assigned wrong-model margins are at least 16 and at least `4T+4`. Freeze eleven GL controls, replacing the BGRA-specific control with row-normalization error, plus fixed depth-remap/state-reset witnesses. Preserve raw RGBA, black/white captures, actual browser/context/renderer information and cleanup. OS inventory does not identify the selected GPU. Backend agreement alone is insufficient. Retain affected Canvas/WebGPU/B1 regressions and full gates.

The implementation is independently authored from the existing first-party contract and preserves its standards and dependency attribution. First-party code and documentation remain Apache-2.0, with existing dependency and asset attribution retained. Primary references carried forward from the reviewed design are [Khronos WebGL context/drawing buffer](https://registry.khronos.org/webgl/specs/latest/1.0/), [Khronos WebGL2](https://registry.khronos.org/webgl/specs/latest/2.0/), [OpenGL ES 3.0.6](https://registry.khronos.org/OpenGL/specs/es/3.0/es_spec_3.0.pdf) §§2.12.6.5, 2.18, 3.8.16, 4.1.7–4.1.8, 4.3.2, 6.1.13 and Table 6.33, and [drawingBufferColorSpace](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawingBufferColorSpace). The design records their 2026-10-18 consultation; implementation admission must preserve the adopted versions/text because `/latest/` evolves. Current execution results and remaining support limits are recorded separately in the [evidence record](webgl2-executor-evidence.md).
