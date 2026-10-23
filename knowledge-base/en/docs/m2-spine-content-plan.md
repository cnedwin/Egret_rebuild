# M2: Complete Spine and the content pipeline

English | [简体中文](../../Cns/docs/m2-spine-content-plan.md)

Plan with implementation status · 2026-10-23 · Complete milestone acceptance remains open.

M2.1 now has a first source-to-build implementation for PNG, a finite single-page atlas profile and sequences, with persistent cache and project adoption. See the [content build contract](content-build-pipeline.md) for current scope and evidence. Full Spine/font/variant acceptance remains open; the existing eleven work packages are retained.

## Outcome and entry conditions

M2 delivers reusable content builds and a separately enabled Spine integration: import authorized JSON/binary exports and multipage atlases, create independent animated instances, compose them with Egret graphics, and replace/recover their resources without losing gameplay state. Complete support means all applicable features of an explicitly selected version, on explicitly verified backends and hosts.

The first qualification target is the stable 4.3 series. Existing Core 4.3.13 is the first reproducible candidate, not an assertion of the latest published package or an accepted product dependency. Freeze the exact editor/export version, runtime package/commit/digest and fixture rights in M2.1. A 4.2 adapter and older legacy versions receive their own later compatibility rows; changing a version string is never migration.

M1 provides functional rendering, leases, manifests and recovery. Its valid formal performance failure remains open; merging M2 functionality cannot turn that result green. Interface design, importer work and focused implementation can advance independently, while M1 performance and M2's own scenario budgets remain explicit integration/release conditions.

M2 does not implement the complete visual workbench, AI agent platform, legacy-project migration, a native SDK or full 3D character animation. It supplies their asset, diagnostic and playback interfaces. M3 may proceed once these shared interfaces are reviewed; M4 owns the combined core acceptance.

## What exists and what changes

These are source observations, not newly executed tests.

| Existing implementation | Keep | Required change |
| --- | --- | --- |
| `packages/project/src/spine/preflight.ts:831` and `packages/project/src/spine/types.ts:22` | Original strict JSON/atlas planning, spans and declared provenance | A separately versioned product importer adds binary and complete feature qualification. Preserve the old planner's partial/not-run semantics. |
| `knowledge-base/experiments/spine-f2-core/src/resources.ts:409`, `knowledge-base/experiments/spine-f2-core/src/instance.ts:128`, `knowledge-base/experiments/spine-f2-core/src/geometry.ts:26` | Ownership, rollback, copied geometry and original reference fixtures | Replace the experimental product boundary: two instances, one page/command, white tint, manual absolute sampling and `Physics.none` are not product limits. Do not promote the experiment by renaming it. |
| `packages/contracts/src/ResourceManifest.ts:5` and `packages/project/src/resources/manifest.ts:40` | IDs, dependency keys, versions, canonical settings and provenance | Produce real import artifacts, reverse dependencies, target variants and an incremental build cache. Metadata description alone is not an asset build. |
| `packages/runtime/src/AssetManager.ts:15`, `packages/runtime/src/AssetLease.ts`, `packages/runtime/src/Scope.ts`; `packages/engine/src/manifestAssetGroup.ts:167` | Shared acquisition, lease/Scope ownership, dependency expansion and fair priority queues | Add typed skeleton/atlas providers and stage-specific capacity accounting; extend existing scheduling rather than adding a second asset manager. |
| `packages/engine/web/ManifestByteSource.ts:11`, `packages/engine/web/BrowserTextureProvider.ts:231` | Byte verification, cancellation ordering, late settlement and current PNG behavior | Generalize transport/decoder registration for admitted artifacts. The concrete PNG implementation remains a supported provider. |
| `packages/contracts/src/SharedMaterial2D.ts:5`, `packages/contracts/src/SharedRenderFrame2D.ts:12`; `packages/runtime/src/sharedFrameCapture.ts` | Ordered shared commands, two-color data, page references and backend ownership | Qualify Spine color/blend semantics explicitly; add only missing versioned representation. Current rectangular clips and mip level zero are not complete Spine/texture acceptance. |
| `packages/engine/src/Engine.ts:215,389`, `packages/engine/src/bitmapBindingTicket.ts`, `packages/engine/web/sharedDeviceSession.ts` | Existing Bitmap ticket semantics and generation recovery | Add animation-aware replacement participants without changing the existing synchronous Bitmap commit contract. |
| `packages/engine/src/gameClockTypes.ts:23`, `packages/runtime/src/SequencePlayer.ts` | Explicit clock and existing absolute sequence sampling | Add player controls, finite repeats, markers and orchestration without one shared sampling algorithm for Spine/Tween/sequences. |

