export interface GradientStop {
    readonly offset: number;
    readonly color: number;
    readonly alpha: number;
}
/**
 * A gradient as the map from a node's units to its own: `u = a·x + c·y + tx` and `v = b·x + d·y + ty`. A linear gradient
 * runs from u = 0 to u = 1; a radial one from the point u = v = 0 to the circle of radius 1.
 */
export interface ShapeGradient {
    readonly radial: boolean;
    readonly a: number;
    readonly b: number;
    readonly c: number;
    readonly d: number;
    readonly tx: number;
    readonly ty: number;
    readonly stops: readonly GradientStop[];
}
/** The linear-light red, green and blue and the alpha of a gradient at a point. Stops are mixed as sRGB values, as a canvas mixes them. */
export declare function gradientColor(gradient: ShapeGradient, x: number, y: number, out: number[], at?: number): void;
/** Whether an outline, taken as closed, has two sides that cross. */
export declare function outlineCrosses(points: readonly number[]): boolean;
/**
 * The triangles of what closed outlines cover by the non-zero rule, as x, y of each corner, three corners to a
 * triangle; undefined when there would be more than `maxTriangles`. The plane is cut into bands at every corner and
 * crossing; in a band no two sides cross, so what is inside lies between pairs of sides. Triangles that meet along a
 * band's edge share every corner on it, so no seam opens between bands under any transform.
 */
export declare function fillNonZero(outlines: readonly (readonly number[])[], maxTriangles: number): number[] | undefined;
/**
 * Cuts triangles until the colours of their corners, mixed across each side, stay within the tolerance of the gradient.
 * A side's test depends on its endpoints. The triangle budget can still stop adjacent subdivisions at different depths.
 * When supplied, boundary masks are replaced in the output order. Only the children of an original boundary inherit it.
 */
export declare function refineForGradient(triangles: readonly number[], gradient: ShapeGradient, maxTriangles: number, boundary?: number[]): number[];
//# sourceMappingURL=graphicsFill.d.ts.map