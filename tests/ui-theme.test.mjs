// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, Sprite, Bitmap, createAssetType, createAssetRef, createTexture, createImageData2D, isTexture } from '@egret/engine';
import { createUiRoot, createUiTheme } from '@egret/engine/ui';
import { host, deferred, flush } from './helpers.mjs';
import { captureDrawn } from './helpers/drawn-frame.mjs';

const frame = { width: 160, height: 200 };
const makeTheme = (id, color = 0xff0000, gap = 3, height = 20, skin = 'red') => createUiTheme({ id,
    colors: { background: color }, spacing: { gap, height },
    typography: { body: { fontFamily: 'Fixture', fontSize: 12, lineHeight: height } },
    skins: { badge: { default: skin, focus: skin } } });
function makeContent(c, height = c.theme?.spacing.height ?? 20) {
    const content = c.scope.use(new Sprite());
    content.graphics.beginFill(c.theme?.colors.background ?? 0xff0000).drawRect(0, 0, c.width, height).endFill();
    content.touchEnabled = true; content.hitArea = { x: 0, y: 0, width: c.width, height };
    return { content, measuredHeight: height };
}
function tree(source, measure = () => ({ width: 10, height: 5, dependencyRevision: 0 })) {
    return { id: 'column', kind: 'column', gap: 1, theme: { gap: 'gap' }, children: [
        { id: 'body', kind: 'leaf', content: source },
        { id: 'tail', kind: 'leaf', measure, fill: { color: 0x0000ff }, theme: { fill: 'background' } }
    ] };
}
async function publish(root) { for (let round = 0; round < 8; round++) { const token = await root.prepare(); if (token.status !== 'pending') return root.commit(token); } assert.fail('fixture did not converge'); }
async function scene(source, theme, measure) {
    const diagnostics = [];
    const engine = await createEngine({ host: host().adapter, onDiagnostic: d => diagnostics.push(d) }), owner = engine.createScope();
    const root = createUiRoot({ engine, scope: owner, id: 'root', viewport: { width: 100, height: 100 }, density: 1, theme, tree: tree(source, measure) });
    return { engine, owner, root, diagnostics };
}
const code = expected => error => { assert.equal(error.code, expected); return true; };

test('theme admission snapshots finite data and rejects forged generations, accessors and unknown tokens', async () => {
    const input = { id: 'a', colors: { background: 1 }, spacing: { gap: 3 }, typography: { body: { fontFamily: 'A', fontSize: 12, lineHeight: 20 } }, skins: { badge: { default: 'red', pressed: 'green' } } };
    const theme = createUiTheme(input), equal = createUiTheme(input);
    input.colors.background = 2; input.typography.body.fontSize = 18; input.skins.badge.default = 'blue';
    assert.equal(theme.colors.background, 1); assert.equal(theme.typography.body.fontSize, 12); assert.equal(theme.skins.badge.default, 'red');
    assert.notEqual(theme, equal); assert.ok(Object.isFrozen(theme)); assert.ok(Object.isFrozen(theme.typography.body));
    let getterCalls = 0;
    for (const bad of [{ id: 'a', unknown: 1 }, { id: 'a', colors: { a: 0.5 } }, { id: 'a', spacing: { a: Infinity } },
        { id: 'a', skins: { badge: { default: 'https://host' } } }, { id: 'a', get colors() { getterCalls++; return {}; } }]) assert.throws(() => createUiTheme(bad), code('UI_THEME_INVALID'));
    assert.equal(getterCalls, 0);
    assert.throws(() => createUiTheme({ id: 'a', colors: Object.fromEntries(Array.from({ length: 65 }, (_, i) => ['c' + i, 1])) }), code('UI_THEME_LIMIT'));
    const f = await scene({ revision: 0, prepare: makeContent }, theme);
    try {
        assert.throws(() => f.root.setTheme({ ...theme }), code('UI_THEME_INVALID'));
        assert.throws(() => f.root.setTheme(createUiTheme({ id: 'missing' })), code('UI_THEME_TOKEN_MISSING'));
        await publish(f.root); assert.equal(f.root.snapshot().theme, theme);
    } finally { await f.engine.dispose(); }
});

