import { type Blending3D, type ColorInput3D } from './Material3D.js';
import { InstancedMesh3D } from './Mesh3D.js';
import type { Texture3D } from './Texture3D.js';
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
/**
 * An instanced, camera-facing quad per particle. The instance matrix slots
 * do not hold matrices: they carry each particle's start and birth time,
 * velocity and lifetime, and sizes and angles. Particles move with the
 * emitter's node. Call `update(deltaSeconds)` each frame, or set `time`.
 */
export declare class GpuParticles3D extends InstancedMesh3D {
    #private;
    readonly loop: boolean;
    /** Seconds until the last particle of a burst has died; Infinity for a stream. */
    readonly duration: number;
    readonly space: 'local' | 'world';
    /** Sort far to near before drawing. Disabling restores the logical instance order. */
    get sorted(): boolean;
    set sorted(value: boolean);
    constructor(options?: GpuParticlesOptions3D);
    /** Seconds since the emitter started. */
    get time(): number;
    set time(value: number);
    /** True once every particle of a burst has died. */
    get isFinished(): boolean;
    update(deltaSeconds: number): void;
    /** Where a particle is now, in the emitter's space, or in the world for world-space particles; false while it is not alive. */
    positionAt(index: number, out: number[] | Float32Array): boolean;
    private positionInSlot;
    /** Start a burst again from its first particle. */
    restart(): void;
    private slotOf;
    /** World mode: a particle starting a new life takes the emitter's place and heading of this moment. */
    private respawn;
    /** Before a draw: reorder the drawn arrays so the farthest particle comes first. */
    private arrange;
    private reorderSlots;
    private restoreOrder;
    /** Everywhere a particle can be during its life, in world space. */
    get worldBoundingSphere(): Float32Array;
    /** Release the geometry and the material. */
    dispose(): void;
}
export declare function createGpuParticles3D(options?: GpuParticlesOptions3D): GpuParticles3D;
export {};
//# sourceMappingURL=GpuParticles3D.d.ts.map