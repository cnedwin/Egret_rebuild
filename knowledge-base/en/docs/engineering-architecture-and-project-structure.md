# Engineering Technical Architecture and Project Structure

English | [简体中文](../../Cns/docs/工程技术架构与项目结构.md)

The historical 0.13.0 rectangle checkpoint has its own [implementation and verification record](webgpu-rectangle-implementation-evidence.md). Its source identities, results and pending work retain their recorded scope; they do not establish current product acceptance.


## Historical 0.12.0 display and frame candidate scope

The successor work package is defined by the [display and frame contract](display-and-frame-execution-contract.md) and [implementation plan](display-and-frame-implementation-plan.md): display transforms, inherited visibility/alpha and local rectangle clipping, Sprite-owned Graphics rectangle fills, and immutable CPU frame capture/submission. The implemented first execution adapter is Canvas through the separate @egret/engine/web entry; the core root retains its DOM-free boundary. Bounded implementation checks passed: 97/97 core behavior tests, 25 negative type diagnostics and real desktop Canvas pixels/pointer interaction. Scoped independent review passed after the recorded cross-realm rejection correction. Remote publication is tracked separately. Final scoped results belong in the [implementation record](display-and-frame-implementation-record.md) and [verification](../../evidence/display-frame-verification.json).

This work package does not establish complete text/texture/animation/UI/3D execution, GPU or Native support, target-device performance, editors, Agent services, or complete migration. Earlier headless, CPU asset and third-party research records retain their original versions, counts, hashes and scope; their results are not new display-frame acceptance.

Version: 0.1 candidate specification · Knowledge base 0.9.0 · Updated: October 8, 2026.

R016 confirms the objectives of completely redefining architecture and code standards, retaining Egret naming, and modernizing structure/APIs. D016 records the candidate tradeoffs below. Directories, packages, APIs, and gates have not been completely implemented or accepted; the [first core-slice record](core-framework-implementation-record.md) describes the implemented headless subset. “Must” in these rules describes proposed engineering constraints.

[Public APIs and naming](public-api-design-and-naming.md) · [Code standards and gates](code-standards-and-quality-gates.md) · [Runtime semantic architecture](technical-architecture.md) · [Rendering design](rendering-engine-and-runtime.md)

## 1. Recommended direction and design rationale

Recommend a TS/Rust monorepo with “layered packages + familiar object APIs + a data-oriented execution core.” Familiarity stays in game semantics: display objects, display lists, events, stages, resources, and animation. Modernization appears in modules, ownership, project contracts, tool feedback, and target-specific builds. There is no need to convert all scenes to ECS or make every browser work carry complete Rust/WASM or a native VM.

| Structural approach | Benefits | Main costs | Candidate judgment |
| --- | --- | --- | --- |
| Global namespace + one large engine package | Most familiar to legacy teams, few initial entry points | Implicit globals and platform conditions readily enter every layer; resources/tools/backends are difficult to isolate and on-demand trimming difficult to audit | Migration compatibility entry only, not authoritative structure for new projects |
| Separate package for every feature + all-ECS/all-WASM | Strong isolation, suitable for larger teams and some data-heavy workloads | Too many initial packages, bridges, tasks, and releases; greater UI semantic and debugging costs | Split when measurements and independent consumers justify it; do not build packages for all future features first |
| A few responsibility-based packages + domain directories + TS object interfaces/compact frame data | Familiar to developers, shared semantics for tools, replaceable backends/hosts, progressive movement of hotspots down the stack | Requires strict dependency and data-authority rules | Recommended candidate |

Here, “mature data-oriented core” means mechanisms such as dirty queues, batched resource changes, compact rendering lists, and generational handles. Specific structures and execution contracts are independently designed to Egret specifications, with research sources and third-party dependencies registered separately. R015's independent implementation boundary continues to apply.

## 2. Initial directory and package budget

Directory/package names are candidates pending review; actual public npm scope availability is unverified. First establish 9 TS workspace packages and 3 public package identities. The editor and MCP are applications; host adapters start as directories within packages, without immediately creating separately published packages for every platform. Create the 3 candidate Rust crates only when they have actual native-stage responsibilities. This does not mean repository creation in this round or acceptance of a complete Rust selection.

