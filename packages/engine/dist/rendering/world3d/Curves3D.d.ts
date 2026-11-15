export type Point3D = [number, number, number];
export type Point2D = [number, number];
export declare const CURVE3D_LIMITS: Readonly<{
    readonly maxPoints: 65536;
    readonly maxDivisions: 16384;
}>;
/** Base for every curve: subclasses implement getPoint(t) for t in [0, 1]. */
export declare abstract class Curve3D {
    #private;
    /** Samples used to measure length and to map distance to parameter. */
    arcLengthDivisions: number;
    /** Position at parameter `t` in [0, 1]. The parameter need not advance at constant speed. */
    abstract getPoint(t: number, out?: Point3D): Point3D;
    /** Call after changing the curve's control points. */
    invalidate(): void;
    /** Cumulative chord lengths at each arc-length division. */
    getLengths(): Float64Array;
    getLength(): number;
    /** Parameter t that lies the fraction `u` of the way along the curve by distance. */
    parameterAt(u: number): number;
    /** Position the fraction `u` of the way along the curve, at constant speed. */
    getPointAt(u: number, out?: Point3D): Point3D;
    /** Unit tangent at parameter `t`, by central difference. */
    getTangent(t: number, out?: Point3D): Point3D;
    getTangentAt(u: number, out?: Point3D): Point3D;
    /** `divisions + 1` points at equal parameter steps. */
    getPoints(divisions?: number): Point3D[];
    /** `divisions + 1` points at equal distances. */
    getSpacedPoints(divisions?: number): Point3D[];
    /**
     * Tangent, normal and binormal at `segments + 1` stations, transported
     * along the curve without twisting. A closed curve's last frame is rotated
     * to meet its first.
     */
    computeFrames(segments: number, closed?: boolean): {
        tangents: Point3D[];
        normals: Point3D[];
        binormals: Point3D[];
    };
}
export declare class LineCurve3D extends Curve3D {
    readonly start: Point3D;
    readonly end: Point3D;
    constructor(start: ArrayLike<number>, end: ArrayLike<number>);
    getPoint(t: number, out?: Point3D): Point3D;
}
export declare class QuadraticBezierCurve3D extends Curve3D {
    readonly p0: Point3D;
    readonly p1: Point3D;
    readonly p2: Point3D;
    constructor(p0: ArrayLike<number>, p1: ArrayLike<number>, p2: ArrayLike<number>);
    getPoint(t: number, out?: Point3D): Point3D;
}
export declare class CubicBezierCurve3D extends Curve3D {
    readonly p0: Point3D;
    readonly p1: Point3D;
    readonly p2: Point3D;
    readonly p3: Point3D;
    constructor(p0: ArrayLike<number>, p1: ArrayLike<number>, p2: ArrayLike<number>, p3: ArrayLike<number>);
    getPoint(t: number, out?: Point3D): Point3D;
}
export type CatmullRomKind3D = 'centripetal' | 'chordal' | 'uniform';
/** Smooth curve through every control point. Centripetal spacing avoids loops and cusps. */
export declare class CatmullRomCurve3D extends Curve3D {
    readonly points: Point3D[];
    closed: boolean;
    kind: CatmullRomKind3D;
    constructor(points: readonly ArrayLike<number>[], options?: {
        readonly closed?: boolean;
        readonly kind?: CatmullRomKind3D;
    });
    getPoint(t: number, out?: Point3D): Point3D;
}
/** Several curves joined end to end and traversed as one, by length. */
export declare class CurvePath3D extends Curve3D {
    readonly curves: Curve3D[];
    add(curve: Curve3D): this;
    getPoint(t: number, out?: Point3D): Point3D;
}
/** A 2D outline built with pen commands; used as a contour or a hole. */
export declare class Path2D3D {
    /** Flattened vertices in drawing order. */
    readonly points: Point2D[];
    /** Segments used for each curved command. */
    curveSegments: number;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    private last;
    quadraticCurveTo(cx: number, cy: number, x: number, y: number): this;
    bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): this;
    /** Circular arc around (cx, cy); angles in radians, counter-clockwise unless `clockwise`. */
    arc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number, clockwise?: boolean): this;
    /** Outline without a repeated closing vertex. */
    contour(): Point2D[];
}
/** A filled outline with optional holes. */
export declare class Shape3D extends Path2D3D {
    readonly holes: Path2D3D[];
    constructor(points?: readonly (readonly [number, number])[]);
}
export declare function signedArea2D(points: readonly Point2D[]): number;
/**
 * Triangulate an outline with holes by ear clipping. Returns the merged
 * vertex list (outer contour counter-clockwise, then each hole) and triangle
 * indices into it.
 */
export declare function triangulateShape3D(contour: readonly Point2D[], holes?: readonly (readonly Point2D[])[]): {
    vertices: Point2D[];
    indices: number[];
};
//# sourceMappingURL=Curves3D.d.ts.map