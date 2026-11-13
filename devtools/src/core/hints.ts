// SPDX-License-Identifier: Apache-2.0
// Turns a snapshot into the few things worth a developer's attention. Each
// rule reads numbers already in the snapshot and names what it found; the
// wording belongs to whoever displays it.
import type { HitchRecord, PerformanceSnapshot } from './types.js';

export type HintId =
    | 'cpu-bound' | 'present-bound' | 'slow-frames' | 'recent-hitch'
    | 'regions-full' | 'regions-near-limit' | 'run-breaks' | 'effect-passes'
    | 'host-failed' | 'host-not-active' | 'host-backlog' | 'handles-growing';

export interface Hint {
    readonly id: HintId;
    readonly severity: 'warning' | 'problem';
    /** The thing the hint is about: a section, a break reason, a handle kind or a failure code. */
    readonly subject?: string;
    /** The number behind the hint, in the unit its rule names. */
    readonly value?: number;
    /** What the value is compared with. */
    readonly limit?: number;
}

export interface HintOptions {
    /** Regions one shared frame may hold. Default 128. */
    readonly regionLimit?: number;
    /** The hitch log, for the latest long frame. */
    readonly hitches?: readonly HitchRecord[];
    /** A hitch counts as recent for this many frames. Default 600. */
    readonly recentFrames?: number;
}

function largest(values: Readonly<Record<string, number>>): string | undefined {
    let best: string | undefined;
    for (const [name, value] of Object.entries(values)) if (best === undefined || value > (values[best] as number)) best = name;
    return best;
}

/** Evaluate every rule against one snapshot. Problems come before warnings. */
export function evaluateHints(snapshot: PerformanceSnapshot, options: HintOptions = {}): readonly Hint[] {
    const hints: Hint[] = [];
    const budget = snapshot.budgetMs, interval = snapshot.interval, work = snapshot.work;

    // Slow frames: say where the time went when the numbers allow it.
    if (interval !== null && interval.p95Ms > budget * 1.5) {
        if (work !== null && work.p95Ms > budget) {
            const top = largest(Object.fromEntries(snapshot.sections.map((entry) => [entry.name, entry.meanMs])));
            hints.push({ id: 'cpu-bound', severity: 'problem', ...(top === undefined ? {} : { subject: top }), value: work.p95Ms, limit: budget });
        } else if (work !== null && work.p95Ms < budget * 0.5) {
            // The page's own work fits easily, so the wait is in the GPU, the compositor or the display.
            hints.push({ id: 'present-bound', severity: 'warning', value: interval.p95Ms, limit: budget });
        } else hints.push({ id: 'slow-frames', severity: 'warning', value: interval.p95Ms, limit: budget });
    }

    const latest = options.hitches?.at(-1);
    if (latest !== undefined && snapshot.frames - latest.frame <= (options.recentFrames ?? 600)) {
        const top = largest(latest.sections);
        hints.push({ id: 'recent-hitch', severity: 'warning', ...(top === undefined ? {} : { subject: top }), value: latest.intervalMs, limit: budget });
    }

    const frame = snapshot.frame;
    if (frame !== null) {
        const limit = options.regionLimit ?? 128;
        if (frame.regions >= limit) hints.push({ id: 'regions-full', severity: 'problem', value: frame.regions, limit });
        else if (frame.regions >= limit * 0.8) hints.push({ id: 'regions-near-limit', severity: 'warning', value: frame.regions, limit });
        const reason = largest(frame.switches as unknown as Record<string, number>);
        if (reason !== undefined && frame.runs >= 16) {
            const count = (frame.switches as unknown as Record<string, number>)[reason] as number;
            if (count * 2 >= frame.runs) hints.push({ id: 'run-breaks', severity: 'warning', subject: reason, value: count, limit: frame.runs });
        }
        if (frame.effects >= 4) hints.push({ id: 'effect-passes', severity: 'warning', value: frame.effects, limit: 4 });
    }

    const host = snapshot.sources['host'];
    if (host !== undefined) {
        const failure = host['firstFailure'], state = host['state'], pending = host['pendingFrames'];
        if (typeof failure === 'string') hints.push({ id: 'host-failed', severity: 'problem', subject: failure });
        else if (typeof state === 'string' && state !== 'active') hints.push({ id: 'host-not-active', severity: 'problem', subject: state });
        if (typeof pending === 'number' && pending >= 2) hints.push({ id: 'host-backlog', severity: 'warning', value: pending, limit: 2 });
    }

    const handles = snapshot.sources['handles'];
    if (handles !== undefined) {
        for (const [kind, value] of Object.entries(handles)) {
            if (typeof value === 'string' && value.endsWith('↑')) hints.push({ id: 'handles-growing', severity: 'warning', subject: kind, value: Number.parseInt(value, 10) });
        }
    }

    return Object.freeze(hints.sort((a, b) => Number(b.severity === 'problem') - Number(a.severity === 'problem')).map((hint) => Object.freeze(hint)));
}