```text
egret/
  apps/
    editor/                   # Scene/UI/resource/animation editor and playtest shell
    mcp-server/               # Thin adapter app for discovering/calling project services
    preview/                  # Local controllable playtest and diagnostic runner
  packages/
    contracts/                # private: versioned schemas, handle/diagnostic/host/frame contracts
    runtime/                  # private: logical scene, UI, animation, resource leases, execution extraction
    graphics/                 # private: frame plans, resource residency, WebGPU/WebGL executors
    hosts/                    # private: web/minigame/native integration and platform services
    engine/                   # public: developer API facade and instance assembly
    project/                  # public: project documents, commands, transactions, references/version SDK
    toolchain/                # private: import, variants, caches, diagnostics, target export
    cli/                      # public: project-service command entry
    legacy/                   # private: legacy parsing, conversion rules, comparison reports
  native/
    crates/
      egret-core/             # Pure native foundations: handles, buffers, protocol validation, tested tasks
      egret-runtime/          # Modular native graphics/VM/host assembly
      egret-ffi/              # Narrow C ABI and owned/borrowed integration for external SDKs
    dependencies/             # Explicit third-party versions, build scripts, notices, patch records
  examples/                   # Public reproducible works and teaching projects
  tests/
    contracts/                # Format, transaction, protocol, and ownership invariants
    integration/              # Mixed semantics, recovery, load/unload, migration comparisons
    fixtures/                 # Benchmark samples with sources, versions, permissions
  benchmarks/                 # Performance methods, scenes, environment records
  tools/                      # Repository development/generation/dependency-boundary checks
  docs/
    adr/                      # Proposals, acceptance, supersession, actual evidence
    api/                      # Manuals generated from public APIs
```

Public names do not mean npm registration or published packages. Candidate release entry points are `@egret/engine`, `@egret/project`, and `@egret/cli`. Other packages are explicitly private. Subpaths in `packages/engine` may provide `/eui`, `/scene3d`, `/animation`, `/web`, and `/compat`, without turning each into an npm package requiring independent upgrades. Verify subpath boundaries on actual target release packages; “using ESM” does not automatically prove unused modules, fonts, VMs, or 3D resources are removed.

Package splitting is triggered by independent use/maintenance responsibility, different release cycles, real isolation needs, or measured build benefits. File-count growth alone does not trigger it. Extend runtime capabilities primarily through directories and providers, avoiding dozens of empty packages permanently released in lockstep at the start.

## 3. Module dependency DAG

Arrows below mean “depends on”:

```text
engine    -> runtime, graphics, hosts, contracts
runtime   -> contracts
graphics  -> contracts
hosts     -> contracts
project   -> contracts
legacy    -> project, contracts
toolchain -> project, legacy[optional], contracts
cli       -> project, toolchain
editor    -> project, toolchain; playtest sandbox uses engine separately
mcp-server-> project, toolchain
preview   -> engine; development diagnostics connect to project/toolchain
```

runtime/graphics/hosts must not depend on project, toolchain, editor, CLI, Agent clients, or legacy migrators. project must not depend back on toolchain, which would make project commands need build implementations and those implementations need project commands. graphics must not import runtime display objects: runtime outputs value-type/handle rendering data from contracts and graphics consumes it. WebGPU providers cannot directly call WebGL providers or vice versa.

Pure contracts trigger no DOM, GPU, files, networking, threads, timers, VM initialization, or global registration. Export type contracts separately from executable validators; public type imports must not automatically include all project-schema validators in bundles. Persistent JSON schemas, protocol schemas, and generated TS/Rust types have one authoritative source file. Generated artifacts are rebuildable; do not manually edit two separate copies of a contract.

