// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { DisplayObject } from '@egret/runtime';
import type { PointerContact, PointerInput } from '../pointerInputTypes.js';

/**
 * Reusable movement and action controls over the existing contact stream.
 *
 * These own control state only: they add no host listener, scheduler or gesture framework, and they
 * do not decide routing. A control takes one contact at most, refuses a second rather than stealing
 * it, and always ends at exactly one released value so a suspended or disposed control can never
 * leave an action held.
 */

export interface MovementValue {
    readonly x: number;
    readonly y: number;
}

export interface MovementControlOptions {
    readonly input: PointerInput;
    /** The surface that owns this control; contacts routed elsewhere are not claimed. */
    readonly target: DisplayObject;
    /** Full-deflection distance in logical units. */
    readonly radius: number;
    /** Distance below which the control reports no movement. Defaults to a tenth of the radius. */
    readonly deadZone?: number;
    readonly onMovement?: (value: MovementValue) => void;
}

export interface MovementControl {
    readonly value: MovementValue;
    readonly active: boolean;
    readonly enabled: boolean;
    /** Keyboard or scripted equivalents issue movement through the same value. */
    setDirection(x: number, y: number): void;
    setEnabled(enabled: boolean): void;
    dispose(): void;
}

export interface ActionControlOptions {
    readonly input: PointerInput;
    readonly target: DisplayObject;
    readonly onActivate?: () => void;
    readonly onPressChange?: (pressed: boolean) => void;
}

export interface ActionControl {
    readonly pressed: boolean;
    readonly enabled: boolean;
    readonly activationCount: number;
    /** Keyboard or scripted equivalents share the pointer activation path. */
    press(): void;
    release(): void;
    setEnabled(enabled: boolean): void;
    dispose(): void;
}

const ZERO: MovementValue = Object.freeze({ x: 0, y: 0 });

function finite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function checkOptions(options: unknown): void {
    if (options === null || typeof options !== 'object') throw new EgretError('UI_CONTROL_OPTIONS');
    const { input, target } = options as { input?: unknown; target?: unknown };
    if (input === null || typeof input !== 'object') throw new EgretError('UI_CONTROL_OPTIONS');
    if (target === null || typeof target !== 'object' || typeof (target as DisplayObject).on !== 'function') {
        throw new EgretError('UI_CONTROL_OPTIONS');
    }
}

/** Clamp a scripted or keyboard direction into the control's admitted range. */
function direction(x: number, y: number): MovementValue {
    if (!finite(x) || !finite(y)) throw new EgretError('UI_CONTROL_DIRECTION');
    const length = Math.hypot(x, y);
    if (length === 0) return ZERO;
    const scale = length > 1 ? 1 / length : 1;
    return Object.freeze({ x: x * scale, y: y * scale });
}

export function createMovementControl(options: MovementControlOptions): MovementControl {
    checkOptions(options);
    const { input, target, radius, onMovement } = options;
    const deadZone = options.deadZone ?? radius / 10;
    if (!finite(radius) || radius <= 0) throw new EgretError('UI_CONTROL_RADIUS');
    if (!finite(deadZone) || deadZone < 0 || deadZone >= radius) throw new EgretError('UI_CONTROL_RADIUS');
    let closed = false;
    let enabled = true;
    let value = ZERO;
    let owner: { session: PointerContact['session']; originX: number; originY: number } | undefined;

    function publish(next: MovementValue): void {
        if (next.x === value.x && next.y === value.y) return;
        value = next;
        try {
            onMovement?.(next);
        } catch (cause) {
            throw cause;
        }
    }

    function release(): void {
        owner = undefined;
        publish(ZERO);
    }

    function begin(event: { payload: PointerContact }): void {
        if (closed || !enabled) return;
        // One owning contact. A second contact is refused rather than replacing the first.
        if (owner !== undefined) return;
        owner = { session: event.payload.session, originX: event.payload.globalX, originY: event.payload.globalY };
    }

    function move(event: { payload: PointerContact }): void {
        if (closed || owner === undefined || event.payload.session !== owner.session) return;
        const dx = event.payload.globalX - owner.originX;
        const dy = event.payload.globalY - owner.originY;
        const distance = Math.hypot(dx, dy);
        // Inside the dead zone the control reports rest, not a debounced direction.
        if (distance <= deadZone) { publish(ZERO); return; }
        const magnitude = Math.min(1, distance / radius);
        const scale = magnitude / distance;
        publish(Object.freeze({ x: dx * scale, y: dy * scale }));
    }

    function end(event: { payload: PointerContact }): void {
        // A refused second contact must not release the contact that owns the movement.
        if (closed || owner === undefined || event.payload.session !== owner.session) return;
        release();
    }

    const subscriptions = [
        target.on(input.events.begin, begin),
        target.on(input.events.move, move),
        target.on(input.events.end, end),
        target.on(input.events.cancel, end),
    ];
    // An invalid target receives no dispatch, so the owner-session terminal stream is the only
    // signal that the held contact is gone.
    const observeTerminal = input.observe(notification => {
        if (closed || owner === undefined || notification.contact.session !== owner.session) return;
        // Retire whatever the owning session leaves behind after the dispatch attempt, whatever the
        // destination, a stopped propagation or a routed failure did to it. An ordinary delivery has
        // already released here from the control's own handler, so this is only the fallback.
        if (notification.kind === 'cancel' || notification.kind === 'end') release();
    });

    return Object.freeze({
        get value() { return value; },
        get active() { return owner !== undefined; },
        get enabled() { return enabled; },
        setDirection(x: number, y: number) {
            if (closed) throw new EgretError('UI_CONTROL_CLOSED');
            if (!enabled) { publish(ZERO); return; }
            publish(direction(x, y));
        },
        setEnabled(next: boolean) {
            if (closed) throw new EgretError('UI_CONTROL_CLOSED');
            if (enabled === next) return;
            enabled = next;
            // Disabling a held control must not keep an action pressed.
            if (!enabled) release();
        },
        dispose() {
            if (closed) return;
            closed = true;
            let failure: unknown;
            try {
                release();
            } catch (cause) {
                // Keep the control terminal: every owned subscription is still released below.
                failure = cause;
            } finally {
                observeTerminal();
                for (const unsubscribe of subscriptions) {
                    try { unsubscribe(); } catch (cause) { failure ??= cause; }
                }
            }
            if (failure !== undefined) throw failure;
        },
    });
}

