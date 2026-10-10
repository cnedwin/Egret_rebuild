import { EgretError } from "./EgretError.js";
import { commitBinding } from "./ownership.js";
import type { EngineContext } from "./ownership.js";

declare const LEASE_VALUE: unique symbol;
const CREATION_TOKEN: unique symbol = Symbol("egret.assetLeaseFactory");

interface LeaseState {
  active: boolean;
  readonly read: () => unknown;
  readonly release: () => void;
}

const states = new WeakMap<object, LeaseState>();
export let createAssetLease: <T>(engine: EngineContext, leaseId: number, generation: number, read: () => T, release: () => void) => AssetLease<T>;

/** One independently revocable CPU-value borrow, bound to its originating Engine. */
export class AssetLease<T> {
  declare readonly [LEASE_VALUE]?: (value: T) => T;
  public readonly leaseId: number;
  public readonly resourceGeneration: number;

  private constructor(engine: EngineContext, leaseId: number, generation: number, read: () => T, release: () => void, token: typeof CREATION_TOKEN) {
    if (token !== CREATION_TOKEN) throw new EgretError("ASSET_LEASE_FACTORY_REQUIRED");
    this.leaseId = leaseId;
    this.resourceGeneration = generation;
    states.set(this, { active: true, read, release });
    commitBinding([this], engine);
    Object.freeze(this);
  }

  static {
    createAssetLease = <T>(engine: EngineContext, leaseId: number, generation: number, read: () => T, release: () => void): AssetLease<T> =>
      new AssetLease(engine, leaseId, generation, read, release, CREATION_TOKEN);
  }

  public get value(): T {
    const state = states.get(this);
    if (state === undefined || !state.active) throw new EgretError("ASSET_LEASE_RELEASED");
    return state.read() as T;
  }

  /** Revoke before invoking the manager so disposer reentry sees a released lease. */
  public release(): void {
    const state = states.get(this);
    if (state === undefined || !state.active) return;
    state.active = false;
    state.release();
  }
}

/** Manager shutdown revokes all leases before any external cleanup callback. */
export function revokeAssetLease(lease: AssetLease<unknown>): void {
  const state = states.get(lease);
  if (state !== undefined) state.active = false;
}

/** Runtime-private identity guard; proxies and lookalikes cannot supply entitlement. */
export function isAssetLease(value: unknown): value is AssetLease<unknown> { return states.has(value as object); }

/** Read the manager-owned value, without overridable getters or descriptor callbacks. */
export function readAssetLeaseValue(value: unknown): unknown {
  const state = states.get(value as object);
  if (state === undefined || !state.active) throw new EgretError("ASSET_LEASE_RELEASED");
  return state.read();
}
