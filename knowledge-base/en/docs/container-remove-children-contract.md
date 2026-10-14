# Display-container batch detachment contract

English | [简体中文](../../Cns/docs/容器清空子节点契约.md)

**0.49.0 · S103 / V054.** `DisplayObjectContainer.removeChildren(): void` clears a display layer while keeping its nodes, descendants, resources and cleanup owners alive. It authenticates the genuine receiver, checks Engine before receiver lifetime even when empty, preflights every direct edge and commits without caller hooks. Sprite and Stage inherit the method; root values/types, profiles, dependencies and protocol remain unchanged.

~~~ts
container.removeChildren(); // Returns void; detaches every current direct child.
~~~

The method takes no arguments and offers no indexed range or public children array. Strict types reject arguments; ordinary JavaScript ignores extras. Leaf/proxy/prototype-lookalike receivers receive INVALID_DISPLAY_CONTAINER without public getter authority. After identity, an affiliated closed Engine yields ENGINE_CLOSED; a disposed receiver under an open/unbound Engine yields OBJECT_DISPOSED. Empty/repeated calls retain these checks.

Captured private WeakMap operations preflight every direct edge against its parent before mutation; inconsistency yields DISPLAY_TREE_INVARIANT with the old list/parents intact. This invariant and allocation atomicity are source obligations, not executed private-fault or physical OOM experiments. Synchronous commit only removes each direct parent and clears the owned list length. It calls no overridable removeChild/getChildAt/numChildren/assertUsable/child.dispose and adds no event, diagnostic or clock operation.

Exact child identity, descendant order, listeners, hitArea, graphics, Scope owner, leases and permanent Engine affinity remain. Detachment does not dispose, release, clone or transfer owners. Same-Engine reattachment remains legal; foreign affinity retains its existing refusal. Receiver Graphics/transforms/clip/parent remain. Caller-retained reference arrays and earlier shallow snapshots are not cleared in place. Saved owned frames remain unchanged; fresh bounds/hit/capture follow the remaining tree. Established event paths retain dispatcher semantics.

~~~ts
scope.use(layer);
layer.addChild(first);
layer.addChild(second);
layer.removeChildren();
layer.addChild(first); // Same genuine object; resources and original owners remain live.
~~~

The example assumes genuine live same-Engine objects registered with their actual owners; original Scope/Engine cleanup remains responsible. Independent Apache-2.0 first-party work modifies only Container/private-tree product files and reuses existing tree/Scope/resource/frame contracts. AI assisted source, tests and bilingual preparation; separate review accepts only its recorded scope.

Read the [evidence](container-remove-children-evidence.md) and [native schedule](container-remove-children-native-verifier.md). Full Spine R020/V020, migration R008/V006, complete UI/layout, advanced 3D and target-device/performance acceptance remain OPEN or unverified. Packages stay private 0.0.0, host protocol 1.0.
