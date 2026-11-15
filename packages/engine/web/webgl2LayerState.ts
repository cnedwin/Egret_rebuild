// SPDX-License-Identifier: Apache-2.0
import type { SharedWebGL2Configuration } from './sharedWebGL2Options.js';
import {
  sharedWebGL2LayerVertexSource,
  sharedWebGL2LayerFragmentSource,
  sharedWebGL2LayerEffectFragmentSource
} from './sharedWebGL2Shaders.js';
import { glFailure } from './webgl2Native.js';
import type { GLNativeOwner, GLNativeSession } from './webgl2Native.js';
import type { SharedWebGL2LayerEffect2D } from './webgl2Types.js';

export const MAX_LAYER_HANDLES = 512;
export const MAX_LAYER_EXTENT = 2048;
export const MAX_LAYER_BYTES = 32 * 1024 * 1024;
export interface LayerRevision {
  readonly owner: GLNativeOwner;
  readonly native: GLNativeSession;
  pins: number;
  retained: boolean;
}
interface LayerEffect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly scale: readonly [number, number, number];
  readonly emission: readonly [number, number, number];
}
export interface LayerRead {
  readonly revision: LayerRevision;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly effect: LayerEffect | undefined;
}
export interface LayerProgram {
  readonly program: WebGLProgram;
  readonly origin: WebGLUniformLocation | null;
  readonly extent: WebGLUniformLocation | null;
  readonly viewport: WebGLUniformLocation | null;
  readonly texture: WebGLUniformLocation | null;
  readonly effect:
    | {
        readonly min: WebGLUniformLocation | null;
        readonly max: WebGLUniformLocation | null;
        readonly scaleRG: WebGLUniformLocation | null;
        readonly scaleBAddR: WebGLUniformLocation | null;
        readonly addGB: WebGLUniformLocation | null;
      }
    | undefined;
}

/** Apply the original logical-to-physical clipping and RGB bounds. */
export function readWebGL2LayerEffect(
  options: Pick<SharedWebGL2Configuration, 'enableEffects' | 'pixelRatio'>,
  input: SharedWebGL2LayerEffect2D,
  frameWidth: number,
  frameHeight: number
): LayerEffect | undefined {
  if (!options.enableEffects || !input || typeof input !== 'object') throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
  const { bounds, multiply, add } = input;
  if (!bounds || typeof bounds !== 'object') throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
  const { x, y, width, height } = bounds;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    width <= 0 ||
    height <= 0
  )
    throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
  const ratio = options.pixelRatio,
    left = x * ratio,
    top = y * ratio,
    right = (x + width) * ratio,
    bottom = (y + height) * ratio;
  if (
    ![left, top, right, bottom].every(value => Number.isFinite(value) && Math.abs(value) <= 8388608) ||
    right <= left ||
    bottom <= top
  )
    throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
  const scale = multiply === undefined ? undefined : readLayerColor(multiply, 4);
  const emission = add === undefined ? undefined : readLayerColor(add, 1);
  if ((!scale || scale.every(value => value === 1)) && (!emission || emission.every(value => value === 0)))
    return undefined;
  // Ceil-sized backing buffers can contain centers beyond the logical frame.
  const clippedLeft = Math.max(0, left),
    clippedTop = Math.max(0, top);
  const clippedRight = Math.min(frameWidth * ratio, right),
    clippedBottom = Math.min(frameHeight * ratio, bottom);
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
function readLayerColor(input: readonly [number, number, number], max: number): readonly [number, number, number] {
  if (!Array.isArray(input) || input.length !== 3) throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
  const rgb = [input[0], input[1], input[2]] as const;
  if (!rgb.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max))
    throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
  return rgb;
}

/** Convert one verified revision's placement after the Host's lifecycle checks. */
export function readWebGL2LayerPlacement(
  revision: LayerRevision,
  x: unknown,
  y: unknown,
  width: unknown,
  height: unknown,
  ratio: number,
  light: LayerEffect | undefined
): LayerRead {
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    width <= 0 ||
    height <= 0
  )
    throw glFailure('WEBGL2_LAYER_INVALID');
  const physicalX = x * ratio,
    physicalY = y * ratio,
    physicalWidth = width * ratio,
    physicalHeight = height * ratio;
  if (
    ![physicalX, physicalY, physicalWidth, physicalHeight, physicalX + physicalWidth, physicalY + physicalHeight].every(
      value => Number.isFinite(value) && Math.abs(value) <= 8388608
    )
  )
    throw glFailure('WEBGL2_LAYER_INVALID');
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

/** Build program bindings; the Host owns generation invalidation and cache publication. */
export function createWebGL2LayerProgram(native: GLNativeSession, effect: boolean): LayerProgram {
  const gl = native.gl,
    program = native.program(
      sharedWebGL2LayerVertexSource,
      effect ? sharedWebGL2LayerEffectFragmentSource : sharedWebGL2LayerFragmentSource
    );
  const location = (name: string) => gl.getUniformLocation(program, name);
  const variant: LayerProgram = {
    program,
    origin: location('origin'),
    extent: location('extent'),
    viewport: location('viewportSize'),
    texture: location('layerTexture'),
    effect: effect
      ? {
          min: location('effectMin'),
          max: location('effectMax'),
          scaleRG: location('multiplyRG'),
          scaleBAddR: location('multiplyBAddR'),
          addGB: location('addGB')
        }
      : undefined
  };
  return variant;
}
