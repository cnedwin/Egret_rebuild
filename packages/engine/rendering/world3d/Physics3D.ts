// SPDX-License-Identifier: Apache-2.0
// A small rigid-body world for gameplay: spheres, boxes, capsules and planes;
// static, kinematic and dynamic bodies; a sweep-and-prune broad phase; an
// impulse solver with friction and restitution; sleeping; ray and overlap
// queries; and a capsule character controller. It is deliberately compact:
// good for pickups, projectiles, simple stacking and character movement, not
// a replacement for a full physics engine.
import {World3DError, requireFinite3D, requirePositive3D} from './core3D.js';
import type {Object3D} from './Object3D.js';
import {ConvexHullShape3D} from './PhysicsHull3D.js';
import {TriangleMeshShape3D} from './PhysicsMesh3D.js';

export const PHYSICS3D_LIMITS = Object.freeze({maxBodies: 16384, maxSubSteps: 8, maxContactsPerPair: 8} as const);
export type BodyType3D = 'static' | 'kinematic' | 'dynamic';
export type ShapeDefinition3D =
    | {readonly type: 'sphere'; readonly radius: number}
    | {readonly type: 'box'; readonly halfExtents: readonly [number, number, number]}
    /** Capsule along the local Y axis; `halfHeight` is half the distance between the two cap centers. */
    | {readonly type: 'capsule'; readonly radius: number; readonly halfHeight: number}
    /** Infinite plane through the body position, facing the body's local +Y axis. Static only. */
    | {readonly type: 'plane'}
    /** Convex solid given by its corner points; any body type. */
    | {readonly type: 'convex'; readonly hull: ConvexHullShape3D}
    /** Triangle mesh for level geometry, solid on the front side of each triangle. Static, or kinematic for moving platforms. */
    | {readonly type: 'mesh'; readonly mesh: TriangleMeshShape3D};
export interface RigidBodyOptions3D {
    readonly type?: BodyType3D;
    readonly shape: ShapeDefinition3D;
    readonly mass?: number;
    readonly position?: readonly [number, number, number];
    readonly quaternion?: readonly [number, number, number, number];
    readonly restitution?: number;
    readonly friction?: number;
    readonly linearDamping?: number;
    readonly angularDamping?: number;
    /** Report overlaps through contact events without pushing anything. */
    readonly isTrigger?: boolean;
    /** Collision category bits and the categories this body collides with. */
    readonly layer?: number;
    readonly mask?: number;
    /** Stop the body from rotating, as for an upright character. */
    readonly fixedRotation?: boolean;
    /**
     * Continuous collision for fast bodies such as projectiles: each step the
     * body's travel is cut short at the first surface in its path, so it
     * cannot pass through thin walls. The path is probed along the line of
     * the body's center.
     */
    readonly continuous?: boolean;
    /** Scene node moved with the body after each step; it must not have a transformed parent. */
    readonly node?: Object3D;
    readonly userData?: unknown;
}
export interface PhysicsRaycastHit3D {
    readonly body: RigidBody3D;
    readonly point: [number, number, number];
    readonly normal: [number, number, number];
    readonly distance: number;
}
export interface PhysicsWorldOptions3D {
    readonly gravity?: readonly [number, number, number];
    /** Length of one simulation step in seconds. */
    readonly fixedStep?: number;
    readonly maxSubSteps?: number;
    readonly iterations?: number;
    readonly allowSleep?: boolean;
}

type Vec = Float64Array;
const v3 = (x = 0, y = 0, z = 0): Vec => new Float64Array([x, y, z]);
const dot = (a: ArrayLike<number>, b: ArrayLike<number>): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
function cross(out: Vec, a: ArrayLike<number>, b: ArrayLike<number>): Vec {
    const x = a[1]! * b[2]! - a[2]! * b[1]!, y = a[2]! * b[0]! - a[0]! * b[2]!, z = a[0]! * b[1]! - a[1]! * b[0]!;
    out[0] = x; out[1] = y; out[2] = z;
    return out;
}
const clamp = (value: number, low: number, high: number): number => value < low ? low : value > high ? high : value;

let nextBodyId = 1;
export class RigidBody3D {
    readonly id = nextBodyId++;
    readonly type: BodyType3D;
    readonly shape: ShapeDefinition3D;
    readonly position = v3();
    /** Unit quaternion, xyzw. Call wake() after writing position or orientation directly. */
    readonly quaternion = new Float64Array([0, 0, 0, 1]);
    readonly linearVelocity = v3();
    readonly angularVelocity = v3();
    readonly force = v3();
    readonly torque = v3();
    readonly mass: number;
    readonly inverseMass: number;
    restitution: number;
    friction: number;
    linearDamping: number;
    angularDamping: number;
    isTrigger: boolean;
    layer: number;
    mask: number;
    fixedRotation: boolean;
    continuous: boolean;
    node: Object3D | undefined;
    userData: unknown;
    isSleeping = false;
    /** @internal */ readonly rotation = new Float64Array(9);
    /** @internal */ readonly inverseInertiaLocal = v3();
    /** @internal */ readonly inverseInertiaWorld = new Float64Array(9);
    /** @internal */ readonly aabb = new Float64Array(6);
    /** @internal */ sleepTime = 0;
    /** @internal */ world: PhysicsWorld3D | undefined;

