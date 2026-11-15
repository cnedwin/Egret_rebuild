import type { Object3D } from './Object3D.js';
export type AnimationPath3D = 'position' | 'quaternion' | 'scale' | 'weights';
export type AnimationInterpolation3D = 'step' | 'linear' | 'cubic';
export type AnimationLoop3D = 'repeat' | 'once' | 'pingpong';
export declare const ANIMATION3D_LIMITS: Readonly<{
    readonly maxTracks: 4096;
    readonly maxKeys: 1048576;
    readonly maxActions: 256;
}>;
export interface AnimationTrackInput3D {
    /** Name of the animated node, resolved under the mixer root. */
    readonly targetName: string;
    readonly path: AnimationPath3D;
    /** Strictly increasing key times in seconds. */
    readonly times: ArrayLike<number>;
    /**
     * Key values, `size` numbers per key. Cubic tracks store in-tangent,
     * value and out-tangent for every key (3 * size numbers), as in glTF.
     */
    readonly values: ArrayLike<number>;
    readonly interpolation?: AnimationInterpolation3D;
}
export interface AnimationTrack3D {
    readonly targetName: string;
    readonly path: AnimationPath3D;
    readonly times: Float32Array;
    readonly values: Float32Array;
    readonly interpolation: AnimationInterpolation3D;
    /** Components per key: 3, 4, or the morph target count. */
    readonly size: number;
}
export declare class AnimationClip3D {
    readonly name: string;
    readonly tracks: readonly AnimationTrack3D[];
    readonly duration: number;
    constructor(name: string, tracks: readonly AnimationTrackInput3D[], duration?: number);
}
export declare function createAnimationClip3D(input: {
    readonly name?: string;
    readonly tracks: readonly AnimationTrackInput3D[];
    readonly duration?: number;
}): AnimationClip3D;
/** Evaluate one track at `time` into `out`; `hint` caches the last key index. */
export declare function sampleAnimationTrack3D(track: AnimationTrack3D, time: number, out: Float32Array, hint: {
    index: number;
}): void;
export declare class AnimationAction3D {
    #private;
    readonly clip: AnimationClip3D;
    /** Blend weight before fading is applied. */
    weight: number;
    timeScale: number;
    loop: AnimationLoop3D;
    /** Hold the last frame after a 'once' action ends instead of releasing the pose. */
    clampWhenFinished: boolean;
    paused: boolean;
    /** Invoked once when a non-repeating action reaches its end. */
    onFinished: ((action: AnimationAction3D) => void) | undefined;
    /** @internal Created by AnimationMixer3D.clipAction(). */
    constructor(clip: AnimationClip3D, bound: readonly unknown[]);
    get time(): number;
    set time(value: number);
    get isRunning(): boolean;
    /** Weight actually applied this frame, including any fade in progress. */
    get effectiveWeight(): number;
    play(): this;
    /** Stop contributing and rewind. */
    stop(): this;
    reset(): this;
    fadeIn(seconds: number): this;
    fadeOut(seconds: number): this;
    /** Fade this action out while fading `next` in over the same interval. */
    crossFadeTo(next: AnimationAction3D, seconds: number): this;
    private currentFade;
    private fade;
    /** @internal Advance time and add this action's samples to the property mixes. */
    advance(delta: number, scratch: Float32Array): void;
}
/** Plays clips on the subtree under `root`, blending concurrent actions by weight. */
export declare class AnimationMixer3D {
    #private;
    readonly root: Object3D;
    timeScale: number;
    constructor(root: Object3D);
    /** Create (or return the existing) action for a clip. Tracks whose target is missing are skipped. */
    clipAction(clip: AnimationClip3D): AnimationAction3D;
    /** Advance every running action by `deltaSeconds` and write the blended pose. */
    update(deltaSeconds: number): void;
    stopAll(): void;
    /** Stop every action and restore the pose captured when each property was first bound. */
    restorePose(): void;
    /** Forget an action so its clip can be collected. */
    uncache(clip: AnimationClip3D): void;
}
//# sourceMappingURL=Animation3D.d.ts.map