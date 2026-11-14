// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeSharedFrame, createEngineProbe, createPerformanceMonitor, evaluateHints, frameLoopSource, inertPerformanceMonitor } from '@egret/devtools';

// The engine's own loop, when the engine has been built; the stand-in below follows the same contract.
const built = await import('../../packages/engine/dist/web/loop.js').catch(() => null);

/** The order of work in one step of createBrowserFrameLoop: clock, update, then a frame unless the host is busy. */
function standInLoop(options) {
    const { engine, frame, host, update, requestFrame } = options;
    let steps = 0, frames = 0, skipped = 0, seconds = 0, last, state = 'idle';
    const tick = (milliseconds) => {
        if (state !== 'running') return;
        const delta = last === undefined ? 0 : (milliseconds - last) / 1000;
        last = milliseconds; seconds += delta;
        engine.advanceTime(seconds); steps++;
        update?.(delta);
        if (host !== undefined && host.getStatus().pendingFrames >= 2) skipped++;
        else { engine.renderSharedFrame(frame); frames++; }
        requestFrame(tick);
    };
    return { start() { state = 'running'; requestFrame(tick); }, snapshot: () => ({ state, steps, frames, skipped, seconds, failure: undefined }) };
}

/** A monitor, a host, an engine and a display, all on one hand-driven clock. */
function fixture() {
    let time = 0, pending = 0;
    const monitor = createPerformanceMonitor({ now: () => time });
    const queue = [];
    const host = { getStatus: () => ({ pendingFrames: pending }), renderSharedFrame() { time += 3; return undefined; } };
    const probe = createEngineProbe(monitor);
    const wrapped = probe.wrapHost(host);
    const engine = {
        clock: { maxDeltaSeconds: 1 }, frameId: 0,
        advanceTime(seconds) { time += 1; return seconds; },
        renderSharedFrame(options) {
            time += 2;
            const frame = { frameId: ++this.frameId, width: options.width, height: options.height, commands: [{ kind: 'rect', materialIndex: 0 }], pages: [], regions: [], materials: [], geometries: [] };
            wrapped.renderSharedFrame(frame);
            return frame;
        },
    };
    return {
        monitor, probe, engine, host, queue,
        setPending(value) { pending = value; },
        advance(ms) { time += ms; },
        requestFrame(callback) { queue.push(callback); return queue.length; },
        /** One frame of the display, sixteen milliseconds after the one before. */
        display(at) { const callback = queue.shift(); monitor.tick(at); callback(at); },
    };
}

for (const [name, create] of [['the stand-in loop', standInLoop], ...(built ? [['the engine\'s loop', built.createBrowserFrameLoop]] : [])]) {
    test(`${name}: each step is one frame of work, split into clock, update, capture and submit`, () => {
        const f = fixture();
        const loop = create(f.probe.frameLoop({
            engine: f.engine, host: f.host, frame: { width: 8, height: 4 }, requestFrame: f.requestFrame, cancelFrame() {},
            update() { f.advance(5); },
        }));
        loop.start();
        for (let i = 0; i < 4; i++) { f.display(i * 16); f.advance(5); }
        const snapshot = f.monitor.snapshot();
        const mean = Object.fromEntries(snapshot.sections.map((entry) => [entry.name, entry.meanMs]));
        assert.deepEqual(mean, { clock: 1, update: 5, submit: 3, capture: 2 });
        assert.equal(snapshot.work.meanMs, 11);
        assert.equal(snapshot.frame.frameId, 4);
        assert.equal(snapshot.frame.width, 8);
        assert.equal(loop.snapshot().frames, 4);
    });

    test(`${name}: a skipped step is still a frame of work, and the loop source counts it`, () => {
        const f = fixture();
        let now = 0;
        const loop = create(f.probe.frameLoop({ engine: f.engine, host: f.host, frame: { width: 1, height: 1 }, requestFrame: f.requestFrame, cancelFrame() {} }));
        const source = frameLoopSource(loop, { now: () => now });
        loop.start();
        assert.equal(source().state, 'running');
        for (let i = 0; i < 10; i++) { f.setPending(i % 2 === 0 ? 2 : 0); f.display(i * 16); }
        now = 1000;
        const values = source();
        assert.deepEqual({ steps: values.steps, frames: values.frames, skipped: values.skipped, skippedShare: values.skippedShare }, { steps: 10, frames: 5, skipped: 5, skippedShare: 0.5 });
        f.monitor.tick(160); // work is settled at the next frame of the display
        assert.equal(f.monitor.snapshot().work.meanMs, 3.5);
    });
}

test('frameLoop keeps the other options, passes the clock through and leaves the inert monitor alone', () => {
    const f = fixture();
    const options = { engine: f.engine, host: f.host, frame: 7, maxPendingFrames: 3, requestFrame: f.requestFrame, cancelFrame() {} };
    const measured = f.probe.frameLoop(options);
    assert.equal(measured.host, f.host);
    assert.equal(measured.frame, 7);
    assert.equal(measured.maxPendingFrames, 3);
    assert.equal(measured.cancelFrame, options.cancelFrame);
    assert.equal(measured.engine.clock, f.engine.clock);
    assert.equal('update' in measured, false);
    assert.equal(createEngineProbe(inertPerformanceMonitor()).frameLoop(options), options);
});

