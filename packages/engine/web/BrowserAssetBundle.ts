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

export interface BrowserAssetBundleOptions {
  /** `fetch` by default; tests and service workers give their own. */
  readonly fetch?: (
    url: string,
    init?: { headers?: Record<string, string>; signal?: AbortSignal }
  ) => Promise<Response>;
  readonly signal?: AbortSignal;
  /** Fetch the whole file at once instead of by ranges. */
  readonly whole?: boolean;
}
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
      if (from > start || from + bytes.length < end)
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

  let index: AssetBundleIndex;
  if (options.whole) {
    whole = await fetchWhole();
    index = readAssetBundleIndex(whole);
  } else {
    // The header and a guess at the index in one request; a second when the index is longer.
    const guess = 64 * 1024;
    const first = await fetchRange(0, guess);
    if (first.bytes.length < ASSET_BUNDLE_HEADER_BYTES) throw new EgretError('ASSET_BUNDLE_FORMAT_INVALID');
    const { indexBytes } = readAssetBundleHeader(first.bytes);
    let head = first.bytes;
    if (head.length < ASSET_BUNDLE_HEADER_BYTES + indexBytes)
      head = (await fetchRange(0, ASSET_BUNDLE_HEADER_BYTES + indexBytes)).bytes;
    index = readAssetBundleIndex(head);
  }

  const read = async (names: readonly string[]): Promise<Map<string, Uint8Array>> => {
    const out = new Map<string, Uint8Array>();
    for (const range of planAssetBundleRanges(index, names)) {
      const got = await fetchRange(range.start, range.end);
      for (const name of range.names) out.set(name, sliceAssetBundle(index, name, got.bytes, got.start));
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
    entries: (...tags) => index.entries.filter(entry => tags.every(tag => entry.tags.includes(tag))),
    read,
    async get(name) {
      return (await read([name])).get(name)!;
    }
  };
}
