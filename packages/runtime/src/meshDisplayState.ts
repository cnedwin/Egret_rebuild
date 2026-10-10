import type { TexturedGeometry2D, TextureRegion2D } from "@egret/contracts";
import type { AssetLease } from "./AssetLease.js";
import type { DisplayObject } from "./DisplayObject.js";
import type { Texture } from "./Texture.js";

export interface MeshCaptureState {
  readonly lease: AssetLease<Texture>;
  readonly geometry: TexturedGeometry2D;
  readonly sourceRect: TextureRegion2D;
}

// One authoritative content slot; erased imports avoid a display-class backedge.
const states = new WeakMap<object, MeshCaptureState | undefined>();

/** Registration survives clearing and terminal disposal of an authentic Mesh. */
export function hasMeshState(value: unknown): boolean { return states.has(value as object); }

/** Cached content conveys no active lease entitlement or live Texture authority. */
export function readMeshState(node: DisplayObject): MeshCaptureState | undefined { return states.get(node); }

/** Only Mesh2D writes this slot after its private identity and lifecycle checks. */
export function writeMeshState(node: DisplayObject, value: MeshCaptureState | undefined): void { states.set(node, value); }
