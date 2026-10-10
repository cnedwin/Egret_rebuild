import type { TextureRegion2D } from "@egret/contracts";
import { isAssetLease, readAssetLeaseValue } from "./AssetLease.js";
import type { AssetLease } from "./AssetLease.js";
import { DisplayObject } from "./DisplayObject.js";
import { hasBitmapState, readBitmapState, writeBitmapState } from "./bitmapDisplayState.js";
import type { BitmapCaptureState } from "./bitmapDisplayState.js";
export type { BitmapCaptureState } from "./bitmapDisplayState.js";
import { assertLive, isTerminated } from "./displayTreeState.js";
import { EgretError } from "./EgretError.js";
import { commitBinding, engineOf } from "./ownership.js";
import type { EngineContext } from "./ownership.js";
import { isTexture, readTextureSnapshot } from "./Texture.js";
import type { Texture, TextureSnapshot2D } from "./Texture.js";

const mutations = new WeakSet<object>();

function assertBitmap(value: unknown): void {
  if (!hasBitmapState(value as object)) throw new EgretError("BITMAP_INVALID");
}

function captureState(lease: AssetLease<Texture>, sourceRect: TextureRegion2D): BitmapCaptureState {
  return Object.freeze({ lease, sourceRect, width: sourceRect.width, height: sourceRect.height });
}

/** Shared lease/crop guard starts after the established lifecycle priority. */
function beginMutation(node: Bitmap): EngineContext {
  assertBitmap(node);
  assertLive(node);
  const engine = engineOf(node)!;
  engine.assertOpen();
  if (mutations.has(node)) throw new EgretError("BITMAP_MUTATION_REENTRANT");
  mutations.add(node);
  return engine;
}

/** Terminal side effects win before numeric semantics; no slot resurrection. */
function revalidateMutation(node: Bitmap, engine: EngineContext, previous: BitmapCaptureState | undefined): void {
  assertLive(node);
  engine.assertOpen();
  if (readBitmapState(node) !== previous) throw new EgretError("BITMAP_MUTATION_REENTRANT");
}

interface RegionFields {
  readonly x: unknown;
  readonly y: unknown;
  readonly width: unknown;
  readonly height: unknown;
}

/** Complete ordered external reads before semantics; preserve every thrown cause. */
function readRegion(input: TextureRegion2D): RegionFields {
  if (input === null || typeof input !== "object") {
    throw new EgretError("BITMAP_REGION_INVALID", { cause: new TypeError("Bitmap region must be a record") });
  }
  let x: unknown, y: unknown, width: unknown, height: unknown;
  try {
    x = input.x;
    y = input.y;
    width = input.width;
    height = input.height;
  } catch (cause) {
    throw new EgretError("BITMAP_REGION_INVALID", { cause });
  }
  // Keep allocation outside the read-fault wrapper and retain no caller record.
  return { x, y, width, height };
}

function regionInteger(value: unknown, positive: boolean): number {
  if (typeof value !== "number") {
    throw new EgretError("BITMAP_REGION_INVALID", { cause: new TypeError("Bitmap region fields must be numbers") });
  }
  if (!Number.isSafeInteger(value) || (positive ? value <= 0 : value < 0)) {
    throw new EgretError("BITMAP_REGION_INVALID", { cause: new RangeError("Bitmap region integer range") });
  }
  return value === 0 ? 0 : value;
}

/** Absolute crops stay within the authenticated Texture's immutable image view. */
function copyRegion(base: TextureRegion2D, fields: RegionFields): TextureRegion2D {
  const x = regionInteger(fields.x, false), y = regionInteger(fields.y, false);
  const width = regionInteger(fields.width, true), height = regionInteger(fields.height, true);
  const right = x + width, bottom = y + height;
  if (!Number.isSafeInteger(right) || !Number.isSafeInteger(bottom)
    || x < base.x || y < base.y || right > base.x + base.width || bottom > base.y + base.height) {
    throw new EgretError("BITMAP_REGION_INVALID", { cause: new RangeError("Bitmap region exceeds its Texture view") });
  }
  return Object.freeze({ x, y, width, height });
}

