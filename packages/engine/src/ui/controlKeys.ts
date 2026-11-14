// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { DisplayObject, EventType } from '@egret/runtime';
import type { KeyboardCancelPayload, KeyboardKeyPayload } from '../keyboardInputTypes.js';

/**
 * The usual keys of the controls an application draws itself.
 *
 * A binding listens for the keys the keyboard input delivers to one display object and calls the
 * control a pointer already reaches. It adds no host listener and moves no focus. A key that a
 * display object below has taken, and a key held with Alt, Control or the platform key, is left
 * alone.
 */

/** The keyboard input, or anything that delivers its three key events. */
export interface ControlKeysSource {
    readonly events: {
        readonly keyDown: EventType<KeyboardKeyPayload>;
        readonly keyUp: EventType<KeyboardKeyPayload>;
        readonly cancel: EventType<KeyboardCancelPayload>;
    };
}

interface ControlKeysTarget {
    readonly keyboard: ControlKeysSource;
    /** The display object that takes the focus, or one above it: keys rise through the tree. */
    readonly target: DisplayObject;
}

/** Space or Enter, released, activates. A hold that loses the focus activates nothing. */
export interface ActionKeysOptions extends ControlKeysTarget {
    readonly kind: 'action';
    readonly control: { readonly enabled: boolean; press(): void; release(): void };
    readonly onPressChange?: (pressed: boolean) => void;
}

export interface ToggleKeysOptions extends ControlKeysTarget {
    readonly kind: 'toggle';
    readonly control: { readonly enabled: boolean; toggle(): void };
    readonly onPressChange?: (pressed: boolean) => void;
}

/** The field opens when the key is released, so that the key types nothing into it. */
export interface TextFieldKeysOptions extends ControlKeysTarget {
    readonly kind: 'textField';
    readonly control: { readonly enabled: boolean; edit(): boolean };
    readonly onPressChange?: (pressed: boolean) => void;
}

/** Arrow keys move the selection, Home and End go to its ends. A held key repeats. */
export interface SelectionKeysOptions extends ControlKeysTarget {
    readonly kind: 'selection';
    readonly control: { readonly enabled: boolean; next(): boolean; previous(): boolean; first(): boolean; last(): boolean };
    /** Which arrow keys move it. Defaults to 'both'. */
    readonly orientation?: 'horizontal' | 'vertical' | 'both';
}

/** The arrow keys of its axis, Page Up, Page Down, Home and End. A key that moved nothing is left to whatever is outside. */
export interface ScrollKeysOptions extends ControlKeysTarget {
    readonly kind: 'scroll';
    readonly control: { readonly enabled: boolean; readonly axis: 'x' | 'y'; line(direction: 1 | -1): boolean; page(direction: 1 | -1): boolean; toStart(): boolean; toEnd(): boolean };
}

/** Arrow keys move the value by one step, Page Up and Page Down by a page of steps, Home and End go to its ends. A held key repeats. */
export interface RangeKeysOptions extends ControlKeysTarget {
    readonly kind: 'range';
    readonly control: { readonly enabled: boolean; stepBy(steps: number): boolean; toMin(): boolean; toMax(): boolean };
    /** Which arrow keys move it: Right and Left, Up and Down, or all four. Defaults to 'both'. Right and Up raise the value. */
    readonly orientation?: 'horizontal' | 'vertical' | 'both';
    /** How many steps Page Up and Page Down move. Defaults to 10. */
    readonly page?: number;
}

/** The keys that are down give the direction; opposite keys cancel each other. */
export interface MovementKeysOptions extends ControlKeysTarget {
    readonly kind: 'movement';
    readonly control: { readonly enabled: boolean; setDirection(x: number, y: number): void };
    /** Arrow keys, the W A S D positions of the keyboard, or both. Defaults to 'both'. */
    readonly keys?: 'arrows' | 'wasd' | 'both';
    readonly onPressChange?: (pressed: boolean) => void;
}

export type ControlKeysOptions = ActionKeysOptions | ToggleKeysOptions | TextFieldKeysOptions | SelectionKeysOptions | ScrollKeysOptions | RangeKeysOptions | MovementKeysOptions;

export interface ControlKeys {
    /** Whether a key of this binding is held: an activation that waits for its release, or a direction. */
    readonly pressed: boolean;
    dispose(): void;
}

