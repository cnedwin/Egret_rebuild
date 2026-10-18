import type { Rectangle2D, SharedMaterial2D } from "@egret/contracts";
import type { DisplayObject } from "./DisplayObject.js";
import { assertLive, isDisplayNode } from "./displayTreeState.js";
import { engineOf } from "./ownership.js";
import { EgretError } from "./EgretError.js";
import { invalidateCaptureNode } from "./frameCaptureCache.js";

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
  alpha: number;
  visible: boolean;
  sharedMaterial: SharedMaterial2D | null;
  renderBoundary: 'none' | 'isolate';
  clipRect: Rectangle2D | undefined;
  primitives: Primitive[];
}

// Authoritative per-node visual state excludes overridable public accessors.
const states = new WeakMap<DisplayObject, VisualState>();
const readRevisionState = states.get.bind(states);
const sameValue = Object.is;

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
  if (((changes & VISUAL_STRUCTURE) !== 0 && state.structureRevision >= REVISION_RESTART)
    || ((changes & VISUAL_TRANSFORM) !== 0 && state.transformRevision >= REVISION_RESTART)
    || ((changes & VISUAL_APPEARANCE) !== 0 && state.appearanceRevision >= REVISION_RESTART)
    || ((changes & VISUAL_CONTENT) !== 0 && state.contentRevision >= REVISION_RESTART)
    || ((changes & VISUAL_BINDING) !== 0 && state.bindingRevision >= REVISION_RESTART)) {
    invalidateCaptureNode(node as DisplayObject);
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
    structureRevision: 0, transformRevision: 0, appearanceRevision: 0, contentRevision: 0, bindingRevision: 0,
    x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1,
    anchorOffsetX: 0, anchorOffsetY: 0,
    visible: true, sharedMaterial: null, renderBoundary: 'none', clipRect: undefined, primitives: [],
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
  assertLive(node);
  engineOf(node)?.assertOpen();
}

export function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function color(value: unknown): value is number {
  return finite(value) && Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

export function unit(value: unknown): value is number {
  return finite(value) && value >= 0 && value <= 1;
}

export function copyRect(value: Rectangle2D, code: string): Rectangle2D {
  const { x, y, width, height } = value;
  if (![x, y, width, height].every(finite) || width < 0 || height < 0) throw new EgretError(code);
  return Object.freeze({ x, y, width, height });
}
