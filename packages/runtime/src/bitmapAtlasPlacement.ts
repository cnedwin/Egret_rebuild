// SPDX-License-Identifier: Apache-2.0
import type { Matrix2D, Rectangle2D } from '@egret/contracts';
import type { BitmapCaptureState } from './bitmapDisplayState.js';
import { EgretError } from './EgretError.js';
/** Packed-local to logical placement; scene, anchors and clips keep their original M. */
export function bitmapAtlasPlacement(state: BitmapCaptureState, matrix: Matrix2D): {
  readonly matrix: Matrix2D; readonly rect: Rectangle2D;
} {
  const layout = state.layout;
  if (layout === undefined) return { matrix, rect: { x: 0, y: 0, width: state.width, height: state.height } };
  const { width, height } = state.sourceRect;
  // Keep local S explicit: one packing coefficient controls the general M*S sign.
  const local: Matrix2D = layout.packedRotation === 0 ? {
    a: 1, b: 0, c: 0, d: 1, tx: layout.trimX, ty: layout.trimY,
  } : {
    a: 0, b: -1, c: 1, d: 0, tx: layout.trimX, ty: layout.trimY + width,
  };
  const placed: Matrix2D = {
    a: matrix.a * local.a + matrix.c * local.b,
    b: matrix.b * local.a + matrix.d * local.b,
    c: matrix.a * local.c + matrix.c * local.d,
    d: matrix.b * local.c + matrix.d * local.d,
    tx: matrix.a * local.tx + matrix.c * local.ty + matrix.tx,
    ty: matrix.b * local.tx + matrix.d * local.ty + matrix.ty,
  };
  if (![placed.a, placed.b, placed.c, placed.d, placed.tx, placed.ty].every(Number.isFinite)) {
    throw new EgretError('FRAME_TRANSFORM_INVALID');
  }
  // Validate actual packed corners as well as the six resulting coefficients.
  for (const px of [0, width]) for (const py of [0, height]) {
    if (!Number.isFinite(placed.a * px + placed.c * py + placed.tx)
      || !Number.isFinite(placed.b * px + placed.d * py + placed.ty)) throw new EgretError('FRAME_TRANSFORM_INVALID');
  }
  return { matrix: Object.freeze(placed), rect: Object.freeze({ x: 0, y: 0, width, height }) };
}
