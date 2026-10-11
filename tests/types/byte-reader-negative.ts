import { ByteReader, BYTE_READER_LIMITS } from "@egret/engine";
import type { ByteOrder } from "@egret/engine";
declare const reader: ByteReader;
declare const source: Uint8Array<ArrayBuffer>;
declare const shared: Uint8Array<SharedArrayBuffer>;
// BYTE_READER_CASE required-source TS2554
new ByteReader();
// BYTE_READER_CASE byte-view-only TS2740
new ByteReader(new DataView(new ArrayBuffer(8)));
// BYTE_READER_CASE shared-backing TS2345
new ByteReader(shared);
// BYTE_READER_CASE no-endian-options TS2345
new ByteReader(source, { endian: "bigEndian" });
// BYTE_READER_CASE constructor-endian-literal TS2345
new ByteReader(source, "middleEndian");
// BYTE_READER_CASE readonly-length TS2540
reader.length = 8;
// BYTE_READER_CASE readonly-position TS2540
reader.position = 1;
// BYTE_READER_CASE readonly-available TS2540
reader.bytesAvailable = 8;
// BYTE_READER_CASE readonly-disposed TS2540
reader.disposed = true;
// BYTE_READER_CASE readonly-limit TS2540
BYTE_READER_LIMITS.maxBytes = 1;
// BYTE_READER_CASE setter-endian-literal TS2322
reader.endian = "middleEndian";
// BYTE_READER_CASE numeric-seek TS2345
reader.seek("1");
// BYTE_READER_CASE numeric-skip TS2345
reader.skip("1");
// BYTE_READER_CASE numeric-copy-count TS2345
reader.readBytes("1");
// BYTE_READER_CASE scalar-read-no-arguments TS2554
reader.readInt(1);
// BYTE_READER_CASE closed-void-return TS2322
const asynchronousDispose: Promise<void> = reader.dispose();
// BYTE_READER_CASE byte-order-domain TS2322
const invalidOrder: ByteOrder = "network";
// BYTE_READER_CASE byte-order-not-runtime-value TS2693
void ByteOrder;
void asynchronousDispose; void invalidOrder;
