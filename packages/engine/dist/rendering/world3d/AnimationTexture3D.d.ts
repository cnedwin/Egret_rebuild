import { Resource3D } from './core3D.js';
import { type AnimationClip3D } from './Animation3D.js';
import type { Geometry3D } from './Geometry3D.js';
import type { Material3D } from './Material3D.js';
import type { Camera3D } from './Camera3D.js';
import { InstancedMesh3D, type Mesh3D } from './Mesh3D.js';
import type { Object3D } from './Object3D.js';
export declare const ANIMATION_TEXTURE3D_LIMITS: Readonly<{
    readonly maxMatrices: 2097152;
    readonly maxClips: 256;
    readonly maxFps: 240;
}>;
export interface BakedClip3D {
    readonly name: string;
    /** First frame of the clip in the table. */
    readonly start: number;
    /** Frames stored, first and last pose included. */
    readonly frames: number;
    readonly duration: number;
}
/**
 * Bone matrices of one skinned mesh for every frame of a set of clips. The
 * table is a run of frames, each `stride` matrices of 16 floats: one per
 * bone, taking a vertex from the mesh's bind pose to its posed place in the
 * mesh's own space, and a last one whose 16 floats are the frame's morph
 * weights. Frame 0 is not a pose: its matrix for a bone holds, in the fourth
 * column, the point that bone turns about in the bind pose.
 */
export declare class AnimationTexture3D extends Resource3D {
    readonly boneCount: number;
    /** Matrices per frame: the bones and one for morph weights. */
    readonly stride: number;
    /** Morph targets whose weights are stored, at most 16. */
    readonly morphCount: number;
    readonly frameCount: number;
    readonly fps: number;
    readonly data: Float32Array;
    readonly clips: readonly BakedClip3D[];
    /** How far a bone travels from the mesh origin in any frame, relative to the geometry's bounding radius; instances widen their bounds by it. */
    readonly reach: number;
    constructor(boneCount: number, fps: number, data: Float32Array, clips: readonly BakedClip3D[], reach?: number, morphCount?: number);
    /** Index of the clip with this name, or -1. */
    clipIndex(name: string): number;
    /**
     * The two table frames around a time in a clip and the blend between
     * them, written to `out` as [first, second, blend].
     */
    framesAt(clip: number, time: number, loop: boolean, out: Float32Array | number[], offset?: number): void;
}
export interface BakeAnimationOptions3D {
    /** Poses stored per second of each clip. Default 30. */
    readonly fps?: number;
}
/**
 * Sample clips into an animation texture. `root` is the subtree the clips
 * animate, as for an AnimationMixer3D, and `mesh` the skinned mesh inside it
 * whose skeleton is baked. The subtree is posed while baking and put back as
 * it was. Bone transforms are stored, and the weights of the mesh's first 16
 * morph targets where a clip animates them.
 */
export declare function bakeAnimationTexture3D(root: Object3D, mesh: Mesh3D, clips: readonly AnimationClip3D[], options?: BakeAnimationOptions3D): AnimationTexture3D;
export interface InstanceClipOptions3D {
    /** Where in the clip to start, in seconds. Default 0. */
    readonly time?: number;
    /** Playback rate; negative plays backwards. Default 1. */
    readonly speed?: number;
    /** Wrap around at the end instead of holding the last pose. Default true. */
    readonly loop?: boolean;
    /** Seconds to cross-fade from the clip the instance is playing now, which keeps running while it fades. Default 0. */
    readonly fade?: number;
}
export interface InstanceBlendOptions3D {
    readonly time?: number;
    readonly speed?: number;
    readonly loop?: boolean;
    /** Keep the second clip at the same share of its length as the first, as for a walk blended into a run. Default true. */
    readonly sync?: boolean;
}
/**
 * Many copies of one skinned mesh in a single draw call, each at its own
 * place in its own clip. The geometry needs `joints` and `weights`; the mesh
 * needs no skeleton, because poses come from the animation texture. Call
 * `update(deltaSeconds)` once per frame.
 *
 * An instance plays one clip, optionally blended with a second at a weight
 * you set (walk into run) or cross-faded from the one before. One bone,
 * `lookBone`, can be given an extra rotation per instance, as for heads that
 * turn toward something. Before each draw the instances outside the camera's
 * view may be left out of the draw arrays. `count` and its alias `total`
 * remain the number of active instances, and `drawCount` reports the visible range.
 */
export declare class SkinnedInstancedMesh3D extends InstancedMesh3D {
    #private;
    readonly animations: AnimationTexture3D;
    /** Four floats per logical instance: first frame, second frame, blend and bone count. */
    get instanceAnimation(): Float32Array;
    /** Alias for the active instance count. */
    get total(): number;
    set total(value: number);
    /** Number of entries prepared for the current draw. */
    get drawCount(): number;
    /** Draw matrices in the prepared instance order. */
    get drawMatrices(): Float32Array;
    /** Draw colors in the prepared instance order. */
    get drawColors(): Float32Array | undefined;
    /** Packed GPU animation data in the prepared instance order. */
    get drawAnimation(): Float32Array;
    /** Enables view culling when a conservative posed radius is available. */
    cullInstances: boolean;
    /** Extra radius multiples retained around the view. Default 3. */
    cullPadding: number;
    /**
     * A sphere about the instance origin covering every used skin, morph and bone pose.
     * Without this authored bound, drawing keeps all instances.
     */
    get cullRadius(): number | undefined;
    set cullRadius(value: number | undefined);
    constructor(geometry: Geometry3D, material: Material3D | Material3D[], animations: AnimationTexture3D, capacity: number, instanceColorSize?: 3 | 4);
    /** The bone that per-instance rotations apply to, or -1. Vertices weighted to it turn about its joint; bones below it do not follow. */
    get lookBone(): number;
    set lookBone(bone: number);
    /** Extra rotation of the look bone for one instance, as a quaternion in the mesh's own axes. */
    setBoneRotationAt(index: number, x: number, y: number, z: number, w: number): void;
    /** Play a clip, by index or name, on one instance. */
    setClipAt(index: number, clip: number | string, options?: InstanceClipOptions3D): void;
    /**
     * Blend a second clip into an instance at a weight from 0 to 1, until
     * changed: 0.3 shows 70% of its clip and 30% of this one. A weight of 0
     * removes the second clip.
     */
    setBlendAt(index: number, clip: number | string, weight: number, options?: InstanceBlendOptions3D): void;
    clipAt(index: number): number;
    timeAt(index: number): number;
    /** Weight of the instance's second clip, 0 when it has none. */
    blendAt(index: number): number;
    setTimeAt(index: number, seconds: number): void;
    setSpeedAt(index: number, speed: number): void;
    /** True once a clip that does not loop has reached its end. */
    isFinishedAt(index: number): boolean;
    /** Advance every instance by a time step in seconds. */
    update(deltaSeconds: number): void;
    /**
     * Fill the drawn arrays from the instances a camera can see, or from all
     * of them without one. Rendering does this by itself.
     */
    compact(camera: Camera3D | undefined): void;
    clone(): this;
    private place;
    private resolve;
    private check;
    private write;
    private writeLegacy;
}
/** A baked skin can extend beyond the available sphere, including when a bone scales in place. */
export declare function worldRenderSphere3D(mesh: Mesh3D): Float32Array | undefined;
export declare function createSkinnedInstancedMesh3D(geometry: Geometry3D, material: Material3D | Material3D[], animations: AnimationTexture3D, capacity: number, instanceColorSize?: 3 | 4): SkinnedInstancedMesh3D;
//# sourceMappingURL=AnimationTexture3D.d.ts.map