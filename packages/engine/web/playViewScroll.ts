// SPDX-License-Identifier: Apache-2.0
import type { DisplayObject, Sprite } from '@egret/runtime';
import { createScrollControl } from '@egret/engine/ui';
import type { PlayGame } from './BrowserPlay.js';
import type { ViewRect } from './view.js';

type PointerInput = NonNullable<PlayGame['browser']['pointer']>;
type PointerNotification = Parameters<Parameters<PointerInput['observe']>[0]>[0];
type PointerContact = PointerNotification['contact'];
type PointerSession = PointerContact['session'];

/** The scroll position of a named viewport, in its own logical units. */
export interface PlayViewScroll {
  readonly offset: number;
  readonly maximum: number;
  scrollTo(offset: number): boolean;
  scrollBy(delta: number): boolean;
  page(direction: -1 | 1): boolean;
}

export interface PlayScrollViewport extends PlayViewScroll {
  readonly content: Sprite;
  readonly viewport: Sprite;
  readonly captureTarget: Sprite;
  enabled(): boolean;
  layout(width: number, height: number, contentHeight: number): void;
  reveal(node: Sprite, bounds: ViewRect): void;
  dispose(): void;
}

interface Pan {
  readonly panel: PlayScrollViewport;
  readonly x: number;
  readonly y: number;
  readonly localY: number;
  readonly offset: number;
  dragging: boolean;
}

const PAN_SLOP = 12;

/** Owns one touch stream for the viewports in a game. Nested viewports claim the nearest eligible ancestor. */
export function createPlayViewScrolls(game: PlayGame) {
  const panels = new Map<DisplayObject, PlayScrollViewport>();
  const hands = new Map<PointerSession, Pan>();
  const pointer = game.browser.pointer;
  let unsubscribe: (() => void) | undefined;

  const closest = (target: DisplayObject | undefined): PlayScrollViewport | undefined => {
    for (let node = target; node !== undefined; node = node.parent) {
      const panel = panels.get(node);
      if (panel !== undefined && panel.enabled() && panel.maximum > 0) return panel;
    }
    return undefined;
  };
  const localY = (panel: PlayScrollViewport, contact: PointerContact): number =>
    panel.viewport.globalToLocal(contact.globalX, contact.globalY).y;
  const observe = ({ kind, contact, target }: PointerNotification): void => {
    const { session, globalX: x, globalY: y } = contact;
    if (session.pointerType !== 'touch') return;
    if (kind === 'begin') {
      const panel = closest(target);
      if (panel !== undefined && ![...hands.values()].some(hand => hand.panel === panel))
        hands.set(session, { panel, x, y, localY: localY(panel, contact), offset: panel.offset, dragging: false });
      return;
    }
    const hand = hands.get(session);
    if (hand === undefined) return;
    const { panel } = hand;
    if (kind !== 'move' || !panel.enabled()) {
      hands.delete(session);
      return;
    }
    if (!hand.dragging) {
      const dx = x - hand.x,
        dy = y - hand.y;
      if (Math.abs(dy) <= PAN_SLOP || Math.abs(dx) > Math.abs(dy)) return;
      // Once a pan wins, end it on an empty target so a return to the starting point cannot press a button.
      if (!pointer?.capture(session, panel.captureTarget)) {
        hands.delete(session);
        return;
      }
      hand.dragging = true;
    }
    panel.scrollTo(hand.offset + hand.localY - localY(panel, contact));
  };

  const create = (viewport: Sprite, offset: number, enabled: () => boolean): PlayScrollViewport => {
    const content = game.sprite(undefined, viewport);
    const captureTarget = game.sprite(undefined, viewport);
    viewport.touchEnabled = true;
    captureTarget.touchEnabled = true;
    const control = createScrollControl({
      viewportLength: 1,
      contentLength: offset + 1,
      offset,
      onScroll: value => {
        content.y = -value;
      }
    });
    content.y = -control.offset;
    const panel: PlayScrollViewport = {
      content,
      viewport,
      captureTarget,
      enabled,
      get offset() {
        return control.offset;
      },
      get maximum() {
        return control.maximum;
      },
      scrollTo: control.scrollTo,
      scrollBy: control.scrollBy,
      page: control.page,
      layout(width, height, contentHeight) {
        const current = viewport.clipRect;
        if (
          current === undefined ||
          current.x !== 0 ||
          current.y !== 0 ||
          current.width !== width ||
          current.height !== height
        )
          viewport.clipRect = { x: 0, y: 0, width, height };
        control.setLengths(Math.max(height, Number.MIN_VALUE), height === 0 ? 0 : contentHeight);
      },
      reveal(node, bounds) {
        const clip = viewport.clipRect!;
        if (clip.height <= 0) return;
        const ys = [
          [bounds.x, bounds.y],
          [bounds.x + bounds.width, bounds.y],
          [bounds.x, bounds.y + bounds.height],
          [bounds.x + bounds.width, bounds.y + bounds.height]
        ].map(([x, y]) => {
          const global = node.localToGlobal(x, y);
          return viewport.globalToLocal(global.x, global.y).y;
        });
        const top = Math.min(...ys),
          bottom = Math.max(...ys);
        const delta = top < 0 || bottom - top > clip.height ? top : Math.max(0, bottom - clip.height);
        if (delta !== 0) control.scrollBy(delta);
      },
      dispose() {
        panels.delete(viewport);
        for (const [session, hand] of hands) if (hand.panel === panel) hands.delete(session);
        control.dispose();
        if (panels.size === 0) {
          unsubscribe?.();
          unsubscribe = undefined;
        }
      }
    };
    panels.set(viewport, panel);
    unsubscribe ??= pointer?.observe(observe);
    return panel;
  };
  return {
    create,
    wheel(x: number, y: number, delta: number, mode: number) {
      if (panels.size === 0 || mode < 0 || mode > 2) return false;
      // Route the Play canvas's existing wheel input. A consumer's own hover adapter
      // remains independent, and an inner viewport at its edge leaves the wheel to its parent.
      for (let node = game.engine.stage.hitTest(x, y); node !== undefined; node = node.parent) {
        const panel = panels.get(node);
        if (!panel?.enabled()) continue;
        const units = mode === 0 ? 1 : mode === 1 ? 40 : panel.viewport.clipRect!.height;
        if (panel.scrollBy(delta * units)) return true;
      }
      return false;
    }
  };
}