    constructor(options: RigidBodyOptions3D) {
        const shape = options?.shape;
        if (!shape) throw new World3DError('WORLD3D_INPUT_INVALID', 'shape');
        if (shape.type === 'sphere') requirePositive3D(shape.radius, 'sphere radius');
        else if (shape.type === 'box') { for (const half of shape.halfExtents) requirePositive3D(half, 'box halfExtents'); }
        else if (shape.type === 'capsule') { requirePositive3D(shape.radius, 'capsule radius'); if (!(requireFinite3D(shape.halfHeight, 'capsule halfHeight') >= 0)) throw new World3DError('WORLD3D_INPUT_INVALID', 'capsule halfHeight'); }
        else if (shape.type === 'mesh') { if (!(shape.mesh instanceof TriangleMeshShape3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'mesh shape'); }
        else if (shape.type === 'convex') { if (!(shape.hull instanceof ConvexHullShape3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'convex shape'); }
        else if (shape.type !== 'plane') throw new World3DError('WORLD3D_INPUT_INVALID', 'shape type');
        this.shape = shape;
        const fixed = shape.type === 'plane' || shape.type === 'mesh';
        this.type = options.type ?? (fixed ? 'static' : 'dynamic');
        if (shape.type === 'plane' ? this.type !== 'static' : shape.type === 'mesh' && this.type === 'dynamic') throw new World3DError('WORLD3D_INPUT_INVALID', 'planes must be static and meshes static or kinematic');
        this.mass = this.type === 'dynamic' ? requirePositive3D(options.mass ?? 1, 'mass') : 0;
        this.inverseMass = this.mass > 0 ? 1 / this.mass : 0;
        if (options.position) this.position.set(options.position);
        if (options.quaternion) this.quaternion.set(options.quaternion);
        this.restitution = options.restitution ?? 0.2; this.friction = options.friction ?? 0.5;
        this.linearDamping = options.linearDamping ?? 0.01; this.angularDamping = options.angularDamping ?? 0.05;
        this.isTrigger = options.isTrigger ?? false;
        this.layer = options.layer ?? 1; this.mask = options.mask ?? -1;
        this.fixedRotation = options.fixedRotation ?? false;
        this.continuous = options.continuous ?? false;
        this.node = options.node; this.userData = options.userData;
        if (this.type === 'dynamic') {
            // Principal moments of inertia about the local axes.
            const m = this.mass;
            let ix: number, iy: number, iz: number;
            if (shape.type === 'sphere') ix = iy = iz = 0.4 * m * shape.radius * shape.radius;
            else if (shape.type === 'box' || shape.type === 'convex') {
                // A hull is weighed like the box around it.
                const [x, y, z] = shape.type === 'box' ? shape.halfExtents : shape.hull.halfExtents;
                ix = m / 3 * (y * y + z * z); iy = m / 3 * (x * x + z * z); iz = m / 3 * (x * x + y * y);
            } else {
                // Treat the capsule as a cylinder spanning its full length.
                const capsule = shape as {radius: number; halfHeight: number}, r = capsule.radius, length = 2 * (capsule.halfHeight + r);
                iy = 0.5 * m * r * r; ix = iz = m * (3 * r * r + length * length) / 12;
            }
            this.inverseInertiaLocal.set([1 / ix, 1 / iy, 1 / iz]);
        }
        this.refresh();
    }
    wake(): void { this.isSleeping = false; this.sleepTime = 0; }
    setPosition(x: number, y: number, z: number): this { this.position[0] = x; this.position[1] = y; this.position[2] = z; this.wake(); this.refresh(); return this; }
    setQuaternion(x: number, y: number, z: number, w: number): this {
        const length = Math.hypot(x, y, z, w) || 1;
        this.quaternion[0] = x / length; this.quaternion[1] = y / length; this.quaternion[2] = z / length; this.quaternion[3] = w / length;
        this.wake(); this.refresh();
        return this;
    }
    setLinearVelocity(x: number, y: number, z: number): this { this.linearVelocity[0] = x; this.linearVelocity[1] = y; this.linearVelocity[2] = z; this.wake(); return this; }
    setAngularVelocity(x: number, y: number, z: number): this { this.angularVelocity[0] = x; this.angularVelocity[1] = y; this.angularVelocity[2] = z; this.wake(); return this; }
    /** Accumulate a force through the center of mass; cleared after each step. */
    applyForce(x: number, y: number, z: number): void { this.force[0]! += x; this.force[1]! += y; this.force[2]! += z; this.wake(); }
    applyTorque(x: number, y: number, z: number): void { this.torque[0]! += x; this.torque[1]! += y; this.torque[2]! += z; this.wake(); }
    /** Change velocity at once; give `point` in world space to add spin. */
    applyImpulse(x: number, y: number, z: number, point?: ArrayLike<number>): void {
        if (this.type !== 'dynamic') return;
        this.wake();
        this.linearVelocity[0]! += x * this.inverseMass; this.linearVelocity[1]! += y * this.inverseMass; this.linearVelocity[2]! += z * this.inverseMass;
        if (point && !this.fixedRotation) {
            const r = [point[0]! - this.position[0]!, point[1]! - this.position[1]!, point[2]! - this.position[2]!];
            cross(scratchA, r, [x, y, z]);
            applyInverseInertia(scratchB, this.inverseInertiaWorld, scratchA);
            this.angularVelocity[0]! += scratchB[0]!; this.angularVelocity[1]! += scratchB[1]!; this.angularVelocity[2]! += scratchB[2]!;
        }
    }
    /** @internal Recompute the rotation matrix, world inertia and bounds from the pose. */
    refresh(): void {
        const [x, y, z, w] = this.quaternion as unknown as [number, number, number, number], r = this.rotation;
        r[0] = 1 - 2 * (y * y + z * z); r[1] = 2 * (x * y - z * w); r[2] = 2 * (x * z + y * w);
        r[3] = 2 * (x * y + z * w); r[4] = 1 - 2 * (x * x + z * z); r[5] = 2 * (y * z - x * w);
        r[6] = 2 * (x * z - y * w); r[7] = 2 * (y * z + x * w); r[8] = 1 - 2 * (x * x + y * y);
        const inv = this.inverseInertiaLocal, world = this.inverseInertiaWorld;
        if (this.type === 'dynamic' && !this.fixedRotation) {
            // R * diag(inv) * R^T
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) world[i * 3 + j] = r[i * 3]! * inv[0]! * r[j * 3]! + r[i * 3 + 1]! * inv[1]! * r[j * 3 + 1]! + r[i * 3 + 2]! * inv[2]! * r[j * 3 + 2]!;
        } else world.fill(0);
        const p = this.position, box = this.aabb, shape = this.shape;
        let ex: number, ey: number, ez: number;
        if (shape.type === 'sphere') ex = ey = ez = shape.radius;
        else if (shape.type === 'convex') ex = ey = ez = shape.hull.radius;
        else if (shape.type === 'box') {
            const h = shape.halfExtents;
            ex = Math.abs(r[0]!) * h[0] + Math.abs(r[1]!) * h[1] + Math.abs(r[2]!) * h[2];
            ey = Math.abs(r[3]!) * h[0] + Math.abs(r[4]!) * h[1] + Math.abs(r[5]!) * h[2];
            ez = Math.abs(r[6]!) * h[0] + Math.abs(r[7]!) * h[1] + Math.abs(r[8]!) * h[2];
        } else if (shape.type === 'capsule') {
            ex = Math.abs(r[1]!) * shape.halfHeight + shape.radius; ey = Math.abs(r[4]!) * shape.halfHeight + shape.radius; ez = Math.abs(r[7]!) * shape.halfHeight + shape.radius;
        } else if (shape.type === 'mesh') {
            // Rotate the local bounds about their own center.
            const b = shape.mesh.bounds, cx = (b[0]! + b[3]!) / 2, cy = (b[1]! + b[4]!) / 2, cz = (b[2]! + b[5]!) / 2, hx = (b[3]! - b[0]!) / 2, hy = (b[4]! - b[1]!) / 2, hz = (b[5]! - b[2]!) / 2;
            ex = Math.abs(r[0]!) * hx + Math.abs(r[1]!) * hy + Math.abs(r[2]!) * hz; ey = Math.abs(r[3]!) * hx + Math.abs(r[4]!) * hy + Math.abs(r[5]!) * hz; ez = Math.abs(r[6]!) * hx + Math.abs(r[7]!) * hy + Math.abs(r[8]!) * hz;
            const wx = p[0]! + r[0]! * cx + r[1]! * cy + r[2]! * cz, wy = p[1]! + r[3]! * cx + r[4]! * cy + r[5]! * cz, wz = p[2]! + r[6]! * cx + r[7]! * cy + r[8]! * cz;
            box[0] = wx - ex; box[1] = wy - ey; box[2] = wz - ez; box[3] = wx + ex; box[4] = wy + ey; box[5] = wz + ez;
            return;
        } else ex = ey = ez = Infinity;
        box[0] = p[0]! - ex; box[1] = p[1]! - ey; box[2] = p[2]! - ez; box[3] = p[0]! + ex; box[4] = p[1]! + ey; box[5] = p[2]! + ez;
    }
}
const scratchA = v3(), scratchB = v3(), scratchC = v3(), scratchD = v3();
function applyInverseInertia(out: Vec, m: Float64Array, v: ArrayLike<number>): Vec {
    const x = v[0]!, y = v[1]!, z = v[2]!;
    out[0] = m[0]! * x + m[1]! * y + m[2]! * z; out[1] = m[3]! * x + m[4]! * y + m[5]! * z; out[2] = m[6]! * x + m[7]! * y + m[8]! * z;
    return out;
}

// ---- narrow phase -------------------------------------------------------------
interface Contact { px: number; py: number; pz: number; nx: number; ny: number; nz: number; depth: number; feature: number }
/** Contacts for one pair; normals point from the first body toward the second. */
class Manifold {
    count = 0;
    /** Identifies which part of the shapes the next contacts come from, so impulses can be matched across steps. */
    feature = 0;
    readonly contacts: Contact[] = Array.from({length: 8}, () => ({px: 0, py: 0, pz: 0, nx: 0, ny: 0, nz: 0, depth: 0, feature: 0}));
    add(px: number, py: number, pz: number, nx: number, ny: number, nz: number, depth: number): void {
        if (this.count >= this.contacts.length) return;
        const c = this.contacts[this.count++]!;
        c.px = px; c.py = py; c.pz = pz; c.nx = nx; c.ny = ny; c.nz = nz; c.depth = depth; c.feature = this.feature;
    }
    /** Like add(), but when full it replaces the shallowest contact if the new one is deeper. */
    addDeep(px: number, py: number, pz: number, nx: number, ny: number, nz: number, depth: number): void {
        if (this.count < this.contacts.length) { this.add(px, py, pz, nx, ny, nz, depth); return; }
        let shallow = 0;
        for (let i = 1; i < this.count; i++) if (this.contacts[i]!.depth < this.contacts[shallow]!.depth) shallow = i;
        const c = this.contacts[shallow]!;
        if (depth <= c.depth) return;
        c.px = px; c.py = py; c.pz = pz; c.nx = nx; c.ny = ny; c.nz = nz; c.depth = depth; c.feature = this.feature;
    }
    /** Keep the deepest contacts and reverse normals when the pair was tested in swapped order. */
    finish(flip: boolean): void {
        if (this.count > PHYSICS3D_LIMITS.maxContactsPerPair) {
            const kept = this.contacts.slice(0, this.count).sort((a, b) => b.depth - a.depth);
            for (let i = 0; i < this.count; i++) Object.assign(this.contacts[i]!, kept[i]!);
            this.count = PHYSICS3D_LIMITS.maxContactsPerPair;
        }
        if (flip) for (let i = 0; i < this.count; i++) { const c = this.contacts[i]!; c.nx = -c.nx; c.ny = -c.ny; c.nz = -c.nz; }
    }
}
const segA = v3(), segB = v3(), segC = v3(), segD = v3(), local = v3(), closest = v3();
function capsuleSegment(body: RigidBody3D, a: Vec, b: Vec): void {
    const h = (body.shape as {halfHeight: number}).halfHeight, r = body.rotation, p = body.position;
    a[0] = p[0]! - r[1]! * h; a[1] = p[1]! - r[4]! * h; a[2] = p[2]! - r[7]! * h;
    b[0] = p[0]! + r[1]! * h; b[1] = p[1]! + r[4]! * h; b[2] = p[2]! + r[7]! * h;
}
function sphereSphere(m: Manifold, ax: number, ay: number, az: number, ra: number, bx: number, by: number, bz: number, rb: number): void {
    const dx = bx - ax, dy = by - ay, dz = bz - az, d2 = dx * dx + dy * dy + dz * dz, sum = ra + rb;
    if (d2 >= sum * sum) return;
    const d = Math.sqrt(d2), nx = d > 1e-9 ? dx / d : 0, ny = d > 1e-9 ? dy / d : 1, nz = d > 1e-9 ? dz / d : 0;
    m.add(ax + nx * (ra - (sum - d) * 0.5), ay + ny * (ra - (sum - d) * 0.5), az + nz * (ra - (sum - d) * 0.5), nx, ny, nz, sum - d);
}
/** Sphere (first) against a plane body (second). */
function spherePlane(m: Manifold, x: number, y: number, z: number, radius: number, plane: RigidBody3D): void {
    const r = plane.rotation, nx = r[1]!, ny = r[4]!, nz = r[7]!, p = plane.position;
    const distance = (x - p[0]!) * nx + (y - p[1]!) * ny + (z - p[2]!) * nz;
    if (distance >= radius) return;
    m.add(x - nx * distance, y - ny * distance, z - nz * distance, -nx, -ny, -nz, radius - distance);
}
/** Sphere (first) against a box body (second). */
function sphereBox(m: Manifold, x: number, y: number, z: number, radius: number, box: RigidBody3D): void {
    const r = box.rotation, p = box.position, h = (box.shape as {halfExtents: readonly number[]}).halfExtents;
    const dx = x - p[0]!, dy = y - p[1]!, dz = z - p[2]!;
    local[0] = r[0]! * dx + r[3]! * dy + r[6]! * dz; local[1] = r[1]! * dx + r[4]! * dy + r[7]! * dz; local[2] = r[2]! * dx + r[5]! * dy + r[8]! * dz;
    let inside = true;
    for (let i = 0; i < 3; i++) {
        const limit = h[i]!;
        closest[i] = clamp(local[i]!, -limit, limit);
        if (closest[i] !== local[i]) inside = false;
    }
    let lx: number, ly: number, lz: number, depth: number;
    if (inside) {
        // Center inside the box: leave through the nearest face.
        let axis = 0, best = Infinity;
        for (let i = 0; i < 3; i++) { const gap = h[i]! - Math.abs(local[i]!); if (gap < best) { best = gap; axis = i; } }
        const sign = local[axis]! >= 0 ? 1 : -1;
        lx = axis === 0 ? sign : 0; ly = axis === 1 ? sign : 0; lz = axis === 2 ? sign : 0;
        depth = best + radius;
    } else {
        lx = local[0]! - closest[0]!; ly = local[1]! - closest[1]!; lz = local[2]! - closest[2]!;
        const d = Math.hypot(lx, ly, lz);
        if (d >= radius) return;
        lx /= d; ly /= d; lz /= d; depth = radius - d;
    }
    // Local normal points from the box toward the sphere; the manifold wants sphere -> box.
    const nx = r[0]! * lx + r[1]! * ly + r[2]! * lz, ny = r[3]! * lx + r[4]! * ly + r[5]! * lz, nz = r[6]! * lx + r[7]! * ly + r[8]! * lz;
    m.add(x - nx * (radius - depth * 0.5), y - ny * (radius - depth * 0.5), z - nz * (radius - depth * 0.5), -nx, -ny, -nz, depth);
}
function closestOnSegment(out: Vec, a: Vec, b: Vec, x: number, y: number, z: number): number {
    const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!, dz = b[2]! - a[2]!, length2 = dx * dx + dy * dy + dz * dz;
    const t = length2 > 0 ? clamp(((x - a[0]!) * dx + (y - a[1]!) * dy + (z - a[2]!) * dz) / length2, 0, 1) : 0;
    out[0] = a[0]! + dx * t; out[1] = a[1]! + dy * t; out[2] = a[2]! + dz * t;
    return t;
}
/** Closest points between segments p1-q1 and p2-q2, written to c1 and c2. */
function closestBetweenSegments(p1: ArrayLike<number>, q1: ArrayLike<number>, p2: ArrayLike<number>, q2: ArrayLike<number>, c1: Vec, c2: Vec): void {
    const ux = q1[0]! - p1[0]!, uy = q1[1]! - p1[1]!, uz = q1[2]! - p1[2]!;
    const vx = q2[0]! - p2[0]!, vy = q2[1]! - p2[1]!, vz = q2[2]! - p2[2]!;
    const rx = p1[0]! - p2[0]!, ry = p1[1]! - p2[1]!, rz = p1[2]! - p2[2]!;
    const a = ux * ux + uy * uy + uz * uz, e = vx * vx + vy * vy + vz * vz, f = vx * rx + vy * ry + vz * rz;
    let s = 0, t = 0;
    if (a <= 1e-12 && e <= 1e-12) { s = t = 0; }
    else if (a <= 1e-12) t = clamp(f / e, 0, 1);
    else {
        const c = ux * rx + uy * ry + uz * rz;
        if (e <= 1e-12) s = clamp(-c / a, 0, 1);
        else {
            const b = ux * vx + uy * vy + uz * vz, denominator = a * e - b * b;
            s = denominator > 1e-12 ? clamp((b * f - c * e) / denominator, 0, 1) : 0.5;
            t = (b * s + f) / e;
            if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
        }
    }
    c1[0] = p1[0]! + ux * s; c1[1] = p1[1]! + uy * s; c1[2] = p1[2]! + uz * s;
    c2[0] = p2[0]! + vx * t; c2[1] = p2[1]! + vy * t; c2[2] = p2[2]! + vz * t;
}
function capsuleBox(m: Manifold, capsule: RigidBody3D, box: RigidBody3D): void {
    const radius = (capsule.shape as {radius: number}).radius;
    capsuleSegment(capsule, segA, segB);
    // Walk toward the segment point nearest the box, then test that point and both caps
    // so a capsule lying on a face gets support along its whole length.
    const r = box.rotation, p = box.position, h = (box.shape as {halfExtents: readonly number[]}).halfExtents;
    let t = closestOnSegment(segC, segA, segB, p[0]!, p[1]!, p[2]!);
    for (let i = 0; i < 4; i++) {
        const dx = segC[0]! - p[0]!, dy = segC[1]! - p[1]!, dz = segC[2]! - p[2]!;
        const lx = clamp(r[0]! * dx + r[3]! * dy + r[6]! * dz, -h[0]!, h[0]!), ly = clamp(r[1]! * dx + r[4]! * dy + r[7]! * dz, -h[1]!, h[1]!), lz = clamp(r[2]! * dx + r[5]! * dy + r[8]! * dz, -h[2]!, h[2]!);
        t = closestOnSegment(segC, segA, segB, p[0]! + r[0]! * lx + r[1]! * ly + r[2]! * lz, p[1]! + r[3]! * lx + r[4]! * ly + r[5]! * lz, p[2]! + r[6]! * lx + r[7]! * ly + r[8]! * lz);
    }
    if (t > 0.05 && t < 0.95) sphereBox(m, segC[0]!, segC[1]!, segC[2]!, radius, box);
    m.feature = 1; sphereBox(m, segA[0]!, segA[1]!, segA[2]!, radius, box);
    m.feature = 2; sphereBox(m, segB[0]!, segB[1]!, segB[2]!, radius, box);
}
/**
 * Box corners this close to a surface join the manifold before they touch. The solver only
 * stops them from closing the gap within one step, which keeps resting faces from rocking.
 */
const MARGIN = 0.02;
const corner = v3();
function boxCorner(out: Vec, box: RigidBody3D, index: number): Vec {
    const r = box.rotation, p = box.position, h = (box.shape as {halfExtents: readonly number[]}).halfExtents;
    const x = (index & 1 ? h[0]! : -h[0]!), y = (index & 2 ? h[1]! : -h[1]!), z = (index & 4 ? h[2]! : -h[2]!);
    out[0] = p[0]! + r[0]! * x + r[1]! * y + r[2]! * z; out[1] = p[1]! + r[3]! * x + r[4]! * y + r[5]! * z; out[2] = p[2]! + r[6]! * x + r[7]! * y + r[8]! * z;
    return out;
}
function boxPlane(m: Manifold, box: RigidBody3D, plane: RigidBody3D): void {
    const r = plane.rotation, nx = r[1]!, ny = r[4]!, nz = r[7]!, p = plane.position;
    for (let i = 0; i < 8; i++) {
        boxCorner(corner, box, i);
        m.feature = i;
        const distance = (corner[0]! - p[0]!) * nx + (corner[1]! - p[1]!) * ny + (corner[2]! - p[2]!) * nz;
        if (distance < MARGIN) m.add(corner[0]! - nx * distance * 0.5, corner[1]! - ny * distance * 0.5, corner[2]! - nz * distance * 0.5, -nx, -ny, -nz, -distance);
    }
}
const axisScratch = v3(), bestAxis = v3();
function boxProjection(box: RigidBody3D, axis: ArrayLike<number>): number {
    const r = box.rotation, h = (box.shape as {halfExtents: readonly number[]}).halfExtents;
    return Math.abs(axis[0]! * r[0]! + axis[1]! * r[3]! + axis[2]! * r[6]!) * h[0]! + Math.abs(axis[0]! * r[1]! + axis[1]! * r[4]! + axis[2]! * r[7]!) * h[1]!
        + Math.abs(axis[0]! * r[2]! + axis[1]! * r[5]! + axis[2]! * r[8]!) * h[2]!;
}
function insideBox(box: RigidBody3D, point: Vec, tolerance: number): boolean {
    const r = box.rotation, p = box.position, h = (box.shape as {halfExtents: readonly number[]}).halfExtents;
    const dx = point[0]! - p[0]!, dy = point[1]! - p[1]!, dz = point[2]! - p[2]!;
    return Math.abs(r[0]! * dx + r[3]! * dy + r[6]! * dz) <= h[0]! + tolerance && Math.abs(r[1]! * dx + r[4]! * dy + r[7]! * dz) <= h[1]! + tolerance
        && Math.abs(r[2]! * dx + r[5]! * dy + r[8]! * dz) <= h[2]! + tolerance;
}
function boxBox(m: Manifold, a: RigidBody3D, b: RigidBody3D): void {
    const ra = a.rotation, rb = b.rotation, d = [b.position[0]! - a.position[0]!, b.position[1]! - a.position[1]!, b.position[2]! - a.position[2]!];
    let best = Infinity, bestDepth = 0;
    // Separating-axis test over the 6 face normals and 9 edge cross products.
    const test = (x: number, y: number, z: number, bias: number): boolean => {
        const length = Math.hypot(x, y, z);
        if (length < 1e-6) return true;
        axisScratch[0] = x / length; axisScratch[1] = y / length; axisScratch[2] = z / length;
        const overlap = boxProjection(a, axisScratch) + boxProjection(b, axisScratch) - Math.abs(dot(axisScratch, d));
        if (overlap <= 0) return false;
        // Face axes win ties so resting contacts stay on faces.
        if (overlap * bias < best) { best = overlap * bias; bestAxis.set(axisScratch); bestDepth = overlap; }
        return true;
    };
    for (let i = 0; i < 3; i++) if (!test(ra[i]!, ra[3 + i]!, ra[6 + i]!, 1) || !test(rb[i]!, rb[3 + i]!, rb[6 + i]!, 1)) return;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const ax = ra[i]!, ay = ra[3 + i]!, az = ra[6 + i]!, bx = rb[j]!, by = rb[3 + j]!, bz = rb[6 + j]!;
        if (!test(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx, 1.05)) return;
    }
    if (dot(bestAxis, d) < 0) { bestAxis[0] = -bestAxis[0]!; bestAxis[1] = -bestAxis[1]!; bestAxis[2] = -bestAxis[2]!; }
    const nx = bestAxis[0]!, ny = bestAxis[1]!, nz = bestAxis[2]!, extentA = boxProjection(a, bestAxis), extentB = boxProjection(b, bestAxis);
    const before = m.count;
    for (let i = 0; i < 8; i++) {
        boxCorner(corner, b, i);
        m.feature = i;
        if (insideBox(a, corner, MARGIN)) {
            const depth = extentA - ((corner[0]! - a.position[0]!) * nx + (corner[1]! - a.position[1]!) * ny + (corner[2]! - a.position[2]!) * nz);
            if (depth > -MARGIN) m.add(corner[0]!, corner[1]!, corner[2]!, nx, ny, nz, depth);
        }
        boxCorner(corner, a, i);
        m.feature = 8 + i;
        if (insideBox(b, corner, MARGIN)) {
            const depth = extentB + ((corner[0]! - b.position[0]!) * nx + (corner[1]! - b.position[1]!) * ny + (corner[2]! - b.position[2]!) * nz);
            if (depth > -MARGIN) m.add(corner[0]!, corner[1]!, corner[2]!, nx, ny, nz, depth);
        }
    }
    if (m.count === before) {
        m.feature = 16;
        // Edge against edge: no corner is inside, so use the midpoint of the two facing surfaces.
        const px = (a.position[0]! + nx * extentA + b.position[0]! - nx * extentB) * 0.5, py = (a.position[1]! + ny * extentA + b.position[1]! - ny * extentB) * 0.5;
        const pz = (a.position[2]! + nz * extentA + b.position[2]! - nz * extentB) * 0.5;
        m.add(px, py, pz, nx, ny, nz, bestDepth);
    }
}
function isMoving(body: RigidBody3D): boolean {
    if (body.type === 'static' || body.isSleeping) return false;
    const v = body.linearVelocity, w = body.angularVelocity;
    return v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]! > 4 * SLEEP_LINEAR * SLEEP_LINEAR || w[0]! * w[0]! + w[1]! * w[1]! + w[2]! * w[2]! > 4 * SLEEP_ANGULAR * SLEEP_ANGULAR;
}
// ---- triangle meshes ----
interface MeshCandidate { x: number; y: number; z: number; nx: number; ny: number; nz: number; depth: number; face: boolean; feature: number }
const candidates: MeshCandidate[] = [];
let candidateCount = 0;
const meshPoint = [0, 0, 0], meshNormal = [0, 0, 0], meshSegA = [0, 0, 0], meshSegB = [0, 0, 0];
function toMeshLocal(out: number[], body: RigidBody3D, x: number, y: number, z: number): void {
    const r = body.rotation, p = body.position, dx = x - p[0]!, dy = y - p[1]!, dz = z - p[2]!;
    out[0] = r[0]! * dx + r[3]! * dy + r[6]! * dz; out[1] = r[1]! * dx + r[4]! * dy + r[7]! * dz; out[2] = r[2]! * dx + r[5]! * dy + r[8]! * dz;
}
/** Test a sphere, given in the mesh's local space, against one triangle and record a candidate contact. */
function sphereTriangle(mesh: TriangleMeshShape3D, triangle: number, x: number, y: number, z: number, radius: number, feature: number): void {
    const face = mesh.closestPoint(triangle, x, y, z, meshPoint);
    let nx = meshPoint[0]! - x, ny = meshPoint[1]! - y, nz = meshPoint[2]! - z;
    const distance = Math.hypot(nx, ny, nz);
    if (distance >= radius) return;
    mesh.triangleNormal(triangle, meshNormal);
    let depth = radius - distance;
    // Triangles are solid on their front side only. A center that has sunk behind the
    // face is pushed back out through it instead of further in.
    const side = (x - meshPoint[0]!) * meshNormal[0]! + (y - meshPoint[1]!) * meshNormal[1]! + (z - meshPoint[2]!) * meshNormal[2]!;
    if (face && side < 0) { nx = -meshNormal[0]!; ny = -meshNormal[1]!; nz = -meshNormal[2]!; depth = radius + distance; }
    else if (distance > 1e-9) { nx /= distance; ny /= distance; nz /= distance; }
    else { nx = -meshNormal[0]!; ny = -meshNormal[1]!; nz = -meshNormal[2]!; }
    // Back-facing edge hits belong to the far side of a thin wall.
    if (!face && nx * meshNormal[0]! + ny * meshNormal[1]! + nz * meshNormal[2]! > 0.01) return;
    let c = candidates[candidateCount];
    if (!c) c = candidates[candidateCount] = {x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, depth: 0, face: false, feature: 0};
    candidateCount++;
    c.x = meshPoint[0]!; c.y = meshPoint[1]!; c.z = meshPoint[2]!; c.nx = nx; c.ny = ny; c.nz = nz; c.depth = depth; c.face = face; c.feature = feature;
}
/** Turn the candidates gathered for one body into world-space contacts. */
function emitMeshContacts(m: Manifold, meshBody: RigidBody3D): void {
    const r = meshBody.rotation, p = meshBody.position;
    for (let i = 0; i < candidateCount; i++) {
        const c = candidates[i]!;
        let keep = true;
        for (let j = 0; j < candidateCount && keep; j++) {
            if (j === i) continue;
            const other = candidates[j]!, alike = c.nx * other.nx + c.ny * other.ny + c.nz * other.nz;
            // An edge or corner hit that leans away from a deeper contact on the same surface
            // would only add a sideways bump at the seams of a tessellated floor.
            if (!c.face && other.depth > c.depth + 1e-6 && (alike > 0.9 || (other.face && alike > 0.7))) keep = false;
            // Neighbouring triangles report the same point twice; keep the first.
            else if (j < i && c.face === other.face && alike > 0.999 && Math.abs(c.x - other.x) + Math.abs(c.y - other.y) + Math.abs(c.z - other.z) < 1e-3) keep = false;
        }
        if (!keep) continue;
        m.feature = c.feature;
        m.addDeep(p[0]! + r[0]! * c.x + r[1]! * c.y + r[2]! * c.z, p[1]! + r[3]! * c.x + r[4]! * c.y + r[5]! * c.z, p[2]! + r[6]! * c.x + r[7]! * c.y + r[8]! * c.z,
            r[0]! * c.nx + r[1]! * c.ny + r[2]! * c.nz, r[3]! * c.nx + r[4]! * c.ny + r[5]! * c.nz, r[6]! * c.nx + r[7]! * c.ny + r[8]! * c.nz, c.depth);
    }
}
function sphereMesh(m: Manifold, x: number, y: number, z: number, radius: number, meshBody: RigidBody3D, feature: number): void {
    const mesh = (meshBody.shape as {mesh: TriangleMeshShape3D}).mesh;
    toMeshLocal(meshSegA, meshBody, x, y, z);
    const lx = meshSegA[0]!, ly = meshSegA[1]!, lz = meshSegA[2]!;
    candidateCount = 0;
    mesh.query(lx - radius, ly - radius, lz - radius, lx + radius, ly + radius, lz + radius, triangle => sphereTriangle(mesh, triangle, lx, ly, lz, radius, feature + (triangle & 1023)));
    emitMeshContacts(m, meshBody);
}
function capsuleMesh(m: Manifold, capsule: RigidBody3D, meshBody: RigidBody3D): void {
    const mesh = (meshBody.shape as {mesh: TriangleMeshShape3D}).mesh, radius = (capsule.shape as {radius: number}).radius;
    capsuleSegment(capsule, segA, segB);
    toMeshLocal(meshSegA, meshBody, segA[0]!, segA[1]!, segA[2]!); toMeshLocal(meshSegB, meshBody, segB[0]!, segB[1]!, segB[2]!);
    const ax = meshSegA[0]!, ay = meshSegA[1]!, az = meshSegA[2]!, bx = meshSegB[0]!, by = meshSegB[1]!, bz = meshSegB[2]!;
    const dx = bx - ax, dy = by - ay, dz = bz - az, radius2 = radius * radius;
    let triangle = 0, bestDistance2 = radius2, bestFace = false, bestX = 0, bestY = 0, bestZ = 0;
    const consider = (x: number, y: number, z: number): void => {
        const face = mesh.closestPoint(triangle, x, y, z, meshPoint);
        const px = x - meshPoint[0]!, py = y - meshPoint[1]!, pz = z - meshPoint[2]!;
        const distance2 = px * px + py * py + pz * pz;
        if (distance2 >= radius2 || distance2 > bestDistance2 || (distance2 === bestDistance2 && (!face || bestFace))) return;
        // Keep the one-sided edge rule used by the sphere contact solver.
        const side = px * meshNormal[0]! + py * meshNormal[1]! + pz * meshNormal[2]!;
        if (!face && distance2 > 1e-18 && side < -0.01 * Math.sqrt(distance2)) return;
        bestDistance2 = distance2; bestFace = face; bestX = x; bestY = y; bestZ = z;
    };
    const positions = mesh.positions, indices = mesh.indices;
    candidateCount = 0;
    mesh.query(Math.min(ax, bx) - radius, Math.min(ay, by) - radius, Math.min(az, bz) - radius, Math.max(ax, bx) + radius, Math.max(ay, by) + radius, Math.max(az, bz) + radius, index => {
        triangle = index; bestDistance2 = radius2; bestFace = false;
        mesh.triangleNormal(triangle, meshNormal);
        // A minimum is attained at an axis endpoint, at a triangle edge, or at a crossing of the triangle plane.
        consider(ax, ay, az);
        consider(bx, by, bz);
        const base = triangle * 3, vertex = indices[base]! * 3;
        const alongNormal = dx * meshNormal[0]! + dy * meshNormal[1]! + dz * meshNormal[2]!;
        if (alongNormal !== 0) {
            const offset = (positions[vertex]! - ax) * meshNormal[0]! + (positions[vertex + 1]! - ay) * meshNormal[1]! + (positions[vertex + 2]! - az) * meshNormal[2]!;
            const t = offset / alongNormal;
            if (t > 0 && t < 1) consider(ax + dx * t, ay + dy * t, az + dz * t);
        }
        for (let edge = 0; edge < 3; edge++) {
            const first = indices[base + edge]! * 3, second = indices[base + (edge + 1) % 3]! * 3;
            for (let i = 0; i < 3; i++) { segC[i] = positions[first + i]!; segD[i] = positions[second + i]!; }
            closestBetweenSegments(meshSegA, meshSegB, segC, segD, scratchC, scratchD);
            consider(scratchC[0]!, scratchC[1]!, scratchC[2]!);
        }
        if (bestDistance2 < radius2) sphereTriangle(mesh, triangle, bestX, bestY, bestZ, radius, triangle & 1023);
    });
    emitMeshContacts(m, meshBody);
}
// ---- boxes and hulls as generic convex solids ----
const solidNormal = [0, 0, 0], solidPoint = v3();
function solidVertexCount(body: RigidBody3D): number { return body.shape.type === 'convex' ? body.shape.hull.points.length / 3 : 8; }
function solidVertex(out: Vec, body: RigidBody3D, index: number): Vec {
    if (body.shape.type !== 'convex') return boxCorner(out, body, index);
    const points = body.shape.hull.points, r = body.rotation, p = body.position, x = points[index * 3]!, y = points[index * 3 + 1]!, z = points[index * 3 + 2]!;
    out[0] = p[0]! + r[0]! * x + r[1]! * y + r[2]! * z; out[1] = p[1]! + r[3]! * x + r[4]! * y + r[5]! * z; out[2] = p[2]! + r[6]! * x + r[7]! * y + r[8]! * z;
    return out;
}
/** Signed distance of a world point to a box or hull (negative inside), with the world normal of the nearest face. */
function solidDistance(body: RigidBody3D, x: number, y: number, z: number, normal: number[]): number {
    const r = body.rotation, p = body.position, dx = x - p[0]!, dy = y - p[1]!, dz = z - p[2]!;
    const lx = r[0]! * dx + r[3]! * dy + r[6]! * dz, ly = r[1]! * dx + r[4]! * dy + r[7]! * dz, lz = r[2]! * dx + r[5]! * dy + r[8]! * dz;
    let distance: number, nx = 0, ny = 0, nz = 0;
    if (body.shape.type === 'convex') { distance = body.shape.hull.signedDistance(lx, ly, lz, solidNormal); nx = solidNormal[0]!; ny = solidNormal[1]!; nz = solidNormal[2]!; }
    else {
        const h = (body.shape as {halfExtents: readonly number[]}).halfExtents, ax = Math.abs(lx) - h[0]!, ay = Math.abs(ly) - h[1]!, az = Math.abs(lz) - h[2]!;
        if (ax >= ay && ax >= az) { distance = ax; nx = lx >= 0 ? 1 : -1; } else if (ay >= az) { distance = ay; ny = ly >= 0 ? 1 : -1; } else { distance = az; nz = lz >= 0 ? 1 : -1; }
    }
    normal[0] = r[0]! * nx + r[1]! * ny + r[2]! * nz; normal[1] = r[3]! * nx + r[4]! * ny + r[5]! * nz; normal[2] = r[6]! * nx + r[7]! * ny + r[8]! * nz;
    return distance;
}
const faceNormal = [0, 0, 0];
/** Sphere (first) against a hull (second), treating the hull as the intersection of its face planes. */
function sphereSolid(m: Manifold, x: number, y: number, z: number, radius: number, solid: RigidBody3D): void {
    const distance = solidDistance(solid, x, y, z, faceNormal);
    if (distance >= radius) return;
    const nx = faceNormal[0]!, ny = faceNormal[1]!, nz = faceNormal[2]!;
    m.add(x - nx * (distance + (radius - distance) * 0.5), y - ny * (distance + (radius - distance) * 0.5), z - nz * (distance + (radius - distance) * 0.5), -nx, -ny, -nz, radius - distance);
}
/** Corners of each solid that have entered the other; `a` is the first body of the pair. */
function solidSolid(m: Manifold, a: RigidBody3D, b: RigidBody3D): void {
    const countA = solidVertexCount(a), countB = solidVertexCount(b);
    for (let i = 0; i < countA; i++) {
        solidVertex(solidPoint, a, i);
        const distance = solidDistance(b, solidPoint[0]!, solidPoint[1]!, solidPoint[2]!, faceNormal);
        // The face normal of b points back toward a, so the pair normal is its opposite.
        if (distance < MARGIN) { m.feature = i; m.addDeep(solidPoint[0]!, solidPoint[1]!, solidPoint[2]!, -faceNormal[0]!, -faceNormal[1]!, -faceNormal[2]!, -distance); }
    }
    for (let i = 0; i < countB; i++) {
        solidVertex(solidPoint, b, i);
        const distance = solidDistance(a, solidPoint[0]!, solidPoint[1]!, solidPoint[2]!, faceNormal);
        if (distance < MARGIN) { m.feature = 64 + i; m.addDeep(solidPoint[0]!, solidPoint[1]!, solidPoint[2]!, faceNormal[0]!, faceNormal[1]!, faceNormal[2]!, -distance); }
    }
    solidEdges(m, a, b);
}
const BOX_EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
function solidEdgeCount(body: RigidBody3D): number { return body.shape.type === 'convex' ? body.shape.hull.edges.length / 2 : 12; }
function solidEdge(body: RigidBody3D, index: number, a: Vec, b: Vec): void {
    const list = body.shape.type === 'convex' ? body.shape.hull.edges : BOX_EDGES;
    solidVertex(a, body, list[index * 2]!); solidVertex(b, body, list[index * 2 + 1]!);
}
const clipRange = [0, 0], clipA = v3(), clipB = v3();
/** Part of the world segment a-b that lies inside a box or hull, as parameters in clipRange; false when none does. */
function clipSegmentSolid(body: RigidBody3D, a: Vec, b: Vec): boolean {
    const r = body.rotation, p = body.position;
    let dx = a[0]! - p[0]!, dy = a[1]! - p[1]!, dz = a[2]! - p[2]!;
    const ax = r[0]! * dx + r[3]! * dy + r[6]! * dz, ay = r[1]! * dx + r[4]! * dy + r[7]! * dz, az = r[2]! * dx + r[5]! * dy + r[8]! * dz;
    dx = b[0]! - p[0]!; dy = b[1]! - p[1]!; dz = b[2]! - p[2]!;
    const ex = r[0]! * dx + r[3]! * dy + r[6]! * dz - ax, ey = r[1]! * dx + r[4]! * dy + r[7]! * dz - ay, ez = r[2]! * dx + r[5]! * dy + r[8]! * dz - az;
    let enter = 0, exit = 1;
    const cut = (side: number, along: number): boolean => {
        // side: signed distance of the start to a plane; along: its change over the segment.
        if (Math.abs(along) < 1e-12) return side <= 0;
        const t = -side / along;
        if (along < 0) { if (t > enter) enter = t; } else if (t < exit) exit = t;
        return enter < exit;
    };
    if (body.shape.type === 'convex') {
        const planes = body.shape.hull.planes;
        for (let i = 0; i < planes.length; i += 4) {
            const nx = planes[i]!, ny = planes[i + 1]!, nz = planes[i + 2]!;
            if (!cut(nx * ax + ny * ay + nz * az + planes[i + 3]!, nx * ex + ny * ey + nz * ez)) return false;
        }
    } else {
        const h = (body.shape as {halfExtents: readonly number[]}).halfExtents;
        if (!cut(ax - h[0]!, ex) || !cut(-ax - h[0]!, -ex) || !cut(ay - h[1]!, ey) || !cut(-ay - h[1]!, -ey) || !cut(az - h[2]!, ez) || !cut(-az - h[2]!, -ez)) return false;
    }
    clipRange[0] = enter; clipRange[1] = exit;
    return true;
}
const edgeA = v3(), edgeB = v3(), otherA = v3(), otherB = v3(), nearA = v3(), nearB = v3();
/**
 * Edge against edge: an edge of `a` that passes through `b` while both its
 * ends stay outside touches no corner, so the corner tests miss it. The
 * contact sits between that edge and the nearest edge of `b`, along the
 * direction perpendicular to both.
 */
