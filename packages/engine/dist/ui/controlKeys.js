// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
const ARROWS = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
};
const LETTERS = { KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };
const ACTIVATES = ['Space', 'Enter', 'NumpadEnter'];
const METHODS = {
    action: ['press', 'release'],
    toggle: ['toggle'],
    textField: ['edit'],
    selection: ['next', 'previous', 'first', 'last'],
    scroll: ['line', 'page', 'toStart', 'toEnd'],
    range: ['stepBy', 'toMin', 'toMax'],
    movement: ['setDirection']
};
export function createControlKeys(options) {
    if (options === null || typeof options !== 'object')
        throw new EgretError('UI_CONTROL_OPTIONS');
    const { keyboard, target, kind, control } = options;
    const events = keyboard === null || typeof keyboard !== 'object' ? undefined : keyboard.events;
    const methods = typeof kind === 'string' && Object.hasOwn(METHODS, kind) ? METHODS[kind] : undefined;
    if (events === null ||
        typeof events !== 'object' ||
        [events.keyDown, events.keyUp, events.cancel].some(type => type === null || typeof type !== 'object') ||
        target === null ||
        typeof target !== 'object' ||
        typeof target.on !== 'function' ||
        methods === undefined ||
        control === null ||
        typeof control !== 'object' ||
        methods.some(name => typeof control[name] !== 'function'))
        throw new EgretError('UI_CONTROL_OPTIONS');
    const onPressChange = options.kind === 'selection' || options.kind === 'scroll' || options.kind === 'range'
        ? undefined
        : options.onPressChange;
    if (onPressChange !== undefined && typeof onPressChange !== 'function')
        throw new EgretError('UI_CONTROL_OPTIONS');
    let closed = false;
    /** The codes this binding holds, in the order they went down. */
    const held = new Set();
    function hold(code, down) {
        const was = held.size > 0;
        if (down)
            held.add(code);
        else
            held.delete(code);
        if (was !== held.size > 0)
            onPressChange?.(!was);
    }
    const shortcut = (payload) => payload.altKey || payload.ctrlKey || payload.metaKey;
    let down, release = () => {
        /* nothing is held */
    };
    if (options.kind === 'action' || options.kind === 'toggle' || options.kind === 'textField') {
        const activate = options.kind === 'action'
            ? () => {
                options.control.press();
                options.control.release();
            }
            : options.kind === 'toggle'
                ? () => {
                    options.control.toggle();
                }
                : () => {
                    options.control.edit();
                };
        down = event => {
            const { code, repeat } = event.payload;
            if (!ACTIVATES.includes(code) || shortcut(event.payload) || !control.enabled)
                return;
            // One key activates at a time. The repeats of the key that is held are taken with it.
            if (held.size === 0 && !repeat)
                hold(code, true);
            else if (!held.has(code))
                return;
            event.preventDefault();
        };
        release = (code, completed) => {
            hold(code, false);
            if (completed && control.enabled)
                activate();
        };
    }
    else if (options.kind === 'selection') {
        const group = options.control, orientation = options.orientation ?? 'both';
        if (orientation !== 'horizontal' && orientation !== 'vertical' && orientation !== 'both')
            throw new EgretError('UI_CONTROL_OPTIONS');
        const moves = { Home: () => group.first(), End: () => group.last() };
        if (orientation !== 'vertical') {
            moves.ArrowRight = () => group.next();
            moves.ArrowLeft = () => group.previous();
        }
        if (orientation !== 'horizontal') {
            moves.ArrowDown = () => group.next();
            moves.ArrowUp = () => group.previous();
        }
        down = event => {
            const move = Object.hasOwn(moves, event.payload.code) ? moves[event.payload.code] : undefined;
            if (move === undefined || shortcut(event.payload) || !control.enabled)
                return;
            // The key is the group's also at an end that does not wrap, as it is in a native group.
            event.preventDefault();
            move();
        };
    }
    else if (options.kind === 'scroll') {
        const scroll = options.control;
        if (scroll.axis !== 'x' && scroll.axis !== 'y')
            throw new EgretError('UI_CONTROL_OPTIONS');
        const moves = {
            PageDown: () => scroll.page(1),
            PageUp: () => scroll.page(-1),
            Home: () => scroll.toStart(),
            End: () => scroll.toEnd()
        };
        moves[scroll.axis === 'y' ? 'ArrowDown' : 'ArrowRight'] = () => scroll.line(1);
        moves[scroll.axis === 'y' ? 'ArrowUp' : 'ArrowLeft'] = () => scroll.line(-1);
        down = event => {
            const move = Object.hasOwn(moves, event.payload.code) ? moves[event.payload.code] : undefined;
            if (move === undefined || shortcut(event.payload) || !control.enabled)
                return;
            // At its end the viewport leaves the key to a viewport outside it, or to the page.
            if (move())
                event.preventDefault();
        };
    }
    else if (options.kind === 'range') {
        const range = options.control, orientation = options.orientation ?? 'both', page = options.page ?? 10;
        if ((orientation !== 'horizontal' && orientation !== 'vertical' && orientation !== 'both') ||
            !Number.isSafeInteger(page) ||
            page < 1)
            throw new EgretError('UI_CONTROL_OPTIONS');
        const moves = {
            PageUp: () => range.stepBy(page),
            PageDown: () => range.stepBy(-page),
            Home: () => range.toMin(),
            End: () => range.toMax()
        };
        if (orientation !== 'vertical') {
            moves.ArrowRight = () => range.stepBy(1);
            moves.ArrowLeft = () => range.stepBy(-1);
        }
        if (orientation !== 'horizontal') {
            moves.ArrowUp = () => range.stepBy(1);
            moves.ArrowDown = () => range.stepBy(-1);
        }
        down = event => {
            const move = Object.hasOwn(moves, event.payload.code) ? moves[event.payload.code] : undefined;
            if (move === undefined || shortcut(event.payload) || !control.enabled)
                return;
            // The key is the slider's also at an end, as it is in a native one: the page does not scroll under it.
            event.preventDefault();
            move();
        };
    }
    else {
        const movement = options.control, keys = options.keys ?? 'both';
        if (keys !== 'arrows' && keys !== 'wasd' && keys !== 'both')
            throw new EgretError('UI_CONTROL_OPTIONS');
        const vectors = {
            ...(keys === 'wasd' ? {} : ARROWS),
            ...(keys === 'arrows' ? {} : LETTERS)
        };
        const steer = () => {
            let x = 0, y = 0;
            for (const code of held) {
                x += vectors[code][0];
                y += vectors[code][1];
            }
            movement.setDirection(x, y);
        };
        down = event => {
            const { code } = event.payload;
            if (!Object.hasOwn(vectors, code) || shortcut(event.payload) || !control.enabled)
                return;
            event.preventDefault();
            if (held.has(code))
                return;
            hold(code, true);
            steer();
        };
        release = code => {
            hold(code, false);
            steer();
        };
    }
    const subscriptions = [
        target.on(events.keyDown, event => {
            if (!closed && !event.defaultPrevented)
                down(event);
        }),
        target.on(events.keyUp, event => {
            if (closed || !held.has(event.payload.code))
                return;
            const taken = event.defaultPrevented;
            event.preventDefault();
            release(event.payload.code, !taken);
        }),
        // The focus left, or the page did, while the key was down.
        target.on(events.cancel, event => {
            if (!closed && held.has(event.payload.code))
                release(event.payload.code, false);
        })
    ];
    return Object.freeze({
        get pressed() {
            return held.size > 0;
        },
        dispose() {
            if (closed)
                return;
            closed = true;
            let failure;
            const was = held.size > 0;
            held.clear();
            if (was) {
                // A direction that was held ends with the binding. A control that is already closed has none.
                if (options.kind === 'movement')
                    try {
                        options.control.setDirection(0, 0);
                    }
                    catch (cause) {
                        if (!(cause instanceof EgretError) || cause.code !== 'UI_CONTROL_CLOSED')
                            failure = cause;
                    }
                try {
                    onPressChange?.(false);
                }
                catch (cause) {
                    failure ??= cause;
                }
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
//# sourceMappingURL=controlKeys.js.map