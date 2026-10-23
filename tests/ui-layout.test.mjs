// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '@egret/engine';
import { createUiRoot } from '@egret/engine/ui';
import { host } from './helpers.mjs';
test('UI hand-authored boxes and dirty reuse use genuine Engine ownership', async () => {
    const engine = await createEngine({ host: host().adapter }), scope = engine.createScope();
    let a = 0, b = 0;
    const tree = { id: 'column', kind: 'column', explicitWidth: 100, explicitHeight: 80, padding: 5, gap: 3, children: [{ id: 'a', kind: 'leaf', measure() { a++; return { width: 20, height: 10, dependencyRevision: 0 }; }, fill: { color: 16711680 } }, { id: 'b', kind: 'leaf', measure() { b++; return { width: 30, height: 15, dependencyRevision: 0 }; } }] };
    const root = createUiRoot({ engine, scope, id: 'layout', viewport: { width: 100, height: 80 }, density: 1, tree });
    try {
        root.commit(await root.prepare());
        assert.deepEqual(root.snapshot().boxes.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })), [{ id: 'column', x: 0, y: 0, width: 100, height: 80 }, { id: 'a', x: 5, y: 5, width: 20, height: 10 }, { id: 'b', x: 5, y: 18, width: 30, height: 15 }]);
        assert.deepEqual([a, b], [1, 1]);
        root.invalidate('a', 'paint');
        root.commit(await root.prepare());
        assert.deepEqual([a, b], [1, 1]);
        root.setTree({ ...tree, children: [{ ...tree.children[0], fill: { color: 65280 } }, tree.children[1]] });
        root.commit(await root.prepare());
        assert.deepEqual([a, b], [1, 1]);
        root.invalidate('a', 'measure');
        root.commit(await root.prepare());
        assert.deepEqual([a, b], [2, 1]);
        const frame = engine.captureFrame({ width: 100, height: 80 });
        assert.ok(frame.commands.length > 0);
    }
    finally {
        await engine.dispose();
    }
});
test('UI admitted topology and nonfinite failures preserve committed boxes', async () => {
    const engine = await createEngine({ host: host().adapter }), scope = engine.createScope(), root = createUiRoot({ engine, scope, id: 'layout', viewport: { width: 100, height: 80 }, density: 1, tree: { id: 'leaf', kind: 'leaf', explicitWidth: 10, explicitHeight: 20 } });
    try {
        root.commit(await root.prepare());
        const saved = root.snapshot();
        assert.throws(() => root.setViewport({ width: NaN, height: 80 }, 1));
        assert.throws(() => root.setTree({ id: 'other', kind: 'leaf', explicitWidth: 10, explicitHeight: 20 }), e => e.code === 'UI_TREE_SHAPE');
        assert.equal(root.snapshot().committedRevision, saved.committedRevision);
        assert.deepEqual(root.snapshot().boxes, saved.boxes);
        root.setOrigin({ x: -0, y: -0 });
        assert.equal(Object.is(root.snapshot().origin.x, -0), false);
    }
    finally {
        await engine.dispose();
    }
});