function solidEdges(m: Manifold, a: RigidBody3D, b: RigidBody3D): void {
    const countA = solidEdgeCount(a), countB = solidEdgeCount(b);
    for (let i = 0; i < countA; i++) {
        solidEdge(a, i, edgeA, edgeB);
        if (!clipSegmentSolid(b, edgeA, edgeB)) continue;
        const enter = clipRange[0]!, exit = clipRange[1]!;
        if (enter < 1e-4 || exit > 1 - 1e-4) continue;   // an end is inside: a corner contact covers it
        const dx = edgeB[0]! - edgeA[0]!, dy = edgeB[1]! - edgeA[1]!, dz = edgeB[2]! - edgeA[2]!;
        clipA[0] = edgeA[0]! + dx * enter; clipA[1] = edgeA[1]! + dy * enter; clipA[2] = edgeA[2]! + dz * enter;
        clipB[0] = edgeA[0]! + dx * exit; clipB[1] = edgeA[1]! + dy * exit; clipB[2] = edgeA[2]! + dz * exit;
        let best = Infinity, nx = 0, ny = 0, nz = 0, depth = 0, px = 0, py = 0, pz = 0;
        for (let j = 0; j < countB; j++) {
            solidEdge(b, j, otherA, otherB);
            closestBetweenSegments(clipA, clipB, otherA, otherB, nearA, nearB);
            const gap = Math.hypot(nearA[0]! - nearB[0]!, nearA[1]! - nearB[1]!, nearA[2]! - nearB[2]!);
            if (gap >= best) continue;
            const fx = otherB[0]! - otherA[0]!, fy = otherB[1]! - otherA[1]!, fz = otherB[2]! - otherA[2]!;
            let cx = dy * fz - dz * fy, cy = dz * fx - dx * fz, cz = dx * fy - dy * fx;
            const length = Math.hypot(cx, cy, cz);
            if (length < 1e-9) continue;   // parallel edges: a face or corner contact describes it better
            cx /= length; cy /= length; cz /= length;
            // b's inside lies beyond its edge, which fixes the direction from a to b.
            if (cx * (b.position[0]! - nearB[0]!) + cy * (b.position[1]! - nearB[1]!) + cz * (b.position[2]! - nearB[2]!) < 0) { cx = -cx; cy = -cy; cz = -cz; }
            const overlap = cx * (nearA[0]! - nearB[0]!) + cy * (nearA[1]! - nearB[1]!) + cz * (nearA[2]! - nearB[2]!);
            if (overlap <= 0) continue;
            best = gap; nx = cx; ny = cy; nz = cz; depth = overlap;
            px = (nearA[0]! + nearB[0]!) / 2; py = (nearA[1]! + nearB[1]!) / 2; pz = (nearA[2]! + nearB[2]!) / 2;
        }
        if (best < Infinity) { m.feature = 256 + i; m.addDeep(px, py, pz, nx, ny, nz, depth); }
    }
}
function solidPlane(m: Manifold, solid: RigidBody3D, plane: RigidBody3D): void {
    const r = plane.rotation, nx = r[1]!, ny = r[4]!, nz = r[7]!, p = plane.position, count = solidVertexCount(solid);
    for (let i = 0; i < count; i++) {
        solidVertex(solidPoint, solid, i);
        const distance = (solidPoint[0]! - p[0]!) * nx + (solidPoint[1]! - p[1]!) * ny + (solidPoint[2]! - p[2]!) * nz;
        if (distance < MARGIN) { m.feature = i; m.addDeep(solidPoint[0]! - nx * distance * 0.5, solidPoint[1]! - ny * distance * 0.5, solidPoint[2]! - nz * distance * 0.5, -nx, -ny, -nz, -distance); }
    }
}
/** Boxes and hulls rest on meshes through their corners, which is enough for props on floors and slopes. */
function solidMesh(m: Manifold, solid: RigidBody3D, meshBody: RigidBody3D): void {
    const mesh = (meshBody.shape as {mesh: TriangleMeshShape3D}).mesh, radius = 0.03, count = solidVertexCount(solid);
    candidateCount = 0;
    for (let i = 0; i < count; i++) {
        solidVertex(solidPoint, solid, i);
        toMeshLocal(meshSegA, meshBody, solidPoint[0]!, solidPoint[1]!, solidPoint[2]!);
        const lx = meshSegA[0]!, ly = meshSegA[1]!, lz = meshSegA[2]!;
        mesh.query(lx - radius, ly - radius, lz - radius, lx + radius, ly + radius, lz + radius, triangle => sphereTriangle(mesh, triangle, lx, ly, lz, radius, (i & 31) * 1024 + (triangle & 1023)));
    }
    emitMeshContacts(m, meshBody);
}
const ORDER = {sphere: 0, capsule: 1, box: 2, convex: 3, plane: 4, mesh: 5} as const;
/** Fill `m` with the contacts between two bodies; returns false when they do not touch. */
function collide(m: Manifold, first: RigidBody3D, second: RigidBody3D): boolean {
    m.count = 0; m.feature = 0;
    // Dispatch on an ordered pair so each combination is written once.
    const flip = ORDER[first.shape.type] > ORDER[second.shape.type], a = flip ? second : first, b = flip ? first : second;
    const pa = a.position, pb = b.position, sa = a.shape, sb = b.shape;
    if (sb.type === 'mesh') {
        if (sa.type === 'sphere') sphereMesh(m, pa[0]!, pa[1]!, pa[2]!, sa.radius, b, 0);
        else if (sa.type === 'capsule') capsuleMesh(m, a, b);
        else if (sa.type === 'box' || sa.type === 'convex') solidMesh(m, a, b);
    } else if (sa.type === 'sphere') {
        if (sb.type === 'sphere') sphereSphere(m, pa[0]!, pa[1]!, pa[2]!, sa.radius, pb[0]!, pb[1]!, pb[2]!, sb.radius);
        else if (sb.type === 'capsule') {
            capsuleSegment(b, segA, segB);
            closestOnSegment(segC, segA, segB, pa[0]!, pa[1]!, pa[2]!);
            sphereSphere(m, pa[0]!, pa[1]!, pa[2]!, sa.radius, segC[0]!, segC[1]!, segC[2]!, sb.radius);
        } else if (sb.type === 'box') sphereBox(m, pa[0]!, pa[1]!, pa[2]!, sa.radius, b);
        else if (sb.type === 'convex') sphereSolid(m, pa[0]!, pa[1]!, pa[2]!, sa.radius, b);
        else if (sb.type === 'plane') spherePlane(m, pa[0]!, pa[1]!, pa[2]!, sa.radius, b);
    } else if (sa.type === 'capsule') {
        if (sb.type === 'capsule') {
            capsuleSegment(a, segA, segB); capsuleSegment(b, segC, segD);
            closestBetweenSegments(segA, segB, segC, segD, scratchC, scratchD);
            sphereSphere(m, scratchC[0]!, scratchC[1]!, scratchC[2]!, sa.radius, scratchD[0]!, scratchD[1]!, scratchD[2]!, sb.radius);
        } else if (sb.type === 'box') capsuleBox(m, a, b);
        else if (sb.type === 'convex') {
            // Spheres at both caps and the middle stand in for the capsule against the hull's faces.
            capsuleSegment(a, segA, segB);
            sphereSolid(m, segA[0]!, segA[1]!, segA[2]!, sa.radius, b);
            m.feature = 1; sphereSolid(m, segB[0]!, segB[1]!, segB[2]!, sa.radius, b);
            m.feature = 2; sphereSolid(m, (segA[0]! + segB[0]!) / 2, (segA[1]! + segB[1]!) / 2, (segA[2]! + segB[2]!) / 2, sa.radius, b);
        } else if (sb.type === 'plane') {
            capsuleSegment(a, segA, segB);
            spherePlane(m, segA[0]!, segA[1]!, segA[2]!, sa.radius, b);
            m.feature = 1; spherePlane(m, segB[0]!, segB[1]!, segB[2]!, sa.radius, b);
        }
    } else if (sa.type === 'box') {
        if (sb.type === 'box') boxBox(m, a, b); else if (sb.type === 'convex') solidSolid(m, a, b); else if (sb.type === 'plane') boxPlane(m, a, b);
    } else if (sa.type === 'convex') {
        if (sb.type === 'convex') solidSolid(m, a, b); else if (sb.type === 'plane') solidPlane(m, a, b);
    }
    if (m.count === 0) return false;
    m.finish(flip);
    return true;
}

