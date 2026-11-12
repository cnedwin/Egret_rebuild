// SPDX-License-Identifier: Apache-2.0
// An arcade vehicle: one rigid body for the chassis, and wheels that are not
// bodies at all. Each wheel looks down along a ray, holds the chassis up with a
// spring and a damper where the ray meets the ground, and pushes at that point
// to drive, brake and resist sliding sideways. DOM-free and backend-independent.
import {World3DError, requireFinite3D, requirePositive3D} from './core3D.js';
import type {Object3D} from './Object3D.js';
import type {PhysicsWorld3D, RigidBody3D} from './Physics3D.js';

export const VEHICLE3D_LIMITS = Object.freeze({maxWheels: 16} as const);

export interface WheelOptions3D {
    /** Where the suspension is attached, in the chassis's local frame. */
    readonly position: readonly [number, number, number];
    readonly radius?: number;
    /** Length of the suspension at rest, from the attachment to the wheel's center. Defaults to 0.3. */
    readonly restLength?: number;
    /** Most the suspension may shorten or lengthen from rest. Defaults to 0.2. */
    readonly travel?: number;
    /** Spring strength in force per unit of compression. Defaults to hold a quarter of the chassis at a third of the travel. */
    readonly stiffness?: number;
    /** Damper strength in force per unit of speed. Defaults to a firm ride for the stiffness. */
    readonly damping?: number;
    /** Turns with the steering. */
    readonly steered?: boolean;
    /** Pushes with the engine. */
    readonly driven?: boolean;
    /** Sideways and braking grip as a multiple of the load on the wheel. Defaults to 1.2. */
    readonly grip?: number;
    /** Node placed at the wheel's center and turned with it; give it to a mesh whose axle is its local X axis. */
    readonly node?: Object3D;
}
export interface VehicleOptions3D {
    readonly wheels: readonly WheelOptions3D[];
    /** Force the engine shares between the driven wheels at full throttle. */
    readonly engineForce?: number;
    /** Force the brakes share between all wheels at full brake. */
    readonly brakeForce?: number;
    /** Largest steering angle in radians. Defaults to 0.6. */
    readonly maxSteer?: number;
    /** Speed along the ground beyond which the engine stops pushing. Defaults to 40. */
    readonly topSpeed?: number;
    /**
     * How much of the tyres' sideways push tips the chassis: 1 applies it at the
     * road, where a real tyre pushes, and lets a tall car roll over in a hard turn;
     * 0 applies it level with the center of mass, so the car never leans. Defaults to 0.2.
     */
    readonly rollInfluence?: number;
    /** Bodies the wheels' rays may land on. Defaults to everything. */
    readonly mask?: number;
}
export interface Wheel3D {
    readonly position: Float64Array;
    radius: number;
    restLength: number;
    travel: number;
    stiffness: number;
    damping: number;
    steered: boolean;
    driven: boolean;
    grip: number;
    node: Object3D | undefined;
    /** True when the wheel's ray reached the ground in the last update. */
    grounded: boolean;
    /** Present length of the suspension. */
    length: number;
    /** Load the wheel carried in the last update, as a force. */
    load: number;
    /** How far the wheel has rolled, in radians. */
    spin: number;
    /** Body under the wheel when grounded. */
    ground: RigidBody3D | undefined;
    /** World position of the contact patch when grounded. */
    readonly contact: Float64Array;
}

const down = new Float64Array(3), forward = new Float64Array(3), side = new Float64Array(3), from = new Float64Array(3), v = new Float64Array(3), w = new Float64Array(3), grip = new Float64Array(3);

/**
 * Drives a chassis body on ray wheels. Set `throttle` (-1 to 1), `brake` (0
 * to 1) and `steering` (-1 to 1, positive turns left), then call update() once
 * before each world.step(). The chassis's local -Z is forward and +Y is up.
 */
export class Vehicle3D {
    readonly world: PhysicsWorld3D;
    readonly chassis: RigidBody3D;
    readonly wheels: Wheel3D[] = [];
    engineForce: number;
    brakeForce: number;
    maxSteer: number;
    topSpeed: number;
    rollInfluence: number;
    mask: number;
    throttle = 0;
    brake = 0;
    steering = 0;
    /** Speed along the chassis's forward direction after the last update; negative in reverse. */
    speed = 0;

