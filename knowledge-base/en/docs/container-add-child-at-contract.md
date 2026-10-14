# Indexed child insertion contract

English | [简体中文](../../Cns/docs/容器按索引插入契约.md)

**0.51.0 R3 Source publication draft · S105 / V056 · 2026-10-14.** The unchanged accepted contract is now supported by independently accepted current code verification: all 9 phases, Core 3113/3113 and Spine source checks 160/160; original strict ADI 0/10, CGI 0/12 and DCA 0/10 vectors. Bounded desktop opaque Canvas/WebGPU Native execution is independently accepted: 10 main raw readbacks and 23040 channel comparisons. Public/source/bilingual review, prepush/hooks and 0.51 delivery remain PENDING. Earlier cutoffs and the failed first full attempt are retained in the paired evidence.

## Public operation

`DisplayObjectContainer.addChildAt<T extends DisplayObject>(child: T, index: number): T` returns the exact incoming object with its inferred subtype. Sprite and genuine Engine-created Stage receivers inherit it. A Stage can receive children and cannot become a child. Consumers use the built `@egret/engine` entry.

At each validation pass, n is the receiver's current authoritative direct-child count. Accept primitive integer index in **[0, n]**, including -0 as zero; index n appends. Fractions, negative integers, NaN/infinity, strings, boxed numbers, null and undefined refuse INVALID_INDEX without coercion.

| Current relation | Result |
| --- | --- |
| Detached or another direct parent | Insert at index and remove precisely the current old edge. Preserve other source/target sibling order and the complete incoming subtree. |
| Already a direct child | Index is the final position; moving forward does not decrement it. Index n is an append alias with final position n - 1 and unchanged count. |
| Already at the final position | Still authenticate, run preflight and validate the complete final state. A structural no-op may still commit compatible newly needed affinity. |

For [A,B,C], (A,1) gives [B,A,C] and (A,3) gives [B,C,A]. A new dialog panel can be inserted behind an existing close control with one operation.

## Refusal and hook order

1. Authenticate the receiver through private container identity: INVALID_DISPLAY_CONTAINER precedes receiver property/hook access.
2. Select receiver-tree affinity and check its genuine Engine open if present, then receiver life: ENGINE_CLOSED precedes OBJECT_DISPOSED.
3. Authenticate the child by private node identity, without shape/getter/proxy reads: INVALID_DISPLAY_OBJECT. Prefer receiver-tree affinity, otherwise incoming-tree affinity, and check the selected Engine open.
4. Check child life, Stage-root prohibition, cycle and the current inclusive index: OBJECT_DISPOSED, STAGE_ROOT_ONLY, DISPLAY_CYCLE, then INVALID_INDEX.
5. Run the original receiver assertUsable and incoming attachability hooks. Preserve the initial receiver-bound distinction: a bound receiver runs its own bindable hook; an initially unbound receiver traverses its tree; traverse the incoming current subtree when an Engine was initially selected. Open checks precede binding hooks. Hook-thrown values propagate unchanged; encountered compatibility checks can refuse ENGINE_MISMATCH. Overlap can invoke a bindable hook more than once.
6. After the last registered hook, capture both complete genuine current trees, current parent/lists and source direct edges through captured private readers. Select Engine from this same capture, receiver before incoming, root-first and last-child depth-first. Check Engine open, receiver/child life, Stage, cycle and current index; then validate every node's identity, life, direct edge and recorded affinity in both trees, including when no Engine exists. Malformed/repeated edges refuse DISPLAY_TREE_INVARIANT; source direct edges are also checked.
7. Prepare one unexposed plan and all explicit list/value allocations, then publish captured writes once: staged previously unbound compatible affinity, distinct-source replacement, changed target replacement, changed moved-parent mapping. No registered display hook, public getter/method, resource or diagnostic callback runs in this final segment.

Public parent/numChildren/isDisposed shadows, old internal-name shadows and overridden display readers/mutators supply no state authority. The final state is the real posthook state. Reentrant reorder/reparent, Scope registration, disposal or Engine closure remain authoritative.

## Bounded atomicity and ownership

An ordinary validation/preflight/preparation refusal adds zero outer tree, permanent-affinity, owner or resource-lifetime writes relative to posthook state. Successful publication is synchronous and callback-free. Deliberate successful hook side effects remain even if the outer call refuses. There is no affinity inverse or owner rollback.

Same-Engine cross-parent and cross-Scope moves preserve cleanup owners. Incoming Engine-bound nodes can bind the compatible current receiver tree. Permanent Engine A affinity, including any current descendant, refuses Engine B; detachment retains affinity. A wholly unbound success creates no Engine affinity. Insertion borrows state: it calls no Scope.use, lease acquire/release, dispose/cancel, renderer or host operation. Bitmap retains its authentic lease, crop and owner; actual owner cleanup remains terminal after reparenting.

Physical OOM, native primitive failure during commit and arbitrary realm isolation are outside this bounded guarantee. Private malformed-edge/allocation observations require separately authorized units; ordinary tests fabricate none.

Independent first-party Apache-2.0 source follows Egret specifications and familiar names, with English critical comments and original fixtures. AI assisted source/tests/bilingual preparation; source, saved-result and publication review remain separately scoped. Dependencies/notices are unchanged. Packages remain private 0.0.0; host protocol 1.0.

Read [evidence](container-add-child-at-evidence.md) and [implementation/remaining work](container-add-child-at-implementation-plan.md). Full Spine R020/V020, migration R008/V006, EUI/layout, advanced 3D, AI and phone/platform/performance acceptance remain OPEN or unverified.
