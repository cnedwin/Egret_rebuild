# Core engineering progress

English | [简体中文](../../Cns/docs/core-progress.md)

The core is developed through executable increments that connect display, resources, animation, input and host execution. This page summarizes the current interfaces and remaining product work; each linked contract contains the exact behavior and verification scope.

## Responsive examples — 2026-10-30

The phone-facing preview composes existing actor, multi-pointer, UI and paragraph SDKs with responsive columns, bounded DPR and ordered session replacement. Fixed qualification files and the legacy mouse API remain unchanged. See the [example contract](mobile-examples.md); desktop emulation does not close physical-device, IME, performance or M4 requirements.

## M3.2 paragraph alignment and line limits — 2026-10-29

Readonly paragraphs now support left/right/center/start/end/justify alignment and optional maxLines with a fixed ellipsis. Hard-break/blank-line overflow shows the marker; an impossibly narrow field rejects without replacing committed content. Existing UI geometry and resource ownership remain authoritative. See the [layout contract](paragraph-layout-controls.md). The focused 36 cases and 20 actual browser checks per backend are finite functional evidence; full M3.2, devices, IME and performance remain OPEN.

## M3.2 readonly UI paragraphs and final-line bidi — 2026-10-29

The optional readonly SDK now drives ordinary UI and virtual lists using explicit font bytes, width-aware wrapping, natural/minimum line height and existing resource leases. Its selected native backend resolves actual final lines with retained P1 context, keeping glyph storage, rectangles and hit queries consistent. Finite native controls and 14 actual Edge checks on each of WebGL2/WebGPU passed. The [SDK contract](readonly-paragraph-sdk.md) and [final-line record](paragraph-line-bidi.md) state the precise scope. Full M3.2, independent glyph/ink references, editing/IME, phones, performance and memory/OOM remain OPEN. The checkpoints below retain their original artifact and adoption boundaries.

## M3.2 private bidi backend comparison — 2026-10-29

A built private SheenBidi comparison now serves all four real paragraph builder paths. The declared full bidi schedule records 953,627 observed attempts with zero strict mismatches and 28 fixed-adapter auto cases NOT_OBSERVED; old ICU failures remain preserved. Real paragraph finite checks and a bounded desktop CPU-raster/browser check passed within their stated scopes. This adds no public SDK/provider or product runtime dependency. Final soft-wrapped-line L1, independent glyph/ink references, live-memory/physical-memory acceptance, IME/mobile and M4 remain OPEN. Read the [comparison, source package and evidence boundaries](paragraph-bidi-comparison.md).

## Prior M3.2 private paragraph checkpoint — 2026-10-28

The prior bounded private CPU checkpoint recorded 18 focused controls passed and zero grapheme/line-boundary disagreements across the three declared full-input profiles. Strict bidi comparisons retain 105,785 class attempt failures and 11 character / 11 fixed-adapter mismatches. Observed linear-memory capacity grew 32→38.4375 MiB under a 64 MiB maximum; this is not memory qualification. At that cutoff SheenBidi v3.0.0 had source-only comparison preparation, with no adapter or runtime result. No public paragraph API or provider adoption is delivered. See the [M3.2 checkpoint, source credits and remaining limits](m3-ui-text-input-plan.md).

## Experimental WebGPU image residency — 0.61.0

The **0.61.0 engineering preview** adds an internal image cache with per-Host ownership, reusing exact cropped GPU images after safe completion. Its LRU mechanism keeps a 32 MiB logical image pool and at most 256 ready entries, preserving existing public admission, rendering profiles and lifecycle management. It adds no public API or dependency.

Read the [contract](gpu-image-residency-contract.md) and [evidence and limits](gpu-image-residency-evidence.md). Controlled specification/ownership results and any current desktop regression results have separate scopes. The new dedicated cache browser matrix remains deferred and OPEN. Physical GPU memory, performance, target devices and actual device-loss recovery remain unverified. Workspace packages remain private 0.0.0; Host protocol remains 1.0.

