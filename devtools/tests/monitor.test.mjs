// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPerformanceMonitor, inertPerformanceMonitor } from '@egret/devtools';

/** A monitor on a hand-driven clock. */
function fixture(options = {}) {
    let time = 0;
    const monitor = createPerformanceMonitor({ now: () => time, ...options });
    return {
        monitor,
        advance(ms) { time += ms; },
        frame(ms) { time += ms; monitor.tick(); },
        frames(count, ms) { for (let i = 0; i < count; i++) this.frame(ms); },
    };
}

test('a steady 60 Hz run reports 60 fps and equal percentiles', () => {
    const f = fixture();
    f.monitor.tick();
    f.frames(120, 1000 / 60);
    const s = f.monitor.snapshot();
    assert.equal(s.frames, 120);
    assert.ok(Math.abs(s.fps - 60) < 0.01, String(s.fps));
    for (const key of ['lastMs', 'meanMs', 'p50Ms', 'p95Ms', 'p99Ms', 'maxMs']) assert.ok(Math.abs(s.interval[key] - 1000 / 60) < 0.001, key);
    assert.equal(s.dropped, 0);
    assert.equal(s.hitches, 0);
    assert.equal(s.work, null);
});

test('the first tick only sets the origin', () => {
    const f = fixture();
    f.monitor.tick();
    const s = f.monitor.snapshot();
    assert.equal(s.frames, 0);
    assert.equal(s.interval, null);
    assert.equal(s.fps, 0);
});

test('percentiles rank the recorded intervals', () => {
    const f = fixture({ historySize: 100, hitchThresholdMs: 500 });
    f.monitor.tick();
    for (let i = 1; i <= 100; i++) f.frame(i);
    const { interval } = f.monitor.snapshot();
    assert.equal(interval.p50Ms, 50);
    assert.equal(interval.p95Ms, 95);
    assert.equal(interval.p99Ms, 99);
    assert.equal(interval.maxMs, 100);
    assert.equal(interval.lastMs, 100);
    assert.equal(interval.meanMs, 50.5);
});

