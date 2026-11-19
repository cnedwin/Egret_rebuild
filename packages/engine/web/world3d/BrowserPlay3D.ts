// SPDX-License-Identifier: Apache-2.0
// A whole small 3D game from one call. The picture is a World3D app; everything else is `play`, drawn clear over
// it on a canvas of its own: the keys, the pointer, sound, timers, tweens, text and buttons. What is added here is
// what a 3D game makes its world of: boxes, balls and a ground that are placed by plain numbers, a camera that
// follows, a sun, tests of distance and overlap, and pieces thrown out by a hit.
import { EgretError } from '@egret/runtime';
import type { DisplayObject } from '@egret/runtime';
import { play } from '../play.js';
import type { PlayGame, PlayOptions } from '../play.js';
import { Object3D, Scene3D } from '../../rendering/world3d/Object3D.js';
import { Mesh3D } from '../../rendering/world3d/Mesh3D.js';
import type { Geometry3D } from '../../rendering/world3d/Geometry3D.js';
import type { Camera3D } from '../../rendering/world3d/Camera3D.js';
import { createPerspectiveCamera3D } from '../../rendering/world3d/Camera3D.js';
import type { Light3D } from '../../rendering/world3d/Light3D.js';
import { createDirectionalLight3D, createHemisphereLight3D } from '../../rendering/world3d/Light3D.js';
import type { Material3D } from '../../rendering/world3d/Material3D.js';
import { createStandardMaterial3D, setColor3D } from '../../rendering/world3d/Material3D.js';
import {
  createBoxGeometry3D,
  createCylinderGeometry3D,
  createSphereGeometry3D
} from '../../rendering/world3d/primitives3D.js';
import { linearColor3D } from '../../rendering/world3d/GeometryBuilder3D.js';
import { Raycaster3D } from '../../rendering/world3d/Raycast3D.js';
import { mat4Identity, mat4Multiply, quatToEuler, vec3TransformMat4 } from '../../rendering/world3d/math3D.js';
import { createWorld3DApp } from './app3D.js';
import type { World3DApp } from './app3D.js';

const invalid = (why: string): EgretError => new EgretError('PLAY_OPTIONS_INVALID', { cause: new TypeError(why) });
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const above = (value: unknown): value is number => finite(value) && value > 0;
const colour = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff;
const RADIANS = Math.PI / 180;
// Primitive geometry is transferred to its thing. Loaded models remain borrowed; burst geometry belongs to the game.
const ownedGeometry = new WeakMap<PlayThing3D, Geometry3D>();
const throwCleanupFailures = (failures: readonly unknown[]): void => {
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, 'Play3D cleanup failed');
};
const cleanUp = (actions: readonly (() => void)[]): void => {
  const failures: unknown[] = [];
  for (const action of actions) {
    try {
      action();
    } catch (cause) {
      failures.push(cause);
    }
  }
  throwCleanupFailures(failures);
};

/** Where a thing is made. What is left out is 0. */
export interface PlayPlace3D {
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
}

/**
 * A thing of the world: a box, a ball, a cylinder or a cone. It is placed, turned and sized by plain numbers, which
 * can be set at any time and tweened, and it takes properties of the game's own.
 */
