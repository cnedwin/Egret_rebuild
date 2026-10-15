# Core Advantages and Verification

English | [简体中文](../../Cns/docs/核心优势与验证.md)

Egret's intended benefits are faster progress to a playable game, dependable changes and efficient execution on the intended devices. R005 defines efficiency objectives and R008 defines complete migration. These benefits are evaluated with equivalent functionality, image quality and total creator cost. Bounded core deliveries establish useful capabilities, while leading performance and creator-outcome claims remain unverified.

[Knowledge base home](../README.md) · [Delivery plan](delivery-plan.md) · [Technical architecture](technical-architecture.md) · [Legacy migration](legacy-project-migration.md) · [Hypotheses](../../Cns/registry/假设.json) · [Requirements](../../Cns/registry/需求.json)

## User and competitive commitments

New creators and experienced mobile developers share the goal of a runnable, editable and recoverable project. Their outcomes are recorded separately: first completion and independent modification for new creators; migration, maintenance and production efficiency for experienced developers. Results retain both groups and their distributions.

Complex 2D UI and lightweight 3D, including mixed projects, define the intended workload. Shared samples must specify scene, character, effect, image-quality and device envelopes. The comparison follows the whole path from intent to runnable, editable and publishable work: success, time, intervention and total cost. Protocol integration or a single demonstration does not establish that benefit. No speed ranking or lead multiplier is currently established.

## Seven hypotheses and how to falsify them

| ID | Advantage to verify | Shared tasks and metrics | Failure signals |
| --- | --- | --- | --- |
| H001 | Lightweight packages and first interaction | Cold start with equivalent assets/functionality; total download, first-screen and first-interaction time, distinguishing caches and split packages | Smaller initial packages delay interaction, or the first scene requires substantial additional loading |
| H002 | Sustained complex-UI frame time | Long lists, dynamic text/input, nested masks, theme/page changes; CPU/GPU time, P50/P95/P99, stutters, and memory | Good average FPS but worse tail frame time, GC, or interaction latency |
| H003 | Power and heat | Same device/brightness/image quality/frame rate, sustained tasks for 20–30 minutes; energy, temperature rise, throttling, and frame time | Fast only in short runs; sustained execution throttles or energy benefits disappear |
| H004 | Mixed 2D/3D efficiency and correctness | 3D characters/scenes/transparent effects over complex UI, skeletal animation, and frame animation; frame time, bandwidth/uploads, visual and event consistency | Incorrect layering, masks, skeletal draw order, or extra memory |
| H005 | Successful AI creation with continued editing | Complete full gameplay and target-device publication by group, then change layout/resources/values and undo errors; success rate, human takeover, cost/time | Only demos can be generated; second-round objects/references are lost, requiring a rebuild |
| H006 | Low-intervention and consistent migration | R008 fixes real projects and a version matrix; full-workflow success rate, human interventions/minutes, AI repair cost, and old/new differences | Only compilation succeeds, manual expert repair is hidden, unknown modules are deleted, or the result degrades to a demo |
| H007 | Stable interfaces reduce iteration cost | Update the same project across engine/tool/resource-protocol versions and repeatedly modify it; migration time, regression defects, recovery success rate, and compatibility maintenance cost | Backend replacement or interface upgrades repeatedly break projects and Agent location |

Prefer direct power measurements. If the host cannot provide data, identify estimated proxies and their limitations; temperature or FPS must not be presented as measured power. For every hypothesis, register samples, devices/hosts and versions, success conditions, and tolerances before collecting results. Insufficient evidence keeps the hypothesis unverified.

## Fair comparisons and delivery evidence

V001 fixes shared samples, input replay, asset quality, image quality, functionality, models, and repair budgets, recording network, caches, build mode, temperature/battery, device, and host versions. Comparisons use reasonably optimized release builds, distinguish visible/total nodes, and record repetitions and distributions. Nondeterministic network/random/SDK conditions follow the migration document's controls. Evaluate performance advantages together with correctness, quality, and total human/AI cost; reducing image quality or functionality cannot establish the conclusion.

