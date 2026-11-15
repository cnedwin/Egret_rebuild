import { EgretError } from "./EgretError.js";
import { recordVisualChange, VISUAL_STRUCTURE } from "./displayVisualState.js";
// Read at call time only; ownership imports this module for its own tree operations.
import { engineOf } from "./ownership.js";
// Internal state authority: validation/commit never uses overridable getters
// or public removeChild. Public subclass hooks run only during preflight.
const nodes = new WeakSet();
const terminated = new WeakSet();
const roots = new WeakSet();
const parents = new WeakMap();
const childLists = new WeakMap();
// The batch path uses captured original operations, never caller getters/hooks.
const readChildList = childLists.get.bind(childLists);
const readParent = parents.get.bind(parents);
const deleteParent = parents.delete.bind(parents);
const readStageRoot = roots.has.bind(roots);
export function registerNode(node) {
    nodes.add(node);
}
export function registerContainer(node) {
    childLists.set(node, []);
}
/** Authenticate an actual registered container without inspecting its shape. */
export function assertContainer(value) {
    if (readChildList(value) === undefined)
        throw new EgretError("INVALID_DISPLAY_CONTAINER");
}
export function markStageRoot(node) {
    roots.add(node);
}
/** Identity-only authentication never reads a forged or proxied Stage. */
export function isStageRoot(value) {
    return roots.has(value);
}
export function isDisplayNode(value) {
    return nodes.has(value);
}
export function isTerminated(node) {
    return terminated.has(node);
}
export function parentOf(node) {
    return parents.get(node);
}
/** Return a snapshot so callers cannot mutate the authoritative child list. */
export function childrenOf(node) {
    return [...(childLists.get(node) ?? [])];
}
/** Callback-free O(1) readers for budgeted traversal; never clone the list. */
export function childCountOf(node) {
    return childLists.get(node)?.length ?? 0;
}
export function childAtOf(node, index) {
    return childLists.get(node)?.[index];
}
/** Read the exact direct-child index in O(n), without a snapshot or callbacks. */
export function childIndexOf(parent, child) {
    const list = readChildList(parent);
    if (list === undefined)
        throw new EgretError("INVALID_DISPLAY_CONTAINER");
    if (readParent(child) !== parent)
        throw new EgretError("NOT_A_CHILD");
    // Scan authoritative identity directly; public getters and Array.indexOf are not authority.
    for (let index = 0; index < list.length; index++) {
        if (list[index] === child)
            return index;
    }
    throw new EgretError("DISPLAY_TREE_INVARIANT");
}
export function assertLive(node) {
    if (terminated.has(node))
        throw new EgretError("OBJECT_DISPOSED");
}
export function assertAttachable(node) {
    assertLive(node);
    if (roots.has(node))
        throw new EgretError("STAGE_ROOT_ONLY");
}
export function assertNoCycle(parent, child) {
    for (let current = parent; current !== undefined; current = parentOf(current)) {
        if (current === child)
            throw new EgretError("DISPLAY_CYCLE");
    }
}
function listOf(parent) {
    const list = childLists.get(parent);
    if (list === undefined)
        throw new EgretError("INVALID_DISPLAY_CONTAINER");
    return list;
}
export function detachNode(child) {
    const parent = parentOf(child);
    if (parent === undefined)
        return;
    const list = listOf(parent);
    // Reverse acquisition cleanup commonly removes the tail. Avoid a full
    // search in that case; middle removals retain stable ordering and linear cost.
    const index = list[list.length - 1] === child ? list.length - 1 : list.indexOf(child);
    if (index < 0)
        throw new EgretError("DISPLAY_TREE_INVARIANT");
    list.splice(index, 1);
    parents.delete(child);
    recordVisualChange(parent, VISUAL_STRUCTURE);
    recordVisualChange(child, VISUAL_STRUCTURE);
}
/** Caller has completed validation; mutation has no subclass callbacks. */
export function attachNode(parent, child) {
    detachNode(child);
    listOf(parent).push(child);
    parents.set(child, parent);
    recordVisualChange(parent, VISUAL_STRUCTURE);
    recordVisualChange(child, VISUAL_STRUCTURE);
}
export function removeNode(parent, child) {
    if (parentOf(child) !== parent)
        throw new EgretError("NOT_A_CHILD");
    detachNode(child);
}
/** Preflight every direct edge, then detach the batch without user callbacks. */
export function detachChildren(parent) {
    const list = readChildList(parent);
    if (list === undefined)
        throw new EgretError("INVALID_DISPLAY_CONTAINER");
    // No edge changes until the entire private list agrees with parent authority.
    for (let index = 0; index < list.length; index++) {
        const child = list[index];
        if (child === undefined || readParent(child) !== parent)
            throw new EgretError("DISPLAY_TREE_INVARIANT");
    }
    // Keep descendants, cleanup owners and permanent Engine affinity unchanged.
    for (let index = 0; index < list.length; index++) {
        const child = list[index];
        if (child !== undefined) {
            deleteParent(child);
            recordVisualChange(child, VISUAL_STRUCTURE);
        }
    }
    const changed = list.length !== 0;
    list.length = 0;
    if (changed)
        recordVisualChange(parent, VISUAL_STRUCTURE);
}
export function setNodeIndex(parent, child, index) {
    const list = listOf(parent);
    if (parentOf(child) !== parent)
        throw new EgretError("NOT_A_CHILD");
    const previous = list.indexOf(child);
    if (previous < 0)
        throw new EgretError("DISPLAY_TREE_INVARIANT");
    list.splice(previous, 1);
    list.splice(index, 0, child);
    if (previous !== index) {
        recordVisualChange(parent, VISUAL_STRUCTURE);
        recordVisualChange(child, VISUAL_STRUCTURE);
    }
}
export function terminateNode(node) {
    terminated.add(node);
    recordVisualChange(node, VISUAL_STRUCTURE);
    detachNode(node);
}
// Indexed insertion has its own captured authority; legacy operations stay unchanged.
const insertionHasNode = nodes.has.bind(nodes);
const insertionIsTerminated = terminated.has.bind(terminated);
const insertionIsRoot = roots.has.bind(roots);
const insertionWriteChildren = childLists.set.bind(childLists);
const insertionWriteParent = parents.set.bind(parents);
const insertionInteger = Number.isInteger;
const InsertionSet = Set;
const insertionSeenHas = Set.prototype.has.call.bind(Set.prototype.has);
const insertionSeenAdd = Set.prototype.add.call.bind(Set.prototype.add);
// An indexed insertion that walked a receiver's whole tree and left every node in it bound to one
// Engine records that Engine here, so the next insertion into the same receiver does not walk the
// tree again. A node enters a recorded tree only through addChild or addChildAt, which bind the
// whole incoming tree to that Engine, or through the list replacements below, which forget the
// record. Detaching or disposing a node takes it out of the tree and leaves the rest as it was,
// and Engine affinity, once given, does not change.
const verifiedInsertionTrees = new WeakMap();
const readVerifiedInsertionTree = verifiedInsertionTrees.get.bind(verifiedInsertionTrees);
const writeVerifiedInsertionTree = verifiedInsertionTrees.set.bind(verifiedInsertionTrees);
const deleteVerifiedInsertionTree = verifiedInsertionTrees.delete.bind(verifiedInsertionTrees);
/** A node whose subtree may now hold other affinity retires the record of every tree containing it. */
function forgetVerifiedInsertionTrees(node) {
    for (let current = node; current !== undefined; current = readParent(current)) {
        deleteVerifiedInsertionTree(current);
    }
}
function copyInsertionList(list) {
    const snapshot = [];
    for (let index = 0; index < list.length; index++)
        snapshot[index] = list[index];
    return snapshot;
}
function captureInsertionNode(node, edgeParent, repeated) {
    const genuine = insertionHasNode(node);
    const actualParent = readParent(node);
    const actualChildren = readChildList(node);
    const children = actualChildren === undefined ? undefined : copyInsertionList(actualChildren);
    let edgeAgrees = edgeParent === undefined || actualParent === edgeParent;
    if (edgeParent !== undefined && insertionIsRoot(node))
        edgeAgrees = false;
    // A captured root's external direct edge must also agree with its real parent list.
    if (edgeParent === undefined && actualParent !== undefined) {
        const parentChildren = readChildList(actualParent);
        let occurrences = 0;
        if (parentChildren !== undefined) {
            for (let index = 0; index < parentChildren.length; index++)
                if (parentChildren[index] === node)
                    occurrences++;
        }
        edgeAgrees = parentChildren !== undefined && occurrences === 1;
    }
    return {
        node,
        actualParent,
        children,
        genuine,
        terminated: insertionIsTerminated(node),
        stageRoot: insertionIsRoot(node),
        repeated,
        edgeAgrees
    };
}
function captureInsertionTree(root) {
    const records = [];
    const pending = [
        { node: root, parent: undefined }
    ];
    const seen = new InsertionSet();
    while (pending.length !== 0) {
        const current = pending[pending.length - 1];
        pending.length--;
        const repeated = insertionSeenHas(seen, current.node);
        insertionSeenAdd(seen, current.node);
        const record = captureInsertionNode(current.node, current.parent, repeated);
        records[records.length] = record;
        // Record bad/repeated edges without throwing or following them indefinitely.
        if (!record.genuine || repeated || record.children === undefined)
            continue;
        for (let index = 0; index < record.children.length; index++) {
            pending[pending.length] = { node: record.children[index], parent: record.node };
        }
    }
    return records;
}
/** Capture the complete posthook authority once, without semantic refusals or hooks. */
export function captureChildInsertion(receiver, child) {
    // A bound receiver whose whole tree an earlier insertion left bound to the same Engine is not
    // walked again: every record that walk would produce is valid and carries that Engine, so the
    // receiver contributes its own record only.
    const receiverEngine = engineOf(receiver);
    const receiverTree = receiverEngine !== undefined && readVerifiedInsertionTree(receiver) === receiverEngine
        ? [captureInsertionNode(receiver, undefined, false)]
        : captureInsertionTree(receiver);
    const incomingTree = captureInsertionTree(child);
    const receiverAncestors = [];
    const seenAncestors = new InsertionSet();
    let repeatedAncestor = false;
    for (let current = receiver; current !== undefined; current = readParent(current)) {
        if (insertionSeenHas(seenAncestors, current)) {
            repeatedAncestor = true;
            break;
        }
        insertionSeenAdd(seenAncestors, current);
        receiverAncestors[receiverAncestors.length] = current;
    }
    const targetChildren = receiverTree[0].children ?? [];
    const oldParent = incomingTree[0].actualParent;
    const distinctSource = oldParent !== undefined && oldParent !== receiver;
    const actualSource = distinctSource ? readChildList(oldParent) : undefined;
    const sourceChildren = actualSource === undefined ? undefined : copyInsertionList(actualSource);
    const sourceEdges = [];
    const sourceSeen = new InsertionSet();
    if (sourceChildren !== undefined) {
        for (let index = 0; index < sourceChildren.length; index++) {
            const node = sourceChildren[index], repeated = insertionSeenHas(sourceSeen, node);
            insertionSeenAdd(sourceSeen, node);
            sourceEdges[index] = captureInsertionNode(node, oldParent, repeated);
        }
    }
    const previousChildren = oldParent === receiver ? targetChildren : sourceChildren;
    let oldIndex = -1;
    if (previousChildren !== undefined) {
        for (let index = 0; index < previousChildren.length; index++)
            if (previousChildren[index] === child) {
                oldIndex = index;
                break;
            }
    }
    return {
        receiver,
        child,
        receiverTree,
        incomingTree,
        receiverAncestors,
        repeatedAncestor,
        targetChildren,
        oldParent,
        sourceChildren,
        sourceEdges,
        sourceContainerGenuine: !distinctSource || actualSource !== undefined,
        oldIndex
    };
}
/** Inclusive index checks never coerce boxed, string or other caller values. */
export function assertChildInsertionIndex(receiver, index) {
    if (typeof index !== "number" ||
        !insertionInteger(index) ||
        index < 0 ||
        index > (readChildList(receiver)?.length ?? 0)) {
        throw new EgretError("INVALID_INDEX");
    }
}
/** Engine openness is checked by ownership before these ordered root semantics. */
export function validateCapturedInsertionRoots(capture, index) {
    const receiver = capture.receiverTree[0], child = capture.incomingTree[0];
    if (receiver.terminated)
        throw new EgretError("OBJECT_DISPOSED");
    if (child.terminated)
        throw new EgretError("OBJECT_DISPOSED");
    if (child.stageRoot)
        throw new EgretError("STAGE_ROOT_ONLY");
    for (let position = 0; position < capture.receiverAncestors.length; position++) {
        if (capture.receiverAncestors[position] === capture.child)
            throw new EgretError("DISPLAY_CYCLE");
    }
    if (typeof index !== "number" || !insertionInteger(index) || index < 0 || index > capture.targetChildren.length) {
        throw new EgretError("INVALID_INDEX");
    }
}
/** Identity, life and edge checks precede the corresponding recorded affinity check. */
export function validateCapturedInsertionNode(record) {
    if (!record.genuine)
        throw new EgretError("DISPLAY_TREE_INVARIANT");
    if (record.terminated)
        throw new EgretError("OBJECT_DISPOSED");
    if (record.repeated || !record.edgeAgrees)
        throw new EgretError("DISPLAY_TREE_INVARIANT");
}
/** Validate every current distinct-source direct edge, including unrelated siblings. */
export function validateCapturedInsertionSource(capture) {
    if (capture.repeatedAncestor || !capture.sourceContainerGenuine)
        throw new EgretError("DISPLAY_TREE_INVARIANT");
    if (capture.oldParent !== undefined && capture.oldIndex < 0)
        throw new EgretError("DISPLAY_TREE_INVARIANT");
    for (let index = 0; index < capture.sourceEdges.length; index++)
        validateCapturedInsertionNode(capture.sourceEdges[index]);
}
/** Build both replacements solely from the validated capture; no mapping writes occur. */
export function prepareCapturedInsertionTree(capture, index) {
    const sameParent = capture.oldParent === capture.receiver;
    const targetCount = capture.targetChildren.length;
    const effectiveIndex = sameParent && index === targetCount ? targetCount - 1 : index === 0 ? 0 : index;
    const targetChanged = !sameParent || capture.oldIndex !== effectiveIndex;
    let targetReplacement;
    if (targetChanged) {
        targetReplacement = [];
        const nextCount = sameParent ? targetCount : targetCount + 1;
        let readIndex = 0;
        for (let writeIndex = 0; writeIndex < nextCount; writeIndex++) {
            if (writeIndex === effectiveIndex)
                targetReplacement[writeIndex] = capture.child;
            else {
                if (sameParent && readIndex === capture.oldIndex)
                    readIndex++;
                targetReplacement[writeIndex] = capture.targetChildren[readIndex];
                readIndex++;
            }
        }
    }
    let sourceReplacement;
    if (capture.oldParent !== undefined && !sameParent) {
        sourceReplacement = [];
        const sourceChildren = capture.sourceChildren;
        for (let readIndex = 0, writeIndex = 0; readIndex < sourceChildren.length; readIndex++) {
            if (readIndex !== capture.oldIndex)
                sourceReplacement[writeIndex++] = sourceChildren[readIndex];
        }
    }
    return { capture, effectiveIndex, targetReplacement, sourceReplacement, parentChanged: !sameParent };
}
/** Publication uses captured native writes only: source, target, then moved parent. */
export function publishCapturedInsertionTree(plan) {
    if (plan.sourceReplacement !== undefined)
        insertionWriteChildren(plan.capture.oldParent, plan.sourceReplacement);
    if (plan.targetReplacement !== undefined)
        insertionWriteChildren(plan.capture.receiver, plan.targetReplacement);
    if (plan.parentChanged)
        insertionWriteParent(plan.capture.child, plan.capture.receiver);
    // All source/target/edge authority is visible before its allocation-free revisions.
    if (plan.sourceReplacement !== undefined)
        recordVisualChange(plan.capture.oldParent, VISUAL_STRUCTURE);
    if (plan.targetReplacement !== undefined) {
        recordVisualChange(plan.capture.receiver, VISUAL_STRUCTURE);
        recordVisualChange(plan.capture.child, VISUAL_STRUCTURE);
    }
    // Both trees were validated against one Engine and every staged affinity is already written, so a
    // bound receiver's whole tree now carries its Engine. A tree without an Engine is never recorded.
    const engine = engineOf(plan.capture.receiver);
    if (engine !== undefined)
        writeVerifiedInsertionTree(plan.capture.receiver, engine);
}
export function captureUiChildren(parent) {
    return copyInsertionList(listOf(parent));
}
export function validateUiChildren(parent, expected) {
    const actual = readChildList(parent);
    if (actual === undefined || actual.length !== expected.length)
        return false;
    for (let index = 0; index < actual.length; index++) {
        if (actual[index] !== expected[index] || readParent(actual[index]) !== parent)
            return false;
    }
    return true;
}
export function publishUiTree(replacements) {
    for (let index = 0; index < replacements.length; index++) {
        const item = replacements[index];
        for (let childIndex = 0; childIndex < item.previous.length; childIndex++) {
            const child = item.previous[childIndex];
            deleteParent(child);
            recordVisualChange(child, VISUAL_STRUCTURE);
        }
        insertionWriteChildren(item.parent, item.next);
        recordVisualChange(item.parent, VISUAL_STRUCTURE);
    }
    for (let index = 0; index < replacements.length; index++) {
        const item = replacements[index];
        for (let childIndex = 0; childIndex < item.next.length; childIndex++) {
            const child = item.next[childIndex];
            insertionWriteParent(child, item.parent);
            recordVisualChange(child, VISUAL_STRUCTURE);
        }
    }
    // The replacement children were admitted by the UI commit, not by an indexed insertion.
    for (let index = 0; index < replacements.length; index++)
        forgetVerifiedInsertionTrees(replacements[index].parent);
}
/** One validated borrowed-child replacement; all storage was allocated in preparation. */
export function publishPreparedChildren(parent, previous, next) {
    for (let i = 0; i < previous.length; i++) {
        deleteParent(previous[i]);
        recordVisualChange(previous[i], VISUAL_STRUCTURE);
    }
    insertionWriteChildren(parent, next);
    insertionWriteParent(next[0], parent);
    recordVisualChange(parent, VISUAL_STRUCTURE);
    recordVisualChange(next[0], VISUAL_STRUCTURE);
    forgetVerifiedInsertionTrees(parent);
}
//# sourceMappingURL=displayTreeState.js.map