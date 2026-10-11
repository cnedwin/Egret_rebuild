import type { CancellationSignal } from "@egret/contracts";
import { EgretError } from "./EgretError.js";
import { Event, beginDispatch, endDispatch, visitDispatch } from "./Event.js";
import type { EventPhase, EventType } from "./Event.js";
import { engineOf } from "./ownership.js";
import { assertLive, isDisplayNode } from "./displayTreeState.js";

export interface EventListenerOptions {
  readonly signal?: CancellationSignal;
  readonly capture?: boolean;
  readonly once?: boolean;
  readonly priority?: number;
}

interface Subscription {
  readonly type: object;
  readonly invoke: (event: object) => unknown;
  readonly capture: boolean;
  readonly once: boolean;
  readonly priority: number;
  readonly sequence: number;
  active: boolean;
  unsubscribe(): void;
}

interface DispatcherState {
  readonly subscriptions: Set<Subscription>;
  nextSequence: number;
}

interface Visit {
  readonly node: EventDispatcher;
  readonly phase: EventPhase;
  readonly candidates: readonly Subscription[];
}

// Input dispatch never establishes listener authority through instance fields.
const dispatcherStates = new WeakMap<EventDispatcher, DispatcherState>();

function stateOf(dispatcher: EventDispatcher): DispatcherState {
  const state = dispatcherStates.get(dispatcher);
  if (state === undefined) throw new EgretError("INVALID_EVENT_DISPATCHER");
  return state;
}

function candidatesOf(dispatcher: EventDispatcher, type: object, capture: boolean): readonly Subscription[] {
  return [...stateOf(dispatcher).subscriptions].filter((entry) => entry.type === type && entry.capture === capture)
    .sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
}

function isCancelled(signal: CancellationSignal | undefined): boolean {
  return signal?.aborted === true;
}

/** Both routes share ordering, active flags and genuine Event dispatch state. */
function executeDispatch<T>(
  target: EventDispatcher,
  event: Event<T>,
  route: () => readonly EventDispatcher[],
  select: (node: EventDispatcher, type: object, capture: boolean) => readonly Subscription[],
): boolean {
  const state = beginDispatch(event, target);
  try {
    const ancestors = route();
    const visits: Visit[] = [];
    for (let index = ancestors.length - 1; index >= 0; index--) {
      const node = ancestors[index];
      if (node !== undefined) visits.push({ node, phase: "capturing", candidates: select(node, event.type, true) });
    }
    // Target groups share one visit so stopPropagation preserves both groups.
    visits.push({ node: target, phase: "atTarget", candidates: [...select(target, event.type, true), ...select(target, event.type, false)] });
    if (event.type.bubbles) {
      for (const node of ancestors) visits.push({ node, phase: "bubbling", candidates: select(node, event.type, false) });
    }
    for (const visit of visits) {
      visitDispatch(event, visit.node, visit.phase);
      for (const candidate of visit.candidates) {
        if (state.immediate) break;
        if (!candidate.active) continue;
        // Remove once-listeners before invocation to prevent reentrant duplicates.
        if (candidate.once) candidate.unsubscribe();
        const returned = candidate.invoke(event);
        if (returned !== null && (typeof returned === "object" || typeof returned === "function") && "then" in returned && typeof returned.then === "function") {
          // Invalid asynchronous handlers must not create an unhandled rejection.
          void Promise.resolve(returned).catch((cause: unknown): void => {
            engineOf(target)?.report({ code: "ASYNC_EVENT_HANDLER_REJECTED", phase: "engine", severity: "error", cause });
          });
          throw new EgretError("ASYNC_EVENT_HANDLER");
        }
      }
      if (state.stopped) break;
    }
    return !state.prevented;
  } finally {
    endDispatch(event);
  }
}

