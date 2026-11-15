import type { DisplayObject } from '@egret/runtime';
import type { PointerInput } from '../pointerInputTypes.js';
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
export declare function createMovementControl(options: MovementControlOptions): MovementControl;
export declare function createActionControl(options: ActionControlOptions): ActionControl;
//# sourceMappingURL=controls.d.ts.map