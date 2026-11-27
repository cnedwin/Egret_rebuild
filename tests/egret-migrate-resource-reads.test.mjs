// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as sdk from '@egret/engine';
import { createBitmapText, parseBitmapFont } from '@egret/engine/bitmapfont';
import { createLegacyBindings } from '../tools/egret-migrate/legacy-web.mjs';

const drain = () => new Promise(resolve => setImmediate(resolve));
async function fixture(sheets = []) {
  const engine = await sdk.createEngine({
    host: {
      surface: {},
      start() {},
      stop() {},
      async close() {},
      setTimeout() {
        return () => {};
      }
    }
  });
  const scope = engine.createScope(),
    inflight = new Map(),
    order = [],
    released = [];
  let peak = 0;
  const begin = key =>
    new Promise((resolve, reject) => {
      if (inflight.has(key)) throw Error('duplicate ' + key);
      order.push(key);
      inflight.set(key, {
        resolve(value) {
          inflight.delete(key);
          resolve(value);
        },
        reject(error) {
          inflight.delete(key);
          reject(error);
        }
      });
      peak = Math.max(peak, inflight.size);
    });
  const textureType = sdk.createAssetType('fixture', sdk.isTexture);
  engine.assets.register(textureType, {
    async load(ref) {
      await begin(ref.id);
      return sdk.createTexture(sdk.createImageData2D({ width: 2, height: 2, pixels: new Uint8Array(16) }));
    },
    dispose(value) {
      released.push(value);
      value.dispose();
    }
  });
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'atlas', 'page'];
  const assets = names.map(name => ({
    name,
    url: name + '.' + (name === 'page' ? 'png' : 'txt'),
    type: name === 'page' ? 'image' : 'text'
  }));
  const groups = [
    { name: 'left', keys: ['a', 'b', 'c'] },
    { name: 'right', keys: ['c', 'd', 'e'] }
  ];
  const game = {
    scope,
    engine,
    stage: engine.stage,
    pointer: { events: { tap: sdk.createEventType('tap', { bubbles: true }) } },
    loadTexture: async url => scope.use(await engine.assets.acquire(sdk.createAssetRef(textureType, url)))
  };
  const options = {
    width: 320,
    height: 180,
    projectId: 'read_queue',
    sheets,
    resources: { root: 'r/', configUrl: 'r/config.json', resources: assets, groups }
  };
  const {
    api: { RES }
  } = createLegacyBindings({ ...sdk, createBitmapText, parseBitmapFont }, game, options, {
    storage: () => ({}),
    readAsset: item => begin(item.name)
  });
  await RES.loadConfig('r/config.json', 'r/');
  return { engine, RES, inflight, order, released, peak: () => peak };
}

test('RES.profile snapshots active reads and retained resources without starting more I/O', async () => {
  const h = await fixture();
  try {
    h.RES.setMaxLoadingThread(1);
    const first = h.RES.getResAsync('a');
    const second = h.RES.getResAsync('b');
    await drain();
    const during = h.RES.profile();
    assert.deepEqual(during.reads, { active: 1, queued: 1, limit: 1 });
    assert.equal(during.declared, 8);
    assert.equal(during.pending, 2);
    assert.equal(during.ready, 0);
    assert.ok(Object.isFrozen(during) && Object.isFrozen(during.reads));
    h.inflight.get('a').resolve('a');
    await first;
    await drain();
    h.inflight.get('b').resolve('b');
    await second;
    await drain();
    assert.deepEqual(h.RES.profile().reads, { active: 0, queued: 0, limit: 1 });
    assert.equal(h.RES.profile().ready, 2);
    assert.equal(h.RES.destroyRes('a'), true);
    assert.equal(h.RES.profile().ready, 1);
    assert.equal(during.ready, 0);
    assert.deepEqual(h.order, ['a', 'b']);
  } finally {
    await h.engine.dispose();
  }
});

test('one limit covers direct reads and simultaneous groups, with coalesced items and per-group progress', async () => {
  const h = await fixture(),
    progress = [];
  try {
    h.RES.setMaxLoadingThread(2);
    const left = h.RES.loadGroup('left', 0, { onProgress: (n, total) => progress.push(['left', n, total]) });
    const right = h.RES.loadGroup('right', 0, { onProgress: (n, total) => progress.push(['right', n, total]) });
    const direct = h.RES.getResAsync('f');
    await drain();
    assert.equal(h.inflight.size, 2);
    const finished = new Set();
    while (finished.size < 6) {
      for (const [name, pending] of [...h.inflight]) {
        finished.add(name);
        pending.resolve(name);
      }
      await drain();
    }
    assert.equal(await direct, 'f');
    await Promise.all([left, right]);
    assert.equal(h.peak(), 2);
    assert.equal(h.order.filter(n => n === 'c').length, 1);
    for (const group of ['left', 'right'])
      assert.deepEqual(
        progress.filter(row => row[0] === group).map(a => a.slice(1)),
        [
          [1, 3],
          [2, 3],
          [3, 3]
        ]
      );
  } finally {
    await h.engine.dispose();
  }
});

