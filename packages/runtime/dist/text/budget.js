import { EgretError } from '../EgretError.js';
const freeze = Object.freeze;
const finite = Number.isSafeInteger;
const keys = freeze([
    'occupiedSlots',
    'currentGenerations',
    'retiredGenerations',
    'quarantinedGenerations',
    'pendingJobs',
    'pendingWaiters',
    'callerLeaseSlots',
    'activeCallerLeases',
    'residentEntries',
    'residentBytes',
    'liveImageBytes',
    'reservedImageBytes',
    'pendingRasterBytes',
    'quarantinedImageBytes',
    'quarantinedRasterBytes',
    'metadataBytes',
    'idleWaiters',
    'cleanupFailureCount',
    'lateProviderFailureCount'
]);
export const TEXT_BUDGET_DEFAULTS = freeze({
    maxGenerations: 64,
    maxPendingJobs: 4,
    maxWaiters: 128,
    maxCallerLeases: 128,
    maxResidentEntries: 32,
    maxMetadataBytes: 2097152,
    maxLogicalImageBytes: 16777216,
    maxPendingRasterBytes: 8388608
});
export const TEXT_BUDGET_MINIMA = freeze({
    maxGenerations: 1,
    maxPendingJobs: 1,
    maxWaiters: 1,
    maxCallerLeases: 1,
    maxResidentEntries: 0,
    maxMetadataBytes: 4096,
    maxLogicalImageBytes: 1,
    maxPendingRasterBytes: 1
});
/** Proposals are checked before any counter changes or persistent allocation. */
export class TextBudget {
    limits;
    counters = {
        occupiedSlots: 0,
        currentGenerations: 0,
        retiredGenerations: 0,
        quarantinedGenerations: 0,
        pendingJobs: 0,
        pendingWaiters: 0,
        callerLeaseSlots: 0,
        activeCallerLeases: 0,
        residentEntries: 0,
        residentBytes: 0,
        liveImageBytes: 0,
        reservedImageBytes: 0,
        pendingRasterBytes: 0,
        quarantinedImageBytes: 0,
        quarantinedRasterBytes: 0,
        metadataBytes: 4096,
        idleWaiters: 0,
        cleanupFailureCount: 0,
        lateProviderFailureCount: 0
    };
    constructor(limits) {
        this.limits = limits;
    }
    check(delta, failure) {
        const next = (key) => {
            const value = this.counters[key] + (delta[key] ?? 0);
            if (!finite(value) || value < 0)
                throw failure('TEXT_COUNTER_EXHAUSTED');
            return value;
        };
        // Admission precedence is part of the contract, even for combined proposals.
        if (next('pendingWaiters') > this.limits.maxWaiters)
            throw failure('TEXT_CACHE_BUDGET');
        if (next('callerLeaseSlots') > this.limits.maxCallerLeases)
            throw failure('TEXT_CACHE_BUDGET');
        if (next('occupiedSlots') > 32)
            throw failure('TEXT_CACHE_BUDGET');
        if (next('currentGenerations') + next('retiredGenerations') > this.limits.maxGenerations)
            throw failure('TEXT_CACHE_BUDGET');
        if (next('pendingJobs') > this.limits.maxPendingJobs)
            throw failure('TEXT_CACHE_BUDGET');
        if (next('metadataBytes') > this.limits.maxMetadataBytes)
            throw failure('TEXT_CACHE_BUDGET');
        if (next('liveImageBytes') + next('reservedImageBytes') > this.limits.maxLogicalImageBytes)
            throw failure('TEXT_CACHE_BUDGET');
        if (next('pendingRasterBytes') > this.limits.maxPendingRasterBytes)
            throw failure('TEXT_CACHE_BUDGET');
        if (next('residentEntries') > this.limits.maxResidentEntries || next('idleWaiters') > 8)
            throw failure('TEXT_CACHE_BUDGET');
        for (const key of keys)
            next(key);
    }
    /** Internal terminal transitions have already established their exact charge. */
    commit(delta) {
        for (const key of keys) {
            const difference = delta[key] ?? 0;
            const value = this.counters[key] + difference;
            if (!finite(value) || value < 0)
                throw new EgretError('TEXT_COUNTER_EXHAUSTED');
        }
        for (const key of keys)
            this.counters[key] += delta[key] ?? 0;
    }
    snapshot() {
        return freeze({ ...this.counters });
    }
}
//# sourceMappingURL=budget.js.map