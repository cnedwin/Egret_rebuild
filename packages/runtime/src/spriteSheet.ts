// SPDX-License-Identifier: Apache-2.0
import type { Disposable, ImageData2D, TextureRegion2D } from "@egret/contracts";
import { isAssetLease } from "./AssetLease.js";
import type { AssetLease } from "./AssetLease.js";
import { applyBitmapAtlasFrame, readBitmapImage, spriteSheetBitmapOperations } from "./Bitmap.js";
import type { Bitmap } from "./Bitmap.js";
import { EgretError } from "./EgretError.js";
import { commitBinding, engineOf } from "./ownership.js";
import type { EngineContext } from "./ownership.js";
import type { Texture, TextureSnapshot2D } from "./Texture.js";

import { captureAtlasFrameLayout, copyAtlasFrameLayout } from './atlasFrameLayout.js';
import type { AtlasFrameLayout } from './atlasFrameLayout.js';
type AtlasRegion = TextureRegion2D & { readonly layout?: AtlasFrameLayout };

declare const SPRITE_SHEET_BRAND: unique symbol;

/** One packed absolute rectangle, indexed by its exact UTF-16 name. */
export interface SpriteSheetFrameInput {
  readonly layout?: AtlasFrameLayout;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Immutable metadata plus a separately revocable borrow of one original lease. */
export interface SpriteSheet extends Disposable {
  readonly [SPRITE_SHEET_BRAND]: void;
  readonly frameCount: number;
  readonly names: readonly string[];
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly isDisposed: boolean;
  getRegion(name: string): AtlasRegion;
  createBitmap(name: string): Bitmap;
  dispose(): void;
}

interface SheetState {
  readonly engine: EngineContext;
  readonly names: readonly string[];
  readonly regions: ReadonlyMap<string, AtlasRegion>;
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  lease: AssetLease<Texture> | undefined;
  image: ImageData2D | undefined;
  disposed: boolean;
  creatingBitmap: boolean;
}

interface FieldRead {
  readonly present: boolean;
  readonly value: unknown;
}

interface StagedFrame {
  readonly layout?: ReturnType<typeof captureAtlasFrameLayout>;
  readonly name: FieldRead;
  readonly x: FieldRead;
  readonly y: FieldRead;
  readonly width: FieldRead;
  readonly height: FieldRead;
}

interface ValidatedFrame extends AtlasRegion {
  readonly name: string;
}

const states = new WeakMap<object, SheetState>();
const arrayIsArray = Array.isArray;
const hasOwnProperty = Object.prototype.hasOwnProperty;
const apply = Reflect.apply;

function stateOf(receiver: unknown): SheetState {
  const state = states.get(receiver as object);
  if (state === undefined) throw new EgretError("SPRITE_SHEET_INVALID");
  return state;
}

/** Original context and private resource slots precede caller-controlled fields. */
function readAtlas(engine: EngineContext, lease: AssetLease<Texture>, expectedImage?: ImageData2D): TextureSnapshot2D {
  engine.assertOpen();
  const snapshot = readBitmapImage(lease);
  const { image, sourceRect } = snapshot;
  if (sourceRect.x !== 0 || sourceRect.y !== 0
    || sourceRect.width !== image.width || sourceRect.height !== image.height
    || (expectedImage !== undefined && image !== expectedImage)) {
    throw new EgretError("SPRITE_SHEET_ATLAS_INVALID");
  }
  return snapshot;
}

/** A successful source operation is revalidated outside its read-fault catch. */
function readSource<T>(operation: () => T, revalidate: () => void): T {
  let result!: T;
  let failed = false;
  let cause: unknown;
  try { result = operation(); }
  catch (error) { failed = true; cause = error; }
  // The occurrence flag preserves a caller that throws undefined.
  if (failed) throw new EgretError("SPRITE_SHEET_READ_FAILED", { cause });
  revalidate();
  return result;
}

function own(input: object, key: string, revalidate: () => void): boolean {
  return readSource(() => apply(hasOwnProperty, input, [key]) as boolean, revalidate);
}

function readField(input: object, key: string, revalidate: () => void): FieldRead {
  const present = own(input, key, revalidate);
  const value = present
    ? readSource(() => (input as unknown as Record<string, unknown>)[key], revalidate)
    : undefined;
  return { present, value };
}

/** Missing known fields are staged; a later read occurrence keeps its priority. */
function stageFrames(input: readonly SpriteSheetFrameInput[], revalidate: () => void, atlasLayout: boolean): readonly StagedFrame[] {
  if (!readSource(() => arrayIsArray(input), revalidate)) throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
  if (!own(input, "length", revalidate)) throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
  const length: unknown = readSource(() => input.length, revalidate);
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 1) {
    throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
  }
  if (length > 1024) throw new EgretError("SPRITE_SHEET_LIMIT");
  const staged: StagedFrame[] = [];
  for (let index = 0; index < length; index += 1) {
    if (!own(input, String(index), revalidate)) throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
    const record: unknown = readSource(() => input[index], revalidate);
    if (record === null || typeof record !== "object") throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
    if (readSource(() => arrayIsArray(record), revalidate)) throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
    const name = readField(record, "name", revalidate);
    const x = readField(record, "x", revalidate);
    const y = readField(record, "y", revalidate);
    const width = readField(record, "width", revalidate);
    const height = readField(record, "height", revalidate);
    const layout = atlasLayout ? captureAtlasFrameLayout(record,
      (source, key) => readField(source, key, revalidate), callback => readSource(callback, revalidate)) : undefined;
    staged.push({ name, x, y, width, height, ...(layout === undefined ? {} : { layout }) });
  }
  return staged;
}

