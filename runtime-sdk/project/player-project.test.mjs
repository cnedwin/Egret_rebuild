// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PNG } from 'pngjs';
import { copyImageData2DPixels, Bitmap, createAssetRef, createAssetType, createImageData2D, createTexture, isTexture } from '@egret/engine';
import { createSaveStore } from '@egret/engine/kit';
import { createHerbarium } from '../examples/moon-herbarium/herbarium.mjs';
import { loadPng } from '../examples/moon-herbarium/lettering.mjs';
import { createPlayerRaster } from './player-raster.mjs';
import { createPlayerProject } from './player-project.mjs';

const image = (width, height) => createImageData2D({ width, height, pixels: new Uint8Array(width * height * 4) });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function host() {
  const states = [], edits = [], sounds = [], released = [], uploads = [];
  return {
    states, edits, sounds, released, uploads,
    state: body => states.push(JSON.parse(body)), edit: text => edits.push(text),
    playSound: path => sounds.push(path), releasePage: id => released.push(id),
    page(id, w, h, payload) {
      assert.equal(Buffer.from(payload, 'base64').length, w * h * 4);
      uploads.push(id);
    }
  };
}

function saveProject(native) {
  let storage;
  const session = createPlayerProject({width: 2, height: 2, create(services) {
    storage = services.storage;
    return {};
  }}, native);
  return {session, get storage() { return storage; }};
}

test('project saves use the engine store across sessions, including migration and removal', async () => {
  // This bridge double keeps committed strings; process restart and on-disk atomicity are device checks.
  const data = new Map();
  const native = {...host(),
    saveRead(key) { return JSON.stringify({value: data.get(key) ?? null}); },
    saveWrite(key, value) { data.set(key, value); return true; },
    saveRemove(key) { data.delete(key); return true; }
  };
  const key = '存档🌙', a = saveProject(native), b = saveProject(native);
  try {
    await a.session.start();
    assert.equal(a.storage.getItem(key), null);
    a.storage.setItem(key, '');
    assert.equal(a.storage.getItem(key), '');
    a.storage.removeItem(key);
    const old = createSaveStore({key, version: 1, defaults: () => ({}), storage: a.storage});
    assert.equal(old.save({place: '河畔', score: 7}), true);
    await a.session.close();
    await b.session.start();
    const current = createSaveStore({key, version: 2, defaults: () => ({}), storage: b.storage,
      migrations: {1: value => ({stage: value.place, score: value.score})}});
    assert.equal(current.loadedVersion, 1);
    assert.deepEqual(current.data, {stage: '河畔', score: 7});
    assert.equal(JSON.parse(data.get(key)).version, 2);
    current.remove();
    assert.equal(b.storage.getItem(key), null);
  } finally { await a.session.close(); await b.session.close(); }
});

test('project saves report unsupported libraries, refused writes and malformed reads', async () => {
  const native = host(), game = saveProject(native), key = 'slot';
  try {
    await game.session.start();
    assert.throws(() => game.storage.getItem(key), {name: 'NotSupportedError'});
    assert.throws(() => game.storage.setItem(key, 'value'), {name: 'NotSupportedError'});
    assert.throws(() => game.storage.removeItem(key), {name: 'NotSupportedError'});
    let response;
    const problems = [];
    native.saveRead = () => response;
    native.saveWrite = () => false;
    native.saveRemove = () => false;
    for (const invalid of [null, 'null', '', '{}', '{"value":7}', '{"value":null,"error":""}', '{"error":"unreadable"}']) {
      response = invalid;
      assert.throws(() => game.storage.getItem(key));
    }
    const store = createSaveStore({key, version: 1, defaults: () => ({}), storage: game.storage,
      onProblem: problem => problems.push(problem.kind)});
    assert.equal(store.save({level: 9}), false);
    store.remove();
    assert.deepEqual(problems, ['unreadable', 'write-failed', 'write-failed']);
    for (const key of ['', 'a'.repeat(257)]) assert.throws(() => game.storage.getItem(key), RangeError);
    assert.throws(() => game.storage.setItem('save', 7), TypeError);
    native.saveWrite = () => 'true';
    assert.throws(() => game.storage.setItem('slot', 'value'), /write failed/);
  } finally { await game.session.close(); }
});

