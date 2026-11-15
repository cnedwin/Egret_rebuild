import type { DisplayObject } from '@egret/runtime';
import type { HoverInput } from '../hoverInputTypes.js';
import type { PointerInput } from '../pointerInputTypes.js';
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
export declare function createHoverControl(options: HoverControlOptions): HoverControl;
export declare function createToggleControl(options: ToggleControlOptions): ToggleControl;
export declare function createSelectionGroup(options: SelectionGroupOptions): SelectionGroup;
//# sourceMappingURL=stateControls.d.ts.map