// ---- joints -------------------------------------------------------------------
export type JointType3D = 'point' | 'hinge' | 'fixed' | 'distance';
export interface JointOptions3D {
    readonly type: JointType3D;
    readonly bodyA: RigidBody3D;
    /** Second body; leave out to pin bodyA to a fixed place in the world. */
    readonly bodyB?: RigidBody3D;
    /**
     * World-space pivot when the joint is created. Defaults to bodyA's position.
     * For 'distance' this is the attachment on bodyA.
     */
    readonly anchor?: readonly [number, number, number];
    /** 'distance' only: world-space attachment on bodyB (or in the world). Defaults to bodyB's position. */
    readonly anchorB?: readonly [number, number, number];
    /**
     * 'hinge': world-space direction of the hinge pin. 'point': the direction
     * `coneLimit` is measured around. Defaults to +Y.
     */
    readonly axis?: readonly [number, number, number];
    /** 'hinge' only: lowest and highest angle in radians, relative to the pose at creation; both within -PI..PI. */
    readonly limits?: readonly [number, number];
    /** 'hinge' only: turning speed in radians per second the motor drives toward. */
    readonly motorSpeed?: number;
    /** 'hinge' only: strongest torque the motor may use. Zero, the default, turns the motor off. */
    readonly maxMotorTorque?: number;
    /** 'point' only: largest angle in radians bodyB may swing away from `axis`. */
    readonly coneLimit?: number;
    /** 'distance' only: rest length; defaults to the distance between the anchors at creation. */
    readonly length?: number;
    /** 'distance' only: act like a rope that goes slack when shorter than its length. */
    readonly rope?: boolean;
    /** Let the two bodies collide with each other. Defaults to false. */
    readonly collideConnected?: boolean;
}
interface JointPoint { localA: Vec; localB: Vec; ra: Vec; rb: Vec; bias: Vec; inverse: Float64Array }
/** A constraint between two bodies, or between a body and the world. Create it with world.createJoint(). */
export class Joint3D {
    readonly type: JointType3D;
    readonly bodyA: RigidBody3D;
    readonly bodyB: RigidBody3D | undefined;
    readonly collideConnected: boolean;
    enabled = true;
    /** 'distance' joints: rest length, and whether it only limits stretching. */
    length = 0;
    rope = false;
    /** 'hinge' joints: angle range in radians, or undefined for a free hinge. */
    limits: [number, number] | undefined;
    /** 'hinge' joints: target speed in radians per second, and the torque available to reach it (0 = off). */
    motorSpeed = 0;
    maxMotorTorque = 0;
    /** 'point' joints: largest swing angle in radians, or undefined for none. */
    coneLimit: number | undefined;
    /** @internal */ readonly points: JointPoint[] = [];
    /** @internal */ readonly axisA = v3(0, 1, 0);
    /** @internal */ readonly axisB = v3(0, 1, 0);
    /** @internal */ readonly sideA = v3(1, 0, 0);
    /** @internal */ readonly sideB = v3(1, 0, 0);
    /** @internal */ readonly row = v3();
    /** @internal */ rowMass = 0;
    /** @internal */ rowArm = 1;
    /** @internal */ readonly rowDirection = v3();
    /** @internal */ readonly rowA = v3();
    /** @internal */ readonly rowB = v3();
    /** @internal */ rowLow = NaN;
    /** @internal */ rowHigh = NaN;
    /** @internal */ limitImpulse = 0;
    /** @internal */ limitImpulseHigh = 0;
    /** @internal */ motorImpulse = 0;
    /** @internal */ current = 0;
    /** @internal */ accumulated = 0;
    /** @internal */ world: PhysicsWorld3D | undefined;
    constructor(options: JointOptions3D) {
        const a = options?.bodyA, b = options.bodyB;
        if (!(a instanceof RigidBody3D) || (b !== undefined && !(b instanceof RigidBody3D)) || a === b) throw new World3DError('WORLD3D_INPUT_INVALID', 'joint bodies');
        if (!['point', 'hinge', 'fixed', 'distance'].includes(options.type)) throw new World3DError('WORLD3D_INPUT_INVALID', 'joint type');
        this.type = options.type; this.bodyA = a; this.bodyB = b; this.collideConnected = options.collideConnected ?? false;
        const anchor = options.anchor ?? [a.position[0]!, a.position[1]!, a.position[2]!];
        const add = (ax: number, ay: number, az: number, bx = ax, by = ay, bz = az): void => {
            this.points.push({localA: toLocal(a, ax, ay, az), localB: b ? toLocal(b, bx, by, bz) : v3(bx, by, bz), ra: v3(), rb: v3(), bias: v3(), inverse: new Float64Array(9)});
        };
        if (this.type === 'distance') {
            const other = options.anchorB ?? (b ? [b.position[0]!, b.position[1]!, b.position[2]!] : anchor);
            add(anchor[0], anchor[1], anchor[2], other[0], other[1], other[2]);
            this.length = options.length ?? Math.hypot(other[0]! - anchor[0], other[1]! - anchor[1], other[2]! - anchor[2]);
            if (!(this.length >= 0)) throw new World3DError('WORLD3D_INPUT_INVALID', 'joint length');
            this.rope = options.rope ?? false;
        }
        if (this.type === 'hinge' || this.type === 'point') {
            const axis = options.axis ?? [0, 1, 0], size = Math.hypot(axis[0], axis[1], axis[2]);
            if (!(size > 0)) throw new World3DError('WORLD3D_INPUT_INVALID', 'joint axis');
            const x = axis[0] / size, y = axis[1] / size, z = axis[2] / size;
            // Any direction across the axis serves as the zero mark for measuring the angle.
            const seed = Math.abs(x) < 0.57 ? [1, 0, 0] : [0, 1, 0], side = cross(v3(), [x, y, z], seed), length = Math.hypot(side[0]!, side[1]!, side[2]!);
            side[0]! /= length; side[1]! /= length; side[2]! /= length;
            const turn = (body: RigidBody3D | undefined, out: Vec, wx: number, wy: number, wz: number): void => {
                if (!body) { out[0] = wx; out[1] = wy; out[2] = wz; return; }
                const r = body.rotation;
                out[0] = r[0]! * wx + r[3]! * wy + r[6]! * wz; out[1] = r[1]! * wx + r[4]! * wy + r[7]! * wz; out[2] = r[2]! * wx + r[5]! * wy + r[8]! * wz;
            };
            turn(a, this.axisA, x, y, z); turn(b, this.axisB, x, y, z); turn(a, this.sideA, side[0]!, side[1]!, side[2]!); turn(b, this.sideB, side[0]!, side[1]!, side[2]!);
            if (options.limits) {
                if (this.type !== 'hinge' || !(options.limits[0] <= options.limits[1]) || options.limits[0] < -Math.PI || options.limits[1] > Math.PI) throw new World3DError('WORLD3D_INPUT_INVALID', 'joint limits');
                this.limits = [options.limits[0], options.limits[1]];
            }
            if (options.coneLimit !== undefined) {
                if (this.type !== 'point' || !(options.coneLimit >= 0 && options.coneLimit <= Math.PI)) throw new World3DError('WORLD3D_INPUT_INVALID', 'joint coneLimit');
                this.coneLimit = options.coneLimit;
            }
            this.motorSpeed = requireFinite3D(options.motorSpeed ?? 0, 'joint motorSpeed');
            this.maxMotorTorque = requireFinite3D(options.maxMotorTorque ?? 0, 'joint maxMotorTorque');
            if (this.maxMotorTorque < 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'joint maxMotorTorque');
        }
        else if (options.limits || options.coneLimit !== undefined || options.maxMotorTorque) throw new World3DError('WORLD3D_INPUT_INVALID', 'limits and motors need a hinge or point joint');
        if (this.type === 'distance') { /* built above */ }
        else if (this.type === 'point') add(anchor[0], anchor[1], anchor[2]);
        else if (this.type === 'hinge') {
            // Two pivots along the pin leave exactly one free rotation: about the pin.
            const axis = options.axis ?? [0, 1, 0], size = Math.hypot(axis[0], axis[1], axis[2]);
            if (!(size > 0)) throw new World3DError('WORLD3D_INPUT_INVALID', 'joint axis');
            const k = 0.5 / size;
            add(anchor[0] - axis[0] * k, anchor[1] - axis[1] * k, anchor[2] - axis[2] * k); add(anchor[0] + axis[0] * k, anchor[1] + axis[1] * k, anchor[2] + axis[2] * k);
        } else {
            // Three pivots that are not in a line lock every rotation.
            add(anchor[0], anchor[1], anchor[2]); add(anchor[0] + 0.5, anchor[1], anchor[2]); add(anchor[0], anchor[1] + 0.5, anchor[2]);
        }
    }
    /**
     * 'hinge' joints: how far bodyA has turned about the pin since creation,
     * relative to bodyB or the world, in radians. 'point' joints: how far
     * the two bodies have swung apart, measured between their copies of the axis.
     */
    get angle(): number {
        const a = this.bodyA, b = this.bodyB;
        if (this.type === 'point') {
            rotateInto(jointA, a, this.axisA);
            if (b) rotateInto(jointB, b, this.axisB); else jointB.set(this.axisB);
            return Math.acos(clamp(dot(jointA, jointB), -1, 1));
        }
        if (this.type !== 'hinge') return 0;
        const n = rotateInto(v3(), a, this.axisA);
        rotateInto(jointA, a, this.sideA);
        if (b) rotateInto(jointB, b, this.sideB); else jointB.set(this.sideB);
        cross(jointC, jointB, jointA);
        return Math.atan2(dot(jointC, n), dot(jointA, jointB));
    }
}
function toLocal(body: RigidBody3D, x: number, y: number, z: number): Vec {
    const r = body.rotation, p = body.position, dx = x - p[0]!, dy = y - p[1]!, dz = z - p[2]!;
    return v3(r[0]! * dx + r[3]! * dy + r[6]! * dz, r[1]! * dx + r[4]! * dy + r[7]! * dz, r[2]! * dx + r[5]! * dy + r[8]! * dz);
}
function rotateInto(out: Vec, body: RigidBody3D, local: Vec): Vec {
    const r = body.rotation, x = local[0]!, y = local[1]!, z = local[2]!;
    out[0] = r[0]! * x + r[1]! * y + r[2]! * z; out[1] = r[3]! * x + r[4]! * y + r[5]! * z; out[2] = r[6]! * x + r[7]! * y + r[8]! * z;
    return out;
}
const jointA = v3(), jointB = v3(), jointC = v3(), jointK = new Float64Array(9), JOINT_BAUMGARTE = 0.2;
/** Add one body's contribution to the 3x3 effective-mass matrix of a pivot at offset r. */
function addPivotMass(k: Float64Array, body: RigidBody3D, r: Vec): void {
    if (body.type !== 'dynamic' || body.isSleeping) return;
    k[0]! += body.inverseMass; k[4]! += body.inverseMass; k[8]! += body.inverseMass;
    for (let i = 0; i < 3; i++) {
        // Column i is (I^-1 (r x e_i)) x r.
        jointA[0] = jointA[1] = jointA[2] = 0; jointA[i] = 1;
        cross(jointB, r, jointA); applyInverseInertia(jointC, body.inverseInertiaWorld, jointB); cross(jointB, jointC, r);
        k[i]! += jointB[0]!; k[3 + i]! += jointB[1]!; k[6 + i]! += jointB[2]!;
    }
}
function applyPivotImpulse(body: RigidBody3D, r: Vec, x: number, y: number, z: number, sign: number): void {
    if (body.type !== 'dynamic' || body.isSleeping) return;
    const v = body.linearVelocity, w = body.angularVelocity;
    v[0]! += x * body.inverseMass * sign; v[1]! += y * body.inverseMass * sign; v[2]! += z * body.inverseMass * sign;
    jointA[0] = x; jointA[1] = y; jointA[2] = z;
    cross(jointB, r, jointA); applyInverseInertia(jointC, body.inverseInertiaWorld, jointB);
    w[0]! += jointC[0]! * sign; w[1]! += jointC[1]! * sign; w[2]! += jointC[2]! * sign;
}
function pivotVelocity(out: Vec, body: RigidBody3D | undefined, r: Vec): Vec {
    if (!body) { out[0] = out[1] = out[2] = 0; return out; }
    cross(out, body.angularVelocity, r);
    out[0]! += body.linearVelocity[0]!; out[1]! += body.linearVelocity[1]!; out[2]! += body.linearVelocity[2]!;
    return out;
}

