# Experimental WebGPU image residency: evidence and limits

English | [简体中文](../../Cns/docs/gpu-image-residency-evidence.md) · [Contract](gpu-image-residency-contract.md)

Engineering preview **0.61.0** adds an internal image cache with per-Host ownership and exact-crop reuse. No public API, package entry, option, dependency or Host protocol changes. Workspace packages remain private **0.0.0**; Host protocol remains **1.0**. The accepted evidence below establishes the selected source and controlled ownership/budget behavior. It does not establish the new cache's complete Native pixel matrix or device performance.

## Recorded evidence domains

| Domain | Actual result and boundary |
| --- | --- |
| Host source and assigned control | Independent review accepts the selected internal Host implementation, its exact assigned mechanism copy and corrected collector at the controlled-unit scope. Public Host declarations remain byte-identical. This is not whole-branch or browser acceptance. |
| Public behavior/lifecycle suite | A complete healthy run and a complete source-restored run each pass the same **110/110 cases**, with failed/cancelled/skipped/todo all **0**. These are two executions of 110 cases, not 220 distinct cases. |
| Budget sensitivity witness | The assigned retirement-only directory-eviction mechanism reaches the intended ready-resource callback and admits a legal nested submission, producing logical **Q=33555432**, **1000 bytes over 33554432**. The healthy and restored witnesses refuse that nested synchronous submission with existing `WEBGPU_REENTRANT`, create no new image and remain within budget. |
| Restoration and saved results | Independent result review accepts the complete before/assigned/restored sequence with zero open findings in that scope. The complete executed assigned input is preserved separately; the restored owner equals the healthy selected input. |
| Retained strict/source/lifetime checks | Independent review accepts the twelve-file successor and its focused results: ordinary lifetime successors 2/2, strict checks passed with the original 7 negative and 4 import-negative compiler tuples retained, and exact source-pair controls accepted. Complete fourteen-stage integration remains pending. |
| Selected existing desktop regressions | Independently accepted finite saved results for atlas-import Canvas/WebGPU and combined textured-scene. Atlas compares four full frames/6144 channels; combined compares 24 pixels/96 channels across two frames, all with zero differences. Retained buffers and comparison domains remain distinct; optional atlas-frame replay was not run at this source. |
| Other historical desktop schedules | Base/B1/textured, SpriteSheet/playback, other PNG routes, resource slots, resource scenes and prepared groups are **NOT_RUN_AT_CURRENT_SOURCE** at this cutoff. Their historical passes do not accept the current Host. |
| New cache-specific Native matrix | The dedicated collector and new six-context/24-primary-readback matrix are **deferred and OPEN**. Designed scenes and planned readbacks supply no acceptance credit. |
| Final publication and delivery | Paired-document review, complete normal prepush, committed-snapshot push hook, actual commit/push/PR/Main and remote CI remain pending at this authoring cutoff. No future count, hash or delivery result is inferred. |

The normal full verification contains fourteen stages; this page records no final run outcome before it exists. Source acceptance, saved unit-result acceptance, current retained gates, literal browser observations and repository delivery remain separate evidence domains.

The initial focused run recorded 179/180 passes and one failure from an obsolete idle-destruction expectation. A narrow successor corrected that expectation and passed the two ordinary lifetime cases; strict and source-pair results were accepted separately. No final 180/180 or complete normal-gate pass is inferred.

## Controlled behavior and the budget counterexample

The permanent tests consume built public entries with a controlled device. They exercise identity/crop/Host separation, repeated use, pin ownership, concurrent completion and collision, logical capacity and deterministic eviction, original admission refusals, reentrant native operations, stop/failure/close and pending work. They are controlled specification/ownership tests rather than real GPU execution. Reproduction selects `tests/gpu-image-residency.test.mjs` and `tests/gpu-image-residency-lifecycle.test.mjs` through the normal Node test runner after a normal build; another source tree requires new results.

The independent witness starts with **256 genuine ready entries**: seven 4 MiB crops and 249 distinct 4-byte crops. Two readers, a small cold submission and a nested 4 MiB frame meet the original projection admission limit. Their literal total projection is **29361128 bytes**, below 33554432; that input calculation is separate from measured fixture allocation Q and is not a private Host counter.

The assigned copy restores one rejected mechanism: directory pressure is handled by ready-resource eviction during retirement rather than synchronous submission. It removes submission's directory eviction and restores retirement's corresponding eviction as one reviewed semantic control. The fixture and oracle remain unchanged. The resulting target callback occurs while the victim is still charged; a nested legal frame is accepted before that cleanup returns and exceeds the image pool.

