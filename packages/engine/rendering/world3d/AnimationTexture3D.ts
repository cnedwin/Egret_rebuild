// SPDX-License-Identifier: Apache-2.0
// Crowds of animated characters in one draw call. Clips are sampled once into
// a table of bone matrices per frame; each instance then only names the two
// frames it is between, and the vertex stage looks its bones up in the table.
// DOM-free: backends upload the table as a float texture or a storage buffer.
import {Resource3D, World3DError, requireCount3D, requireFinite3D, requirePositive3D} from './core3D.js';
import {type AnimationClip3D, sampleAnimationTrack3D} from './Animation3D.js';
import type {Geometry3D} from './Geometry3D.js';
import type {Material3D} from './Material3D.js';
import {InstancedMesh3D, type Mesh3D} from './Mesh3D.js';
import type {Object3D} from './Object3D.js';
import {mat4Invert, mat4Multiply} from './math3D.js';

export const ANIMATION_TEXTURE3D_LIMITS = Object.freeze({maxMatrices: 2097152, maxClips: 256, maxFps: 240} as const);

export interface BakedClip3D {
    readonly name: string;
    /** First frame of the clip in the table. */
    readonly start: number;
    /** Frames stored, first and last pose included. */
    readonly frames: number;
    readonly duration: number;
}

/**
 * Bone matrices of one skinned mesh for every frame of a set of clips: frame
 * after frame, `boneCount` matrices of 16 floats each. A matrix takes a
 * vertex from the mesh's bind pose to its posed place in the mesh's own space.
 */
export class AnimationTexture3D extends Resource3D {
    readonly boneCount: number;
    readonly frameCount: number;
    readonly fps: number;
    readonly data: Float32Array;
    readonly clips: readonly BakedClip3D[];
    /** Approximate reach from bone origins. It is not a conservative bound on the posed vertices. */
    readonly reach: number;

    constructor(boneCount: number, fps: number, data: Float32Array, clips: readonly BakedClip3D[], reach = 1) {
        super();
        this.boneCount = requireCount3D(boneCount, 'boneCount', 1024);
        this.fps = requirePositive3D(fps, 'fps');
        if (this.boneCount < 1 || !(data instanceof Float32Array) || data.length === 0 || data.length % (this.boneCount * 16) !== 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'animation texture data');
        if (data.length / 16 > ANIMATION_TEXTURE3D_LIMITS.maxMatrices) throw new World3DError('WORLD3D_BUDGET', 'animation texture matrices');
        this.data = data;
        this.frameCount = data.length / (this.boneCount * 16);
        requireCount3D(clips.length, 'clips', ANIMATION_TEXTURE3D_LIMITS.maxClips);
        for (const clip of clips) {
            if (!Number.isSafeInteger(clip.start) || !Number.isSafeInteger(clip.frames) || clip.start < 0 || clip.frames < 1 || clip.start + clip.frames > this.frameCount || !(clip.duration >= 0)) throw new World3DError('WORLD3D_INPUT_INVALID', 'baked clip range');
        }
        this.clips = Object.freeze(clips.map((clip) => Object.freeze({name: clip.name, start: clip.start, frames: clip.frames, duration: clip.duration})));
        this.reach = requirePositive3D(reach, 'reach');
    }
    /** Index of the clip with this name, or -1. */
    clipIndex(name: string): number { return this.clips.findIndex((clip) => clip.name === name); }
    /**
     * The two table frames around a time in a clip and the blend between
     * them, written to `out` as [first, second, blend].
     */
    framesAt(clip: number, time: number, loop: boolean, out: Float32Array | number[], offset = 0): void {
        const baked = this.clips[clip];
        if (!baked) throw new World3DError('WORLD3D_INPUT_INVALID', 'clip index');
        const last = baked.frames - 1;
        let at = 0;
        if (baked.duration > 0 && last > 0) {
            let t = time;
            if (loop) { t %= baked.duration; if (t < 0) t += baked.duration; } else t = t < 0 ? 0 : t > baked.duration ? baked.duration : t;
            at = t / baked.duration * last;
        }
        const first = Math.min(Math.floor(at), last);
        out[offset] = baked.start + first; out[offset + 1] = baked.start + Math.min(first + 1, last); out[offset + 2] = at - first;
    }
}