test('project saves reject invalid UTF-16 and oversize UTF-8 before calling the bridge', async () => {
  let calls = 0, accepted;
  const native = {...host(), saveRead() { calls++; return '{"value":null}'; },
    saveWrite(key, value) { calls++; accepted = value; return true; }, saveRemove() { calls++; return true; }};
  const game = saveProject(native);
  try {
    await game.session.start();
    const {storage} = game;
    for (const invalid of ['\ud800', '\ud800X', '\udfff', '\udc00\ud800']) {
      assert.throws(() => storage.getItem(invalid), TypeError);
      assert.throws(() => storage.setItem(invalid, 'v'), TypeError);
      assert.throws(() => storage.removeItem(invalid), TypeError);
      assert.throws(() => storage.setItem('k', invalid), TypeError);
    }
    const limit = 1024 * 1024;
    const exact = '字'.repeat((limit - 4) / 3) + '🌙';
    assert.equal(Buffer.byteLength(exact), limit);
    for (const value of ['x'.repeat(limit + 1), exact + 'x', 'é'.repeat(limit / 2 + 1)]) {
      assert.throws(() => storage.setItem('k', value), RangeError);
    }
    assert.equal(calls, 0);
    storage.setItem('档🌙', exact);
    assert.equal(calls, 1);
    assert.equal(accepted, exact);
  } finally { await game.session.close(); }
});

