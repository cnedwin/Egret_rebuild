// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createEngine, createImageData2D, copyImageData2DPixels, CancellationController} from '@egret/engine';
import {createParagraph, createParagraphCache} from '@egret/engine/paragraph';
import {createCanvasKitParagraphProvider} from '@egret/engine/web/paragraph';
import {createUiRoot} from '@egret/engine/ui';
import {host, deferred, flush} from './helpers.mjs';
const request = (changes = {}) => ({text: 'One two three four', width: 95, fontFamilies: ['Unit'], fontSize: 20,
    locale: 'en', direction: 'ltr', fillColor: 0xffffff, density: 1, ...changes});
const code = name => error => error?.code === name;
// Controlled SDK geometry tests lifecycle/capability authority; native tests below use exact font bytes.
function raster(input) {
    const count = Math.min(input.maxLines ?? 3, 3), unit = Math.floor(input.text.length / 3);
    return {metrics: {width: input.width, height: count * 24,
        lines: Array.from({length: count}, (_, i) => ({start: i * unit, end: (i + 1) * unit,
            baseline: i * 24 + 18, ascent: 18, descent: 6, height: 24, width: input.width})),
        ...(input.maxLines === undefined ? {} : {truncated: count < 3})},
        image: createImageData2D({width: 2, height: 2, pixels: new Uint8Array(16).fill(255)}), offsetX: 0, offsetY: 0};
}
async function controlled(t, capabilities = {textAlign: true, maxLines: true}) {
    const engine = await createEngine({host: host().adapter}); t.after(() => engine.dispose());
    const state = {calls: 0, inputs: [], hook: undefined};
    const provider = {identity: 'unit.paragraph.layout', ...(capabilities === undefined ? {} : {capabilities}),
        async prepare(input, context) {state.calls++; state.inputs.push(input); return state.hook ? state.hook(input, context) : raster(input);}};
    const cache = createParagraphCache(engine.assets, {provider});
    return {engine, cache, state, provider, scope: engine.createScope()};
}
test('paragraph layout snapshots controls and explicit left shares the original cache request', async t => {
    const {cache, state} = await controlled(t);
    const a = await cache.acquire(request()), b = await cache.acquire(request({textAlign: 'left'}));
    assert.equal(state.calls, 1); assert.equal(a.metrics, b.metrics); assert.equal(Object.hasOwn(a.metrics, 'truncated'), false);
    a.lease.release(); b.lease.release();
    const input = request({textAlign: 'end', maxLines: 1}), pending = cache.acquire(input);
    input.textAlign = 'center'; input.maxLines = 3;
    const clipped = await pending; assert.equal(clipped.metrics.lines.length, 1); assert.equal(clipped.metrics.truncated, true);
    assert.equal(state.inputs.at(-1).textAlign, 'end'); assert.equal(state.inputs.at(-1).maxLines, 1);
    assert.ok(Object.isFrozen(state.inputs.at(-1))); assert.ok(Object.isFrozen(clipped.metrics)); clipped.lease.release();
});
test('older paragraph providers refuse new layout features before native work or slot reservation', async t => {
    const {cache, state} = await controlled(t, {});
    const original = await cache.acquire(request()); await flush(); const before = cache.getStatus();
    for (const input of [request({textAlign: 'center'}), request({maxLines: 2})]) await assert.rejects(cache.acquire(input), code('PARAGRAPH_FEATURE_UNSUPPORTED'));
    assert.equal(state.calls, 1); assert.deepEqual(cache.getStatus(), before); original.lease.release();
});
test('provider capabilities are captured once and cannot be broadened or revoked later', async t => {
    const flags = {textAlign: true, maxLines: true}, one = await controlled(t, flags);
    flags.textAlign = false; flags.maxLines = false;
    const prepared = await one.cache.acquire(request({textAlign: 'right', maxLines: 2})); prepared.lease.release();
    const two = await controlled(t, {}); two.provider.capabilities.textAlign = true;
    await assert.rejects(two.cache.acquire(request({textAlign: 'right'})), code('PARAGRAPH_FEATURE_UNSUPPORTED')); assert.equal(two.state.calls, 0);
});
test('invalid alignment and line caps never change the accepted paragraph revision', async t => {
    const {engine, scope, cache, state} = await controlled(t), node = createParagraph(engine, scope, cache);
    node.setRequest(request()); await node.prepare(); const before = node.getStatus();
    for (const textAlign of ['', null, 'middle', 1, {}]) assert.throws(() => node.setRequest(request({textAlign})), code('PARAGRAPH_REQUEST_INVALID'));
    for (const maxLines of [0, -1, 1.5, 8194, Infinity, NaN, '2']) assert.throws(() => node.setRequest(request({maxLines})), code('PARAGRAPH_REQUEST_INVALID'));
    assert.deepEqual(node.getStatus(), before); assert.equal(state.calls, 1);
    const fitting = await cache.acquire(request({maxLines: 8193})); assert.equal(fitting.metrics.truncated, false); fitting.lease.release();
});
test('malformed or over-cap results preserve committed content and its metrics', async t => {
    const {engine, scope, cache, state} = await controlled(t), node = createParagraph(engine, scope, cache);
    node.setRequest(request()); const before = await node.prepare(), image = node.getChildAt(0);
    for (const invalid of ['missing-overflow', 'nonboolean-overflow', 'too-many-lines']) {
        state.hook = async input => {const value = raster(input); if (invalid === 'missing-overflow') delete value.metrics.truncated;
            else if (invalid === 'nonboolean-overflow') value.metrics.truncated = 1;
            else value.metrics.lines = raster(request()).metrics.lines; return value;};
        node.setRequest(request({text: 'replacement ' + invalid, maxLines: 1}));
        await assert.rejects(node.prepare(), e => e?.code === 'ASSET_LOAD_FAILED' && e.cause?.code === 'PARAGRAPH_PROVIDER_RESULT_INVALID');
        assert.equal(node.getStatus().metrics, before); assert.equal(node.getChildAt(0), image); assert.equal(image.isDisposed, false);
    }
});
test('pending and cancelled layout replacements retain the committed version and reject stale completion', async t => {
    const {engine, scope, cache, state} = await controlled(t), node = createParagraph(engine, scope, cache), gate = deferred();
    node.setRequest(request({maxLines: 2})); const before = await node.prepare(), image = node.getChildAt(0);
    state.hook = input => input.text === 'slow change' ? gate.promise.then(() => raster(input)) : raster(input);
    node.setRequest(request({text: 'slow change', textAlign: 'center', maxLines: 1})); const pending = node.prepare(), rejected = assert.rejects(pending);
    assert.equal(node.getStatus().metrics, before); assert.equal(node.getChildAt(0), image);
    node.setRequest(request({text: 'latest text', textAlign: 'end', maxLines: 1})); await node.prepare();
    gate.resolve(); await rejected; await flush(); assert.equal(node.getStatus().metrics.lines.length, 1); assert.equal(node.getStatus().metrics.truncated, true);
    assert.equal(node.numChildren, 1); assert.equal(cache.getStatus().callerLeases, 1);
    const cancel = new CancellationController(); cancel.abort(Error('cancel'));
    await assert.rejects(cache.acquire(request({maxLines: 2}), {signal: cancel.signal}), code('PARAGRAPH_CANCELLED'));
});
test('clamped paragraph height and following UI geometry publish through one existing UI revision', async t => {
    const {engine, scope, cache} = await controlled(t);
    const tree = cap => ({kind: 'column', id: 'column', explicitWidth: 95, children: [
        {kind: 'leaf', id: 'text', content: {revision: cap, async prepare(context) {
            const node = createParagraph(engine, context.scope, cache); node.setRequest(request({width: context.width, maxLines: cap}));
            const metrics = await node.prepare(); return {content: node, measuredHeight: metrics.height};}}},
        {kind: 'leaf', id: 'footer', explicitHeight: 8},
    ]});
    const ui = createUiRoot({engine, scope, id: 'clamped-ui', viewport: {width: 95, height: 100}, density: 1, tree: tree(3)});
    ui.commit(await ui.prepare()); assert.equal(ui.snapshot().boxes.find(b => b.id === 'footer').y, 72);
    ui.setTree(tree(1)); const prepared = await ui.prepare(); assert.equal(ui.snapshot().boxes.find(b => b.id === 'footer').y, 72);
    ui.commit(prepared); assert.equal(ui.snapshot().boxes.find(b => b.id === 'text').height, 24); assert.equal(ui.snapshot().boxes.find(b => b.id === 'footer').y, 24);
});
const vendor = new URL('../examples/paragraph-panel/vendor/', import.meta.url);
let nativeModule, nativeTemporary;
const nativeTemporaryRoot = fs.realpathSync(os.tmpdir());
test.after(() => {
    if (nativeTemporary === undefined) return;
    assert.equal(path.dirname(nativeTemporary), nativeTemporaryRoot);
    assert.ok(path.basename(nativeTemporary).startsWith('egret-paragraph-layout-'));
    fs.rmSync(nativeTemporary, {recursive: true});
});
async function actualProvider(t) {
    const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', vendor), 'utf8'));
    if (!nativeModule) {
        nativeTemporary = fs.mkdtempSync(path.join(nativeTemporaryRoot, 'egret-paragraph-layout-'));
        const cjs = path.join(nativeTemporary, 'canvaskit.cjs'); fs.copyFileSync(new URL(manifest.runtime.glue, vendor), cjs);
        nativeModule = await createRequire(import.meta.url)(cjs)({locateFile: () => fileURLToPath(new URL(manifest.runtime.wasm, vendor))});
    }
    const provider = createCanvasKitParagraphProvider({canvasKit: nativeModule, buildIdentity: manifest.runtime.buildIdentity,
        fonts: manifest.fonts.slice(0, 2).map(f => ({family: f.family, identity: f.sha256, data: fs.readFileSync(new URL(f.path, vendor))}))});
    t.after(() => provider.dispose());
    const prepare = changes => provider.prepare(request({fontFamilies: ['Noto Sans', 'Noto Sans Arabic'], ...changes}), {signal: new CancellationController().signal});
    return {provider, prepare};
}
const pixels = value => value.image === undefined ? new Uint8Array() : copyImageData2DPixels(value.image);
test('actual native provider aligns ink and resolves start/end using the paragraph base direction', async t => {
    const {provider, prepare} = await actualProvider(t); assert.deepEqual(provider.capabilities,{textAlign:true,maxLines:true,textGeometry:true});
    for (const direction of ['ltr', 'rtl']) {
        const common = {text: 'ABC', width: 200, direction}, left = await prepare({...common, textAlign: 'left'}), right = await prepare({...common, textAlign: 'right'}), center = await prepare({...common, textAlign: 'center'});
        assert.ok(right.offsetX > left.offsetX + 100); assert.ok(center.offsetX > left.offsetX + 40); assert.ok(center.offsetX < right.offsetX);
        for (const [logical, physical] of [['start', direction === 'rtl' ? 'right' : 'left'], ['end', direction === 'rtl' ? 'left' : 'right']]) {
            const a = await prepare({...common, textAlign: logical}), b = physical === 'left' ? left : right;
            assert.deepEqual(a.metrics, b.metrics); assert.equal(a.offsetX, b.offsetX); assert.equal(a.offsetY, b.offsetY); assert.deepEqual(pixels(a), pixels(b));
        }
        const justified = await prepare({text: 'ABC DEF GHI JKL MNO', textAlign: 'justify', direction}); assert.ok(pixels(justified).some((v, i) => i % 4 === 3 && v > 0));
    }
});
test('actual line-clamp raster contains the fixed ellipsis and fitting/empty text is not marked truncated', async t => {
    const {prepare} = await actualProvider(t);
    const clipped = await prepare({text: 'M'.repeat(20), maxLines: 1}), reference = await prepare({text: 'MMMM\u2026'});
    assert.equal(clipped.metrics.truncated, true); assert.equal(clipped.metrics.lines.length, 1);
    assert.equal(clipped.offsetX, reference.offsetX); assert.equal(clipped.offsetY, reference.offsetY); assert.deepEqual(pixels(clipped), pixels(reference));
    const fit = await prepare({text: 'short', maxLines: 1}); assert.equal(fit.metrics.truncated, false);
    const empty = await prepare({text: '', maxLines: 1}); assert.equal(empty.metrics.truncated, false); assert.equal(empty.image, undefined);
});
test('actual mixed-bidi line clamp keeps logical metrics independent of raster density', async t => {
    const {prepare} = await actualProvider(t); const text = 'abc \u202Bمرحبا 123     \u202C xyz plus more words';
    for (const direction of ['ltr', 'rtl']) for (const textAlign of ['center', 'start', 'end']) {
        const one = await prepare({text, maxLines: 2, direction, textAlign, density: 1}), two = await prepare({text, maxLines: 2, direction, textAlign, density: 2});
        assert.equal(one.metrics.truncated, true); assert.equal(one.metrics.lines.length, 2); assert.deepEqual(one.metrics, two.metrics);
        assert.ok(pixels(one).some((v, i) => i % 4 === 3 && v > 0)); assert.ok(pixels(two).length > pixels(one).length);
    }
});

