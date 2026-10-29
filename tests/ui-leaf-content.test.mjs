// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, DisplayObjectContainer, Sprite } from '@egret/engine';
import { createUiRoot } from '@egret/engine/ui';
import { deferred, flush, host } from './helpers.mjs';

const frameOptions = { width: 160, height: 200 };
function content(context, height, color = 0xff0000) {
    const container = context.scope.use(new DisplayObjectContainer()), shape = context.scope.use(new Sprite());
    shape.graphics.beginFill(color).drawRect(0, 0, context.width, height).endFill();
    shape.hitArea = { x: 0, y: 0, width: context.width, height };
    shape.touchEnabled = true;
    container.addChild(shape);
    return { content: container, measuredHeight: height, shape };
}
function column(source) {
    return { id: 'column', kind: 'column', gap: 3, children: [
        { id: 'body', kind: 'leaf', padding: 2, content: source },
        { id: 'tail', kind: 'leaf', explicitWidth: 10, explicitHeight: 5, fill: { color: 0x0000ff } }
    ] };
}
function box(root, id) { return root.snapshot().boxes.find(value => value.id === id); }
async function commitReady(root) {
    for (let round = 0; round < 8; round++) {
        const token = await root.prepare();
        if (token.status !== 'pending') return root.commit(token);
    }
    assert.fail('The bounded fixture must reach a ready UI revision');
}

test('UI prepared leaves measure their wrapping width and publish rendering, geometry and hits together', async () => {
    const engine = await createEngine({ host: host().adapter }), contexts = [], results = [];
    const source = { revision: 0, prepare(context) {
        contexts.push(context);
        const result = content(context, Math.ceil(240 / context.width) * 10 + this.revision * 5, this.revision ? 0x00ff00 : 0xff0000);
        results.push(result);
        return result;
    } };
    const root = createUiRoot({ engine, scope: engine.createScope(), id: 'leaf-root', viewport: { width: 124, height: 200 }, density: 1, tree: column(source) });
    try {
        await commitReady(root);
        assert.equal(contexts[0].width, 120);
        assert.equal(box(root, 'body').height, 24);
        assert.equal(box(root, 'tail').y, 27);
        assert.equal(engine.stage.hitTest(3, 3), results[0].shape);
        assert.equal(engine.stage.hitTest(3, 29), undefined);
        const saved = engine.captureFrame(frameOptions), priorRevision = root.snapshot().committedRevision;
        root.setViewport({ width: 84, height: 200 }, 1);
        const next = await root.prepare();
        assert.equal(contexts[1].width, 80);
        assert.equal(contexts[0].scope.state, 'open');
        assert.equal(root.snapshot().committedRevision, priorRevision);
        assert.deepEqual(engine.captureFrame(frameOptions).commands, saved.commands);
        assert.equal(engine.stage.hitTest(3, 29), undefined);
        root.commit(next);
        assert.equal(box(root, 'body').height, 34);
        assert.equal(box(root, 'tail').y, 37);
        assert.equal(engine.stage.hitTest(3, 29), results[1].shape);
        assert.equal(contexts[0].scope.state, 'closed');
        assert.equal(results[0].content.isDisposed, true);
        root.setViewport({ width: 84, height: 200 }, 2);
        await commitReady(root);
        assert.equal(contexts[2].density, 2);
        assert.equal(contexts[1].scope.state, 'closed');
        assert.equal(box(root, 'body').height, 34);
        source.revision = 1;
        root.setTree(column(source));
        await commitReady(root);
        assert.equal(box(root, 'body').height, 39);
        assert.equal(box(root, 'tail').y, 42);
        assert.deepEqual(engine.captureFrame(frameOptions).commands.map(command => command.color), [0x00ff00, 0x0000ff]);
        const calls = contexts.length;
        root.setOrigin({ x: 5, y: 0 });
        await commitReady(root);
        assert.equal(contexts.length, calls);
        root.invalidate('body', 'paint');
        await commitReady(root);
        assert.equal(contexts.length, calls);
        root.invalidate('body', 'measure');
        await commitReady(root);
        assert.equal(contexts.length, calls + 1);
    } finally { await engine.dispose(); }
});