test('history keeps the newest frames, oldest first', () => {
    const f = fixture({ historySize: 16, hitchThresholdMs: 500 });
    f.monitor.tick();
    for (let i = 1; i <= 20; i++) f.frame(i);
    assert.deepEqual(Array.from(f.monitor.history().intervalMs), [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    assert.equal(f.monitor.snapshot().frames, 20);
});

test('a long frame is counted as dropped and kept in the hitch log with its sections', () => {
    const f = fixture();
    f.monitor.tick();
    f.frames(10, 16);
    f.monitor.addTime('ai', 30);
    f.monitor.beginFrame(); f.advance(40); f.monitor.endFrame();
    f.frame(10);
    f.frames(5, 16);
    const s = f.monitor.snapshot();
    assert.equal(s.dropped, 1);
    assert.equal(s.hitches, 1);
    const [hitch] = f.monitor.hitches();
    assert.equal(hitch.frame, 11);
    assert.equal(hitch.intervalMs, 50);
    assert.equal(hitch.workMs, 40);
    assert.deepEqual(hitch.sections, { ai: 30 });
    assert.equal(hitch.atMs, 210);
    assert.equal(hitch.frameStats, null);
});

test('the hitch log drops its oldest entry at the limit', () => {
    const f = fixture({ maxHitches: 2 });
    f.monitor.tick();
    f.frame(40); f.frame(50); f.frame(60);
    assert.deepEqual(f.monitor.hitches().map((hitch) => hitch.intervalMs), [50, 60]);
    assert.equal(f.monitor.snapshot().hitches, 3);
});

test('a gap of a second or more is a pause, not a frame', () => {
    const f = fixture();
    f.monitor.tick();
    f.frames(5, 16);
    f.monitor.addTime('ai', 3);
    f.frame(5000);
    f.frames(5, 16);
    const s = f.monitor.snapshot();
    assert.equal(s.pauses, 1);
    assert.equal(s.frames, 10);
    assert.equal(s.hitches, 0);
    assert.equal(s.interval.maxMs, 16);
});

test('measure times the call, returns its value and records the time even when it throws', () => {
    const f = fixture();
    f.monitor.tick();
    assert.equal(f.monitor.measure('logic', () => { f.advance(3); return 7; }), 7);
    assert.throws(() => f.monitor.measure('logic', () => { f.advance(2); throw new Error('boom'); }), /boom/);
    f.frame(11);
    f.monitor.measure('logic', () => f.advance(1));
    f.frame(15);
    const [logic] = f.monitor.snapshot().sections;
    assert.deepEqual(logic, { name: 'logic', lastMs: 1, meanMs: 3, maxMs: 5 });
});

test('work is the time between beginFrame and endFrame', () => {
    const f = fixture();
    f.monitor.tick();
    for (const ms of [4, 6, 8]) {
        f.monitor.beginFrame(); f.advance(ms); f.monitor.endFrame();
        f.frame(16 - ms);
    }
    const { work } = f.monitor.snapshot();
    assert.equal(work.lastMs, 8);
    assert.equal(work.meanMs, 6);
    assert.equal(work.maxMs, 8);
    assert.deepEqual(Array.from(f.monitor.history().workMs), [4, 6, 8]);
});

test('counters roll per frame; gauges hold their value', () => {
    const f = fixture();
    f.monitor.tick();
    f.monitor.addCount('spawned', 3); f.monitor.addCount('spawned');
    f.monitor.setGauge('level', 'forest');
    f.frame(16);
    f.monitor.addCount('spawned', 2);
    f.frame(16);
    f.frame(16);
    const s = f.monitor.snapshot();
    assert.deepEqual(s.counters, [{ name: 'spawned', last: 0, total: 6 }]);
    assert.deepEqual(s.gauges, { level: 'forest' });
});

test('sources are read at snapshot time and a throwing source is reported, not thrown', () => {
    const f = fixture();
    let pending = 1;
    const remove = f.monitor.addSource('host', () => ({ pendingFrames: pending }));
    f.monitor.addSource('broken', () => { throw new Error('lost'); });
    assert.deepEqual(f.monitor.snapshot().sources, { host: { pendingFrames: 1 }, broken: { error: 'lost' } });
    pending = 2;
    assert.equal(f.monitor.snapshot().sources.host.pendingFrames, 2);
    remove();
    assert.deepEqual(Object.keys(f.monitor.snapshot().sources), ['broken']);
});

test('invalid options and source registrations are refused', () => {
    assert.throws(() => createPerformanceMonitor({ historySize: 8 }), RangeError);
    assert.throws(() => createPerformanceMonitor({ historySize: 1.5 }), RangeError);
    assert.throws(() => createPerformanceMonitor({ budgetMs: 0 }), RangeError);
    assert.throws(() => createPerformanceMonitor({ hitchThresholdMs: Number.NaN }), RangeError);
    assert.throws(() => createPerformanceMonitor({ now: 5 }), TypeError);
    const monitor = createPerformanceMonitor();
    assert.throws(() => monitor.addSource('', () => ({})), TypeError);
    assert.throws(() => monitor.addSource('x', null), TypeError);
});

test('bad measurements are ignored rather than thrown into the game', () => {
    const f = fixture();
    f.monitor.tick();
    f.monitor.addTime('', 1); f.monitor.addTime('x', -1); f.monitor.addTime('y', Number.NaN); f.monitor.addTime('z'.repeat(65), 1);
    f.monitor.addCount('n', Number.POSITIVE_INFINITY); f.monitor.setGauge('g', {});
    f.monitor.endFrame();
    assert.equal(f.monitor.observeSharedFrame(null), null);
    f.frame(16);
    const s = f.monitor.snapshot();
    assert.deepEqual(s.sections, []);
    assert.deepEqual(s.counters, []);
    assert.deepEqual(s.gauges, {});
    assert.equal(s.work, null);
});

test('the number of distinct section names is bounded', () => {
    const f = fixture();
    for (let i = 0; i < 100; i++) f.monitor.addTime('s' + i, 1);
    f.monitor.tick(); f.frame(16);
    assert.equal(f.monitor.snapshot().sections.length, 64);
});

test('an exported session is plain JSON with the schema name', () => {
    const f = fixture();
    f.monitor.tick();
    f.frames(3, 16.666);
    f.frame(40);
    const session = JSON.parse(JSON.stringify(f.monitor.exportSession({ backend: 'webgl2' })));
    assert.equal(session.schema, 'egret.devtools.performance-session/1');
    assert.deepEqual(session.environment, { backend: 'webgl2' });
    assert.deepEqual(session.history.intervalMs, [16.67, 16.67, 16.67, 40]);
    assert.equal(session.hitches.length, 1);
    assert.equal(session.snapshot.frames, 4);
    assert.ok(!Number.isNaN(Date.parse(session.exportedAt)));
});

test('reset forgets measurements and keeps sources and gauges', () => {
    const f = fixture();
    f.monitor.addSource('host', () => ({ ok: true }));
    f.monitor.setGauge('level', 1);
    f.monitor.tick(); f.frames(5, 40);
    f.monitor.reset();
    const s = f.monitor.snapshot();
    assert.equal(s.frames, 0); assert.equal(s.hitches, 0); assert.equal(s.interval, null);
    assert.deepEqual(f.monitor.hitches(), []);
    assert.deepEqual(s.sources, { host: { ok: true } });
    assert.deepEqual(s.gauges, { level: 1 });
});

test('a disposed monitor records nothing and still runs measured calls', () => {
    const f = fixture();
    f.monitor.tick(); f.frames(3, 16);
    f.monitor.dispose(); f.monitor.dispose();
    f.frames(3, 16);
    assert.equal(f.monitor.measure('x', () => 5), 5);
    assert.equal(f.monitor.snapshot().frames, 0);
    assert.equal(typeof f.monitor.addSource('late', () => ({})), 'function');
    assert.deepEqual(f.monitor.snapshot().sources, {});
});

test('the inert monitor runs measured calls and records nothing', () => {
    const monitor = inertPerformanceMonitor();
    assert.equal(monitor.active, false);
    assert.equal(createPerformanceMonitor().active, true);
    monitor.tick(0); monitor.tick(16); monitor.addTime('x', 1);
    const frame = { commands: [] };
    assert.equal(monitor.observeSharedFrame(frame), frame);
    assert.equal(monitor.measure('x', () => 'value'), 'value');
    assert.equal(monitor.snapshot().frames, 0);
    assert.equal(monitor.exportSession().schema, 'egret.devtools.performance-session/1');
    assert.equal(inertPerformanceMonitor(), monitor);
});