test('paint-only themes publish content, fill and generation atomically without remeasurement or layout', async () => {
    let measurements = 0; const contexts = [], first = makeTheme('red'), second = makeTheme('green', 0x00ff00, 3, 20, 'green');
    const f = await scene({ revision: 0, prepare(c) { contexts.push(c); return makeContent(c); } }, first, () => { measurements++; return { width: 10, height: 5, dependencyRevision: 0 }; });
    try {
        await publish(f.root); const before = f.root.snapshot(), calls = measurements, saved = captureDrawn(f.engine, frame);
        f.root.setTheme(second); const token = await f.root.prepare();
        assert.equal(f.root.snapshot().theme, first); assert.equal(f.root.snapshot().boxes, before.boxes);
        assert.deepEqual(captureDrawn(f.engine, frame).commands, saved.commands); assert.equal(contexts[0].scope.state, 'open');
        assert.equal(f.root.commit(token).kind, 'committed');
        assert.equal(f.root.snapshot().theme, second); assert.equal(f.root.snapshot().boxes, before.boxes);
        assert.equal(measurements, calls); assert.equal(f.root.snapshot().counters.layoutPasses, before.counters.layoutPasses); assert.equal(f.root.snapshot().counters.measurementCalls, 0); assert.equal(contexts[0].scope.state, 'closed');
        assert.deepEqual(captureDrawn(f.engine, frame).commands.map(c => c.color), [0x00ff00, 0x00ff00]);
        assert.equal(f.engine.stage.hitTest(2, 2)?.isDisposed, false);
    } finally { await f.engine.dispose(); }
});

test('failed, cancelled, superseded and late theme preparations retain committed state and close only candidates', async () => {
    let mode = 'ready', gate; const contexts = [], first = makeTheme('red'), second = makeTheme('green', 0x00ff00), third = makeTheme('blue', 0x0000ff);
    const f = await scene({ revision: 0, prepare(c) { contexts.push(c); const result = makeContent(c); if (mode === 'fail') throw Error('authored failure'); return mode === 'wait' ? gate.promise.then(() => result) : result; } }, first);
    try {
        await publish(f.root); const before = f.root.snapshot(), saved = captureDrawn(f.engine, frame);
        mode = 'fail'; f.root.setTheme(second); await assert.rejects(f.root.prepare(), code('UI_PREPARE_FAILED'));
        assert.equal(contexts.at(-1).scope.state, 'closed'); assert.equal(f.root.snapshot().theme, first);
        mode = 'wait'; gate = deferred(); const pending = f.root.prepare(); await flush();
        assert.equal(contexts.at(-1).theme, second); f.root.setTheme(f.root.snapshot().theme);
        await assert.rejects(pending, code('UI_STALE')); assert.equal(contexts.at(-1).scope.state, 'closed');
        assert.deepEqual(captureDrawn(f.engine, frame).commands, saved.commands); assert.equal(f.root.snapshot().boxes, before.boxes);
        gate.resolve(); await flush(); mode = 'ready'; await publish(f.root);
        f.root.setTheme(second); const stale = await f.root.prepare(); f.root.setTheme(third);
        assert.equal(f.root.commit(stale).kind, 'stale'); await publish(f.root); assert.equal(f.root.snapshot().theme, third);
        assert.equal(contexts[0].scope.state, 'closed');
    } finally { await f.engine.dispose(); }
});

test('a paint-only callback cannot smuggle changed height into existing geometry', async () => {
    let wrong = false; const first = makeTheme('red'), second = makeTheme('green', 0x00ff00);
    const f = await scene({ revision: 0, prepare(c) { return makeContent(c, wrong ? 30 : 20); } }, first);
    try { await publish(f.root); const before = f.root.snapshot(); wrong = true; f.root.setTheme(second);
        await assert.rejects(f.root.prepare(), code('UI_THEME_METRICS_CHANGED'));
        assert.equal(f.root.snapshot().theme, first); assert.equal(f.root.snapshot().boxes, before.boxes);
    } finally { await f.engine.dispose(); }
});