export class PlayThing3D {
  /** What the thing is drawn with: its own mesh, or the model given to `game.add`. */
  public readonly node: Object3D;
  /** Half its width, height and depth as made, before its scale. */
  public readonly halfX: number;
  public readonly halfY: number;
  public readonly halfZ: number;
  /**
   * Where the middle of its box is from its place, before its scale: 0 for what `play3d` makes, and for a model
   * whatever its geometry says, as for a figure that stands on its place.
   */
  public readonly middleX: number;
  public readonly middleY: number;
  public readonly middleZ: number;
  #material: Material3D | undefined;
  #color: number;
  #turn: [number, number, number] = [0, 0, 0];
  #removed = false;
  [own: string]: unknown;
  /**
   * A thing of its own geometry and colour, or one of a model made elsewhere: then `half` and `middle` are its box,
   * and its colour is the model's own. Geometry passed directly is owned and released when the thing leaves;
   * an Object3D and its geometry and materials stay owned by their caller.
   */
  public constructor(
    shape: Geometry3D | Object3D,
    color: number,
    half: readonly [number, number, number],
    middle: readonly [number, number, number] = [0, 0, 0]
  ) {
    this.#color = color;
    if (shape instanceof Object3D) {
      this.node = shape;
      quatToEuler(this.#turn, shape.quaternion);
      for (const axis of [0, 1, 2] as const) this.#turn[axis] /= RADIANS;
    } else {
      ownedGeometry.set(this, shape);
      this.#material = createStandardMaterial3D({ color, roughness: 0.75 });
      const mesh = new Mesh3D(shape, this.#material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.node = mesh;
    }
    [this.halfX, this.halfY, this.halfZ] = half;
    [this.middleX, this.middleY, this.middleZ] = middle;
  }
  #place(index: 0 | 1 | 2, value: number): void {
    if (!finite(value)) return;
    this.node.position[index] = value;
    this.node.markTransformDirty();
  }
  #size(index: 0 | 1 | 2, value: number): void {
    if (!finite(value)) return;
    this.node.scale[index] = value;
    this.node.markTransformDirty();
  }
  #turned(index: 0 | 1 | 2, degrees: number): void {
    if (!finite(degrees)) return;
    this.#turn[index] = degrees;
    this.node.setRotation(this.#turn[0] * RADIANS, this.#turn[1] * RADIANS, this.#turn[2] * RADIANS);
  }
  public get x(): number {
    return this.node.position[0]!;
  }
  public set x(value: number) {
    this.#place(0, value);
  }
  /** Up. */
  public get y(): number {
    return this.node.position[1]!;
  }
  public set y(value: number) {
    this.#place(1, value);
  }
  /** Towards the camera as the game starts; away from it is less. */
  public get z(): number {
    return this.node.position[2]!;
  }
  public set z(value: number) {
    this.#place(2, value);
  }
  /** Turns about its own axes, in degrees. */
  public get rotationX(): number {
    return this.#turn[0];
  }
  public set rotationX(value: number) {
    this.#turned(0, value);
  }
  public get rotationY(): number {
    return this.#turn[1];
  }
  public set rotationY(value: number) {
    this.#turned(1, value);
  }
  public get rotationZ(): number {
    return this.#turn[2];
  }
  public set rotationZ(value: number) {
    this.#turned(2, value);
  }
  /** Its size as a share of the size it was made with; setting it sets all three of the ones below. */
  public get scale(): number {
    return this.node.scale[0]!;
  }
  public set scale(value: number) {
    if (!finite(value)) return;
    this.node.setScale(value);
  }
  public get scaleX(): number {
    return this.node.scale[0]!;
  }
  public set scaleX(value: number) {
    this.#size(0, value);
  }
  public get scaleY(): number {
    return this.node.scale[1]!;
  }
  public set scaleY(value: number) {
    this.#size(1, value);
  }
  public get scaleZ(): number {
    return this.node.scale[2]!;
  }
  public set scaleZ(value: number) {
    this.#size(2, value);
  }
  public get visible(): boolean {
    return this.node.visible;
  }
  public set visible(value: boolean) {
    this.node.visible = value === true;
  }
  /** Its colour, `0xRRGGBB`. What is not a colour is not taken; a model keeps the colours it has. */
  public get color(): number {
    return this.#color;
  }
  public set color(value: number) {
    if (!colour(value) || this.#material === undefined) return;
    this.#color = value;
    setColor3D(this.#material.color, value);
  }
  /** Whether `game.remove` has taken it out of the world. Setting it afterwards does nothing that is seen. */
  public get removed(): boolean {
    return this.#removed;
  }
  /** Used by game removal and teardown; only resources made for this thing are retired. */
  public leave(): void {
    if (this.#removed) return;
    this.#removed = true;
    const geometry = ownedGeometry.get(this);
    ownedGeometry.delete(this);
    cleanUp([() => this.node.removeFromParent(), () => geometry?.dispose(), () => this.#material?.dispose()]);
  }
}

/** The camera: where it is and what it looks at, by plain numbers. */
export interface PlayCamera3D {
  x: number;
  y: number;
  z: number;
  /** The angle it sees from top to bottom, in degrees. */
  fov: number;
  /** Turns it to look at a point. It goes on looking there as it moves. */
  lookAt(x: number, y: number, z: number): void;
  readonly node: Camera3D;
}
export interface PlayFollow3D {
  /** Where the camera stays from the thing: 0, 4 and 8 unless given, which is above and behind. */
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  /** How quickly it catches up: 6 unless given; 0 keeps it exactly there. */
  readonly smooth?: number;
  /**
   * Turns the place of the camera with the thing's `rotationY`, so that it stays behind a car or a figure that turns:
   * `{ y: 3, z: 7, turn: true }` is above and behind whichever way the thing faces. False unless given.
   */
  readonly turn?: boolean;
}
export interface PlayBurst3D {
  readonly color?: number;
  readonly count?: number;
  readonly speed?: number;
  readonly life?: number;
  readonly size?: number;
  readonly gravity?: number;
}
type Body = PlayThing3D | DisplayObject;

/** What `play3d` gives: everything `play` gives for the interface and the game's time, and a world of things. */
export type PlayLookName3D = 'day' | 'dusk' | 'night' | 'fog' | 'snow';
export interface PlayLook3D {
  /** What is behind everything, and the colour of the fog. */
  readonly background?: number;
  /** The light from above and from below, and how strong it is. */
  readonly sky?: number;
  readonly ground?: number;
  readonly light?: number;
  readonly sun?: number;
  readonly sunIntensity?: number;
  /** The side the sun shines from, as `[x, y, z]`; y up. */
  readonly sunFrom?: readonly [number, number, number];
  /** How thick the air is: 0 is clear, 0.02 a haze, 0.06 a fog. */
  readonly fog?: number;
}
/** The looks every game is given, by name. */
export const PLAY_LOOKS_3D: Readonly<Record<PlayLookName3D, Required<PlayLook3D>>> = Object.freeze({
  day: {
    background: 0x8ec5ff,
    sky: 0xcfe3ff,
    ground: 0x4a5a3a,
    light: 0.9,
    sun: 0xfff4e0,
    sunIntensity: 2.4,
    sunFrom: [8, 16, 10],
    fog: 0.006
  },
  dusk: {
    background: 0xd98a62,
    sky: 0xffc18a,
    ground: 0x2b2238,
    light: 0.7,
    sun: 0xff9a5a,
    sunIntensity: 2,
    sunFrom: [16, 5, 6],
    fog: 0.018
  },
  night: {
    background: 0x0b1020,
    sky: 0x3a4a78,
    ground: 0x08080c,
    light: 0.22,
    sun: 0x9fb8ff,
    sunIntensity: 0.35,
    sunFrom: [-6, 14, 8],
    fog: 0.015
  },
  fog: {
    background: 0xb8c0c8,
    sky: 0xdfe5ea,
    ground: 0x6b7076,
    light: 0.9,
    sun: 0xffffff,
    sunIntensity: 1,
    sunFrom: [8, 16, 10],
    fog: 0.06
  },
  snow: {
    background: 0xdfe8f2,
    sky: 0xe6eef8,
    ground: 0x8a96a6,
    light: 0.7,
    sun: 0xfff8f0,
    sunIntensity: 1.4,
    sunFrom: [8, 14, 12],
    fog: 0.025
  }
});
export interface Play3DGame
  extends Omit<
    PlayGame,
    'remove' | 'near' | 'overlaps' | 'hits' | 'hitsAll' | 'pushOut' | 'burst' | 'shake' | 'onTap'
  > {
  readonly scene: Scene3D;
  readonly camera: PlayCamera3D;
  /** The light of the day. It keeps its direction and stays over what the camera looks at. */
  readonly sun: Light3D;
  /** The World3D app under the game, for what this does not cover. */
  readonly app: World3DApp;
  /**
   * The light and air of the world: `'day'`, `'dusk'`, `'night'`, `'fog'` or `'snow'`, or the parts of one to change:
   * `{ background, sky, ground, light, sun, sunIntensity, sunFrom, fog }`, colours as `0xRRGGBB`, `sunFrom` the side
   * the sun shines from as `[x, y, z]`, and `fog` its thickness, 0 for none. A restart keeps it.
   */
  look(look: PlayLookName3D | PlayLook3D): void;
  /** A box of this width, height and depth, its middle at the place given. */
  box(width: number, height: number, depth: number, color: number, at?: PlayPlace3D): PlayThing3D;
  /** A ball. */
  sphere(radius: number, color: number, at?: PlayPlace3D): PlayThing3D;
  /** A cylinder standing on its end. */
  cylinder(radius: number, height: number, color: number, at?: PlayPlace3D): PlayThing3D;
  /** A cone standing on its base. */
  cone(radius: number, height: number, color: number, at?: PlayPlace3D): PlayThing3D;
  /** A square floor of this size whose top is at the height given, 0 unless said. */
  ground(size: number, color: number, y?: number): PlayThing3D;
  /**
   * Makes a model of your own a thing of the world: a mesh of your geometry, a group, or what `loadGltf3D` gave.
   * Its box for the tests is worked out from its geometry; it keeps its own materials.
   */
  add(model: Object3D, at?: PlayPlace3D): PlayThing3D;
  /**
   * Calls the function when the thing is tapped or clicked, by a ray from the camera through the pointer; the
   * nearest thing hit gets it. A sprite of the interface is given to `onTap` of `play` as before.
   */
  onTap(target: PlayThing3D | DisplayObject, callback: () => unknown): void;
  /** Takes a thing out of the world, or a sprite off the interface. */
  remove(body: Body): void;
  /** Whether the middles of two things are within a distance: the sum of their radii unless given. */
  near(a: Body, b: Body, distance?: number): boolean;
  /** Whether two things overlap, taken as upright boxes. */
  overlaps(a: Body, b: Body, shrink?: number): boolean;
  hits<T extends Body>(a: Body, others: readonly T[], shrink?: number): T | undefined;
  hitsAll<T extends Body>(a: Body, others: readonly T[], shrink?: number): T[];
  /**
   * How far to move thing `a` so it no longer overlaps thing `b`, by the shortest way out: one of x, y and z is not
   * 0. Undefined when they do not overlap. A `y` above 0 means `a` stands on `b`.
   */
  pushOut(a: PlayThing3D, b: PlayThing3D): { x: number; y: number; z: number } | undefined;
  /** Keeps the camera by a thing and looking at it; without a thing, lets the camera be. */
  follow(thing?: PlayThing3D, where?: PlayFollow3D): void;
  /** Shakes the camera by up to this many units of the world. */
  shake(amount?: number, seconds?: number): void;
  /** Throws small pieces out from a point of the world. */
  burst(x: number, y: number, z: number, options?: PlayBurst3D): void;
}
export interface Play3DOptions extends Omit<PlayOptions, 'setup' | 'update' | 'canvas'> {
  readonly setup?: (game: Play3DGame) => void | Promise<void>;
  readonly update?: (seconds: number, game: Play3DGame) => void;
}

interface Piece {
  readonly thing: PlayThing3D;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  span: number;
  gravity: number;
  size: number;
}
const PIECES = 96;
/** How deep a ground is under its top. */
const GROUND_DEPTH = 8;

/** The upright box of a thing in the world: its middle and half its size, scaled. */
function boxOf(thing: PlayThing3D): [number, number, number, number, number, number] {
  return [
    thing.x + thing.middleX * thing.scaleX,
    thing.y + thing.middleY * thing.scaleY,
    thing.z + thing.middleZ * thing.scaleZ,
    thing.halfX * Math.abs(thing.scaleX),
    thing.halfY * Math.abs(thing.scaleY),
    thing.halfZ * Math.abs(thing.scaleZ)
  ];
}
/** How far two things overlap on each axis; all three are above 0 when they overlap. */
export function overlap3D(a: PlayThing3D, b: PlayThing3D, shrink = 0): [number, number, number] {
  const p = boxOf(a),
    q = boxOf(b);
  return [
    p[3] + q[3] - 2 * shrink - Math.abs(p[0] - q[0]),
    p[4] + q[4] - 2 * shrink - Math.abs(p[1] - q[1]),
    p[5] + q[5] - 2 * shrink - Math.abs(p[2] - q[2])
  ];
}
/**
 * The box of a model, in its own units and about its own place: half its size and where its middle is. Every mesh
 * under it counts, placed as it is under it; the model's own place, turn and scale do not.
 */
export function modelBox3D(model: Object3D): { half: [number, number, number]; middle: [number, number, number] } {
  const low = [Infinity, Infinity, Infinity],
    high = [-Infinity, -Infinity, -Infinity],
    corner = new Float32Array(3);
  const visit = (node: Object3D, matrix: Float32Array): void => {
    const geometry = (node as { geometry?: Geometry3D }).geometry;
    if (geometry !== undefined && geometry.vertexCount > 0) {
      const box = geometry.boundingBox;
      for (let i = 0; i < 8; i++) {
        corner[0] = i & 1 ? box[3]! : box[0]!;
        corner[1] = i & 2 ? box[4]! : box[1]!;
        corner[2] = i & 4 ? box[5]! : box[2]!;
        vec3TransformMat4(corner, corner, matrix);
        for (let k = 0; k < 3; k++) {
          low[k] = Math.min(low[k]!, corner[k]!);
          high[k] = Math.max(high[k]!, corner[k]!);
        }
      }
    }
    for (const child of node.children) {
      child.updateWorldMatrix();
      const placed = new Float32Array(16);
      mat4Multiply(placed, matrix, child.matrix);
      visit(child, placed);
    }
  };
  visit(model, mat4Identity(new Float32Array(16)) as Float32Array);
  if (!(low[0]! <= high[0]!)) return { half: [0.5, 0.5, 0.5], middle: [0, 0, 0] };
  return {
    half: [(high[0]! - low[0]!) / 2, (high[1]! - low[1]!) / 2, (high[2]! - low[2]!) / 2],
    middle: [(high[0]! + low[0]!) / 2, (high[1]! + low[1]!) / 2, (high[2]! + low[2]!) / 2]
  };
}

/** The move that takes `a` out of `b` by the shortest way, or undefined when they are apart. */
export function pushOut3D(a: PlayThing3D, b: PlayThing3D): { x: number; y: number; z: number } | undefined {
  const [x, y, z] = overlap3D(a, b);
  if (!(x > 0 && y > 0 && z > 0)) return undefined;
  const p = boxOf(a),
    q = boxOf(b);
  // Compare the same box centres as the overlap, including offset or mirrored models.
  // Up or down first where the ways are as short as one another: a thing set down on a floor stands on it.
  if (y <= x && y <= z) return { x: 0, y: p[1] >= q[1] ? y : -y, z: 0 };
  if (x <= z) return { x: p[0] >= q[0] ? x : -x, y: 0, z: 0 };
  return { x: 0, y: 0, z: p[2] >= q[2] ? z : -z };
}

/** Starts a 3D game in the page. See the guide `play3d.md`. */
export async function play3d(options: Play3DOptions): Promise<Play3DGame> {
  if (options === null || typeof options !== 'object') throw invalid('play3d takes an object of options');
  const { setup, update, background = 0x0b1020 } = options;
  if (!colour(background)) throw invalid('background is a colour from 0 to 0xffffff');
  if (setup !== undefined && typeof setup !== 'function') throw invalid('setup is a function');
  if (update !== undefined && typeof update !== 'function') throw invalid('update is a function');
  if ((options as { canvas?: unknown }).canvas !== undefined) throw invalid('play3d makes its own canvases');

  let game: Play3DGame | undefined,
    app: World3DApp | undefined,
    creatingApp: Promise<World3DApp> | undefined,
    deep: HTMLCanvasElement | undefined,
    unplace: (() => void) | undefined;
  let clearing = false,
    closing = false,
    generation = 0;
  let disposal: Promise<void> | undefined;
  const admit = (): void => {
    if (clearing || closing) throw invalid('the 3D world is clearing or disposed');
  };
  const beginClosing = (): void => {
    if (closing) return;
    closing = true;
    generation++;
  };
  const scene = new Scene3D();
  scene.background = linearColor3D(background);
  const eye = createPerspectiveCamera3D({ fov: 55, near: 0.1, far: 500 });
  const sky = createHemisphereLight3D({ color: 0xcfe3ff, groundColor: 0x3a3f4a, intensity: 0.9 });
  const sun = createDirectionalLight3D({ color: 0xfff4e0, intensity: 2.4, castShadow: true });
  sun.shadow.extent = 24;
  sun.shadow.far = 120;
  const things = new Set<PlayThing3D>();
  // The camera: where the game put it, what it looks at, and how far a shake has it out of place.
  const base = [0, 6, 12],
    aim = [0, 0, 0],
    shaken = [0, 0, 0];
  let followed: PlayThing3D | undefined,
    turning = false,
    offset = [0, 4, 8],
    smooth = 6,
    shakeAmount = 0,
    shakeLeft = 0,
    shakeSpan = 1;
  // The side the sun shines from; a look changes it.
  const sunFrom: [number, number, number] = [8, 16, 10];
  const look = (given: PlayLookName3D | PlayLook3D): void => {
    const chosen = typeof given === 'string' ? PLAY_LOOKS_3D[given] : given;
    if (chosen === undefined || chosen === null || typeof chosen !== 'object')
      throw invalid("look is 'day', 'dusk', 'night', 'fog' or 'snow', or { background, sky, ground, sun, fog }");
    const hex = (value: unknown): value is number =>
      Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffff;
    if (hex(chosen.background)) {
      scene.background = linearColor3D(chosen.background);
      if (scene.fog !== undefined) scene.fog = { ...scene.fog, color: linearColor3D(chosen.background) };
    }
    if (hex(chosen.sky)) setColor3D(sky.color, chosen.sky);
    if (hex(chosen.ground)) setColor3D(sky.groundColor, chosen.ground);
    if (finite(chosen.light) && chosen.light >= 0) sky.intensity = chosen.light;
    if (hex(chosen.sun)) setColor3D(sun.color, chosen.sun);
    if (finite(chosen.sunIntensity) && chosen.sunIntensity >= 0) sun.intensity = chosen.sunIntensity;
    const from = chosen.sunFrom;
    if (Array.isArray(from) && from.length === 3 && from.every(finite) && from[1]! > 0) {
      sunFrom[0] = from[0]!;
      sunFrom[1] = from[1]!;
      sunFrom[2] = from[2]!;
    }
    if (finite(chosen.fog) && chosen.fog >= 0) {
      const color = Array.isArray(scene.background)
        ? (scene.background as readonly [number, number, number])
        : linearColor3D(background);
      scene.fog =
        chosen.fog === 0
          ? undefined
          : { kind: 'exponential', color: [...color] as [number, number, number], density: chosen.fog };
    }
    settle();
  };
  const settle = (): void => {
    eye.setPosition(base[0]! + shaken[0]!, base[1]! + shaken[1]!, base[2]! + shaken[2]!);
    eye.lookAt(aim[0]!, aim[1]!, aim[2]!);
    // The sun keeps its direction and stays over what is looked at, so its shadows are there.
    sun.setPosition(aim[0]! + sunFrom[0], aim[1]! + sunFrom[1], aim[2]! + sunFrom[2]);
    sun.lookAt(aim[0]!, aim[1]!, aim[2]!);
  };
  const camera: PlayCamera3D = {
    get x() {
      return base[0]!;
    },
    set x(value) {
      if (finite(value)) base[0] = value;
    },
    get y() {
      return base[1]!;
    },
    set y(value) {
      if (finite(value)) base[1] = value;
    },
    get z() {
      return base[2]!;
    },
    set z(value) {
      if (finite(value)) base[2] = value;
    },
    get fov() {
      return eye.fov;
    },
    set fov(value) {
      if (finite(value) && value > 1 && value < 170) eye.fov = value;
    },
    lookAt(x, y, z) {
      if (!finite(x) || !finite(y) || !finite(z)) return;
      aim[0] = x;
      aim[1] = y;
      aim[2] = z;
    },
    node: eye
  };

  // Pieces of a burst: a few small boxes, made once and used again.
  const pieceShape = createBoxGeometry3D({ width: 1, height: 1, depth: 1 });
  const pieces: Piece[] = [];
  let nextPiece = 0;
  const make = (
    geometry: () => Geometry3D,
    color: number,
    half: readonly [number, number, number],
    at: PlayPlace3D
  ) => {
    admit();
    if (!colour(color)) throw invalid('a colour is a number from 0 to 0xffffff');
    if (at === null || typeof at !== 'object') throw invalid('a place is an object with x, y and z');
    const { x, y, z } = at;
    // Read caller properties before allocating, then recheck in case a getter began teardown.
    admit();
    const thing = new PlayThing3D(geometry(), color, half);
    thing.node.setPosition(finite(x) ? x : 0, finite(y) ? y : 0, finite(z) ? z : 0);
    scene.addChild(thing.node);
    things.add(thing);
    return thing;
  };
  const isThing = (body: unknown): body is PlayThing3D => body instanceof PlayThing3D;
  // Taps on things: found by a ray from the camera through the pointer when it goes down.
  const taps = new Map<PlayThing3D, () => unknown>(),
    ray = new Raycaster3D();
  // A tap reports errors to the scene that received it. A returned restart may reject after that scene is gone.
  let tapErrors: { failure?: { readonly cause: unknown } } = {};
  const tapped = (flat: PlayGame): void => {
    if (taps.size === 0 || !flat.pointer.pressed) return;
    for (const thing of taps.keys()) if (thing.removed) taps.delete(thing);
    eye.updateWorldMatrices();
    scene.updateWorldMatrices();
    ray.setFromCamera((flat.pointer.x / flat.width) * 2 - 1, 1 - (flat.pointer.y / flat.height) * 2, eye);
    let hits;
    try {
      hits = ray.intersect(scene);
    } catch {
      return;
    }
    for (const hit of hits) {
      // The thing a mesh that was hit belongs to: the nearest one up its line that has a tap.
      for (let node: Object3D | undefined = hit.object; node !== undefined; node = node.parent) {
        const thing = [...taps.keys()].find(each => each.node === node);
        if (thing === undefined || !thing.visible) continue;
        const callback = taps.get(thing)!;
        const owner = tapErrors;
        const fail = (cause: unknown): void => {
          owner.failure ??= { cause };
        };
        try {
          const result = callback() as { then?: unknown } | null | undefined;
          if (result !== null && result !== undefined && typeof result.then === 'function')
            (result as PromiseLike<unknown>).then(undefined, fail);
        } catch (cause) {
          fail(cause);
        }
        return;
      }
    }
  };
  const clear = (): void => {
    if (clearing) throw invalid('the 3D world is clearing or disposed');
    clearing = true;
    generation++;
    try {
      const leaving = [...things];
      things.clear();
      taps.clear();
      tapErrors = {};
      for (const piece of pieces) {
        piece.life = 0;
        piece.thing.visible = false;
      }
      followed = undefined;
      base[0] = 0;
      base[1] = 6;
      base[2] = 12;
      aim[0] = aim[1] = aim[2] = 0;
      shakeLeft = 0;
      shaken[0] = shaken[1] = shaken[2] = 0;
      cleanUp(leaving.map(thing => () => thing.leave()));
    } finally {
      clearing = false;
    }
  };
  const disposeWorld = async (): Promise<void> => {
    beginClosing();
    const failures: unknown[] = [];
    // Join only the SDK factory. Application setup may still be waiting on an unrelated download.
    if (creatingApp !== undefined) {
      try {
        await creatingApp;
      } catch (cause) {
        failures.push(cause);
      }
    }
    try {
      cleanUp([
        clear,
        ...pieces.map(piece => () => piece.thing.leave()),
        () => pieceShape.dispose(),
        () => unplace?.(),
        () => app?.dispose(),
        () => deep?.remove()
      ]);
    } catch (cause) {
      failures.push(cause);
    }
    try {
      // World3DApp is a synchronous Disposable. Its Engine owns the shared asynchronous close result.
      await app?.engine.dispose();
    } catch (cause) {
      failures.push(cause);
    }
    throwCleanupFailures(failures);
  };
  // Where the camera keeps to by a thing: its offset, turned with the thing when asked.
  const placeBy = (thing: PlayThing3D): [number, number, number] => {
    let [x, y, z] = offset as [number, number, number];
    if (turning) {
      const turn = thing.rotationY * RADIANS,
        c = Math.cos(turn),
        s = Math.sin(turn);
      [x, z] = [x * c + z * s, -x * s + z * c];
    }
    return [thing.x + x, thing.y + y, thing.z + z];
  };
  const after = (seconds: number): void => {
    if (followed !== undefined && !followed.removed) {
      const share = smooth > 0 ? 1 - Math.exp(-smooth * seconds) : 1,
        [x, y, z] = placeBy(followed);
      base[0] = base[0]! + (x - base[0]!) * share;
      base[1] = base[1]! + (y - base[1]!) * share;
      base[2] = base[2]! + (z - base[2]!) * share;
      aim[0] = followed.x;
      aim[1] = followed.y;
      aim[2] = followed.z;
    }
    if (shakeLeft > 0) {
      shakeLeft -= seconds;
      const reach = shakeLeft > 0 ? shakeAmount * (shakeLeft / shakeSpan) : 0;
      for (let i = 0; i < 3; i++) shaken[i] = (Math.random() * 2 - 1) * reach;
    }
    for (const piece of pieces) {
      if (piece.life <= 0) continue;
      piece.life -= seconds;
      if (piece.life <= 0) {
        piece.thing.visible = false;
        continue;
      }
      piece.vy -= piece.gravity * seconds;
      piece.thing.x += piece.vx * seconds;
      piece.thing.y += piece.vy * seconds;
      piece.thing.z += piece.vz * seconds;
      piece.thing.scale = piece.size * (piece.life / piece.span);
    }
    settle();
  };

  const extend = (flat: PlayGame): Play3DGame => {
    const added: Partial<Play3DGame> = {
      look,
      box(width, height, depth, color, at = {}) {
        admit();
        if (!above(width) || !above(height) || !above(depth))
          throw invalid('a box has a width, height and depth above 0');
        return make(() => createBoxGeometry3D({ width, height, depth }), color, [width / 2, height / 2, depth / 2], at);
      },
      sphere(radius, color, at = {}) {
        admit();
        if (!above(radius)) throw invalid('a sphere has a radius above 0');
        return make(
          () => createSphereGeometry3D({ radius, widthSegments: 24, heightSegments: 16 }),
          color,
          [radius, radius, radius],
          at
        );
      },
      cylinder(radius, height, color, at = {}) {
        admit();
        if (!above(radius) || !above(height)) throw invalid('a cylinder has a radius and a height above 0');
        return make(
          () => createCylinderGeometry3D({ radiusTop: radius, radiusBottom: radius, height, radialSegments: 24 }),
          color,
          [radius, height / 2, radius],
          at
        );
      },
      cone(radius, height, color, at = {}) {
        admit();
        if (!above(radius) || !above(height)) throw invalid('a cone has a radius and a height above 0');
        return make(
          () => createCylinderGeometry3D({ radiusTop: 0, radiusBottom: radius, height, radialSegments: 24 }),
          color,
          [radius, height / 2, radius],
          at
        );
      },
      ground(size, color, y = 0) {
        admit();
        if (!above(size) || !finite(y)) throw invalid('a ground has a size above 0');
        // Deep, so that a thing falling fast in a slow frame is still pushed back up out of it and not through it.
        const thing = make(
          () => createBoxGeometry3D({ width: size, height: GROUND_DEPTH, depth: size }),
          color,
          [size / 2, GROUND_DEPTH / 2, size / 2],
          {
            y: y - GROUND_DEPTH / 2
          }
        );
        thing.node.castShadow = false;
        return thing;
      },
      add(model, at = {}) {
        admit();
        if (!(model instanceof Object3D)) throw invalid('add takes a mesh, a group or a loaded model');
        if (at === null || typeof at !== 'object') throw invalid('a place is an object with x, y and z');
        const { x, y, z } = at;
        admit();
        const { half, middle } = modelBox3D(model);
        admit();
        if (model.parent !== undefined) model.removeFromParent();
        const thing = new PlayThing3D(model, 0xffffff, half, middle);
        if (finite(x)) thing.x = x;
        if (finite(y)) thing.y = y;
        if (finite(z)) thing.z = z;
        scene.addChild(model);
        things.add(thing);
        return thing;
      },
      onTap(target, callback) {
        if (typeof callback !== 'function') throw invalid('onTap takes a thing or a sprite, and a function');
        if (!isThing(target)) {
          flat.onTap(target, callback as () => void);
          return;
        }
        taps.set(target, callback);
      },
      remove(body) {
        if (isThing(body)) {
          things.delete(body);
          taps.delete(body);
          if (followed === body) followed = undefined;
          body.leave();
        } else flat.remove(body);
      },
      near(a, b, distance) {
        if (!isThing(a) || !isThing(b)) return !isThing(a) && !isThing(b) && flat.near(a, b, distance ?? 0);
        if (a.removed || b.removed || !a.visible || !b.visible) return false;
        const reach =
          distance ??
          Math.max(a.halfX * Math.abs(a.scaleX), a.halfZ * Math.abs(a.scaleZ)) +
            Math.max(b.halfX * Math.abs(b.scaleX), b.halfZ * Math.abs(b.scaleZ));
        const dx = a.x - b.x,
          dy = a.y - b.y,
          dz = a.z - b.z;
        return dx * dx + dy * dy + dz * dz <= reach * reach;
      },
      overlaps(a, b, shrink = 0) {
        if (!isThing(a) || !isThing(b)) return !isThing(a) && !isThing(b) && flat.overlaps(a, b, shrink);
        if (a === b || a.removed || b.removed || !a.visible || !b.visible) return false;
        const [x, y, z] = overlap3D(a, b, finite(shrink) ? shrink : 0);
        return x > 0 && y > 0 && z > 0;
      },
      hits(a, others, shrink = 0) {
        for (const other of others) if (other !== a && whole.overlaps(a, other, shrink)) return other;
        return undefined;
      },
      hitsAll(a, others, shrink = 0) {
        return others.filter(other => other !== a && whole.overlaps(a, other, shrink));
      },
      pushOut(a, b) {
        if (!isThing(a) || !isThing(b) || a === b || a.removed || b.removed || !a.visible || !b.visible)
          return undefined;
        return pushOut3D(a, b);
      },
      follow(thing, where = {}) {
        if (thing !== undefined && !isThing(thing)) throw invalid('follow takes a thing of the world');
        followed = thing;
        if (thing === undefined) return;
        offset = [finite(where.x) ? where.x : 0, finite(where.y) ? where.y : 4, finite(where.z) ? where.z : 8];
        smooth = finite(where.smooth) && where.smooth >= 0 ? where.smooth : 6;
        turning = where.turn === true;
        // It starts where it will stay, and does not fly in from where the camera was.
        [base[0], base[1], base[2]] = placeBy(thing);
        aim[0] = thing.x;
        aim[1] = thing.y;
        aim[2] = thing.z;
      },
      hitStop(seconds = 0.06) {
        flat.hitStop(seconds);
        if (above(seconds)) generation++;
      },
      shake(amount = 0.3, seconds = 0.25) {
        if (!above(amount) || !above(seconds)) return;
        shakeAmount = Math.max(shakeLeft > 0 ? shakeAmount : 0, Math.min(amount, 10));
        shakeLeft = shakeSpan = Math.min(seconds, 5);
      },
      burst(x, y, z, o = {}) {
        admit();
        if (!finite(x) || !finite(y) || !finite(z) || o === null || typeof o !== 'object') return;
        const count = Math.min(PIECES, Math.max(1, Math.floor(finite(o.count) ? o.count : 12))),
          speed = above(o.speed) ? o.speed : 5,
          life = above(o.life) ? Math.min(o.life, 10) : 0.6,
          size = above(o.size) ? o.size : 0.18,
          gravity = finite(o.gravity) ? o.gravity : 12,
          color = colour(o.color) ? o.color : 0xffffff;
        admit();
        for (let i = 0; i < count; i++) {
          let piece = pieces[nextPiece];
          if (piece === undefined) {
            const thing = new PlayThing3D(pieceShape, color, [0.5, 0.5, 0.5]);
            // Pieces own their separate material, while the game owns their one shared shape.
            ownedGeometry.delete(thing);
            thing.node.castShadow = false;
            scene.addChild(thing.node);
            piece = pieces[nextPiece] = { thing, vx: 0, vy: 0, vz: 0, life: 0, span: 1, gravity: 0, size: 1 };
          }
          nextPiece = (nextPiece + 1) % PIECES;
          // A direction over the whole ball, a little upwards.
          const turn = flat.random.range(0, 2 * Math.PI),
            lift = flat.random.range(-0.4, 1),
            flatness = Math.sqrt(Math.max(0, 1 - lift * lift)),
            pace = speed * flat.random.range(0.5, 1);
          piece.vx = Math.cos(turn) * flatness * pace;
          piece.vy = lift * pace;
          piece.vz = Math.sin(turn) * flatness * pace;
          piece.life = piece.span = life * flat.random.range(0.6, 1);
          piece.gravity = gravity;
          piece.size = size;
          piece.thing.color = color;
          piece.thing.x = x;
          piece.thing.y = y;
          piece.thing.z = z;
          piece.thing.scale = size;
          piece.thing.visible = true;
        }
      },
      dispose() {
        if (disposal !== undefined) return disposal;
        beginClosing();
        // Publish before callbacks, but stop the flat game synchronously so a motion cannot keep chaining.
        let resolve!: () => void, reject!: (cause: unknown) => void;
        disposal = new Promise<void>((done, fail) => {
          resolve = done;
          reject = fail;
        });
        void (async () => {
          const failures: unknown[] = [];
          try {
            await flat.dispose();
          } catch (cause) {
            failures.push(cause);
          }
          try {
            await disposeWorld();
          } catch (cause) {
            failures.push(cause);
          }
          throwCleanupFailures(failures);
        })().then(resolve, reject);
        return disposal;
      }
    };
    // Everything of the flat game is there under these: its getters read the game's own state, whoever asks.
    const whole = Object.create(flat, {
      ...Object.getOwnPropertyDescriptors(added),
      scene: { value: scene, enumerable: true },
      camera: { value: camera, enumerable: true },
      sun: { value: sun, enumerable: true },
      app: {
        get: () => app,
        enumerable: true
      }
    }) as Play3DGame;
    return whole;
  };

  const flat = await play({
    ...options,
    // The interface is drawn by WebGL2 unless WebGPU is asked for, as the overlay of a World3D app is.
    backend: options.backend ?? 'webgl2',
    transparent: true,
    async setup(given) {
      admit();
      if (game === undefined) {
        // The picture goes on a canvas of its own, under the game's, in the same place whatever the page does.
        const over = given.canvas,
          holder = over.parentElement;
        if (holder === null) throw invalid('play3d needs its canvas in the page');
        const page = over.ownerDocument,
          win = page.defaultView ?? (globalThis as unknown as Window);
        const under = (deep = page.createElement('canvas'));
        under.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;display:block';
        over.style.position = 'relative';
        holder.insertBefore(under, over);
        const place = (): void => {
          const outer = holder.getBoundingClientRect(),
            box = over.getBoundingClientRect();
          under.style.left = box.left - outer.left + holder.scrollLeft + 'px';
          under.style.top = box.top - outer.top + holder.scrollTop + 'px';
          under.style.width = box.width + 'px';
          under.style.height = box.height + 'px';
        };
        place();
        const Resize = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver,
          observer = Resize ? new Resize(place) : undefined;
        observer?.observe(over);
        win.addEventListener('resize', place);
        unplace = () => {
          observer?.disconnect();
          win.removeEventListener('resize', place);
        };
        creatingApp = createWorld3DApp(under, {
          backend: options.backend === 'webgpu' ? 'webgpu' : 'webgl2',
          ...(options.onError === undefined ? {} : { onError: options.onError })
        });
        try {
          app = await creatingApp;
        } finally {
          creatingApp = undefined;
        }
        if (closing || given.scope.state !== 'open') throw new EgretError('SCOPE_CLOSED');
        scene.addChild(eye);
        scene.addChild(sky);
        scene.addChild(sun);
        settle();
        app.show(scene, eye);
        game = extend(given);
      } else clear();
      try {
        await setup?.(game);
        if (closing || given.scope.state !== 'open') throw new EgretError('SCOPE_CLOSED');
        settle();
      } catch (cause) {
        // A failed setup may already have attached borrowed models and allocated owned primitives.
        if (!closing) {
          try {
            clear();
          } catch (cleanupFailure) {
            throw new AggregateError([cause, cleanupFailure], 'Play3D setup and rollback failed');
          }
        }
        throw cause;
      }
    },
    update(seconds) {
      if (game === undefined) return;
      const current = game,
        version = generation;
      const running = (): boolean =>
        generation === version &&
        !clearing &&
        !closing &&
        !current.paused &&
        current.scope.state === 'open' &&
        current.browser.loop.state === 'running';
      if (!running()) return;
      if (tapErrors.failure !== undefined) {
        const { cause } = tapErrors.failure;
        delete tapErrors.failure;
        throw cause;
      }
      tapped(current as unknown as PlayGame);
      if (!running()) return;
      update?.(seconds, current);
      if (!running()) return;
      after(seconds);
    }
  }).catch(async (cause: unknown) => {
    try {
      // A callback may have closed the published game while its initial setup was pending.
      if (game === undefined) await disposeWorld();
      else await game.dispose();
    } catch (cleanupFailure) {
      if (cause === cleanupFailure) throw cause;
      throw new AggregateError([cause, cleanupFailure], 'Play3D setup and cleanup failed');
    }
    throw cause;
  });
  return game ?? extend(flat);
}
