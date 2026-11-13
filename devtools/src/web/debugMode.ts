// SPDX-License-Identifier: Apache-2.0
// Debug mode is a page-level switch: ?egretDebug=1 turns it on and remembers
// it, ?egretDebug=0 turns it off again. Nothing is shown without it.

export const DEBUG_QUERY_PARAMETER = 'egretDebug';
export const DEBUG_STORAGE_KEY = 'egret.debug';

export interface DebugModeEnvironment {
    /** The query string of the page, with or without the leading question mark. */
    readonly search?: string;
    readonly storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
}

function pageStorage(): DebugModeEnvironment['storage'] {
    // Reading localStorage throws in some private windows and sandboxed frames.
    try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Decide whether debug tools may appear on this page. */
export function isDebugMode(environment: DebugModeEnvironment = {}): boolean {
    const search = environment.search ?? globalThis.location?.search ?? '';
    const storage = environment.storage === undefined ? pageStorage() : environment.storage;
    const requested = new URLSearchParams(search).get(DEBUG_QUERY_PARAMETER);
    if (requested !== null) {
        const enabled = requested === '1' || requested === 'true' || requested === '';
        try { if (enabled) storage?.setItem(DEBUG_STORAGE_KEY, '1'); else storage?.removeItem(DEBUG_STORAGE_KEY); } catch { /* not remembered */ }
        return enabled;
    }
    try { return storage?.getItem(DEBUG_STORAGE_KEY) === '1'; } catch { return false; }
}
