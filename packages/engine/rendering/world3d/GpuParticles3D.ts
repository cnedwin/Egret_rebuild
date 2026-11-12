// SPDX-License-Identifier: Apache-2.0
// Particles whose motion is computed in the vertex stage. Every particle is
// given its birth time, start, velocity and look once; from then on the only
// thing that changes per frame is one number, the time. Hundreds of thousands
// of particles cost the CPU nothing, at the price of motion that must follow
// a formula: launch, gravity and drag, one bounce off a level floor, and no
// forces that vary over time. Two things cost the CPU a pass over the particles
// when asked for: leaving particles behind a moving emitter, and drawing them
// back to front. DOM-free; both backends run the same formula.
import {World3DError, requireCount3D, requireFinite3D} from './core3D.js';
import {type Blending3D, type ColorInput3D, type CustomShader3D, createSpriteMaterial3D, setColor3D} from './Material3D.js';
import type {Camera3D} from './Camera3D.js';
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
    /**
     * Height of a level floor particles bounce off once, in the emitter's
     * space, or in the world for world-space particles. With a floor, drag is
     * not applied.
     */
    readonly floor?: number;
    /** Share of its speed a particle keeps when it bounces. Default 0.4. */
    readonly bounce?: number;
    /**
     * 'local' (default) moves every particle with the emitter's node. 'world'
     * leaves particles where they were emitted, as smoke behind a moving
     * torch does; each update then looks at every particle to see whether it
     * was reborn.
     */
    readonly space?: 'local' | 'world';
    /** Draw far particles first, as alpha-blended smoke needs. Sorting runs on the CPU before every draw. */
    readonly sorted?: boolean;
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
    readonly space: 'local' | 'world';
    sorted: boolean;
    // What was generated, in the emitter's space; the drawn arrays are filled from it.
    readonly #source: Float32Array;
    // World mode: which life each particle is in, to notice when it is reborn.
    readonly #cycle: Float64Array | undefined;
    readonly #order: Uint32Array;
    readonly #depth: Float32Array;
    readonly #sphere = new Float32Array(4);
    readonly #worldSphere = new Float32Array(4);

    constructor(options: GpuParticlesOptions3D = {}) {
        const count = requireCount3D(options.count ?? 10000, 'count', MESH3D_LIMITS.maxInstances);
        const material = createSpriteMaterial3D({...(options.map ? {map: options.map} : {}), blending: options.blending ?? 'additive', depthWrite: false});
        super(createQuadGeometry3D(), material, count, 4);
        this.name = 'gpu-particles';
        this.pickable = false;
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
        this.space = options.space ?? 'local';
        if (this.space !== 'local' && this.space !== 'world') throw new World3DError('WORLD3D_INPUT_INVALID', 'space');
        this.sorted = options.sorted ?? false;
        this.#source = data.slice();
        this.#cycle = this.space === 'world' ? new Float64Array(count).fill(NaN) : undefined;
        this.#order = new Uint32Array(count); this.#depth = new Float32Array(count);
        // Particles left in the world can be anywhere the emitter has been.
        if (this.space === 'world') this.frustumCulled = false;
        const hasFloor = options.floor !== undefined, floor = requireFinite3D(options.floor ?? 0, 'floor'), bounce = requireFinite3D(options.bounce ?? 0.4, 'bounce');
        if (this.sorted || this.space === 'world') this.beforeRender = (camera: Camera3D) => this.arrange(camera);
        const fadeIn = requireFinite3D(options.fadeIn ?? 0.1, 'fadeIn'), fadeOut = requireFinite3D(options.fadeOut ?? 0.3, 'fadeOut');
        // time, loop flag, fade in, fade out | gravity, drag | end color and opacity.
        this.#uniforms = new Float32Array([0, this.loop ? 1 : 0, fadeIn, fadeOut, gravity[0], gravity[1], gravity[2], drag, end[0]!, end[1]!, end[2]!, endOpacity, this.space === 'world' ? 1 : 0, hasFloor ? 1 : 0, floor, bounce]);
        const shader: CustomShader3D = Object.freeze({key: 'world3d-gpu-particles', uniforms: this.#uniforms});
        material.shader = shader;
        material.softness = requireFinite3D(options.softness ?? 0, 'softness');
    }
    /** Seconds since the emitter started. */
    get time(): number { return this.#uniforms[0]!; }
    set time(value: number) { this.#uniforms[0] = requireFinite3D(value, 'time'); }
    /** True once every particle of a burst has died. */
    get isFinished(): boolean { return this.#uniforms[0]! > this.duration; }
    update(deltaSeconds: number): void {
        this.#uniforms[0] = this.#uniforms[0]! + requireFinite3D(deltaSeconds, 'deltaSeconds');
        if (this.#cycle) this.respawn();
    }
    /** Where a particle is now, in the emitter's space, or in the world for world-space particles; false while it is not alive. */
    positionAt(index: number, out: number[] | Float32Array): boolean {
        if (!Number.isSafeInteger(index) || index < 0 || index >= this.capacity) throw new World3DError('WORLD3D_INPUT_INVALID', 'particle index');
        const d = this.instanceMatrices, o = (this.sorted ? this.slotOf(index) : index) * 16, u = this.#uniforms, life = Math.max(d[o + 7]!, 1e-4);
        let t = u[0]! - d[o + 3]!, alive = true;
        if (this.loop) { t %= life; if (t < 0) t += life; } else alive = t >= 0 && t <= life;
        const drag = u[7]!, travel = drag > 1e-4 && u[13]! < 0.5 ? (1 - Math.exp(-drag * t)) / drag : t;
        out[0] = d[o]! + d[o + 4]! * travel + u[4]! * 0.5 * t * t; out[1] = d[o + 1]! + d[o + 5]! * travel + u[5]! * 0.5 * t * t; out[2] = d[o + 2]! + d[o + 6]! * travel + u[6]! * 0.5 * t * t;
        if (u[13]! > 0.5) {
            // The same single bounce the vertex stage computes.
            const a = 0.5 * u[5]!, b = d[o + 5]!, c = d[o + 1]! - u[14]!;
            let hit = -1;
            if (Math.abs(a) > 1e-6) { const root = b * b - 4 * a * c; if (root >= 0) hit = Math.max((-b - Math.sqrt(root)) / (2 * a), (-b + Math.sqrt(root)) / (2 * a)); } else if (b < 0) hit = -c / b;
            if (c >= 0 && hit > 0 && t > hit) {
                const k = u[15]!, since = t - hit;
                for (let axis = 0; axis < 3; axis++) {
                    const landed = d[o + axis]! + d[o + 4 + axis]! * hit + u[4 + axis]! * 0.5 * hit * hit, away = (d[o + 4 + axis]! + u[4 + axis]! * hit) * (axis === 1 ? -k : k);
                    out[axis] = landed + away * since + u[4 + axis]! * 0.5 * since * since;
                }
                out[1] = Math.max(out[1]!, u[14]!);
            }
        }
        return alive;
    }
    /** Start a burst again from its first particle. */
    restart(): void { this.#uniforms[0] = 0; this.#cycle?.fill(NaN); }
    private slotOf(index: number): number { return this.#slots ? this.#slots[index]! : index; }
    // Once sorted: the slot each particle currently sits in.
    #slots: Uint32Array | undefined;
    /** World mode: a particle starting a new life takes the emitter's place and heading of this moment. */
    private respawn(): void {
        const cycle = this.#cycle!, source = this.#source, out = this.instanceMatrices, time = this.#uniforms[0]!, m = this.matrixWorld;
        this.updateWorldMatrix();
        let changed = false;
        for (let i = 0; i < this.capacity; i++) {
            const o = i * 16, since = time - source[o + 3]!, life = Math.max(source[o + 7]!, 1e-4), now = this.loop ? Math.floor(since / life) : since >= 0 ? 0 : -1;
            if (now === cycle[i]) continue;
            cycle[i] = now;
            const x = source[o]!, y = source[o + 1]!, z = source[o + 2]!, vx = source[o + 4]!, vy = source[o + 5]!, vz = source[o + 6]!, to = this.sorted ? this.slotOf(i) * 16 : o;
            out[to] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!; out[to + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!; out[to + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
            out[to + 4] = m[0]! * vx + m[4]! * vy + m[8]! * vz; out[to + 5] = m[1]! * vx + m[5]! * vy + m[9]! * vz; out[to + 6] = m[2]! * vx + m[6]! * vy + m[10]! * vz;
            changed = true;
        }
        if (changed) this.instanceVersion++;
    }
    /** Before a draw: reorder the drawn arrays so the farthest particle comes first. */
    private arrange(camera: Camera3D): void {
        if (!this.sorted) return;
        const n = this.capacity, order = this.#order, depth = this.#depth, data = this.instanceMatrices, colors = this.instanceColors!, view = camera.viewMatrix, world = this.matrixWorld, point = [0, 0, 0];
        if (this.#sorting === undefined) { for (let i = 0; i < n; i++) order[i] = i; this.#sorting = {data: new Float32Array(n * 16), colors: new Float32Array(n * 4), next: new Uint32Array(n)}; }
        const scratch = this.#sorting, local = this.space === 'local';
        // Depth of every slot as it stands, then the slots in far-to-near order.
        const wasSorted = this.sorted; this.sorted = false;
        for (let slot = 0; slot < n; slot++) {
            this.positionAt(slot, point);
            let x = point[0]!, y = point[1]!, z = point[2]!;
            if (local) { const lx = x, ly = y, lz = z; x = world[0]! * lx + world[4]! * ly + world[8]! * lz + world[12]!; y = world[1]! * lx + world[5]! * ly + world[9]! * lz + world[13]!; z = world[2]! * lx + world[6]! * ly + world[10]! * lz + world[14]!; }
            depth[slot] = view[2]! * x + view[6]! * y + view[10]! * z + view[14]!;
        }
        this.sorted = wasSorted;
        const slots = scratch.next;
        for (let i = 0; i < n; i++) slots[i] = i;
        slots.sort((a, b) => depth[a]! - depth[b]!);
        scratch.data.set(data); scratch.colors.set(colors);
        for (let to = 0; to < n; to++) {
            const from = slots[to]!;
            data.set(scratch.data.subarray(from * 16, from * 16 + 16), to * 16);
            colors.set(scratch.colors.subarray(from * 4, from * 4 + 4), to * 4);
            scratch.next[to] = order[from]!;
        }
        // `next` held the slot order while it was read and now holds which particle sits in each slot.
        order.set(scratch.next);
        const where = this.#slots ??= new Uint32Array(n);
        for (let slot = 0; slot < n; slot++) where[order[slot]!] = slot;
        this.instanceVersion++;
    }
    #sorting: {data: Float32Array; colors: Float32Array; next: Uint32Array} | undefined;
    /** Everywhere a particle can be during its life, in world space. */
    override get worldBoundingSphere(): Float32Array {
        return sphereTransform(this.#worldSphere, this.#sphere, this.matrixWorld) as Float32Array;
    }
    /** Release the geometry and the material. */
    dispose(): void { this.geometry.dispose(); if (!Array.isArray(this.material)) this.material.dispose(); }
}
export function createGpuParticles3D(options: GpuParticlesOptions3D = {}): GpuParticles3D { return new GpuParticles3D(options); }
