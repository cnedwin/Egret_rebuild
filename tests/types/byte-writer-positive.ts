import { ByteWriter, BYTE_WRITER_LIMITS } from "@egret/engine";
import { ByteWriter as RuntimeByteWriter, BYTE_WRITER_LIMITS as RUNTIME_BYTE_WRITER_LIMITS } from "@egret/runtime";
import type { ByteOrder, Disposable, Scope } from "@egret/engine";
import type { ByteOrder as RuntimeByteOrder, Scope as RuntimeScope } from "@egret/runtime";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ?
  (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type Assert<T extends true> = T;
type Orders = Assert<Equal<ByteOrder, "bigEndian" | "littleEndian">>;
type OriginalOrder = Assert<Equal<ByteOrder, RuntimeByteOrder>>;
type OriginalWriter = Assert<Equal<ByteWriter, RuntimeByteWriter>>;
type OriginalConstructor = Assert<Equal<typeof ByteWriter, typeof RuntimeByteWriter>>;
type Constructor = Assert<Equal<ConstructorParameters<typeof ByteWriter>, [capacity: number, endian?: ByteOrder | undefined]>>;
type Diagnostics = Assert<Equal<Pick<ByteWriter, "capacity" | "length" | "remainingCapacity" | "disposed">,
  { readonly capacity: number; readonly length: number; readonly remainingCapacity: number; readonly disposed: boolean }>>;
type Endian = Assert<Equal<ByteWriter["endian"], ByteOrder>>;
type Byte = Assert<Equal<ByteWriter["writeByte"], (value: number) => void>>;
type UnsignedByte = Assert<Equal<ByteWriter["writeUnsignedByte"], (value: number) => void>>;
type Short = Assert<Equal<ByteWriter["writeShort"], (value: number) => void>>;
type UnsignedShort = Assert<Equal<ByteWriter["writeUnsignedShort"], (value: number) => void>>;
type Int = Assert<Equal<ByteWriter["writeInt"], (value: number) => void>>;
type UnsignedInt = Assert<Equal<ByteWriter["writeUnsignedInt"], (value: number) => void>>;
type Float = Assert<Equal<ByteWriter["writeFloat"], (value: number) => void>>;
type Double = Assert<Equal<ByteWriter["writeDouble"], (value: number) => void>>;
type Bulk = Assert<Equal<ByteWriter["writeBytes"], (source: Uint8Array<ArrayBuffer>) => void>>;
type Snapshot = Assert<Equal<ByteWriter["toUint8Array"], () => Uint8Array<ArrayBuffer>>>;
type Dispose = Assert<Equal<ByteWriter["dispose"], () => void>>;
type Limit = Assert<Equal<typeof BYTE_WRITER_LIMITS, Readonly<{ maxBytes: 16777216 }>>>;
type OriginalLimitsType = Assert<Equal<typeof BYTE_WRITER_LIMITS, typeof RUNTIME_BYTE_WRITER_LIMITS>>;
type OriginalScope = Assert<Equal<Scope, RuntimeScope>>;

const writer = new ByteWriter(64);
const little = new ByteWriter(64, "littleEndian");
const explicitUndefined = new ByteWriter(0, undefined);
const runtimeWriter: ByteWriter = new RuntimeByteWriter(64, "bigEndian");
const runtimeConstructor: typeof ByteWriter = RuntimeByteWriter;
const engineConstructor: typeof RuntimeByteWriter = ByteWriter;
const limits: Readonly<{ maxBytes: 16777216 }> = BYTE_WRITER_LIMITS;
const runtimeLimits: typeof BYTE_WRITER_LIMITS = RUNTIME_BYTE_WRITER_LIMITS;
const capacity: number = writer.capacity;
const length: number = writer.length;
const remaining: number = writer.remainingCapacity;
const disposed: boolean = writer.disposed;
const order: RuntimeByteOrder = writer.endian;
writer.endian = "littleEndian";
writer.endian = "bigEndian";
const writes: void[] = [writer.writeByte(-2), writer.writeUnsignedByte(171), writer.writeShort(-257),
  writer.writeUnsignedShort(4660), writer.writeInt(-2147483647), writer.writeUnsignedInt(2309737967),
  writer.writeFloat(1.5), writer.writeDouble(-2.5)];
const source: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(8));
const bulkReturn: void = writer.writeBytes(source);
const snapshot: Uint8Array<ArrayBuffer> = writer.toUint8Array();
const disposable: Disposable = writer;
declare const scope: Scope;
const same = scope.use(writer);
type ScopedWriter = Assert<Equal<typeof same, ByteWriter>>;
const disposeReturn: void = writer.dispose();
void little; void explicitUndefined; void runtimeWriter; void runtimeConstructor; void engineConstructor;
void limits; void runtimeLimits; void capacity; void length; void remaining; void disposed; void order;
void writes; void bulkReturn; void snapshot; void disposable; void same; void disposeReturn;
export type { Orders, OriginalOrder, OriginalWriter, OriginalConstructor, Constructor, Diagnostics,
  Endian, Byte, UnsignedByte, Short, UnsignedShort, Int, UnsignedInt, Float, Double, Bulk, Snapshot,
  Dispose, Limit, OriginalLimitsType, OriginalScope, ScopedWriter };
