import { EgretError } from "./EgretError.js";
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
export function createEventType<T>(key: string, options: EventTypeOptions = {}): EventType<T> {
  return Object.freeze({ key, bubbles: options.bubbles ?? false, cancelable: options.cancelable ?? false });
}

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

const states = new WeakMap<object, DispatchState>();

function stateOf(event: object): DispatchState {
  const state = states.get(event);
  if (state === undefined) throw new EgretError("INVALID_EVENT");
  return state;
}

/** One typed payload with synchronous dispatch state; concurrent reuse is rejected. */
export class Event<T> {
  public readonly type: EventType<T>;
  public readonly payload: T;

  public constructor(type: EventType<T>, payload: NoInfer<T>) {
    this.type = type;
    this.payload = payload;
    states.set(this, { active: false, stopped: false, immediate: false, prevented: false, target: undefined, currentTarget: undefined, phase: undefined });
  }

  public get target(): EventDispatcher | undefined { return stateOf(this).target; }
  public get currentTarget(): EventDispatcher | undefined { return stateOf(this).currentTarget; }
  public get eventPhase(): EventPhase | undefined { return stateOf(this).phase; }
  public get defaultPrevented(): boolean { return stateOf(this).prevented; }

  public stopPropagation(): void {
    const state = stateOf(this);
    if (state.active) state.stopped = true;
  }

  public stopImmediatePropagation(): void {
    const state = stateOf(this);
    if (!state.active) return;
    state.stopped = true;
    state.immediate = true;
  }

  public preventDefault(): void {
    const state = stateOf(this);
    if (state.active && this.type.cancelable) state.prevented = true;
  }
}

/** Package-internal state operations, omitted from @egret/engine exports. */
export function beginDispatch(event: object, target: EventDispatcher): DispatchState {
  const state = stateOf(event);
  if (state.active) throw new EgretError("EVENT_ACTIVE");
  state.active = true;
  state.stopped = false;
  state.immediate = false;
  state.prevented = false;
  state.target = target;
  return state;
}

export function visitDispatch(event: object, current: EventDispatcher, phase: EventPhase): void {
  const state = stateOf(event);
  state.currentTarget = current;
  state.phase = phase;
}

/** Keep target/defaultPrevented for inspection; clear transient dispatch pointers. */
export function endDispatch(event: object): void {
  const state = stateOf(event);
  state.active = false;
  state.currentTarget = undefined;
  state.phase = undefined;
}
