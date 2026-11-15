import type { Blending3D, ColorInput3D } from './Material3D.js';
import { InstancedMesh3D } from './Mesh3D.js';
import type { Texture3D } from './Texture3D.js';
export declare const PARTICLES3D_LIMITS: Readonly<{
    readonly maxParticles: 262144;
    readonly maxStepSeconds: 0.25;
}>;
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
export declare class ParticleEmitter3D extends InstancedMesh3D {
    #private;
    rate: number;
    readonly lifetime: [number, number];
    readonly speed: [number, number];
    readonly direction: Float32Array<ArrayBuffer>;
    spread: number;
    readonly gravity: Float32Array<ArrayBuffer>;
    drag: number;
    startSize: number;
    endSize: number;
    readonly startColor: Float32Array<ArrayBuffer>;
    readonly endColor: Float32Array<ArrayBuffer>;
    startOpacity: number;
    endOpacity: number;
    shape: ParticleShape3D;
    radius: number;
    readonly extents: Float32Array<ArrayBuffer>;
    readonly space: 'world' | 'local';
    duration: number;
    /** Emission is suspended while false; live particles keep simulating. */
    emitting: boolean;
    constructor(options?: ParticleEmitterOptions3D);
    /** Number of live particles. */
    get aliveCount(): number;
    /** Seconds simulated since construction or the last reset(). */
    get elapsedSeconds(): number;
    /** Uniform value in [0, 1) from a small deterministic generator (mulberry32). */
    private next;
    /** Emit `count` particles immediately, limited by the remaining capacity. */
    burst(count: number): number;
    private spawn;
    /** Advance the simulation and refresh the instance buffers. */
    update(deltaSeconds: number): void;
    private writeInstances;
    /** Remove every particle and restart the random sequence and the duration timer. */
    reset(): void;
    clone(): this;
}
export declare function createParticleEmitter3D(options?: ParticleEmitterOptions3D): ParticleEmitter3D;
//# sourceMappingURL=Particles3D.d.ts.map