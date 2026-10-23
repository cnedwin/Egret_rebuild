import { EgretError } from '@egret/runtime';
import { bindPointerSurface, createPointerInput } from '#egret-pointer-input';
import type { PointerInput, PointerInputOptions, PointerCancelReason, PointerSession, PointerUpdate } from '#egret-pointer-input';

const APPLY = Reflect.apply;
const ownedSurfaces = new WeakSet<object>();
type Operation = (...args: unknown[]) => unknown;
interface Rectangle { readonly left: number; readonly top: number; readonly width: number; readonly height: number; }
interface Pair { readonly target: EventTarget; readonly type: string; readonly listener: EventListener; readonly capture: boolean; adding: boolean; removed: boolean; }
function getter(prototype: object | undefined, name: string): Operation {
  const operation = prototype === undefined ? undefined : Object.getOwnPropertyDescriptor(prototype, name)?.get;
  if (typeof operation !== 'function') throw new EgretError('POINTER_INPUT_SURFACE_INVALID');
  return operation;
}
function method(prototype: object | undefined, name: string): Operation {
  const operation = prototype === undefined ? undefined : Object.getOwnPropertyDescriptor(prototype, name)?.value;
  if (typeof operation !== 'function') throw new EgretError('POINTER_INPUT_SURFACE_INVALID');
  return operation as Operation;
}
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function sameRectangle(a: Rectangle, b: Rectangle): boolean { return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height; }