test('metric theme replacement recomputes leaves and row heights while retaining stable scroll key and offset', async () => {
    const engine = await createEngine({ host: host().adapter }), owner = engine.createScope(), contexts = [];
    const first = makeTheme('small'), second = makeTheme('large', 0x00ff00, 5, 30);
    const source = { revision: 0, records: Array.from({ length: 20 }, (_, i) => ({ key: 'r' + i, value: i, estimatedHeight: 20, contentVersion: 0 })), bind(c) { contexts.push(c); return makeContent(c); }, unbind() {} };
    const root = createUiRoot({ engine, scope: owner, id: 'root', viewport: { width: 100, height: 100 }, density: 1, theme: first,
        tree: { id: 'column', kind: 'column', theme: { gap: 'gap' }, children: [{ id: 'head', kind: 'leaf', content: { revision: 0, prepare: makeContent } }, { id: 'rows', kind: 'virtualList', explicitWidth: 100, explicitHeight: 60, source }] }, limits: { overscan: 0 } });
    try {
        await publish(root); root.list('rows').setScrollOffset(45); await publish(root); const before = root.snapshot(); assert.deepEqual(before.anchor, { key: 'r2', offset: 5 });
        root.setTheme(second); await publish(root); const after = root.snapshot();
        assert.equal(after.theme, second); assert.deepEqual(after.anchor, before.anchor);
        assert.equal(after.boxes.find(b => b.id === 'head').height, 30); assert.equal(after.boxes.find(b => b.id === 'rows').y, 35);
        assert.ok(after.rows.every(r => r.box.height === 30)); assert.equal(after.rows[0].key, 'r2');
        assert.ok(contexts.filter(c => c.theme === first).every(c => c.scope.state === 'closed'));
    } finally { await engine.dispose(); }
});

test('ordinary root edits supersede pending preparation while retaining the desired theme', async () => {
    let gate; const first = makeTheme('red'), second = makeTheme('green', 0x00ff00), contexts = [];
    const source = { revision: 0, prepare(c) { contexts.push(c); const result = makeContent(c); return gate ? gate.promise.then(() => result) : result; } };
    const f = await scene(source, first);
    try { await publish(f.root); gate = deferred(); f.root.setTheme(second); const pending = f.root.prepare(); await flush();
        f.root.setViewport({ width: 80, height: 100 }, 1); await assert.rejects(pending, code('UI_STALE'));
        gate.resolve(); gate = undefined; await flush(); await publish(f.root);
        assert.equal(f.root.snapshot().theme, second); assert.equal(f.root.snapshot().viewport.width, 80); assert.equal(contexts.at(-1).width, 80);
    } finally { await f.engine.dispose(); }
});

test('theme skin leases use existing assets, preserve shared users and settle late resources on owner disposal', async () => {
    const engine = await createEngine({ host: host().adapter }), owner = engine.createScope(), shared = engine.createScope();
    const type = createAssetType('theme-skin', isTexture), disposals = [], gate = deferred(), contexts = [];
    const texture = color => createTexture(createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([...color, 255]) }));
    engine.assets.register(type, { load(ref) { return ref.key === 'late' ? gate.promise : texture(ref.key === 'red' ? [255, 0, 0] : [0, 255, 0]); }, dispose(value) { disposals.push(value); value.dispose(); } });
    const held = shared.use(await engine.assets.acquire(createAssetRef(type, 'red')));
    const source = { revision: 0, async prepare(c) { contexts.push(c); const lease = c.scope.use(await engine.assets.acquire(createAssetRef(type, c.theme.skins.badge.default), { signal: c.signal })); const content = c.scope.use(new Sprite()); content.addChild(c.scope.use(new Bitmap(lease))); return { content, measuredHeight: 20 }; } };
    const first = makeTheme('red'), second = makeTheme('green', 0x00ff00, 3, 20, 'green');
    const root = createUiRoot({ engine, scope: owner, id: 'root', viewport: { width: 100, height: 100 }, density: 1, theme: first, tree: tree(source) });
    try { await publish(root); root.setTheme(second); await publish(root); assert.equal(held.value.isDisposed, false); assert.equal(disposals.length, 0);
        root.setTheme(makeTheme('late', 1, 3, 20, 'late')); const pending = root.prepare(); await flush(); owner.dispose();
        await assert.rejects(pending, code('UI_CLOSED')); assert.equal(root.state, 'closed'); assert.equal(root.snapshot().theme, undefined);
        const late = texture([0, 0, 255]); gate.resolve(late); await flush();
        assert.equal(contexts.at(-1).scope.state, 'closed'); assert.equal(held.value.isDisposed, false);
        shared.dispose();
    } finally { await engine.dispose(); }
    assert.equal(disposals.length, 3);
});

