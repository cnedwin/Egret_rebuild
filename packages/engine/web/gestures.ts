// SPDX-License-Identifier: Apache-2.0
// The optional entry @egret/engine/web/gestures. What a finger, the mouse or a pen does on a display object, said
// once as a game means it: a tap, a double tap, a long press, a drag, a swipe, two fingers pinching and turning, and
// something dragged from one place and dropped on another. It reads the contacts that pointer input routes to the
// object and adds no listener of its own to any page.
// It touches no page either, so a host that gives contacts to pointer input in its own way, a mini game for one, uses
// it as it is.
import { DisplayObject, EgretError, Stage } from '@egret/runtime';
import type { DisplayObjectContainer, Scope } from '@egret/runtime';
import { after } from '@egret/engine';
import type { Delayed, Engine } from '@egret/engine';
import type { EventType } from '@egret/runtime';
import type { PointerInput } from './pointer.js';

/** A contact as pointer input routes it: its session, where it is on the stage and when. */
type PointerContact = PointerInput['events']['begin'] extends EventType<infer T> ? T : never;

/** Where a gesture is: on the stage, and in the object's own units. */
export interface GesturePoint {
  readonly x: number;
  readonly y: number;
  readonly localX: number;
  readonly localY: number;
}
/** A drag: where it is, how far it moved since the last, and since it started. */
export interface GestureDrag extends GesturePoint {
  readonly phase: 'start' | 'move' | 'end' | 'cancel';
  readonly dx: number;
  readonly dy: number;
  readonly totalX: number;
  readonly totalY: number;
}
/** A swipe: its main direction, its speed in stage units a second, and how far it went. */
export interface GestureSwipe {
  readonly direction: 'left' | 'right' | 'up' | 'down';
  readonly speed: number;
  readonly dx: number;
  readonly dy: number;
}
/** Two fingers: how far apart against how they started, how far they turned, in degrees, and their middle. */
export interface GesturePinch {
  readonly phase: 'start' | 'move' | 'end' | 'cancel';
  readonly scale: number;
  readonly rotation: number;
  readonly x: number;
  readonly y: number;
}
/** What to recognize on an object, and what is called. Give only the callbacks the game uses. */
export interface GestureOptions {
  readonly engine: Engine;
  readonly scope: Scope;
  readonly input: PointerInput;
  /** The object: it must take pointer input (`touchEnabled`), and what is inside it counts as it. */
  readonly target: DisplayObject;
  readonly onTap?: (at: GesturePoint) => void;
  readonly onDoubleTap?: (at: GesturePoint) => void;
  readonly onHold?: (at: GesturePoint) => void;
  readonly onDrag?: (drag: GestureDrag) => void;
  readonly onSwipe?: (swipe: GestureSwipe, at: GesturePoint) => void;
  readonly onPinch?: (pinch: GesturePinch) => void;
  /** How far a contact moves, in stage units, before it is a drag and no longer a tap or a press. 12 unless given. */
  readonly slop?: number;
  /** Seconds of a still press before it is a long press. 0.5 unless given. */
  readonly holdSeconds?: number;
  /** Seconds between two taps that make a double tap. 0.3 unless given. */
  readonly doubleTapSeconds?: number;
  /** Stage units a second at the end of a drag that make it a swipe. 600 unless given. */
  readonly swipeSpeed?: number;
}
/** Recognized gestures of an object; ended with `dispose` or with its scope. */
export interface Gestures {
  dispose(): void;
}

interface Track {
  readonly id: number;
  readonly startX: number;
  readonly startY: number;
  x: number;
  y: number;
  /** Recent places and times, for the speed at the end. */
  readonly samples: { x: number; y: number; t: number }[];
  dragging: boolean;
  held: boolean;
  /** Part of a pinch that ended: it is no tap, press or drag. */
  spent: boolean;
  hold: Delayed | undefined;
}

const invalid = (what: string): EgretError => new EgretError('GESTURE_OPTIONS_INVALID', { cause: what });
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Recognizes gestures on an object. A tap is told at once; a second tap soon after and near it is also a double tap.
 * A still press of `holdSeconds` is a long press and is then no tap. A contact that moves more than `slop` is a drag
 * from then on, and a drag that ends fast enough is also a swipe. While two contacts are down on the object they are a
 * pinch, and neither is a tap, a press or a drag.
 */
