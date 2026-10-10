# Spine Animation Support and Acceptance

English | [简体中文](../../Cns/docs/Spine动画支持需求与验收.md)

Updated: 2026-10-10. R020 is a confirmed product requirement: Egret must fully support Spine animation. V020 is planned, with implementation `not_started` and acceptance `not_run`. This amendment adds a delivery obligation; it establishes no implemented Spine capability, performance result, dependency installation or release. Earlier animation experiments and S027 retain their original scope.

## Product requirement and the meaning of complete support

Spine is a first-class animation asset type in the resource pipeline, runtime, renderer, workbench and AI creation workflow. Creators should import source exports, preview and control animation, combine skins and attachments, place animated objects in scenes or complex UI, and package their work for declared supported hosts. Projects must remain editable and their source assets traceable. This requirement complements DragonBones and frame animation; it does not remove either obligation.

“Perfect support” means feature and behavior parity with the corresponding official Spine runtime and authored assets in a published, verified compatibility matrix. Passing a simple playback demo is insufficient. Missing features, unverified hosts and incompatible versions must be explicit; the engine must not silently remove constraints, approximate meshes, flatten animations into frames or drop events to claim compatibility. The matrix must enumerate the complete exported/runtime feature set of each selected version, rather than treating the feature examples below as exhaustive. It must expand as version support is delivered.

## Version and host policy

As checked on 2026-10-10, the official API documentation identifies 4.3 as the current non-beta runtime series. Spine's version policy requires matching export and runtime major/minor versions. These are upstream facts, not evidence of Egret compatibility. See the [official API reference](https://esotericsoftware.com/spine-api-reference) and [versioning guide](https://esotericsoftware.com/spine-versioning).

The initial implementation proposal evaluates 4.3 first and 4.2 as the preceding compatibility series. Inventory 3.8, 4.0, 4.1 and custom integrations when authorized legacy projects require them; no historical series is declared supported by this document. Exact packages/commits, supported export patches and assets are pinned before implementation acceptance. Do not infer the latest published package from a repository manifest or assume an editor patch number equals a runtime package patch number. Beta adoption is separate and never silently replaces a stable project dependency.

Each matrix row records export version, runtime identity, JSON/binary format, feature profile, Egret build, rendering backend, host/device/OS identity, asset rights, actual result and evidence location. At present all Egret Spine rows are unverified. Target-host rollout follows the existing platform plan; this amendment sets no first-release host order or date.

## Candidate integration boundary

The recommended candidate uses official Spine runtime semantics behind a separately enabled Egret adapter. Egret independently implements integration with its display tree, ordered render commands, resources, clocks, events, diagnostics and project transactions. A candidate package name is `@egret/spine`; it is not an existing export or installed dependency. Projects without Spine must not acquire its runtime, assets or native code through the default engine entry.

