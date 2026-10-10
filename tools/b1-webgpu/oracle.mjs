// Independent literal oracle. No product geometry, projection or packing imports.
const COLORS = Object.freeze({
  BLACK: Object.freeze([0, 0, 0, 255]), RED: Object.freeze([255, 0, 0, 255]),
  BLUE: Object.freeze([0, 0, 255, 255]), GREEN: Object.freeze([0, 255, 0, 255]),
  WHITE: Object.freeze([255, 255, 255, 255]), MAGENTA: Object.freeze([255, 0, 255, 255]),
});
const samples = {
  F1: [['near-red', 20, 24, 'RED'], ['far-blue', 12, 20, 'BLUE'], ['outside', 4, 4, 'BLACK']],
  F2: [['near-red', 20, 24, 'RED'], ['far-blue', 12, 20, 'BLUE'], ['outside', 4, 4, 'BLACK']],
  F3: [['left-mvp', 16, 16, 'GREEN'], ['right-mvp', 48, 48, 'GREEN'], ['left-bottom-empty', 16, 48, 'BLACK'], ['right-top-empty', 48, 16, 'BLACK']],
  F4: [['white-ui', 22, 24, 'WHITE'], ['image-over-rectangle', 29, 30, 'MAGENTA'], ['last-ui-rectangle', 31, 32, 'GREEN'], ['scene-near-preserved', 17, 18, 'RED'], ['scene-far-preserved', 10, 12, 'BLUE'], ['outside', 4, 4, 'BLACK']],
  F5: [['white-ui', 22, 24, 'WHITE'], ['rectangle-over-image', 29, 30, 'WHITE'], ['last-ui-rectangle', 31, 32, 'GREEN'], ['scene-near-preserved', 17, 18, 'RED'], ['scene-far-preserved', 10, 12, 'BLUE'], ['outside', 4, 4, 'BLACK']],
  F6: [], F7: [['behind-camera-center', 32, 32, 'BLACK']],
};
for (const list of Object.values(samples)) { for (const value of list) Object.freeze(value); Object.freeze(list); }
Object.freeze(samples);
export const POSITIVE_FRAMES = Object.freeze(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7']);
export const NEGATIVES = Object.freeze([
  Object.freeze({ id: 'N1', frame: 'F1', assertion: 'near-red', actual: COLORS.BLACK }),
  Object.freeze({ id: 'N2', frame: 'F3', assertion: 'right-mvp', actual: COLORS.BLACK }),
  Object.freeze({ id: 'N3', frame: 'F4', assertion: 'last-ui-rectangle', actual: COLORS.WHITE }),
  Object.freeze({ id: 'N4', frame: null, assertion: 'native-wgsl-rejection', actual: null }),
  Object.freeze({ id: 'N5', frame: 'F7', assertion: 'behind-camera-center', actual: COLORS.RED }),
]);
export class PixelAssertion extends Error {
  constructor(assertion, x, y, expected, actual) {
    super(`Literal pixel assertion ${assertion} failed at (${x},${y})`);
    this.name = 'PixelAssertion'; Object.assign(this, { assertion, x, y, expected: [...expected], actual });
  }
}
function check(bytes, assertion, x, y, expected) {
  const offset = 4 * (64 * y + x), actual = Array.from(bytes.slice(offset, offset + 4));
  if (actual.some((value, index) => value !== expected[index])) throw new PixelAssertion(assertion, x, y, expected, actual);
}
export function verifyPixels(readback, frame, selectedAssertion = null) {
  if (!Object.hasOwn(samples, frame) || readback.width !== 64 || readback.height !== 64
      || readback.bytes.length !== 16384 || readback.format !== 'rgba8unorm'
      || !['rgba8unorm', 'bgra8unorm'].includes(readback.sourceFormat)
      || readback.colorSpace !== 'srgb' || readback.alphaMode !== 'premultiplied') throw Error('READBACK_METADATA_INVALID');
  let comparisons = 0;
  const list = selectedAssertion ? samples[frame].filter(row => row[0] === selectedAssertion) : samples[frame];
  if (selectedAssertion && list.length !== 1) throw Error('UNKNOWN_NAMED_PIXEL_ASSERTION');
  for (const [name, x, y, color] of list) { check(readback.bytes, name, x, y, COLORS[color]); comparisons++; }
  if (!selectedAssertion && (frame === 'F6' || frame === 'F7')) {
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      // F7's named center was already checked; inspect every other pixel once.
      if (frame === 'F7' && x === 32 && y === 32) continue;
      check(readback.bytes, frame === 'F6' ? 'empty-black-reset' : 'behind-camera-all-black', x, y, COLORS.BLACK); comparisons++;
    }
  }
  return { comparisons, selection: selectedAssertion, exhaustive: !selectedAssertion && ['F6', 'F7'].includes(frame) };
}
