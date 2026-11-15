import { AnimationMixer3D } from './Animation3D.js';
import type { AnimationClip3D } from './Animation3D.js';
export declare const STATE_MACHINE3D_LIMITS: Readonly<{
    readonly maxStates: 256;
    readonly maxTransitions: 2048;
    readonly maxTransitionsPerUpdate: 8;
}>;
export type StateParameter3D = number | boolean;
export type StateConditionOperator3D = '>' | '>=' | '<' | '<=' | '==' | '!=';
export interface StateCondition3D {
    readonly parameter: string;
    /** Comparison against `value`. Omit both to test a boolean or a trigger for true. */
    readonly op?: StateConditionOperator3D;
    readonly value?: StateParameter3D;
}
export interface StateBlendEntry3D {
    readonly clip: AnimationClip3D;
    /** Parameter value at which this clip plays alone. */
    readonly threshold: number;
}
export interface StateOptions3D {
    /** A single clip, or omit it and give `blend`. */
    readonly clip?: AnimationClip3D;
    /** Blend neighbouring clips by a numeric parameter, with their phases kept in step. */
    readonly blend?: {
        readonly parameter: string;
        readonly clips: readonly StateBlendEntry3D[];
    };
    /** Repeat (default) or play once and hold the last frame. */
    readonly loop?: boolean;
    readonly speed?: number;
    readonly onEnter?: () => void;
    readonly onExit?: () => void;
}
export interface TransitionOptions3D {
    /** Source state, or '*' for any state. */
    readonly from: string;
    readonly to: string;
    /** Cross-fade length in seconds. */
    readonly duration?: number;
    /** Every condition must hold. With none, the transition needs an exit time. */
    readonly conditions?: readonly StateCondition3D[];
    /** Normalized play time of the source state (1 = one full pass) that must be reached first. */
    readonly exitTime?: number;
    /** Allow this transition to start while another fade is still running. Defaults to true. */
    readonly canInterrupt?: boolean;
}
export declare class AnimationStateMachine3D {
    #private;
    readonly mixer: AnimationMixer3D;
    /** Called after every state change, including forced ones. */
    onStateChange: ((from: string | undefined, to: string) => void) | undefined;
    constructor(mixer: AnimationMixer3D);
    /** Name of the active state; during a fade this is the state being faded in. */
    get current(): string | undefined;
    get isTransitioning(): boolean;
    /** Play time of the active state in passes of its duration. */
    get normalizedTime(): number;
    addState(name: string, options: StateOptions3D): this;
    addTransition(options: TransitionOptions3D): this;
    /** Run `callback` each time `state` passes `normalizedTime` (0 to 1 within one pass). */
    addEvent(state: string, normalizedTime: number, callback: () => void): this;
    set(parameter: string, value: StateParameter3D): this;
    get(parameter: string): StateParameter3D | undefined;
    /** Raise a one-shot flag; the first transition that tests it consumes it. */
    trigger(parameter: string): this;
    resetTrigger(parameter: string): this;
    /** Switch to `state` now, cross-fading over `duration` seconds. */
    play(state: string, duration?: number): this;
    private enter;
    private holds;
    private evaluate;
    private applyState;
    /** Evaluate transitions, advance fades and drive the mixer by `deltaSeconds`. */
    update(deltaSeconds: number): void;
}
export declare function createAnimationStateMachine3D(mixer: AnimationMixer3D): AnimationStateMachine3D;
//# sourceMappingURL=StateMachine3D.d.ts.map