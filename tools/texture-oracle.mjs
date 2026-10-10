// These private CPU helpers never consume captured pixels or choose a native
// precision profile. The caller must authenticate its experimental bounds.
function captureTuple(value, domain, label) {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new TypeError(label + ' must be an ordinary four-component array');
  }
  // Indexed capture avoids caller iteration/coercion and preserves original
  // getter/native failures. No universal poisoning or OOM recovery is promised.
  const tuple = [value[0], value[1], value[2], value[3]];
  for (let channel = 0; channel < 4; channel++) {
    const component = tuple[channel];
    if (typeof component !== 'number' || !Number.isFinite(component)
      || domain === 'byte' && (!Number.isInteger(component) || component < 0 || component > 255)
      || domain === 'premul' && (component < 0 || component > 255)
      || domain === 'bound' && component < 0) {
      throw new TypeError(label + ' contains an invalid component');
    }
  }
  if (domain === 'premul' && (tuple[0] > tuple[3] || tuple[1] > tuple[3] || tuple[2] > tuple[3])) {
    throw new TypeError(label + ' must contain premultiplied channel units');
  }
  return tuple;
}

export function expectedUploadRGBA(straight) {
  const source = captureTuple(straight, 'byte', 'straight');
  const alpha = source[3];
  // C*A+127 is exactly represented for admitted integer bytes. This is the
  // selected CPU upload policy, not evidence of browser upload conversion.
  return [
    Math.floor((source[0] * alpha + 127) / 255),
    Math.floor((source[1] * alpha + 127) / 255),
    Math.floor((source[2] * alpha + 127) / 255),
    alpha === 0 ? 0 : alpha,
  ];
}

export function expectedEncodedOver(srcPremul, opacity, dstPremul) {
  const source = captureTuple(srcPremul, 'premul', 'source');
  if (typeof opacity !== 'number' || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new TypeError('opacity must be a primitive finite unit-interval number');
  }
  const destination = captureTuple(dstPremul, 'premul', 'destination');
  const remainder = 1 - source[3] * opacity / 255;
  // This continuous encoded-domain binary64 view has no UNORM quantization,
  // transfer conversion or extra premultiplication; rational fixtures remain
  // separate authority and this formula certifies no native blend precision.
  return [
    source[0] * opacity + destination[0] * remainder,
    source[1] * opacity + destination[1] * remainder,
    source[2] * opacity + destination[2] * remainder,
    source[3] * opacity + destination[3] * remainder,
  ];
}

export function assertTexturePixel(actual, expected, bound, id) {
  const observed = captureTuple(actual, 'byte', 'actual');
  const ideal = captureTuple(expected, 'finite', 'expected');
  const limits = captureTuple(bound, 'bound', 'bound');
  if (typeof id !== 'string' || id.length === 0 || id.length > 256) {
    throw new TypeError('id must be a nonempty primitive string of at most 256 code units');
  }
  // All arguments are admitted before comparison. Every channel uses its own
  // explicit absolute bound; UNKNOWN/null/default/fitted tolerances are absent.
  for (let channel = 0; channel < 4; channel++) {
    if (Math.abs(observed[channel] - ideal[channel]) > limits[channel]) {
      throw new RangeError(id + ': texture pixel differs at channel ' + channel);
    }
  }
}
