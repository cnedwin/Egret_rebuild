// SPDX-License-Identifier: Apache-2.0
import type { PackedSharedDraw2D } from '../rendering/packSharedDraws2D.js';
import { noteOwnedPreparationFailure } from '../rendering/ownedPreparationFailure2D.js';
import { SharedStorageError2D } from './sharedSubmissionStorage2D.js';

export interface SharedWebGL2ArenaStrides { readonly sharedStride: number; readonly sceneStride: number; }
interface SharedRange {
    readonly draw: PackedSharedDraw2D;
    readonly vertexOffset: number;
    readonly firstVertex: number;
    readonly uniformOffset: number;
    readonly uniformSize: 128;
}
interface SceneRange {
    readonly uniform: Float32Array<ArrayBuffer>;
    readonly uniformOffset: number;
    readonly uniformSize: 64 | 112 | 128;
}
/** The region table of one record: its own uniform buffer, one window after another, each at an aligned offset. */
export interface SharedWebGL2RegionTable {
    readonly bytes: number;
    readonly stride: number;
    /** The rows of each window, to be written at `offset`. */
    readonly windows: readonly { readonly offset: number; readonly data: Uint32Array<ArrayBuffer> }[];
}
export interface SharedWebGL2ArenaPlan {
    readonly vertexBytes: number;
    readonly uniformBytes: number;
    readonly sharedRanges: readonly SharedRange[];
    readonly sceneRanges: readonly SceneRange[];
    /** Present when a draw of the record has a region. Not part of `uniformBytes`. */
    readonly regionTable: SharedWebGL2RegionTable | undefined;
}
export interface SharedWebGL2ArenaOwner {
    readonly pendingVertexArenaBytes: number;
    readonly pendingUniformArenaBytes: number;
}

// The packed layout: 52 bytes for one vertex; 341 regions of twelve u32 values, 16,368 bytes, for one window of the region table.
const VERTEX = 52, WINDOW_REGIONS = 341, WINDOW_BYTES = 16368;
const RECORD_VERTEX = 33554432, RECORD_UNIFORM = 16793600, RECORD_TOTAL = 50348032;
const PENDING_VERTEX = 67108864, PENDING_UNIFORM = 33587200, PENDING_TOTAL = 100696064;
function fail(reason: 'device' | 'budget' | 'backpressure'): never {
    throw noteOwnedPreparationFailure(new SharedStorageError2D(reason));
}

/** Actual GL alignment is finite but need not be a power of two. */
export function qualifySharedWebGL2Alignment(alignment: number): SharedWebGL2ArenaStrides {
    if (!Number.isSafeInteger(alignment) || alignment < 4 || alignment > 256 || alignment % 4 !== 0) fail('device');
    return { sharedStride: Math.ceil(128 / alignment) * alignment, sceneStride: Math.ceil(64 / alignment) * alignment };
}

/** Plan only native addresses; existing private payload arrays remain their original owners. */
export function planSharedWebGL2Arenas(
    draws: readonly PackedSharedDraw2D[], sceneUniforms: readonly Float32Array<ArrayBuffer>[], alignment: number,
    regions?: Uint32Array<ArrayBuffer>,
): SharedWebGL2ArenaPlan {
    const { sharedStride, sceneStride } = qualifySharedWebGL2Alignment(alignment);
    const count = draws.length, scenes = sceneUniforms.length;
    if (!Number.isSafeInteger(count) || count < 0 || count > 65536
        || !Number.isSafeInteger(scenes) || scenes < 0 || scenes > 64) fail('budget');
    let uniformBytes = count * sharedStride;
    const cardStride = Math.ceil(112 / alignment) * alignment;
    const sharedRanges: SharedRange[] = [], sceneRanges: SceneRange[] = [];
    let vertexBytes = 0;
    for (let i = 0; i < count; i++) {
        const draw = draws[i]!, bytes = draw.data.byteLength;
        if (!Number.isSafeInteger(draw.vertexCount) || draw.vertexCount <= 0
            || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes !== VERTEX * draw.vertexCount
            || bytes > RECORD_VERTEX - vertexBytes || draw.uniform.byteLength !== 128) fail('budget');
        sharedRanges.push({ draw, vertexOffset: vertexBytes, firstVertex: vertexBytes / VERTEX,
            uniformOffset: i * sharedStride, uniformSize: 128 });
        vertexBytes += bytes;
    }
    for (let j = 0; j < scenes; j++) {
        const uniform = sceneUniforms[j]!;
        const uniformSize = uniform.byteLength;
        if (uniformSize !== 64 && uniformSize !== 112 && uniformSize !== 128) fail('budget');
        sceneRanges.push({ uniform, uniformOffset: uniformBytes, uniformSize });
        uniformBytes += uniformSize === 64 ? sceneStride : uniformSize === 112 ? cardStride : sharedStride;
    }
    // Allocation includes final stride padding; range sizes above expose only original payloads.
    if (uniformBytes > RECORD_UNIFORM || uniformBytes > RECORD_TOTAL - vertexBytes) fail('budget');
    let regionTable: SharedWebGL2RegionTable | undefined;
    if (draws.some(draw => draw.regionWindow >= 0)) {
        // A bound window is always the whole block, so the last window is allocated in full too.
        const rows = regions ? regions.length / 12 : 0, count = Math.ceil(rows / WINDOW_REGIONS);
        if (!regions || !Number.isSafeInteger(rows) || rows <= 0 || rows > 4096
            || draws.some(draw => draw.regionWindow >= count)) fail('budget');
        const stride = Math.ceil(WINDOW_BYTES / alignment) * alignment, windows = [];
        for (let i = 0; i < count; i++) windows.push({ offset: i * stride,
            data: regions.subarray(12 * WINDOW_REGIONS * i, Math.min(regions.length, 12 * WINDOW_REGIONS * (i + 1))) });
        regionTable = { bytes: (count - 1) * stride + WINDOW_BYTES, stride, windows };
    }
    return { vertexBytes, uniformBytes, sharedRanges, sceneRanges, regionTable };
}

function pending(used: number, amount: number, limit: number): void {
    if (!Number.isSafeInteger(used) || used < 0 || !Number.isSafeInteger(amount) || amount < 0 || amount > limit - used) fail('backpressure');
}

/** Pure check: Host repeats it with current counters immediately before owner/serial commit. */
export function checkSharedWebGL2ArenaCapacity(plan: SharedWebGL2ArenaPlan, owner: SharedWebGL2ArenaOwner): void {
    pending(owner.pendingVertexArenaBytes, plan.vertexBytes, PENDING_VERTEX);
    pending(owner.pendingUniformArenaBytes, plan.uniformBytes, PENDING_UNIFORM);
    pending(owner.pendingVertexArenaBytes + owner.pendingUniformArenaBytes,
        plan.vertexBytes + plan.uniformBytes, PENDING_TOTAL);
}
