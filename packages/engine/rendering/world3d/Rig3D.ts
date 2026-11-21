// SPDX-License-Identifier: Apache-2.0
// Models made from distance fields that move: a skeleton of bones placed at the joints of the model, each bone naming
// the parts it moves, and a skinned mesh whose every vertex follows the bones whose parts are nearest. The parts are
// the shapes the model was built from, so the weights come from the model itself: a vertex on the thigh follows the
// leg, one on the belly the body, and one at the hip a share of each, so the skin bends at the joint rather than
// tearing. A clip of the rig is written as poses of named bones at given times.
import {
  AnimationClip3D,
  AnimationMixer3D,
  type AnimationAction3D,
  type AnimationTrackInput3D
} from './Animation3D.js';
import { World3DError } from './core3D.js';
import { Attribute3D } from './Geometry3D.js';
import { createStandardMaterial3D, type Material3D } from './Material3D.js';
import { quatFromEuler } from './math3D.js';
import { Bone3D, Mesh3D, Skeleton3D } from './Mesh3D.js';
import { Object3D } from './Object3D.js';
import { createSdfGeometry3D, SdfShape3D, type SdfMeshOptions3D } from './Sdf3D.js';

type Vec3 = readonly [number, number, number];

/** A bone of a rig: where it turns, what it moves, and the bone it hangs from. */
export interface SdfBone3D {
  /** Its name, by which clips move it. A pair made by `mirror` is named `name.L` (on +x) and `name.R`. */
  readonly name: string;
  /** The bone it hangs from, moving with it; the rig's root unless given. A pair hangs from the parent of its side. */
  readonly parent?: string;
  /** The joint, in the model's coordinates: where the bone turns, such as a shoulder or a hip. */
  readonly at: Vec3;
  /** The shapes this bone moves: the vertices nearest them follow it. A bone without parts only carries others. */
  readonly parts?: SdfShape3D | readonly SdfShape3D[];
  /** 'x' makes a pair from one side: `at` and `parts` on +x for `name.L`, mirrored across x for `name.R`. */
  readonly mirror?: 'x';
}

/** How a rig is made: the options of its mesh, its material, and how wide a joint bends. */
export interface SdfRigOptions3D extends SdfMeshOptions3D {
  /** The mesh's material; a standard one with vertex colours unless given. */
  readonly material?: Material3D;
  /**
   * How far, in the model's units, the skin at a joint is shared between the bones on either side: a fiftieth of the
   * model's size unless given. Larger bends more softly; smaller keeps parts stiff up to the joint.
   */
  readonly blend?: number;
}

/** A pose key: a time in seconds, the bone's turn as Euler angles in radians, and optionally how far it moves. */
export type SdfPoseKey3D = readonly [time: number, rotation: Vec3, offset?: Vec3];

/** A model that moves: its root to add to a scene, its skinned mesh, its bones by name, and its animation. */
export interface SdfRig3D {
  /** Add this to the scene and move it to move the model. */
  readonly root: Object3D;
  readonly mesh: Mesh3D;
  readonly bones: Readonly<Record<string, Bone3D>>;
  readonly skeleton: Skeleton3D;
  readonly mixer: AnimationMixer3D;
  /**
   * A clip from poses of named bones: `{ 'leg.L': [[0, [0.4, 0, 0]], [0.5, [-0.4, 0, 0]], [1, [0.4, 0, 0]]] }`. A
   * rotation is from the bone's rest pose; an offset moves it from where it rests. A clip loops cleanly when its last
   * key of each bone equals its first.
   */
  clip(name: string, duration: number, poses: Readonly<Record<string, readonly SdfPoseKey3D[]>>): AnimationClip3D;
  /** Plays a clip, fading out what was playing over `fade` seconds (0.2 unless given). */
  play(clip: AnimationClip3D, fade?: number): AnimationAction3D;
  /** Moves the animation on; call once a frame. */
  update(seconds: number): void;
}

function invalid(what: string): World3DError {
  return new World3DError('WORLD3D_INPUT_INVALID', what);
}

function vec3(value: unknown, what: string): Vec3 {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) throw invalid(what);
  return value as unknown as Vec3;
}

interface Planned {
  name: string;
  parent: string | undefined;
  at: Vec3;
  parts: readonly SdfShape3D[];
  flip: boolean;
}

