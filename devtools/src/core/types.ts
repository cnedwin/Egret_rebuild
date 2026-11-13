// SPDX-License-Identifier: Apache-2.0
import type { SharedFrameLike, SharedFrameStats } from './frameStats.js';

export interface PerformanceMonitorOptions {
    /** Frames kept for percentiles and the graph. Default 240. */
    readonly historySize?: number;
    /** The frame interval the game aims for, in milliseconds. Default 1000 / 60. */
    readonly budgetMs?: number;
    /** A frame at least this long is kept in the hitch log. Default twice the budget. */
    readonly hitchThresholdMs?: number;
    /** Hitches kept; the oldest is dropped first. Default 32. */
    readonly maxHitches?: number;
    /** A gap at least this long is a pause (hidden tab, breakpoint), not a frame. Default 1000. */
    readonly pauseThresholdMs?: number;
    /** Millisecond clock. Default performance.now(). */
    readonly now?: () => number;
}

export interface TimingSummary {
    readonly lastMs: number;
    readonly meanMs: number;
    readonly p50Ms: number;
    readonly p95Ms: number;
    readonly p99Ms: number;
    readonly maxMs: number;
}

export interface SectionSummary {
    readonly name: string;
    /** Time in the last completed frame. */
    readonly lastMs: number;
    /** Mean over the completed frames since the section first appeared. */
    readonly meanMs: number;
    readonly maxMs: number;
}

export interface CounterSummary {
    readonly name: string;
    readonly last: number;
    readonly total: number;
}

export type SourceValues = Readonly<Record<string, number | string | boolean | null>>;

export interface HitchRecord {
    /** One-based index of the long frame. */
    readonly frame: number;
    /** Milliseconds since the monitor saw its first frame. */
    readonly atMs: number;
    readonly intervalMs: number;
    /** Measured work inside the frame, or null when beginFrame/endFrame were not used. */
    readonly workMs: number | null;
    readonly sections: Readonly<Record<string, number>>;
    readonly frameStats: SharedFrameStats | null;
}

export interface PerformanceSnapshot {
    readonly frames: number;
    readonly fps: number;
    readonly budgetMs: number;
    /** Time between frame boundaries. Null before the second frame. */
    readonly interval: TimingSummary | null;
    /** Work measured between beginFrame and endFrame. Null when unused. */
    readonly work: TimingSummary | null;
    /** Frames longer than one and a half budgets. */
    readonly dropped: number;
    readonly hitches: number;
    readonly pauses: number;
    readonly sections: readonly SectionSummary[];
    readonly counters: readonly CounterSummary[];
    readonly gauges: Readonly<Record<string, number | string>>;
    readonly sources: Readonly<Record<string, SourceValues>>;
    readonly frame: SharedFrameStats | null;
    /** Mean time the monitor spent reading frames, per observed frame. */
    readonly overheadMs: number;
}

export interface PerformanceSession {
    readonly schema: 'egret.devtools.performance-session/1';
    readonly exportedAt: string;
    readonly environment: Readonly<Record<string, number | string | boolean | null>>;
    readonly snapshot: PerformanceSnapshot;
    /** Oldest first, rounded to a hundredth of a millisecond. */
    readonly history: { readonly intervalMs: readonly number[]; readonly workMs: readonly number[] };
    readonly hitches: readonly HitchRecord[];
}

export interface PerformanceHistory {
    /** Oldest first. A fresh copy on each call. */
    readonly intervalMs: Float32Array;
    readonly workMs: Float32Array;
}

export interface PerformanceMonitor {
    /** False for the inert monitor used outside debug mode. */
    readonly active: boolean;
    /** The millisecond clock this monitor measures with. */
    now(): number;
    /** Mark a frame boundary. Call once per displayed frame. */
    tick(nowMs?: number): void;
    /** Mark the start of this frame's work. Optional. */
    beginFrame(nowMs?: number): void;
    /** Mark the end of this frame's work. */
    endFrame(nowMs?: number): void;
    /** Time a synchronous call and add it to the named section of this frame. */
    measure<T>(name: string, run: () => T): T;
    /** Add time measured elsewhere to the named section of this frame. */
    addTime(name: string, milliseconds: number): void;
    /** Add to a per-frame counter. */
    addCount(name: string, amount?: number): void;
    /** Set a value that is shown as it is until it is set again. */
    setGauge(name: string, value: number | string): void;
    /** Read counts from a captured shared frame. Returns the frame it was given. */
    observeSharedFrame<T extends SharedFrameLike>(frame: T): T;
    /** Register values that are read when a snapshot is taken. Returns the removal function. */
    addSource(name: string, read: () => SourceValues): () => void;
    snapshot(): PerformanceSnapshot;
    history(): PerformanceHistory;
    hitches(): readonly HitchRecord[];
    exportSession(environment?: Readonly<Record<string, number | string | boolean | null>>): PerformanceSession;
    /** Forget all measurements. Sources and gauges stay. */
    reset(): void;
    dispose(): void;
}
