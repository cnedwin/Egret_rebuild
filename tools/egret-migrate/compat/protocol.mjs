// SPDX-License-Identifier: Apache-2.0
/** Byte order names used by existing Egret 5 protocol handlers. */
export const Endian = Object.freeze({ BIG_ENDIAN: 'bigEndian', LITTLE_ENDIAN: 'littleEndian' });
const maximumBytes = 16 * 1024 * 1024;

function size(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximumBytes)
    throw new RangeError('ByteArray size is outside the 16 MiB packet limit.');
  return value;
}

function inputBytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof Uint8Array) return value;
  throw new TypeError('Expected an ArrayBuffer or Uint8Array.');
}

// Bare V8 has no browser TextEncoder or TextDecoder. Use Unicode scalar values on all hosts.
function scalar(character) {
  const point = character.codePointAt(0);
  return point >= 0xd800 && point <= 0xdfff ? 0xfffd : point;
}

function utf8Length(text, limit) {
  if (typeof text !== 'string') throw new TypeError('Expected a UTF-8 string.');
  let length = 0;
  for (const character of text) {
    const point = scalar(character);
    length += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    if (length > limit) throw new RangeError('UTF-8 field exceeds its byte limit.');
  }
  return length;
}

function encodeUtf8(text, bytes, at) {
  for (const character of text) {
    const point = scalar(character);
    if (point < 0x80) bytes[at++] = point;
    else {
      if (point < 0x800) bytes[at++] = 0xc0 | (point >> 6);
      else {
        if (point < 0x10000) bytes[at++] = 0xe0 | (point >> 12);
        else {
          bytes[at++] = 0xf0 | (point >> 18);
          bytes[at++] = 0x80 | ((point >> 12) & 63);
        }
        bytes[at++] = 0x80 | ((point >> 6) & 63);
      }
      bytes[at++] = 0x80 | (point & 63);
    }
  }
}

function decodeUtf8(bytes) {
  let text = '';
  for (let at = 0; at < bytes.length; ) {
    const lead = bytes[at++];
    if (lead < 0x80) {
      // The classic decoder omits embedded NUL bytes, including in fixed-width fields.
      if (lead !== 0) text += String.fromCharCode(lead);
      continue;
    }
    const width = lead < 0xe0 ? 2 : lead < 0xf0 ? 3 : 4;
    if (lead < 0xc2 || lead > 0xf4 || at + width - 1 > bytes.length)
      throw new RangeError('Invalid UTF-8 byte sequence.');
    let point = lead & (0x7f >> width);
    for (let i = 1; i < width; ++i) {
      const next = bytes[at++];
      if ((next & 0xc0) !== 0x80) throw new RangeError('Invalid UTF-8 continuation.');
      point = (point << 6) | (next & 63);
    }
    if (
      (width === 3 && point < 0x800) ||
      (width === 4 && point < 0x10000) ||
      (point >= 0xd800 && point <= 0xdfff) ||
      point > 0x10ffff
    )
      throw new RangeError('Invalid UTF-8 scalar value.');
    text += String.fromCodePoint(point);
  }
  return text;
}

/** Seekable packet bytes for legacy handlers. Owns its storage and never opens a connection. */
export class ByteArray {
  #bytes;
  #view;
  #length = 0;
  #position = 0;
  #capacity = 0;
  #extension;
  #little = false;

  constructor(buffer, bufferExtSize = 0) {
    this.#extension = size(bufferExtSize);
    this.#reset(buffer === undefined ? new Uint8Array() : inputBytes(buffer));
  }

