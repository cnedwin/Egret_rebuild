import { EgretError } from "./EgretError.js";
import { commitBinding } from "./ownership.js";
const CREATION_TOKEN = Symbol("egret.assetLeaseFactory");
const states = new WeakMap();
export let createAssetLease;
/** One independently revocable CPU-value borrow, bound to its originating Engine. */
export class AssetLease {
    leaseId;
    resourceGeneration;
    constructor(engine, leaseId, generation, read, release, token) {
        if (token !== CREATION_TOKEN)
            throw new EgretError("ASSET_LEASE_FACTORY_REQUIRED");
        this.leaseId = leaseId;
        this.resourceGeneration = generation;
        states.set(this, { active: true, read, release, onRetired: undefined });
        commitBinding([this], engine);
        Object.freeze(this);
    }
    static {
        createAssetLease = (engine, leaseId, generation, read, release) => new AssetLease(engine, leaseId, generation, read, release, CREATION_TOKEN);
    }
    get value() {
        const state = states.get(this);
        if (state === undefined || !state.active)
            throw new EgretError("ASSET_LEASE_RELEASED");
        return state.read();
    }
    /** Revoke before invoking the manager so disposer reentry sees a released lease. */
    release() {
        const state = states.get(this);
        if (state === undefined || !state.active)
            return;
        state.active = false;
        const onRetired = state.onRetired;
        state.onRetired = undefined;
        onRetired?.();
        state.release();
    }
}
/** Manager shutdown revokes all leases before any external cleanup callback. */
export function revokeAssetLease(lease) {
    const state = states.get(lease);
    if (state === undefined || !state.active)
        return;
    state.active = false;
    const onRetired = state.onRetired;
    state.onRetired = undefined;
    onRetired?.();
}
/** Install one cache-owned, counter-only retirement observer without changing the lease. */
export function observeAssetLeaseRetirement(lease, onRetired) {
    const state = states.get(lease);
    if (state === undefined || !state.active || state.onRetired !== undefined)
        return false;
    state.onRetired = onRetired;
    return true;
}
/** Runtime-private identity guard; proxies and lookalikes cannot supply entitlement. */
export function isAssetLease(value) {
    return states.has(value);
}
/** Read the manager-owned value, without overridable getters or descriptor callbacks. */
export function readAssetLeaseValue(value) {
    const state = states.get(value);
    if (state === undefined || !state.active)
        throw new EgretError("ASSET_LEASE_RELEASED");
    return state.read();
}
//# sourceMappingURL=AssetLease.js.map