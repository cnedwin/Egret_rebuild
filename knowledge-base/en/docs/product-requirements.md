# Product Requirements Document

English | [简体中文](../../Cns/docs/产品需求说明书.md)

Egret is an open-source game-engine project for creating, running and maintaining complex 2D games and lightweight 3D experiences. Its product direction joins a dependable rendering/runtime core with editable projects, resource tools, AI-assisted creation and complete legacy-project migration. A playable result must remain understandable, editable, recoverable and publishable throughout later changes.

This document defines product obligations and acceptance scenarios. The [current core preview](core-progress.md) provides runnable prerequisites; complete creator tools, host coverage, performance, market validation and migration remain open.

The 0.60 [atlas import planner](atlas-import-plan-contract.md) is a bounded prerequisite for R004 resource/animation import: strict selected metadata plus an explicit PNG binding becomes normalized factory input. Its [evidence](atlas-import-plan-evidence.md) separates metadata, SDK/CPU, Native and delivery acceptance. It does not close V004, full P04, general asset discovery, exporter compatibility, full Spine R020/V020 or migration R008/V006.

## Objectives, audiences, and confirmation boundaries

The primary audience is new creators using AI to make games. Mobile-game developers entering AI-assisted production are also an important audience. R001–R017 define the original product and engineering scope: complex 2D UI, lightweight 3D scenes/characters/effects, skeletal and frame animation, a rendering engine/runtime foundation, open engineering interfaces, legacy Egret migration and a maintained community knowledge base.

New creators need to express gameplay, identify objects, understand changes, diagnose failures and finish publication. Experienced developers need code editing, debugging, resource reuse and batch operations within the same project. Acceptance must measure each audience directly; expert work performed on a novice's behalf cannot establish novice success.

R011 requires research verification and audit, R012 requires careful evaluation of established mechanisms, R015 requires independent core implementation and accurate dependency attribution, and R016 governs modern engineering with familiar Egret APIs. Development proceeds in verifiable increments with explicit gap review (R017); each increment keeps the full product obligations in view. Proposed D-series decisions remain proposals until their own acceptance conditions are met.

Scale, image quality, minimum devices, initial host order, staffing, budget, dates, business model and numerical performance thresholds need separate decisions. Browsers, WeChat, Douyin and other hosts have no launch order implied by this document.

## Scope and priorities

| Stage | Required outcome | Requirement and delivery records |
| --- | --- | --- |
| Prototype verification | Exercise mixed presentation, first creation, consecutive local changes, resource import, playtest diagnostics and recovery on shared samples and selected real hosts. Investigate migration inventory, conversion and comparison risks alongside the new-work path. | R001–R008, R010; V001–V006 |
| First complete release | Deliver the creation/resource/execution/repair/undo/publication/update loop within a published support matrix. Migration produces independent new projects that pass old/new comparisons, remain editable and can be published and updated. Documentation and reproducible evidence accompany delivery. | R001–R016; V001–V008 |
| Further expansion | Extend devices, hosts, legacy versions, collaboration, commercial services, plugin ecosystems and larger 3D workloads as their requirements and costs become clear. | R002, R006–R010; V001, V005–V007 |

R008/V006 is a complete migration obligation. Compilation or an isolated example cannot close it. V006 ultimately depends on V001–V005. R020, added on 2026-10-10, requires complete Spine support for the selected version: import, its feature set, playback/events, complex UI/3D composition, resource recovery, creation tools and applicable migration. Complete Spine acceptance remains unfinished. The [Spine support matrix](spine-animation-support-and-acceptance.md) must expose unsupported and unverified features, backends and hosts.

## Product requirements for low-level reuse

Rendering, text, resource and animation mechanisms are evaluated against Egret's interfaces, correctness, licensing and maintenance needs. Creators work through a unified project flow; they should not need to select glyph-atlas strategies, manage GPU state or reconcile library versions. Dependencies and adapters retain their actual attribution under the [implementation and dependency policy](independent-implementation-and-dependency-policy.md). [Research and reference records](open-source-reference-implementations-and-adoption.md) explain technical comparisons and component boundaries.

Production packages need explicit 2D/3D capability profiles so a 2D project avoids unnecessary 3D payloads. Initialization failure, loading cancellation, departure and repeated startup must return to recoverable states. Interaction is rechecked after graphics recovery.

## Projects and creator control

A project contains editable scenes/UI, stable object identities, original resources and dependencies, business code, gameplay rules, target configurations and version records. Playtest states and release builds are artifacts of that project. Export preserves source and continued production.

Renaming, moving and resource-path changes preserve references and diagnostic locations. Copies receive new identities with explicit reference relationships; deletion reveals affected gameplay and resources. Creators select by name, image and purpose while internal identity remains stable.

Natural-language, visual and code editing operate on the same project. Source remains inspectable and exportable. An AI-generated change is bound to a project version and a declared scope; later manual changes produce a conflict rather than being overwritten. Each operation presents its objective, local differences, affected objects and acceptance results. Writing temporary playtest state back is an explicit creator choice.

