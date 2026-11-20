// SPDX-License-Identifier: Apache-2.0
// A game's save: settings, progress, unlocked tiers, best marks. It is plain
// data kept under one key, with a version number and the steps that bring an
// older save up to date, so a save from last month's build still loads. A save
// that cannot be read or written never stops the game: the store reports it
// and goes on with the data it has. The storage is given, so the same store
// works over browser storage, a file, or a test's map.
import { EgretError } from '@egret/runtime';

/** Where a save is kept: strings by key. Browser storage is one; `createMemorySaveStorage` is another. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A save to keep: its key and version, its defaults and migrations, its check and its storage. */
export interface SaveStoreOptions<T> {
  /** The key the save is kept under. */
  readonly key: string;
  /** The version this build writes; a whole number from 1. */
  readonly version: number;
  /** The data of a new game; also what a missing or unreadable save becomes. */
  readonly defaults: () => T;
  /**
   * Steps from an older version: `migrations[n]` turns data of version n into version n + 1. A save older than
   * the oldest step, or newer than this build, starts again from the defaults and is kept aside under
   * `<key>.unread` so nothing is lost.
   */
  readonly migrations?: Readonly<Record<number, (data: unknown) => unknown>>;
  /** Checks loaded data; a save that fails it starts from the defaults. Defaults to accepting any object. */
  readonly validate?: (data: unknown) => data is T;
  readonly storage: SaveStorage;
  /** Told of every load or write that did not go as planned. */
  readonly onProblem?: (problem: SaveProblem) => void;
}

/** What went wrong with a save: unreadable, invalid, too new or too old, or a migration or write that failed. */
export type SaveProblemKind = 'unreadable' | 'invalid' | 'too-new' | 'too-old' | 'migration-failed' | 'write-failed';
/** A problem with a save: what kind, which key, and its cause. */
export interface SaveProblem {
  readonly kind: SaveProblemKind;
  readonly key: string;
  readonly cause?: unknown;
}

/** A saved value: read it, change it and save it, reset or remove it, export or import it. */
export interface SaveStore<T> {
  /** The data now: loaded, migrated, or the defaults. */
  readonly data: T;
  /** The version the loaded save had before migration, or undefined for a new game. */
  readonly loadedVersion: number | undefined;
  /**
   * Replaces the data and writes it. Returns false when the storage refused, as when it is full, or when the new
   * data fails `validate`: then it is reported as `invalid` and the data stays as it was.
   */
  save(data?: T): boolean;
  /**
   * Changes the data with `change`, which may edit it in place or return new data, then writes it. What it returns,
   * other than `undefined`, replaces the data only if it passes `validate`, so `data => (data.coins = 5)`, which
   * returns 5, is reported as `invalid` and keeps the save; write such a change as a block, `data => { data.coins = 5; }`.
   * Data edited in place that no longer passes `validate` is reported and not written.
   */
  update(change: (data: T) => T | void): boolean;
  /** Back to the defaults, written. */
  reset(): boolean;
  /** Takes the save out of the storage. The data stays as it was in memory. */
  remove(): void;
  /** The save as a string, for an export button. */
  export(): string;
  /** Loads an exported string, migrating it like a stored save. Returns false and changes nothing when it cannot. */
  import(text: string): boolean;
}

interface Envelope {
  readonly version: number;
  readonly savedAt: string;
  readonly data: unknown;
}

const isObject = (value: unknown): boolean => typeof value === 'object' && value !== null;

