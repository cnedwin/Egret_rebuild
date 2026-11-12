// SPDX-License-Identifier: Apache-2.0
// Particles whose motion is computed in the vertex stage. Every particle is
// given its birth time, start, velocity and look once; from then on the only
// thing that changes per frame is one number, the time. Hundreds of thousands
// of particles cost the CPU nothing, at the price of motion that must follow
// a formula: launch, gravity and drag, with no collisions and no forces that
// vary over time. DOM-free; both backends run the same formula.
import {World3DError, requireCount3D, requireFinite3D} from './core3D.js';
import {type Blending3D, type ColorInput3D, type CustomShader3D, createSpriteMaterial3D, setColor3D} from './Material3D.js';
import {InstancedMesh3D, MESH3D_LIMITS} from './Mesh3D.js';
import {sphereTransform} from './math3D.js';
import {createQuadGeometry3D} from './primitives3D.js';
import type {Texture3D} from './Texture3D.js';

type Range = number | readonly [number, number];
export interface GpuParticlesOptions3D {
    /** Number of particles. Default 10000. */
    readonly count?: number;
    /** Seconds each particle lives: a fixed value or a [min, max] range. Default 2. */
    readonly lifetime?: Range;
    /** Launch speed. Default 1. */
    readonly speed?: Range;
    /** Mean launch direction in the emitter's space. Default +Y. */
    readonly direction?: readonly [number, number, number];
    /** Half angle in radians of the cone around `direction`; PI launches in every direction. */
    readonly spread?: number;
    /** Constant acceleration in the emitter's space. */
    readonly gravity?: readonly [number, number, number];
    /** Fraction of velocity lost per second. */
    readonly drag?: number;
    readonly startSize?: Range;
    /** Size at the end of life as a multiple of the start size. Default 1. */
    readonly endScale?: number;
    /** Start angle of the sprite and its turn rate, in radians and radians per second. */
    readonly rotation?: Range;
    readonly spin?: Range;
    readonly startColor?: ColorInput3D;
    readonly endColor?: ColorInput3D;
    readonly startOpacity?: number;
    readonly endOpacity?: number;
    /** Shares of a particle's life spent fading in and out. Defaults: 0.1 and 0.3. */
    readonly fadeIn?: number;
    readonly fadeOut?: number;
    /** Volume particles start in: a point, a sphere of `radius`, or a box of half `extents`. */
    readonly shape?: 'point' | 'sphere' | 'box';
    readonly radius?: number;
    readonly extents?: readonly [number, number, number];
    /**
     * true: a steady stream, each particle reborn when its life ends, already
     * running at time 0. false: one burst, emitted over `duration` seconds.
     */
    readonly loop?: boolean;
    readonly duration?: number;
    readonly map?: Texture3D;
    readonly blending?: Blending3D;
    /** Distance over which particles fade where they meet solid geometry; 0 leaves hard edges. */
    readonly softness?: number;
    readonly seed?: number;
}

const pair = (value: Range | undefined, fallback: number, field: string): [number, number] => {
    if (value === undefined) return [fallback, fallback];
    if (typeof value === 'number') return [requireFinite3D(value, field), value];
    if (!Array.isArray(value) || value.length !== 2 || !(requireFinite3D(value[1], field) >= requireFinite3D(value[0], field))) throw new World3DError('WORLD3D_INPUT_INVALID', field);
    return [value[0]!, value[1]!];
};

/**
 * An instanced, camera-facing quad per particle. The instance matrix slots
 * do not hold matrices: they carry each particle's start and birth time,
 * velocity and lifetime, and sizes and angles. Particles move with the
 * emitter's node. Call `update(deltaSeconds)` each frame, or set `time`.
 */
export class GpuParticles3D extends InstancedMesh3D {
    readonly loop: boolean;
    /** Seconds until the last particle of a burst has died; Infinity for a stream. */
    readonly duration: number;
    readonly #uniforms: Float32Array;
    readonly #sphere = new Float32Array(4);
    readonly #worldSphere = new Float32Array(4);

