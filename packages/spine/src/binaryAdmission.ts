// SPDX-License-Identifier: Apache-2.0
// First-party admission only. Official Core continues to own the binary format's semantics.
import * as Core from '@esotericsoftware/spine-core';
import { spineFault } from './catalog.js';

/** Counts and string lengths beyond what is left of the file, by more than this, cannot be real. */
const SLACK = 65536;
/** Numbers of storage Core may make for each byte of the file: far more than a real export needs. */
const ELEMENTS_PER_BYTE = 16;

/**
 * Reads a binary skeleton with Core's reader, refusing before it allocates any count that the bytes left could not hold.
 * Every count, index and string length of the format is a positive variable-length integer; while Core reads, each one is
 * checked against what remains of the file, and the numeric storage Core makes is charged against a budget the size of the
 * file sets. The read is synchronous, so the checks are in place for this read alone.
 */
export function readSpineBinary(loader: Core.AttachmentLoader, bytes: Uint8Array, id: string): Core.SkeletonData {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 9 || bytes.byteLength > 4194304) throw spineFault('BINARY_LIMIT', id);
  // Core reads the whole buffer behind the array, from its start: give it a buffer of these bytes alone.
  const own = bytes.slice().buffer;
  const input = Core.BinaryInput.prototype, readInt = input.readInt, utils = Core.Utils, newFloatArray = utils.newFloatArray, newShortArray = utils.newShortArray;
  input.readInt = function (this: Core.BinaryInput, optimizePositive: boolean): number {
    const value = readInt.call(this, optimizePositive);
    if (optimizePositive && (value < 0 || value > own.byteLength - (this as unknown as { index: number }).index + SLACK)) throw spineFault('BINARY_LIMIT', id);
    return value;
  };
  // The numeric storage Core makes for timelines and vertices, all together, within a multiple of the file: a real export
  // fills what it asks for from its own bytes, and a count it cannot fill is refused before the storage is made.
  let budget = own.byteLength * ELEMENTS_PER_BYTE + SLACK;
  const charge = (size: number): void => { if (!Number.isSafeInteger(size) || size < 0 || (budget -= size) < 0) throw spineFault('BINARY_LIMIT', id); };
  utils.newFloatArray = (size: number) => { charge(size); return newFloatArray.call(utils, size); };
  utils.newShortArray = (size: number) => { charge(size); return newShortArray.call(utils, size); };
  try { return new Core.SkeletonBinary(loader).readSkeletonData(own); }
  catch (cause) { throw cause instanceof Error && 'code' in cause ? cause : spineFault('BINARY', id, cause); }
  finally { input.readInt = readInt; utils.newFloatArray = newFloatArray; utils.newShortArray = newShortArray; }
}
