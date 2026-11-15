import { EgretError } from '../EgretError.js';
import type { TextRasterCacheStatus } from './types.js';
/** Logical limits count retained work; they do not estimate process memory. */
export interface TextBudgetLimits {
    readonly maxGenerations: number;
    readonly maxPendingJobs: number;
    readonly maxWaiters: number;
    readonly maxCallerLeases: number;
    readonly maxResidentEntries: number;
    readonly maxMetadataBytes: number;
    readonly maxLogicalImageBytes: number;
    readonly maxPendingRasterBytes: number;
}
type CounterFields = Omit<TextRasterCacheStatus, 'closed' | 'fontGeneration'>;
export type TextBudgetCounters = {
    -readonly [K in keyof CounterFields]: CounterFields[K];
};
export type TextBudgetDelta = Partial<TextBudgetCounters>;
export type TextBudgetFailure = (code: 'TEXT_COUNTER_EXHAUSTED' | 'TEXT_CACHE_BUDGET', cause?: unknown) => EgretError;
export declare const TEXT_BUDGET_DEFAULTS: Readonly<{
    readonly maxGenerations: 64;
    readonly maxPendingJobs: 4;
    readonly maxWaiters: 128;
    readonly maxCallerLeases: 128;
    readonly maxResidentEntries: 32;
    readonly maxMetadataBytes: 2097152;
    readonly maxLogicalImageBytes: 16777216;
    readonly maxPendingRasterBytes: 8388608;
}>;
export declare const TEXT_BUDGET_MINIMA: Readonly<{
    readonly maxGenerations: 1;
    readonly maxPendingJobs: 1;
    readonly maxWaiters: 1;
    readonly maxCallerLeases: 1;
    readonly maxResidentEntries: 0;
    readonly maxMetadataBytes: 4096;
    readonly maxLogicalImageBytes: 1;
    readonly maxPendingRasterBytes: 1;
}>;
/** Proposals are checked before any counter changes or persistent allocation. */
export declare class TextBudget {
    readonly limits: TextBudgetLimits;
    private readonly counters;
    constructor(limits: TextBudgetLimits);
    check(delta: TextBudgetDelta, failure: TextBudgetFailure): void;
    /** Internal terminal transitions have already established their exact charge. */
    commit(delta: TextBudgetDelta): void;
    snapshot(): Readonly<TextBudgetCounters>;
}
export {};
//# sourceMappingURL=budget.d.ts.map