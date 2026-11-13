// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { DisplayObject } from '@egret/runtime';
import type { HoverInput } from '../hoverInputTypes.js';
import type { PointerInput } from '../pointerInputTypes.js';
import { createActionControl } from './controls.js';
import type { ActionControl } from './controls.js';

/**
 * Hover, toggle and single-selection state for controls an application draws itself.
 *
 * Like the movement and action controls these own state only. They add no host listener and draw
 * nothing: the application paints each state, and binds keys to the same methods a pointer reaches.
 */

export interface HoverControlOptions {
    readonly hover: HoverInput;
    /** The surface of the control. A pointer over it or over one of its descendants hovers it. */
    readonly target: DisplayObject;
    readonly onHoverChange?: (hovered: boolean) => void;
}

export interface HoverControl {
    /** Whether an enabled control has a pointer over it. */
    readonly hovered: boolean;
    readonly enabled: boolean;
    setEnabled(enabled: boolean): void;
    dispose(): void;
}

export interface ToggleControlOptions {
    readonly input: PointerInput;
    readonly target: DisplayObject;
    /** The value it starts with. Defaults to false. */
    readonly checked?: boolean;
    readonly onChange?: (checked: boolean) => void;
    readonly onPressChange?: (pressed: boolean) => void;
}

export interface ToggleControl {
    readonly checked: boolean;
    readonly pressed: boolean;
    readonly enabled: boolean;
    /** One activation, as a completed press is: the value flips and the change is reported. */
    toggle(): void;
    /** Sets the value without an activation. A change is reported only when the value differs. */
    setChecked(checked: boolean): void;
    /** Keyboard or scripted equivalents share the pointer activation path. */
    press(): void;
    release(): void;
    setEnabled(enabled: boolean): void;
    dispose(): void;
}

export interface SelectionItem {
    readonly key: string;
    readonly target: DisplayObject;
    /** Defaults to true. A disabled item is skipped by movement and refuses a press. */
    readonly enabled?: boolean;
}

export interface SelectionGroupOptions {
    readonly input: PointerInput;
    /** One to 256 items with distinct keys and distinct targets, in the order movement follows. */
    readonly items: readonly SelectionItem[];
    /** The key selected at first. Without it nothing is selected until an item is chosen. */
    readonly selected?: string;
    /** Whether movement past either end continues at the other. Defaults to true. */
    readonly wrap?: boolean;
    readonly onChange?: (selected: string, previous: string | undefined) => void;
}

/** One of several: a radio group, a segmented control, or a listbox with a single selection. */
export interface SelectionGroup {
    readonly selected: string | undefined;
    readonly keys: readonly string[];
    readonly enabled: boolean;
    /** Selects an enabled item. Returns whether the selection changed. */
    select(key: string): boolean;
    /** Move the selection among the enabled items. Each returns whether it changed. */
    next(): boolean;
    previous(): boolean;
    first(): boolean;
    last(): boolean;
    isItemEnabled(key: string): boolean;
    /** A disabled item that is selected stays selected. */
    setItemEnabled(key: string, enabled: boolean): void;
    setEnabled(enabled: boolean): void;
    dispose(): void;
}

const MAX_DEPTH = 4096;

function record(options: unknown): Record<string, unknown> {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new EgretError('UI_CONTROL_OPTIONS');
    return options as Record<string, unknown>;
}

function displayTarget(value: unknown): DisplayObject {
    if (value === null || typeof value !== 'object' || typeof (value as DisplayObject).on !== 'function') throw new EgretError('UI_CONTROL_OPTIONS');
    return value as DisplayObject;
}

function callback<T>(value: T | undefined): T | undefined {
    if (value !== undefined && typeof value !== 'function') throw new EgretError('UI_CONTROL_OPTIONS');
    return value;
}

/** Whether a display object is the root of a subtree or inside it. */
function within(root: DisplayObject, node: DisplayObject | undefined): boolean {
    let current = node;
    for (let depth = 0; current !== undefined && depth < MAX_DEPTH; depth++) {
        if (current === root) return true;
        current = current.parent;
    }
    return false;
}

