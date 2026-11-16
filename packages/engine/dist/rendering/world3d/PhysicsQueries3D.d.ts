import type { RigidBody3D } from './Physics3D.js';
/**
 * Bodies that never move, kept in a hierarchy of boxes so that a moving body, a ray or a
 * sweep only looks at the ones nearby. It is rebuilt when a static body is added, removed or moved.
 */
export declare class StaticTree {
    #private;
    readonly bodies: RigidBody3D[];
    add(body: RigidBody3D): void;
    remove(body: RigidBody3D): void;
    touch(): void;
    private build;
    private split;
    /** Call `visit` for every static body whose bounds meet the box. */
    query(lx: number, ly: number, lz: number, hx: number, hy: number, hz: number, visit: (body: RigidBody3D) => void): void;
    /** Call `visit` for static bodies whose bounds the ray crosses within the distance `visit` returns. */
    ray(o: ArrayLike<number>, d: ArrayLike<number>, limit: number, visit: (body: RigidBody3D, limit: number) => number): void;
}
/**
 * Distance along a unit ray to a body, or -1. Writes the surface normal at the hit.
 * The caller supplies the existing mesh-normal scratch, also reused by compound parts.
 */
export declare function rayShape(body: RigidBody3D, o: number[], d: number[], limit: number, normal: number[], meshNormal: number[]): number;
//# sourceMappingURL=PhysicsQueries3D.d.ts.map