export function createActionControl(options: ActionControlOptions): ActionControl {
    checkOptions(options);
    const { input, target, onActivate, onPressChange } = options;
    let closed = false;
    let enabled = true;
    let candidate: PointerContact['session'] | undefined;
    let held = false;
    let activations = 0;

    function setPressed(next: boolean): void {
        if (held === next) return;
        held = next;
        onPressChange?.(next);
    }

    function begin(event: { payload: PointerContact }): void {
        if (closed || !enabled) return;
        if (candidate !== undefined) return;
        candidate = event.payload.session;
        setPressed(true);
    }

    function move(event: { payload: PointerContact }): void {
        // The contact keeps the button pressed; a movement threshold belongs to the control owner.
        if (closed || candidate === undefined || event.payload.session !== candidate) return;
    }

    function end(event: { payload: PointerContact }): void {
        if (closed || candidate === undefined || event.payload.session !== candidate) return;
        candidate = undefined;
        setPressed(false);
        activate();
    }

    function cancel(event: { payload: PointerContact }): void {
        // The refused second contact cancelling must not clear the first one's pending activation.
        if (closed || candidate === undefined || event.payload.session !== candidate) return;
        candidate = undefined;
        setPressed(false);
    }

    function activate(): void {
        if (closed || !enabled) return;
        activations += 1;
        onActivate?.();
    }

    const subscriptions = [
        target.on(input.events.begin, begin),
        target.on(input.events.move, move),
        target.on(input.events.end, end),
        target.on(input.events.cancel, cancel),
    ];
    const observeTerminal = input.observe(notification => {
        if (closed || candidate === undefined || notification.contact.session !== candidate) return;
        // A terminal the control's own handler did not consume clears the press without activating.
        if (notification.kind === 'cancel' || notification.kind === 'end') {
            candidate = undefined;
            setPressed(false);
        }
    });

    return Object.freeze({
        get pressed() { return held; },
        get enabled() { return enabled; },
        get activationCount() { return activations; },
        press() {
            if (closed) throw new EgretError('UI_CONTROL_CLOSED');
            if (!enabled) return;
            setPressed(true);
        },
        release() {
            if (closed) throw new EgretError('UI_CONTROL_CLOSED');
            if (!enabled) { setPressed(false); return; }
            // A scripted release activates only if a press is outstanding; it cannot double-fire.
            if (!held) return;
            setPressed(false);
            activate();
        },
        setEnabled(next: boolean) {
            if (closed) throw new EgretError('UI_CONTROL_CLOSED');
            if (enabled === next) return;
            enabled = next;
            if (!enabled) { candidate = undefined; setPressed(false); }
        },
        dispose() {
            if (closed) return;
            closed = true;
            candidate = undefined;
            let failure: unknown;
            try {
                setPressed(false);
            } catch (cause) {
                failure = cause;
            } finally {
                observeTerminal();
                for (const unsubscribe of subscriptions) {
                    try { unsubscribe(); } catch (cause) { failure ??= cause; }
                }
            }
            if (failure !== undefined) throw failure;
        },
    });
}
