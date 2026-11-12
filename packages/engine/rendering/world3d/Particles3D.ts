// SPDX-License-Identifier: Apache-2.0
// CPU-simulated particle emitter drawn as one instanced, camera-facing quad
// batch. State lives in flat typed arrays and dead particles are swapped out
// of the active range, so a steady emitter allocates nothing per frame.
import {World3DError, requireCount3D, requireFinite3D} from './core3D.js';
import {setColor3D, createSpriteMaterial3D} from './Material3D.js';
import type {Blending3D, ColorInput3D, Material3D} from './Material3D.js';
import {mat4Invert, mat4MaxScaleOnAxis} from './math3D.js';
import {InstancedMesh3D} from './Mesh3D.js';
import {createQuadGeometry3D} from './primitives3D.js';
import type {Texture3D} from './Texture3D.js';

export const PARTICLES3D_LIMITS = Object.freeze({maxParticles: 262144, maxStepSeconds: 0.25} as const);

export type ParticleShape3D = 'point' | 'sphere' | 'box';
export interface ParticleEmitterOptions3D {
    /** Maximum number of live particles. */
    readonly capacity?: number;
    /** Particles emitted per second while the emitter is playing. */
    readonly rate?: number;
    /** Seconds each particle lives: a fixed value or a [min, max] range. */
    readonly lifetime?: number | readonly [number, number];
    /** Initial speed in units per second: a fixed value or a [min, max] range. */
    readonly speed?: number | readonly [number, number];
    /** Mean emission direction in emitter space. */
    readonly direction?: readonly [number, number, number];
    /** Half angle in radians of the cone around `direction`; PI emits in every direction. */
    readonly spread?: number;
    /** Constant acceleration, in the simulation space. */
    readonly gravity?: readonly [number, number, number];
    /** Fraction of velocity lost per second. */
    readonly drag?: number;
    readonly startSize?: number;
    readonly endSize?: number;
    readonly startColor?: ColorInput3D;
    readonly endColor?: ColorInput3D;
    readonly startOpacity?: number;
    readonly endOpacity?: number;
    /** Volume particles spawn in: a point, a sphere of `radius`, or a box of half `extents`. */
    readonly shape?: ParticleShape3D;
    readonly radius?: number;
    readonly extents?: readonly [number, number, number];
    /** 'world' leaves emitted particles behind when the emitter moves; 'local' carries them along. */
    readonly space?: 'world' | 'local';
    readonly map?: Texture3D;
    readonly blending?: Blending3D;
    /** Seed of the deterministic random sequence. */
    readonly seed?: number;
    /** Stop emitting after this many seconds; 0 emits forever. */
    readonly duration?: number;
}

function range(value: number | readonly [number, number] | undefined, fallback: number, field: string): [number, number] {
    if (value === undefined) return [fallback, fallback];
    if (typeof value === 'number') return [requireFinite3D(value, field), value];
    if (!Array.isArray(value) || value.length !== 2) throw new World3DError('WORLD3D_INPUT_INVALID', field);
    const min = requireFinite3D(value[0], field), max = requireFinite3D(value[1], field);
    if (max < min) throw new World3DError('WORLD3D_INPUT_INVALID', field);
    return [min, max];
}

const STRIDE = 8; // px, py, pz, vx, vy, vz, age, life
const scratchInverse = new Float32Array(16);

export class ParticleEmitter3D extends InstancedMesh3D {
    rate: number;
    readonly lifetime: [number, number];
    readonly speed: [number, number];
    readonly direction = new Float32Array([0, 1, 0]);
    spread: number;
    readonly gravity = new Float32Array(3);
    drag: number;
    startSize: number;
    endSize: number;
    readonly startColor = new Float32Array([1, 1, 1]);
    readonly endColor = new Float32Array([1, 1, 1]);
    startOpacity: number;
    endOpacity: number;
    shape: ParticleShape3D;
    radius: number;
    readonly extents = new Float32Array([0.5, 0.5, 0.5]);
    readonly space: 'world' | 'local';
    duration: number;
    /** Emission is suspended while false; live particles keep simulating. */
    emitting = true;
    readonly #state: Float32Array;
    #alive = 0;
    #debt = 0;
    #elapsed = 0;
    #random: number;
    readonly #seed: number;

