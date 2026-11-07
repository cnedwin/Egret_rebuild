# Engineering plan

English | [简体中文](../../Cns/docs/工程规划.md)

2026-11-07 · Audited implementation baseline: main [f869b37](https://github.com/cnedwin/Egret_rebuild/commit/f869b3733366d1fea0c71adba2cdc3ea03fe7ba1).

The next phase turns existing components into a usable core workflow. Preserve the eleven M2–M4 packages, their public contracts and current contributor ownership. [Core capabilities](core-progress.md) states what exists; the [architecture plan](architecture-and-engineering-plan.md) defines authority and gates; the [M2–M4 roadmap](m2-m4-delivery-plan.md) retains complete milestone acceptance.

## M3.3 implementation checkpoint

The native single/multiline increment uses the existing optional editing entries and [form](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/text-editing/README.md). The [contract](native-text-editing.md) retains source/session, row-retention, paired-font and publication authority. Final desktop checks cover 21 fixed plus eight responsive cases per shared backend; the [Android report](android-native-text-editing.md) separates actual keyboard observations, predecessor reuse and final-source lifecycle. Terminal composition teardown and responsive view-Scope retirement are corrected. Other IMEs/devices, clipboard, accessibility and full #89 acceptance remain OPEN; no new work package or touch assignment. Later batches retain their dependencies and are not started by this increment.

## Current position

M0's engineering foundation is available; independent human onboarding and remaining scenario/rights/device qualification stay in #52/#54. M1's rendering/resource engineering is integrated, while formal M1.2 remains OPEN at 10.3 ms full-dirty Engine median-p95 against 8 ms. M2/M3 have runnable assets, players, UI, paragraphs, fonts, themes and shared effects. M4 has usable ingredients but no complete mixed reference game or qualified core release.

The priority is to connect missing user behavior and expose integrated costs, not to rebuild delivered components or add another maintenance-automation phase. Package versions remain private 0.0.0; engineering-document numbers and merged PRs are not product release versions.

## Next capability batch

These are coherent increments within existing Issues, not new work-package IDs, personnel assignments or automatic authorization to implement them.

| Order / existing owner | Deliverable and actual entry points | Dependencies | Exit for the increment |
| --- | --- | --- | --- |
| First: M3.3 #89, input/host with M3.1/#87 and M3.2/#88 | Native single/multiline plain-text editing in managed UI. Reuse packages/runtime/src/input/, packages/runtime/src/ui/, packages/engine/src/ui/, packages/engine/web/keyboard.ts, the paragraph entries and existing committed geometry. | Delivered UI, focus, paragraph geometry and font sets. Does not wait for complete Spine or the unrelated touch implementation. | Editable scrolling form; revisioned values/selection/composition; bounded row/focus lifetime; old-visible-on-failure and clean disposal. Consolidated controlled and real-browser results; actual IME/device rows reported separately. |
| Parallel first integration: M4.1 #91, integration owner | One evolving editable mixed example, reusing examples/animation-outfits/, paragraph-panel/, ui-data-panel/, spine-reset/, sequence-reset/ and the existing scene3d contracts. | Current public interfaces for the first subset; #89 and remaining controls for its complete form. | One Engine/shared resource authority, stable authored IDs, independent animation/UI state, visible loading/failure/retry, replacement/recovery and precise declared subset. Record provider/content size and cost before the final campaign. |
| Parallel content/animation: M2.1–M2.4 #83–#86 | Binary/content and selected texture profiles; complete feature/reference inventory; bounded Spine seek/replay; compatible state-preserving replacement. Reuse packages/project/src/resources/, packages/spine/src/ and engine resource/animation owners. | Exact current artifact/instance contracts. Authorized Editor exports and independent references block their corresponding qualification, not all programmatic implementation. | Each chosen increment has one end-to-end public consumer, clear compatibility/failure semantics and required affected checks. Full selected-version acceptance stays open until every required row has evidence. |
| Join: M3.4 #90, UI/control owner | Complete the remaining control/layer/semantic set using existing themes/effects and #89's editor. | Usable UI/text/input slices; existing coordinated touch contribution. | One coherent form/list/popup/modal example with keyboard/semantic behavior and controlled cleanup; declared assistive-technology and phone rows remain explicit. |
| Qualification: M1 #55 and M4.2 #92 | Measured full-dirty improvement on the unchanged original M1 fixture, then complete mixed performance/lifecycle/device campaign. | Short correctness/recovery path; final actual source/content/device/profile frozen for formal collection. | Original CPU/preparation targets and required X/L/phone rows pass, with all original failures and unmeasured physical domains retained. |
| Handoff: M4.3 #93 | Clean-consumer preview distribution, example/contract matrix, compatibility notes and contribution path. | Early documentation can proceed now; complete qualification depends on #91/#92. | Actual distribution/public entries/notices verified; English/Chinese guide; exact supported combinations and open rows. No stable-engine or full-product claim from a source archive alone. |

The table gives dependency order, not calendar duration. One public interface/file has one active writer; separate branches/worktrees allow independent packages to advance while CI checks a frozen candidate. Integrate the next candidate with current main before its own delivery. Formal performance runs remain free of competing local load.

## Contracts that the next batch must preserve

### Native editing and committed UI

The engine model owns committed value/revision and UTF-16 source selection. A real focusable native input/textarea owns active composition, selection and editing geometry; there must not be a duplicate visible editable value or semantic node. beforeinput/input/composition events enter one ordered stream, with no double commit or mid-composition rewrite.

Activation retains source selection and a stable control/scroll anchor. Deactivation settles composition according to an explicit policy, prepares matching paragraph/layout, then commits the affected UI domain. Native and CanvasKit line breaks may differ: declare font-specific reflow/anchor tolerances. Do not guess character widths.

M3.3 also owns browser font registration/readiness and cleanup for the active native editor. CanvasKit registration does not register a CSS FontFace. Reuse the admitted font resource identity and leases, declare fallback and reflow behavior, and retire superseded registrations when their sessions drain; do not create another asset manager or assume identical native/CanvasKit line breaks.

Virtual-list retention counts the active/focused/composing row within the existing live-container cap. Retain it within a bound or transfer focus before recycling. Late fonts, superseded programmatic values, viewport/keyboard changes, blur, cancellation, disposal and callback errors cannot revive old sessions or mix layout revisions. Mouse/touch routing remains with its existing owner.

The complete first increment includes ordinary single/multiline editing, selection, paste, emoji deletion, undo/redo and programmatic conflict behavior. Test representative CJK, RTL and combining text; distinguish controlled event schedules, actual browser operations and true IME/hardware observations. Unsupported native transforms/clips are explicit capability restrictions.

### One mixed reference and early budget intake

M4.1 grows one project from current public APIs. It does not create a second asset manager, renderer or time loop per subsystem. Reuse existing content and independent fixtures; persist authored stable IDs/declarations through project transactions where applicable, keeping native objects and transient playback out of saved data.

The first integration can use a declared development subset. Final X-D60/1 and X-MTouch/1 still require their original full scene semantics, quantities, devices and targets. A 20-Spine/200-sequence component example does not prove the mixed eight-Spine/80-sequence profile with complex UI.

Before expanding the full scene, identify actual required JS, provider WASM/Unicode data, fonts and other assets; measure the cold ready path and separately account source, provider, raster, Host and in-flight residence. Current paragraphs use CanvasKit/SkParagraph, not a second standalone ICU/HarfBuzz/FreeType implementation. Existing raw payload figures are not compressed transfer results.

M3.2 and M4.1 own this intake; M4.2 owns formal measurement. Preserve the published X ceilings and original failures. If a real provider/content constraint requires a changed profile, publish a reasoned versioned successor before collecting its acceptance; keep the original target record. Do not remove languages, postpone required initialization past first-interactive, or enlarge limits merely to obtain a pass.

### Animation compatibility and publication

M2.1 owns exact artifact/source/runtime identities, fixture rights and variant admission. M2.2 owns semantic advancement, independent instance state, failure and bounded seek/replay. Retain the planned physics segment, history, seek/event budgets and refusal rules until an explicitly reviewed compatible contract supersedes them.

M2.3 owns copied ordered geometry and exact alpha/color/sampling. Failed drawing preserves its last owned visual without pretending committed animation events were rolled back. M2.4 owns resource/instance candidate preparation, compatibility policy, CPU commit and Host-generation integration.

Current RESET does not preserve arbitrary tracks/time. A preserve-mode increment first declares compatible asset IDs/names/tracks/skins/event history, stages a candidate and refuses unsupported mappings without silently resetting. Independent instances and the global game clock do not wait for a surface recovery. Source/instance and device generations remain distinct.

## Retain, change and defer

| Decision | Concrete scope |
| --- | --- |
| Retain | Scope/events, AssetManager/leases, display semantics, explicit clocks, current public entries, shared backend executors and completion/generation authority; current paragraph/font/theme/layout results; independent references and failed records |
| Extend | Native edit state/host bridge and UI retention; current content producer/provider profiles; Spine replay/compatible replacement; complete controls/semantics; one mixed example |
| Refactor only for a demonstrated need | Shared frame preparation, provider/raster keys or native/storage paths required by a selected capability or measured bottleneck. Keep ordinary old-API consumers and saved-frame behavior. |
| Keep historical | Spine/3D/text research programs and original evidence. They inform mechanisms but do not replace current product adapters or full-feature references. |
| Defer as separate product lines | Imported 3D scenes/characters/materials/VFX, mini-game/native/desktop hosts, integrated visual/Agent platform and complete migration. Their requirements remain mandatory in the larger product scope. |

## Larger product sequence

| Product line | Entry supplied by this core | Next complete outcome and acceptance |
| --- | --- | --- |
| Lightweight 3D | Existing scene/resource/clock/Host boundaries and 2D overlay composition | Editable model-to-scene import and camera/materials, then animated characters and bounded VFX, sharing UI/resources/recovery. Actual import/pixels/events/device budgets, not procedural quads, qualify this line. |
| Platform Runtime and publishing | Explicit host/capability/input/resource contracts | Select actual browser/mini-game/native priorities, then one complete startup/play/pause/storage/update/debug/package loop per chosen host. Native language/VM/graphics selection has its own measured boundary. |
| Creation and Agent platform | Stable project transactions, artifacts, diagnostics and editable examples | Shared code/visual/natural-language changes, preview, conflict/undo, user-selected model APIs, Skill/MCP/plugins, visible token costs/limits and real target publication. Validate actual new-creator task completion. |
| Legacy migration | Preserved display/event/resource semantics and bounded RES/MovieClip planners | Authorized old baseline → deterministic conversion → bounded Agent repair → equivalent old/new replay → continued editing/publication/update within a declared support matrix. Compilation/startup alone cannot pass. |

Inventory, rights and interface work can proceed before full M4 external qualification. New implementation in these product lines requires a separately selected complete scope; this review does not start them or rename the M2–M4 program.

## Development and delivery rhythm

Concentrate implementation and example integration for one coherent behavior increment. Then run the affected type/behavior tests and required real-browser checks together, fix actual failures and obtain one independent source/results/bilingual review. Avoid repeated unrelated historical matrices.

Normal commit/push hooks and the complete final merge gate remain mandatory. Use focused local feedback; the unchanged final-candidate Windows integrated gate and portable CPU jobs qualify merge under the existing GitHub Actions-bound rule. Exact input comparison permits reuse of earlier browser/device evidence; code changes invalidate their affected scope.

Milestone performance, sustained lifecycle and real-device/IME/accessibility campaigns are separate from ordinary merge feedback. They run when their actual prerequisites and claims exist, not after every wording edit. A failed required row stays open. For each Windows failure, use the existing [governance and Skill](windows-ci-governance.md); no new maintenance project is introduced.

## Community handoff

Issues #83–#93 retain outcomes, entry files, dependencies, responsibility and full acceptance. Project 2 is the workflow status; labels describe capability/contribution type. In Progress includes delivered slices with remaining work, Ready refers to a stated startable contribution, and Blocked identifies the missing prerequisite. None assigns a volunteer.

Contributors can take a bounded PR inside a package, supply lawful reference assets, reproduce a bug, improve translations or perform the independent newcomer flow. Maintainers coordinate shared interfaces and derived current metadata. Preserve contributor attribution, comments and original evidence.

The [delivery plan](delivery-plan.md) maps this engineering sequence to the full product obligations. Earlier task estimates, research comparisons and preview cutoffs remain in the [previous engineering plan](https://github.com/cnedwin/Egret_rebuild/blob/f869b3733366d1fea0c71adba2cdc3ea03fe7ba1/knowledge-base/en/docs/engineering-plan.md) and subsystem records. This plan commits no staffing, cost, dates, platform entitlement or measured performance.
