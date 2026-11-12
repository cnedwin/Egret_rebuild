// SPDX-License-Identifier: Apache-2.0
// Crowds of animated characters in one draw call. Clips are sampled once into
// a table of bone matrices per frame; each instance then only names the two
// frames it is between, and the vertex stage looks its bones up in the table.
// DOM-free: backends upload the table as a float texture or a storage buffer.
import {Resource3D, World3DError, requireCount3D, requireFinite3D, requirePositive3D} from './core3D.js';
import {type AnimationClip3D, sampleAnimationTrack3D} from './Animation3D.js';
import type {Geometry3D} from './Geometry3D.js';
import type {Material3D} from './Material3D.js';
import type {Camera3D} from './Camera3D.js';
import {InstancedMesh3D, type Mesh3D} from './Mesh3D.js';
import type {Object3D} from './Object3D.js';
import {frustumIntersectsSphere, mat4Compose, mat4Identity, mat4Invert, mat4Multiply} from './math3D.js';

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
 * Bone matrices of one skinned mesh for every frame of a set of clips. The
 * table is a run of frames, each `stride` matrices of 16 floats: one per
 * bone, taking a vertex from the mesh's bind pose to its posed place in the
 * mesh's own space, and a last one whose 16 floats are the frame's morph
 * weights. Frame 0 is not a pose: its matrix for a bone holds, in the fourth
 * column, the point that bone turns about in the bind pose.
 */
export class AnimationTexture3D extends Resource3D {
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