The four-package dependency direction remains intact. A proposed optional `@egret/spine` package depends on public Egret contracts/engine interfaces and the explicitly selected official Core; the default engine never depends on it. Project/build tools do not enter the runtime dependency graph. Package separation is justified here by the third-party license, bundle and version boundary.

## Architecture and decisions

### 1. Build once, load typed artifacts

The content path is source files → typed importer → immutable artifact/dependency records → existing manifest admission → typed providers/leases → instances → Engine-owned captured graphics. Asset IDs are stable project identities; build keys include source bytes, importer/tool versions, settings, target profile and dependency keys. Runtime identity also includes the realized artifact and representation.

Preserve original `.spine` projects when supplied, JSON/binary exports, atlas metadata and source images; derived artifacts are rebuildable. An Egret project remains editable without treating an exported skeleton as the original authoring project. No importer modifies an original to repair an incompatibility.

M2.1 produces image, atlas, sequence, Spine and font-manifest artifacts. Ordinary images decode to an explicit reference representation; packed/trimmed/rotated pages preserve logical dimensions and sampling. Mips, edge extrusion and optional KTX2/Basis target variants require a pinned encoder and exact Host capability profile. An unsupported compressed variant selects a declared compatible artifact or produces a build error; it never silently changes filtering or colors. Third-party encoder selection remains a recorded qualification decision.

Store reverse dependencies and content-addressed outputs. Identical supported inputs/tools/settings/targets must reproduce the same canonical manifest and deterministic artifact bytes. Exclude or explicitly classify variable encoder metadata. A changed atlas page invalidates only dependent artifacts; a changed runtime compatibility series invalidates its skeleton imports. Publish cache-miss reasons, not a new global fingerprint workflow.

### 2. Official semantics, independent Egret integration

Use the official semantic runtime through a version adapter. Independently implement Egret loading, ownership, scheduling, command conversion, presentation, diagnostics and recovery. Reimplementing all pose/constraint/mixing algorithms is rejected: it creates a second compatibility project without evidence of an advantage. A separate Spine canvas/player is also rejected because it cannot satisfy one ordered UI/scene composition.

Shared assets privately retain skeleton setup data and atlas/page mappings. Treat upstream mutable data objects as immutable after qualification; instance skin combinations must not mutate shared skins. Each instance owns pose, attachments, tracks, mixing, constraints/physics state, event queue and subscriptions. Upstream objects and pooled arrays never become public frame or asset authority.

Advance semantic state using the existing GameClock or an explicit caller tick, once per tick. Render sampling does not advance it. Suppressing invisible rendering may reduce geometry work but must not drop required events or change constraint state. Visibility policies and animation-detail scaling remain explicit, measurable choices.

The initial playback profile is concrete and versioned; these defaults are work limits, not measured performance claims:

- Each accepted tick carries an increasing identity and nonnegative elapsed game time. Duplicate/reentrant ticks are rejected before mutation. Rate defaults to 1; rate 0 pauses, finite positive rates are supported, and negative rates require explicit backward seek. Resume starts from the current game-clock baseline and does not infer background wall time.
- Physics-bearing instances advance in segments of at most 1/60 second, with a final shorter segment to reach the exact target. Preserve the selected runtime's authored constraint settings and internal solver steps; the adapter segment is not a replacement for them. The default maximum is eight segments per advance. Oversized advances return a diagnostic before commitment; callers may schedule explicit bounded catch-up, never silently discard time.
- Seek defaults to suppressing gameplay events. Physics seek stages a private instance from setup state at time zero and replays the recorded track/skin/transform commands using the same segment rule. A complete qualified checkpoint may later accelerate this path; a shallow pose copy cannot. Default seek limits are 120 segments per scheduler slice and 3,600 total segments. Beyond the admitted history or budget, reject without replacing visible state. Cancellation discards the staged instance.
- Explicit event replay is forward-only over `(oldTime, newTime]`, follows the selected runtime's queue order including loop/track transitions, and defaults to at most 1,024 events per request. Backward seek never reverses gameplay events. Publish a replay batch only after the seek succeeds; a budget miss is a diagnostic, not partial event delivery.
- Dispatch the committed event queue after advancement, before UI layout. Callback-triggered animation mutations apply at the next advancement boundary; disposal immediately suppresses later callbacks for that instance. Report listener exceptions through the existing error path without replaying already delivered events or rolling back committed time. Hidden instances advance by default; disabling visual work does not disable required events or physics.

