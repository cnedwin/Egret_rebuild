// SPDX-License-Identifier: Apache-2.0
// Keyframe animation: tracks, clips and a mixer that blends any number of
// weighted actions onto a node hierarchy. Time is explicit; the mixer never
// reads a clock, so callers drive it from the Engine game clock.
import { World3DError, requireCount3D, requireFinite3D } from './core3D.js';
import { quatNormalize, quatSlerp } from './math3D.js';
import { Mesh3D } from './Mesh3D.js';
export const ANIMATION3D_LIMITS = Object.freeze({ maxTracks: 4096, maxKeys: 1048576, maxActions: 256 });
export class AnimationClip3D {
    name;
    tracks;
    duration;
    constructor(name, tracks, duration) {
        if (typeof name !== 'string')
            throw new World3DError('WORLD3D_INPUT_INVALID', 'clip name');
        requireCount3D(tracks.length, 'tracks', ANIMATION3D_LIMITS.maxTracks);
        let end = 0;
        this.tracks = Object.freeze(tracks.map(input => {
            const times = Float32Array.from(input.times), values = Float32Array.from(input.values);
            const interpolation = input.interpolation ?? 'linear';
            requireCount3D(times.length, 'keys', ANIMATION3D_LIMITS.maxKeys);
            if (times.length === 0 || typeof input.targetName !== 'string')
                throw new World3DError('WORLD3D_INPUT_INVALID', 'track');
            for (let i = 0; i < times.length; i++) {
                if (!Number.isFinite(times[i]) || times[i] < 0 || (i > 0 && times[i] <= times[i - 1]))
                    throw new World3DError('WORLD3D_INPUT_INVALID', 'track times');
            }
            const perKey = values.length / times.length / (interpolation === 'cubic' ? 3 : 1);
            const fixed = input.path === 'quaternion' ? 4 : input.path === 'weights' ? perKey : 3;
            if (!Number.isSafeInteger(perKey) || perKey < 1 || perKey !== fixed)
                throw new World3DError('WORLD3D_INPUT_INVALID', 'track values');
            end = Math.max(end, times[times.length - 1]);
            return Object.freeze({
                targetName: input.targetName,
                path: input.path,
                times,
                values,
                interpolation,
                size: perKey
            });
        }));
        this.name = name;
        this.duration = duration === undefined ? end : requireFinite3D(duration, 'clip duration');
    }
}
export function createAnimationClip3D(input) {
    return new AnimationClip3D(input.name ?? '', input.tracks, input.duration);
}
/** Evaluate one track at `time` into `out`; `hint` caches the last key index. */
export function sampleAnimationTrack3D(track, time, out, hint) {
    const times = track.times, values = track.values, size = track.size, last = times.length - 1;
    const cubic = track.interpolation === 'cubic', stride = cubic ? size * 3 : size, valueOffset = cubic ? size : 0;
    if (time <= times[0] || last === 0) {
        for (let i = 0; i < size; i++)
            out[i] = values[valueOffset + i];
        return;
    }
    if (time >= times[last]) {
        for (let i = 0; i < size; i++)
            out[i] = values[last * stride + valueOffset + i];
        return;
    }
    // Playback usually advances monotonically: try the cached interval, then
    // its successor, before falling back to binary search.
    let index = hint.index;
    if (!(index >= 0 && index < last && times[index] <= time && time < times[index + 1])) {
        if (index + 1 < last && times[index + 1] <= time && time < times[index + 2])
            index++;
        else {
            let low = 0, high = last;
            while (high - low > 1) {
                const middle = (low + high) >> 1;
                if (times[middle] <= time)
                    low = middle;
                else
                    high = middle;
            }
            index = low;
        }
        hint.index = index;
    }
    const t0 = times[index], span = times[index + 1] - t0, t = (time - t0) / span;
    const a = index * stride + valueOffset, b = a + stride;
    if (track.interpolation === 'step') {
        for (let i = 0; i < size; i++)
            out[i] = values[a + i];
    }
    else if (cubic) {
        // Hermite spline with glTF tangents scaled by the key interval.
        const t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = (t3 - 2 * t2 + t) * span, h01 = -2 * t3 + 3 * t2, h11 = (t3 - t2) * span;
        for (let i = 0; i < size; i++) {
            out[i] = h00 * values[a + i] + h10 * values[a + size + i] + h01 * values[b + i] + h11 * values[b - size + i];
        }
        if (track.path === 'quaternion')
            quatNormalize(out, out);
    }
    else if (track.path === 'quaternion') {
        quatSlerp(out, values.subarray(a, a + 4), values.subarray(b, b + 4), t);
    }
    else {
        for (let i = 0; i < size; i++)
            out[i] = values[a + i] + (values[b + i] - values[a + i]) * t;
    }
}
/** Accumulates weighted samples for one animated property of one node. */
class PropertyMix {
    target;
    path;
    size;
    accumulated;
    rest;
    weight = 0;
    constructor(target, path, size) {
        this.target = target;
        this.path = path;
        this.size = size;
        this.accumulated = new Float32Array(size);
        this.rest = Float32Array.from(this.storage());
    }
    storage() {
        const target = this.target;
        if (this.path === 'position')
            return target.position;
        if (this.path === 'quaternion')
            return target.quaternion;
        if (this.path === 'scale')
            return target.scale;
        return target.morphWeights;
    }
    add(sample, weight) {
        const accumulated = this.accumulated, size = this.size;
        if (this.weight === 0) {
            for (let i = 0; i < size; i++)
                accumulated[i] = sample[i] * weight;
        }
        else if (this.path === 'quaternion') {
            // Keep both rotations in the same hemisphere before the weighted sum.
            const sign = accumulated[0] * sample[0] +
                accumulated[1] * sample[1] +
                accumulated[2] * sample[2] +
                accumulated[3] * sample[3] <
                0
                ? -weight
                : weight;
            for (let i = 0; i < 4; i++)
                accumulated[i] += sample[i] * sign;
        }
        else {
            for (let i = 0; i < size; i++)
                accumulated[i] += sample[i] * weight;
        }
        this.weight += weight;
    }
    /** Write the blended value; missing weight is filled from the rest pose. */
    apply() {
        const weight = this.weight;
        if (weight === 0)
            return;
        const accumulated = this.accumulated, storage = this.storage(), size = Math.min(this.size, storage.length);
        if (weight < 1)
            this.add(this.rest, 1 - weight);
        const total = this.weight;
        if (this.path === 'quaternion')
            quatNormalize(storage, accumulated);
        else
            for (let i = 0; i < size; i++)
                storage[i] = accumulated[i] / total;
        if (this.path !== 'weights')
            this.target.markTransformDirty();
        this.weight = 0;
    }
    restore() {
        this.storage().set(this.rest.subarray(0, this.storage().length));
        if (this.path !== 'weights')
            this.target.markTransformDirty();
    }
}
export class AnimationAction3D {
    clip;
    /** Blend weight before fading is applied. */
    weight = 1;
    timeScale = 1;
    loop = 'repeat';
    /** Hold the last frame after a 'once' action ends instead of releasing the pose. */
    clampWhenFinished = false;
    paused = false;
    /** Invoked once when a non-repeating action reaches its end. */
    onFinished;
    #time = 0;
    #running = false;
    #direction = 1;
    #fadeFrom = 1;
    #fadeTo = 1;
    #fadeDuration = 0;
    #fadeElapsed = 0;
    #bound;
    /** @internal Created by AnimationMixer3D.clipAction(). */
    constructor(clip, bound) {
        this.clip = clip;
        this.#bound = bound;
    }
    get time() {
        return this.#time;
    }
    set time(value) {
        this.#time = Math.max(0, Math.min(this.clip.duration, requireFinite3D(value, 'time')));
    }
    get isRunning() {
        return this.#running;
    }
    /** Weight actually applied this frame, including any fade in progress. */
    get effectiveWeight() {
        if (!this.#running)
            return 0;
        const fade = this.#fadeDuration > 0
            ? this.#fadeFrom + (this.#fadeTo - this.#fadeFrom) * Math.min(1, this.#fadeElapsed / this.#fadeDuration)
            : this.#fadeTo;
        return this.weight * fade;
    }
    play() {
        this.#running = true;
        return this;
    }
    /** Stop contributing and rewind. */
    stop() {
        this.#running = false;
        return this.reset();
    }
    reset() {
        this.#time = 0;
        this.#direction = 1;
        this.paused = false;
        this.#fadeFrom = this.#fadeTo = 1;
        this.#fadeDuration = this.#fadeElapsed = 0;
        return this;
    }
    fadeIn(seconds) {
        return this.fade(0, 1, seconds);
    }
    fadeOut(seconds) {
        return this.fade(this.currentFade(), 0, seconds);
    }
    /** Fade this action out while fading `next` in over the same interval. */
    crossFadeTo(next, seconds) {
        this.fadeOut(seconds);
        next.reset().play().fadeIn(seconds);
        return this;
    }
    currentFade() {
        return this.#fadeDuration > 0
            ? this.#fadeFrom + (this.#fadeTo - this.#fadeFrom) * Math.min(1, this.#fadeElapsed / this.#fadeDuration)
            : this.#fadeTo;
    }
    fade(from, to, seconds) {
        this.#fadeFrom = from;
        this.#fadeTo = to;
        this.#fadeDuration = Math.max(0, requireFinite3D(seconds, 'fade seconds'));
        this.#fadeElapsed = 0;
        if (this.#fadeDuration === 0)
            this.#fadeFrom = to;
        return this;
    }
    /** @internal Advance time and add this action's samples to the property mixes. */
    advance(delta, scratch) {
        if (!this.#running)
            return;
        const duration = this.clip.duration;
        let finished = false;
        if (!this.paused) {
            if (this.#fadeDuration > 0) {
                this.#fadeElapsed += Math.abs(delta);
                // A completed fade-out retires the action.
                if (this.#fadeElapsed >= this.#fadeDuration && this.#fadeTo === 0) {
                    this.#running = false;
                    return;
                }
            }
            let time = this.#time + delta * this.timeScale * this.#direction;
            if (duration <= 0)
                time = 0;
            else if (this.loop === 'repeat')
                time = ((time % duration) + duration) % duration;
            else if (this.loop === 'pingpong') {
                while (time > duration || time < 0) {
                    time = time > duration ? 2 * duration - time : -time;
                    this.#direction = -this.#direction;
                }
            }
            else if (time >= duration || time < 0) {
                time = time < 0 ? 0 : duration;
                finished = true;
            }
            this.#time = time;
        }
        const weight = this.effectiveWeight;
        if (weight > 0) {
            for (const bound of this.#bound) {
                const sample = scratch.subarray(0, bound.track.size);
                sampleAnimationTrack3D(bound.track, this.#time, sample, bound.hint);
                bound.mix.add(sample, weight);
            }
        }
        if (finished) {
            if (this.clampWhenFinished)
                this.paused = true;
            else
                this.#running = false;
            this.onFinished?.(this);
        }
    }
}
/** Plays clips on the subtree under `root`, blending concurrent actions by weight. */
export class AnimationMixer3D {
    root;
    timeScale = 1;
    #mixes = new Map();
    #actions = new Map();
    #scratch = new Float32Array(16);
    constructor(root) {
        this.root = root;
    }
    /** Create (or return the existing) action for a clip. Tracks whose target is missing are skipped. */
    clipAction(clip) {
        const existing = this.#actions.get(clip);
        if (existing)
            return existing;
        requireCount3D(this.#actions.size + 1, 'actions', ANIMATION3D_LIMITS.maxActions);
        const names = new Map();
        this.root.traverse(object => {
            if (object.name && !names.has(object.name))
                names.set(object.name, object);
        });
        const bound = [];
        for (const track of clip.tracks) {
            const target = names.get(track.targetName);
            if (!target)
                continue;
            if (track.path === 'weights') {
                if (!(target instanceof Mesh3D))
                    continue;
                target.syncMorphWeights();
                if (target.morphWeights.length < track.size)
                    continue;
            }
            const key = target.id + ':' + track.path;
            let mix = this.#mixes.get(key);
            if (!mix)
                this.#mixes.set(key, (mix = new PropertyMix(target, track.path, track.size)));
            if (track.size > this.#scratch.length)
                this.#scratch = new Float32Array(track.size);
            bound.push({ track, mix, hint: { index: 0 } });
        }
        const action = new AnimationAction3D(clip, bound);
        this.#actions.set(clip, action);
        return action;
    }
    /** Advance every running action by `deltaSeconds` and write the blended pose. */
    update(deltaSeconds) {
        const delta = requireFinite3D(deltaSeconds, 'deltaSeconds') * this.timeScale;
        for (const action of this.#actions.values())
            action.advance(delta, this.#scratch);
        for (const mix of this.#mixes.values())
            mix.apply();
    }
    stopAll() {
        for (const action of this.#actions.values())
            action.stop();
    }
    /** Stop every action and restore the pose captured when each property was first bound. */
    restorePose() {
        this.stopAll();
        for (const mix of this.#mixes.values())
            mix.restore();
    }
    /** Forget an action so its clip can be collected. */
    uncache(clip) {
        this.#actions.delete(clip);
    }
}
//# sourceMappingURL=Animation3D.js.map