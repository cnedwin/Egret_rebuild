// SPDX-License-Identifier: Apache-2.0
// Independent P02 expectations from the frozen scenario specification.
// This module imports no encoder, application recipe, SDK or captured render data.

const frozen = value => {
  if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) frozen(entry);
    Object.freeze(value);
  }
  return value;
};

export const ASSET_NAMES = frozen([
  'atlas-v1.png', 'atlas-v2.png',
  'outfit-A.png', 'outfit-B.png', 'outfit-C.png', 'outfit-D.png',
]);

export const ASSET_SPECS = frozen(Object.fromEntries(ASSET_NAMES.map(name => [name, {
  width: name.startsWith('atlas-') ? 32 : 16,
  height: 16,
  bitDepth: 8,
  colorType: 6,
  interlace: 0,
  chunkTypes: ['IHDR', 'IDAT', 'IEND'],
}])));

const transparent = frozen([0, 0, 0, 0]);
const skin = frozen([255, 192, 128, 255]);
const cyan = frozen([0, 255, 255, 255]);
const gray = frozen([192, 192, 192, 255]);
const dark = frozen([32, 32, 32, 255]);
const outfit = frozen({
  'outfit-A.png': [255, 0, 0, 255],
  'outfit-B.png': [0, 255, 0, 255],
  'outfit-C.png': [0, 0, 255, 255],
  'outfit-D.png': [255, 255, 0, 255],
});

// Half-open coordinate predicates express the complete art independently of
// any encoder's drawing sequence or rectangle-filling implementation.
function pixel(name, x, y) {
  if (name.startsWith('outfit-')) {
    return x >= 5 && x < 11 && y >= 6 && y < 10 ? outfit[name] : transparent;
  }
  const localX = x % 16;
  const secondPose = x >= 16;
  if (y === 2 && (localX === 6 || localX === 9)) return dark;
  if (localX >= 5 && localX < 11 && y >= 1 && y < 5) {
    return name === 'atlas-v1.png' ? skin : cyan;
  }
  if (localX >= 4 && localX < 12 && y >= 5 && y < 11) return gray;
  const leg = secondPose
    ? localX >= 5 && localX < 11
    : (localX >= 4 && localX < 7) || (localX >= 9 && localX < 12);
  return leg && y >= 11 && y < 15 ? dark : transparent;
}

/** Return fresh complete RGBA storage; the caller cannot mutate future expectations. */
export function assetOracle(name) {
  if (!Object.hasOwn(ASSET_SPECS, name)) throw new RangeError('Unknown P02 asset: ' + name);
  const { width, height } = ASSET_SPECS[name];
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) rgba.set(pixel(name, x, y), (y * width + x) * 4);
  }
  return { width, height, rgba };
}

export const SCENE_GEOMETRY = frozen({
  frame: { width: 192, height: 128, pixelRatio: 1, clear: [0, 0, 0, 255] },
  actors: [
    { id: 'pilot-left', position: [56, 96], scale: [3, 3], anchor: [8, 16], card: [24, 40, 64, 64] },
    { id: 'pilot-right', position: [136, 96], scale: [3, 3], anchor: [8, 16], card: [104, 40, 64, 64] },
  ],
  cardColor: [64, 64, 64, 255],
  hitArea: [0, 0, 16, 16],
  touchChildren: false,
  childOrder: ['selection', 'body', 'outfit'],
  selection: { rect: [-1, -1, 18, 18], rgba: [255, 255, 255, 255] },
  clip: [0, 0, 8, 16],
  rotatedLeft: { degrees: 90, local: [8, 8], global: [80, 96] },
  badge: { rect: [8, 8, 16, 8], asset: 'tools/browser-png/assets/rgb-red-green.png' },
  ahem: { position: [32, 8], fontSize: 8, lineHeight: 8, density: 1, literals: ['X X', 'XX'] },
  chinese: { position: [72, 8], fontSize: 12, lineHeight: 16, density: 1,
    locale: 'zh-CN', direction: 'ltr', literals: ['左侧 已选择', '右侧 已选择'] },
  animation: { poses: [0, 1], durations: [0.125, 0.125],
    sourceTimes: [0, 0.125 - 2 ** -20, 0.125, 0.25], framesAfterAnchor: [0, 1, 0] },
  scene: { projection: { left: -1, right: 1, bottom: -1, top: 1, near: 1, far: 9 },
    front: { x: [-0.5, 0.5], y: [-0.5, 0.5], z: -3, rgba: [255, 0, 0, 255] },
    back: { x: [-0.75, 0.75], y: [-0.75, 0.75], z: -7, rgba: [0, 0, 255, 255] } },
});

export const BASELINE_POINTS = frozen([
  { name: 'badge-red', point: [10, 10], rgba: [255, 0, 0, 255] },
  { name: 'badge-green', point: [22, 10], rgba: [0, 255, 0, 255] },
  { name: 'Ahem-X-interior', point: [35, 11], rgba: [255, 255, 255, 255] },
  { name: 'left-A-torso', point: [56, 72], rgba: [255, 0, 0, 255] },
  { name: 'left-v1-head', point: [56, 54], rgba: [255, 192, 128, 255] },
  { name: 'left-pose0-leg', point: [45, 87], rgba: [32, 32, 32, 255] },
  { name: 'right-pose0-leg', point: [125, 87], rgba: [32, 32, 32, 255] },
]);

// These rows apply only to their named state; they are not simultaneous startup points.
export const CHANGED_POINTS = frozen([
  { name: 'left-pose1-leg-gap-selected', point: [45, 87], rgba: [255, 255, 255, 255] },
  { name: 'right-pose1-leg-gap-unselected', point: [125, 87], rgba: [64, 64, 64, 255] },
  { name: 'left-D-torso', point: [56, 72], rgba: [255, 255, 0, 255] },
  { name: 'left-v2-head', point: [56, 54], rgba: [0, 255, 255, 255] },
  { name: 'left-clipped-right-half', point: [56, 72], rgba: [64, 64, 64, 255] },
]);

export const PROFILE_POINTS = frozen({
  'canvas-2d': [
    { point: [96, 64], rgba: [0, 0, 0, 255] },
    { point: [32, 24], rgba: [0, 0, 0, 255] },
  ],
  'webgpu-scene-textured': [
    { point: [96, 64], rgba: [255, 0, 0, 255] },
    { point: [32, 24], rgba: [0, 0, 255, 255] },
  ],
});

export const FONT_REFERENCE_BOUNDARY = frozen({
  ahemSha256: 'f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc',
  notoSha256: '9e435555e47102d40ace35211158051b45c131bce1fc7c1daca871b2386ec895',
  chineseReference: 'Separate approved no-SDK glyph RGBA/metrics references are required before native comparison.',
  nativeGlyphCoverage: 'NOT_ESTABLISHED_BY_THIS_ORACLE',
});
