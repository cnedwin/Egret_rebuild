// SPDX-License-Identifier: Apache-2.0
import { createImageData2D } from '@egret/engine';

// All pixel inputs are straight, top-to-bottom sRGB RGBA. This path runs only
// when the game prepares an image or changes text, never for a retained draw.
export function createPlayerRaster(native, lifetime) {
  if (typeof native.raster !== 'function') return undefined;
  function request(job) {
    if (lifetime.aborted) throw lifetime.reason;
    const response = JSON.parse(native.raster(JSON.stringify(job)));
    if (response.error) throw new Error(response.error);
    return response;
  }
  function image(job) {
    const { width, height } = job;
    if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 4096) || width * height > 1048576)
      throw new RangeError('Invalid raster dimensions');
    const {pixels} = request(job);
    const length = width * height * 4;
    if (typeof pixels !== 'string' || pixels.length !== Math.ceil(length / 3) * 4)
      throw new Error('Incomplete Android raster response');
    const bytes = typeof Uint8Array.fromBase64 === 'function' ? Uint8Array.fromBase64(pixels)
      : Uint8Array.from(atob(pixels), char => char.charCodeAt(0));
    if (bytes.length !== length) throw new Error('Incomplete Android raster pixels');
    return createImageData2D({width, height, pixels: bytes});
  }
  return Object.freeze({
    async loadPng(path, width, height, signal) {
      // Yield once so an already-queued cancellation wins before synchronous local decoding.
      await Promise.resolve();
      if (signal?.aborted) throw signal.reason;
      return image({op: 'png', path, width, height});
    },
    measureText(runs) {
      const {widths} = request({op: 'measure', runs});
      if (!Array.isArray(widths) || widths.length !== runs.length || !widths.every(n => Number.isFinite(n) && n >= 0))
        throw new Error('Invalid Android text widths');
      return widths;
    },
    drawText(width, height, runs) {
      return image({op: 'text', width, height, runs});
    }
  });
}
