# Resource loading and device recovery verification

English | [简体中文](../../Cns/docs/resource-recovery-evidence.md)

2026-10-20 · M1.5 · Verification checkpoint

## Delivery follow-up — 2026-10-21

[PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79) merged M1.5 into main `4924b471b52927184252191055f902c30c29af52`. [CI run 39455045264](https://github.com/cnedwin/Egret_rebuild/actions/runs/39455045264) qualified candidate `bd8df26a1bd268ec72b7d86a7136bf610fbe3457`: macOS CPU, Ubuntu CPU, Windows and M0 / merge-ready all completed successfully. The Windows integrated gate passed **290 publication, 4,528 core and 160 Spine F2 tests**, with zero failures, cancellations and skips in each group.

Together with independent source/result review, the seven fixed C7 recovery cases and twenty-four affected browser suites (thirty-six actual calls), this records M1.5 desktop engineering delivery. The earlier full local attempt remains FAIL; the later successful complete CI is a separate execution. The original verification cutoff and its pending states below remain historical records. Formal paired M1.2 performance, unavailable devices and the other external qualifications remain open.

## Delivered behavior and acceptance boundary

The implementation connects canonical resource manifests, dependency-aware groups, bounded byte loading and integrity checks, staged frame uploads, and generation-aware shared WebGL2/WebGPU recovery. The [contract](resource-recovery-contract.md) defines the interfaces, ownership and fixed acceptance profile. The dated follow-up above records M1.5 desktop engineering delivery; formal M1.2 performance and the external qualifications below remain separate.

The code builds on Egret's existing AssetManager, leases, capture registry and Host lifecycle. Source, tests and procedural PNG fixtures are independently authored first-party work with AI assistance, under Apache-2.0. Existing third-party dependency and font notices remain applicable. No Chromium implementation is incorporated into the engine.

## Verification snapshot — 2026-10-20

Verification cutoff: 2026-10-20, after all twenty-four planned browser suites completed thirty-six actual calls with PASS. All twenty-four suites have completed independent result review, including the final eight suites. This table records that checkpoint; delivery and merge results are recorded in the repository's [pull requests](https://github.com/cnedwin/Egret_rebuild/pulls).

| Domain | Actual result and boundary |
| --- | --- |
| Resource cancellation repair | The original controlled failures were retained. The four affected test files passed 91/91 after body cancellation was ordered before fetch abort. This covers controlled behavior and collector policy, not sustained native acceptance. |
| Public interfaces and compiler boundaries | Fourteen compiler lanes and 117 exact negative diagnostics passed. The complete retained type gate also passed at its recorded candidate. No diagnostic observation is relabelled as rendering or runtime behavior. |
| Current source admission | After the cancellation repair, all three affected resource adapters passed. The combined workflow and maintenance regression file passed 82/82, with no skipped or cancelled cases. Historical source identities remain intact. |
| Earlier browser runs | C1–C6 retain their original failure or incomplete records. C6 completed the five bounded recovery/race cases but stopped both sustained backends at the network completion assertion. Safe cleanup does not replace the missing duration and cycle coverage. |
| C7 fixed browser qualification | COMPLETE on Windows / Chrome for Testing 157.0.8103.6. All seven cases and independent saved-result review completed; C01/C02 each met 100 resource cycles, ten native losses and 30 minutes in the foreground. |
| Affected browser regression | All twenty-four suites passed thirty-six actual calls and independent result review, including atlas and the final eight suites. Each suite retains its own pixel, control, cleanup and environment boundaries. |
| Local merge-check evidence | The second complete local attempt remains FAIL. The two affected roles and previously unexecuted stages subsequently passed scoped execution and independent review, as recorded below. This composed evidence is not a fresh complete integrated pass. |
| Protected integration | Complete protected CI and final package review remain required for the M1.5 merge candidate at this cutoff. Workflow simplification was separately merged through [PR #78](https://github.com/cnedwin/Egret_rebuild/pull/78). |

## C7 sustained recovery results

On 2026-10-20, all seven fixed C7 cases completed on Windows / Chrome for Testing 157.0.8103.6 and passed independent saved-result review. C01 WebGL2 and C02 WebGPU each completed the original 100 resource cycles, ten native losses and 30-minute foreground window, with stable recorded inputs, reference-pixel, network, pressure and cleanup checks. C1–C6 retain their original failure or incomplete outcomes; this result does not qualify Edge 155.0.4283.62 or establish the unique Chromium cause of the old failure.

| Case | Cycles / losses | Foreground duration | Maximum retained recovery | Maximum reload recovery |
| --- | --- | --- | --- | --- |
| C01 WebGL2 | 100 / 10 | 1,800,005.1 ms | 773.2 ms / 2,000 ms limit | 866.5 ms / 5,000 ms limit |
| C02 WebGPU | 100 / 10 | 1,800,006.2 ms | 544.6 ms / 2,000 ms limit | 596.0 ms / 5,000 ms limit |

C03 borrowed-device recovery and C04–C07 loss/close or restore/acquire/close cases also completed. All seven recorded safe cleanup, no pending operations or cleanup errors, and zero final current logical owner counts. Independent replay checked 685 raw RGBA readbacks, 202 presentation captures and 10,672 declared reference points, plus every alpha byte. This is not full-frame RGB equivalence or physical-screen proof. All 3,637 native checks and 4,815 accounting samples supported the recorded outcomes.

Cold interaction took 4,437.0–4,609.4 ms under the original 10 Mbit/s, 80 ms conditions, below the 5 s limit. Each initial scene transferred 35,984 asset bytes; complete application JavaScript was 347,026–347,032 gzip bytes. The fixed pressure schedule exercised eviction and re-upload within declared logical budgets. The source-retention and private-residency peak evidence gaps are closed for this run. Logical cleanup does not prove physical RAM/VRAM reclamation, OS process retirement or mobile behavior.

## C6 network diagnosis

A bounded diagnostic on Edge 155.0.4283.62 reproduced the ordinary replacement failure. One HTTP 200 request was reported by CDP as ERR_ABORTED even though its source reached natural EOF, validated and published its bytes, and completed PNG loading. The full diagnostic recorded no source cancellation, reader cancellation, native abort or fetch-signal abort for that job; deliberate cancellation controls produced their expected markers. Its observer did not overflow or report an error. This excludes those covered engine cancellation paths for this reproduction, not every possible engine defect.

[Chromium issue 568852319](https://issues.chromium.org/issues/568852319/dupes) and [change 8508456](https://chromium-review.googlesource.com/c/chromium/src/+/8508456) describe a matching completed-fetch cancellation report. The exact [Chrome for Testing 157.0.8103.6 source tag](https://chromium.googlesource.com/chromium/src/+/refs/tags/157.0.8103.6/third_party/blink/renderer/platform/loader/fetch/response_body_loader.cc) contains the terminal-state ordering fix. These sources support a browser-layer explanation; the diagnostic did not instrument browser internals or establish the exact Edge patch set.

C7 used the separately identified browser above and retained its executable/version and actual results. The network completion assertion, workload, resource limits and duration remain unchanged. Neither the old failure nor a short diagnostic is converted into a pass. Different-browser timing results must not be combined into one baseline/candidate pair.

## Regression and validation-tool repairs

The first B1 run failed with HTTP 429 at its 1,197-request collector quota; the original failure and INCOMPLETE wrapper remain preserved. After the bounded quota correction, the actual B1 rerun passed. This was a collector request-budget failure, not a demonstrated rendering defect.

The first resource-scene run refused the installed Edge patch version before launching its scene, with zero recorded frames. An unchanged independent Canvas producer then reproduced all nine original font RGBA buffers and metrics exactly on Edge 155.0.4283.62. A reviewed admission successor permits that exact environment while preserving the original .45 references, pixels and tolerances. Resource-scene and prepared-groups subsequently passed their actual application runs and independent review. This does not qualify other browser versions, fonts, general CJK rendering, input methods or font performance.

The second complete local integrated attempt, `m15-full-gate-2`, remains **FAIL**, exit 1: publication checks passed 290/290; core tests reported 4,519, with 4,491 passed and 28 failed. Twenty-seven failures came from PNG controls receiving the checker's path instead of the rejected file's path. SS1 refused the older compiled Bitmap identity before registering its ten cases. Both were validation-tool compatibility failures.

The narrow repairs preserve original identities and controls. The PNG checker changes only the two incorrect diagnostic paths; SS1 adds the exact reviewed M1.5 Bitmap/SpriteSheet pair while retaining older pairs and rejecting unknown or mixed pairs. No product source or emitted product code changed in these repairs.

| Subsequent actual check | Independently reviewed result |
| --- | --- |
| PNG affected diagnostic branches | The two representative controls passed with complete baseline, assigned refusal and restoration. The original file's 19 PASS / 27 FAIL result remains; the other controls were not relabelled as newly rerun. |
| SS1 original unit cases | 10/10 passed, including thirty fresh baseline/assigned/restored children. Original operation, failure, reentry and cleanup expectations remain intact. |
| Maintenance | 82/82 named tests passed, including the four current/historical M1.5 owner controls. |
| F2 | 160/160 tests, source boundaries, strict compile and both consumer paths passed; complete negative diagnostic arrays contain 39 and 100 expected tuples. This is controlled experiment evidence. |
| Headless example | Expected event, lease and Host trace; closed/disposed objects; zero pending timers. |
| Nine-slice headless example | Two frames with preserved saved geometry, one load and one disposal, closed Scope and zero timers. Native pixels were not verified by this example. |
| Knowledge base | 225 records, 407 Markdown files, 2,595 links and 1,573 references checked, with zero issues at that recorded state. Later documentation edits require the normal final check. |

These saved focused and follow-up results have stable recorded inputs and empty stderr. They close twenty-three named local evidence roles without changing the failed aggregate into a pass. The recorder includes compiled .js and .d.ts files in its declared source/tool/test/example trees. It omits the knowledge-base tree and entries named node_modules, ending in .tsbuildinfo or containing .generated.; selected compiler and dependency owners are captured separately. Separately bound source, diagnostic and build evidence retains its stated scope rather than becoming retroactive snapshots. At that original checkpoint, a fresh complete protected CI run was still required; the later completed run is recorded in the delivery follow-up above.

## Remaining qualification

At the original verification cutoff above, all planned browser results had passed independent review, while final package source/result/bilingual review and protected merge checks were still outstanding. Those delivery requirements subsequently completed through PR #79, as recorded above. No new release version is declared here.

Formal paired M1.2 timing follows a stable M1.5 candidate. Functional checks, operation counts and C7 duration results do not substitute for that measurement. Physical RAM/VRAM reclamation, OS process retirement, phone power/thermal behavior, unavailable hosts, full Spine and complete UI remain outside this result. Each browser suite retains its own sampled-pixel or full-region boundary; the combined regression is not a general full-frame RGB equivalence claim.
