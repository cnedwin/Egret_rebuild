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
import { readSharedLayerEffect2D, readSharedLayerPlacement2D } from './sharedLayers2D.js';
import type { SharedLayerEffect2D, SharedLayerRead2D } from './sharedLayers2D.js';

export { MAX_LAYER_HANDLES, sharedLayerBakeRefusal2D } from './sharedLayers2D.js';

export interface LayerRevision {
  readonly owner: GLNativeOwner;
  readonly native: GLNativeSession;
  pins: number;
  retained: boolean;
}
export type LayerRead = SharedLayerRead2D<LayerRevision>;
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
const effectInvalid = (): never => {
  throw glFailure('WEBGL2_LAYER_EFFECT_INVALID');
};
const placementInvalid = (): never => {
  throw glFailure('WEBGL2_LAYER_INVALID');
};

/** Apply the original logical-to-physical clipping and RGB bounds. */
export function readWebGL2LayerEffect(
  options: Pick<SharedWebGL2Configuration, 'enableEffects' | 'pixelRatio'>,
  input: SharedWebGL2LayerEffect2D,
  frameWidth: number,
  frameHeight: number
): SharedLayerEffect2D | undefined {
  return readSharedLayerEffect2D(
    options.enableEffects,
    options.pixelRatio,
    input,
    frameWidth,
    frameHeight,
    effectInvalid
  );
}

/** Convert one verified revision's placement after the Host's lifecycle checks. */
export function readWebGL2LayerPlacement(
  revision: LayerRevision,
  x: unknown,
  y: unknown,
  width: unknown,
  height: unknown,
  ratio: number,
  light: SharedLayerEffect2D | undefined
): LayerRead {
  return readSharedLayerPlacement2D(revision, x, y, width, height, ratio, light, placementInvalid);
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
