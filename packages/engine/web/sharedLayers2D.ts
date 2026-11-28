// SPDX-License-Identifier: Apache-2.0
// What both shared Hosts read from a kept layer's placement and its effect, and the limits of their layer caches.
// Nothing here makes a native call or changes Host state; each Host refuses with its own codes.
import type { SharedRenderFrame2D } from '@egret/contracts';

/** Live layer handles a Host admits, and placements in one frame. */
export const MAX_LAYER_HANDLES = 512;
/** Pixels on each side of a layer's target. */
export const MAX_LAYER_EXTENT = 2048;
/** RGBA8 bytes of every live target, including pending and pinned superseded revisions. */
export const MAX_LAYER_BYTES = 32 * 1024 * 1024;

type LayerRGB = readonly [number, number, number];
/** A placement's tint as it is given: its logical bounds and its multiplied and added color. */
export interface SharedLayerEffectInput2D {
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly multiply?: LayerRGB;
  readonly add?: LayerRGB;
}
/** A tint in backing pixels, clipped to the frame; it changes the pixels whose centres lie inside. */
export interface SharedLayerEffect2D {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly scale: LayerRGB;
  readonly emission: LayerRGB;
}
/** One placement of a revision in backing pixels, with the tint that reaches it. */
export interface SharedLayerRead2D<Revision> {
  readonly revision: Revision;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly effect: SharedLayerEffect2D | undefined;
}

/**
 * Applies the logical-to-physical clipping and RGB bounds of a placement's effect. Undefined when the effect changes
 * nothing or lies outside the frame. `refuse` throws the Host's own refusal.
 */
export function readSharedLayerEffect2D(
  enableEffects: boolean,
  pixelRatio: number,
  input: SharedLayerEffectInput2D,
  frameWidth: number,
  frameHeight: number,
  refuse: () => never
): SharedLayerEffect2D | undefined {
  if (!enableEffects || !input || typeof input !== 'object') refuse();
  const { bounds, multiply, add } = input;
  if (!bounds || typeof bounds !== 'object') refuse();
  const { x, y, width, height } = bounds;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    width <= 0 ||
    height <= 0
  )
    refuse();
  const left = x * pixelRatio,
    top = y * pixelRatio,
    right = (x + width) * pixelRatio,
    bottom = (y + height) * pixelRatio;
  if (
    ![left, top, right, bottom].every(value => Number.isFinite(value) && Math.abs(value) <= 8388608) ||
    right <= left ||
    bottom <= top
  )
    refuse();
  const scale = multiply === undefined ? undefined : readLayerColor(multiply, 4, refuse);
  const emission = add === undefined ? undefined : readLayerColor(add, 1, refuse);
  if ((!scale || scale.every(value => value === 1)) && (!emission || emission.every(value => value === 0)))
    return undefined;
  // Ceil-sized backing buffers can contain centers beyond the logical frame.
  const clippedLeft = Math.max(0, left),
    clippedTop = Math.max(0, top);
  const clippedRight = Math.min(frameWidth * pixelRatio, right),
    clippedBottom = Math.min(frameHeight * pixelRatio, bottom);
  if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) return undefined;
  return {
    left: clippedLeft,
    top: clippedTop,
    right: clippedRight,
    bottom: clippedBottom,
    scale: scale ?? [1, 1, 1],
    emission: emission ?? [0, 0, 0]
  };
}
function readLayerColor(input: LayerRGB, max: number, refuse: () => never): LayerRGB {
  if (!Array.isArray(input) || input.length !== 3) refuse();
  const rgb = [input[0], input[1], input[2]] as const;
  if (!rgb.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max)) refuse();
  return rgb;
}

/** Converts one verified revision's placement after the Host's lifecycle checks. `refuse` throws the Host's own refusal. */
export function readSharedLayerPlacement2D<Revision>(
  revision: Revision,
  x: unknown,
  y: unknown,
  width: unknown,
  height: unknown,
  ratio: number,
  light: SharedLayerEffect2D | undefined,
  refuse: () => never
): SharedLayerRead2D<Revision> {
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    width <= 0 ||
    height <= 0
  )
    refuse();
  const physicalX = x * ratio,
    physicalY = y * ratio,
    physicalWidth = width * ratio,
    physicalHeight = height * ratio;
  if (
    ![physicalX, physicalY, physicalWidth, physicalHeight, physicalX + physicalWidth, physicalY + physicalHeight].every(
      value => Number.isFinite(value) && Math.abs(value) <= 8388608
    )
  )
    refuse();
  const visibleLight =
    light &&
    light.left < physicalX + physicalWidth &&
    light.right > physicalX &&
    light.top < physicalY + physicalHeight &&
    light.bottom > physicalY
      ? light
      : undefined;
  return {
    revision,
    x: physicalX,
    y: physicalY,
    width: physicalWidth,
    height: physicalHeight,
    effect: visibleLight
  };
}

/**
 * Whether a frame may be baked into a layer: transparent clear, whole pixel sides, and only rectangles and images
 * drawn source-over without effects; `budget` when its target would pass the side or byte limits.
 */
export function sharedLayerBakeRefusal2D(
  frame: SharedRenderFrame2D,
  residentBytes: number
): 'invalid' | 'budget' | undefined {
  if (
    frame.clearAlpha !== 0 ||
    !Number.isInteger(frame.width) ||
    !Number.isInteger(frame.height) ||
    frame.commands.some(command =>
      command.kind === 'barrier'
        ? command.effect !== undefined
        : command.kind === 'mesh' || frame.materials[command.materialIndex]?.blend !== 'normal'
    )
  )
    return 'invalid';
  if (
    frame.width > MAX_LAYER_EXTENT ||
    frame.height > MAX_LAYER_EXTENT ||
    residentBytes + frame.width * frame.height * 4 > MAX_LAYER_BYTES
  )
    return 'budget';
  return undefined;
}
