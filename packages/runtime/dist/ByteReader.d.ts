import type { Disposable } from "@egret/contracts";
export type ByteOrder = "bigEndian" | "littleEndian";
export declare const BYTE_READER_LIMITS: Readonly<{
    readonly maxBytes: 16777216;
}>;
/** Read-only owned binary snapshot. Explicit Scope.use() can own its lifetime. */
export declare class ByteReader implements Disposable {
    private readonly byteReaderBrand;
    constructor(source: Uint8Array<ArrayBuffer>, endian?: ByteOrder);
    get length(): number;
    get position(): number;
    get bytesAvailable(): number;
    get disposed(): boolean;
    get endian(): ByteOrder;
    set endian(value: ByteOrder);
    seek(position: number): void;
    skip(count: number): void;
    readByte(): number;
    readUnsignedByte(): number;
    readShort(): number;
    readUnsignedShort(): number;
    readInt(): number;
    readUnsignedInt(): number;
    readFloat(): number;
    readDouble(): number;
    readBytes(count?: number): Uint8Array<ArrayBuffer>;
    /** Terminal release drops both storage references without claiming zeroization. */
    dispose(): void;
}
//# sourceMappingURL=ByteReader.d.ts.map