Changes preserve unrelated gameplay, events, resources, saved data and host features. Any fallback that reduces behavior or image quality must explain its consequences and obtain an explicit creator choice before application. Cancellation, retry, failure and undo retain a recoverable version. 

## New-work journey and core acceptance

The workbench is organized around projects, editing, resources, playtesting, task records and publication. Feedback explains the current operation, completed work, blockers and available next actions.

| Capability | Required behavior | Failure and recovery |
| --- | --- | --- |
| Initial creation — R001, R006; V003, V005 | An editable character/outfit project reaches a first playable state, switches outfits and retains selection. Measure elapsed time and human assistance. | Expose unresolved intent, usable partial results and retry paths. |
| Mixed presentation — R002–R005; V002, V004 | A 3D character, effects, complex UI, skeletal and frame animation preserve occlusion, text, input, order and animation events through consecutive operations and recovery. | Locate missing behavior, misaligned input and budget failures by object and reproduction steps; explain quality tradeoffs. |
| Consistent layout and clicks — R002, R004; V002, V005 | Longer text, insertion/deletion, hiding/restoration and panel reparenting update affected ancestors, siblings and hit areas. Visible input selects the intended business object; clipped objects receive no such input. | Rejected or conflicting changes preserve the previous layout/hit state and identify dependencies. Real fonts, IME and virtual-list reuse have separate acceptance. |
| Consecutive local changes — R001, R006; V003, V005 | Layout, character, manually edited pricing and AI-edited effects remain compatible. Local previews/diffs precede application; existing workflows replay; undo restores an editable working version. | Identify ambiguous targets, stale results, manual conflicts and the changes responsible for regressions. Preserve manual edits and provide restoration or repair. |
| Resource import and outfit changes — R004, R007; V004 | Import models, textures, fonts, skeletal/frame animation and audio with previews, dependencies and use sites. Prepare displayable replacement assets before switching, retain interaction/selection, reject late obsolete results and keep shared materials alive. | Identify asset/stage/cause, preserve originals and usable old content, and offer completion/replacement/cancellation. Memory limits require an explicit recovery path. |
| Playtest diagnosis — R003, R005, R006; V002, V003, V005 | Reproduce input or animation failures and locate their objects, rules and resources. Performance guidance uses actual measurements. | State differing reproduction conditions, insufficient evidence and the last reliable state. |
| Interruption and recovery — R003–R005, R007; V002, V004, V005 | Distinguish asset preparation, display-resource restoration and interactive readiness. Preserve gameplay, selection and layout; completed sounds/rewards do not replay; unfinished operations remain locatable. | Identify preparation, upload or interaction failures separately. External services/process restarts/unconfirmed operations remain pending verification, with retry/exit or takeover choices. |
| Repair and undo — R006; V003, V005 | Repair missing references within visible time/cost limits, recheck original gameplay, restore project/resources/gameplay on undo and continue editing. | Stop at cancellation, limits or semantic uncertainty; report changed/unchanged work and remaining issues. Failed retries count toward cost. |
| Publication and updates — R007; V004, V005 | Check the declared target, build and playtest on real devices; publish an update and verify startup, foreground/background, resource updates and retained saves. | Explain unsupported capabilities before packaging, locate build/service/channel failures and preserve the previous usable version. Build generation, channel approval and successful release are separate results. |

## Legacy-project journey and formal delivery

R008/V006 targets minimal human intervention and equivalent execution after migration within a published version/feature/host matrix. Old Egret3D, custom branches and third-party SDKs require explicit coverage. Out-of-matrix, partial and unverified results are reported separately.

| Stage | Acceptance and delivered evidence |
| --- | --- |
| Import and inventory | Preserve a read-only original; identify engine version, UI, resources, animation, business code, extensions and host dependencies; obtain a runnable old baseline and scope report. Unknown versions, missing dependencies and unrunnable projects remain blockers. |
| Conversion and repair | Create an independent new project with object correspondence, differences, conversion progress and bounded AI repair records. Unsupported semantics or exhausted attempt/time/cost budgets permit takeover, rollback and rerun while preserving the original behavior. |
| Old/new comparison | Replay the same inputs and compare gameplay, event order/counts, timing/pause/recovery, animation events, layout/hits, resource switching/release, saves, hosts and performance. Include graphics interruption, asset failure and late completion. Duplicated rewards/sounds, missing events and time jumps fail acceptance. External-service doubles do not replace real-host checks. |
| Continued editing and publication | Change characters/UI/business code, playtest, undo, build for the target and perform an update. Deliver sources, resources, builds, logs, differences, unresolved items and reports; keep originals recoverable and promote passing samples to upgrade regressions. |

## Nonfunctional acceptance and measurement definitions

V001 establishes authorized samples with equivalent functionality/image quality and fixed host/device/network conditions before numerical thresholds are adopted. Product-level metrics below have no accepted baseline yet. Report distributions, unsuccessful tasks and sample scope; creation-task time and player time-to-interaction are separate.

