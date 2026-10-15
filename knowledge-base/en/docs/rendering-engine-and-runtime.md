# Rendering Engine and Runtime

English | [简体中文](../../Cns/docs/渲染引擎与运行时.md)

The Runtime preserves game semantics while graphics executors turn scene state into pixels. Complex UI needs ordered composition, predictable layout and precise input; 3D needs cameras, culling, materials and depth-aware ordering. Their shared foundation is resource identity, one submission owner and coordinated frame/lifecycle boundaries.

The design separates those responsibilities so correctness remains visible when optimizing or replacing a backend. Current bounded display, resource, animation and Button capabilities are in [core progress](core-progress.md). The larger architecture targets complete mixed works; target hosts, image quality and device budgets still require explicit acceptance.

[Technical architecture](technical-architecture.md) · [White paper](technical-white-paper.md) · [Product requirements](product-requirements.md) · [Engineering plan](engineering-plan.md) · [Knowledge base home](../README.md) · [Decision register](../../Cns/registry/决策.json)

## Shared foundations and different execution orders

Each runtime instance shares textures, buffers, shader/pipeline caches, upload queues, temporary frame resources, and statistics on one selected GPU backend. The logical scene is unified, but UI generates ordered lists from layout, text measurement, and hit-test results; 3D generates opaque/transparent lists from cameras, culling, LOD, and materials.

