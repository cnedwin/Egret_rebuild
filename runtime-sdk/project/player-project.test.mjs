// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PNG } from 'pngjs';
import { Bitmap, createAssetRef, createAssetType, createImageData2D, createTexture, isTexture } from '@egret/engine';
import { createHerbarium } from '../examples/moon-herbarium/herbarium.mjs';
import { loadPng } from '../examples/moon-herbarium/lettering.mjs';
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