The package dependency graph does not mean every export imports whole packages. The root entry retains only createEngine and basic 2D types. Access stage through an Engine instance, without automatically importing native, 3D, or EUI. `/web` assembles browser hosts and WebGPU/WebGL executors; `/scene3d`, `/eui`, and `/animation` are explicit build exits/capability boundaries. Later consumers and version cadence determine actual independent release packages. Public names/subpaths await registry availability checks and API review.

Inject host capabilities through ports rather than asking “is this WeChat/Android?” in every layer. Performance hotspots may use explicit internal extension points, but arbitrary `internal` imports cannot bypass resource generations, device owners, or persistence-format versions.

## 4. Layer responsibilities and data authority

| Layer | Facts owned | Responsibilities | Exclusions |
| --- | --- | --- | --- |
| project | Versioned projects, stable IDs, scene/asset references, target profiles | Queries, atomic transactions, conflicts, undo, format upgrades, structured diagnostics | Does not control per-frame playtest state or allocate GPU resources directly |
| runtime | Instance game state, scene semantics, UI/animation state, consumed-event identities, CPU resource leases | Retained UI, hit tests/layout, animation events/sampling, cancellation/bounded tasks, execution-data extraction | Does not treat GPU/native mirrors as second business authorities or call LLMs |
| graphics | GPU residency and execution plans within a device epoch | Uploads, pipelines, passes, composition, completion/reclamation, loss rebuild | Does not decide game rules or break UI/skeletal order with global sorting |
| hosts | Host surfaces, lifecycle, platform input/IME, clocks, storage/system-service contracts | Real capability negotiation, error classification, platform SDK adaptation | Does not fabricate a complete browser or implicitly downgrade necessary gameplay |
| engine | Assembly and lifecycle of one runtime instance | Public object APIs, unified device/clock/resource owner, startup/pause/recovery/shutdown | Does not become a global service locator or leak unstable backend implementations |
| toolchain | Derived artifacts for specific input versions | Resource conversion, shader variants, content-hash caches, target-module/split-package manifests, build diagnostics | Does not modify projects as a build side effect or treat caches as source-asset authority |
| editor/CLI/MCP | User intent and operation interfaces | Call the same project/build services, display diffs/waits, query/cancel tasks | Do not implement separate reference checks, asset import, or file-change protocols |
| legacy | Conversion specifications and reports | Parse old projects, determine rules, assist AI repair, compare behavior/visuals/publication | Does not permanently bring old projects or third-party runtimes into every new project |

Separate persistent object/asset IDs, runtime instance handles, GPU handles, asynchronous task IDs, deviceEpoch, and resourceGeneration. Stable names/paths are not identity; native pointers cannot directly be file IDs. Protocols specify JS/native integer widths, byte order, packet lengths, and overflow handling rather than assuming both happen to use the same language numeric representation.

## 5. Rendering and backend responsibilities

WebGPU is the main line for modern resource/pipeline/pass design; WebGL2 is a maintained compatibility executor. Evaluate WebGL1 only where target hosts/old samples establish necessity. Within one main surface, UI, 2D, and 3D share the selected backend's device and frame scheduling. Do not default to exchanging the entire main frame among WebGPU, WebGL, and Canvas every frame.

Canvas providers supply text, some vectors, and offscreen content, uploading cache changes to the selected GPU. Canvas-only is an explicitly limited 2D profile, with no promise of complete 3D, arbitrary filters, or compute fallback. Native text uses system or selected public font/shaping dependencies through providers, sharing text/layout contracts without depending on browser Canvas.

Within graphics, first separate `frame/`, `resources/`, `pipelines/`, `passes/`, `backends/webgpu/`, and `backends/webgl/` by responsibility. Ordered UI/2D and 3D lists come from different extraction paths, sharing frame-resource, color, and composition contracts. Simple frame plans may be cached; multipass effects have budgets. Calling an asset a “component” does not imply a single draw.

Native graphics providers integrate through public interfaces with one primary low-level library selected after comparison. Neither wgpu nor Dawn is an accepted selection; do not promise production support for two complete renderers in advance. Rust first enters clearly bounded ownership, task, and batch-protocol modules. WASM hotspots account for download, initialization, copies, and recovery. Browser release packages do not carry native VMs.

