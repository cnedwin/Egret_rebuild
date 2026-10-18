import { readPreparedStage2D, tryReplayPreparedStage2D, acceptPreparedStage2D, publishPreparedStage2D, copyPreparedPacking2D } from './preparedFrameCache2D.js';
import type { PreparedCacheSlot2D } from './preparedFrameCache2D.js';
import { noteOwnedPreparationFailure } from './ownedPreparationFailure2D.js';
import type { PreparedImage2D } from './prepareImages2D.js';
import { GeometryPreparationError } from './prepareRectangles2D.js';
import type { PreparationBudget2D } from './prepareRectangles2D.js';
import { packedPosition2D } from './packedPosition2D.js';
import { packedOrientation } from './packedOrientation.js';

export interface PackedImage2D {
    readonly data: Float32Array<ArrayBuffer>;
    readonly vertexCount: number;
    readonly collapsedTriangles: number;
    readonly maxBackingDisplacement: number;
    readonly maxUVDisplacement: number;
}
/** Internal allocation/copy origin, distinct from geometry admission failures. */
export class ImagePackingAllocationError {
    public constructor(public readonly original: unknown) {}
}
function fail(reason: 'precision' | 'budget'): never { throw noteOwnedPreparationFailure(new GeometryPreparationError(reason)); }
/** CPU observation layout only; A2 must separately review its GPU pipeline. */
export function packImageVertices2D(prepared: PreparedImage2D, width: number, height: number, maxUploadBytes: number, budget?: PreparationBudget2D, cacheSlot?: PreparedCacheSlot2D): PackedImage2D {
    const cached = readPreparedStage2D<PackedImage2D>(cacheSlot, 'packing');
    if (cached && Number.isSafeInteger(maxUploadBytes) && maxUploadBytes >= 0 && cached.value.data.byteLength <= maxUploadBytes
        && tryReplayPreparedStage2D(budget, cached.cost)) {
        let result: PackedImage2D;
        try { result = copyPreparedPacking2D(cached.value); }
        catch (original) { throw noteOwnedPreparationFailure(new ImagePackingAllocationError(original)); }
        acceptPreparedStage2D(cacheSlot); return result;
    }
    let predicates = 0;
    let maxBackingDisplacement = 0, maxUVDisplacement = 0, collapsedTriangles = 0;
    // Convert each shared fan corner once, before allocating the bounded upload array.
    const points = prepared.points.map(point => {
        const position = packedPosition2D(point, width, height, maxBackingDisplacement);
        if (!position) fail('precision');
        const u = Math.fround(point.u), v = Math.fround(point.v);
        if (!Number.isFinite(u) || !Number.isFinite(v)) fail('precision');
        maxBackingDisplacement = position.maxBackingDisplacement;
        maxUVDisplacement = Math.max(maxUVDisplacement, Math.abs(u - point.u), Math.abs(v - point.v));
        return { x: position.x, y: position.y, u, v };
    });
    const indices: number[] = [];
    let vertexCount = 0;
    for (let i = 1; i + 1 < prepared.pointIndices.length; i++) {
        const a = prepared.pointIndices[0]!, b = prepared.pointIndices[i]!, c = prepared.pointIndices[i + 1]!;
        const p = points[a]!, q = points[b]!, r = points[c]!;
        predicates++;
        const sign = packedOrientation(p.x, p.y, q.x, q.y, r.x, r.y, budget);
        if (!Number.isFinite(sign) || sign > 0) fail('precision');
        if (sign === 0) { collapsedTriangles++; continue; }
        if (vertexCount > 4294967295 - 3) fail('budget');
        vertexCount += 3; indices.push(a, b, c);
    }
    if (!Number.isSafeInteger(maxUploadBytes) || maxUploadBytes < 0 || vertexCount > Math.floor(Number.MAX_SAFE_INTEGER / 16) || vertexCount > Math.floor(maxUploadBytes / 16)) fail('budget');
    let data: Float32Array<ArrayBuffer>;
    try {
        data = new Float32Array(vertexCount * 4);
        let offset = 0;
        for (const index of indices) { const p = points[index]!; data[offset++] = p.x; data[offset++] = p.y; data[offset++] = p.u; data[offset++] = p.v; }
    } catch (original) { throw noteOwnedPreparationFailure(new ImagePackingAllocationError(original)); }
    const result = { data, vertexCount, collapsedTriangles, maxBackingDisplacement, maxUVDisplacement };
    publishPreparedStage2D(cacheSlot, 'packing', result, { preparedVertices: 0, predicates, tupleComparisons: 0 });
    return result;
}
