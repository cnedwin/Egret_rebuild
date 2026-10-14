// SPDX-License-Identifier: Apache-2.0
import { createSpriteSheet, EgretError } from '@egret/runtime';
import type { AssetLease, Bitmap, SpriteSheet, Texture } from '@egret/runtime';
import type { Rectangle2D, TextureRegion2D } from '@egret/contracts';
import type { MouseInputEnginePort } from './mouseInput.js';
import type { MouseInputPayload } from './mouseInputTypes.js';
import type { BitmapButton, BitmapButtonOptions, BitmapButtonState } from './bitmapButtonTypes.js';
import { assertBitmapButtonScopeOrigin, bitmapButtonOperations as original, requireBitmapButtonInput, requireMouseInputEngine } from './internal/mouseInputFactoryState.js';
import type { BitmapButtonAssociation, BitmapButtonInputPort } from './internal/mouseInputFactoryState.js';

type ScopePort = ReturnType<MouseInputEnginePort['scope']>;
type Skins = Readonly<{ up: TextureRegion2D; pressed: TextureRegion2D; disabled: TextureRegion2D }>;
interface ButtonRecord {
  readonly display: Bitmap;
  state: BitmapButtonState;
  enabled: boolean;
  owner: MouseInputEnginePort | undefined;
  scope: ScopePort | undefined;
  input: BitmapButtonInputPort | undefined;
  sheet: SpriteSheet | undefined;
  lease: AssetLease<Texture> | undefined;
  skins: Skins | undefined;
  crop: TextureRegion2D | undefined;
  hit: Rectangle2D | undefined;
  touch: boolean;
  gesture: object | undefined;
  callback: ((payload: MouseInputPayload) => void) | undefined;
  association: BitmapButtonAssociation | undefined;
  abort: (() => void) | undefined;
}
const ARRAY_IS_ARRAY = Array.isArray;

