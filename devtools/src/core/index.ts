// SPDX-License-Identifier: Apache-2.0
export { createEngineProbe, ENGINE_SECTIONS } from './engineProbe.js';
export type { EngineProbe } from './engineProbe.js';
export { createHandleTracker } from './handles.js';
export { evaluateHints } from './hints.js';
export type { Hint, HintId, HintOptions } from './hints.js';
export type { HandleCount, HandleTracker, HandleTrackerOptions } from './handles.js';
export { analyzeSharedFrame } from './frameStats.js';
export type { SharedFrameLike, SharedFrameStats, SharedFrameSwitches } from './frameStats.js';
export { createPerformanceMonitor, inertPerformanceMonitor } from './monitor.js';
export type {
    CounterSummary, HitchRecord, PerformanceHistory, PerformanceMonitor, PerformanceMonitorOptions,
    PerformanceSession, PerformanceSnapshot, SectionSummary, SourceValues, TimingSummary,
} from './types.js';
