// Shared literal pixel assertion; browser fixtures and PNG checks use this exact oracle.
export function assertPixel(actual, expected, name) {
  const tolerance = expected.every(value => value === 0) ? 0 : 2;
  if (actual.length !== 4 || actual.some((value, index) => Math.abs(value - expected[index]) > tolerance)) {
    const error = new Error(`${name}: expected ${JSON.stringify(expected)}, observed ${JSON.stringify(Array.from(actual))}, tolerance ${tolerance}`);
    error.assertion = name; error.expected = expected; error.actual = Array.from(actual);
    throw error;
  }
  return { name, expected, actual: Array.from(actual), tolerance };
}
export function assertZero(bytes, name) {
  const first = bytes.findIndex(value => value !== 0);
  if (first !== -1) {
    const error = new Error(`${name}: nonzero byte ${first} = ${bytes[first]}`);
    error.assertion = name; error.expected = 0; error.actual = { index: first, value: bytes[first] };
    throw error;
  }
  return { name, bytesChecked: bytes.length, exactZero: true };
}
export function pixel(bytes, width, x, y) {
  const offset = 4 * (y * width + x);
  return Array.from(bytes.slice(offset, offset + 4));
}
export function composition(raw, background) {
  // Literal raw values describe ideal UNORM quantization; tolerance covers its rounding.
  return [0,1,2].map(i => Math.round(raw[i] + background * (1 - raw[3]/255))).concat(255);
}
