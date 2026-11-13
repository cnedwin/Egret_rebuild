// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPerformanceMonitor, evaluateHints } from '@egret/devtools';

const timing = (p95Ms) => ({ lastMs: p95Ms, meanMs: p95Ms, p50Ms: p95Ms, p95Ms, p99Ms: p95Ms, maxMs: p95Ms });
const frameStats = (extra = {}) => ({
    frameId: 1, width: 1, height: 1, commands: 0, rects: 0, images: 0, meshes: 0, barriers: 0, effects: 0, triangles: 0,
    pages: 0, regions: 0, materials: 0, geometries: 0, pageBytes: 0, runs: 0,
    switches: { material: 0, page: 0, region: 0, clip: 0, barrier: 0 }, ...extra,
});
function snapshot(extra = {}) {
    return {
        frames: 1000, fps: 60, budgetMs: 10, interval: timing(10), work: null, dropped: 0, hitches: 0, pauses: 0,
        sections: [], counters: [], gauges: {}, sources: {}, frame: null, overheadMs: 0, ...extra,
    };
}
const ids = (hints) => hints.map((hint) => hint.id);

test('a healthy snapshot has no hints', () => {
    assert.deepEqual(evaluateHints(snapshot({ work: timing(4), frame: frameStats({ regions: 10, runs: 4 }), sources: { host: { state: 'active', pendingFrames: 1 }, handles: { tweens: 3 } } })), []);
    assert.deepEqual(evaluateHints(snapshot({ interval: null })), []);
});

test('slow frames with heavy work are CPU bound and name the largest section', () => {
    const [hint] = evaluateHints(snapshot({ interval: timing(30), work: timing(22), sections: [{ name: 'logic', lastMs: 1, meanMs: 3, maxMs: 9 }, { name: 'submit', lastMs: 1, meanMs: 15, maxMs: 20 }] }));
    assert.deepEqual(hint, { id: 'cpu-bound', severity: 'problem', subject: 'submit', value: 22, limit: 10 });
});

test('slow frames with light work point at presentation, and without work data stay general', () => {
    assert.deepEqual(evaluateHints(snapshot({ interval: timing(30), work: timing(3) })), [{ id: 'present-bound', severity: 'warning', value: 30, limit: 10 }]);
    assert.deepEqual(ids(evaluateHints(snapshot({ interval: timing(30) }))), ['slow-frames']);
    assert.deepEqual(ids(evaluateHints(snapshot({ interval: timing(30), work: timing(7) }))), ['slow-frames']);
    assert.deepEqual(evaluateHints(snapshot({ interval: timing(15), work: timing(14) })), []);
});

test('a recent hitch names its largest section and ages out', () => {
    const hitches = [{ frame: 100, atMs: 0, intervalMs: 40, workMs: 5, sections: { a: 1 }, frameStats: null }, { frame: 900, atMs: 0, intervalMs: 80, workMs: 70, sections: { logic: 60, submit: 9 }, frameStats: null }];
    assert.deepEqual(evaluateHints(snapshot(), { hitches }), [{ id: 'recent-hitch', severity: 'warning', subject: 'logic', value: 80, limit: 10 }]);
    assert.deepEqual(evaluateHints(snapshot({ frames: 5000 }), { hitches }), []);
    assert.deepEqual(ids(evaluateHints(snapshot({ frames: 5000 }), { hitches, recentFrames: 10000 })), ['recent-hitch']);
    assert.deepEqual(evaluateHints(snapshot(), { hitches: [{ frame: 990, atMs: 0, intervalMs: 50, workMs: null, sections: {}, frameStats: null }] }), [{ id: 'recent-hitch', severity: 'warning', value: 50, limit: 10 }]);
});

test('regions warn at four fifths of the limit and are a problem at the limit', () => {
    assert.deepEqual(evaluateHints(snapshot({ frame: frameStats({ regions: 102 }) })), []);
    assert.deepEqual(evaluateHints(snapshot({ frame: frameStats({ regions: 103 }) })), [{ id: 'regions-near-limit', severity: 'warning', value: 103, limit: 128 }]);
    assert.deepEqual(evaluateHints(snapshot({ frame: frameStats({ regions: 128 }) })), [{ id: 'regions-full', severity: 'problem', value: 128, limit: 128 }]);
    assert.deepEqual(ids(evaluateHints(snapshot({ frame: frameStats({ regions: 8 }) }), { regionLimit: 10 })), ['regions-near-limit']);
});

test('run breaks are reported when one reason causes half the runs', () => {
    const breaks = (runs, switches) => evaluateHints(snapshot({ frame: frameStats({ runs, switches: { material: 0, page: 0, region: 0, clip: 0, barrier: 0, ...switches } }) }));
    assert.deepEqual(breaks(200, { page: 199 }), [{ id: 'run-breaks', severity: 'warning', subject: 'page', value: 199, limit: 200 }]);
    assert.deepEqual(breaks(200, { page: 60, clip: 70 }), []);
    assert.deepEqual(breaks(12, { page: 11 }), []);
});

test('four effect passes are worth a hint', () => {
    assert.deepEqual(ids(evaluateHints(snapshot({ frame: frameStats({ effects: 3 }) }))), []);
    assert.deepEqual(evaluateHints(snapshot({ frame: frameStats({ effects: 5 }) })), [{ id: 'effect-passes', severity: 'warning', value: 5, limit: 4 }]);
});

test('host failure, inactive state and backlog are read from the host source', () => {
    assert.deepEqual(evaluateHints(snapshot({ sources: { host: { state: 'lost', firstFailure: 'WEBGL2_CONTEXT_LOST', pendingFrames: 0 } } })), [{ id: 'host-failed', severity: 'problem', subject: 'WEBGL2_CONTEXT_LOST' }]);
    assert.deepEqual(evaluateHints(snapshot({ sources: { host: { state: 'restoring' } } })), [{ id: 'host-not-active', severity: 'problem', subject: 'restoring' }]);
    assert.deepEqual(evaluateHints(snapshot({ sources: { host: { state: 'active', pendingFrames: 2 } } })), [{ id: 'host-backlog', severity: 'warning', value: 2, limit: 2 }]);
});

test('growing handle kinds are named with their count', () => {
    assert.deepEqual(evaluateHints(snapshot({ sources: { handles: { scopes: 2, tweens: '57 ↑', subtreeTickets: '9 ↑' } } })), [
        { id: 'handles-growing', severity: 'warning', subject: 'tweens', value: 57 }, { id: 'handles-growing', severity: 'warning', subject: 'subtreeTickets', value: 9 },
    ]);
});

test('problems are listed before warnings and the result is frozen', () => {
    const hints = evaluateHints(snapshot({ interval: timing(30), work: timing(3), frame: frameStats({ regions: 128, effects: 6 }), sources: { host: { state: 'active', pendingFrames: 3 } } }));
    assert.deepEqual(ids(hints), ['regions-full', 'present-bound', 'effect-passes', 'host-backlog']);
    assert.ok(Object.isFrozen(hints) && Object.isFrozen(hints[0]));
});

test('a live monitor snapshot can be evaluated directly', () => {
    let time = 0;
    const monitor = createPerformanceMonitor({ now: () => time });
    monitor.tick();
    for (let i = 0; i < 30; i++) { monitor.beginFrame(); monitor.addTime('logic', 38); time += 38; monitor.endFrame(); time += 2; monitor.tick(); }
    const hints = evaluateHints(monitor.snapshot(), { hitches: monitor.hitches() });
    assert.deepEqual(ids(hints), ['cpu-bound', 'recent-hitch']);
    assert.equal(hints[0].subject, 'logic');
});