Each surface defaults to an exclusive presentation owner; reject a second Engine binding to it. Only host-declared, accepted shared-scheduling modes may be exceptions, and these are not initially enabled by default. When instances borrow one device, the host owner arbitrates submission/epochs/lifecycle; instances cannot independently reconfigure shared surfaces. Device submission/release has one owner. SDK borrowed-device mode declares threads, surface, external resource states/synchronization, completion, and return. Coordinate recovery after loss; effects cannot secretly obtain a second device and continue submission. Adapters explicitly identify cross-API/device copies and record their cost.

## 6. Host boundaries

Initially split hosts by environment rather than marketing platform: `web/`, `minigame/`, and `native/`. Mini-games then split by actual SDKs such as WeChat and Douyin. Meta Instant Games, Discord, and Telegram retain their own SDK lifecycles/container capabilities; resemblance to webpages does not confer desktop capabilities.

Candidate HostServices include surface/input and IME/clocks/networking and files/storage/audio/lifecycle/permissions/diagnostics. Capability profiles distinguish supported, unsupported, probe-failed, and permission-required, recording reviewed versions. API existence does not certify behavior or performance. The baseline does not depend on shared memory or background threads. Payment, social, advertising, Steam, and other distribution services are target plugins, outside the frame loop and pure rendering contracts.

A native Runtime must address VM task queues, GPU, fonts, input, audio, files, lifecycle, and debugging together. Replaceable JS VM interfaces cover modules, Promise/microtasks, ArrayBuffer, GC/external resources, and debugging without simultaneously promising every VM. Verify iOS, HarmonyOS, Android/desktop independently under actual runtime conditions; a desktop JIT baseline does not establish availability elsewhere.

## 7. Compilation and Agent engineering pipeline

Ordinary TS changes get fast transpilation/preview first; type checking runs separately and incrementally, with diagnostics tied to source versions. Resource/shader caches use input hashes, conversion-tool versions, and target profiles. Publication performs complete type, reference, capability, resource, and target-export checks. Native compilation is another task and does not block every preview that changes only UI/logic.

project's command SDK is the shared engineering interface for editor, CLI, and MCP. MCP tool discovery, input/output conversion, and permission prompts stay outside runtime game packages. Every change transaction contains version preconditions, operation scope, diffs, origins, and undo semantics. Long tasks contain taskId, query, cancel, timeout, and idempotency or explicit retry rules. New-task cancellation or late old tasks must not overwrite current versions with obsolete artifacts.

Editor playtesting uses engine's real runtime rather than another scene interpreter that only works in the editor. Edit-mode handles, selection boxes, and similar development decoration use trimmable diagnostics/overlay interfaces. Temporary playtest state writes back only through explicit application.

AI outputs natural-language suggestions, project diffs, or business TS. Verification services retain judgments on release eligibility, structure/types/references, and gameplay tests. Successful compilation cannot replace gameplay acceptance. Automatic repair must preserve unrelated functionality and remain bounded by attempts/cost.

## 8. Legacy compatibility and modern APIs

Prefer familiar semantic names over global script loading, implicit stage/singletons, or numerous dollar-prefixed internal entry points in every layer. Public TS object APIs may retain DisplayObject/DisplayObjectContainer/Sprite/Bitmap/TextField/Stage/EventDispatcher semantics; naming and module boundaries resolve ambiguity among 2D/3D/UI extensions. The API specification unifies final naming.

New projects default to ESM, explicit createEngine instances/dependencies, a familiar stage entry, and await lifecycles. Resource Lease, event on(signal), and Scope follow the [API lifecycle contract](public-api-design-and-naming.md). Signals cancel undelivered resource waits only; release/Scope handles delivered leases. removeChild only removes from the tree; dispose terminates. A familiar `import * as egret` entry may be offered, while everyday teaching prioritizes named imports; it creates no implicit global. Legacy namespace/global scripts, decorators, and event details use trimmable compat entry points or migrators, without determining the new runtime internals in reverse.

