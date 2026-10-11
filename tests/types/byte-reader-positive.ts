import { ByteReader, BYTE_READER_LIMITS } from "@egret/engine";
import type { ByteOrder, Disposable, Scope } from "@egret/engine";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ?
  (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type Assert<T extends true> = T;
type Orders = Assert<Equal<ByteOrder, "bigEndian" | "littleEndian">>;
type Constructor = Assert<Equal<ConstructorParameters<typeof ByteReader>, [source: Uint8Array<ArrayBuffer>, endian?: ByteOrder | undefined]>>;
type Copy = Assert<Equal<ReturnType<ByteReader["readBytes"]>, Uint8Array<ArrayBuffer>>>;
type Seek = Assert<Equal<ByteReader["seek"], (position: number) => void>>;
type Skip = Assert<Equal<ByteReader["skip"], (count: number) => void>>;
type Endian = Assert<Equal<ByteReader["endian"], ByteOrder>>;
type Limit = Assert<Equal<typeof BYTE_READER_LIMITS.maxBytes, 16777216>>;
const source: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(8));
const reader = new ByteReader(source);
const little = new ByteReader(source, "littleEndian");
const absent = new ByteReader(source, undefined);
const disposable: Disposable = reader;
declare const scope: Scope;
const same: ByteReader = scope.use(reader);
const length: number = reader.length;
const position: number = reader.position;
const available: number = reader.bytesAvailable;
const disposed: boolean = reader.disposed;
reader.endian = "littleEndian";
reader.seek(0); reader.skip(0);
const numbers: number[] = [reader.readByte(), reader.readUnsignedByte(), reader.readShort(), reader.readUnsignedShort(), reader.readInt(), reader.readUnsignedInt(), reader.readFloat(), reader.readDouble()];
const all: Uint8Array<ArrayBuffer> = reader.readBytes();
const explicit: Uint8Array<ArrayBuffer> = reader.readBytes(0);
const undef: Uint8Array<ArrayBuffer> = reader.readBytes(undefined);
const disposedReturn: void = reader.dispose();
void little; void absent; void disposable; void same; void length; void position;
void available; void disposed; void numbers; void all; void explicit; void undef; void disposedReturn;
export type { Orders, Constructor, Copy, Seek, Skip, Endian, Limit };
