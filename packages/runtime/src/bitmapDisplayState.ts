import { recordVisualChange, VISUAL_CONTENT, VISUAL_BINDING } from './displayVisualState.js';
import type { AtlasFrameLayout } from './atlasFrameLayout.js';
import type { DisplayObject } from './DisplayObject.js';
import type { AssetLease } from './AssetLease.js';
import type { Texture } from './Texture.js';
import type { TextureRegion2D, TextureViewRegion2D } from '@egret/contracts';

export interface BitmapCaptureState {
  readonly layout?: AtlasFrameLayout;
  readonly lease: AssetLease<Texture>;
  readonly sourceRect: TextureRegion2D;
  readonly viewRegion: TextureViewRegion2D | null;
  readonly width: number;
  readonly height: number;
}

// One authoritative slot table, moved from Bitmap without duplicating geometry.
// Resource references remain type-only; revisions retain no resource ownership.
const states = new WeakMap<object, BitmapCaptureState | undefined>();
const readPublishedState = states.get.bind(states);

/** A registered cleared slot remains different from an unregistered receiver. */
export function hasBitmapState(value: unknown): boolean { return states.has(value as object); }
/** Read cached metadata only; this port grants no live image entitlement. */
export function readBitmapState(node: DisplayObject): BitmapCaptureState | undefined { return states.get(node); }
/** Bitmap alone writes its slot, preserving existing mutation/lifetime guards. */
export function writeBitmapState(node: DisplayObject, value: BitmapCaptureState | undefined): void {
  const changed = readPublishedState(node) !== value;
  states.set(node, value);
  // Single writes, batch commits and conditional rollback share this publication.
  if (changed) recordVisualChange(node, VISUAL_CONTENT | VISUAL_BINDING);
}