test('project saves preserve the outcome of an admitted write while closing and prevent later bridge calls', async () => {
  const calls = [], native = host(), game = saveProject(native);
  let closing;
  native.saveWrite = (key, value) => {
    calls.push([key, value]);
    // Model close racing a synchronous native commit. The first result is authoritative.
    closing = game.session.close();
    return true;
  };
  native.saveRead = () => { calls.push('read'); return '{"value":null}'; };
  native.saveRemove = () => { calls.push('remove'); return true; };
  try {
    await game.session.start();
    game.storage.setItem('slot', '完成');
    for (const operation of [() => game.storage.setItem('slot', 'later'), () => game.storage.getItem('slot'),
      () => game.storage.removeItem('slot')]) assert.throws(operation, {name: 'AbortError'});
    assert.deepEqual(calls, [['slot', '完成']]);
    await closing;
  } finally { await game.session.close(); }
});
const raster = {
  // Platform fonts are verified by the device run. This test decodes the actual game PNG files.
  async loadPng(file, width, height) {
    const page = PNG.sync.read(await readFile(new URL('../examples/moon-herbarium/' + file, import.meta.url)));
    assert.deepEqual([page.width, page.height], [width, height]);
    return createImageData2D({ width, height, pixels: new Uint8Array(page.data) });
  },
  makeLabels(entries) {
    const runs = new Map(entries.map(([key], i) => [key, { x: i * 4, y: 0, width: 4, height: 8 }]));
    return { runs, image: image(entries.length * 4, 8) };
  },
  makeHud: () => image(632, 170)
};
test('one real Egret project captures animation, alpha and clipped inventory and consumes native input', async () => {
  const port = host(), project = createPlayerProject({
    width: 360, height: 640, clearColor: 0x132422, create: ctx => createHerbarium(ctx, raster)
  }, port);
  const tap = (x, y) => {
    project.input({ type: 'down', id: 1, x, y });
    project.input({ type: 'up', id: 1, x, y });
  };
  try {
    await Promise.all([project.start(), project.start()]);
    assert.equal(port.states.at(-1).event, 'ready');
    const first = project.frame(0), later = project.frame(384), v = new DataView(first.buffer);
    assert.deepEqual(port.uploads, [1, 2, 3, 4]);
    assert.deepEqual([...Buffer.from(first.subarray(0, 4))], [...Buffer.from('EGR2')]);
    assert.notDeepEqual(first.subarray(24), later.subarray(24));
    const records = Array.from({ length: v.getUint32(20, true) }, (_, i) => 24 + i * 64);
    assert.deepEqual(new Set(records.map(i => v.getUint8(i))), new Set([0, 1, 2, 3, 4]));
    assert.ok(records.some(i => Math.abs(v.getFloat32(i + 4, true) - 0.86) < 0.001));
    assert.ok(records.some(i => v.getFloat32(i + 52, true) === 296 && v.getFloat32(i + 60, true) === 510));
    tap(110, 615);
    assert.equal(port.states.at(-1).event, 'mismatch');
    tap(158, 315); tap(158, 364); tap(110, 615);
    assert.equal(port.states.at(-1).filled, 1);
    assert.deepEqual(port.states.at(-1).stock.slice(0, 3), [3, 3, 4]);
    assert.deepEqual(port.sounds, ['assets/chime.wav']);
    project.input({ type: 'down', id: 7, x: 100, y: 470 });
    project.input({ type: 'move', id: 7, x: 100, y: 330 });
    project.input({ type: 'up', id: 7, x: 100, y: 330 });
    assert.equal(port.states.at(-1).scroll, 140);
    assert.deepEqual(port.states.at(-1).selected, []);
    tap(170, 567);
    assert.deepEqual(port.edits, ['小掌柜']);
    project.input({ type: 'text', text: '药师🌙' });
    project.input({ type: 'submit', text: '药师青禾' });
    assert.equal(port.states.at(-1).name, '药师青禾');
    project.pause();
    tap(170, 567);
    assert.equal(port.states.at(-1).event, 'paused');
    project.resume();
    assert.equal(port.states.at(-1).name, '药师青禾');
    await tick();
    project.frame(502);
    assert.ok(port.uploads.length > 4);
    const result = await project.close();
    assert.equal(result.pagesReleased, 4);
    assert.equal(result.texturesLoaded, result.texturesReleased);
    assert.deepEqual(await project.close(), result);
    assert.deepEqual([...port.released].sort(), [1, 2, 3, 4]);
    assert.throws(() => project.frame(0), /unavailable/);
  } finally { await project.close(); }
});
test('the default game can open and repaint a Unicode signature using only the native raster port', async () => {
  const port = host(), decoded = new Map(), jobs = [];
  for (const path of ['assets/workshop.png', 'assets/botanicals.png']) {
    decoded.set(path, PNG.sync.read(await readFile(new URL('../examples/moon-herbarium/' + path, import.meta.url))));
  }
  port.raster = encoded => {
    const job = JSON.parse(encoded);
    jobs.push(job);
    if (job.op === 'png') {
      const png = decoded.get(job.path);
      assert.deepEqual([png.width, png.height], [job.width, job.height]);
      return JSON.stringify({ pixels: png.data.toString('base64') });
    }
    // Android fonts and visible glyphs are device assertions. These response doubles
    // check atlas placement and the complete project-to-host request route without a DOM.
    if (job.op === 'measure') return JSON.stringify({ widths: job.runs.map(run => run.text.length * run.size) });
    assert.equal(job.op, 'text');
    for (const run of job.runs) {
      assert.ok(run.x >= 0 && run.x < job.width && run.y >= 0 && run.y < job.height);
      assert.ok(run.maxWidth > 0 && run.x + run.maxWidth <= job.width);
    }
    return JSON.stringify({ pixels: Buffer.alloc(job.width * job.height * 4).toString('base64') });
  };
  const project = createPlayerProject({ width: 360, height: 640, create: createHerbarium }, port);
  try {
    await project.start();
    assert.deepEqual(jobs.filter(job => job.op === 'png').map(job => job.path).sort(), [...decoded.keys()].sort());
    assert.equal(jobs.filter(job => job.op === 'measure').length, 1);
    const framed = project.frame(0);
    assert.equal(Buffer.from(framed.subarray(0, 4)).toString(), 'EGR2');
    project.input({ type: 'submit', text: '药师🌙' });
    await tick();
    assert.ok(jobs.at(-1).runs.some(run => run.text === '药师🌙'));
    assert.deepEqual(port.uploads, [1, 2, 3, 4, 4]);
    const snapshot = await project.close();
    assert.equal(snapshot.pagesReleased, 4);
    assert.equal(snapshot.texturesLoaded, snapshot.texturesReleased);
  } finally { await project.close(); }
});

test('raster responses preserve straight RGBA and respect load and project cancellation', async () => {
  const lifetime = new AbortController(), stop = new AbortController(), jobs = [];
  let response = '{"pixels":"/wECgA=="}';
  const service = createPlayerRaster({ raster(value) { jobs.push(JSON.parse(value)); return response; } }, lifetime.signal);
  assert.equal(createPlayerRaster({}, lifetime.signal), undefined);
  const pending = service.loadPng('ignored.png', 1, 1, stop.signal);
  stop.abort(Error('asset retired'));
  await assert.rejects(pending, error => error === stop.signal.reason);
  assert.equal(jobs.length, 0);
  const rgba = await service.loadPng('a.png', 1, 1);
  assert.deepEqual([...copyImageData2DPixels(rgba)], [255, 1, 2, 128]);
  assert.throws(() => service.drawText(4096, 4096, []), /dimensions/);
  assert.equal(jobs.length, 1);
  response = '{"error":"PNG dimensions differ"}';
  await assert.rejects(service.loadPng('wrong.png', 1, 1), /PNG dimensions differ/);
  response = '{"pixels":"AA=="}';
  assert.throws(() => service.drawText(1, 1, []), /Incomplete/);
  response = '{"widths":[]}';
  assert.throws(() => service.measureText([{ text: '药', size: 24 }]), /widths/);
  lifetime.abort(Error('closed'));
  const count = jobs.length;
  await assert.rejects(service.loadPng('late.png', 1, 1), error => error === lifetime.signal.reason);
  assert.throws(() => service.measureText([]), error => error === lifetime.signal.reason);
  assert.equal(jobs.length, count);
});

