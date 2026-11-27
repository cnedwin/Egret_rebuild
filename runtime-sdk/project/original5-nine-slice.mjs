// SPDX-License-Identifier: Apache-2.0
import {createTexturedGeometry2D} from '@egret/engine';

/** The installed 5.x BitmapNode decides where each piece goes, including its
 * one-piece fallback for small targets. The native renderer receives one Mesh2D
 * that borrows the same full atlas page as an ordinary Bitmap. */
export function original5NineSlice(egret, texture, grid, width, height, lease) {
  const describe = egret?.sys?.BitmapNode?.$updateTextureDataWithScale9Grid;
  if (typeof describe !== 'function') throw new Error('Expected the original 5.x BitmapNode nine-slice layout');
  const page = lease.value.imageData;
  const positions = [], uvs = [], indices = [];
  let pieces = 0;
  const draws = {
    drawImage(sx, sy, sw, sh, x, y, w, h) {
      if (++pieces > 9 || ![sx, sy, sw, sh, x, y, w, h].every(Number.isFinite)
          || sx < 0 || sy < 0 || sw < 0 || sh < 0 || sx + sw > page.width || sy + sh > page.height) {
        throw new RangeError('Original 5 nine-slice exceeds its atlas page');
      }
      if (!sw || !sh || !w || !h) return;
      const first = positions.length / 2;
      positions.push(x, y, x + w, y, x, y + h, x + w, y + h);
      const left = sx / page.width, top = sy / page.height;
      const right = (sx + sw) / page.width, bottom = (sy + sh) / page.height;
      uvs.push(left, top, right, top, left, bottom, right, bottom);
      indices.push(first, first + 1, first + 2, first + 2, first + 1, first + 3);
    }
  };
  describe(draws, texture.$bitmapData, grid,
    texture.$bitmapX, texture.$bitmapY, texture.$bitmapWidth, texture.$bitmapHeight,
    texture.$offsetX, texture.$offsetY, texture.$textureWidth, texture.$textureHeight,
    Number.isFinite(width) ? width : texture.$textureWidth,
    Number.isFinite(height) ? height : texture.$textureHeight,
    texture.$sourceWidth, texture.$sourceHeight, true);
  return createTexturedGeometry2D({
    positions: Float64Array.from(positions), uvs: Float64Array.from(uvs),
    lightColors: new Float64Array(positions.length * 2).fill(1), indices: Uint16Array.from(indices)
  });
}