export interface BakeAnimationOptions3D {
    /** Poses stored per second of each clip. Default 30. */
    readonly fps?: number;
}

/**
 * Sample clips into an animation texture. `root` is the subtree the clips
 * animate, as for an AnimationMixer3D, and `mesh` the skinned mesh inside it
 * whose skeleton is baked. The subtree is posed while baking and put back as
 * it was. Only bone transforms are stored: morph weights are not.
 */
export function bakeAnimationTexture3D(root: Object3D, mesh: Mesh3D, clips: readonly AnimationClip3D[], options: BakeAnimationOptions3D = {}): AnimationTexture3D {
    const skeleton = mesh?.skeleton;
    if (!skeleton || skeleton.bones.length === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'bake needs a skinned mesh');
    if (!clips || clips.length === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'bake needs at least one clip');
    requireCount3D(clips.length, 'clips', ANIMATION_TEXTURE3D_LIMITS.maxClips);
    const fps = requirePositive3D(options.fps ?? 30, 'fps');
    if (fps > ANIMATION_TEXTURE3D_LIMITS.maxFps) throw new World3DError('WORLD3D_BUDGET', 'fps');
    const bones = skeleton.bones, boneCount = bones.length;
    const names = new Map<string, Object3D>();
    root.traverse((object) => { if (object.name && !names.has(object.name)) names.set(object.name, object); });
    const baked: BakedClip3D[] = [];
    let frameCount = 0;
    for (const clip of clips) {
        const frames = Math.max(1, Math.ceil(clip.duration * fps - 1e-6)) + 1;
        baked.push({name: clip.name, start: frameCount, frames, duration: clip.duration});
        frameCount += frames;
    }
    if (frameCount * boneCount > ANIMATION_TEXTURE3D_LIMITS.maxMatrices) throw new World3DError('WORLD3D_BUDGET', 'animation texture matrices');
    const data = new Float32Array(frameCount * boneCount * 16);
    // Remember every transform a clip may touch so the subtree can be put back.
    const saved = new Map<Object3D, Float32Array>();
    for (const clip of clips) for (const track of clip.tracks) {
        const target = names.get(track.targetName);
        if (target && !saved.has(target)) saved.set(target, Float32Array.of(...target.position, ...target.quaternion, ...target.scale));
    }
    const restore = (): void => {
        for (const [target, values] of saved) {
            target.position.set(values.subarray(0, 3)); target.quaternion.set(values.subarray(3, 7)); target.scale.set(values.subarray(7, 10));
            target.markTransformDirty();
        }
    };
    const scratch = new Float32Array(16), toMesh = new Float32Array(16), posed = new Float32Array(16), hint = {index: 0};
    const radius = Math.max(mesh.geometry.boundingSphere[3]!, 1e-6);
    let far = 0;
    try {
        clips.forEach((clip, clipIndex) => {
            const entry = baked[clipIndex]!;
            for (let frame = 0; frame < entry.frames; frame++) {
                // Every clip starts from the rest pose, so a track missing from one clip does not inherit another's.
                restore();
                const time = entry.frames > 1 ? frame / (entry.frames - 1) * clip.duration : 0;
                for (const track of clip.tracks) {
                    const target = names.get(track.targetName);
                    if (!target || track.path === 'weights') continue;
                    hint.index = 0;
                    sampleAnimationTrack3D(track, time, scratch, hint);
                    const to = track.path === 'position' ? target.position : track.path === 'quaternion' ? target.quaternion : target.scale;
                    for (let i = 0; i < to.length; i++) to[i] = scratch[i]!;
                    target.markTransformDirty();
                }
                root.updateWorldMatrices();
                mesh.updateWorldMatrix();
                if (!mat4Invert(toMesh, mesh.matrixWorld)) throw new World3DError('WORLD3D_INPUT_INVALID', 'mesh transform is singular');
                for (let bone = 0; bone < boneCount; bone++) {
                    const out = data.subarray(((entry.start + frame) * boneCount + bone) * 16, ((entry.start + frame) * boneCount + bone + 1) * 16);
                    mat4Multiply(posed, bones[bone]!.matrixWorld, skeleton.inverseBindMatrices.subarray(bone * 16, bone * 16 + 16));
                    mat4Multiply(posed, posed, mesh.bindMatrix);
                    mat4Multiply(out, toMesh, posed);
                    mat4Multiply(posed, toMesh, bones[bone]!.matrixWorld);
                    far = Math.max(far, Math.hypot(posed[12]!, posed[13]!, posed[14]!));
                }
            }
        });
    } finally {
        restore();
        root.updateWorldMatrices();
    }
    return new AnimationTexture3D(boneCount, fps, data, baked, Math.max(1, far / radius + 0.5));
}

