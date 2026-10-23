# M4 — Mixed scenarios and core acceptance

English | [简体中文](../../Cns/docs/m4-core-acceptance-plan.md)

Design proposal · 2026-10-23 · Parent: [M4 #58](https://github.com/cnedwin/Egret_rebuild/issues/58)

## 1. Outcome and scope

M4 demonstrates that the declared 2D rendering, complex UI, animation and resource capabilities work together in an editable game example, survive their complete lifecycle, and meet the selected release profile. It joins M2 and M3 through M1's existing rendering and resource contracts.

M4 retains the established scope: complex UI, complete Spine for the selected version, sequence animation, resource replacement and the existing bounded 3D background composition. It does not add imported or animated 3D characters, a general material/VFX system, a world editor, native Runtime or new platform SDKs. Those remain product obligations with subsequent implementation and acceptance plans.

The deliverable is a qualified core preview with a precise capability matrix, editable example, measurements and migration notes. Completion does not mean the full all-in-one creation platform or complete one-click legacy migration is available.

M4.3 must name its delivered scope as a complex 2D UI/animation/resource core preview with bounded 3D-background composition. It does not qualify general 3D scene assets, materials, animated characters or effects, native SDKs or the all-in-one editor. Those product capabilities remain explicit later roadmap work; completing M4 cannot close them.

## 2. Starting point and dependencies

| Existing evidence | Consequence for M4 |
| --- | --- |
| [Architecture plan](architecture-and-engineering-plan.md), milestone table and section 12 | M4 is mixed scenarios/core acceptance; wider 3D, hosts and creator tools follow separately. |
| [M1 plan](m1-rendering-resource-plan.md), schema-6 sequence 6 | Formal timing is a valid `FAIL_TIMING_TARGET`; Engine p95 is 5.0/6.4/10.3 ms for static/sparse/full-dirty. M1.2 and D60 remain OPEN. |
| [Resource recovery contract](resource-recovery-contract.md) | Shared Host generations, independent resource leases and staged replacement already have defined ownership; M4 extends their use to new content. |
| [Scene example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/scene3d/README.md) and [resource example](https://github.com/cnedwin/Egret_rebuild/blob/main/examples/resource-scene/README.md) | Existing procedural opaque 3D and editable resource interactions are integration starting points, not complete 3D or UI products. Historical example environment statements are not current installation instructions. |
| [Project transactions](project-transaction-core-contract.md) | Stable IDs, revision checks and recoverable edits exist as a bounded project kernel. An editor, model adapter or complete project-to-runtime compiler does not follow automatically. |

M2 and M3 first agree their runtime interfaces and acceptance fixtures. M4.1 integration can then start while individual M2/M3 features finish. Closing M4 requires the complete selected M2/M3 feature rows, not merely interface stubs.

M1.2's performance gap does not block independent M2/M3 correctness work, example authoring, fixture licensing, interface review or documentation. It blocks claims that the current core meets D60, and blocks M4 stable acceptance until the required performance rows are established. A bounded experimental increment may still merge after its applicable functional, browser and complete merge gates.

## 3. Shared architecture and ownership

| Boundary | Rule and existing implementation anchor |
| --- | --- |
| Editable project → running game | Persistent project data retains IDs and revisions. Runtime state is separate; playtest changes enter authored data only through an explicit edit. Reuse `packages/project/src/index.ts` and its transaction store. |
| Animation/UI → rendering | Preserve painter order, clipping, material semantics and resource references through `packages/contracts/src/SharedRenderFrame2D.ts`. M2/M3 use the selected shared contract; neither owns a second GPU resource manager. |
| Scene + overlay | Reuse `packages/engine/rendering/scene3d.ts`, `packages/engine/web/scene3d.ts` and `packages/engine/web/webgl2Scene3d.ts`. Preserve their bounded opaque procedural scene plus ordered overlay semantics. |
| Resource build → Runtime | Reuse `packages/project/src/resources/index.ts`, `packages/engine/src/resources.ts` and `packages/engine/web/resources.ts`. URLs locate artifacts; admitted metadata and verified bytes establish resource identity. |
| Replacement and recovery | Application state survives native-generation reconstruction. Prepare replacements before commitment, retain prior usable content, suppress obsolete publication and retire only owned resources. Resource-ready, display-ready and interactive-ready are distinct. |
| Timing and interaction | M2 animation and M3 UI consume the chosen game-clock and input rules. Recovery must not replay consumed animation/game events or manufacture elapsed catch-up work. Focus/IME restoration follows M3's explicit policy. |
| Platform ownership | `packages/contracts/src/HostAdapter.ts` retains surface, startup, stop and asynchronous close responsibilities. Browser/native loss and process termination remain separate capabilities. |
| Diagnostics | Preserve source resource/object identity, project revision, execution stage and resource generation where applicable. Existing errors retain order and cause; integration must not flatten distinct failures into “load failed.” |

Retain current public entries, ownership boundaries, shared execution and source/evidence records. Refactor example-local orchestration when it duplicates resource or interaction decisions; keep business state and UI actions explicit. Extend an existing core contract only when the selected M2/M3 behavior demonstrates a missing semantic requirement. M4 is not an occasion to rename packages, replace the backend abstraction or introduce a generic extension framework.

## 4. Three complete work packages

### M4.1 — Editable mixed reference game

**Result:** one reproducible project demonstrating the complete selected interaction loop, with source assets, editable code/data, expected state transitions and an English/Chinese guide.

**Start:** after the M2 content/instance and M3 layout/input interfaces are reviewed. Scenario design, provenance inventory and contributor feedback can start earlier. Implementation currently depends on those interfaces.

**Scope:** select a bounded outfit/character-management scene with complex UI, independent Spine tracks/skins, sequence effects, resource replacement and the existing opaque 3D background. Agree a subset of the U/A scenarios; do not silently add all their individual maximum loads together.

**Integration anchors:** `examples/resource-scene/`, `examples/prepared-resource-groups/`, `examples/scene3d/`; actual M2/M3 public entries after their review. Keep the example under `examples/`; do not add another engine package.

**Acceptance:**

- Code/data changes alter the intended UI or animation after the documented build/preview steps; source assets remain editable and attributed.
- The scenario declaration fixes content, versions, quantities, event order, clip/mask/blend expectations, input actions and comparison domains before collection.
- Shared resources support independent instances; changing an outfit, track or selection does not alter another instance or duplicate gameplay events.
- Visual ordering, picking, focus, text input and asynchronous replacement match the declared behavior on each selected executable backend.
- Unsupported features fail explicitly or use a documented separately tested reduced profile; Canvas is not represented as equivalent to the full mixed scene.
- Existing independent references validate new features; the old reduced-capability example is not a performance-equivalent baseline.

**Review responsibility:** rendering integrator with M2 and M3 maintainers. Asset authors can contribute independently once format and redistribution requirements are clear.

### M4.2 — Integrated lifecycle and budget qualification

**Result:** one scenario-bound acceptance report covering mixed behavior, resource/Host recovery, sustained operation, memory, startup and performance, including every unavailable or failed row.

**Start:** use M4.1's reviewed runnable scenario and selected M2/M3 capability implementations. Prepare the matrix and required device list before implementation finishes; freeze measured inputs and targets before each applicable collection.

**Scope:** retain the architecture plan's L workload: 100 scene enter/exit/cancellation/replacement cycles, ten actual graphics-loss/rebuild cycles per executable recovery backend, foreground/background and network faults, and a 30-minute sustained run. New mixed-content execution needs its own evidence; historical M1.5 duration results retain their original scope.

**Acceptance:**

- All selected M2/M3 feature rows are complete, including interaction during loading/replacement and restoration of the specified state after recovery.
- Resource-ready, fresh-generation display-ready and interactive-ready observations remain separate; old asynchronous results cannot publish into a new scene or generation.
- After cleanup, active owners, unfinished work and in-flight counts return to the declared baseline; retained caches remain within explicit bounds. Heap/reference trends support persistent-growth conclusions.
- The fixed M1 D60 workload meets its original formal requirements; M1.2 remains OPEN until real evidence resolves its full-dirty CPU gap and preparation coverage.
- The mixed X workload has reviewed content counts and applicable CPU/GPU, frame-time, memory, startup and interaction budgets before measurement. M1's original asset/bundle allowances do not automatically become allowances for a larger Spine/UI example.
- Actual selected-browser correctness, recovery and complete-window timing satisfy the frozen matrix. CPU submission time never substitutes for GPU time, physical VRAM, energy or thermal measurements.
- Failure results and interrupted runs remain visible; a short run or controlled port cannot replace a required sustained or physical-device row.

**Review responsibility:** rendering/performance maintainer and independent result reviewer; platform contributors supply identified devices and actual host observations. Existing collectors and scenario adapters are reused where applicable, without a new general acceptance framework.

### M4.3 — Core preview and contributor handoff

**Result:** an inspectable core preview, reproducible example delivery, capability matrix, API/migration notes and a concise contribution path backed by M4.1/M4.2 results.

**Start:** capability documentation, packaging design and migration compatibility notes can be prepared now. Final release qualification depends on M4.1/M4.2 and the required M1–M3 acceptance rows.

**Scope:** verify the chosen package/archive in a clean consumer, preserve optional-entry separation, link each capability to actual evidence, and document supported versions/hosts and remaining limitations. Changing `private` or a package version is not package-consumer acceptance. A public example site, if selected, needs its own actual deployment check.

**Acceptance:**

- A fresh contributor follows the documented pinned environment and runs the editable example without private repository paths or undocumented local artifacts.
- The selected distribution resolves its declared public entries and retains dependency/license notices; optional Spine/3D/tooling do not silently enter the minimal 2D route.
- Bundle and first-interaction measurements identify the actual artifact, content and network profile. The original M1 targets remain independently traceable.
- Capability pages distinguish designed, implemented, controlled-tested, actual-browser-tested and qualified-device scope; M1.2/D60 cannot be marked closed by documentation or CI.
- Migration notes map retained display/event/resource semantics, deliberate differences and unsupported legacy constructs. They do not claim automatic whole-project conversion.
- Independent review, source attribution, critical English comments, complete English/Chinese documentation and normal protected merge checks pass for the actual release candidate.

**Review responsibility:** release integrator and documentation/package contributors. New-contributor walkthroughs record whether a human completed them; an automated rehearsal does not close the human observation row.

## 5. Initial mixed profile: X-D60/1

This is a concrete proposed design freeze for implementation and qualification, not a measurement or a supported limit. Review it with M2/M3 before collection. If authorized content or a real interface constraint requires a change, publish the reason and a new scenario version before collecting its acceptance results; preserve the previous specification and failures. Do not lower content or enlarge budgets after seeing results to obtain a pass.

| Item | Initial specification |
| --- | --- |
| Host and surface | D60 hardware definition from the M1 plan; 1024 × 768 CSS/backing pixels, explicit render pixel ratio 1, foreground, release build, stable recorded window DPR and selected adapter. Qualify WebGPU and WebGL2 separately with the same scene semantics; pin actual browser/executable, OS, drivers and power conditions. Canvas has a separately labelled reduced example, not this full profile. |
| UI | 6,000 authored display nodes, 600 visible UI nodes including virtualized rows; eight nested clip levels in the stress region. A 50,000-record variable-height data list uses at most 48 live row containers for a 32-row reference viewport. Data records are not additional display nodes. Include CJK/English/RTL/emoji, focus and input actions from M3's admitted text fixture set. |
| Animation | Eight simultaneously visible independent Spine instances share one authorized multipage asset set; each has two active tracks and independently selected skins. Each fixture instance contains 120 bones, 96 slots and 2,000 weighted mesh vertices; these are fixture counts, not engine limits. Eighty visible sequence instances share their atlas with independent phases. M2's separate feature matrix still covers the complete selected Spine version. |
| 3D and composition | Two existing opaque indexed quads at distinct depths behind the UI; no new 3D material/character requirement. Exercise selected M2/M3 alpha blending and nested clips, one authored alpha-mask composition and one bounded offscreen blur group in the overlay; use M3.4's declared kernel and independent reference. Record exact scene, atlas/font and interaction fixtures, with authorized source and output hashes. |
| Update states | Static freezes animation and UI; sparse changes exactly 60 of the 6,000 authored UI nodes per admitted frame while the eight Spine and 80 sequence instances advance; full-dirty changes all 6,000 while the same animations advance. Predeclare changed properties and input sequence. These X states are separate from the unchanged original M1 U workload. |
| CPU and frame targets | Engine p95 ≤ 8 ms; preparation p95 ≤ 4 ms; frame interval p95/p99 ≤ 16.7/33.4 ms, with complete-window gap coverage. Record animation, layout and workload update separately; they are not hidden in a render-only number. GPU p95 ≤ 8 ms applies when actual timing is available; otherwise record UNMEASURED. Unavailable GPU timing alone does not block a scoped core preview unless the reviewed selected profile explicitly makes that measurement a required row. |
| Logical memory | Retained decoded/source data ≤ 128 MiB; ready image residence ≤ 32 MiB and 256 entries, including applicable glyph images and committed/staged replacements; reusable buffers/targets ≤ 32 MiB; in-flight upload ≤ 64 MiB; temporary CPU upload ≤ 32 MiB. These are separately accounted classes, not a claim of total physical RAM/VRAM. Existing stricter API limits remain unchanged. |
| Download and first interaction | All JavaScript required by X, including Spine and text-provider glue, ≤ 1.5 MiB gzip; required text-provider WASM and Unicode data ≤ 4.5 MiB compressed transfer; other first-interaction assets, including fonts, ≤ 6 MiB transferred. Total mandatory first-interaction transfer is ≤ 12 MiB. Cold-cache first interaction ≤ 15 s at 10 Mbit/s and 80 ms RTT; 12 MiB alone takes roughly 10.1 s at that rate. X uses the M3 ICU/HarfBuzz/FreeType paragraph provider for its declared multilingual UI, so its required modules/data/font initialization must complete before this marker. Optional loading separates this provider from basic applications; it does not remove required X bytes or work from measurement. These are proposed ceilings, not measured provider sizes. |
| Recovery and response | From observed loss to the correct fresh-generation frame: ≤ 2 s with retained CPU sources, ≤ 15 s for the same shaped reload. For the fixed 100-action input replay, event dispatch to the corresponding completed/read-back frame p95 ≤ 100 ms. This is software-observed response, not physical touch-to-photon or IME usability evidence. |

Freeze the source/build/content and two backend configurations before a qualification campaign. For each static/sparse/full-dirty state, use the established 30-second warm-up and five 60-second measured runs; report median per-run p95 and retain every run. Use identical inputs for any comparative baseline; do not compare against an older build missing Spine/UI features. The M1 relative-regression check remains on its original equivalent workload.

Record download bytes, cache state and actual traffic shaping; the first-interaction marker requires all declared content ready, a completed matching frame and enabled intended inputs. Memory collection includes overlapping old/new replacement and recovery generations. Verify cleanup and bounded residence through the L run; record heap/reference trends rather than summing overlapping logical ledgers into physical memory. Reuse existing sampling, response and lifecycle interfaces where available.

X-D60/1 uses explicit memory ceilings that partly coincide with M1 for a conservative initial target. Its scene and asset composition are different, so M1's memory or startup evidence cannot qualify X. Missing budget evidence stays OPEN; it cannot be replaced by fixture construction or functional success.

### Measurement ownership and exact spans

M4.1 owns the scene declaration; M4.2 owns measurement definitions and the independent result review. Keep the original M1 workload, collector span and failed results unchanged. X uses a separate whole-engine CPU measure: include engine input routing, animation advancement, queued engine event work, style/measure/layout, transforms/clips, capture, preparation/packing and synchronous upload/encoding/submission. Include scenario callback work occurring inside those intervals rather than subtracting guessed costs. Only the predeclared external fixture/application mutation generator is outside this measure, and its duration is reported separately. If engine work is deferred across tasks or workers, attribute all active CPU intervals to their logical update, avoid nested double-counting, and report worker CPU and elapsed readiness separately. Waiting for network/GPU is not CPU work; frame gaps, readiness and response still include their observable effects. An uninstrumented required phase leaves whole-engine acceptance OPEN.

Compute p95 from per-update whole-engine samples; report phase distributions for attribution, never sum phase p95 values. Preserve the X target of 8 ms and preparation target of 4 ms, and record their exact boundaries before collection. Freeze the changed properties, values, mutation order, animation clock and input schedule for static/sparse/full-dirty. The static state has frozen animation; warm animated performance is represented by the declared advancing states and cannot be inferred from static caching. Fix list viewport/minimum row height/overscan so the 32-row reference view plus any retained focused row stays within the 48-container total; count descendant UI nodes in the 600-visible-node allowance.

Correctness, performance and lifecycle runs may use different instrumentation and schedules, but final acceptance uses the same qualified source/artifact identities and complete selected scene semantics. Reduced development fixtures are explicitly labelled and cannot replace X or required L rows. Discover cost and correctness risks on the first executable mixed slice; retain final combined acceptance after all required features are present. Do not compare builds with different feature coverage as an optimization pair.

Keep portable owned-allocation/cache counters, replacement peaks and cleanup trends distinct from optional browser/process heap or physical GPU observations. Account for retained old/new generations and provider scratch/storage once in their declared classes; do not add overlapping JS/Wasm/asset ledgers into a fictitious physical total. Unavailable physical measurements remain unmeasured. Proposed X ceilings remain targets until the integrated workload establishes them.

## 6. Performance and external boundaries

For the original M1 D60 workload, retain Engine p95 ≤ 8 ms, preparation p95 ≤ 4 ms, frame-interval p95/p99 ≤ 16.7/33.4 ms and the fixed relative-regression criterion. The Engine span includes capture and synchronous Host work, excluding workload update. GPU p95 ≤ 8 ms is separate and remains unmeasured without real GPU evidence.

Schema 6's Host span contains preparation, packing, encoding and submission. A five-run median Host p95 ≤ 4 ms establishes a sufficient preparation upper bound. A larger Host span means the bound is unestablished, not that pure preparation is proven to exceed 4 ms. Any direct measurement alternative must cover the original required preparation work and be reviewed before collection.

The M1 startup/recovery targets remain: application JavaScript ≤ 1 MiB gzip excluding optional Spine/assets; fixed-scene assets ≤ 4 MiB; first interaction ≤ 5 s at 10 Mbit/s and 80 ms RTT; retained-source recovery ≤ 2 s, shaped reload ≤ 5 s. They are tied to that fixture and do not certify an arbitrary M4 application.

| Open dependency | Coordinating role | Evidence that resolves it | Work that can proceed |
| --- | --- | --- | --- |
| M1.2 full-dirty CPU and preparation coverage; conditional GPU timing | Rendering/performance maintainer | Valid source-bound formal CPU/preparation results meeting original targets; measure GPU when available and otherwise retain UNMEASURED within the declared claim | M2/M3 correctness, M4 scenario and package preparation |
| Selected-version Spine content/runtime authorization | Animation maintainer and rights holder | Exact version, redistribution conditions, lawful fixtures and required notices; nonredistributable content kept out of public artifacts | Procedural scene/UI and documented import contracts |
| Required phone/browser/host rows | Platform maintainer and device contributor | Named hardware/OS/browser or actual SDK version, frozen workload and actual result; shared CPU CI is insufficient | Independent desktop implementation and qualification |
| Human onboarding and IME/accessibility checks | Community/UI maintainer and participating tester | Recorded actual walkthrough and declared input/accessibility matrix | Automated rehearsal and deterministic input checks |

Required rows are selected before collection. An unavailable required row remains OPEN and blocks its declared support/release claim; it is not silently reclassified as optional. Separate future platforms outside the selected M4 profile do not block unrelated desktop development. Roles identify coordination needs, not an assignment to a particular volunteer.

## 7. Connection to the all-in-one creation platform

The longer-term platform combines coding, debugging, main canvas, UI/animation editing, 3D scenes/VFX, worlds/characters and target publication. Visual, code and natural-language editing should share project identity, versioned changes, diagnostics, preview and undo. Compatible editor surfaces may be combined after their workflows are evaluated.

M4 supplies an editable integration project and explicit ownership/diagnostic boundaries for that future platform. Reuse the existing project transaction kernel; do not put model clients, MCP servers, Skills, credentials or token accounting in Runtime/graphics. External Agent harnesses may later call the same project services and receive bounded task results; they do not own authoritative project state.

User-selected model API connections, Skill/MCP integration, a plugin marketplace, visible token usage and configurable spending limits remain creator-platform requirements. M4 documents their interface needs and examples; it does not choose vendors, implement billing, build editor shells or claim natural-language game creation is complete.

Likewise, `packages/project/src/legacy-res-plan.ts` and related planners remain bounded migration prerequisites. Complete legacy migration still requires original-version baselines, deterministic conversion, bounded Agent repair, behavioral/visual comparison, continued editing and publication under the [migration requirements](legacy-project-migration.md).

## 8. Community execution and closure

Keep parent #58 with three linked work packages. Each package has one specification, shared interface decisions and one acceptance summary; several reviewable PRs are allowed without turning every helper or collector into a task.

The design-stage entry is open for interface, scenario, documentation and asset-provenance feedback. Implementation begins after the corresponding interfaces are reviewed. Contributors can take a complete package or a bounded contribution within it with the maintainer; dependency and owner status remain readable in Issues and Milestones. Projects access was restored on 2026-10-21; maintain those same Issues and statuses in the existing board.

M4 closes only when M4.1–M4.3 and all required prerequisite/profile rows pass. Experimental publication with explicit limitations may precede closure. Full 3D, native/minigame platform delivery, the integrated AI workbench and complete migration keep their own subsequent product plans.
