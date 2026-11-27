// SPDX-License-Identifier: Apache-2.0
export const Endian: Readonly<{ BIG_ENDIAN: 'bigEndian'; LITTLE_ENDIAN: 'littleEndian' }>;
export class ByteArray {
  constructor(buffer?: ArrayBuffer | Uint8Array, bufferExtSize?: number);
  endian: 'bigEndian' | 'littleEndian';
  position: number;
  length: number;
  readonly readAvailable: number;
  readonly bytesAvailable: number;
  buffer: ArrayBuffer;
  readonly rawBuffer: ArrayBuffer;
  readonly bytes: Uint8Array;
  readonly bufferOffset: number;
  setArrayBuffer(buffer: ArrayBuffer): void;
  clear(): void;
  readBoolean(): boolean;
  readByte(): number;
  readUnsignedByte(): number;
  readShort(): number;
  readUnsignedShort(): number;
  readInt(): number;
  readUnsignedInt(): number;
  readFloat(): number;
  readDouble(): number;
  readUTF(): string;
  readUTFBytes(length: number): string;
  readBytes(target: ByteArray, offset?: number, length?: number): void;
  writeBoolean(value: boolean): void;
  writeByte(value: number): void;
  writeShort(value: number): void;
  writeUnsignedShort(value: number): void;
  writeInt(value: number): void;
  writeUnsignedInt(value: number): void;
  writeFloat(value: number): void;
  writeDouble(value: number): void;
  writeUTF(value: string): void;
  writeUTFBytes(value: string): void;
  writeBytes(source: ByteArray, offset?: number, length?: number): void;
}