test('Scope cleanup reentry sees the complete new theme and reports through existing Engine diagnostics', async () => {
    let root, observe = false; const first = makeTheme('red'), second = makeTheme('green', 0x00ff00), observations = [];
    const f = await scene({ revision: 0, prepare(c) { if (c.theme === first) c.scope.use({ dispose() { if (observe) { observations.push(root.snapshot()); throw Error('retirement failure'); } } }); return makeContent(c); } }, first); root = f.root;
    try { await publish(root); observe = true; root.setTheme(second); const result = await publish(root);
        assert.equal(result.kind, 'committed'); assert.equal(result.postCommitErrors.length, 0); assert.ok(f.diagnostics.some(d => d.code === 'SCOPE_CLEANUP_FAILED')); assert.equal(observations[0].theme, second);
        assert.equal(observations[0].committedRevision, root.snapshot().committedRevision);
    } finally { await f.engine.dispose(); }
});

test('theme callback reentry and disposal retire candidates without publishing stale or initial partial state', async () => {
    for (const action of ['new-theme', 'dispose']) {
        let root, reenter = false; const contexts = [], first = makeTheme('red'), second = makeTheme('green', 0x00ff00), third = makeTheme('blue', 0x0000ff);
        const f = await scene({ revision: 0, prepare(c) {
            contexts.push(c); const result = makeContent(c);
            if (reenter) { reenter = false; if (action === 'dispose') root.dispose(); else root.setTheme(third); }
            return result;
        } }, first); root = f.root;
        try {
            if (action === 'new-theme') { await publish(root); root.setTheme(second); }
            reenter = true; await assert.rejects(root.prepare(), code(action === 'dispose' ? 'UI_CLOSED' : 'UI_STALE')); await flush();
            assert.equal(contexts.at(-1).scope.state, 'closed');
            if (action === 'dispose') { assert.deepEqual(root.snapshot().boxes, []); assert.equal(root.snapshot().theme, undefined); assert.deepEqual(captureDrawn(f.engine, frame).commands, []); }
            else { assert.equal(root.snapshot().theme, first); await publish(root); assert.equal(root.snapshot().theme, third); }
        } finally { await f.engine.dispose(); }
    }
});

test('tree, source and scroll intents cannot partially publish a pending theme', async () => {
    for (const mutation of ['tree', 'source', 'scroll']) {
        const engine = await createEngine({ host: host().adapter }), owner = engine.createScope();
        const first = makeTheme('red'), second = makeTheme('green', 0x00ff00), gate = deferred(); let wait = false;
        let source = { revision: 0, records: Array.from({ length: 10 }, (_, i) => ({ key: 'r' + i, value: i, estimatedHeight: 20, contentVersion: 0 })), bind(c) { const result = makeContent(c); return wait ? gate.promise.then(() => result) : result; }, unbind() {} };
        const layout = () => ({ id: 'rows', kind: 'virtualList', explicitWidth: 100, explicitHeight: 60, source });
        const root = createUiRoot({ engine, scope: owner, id: 'root', viewport: { width: 100, height: 100 }, density: 1, theme: first, tree: layout(), limits: { overscan: 0 } });
        try {
            await publish(root); const before = root.snapshot(), saved = captureDrawn(engine, frame).commands;
            wait = true; root.setTheme(second); const pending = root.prepare(); await flush();
            if (mutation === 'tree') root.setTree(layout());
            else if (mutation === 'source') { source = { ...source, revision: 1 }; root.list('rows').setSource(source); }
            else root.list('rows').setScrollOffset(25);
            await assert.rejects(pending, code('UI_STALE'));
            assert.equal(root.snapshot().theme, first); assert.deepEqual(root.snapshot().rows, before.rows); assert.deepEqual(captureDrawn(engine, frame).commands, saved);
            wait = false; gate.resolve(); await flush(); await publish(root); assert.equal(root.snapshot().theme, second);
            if (mutation === 'scroll') assert.deepEqual(root.snapshot().anchor, { key: 'r1', offset: 5 });
        } finally { await engine.dispose(); }
    }
});

