// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngineProbe, createHandleTracker, createPerformanceMonitor, inertPerformanceMonitor } from '@egret/devtools';
import { recordWorld3DFrame, sharedWebGL2TimingSource } from '@egret/devtools/web';

/** A monitor, a host and an engine on one hand-driven clock. */
function fixture() {
    let time = 0;
    const monitor = createPerformanceMonitor({ now: () => time });
    const submitted = [];
    // Frozen members and private state, like the real hosts.
    class Host {
        #pending = 0;
        get pendingFrames() { return this.#pending; }
        getStatus() { return { pendingFrames: this.#pending }; }
    }
    const host = new Host();
    Object.defineProperties(host, {
        sharedFrameProfile: { value: 'egret.shared-frame2d/1', enumerable: true },
        surface: { value: { id: 'canvas' }, enumerable: true },
        renderSharedFrame: { value(frame) { time += 3; submitted.push([this, frame]); return undefined; }, enumerable: true },
    });
    Object.freeze(host);
    const engineFor = (port) => ({
        frameId: 0,
        advanceTime(seconds) { time += 1; return { deltaSeconds: seconds }; },
        renderSharedFrame(options) {
            time += 2; // capture
            const frame = { frameId: ++this.frameId, width: options.width, height: 1, commands: [{ kind: 'rect', materialIndex: 0 }], pages: [], regions: [], materials: [], geometries: [] };
            Reflect.apply(port.renderSharedFrame, port, [frame]);
            return frame;
        },
    });
    return { monitor, host, submitted, engineFor, frame(ms = 10) { time += ms; monitor.tick(); } };
}

const sections = (monitor) => Object.fromEntries(monitor.snapshot().sections.map((entry) => [entry.name, entry.lastMs]));

test('a wrapped host splits the frame into clock, capture and submit', () => {
    const f = fixture(), probe = createEngineProbe(f.monitor);
    const wrapped = probe.wrapHost(f.host), engine = f.engineFor(wrapped);
    f.monitor.tick();
    assert.deepEqual(probe.advanceTime(engine, 0.5), { deltaSeconds: 0.5 });
    const frame = probe.renderSharedFrame(engine, { width: 8 });
    assert.equal(frame.frameId, 1);
    f.frame();
    assert.deepEqual(sections(f.monitor), { clock: 1, submit: 3, capture: 2 });
    assert.equal(f.monitor.snapshot().frame.rects, 1);
});

test('the wrapped host calls the real port with the real host and forwards everything else', () => {
    const f = fixture(), wrapped = createEngineProbe(f.monitor).wrapHost(f.host);
    const frame = { commands: [] };
    assert.equal(wrapped.renderSharedFrame(frame), undefined);
    assert.equal(f.submitted[0][0], f.host);
    assert.equal(f.submitted[0][1], frame);
    assert.equal(wrapped.surface, f.host.surface);
    assert.equal(wrapped.sharedFrameProfile, 'egret.shared-frame2d/1');
    assert.equal(wrapped.pendingFrames, 0);
    assert.deepEqual(wrapped.getStatus(), { pendingFrames: 0 });
    assert.notEqual(wrapped, f.host);
    assert.ok(Object.isFrozen(wrapped));
});

test('a host that throws is still timed and the error passes through', () => {
    let time = 0;
    const monitor = createPerformanceMonitor({ now: () => time });
    const wrapped = createEngineProbe(monitor).wrapHost({ renderSharedFrame() { time += 4; throw new Error('lost'); } });
    monitor.tick();
    assert.throws(() => wrapped.renderSharedFrame({ commands: [] }), /lost/);
    time += 10; monitor.tick();
    assert.deepEqual(sections(monitor), { submit: 4 });
});

test('without a wrapped host the frame is one render section and is still counted', () => {
    const f = fixture(), probe = createEngineProbe(f.monitor), engine = f.engineFor(f.host);
    f.monitor.tick();
    probe.renderSharedFrame(engine, { width: 8 });
    f.frame();
    assert.deepEqual(sections(f.monitor), { render: 5 });
    assert.equal(f.monitor.snapshot().frame.frameId, 1);
});

test('submit outside renderSharedFrame does not leak into the next capture', () => {
    const f = fixture(), probe = createEngineProbe(f.monitor);
    const wrapped = probe.wrapHost(f.host), engine = f.engineFor(wrapped);
    f.monitor.tick();
    wrapped.renderSharedFrame({ commands: [] });
    probe.renderSharedFrame(engine, { width: 8 });
    f.frame();
    assert.deepEqual(sections(f.monitor), { submit: 6, capture: 2 });
});

test('a host without a frame port is refused', () => {
    assert.throws(() => createEngineProbe(createPerformanceMonitor()).wrapHost({}), TypeError);
});

test('with the inert monitor the probe adds nothing', () => {
    const f = fixture(), probe = createEngineProbe(inertPerformanceMonitor());
    assert.equal(probe.wrapHost(f.host), f.host);
    const engine = f.engineFor(f.host);
    assert.equal(probe.renderSharedFrame(engine, { width: 8 }).frameId, 1);
    assert.deepEqual(probe.advanceTime(engine, 1), { deltaSeconds: 1 });
});

test('handles are alive until their state ends or their scope closes', () => {
    const tracker = createHandleTracker({ now: () => 0 });
    const scope = { state: 'open' }, tween = { state: 'running' }, ticket = { commit() {} };
    tracker.track('scopes', scope);
    assert.equal(tracker.track('tweens', tween, scope), tween);
    tracker.track('tickets', ticket, scope);
    assert.deepEqual(tracker.counts(), {
        scopes: { created: 1, live: 1, growing: false }, tweens: { created: 1, live: 1, growing: false }, tickets: { created: 1, live: 1, growing: false },
    });
    tween.state = 'completed';
    assert.equal(tracker.counts().tweens.live, 0);
    assert.equal(tracker.counts().tickets.live, 1);
    scope.state = 'closed';
    const counts = tracker.counts();
    assert.equal(counts.scopes.live, 0);
    assert.equal(counts.tickets.live, 0);
    assert.equal(counts.tickets.created, 1);
});

test('the engine facade forwards to the engine and counts by kind', () => {
    const calls = [];
    const engine = {
        marker: 1,
        createScope() { calls.push(['createScope', this]); return { state: 'open' }; },
        createTween(scope, options) { calls.push(['createTween', this, options]); return { state: 'idle' }; },
        createAssetGroup(scope) { return { state: 'pending' }; },
        createManifestGroup(scope) { return { state: 'ready' }; },
        captureBitmapBindings(scope) { return { commit() {}, dispose() {} }; },
        renderSharedFrame() { throw new Error('not part of the facade'); },
    };
    const tracker = createHandleTracker({ now: () => 0 }), tracked = tracker.engine(engine);
    assert.deepEqual(Object.keys(tracked).sort(), ['captureBitmapBindings', 'createAssetGroup', 'createManifestGroup', 'createScope', 'createTween']);
    const scope = tracked.createScope();
    tracked.createTween(scope, { duration: 1 }); tracked.createTween(scope, { duration: 2 });
    tracked.createAssetGroup(scope); tracked.createManifestGroup(scope); tracked.captureBitmapBindings(scope);
    assert.equal(calls[0][1], engine);
    assert.deepEqual(calls[1][2], { duration: 1 });
    const counts = tracker.counts();
    assert.equal(counts.scopes.live, 1); assert.equal(counts.tweens.live, 2); assert.equal(counts.assetGroups.live, 2); assert.equal(counts.bitmapTickets.live, 1);
    scope.state = 'closing';
    assert.equal(tracker.counts().tweens.live, 2);
    scope.state = 'closed';
    assert.equal(tracker.counts().tweens.live, 0);
    assert.deepEqual(tracker.source()(), { scopes: 0, tweens: 0, assetGroups: 0, bitmapTickets: 0 });
});

test('a count that only rises over the window is marked as growing', () => {
    let time = 0;
    const tracker = createHandleTracker({ now: () => time, growthSeconds: 5, growthMinimum: 8 });
    const kept = [];
    const step = (added) => { for (let i = 0; i < added; i++) { const handle = { state: 'running' }; kept.push(handle); tracker.track('tweens', handle); } time += 1000; return tracker.counts().tweens; };
    for (let i = 0; i < 4; i++) assert.equal(step(3).growing, false);
    assert.equal(step(3).growing, true);
    assert.equal(tracker.source()().tweens, '15 ↑');
    // One release ends the streak, and steady counts are not growth.
    kept[0].state = 'stopped';
    assert.equal(step(0).growing, false);
    for (let i = 0; i < 6; i++) step(0);
    assert.equal(tracker.counts().tweens.growing, false);
});

test('reading counts more often than once a second does not shorten the window', () => {
    let time = 0;
    const tracker = createHandleTracker({ now: () => time, growthSeconds: 3, growthMinimum: 1 });
    const kept = [];
    for (let i = 0; i < 10; i++) { const handle = { state: 'open' }; kept.push(handle); tracker.track('scopes', handle); time += 100; assert.equal(tracker.counts().scopes.growing, false); }
});

test('invalid tracker options and handles are refused or ignored', () => {
    assert.throws(() => createHandleTracker({ growthSeconds: 1 }), RangeError);
    assert.throws(() => createHandleTracker({ growthMinimum: 0 }), RangeError);
    const tracker = createHandleTracker();
    assert.equal(tracker.track('x', null), null);
    assert.equal(tracker.track('', {}).constructor, Object);
    assert.deepEqual(tracker.counts(), {});
});

test('WebGL2 host timing is read as mean and longest per phase', () => {
    const host = { getSharedFrameTiming: () => ({ totals: { submit: { count: 4, totalMs: 2, maxMs: 0.9 }, retire: { count: 0, totalMs: 0, maxMs: 0 } }, recent: [], dropped: 2 }) };
    assert.deepEqual(sharedWebGL2TimingSource(host)(), { submit: '0.50 / 0.90', dropped: 2 });
    assert.deepEqual(sharedWebGL2TimingSource({ getSharedFrameTiming: () => null })(), { measureSharedFrames: false });
});

test('a World3D frame becomes a section and gauges; GPU time waits for every pass', () => {
    let time = 0;
    const monitor = createPerformanceMonitor({ now: () => time });
    monitor.tick();
    recordWorld3DFrame(monitor, { drawCalls: 12, triangles: 900, cpuSubmissionMs: 1.5, passes: [{ gpuTime: { status: 'ready', milliseconds: 0.4 } }, { gpuTime: { status: 'pending' } }] });
    time += 16; monitor.tick();
    assert.deepEqual(sections(monitor), { world3d: 1.5 });
    assert.deepEqual(monitor.snapshot().gauges, { 'world3d draw calls': 12, 'world3d triangles': 900, 'world3d passes': 2 });
    recordWorld3DFrame(monitor, { drawCalls: 1, triangles: 2, cpuSubmissionMs: 1, passes: [{ gpuTime: { status: 'ready', milliseconds: 0.4 } }, { gpuTime: { status: 'ready', milliseconds: 0.25 } }] });
    assert.equal(monitor.snapshot().gauges['world3d gpu ms'], 0.65);
});
