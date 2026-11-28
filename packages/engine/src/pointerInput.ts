// SPDX-License-Identifier: Apache-2.0
import { DisplayObject, DisplayObjectContainer, EgretError, Event, createEventType } from '@egret/runtime';
import { createPointerRouter } from '@egret/runtime/input';
import type { PointerRouter, PointerContact, PointerUpdate, PointerCancelReason } from '@egret/runtime/input';
import type { MouseInputEnginePort } from './mouseInput.js';
import type { Diagnostic } from '@egret/contracts';
import { requireMouseInputEngine } from './internal/mouseInputFactoryState.js';
import { captureUiInputDelivery, registerUiPointerInput } from './internal/uiFactoryState.js';
// The optional browser screen verifier reads this private input-surface association through the existing alias.
export { screenControlFor, screenOccludersFor } from './internal/uiControlReportState.js';
import type {
  PointerInput,
  PointerInputOptions,
  PointerInputEvents,
  PointerNotification,
  PointerSample,
  PointerSession
} from './pointerInputTypes.js';
export type {
  PointerInput,
  PointerInputOptions,
  PointerInputEvents,
  PointerNotification,
  PointerCancelReason,
  PointerContact,
  PointerEventKind,
  PointerSample,
  PointerSession,
  PointerType,
  PointerUpdate,
  PointerRouterState
} from './pointerInputTypes.js';

const getter = (prototype: object, key: string): ((this: DisplayObject) => unknown) =>
  Object.getOwnPropertyDescriptor(prototype, key)!.get!;
const parent = getter(DisplayObject.prototype, 'parent'),
  visible = getter(DisplayObject.prototype, 'visible');
const touch = getter(DisplayObject.prototype, 'touchEnabled'),
  children = getter(DisplayObjectContainer.prototype, 'touchChildren');
type BrowserBeginClaim = (
  sample: PointerSample,
  target: PointerNotification['target']
) => PointerNotification['target'];
interface SurfaceBinding {
  readonly surface: object;
  report(cause: unknown): void;
  onClose(callback: () => void): () => void;
  begin(sample: PointerSample, claimed: () => void): PointerSession | undefined;
  claimBegin(callback: BrowserBeginClaim): () => void;
}
const bindings = new WeakMap<object, SurfaceBinding>();

/** Private browser assembly authority; never exported by the optional public entry. */
export function bindPointerSurface(input: PointerInput): SurfaceBinding {
  const binding = bindings.get(input);
  if (binding === undefined || input.state === 'closed') throw new EgretError('POINTER_INPUT_CLOSED');
  return binding;
}

