// SPDX-License-Identifier: Apache-2.0
// Reads an asset bundle over HTTP. Where the host serves byte ranges, only the
// header, the index and the entries asked for are fetched, neighbouring ones in
// one request; where it does not (a static host that ignores Range), the whole
// file is fetched once and kept. Entries are checked against the index.
import { EgretError } from '@egret/runtime';
import {
  ASSET_BUNDLE_HEADER_BYTES,
  planAssetBundleRanges,
  readAssetBundleHeader,
  readAssetBundleIndex,
  sliceAssetBundle
} from '@egret/engine/kit';
import type { AssetBundleEntry, AssetBundleIndex } from '@egret/engine/kit';

/** An asset bundle to open: how it is fetched and from where, whether it is read whole, and the cache it is kept in. */
export interface BrowserAssetBundleOptions {
  /** `fetch` by default; tests and service workers give their own. */
  readonly fetch?: (
    url: string,
    init?: { headers?: Record<string, string>; signal?: AbortSignal }
  ) => Promise<Response>;
  readonly signal?: AbortSignal;
  /** Fetch the whole file at once instead of by ranges. */
  readonly whole?: boolean;
  /**
   * Keeps the index and every entry read, so the bundle opens and reads again without the network. Entries are
   * kept by the bundle's address and their checksums, so a rebuilt bundle never serves an old one.
   * `openBrowserBundleCache` makes one.
   */
  readonly cache?: {
    match(key: string): Promise<Uint8Array | undefined>;
    put(key: string, bytes: Uint8Array): Promise<void>;
  };
}
/** An asset bundle opened in the browser: its index and entries, and calls that read an entry's bytes. */
export interface BrowserAssetBundle {
  readonly url: string;
  readonly index: AssetBundleIndex;
  /** True when the host answered byte ranges; false when the whole file was fetched. */
  readonly ranged: boolean;
  /** Entries whose tags include every tag given. */
  entries(...tags: string[]): readonly AssetBundleEntry[];
  /** The bytes of each named entry, fetched in as few requests as their places allow. */
  read(names: readonly string[]): Promise<Map<string, Uint8Array>>;
  /** The bytes of one entry. */
  get(name: string): Promise<Uint8Array>;
  /** Bytes fetched so far. */
  readonly transferred: number;
  /** True when the index came from the cache because the bundle could not be fetched. */
  readonly offline: boolean;
}

/** Opens the bundle at `url`, reading its index. */
export async function openBrowserAssetBundle(
  url: string,
  options: BrowserAssetBundleOptions = {}
): Promise<BrowserAssetBundle> {
  if (typeof url !== 'string' || url === '') throw new EgretError('ASSET_BUNDLE_INVALID');
  const get = options.fetch ?? ((u, init) => fetch(u, init as RequestInit));
  let transferred = 0;
  let whole: Uint8Array | undefined;
  const signal = options.signal;
  const body = async (response: Response): Promise<Uint8Array> => {
    const bytes = new Uint8Array(await response.arrayBuffer());
    transferred += bytes.length;
    return bytes;
  };
  const fetchWhole = async (): Promise<Uint8Array> => {
    const response = await get(url, signal ? { signal } : {});
    if (!response.ok) throw new EgretError('ASSET_BUNDLE_FETCH_FAILED', { cause: new Error(String(response.status)) });
    return body(response);
  };
  // Asks for bytes [start, end); returns them with where they start, or the whole file when the host ignored Range.
  const fetchRange = async (start: number, end: number): Promise<{ bytes: Uint8Array; start: number }> => {
    if (whole) return { bytes: whole, start: 0 };
    const response = await get(url, { headers: { Range: `bytes=${start}-${end - 1}` }, ...(signal ? { signal } : {}) });
    if (response.status === 206) {
      const bytes = await body(response);
      const range = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(response.headers.get('Content-Range') ?? '');
      const from = range ? Number(range[1]) : start;
      // A file shorter than the range asked for ends the answer early: that is the whole of what was asked.
      const total = range && range[3] !== '*' ? Number(range[3]) : undefined;
      const reachesEnd = total !== undefined && from + bytes.length === total;
      if (from > start || (from + bytes.length < end && !reachesEnd))
        throw new EgretError('ASSET_BUNDLE_RANGE_INVALID', {
          cause: new Error(`asked ${start}-${end}, got ${from}+${bytes.length}`)
        });
      return { bytes, start: from };
    }
    if (response.ok) {
      whole = await body(response);
      return { bytes: whole, start: 0 };
    }
    throw new EgretError('ASSET_BUNDLE_FETCH_FAILED', { cause: new Error(String(response.status)) });
  };

  const cache = options.cache;
  const indexKey = url + '#index';
  const openIndex = async (): Promise<AssetBundleIndex> => {
    if (options.whole) {
      whole = await fetchWhole();
      return readAssetBundleIndex(whole);
    }
    // The header and a guess at the index in one request; a second when the index is longer.
    const guess = 64 * 1024;
    const first = await fetchRange(0, guess);
    if (first.bytes.length < ASSET_BUNDLE_HEADER_BYTES) throw new EgretError('ASSET_BUNDLE_FORMAT_INVALID');
    const { indexBytes } = readAssetBundleHeader(first.bytes);
    let head = first.bytes;
    if (head.length < ASSET_BUNDLE_HEADER_BYTES + indexBytes)
      head = (await fetchRange(0, ASSET_BUNDLE_HEADER_BYTES + indexBytes)).bytes;
    const read = readAssetBundleIndex(head);
    await cache?.put(indexKey, head.slice(0, ASSET_BUNDLE_HEADER_BYTES + indexBytes));
    return read;
  };
  let index: AssetBundleIndex;
  let offline = false;
  try {
    index = await openIndex();
  } catch (cause) {
    // Without the network a kept index still opens the bundle; entries then come only from the cache.
    const kept = cache && (await cache.match(indexKey));
    if (!kept || (cause instanceof EgretError && cause.code === 'ASSET_BUNDLE_FORMAT_INVALID')) throw cause;
    index = readAssetBundleIndex(kept);
    offline = true;
  }
  const entryKey = (name: string): string => {
    const entry = index.entries.find(e => e.name === name);
    return url + '#' + name + '@' + (entry?.check ?? '');
  };

  const read = async (names: readonly string[]): Promise<Map<string, Uint8Array>> => {
    const out = new Map<string, Uint8Array>();
    const missing: string[] = [];
    for (const name of names) {
      const kept = cache && (await cache.match(entryKey(name)));
      // A kept entry is checked like a fetched one, so a damaged cache is fetched past.
      if (kept) {
        try {
          out.set(name, sliceAssetBundle(index, name, kept, index.entries.find(e => e.name === name)!.offset));
          continue;
        } catch {
          /* fetched again below */
        }
      }
      missing.push(name);
    }
    if (missing.length && offline) throw new EgretError('ASSET_BUNDLE_FETCH_FAILED', { cause: new Error('offline') });
    for (const range of planAssetBundleRanges(index, missing)) {
      const got = await fetchRange(range.start, range.end);
      for (const name of range.names) {
        const bytes = sliceAssetBundle(index, name, got.bytes, got.start);
        out.set(name, bytes);
        await cache?.put(entryKey(name), bytes);
      }
    }
    return out;
  };
  return {
    url,
    index,
    get ranged() {
      return whole === undefined;
    },
    get transferred() {
      return transferred;
    },
    get offline() {
      return offline;
    },
    entries: (...tags) => index.entries.filter(entry => tags.every(tag => entry.tags.includes(tag))),
    read,
    async get(name) {
      return (await read([name])).get(name)!;
    }
  };
}
