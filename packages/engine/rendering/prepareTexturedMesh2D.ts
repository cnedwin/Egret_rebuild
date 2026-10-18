import { readPreparedStage2D, tryReplayPreparedStage2D, acceptPreparedStage2D, publishPreparedStage2D } from './preparedFrameCache2D.js';
import type { PreparedCacheSlot2D } from './preparedFrameCache2D.js';
import { noteOwnedPreparationFailure } from './ownedPreparationFailure2D.js';
import type { Matrix2D, TexturedGeometry2D, TexturedMeshCommand2D } from '@egret/contracts';
import { Preparation, GeometryPreparationError, coordinate, clipPolygon2D } from './prepareRectangles2D.js';
import type { CrossingAttributes, RectanglePreparationOptions } from './prepareRectangles2D.js';
import { createMeshClipPolicy2D } from './texturedPreparationBudget2D.js';
import type { MeshPoint2D, TexturedPreparationBudget2D } from './texturedPreparationBudget2D.js';

export type { MeshPoint2D } from './texturedPreparationBudget2D.js';
export interface MeshStageCounters2D {
    readonly authoredDegenerateTriangles: number;
    readonly singularSuppressedTriangles: number;
    readonly transformedCollapsedTriangles: number;
    readonly clippedCollapsedTriangles: number;
    readonly packedCollapsedTriangles: number;
}
export interface PreparedMesh2D {
    readonly polygons: readonly (readonly MeshPoint2D[])[];
    readonly sourceTrianglesCharged: number;
    readonly preparedVerticesCharged: number;
    readonly counters: MeshStageCounters2D;
}
function fail(reason: 'precision' | 'budget'): never { throw noteOwnedPreparationFailure(new GeometryPreparationError(reason)); }
function attribute(value: number): number {
    if (!Number.isFinite(value) || value < 0 || value > 1) fail('precision');
    return value === 0 ? 0 : value;
}
function interpolate(first: number, second: number, weight: number, complementary: boolean): number {
    // The direct small complement is supplied by the geometric crossing; never use 1-t.
    return attribute(complementary ? second + weight * (first - second) : first + weight * (second - first));
}
/** Private real producer shared by Mesh clipping and direct complementary-weight units. */
export const attachTexturedMeshAttributes2D: CrossingAttributes<MeshPoint2D> = (p, q, weight, complementary, x, y) => ({
    x: coordinate(x), y: coordinate(y),
    u: interpolate(p.u, q.u, weight, complementary), v: interpolate(p.v, q.v, weight, complementary),
    r: interpolate(p.r, q.r, weight, complementary), g: interpolate(p.g, q.g, weight, complementary),
    b: interpolate(p.b, q.b, weight, complementary), a: interpolate(p.a, q.a, weight, complementary),
});
function admitMatrix(matrix: Matrix2D): void {
    for (const value of [matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty]) coordinate(value);
}
function transform(point: MeshPoint2D, matrix: Matrix2D, ratio: number): MeshPoint2D {
    // Admit each ordered product, sum, translation and backing conversion separately.
    const x = coordinate(coordinate(coordinate(matrix.a * point.x) + coordinate(matrix.c * point.y)) + matrix.tx);
    const y = coordinate(coordinate(coordinate(matrix.b * point.x) + coordinate(matrix.d * point.y)) + matrix.ty);
    return { ...point, x: coordinate(x * ratio), y: coordinate(y * ratio) };
}
function referencedPoint(geometry: TexturedGeometry2D, index: number): MeshPoint2D {
    const position = 2 * index, light = 4 * index;
    // Read one complete referenced tuple at a time, before any authored orientation.
    return {
        x: coordinate(geometry.positions[position]!), y: coordinate(geometry.positions[position + 1]!),
        u: attribute(geometry.uvs[position]!), v: attribute(geometry.uvs[position + 1]!),
        r: attribute(geometry.lightColors[light]!), g: attribute(geometry.lightColors[light + 1]!),
        b: attribute(geometry.lightColors[light + 2]!), a: attribute(geometry.lightColors[light + 3]!),
    };
}
/** Consume authentic admitted geometry; its whole source count was charged by metadata admission. */
export function prepareTexturedMesh2D(command: TexturedMeshCommand2D, geometry: TexturedGeometry2D,
    width: number, height: number, options: RectanglePreparationOptions, budget: TexturedPreparationBudget2D, cacheSlot?: PreparedCacheSlot2D): PreparedMesh2D {
    const ratio = coordinate(options.pixelRatio);
    const cached = readPreparedStage2D<PreparedMesh2D>(cacheSlot, 'geometry');
    if (cached && cached.cost.predicates <= options.maxClipEdgeTests && cached.cost.preparedVertices <= options.maxPreparedVertices
        && cached.cost.preparedVertices <= 4294967295 && tryReplayPreparedStage2D(budget, cached.cost)) {
        acceptPreparedStage2D(cacheSlot); return cached.value;
    }
    let previousTuples: number | undefined;
    if (cacheSlot) {
        try { previousTuples = budget.snapshot().tupleComparisonsCharged; }
        catch { cacheSlot = undefined; } // Optional accounting alone may degrade to cold work.
    }
    const preparation = new Preparation(options, budget);
    const matrix = command.matrix;
    admitMatrix(matrix);
    // Every authored clip is numerically preflighted before the first indexed tuple,
    // even for empty geometry, alpha zero, authored degeneracy or singular transforms.
    const clips = command.clips.map(clip => preparation.rectangle(clip));
    const viewport = [{ x: 0, y: 0 }, { x: coordinate(width), y: 0 },
        { x: coordinate(width), y: coordinate(height) }, { x: 0, y: coordinate(height) }];
    const policy = createMeshClipPolicy2D(budget), polygons: MeshPoint2D[][] = [];
    const counters = { authoredDegenerateTriangles: 0, singularSuppressedTriangles: 0,
        transformedCollapsedTriangles: 0, clippedCollapsedTriangles: 0, packedCollapsedTriangles: 0 };
    let preparedVerticesCharged = 0;
    for (let triangle = 0; triangle < geometry.triangleCount; triangle++) {
        const offset = triangle * 3;
        const first = geometry.indices[offset]!, second = geometry.indices[offset + 1]!, third = geometry.indices[offset + 2]!;
        const p = referencedPoint(geometry, first), q = referencedPoint(geometry, second), r = referencedPoint(geometry, third);
        const authored = preparation.sign(p, q, r);
        // A0 is final: represented translation must never create raster area from an authored line.
        if (authored === 0) { counters.authoredDegenerateTriangles++; continue; }
        const rank = preparation.sign({ x: 0, y: 0 }, { x: matrix.a, y: matrix.b }, { x: matrix.c, y: matrix.d });
        if (rank === 0) { counters.singularSuppressedTriangles++; continue; }
        const transformed = [transform(p, matrix, ratio), transform(q, matrix, ratio), transform(r, matrix, ratio)];
        const represented = preparation.sign(transformed[0]!, transformed[1]!, transformed[2]!);
        if (represented === 0) { counters.transformedCollapsedTriangles++; continue; }
        if (represented !== authored * rank) fail('precision');
        // Winding and crossings transport complete XY/UV/light tuples, including collinear attributes.
        let polygon = policy.normalize(preparation, transformed);
        for (const clip of clips) polygon = clipPolygon2D(preparation, polygon, clip, policy.normalize, attachTexturedMeshAttributes2D, policy);
        polygon = clipPolygon2D(preparation, polygon, viewport, policy.normalize, attachTexturedMeshAttributes2D, policy);
        if (polygon.length === 0) { counters.clippedCollapsedTriangles++; continue; }
        if (command.alpha === 0) continue;
        const fanVertices = (polygon.length - 2) * 3;
        if (fanVertices > options.maxPreparedVertices - preparedVerticesCharged || fanVertices > 4294967295 - preparedVerticesCharged) fail('budget');
        // Admit the complete fan before retaining any prepared polygon; later f32 collapse never refunds it.
        budget.admitPreparedVertices(fanVertices);
        preparedVerticesCharged += fanVertices;
        polygons.push(polygon);
    }
    const result = { polygons, sourceTrianglesCharged: geometry.triangleCount, preparedVerticesCharged, counters: Object.freeze(counters) };
    if (previousTuples !== undefined) {
        // Only the optional cost snapshot is caught; original geometry and result
        // construction above retain their original failure provenance.
        let tuples: number | undefined;
        try { tuples = budget.snapshot().tupleComparisonsCharged - previousTuples; } catch { /* Skip this optional publication. */ }
        if (tuples !== undefined) publishPreparedStage2D(cacheSlot, 'geometry', result,
            { preparedVertices: preparedVerticesCharged, predicates: preparation.edgeTests, tupleComparisons: tuples });
    }
    return result;
}
