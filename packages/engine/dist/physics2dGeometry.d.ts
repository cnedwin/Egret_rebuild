import type { PhysicsShape, PhysicsVector } from './physics2dTypes.js';
export interface Placed {
    readonly kind: 'circle' | 'polygon';
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    readonly points: Float64Array;
}
export interface Box {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
}
/** How two shapes meet: the normal from the first to the second, and how far they reach into each other. */
export interface Meeting {
    readonly nx: number;
    readonly ny: number;
    readonly depth: number;
}
/** A shape in the world, at a place and a turn: a circle, or the corners of a convex polygon. */
export declare function place(shape: PhysicsShape, x: number, y: number, degrees: number): Placed;
export declare function boxOf(shape: Placed): Box;
export declare const boxesMeet: (a: Box, b: Box) => boolean;
/** The area of a shape, for the mass of a body. */
export declare function areaOf(shape: PhysicsShape): number;
/** Whether points make a convex polygon of some area, in either turning. */
export declare function convex(points: readonly PhysicsVector[]): boolean;
/** Whether two shapes meet, by separating axes; when they do, the shortest way out of each other. */
export declare function meet(a: Placed, b: Placed): Meeting | undefined;
/** Whether a point is inside a shape, its edge included. */
export declare function holds(shape: Placed, x: number, y: number): boolean;
/** Where a segment from (x0, y0) by (dx, dy) first meets a shape it starts outside of: the fraction along it and the normal there. */
export declare function cast(shape: Placed, x0: number, y0: number, dx: number, dy: number): {
    readonly t: number;
    readonly nx: number;
    readonly ny: number;
} | undefined;
//# sourceMappingURL=physics2dGeometry.d.ts.map