// These observations reproduce the source review's previously missing marker cases.
test('actual hard-break and blank-line truncation preserve a visible fixed marker', async t => {
    const {prepare} = await actualProvider(t);
    for (const direction of ['ltr','rtl']) for (const [text, referenceText, cap = 1] of [['A\nB','A\u2026'], ['A\r\nB','A\u2026'], ['A\rB','A\u2026'], ['A\u2028B','A\u2026'], ['A\u2029B','A\u2026'], ['\nB','\u2026'], [' \nB',' \u2026'], ['A\nB\nC','A\nB\u2026',2]]) {
        // Synthetic ellipsis is a separate shaping run. B + authored ellipsis has pair kerning in LTR; use a same-prefix clamp reference for that case.
        const result = await prepare({text, maxLines: cap, direction}), reference = await prepare(cap === 1 ? {text: referenceText, direction} : {text: 'A\nB\nD', maxLines: cap, direction});
        if (cap === 2) { const unmarked = await prepare({text:'A\nB', direction}); assert.notDeepEqual(pixels(result), pixels(unmarked)); }
        assert.equal(result.metrics.truncated, true, text); assert.equal(result.metrics.lines.length, cap, text);
        assert.equal(result.offsetX, reference.offsetX, text); assert.equal(result.offsetY, reference.offsetY, text);
        assert.deepEqual(pixels(result), pixels(reference), text);
    }
});
test('too-narrow ellipsis refuses without poisoning the same provider or its next valid paragraph', async t => {
    const {prepare} = await actualProvider(t);
    for (const maxLines of [1, 2]) await assert.rejects(prepare({text: 'MMMMMMMM', width: .25, maxLines}), code('PARAGRAPH_ELLIPSIS_DOES_NOT_FIT'));
    const next = await prepare({text: 'short', maxLines: 1}); assert.equal(next.metrics.truncated, false); assert.ok(pixels(next).length > 0);
    const empty = await prepare({text: '', width: .25, maxLines: 1}); assert.equal(empty.metrics.truncated, false);
});

