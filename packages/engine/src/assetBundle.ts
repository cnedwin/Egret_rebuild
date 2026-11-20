// SPDX-License-Identifier: Apache-2.0
// Many asset files in one: models, pictures and sounds a level needs, fetched
// as one file instead of hundreds, or a part of it at a time where the host
// serves byte ranges. The file is a short header, a JSON index of names,
// offsets, sizes, types and checksums, and the bytes of every entry one after
// the other. `writeAssetBundle` makes one (in a build script or a page), and
// `readAssetBundleIndex` with `sliceAssetBundle` read one; the browser kit
// fetches them.
import { EgretError } from '@egret/runtime';

/** One file to put in a bundle. */
export interface AssetBundleInput {
  /** A path-like name, unique in the bundle: `models/hero-high.glb`. */
  readonly name: string;
  readonly bytes: Uint8Array;
  /** A media type, kept for the reader: `model/gltf-binary`, `image/webp`. */
  readonly type?: string;
  /** Free labels a game can filter by, such as a quality tier or a level. */
  readonly tags?: readonly string[];
}
/** One file in an asset bundle: its name, where its bytes are, its type and tags, and its check. */
export interface AssetBundleEntry {
  readonly name: string;
  /** Bytes from the start of the bundle file. */
  readonly offset: number;
  readonly size: number;
  readonly type: string;
  readonly tags: readonly string[];
  /** FNV-1a 32-bit of the bytes, as eight hex digits: a quick check that a range came back whole. */
  readonly check: string;
}
/** The table of an asset bundle: its size, where its data begins, and its entries. */
export interface AssetBundleIndex {
  readonly version: 1;
  /** Bytes of the whole file. */
  readonly size: number;
  /** Bytes before the first entry: the header and the index. */
  readonly dataOffset: number;
  readonly entries: readonly AssetBundleEntry[];
}

const MAGIC = [0x45, 0x47, 0x50, 0x4b]; // EGPK
const HEADER = 12;
const MAX_ENTRIES = 65536;
const MAX_INDEX = 16 * 1024 * 1024;
const ALIGN = 4;

// Every runtime the engine runs in has the text codecs; the DOM-free build does not declare them.
interface TextCodecs {
  readonly TextEncoder: new () => { encode(text: string): Uint8Array };
  readonly TextDecoder: new (label: string, options: { fatal: boolean }) => { decode(bytes: Uint8Array): string };
}
const codecs = globalThis as unknown as TextCodecs;

const fail = (code: string, detail: string): never => {
  throw new EgretError(code, { cause: new TypeError(detail) });
};

/** FNV-1a over the bytes, as eight hex digits. */
export function assetBundleCheck(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i]!, 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** One file holding every input, in the order given, each starting at a multiple of four bytes. */
export function writeAssetBundle(inputs: readonly AssetBundleInput[]): Uint8Array<ArrayBuffer> {
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > MAX_ENTRIES)
    fail('ASSET_BUNDLE_INVALID', 'entries');
  const names = new Set<string>();
  for (const input of inputs) {
    if (
      !input ||
      typeof input.name !== 'string' ||
      !/^[A-Za-z0-9_.\-]+(?:\/[A-Za-z0-9_.\-]+)*$/.test(input.name) ||
      input.name.split('/').some(part => part === '.' || part === '..') ||
      input.name.length > 512
    )
      fail('ASSET_BUNDLE_INVALID', 'name ' + String(input?.name));
    if (names.has(input.name)) fail('ASSET_BUNDLE_INVALID', 'duplicate ' + input.name);
    names.add(input.name);
    if (!(input.bytes instanceof Uint8Array)) fail('ASSET_BUNDLE_INVALID', 'bytes of ' + input.name);
    if (input.type !== undefined && (typeof input.type !== 'string' || input.type.length > 200))
      fail('ASSET_BUNDLE_INVALID', 'type of ' + input.name);
    if (input.tags !== undefined && (!Array.isArray(input.tags) || !input.tags.every(t => typeof t === 'string')))
      fail('ASSET_BUNDLE_INVALID', 'tags of ' + input.name);
  }
  // The index records offsets, which depend on its own length: lay it out until the length settles.
  let dataOffset = HEADER,
    indexBytes: Uint8Array = new Uint8Array(0),
    entries: AssetBundleEntry[] = [];
  for (let round = 0; round < 4; round++) {
    let at = dataOffset;
    entries = inputs.map(input => {
      const entry: AssetBundleEntry = {
        name: input.name,
        offset: at,
        size: input.bytes.length,
        type: input.type ?? 'application/octet-stream',
        tags: [...(input.tags ?? [])],
        check: assetBundleCheck(input.bytes)
      };
      at += Math.ceil(input.bytes.length / ALIGN) * ALIGN;
      return entry;
    });
    const index: AssetBundleIndex = { version: 1, size: at, dataOffset, entries };
    indexBytes = new codecs.TextEncoder().encode(JSON.stringify(index));
    const next = Math.ceil((HEADER + indexBytes.length) / ALIGN) * ALIGN;
    if (next === dataOffset) break;
    dataOffset = next;
  }
  if (indexBytes.length > MAX_INDEX) fail('ASSET_BUNDLE_INVALID', 'index too large');
  const last = entries[entries.length - 1]!;
  const total = last.offset + Math.ceil(last.size / ALIGN) * ALIGN;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set(MAGIC, 0);
  view.setUint32(4, 1, true);
  view.setUint32(8, indexBytes.length, true);
  out.set(indexBytes, HEADER);
  inputs.forEach((input, i) => out.set(input.bytes, entries[i]!.offset));
  return out;
}

