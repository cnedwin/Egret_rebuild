import { EgretError } from '@egret/runtime';
import { createMouseInputWithNative } from '#egret-mouse-input';
import type { MouseInputNativeFactory, MouseInputNativeKind, MouseInputNativeListener, MouseInputNativePair, MouseInputPoint, MouseInput, MouseInputOptions } from '#egret-mouse-input';

const APPLY = Reflect.apply;
function getter(prototype: object | undefined, key: string): ((...args: unknown[]) => unknown) | undefined {
  if (prototype === undefined) return undefined;
  return Object.getOwnPropertyDescriptor(prototype, key)?.get;
}
function domRead(operation: (...args: unknown[]) => unknown, receiver: unknown, args: readonly unknown[] = []): unknown {
  try { return APPLY(operation, receiver, args); }
  catch (cause) { throw new EgretError('MOUSE_INPUT_SURFACE_INVALID', { cause }); }
}
function scalarRead(operation: (...args: unknown[]) => unknown, receiver: unknown): unknown {
  try { return APPLY(operation, receiver, []); }
  catch (cause) { throw new EgretError('MOUSE_INPUT_EVENT_INVALID', { cause }); }
}
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }

/** Capture only when an authentic ready Engine/Scope and scalar options have been admitted. */
const browserPorts: MouseInputNativeFactory = (surface, width, height, assertLive) => {
  let win: Window, document: Document;
  let canvasBrand: ReturnType<typeof getter>, ownerDocument: ReturnType<typeof getter>, parentNode: ReturnType<typeof getter>, nodeType: ReturnType<typeof getter>;
  let defaultView: ReturnType<typeof getter>, left: ReturnType<typeof getter>, top: ReturnType<typeof getter>, rectWidth: ReturnType<typeof getter>, rectHeight: ReturnType<typeof getter>;
  let eventType: ReturnType<typeof getter>, pointerId: ReturnType<typeof getter>, pointerType: ReturnType<typeof getter>, primary: ReturnType<typeof getter>;
  let button: ReturnType<typeof getter>, clientX: ReturnType<typeof getter>, clientY: ReturnType<typeof getter>;
  let computedStyle: typeof window.getComputedStyle | undefined;
  let styleValue: typeof CSSStyleDeclaration.prototype.getPropertyValue | undefined;
  let rectangle: typeof Element.prototype.getBoundingClientRect | undefined;
  let add: typeof EventTarget.prototype.addEventListener | undefined, remove: typeof EventTarget.prototype.removeEventListener | undefined;
  try {
    win = globalThis.window; document = globalThis.document;
    canvasBrand = getter(globalThis.HTMLCanvasElement?.prototype, 'width');
    ownerDocument = getter(globalThis.Node?.prototype, 'ownerDocument'); parentNode = getter(globalThis.Node?.prototype, 'parentNode'); nodeType = getter(globalThis.Node?.prototype, 'nodeType');
    defaultView = getter(globalThis.Document?.prototype, 'defaultView');
    left = getter(globalThis.DOMRectReadOnly?.prototype, 'left'); top = getter(globalThis.DOMRectReadOnly?.prototype, 'top');
    rectWidth = getter(globalThis.DOMRectReadOnly?.prototype, 'width'); rectHeight = getter(globalThis.DOMRectReadOnly?.prototype, 'height');
    eventType = getter(globalThis.Event?.prototype, 'type'); pointerId = getter(globalThis.PointerEvent?.prototype, 'pointerId');
    pointerType = getter(globalThis.PointerEvent?.prototype, 'pointerType'); primary = getter(globalThis.PointerEvent?.prototype, 'isPrimary');
    button = getter(globalThis.MouseEvent?.prototype, 'button'); clientX = getter(globalThis.MouseEvent?.prototype, 'clientX'); clientY = getter(globalThis.MouseEvent?.prototype, 'clientY');
    computedStyle = win?.getComputedStyle; styleValue = globalThis.CSSStyleDeclaration?.prototype.getPropertyValue;
    rectangle = globalThis.Element?.prototype.getBoundingClientRect;
    add = globalThis.EventTarget?.prototype.addEventListener; remove = globalThis.EventTarget?.prototype.removeEventListener;
  } catch (cause) { throw new EgretError('MOUSE_INPUT_SURFACE_INVALID', { cause }); }
  assertLive();
  const required = [canvasBrand, ownerDocument, parentNode, nodeType, defaultView, left, top, rectWidth, rectHeight,
    eventType, pointerId, pointerType, primary, button, clientX, clientY, computedStyle, styleValue, rectangle, add, remove];
  if (win === undefined || document === undefined || required.some(value => typeof value !== 'function')) throw new EgretError('MOUSE_INPUT_SURFACE_INVALID');
  // Native getters establish identity without consulting canvas or document own fields.
  domRead(canvasBrand!, surface);
  const actualDocument = domRead(ownerDocument!, surface);
  const actualWindow = domRead(defaultView!, actualDocument);
  assertLive();
  if (actualDocument !== document || actualWindow !== win) throw new EgretError('MOUSE_INPUT_SURFACE_INVALID');

  function canonical(style: unknown, name: string): string {
    const value = domRead(styleValue! as (...args: unknown[]) => unknown, style, [name]);
    assertLive();
    if (typeof value !== 'string') throw new EgretError('MOUSE_INPUT_SURFACE_INVALID');
    return value.trim();
  }
  function profile(): { readonly left: number; readonly top: number; readonly width: number; readonly height: number } {
    let current: unknown = surface;
    const seen = new Set<unknown>();
    // MI1 control: inspect the complete ordinary CSS ancestor chain, not just the canvas.
    while (current !== document) {
      assertLive();
      if (current === null || current === undefined || seen.has(current) || seen.size >= 64) throw new EgretError('MOUSE_INPUT_SURFACE_INVALID');
      const type = domRead(nodeType!, current);
      assertLive();
      if (type !== 1) throw new EgretError('MOUSE_INPUT_SURFACE_INVALID');
      seen.add(current);
      const style = domRead(computedStyle! as (...args: unknown[]) => unknown, win, [current]);
      const transforms = ['transform', 'perspective', 'translate', 'rotate', 'scale'].map(name => canonical(style, name));
      const zoom = canonical(style, 'zoom');
      assertLive();
      if (transforms.some(value => value !== 'none') || (zoom !== 'normal' && zoom !== '1')) throw new EgretError('MOUSE_INPUT_SURFACE_INVALID');
      if (current === surface) {
        const fitting = canonical(style, 'object-fit');
        const edges = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'].map(name => canonical(style, name));
        assertLive();
        if (fitting !== 'fill' || edges.some(value => value !== '0px' && value !== '0')) throw new EgretError('MOUSE_INPUT_SURFACE_INVALID');
      }
      current = domRead(parentNode!, current);
    }
    const rect = domRead(rectangle! as (...args: unknown[]) => unknown, surface);
    const x = domRead(left!, rect), y = domRead(top!, rect), w = domRead(rectWidth!, rect), h = domRead(rectHeight!, rect);
    assertLive();
    if (!finite(x) || !finite(y) || !finite(w) || !finite(h) || w <= 0 || h <= 0) throw new EgretError('MOUSE_INPUT_SURFACE_INVALID');
    return Object.freeze({ left: x, top: y, width: w, height: h });
  }
  profile();
  const pair = (target: EventTarget, type: string, capture: boolean, kind: MouseInputNativeKind): MouseInputNativePair => Object.freeze({
    kind,
    add(listener: MouseInputNativeListener): void { APPLY(add!, target, [type, listener, capture]); },
    remove(listener: MouseInputNativeListener): void { APPLY(remove!, target, [type, listener, capture]); },
  });
  const pairs = Object.freeze([
    pair(surface as HTMLCanvasElement, 'pointerdown', false, 'down'),
    pair(win, 'pointerup', true, 'up'), pair(win, 'pointercancel', true, 'cancel'),
    pair(win, 'blur', false, 'blur'), pair(win, 'pagehide', false, 'pagehide'),
  ]);
  return Object.freeze({
    pairs,
    pointer(event: unknown, kind: 'down' | 'up' | 'cancel', heldId: number | undefined): number | undefined {
      let id: unknown;
      // A native PointerEvent getter refuses foreign/non-pointer receivers; ignore those values.
      try { id = APPLY(pointerId!, event, []); } catch { return undefined; }
      if (!finite(id) || !Number.isSafeInteger(id) || id < 0) return undefined;
      if (scalarRead(pointerType!, event) !== 'mouse' || scalarRead(primary!, event) !== true) return undefined;
      if (kind !== 'cancel' && scalarRead(button!, event) !== 0) return undefined;
      if (kind !== 'down' && id !== heldId) return undefined;
      if (kind !== 'cancel' && scalarRead(eventType!, event) !== (kind === 'down' ? 'pointerdown' : 'pointerup')) return undefined;
      return id;
    },
    windowEvent(event: unknown, kind: 'blur' | 'pagehide'): boolean {
      try { return APPLY(eventType!, event, []) === kind; } catch { return false; }
    },
    point(event: unknown): MouseInputPoint {
      const rect = profile();
      const x = scalarRead(clientX!, event), y = scalarRead(clientY!, event);
      assertLive();
      if (!finite(x) || !finite(y)) throw new EgretError('MOUSE_INPUT_EVENT_INVALID');
      // MI1 control: fresh CSS rectangle maps to logical coordinates without DPR.
      const globalX = (x - rect.left) * width / rect.width;
      const globalY = (y - rect.top) * height / rect.height;
      if (!finite(globalX) || !finite(globalY)) throw new EgretError('MOUSE_INPUT_EVENT_INVALID');
      return Object.freeze({ x: globalX, y: globalY });
    },
  });
};

/** Primary mouse activation for the admitted ordinary desktop Canvas layout profile. */
export function createMouseInput(options: MouseInputOptions): MouseInput { return createMouseInputWithNative(options, browserPorts); }
