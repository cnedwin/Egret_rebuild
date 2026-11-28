// First-party Apache-2.0 implementation. Native admission follows the existing
// first-party ImageData2D pattern; geometry policy is independently authored.
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

declare const texturedGeometry2DBrand: unique symbol;

/** A float array of a textured geometry, in single or double precision. */
export type TexturedFloatArray2D = Float32Array<ArrayBuffer> | Float64Array<ArrayBuffer>;
/** An index array of a textured geometry, in 16 or 32 bits. */
export type TexturedIndexArray2D = Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
/** The positions, texture coordinates and triangle indices of a textured mesh to copy. */
export interface TexturedGeometry2DInput {
  readonly positions: TexturedFloatArray2D;
  readonly uvs: TexturedFloatArray2D;
  readonly lightColors: TexturedFloatArray2D;
  readonly indices: TexturedIndexArray2D;
}
/** Immutable CPU geometry identity; the brand grants no asset or GPU authority. */
export interface TexturedGeometry2D {
  readonly [texturedGeometry2DBrand]: true;
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly triangleCount: number;
  readonly logicalByteLength: number;
  readonly positions: readonly number[];
  readonly uvs: readonly number[];
  readonly lightColors: readonly number[];
  readonly indices: readonly number[];
}

const freeze = Object.freeze;
const RangeFault = RangeError;
const owned = createGeometryRegistry2D();
const subject = 'Textured geometry';

/** Copies and checks a textured mesh; malformed arrays are refused with a TypeError. */
export function createTexturedGeometry2D(input: TexturedGeometry2DInput): TexturedGeometry2D {
  requireGeometryDescriptor(input, subject);
  // G1: finish all successful ordered reads before examining any field.
  // Local staging makes descriptor reentry independent of this invocation.
  const positionsInput = readGeometryField(input, 'positions', subject);
  const uvsInput = readGeometryField(input, 'uvs', subject);
  const lightColorsInput = readGeometryField(input, 'lightColors', subject);
  const indicesInput = readGeometryField(input, 'indices', subject);
  // G2 must finish for every field before G3 touches the first backing.
  const positionsTag = floatBrand(positionsInput, subject);
  const uvsTag = floatBrand(uvsInput, subject);
  const lightColorsTag = floatBrand(lightColorsInput, subject);
  const indicesTag = indexBrand(indicesInput, subject);
  const positionsLength = elementLength(positionsInput, positionsTag, subject);
  const uvsLength = elementLength(uvsInput, uvsTag, subject);
  const lightColorsLength = elementLength(lightColorsInput, lightColorsTag, subject);
  const indicesLength = elementLength(indicesInput, indicesTag, subject);
  const vertexCount = positionsLength / 2;
  const indexCount = indicesLength;
  // G4: shape outranks capacity; both precede copies and canonical arrays.
  if (
    !triangleListShape(vertexCount, indexCount) ||
    uvsLength !== positionsLength ||
    lightColorsLength !== 4 * vertexCount
  ) {
    throw new RangeFault('Textured geometry array shape is invalid');
  }
  const logicalByteLength = 64 * vertexCount + 4 * indexCount;
  requireGeometryCapacity(vertexCount, indexCount, logicalByteLength, subject);
  // G5 completes every native copy before G6 examines any copied component.
  const positionsCopy = copyPayload(positionsInput, positionsTag, positionsLength);
  const uvsCopy = copyPayload(uvsInput, uvsTag, uvsLength);
  const lightColorsCopy = copyPayload(lightColorsInput, lightColorsTag, lightColorsLength);
  const indicesCopy = copyPayload(indicesInput, indicesTag, indicesLength);
  // Components keep the values given; texture coordinates lie within 0 to 1.
  const positions = canonicalComponents(positionsCopy, positionsLength, 'position', vertexCount, 'exact', subject);
  const uvs = canonicalComponents(uvsCopy, uvsLength, 'unit', vertexCount, 'exact', subject);
  const lightColors = canonicalComponents(lightColorsCopy, lightColorsLength, 'unit', vertexCount, 'exact', subject);
  const indices = canonicalComponents(indicesCopy, indicesLength, 'index', vertexCount, 'exact', subject);
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
    indices
  }) as TexturedGeometry2D;
  owned.own(geometry);
  return geometry;
}

/** Whether a value is a geometry made by `createTexturedGeometry2D`, without reading any of its properties. */
export function isTexturedGeometry2D(value: unknown): value is TexturedGeometry2D {
  return owned.has(value);
}