test('a failing step still ends its frame of work', () => {
    const f = fixture();
    const measured = f.probe.frameLoop({ engine: f.engine, requestFrame: f.requestFrame, update() { f.advance(4); throw new Error('boom'); } });
    measured.requestFrame(() => measured.update(0));
    f.monitor.tick(0);
    assert.throws(() => f.queue.shift()(0), /boom/);
    f.monitor.tick(16);
    assert.equal(f.monitor.snapshot().work.lastMs, 4);
});

test('without a display callback frameLoop asks for one', () => {
    const f = fixture();
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
    try {
        delete globalThis.requestAnimationFrame;
        assert.throws(() => f.probe.frameLoop({ engine: f.engine }), /requestFrame/);
    } finally { if (saved) Object.defineProperty(globalThis, 'requestAnimationFrame', saved); }
});

test('the loop source reports a failure by its code and starts again with a new loop', () => {
    let now = 0, read = { state: 'failed', steps: 9, frames: 4, skipped: 5, seconds: 1.234, failure: Object.assign(new Error('refused'), { code: 'HOST_BACKPRESSURE' }) };
    const source = frameLoopSource({ snapshot: () => read }, { now: () => now });
    assert.deepEqual(source(), { state: 'failed', steps: 9, frames: 4, skipped: 5, skippedShare: 0, seconds: 1.2, failure: 'HOST_BACKPRESSURE' });
    read = { state: 'running', steps: 2, frames: 2, skipped: 0, seconds: 0, failure: new Error('plain') };
    now = 5000;
    assert.equal(source().skippedShare, 0);
    assert.equal(source().failure, 'plain');
    assert.equal(frameLoopSource({ snapshot: () => ({}) })().state, 'unknown');
});

test('hints name a stopped loop, skipped frames and frame pages near their limit', () => {
    const base = { frames: 1000, fps: 60, budgetMs: 10, interval: null, work: null, dropped: 0, hitches: 0, pauses: 0, sections: [], counters: [], gauges: {}, frame: null, overheadMs: 0 };
    assert.deepEqual(evaluateHints({ ...base, sources: { loop: { state: 'failed', failure: 'HOST_BACKPRESSURE', skippedShare: 0.9 } } }), [{ id: 'loop-failed', severity: 'problem', subject: 'HOST_BACKPRESSURE' }]);
    assert.deepEqual(evaluateHints({ ...base, sources: { loop: { state: 'running', skippedShare: 0.25 } } }), [{ id: 'frames-skipped', severity: 'warning', value: 25, limit: 10 }]);
    assert.deepEqual(evaluateHints({ ...base, sources: { loop: { state: 'running', skippedShare: 0.09 } } }), []);
    const stats = (pageBytes) => ({ ...analyzeSharedFrame({ frameId: 1, width: 1, height: 1, commands: [], pages: [], regions: [], materials: [], geometries: [] }), pageBytes });
    assert.deepEqual(evaluateHints({ ...base, sources: {}, frame: stats(60 * 1048576) }), [{ id: 'pages-near-limit', severity: 'warning', value: 60 * 1048576, limit: 67108864 }]);
    assert.equal(evaluateHints({ ...base, sources: {}, frame: stats(67108864) })[0].severity, 'problem');
    assert.deepEqual(evaluateHints({ ...base, sources: {}, frame: stats(900) }, { pageByteLimit: 1000 }).map((hint) => hint.id), ['pages-near-limit']);
});

test('effect groups are counted by what they ask for, and draws by how they blend', () => {
    const enter = (effect) => ({ kind: 'barrier', reason: 'effect-enter', effect }), exit = { kind: 'barrier', reason: 'effect-exit' };
    const draw = (materialIndex) => ({ kind: 'rect', materialIndex, clips: [] });
    const stats = analyzeSharedFrame({
        frameId: 1, width: 1, height: 1, pages: [], regions: [], geometries: [],
        materials: [{ blend: 'normal' }, { blend: 'add-accumulate' }, { blend: 'erase' }],
        commands: [
            enter({ blurRadius: 4, maskPageIndex: undefined }), draw(0), exit,
            enter({ blurRadius: 0, colorMatrix: new Array(20).fill(0), glow: { kind: 'glow' }, maskPageIndex: undefined }), draw(1), exit,
            enter({ blurRadius: 2, glow: { kind: 'outline' }, maskPageIndex: 0 }), draw(2), draw(2), exit,
            { kind: 'barrier', reason: 'effect-enter' },
        ],
    });
    assert.equal(stats.effects, 4);
    assert.deepEqual(stats.effectKinds, { blur: 2, colorMatrix: 1, glow: 1, outline: 1, mask: 1 });
    assert.equal(stats.blendedDraws, 3);
    assert.ok(Object.isFrozen(stats.effectKinds));
});
