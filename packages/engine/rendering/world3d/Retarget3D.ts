// SPDX-License-Identifier: Apache-2.0
// Plays one rig's animation on another: motion capture or a bought clip on a
// game's own skeleton, or one character's walk on another of other size. Both
// rigs are given in their rest pose. For each target bone the clip's turn of
// the matching source bone away from its rest, taken in world space, is laid
// onto the target bone's own rest, so rigs whose bones point along different
// axes still move alike. The root bone also moves, its travel scaled by the
// two rigs' heights. The result is an ordinary clip for the target rig.
import { World3DError } from './core3D.js';
import { AnimationClip3D, sampleAnimationTrack3D } from './Animation3D.js';
import type { AnimationTrackInput3D } from './Animation3D.js';
import { quatMultiply, quatNormalize } from './math3D.js';
import type { Object3D } from './Object3D.js';

/** How a clip is moved to another skeleton: from where to where, which bones match, the root, scale and frame rate. */
export interface RetargetOptions3D {
  /** The rig the clip was made for, in its rest pose. */
  readonly source: Object3D;
  /** The rig to make a clip for, in its rest pose. */
  readonly target: Object3D;
  /** Target bone name to source bone name. Defaults to the same names, for every target bone the source has. */
  readonly bones?: Readonly<Record<string, string>>;
  /** The target bone that carries the travel, such as the hips; its source is found through `bones`. */
  readonly root?: string;
  /** Scale of the root's travel; by default the ratio of the two root bones' heights above the rig origin. */
  readonly scale?: number;
  /** Keys a second. Defaults to 30. */
  readonly fps?: number;
  readonly name?: string;
}

type Quat = [number, number, number, number];
const inverse = (q: ArrayLike<number>): Quat => [-q[0]!, -q[1]!, -q[2]!, q[3]!];
const mul = (a: ArrayLike<number>, b: ArrayLike<number>): Quat => quatMultiply([0, 0, 0, 1], a, b) as Quat;

interface Bone {
  readonly node: Object3D;
  readonly parent: Bone | undefined;
  readonly restLocal: Quat;
  readonly restPosition: [number, number, number];
}

/** Every named node under `root`, with its parent among them and its rest. */
function bonesOf(root: Object3D): Map<string, Bone> {
  const out = new Map<string, Bone>();
  const walk = (node: Object3D, parent: Bone | undefined): void => {
    let bone = parent;
    if (node.name) {
      bone = {
        node,
        parent,
        restLocal: [...node.quaternion] as Quat,
        restPosition: [...node.position] as [number, number, number]
      };
      if (!out.has(node.name)) out.set(node.name, bone);
    }
    for (const child of node.children) walk(child, bone);
  };
  walk(root, undefined);
  return out;
}

/** The rest rotation of a bone in the rig's space: its parents' rest turns, outermost first. */
function restWorld(bone: Bone | undefined): Quat {
  let q: Quat = [0, 0, 0, 1];
  const chain: Bone[] = [];
  for (let b = bone; b; b = b.parent) chain.unshift(b);
  for (const b of chain) q = mul(q, b.restLocal);
  return q;
}

/** Height of a bone above the rig origin at rest, from rest positions alone. */
function restHeight(bone: Bone): number {
  let y = 0;
  const chain: Bone[] = [];
  for (let b: Bone | undefined = bone; b; b = b.parent) chain.unshift(b);
  let q: Quat = [0, 0, 0, 1];
  for (const b of chain) {
    // Rotate the bone's offset by its parent's rest turn before adding it.
    const [x, py, z] = b.restPosition;
    const v = mul(mul(q, [x, py, z, 0]), inverse(q));
    y += v[1];
    q = mul(q, b.restLocal);
  }
  return y;
}

