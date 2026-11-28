// First-party Apache-2.0 implementation. Native admission follows the existing
// first-party ImageData2D pattern; shared-profile geometry policy is independently authored.
import {
  canonicalComponents,
  copyPayload,
  createGeometryRegistry2D,
  elementLength,
  floatBrand,
  indexBrand,
  readGeometryField,
  requireGeometryCapacity,
  requireGeometryDescriptor,
  triangleListShape
} from './geometryAdmission2D.js';

declare const sharedGeometry2DBrand: unique symbol;

/** A float array of a shared geometry, in single or double precision. */
export type SharedFloatArray2D = Float32Array<ArrayBuffer> | Float64Array<ArrayBuffer>;
/** An index array of a shared geometry, in 16 or 32 bits. */
export type SharedIndexArray2D = Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
/** The positions, texture coordinates, light and dark colors and triangle indices of a mesh to share with a renderer. */
export interface SharedGeometryInput2D {
  readonly positions: SharedFloatArray2D;
  readonly uvs: SharedFloatArray2D;
  readonly lightColors: SharedFloatArray2D;
  readonly darkColors: SharedFloatArray2D;
  readonly indices: SharedIndexArray2D;
}
/** Immutable CPU geometry identity; the brand grants no asset or GPU authority. */
export interface SharedGeometry2D {
  readonly [sharedGeometry2DBrand]: true;
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly triangleCount: number;
  readonly logicalByteLength: number;
  readonly positions: readonly number[];
  readonly uvs: readonly number[];
  readonly lightColors: readonly number[];
  readonly darkColors: readonly number[];
  readonly indices: readonly number[];
}

const freeze = Object.freeze;
const RangeFault = RangeError;
const owned = createGeometryRegistry2D();
const subject = 'Shared geometry';

/** Copies and checks a mesh into a shared geometry that renderers can draw; malformed arrays are refused. */
export function createSharedGeometry2D(input: SharedGeometryInput2D): SharedGeometry2D {
  requireGeometryDescriptor(input, subject);
  // G1: finish all successful ordered reads before examining any field.
  // Local staging makes descriptor reentry independent of this invocation.
  const positionsInput = readGeometryField(input, 'positions', subject);
  const uvsInput = readGeometryField(input, 'uvs', subject);
  const lightColorsInput = readGeometryField(input, 'lightColors', subject);
  const darkColorsInput = readGeometryField(input, 'darkColors', subject);
  const indicesInput = readGeometryField(input, 'indices', subject);
  // G2 must finish for every field before G3 touches the first backing.
  const positionsTag = floatBrand(positionsInput, subject);
  const uvsTag = floatBrand(uvsInput, subject);
  const lightColorsTag = floatBrand(lightColorsInput, subject);
  const darkColorsTag = floatBrand(darkColorsInput, subject);
  const indicesTag = indexBrand(indicesInput, subject);
  const positionsLength = elementLength(positionsInput, positionsTag, subject);
  const uvsLength = elementLength(uvsInput, uvsTag, subject);
  const lightColorsLength = elementLength(lightColorsInput, lightColorsTag, subject);
  const darkColorsLength = elementLength(darkColorsInput, darkColorsTag, subject);
  const indicesLength = elementLength(indicesInput, indicesTag, subject);
  const vertexCount = positionsLength / 2;
  const indexCount = indicesLength;
  // G4: shape outranks capacity; both precede copies and canonical arrays.
  if (
    !triangleListShape(vertexCount, indexCount) ||
    uvsLength !== positionsLength ||
    lightColorsLength !== 4 * vertexCount ||
    darkColorsLength !== 3 * vertexCount
  ) {
    throw new RangeFault('Shared geometry array shape is invalid');
  }
  const logicalByteLength = 88 * vertexCount + 4 * indexCount;
  requireGeometryCapacity(vertexCount, indexCount, logicalByteLength, subject);
  // G5 capacity above precedes all allocations below. G6 completes all five
  // native copies before G7 examines any copied component.
  const positionsCopy = copyPayload(positionsInput, positionsTag, positionsLength);
  const uvsCopy = copyPayload(uvsInput, uvsTag, uvsLength);
  const lightColorsCopy = copyPayload(lightColorsInput, lightColorsTag, lightColorsLength);
  const darkColorsCopy = copyPayload(darkColorsInput, darkColorsTag, darkColorsLength);
  const indicesCopy = copyPayload(indicesInput, indicesTag, indicesLength);
  // New floating payloads are f32-roundtrip Numbers.
  const positions = canonicalComponents(positionsCopy, positionsLength, 'position', vertexCount, 'single', subject);
  const uvs = canonicalComponents(uvsCopy, uvsLength, 'uv', vertexCount, 'single', subject);
  const lightColors = canonicalComponents(lightColorsCopy, lightColorsLength, 'unit', vertexCount, 'single', subject);
  const darkColors = canonicalComponents(darkColorsCopy, darkColorsLength, 'unit', vertexCount, 'single', subject);
  const indices = canonicalComponents(indicesCopy, indicesLength, 'index', vertexCount, 'single', subject);
  // Logical accounting describes canonical payload units, not physical heap
  // usage or an allocation guarantee. Only the completed frozen value is owned.
  const geometry = freeze({
    vertexCount,
    indexCount,
    triangleCount: indexCount / 3,
    logicalByteLength,
    positions,
    uvs,
    lightColors,
    darkColors,
    indices
  }) as SharedGeometry2D;
  owned.own(geometry);
  return geometry;
}

export function isSharedGeometry2D(value: unknown): value is SharedGeometry2D {
  return owned.has(value);
}
