# Display-tree scaling

English | [简体中文](../../Cns/docs/显示树扩展性.md)

Engineering preview **0.27.2** is a bounded CPU display-tree bugfix. It changes attachment validation and direct child-list access without adding public exports or dependencies. Packages remain private `0.0.0`; protocol pins remain `1.0`. S080 and V031 record its separate acceptance status.

## Source diagnosis and baseline

At source base `d58e624942ec485d66003ec9bb48e5edab6a6374`, `addChild` preflight and final validation traverse the receiver's existing descendants, then commit binding across that tree again. Repeatedly appending one child to an already bound flat container therefore revisits its older siblings, producing quadratic cumulative traversal. `numChildren` and `getChildAt` copy the child-list snapshot; detach searches with `indexOf` even for the last child.

A stock built-source local Node.js 24.19.0 observation recorded these elapsed milliseconds. Hardware is unidentified and this single observation is not a comparative benchmark.

| Children | Construction | Capture | Tail cleanup |
| --- | --- | --- | --- |
| 2,000 | 199.83 ms | 2.49 ms | 1.08 ms |
| 4,000 | 976.23 ms | 2.32 ms | 2.46 ms |
| 8,000 | 4,315.14 ms | 12.87 ms | 13.25 ms |

A **separate** 8,000-child subclass probe observed 32,012,000 usability-hook calls, exactly `N(N+3)/2`. The timing and hook-count scopes are separate and are not added. No successor speedup is projected from this baseline.

## Attachment boundary

For an already bound receiver, attachment checks the receiver and the **entire incoming subtree**, retaining the receiver's own bindable callback after its initial usability check. It does not rerun usability hooks on unrelated descendants already under that receiver. An open-engine check precedes the receiver bindable callback, preserving `ENGINE_CLOSED` priority if an incoming hook closes the Engine. This narrower callback boundary is intentional. An **initially unbound** receiver retains whole-tree preflight and final binding validation, including existing descendants, even if a hook binds it during preflight.

Subclass hooks may reenter and change either tree. After callback-capable preflight, attachment must re-read current engine and internal tree state, then perform callback-free liveness, Stage-root, cycle and full incoming-subtree affinity checks. Cross-engine and mismatched bindings remain refusals. Binding and internal detach/attach follow only successful final validation; refusal adds no partial binding or reparenting by the operation. Hook side effects retain their own callback scope. Disposal and cleanup ownership follow the existing lifecycle contract.

## Cost limits

| Operation | Bounded change and retained cost |
| --- | --- |
| Append to an already bound receiver | Avoid revisiting unrelated old siblings; incoming-subtree and ancestor cycle checks still cost work. |
| `numChildren` / `getChildAt` | Direct constant-time count/index access without cloning the list. |
| Detach the last child | Direct last-element check and removal. |
| Remove an arbitrary middle child | Search and array shifting remain linear in sibling count. |
| Append to an initially unbound tree | Whole-tree discovery/binding may still rescan existing descendants. |

There is no global O(N) guarantee for tree construction, arbitrary reparenting, disposal, traversal or rendering. This increment does not establish performance leadership.

## Verification and provenance

The focused pre-fix regression snapshot has **8 tests: 7 passed, 1 failed**, exposing the unrelated existing-sibling hook. Actual successor checks/probe, complete current verification, independent finite source/bilingual review, mandatory prepush and remote delivery remain **PENDING** at this preparation cutoff. The shared [verification record](../../evidence/display-tree-scaling-verification.json) binds results to their source and fixture identities; overlapping scopes must not be summed. Earlier checkpoints retain their original cutoffs.

The actual corrected-source successor build and targeted display/scaling/cancellation/textured-capture harness passed **71/71**, including **9 scaling tests**. The closing-hook regression first failed with `OBJECT_DISPOSED` instead of `ENGINE_CLOSED`; the added open-engine guard repaired that priority. C06's exact 65,536-node/65,537-node-overflow subtest passed in **501.1715 ms**; its enclosing C06 group took **644.454 ms**, within the complete targeted harness's **1,946.6674 ms**. These nested durations and test scopes overlap and are not added. They are local fixture observations, not target-device performance acceptance.

An earlier whole-core run passed **2,227/2,227**, before the ninth closing-hook test and corrected guard; it is intermediate evidence, not final-source verification. Final complete current verification/prepush and affected browser regression gates remain **PENDING**, as do independent finite review and delivery. The baseline failures and preparation cutoff above remain preserved.

The change uses AI-assisted independent first-party diagnosis, specifications, implementation and separately authored fixtures under Apache-2.0. No external implementation code is copied and no third-party dependency is added. This bounded workflow declaration is not a global originality certification. Browser, device, GPU, phone, performance leadership, complete Spine and full migration acceptance are excluded.

## Observed corrected workload and desktop successor

The same fixed local stock-node probe recorded corrected construction times of **4.37, 14.13 and 28.63 ms** for 2,000, 4,000 and 8,000 children. A separate corrected subclass probe recorded **16,000 hooks** for 8,000 children. These are single local observations with unrecorded hardware; no speedup ratio or production performance is inferred. The shared record projects actual observed fields only, excluding retained private baseline-estimate counters.

Fresh default Edge Canvas, WebGPU and B1 desktop regression commands exited **0**. WebGPU reported zero failed required fixtures and zero unexpected errors; B1 covered **7 positive frames, 5 counterexamples and 11 submitted frames**, with cooperative browser/context/server cleanup observed. These are fixed regression scopes; they do not validate new text/fonts, phone performance or complete 3D. Textured/sequence regressions, final complete prepush, bilingual meaning review and remote delivery remain pending at this successor cutoff.

The remaining desktop successor completed on 2026-10-11: textured WebGPU passed **11 calibration cases, 10 held-out cases and 16 control windows**; opaque SequencePlayer passed **8 captures / 1,024 channel comparisons**. These counts belong to different verification scopes and are not added. All five affected existing browser gates have now passed on the corrected display source; final complete prepush and remote delivery remain separate.

## Complete final-source verification

On 2026-10-11, the complete mandatory prepush command passed with **2,228/2,228 core tests**, **52/52 publication tests**, complete build/type/boundary checks, closed headless ownership and zero pending timers. Knowledge-base validation reported **153 records, 237 Markdown files and zero issues**. All three reviewed source/test identities remained unchanged. Independent finite source, English/Chinese meaning and saved-evidence review reported zero open findings; its original cutoff remains separate. This factual documentation successor changes no product code. The Git push hook must still repeat the mandatory checks; remote delivery and full product acceptance are not inferred.