export interface InstanceClipOptions3D {
    /** Where in the clip to start, in seconds. Default 0. */
    readonly time?: number;
    /** Playback rate; negative plays backwards. Default 1. */
    readonly speed?: number;
    /** Wrap around at the end instead of holding the last pose. Default true. */
    readonly loop?: boolean;
    /** Seconds to blend from the pose the instance is in now. Default 0. */
    readonly fade?: number;
}

/**
 * Many copies of one skinned mesh in a single draw call, each at its own
 * place in its own clip. The geometry needs `joints` and `weights`; the mesh
 * needs no skeleton, because poses come from the animation texture. Call
 * `update(deltaSeconds)` once per frame.
 */
export class SkinnedInstancedMesh3D extends InstancedMesh3D {
    readonly animations: AnimationTexture3D;
    /** Four floats per instance: first frame, second frame, blend, bone count. */
    readonly instanceAnimation: Float32Array;
    readonly #clip: Int32Array;
    readonly #time: Float32Array;
    readonly #speed: Float32Array;
    readonly #loop: Uint8Array;
    readonly #fadeFrom: Float32Array;
    readonly #fadeLeft: Float32Array;
    readonly #fadeTotal: Float32Array;

    constructor(geometry: Geometry3D, material: Material3D | Material3D[], animations: AnimationTexture3D, capacity: number, instanceColorSize: 3 | 4 = 3) {
        super(geometry, material, capacity, instanceColorSize);
        if (!(animations instanceof AnimationTexture3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'animations');
        if (!geometry.getAttribute('joints') || !geometry.getAttribute('weights')) throw new World3DError('WORLD3D_INPUT_INVALID', 'geometry needs joints and weights');
        this.animations = animations;
        this.boundsScale = animations.reach;
        this.frustumCulled = false;
        const n = this.capacity;
        this.instanceAnimation = new Float32Array(n * 4);
        this.#clip = new Int32Array(n); this.#time = new Float32Array(n); this.#speed = new Float32Array(n).fill(1); this.#loop = new Uint8Array(n).fill(1);
        this.#fadeFrom = new Float32Array(n); this.#fadeLeft = new Float32Array(n); this.#fadeTotal = new Float32Array(n);
        for (let i = 0; i < n; i++) this.write(i);
    }
    /** Play a clip, by index or name, on one instance. */
    setClipAt(index: number, clip: number | string, options: InstanceClipOptions3D = {}): void {
        this.check(index);
        const resolved = typeof clip === 'string' ? this.animations.clipIndex(clip) : clip;
        if (!Number.isSafeInteger(resolved) || resolved < 0 || resolved >= this.animations.clips.length) throw new World3DError('WORLD3D_INPUT_INVALID', 'clip');
        const fade = requireFinite3D(options.fade ?? 0, 'fade');
        if (fade > 0) {
            // Blend from the stored frame nearest to the pose shown now.
            const a = this.instanceAnimation, o = index * 4;
            this.#fadeFrom[index] = a[o + 2]! < 0.5 ? a[o]! : a[o + 1]!;
            this.#fadeLeft[index] = this.#fadeTotal[index] = fade;
        } else this.#fadeLeft[index] = 0;
        this.#clip[index] = resolved;
        this.#time[index] = requireFinite3D(options.time ?? 0, 'time');
        this.#speed[index] = requireFinite3D(options.speed ?? 1, 'speed');
        this.#loop[index] = options.loop === false ? 0 : 1;
        this.write(index);
        this.instanceVersion++;
    }
    clipAt(index: number): number { this.check(index); return this.#clip[index]!; }
    timeAt(index: number): number { this.check(index); return this.#time[index]!; }
    setTimeAt(index: number, seconds: number): void { this.check(index); this.#time[index] = requireFinite3D(seconds, 'time'); this.write(index); this.instanceVersion++; }
    setSpeedAt(index: number, speed: number): void { this.check(index); this.#speed[index] = requireFinite3D(speed, 'speed'); }
    /** True once a clip that does not loop has reached its end. */
    isFinishedAt(index: number): boolean {
        this.check(index);
        return this.#loop[index] === 0 && (this.#speed[index]! >= 0 ? this.#time[index]! >= this.animations.clips[this.#clip[index]!]!.duration : this.#time[index]! <= 0);
    }
    /** Advance every drawn instance by a time step in seconds. */
    update(deltaSeconds: number): void {
        const dt = requireFinite3D(deltaSeconds, 'deltaSeconds'), clips = this.animations.clips;
        for (let i = 0; i < this.count; i++) {
            const duration = clips[this.#clip[i]!]!.duration;
            let t = this.#time[i]! + dt * this.#speed[i]!;
            if (this.#loop[i]) { if (duration > 0) { t %= duration; if (t < 0) t += duration; } else t = 0; }
            else t = t < 0 ? 0 : t > duration ? duration : t;
            this.#time[i] = t;
            if (this.#fadeLeft[i]! > 0) this.#fadeLeft[i] = Math.max(0, this.#fadeLeft[i]! - Math.abs(dt));
            this.write(i);
        }
        this.instanceVersion++;
    }
    override clone(): this {
        const copy = new SkinnedInstancedMesh3D(this.geometry, this.material, this.animations, this.capacity, this.instanceColorSize) as this;
        copy.copyFrom(this);
        copy.count = this.count;
        copy.instanceMatrices.set(this.instanceMatrices);
        if (this.instanceColors) copy.instanceColors = this.instanceColors.slice();
        copy.#clip.set(this.#clip); copy.#time.set(this.#time); copy.#speed.set(this.#speed); copy.#loop.set(this.#loop);
        copy.#fadeFrom.set(this.#fadeFrom);
        copy.#fadeLeft.set(this.#fadeLeft);
        copy.#fadeTotal.set(this.#fadeTotal);
        copy.instanceAnimation.set(this.instanceAnimation);
        return copy;
    }
    private check(index: number): void {
        if (!Number.isSafeInteger(index) || index < 0 || index >= this.capacity) throw new World3DError('WORLD3D_INPUT_INVALID', 'instance index');
    }
    private write(index: number): void {
        const a = this.instanceAnimation, o = index * 4;
        this.animations.framesAt(this.#clip[index]!, this.#time[index]!, this.#loop[index] === 1, a, o);
        if (this.#fadeLeft[index]! > 0) {
            // While fading, the old pose is held and the new clip is taken at its nearest stored frame.
            a[o + 1] = a[o + 2]! < 0.5 ? a[o]! : a[o + 1]!;
            a[o] = this.#fadeFrom[index]!;
            a[o + 2] = 1 - this.#fadeLeft[index]! / this.#fadeTotal[index]!;
        }
        a[o + 3] = this.animations.boneCount;
    }
}
/** A baked skin can extend beyond the available sphere, including when a bone scales in place. */
export function worldRenderSphere3D(mesh: Mesh3D): Float32Array | undefined {
    return mesh instanceof SkinnedInstancedMesh3D ? undefined : mesh.worldBoundingSphere;
}

export function createSkinnedInstancedMesh3D(geometry: Geometry3D, material: Material3D | Material3D[], animations: AnimationTexture3D, capacity: number, instanceColorSize: 3 | 4 = 3): SkinnedInstancedMesh3D {
    return new SkinnedInstancedMesh3D(geometry, material, animations, capacity, instanceColorSize);
}
