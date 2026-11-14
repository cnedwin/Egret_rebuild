// SPDX-License-Identifier: Apache-2.0
import type { DisplayObject } from '@egret/runtime';

export interface CameraPoint { readonly x: number; readonly y: number; }
export interface CameraRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
/** What the camera follows: a display object inside the world, or a function that says where to look. */
export type CameraTarget = DisplayObject | (() => CameraPoint);
export interface CameraFollowOptions {
  /** Seconds for the camera to close most of the distance (about 63 %). 0 follows at once. Defaults to 0.15. */
  readonly smoothing?: number;
  /** A rectangle around the middle of the view, in world units, inside which the target moves without the camera. */
  readonly deadZone?: { readonly width: number; readonly height: number };
  /** Added to the target's place, in world units. */
  readonly offset?: CameraPoint;
}
export interface CameraLayerOptions {
  /**
   * How far the layer moves with the camera: 0 stands still, 1 moves with the world, 0.5 at half the speed. When the
   * camera looks at the middle of the view the layer is where it was put. Defaults to 0.5.
   */
  readonly factor?: number | CameraPoint;
  /** How much of the zoom the layer takes: 0 none, 1 all of it. Defaults to 1. */
  readonly zoomFactor?: number;
}
export interface CameraShakeOptions {
  /** Added trauma, 0 to 1. The shake is as strong as the square of the trauma. Defaults to 0.5. */
  readonly trauma?: number;
}
export interface Camera2DOptions {
  /** The container that holds the world. The camera owns its place, scale, rotation and anchor. */
  readonly world: DisplayObject;
  /** The size of what is shown, in stage units. */
  readonly width: number;
  readonly height: number;
  /** Where the camera looks first, in world units. Defaults to the middle of the view. */
  readonly center?: CameraPoint;
  /** Defaults to 1. */
  readonly zoom?: number;
  /** Defaults to 0.25 and 4. */
  readonly minZoom?: number;
  readonly maxZoom?: number;
  /** Degrees. Defaults to 0. */
  readonly rotation?: number;
  /** The camera never shows outside this rectangle of the world. Rotation is not taken into account. */
  readonly bounds?: CameraRect;
  /** The farthest a shake moves the view, in stage units. Defaults to 16. */
  readonly shakeOffset?: number;
  /** The farthest a shake turns the view, in degrees. Defaults to 0. */
  readonly shakeRotation?: number;
  /** Trauma lost each second. Defaults to 1. */
  readonly shakeDecay?: number;
  /** Shakes per second. Defaults to 15. */
  readonly shakeFrequency?: number;
  /** The same seed shakes the same way. Defaults to 1. */
  readonly seed?: number;
  /** Whole stage units for the place of the world, so that pixel art does not shimmer. Defaults to false. */
  readonly roundToPixel?: boolean;
}
export interface CameraSnapshot {
  readonly center: CameraPoint;
  readonly zoom: number;
  readonly rotation: number;
  readonly trauma: number;
  /** The rectangle of the world that is shown, before any shake and rotation. */
  readonly view: CameraRect;
  readonly following: boolean;
  /** Seconds the camera has been updated for. */
  readonly time: number;
}
/** A view of a 2D world: where it looks, how close, what it follows, and how it shakes. It is moved by `update`. */
export interface Camera2D {
  readonly state: 'active' | 'closed';
  readonly center: CameraPoint;
  readonly zoom: number;
  readonly rotation: number;
  readonly width: number;
  readonly height: number;
  /** Looks at a place at once. A follow still pulls the camera back at the next update. */
  lookAt(x: number, y: number): void;
  /** Moves to a place over the seconds given. A follow is stopped. */
  panTo(x: number, y: number, seconds: number): void;
  setZoom(zoom: number): void;
  /** Zooms over the seconds given, keeping the middle of the view where it is. */
  zoomTo(zoom: number, seconds: number): void;
  setRotation(degrees: number): void;
  follow(target: CameraTarget, options?: CameraFollowOptions): void;
  stopFollowing(): void;
  setBounds(bounds: CameraRect | undefined): void;
  /** Changes what is shown, as when the canvas is resized. */
  resize(width: number, height: number): void;
  shake(options?: CameraShakeOptions): void;
  /** A layer drawn behind or in front of the world that moves at its own speed. The camera owns its place, scale and anchor. */
  addLayer(layer: DisplayObject, options?: CameraLayerOptions): () => void;
  /** Advances the follow, the pan, the zoom and the shake by the seconds given, and places the world and the layers. */
  update(seconds: number): void;
  /** Where a point of the world is on the stage, and back, as the camera places them now. */
  worldToScreen(x: number, y: number): CameraPoint;
  screenToWorld(x: number, y: number): CameraPoint;
  /** Whether a rectangle of the world can be seen, before any shake and rotation. */
  isVisible(rect: CameraRect): boolean;
  snapshot(): CameraSnapshot;
  /** Gives the world and the layers back their place, scale, rotation and anchor. A scope can own a camera through this. */
  dispose(): void;
}
