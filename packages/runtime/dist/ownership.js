import { EgretError } from './EgretError.js';
import { recordVisualChange, VISUAL_BINDING } from './displayVisualState.js';
import { assertLive, captureChildInsertion, childrenOf, isDisplayNode, prepareCapturedInsertionTree, publishCapturedInsertionTree, validateCapturedInsertionNode, validateCapturedInsertionRoots, validateCapturedInsertionSource } from './displayTreeState.js';
export const OWNERSHIP_CHILDREN = Symbol('egret.ownershipChildren');
export const ASSERT_BINDABLE = Symbol('egret.assertBindable');
export const ASSERT_ATTACHABLE = Symbol('egret.assertAttachable');
// Cleanup ownership and engine affinity are separate lifetime identities.
const owners = new WeakMap();
const engines = new WeakMap();
export function ownerOf(value) {
    return owners.get(value);
}
export function engineOf(value) {
    return engines.get(value);
}
export function claimOwner(value, owner) {
    owners.set(value, owner);
}
export function engineInSubtree(value) {
    const pending = [value];
    while (pending.length !== 0) {
        const current = pending.pop();
        if (current === undefined)
            break;
        const engine = engineOf(current);
        if (engine !== undefined)
            return engine;
        if (isDisplayNode(current))
            pending.push(...childrenOf(current));
    }
    return undefined;
}
/** Validate every descendant before touching any owner, binding, or parent. */
export function preflightBinding(value, engine) {
    engine.assertOpen();
    const pending = [value];
    const values = [];
    while (pending.length !== 0) {
        const current = pending.pop();
        if (current === undefined)
            break;
        const existing = engineOf(current);
        if (existing !== undefined && existing !== engine)
            throw new EgretError('ENGINE_MISMATCH');
        if (isDisplayNode(current)) {
            current[ASSERT_BINDABLE]();
            pending.push(...childrenOf(current));
        }
        values.push(current);
    }
    return values;
}
/** Callback-free final validation uses the current tree and binding authority. */
export function validateBinding(value, engine) {
    engine.assertOpen();
    const pending = [value];
    const values = [];
    while (pending.length !== 0) {
        const current = pending.pop();
        if (current === undefined)
            break;
        const existing = engineOf(current);
        if (existing !== undefined && existing !== engine)
            throw new EgretError('ENGINE_MISMATCH');
        if (isDisplayNode(current)) {
            assertLive(current);
            pending.push(...childrenOf(current));
        }
        values.push(current);
    }
    return values;
}
/** Commit only values returned by callback-free validation, without intervening hooks. */
export function commitBinding(values, engine) {
    for (const value of values) {
        const changed = readInsertionEngine(value) !== engine;
        engines.set(value, engine);
        if (changed)
            recordVisualChange(value, VISUAL_BINDING);
    }
}
export function bind(value, engine) {
    preflightBinding(value, engine);
    commitBinding(validateBinding(value, engine), engine);
}
// The new finite coordinator owns captured affinity reads/writes, separate from legacy bind.
const readInsertionEngine = engines.get.bind(engines);
const writeInsertionEngine = engines.set.bind(engines);
const InsertionBindingSet = Set;
const insertionBindingHas = Set.prototype.has.call.bind(Set.prototype.has);
const insertionBindingAdd = Set.prototype.add.call.bind(Set.prototype.add);
function captureInsertionAffinities(records) {
    const affinities = [];
    for (let index = 0; index < records.length; index++) {
        const record = records[index];
        affinities[index] = { record, engine: readInsertionEngine(record.node) };
    }
    return affinities;
}
function firstInsertionEngine(records) {
    for (let index = 0; index < records.length; index++) {
        const engine = records[index].engine;
        if (engine !== undefined)
            return engine;
    }
    return undefined;
}
function validateInsertionAffinities(records, engine) {
    for (let index = 0; index < records.length; index++) {
        const current = records[index];
        validateCapturedInsertionNode(current.record);
        if (current.engine !== undefined && current.engine !== engine)
            throw new EgretError('ENGINE_MISMATCH');
    }
}
/** One post-last-hook capture supplies Engine selection, validation and all preparation. */
export function prepareChildInsertion(receiver, child, index) {
    const capture = captureChildInsertion(receiver, child);
    const receiverAffinities = captureInsertionAffinities(capture.receiverTree);
    const incomingAffinities = captureInsertionAffinities(capture.incomingTree);
    const engine = firstInsertionEngine(receiverAffinities) ?? firstInsertionEngine(incomingAffinities);
    engine?.assertOpen();
    validateCapturedInsertionRoots(capture, index);
    // Both complete trees are always validated, including a wholly Engine-free capture.
    validateInsertionAffinities(receiverAffinities, engine);
    validateInsertionAffinities(incomingAffinities, engine);
    validateCapturedInsertionSource(capture);
    const tree = prepareCapturedInsertionTree(capture, index);
    const stagedBindings = [];
    const seen = new InsertionBindingSet();
    if (engine !== undefined) {
        for (let treeIndex = 0; treeIndex < 2; treeIndex++) {
            const records = treeIndex === 0 ? receiverAffinities : incomingAffinities;
            for (let position = 0; position < records.length; position++) {
                const current = records[position], node = current.record.node;
                if (current.engine === undefined && node !== undefined && !insertionBindingHas(seen, node)) {
                    insertionBindingAdd(seen, node);
                    stagedBindings[stagedBindings.length] = node;
                }
            }
        }
    }
    // Every explicit list, value and plan allocation finishes before the first outer write.
    return { tree, receiverAffinities, incomingAffinities, engine, stagedBindings };
}
/** Straight-line commit has no hook, validation, explicit allocation or ownership write. */
export function publishPreparedChildInsertion(plan) {
    if (plan.engine !== undefined) {
        for (let index = 0; index < plan.stagedBindings.length; index++) {
            const node = plan.stagedBindings[index];
            writeInsertionEngine(node, plan.engine);
            recordVisualChange(node, VISUAL_BINDING);
        }
    }
    publishCapturedInsertionTree(plan.tree);
}
//# sourceMappingURL=ownership.js.map