/** Pointer Events adapter for the explicit connected, untransformed Canvas profile. */
export function createBrowserPointerInput(options: PointerInputOptions): PointerInput {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new EgretError('POINTER_INPUT_OPTIONS_INVALID');
  const configuration = { ...options };
  const { width, height, onContact } = configuration;
  if (onContact !== undefined && typeof onContact !== 'function') throw new EgretError('POINTER_INPUT_OPTIONS_INVALID');
  const sessions = new Map<number, PointerSession>();
  let ownedSurface: object | undefined;
  const pairs: Pair[] = [];
  let closed = false;
  let capturesInFlight = 0;
  let releaseNative = (_id: number): void => {};
  let removePair = (_pair: Pair): void => {};
  let restoreStyle = (): void => {};
  let removeClose = (): void => {};
  let report = (_cause: unknown): void => {};
  function finalizeCleanup(): void {
    if (!closed || capturesInFlight !== 0 || pairs.some(pair => pair.adding)) return;
    if (ownedSurface !== undefined) { ownedSurfaces.delete(ownedSurface); ownedSurface = undefined; }
    pairs.length = 0;
    releaseNative = () => {}; removePair = () => {}; restoreStyle = () => {}; removeClose = () => {}; report = () => {};
  }
  function cleanup(): void {
    if (closed) return;
    closed = true;
    const failures: unknown[] = [];
    for (const pair of pairs.slice().reverse()) try { removePair(pair); } catch (cause) { failures.push(cause); }
    // Clear logical native ownership before release can synchronously emit lostcapture.
    const ids = [...sessions.keys()]; sessions.clear();
    for (const id of ids) try { releaseNative(id); } catch (cause) { failures.push(cause); }
    try { restoreStyle(); } catch (cause) { failures.push(cause); }
    try { removeClose(); } catch (cause) { failures.push(cause); }
    try { for (const cause of failures) report(cause); } finally { finalizeCleanup(); }
  }
  const input = createPointerInput({
    ...configuration,
    onContact(notification): void {
      const failures: unknown[] = [];
      if (notification.kind === 'end' || notification.kind === 'cancel') {
        const { session } = notification.contact;
        if (sessions.get(session.pointerId) === session) {
          sessions.delete(session.pointerId);
          try { releaseNative(session.pointerId); } catch (cause) { failures.push(cause); }
        }
      }
      // Application terminal cleanup still runs if a native release operation fails.
      try { onContact?.(notification); } catch (cause) { failures.push(cause); }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1) throw new AggregateError(failures, 'Pointer notification failed');
    },
  });
  try {
    const bridge = bindPointerSurface(input);
    const diagnose = bridge.report;
    report = diagnose;
    removeClose = bridge.onClose(cleanup);
    const surface = bridge.surface;
    const win = globalThis.window, document = globalThis.document;
    if (win === undefined || document === undefined) throw new EgretError('POINTER_INPUT_SURFACE_INVALID');
    const canvasBrand = getter(globalThis.HTMLCanvasElement?.prototype, 'width');
    const ownerDocument = getter(globalThis.Node?.prototype, 'ownerDocument');
    const parentNode = getter(globalThis.Node?.prototype, 'parentNode');
    const nodeType = getter(globalThis.Node?.prototype, 'nodeType');
    const connected = getter(globalThis.Node?.prototype, 'isConnected');
    const defaultView = getter(globalThis.Document?.prototype, 'defaultView');
    const visibility = getter(globalThis.Document?.prototype, 'visibilityState');
    const inlineStyle = getter(globalThis.HTMLElement?.prototype, 'style');
    const styleValue = method(globalThis.CSSStyleDeclaration?.prototype, 'getPropertyValue');
    const stylePriority = method(globalThis.CSSStyleDeclaration?.prototype, 'getPropertyPriority');
    const styleSet = method(globalThis.CSSStyleDeclaration?.prototype, 'setProperty');
    const styleRemove = method(globalThis.CSSStyleDeclaration?.prototype, 'removeProperty');
    const rectangle = method(globalThis.Element?.prototype, 'getBoundingClientRect');
    const rectLeft = getter(globalThis.DOMRectReadOnly?.prototype, 'left');
    const rectTop = getter(globalThis.DOMRectReadOnly?.prototype, 'top');
    const rectWidth = getter(globalThis.DOMRectReadOnly?.prototype, 'width');
    const rectHeight = getter(globalThis.DOMRectReadOnly?.prototype, 'height');
    const setCapture = method(globalThis.Element?.prototype, 'setPointerCapture');
    const hasCapture = method(globalThis.Element?.prototype, 'hasPointerCapture');
    const releaseCapture = method(globalThis.Element?.prototype, 'releasePointerCapture');
    const add = method(globalThis.EventTarget?.prototype, 'addEventListener');
    const remove = method(globalThis.EventTarget?.prototype, 'removeEventListener');
    const eventType = getter(globalThis.Event?.prototype, 'type');
    const timestamp = getter(globalThis.Event?.prototype, 'timeStamp');
    const pointerId = getter(globalThis.PointerEvent?.prototype, 'pointerId');
    const pointerType = getter(globalThis.PointerEvent?.prototype, 'pointerType');
    const pressure = getter(globalThis.PointerEvent?.prototype, 'pressure');
    const contactWidth = getter(globalThis.PointerEvent?.prototype, 'width');
    const contactHeight = getter(globalThis.PointerEvent?.prototype, 'height');
    const clientX = getter(globalThis.MouseEvent?.prototype, 'clientX');
    const clientY = getter(globalThis.MouseEvent?.prototype, 'clientY');
    const buttons = getter(globalThis.MouseEvent?.prototype, 'buttons');
    const computedStyle = win.getComputedStyle;
    if (typeof computedStyle !== 'function') throw new EgretError('POINTER_INPUT_SURFACE_INVALID');
    function assertOpen(): void { if (closed || input.state === 'closed') throw new EgretError('POINTER_INPUT_CLOSED'); }
    function dom(operation: Operation, receiver: unknown, args: readonly unknown[] = []): unknown {
      assertOpen();
      const value = APPLY(operation, receiver, args);
      assertOpen();
      return value;
    }
    function css(style: unknown, name: string): string {
      const value = dom(styleValue, style, [name]);
      if (typeof value !== 'string') throw new EgretError('POINTER_INPUT_SURFACE_INVALID');
      return value.trim();
    }
    function profile(): Rectangle {
      dom(canvasBrand, surface);
      if (dom(ownerDocument, surface) !== document || dom(defaultView, document) !== win || dom(connected, surface) !== true) throw new EgretError('POINTER_INPUT_SURFACE_INVALID');
      let current: unknown = surface;
      const seen = new Set<unknown>();
      // Ordinary ancestors only: unsupported transforms/shadow roots are refused.
      while (current !== document) {
        if (current === null || current === undefined || seen.has(current) || seen.size >= 64 || dom(nodeType, current) !== 1) throw new EgretError('POINTER_INPUT_SURFACE_INVALID');
        seen.add(current);
        const style = dom(computedStyle as Operation, win, [current]);
        if (['transform', 'perspective', 'translate', 'rotate', 'scale'].some(name => css(style, name) !== 'none')) throw new EgretError('POINTER_INPUT_SURFACE_INVALID');
        const zoom = css(style, 'zoom');
        if (zoom !== 'normal' && zoom !== '1') throw new EgretError('POINTER_INPUT_SURFACE_INVALID');
        if (current === surface) {
          const edges = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'];
          if (css(style, 'object-fit') !== 'fill' || edges.some(name => { const value = css(style, name); return value !== '0px' && value !== '0'; })) throw new EgretError('POINTER_INPUT_SURFACE_INVALID');
        }
        current = dom(parentNode, current);
      }
      const value = dom(rectangle, surface);
      const left = dom(rectLeft, value), top = dom(rectTop, value), width = dom(rectWidth, value), height = dom(rectHeight, value);
      if (!finite(left) || !finite(top) || !finite(width) || !finite(height) || width <= 0 || height <= 0) throw new EgretError('POINTER_INPUT_SURFACE_INVALID');
      return { left, top, width, height };
    }
    let bounds = profile();
    if (ownedSurfaces.has(surface)) throw new EgretError('POINTER_INPUT_SURFACE_BUSY');
    ownedSurfaces.add(surface); ownedSurface = surface;
    releaseNative = (id): void => {
      if (APPLY(hasCapture, surface, [id]) === true) APPLY(releaseCapture, surface, [id]);
    };
    removePair = pair => {
      if (pair.adding || pair.removed) return;
      pair.removed = true;
      APPLY(remove, pair.target, [pair.type, pair.listener, pair.capture]);
    };
    const style = dom(inlineStyle, surface);
    const previousValue = dom(styleValue, style, ['touch-action']);
    const previousPriority = dom(stylePriority, style, ['touch-action']);
    if (typeof previousValue !== 'string' || typeof previousPriority !== 'string') throw new EgretError('POINTER_INPUT_SURFACE_INVALID');
    let styleChanged = true;
    restoreStyle = (): void => {
      if (!styleChanged) return;
      styleChanged = false;
      if (previousValue === '') APPLY(styleRemove, style, ['touch-action']);
      else APPLY(styleSet, style, ['touch-action', previousValue, previousPriority]);
    };
    // Set before the first pointerdown: changing touch-action during a gesture is too late.
    dom(styleSet, style, ['touch-action', 'none', 'important']);
    function fail(cause: unknown): void {
      cleanup();
      try { if (input.state !== 'closed') input.cancelAll('error'); }
      catch (secondary) { diagnose(secondary); }
      finally { try { input.dispose(); } catch (secondary) { diagnose(secondary); } }
      diagnose(cause);
    }
    function guard(action: () => void): void {
      if (closed) return;
      try { action(); }
      catch (cause) {
        if (cause instanceof EgretError && cause.code === 'POINTER_INPUT_CAPACITY') diagnose(cause);
        else fail(cause);
      }
    }
    function cancel(reason: PointerCancelReason): void { input.cancelAll(reason); }
    function refresh(force: boolean): Rectangle {
      const next = profile();
      if (force || !sameRectangle(bounds, next)) {
        // Cancellation uses the old revision; only fresh downs use the new mapping.
        cancel('viewport');
        assertOpen();
        // A terminal observer may itself commit another CSS layout change.
        const committed = profile();
        input.setViewportRevision(input.viewportRevision + 1);
        bounds = committed;
      }
      return bounds;
    }
    function identify(event: unknown): { id: number; type: 'mouse' | 'touch' | 'pen' } | undefined {
      let id: unknown;
      try { id = APPLY(pointerId, event, []); } catch { return undefined; }
      const type = APPLY(pointerType, event, []);
      if (!finite(id) || !Number.isSafeInteger(id) || id < 0 || (type !== 'mouse' && type !== 'touch' && type !== 'pen')) return undefined;
      return { id, type };
    }
    function update(event: unknown, rect: Rectangle): PointerUpdate {
      const x = APPLY(clientX, event, []), y = APPLY(clientY, event, []);
      const heldButtons = APPLY(buttons, event, []), time = APPLY(timestamp, event, []);
      const p = APPLY(pressure, event, []), w = APPLY(contactWidth, event, []), h = APPLY(contactHeight, event, []);
      if (!finite(x) || !finite(y) || !finite(heldButtons) || !finite(time) || !finite(p) || !finite(w) || !finite(h)) throw new EgretError('POINTER_INPUT_EVENT_INVALID');
      // Map CSS coordinates once. Device pixel ratio belongs to rendering only.
      return { globalX: (x - rect.left) * width / rect.width, globalY: (y - rect.top) * height / rect.height, buttons: heldButtons, timestamp: time, pressure: p, width: w, height: h };
    }
    function acquireNative(id: number, session: PointerSession): void {
      capturesInFlight++;
      let failed = false, failure: unknown;
      try { dom(setCapture, surface, [id]); }
      catch (cause) { failed = true; failure = cause; throw cause; }
      finally {
        try {
          // A controlled native operation may close/cancel before completing capture.
          // Compensate after it returns, while retaining this surface's ownership.
          if (closed || sessions.get(id) !== session) {
            try { if (APPLY(hasCapture, surface, [id]) === true) APPLY(releaseCapture, surface, [id]); }
            catch (cause) {
              if (failed) throw new EgretError('POINTER_INPUT_NATIVE_FAILED', { cause: failure, cleanupErrors: [cause] });
              throw cause;
            }
          }
        } finally { capturesInFlight--; finalizeCleanup(); }
      }
    }
    function pointer(event: Event, kind: 'down' | 'move' | 'up' | 'cancel' | 'lost'): void {
      const identity = identify(event);
      if (identity === undefined || (kind !== 'down' && !sessions.has(identity.id))) return;
      const rect = refresh(false);
      if (kind === 'down') {
        if (sessions.has(identity.id) || input.state !== 'active' || dom(visibility, document) !== 'visible') return;
        const session = input.begin({ pointerId: identity.id, pointerType: identity.type, ...update(event, rect) });
        // A begin observer may synchronously cancel, suspend or close the input.
        if (session === undefined || closed || !input.contacts.some(contact => contact.session === session)) return;
        sessions.set(identity.id, session);
        acquireNative(identity.id, session);
        return;
      }
      const session = sessions.get(identity.id);
      if (session === undefined || session.pointerType !== identity.type) return;
      if (kind === 'move') input.move(session, update(event, rect));
      else if (kind === 'up') input.end(session, update(event, rect));
      else input.cancel(session, kind === 'cancel' ? 'pointercancel' : 'lostcapture');
    }
    function listen(target: EventTarget, type: string, capture: boolean, action: (event: Event) => void): void {
      assertOpen();
      const listener: EventListener = event => guard(() => {
        if (APPLY(eventType, event, []) === type) action(event);
      });
      const pair: Pair = { target, type, listener, capture, adding: true, removed: false };
      pairs.push(pair);
      let failed = false, failure: unknown;
      try { APPLY(add, target, [type, listener, capture]); }
      catch (cause) { failed = true; failure = cause; throw cause; }
      finally {
        pair.adding = false;
        if (closed) {
          try { removePair(pair); }
          catch (cause) {
            if (failed) throw new EgretError('POINTER_INPUT_NATIVE_FAILED', { cause: failure, cleanupErrors: [cause] });
            throw cause;
          } finally { finalizeCleanup(); }
        }
      }
      assertOpen();
    }
    listen(surface as EventTarget, 'pointerdown', false, event => pointer(event, 'down'));
    listen(win, 'pointermove', true, event => pointer(event, 'move'));
    listen(win, 'pointerup', true, event => pointer(event, 'up'));
    listen(win, 'pointercancel', true, event => pointer(event, 'cancel'));
    listen(surface as EventTarget, 'lostpointercapture', false, event => pointer(event, 'lost'));
    listen(win, 'blur', false, () => cancel('blur'));
    listen(win, 'pagehide', false, () => cancel('pagehide'));
    listen(document, 'visibilitychange', false, () => { if (dom(visibility, document) !== 'visible') cancel('hidden'); });
    listen(win, 'resize', false, () => { refresh(true); });
    listen(win, 'orientationchange', false, () => { refresh(true); });
    listen(win, 'scroll', true, () => { refresh(true); });
    const viewport = win.visualViewport;
    if (viewport !== null && viewport !== undefined) {
      listen(viewport, 'resize', false, () => { refresh(true); });
      listen(viewport, 'scroll', false, () => { refresh(true); });
    }
    // Restoration is intentionally application-owned: host readiness must precede resume.
    listen(surface as EventTarget, 'webglcontextlost', false, () => input.setInteractive(false));
    return input;
  } catch (cause) {
    cleanup();
    try { input.dispose(); } catch (secondary) { report(secondary); }
    throw new EgretError('POINTER_INPUT_SURFACE_INVALID', { cause });
  }
}
