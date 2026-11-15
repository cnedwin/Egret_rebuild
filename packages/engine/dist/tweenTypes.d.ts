import type { Disposable } from '@egret/contracts';
export type TweenEasing = 'linear' | 'quadIn' | 'quadOut' | 'quadInOut';
export type TweenState = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed';
export interface TweenOptions {
    readonly from: number;
    readonly to: number;
    readonly durationSeconds: number;
    readonly easing?: TweenEasing;
    readonly onUpdate: (value: number) => undefined;
    readonly onComplete?: () => undefined;
}
declare const tweenBrand: unique symbol;
export interface Tween extends Disposable {
    readonly [tweenBrand]: true;
    readonly state: TweenState;
    readonly isDisposed: boolean;
    readonly elapsedSeconds: number;
    readonly progress: number;
    readonly value: number;
    start(): void;
    pause(): void;
    resume(): void;
    stop(): void;
    dispose(): void;
}
export {};
//# sourceMappingURL=tweenTypes.d.ts.map