export function createHoverControl(options: HoverControlOptions): HoverControl {
    const { hover, onHoverChange } = record(options) as unknown as HoverControlOptions;
    const target = displayTarget((options as HoverControlOptions).target);
    if (hover === null || typeof hover !== 'object' || typeof hover.observe !== 'function' || hover.events === null || typeof hover.events !== 'object') throw new EgretError('UI_CONTROL_OPTIONS');
    callback(onHoverChange);
    // The pointers that are over the control or over one of its descendants.
    const inside = new Set<number>();
    let closed = false, enabled = true, reported = false;

    function publish(): void {
        const next = enabled && !closed && inside.size > 0;
        if (next === reported) return;
        reported = next;
        onHoverChange?.(next);
    }
    const subscriptions = [
        target.on(hover.events.enter, event => { if (closed) return; inside.add(event.payload.pointerId); publish(); }),
        // A pointer that goes from one descendant to another has not left the control.
        target.on(hover.events.leave, event => {
            if (closed || within(target, event.payload.related)) return;
            inside.delete(event.payload.pointerId); publish();
        }),
        // A target that has left the stage receives no event. The stream of the input still says its hover ended.
        hover.observe(notification => {
            if (closed || notification.kind !== 'leave' || !inside.has(notification.point.pointerId) || within(target, notification.related)) return;
            inside.delete(notification.point.pointerId); publish();
        }),
    ];

    return Object.freeze({
        get hovered() { return reported; },
        get enabled() { return enabled; },
        setEnabled(next: boolean) {
            if (closed) throw new EgretError('UI_CONTROL_CLOSED');
            if (typeof next !== 'boolean') throw new EgretError('UI_CONTROL_OPTIONS');
            if (enabled === next) return;
            // The pointer may still be over a disabled control; enabling it again finds it there.
            enabled = next;
            publish();
        },
        dispose() {
            if (closed) return;
            closed = true;
            let failure: unknown;
            try { publish(); } catch (cause) { failure = cause; }
            finally {
                inside.clear();
                for (const unsubscribe of subscriptions) try { unsubscribe(); } catch (cause) { failure ??= cause; }
            }
            if (failure !== undefined) throw failure;
        },
    });
}

export function createToggleControl(options: ToggleControlOptions): ToggleControl {
    const { input, target, onChange, onPressChange } = record(options) as unknown as ToggleControlOptions;
    let checked = (options as ToggleControlOptions).checked ?? false;
    if (typeof checked !== 'boolean') throw new EgretError('UI_CONTROL_OPTIONS');
    callback(onChange); callback(onPressChange);
    function set(next: boolean): void {
        if (checked === next) return;
        checked = next;
        onChange?.(next);
    }
    const action: ActionControl = createActionControl({ input, target, onActivate: () => set(!checked), ...(onPressChange === undefined ? {} : { onPressChange }) });
    let closed = false;
    function open(): void { if (closed) throw new EgretError('UI_CONTROL_CLOSED'); }

    return Object.freeze({
        get checked() { return checked; },
        get pressed() { return action.pressed; },
        get enabled() { return action.enabled; },
        toggle() { open(); if (action.enabled) set(!checked); },
        setChecked(next: boolean) {
            open();
            if (typeof next !== 'boolean') throw new EgretError('UI_CONTROL_OPTIONS');
            set(next);
        },
        press() { action.press(); },
        release() { action.release(); },
        setEnabled(next: boolean) {
            if (typeof next !== 'boolean') throw new EgretError('UI_CONTROL_OPTIONS');
            action.setEnabled(next);
        },
        dispose() { closed = true; action.dispose(); },
    });
}