test('CRLF and CR layout retains authored UTF16 ranges and matches LF raster', async t => {
    const {prepare} = await actualProvider(t);
    const authored = await prepare({text: 'A\r\nB\rC'}), lf = await prepare({text: 'A\nB\nC'});
    assert.deepEqual(authored.metrics.lines.map(line => [line.start, line.end]), [[0,1],[3,4],[5,6]]);
    assert.equal(authored.offsetX, lf.offsetX); assert.equal(authored.offsetY, lf.offsetY); assert.deepEqual(pixels(authored), pixels(lf));
});
test('older actual native modules retain basic paragraphs and refuse unqualified line clamp', async t => {
    const temporaryRoot = fs.realpathSync(os.tmpdir()), temporary = fs.mkdtempSync(path.join(temporaryRoot, 'egret-paragraph-legacy-'));
    let provider;
    t.after(() => {try {provider?.dispose();} finally {assert.equal(path.dirname(temporary), temporaryRoot); assert.ok(path.basename(temporary).startsWith('egret-paragraph-legacy-')); fs.rmSync(temporary, {recursive: true});}});
    const cjs = path.join(temporary, 'legacy.cjs'); fs.copyFileSync(new URL('runtime/line-bidi-r1/canvaskit.js', vendor), cjs);
    const ck = await createRequire(import.meta.url)(cjs)({locateFile: () => fileURLToPath(new URL('runtime/line-bidi-r1/canvaskit.wasm', vendor))});
    const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', vendor), 'utf8'));
    provider = createCanvasKitParagraphProvider({canvasKit: ck, buildIdentity: 'legacy-native-line-bidi',
        fonts: manifest.fonts.slice(0,2).map(f => ({family: f.family, identity: f.sha256, data: fs.readFileSync(new URL(f.path, vendor))}))});
    assert.equal(provider.capabilities.textAlign, true); assert.equal(provider.capabilities.maxLines, false);
    const input = request({text: 'ABC', fontFamilies: ['Noto Sans'], textAlign: 'right'});
    const result = await provider.prepare(input, {signal: new CancellationController().signal}); assert.ok(pixels(result).length > 0);
    await assert.rejects(provider.prepare({...input, maxLines: 1}, {signal: new CancellationController().signal}), code('PARAGRAPH_FEATURE_UNSUPPORTED'));
});

test('hard-break ellipsis alignment excludes the invisible terminating newline advance', async t => {
 const {prepare}=await actualProvider(t);
 for(const direction of ['ltr','rtl'])for(const textAlign of ['left','center','right']) {
  const actual=await prepare({text:'A\nA\nC',maxLines:2,direction,textAlign}),reference=await prepare({text:'A\nA…',direction,textAlign});
  assert.equal(actual.offsetX,reference.offsetX,direction+':'+textAlign);assert.equal(actual.offsetY,reference.offsetY);assert.deepEqual(pixels(actual),pixels(reference),direction+':'+textAlign);
 }
});

test('hard-break clipping reserves marker width without counting the break twice', async t => {
 const {prepare}=await actualProvider(t);
 for(const direction of ['ltr','rtl'])for(const textAlign of ['left','center','right']){
  const a=await prepare({text:'MMMM\nB',width:75,maxLines:1,direction,textAlign}),b=await prepare({text:'MMM…',width:75,direction,textAlign});
  assert.equal(a.metrics.truncated,true);assert.equal(a.offsetX,b.offsetX);assert.equal(a.offsetY,b.offsetY);assert.deepEqual(pixels(a),pixels(b),direction+':'+textAlign);
 }
});
