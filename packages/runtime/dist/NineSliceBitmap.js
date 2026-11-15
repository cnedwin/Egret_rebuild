import { isAssetLease, readAssetLeaseValue } from "./AssetLease.js";
import { DisplayObject } from "./DisplayObject.js";
import { assertLive, isTerminated } from "./displayTreeState.js";
import { EgretError } from "./EgretError.js";
import { writeMeshState } from "./meshDisplayState.js";
import { createNineSliceGeometry2D } from "./NineSliceGeometry2D.js";
import { commitBinding, engineOf } from "./ownership.js";
import { isTexture, readTextureSnapshot } from "./Texture.js";
// Capture operations before a descriptor can replace public intrinsics or ports.
const isArray = Array.isArray;
const freeze = Object.freeze;
const TypeFault = TypeError;
const apply = Reflect.apply;
const originalDispose = DisplayObject.prototype.dispose;
const geometryFactory = createNineSliceGeometry2D;
const writeContent = writeMeshState;
const states = new WeakMap();
const lookup = states.get.bind(states);
const register = states.set.bind(states);
/** Class identity is separate from the shared textured-capture content slot. */
function stateOf(receiver) {
    const state = lookup(receiver);
    if (state === undefined)
        throw new EgretError("NINE_SLICE_BITMAP_INVALID");
    return state;
}
/** Exact lease entitlement precedes Texture brand and live-image authority. */
function textureOf(lease) {
    const value = readAssetLeaseValue(lease);
    if (!isTexture(value))
        throw new EgretError("NINE_SLICE_BITMAP_TEXTURE_INVALID");
    return readTextureSnapshot(value);
}
/** A successful external read observes Engine, then lease, then Texture lifetime. */
function checkpoint(engine, lease) {
    engine.assertOpen();
    return textureOf(lease);
}
function descriptor(value) {
    if (typeof value !== "object" || value === null) {
        throw new TypeFault("NineSliceBitmap descriptor must be a non-array object");
    }
    let array;
    try {
        array = isArray(value);
    }
    catch (cause) {
        throw new TypeFault("NineSliceBitmap descriptor admission failed", { cause });
    }
    if (array)
        throw new TypeFault("NineSliceBitmap descriptor must be a non-array object");
    return value;
}
/** Throwing reads keep their original cause; only successful reads checkpoint. */
function read(source, key, engine, lease) {
    let value;
    try {
        value = source[key];
    }
    catch (cause) {
        throw new TypeFault("NineSliceBitmap descriptor read failed", { cause });
    }
    checkpoint(engine, lease);
    return value;
}
function primitiveNumber(value) {
    if (typeof value !== "number")
        throw new TypeFault("NineSliceBitmap dimensions and borders must be primitive numbers");
    return value === 0 ? 0 : value;
}
function geometry(sourceRect, viewRegion, width, height, insets) {
    // The existing NS1 factory owns all range, precision and grid admission.
    return geometryFactory({
        sourceWidth: viewRegion?.logicalWidth ?? sourceRect.width,
        sourceHeight: viewRegion?.logicalHeight ?? sourceRect.height,
        targetWidth: width,
        targetHeight: height,
        insets
    });
}
function content(lease, owned, sourceRect, viewRegion) {
    return freeze({ lease, geometry: owned, sourceRect, viewRegion, regionOnly: true });
}
/** A resizable stretch-only leaf borrowing one exact, caller-owned Texture lease. */
export class NineSliceBitmap extends DisplayObject {
    constructor(textureLease, options) {
        super();
        if (!isAssetLease(textureLease))
            throw new EgretError("NINE_SLICE_BITMAP_LEASE_INVALID");
        const initial = textureOf(textureLease);
        const engine = engineOf(textureLease);
        engine.assertOpen();
        const outer = descriptor(options);
        const widthInput = read(outer, "width", engine, textureLease);
        const heightInput = read(outer, "height", engine, textureLease);
        // The successful insets read checkpoints before admitting that object.
        const inset = descriptor(read(outer, "insets", engine, textureLease));
        const leftInput = read(inset, "left", engine, textureLease);
        const topInput = read(inset, "top", engine, textureLease);
        const rightInput = read(inset, "right", engine, textureLease);
        const bottomInput = read(inset, "bottom", engine, textureLease);
        // Finish every primitive check before NS1 performs any numeric range check.
        const width = primitiveNumber(widthInput), height = primitiveNumber(heightInput);
        const left = primitiveNumber(leftInput), top = primitiveNumber(topInput);
        const right = primitiveNumber(rightInput), bottom = primitiveNumber(bottomInput);
        const insets = { left, top, right, bottom };
        const owned = geometry(initial.sourceRect, initial.viewRegion, width, height, insets);
        const fixedInsets = freeze(insets);
        const size = freeze({ width, height });
        const slot = content(textureLease, owned, initial.sourceRect, initial.viewRegion);
        const state = {
            sourceRect: initial.sourceRect,
            viewRegion: initial.viewRegion,
            insets: fixedInsets,
            lease: textureLease,
            size
        };
        checkpoint(engine, textureLease);
        // All allocations/admission precede the callback-free affinity/content commit.
        commitBinding([this], engine);
        writeContent(this, slot);
        register(this, state);
    }
    /** Identity-only borrow metadata conveys no live resource entitlement. */
    get textureLease() {
        return stateOf(this).lease;
    }
    get targetWidth() {
        return stateOf(this).size.width;
    }
    get targetHeight() {
        return stateOf(this).size.height;
    }
    get insets() {
        return stateOf(this).insets;
    }
    resize(width, height) {
        const state = stateOf(this);
        assertLive(this);
        const engine = engineOf(this);
        engine.assertOpen();
        const lease = state.lease;
        textureOf(lease);
        const targetWidth = primitiveNumber(width), targetHeight = primitiveNumber(height);
        const owned = geometry(state.sourceRect, state.viewRegion, targetWidth, targetHeight, state.insets);
        const size = freeze({ width: targetWidth, height: targetHeight });
        const slot = content(lease, owned, state.sourceRect, state.viewRegion);
        assertLive(this);
        checkpoint(engine, lease);
        // Publish only prepared immutable values, without events or public setters.
        writeContent(this, slot);
        state.size = size;
    }
    /** Drop the borrow before base terminal cleanup; the caller still owns it. */
    dispose() {
        const state = stateOf(this);
        writeContent(this, undefined);
        state.lease = undefined;
        if (isTerminated(this))
            return;
        apply(originalDispose, this, []);
    }
}
//# sourceMappingURL=NineSliceBitmap.js.map