| Witness | Target phase | Nested result | New image | Q peak | Final serial / close / Q |
| --- | --- | --- | ---: | ---: | --- |
| Healthy before | Submission | `WEBGPU_REENTRANT` | 0 | 29361124 | 259 / safe / 0 |
| Assigned mechanism | Retirement | Accepted; returned `undefined` | 1 | **33555432** | 260 / safe / 0 |
| Source-restored after normal build | Submission | `WEBGPU_REENTRANT` | 0 | 29361124 | 259 / safe / 0 |

The assigned collector intentionally records the entire trace before adjudication and exits 0. Its over-budget result is semantic RED, not a process/setup/import failure. It actually reaches the intended retirement callback and records nested admission, serial advancement and new allocation. Safe eventual close does not erase the earlier budget violation.

Both healthy witness files are byte-identical and include complete safe cleanup to Q=0. Their aggregate lifecycle counts and final zero do not independently prove per-resource exactly-once cleanup: the saved trace lacks per-resource identifiers. Accepted ownership source and permanent public object-counter cases provide separate supporting evidence. Q is calculated from real returned controlled image descriptors and retains each charge through destroy callback entry until normal return; it is not physical VRAM.

The selected healthy/restored source identity is `WebGPUHost.ts`, **92002 bytes**, SHA256 `d3d75dbdb3e1fe906301344e06ac25275189e8f7fe481abff1b98563f9fc832a`. Its emitted Host JavaScript is **85885 bytes**, SHA256 `6287b56f10c6899c12dc6a05a0b40f188c74e22f1b92e4c55dae9f80d29d834b`. The unchanged Host declaration is **4489 bytes**, SHA256 `3901c425c45da83e0a4331ea3945e318335abd78798dd3da6f3ea8be9b802576`. These identify the accepted unit source, not a future final release tree.

## Accepted finite desktop regressions

The selected existing schedules passed independent source and saved-result review: atlas-import Canvas and WebGPU each retained two complete 24×16 RGBA frames, and combined textured-scene retained two 64×64 RGBA buffers. Together they provide six readbacks and 38912 retained bytes. Atlas compares all 6144 channels across its four frames at tolerance zero, with no differences. Combined compares 12 literal pixels per frame: 24 pixels/96 channels at tolerance zero, with no differences. Its complete buffers are retained, but whole-frame equality is not claimed.

Combined preserves the same genuine image and view/crop keys across safe idle and the second presentation's changed UI order. This is source-grounded warm-consumption regression evidence, without Native cache-hit, image-create or upload counters. Atlas reuses the same genuine image with different crops A=(0,0,2,3) and B=(3,0,2,3); it is a sequential different-crop regression rather than saved-frame replay. CHNC01 rejects one intentionally wrong pixel expectation using retained bytes and adds zero Native frames.

The saved runs report no unexpected browser, rendering or cleanup errors. Original asynchronous work settled; recorded Host pending counters reached zero and WebGPU close was safe. Page/context/browser/server cooperative API cleanup is accepted. Physical resource reclamation, the actual channel-launched executable identity and OS descendant retirement remain unbound.

The recorded environment is Node 24.19.0, Windows x64, Edge 155.0.4283.45 and Playwright 1.62.1, using the msedge channel without caller-added flags. These finite schedules do not accept the new dedicated cache matrix or the historical schedules not rerun at this source.

## Evidence limits and remaining work

Independent result review accepts the saved execution and normal source-restoration/build sequence with zero open findings in that scope. Original witnesses and process records are preserved. The source identities above bind that unit cutoff; the permanent public tests provide its controlled-behavior reproduction route.

An inherited manual timer case establishes close-timeout authority by explicitly invoking its controlled callback. It does **not** establish an actual elapsed 17 ms or a device deadline. This evidence qualification remains deferred separately and supplies no timing measurement.

Implementation, fixtures and documentation are first-party, Codex-assisted work under Apache-2.0, extending the existing Host/ledger/resource/projection infrastructure. Existing research, dependencies and their notices retain the attribution in [source records](https://github.com/cnedwin/Egret_rebuild/blob/main/source-origin.json). This change introduces no new runtime dependency.

Physical GPU memory, driver reclamation, frame time, speed, power, heat, target phones, cross-browser/GPU behavior and actual device-loss recovery remain unverified. The new cache-specific Native matrix remains OPEN. Full UI/P04, complete Spine R020/V020, complete 3D, production hosts and migration R008/V006 remain separate work. Passing controlled tests or retained regressions cannot close those obligations.