The instance policy records these limits at construction. Applications may choose different positive bounded limits through an explicit profile; changes require equivalent reference tests and cannot weaken a published support row. No hidden RAF/timer loop is added.

### Advance failure and staged-operation contract

M2.2 owns the following state and publication rules; M2.1 checks the selected upstream runtime against them. Validate tick identity, elapsed time and admitted segment limits before ordinary advancement. Ordinary advancement mutates one instance; it does not clone the complete skeleton/physics state every frame to promise general rollback. On an unexpected mid-advance failure, mark that instance faulted, suppress the uncommitted event batch and new geometry, and retain only its last successfully published visual snapshot. Faulted instances reject further advancement until explicitly rebuilt from admitted history or reset by the application; report that mutable semantic state was not rolled back. Other instances and the game clock continue. Previously delivered events remain delivered, and retained frames remain immutable. Listener errors after commitment keep the separate existing listener-error policy.

Seek and resource replacement use private candidates and keep the active instance untouched until success. Geometry publication is a separate commit domain: failed allocation/conversion never publishes a partial frame or silently rolls back already committed animation time/events. M2.3 defines the diagnostic and retained-snapshot behavior for that failure; M2.4 verifies it together with resource replacement. A whole-instance fault and a graphics publication failure must not be reported as the same state.

Replay history includes ordered track/mix, skin/attachment, rate, root transform and admitted external constraint/physics inputs with game-time/tick identity. Unsupported direct upstream mutations invalidate replay eligibility. History has an explicit byte/command bound; eviction moves the earliest reconstructible point only when a qualified complete checkpoint exists, otherwise seeks requiring lost history are refused. No unbounded command log or inferred wall-clock input is allowed. The package records exact limits before exposing replay APIs; the existing segment/event limits still apply.

Acceptance adds a genuine mid-advance fault, prevalidation refusal, geometry-publication failure after semantic commitment, event-listener failure, cancelled candidate and missing-history seek. Assert each instance state, old/new snapshot, time and event outcome; verify unaffected instances still advance. Fixed ordinary updates must show that complete instance cloning is not part of the hot path. These are behavioral/allocation checks, not performance acceptance.

### 3. One graphics path, with explicit compatibility

Prefer the selected official renderer-core output, where qualified, to resolve Spine-authored mesh deformation and clipping, including inverse clipping. Copy its evaluated triangles/page references/colors into Egret-owned ordered geometry. Do not approximate a Spine clip by the existing rectangular clip chain. M2.1 must demonstrate complete feature coverage of that output API; an uncovered feature triggers a specific adapter/protocol design, not assumed support.

This avoids inventing a general GPU stencil framework merely to import Spine. Egret independently handles parent UI clips, material conversion, submission, caching and GPU lifetimes. Existing rectangle UI clipping stays valid; richer UI masks belong to M3's shared clipping interface. A Spine slot boundary and adjacent UI elements retain authored order; batching only merges adjacent compatible items.

Map normal/additive/multiply/screen, light/dark tint, atlas PMA/straight alpha and color spaces to explicit equations and references. Existing `add-preserve`/`multiply-factor` names do not prove Spine equivalence. Keep shared-frame/1 pixels unchanged; add a versioned profile only if needed for exact authored compatibility. Never silently reinterpret all assets through a new gamma or alpha convention.

Both WebGPU and WebGL2 consume the same admitted draw data and preserve the same reference results. Canvas remains its declared basic profile and refuses unsupported required features before publication. Geometry publication is transactional and copied or exclusively owned; frame replay cannot observe upstream buffer reuse. GPU buffers/pages are generation-owned and retired by the existing Host completion rules.

### 4. Replacement and recovery preserve the running game

Use existing dependency groups to prepare a candidate asset set. Network, decoding, semantic construction and GPU readiness have separate counters and bounded queues. Cancelling one consumer releases only its demand; completion or cancellation is charged until the actual operation settles.

An animation replacement stages resources and semantic state, validates required names/skins/tracks and device generation, then commits bindings at one frame boundary after all participants are ready. Failure leaves the old presentation/state intact. Policy must specify whether compatible playback position is preserved or explicitly reset; a missing target animation cannot silently select another.