V002 provides rendering/runtime prototypes for H001–H004; V003 provides project-operation, diagnostic, and recovery interfaces for H005/H007; V004 verifies the resource and animation pipeline; V005 verifies the creation workbench and platform execution/publication; V006 completes H006's migration tools and real-project comparisons; V007 retains evidence, versions, failure reasons, and revalidation methods. Old projects are both migration samples and core-upgrade regression assets for the new engine.

First determine from shared samples which advantages hold and under what conditions, then decide whether to expand workloads and platforms. Owners, budgets, dates, quantitative thresholds, and initial versions/devices remain undecided. The original 2–3-year horizon describes an iteration objective, rather than an accepted advantage. Stable interfaces and replaceable backends can reduce change costs, but cannot guarantee a lead.

## Compilation and debugging waits

R013 and H008 add the objective of feedback during continuous modification. TS7's official build data does not replace Egret measurements. By fixed project, device, and cache state, separately record cold preview, warm change-to-frame time, type diagnostics, resource/shader conversion, native release, and error location. Rust/WebGPU/GPU AI benefits remain comparisons on their corresponding works/hosts; selection names alone do not establish them.

## From historical experience to today's propositions

S002 is a historical account, separate from S011/S012 static source observations and from new-product measurements. Its value is to identify useful methods and failure boundaries for present tests.

| S002 historical account | Inheritable design method | Contemporary verification boundary |
| --- | --- | --- |
| AS3-like display lists, events, and TypeScript lowered the migration barrier from Flash to H5 | Carry forward existing knowledge, resources, and projects to reduce conversion costs | This does not establish that AI-oriented new creators need an AS3 mental model; old/new semantics need item-by-item verification |
| Small-package loading, rendering, and power optimization around Web/native adapted to complex 2D UI categories | Select workloads and devices, then optimize resources, runtime, and tools together | Historical advantages do not prove advantages in the new engine's package size, frame time, or energy use |
| Historical Runtime host integration and integration experience with Wing, EUI, RES, DragonBones, and publishing tools | Connect production, execution, diagnostics, and delivery into a loop | Historical experience does not establish current SDK permissions or deployment conditions; new-project host integration needs independent verification |

Historical archives are a principal source for engineering investigation. Targeted read-only static review has been conducted; legacy code, builds, and device tests have not run, and complete products or usable versions have not been established. The observations below belong to sources S011/S012. See [historical assets and research boundaries](historical-assets-and-research-boundaries.md) for detailed versions and the evidence index.

| Observed static mechanism | Supported verification direction and limitations |
| --- | --- |
| EUI Validator invalidates properties, size, and display lists in stages using depth queues; DataGroup virtual lists reuse renderers; the EXML pipeline parses an AST and generates code | Can inform complex-UI update and project-conversion proposals; does not establish dynamic-layout cost, text correctness, or migration consistency |
| JS ArrayBuffer batch commands enter a C++ display list and OpenGL ES; adjacent commands with the same texture are batched, vertices uploaded centrally, and subtree bitmap caches rebuilt by dirty state | Explains possible optimization of bridging/submission cost and repeated drawing; actual switches, mask/filter/texture changes, cache area, and update rate determine benefits |
| Resource paths cover predownloads, ZIP, application resources, and HTTP caches | Can support cold/warm loading and resource-distribution tests; mechanism existence does not establish better first interaction, package size, or network efficiency |

Static paths cannot establish buildability of current SDKs, complete target-platform support, native implementation of all controls, full-screen incremental redraw, low heat, or leading performance. The public candidate knowledge base retains mechanism conclusions and source references only; it does not republish archived source code, credentials, or private paths.

## Evidence context

This verification plan originated on October 8, 2026, when a local headless core existed and complete-engine, performance and creator measurements had not passed. Later scoped deliveries are recorded in [core progress](core-progress.md). They do not retrospectively measure H001–H008 or replace the declared sample/device/user studies. The H003 20–30-minute task is an exploration method, not a product-approved numeric budget.
