# Direct-child index contract

English | [简体中文](../../Cns/docs/容器子节点索引契约.md)

**0.50.0 · S104 / V055.** DisplayObjectContainer.getChildIndex(child: DisplayObject): number is a read-only query of the exact current direct child. It scans the authoritative private order in O(n), with no list snapshot/cache, tree mutation, owner transfer, resource operation or display callback. Sprite/Stage inherit it; root values/types, subpaths, dependencies and protocol are unchanged.

~~~ts
const index = layer.getChildIndex(child); // Current zero-based direct-child index.
layer.setChildIndex(otherChild, index); // Separate existing mutation.
~~~

Return the current zero-based direct position after add/remove/reparent/reorder operations. Do not search descendants, return -1 or use a cached previous position. This inherited member is absent from a plain DisplayObject; no standalone root getChildIndex function is exported.

Refusal order is genuine container identity → its existing Engine-open check → receiver lifetime → genuine child identity → child lifetime → exact private parent membership → private identity scan. Errors are INVALID_DISPLAY_CONTAINER, ENGINE_CLOSED, OBJECT_DISPOSED, INVALID_DISPLAY_OBJECT, OBJECT_DISPOSED, NOT_A_CHILD and DISPLAY_TREE_INVARIANT respectively. Engine-closed precedes disposed receiver, even with a bad child. Omitted/null/primitive/shape/proxy children gain no authority; genuine subclasses are accepted. Unattached objects, grandchildren, self, Stage roots or another container/Engine are NOT_A_CHILD after lifetime checks. The query does not inspect the foreign Engine or perform attachment admission.

Private list/parent readers and strict object identity supply authority; public parent/numChildren/getChildAt/assertUsable/removal/reorder/dispose overrides are not called. No snapshot or second index registry is added. O(n) describes implementation, not measured throughput, OOM/GC or performance superiority. The private parent/list mismatch refusal is source-qualified, not an executed corrupt-state fault. Existing internal lifecycle effects retain their original boundary; this is not arbitrary-JavaScript isolation.

Success and refusal retain tree order/parents/descendants, exact objects, listener registrations, Scope owners, permanent affinity, Texture leases and owned captured frames. No event/timer/frame/resource request, detach/dispose/release or owner transfer is introduced. Existing setChildIndex remains a separate mutation; this adds no atomic query-and-reorder transaction.

Independent first-party Apache-2.0 work reuses Egret Container/tree/Scope/resource/frame contracts. AI assisted source/tests/bilingual preparation with separate source/saved-result review; dependencies and existing notices remain unchanged. Read the [evidence](container-child-index-evidence.md) and [implementation/remaining work](container-child-index-implementation-plan.md). Full Spine R020/V020, migration R008/V006, EUI/layout, advanced 3D, AI interfaces and phone/platform/performance acceptance remain OPEN or unverified. Packages stay private 0.0.0, host protocol 1.0.
