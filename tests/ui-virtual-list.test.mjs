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
