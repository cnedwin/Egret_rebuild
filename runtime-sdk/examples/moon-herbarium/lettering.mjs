// SPDX-License-Identifier: Apache-2.0
// Canvas supplies image decoding and font rasterization. The game never presents a Canvas or DOM UI.
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
function paint(ctx, x, y, text, size, color, weight, limit) {
  ctx.font = weight + ' ' + (size * DENSITY) + 'px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y + 2, limit);
}
// Pack complete shaped runs so Han text and the user's typed Unicode retain the platform font's shaping.
export function makeLabels(entries) {
  const width = 768, ctx = surface(width, 1), runs = new Map();
  let x = 1, y = 1, rowHeight = 0;
  for (const [key, value, size, color, weight = 400] of entries) {
    ctx.font = weight + ' ' + (size * DENSITY) + 'px sans-serif';
    const w = Math.ceil(ctx.measureText(value).width + 4), h = Math.ceil(size * DENSITY * 1.4 + 4);
    if (w > width - 2) throw new Error('Label width exceeds atlas');
    if (x + w > width) { x = 1; y += rowHeight + 1; rowHeight = 0; }
    runs.set(key, { x, y, width: w, height: h });
    x += w + 1;
    rowHeight = Math.max(rowHeight, h);
  }
  ctx.canvas.height = y + rowHeight + 1;
  for (const [key, value, size, color, weight = 400] of entries) {
    const run = runs.get(key);
    paint(ctx, run.x + 1, run.y, value, size, color, weight, run.width - 2);
  }
  return { image: snapshot(ctx), runs };
}
export const hudRuns = {
  order: { x: 0, y: 0, width: 500, height: 48 },
  ingredients: { x: 0, y: 48, width: 630, height: 40 },
  message: { x: 0, y: 88, width: 630, height: 40 },
  signature: { x: 0, y: 128, width: 360, height: 40 },
  score: { x: 365, y: 128, width: 255, height: 40 }
};
export function makeHud({ order, ingredients, message, signature, score }) {
  const ctx = surface(632, 170);
  for (const [key, text, size, color, weight] of [
    ['order', order, 19, '#fff0c9', 700], ['ingredients', ingredients, 14, '#dfd6aa', 400],
    ['message', message, 13, '#f2d39e', 500], ['signature', signature, 15, '#f2e5c7', 500],
    ['score', score, 13, '#cfba83', 500]
  ]) {
    const row = hudRuns[key];
    paint(ctx, row.x + 1, row.y, text, size, color, weight, row.width - 2);
  }
  return snapshot(ctx);
}
