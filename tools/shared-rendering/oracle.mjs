// First-party shared-rendering scalar test reference. No product imports.
// This is a binary64 scalar reference. Callers supply their declared fragment
// coordinates; it does not predict rasterization, interpolation, or GPU precision.

export const REFERENCE_VERSION = 'egret.alpha8-capped-srgb-pma8/1';
const clamp01 = value => Math.min(1, Math.max(0, value));

export function decodeSrgb(encoded) {
  return encoded <= 0.04045
    ? encoded / 12.92
    : ((encoded + 0.055) / 1.055) ** 2.4;
}

export function encodeSrgb(linear) {
  return linear <= 0.0031308
    ? 12.92 * linear
    : 1.055 * linear ** (1 / 2.4) - 0.055;
}

export function quantize8(value) {
  return Math.floor(255 * clamp01(value) + 0.5);
}

// Enumerate the finite code domain rather than approximating the inverse curve.
// The cap is specific to exact alpha8, not arbitrary floating-point alpha.
export const alpha8Caps = Object.freeze(Array.from({ length: 256 }, (_, alpha) => {
  let result = 0;
  for (let code = 0; code < 256; code++) {
    if (decodeSrgb(code / 255) <= alpha / 255) result = code;
  }
  return result;
}));

function requireBytes(values, length) {
  if (values.length !== length) throw new RangeError('Oracle byte count mismatch');
  for (const value of values) {
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new RangeError('Oracle expected an RGBA8 byte');
    }
  }
}

export function canonicalPixel(rgba) {
  requireBytes(rgba, 4);
  const alpha = rgba[3], a = alpha / 255;
  const rgb = rgba.slice(0, 3).map(code => Math.min(
    quantize8(encodeSrgb(a * decodeSrgb(code / 255))),
    alpha8Caps[alpha],
  ));
  return [...rgb, alpha];
}

export function canonicalPage(width, height, straightBytes) {
  if (!Number.isInteger(width) || width <= 0 ||
      !Number.isInteger(height) || height <= 0) {
    throw new RangeError('Oracle page dimensions must be positive integers');
  }
  requireBytes(straightBytes, 4 * width * height);
  const bytes = new Uint8Array(straightBytes.length);
  for (let offset = 0; offset < bytes.length; offset += 4) {
    bytes.set(canonicalPixel(Array.from(straightBytes.slice(offset, offset + 4))), offset);
  }
  // The returned bytes are owned by this oracle call, not a product resource.
  return { width, height, bytes };
}

export function decodeStoredPixel(rgba) {
  requireBytes(rgba, 4);
  return [
    decodeSrgb(rgba[0] / 255), decodeSrgb(rgba[1] / 255),
    decodeSrgb(rgba[2] / 255), rgba[3] / 255,
  ];
}

function readTexel(page, x, y) {
  const offset = 4 * (y * page.width + x);
  return decodeStoredPixel(Array.from(page.bytes.slice(offset, offset + 4)));
}

function contentExtent(region) {
  return (region.quarterTurn & 1) === 0
    ? [region.packed.width, region.packed.height]
    : [region.packed.height, region.packed.width];
}

// x/y are content-local integer texel indices before clockwise packing.
export function rotateTexel(x, y, width, height, quarterTurn) {
  switch (quarterTurn) {
    case 0: return [x, y];
    case 1: return [height - 1 - y, x];
    case 2: return [width - 1 - x, height - 1 - y];
    case 3: return [y, width - 1 - x];
    default: throw new RangeError('Oracle quarter turn is unsupported');
  }
}

function regionTexel(page, region, x, y) {
  // Clamp each integer logical tap before applying the virtual transparent trim.
  const cx = Math.min(region.logicalWidth - 1, Math.max(0, x));
  const cy = Math.min(region.logicalHeight - 1, Math.max(0, y));
  const [width, height] = contentExtent(region);
  const localX = cx - region.trimX, localY = cy - region.trimY;
  if (localX < 0 || localY < 0 || localX >= width || localY >= height) {
    return [0, 0, 0, 0];
  }
  const [px, py] = rotateTexel(localX, localY, width, height, region.quarterTurn);
  return readTexel(page, region.packed.x + px, region.packed.y + py);
}

export function addressIndex(index, extent, mode) {
  if (!Number.isInteger(index) || !Number.isInteger(extent) || extent <= 0) {
    throw new RangeError('Oracle addressing expects integer taps and extent');
  }
  if (mode === 'clamp-to-edge') return Math.min(extent - 1, Math.max(0, index));
  const period = mode === 'repeat' ? extent
    : mode === 'mirror-repeat' ? 2 * extent : undefined;
  if (period === undefined) throw new RangeError('Oracle address mode is unsupported');
  const wrapped = ((index % period) + period) % period;
  return wrapped < extent ? wrapped : period - 1 - wrapped;
}

function filtered(qx, qy, filter, load) {
  if (!Number.isFinite(qx) || !Number.isFinite(qy)) {
    throw new RangeError('Oracle coordinates must be finite');
  }
  if (filter === 'nearest') return load(Math.floor(qx), Math.floor(qy));
  if (filter !== 'linear') throw new RangeError('Oracle filter is unsupported');
  const zx = qx - 0.5, zy = qy - 0.5;
  const x = Math.floor(zx), y = Math.floor(zy), fx = zx - x, fy = zy - y;
  // This intentionally uses four integer loads; it is independent of the
  // proposed one-sample clamp/coverage execution strategy.
  const taps = [load(x, y), load(x + 1, y), load(x, y + 1), load(x + 1, y + 1)];
  const weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  return [0, 1, 2, 3].map(channel =>
    taps[0][channel] * weights[0] + taps[1][channel] * weights[1] +
    taps[2][channel] * weights[2] + taps[3][channel] * weights[3]);
}

