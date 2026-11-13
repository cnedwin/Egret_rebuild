// SPDX-License-Identifier: Apache-2.0
// Counts the handles a game creates through the engine and how many are still
// alive, to make a leak visible as a count that only grows. The engine keeps
// no public count, so the tracker stands at the creation calls instead. It
// holds handles weakly and never keeps one alive.
import type { SourceValues } from './types.js';

const ENDED = new Set(['disposed', 'closed', 'completed', 'stopped', 'failed']);

/** The engine methods that create a handle, and the kind each is counted as. */
const ENGINE_METHODS = Object.freeze({
    createScope: 'scopes', createTween: 'tweens', createSequencePlayback: 'sequences', createAssetGroup: 'assetGroups',
    createManifestGroup: 'assetGroups', createBitmapResourceSlot: 'bitmapSlots', captureBitmapBindings: 'bitmapTickets',
    prepareDisplaySubtree: 'subtreeTickets',
} as const);
type EngineMethod = keyof typeof ENGINE_METHODS;

export interface HandleTrackerOptions {
    /** Seconds of history used to decide that a count is growing. Default 20. */
    readonly growthSeconds?: number;
    /** Least increase over that time that counts as growing. Default 16. */
    readonly growthMinimum?: number;
    /** Millisecond clock. Default performance.now(). */
    readonly now?: () => number;
}

export interface HandleCount {
    readonly created: number;
    readonly live: number;
    /** The live count rose steadily over the growth window and never fell. */
    readonly growing: boolean;
}

export interface HandleTracker {
    /**
     * Count a handle. It is alive until its state reads as ended or, when a
     * scope is given, until that scope is no longer open. Returns the handle.
     */
    track<T extends object>(kind: string, handle: T, scope?: object): T;
    /**
     * The engine's creation methods, counted. Each call goes to the engine
     * unchanged and returns the engine's own handle.
     */
    engine<E extends object>(engine: E): Pick<E, Extract<keyof E, EngineMethod>>;
    counts(): Readonly<Record<string, HandleCount>>;
    /** A monitor source: live counts, with a mark on the kinds that are growing. */
    source(): () => SourceValues;
}

interface Entry { readonly handle: WeakRef<object>; readonly scope: WeakRef<object> | undefined; }
interface Kind { created: number; entries: Entry[]; samples: number[]; lastSampleAt: number; }

function ended(target: object | undefined): boolean {
    if (target === undefined) return true;
    try {
        const state: unknown = (target as { readonly state?: unknown }).state;
        return typeof state === 'string' && ENDED.has(state);
    } catch { return true; }
}

/** Create a tracker. One per engine. */
export function createHandleTracker(options: HandleTrackerOptions = {}): HandleTracker {
    const growthSeconds = options.growthSeconds ?? 20, growthMinimum = options.growthMinimum ?? 16;
    if (!Number.isInteger(growthSeconds) || growthSeconds < 2 || growthSeconds > 600) throw new RangeError('growthSeconds');
    if (!Number.isFinite(growthMinimum) || growthMinimum < 1) throw new RangeError('growthMinimum');
    const timer = (globalThis as { readonly performance?: { now(): number } }).performance;
    const now = options.now ?? (timer === undefined ? () => Date.now() : () => timer.now());
    const kinds = new Map<string, Kind>();

    function track<T extends object>(kind: string, handle: T, scope?: object): T {
        if (typeof kind !== 'string' || kind.length === 0 || handle === null || typeof handle !== 'object') return handle;
        let record = kinds.get(kind);
        if (record === undefined) {
            if (kinds.size >= 32) return handle;
            record = { created: 0, entries: [], samples: [], lastSampleAt: Number.NaN };
            kinds.set(kind, record);
        }
        record.created++;
        record.entries.push({ handle: new WeakRef(handle), scope: scope === undefined ? undefined : new WeakRef(scope) });
        return handle;
    }

    function live(record: Kind): number {
        // Drop the ended and the collected; what remains is alive.
        record.entries = record.entries.filter((entry) => !ended(entry.handle.deref()) && (entry.scope === undefined || !ended(entry.scope.deref())));
        return record.entries.length;
    }

    function counts(): Readonly<Record<string, HandleCount>> {
        const at = now(), out: Record<string, HandleCount> = {};
        for (const [name, record] of kinds) {
            const alive = live(record);
            // One sample a second, however often the counts are read.
            if (Number.isNaN(record.lastSampleAt) || at - record.lastSampleAt >= 1000) {
                record.lastSampleAt = at;
                record.samples.push(alive);
                if (record.samples.length > growthSeconds) record.samples.shift();
            }
            const samples = record.samples;
            let rising = samples.length === growthSeconds;
            for (let i = 1; rising && i < samples.length; i++) rising = (samples[i] as number) >= (samples[i - 1] as number);
            const growing = rising && (samples[samples.length - 1] as number) - (samples[0] as number) >= growthMinimum;
            out[name] = Object.freeze({ created: record.created, live: alive, growing });
        }
        return Object.freeze(out);
    }

    return Object.freeze({
        track,
        engine<E extends object>(engine: E): Pick<E, Extract<keyof E, EngineMethod>> {
            const facade: Record<string, unknown> = {};
            for (const [method, kind] of Object.entries(ENGINE_METHODS)) {
                const create: unknown = (engine as Record<string, unknown>)[method];
                if (typeof create !== 'function') continue;
                facade[method] = (...args: unknown[]): unknown => {
                    const handle: unknown = Reflect.apply(create, engine, args);
                    // Every creation method but createScope takes its owning scope first.
                    const scope = method === 'createScope' || typeof args[0] !== 'object' || args[0] === null ? undefined : args[0];
                    return handle !== null && typeof handle === 'object' ? track(kind, handle, scope) : handle;
                };
            }
            return Object.freeze(facade) as Pick<E, Extract<keyof E, EngineMethod>>;
        },
        counts,
        source: () => (): SourceValues => {
            const out: Record<string, number | string> = {};
            for (const [name, count] of Object.entries(counts())) out[name] = count.growing ? `${count.live} ↑` : count.live;
            return out;
        },
    });
}
