// SPDX-License-Identifier: Apache-2.0
// Frame timing collector. It keeps fixed-size typed rings, so recording a
// frame allocates nothing; summaries are computed only when a snapshot is read.
import { analyzeSharedFrame } from './frameStats.js';
import type { SharedFrameLike, SharedFrameStats } from './frameStats.js';
import type {
    CounterSummary, HitchRecord, PerformanceHistory, PerformanceMonitor, PerformanceMonitorOptions,
    PerformanceSession, PerformanceSnapshot, SectionSummary, SourceValues, TimingSummary,
} from './types.js';

const MAX_NAMES = 64;
const MAX_NAME_LENGTH = 64;

class Ring {
    readonly data: Float32Array;
    length = 0;
    #next = 0;
    constructor(size: number) { this.data = new Float32Array(size); }
    push(value: number): void {
        this.data[this.#next] = value;
        this.#next = (this.#next + 1) % this.data.length;
        if (this.length < this.data.length) this.length++;
    }
    /** Copy oldest first into out and return the number of values. */
    copyInto(out: Float32Array): number {
        const size = this.data.length, start = this.length < size ? 0 : this.#next;
        for (let i = 0; i < this.length; i++) out[i] = this.data[(start + i) % size] as number;
        return this.length;
    }
    /** The value pushed back steps ago; zero is the newest. */
    recent(back: number): number { return this.data[(this.#next - 1 - back + this.data.length * 2) % this.data.length] as number; }
    clear(): void { this.length = 0; this.#next = 0; }
}

interface Section { current: number; last: number; total: number; max: number; frames: number; }
interface Counter { current: number; last: number; total: number; }

function integerOption(value: unknown, fallback: number, minimum: number, maximum: number, name: string): number {
    if (value === undefined) return fallback;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) throw new RangeError(name);
    return value;
}

function millisecondOption(value: unknown, fallback: number, name: string): number {
    if (value === undefined) return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new RangeError(name);
    return value;
}

function validName(name: unknown): name is string {
    return typeof name === 'string' && name.length > 0 && name.length <= MAX_NAME_LENGTH;
}

function summarize(ring: Ring, scratch: Float32Array): TimingSummary | null {
    const length = ring.copyInto(scratch);
    if (length === 0) return null;
    const lastMs = scratch[length - 1] as number;
    let sum = 0;
    for (let i = 0; i < length; i++) sum += scratch[i] as number;
    const sorted = scratch.subarray(0, length).sort();
    const at = (share: number): number => sorted[Math.min(length - 1, Math.max(0, Math.ceil(share * length) - 1))] as number;
    return Object.freeze({ lastMs, meanMs: sum / length, p50Ms: at(0.5), p95Ms: at(0.95), p99Ms: at(0.99), maxMs: sorted[length - 1] as number });
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Create a collector. One per game view; nothing is shared between collectors. */
export function createPerformanceMonitor(options: PerformanceMonitorOptions = {}): PerformanceMonitor {
    const historySize = integerOption(options.historySize, 240, 16, 7200, 'historySize');
    const budgetMs = millisecondOption(options.budgetMs, 1000 / 60, 'budgetMs');
    const hitchThresholdMs = millisecondOption(options.hitchThresholdMs, budgetMs * 2, 'hitchThresholdMs');
    const maxHitches = integerOption(options.maxHitches, 32, 0, 1024, 'maxHitches');
    const pauseThresholdMs = millisecondOption(options.pauseThresholdMs, 1000, 'pauseThresholdMs');
    const clock = options.now;
    if (clock !== undefined && typeof clock !== 'function') throw new TypeError('now');
    const timer = (globalThis as { readonly performance?: { now(): number } }).performance;
    const now: () => number = clock ?? (timer === undefined ? () => Date.now() : () => timer.now());

    const intervals = new Ring(historySize), work = new Ring(historySize);
    const scratch = new Float32Array(historySize);
    const sections = new Map<string, Section>();
    const counters = new Map<string, Counter>();
    const gauges = new Map<string, number | string>();
    const sources = new Map<string, () => SourceValues>();
    let hitchLog: HitchRecord[] = [];
    let disposed = false;
    let lastTick = Number.NaN, firstTick = Number.NaN, frameStart = Number.NaN;
    let currentWork = 0, workUsed = false, workSeen = false;
    let frames = 0, dropped = 0, hitchCount = 0, pauses = 0;
    let frameStats: SharedFrameStats | null = null;
    let analysisMs = 0, analysisFrames = 0;

    function time(value: number | undefined): number {
        return typeof value === 'number' && Number.isFinite(value) ? value : now();
    }

    function rollFrame(): Record<string, number> {
        const lastSections: Record<string, number> = {};
        for (const [name, section] of sections) {
            section.last = section.current; section.total += section.current; section.frames++;
            if (section.current > section.max) section.max = section.current;
            if (section.current > 0) lastSections[name] = round2(section.current);
            section.current = 0;
        }
        for (const counter of counters.values()) { counter.last = counter.current; counter.total += counter.current; counter.current = 0; }
        return lastSections;
    }

    function tick(nowMs?: number): void {
        if (disposed) return;
        const at = time(nowMs);
        if (Number.isNaN(lastTick)) { lastTick = firstTick = at; return; }
        const interval = at - lastTick;
        lastTick = at;
        if (!(interval > 0)) return;
        if (interval >= pauseThresholdMs) {
            // A hidden tab or a breakpoint is not a slow frame.
            pauses++; currentWork = 0; workUsed = false; rollFrame();
            return;
        }
        frames++;
        intervals.push(interval);
        const frameWork = workUsed ? currentWork : Number.NaN;
        if (workUsed) { work.push(currentWork); workSeen = true; }
        currentWork = 0; workUsed = false;
        const lastSections = rollFrame();
        if (interval > budgetMs * 1.5) dropped++;
        if (interval >= hitchThresholdMs) {
            hitchCount++;
            if (maxHitches > 0) {
                if (hitchLog.length >= maxHitches) hitchLog.shift();
                hitchLog.push(Object.freeze({
                    frame: frames, atMs: round2(at - firstTick), intervalMs: round2(interval),
                    workMs: Number.isNaN(frameWork) ? null : round2(frameWork),
                    sections: Object.freeze(lastSections), frameStats,
                }));
            }
        }
    }

    function addTime(name: string, milliseconds: number): void {
        if (disposed || !validName(name) || !(milliseconds >= 0) || !Number.isFinite(milliseconds)) return;
        let section = sections.get(name);
        if (section === undefined) {
            if (sections.size >= MAX_NAMES) return;
            section = { current: 0, last: 0, total: 0, max: 0, frames: 0 };
            sections.set(name, section);
        }
        section.current += milliseconds;
    }

    function snapshot(): PerformanceSnapshot {
        const interval = summarize(intervals, scratch);
        // Frames per second over about the last second, so one hitch does not linger.
        let fps = 0;
        if (intervals.length > 0) {
            let sum = 0, used = 0;
            while (used < intervals.length && sum < 1000) { sum += intervals.recent(used); used++; }
            fps = sum > 0 ? used * 1000 / sum : 0;
        }
        const sectionList: SectionSummary[] = [];
        for (const [name, section] of sections) {
            sectionList.push(Object.freeze({ name, lastMs: section.last, meanMs: section.frames > 0 ? section.total / section.frames : 0, maxMs: section.max }));
        }
        const counterList: CounterSummary[] = [];
        for (const [name, counter] of counters) counterList.push(Object.freeze({ name, last: counter.last, total: counter.total }));
        const sourceValues: Record<string, SourceValues> = {};
        for (const [name, read] of sources) {
            try { sourceValues[name] = Object.freeze({ ...read() }); }
            catch (cause) { sourceValues[name] = Object.freeze({ error: String((cause as { readonly message?: unknown } | null)?.message ?? cause) }); }
        }
        return Object.freeze({
            frames, fps, budgetMs, interval, work: workSeen ? summarize(work, scratch) : null,
            dropped, hitches: hitchCount, pauses,
            sections: Object.freeze(sectionList), counters: Object.freeze(counterList),
            gauges: Object.freeze(Object.fromEntries(gauges)), sources: Object.freeze(sourceValues),
            frame: frameStats, overheadMs: analysisFrames > 0 ? analysisMs / analysisFrames : 0,
        });
    }

    function history(): PerformanceHistory {
        const intervalMs = new Float32Array(intervals.length), workMs = new Float32Array(work.length);
        intervals.copyInto(intervalMs); work.copyInto(workMs);
        return { intervalMs, workMs };
    }

    function reset(): void {
        intervals.clear(); work.clear(); sections.clear(); counters.clear(); hitchLog = [];
        lastTick = firstTick = frameStart = Number.NaN;
        currentWork = 0; workUsed = workSeen = false;
        frames = dropped = hitchCount = pauses = 0;
        frameStats = null; analysisMs = analysisFrames = 0;
    }

    return Object.freeze({
        active: true,
        now,
        tick,
        beginFrame(nowMs?: number): void { if (!disposed) frameStart = time(nowMs); },
        endFrame(nowMs?: number): void {
            if (disposed || Number.isNaN(frameStart)) return;
            const elapsed = time(nowMs) - frameStart;
            frameStart = Number.NaN;
            if (elapsed >= 0) { currentWork += elapsed; workUsed = true; }
        },
        measure<T>(name: string, run: () => T): T {
            if (disposed) return run();
            const started = now();
            try { return run(); }
            finally { addTime(name, now() - started); }
        },
        addTime,
        addCount(name: string, amount = 1): void {
            if (disposed || !validName(name) || !Number.isFinite(amount)) return;
            let counter = counters.get(name);
            if (counter === undefined) {
                if (counters.size >= MAX_NAMES) return;
                counter = { current: 0, last: 0, total: 0 };
                counters.set(name, counter);
            }
            counter.current += amount;
        },
        setGauge(name: string, value: number | string): void {
            if (disposed || !validName(name) || (typeof value !== 'number' && typeof value !== 'string')) return;
            if (!gauges.has(name) && gauges.size >= MAX_NAMES) return;
            gauges.set(name, value);
        },
        observeSharedFrame<T extends SharedFrameLike>(frame: T): T {
            if (disposed || frame === null || typeof frame !== 'object') return frame;
            const started = now();
            // A debugging aid must never turn a readable frame into a thrown error.
            try { frameStats = analyzeSharedFrame(frame); } catch { /* keep the previous counts */ }
            analysisMs += now() - started; analysisFrames++;
            return frame;
        },
        addSource(name: string, read: () => SourceValues): () => void {
            if (!validName(name)) throw new TypeError('name');
            if (typeof read !== 'function') throw new TypeError('read');
            if (disposed) return () => {};
            if (!sources.has(name) && sources.size >= MAX_NAMES) throw new RangeError('sources');
            sources.set(name, read);
            return () => { if (sources.get(name) === read) sources.delete(name); };
        },
        snapshot,
        history,
        hitches: (): readonly HitchRecord[] => Object.freeze(hitchLog.slice()),
        exportSession(environment: Readonly<Record<string, number | string | boolean | null>> = {}): PerformanceSession {
            const { intervalMs, workMs } = history();
            return Object.freeze({
                schema: 'egret.devtools.performance-session/1' as const,
                exportedAt: new Date().toISOString(),
                environment: Object.freeze({ ...environment }),
                snapshot: snapshot(),
                history: Object.freeze({ intervalMs: Object.freeze(Array.from(intervalMs, round2)), workMs: Object.freeze(Array.from(workMs, round2)) }),
                hitches: Object.freeze(hitchLog.slice()),
            });
        },
        reset,
        dispose(): void { if (disposed) return; reset(); gauges.clear(); sources.clear(); disposed = true; },
    });
}

const EMPTY_SNAPSHOT: PerformanceSnapshot = Object.freeze({
    frames: 0, fps: 0, budgetMs: 1000 / 60, interval: null, work: null, dropped: 0, hitches: 0, pauses: 0,
    sections: Object.freeze([]), counters: Object.freeze([]), gauges: Object.freeze({}), sources: Object.freeze({}),
    frame: null, overheadMs: 0,
});

const INERT: PerformanceMonitor = Object.freeze({
    active: false,
    now: (): number => 0,
    tick(): void {}, beginFrame(): void {}, endFrame(): void {},
    measure<T>(_name: string, run: () => T): T { return run(); },
    addTime(): void {}, addCount(): void {}, setGauge(): void {},
    observeSharedFrame<T extends SharedFrameLike>(frame: T): T { return frame; },
    addSource(): () => void { return () => {}; },
    snapshot: (): PerformanceSnapshot => EMPTY_SNAPSHOT,
    history: (): PerformanceHistory => ({ intervalMs: new Float32Array(0), workMs: new Float32Array(0) }),
    hitches: (): readonly HitchRecord[] => Object.freeze([]),
    exportSession(environment: Readonly<Record<string, number | string | boolean | null>> = {}): PerformanceSession {
        return Object.freeze({
            schema: 'egret.devtools.performance-session/1' as const, exportedAt: new Date().toISOString(),
            environment: Object.freeze({ ...environment }), snapshot: EMPTY_SNAPSHOT,
            history: Object.freeze({ intervalMs: Object.freeze([]), workMs: Object.freeze([]) }), hitches: Object.freeze([]),
        });
    },
    reset(): void {}, dispose(): void {},
});

/** The monitor used outside debug mode: every call returns at once and records nothing. */
export function inertPerformanceMonitor(): PerformanceMonitor { return INERT; }
