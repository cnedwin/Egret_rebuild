// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
const ZERO = Object.freeze({ x: 0, y: 0 });
function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function checkOptions(options) {
    if (options === null || typeof options !== 'object')
        throw new EgretError('UI_CONTROL_OPTIONS');
    const { input, target } = options;
    if (input === null || typeof input !== 'object')
        throw new EgretError('UI_CONTROL_OPTIONS');
    if (target === null || typeof target !== 'object' || typeof target.on !== 'function') {
        throw new EgretError('UI_CONTROL_OPTIONS');
    }
}
/** Clamp a scripted or keyboard direction into the control's admitted range. */
function direction(x, y) {
    if (!finite(x) || !finite(y))
        throw new EgretError('UI_CONTROL_DIRECTION');
    const length = Math.hypot(x, y);
    if (length === 0)
        return ZERO;
    const scale = length > 1 ? 1 / length : 1;
    return Object.freeze({ x: x * scale, y: y * scale });
}
export function createMovementControl(options) {
    checkOptions(options);
    const { input, target, radius, onMovement } = options;
    const deadZone = options.deadZone ?? radius / 10;
    if (!finite(radius) || radius <= 0)
        throw new EgretError('UI_CONTROL_RADIUS');
    if (!finite(deadZone) || deadZone < 0 || deadZone >= radius)
        throw new EgretError('UI_CONTROL_RADIUS');
    let closed = false;
    let enabled = true;
    let value = ZERO;
    let owner;
    function publish(next) {
        if (next.x === value.x && next.y === value.y)
            return;
        value = next;
        try {
            onMovement?.(next);
        }
        catch (cause) {
            throw cause;
        }
    }
    function release() {
        owner = undefined;
        publish(ZERO);
    }
    function begin(event) {
        if (closed || !enabled)
            return;
        // One owning contact. A second contact is refused rather than replacing the first.
        if (owner !== undefined)
            return;
        owner = { session: event.payload.session, originX: event.payload.globalX, originY: event.payload.globalY };
    }
    function move(event) {
        if (closed || owner === undefined || event.payload.session !== owner.session)
            return;
        const dx = event.payload.globalX - owner.originX;
        const dy = event.payload.globalY - owner.originY;
        const distance = Math.hypot(dx, dy);
        // Inside the dead zone the control reports rest, not a debounced direction.
        if (distance <= deadZone) {
            publish(ZERO);
            return;
        }
        const magnitude = Math.min(1, distance / radius);
        const scale = magnitude / distance;
        publish(Object.freeze({ x: dx * scale, y: dy * scale }));
    }
    function end(event) {
        // A refused second contact must not release the contact that owns the movement.
        if (closed || owner === undefined || event.payload.session !== owner.session)
            return;
        release();
    }
    const subscriptions = [
        target.on(input.events.begin, begin),
        target.on(input.events.move, move),
        target.on(input.events.end, end),
        target.on(input.events.cancel, end)
    ];
    // An invalid target receives no dispatch, so the owner-session terminal stream is the only
    // signal that the held contact is gone.
    const observeTerminal = input.observe(notification => {
        if (closed || owner === undefined || notification.contact.session !== owner.session)
            return;
        // Retire whatever the owning session leaves behind after the dispatch attempt, whatever the
        // destination, a stopped propagation or a routed failure did to it. An ordinary delivery has
        // already released here from the control's own handler, so this is only the fallback.
        if (notification.kind === 'cancel' || notification.kind === 'end')
            release();
    });
    return Object.freeze({
        get value() {
            return value;
        },
        get active() {
            return owner !== undefined;
        },
        get enabled() {
            return enabled;
        },
        setDirection(x, y) {
            if (closed)
                throw new EgretError('UI_CONTROL_CLOSED');
            if (!enabled) {
                publish(ZERO);
                return;
            }
            publish(direction(x, y));
        },
        setEnabled(next) {
            if (closed)
                throw new EgretError('UI_CONTROL_CLOSED');
            if (enabled === next)
                return;
            enabled = next;
            // Disabling a held control must not keep an action pressed.
            if (!enabled)
                release();
        },
        dispose() {
            if (closed)
                return;
            closed = true;
            let failure;
            try {
                release();
            }
            catch (cause) {
                // Keep the control terminal: every owned subscription is still released below.
                failure = cause;
            }
            finally {
                observeTerminal();
                for (const unsubscribe of subscriptions) {
                    try {
                        unsubscribe();
                    }
                    catch (cause) {
                        failure ??= cause;
                    }
                }
            }
            if (failure !== undefined)
                throw failure;
        }
    });
}
export function createActionControl(options) {
    checkOptions(options);
    const { input, target, onActivate, onPressChange } = options;
    let closed = false;
    let enabled = true;
    let candidate;
    let held = false;
    let activations = 0;
    function setPressed(next) {
        if (held === next)
            return;
        held = next;
        onPressChange?.(next);
    }
    function begin(event) {
        if (closed || !enabled)
            return;
        if (candidate !== undefined)
            return;
        candidate = event.payload.session;
        setPressed(true);
    }
    function move(event) {
        // The contact keeps the button pressed; a movement threshold belongs to the control owner.
        if (closed || candidate === undefined || event.payload.session !== candidate)
            return;
    }
    function end(event) {
        if (closed || candidate === undefined || event.payload.session !== candidate)
            return;
        candidate = undefined;
        setPressed(false);
        activate();
    }
    function cancel(event) {
        // The refused second contact cancelling must not clear the first one's pending activation.
        if (closed || candidate === undefined || event.payload.session !== candidate)
            return;
        candidate = undefined;
        setPressed(false);
    }
    function activate() {
        if (closed || !enabled)
            return;
        activations += 1;
        onActivate?.();
    }
    const subscriptions = [
        target.on(input.events.begin, begin),
        target.on(input.events.move, move),
        target.on(input.events.end, end),
        target.on(input.events.cancel, cancel)
    ];
    const observeTerminal = input.observe(notification => {
        if (closed || candidate === undefined || notification.contact.session !== candidate)
            return;
        // A terminal the control's own handler did not consume clears the press without activating.
        if (notification.kind === 'cancel' || notification.kind === 'end') {
            candidate = undefined;
            setPressed(false);
        }
    });
    return Object.freeze({
        get pressed() {
            return held;
        },
        get enabled() {
            return enabled;
        },
        get activationCount() {
            return activations;
        },
        press() {
            if (closed)
                throw new EgretError('UI_CONTROL_CLOSED');
            if (!enabled)
                return;
            setPressed(true);
        },
        release() {
            if (closed)
                throw new EgretError('UI_CONTROL_CLOSED');
            if (!enabled) {
                setPressed(false);
                return;
            }
            // A scripted release activates only if a press is outstanding; it cannot double-fire.
            if (!held)
                return;
            setPressed(false);
            activate();
        },
        setEnabled(next) {
            if (closed)
                throw new EgretError('UI_CONTROL_CLOSED');
            if (enabled === next)
                return;
            enabled = next;
            if (!enabled) {
                candidate = undefined;
                setPressed(false);
            }
        },
        dispose() {
            if (closed)
                return;
            closed = true;
            candidate = undefined;
            let failure;
            try {
                setPressed(false);
            }
            catch (cause) {
                failure = cause;
            }
            finally {
                observeTerminal();
                for (const unsubscribe of subscriptions) {
                    try {
                        unsubscribe();
                    }
                    catch (cause) {
                        failure ??= cause;
                    }
                }
            }
            if (failure !== undefined)
                throw failure;
        }
    });
}
//# sourceMappingURL=controls.js.map