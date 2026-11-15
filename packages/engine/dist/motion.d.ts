import type { Scope } from '@egret/runtime';
import type { Engine } from './Engine.js';
/** How a step runs from its start to its end: a name, or a function from 0–1 to 0–1 (it may pass both on the way). */
export type MotionEasing = MotionEasingName | ((fraction: number) => number);
export type MotionEasingName = 'linear' | 'quadIn' | 'quadOut' | 'quadInOut' | 'cubicIn' | 'cubicOut' | 'cubicInOut' | 'quartIn' | 'quartOut' | 'quartInOut' | 'sineIn' | 'sineOut' | 'sineInOut' | 'expoIn' | 'expoOut' | 'expoInOut' | 'backIn' | 'backOut' | 'backInOut' | 'elasticOut' | 'bounceOut';
export type MotionState = 'idle' | 'running' | 'paused' | 'finished' | 'stopped';
/** A chain of steps for one object. Steps are added before `start`; the calls return the motion, so they chain. */
export interface Motion<T extends object> {
    readonly state: MotionState;
    /** Moves the named numbers of the object from what they are when the step begins to these values, over seconds. */
    to(values: {
        readonly [K in keyof T]?: number;
    }, seconds: number, easing?: MotionEasing): this;
    /** Holds for seconds. */
    wait(seconds: number): this;
    /** Calls a function when the chain reaches it. */
    call(callback: () => void): this;
    /** Runs the chain this many times in all; without a number, until it is stopped. */
    loop(times?: number): this;
    /** Called once when the last step of the last run has ended. */
    onFinish(callback: () => void): this;
    start(): this;
    pause(): void;
    resume(): void;
    /** Ends the motion where it is. The object keeps the values it has. */
    stop(): void;
}
/**
 * A motion of one object: `animate(engine, scope, sprite).to({ x: 100, alpha: 0.5 }, 0.5, 'quadOut').wait(0.2).to({ x: 0 }, 0.5).start()`.
 * It runs on the Engine's clock, like a tween, and ends with its scope.
 */
export declare function animate<T extends object>(engine: Engine, scope: Scope, target: T): Motion<T>;
//# sourceMappingURL=motion.d.ts.map