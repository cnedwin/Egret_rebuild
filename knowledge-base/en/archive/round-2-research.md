# Second-round research record

English | [简体中文](../../Cns/archive/第二轮研究.md)

Historical research from October 8, 2026. This consolidated record retains the original research/plan, execution and independent audit in order. Statements, dates, results, failures and limitations describe those checkpoints; consolidation on October 10, 2026 adds no experiment or product acceptance. Raw evidence and source snapshots remain at their original shared locations.

[Research / plan](#research) · [Execution](#execution) · [Independent audit](#audit) · [Knowledge base](../README.md)

<a id="research"></a>

## Second Round Validation Plan

Version: 0.1 · Date: October 8, 2026. R011 requires continuing incremental research, validation, and design. This round addresses gaps identified by the first audit. Outputs are inspectable research programs, actual results, and design revisions. Production engine selection, first hosts, and numeric budgets are not finally approved.

[First-round audit](round-1-research.md#audit) · [Technical white paper](../docs/technical-white-paper.md) · [Product requirements](../docs/product-requirements.md) · [Engineering plan](../docs/engineering-plan.md)

### Questions, methods, and boundaries

| Research question | Experimental method and counterexample | Possible conclusion and limits |
| --- | --- | --- |
| How to preserve cross-boundary must-deliver events after graphics-mirror recovery | Separate event stream, outbox, watermarks, ACK loss/retransmission/reordering/backpressure; use the former graphics-only recovery strategy as a missed-event counterexample | In-memory acceptance, ordering, deduplication, and recovery contract; without durable transactions, no guarantee of exactly-once effects after process crashes |
| Whether batching truly preserves shared state | Compare a full per-command reference with independent execution by batch headers; deliberately ignore clip/pipeline for pixel counterexamples; then perform real WebGL geometry batching/readback | Correctness for limited materials, rectangles, and blending modes; not arbitrary masks, filters, skeleton attachments, or all backends |
| Whether nested invalidation can stop propagation while staying correct | Fixed/content-adaptive sizes, insert/delete, reparenting, hiding, ancestor dimensions/world coordinates; compare with independent full source-tree calculation and hit testing | Explicit layout semantics and operation counts; text-measurement fixtures do not establish real shaping/IME, and workload is not a speedup |
| How CPU data and GPU residency recover independently | Independent lease per acquisition, separate decode/upload, device generations, late tasks, fences, failures, asynchronous reupload; use the old owner Set strategy as a counterexample | Deterministic state-machine contract; scheduled asynchronous completion remains simulated, not proof of GPU drivers, thread races, or performance |
| Whether local contracts can enter one graphics experiment | Procedural 3D mesh plus multilayer UI, rectangular clipping, simple two-segment skeleton, and image sequences; specified frames/pixel checks | Bounded behavior in one local WebGL2 experiment; not complete characters/asset import, complex animation, editor, or target-host acceptance |

### Execution and quality gates

1. Retain the complete 0.2.0 knowledge base and raw-evidence snapshot, checking each previous verification digest.
2. Run three independent state/layout experiments in parallel; keep separate implementations/results for batching and graphics, checking shared contracts and versions during integration.
3. For each group, first record failing counterexamples demonstrating incorrect strategies, then run the corrected model. Record environment, inputs, tolerance, actual counts, source SHA256, and uncovered areas.
4. Independent reviewers check that counterexamples detect real errors, references are independent, recovery preserves semantics, and conclusions stay within scope. Correct and revalidate problems that directly break contracts first.
5. After integration, rerun local experiments and match results to source digests. Update the three design documents, sources, and delivery register consistently, then verify knowledge-base structure.

The first devices and hosts remain undecided. Local research can proceed, but this round cannot substitute for phone energy use, complete-engine performance, or compatibility across mini-game hosts. R008 one-click legacy migration continues to inform interface and behavioral design; full-delivery dependencies remain unchanged.

<a id="execution"></a>

## Second Round Validation Record

Version: 0.2 research record · Executed: October 8, 2026 · Knowledge base 0.3.0. This round adds contracts and actual mixed-graphics experiments expressly excluded from round one. Four current CPU programs pass 64 main checks; the browser program passes seven. The 71 include counterexamples and boundary characterization; passing does not mean every characterized risk is resolved.

[Technical white paper](../docs/technical-white-paper.md) · [Product requirements](../docs/product-requirements.md) · [Engineering plan](../docs/engineering-plan.md) · [Second-round audit](round-2-research.md#audit) · [Original plan](round-2-research.md#research) · [First-round historical record](round-1-research.md#execution)

### Actual results and boundaries

| Evidence | Main result | Actual execution | Still unproven |
| --- | --- | --- | --- |
| S018 must-deliver events | 13 passes/0 failures | Single-instance in-memory outbox, watermarks, retransmission/deduplication, gaps/backpressure separated from graphics rebuilding; actual effects array as side effects | Real IPC, durable transactions, no repeats after process crashes, one-time external-service effects |
| S019 asynchronous resources | 25 passes/0 failures | Independent leases per acquire, shared tasks, separate CPU decode/GPU upload, cancellation/late failure, explicit device generations/completion fences | Actual drivers, upload queues, cross-thread synchronization, real resource peaks/unload costs |
| S020 nested UI | 18 passes/0 failures | Dynamic dependencies, reparenting/insert/delete/hide, clipping/hits; independent full reference, 100 seeded edit steps, 1,200 additional hit comparisons | Production layout, font shaping, CJK/emoji/IME, real large-scale UI performance |
| S021 batch shared state | 8 passes/0 failures | Consumer actually uses batch-header texture/clip/pipeline; independent per-pixel per-command reference, 100 seeded scenes of 24 commands | Arbitrary masks, complete materials/filters, real-engine batching/performance advantage |
| S022 local mixed graphics | 7 passes/0 failures | Actual WebGL2 geometry batching, perspective mesh/UI, rigid joints, atlas frames, actual contextlost/restored/resource rebuilding | Complete 3D character/2D skeleton import, text quality, WebGPU scenes, phones/hosts, energy, package size, migration |

Each entry provides reproduction, current code, results, and history: [events](../experiments/reliable-event-probe/README.md), [resources](../experiments/async-resource-probe/README.md), [UI](../experiments/nested-ui-probe/README.md), [batches](../experiments/batch-state-probe/README.md), [mixed graphics](../experiments/mixed-scene-probe/README.md). Raw current results: [events JSON](../../evidence/reliable-event-probe-results.json), [resources JSON](../../evidence/async-resource-probe-results.json), [UI JSON](../../evidence/nested-ui-probe-results.json), [batches JSON](../../evidence/batch-state-probe-results.json), [graphics JSON](../../evidence/mixed-scene-probe-results.json), [screenshot](../../evidence/mixed-scene-probe.png).

### Constraints from events and resources

Must-deliver event producerSession, streamId, and consumerSession are separate from graphics epoch. Event IDs combine producer session, stream, and sequence. At capacity three, a full outbox rejects new events without consuming sequence numbers. Consumers reject gaps and synchronously commit only the next effect and watermark. Duplicate sequence numbers do not repeat effects but can be acknowledged. ACK checks identity, sent sequences, and continuous consumption watermark. Graphics recovery retains event records. This is a local consistency contract, not security authentication of forged same-identity messages. Bounded outbox entries do not bound effects history or total memory.

Case 13 creates a second in-memory instance within the same Node process, observing the same effect twice after state reset; no operating-system restart or crash is executed. Passing means this boundary was correctly recognized, not eliminated. Actual cross-boundary use needs explicit retry semantics, idempotency keys, and atomic durable storage of effects/consumption records; crash-safe exactly-once cannot be promised.

Resources separately record resourceGeneration, per-acquisition leaseId, decode/upload taskId, and deviceEpoch. One owner can retain multiple independent leases. Cancelling one lease does not terminate a shared task still needed by others; final release invalidates old tasks. Device loss invalidates old upload/GPU use while allowing device-independent CPU decoded data to remain. Recovery reuploads and does not report residency before completion.

Audit additionally found that defaulting completion fences to the current device generation let old callbacks without generations incorrectly clean new-device resources. Callbacks now capture generation at registration and must pass it explicitly; missing generation is rejected without state changes. The model assumes old-device use becomes invalid after loss. Actual backends must validate this release rule. Callbacks are manually scheduled, not real GPU synchronization.

### Effective UI and batching validation

The UI model supports a bounded vertical tree with fixed/content/explicit size references and external glyphWidths. Candidate edits clone the source tree and commit only after acyclic-dependency validation. Incremental dimension calculation is compared with an independent full topological reference, including world coordinates, clips, and hits. Sparse change in an eight-node fixture uses six dimension calculations versus 16 full calculations. Source cloning/validation and world-coordinate traversal still visit the entire tree; stationary snapshots also clone it. These are operation counts, not timing or speedups.

A counterexample rejects arbitrary subtree isolation: correct root height 85, b.y=49, tail.y=76; incorrect cutoff produces 75,39,66. Sparse glyph arrays previously bypassed validation and produced NaN; sums of very large finite dimensions produced Infinity. Corrections use dense own-index checks and explicit research budgets: at most 128 nodes, scalar values 1e6, reference multiplier 8, and glyph-list length 4096. Arbitrary finite inputs are unsupported; these budgets are not future product limits.

Batching preserves input order and merges only adjacent compatible texture/clip/pipeline items, splitting at geometry capacity. An independent CPU consumer executes shared state; the reference composites original commands per pixel without sharing its composition function. Equal textures with different clips/blends still require boundaries. Sparse color arrays need per-index validation. Rectangles, single texels, and straight/additive alpha define this experiment's scope.

### Actual mixed graphics

A fresh temporary headless Edge 154.0.4258.62 uses a 256×192 target and WebGL2 through ANGLE/D3D11. The renderer string contains NVIDIA RTX5090 Laptop, without independent authentication of hardware acceleration. The local-only server closes after testing. A cube with 12 triangles is actually drawn using handwritten perspective/rotation; UI composites in the same default framebuffer. Skeletons are two CPU-rigid-transformed rectangles; the atlas is a 3×1 color fixture; text is a Canvas-generated English texture.

The first case combines six commands into three actual draws with 36 vertices. Its 49,152 pixels/196,608 channels are compared with an independent per-command CPU reference: maximum channel error 1, within predefined ±3 tolerance. Incorrect clipping yields transparent pixels instead of red; incorrect blending yields [64,127,0,191] instead of [127,127,0,191]. Two skeletal frames change 561 pixels; red/green atlas frames are read back separately. Perspective mesh/UI center composition supports only this fixed scene, not arbitrary cameras, depth configuration, or a complete 3D pipeline.

The context is actually lost, restoration requested after the loss event returns, and resources recreated. The same fixed frame then differs in zero of 196,608 channels. Nonempty output is required before recovery comparison can pass. This establishes resource rebuilding for this scene, not combined recovery of game clocks, animation events, or asynchronous resource contracts. Text appears in the recovered image without independent quality assessment.

WebGL state/context references: [Khronos version page](https://registry.khronos.org/webgl/specs/2.0.0/) and [latest editor's draft](https://registry.khronos.org/webgl/specs/latest/2.0/). The first is dated 2017-04-11, the latest 2026-06-30; both status sections say editor's draft/work in progress, not a finally approved standard verified this round. [MDN blending reference](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/blendFuncSeparate) assists API checks. GPUWeb specification anchors/OpenGL reference pages returned tool errors; this does not establish missing APIs/platform capability. See [reference verification JSON](../../evidence/phase2-reference-check-2026-10-08.json).

### Failure chains and audit corrections

| Chain | Actual failures and corrections |
| --- | --- |
| Events | Initial 11-case set: 1 pass/10 failures, then 12-case set: 1 pass/11 failures. Eleven failures turned green; old-snapshot missed-event negative control passed throughout. Case 13 separately characterizes reset by a new instance in the same process. Author also ran nine validations; independent reviewer reproduced the red chain. |
| Resources | Seven advance counterexamples against an adaptation of the first-round ResourceModel: 0 passes/7 failures, without running historical Egret source. New model initially 24 passes; fence counterexample 24 passes/1 failure; final 25 passes. |
| UI | Stub 16 cases: 1 pass/15 failures; first implementation 16 passes; sparse-array/overflow counterexamples 16 passes/2 failures; final 18 passes. Incorrect isolation currently 16 passes/2 failures, retained as an expected-to-fail control. |
| Batches | Texture-only initial version 5 passes/3 failures; corrected 8 passes; sparse-color audit counterexample 7 passes/1 failure; final 8 passes. |
| GPU | Empty renderer 1 pass/6 failures exposed weak recovery judgment; nonempty guard 0 passes/7 failures. First actual renderer 7 passes but reference shared builder; independent reference corrected and actually rerun 7 passes. |

Initial, failing, intermediate green, and current results/SHA256 remain. Reports embed source or use explicit historical-file mappings. First-round 26+7 remains historical; integration additionally reran the first contract read-only with 26 passes without overwriting its original report. Second-round 71 is not a same-scope performance score. See [second-round audit](round-2-research.md#audit).

### Document and evidence self-check

Local-position metadata in public candidate reports became relative positions. Thirty-seven fields involved historical source paths, executable positions, or error stacks. Complete originals were first retained internally. Observations, test states, inputs, embedded source bytes, and source SHA256 remain unchanged. The current event program also outputs relative source names and generic node names, and reran 13 cases; previous source/reports remain. See [normalization record](../../evidence/phase2-path-metadata-normalization.json).

The knowledge-base checker misidentified JSON-escaped newlines/backslashes as UNC paths. It now parses JSON before checking individual strings, excluding neither source nor reports. A synthetic escaped fixture changed from failure to pass while real-local-path fixtures still fail correctly. The tool checks only structure, references, states, and defined sensitive markers, not page availability, licensing, all disclosure risks, or engine functionality.

D001–D012 remain proposed and H001–H007 untested. V001 continues accumulating research; V002–V006 product implementation has not started. V008 is the 0.2 candidate document package. Next address real assets/fonts, complete animation semantics, and integrated lifecycle, then measure frame time, loading, memory, input, energy, and temperature after confirming target hosts/devices and equal-quality content. R008 complete migration, continued editing, and publishing remain formal delivery requirements.

<a id="audit"></a>

## Second Round Audit

Updated: 2026-10-08 · Scope: evidence boundaries of bounded research programs and candidate designs. An independent AI reviewer, separate from the author, used read-only source review, counterexamples, in-memory reproduction, and result/source SHA256 checks. This was not human acceptance. No private legacy projects were run and no additional browser was launched. Discovered problems within this research scope were corrected and revalidated; final technology choices, a complete product, and leading performance are not established.

[Second-round validation record](round-2-research.md#execution) · [Technical white paper](../docs/technical-white-paper.md) · [Product requirements](../docs/product-requirements.md) · [Engineering plan](../docs/engineering-plan.md) · [Audit JSON](../../evidence/design-audit-phase2-2026-10-08.json)

### Findings and handling

| Issue | Why previous evidence was insufficient | Correction and revalidation |
| --- | --- | --- |
| Completion fence lacked device generation | Defaulting to the current epoch could treat old callbacks as completion for a new device | Capture epoch at registration and require it explicitly; reject omission without state change; [24 passes/1 failure](../../evidence/async-resource-probe-audit-red-results.json) → [25 passes](../../evidence/async-resource-probe-results.json) |
| Sparse glyph arrays | Array.some skips holes, allowing NaN into layout | Check every own index; [UI audit failure](../../evidence/nested-ui-probe-audit-red-results.json) → [18 passes](../../evidence/nested-ui-probe-results.json) |
| Accumulation overflow of finite inputs | Finite individual values do not ensure finite dependency calculations or sums | Add explicit research input budgets and atomic rejection above them; alongside sparse arrays, first 16 passes/2 failures, then 18 passes; no promise for arbitrary finite inputs |
| Sparse color arrays | Array.every also skips holes, allowing invalid inputs past batch validation | Check four own indices individually; [7 passes/1 failure](../../evidence/batch-state-probe-audit-red-results.json) → [8 passes](../../evidence/batch-state-probe-results.json) |
| GPU reference shared the batch builder | Tested builder and reference shared a missed-boundary bug; seven passes were insufficient for independent correctness | Replace reference with per-pixel composition of original commands; retain [shared-reference version](../../evidence/mixed-scene-probe-shared-builder-results.json); actually rerun [independent-reference version](../../evidence/mixed-scene-probe-results.json), seven passes |
| Empty output could pass recovery | Identical empty-renderer frames satisfied a weak recovery comparison | Author added nonempty guards; [1 pass/6 failures](../../evidence/mixed-scene-probe-empty-results.json) → [0 passes/7 failures](../../evidence/mixed-scene-probe-strict-empty-results.json); passed only after implementation |

The independent reviewer reproduced 64 checks across four CPU programs in memory, matching result names/statuses and source digests at the time. Failure chains for events, resources, UI, and batching also reproduced their recorded counts. An additional 1,000 UI-edit steps yielded 852 accepted and 148 rejected edits, 143 full-reference comparisons, and 2,860 matching hit comparisons. This is supplementary review coverage, excluded from the main program's 18 cases and unrelated to product performance.

The reviewer checked the latest seven-case browser report against six source digests and the historical empty-renderer/strict-guard version mapping, and read screenshots and graphics code without claiming another browser rerun. Executed separately, the new CPU reference had zero channels beyond tolerance against the correct batch consumer; the deliberately old texture batcher exceeded tolerance in 130,304/196,608 channels. This demonstrates that the reference exposes the old batching error, not actual GPU performance gains.

The author subsequently changed only local-position output in the current event runner, retained the old version, and actually reran 13 checks. The other three current CPU programs were also rerun, totaling 64 passes. The seven-case actual graphics report after the reference change and the shared batching source did not change again. Integration checks separately verified final evidence digests against all files; an old runner digest seen during review cannot be presented as the modified runner's digest.

### Retained limitations

Events validate single-instance synchronous effects and watermarks only. A second in-memory instance in the same Node process can repeat effects; operating-system process restart or crashes were not executed. Resource callbacks are manually scheduled; driver release and real fences are untested. UI uses glyph-width fixtures, without shaping or IME; full-tree copying/validation/coordinate traversal remain. GPU checks cover only fixed procedural meshes, rigid joints, atlases, and English textures, not complete characters/skeletons, arbitrary masks, or text quality.

There is no actual IPC/C++/WASM, WebGPU scene recovery, real mini-game/native host, phone, sustained load, GPU timing, energy use, cold loading, or migration comparison. The 71 cases include negative controls and boundary checks; their count is not a completeness or quality score. Independent AI review may still miss issues; formal product acceptance requires separate samples and conditions.

### Integration and history

The complete 0.2.0 baseline was first retained internally and matched against its 65 file digests. Report-position metadata normalization retains original copies and embedded source digests. A corrected JSON-string scanner false positive has positive and negative fixtures. D001–D012 candidate and H001–H007 untested statuses remain, as do R008/V006 full-migration scope. V002–V006 product implementation remains not_started. See the [verification record](../../核验记录.json) for final document structure results, limited to structure and established-marker checks.