function cleanupError(errors: readonly unknown[]): EgretError {
  return new EgretError('BITMAP_BUTTON_CLEANUP_FAILED', { cause: errors[0], cleanupErrors: errors.slice(1) });
}
/** Logical retirement precedes every physical cleanup and possible reentry. */
function retire(record: ButtonRecord): readonly unknown[] {
  if (record.state === 'disposed') return [];
  const input = record.input, scope = record.scope, abort = record.abort;
  const association = record.association, sheet = record.sheet;
  record.state = 'disposed'; record.gesture = undefined; record.callback = undefined;
  record.owner = undefined; record.scope = undefined; record.input = undefined;
  record.sheet = undefined; record.lease = undefined; record.skins = undefined;
  record.crop = undefined; record.hit = undefined; record.abort = undefined; record.association = undefined;
  const failures: unknown[] = [];
  const attempt = (action: () => void): void => { try { action(); } catch (cause) { failures.push(cause); } };
  if (input !== undefined && association !== undefined) attempt(() => input.remove(association));
  if (scope !== undefined && abort !== undefined) attempt(() => scope.remove(abort));
  attempt(() => original.dispose(record.display));
  attempt(() => original.disposeDisplay(record.display));
  if (sheet !== undefined) attempt(() => sheet.dispose());
  return failures;
}
function reportCleanup(owner: MouseInputEnginePort | undefined, errors: readonly unknown[]): void {
  if (owner === undefined || errors.length === 0) return;
  const cause = cleanupError(errors);
  try { owner.captureCleanup(cause); } catch { /* A cleanup observer cannot replace the selected cause. */ }
  try { owner.report({ code: 'BITMAP_BUTTON_CLEANUP_FAILED', phase: 'engine', severity: 'error', cause }); }
  catch { /* Continue retiring the remaining controls. */ }
}
/** Getters synchronize terminal dependencies, but never repair semantic mutations. */
function syncTerminal(record: ButtonRecord): void {
  if (record.state === 'disposed') return;
  const owner = record.owner;
  let terminal = original.disposed(record.display);
  if (!terminal) {
    try { owner!.assertReady(); record.scope!.assertOpen(); record.input!.assertOpen(); }
    catch (cause) {
      if (!(cause instanceof EgretError) || !['ENGINE_CLOSED', 'SCOPE_CLOSED', 'BITMAP_BUTTON_INPUT_CLOSED'].includes(cause.code)) throw cause;
      terminal = true;
    }
  }
  if (terminal) reportCleanup(owner, retire(record));
}
function assertLife(record: ButtonRecord): void {
  record.owner!.assertReady(); record.scope!.assertOpen(); record.input!.assertOpen();
}
function equalRect(first: Rectangle2D | undefined, second: Rectangle2D | undefined): boolean {
  return first !== undefined && second !== undefined && first.x === second.x && first.y === second.y
    && first.width === second.width && first.height === second.height;
}
function assertSettings(record: ButtonRecord): void {
  if (original.lease(record.display) === record.lease && equalRect(original.crop(record.display), record.crop)
      && equalRect(original.hit(record.display), record.hit) && original.touch(record.display) === record.touch) return;
  const failures = retire(record);
  throw new EgretError('BITMAP_BUTTON_SKIN_INVALID', { cleanupErrors: failures });
}
function throwAfterRetirement(record: ButtonRecord, cause: unknown): never {
  const failures = retire(record);
  if (cause instanceof EgretError && failures.length !== 0) {
    throw new EgretError(cause.code, { cause: cause.cause, cleanupErrors: [...cause.cleanupErrors, ...failures] });
  }
  throw cause;
}
/** Prepared immutable crops make both reserved writes callback-free on this Bitmap. */
function commitSkin(record: ButtonRecord, state: 'up' | 'pressed' | 'disabled', enabled: boolean): void {
  const crop = record.skins![state];
  try {
    original.setCrop(record.display, crop);
    original.setTouch(record.display, enabled);
    record.crop = original.crop(record.display);
    record.touch = enabled; record.enabled = enabled; record.state = state;
  } catch (cause) { throwAfterRetirement(record, cause); }
}
function active(record: ButtonRecord): boolean {
  syncTerminal(record);
  if (record.state === 'disposed') return false;
  assertLife(record); assertSettings(record);
  return true;
}
function setEnabled(record: ButtonRecord, value: unknown): void {
  syncTerminal(record);
  if (record.state === 'disposed') throw new EgretError('BITMAP_BUTTON_DISPOSED');
  assertLife(record);
  if (typeof value !== 'boolean') throw new EgretError('BITMAP_BUTTON_OPTIONS_INVALID');
  assertSettings(record);
  if (value === record.enabled) return;
  // A disable/re-enable sequence cannot recreate an earlier callback entitlement.
  record.gesture = undefined;
  commitSkin(record, value ? 'up' : 'disabled', value);
}
function createAssociation(record: ButtonRecord): BitmapButtonAssociation {
  return Object.freeze({
    target: record.display,
    syncTerminal(): void { syncTerminal(record); },
    beforeBegin(token: object): void {
      if (!active(record) || !record.enabled) return;
      commitSkin(record, 'pressed', true); record.gesture = token;
    },
    beforeEnd(token: object): void {
      if (!active(record)) return;
      if (record.gesture === token && record.state === 'pressed') commitSkin(record, 'up', true);
    },
    cancel(): void {
      if (!active(record)) return;
      record.gesture = undefined;
      if (record.state === 'pressed') commitSkin(record, 'up', true);
    },
    afterActivate(token: object, payload: MouseInputPayload, eligible: () => boolean): void {
      if (!active(record) || !record.enabled || record.gesture !== token || !eligible()) return;
      // Consume first; no post-callback write may resurrect a disabled/closed value.
      record.gesture = undefined;
      const callback = record.callback!, owner = record.owner!;
      const returned = original.invoke(callback, payload);
      if (returned !== null && (typeof returned === 'object' || typeof returned === 'function')
          && 'then' in returned && typeof returned.then === 'function') {
        void Promise.resolve(returned).catch((cause: unknown): void => {
          owner.report({ code: 'ASYNC_EVENT_HANDLER_REJECTED', phase: 'engine', severity: 'error', cause });
        });
        throw new EgretError('ASYNC_EVENT_HANDLER');
      }
    },
    finish(token: object): void { if (record.gesture === token) record.gesture = undefined; },
    retire(): readonly unknown[] { return retire(record); },
  });
}
function createAbort(record: ButtonRecord): () => void {
  return (): void => { const owner = record.owner; reportCleanup(owner, retire(record)); };
}
function createFacade(record: ButtonRecord): BitmapButton {
  function exact(receiver: unknown): void { if (receiver !== facade) throw new EgretError('BITMAP_BUTTON_INVALID'); }
  const facade = Object.freeze({
    get display(): Bitmap { exact(this); syncTerminal(record); return record.display; },
    get state(): BitmapButtonState { exact(this); syncTerminal(record); return record.state; },
    get enabled(): boolean { exact(this); syncTerminal(record); return record.enabled; },
    set enabled(value: boolean) { exact(this); setEnabled(record, value); },
    dispose(): void {
      exact(this);
      const failures = retire(record);
      if (failures.length !== 0) throw cleanupError(failures);
    },
  }) as BitmapButton;
  return facade;
}

function read<T>(operation: () => T, revalidate: () => void): T {
  let value: T;
  try { value = operation(); }
  catch (cause) { throw new EgretError('BITMAP_BUTTON_OPTIONS_INVALID', { cause }); }
  revalidate(); return value;
}
function recordShape(value: unknown): value is object {
  if (value === null || typeof value !== 'object') return false;
  try { return !ARRAY_IS_ARRAY(value); }
  catch (cause) { throw new EgretError('BITMAP_BUTTON_OPTIONS_INVALID', { cause }); }
}
function retainOriginalError(primary: unknown, errors: readonly unknown[]): never {
  if (primary instanceof EgretError && /^(BITMAP_BUTTON_|SPRITE_SHEET_|BITMAP_|ASSET_LEASE_|TEXTURE_|ENGINE_|SCOPE_|MOUSE_INPUT_|OWNERSHIP_|DISPLAY_|HIT_TEST_)/.test(primary.code)) {
    if (errors.length === 0) throw primary;
    throw new EgretError(primary.code, { cause: primary.cause, cleanupErrors: [...primary.cleanupErrors, ...errors] });
  }
  throw new EgretError('BITMAP_BUTTON_SETUP_FAILED', { cause: primary, cleanupErrors: errors });
}
function assertSetupOpen(record: ButtonRecord): void {
  if (record.state === 'disposed') throw new EgretError('SCOPE_CLOSED');
}