test('direct row retirement failures are post-commit errors and cannot hide the complete new theme', async () => {
    const engine = await createEngine({ host: host().adapter }), owner = engine.createScope(), observations = [];
    const first = makeTheme('red'), second = makeTheme('green', 0x00ff00); let root, observe = false;
    const source = { revision: 0, records: [{ key: 'r', value: 0, estimatedHeight: 20, contentVersion: 0 }], bind: makeContent,
        unbind() { if (observe) { observations.push(root.snapshot().theme); throw Error('authored unbind failure'); } } };
    root = createUiRoot({ engine, scope: owner, id: 'root', viewport: { width: 100, height: 100 }, density: 1, theme: first, tree: { id: 'rows', kind: 'virtualList', explicitWidth: 100, explicitHeight: 60, source } });
    try { await publish(root); observe = true; root.setTheme(second); const result = await publish(root);
        assert.equal(result.kind, 'committed'); assert.equal(result.postCommitErrors.length, 1); assert.deepEqual(observations, [second]); assert.equal(root.snapshot().theme, second);
    } finally { observe = false; await engine.dispose(); }
});

test('explicit focus and composition retention refuse theme rebind until release, including late retention', async () => {
    for (const reason of ['focus', 'composition']) {
        const engine = await createEngine({ host: host().adapter }), owner = engine.createScope();
        const first = makeTheme('red'), second = makeTheme('green', 0x00ff00);
        const source = { revision: 0, records: [{ key: 'r', value: 0, estimatedHeight: 20, contentVersion: 0 }], bind: makeContent, unbind() {} };
        const root = createUiRoot({ engine, scope: owner, id: 'root', viewport: { width: 100, height: 100 }, density: 1, theme: first, tree: { id: 'rows', kind: 'virtualList', explicitWidth: 100, explicitHeight: 60, source } });
        try {
            await publish(root); const list = root.list('rows'), retained = list.retain('r', reason); await publish(root); const before = root.snapshot(), saved = captureDrawn(engine, frame).commands;
            assert.throws(() => root.setTheme(second), code('UI_ROW_RETAINED'));
            assert.equal(root.snapshot().desiredRevision, before.desiredRevision); assert.equal(root.snapshot().theme, first); assert.deepEqual(captureDrawn(engine, frame).commands, saved);
            retained.release(); await publish(root); root.setTheme(second);
            const late = list.retain('r', reason); await assert.rejects(root.prepare(), code('UI_ROW_RETAINED'));
            assert.equal(root.snapshot().theme, first); assert.equal(root.snapshot().rows[0].bindingGeneration, before.rows[0].bindingGeneration);
            late.release(); await publish(root); assert.equal(root.snapshot().theme, second); assert.notEqual(root.snapshot().rows[0].bindingGeneration, before.rows[0].bindingGeneration);
        } finally { await engine.dispose(); }
    }
});

test('paint-only theme validates against committed height updates instead of the original binding height', async () => {
    const engine = await createEngine({ host: host().adapter }), owner = engine.createScope(); let reportedHeight = 20;
    const first = makeTheme('red'), second = makeTheme('green', 0x00ff00);
    const source = { revision: 0, records: [{ key: 'r', value: 0, estimatedHeight: 20, contentVersion: 0 }], bind(c) { return makeContent(c, reportedHeight); }, unbind() {} };
    const root = createUiRoot({ engine, scope: owner, id: 'root', viewport: { width: 100, height: 100 }, density: 1, theme: first, tree: { id: 'rows', kind: 'virtualList', explicitWidth: 100, explicitHeight: 60, source } });
    try {
        await publish(root); root.list('rows').updateHeights([{ key: 'r', height: 50, contentVersion: 0 }]); await publish(root);
        const before = root.snapshot(); assert.equal(before.rows[0].box.height, 50); root.setTheme(second);
        await assert.rejects(root.prepare(), code('UI_THEME_METRICS_CHANGED'));
        assert.equal(root.snapshot().theme, first); assert.equal(root.snapshot().rows[0].box.height, 50); assert.equal(root.snapshot().scrollExtent, 50);
        reportedHeight = 50; await publish(root); assert.equal(root.snapshot().theme, second); assert.equal(root.snapshot().rows[0].box.height, 50);
        assert.equal(root.snapshot().counters.layoutPasses, before.counters.layoutPasses);
    } finally { await engine.dispose(); }
});