/** A clip for the target rig that moves it as `clip` moves the source rig. */
export function retargetAnimationClip3D(clip: AnimationClip3D, options: RetargetOptions3D): AnimationClip3D {
  if (!(clip instanceof AnimationClip3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'clip');
  if (!options?.source || !options.target) throw new World3DError('WORLD3D_INPUT_INVALID', 'rigs');
  const fps = options.fps ?? 30;
  if (!(fps > 0 && fps <= 240)) throw new World3DError('WORLD3D_INPUT_INVALID', 'fps');
  const source = bonesOf(options.source),
    target = bonesOf(options.target);
  const pairs: [string, string][] = options.bones
    ? Object.entries(options.bones)
    : [...target.keys()].filter(name => source.has(name)).map(name => [name, name]);
  for (const [t, s] of pairs)
    if (!target.has(t) || !source.has(s)) throw new World3DError('WORLD3D_INPUT_INVALID', `bone ${t} or ${s}`);
  if (pairs.length === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'no shared bones');
  const sourceOf = new Map(pairs);

  // Source tracks by bone: rotation and position, sampled into the bone's local transform.
  const rotations = new Map<string, (typeof clip.tracks)[number]>(),
    positions = new Map<string, (typeof clip.tracks)[number]>();
  for (const track of clip.tracks) {
    if (track.path === 'quaternion') rotations.set(track.targetName, track);
    else if (track.path === 'position') positions.set(track.targetName, track);
  }
  const frames = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = Float32Array.from({ length: frames }, (_, i) => (i / (frames - 1)) * clip.duration);
  const hints = new Map<string, { index: number }>();
  const sample = (
    name: string,
    track: (typeof clip.tracks)[number] | undefined,
    time: number,
    rest: ArrayLike<number>,
    size: number
  ): number[] => {
    if (!track) return Array.from(rest);
    const out = new Float32Array(size);
    let hint = hints.get(name + track.path);
    if (!hint) hints.set(name + track.path, (hint = { index: 0 }));
    sampleAnimationTrack3D(track, time, out, hint);
    return Array.from(out);
  };

  // A source bone's world turn at a time: its chain's animated local turns.
  const sourceWorld = (bone: Bone | undefined, time: number, cache: Map<Bone, Quat>): Quat => {
    if (!bone) return [0, 0, 0, 1];
    const known = cache.get(bone);
    if (known) return known;
    const local = sample(bone.node.name, rotations.get(bone.node.name), time, bone.restLocal, 4);
    const world = quatNormalize([0, 0, 0, 1], mul(sourceWorld(bone.parent, time, cache), local)) as Quat;
    cache.set(bone, world);
    return world;
  };

  const restSource = new Map<string, Quat>(),
    restTarget = new Map<string, Quat>();
  for (const [t, s] of pairs) {
    restSource.set(s, restWorld(source.get(s)));
    restTarget.set(t, restWorld(target.get(t)));
  }
  // Target bones are solved parent first, so each local turn is taken against its parent's animated turn.
  const order = [...target.values()].filter(bone => sourceOf.has(bone.node.name));
  const depth = (bone: Bone): number => (bone.parent ? depth(bone.parent) + 1 : 0);
  order.sort((a, b) => depth(a) - depth(b));

  const values = new Map<string, number[]>(order.map(bone => [bone.node.name, []]));
  const rootName = options.root;
  if (rootName !== undefined && !sourceOf.has(rootName)) throw new World3DError('WORLD3D_INPUT_INVALID', 'root');
  const rootPositions: number[] = [];
  let scale = options.scale;
  if (rootName !== undefined && scale === undefined) {
    const sh = restHeight(source.get(sourceOf.get(rootName)!)!),
      th = restHeight(target.get(rootName)!);
    scale = Math.abs(sh) > 1e-6 ? th / sh : 1;
  }
  if (scale !== undefined && !Number.isFinite(scale)) throw new World3DError('WORLD3D_INPUT_INVALID', 'scale');

  for (const time of times) {
    const sourceCache = new Map<Bone, Quat>();
    const targetWorld = new Map<Bone, Quat>();
    const worldOfTarget = (bone: Bone | undefined): Quat => {
      if (!bone) return [0, 0, 0, 1];
      const solved = targetWorld.get(bone);
      if (solved) return solved;
      // A bone with no source keeps its rest turn under its parent.
      const world = mul(worldOfTarget(bone.parent), bone.restLocal);
      targetWorld.set(bone, world);
      return world;
    };
    for (const bone of order) {
      const name = bone.node.name,
        s = source.get(sourceOf.get(name)!)!;
      // The source bone's turn away from rest, in rig space, laid on the target bone's rest.
      const offset = mul(sourceWorld(s, time, sourceCache), inverse(restSource.get(s.node.name)!));
      const world = mul(offset, restTarget.get(name)!);
      targetWorld.set(bone, world);
      const local = quatNormalize([0, 0, 0, 1], mul(inverse(worldOfTarget(bone.parent)), world));
      // Keep neighbouring keys on the same side of the sphere so interpolation takes the short way.
      const list = values.get(name)!;
      if (list.length >= 4) {
        const dot =
          list[list.length - 4]! * local[0]! +
          list[list.length - 3]! * local[1]! +
          list[list.length - 2]! * local[2]! +
          list[list.length - 1]! * local[3]!;
        if (dot < 0) for (let i = 0; i < 4; i++) local[i] = -local[i]!;
      }
      list.push(local[0]!, local[1]!, local[2]!, local[3]!);
    }
    if (rootName !== undefined) {
      const s = source.get(sourceOf.get(rootName)!)!,
        t = target.get(rootName)!;
      const p = sample(s.node.name, positions.get(s.node.name), time, s.restPosition, 3);
      for (let i = 0; i < 3; i++) rootPositions.push(t.restPosition[i]! + (p[i]! - s.restPosition[i]!) * scale!);
    }
  }
  const tracks: AnimationTrackInput3D[] = order.map(bone => ({
    targetName: bone.node.name,
    path: 'quaternion',
    times,
    values: values.get(bone.node.name)!
  }));
  if (rootName !== undefined) tracks.push({ targetName: rootName, path: 'position', times, values: rootPositions });
  return new AnimationClip3D(options.name ?? clip.name, tracks, clip.duration);
}
