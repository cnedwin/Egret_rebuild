import { Geometry3D } from './Geometry3D.js';
import type { Object3D } from './Object3D.js';
export declare const NAVIGATION3D_LIMITS: Readonly<{
    readonly maxTriangles: 1048576;
    readonly maxAgents: 4096;
    readonly maxGridCells: 16777216;
    readonly maxCellReferences: 8388608;
}>;
export type NavPoint3D = [number, number, number];
export interface NavMeshOptions3D {
    /** Steepest walkable slope in radians. Defaults to 45 degrees. */
    readonly slopeLimit?: number;
    /** Corners closer than this are treated as one, which joins triangles that only touch. Defaults to 0.001. */
    readonly weldTolerance?: number;
}
export interface NavLocation3D {
    /** Index of the triangle the point lies on. */
    readonly triangle: number;
    readonly point: NavPoint3D;
}
export interface NavPathOptions3D {
    /** Keeps the path this far from the mesh edges at corners, and rules out gaps narrower than twice this. */
    readonly agentRadius?: number;
    /** Add a point wherever the path crosses from one triangle to the next, so it follows slopes. Defaults to false. */
    readonly followSurface?: boolean;
    /** How far the start and end may lie from the mesh. Defaults to 2. */
    readonly snapDistance?: number;
}
export interface NavPath3D {
    readonly points: NavPoint3D[];
    /** False when the end could not be reached and the path stops at the closest reachable place. */
    readonly complete: boolean;
    /** Length of the path. */
    readonly length: number;
}
export declare class NavMesh3D {
    #private;
    /** Welded corner positions, three floats each. */
    readonly vertices: Float32Array;
    /** Corner indices, three per triangle, counter-clockwise seen from above. */
    readonly triangles: Uint32Array;
    /** For each triangle edge (corner i to corner i + 1), the triangle on the other side or -1. */
    readonly neighbors: Int32Array;
    readonly triangleCount: number;
    /** Connected region of each triangle; two points can reach each other only within one region. */
    readonly regions: Int32Array;
    /** @param positions Triangle corners in world space; @param indices three per triangle, or none for a plain list. */
    constructor(positions: ArrayLike<number>, indices: ArrayLike<number> | undefined, options?: NavMeshOptions3D);
    private column;
    private row;
    /** Travel cost multiplier of a triangle (mud, shallow water); 1 by default. */
    setCost(triangle: number, cost: number): void;
    /** Close or reopen a triangle, as for a door or a collapsed bridge. Paths and movement avoid closed triangles. */
    setEnabled(triangle: number, enabled: boolean): void;
    isEnabled(triangle: number): boolean;
    private checked;
    /** Middle of a triangle. */
    center(triangle: number, out?: NavPoint3D): NavPoint3D;
    /** Closest point of one triangle to a point, written to `out`; returns the squared distance. */
    private closestOn;
    /** Nearest place on the open part of the mesh within `maxDistance`, or undefined. */
    findNearest(point: ArrayLike<number>, maxDistance?: number): NavLocation3D | undefined;
    /** Height of a triangle's plane at a ground position. */
    private heightAt;
    /** True when the two places can reach each other across open triangles. */
    isReachable(a: NavLocation3D, b: NavLocation3D): boolean;
    /** A* over triangles. Returns the chain of triangles from start to the end, or to the open triangle nearest the end. */
    private search;
    /**
     * Cost-guided walkable path between two points. The points are snapped onto
     * the mesh first; undefined is returned when either lies too far from it.
     */
    findPath(start: ArrayLike<number>, end: ArrayLike<number>, options?: NavPathOptions3D): NavPath3D | undefined;
    /**
     * Walk from a place toward a ground position, staying on open triangles
     * and sliding along the mesh edge when the way is blocked. `blocked`
     * tells whether an edge stopped the move.
     */
    moveAlong(from: NavLocation3D, x: number, z: number): NavLocation3D & {
        readonly blocked: boolean;
    };
    /** True when an agent of the given radius can walk straight from a place to a point. */
    private clearWalk;
    /**
     * Line of sight along the ground: how far a straight walk from a place
     * toward a ground position gets, as a share from 0 to 1. A value of 1
     * means nothing is in the way. When `crossings` is given, the points
     * where the walk passes from one triangle to the next are appended to it.
     */
    raycast(from: NavLocation3D, x: number, z: number, crossings?: NavPoint3D[]): number;
    private trace;
    /** A place chosen evenly over the open area; pass a random function for repeatable results. */
    randomPoint(random?: () => number): NavLocation3D;
    /** Line geometry of every triangle edge, for drawing the mesh while tuning a level. */
    createDebugGeometry(lift?: number): Geometry3D;
}
/**
 * Build a navigation mesh from level geometry: a geometry, or an object whose
 * meshes are merged with their world transforms. Faces steeper than
 * `slopeLimit` and faces pointing down are left out.
 */
