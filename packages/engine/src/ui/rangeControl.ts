// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { DisplayObject } from '@egret/runtime';
import type { PointerContact, PointerInput } from '../pointerInputTypes.js';

/**
 * One value out of a range, for a slider an application draws itself: a volume, a share, an amount.
 *
 * It owns the value only. A press on the track moves the value to where it is pressed and the same
 * contact then drags it; keys reach its methods. The application draws the track and the thumb from
 * what the control reports.
 */

export type RangeAxis = 'x' | 'y';

export interface RangeControlOptions {
    readonly input: PointerInput;
    /** The track. A press on it or on something inside it moves the value there. */
    readonly target: DisplayObject;
    /** The axis of the track in its own coordinates. Defaults to 'x'. Along 'y' the value grows upward. */
    readonly axis?: RangeAxis;
    /** Where the track begins along its axis, in the coordinates of the target. Defaults to 0. */
    readonly start?: number;
    /** How long the track is along its axis, in the coordinates of the target. */
    readonly length: number;
    /** The ends of the range. Default to 0 and 100. */
    readonly min?: number;
    readonly max?: number;
    /** The distance between two values, counted from `min`. Defaults to 1. The far end is always a value. */
    readonly step?: number;
    /** Where it starts. Defaults to `min`, and is brought to a value of the range. */
    readonly value?: number;
    readonly onChange?: (value: number, previous: number) => void;
    readonly onDragChange?: (dragging: boolean) => void;
}

export interface RangeControl {
    readonly value: number;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    /** The value as a share of the range, from 0 to 1: where the thumb is drawn along the track. */
    readonly fraction: number;
    readonly dragging: boolean;
    readonly enabled: boolean;
    /** Sets the value without a press or a key, also while disabled. It is brought to a value of the range. Returns whether it changed. */
    setValue(value: number): boolean;
    /** One activation from a key or a script: so many steps up, or down when negative. Nothing while disabled. */
    stepBy(steps: number): boolean;
    toMin(): boolean;
    toMax(): boolean;
    setEnabled(enabled: boolean): void;
    dispose(): void;
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function createRangeControl(options: RangeControlOptions): RangeControl {
    if (options === null || typeof options !== 'object') throw new EgretError('UI_CONTROL_OPTIONS');
    const { input, target, axis = 'x', start = 0, length, min = 0, max = 100, step = 1, onChange, onDragChange } = options;
    if (input === null || typeof input !== 'object' || typeof input.observe !== 'function' || input.events === null || typeof input.events !== 'object'
        || target === null || typeof target !== 'object' || typeof target.on !== 'function' || typeof target.globalToLocal !== 'function'
        || (axis !== 'x' && axis !== 'y') || !finite(start) || !finite(length) || length <= 0 || !finite(min) || !finite(max)
        // A step no wider than the range also says the range is not empty.
        || !finite(step) || step <= 0 || step > max - min || (options.value !== undefined && !finite(options.value))
        || (onChange !== undefined && typeof onChange !== 'function') || (onDragChange !== undefined && typeof onDragChange !== 'function')) throw new EgretError('UI_CONTROL_OPTIONS');
    /** The value of the range nearest to a number: `min` and so many steps, or the far end. */
    function nearest(wanted: number): number {
        const snapped = Number((min + Math.round((Math.max(wanted, min) - min) / step) * step).toPrecision(12));
        // The far end may lie closer than the last whole step does, or before the step a number rounds to. Halfway goes up, as between two steps.
        return snapped > max || max - wanted <= wanted - snapped ? max : snapped;
    }
    let value = nearest(options.value ?? min), closed = false, enabled = true;
    let session: PointerContact['session'] | undefined;

    function open(): void { if (closed) throw new EgretError('UI_CONTROL_CLOSED'); }
    function assign(wanted: number): boolean {
        const next = nearest(wanted);
        if (next === value) return false;
        const previous = value;
        value = next;
        onChange?.(next, previous);
        return true;
    }
    function setDragging(next: PointerContact['session'] | undefined): void {
        const was = session !== undefined;
        session = next;
        if (was !== (next !== undefined)) onDragChange?.(next !== undefined);
    }
    /** The value under a contact: where it is along the track, as a share of the range. */
    function under(contact: PointerContact): number {
        const point = target.globalToLocal(contact.globalX, contact.globalY);
        const along = axis === 'x' ? point.x - start : start + length - point.y;
        return min + Math.min(1, Math.max(0, along / length)) * (max - min);
    }
    const owns = (contact: PointerContact): boolean => session !== undefined && contact.session === session;
    const subscriptions = [
        target.on(input.events.begin, event => {
            // One contact drags the thumb. A second is refused rather than taking over.
            if (closed || !enabled || session !== undefined) return;
            setDragging(event.payload.session);
            assign(under(event.payload));
        }),
        target.on(input.events.move, event => { if (!closed && owns(event.payload)) assign(under(event.payload)); }),
        target.on(input.events.end, event => { if (!closed && owns(event.payload)) setDragging(undefined); }),
        target.on(input.events.cancel, event => { if (!closed && owns(event.payload)) setDragging(undefined); }),
        // A track that has left the stage receives no event; the stream of the input still ends the drag.
        input.observe(notification => {
            if (closed || !owns(notification.contact)) return;
            if (notification.kind === 'end' || notification.kind === 'cancel') setDragging(undefined);
        }),
    ];

    return Object.freeze({
        get value() { return value; },
        min, max, step,
        get fraction() { return (value - min) / (max - min); },
        get dragging() { return session !== undefined; },
        get enabled() { return enabled; },
        setValue(next: number) {
            open();
            if (!finite(next)) throw new EgretError('UI_CONTROL_OPTIONS');
            return assign(next);
        },
        stepBy(steps: number) {
            open();
            if (!Number.isSafeInteger(steps)) throw new EgretError('UI_CONTROL_OPTIONS');
            if (!enabled) return false;
            // The far end need not be a whole step from the others: a step from it goes to the next whole step.
            const position = (value - min) / step, whole = steps > 0 ? Math.floor(position + 1e-9) : Math.ceil(position - 1e-9);
            return assign(min + (whole + steps) * step);
        },
        toMin() { open(); return enabled ? assign(min) : false; },
        toMax() { open(); return enabled ? assign(max) : false; },
        setEnabled(next: boolean) {
            open();
            if (typeof next !== 'boolean') throw new EgretError('UI_CONTROL_OPTIONS');
            if (enabled === next) return;
            enabled = next;
            // A disabled slider does not keep a drag.
            if (!enabled) setDragging(undefined);
        },
        dispose() {
            if (closed) return;
            closed = true;
            let failure: unknown;
            try { setDragging(undefined); } catch (cause) { failure = cause; }
            for (const unsubscribe of subscriptions) try { unsubscribe(); } catch (cause) { failure ??= cause; }
            if (failure !== undefined) throw failure;
        },
    });
}
