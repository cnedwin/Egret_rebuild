# WebGL2 executor implementation and verification

English | [简体中文](../../Cns/docs/webgl2-executor-evidence.md)

2026-10-18 · M1.4 evidence draft · Finite native results independently reviewed; complete gates and delivery pending

## Implemented capability and scope

The explicit `@egret/engine/webgl2` entry exports `createSharedWebGL2Host` and nine erased types. The explicit `@egret/engine/webgl2/scene3d` entry exports the fixed `createSharedSceneWebGL2Host` alias and two erased types. Default Engine and Canvas entries load no WebGL2 module. These Hosts consume the existing genuine shared frames, image/page identity and fixed scene values; Engine, Stage, Scope, assets, leases and clock remain shared authorities.

The [contract](webgl2-executor-contract.md) specifies the ordered admission chain, exact GL state/color recipe, whole-record arenas, bounded PBO/fence retirement, generation tokens, readiness and context restoration. Shared storage and retention internals were extracted with the original WebGPU wrapper behavior preserved. The implementation exposes no custom shaders, native objects, caller scene plugin or general backend registry.

M1.4 starts from the M1.3 delivery at main `10a37d9dfdeb8762eced73577282127d1c4e4bde`, [PR #75](https://github.com/cnedwin/Egret_rebuild/pull/75). The [M1 plan](m1-rendering-resource-plan.md) retains M1.5 unified sessions/manifests/sustained recovery and M1.2 formal timing as separate work. Neither a safe close, a ready Host nor fewer operations proves those targets.

## Recorded results at this cutoff

| Layer | Observed result and evidence boundary |
| --- | --- |
| Source and build | Final lifecycle repair builds successfully. Independent finite source review reports no open findings for the accepted G18–G20 repair scope. Source inspection does not prove native behavior. |
| Retention and storage | Recorded retention regression selection 82/82, separate final ledger units 9/9, and storage selection 57/57 pass. These scopes overlap and must not be added together. Inert allocation/CPU units establish logical ownership and ordering, not VRAM or native cleanup. |
| WebGL2 controlled behavior | Final controlled selection 29/29 passes, including eight option/arena CPU units. Genuine SDK captures use owned canvas/GL/event ports; these controls do not rasterize. |
| Public strict consumers | Actual TypeScript 7.0.2 positive consumer has zero diagnostics; the negative consumer reproduces all 26 unsuppressed location/code tuples. All 24 original shared-render tuples and their source bytes remain unchanged. This focused replay is separate from the complete type entry. |
| Source boundary | Recorded focused boundary check passes 627 inspected files. Later publication additions and the complete final gate still require current checks. |
| Raw native prerequisite | The second qualified run passes its exact storage, transfer, orientation and real loss/restoration checks. It is a raw GL prerequisite, not SDK acceptance. |
| Earlier SDK smoke | Four cases / 43 points / 172 channels passed on their recorded older Host emission. The result is retained as historical smoke evidence, not applied to the final repaired source. |
| Private complete pixel matrix | 63 fresh contexts pass the fixed 30-case / 321-point / 1,236-channel / 104-bleed matrix and eleven assigned native controls. Independent result review approves this finite domain. |
| Public pixel successor | The standalone public entry's second invocation records PASS with the same 63 contexts and all fixed counts, no errors or cleanup failures. Independent result read-back approves this finite pixel/control domain. |
| Finite native lifetime/depth/state | Four contexts record PASS: six raw arrays, 24 exact endpoint points and 96 zero-tolerance channels. They exercise immediate submissions/readback, dirty-state reset, fixed B1 depth, one real loss/saved replay and one close-before-restore race. Independent result read-back approves the private result. The public lifetime successor also records PASS with the same counts and independent approval; all six arrays are byte-identical to the private result. |
| Existing-backend regressions | Current shared WebGPU, Canvas, WebGPU and B1 commands exited 0. Saved shared WebGPU reports 63 contexts / 30 cases / 11 controls; WebGPU reports 42 frames / 1,709 raw checks / 8 counterexamples; B1 reports 7 positive frames / 5 counterexamples / 11 submitted frames. Independent regression read-back approves each recorded domain, with the retained limits below. |
| Complete gates and delivery | Final full code/publication/type/knowledge-base checks, prepush, protected PR/CI/main delivery are pending. No M1.4 delivery or release is claimed. |

The WebGL2 SDK runs above use Node 26.7.0, Playwright 1.62.1, default headless Edge 155.0.4283.62, DPR 1 and no additional graphics flags. Earlier raw qualification used a separately recorded Edge version. The recorded generic vendor/renderer are WebKit / WebKit WebGL, with Chromium WebGL2, GLSL ES 3, alignment 256 and sRGB. No unmasked selected GPU identity is established; OS inventory alone cannot identify it. The WebGL2 SDK canvases are 256 × 256. These runs do not establish the separate timing profile or a cross-version timing comparison.

Canvas review covers 14 recorded checks, the expected no-op control and three decoded PNGs; its older collector retains no separate raw RGBA. The WebGPU eight-counterexample count includes seven actual native mutants and one synthetic cached-byte control. Its six native probes include an expected unsafe controlled-device-destroy outcome; not all cleanup outcomes are safe. B1 additionally retains two composition positives and one composition control; its independent OS descendant-retirement status remains UNBOUND. These limits remain even though the commands exit 0 and their finite results are accepted.

## Fixed references and result identities

The pixel collector retains the original shared scalar reference and all fixed Q0–Q3 thresholds. Thirty primary cases contain 299 color points and 22 coverage-only points. The eleven controls each require a new healthy baseline, the predeclared numeric channel failure and a healthy restored context. No startup exception or representation-only failure substitutes for the assigned numerical witness. Across all 63 private contexts, the retained observations contain 684 points and 2,688 scored channels.

The independently reviewed private result preserves all 201 referenced artifact byte identities, 63 matching per-context JSON receipts, 342 closure inputs and 106 served module identities/edges. Its 6,629 requests all return HTTP 200. All 305 texture owners are disposed once, with no pending actors, diagnostics, unexpected context events or remaining charges. Browser/server cleanup and final input/artifact stability are recorded.

| Retained result | Bytes | SHA-256 |
| --- | ---: | --- |
| Private full30 result | 1,999,667 | `939827c08e33dce0c83e9d063f01d6045a8959015a7b88860fbbb5eef36974bd` |
| Public full30 result, second invocation | 2,000,028 | `49cdb6d51891e9ddbdf3ef464a06017d79fbae28dc88f6ffced613332a7cf7cc` |
| Private finite lifetime result | 121,953 | `96c92b45ebda08863beb8dc3b61e2f822148c86c4150c90f3fd0fe0a4c51bfb9` |
| Public finite lifetime result | 121,941 | `9108738b96bd3d3082cf7d9c36f068c517f1c347e06b3f6a8b2e03f26a4c3cca` |
| Actual 26-tuple strict inventory | 6,319 | `4029dc80d2943bd709dcb5d07a3eb2c61dc270cf5e5e0fa21d518f085f1c744a` |

These identities distinguish retained observations from later runs; a matching hash alone is not behavioral acceptance. The ordinary final Host source is `91ec2fd22e4c7f357c0ddbf19299a5f9d7c43b853b8128c94cd9ee1d4ee7b966`; its reviewed emission is `7a48a8f1048d7d65845d723c10879c14a54eb8aaf6a4701ce8c527a5c260b72b`. Future source/emission changes require a separately qualified evidence relationship.

## Preserved failures and repairs

The first raw qualification was INCOMPLETE: restoration was requested from the loss-event microtask before dispatch completed. The reviewed repair moves that request to the next event-loop task with the original deadline and references unchanged. Its second run passes; the first remains preserved.

The first SDK smoke attempt could not launch Edge under the initial filesystem sandbox and ran no cases. Normal installed-browser access executed the identical reviewed script successfully. The public full30 entry's first invocation omitted required CLI arguments and was rejected before browser creation; its complete second invocation is a distinct retained result.

Controlled regressions exposed lifetime and ownership gaps: closing/loss races, fallible owner retirement, fixed-object detach, backing-size validation, pending admission, recovery-attempt deadlines, unknown-create accounting and completion-proof loss. Final G18–G20 regressions specifically exposed skipped remaining close owners/listeners, retained fixed handles after partial restoration, and confirmed loss being relabelled unknown. Separate cleanup steps, per-generation field reset and preservation of confirmed invalidation repair those cases. Earlier RED logs and the bounded termination of a stuck poller remain preserved.

The first complete integrated gate stopped in six compiler-maintenance source-admission checks after the main type entry gained its WebGL2 checker import. A separate exact successor now preserves all historical source identities and proves that removing this single 43-byte final import recreates the complete reviewed M1.3 predecessor. The focused maintenance suite passes 67/67, including a fresh complete baseline before each assigned byte-drift refusal. The original failed gate remains preserved; this focused result does not substitute for the next complete gate.

2026-10-19 follow-up: the second complete integrated gate passed all 264 publication tests, build and the general package boundary, then stopped at the SpriteSheet guard for the changed engine package identity. The subsequent bounded diagnosis also exposed exact export-map and shared-helper graph identities in the remaining legacy adapters. Both failed runs remain preserved.

The finite successor admits only the two explicit engine export additions, `./webgl2` and `./webgl2/scene3d`, with their exact declaration/JavaScript targets. Removing those entries reconstructs the complete historical 1,567-byte package from the current 1,799-byte package. The boundary source draft preserves every historical inventory and authenticates the whole predecessor graph before selecting six replaced and 33 added source/emission identities. For each module in the table, the three identities are `packages/engine/web/<module>.ts`, `packages/engine/dist/web/<module>.js` and `packages/engine/dist/web/<module>.d.ts`.

| Fixed identity group | Modules | Count |
| --- | --- | ---: |
| Replacements | `prepareSharedSubmission2D`, `webgpuRetentionPool` | 6 |
| Additions | `sharedRetentionLedger`, `sharedSubmissionStorage2D`, `sharedWebGL2Arena`, `sharedWebGL2Options`, `sharedWebGL2Scene`, `sharedWebGL2Shaders`, `webgl2`, `WebGL2Host`, `webgl2Native`, `webgl2Scene3d`, `webgl2Types` | 33 |

Actual compiler observations retain all 246 prior input identities. The 28 retained lanes reproduce the same 231 historical tuples under the existing ticket-root projection, with unchanged repository and native declaration-closure membership; the five PNG lanes also retain their original diagnostics. The strict repair qualifies only the exact package projection and helper-bootstrap source successors, preserving the historical inventories and inline policy spans. Actual main type replay, PNG strict replay and three fresh-baseline package refusal controls all exit 0; the controls pass 3/3 with zero skips and stable inputs. These results establish strict/source refusals, not new rendering or performance acceptance.

At this follow-up cutoff, the repaired legacy boundary checks and the next complete integrated gate remain pending. Protected PR/CI/main delivery remains pending. Later passing results must be recorded separately before either status changes.

The original N10 row-normalization control was re-pinned to the final repaired Host emission before execution. Its unique loop replacement, asymmetric A00 red witness, correct/wrong reference, zero tolerance and delta 255 were unchanged. The other ten control records and mutant bytes were unchanged. This is a recorded source successor, not a change to the oracle.

2026-10-19 follow-up: the third complete integrated gate passed all 266 publication tests, build, source boundaries and strict consumers, then failed in the core tests: 4,207 reported tests, 3,919 passes and 288 failures (286 leaf failures and two failed parent tests). The three fixture integration causes were an incomplete synthetic optional-entry baseline, duplicate WebGL2 Host identity in the copied project fixture, and PNG package projection displacing the original dependency-drift refusal. Finite repairs complete the inert facades and fixed closure, extend the existing module-identity bridge to the WebGL2 Host and preserve diagnostic order, and retain all historical assertions, inventories and pins. The engine implementation is unchanged; the failed gate and intermediate missing-atlas baseline remain preserved.

At this cutoff, the complete project-boundary, PNG-boundary and publication-maintenance test files pass 161/161, and the three selected canonical main-fixture baselines pass 3/3, with stable inputs. A separate, independently reviewed replay of the previously unreached tail passes F2 160/160, both headless examples and knowledge-base validation (225 records, 403 Markdown files, 2,579 links, 1,573 references, zero issues). These distinct results do not constitute a complete gate pass. The complete main boundary test file, the next full integrated gate and protected PR/CI/main delivery remain pending at this recorded cutoff.

## Reproduction and remaining acceptance

Use the documented pinned toolchain and built packages. The focused public declaration check is `node tools/shared-webgl2-types.mjs`. The two native tools use installed Playwright and fresh absolute output directories outside repository/dependency owners:

    node tools/verify-shared-webgl2.mjs --playwright <absolute-installed-playwright-directory> --channel msedge --output <absolute-fresh-pixel-output>
    node tools/verify-shared-webgl2-lifetime.mjs --playwright <absolute-installed-playwright-directory> --channel msedge --output <absolute-fresh-lifetime-output>

The first entry owns the fixed pixel/assigned-control matrix. The second owns the separate finite lifetime/depth/state schedule; its public successor has a separately retained, independently reviewed passing result. Product cleanup never manufactures native loss; the lifetime fixture uses the browser's actual `WEBGL_lose_context` extension and treats unavailable genuine loss/restoration as INCOMPLETE. Extra proposed wrong-depth/state mutation margins were not executed and receive no acceptance credit.

Finish current complete checks, final integrated review and protected delivery before closing M1.4. One recovered generation and one close race do not establish two-second recovered pixels, five-second staged reload, ten loss cycles, a thirty-minute run, physical memory, frame-time performance, phone/cross-device support or complete Spine R020/V020. The existing human/fork and device/asset gaps in [#52](https://github.com/cnedwin/Egret_rebuild/issues/52) and [#54](https://github.com/cnedwin/Egret_rebuild/issues/54) remain separate.

Implementation, fixtures, GLSL and documentation are independently authored first-party Apache-2.0 work with AI assistance and separate source/result review. Existing package dependencies and third-party notices remain unchanged. Critical implementation comments are English; paired documents carry the same scope, measured counts, failures and pending boundaries.