test('UI failed and superseded prepared leaves preserve the old render and retire detached scopes', async () => {
    const engine = await createEngine({ host: host().adapter }), contexts = [], results = [], failure = new Error('authored leaf failure');
    let mode = 'ready', gate;
    const source = { revision: 0, prepare(context) {
        contexts.push(context);
        const result = content(context, 20 + this.revision * 10);
        results.push(result);
        if (mode === 'fail') throw failure;
        return mode === 'wait' ? gate.promise.then(() => result) : result;
    } };
    const root = createUiRoot({ engine, scope: engine.createScope(), id: 'leaf-root', viewport: { width: 100, height: 200 }, density: 1, tree: column(source) });
    try {
        await commitReady(root);
        const saved = engine.captureFrame(frameOptions), previous = root.snapshot();
        mode = 'wait'; gate = deferred(); source.revision++;
        root.setTree(column(source));
        const canceled = root.prepare().catch(error => error);
        root.setOrigin({ x: 1, y: 0 });
        assert.equal((await canceled).code, 'UI_STALE');
        assert.equal(contexts[1].scope.state, 'closed');
        assert.equal(contexts[1].signal.aborted, true);
        assert.equal(results[1].content.isDisposed, true);
        assert.deepEqual(engine.captureFrame(frameOptions).commands, saved.commands);
        gate.resolve(); await flush();
        assert.equal(root.snapshot().committedRevision, previous.committedRevision);
        assert.equal(engine.stage.hitTest(3, 3), results[0].shape);
        mode = 'fail'; source.revision++;
        root.setTree(column(source));
        await assert.rejects(root.prepare(), error => error.code === 'UI_PREPARE_FAILED' && error.cause === failure);
        assert.equal(contexts[2].scope.state, 'closed');
        assert.equal(results[2].content.isDisposed, true);
        assert.equal(contexts[0].scope.state, 'open');
        assert.deepEqual(root.snapshot().boxes, previous.boxes);
        assert.deepEqual(engine.captureFrame(frameOptions).commands, saved.commands);
        mode = 'wait'; gate = deferred(); source.revision++;
        root.setTree(column(source));
        const closing = root.prepare().catch(error => error);
        root.dispose();
        assert.equal((await closing).code, 'UI_CLOSED');
        assert.equal(contexts[3].scope.state, 'closed');
        assert.equal(contexts[0].scope.state, 'closed');
        assert.equal(results[0].content.isDisposed, true);
        gate.resolve(); await flush();
        assert.equal(engine.stage.hitTest(3, 3), undefined);
        assert.deepEqual(engine.captureFrame(frameOptions).commands, []);
    } finally { await engine.dispose(); }
});

test('UI content admission refuses a competing measure and foreign-scope display content', async () => {
    const engine = await createEngine({ host: host().adapter }), source = { revision: 0, prepare: context => content(context, 10) };
    try {
        const options = { engine, scope: engine.createScope(), id: 'leaf-root', viewport: { width: 100, height: 200 }, density: 1 };
        assert.throws(() => createUiRoot({ ...options, tree: { id: 'body', kind: 'leaf', content: source, measure: () => ({ width: 1, height: 1, dependencyRevision: 0 }) } }), error => error.code === 'UI_CONTENT_INVALID');
        const foreignScope = engine.createScope(), foreign = foreignScope.use(new DisplayObjectContainer());
        let staged;
        const root = createUiRoot({ ...options, tree: { id: 'body', kind: 'leaf', content: { revision: 0, prepare(context) { staged = context.scope; return { content: foreign, measuredHeight: 10 }; } } } });
        await assert.rejects(root.prepare(), error => error.code === 'UI_CONTENT_INVALID');
        assert.equal(staged.state, 'closed');
        assert.equal(foreignScope.state, 'open');
        assert.equal(foreign.isDisposed, false);
        root.dispose();
    } finally { await engine.dispose(); }
});

