import { copySharedPagePixels } from '../rendering/sharedColor2D.js';
import { noteOwnedPreparationFailure } from '../rendering/ownedPreparationFailure2D.js';
// Page texture bytes awaiting completion, and conversion memory held at once, are each bounded by
// two frames' worth of pages, as the number of accepted frames is bounded by two.
const pendingPageBytes = (framePageBytes) => 2 * Math.min(67108864, framePageBytes ?? 67108864);
export class SharedStorageError2D extends Error {
    reason;
    constructor(reason) {
        super('Shared storage ' + reason);
        this.reason = reason;
    }
}
function fail(reason) {
    throw noteOwnedPreparationFailure(new SharedStorageError2D(reason));
}
/** Joint logical fees precede readback layout, native limits, pending checks and payloads. */
export function planSharedStorageFees2D(prepared, options) {
    const { width, height } = prepared, colorBytes = 4 * width * height, effectBytes = colorBytes * prepared.effects.targetCount, upload = prepared.upload;
    if (!Number.isSafeInteger(colorBytes) ||
        colorBytes + effectBytes > 67108864 ||
        !Number.isSafeInteger(upload) ||
        upload > options.maxUploadBytes)
        fail('budget');
    return { prepared, options, upload, colorBytes, effectBytes };
}
/** No allocator or callback is accepted; the caller supplies its already computed layout. */
export function withSharedReadbackLayout2D(fees, layout) {
    const { rowPitch, staging, output } = layout;
    if (!Number.isSafeInteger(staging) || staging + output > fees.options.maxReadbackBytes)
        fail('budget');
    return { ...fees, rowPitch, staging, output };
}
export function checkSharedCapacity2D(storage, owner, canonicalBytes = 0, sourceCopy = 0) {
    const { options, prepared } = storage;
    const check = (used, amount, limit) => {
        if (!Number.isSafeInteger(used) || used < 0 || !Number.isSafeInteger(amount) || amount < 0 || amount > limit - used)
            fail('backpressure');
    };
    check(owner.pendingFrames, 1, options.maxPendingFrames);
    check(owner.pendingUploadBytes, storage.upload, options.maxPendingUploadBytes);
    check(owner.pendingReadbackBytes, storage.staging + storage.output, options.maxReadbackBytes);
    const pagesAtOnce = pendingPageBytes(options.maxFramePageBytes);
    check(owner.pendingTextureBytes, prepared.pageBytes, pagesAtOnce);
    check(owner.pendingGeometryBytes, prepared.geometryBytes, options.maxPendingGeometryBytes);
    check(owner.pendingColorBytes, storage.colorBytes + storage.effectBytes, 134217728);
    if (canonicalBytes + sourceCopy > pagesAtOnce)
        fail('budget');
    check(owner.pendingCanonicalBytes, canonicalBytes + sourceCopy, pagesAtOnce);
    if (!Number.isSafeInteger(owner.serial) || owner.serial < 0 || owner.serial >= Number.MAX_SAFE_INTEGER)
        fail('serial');
}
/** Only current READY identities authorize omitted whole-page copies. */
export function materializeSharedPages2D(storage, cold, owner, diagnostics) {
    let canonicalBytes = 0, sourceCopy = 0;
    for (const index of cold) {
        const bytes = storage.projectionPlan.views[index].byteLength;
        canonicalBytes += bytes;
        sourceCopy = Math.max(sourceCopy, bytes);
    }
    checkSharedCapacity2D(storage, owner, canonicalBytes, sourceCopy);
    const before = diagnostics?.canonicalBytes;
    try {
        const projections = storage.projectionPlan.views.map((view, index) => cold.has(index) ? copySharedPagePixels(view.image, diagnostics) : undefined);
        return { projections, canonicalBytes };
    }
    catch (cause) {
        // No returned projection array owns the earlier completed copies on this exit.
        if (diagnostics)
            diagnostics.canonicalBytes = before;
        throw cause;
    }
}
//# sourceMappingURL=sharedSubmissionStorage2D.js.map