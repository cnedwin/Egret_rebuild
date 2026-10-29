import type { AssetAcquireOptions, AssetProvider } from "./AssetManager.js";
import type { AssetLease } from "./AssetLease.js";
import type { AssetRef, AssetType } from "./AssetRef.js";
import { EgretError } from "./EgretError.js";
import type { EngineContext } from "./ownership.js";

/** @internal Narrow immutable group assembly; no manager or owner lookup escapes. */
export interface AssetGroupOperations {
  readonly admitGroupRefs: (refs: readonly unknown[]) => void;
  readonly acquire: <T>(ref: AssetRef<T>, options?: AssetAcquireOptions) => Promise<AssetLease<T>>;
  readonly claimGroupLease: (lease: unknown, group: object) => void;
  readonly releaseGroupLease: (lease: unknown) => void;
}

/** Private authority installed only by authentic AssetManager construction. */
interface AssetManagerOwner {
  readonly context: EngineContext;
  readonly assertOpen: () => void;
  readonly register: <T>(type: AssetType<T>, provider: AssetProvider<NoInfer<T>>) => void;
  readonly acquire: <T>(ref: AssetRef<T>, options?: AssetAcquireOptions) => Promise<AssetLease<T>>;
  readonly invalidate: <T>(ref: AssetRef<T>) => void;
}

interface OwnerState {
  readonly owner: AssetManagerOwner;
  closed: boolean;
  creationBusy: boolean;
  lifetimeCommitted: boolean;
  closeCache: (() => void) | undefined;
  paragraphLifetimeCommitted: boolean;
  closeParagraphCache: (() => void) | undefined;
}

const APPLY = Reflect.apply;
const WEAK_GET = WeakMap.prototype.get;
const WEAK_HAS = WeakMap.prototype.has;
const WEAK_SET = WeakMap.prototype.set;
const FREEZE = Object.freeze;
const states = new WeakMap<object, OwnerState>();

function requireState(value: unknown): OwnerState {
  // Intrinsic lookup authenticates identity without any caller property read.
  const state = APPLY(WEAK_GET, states, [value]) as OwnerState | undefined;
  if (state === undefined) throw new EgretError("TEXT_ASSETS_INVALID");
  return state;
}

function assertOwnerOpen(state: OwnerState): void {
  // Preserve the original manager/Engine cause before any lifetime or busy refusal.
  state.owner.assertOpen();
  if (state.closed) throw new EgretError("TEXT_CACHE_CLOSED");
}

/** Called once from the manager constructor; no cache or provider import is needed. */
export function registerAssetManagerOwner(manager: object, owner: AssetManagerOwner): void {
  if (APPLY(WEAK_HAS, states, [manager])) throw new EgretError("TEXT_ASSETS_INVALID");
  APPLY(WEAK_SET, states, [manager, {
    owner: FREEZE(owner), closed: false, creationBusy: false,
    lifetimeCommitted: false, closeCache: undefined, paragraphLifetimeCommitted: false, closeParagraphCache: undefined,
  } satisfies OwnerState]);
}

/** Return the immutable intrinsic operations, never a structural caller port. */
export function requireAssetManagerOwner(value: unknown): AssetManagerOwner {
  return requireState(value).owner;
}

/** Only pre-commit preparation can be retried; the release callback is idempotent. */
export function beginTextCacheCreation(manager: object): () => void {
  const state = requireState(manager);
  assertOwnerOpen(state);
  if (state.lifetimeCommitted) throw new EgretError("TEXT_CACHE_ALREADY_CREATED");
  if (state.creationBusy) throw new EgretError("TEXT_CACHE_REENTRANT");
  state.creationBusy = true;
  let active = true;
  return (): void => {
    if (!active) return;
    active = false;
    state.creationBusy = false;
  };
}

/** Consume the sole lifetime before provider registration or the fixed 32 ref IDs. */
export function commitTextCacheLifetime(manager: object, closeCache: () => void): void {
  const state = requireState(manager);
  assertOwnerOpen(state);
  if (state.lifetimeCommitted) throw new EgretError("TEXT_CACHE_ALREADY_CREATED");
  if (!state.creationBusy) throw new EgretError("TEXT_CACHE_REENTRANT");
  state.lifetimeCommitted = true;
  state.closeCache = closeCache;
}

/** Make the manager unavailable without invoking any cache or external callback. */
export function markAssetManagerOwnerClosed(manager: object): void {
  requireState(manager).closed = true;
}

/** Consume first; trusted cache close handles and diagnoses its own cleanup faults. */
export function closeOwnedTextCache(manager: object): void {
  const state = requireState(manager);
  const closeCache = state.closeCache;
  state.closeCache = undefined;
  const closeParagraphCache = state.closeParagraphCache;
  state.closeParagraphCache = undefined;
  try { closeCache?.(); } finally { closeParagraphCache?.(); }
}

/** One additional fixed paragraph profile shares the same manager and shutdown boundary. */
export function beginParagraphCacheCreation(manager: object): () => void {
  const state = requireState(manager);
  assertOwnerOpen(state);
  if (state.paragraphLifetimeCommitted) throw new EgretError('PARAGRAPH_CACHE_ALREADY_CREATED');
  if (state.creationBusy) throw new EgretError('TEXT_CACHE_REENTRANT');
  state.creationBusy = true;
  let active = true;
  return (): void => { if (active) { active = false; state.creationBusy = false; } };
}
export function commitParagraphCacheLifetime(manager: object, close: () => void): void {
  const state = requireState(manager);
  assertOwnerOpen(state);
  if (state.paragraphLifetimeCommitted) throw new EgretError('PARAGRAPH_CACHE_ALREADY_CREATED');
  if (!state.creationBusy) throw new EgretError('TEXT_CACHE_REENTRANT');
  state.paragraphLifetimeCommitted = true;
  state.closeParagraphCache = close;
}
