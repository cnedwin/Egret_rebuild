# Incremental frame preparation: evidence and limits

English | [中文](../../Cns/docs/incremental-frame-preparation-evidence.md)

2026-10-18 · Engineering candidate; performance acceptance remains open

## Status and implemented scope

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
