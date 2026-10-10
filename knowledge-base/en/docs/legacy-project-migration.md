# Legacy Project Migration

English | [简体中文](../../Cns/docs/旧工程迁移.md)

Updated: 2026-10-08. Status: the delivery requirement is confirmed; tools are not implemented and acceptance has not run. The basis is confirmed requirements, engineering-plan registers, and targeted static review of historical archives. Source-code existence does not establish that a version builds or that a project can migrate successfully.

[Knowledge base home](../README.md) · [Delivery plan](delivery-plan.md) · [Technical architecture](technical-architecture.md) · [Requirements register](../../Cns/registry/需求.json) · [Hypotheses register](../../Cns/registry/假设.json)

## Commitment and success conditions

R008 is a formal deliverable: import an original Egret project in one click, combine this with an Agent to convert it automatically to the new Egret, minimize manual changes and intervention, and achieve perfect execution after migration. Delivery must include usable migration tools, a complete independent new project, and a runnable target-platform build. Design descriptions, sample conversion scripts, or successful compilation cannot close the deliverable.

“Perfect execution” is the final objective. Migration success may be reported only within the published support matrix, when comparisons of behavior, visuals, state, resources, animation, and platforms across complete key workflows all meet agreed criteria. Successful startup is an intermediate check. Unknown, unsupported, and failed items must be listed explicitly; an Agent cannot silently delete or downgrade them. The migrated project must also remain open to further AI, visual, and code changes and pass subsequent publication and regression checks.

## Support scope and version matrix

First inventory Egret core, EUI/EXML, RES, DragonBones, frame animation, business TypeScript, build/publication configurations, platform interfaces, and native rendering interfaces for each sample. Register Egret3D, third-party libraries/SDKs, and custom engine branches separately. The initial lightweight-3D positioning cannot imply compatibility with legacy Egret3D.

The support matrix records verified, limited support, unsupported, and pending verification statuses and their evidence by “engine/tool version × module and extension versions × resource format × host/device version × new engine version.” Historical archives do not yet establish product or version completeness. Initial versions, target hosts, minimum devices, and resource boundaries await V001 inventory. Explain rejection reasons before conversion and retain original files, dependencies, and feasible handling paths. Record third-party authorization, external services, and platform test-configuration conditions separately.

## Complete migration workflow

1. **Import and preflight:** Generate a read-only original-project snapshot, version fingerprint, dependency/resource inventory, platform capability requirements, and risk report. Confirm that a baseline of legacy behavior can be obtained. If the old project cannot run, retain the blocking reason rather than inventing a consistency conclusion.
2. **Deterministic conversion:** Apply repeatable mappings under defined source, configuration, resource, and interface rules. Record rule versions, input/output digests, file diffs, and object correspondences. Repeated execution should produce explainably identical results.
3. **Agent repair:** Locate remaining issues from diagnostics and modify, build, run, and revalidate within published attempt, time, and cost budgets. Record every repair. On budget exhaustion or semantic uncertainty, leave a failure status and a human-handling entry point; do not falsely report success.
4. **Comparison and publication:** Run complete old/new workflows plus resource and platform tests. Output runnable builds, difference evidence, conversion logs, unresolved items, cost, and acceptance reports.
5. **Recovery and maintenance:** Retain the complete original project and output the new project independently. Support rollback, reruns, and tracing a specific AI change. Verify that rollback actually restores the project, resources, and necessary state, and add passing projects to the core-upgrade regression suite.

## Semantic, execution, and performance acceptance

| Comparison area | Behaviors that must be covered |
| --- | --- |
| Gameplay and interaction | Event order/propagation, input and hit testing, coordinates and scaling, layout, page changes, timers, asynchronous calls, and key business state |
| Visuals and animation | Layering, transparency blending, masks, fonts/text, skeletal attachments and draw order, constraints/clipping, animation events, and frame-animation timing |
| Resources and state | Loading/replacement/release, missing-resource and failure recovery, reference lifecycles, saving/restoration, and data formats that must be preserved |
| Platforms and sustained execution | Build/publication, foreground/background changes, input and screen adaptation, device/context recovery, third-party SDKs, cold start, first interaction, sustained frame time, and memory |

Screenshots or average FPS alone are insufficient. Fix business assertions, visual tolerances, sample times, and performance thresholds item by item; mark thresholds pending where no measurements exist. Use the same input replay, random seed, controllable clock, and network responses. Control nondeterministic time, networking, server state, and third-party SDKs in two groups: recording/test doubles and separate revalidation on real platforms, with coverage limits explained. Results from doubles must not establish real-service compatibility. Differences in events/coordinates/layout/numerics and resource lifecycles need explicit mappings; rerun affected workflows after repairs.

## Automation and cost definitions

H006 verifies low intervention and execution consistency. Fix and register the stratified sample population and support scope, and report the complete funnel: import, conversion, build, execution, comparative acceptance, and continued editing. The success-rate denominator is every project in the supported scope of this batch. Also report the overall rejection rate and reasons; do not show only successful cases.

“Zero-manual-intervention success” means no human source-code, configuration, or resource changes from import through acceptance, no expert repair, and completion of every agreed workflow. Necessary test configuration and observation/confirmation are recorded separately; labor cannot be hidden. Human intervention records counts, reasons, roles, active work minutes, and waiting time. AI cost records models/versions, calls and repair attempts, input/output and cache usage, fees, and tool runtime, including failed retries. Also report total cost/total time per successful project and their distributions. Compare against a manual-migration baseline on fixed tasks; target values will be set after V001 is established.

## Architecture constraints and delivery dependencies

Migration participates from core design onward in API, event, layout, animation, state, and storage semantics. The compatibility layer is independent and trimmable; prefer mapping projects to the new structure. Build reports state which legacy modules remain and their size/runtime costs; do not force all historical runtime code into every new work. Stable object identities, project/resource versions, and tool protocols jointly support later AI changes and recovery.

V001 establishes real samples, baselines, and matrices; V002 verifies rendering/runtime semantics; V003 provides diagnosable and recoverable AI engineering interfaces; V004 ensures resource and animation conversion; V005 completes the workbench and target-platform publication; V006 delivers tools and passes acceptance on real complete projects; V007 retains rules, evidence, and regression indexes. Passing legacy projects enter a fixed regression suite for every core upgrade. Revalidate before upgrades and record blocking failures or support-matrix changes.