test('partial initialization retires every published page and closes its scope', async () => {
  const port = host();
  let released = false;
  const project = createPlayerProject({ width: 2, height: 2, create({ scope, publishPage }) {
    scope.use({ dispose() { released = true; } });
    publishPage(1, image(2, 2));
    throw new Error('Missing project file');
  } }, port);
  await assert.rejects(project.start(), /Missing project file/);
  await project.close();
  assert.equal(released, true);
  assert.deepEqual(port.released, [1]);
});

test('page retirement uses publication identity across replacement, removal, slot reuse and teardown', async () => {
  const port = host(), active = new Set();
  const native = {
    ...port,
    page(...args) { port.page(...args); active.add(args[0]); },
    releasePage(id) { port.releasePage(id); active.delete(id); }
  };
  let publish;
  const a = image(2, 2), b = image(2, 2);
  const project = createPlayerProject({ width: 2, height: 2, async create({ engine, scope, publishPage }) {
    publish = publishPage;
    const type = createAssetType('page-test-texture', isTexture);
    engine.assets.register(type, { async load() { return createTexture(a); }, dispose(texture) { texture.dispose(); } });
    const lease = scope.use(await engine.assets.acquire(createAssetRef(type, 'bitmap')));
    engine.stage.addChild(scope.use(new Bitmap(lease)));
    return {};
  } }, native);
  try {
    await project.start();
    const original = publish(1, a);
    assert.equal(publish(1, a), original);
    const replacement = publish(1, b);
    const current = publish(1, a);
    assert.notEqual(original, current);
    assert.equal(original.release(), false);
    assert.equal(replacement.release(), false);
    assert.deepEqual([...active], [1]);
    assert.equal(project.frame(0)[24], 1);
    assert.equal(current.release(), true);
    assert.equal(current.release(), false);
    assert.deepEqual([...active], []);
    assert.throws(() => project.frame(20), /missing project page/);
    const reused = publish(2, a);
    assert.equal(current.release(), false);
    assert.equal(project.frame(40)[24], 2);
    assert.deepEqual([...active], [2]);
    assert.equal((await project.close()).pagesReleased, 2);
    assert.deepEqual([...active], []);
    assert.equal(reused.release(), false);
    assert.deepEqual(port.released, [1, 2]);
  } finally { await project.close(); }
});

test('foreground frames tick the scoped Engine clock and re-anchor after pause and stalls', async () => {
  const samples = [], updates = [];
  const project = createPlayerProject({ width: 2, height: 2, create({ engine, scope }) {
    engine.clock.onTick(scope, tick => { samples.push(Math.round(tick.deltaSeconds * 1000)); });
    return { update(time) { updates.push(time); } };
  } }, host());
  try {
    await project.start();
    project.frame(10); project.frame(26);
    project.pause(); project.frame(900);
    project.resume(); project.frame(25); project.frame(950); project.frame(970); project.frame(1970);
    assert.deepEqual(samples, [16, 20, 100]);
    assert.deepEqual(updates, [10, 26, 950, 970, 1970]);
  } finally { await project.close(); }
});

test('closing during a pending scope-owned acquisition aborts both project work and the asset loader', async () => {
  let entered, signal, owner, loaderAborted = false;
  const waiting = new Promise(resolve => { entered = resolve; });
  const project = createPlayerProject({ width: 2, height: 2, async create(ctx) {
    owner = ctx.scope;
    signal = ctx.signal;
    const type = createAssetType('suspended-texture', isTexture);
    ctx.engine.assets.register(type, {
      load(ref, options) {
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => { loaderAborted = true; reject(new Error('aborted')); });
          entered();
        });
      },
      dispose(value) { value.dispose(); }
    });
    await ctx.engine.createAssetGroup(owner, [createAssetRef(type, 'slow')]).ready;
    throw Error('Unexpected group resolution');
  } }, host());
  const start = project.start();
  await waiting;
  const rejected = assert.rejects(start);
  const close = project.close();
  assert.equal(signal.aborted, true);
  assert.equal(owner.state, 'closed');
  await rejected;
  await close;
  assert.equal(loaderAborted, true);
});