| Metric | Measurement contract |
| --- | --- |
| firstInteractive | Cold request to an effective response to the agreed input, separating load/initialization/wait with fixed cache/network conditions; include warm start and recovery. |
| tailFrame | Sustained frame-time tails, stutter and input response with defined windows, scenes and inputs. |
| memory | Peaks, steady state and repeated entry/exit/replacement growth under stated devices, including failure/recovery residues. |
| Total AI cost | Model calls/fees, cache, failed repairs/retries, tool time and waits for a complete task, including cost per successful task. |
| manualIntervention | Takeover count/cause/role, active work and wait; record account/test setup separately and disclose expert repair. |
| Experience and reliability | First playability, requirements met, preservation of unrelated behavior, undo, publication/update success, package/loading cost and sustained power/heat. |
| Recovery and semantic preservation | Separate asset-ready, current display-upload-ready and interactive times; retain state, event counts and unfinished operations. A visible frame alone establishes no complete recovery. |

The migration funnel includes import, conversion, build, execution, complete comparison and continued editing for every in-scope project, with rejection rates and causes. Zero-manual-intervention success requires complete acceptance without human code/configuration/resource edits or expert repair.

## Initial benchmarks and questions to verify

The candidate primary benchmark combines a 3D character/outfit view, multilayer UI, scrolling lists, text, skeletal and frame effects. It checks object selection, resource replacement, events, consecutive edits and budgets. A small 3D action scene adds movement, input, character animation and effects; its rules and scale remain undecided. Migration uses authorized runnable legacy projects rather than newly created examples.

Research must establish: audience/gameplay needs and independent task completion; target hosts/devices and real service requirements; fixed UI/asset/image-quality/3D scope; comprehensible stable object selection; preservation/conflict/undo behavior; understandable recovery and visible expert labor; developer code/resource workflows; representative legacy versions/extensions/SDKs and semantic equivalence; complete task cost and device behavior; and reproducible community participation with clear asset rights.

R009 requires reproducible issue reporting with receipt, evidence requests or conclusions. R010 grounds technical comparisons in equivalent tasks, costs and recorded conditions. Requirement changes remain versioned in the [register](../../Cns/registry/需求.json).

## Compilation/debugging and native extensions

R013 covers short edit-feedback loops, distinct preview/type/release status, diagnostics mapped to source/scenes/Agent transactions, and avoiding unrelated rebuilds. Historical sub-30-second figures supply no new numerical gate. R014 preserves native App/SDK and cross-platform extension space; Steam/PC and GPU AI remain uncommitted targets. Browser 2D needs no native VM; native 2D requires a selected or accepted host VM. The [backend/runtime design](graphics-backends-and-native-runtime-selection.md) owns those choices.

## Community open source and implementation attribution

The public project, knowledge base and maintainable engineering records support reproducible community work. Independent core code, dependencies, research references and adapters state their actual origins. AI assistance is disclosed in the engineering provenance and follows the same review/licensing standards. First-party code and documentation are Apache-2.0 in cnedwin/Egret_rebuild. Public assets require appropriate rights. These practices support R015 and the complete migration/edit/publication obligations.

## Engineering structure and public code contracts

R016 and D016 organize [packages and interfaces](engineering-architecture-and-project-structure.md), [API naming](public-api-design-and-naming.md) and [quality gates](code-standards-and-quality-gates.md). Current APIs have versioned contracts; proposed APIs remain distinguishable. The [first core slice](core-framework-implementation-record.md) documents its strictly compiled headless/package-boundary scope. Later bounded deliveries extend that base; complete platform, creator and migration acceptance remains separate.

## Design and evidence references

[Knowledge base](../README.md) · [White paper](technical-white-paper.md) · [Engineering plan](engineering-plan.md) · [Round-two plan](../archive/round-2-research.md#research) · [Round-two results](../archive/round-2-research.md#execution) · [Round-two audit](../archive/round-2-research.md#audit) · [Round-one results](../archive/round-1-research.md#execution) · [Round-one audit](../archive/round-1-research.md#audit) · [Research review](../archive/round-1-research.md#research)

## Evidence notes

The original product-design checkpoint was version 0.7 / knowledge base 0.9.0, dated 2026-10-08. The Spine requirement was added on 2026-10-10. This 2026-10-15 editorial consolidation preserves those requirement and evidence boundaries.

At the original design checkpoint, V001 research was in_progress; V002–V006 covered runtime, project interfaces, resources, creation/publication and migration; V007 maintained the knowledge base; V008 held the candidate design package. D001–D016 were proposed and H001–H008 untested. Their original register states are not upgraded by this document. The October 10 V020 registration was planned / not_started / not_run; subsequent bounded Spine work has not completed full acceptance.

The [round-three execution](../archive/round-3-research.md#execution) and [audit](../archive/round-3-research.md#audit) cover a research chain with real-asset 3D animation, shared instances, Canvas text/caches, rendering handoff and recovery. That chain is not a completed creator workbench.

The [round-two execution](../archive/round-2-research.md#execution) and [audit](../archive/round-2-research.md#audit) remain bounded research: layout used external text-size fixtures, resource tasks were manually interleaved, and event recovery concerned in-memory consumption in live sessions. Procedural meshes, a two-segment skeleton and atlases do not establish real text shaping, asynchronous GPU uploads, a complete editor or migration.