// ---- world --------------------------------------------------------------------
interface SolverContact {
    a: RigidBody3D; b: RigidBody3D;
    nx: number; ny: number; nz: number; t1: Vec; t2: Vec;
    ra: Vec; rb: Vec;
    normalMass: number; tangentMass1: number; tangentMass2: number;
    bias: number; friction: number;
    normalImpulse: number; tangentImpulse1: number; tangentImpulse2: number;
    warm: WarmEntry; slot: number;
    /** Inverse masses as the solver sees them: zero for a body that cannot be moved this step. */
    ima: number; imb: number;
    /**
     * Per direction (normal, then the two tangents), fifteen numbers computed once per step:
     * the direction, ra x direction, rb x direction, and what a unit impulse does to each body's spin.
     */
    readonly rows: Float64Array;
}
/** Impulses a pair ended the previous step with, matched by contact feature to start the next solve near its answer. */
interface WarmEntry { stamp: number; count: number; readonly features: Int16Array; readonly impulses: Float64Array }
const SLOP = 0.01, BAUMGARTE = 0.15, SLEEP_LINEAR = 0.15, SLEEP_ANGULAR = 0.2, SLEEP_DELAY = 0.5;

export class PhysicsWorld3D {
    readonly gravity = v3(0, -9.81, 0);
    fixedStep: number;
    maxSubSteps: number;
    iterations: number;
    allowSleep: boolean;
    /** Called when two bodies start or stop touching. Triggers report here too. */
    onContactBegin: ((a: RigidBody3D, b: RigidBody3D) => void) | undefined;
    onContactEnd: ((a: RigidBody3D, b: RigidBody3D) => void) | undefined;
    readonly #bodies: RigidBody3D[] = [];
    readonly #manifold = new Manifold();
    readonly #contacts: SolverContact[] = [];
    #contactCount = 0;
    #touching = new Map<number, [RigidBody3D, RigidBody3D]>();
    #previousTouching = new Map<number, [RigidBody3D, RigidBody3D]>();
    #accumulator = 0;
    readonly #sorted: RigidBody3D[] = [];
    readonly #planes: RigidBody3D[] = [];
    readonly #joints: Joint3D[] = [];
    readonly #jointPairs = new Map<number, number>();
    readonly #warm = new Map<number, WarmEntry>();
    readonly #warmFeatures = new Int16Array(8);
    readonly #warmImpulses = new Float64Array(24);
    #stamp = 0;