The 0.61 increment was delivered through [PR #50](https://github.com/cnedwin/Egret_rebuild/pull/50), Main `030a34646774dea6c46cc947b55186da9265a6c8`.

## Atlas import planning — 0.60.0

The **0.60.0 engineering preview** adds the optional `@egret/project/atlas` entry: strict single-page Aseprite stable-marker JSON-array planning with one explicit PNG binding. Its two runtime values and sixteen erased types produce owned, frozen inputs for the existing SpriteSheet and SequenceClip factories. The exact profile is `aseprite-json-array-1.3.18.6-v1`; exporter output compatibility, declared hashes and entitlement remain unverified.

Read the [contract](atlas-import-plan-contract.md) and [evidence and limits](atlas-import-plan-evidence.md).

Independently accepted saved results are focused planner 47/47, the earlier normal SDK run with core 3625/3625 and separate F2 160/160, and the distinct CPU firstGREEN 5/5. These overlapping scopes are not added together. Independent review also accepts the selected new Native Canvas/WebGPU four-readback result. At that authoring cutoff, final integrated gates/prepush and 0.60 Git/remote delivery remained pending; the 0.60 increment was later delivered through [PR #49](https://github.com/cnedwin/Egret_rebuild/pull/49), Main `8d94620d1134d347bf4cc08d2ef8d76c46c6b308`. Workspace packages remain private 0.0.0; Host protocol remains 1.0.

The preceding 0.59 increment was delivered through [PR #48](https://github.com/cnedwin/Egret_rebuild/pull/48), Main `44f49f9d97a7baebc400fd4940541529dc33d147`. Earlier 0.59 readings and evidence retain their original authoring cutoffs; the new delivery statement does not rewrite them. No remote statuses or check runs were reported, so no CI pass is inferred.

## Normalized atlas frames — 0.59.0

The explicit `'trim-rotation-v1'` profile extends the existing SpriteSheet and SequenceClip factories with one erased readonly `AtlasFrameLayout` type. Trimmed and clockwise90-packed crops retain their original logical canvas through Bitmap, SequencePlayer and SequencePlayback. Both frame collectors compose image placement as `M * S` while parent clips, anchors and child coordinates retain their display matrix. Default/undefined profiles keep the existing rectangle path. The [contract](atlas-frame-layout-contract.md), [evidence](atlas-frame-layout-evidence.md) and [example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/trimmed-atlas-playback/README.md) define the complete input, exact-lease and ownership rules.

The independently reviewed 12-stage SDK `node tools/verify.mjs` run passed **3559/3559 core tests** and a separate Spine experiment suite with **160/160 tests**, each with failed/cancelled/skipped/todo **0**. Build, strict consumers and source-boundary stages completed in that run. Separately reviewed desktop Canvas and textured WebGPU runs passed six fresh contexts and 30 complete RGBA readbacks at zero tolerance, covering once/loop timing, held-time resume, anchors, parent clipping, two assigned controls per backend and saved-frame replay after origin retirement. The current verifier adds a thirteenth atlas source-boundary phase; its complete rerun, final publication/prepush, 0.59 Git delivery and remote CI remain pending at this authoring cutoff.

This bounded increment does not close the wider P03/P04/P05 program. Exporter imports, multipage, pivot/nine-slice import, animated-resource transactions and recovery, controller seek/rate/events, complete UI, full Spine R020/V020, migration R008/V006, physical GPU/mobile behavior, memory and performance remain OPEN. Workspace packages remain private 0.0.0; Host protocol remains 1.0.

## Prepared resource groups — 0.58.0

Engineering preview **0.58.0** adds `Engine.captureBitmapBindings(scope, targets)` and the erased `BitmapBindingTicket` type. The prepared-outfit example waits for both clothing textures and commits their bindings together. Pending, failed, cancelled and obsolete changes preserve the working outfit; a ticket refuses to overwrite a later caller binding.

Recorded desktop Canvas and WebGPU checks passed six fresh contexts with 54 original RGBA readbacks, including separate old-layer controls, genuine mouse selection, animation boundaries and shutdown with original reads still pending. This is finite desktop evidence. General dependency manifests, additional content types, full UI, Spine, production hosts, mobile performance and physical-memory acceptance remain open.

Read the [contract](prepared-resource-groups-spec.md), [evidence and limits](prepared-resource-groups-evidence.md) and [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/prepared-resource-groups/README.md).

## Real-resource scene integration — 0.57.0

Engineering preview **0.57.0** combines real PNG resources, shared atlas playback, text and mouse input through existing public Engine APIs. Canvas is the default; the textured WebGPU scene is an explicit experimental choice. Resource preparation, presentation readiness, input readiness and safe shutdown have separate boundaries. Read the [integration record](resource-scene-integration.md) and [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/resource-scene/README.md).

The recorded desktop Canvas/WebGPU workflow completed seven fresh contexts and retained 64 original RGBA frames. Fixed-point and font-region comparisons, negative controls and retirement passed in the documented environment. Phone, cross-environment font, performance and energy acceptance remain open.

## Recoverable Bitmap resource replacement — 0.56.0

`Engine.createBitmapResourceSlot(scope, bitmap)` keeps one Bitmap identity while replacing its Texture. The root adds only the erased `BitmapResourceSlot` and `BitmapResourceSlotState` names. The initial binding is borrowed; only fresh acquired replacement leases are owned by the slot. Pending, failed and cancelled requests retain the prior usable binding, and only the latest accepted intent may commit. Rejection, binding-conflict and lifecycle details follow the [specification](bitmap-resource-slot-spec.md). Read the [evidence](bitmap-resource-slot-evidence.md) and [composition example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md). Focused behavior, strict consumers and the recorded desktop Canvas/WebGPU composition have passed their bounded checks. Full local/public gates and repository delivery are recorded separately in the linked evidence.

The 0.56 resource-replacement increment was delivered through [PR #45](https://github.com/cnedwin/Egret_rebuild/pull/45), Main `19c308af4d7c9590f886c8105d5d678e708184c5`. Earlier verification records retain their original cutoffs.

## Explicit local layout — 0.55.0

The pure `planLinearLayout` function in `@egret/engine/layout` returns a frozen rectangle plan. Callers choose membership and apply coordinates through existing display APIs; the two-Button example composes layout, shared input and saved/live frames. Recorded desktop Canvas/WebGPU checks cover the fixed two-Button workflow; their environment and limits are in the evidence record. Read the [specification](local-linear-layout-spec.md) and [evidence](local-linear-layout-evidence.md).

The 0.55 increment was merged through [PR #44](https://github.com/cnedwin/Egret_rebuild/pull/44), Main `f6b7968db89febfdbe00fb1322f208ab2135f68f`, tree `86e9d3da4831f4bbbc6a20545c4434ecc9a5b791`. That delivered cutoff is preserved separately from the 0.56 evidence.

## Previous integration — 0.54.0

Engineering preview **0.54.0** was merged through [PR #42](https://github.com/cnedwin/Egret_rebuild/pull/42). Main is efd2a9c91fb6cfe633214b50b82cf7952941452a, tree 2b39b8439a5b30ce3572edc162e8a7a916a76185. Workspace packages remain private 0.0.0; host protocol remains 1.0.

## Implemented scope and boundaries

| Area | Available engineering scope | Reference |
| --- | --- | --- |
| Display and input | DisplayObject/Container, transforms and pivots, coordinates/bounds, authored hit areas, primary mouse routing and bitmap buttons. | [Contract and scope](bitmap-button-contract.md) |
| Resources | Typed references, shared acquisition, leases, Scope cleanup, acquisition groups, textures, named SpriteSheet crops and an optional PNG provider; recoverable single-Bitmap replacement in 0.56 has bounded behavior, type and desktop rendering evidence. | [Acquisition scope](resource-acquisition-groups.md), [replacement specification](bitmap-resource-slot-spec.md) |
| Animation | Explicit game time, scalar Tween, atlas sequence sampling and Engine-clock sequence playback; normalized trim/clockwise90 frames have SDK and bounded desktop Canvas/WebGPU evidence. | [Playback](sequence-playback-contract.md), [frame layout](atlas-frame-layout-contract.md) |
| 2D presentation | Immutable frame capture, Canvas/WebGPU paths, textured geometry/Mesh2D and NineSliceBitmap within their declared profiles. | [Contract and scope](textured-geometry-and-mesh2d-contract.md) |
| Text | Text-raster orchestration, a noneditable TextField and a selected Canvas text integration. | [Contract and scope](text-field-tf1-contract.md) |
| 3D | CPU geometry/matrices, owned scene frames and selected explicit browser mesh/scene routes. | [Contract and scope](public-scene3d-contract.md) |
| Spine | Import and mesh source planning, a linear source profile and an experimental official Core manual bridge. | [Contract and scope](spine-core-manual-bridge.md) |
| Engineering and migration | Owned binary readers/writers, project transaction contracts and bounded legacy RES/MovieClip analysis. | [Contract and scope](legacy-project-migration.md) |

The default core is DOM/Node-free. Canvas and WebGPU are explicit browser entries. Display assembly, time advancement, capture and submission have distinct contracts. Resource leases and Scope/Engine ownership make cancellation and retirement explicit.

## Integrated 0.54 verification

The recorded 0.54 work completed all nine local code phases, Core **3218/3218**, retained Spine Source **160/160**, and focused Button checks **163/163**. The Button type positive produced **0** diagnostics and its negative consumer matched **19** diagnostics. The normal prepush and mandatory commit/push hooks completed, and the merged tree was compared with the reviewed files.

Desktop Edge **155.0.4283.45** Canvas/WebGPU verification completed **38** main readbacks and **87552** channel comparisons at tolerance **0**, with no mismatches. A separate fresh Canvas control recorded **2** readbacks and an intentionally wrong expectation differing by **48** pixels and **96** channels; it contributes no main-case credit. See [the Button verification record](bitmap-button-evidence.md). These counts describe different scopes and are not added together.

GitHub reported no statuses or check runs for PR #42. The local verification above is recorded separately from remote CI. Desktop pixels do not establish target-phone performance, energy use, font coverage or complete host support.

## Next work and contributions

- Extend UI composition beyond explicit local planning, followed by touch, keyboard, focus, accessibility and editing.
- Validate and extend the real-resource example toward multi-resource outfit changes, recovery and animation retargeting with explicit ownership and host limits.
- Complete versioned Spine support under **R020/V020**, including its feature/backend/host matrix.
- Extended 3D scenes, characters and effects, with asset and lifetime integration.
- Production browser/mini-game/native hosts and target-device typography and performance.
- Creation tools and Agent/project interfaces, plus complete old-project migration under **R008/V006**.

These remain engineering and acceptance obligations. The [engineering plan](engineering-plan.md), [delivery plan](delivery-plan.md) and registries track their scope.

## CPU reference formulas

The historical A2 Task5a oracle uses tools/texture-oracle.mjs. expectedUploadRGBA selects floor((C*A+127)/255) for integer straight channels. expectedEncodedOver computes binary64 source-over in the premultiplied encoded domain with explicit opacity, without UNORM quantization or color-transfer conversion. assertTexturePixel requires four explicit absolute channel bounds. Device calibration is separate.

## Historical engineering evidence

The [Changelog](../CHANGELOG.md) records the purpose of each increment. Detailed earlier results, failures and preparation cutoffs are preserved in subsystem evidence and the [versioned progress record](https://github.com/cnedwin/Egret_rebuild/blob/efd2a9c91fb6cfe633214b50b82cf7952941452a/knowledge-base/en/docs/core-progress.md). Historical counts and hashes continue to identify their original source; a later reading edit does not rerun or expand them.

The [contribution guide](https://github.com/cnedwin/Egret_rebuild/blob/main/CONTRIBUTING.md) describes reproducible changes and review. First-party implementation, external dependencies and research references retain their own attribution and licenses.