export declare function createNavMesh3D(source: Geometry3D | Object3D | {
    readonly positions: ArrayLike<number>;
    readonly indices?: ArrayLike<number>;
}, options?: NavMeshOptions3D): NavMesh3D;
export interface NavAgentOptions3D {
    readonly position: ArrayLike<number>;
    readonly radius?: number;
    /** Walking speed in units per second. Defaults to 3.5. */
    readonly speed?: number;
    /** How quickly the agent reaches its speed, in units per second squared. Defaults to 20. */
    readonly acceleration?: number;
    /** Scene node moved with the agent; it must not have a transformed parent. */
    readonly node?: Object3D;
    readonly userData?: unknown;
}
export declare class NavAgent3D {
    readonly position: NavPoint3D;
    readonly velocity: NavPoint3D;
    radius: number;
    speed: number;
    acceleration: number;
    node: Object3D | undefined;
    userData: unknown;
    /** True once the agent has reached its target, or has none. */
    arrived: boolean;
    /** False when the last path request could not reach the target. */
    reachable: boolean;
    /** @internal */ triangle: number;
    /** @internal */ corners: NavPoint3D[];
    /** @internal */ target: NavPoint3D | undefined;
    /** @internal */ stale: boolean;
    /** @internal */ stalled: number;
    /** @internal */ closest: number;
    constructor(options: NavAgentOptions3D);
    /** Walk to a point; the path is worked out on the next crowd update. */
    setTarget(point: ArrayLike<number>): void;
    /** Stop where the agent stands. */
    stop(): void;
    /** Remaining path corners, the next one first. */
    get path(): readonly NavPoint3D[];
}
/**
 * Agents walking on one navigation mesh. Each follows its own path and
 * steers away from neighbors it would otherwise walk into.
 */
export declare class NavCrowd3D {
    readonly navMesh: NavMesh3D;
    readonly agents: NavAgent3D[];
    /** How strongly agents push apart when they overlap; 0 lets them pass through each other. */
    separation: number;
    constructor(navMesh: NavMesh3D);
    addAgent(options: NavAgentOptions3D): NavAgent3D;
    removeAgent(agent: NavAgent3D): void;
    private sync;
    /** Advance every agent by `deltaSeconds`. */
    update(deltaSeconds: number): void;
}
export declare function createNavCrowd3D(navMesh: NavMesh3D): NavCrowd3D;
export interface GridPathOptions3D {
    /** Allow diagonal steps (never cutting a blocked corner). Defaults to true. */
    readonly diagonal?: boolean;
    /** Give up after visiting this many cells. Defaults to every cell. */
    readonly maxVisited?: number;
}
/**
 * Shortest path on a grid of cells, for tile maps. `cost(x, y)` returns the
 * finite positive price of entering a cell (including fractional costs).
 * All other values mark a blocked cell. Returns the cells from start to end
 * inclusive, or undefined when there is no way.
 */
export declare function findGridPath3D(width: number, height: number, cost: (x: number, y: number) => number, start: readonly [number, number], end: readonly [number, number], options?: GridPathOptions3D): [number, number][] | undefined;
//# sourceMappingURL=Navigation3D.d.ts.map