Device recovery reconstructs only device-owned state. Preserve instance clocks, tracks, skin choices and consumed event positions. Old-generation work cannot publish into a new generation. Asset replacement and device recovery use different generation tokens, and both must match at commit. GPU residency alone never authorizes a CPU scene update.

## Target interfaces — proposed, not existing exports

Names below define collaboration boundaries; implementation may refine type details through the normal review. No executable scaffold is introduced.

| Target interface | Input and output | Ownership/error rule |
| --- | --- | --- |
| `ContentImporter.analyze` / `build` | Typed source set, target/settings, pinned tools → diagnostics, dependency graph and artifact descriptors | Build environment owns source access/output storage. Runtime receives data, never filesystem handles or compiler callbacks. |
| `SpineCompatibilityProfile` | Export series/patch, runtime identity, supported feature inventory, render requirements and asset references | A data record is not proof of license, successful parsing or frame authority. Exact qualification produces the admitted artifact. |
| `SpineAsset` / `SpineInstance` | `AssetRef<SpineAsset>` plus Scope → independent instance with display facade, playback and event controls | Asset manager owns shared data/page leases; instance Scope owns state/subscriptions. Disposing one instance cannot unload another's pages. |
| `advance(tick)` / `seek(request)` | Clock tick or explicit seek policy → committed pose/event transition | Reject reentry and invalid time before mutation; dispatch queued events with documented failure/disposal semantics. |
| Version-adapter draw conversion | Qualified instance output → bounded Egret-owned ordered draw data | No renderer/runtime pool references escape; limits fail before partial geometry publication. This is private integration, not a structural public-frame constructor. |
| `AnimationReplacement` participant | Candidate asset/instance state plus existing resource transaction → ready/commit/abort | Engine validates genuine owner and both resource/device generations. Existing Bitmap tickets keep their meaning. |

M2.1 freezes artifact/diagnostic interfaces. M2.2 and M2.3 agree the draw/instance boundary before parallel implementation. M3 consumes asset IDs, intrinsic bounds, explicit hit shapes, clocks/events and replacement notifications; it does not inspect Spine internals. M4 consumes the same real examples and support matrix, not a new demo implementation.

## Four collaborative work packages

### M2.1 — Reproducible content builds and Spine qualification

**Deliverable:** build/import pipeline with dependency invalidation and target variants; complete first-version feature/rights/reference inventory; actionable JSON/binary/multipage diagnostics. Reuse project/resources, project/atlas and project/spine boundaries; add only a reviewed optional importer integration.

**Dependencies:** M1 manifest/resource functional foundation. Generic importer and corpus-specification work can start; licensed authoring/export and runtime distribution decisions remain external acceptance inputs.

**Acceptance:** unchanged builds reproduce admitted manifests/artifacts; cache hits and selective invalidation are demonstrated; malformed/cyclic/missing/hash-mismatched inputs and cancelled builds preserve usable projects. JSON and binary fixtures cover the selected export version; atlas trim/rotation/PMA/mips and selected target variants have reference outputs. Every selected-version feature has an owned fixture, exact expected behavior and host/backend row; missing rights or fixtures stay blocked, never passed.

### M2.2 — Independent instances and complete playback

**Deliverable:** optional product adapter with shared typed assets, per-instance pose/skin/track/physics state, complete selected-version semantics, clock/event/seek controls and resource retirement. Extend sequence playback controls in the same time model, while retaining its original sampling API.

**Dependencies:** M2.1's admitted artifacts/version/rights and agreed public lifetime interfaces. Rendering can initially use a deterministic recording sink; that proves semantics only.

**Acceptance:** exact event/attachment/track ordering and selected-version constraints/timelines match independent authored expectations; two instances sharing data diverge without interference; skin combinations, interruption, pause/rate/seek, finite repeats and callback disposal behave as specified. Cancellation, late loads, failed construction and last-lease release leave no live instance/subscription leak. The old F1/F2 cases remain regressions, not the completeness corpus.

### M2.3 — Complete ordered Spine graphics

**Deliverable:** first-party conversion into the shared rendering path, versioned color/sampling decisions, all required attachment/clipping/tint/blend behavior, multipage reuse and ordinary UI/limited-3D interleaving on WebGPU and WebGL2.

**Dependencies:** M2.1 feature/reference inventory and M2.2 draw/instance interface freeze; it can proceed alongside M2.2 after that boundary is stable. Qualified official Core remains an explicit dependency.

