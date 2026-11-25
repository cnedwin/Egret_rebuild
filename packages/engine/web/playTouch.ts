// SPDX-License-Identifier: Apache-2.0
// Controls on the glass for a game played by keys: a stick that counts in `keys.axis()`, and buttons that hold keys.
// A game written for the keyboard is played on a phone by adding them. They are drawn over the ui layer once a finger
// has touched the stage, or at once with `always`. Each finger keeps the control it started on until it lifts.
import { Sprite } from '@egret/engine';
import type { PlayGame } from './BrowserPlay.js';

/** A touch stick to show: where, how large, and whether it shows without touch. */
export interface PlayStickOptions {
  /** The middle of the stick. Near the bottom left of the stage unless given. */
  readonly x?: number;
  readonly y?: number;
  /** How far the knob moves; 48 unless given. */
  readonly radius?: number;
  /** Shown before any finger has touched the stage. */
  readonly always?: boolean;
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
  /** The layer the controls are drawn on: over the ui, so a box of words does not hide them. */
  readonly layer: Sprite;
}
interface Control {
  readonly node: Sprite;
  readonly always: boolean;
  readonly x: number;
  readonly y: number;
  readonly reach: number;
  owner: number | undefined;
  readonly press: (x: number, y: number) => void;
  readonly drag: (x: number, y: number) => void;
  readonly release: () => void;
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
  cancel(): void;
  reset(): void;
} {
  let controls: Control[] = [];
  let seen = false;
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  const show = (): void => {
    for (const control of controls) control.node.visible = seen || control.always;
  };
  const touch = {
    stick(o: PlayStickOptions = {}): Sprite {
      const reach = finite(o?.radius) && o.radius > 0 ? o.radius : 48,
        x = finite(o?.x) ? o.x : game.safe.x + reach + 28,
        y = finite(o?.y) ? o.y : game.safe.y + game.safe.height - reach - 28;
      const node = game.sprite(g => {
        g.beginFill(0xffffff, 0.12).drawCircle(0, 0, reach).endFill();
        g.lineStyle(2, 0xffffff, 0.3).drawCircle(0, 0, reach);
      }, port.layer);
      node.x = x;
      node.y = y;
      const knob = game.sprite(
        g =>
          g
            .beginFill(0xffffff, 0.45)
            .drawCircle(0, 0, reach * 0.42)
            .endFill(),
        node
      );
      const place = (px: number, py: number): void => {
        let dx = px - x,
          dy = py - y;
        const length = Math.hypot(dx, dy);
        if (length > reach) {
          dx = (dx / length) * reach;
          dy = (dy / length) * reach;
        }
        knob.x = dx;
        knob.y = dy;
        port.stick(dx / reach, dy / reach);
      };
      controls.push({
        node,
        always: o?.always === true,
        x,
        y,
        // A finger a little outside the ring still takes the stick.
        reach: reach * 1.4,
        owner: undefined,
        press: place,
        drag: place,
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
      if (!seen) {
        seen = true;
        show();
      }
      const at = port.toStage(event.clientX, event.clientY);
      controls = controls.filter(control => !control.node.isDisposed);
      for (const control of controls) {
        if (control.owner !== undefined || !control.node.visible) continue;
        if (Math.hypot(at.x - control.x, at.y - control.y) > control.reach) continue;
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
    cancel(): void {
      // A window can lose focus before the browser sends the last pointer event.
      for (const control of controls) {
        if (control.owner === undefined) continue;
        control.owner = undefined;
        if (!control.node.isDisposed) control.release();
      }
    },
    reset(): void {
      touch.cancel();
      controls = [];
    }
  };
  return touch;
}
