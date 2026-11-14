// SPDX-License-Identifier: Apache-2.0
import type { AssetLease, DisplayObjectContainer, Texture } from '@egret/runtime';

/** A value picked once for each particle, evenly between the two ends; a number is both ends. */
export type ParticleRange = number | readonly [number, number];
/** Where particles are born, around the place of the emitter. */
export type ParticleShape =
  | { readonly kind: 'point' }
  | { readonly kind: 'rectangle'; readonly width: number; readonly height: number }
  | { readonly kind: 'circle'; readonly radius: number; readonly edge?: boolean };
export interface ParticleEmitterOptions {
  /** The image of each particle: the whole of the texture. */
  readonly texture: AssetLease<Texture>;
  /** The most particles alive at once, 1 to 16384. Defaults to 512. */
  readonly maxParticles?: number;
  /** Particles born each second while the emitter runs. Defaults to 50. */
  readonly rate?: number;
  /** Seconds a particle lives. Defaults to 1. */
  readonly lifetime?: ParticleRange;
  /** Units a second. Defaults to 100. */
  readonly speed?: ParticleRange;
  /** Degrees of the direction a particle sets off in; 0 is right, 90 down. Defaults to [0, 360]. */
  readonly angle?: ParticleRange;
  /** Units a second, every second, across and down. Defaults to none. */
  readonly gravity?: { readonly x: number; readonly y: number };
  /** How much of its speed a particle loses each second, as a rate: 0 none. Defaults to 0. */
  readonly drag?: number;
  /** The width and height of a particle in units at the scale of 1. Defaults to 8. */
  readonly size?: number | { readonly width: number; readonly height: number };
  /** The scale a particle is born with and dies with. Default to 1. */
  readonly startScale?: ParticleRange;
  readonly endScale?: ParticleRange;
  /** The alpha it is born with and dies with. Default to 1 and 0. */
  readonly startAlpha?: number;
  readonly endAlpha?: number;
  /** The tint it is born with and dies with, as 0xRRGGBB. Default to white. */
  readonly startColor?: number;
  readonly endColor?: number;
  /** Degrees it is born turned by, and turns by each second. Default to 0. */
  readonly rotation?: ParticleRange;
  readonly spin?: ParticleRange;
  readonly shape?: ParticleShape;
  /** The same seed gives the same particles for the same updates. Defaults to 1. */
  readonly seed?: number;
  /** Whether it starts running. Defaults to true. */
  readonly running?: boolean;
  /** Seconds after which it stops by itself. Defaults to running until stopped. */
  readonly duration?: number;
}
export interface ParticleSnapshot {
  readonly alive: number;
  readonly born: number;
  /** Particles that could not be born because the most were alive. */
  readonly refused: number;
  readonly running: boolean;
  readonly time: number;
}
export interface ParticleView {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  /** 0 when born, 1 when it dies. */
  readonly age: number;
  readonly scale: number;
  readonly alpha: number;
  readonly color: number;
  readonly rotation: number;
}
/**
 * Particles drawn as one mesh. Put `display` in the world; the emitter is a place inside it, and a
 * particle stays where it was born when the emitter moves. It keeps no clock: `update` moves it.
 */
export interface ParticleEmitter {
  readonly state: 'active' | 'closed';
  readonly display: DisplayObjectContainer;
  /** The place particles are born around. */
  x: number;
  y: number;
  readonly running: boolean;
  readonly alive: number;
  start(): void;
  /** Stops new particles; those alive live out their lives. */
  stop(): void;
  /** Makes this many particles at once, running or not. */
  burst(count: number): void;
  /** Takes every particle away at once. */
  clear(): void;
  update(seconds: number): void;
  /** Each particle alive, in the order they are drawn. For checks and tools. */
  particles(): readonly ParticleView[];
  snapshot(): ParticleSnapshot;
  /** Takes the mesh off the display and lets go of it. A scope can own an emitter through this. */
  dispose(): void;
}