/** How many bytes from the start must be read to know the index's length: the header. */
export const ASSET_BUNDLE_HEADER_BYTES = HEADER;

/** The index length a header gives, so a reader can ask for exactly the bytes of the index. */
export function readAssetBundleHeader(head: Uint8Array): { readonly indexBytes: number } {
  if (!(head instanceof Uint8Array) || head.length < HEADER || MAGIC.some((b, i) => head[i] !== b))
    fail('ASSET_BUNDLE_FORMAT_INVALID', 'not a bundle');
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  if (view.getUint32(4, true) !== 1) fail('ASSET_BUNDLE_FORMAT_INVALID', 'version');
  const indexBytes = view.getUint32(8, true);
  if (indexBytes < 2 || indexBytes > MAX_INDEX) fail('ASSET_BUNDLE_FORMAT_INVALID', 'index length');
  return { indexBytes };
}

/** The index of a bundle from its first bytes: at least the header and the index. */
export function readAssetBundleIndex(head: Uint8Array): AssetBundleIndex {
  const { indexBytes } = readAssetBundleHeader(head);
  if (head.length < HEADER + indexBytes) fail('ASSET_BUNDLE_FORMAT_INVALID', 'index cut short');
  let index: AssetBundleIndex;
  try {
    index = JSON.parse(
      new codecs.TextDecoder('utf-8', { fatal: true }).decode(head.subarray(HEADER, HEADER + indexBytes))
    );
  } catch (cause) {
    throw new EgretError('ASSET_BUNDLE_FORMAT_INVALID', { cause });
  }
  if (
    !index ||
    index.version !== 1 ||
    !Number.isSafeInteger(index.size) ||
    !Number.isSafeInteger(index.dataOffset) ||
    index.dataOffset < HEADER + indexBytes ||
    !Array.isArray(index.entries) ||
    index.entries.length > MAX_ENTRIES
  )
    fail('ASSET_BUNDLE_FORMAT_INVALID', 'index');
  let end = index.dataOffset;
  const names = new Set<string>();
  for (const entry of index.entries) {
    if (
      typeof entry?.name !== 'string' ||
      names.has(entry.name) ||
      !Number.isSafeInteger(entry.offset) ||
      !Number.isSafeInteger(entry.size) ||
      entry.offset < end ||
      entry.size < 0 ||
      entry.offset + entry.size > index.size ||
      typeof entry.type !== 'string' ||
      !Array.isArray(entry.tags) ||
      typeof entry.check !== 'string'
    )
      fail('ASSET_BUNDLE_FORMAT_INVALID', 'entry ' + String(entry?.name));
    names.add(entry.name);
    end = entry.offset + entry.size;
  }
  return Object.freeze({
    ...index,
    entries: Object.freeze(index.entries.map(e => Object.freeze({ ...e, tags: Object.freeze([...e.tags]) })))
  });
}

/**
 * The bytes of one entry from bytes of the bundle that start at `start` (0 for the whole file), checked against
 * the index. The result shares memory with `bytes`.
 */
export function sliceAssetBundle(index: AssetBundleIndex, name: string, bytes: Uint8Array, start = 0): Uint8Array {
  const entry = index.entries.find(e => e.name === name);
  if (!entry) return fail('ASSET_BUNDLE_ENTRY_MISSING', name);
  const from = entry.offset - start;
  if (from < 0 || from + entry.size > bytes.length) fail('ASSET_BUNDLE_RANGE_INVALID', name);
  const slice = bytes.subarray(from, from + entry.size);
  if (assetBundleCheck(slice) !== entry.check) fail('ASSET_BUNDLE_CHECK_FAILED', name);
  return slice;
}

/** Ranges of the file that hold the named entries, joined where they touch or lie within `gap` bytes. */
export function planAssetBundleRanges(
  index: AssetBundleIndex,
  names: readonly string[],
  gap = 64 * 1024
): { readonly start: number; readonly end: number; readonly names: readonly string[] }[] {
  const wanted = names.map(
    name => index.entries.find(e => e.name === name) ?? fail('ASSET_BUNDLE_ENTRY_MISSING', name)
  );
  wanted.sort((a, b) => a.offset - b.offset);
  const ranges: { start: number; end: number; names: string[] }[] = [];
  for (const entry of wanted) {
    const last = ranges[ranges.length - 1];
    const end = entry.offset + entry.size;
    if (last && entry.offset - last.end <= gap) {
      last.end = Math.max(last.end, end);
      last.names.push(entry.name);
    } else ranges.push({ start: entry.offset, end, names: [entry.name] });
  }
  return ranges;
}
