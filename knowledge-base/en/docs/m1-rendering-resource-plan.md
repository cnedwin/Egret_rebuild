# M1 rendering and resource implementation plan

English | [中文](../../Cns/docs/m1-rendering-resource-plan.md)

2026-10-18 · Revision 1 · Design and acceptance targets, not completed capabilities

## Purpose and entry

Build a reusable rendering and resource foundation for complex 2D interfaces, atlas animation and the later complete Spine adapter. Preserve familiar display, resource and game-time concepts while removing repeated preparation and GPU allocation. The baseline is main ca62c980f372683dcb156bc5c284f4036a60f4cc, engineering preview 0.61.0. The [architecture plan](architecture-and-engineering-plan.md) remains the program specification; this document defines the finite M1 work packages and their shared acceptance.

M1 engineering entry requires reproducible setup and existing behavior, active protected PR CI, controlled current-ledger integration, independently reviewed shared contracts and the scenario/measurement profile below. It does not require complete automation of every historical maintenance policy. All original full push/merge gates remain mandatory. Each changed rendering package additionally requires its affected real-browser checks.

Complete M0 community acceptance remains distinct: an uninvolved human/fork rehearsal is still open in [#52](https://github.com/cnedwin/Egret_rebuild/issues/52); unavailable devices, authorized Editor exports and distribution qualification remain tracked in [#54](https://github.com/cnedwin/Egret_rebuild/issues/54). These conditions block the corresponding support/release claims and dependent tests, not independent M1 engineering. M0 stays open until its outstanding acceptance is met. Changing this dependency is an explicit planning decision, not a retroactive pass.

## Shared design decisions

| Area | Contract for M1 and its consumers |
| --- | --- |
| Authoritative state | Display tree, Scope, leases, clock, animation state and CPU bindings remain authoritative. Rendering caches are derived; cache eviction cannot dispose a game object or borrowed lease. |
| Frame identity | Public saved frames remain immutable and replayable after later edits/disposal within their existing contract. Mutable scratch arrays never escape into them. Internal fast paths require genuine engine ownership and cannot accept lookalike objects. |
| Ordering and batching | Preserve committed tree/slot order. Merge only adjacent draws with compatible target, pipeline/material, texture, sampling, blend, clip and color state. A mask, material change or transparent interleaving is an explicit boundary. |
| Image identity | Shared immutable image/page identity and region/UV metadata are separate. Trim, rotation, logical dimensions and nine-slice retain current coordinates. A CPU image generation is distinct from a GPU device generation. |
| Materials and clipping | The new profile must represent normal/additive/multiply/screen blending, light/dark tint and ordered clip boundaries needed by the selected Spine design. M1 implements its declared shared subset; unsupported required features refuse before presentation. Complete Spine semantics are M2 acceptance. |
| Color migration | Existing encoded-premultiplied output remains a versioned compatibility profile. A linear-composition profile has separate references and explicit selection; never silently reinterpret saved frames. |
| Lifetime and memory | Account separately for CPU decoded data, resident GPU data, in-flight work, temporary upload/readback storage and retained snapshots. Reuse native resources only after all relevant queue/error-scope/map obligations settle. |
| Recovery | A stable host facade owns replaceable device sessions. Rebuild preserves Engine, Stage, Scope, game clock and CPU demand. Old-device async completions cannot enter the new generation. |
| Replacement | Existing BitmapBindingTicket.commit remains synchronous CPU binding. Device readiness, GPU submission/completion and observed image correctness use separate results; they cannot redefine old return values or error order. Queue completion does not prove physical screen presentation. |
| Dependencies | Retain the four packages and engine → runtime/contracts, runtime → contracts. Browser executors remain explicit optional entries. No new Spine dependency in the default engine and no new native SDK in M1. |

## Work packages and dependencies

Each row is a complete reviewable behavior, not a separate experiment for each helper. Supporting specifications, regression tests, browser evidence and bilingual documentation ship with their package. Later packages use the same lifetime and verification system.

| Package | Implementation and primary files | Acceptance and dependency |
| --- | --- | --- |
| M1.1 Warm GPU submission | Refactor engine/web/WebGPUHost.ts and prepareTexturedSubmission2D.ts so a qualified resident image does not require repeated pixel extraction. Add bounded completion-safe reuse of vertex/uniform buffers and bindings through focused private helpers. Keep existing full admission, error precedence, readback, B1 composition and image-cache limits. | Requires engineering entry. Same-frame warm submissions avoid redundant pixel copies/texture uploads and reuse settled native allocations. Changed pixels/geometry/alpha, concurrent frames, pressure, readback, stop/close, thrown native calls and loss retain correct pixels and ownership. Actual browser results and allocation/upload counters are separate from timing. |
| M1.2 Incremental ordered frame preparation | Refactor runtime frameCapture.ts/texturedFrameCapture.ts, display invalidation and engine preparation. Track structural/transform/appearance/resource revisions; coalesce writes; retain full recomputation as a reference. Add adjacent compatible batching without global texture sorting. | Builds on M1.1 ownership. Static, 1% changed and fully dirty scenes match the full reference, including ancestor changes, hidden/reparented nodes, bounds/hit tests, clipping and saved-frame replay. Limits cannot be bypassed through caches. Fully dirty work must not regress beyond the declared measurement tolerance. |
| M1.3 Texture pages and shared render profile | Separate immutable image pages from texture regions and GPU residence. Adapt imageProjections2D.ts, preparation/packing, ImageData2D/texture views and image/textured passes under an explicit new profile. Add bounded target reuse and complete material/clip keys. | Requires M1.2 draw ordering. Multiple regions share a page upload; trim/rotation/nine-slice and transparent edges match fixed references. No crop bleed, cross-generation reuse or retained-frame mutation. Preserve compatibility-profile references and explicit capability refusal. |
| M1.4 WebGL2 compatibility executor | Add an explicit optional browser entry consuming the shared profile and frame/resource plan. Own GL state, resource generations, shaders, framebuffer/readback and context-loss restoration inside the executor. | Requires M1.3 contracts. Shared supported fixtures agree with declared image references across WebGPU and WebGL2. Unsupported features refuse explicitly. Canvas retains its existing bounded capabilities; no mesh/filter approximation is advertised as fallback. |
| M1.5 Resource manifests, recovery and integrated acceptance | Extend project descriptors with stable IDs, source/settings/version/target identities and dependency lists; build runtime loading on existing AssetManager/leases. Add device-session reconstruction through the stable host facade, with staged uploads and readiness separate from CPU binding. Complete the integrated scene and measurement report. | Requires M1.1–M1.4. Canonical manifests are reproducible; missing/cyclic dependencies fail clearly; cancellation/replacement and late results preserve owners. Available browsers pass real loss/rebuild and pressure cycles. All M1 scenario rows have explicit results; unavailable host/device rows remain unexecuted. |

The exact private function signatures for each package are frozen in its reviewed implementation specification immediately before implementation. Public contracts are not introduced merely to facilitate testing. The first package keeps all existing public signatures; helper extraction does not create another host or lifetime authority.

## Scenario set and observations

Keep the architecture plan's U/A/X/L workload definitions. The M1 renderer workload uses U's 10,000 logical / 1,000 visible nodes and eight clip levels, with static, exactly 1% changed and fully dirty states. A small deterministic correctness scene separately combines text, atlas animation, transparent layer ordering, clipping, interaction and two-resource replacement. Both scenes use first-party generated images and explicit coordinates; record exact input/build hashes before measurement. The small scene does not substitute for the scale workload.

The 50,000-row variable-height list and complete text/IME behavior remain M3. Twenty independent full Spine instances and complete selected-version features remain M2. M1 must reserve their data/ordering/material needs and include existing bounded mesh/animation integration, without claiming those later features. The mixed X workload remains an explicitly specified subset, not the sum of all maxima.

For L, retain 100 resource/scene/cancellation cycles, ten actual loss/rebuild cycles per executable backend, and a 30-minute sustained run. Forced software faults test deterministic failure behavior; they do not substitute for real browser device/context loss. Record recoverable and terminal failures separately.

## Measurement profile and budgets

These are initial engineering acceptance targets. They are not measured results, production limits or phone capability claims. Freeze the scene version, settings and thresholds before collecting a candidate's results; any revision requires visible review and a new comparison record.

| Profile | Fixed conditions and target |
| --- | --- |
| D60 available desktop | Windows 11 build 26300; Intel Core Ultra 9 275HX; Intel Graphics driver 32.0.101.8826 and RTX 5090 Laptop driver 32.0.16.1742 were enumerated on 2026-10-18. Actual browser-selected adapter, browser version, power state and executable are recorded for each run; an enumerated GPU is not assumed selected. Use 1024 × 768 backing pixels, DPR 1, foreground, release build, no extra graphics flags. |
| D60 timing | Warm 30 s, then five 60 s runs per static/sparse/full-dirty workload. Target frame interval p95 ≤ 16.7 ms and p99 ≤ 33.4 ms; engine CPU p95 ≤ 8 ms, including rendering preparation ≤ 4 ms. GPU p95 ≤ 8 ms only when actual GPU timing is available; otherwise unmeasured. Compare the median of the five per-run p95 values and retain all runs. |
| Regression threshold | Equivalent full-dirty workload CPU p95 must not worsen by more than 10% relative to the same-machine, same-browser baseline; failed comparisons require a repair or explicit reviewed tradeoff. Correctness is mandatory regardless of speed. No blanket speedup percentage is promised. |
| Logical memory | For the fixed M1 scene: retained decoded source data ≤ 128 MiB, ready image residence ≤ 32 MiB / 256 entries until the new profile is reviewed, reusable buffer/target residence ≤ 32 MiB, in-flight upload ≤ 64 MiB and CPU temporary upload ≤ 32 MiB. Count readback and caller-retained frames separately. Existing stricter per-call limits continue to apply; these targets do not raise public limits. |
| Startup and recovery | Combined application JavaScript ≤ 1 MiB gzip excluding optional Spine and source assets; the fixed first-interaction scene asset transfer ≤ 4 MiB. Target first interaction ≤ 5 s at 10 Mbit/s and 80 ms round-trip latency, cold browser cache, with actual shaping recorded. Recovery from the observed device/context-loss callback to a fresh-generation frame whose readback matches its declared reference is ≤ 2 s with retained CPU sources and ≤ 5 s with the same shaped reload path. Record submission and queue completion separately; this timing includes readback and does not measure physical display latency. Missing shaping/recovery measurements remain unexecuted. |
| Mobile/other hosts | Android mid-range, iOS and mini-game hosts remain external acceptance rows in #54. Exact devices, content-scaled 30 Hz budgets, thermal/power and OS/browser combinations must be specified and measured before their support claims. Desktop targets never stand in for these rows. Their absence does not block desktop-independent M1 implementation. |

Record draw counts and batch-break reasons, copied/uploaded bytes, native allocations, logical residence/in-flight/temporary peaks and p50/p95/p99 CPU/frame times. Separate animation, capture, geometry, packing and upload preparation. Capture full relevant image regions with predeclared tolerances; font-region comparisons separate layout correctness from antialiasing differences. Hardware/driver/browser changes create a new baseline, not a continuation of an old speed comparison.

## Spine input and asset boundary

The M1 design reference is the already inspected external @esotericsoftware/spine-core 4.3.13, upstream revision b7beb2ccbbce667a12c02f44d070644f59b04968. The recorded 137-file tuple-tree digest is e3690c1f8fc3c2b8123bfcfe37d50d7f56878fbef8143fe5cd11d0cc97eaf0cf. This is an exact existing engineering input, not a claim that it is the latest runtime or a compatible Editor patch.

Use the [complete support requirement](spine-animation-support-and-acceptance.md) to cover import JSON/binary, bones/slots/skins/attachments, all selected-version timelines and constraints, tracks/events, clipping including applicable inverse clipping, light/dark tint, all blend modes, atlas pages and recovery. Existing programmatic F1/F2 fixtures do not establish real Editor export compatibility. Before M1.3 freezes the shared profile, derive a complete interface-requirements inventory from the pinned runtime version and map every feature to material, clipping, texture, ordering, time or resource needs. Exact authorized Editor exports, behavioral validation and applicable distribution qualification remain required before M2 product acceptance; their absence does not block M1.1. Missing inputs cannot justify narrowing the full-Spine requirement.

Spine's [official runtime guide](https://esotericsoftware.com/spine-runtimes) and [pinned source](https://github.com/EsotericSoftware/spine-runtimes/tree/b7beb2ccbbce667a12c02f44d070644f59b04968/spine-ts/spine-core) explain the semantic runtime/rendering boundary. Attribution and original license notices remain separate from Egret's first-party Apache-2.0 code. M1 neither bundles a new runtime nor establishes entitlement.

## Verification and delivery

For every package: define expected behavior and failure cases; observe meaningful regression failures before implementation; run focused and complete checks; independently review source, results and both languages; execute affected browser matrices; then use normal commit/push hooks and protected PR CI. A source review is not execution; AI review is not human onboarding.

Historical source/diagnostic records remain immutable. A changed renderer receives a reviewed current admission or versioned successor, with preserved historical reference. Buffer-pool changes relocate equivalent destruction/reentry/failure controls to actual eviction/close rather than deleting them. Do not refresh all hashes to make a gate green. If an affected verifier cannot admit the new behavior, migrate that verifier as part of the same behavior package and validate its refusal cases.

The PR records the base/candidate, measured scope, failures/repairs and final main tree. No release package or public website is implied. M1 closes only when all its required executable rows pass; unavailable platforms remain unaccepted. M2/M3 and complete production readiness are separate milestones.