/**
 * A rig of `shape`: its mesh, made as `createSdfGeometry3D` makes it, skinned to bones at the joints of the model.
 * Every vertex follows at most four bones, those whose parts are nearest it.
 */
export function createSdfRig3D(
  shape: SdfShape3D,
  bones: readonly SdfBone3D[],
  options: SdfRigOptions3D = {}
): SdfRig3D {
  if (!(shape instanceof SdfShape3D)) throw invalid('rig shape');
  if (!Array.isArray(bones) || bones.length === 0) throw invalid('rig bones');
  if (options === null || typeof options !== 'object') throw invalid('rig options');
  // Each bone as planned, pairs split into their two sides.
  const mirrored = new Set<string>();
  for (const bone of bones) if (bone && bone.mirror === 'x') mirrored.add(bone.name);
  const planned: Planned[] = [];
  for (const bone of bones) {
    if (!bone || typeof bone !== 'object' || typeof bone.name !== 'string' || bone.name.length === 0)
      throw invalid('rig bone name');
    if (bone.mirror !== undefined && bone.mirror !== 'x') throw invalid('rig bone mirror');
    if (bone.parent !== undefined && typeof bone.parent !== 'string') throw invalid('rig bone parent');
    const at = vec3(bone.at, 'rig bone at');
    const list = bone.parts === undefined ? [] : bone.parts instanceof SdfShape3D ? [bone.parts] : bone.parts;
    if (!Array.isArray(list) || !list.every(part => part instanceof SdfShape3D)) throw invalid('rig bone parts');
    if (bone.mirror === 'x')
      for (const [side, flip] of [
        ['L', false],
        ['R', true]
      ] as const) {
        const parent = bone.parent !== undefined && mirrored.has(bone.parent) ? bone.parent + '.' + side : bone.parent;
        planned.push({
          name: bone.name + '.' + side,
          parent,
          at: flip ? [-at[0], at[1], at[2]] : at,
          parts: list,
          flip
        });
      }
    else planned.push({ name: bone.name, parent: bone.parent, at, parts: list, flip: false });
  }
  const index = new Map<string, number>();
  planned.forEach((bone, i) => {
    if (index.has(bone.name)) throw invalid('rig bone name twice: ' + bone.name);
    index.set(bone.name, i);
  });
  for (const bone of planned)
    if (bone.parent !== undefined && !index.has(bone.parent)) throw invalid('rig bone parent: ' + bone.parent);
  if (!planned.some(bone => bone.parts.length > 0)) throw invalid('rig bones have no parts');
  // A parent named after its child would make a loop.
  for (const bone of planned) {
    const seen = new Set<string>();
    for (let at: Planned | undefined = bone; at; at = at.parent ? planned[index.get(at.parent)!] : undefined) {
      if (seen.has(at.name)) throw invalid('rig bone loop: ' + bone.name);
      seen.add(at.name);
    }
  }

  const geometry = createSdfGeometry3D(shape, options);
  const b = shape.bounds;
  const size = Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
  const blend =
    options.blend === undefined
      ? size / 50
      : typeof options.blend === 'number' && options.blend > 0 && Number.isFinite(options.blend)
        ? options.blend
        : (() => {
            throw invalid('rig blend');
          })();

  // Weights: each vertex follows the bones whose parts are nearest, falling off over `blend` from the nearest.
  const position = geometry.getAttribute('position')!.data;
  const count = position.length / 3;
  const joints = new Uint16Array(count * 4),
    weights = new Float32Array(count * 4);
  const skinned = planned.map((bone, i) => ({ i, bone })).filter(entry => entry.bone.parts.length > 0);
  const distances = new Float64Array(skinned.length);
  for (let v = 0; v < count; v++) {
    const x = position[v * 3]!,
      y = position[v * 3 + 1]!,
      z = position[v * 3 + 2]!;
    let nearest = Infinity;
    for (let k = 0; k < skinned.length; k++) {
      const { bone } = skinned[k]!;
      const px = bone.flip ? -x : x;
      let d = Infinity;
      for (const part of bone.parts) d = Math.min(d, part.distance(px, y, z));
      distances[k] = d;
      if (d < nearest) nearest = d;
    }
    const best: [number, number][] = [];
    for (let k = 0; k < skinned.length; k++) {
      const w = Math.exp(-(distances[k]! - nearest) / blend);
      if (w < 1e-3) continue;
      best.push([w, skinned[k]!.i]);
    }
    best.sort((p, q) => q[0] - p[0]);
    const kept = best.slice(0, 4);
    const total = kept.reduce((sum, [w]) => sum + w, 0);
    kept.forEach(([w, bone], slot) => {
      joints[v * 4 + slot] = bone;
      weights[v * 4 + slot] = w / total;
    });
  }
  geometry.setAttribute('joints', new Attribute3D(joints, 4));
  geometry.setAttribute('weights', new Attribute3D(weights, 4));

  // The skeleton in its rest pose: each bone at its joint, placed from its parent's.
  const root = new Object3D();
  root.name = 'rig';
  const made = planned.map(bone => {
    const node = new Bone3D();
    node.name = bone.name;
    return node;
  });
  planned.forEach((bone, i) => {
    const parent = bone.parent === undefined ? undefined : planned[index.get(bone.parent)!]!;
    const base = parent?.at ?? [0, 0, 0];
    made[i]!.setPosition(bone.at[0] - base[0], bone.at[1] - base[1], bone.at[2] - base[2]);
    (parent === undefined ? root : made[index.get(bone.parent!)!]!).addChild(made[i]!);
  });
  root.updateWorldMatrices(true);
  const skeleton = new Skeleton3D(made);
  const mesh = new Mesh3D(
    geometry,
    options.material ?? createStandardMaterial3D({ vertexColors: true, roughness: 0.75 })
  );
  mesh.name = 'skin';
  root.addChild(mesh);
  root.updateWorldMatrices(true);
  mesh.bind(skeleton);

  const byName: Record<string, Bone3D> = {};
  planned.forEach((bone, i) => (byName[bone.name] = made[i]!));
  const rest = new Map(planned.map((bone, i) => [bone.name, Array.from(made[i]!.position)]));
  const mixer = new AnimationMixer3D(root);
  let playing: AnimationAction3D | undefined;
  return {
    root,
    mesh,
    bones: Object.freeze(byName),
    skeleton,
    mixer,
    clip(name, duration, poses) {
      if (typeof name !== 'string') throw invalid('rig clip name');
      if (typeof duration !== 'number' || !(duration > 0)) throw invalid('rig clip duration');
      if (poses === null || typeof poses !== 'object') throw invalid('rig clip poses');
      const tracks: AnimationTrackInput3D[] = [];
      for (const [bone, keys] of Object.entries(poses)) {
        if (!rest.has(bone)) throw invalid('rig clip bone: ' + bone);
        if (!Array.isArray(keys) || keys.length === 0) throw invalid('rig clip keys: ' + bone);
        const times: number[] = [],
          turns: number[] = [],
          moves: number[] = [];
        let moved = false;
        const q = new Float32Array(4),
          base = rest.get(bone)!;
        for (const key of keys) {
          if (!Array.isArray(key) || typeof key[0] !== 'number') throw invalid('rig clip key: ' + bone);
          const r = vec3(key[1], 'rig clip rotation: ' + bone);
          times.push(key[0]);
          quatFromEuler(q, r[0], r[1], r[2]);
          turns.push(q[0]!, q[1]!, q[2]!, q[3]!);
          const offset = key[2] === undefined ? [0, 0, 0] : vec3(key[2], 'rig clip offset: ' + bone);
          if (key[2] !== undefined) moved = true;
          moves.push(base[0]! + offset[0]!, base[1]! + offset[1]!, base[2]! + offset[2]!);
        }
        tracks.push({ targetName: bone, path: 'quaternion', times, values: turns });
        if (moved) tracks.push({ targetName: bone, path: 'position', times, values: moves });
      }
      return new AnimationClip3D(name, tracks, duration);
    },
    play(clip, fade = 0.2) {
      if (!(clip instanceof AnimationClip3D)) throw invalid('rig play clip');
      const action = mixer.clipAction(clip);
      if (action === playing) return action;
      if (playing !== undefined) playing.fadeOut(fade);
      action.reset().play();
      if (playing !== undefined && fade > 0) action.fadeIn(fade);
      playing = action;
      return action;
    },
    update(seconds) {
      mixer.update(seconds);
    }
  };
}
