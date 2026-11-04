// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { DisplayObjectContainer } from '@egret/runtime';
import type { KeyboardInput, KeyboardTargetRegistration, KeyboardFocusOptions } from '../keyboardInputTypes.js';
export interface KeyboardRow {
    readonly key: string;
    readonly content: DisplayObjectContainer;
    readonly visible: boolean;
}
/** Owns registrations only. The application retains the channel and its native bridge. */
export function createUiKeyboardFocus(input: KeyboardInput, prefix: string) {
    if (typeof prefix !== 'string' || prefix.length < 1 || prefix.length > 48 || prefix.includes('\0'))
        throw new EgretError('UI_KEYBOARD_ID_INVALID');
    const records = new Map<string, { target: DisplayObjectContainer; registration: KeyboardTargetRegistration }>();
    let closed = false;
    function id(key: string): string { return prefix + ':' + key; }
    function validate(keys: Iterable<string>): void {
        for (const key of keys) if (id(key).length > 128 || key.includes('\0')) throw new EgretError('UI_KEYBOARD_ID_INVALID');
    }
    function getFocus() {
        const snapshot = input.getSnapshot();
        const key = [...records.keys()].find(key => id(key) === snapshot.focusedId);
        return Object.freeze({ key, focusVisible: key !== undefined && snapshot.focusVisible });
    }
    function focus(key: string | undefined, options?: KeyboardFocusOptions): void {
        if (closed) throw new EgretError('UI_KEYBOARD_CLOSED');
        if (key === undefined) { if (getFocus().key !== undefined) input.focus(undefined); return; }
        if (!records.has(key)) throw new EgretError('UI_ROW_NOT_REALIZED');
        input.focus(id(key), options);
    }
    // Cancel while the old target is still attached, before layout changes or callbacks.
    function before(rows: readonly KeyboardRow[]) {
        const previous = getFocus();
        if (previous.key === undefined) return undefined;
        const next = rows.find(row => row.key === previous.key && row.visible);
        if (next?.content === records.get(previous.key)?.target) return undefined;
        input.cancel(next === undefined ? 'removed' : 'rebind');
        return next === undefined ? undefined : previous;
    }
    function dispose(): void {
        if (closed) return;
        closed = true;
        const owned = [...records.values()]; records.clear();
        let failure: unknown;
        for (const value of owned) try { value.registration.dispose(); } catch (cause) { failure ??= cause; }
        if (failure !== undefined) throw failure;
    }
    function commit(rows: readonly KeyboardRow[], restore: ReturnType<typeof before>): void {
        if (closed) return;
        if (input.getSnapshot().state === 'closed') { dispose(); return; }
        try {
            const visible = rows.filter(row => row.visible), keys = new Set(visible.map(row => row.key));
            for (const [key, value] of records) if (!keys.has(key)) { records.delete(key); value.registration.dispose(); }
            for (let index = 0; index < visible.length && !closed; index++) {
                const row = visible[index]!, old = records.get(row.key), tabIndex = index + 1;
                if (old === undefined) {
                    const registration = input.registerTarget({ id: id(row.key), target: row.content, tabIndex });
                    records.set(row.key, { target: row.content, registration });
                } else {
                    old.registration.update({ target: row.content, tabIndex }); old.target = row.content;
                }
            }
            input.sync();
            if (!closed && restore !== undefined && input.getSnapshot().state === 'active' && input.getSnapshot().focusedId === undefined && records.has(restore.key!)) {
                try { input.focus(id(restore.key!), { visible: restore.focusVisible }); }
                catch (cause) {
                    // A replacement can be authored hidden. Keep the other rows available;
                    // callback failures close the channel and are not eligibility refusals.
                    if (!(cause instanceof EgretError && cause.code === 'KEYBOARD_TARGET_INELIGIBLE' && input.getSnapshot().state === 'active')) throw cause;
                }
            }
        } catch (cause) {
            // Fail closed for this panel, preserving unrelated registrations and the original error.
            try { dispose(); } catch { /* The original synchronization error remains authoritative. */ }
            throw new EgretError('UI_KEYBOARD_SYNC_FAILED', { cause });
        }
    }
    return Object.freeze({ validate, getFocus, focus, before, commit, dispose });
}
