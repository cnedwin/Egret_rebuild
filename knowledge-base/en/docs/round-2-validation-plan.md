# Second Round Validation Plan

English | [简体中文](../../Cns/docs/第二轮验证计划.md)

Version: 0.1 · Date: October 8, 2026. R011 requires continuing incremental research, validation, and design. This round addresses gaps identified by the first audit. Outputs are inspectable research programs, actual results, and design revisions. Production engine selection, first hosts, and numeric budgets are not finally approved.

[First-round audit](round-1-audit.md) · [Technical white paper](technical-white-paper.md) · [Product requirements](product-requirements.md) · [Engineering plan](engineering-plan.md)

## Questions, methods, and boundaries

| Research question | Experimental method and counterexample | Possible conclusion and limits |
| --- | --- | --- |
| How to preserve cross-boundary must-deliver events after graphics-mirror recovery | Separate event stream, outbox, watermarks, ACK loss/retransmission/reordering/backpressure; use the former graphics-only recovery strategy as a missed-event counterexample | In-memory acceptance, ordering, deduplication, and recovery contract; without durable transactions, no guarantee of exactly-once effects after process crashes |
| Whether batching truly preserves shared state | Compare a full per-command reference with independent execution by batch headers; deliberately ignore clip/pipeline for pixel counterexamples; then perform real WebGL geometry batching/readback | Correctness for limited materials, rectangles, and blending modes; not arbitrary masks, filters, skeleton attachments, or all backends |
| Whether nested invalidation can stop propagation while staying correct | Fixed/content-adaptive sizes, insert/delete, reparenting, hiding, ancestor dimensions/world coordinates; compare with independent full source-tree calculation and hit testing | Explicit layout semantics and operation counts; text-measurement fixtures do not establish real shaping/IME, and workload is not a speedup |
| How CPU data and GPU residency recover independently | Independent lease per acquisition, separate decode/upload, device generations, late tasks, fences, failures, asynchronous reupload; use the old owner Set strategy as a counterexample | Deterministic state-machine contract; scheduled asynchronous completion remains simulated, not proof of GPU drivers, thread races, or performance |
| Whether local contracts can enter one graphics experiment | Procedural 3D mesh plus multilayer UI, rectangular clipping, simple two-segment skeleton, and image sequences; specified frames/pixel checks | Bounded behavior in one local WebGL2 experiment; not complete characters/asset import, complex animation, editor, or target-host acceptance |

## Execution and quality gates

1. Retain the complete 0.2.0 knowledge base and raw-evidence snapshot, checking each previous verification digest.
2. Run three independent state/layout experiments in parallel; keep separate implementations/results for batching and graphics, checking shared contracts and versions during integration.
3. For each group, first record failing counterexamples demonstrating incorrect strategies, then run the corrected model. Record environment, inputs, tolerance, actual counts, source SHA256, and uncovered areas.
4. Independent reviewers check that counterexamples detect real errors, references are independent, recovery preserves semantics, and conclusions stay within scope. Correct and revalidate problems that directly break contracts first.
5. After integration, rerun local experiments and match results to source digests. Update the three design documents, sources, and delivery register consistently, then verify knowledge-base structure.

The first devices and hosts remain undecided. Local research can proceed, but this round cannot substitute for phone energy use, complete-engine performance, or compatibility across mini-game hosts. R008 one-click legacy migration continues to inform interface and behavioral design; full-delivery dependencies remain unchanged.