test('changing the limit admits queued work, cancels queued reads without I/O and suppresses closed callbacks', async () => {
  const h = await fixture();
  h.RES.setMaxLoadingThread(0);
  const a = h.RES.getResAsync('a'),
    b = h.RES.getResAsync('b'),
    c = h.RES.getResAsync('c');
  const canceled = assert.rejects(c, { code: 'LEGACY_RESOURCE_RETIRED' });
  assert.deepEqual(h.order, ['a']);
  assert.equal(h.RES.destroyRes('c'), true);
  await canceled;
  h.RES.setMaxLoadingThread(2);
  assert.deepEqual(h.order, ['a', 'b']);
  h.RES.setMaxLoadingThread(1);
  const d = h.RES.getResAsync('d');
  h.inflight.get('a').resolve('A');
  await a;
  await drain();
  assert.deepEqual(h.order, ['a', 'b']);
  h.inflight.get('b').resolve('B');
  await b;
  await drain();
  assert.deepEqual(h.order, ['a', 'b', 'd']);
  const queued = h.RES.getResAsync('e', () => assert.fail('closed owner callback'));
  const dropQueued = assert.rejects(queued, { code: 'SCOPE_CLOSED' }),
    dropLate = assert.rejects(d, { code: 'SCOPE_CLOSED' });
  await h.engine.dispose();
  await dropQueued;
  h.inflight.get('d').resolve('D');
  await dropLate;
  assert.deepEqual(h.order, ['a', 'b', 'd']);
});

test('overriding a loading group keeps exact read ownership and suppresses stale success', async () => {
  const h = await fixture(),
    complete = [],
    progress = [];
  try {
    h.RES.addEventListener(h.RES.ResourceEvent.GROUP_COMPLETE, e => complete.push(e.groupName), null);
    h.RES.createGroup('live', ['a']);
    const old = h.RES.loadGroup('live', 0, { onProgress: n => progress.push(n) });
    const retired = assert.rejects(old, { code: 'LEGACY_RESOURCE_RETIRED' });
    await drain();
    h.RES.createGroup('live', ['b'], true);
    const current = h.RES.loadGroup('live');
    await drain();
    h.inflight.get('b').resolve('B');
    await current;
    h.inflight.get('a').resolve('A');
    await retired;
    assert.deepEqual(complete, ['live']);
    assert.deepEqual(progress, []);
    assert.equal(h.RES.destroyRes('live'), true);
    assert.equal(h.RES.getRes('a'), null);
    assert.equal(h.RES.getRes('b'), null);
  } finally {
    await h.engine.dispose();
  }
});

test('two simultaneous failures notify the group once after all its independent reads settle', async () => {
  const h = await fixture(),
    errors = [],
    completed = [];
  try {
    h.RES.setMaxLoadingThread(2);
    h.RES.addEventListener(h.RES.ResourceEvent.GROUP_LOAD_ERROR, event => errors.push(event.itemsLoaded), null);
    const pending = h.RES.loadGroup('left', 0, { onProgress: n => completed.push(n) });
    const rejection = assert.rejects(pending, /unavailable/);
    await drain();
    h.inflight.get('a').reject(new Error('unavailable A'));
    h.inflight.get('b').reject(new Error('unavailable B'));
    await drain();
    assert.deepEqual(errors, []);
    h.inflight.get('c').resolve('C');
    await rejection;
    assert.deepEqual(errors, [1]);
    assert.deepEqual(completed, [1]);
    assert.equal(h.RES.isGroupLoaded('left'), false);
  } finally {
    await h.engine.dispose();
  }
});

test('an atlas and its page share one physical read with a concurrency limit of one', async () => {
  const h = await fixture([
    {
      name: 'atlas',
      page: 'page',
      subkeys: ['unit'],
      frames: [
        { name: 'unit', x: 0, y: 0, width: 1, height: 1, sourceWidth: 1, sourceHeight: 1, offsetX: 0, offsetY: 0 }
      ]
    }
  ]);
  try {
    h.RES.setMaxLoadingThread(1);
    const atlas = h.RES.getResAsync('unit'),
      page = h.RES.getResAsync('page'),
      text = h.RES.getResAsync('a');
    await drain();
    assert.equal(h.inflight.size, 1);
    for (let i = 0; i < 2; i++) {
      const [key, read] = h.inflight.entries().next().value;
      read.resolve(key);
      await drain();
    }
    await Promise.all([atlas, page, text]);
    assert.equal(h.peak(), 1);
    assert.deepEqual(h.order.slice().sort(), ['a', 'page.png']);
    assert.equal(h.RES.getRes('unit').textureWidth, 1);
  } finally {
    await h.engine.dispose();
  }
  assert.equal(h.released.length, 1);
});

test('two fonts share one I/O slot across descriptors and PNG pages', async () => {
  const h = await fixture();
  try {
    h.RES.setMaxLoadingThread(1);
    const loading = Promise.all(['alpha', 'beta'].map(key => h.RES.getResByUrl(key + '.fnt', null, null, 'font')));
    for (let i = 0; i < 4; i++) {
      await drain();
      assert.equal(h.inflight.size, 1);
      const [key, job] = h.inflight.entries().next().value;
      if (key.endsWith('.fnt'))
        job.resolve({ file: key.replace('.fnt', '.png'), frames: { A: { x: 0, y: 0, w: 1, h: 1 } } });
      else job.resolve();
    }
    await loading;
    assert.equal(h.peak(), 1);
    assert.equal(h.order.length, 4);
  } finally {
    await h.engine.dispose();
  }
});
