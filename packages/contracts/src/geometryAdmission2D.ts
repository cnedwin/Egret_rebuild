// First-party Apache-2.0 implementation. Native admission follows the existing
// first-party ImageData2D pattern. The textured and shared geometry modules both
// admit their arrays here; each keeps its own fields, shape and accounting.

/** Which geometry is being admitted; it begins every refusal message. */
export type GeometrySubject2D = 'Textured geometry' | 'Shared geometry';
/** How a canonical component is checked: positions any finite value, units within 0 to 1. */
export type GeometryComponentKind2D = 'position' | 'uv' | 'unit' | 'index';
/** Whether floating components are kept as given or rounded to single precision. */
export type GeometryPrecision2D = 'exact' | 'single';

type FloatTag = 'Float32Array' | 'Float64Array';
type IndexTag = 'Uint16Array' | 'Uint32Array';
/** The intrinsic brand of an admitted array. */
export type GeometryPayloadTag2D = FloatTag | IndexTag;
/** A private copy of an admitted array. */
export type GeometryPayload2D =
  | Float32Array<ArrayBuffer>
  | Float64Array<ArrayBuffer>
  | Uint16Array<ArrayBuffer>
  | Uint32Array<ArrayBuffer>;

// Capture normal-realm intrinsics before descriptor callbacks can replace them.
// Admission and copying do not read instance properties, iterators or species.
const Floats32 = Float32Array;
const Floats64 = Float64Array;
const Indices16 = Uint16Array;
const Indices32 = Uint32Array;
const Bytes = Uint8Array;
const Numbers = Array;
const Registry = WeakMap;
const apply = Reflect.apply;
const freeze = Object.freeze;
const setPrototypeOf = Object.setPrototypeOf;
const arrayPrototype = Numbers.prototype;
const TypeFault = TypeError;
const RangeFault = RangeError;
const finite = Number.isFinite;
const integer = Number.isInteger;
const safeInteger = Number.isSafeInteger;
const fround = Math.fround;
const abs = Math.abs;
const typedArrayPrototype = Object.getPrototypeOf(Bytes.prototype);
const tagGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)!.get!;
const bufferGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer')!.get!;
const offsetGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteOffset')!.get!;
const lengthGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength')!.get!;
const bufferLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const resizableGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const detachedGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'detached')?.get;
const setElements = typedArrayPrototype.set;
const weakHas = WeakMap.prototype.has;
const weakSet = WeakMap.prototype.set;