export function sampleRegion(page, region, qx, qy, filter = 'linear') {
  return filtered(qx, qy, filter, (x, y) => regionTexel(page, region, x, y));
}

export function samplePage(page, qx, qy, {
  filter = 'linear', addressU = 'clamp-to-edge', addressV = 'clamp-to-edge',
} = {}) {
  return filtered(qx, qy, filter, (x, y) =>
    readTexel(page, addressIndex(x, page.width, addressU), addressIndex(y, page.height, addressV)));
}

// Vertex two-color is applied first; material two-color acts on that result.
// The alpha coefficient is not included in either RGB light tuple twice.
export function shadeTwoColor(sample, {
  vertexLight = [1, 1, 1, 1], vertexDark = [0, 0, 0],
  materialLight = [1, 1, 1, 1], materialDark = [0, 0, 0], opacity = 1,
} = {}) {
  const alpha = sample[3];
  const vertex = sample.slice(0, 3).map((channel, index) =>
    channel * vertexLight[index] + (alpha - channel) * vertexDark[index]);
  const scale = opacity * vertexLight[3] * materialLight[3];
  return [
    ...vertex.map((channel, index) => scale * (
      channel * materialLight[index] + (alpha - channel) * materialDark[index])),
    scale * alpha,
  ];
}

// The mathematical blend result precedes attachment saturation/quantization.
export function blendLinear(source, destination, blend) {
  const [as, ad] = [source[3], destination[3]];
  const overAlpha = as + ad * (1 - as);
  const rgb = source.slice(0, 3).map((channel, index) => {
    const target = destination[index];
    switch (blend) {
      case 'normal': return channel + target * (1 - as);
      case 'add-accumulate':
      case 'add-preserve': return channel + target;
      case 'multiply-factor': return channel * target + target * (1 - as);
      case 'screen': return channel + target * (1 - channel);
      default: throw new RangeError('Oracle blend is unsupported');
    }
  });
  const alpha = blend === 'add-accumulate' ? as + ad
    : blend === 'add-preserve' ? ad : overAlpha;
  return [...rgb, alpha];
}

// Target writes use ordinary sRGB UNORM quantization, NOT the source page cap.
// Therefore decoded RGB may temporarily exceed decoded alpha by quantization.
export function quantizeTarget(linear) {
  return [
    quantize8(encodeSrgb(clamp01(linear[0]))),
    quantize8(encodeSrgb(clamp01(linear[1]))),
    quantize8(encodeSrgb(clamp01(linear[2]))),
    quantize8(linear[3]),
  ];
}

export function clearTarget(color = 0, alpha = 0, outputAlpha = 'premultiplied') {
  if (!Number.isInteger(color) || color < 0 || color > 0xffffff ||
      !Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new RangeError('Oracle clear is invalid');
  }
  if (outputAlpha === 'opaque' && alpha !== 1) {
    throw new RangeError('Oracle opaque clear requires alpha one');
  }
  if (outputAlpha !== 'opaque' && outputAlpha !== 'premultiplied') {
    throw new RangeError('Oracle output alpha is unsupported');
  }
  const rgb = [color >>> 16, (color >>> 8) & 255, color & 255];
  return quantizeTarget([...rgb.map(code => alpha * decodeSrgb(code / 255)), alpha]);
}

export function compositeToTarget(targetBytes, source, blend = 'normal', outputAlpha = 'premultiplied') {
  if (blend === 'add-preserve' && (outputAlpha !== 'opaque' || targetBytes[3] !== 255)) {
    throw new RangeError('Oracle add-preserve requires an initialized opaque target');
  }
  return quantizeTarget(blendLinear(source, decodeStoredPixel(targetBytes), blend));
}

export function resolveTarget(targetBytes, outputAlpha = 'premultiplied') {
  const decoded = decodeStoredPixel(targetBytes), alpha = decoded[3];
  const guarded = decoded.slice(0, 3).map(channel => Math.min(alpha, Math.max(0, channel)));
  if (outputAlpha === 'opaque') {
    return [...guarded.map(channel => quantize8(encodeSrgb(channel))), 255];
  }
  if (outputAlpha !== 'premultiplied') throw new RangeError('Oracle output alpha is unsupported');
  if (alpha === 0) return [0, 0, 0, 0];
  return [
    ...guarded.map(channel => quantize8(alpha * encodeSrgb(channel / alpha))),
    quantize8(alpha),
  ];
}

// Layer order is caller supplied. Each layer has already been sampled/shaded.
// The finite native quality fixtures may use at most four effective writes;
// this mathematical helper itself does not turn that fixture limit into an API.
export function renderPixel({
  clearColor = 0, clearAlpha = 0, outputAlpha = 'premultiplied', layers = [],
} = {}) {
  let target = clearTarget(clearColor, clearAlpha, outputAlpha);
  const targetWrites = [];
  for (const layer of layers) {
    target = compositeToTarget(target, layer.source, layer.blend ?? 'normal', outputAlpha);
    targetWrites.push([...target]);
  }
  return { target, targetWrites, rgba: resolveTarget(target, outputAlpha) };
}
