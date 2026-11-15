import type { EventDispatcher } from "./EventDispatcher.js";
declare const PAYLOAD_TYPE: unique symbol;
/** Descriptor identity and invariant payload type belong together. */
export interface EventType<T> {
    readonly key: string;
    readonly bubbles: boolean;
    readonly cancelable: boolean;
    readonly [PAYLOAD_TYPE]?: (payload: T) => T;
}
export interface EventTypeOptions {
    readonly bubbles?: boolean;
    readonly cancelable?: boolean;
}
/** Matching uses descriptor object identity; equal key strings do not alias types. */
export declare function createEventType<T>(key: string, options?: EventTypeOptions): EventType<T>;
export type EventPhase = "capturing" | "atTarget" | "bubbling";
interface DispatchState {
    active: boolean;
    stopped: boolean;
    immediate: boolean;
    prevented: boolean;
    target: EventDispatcher | undefined;
    currentTarget: EventDispatcher | undefined;
    phase: EventPhase | undefined;
}
/** One typed payload with synchronous dispatch state; concurrent reuse is rejected. */
export declare class Event<T> {
    readonly type: EventType<T>;
    readonly payload: T;
    constructor(type: EventType<T>, payload: NoInfer<T>);
    get target(): EventDispatcher | undefined;
    get currentTarget(): EventDispatcher | undefined;
    get eventPhase(): EventPhase | undefined;
    get defaultPrevented(): boolean;
    stopPropagation(): void;
    stopImmediatePropagation(): void;
    preventDefault(): void;
}
/** Package-internal state operations, omitted from @egret/engine exports. */
export declare function beginDispatch(event: object, target: EventDispatcher): DispatchState;
export declare function visitDispatch(event: object, current: EventDispatcher, phase: EventPhase): void;
/** Keep target/defaultPrevented for inspection; clear transient dispatch pointers. */
export declare function endDispatch(event: object): void;
export {};
//# sourceMappingURL=Event.d.ts.map