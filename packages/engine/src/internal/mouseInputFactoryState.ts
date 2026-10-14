import { Bitmap, DisplayObject, EgretError } from '@egret/runtime';
import type { AssetLease, Texture } from '@egret/runtime';
import type { Rectangle2D, TextureRegion2D } from '@egret/contracts';
import type { MouseInputEnginePort } from '../mouseInput.js';
import type { MouseInputPayload } from '../mouseInputTypes.js';

const engines = new WeakMap<object, MouseInputEnginePort>();
const engineTokens = new WeakMap<object, object>();
const scopeOrigins = new WeakMap<object, object>();

/** Assembly installs authority before publishing the genuine Engine. */
export function registerMouseInputEngine(engine: object, port: MouseInputEnginePort): void {
  engines.set(engine, port);
  engineTokens.set(engine, {});
}
export function requireMouseInputEngine(engine: unknown): MouseInputEnginePort {
  const port = engines.get(engine as object);
  if (port === undefined) throw new EgretError('MOUSE_INPUT_INVALID');
  port.assertReady();
  return port;
}
/** Successful Host startup is separate from ordinary open-state observation. */
export function markMouseInputEngineStarted(engine: object): void {
  engines.get(engine)?.markStarted();
}
/** Eager Engine assembly records genuine Scope origin without retaining its Engine. */
export function registerMouseInputScope(scope: object, engine: object): void {
  const origin = engineTokens.get(engine);
  if (origin === undefined) throw new EgretError('MOUSE_INPUT_INVALID');
  scopeOrigins.set(scope, origin);
}
/** Button admission distinguishes foreign genuine Scope from an unregistered value. */
export function assertBitmapButtonScopeOrigin(scope: unknown, engine: object): void {
  const origin = scopeOrigins.get(scope as object);
  if (origin === undefined) throw new EgretError('MOUSE_INPUT_SCOPE_INVALID');
  if (origin !== engineTokens.get(engine)) throw new EgretError('ENGINE_MISMATCH');
}

/** Native delivery alone owns these associations and their opaque gesture tokens. */
export interface BitmapButtonAssociation {
  readonly target: Bitmap;
  syncTerminal(): void;
  beforeBegin(token: object): void;
  beforeEnd(token: object): void;
  cancel(): void;
  afterActivate(token: object, payload: MouseInputPayload, eligible: () => boolean): void;
  finish(token: object): void;
  retire(): readonly unknown[];
}
export interface BitmapButtonInputPort {
  assertOpen(): void;
  add(association: BitmapButtonAssociation): void;
  remove(association: BitmapButtonAssociation): void;
}
interface InputIdentity {
  readonly engineToken: object;
  readonly port: BitmapButtonInputPort;
}
const inputs = new WeakMap<object, InputIdentity>();
/** Keep only an opaque origin token after input retirement, not its Engine. */
export function registerMouseInputInstance(input: object, engine: object, port: BitmapButtonInputPort): void {
  const engineToken = engineTokens.get(engine);
  if (engineToken === undefined) throw new EgretError('MOUSE_INPUT_INVALID');
  inputs.set(input, { engineToken, port });
}
export function requireBitmapButtonInput(input: unknown, engine: object): BitmapButtonInputPort {
  const identity = inputs.get(input as object);
  if (identity === undefined) throw new EgretError('MOUSE_INPUT_INVALID');
  if (identity.engineToken !== engineTokens.get(engine)) throw new EgretError('ENGINE_MISMATCH');
  identity.port.assertOpen();
  return identity.port;
}

// This module is already eagerly reached by Engine -> mouseInput before SDK
// publication. A late optional input import reuses these original public ports.
// Prototype/intrinsic replacement before trusted eager initialization is outside
// this profile; no hostile-realm or arbitrary JavaScript isolation is promised.
const APPLY = Reflect.apply;
const LEASE = Object.getOwnPropertyDescriptor(Bitmap.prototype, 'textureLease')!.get!;
const SET_LEASE = Object.getOwnPropertyDescriptor(Bitmap.prototype, 'textureLease')!.set!;
const CROP = Object.getOwnPropertyDescriptor(Bitmap.prototype, 'sourceRect')!.get!;
const SET_CROP = Object.getOwnPropertyDescriptor(Bitmap.prototype, 'sourceRect')!.set!;
const HIT = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'hitArea')!.get!;
const SET_HIT = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'hitArea')!.set!;
const TOUCH = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'touchEnabled')!.get!;
const SET_TOUCH = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'touchEnabled')!.set!;
const DISPOSED = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'isDisposed')!.get!;
const DISPOSE = Bitmap.prototype.dispose;
const DISPOSE_DISPLAY = DisplayObject.prototype.dispose;
/** Public accessors read original private slots despite later instance/prototype shadows. */
export const bitmapButtonOperations = Object.freeze({
  lease(bitmap: Bitmap): AssetLease<Texture> | undefined { return APPLY(LEASE, bitmap, []) as AssetLease<Texture> | undefined; },
  crop(bitmap: Bitmap): TextureRegion2D | undefined { return APPLY(CROP, bitmap, []) as TextureRegion2D | undefined; },
  hit(bitmap: Bitmap): Rectangle2D | undefined { return APPLY(HIT, bitmap, []) as Rectangle2D | undefined; },
  touch(bitmap: Bitmap): boolean { return APPLY(TOUCH, bitmap, []) as boolean; },
  disposed(bitmap: Bitmap): boolean { return APPLY(DISPOSED, bitmap, []) as boolean; },
  setLease(bitmap: Bitmap, lease: AssetLease<Texture> | undefined): void { APPLY(SET_LEASE, bitmap, [lease]); },
  setCrop(bitmap: Bitmap, crop: TextureRegion2D): void { APPLY(SET_CROP, bitmap, [crop]); },
  setHit(bitmap: Bitmap, hit: Rectangle2D): void { APPLY(SET_HIT, bitmap, [hit]); },
  setTouch(bitmap: Bitmap, enabled: boolean): void { APPLY(SET_TOUCH, bitmap, [enabled]); },
  dispose(bitmap: Bitmap): void { APPLY(DISPOSE, bitmap, []); },
  disposeDisplay(bitmap: Bitmap): void { APPLY(DISPOSE_DISPLAY, bitmap, []); },
  invoke(callback: (payload: MouseInputPayload) => void, payload: MouseInputPayload): unknown { return APPLY(callback, undefined, [payload]); },
});
