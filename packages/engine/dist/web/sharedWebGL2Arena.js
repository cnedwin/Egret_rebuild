import { noteOwnedPreparationFailure } from '../rendering/ownedPreparationFailure2D.js';
import { SharedStorageError2D } from './sharedSubmissionStorage2D.js';
// The packed layout: 52 bytes for one vertex; 341 regions of twelve u32 values, 16,368 bytes, for one window of the region table.
const VERTEX = 52, WINDOW_REGIONS = 341, WINDOW_BYTES = 16368;
const RECORD_VERTEX = 33554432, RECORD_UNIFORM = 16777216, RECORD_TOTAL = 50331648;
const PENDING_VERTEX = 67108864, PENDING_UNIFORM = 33554432, PENDING_TOTAL = 100663296;
function fail(reason) {
    throw noteOwnedPreparationFailure(new SharedStorageError2D(reason));
}
/** Actual GL alignment is finite but need not be a power of two. */
export function qualifySharedWebGL2Alignment(alignment) {
    if (!Number.isSafeInteger(alignment) || alignment < 4 || alignment > 256 || alignment % 4 !== 0)
        fail('device');
    return { sharedStride: Math.ceil(128 / alignment) * alignment };
}
/** Plan only native addresses; existing private payload arrays remain their original owners. */
export function planSharedWebGL2Arenas(draws, alignment, regions) {
    const { sharedStride } = qualifySharedWebGL2Alignment(alignment);
    const count = draws.length;
    if (!Number.isSafeInteger(count) || count < 0 || count > 65536)
        fail('budget');
    const uniformBytes = count * sharedStride;
    const sharedRanges = [];
    let vertexBytes = 0;
    for (let i = 0; i < count; i++) {
        const draw = draws[i], bytes = draw.data.byteLength;
        if (!Number.isSafeInteger(draw.vertexCount) ||
            draw.vertexCount <= 0 ||
            !Number.isSafeInteger(bytes) ||
            bytes <= 0 ||
            bytes !== VERTEX * draw.vertexCount ||
            bytes > RECORD_VERTEX - vertexBytes ||
            draw.uniform.byteLength !== 128)
            fail('budget');
        sharedRanges.push({
            draw,
            vertexOffset: vertexBytes,
            firstVertex: vertexBytes / VERTEX,
            uniformOffset: i * sharedStride,
            uniformSize: 128
        });
        vertexBytes += bytes;
    }
    // Allocation includes final stride padding; range sizes above expose only original payloads.
    if (uniformBytes > RECORD_UNIFORM || uniformBytes > RECORD_TOTAL - vertexBytes)
        fail('budget');
    let regionTable;
    if (draws.some(draw => draw.regionWindow >= 0)) {
        // A bound window is always the whole block, so the last window is allocated in full too.
        const rows = regions ? regions.length / 12 : 0, count = Math.ceil(rows / WINDOW_REGIONS);
        if (!regions ||
            !Number.isSafeInteger(rows) ||
            rows <= 0 ||
            rows > 4096 ||
            draws.some(draw => draw.regionWindow >= count))
            fail('budget');
        const stride = Math.ceil(WINDOW_BYTES / alignment) * alignment, windows = [];
        for (let i = 0; i < count; i++)
            windows.push({
                offset: i * stride,
                data: regions.subarray(12 * WINDOW_REGIONS * i, Math.min(regions.length, 12 * WINDOW_REGIONS * (i + 1)))
            });
        regionTable = { bytes: (count - 1) * stride + WINDOW_BYTES, stride, windows };
    }
    return { vertexBytes, uniformBytes, sharedRanges, regionTable };
}
function pending(used, amount, limit) {
    if (!Number.isSafeInteger(used) || used < 0 || !Number.isSafeInteger(amount) || amount < 0 || amount > limit - used)
        fail('backpressure');
}
/** Pure check: Host repeats it with current counters immediately before owner/serial commit. */
export function checkSharedWebGL2ArenaCapacity(plan, owner) {
    pending(owner.pendingVertexArenaBytes, plan.vertexBytes, PENDING_VERTEX);
    pending(owner.pendingUniformArenaBytes, plan.uniformBytes, PENDING_UNIFORM);
    pending(owner.pendingVertexArenaBytes + owner.pendingUniformArenaBytes, plan.vertexBytes + plan.uniformBytes, PENDING_TOTAL);
}
//# sourceMappingURL=sharedWebGL2Arena.js.map