test('a failing close snapshot still retires all bindings even if a native release fails', async () => {
  const failing = Error('native release'), snapshot = Error('close snapshot');
  const port = host();
  let handle, attempts = 0;
  port.releasePage = () => { attempts++; throw failing; };
  const project = createPlayerProject({ width: 2, height: 2, create({ publishPage }) {
    handle = publishPage(1, image(2, 2));
    return { closedSnapshot() { throw snapshot; } };
  } }, port);
  await project.start();
  const close = project.close();
  await assert.rejects(close, error => {
    assert.deepEqual(error.errors, [failing, snapshot]);
    return true;
  });
  assert.equal(project.close(), close);
  assert.equal(handle.release(), false);
  assert.equal(attempts, 1);
});

test('an aborted workshop PNG detaches both image handlers and preserves the acquisition reason', async t => {
  let request;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: class {
    constructor() { request = this; }
    removeAttribute(key) { assert.equal(key, 'src'); delete this.src; }
  } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'Image', original);
    else delete globalThis.Image;
  });
  const signal = {
    aborted: false, reason: Error('project scope closed'), listeners: new Set(),
    addEventListener(type, callback) { assert.equal(type, 'abort'); this.listeners.add(callback); },
    removeEventListener(type, callback) { assert.equal(type, 'abort'); this.listeners.delete(callback); }
  };
  const loading = loadPng('assets/workshop.png', 328, 164, signal);
  assert.equal(request.src, 'assets/workshop.png');
  assert.equal(signal.listeners.size, 1);
  signal.aborted = true;
  for (const listener of signal.listeners) listener();
  await assert.rejects(loading, error => error === signal.reason);
  assert.equal(signal.listeners.size, 0);
  assert.equal(request.src, undefined);
  assert.equal(request.onload, null);
  assert.equal(request.onerror, null);
  const previous = request;
  await assert.rejects(loadPng('assets/second.png', 4, 4, signal), error => error === signal.reason);
  assert.equal(request, previous);
});

// These host doubles delay completion: receiving an ID does not imply the UI or
// the isolate has received the result. The physical builds exercise the real bridge.
function textHost() {
  const reads = new Map(), replies = new Map(), cancelled = [], taken = [];
  return {
    ...host(), reads, replies, cancelled, taken,
    readText(id, path) { reads.set(id, path); return true; },
    cancelReadText(id) { cancelled.push(id); replies.delete(id); },
    takeTextResult(id) {
      taken.push(id);
      const value = replies.get(id);
      replies.delete(id);
      return value;
    }
  };
}

test('packaged text delivers concurrent UTF-8 and empty results to the initiating read', async () => {
  const port = textHost();
  let assets;
  const project = createPlayerProject({width: 2, height: 2, create(ctx) { assets = ctx.assets; return {}; }}, port);
  try {
    await project.start();
    const first = assets.readText('data/level.json'), second = assets.readText('data/empty.txt');
    const [[a, pathA], [b, pathB]] = port.reads;
    assert.deepEqual([pathA, pathB], ['data/level.json', 'data/empty.txt']);
    port.replies.set(b, '');
    project.textResult(b, '');
    const level = '{"关卡":"山门🌙","台词":"雪\\n夜"}';
    port.replies.set(a, level);
    project.textResult(a, '');
    project.textResult(a, '');
    assert.deepEqual(await Promise.all([first, second]), [level, '']);
    assert.deepEqual(port.taken, [b, a]);
    assert.deepEqual(port.cancelled, []);
  } finally { await project.close(); }
});

test('packaged text distinguishes file, decoding, limit and transport failures and can retry', async () => {
  const port = textHost();
  let assets;
  const project = createPlayerProject({ width: 2, height: 2, create(ctx) { assets = ctx.assets; return {}; } }, port);
  try {
    await project.start();
    for (const code of ['NotFoundError', 'EncodingError', 'RangeError', 'TypeError', 'Error']) {
      const path = 'assets/bad.json';
      const read = assets.readText(path);
      project.textResult([...port.reads.keys()].at(-1), code);
      await assert.rejects(read, error => {
        if (code === 'RangeError') assert.ok(error instanceof RangeError);
        if (code === 'TypeError') assert.ok(error instanceof TypeError);
        return error.name === code && error.message.includes(path);
      });
    }
    const read = port.readText;
    port.readText = () => false;
    await assert.rejects(assets.readText('data/full.txt'), { name: 'RangeError' });
    port.readText = () => { throw Error('bridge unavailable'); };
    await assert.rejects(assets.readText('data/retry.txt'), /bridge unavailable/);
    port.readText = read;
    const retry = assets.readText('data/retry.txt');
    const id = [...port.reads.keys()].at(-1);
    port.replies.set(id, '可重试');
    project.textResult(id, '');
    assert.equal(await retry, '可重试');
    assert.deepEqual(port.taken, [id]);
  } finally { await project.close(); }
});

