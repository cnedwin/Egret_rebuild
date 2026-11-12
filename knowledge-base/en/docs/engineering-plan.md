# Engineering plan

English | [简体中文](../../Cns/docs/工程规划.md)

2026-11-13 · Audited implementation baseline is main [20cc6f6](https://github.com/cnedwin/Egret_rebuild/commit/20cc6f61796238bd8e792b9a8984ac237331050e).

The next phase turns existing components into a usable core workflow. Preserve the eleven M2–M4 packages, their public contracts and current contributor ownership. [Core capabilities](core-progress.md) states what exists; the [architecture plan](architecture-and-engineering-plan.md) defines authority and gates; the [M2–M4 roadmap](m2-m4-delivery-plan.md) retains complete milestone acceptance.

## M3.4 layer implementation checkpoint

The delivered [popup/modal layers and focus](ui-layers.md) use the native editor and the existing paragraph, font and root lifetimes. The form supports details, draft rename and return. Remaining controls and semantics stay in #90.

## M3.3 implementation checkpoint

The native single/multiline increment uses the existing optional editing entries and [form](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/text-editing/README.md). The [contract](native-text-editing.md) retains source/session, row-retention, paired-font and publication authority. Final desktop checks cover 21 fixed plus eight responsive cases per shared backend; the [Android report](android-native-text-editing.md) separates actual keyboard observations, predecessor reuse and final-source lifecycle. Terminal composition teardown and responsive view-Scope retirement are corrected. Other IMEs/devices, clipboard, accessibility and full #89 acceptance remain OPEN; no new work package or touch assignment. Later batches retain their dependencies and are not started by this increment.

## Current position

M0’s engineering foundation is available. Independent human onboarding and remaining scenario, rights and device qualification stay in #52 and #54. M1 rendering and resources are integrated. The [latest fixed desktop evidence](incremental-frame-preparation-evidence.md) records a 5.3 ms M1.2 full-dirty Engine median-p95 and open wall-gap qualification. M2 ships compatible sequence preservation, and M3 includes native single/multiline editing and owned popup/modal layers. M4’s [Outfit Studio](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/outfit-studio/README.md) runs compact and fixed mixed scenes. Complete scenario qualification and the core release remain open.

Start the next phase in [#91](https://github.com/cnedwin/Egret_rebuild/issues/91) with in-browser opening of an exported Outfit Studio project. Load a valid snapshot through existing transactions, retain the live scene and resources on cancellation or failed import, and allow retry. #83–#90 continue to supply capabilities as the reference project needs them. #55 meets its fixed desktop CPU and preparation bounds. Its remaining work is to isolate the sparse and full-dirty wall-gap tails on the original workload. #92 runs formal qualification against the frozen profiles and #93 can prepare the clean-consumer handoff in parallel. Optional [World3D](world3d.md) has runnable entries and device functional evidence. The fixed mixed profiles retain their existing acceptance scope.

## Next capability batch

These are coherent increments within existing Issues, not new work-package IDs, personnel assignments or automatic authorization to implement them.

| Order / existing owner | Deliverable and actual entry points | Dependencies | Exit for the increment |
| --- | --- | --- | --- |
| Original M1 performance #55 | On the original TEXTURED fixture, distinguish queue completion, validation and frame retirement in sparse and full-dirty capacity gaps. Follow a justified change with formal paired measurements. | Original fixture and timing method. Keep formal runs free of competing load. | Verify the 16.7 ms weighted wall-gap p95 while retaining the established 8 ms Engine and 4 ms preparation bounds. Preserve earlier failures and unmeasured GPU time. |
| Parallel content and animation #83–#86 | Complete binary/texture variants, independent references and bounded Spine seek/replay. In #86, build compatible Spine state replacement and integrated lifecycle coverage on the delivered sequence and resource ownership. | Existing artifact/instance contracts. Authorized exports and independent references qualify their corresponding scope. | The candidate preserves declared state, refuses incompatible publication and verifies cancellation, resource release and device recovery. |
| Join selected features #89–#91 | Complete remaining actual IME, controls and semantics in #89/#90. Complete selected features in examples/outfit-studio/ for #91, retaining compact and fixed scenes. | Existing editor, contact routing, shared resources, rendering and animation. | The editable example preserves stable authored IDs, independent animation state, resource failure/retry and compatible input. State the supported subset. |
| Mixed qualification #92 | Continue measuring and addressing fixed-scene bottlenecks, then run the formal X/L/device campaign. | Collect each row once #91 and the relevant M2/M3 behavior, devices and references are ready. Final M4 acceptance requires #55. Freeze the actual source, content, device and profile. | Qualify startup, CPU/GPU, frame intervals, memory, lifecycle and recovery. Keep the original failures and unmeasured rows. |
| Preview handoff #93 | Verify the clean-consumer example, actual distribution, public entries and dependency/content notices in parallel. Complete the bilingual guide. | Complete handoff depends on #91 and #92. | Record verified combinations, build/startup evidence and remaining qualification. |

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

A sequence controller can carry position, loop, rate, pause state and marker numbering across ContentLoader clips with identical ordered frame boundaries. Compatible Spine replacement must first define the asset, track, skin and event-history mapping. Refuse an unsupported mapping before publication. Independent instances and the global clock keep running, with resource, instance and device generations checked separately.

## Retain, change and defer

| Decision | Concrete scope |
| --- | --- |
| Retain | Scope/events, AssetManager/leases, display semantics, explicit clocks, current public entries, shared backend executors and completion/generation authority; current paragraph/font/theme/layout results; independent references and failed records |
| Extend | Native edit state/host bridge and UI retention; current content producer/provider profiles; Spine replay/compatible replacement; complete controls/semantics; one mixed example |
| Refactor only for a demonstrated need | Shared frame preparation, provider/raster keys or native/storage paths required by a selected capability or measured bottleneck. Keep ordinary old-API consumers and saved-frame behavior. |
| Keep historical | Spine/3D/text research programs and original evidence. They inform mechanisms but do not replace current product adapters or full-feature references. |
| Advance as separate product lines | Unified 2D/3D project authoring and broader asset compatibility, mini-game/native/desktop hosts, integrated visual/Agent creation and complete migration. |

## Larger product sequence

| Product line | Entry supplied by this core | Next complete outcome and acceptance |
| --- | --- | --- |
| Lightweight 3D | The [shared authored scene](authored-scene3d.md) provides bounded 3D/2D composition. [Optional World3D](world3d.md) provides glTF, materials, character animation, effects and separate entries for both backends. | Connect authored projects, resource ownership and recovery, and broaden asset and device coverage. Qualify with actual imports, pixels, events and device budgets. |
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