/** Refuses a descriptor that is not an object. */
export function requireGeometryDescriptor(input: unknown, subject: GeometrySubject2D): asserts input is object {
  if (typeof input !== 'object' || input === null) throw new TypeFault(`${subject} descriptor must be an object`);
}
/** Reads one descriptor field once; a throwing getter becomes a refusal carrying its cause. */
export function readGeometryField(source: object, key: string, subject: GeometrySubject2D): unknown {
  try {
    return (source as Record<string, unknown>)[key];
  } catch (cause) {
    throw new TypeFault(`${subject} descriptor read failed`, { cause });
  }
}
/** The intrinsic brand of a float field; any other value is refused. */
export function floatBrand(value: unknown, subject: GeometrySubject2D): FloatTag {
  const tag: unknown = apply(tagGetter, value, []);
  if (tag !== 'Float32Array' && tag !== 'Float64Array') throw new TypeFault(`${subject} array brand is unsupported`);
  return tag;
}
/** The intrinsic brand of an index field; any other value is refused. */
export function indexBrand(value: unknown, subject: GeometrySubject2D): IndexTag {
  const tag: unknown = apply(tagGetter, value, []);
  if (tag !== 'Uint16Array' && tag !== 'Uint32Array') throw new TypeFault(`${subject} array brand is unsupported`);
  return tag;
}
/** The element count of a branded field, read through intrinsic getters; unsupported backings are refused. */
export function elementLength(value: unknown, tag: GeometryPayloadTag2D, subject: GeometrySubject2D): number {
  const backing = apply(bufferGetter, value, []) as ArrayBuffer;
  // This captured getter rejects SharedArrayBuffer, including cross realm.
  // Native intrinsic faults escape intact rather than becoming policy errors.
  apply(bufferLengthGetter, backing, []);
  if (resizableGetter && apply(resizableGetter, backing, [])) throw new TypeFault(`${subject} backing is unsupported`);
  if (detachedGetter) {
    if (apply(detachedGetter, backing, [])) throw new TypeFault(`${subject} backing is unsupported`);
  } else {
    // Reuse the established zero-length attachment check for older realms.
    new Bytes(backing, 0, 0);
  }
  apply(offsetGetter, value, []);
  const byteLength: number = apply(lengthGetter, value, []);
  const elementBytes = tag === 'Float64Array' ? 8 : tag === 'Uint16Array' ? 2 : 4;
  return byteLength / elementBytes;
}
/** Whether the counts describe an empty mesh or a list of whole triangles. */
export function triangleListShape(vertexCount: number, indexCount: number): boolean {
  return (
    safeInteger(vertexCount) &&
    safeInteger(indexCount) &&
    ((vertexCount === 0 && indexCount === 0) || (vertexCount >= 3 && indexCount >= 3 && indexCount % 3 === 0))
  );
}
/** Refuses counts or accounting beyond what one geometry may hold. */
export function requireGeometryCapacity(
  vertexCount: number,
  indexCount: number,
  logicalByteLength: number,
  subject: GeometrySubject2D
): void {
  if (vertexCount > 65536 || indexCount > 196608 || !safeInteger(logicalByteLength) || logicalByteLength > 4980736) {
    throw new RangeFault(`${subject} capacity exceeded`);
  }
}
/** A private native copy of a branded field. */
export function copyPayload(source: unknown, tag: GeometryPayloadTag2D, length: number): GeometryPayload2D {
  const copy =
    tag === 'Float32Array'
      ? new Floats32(length)
      : tag === 'Float64Array'
        ? new Floats64(length)
        : tag === 'Uint16Array'
          ? new Indices16(length)
          : new Indices32(length);
  // Native allocation/copy failures escape. TypedArray set reads only the
  // intrinsic used range and cannot invoke the caller's iterator or species.
  apply(setElements, copy, [source]);
  return copy;
}
/** Checks every component of a copy and returns them as a frozen array of own elements. */
export function canonicalComponents(
  source: GeometryPayload2D,
  length: number,
  kind: GeometryComponentKind2D,
  vertexCount: number,
  precision: GeometryPrecision2D,
  subject: GeometrySubject2D
): readonly number[] {
  // Fill private own indices without inherited setters, then expose a normal frozen array.
  const output: number[] = [];
  setPrototypeOf(output, null);
  for (let index = 0; index < length; index++) {
    const value = source[index]!;
    if (
      !finite(value) ||
      (kind === 'unit' && (value < 0 || value > 1)) ||
      (kind === 'index' && (!integer(value) || value < 0 || value >= vertexCount))
    ) {
      throw new RangeFault(`${subject} numeric range is invalid`);
    }
    // Single-precision payloads are f32-roundtrip Numbers. This is a declared
    // canonical input representation, not a GPU interpolation error bound.
    const rounded = precision === 'single' && kind !== 'index' ? fround(value) : value;
    if (!finite(rounded) || (kind === 'uv' && abs(rounded) > 1048576)) {
      throw new RangeFault(`${subject} numeric range is invalid`);
    }
    // Equality with zero converts both signed zeros to positive zero.
    output[index] = rounded === 0 ? 0 : rounded;
  }
  setPrototypeOf(output, arrayPrototype);
  return freeze(output);
}

/** The set of geometries one factory made, held by identity alone. */
export interface GeometryRegistry2D {
  /** Records a completed, frozen geometry. */
  readonly own: (geometry: object) => void;
  /** Whether a value was recorded, without reading any of its properties. */
  readonly has: (value: unknown) => boolean;
}
/** A new, empty registry; each geometry kind keeps its own. */
export function createGeometryRegistry2D(): GeometryRegistry2D {
  const owned = new Registry<object, true>();
  return freeze({
    own(geometry: object): void {
      apply(weakSet, owned, [geometry, true]);
    },
    has(value: unknown): boolean {
      // WeakMap identity performs no property read, even on revoked Proxies.
      return typeof value === 'object' && value !== null && apply(weakHas, owned, [value]);
    }
  });
}