UI merges only adjacent compatible items within allowed boundaries; scissor, stencil, and alpha masks separately declare state/offscreen dependencies. 2D skeletal animation follows slot order, clipping, and outfit-change semantics; arbitrary reordering to reduce batches is prohibited. 3D opaque items may sort by material/depth strategy; transparent items follow correctness rules. The baseline frame plan renders 3D and optional postprocessing first, then composites screen UI at independent clarity. World-space UI and interleaved 2D/3D require explicit placement, depth, and color conversion. DrawCall reduction must also check CPU sorting, vertex preparation, bandwidth, and overdraw costs. The [Cocos 3.8 batching documentation](https://docs.cocos.com/creator/3.8/manual/en/ui-system/components/engine/ui-batch.html) provides reference ordering and state constraints.

## Cross-host capabilities and fallback

Negotiate a profile at startup: backend, texture formats, target/sampling limits, compute, asynchronous pipelines, workers/shared memory, text/input, storage, and lifecycle. Verify asset compatibility during builds. Browsers, mini-game/mini-program hosts, native hosts, and Unity-embedded hosts must not be treated as one capability environment.

The basic path does not depend on threads or shared memory. Missing enhancements fall back to CPU deformation, simpler particles, fewer lights/postprocessing effects, and appropriate compressed formats. Backend changes rebuild resources and pipelines and run visual regressions. Necessary effects that cannot be preserved must explicitly block export or require a chosen alternative; gameplay must not silently disappear. Runtime OOM/long-term throttling uses explainable quality levels and recovery hysteresis. API existence alone cannot establish host usability. [Godot 4.7 Web documentation](https://docs.godotengine.org/en/4.7/tutorials/export/exporting_for_web.html) specifies its WebGL2/thread conditions; those facts cannot directly certify new Egret hosts.

## Low-overhead and energy strategies

On CPU, first remove repeated layout/measurement, full-tree scans, and short-lived allocations. Cache keys must include font, size, language, theme, and clipping state. On GPU, first reduce overdraw, unnecessary offscreen targets, full-size postprocessing, and repeated uploads; atlases, batch size, and cache area have memory budgets. Bridging records per-frame call counts, bytes, waits, and queue depth, batches changes and returning events, and avoids forcing synchronization for hit tests and measurements.

Static UI may stop unnecessary visual sampling or skip permitted presentation while correctly handling input, timing, game events, and host requirements. Visibility, animation distance, target frame rate, and 3D resolution jointly control sustained load; background suspension may cancel work. Power must be measured on real devices. Temperature/frequency/frame time can be proxies only under labeled conditions. [Android ADPF](https://developer.android.com/games/optimize/adpf) can provide thermal/performance signals in some native environments; availability in browsers and all hosts is not assumed.

[Filament FrameGraph](https://google.github.io/filament/notes/framegraph.html) informs resource dependency/lifetime design; the [KTX2 specification](https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html) supports mips and universal texture payloads. None of these capabilities proves this proposal faster, more efficient, or lighter.

## Complete Spine integration

R020 requires full version-correct Spine semantics and rendering integration. An optional adapter shares Egret graphics/resource lifetime while preserving per-instance state, ordered slots, blend/tint/clipping, gameplay clocks/events and recovery. Backend fallback must preserve required effects or report unsupported scope. A 3D skinning example does not establish complete 2D skeleton behavior. Exact runtime versions, native routes and public APIs need their own design/verification. The [Spine contract](spine-animation-support-and-acceptance.md) defines the required matrix; complete V020 remains open.

## Three prototype verification gates

The table below defines candidate acceptance for complete runtime prototypes. The historical research baseline includes bounded model contracts, local pixel/context behavior, and an executed fixed glTF skinned-cylinder reference chain. It does not include complete complex UI, complete 3D characters/scenes, complete 2D skeletal animation, actual cross-language bridging, or performance timing. Model defects, fixes, and revalidation remain in the [round-one audit](../archive/round-1-research.md#audit) and [round-two verification record](../archive/round-2-research.md#execution)/[audit](../archive/round-2-research.md#audit). See the [round-three integration record](../archive/round-3-research.md#execution) and [audit](../archive/round-3-research.md#audit) for real-asset results. These local studies cannot replace the gates below.

| Prototype | Content and observations | Passing gate |
|---|---|---|
| P1 Complex UI | Variable-height virtual lists, CJK/emoji/input, multilayer masks, theme changes; static, sparse-update, and fully dirty levels. Measure layout/preparation CPU, allocation/GC, batching, text clarity, and hit testing. | Fixed regressions have no critical visual/interaction errors; no invalidation loops when fully dirty; cache budgets are effective. Record all three levels, not only static advantages. |
| P2 Mixed rendering | 3D scenes/characters, transparent VFX, complex UI, 2D skeletal clipping/order/outfit changes, and frame animation. Measure CPU/GPU P50/P95/P99, uploads, overdraw, intermediate targets, bridging, and peak memory. | Correct events, attachments, masks, sorting, and color; enhanced/basic paths meet predetermined visual levels. Unresolved tail stutters or resource peaks block selection approval. |
| P3 Backend/runtime | Same assets across candidate hosts: cold loading, first interaction, first shader/effect use, resource replacement/unload, background recovery, device loss, and 20–30 minutes of sustained execution. | Recoverable resources/mirrors, no duplicate events or invalid handles, no sustained memory growth under repeated load/unload, bounded queues. Loading, frame-time, and energy budgets must be agreed by device in advance and met. |

All prototypes first pin devices, hosts/versions, image quality, total/visible nodes and resources, release builds, networking, brightness, and thermal state, then compare with reasonably optimized equivalent work implementations; record failures and variation. P3's sustained-run duration is an experimental recommendation, not an approved product budget. Initial host order, team, schedule, and numerical performance budgets remain undecided. Exploration can proceed, but performance acceptance cannot be declared. The original research/product register cutoffs are retained in the evidence notes. R008 remains part of the first complete release objective; V006 depends on V001–V005. Sustained comparative benefit requires version regression and continuous work verification; see [core advantages and verification](core-advantages-and-verification.md) and the [delivery plan](delivery-plan.md).

Round two partly verified independent event streams, per-lease asynchronous resources, nested layout/hit testing, and batch-shared state, and actually ran programmatically generated WebGL mixed scenes. They do not cover complete assets, text/skeletal semantics, or target-device budgets. The [technical white paper](technical-white-paper.md), [engineering plan](engineering-plan.md), and [round-two verification record](../archive/round-2-research.md#execution) define current contract refinements and next gates.

## Twelve candidate decisions

| ID | Candidate | Constraints that must be retained |
|---|---|---|
| D001 | Retain TS scenes/components and retained UI; extract compact rendering data through dirty queues. | SoA/preallocation applies only to measured hotspots; fully dirty workloads have a full-update path. Incremental CPU updates do not mean partial GPU redraw. |
| D002 | UI/2D and 3D use separate execution lists, sharing the selected backend, resource center, and scheduling. | Global texture sorting must not break transparent composition, skeletal slot order, or mask order; world-space UI has explicit depth and sorting. |
| D003 | Small frame-graph templates declare resource dependencies, lifetimes, and load/store, with cached execution plans. | Do not interpret a large generic graph every frame. Pass merging needs bandwidth and intermediate-target-area measurements; tile GPUs cannot be assumed always to benefit. |
| D004 | Mobile forward is the portable baseline; enable clustered, forward+, and compute particles by capability/content. | Enhanced paths share assets and correctness tests; the current scope does not support default deferred rendering. |
| D005 | Unified GPU resource/pipeline interfaces; evaluate WebGPU, WebGL2, and native providers. | Backend differences are explicit extensions. WebGL1 needs, Dawn/wgpu, package size, and porting costs await measurement. |
| D006 | TS owns public interfaces and orchestration; evaluate Rust/C++ computation/execution modules and WASM/native deployment through narrow contracts. | Native state is a rebuildable mirror; transfer in batches and prohibit high-frequency synchronous queries. Design protocols, ownership, and recovery first. |
| D007 | Phased UI invalidation, layout islands, virtualization/reuse, ordered batching, and text/shape caches. | Static subtree caches have budgets; small text, CJK/emoji, input, and dynamic masks each have quality strategies. |
| D008 | Separate animation state/events from visual sampling/deformation; CPU/WASM reference paths, GPU deformation evaluated by profile. | Constraints, attachments, root motion, clipping, draw order, and events cannot be delegated solely to skinning; frame animation mainly changes frame references. |
| D009 | Build deterministic target resources, shader variants, and module/split-package dependency manifests; budget streaming uploads. | Transcoding has download/decode/CPU cost; fonts/icons have quality exceptions; Web shaders may still compile on the client. |
| D010 | Schedule simulation and presentation separately, with host clocks, bounded task queues, and hysteretic quality control. | Dynamic resolution affects only 3D and preserves UI clarity; missing GPU/thermal data requires labeled proxy metrics. |
| D011 | During development, expose object/pass/resource origins, bottlenecks, and diagnostics to the editor and AI. | Diagnostics and mappings can be trimmed from release packages. Do not call LLMs every frame; suggestions require measurement and visual/behavioral verification. |
| D012 | Independently pin scene, asset, material, and bridge-protocol versions; maintain migrators and mixed-workload regressions. | Lower replacement cost does not guarantee a sustained lead; upgrades must retain rollback and work acceptance. |

## Executed mature-implementation baseline

R012 evaluates established mechanisms through the [reference integration](open-source-reference-implementations-and-adoption.md), which uses attributed third-party rendering/import/animation and Canvas text mechanisms to test Egret frame, state and resource adaptation. The executed r186 real-glTF chain passed 17/17 bounded checks. [Integration](../archive/round-3-research.md#execution) and [audit](../archive/round-3-research.md#audit) retain assets, shared ownership, handoff, recovery and failures. Those observations remain research; complete UI, 2D skeletons, characters, CJK/IME, host support and benefits require separate acceptance.

## Backend and native integration

The [backend study](graphics-backends-and-native-runtime-selection.md) covers WebGPU/WebGL/Canvas, TS7, Rust/C++, VMs and native graphics libraries, plus optional desktop/GPU-AI extensions. Its original research cutoff added source analysis and candidate design without installing or executing those candidates or expanding the17-check chain. D013–D015 and H008 retain their recorded proposed/untested scope.

## Core implementation origins

R015 and the [implementation policy](independent-implementation-and-dependency-policy.md) require Egret execution, composition and resource contracts to be independently authored. Standards and reference studies explain mechanisms; public libraries retain explicit identity and license. The reference integration is separate from the independent core, and AI-assisted contributions retain their provenance and ordinary review obligations.

## Engineering structure and public code contracts

R016 connects the [package structure](engineering-architecture-and-project-structure.md), [API contracts](public-api-design-and-naming.md) and [quality gates](code-standards-and-quality-gates.md). Broader candidate names coexist with concrete implemented package contracts. The [first core record](core-framework-implementation-record.md) preserves its headless cutoff; complete API/platform/CI/migration acceptance remains distinct.

## Implemented 0.13 boundaries

The historical 0.13 implementation retained engine → runtime/contracts and runtime → contracts, with DOM-free ES2022 `engine/rendering` referencing contracts and separate browser `engine/web` output. robust-predicates 3.0.3 was the exact external package-root exception, not another project/package. WebGPUHost owned GPU buffers; CPU asset disposal at that cutoff did not establish later texture lifetime. Future graphics/hosts/native packages remain broader design rather than an implemented-directory claim.

## Historical evidence and register cutoffs

The October 8, 2026 knowledge base 0.7.0 cutoff recorded D001–D016 proposed and H001–H008 untested, V001 research in_progress, V002 with local headless core and V003–V006 product implementation not_started. The October 10 Spine registration recorded V020 not_started/not_run. Later packages do not rewrite those historical states.

[Round-one execution](../archive/round-1-research.md#execution) and [research](../archive/round-1-research.md#research), [round-two execution](../archive/round-2-research.md#execution)/[audit](../archive/round-2-research.md#audit) and the linked third-round record preserve their limited scopes. The [0.12 display/frame contract](display-and-frame-execution-contract.md), [plan](display-and-frame-implementation-plan.md), [record](display-and-frame-implementation-record.md) and [verification](../../evidence/display-frame-verification.json) retain 97/97 behavior tests, 25 negative diagnostics and desktop Canvas/pointer observations after cross-realm correction. The [0.13 rectangle record](webgpu-rectangle-implementation-evidence.md) is separate. Neither establishes whole texture/text/animation/UI/3D, Native/device/editor/Agent or migration acceptance.