    constructor(options: ParticleEmitterOptions3D = {}) {
        const capacity = requireCount3D(options.capacity ?? 1000, 'capacity', PARTICLES3D_LIMITS.maxParticles);
        const material: Material3D = createSpriteMaterial3D({
            ...(options.map ? {map: options.map} : {}), blending: options.blending ?? 'additive', depthWrite: false,
        });
        super(createQuadGeometry3D(), material, capacity, 4);
        this.name = 'particles';
        this.castShadow = false;
        this.receiveShadow = false;
        this.count = 0;
        this.instanceColors = new Float32Array(capacity * 4);
        this.#state = new Float32Array(capacity * STRIDE);
        this.rate = requireFinite3D(options.rate ?? 50, 'rate');
        this.lifetime = range(options.lifetime, 1, 'lifetime');
        this.speed = range(options.speed, 1, 'speed');
        if (this.lifetime[0] <= 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'lifetime');
        if (options.direction) this.direction.set(options.direction);
        this.spread = requireFinite3D(options.spread ?? Math.PI / 8, 'spread');
        if (options.gravity) this.gravity.set(options.gravity);
        this.drag = requireFinite3D(options.drag ?? 0, 'drag');
        this.startSize = requireFinite3D(options.startSize ?? 0.2, 'startSize');
        this.endSize = requireFinite3D(options.endSize ?? this.startSize, 'endSize');
        if (options.startColor !== undefined) setColor3D(this.startColor, options.startColor);
        this.endColor.set(this.startColor);
        if (options.endColor !== undefined) setColor3D(this.endColor, options.endColor);
        this.startOpacity = requireFinite3D(options.startOpacity ?? 1, 'startOpacity');
        this.endOpacity = requireFinite3D(options.endOpacity ?? 0, 'endOpacity');
        this.shape = options.shape ?? 'point';
        this.radius = requireFinite3D(options.radius ?? 0.5, 'radius');
        if (options.extents) this.extents.set(options.extents);
        this.space = options.space ?? 'world';
        this.duration = requireFinite3D(options.duration ?? 0, 'duration');
        this.#seed = (options.seed ?? 0x9e3779b9) >>> 0;
        this.#random = this.#seed;
    }
    /** Number of live particles. */
    get aliveCount(): number { return this.#alive; }
    /** Seconds simulated since construction or the last reset(). */
    get elapsedSeconds(): number { return this.#elapsed; }

    /** Uniform value in [0, 1) from a small deterministic generator (mulberry32). */
    private next(): number {
        let t = this.#random = (this.#random + 0x6d2b79f5) >>> 0;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /** Emit `count` particles immediately, limited by the remaining capacity. */
    burst(count: number): number {
        const wanted = Math.min(requireCount3D(count, 'count', PARTICLES3D_LIMITS.maxParticles), this.capacity - this.#alive);
        if (wanted <= 0) return 0;
        const world = this.space === 'world';
        if (world) this.updateWorldMatrix();
        for (let i = 0; i < wanted; i++) this.spawn(world);
        return wanted;
    }
    private spawn(world: boolean): void {
        const state = this.#state, o = this.#alive * STRIDE;
        let px = 0, py = 0, pz = 0;
        if (this.shape === 'sphere') {
            // Uniform point inside a ball by rejection-free cube-root scaling.
            const z = this.next() * 2 - 1, angle = this.next() * Math.PI * 2, r = Math.cbrt(this.next()) * this.radius, flat = Math.sqrt(1 - z * z);
            px = r * flat * Math.cos(angle); py = r * z; pz = r * flat * Math.sin(angle);
        } else if (this.shape === 'box') {
            px = (this.next() * 2 - 1) * this.extents[0]!; py = (this.next() * 2 - 1) * this.extents[1]!; pz = (this.next() * 2 - 1) * this.extents[2]!;
        }
        // Sample a direction uniformly inside the cone around `direction`.
        const dx = this.direction[0]!, dy = this.direction[1]!, dz = this.direction[2]!, length = Math.hypot(dx, dy, dz) || 1;
        const ax = dx / length, ay = dy / length, az = dz / length;
        const cosLimit = Math.cos(Math.min(Math.max(this.spread, 0), Math.PI));
        const cosTheta = 1 - this.next() * (1 - cosLimit), sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta)), phi = this.next() * Math.PI * 2;
        // Orthonormal basis (u, v, axis); pick the helper axis least aligned with `axis`.
        const hx = Math.abs(ax) < 0.9 ? 1 : 0, hy = hx ? 0 : 1;
        let ux = ay * 0 - az * hy, uy = az * hx - ax * 0, uz = ax * hy - ay * hx;
        const ul = Math.hypot(ux, uy, uz) || 1;
        ux /= ul; uy /= ul; uz /= ul;
        const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
        const c = Math.cos(phi) * sinTheta, s = Math.sin(phi) * sinTheta;
        let rx = ux * c + vx * s + ax * cosTheta, ry = uy * c + vy * s + ay * cosTheta, rz = uz * c + vz * s + az * cosTheta;
        const speed = this.speed[0] + this.next() * (this.speed[1] - this.speed[0]);
        if (world) {
            // Move the spawn point and direction into world space once, at birth.
            const m = this.matrixWorld;
            const wx = m[0]! * px + m[4]! * py + m[8]! * pz + m[12]!, wy = m[1]! * px + m[5]! * py + m[9]! * pz + m[13]!, wz = m[2]! * px + m[6]! * py + m[10]! * pz + m[14]!;
            px = wx; py = wy; pz = wz;
            const tx = m[0]! * rx + m[4]! * ry + m[8]! * rz, ty = m[1]! * rx + m[5]! * ry + m[9]! * rz, tz = m[2]! * rx + m[6]! * ry + m[10]! * rz;
            const tl = Math.hypot(tx, ty, tz) || 1;
            rx = tx / tl; ry = ty / tl; rz = tz / tl;
        }
        state[o] = px; state[o + 1] = py; state[o + 2] = pz;
        state[o + 3] = rx * speed; state[o + 4] = ry * speed; state[o + 5] = rz * speed;
        state[o + 6] = 0;
        state[o + 7] = this.lifetime[0] + this.next() * (this.lifetime[1] - this.lifetime[0]);
        this.#alive++;
    }
    /** Advance the simulation and refresh the instance buffers. */
    update(deltaSeconds: number): void {
        const dt = Math.min(Math.max(requireFinite3D(deltaSeconds, 'deltaSeconds'), 0), PARTICLES3D_LIMITS.maxStepSeconds);
        const state = this.#state, world = this.space === 'world';
        this.updateWorldMatrix();
        // Age and integrate; a dead particle is replaced by the last live one.
        const gx = this.gravity[0]! * dt, gy = this.gravity[1]! * dt, gz = this.gravity[2]! * dt, damp = Math.max(0, 1 - this.drag * dt);
        for (let i = 0; i < this.#alive;) {
            const o = i * STRIDE, age = state[o + 6]! + dt;
            if (age >= state[o + 7]!) {
                const last = (--this.#alive) * STRIDE;
                if (last !== o) state.copyWithin(o, last, last + STRIDE);
                continue;
            }
            state[o + 6] = age;
            const vx = (state[o + 3]! + gx) * damp, vy = (state[o + 4]! + gy) * damp, vz = (state[o + 5]! + gz) * damp;
            state[o + 3] = vx; state[o + 4] = vy; state[o + 5] = vz;
            state[o] = state[o]! + vx * dt; state[o + 1] = state[o + 1]! + vy * dt; state[o + 2] = state[o + 2]! + vz * dt;
            i++;
        }
        const active = this.emitting && (this.duration <= 0 || this.#elapsed < this.duration);
        this.#elapsed += dt;
        if (active && this.rate > 0) {
            this.#debt += this.rate * dt;
            const emit = Math.min(Math.floor(this.#debt), this.capacity - this.#alive);
            this.#debt -= Math.floor(this.#debt);
            for (let i = 0; i < emit; i++) this.spawn(world);
        }
        this.writeInstances(world);
    }
    private writeInstances(world: boolean): void {
        const state = this.#state, matrices = this.instanceMatrices, colors = this.instanceColors!;
        let inverse: Float32Array | undefined, sizeScale = 1;
        if (world) {
            // Instance matrices are relative to this node; undo its world transform.
            if (mat4Invert(scratchInverse, this.matrixWorld)) inverse = scratchInverse;
            sizeScale = 1 / (mat4MaxScaleOnAxis(this.matrixWorld) || 1);
        }
        const sr = this.startColor[0]!, sg = this.startColor[1]!, sb = this.startColor[2]!;
        const er = this.endColor[0]! - sr, eg = this.endColor[1]! - sg, eb = this.endColor[2]! - sb;
        for (let i = 0; i < this.#alive; i++) {
            const o = i * STRIDE, m = i * 16, k = state[o + 6]! / state[o + 7]!;
            let x = state[o]!, y = state[o + 1]!, z = state[o + 2]!;
            if (inverse) {
                const ix = inverse[0]! * x + inverse[4]! * y + inverse[8]! * z + inverse[12]!, iy = inverse[1]! * x + inverse[5]! * y + inverse[9]! * z + inverse[13]!;
                z = inverse[2]! * x + inverse[6]! * y + inverse[10]! * z + inverse[14]!; x = ix; y = iy;
            }
            const size = (this.startSize + (this.endSize - this.startSize) * k) * sizeScale;
            matrices[m] = size; matrices[m + 1] = 0; matrices[m + 2] = 0; matrices[m + 3] = 0;
            matrices[m + 4] = 0; matrices[m + 5] = size; matrices[m + 6] = 0; matrices[m + 7] = 0;
            matrices[m + 8] = 0; matrices[m + 9] = 0; matrices[m + 10] = size; matrices[m + 11] = 0;
            matrices[m + 12] = x; matrices[m + 13] = y; matrices[m + 14] = z; matrices[m + 15] = 1;
            const c = i * 4;
            colors[c] = sr + er * k; colors[c + 1] = sg + eg * k; colors[c + 2] = sb + eb * k;
            colors[c + 3] = this.startOpacity + (this.endOpacity - this.startOpacity) * k;
        }
        this.count = this.#alive;
        this.instanceVersion++;
    }
    /** Remove every particle and restart the random sequence and the duration timer. */
    reset(): void {
        this.#alive = 0; this.#debt = 0; this.#elapsed = 0; this.#random = this.#seed;
        this.count = 0;
        this.instanceVersion++;
    }
    override clone(): this {
        throw new World3DError('WORLD3D_INPUT_INVALID', 'a particle emitter cannot be cloned; create a new one from the same options');
    }
}

export function createParticleEmitter3D(options: ParticleEmitterOptions3D = {}): ParticleEmitter3D {
    return new ParticleEmitter3D(options);
}
