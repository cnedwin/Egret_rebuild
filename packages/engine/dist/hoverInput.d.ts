import type { HoverInput, HoverInputOptions } from './hoverInputTypes.js';
export type { HoverInput, HoverInputEvents, HoverInputOptions, HoverInputState, HoverLeaveReason, HoverNotification, HoverPoint, HoverPointerType, HoverSample, HoverState, HoverTransition, WheelNotification, WheelPoint, WheelSample, WheelUnit } from './hoverInputTypes.js';
/**
 * Hover and wheel routing over the display tree of a started Engine. It holds no contact: a press
 * belongs to the pointer input, and a pointer that presses stops hovering until it is released.
 */
export declare function createHoverInput(options: HoverInputOptions): HoverInput;
//# sourceMappingURL=hoverInput.d.ts.map