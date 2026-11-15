import * as Core from '@esotericsoftware/spine-core';
/**
 * Reads a binary skeleton with Core's reader, refusing before it allocates any count that the bytes left could not hold.
 * Every count, index and string length of the format is a positive variable-length integer; while Core reads, each one is
 * checked against what remains of the file, and the numeric storage Core makes is charged against a budget the size of the
 * file sets. The read is synchronous, so the checks are in place for this read alone.
 */
export declare function readSpineBinary(loader: Core.AttachmentLoader, bytes: Uint8Array, id: string): Core.SkeletonData;
//# sourceMappingURL=binaryAdmission.d.ts.map