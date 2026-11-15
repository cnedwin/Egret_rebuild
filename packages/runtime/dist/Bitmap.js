import { captureAtlasFrameLayout, copyAtlasFrameLayout } from "./atlasFrameLayout.js";
import { isAssetLease, readAssetLeaseValue } from "./AssetLease.js";
import { AssetLease } from "./AssetLease.js";
import { DisplayObject } from "./DisplayObject.js";
import { hasBitmapState, readBitmapState, writeBitmapState } from "./bitmapDisplayState.js";
import { assertLive, isStageRoot, isTerminated } from "./displayTreeState.js";
import { collectPreparedSharedFrameContent } from "./sharedFrameCapture.js";
import { EgretError } from "./EgretError.js";
import { claimOwner, ownerOf, commitBinding, engineOf } from "./ownership.js";
import { isTexture, readTextureImage, readTextureSnapshot } from "./Texture.js";
/** Internal-only original Bitmap operations; neither public root forwards this port. */
export let spriteSheetBitmapOperations;
const mutations = new WeakSet();
const freezeAtlasState = Object.freeze;
const resourceTargetOperations = new WeakMap();
const freezeResourceOperations = Object.freeze;
const releaseResourceLease = AssetLease.prototype.release;
const applyResourceOperation = Reflect.apply;
/** Exact context and opaque prepared provenance stay inside this runtime module. */
function operationsFor(context) {
    let operations = resourceTargetOperations.get(context);
    if (operations !== undefined)
        return operations;
    const preparedStates = new WeakMap();
    const batchCaptures = new WeakMap();
    const batchPreparedStates = new WeakMap();
    const batchPublications = new WeakMap();
    const affinity = (value) => {
        if (engineOf(value) !== context)
            throw new EgretError("ENGINE_MISMATCH");
    };
    const batchAffinity = (targets) => {
        for (let index = 0; index < targets.length; index++) {
            affinity(targets[index]);
            assertBitmap(targets[index]);
        }
    };
    const batchLife = (targets) => {
        context.assertOpen();
        for (let index = 0; index < targets.length; index++)
            assertLive(targets[index]);
    };
    const capturedBatch = (captured) => {
        const entry = batchCaptures.get(captured);
        if (entry === undefined)
            throw new EgretError("BITMAP_RESOURCE_PREPARED_INVALID");
        return entry;
    };
    const expectedBatch = (entry) => {
        // Complete the entire token pass before reading even the first entitlement.
        for (let index = 0; index < entry.targets.length; index++) {
            if (readBitmapState(entry.targets[index]) !== entry.expected[index]) {
                throw new EgretError("BITMAP_RESOURCE_BINDING_CHANGED");
            }
        }
    };
    const batchImage = (lease) => {
        if (!isAssetLease(lease))
            throw new EgretError("BITMAP_LEASE_INVALID");
        affinity(lease);
        return readBitmapImage(lease);
    };
    const oldBatchImages = (entry) => {
        for (let index = 0; index < entry.expected.length; index++)
            batchImage(entry.expected[index].lease);
    };
    const liveBinding = (bitmap, expected) => {
        affinity(bitmap);
        const state = readBitmapBinding(bitmap);
        // A changed binding wins before any external entitlement revocation.
        if (expected !== undefined && state !== expected)
            throw new EgretError("BITMAP_RESOURCE_BINDING_CHANGED");
        if (state === undefined)
            throw new EgretError("BITMAP_RESOURCE_TEXTURE_REQUIRED");
        readBitmapImage(state.lease);
        return state;
    };
    operations = freezeResourceOperations({
        capture(bitmap, expected) {
            return liveBinding(bitmap, expected);
        },
        prepare(bitmap, lease) {
            affinity(bitmap);
            affinity(lease);
            liveBinding(bitmap);
            const snapshot = readBitmapImage(lease);
            // Use the captured intrinsic; no late public setter or freeze callback.
            const state = freezeResourceOperations({
                lease,
                sourceRect: snapshot.sourceRect,
                viewRegion: snapshot.viewRegion,
                width: snapshot.viewRegion?.logicalWidth ?? snapshot.sourceRect.width,
                height: snapshot.viewRegion?.logicalHeight ?? snapshot.sourceRect.height
            });
            preparedStates.set(state, { bitmap, state });
            return state;
        },
        commit(bitmap, expected, prepared) {
            affinity(bitmap);
            assertBitmap(bitmap);
            const entry = preparedStates.get(prepared);
            if (entry === undefined || entry.bitmap !== bitmap)
                throw new EgretError("BITMAP_RESOURCE_PREPARED_INVALID");
            affinity(entry.state.lease);
            assertLive(bitmap);
            context.assertOpen();
            if (mutations.has(bitmap))
                throw new EgretError("BITMAP_MUTATION_REENTRANT");
            const current = readBitmapState(bitmap);
            if (current !== expected)
                throw new EgretError("BITMAP_RESOURCE_BINDING_CHANGED");
            // Both entitlements are fresh even when expected state identity is unchanged.
            if (current === undefined)
                throw new EgretError("BITMAP_RESOURCE_TEXTURE_REQUIRED");
            readBitmapImage(current.lease);
            readBitmapImage(entry.state.lease);
            preparedStates.delete(prepared);
            writeBitmapState(bitmap, entry.state);
        },
        clearIfCurrent(bitmap, expected) {
            affinity(bitmap);
            assertBitmap(bitmap);
            const current = readBitmapState(bitmap);
            if (current === undefined || current !== expected)
                return false;
            writeBitmapState(bitmap, undefined);
            return true;
        },
        claim(bitmap, lease, owner) {
            affinity(bitmap);
            affinity(lease);
            assertBitmap(bitmap);
            assertLive(bitmap);
            context.assertOpen();
            if (!isAssetLease(lease) || ownerOf(lease) !== undefined)
                throw new EgretError("BITMAP_RESOURCE_LEASE_INVALID");
            readAssetLeaseValue(lease);
            claimOwner(lease, owner);
        },
        release(lease) {
            affinity(lease);
            if (!isAssetLease(lease))
                throw new EgretError("BITMAP_RESOURCE_LEASE_INVALID");
            applyResourceOperation(releaseResourceLease, lease, []);
        },
        captureBatch(targets) {
            if (!Array.isArray(targets) || targets.length < 1 || targets.length > 128) {
                throw new EgretError("BITMAP_BINDING_TARGETS_INVALID");
            }
            const copied = [], seen = new Set();
            for (let index = 0; index < targets.length; index++) {
                const bitmap = targets[index];
                affinity(bitmap);
                assertBitmap(bitmap);
                if (seen.has(bitmap))
                    throw new EgretError("BITMAP_BINDING_TARGETS_INVALID");
                seen.add(bitmap);
                copied.push(bitmap);
            }
            batchLife(copied);
            const expected = [];
            for (let index = 0; index < copied.length; index++) {
                const state = readBitmapState(copied[index]);
                if (state === undefined)
                    throw new EgretError("BITMAP_RESOURCE_TEXTURE_REQUIRED");
                expected.push(state);
            }
            for (let index = 0; index < expected.length; index++)
                batchImage(expected[index].lease);
            const captured = freezeResourceOperations({});
            batchCaptures.set(captured, freezeResourceOperations({
                targets: freezeResourceOperations(copied),
                expected: freezeResourceOperations(expected)
            }));
            return captured;
        },
        prepareBatch(captured, members) {
            const entry = capturedBatch(captured);
            batchAffinity(entry.targets);
            batchLife(entry.targets);
            if (!Array.isArray(members) || members.length !== entry.targets.length) {
                throw new EgretError("BITMAP_BINDING_MEMBERS_INVALID");
            }
            const leases = [];
            for (let index = 0; index < entry.targets.length; index++)
                leases.push(members[index]);
            batchLife(entry.targets);
            expectedBatch(entry);
            oldBatchImages(entry);
            const snapshots = [];
            for (let index = 0; index < leases.length; index++)
                snapshots.push(batchImage(leases[index]));
            const states = [];
            for (let index = 0; index < snapshots.length; index++) {
                const snapshot = snapshots[index];
                states.push(freezeResourceOperations({
                    lease: leases[index],
                    sourceRect: snapshot.sourceRect,
                    viewRegion: snapshot.viewRegion,
                    width: snapshot.viewRegion?.logicalWidth ?? snapshot.sourceRect.width,
                    height: snapshot.viewRegion?.logicalHeight ?? snapshot.sourceRect.height
                }));
            }
            const prepared = freezeResourceOperations({});
            batchPreparedStates.set(prepared, freezeResourceOperations({ captured, states: freezeResourceOperations(states) }));
            return prepared;
        },
        commitBatch(captured, prepared) {
            const entry = capturedBatch(captured);
            batchAffinity(entry.targets);
            const candidate = batchPreparedStates.get(prepared);
            if (candidate === undefined || candidate.captured !== captured)
                throw new EgretError("BITMAP_RESOURCE_PREPARED_INVALID");
            batchLife(entry.targets);
            for (let index = 0; index < entry.targets.length; index++) {
                if (mutations.has(entry.targets[index]))
                    throw new EgretError("BITMAP_MUTATION_REENTRANT");
            }
            expectedBatch(entry);
            oldBatchImages(entry);
            for (let index = 0; index < candidate.states.length; index++)
                batchImage(candidate.states[index].lease);
            // Allocate publication/provenance before consuming the plan or writing any target.
            const publication = freezeResourceOperations({});
            batchPublications.set(publication, { targets: entry.targets, states: candidate.states, active: true });
            batchPreparedStates.delete(prepared);
            for (let index = 0; index < entry.targets.length; index++)
                writeBitmapState(entry.targets[index], candidate.states[index]);
            return publication;
        },
        capturePreparedSharedContent(stage, captured, prepared) {
            const entry = capturedBatch(captured), candidate = batchPreparedStates.get(prepared);
            if (candidate === undefined || candidate.captured !== captured)
                throw new EgretError("BITMAP_RESOURCE_PREPARED_INVALID");
            const validate = () => {
                if (batchCaptures.get(captured) !== entry || batchPreparedStates.get(prepared) !== candidate) {
                    throw new EgretError("BITMAP_RESOURCE_PREPARED_INVALID");
                }
                if (!isStageRoot(stage))
                    throw new EgretError("FRAME_STAGE_INVALID");
                affinity(stage);
                batchAffinity(entry.targets);
                batchLife(entry.targets);
                for (let index = 0; index < entry.targets.length; index++) {
                    if (mutations.has(entry.targets[index]))
                        throw new EgretError("BITMAP_MUTATION_REENTRANT");
                }
                expectedBatch(entry);
                oldBatchImages(entry);
                for (let index = 0; index < candidate.states.length; index++)
                    batchImage(candidate.states[index].lease);
            };
            validate();
            const selected = new Map();
            for (let index = 0; index < entry.targets.length; index++)
                selected.set(entry.targets[index], candidate.states[index]);
            // The completed map never escapes this frozen view or receives another write.
            // Whole states preserve crop, logical dimensions, rotation and atlas metadata.
            const view = freezeResourceOperations({
                read(node) {
                    return selected.get(node) ?? readBitmapState(node);
                }
            });
            const content = collectPreparedSharedFrameContent(stage, view);
            validate();
            return content;
        },
        clearBatchIfCurrent(publication) {
            const entry = batchPublications.get(publication);
            if (entry === undefined)
                throw new EgretError("BITMAP_RESOURCE_PREPARED_INVALID");
            batchAffinity(entry.targets);
            if (!entry.active)
                return;
            entry.active = false;
            // Cleanup is valid during closing, after target disposal or lease revocation.
            for (let index = 0; index < entry.targets.length; index++) {
                const target = entry.targets[index];
                if (readBitmapState(target) === entry.states[index])
                    writeBitmapState(target, undefined);
            }
        }
    });
    resourceTargetOperations.set(context, operations);
    return operations;
}
function assertBitmap(value) {
    if (!hasBitmapState(value))
        throw new EgretError("BITMAP_INVALID");
}
function captureState(lease, sourceRect, viewRegion = null) {
    return Object.freeze({
        lease,
        sourceRect,
        viewRegion,
        width: viewRegion?.logicalWidth ?? sourceRect.width,
        height: viewRegion?.logicalHeight ?? sourceRect.height
    });
}
/** Shared lease/crop guard starts after the established lifecycle priority. */
function beginMutation(node) {
    assertBitmap(node);
    assertLive(node);
    const engine = engineOf(node);
    engine.assertOpen();
    if (mutations.has(node))
        throw new EgretError("BITMAP_MUTATION_REENTRANT");
    mutations.add(node);
    return engine;
}
/** Terminal side effects win before numeric semantics; no slot resurrection. */
function revalidateMutation(node, engine, previous) {
    assertLive(node);
    engine.assertOpen();
    if (readBitmapState(node) !== previous)
        throw new EgretError("BITMAP_MUTATION_REENTRANT");
}
/** Complete ordered external reads before semantics; preserve every thrown cause. */
function readRegion(input) {
    if (input === null || typeof input !== "object") {
        throw new EgretError("BITMAP_REGION_INVALID", { cause: new TypeError("Bitmap region must be a record") });
    }
    let x, y, width, height;
    try {
        x = input.x;
        y = input.y;
        width = input.width;
        height = input.height;
    }
    catch (cause) {
        throw new EgretError("BITMAP_REGION_INVALID", { cause });
    }
    // Keep allocation outside the read-fault wrapper and retain no caller record.
    return { x, y, width, height };
}
function regionInteger(value, positive) {
    if (typeof value !== "number") {
        throw new EgretError("BITMAP_REGION_INVALID", { cause: new TypeError("Bitmap region fields must be numbers") });
    }
    if (!Number.isSafeInteger(value) || (positive ? value <= 0 : value < 0)) {
        throw new EgretError("BITMAP_REGION_INVALID", { cause: new RangeError("Bitmap region integer range") });
    }
    return value === 0 ? 0 : value;
}
/** Absolute crops stay within the authenticated Texture's immutable image view. */
function copyRegion(base, fields) {
    const x = regionInteger(fields.x, false), y = regionInteger(fields.y, false);
    const width = regionInteger(fields.width, true), height = regionInteger(fields.height, true);
    const right = x + width, bottom = y + height;
    if (!Number.isSafeInteger(right) ||
        !Number.isSafeInteger(bottom) ||
        x < base.x ||
        y < base.y ||
        right > base.x + base.width ||
        bottom > base.y + base.height) {
        throw new EgretError("BITMAP_REGION_INVALID", { cause: new RangeError("Bitmap region exceeds its Texture view") });
    }
    return Object.freeze({ x, y, width, height });
}
/** A leaf borrowing one exact lease; engine affinity outlives clearing its slot. */
export class Bitmap extends DisplayObject {
    constructor(textureLease) {
        super();
        const snapshot = readBitmapImage(textureLease);
        const engine = engineOf(textureLease);
        engine.assertOpen();
        commitBinding([this], engine);
        writeBitmapState(this, captureState(textureLease, snapshot.sourceRect, snapshot.viewRegion));
        // Genuine Engine registration is private; custom runtime contexts own their callback.
        engine.registerBitmapResourceTarget?.(this, operationsFor(engine));
    }
    static {
        // Capture originals before callers can patch this prototype or load a later facade.
        const OriginalBitmap = this;
        const setCrop = Object.getOwnPropertyDescriptor(this.prototype, "sourceRect").set;
        const dispose = this.prototype.dispose;
        const apply = Reflect.apply;
        spriteSheetBitmapOperations = Object.freeze({
            construct: (lease) => new OriginalBitmap(lease),
            setCrop: (bitmap, region) => {
                apply(setCrop, bitmap, [region]);
            },
            dispose: (bitmap) => {
                apply(dispose, bitmap, []);
            }
        });
    }
    get textureLease() {
        assertBitmap(this);
        return readBitmapState(this)?.lease;
    }
    set textureLease(value) {
        const engine = beginMutation(this);
        try {
            const previous = readBitmapState(this);
            if (value === undefined) {
                writeBitmapState(this, undefined);
                return;
            }
            if (!isAssetLease(value))
                throw new EgretError("BITMAP_LEASE_INVALID");
            if (engineOf(value) !== engine)
                throw new EgretError("ENGINE_MISMATCH");
            const snapshot = readBitmapImage(value);
            revalidateMutation(this, engine, previous);
            // Every successful assignment, including the same lease, resets the crop.
            writeBitmapState(this, captureState(value, snapshot.sourceRect, snapshot.viewRegion));
        }
        finally {
            mutations.delete(this);
        }
    }
    /** Cached metadata remains readable without granting live image entitlement. */
    get sourceRect() {
        assertBitmap(this);
        return readBitmapState(this)?.sourceRect;
    }
    set sourceRect(value) {
        const engine = beginMutation(this);
        try {
            const previous = readBitmapState(this);
            if (previous === undefined) {
                if (value !== undefined)
                    throw new EgretError("BITMAP_TEXTURE_REQUIRED");
                return;
            }
            // Entitlement and live-view authority precede every external field read.
            const snapshot = readBitmapImage(previous.lease);
            if (snapshot.viewRegion !== null)
                throw new EgretError("TEXTURE_VIEW_REGION_IMMUTABLE");
            if (value === undefined) {
                revalidateMutation(this, engine, previous);
                writeBitmapState(this, captureState(previous.lease, snapshot.sourceRect));
                return;
            }
            const fields = readRegion(value);
            revalidateMutation(this, engine, previous);
            const current = readBitmapImage(previous.lease);
            const sourceRect = copyRegion(current.sourceRect, fields);
            // Crop and natural geometry become observable together, without callbacks.
            writeBitmapState(this, captureState(previous.lease, sourceRect));
        }
        finally {
            mutations.delete(this);
        }
    }
    get naturalWidth() {
        assertBitmap(this);
        return readBitmapState(this)?.width ?? 0;
    }
    get naturalHeight() {
        assertBitmap(this);
        return readBitmapState(this)?.height ?? 0;
    }
    /** Drop the borrow before base cleanup/reentry; the caller still owns the lease. */
    dispose() {
        assertBitmap(this);
        if (isTerminated(this))
            return;
        writeBitmapState(this, undefined);
        super.dispose();
    }
}
/** Brand and slot only: geometry may be validated before any lease read. */
export function bitmapCaptureState(node) {
    return readBitmapState(node);
}
/** Internal binding authority; a cleared slot remains distinguishable from retirement. */
export function readBitmapBinding(node) {
    assertBitmap(node);
    assertLive(node);
    engineOf(node).assertOpen();
    return readBitmapState(node);
}
/** Exact entitlement precedes value/live checks; public value getters are not authority. */
export function readBitmapImage(lease) {
    if (!isAssetLease(lease))
        throw new EgretError("BITMAP_LEASE_INVALID");
    const value = readAssetLeaseValue(lease);
    if (!isTexture(value))
        throw new EgretError("BITMAP_TEXTURE_INVALID");
    return readTextureSnapshot(value);
}
/**
 * The image of a lease that `readBitmapImage` has admitted before: the same entitlement, value and live
 * checks with the same refusals, and no record made. A lease stays a lease, so that one check is not repeated.
 */