test('UI content height updates coexist with virtual-row height journals and preserve the top-key anchor', async () => {
    const engine = await createEngine({ host: host().adapter }), prepared = [];
    const header = { revision: 0, prepare(context) { prepared.push(context); return content(context, 20 + this.revision * 10); } };
    const source = { revision: 0, records: Array.from({ length: 20 }, (_, index) => ({ key: 'k' + index, contentVersion: 0, estimatedHeight: 20, value: index })),
        bind(context) { return { content: context.scope.use(new DisplayObjectContainer()), measuredHeight: 20 }; }, unbind() {} };
    const tree = () => ({ id: 'column', kind: 'column', children: [{ id: 'header', kind: 'leaf', content: header },
        { id: 'list', kind: 'virtualList', explicitWidth: 100, explicitHeight: 60, source }] });
    const root = createUiRoot({ engine, scope: engine.createScope(), id: 'list-root', viewport: { width: 100, height: 200 }, density: 1, tree: tree(), limits: { overscan: 0, residentCap: 8 } });
    try {
        root.list('list').setScrollOffset(83);
        await commitReady(root);
        const saved = root.snapshot();
        assert.deepEqual(saved.anchor, { key: 'k4', offset: 3 });
        header.revision++;
        root.setTree(tree());
        const token = await root.prepare();
        assert.equal(box(root, 'list').y, 20);
        root.commit(token);
        assert.equal(box(root, 'list').y, 30);
        assert.equal(root.snapshot().scrollOffset, 83);
        assert.deepEqual(root.snapshot().anchor, saved.anchor);
        assert.equal(root.snapshot().counters.bindTotal, saved.counters.bindTotal);
        root.list('list').updateHeights([{ key: 'k0', contentVersion: 0, height: 50 }]);
        await commitReady(root);
        assert.equal(root.snapshot().scrollOffset, 113);
        assert.deepEqual(root.snapshot().anchor, saved.anchor);
        assert.equal(prepared.length, 2);
    } finally { await engine.dispose(); }
});

test('UI measure invalidation prepares only the selected leaf or descendants of its dirty ancestor', async () => {
    const engine = await createEngine({ host: host().adapter }), calls = { a: 0, b: 0 }, contexts = { a: [], b: [] }, results = { a: [], b: [] };
    let refuseB = false;
    const makeSource = name => ({ revision: 0, prepare(context) {
        calls[name]++;
        if (name === 'b' && refuseB) throw new Error('Unrelated sibling must not prepare');
        contexts[name].push(context);
        const result = content(context, 10 + calls[name]);
        results[name].push(result);
        return result;
    } });
    const root = createUiRoot({ engine, scope: engine.createScope(), id: 'selective-root', viewport: { width: 100, height: 200 }, density: 1,
        tree: { id: 'column', kind: 'column', children: [
            { id: 'branch', kind: 'column', children: [{ id: 'a', kind: 'leaf', content: makeSource('a') }] },
            { id: 'b', kind: 'leaf', content: makeSource('b') },
        ] } });
    try {
        await commitReady(root);
        assert.deepEqual(calls, { a: 1, b: 1 });
        const firstB = results.b[0], scopeB = contexts.b[0].scope;
        refuseB = true;
        root.invalidate('a', 'measure');
        await commitReady(root);
        assert.deepEqual(calls, { a: 2, b: 1 });
        assert.equal(contexts.a[0].scope.state, 'closed');
        assert.equal(scopeB.state, 'open');
        assert.equal(engine.stage.getChildAt(0).getChildAt(1).getChildAt(0), firstB.content);
        root.invalidate('branch', 'measure');
        await commitReady(root);
        assert.deepEqual(calls, { a: 3, b: 1 });
        assert.equal(scopeB.state, 'open');
        assert.equal(firstB.content.isDisposed, false);
        assert.equal(engine.stage.getChildAt(0).getChildAt(1).getChildAt(0), firstB.content);
        refuseB = false;
        root.invalidate('column', 'measure');
        await commitReady(root);
        assert.deepEqual(calls, { a: 4, b: 2 });
        assert.equal(scopeB.state, 'closed');
        assert.equal(firstB.content.isDisposed, true);
        assert.equal(contexts.b[1].scope.state, 'open');
    } finally { await engine.dispose(); }
});
