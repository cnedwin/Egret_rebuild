# Shared rendering implementation and verification

English | [中文](../../Cns/docs/shared-rendering-evidence.md)

2026-10-18 05:08:50 UTC cutoff · M1.3 · Complete local push gates pass; remaining legacy native runs and protected integration pending

## Capability

The opt-in `egret.shared-frame2d/1` profile combines immutable image pages, logical texture regions, two-color materials and ordered display capture. Several regions can share one canonical page upload. Trim, quarter turns, nine-slice and explicit isolation boundaries retain their authored coordinates and painter order. The shared Host uses the existing Engine, Scope, lease, submission and cleanup authorities.

`createSharedWebGPUHost` is exported from `@egret/engine/webgpu`. The optional `createSharedSceneWebGPUHost` at `@egret/engine/webgpu/scene3d` composes the finite opaque B1 scene with shared UI and one final resolve. Its output must be explicitly opaque. The ordinary shared 2D Host also supports premultiplied canvas output. Existing encoded-color profiles keep their own interpretation and references.

The [contract](shared-render-profile-contract.md) specifies the exact sampling domains, color recipe, blend modes, limits and unsupported cases. Shared rendering does not add complete Spine, general 3D materials, device recovery or WebGL2 execution; those remain separate packages in the [M1 plan](m1-rendering-resource-plan.md).

## Recorded verification

| Layer | Actual result and meaning |
| --- | --- |
| Build | Fixed TypeScript 7.0.2 build passes after the recorded type and shader-source repairs. TypeScript does not compile WGSL. |
| Focused checks | All 100 tests across seven shared test files pass: CPU inputs, entry identity, capture and budgets, metadata retention, controlled GPU behavior and reference data. Controlled GPU ports do not execute shaders. |
| Shared strict consumers | Positive compilation has zero diagnostics; the unsuppressed negative consumer reproduces all 24 recorded location/code tuples. These checks do not replace the older strict consumers. |
| Complete strict replay | The fifth complete `tools/check-types.mjs` replay exits 0 with recorded inputs unchanged. Historical diagnostic inventories remain intact under the finite current source/declaration successors. |
| Compiler-input controls | One owned Windows x64 fixture passes exactly six entry calls: one healthy baseline, four separately assigned raw-input refusals and one healthy restored run. The four inputs are the compiler launcher, executable resolver, native package metadata and native executable. Each mutation is restored before the next; this is not four independent baseline runs. |
| Reference data | All 30 case inputs are reconstructed against the fixed scalar reference: 321 named points, 299 color points, 22 coverage-only points, 1,236 channel comparisons and 104 bleed checks. This reuses the scalar color oracle, so it is not a second independent color implementation. |
| Native pixels | All 30 positive cases pass the original Q0–Q3 tolerances. Each of 11 source-bound wrong models has a fresh healthy baseline, an observed assigned-channel failure and a healthy restored run: 63 native runs in total. |
| Ownership | Every completed native run records Host close, device destruction and settled loss, with no pending actors or cleanup failures. This establishes the recorded lifecycle, not independent operating-system process retirement or physical GPU memory usage. |
| PNG identity controls | One owned fixture completes six entry calls: one healthy five-lane baseline, two single-file raw drifts, two genuine old/current mixed Texture identities, and one healthy five-lane restored run. All four assigned identity refusals pass and are restored before the next call; this is not four baseline runs. |
| Older browser profiles | Six earlier CURRENT results are retained within their original scopes: Canvas, ordinary WebGPU, B1, text, hit-test and desktop primary-mouse input. Their limitations remain as described below. |
| Complete local push gates | The second integrated run passes publication 251/251, core 4,145/4,145 and F2 160/160, with zero failures, cancellations or skips. Build, all boundaries, complete strict replay including the five PNG lanes, headless examples and knowledge-base checks also pass; recorded inputs are unchanged before and after. |
| Remaining delivery | Fifteen of the 21 legacy browser suites still require their native runs. The six retained results do not expand their original domains. Protected PR/Main integration remains pending at this cutoff. M1.2 formal performance acceptance remains OPEN. |

