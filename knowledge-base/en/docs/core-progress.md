# Core capabilities and remaining work

English | [简体中文](../../Cns/docs/core-progress.md)

Reviewed baseline: 2026-11-07, main [f869b37](https://github.com/cnedwin/Egret_rebuild/commit/f869b3733366d1fea0c71adba2cdc3ea03fe7ba1). This is an engineering preview with runnable public examples. Workspace packages remain private at 0.0.0; source publication is not an installable stable-engine release.

Use this page for current capability status, the [engineering plan](engineering-plan.md) for the next work, and subsystem contracts for exact APIs and evidence. Historical previews are not competing current versions.

## Product and implementation

Egret's product direction combines animation-rich 2D games and complex interfaces with lightweight 3D, an integrated AI-assisted creation platform, target publishing and legacy-project migration. The current implementation supplies the runtime foundation. It does not yet supply the complete creator, native/mini-game or migration products.

| Area | Available implementation | Remaining capability or acceptance |
| --- | --- | --- |
| Display and rendering | Familiar display objects, coordinates, explicit hit geometry and immutable captures; ordered shared WebGPU/WebGL2 paths, adjacent preparation/batching, texture pages, bounded buffer/target reuse, Alpha masks and separable blur | Original full-dirty CPU/preparation targets; broader devices and hosts; complete feature-specific references. Canvas retains its smaller declared profile. |
| Resources and builds | Manifest admission, shared acquisition/leases, Scope cleanup, cancellation and late-result handling; reproducible selected PNG/atlas/sequence/font builds, cache/project adoption and typed runtime groups | Spine binary products, selected texture/mip/compression variants, broader format/exporter qualification and complete scene-level acceptance |
| Animation | Explicit Engine time, Tween and sequence playback/controls; optional Spine JSON assets, independent players, combined skins, finite plays and shared rendering; separate Spine/sequence RESET slots | Bounded Spine seek/replay, complete selected-version semantics/references and compatible state-preserving asset replacement |
| UI | Managed roots, measure/arrange, variable-height stable-key lists, anchors, row focus and reveal; immutable theme/skin generations, shared effects and owned popup/modal composition | Full controls, semantic projection and complete large-scene qualification |
| Text and fonts | Readonly CanvasKit/SkParagraph paragraphs, final-line bidi, wrapping, alignment/maxLines, styled runs, committed hit/selection/caret geometry and managed font-set switching; optional native single/multiline editing and paired browser fonts | Actual IME qualification; independent required script/font/ink references; transfer/startup and CPU/Wasm/memory qualification |
| Input | Compatible old mouse API, optional multi-contact routing, keyboard/logical focus, responsive examples and merged movement/action state controls | Remaining control/example/keyboard wiring, gesture arbitration, full semantic integration and required actual phone/IME/accessibility rows |
| 3D | Owned geometry/matrices, fixed opaque scene routes and ordered 2D overlays on the declared backends | Model import, usable scene/camera/material authoring, animated 3D characters, lighting and general VFX |
| Project and tools | Versioned project snapshots/transactions, structured diagnostics and bounded legacy RES/MovieClip analysis; pinned setup, review and public CI | Project-to-running-game authoring loop, integrated visual tools, Agent/Skill/MCP applications, publication/update adapters and complete migration |

## Popup/modal increment — 2026-11-07

M3.4 now provides [owned popup/modal roots](ui-layers.md), staged publication, clipped anchors, nested retirement, pointer barriers, contained logical focus and native editor suspension. The existing form integrates details/rename/return with shared resources. Complete controls, gestures, semantic projection and device/accessibility qualification remain in #90; this increment does not implement the separately owned touch work.

The M3.4 phone follow-up observed32 current-device assertions on the shared backends and corrected fallback-focus activation and provisional text loss during OS rotation. The [layer evidence](ui-layers.md) retains the initial locked attempt and real failures. Other devices/IMEs, semantics and complete M3.4/M4 remain OPEN.

## Native editing increment — 2026-11-07

M3.3 provides optional native input/textarea editing with committed source/selection/composition, existing paragraph/UI publication, paired fonts and row/resource lifetime. The final desktop batch passes 21 fixed plus eight responsive checks per backend; actual Samsung keyboard observations and exact-final-source Android lifecycle checks are separated in the [Android follow-up](android-native-text-editing.md). The bridge now handles terminal composition callbacks after cancellation, and the responsive form retires each view Scope on width changes. Other IMEs/devices, system clipboard, accessibility, complete packages and M1.2 remain open. Touch ownership and fixed fixtures are unchanged.

## Implemented packages and entry points

The repository has four foundation packages plus one explicitly optional Spine package. This is the actual workspace, not the larger directory proposal.

| Package | Current responsibility and entry |
| --- | --- |
| @egret/contracts | Dependency-free shared contracts and resource records |
| @egret/runtime | Host-free display, events, Scope, assets, text/input/UI state; depends on contracts |
| @egret/engine | Public assembly, clock, resources, UI/animation coordination and explicit browser backends; depends on runtime/contracts |
| @egret/project | Project transactions and selected content/import tools; depends on contracts and its declared parser |
| @egret/spine | Optional first-party asset/player/display/RESET integration with official Core 4.3.13; depends on public Egret boundaries and the separately licensed runtime |

Default Engine imports do not initialize Spine, 3D, paragraph WASM or a native VM. The [actual package structure](engineering-architecture-and-project-structure.md), package manifests and public-entry contracts define available names. Proposed CLI/editor/native packages are not installed products.

Current usage contracts:

- [Shared rendering](shared-render-profile-contract.md), [WebGL2](webgl2-executor-contract.md), [resource recovery](resource-recovery-contract.md) and [shared UI effects](shared-ui-effects.md).
- [Build-to-runtime content](content-build-pipeline.md), [multipage atlases](multipage-atlas-content.md) and [font resources/generations](font-resource-generations.md).
- [Spine assets/playback/display](spine-content-ingress.md), [Spine RESET](spine-reset-slot.md), [sequence controls](sequence-controls.md) and [sequence RESET](sequence-reset.md).
- [Managed UI](ui-data-panel.md), [styled paragraphs](paragraph-styled-runs.md), [committed text geometry](paragraph-text-geometry.md), [font/layout controls](paragraph-layout-controls.md) and [themes](ui-theme-generations.md).
- [Multi-contact input](multi-pointer-input.md), [keyboard/focus](keyboard-focus-input.md), [movement/action control scope](m3-ui-text-input-plan.md) and [responsive examples](mobile-examples.md).
- [Bounded 3D](public-scene3d-contract.md), [project transactions](project-transaction-core-contract.md) and [legacy migration scope](legacy-project-migration.md).

## Existing work packages

All eleven M2–M4 packages remain open to their complete acceptance. A merged feature is credited below without declaring the whole package finished.

| Package / Issue | Delivered basis | Remaining outcome / coordinating role |
| --- | --- | --- |
| M2.1 / [#83](https://github.com/cnedwin/Egret_rebuild/issues/83) | PNG, atlas, multipage, sequence and font build/runtime paths; optional Spine JSON ingress | Binary/variant builds and authorized selected-version reference inventory / content maintainer |
| M2.2 / [#84](https://github.com/cnedwin/Egret_rebuild/issues/84) | Independent Spine instances, tracks/queues, skins and finite plays; sequence controls | Complete qualified semantics and bounded seek/replay / animation maintainer |
| M2.3 / [#85](https://github.com/cnedwin/Egret_rebuild/issues/85) | Shared Spine geometry under explicit egret-shared-linear/1 | Complete attachment/clip/tint/blend/sampling references / rendering maintainer |
| M2.4 / [#86](https://github.com/cnedwin/Egret_rebuild/issues/86) | Editable 20-Spine/200-sequence example; RESET and selected recovery | Compatible state preservation and final animation lifecycle/budgets / resource-animation maintainer |
| M3.1 / [#87](https://github.com/cnedwin/Egret_rebuild/issues/87) | Managed layout, stable-key virtualization, anchors, focus/reveal, font/theme integration and bounded editor-row retention | Complete coherent UI scenario / UI maintainer |
| M3.2 / [#88](https://github.com/cnedwin/Egret_rebuild/issues/88) | Readonly styled text, geometry and font generations | Required independent references and provider cost/recovery qualification / text maintainer |
| M3.3 / [#89](https://github.com/cnedwin/Egret_rebuild/issues/89) | Contact routing, keyboard/focus, row integration and native single/multiline plain-text editing | Actual IME/mobile keyboard, clipboard and accessibility qualification / input-host maintainer |
| M3.4 / [#90](https://github.com/cnedwin/Egret_rebuild/issues/90) | Masks/blur, themes, owned popup/modals and contributed movement/action state | Remaining controls, gestures and semantics / UI maintainer with existing touch contributor |
| M4.1 / [#91](https://github.com/cnedwin/Egret_rebuild/issues/91) | Runnable component examples and public interfaces | One editable mixed reference project; ready for a bounded first integration / integration maintainer |
| M4.2 / [#92](https://github.com/cnedwin/Egret_rebuild/issues/92) | Fixed desktop recovery and bounded Android component evidence | Complete mixed lifecycle, performance and required device campaign / performance-platform maintainer |
| M4.3 / [#93](https://github.com/cnedwin/Egret_rebuild/issues/93) | Observable preview failure/cancel/reload and public contribution entry | Clean-consumer distribution and qualified handoff / release maintainer |

Roles describe responsibilities, not staffing or automatic volunteer assignments. Existing touch/control ownership is retained; other work consumes its interfaces.

## Evidence that remains open

M1.1–M1.5 engineering is integrated. The formal M1.2 static/sparse/full-dirty Engine median-p95 remains **5.0 / 6.4 / 10.3 ms**; full-dirty misses the **8 ms** target. The full-dirty Host span of 7.7 ms does not establish the 4 ms preparation upper bound or isolate pure preparation. GPU time remains unmeasured. [#55](https://github.com/cnedwin/Egret_rebuild/issues/55) and the [original record](incremental-frame-preparation-evidence.md) remain open.

The [Android report](android-device-validation.md) records finite WebGPU/WebGL2 component, lifecycle and controlled recovery results, including the font-registration example correction in #129 and twelve added diagnostic/lifecycle cases in #130. The historical approximately 41.4 ms callback trigger was not reproduced; precise heap/backing observations do not establish physical-memory or universal zero-leak acceptance. The withdrawn wrong-target startup report is not an Engine regression.

That phone evidence does not complete X-MTouch/1, the mixed 100-lifecycle/10-recovery campaign, required iPhone/IME/accessibility rows or a complete authorized Spine corpus. An API probe, simulated input, CI or a short callback sample cannot close those rows.

M0's [independent newcomer rehearsal #52](https://github.com/cnedwin/Egret_rebuild/issues/52) and [remaining scenario/rights/device qualification #54](https://github.com/cnedwin/Egret_rebuild/issues/54) also remain open. They block their stated claims, not unrelated implementation.

## Next development phase

Native plain-text editing and the M3.4 popup/modal increment now consume current paragraph geometry, fonts and managed UI. Complete the remaining control/semantic set within #90. In an independently owned branch, M4.1 can assemble the existing animation/UI/resources into one example and expose provider transfer/startup and whole-engine costs early. M2 contributors can complete binary/content qualification, seek/replay or state-preserving replacement against existing owners. M3.4's coordinated touch work continues separately.

Then finish the remaining controls and the complete mixed scenario, resolve the unchanged M1 performance gap, and execute the required M4 campaign on frozen inputs. A bounded engineering preview may precede complete qualification; it must carry its actual limits. The [engineering plan](engineering-plan.md) assigns dependencies and exit criteria without adding work-package IDs or promising dates.

## Historical records

The [changelog](../CHANGELOG.md), subsystem evidence and [previous progress page at the reviewed baseline](https://github.com/cnedwin/Egret_rebuild/blob/f869b3733366d1fea0c71adba2cdc3ea03fe7ba1/knowledge-base/en/docs/core-progress.md) preserve original preview cutoffs, counts, failures, hashes and later repairs. This consolidation changes their presentation, not their execution results. Sources, upstream licenses and contributor credit remain in their original records.
