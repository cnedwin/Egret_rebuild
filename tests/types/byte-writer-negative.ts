import { ByteWriter, BYTE_WRITER_LIMITS } from "@egret/engine";
import type { ByteOrder } from "@egret/engine";
import type { ByteOrder as RuntimeByteOrder } from "@egret/runtime";
declare const writer: ByteWriter;
declare const source: Uint8Array<ArrayBuffer>;
declare const shared: Uint8Array<SharedArrayBuffer>;
declare const structural: Pick<ByteWriter, keyof ByteWriter>;

// BYTE_WRITER_CASE required-capacity
new ByteWriter();
// BYTE_WRITER_CASE numeric-capacity
new ByteWriter("4");
// BYTE_WRITER_CASE unboxed-capacity
new ByteWriter(new Number(4));
// BYTE_WRITER_CASE constructor-endian-literal
new ByteWriter(4, "middleEndian");
// BYTE_WRITER_CASE no-endian-options
new ByteWriter(4, { endian: "bigEndian" });
// BYTE_WRITER_CASE constructor-exact-arity
new ByteWriter(4, "bigEndian", 0);
// BYTE_WRITER_CASE readonly-capacity
writer.capacity = 16;
// BYTE_WRITER_CASE readonly-length
writer.length = 1;
// BYTE_WRITER_CASE readonly-remaining
writer.remainingCapacity = 1;
// BYTE_WRITER_CASE readonly-disposed
writer.disposed = true;
// BYTE_WRITER_CASE readonly-limit
BYTE_WRITER_LIMITS.maxBytes = 16777216;
// BYTE_WRITER_CASE setter-endian-literal
writer.endian = "middleEndian";
// BYTE_WRITER_CASE setter-undefined-not-constructor-default
writer.endian = undefined;
// BYTE_WRITER_CASE numeric-byte
writer.writeByte("1");
// BYTE_WRITER_CASE numeric-unsigned-byte
writer.writeUnsignedByte("1");
// BYTE_WRITER_CASE numeric-short
writer.writeShort("1");
// BYTE_WRITER_CASE numeric-unsigned-short
writer.writeUnsignedShort("1");
// BYTE_WRITER_CASE numeric-int
writer.writeInt("1");
// BYTE_WRITER_CASE numeric-unsigned-int
writer.writeUnsignedInt("1");
// BYTE_WRITER_CASE numeric-float
writer.writeFloat("1");
// BYTE_WRITER_CASE numeric-double
writer.writeDouble("1");
// BYTE_WRITER_CASE unboxed-scalar
writer.writeInt(new Number(1));
// BYTE_WRITER_CASE scalar-required-value
writer.writeByte();
// BYTE_WRITER_CASE scalar-exact-arity
writer.writeDouble(1, 2);
// BYTE_WRITER_CASE bulk-byte-view-only
writer.writeBytes(new DataView(new ArrayBuffer(4)));
// BYTE_WRITER_CASE bulk-shared-backing
writer.writeBytes(shared);
// BYTE_WRITER_CASE bulk-required-source
writer.writeBytes();
// BYTE_WRITER_CASE bulk-exact-arity
writer.writeBytes(source, 0);
// BYTE_WRITER_CASE snapshot-no-arguments
writer.toUint8Array(0);
// BYTE_WRITER_CASE no-grow
writer.grow(16);
// BYTE_WRITER_CASE no-reset
writer.reset();
// BYTE_WRITER_CASE no-seek
writer.seek(0);
// BYTE_WRITER_CASE no-resize
writer.resize(16);
// BYTE_WRITER_CASE scalar-void-not-promise
const asynchronousAppend: Promise<void> = writer.writeUnsignedByte(1);
// BYTE_WRITER_CASE bulk-void-not-snapshot
const bulkSnapshot: Uint8Array<ArrayBuffer> = writer.writeBytes(source);
// BYTE_WRITER_CASE dispose-void-not-promise
const asynchronousDispose: Promise<void> = writer.dispose();
// BYTE_WRITER_CASE snapshot-ordinary-backing
const sharedSnapshot: Uint8Array<SharedArrayBuffer> = writer.toUint8Array();
// BYTE_WRITER_CASE nominal-writer-not-public-shape
const counterfeit: ByteWriter = structural;
// BYTE_WRITER_CASE byte-order-domain
const invalidOrder: ByteOrder = "network";
// BYTE_WRITER_CASE engine-byte-order-erased
void ByteOrder;
// BYTE_WRITER_CASE runtime-byte-order-erased
void RuntimeByteOrder;
void asynchronousAppend; void bulkSnapshot; void asynchronousDispose;
void sharedSnapshot; void counterfeit; void invalidOrder;
