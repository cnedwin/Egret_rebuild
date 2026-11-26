// SPDX-License-Identifier: Apache-2.0
import type { DisplayObject, Event } from '@egret/runtime';

type PointerType = 'mouse' | 'touch' | 'pen';
// Consume only the event information this helper needs; the pointer assembly remains in its owner.
type TapEvent = Pick<Event<unknown>, 'target' | 'stopPropagation'> & {
  readonly payload: {
    readonly globalX: number;
    readonly globalY: number;
    readonly session: { readonly pointerType: PointerType; readonly pointerId: number };
  };
};

/** Where an activation came from. Keyboard, semantics and the gamepad have no pointer position. */
export type PlayActivationSource = PointerType | 'keyboard' | 'semantic' | 'gamepad';

type PointerPosition = {
  readonly source: PointerType;
  readonly pointerId: number;
  /** The end contact in stage coordinates, as opposed to the game's design coordinates. */
  readonly stageX: number;
  readonly stageY: number;
  /** In the current target's coordinates. Absent if its transform cannot be inverted during dispatch. */
  readonly localX?: number;
  readonly localY?: number;
};
type NoPointerPosition<S> = {
  readonly source: S;
  readonly pointerId?: never;
  readonly stageX?: never;
  readonly stageY?: never;
  readonly localX?: never;
  readonly localY?: never;
};

interface TapTarget<T> {
  /** The original hit and the listener currently receiving it. */
  readonly target: T;
  readonly currentTarget: T;
  /** Stop this pointer tap before it reaches any further ancestors. Effective during the callback only. */
  stopPropagation(): void;
}

/** The information supplied to game.onTap. */
export type PlayTapActivation = TapTarget<DisplayObject> & (PointerPosition | NoPointerPosition<'semantic'>);

/** The second argument of a view's tap binding; target and currentTarget are part names, if named. */
export type PlayViewActivation = TapTarget<string | undefined> &
  (PointerPosition | NoPointerPosition<'keyboard' | 'semantic' | 'gamepad'>) & {
    /** True even for an unnamed part when it is the original hit; false for an ancestor receiving a bubbled tap. */
    readonly isTarget: boolean;
  };

const noBubble = (): void => {};

/** A snapshot of the current visit to a pointer event, never a retained mutable dispatcher. */
export function pointerTapActivation(node: DisplayObject, event: TapEvent): PlayTapActivation {
  const { globalX: stageX, globalY: stageY, session } = event.payload;
  const position: { localX?: number; localY?: number } = {};
  // A child handler may have moved or removed an ancestor before the event reaches it. The stage point remains real.
  try {
    const local = node.globalToLocal(stageX, stageY);
    position.localX = local.x;
    position.localY = local.y;
  } catch {
    // A singular or unavailable current transform has no local point.
  }
  return Object.freeze({
    source: session.pointerType,
    pointerId: session.pointerId,
    target: event.target as DisplayObject,
    currentTarget: node,
    stageX,
    stageY,
    ...position,
    stopPropagation: () => event.stopPropagation()
  });
}

export function semanticTapActivation(node: DisplayObject): PlayTapActivation {
  return Object.freeze({ source: 'semantic', target: node, currentTarget: node, stopPropagation: noBubble });
}

export function directViewActivation(
  name: string | undefined,
  source: 'keyboard' | 'semantic' | 'gamepad'
): PlayViewActivation {
  return Object.freeze({ source, target: name, currentTarget: name, isTarget: true, stopPropagation: noBubble });
}

export function viewTapActivation(
  activation: PlayTapActivation,
  currentTarget: string | undefined,
  target: string | undefined
): PlayViewActivation {
  return Object.freeze({
    ...activation,
    target,
    currentTarget,
    isTarget: activation.target === activation.currentTarget
  });
}