/** A leaf borrowing one exact lease; engine affinity outlives clearing its slot. */
export class Bitmap extends DisplayObject {
  public constructor(textureLease: AssetLease<Texture>) {
    super();
    const snapshot = readBitmapImage(textureLease);
    const engine = engineOf(textureLease)!;
    engine.assertOpen();
    commitBinding([this], engine);
    writeBitmapState(this, captureState(textureLease, snapshot.sourceRect));
  }

  public get textureLease(): AssetLease<Texture> | undefined {
    assertBitmap(this);
    return readBitmapState(this)?.lease;
  }

  public set textureLease(value: AssetLease<Texture> | undefined) {
    const engine = beginMutation(this);
    try {
      const previous = readBitmapState(this);
      if (value === undefined) { writeBitmapState(this, undefined); return; }
      if (!isAssetLease(value)) throw new EgretError("BITMAP_LEASE_INVALID");
      if (engineOf(value) !== engine) throw new EgretError("ENGINE_MISMATCH");
      const snapshot = readBitmapImage(value);
      revalidateMutation(this, engine, previous);
      // Every successful assignment, including the same lease, resets the crop.
      writeBitmapState(this, captureState(value, snapshot.sourceRect));
    } finally {
      mutations.delete(this);
    }
  }

  /** Cached metadata remains readable without granting live image entitlement. */
  public get sourceRect(): TextureRegion2D | undefined {
    assertBitmap(this);
    return readBitmapState(this)?.sourceRect;
  }

  public set sourceRect(value: TextureRegion2D | undefined) {
    const engine = beginMutation(this);
    try {
      const previous = readBitmapState(this);
      if (previous === undefined) {
        if (value !== undefined) throw new EgretError("BITMAP_TEXTURE_REQUIRED");
        return;
      }
      // Entitlement and live-view authority precede every external field read.
      const snapshot = readBitmapImage(previous.lease);
      if (value === undefined) {
        revalidateMutation(this, engine, previous);
        writeBitmapState(this, captureState(previous.lease, snapshot.sourceRect));
        return;
      }
      const fields = readRegion(value);
      revalidateMutation(this, engine, previous);
      const current = readBitmapImage(previous.lease);
      const sourceRect = copyRegion(current.sourceRect, fields);
      // Crop and natural geometry become observable together, without callbacks.
      writeBitmapState(this, captureState(previous.lease, sourceRect));
    } finally {
      mutations.delete(this);
    }
  }

  public get naturalWidth(): number { assertBitmap(this); return readBitmapState(this)?.width ?? 0; }
  public get naturalHeight(): number { assertBitmap(this); return readBitmapState(this)?.height ?? 0; }

  /** Drop the borrow before base cleanup/reentry; the caller still owns the lease. */
  public override dispose(): void {
    assertBitmap(this);
    if (isTerminated(this)) return;
    writeBitmapState(this, undefined);
    super.dispose();
  }
}

/** Brand and slot only: geometry may be validated before any lease read. */
export function bitmapCaptureState(node: DisplayObject): BitmapCaptureState | undefined { return readBitmapState(node); }

/** Internal binding authority; a cleared slot remains distinguishable from retirement. */
export function readBitmapBinding(node: Bitmap): BitmapCaptureState | undefined {
  assertBitmap(node);
  assertLive(node);
  engineOf(node)!.assertOpen();
  return readBitmapState(node);
}

/** Exact entitlement precedes value/live checks; public value getters are not authority. */
export function readBitmapImage(lease: AssetLease<Texture>): TextureSnapshot2D {
  if (!isAssetLease(lease)) throw new EgretError("BITMAP_LEASE_INVALID");
  const value = readAssetLeaseValue(lease);
  if (!isTexture(value)) throw new EgretError("BITMAP_TEXTURE_INVALID");
  return readTextureSnapshot(value);
}
