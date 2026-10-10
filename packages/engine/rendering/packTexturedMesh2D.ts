import { noteOwnedPreparationFailure } from './ownedPreparationFailure2D.js';
import { GeometryPreparationError } from './prepareRectangles2D.js';
import { packedPosition2D } from './packedPosition2D.js';
import { packedOrientation } from './packedOrientation.js';
import type { MeshPoint2D, MeshStageCounters2D, PreparedMesh2D } from './prepareTexturedMesh2D.js';
import type { TexturedPreparationBudget2D } from './texturedPreparationBudget2D.js';

export interface PackedTexturedMesh2D {
    readonly data: Float32Array<ArrayBuffer>;
    readonly vertexCount: number;
    readonly sourceTrianglesCharged: number;
    readonly preparedVerticesCharged: number;
    readonly counters: MeshStageCounters2D;
    readonly maxBackingDisplacement: number;
    readonly maxUVDisplacement: number;
    readonly maxLightColorDisplacement: number;
}
/** Preserve the original owned payload-allocation/copy fault for the trusted host boundary. */
export class TexturedMeshPackingAllocationError {
    public constructor(public readonly original: unknown) {}
}
function fail(reason: 'precision' | 'budget'): never { throw noteOwnedPreparationFailure(new GeometryPreparationError(reason)); }
function component(value: number): number {
    const represented = Math.fround(value);
    if (!Number.isFinite(represented) || represented < 0 || represented > 1) fail('precision');
    return represented === 0 ? 0 : represented;
}
/** Pack admitted full-tuple polygons into one nonindexed 32-byte vertex layout. */
export function packTexturedMesh2D(prepared: PreparedMesh2D, width: number, height: number,
    admittedVertexBytes: number, budget: TexturedPreparationBudget2D): PackedTexturedMesh2D {
    // The upper reservation survives all f32 collapses and must precede conversion/payload work.
    const reservedVertices = prepared.preparedVerticesCharged;
    if (!Number.isSafeInteger(admittedVertexBytes) || admittedVertexBytes < 0 ||
        !Number.isSafeInteger(reservedVertices) || reservedVertices < 0 ||
        reservedVertices > Math.floor(admittedVertexBytes / 32) || reservedVertices > 4294967295) fail('budget');
    let maxBackingDisplacement = 0, maxUVDisplacement = 0, maxLightColorDisplacement = 0;
    let packedCollapsedTriangles = 0, vertexCount = 0;
    // Convert each shared polygon corner once: XY, UV and all four light channels.
    const polygons = prepared.polygons.map(polygon => polygon.map(point => {
        const position = packedPosition2D(point, width, height, maxBackingDisplacement);
        if (position === undefined) fail('precision');
        const u = component(point.u), v = component(point.v);
        const r = component(point.r), g = component(point.g), b = component(point.b), a = component(point.a);
        maxBackingDisplacement = position.maxBackingDisplacement;
        maxUVDisplacement = Math.max(maxUVDisplacement, Math.abs(u - point.u), Math.abs(v - point.v));
        maxLightColorDisplacement = Math.max(maxLightColorDisplacement,
            Math.abs(r - point.r), Math.abs(g - point.g), Math.abs(b - point.b), Math.abs(a - point.a));
        return { x: position.x, y: position.y, u, v, r, g, b, a };
    }));
    const retained: MeshPoint2D[][] = [];
    for (const polygon of polygons) {
        for (let i = 1; i + 1 < polygon.length; i++) {
            const p = polygon[0]!, q = polygon[i]!, r = polygon[i + 1]!;
            // Backing Y flips in NDC: negative is valid, zero collapses, positive reverses.
            const sign = packedOrientation(p.x, p.y, q.x, q.y, r.x, r.y, budget);
            if (!Number.isFinite(sign) || sign > 0) fail('precision');
            if (sign === 0) { packedCollapsedTriangles++; continue; }
            if (vertexCount > reservedVertices - 3) fail('budget');
            vertexCount += 3;
            retained.push([p, q, r]);
        }
    }
    let data: Float32Array<ArrayBuffer>;
    try {
        data = new Float32Array(vertexCount * 8);
        let offset = 0;
        // Authored triangle and fan order are unchanged; only exact represented collapse is omitted.
        for (const triangle of retained) for (const point of triangle) {
            data[offset++] = point.x; data[offset++] = point.y;
            data[offset++] = point.u; data[offset++] = point.v;
            data[offset++] = point.r; data[offset++] = point.g; data[offset++] = point.b; data[offset++] = point.a;
        }
    } catch (original) { throw noteOwnedPreparationFailure(new TexturedMeshPackingAllocationError(original)); }
    return { data, vertexCount, sourceTrianglesCharged: prepared.sourceTrianglesCharged,
        preparedVerticesCharged: reservedVertices,
        counters: Object.freeze({ ...prepared.counters, packedCollapsedTriangles: prepared.counters.packedCollapsedTriangles + packedCollapsedTriangles }),
        maxBackingDisplacement, maxUVDisplacement, maxLightColorDisplacement };
}
