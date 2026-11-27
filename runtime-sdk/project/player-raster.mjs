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
    // Legacy operations know the expected size. An embedded image is sized by
    // Android's bounded header probe before allocating or decoding its bitmap.
    const embedded = job.op === 'glbJpeg' || job.op === 'glbPng' || job.op === 'bitmapPng';
    const decoded = embedded ? request(job) : undefined;
    const {width, height} = decoded ?? job;
    if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 4096) || width * height > 1048576)
      throw new RangeError('Invalid raster dimensions');
    const {pixels} = decoded ?? request(job);
    const length = width * height * 4;
    if (typeof pixels !== 'string' || pixels.length !== Math.ceil(length / 3) * 4)
      throw new Error('Incomplete Android raster response');
    const bytes = typeof Uint8Array.fromBase64 === 'function' ? Uint8Array.fromBase64(pixels)
      : Uint8Array.from(atob(pixels), char => char.charCodeAt(0));
    if (bytes.length !== length) throw new Error('Incomplete Android raster pixels');
    return createImageData2D({width, height, pixels: bytes});
  }
  function embeddedImage(op, path, offset, length) {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 1 || offset + length > 8 * 1024 * 1024)
      throw new RangeError('Invalid embedded image range');
    return image({op, path, offset, length});
  }
  return Object.freeze({
    async loadPng(path, width, height, signal) {
      // Yield once so an already-queued cancellation wins before synchronous local decoding.
      await Promise.resolve();
      if (signal?.aborted) throw signal.reason;
      return image({op: 'png', path, width, height});
    },
    decodeBitmapPng(data) {
      if (typeof data !== 'string' || data.length > 87384) throw new RangeError('BitmapData PNG exceeds 64 KiB');
      return image({op:'bitmapPng',data});
    },
    decodeEmbeddedJpeg(path, offset, length) {
      return embeddedImage('glbJpeg', path, offset, length);
    },
    decodeEmbeddedPng(path, offset, length) {
      return embeddedImage('glbPng', path, offset, length);
    },
    measureText(runs) {
      if (runs.some(run => run.italic === true || (run.fontFamily !== undefined && run.fontFamily !== 'sans-serif'))) {
        const { metrics } = request({ op: 'textMetrics', runs });
        if (!Array.isArray(metrics) || metrics.length !== runs.length || !metrics.every(m => Number.isFinite(m?.width) && m.width >= 0))
          throw new Error('Invalid Android text widths');
        return metrics.map(m => m.width);
      }
      const {widths} = request({op: 'measure', runs});
      if (!Array.isArray(widths) || widths.length !== runs.length || !widths.every(n => Number.isFinite(n) && n >= 0))
        throw new Error('Invalid Android text widths');
      return widths;
    },
    measureTextInk(runs) {
      const { metrics } = request({ op: 'textMetrics', runs });
      if (!Array.isArray(metrics) || metrics.length !== runs.length || !metrics.every(row =>
        row && ['width','ascent','descent','left','top','right','bottom'].every(key => Number.isFinite(row[key])) &&
        row.width >= 0 && row.left <= row.right && row.top <= row.bottom))
        throw new Error('Invalid Android text metrics');
      return metrics;
    },
    graphemes(text) {
      const { ends } = request({ op: 'graphemes', text });
      if (!Array.isArray(ends) || (ends.at(-1) ?? 0) !== text.length ||
          !ends.every((end, i) => Number.isInteger(end) && end > (i ? ends[i - 1] : 0)))
        throw new Error('Invalid Android grapheme boundaries');
      return ends.map((end, i) => text.slice(i ? ends[i - 1] : 0, end));
    },
    drawText(width, height, runs) {
      // A distinct operation lets older AARs reject outlined text instead of silently painting just the fill.
      const styled = runs.some(run => (run.strokeWidth !== undefined && run.strokeWidth !== 0) ||
        run.italic === true || (run.fontFamily !== undefined && run.fontFamily !== 'sans-serif'));
      const op = styled ? 'textOutline' : 'text';
      return image({op, width, height, runs});
    }
  });
}