/** Opens the save under `options.key`, migrating an older one. */
export function createSaveStore<T>(options: SaveStoreOptions<T>): SaveStore<T> {
  if (!isObject(options)) throw new EgretError('SAVE_STORE_OPTIONS_INVALID');
  const { key, version, defaults, storage } = options;
  if (typeof key !== 'string' || key.length === 0 || key.length > 200)
    throw new EgretError('SAVE_STORE_OPTIONS_INVALID');
  if (!Number.isSafeInteger(version) || version < 1) throw new EgretError('SAVE_STORE_OPTIONS_INVALID');
  if (typeof defaults !== 'function') throw new EgretError('SAVE_STORE_OPTIONS_INVALID');
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function')
    throw new EgretError('SAVE_STORE_OPTIONS_INVALID');
  const migrations = options.migrations ?? {};
  const validate = options.validate ?? ((data: unknown): data is T => isObject(data));
  const report = (kind: SaveProblemKind, cause?: unknown): void => {
    try {
      options.onProblem?.({ kind, key, ...(cause === undefined ? {} : { cause }) });
    } catch {
      /* A failing listener must not break loading. */
    }
  };
  const keepAside = (text: string): void => {
    try {
      storage.setItem(key + '.unread', text);
    } catch {
      /* Nothing more can be done for it. */
    }
  };

  // Reads text into data of this version, or explains why not.
  const read = (text: string): { data: T; from: number } | { problem: SaveProblemKind; cause?: unknown } => {
    let envelope: Envelope;
    try {
      envelope = JSON.parse(text) as Envelope;
    } catch (cause) {
      return { problem: 'unreadable', cause };
    }
    if (!isObject(envelope) || !Number.isSafeInteger(envelope.version) || envelope.version < 1)
      return { problem: 'unreadable' };
    if (envelope.version > version) return { problem: 'too-new' };
    let data = envelope.data;
    for (let at = envelope.version; at < version; at++) {
      const step = migrations[at];
      if (typeof step !== 'function') return { problem: 'too-old' };
      try {
        data = step(data);
      } catch (cause) {
        return { problem: 'migration-failed', cause };
      }
    }
    if (!validate(data)) return { problem: 'invalid' };
    return { data: data as T, from: envelope.version };
  };

  let data: T = defaults();
  let loadedVersion: number | undefined;
  let text: string | null = null;
  try {
    text = storage.getItem(key);
  } catch (cause) {
    report('unreadable', cause);
  }
  if (text !== null) {
    const result = read(text);
    if ('data' in result) {
      data = result.data;
      loadedVersion = result.from;
    } else {
      report(result.problem, result.cause);
      keepAside(text);
    }
  }

  // New data that fails the check is not kept or written: the save on disk stays the last good one.
  const refuse = (value: unknown): false => {
    report(
      'invalid',
      new TypeError(
        'The new save data fails validate' +
          (isObject(value) ? '' : ': it is ' + (value === null ? 'null' : typeof value) + ', not an object') +
          '. A change that edits in place returns nothing; write it as a block.'
      )
    );
    return false;
  };
  const write = (): boolean => {
    try {
      const envelope: Envelope = { version, savedAt: new Date().toISOString(), data };
      storage.setItem(key, JSON.stringify(envelope));
      return true;
    } catch (cause) {
      report('write-failed', cause);
      return false;
    }
  };
  // A migrated save is written back at once in its new form.
  if (loadedVersion !== undefined && loadedVersion < version) write();

  const store: SaveStore<T> = {
    get data() {
      return data;
    },
    get loadedVersion() {
      return loadedVersion;
    },
    save(next?: T): boolean {
      if (next !== undefined) {
        if (!validate(next)) return refuse(next);
        data = next;
      }
      return write();
    },
    update(change: (current: T) => T | void): boolean {
      if (typeof change !== 'function') throw new EgretError('SAVE_STORE_OPTIONS_INVALID');
      const result = change(data);
      if (result !== undefined) {
        if (!validate(result)) return refuse(result);
        data = result;
      } else if (!validate(data)) return refuse(data);
      return write();
    },
    reset(): boolean {
      data = defaults();
      return write();
    },
    remove(): void {
      try {
        storage.removeItem(key);
      } catch (cause) {
        report('write-failed', cause);
      }
    },
    export(): string {
      return JSON.stringify({ version, savedAt: new Date().toISOString(), data });
    },
    import(imported: string): boolean {
      if (typeof imported !== 'string') return false;
      const result = read(imported);
      if (!('data' in result)) {
        report(result.problem, result.cause);
        return false;
      }
      data = result.data;
      return write();
    }
  };
  return store;
}

/** Storage kept in memory: for tests, for a page without browser storage, or for a game played once. */
export function createMemorySaveStorage(initial: Readonly<Record<string, string>> = {}): SaveStorage & {
  readonly entries: ReadonlyMap<string, string>;
} {
  const entries = new Map(Object.entries(initial));
  return {
    entries,
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, String(value)),
    removeItem: key => void entries.delete(key)
  };
}
