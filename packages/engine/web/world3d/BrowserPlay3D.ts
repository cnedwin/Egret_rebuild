// SPDX-License-Identifier: Apache-2.0
// A whole small 3D game from one call. The picture is a World3D app; everything else is `play`, drawn clear over
// it on a canvas of its own: the keys, the pointer, sound, timers, tweens, text and buttons. What is added here is
// what a 3D game makes its world of: boxes, balls and a ground that are placed by plain numbers, a camera that
// follows, a sun, tests of distance and overlap, and pieces thrown out by a hit; things grouped to move as one,
// things that glow, lamps, and snow or rain.
import { EgretError } from '@egret/runtime';
import type { DisplayObject, Scope } from '@egret/runtime';
import { play } from '../play.js';
import type { PlayGame, PlayOptions } from '../play.js';
import { Object3D, Scene3D } from '../../rendering/world3d/Object3D.js';
import { Mesh3D } from '../../rendering/world3d/Mesh3D.js';
import type { Geometry3D } from '../../rendering/world3d/Geometry3D.js';
import type { Camera3D } from '../../rendering/world3d/Camera3D.js';
import { createPerspectiveCamera3D } from '../../rendering/world3d/Camera3D.js';
import type { Light3D } from '../../rendering/world3d/Light3D.js';
import {
  createDirectionalLight3D,
  createHemisphereLight3D,
  createPointLight3D
} from '../../rendering/world3d/Light3D.js';
import { GpuParticles3D } from '../../rendering/world3d/GpuParticles3D.js';
import { Texture3D } from '../../rendering/world3d/Texture3D.js';
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
import { createWorld3DView } from './World3DView.js';
import type { World3DView, World3DViewOptions } from './World3DView.js';
import type { Renderer3D } from './frame3D.js';

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
  #glow = 0;
  #shadow: boolean | undefined;
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
    if (this.#glow > 0) setColor3D(this.#material.emissive, value);
  }
  /**
   * How much it shines with its own colour, lit or not: 0 (the default) not at all, 1 as bright as its colour,
   * more for a lamp or a screen. A thing that glows is not hidden by fog. A model keeps the materials it has.
   */
  public get glow(): number {
    return this.#glow;
  }
  public set glow(value: number) {
    if (!finite(value) || value < 0 || this.#material === undefined) return;
    this.#glow = value;
    setColor3D(this.#material.emissive, value > 0 ? this.#color : 0);
    this.#material.emissiveIntensity = value;
    // What glows is seen through the fog and the snow, as a lighthouse or a lantern is at night.
    this.#material.fog = value === 0;
    this.#blend();
  }
  /** A see-through thing that glows adds its light to what is behind it, as a beam does; any other mixes over it. */
  #blend(): void {
    if (this.#material === undefined) return;
    this.#material.blending = this.#glow > 0 && this.#material.opacity < 1 ? 'additive' : 'normal';
    // Fog, blending and the alpha mode choose the shader, so a change of them is told to the material.
    this.#material.touch();
  }
  /**
   * How much of it is seen, 0 to 1: 1 (the default) is solid, less lets what is behind it show through, as glass, a
   * ghost or, with `glow`, a beam of light, whose light is added to what is behind it. A see-through thing casts no
   * shadow. A model keeps the materials it has.
   */
  public get opacity(): number {
    return this.#material?.opacity ?? 1;
  }
  public set opacity(value: number) {
    if (!finite(value) || this.#material === undefined) return;
    const opacity = Math.min(1, Math.max(0, value)),
      solid = opacity >= 1;
    this.#material.opacity = opacity;
    this.#material.alphaMode = solid ? 'opaque' : 'blend';
    this.#material.depthWrite = solid;
    this.#blend();
    if (this.node instanceof Mesh3D) {
      // It keeps the shadow it had when it is made solid again.
      if (!solid && this.#shadow === undefined) {
        this.#shadow = this.node.castShadow;
        this.node.castShadow = false;
      } else if (solid && this.#shadow !== undefined) {
        this.node.castShadow = this.#shadow;
        this.#shadow = undefined;
      }
    }
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

/**
 * A lamp: light from a point of the world that fades out by `range`. It is placed and changed by plain numbers, and
 * `game.remove` puts it out. Up to eight are lit fully; more are lit by a coarser way.
 */
export class PlayLamp3D {
  public readonly node: Light3D;
  #color: number;
  #removed = false;
  public constructor(color: number, intensity: number, range: number) {
    this.#color = color;
    this.node = createPointLight3D({ color, intensity, range });
  }
  public get x(): number {
    return this.node.position[0]!;
  }
  public set x(value: number) {
    if (finite(value)) this.node.setPosition(value, this.node.position[1]!, this.node.position[2]!);
  }
  public get y(): number {
    return this.node.position[1]!;
  }
  public set y(value: number) {
    if (finite(value)) this.node.setPosition(this.node.position[0]!, value, this.node.position[2]!);
  }
  public get z(): number {
    return this.node.position[2]!;
  }
  public set z(value: number) {
    if (finite(value)) this.node.setPosition(this.node.position[0]!, this.node.position[1]!, value);
  }
  public get color(): number {
    return this.#color;
  }
  public set color(value: number) {
    if (!colour(value)) return;
    this.#color = value;
    setColor3D(this.node.color, value);
  }
  /** How bright it is; 0 is dark. */
  public get intensity(): number {
    return this.node.intensity;
  }
  public set intensity(value: number) {
    if (finite(value) && value >= 0) this.node.intensity = value;
  }
  /** How far it reaches before it has faded out, in units of the world. */
  public get range(): number {
    return this.node.range;
  }
  public set range(value: number) {
    if (above(value)) this.node.range = value;
  }
  public get visible(): boolean {
    return this.node.visible;
  }
  public set visible(value: boolean) {
    this.node.visible = value === true;
  }
  public get removed(): boolean {
    return this.#removed;
  }
  public leave(): void {
    if (this.#removed) return;
    this.#removed = true;
    this.node.removeFromParent();
  }
}
/** A lamp to light: how bright, and how far it reaches. */
export interface PlayLampOptions3D {
  /** How bright it is: 4 unless given. */
  readonly intensity?: number;
  /** How far it reaches: 8 unless given. */
  readonly range?: number;
}
/** What falls from the sky: snow, rain, or nothing. */
export type PlayWeather3D = 'snow' | 'rain' | 'none';
/** Weather to show: how much rain or snow. */
export interface PlayWeatherOptions3D {
  /** How much falls: 1 unless given, from 0 to 3. */
  readonly amount?: number;
}

/** The camera: where it is and what it looks at, by plain numbers. */
export interface PlayCamera3D {
  x: number;
  y: number;
  z: number;
  /** The angle it sees from top to bottom, in degrees: 55 unless set. */
  fov: number;
  /**
   * 0 unless set. Above 0, a view narrower than this shape (its width over its height) keeps the angle from side to
   * side that `fov` gives at this shape and sees further up and down instead: with 1, a phone held upright shows as much
   * of the sides as a square view does. With 0, `fov` is the angle from top to bottom on every shape, as in most
   * engines, and a phone held upright sees much less of the sides than one held sideways.
   */
  keepWidthBelow: number;
  /** Turns it to look at a point. It goes on looking there as it moves. */
  lookAt(x: number, y: number, z: number): void;
  readonly node: Camera3D;
}
/** How the camera follows: where it sits behind, how smoothly, and whether it turns with the target. */
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
  /**
   * How far above the thing the camera looks: 0 unless given. A tall tower or a sky the thing moves under is framed by
   * looking higher; the camera keeps its place.
   */
  readonly lookY?: number;
}
/** A burst of particles: its color and count, how fast and how long they fly, their size and gravity. */
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
/** How a 3D play game looks: its background and sky, its ground, its light and sun, and its fog. */
export interface PlayLook3D {
  /** What is behind everything, and the colour of the fog. */
  readonly background?: number;
  /** The colour of the light from above. */
  readonly sky?: number;
  /** The colour of the light from below. */
  readonly ground?: number;
  /** How strong the light from above and below is, 0 to 16: 0.22 at night, 0.9 by day. */
  readonly light?: number;
  /** The colour of the sun. */
  readonly sun?: number;
  /** How strong the sun is, 0 to 16: 0.35 at night, 2.4 by day. */
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
/** Everything a small 3D game is given: its scene and camera, its input, and calls that make, move and light things. */
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
  /** Takes a thing or a lamp out of the world, or a sprite off the interface. */
  remove(body: Body | PlayLamp3D): void;
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
  /**
   * Makes things one: a group that is placed, turned, scaled, tweened and tested as one thing, with the things in
   * it where they are within it. Their places are now from the group's place, which is `at`, 0 unless given. Test
   * the group, not its parts, for overlaps; removing the group removes its parts.
   */
  group(parts: readonly PlayThing3D[], at?: PlayPlace3D): PlayThing3D;
  /** A lamp at a place: light of a colour that fades out by its range. */
  lamp(color: number, at?: PlayPlace3D, options?: PlayLampOptions3D): PlayLamp3D;
  /**
   * Snow or rain falling around what the camera looks at, or `'none'` to stop it. `{ amount }` is how much, 1
   * unless given. A restart keeps it.
   */
  weather(kind: PlayWeather3D, options?: PlayWeatherOptions3D): void;
}
/** A small 3D game to start: its setup and update, and the options of a 2D play game. */
export interface Play3DOptions extends Omit<PlayOptions, 'setup' | 'update' | 'canvas' | 'renderMode'> {
  readonly setup?: (game: Play3DGame) => void | Promise<void>;
  readonly update?: (seconds: number, game: Play3DGame) => void;
}

/** A Play interface over a caller-configured 3D surface, sharing the Play clock and Scope. */
export interface Play3DAttachedOptions extends Omit<PlayOptions, 'transparent'> {
  /**
   * After optional Play setup, returns the borrowed world to draw. It may load art asynchronously before becoming
   * active, or return undefined to leave just the native interface visible (for example, a retry panel).
   */
  readonly world: (game: PlayGame) => World3DViewOptions | undefined | Promise<World3DViewOptions | undefined>;
}

export interface Play3DAttachedSession {
  /** The very same game passed to setup, world, arrange and update. */
  readonly game: PlayGame;
  /** The current world subscription, absent during loading, a failed restart, or after disposal. */
  readonly view: World3DView | undefined;
}

// This companion owns the view subscription only. A renderer may be reused after its old view retires, but
// one cannot be attached to two live companion sessions; the caller must also stop any independently run loop.
const attachedRenderers = new WeakMap<Renderer3D, World3DView>();

/**
 * Starts transparent Play above an existing 3D canvas. The caller chooses canvas placement and all renderer,
 * scene and camera settings. No second Engine or animation-frame loop is created.
 */
export async function play3dAttached(options: Play3DAttachedOptions): Promise<Play3DAttachedSession> {
  if (options === null || typeof options !== 'object') throw invalid('play3dAttached takes an object of options');
  const { world, setup, arrange, ...flatOptions } = options;
  if (typeof world !== 'function') throw invalid('world is a function');
  if (setup !== undefined && typeof setup !== 'function') throw invalid('setup is a function');
  if (arrange !== undefined && typeof arrange !== 'function') throw invalid('arrange is a function');
  let view: World3DView | undefined;
  let viewScope: Scope | undefined;
  let parentRegistered = false;
  const retire = (): void => {
    const previous = view,
      scope = viewScope;
    view = undefined;
    viewScope = undefined;
    if (previous !== undefined && attachedRenderers.get(previous.renderer) === previous)
      attachedRenderers.delete(previous.renderer);
    // Closing this generation removes its registrations immediately, instead of retaining each retired view in
    // the lifetime Scope until the whole game closes. A borrowed renderer is never registered here.
    scope?.dispose();
  };
  const open = (given: PlayGame): void => {
    if (given.scope.state !== 'open') throw new EgretError('SCOPE_CLOSED');
  };
  const game = await play({
    ...flatOptions,
    transparent: true,
    async setup(given) {
      retire();
      open(given);
      if (!parentRegistered) {
        given.scope.use({ dispose: retire });
        parentRegistered = true;
      }
      await setup?.(given);
      open(given);
      const candidate = await world(given);
      open(given);
      if (candidate === undefined) return;
      if (
        candidate === null ||
        typeof candidate !== 'object' ||
        !candidate.renderer?.canvas ||
        typeof candidate.renderer.render !== 'function' ||
        !candidate.scene ||
        !candidate.camera
      )
        throw invalid('world returns a renderer, scene and camera, or undefined');
      const { renderer } = candidate;
      if (renderer.canvas === given.canvas) throw invalid('world and Play use separate canvases');
      const existing = attachedRenderers.get(renderer);
      if (existing !== undefined && !existing.isDisposed) throw invalid('world renderer is already attached');
      viewScope = given.engine.createScope();
      try {
        view = createWorld3DView(given.engine, viewScope, candidate);
        attachedRenderers.set(renderer, view);
      } catch (cause) {
        retire();
        throw cause;
      }
    },
    ...(arrange === undefined
      ? {}
      : {
          arrange(given: PlayGame): void {
            try {
              arrange(given);
            } catch (cause) {
              retire();
              throw cause;
            }
          }
        })
  });
  return {
    game,
    get view() {
      return view?.isDisposed ? undefined : view;
    }
  };
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
 * The angle from top to bottom, in degrees, that a camera of `fov` shows on a view of `aspect` (width over height) when
 * it keeps, on a view narrower than `keepWidthBelow`, the angle from side to side it has at that shape: `fov` itself on
 * a view as wide or wider, or with `keepWidthBelow` 0. At most 170 degrees.
 */
export function fovForAspect3D(fov: number, aspect: number, keepWidthBelow: number): number {
  if (!(keepWidthBelow > 0) || !(aspect > 0) || aspect >= keepWidthBelow) return fov;
  const across = Math.tan((fov * Math.PI) / 360) * keepWidthBelow;
  return Math.min(170, (360 / Math.PI) * Math.atan(across / aspect));
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

// The browser owns its canvas and renderer. Other presenters can render the same
// scene and camera on their own surface while keeping the original gameplay.
interface Play3DSurface {
  readonly ready?: Promise<World3DApp>;
  show?(scene: Scene3D, camera: Camera3D): void;
  unplace?(): void;
  remove?(): void;
}

function browserSurface(given: PlayGame, options: Play3DOptions): Play3DSurface {
  // The picture goes on a canvas of its own, under the game's, in the same place whatever the page does.
  const over = given.canvas,
    holder = over.parentElement;
  if (holder === null) throw invalid('play3d needs its canvas in the page');
  const page = over.ownerDocument,
    win = page.defaultView ?? (globalThis as unknown as Window);
  const under = page.createElement('canvas');
  under.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;display:block';
  const initialPosition = over.style.position;
  let observer: ResizeObserver | undefined;
  const place = (): void => {
    const outer = holder.getBoundingClientRect(),
      box = over.getBoundingClientRect();
    under.style.left = box.left - outer.left + holder.scrollLeft + 'px';
    under.style.top = box.top - outer.top + holder.scrollTop + 'px';
    under.style.width = box.width + 'px';
    under.style.height = box.height + 'px';
  };
  const unplace = (): void => cleanUp([() => win.removeEventListener('resize', place), () => observer?.disconnect()]);
  try {
    over.style.position = 'relative';
    holder.insertBefore(under, over);
    place();
    const Resize = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    observer = Resize ? new Resize(place) : undefined;
    observer?.observe(over);
    win.addEventListener('resize', place);
    const ready = createWorld3DApp(under, {
      backend: options.backend === 'webgpu' ? 'webgpu' : 'webgl2',
      ...(options.onError === undefined ? {} : { onError: options.onError })
    });
    return { ready, unplace, remove: () => under.remove() };
  } catch (cause) {
    // The caller can only retire a surface after we return it. Restore the DOM
    // here even if a host listener or observer throws during registration.
    try {
      cleanUp([
        unplace,
        () => under.remove(),
        () => {
          over.style.position = initialPosition;
        }
      ]);
    } catch (cleanup) {
      throw new AggregateError([cause, cleanup], 'Play3D surface mount and rollback failed', { cause });
    }
    throw cause;
  }
}

/** Starts a 3D game in the page. See the guide `play3d.md`. */
export function play3d(options: Play3DOptions): Promise<Play3DGame> {
  return createPlay3DSession(options, play, browserSurface);
}

/** Internal host entry. The flat session owns input and UI; the surface presents the original scene. */
export async function createPlay3DSession(
  options: Play3DOptions,
  startFlat: typeof play,
  attach: (given: PlayGame, options: Play3DOptions) => Play3DSurface
): Promise<Play3DGame> {
  if (options === null || typeof options !== 'object') throw invalid('play3d takes an object of options');
  const { setup, update, background = 0x0b1020 } = options;
  if (!colour(background)) throw invalid('background is a colour from 0 to 0xffffff');
  if (setup !== undefined && typeof setup !== 'function') throw invalid('setup is a function');
  if (update !== undefined && typeof update !== 'function') throw invalid('update is a function');
  if ((options as { canvas?: unknown }).canvas !== undefined) throw invalid('play3d makes its own canvases');

  let game: Play3DGame | undefined,
    app: World3DApp | undefined,
    creatingApp: Promise<World3DApp> | undefined,
    surface: Play3DSurface | undefined;
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
  // The parts of each group, which leave with it; and the lamps that are lit.
  const groups = new WeakMap<PlayThing3D, readonly PlayThing3D[]>(),
    grouped = new WeakSet<PlayThing3D>();
  const lamps = new Set<PlayLamp3D>();
  // What falls, made when first asked for and kept over what the camera looks at.
  // A soft round dot that every flake and drop is drawn with, made when first needed.
  let dot: Texture3D | undefined, streak: Texture3D | undefined;
  const dotTexture = (): Texture3D => {
    if (dot !== undefined) return dot;
    const size = 16,
      data = new Uint8Array(4 * size * size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
        data.set([255, 255, 255, Math.round(255 * Math.max(0, Math.min(1, (1 - d) * 2.5)))], 4 * (y * size + x));
      }
    return (dot = new Texture3D({ width: size, height: size, data }, { wrapS: 'clamp', wrapT: 'clamp' }));
  };
  // A drop of rain is seen as a streak: a thin upright line, brightest in its middle and fading to its ends.
  const streakTexture = (): Texture3D => {
    if (streak !== undefined) return streak;
    const width = 8,
      height = 32,
      data = new Uint8Array(4 * width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const across = Math.max(0, 1 - Math.abs(x + 0.5 - width / 2) / 1.5),
          along = Math.sin((Math.PI * (y + 0.5)) / height);
        data.set([255, 255, 255, Math.round(255 * Math.min(1, across) * along)], 4 * (y * width + x));
      }
    return (streak = new Texture3D({ width, height, data }, { wrapS: 'clamp', wrapT: 'clamp' }));
  };
  let falling: GpuParticles3D | undefined,
    fallingKind: PlayWeather3D = 'none',
    fallingAmount = 1;
  const fall = (kind: PlayWeather3D, amount: number): void => {
    if (kind === fallingKind && amount === fallingAmount) return;
    falling?.removeFromParent();
    falling?.dispose();
    falling = undefined;
    fallingKind = kind;
    fallingAmount = amount;
    if (kind === 'none' || amount === 0) return;
    const snow = kind === 'snow';
    // A box of sky over what is looked at; flakes are left where they fall as the camera moves.
    falling = new GpuParticles3D({
      count: Math.max(1, Math.round((snow ? 1600 : 2400) * amount)),
      lifetime: snow ? [5, 7] : [0.9, 1.1],
      speed: snow ? [0.4, 0.9] : [16, 20],
      direction: [snow ? 0.15 : 0.05, -1, 0],
      spread: snow ? 0.5 : 0.04,
      gravity: [0, snow ? -0.4 : -6, 0],
      startSize: snow ? [0.12, 0.22] : [0.3, 0.42],
      startColor: snow ? 0xffffff : 0xa8bcd8,
      startOpacity: snow ? 0.95 : 0.55,
      endOpacity: snow ? 0.9 : 0.5,
      fadeIn: 0.05,
      fadeOut: 0.15,
      shape: 'box',
      extents: [22, 0.5, 22],
      loop: true,
      space: 'world',
      seed: 7,
      map: snow ? dotTexture() : streakTexture()
    });
    falling.castShadow = false;
    falling.receiveShadow = false;
    falling.setPosition(aim[0]!, aim[1]! + (snow ? 9 : 16), aim[2]!);
    scene.addChild(falling);
  };
  // The camera: where the game put it, what it looks at, and how far a shake has it out of place.
  const base = [0, 6, 12],
    aim = [0, 0, 0],
    shaken = [0, 0, 0];
  // The angle the game asked for, and the shape below which the camera keeps its width instead of its height.
  let fov = 55,
    keepWidthBelow = 0;
  const fitEye = (): void => {
    eye.fov = fovForAspect3D(fov, eye.aspect, keepWidthBelow);
  };
  let followed: PlayThing3D | undefined,
    turning = false,
    lookAbove = 0,
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
    // A strength given a colour, as 0x2a3550 for `light`, would light the world white: it is refused instead.
    for (const key of ['light', 'sunIntensity'] as const)
      if (chosen[key] !== undefined && !(finite(chosen[key]) && chosen[key] >= 0 && chosen[key] <= 16))
        throw invalid(
          key +
            ' is how strong the light is, 0 to 16 (night 0.22, day 0.9); its colour is ' +
            (key === 'light' ? 'sky' : 'sun')
        );
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
    fitEye();
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
      return fov;
    },
    set fov(value) {
      if (finite(value) && value > 1 && value < 170) {
        fov = value;
        fitEye();
      }
    },
    get keepWidthBelow() {
      return keepWidthBelow;
    },
    set keepWidthBelow(value) {
      if (finite(value) && value >= 0) {
        keepWidthBelow = value;
        fitEye();
      }
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
    // The picture covers what the window shows, which reaches past the design with fit 'expand'.
    const shown = flat.screen;
    ray.setFromCamera(
      ((flat.pointer.x - shown.x) / shown.width) * 2 - 1,
      1 - ((flat.pointer.y - shown.y) / shown.height) * 2,
      eye
    );
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
      const leaving = [...things],
        unlit = [...lamps];
      things.clear();
      lamps.clear();
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
      cleanUp([...leaving.map(thing => () => thing.leave()), ...unlit.map(lamp => () => lamp.leave())]);
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
        () => fall('none', 0),
        () => dot?.dispose(),
        () => streak?.dispose(),
        () => surface?.unplace?.(),
        () => app?.dispose(),
        () => surface?.remove?.()
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
      aim[1] = followed.y + lookAbove;
      aim[2] = followed.z;
    }
    if (shakeLeft > 0) {
      shakeLeft -= seconds;
      const reach = shakeLeft > 0 ? shakeAmount * (shakeLeft / shakeSpan) : 0;
      for (let i = 0; i < 3; i++) shaken[i] = (Math.random() * 2 - 1) * reach;
    }
    if (falling !== undefined) {
      falling.setPosition(aim[0]!, aim[1]! + (fallingKind === 'snow' ? 9 : 16), aim[2]!);
      falling.update(seconds);
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
        if (body instanceof PlayLamp3D) {
          lamps.delete(body);
          body.leave();
        } else if (isThing(body)) {
          things.delete(body);
          taps.delete(body);
          if (followed === body) followed = undefined;
          body.leave();
          for (const part of groups.get(body) ?? []) whole.remove(part);
        } else flat.remove(body);
      },
      group(parts, at = {}) {
        admit();
        if (!Array.isArray(parts) || parts.length === 0 || !parts.every(isThing))
          throw invalid('group takes a list of things');
        if (
          parts.some(part => part.removed || !things.has(part) || grouped.has(part)) ||
          new Set(parts).size !== parts.length
        )
          throw invalid('a group is made of things of the world not in a group, each once');
        if (at === null || typeof at !== 'object') throw invalid('a place is an object with x, y and z');
        const { x, y, z } = at;
        admit();
        // The box of the parts where they are, as the group's own.
        const low = [Infinity, Infinity, Infinity],
          high = [-Infinity, -Infinity, -Infinity];
        for (const part of parts) {
          const box = boxOf(part);
          for (let k = 0; k < 3; k++) {
            low[k] = Math.min(low[k]!, box[k]! - box[k + 3]!);
            high[k] = Math.max(high[k]!, box[k]! + box[k + 3]!);
          }
        }
        const node = new Object3D();
        for (const part of parts) {
          part.node.removeFromParent();
          node.addChild(part.node);
        }
        const thing = new PlayThing3D(
          node,
          0xffffff,
          [0, 1, 2].map(k => (high[k]! - low[k]!) / 2) as [number, number, number],
          [0, 1, 2].map(k => (high[k]! + low[k]!) / 2) as [number, number, number]
        );
        node.setPosition(finite(x) ? x : 0, finite(y) ? y : 0, finite(z) ? z : 0);
        scene.addChild(node);
        things.add(thing);
        groups.set(thing, [...parts]);
        for (const part of parts) grouped.add(part);
        return thing;
      },
      lamp(color, at = {}, o = {}) {
        admit();
        if (!colour(color)) throw invalid('a colour is a number from 0 to 0xffffff');
        if (at === null || typeof at !== 'object') throw invalid('a place is an object with x, y and z');
        if (o === null || typeof o !== 'object') throw invalid('a lamp takes { intensity, range }');
        const { x, y, z } = at;
        const intensity = finite(o.intensity) && o.intensity >= 0 ? o.intensity : 4,
          range = above(o.range) ? o.range : 8;
        admit();
        const lamp = new PlayLamp3D(color, intensity, range);
        lamp.node.setPosition(finite(x) ? x : 0, finite(y) ? y : 0, finite(z) ? z : 0);
        scene.addChild(lamp.node);
        lamps.add(lamp);
        return lamp;
      },
      weather(kind, o = {}) {
        admit();
        if (kind !== 'snow' && kind !== 'rain' && kind !== 'none') throw invalid("weather is 'snow', 'rain' or 'none'");
        if (o === null || typeof o !== 'object') throw invalid('weather takes { amount }');
        const amount = finite(o.amount) ? Math.max(0, Math.min(3, o.amount)) : 1;
        admit();
        fall(kind, amount);
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
        lookAbove = finite(where.lookY) ? where.lookY : 0;
        // It starts where it will stay, and does not fly in from where the camera was.
        [base[0], base[1], base[2]] = placeBy(thing);
        aim[0] = thing.x;
        aim[1] = thing.y + lookAbove;
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

  const flat = await startFlat({
    ...options,
    // The interface is drawn by WebGL2 unless WebGPU is asked for, as the overlay of a World3D app is.
    backend: options.backend ?? 'webgl2',
    transparent: true,
    async setup(given) {
      admit();
      if (game === undefined) {
        surface = attach(given, options);
        creatingApp = surface.ready;
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
        // The app sets the camera's shape from the canvas before each frame it draws; the angle follows it there.
        app?.show(scene, eye, { onUpdate: fitEye });
        surface.show?.(scene, eye);
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