  #capacityFor(end) {
    return this.#extension === 0
      ? end
      : Math.min(maximumBytes, (Math.floor(end / this.#extension) + 1) * this.#extension);
  }

  #reset(source) {
    this.#length = size(source.length);
    this.#capacity = this.#capacityFor(this.#length);
    this.#bytes = new Uint8Array(this.#capacity);
    this.#bytes.set(source);
    this.#view = new DataView(this.#bytes.buffer);
  }

  #ensure(end) {
    size(end);
    if (end <= this.#capacity) return;
    this.#capacity = this.#capacityFor(end);
    if (this.#capacity <= this.#bytes.length) return;
    // Grow independently of the public capacity so repeated small writes stay amortized linear.
    const physical = Math.min(maximumBytes, Math.max(this.#capacity, this.#bytes.length * 2, 32));
    const next = new Uint8Array(physical);
    next.set(this.#bytes);
    this.#bytes = next;
    this.#view = new DataView(next.buffer);
  }

  #expose() {
    // A caller of rawBuffer/bytes can inspect its entire backing store. Trim allocation slack first.
    if (this.#capacity !== this.#bytes.length) {
      this.#bytes = this.#bytes.slice(0, this.#capacity);
      this.#view = new DataView(this.#bytes.buffer);
    }
    return this.#bytes;
  }

  get endian() {
    return this.#little ? Endian.LITTLE_ENDIAN : Endian.BIG_ENDIAN;
  }
  set endian(value) {
    if (value !== Endian.BIG_ENDIAN && value !== Endian.LITTLE_ENDIAN) throw new TypeError('Invalid byte order.');
    this.#little = value === Endian.LITTLE_ENDIAN;
  }
  get position() {
    return this.#position;
  }
  set position(value) {
    this.#ensure(value);
    this.#position = value;
    this.#length = Math.max(this.#length, value);
  }
  get length() {
    return this.#length;
  }
  set length(value) {
    this.#ensure(value);
    this.#length = value;
    this.#position = Math.min(this.#position, value);
  }
  get readAvailable() {
    return this.#length - this.#position;
  }
  get bytesAvailable() {
    return this.#capacity - this.#position;
  }
  get buffer() {
    return this.#bytes.slice(0, this.#length).buffer;
  }
  set buffer(value) {
    this.#reset(inputBytes(value));
  }
  setArrayBuffer(value) {
    this.buffer = value;
  }
  get rawBuffer() {
    return this.#expose().buffer;
  }
  get bytes() {
    return this.#expose();
  }
  get bufferOffset() {
    return 0;
  }
  clear() {
    this.#position = 0;
    this.#reset(new Uint8Array());
  }

  #read(width, method) {
    if (width > this.readAvailable) throw new RangeError('Truncated packet.');
    const value = this.#view[method](this.#position, this.#little);
    this.#position += width;
    return value;
  }

  #write(width, method, value) {
    const end = this.#position + width;
    this.#ensure(end);
    this.#view[method](this.#position, value, this.#little);
    this.position = end;
  }

  readBoolean() {
    return this.readUnsignedByte() !== 0;
  }
  readByte() {
    return this.#read(1, 'getInt8');
  }
  readUnsignedByte() {
    return this.#read(1, 'getUint8');
  }
  readShort() {
    return this.#read(2, 'getInt16');
  }
  readUnsignedShort() {
    return this.#read(2, 'getUint16');
  }
  readInt() {
    return this.#read(4, 'getInt32');
  }
  readUnsignedInt() {
    return this.#read(4, 'getUint32');
  }
  readFloat() {
    return this.#read(4, 'getFloat32');
  }
  readDouble() {
    return this.#read(8, 'getFloat64');
  }
  writeBoolean(value) {
    this.writeByte(value ? 1 : 0);
  }
  writeByte(value) {
    this.#write(1, 'setInt8', value);
  }
  writeShort(value) {
    this.#write(2, 'setInt16', value);
  }
  writeUnsignedShort(value) {
    this.#write(2, 'setUint16', value);
  }
  writeInt(value) {
    this.#write(4, 'setInt32', value);
  }
  writeUnsignedInt(value) {
    this.#write(4, 'setUint32', value);
  }
  writeFloat(value) {
    this.#write(4, 'setFloat32', value);
  }
  writeDouble(value) {
    this.#write(8, 'setFloat64', value);
  }

  readUTF() {
    if (this.readAvailable < 2) throw new RangeError('Truncated UTF length.');
    const at = this.#position + 2;
    const end = at + this.#view.getUint16(this.#position, this.#little);
    if (end > this.#length) throw new RangeError('Truncated UTF field.');
    const value = decodeUtf8(this.#bytes.subarray(at, end));
    this.#position = end;
    return value;
  }

  readUTFBytes(length) {
    const end = this.#position + size(length);
    if (end > this.#length) throw new RangeError('Truncated UTF field.');
    const value = decodeUtf8(this.#bytes.subarray(this.#position, end));
    this.#position = end;
    return value;
  }

  writeUTF(value) {
    const length = utf8Length(value, 0xffff);
    const end = this.#position + 2 + length;
    this.#ensure(end);
    this.#view.setUint16(this.#position, length, this.#little);
    encodeUtf8(value, this.#bytes, this.#position + 2);
    this.position = end;
  }

  writeUTFBytes(value) {
    const end = this.#position + utf8Length(value, maximumBytes - this.#position);
    this.#ensure(end);
    encodeUtf8(value, this.#bytes, this.#position);
    this.position = end;
  }

  readBytes(target, offset = 0, length = 0) {
    size(offset);
    size(length);
    const count = length || this.readAvailable;
    if (count < 0 || count > this.readAvailable) throw new RangeError('Truncated byte range.');
    target.#ensure(offset + count);
    target.#bytes.set(this.#bytes.subarray(this.#position, this.#position + count), offset);
    target.#length = Math.max(target.#length, offset + count);
    this.#position += count;
  }

  writeBytes(source, offset = 0, length = 0) {
    size(offset);
    size(length);
    const available = source.#length - offset;
    if (available <= 0) return;
    const count = length === 0 ? available : Math.min(length, available);
    const end = this.#position + count;
    this.#ensure(end);
    this.#bytes.set(source.#bytes.subarray(offset, offset + count), this.#position);
    this.position = end;
  }
}