type Vector = readonly [number, number];
const ARROWS: Readonly<Record<string, Vector>> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const LETTERS: Readonly<Record<string, Vector>> = { KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };
const ACTIVATES: readonly string[] = ['Space', 'Enter', 'NumpadEnter'];
const METHODS: Readonly<Record<ControlKeysOptions['kind'], readonly string[]>> = {
    action: ['press', 'release'], toggle: ['toggle'], textField: ['edit'], selection: ['next', 'previous', 'first', 'last'],
    scroll: ['line', 'page', 'toStart', 'toEnd'], range: ['stepBy', 'toMin', 'toMax'], movement: ['setDirection'],
};

interface KeyEvent<Payload> { readonly payload: Payload; readonly defaultPrevented: boolean; preventDefault(): void; }
type Down = (event: KeyEvent<KeyboardKeyPayload>) => void;

export function createControlKeys(options: ControlKeysOptions): ControlKeys {
    if (options === null || typeof options !== 'object') throw new EgretError('UI_CONTROL_OPTIONS');
    const { keyboard, target, kind, control } = options;
    const events = keyboard === null || typeof keyboard !== 'object' ? undefined : keyboard.events;
    const methods = typeof kind === 'string' && Object.hasOwn(METHODS, kind) ? METHODS[kind] : undefined;
    if (events === null || typeof events !== 'object' || [events.keyDown, events.keyUp, events.cancel].some(type => type === null || typeof type !== 'object')
        || target === null || typeof target !== 'object' || typeof target.on !== 'function' || methods === undefined
        || control === null || typeof control !== 'object' || methods.some(name => typeof (control as unknown as Record<string, unknown>)[name] !== 'function'))
        throw new EgretError('UI_CONTROL_OPTIONS');
    const onPressChange = options.kind === 'selection' || options.kind === 'scroll' || options.kind === 'range' ? undefined : options.onPressChange;
    if (onPressChange !== undefined && typeof onPressChange !== 'function') throw new EgretError('UI_CONTROL_OPTIONS');

    let closed = false;
    /** The codes this binding holds, in the order they went down. */
    const held = new Set<string>();
    function hold(code: string, down: boolean): void {
        const was = held.size > 0;
        if (down) held.add(code); else held.delete(code);
        if (was !== held.size > 0) onPressChange?.(!was);
    }
    const shortcut = (payload: KeyboardKeyPayload): boolean => payload.altKey || payload.ctrlKey || payload.metaKey;
    let down: Down, release: (code: string, completed: boolean) => void = () => { /* nothing is held */ };

    if (options.kind === 'action' || options.kind === 'toggle' || options.kind === 'textField') {
        const activate = options.kind === 'action' ? () => { options.control.press(); options.control.release(); }
            : options.kind === 'toggle' ? () => { options.control.toggle(); } : () => { options.control.edit(); };
        down = event => {
            const { code, repeat } = event.payload;
            if (!ACTIVATES.includes(code) || shortcut(event.payload) || !control.enabled) return;
            // One key activates at a time. The repeats of the key that is held are taken with it.
            if (held.size === 0 && !repeat) hold(code, true); else if (!held.has(code)) return;
            event.preventDefault();
        };
        release = (code, completed) => {
            hold(code, false);
            if (completed && control.enabled) activate();
        };
    } else if (options.kind === 'selection') {
        const group = options.control, orientation = options.orientation ?? 'both';
        if (orientation !== 'horizontal' && orientation !== 'vertical' && orientation !== 'both') throw new EgretError('UI_CONTROL_OPTIONS');
        const moves: Record<string, () => boolean> = { Home: () => group.first(), End: () => group.last() };
        if (orientation !== 'vertical') { moves.ArrowRight = () => group.next(); moves.ArrowLeft = () => group.previous(); }
        if (orientation !== 'horizontal') { moves.ArrowDown = () => group.next(); moves.ArrowUp = () => group.previous(); }
        down = event => {
            const move = Object.hasOwn(moves, event.payload.code) ? moves[event.payload.code] : undefined;
            if (move === undefined || shortcut(event.payload) || !control.enabled) return;
            // The key is the group's also at an end that does not wrap, as it is in a native group.
            event.preventDefault();
            move();
        };
    } else if (options.kind === 'scroll') {
        const scroll = options.control;
        if (scroll.axis !== 'x' && scroll.axis !== 'y') throw new EgretError('UI_CONTROL_OPTIONS');
        const moves: Record<string, () => boolean> = { PageDown: () => scroll.page(1), PageUp: () => scroll.page(-1), Home: () => scroll.toStart(), End: () => scroll.toEnd() };
        moves[scroll.axis === 'y' ? 'ArrowDown' : 'ArrowRight'] = () => scroll.line(1);
        moves[scroll.axis === 'y' ? 'ArrowUp' : 'ArrowLeft'] = () => scroll.line(-1);
        down = event => {
            const move = Object.hasOwn(moves, event.payload.code) ? moves[event.payload.code] : undefined;
            if (move === undefined || shortcut(event.payload) || !control.enabled) return;
            // At its end the viewport leaves the key to a viewport outside it, or to the page.
            if (move()) event.preventDefault();
        };
    } else if (options.kind === 'range') {
        const range = options.control, orientation = options.orientation ?? 'both', page = options.page ?? 10;
        if ((orientation !== 'horizontal' && orientation !== 'vertical' && orientation !== 'both') || !Number.isSafeInteger(page) || page < 1) throw new EgretError('UI_CONTROL_OPTIONS');
        const moves: Record<string, () => boolean> = { PageUp: () => range.stepBy(page), PageDown: () => range.stepBy(-page), Home: () => range.toMin(), End: () => range.toMax() };
        if (orientation !== 'vertical') { moves.ArrowRight = () => range.stepBy(1); moves.ArrowLeft = () => range.stepBy(-1); }
        if (orientation !== 'horizontal') { moves.ArrowUp = () => range.stepBy(1); moves.ArrowDown = () => range.stepBy(-1); }
        down = event => {
            const move = Object.hasOwn(moves, event.payload.code) ? moves[event.payload.code] : undefined;
            if (move === undefined || shortcut(event.payload) || !control.enabled) return;
            // The key is the slider's also at an end, as it is in a native one: the page does not scroll under it.
            event.preventDefault();
            move();
        };
    } else {
        const movement = options.control, keys = options.keys ?? 'both';
        if (keys !== 'arrows' && keys !== 'wasd' && keys !== 'both') throw new EgretError('UI_CONTROL_OPTIONS');
        const vectors: Readonly<Record<string, Vector>> = { ...(keys === 'wasd' ? {} : ARROWS), ...(keys === 'arrows' ? {} : LETTERS) };
        const steer = (): void => {
            let x = 0, y = 0;
            for (const code of held) { x += vectors[code]![0]; y += vectors[code]![1]; }
            movement.setDirection(x, y);
        };
        down = event => {
            const { code } = event.payload;
            if (!Object.hasOwn(vectors, code) || shortcut(event.payload) || !control.enabled) return;
            event.preventDefault();
            if (held.has(code)) return;
            hold(code, true);
            steer();
        };
        release = code => { hold(code, false); steer(); };
    }

    const subscriptions = [
        target.on(events.keyDown, event => { if (!closed && !event.defaultPrevented) down(event); }),
        target.on(events.keyUp, event => {
            if (closed || !held.has(event.payload.code)) return;
            const taken = event.defaultPrevented;
            event.preventDefault();
            release(event.payload.code, !taken);
        }),
        // The focus left, or the page did, while the key was down.
        target.on(events.cancel, event => { if (!closed && held.has(event.payload.code)) release(event.payload.code, false); }),
    ];

    return Object.freeze({
        get pressed() { return held.size > 0; },
        dispose() {
            if (closed) return;
            closed = true;
            let failure: unknown;
            const was = held.size > 0;
            held.clear();
            if (was) {
                // A direction that was held ends with the binding. A control that is already closed has none.
                if (options.kind === 'movement') try { options.control.setDirection(0, 0); } catch (cause) { if (!(cause instanceof EgretError) || cause.code !== 'UI_CONTROL_CLOSED') failure = cause; }
                try { onPressChange?.(false); } catch (cause) { failure ??= cause; }
            }
            for (const unsubscribe of subscriptions) try { unsubscribe(); } catch (cause) { failure ??= cause; }
            if (failure !== undefined) throw failure;
        },
    });
}