function qualifyName(value: unknown): string {
  if (typeof value !== "string") throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
  if (value.length === 0) throw new EgretError("SPRITE_SHEET_NAME_INVALID");
  if (value.length > 128) throw new EgretError("SPRITE_SHEET_LIMIT");
  return value;
}

function coordinate(value: unknown, positive: boolean): number {
  if (typeof value !== "number") throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
  if (!Number.isSafeInteger(value) || (positive ? value <= 0 : value < 0)) {
    throw new EgretError("SPRITE_SHEET_REGION_INVALID");
  }
  return value === 0 ? 0 : value;
}

function findRegion(state: SheetState, name: unknown): AtlasRegion {
  const key = qualifyName(name);
  const region = state.regions.get(key);
  if (region === undefined) throw new EgretError("SPRITE_SHEET_FRAME_UNKNOWN");
  return region;
}

function assertCreationLive(state: SheetState, lease: AssetLease<Texture>): void {
  if (state.disposed) throw new EgretError("SPRITE_SHEET_DISPOSED");
  // Keep context authority after disposal, but never reconstruct a dropped borrow.
  readAtlas(state.engine, lease, state.image);
}

/** Only an operation throw is wrapped; successful terminal side effects stay lifecycle errors. */
function bitmapOperation<T>(operation: () => T): T {
  let result!: T;
  let failed = false;
  let cause: unknown;
  try { result = operation(); }
  catch (error) { failed = true; cause = error; }
  if (failed) throw new EgretError("SPRITE_SHEET_BITMAP_FAILED", { cause });
  return result;
}

function recordCleanup(state: SheetState, cause: unknown): void {
  // Observers and recording failures cannot replace the selected primary error.
  try { state.engine.captureCleanup(cause); } catch { /* Preserve the primary. */ }
  try {
    state.engine.report({ code: "SPRITE_SHEET_BITMAP_FAILED", phase: "display-tree", severity: "error", cause });
  } catch { /* Advanced context observers are observation only. */ }
}

/** A private failed Bitmap is retired once; caller-owned leases are never released. */
function retireFailedBitmap(state: SheetState, bitmap: Bitmap | undefined, primary: unknown): unknown {
  if (bitmap === undefined) return primary;
  let cleanupFailed = false;
  let cleanupCause: unknown;
  try { spriteSheetBitmapOperations.dispose(bitmap); }
  catch (cause) { cleanupFailed = true; cleanupCause = cause; }
  if (!cleanupFailed) return primary;
  recordCleanup(state, cleanupCause);
  if (primary instanceof EgretError) {
    return new EgretError(primary.code, { cause: primary.cause, cleanupErrors: [...primary.cleanupErrors, cleanupCause] });
  }
  return new EgretError("SPRITE_SHEET_BITMAP_FAILED", { cause: primary, cleanupErrors: [cleanupCause] });
}

function createBitmap(receiver: unknown, name: unknown): Bitmap {
  const state = stateOf(receiver);
  if (state.disposed) throw new EgretError("SPRITE_SHEET_DISPOSED");
  state.engine.assertOpen();
  if (state.creatingBitmap) throw new EgretError("SPRITE_SHEET_REENTRANT");
  state.creatingBitmap = true;
  let bitmap: Bitmap | undefined;
  try {
    const lease = state.lease!;
    assertCreationLive(state, lease);
    const region = findRegion(state, name);
    bitmap = bitmapOperation(() => spriteSheetBitmapOperations.construct(lease));
    assertCreationLive(state, lease);
    if (region.layout === undefined) bitmapOperation(() => spriteSheetBitmapOperations.setCrop(bitmap!, region));
    else bitmapOperation(() => applyBitmapAtlasFrame(bitmap!, region));
    assertCreationLive(state, lease);
    // Return no cache or ownership claim: the caller owns the genuine Bitmap.
    return bitmap;
  } catch (primary) {
    throw retireFailedBitmap(state, bitmap, primary);
  } finally {
    state.creatingBitmap = false;
  }
}