export function createGestures(options: GestureOptions): Gestures {
  if (options === null || typeof options !== 'object') throw invalid('options');
  const { engine, scope, input, target } = options;
  if (input === null || typeof input !== 'object' || typeof input.events !== 'object') throw invalid('input');
  if (!(target instanceof DisplayObject)) throw invalid('target');
  if (scope === null || typeof scope !== 'object' || engine === null || typeof engine !== 'object')
    throw invalid('engine and scope');
  for (const name of ['onTap', 'onDoubleTap', 'onHold', 'onDrag', 'onSwipe', 'onPinch'] as const)
    if (options[name] !== undefined && typeof options[name] !== 'function') throw invalid(name);
  const slop = options.slop ?? 12,
    holdSeconds = options.holdSeconds ?? 0.5,
    doubleTapSeconds = options.doubleTapSeconds ?? 0.3,
    swipeSpeed = options.swipeSpeed ?? 600;
  for (const [name, value] of [
    ['slop', slop],
    ['holdSeconds', holdSeconds],
    ['doubleTapSeconds', doubleTapSeconds],
    ['swipeSpeed', swipeSpeed]
  ] as const)
    if (!positive(value)) throw invalid(name);

  const tracks = new Map<number, Track>();
  let pinch: { distance: number; angle: number } | undefined,
    lastTap: { x: number; y: number; t: number } | undefined,
    closed = false;
  const point = (x: number, y: number): GesturePoint => {
    let localX = x,
      localY = y;
    try {
      const local = target.globalToLocal(x, y);
      localX = local.x;
      localY = local.y;
    } catch {
      // A collapsed object has no inside; its point is the stage's.
    }
    return Object.freeze({ x, y, localX, localY });
  };
  const two = (): [Track, Track] | undefined => {
    const [a, b] = tracks.values();
    return tracks.size === 2 && a !== undefined && b !== undefined ? [a, b] : undefined;
  };
  const shape = (a: Track, b: Track) => ({
    distance: Math.hypot(b.x - a.x, b.y - a.y),
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  });
  const pinchOf = (phase: GesturePinch['phase']): GesturePinch | undefined => {
    const pair = two();
    if (pair === undefined || pinch === undefined) return undefined;
    const now = shape(...pair);
    let turn = now.angle - pinch.angle;
    while (turn > 180) turn -= 360;
    while (turn < -180) turn += 360;
    return Object.freeze({
      phase,
      scale: pinch.distance > 0 ? now.distance / pinch.distance : 1,
      rotation: turn,
      x: now.x,
      y: now.y
    });
  };
  const stopHold = (track: Track): void => {
    track.hold?.cancel();
    track.hold = undefined;
  };
  const endPinch = (phase: 'end' | 'cancel'): void => {
    if (pinch === undefined) return;
    const last = pinchOf(phase);
    pinch = undefined;
    if (last !== undefined) options.onPinch?.(last);
  };

  const begin = (contact: PointerContact): void => {
    if (closed || tracks.size >= 2) return;
    const track: Track = {
      id: contact.session.id,
      startX: contact.globalX,
      startY: contact.globalY,
      x: contact.globalX,
      y: contact.globalY,
      samples: [{ x: contact.globalX, y: contact.globalY, t: contact.timestamp }],
      dragging: false,
      held: false,
      spent: false,
      hold: undefined
    };
    tracks.set(track.id, track);
    const pair = two();
    if (pair !== undefined) {
      // A second finger makes a pinch of both: what the first was doing alone ends.
      for (const each of pair) {
        stopHold(each);
        if (each.dragging) {
          each.dragging = false;
          options.onDrag?.(dragOf(each, 'cancel', 0, 0));
        }
      }
      const start = shape(...pair);
      pinch = { distance: start.distance, angle: start.angle };
      if (options.onPinch !== undefined) options.onPinch(pinchOf('start')!);
      return;
    }
    if (options.onHold !== undefined)
      track.hold = after(engine, scope, holdSeconds, () => {
        track.hold = undefined;
        if (closed || tracks.get(track.id) !== track || track.dragging || pinch !== undefined) return;
        track.held = true;
        options.onHold?.(point(track.x, track.y));
      });
  };
  const dragOf = (track: Track, phase: GestureDrag['phase'], dx: number, dy: number): GestureDrag => {
    const at = point(track.x, track.y);
    return Object.freeze({
      ...at,
      phase,
      dx,
      dy,
      totalX: track.x - track.startX,
      totalY: track.y - track.startY
    });
  };
  const move = (contact: PointerContact): void => {
    const track = tracks.get(contact.session.id);
    if (closed || track === undefined || track.spent) return;
    const dx = contact.globalX - track.x,
      dy = contact.globalY - track.y;
    track.x = contact.globalX;
    track.y = contact.globalY;
    track.samples.push({ x: track.x, y: track.y, t: contact.timestamp });
    if (track.samples.length > 8) track.samples.shift();
    if (pinch !== undefined) {
      const now = pinchOf('move');
      if (now !== undefined) options.onPinch?.(now);
      return;
    }
    if (!track.dragging && !track.held && Math.hypot(track.x - track.startX, track.y - track.startY) > slop) {
      track.dragging = true;
      stopHold(track);
      options.onDrag?.(dragOf(track, 'start', track.x - track.startX, track.y - track.startY));
      return;
    }
    if (track.dragging) options.onDrag?.(dragOf(track, 'move', dx, dy));
  };
  const finish = (contact: PointerContact, cancelled: boolean): void => {
    const track = tracks.get(contact.session.id);
    if (track === undefined) return;
    if (!cancelled) {
      track.x = contact.globalX;
      track.y = contact.globalY;
      track.samples.push({ x: track.x, y: track.y, t: contact.timestamp });
    }
    stopHold(track);
    // A pinch ends when either finger lifts, measured with both; the other finger is then done until it lifts too.
    if (pinch !== undefined && !closed) {
      endPinch(cancelled ? 'cancel' : 'end');
      for (const other of tracks.values()) other.spent = true;
    }
    tracks.delete(track.id);
    if (closed || track.spent) return;
    if (track.dragging) {
      options.onDrag?.(dragOf(track, cancelled ? 'cancel' : 'end', 0, 0));
      if (cancelled || options.onSwipe === undefined) return;
      // The speed of the last tenth of a second of the drag.
      const last = track.samples[track.samples.length - 1]!,
        first = track.samples.find(sample => last.t - sample.t <= 100) ?? last;
      const seconds = Math.max(1e-3, (last.t - first.t) / 1000),
        dx = last.x - first.x,
        dy = last.y - first.y,
        speed = Math.hypot(dx, dy) / seconds;
      if (speed >= swipeSpeed && last.t > first.t) {
        const totalX = track.x - track.startX,
          totalY = track.y - track.startY;
        const direction =
          Math.abs(totalX) >= Math.abs(totalY) ? (totalX < 0 ? 'left' : 'right') : totalY < 0 ? 'up' : 'down';
        options.onSwipe(Object.freeze({ direction, speed, dx: totalX, dy: totalY }), point(track.x, track.y));
      }
      return;
    }
    if (cancelled || track.held) return;
    const at = point(track.x, track.y);
    options.onTap?.(at);
    if (options.onDoubleTap === undefined) return;
    if (
      lastTap !== undefined &&
      contact.timestamp - lastTap.t <= doubleTapSeconds * 1000 &&
      Math.hypot(track.x - lastTap.x, track.y - lastTap.y) <= slop * 2
    ) {
      lastTap = undefined;
      options.onDoubleTap(at);
    } else lastTap = { x: track.x, y: track.y, t: contact.timestamp };
  };

  // Each subscription returns its own removal.
  const removals = [
    target.on(input.events.begin, event => begin(event.payload)),
    target.on(input.events.move, event => move(event.payload)),
    target.on(input.events.end, event => finish(event.payload, false)),
    target.on(input.events.cancel, event => finish(event.payload, true))
  ];
  const gestures: Gestures = {
    dispose() {
      if (closed) return;
      closed = true;
      for (const remove of removals) remove();
      for (const track of tracks.values()) stopHold(track);
      tracks.clear();
      pinch = undefined;
    }
  };
  scope.use(gestures);
  return Object.freeze(gestures);
}