test('packaged text cancels caller and session reads independently and ignores late completions', async () => {
  const port = textHost(), retired = new AbortController(), active = new AbortController();
  let assets;
  const project = createPlayerProject({ width: 2, height: 2, create(ctx) { assets = ctx.assets; return {}; } }, port);
  try {
    await project.start();
    retired.abort(new Error('already retired'));
    await assert.rejects(assets.readText('data/a.txt', retired.signal), err => err === retired.signal.reason);
    assert.equal(port.reads.size, 0);
    const a = assets.readText('data/a.txt', active.signal), b = assets.readText('data/b.txt');
    const [aId, bId] = port.reads.keys();
    active.abort(new Error('player changed levels'));
    await assert.rejects(a, err => err === active.signal.reason);
    project.textResult(aId, '');
    assert.deepEqual(port.cancelled, [aId]);
    const rejected = assert.rejects(b, {name: 'AbortError'});
    await project.close();
    await rejected;
    project.textResult(bId, '');
    await assert.rejects(assets.readText('data/after-close.txt'), {name: 'AbortError'});
    assert.deepEqual(port.cancelled, [aId, bId]);
    assert.deepEqual(port.taken, []);
    assert.equal(port.reads.size, 2);
  } finally { await project.close(); }
});

test('closing during factory text loading releases scope and prevents a late scene attachment', async () => {
  const port = textHost(), entered = Promise.withResolvers();
  let attached = false, disposed = false, lifetime;
  const project = createPlayerProject({ width: 2, height: 2, async create(ctx) {
    lifetime = ctx.signal;
    ctx.scope.use({ dispose() { disposed = true; } });
    const pending = ctx.assets.readText('levels/open.json', ctx.signal);
    entered.resolve();
    await pending;
    attached = true;
    return {};
  } }, port);
  const opening = project.start();
  const rejection = assert.rejects(opening, err => err === lifetime.reason);
  await entered.promise;
  const closing = project.close();
  project.textResult([...port.reads.keys()][0], '');
  await Promise.all([closing, rejection]);
  assert.ok(disposed);
  assert.equal(attached, false);
  assert.equal(port.cancelled.length, 1);
  assert.deepEqual(port.taken, []);
  assert.throws(() => project.frame(0), /unavailable/);
});

test('packaged text caps pending requests and accepts an engine scope cancellation signal', async () => {
  const port = textHost();
  let assets, own;
  const project = createPlayerProject({width: 2, height: 2, create(ctx) {
    assets = ctx.assets;
    own = ctx.engine.createScope();
    return {};
  }}, port);
  try {
    await project.start();
    const inScope = assets.readText('data/scoped.txt', own.signal);
    const remaining = Array.from({length: 7}, (_, index) => assets.readText('data/' + index + '.txt'));
    await assert.rejects(assets.readText('data/ninth.txt'), {name: 'RangeError'});
    assert.equal(port.reads.size, 8);
    own.dispose();
    await assert.rejects(inScope, err => err === own.signal.reason);
    const replacement = assets.readText('data/replacement.txt');
    for (const [id, path] of [...port.reads].slice(1)) {
      port.replies.set(id, path);
      project.textResult(id, '');
    }
    assert.equal(await replacement, 'data/replacement.txt');
    assert.equal((await Promise.all(remaining)).length, 7);
  } finally { own?.dispose(); await project.close(); }
});

test('older native hosts can start projects and report unsupported reads on demand', async () => {
  let assets;
  const project = createPlayerProject({width: 2, height: 2, create(ctx) { assets = ctx.assets; return {}; }}, host());
  try {
    await project.start();
    await assert.rejects(assets.readText('data/level.json'), {name: 'NotSupportedError'});
    assert.equal(project.frame(0).byteLength, 24);
  } finally { await project.close(); }
});

