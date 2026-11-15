import type { DisplayObject } from '@egret/runtime';
import type { PointerInput } from '../pointerInputTypes.js';
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
export declare function createRangeControl(options: RangeControlOptions): RangeControl;
//# sourceMappingURL=rangeControl.d.ts.map