/** A place something can be dropped, and what it does with what is dropped on it. */
export interface DropTarget<T> {
  readonly node: DisplayObject;
  /** Whether it takes this. Everything unless given. */
  readonly accepts?: (data: T) => boolean;
  /** Something was let go over it. */
  readonly drop: (data: T, at: GesturePoint) => void;
  /** Something is dragged over it (true) or away from it (false), for a highlight. */
  readonly hover?: (data: T, over: boolean) => void;
}
/** Something that can be dragged: what it carries, and the picture that follows the finger. */
export interface DragSource<T> {
  readonly node: DisplayObject;
  /** What is carried; undefined when there is nothing to carry now, such as an empty slot. */
  readonly data: () => T | undefined;
  /** The picture that follows the finger, made when a drag starts and removed when it ends. */
  readonly ghost?: (data: T) => DisplayObject;
}
/** Drag and drop to make: its engine, scope and input, and the layer the picture that follows the finger is drawn in. */
export interface DragAndDropOptions {
  readonly engine: Engine;
  readonly scope: Scope;
  readonly input: PointerInput;
  /** Where the picture that follows the finger goes: a layer over everything it is dragged across. */
  readonly layer: DisplayObjectContainer;
  /** As for gestures: how far a contact moves before it is a drag. 12 unless given. */
  readonly slop?: number;
}
/** Sources and targets of drag and drop. Each registration returns its removal. */
export interface DragAndDrop<T> {
  source(source: DragSource<T>): () => void;
  target(target: DropTarget<T>): () => void;
  /** What is being dragged now, if anything. */
  readonly dragging: T | undefined;
  dispose(): void;
}

