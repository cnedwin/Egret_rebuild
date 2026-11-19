// SPDX-License-Identifier: Apache-2.0
// Standalone browser projects can prepare the same atlas layout with Canvas 2D.
import { createImageData2D } from '@egret/engine';
const DENSITY = 2;
function surface(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d', { willReadFrequently: true });
}
function snapshot(context) {
  const { width, height } = context.canvas;
  const { data } = context.getImageData(0, 0, width, height);
  return createImageData2D({ width, height, pixels: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) });
}
export async function loadPng(file, width, height, signal) {
  if (signal?.aborted) throw signal.reason;
  const image = new Image();
  await new Promise((resolve, reject) => {
    function cleanup() {
      image.onload = image.onerror = null;
      signal?.removeEventListener('abort', abort);
    }
    function abort() {
      cleanup();
      image.removeAttribute('src');
      reject(signal.reason);
    }
    image.onload = () => { cleanup(); resolve(); };
    image.onerror = () => { cleanup(); reject(new Error('Unable to read ' + file)); };
    signal?.addEventListener('abort', abort);
    try { image.src = file; }
    catch (error) { cleanup(); reject(error); }
  });
  if (signal?.aborted) throw signal.reason;
  if (image.naturalWidth !== width || image.naturalHeight !== height) throw new Error('Unexpected size of ' + file);
  const ctx = surface(width, height);
  ctx.drawImage(image, 0, 0);
  return snapshot(ctx);
}
const browserRaster = {
  loadPng,
  measureText(runs) {
    const ctx = surface(1, 1);
    return runs.map(({ text, size, weight }) => {
      ctx.font = weight + ' ' + size + 'px sans-serif';
      return ctx.measureText(text).width;
    });
  },
  drawText(width, height, runs) {
    const ctx = surface(width, height);
    ctx.textBaseline = 'top';
    for (const { text, size, weight, color, x, y, maxWidth } of runs) {
      ctx.font = weight + ' ' + size + 'px sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(text, x, y, maxWidth);
    }
    return snapshot(ctx);
  }
};

// Shape whole runs with the host font before packing the immutable atlas.
export function makeLabels(entries, service = browserRaster) {
  const width = 768, runs = new Map(), painted = [];
  const labels = entries.map(([, text, size, color, weight = 400]) => ({ text, size: size * DENSITY, color, weight }));
  const widths = service.measureText(labels);
  let x = 1, y = 1, rowHeight = 0;
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i], w = Math.ceil(widths[i] + 4), h = Math.ceil(label.size * 1.4 + 4);
    if (w > width - 2) throw new Error('Label width exceeds atlas');
    if (x + w > width) { x = 1; y += rowHeight + 1; rowHeight = 0; }
    runs.set(entries[i][0], { x, y, width: w, height: h });
    painted.push({ ...label, x: x + 1, y: y + 2, maxWidth: w - 2 });
    x += w + 1;
    rowHeight = Math.max(rowHeight, h);
  }
  return { image: service.drawText(width, y + rowHeight + 1, painted), runs };
}
export const hudRuns = {
  order: { x: 0, y: 0, width: 500, height: 48 },
  ingredients: { x: 0, y: 48, width: 630, height: 40 },
  message: { x: 0, y: 88, width: 630, height: 40 },
  signature: { x: 0, y: 128, width: 360, height: 40 },
  score: { x: 365, y: 128, width: 255, height: 40 }
};
export function makeHud({ order, ingredients, message, signature, score }, service = browserRaster) {
  const painted = [
    ['order', order, 19, '#fff0c9', 700], ['ingredients', ingredients, 14, '#dfd6aa', 400],
    ['message', message, 13, '#f2d39e', 500], ['signature', signature, 15, '#f2e5c7', 500],
    ['score', score, 13, '#cfba83', 500]
  ].map(([key, text, size, color, weight]) => {
    const row = hudRuns[key];
    return { text, size: size * DENSITY, color, weight, x: row.x + 1, y: row.y + 2, maxWidth: row.width - 2 };
  });
  return service.drawText(632, 170, painted);
}

export function herbariumRaster(service = browserRaster) {
  return {
    loadPng: (...args) => service.loadPng(...args),
    makeLabels: entries => makeLabels(entries, service),
    makeHud: values => makeHud(values, service)
  };
}
