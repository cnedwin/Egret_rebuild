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
    readonly control: {
        readonly enabled: boolean;
        press(): void;
        release(): void;
    };
    readonly onPressChange?: (pressed: boolean) => void;
}
export interface ToggleKeysOptions extends ControlKeysTarget {
    readonly kind: 'toggle';
    readonly control: {
        readonly enabled: boolean;
        toggle(): void;
    };
    readonly onPressChange?: (pressed: boolean) => void;
}
/** The field opens when the key is released, so that the key types nothing into it. */
export interface TextFieldKeysOptions extends ControlKeysTarget {
    readonly kind: 'textField';
    readonly control: {
        readonly enabled: boolean;
        edit(): boolean;
    };
    readonly onPressChange?: (pressed: boolean) => void;
}
/** Arrow keys move the selection, Home and End go to its ends. A held key repeats. */
export interface SelectionKeysOptions extends ControlKeysTarget {
    readonly kind: 'selection';
    readonly control: {
        readonly enabled: boolean;
        next(): boolean;
        previous(): boolean;
        first(): boolean;
        last(): boolean;
    };
    /** Which arrow keys move it. Defaults to 'both'. */
    readonly orientation?: 'horizontal' | 'vertical' | 'both';
}
/** The arrow keys of its axis, Page Up, Page Down, Home and End. A key that moved nothing is left to whatever is outside. */
export interface ScrollKeysOptions extends ControlKeysTarget {
    readonly kind: 'scroll';
    readonly control: {
        readonly enabled: boolean;
        readonly axis: 'x' | 'y';
        line(direction: 1 | -1): boolean;
        page(direction: 1 | -1): boolean;
        toStart(): boolean;
        toEnd(): boolean;
    };
}
/** Arrow keys move the value by one step, Page Up and Page Down by a page of steps, Home and End go to its ends. A held key repeats. */
export interface RangeKeysOptions extends ControlKeysTarget {
    readonly kind: 'range';
    readonly control: {
        readonly enabled: boolean;
        stepBy(steps: number): boolean;
        toMin(): boolean;
        toMax(): boolean;
    };
    /** Which arrow keys move it: Right and Left, Up and Down, or all four. Defaults to 'both'. Right and Up raise the value. */
    readonly orientation?: 'horizontal' | 'vertical' | 'both';
    /** How many steps Page Up and Page Down move. Defaults to 10. */
    readonly page?: number;
}
/** The keys that are down give the direction; opposite keys cancel each other. */
export interface MovementKeysOptions extends ControlKeysTarget {
    readonly kind: 'movement';
    readonly control: {
        readonly enabled: boolean;
        setDirection(x: number, y: number): void;
    };
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
export declare function createControlKeys(options: ControlKeysOptions): ControlKeys;
export {};
//# sourceMappingURL=controlKeys.d.ts.map