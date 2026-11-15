import type { CancellationSignal } from "@egret/contracts";
import { Event } from "./Event.js";
import type { EventType } from "./Event.js";
export interface EventListenerOptions {
    readonly signal?: CancellationSignal;
    readonly capture?: boolean;
    readonly once?: boolean;
    readonly priority?: number;
}
/** Internal caller has admitted this complete route through private display state. */
export declare function dispatchDisplayInputEvent<T>(target: EventDispatcher, event: Event<T>, ancestors: readonly EventDispatcher[]): boolean;
/** Synchronous typed listeners with a frozen route and per-dispatch candidates. */
export declare class EventDispatcher {
    constructor();
    protected assertUsable(): void;
    protected eventParent(): EventDispatcher | undefined;
    /** Async handlers are excluded by types and rejected if returned at runtime. */
    on<T, H extends (event: Event<T>) => unknown>(type: EventType<T>, handler: H & (Extract<ReturnType<H>, PromiseLike<unknown>> extends never ? unknown : never), options?: EventListenerOptions): () => void;
    private candidates;
    /** Ordinary public dispatch retains subclass preflight and route hooks. */
    dispatchEvent<T>(event: Event<T>): boolean;
    protected clearListeners(): void;
}
//# sourceMappingURL=EventDispatcher.d.ts.map