/** How far, in stage units, a contact may end from where it began and still be a tap. */
const TAP_SLOP = 12;
/** Pointer input for the stage: touches, mouse buttons and pens become contacts delivered to the nodes under them. */
export function createPointerInput(options: PointerInputOptions): PointerInput {
  if (options === null || typeof options !== 'object' || Array.isArray(options))
    throw new EgretError('POINTER_INPUT_OPTIONS_INVALID');
  const engine = options.engine;
  let owner: MouseInputEnginePort | undefined = requireMouseInputEngine(engine);
  const deliver = captureUiInputDelivery(engine);
  let scope: ReturnType<MouseInputEnginePort['scope']> | undefined = owner.scope(options.scope);
  const width = options.width,
    height = options.height,
    maxNodes = options.maxNodes ?? 4096;
  let observer = options.onContact;
  // Late subscribers to the same stream; the creation-time observer keeps its single slot.
  const listeners = new Set<(notification: PointerNotification) => void>();
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0 ||
    !Number.isInteger(maxNodes) ||
    maxNodes < 1 ||
    maxNodes > 65536 ||
    (observer !== undefined && typeof observer !== 'function')
  )
    throw new EgretError('POINTER_INPUT_OPTIONS_INVALID');
  owner.assertReady();
  scope.assertOpen();
  let operations: MouseInputEnginePort['operations'] | undefined = owner.operations;
  const events: PointerInputEvents = Object.freeze({
    begin: createEventType<PointerContact>('egret.pointer.begin', { bubbles: true, cancelable: true }),
    move: createEventType<PointerContact>('egret.pointer.move', { bubbles: true, cancelable: true }),
    end: createEventType<PointerContact>('egret.pointer.end', { bubbles: true, cancelable: true }),
    cancel: createEventType<PointerContact & { readonly reason: PointerCancelReason }>('egret.pointer.cancel', {
      bubbles: true,
      cancelable: false
    }),
    tap: createEventType<PointerContact>('egret.pointer.tap', { bubbles: true, cancelable: false })
  });
  const closers = new Set<() => void>();
  const activeEvents = new Map<PointerSession, Event<PointerContact>>();
  let router: PointerRouter<DisplayObject>,
    input: PointerInput,
    closed = false;
  let releaseEngine: (() => void) | undefined;
  let browserClaim: BrowserBeginClaim | undefined;
  let browserBegin: { readonly sample: PointerSample; readonly claimed: () => void } | undefined;
  let calls = 0;
  const eligible = (target: DisplayObject): boolean => {
    if (owner === undefined || scope === undefined || operations === undefined) return false;
    try {
      owner.assertReady();
      scope.assertOpen();
    } catch {
      return false;
    }
    if (!operations.isAttached(target, maxNodes) || Reflect.apply(touch, target, []) !== true) return false;
    let node: DisplayObject | undefined = target,
      count = 0;
    while (node !== undefined) {
      if (++count > maxNodes) throw new EgretError('HIT_TEST_TREE_LIMIT');
      if (Reflect.apply(visible, node, []) !== true) return false;
      if (node !== target && Reflect.apply(children, node, []) !== true) return false;
      node = Reflect.apply(parent, node, []) as DisplayObject | undefined;
    }
    return true;
  };
  function closeNative(): void {
    if (closed) return;
    closed = true;
    releaseEngine?.();
    releaseEngine = undefined;
    scope?.remove(retire);
    bindings.delete(input);
    const callbacks = [...closers];
    closers.clear();
    let first: unknown,
      failed = false;
    const cleanup: unknown[] = [];
    for (const callback of callbacks)
      try {
        callback();
      } catch (cause) {
        if (!failed) {
          first = cause;
          failed = true;
        } else cleanup.push(cause);
      }
    owner = undefined;
    scope = undefined;
    operations = undefined;
    observer = undefined;
    browserClaim = undefined;
    browserBegin = undefined;
    listeners.clear();
    if (failed) throw new EgretError('POINTER_INPUT_CLEANUP_FAILED', { cause: first, cleanupErrors: cleanup });
  }
  function invoke<T>(operation: () => T): T {
    let value: T | undefined,
      first: unknown,
      failed = false;
    calls++;
    try {
      value = operation();
    } catch (cause) {
      failed = true;
      first = cause;
    } finally {
      calls--;
    }
    if (calls === 0 && router.state === 'closed')
      try {
        closeNative();
      } catch (cause) {
        if (failed) throw new EgretError('POINTER_INPUT_CALLBACK_FAILED', { cause: first, cleanupErrors: [cause] });
        throw cause;
      }
    if (failed) throw first;
    return value as T;
  }
  function retire(): void {
    invoke(() => router.dispose());
  }
  // Where each contact began and on what, for a tap: an end on the same target within TAP_SLOP units of its begin.
  const begun = new Map<
    PointerContact['session'],
    { readonly target: DisplayObject; readonly x: number; readonly y: number }
  >();
  router = createPointerRouter<DisplayObject>({
    ...(options.capacity === undefined ? {} : { capacity: options.capacity }),
    pick: (x, y) => {
      owner!.assertReady();
      scope!.assertOpen();
      const native = browserBegin;
      browserBegin = undefined;
      const target = operations!.pick(x, y, maxNodes);
      // Browser overlays can own one native down before any shared gesture sees the original target.
      if (native === undefined || browserClaim === undefined) return target;
      const claimed = browserClaim(native.sample, target);
      if (claimed === undefined) return target;
      native.claimed();
      return claimed;
    },
    eligible,
    dispatch: (kind, contact, target, reason) =>
      deliver(() => {
        // Termination during capture/target callbacks must stop the older route.
        if (kind === 'cancel') activeEvents.get(contact.session)?.stopImmediatePropagation();
        // Observer receives terminal cleanup even when its display target no longer exists.
        const notification = Object.freeze({ kind, contact, target, ...(reason === undefined ? {} : { reason }) });
        // Presence of a throw is tracked separately from its value: `throw undefined` is still a
        // throw, and swallowing it would leave the channel active and allow an activation.
        let threw = false,
          thrown: unknown;
        try {
          observer?.(notification);
        } catch (cause) {
          threw = true;
          thrown = cause;
        }
        // begin/move/cancel keep the original pre-dispatch observation order, including reentry that
        // cancels from inside a listener. Only `end` is reported after its dispatch attempt.
        if (kind !== 'end')
          for (const listener of [...listeners])
            try {
              listener(notification);
            } catch {
              /* isolated */
            }
        let delivered = false;
        try {
          if (threw) throw thrown;
          if (target === undefined || !eligible(target)) return;
          // A callback may synchronously cancel or close the session before target delivery.
          if (
            (kind === 'begin' || kind === 'move') &&
            !router.contacts.some(value => value.session === contact.session)
          )
            return;
          delivered = true;
          if (kind === 'begin') begun.set(contact.session, { target, x: contact.globalX, y: contact.globalY });
          if (kind === 'cancel')
            operations!.dispatch(
              target,
              Object.freeze(new Event(events.cancel, Object.freeze({ ...contact, reason: reason! }))),
              maxNodes
            );
          else {
            const event = Object.freeze(new Event(events[kind], contact));
            if (kind === 'begin' || kind === 'move') activeEvents.set(contact.session, event);
            try {
              operations!.dispatch(target, event, maxNodes);
            } finally {
              if (activeEvents.get(contact.session) === event) activeEvents.delete(contact.session);
            }
            // A tap follows the end it completes, on the target both were on, unless a listener closed the input.
            const start = kind === 'end' ? begun.get(contact.session) : undefined;
            if (
              start !== undefined &&
              start.target === target &&
              Math.hypot(contact.globalX - start.x, contact.globalY - start.y) <= TAP_SLOP &&
              router.state !== 'closed' &&
              eligible(target)
            )
              operations!.dispatch(target, Object.freeze(new Event(events.tap, contact)), maxNodes);
          }
        } finally {
          if (kind === 'end' || kind === 'cancel') begun.delete(contact.session);
          // `delivered` records that a target path was attempted, not that a particular control ran.
          if (kind === 'end') {
            const observed = Object.freeze({ ...notification, delivered });
            for (const listener of [...listeners])
              try {
                listener(observed);
              } catch {
                /* isolated */
              }
          }
        }
      })
  });
  input = Object.freeze({
    get state() {
      return router.state;
    },
    get contacts() {
      return router.contacts;
    },
    get viewportRevision() {
      return router.viewportRevision;
    },
    events,
    begin: (sample: PointerSample) => invoke(() => router.begin(sample)),
    move: (session: PointerSession, sample: PointerUpdate) => invoke(() => router.move(session, sample)),
    end: (session: PointerSession, sample: PointerUpdate) => invoke(() => router.end(session, sample)),
    cancel: (session: PointerSession, reason: PointerCancelReason) => invoke(() => router.cancel(session, reason)),
    cancelAll: (reason: PointerCancelReason) => invoke(() => router.cancelAll(reason)),
    capture: (session: PointerSession, target: DisplayObject) => invoke(() => router.capture(session, target)),
    releaseCapture: (session: PointerSession) => invoke(() => router.releaseCapture(session)),
    sync: () => invoke(() => router.sync()),
    setViewportRevision: (revision: number) => invoke(() => router.setViewportRevision(revision)),
    setInteractive: (value: boolean) => invoke(() => router.setInteractive(value)),
    dispose: retire,
    observe: (listener: (notification: PointerNotification) => void) => {
      if (typeof listener !== 'function') throw new EgretError('POINTER_INPUT_OPTIONS_INVALID');
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  });
  registerUiPointerInput(
    input,
    engine,
    Object.freeze({ events, state: () => router.state, activeContacts: () => router.contacts.length, sync: input.sync })
  );
  try {
    releaseEngine = owner.onClose(retire);
    scope.add(retire);
    scope.use(input);
    const report: (diagnostic: Diagnostic) => void = owner.report;
    bindings.set(
      input,
      Object.freeze<SurfaceBinding>({
        surface: owner.surface,
        report: cause => report({ code: 'POINTER_INPUT_HOST_FAILED', phase: 'engine', severity: 'error', cause }),
        onClose(callback) {
          if (closed) {
            callback();
            return () => {};
          }
          closers.add(callback);
          return () => {
            closers.delete(callback);
          };
        },
        begin(sample, claimed) {
          if (browserClaim === undefined) return input.begin(sample);
          const previous = browserBegin;
          browserBegin = { sample, claimed };
          try {
            return input.begin(sample);
          } finally {
            browserBegin = previous;
          }
        },
        claimBegin(callback) {
          if (closed) throw new EgretError('POINTER_INPUT_CLOSED');
          if (browserClaim !== undefined) throw new EgretError('POINTER_INPUT_SURFACE_BUSY');
          browserClaim = callback;
          return () => {
            if (browserClaim === callback) browserClaim = undefined;
          };
        }
      })
    );
    owner.assertReady();
    scope.assertOpen();
    return input;
  } catch (cause) {
    try {
      retire();
    } catch (cleanup) {
      throw new EgretError('POINTER_INPUT_SETUP_FAILED', { cause, cleanupErrors: [cleanup] });
    }
    throw cause;
  }
}
