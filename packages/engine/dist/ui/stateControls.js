// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import { createActionControl } from './controls.js';
const MAX_DEPTH = 4096;
function record(options) {
    if (options === null || typeof options !== 'object' || Array.isArray(options))
        throw new EgretError('UI_CONTROL_OPTIONS');
    return options;
}
function displayTarget(value) {
    if (value === null || typeof value !== 'object' || typeof value.on !== 'function')
        throw new EgretError('UI_CONTROL_OPTIONS');
    return value;
}
function callback(value) {
    if (value !== undefined && typeof value !== 'function')
        throw new EgretError('UI_CONTROL_OPTIONS');
    return value;
}
/** Whether a display object is the root of a subtree or inside it. */
function within(root, node) {
    let current = node;
    for (let depth = 0; current !== undefined && depth < MAX_DEPTH; depth++) {
        if (current === root)
            return true;
        current = current.parent;
    }
    return false;
}
export function createHoverControl(options) {
    const { hover, onHoverChange } = record(options);
    const target = displayTarget(options.target);
    if (hover === null ||
        typeof hover !== 'object' ||
        typeof hover.observe !== 'function' ||
        hover.events === null ||
        typeof hover.events !== 'object')
        throw new EgretError('UI_CONTROL_OPTIONS');
    callback(onHoverChange);
    // The pointers that are over the control or over one of its descendants.
    const inside = new Set();
    let closed = false, enabled = true, reported = false;
    function publish() {
        const next = enabled && !closed && inside.size > 0;
        if (next === reported)
            return;
        reported = next;
        onHoverChange?.(next);
    }
    const subscriptions = [
        target.on(hover.events.enter, event => {
            if (closed)
                return;
            inside.add(event.payload.pointerId);
            publish();
        }),
        // A pointer that goes from one descendant to another has not left the control.
        target.on(hover.events.leave, event => {
            if (closed || within(target, event.payload.related))
                return;
            inside.delete(event.payload.pointerId);
            publish();
        }),
        // A target that has left the stage receives no event. The stream of the input still says its hover ended.
        hover.observe(notification => {
            if (closed ||
                notification.kind !== 'leave' ||
                !inside.has(notification.point.pointerId) ||
                within(target, notification.related))
                return;
            inside.delete(notification.point.pointerId);
            publish();
        })
    ];
    return Object.freeze({
        get hovered() {
            return reported;
        },
        get enabled() {
            return enabled;
        },
        setEnabled(next) {
            if (closed)
                throw new EgretError('UI_CONTROL_CLOSED');
            if (typeof next !== 'boolean')
                throw new EgretError('UI_CONTROL_OPTIONS');
            if (enabled === next)
                return;
            // The pointer may still be over a disabled control; enabling it again finds it there.
            enabled = next;
            publish();
        },
        dispose() {
            if (closed)
                return;
            closed = true;
            let failure;
            try {
                publish();
            }
            catch (cause) {
                failure = cause;
            }
            finally {
                inside.clear();
                for (const unsubscribe of subscriptions)
                    try {
                        unsubscribe();
                    }
                    catch (cause) {
                        failure ??= cause;
                    }
            }
            if (failure !== undefined)
                throw failure;
        }
    });
}
export function createToggleControl(options) {
    const { input, target, onChange, onPressChange } = record(options);
    let checked = options.checked ?? false;
    if (typeof checked !== 'boolean')
        throw new EgretError('UI_CONTROL_OPTIONS');
    callback(onChange);
    callback(onPressChange);
    function set(next) {
        if (checked === next)
            return;
        checked = next;
        onChange?.(next);
    }
    const action = createActionControl({
        input,
        target,
        onActivate: () => set(!checked),
        ...(onPressChange === undefined ? {} : { onPressChange })
    });
    let closed = false;
    function open() {
        if (closed)
            throw new EgretError('UI_CONTROL_CLOSED');
    }
    return Object.freeze({
        get checked() {
            return checked;
        },
        get pressed() {
            return action.pressed;
        },
        get enabled() {
            return action.enabled;
        },
        toggle() {
            open();
            if (action.enabled)
                set(!checked);
        },
        setChecked(next) {
            open();
            if (typeof next !== 'boolean')
                throw new EgretError('UI_CONTROL_OPTIONS');
            set(next);
        },
        press() {
            action.press();
        },
        release() {
            action.release();
        },
        setEnabled(next) {
            if (typeof next !== 'boolean')
                throw new EgretError('UI_CONTROL_OPTIONS');
            action.setEnabled(next);
        },
        dispose() {
            closed = true;
            action.dispose();
        }
    });
}
export function createSelectionGroup(options) {
    const { input, onChange } = record(options);
    const { items, wrap = true } = options;
    callback(onChange);
    if (!Array.isArray(items) || items.length < 1 || items.length > 256 || typeof wrap !== 'boolean')
        throw new EgretError('UI_CONTROL_OPTIONS');
    const entries = [], byKey = new Map(), targets = new Set();
    for (const item of items) {
        const { key, enabled: itemEnabled = true } = record(item), target = displayTarget(item.target);
        if (typeof key !== 'string' ||
            key.length < 1 ||
            key.length > 128 ||
            byKey.has(key) ||
            targets.has(target) ||
            typeof itemEnabled !== 'boolean')
            throw new EgretError('UI_CONTROL_OPTIONS');
        const entry = { key, target, enabled: itemEnabled, action: undefined };
        entries.push(entry);
        byKey.set(key, entry);
        targets.add(target);
    }
    let selected;
    if (options.selected !== undefined) {
        selected = byKey.get(options.selected);
        if (selected === undefined)
            throw new EgretError('UI_CONTROL_OPTIONS');
    }
    const keys = Object.freeze(entries.map(entry => entry.key));
    let closed = false, enabled = true;
    function open() {
        if (closed)
            throw new EgretError('UI_CONTROL_CLOSED');
    }
    function known(key) {
        const entry = byKey.get(key);
        if (entry === undefined)
            throw new EgretError('UI_CONTROL_UNKNOWN_ITEM');
        return entry;
    }
    function choose(entry) {
        if (entry === undefined || entry === selected || !enabled || !entry.enabled)
            return false;
        const previous = selected;
        selected = entry;
        onChange?.(entry.key, previous?.key);
        return true;
    }
    /** The nearest enabled item from a position, in one direction. */
    function seek(from, step) {
        for (let count = 0, index = from; count < entries.length; count++, index += step) {
            if (index < 0 || index >= entries.length) {
                if (!wrap)
                    return undefined;
                index = (index + entries.length) % entries.length;
            }
            if (entries[index].enabled)
                return entries[index];
        }
        return undefined;
    }
    function move(step) {
        open();
        // With nothing selected, movement starts at the end it is leaving from.
        if (selected === undefined)
            return choose(seek(step === 1 ? 0 : entries.length - 1, step));
        return choose(seek(entries.indexOf(selected) + step, step));
    }
    try {
        // Each item takes its press through an action control; whether the press may select is decided in one place, above.
        for (const entry of entries)
            entry.action = createActionControl({
                input,
                target: entry.target,
                onActivate: () => {
                    choose(entry);
                }
            });
    }
    catch (cause) {
        for (const entry of entries)
            try {
                entry.action?.dispose();
            }
            catch {
                /* the first failure is the one reported */
            }
        throw cause;
    }
    return Object.freeze({
        get selected() {
            return selected?.key;
        },
        keys,
        get enabled() {
            return enabled;
        },
        select(key) {
            open();
            return choose(known(key));
        },
        next() {
            return move(1);
        },
        previous() {
            return move(-1);
        },
        first() {
            open();
            return choose(seek(0, 1));
        },
        last() {
            open();
            return choose(seek(entries.length - 1, -1));
        },
        isItemEnabled(key) {
            return known(key).enabled;
        },
        setItemEnabled(key, next) {
            open();
            const entry = known(key);
            if (typeof next !== 'boolean')
                throw new EgretError('UI_CONTROL_OPTIONS');
            entry.enabled = next;
        },
        setEnabled(next) {
            open();
            if (typeof next !== 'boolean')
                throw new EgretError('UI_CONTROL_OPTIONS');
            enabled = next;
        },
        dispose() {
            if (closed)
                return;
            closed = true;
            let failure;
            for (const entry of entries)
                try {
                    entry.action.dispose();
                }
                catch (cause) {
                    failure ??= cause;
                }
            if (failure !== undefined)
                throw failure;
        }
    });
}
//# sourceMappingURL=stateControls.js.map