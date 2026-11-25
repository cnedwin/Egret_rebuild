// SPDX-License-Identifier: Apache-2.0
// Controls on the glass for a game played by keys: a stick that counts in `keys.axis()`, and buttons that hold keys.
// A game written for the keyboard is played on a phone by adding them. They are drawn over the ui layer once a finger
// has touched the stage, or at once with `always`. Each finger keeps the control it started on until it lifts.
import { Sprite } from '@egret/engine';
import type { DisplayObject } from '@egret/runtime';
import { claimBrowserPointerBegin, wasBrowserPointerDownClaimed } from './BrowserPointerInput.js';
import type { PointerCancelReason, PointerSample, PointerSession } from './BrowserPointerInput.js';
import type { PlayGame } from './BrowserPlay.js';
import type { ViewRect } from './view.js';

/** A floating stick starts under a fresh touch in this part of the Play design. */
export interface PlayFloatingStickOptions {
  /** A rectangle in game units, or a function that reads the current layout for each new touch. */
  readonly area: ViewRect | (() => ViewRect);
  /** Movement ignored around the origin, in CSS pixels. Defaults to 8. */
  readonly deadZonePx?: number;
  /** Reserve part of the rectangle for other controls. Called with game coordinates. */
  readonly exclude?: (x: number, y: number) => boolean;
}