    constructor(world: PhysicsWorld3D, chassis: RigidBody3D, options: VehicleOptions3D) {
        if (!world || typeof world.raycast !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'physics world');
        if (!chassis || chassis.type !== 'dynamic' || chassis.world !== world) throw new World3DError('WORLD3D_INPUT_INVALID', 'the chassis is a dynamic body in this world');
        if (!options || !Array.isArray(options.wheels) || options.wheels.length === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'wheels');
        if (options.wheels.length > VEHICLE3D_LIMITS.maxWheels) throw new World3DError('WORLD3D_BUDGET', 'wheels');
        this.world = world; this.chassis = chassis;
        this.engineForce = requireFinite3D(options.engineForce ?? chassis.mass * 8, 'engineForce');
        this.brakeForce = requireFinite3D(options.brakeForce ?? chassis.mass * 12, 'brakeForce');
        this.maxSteer = requireFinite3D(options.maxSteer ?? 0.6, 'maxSteer');
        this.topSpeed = requirePositive3D(options.topSpeed ?? 40, 'topSpeed');
        this.rollInfluence = Math.min(Math.max(requireFinite3D(options.rollInfluence ?? 0.2, 'rollInfluence'), 0), 1);
        this.mask = options.mask ?? -1;
        const weight = chassis.mass * Math.hypot(world.gravity[0]!, world.gravity[1]!, world.gravity[2]!) / options.wheels.length;
        for (const wheel of options.wheels) {
            if (!wheel || !wheel.position) throw new World3DError('WORLD3D_INPUT_INVALID', 'wheel position');
            for (const value of wheel.position) requireFinite3D(value, 'wheel position');
            const travel = requirePositive3D(wheel.travel ?? 0.2, 'wheel travel');
            // By default the car sits a third of the way into its travel, and the ride settles in about one bounce.
            const stiffness = requirePositive3D(wheel.stiffness ?? Math.max(weight, 1) / (travel / 3), 'wheel stiffness');
            this.wheels.push({
                position: Float64Array.from(wheel.position), radius: requirePositive3D(wheel.radius ?? 0.35, 'wheel radius'), restLength: requirePositive3D(wheel.restLength ?? 0.3, 'wheel restLength'), travel, stiffness,
                damping: requireFinite3D(wheel.damping ?? 1.4 * Math.sqrt(stiffness * chassis.mass / options.wheels.length), 'wheel damping'),
                steered: wheel.steered ?? false, driven: wheel.driven ?? false, grip: requireFinite3D(wheel.grip ?? 1.2, 'wheel grip'), node: wheel.node,
                grounded: false, length: wheel.restLength ?? 0.3, load: 0, spin: 0, ground: undefined, contact: new Float64Array(3),
            });
        }
    }
    /** Number of wheels on the ground after the last update. */
    get groundedWheels(): number { let count = 0; for (const wheel of this.wheels) if (wheel.grounded) count++; return count; }
    /** Apply suspension, engine, brakes and tyre grip for the coming step of `deltaSeconds`. */
    update(deltaSeconds: number): void {
        const dt = requireFinite3D(deltaSeconds, 'deltaSeconds');
        if (!(dt > 0)) return;
        const body = this.chassis, r = body.rotation, p = body.position;
        // Every wheel is worked out from the chassis's motion as the update began, so the order of the wheels does not matter.
        v[0] = body.linearVelocity[0]!; v[1] = body.linearVelocity[1]!; v[2] = body.linearVelocity[2]!; w[0] = body.angularVelocity[0]!; w[1] = body.angularVelocity[1]!; w[2] = body.angularVelocity[2]!;
        // Chassis axes in the world: right, up and back are the columns of its rotation.
        down[0] = -r[1]!; down[1] = -r[4]!; down[2] = -r[7]!;
        const fx = -r[2]!, fy = -r[5]!, fz = -r[8]!;
        this.speed = v[0]! * fx + v[1]! * fy + v[2]! * fz;
        const throttle = Math.min(Math.max(this.throttle, -1), 1), braking = Math.min(Math.max(this.brake, 0), 1), steer = Math.min(Math.max(this.steering, -1), 1) * this.maxSteer;
        let driven = 0;
        for (const wheel of this.wheels) if (wheel.driven) driven++;
        const count = this.wheels.length;
        for (const wheel of this.wheels) {
            const a = wheel.position;
            from[0] = p[0]! + r[0]! * a[0]! + r[1]! * a[1]! + r[2]! * a[2]!; from[1] = p[1]! + r[3]! * a[0]! + r[4]! * a[1]! + r[5]! * a[2]!; from[2] = p[2]! + r[6]! * a[0]! + r[7]! * a[1]! + r[8]! * a[2]!;
            const reach = wheel.restLength + wheel.travel + wheel.radius;
            let hit = this.world.raycast(from, down, reach, this.mask);
            // The chassis is no ground for its own wheels.
            if (hit && hit.body === body) hit = undefined;
            wheel.grounded = hit !== undefined; wheel.ground = hit?.body; wheel.load = 0;
            wheel.length = hit ? Math.max(hit.distance - wheel.radius, wheel.restLength - wheel.travel) : wheel.restLength + wheel.travel;
            let forwardSpeed = this.speed;
            if (hit) {
                const c = wheel.contact, n = hit.normal;
                c[0] = hit.point[0]; c[1] = hit.point[1]; c[2] = hit.point[2];
                // Velocity of the chassis at the contact patch, relative to whatever is under the wheel.
                const rx = c[0]! - p[0]!, ry = c[1]! - p[1]!, rz = c[2]! - p[2]!;
                // Motion of whatever is under the wheel, at the contact patch.
                const other = hit.body;
                let ux = 0, uy = 0, uz = 0;
                if (other.type !== 'static') {
                    const ox = c[0]! - other.position[0]!, oy = c[1]! - other.position[1]!, oz = c[2]! - other.position[2]!, ov = other.linearVelocity, ow = other.angularVelocity;
                    ux = ov[0]! + ow[1]! * oz - ow[2]! * oy; uy = ov[1]! + ow[2]! * ox - ow[0]! * oz; uz = ov[2]! + ow[0]! * oy - ow[1]! * ox;
                }
                const px = v[0]! + w[1]! * rz - w[2]! * ry - ux, py = v[1]! + w[2]! * rx - w[0]! * rz - uy, pz = v[2]! + w[0]! * ry - w[1]! * rx - uz;
                // The suspension shortens as fast as the chassis nears the surface, however the car is tilted or travelling along it.
                const facing = Math.max(-(n[0] * down[0]! + n[1] * down[1]! + n[2] * down[2]!), 0.1);
                // Past the end of its travel the spring keeps getting harder rather than giving up, so the car lands on its wheels and not its belly.
                const squeeze = wheel.restLength - (hit.distance - wheel.radius), closing = -(px * n[0] + py * n[1] + pz * n[2]) / facing;
                const load = Math.max(wheel.stiffness * squeeze + wheel.damping * closing, 0);
                wheel.load = load;
                const lift = load * dt;
                body.applyImpulse(-down[0]! * lift, -down[1]! * lift, -down[2]! * lift, c);
                // The wheel's heading on the ground: the chassis's forward, turned by the steering, laid flat on the surface.
                let hx = fx, hy = fy, hz = fz;
                if (wheel.steered && steer !== 0) {
                    const cos = Math.cos(steer), sin = Math.sin(steer);
                    // Positive steering turns the heading toward the chassis's left.
                    hx = fx * cos - r[0]! * sin; hy = fy * cos - r[3]! * sin; hz = fz * cos - r[6]! * sin;
                }
                const along = hx * n[0] + hy * n[1] + hz * n[2];
                forward[0] = hx - n[0] * along; forward[1] = hy - n[1] * along; forward[2] = hz - n[2] * along;
                const size = Math.hypot(forward[0]!, forward[1]!, forward[2]!);
                if (size > 1e-6) {
                    forward[0]! /= size; forward[1]! /= size; forward[2]! /= size;
                    side[0] = n[1] * forward[2]! - n[2] * forward[1]!; side[1] = n[2] * forward[0]! - n[0] * forward[2]!; side[2] = n[0] * forward[1]! - n[1] * forward[0]!;
                    forwardSpeed = px * forward[0]! + py * forward[1]! + pz * forward[2]!;
                    const most = wheel.grip * load * dt, share = body.mass / count;
                    // Raise the point the tyre pushes at toward the height of the center of mass, by as much as the car is kept from rolling.
                    const rise = (rx * down[0]! + ry * down[1]! + rz * down[2]!) * (1 - this.rollInfluence);
                    grip[0] = c[0]! - down[0]! * rise; grip[1] = c[1]! - down[1]! * rise; grip[2] = c[2]! - down[2]! * rise;
                    // Sideways: take out this wheel's share of the slide at that point, as far as its grip allows. How much push
                    // that takes depends on how easily the chassis turns about the point, not only on its mass.
                    const gx = grip[0]! - p[0]!, gy = grip[1]! - p[1]!, gz = grip[2]! - p[2]!;
                    const sideSpeed = (v[0]! + w[1]! * gz - w[2]! * gy - ux) * side[0]! + (v[1]! + w[2]! * gx - w[0]! * gz - uy) * side[1]! + (v[2]! + w[0]! * gy - w[1]! * gx - uz) * side[2]!;
                    const tx = gy * side[2]! - gz * side[1]!, ty = gz * side[0]! - gx * side[2]!, tz = gx * side[1]! - gy * side[0]!, m = body.inverseInertiaWorld;
                    const yielding = body.inverseMass + tx * (m[0]! * tx + m[1]! * ty + m[2]! * tz) + ty * (m[3]! * tx + m[4]! * ty + m[5]! * tz) + tz * (m[6]! * tx + m[7]! * ty + m[8]! * tz);
                    const hold = Math.min(Math.max(-sideSpeed / (yielding * count), -most), most);
                    // Along: engine below top speed, then brakes, which can stop the wheel's share of the car but not reverse it.
                    let push = wheel.driven && driven > 0 && Math.abs(forwardSpeed) < this.topSpeed ? throttle * this.engineForce / driven * dt : 0;
                    if (braking > 0) { const stop = Math.min(braking * this.brakeForce / count * dt, Math.abs(forwardSpeed) * share); push -= Math.sign(forwardSpeed) * stop; }
                    push = Math.min(Math.max(push, -most), most);
                    const ix = side[0]! * hold + forward[0]! * push, iy = side[1]! * hold + forward[1]! * push, iz = side[2]! * hold + forward[2]! * push;
                    body.applyImpulse(ix, iy, iz, grip);
                    // What the wheels push on is pushed back.
                    if (other.type === 'dynamic') other.applyImpulse(-ix + down[0]! * lift, -iy + down[1]! * lift, -iz + down[2]! * lift, c);
                }
            }
            wheel.spin += forwardSpeed / wheel.radius * dt;
            const node = wheel.node;
            if (node) {
                node.position[0] = from[0]! + down[0]! * wheel.length; node.position[1] = from[1]! + down[1]! * wheel.length; node.position[2] = from[2]! + down[2]! * wheel.length;
                // Chassis orientation, then the steering about up, then the roll about the axle.
                const q = body.quaternion, half = (wheel.steered ? steer : 0) / 2, sy = Math.sin(half), cy = Math.cos(half), roll = -wheel.spin / 2, sx = Math.sin(roll), cx = Math.cos(roll);
                // (steer about Y) * (roll about X)
                const lx = cy * sx, ly = sy * cx, lz = -sy * sx, lw = cy * cx, x = q[0]!, y = q[1]!, z = q[2]!, s = q[3]!;
                node.quaternion[0] = s * lx + x * lw + y * lz - z * ly; node.quaternion[1] = s * ly - x * lz + y * lw + z * lx;
                node.quaternion[2] = s * lz + x * ly - y * lx + z * lw; node.quaternion[3] = s * lw - x * lx - y * ly - z * lz;
                node.markTransformDirty();
            }
        }
    }
}

export function createVehicle3D(world: PhysicsWorld3D, chassis: RigidBody3D, options: VehicleOptions3D): Vehicle3D { return new Vehicle3D(world, chassis, options); }
