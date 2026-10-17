# Changelog

English | [简体中文](../Cns/CHANGELOG.md)

Version labels below identify engineering checkpoints; workspace packages remain private 0.0.0 and the host protocol remains 1.0. Subsystem contracts and evidence state each checkpoint's acceptance scope.

## M1.1 candidate — warm WebGPU submission

M1.1 adds completion-safe vertex/index/uniform buffer reuse and complete-key binding reuse, and avoids covered warm image crop copies. The bounded caches preserve original admission, painter order and public APIs. Read the [contract](docs/warm-submission-contract.md) and [current evidence](docs/warm-submission-evidence.md). Actual operation counts, native image checks, performance and repository delivery remain separate acceptance domains.

## 0.61.0 — experimental WebGPU image residency

The **0.61.0 engineering preview** adds an internal image cache with per-Host ownership, reusing exact cropped GPU images after safe completion. Its LRU mechanism keeps a 32 MiB logical image pool and at most 256 ready entries, preserving existing public admission, rendering profiles and lifecycle management. It adds no public API or dependency.

Read the [contract](docs/gpu-image-residency-contract.md) and [evidence and limits](docs/gpu-image-residency-evidence.md). Controlled specification/ownership results and any current desktop regression results have separate scopes. The new dedicated cache browser matrix remains deferred and OPEN. Physical GPU memory, performance, target devices and actual device-loss recovery remain unverified. Workspace packages remain private 0.0.0; Host protocol remains 1.0.

## 0.60.0 candidate — atlas import planning

The **0.60.0 engineering preview** adds the optional `@egret/project/atlas` entry: strict single-page Aseprite stable-marker JSON-array planning with one explicit PNG binding. Its two runtime values and sixteen erased types produce owned, frozen inputs for the existing SpriteSheet and SequenceClip factories. The exact profile is `aseprite-json-array-1.3.18.6-v1`; exporter output compatibility, declared hashes and entitlement remain unverified.

Read the [contract](docs/atlas-import-plan-contract.md) and [evidence and limits](docs/atlas-import-plan-evidence.md).

Independently accepted saved results are focused planner 47/47, the earlier normal SDK run with core 3625/3625 and separate F2 160/160, and the distinct CPU firstGREEN 5/5. These overlapping scopes are not added together. Independent review also accepts the selected new Native Canvas/WebGPU four-readback result. Final integrated gates/prepush and 0.60 Git/remote delivery remain pending. Workspace packages remain private 0.0.0; Host protocol remains 1.0.

## 0.59.0 delivery update