/** Facade methods close over no factory input, lease or image. */
function createFacade(): SpriteSheet {
  function receiverState(receiver: unknown): SheetState {
    if (receiver !== sheet) throw new EgretError("SPRITE_SHEET_INVALID");
    return stateOf(receiver);
  }
  const sheet = Object.freeze({
    get frameCount(): number { return receiverState(this).names.length; },
    get names(): readonly string[] { return receiverState(this).names; },
    get atlasWidth(): number { return receiverState(this).atlasWidth; },
    get atlasHeight(): number { return receiverState(this).atlasHeight; },
    get isDisposed(): boolean { return receiverState(this).disposed; },
    getRegion(this: SpriteSheet, name: string): AtlasRegion { return findRegion(receiverState(this), name); },
    createBitmap(this: SpriteSheet, name: string): Bitmap { receiverState(this); return createBitmap(this, name); },
    dispose(this: SpriteSheet): void {
      const state = receiverState(this);
      if (state.disposed) return;
      // Retire the borrow before any subsequent cleanup/reentry opportunity.
      state.disposed = true;
      state.lease = undefined;
      state.image = undefined;
    },
  }) as SpriteSheet;
  return sheet;
}

/** Build one exact-name table from a genuine full-image lease without acquiring another resource. */
export function createSpriteSheet(atlasLease: AssetLease<Texture>, frames: readonly SpriteSheetFrameInput[], profile?: 'trim-rotation-v1'): SpriteSheet {
  if (!isAssetLease(atlasLease)) throw new EgretError("SPRITE_SHEET_LEASE_INVALID");
  const engine = engineOf(atlasLease)!;
  const snapshot = readAtlas(engine, atlasLease);
  const { image } = snapshot;
  if (profile !== undefined && profile !== 'trim-rotation-v1') throw new EgretError('SPRITE_SHEET_INPUT_INVALID');
  const revalidate = (): void => { readAtlas(engine, atlasLease, image); };
  const staged = stageFrames(frames, revalidate, profile !== undefined);
  const validated: ValidatedFrame[] = [];
  const seenNames = new Set<string>();
  let totalNameUnits = 0;
  for (const frame of staged) {
    if (!frame.name.present || !frame.x.present || !frame.y.present || !frame.width.present || !frame.height.present) {
      throw new EgretError("SPRITE_SHEET_INPUT_INVALID");
    }
    const name = qualifyName(frame.name.value);
    totalNameUnits += name.length;
    if (totalNameUnits > 32768) throw new EgretError("SPRITE_SHEET_LIMIT");
    if (seenNames.has(name)) throw new EgretError("SPRITE_SHEET_NAME_INVALID");
    const x = coordinate(frame.x.value, false);
    const y = coordinate(frame.y.value, false);
    const width = coordinate(frame.width.value, true);
    const height = coordinate(frame.height.value, true);
    const right = x + width, bottom = y + height;
    if (!Number.isSafeInteger(right) || !Number.isSafeInteger(bottom) || right > image.width || bottom > image.height) {
      throw new EgretError("SPRITE_SHEET_REGION_INVALID");
    }
    seenNames.add(name);
    const layout = frame.layout === undefined ? undefined : copyAtlasFrameLayout(frame.layout, width, height,
      kind => { throw new EgretError(kind === 'shape' ? 'SPRITE_SHEET_INPUT_INVALID' : 'SPRITE_SHEET_REGION_INVALID'); });
    validated.push({ name, x, y, width, height, ...(layout === undefined ? {} : { layout }) });
  }
  // Allocate public-owned crops only after the complete staged table qualifies.
  const names: string[] = [];
  const regions = new Map<string, AtlasRegion>();
  for (const frame of validated) {
    regions.set(frame.name, Object.freeze({ x: frame.x, y: frame.y, width: frame.width, height: frame.height, ...(frame.layout === undefined ? {} : { layout: frame.layout }) }));
    names.push(frame.name);
  }
  const state: SheetState = {
    engine, names: Object.freeze(names), regions,
    atlasWidth: image.width, atlasHeight: image.height,
    lease: atlasLease, image, disposed: false, creatingBitmap: false,
  };
  const sheet = createFacade();
  const binding = [sheet];
  revalidate();
  // All callback-capable work is complete before private state/affinity publication.
  states.set(sheet, state);
  commitBinding(binding, engine);
  return sheet;
}
