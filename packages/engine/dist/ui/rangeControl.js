// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
export function createRangeControl(options) {
    if (options === null || typeof options !== 'object')
        throw new EgretError('UI_CONTROL_OPTIONS');
    const { input, target, axis = 'x', start = 0, length, min = 0, max = 100, step = 1, onChange, onDragChange } = options;
    if (input === null ||
        typeof input !== 'object' ||
        typeof input.observe !== 'function' ||
        input.events === null ||
        typeof input.events !== 'object' ||
        target === null ||
        typeof target !== 'object' ||
        typeof target.on !== 'function' ||
        typeof target.globalToLocal !== 'function' ||
        (axis !== 'x' && axis !== 'y') ||
        !finite(start) ||
        !finite(length) ||
        length <= 0 ||
        !finite(min) ||
        !finite(max) ||
        // A step no wider than the range also says the range is not empty.
        !finite(step) ||
        step <= 0 ||
        step > max - min ||
        (options.value !== undefined && !finite(options.value)) ||
        (onChange !== undefined && typeof onChange !== 'function') ||
        (onDragChange !== undefined && typeof onDragChange !== 'function'))
        throw new EgretError('UI_CONTROL_OPTIONS');
    /** The value of the range nearest to a number: `min` and so many steps, or the far end. */
    function nearest(wanted) {
        const snapped = Number((min + Math.round((Math.max(wanted, min) - min) / step) * step).toPrecision(12));
        // The far end may lie closer than the last whole step does, or before the step a number rounds to. Halfway goes up, as between two steps.
        return snapped > max || max - wanted <= wanted - snapped ? max : snapped;
    }
    let value = nearest(options.value ?? min), closed = false, enabled = true;
    let session;
    function open() {
        if (closed)
            throw new EgretError('UI_CONTROL_CLOSED');
    }
    function assign(wanted) {
        const next = nearest(wanted);
        if (next === value)
            return false;
        const previous = value;
        value = next;
        onChange?.(next, previous);
        return true;
    }
    function setDragging(next) {
        const was = session !== undefined;
        session = next;
        if (was !== (next !== undefined))
            onDragChange?.(next !== undefined);
    }
    /** The value under a contact: where it is along the track, as a share of the range. */
    function under(contact) {
        const point = target.globalToLocal(contact.globalX, contact.globalY);
        const along = axis === 'x' ? point.x - start : start + length - point.y;
        return min + Math.min(1, Math.max(0, along / length)) * (max - min);
    }
    const owns = (contact) => session !== undefined && contact.session === session;
    const subscriptions = [
        target.on(input.events.begin, event => {
            // One contact drags the thumb. A second is refused rather than taking over.
            if (closed || !enabled || session !== undefined)
                return;
            setDragging(event.payload.session);
            assign(under(event.payload));
        }),
        target.on(input.events.move, event => {
            if (!closed && owns(event.payload))
                assign(under(event.payload));
        }),
        target.on(input.events.end, event => {
            if (!closed && owns(event.payload))
                setDragging(undefined);
        }),
        target.on(input.events.cancel, event => {
            if (!closed && owns(event.payload))
                setDragging(undefined);
        }),
        // A track that has left the stage receives no event; the stream of the input still ends the drag.
        input.observe(notification => {
            if (closed || !owns(notification.contact))
                return;
            if (notification.kind === 'end' || notification.kind === 'cancel')
                setDragging(undefined);
        })
    ];
    return Object.freeze({
        get value() {
            return value;
        },
        min,
        max,
        step,
        get fraction() {
            return (value - min) / (max - min);
        },
        get dragging() {
            return session !== undefined;
        },
        get enabled() {
            return enabled;
        },
        setValue(next) {
            open();
            if (!finite(next))
                throw new EgretError('UI_CONTROL_OPTIONS');
            return assign(next);
        },
        stepBy(steps) {
            open();
            if (!Number.isSafeInteger(steps))
                throw new EgretError('UI_CONTROL_OPTIONS');
            if (!enabled)
                return false;
            // The far end need not be a whole step from the others: a step from it goes to the next whole step.
            const position = (value - min) / step, whole = steps > 0 ? Math.floor(position + 1e-9) : Math.ceil(position - 1e-9);
            return assign(min + (whole + steps) * step);
        },
        toMin() {
            open();
            return enabled ? assign(min) : false;
        },
        toMax() {
            open();
            return enabled ? assign(max) : false;
        },
        setEnabled(next) {
            open();
            if (typeof next !== 'boolean')
                throw new EgretError('UI_CONTROL_OPTIONS');
            if (enabled === next)
                return;
            enabled = next;
            // A disabled slider does not keep a drag.
            if (!enabled)
                setDragging(undefined);
        },
        dispose() {
            if (closed)
                return;
            closed = true;
            let failure;
            try {
                setDragging(undefined);
            }
            catch (cause) {
                failure = cause;
            }
            for (const unsubscribe of subscriptions)
                try {
                    unsubscribe();
                }
                catch (cause) {
                    failure ??= cause;
                }
            if (failure !== undefined)
                throw failure;
        }
    });
}
//# sourceMappingURL=rangeControl.js.map