The official [4.3 TypeScript runtime](https://github.com/EsotericSoftware/spine-runtimes/blob/4.3/spine-ts/README.md) separates skeleton processing from rendering. That permits evaluation of `spine-core` with an Egret renderer adapter. The official [Pixi integration](https://esotericsoftware.com/spine-pixi) demonstrates upstream WebGPU support; it is a feasibility reference, not Egret implementation evidence. Egret's WebGPU and WebGL paths must preserve the same pose, slot order, clipping, color and blend semantics while using Egret's rendering/resource lifecycle. Prefer integration into the engine's graphics context; a standalone player with a separate canvas does not satisfy UI composition, input or shared resource requirements.

Ordinary `spine-canvas` is not a full-feature reference: its documented limitations include mesh attachments, clipping and two-color tinting. CanvasKit is a distinct backend with its own limitations, package costs and acceptance. A Canvas-only host may advertise only an explicitly verified profile. An unsupported asset must produce an actionable diagnosis before publication; any alternative must preserve the original project and show differences. No fallback automatically counts as complete R020 delivery.

For a future native runtime, compare the official [C++ runtime](https://github.com/EsotericSoftware/spine-runtimes/blob/4.3/spine-cpp/README.md), [C wrapper](https://github.com/EsotericSoftware/spine-runtimes/blob/4.3/spine-c/README.md) and selected JavaScript VM route. A Rust host does not require rewriting Spine semantics in Rust. FFI ownership, error handling, clock/pose agreement and exact ABI version require their own design and acceptance. This document selects no native implementation.

## Required acceptance matrix

The following rows are required Egret acceptance work, not test results. Features apply only where they exist in the pinned Spine version; absent-version features are documented explicitly, not counted as passes.

| Area | Required behavior and counterexamples |
| --- | --- |
| Import and provenance | Import JSON and binary skeleton exports with atlas pages and image dependencies. Record versions, original identities and rights; diagnose mismatches, missing pages, invalid data and resource limits before modifying a usable project. Never convert by changing a version string. |
| Skeletons and attachments | Preserve bones, slots, setup pose, skins, combined skins, attachment changes, weighted/unweighted and linked meshes, deformation, bounding-box/path/point attachments and sequence attachments. Check atlas trimming, rotation, coordinates and scale using version-correct assets. |
| Constraints and timelines | Cover every constraint and timeline supported by the pinned runtime: IK, transform, path, physics and version-specific additions such as 4.3 sliders. Validate constraint ordering, inherited transforms, skin-dependent state and time stepping against corresponding official behavior. |
| Playback and events | Cover tracks, queues, blending, transitions, additive behavior, looping, speed, seek, pause/resume, start/interrupt/end/dispose/complete and authored events where applicable. Specify event handling for seeks and skipped frames. Check boundary times, interruptions, disposal during callbacks and repeated recovery; visual sampling must not silently change required gameplay events. |
| Pixels and composition | Preserve slot draw order, mesh deformation, clipping, light/dark tint, opacity, premultiplied/straight alpha, normal/additive/multiply/screen blending, atlas sampling and color-space conventions. Include 4.3 draw-order folders and convex/inverse clipping in its version profile. Compare transparent edges and overlapping content with version-correct references at fixed inputs. Global texture sorting must not change output. |
| Complex UI and 3D composition | Preserve parent transforms/alpha/visibility, scrolling and UI masks, declared hit areas and attachment-following objects. Verify Spine placed between UI layers, over a 3D scene and in declared world-space configurations, including negative scale, reparenting and high DPI. Existing 3D character animation remains a separate capability. |
| Ownership and recovery | Share immutable skeleton/atlas data while instances own poses, skins, tracks, callbacks and physics state. Test cancellation, late completion, partial loading, one-instance disposal, final release, repeated entry/exit, background transitions and graphics loss. Recovery reuploads resources and revalidates interaction without restarting consumed rewards/events. |
| Workbench and AI | Import, inspect dependencies, preview tracks/skins, modify and undo references, locate diagnostics, export an editable project and package for supported hosts. AI may select and configure existing assets but must preserve manual edits and cannot fabricate missing animation names or license rights. |
| Legacy migration | Inventory existing Spine plugins and versions under R008/V006. Preserve originals and compare old/new visuals, tracks, events, skins, clocks, resources and host behavior before declaring success. Continued editing, undo, publication and updates remain mandatory. Unknown custom plugins stay explicit migration gaps. |
| Platforms and performance | Run actual browser/mini-game/native host/device rows when available. Measure equivalent-content startup, tail frame time, memory, resource lifetime and sustained load with complex UI/3D. Package and CPU/GPU/power objectives need measured baselines; no benchmark number is invented here. Publish failures and sample conditions alongside successes. |

Pixel references need fixed assets, inputs, clocks, cameras, color/alpha conventions and tolerances set before execution. Discrete semantics such as slot order, attachment identity and event order/counts require exact agreement; numerical transforms and pixels use documented numerical tolerances. Physics comparisons use the same update/reset inputs and stepping policy. Sharing the official semantic runtime does not make a pose comparison independent: renderer checks need independent draw-state/pixel references and intentional failures. Official examples establish upstream behavior only; authorized legacy-project and target-host tests establish Egret integration behavior.

## Engineering work packages and delivery gate

| Stage | Reviewable output | Exit condition |
| --- | --- | --- |
| SP1: versions, rights and complete feature inventory | Exact runtime candidates, export/asset fixtures, distribution obligations and a feature-by-version matrix | Version matching, legal notices and reproducible reference inputs are identified. Unknowns remain explicit. |
| SP2: resource and instance integration | Loader/atlas/resource ownership, clock/event/pose contract and candidate public API | Import failure/cancellation, independent instances, playback semantics and disposal have focused counterexample coverage. No full renderer claim. |
| SP3: ordered graphics integration | Egret WebGPU/WebGL geometry, tint/blend/clipping, UI/3D composition and graphics recovery | Full selected-feature references and negative cases pass per backend. Canvas limitations remain separately declared. |
| SP4: creator, migration and host integration | Workbench/Agent commands, editable exports, old/new comparisons and actual target-host runs | Creation/edit/undo/package/update loops and all required supported matrix rows pass; performance scope and remaining gaps are published. |

V020 is a required Spine capability work package, owned jointly by V002 rendering/runtime and V004 resources/animation, with their host/creator integration through V005 and legacy comparison through V006. Its registered prerequisite is V001's authorized samples and baselines; SP1–SP4 also require the relevant resource, rendering, project and host interfaces to be ready. These are integration gates, not a requirement that all four complete products be accepted before Spine work can pass. The existing final product dependency sets are preserved, and their R020 acceptance criteria explicitly include Spine. Do not mark full V002/V004/V005/V006 delivery accepted while applicable R020 obligations remain open.

No duration, staffing or performance budget is committed by this amendment. V020 becomes accepted only with reproducible implementation, complete selected-version features, actual declared-host rows, source/dependency/asset provenance, notices and review. Document review, a library's feature list or pre-push success cannot satisfy that gate.

## Licensing, attribution and evidence limits

Spine Runtimes use the [Spine Runtimes License Agreement](https://esotericsoftware.com/spine-runtimes-license), with integration/distribution conditions in section 2 of the [Spine Editor License Agreement](https://esotericsoftware.com/spine-editor-license). They are not covered by Egret's Apache-2.0 license. For toolkit use, the official terms describe Spine Editor license requirements for users creating or modifying software containing the runtimes and retention of applicable notices. Review the exact release/distribution arrangement before integration; an optional adapter does not waive those conditions. This is a source-based engineering constraint, not a completed legal assessment of a future distribution.

Keep independently authored Egret integration, unmodified/modified third-party runtime code and assets separately attributed. Do not copy competitors' Spine adapters. Preserve upstream notices and track asset redistribution rights independently from runtime licensing. No runtime source or example asset is incorporated by this amendment.

Sources: S066 records the project owner's new requirement; S067 records the current official technical documentation; S068 records the official license texts, checked on 2026-10-10. Research supports the candidate and acceptance design only. No Spine dependency, source execution, browser pixels, phone test or native validation has been performed for V020.
