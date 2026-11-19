// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PNG } from 'pngjs';
import { copyImageData2DPixels, Bitmap, createAssetRef, createAssetType, createImageData2D, createTexture, isTexture } from '@egret/engine';
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
