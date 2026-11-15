import type { Disposable } from "@egret/contracts";
import type { ByteOrder } from "./ByteReader.js";
export declare const BYTE_WRITER_LIMITS: Readonly<{
    readonly maxBytes: 16777216;
}>;
/** Fixed-capacity owned binary appends. Scope.use() can own the writer's lifetime. */
export declare class ByteWriter implements Disposable {
    private readonly byteWriterBrand;
    constructor(capacity: number, endian?: ByteOrder);
    get capacity(): number;
    get length(): number;
    get remainingCapacity(): number;
    get disposed(): boolean;
    get endian(): ByteOrder;
    set endian(value: ByteOrder);
    writeByte(value: number): void;
    writeUnsignedByte(value: number): void;
    writeShort(value: number): void;
    writeUnsignedShort(value: number): void;
    writeInt(value: number): void;
    writeUnsignedInt(value: number): void;
    writeFloat(value: number): void;
    writeDouble(value: number): void;
    writeBytes(source: Uint8Array<ArrayBuffer>): void;
    toUint8Array(): Uint8Array<ArrayBuffer>;
    /** Terminal release drops storage references; prior snapshots stay independent. */
    dispose(): void;
}
//# sourceMappingURL=ByteWriter.d.ts.map