function byteHost() {
  const port = textHost();
  port.readBytes = (id, path) => { port.reads.set(id, path); return true; };
  return port;
}

test('binary assets return owned bytes while text completions retain their encoding', async () => {
  const port = byteHost();
  let assets;
  const project = createPlayerProject({width: 2, height: 2, create(ctx) { assets = ctx.assets; return {}; }}, port);
  try {
    await project.start();
    const payload = Uint8Array.from([0xef, 0xbb, 0xbf, ...Array.from({length: 256}, (_, i) => i)]);
    const packed = Buffer.from(payload).toString('base64');
    const text = assets.readText('level/name.txt');
    const one = assets.readBytes('level/map.bin');
    const two = assets.readBytes('level/map.bin');
    const empty = assets.readBytes('level/empty.bin');
    const [a, b, c, d] = port.reads.keys();
    for (const [id, reply] of [[c, packed], [d, ''], [b, packed], [a, 'AQ==']]) {
      port.replies.set(id, reply);
      project.textResult(id, '');
    }
    const [first, second] = await Promise.all([one, two]);
    assert.deepEqual(first, payload);
    assert.deepEqual(second, payload);
    first[0] = 0;
    assert.equal(second[0], 0xef);
    assert.equal(await text, 'AQ==');
    assert.deepEqual(await empty, new Uint8Array(0));
    assert.deepEqual(port.taken, [c, d, b, a]);
  } finally { await project.close(); }
});

test('text and byte reads share capacity, cancellation, close and stale reply handling', async () => {
  const port = byteHost();
  const abort = new AbortController();
  let assets;
  const project = createPlayerProject({width: 2, height: 2, create(ctx) { assets = ctx.assets; return {}; }}, port);
  try {
    await project.start();
    const pending = assets.readBytes('levels/map.bin', abort.signal);
    const others = Array.from({ length: 7 }, (_, i) => assets.readText('levels/' + i + '.txt'));
    await assert.rejects(assets.readBytes('levels/ninth.bin'), RangeError);
    const firstId = [...port.reads.keys()][0];
    abort.abort(new Error('leave level'));
    await assert.rejects(pending, error => error === abort.signal.reason);
    const retry = assets.readBytes('levels/map.bin');
    project.textResult(firstId, '');
    const retryId = [...port.reads.keys()].at(-1);
    port.replies.set(retryId, '/w==');
    project.textResult(retryId, '');
    assert.deepEqual(await retry, Uint8Array.of(255));
    const last = assets.readBytes('levels/missing.bin');
    project.textResult([...port.reads.keys()].at(-1), 'NotFoundError');
    await assert.rejects(last, { name: 'NotFoundError' });
    const closingRead = assets.readBytes('levels/open.bin');
    const closeId = [...port.reads.keys()].at(-1);
    const rejected = [...others, closingRead].map(result => assert.rejects(result, { name: 'AbortError' }));
    await project.close();
    await Promise.all(rejected);
    project.textResult(closeId, '');
    assert.deepEqual(port.taken, [retryId]);
    assert.equal(port.cancelled.length, 9);
  } finally { await project.close(); }
});

test('a text-only AAR accepts text and rejects binary on demand', async () => {
  const port = textHost();
  let assets;
  const project = createPlayerProject({width: 2, height: 2, create(ctx) { assets = ctx.assets; return {}; }}, port);
  try {
    await project.start();
    await assert.rejects(assets.readBytes('map.bin'), {name: 'NotSupportedError'});
    assert.equal(port.reads.size, 0);
    const legacy = assets.readText('map.txt');
    const [id] = port.reads.keys();
    port.replies.set(id, '旧地图');
    project.textResult(id, '');
    assert.equal(await legacy, '旧地图');
  } finally { await project.close(); }
});

test('a WebView without the typed-array Base64 codec reads binary assets', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(Uint8Array, 'fromBase64');
  t.after(() => Object.defineProperty(Uint8Array, 'fromBase64', descriptor));
  Object.defineProperty(Uint8Array, 'fromBase64', { ...descriptor, value: undefined });
  const port = byteHost();
  let assets;
  const project = createPlayerProject({width: 2, height: 2, create(ctx) { assets = ctx.assets; return {}; }}, port);
  try {
    await project.start();
    const read = assets.readBytes('map.bin');
    const [id] = port.reads.keys();
    port.replies.set(id, 'AP8=');
    project.textResult(id, '');
    assert.deepEqual(await read, Uint8Array.of(0, 255));
  } finally { await project.close(); }
});