The preceding 0.59 increment was delivered through [PR #48](https://github.com/cnedwin/Egret_rebuild/pull/48), Main `44f49f9d97a7baebc400fd4940541529dc33d147`. Earlier 0.59 readings and evidence retain their original authoring cutoffs; the new delivery statement does not rewrite them. No remote statuses or check runs were reported, so no CI pass is inferred.

## 0.59.0 candidate — normalized atlas frames — 2026-10-17

The explicit `'trim-rotation-v1'` profile on the existing SpriteSheet and SequenceClip factories supports single-page frames with transparent trim and clockwise90 packing. Owned layout preserves logical dimensions and placement through Bitmap and existing sequence playback, while the default rectangle path remains compatible. Read the [contract](docs/atlas-frame-layout-contract.md), [evidence and limits](docs/atlas-frame-layout-evidence.md) and [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/trimmed-atlas-playback/README.md).

The independently accepted 12-stage SDK `node tools/verify.mjs` run passed **3559/3559 core tests** and a separate **160/160 Spine experiment tests**, with failed/cancelled/skipped/todo all **0** in each suite. Separate desktop Canvas and textured WebGPU verification passed six fresh contexts and 30 complete RGBA readbacks at zero tolerance, including assigned controls and replay after origin retirement. The current verifier adds a thirteenth atlas source-boundary phase; its complete rerun, final publication/prepush, 0.59 Git delivery and remote CI remain pending at this authoring cutoff. Earlier failures and repairs are retained in the linked evidence. Exporter imports, multipage, pivot/nine-slice import, animated retarget, controller seek/rate/events, full Spine R020/V020, migration R008/V006 and physical-device/performance acceptance remain OPEN.

## 0.58.0 — Atomic Bitmap bindings and prepared outfits

Engineering preview **0.58.0** adds `Engine.captureBitmapBindings(scope, targets)` and the erased `BitmapBindingTicket` type. The prepared-outfit example waits for both clothing textures and commits their bindings together. Pending, failed, cancelled and obsolete changes preserve the working outfit; a ticket refuses to overwrite a later caller binding.

Recorded desktop Canvas and WebGPU checks passed six fresh contexts with 54 original RGBA readbacks, including separate old-layer controls, genuine mouse selection, animation boundaries and shutdown with original reads still pending. This is finite desktop evidence. General dependency manifests, additional content types, full UI, Spine, production hosts, mobile performance and physical-memory acceptance remain open.

Read the [contract](docs/prepared-resource-groups-spec.md), [evidence and limits](docs/prepared-resource-groups-evidence.md) and [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/prepared-resource-groups/README.md).

## 0.57.0 — real-resource scene integration

Engineering preview **0.57.0** combines real PNG resources, shared atlas playback, text and mouse input through existing public Engine APIs. Canvas is the default; the textured WebGPU scene is an explicit experimental choice. Resource preparation, presentation readiness, input readiness and safe shutdown have separate boundaries. Read the [integration record](docs/resource-scene-integration.md) and [example guide](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/resource-scene/README.md).

The recorded desktop Canvas/WebGPU workflow completed seven fresh contexts and retained 64 original RGBA frames. Fixed-point and font-region comparisons, negative controls and retirement passed in the documented environment. Phone, cross-environment font, performance and energy acceptance remain open.

## 0.56.0 delivery update — 2026-10-16

The 0.56 resource-replacement increment was delivered through [PR #45](https://github.com/cnedwin/Egret_rebuild/pull/45), Main `19c308af4d7c9590f886c8105d5d678e708184c5`. Earlier verification records retain their original cutoffs.

## 0.56.0 — recoverable Bitmap resource replacement

`Engine.createBitmapResourceSlot(scope, bitmap)` adds explicit asynchronous Texture replacement for one persistent Bitmap through the existing root entry, with the erased `BitmapResourceSlot` and `BitmapResourceSlotState` types. It borrows the initial binding and owns only fresh replacement leases. The prior usable binding remains during pending, failed or cancelled requests; only the latest accepted intent may commit. Cancellation and supersession reject their request Promises. Read the [specification](docs/bitmap-resource-slot-spec.md), [evidence and remaining acceptance](docs/bitmap-resource-slot-evidence.md) and [composition example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/bitmap-resource-slot/README.md).

Focused behavior, strict consumers and the recorded desktop Canvas/WebGPU composition have passed their bounded checks. Full local/public gates and repository delivery are recorded separately in the linked evidence. Complete UI, Spine R020/V020 and legacy migration R008/V006 remain OPEN. The prior 0.55 increment was delivered through [PR #44](https://github.com/cnedwin/Egret_rebuild/pull/44), Main `f6b7968db89febfdbe00fb1322f208ab2135f68f`; earlier entries retain their own historical evidence cutoffs.

## 0.55.0 — explicit local linear layout

The optional `@egret/engine/layout` entry turns explicit numeric records into a frozen local rectangle plan. Callers filter membership, arrange children and apply coordinates. A two-Button example composes existing shared input, a borrowed programmatic atlas, nested clipping and saved/live frames. Read the [specification](docs/local-linear-layout-spec.md) and [verification scope](docs/local-linear-layout-evidence.md).

## Documentation maintenance — 2026-10-15

Reorganized the public narrative around product goals, design reasoning, contracts and delivery. Product documents, navigation and bilingual readings are maintained together; sources, licenses and original experimental evidence remain traceable. This editorial change adds no engine capability.

## Previous integration — 0.54.0

Engineering preview 0.54.0 was integrated through [PR #42](https://github.com/cnedwin/Egret_rebuild/pull/42), Main efd2a9c91fb6cfe633214b50b82cf7952941452a, tree 2b39b8439a5b30ce3572edc162e8a7a916a76185. Its recorded full local checks passed Core 3218/3218 and Spine Source 160/160; desktop Canvas/WebGPU checks completed 38 main readbacks and 87552 channel comparisons at tolerance 0. These are distinct, overlapping verification scopes. Remote CI had no reported checks; no CI pass is inferred.

## 0.54.0

Reusable bitmap buttons connect shared mouse input, resource leases and pressed/disabled skins; activation performs a final pick after event routing. [Details](docs/bitmap-button-contract.md).

## 0.53.0

A runnable atlas playground combines texture loading, SpriteSheet crops, Engine-clock playback, explicit pivots and saved/live frames. [Details](docs/anchored-atlas-playback-contract.md).

## 0.52.0

Authored anchor offsets use the same transform semantics in frame collection, coordinate queries, bounds and picking. [Details](docs/display-anchor-offsets-contract.md).

## 0.51.0

Indexed child insertion preserves parent/child order, ownership and reentrant validation. [Details](docs/container-add-child-at-contract.md).

## 0.50.0

Direct-child index queries expose the current ordering without mutating the tree. [Details](docs/container-child-index-contract.md).

## 0.49.0

Batch detachment removes all direct children while retaining their separate resource and lifetime rules. [Details](docs/container-remove-children-contract.md).

## 0.48.0

NineSliceBitmap supplies fixed-border backgrounds using existing geometry, texture leases and owned frames. [Details](docs/nine-slice-bitmap-contract.md).

## 0.47.0

An experimental official Spine Core bridge drives original manual fixtures into Mesh2D frames. Complete Spine remains a separate requirement. [Details](docs/spine-core-manual-bridge.md).

## 0.46.0

The optional browser PNG provider adds bounded still-image decoding and explicit shutdown over the existing asset system. [Details](docs/browser-png-contract.md).

## 0.45.1

Shared path/byte identity helpers, canonical text writers and mandatory hooks address Windows path spelling and line-ending drift. [Details](docs/repository-identity-and-line-endings.md).

## 0.45.0

Named SpriteSheet frames share one atlas lease across static crops and sequence playback. [Details](docs/spritesheet-contract.md).

## 0.44.0

Scope-owned sequence playback follows the explicit Engine clock and supports once/loop control. [Details](docs/sequence-playback-contract.md).

## 0.43.0

The Spine linear source profile defines versioned animation inputs and source-level checks. [Details](docs/spine-linear-profile-contract.md).

## 0.42.0

Spine mesh source planning defines owned mesh-frame preparation and validation boundaries. [Details](docs/spine-mesh-source-plan-contract.md).

## 0.41.0

Nine-slice geometry adds explicit border and stretch semantics before the display component. [Details](docs/nine-slice-geometry-ns1-contract.md).

## 0.40.0

ByteWriter adds owned binary output, explicit byte order and transactional cursor behavior. [Details](docs/byte-writer-bw1-contract.md).

## 0.39.0

Textured scene composition joins selected 3D passes and depth-free UI through an explicit browser Host. [Details](docs/textured-scene-host-contract.md).

## 0.38.0

Public Matrix4 authoring exposes the existing first-party CPU matrix semantics. [Details](docs/public-scene3d-contract.md).

## 0.37.0

The original Spine F1 experiment gains opt-in Engine-clock integration.

## 0.36.0

The original F1 Spine experiment connects manual animation fixtures, mesh frames and browser verification.

## 0.35.0

Scope ownership is protected against the recorded public-shadow cases and cleanup reentry. [Details](docs/scope-private-ownership.md).

## 0.34.0

The optional Spine import planner adds strict metadata and scanner-first refusal semantics. [Details](docs/spine-import-plan-contract.md).

## 0.33.0

Primary mouse input connects authored hit areas, typed display events and Scope lifetime. [Details](docs/primary-mouse-input-contract.md).

## 0.32.0

Optional public scene and mesh facades expose selected owned CPU frames and a browser Host. [Details](docs/public-scene3d-contract.md).

## 0.31.0

Resource acquisition groups add whole-input preflight, bounded local waiters and shared cleanup. [Details](docs/resource-acquisition-groups.md).

## 0.30.0

A Canvas picking example demonstrates public hit testing, typed routes and post-dispatch visual feedback. [Details](docs/display-picking-example.md).

## 0.29.0

Logical hit testing defines explicit rectangle admission and display-tree picking. [Details](docs/display-hit-test-ht1.md).

## 0.28.0

The Canvas text path integrates raster images, replacement, generation and lifetime handling within its verified subset. [Details](docs/canvas-text-wc1-canvas.md).

## 0.27.2

Display-tree attachment avoids selected sibling rescans while preserving validation and cleanup order. [Details](docs/display-tree-scaling.md).

## 0.27.1

ByteReader adds owned scalar reads, explicit byte order, independent copy-out and an atomic cursor. [Details](docs/byte-reader-br1-contract.md).

## 0.27.0

The optional noneditable TextField connects prepared text images, resource leases and explicit replacement. [Details](docs/text-field-tf1-contract.md).

## 0.26.0

Scalar Tween adds Scope-owned transitions, selected easing functions and terminal cleanup. [Details](docs/scalar-tween-contract.md).

## 0.25.0

An explicit Engine clock separates game-time advancement from rendering and capture. [Details](docs/game-clock-contract.md).

## 0.24.0

Text raster orchestration adds exact requests, signed metrics, resource slots and explicit budgets. [Details](docs/text-raster-t1-contract.md).

## 0.23.0

Owned textured geometry and Mesh2D add immutable capture, preparation and an explicit WebGPU route. [Details](docs/textured-geometry-and-mesh2d-contract.md).

## 0.22.0

Receiver-local content bounds add immutable measurements and explicit traversal budgets. [Details](docs/display-content-bounds-contract.md).

## 0.21.0

Public local/global coordinate queries add immutable points and ancestor/lifetime bounds. [Details](docs/display-coordinate-query-contract.md).

## 0.20.0

SequencePlayer provides explicit-time atlas sampling and a public browser example. [Details](docs/sequence-player-contract.md).

## 0.19.0

Bitmap region admission/capture and the B1 browser verifier establish separate image and scene checks. [Details](docs/bitmap-region-contract.md).

## 0.18.0

CPU conversion of one named legacy MovieClip preserves crops, offsets and authored holds; complete migration is open. [Details](docs/legacy-movieclip-contract.md).

## 0.17.0

Internal CPU scene, mesh, sequence and RES-intent work expands the initial core without claiming production hosts. [Details](docs/3d-cpu-scene-contract.md).

## 0.16.0

Image-source projection, frame preparation, CPU blend references and 3D/RES analysis receive consolidated evidence. [Details](docs/core-framework-implementation-record.md).

## 0.13.0

Browser WebGPU rectangle execution establishes its fixed rendering and lifetime profile. [Details](docs/webgpu-rectangle-execution-contract.md).

## 0.12.0

Display transforms, inherited visibility/alpha, clipping and immutable frames reach the separate Canvas adapter. [Details](docs/display-and-frame-execution-contract.md).

## 0.11.0

Typed assets add shared acquisition, independent leases, cancellation and generation isolation. [Details](docs/resource-core-contract.md).

## 0.10.0

Bilingual readings, current identities, critical English comments and pre-push checks become a shared contribution policy. [Details](docs/bilingual-documentation-and-prepush-checks.md).

## 0.9.0

The repository combines independent core source and the knowledge base with public collaboration and source attribution. [Details](docs/open-source-collaboration-and-public-communication.md).

## 0.8.0

The first independent headless core implements contracts, runtime and engine responsibilities, lifecycle and typed events. [Details](docs/core-framework-implementation-record.md).

## 0.7.0

Engineering structure, modern API conventions and code-quality rules establish a shared implementation foundation. [Details](docs/engineering-architecture-and-project-structure.md).

## 0.6.2

Technical research adds shader-asset distribution and continued project-editing workflow considerations. [Details](docs/shaders-and-playground-lessons.md).

## 0.6.1

Independent implementation, explicit dependencies and research provenance receive separate rules. [Details](docs/independent-implementation-and-dependency-policy.md).

## 0.6.0

Backend, compilation and native-runtime options are analyzed as candidate designs. [Details](docs/graphics-backends-and-native-runtime-selection.md).

## 0.5.0

A fixed-version third-party asset experiment examines animation instances, text, resource release and context recovery.

## 0.4.0

Reference research defines source versions, licensing, integration roles and validation responsibilities. [Details](docs/open-source-research-and-validation-roles.md).

## 0.3.0

Event, resource, UI and mixed-graphics experiments refine identity, generations and recovery constraints.

## 0.2.0

The first white paper, requirements and engineering plan connect design assumptions to technical experiments.

## 0.1.0

The initial knowledge base organizes product scope, architectural candidates, delivery and community contribution.

## Historical verification records

Earlier results, failures, repairs and PENDING labels retain their original dates and source identities in the linked evidence and [versioned detailed notes](https://github.com/cnedwin/Egret_rebuild/blob/efd2a9c91fb6cfe633214b50b82cf7952941452a/knowledge-base/en/CHANGELOG.md). They are historical checkpoints, not a description of today's integration state. This concise Changelog records the main change in each version; detailed test counts are kept with the relevant experiment or subsystem.

Complete Spine support was added as R020/V020 on 2026-10-10; the import, mesh and manual Core experiments above do not complete that requirement. Automated legacy migration R008/V006 remains open.
