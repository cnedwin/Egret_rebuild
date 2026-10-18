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
    readonly uniformSize: 64;
}
export interface SharedWebGL2ArenaPlan {
    readonly vertexBytes: number;
    readonly uniformBytes: number;
    readonly sharedRanges: readonly SharedRange[];
    readonly sceneRanges: readonly SceneRange[];
}
export interface SharedWebGL2ArenaOwner {
    readonly pendingVertexArenaBytes: number;
    readonly pendingUniformArenaBytes: number;
}

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
): SharedWebGL2ArenaPlan {
    const { sharedStride, sceneStride } = qualifySharedWebGL2Alignment(alignment);
    const count = draws.length, scenes = sceneUniforms.length;
    if (!Number.isSafeInteger(count) || count < 0 || count > 65536
        || !Number.isSafeInteger(scenes) || scenes < 0 || scenes > 64) fail('budget');
    const uniformBytes = count * sharedStride + scenes * sceneStride;
    if (!Number.isSafeInteger(uniformBytes) || uniformBytes > RECORD_UNIFORM) fail('budget');
    const sharedRanges: SharedRange[] = [], sceneRanges: SceneRange[] = [];
    let vertexBytes = 0;
    for (let i = 0; i < count; i++) {
        const draw = draws[i]!, bytes = draw.data.byteLength;
        if (!Number.isSafeInteger(draw.vertexCount) || draw.vertexCount <= 0
            || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes !== 44 * draw.vertexCount
            || bytes > RECORD_VERTEX - vertexBytes || draw.uniform.byteLength !== 128) fail('budget');
        sharedRanges.push({ draw, vertexOffset: vertexBytes, firstVertex: vertexBytes / 44,
            uniformOffset: i * sharedStride, uniformSize: 128 });
        vertexBytes += bytes;
    }
    for (let j = 0; j < scenes; j++) {
        const uniform = sceneUniforms[j]!;
        if (uniform.byteLength !== 64) fail('budget');
        sceneRanges.push({ uniform, uniformOffset: count * sharedStride + j * sceneStride, uniformSize: 64 });
    }
    // Allocation includes final stride padding; range sizes above expose only original payloads.
    if (uniformBytes > RECORD_TOTAL - vertexBytes) fail('budget');
    return { vertexBytes, uniformBytes, sharedRanges, sceneRanges };
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