/** Share a genuine input; own only the new private sheet, Bitmap and facade. */
export function createBitmapButton(options: BitmapButtonOptions): BitmapButton {
  if (!recordShape(options)) throw new EgretError('BITMAP_BUTTON_OPTIONS_INVALID');
  const noCheck = (): void => {};
  const engine = read(() => options.engine, noCheck);
  const owner = requireMouseInputEngine(engine);
  const requestedScope = read(() => options.scope, (): void => owner.assertReady());
  assertBitmapButtonScopeOrigin(requestedScope, engine);
  const scope = owner.scope(requestedScope);
  const ownerLife = (): void => { owner.assertReady(); scope.assertOpen(); };
  const requestedInput = read(() => options.input, ownerLife);
  const input = requireBitmapButtonInput(requestedInput, engine);
  const life = (): void => { owner.assertReady(); scope.assertOpen(); input.assertOpen(); };
  const lease = read(() => options.textureLease, life);
  const requestedSkins = read(() => options.skins, life);
  const requestedEnabled = read(() => options.enabled, life);
  const callback = read(() => options.onActivate, life);
  if (!recordShape(requestedSkins)) throw new EgretError('BITMAP_BUTTON_OPTIONS_INVALID');
  const up = read(() => requestedSkins.up, life);
  const pressed = read(() => requestedSkins.pressed, life);
  const disabled = read(() => requestedSkins.disabled, life);
  const fields = (region: TextureRegion2D): TextureRegion2D => {
    const x = read(() => region.x, life), y = read(() => region.y, life);
    const width = read(() => region.width, life), height = read(() => region.height, life);
    return { x, y, width, height };
  };
  const stagedUp = fields(up), stagedPressed = fields(pressed), stagedDisabled = fields(disabled);
  // Exactly one get: explicit undefined and an absent enabled property both mean true.
  const enabled = requestedEnabled === undefined ? true : requestedEnabled;
  if (typeof enabled !== 'boolean' || typeof callback !== 'function') throw new EgretError('BITMAP_BUTTON_OPTIONS_INVALID');
  let sheet: SpriteSheet | undefined, display: Bitmap | undefined, record: ButtonRecord | undefined;
  try {
    sheet = createSpriteSheet(lease, [{ name: 'up', ...stagedUp }, { name: 'pressed', ...stagedPressed }, { name: 'disabled', ...stagedDisabled }]);
    life();
    const skins = Object.freeze({ up: sheet.getRegion('up'), pressed: sheet.getRegion('pressed'), disabled: sheet.getRegion('disabled') });
    if (skins.up.width !== skins.pressed.width || skins.up.width !== skins.disabled.width
        || skins.up.height !== skins.pressed.height || skins.up.height !== skins.disabled.height) throw new EgretError('BITMAP_BUTTON_SKIN_INVALID');
    // Scope acceptance authenticates the borrowed lease's Engine without rebinding it.
    scope.use(sheet); life();
    display = sheet.createBitmap('up'); life();
    scope.use(display); life();
    const hit = Object.freeze({ x: 0, y: 0, width: skins.up.width, height: skins.up.height });
    original.setHit(display, hit);
    original.setCrop(display, enabled ? skins.up : skins.disabled);
    original.setTouch(display, enabled);
    life();
    record = {
      display, state: enabled ? 'up' : 'disabled', enabled, owner, scope, input, sheet, lease, skins,
      crop: original.crop(display), hit: original.hit(display), touch: enabled, gesture: undefined,
      callback, association: undefined, abort: undefined,
    };
    const facade = createFacade(record);
    record.association = createAssociation(record); record.abort = createAbort(record);
    scope.use(facade); life();
    scope.add(record.abort); life();
    assertSetupOpen(record);
    input.add(record.association); life();
    assertSetupOpen(record);
    return facade;
  } catch (primary) {
    const failures: unknown[] = [];
    if (record !== undefined) failures.push(...retire(record));
    else {
      if (display !== undefined) {
        try { original.dispose(display); } catch (cause) { failures.push(cause); }
        try { original.disposeDisplay(display); } catch (cause) { failures.push(cause); }
      }
      if (sheet !== undefined) try { sheet.dispose(); } catch (cause) { failures.push(cause); }
    }
    retainOriginalError(primary, failures);
  }
}
