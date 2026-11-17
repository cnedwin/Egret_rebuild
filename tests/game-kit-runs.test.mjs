// SPDX-License-Identifier: Apache-2.0
// Quality variants, headless runs, IndexedDB saves and the bundle cache.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRandom,
  createSaveStore,
  pickQualityFiles,
  pickQualityVariant,
  runHeadless,
  writeAssetBundle
} from '@egret/engine/kit';
import { openBrowserAssetBundle, openBrowserBundleCache, openIndexedDBSaveStorage } from '@egret/engine/web/kit';

test('QV01 a missing tier falls to the nearest below, then above', () => {
  const v = { low: 'l', high: 'h' };
  assert.equal(pickQualityVariant(v, 'high'), 'h');
  assert.equal(pickQualityVariant(v, 'medium'), 'l');
  assert.equal(pickQualityVariant({ high: 'h' }, 'low'), 'h');
  assert.throws(() => pickQualityVariant({}, 'low'), { code: 'QUALITY_VARIANT_MISSING' });
  assert.throws(() => pickQualityVariant(v, 'ultra'), { code: 'QUALITY_VARIANT_INVALID' });
  assert.deepEqual(
    pickQualityFiles(
      ['models/hero-high.glb', 'models/hero-low.glb', 'models/lu-medium.glb', 'art/hall.webp'],
      'medium'
    ),
    ['models/hero-low.glb', 'models/lu-medium.glb', 'art/hall.webp']
  );
  assert.deepEqual(pickQualityFiles(['a-high.glb', 'a-low.glb'], 'high'), ['a-high.glb']);
});

test('HR01 each seed plays to the end with the stand-in player, and runs repeat', () => {
  // A walk to a goal 10 metres away; the player sometimes stands still.
  const createGame = seed => ({
    seed,
    x: 0,
    t: 0,
    update(dt, step) {
      this.x += step * dt;
      this.t += dt;
    }
  });
  const createPlayer = (game, seed) => {
    const dice = createRandom(seed);
    return () => (dice.chance(0.8) ? 2 : 0);
  };
  const options = { createGame, createPlayer, done: g => g.x >= 10, seeds: 3, summary: g => ({ x: +g.x.toFixed(2) }) };
  const first = runHeadless(options),
    again = runHeadless(options);
  assert.deepEqual(
    first.map(r => r.seed),
    [1, 2, 3]
  );
  assert.ok(first.every(r => r.finished && r.seconds > 5 && r.seconds < 9));
  assert.deepEqual(
    first.map(r => r.steps),
    again.map(r => r.steps),
    'the same seeds play the same way'
  );
  assert.ok(first.every(r => r.averageMs >= 0 && r.slowestMs >= r.averageMs));
  const stuck = runHeadless({ ...options, createPlayer: () => () => 0, seeds: [7], maxSeconds: 2 });
  assert.equal(stuck[0].finished, false);
  assert.ok(Math.abs(stuck[0].seconds - 2) < 0.02);
  assert.throws(() => runHeadless({}), { code: 'HEADLESS_RUN_INVALID' });
});

// A small IndexedDB stand-in: one database of one store, with the request and transaction shapes used.
function fakeIndexedDB() {
  const databases = new Map();
  const later = fn => queueMicrotask(fn);
  const req = (result, run) => {
    const r = { result: undefined, error: null, onsuccess: null, onerror: null };
    later(() => {
      try {
        r.result = run ? run() : result;
        r.onsuccess?.();
      } catch (e) {
        r.error = e;
        r.onerror?.();
      }
    });
    return r;
  };
  return {
    databases,
    failWrites: false,
    open(name) {
      const factory = this;
      const data = databases.get(name) ?? new Map();
      databases.set(name, data);
      const db = {
        objectStoreNames: { contains: () => data.created === true },
        createObjectStore() {
          data.created = true;
        },
        close() {
          db.closed = true;
        },
        transaction(_store, mode) {
          const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
          const store = {
            getAllKeys: () => req(null, () => [...data.keys()].filter(k => k !== 'created')),
            getAll: () => req(null, () => [...data.entries()].filter(([k]) => k !== 'created').map(([, v]) => v)),
            put(value, key) {
              if (factory.failWrites) {
                tx.error = new Error('QuotaExceededError');
                return;
              }
              data.set(key, value);
            },
            delete(key) {
              data.delete(key);
            }
          };
          if (mode === 'readwrite') later(() => (tx.error ? tx.onerror?.() : tx.oncomplete?.()));
          return {
            objectStore: () => store,
            ...tx,
            set oncomplete(f) {
              tx.oncomplete = f;
            },
            set onerror(f) {
              tx.onerror = f;
            },
            set onabort(f) {
              tx.onabort = f;
            },
            get error() {
              return tx.error;
            }
          };
        }
      };
      const r = { result: db, onupgradeneeded: null, onsuccess: null, onerror: null };
      later(() => {
        if (!data.created) r.onupgradeneeded?.();
        r.onsuccess?.();
      });
      return r;
    }
  };
}

