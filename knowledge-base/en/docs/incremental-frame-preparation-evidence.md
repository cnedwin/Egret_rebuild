# Incremental frame preparation: evidence and limits

English | [中文](../../Cns/docs/incremental-frame-preparation-evidence.md)

2026-10-21 · Functional delivery recorded; formal performance remains OPEN

## Current verification checkpoint — 2026-10-21

M1.2 functional engineering, M1.5 and the bounded refinement in [PR #80](https://github.com/cnedwin/Egret_rebuild/pull/80) have been delivered. The subsequent capture-record and preparation-key changes passed independent source/result review, build and 156 focused tests. Schema-6 sequence 6 completed qualification and all 30 formal timing trials; independent review confirmed the valid `FAIL_TIMING_TARGET`. Fully dirty Engine p95 is 10.3 ms against 8 ms; Host p95 of 7.7 ms leaves the preparation upper bound unestablished, without proving a pure-preparation failure. Six existing browser regression suites passed independent result review. **M1.2 and D60 formal performance remain OPEN; complete delivery gates remain pending.** E19 records these current results. The earlier sequence-5 diagnostic checkpoint, original completed schema-5 failure and interrupted schema-6 sequences retain their original evidence below.

### Earlier frozen candidate: functional checks and environment limits

Verification cutoff: 2026-10-20T19:59:54.746Z (2026-10-21 local date). The fresh recipe includes the admission reuse, corner-array removal and per-edge clipping changes alongside the earlier bounded preparation changes.

| Stage | Actual result | Scope |
| --- | --- | --- |
| Preflight | PASS; 2 trials | Both frozen SDK roles, in fixed order |
| Correctness | PASS; 6 trials | 7 paired checkpoints / 14 RGBA readbacks |
| Operation counts | PASS; 6 trials / 24 frames | 991 baseline versus 155 candidate draws per frame |
| Diagnostic | INCOMPLETE; baseline static passed, candidate static was disqualified | OS foreground qualification failed; no valid pair |
| Formal timing | NOT STARTED | All 30 trials remain unexecuted for this recipe |

Final independent review hashed every recorded artifact and enumerated input with physical-path deduplication. All nine preflight/correctness RGBA pairs were byte-identical, and all twenty-four operation traces were retallied. Safe Host closure, zero pending operations and cooperative browser/context/server closure are recorded. These are finite functional/count results; OS descendant retirement and physical GPU/memory release remain unbound.

The first attempt with this recipe had already stopped at `OBSERVER_FIRST_FOREGROUND` before any frame or readback. The separate recovery passed preflight, correctness and counts, then stopped at `OS_FOREGROUND_QUALIFICATION` during the static candidate diagnostic. Its raw observer records fifteen non-browser foreground samples between elapsed 73636.4883 and 90770.2322 ms. Native work and cleanup completed, but that does not qualify the timing samples. No budget verdict or speedup is derived from the disqualified data; sparse/full diagnostics and formal timing did not run. Both original failures, the intervening successful stages and their raw records are preserved.

### First schema-6 observations

| Stage | Actual recorded result | Boundary |
| --- | --- | --- |
| Preflight | PASS; 2 trials | The selected frozen SDK/browser pair only |
| Correctness | PASS; 6 trials, 7 matched pairs / 14 RGBA readbacks | Declared checkpoints, not every frame |
| Operation counts | PASS; 6 trials, 24 frames, 991 to 155 draws per frame | Draw reduction, not elapsed-time acceptance |
| Diagnostic | PASS_DIAGNOSTIC; 6 trials, one pair per state | Complete diagnostic execution, not five-pair formal timing |

Candidate diagnostic p95 values (ms, rounded) were: static Host 5.0 / update-through-render 7.9 / capture 3.6; sparse 6.2 / 9.7 / 4.1; full 11.2 / 15.3 / 3.4. These are individual diagnostic runs, not five-run medians; separate percentiles are not additive. A diagnostic Host value above 4 ms does not prove isolated preparation failure. Pure preparation and GPU time remain unmeasured. The runs use the frozen recipe preceding the later admission/corner changes; their results cannot be transferred to changed sources.

### Later source changes and private CPU diagnostics

The admission change passed independent source/result review: the original focused run retained 69 passes and 4 expected read-count failures; after integration, the build succeeded and six existing suites passed all 249 tests. The corner-generation refactor retained all 10 baseline characterization tests, then passed 133 tests in five existing suites after its successful build. These are controlled CPU results, not native pixel or performance acceptance.

Three separate optimized-only Node profiles each retained 212 calls, 208 complete equality checks and zero errors. All three saved output/budget records have the same complete binary identity; the first two also received independent result review. In the first two profiles, corners had 323.000 ms and 100.415 ms of inclusive sampled attribution, pooled across 160 optimized calls per profile. These are separate profiler observations, not paired performance trials or per-frame percentiles. All results are retained for comparison, affecting memory lifetime and GC; inclusive stack times overlap. They neither partition browser Host time nor establish a measured native speedup.

Per-edge contained clipping has been integrated under the existing trusted preparation boundary and independently reviewed. The original focused run retained 58 passes and 14 expected failures; after the successful build, the focused run passed all 177 tests with stable inputs. The third private CPU profile follows that change. Neither focused results nor this profile qualify native pixels or formal timing. The [contract](incremental-frame-preparation-contract.md) retains every original fee and fallback boundary.

## Completed schema-5 checkpoint — 2026-10-21

M1.2 functional engineering was delivered through [PR #74](https://github.com/cnedwin/Egret_rebuild/pull/74), main `9f899dbe92c5e4d448d3408c3dca2f4c9ade847f`. M1.5 was subsequently delivered through [PR #79](https://github.com/cnedwin/Egret_rebuild/pull/79), main `4924b471b52927184252191055f902c30c29af52`. **M1.2 formal performance acceptance remains OPEN.** The following completed checks belong to the new runs-2 sequence, bound to the prepared-3 schema-5 recipe; the original 2026-10-18 results and E1–E11 identities below remain historical evidence.

The new comparison binds the unchanged complete M1.1 reference and a stable post-M1.5 candidate to recipe schema 5. Both roles used Chrome for Testing 157.0.8103.6 on Windows, with Node 26.7.0 and Playwright/core 1.62.1. The preparation copies 450/579 non-evidence files respectively, including 139/182 source files, and separately binds two provided build-evidence files per snapshot. Original source/emission identities and build-record provenance were checked; copying these files is not an independent recompilation. The new recipe and manifest identities are recorded in E12.

| Schema-5 stage | Recorded result at this cutoff | Boundary |
| --- | --- | --- |
| Preflight | PASS; two trials, one per SDK | Execution and environment qualification for this fixed comparison |
| Correctness | PASS; six trials; seven matched RGBA pairs, fourteen full readbacks total | Static, sparse and full-update checkpoints; no all-frame pixel coverage claim |
| Operation counts | PASS; six trials, twenty-four frames; 991 baseline draws / 155 candidate draws per frame | Operation reduction, not a frame-rate or elapsed-time result |
| Diagnostic | PASS; six completed trials, one pair per state | Execution and environment qualification passed; diagnostic samples are separate from formal timing acceptance |
| Timing | COMPLETE; thirty trials; FAIL_TIMING_TARGET | Execution and environment passed; measured performance targets were not all met |

The new correctness samples match byte-for-byte across the SDKs. Sparse ordinals 0, 1, 99 and 990 share the static output hash; these samples establish paired output equivalence, not visible sparse changes or pixel coverage of every sparse frame. Full-update ordinals 0 and 1 include different output hashes. The new operation counts remain 991/155 in each of the static, sparse and full states. These results do not establish elapsed-time gains.

This completed schema-5 batch used capacity pacing under `egret.m1-2-capacity-paced/1`. Only a callback with fewer than two pending frames advances the workload. All callbacks and complete leading/interior/terminal wall-window gaps remain recorded. Admitted, stalled and closing CPU cohorts are separate; the original count-based RAF cadence remains alongside the duration-weighted wall-gap p95/p99 at 16.7/33.4 ms. Measurement coverage changes do not change the rendering API or existing CPU/native budgets.

Six diagnostic trials precede thirty timing trials: three states, five timing pairs per state, each with 30 seconds warm-up and 60 seconds measurement. Ordinary timing budget misses and unavailable comparisons remain in the fixed schedule; execution, integrity, environment, native, deadline or cleanup failures stop it. Preserve every trial and the median-of-five aggregates without selecting a faster baseline or dropping misses.

For this completed schema-5 batch, the 4 ms preparation row was assessed only through a containing timing Engine span: a role/state's median of five Engine p95 values at or below 4 ms establishes an upper bound; a larger or unavailable value does not establish preparation failure. Isolated preparation and actual GPU time remain unmeasured. Functional checks, C7 duration and reduced draw counts do not substitute for paired timing. Diagnostic and timing execution are complete. The measured targets were not all met; the actual timing aggregates are recorded below. Independent final-result review is complete with zero result-integrity findings; the failed performance targets remain unchanged.

## Completed schema-5 timing: targets not met

The runs-2 timing sequence completed all thirty scheduled trials under the unchanged prepared-3 recipe. Its result is `FAIL_TIMING_TARGET`, with runtime execution and environment qualification reported as PASS. This is a completed measurement with unmet targets, not an interrupted execution. All five trials per role/state contribute to the specified median-of-five summaries; individual successful trials do not replace those aggregates. Independent review of source/result correspondence is complete with zero result-integrity findings. It recomputed all 72 warm/measurement capacity windows and the five-trial medians, preserving every recorded miss.

The table gives medians of per-trial p95/p99 values in milliseconds. Values are displayed to four decimal places for readability; acceptance uses the unrounded records.

| State / SDK | Engine p95 | RAF p95 / p99 | Wall-gap p95 / p99 |
| --- | ---: | ---: | ---: |
| static / baseline | 20.2000 | 25.1000 / 37.5000 | 25.1000 / 46.9000 |
| static / candidate | 8.1000 | 12.6000 / 12.6000 | 11.6000 / 13.6000 |
| sparse / baseline | 19.7000 | 25.1000 / 37.3000 | 25.1000 / 44.3000 |
| sparse / candidate | 9.6000 | 16.6000 / 16.7000 | 13.2000 / 16.0000 |
| full / baseline | 19.7000 | 25.1000 / 37.5000 | 25.4000 / 47.6000 |
| full / candidate | 21.4000 | 29.2000 / 33.3000 | 25.4000 / 44.5000 |

Candidate Engine p95 medians are 8.100000023841858, 9.599999964237213 and 21.400000035762787 ms for static, sparse and full respectively; all exceed the 8 ms target. Both cadence criteria pass for candidate static and sparse. Full fails both: its count-based RAF p95 exceeds 16.7 ms, and duration-weighted wall-gap p95/p99 exceed 16.7/33.4 ms. The baseline misses the Engine and both cadence targets in all three states.

The full-dirty update-through-render p95 medians are 20.30000001192093 ms for baseline and 22.399999976158142 ms for candidate. Their recorded ratio is **1.1034482740396065**, above the **1.10** limit. The containing 4 ms preparation upper bound is unestablished (`null`) in every role/state; this is not a direct measurement or a failure verdict for isolated preparation. Isolated preparation and GPU time remain UNMEASURED, and overall D60 remains INCOMPLETE. M1.2 engineering acceptance therefore remains OPEN.

The later contained-clipping candidate is outside these frozen inputs. Its separate focused checks are recorded below and must not be attributed to this thirty-trial comparison. The original results and fixed budgets remain unchanged.

## Contained-clipping candidate: focused checks

A later candidate integrates five reviewed source changes and additions to one existing test file. Its original focused run recorded 34 passes and 10 failures out of 44 tests. After integration, the recorded build exited 0; eight existing test files then passed all 228 tests, with zero failures, cancellations or skips and stable observed inputs. These execution records are retained in E14.

These checks are separate from the completed prepared-3 / runs-2 measurement above. At this follow-up cutoff, the candidate has no completed new native or timing result in this record. Targeted test success does not establish raster equivalence, preparation-time improvement or performance acceptance; those require new evidence bound to the changed candidate.

## Preserved first schema-5 diagnostic and collector correction

The first schema-5 sequence completed baseline static diagnosis but stopped in candidate static with `SAMPLE_INVALID`. Its candidate record remains INCOMPLETE: 117 accepted samples and 187 callbacks, with no completed measurement-window end. The failure occurred after render returned and before the next sample was appended; no replacement sample or completed window was added retrospectively.

Independent review traced the rejection to an unsupported cross-API ordering assumption: a separately sampled `performance.now()` value was approximately 0.1 ms below the callback's RAF timestamp, while the CPU phase sequence and RAF's own sequence remained ordered. The repair replaces three cross-API ordering predicates with nonnegative checks, preserving each sequence's own ordering, raw values, callback/sample binding, bounds and all acceptance budgets. This is a collector correction, not evidence of a renderer failure or of unrelated browser time origins. Cooperative cleanup was complete with no recorded cleanup failures; the aggregate error label does not establish a cleanup failure.

The three new regression cases first produced 38/41. The initial correction run produced 40/41 because a test expected exact `32` instead of the actual binary floating subtraction `32.000000000000014`; using the original subtraction produced 41/41 with exit 0. These earlier results and the original failed diagnostic remain preserved in E13. The corrected tools are bound to the fresh prepared-3 recipe, and the new runs-2 diagnostic completed all six trials. Diagnostic completion and tool tests do not establish the thirty-trial timing targets.

## Original status and implemented scope — 2026-10-18

M1.2 implements incremental capture, bounded preparation reuse and adjacent batching, with the recorded correctness and lifecycle results below. **Performance acceptance remains OPEN, and the M1.2 milestone is not closed.** This record describes candidate 4 and its completed local integrated gates. It does not establish a merged release or production readiness.

The implementation preserves public capture/render signatures, frame profiles, painter order, saved-frame values, current resource qualification and submission ownership. Private revisions cover committed tree, transform, appearance, content and binding changes. Capture and Host caches retain bounded derived results; admission probes avoid repeatedly retaining changing payloads without granting cache hits. Full keys and current resource identities remain authoritative. Textured capture still performs all-tree admission on every call; no sublinear total-capture claim follows.

Compatible adjacent draws can merge, while A–B–A order, clip/material changes, empty barriers and scene/overlay boundaries remain observable. Logical admission costs are retained, required submission copies remain isolated, and accepted concatenation storage stays charged until safe retirement. The implementation adds neither texture pages nor a new rendering profile.

## Source and comparison identity

The reference is the complete M1.1 SDK at main `fa88111f5e73503e1804f92a9f444207110b773c`. Candidate 4 is a hash-bound working-tree SDK snapshot with the successful build-4 receipt, not a candidate commit or final-main claim. Its manifest is 181728 bytes, SHA-256 `783f84db7cfc56e56b957b8de3b080acfdc3e00ef9cce712feabc36678164c23`. The snapshot preserves source, emissions, configuration, dependencies and package aliases; freezing bytes does not independently prove compilation equivalence. Exact baseline and recipe identities are listed in (E1).

The revision, cache and batching code is first-party implementation against Egret's [incremental preparation contract](incremental-frame-preparation-contract.md), [M1 plan](m1-rendering-resource-plan.md) and existing [submission ownership contract](warm-submission-contract.md). The complete prior SDK supplies an independent recomputation reference. Existing dependency attribution, including robust-predicates 3.0.3, remains separate from this implementation; Node and Playwright are verification tools.

## Executed correctness and operation evidence

| Evidence | Recorded result | Boundary |
| --- | --- | --- |
| Regression set 3 | 1560 passed; zero failed, cancelled or skipped | Selected regression execution, not the final complete publication gate |
| Offline tool set 3 | 16 passed | Tool policy/recipe controls; offline set 2 retains its sandbox symlink EPERM failure |
| Controlled comparison 4 | 24 corresponding frames per SDK passed | Public capture values and ordered uploaded triangle inputs match; controlled ports, no raster or timing claim |
| Native correctness 1 | Six trials passed; 994 frames and seven full RGBA readbacks per SDK | Paired pixels at the declared sample points |
| Native counts 1 | Six trials, 24 frames total, passed | Four frames per state and SDK; actual draws 991 baseline / 155 candidate |
| WebGPU 3 | 42 fixture frames, 84 screenshots, 6808 composition checks, eight counterexamples, zero unexpected errors | Actual PASS for this bounded suite |
| Canvas 2 | Exit 0; 14 checks, required counterexample detected, zero unexpected errors | Desktop Canvas, headless; no native GPU or timing conclusion |
| B1 5 | Candidate-4 PASS: seven positive frames/five controls; 11 main submissions plus three composition submissions | Existing scene and public Engine composition domains |

These results are recorded in (E2–E8). Controlled comparison also observed 32 → 5 draws in its small fixture and 991 → 155 at scale, with equal ordered triangle inputs. Native count wrappers forwarded actual methods with their real receivers and were restored. Operation reductions do not establish elapsed-time gains or internal batch-break reasons.

## Native workload and coverage limits

The fixed scene contains 10000 logical nodes, including Stage and eight clip containers; 1000 are effectively visible, producing 991 commands and 7928 clip references. Static, deterministic 1% updates and full updates use the same baseline/candidate inputs. Correctness executes one static frame, 991 sparse frames and two full-update frames per SDK, with respectively one, four and two readbacks.

All seven paired RGBA samples match byte-for-byte. The four sparse samples, at ordinals 0, 1, 99 and 990, also have the same pixel hash as the static sample. Thus the native evidence establishes equivalence at these sampled outputs; it does not prove visible pixel changes under sparse updates or pixel coverage of all 991 sparse frames. Separate raw checks of controlled comparison 4 exclude frame IDs: static-03 → sparse-00 → 01 → 02 → 03 changes ten command translations per step in each SDK. Selected vertex streams change by 99/90/125/130 bytes respectively, while corresponding baseline/candidate streams remain equal. All selected ranges in these five frames match actual upload bytes using recorded offsets, strides and draw ranges. This proves changed controlled triangle inputs, not changed native pixels. Capture-digest differences alone remain insufficient. (E3) The full-update pair includes a changed output.

The headed comparison used Edge 155.0.4283.45, Playwright/core 1.62.1, Node 26.7.0 and Windows build 26300, with a reported nonfallback NVIDIA Blackwell adapter. CSS/backing dimensions were 1024 × 768 and explicit Host pixel ratio was 1. Actual window DPR 1.0000000298023224 was retained, stable and equal across qualified pairs under profile 2. Sampled foreground/power and cooperative cleanup records do not prove continuous visibility, unobstructed scanout, physical VRAM retirement or an exact adapter-to-driver association.

## Performance acceptance remains OPEN

Host CPU diagnostic 3 completed four ABBA trials, 192 submissions and 144 measured samples. It measures synchronous Host submission over saved frames and controlled GPU ports; updates, capture and completion are excluded. Full-update medians were 19.36755/18.69425 ms for baseline and 21.26035/21.44570 ms for candidate. The corresponding short-sample p95 values were 20.3324/20.0924 and 23.1985/23.0525 ms. With 12 measured samples per state/trial, p95 is the maximum. JIT, scheduling, retained-frame GC and controlled-port costs limit interpretation. This is directional diagnosis, not formal acceptance or a 10% decision. (E9)

Native diagnostic 1 under recipe schema 3 and diagnostic 2 under schema 4 both stopped in the first baseline static warm-up with WEBGPU_BACKPRESSURE. Both produced **zero measured samples**, no completed pair and INCOMPLETE results. Schema 3 accepted warm frames 1–3 and refused the fourth attempt. Schema 4 accepted initialization frames 1–2 and drained them, accepted warm frames 3–4, then refused the third warm attempt with two pending submissions. Cleanup completed with zero pending operations. Neither result attributes the failure to candidate changes or proves cold startup was its sole cause. (E10)

The [W3C WebGPU specification, Promise Ordering](https://www.w3.org/TR/2026/CRD-webgpu-20260915/) permits only its specified promise-order guarantees. Accordingly, a requestAnimationFrame callback does not establish that prior queue/error-scope obligations have settled. The actual cause of their delay here remains unknown.

The formal five-pair-per-state, 30-second warm-up/60-second measurement comparison remains uncompleted. Update-inclusive full-dirty p95 tolerance, CPU/frame targets and GPU timing are not passed; GPU time remains UNMEASURED. Functional delivery must retain these open criteria. The initial complete core run recorded 3916 passes and 48 failures out of 3964 tests, with no cancellations or skips. These failures concern obsolete source admissions, the retained Host identity assertion and the sequence compiler input. Their reviewed successors subsequently passed 220 focused controls. The complete integrated prepush then passed 241 publication tests, 4005 core tests and 160 Spine F2 experiment tests, with zero failures, cancellations or skips, plus build, source/type boundaries, examples and the knowledge-base check. (E11) The earlier failed record is preserved. Final review and PR/main/CI delivery status require their own records; M1.3–M1.5, full Spine and other-device acceptance remain separate.

## Receipt identities

These raw fingerprints identify the retained local execution records summarized above. Machine paths, process details and unedited logs are excluded from this reading edition. The public verifier and contract describe how to reproduce new results; a fingerprint alone is not an execution or performance proof. Recipe schemas 3 and 4, with their respective bound tool sources, remain distinct records.

| ID | Receipt | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| E1 | Candidate SDK manifest | 181728 | `783f84db7cfc56e56b957b8de3b080acfdc3e00ef9cce712feabc36678164c23` |
| E1 | Merged baseline SDK manifest | 215851 | `12cbb6aff4b01b937c4153063a0c3c65ed0de5acb78c83fd3632c9873bdaf3ff` |
| E1 | Recipe 1 (schema 3) | 11334 | `d9e385d6474a9806e7a1986463d21f04e9196164509e32fdff778ca235ac750c` |
| E1 | Recipe 2 (schema 4) | 11392 | `bad24cc71da648fb4035ccc0e498930d21a39afc598b5a0eea206c74357072a0` |
| E2 | Selected regression 3 | 176174 | `63e03b690b00528aca825f3c86c6225fd09feeeb51cc82a0c14c2d1c2c3c6d5c` |
| E2 | Tool units 3 | 1550 | `799670f79b42d8a0d2b078c475e97f5ea89446fedcc035eae7b10b74c8cf57a1` |
| E3 | Controlled comparison 4 | 18923 | `b6b6079a6504123497525941893bf9115bc9cde4e5e23f0c3a2628f4f48949cf` |
| E4 | Native correctness 1 | 10406 | `06f1b7cacc40af37aced8c9d05d3567c79a42942793d6f54d96b1e55fb22b92e` |
| E5 | Native operation counts 1 | 9473 | `4b287a0f4a8e6d1499a9ebd25f90af89fd9aeb20123fb9bcbfe3692a925a244f` |
| E6 | WebGPU 3 | 2362633 | `02e11514ad841cfc5a07d9e911a7ef028ad450e4cf1b1ee8c8e68a9892855748` |
| E7 | Canvas 2 | 3224 | `0cf4bdf090d4f1807d0f19a68d2e4caeb7572703aeade2ce75fde3fa6e8327e0` |
| E8 | B1 5 | 632174 | `83ae4902af8e70682ef8d6c6092ff56e69fd33b0b8691c7706592e134672413d` |
| E9 | Controlled Host CPU diagnostic 3 | 108280 | `d8132221f08e22e37548213d5d3d8be1b7d4e34a912dbf31ef4de8eb9c123d08` |
| E10 | Native diagnostic 1 | 2858 | `f3db70e08cdb29c940b5febd30627cac722dd2686a52473acb080f1af6a88072` |
| E10 | Native diagnostic 2 | 2858 | `d5a17d82df793fc98b5d36171da10d4a97766a3f646adc9dd518658e6846c250` |
| E11 | Complete integrated prepush 2 | 920792 | `c191130451cb7e29d644333e4e8985ef9569e304a0ab8c3b113cdb7b3cd25417` |

## Schema-5 current receipt identities — E12

E12 identifies the completed prepared-3 / runs-2 records, including the timing result with unmet targets. E13 retains the earlier incomplete diagnostic and actual correction checks; none replaces the original E1–E11 records.

| ID | Record | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| E12 | Schema-5 recipe (prepared-3) | 12051 | `ee4af29e5f66f997b23a042612e78e6e500a3a1a4ae8f37a5ee5cef60eecf863` |
| E12 | Prepared baseline SDK manifest | 182814 | `5089695dd016371c903d1f719bb2d0ec3d8dcca4bc59e0269e2dd50cca7af32a` |
| E12 | Prepared candidate SDK manifest | 223550 | `684523c1125c8b41a3036bb692f3d4c615487a96d9ab292071e0fb076c68abf0` |
| E12 | Schema-5 runs-2 preflight summary | 2775 | `5183bad52de07f6bb5e8ea7a36de36bd93a81d231c05d8f111781d2fe1e165ae` |
| E12 | Schema-5 runs-2 correctness summary | 5645 | `6603554e31de96d00bce6cce06d1faeb5a013e2a42bc664fabea47131291df6b` |
| E12 | Schema-5 runs-2 counts summary | 4743 | `191bfa281de566ea25cdfb48ccb2cdea78516ea5a882e9d1fdc5df9e79348991` |
| E12 | Schema-5 runs-2 diagnostic summary | 16403 | `f5a361c5345cd7e92aad74dbed04f2cd64360fbe6176cc28b89d22c6aca76adc` |
| E12 | Schema-5 runs-2 timing summary (FAIL_TIMING_TARGET) | 73218 | `de886f24a196fb7d1d1b2c0b99b6d4f4b5004c00c9ba89ac987b4e330a2dd5fe` |
| E12 | Independent final result review (valid complete results; targets failed) | 146712 | `72ab73497c913549acfffbbf3eca8569fe0b3bdd5372d6bd9cfc6a42eef147a2` |

## Preserved diagnostic correction records — E13

| ID | Record | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| E13 | First schema-5 diagnostic comparison (INCOMPLETE) | 89768 | `3549fc31667b3f7f702af14a8261f01a10b69b2688c139c80f996be9da89c77c` |
| E13 | First schema-5 candidate diagnostic report (SAMPLE_INVALID) | 74735 | `c1044b9134116a9c3ebd9b12f2c3f4c62124b04c63d6cb3e4f8bfd124f6e2b0f` |
| E13 | Independent clock-observation diagnosis and correction review | 21824 | `24fc7cf8e8b00c762d547b5a53d0806ca310adc1a19c5def21b20b586629f385` |
| E13 | m12-clock-red-1 (38/41) | 2018 | `002b6a742d3598743697e14e8a44ababb915d8d911abf12ae8c2594ad2be369a` |
| E13 | m12-clock-green-1 (40/41) | 2026 | `ae15d99212da819e4f43b40bbea91ca7564e41e4dbd2069ecb7a1d241840a6fa` |
| E13 | m12-clock-green-2 (41/41) | 2026 | `1eb8ab7a2e283eb5a063b5e20b7ab6f71bf65c22a1ce66112761fd8b6270673e` |

## Separate candidate check records — E14

| ID | Record | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| E14 | Contained-clipping independent source review | 10217 | `9cbbfb5141cf9fc780964a6c2194a5cf77ad3f7695e8e4e84095a41ea224591f` |
| E14 | Original focused tests: 34 passed / 10 failed | 2036 | `4954bd9e3950fe2ef8245b59478650381da48b02679715fab5a0d2a515fe2731` |
| E14 | Candidate build log | 44 | `166710cb105690b244b48c5dcc5672a4c0bc8280e995ae7d2f5bd46141491cea` |
| E14 | Candidate build exit | 2 | `9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa` |
| E14 | Eight test-file run: 228 passed | 2372 | `c7bb8a08f94ca5093ab0a0d90ecbae0ab9d8debcc8bbbe0d09ea566f657fc33f` |

## Later observation identities — E15

| Record | Bytes | SHA-256 |
| --- | ---: | --- |
| Schema-6 preflight summary | 2775 | `5fee0dafceea734f8b3ec2af1ab297782b20ce8f179b707ce00b6d986b1acc69` |
| Schema-6 correctness summary | 5645 | `de93de254af99d3acbf56b4184bae5dd077ceeb8aeddbbe9fc96246c4ae9d100` |
| Schema-6 operation-count summary | 4743 | `7e958ac32619b7781aff7f520f398294cdf90c9e6bc2a985fd3ad340cbcc02be` |
| Schema-6 diagnostic summary | 16414 | `79caa2ef006f6b4b66a423143b5a1ec4bf55fbc35291c5a375345c53795e214c` |
| Admission source/result review | 15768 | `b8f5eb1dd53a29a7b50ffa445b4bb2bccaa9991086d13a4523c377de400b73dc` |
| Corners source/result review | 9279 | `a338269013548180a868df948118283bc03f60a56714cd2927ccde9dff27a99c` |
| Second optimized-only CPU profile review | 3668 | `42729f4a7b80b5dad9575eb6afc0cfc31a46d1a6d6d40cfe83bcf53db6d27b77` |
| Per-edge source/result review | 18902 | `22751d22084d00a95124428ad35be5c32f8f28c0da6145ccded8953152e6ce10` |
| Third optimized-only CPU profile record | 114267 | `d3f37a2f385a50ebde3c40c2cef95826c20bfc43db009626cb50549e9d8235f3` |

## Latest frozen-candidate receipt identities — E16

| Record | Bytes | SHA-256 |
| --- | ---: | --- |
| Recovered preflight summary | 2775 | `722da558ad81f8c83f21959e4a5f7c31e32e04652ab9e937edb2310d4214befa` |
| Recovered correctness summary | 5645 | `ed7cb09f682fd8da5a078501ff2762eac57d50f5c0c311b62cab06db8d206562` |
| Recovered operation-count summary | 4743 | `0907312410a7a18f811afc0e7ccd029476b3a804db634812603bd8c700a96012` |
| Interrupted diagnostic summary | 4245 | `aa4a39e9d06d67ca03956d2b74cae550dae9e390a786fce10b0f0c7052946f83` |
| Final raw-result independent review | 51600 | `7431f487672e1364a6e8aaaf0e384f0f13e83a60d6fc2d8de40c4cddd4828a7b` |
| Preserved first-foreground refusal summary | 1859 | `f6f9b469bd32553c67e0186fee261008c82a92ff423b2f14db155b169a0f4077` |

## E17 — Affected desktop regression, 2026-10-21

The six existing collectors passed for the final seven-source implementation on Windows, Node 26.7.0 and Edge 155.0.4283.62. They retain their original fixtures, pixel targets, assigned controls and cleanup requirements. These are functional regression results; the schema-6 timing interruption in E16 and the historical schema-5 target failure remain unchanged.

| Collector | Verified scope | Original result identity (bytes / SHA-256) |
|---|---|---|
| Ordinary WebGPU | Fixed pixel/composition matrix and assigned controls | 2611216 / 7dee3c38e8720b5ca81c85a5d7a2d70144ed06ca90bfd9be6a82faa11ac21c5e |
| B1 scene composition | 7 positive frames, 5 counterexamples, 11 submitted frames | 835040 / 1c98c7be104d0596a7a16a86a12a6aac9d77662c1691f9d35ed4ad376e0a781d |
| Shared WebGPU | 30 cases and 11 control triples in 63 contexts | 2358374 / fa239bad565ceb07bd66f2ddd92ea56011bafcc828a48321b935826f814db81b |
| Shared WebGL2 | 30 cases and 11 control triples in 63 contexts | 2030649 / 97453cde77810eb490a6b65f2839c6af56e5b507060b64d7715c962899d19a3f |
| Textured WebGPU | 11 calibration cases, 10 held-out cases, 12 sensitive controls | 3627670 / 445032f28148480d6e288961135e1612197c757fe9c4aebf24c74c5f9c43a4f9 |
| Textured scene composition | Two frames, 24 zero-tolerance points and the original sensitivity control | 188550 / 1d8d748fc1e980022c9521475984354e439371a4290c5a86bf85135e1580f9bd |

The B1 and shared WebGPU collectors first refused stale M1.5 Host identities before browser creation; textured preparation first refused the superseded C06 source selector. Those attempts remain retained. Reviewed current successors preserve the historical identities and original mutation effects. The repaired existing tool regressions passed 58/58; the existing maintenance regression passed 86/86. No collector failure was converted into a passing pixel result.

This checkpoint records actual collector completion. Independent result review and the complete local/protected merge gates are tracked separately before delivery. These desktop functional results do not establish M1.2 elapsed-time targets, phone support, sustained recovery or independent OS-process retirement. M1.2 performance acceptance remains OPEN.

Initial complete local runs also refused outdated dependency declarations in the existing checker and isolated fixture, and one unlisted exact division expression in B1 static inspection. Those failed execution records are retained. The declarations were corrected without changing product source, parser rules, control targets or quotas. Four selected boundary controls and the complete thirteen-case B1 loading/Host slot then passed; complete local regression and protected CI remain separate delivery requirements.

## E18 — Completed diagnostics and the next bounded CPU changes, 2026-10-21

Schema-6 sequence 5 completed preflight 2/2, correctness 6/6, counts 6/6 and diagnostics 6/6. Independent review retained the frozen recipe, original inputs/artifacts, nine byte-identical RGBA pairs, twenty-four operation traces and complete raw timing/environment/cleanup records. Per-frame draw counts remain baseline 991 and candidate 155; these counts do not establish performance. The earlier sequence-4 command was refused before browser creation or any measured trial because it selected the original repository instead of the prepared snapshot; that failed attempt remains separate.

Each diagnostic state has one baseline/candidate pair, each with 30 seconds of warm-up and 60 seconds of measurement. Rounded candidate p95 observations are:

| State | Capture (ms) | Host (ms) | Continuous update-through-render (ms) |
| --- | ---: | ---: | ---: |
| Static | 3.6 | 4.8 | 7.7 |
| Exactly 1% changed | 3.9 | 5.4 | 8.7 |
| Fully dirty | 4.0 | 8.4 | 12.2 |

The last column spans update, separate fresh capture and Host; it is neither formal timing Engine p95 nor the sum of separate percentiles. Diagnostics passed their recorded environment qualification and cooperative cleanup; OS descendant/physical GPU retirement remains unbound. The thirty formal trials were not started. Host ≤ 4 ms is sufficient evidence of preparation ≤ 4 ms within the relevant measurement scope; Host > 4 ms leaves that bound unestablished, not a failed pure-preparation measurement. Required CPU admission, geometry, packing, materialization, batching and upload preparation cannot be omitted from any later direct preparation measurement. Pure preparation and actual GPU time remain unmeasured.

A separate private browser CPU sample completed candidate/static and candidate/full with the actual Engine → WebGPU Host path. Each retained the original 30/60-second workload windows and a whole-entry CDP profile covering initialization, warm-up, measurement, transfer and cleanup. Page qualification remained; this private sample did not run the formal OS foreground/power/driver observer. It is not a formal pair or timing result. Static/full capture inclusive sampled attribution was 30.734/20.354 seconds; preparation-cache slot attribution was 10.945/9.265 seconds, over whole profiles of about 90.742/90.674 seconds. Parent/child attribution overlaps and frame counts differ, so these values cannot be added or converted into p95 or expected speedup. Original profile samples, GC attribution and raw execution remain intact.

This evidence selects two limited changes: per-call capture admission/cursor reuse while preserving both actual-tree passes, and ordered complete-key scanning with immutable ready arrays and separately owned mutable probes. Hidden eligibility, current resources, error order, cache lifetime and original quotas remain required. Baseline characterizations passed 24/24 capture and 26/26 cache tests; these were passing behavior records, not RED. Both reviewed sources were then integrated, the build exited 0, and all 156 focused tests passed with stable recorded inputs and zero failures/cancellations/skips. Independent source/result review found no blockers. The sequence-5/profile inputs precede these two changes; their values do not transfer to the new implementation. New native results and formal performance measurements remain pending and will be recorded separately. No threshold, public profile or acceptance target changes.

| Record | Bytes | SHA-256 |
| --- | ---: | --- |
| Sequence 5 frozen recipe | 12096 | `cc1a02b88a81a3ef6ed838bd66cd77aa643e608ca74d74a65b7d62510f958799` |
| Sequence 5 diagnostic summary | 16200 | `aae5d35bf8f8e128350e1db1e8d90fc819bf9a812d7014647cf22afbf77b33cf` |
| Sequence 5 independent result review | 35433 | `0d85c50072ca8ac6cf7dbbaafab4f1269b08327d78772c6e0d65ff653d14f9c2` |
| Private browser CPU sampling result | 2490 | `963ade042e6b531f2e5da39784ad4ce2becf574050057d33f91e6d05998448cc` |
| Private sampling independent result review | 35891 | `d3b79b3d80d393bae06d33956329005cebb5cf9ad39ff3206ea2231dae82c861` |
| Two-source integration/focused-result review | 10043 | `b7745f1e9db127aa395e7a51a8fa25a2dce9d2df8ddcd4ab8329ba471650bbab` |

## E19 — Complete formal batch after capture and cache-key changes, 2026-10-21

Sequence 6 used the reviewed frozen two-source candidate. Preflight (2 trials), correctness (6), operation counts (6) and diagnostic timing (6) completed successfully. The separate formal batch completed all 30 trials, five baseline/candidate pairs for each state, with runtime execution and all 15 paired environment qualifications passing. Its actual result is `FAIL_TIMING_TARGET`, exit 1. No missed target was discarded, and no budget or workload changed. Independent qualification and raw timing-result reviews are complete with no integrity findings; the timing failure is valid.

The table reports the median of five per-run p95 measurements, rounded to one decimal place. The baseline is the original M1.2 baseline; this comparison does not isolate the incremental contribution of the latest two changes from the previously delivered optimizations.

| State | Baseline Engine CPU (ms) | Candidate Engine CPU (ms) | Candidate Host (ms) | CPU target ≤ 8 ms |
| --- | ---: | ---: | ---: | --- |
| Static | 19.8 | 5.0 | 2.4 | Met |
| Exactly 1% changed | 19.6 | 6.4 | 3.4 | Met |
| Fully dirty | 19.4 | 10.3 | 7.7 | Not met |

All three candidate states meet the aggregated cadence and duration-weighted wall-gap criteria. The full-dirty update-through-render ratio is 0.55224 relative to the baseline, within the unchanged 1.10 regression limit. This relative improvement does not waive the absolute CPU target: full-dirty Engine p95 remains 2.3 ms above 8 ms. Engine includes capture and synchronous Host work but excludes the separately measured update.

The containing Host span establishes preparation ≤ 4 ms for static and sparse states only. Full-dirty Host p95 of 7.7 ms leaves the preparation upper bound unestablished; it does not prove pure preparation exceeded 4 ms. Pure preparation and GPU time remain unmeasured. Desktop D60 and formal M1.2 acceptance remain OPEN. Six existing browser regression suites have completed with independent result review; complete delivery gates remain pending. No new PR or merge is claimed here.

| Public summary or independent review | Bytes | SHA-256 |
| --- | ---: | --- |
| preflight | 2775 | `0d100c759f2d9d0adf44c130d9d5026b2a50faeaf8ffdeb82d2bc5cf026701cb` |
| correctness | 5645 | `5c550c3e1e2443a51e891aff621398e5d972e7ad902d0f5367b6dd363f94284d` |
| counts | 4743 | `4771fc6f342c71ebb736c835cd9ba37539ef8bab5a30480a3dec79b6ca9c73a8` |
| diagnostic | 16198 | `a5ebaf7f10f2fc30f304ddce57f95879d266d309d5e3b624f3290867f9702eea` |
| timing | 77276 | `fca0970e723624ddb0ee3c37170da85f455c28f27a9c218ca4aa288f3a09583b` |
| Qualification independent result review | 38139 | `c85ad708dae78cb9f1232f7c5bbc853886769c87cfc7e778ad0992e766008167` |
| Formal timing independent result review | 55398 | `043b75d8e3bca126c4184a62a8d60ddff0bde2085e352ac46574469e76ed87fc` |

Six existing browser regression suites completed with exit 0 and independent saved-result review, with no open findings. The results below apply to their recorded frozen inputs and original finite pixel/refusal and cooperative-cleanup checks. Shared WebGPU/WebGL2 are additional executed regression coverage. The WebGPU verifier's supplementary synthetic assertion check and textured-scene oracle-only sensitivity check are not additional native renderer-mutation results. These functional results do not establish universal whole-frame pixel equivalence, independent OS/physical-GPU retirement, device coverage or performance acceptance. The valid sequence-6 `FAIL_TIMING_TARGET` and M1.2/D60 OPEN status are unchanged; complete delivery gates remain pending.

| Saved result or independent review | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| WebGPU verifier | PASS | 2611244 | `cd2bd9fd92b7a0b47adcfaa6c60bf19f26ea404bd8bf470cf6ed5c53268b6758` |
| B1 composition | PASS | 835040 | `6f70fe3ce40d94889bf5c76035d92609546c396be56310618c59542fe3127bb6` |
| Shared WebGPU | PASS | 2358522 | `4c42c46644ba65266e89227798444c69da94fb747a529d91ed6c4c34ad8d39f4` |
| Shared WebGL2 | PASS | 2030751 | `a2b5611d80ee9bc63c7aceb1a60c063edfb86fb4487d866f785fd7abb41eab4c` |
| Textured WebGPU history | PASS | 3633484 | `b6dc2622fa8cf7b5ae4271f82e6a3f8b352ff7adc9a5207229ceed19055c33d7` |
| Textured scene history | PASS | 188619 | `cd1ab455201319152a16e2c3d0ffe87d17f303c8cd0cf9b57aac88a49682cafd` |
| Four-suite independent result review | 0 findings | 10206 | `d929db4ed2f8143766f8dffc252ba6c0873e5b937af9f5d2b62485afd0b9a8cc` |
| Two-history-suite independent result review | 0 findings | 74500 | `83db78367e1e4a127d5eca8bbd9018aebfb9439e46ad4e7d8a9aee1b1666922e` |