/** A touch stick to show: where, how large, and whether it shows without touch. */
export interface PlayStickOptions {
  /** The middle of the stick. Near the bottom left of the stage unless given. */
  readonly x?: number;
  readonly y?: number;
  /** How far the knob moves; 48 unless given. */
  readonly radius?: number;
  /** Show a fixed stick before any finger has touched the stage. */
  readonly always?: boolean;
  /** Use a touch origin instead of the fixed position. Its ring is visible only during an owned touch. */
  readonly floating?: PlayFloatingStickOptions;
}
/** A touch button to show: where, the key it presses, how large, its color, and whether it shows without touch. */
export interface PlayTouchButtonOptions {
  readonly x: number;
  readonly y: number;
  /** The key it holds while a finger is on it: `'space'` unless given. Any name `keys.down` takes. */
  readonly key?: string;
  readonly radius?: number;
  readonly color?: number;
  readonly always?: boolean;
}
/** What the controls tell the game: keys held and let go, and where the stick is. */
export interface PlayTouchPort {
  hold(key: string): void;
  letGo(key: string): void;
  stick(x: number, y: number): void;
  /** A stage place for a place of the page. */
  toStage(clientX: number, clientY: number): { x: number; y: number };
  /** CSS pixels per frame unit, independently for each axis. */
  cssScale(): { x: number; y: number };
  allowFloating(): boolean;
  failed(cause: unknown): void;
  /** The layer the controls are drawn on: over the ui, so a box of words does not hide them. */
  readonly layer: Sprite;
}
interface Control {
  readonly node: Sprite;
  readonly always: boolean;
  readonly x: number;
  readonly y: number;
  readonly reach: number;
  readonly stick?: true;
  owner: number | undefined;
  readonly press: (x: number, y: number) => void;
  readonly drag: (x: number, y: number) => void;
  readonly release: () => void;
}
interface FloatingStick {
  readonly node: Sprite;
  readonly knob: Sprite;
  readonly options: PlayFloatingStickOptions;
  readonly reach: number;
  readonly deadZone: number;
}
interface FloatingContact {
  readonly stick: FloatingStick;
  readonly session: PointerSession;
  readonly x: number;
  readonly y: number;
  readonly scale: { x: number; y: number };
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function area(value: ViewRect): ViewRect {
  const { x, y, width, height } = value ?? {};
  if (![x, y, width, height, x + width, y + height].every(finite) || width <= 0 || height <= 0)
    throw new TypeError('a floating touch stick needs a finite area with positive width and height');
  return { x, y, width, height };
}

/** The controls of one game. `claim` is asked first for each press: a press it takes is not the game's pointer. */
export function createPlayTouch(
  game: PlayGame,
  port: PlayTouchPort
): {
  stick(options?: PlayStickOptions): Sprite;
  button(words: string, options: PlayTouchButtonOptions): Sprite;
  claim(event: PointerEvent): boolean;
  move(event: PointerEvent): void;
  end(event: PointerEvent): boolean;
  sync(): void;
  cancelFloating(reason?: PointerCancelReason): void;
  cancel(): void;
  reset(): void;
} {
  let controls: Control[] = [];
  let floating: FloatingStick[] = [];
  let active: FloatingContact | undefined;
  let captureTarget: Sprite | undefined;
  let pending:
    | { readonly id: number; readonly item: FloatingStick; readonly x: number; readonly y: number }
    | undefined;
  let bound = false;
  let seen = false;
  const pointer = game.browser.pointer;
  const show = (): void => {
    for (const control of controls) control.node.visible = seen || control.always;
  };
  const notice = (): void => {
    if (seen) return;
    controls = controls.filter(control => !control.node.isDisposed);
    seen = true;
    show();
  };
  const over = (control: Control, x: number, y: number): boolean =>
    !control.node.isDisposed && control.node.visible && Math.hypot(x - control.x, y - control.y) <= control.reach;
  const drawStick = (reach: number): { node: Sprite; knob: Sprite } => {
    const node = game.sprite(g => {
      g.beginFill(0xffffff, 0.12).drawCircle(0, 0, reach).endFill();
      g.lineStyle(2, 0xffffff, 0.3).drawCircle(0, 0, reach);
    }, port.layer);
    const knob = game.sprite(
      g =>
        g
          .beginFill(0xffffff, 0.45)
          .drawCircle(0, 0, reach * 0.42)
          .endFill(),
      node
    );
    return { node, knob };
  };
  const place = (knob: Sprite, reach: number, dx: number, dy: number): void => {
    const length = Math.hypot(dx, dy);
    if (length > reach) {
      dx = (dx / length) * reach;
      dy = (dy / length) * reach;
    }
    knob.x = dx;
    knob.y = dy;
    port.stick(dx / reach, dy / reach);
  };
  const hud = (target: DisplayObject | undefined): boolean => {
    for (let node = target; node !== undefined; node = node.parent)
      if (node === game.ui || node === port.layer) return true;
    return false;
  };
  const attached = (item: FloatingStick): boolean =>
    game.scope.state === 'open' &&
    port.layer.parent === game.browser.stage &&
    captureTarget?.parent === port.layer &&
    !item.node.isDisposed &&
    item.node.parent === port.layer &&
    !item.knob.isDisposed &&
    item.knob.parent === item.node;
  const canFloat = (item: FloatingStick): boolean => active === undefined && attached(item) && port.allowFloating();
  const select = (sample: PointerSample, target: DisplayObject | undefined): DisplayObject | undefined => {
    pending = undefined;
    if (sample.pointerType !== 'touch' || floating.length === 0) return undefined;
    notice();
    const x = sample.globalX - port.layer.x,
      y = sample.globalY - port.layer.y;
    if (
      active !== undefined ||
      !port.allowFloating() ||
      hud(target) ||
      controls.some(control => (control.stick === true && control.owner !== undefined) || over(control, x, y))
    )
      return undefined;
    const group = floating;
    for (const item of group) {
      if (!canFloat(item)) continue;
      const options = item.options;
      try {
        const rect = area(typeof options.area === 'function' ? options.area() : options.area);
        if (
          x < rect.x ||
          x >= rect.x + rect.width ||
          y < rect.y ||
          y >= rect.y + rect.height ||
          options.exclude?.(x, y)
        )
          continue;
      } catch (cause) {
        if (group === floating && !item.node.isDisposed) port.failed(cause);
        return undefined;
      }
      // An app callback can reset the round, pause, or remove the control during admission.
      if (group !== floating || !canFloat(item)) return undefined;
      pending = { id: sample.pointerId, item, x, y };
      return captureTarget;
    }
    return undefined;
  };
  const finishFloating = (reason?: PointerCancelReason): void => {
    const contact = active;
    if (contact === undefined) return;
    active = undefined;
    try {
      if (reason !== undefined && pointer?.state !== 'closed') pointer?.cancel(contact.session, reason);
    } finally {
      const { node, knob } = contact.stick;
      if (!node.isDisposed) node.visible = false;
      if (!knob.isDisposed) knob.x = knob.y = 0;
      port.stick(0, 0);
    }
  };
  const bindFloating = (): void => {
    if (bound || pointer === undefined) return;
    const offClaim = claimBrowserPointerBegin(pointer, select);
    const offTap = game.browser.stage.on(
      pointer.events.tap,
      event => {
        if (active?.session === event.payload.session) event.stopImmediatePropagation();
      },
      { capture: true, priority: Number.MAX_SAFE_INTEGER }
    );
    const offContact = pointer.observe(({ kind, contact, target }) => {
      if (kind === 'begin') {
        const selected = pending;
        pending = undefined;
        if (target === undefined || target !== captureTarget || selected?.id !== contact.session.pointerId) return;
        if (!canFloat(selected.item)) {
          pointer.cancel(contact.session, 'suspended');
          return;
        }
        const { item, x, y } = selected;
        active = {
          stick: item,
          session: contact.session,
          x: contact.globalX,
          y: contact.globalY,
          scale: port.cssScale()
        };
        item.node.x = x;
        item.node.y = y;
        item.node.visible = true;
        port.stick(0, 0);
        return;
      }
      if (active?.session !== contact.session) return;
      if (kind !== 'move' || !port.allowFloating()) {
        finishFloating(kind === 'move' ? 'suspended' : undefined);
        return;
      }
      const { stick, scale, x, y } = active;
      if (!attached(stick)) {
        finishFloating('owner');
        return;
      }
      const dx = contact.globalX - x,
        dy = contact.globalY - y;
      // The adapter cancels on viewport changes. The initial per-axis CSS scale remains valid for this contact.
      const distance = Math.hypot(dx * scale.x, dy * scale.y);
      const amount = distance > stick.deadZone ? 1 - stick.deadZone / distance : 0;
      place(stick.knob, stick.reach, dx * amount, dy * amount);
    });
    bound = true;
    game.scope.use({
      dispose() {
        try {
          finishFloating('dispose');
        } finally {
          offClaim();
          offTap();
          offContact();
        }
      }
    });
  };
  const touch = {
    stick(o: PlayStickOptions = {}): Sprite {
      const reach = finite(o?.radius) && o.radius > 0 ? o.radius : 48;
      if (o?.floating !== undefined) {
        const options = o.floating;
        if (options === null || typeof options !== 'object')
          throw new TypeError('a floating touch stick takes an area and optional deadZonePx and exclude');
        if (typeof options.area !== 'function') area(options.area);
        const deadZone = options.deadZonePx ?? 8;
        if (
          !finite(deadZone) ||
          deadZone < 0 ||
          (options.exclude !== undefined && typeof options.exclude !== 'function')
        )
          throw new TypeError('deadZonePx must be nonnegative and exclude must be a function');
        bindFloating();
        const { node, knob } = drawStick(reach);
        node.visible = false;
        if (captureTarget === undefined) {
          // An empty shared target keeps this session off the world without blocking other fingers in the HUD.
          captureTarget = game.sprite(undefined, port.layer);
          captureTarget.touchEnabled = true;
        }
        floating.push({ node, knob, options, reach, deadZone });
        return node;
      }
      const x = finite(o?.x) ? o.x : game.safe.x + reach + 28,
        y = finite(o?.y) ? o.y : game.safe.y + game.safe.height - reach - 28;
      const { node, knob } = drawStick(reach);
      node.x = x;
      node.y = y;
      const moveFixed = (px: number, py: number): void => place(knob, reach, px - x, py - y);
      controls.push({
        node,
        always: o?.always === true,
        x,
        y,
        // A finger a little outside the ring still takes the stick.
        reach: reach * 1.4,
        stick: true,
        owner: undefined,
        press: moveFixed,
        drag: moveFixed,
        release() {
          knob.x = knob.y = 0;
          port.stick(0, 0);
        }
      });
      show();
      return node;
    },
    button(words: string, o: PlayTouchButtonOptions): Sprite {
      if (o === null || typeof o !== 'object' || !finite(o.x) || !finite(o.y))
        throw new TypeError('a touch button takes its words and { x, y }');
      const r = finite(o.radius) && o.radius > 0 ? o.radius : 32,
        key = typeof o.key === 'string' && o.key !== '' ? o.key : 'space',
        color = Number.isInteger(o.color) && o.color! >= 0 && o.color! <= 0xffffff ? o.color! : 0xffffff;
      const draw = (down: boolean): void => {
        node.graphics
          .clear()
          .beginFill(color, down ? 0.5 : 0.2)
          .drawCircle(0, 0, r)
          .endFill()
          .lineStyle(2, color, 0.5)
          .drawCircle(0, 0, r);
      };
      const node = game.sprite(undefined, port.layer);
      node.x = o.x;
      node.y = o.y;
      draw(false);
      game.text(String(words), { size: Math.round(r * 0.6), align: 'center', baseline: 'middle', layer: node });
      controls.push({
        node,
        always: o.always === true,
        x: o.x,
        y: o.y,
        reach: r * 1.2,
        owner: undefined,
        press() {
          draw(true);
          port.hold(key);
        },
        drag() {},
        release() {
          draw(false);
          port.letGo(key);
        }
      });
      show();
      return node;
    },
    claim(event: PointerEvent): boolean {
      if (event.pointerType !== 'touch') return false;
      notice();
      if (wasBrowserPointerDownClaimed(event)) return true;
      const at = port.toStage(event.clientX, event.clientY);
      controls = controls.filter(control => !control.node.isDisposed);
      for (const control of controls) {
        if (control.owner !== undefined || (control.stick === true && active !== undefined)) continue;
        if (!over(control, at.x, at.y)) continue;
        control.owner = event.pointerId;
        control.press(at.x, at.y);
        return true;
      }
      return false;
    },
    move(event: PointerEvent): void {
      for (const control of controls)
        if (control.owner === event.pointerId) {
          const at = port.toStage(event.clientX, event.clientY);
          control.drag(at.x, at.y);
        }
    },
    end(event: PointerEvent): boolean {
      let owned = false;
      for (const control of controls)
        if (control.owner === event.pointerId) {
          control.owner = undefined;
          control.release();
          owned = true;
        }
      return owned;
    },
    sync(): void {
      if (active !== undefined && !attached(active.stick)) finishFloating('owner');
    },
    cancel(): void {
      // A window can lose focus before the browser sends the last pointer event.
      for (const control of controls) {
        if (control.owner === undefined) continue;
        control.owner = undefined;
        if (!control.node.isDisposed) control.release();
      }
    },
    cancelFloating(reason: PointerCancelReason = 'suspended'): void {
      finishFloating(reason);
    },
    reset(): void {
      finishFloating('owner');
      touch.cancel();
      controls = [];
      floating = [];
      captureTarget = undefined;
      pending = undefined;
    }
  };
  return touch;
}
