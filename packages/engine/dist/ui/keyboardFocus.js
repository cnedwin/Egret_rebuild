// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
/**
 * Owns registrations only. The application retains the channel and its native bridge.
 *
 * Without `tabStop` every row that shows is a stop of its own, in the order of the rows. With it
 * the rows are one stop of that index: Tab enters at the row that last held the focus, or at the
 * first that shows, and leaves the list from there.
 */
export function createUiKeyboardFocus(input, prefix, tabStop) {
    if (typeof prefix !== 'string' || prefix.length < 1 || prefix.length > 48 || prefix.includes('\0'))
        throw new EgretError('UI_KEYBOARD_ID_INVALID');
    if (tabStop !== undefined && (!Number.isInteger(tabStop) || tabStop < 0 || tabStop > 32767))
        throw new EgretError('UI_KEYBOARD_STOP_INVALID');
    const records = new Map();
    let closed = false;
    /** The row that is the stop of the list, where the list is one stop. */
    let holder;
    function id(key) {
        return prefix + ':' + key;
    }
    /** Moves the one stop to a row that is registered. The other rows are reached by the application, not by Tab. */
    function hold(key) {
        if (tabStop === undefined || holder === key)
            return;
        const previous = holder === undefined ? undefined : records.get(holder);
        holder = key;
        previous?.registration.update({ tabIndex: -1 });
        records.get(key).registration.update({ tabIndex: tabStop });
    }
    function validate(keys) {
        for (const key of keys)
            if (id(key).length > 128 || key.includes('\0'))
                throw new EgretError('UI_KEYBOARD_ID_INVALID');
    }
    function getFocus() {
        const snapshot = input.getSnapshot();
        const key = [...records.keys()].find(key => id(key) === snapshot.focusedId);
        return Object.freeze({ key, focusVisible: key !== undefined && snapshot.focusVisible });
    }
    function focus(key, options) {
        if (closed)
            throw new EgretError('UI_KEYBOARD_CLOSED');
        if (key === undefined) {
            if (getFocus().key !== undefined)
                input.focus(undefined);
            return;
        }
        if (!records.has(key))
            throw new EgretError('UI_ROW_NOT_REALIZED');
        input.focus(id(key), options);
        // A listener of the focus may have closed the root: its rows are gone then.
        if (records.has(key))
            hold(key);
    }
    // Cancel while the old target is still attached, before layout changes or callbacks.
    function before(rows) {
        const previous = getFocus();
        if (previous.key === undefined)
            return undefined;
        const next = rows.find(row => row.key === previous.key && row.visible);
        if (next?.content === records.get(previous.key)?.target)
            return undefined;
        input.cancel(next === undefined ? 'removed' : 'rebind');
        return next === undefined ? undefined : previous;
    }
    function dispose() {
        if (closed)
            return;
        closed = true;
        const owned = [...records.values()];
        records.clear();
        let failure;
        for (const value of owned)
            try {
                value.registration.dispose();
            }
            catch (cause) {
                failure ??= cause;
            }
        if (failure !== undefined)
            throw failure;
    }
    function commit(rows, restore) {
        if (closed)
            return;
        if (input.getSnapshot().state === 'closed') {
            dispose();
            return;
        }
        try {
            const visible = rows.filter(row => row.visible), keys = new Set(visible.map(row => row.key));
            for (const [key, value] of records)
                if (!keys.has(key)) {
                    records.delete(key);
                    value.registration.dispose();
                }
            if (tabStop !== undefined) {
                // The stop stays with the row that holds the focus, then with the row that held it, then goes to the first that shows.
                holder =
                    getFocus().key ?? restore?.key ?? (holder !== undefined && keys.has(holder) ? holder : visible[0]?.key);
            }
            for (let index = 0; index < visible.length && !closed; index++) {
                const row = visible[index], old = records.get(row.key), tabIndex = tabStop === undefined ? index + 1 : row.key === holder ? tabStop : -1;
                if (old === undefined) {
                    const registration = input.registerTarget({ id: id(row.key), target: row.content, tabIndex });
                    records.set(row.key, { target: row.content, registration });
                }
                else {
                    old.registration.update({ target: row.content, tabIndex });
                    old.target = row.content;
                }
            }
            input.sync();
            if (!closed &&
                restore !== undefined &&
                input.getSnapshot().state === 'active' &&
                input.getSnapshot().focusedId === undefined &&
                records.has(restore.key)) {
                try {
                    input.focus(id(restore.key), { visible: restore.focusVisible });
                }
                catch (cause) {
                    // A replacement can be authored hidden. Keep the other rows available;
                    // callback failures close the channel and are not eligibility refusals.
                    if (!(cause instanceof EgretError &&
                        cause.code === 'KEYBOARD_TARGET_INELIGIBLE' &&
                        input.getSnapshot().state === 'active'))
                        throw cause;
                }
            }
        }
        catch (cause) {
            // Fail closed for this panel, preserving unrelated registrations and the original error.
            try {
                dispose();
            }
            catch {
                /* The original synchronization error remains authoritative. */
            }
            throw new EgretError('UI_KEYBOARD_SYNC_FAILED', { cause });
        }
    }
    return Object.freeze({ validate, getFocus, focus, before, commit, dispose });
}
//# sourceMappingURL=keyboardFocus.js.map