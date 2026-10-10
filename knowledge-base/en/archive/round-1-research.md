# First-round research record

English | [简体中文](../../Cns/archive/第一轮研究.md)

Historical research from October 8, 2026. This consolidated record retains the original research/plan, execution and independent audit in order. Statements, dates, results, failures and limitations describe those checkpoints; consolidation on October 10, 2026 adds no experiment or product acceptance. Raw evidence and source snapshots remain at their original shared locations.

[Research / plan](#research) · [Execution](#execution) · [Independent audit](#audit) · [Knowledge base](../README.md)

<a id="research"></a>

## First Round Research Verification

Return to [knowledge base](../README.md) · Open [technical white paper](../docs/technical-white-paper.md) · Compare [technical validation](round-1-research.md#execution)

Verification date: 2026-10-08 (Asia/Kuala_Lumpur). Evidence:E001, this round's [structured research record](../../evidence/research-refresh-2026-10-08.json). This report compares existing [competitor evolution/ecosystems](../docs/competitor-evolution-and-ecosystems.md) and the source register, refreshing critical technical facts only. Old research remains intact; necessary tightening/additions are explicit below.

Creator 3.8.8, Cocos 4 alpha.34, CLI alpha.42, LayaAir engine 3.4.1, and Godot 4.7.2 remain usable snapshots supported by official pages read this round. Godot 4.7 Web documents were readable; Laya IDE version/website update date were not reconfirmed. Official mechanisms support a shared architecture direction: distinguish rendering from host services and explicitly manage device loss, asynchronous states, and bridge-object lifecycles. This is documentation research only; no engines were installed/run/tested and no performance ranking was established.

### Twelve critical checks

“Official fact” means the relevant page was readable this round and supports the statement. “Engineering inference” means an Egret research recommendation. No capability received engine execution tests this round.

#### research-01 Separate Creator releases from engine repository tags

**Official fact.** The first Cocos download entry is Creator 3.8.8, dated 2025-12-16. The current page supports this released-editor snapshot; other repository tags were not used to update its version. [Creator downloads/change notes](https://www.cocos.com/creator-download).

**Engineering inference.** Egret should lock editor, runtime, and build-tool versions independently rather than use one repository tag as the whole product version. This retains the old conclusion without verifying Creator binaries, every release channel, or availability on all platforms.

#### research-02 Cocos 4 and CLI have public Alpha releases

**Official fact.** Official release pages display 4.0.0-alpha.34 and 0.0.1-alpha.42, both labeled Latest. Publication text shows 20 Sep 12:10/12:13 without a year; no complete date is inferred. [Cocos 4 alpha.34](https://github.com/cocos/cocos4/releases/tag/4.0.0-alpha.34), [CLI alpha.42](https://github.com/cocos/cocos-cli/releases/tag/0.0.1-alpha.42).

**Engineering inference.** Public interfaces/version coordination can be studied; Alpha is not a stable production commitment. Latest is a release-page marker, not proof of the full Creator 3.8.8 platform matrix, reliability, or project compatibility.

#### research-03 Laya 3.4.1 engine confirmed; IDE and dates need recheck

**Official fact.** The official GitHub title is LayaAir 3.4.1 Engine Library, labeled Latest, with engine/IDE changes. It shows 31 Aug 07:18 without a year. The dynamic website download entry returned only one line; IDE download version/August 29 date were not read. [3.4.1 release](https://github.com/layabox/LayaAir/releases/tag/v3.4.1), [dynamic download entry](https://layaair.com/#/engineDownload).

**Engineering inference.** Engine-release existence is confirmed for current writing. “IDE 3.4.1 / website 2026-08-29” remains historical research, not reconfirmed this round; failed extraction does not mean absence.

#### research-04 Multiple official sources agree on Godot 4.7.2

**Official fact.** The maintenance announcement, download archive, current Windows download page, and GitHub release all identify 4.7.2 stable; the website explicitly dates it 2026-08-18. It remains the current Godot 4 download entry. [Maintenance announcement](https://godotengine.org/article/maintenance-release-godot-4-7-2/), [archive](https://godotengine.org/download/archive/4.7.2-stable/), [current download](https://godotengine.org/download/windows/), [GitHub release](https://github.com/godotengine/godot/releases/tag/4.7.2-stable).

**Engineering inference.** The old conclusion remains. Future 404/internal tool errors should record that specific access failure and seek other official corroboration, without overwriting this successful access or inventing version status.

#### research-05 Godot 4.7 Web has explicit backend and language boundaries

**Official fact.** Versioned 4.7 documentation read this round requires WASM/WebGL2.0. Web uses Compatibility only; Forward+/Mobile do not support Web. It explicitly states WebGPU is unsupported currently, and Godot 4 C# projects cannot export to Web. Thread/deployment constraints apply separately. [4.7 Web export](https://docs.godotengine.org/en/4.7/tutorials/export/exporting_for_web.html).

**Engineering inference.** Web delivery needs its own capability scope. This does not imply Godot can never add WebGPU or that native exports are Web capabilities. The earlier boundary remains.

#### research-06 Backend abstractions can share semantics while retaining distinct capability paths

**Official fact.** Godot 4.7 Forward+/Mobile use Vulkan/D3D12/Metal via RenderingDevice; Compatibility uses OpenGL. Switching may require scene adjustments and fallback may change output. Current Laya 3.x architecture separates RenderDriver WebGL/WebGPU/OpenGLES/LayaX from PAL file/input/media adaptation. [Godot rendering layers](https://docs.godotengine.org/en/4.7/tutorials/rendering/renderers.html), [Laya architecture](https://www.layaair.com/3.x/doc/basics/architecture/).

**Engineering inference.** Egret may share scene semantics, resource descriptions, and lifecycles, choosing verified paths when backends lack capabilities. Shared abstraction does not establish equal features, output, or performance. Accept backend fallback and host adaptation separately.

#### research-07 Godot pipeline precompilation benefits cannot be extended to Web

**Official fact.**4.7 pipeline-compilation documentation explicitly applies to Forward+/Mobile. Ubershaders/pipeline precompilation do not apply to Compatibility, and shader baker does not support Web. Compatibility retains older prewarming such as displaying materials in advance. [4.7 pipeline compilation](https://docs.godotengine.org/en/4.7/tutorials/performance/pipeline_compilations.html).

**Engineering inference.** Egret validation should distinguish shader generation, pipeline readiness, first use, and other first-frame costs. One backend's precompilation cannot be described as universal benefit. The old conclusion remains.

#### research-08 WebGPU capability selection and device loss are separate states

**Official fact.** GPUWeb API references list device.features, limits, and the lost Promise. The official explainer distinguishes adapter limits from capabilities of the created device. GPU resets, memory faults, external device changes, and other events can cause loss. [GPUDevice interface](https://gpuweb.github.io/types/interfaces/GPUDevice), [GPUWeb explainer](https://gpuweb.github.io/gpuweb/explainer/).

**Engineering inference.** Egret needs required-capability detection, retained reconstructible resource descriptions, and runtime device generations/invalidation. New-device capabilities may require a different path. Browser APIs do not establish verification across target mini-game hosts/GPU/system combinations.

#### research-09 Asynchronous pipelines offer awaitable readiness but still require failure/invalidation handling

**Official fact.** createRenderPipelineAsync/createComputePipelineAsync return Promises. API references state returned pipelines are ready on success, reject failures with GPUPipelineError, and recommend asynchronous creation to avoid blocking the queue timeline. [GPUDevice asynchronous interfaces](https://gpuweb.github.io/types/interfaces/GPUDevice).

**Engineering inference.** Egret can protect results with cache keys, compilation queues, and device generations, separately recording request/readiness/use/failure. API existence cannot promise zero compilation cost, zero stalls, fixed completion times, or readiness of the whole first frame. Actual browser compilation was not tested.

#### research-10 JS/WASM interoperation is possible but needs lifecycle/data-transfer design

**Official fact.** Emscripten supports ccall/cwrap, explicit exports, Embind, and C/C++ calls into JS. Direct calls convert basic types/pointers. WASM memory growth invalidates existing views. Embind heap views avoid certain copies, but runtime does not manage their validity or underlying-object lifetime. [Code interoperation](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html), [Embind](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html).

**Engineering inference.** Egret needs boundary ownership, batch layouts, memory-growth rules, and destruction protocols. A locally copy-free heap view does not prove GPU uploads or end-to-end zero copy. WASM, JSB, and C++ labels do not establish speed; measure bridge frequency/cost for candidate implementations.

#### research-11 Public Cocos CLI engineering interfaces are available for research

**Official fact.** Pinned alpha.42 README lists creation/import/build/project information/MCP server/simulator preview, with separate simulator-build steps. main commands.md covers only part of the commands and cannot disprove README interfaces. [alpha.42 README](https://github.com/cocos/cocos-cli/blob/0.0.1-alpha.42/readme.md), [main commands](https://github.com/cocos/cocos-cli/blob/main/docs/en/commands.md).

**Engineering inference.** Callable engineering entry points are confirmed. Complete autonomous creation, transactional safety, automatic visual acceptance, and continuous-editing success are not thereby proven. Egret differentiation requires real tasks/failure recovery, not an MCP-support claim alone.

#### research-12 Record Laya knowledge MCP, IDE MCP, CLI, and Skills as separate layers

**Official fact.** Official AI roadmap positions CodingMCP as versioned knowledge queries, IDE-MCP as scene operations, and CLI as GUI-free engineering automation. CLI lists create/build/validate/run and version management; absence of matching runtime warns and falls back to the latest installed version. Skills publishes CLI/IDE-plugin development instructions. IDE MCP requires plugin import, ports, and cloud Key configuration. [AI roadmap](https://layaair.com/3.x/doc/guides/roadmap/ai/), [CLI](https://github.com/layabox/layaair-cli), [Skills](https://github.com/layabox/layaair-skills), [IDE MCP](https://layaair.com/3.x/doc/basics/developmentenvironment/ide-mcp/).

**Engineering inference.** Public entry points exist at different layers. Accept resource formats, build success, and gameplay/visual correctness separately. Knowledge-query version selection is not an engineering-action transaction. Plans, current cloud callability, and autonomous-completion rates were not verified.

### Handling historical research

| Historical statement | Current evidence/change | Recommended handling |
| --- | --- | --- |
| Creator 3.8.8; Cocos 4 alpha.34; CLI alpha.42 | Supported by official download/release pages | Retain snapshots/maturity boundaries; current Alpha dates lack years |
| Laya engine/IDE 3.4.1; website August 29/GitHub August 31 | Engine confirmed; current extraction lacks IDE download/website date | Confirm engine; mark IDE/website dates as historical research pending recheck; retain both date sources |
| Godot 4.7.2 stable/4.7 Web Compatibility | Website/versioned documentation read successfully | Retain; no Godot 404 this round, so add no fictional access failure |
| Laya 3.3 in August 2025;3.4.0 in June 2026 | GitHub displays 05 Aug/12 Jun; official timeline gives 2025-01-04/2026-02-02 | Add source-date conflict; preview/release meaning unknown; no silent earlier-date substitution or inferred years |
| Cocos CLI creation/build/preview/MCP | alpha.42 README supports; old main commands.md incomplete for preview | Retain overview and add pinned source; avoid relying solely on incomplete documentation |
| Documentation mechanisms inform Egret architecture | Official grounds for multicapability backends, async pipelines, JS/WASM bridges | Keep as engineering inference, not implemented, functioning, or performance advantage |

Direct Laya date-conflict evidence: [official timeline](https://layaair.com/3.x/doc/services/), [3.3.0](https://github.com/layabox/LayaAir/releases/tag/v3.3.0), [3.4.0](https://github.com/layabox/LayaAir/releases/tag/v3.4.0). Timeline updated 2026-07-10; this is not product launch dates.

No evidence overturns the core versions' existence. The actual changes lower confirmation for precise dates/IDE versions that could not be rechecked and add conflicts among official sources. Unchecked historical progress, previews, and platform matrices are not reconfirmed this round.

### Access records and unfinished work

W3C WebGPU TR, full GPUWeb specifications, and some Laya www URLs returned tool Internal Error, not evidence of HTTP 404. GPUWeb API references/explainer were read successfully and support mechanisms used here, without replacing a complete specification audit. Removing www from official Laya URLs made the AI roadmap/IDE MCP pages readable.

Cocos CLI commands.md at the pinned tag returned an internal tool error; the same tag's README was readable. Laya's dynamic download page returned one site-title line only. Missing extracted content was not rewritten as absence of the version.

Further validation: minimal executable competitor projects, actual MCP tools/errors, capability detection/fallback output, resource rebuilding after device loss, cross-device invalidation of asynchronous pipelines, JS/WASM copying/ownership, and target-host real-device matrices. Results enter [technical validation](round-1-research.md#execution); architecture candidates enter the [white paper](../docs/technical-white-paper.md).

### Self-review

Sources are vendors, official repositories, GPUWeb/W3C, and Emscripten. Critical claims use inspectable primary material. Historical conclusions were not silently overwritten beyond explicit conflicts. No historical source was executed, engine installed, or external content published. Structured records separately preserve dates, versions, access status, vendor statements, and engineering inferences.

<a id="execution"></a>

## Technical Validation Record

Historical version: 0.1 · Executed: October 8, 2026. This round separately records official research, an architectural model, and local browser graphics experiments. Local correctness is not engine, cross-language, platform, or performance acceptance.

This document retains the first round's scope and omissions at that time. See the [second-round validation record](round-2-research.md#execution) and [second-round audit](round-2-research.md#audit) for subsequent progress.

[Technical white paper](../docs/technical-white-paper.md) · [Engineering plan](../docs/engineering-plan.md) · [First-round audit](round-1-research.md#audit)

### Execution and results

| Evidence | Checks executed | Result | Supported scope |
| --- | --- | --- | --- |
| E001 / S014 | 12 critical research checks and 27 official sources | Core versions and mechanisms supported; some Laya dates conflicted or were not rechecked | Versions/mechanisms stated by documents and source, not runtime reliability |
| E002 / S015 | Node architectural model: 17 initial checks, 26 after audit | New counterexamples first produced 17 passes/7 failures, then 24 passes/2 failures; final result 26 passes/0 failures | Fixed-region layout, command order, and bounded mirror/resource state; not the complete recovery contract |
| E003 / S016 | Seven graphics checks in a fresh temporary headless desktop Edge environment | First run 6 passes/1 failure; after correcting test timing, 7 passes/0 failures | Local WebGL2 pixels, context reconstruction, and WebGPU clear/readback |

Raw material: [research JSON](../../evidence/research-refresh-2026-10-08.json), [initial contract JSON](../../evidence/contract-probe-initial-results.json), [first counterexample failures](../../evidence/contract-probe-audit-red-results.json), [intermediate correction](../../evidence/contract-probe-audit-green-1-results.json), [lease counterexample failures](../../evidence/contract-probe-audit-red-2-results.json), [final contract results](../../evidence/contract-probe-results.json), [graphics results](../../evidence/browser-probe-results.json), [first graphics failure](../../evidence/browser-probe-first-attempt.json), and [graphics screenshot](../../evidence/browser-probe.png). Programs and reproduction entry points: [contract prototype](../experiments/contract-probe/README.md) and [browser prototype](../experiments/browser-probe/README.md).

### What the contract model does

Node version 24.19.0, Windows x64; seed 20261008. Eight independent layout regions, each with 128 objects, undergo 200 change rounds compared with an independent full recomputation. Stationary, sparse, repeated-invalidation, and full-invalidation cases are also checked. The model uses fixed-hierarchy dimensions and positions; it excludes complete EUI, text measurement, ancestor dependencies, and reparenting.

Eighty seeded transparent/rectangular-clip scenes expand adjacent batches and compare them with the same per-command CPU compositor. A counterexample also shows global texture sorting changes color. The first check primarily establishes preservation of input order, not independent batch-consumer validation. The compositor ignores pipeline state and applies clipping per command, so it cannot establish compatible shared state within a batch. Arbitrary masks, skeletons, text, and real material execution are absent.

Mirror checks cover duplicate packets, atomic command rollback, destroyed-object reuse, generations, sequence gaps, graphics snapshots with new epochs, and backpressure at capacity three. Audit counterexamples add packet-header/command formats, invalid-snapshot atomicity, and identity consistency. Resource checks add old completion during/after device loss, cancelled tasks after zero retention followed by renewed retention, and late release/use of the same owner's old lease. There is no reliable-event outbox, watermark, or retransmission. A graphics snapshot may skip missing pure state but cannot guarantee recovery of missing must-deliver events. Resource `complete` still combines load/upload callbacks; `rebuild` is a synchronous state simulation, and owners are represented as a set rather than complete per-lease counts. This is not an asynchronous GPU implementation. Actual JS/C++, WASM shared heaps, binary parsing, and GPU synchronization were not executed; bridge performance remains unmeasured.

Sparse changes still read the 128 objects in their region; full invalidation still updates 1,024 objects. Only operation counts are recorded, with no CPU timing, FPS, or speed multiplier. Planned reparenting, dynamic ancestors, complex text, and invalidation cycles cannot be described as tested.

### Browser and pixel results

Environment: Edge 154.0.4258.62 with a fresh temporary headless test profile. The browser reports WebGL2 through ANGLE/D3D11; its renderer string includes NVIDIA GeForce RTX5090 Laptop GPU, without independent authentication of the actual hardware path. The page uses a local secure context; crossOriginIsolated=false, SharedArrayBuffer is absent, and WebGPU interfaces and device creation are available.

WebGL uses a 32×32 RGBA8 target, a depth attachment, a fullscreen triangle, and rectangular scissor. Near geometry occludes far geometry; two translucent layers composite in the specified order; colors outside the clip remain unchanged; readback is identical after rebuilding resources. The normal center color is [70,140,51,255], changing to [134,77,51,255] when order is reversed. WebGPU clear/readback returns [64,127,191,255], passing the predefined ±2 tolerance per channel.

The tolerance, 32×32 size, eight-second timeout, and similar values are experiment parameters, not product specifications. The experiment includes no camera/model/texture assets, text, skeletons, performance sampling, phones, or mini-game hosts. It also excludes WebGPU device loss and asynchronous shader compilation.

### Audit counterexamples and corrections

The independent audit first reproduced acceptance of invalid packets, premature epoch/next mutation by invalid snapshots, and erroneous restoration of availability by old-device completions. Seven checks were added, producing 17 passes/7 failures. Correcting the model brought all 24 checks to green. A subsequent review found that late release of an old lease could still clean up new resources belonging to the same owner. Two new checks produced 24 passes/2 failures. After correcting lease-generation validation in use/release, all 26 passed. Both source files for the initial version, two failing versions, and intermediate corrected version were archived before subsequent changes; corresponding results include SHA256.

Resource corrections add device generations, loss state, and retention-task generations. Snapshots are validated and temporary maps constructed before commit. Reliable-event recovery and an independent batch consumer remain uncovered and are registered in the white-paper contract and next engineering round. Pass counts do not establish a complete recovery contract or performance advantage. See the [first-round audit](round-1-research.md#audit) for detailed handling.

### First browser failure and correction

The first context-restoration check timed out waiting for webglcontextrestored. The test resolved its Promise inside the loss event and immediately requested restoration. Requesting restoration in a later task made the second run pass. Chromium's public implementation updates restoration permission after event dispatch returns, which is consistent with this timing explanation. This round did not trace current Edge internals and cannot claim the sole root cause across all browsers. [Chromium implementation](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc), [Khronos extension specification](https://registry.khronos.org/webgl/extensions/WEBGL_lose_context/).

The first failure is retained. Its four source files are historical snapshots restored after correction from the first result's SHA256 and individually verified, described in [attempt-1](../experiments/browser-probe/history/attempt-1/README.md). This was not a proactively archived pre-correction commit, nor does the second version replace the old source. The second run had no page-script exception. One page-resource 404 diagnostic corresponds to the test page's missing favicon; it was not treated as a graphics result or product failure. Raw diagnostics are retained.

### Status updates

D001–D012 remain proposed; H001–H007 remain untested. Local evidence is added to sources and relevant candidate descriptions without upgrading any advantage hypothesis to established. V001 enters research-baseline organization; product implementation for V002–V006 has not started. V008 delivers the first candidate versions of the white paper, PRD, and engineering plan.

The next round will add nested UI/text, reliable boundary events, independent batch-state consumption, actual mixed rendering, resource replacement/load/unload, and real host devices. P95/P99, first interactive time, memory, and energy use should be measured only after fixing visual quality and budgets. These acceptance checks cannot be replaced by this round's 33 local checks.

<a id="audit"></a>

## First Round Audit

Version: 0.1 · Date: October 8, 2026. An independent AI reviewer performed the audit; the implementer handled corrections and revalidation. Review results are not human acceptance, a complete security audit, or product acceptance.

[Technical white paper](../docs/technical-white-paper.md) · [Product requirements](../docs/product-requirements.md) · [Engineering plan](../docs/engineering-plan.md) · [Technical validation record](round-1-research.md#execution) · [Audit register JSON](../../evidence/design-audit-2026-10-08.json)

### Scope and method

The audit examined three candidate designs, requirement and delivery boundaries, research records, experiment source, and result summaries. The independent reviewer first proposed model counterexamples; the implementer added failing tests before correcting them. The reviewer reproduced failures and passes in memory and checked source SHA256 individually, without launching another browser, running historical source, or rewriting result files.

Research verification covered 12 critical claims and 27 official sources. The final local contract had 26 passes, and browser graphics had seven. Counts describe actual cases only; they do not establish complete engine-recovery contracts, mixed rendering, or platform coverage.

### Findings and handling

| Finding | Risk and evidence | Handling this round | Remaining boundary |
| --- | --- | --- | --- |
| Invalid packet fields accepted | Missing sequence/generation bypassed comparisons and let invalid packets modify the mirror | Add header/command counterexamples, observe failure, then fully validate fields; revalidated | No binary parsing, byte lengths, version migration, or real bridge |
| Invalid snapshots partially polluted state | epoch/next changed before invalid objects were detected | Add atomicity and identity-consistency counterexamples, construct temporary state before commit; revalidated | Real state sizes, chunking, and OOM recovery untested |
| Old-device completion resurrected resources | Old upload completion could restore resident after loss | Add device generations, loss state, and task generations; reject old completion during and after loss; revalidated | CPU decode/GPU upload remain combined; rebuild is synchronous state modeling |
| Old leases affected new retention | Reacquisition by the same scene after retaining a fence allowed old release to remove a new owner; old use could still succeed | Add two failing counterexamples, check retention-task generations in use/release; revalidated | owner Set is not full reference counting or independent per-owner leases |
| Graphics snapshots did not guarantee must-deliver events | A new epoch could skip missing event-bearing packets | Tighten white paper: TS authority retains gameplay events; cross-boundary must-deliver events require separate IDs/outbox/consumer watermarks/retransmission | Registered for the next round; current model has no reliable-event recovery |
| Batch validation strength overstated | Expanded batches still used the same paint and did not execute pipeline state | Rename tests and add report limits; retain only order preservation and transparent-sorting counterexamples | Independent shared-state batch consumer and bad pipeline/clip counterexamples pending |
| First graphics failure source traceability | First report had hashes, but source was not proactively archived before correction | Restore four source files after correction and match each first-run SHA256; independently verified | A restored snapshot is not a preexisting commit; recorded truthfully |
| Documentation/register boundaries | “No prototype executed” conflicted with local research; old static dates could appear newly confirmed | State that no complete engine exists; retain Laya date-source differences and IDE not-rechecked markers | Host ordering, devices, budget, team, deadlines, and public licensing remain undecided |

### Correction chain and inspectable evidence

The contract experiment retains raw results and both source files in this sequence:

1. Initial 17 passes, followed by audit omissions: [initial results](../../evidence/contract-probe-initial-results.json), source in `experiments/contract-probe/history/initial/`.
2. All seven new counterexamples failed, totaling 17 passes/7 failures: [failure results](../../evidence/contract-probe-audit-red-results.json), source in `history/audit-red/`.
3. First corrections produced 24 passes: [intermediate results](../../evidence/contract-probe-audit-green-1-results.json), source in `history/audit-green-1/`.
4. Both old-lease counterexamples failed, totaling 24 passes/2 failures: [second failure results](../../evidence/contract-probe-audit-red-2-results.json), source in `history/audit-red-2/`.
5. Final 26 passes: [current contract results](../../evidence/contract-probe-results.json), current source `model.mjs/run.mjs`.

Historical paths in items 2–4 are relative to the Egret contract experiment directory. The independent reviewer reproduced both red-to-green chains and confirmed source digests for each version. The browser first produced 6 passes/1 failure, then seven passes after timing correction. The failure and four hash-restored files are likewise retained. Review did not trigger an additional browser rerun.

### Audit conclusion and next round

Within the expressly defined model scope, review found no remaining flaw directly invalidating the conclusions. Twenty-six local contract and seven desktop graphics checks support further refinement; they cannot approve production selection or establish leadership. D001–D012 remain proposed, H001–H007 remain untested. R008 complete migration and V002–V006 product delivery have not been accepted.

Prioritize reliable events, independent batch consumption, nested UI/text, and complete resource leases next. Then use actual 3D/2D assets and selected real hosts to establish common visual-quality, device, and measurement baselines. Each round retains “source/hypothesis → counterexample → actual result → independent review → register update,” allowing candidate approaches to be overturned.