/** Whether a stage point is inside what an object draws, by its bounds on the stage. */
function contains(node: DisplayObject, x: number, y: number): boolean {
  // Shown, with everything it is in, and on a stage.
  let top: DisplayObject = node;
  for (
    let at: DisplayObject | null | undefined = node;
    at != null;
    at = at.parent as DisplayObject | null | undefined
  ) {
    if (!at.visible) return false;
    top = at;
  }
  if (!(top instanceof Stage)) return false;
  try {
    const local = node.globalToLocal(x, y),
      bounds = node.getBounds();
    return (
      local.x >= bounds.x &&
      local.y >= bounds.y &&
      local.x <= bounds.x + bounds.width &&
      local.y <= bounds.y + bounds.height
    );
  } catch {
    return false;
  }
}
const inside = (node: DisplayObject, outer: DisplayObject): boolean => {
  for (
    let at = node.parent as DisplayObject | null | undefined;
    at != null;
    at = at.parent as DisplayObject | null | undefined
  )
    if (at === outer) return true;
  return false;
};

/**
 * Drag and drop as games do it: the dragged object stays where it is, a picture of it follows the finger in `layer`,
 * and letting go over a target that accepts what is carried calls its `drop`. Over several targets, the innermost
 * takes it: a slot inside a bag, not the bag. Let go anywhere else, nothing happens.
 */
export function createDragAndDrop<T>(options: DragAndDropOptions): DragAndDrop<T> {
  if (options === null || typeof options !== 'object') throw invalid('options');
  const { engine, scope, input, layer } = options;
  if (layer === null || typeof layer !== 'object' || typeof layer.addChild !== 'function') throw invalid('layer');
  const targets = new Set<DropTarget<T>>(),
    sources = new Set<Gestures>();
  let carrying: { data: T; ghost: DisplayObject | undefined; over: DropTarget<T> | undefined } | undefined,
    closed = false;
  const under = (x: number, y: number, data: T): DropTarget<T> | undefined => {
    let best: DropTarget<T> | undefined;
    for (const each of targets) {
      if (!contains(each.node, x, y)) continue;
      if (each.accepts !== undefined && !each.accepts(data)) continue;
      if (best === undefined || inside(each.node, best.node)) best = each;
    }
    return best;
  };
  const end = (at: GesturePoint | undefined): void => {
    const done = carrying;
    carrying = undefined;
    if (done === undefined) return;
    if (done.ghost !== undefined) done.ghost.parent?.removeChild(done.ghost);
    done.over?.hover?.(done.data, false);
    if (at !== undefined && !closed) under(at.x, at.y, done.data)?.drop(done.data, at);
  };
  const dnd: DragAndDrop<T> = {
    source(source) {
      if (closed) throw new EgretError('GESTURE_CLOSED');
      if (
        source === null ||
        typeof source !== 'object' ||
        typeof source.data !== 'function' ||
        !(source.node instanceof DisplayObject)
      )
        throw invalid('source');
      const gestures = createGestures({
        engine,
        scope,
        input,
        target: source.node,
        ...(options.slop === undefined ? {} : { slop: options.slop }),
        onDrag(drag) {
          if (drag.phase === 'start') {
            if (carrying !== undefined) return;
            const data = source.data();
            if (data === undefined) return;
            const ghost = source.ghost?.(data);
            if (ghost !== undefined) {
              ghost.touchEnabled = false;
              layer.addChild(ghost);
              const at = layer.globalToLocal(drag.x, drag.y);
              ghost.x = at.x;
              ghost.y = at.y;
            }
            carrying = { data, ghost, over: undefined };
          }
          if (carrying === undefined) return;
          if (drag.phase === 'start' || drag.phase === 'move') {
            if (carrying.ghost !== undefined) {
              const at = layer.globalToLocal(drag.x, drag.y);
              carrying.ghost.x = at.x;
              carrying.ghost.y = at.y;
            }
            const over = under(drag.x, drag.y, carrying.data);
            if (over !== carrying.over) {
              carrying.over?.hover?.(carrying.data, false);
              carrying.over = over;
              over?.hover?.(carrying.data, true);
            }
          } else end(drag.phase === 'end' ? drag : undefined);
        }
      });
      sources.add(gestures);
      return () => {
        sources.delete(gestures);
        gestures.dispose();
      };
    },
    target(given) {
      if (closed) throw new EgretError('GESTURE_CLOSED');
      if (
        given === null ||
        typeof given !== 'object' ||
        typeof given.drop !== 'function' ||
        !(given.node instanceof DisplayObject)
      )
        throw invalid('target');
      targets.add(given);
      return () => {
        targets.delete(given);
      };
    },
    get dragging() {
      return carrying?.data;
    },
    dispose() {
      if (closed) return;
      closed = true;
      end(undefined);
      for (const gestures of sources) gestures.dispose();
      sources.clear();
      targets.clear();
    }
  };
  scope.use(dnd);
  return dnd;
}
