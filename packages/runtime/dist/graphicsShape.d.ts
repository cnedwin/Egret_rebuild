import type { ImageData2D, Rectangle2D, SharedGeometry2D } from '@egret/contracts';
import type { ShapeGradient } from './graphicsFill.js';
import type { AssetLease } from './AssetLease.js';
import type { Texture } from './Texture.js';
/**
 * An image as a fill: the lease of its texture, whether it repeats, and the map from a node's units to the image, in
 * which 0 to 1 is once across it: `u = a·x + c·y + tx` and `v = b·x + d·y + ty`.
 */
export interface ShapeBitmap {
    readonly lease: AssetLease<Texture>;
    readonly repeat: boolean;
    readonly width: number;
    readonly height: number;
    readonly a: number;
    readonly b: number;
    readonly c: number;
    readonly d: number;
    readonly tx: number;
    readonly ty: number;
}
/** `feather` is how far, in the node's units, the edge of what is painted fades to nothing; none when it is not there. */
export interface ShapePaint {
    readonly color: number;
    readonly alpha: number;
    readonly gradient?: ShapeGradient | undefined;
    readonly bitmap?: ShapeBitmap | undefined;
    readonly feather?: number | undefined;
}
export type LineCaps = 'none' | 'round' | 'square';
export type LineJoints = 'miter' | 'round' | 'bevel';
/** A line: its width, how its ends and corners are drawn, and the lengths of its dashes and gaps in turn, if it is dashed. */
export interface ShapeLine extends ShapePaint {
    readonly width: number;
    readonly caps: LineCaps;
    readonly joints: LineJoints;
    readonly miterLimit: number;
    readonly dash: readonly number[] | undefined;
}
/** A path being drawn with moveTo and lineTo: its paints, and each subpath as x, y pairs. */
export interface ShapePath {
    readonly fill: ShapePaint | undefined;
    readonly line: ShapeLine | undefined;
    readonly subpaths: number[][];
}
/**
 * Triangles that are drawn together: x, y of each vertex; linear-light r, g, b and alpha of each vertex; where each
 * vertex is in its image; three vertex numbers for each triangle. They are over one white pixel, or over an image.
 */
export interface ShapeBatch {
    positions: number[];
    colors: number[];
    uvs: number[];
    indices: number[];
    bitmap: ShapeBitmap | undefined;
}
/** A drawing in order: the batches that are finished, and the one being added to. A fill of another image begins a batch. */
export interface ShapeDrawing extends ShapeBatch {
    done: ShapeBatch[];
}
export interface ShapeState extends ShapeDrawing {
    path: ShapePath | undefined;
    /** What the lists and the path give, made when capture or bounds first ask after a change. */
    resolved: ResolvedShape | undefined;
}
/** One geometry for each batch that has a triangle, in drawing order, with the image it is drawn over if it has one. */
export interface ResolvedPart {
    readonly geometry: SharedGeometry2D;
    readonly bitmap: ShapeBitmap | undefined;
}
export interface ResolvedShape {
    readonly parts: readonly ResolvedPart[];
    readonly bounds: Rectangle2D;
}
/** The most one node's shapes may hold: what one shared geometry takes. */
export declare const GRAPHICS_SHAPE_LIMITS: Readonly<{
    maxVertices: 65536;
    maxIndices: 196608;
    maxLogicalBytes: 4980736;
    maxPathPoints: 8192;
    maxLineWidth: 1024;
    maxDashes: 16384;
    maxGradientStops: 16;
    maxFillTriangles: 16384;
    maxBatches: 16;
    maxRepeatPixels: 8192;
}>;
/** The one white pixel every shape samples: its colour is the colour of its vertices. */
export declare const SHAPE_PAGE: ImageData2D;
export declare const SHAPE_REGION: Readonly<{
    packed: Readonly<{
        x: 0;
        y: 0;
        width: 1;
        height: 1;
    }>;
    logicalWidth: 1;
    logicalHeight: 1;
    trimX: 0;
    trimY: 0;
    quarterTurn: 0;
}>;
export declare function createShapeState(): ShapeState;
/** A copy that can be drawn on without changing the drawing it was made from. */
export declare function copyDrawing(from: ShapeDrawing): ShapeDrawing;
type Target = ShapeDrawing;
/** A convex outline as a fan from its first corner. */
export declare function fillConvex(target: Target, outline: readonly number[], color: ShapePaint): void;
/** Any simple outline, by cutting ears. An outline that crosses itself is filled without a promise about where. */
export declare function fillPolygon(target: Target, outline: readonly number[], color: ShapePaint): void;
/**
 * What closed outlines cover, filled. One outline that does not cross itself is cut into ears; several, or one that
 * crosses itself, are filled by the non-zero rule, so an outline drawn the other way round inside another is a hole.
 * A gradient is given as the colours of the corners, with triangles cut until that is close enough.
 * False when the fill would take more triangles than one fill may.
 */
export declare function fillOutlines(target: Target, outlines: readonly (readonly number[])[], convex: boolean, color: ShapePaint, edge?: boolean): boolean;
/**
 * A line of a width along points. Two pieces meet at a corner in one point on its inside, so a translucent line is not
 * darker there; its outside is a mitre, cut to a bevel when longer than `miterLimit` half-widths, a bevel or an arc.
 * An open line ends flat, in a half square or in a half circle. False when its dashes are more than a line may have.
 */
export declare function strokeLine(target: Target, line: readonly number[], closed: boolean, style: ShapeLine): boolean;
/** How many straight pieces a curve of this radius is drawn with: each is within a quarter unit of the curve. */
export declare function curveSegments(radius: number): number;
/** An ellipse as an outline, starting at its right and going on through its bottom. */
export declare function ellipseOutline(cx: number, cy: number, rx: number, ry: number): number[];
/** A rectangle whose corners are quarter ellipses of the two radii. */
export declare function roundRectOutline(x: number, y: number, width: number, height: number, rx: number, ry: number): number[];
/** The points of an arc after its first, which the caller has already placed. */
export declare function arcPoints(cx: number, cy: number, radius: number, start: number, end: number, anticlockwise: boolean): number[];
/** The points of a curve of two or three control points after its first, which is `from`. */
export declare function bezierPoints(from: readonly [number, number], controls: readonly number[], to: readonly [number, number]): number[];
/** A shape drawn at once: its fill under its line. False when it is more than a fill or a line may be. */
export declare function addOutline(target: Target, outline: readonly number[], convex: boolean, fill: ShapePaint | undefined, line: ShapeLine | undefined): boolean;
/** The triangles of a path: its parts filled together as closed outlines, then each lined, closed only where its ends meet. */
export declare function addPath(target: Target, path: ShapePath): boolean;
/** Whether a drawing of this many vertices and indices is one a node may hold. */
export declare function shapeFits(vertices: number, indices: number): boolean;
/** Whether a drawing is one a node may hold: every batch within what one geometry takes, and no more batches than a node has. */
export declare function drawingFits(drawing: ShapeDrawing): boolean;
/** The geometries and bounds of a node's shapes, or undefined while they hold no triangle. */
export declare function resolveShape(shape: ShapeState): ResolvedShape | undefined;
export {};
//# sourceMappingURL=graphicsShape.d.ts.map