legacy is a development-time converter, not a substitute for the first release's migration objective. Temporary runtime compatibility, if needed, goes in engine's explicit `/compat` subpath. legacy project-conversion dependencies cannot enter regular game packages. Migration success must establish preservation of display/coordinate/event/clock/mask/EUI/animation semantics, resources, platform publication, and later changes. R008/V006 scope and dependencies remain.

## 9. Public APIs and extension governance

Public exports have explicit support levels: stable, experimental, internal. Default exports expose only stable/marked experimental entry points. Blanket barrel exports must not accidentally expand the ABI. internal APIs do not enter user-project serialization or documentation examples. Assess breaking changes separately by public semantics, file formats, resource contracts, and bridge protocols, not just function signatures.

Each optional module declares initialization/destruction, capability needs, asset schemas, resource budgets, and fallback. Execute registration explicitly; import side effects cannot register all renderers/VMs/fonts. Public plugins use a versioned Extension API. Native SDK and project-plugin extensions have separate contracts; do not provide generic monkey patches arbitrarily overriding engine private objects.

Public packages may share versions for early management; engine versions, project-file/resource schemas, protocols, and low-level dependency versions still pin separately. One “engine version” cannot hide every upgrade. Stable API changes provide deprecation and migration information; experimental changes are explicitly listed without unlimited compatibility promises.

## 10. Implementation order and verification

1. Fix package boundaries, contract authority, the public API inventory, and owned samples; do not first create every future provider.
2. Connect the implemented pure TS headless core to one browser backend to form a minimal independently implemented chain. Retain the third-party chain for mechanism/correctness comparison and identify implementation attribution.
3. Integrate the project SDK, import/build services, and shared editor/CLI/Agent feedback; complete multi-user/multi-Agent version conflicts and undo.
4. Add a second backend for the same scenes and verify capability/quality/recovery; complete UI, skeletal animation, 3D, and text item by item.
5. Then evaluate WASM/native modules and SDKs against actual bottlenecks. Legacy-migration specifications participate throughout; complete migration passes V006 acceptance.

Verification includes dependency DAGs/prohibited reverse references, public-export snapshots, schema/code-generation consistency, minimal 2D/mixed/native target-package composition, multiple-engine isolation, shutdown and invalid generations, old asynchronous results, device recovery, equivalent-function/image-quality comparisons, consecutive AI changes, and complete legacy migration. This document defines future gates only, without claiming these checks have run. Performance numbers, initial platforms, and team schedules remain unconfirmed.

## Related contracts and conditions not yet accepted

Related contracts: technical architecture; rendering engine and runtime; AI creation and engineering interfaces; graphics backends, compilation, and native Runtime selection; independent implementation and third-party dependency rules; current version; requirements/decision/source registers.

- D006 and D014 jointly express TS public state and narrow native-module contracts. Evaluate Rust/C++, WASM movement down the stack, the primary graphics library, and VMs against their respective evidence; no specific selection is accepted yet.
- Graphics and hosts both need low-level interfaces but must not become one package: graphics manages device execution, hosts manage platform surfaces/services, and engine assembles them; native borrowed devices are explicit adapter boundaries.
- project's edit-state authority and runtime's game-state authority are two lifecycles, not synchronized duplicate business state.
- “Complete specification” is a design-document deliverable. The first three responsibility-based packages are implemented and have passed bounded verification; see the [core framework implementation record](core-framework-implementation-record.md). Complete APIs, graphics, hosts, and CI still await implementation/acceptance; D/H and complete-product acceptance statuses remain.

## Implemented 0.13 boundaries

The actual internal DAG remains engine → runtime/contracts and runtime → contracts. DOM-free `engine/rendering` has its own ES2022 composite compiler project referencing contracts only; browser `engine/web` references it and retains separate output. robust-predicates 3.0.3 is the exact external package-root exception, not a TS project reference or a new internal package. The two browser entries remain isolated. Future graphics/hosts/native package proposals above are broader candidate architecture, not implemented directory claims. GPU buffer ownership resides in WebGPUHost; current CPU asset disposal does not establish future texture lifetime.