Shared-profile native execution used Node 26.7.0, Playwright/core 1.62.1 and default headless Edge 155.0.4283.45, without additional graphics flags. The selected adapter reported NVIDIA/Blackwell; its device and description fields were empty and the fallback flag was unreported (null). The canvas was 256 × 256, explicit Host ratio 1 and observed browser DPR 1. Sources, emissions, declarations, compiler/build configuration and fixture/tool inputs were bound before execution and verified unchanged afterward: 128 served modules and 394 retained inputs. This does not identify an exact GPU model or qualify other adapters.

Each run retains RGBA bytes and black/white-background PNGs before cleanup. Numeric acceptance uses the raw readback; screenshots add visual context. The finite schedule covers endpoints and alpha, linear sampling, two-color tint, trimmed/rotated regions, nine-slice, address modes, five blend modes, painter order, linear B1/UI composition and selected power-of-two/non-power-of-two page sizes. The [contract's matrix](shared-render-profile-contract.md#reproducible-finite-native-matrix) states the exact scope. It does not certify arbitrary textures, all overlapping layer counts, ICC/physical displays, phones, sustained performance or complete Spine.

The retained native result is 2314942 bytes, SHA-256 `59d4236e78feb706acd5be52ff3b75e13389cf8e8093cd4d3eb302a7213da698`. Raw receipts remain outside the published repository because they contain local execution details; the public tools and first-party generated input catalog reproduce the declared schedule. The frozen catalog's original pending-status field describes its pre-execution reference snapshot and is not rewritten as a test result.

The retained older-profile results include 14 Canvas checks and an assigned overlap refusal; text and hit-test each complete six windows/contexts. Ordinary WebGPU passes 42 frames, 1,709 raw checks, 6,808 composition checks and eight counterexamples (seven native, one synthetic), with 84 positive screenshots and zero unexpected errors. B1 passes seven positive frames and five counterexamples, plus the public-Engine composition supplement with two positives and one assigned control. Desktop primary-mouse input passes one baseline and six assigned controls within its two-generation Canvas adapter subset. These results do not qualify mobile input, arbitrary UI or independent operating-system retirement.

Canvas has weaker original input evidence: it retained collector, wrapper and matrix pins, but no contemporaneous complete source/served-module inventory. A later unchanged-module comparison is corroboration, not a replacement for that missing Canvas-run inventory. The other retained results keep their own recorded input and served-module boundaries.

The complete local run lasted from 04:54:38 to 05:08:50 UTC on 2026-10-18. Its retained result is 1998 bytes, SHA-256 `695834682f0737ed95e85ff91eb2ba7edbf7a050b3237bf1e7983e7a271f470f`. Knowledge-base verification reports 225 records, 399 Markdown files, 2,551 links, 1,573 references and zero issues. This evidence update follows the tested snapshot; it does not claim that later documentation or delivery changes were included in that run. Subsequent protected-PR and Main delivery outcomes are recorded in the associated PR and [#55](https://github.com/cnedwin/Egret_rebuild/issues/55).

## Failures and repairs

Independent source review found that a target created before retention registration could lose its ownership and pending charge when destruction-method capture failed. The public G15 control reproduced a pending-color charge of 0 instead of 256 bytes. Preallocated raw-owner slots now retain the returned texture before external method access; ownership transfers only after registration and lease recording. Unknown cleanup retains the record and charge and is not retried. The same control passes after the repair; the original failure is preserved.

The first native run failed during startup because the resolve shader used WGSL's reserved word `target`. Renaming the declaration and its load reference to `workingTexture` fixed compilation. The complete second run passed with unchanged reference pixels and tolerances. Build and controlled-port success alone had not exposed this native compilation failure.

The first full-core attempt reported 4,087 tests: 3,740 pass and 347 fail. Of the failures, 328 contained Windows directory-link permission errors; the other 19 required finite updates to old interface, graph or source-identity admission. This attempt is not a passing regression result. Historical snapshots and diagnostic inventories remain intact while reviewed current successors admit the new architecture. The later passing replay does not replace this failed record.

The second full-core attempt reports 4,145 tests: 4,131 pass and 14 fail. Twelve failures came from three old admission-fixture assumptions: the current Host identity, a missing synthetic Mesh import target, and the newly admitted shared B1 dynamic edge. After finite test-only repairs, all 12 focused cases pass, including the original assigned refusals. No product or checker rule changed for these repairs.

The other two failures report complete raw/Git inventory differences during an overlapping strict replay. Temporary generated type files provide a concrete race mechanism, but the exact transient filename at either failure was not retained. Both original ownership controls pass when rerun serially, with their inventory and restoration checks unchanged. Whole-repository generators, compiler/build tasks and core checks are therefore scheduled serially so inventory checks observe a stable repository; this preserves the complete checks rather than filtering generated names. The failed full-core record is preserved; the second integrated push-gate run subsequently completes the full core serially with all 4,145 tests passing.

The publication suite reports 250 tests, 249 pass and one failure: an isolated diagnostic-projection fixture omitted the current successor context. After supplying explicit legacy and current contexts, both focused cases pass with the original namespace, byte-drift, sibling and suffix refusals retained. The later complete integrated run passes all 251 publication tests.

The first integrated push-gate attempt passes publication, build, boundaries and the complete type entry, then fails the separate PNG strict gate before full core starts. Adding Texture view metadata changes one complete TS2740 diagnostic tuple among the PNG negative lane's 32 tuples. The repair preserves the frozen historical JSON and selects that single current tuple only under an exact registered Texture source/declaration pair. Single-file drift and either genuine old/current mixed pair are refused before compilation; the other tuples and all five lanes retain their checks. The six-call identity control and the complete second push-gate run pass. This local successor does not add a new claim of complete PNG compiler-input closure.

## Collector compatibility follow-up

This update records a separate tooling check completed on 2026-10-18 at 06:39:00 UTC. The earlier 05:08:50 UTC full-gate cutoff and its results remain unchanged.

The mixed-scene collector now admits exactly the Host's two literal B1 dependencies, with both importer and target paths checked. Missing, duplicate, unrelated-target and different-importer dynamic edges are refused. SequencePlayer, SequencePlayback and SpriteSheet collectors explicitly admit a complete dual-backend union of up to 256 modules and report the same bound; the shared helper's 128-module default and 4 MiB emitted-byte limit remain unchanged. Source counterparts and all transitive dependencies remain in the sealed inventory.

All 16 historical-browser tooling tests pass with stable recorded inputs. The actual current mixed-scene closure contains 127 modules; each sequence/SpriteSheet union contains 129. Controlled fixtures verify the original default refusal, acceptance at 256 modules, refusal at 257 modules and refusal above 4 MiB, with a healthy baseline and restoration around each assigned mutation. These checks read emitted SDK files as inert source bytes and do not execute the SDK or launch a browser. They establish collector admission and reporting consistency, while subsequent browser results and complete delivery gates retain separate acceptance.

A source-only inspection also identified older module and lazy-import assumptions in the separate warm-submission collector; its current-build self-test and native performance acceptance remain unverified by this follow-up.

## Reproduce and contribute

`node tools/build.mjs`

`node tools/shared-render-types.mjs`

`node tools/shared-rendering/check-native-cases.mjs`

`node tools/browser-verify.mjs --suite shared-webgpu --playwright <absolute-installed-playwright-package> --output <absolute-fresh-directory-outside-repository>`

Run on the selected toolchain with the installed dependency owner and a new private output directory. No browser download or permissive graphics flag is required. Input/cleanup uncertainty is INCOMPLETE; an actual numeric mismatch is FAIL. A wrong model succeeds as a control only through its assigned numeric failure, never through an exception or startup failure.

The implementation and fixtures are independently authored first-party Apache-2.0 work with AI assistance and separate source review. Existing third-party dependencies and notices are retained. Available desktop evidence does not close the human/fork rehearsal in [#52](https://github.com/cnedwin/Egret_rebuild/issues/52) or device/asset qualifications in [#54](https://github.com/cnedwin/Egret_rebuild/issues/54).
