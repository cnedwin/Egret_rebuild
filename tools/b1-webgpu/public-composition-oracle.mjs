// S3D1-A1 independent literal pixels. No Engine capture or product math imports.
const samples = Object.freeze({
  S1: Object.freeze([
    ['white-ui', 22, 24, [255, 255, 255, 255]],
    ['image-over-rectangle', 29, 30, [255, 0, 255, 255]],
    ['last-ui-rectangle', 31, 32, [0, 255, 0, 255]],
    ['scene-near-preserved', 17, 18, [255, 0, 0, 255]],
    ['scene-far-preserved', 10, 12, [0, 0, 255, 255]],
    ['outside', 4, 4, [0, 0, 0, 255]],
  ]),
  S2: Object.freeze([
    ['clip-outside', 33, 28, [255, 255, 255, 255]],
    ['clip-inside', 29, 28, [255, 0, 255, 255]],
    ['white-ui', 22, 24, [255, 255, 255, 255]],
    ['image-over-rectangle', 29, 30, [255, 0, 255, 255]],
    ['last-ui-rectangle', 31, 32, [0, 255, 0, 255]],
    ['scene-near-preserved', 17, 18, [255, 0, 0, 255]],
    ['scene-far-preserved', 10, 12, [0, 0, 255, 255]],
    ['outside', 4, 4, [0, 0, 0, 255]],
  ]),
});
export const COMPOSITION_BASELINES = Object.freeze(['S1', 'S2']);
export const COMPOSITION_CONTROL = Object.freeze({ id: 'SN1', frame: 'S2', assertion: 'clip-outside',
  x: 33, y: 28, expected: Object.freeze([255, 255, 255, 255]), actual: Object.freeze([255, 0, 255, 255]) });
export class CompositionPixelAssertion extends Error {
  constructor(assertion, x, y, expected, actual) {
    super(`Public composition pixel ${assertion} failed at (${x},${y})`);
    this.name = 'CompositionPixelAssertion';
    Object.assign(this, { assertion, x, y, expected: [...expected], actual });
  }
}
export function verifyCompositionPixels(readback, frame, selectedAssertion = null) {
  if (!Object.hasOwn(samples, frame) || readback.width !== 64 || readback.height !== 64
      || readback.bytes.length !== 16384 || readback.format !== 'rgba8unorm'
      || !['rgba8unorm', 'bgra8unorm'].includes(readback.sourceFormat)
      || readback.colorSpace !== 'srgb' || readback.alphaMode !== 'premultiplied') throw Error('COMPOSITION_READBACK_METADATA_INVALID');
  const selected = selectedAssertion ? samples[frame].filter(value => value[0] === selectedAssertion) : samples[frame];
  if (selectedAssertion && selected.length !== 1) throw Error('COMPOSITION_NAMED_ASSERTION_INVALID');
  for (const [assertion, x, y, expected] of selected) {
    const offset = 4 * (64 * y + x), actual = Array.from(readback.bytes.slice(offset, offset + 4));
    if (actual.some((value, index) => value !== expected[index])) throw new CompositionPixelAssertion(assertion, x, y, expected, actual);
  }
  return { comparisons: selected.length, selection: selectedAssertion, exhaustive: false };
}
