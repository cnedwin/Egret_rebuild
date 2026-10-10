import type { DisplayObject } from './DisplayObject.js';
import type { AssetLease } from './AssetLease.js';
import type { Texture } from './Texture.js';
import type { TextureRegion2D } from '@egret/contracts';

export interface BitmapCaptureState {
  readonly lease: AssetLease<Texture>;
  readonly sourceRect: TextureRegion2D;
  readonly width: number;
  readonly height: number;
}

// One authoritative slot table, moved from Bitmap without duplicating geometry.
// All references to display/resource classes are erased type-only imports.
const states = new WeakMap<object, BitmapCaptureState | undefined>();

/** A registered cleared slot remains different from an unregistered receiver. */
export function hasBitmapState(value: unknown): boolean { return states.has(value as object); }
/** Read cached metadata only; this port grants no live image entitlement. */
export function readBitmapState(node: DisplayObject): BitmapCaptureState | undefined { return states.get(node); }
/** Bitmap alone writes its slot, preserving existing mutation/lifetime guards. */
export function writeBitmapState(node: DisplayObject, value: BitmapCaptureState | undefined): void { states.set(node, value); }
