// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { createUiRoot } from '@egret/engine/ui';
import { createPointerInput } from '@egret/engine/input';
import { host, deferred } from './helpers.mjs';
async function setup(bind, extra = {}) {
    const h = host(), engine = await egret.createEngine({ host: h.adapter }), scope = engine.createScope(), unbound = [];
    const source = { revision: 0, records: Array.from({ length: 20 }, (_, i) => ({ key: 'k' + i, contentVersion: 0, estimatedHeight: 20, value: i })), bind: bind ?? (c => ({ content: c.scope.use(new egret.DisplayObjectContainer()), measuredHeight: 20 })), unbind(info) { unbound.push(info); } };
    const root = createUiRoot({ engine, scope, id: 'panel', viewport: { width: 100, height: 60 }, density: 1, tree: { id: 'list', kind: 'virtualList', source, explicitWidth: 100, explicitHeight: 60 }, limits: { overscan: 0, residentCap: 8 }, ...extra });
    return { engine, scope, root, source, unbound };
}
test('UI owner publishes one immutable complete revision and reuses unchanged bindings', async () => {
    const f = await setup();
    try {
        assert.equal(f.root.snapshot().committedRevision, 0);
        const token = await f.root.prepare();
        assert.equal(token.status, 'ready');
        assert.ok(Object.isFrozen(token));
        assert.equal(f.root.snapshot().rows.length, 0);
        assert.equal(f.root.commit(token).kind, 'committed');
        const saved = f.root.snapshot();
        assert.deepEqual(saved.rows.map(r => r.key), ['k0', 'k1', 'k2']);
        assert.equal((await f.root.prepare()).status, 'unchanged');
        f.root.list('list').setScrollOffset(40);
        f.root.commit(await f.root.prepare());
        assert.deepEqual(saved.rows.map(r => r.key), ['k0', 'k1', 'k2']);
        assert.deepEqual(f.root.snapshot().rows.map(r => r.key), ['k2', 'k3', 'k4']);
        assert.equal(f.unbound.length, 2);
        f.root.dispose();
        assert.equal(f.unbound.length, 5);
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI supersession promptly rejects public preparation while ignored bind remains bounded', async () => {
    const gate = deferred();
    let entered = 0;
    const f = await setup(async (c) => { entered++; await gate.promise; return { content: c.scope.use(new egret.DisplayObjectContainer()), measuredHeight: 20 }; });
    try {
        const result = f.root.prepare().catch(e => e);
        await Promise.resolve();
        f.root.list('list').setScrollOffset(80);
        assert.equal((await result).code, 'UI_STALE');
        assert.equal(f.root.snapshot().committedRevision, 0);
        assert.ok(entered > 0);
        f.root.dispose();
        gate.resolve();
        await Promise.resolve();
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI captured adapter receiver and exactly-once unbind survive source method replacement', async () => {
    const f = await setup();
    try {
        f.root.commit(await f.root.prepare());
        const old = f.source.unbind;
        f.source.unbind = () => assert.fail('new unbind must not retire old binding');
        f.root.list('list').setSource({ ...f.source, revision: 1, records: f.source.records.map(r => ({ ...r, contentVersion: 1 })), unbind: old });
        f.root.commit(await f.root.prepare());
        assert.equal(f.unbound.length, 3);
        f.root.dispose();
        assert.equal(f.unbound.length, 6);
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI same revision mutation refuses and retained replacement refuses before desired mutation', async () => {
    const f = await setup();
    try {
        f.root.commit(await f.root.prepare());
        const handle = f.root.list('list'), retained = handle.retain('k1', 'focus'), before = f.root.snapshot();
        assert.throws(() => handle.setSource({ ...f.source, revision: 1, records: f.source.records.filter(r => r.key !== 'k1') }), e => e.code === 'UI_ROW_RETAINED');
        assert.equal(f.root.snapshot().desiredRevision, before.desiredRevision);
        f.source.records[0] = { ...f.source.records[0], value: 99 };
        assert.throws(() => handle.setSource(f.source), e => e.code === 'UI_SOURCE_REVISION');
        retained.release();
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI retained offscreen row hides and then returns with original generation', async () => {
    const f = await setup();
    try {
        f.root.commit(await f.root.prepare());
        const handle = f.root.list('list'), saved = f.root.snapshot().rows[0], retained = handle.retain('k0', 'focus');
        handle.setScrollOffset(100);
        f.root.commit(await f.root.prepare());
        assert.equal(f.root.snapshot().rows.find(r => r.key === 'k0').visible, false);
        handle.setScrollOffset(0);
        f.root.commit(await f.root.prepare());
        assert.equal(f.root.snapshot().rows.find(r => r.key === 'k0').bindingGeneration, saved.bindingGeneration);
        retained.release();
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI binds one bounded expansion per explicit prepare and refuses pending commit', async () => {
    const f = await setup(c => ({ content: c.scope.use(new egret.DisplayObjectContainer()), measuredHeight: 10 }));
    try {
        const first = await f.root.prepare();
        assert.equal(first.status, 'pending');
        assert.throws(() => f.root.commit(first), e => e.code === 'UI_NOT_READY');
        assert.equal(f.root.snapshot().committedRevision, 0);
        const second = await f.root.prepare();
        assert.equal(second.status, 'pending');
        const third = await f.root.prepare();
        assert.equal(third.status, 'ready');
        f.root.commit(third);
        assert.equal(f.root.snapshot().rows.length, 6);
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI height updates preserve an independent top-key anchor without rebinding', async () => {
    const f = await setup();
    try {
        const handle = f.root.list('list');
        handle.setScrollOffset(83);
        f.root.commit(await f.root.prepare());
        const before = f.root.snapshot();
        handle.updateHeights([{ key: 'k0', height: 50, contentVersion: 0 }]);
        f.root.commit(await f.root.prepare());
        const after = f.root.snapshot();
        assert.equal(after.scrollOffset, 113);
        assert.deepEqual(after.anchor, { key: 'k4', offset: 3 });
        assert.equal(after.counters.bindTotal, before.counters.bindTotal);
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI failed binding leaves old revision and unbinds each entered failing invocation', async () => {
    let fail = false;
    const sentinel = { failure: true };
    const f = await setup(c => {
        if (fail)
            throw sentinel;
        return { content: c.scope.use(new egret.DisplayObjectContainer()), measuredHeight: 20 };
    });
    try {
        f.root.commit(await f.root.prepare());
        const saved = f.root.snapshot();
        fail = true;
        f.root.list('list').setScrollOffset(160);
        await assert.rejects(f.root.prepare(), e => e.code === 'UI_PREPARE_FAILED' && e.cause === sentinel);
        assert.equal(f.root.snapshot().committedRevision, saved.committedRevision);
        assert.deepEqual(f.root.snapshot().rows, saved.rows);
        assert.equal(f.unbound.length, 3);
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI externally retained obsolete ready tokens cannot publish disposed staging', async () => {
    const f = await setup();
    try {
        const first = await f.root.prepare(), second = await f.root.prepare();
        assert.equal(f.root.commit(first).kind, 'stale');
        assert.equal(f.root.commit(second).kind, 'committed');
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI root scope cancellation is terminal and leaves independent root usable', async () => {
    const f = await setup();
    const scope = f.engine.createScope();
    const other = createUiRoot({ engine: f.engine, scope, id: 'other', viewport: { width: 20, height: 20 }, density: 1, tree: { id: 'leaf', kind: 'leaf', explicitWidth: 20, explicitHeight: 20, fill: { color: 16711680 } } });
    try {
        f.root.commit(await f.root.prepare());
        other.commit(await other.prepare());
        f.scope.dispose();
        assert.equal(f.root.state, 'closed');
        other.setOrigin({ x: 30, y: 10 });
        assert.equal(other.commit(await other.prepare()).kind, 'committed');
        assert.equal(f.unbound.length, 3);
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI captured contact retires once before any new key receives interaction', async () => {
    const notifications = [], routed = [];
    let input;
    const f = await setup(undefined, { onRowPointer: n => {
            routed.push(n);
            if (n.kind === 'begin')
                assert.equal(input.capture(n.event.payload.session, n.target), true);
        } });
    try {
        input = createPointerInput({ engine: f.engine, scope: f.engine.createScope(), width: 100, height: 100, onContact: n => notifications.push(n) });
        f.root.setInput(input);
        f.root.commit(await f.root.prepare());
        const sample = { pointerId: 1, pointerType: 'mouse', globalX: 10, globalY: 10, buttons: 1, timestamp: 0 };
        const session = input.begin(sample), target = routed[0].target, version = input.viewportRevision;
        f.root.list('list').setScrollOffset(100);
        f.root.commit(await f.root.prepare());
        assert.equal(input.contacts.length, 0);
        assert.equal(input.viewportRevision, version);
        assert.equal(notifications.at(-1).reason, 'owner');
        assert.equal(input.move(session, { globalX: 10, globalY: 10, buttons: 1, timestamp: 1 }), false);
        input.begin({ ...sample, pointerId: 2 });
        assert.equal(routed.at(-1).key, 'k5');
        assert.notEqual(routed.at(-1).target, target);
        assert.throws(() => { routed.at(-1).target.x = 4; }, e => e.code === 'UI_MANAGED_GEOMETRY');
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI post-publication observer failure preserves complete geometry and finishes old unbind', async () => {
    const sentinel = Error('observer failure');
    let armed = false;
    const f = await setup();
    try {
        const input = createPointerInput({ engine: f.engine, scope: f.engine.createScope(), width: 100, height: 100, onContact: n => {
                if (armed && n.kind === 'cancel')
                    throw sentinel;
            } });
        f.root.setInput(input);
        f.root.commit(await f.root.prepare());
        input.begin({ pointerId: 1, pointerType: 'mouse', globalX: 10, globalY: 10, buttons: 1, timestamp: 0 });
        armed = true;
        f.root.list('list').setScrollOffset(100);
        const result = f.root.commit(await f.root.prepare());
        assert.equal(result.kind, 'committed');
        assert.ok(result.postCommitErrors.length >= 1);
        assert.equal(input.state, 'closed');
        assert.deepEqual(f.root.snapshot().rows.map(r => r.key), ['k5', 'k6', 'k7']);
        assert.equal(f.unbound.length, 3);
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI cancellation-ignoring promises retain the pending cap across repeated intents', async () => {
    const gate = deferred();
    let calls = 0;
    const f = await setup(async (c) => { calls++; await gate.promise; return { content: c.scope.use(new egret.DisplayObjectContainer()), measuredHeight: 20 }; });
    try {
        for (const offset of [20, 40]) {
            const promise = f.root.prepare().catch(e => e);
            await Promise.resolve();
            f.root.list('list').setScrollOffset(offset);
            assert.equal((await promise).code, 'UI_STALE');
        }
        await assert.rejects(f.root.prepare(), e => e.code === 'UI_PENDING_LIMIT');
        assert.equal(calls, 8);
        await assert.rejects(f.root.prepare(), e => e.code === 'UI_PENDING_LIMIT');
        assert.equal(calls, 8);
        assert.equal(f.root.snapshot().counters.unsettledBindCalls, 8);
        assert.equal(f.root.snapshot().committedRevision, 0);
        f.root.dispose();
        assert.equal(f.unbound.length, 8);
        gate.resolve();
        await new Promise(r => setImmediate(r));
        assert.equal(f.root.snapshot().counters.unsettledBindCalls, 0);
    }
    finally {
        gate.resolve();
        await f.engine.dispose();
    }
});
test('UI stale successful delayed completion cannot replace a newer same-key generation', async () => {
    const gate = deferred();
    let delay = false;
    const f = await setup(async (c) => {
        const content = c.scope.use(new egret.DisplayObjectContainer());
        if (delay)
            await gate.promise;
        return { content, measuredHeight: 20 };
    });
    try {
        f.root.commit(await f.root.prepare());
        const first = f.root.snapshot().rows[0].bindingGeneration;
        delay = true;
        f.root.list('list').setSource({ ...f.source, revision: 1, records: f.source.records.map(r => ({ ...r, contentVersion: 1 })) });
        const pending = f.root.prepare().catch(e => e);
        await Promise.resolve();
        delay = false;
        f.root.list('list').setSource({ ...f.source, revision: 2, records: f.source.records.map(r => ({ ...r, contentVersion: 2 })) });
        assert.equal((await pending).code, 'UI_STALE');
        f.root.commit(await f.root.prepare());
        const saved = f.root.snapshot();
        assert.ok(saved.rows[0].bindingGeneration > first);
        gate.resolve();
        await new Promise(r => setImmediate(r));
        assert.deepEqual(f.root.snapshot().rows, saved.rows);
    }
    finally {
        gate.resolve();
        await f.engine.dispose();
    }
});
test('UI source reorders stable anchor and deleted anchor uses old-order successor', async () => {
    const f = await setup();
    try {
        const h = f.root.list('list');
        h.setScrollOffset(83);
        f.root.commit(await f.root.prepare());
        const reordered = [...f.source.records.slice(10), ...f.source.records.slice(0, 10)];
        h.setSource({ ...f.source, revision: 1, records: reordered });
        f.root.commit(await f.root.prepare());
        assert.deepEqual(f.root.snapshot().anchor, { key: 'k4', offset: 3 });
        assert.equal(f.root.snapshot().scrollOffset, 283);
        h.setSource({ ...f.source, revision: 2, records: reordered.filter(r => r.key !== 'k4') });
        f.root.commit(await f.root.prepare());
        assert.deepEqual(f.root.snapshot().anchor, { key: 'k5', offset: 0 });
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI 100 scroll publications keep shells bounded with immutable retained snapshots', async () => {
    const f = await setup();
    try {
        f.root.commit(await f.root.prepare());
        const first = f.root.snapshot();
        for (let i = 0; i < 100; i++) {
            f.root.list('list').setScrollOffset((i % 18) * 20);
            const token = await f.root.prepare();
            f.root.commit(token);
            const s = f.root.snapshot();
            assert.ok(s.counters.liveShells <= 8);
            assert.ok(s.counters.activeBindings <= 3);
            assert.equal(s.counters.stagedBindings, 0);
            assert.equal(s.counters.unsettledBindCalls, 0);
        }
        assert.deepEqual(first.rows.map(r => r.key), ['k0', 'k1', 'k2']);
        f.root.dispose();
        assert.equal(f.root.snapshot().counters.bindTotal, f.root.snapshot().counters.unbindTotal);
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI 50000 logical records match independent linear far-edge geometry without realizing every record', async () => {
    const f = await setup(c => ({ content: c.scope.use(new egret.DisplayObjectContainer()), measuredHeight: typeof c.value === 'object' ? c.value.height : 20 }));
    try {
        const records = Array.from({ length: 50000 }, (_, i) => ({ key: 'r' + i, contentVersion: 0, estimatedHeight: [20, 30, 40][i % 3], value: { height: [20, 30, 40][i % 3] } }));
        const total = records.reduce((s, r) => s + r.estimatedHeight, 0), offset = total - 60;
        let top = 0;
        const expected = [];
        for (const r of records) {
            if (top + r.estimatedHeight > offset && top < total)
                expected.push({ key: r.key, y: top - offset, height: r.estimatedHeight });
            top += r.estimatedHeight;
        }
        f.root.list('list').setSource({ ...f.source, revision: 1, records });
        f.root.list('list').setScrollOffset(Number.MAX_VALUE);
        f.root.commit(await f.root.prepare());
        const s = f.root.snapshot();
        assert.equal(s.scrollOffset, offset);
        assert.deepEqual(s.rows.map(r => ({ key: r.key, y: r.box.y, height: r.box.height })), expected);
        assert.equal(s.counters.recordCount, 50000);
        assert.ok(s.counters.bindTotal <= 8);
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI retention acquired after prepare invalidates a candidate that would recycle its row', async () => {
    const f = await setup();
    try {
        f.root.commit(await f.root.prepare());
        f.root.list('list').setScrollOffset(100);
        const token = await f.root.prepare();
        const retention = f.root.list('list').retain('k0', 'focus');
        assert.equal(f.root.commit(token).kind, 'stale');
        f.root.commit(await f.root.prepare());
        assert.equal(f.root.snapshot().rows.find(r => r.key === 'k0').visible, false);
        retention.release();
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI prepare failure preserves primary cause and every directly observed unbind failure', async () => {
    const primary = Error('bind primary'), secondary = Error('unbind secondary');
    const f = await setup(() => { throw primary; });
    try {
        f.root.list('list').setSource({ ...f.source, revision: 1, unbind() { throw secondary; } });
        await assert.rejects(f.root.prepare(), error => error.code === 'UI_PREPARE_FAILED' && error.cause === primary && error.cleanupErrors.length === 3 && error.cleanupErrors.every(cause => cause === secondary));
        assert.equal(f.root.snapshot().committedRevision, 0);
        assert.equal(f.root.snapshot().counters.bindTotal, f.root.snapshot().counters.unbindTotal);
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI source captures a hostile array length once before reading entries', async () => {
    const f = await setup();
    try {
        f.root.commit(await f.root.prepare());
        let lengths = 0, entries = 0;
        const records = new Proxy([], { get(target, key, receiver) { if (key === 'length')
                return ++lengths === 1 ? 1 : 50001; if (key === '0') {
                entries++;
                return { key: 'one', contentVersion: 0, estimatedHeight: 20, value: 1 };
            } return Reflect.get(target, key, receiver); } });
        f.root.list('list').setSource({ ...f.source, revision: 1, records });
        assert.equal(lengths, 1);
        assert.equal(entries, 1);
        f.root.commit(await f.root.prepare());
        assert.equal(f.root.snapshot().counters.recordCount, 1);
        assert.deepEqual(f.root.snapshot().rows.map(row => row.key), ['one']);
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI invalid captured source counts refuse before entries or desired revision changes', async () => {
    const f = await setup();
    try {
        f.root.commit(await f.root.prepare());
        for (const count of [-1, 0.5, NaN, Infinity, 50001, '1']) {
            let lengths = 0, entries = 0;
            const records = new Proxy([], { get(target, key, receiver) { if (key === 'length') {
                    lengths++;
                    return count;
                } if (typeof key === 'string' && /^\d+$/.test(key))
                    entries++; return Reflect.get(target, key, receiver); } });
            const before = f.root.snapshot();
            assert.throws(() => f.root.list('list').setSource({ ...f.source, revision: 1, records }), error => error.code === 'UI_SOURCE_INVALID');
            assert.equal(lengths, 1);
            assert.equal(entries, 0);
            assert.equal(f.root.snapshot().desiredRevision, before.desiredRevision);
            assert.deepEqual(f.root.snapshot().rows, before.rows);
        }
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI ready supersession reports every direct unbind error while retaining the committed image', async () => {
    const failures = [Error('first unbind'), Error('second unbind'), Error('third unbind')];
    let unbinds = 0;
    const f = await setup();
    try {
        f.root.commit(await f.root.prepare());
        const before = f.root.snapshot();
        f.root.list('list').setSource({ ...f.source, revision: 1, records: f.source.records.map(record => ({ ...record, contentVersion: 1 })), unbind() { throw failures[unbinds++]; } });
        const ready = await f.root.prepare();
        assert.throws(() => f.root.list('list').setSource({ ...f.source, revision: 2 }), error => error.code === 'UI_CLEANUP_FAILED' && error.cause === failures[0] && error.cleanupErrors.length === 2 && error.cleanupErrors.every((cause, index) => cause === failures[index + 1]));
        assert.equal(unbinds, 3);
        assert.equal(f.root.snapshot().committedRevision, before.committedRevision);
        assert.deepEqual(f.root.snapshot().rows, before.rows);
        assert.equal(f.root.commit(ready).kind, 'stale');
        assert.equal(f.root.commit(await f.root.prepare()).kind, 'committed');
        assert.equal(unbinds, 3);
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI pending cancellation reports ordered unbind errors to setter and public waiter', async () => {
    const gate = deferred(), failures = [Error('cancel first'), Error('cancel second'), Error('cancel third')];
    let unbinds = 0;
    const f = await setup();
    try {
        f.root.list('list').setSource({ ...f.source, revision: 1, bind: async (c) => { const content = c.scope.use(new egret.DisplayObjectContainer()); await gate.promise; return { content, measuredHeight: 20 }; }, unbind() { throw failures[unbinds++]; } });
        const pending = f.root.prepare().catch(error => error);
        await Promise.resolve();
        assert.throws(() => f.root.list('list').setSource({ ...f.source, revision: 2 }), error => error.code === 'UI_CLEANUP_FAILED' && error.cause === failures[0] && error.cleanupErrors.length === 2);
        const error = await pending;
        assert.equal(error.code, 'UI_STALE');
        assert.deepEqual(error.cleanupErrors, failures);
        assert.equal(f.root.snapshot().committedRevision, 0);
        gate.resolve();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(unbinds, 3);
        f.root.commit(await f.root.prepare());
    }
    finally {
        gate.resolve();
        await f.engine.dispose();
    }
});
test('UI supersession cleanup reentry preserves newer placement intent and attempts every unbind', async () => {
    const failures = [Error('first'), Error('second'), Error('third')];
    let unbinds = 0;
    const f = await setup();
    try {
        f.root.commit(await f.root.prepare());
        f.root.list('list').setSource({ ...f.source, revision: 1, records: f.source.records.map(record => ({ ...record, contentVersion: 1 })), unbind() { const index = unbinds++; if (index === 0)
                f.root.setOrigin({ x: 5, y: 0 }); throw failures[index]; } });
        const ready = await f.root.prepare();
        assert.throws(() => f.root.list('list').setSource({ ...f.source, revision: 2 }), error => error.code === 'UI_CLEANUP_FAILED' && error.cause === failures[0] && error.cleanupErrors.length === 2);
        assert.equal(unbinds, 3);
        assert.equal(f.root.snapshot().origin.x, 0);
        assert.equal(f.root.commit(ready).kind, 'stale');
        f.root.commit(await f.root.prepare());
        assert.equal(f.root.snapshot().origin.x, 5);
        f.root.dispose();
        assert.equal(unbinds, 3);
    }
    finally {
        await f.engine.dispose();
    }
});
test('UI canceled structural preparations settle independently without rewriting the newest 50000-record commit', async () => {
    const gate = deferred();
    let unbinds = 0;
    const f = await setup();
    try {
        const h = f.root.list('list');
        for (let revision = 1; revision <= 4; revision++) {
            const records = Array.from({ length: 50000 }, (_, index) => ({ key: 'r' + revision + '-' + index, contentVersion: 0, estimatedHeight: 60, value: index }));
            h.setSource({ ...f.source, revision, records, bind: async (context) => { const content = context.scope.use(new egret.DisplayObjectContainer()); await gate.promise; return { content, measuredHeight: 60 }; }, unbind() { unbinds++; } });
            const pending = f.root.prepare().catch(error => error);
            await Promise.resolve();
            f.root.setOrigin({ x: revision, y: 0 });
            assert.equal((await pending).code, 'UI_STALE');
            assert.equal(f.root.snapshot().counters.unsettledBindCalls, revision);
            assert.equal(f.root.snapshot().committedRevision, 0);
        }
        h.setSource({ ...f.source, revision: 5, records: Array.from({ length: 50000 }, (_, index) => ({ key: 'latest-' + index, contentVersion: 0, estimatedHeight: 60, value: index })), bind(context) { return { content: context.scope.use(new egret.DisplayObjectContainer()), measuredHeight: 60 }; } });
        f.root.commit(await f.root.prepare());
        const saved = f.root.snapshot();
        assert.equal(saved.counters.recordCount, 50000);
        assert.equal(saved.rows[0].key, 'latest-0');
        assert.equal(unbinds, 4);
        gate.resolve();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(f.root.snapshot().counters.unsettledBindCalls, 0);
        assert.deepEqual(f.root.snapshot().rows, saved.rows);
        assert.equal(unbinds, 4);
    }
    finally {
        gate.resolve();
        await f.engine.dispose();
    }
});
