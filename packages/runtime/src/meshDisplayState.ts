import { recordVisualChange, VISUAL_CONTENT, VISUAL_BINDING } from "./displayVisualState.js";
import type { TexturedGeometry2D, SharedGeometry2D, TextureRegion2D, TextureViewRegion2D } from "@egret/contracts";
import type { AssetLease } from "./AssetLease.js";
import type { DisplayObject } from "./DisplayObject.js";
import type { Texture } from "./Texture.js";

export interface MeshCaptureState {
  readonly lease: AssetLease<Texture>;
  readonly geometry: TexturedGeometry2D | SharedGeometry2D;
  readonly sourceRect: TextureRegion2D;
  readonly viewRegion: TextureViewRegion2D | null;
  readonly regionOnly: boolean;
}

// One authoritative content slot; resource classes remain type-only imports.
const states = new WeakMap<object, MeshCaptureState | undefined>();
const readPublishedState = states.get.bind(states);

/** Slot registration survives cleanup; it is not display-class identity. */
export function hasMeshState(value: unknown): boolean { return states.has(value as object); }

/** Cached content conveys no active lease entitlement or live Texture authority. */
export function readMeshState(node: DisplayObject): MeshCaptureState | undefined { return states.get(node); }

/** Authentic Mesh2D/NineSliceBitmap operations publish only privately admitted content. */
export function writeMeshState(node: DisplayObject, value: MeshCaptureState | undefined): void {
  const changed = readPublishedState(node) !== value;
  states.set(node, value);
  // Mesh replacement, NineSlice resize and cleanup share this publication.
  if (changed) recordVisualChange(node, VISUAL_CONTENT | VISUAL_BINDING);
}