    constructor(boneCount: number, fps: number, data: Float32Array, clips: readonly BakedClip3D[], reach = 1, morphCount = 0) {
        super();
        this.boneCount = requireCount3D(boneCount, 'boneCount', 1024);
        this.fps = requirePositive3D(fps, 'fps');
        this.stride = this.boneCount + 1;
        this.morphCount = requireCount3D(morphCount, 'morphCount', 16);
        if (this.boneCount < 1 || !(data instanceof Float32Array) || data.length < this.stride * 32 || data.length % (this.stride * 16) !== 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'animation texture data');
        if (data.length / 16 > ANIMATION_TEXTURE3D_LIMITS.maxMatrices) throw new World3DError('WORLD3D_BUDGET', 'animation texture matrices');
        this.data = data;
        this.frameCount = data.length / (this.stride * 16);
        requireCount3D(clips.length, 'clips', ANIMATION_TEXTURE3D_LIMITS.maxClips);
        for (const clip of clips) {
            if (!Number.isSafeInteger(clip.start) || !Number.isSafeInteger(clip.frames) || clip.start < 1 || clip.frames < 1 || clip.start + clip.frames > this.frameCount || !(clip.duration >= 0)) throw new World3DError('WORLD3D_INPUT_INVALID', 'baked clip range');
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
 * it was. Bone transforms are stored, and the weights of the mesh's first 16
 * morph targets where a clip animates them.
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
    // Frame 0 holds the bones' turning points; poses start at 1.
    let frameCount = 1;
    for (const clip of clips) {
        const frames = Math.max(1, Math.ceil(clip.duration * fps - 1e-6)) + 1;
        baked.push({name: clip.name, start: frameCount, frames, duration: clip.duration});
        frameCount += frames;
    }
    const stride = boneCount + 1, morphCount = Math.min(16, mesh.geometry.morphTargets.length);
    if (frameCount * stride > ANIMATION_TEXTURE3D_LIMITS.maxMatrices) throw new World3DError('WORLD3D_BUDGET', 'animation texture matrices');
    const data = new Float32Array(frameCount * stride * 16);
    mesh.syncMorphWeights();
    const restWeights = mesh.morphWeights.slice(0, morphCount);
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
    const scratch = new Float32Array(Math.max(16, mesh.geometry.morphTargets.length)), toMesh = new Float32Array(16), posed = new Float32Array(16), hint = {index: 0};
    // Turning points: where each bone sits in the bind pose, in the mesh's bind space.
    const fromSkeleton = new Float32Array(16);
    if (!mat4Invert(fromSkeleton, mesh.bindMatrix)) mat4Identity(fromSkeleton);
    for (let bone = 0; bone < stride; bone++) {
        const out = mat4Identity(data.subarray(bone * 16, bone * 16 + 16));
        if (bone < boneCount && mat4Invert(posed, skeleton.inverseBindMatrices.subarray(bone * 16, bone * 16 + 16))) {
            mat4Multiply(posed, fromSkeleton, posed);
            out[12] = posed[12]!; out[13] = posed[13]!; out[14] = posed[14]!;
        }
    }
    const radius = Math.max(mesh.geometry.boundingSphere[3]!, 1e-6);
    let far = 0;
    try {
        clips.forEach((clip, clipIndex) => {
            const entry = baked[clipIndex]!;
            for (let frame = 0; frame < entry.frames; frame++) {
                // Every clip starts from the rest pose, so a track missing from one clip does not inherit another's.
                restore();
                const time = entry.frames > 1 ? frame / (entry.frames - 1) * clip.duration : 0;
                const weights = data.subarray(((entry.start + frame) * stride + boneCount) * 16, ((entry.start + frame) * stride + boneCount + 1) * 16);
                weights.fill(0); weights.set(restWeights);
                for (const track of clip.tracks) {
                    const target = names.get(track.targetName);
                    if (!target) continue;
                    if (track.path === 'weights') {
                        // Only the baked mesh's own weights are kept.
                        if (target !== mesh || track.size > scratch.length) continue;
                        hint.index = 0;
                        sampleAnimationTrack3D(track, time, scratch, hint);
                        for (let i = 0; i < Math.min(track.size, morphCount); i++) weights[i] = scratch[i]!;
                        continue;
                    }
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
                    const out = data.subarray(((entry.start + frame) * stride + bone) * 16, ((entry.start + frame) * stride + bone + 1) * 16);
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
    return new AnimationTexture3D(boneCount, fps, data, baked, Math.max(1, far / radius + 0.5), morphCount);
}

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

const FLOATS = 12;   // per instance: two frames and a blend for each of two clips, and a bone rotation
const scratchSphere = new Float32Array(4);

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
 * view are left out; `instanceMatrices`, `instanceColors` and `count`
 * therefore describe what is drawn, and `total` the instances that exist.
 */
export class SkinnedInstancedMesh3D extends InstancedMesh3D {
    readonly animations: AnimationTexture3D;
    /** Twelve floats per drawn instance, written by update() and by culling. */
    readonly instanceAnimation: Float32Array;
    /** Instances that exist, drawn or not; at most `capacity`. */
    total: number;
    /** false draws every instance without testing it against the view. */
    cullInstances = true;
    /**
     * Instances this many bounding radii outside the view are still drawn, so
     * that their shadows can fall into it. Default 3.
     */
    cullPadding = 3;
    readonly #matrices: Float32Array;
    #colors: Float32Array | undefined;
    readonly #animation: Float32Array;
    readonly #clip: Int32Array;
    readonly #time: Float32Array;
    readonly #speed: Float32Array;
    readonly #loop: Uint8Array;
    // The second clip of each instance: -1 for none.
    readonly #clipB: Int32Array;
    readonly #timeB: Float32Array;
    readonly #speedB: Float32Array;
    readonly #flagsB: Uint8Array;     // bit 0: loop, bit 1: follow the first clip's phase
    readonly #weightB: Float32Array;
    readonly #fadeRate: Float32Array; // weight lost per second while cross-fading, 0 for a blend that stays
    #lookBone = -1;

    constructor(geometry: Geometry3D, material: Material3D | Material3D[], animations: AnimationTexture3D, capacity: number, instanceColorSize: 3 | 4 = 3) {
        super(geometry, material, capacity, instanceColorSize);
        if (!(animations instanceof AnimationTexture3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'animations');
        if (!geometry.getAttribute('joints') || !geometry.getAttribute('weights')) throw new World3DError('WORLD3D_INPUT_INVALID', 'geometry needs joints and weights');
        this.animations = animations;
        this.boundsScale = animations.reach;
        const n = this.capacity;
        this.total = n;
        this.instanceAnimation = new Float32Array(n * FLOATS);
        this.#matrices = this.instanceMatrices.slice();
        this.#animation = new Float32Array(n * FLOATS);
        this.#clip = new Int32Array(n); this.#time = new Float32Array(n); this.#speed = new Float32Array(n).fill(1); this.#loop = new Uint8Array(n).fill(1);
        this.#clipB = new Int32Array(n).fill(-1); this.#timeB = new Float32Array(n); this.#speedB = new Float32Array(n).fill(1); this.#flagsB = new Uint8Array(n);
        this.#weightB = new Float32Array(n); this.#fadeRate = new Float32Array(n);
        for (let i = 0; i < n; i++) { this.#animation[i * FLOATS + 11] = 1; this.write(i); }
        this.compact(undefined);
        this.beforeRender = (camera: Camera3D) => this.compact(this.cullInstances ? camera : undefined);
    }
    /** The bone that per-instance rotations apply to, or -1. Vertices weighted to it turn about its joint; bones below it do not follow. */
    get lookBone(): number { return this.#lookBone; }
    set lookBone(bone: number) {
        if (!Number.isSafeInteger(bone) || bone < -1 || bone >= this.animations.boneCount) throw new World3DError('WORLD3D_INPUT_INVALID', 'lookBone');
        this.#lookBone = bone;
        for (let i = 0; i < this.capacity; i++) this.write(i);
        this.compact(undefined);
    }
    /** Extra rotation of the look bone for one instance, as a quaternion in the mesh's own axes. */
    setBoneRotationAt(index: number, x: number, y: number, z: number, w: number): void {
        this.check(index);
        const o = index * FLOATS + 8, length = Math.hypot(x, y, z, w);
        if (!(length > 1e-9)) throw new World3DError('WORLD3D_INPUT_INVALID', 'rotation');
        this.#animation[o] = x / length; this.#animation[o + 1] = y / length; this.#animation[o + 2] = z / length; this.#animation[o + 3] = w / length;
    }
    override setMatrixAt(index: number, matrix: ArrayLike<number>): void {
        this.check(index);
        for (let i = 0; i < 16; i++) this.#matrices[index * 16 + i] = matrix[i]!;
    }
    override setTransformAt(index: number, position: ArrayLike<number>, quaternion: ArrayLike<number> = [0, 0, 0, 1], scale: ArrayLike<number> | number = 1): void {
        this.check(index);
        mat4Compose(this.#matrices.subarray(index * 16, index * 16 + 16), position, quaternion, typeof scale === 'number' ? [scale, scale, scale] : scale);
    }
    override setColorAt(index: number, r: number, g: number, b: number, a = 1): void {
        this.check(index);
        const size = this.instanceColorSize, colors = this.#colors ??= new Float32Array(this.capacity * size).fill(1);
        this.instanceColors ??= new Float32Array(this.capacity * size).fill(1);
        colors[index * size] = r; colors[index * size + 1] = g; colors[index * size + 2] = b;
        if (size === 4) colors[index * size + 3] = a;
    }
    /** Play a clip, by index or name, on one instance. */
    setClipAt(index: number, clip: number | string, options: InstanceClipOptions3D = {}): void {
        this.check(index);
        const resolved = this.resolve(clip), fade = requireFinite3D(options.fade ?? 0, 'fade');
        if (fade > 0) {
            // The clip playing now becomes the second one and runs on while its weight drops to nothing.
            this.#clipB[index] = this.#clip[index]!; this.#timeB[index] = this.#time[index]!; this.#speedB[index] = this.#speed[index]!;
            this.#flagsB[index] = this.#loop[index]!; this.#weightB[index] = 1; this.#fadeRate[index] = 1 / fade;
        } else if (this.#fadeRate[index]! > 0) { this.#clipB[index] = -1; this.#weightB[index] = 0; this.#fadeRate[index] = 0; }
        this.#clip[index] = resolved;
        this.#time[index] = requireFinite3D(options.time ?? 0, 'time');
        this.#speed[index] = requireFinite3D(options.speed ?? 1, 'speed');
        this.#loop[index] = options.loop === false ? 0 : 1;
        this.write(index);
    }
    /**
     * Blend a second clip into an instance at a weight from 0 to 1, until
     * changed: 0.3 shows 70% of its clip and 30% of this one. A weight of 0
     * removes the second clip.
     */
    setBlendAt(index: number, clip: number | string, weight: number, options: InstanceBlendOptions3D = {}): void {
        this.check(index);
        const amount = requireFinite3D(weight, 'weight');
        if (amount < 0 || amount > 1) throw new World3DError('WORLD3D_INPUT_INVALID', 'weight');
        if (amount === 0) { this.#clipB[index] = -1; this.#weightB[index] = 0; this.#fadeRate[index] = 0; this.write(index); return; }
        const resolved = this.resolve(clip);
        if (this.#clipB[index] !== resolved || this.#fadeRate[index]! > 0) { this.#clipB[index] = resolved; this.#timeB[index] = requireFinite3D(options.time ?? 0, 'time'); }
        this.#speedB[index] = requireFinite3D(options.speed ?? 1, 'speed');
        this.#flagsB[index] = (options.loop === false ? 0 : 1) | (options.sync === false ? 0 : 2);
        this.#weightB[index] = amount; this.#fadeRate[index] = 0;
        this.write(index);
    }
    clipAt(index: number): number { this.check(index); return this.#clip[index]!; }
    timeAt(index: number): number { this.check(index); return this.#time[index]!; }
    /** Weight of the instance's second clip, 0 when it has none. */
    blendAt(index: number): number { this.check(index); return this.#clipB[index]! < 0 ? 0 : this.#weightB[index]!; }
    setTimeAt(index: number, seconds: number): void { this.check(index); this.#time[index] = requireFinite3D(seconds, 'time'); this.write(index); }
    setSpeedAt(index: number, speed: number): void { this.check(index); this.#speed[index] = requireFinite3D(speed, 'speed'); }
    /** True once a clip that does not loop has reached its end. */
    isFinishedAt(index: number): boolean {
        this.check(index);
        return this.#loop[index] === 0 && (this.#speed[index]! >= 0 ? this.#time[index]! >= this.animations.clips[this.#clip[index]!]!.duration : this.#time[index]! <= 0);
    }
    /** Advance every instance by a time step in seconds. */
    update(deltaSeconds: number): void {
        const dt = requireFinite3D(deltaSeconds, 'deltaSeconds'), clips = this.animations.clips;
        const step = (time: number, by: number, duration: number, loop: boolean): number => {
            let t = time + by;
            if (loop) { if (duration > 0) { t %= duration; if (t < 0) t += duration; } else t = 0; } else t = t < 0 ? 0 : t > duration ? duration : t;
            return t;
        };
        for (let i = 0; i < Math.min(this.total, this.capacity); i++) {
            const duration = clips[this.#clip[i]!]!.duration;
            this.#time[i] = step(this.#time[i]!, dt * this.#speed[i]!, duration, this.#loop[i] === 1);
            const second = this.#clipB[i]!;
            if (second >= 0) {
                const other = clips[second]!.duration, flags = this.#flagsB[i]!;
                // A synced clip sits at the same share of its length as the first.
                if (flags & 2) this.#timeB[i] = duration > 0 ? this.#time[i]! / duration * other : 0;
                else this.#timeB[i] = step(this.#timeB[i]!, dt * this.#speedB[i]!, other, (flags & 1) === 1);
                if (this.#fadeRate[i]! > 0) {
                    this.#weightB[i] = this.#weightB[i]! - this.#fadeRate[i]! * Math.abs(dt);
                    if (this.#weightB[i]! <= 0) { this.#clipB[i] = -1; this.#weightB[i] = 0; this.#fadeRate[i] = 0; }
                }
            }
            this.write(i);
        }
        this.compact(undefined);
    }
    /**
     * Fill the drawn arrays from the instances a camera can see, or from all
     * of them without one. Rendering does this by itself.
     */
    compact(camera: Camera3D | undefined): void {
        const total = Math.min(this.total, this.capacity), size = this.instanceColorSize, colors = this.#colors, out = this.instanceMatrices, m = this.#matrices;
        let drawn = 0;
        if (camera) {
            this.updateWorldMatrix();
            const base = this.geometry.boundingSphere, world = this.matrixWorld, sphere = scratchSphere, reach = base[3]! * this.boundsScale * (1 + this.cullPadding);
            const ws = Math.sqrt(Math.max(world[0]! ** 2 + world[1]! ** 2 + world[2]! ** 2, world[4]! ** 2 + world[5]! ** 2 + world[6]! ** 2, world[8]! ** 2 + world[9]! ** 2 + world[10]! ** 2));
            for (let i = 0; i < total; i++) {
                const o = i * 16;
                // The instance's center in the mesh's space, then in the world.
                const x = m[o]! * base[0]! + m[o + 4]! * base[1]! + m[o + 8]! * base[2]! + m[o + 12]!, y = m[o + 1]! * base[0]! + m[o + 5]! * base[1]! + m[o + 9]! * base[2]! + m[o + 13]!, z = m[o + 2]! * base[0]! + m[o + 6]! * base[1]! + m[o + 10]! * base[2]! + m[o + 14]!;
                sphere[0] = world[0]! * x + world[4]! * y + world[8]! * z + world[12]!; sphere[1] = world[1]! * x + world[5]! * y + world[9]! * z + world[13]!; sphere[2] = world[2]! * x + world[6]! * y + world[10]! * z + world[14]!;
                sphere[3] = reach * ws * Math.sqrt(Math.max(m[o]! ** 2 + m[o + 1]! ** 2 + m[o + 2]! ** 2, m[o + 4]! ** 2 + m[o + 5]! ** 2 + m[o + 6]! ** 2, m[o + 8]! ** 2 + m[o + 9]! ** 2 + m[o + 10]! ** 2));
                if (frustumIntersectsSphere(camera.frustum, sphere)) this.place(drawn++, i, size, colors);
            }
        } else {
            out.set(m.subarray(0, total * 16));
            this.instanceAnimation.set(this.#animation.subarray(0, total * FLOATS));
            if (colors) this.instanceColors!.set(colors.subarray(0, total * size));
            drawn = total;
        }
        this.count = drawn;
        this.instanceVersion++;
    }
    override clone(): this {
        const copy = new SkinnedInstancedMesh3D(this.geometry, this.material, this.animations, this.capacity, this.instanceColorSize) as this;
        copy.copyFrom(this);
        copy.total = this.total; copy.cullInstances = this.cullInstances; copy.cullPadding = this.cullPadding;
        copy.#matrices.set(this.#matrices); copy.#animation.set(this.#animation);
        if (this.#colors) { copy.#colors = this.#colors.slice(); copy.instanceColors = this.#colors.slice(); }
        copy.#clip.set(this.#clip); copy.#time.set(this.#time); copy.#speed.set(this.#speed); copy.#loop.set(this.#loop);
        copy.#clipB.set(this.#clipB); copy.#timeB.set(this.#timeB); copy.#speedB.set(this.#speedB); copy.#flagsB.set(this.#flagsB); copy.#weightB.set(this.#weightB); copy.#fadeRate.set(this.#fadeRate);
        copy.#lookBone = this.#lookBone;
        copy.compact(undefined);
        return copy;
    }
    private place(slot: number, index: number, size: number, colors: Float32Array | undefined): void {
        this.instanceMatrices.set(this.#matrices.subarray(index * 16, index * 16 + 16), slot * 16);
        this.instanceAnimation.set(this.#animation.subarray(index * FLOATS, index * FLOATS + FLOATS), slot * FLOATS);
        if (colors) this.instanceColors!.set(colors.subarray(index * size, index * size + size), slot * size);
    }
    private resolve(clip: number | string): number {
        const resolved = typeof clip === 'string' ? this.animations.clipIndex(clip) : clip;
        if (!Number.isSafeInteger(resolved) || resolved < 0 || resolved >= this.animations.clips.length) throw new World3DError('WORLD3D_INPUT_INVALID', 'clip');
        return resolved;
    }
    private check(index: number): void {
        if (!Number.isSafeInteger(index) || index < 0 || index >= this.capacity) throw new World3DError('WORLD3D_INPUT_INVALID', 'instance index');
    }
    private write(index: number): void {
        const a = this.#animation, o = index * FLOATS, second = this.#clipB[index]!;
        this.animations.framesAt(this.#clip[index]!, this.#time[index]!, this.#loop[index] === 1, a, o);
        // The fourth float carries two numbers every instance shares: matrices per frame and the look bone.
        a[o + 3] = this.animations.stride + 2048 * (this.#lookBone + 1);
        if (second >= 0) { this.animations.framesAt(second, this.#timeB[index]!, (this.#flagsB[index]! & 1) === 1, a, o + 4); a[o + 7] = this.#weightB[index]!; }
        else { a[o + 4] = a[o]!; a[o + 5] = a[o + 1]!; a[o + 6] = 0; a[o + 7] = 0; }
    }
}
export function createSkinnedInstancedMesh3D(geometry: Geometry3D, material: Material3D | Material3D[], animations: AnimationTexture3D, capacity: number, instanceColorSize: 3 | 4 = 3): SkinnedInstancedMesh3D {
    return new SkinnedInstancedMesh3D(geometry, material, animations, capacity, instanceColorSize);
}