    constructor(options: PhysicsWorldOptions3D = {}) {
        if (options.gravity) this.gravity.set(options.gravity);
        this.fixedStep = requirePositive3D(options.fixedStep ?? 1 / 60, 'fixedStep');
        this.maxSubSteps = Math.min(Math.max(Math.floor(options.maxSubSteps ?? 4), 1), PHYSICS3D_LIMITS.maxSubSteps);
        this.iterations = Math.min(Math.max(Math.floor(options.iterations ?? 8), 1), 64);
        this.allowSleep = options.allowSleep ?? true;
    }
    get bodies(): readonly RigidBody3D[] { return this.#bodies; }
    /** Contact points solved in the last step. */
    get contactCount(): number { return this.#contactCount; }

    addBody(body: RigidBody3D): RigidBody3D {
        if (!(body instanceof RigidBody3D) || body.world) throw new World3DError('WORLD3D_INPUT_INVALID', 'body');
        if (this.#bodies.length >= PHYSICS3D_LIMITS.maxBodies) throw new World3DError('WORLD3D_BUDGET', 'bodies');
        body.world = this;
        this.#bodies.push(body);
        (body.shape.type === 'plane' ? this.#planes : this.#sorted).push(body);
        return body;
    }
    /** Create a body from options and add it. */
    createBody(options: RigidBodyOptions3D): RigidBody3D { return this.addBody(new RigidBody3D(options)); }
    get joints(): readonly Joint3D[] { return this.#joints; }
    /** Connect two bodies, or pin one to the world. Anchors are given in world space as the bodies stand now. */
    createJoint(options: JointOptions3D): Joint3D {
        const joint = new Joint3D(options);
        if (joint.bodyA.world !== this || (joint.bodyB && joint.bodyB.world !== this)) throw new World3DError('WORLD3D_INPUT_INVALID', 'joint bodies are not in this world');
        joint.world = this;
        this.#joints.push(joint);
        if (joint.bodyB && !joint.collideConnected) { const key = this.pairKey(joint.bodyA, joint.bodyB); this.#jointPairs.set(key, (this.#jointPairs.get(key) ?? 0) + 1); }
        joint.bodyA.wake(); joint.bodyB?.wake();
        return joint;
    }
    removeJoint(joint: Joint3D): void {
        const index = this.#joints.indexOf(joint);
        if (index < 0) return;
        this.#joints.splice(index, 1);
        joint.world = undefined;
        if (joint.bodyB && !joint.collideConnected) {
            const key = this.pairKey(joint.bodyA, joint.bodyB), count = (this.#jointPairs.get(key) ?? 1) - 1;
            if (count > 0) this.#jointPairs.set(key, count); else this.#jointPairs.delete(key);
        }
        joint.bodyA.wake(); joint.bodyB?.wake();
    }
    private prepareJoints(dt: number): void {
        for (const joint of this.#joints) {
            const a = joint.bodyA, b = joint.bodyB;
            // A moving partner wakes a sleeper, so a chain cannot hang frozen in mid-swing.
            if (a.isSleeping && b && isMoving(b)) a.wake();
            if (b?.isSleeping && isMoving(a)) b.wake();
            joint.accumulated = 0; joint.limitImpulse = 0; joint.limitImpulseHigh = 0; joint.motorImpulse = 0;
            joint.rowMass = 0; joint.rowLow = joint.rowHigh = NaN;
            const motor = joint.type === 'hinge' && joint.maxMotorTorque > 0;
            if (joint.enabled && (motor || joint.limits || joint.coneLimit !== undefined)) {
                // One rotational equation: about the pin for a hinge, about the swing direction for a cone.
                const row = joint.row;
                let active = true;
                if (joint.type === 'hinge') {
                    // Reversed pin, so that a positive turn of bodyA relative to bodyB counts as positive.
                    rotateInto(row, a, joint.axisA);
                    row[0] = -row[0]!; row[1] = -row[1]!; row[2] = -row[2]!;
                    joint.current = joint.angle;
                    if (joint.limits) { joint.rowLow = joint.current - joint.limits[0]; joint.rowHigh = joint.current - joint.limits[1]; }
                    if (motor && joint.motorSpeed !== 0) { a.wake(); b?.wake(); }
                } else {
                    rotateInto(jointA, a, joint.axisA);
                    if (b) rotateInto(jointB, b, joint.axisB); else jointB.set(joint.axisB);
                    cross(row, jointA, jointB);
                    const size = Math.hypot(row[0]!, row[1]!, row[2]!);
                    joint.current = Math.atan2(size, dot(jointA, jointB));
                    if (size > 1e-6) { row[0]! /= size; row[1]! /= size; row[2]! /= size; joint.rowHigh = joint.current - joint.coneLimit!; } else active = false;
                }
                if (active) this.prepareRow(joint);
            }
            for (const point of joint.points) {
                rotateInto(point.ra, a, point.localA);
                if (b) rotateInto(point.rb, b, point.localB); else point.rb.fill(0);
                // Positional error: where b's pivot is relative to a's.
                for (let i = 0; i < 3; i++) point.bias[i] = ((b ? b.position[i]! + point.rb[i]! : point.localB[i]!) - a.position[i]! - point.ra[i]!) * JOINT_BAUMGARTE / dt;
                const k = jointK;
                k.fill(0);
                addPivotMass(k, a, point.ra);
                if (b) addPivotMass(k, b, point.rb);
                // Invert the symmetric 3x3 by cofactors.
                const c0 = k[4]! * k[8]! - k[5]! * k[7]!, c1 = k[5]! * k[6]! - k[3]! * k[8]!, c2 = k[3]! * k[7]! - k[4]! * k[6]!, determinant = k[0]! * c0 + k[1]! * c1 + k[2]! * c2, inverse = point.inverse;
                if (Math.abs(determinant) < 1e-12) { inverse.fill(0); continue; }
                const d = 1 / determinant;
                inverse[0] = c0 * d; inverse[1] = (k[2]! * k[7]! - k[1]! * k[8]!) * d; inverse[2] = (k[1]! * k[5]! - k[2]! * k[4]!) * d;
                inverse[3] = c1 * d; inverse[4] = (k[0]! * k[8]! - k[2]! * k[6]!) * d; inverse[5] = (k[2]! * k[3]! - k[0]! * k[5]!) * d;
                inverse[6] = c2 * d; inverse[7] = (k[1]! * k[6]! - k[0]! * k[7]!) * d; inverse[8] = (k[0]! * k[4]! - k[1]! * k[3]!) * d;
            }
        }
    }
    /**
     * Set up the rotational equation of a joint. Turning impulses are applied
     * as a push at the point where the more mobile body would pivot freely
     * about the joint (its center of percussion), which leaves the pivot
     * itself undisturbed and so settles in few iterations even for a small
     * weight on a long arm.
     */
    private prepareRow(joint: Joint3D): void {
        const a = joint.bodyA, b = joint.bodyB, u = joint.row, pivot = scratchA;
        pivot.fill(0);
        for (const point of joint.points) { rotateInto(jointA, a, point.localA); pivot[0]! += jointA[0]!; pivot[1]! += jointA[1]!; pivot[2]! += jointA[2]!; }
        const share = 1 / joint.points.length;
        pivot[0] = a.position[0]! + pivot[0]! * share; pivot[1] = a.position[1]! + pivot[1]! * share; pivot[2] = a.position[2]! + pivot[2]! * share;
        let best = 0, arm = 0, ex = 0, ey = 0, ez = 0;
        for (const body of [a, b]) {
            if (!body || body.type !== 'dynamic' || body.isSleeping) continue;
            applyInverseInertia(jointC, body.inverseInertiaWorld, u);
            const spin = dot(u, jointC);
            // Offset of the center from the pivot, across the turning direction.
            let x = body.position[0]! - pivot[0]!, y = body.position[1]! - pivot[1]!, z = body.position[2]! - pivot[2]!;
            const along = x * u[0]! + y * u[1]! + z * u[2]!;
            x -= u[0]! * along; y -= u[1]! * along; z -= u[2]! * along;
            const offset = Math.hypot(x, y, z), inertia = spin > 1e-12 ? 1 / spin : Infinity, mobility = 1 / (inertia + body.mass * offset * offset);
            if (mobility <= best) continue;
            best = mobility;
            if (offset > 1e-4 && inertia < Infinity) { arm = offset + inertia / (body.mass * offset); ex = x / offset; ey = y / offset; ez = z / offset; } else arm = 0;
        }
        if (best === 0) return;
        if (arm === 0) {
            // Centered on the pivot: a far-away push acts as a pure twist.
            cross(jointB, u, Math.abs(u[0]!) < 0.57 ? [1, 0, 0] : [0, 1, 0]);
            const size = Math.hypot(jointB[0]!, jointB[1]!, jointB[2]!);
            ex = jointB[0]! / size; ey = jointB[1]! / size; ez = jointB[2]! / size; arm = 1000;
        }
        const t = cross(joint.rowDirection, u, [ex, ey, ez]), px = pivot[0]! + ex * arm, py = pivot[1]! + ey * arm, pz = pivot[2]! + ez * arm;
        joint.rowArm = arm;
        joint.rowA[0] = px - a.position[0]!; joint.rowA[1] = py - a.position[1]!; joint.rowA[2] = pz - a.position[2]!;
        if (b) { joint.rowB[0] = px - b.position[0]!; joint.rowB[1] = py - b.position[1]!; joint.rowB[2] = pz - b.position[2]!; }
        let k = 0;
        for (const [body, r] of [[a, joint.rowA], [b, joint.rowB]] as const) {
            if (!body || body.type !== 'dynamic' || body.isSleeping) continue;
            cross(jointB, r, t); applyInverseInertia(jointC, body.inverseInertiaWorld, jointB);
            k += body.inverseMass + dot(jointB, jointC);
        }
        joint.rowMass = k > 1e-12 ? arm * arm / k : 0;
    }
    private solveJoint(joint: Joint3D, dt: number): void {
        const a = joint.bodyA, b = joint.bodyB;
        if (!joint.enabled || ((a.type !== 'dynamic' || a.isSleeping) && (!b || b.type !== 'dynamic' || b.isSleeping))) return;
        if (joint.rowMass > 0) {
            const t = joint.rowDirection, arm = joint.rowArm;
            const turn = (impulse: number): void => {
                if (impulse === 0) return;
                const push = impulse / arm;
                applyPivotImpulse(a, joint.rowA, t[0]! * push, t[1]! * push, t[2]! * push, -1);
                if (b) applyPivotImpulse(b, joint.rowB, t[0]! * push, t[1]! * push, t[2]! * push, 1);
            };
            const rate = (): number => { const va = pivotVelocity(scratchC, a, joint.rowA), vb = pivotVelocity(scratchD, b, joint.rowB); return ((vb[0]! - va[0]!) * t[0]! + (vb[1]! - va[1]!) * t[1]! + (vb[2]! - va[2]!) * t[2]!) / arm; };
            if (joint.type === 'hinge' && joint.maxMotorTorque > 0) {
                const most = joint.maxMotorTorque * dt, total = clamp(joint.motorImpulse + (joint.motorSpeed - rate()) * joint.rowMass, -most, most);
                turn(total - joint.motorImpulse); joint.motorImpulse = total;
            }
            // A limit lets the angle close the remaining gap this step and no more; past the limit it steers back.
            const low = joint.rowLow, high = joint.rowHigh;
            if (low === low) {
                const total = Math.max(joint.limitImpulse + (-rate() - (low > 0 ? low : low * JOINT_BAUMGARTE) / dt) * joint.rowMass, 0);
                turn(total - joint.limitImpulse); joint.limitImpulse = total;
            }
            if (high === high) {
                const total = Math.min(joint.limitImpulseHigh + (-rate() - (high < 0 ? high : high * JOINT_BAUMGARTE) / dt) * joint.rowMass, 0);
                turn(total - joint.limitImpulseHigh); joint.limitImpulseHigh = total;
            }
        }
        for (const point of joint.points) {
            const va = pivotVelocity(scratchC, a, point.ra), vb = pivotVelocity(scratchD, b, point.rb);
            const dx = vb[0]! - va[0]!, dy = vb[1]! - va[1]!, dz = vb[2]! - va[2]!;
            if (joint.type === 'distance') {
                // One equation along the line between the two attachments.
                let nx = (b ? b.position[0]! + point.rb[0]! : point.localB[0]!) - a.position[0]! - point.ra[0]!, ny = (b ? b.position[1]! + point.rb[1]! : point.localB[1]!) - a.position[1]! - point.ra[1]!;
                let nz = (b ? b.position[2]! + point.rb[2]! : point.localB[2]!) - a.position[2]! - point.ra[2]!;
                const length = Math.hypot(nx, ny, nz);
                if (length < 1e-9 || (joint.rope && length <= joint.length)) continue;
                nx /= length; ny /= length; nz /= length;
                jointA[0] = nx; jointA[1] = ny; jointA[2] = nz;
                let mass = 0;
                for (const [body, r] of [[a, point.ra], [b, point.rb]] as const) {
                    if (!body || body.type !== 'dynamic' || body.isSleeping) continue;
                    cross(jointB, r, [nx, ny, nz]); applyInverseInertia(jointC, body.inverseInertiaWorld, jointB);
                    mass += body.inverseMass + jointB[0]! * jointC[0]! + jointB[1]! * jointC[1]! + jointB[2]! * jointC[2]!;
                }
                if (mass <= 0) continue;
                let lambda = -(dx * nx + dy * ny + dz * nz + (length - joint.length) * JOINT_BAUMGARTE / dt) / mass;
                if (joint.rope) {
                    // A rope only pulls: the running total may never push the ends apart.
                    const total = Math.min(joint.accumulated + lambda, 0);
                    lambda = total - joint.accumulated; joint.accumulated = total;
                }
                applyPivotImpulse(a, point.ra, nx * lambda, ny * lambda, nz * lambda, -1);
                if (b) applyPivotImpulse(b, point.rb, nx * lambda, ny * lambda, nz * lambda, 1);
                continue;
            }
            const m = point.inverse, rx = -dx - point.bias[0]!, ry = -dy - point.bias[1]!, rz = -dz - point.bias[2]!;
            const px = m[0]! * rx + m[1]! * ry + m[2]! * rz, py = m[3]! * rx + m[4]! * ry + m[5]! * rz, pz = m[6]! * rx + m[7]! * ry + m[8]! * rz;
            applyPivotImpulse(a, point.ra, px, py, pz, -1);
            if (b) applyPivotImpulse(b, point.rb, px, py, pz, 1);
        }
    }
    removeBody(body: RigidBody3D): void {
        if (body.world !== this) return;
        for (const joint of [...this.#joints]) if (joint.bodyA === body || joint.bodyB === body) this.removeJoint(joint);
        body.world = undefined;
        this.#bodies.splice(this.#bodies.indexOf(body), 1);
        const list = body.shape.type === 'plane' ? this.#planes : this.#sorted;
        list.splice(list.indexOf(body), 1);
        // After a step the pairs that were touching live in the previous-step map.
        for (const [key, pair] of this.#previousTouching) {
            if (pair[0] !== body && pair[1] !== body) continue;
            this.#previousTouching.delete(key);
            pair[0].wake(); pair[1].wake();
            this.onContactEnd?.(pair[0], pair[1]);
        }
    }
    /**
     * Advance by `deltaSeconds` in fixed steps, carrying the remainder to the
     * next call. Returns the number of steps taken.
     */
    step(deltaSeconds: number): number {
        this.#accumulator += Math.max(0, requireFinite3D(deltaSeconds, 'deltaSeconds'));
        let steps = 0;
        while (this.#accumulator >= this.fixedStep && steps < this.maxSubSteps) {
            this.fixedUpdate(this.fixedStep);
            this.#accumulator -= this.fixedStep;
            steps++;
        }
        // Drop time the step budget could not absorb instead of spiralling.
        if (this.#accumulator > this.fixedStep) this.#accumulator = 0;
        if (steps > 0) this.syncNodes();
        return steps;
    }
    private syncNodes(): void {
        for (const body of this.#bodies) {
            const node = body.node;
            if (!node || body.type === 'static') continue;
            node.position.set(body.position); node.quaternion.set(body.quaternion);
            node.markTransformDirty();
        }
    }
    private fixedUpdate(dt: number): void {
        const bodies = this.#bodies, g = this.gravity;
        for (const body of bodies) {
            if (body.type !== 'dynamic' || body.isSleeping) continue;
            const v = body.linearVelocity, w = body.angularVelocity;
            v[0]! += (g[0]! + body.force[0]! * body.inverseMass) * dt; v[1]! += (g[1]! + body.force[1]! * body.inverseMass) * dt; v[2]! += (g[2]! + body.force[2]! * body.inverseMass) * dt;
            applyInverseInertia(scratchA, body.inverseInertiaWorld, body.torque);
            w[0]! += scratchA[0]! * dt; w[1]! += scratchA[1]! * dt; w[2]! += scratchA[2]! * dt;
            const linear = 1 / (1 + body.linearDamping * dt), angular = 1 / (1 + body.angularDamping * dt);
            v[0]! *= linear; v[1]! *= linear; v[2]! *= linear; w[0]! *= angular; w[1]! *= angular; w[2]! *= angular;
        }
        this.#stamp++;
        this.findContacts(dt);
        const contacts = this.#contacts, count = this.#contactCount;
        // Warm start: re-apply last step's impulses so stacks begin close to equilibrium.
        for (let i = 0; i < count; i++) {
            const c = contacts[i]!;
            if (c.normalImpulse !== 0) this.applyRow(c, 0, c.normalImpulse);
            if (c.tangentImpulse1 !== 0) this.applyRow(c, 15, c.tangentImpulse1);
            if (c.tangentImpulse2 !== 0) this.applyRow(c, 30, c.tangentImpulse2);
        }
        this.prepareJoints(dt);
        const joints = this.#joints;
        for (let iteration = 0; iteration < this.iterations; iteration++) {
            for (let i = 0; i < count; i++) this.solve(contacts[i]!);
            for (let i = 0; i < joints.length; i++) this.solveJoint(joints[i]!, dt);
        }
        for (let i = 0; i < count; i++) {
            const c = contacts[i]!, at = c.slot * 3;
            c.warm.impulses[at] = c.normalImpulse; c.warm.impulses[at + 1] = c.tangentImpulse1; c.warm.impulses[at + 2] = c.tangentImpulse2;
        }
        if ((this.#stamp & 63) === 0) for (const [key, entry] of this.#warm) if (entry.stamp !== this.#stamp) this.#warm.delete(key);
        for (const body of bodies) {
            body.force.fill(0); body.torque.fill(0);
            if (body.type === 'static' || body.isSleeping) continue;
            const v = body.linearVelocity, w = body.angularVelocity, p = body.position, q = body.quaternion;
            const reach = body.continuous && body.type === 'dynamic' ? this.sweep(body, dt) : 1;
            p[0]! += v[0]! * dt * reach; p[1]! += v[1]! * dt * reach; p[2]! += v[2]! * dt * reach;
            if (!body.fixedRotation && (w[0] !== 0 || w[1] !== 0 || w[2] !== 0)) {
                // q += 0.5 * dt * (w, 0) * q
                const x = q[0]!, y = q[1]!, z = q[2]!, s = q[3]!, half = 0.5 * dt;
                q[0] = x + half * (w[0]! * s + w[1]! * z - w[2]! * y); q[1] = y + half * (w[1]! * s + w[2]! * x - w[0]! * z);
                q[2] = z + half * (w[2]! * s + w[0]! * y - w[1]! * x); q[3] = s - half * (w[0]! * x + w[1]! * y + w[2]! * z);
                const length = Math.hypot(q[0]!, q[1]!, q[2]!, q[3]!) || 1;
                q[0]! /= length; q[1]! /= length; q[2]! /= length; q[3]! /= length;
            }
            body.refresh();
            if (body.type === 'dynamic' && this.allowSleep) {
                const slow = v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]! < SLEEP_LINEAR * SLEEP_LINEAR && w[0]! * w[0]! + w[1]! * w[1]! + w[2]! * w[2]! < SLEEP_ANGULAR * SLEEP_ANGULAR;
                body.sleepTime = slow ? body.sleepTime + dt : 0;
                if (body.sleepTime >= SLEEP_DELAY) { body.isSleeping = true; v.fill(0); w.fill(0); }
            }
        }
        // Contact events compare this step's touching pairs with the previous step's.
        const now = this.#touching, before = this.#previousTouching;
        if (this.onContactBegin) for (const [key, pair] of now) if (!before.has(key)) this.onContactBegin(pair[0], pair[1]);
        if (this.onContactEnd) for (const [key, pair] of before) if (!now.has(key) && pair[0].world === this && pair[1].world === this) this.onContactEnd(pair[0], pair[1]);
        this.#previousTouching = now; this.#touching = before;
        before.clear();
    }
    /**
     * Share of this step's travel a fast body may make before its center line
     * meets a surface. It stops just touching, so the next step finds the
     * contact and answers it with the body's full speed.
     */
    private sweep(body: RigidBody3D, dt: number): number {
        const v = body.linearVelocity, speed = Math.hypot(v[0]!, v[1]!, v[2]!), travel = speed * dt, shape = body.shape;
        const inner = shape.type === 'sphere' || shape.type === 'capsule' ? shape.radius : shape.type === 'box' ? Math.min(shape.halfExtents[0], shape.halfExtents[1], shape.halfExtents[2]) : shape.type === 'convex' ? shape.hull.innerRadius : 0;
        // Slow enough that the ordinary overlap test cannot miss anything.
        if (travel <= inner * 0.5 || travel === 0) return 1;
        const d = [v[0]! / speed, v[1]! / speed, v[2]! / speed], o = [body.position[0]!, body.position[1]!, body.position[2]!], normal = [0, 0, 0];
        let limit = travel + inner, allowed = travel;
        for (const other of this.#bodies) {
            if (other === body || other.isTrigger || (body.layer & other.mask) === 0 || (other.layer & body.mask) === 0) continue;
            if (this.#jointPairs.size > 0 && this.#jointPairs.has(this.pairKey(body, other))) continue;
            const box = other.aabb;
            // Skip bodies whose bounds the swept line cannot reach.
            if (Math.min(o[0]!, o[0]! + d[0]! * limit) - inner > box[3]! || Math.max(o[0]!, o[0]! + d[0]! * limit) + inner < box[0]! || Math.min(o[1]!, o[1]! + d[1]! * limit) - inner > box[4]!
                || Math.max(o[1]!, o[1]! + d[1]! * limit) + inner < box[1]! || Math.min(o[2]!, o[2]! + d[2]! * limit) - inner > box[5]! || Math.max(o[2]!, o[2]! + d[2]! * limit) + inner < box[2]!) continue;
            const distance = rayShape(other, o, d, limit, normal);
            if (distance < 0 || distance > limit) continue;
            // A round body meets a slanted surface before its center line does.
            const facing = Math.max(-(d[0]! * normal[0]! + d[1]! * normal[1]! + d[2]! * normal[2]!), 0.2);
            limit = distance;
            allowed = Math.min(allowed, Math.max(distance - inner / facing + SLOP, 0));
        }
        return allowed / travel;
    }
    private findContacts(dt: number): void {
        this.#contactCount = 0;
        const sorted = this.#sorted, planes = this.#planes;
        // Insertion sort keeps the nearly sorted list cheap from step to step.
        for (let i = 1; i < sorted.length; i++) {
            const body = sorted[i]!, key = body.aabb[0]!;
            let j = i - 1;
            while (j >= 0 && sorted[j]!.aabb[0]! > key) { sorted[j + 1] = sorted[j]!; j--; }
            sorted[j + 1] = body;
        }
        for (let i = 0; i < sorted.length; i++) {
            const a = sorted[i]!, box = a.aabb, maxX = box[3]!;
            for (let j = i + 1; j < sorted.length; j++) {
                const b = sorted[j]!, other = b.aabb;
                if (other[0]! > maxX) break;
                if (box[1]! > other[4]! || box[4]! < other[1]! || box[2]! > other[5]! || box[5]! < other[2]!) continue;
                this.testPair(a, b, dt);
            }
            for (const plane of planes) this.testPair(a, plane, dt);
        }
    }
    private testPair(a: RigidBody3D, b: RigidBody3D, dt: number): void {
        if ((a.layer & b.mask) === 0 || (b.layer & a.mask) === 0) return;
        if (this.#jointPairs.size > 0 && this.#jointPairs.has(this.pairKey(a, b))) return;
        const movingA = a.type === 'dynamic' && !a.isSleeping, movingB = b.type === 'dynamic' && !b.isSleeping;
        // A pair of resting or immovable bodies needs no work, except to keep reporting triggers.
        if (!movingA && !movingB && a.type !== 'kinematic' && b.type !== 'kinematic') {
            if (a.isSleeping || b.isSleeping) { const key = this.pairKey(a, b), kept = this.#previousTouching.get(key); if (kept) this.#touching.set(key, kept); }
            return;
        }
        if (a.type !== 'dynamic' && b.type !== 'dynamic' && !a.isTrigger && !b.isTrigger) return;
        const m = this.#manifold;
        if (!collide(m, a, b)) return;
        const key = this.pairKey(a, b);
        this.#touching.set(key, this.#previousTouching.get(key) ?? [a, b]);
        if (a.isTrigger || b.isTrigger) return;
        // A moving body wakes a sleeping partner.
        // Only a partner that is really moving wakes a sleeper; a merely awake neighbour
        // would keep a whole resting pile from ever settling.
        if (a.isSleeping && isMoving(b)) a.wake();
        if (b.isSleeping && isMoving(a)) b.wake();
        if (a.isSleeping || b.isSleeping) {
            // The sleeper acts as immovable this step.
            if (a.isSleeping && b.isSleeping) return;
        }
        const restitution = Math.max(a.restitution, b.restitution), friction = Math.sqrt(a.friction * b.friction);
        let warm = this.#warm.get(key), previousCount = 0;
        const previousFeatures = this.#warmFeatures, previousImpulses = this.#warmImpulses;
        if (warm && warm.stamp === this.#stamp - 1) {
            previousCount = warm.count;
            previousFeatures.set(warm.features); previousImpulses.set(warm.impulses);
        } else if (!warm) this.#warm.set(key, warm = {stamp: 0, count: 0, features: new Int16Array(8), impulses: new Float64Array(24)});
        warm.stamp = this.#stamp; warm.count = m.count;
        for (let i = 0; i < m.count; i++) {
            const source = m.contacts[i]!;
            let c = this.#contacts[this.#contactCount];
            if (!c) c = this.#contacts[this.#contactCount] = {a, b, nx: 0, ny: 0, nz: 0, t1: v3(), t2: v3(), ra: v3(), rb: v3(), normalMass: 0, tangentMass1: 0, tangentMass2: 0, bias: 0, friction: 0, normalImpulse: 0, tangentImpulse1: 0, tangentImpulse2: 0, warm, slot: 0, ima: 0, imb: 0, rows: new Float64Array(45)};
            this.#contactCount++;
            c.a = a; c.b = b; c.nx = source.nx; c.ny = source.ny; c.nz = source.nz; c.friction = friction;
            c.normalImpulse = c.tangentImpulse1 = c.tangentImpulse2 = 0;
            c.warm = warm; c.slot = i; warm.features[i] = source.feature;
            for (let j = 0; j < previousCount; j++) {
                if (previousFeatures[j] !== source.feature) continue;
                c.normalImpulse = previousImpulses[j * 3]!; c.tangentImpulse1 = previousImpulses[j * 3 + 1]!; c.tangentImpulse2 = previousImpulses[j * 3 + 2]!;
                break;
            }
            c.ra[0] = source.px - a.position[0]!; c.ra[1] = source.py - a.position[1]!; c.ra[2] = source.pz - a.position[2]!;
            c.rb[0] = source.px - b.position[0]!; c.rb[1] = source.py - b.position[1]!; c.rb[2] = source.pz - b.position[2]!;
            const n = [c.nx, c.ny, c.nz];
            // Any vector not parallel to the normal seeds the tangent basis.
            cross(c.t1, n, Math.abs(c.nx) < 0.57 ? [1, 0, 0] : [0, 1, 0]);
            const length = Math.hypot(c.t1[0]!, c.t1[1]!, c.t1[2]!);
            c.t1[0]! /= length; c.t1[1]! /= length; c.t1[2]! /= length;
            cross(c.t2, n, c.t1);
            c.ima = a.type === 'dynamic' && !a.isSleeping ? a.inverseMass : 0; c.imb = b.type === 'dynamic' && !b.isSleeping ? b.inverseMass : 0;
            c.normalMass = this.prepareContactRow(c, 0, n); c.tangentMass1 = this.prepareContactRow(c, 15, c.t1); c.tangentMass2 = this.prepareContactRow(c, 30, c.t2);
            const approach = this.rowVelocity(c, 0);
            // Push out of penetration, and bounce only on real impacts so resting contacts stay quiet.
            // A real impact bounces; a resting or slow contact is pushed out of penetration instead.
            // Doing both in one step would add the correction speed to the bounce.
            c.bias = source.depth < 0 ? source.depth / dt : approach < -1 && restitution > 0 ? -restitution * approach : BAUMGARTE / dt * Math.max(source.depth - SLOP, 0);
        }
    }
    private pairKey(a: RigidBody3D, b: RigidBody3D): number { return a.id < b.id ? a.id * 4194304 + b.id : b.id * 4194304 + a.id; }
    /**
     * Work out everything one solver direction needs, so the iterations that follow are plain
     * sums and products. Returns the effective mass along that direction.
     */
    private prepareContactRow(c: SolverContact, at: number, axis: ArrayLike<number>): number {
        const row = c.rows, ra = c.ra, rb = c.rb, x = axis[0]!, y = axis[1]!, z = axis[2]!;
        row[at] = x; row[at + 1] = y; row[at + 2] = z;
        const ax = ra[1]! * z - ra[2]! * y, ay = ra[2]! * x - ra[0]! * z, az = ra[0]! * y - ra[1]! * x;
        const bx = rb[1]! * z - rb[2]! * y, by = rb[2]! * x - rb[0]! * z, bz = rb[0]! * y - rb[1]! * x;
        row[at + 3] = ax; row[at + 4] = ay; row[at + 5] = az; row[at + 6] = bx; row[at + 7] = by; row[at + 8] = bz;
        let k = c.ima + c.imb;
        if (c.ima > 0) {
            const m = c.a.inverseInertiaWorld, sx = m[0]! * ax + m[1]! * ay + m[2]! * az, sy = m[3]! * ax + m[4]! * ay + m[5]! * az, sz = m[6]! * ax + m[7]! * ay + m[8]! * az;
            row[at + 9] = sx; row[at + 10] = sy; row[at + 11] = sz;
            k += ax * sx + ay * sy + az * sz;
        } else row[at + 9] = row[at + 10] = row[at + 11] = 0;
        if (c.imb > 0) {
            const m = c.b.inverseInertiaWorld, sx = m[0]! * bx + m[1]! * by + m[2]! * bz, sy = m[3]! * bx + m[4]! * by + m[5]! * bz, sz = m[6]! * bx + m[7]! * by + m[8]! * bz;
            row[at + 12] = sx; row[at + 13] = sy; row[at + 14] = sz;
            k += bx * sx + by * sy + bz * sz;
        } else row[at + 12] = row[at + 13] = row[at + 14] = 0;
        return k > 0 ? 1 / k : 0;
    }
    /** Velocity of b relative to a at the contact, along the direction stored at `at`. */
    private rowVelocity(c: SolverContact, at: number): number {
        const row = c.rows, va = c.a.linearVelocity, vb = c.b.linearVelocity, wa = c.a.angularVelocity, wb = c.b.angularVelocity;
        return (vb[0]! - va[0]!) * row[at]! + (vb[1]! - va[1]!) * row[at + 1]! + (vb[2]! - va[2]!) * row[at + 2]!
            + wb[0]! * row[at + 6]! + wb[1]! * row[at + 7]! + wb[2]! * row[at + 8]! - wa[0]! * row[at + 3]! - wa[1]! * row[at + 4]! - wa[2]! * row[at + 5]!;
    }
    private applyRow(c: SolverContact, at: number, magnitude: number): void {
        const row = c.rows, x = row[at]! * magnitude, y = row[at + 1]! * magnitude, z = row[at + 2]! * magnitude;
        if (c.ima > 0) {
            const v = c.a.linearVelocity, w = c.a.angularVelocity, k = c.ima;
            v[0]! -= x * k; v[1]! -= y * k; v[2]! -= z * k;
            w[0]! -= row[at + 9]! * magnitude; w[1]! -= row[at + 10]! * magnitude; w[2]! -= row[at + 11]! * magnitude;
        }
        if (c.imb > 0) {
            const v = c.b.linearVelocity, w = c.b.angularVelocity, k = c.imb;
            v[0]! += x * k; v[1]! += y * k; v[2]! += z * k;
            w[0]! += row[at + 12]! * magnitude; w[1]! += row[at + 13]! * magnitude; w[2]! += row[at + 14]! * magnitude;
        }
    }
    private solve(c: SolverContact): void {
        // Normal: accumulate and clamp so contacts only ever push.
        let delta = (c.bias - this.rowVelocity(c, 0)) * c.normalMass;
        const total = Math.max(c.normalImpulse + delta, 0);
        delta = total - c.normalImpulse; c.normalImpulse = total;
        if (delta !== 0) this.applyRow(c, 0, delta);
        // Friction: bounded by the normal impulse (Coulomb cone, per tangent).
        const limit = c.friction * c.normalImpulse;
        let tangent = -this.rowVelocity(c, 15) * c.tangentMass1, clamped = clamp(c.tangentImpulse1 + tangent, -limit, limit);
        tangent = clamped - c.tangentImpulse1; c.tangentImpulse1 = clamped;
        if (tangent !== 0) this.applyRow(c, 15, tangent);
        tangent = -this.rowVelocity(c, 30) * c.tangentMass2; clamped = clamp(c.tangentImpulse2 + tangent, -limit, limit);
        tangent = clamped - c.tangentImpulse2; c.tangentImpulse2 = clamped;
        if (tangent !== 0) this.applyRow(c, 30, tangent);
    }

    // ---- queries ----------------------------------------------------------------
    /** Nearest solid body hit by a ray; triggers are skipped. `direction` need not be normalized. */
    raycast(origin: ArrayLike<number>, direction: ArrayLike<number>, maxDistance = Infinity, mask = -1): PhysicsRaycastHit3D | undefined {
        const length = Math.hypot(direction[0]!, direction[1]!, direction[2]!);
        if (!(length > 0)) throw new World3DError('WORLD3D_INPUT_INVALID', 'ray direction');
        const d = [direction[0]! / length, direction[1]! / length, direction[2]! / length], o = [origin[0]!, origin[1]!, origin[2]!];
        let best: PhysicsRaycastHit3D | undefined, limit = maxDistance;
        const normal = [0, 0, 0];
        for (const body of this.#bodies) {
            if ((body.layer & mask) === 0 || body.isTrigger) continue;
            const distance = rayShape(body, o, d, limit, normal);
            if (distance < 0 || distance > limit) continue;
            limit = distance;
            best = {body, distance, point: [o[0]! + d[0]! * distance, o[1]! + d[1]! * distance, o[2]! + d[2]! * distance], normal: [normal[0]!, normal[1]!, normal[2]!]};
        }
        return best;
    }
    /** Solid bodies whose shape touches a sphere; triggers are skipped. */
    overlapSphere(center: ArrayLike<number>, radius: number, mask = -1): RigidBody3D[] {
        const probe = probeBody(center, {type: 'sphere', radius: requirePositive3D(radius, 'radius')}), found: RigidBody3D[] = [];
        for (const body of this.#bodies) if ((body.layer & mask) !== 0 && !body.isTrigger && collide(this.#manifold, probe, body)) found.push(body);
        return found;
    }
    /** @internal Contacts of a free-standing shape against the world, for the character controller. */
    probe(body: RigidBody3D, mask: number, visit: (nx: number, ny: number, nz: number, depth: number, other: RigidBody3D) => void): void {
        const m = this.#manifold, box = body.aabb;
        for (const other of this.#bodies) {
            if (other === body || other.isTrigger || (other.layer & mask) === 0) continue;
            const b = other.aabb;
            if (box[0]! > b[3]! || box[3]! < b[0]! || box[1]! > b[4]! || box[4]! < b[1]! || box[2]! > b[5]! || box[5]! < b[2]!) continue;
            if (!collide(m, body, other)) continue;
            for (let i = 0; i < m.count; i++) { const c = m.contacts[i]!; if (c.depth > 0) visit(c.nx, c.ny, c.nz, c.depth, other); }
        }
    }
}
function probeBody(position: ArrayLike<number>, shape: ShapeDefinition3D): RigidBody3D {
    return new RigidBody3D({type: 'kinematic', shape, position: [position[0]!, position[1]!, position[2]!]});
}
/** Distance along a unit ray to a body, or -1. Writes the surface normal at the hit. */
function rayShape(body: RigidBody3D, o: number[], d: number[], limit: number, normal: number[]): number {
    const shape = body.shape, p = body.position, r = body.rotation;
    const raySphere = (cx: number, cy: number, cz: number, radius: number): number => {
        const mx = o[0]! - cx, my = o[1]! - cy, mz = o[2]! - cz, b = mx * d[0]! + my * d[1]! + mz * d[2]!, c = mx * mx + my * my + mz * mz - radius * radius;
        if (c > 0 && b > 0) return -1;
        const discriminant = b * b - c;
        if (discriminant < 0) return -1;
        const t = Math.max(-b - Math.sqrt(discriminant), 0);
        normal[0] = (mx + d[0]! * t) / radius; normal[1] = (my + d[1]! * t) / radius; normal[2] = (mz + d[2]! * t) / radius;
        return t;
    };
    if (shape.type === 'sphere') return raySphere(p[0]!, p[1]!, p[2]!, shape.radius);
    if (shape.type === 'plane') {
        const nx = r[1]!, ny = r[4]!, nz = r[7]!, denominator = d[0]! * nx + d[1]! * ny + d[2]! * nz;
        if (denominator >= -1e-9) return -1;
        const t = ((p[0]! - o[0]!) * nx + (p[1]! - o[1]!) * ny + (p[2]! - o[2]!) * nz) / denominator;
        if (t < 0) return -1;
        normal[0] = nx; normal[1] = ny; normal[2] = nz;
        return t;
    }
    // Work in the body's local frame for boxes and capsules.
    const dx = o[0]! - p[0]!, dy = o[1]! - p[1]!, dz = o[2]! - p[2]!;
    const lo = [r[0]! * dx + r[3]! * dy + r[6]! * dz, r[1]! * dx + r[4]! * dy + r[7]! * dz, r[2]! * dx + r[5]! * dy + r[8]! * dz];
    const ld = [r[0]! * d[0]! + r[3]! * d[1]! + r[6]! * d[2]!, r[1]! * d[0]! + r[4]! * d[1]! + r[7]! * d[2]!, r[2]! * d[0]! + r[5]! * d[1]! + r[8]! * d[2]!];
    let t = -1, lx = 0, ly = 0, lz = 0;
    if (shape.type === 'convex') {
        t = shape.hull.raycast(lo[0]!, lo[1]!, lo[2]!, ld[0]!, ld[1]!, ld[2]!, limit, meshNormal);
        if (t < 0) return -1;
        lx = meshNormal[0]!; ly = meshNormal[1]!; lz = meshNormal[2]!;
    } else if (shape.type === 'mesh') {
        t = shape.mesh.raycast(lo[0]!, lo[1]!, lo[2]!, ld[0]!, ld[1]!, ld[2]!, limit, meshNormal);
        if (t < 0) return -1;
        lx = meshNormal[0]!; ly = meshNormal[1]!; lz = meshNormal[2]!;
    } else if (shape.type === 'box') {
        let near = 0, far = limit, axis = -1, sign = 0;
        for (let i = 0; i < 3; i++) {
            const h = shape.halfExtents[i]!;
            if (Math.abs(ld[i]!) < 1e-12) { if (Math.abs(lo[i]!) > h) return -1; continue; }
            let t1 = (-h - lo[i]!) / ld[i]!, t2 = (h - lo[i]!) / ld[i]!, s = -1;
            if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; s = 1; }
            if (t1 > near) { near = t1; axis = i; sign = s; }
            far = Math.min(far, t2);
            if (near > far) return -1;
        }
        if (axis < 0) return -1; // Origin inside the box.
        t = near; lx = axis === 0 ? sign : 0; ly = axis === 1 ? sign : 0; lz = axis === 2 ? sign : 0;
    } else {
        const capsule = shape as {radius: number; halfHeight: number}, radius = capsule.radius, h = capsule.halfHeight;
        // Side: an infinite cylinder around local Y, clipped to the segment.
        const a = ld[0]! * ld[0]! + ld[2]! * ld[2]!, b = lo[0]! * ld[0]! + lo[2]! * ld[2]!, c = lo[0]! * lo[0]! + lo[2]! * lo[2]! - radius * radius;
        if (a > 1e-12) {
            const discriminant = b * b - a * c;
            if (discriminant >= 0) {
                const hit = (-b - Math.sqrt(discriminant)) / a, y = lo[1]! + ld[1]! * hit;
                if (hit >= 0 && Math.abs(y) <= h) { t = hit; lx = (lo[0]! + ld[0]! * hit) / radius; ly = 0; lz = (lo[2]! + ld[2]! * hit) / radius; }
            }
        }
        if (t < 0) {
            // Caps: the nearer of the two end spheres, tested in world space.
            let bestCap = -1, bx = 0, by = 0, bz = 0;
            for (const side of [-h, h]) {
                const hit = raySphere(p[0]! + r[1]! * side, p[1]! + r[4]! * side, p[2]! + r[7]! * side, radius);
                if (hit >= 0 && (bestCap < 0 || hit < bestCap)) { bestCap = hit; bx = normal[0]!; by = normal[1]!; bz = normal[2]!; }
            }
            normal[0] = bx; normal[1] = by; normal[2] = bz;
            return bestCap;
        }
    }
    normal[0] = r[0]! * lx + r[1]! * ly + r[2]! * lz; normal[1] = r[3]! * lx + r[4]! * ly + r[5]! * lz; normal[2] = r[6]! * lx + r[7]! * ly + r[8]! * lz;
    return t;
}

// ---- character controller -------------------------------------------------------
export interface CharacterControllerOptions3D {
    readonly radius?: number;
    /** Total height including both caps. */
    readonly height?: number;
    readonly position?: readonly [number, number, number];
    /** Steepest walkable slope in radians. */
    readonly slopeLimit?: number;
    /** Gap kept from surfaces so the capsule never rests exactly in contact. */
    readonly skin?: number;
    readonly mask?: number;
    readonly node?: Object3D;
}
/**
 * Kinematic capsule that slides along the world instead of being simulated.
 * Call move() with the displacement you want; it resolves penetration and
 * reports whether the capsule stands on walkable ground.
 */
export class CharacterController3D {
    readonly world: PhysicsWorld3D;
    readonly position = v3();
    readonly radius: number;
    readonly height: number;
    slopeLimit: number;
    skin: number;
    mask: number;
    node: Object3D | undefined;
    /** True when the last move ended on a walkable surface. */
    isGrounded = false;
    /** Normal of the ground under the capsule after the last move. */
    readonly groundNormal = v3(0, 1, 0);
    /** Body standing under the capsule, when grounded. */
    groundBody: RigidBody3D | undefined;
    readonly #probe: RigidBody3D;

    constructor(world: PhysicsWorld3D, options: CharacterControllerOptions3D = {}) {
        this.world = world;
        this.radius = requirePositive3D(options.radius ?? 0.35, 'radius');
        this.height = Math.max(requirePositive3D(options.height ?? 1.8, 'height'), this.radius * 2);
        this.slopeLimit = options.slopeLimit ?? Math.PI / 4;
        this.skin = options.skin ?? 0.01;
        this.mask = options.mask ?? -1;
        this.node = options.node;
        if (options.position) this.position.set(options.position);
        this.#probe = new RigidBody3D({type: 'kinematic', shape: {type: 'capsule', radius: this.radius, halfHeight: this.height / 2 - this.radius}});
    }
    /** Move by a world-space displacement, sliding along anything in the way. */
    move(dx: number, dy: number, dz: number): void {
        requireFinite3D(dx + dy + dz, 'displacement');
        // Split long moves so one step never exceeds the radius and tunnels through thin walls.
        const distance = Math.hypot(dx, dy, dz), steps = Math.min(Math.max(Math.ceil(distance / (this.radius * 0.9)), 1), 32);
        const p = this.position, probe = this.#probe, walkable = Math.cos(this.slopeLimit);
        this.isGrounded = false; this.groundBody = undefined;
        for (let step = 0; step < steps; step++) {
            p[0]! += dx / steps; p[1]! += dy / steps; p[2]! += dz / steps;
            for (let iteration = 0; iteration < 4; iteration++) {
                probe.position.set(p); probe.refresh();
                const hit: {depth: number; nx: number; ny: number; nz: number; body: RigidBody3D | undefined} = {depth: 0, nx: 0, ny: 0, nz: 0, body: undefined};
                this.world.probe(probe, this.mask, (x, y, z, depth, body) => {
                    // Resolve the deepest contact first; the normal points from the capsule into the obstacle.
                    if (depth > hit.depth) { hit.depth = depth; hit.nx = x; hit.ny = y; hit.nz = z; hit.body = body; }
                });
                if (!hit.body) break;
                const push = hit.depth + this.skin;
                p[0]! -= hit.nx * push; p[1]! -= hit.ny * push; p[2]! -= hit.nz * push;
                if (-hit.ny >= walkable) { this.isGrounded = true; this.groundBody = hit.body; this.groundNormal[0] = -hit.nx; this.groundNormal[1] = -hit.ny; this.groundNormal[2] = -hit.nz; }
            }
        }
        if (!this.isGrounded) {
            // A resting capsule hovers one skin above the floor; look just below the feet.
            probe.position.set(p); probe.position[1]! -= this.skin * 3; probe.refresh();
            this.world.probe(probe, this.mask, (x, y, z, _depth, body) => {
                if (-y >= walkable) { this.isGrounded = true; this.groundBody = body; this.groundNormal[0] = -x; this.groundNormal[1] = -y; this.groundNormal[2] = -z; }
            });
        }
        const node = this.node;
        if (node) { node.position.set(p); node.markTransformDirty(); }
    }
}

export function createPhysicsWorld3D(options: PhysicsWorldOptions3D = {}): PhysicsWorld3D { return new PhysicsWorld3D(options); }
export function createCharacterController3D(world: PhysicsWorld3D, options: CharacterControllerOptions3D = {}): CharacterController3D { return new CharacterController3D(world, options); }