test('binary reads admit the full byte limit and reject an oversized bridge result', async () => {
  const port = byteHost();
  let assets;
  const project = createPlayerProject({width: 2, height: 2, create(ctx) { assets = ctx.assets; return {}; }}, port);
  try {
    await project.start();
    // Adjacent sizes can have the same number of Base64 characters.
    for (const size of [256 * 1024, 256 * 1024 + 1, 256 * 1024 + 3]) {
      const read = assets.readBytes('levels/block.bin');
      const id = [...port.reads.keys()].at(-1);
      port.replies.set(id, Buffer.alloc(size, 0xfe).toString('base64'));
      project.textResult(id, '');
      if (size === 256 * 1024) {
        const bytes = await read;
        assert.equal(bytes.length, size);
        assert.equal(bytes.at(-1), 0xfe);
      } else {
        await assert.rejects(read, RangeError);
      }
    }
  } finally { await project.close(); }
});

test('native labels share one painted and published page, with independent leases and bounded retirement', async () => {
  const calls = [], native = { ...host(), raster(json) {
    const job = JSON.parse(json);
    calls.push(job);
    if (job.runs[0]?.text === 'fail') return JSON.stringify({ error: 'paint failed' });
    return JSON.stringify({ pixels: Buffer.alloc(job.width * job.height * 4).toString('base64') });
  } };
  let raster, publish, scene;
  const game = createPlayerProject({ width: 32, height: 16, create(services) {
    raster = services.raster;
    publish = services.publishPage;
    scene = services.engine.stage;
    return {};
  } }, native);
  const run = { text: '北门', x: 0, y: 0, maxWidth: 30, size: 12, color: '#FFEE11', strokeWidth: 1 };
  try {
    await game.start();
    const [a, b] = await Promise.all([raster.acquireText(32, 16, [run]),
      raster.acquireText(32, 16, [{ ...run, weight: 400, color: '#ffee11', strokeColor: '#000000' }])]);
    assert.equal(a.value, b.value);
    assert.notEqual(a, b);
    const bitmap = scene.addChild(new Bitmap(a));
    scene.addChild(new Bitmap(b)).x = 16;
    game.frame(0, 1);
    assert.equal(raster.textPageUsage().hits, 1);
    assert.equal(raster.textPageUsage().bytes, 2048);
    assert.equal(calls.length, 1);
    assert.deepEqual(native.uploads, [255]);
    assert.throws(() => publish(255, image(1, 1)), /active text lease/);
    const variants = await Promise.all([
      { ...run, text: '南门' }, { ...run, x: 2 }, { ...run, strokeColor: '#ff2200' }
    ].map(changed => raster.acquireText(32, 16, [changed])));
    assert.equal(raster.textPageUsage().occupied, 4);
    bitmap.dispose();
    a.release();
    assert.equal(native.released.length, 0);
    b.release();
    assert.deepEqual(native.released, [255]);
    for (const lease of variants) lease.release();
    assert.equal(raster.textPageUsage().occupied, 0);
    await assert.rejects(raster.acquireText(32, 16, [{ ...run, text: 'fail' }]));
    assert.equal(raster.textPageUsage().bytes, 0);
    const many = await Promise.all(Array.from({ length: 32 }, (_, i) =>
      raster.acquireText(2, 2, [{ ...run, text: String(i) }])));
    await assert.rejects(raster.acquireText(2, 2, [run]), /budget/);
    assert.equal(raster.textPageUsage().refusals, 1);
    many.pop().release();
    await raster.acquireText(2, 2, [run]);
    assert.equal(raster.textPageUsage().occupied, 32);
  } finally { await game.close(); }
  assert.equal(raster.textPageUsage().occupied, 0);
  assert.equal(native.uploads.length, native.released.length);
  await assert.rejects(raster.acquireText(1, 1, [run]));
});

test('native text descriptors cannot reserve a page after their view closes during capture', async () => {
  let service, closing;
  const game = createPlayerProject({ width: 2, height: 2, create(s) { service = s.raster; return {}; } },
    { ...host(), raster() { throw new Error('closed view painted'); } });
  await game.start();
  const run = { get text() { closing = game.close(); return '北'; }, size: 2, x: 0, y: 0, maxWidth: 2, color: '#ffffff' };
  await assert.rejects(service.acquireText(2, 2, [run]));
  await closing;
  assert.equal(service.textPageUsage().occupied, 0);
  assert.equal(service.textPageUsage().bytes, 0);
});
