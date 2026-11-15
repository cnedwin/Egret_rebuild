import { Geometry3D } from './Geometry3D.js';
import type { Material3D } from './Material3D.js';
import { Mesh3D } from './Mesh3D.js';
export declare const DECAL3D_LIMITS: Readonly<{
    readonly maxTriangles: 262144;
}>;
export interface DecalOptions3D {
    /** Center of the decal on the surface, in world space. */
    readonly position: ArrayLike<number>;
    /** Direction the decal faces, away from the surface, in world space: usually the hit normal. */
    readonly normal: ArrayLike<number>;
    /** Width and height on the surface and the depth of the box around it. Defaults: 1, 1 and half the larger of the two. */
    readonly width?: number;
    readonly height?: number;
    readonly depth?: number;
    /** Turn about the normal, in radians. */
    readonly rotation?: number;
    /** Which way is up for the decal when the surface leaves a choice. Default +Y, or +Z on a floor. */
    readonly up?: ArrayLike<number>;
    /** Faces turned further than this from the decal's direction are left out, in radians. Default about 80 degrees. */
    readonly maxAngle?: number;
    /** Lift off the surface along each vertex normal, against flicker. Default 0.002. */
    readonly offset?: number;
}
/**
 * Cut the part of a mesh's surface that lies inside the decal box. The
 * result is in the mesh's local space, with coordinates running 0 to 1 across
 * the box, or undefined when nothing is inside. A skinned mesh is cut in its
 * bind pose, where `position` and `normal` must lie too, and the result keeps
 * joints and weights so it can follow the same skeleton. Interpolated weights
 * approximate the posed surface where the source vertices have different weights.
 */
export declare function createDecalGeometry3D(mesh: Mesh3D, options: DecalOptions3D): Geometry3D | undefined;
/**
 * A decal mesh on a target mesh, added as its child so it moves with it.
 * The material is used as given except that it stops writing depth and gains a
 * depth offset when it has none. On a skinned mesh the decal follows the
 * skeleton. Returns undefined when the box misses the surface.
 */
export declare function createDecal3D(mesh: Mesh3D, material: Material3D, options: DecalOptions3D): Mesh3D | undefined;
//# sourceMappingURL=Decal3D.d.ts.map