**Acceptance:** required feature references run on each selected backend; exact discrete draw order and declared numerical/pixel tolerances pass, with intentional wrong tint/blend/page/clip/order controls. Include transparency, negative scales, high DPI, rotated/trimmed pages, retained-frame replay and late disposal. Missing a feature blocks the corresponding complete-support row; a separate canvas overlay cannot satisfy it.

### M2.4 — Content lifecycle and animation scenario acceptance

**Deliverable:** scene-level asset replacement/recovery integration and one editable animation/outfit example using 20 independent Spine instances with shared multipage assets plus 200 sequence instances, with the separate precise feature fixtures retained.

**Dependencies:** M2.1–M2.3. Uses current display/UI primitives; does not wait for M3's complete component set. M3/M4 later reuse the scenario rather than rebuild it.

**Acceptance:** independent tracks/skins, outfit changes, cancel/retry, compatible hot replacement and device loss preserve state/events and exact owner counts. Show cold/warm loads, incremental content builds, CPU animation/capture/preparation and allocation/resource trends separately. Freeze scene complexity/device/budgets before measurement; do not compare against a reduced-feature old renderer. Targeted recovery runs cover new animation ownership; long mixed-device release acceptance remains M4. All applicable required M2 matrix rows must pass before calling the selected profile complete.

## Community contribution and verification

Keep issue #56 as the M2 parent and retain its existing four child work packages (#83–#86). Each issue has a behavior deliverable, interface dependencies, source areas, reference assets, focused reproduction, reviewer and explicit external blockers. A contributor can own pipeline tooling, playback, rendering or fixture authoring without maintaining global ledgers. Subtasks inside an issue are checklists, not a proliferation of standalone tickets.

Use the existing entry commands: `pnpm setup:dev`, `pnpm check:quick`, then `node tools/check-incremental.mjs --base origin/main`. The proposed importer/player APIs above are not available commands. Final merge retains independent review, the existing complete merge checks, bilingual documentation, source/asset notices and affected real-browser evidence. Do not repeat unrelated C7/legacy suites merely because a barrel transitively imports an unchanged helper.

Separate feature correctness, measured performance, host qualification and publication. Share one immutable actual build/result across the work package's dependent checks; do not manufacture role-specific successes or require each contributor to reproduce a full milestone. Evidence against the same semantic runtime is not independent proof of that runtime's animation algorithms: authored event/pose expectations and external reference images remain necessary.

## Official sources and open decisions

Checked 2026-10-21; upstream descriptions are not Egret test results.

- [Spine versioning](https://esotericsoftware.com/spine-versioning): export and runtime major/minor must match; package-specific patch versions are distinct from Editor patches. Freeze exact identities rather than a floating latest selector.
- [4.3 API reference](https://esotericsoftware.com/spine-api-reference): current documentation includes physics, draw-order folders and inverse/convex clipping. Derive the complete feature matrix from the selected release, not just this example list.
- [Official TypeScript runtime](https://github.com/EsotericSoftware/spine-runtimes/blob/4.3/spine-ts/README.md) and [Core package manifest](https://github.com/EsotericSoftware/spine-runtimes/blob/4.3/spine-ts/spine-core/package.json): semantic Core and rendering integrations are distinct; the inspected manifest says 4.3.13. This is not an npm-registry latest-version check.
- [Runtime architecture](https://esotericsoftware.com/spine-runtime-architecture): shared setup data and independent mutable instances support the proposed ownership split.
- [Runtime license](https://esotericsoftware.com/spine-runtimes-license) and [Editor license, section 2](https://esotericsoftware.com/spine-editor-license#s2): Spine is not Apache-2.0. Integration/distribution and toolkit-user obligations apply; optional packaging does not waive them. Preserve notices and establish the project's actual integration/distribution entitlement. Runtime rights and fixture redistribution rights are separate. No license entitlement is established by this design.

Remaining qualification belongs to the responsible package: exact release/export corpus and distribution basis (M2.1); licensed source fixtures and independent references (M2.1–M2.3); compressed-format/encoder profiles and reproducibility boundary (M2.1/M2.3); the specified playback/seek profile against the selected Core (M2.2); exact Spine color equivalence in the shared profile (M2.3); declared hardware and equivalent-workload budgets (M2.4/M4). Contributors can advance unrelated qualified work without inventing these answers.

The existing [complete Spine requirement](spine-animation-support-and-acceptance.md) remains the product scope reference.
