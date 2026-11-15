import type { Material3D } from './Material3D.js';
import { Mesh3D } from './Mesh3D.js';
import type { RigidBody3D } from './Physics3D.js';
export declare const CLOTH3D_LIMITS: Readonly<{
    readonly maxPoints: 16384;
    readonly maxColliders: 32;
}>;
export interface StrandOptions3D {
    /** Pull on every point, as an acceleration. Defaults to 9.81 downward. */
    readonly gravity?: readonly [number, number, number];
    /** Share of a point's speed lost per second to the air. Defaults to 0.6. */
    readonly damping?: number;
    /** Passes over the links per update; more keeps them closer to their lengths. Defaults to 8. */
    readonly iterations?: number;
    /** Distance kept between a point and a collider's surface. */
    readonly thickness?: number;
    /** Spheres, capsules, boxes and planes the points stay out of. Other shapes are ignored. */
    readonly colliders?: readonly RigidBody3D[];
    /** Share of a point's sliding speed lost where it touches a collider. Defaults to 0.3. */
    readonly friction?: number;
}
/** Points and links shared by ropes and cloth. */
declare class Strands3D {
    #private;
    /** World positions, three numbers per point. Read them freely; write through setPoint(). */
    readonly points: Float32Array;
    readonly gravity: Float32Array<ArrayBuffer>;
    /** A steady push on every free point, as an acceleration: wind. */
    readonly wind: Float32Array<ArrayBuffer>;
    damping: number;
    iterations: number;
    thickness: number;
    friction: number;
    readonly colliders: RigidBody3D[];
    constructor(count: number, options: StrandOptions3D);
    get pointCount(): number;
    get linkCount(): number;
    /** @internal Place a point and forget its motion. */
    protected place(index: number, x: number, y: number, z: number): void;
    /** @internal Join two points at the distance they are apart now. */
    protected link(a: number, b: number): void;
    private check;
    /** Move a point and stop it; a pinned point is held at the new place. */
    setPoint(index: number, x: number, y: number, z: number): void;
    /**
     * Hold a point where it is now. With a body, the point keeps its place on
     * that body and follows it as the body moves and turns.
     */
    pinPoint(index: number, body?: RigidBody3D): void;
    unpinPoint(index: number): void;
    isPinned(index: number): boolean;
    /** @internal Advance the points by one update. */
    protected advance(deltaSeconds: number): void;
    private collide;
}
export interface RopeOptions3D extends StrandOptions3D {
    readonly start: readonly [number, number, number];
    readonly end: readonly [number, number, number];
    /** Number of links. Defaults to 16. */
    readonly segments?: number;
    /** Extra length as a share of the straight distance, so the rope hangs in a curve. Defaults to 0. */
    readonly slack?: number;
    /** Hold the first or the last point in place, or on a body. Both ends are free unless pinned. */
    readonly pinStart?: boolean | RigidBody3D;
    readonly pinEnd?: boolean | RigidBody3D;
}
/** A rope or cable. Call update() once per frame, after the bodies it is pinned to have moved. */
export declare class Rope3D extends Strands3D {
    #private;
    readonly segments: number;
    /** Total length along the links at rest. */
    readonly length: number;
    constructor(options: RopeOptions3D);
    /**
     * A tube along the rope, rebuilt by update(). `radius` is its thickness and
     * `sides` the number of faces around it.
     */
    createMesh(material: Material3D, radius?: number, sides?: number): Mesh3D;
    get mesh(): Mesh3D | undefined;
    update(deltaSeconds: number): void;
    private rebuild;
}
export interface ClothOptions3D extends StrandOptions3D {
    /** Number of points across and down; at least two each. */
    readonly columns: number;
    readonly rows: number;
    /** World position of the first point of the first row. */
    readonly origin: readonly [number, number, number];
    /** Vectors along a full row and down a full column. */
    readonly right: readonly [number, number, number];
    readonly down: readonly [number, number, number];
    /** Add links that skip a point, which makes the cloth resist folding. Defaults to true. */
    readonly stiff?: boolean;
}
/** A rectangular sheet. Call update() once per frame, after the bodies it is pinned to have moved. */
export declare class Cloth3D extends Strands3D {
    #private;
    readonly columns: number;
    readonly rows: number;
    constructor(options: ClothOptions3D);
    /** Index of the point at a column and row. */
    indexOf(column: number, row: number): number;
    /** Hold the point at a column and row where it is, or on a body. */
    pin(column: number, row: number, body?: RigidBody3D): void;
    unpin(column: number, row: number): void;
    /** A mesh of the sheet, rebuilt by update(). Draw it with a double-sided material to see both faces. */
    createMesh(material: Material3D): Mesh3D;
    get mesh(): Mesh3D | undefined;
    update(deltaSeconds: number): void;
    private rebuild;
}
export declare function createRope3D(options: RopeOptions3D): Rope3D;
export declare function createCloth3D(options: ClothOptions3D): Cloth3D;
export {};
//# sourceMappingURL=Cloth3D.d.ts.map