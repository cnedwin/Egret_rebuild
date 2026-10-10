import type { ImageCommand2D, TextureRegion2D } from '@egret/contracts';
import { Preparation, coordinate, same, POLYGON_LIMIT, GeometryPreparationError, clipPolygon2D, finishPolygonWinding2D } from './prepareRectangles2D.js';
import type { RectanglePreparationOptions, CrossingAttributes } from './prepareRectangles2D.js';

export interface ImagePoint2D { readonly x: number; readonly y: number; readonly u: number; readonly v: number; }
export interface PreparedImage2D {
    readonly points: readonly ImagePoint2D[];
    readonly pointIndices: readonly number[];
    readonly imageIndex: number;
    readonly sourceRect: TextureRegion2D;
    readonly alpha: number;
    readonly edgeTests: number;
}
function fail(reason: 'range' | 'precision' | 'budget'): never { throw new GeometryPreparationError(reason); }
function attributes(point: ImagePoint2D): void {
    coordinate(point.x); coordinate(point.y);
    if (!Number.isFinite(point.u) || !Number.isFinite(point.v)) fail('precision');
}
function equalUV(a: ImagePoint2D, b: ImagePoint2D): boolean { return a.u === b.u && a.v === b.v; }
function normalize(preparation: Preparation, input: readonly ImagePoint2D[]): ImagePoint2D[] {
    if (input.length > POLYGON_LIMIT) fail('budget');
    const points: ImagePoint2D[] = [];
    for (const point of input) {
        attributes(point);
        const previous = points[points.length - 1];
        if (previous && same(previous, point)) { if (!equalUV(previous, point)) fail('precision'); }
        else points.push(point);
    }
    if (points.length > 1 && same(points[0]!, points[points.length - 1]!)) {
        if (!equalUV(points[0]!, points[points.length - 1]!)) fail('precision');
        points.pop();
    }
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) if (same(points[i]!, points[j]!)) fail('precision');
    if (points.length < 3) return [];
    // Collinear corners keep their attached UV; the shared finish reverses full points.
    return finishPolygonWinding2D(preparation, points);
}
const attach: CrossingAttributes<ImagePoint2D> = (p, q, weight, complementary, x, y) => {
    // The complementary branch computes its small weight directly, never as 1-t.
    const u = complementary ? q.u + weight * (p.u - q.u) : p.u + weight * (q.u - p.u);
    const v = complementary ? q.v + weight * (p.v - q.v) : p.v + weight * (q.v - p.v);
    if (!Number.isFinite(u) || !Number.isFinite(v)) fail('precision');
    return { x, y, u, v };
};
export function normalizeImagePolygon(points: readonly ImagePoint2D[], options: RectanglePreparationOptions): { readonly points: readonly ImagePoint2D[]; readonly edgeTests: number } {
    coordinate(options.pixelRatio);
    const preparation = new Preparation(options), normalized = normalize(preparation, points);
    return { points: normalized, edgeTests: preparation.edgeTests };
}
export function prepareImage2D(command: ImageCommand2D, width: number, height: number, options: RectanglePreparationOptions): PreparedImage2D {
    coordinate(options.pixelRatio);
    const preparation = new Preparation(options), corners = preparation.corners(command);
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
    let polygon = normalize(preparation, corners.map((point, i) => ({ ...point, u: uv[i]![0], v: uv[i]![1] })));
    // Every clip is preflighted even for singular, empty or zero-alpha commands.
    const clips = command.clips.map(clip => preparation.rectangle(clip));
    for (const clip of clips) polygon = clipPolygon2D(preparation, polygon, clip, normalize, attach);
    polygon = clipPolygon2D(preparation, polygon, [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }], normalize, attach);
    if (command.alpha === 0) polygon = [];
    const vertices = polygon.length ? (polygon.length - 2) * 3 : 0;
    if (vertices > options.maxPreparedVertices || vertices > 4294967295) fail('budget');
    return { points: polygon, pointIndices: polygon.map((_point, index) => index), imageIndex: command.imageIndex, sourceRect: command.sourceRect, alpha: command.alpha, edgeTests: preparation.edgeTests };
}
