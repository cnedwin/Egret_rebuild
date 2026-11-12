// SPDX-License-Identifier: Apache-2.0
import { createStore, del, get, set, update } from 'idb-keyval';
import { IntegrationError } from '../errors.js';

export interface SaveStore<Value> {
    readonly namespace: string;
    get(key: string): Promise<Value | undefined>;
    set(key: string, value: Value): Promise<void>;
    update(key: string, updater: (previous: Value | undefined) => Value): Promise<void>;
    delete(key: string): Promise<void>;
    dispose(): void;
}

type NativeStore = ReturnType<typeof createStore>;
type SaveKey = [namespace: string, key: string];
let sharedStore: NativeStore | undefined;

function requireValue<Value>(value: Value): Value {
    if (value === undefined) {
        throw new IntegrationError('storage', 'invalid-input', 'Undefined is reserved for a missing save.');
    }
    return value;
}

/** Open a logical game namespace in the browser's origin-scoped save database. */
export function createSaveStore<Value = unknown>(namespace: string): SaveStore<Value> {
    if (typeof namespace !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(namespace)) {
        throw new IntegrationError('storage', 'invalid-input', 'Use a nonempty save namespace of up to 128 ASCII letters, digits, dots, hyphens or underscores.');
    }
    try {
        if (typeof globalThis.indexedDB?.open !== 'function') {
            throw new IntegrationError('storage', 'platform-unavailable', 'IndexedDB is unavailable in this host.');
        }
    } catch (cause) {
        if (cause instanceof IntegrationError) throw cause;
        throw new IntegrationError('storage', 'platform-unavailable', 'IndexedDB is unavailable in this host.', { cause });
    }

    // IndexedDB owns the shared connection. A handle owns only its future access, not the database.
    const store = sharedStore ??= createStore('egret-integrations-saves-v1', 'saves');
    let disposed = false;

    async function execute<Result>(key: string, operation: (identity: SaveKey) => Promise<Result>): Promise<Result> {
        if (disposed) throw new IntegrationError('storage', 'disposed', 'The save store handle has been disposed.');
        if (typeof key !== 'string' || key.length === 0 || key.length > 256) {
            throw new IntegrationError('storage', 'invalid-input', 'Use a nonempty save key of up to 256 characters.');
        }
        try {
            return await operation([namespace, key]);
        } catch (cause) {
            if (cause instanceof IntegrationError) throw cause;
            const code = cause instanceof DOMException && cause.name === 'DataCloneError'
                ? 'invalid-input'
                : 'operation-failed';
            throw new IntegrationError('storage', code, 'The IndexedDB save operation failed.', { cause });
        }
    }

    return Object.freeze({
        namespace,
        get: (key: string) => execute(key, (identity) => get<Value>(identity, store)),
        set: (key: string, value: Value) => execute(key, (identity) => set(identity, requireValue(value), store)),
        update: (key: string, updater: (previous: Value | undefined) => Value) => execute(key, (identity) => {
            if (typeof updater !== 'function') {
                throw new IntegrationError('storage', 'invalid-input', 'A synchronous save updater is required.');
            }
            // The native read and write belong to the same IndexedDB transaction.
            return update<Value>(identity, (previous) => requireValue(updater(previous)), store);
        }),
        delete: (key: string) => execute(key, (identity) => del(identity, store)),
        dispose() { disposed = true; },
    });
}