/** Internal caller has admitted this complete route through private display state. */
export function dispatchDisplayInputEvent<T>(
  target: EventDispatcher,
  event: Event<T>,
  ancestors: readonly EventDispatcher[],
): boolean {
  return executeDispatch(target, event, (): readonly EventDispatcher[] => ancestors, candidatesOf);
}

/** Synchronous typed listeners with a frozen route and per-dispatch candidates. */
export class EventDispatcher {
  public constructor() {
    dispatcherStates.set(this, { subscriptions: new Set<Subscription>(), nextSequence: 0 });
  }

  protected assertUsable(): void {}
  protected eventParent(): EventDispatcher | undefined { return undefined; }

  /** Async handlers are excluded by types and rejected if returned at runtime. */
  public on<T, H extends (event: Event<T>) => unknown>(
    type: EventType<T>,
    handler: H & (Extract<ReturnType<H>, PromiseLike<unknown>> extends never ? unknown : never),
    options: EventListenerOptions = {},
  ): () => void {
    this.assertUsable();
    const priority = options.priority ?? 0;
    if (!Number.isFinite(priority) || !Number.isInteger(priority)) throw new EgretError("INVALID_PRIORITY");
    const signal = options.signal;
    if (isCancelled(signal)) return (): void => {};
    const state = stateOf(this);
    const subscription: Subscription = {
      type,
      // Descriptor identity is checked before invoking this erased closure.
      invoke: (event): unknown => handler(event as Event<T>),
      capture: options.capture ?? false,
      once: options.once ?? false,
      priority,
      sequence: state.nextSequence++,
      active: true,
      unsubscribe: (): void => {
        if (!subscription.active) return;
        subscription.active = false;
        state.subscriptions.delete(subscription);
        signal?.removeEventListener("abort", subscription.unsubscribe);
      },
    };
    if (isDisplayNode(this)) assertLive(this);
    state.subscriptions.add(subscription);
    try {
      signal?.addEventListener("abort", subscription.unsubscribe, { once: true });
      // Covers adapters whose cancellation occurs while registering.
      if (isCancelled(signal)) subscription.unsubscribe();
      if (isDisplayNode(this)) assertLive(this);
    } catch (cause) {
      // Local rollback has no adapter callbacks: the handler becomes unreachable
      // before attempting a possibly failing physical abort-listener removal.
      subscription.active = false;
      state.subscriptions.delete(subscription);
      const cleanupErrors: unknown[] = [];
      try { signal?.removeEventListener("abort", subscription.unsubscribe); }
      catch (rollbackCause) { cleanupErrors.push(rollbackCause); }
      throw new EgretError("EVENT_SUBSCRIPTION_FAILED", { cause, cleanupErrors });
    }
    return subscription.unsubscribe;
  }

  private candidates(type: object, capture: boolean): readonly Subscription[] {
    return candidatesOf(this, type, capture);
  }

  /** Ordinary public dispatch retains subclass preflight and route hooks. */
  public dispatchEvent<T>(event: Event<T>): boolean {
    this.assertUsable();
    return executeDispatch(this, event, (): readonly EventDispatcher[] => {
      const ancestors: EventDispatcher[] = [];
      for (let parent = this.eventParent(); parent !== undefined; parent = parent.eventParent()) ancestors.push(parent);
      return ancestors;
    }, (node, type, capture): readonly Subscription[] => node.candidates(type, capture));
  }

  protected clearListeners(): void {
    const failures: unknown[] = [];
    const engine = engineOf(this);
    for (const subscription of [...stateOf(this).subscriptions]) {
      try { subscription.unsubscribe(); }
      catch (cause) {
        if (engine === undefined) failures.push(cause);
        else {
          engine.captureCleanup(cause);
          engine.report({ code: "EVENT_LISTENER_CLEANUP_FAILED", phase: "display-tree", severity: "error", cause });
        }
      }
    }
    if (failures.length !== 0) throw new EgretError("EVENT_LISTENER_CLEANUP_FAILED", { cause: failures[0], cleanupErrors: failures.slice(1) });
  }
}