test('ID01 an IndexedDB save storage reads synchronously after opening and writes through', async () => {
  const indexedDB = fakeIndexedDB();
  const storage = await openIndexedDBSaveStorage({ database: 'game', indexedDB });
  const save = createSaveStore({ key: 'slot1', version: 1, defaults: () => ({ level: 1 }), storage });
  save.update(d => void (d.level = 4));
  await storage.flush();
  storage.close();
  const again = await openIndexedDBSaveStorage({ database: 'game', indexedDB });
  assert.equal(
    createSaveStore({ key: 'slot1', version: 1, defaults: () => ({ level: 1 }), storage: again }).data.level,
    4
  );
  // A write the database refuses is told, and the next write reports it to the save store.
  const errors = [];
  const failing = await openIndexedDBSaveStorage({ database: 'game', indexedDB, onError: e => errors.push(e) });
  indexedDB.failWrites = true;
  failing.setItem('x', '1');
  await assert.rejects(failing.flush(), { code: 'BROWSER_STORAGE_WRITE_FAILED' });
  assert.equal(errors.length, 1);
  assert.throws(() => failing.setItem('y', '2'), { code: 'BROWSER_STORAGE_WRITE_FAILED' });
  await assert.rejects(openIndexedDBSaveStorage({ database: '' }), { code: 'BROWSER_STORAGE_OPTIONS_INVALID' });
  await assert.rejects(openIndexedDBSaveStorage({ database: 'x', indexedDB: null }), {
    code: 'BROWSER_STORAGE_UNAVAILABLE'
  });
});

// A Cache API stand-in over a map.
function fakeCaches() {
  const stores = new Map();
  return {
    async open(name) {
      const map = stores.get(name) ?? new Map();
      stores.set(name, map);
      return {
        async match(url) {
          const b = map.get(String(url));
          return b ? new Response(b.slice()) : undefined;
        },
        async put(url, response) {
          map.set(String(url), new Uint8Array(await response.arrayBuffer()));
        },
        async keys() {
          return [...map.keys()].map(url => ({ url }));
        },
        async delete(req) {
          return map.delete(req.url);
        }
      };
    }
  };
}

test('BC01 a cached bundle reads again without the network, and a rebuilt one is not served stale', async () => {
  const caches = fakeCaches();
  const cache = await openBrowserBundleCache('game-assets', caches);
  const file = writeAssetBundle([
    { name: 'a.txt', bytes: new TextEncoder().encode('first') },
    { name: 'b.bin', bytes: new Uint8Array(9000).fill(3) }
  ]);
  let online = true,
    requests = 0;
  const fetch = async (url, init = {}) => {
    requests++;
    if (!online) throw new TypeError('Failed to fetch');
    const m = /bytes=(\d+)-(\d+)/.exec(init.headers?.Range ?? '');
    if (!m) return new Response(file.slice());
    const start = +m[1],
      end = Math.min(+m[2], file.length - 1);
    return new Response(file.slice(start, end + 1), {
      status: 206,
      headers: { 'Content-Range': `bytes ${start}-${end}/${file.length}` }
    });
  };
  const bundle = await openBrowserAssetBundle('level.pack', { fetch, cache });
  assert.equal(new TextDecoder().decode(await bundle.get('a.txt')), 'first');
  online = false;
  requests = 0;
  const offline = await openBrowserAssetBundle('level.pack', { fetch, cache });
  assert.equal(offline.offline, true);
  assert.equal(new TextDecoder().decode(await offline.get('a.txt')), 'first');
  await assert.rejects(offline.get('b.bin'), { code: 'ASSET_BUNDLE_FETCH_FAILED' }, 'never read, so not kept');
  // A rebuilt bundle changes the checksum, so the old bytes are not used.
  online = true;
  const rebuilt = writeAssetBundle([{ name: 'a.txt', bytes: new TextEncoder().encode('second') }]);
  const fetch2 = async (url, init = {}) => {
    const m = /bytes=(\d+)-(\d+)/.exec(init.headers?.Range ?? '');
    const start = +m[1],
      end = Math.min(+m[2], rebuilt.length - 1);
    return new Response(rebuilt.slice(start, end + 1), {
      status: 206,
      headers: { 'Content-Range': `bytes ${start}-${end}/${rebuilt.length}` }
    });
  };
  const fresh = await openBrowserAssetBundle('level.pack', { fetch: fetch2, cache });
  assert.equal(fresh.offline, false);
  assert.equal(new TextDecoder().decode(await fresh.get('a.txt')), 'second');
  const removed = await cache.prune(['other.pack']);
  assert.ok(removed >= 3);
  const none = await openBrowserBundleCache('x', {
    open: async () => {
      throw new Error('no caches');
    }
  });
  assert.equal(await none.match('k'), undefined);
});
