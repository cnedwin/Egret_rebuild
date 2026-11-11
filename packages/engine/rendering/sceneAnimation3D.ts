// SPDX-License-Identifier: Apache-2.0
import {Scene3DError} from './sceneFrame3D.js';
import {isSceneWorld3D} from './sceneWorld3D.js';
import type {SceneLambertWorld3D, SceneWorld3D} from './sceneWorld3D.js';

type Vec3 = readonly [number, number, number];
type Quaternion = readonly [number, number, number, number];
type PlaybackMode = 'once' | 'loop';

export interface SceneAnimationKey3D {
    readonly timeSeconds: number;
    readonly translation: Vec3;
    /** Quaternion in x, y, z, w order. */
    readonly rotation: Quaternion;
    readonly scale: Vec3;
}
export interface SceneAnimationTrackInput3D {
    readonly nodeId: string;
    readonly interpolation: 'step' | 'linear';
    readonly keys: readonly SceneAnimationKey3D[];
}
export interface SceneAnimationClipInput3D {
    readonly tracks: readonly SceneAnimationTrackInput3D[];
}
export interface SceneAnimationClip3D {
    readonly durationSeconds: number;
    sample(world: SceneLambertWorld3D, elapsedSeconds: number, mode?: PlaybackMode): SceneLambertWorld3D;
    sample(world: SceneWorld3D, elapsedSeconds: number, mode?: PlaybackMode): SceneWorld3D;
}

const MAX_TRACKS = 256;
const MAX_KEYS = 8192;
const MAX_TRANSFORM_COMPONENT = 2 ** 24;
const MIN_SCALE_MAGNITUDE = 2 ** -24;

function invalid(field: string): never {
    throw new Scene3DError('SCENE3D_INPUT_INVALID', field);
}
function budget(): never {
    throw new Scene3DError('SCENE3D_BUDGET');
}
function source<T>(read: () => T): T {
    try { return read(); }
    catch (cause) { throw new Scene3DError('SCENE3D_INPUT_READ_FAILED', cause); }
}
function record(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== 'object') invalid(field);
    return value as Record<string, unknown>;
}
function array(value: unknown, field: string): readonly unknown[] {
    if (!source(() => Array.isArray(value))) invalid(field);
    return value as readonly unknown[];
}
function count(values: readonly unknown[], field: string): number {
    const length = source(() => values.length);
    if (!Number.isSafeInteger(length) || length < 1) invalid(field);
    return length;
}
function own(values: readonly unknown[], index: number): unknown {
    return source(() => Object.hasOwn(values, index) ? values[index] : undefined);
}
function finite(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) invalid(field);
    return value === 0 ? 0 : value;
}
function components(value: unknown, size: 3, field: string): Vec3;
function components(value: unknown, size: 4, field: string): Quaternion;
function components(value: unknown, size: 3 | 4, field: string): Vec3 | Quaternion {
    const values = array(value, field);
    if (count(values, field) !== size) invalid(field);
    const a = finite(own(values, 0), field), b = finite(own(values, 1), field), c = finite(own(values, 2), field);
    return size === 3 ? [a, b, c] : [a, b, c, finite(own(values, 3), field)];
}
function unitQuaternion([x, y, z, w]: Quaternion): Quaternion {
    // Scale before taking the norm so finite extreme inputs cannot overflow or round the whole norm to zero.
    const largest = Math.max(Math.abs(x), Math.abs(y), Math.abs(z), Math.abs(w));
    if (largest === 0) invalid('animation key rotation');
    const a = x / largest, b = y / largest, c = z / largest, d = w / largest;
    const length = Math.hypot(a, b, c, d);
    return [a / length, b / length, c / length, d / length];
}
function readKey(value: unknown): SceneAnimationKey3D {
    const key = record(value, 'animation key');
    const fields = source(() => ({
        timeSeconds: key.timeSeconds, translation: key.translation, rotation: key.rotation, scale: key.scale,
    }));
    const timeSeconds = finite(fields.timeSeconds, 'animation key time');
    if (timeSeconds < 0) invalid('animation key time');
    const translation = components(fields.translation, 3, 'animation key translation');
    if (translation.some(value => Math.abs(value) > MAX_TRANSFORM_COMPONENT)) invalid('animation key translation');
    const scale = components(fields.scale, 3, 'animation key scale');
    if (scale.some(value => Math.abs(value) < MIN_SCALE_MAGNITUDE || Math.abs(value) > MAX_TRANSFORM_COMPONENT)) {
        invalid('animation key scale');
    }
    const rotation = unitQuaternion(components(fields.rotation, 4, 'animation key rotation'));
    return {timeSeconds, translation, rotation, scale};
}
function blendVector(a: Vec3, b: Vec3, t: number): Vec3 {
    const from = 1 - t;
    return [a[0] * from + b[0] * t, a[1] * from + b[1] * t, a[2] * from + b[2] * t];
}
function sinc(angle: number): number {
    return angle === 0 ? 1 : Math.sin(angle) / angle;
}
function blendRotation(a: Quaternion, b: Quaternion, t: number): Quaternion {
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    const direction = dot < 0 ? -1 : 1;
    const distance = Math.hypot(
        a[0] - direction * b[0], a[1] - direction * b[1], a[2] - direction * b[2], a[3] - direction * b[3],
    );
    // The chord retains precision when the quaternions are nearly parallel.
    // Using sinc for both SLERP weights also covers coincident orientations.
    const angle = 2 * Math.asin(Math.min(1, distance / 2));
    const denominator = sinc(angle);
    const from = (1 - t) * sinc((1 - t) * angle) / denominator;
    const to = direction * t * sinc(t * angle) / denominator;
    return unitQuaternion([
        a[0] * from + b[0] * to, a[1] * from + b[1] * to, a[2] * from + b[2] * to, a[3] * from + b[3] * to,
    ]);
}
function poseAt(track: SceneAnimationTrackInput3D, time: number): SceneAnimationKey3D {
    const keys = track.keys;
    const first = keys[0]!, last = keys[keys.length - 1]!;
    if (time <= first.timeSeconds) return first;
    if (time >= last.timeSeconds) return last;

    let lower = 0, upper = keys.length - 1;
    while (upper - lower > 1) {
        const middle = Math.floor((lower + upper) / 2);
        if (keys[middle]!.timeSeconds <= time) lower = middle;
        else upper = middle;
    }
    const left = keys[lower]!, right = keys[upper]!;
    if (track.interpolation === 'step' || time === left.timeSeconds) return left;
    const fraction = (time - left.timeSeconds) / (right.timeSeconds - left.timeSeconds);
    return {
        timeSeconds: time,
        translation: blendVector(left.translation, right.translation, fraction),
        rotation: blendRotation(left.rotation, right.rotation, fraction),
        scale: blendVector(left.scale, right.scale, fraction),
    };
}
function localMatrix(pose: SceneAnimationKey3D): readonly number[] {
    const [x, y, z, w] = pose.rotation;
    const [sx, sy, sz] = pose.scale;
    const [tx, ty, tz] = pose.translation;
    const xx = 2 * x * x, yy = 2 * y * y, zz = 2 * z * z;
    const xy = 2 * x * y, xz = 2 * x * z, yz = 2 * y * z;
    const xw = 2 * x * w, yw = 2 * y * w, zw = 2 * z * w;
    // Each rotation column receives its local scale. The final column is the unscaled translation.
    return [
        (1 - yy - zz) * sx, (xy + zw) * sx, (xz - yw) * sx, 0,
        (xy - zw) * sy, (1 - xx - zz) * sy, (yz + xw) * sy, 0,
        (xz + yw) * sz, (yz - xw) * sz, (1 - xx - yy) * sz, 0,
        tx, ty, tz, 1,
    ];
}

