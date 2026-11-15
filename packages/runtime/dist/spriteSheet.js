import { isAssetLease } from "./AssetLease.js";
import { applyBitmapAtlasFrame, readBitmapImage, spriteSheetBitmapOperations } from "./Bitmap.js";
import { EgretError } from "./EgretError.js";
import { commitBinding, engineOf } from "./ownership.js";
import { captureAtlasFrameLayout, copyAtlasFrameLayout } from "./atlasFrameLayout.js";
const states = new WeakMap();
const arrayIsArray = Array.isArray;
const hasOwnProperty = Object.prototype.hasOwnProperty;
const apply = Reflect.apply;
function stateOf(receiver) {
    const state = states.get(receiver);
    if (state === undefined)
        throw new EgretError("SPRITE_SHEET_INVALID");
    return state;
}
/** Original context and private resource slots precede caller-controlled fields. */
function readAtlas(engine, lease, expectedImage) {
    engine.assertOpen();
    const snapshot = readBitmapImage(lease);
    const { image, sourceRect } = snapshot;
    if (snapshot.viewRegion !== null ||
        sourceRect.x !== 0 ||
        sourceRect.y !== 0 ||
        sourceRect.width !== image.width ||
        sourceRect.height !== image.height ||
        (expectedImage !== undefined && image !== expectedImage)) {
        throw new EgretError("SPRITE_SHEET_ATLAS_INVALID");
    }
    return snapshot;
}
/** A successful source operation is revalidated outside its read-fault catch. */
function readSource(operation, revalidate) {
    let result;
    let failed = false;
    let cause;
    try {
        result = operation();
    }
    catch (error) {
        failed = true;
        cause = error;
    }
    // The occurrence flag preserves a caller that throws undefined.
    if (failed)
        throw new EgretError("SPRITE_SHEET_READ_FAILED", { cause });
    revalidate();
    return result;
}
function own(input, key, revalidate) {
    return readSource(() => apply(hasOwnProperty, input, [key]), revalidate);
}
function readField(input, key, revalidate) {
    const present = own(input, key, revalidate);
    const value = present ? readSource(() => input[key], revalidate) : undefined;
    return { present, value };
}
/** Missing known fields are staged; a later read occurrence keeps its priority. */
function stageFrames(input, revalidate, atlasLayout) {
    if (!readSource(() => arrayIsArray(input), revalidate))
        throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
    if (!own(input, "length", revalidate))
        throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
    const length = readSource(() => input.length, revalidate);
    if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 1) {
        throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
    }
    if (length > 1024)
        throw new EgretError("SPRITE_SHEET_LIMIT");
    const staged = [];
    for (let index = 0; index < length; index += 1) {
        if (!own(input, String(index), revalidate))
            throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
        const record = readSource(() => input[index], revalidate);
        if (record === null || typeof record !== "object")
            throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
        if (readSource(() => arrayIsArray(record), revalidate))
            throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
        const name = readField(record, "name", revalidate);
        const x = readField(record, "x", revalidate);
        const y = readField(record, "y", revalidate);
        const width = readField(record, "width", revalidate);
        const height = readField(record, "height", revalidate);
        const layout = atlasLayout
            ? captureAtlasFrameLayout(record, (source, key) => readField(source, key, revalidate), callback => readSource(callback, revalidate))
            : undefined;
        staged.push({ name, x, y, width, height, ...(layout === undefined ? {} : { layout }) });
    }
    return staged;
}
function qualifyName(value) {
    if (typeof value !== "string")
        throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
    if (value.length === 0)
        throw new EgretError("SPRITE_SHEET_NAME_INVALID");
    if (value.length > 128)
        throw new EgretError("SPRITE_SHEET_LIMIT");
    return value;
}
function coordinate(value, positive) {
    if (typeof value !== "number")
        throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
    if (!Number.isSafeInteger(value) || (positive ? value <= 0 : value < 0)) {
        throw new EgretError("SPRITE_SHEET_REGION_INVALID");
    }
    return value === 0 ? 0 : value;
}
function findRegion(state, name) {
    const key = qualifyName(name);
    const region = state.regions.get(key);
    if (region === undefined)
        throw new EgretError("SPRITE_SHEET_FRAME_UNKNOWN");
    return region;
}
function assertCreationLive(state, lease) {
    if (state.disposed)
        throw new EgretError("SPRITE_SHEET_DISPOSED");
    // Keep context authority after disposal, but never reconstruct a dropped borrow.
    readAtlas(state.engine, lease, state.image);
}
/** Only an operation throw is wrapped; successful terminal side effects stay lifecycle errors. */
function bitmapOperation(operation) {
    let result;
    let failed = false;
    let cause;
    try {
        result = operation();
    }
    catch (error) {
        failed = true;
        cause = error;
    }
    if (failed)
        throw new EgretError("SPRITE_SHEET_BITMAP_FAILED", { cause });
    return result;
}
function recordCleanup(state, cause) {
    // Observers and recording failures cannot replace the selected primary error.
    try {
        state.engine.captureCleanup(cause);
    }
    catch {
        /* Preserve the primary. */
    }
    try {
        state.engine.report({ code: "SPRITE_SHEET_BITMAP_FAILED", phase: "display-tree", severity: "error", cause });
    }
    catch {
        /* Advanced context observers are observation only. */
    }
}
/** A private failed Bitmap is retired once; caller-owned leases are never released. */
function retireFailedBitmap(state, bitmap, primary) {
    if (bitmap === undefined)
        return primary;
    let cleanupFailed = false;
    let cleanupCause;
    try {
        spriteSheetBitmapOperations.dispose(bitmap);
    }
    catch (cause) {
        cleanupFailed = true;
        cleanupCause = cause;
    }
    if (!cleanupFailed)
        return primary;
    recordCleanup(state, cleanupCause);
    if (primary instanceof EgretError) {
        return new EgretError(primary.code, {
            cause: primary.cause,
            cleanupErrors: [...primary.cleanupErrors, cleanupCause]
        });
    }
    return new EgretError("SPRITE_SHEET_BITMAP_FAILED", { cause: primary, cleanupErrors: [cleanupCause] });
}
function createBitmap(receiver, name) {
    const state = stateOf(receiver);
    if (state.disposed)
        throw new EgretError("SPRITE_SHEET_DISPOSED");
    state.engine.assertOpen();
    if (state.creatingBitmap)
        throw new EgretError("SPRITE_SHEET_REENTRANT");
    state.creatingBitmap = true;
    let bitmap;
    try {
        const lease = state.lease;
        assertCreationLive(state, lease);
        const region = findRegion(state, name);
        bitmap = bitmapOperation(() => spriteSheetBitmapOperations.construct(lease));
        assertCreationLive(state, lease);
        if (region.layout === undefined)
            bitmapOperation(() => spriteSheetBitmapOperations.setCrop(bitmap, region));
        else
            bitmapOperation(() => applyBitmapAtlasFrame(bitmap, region));
        assertCreationLive(state, lease);
        // Return no cache or ownership claim: the caller owns the genuine Bitmap.
        return bitmap;
    }
    catch (primary) {
        throw retireFailedBitmap(state, bitmap, primary);
    }
    finally {
        state.creatingBitmap = false;
    }
}
/** Facade methods close over no factory input, lease or image. */
function createFacade() {
    function receiverState(receiver) {
        if (receiver !== sheet)
            throw new EgretError("SPRITE_SHEET_INVALID");
        return stateOf(receiver);
    }
    const sheet = Object.freeze({
        get frameCount() {
            return receiverState(this).names.length;
        },
        get names() {
            return receiverState(this).names;
        },
        get atlasWidth() {
            return receiverState(this).atlasWidth;
        },
        get atlasHeight() {
            return receiverState(this).atlasHeight;
        },
        get isDisposed() {
            return receiverState(this).disposed;
        },
        getRegion(name) {
            return findRegion(receiverState(this), name);
        },
        createBitmap(name) {
            receiverState(this);
            return createBitmap(this, name);
        },
        dispose() {
            const state = receiverState(this);
            if (state.disposed)
                return;
            // Retire the borrow before any subsequent cleanup/reentry opportunity.
            state.disposed = true;
            state.lease = undefined;
            state.image = undefined;
        }
    });
    return sheet;
}
/** Build one exact-name table from a genuine full-image lease without acquiring another resource. */
export function createSpriteSheet(atlasLease, frames, profile) {
    if (!isAssetLease(atlasLease))
        throw new EgretError("SPRITE_SHEET_LEASE_INVALID");
    const engine = engineOf(atlasLease);
    const snapshot = readAtlas(engine, atlasLease);
    const { image } = snapshot;
    if (profile !== undefined && profile !== "trim-rotation-v1")
        throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
    const revalidate = () => {
        readAtlas(engine, atlasLease, image);
    };
    const staged = stageFrames(frames, revalidate, profile !== undefined);
    const validated = [];
    const seenNames = new Set();
    let totalNameUnits = 0;
    for (const frame of staged) {
        if (!frame.name.present || !frame.x.present || !frame.y.present || !frame.width.present || !frame.height.present) {
            throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
        }
        const name = qualifyName(frame.name.value);
        totalNameUnits += name.length;
        if (totalNameUnits > 32768)
            throw new EgretError("SPRITE_SHEET_LIMIT");
        if (seenNames.has(name))
            throw new EgretError("SPRITE_SHEET_NAME_INVALID");
        const x = coordinate(frame.x.value, false);
        const y = coordinate(frame.y.value, false);
        const width = coordinate(frame.width.value, true);
        const height = coordinate(frame.height.value, true);
        const right = x + width, bottom = y + height;
        if (!Number.isSafeInteger(right) || !Number.isSafeInteger(bottom) || right > image.width || bottom > image.height) {
            throw new EgretError("SPRITE_SHEET_REGION_INVALID");
        }
        seenNames.add(name);
        const layout = frame.layout === undefined
            ? undefined
            : copyAtlasFrameLayout(frame.layout, width, height, kind => {
                throw new EgretError(kind === "shape" ? "SPRITE_SHEET_INPUT_INVALID" : "SPRITE_SHEET_REGION_INVALID");
            });
        validated.push({ name, x, y, width, height, ...(layout === undefined ? {} : { layout }) });
    }
    // Allocate public-owned crops only after the complete staged table qualifies.
    const names = [];
    const regions = new Map();
    for (const frame of validated) {
        regions.set(frame.name, Object.freeze({
            x: frame.x,
            y: frame.y,
            width: frame.width,
            height: frame.height,
            ...(frame.layout === undefined ? {} : { layout: frame.layout })
        }));
        names.push(frame.name);
    }
    const state = {
        engine,
        names: Object.freeze(names),
        regions,
        atlasWidth: image.width,
        atlasHeight: image.height,
        lease: atlasLease,
        image,
        disposed: false,
        creatingBitmap: false
    };
    const sheet = createFacade();
    const binding = [sheet];
    revalidate();
    // All callback-capable work is complete before private state/affinity publication.
    states.set(sheet, state);
    commitBinding(binding, engine);
    return sheet;
}
//# sourceMappingURL=spriteSheet.js.map