export function readBitmapSource(lease) {
    const value = readAssetLeaseValue(lease);
    if (!isTexture(value))
        throw new EgretError("BITMAP_TEXTURE_INVALID");
    return readTextureImage(value);
}
/** Private complete-frame bridge; public crop setters deliberately ignore layout. */
export function applyBitmapAtlasFrame(bitmap, region) {
    const engine = beginMutation(bitmap);
    try {
        const previous = readBitmapState(bitmap);
        if (previous === undefined)
            throw new EgretError("BITMAP_TEXTURE_REQUIRED");
        const initial = readBitmapImage(previous.lease);
        // Internal atlas bridges obey the same immutable-view rule as public crop.
        if (initial.viewRegion !== null)
            throw new EgretError("TEXTURE_VIEW_REGION_IMMUTABLE");
        const fields = readRegion(region);
        const captured = captureAtlasFrameLayout(region, (source, key) => {
            try {
                const present = Object.hasOwn(source, key);
                return { present, value: present ? source[key] : undefined };
            }
            catch (cause) {
                throw new EgretError("BITMAP_REGION_INVALID", { cause });
            }
        }, callback => {
            try {
                return callback();
            }
            catch (cause) {
                throw new EgretError("BITMAP_REGION_INVALID", { cause });
            }
        });
        revalidateMutation(bitmap, engine, previous);
        const snapshot = readBitmapImage(previous.lease);
        const sourceRect = copyRegion(snapshot.sourceRect, fields);
        const layout = copyAtlasFrameLayout(captured, sourceRect.width, sourceRect.height, () => {
            throw new EgretError("BITMAP_REGION_INVALID");
        });
        const next = freezeAtlasState({
            lease: previous.lease,
            sourceRect,
            layout,
            viewRegion: null,
            width: layout.sourceWidth,
            height: layout.sourceHeight
        });
        revalidateMutation(bitmap, engine, previous);
        readBitmapImage(previous.lease);
        // Publish one new token, even for identical crop/layout scalars (ABA protection).
        writeBitmapState(bitmap, next);
    }
    finally {
        mutations.delete(bitmap);
    }
}
//# sourceMappingURL=Bitmap.js.map