/** An owned rigid-node clip sampled with an explicit time and playback policy. */
export function createSceneAnimationClip3D(input: SceneAnimationClipInput3D): SceneAnimationClip3D {
    const raw = record(input, 'animation clip');
    const rawTracks = array(source(() => raw.tracks), 'animation tracks');
    const trackCount = count(rawTracks, 'animation tracks');
    if (trackCount > MAX_TRACKS) budget();

    // Admit the complete key budget before reading any key payload.
    const descriptions = [];
    const targets = new Set<string>();
    let totalKeys = 0;
    for (let index = 0; index < trackCount; index++) {
        const track = record(own(rawTracks, index), 'animation track');
        const {nodeId, interpolation, keys: rawKeys} = source(() => ({
            nodeId: track.nodeId, interpolation: track.interpolation, keys: track.keys,
        }));
        if (typeof nodeId !== 'string' || nodeId.length === 0 || nodeId.length > 96 || targets.has(nodeId)) {
            invalid('animation track node id');
        }
        if (interpolation !== 'step' && interpolation !== 'linear') invalid('animation track interpolation');
        targets.add(nodeId);
        const keys = array(rawKeys, 'animation keys');
        const keyCount = count(keys, 'animation keys');
        if (keyCount > MAX_KEYS - totalKeys) budget();
        totalKeys += keyCount;
        descriptions.push({nodeId, interpolation, keys, keyCount} as const);
    }

    const tracks: SceneAnimationTrackInput3D[] = [];
    let durationSeconds = 0;
    for (const {nodeId, interpolation, keys: sourceKeys, keyCount} of descriptions) {
        const keys: SceneAnimationKey3D[] = [];
        for (let index = 0; index < keyCount; index++) {
            const key = readKey(own(sourceKeys, index));
            const previous = keys[index - 1];
            if (previous && key.timeSeconds <= previous.timeSeconds) invalid('animation key time order');
            if (previous && interpolation === 'linear' &&
                key.scale.some((value, axis) => (value < 0) !== (previous.scale[axis]! < 0))) {
                invalid('animation linear scale sign');
            }
            keys.push(key);
        }
        durationSeconds = Math.max(durationSeconds, keys[keys.length - 1]!.timeSeconds);
        tracks.push({nodeId, interpolation, keys});
    }

    function sample(world: SceneLambertWorld3D, elapsedSeconds: number, mode?: PlaybackMode): SceneLambertWorld3D;
    function sample(world: SceneWorld3D, elapsedSeconds: number, mode?: PlaybackMode): SceneWorld3D;
    function sample(world: SceneWorld3D, elapsedSeconds: number, mode: PlaybackMode = 'once'): SceneWorld3D {
        if (!isSceneWorld3D(world)) invalid('animation world identity');
        const elapsed = finite(elapsedSeconds, 'animation elapsed time');
        if (elapsed < 0) invalid('animation elapsed time');
        if (mode !== 'once' && mode !== 'loop') invalid('animation playback mode');
        const time = mode === 'loop' && durationSeconds > 0 ? elapsed % durationSeconds : Math.min(elapsed, durationSeconds);
        return world.withNodeTransforms(tracks.map(track => ({
            id: track.nodeId, localMatrix: localMatrix(poseAt(track, time)),
        })));
    }

    return Object.freeze({durationSeconds, sample});
}
