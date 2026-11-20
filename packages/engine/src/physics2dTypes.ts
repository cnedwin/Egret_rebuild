// SPDX-License-Identifier: Apache-2.0
import type { DisplayObject } from '@egret/runtime';

/** A 2D vector of the physics world. */
export interface PhysicsVector {
  readonly x: number;
  readonly y: number;
}
/** A shape about the place of its body. A box and a polygon turn with the body; a circle has no turn to show. */
export type PhysicsShape =
  | { readonly kind: 'circle'; readonly radius: number }
  | { readonly kind: 'box'; readonly width: number; readonly height: number }
  | { readonly kind: 'polygon'; readonly points: readonly PhysicsVector[] };
/** A static body never moves; a kinematic one moves by its speed alone and pushes; a dynamic one is moved by everything. */
export type PhysicsBodyKind = 'static' | 'kinematic' | 'dynamic';
/** A body to add: its kind and shape, where it is and how it moves, its material, its layers and what it moves. */
export interface PhysicsBodyOptions {
  readonly kind?: PhysicsBodyKind;
  readonly shape: PhysicsShape;
  readonly x?: number;
  readonly y?: number;
  /** Degrees. */
  readonly angle?: number;
  readonly vx?: number;
  readonly vy?: number;
  /** Mass for each unit of area of a dynamic body. Defaults to 1. */
  readonly density?: number;
  /** How much of the speed into a contact comes back out of it, 0 to 1. Defaults to 0. */
  readonly restitution?: number;
  /** How much a contact holds against sliding, 0 to 1 and more. Defaults to 0.3. */
  readonly friction?: number;
  /** How much of the world's gravity the body feels. Defaults to 1. */
  readonly gravityScale?: number;
  /** The groups the body is in, and the groups it meets, as bits. Default to 1 and every group. */
  readonly layer?: number;
  readonly mask?: number;
  /** A sensor tells of what enters and leaves it and pushes nothing. */
  readonly sensor?: boolean;
  /** A display object placed where the body is, and turned as it is, after each step. */
  readonly display?: DisplayObject;
  /** Whatever the game keeps with the body. */
  readonly data?: unknown;
}
/** A body in the physics world: its place and motion, its material and layers, and the calls that push it. */
export interface PhysicsBody {
  readonly id: number;
  /** What it is now; `setKind` changes it. */
  readonly kind: PhysicsBodyKind;
  readonly shape: PhysicsShape;
  /** Infinity unless it is dynamic. */
  readonly mass: number;
  readonly sensor: boolean;
  readonly state: 'active' | 'removed';
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  restitution: number;
  friction: number;
  gravityScale: number;
  layer: number;
  mask: number;
  data: unknown;
  /** Adds speed at once: an impulse divided by the mass. */
  applyImpulse(x: number, y: number): void;
  /** Adds to the force on the body for the next step. */
  applyForce(x: number, y: number): void;
  /**
   * Makes it static, kinematic or dynamic, keeping its place, its contacts, its joints and what the game keeps with it:
   * a weight held up until its rope is cut, a crate that falls once struck. A static body stops; one made dynamic has the
   * mass of its density, as given when it was added. The change takes effect from the next step.
   */
  setKind(kind: PhysicsBodyKind): void;
  /** The box around the body, in the world. */
  bounds(): { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}
/**
 * A joint to add between two bodies, or between a body and a fixed point of the world. `'distance'` keeps the two
 * anchors at one length, as a rod; `'rope'` keeps them no further apart than it, and lets them come closer, as a rope.
 * A distance joint of length 0 pins a body to a point, as a pendulum's bob is pinned to its string.
 */
export interface PhysicsJointOptions {
  readonly kind: 'distance' | 'rope';
  readonly a: PhysicsBody;
  /** The other body. Without it the joint holds `a` to `point`, a place in the world. */
  readonly b?: PhysicsBody;
  readonly point?: PhysicsVector;
  /** Where on each body the joint is held, from its centre, turned with the body's angle. Default to the centre. */
  readonly anchorA?: PhysicsVector;
  readonly anchorB?: PhysicsVector;
  /** Defaults to the distance between the anchors when the joint is added. */
  readonly length?: number;
  /** How firmly a distance joint keeps its length, from above 0 (a soft spring) to 1 (a rod). Defaults to 1. */
  readonly stiffness?: number;
}
/** A joint of the world: its kind, its bodies and its length, which can change, as a rope that is wound in. */
export interface PhysicsJoint {
  readonly kind: 'distance' | 'rope';
  readonly a: PhysicsBody;
  readonly b: PhysicsBody | undefined;
  readonly state: 'active' | 'removed';
  length: number;
  /** How far apart its anchors are now. */
  distance(): number;
}
/** Two bodies that began or ended touching, with the normal between them. */
export interface PhysicsContact {
  readonly type: 'begin' | 'end';
  readonly a: PhysicsBody;
  readonly b: PhysicsBody;
  /** From a to b, at the moment the contact began or was last seen. */
  readonly normal: PhysicsVector;
  /** One of the two is a sensor: nothing was pushed. */
  readonly sensor: boolean;
}
/** What a ray hit: the body, where, its normal, and how far along the ray. */
export interface PhysicsRayHit {
  readonly body: PhysicsBody;
  readonly point: PhysicsVector;
  readonly normal: PhysicsVector;
  /** How far along the ray, from 0 at its start to 1 at its end. */
  readonly fraction: number;
}
/** Where a moved body ended up, and the normals of what it hit on the way. */
export interface PhysicsMoveResult {
  readonly x: number;
  readonly y: number;
  /** Whether anything stopped any of the movement. */
  readonly collided: boolean;
  /** The normals of what it slid along, pointing away from it. */
  readonly normals: readonly PhysicsVector[];
}
/** A physics world to make: its gravity, its step and iterations, and its limits. */
export interface PhysicsWorldOptions {
  /** Units a second, every second. Defaults to 0 across and 0 down. */
  readonly gravity?: PhysicsVector;
  /** The seconds of one step. A step is always this long, whatever time is given. Defaults to 1/60. */
  readonly fixedStep?: number;
  /** The most steps one update takes, so that a long pause does not freeze the game catching up. Defaults to 8. */
  readonly maxSteps?: number;
  /** Rounds of resolving contacts each step. Defaults to 8. */
  readonly iterations?: number;
  /** Bodies that meet slower than this, in units a second, do not bounce, so that what rests stays at rest. Defaults to twice the
   *  speed gravity gives in one step, and at least 1. */
  readonly bounceThreshold?: number;
  /** The side of a cell of the grid that finds which bodies may touch. Defaults to 64. */
  readonly cellSize?: number;
  /** The most bodies, 1 to 65536. Defaults to 4096. */
  readonly maxBodies?: number;
}
/** A grid of solid tiles to collide with: its size in tiles, its tile size, which are solid and where it is. */
export interface PhysicsTileColliders {
  readonly columns: number;
  readonly rows: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  /** Whether a cell is solid. Solid cells next to each other are made into as few boxes as can be. */
  solid(column: number, row: number): boolean;
  /** Where cell (0, 0) begins in the world. Defaults to (0, 0). */
  readonly x?: number;
  readonly y?: number;
  readonly layer?: number;
  readonly friction?: number;
}
/** The physics world as it is now: its bodies, contacts and steps. */
export interface PhysicsSnapshot {
  readonly bodies: number;
  readonly contacts: number;
  readonly steps: number;
  /** Seconds given but not yet stepped. */
  readonly pending: number;
}
/** A world of 2D bodies that collide, without turning: simple, steady physics for a 2D game. It keeps no clock. */
export interface PhysicsWorld {
  readonly state: 'active' | 'closed';
  gravity: PhysicsVector;
  readonly bodies: readonly PhysicsBody[];
  addBody(options: PhysicsBodyOptions): PhysicsBody;
  removeBody(body: PhysicsBody): void;
  /** Static boxes for the solid cells of a grid, such as the walls of a tile map. */
  addTileColliders(grid: PhysicsTileColliders): readonly PhysicsBody[];
  /** Takes the time given in fixed steps, and leaves the rest for the next update. Returns the steps taken. */
  step(seconds: number): number;
  /** Joins two bodies, or a body and a point. A joint goes with either of its bodies when that is removed. */
  addJoint(options: PhysicsJointOptions): PhysicsJoint;
  removeJoint(joint: PhysicsJoint): void;
  readonly joints: readonly PhysicsJoint[];
  /**
   * Told each contact that begins and ends, after the step it happened in, once that step is done. A listener may change
   * the world: add and remove bodies and joints, push bodies, change their kind. What it changes takes effect from the
   * next step, and a body it removes tells the end of its contacts at once. It may not call `step`.
   */
  onContact(listener: (contact: PhysicsContact) => void): () => void;
  /** The bodies whose shapes hold a point, or meet a rectangle. */
  queryPoint(x: number, y: number, mask?: number): readonly PhysicsBody[];
  queryRect(
    rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
    mask?: number
  ): readonly PhysicsBody[];
  /** The first body a segment meets, sensors left out. */
  raycast(from: PhysicsVector, to: PhysicsVector, mask?: number): PhysicsRayHit | undefined;
  /** Moves a body by a distance at once, sliding along what is solid instead of passing into it. For characters. */
  moveAndSlide(body: PhysicsBody, dx: number, dy: number): PhysicsMoveResult;
  snapshot(): PhysicsSnapshot;
  /** Removes every body. A scope can own a world through this. */
  dispose(): void;
}
