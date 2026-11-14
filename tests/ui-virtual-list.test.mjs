// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, DisplayObjectContainer } from '@egret/engine';
import { createUiRoot } from '@egret/engine/ui';
import { host } from './helpers.mjs';
test('UI exact row edges and extreme scroll agree with an independent linear interval oracle', async () => {
    const engine = await createEngine({ host: host().adapter }), scope = engine.createScope();
    const records = [24, 40, 64, 24, 40, 64].map((height, i) => ({ key: String(i), estimatedHeight: height, contentVersion: 0, value: height }));
    const source = { revision: 0, records, bind(c) { return { content: c.scope.use(new DisplayObjectContainer()), measuredHeight: c.value }; }, unbind() { } };
    const root = createUiRoot({ engine, scope, id: 'list-root', viewport: { width: 80, height: 60 }, density: 1, tree: { id: 'list', kind: 'virtualList', source, explicitWidth: 80, explicitHeight: 60 }, limits: { overscan: 0, residentCap: 8 } });
    try {
        const total = records.reduce((n, r) => n + r.value, 0);
        for (const intent of [-Number.MAX_VALUE, 0, 24, 64, 128, Number.MAX_VALUE]) {
            const scroll = Math.max(0, Math.min(intent, total - 60)), expected = [];
            let y = 0;
            for (const r of records) {
                if (y + r.value > scroll && y < scroll + 60)
                    expected.push({ key: r.key, y: y - scroll, height: r.value });
                y += r.value;
            }
            root.list('list').setScrollOffset(intent);
            root.commit(await root.prepare());
            assert.equal(root.snapshot().scrollOffset, scroll);
            assert.deepEqual(root.snapshot().rows.map(r => ({ key: r.key, y: r.box.y, height: r.box.height })), expected);
        }
        root.list('list').setSource({ ...source, revision: 1, records: [] });
        root.commit(await root.prepare());
        assert.equal(root.snapshot().scrollOffset, 0);
        assert.equal(root.snapshot().scrollExtent, 0);
        assert.deepEqual(root.snapshot().rows, []);
    }
    finally {
        await engine.dispose();
    }
});
test('UI a scroll to the offset the list is at holds it there through a source replaced in the same turn', async () => {
    const engine = await createEngine({ host: host().adapter }), scope = engine.createScope();
    const make = (revision, order) => ({ revision, records: order.map(index => ({ key: 'k' + index, estimatedHeight: 20, contentVersion: 0, value: index })),
        bind(c) { return { content: c.scope.use(new DisplayObjectContainer()), measuredHeight: 20 }; }, unbind() { } });
    const up = Array.from({ length: 40 }, (_, index) => index), down = [...up].reverse();
    const root = createUiRoot({ engine, scope, id: 'list-root', viewport: { width: 80, height: 60 }, density: 1, tree: { id: 'list', kind: 'virtualList', source: make(0, up), explicitWidth: 80, explicitHeight: 60 }, limits: { overscan: 0, residentCap: 8 } });
    const list = root.list('list'), commit = async () => root.commit(await root.prepare());
    const shown = () => [root.snapshot().scrollOffset, root.snapshot().rows.filter(row => row.visible).map(row => row.key).join()];
    try {
        await commit();
        assert.deepEqual(shown(), [0, 'k0,k1,k2']);
        // A new order alone keeps the row that was at the top in view: the list follows its anchor, here to the end, where that row now is.
        list.setSource(make(1, down)); await commit();
        assert.deepEqual(shown(), [740, 'k2,k1,k0']);
        list.setSource(make(2, up)); await commit();
        assert.deepEqual(shown(), [40, 'k2,k3,k4']);
        list.setScrollOffset(0); await commit();
        assert.deepEqual(shown(), [0, 'k0,k1,k2']);
        // A scroll said after the new order overrides the anchor, also when it is to the offset the list is at now.
        list.setSource(make(3, down)); list.setScrollOffset(0); await commit();
        assert.deepEqual(shown(), [0, 'k39,k38,k37']);
        list.setScrollOffset(40); await commit();
        assert.deepEqual(shown(), [40, 'k37,k36,k35']);
        list.setSource(make(4, up)); list.setScrollOffset(40); await commit();
        assert.deepEqual(shown(), [40, 'k2,k3,k4']);
        // Said before the new order, with nothing waiting, it was no change, and the anchor is followed as before.
        list.setScrollOffset(40); list.setSource(make(5, down)); await commit();
        assert.deepEqual(shown(), [740, 'k2,k1,k0']);
        // With nothing waiting it stays no change: nothing new is there to prepare.
        const revision = root.snapshot().desiredRevision;
        list.setScrollOffset(740);
        assert.equal(root.snapshot().desiredRevision, revision);
    } finally { await engine.dispose(); }
});
