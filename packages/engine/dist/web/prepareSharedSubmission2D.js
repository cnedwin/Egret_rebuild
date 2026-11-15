import { packSharedDraws2D, packSharedRegions2D, SHARED_REGION_WINDOW_2D, SHARED_REGION_WINDOW_BYTES_2D } from '../rendering/packSharedDraws2D.js';
import { noteOwnedPreparationFailure } from '../rendering/ownedPreparationFailure2D.js';
import { SharedStorageError2D, planSharedStorageFees2D, withSharedReadbackLayout2D, checkSharedCapacity2D as checkSharedStorageCapacity2D, materializeSharedPages2D as materializeSharedStoragePages2D } from './sharedSubmissionStorage2D.js';
// Retain the existing error constructor identity and private WebGPU callable types.
export { SharedStorageError2D } from './sharedSubmissionStorage2D.js';
export const checkSharedCapacity2D = checkSharedStorageCapacity2D;
export const materializeSharedPages2D = materializeSharedStoragePages2D;
function failDevice() {
    throw noteOwnedPreparationFailure(new SharedStorageError2D('device'));
}
/** Every window of the region table starts at a multiple of this many bytes of its buffer. */
export const SHARED_REGION_WINDOW_STRIDE_2D = 16384;
/** Preserve WebGPU fees, 256-byte rows, native checks and pending order before payloads. */
export function planSharedSubmission2D(prepared, options, hardware, owner, readback) {
    const fees = planSharedStorageFees2D(prepared, options), { width, height } = prepared;
    const rowPitch = readback ? Math.ceil((4 * width) / 256) * 256 : 0, staging = rowPitch * height, output = readback ? fees.colorBytes : 0;
    const layout = withSharedReadbackLayout2D(fees, { rowPitch, staging, output });
    if (width > hardware.maxTextureDimension2D ||
        height > hardware.maxTextureDimension2D ||
        staging > hardware.maxBufferSize)
        failDevice();
    for (const draw of prepared.entries)
        if (draw.kind === 'draw' && (52 * draw.vertexReservation > hardware.maxBufferSize || 128 > hardware.maxBufferSize))
            failDevice();
    // The region table is one buffer of whole windows; a frame with a draw that has a region needs it.
    if (prepared.entries.some(draw => draw.kind === 'draw' && draw.region !== undefined && draw.vertexReservation > 0) &&
        (Math.ceil(prepared.frame.regions.length / SHARED_REGION_WINDOW_2D) - 1) * SHARED_REGION_WINDOW_STRIDE_2D +
            SHARED_REGION_WINDOW_BYTES_2D >
            hardware.maxBufferSize)
        failDevice();
    const views = prepared.frame.pages.map(page => {
        const image = page.source;
        if (image.width > hardware.maxTextureDimension2D || image.height > hardware.maxTextureDimension2D)
            failDevice();
        return { image, region: { x: 0, y: 0, width: image.width, height: image.height }, byteLength: image.byteLength };
    });
    const projectionPlan = {
        views,
        commandViews: [],
        projectionBytes: prepared.pageBytes,
        scratchBytes: 0
    };
    const storage = { ...layout, options, projectionPlan };
    checkSharedCapacity2D(storage, owner);
    return storage;
}
export const packSharedSubmission2D = packSharedDraws2D;
export { SHARED_REGION_WINDOW_BYTES_2D };
/** The region table as its uniform buffer holds it: whole windows, the last one allocated in full. */
export function packSharedRegionWindows2D(frame) {
    const rows = packSharedRegions2D(frame), count = Math.ceil(frame.regions.length / SHARED_REGION_WINDOW_2D);
    const bytes = (count - 1) * SHARED_REGION_WINDOW_STRIDE_2D + SHARED_REGION_WINDOW_BYTES_2D, table = new Uint32Array(bytes / 4);
    for (let i = 0; i < count; i++)
        table.set(rows.subarray(12 * SHARED_REGION_WINDOW_2D * i, Math.min(rows.length, 12 * SHARED_REGION_WINDOW_2D * (i + 1))), (i * SHARED_REGION_WINDOW_STRIDE_2D) / 4);
    return table;
}
//# sourceMappingURL=prepareSharedSubmission2D.js.map