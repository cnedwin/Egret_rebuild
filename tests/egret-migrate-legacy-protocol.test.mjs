// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { ByteArray, Endian } from '../tools/egret-migrate/compat/protocol.mjs';

test('an original packet subclass writes and reads the same ordered packet in both byte orders', () => {
  class Packet extends ByteArray {
    writePayload() {
      this.writeUnsignedShort(0); // Reserve the prefix until the variable-length payload is complete.
      this.writeByte(0xe7);
      this.writeUTF('桥😀');
      this.writeBoolean(true);
      const end = this.position;
      this.position = 0;
      this.writeUnsignedShort(end - 2);
      this.position = end;
    }
  }
  for (const order of [Endian.BIG_ENDIAN, Endian.LITTLE_ENDIAN]) {
    const packet = new Packet();
    packet.endian = order;
    packet.writePayload();
    const prefix = order === Endian.BIG_ENDIAN ? [0, 11] : [11, 0];
    const len = order === Endian.BIG_ENDIAN ? [0, 7] : [7, 0];
    const wire = [...prefix, 0xe7, ...len, 0xe6, 0xa1, 0xa5, 0xf0, 0x9f, 0x98, 0x80, 1];
    assert.deepEqual([...new Uint8Array(packet.buffer)], wire);
    packet.position = 0;
    assert.equal(packet.readUnsignedShort(), 11);
    assert.equal(packet.readByte(), -25);
    assert.equal(packet.readUTF(), '桥😀');
    assert.equal(packet.readBoolean(), true);
    assert.equal(packet.readAvailable, 0);
    assert.throws(() => packet.readInt(), RangeError);
    assert.equal(packet.position, packet.length);
  }
});

test('readBytes preserves the target cursor, accepts slices, and handles overlapping self copies', () => {
  const raw = Uint8Array.of(40, 10, 20, 30, 50);
  const input = new ByteArray(raw.subarray(1, 4));
  raw.fill(0);
  const output = new ByteArray(undefined, 4);
  output.writeByte(77);
  input.readBytes(output, 2, 2);
  assert.equal(input.position, 2);
  assert.equal(output.position, 1);
  assert.equal(output.readAvailable, 3);
  assert.deepEqual([...new Uint8Array(output.buffer)], [77, 0, 10, 20]);
  output.position = 2;
  output.writeBytes(output, 0, 3);
  assert.deepEqual([...new Uint8Array(output.buffer)], [77, 0, 77, 0, 10]);
  output.clear();
  assert.equal(output.length, 0);
  assert.equal(output.bytesAvailable, 4);
});

test('scalar ranges, offsets and UTF decoding retain wire behavior and bound failed reads', () => {
  const b = new ByteArray();
  b.writeInt(-12345678);
  b.writeUnsignedInt(0xfedcba98);
  b.writeShort(-1234);
  b.writeFloat(0.75);
  b.writeDouble(-0.1);
  b.writeUTFBytes('a\u0000b');
  b.position = 0;
  assert.deepEqual(
    [b.readInt(), b.readUnsignedInt(), b.readShort(), b.readFloat(), b.readDouble()],
    [-12345678, 0xfedcba98, -1234, 0.75, -0.1]
  );
  assert.equal(b.readUTFBytes(3), 'ab'); // Classic decoding omits NUL inside a string.
  const truncated = new ByteArray(Uint8Array.of(0, 3, 10));
  assert.throws(() => truncated.readUTF(), RangeError);
  assert.equal(truncated.position, 0);
  assert.throws(() => b.writeUTF('a'.repeat(65536)), RangeError);
  assert.throws(() => {
    b.position = 0x80000000;
  }, RangeError);
});
