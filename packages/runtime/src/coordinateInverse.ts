import type { Matrix2D, Point2D } from '@egret/contracts';
import { EgretError } from './EgretError.js';

interface Dyadic { readonly integer: bigint; readonly exponent: number; }
type Product = readonly [Dyadic, Dyadic, 1 | -1];
type Products = readonly [Product, Product] | readonly [Product, Product, Product, Product];
const FRACTION_MASK = (1n << 52n) - 1n;
const MAX_BITS = 8192;

function magnitude(n: bigint): bigint { return n < 0n ? -n : n; }
function bits(n: bigint): number { return n === 0n ? 0 : magnitude(n).toString(2).length; }
function bounded(n: bigint): bigint {
  if (bits(n) > MAX_BITS) throw new EgretError('COORDINATE_ARITHMETIC_RANGE');
  return n;
}

/** Finite binary64 is decoded exactly; both DataView operations use big endian. */
function decodeFiniteDyadic(value: number, view: DataView): Dyadic {
  view.setFloat64(0, value, false);
  const raw = view.getBigUint64(0, false);
  const encodedExponent = Number((raw >> 52n) & 0x7ffn);
  const fraction = raw & FRACTION_MASK;
  const integer = encodedExponent === 0 ? fraction : (1n << 52n) | fraction;
  return {
    integer: (raw >> 63n) === 0n ? integer : -integer,
    exponent: encodedExponent === 0 ? -1074 : encodedExponent - 1075,
  };
}

/** Only the fixed two/four inverse products are admitted, with no rounded sum. */
function sumDyadicProducts(terms: Products): Dyadic {
  const products = terms.map(([left, right, sign]) => ({
    integer: bounded(left.integer * right.integer * BigInt(sign)),
    exponent: left.exponent + right.exponent,
  }));
  const nonzero = products.filter(product => product.integer !== 0n);
  if (nonzero.length === 0) return { integer: 0n, exponent: 0 };
  const exponent = Math.min(...nonzero.map(product => product.exponent));
  let integer = 0n;
  for (const product of nonzero) {
    integer = bounded(integer + bounded(product.integer << BigInt(product.exponent - exponent)));
  }
  return { integer, exponent };
}

/** Round the exact rational once, including subnormal ties and overflow carry. */
function roundDyadicRatio(numerator: Dyadic, denominator: Dyadic): number {
  if (numerator.integer === 0n) return 0;
  const negative = (numerator.integer < 0n) !== (denominator.integer < 0n);
  let n = magnitude(numerator.integer);
  let d = magnitude(denominator.integer);
  let binaryExponent = bits(n) - bits(d);
  if (binaryExponent >= 0) {
    if (n < bounded(d << BigInt(binaryExponent))) binaryExponent--;
  } else if (bounded(n << BigInt(-binaryExponent)) < d) binaryExponent--;
  const exponentDifference = numerator.exponent - denominator.exponent;
  const k = binaryExponent + exponentDifference;
  if (k > 1023) throw new EgretError('COORDINATE_ARITHMETIC_RANGE');
  if (k < -1075) return 0;
  const quantum = k >= -1022 ? k - 52 : -1074;
  const shift = exponentDifference - quantum;
  if (shift >= 0) n = bounded(n << BigInt(shift));
  else d = bounded(d << BigInt(-shift));
  let significand = n / d;
  const remainder = n % d;
  const twiceRemainder = remainder << 1n;
  if (twiceRemainder > d || (twiceRemainder === d && (significand & 1n) !== 0n)) significand++;
  const result = Number(significand) * 2 ** quantum;
  if (!Number.isFinite(result)) throw new EgretError('COORDINATE_ARITHMETIC_RANGE');
  return result === 0 ? 0 : negative ? -result : result;
}

/** Exact rank belongs to the stored finite world matrix, not authored scales. */
export function invertCoordinatePoint(matrix: Matrix2D, x: number, y: number): Point2D {
  const view = new DataView(new ArrayBuffer(8));
  const a = decodeFiniteDyadic(matrix.a, view), b = decodeFiniteDyadic(matrix.b, view);
  const c = decodeFiniteDyadic(matrix.c, view), d = decodeFiniteDyadic(matrix.d, view);
  const tx = decodeFiniteDyadic(matrix.tx, view), ty = decodeFiniteDyadic(matrix.ty, view);
  const gx = decodeFiniteDyadic(x, view), gy = decodeFiniteDyadic(y, view);
  const determinant = sumDyadicProducts([[a, d, 1], [b, c, -1]]);
  if (determinant.integer === 0n) throw new EgretError('COORDINATE_TRANSFORM_SINGULAR');
  const nx = sumDyadicProducts([[d, gx, 1], [d, tx, -1], [c, gy, -1], [c, ty, 1]]);
  const ny = sumDyadicProducts([[a, gy, 1], [a, ty, -1], [b, gx, -1], [b, tx, 1]]);
  // Both coordinates finish before the caller can publish an owned point.
  return { x: roundDyadicRatio(nx, determinant), y: roundDyadicRatio(ny, determinant) };
}
