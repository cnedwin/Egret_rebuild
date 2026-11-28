import { assertManagedMutable } from "./ui/managedState.js";
import type { Rectangle2D, SharedMaterial2D } from "@egret/contracts";
import type { DisplayObject } from "./DisplayObject.js";
import { assertLive, isDisplayNode } from "./displayNodeState.js";
import { engineOf } from "./engineAffinity.js";
import { EgretError } from "./EgretError.js";

import type { RenderEffect2D } from "./renderEffect.js";
import type { ShapeState } from "./graphicsShape.js";

export interface Primitive {
  readonly rect: Rectangle2D;
  readonly color: number;
  readonly alpha: number;
}

export interface VisualState {
  structureRevision: number;
  transformRevision: number;
  appearanceRevision: number;
  contentRevision: number;
  bindingRevision: number;
  x: number;
  y: number;
  anchorOffsetX: number;
  anchorOffsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  /** Degrees by which the y axis and the x axis are turned beyond the rotation; 0 and 0 is no skew. */
  skewX: number;
  skewY: number;
  /** A name the application gives, for getChildByName. */
  name: string;
  alpha: number;
  visible: boolean;
  sharedMaterial: SharedMaterial2D | null;
  renderBoundary: "none" | "isolate";
  renderEffect: RenderEffect2D | undefined;
  /** How many nodes take this one as their shape mask. While any do, it is not drawn, as Egret hid a mask. */
  maskUses: number;
  clipRect: Rectangle2D | undefined;
  primitives: Primitive[];
  /** What the node draws besides filled rectangles: triangles and a path, which Graphics alone writes. */
  shape: ShapeState | undefined;
  /** What the shared capture keeps of this node between frames; the capture alone reads and writes it. */
  sharedCapture: object | undefined;
  /** How many changes were recorded for this node, of any kind. It only grows. */
  changes: number;
  /** The last capture that visited this node; a capture visits a node once. The captures alone read and write it. */
  seenBy: number;
}

// Authoritative per-node visual state excludes overridable public accessors.
const states = new WeakMap<DisplayObject, VisualState>();
const readRevisionState = states.get.bind(states);
const sameValue = Object.is;

// An engine may opt in to reading its visual revision without walking the stage.
const observedEngines = new WeakMap<object, { revision: number; watches: number }>();
const readObserved = observedEngines.get.bind(observedEngines);
let observations = 0;

export function watchDisplayRevision(context: object): { readonly revision: number; dispose(): void } {
  const state = readObserved(context) ?? { revision: 0, watches: 0 };
  observedEngines.set(context, state);
  observations++;
  state.watches++;
  let live = true;
  return Object.freeze({
    get revision() {
      return state.revision;
    },
    dispose() {
      if (!live) return;
      live = false;
      observations--;
      if (--state.watches === 0) observedEngines.delete(context);
    }
  });
}

export const VISUAL_STRUCTURE = 1;
export const VISUAL_TRANSFORM = 2;
export const VISUAL_APPEARANCE = 4;
export const VISUAL_CONTENT = 8;
export const VISUAL_BINDING = 16;
// Never publish MAX_SAFE_INTEGER: invalidate every old key before restarting.
const REVISION_RESTART = 9007199254740990;

/**
 * Publish after the original authoritative write. No lifecycle check, callback or
 * explicit allocation may enter tree/ticket commits or terminal cleanup here.
 * Non-display affinity values have no visual state and need no capture revision.
 */