    constructor(options: GpuParticlesOptions3D = {}) {
        const count = requireCount3D(options.count ?? 10000, 'count', MESH3D_LIMITS.maxInstances);
        const material = createSpriteMaterial3D({...(options.map ? {map: options.map} : {}), blending: options.blending ?? 'additive', depthWrite: false});
        super(createQuadGeometry3D(), material, count, 4);
        this.name = 'gpu-particles';
        this.castShadow = false;
        this.receiveShadow = false;
        const life = pair(options.lifetime, 2, 'lifetime'), speed = pair(options.speed, 1, 'speed'), size = pair(options.startSize, 0.2, 'startSize');
        const rotation = pair(options.rotation, 0, 'rotation'), spin = pair(options.spin, 0, 'spin');
        if (life[0] <= 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'lifetime');
        const endScale = requireFinite3D(options.endScale ?? 1, 'endScale'), spread = requireFinite3D(options.spread ?? Math.PI / 8, 'spread'), drag = requireFinite3D(options.drag ?? 0, 'drag');
        const gravity = options.gravity ?? [0, 0, 0], direction = options.direction ?? [0, 1, 0], shape = options.shape ?? 'point';
        const radius = requireFinite3D(options.radius ?? 0.5, 'radius'), extents = options.extents ?? [0.5, 0.5, 0.5];
        const dl = Math.hypot(direction[0], direction[1], direction[2]);
        if (dl < 1e-9 || drag < 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'direction and drag');
        const dx = direction[0] / dl, dy = direction[1] / dl, dz = direction[2] / dl;
        // Two axes perpendicular to the launch direction, for the cone.
        const ax = Math.abs(dy) < 0.99 ? [dz, 0, -dx] : [1, 0, 0], al = Math.hypot(ax[0]!, ax[1]!, ax[2]!), ux = ax[0]! / al, uy = ax[1]! / al, uz = ax[2]! / al;
        const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
        this.loop = options.loop ?? true;
        const emitOver = this.loop ? life[1] : requireFinite3D(options.duration ?? 0, 'duration');
        this.duration = this.loop ? Infinity : emitOver + life[1];
        const start = new Float32Array([1, 1, 1]), end = new Float32Array(3);
        if (options.startColor !== undefined) setColor3D(start, options.startColor);
        end.set(start);
        if (options.endColor !== undefined) setColor3D(end, options.endColor);
        const startOpacity = requireFinite3D(options.startOpacity ?? 1, 'startOpacity'), endOpacity = requireFinite3D(options.endOpacity ?? 1, 'endOpacity');
        let seed = (options.seed ?? 0x9e3779b9) >>> 0;
        const random = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        const data = this.instanceMatrices, colors = this.instanceColors = new Float32Array(count * 4);
        let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity, largest = 0;
        const grow = (x: number, y: number, z: number): void => { minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z); };
        for (let i = 0; i < count; i++) {
            const o = i * 16;
            let px = 0, py = 0, pz = 0;
            if (shape === 'sphere') {
                const z = random() * 2 - 1, turn = random() * Math.PI * 2, flat = Math.sqrt(1 - z * z), r = radius * Math.cbrt(random());
                px = Math.cos(turn) * flat * r; py = z * r; pz = Math.sin(turn) * flat * r;
            } else if (shape === 'box') { px = (random() * 2 - 1) * extents[0]; py = (random() * 2 - 1) * extents[1]; pz = (random() * 2 - 1) * extents[2]; }
            else if (shape !== 'point') throw new World3DError('WORLD3D_INPUT_INVALID', 'shape');
            // A direction spread evenly over the cap of the cone.
            const cosine = 1 - random() * (1 - Math.cos(Math.min(Math.max(spread, 0), Math.PI))), sine = Math.sqrt(Math.max(0, 1 - cosine * cosine)), turn = random() * Math.PI * 2;
            const sideU = Math.cos(turn) * sine, sideV = Math.sin(turn) * sine, launch = speed[0] + (speed[1] - speed[0]) * random();
            const lifetime = life[0] + (life[1] - life[0]) * random(), startSize = size[0] + (size[1] - size[0]) * random();
            const wx = (dx * cosine + ux * sideU + vx * sideV) * launch, wy = (dy * cosine + uy * sideU + vy * sideV) * launch, wz = (dz * cosine + uz * sideU + vz * sideV) * launch;
            data[o] = px; data[o + 1] = py; data[o + 2] = pz; data[o + 3] = emitOver > 0 ? (i + random()) / count * emitOver : 0;
            data[o + 4] = wx; data[o + 5] = wy; data[o + 6] = wz; data[o + 7] = lifetime;
            data[o + 8] = startSize; data[o + 9] = startSize * endScale; data[o + 10] = rotation[0] + (rotation[1] - rotation[0]) * random(); data[o + 11] = spin[0] + (spin[1] - spin[0]) * random();
            data[o + 12] = 0; data[o + 13] = 0; data[o + 14] = 0; data[o + 15] = 1;
            colors[i * 4] = start[0]!; colors[i * 4 + 1] = start[1]!; colors[i * 4 + 2] = start[2]!; colors[i * 4 + 3] = startOpacity;
            // Bounds: where the particle is at a few moments of its life.
            for (let step = 0; step <= 4; step++) {
                const t = lifetime * step / 4, travel = drag > 1e-4 ? (1 - Math.exp(-drag * t)) / drag : t;
                grow(px + wx * travel + gravity[0] * 0.5 * t * t, py + wy * travel + gravity[1] * 0.5 * t * t, pz + wz * travel + gravity[2] * 0.5 * t * t);
            }
            largest = Math.max(largest, startSize, startSize * endScale);
        }
        if (count > 0) {
            this.#sphere[0] = (minX + maxX) / 2; this.#sphere[1] = (minY + maxY) / 2; this.#sphere[2] = (minZ + maxZ) / 2;
            this.#sphere[3] = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 + largest;
        } else this.#sphere[3] = -1;
        this.instanceVersion++;
        const fadeIn = requireFinite3D(options.fadeIn ?? 0.1, 'fadeIn'), fadeOut = requireFinite3D(options.fadeOut ?? 0.3, 'fadeOut');
        // time, loop flag, fade in, fade out | gravity, drag | end color and opacity.
        this.#uniforms = new Float32Array([0, this.loop ? 1 : 0, fadeIn, fadeOut, gravity[0], gravity[1], gravity[2], drag, end[0]!, end[1]!, end[2]!, endOpacity, 0, 0, 0, 0]);
        const shader: CustomShader3D = Object.freeze({key: 'world3d-gpu-particles', uniforms: this.#uniforms});
        material.shader = shader;
        material.softness = requireFinite3D(options.softness ?? 0, 'softness');
    }
    /** Seconds since the emitter started. */
    get time(): number { return this.#uniforms[0]!; }
    set time(value: number) { this.#uniforms[0] = requireFinite3D(value, 'time'); }
    /** True once every particle of a burst has died. */
    get isFinished(): boolean { return this.#uniforms[0]! > this.duration; }
    update(deltaSeconds: number): void { this.#uniforms[0] = this.#uniforms[0]! + requireFinite3D(deltaSeconds, 'deltaSeconds'); }
    /** Start a burst again from its first particle. */
    restart(): void { this.#uniforms[0] = 0; }
    /** Everywhere a particle can be during its life, in world space. */
    override get worldBoundingSphere(): Float32Array {
        return sphereTransform(this.#worldSphere, this.#sphere, this.matrixWorld) as Float32Array;
    }
    /** Release the geometry and the material. */
    dispose(): void { this.geometry.dispose(); if (!Array.isArray(this.material)) this.material.dispose(); }
}
export function createGpuParticles3D(options: GpuParticlesOptions3D = {}): GpuParticles3D { return new GpuParticles3D(options); }