export function createSelectionGroup(options: SelectionGroupOptions): SelectionGroup {
    const { input, onChange } = record(options) as unknown as SelectionGroupOptions;
    const { items, wrap = true } = options;
    callback(onChange);
    if (!Array.isArray(items) || items.length < 1 || items.length > 256 || typeof wrap !== 'boolean') throw new EgretError('UI_CONTROL_OPTIONS');
    interface Entry { readonly key: string; readonly target: DisplayObject; enabled: boolean; action: ActionControl | undefined; }
    const entries: Entry[] = [], byKey = new Map<string, Entry>(), targets = new Set<DisplayObject>();
    for (const item of items as readonly SelectionItem[]) {
        const { key, enabled: itemEnabled = true } = record(item) as unknown as SelectionItem, target = displayTarget(item.target);
        if (typeof key !== 'string' || key.length < 1 || key.length > 128 || byKey.has(key) || targets.has(target) || typeof itemEnabled !== 'boolean') throw new EgretError('UI_CONTROL_OPTIONS');
        const entry: Entry = { key, target, enabled: itemEnabled, action: undefined };
        entries.push(entry); byKey.set(key, entry); targets.add(target);
    }
    let selected: Entry | undefined;
    if (options.selected !== undefined) {
        selected = byKey.get(options.selected);
        if (selected === undefined) throw new EgretError('UI_CONTROL_OPTIONS');
    }
    const keys = Object.freeze(entries.map(entry => entry.key));
    let closed = false, enabled = true;

    function open(): void { if (closed) throw new EgretError('UI_CONTROL_CLOSED'); }
    function known(key: string): Entry {
        const entry = byKey.get(key);
        if (entry === undefined) throw new EgretError('UI_CONTROL_UNKNOWN_ITEM');
        return entry;
    }
    function choose(entry: Entry | undefined): boolean {
        if (entry === undefined || entry === selected || !enabled || !entry.enabled) return false;
        const previous = selected;
        selected = entry;
        onChange?.(entry.key, previous?.key);
        return true;
    }
    /** The nearest enabled item from a position, in one direction. */
    function seek(from: number, step: 1 | -1): Entry | undefined {
        for (let count = 0, index = from; count < entries.length; count++, index += step) {
            if (index < 0 || index >= entries.length) {
                if (!wrap) return undefined;
                index = (index + entries.length) % entries.length;
            }
            if (entries[index]!.enabled) return entries[index];
        }
        return undefined;
    }
    function move(step: 1 | -1): boolean {
        open();
        // With nothing selected, movement starts at the end it is leaving from.
        if (selected === undefined) return choose(seek(step === 1 ? 0 : entries.length - 1, step));
        return choose(seek(entries.indexOf(selected) + step, step));
    }
    try {
        // Each item takes its press through an action control; whether the press may select is decided in one place, above.
        for (const entry of entries) entry.action = createActionControl({ input, target: entry.target, onActivate: () => { choose(entry); } });
    } catch (cause) {
        for (const entry of entries) try { entry.action?.dispose(); } catch { /* the first failure is the one reported */ }
        throw cause;
    }

    return Object.freeze({
        get selected() { return selected?.key; },
        keys,
        get enabled() { return enabled; },
        select(key: string) { open(); return choose(known(key)); },
        next() { return move(1); },
        previous() { return move(-1); },
        first() { open(); return choose(seek(0, 1)); },
        last() { open(); return choose(seek(entries.length - 1, -1)); },
        isItemEnabled(key: string) { return known(key).enabled; },
        setItemEnabled(key: string, next: boolean) {
            open();
            const entry = known(key);
            if (typeof next !== 'boolean') throw new EgretError('UI_CONTROL_OPTIONS');
            entry.enabled = next;
        },
        setEnabled(next: boolean) {
            open();
            if (typeof next !== 'boolean') throw new EgretError('UI_CONTROL_OPTIONS');
            enabled = next;
        },
        dispose() {
            if (closed) return;
            closed = true;
            let failure: unknown;
            for (const entry of entries) try { entry.action!.dispose(); } catch (cause) { failure ??= cause; }
            if (failure !== undefined) throw failure;
        },
    });
}