export function recordVisualChange(node: object, changes: number): void {
  const state = readRevisionState(node as DisplayObject);
  if (state === undefined) return;
  if (observations !== 0) {
    const context = engineOf(node);
    const observed = context === undefined ? undefined : readObserved(context);
    // A synchronous counter is safe in a commit. Never run an observer callback here.
    if (observed !== undefined) observed.revision = observed.revision >= REVISION_RESTART ? 0 : observed.revision + 1;
  }
  state.changes++;
  if (
    ((changes & VISUAL_STRUCTURE) !== 0 && state.structureRevision >= REVISION_RESTART) ||
    ((changes & VISUAL_TRANSFORM) !== 0 && state.transformRevision >= REVISION_RESTART) ||
    ((changes & VISUAL_APPEARANCE) !== 0 && state.appearanceRevision >= REVISION_RESTART) ||
    ((changes & VISUAL_CONTENT) !== 0 && state.contentRevision >= REVISION_RESTART) ||
    ((changes & VISUAL_BINDING) !== 0 && state.bindingRevision >= REVISION_RESTART)
  ) {
    state.structureRevision = 0;
    state.transformRevision = 0;
    state.appearanceRevision = 0;
    state.contentRevision = 0;
    state.bindingRevision = 0;
  }
  if ((changes & VISUAL_STRUCTURE) !== 0) state.structureRevision++;
  if ((changes & VISUAL_TRANSFORM) !== 0) state.transformRevision++;
  if ((changes & VISUAL_APPEARANCE) !== 0) state.appearanceRevision++;
  if ((changes & VISUAL_CONTENT) !== 0) state.contentRevision++;
  if ((changes & VISUAL_BINDING) !== 0) state.bindingRevision++;
}

export function registerVisual(node: DisplayObject): void {
  states.set(node, {
    structureRevision: 0,
    transformRevision: 0,
    appearanceRevision: 0,
    contentRevision: 0,
    bindingRevision: 0,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    skewX: 0,
    skewY: 0,
    name: "",
    alpha: 1,
    anchorOffsetX: 0,
    anchorOffsetY: 0,
    visible: true,
    renderEffect: undefined,
    maskUses: 0,
    sharedMaterial: null,
    renderBoundary: "none",
    clipRect: undefined,
    primitives: [],
    shape: undefined,
    sharedCapture: undefined,
    changes: 0,
    seenBy: 0
  });
}

export function visualOf(node: DisplayObject): VisualState {
  return states.get(node)!;
}

type AnchorAxis = "anchorOffsetX" | "anchorOffsetY";

/** Authenticate private node identity before lifecycle or caller values. */
function anchorState(receiver: unknown): VisualState {
  if (!isDisplayNode(receiver as object)) throw new EgretError("INVALID_DISPLAY_OBJECT");
  return visualOf(receiver as DisplayObject);
}

export function readAnchorOffset(receiver: unknown, axis: AnchorAxis): number {
  return anchorState(receiver)[axis];
}

export function writeAnchorOffset(receiver: unknown, axis: AnchorAxis, value: unknown): void {
  const state = anchorState(receiver);
  assertVisualMutable(receiver as DisplayObject);
  if (!finite(value)) throw new EgretError("DISPLAY_VALUE_INVALID");
  const changed = !sameValue(state[axis], value);
  state[axis] = value;
  if (changed) recordVisualChange(receiver as DisplayObject, VISUAL_TRANSFORM);
}

export function assertVisualMutable(node: DisplayObject): void {
  assertManagedMutable(node);
  assertLive(node);
  engineOf(node)?.assertOpen();
}

/** A refused display value: the error says which property was set and what it was given. */
export function invalidDisplayValue(property: string, value: unknown): Error {
  // An object is named by its kind alone: a refused value is never read.
  const given =
    typeof value === "string"
      ? JSON.stringify(value.length > 40 ? value.slice(0, 40) + "…" : value)
      : value === null || (typeof value !== "object" && typeof value !== "function" && typeof value !== "symbol")
        ? String(value)
        : typeof value === "object"
          ? "an object"
          : "a " + typeof value;
  return new EgretError("DISPLAY_VALUE_INVALID", { cause: new RangeError(`${property} was given ${given}`) });
}

export function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function color(value: unknown): value is number {
  return finite(value) && Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

/**
 * An alpha as it is kept: a finite number, held to 0 and 1. A game's arithmetic often lands a hair outside (a fade
 * that runs one step long, an easing that overshoots), and that is not worth stopping a frame for. What is not a
 * finite number gives undefined, for the caller to refuse.
 */
export function alphaOf(value: unknown): number | undefined {
  return finite(value) ? (value < 0 ? 0 : value > 1 ? 1 : value) : undefined;
}

export function unit(value: unknown): value is number {
  return finite(value) && value >= 0 && value <= 1;
}

export function copyRect(value: Rectangle2D, code: string): Rectangle2D {
  const { x, y, width, height } = value;
  if (![x, y, width, height].every(finite) || width < 0 || height < 0) throw new EgretError(code);
  return Object.freeze({ x, y, width, height });
}
