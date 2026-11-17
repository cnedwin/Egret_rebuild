// SPDX-License-Identifier: Apache-2.0
// Browser storage for what local storage cannot hold: saves larger than a few
// megabytes, kept in IndexedDB, and asset bundle entries kept in the Cache API
// so a game opens again without the network.
import { EgretError } from '@egret/runtime';
import type { SaveStorage } from '@egret/engine/kit';

export interface IndexedDBSaveStorage extends SaveStorage {
  /** Resolves when every write so far has reached the database; rejects with the first that failed. */
  flush(): Promise<void>;
  /** Closes the database; later writes are refused. */
  close(): void;
}
export interface IndexedDBSaveStorageOptions {
  /** The database name; one per game. */
  readonly database: string;
  /** The IndexedDB factory; the page's by default. */
  readonly indexedDB?: IDBFactory;
  /** Told of a write that failed after it was accepted, as when the disk is full. */
  readonly onError?: (cause: unknown) => void;
}

const STORE = 'saves';
const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/**
 * A save storage over IndexedDB. Opening reads every saved string into memory, so `createSaveStore` reads it
 * synchronously as it does local storage; each write goes to memory at once and to the database after.
 */
export async function openIndexedDBSaveStorage(options: IndexedDBSaveStorageOptions): Promise<IndexedDBSaveStorage> {
  if (!options || typeof options.database !== 'string' || options.database === '')
    throw new EgretError('BROWSER_STORAGE_OPTIONS_INVALID');
  const factory = options.indexedDB ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!factory) throw new EgretError('BROWSER_STORAGE_UNAVAILABLE');
  const open = factory.open(options.database, 1);
  open.onupgradeneeded = () => {
    if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
  };
  let db: IDBDatabase;
  try {
    db = await request(open);
  } catch (cause) {
    throw new EgretError('BROWSER_STORAGE_UNAVAILABLE', { cause });
  }
  const memory = new Map<string, string>();
  {
    const tx = db.transaction(STORE, 'readonly'),
      store = tx.objectStore(STORE);
    const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())]);
    keys.forEach((key, i) => {
      if (typeof key === 'string' && typeof values[i] === 'string') memory.set(key, values[i] as string);
    });
  }
  let pending: Promise<void> = Promise.resolve(),
    failure: unknown,
    closed = false;
  const write = (apply: (store: IDBObjectStore) => void): void => {
    if (closed) throw new EgretError('BROWSER_STORAGE_CLOSED');
    if (failure !== undefined) throw failure;
    pending = pending.then(
      () =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite');
          apply(tx.objectStore(STORE));
          tx.oncomplete = () => resolve();
          tx.onerror = tx.onabort = () => reject(tx.error);
        })
    );
    pending = pending.catch(cause => {
      failure ??= new EgretError('BROWSER_STORAGE_WRITE_FAILED', { cause });
      options.onError?.(cause);
    });
  };
  return {
    getItem: key => memory.get(key) ?? null,
    setItem(key, value) {
      // The save store reports a refusal; a later failure is kept and thrown by the next write.
      write(store => store.put(String(value), key));
      memory.set(key, String(value));
    },
    removeItem(key) {
      write(store => store.delete(key));
      memory.delete(key);
    },
    async flush() {
      try {
        await pending;
      } catch {
        /* kept as `failure` */
      }
      if (failure !== undefined) throw failure;
    },
    close() {
      closed = true;
      void pending.finally(() => db.close());
    }
  };
}

/** Where fetched bundle entries are kept between visits; used as `cache` of `openBrowserAssetBundle`. */
export interface BundleCache {
  match(key: string): Promise<Uint8Array | undefined>;
  put(key: string, bytes: Uint8Array): Promise<void>;
  /** Forgets every entry whose key does not start with one of `keep`, as after a new build. */
  prune(keep: readonly string[]): Promise<number>;
}

/**
 * A bundle cache in the Cache API under `name`. Entries are kept by the bundle's address and each entry's
 * checksum, so a rebuilt bundle never serves an old entry. Where the Cache API is missing, every lookup misses.
 */
export async function openBrowserBundleCache(name: string, cacheStorage?: CacheStorage): Promise<BundleCache> {
  if (typeof name !== 'string' || name === '') throw new EgretError('BROWSER_STORAGE_OPTIONS_INVALID');
  const caches = cacheStorage ?? (globalThis as { caches?: CacheStorage }).caches;
  let cache: Cache | undefined;
  try {
    cache = await caches?.open(name);
  } catch {
    cache = undefined;
  }
  const url = (key: string): string => 'https://egret.bundle.cache/' + encodeURIComponent(key);
  return {
    async match(key) {
      const hit = await cache?.match(url(key));
      return hit ? new Uint8Array(await hit.arrayBuffer()) : undefined;
    },
    async put(key, bytes) {
      if (!cache) return;
      try {
        await cache.put(url(key), new Response(bytes.slice()));
      } catch {
        // A full store only means the entry is fetched again next time.
      }
    },
    async prune(keep) {
      if (!cache) return 0;
      let removed = 0;
      for (const req of await cache.keys()) {
        const key = decodeURIComponent(new URL(req.url).pathname.slice(1));
        if (!keep.some(prefix => key.startsWith(prefix))) {
          await cache.delete(req);
          removed++;
        }
      }
      return removed;
    }
  };
}
