// SPDX-License-Identifier: Apache-2.0
import { constants, crc32, inflateSync } from 'node:zlib';
import { types } from 'node:util';
import { PNG } from 'pngjs';

const MAX_BYTES = 8_388_608, MAX_EDGE = 4096, MAX_PIXELS = 1_048_576, MAX_CHUNKS = 1024;
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const ALLOWED = new Set(['IHDR', 'IDAT', 'IEND', 'sRGB', 'gAMA', 'cHRM']);
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const backingGetter = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const offsetGetter = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset').get;
const lengthGetter = Object.getOwnPropertyDescriptor(typedPrototype, 'byteLength').get;
const resizableGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable').get;
const detachedGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'detached').get;
const backingLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;

function fault(code, message, cause) {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.code = 'CONTENT_PNG_' + code;
  return error;
}
function sourceView(source) {
  try {
    if (!types.isUint8Array(source)) throw new TypeError('Uint8Array required');
    const backing = Reflect.apply(backingGetter, source, []);
    // Intrinsic ArrayBuffer access rejects SharedArrayBuffer without consulting user getters.
    Reflect.apply(backingLengthGetter, backing, []);
    if (Reflect.apply(resizableGetter, backing, []) || Reflect.apply(detachedGetter, backing, [])) {
      throw new TypeError('Fixed attached ArrayBuffer required');
    }
    const length = Reflect.apply(lengthGetter, source, []);
    if (length > MAX_BYTES) throw fault('LIMIT', 'PNG encoded bytes exceed the 8 MiB input limit');
    return Buffer.from(backing, Reflect.apply(offsetGetter, source, []), length);
  } catch (cause) {
    if (cause?.code === 'CONTENT_PNG_LIMIT') throw cause;
    throw fault('INPUT', 'PNG source must be a Uint8Array over a fixed attached ArrayBuffer', cause);
  }
}
function admit(bytes) {
  if (bytes.length < 8 || SIGNATURE.some((value, index) => bytes[index] !== value)) {
    throw fault('STRUCTURE', 'PNG requires the complete eight-byte signature');
  }
  const chunks = [];
  for (let at = 8; at < bytes.length;) {
    if (chunks.length === MAX_CHUNKS) throw fault('LIMIT', 'PNG exceeds the 1024-chunk input limit');
    if (bytes.length - at < 12) throw fault('STRUCTURE', 'PNG has an incomplete chunk header or CRC');
    const length = bytes.readUInt32BE(at);
    if (length > 0x7fffffff || length > bytes.length - at - 12) {
      throw fault('STRUCTURE', 'PNG chunk payload length exceeds the remaining framing');
    }
    let type = '';
    for (let index = 0; index < 4; index++) {
      const value = bytes[at + 4 + index];
      if (!(value >= 65 && value <= 90 || value >= 97 && value <= 122) || index === 2 && value > 90) {
        throw fault('STRUCTURE', 'PNG chunk type must use ASCII letters and an uppercase reserved bit');
      }
      type += String.fromCharCode(value);
    }
    chunks.push({ type, offset: at + 8, length });
    at += length + 12;
  }
  // Match the BrowserTextureProvider structural precedence before profile admission.
  if (chunks[0]?.type !== 'IHDR' || chunks[0].length !== 13 || chunks.at(-1)?.type !== 'IEND') {
    throw fault('STRUCTURE', 'PNG requires a complete IHDR/IDAT/IEND structure');
  }
  const metadata = new Map();
  let idatLength = 0, idatState = 0;
  for (const [index, chunk] of chunks.entries()) {
    if (chunk.type === 'IHDR' && index !== 0 || chunk.type === 'IEND' && (index !== chunks.length - 1 || chunk.length !== 0)) {
      throw fault('STRUCTURE', 'PNG has a duplicate, misplaced or nonempty boundary chunk');
    }
    if (chunk.type === 'IDAT') {
      if (idatState === 2) throw fault('STRUCTURE', 'PNG IDAT chunks must be consecutive');
      idatState = 1;
      idatLength += chunk.length;
    } else if (idatState === 1) idatState = 2;
    if (['sRGB', 'gAMA', 'cHRM'].includes(chunk.type)) {
      const expected = chunk.type === 'sRGB' ? 1 : chunk.type === 'gAMA' ? 4 : 32;
      if (metadata.has(chunk.type) || idatState !== 0 || chunk.length !== expected) {
        throw fault('STRUCTURE', 'PNG color metadata must have its exact length, occur once and precede IDAT');
      }
      metadata.set(chunk.type, chunk);
    }
  }
  if (idatLength === 0) throw fault('STRUCTURE', 'PNG requires nonempty total IDAT image data');
  const header = chunks[0].offset;
  const width = bytes.readUInt32BE(header), height = bytes.readUInt32BE(header + 4);
  if (width === 0 || height === 0) throw fault('STRUCTURE', 'PNG width and height must be positive');
  if (width > MAX_EDGE || height > MAX_EDGE || width * height > MAX_PIXELS) {
    throw fault('LIMIT', 'PNG exceeds the 4096-edge or 1048576-pixel input limit');
  }
  const color = bytes[header + 9];
  if (bytes[header + 8] !== 8 || ![2, 6].includes(color)
      || bytes[header + 10] !== 0 || bytes[header + 11] !== 0 || bytes[header + 12] !== 0
      || chunks.some(chunk => !ALLOWED.has(chunk.type))) {
    throw fault('PROFILE', 'PNG supports only RGB/RGBA8 noninterlaced images and IHDR/IDAT/IEND/sRGB/gAMA/cHRM chunks');
  }
  const srgb = metadata.get('sRGB'), gamma = metadata.get('gAMA'), chromaticity = metadata.get('cHRM');
  if (srgb && bytes[srgb.offset] > 3 || (gamma || chromaticity) && !srgb
      || gamma && bytes.readUInt32BE(gamma.offset) !== 45455) {
    throw fault('PROFILE', 'PNG color metadata must match the admitted sRGB intent and gamma 45455 policy');
  }
  if (chromaticity) {
    const expected = [31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000];
    if (expected.some((value, index) => bytes.readUInt32BE(chromaticity.offset + index * 4) !== value)) {
      throw fault('PROFILE', 'PNG chromaticity must match the admitted sRGB compatibility values');
    }
  }
  for (const chunk of chunks) {
    const checksum = crc32(bytes.subarray(chunk.offset - 4, chunk.offset + chunk.length));
    if (checksum !== bytes.readUInt32BE(chunk.offset + chunk.length)) {
      throw fault('CRC', 'PNG ' + chunk.type + ' chunk CRC does not match its encoded type and payload');
    }
  }
  const scanlineBytes = height * (1 + width * (color === 2 ? 3 : 4));
  if (!Number.isSafeInteger(scanlineBytes) || scanlineBytes <= 0 || idatLength > MAX_BYTES) {
    throw fault('LIMIT', 'PNG scanline or compressed byte arithmetic exceeds the finite input limits');
  }
  return { width, height, chunks, idatLength, scanlineBytes };
}
function verifyScanlines(bytes, admitted) {
  let compressed, inflated;
  try {
    compressed = Buffer.alloc(admitted.idatLength);
    let offset = 0;
    for (const chunk of admitted.chunks) {
      if (chunk.type !== 'IDAT') continue;
      bytes.copy(compressed, offset, chunk.offset, chunk.offset + chunk.length);
      offset += chunk.length;
    }
    inflated = inflateSync(compressed, {
      maxOutputLength: admitted.scanlineBytes,
      finishFlush: constants.Z_FINISH,
      rejectGarbageAfterEnd: true,
    });
    if (inflated.length !== admitted.scanlineBytes) {
      throw new RangeError('Expected exactly ' + admitted.scanlineBytes + ' raw scanline bytes, received ' + inflated.length);
    }
  } catch (cause) {
    throw fault('INFLATE', 'PNG IDAT must contain one complete zlib stream with exactly the admitted scanline length', cause);
  } finally {
    // Drop both temporary references before the separate public pngjs decode call.
    inflated = undefined;
    compressed = undefined;
  }
}

/**
 * Finite offline RGB/RGBA8 PNG decode. The source remains the caller's primary artifact.
 * Returned rgba owns top-left tight RGBA8 straight-alpha encoded sample values.
 * The frozen record does not freeze its owned mutable Uint8Array.
 * Stable Error.code values: CONTENT_PNG_INPUT (fixed bytes required), LIMIT (input
 * capacity), STRUCTURE (framing/order), PROFILE (unsupported format/metadata),
 * CRC (admitted chunk checksum), INFLATE (strict stream/length), DECODE (pixel decode).
 * Performs two synchronous decompressions: runners charge 2 * scanlineBytes and
 * observe cancellation before/after the call; this function promises no mid-call cancellation.
 */
export function decodeContentPng(source) {
  if (arguments.length !== 1) throw fault('INPUT', 'PNG decoder accepts exactly one Uint8Array source and no ports or callbacks');
  const bytes = sourceView(source);
  const admitted = admit(bytes);
  verifyScanlines(bytes, admitted);
  try {
    const decoded = PNG.sync.read(bytes, { checkCRC: true });
    if (decoded.width !== admitted.width || decoded.height !== admitted.height
        || !types.isUint8Array(decoded.data) || decoded.data.length !== admitted.width * admitted.height * 4) {
      throw new TypeError('Decoded dimensions and tight RGBA length must match the admitted IHDR');
    }
    return Object.freeze({
      width: admitted.width, height: admitted.height,
      rgba: new Uint8Array(decoded.data), scanlineBytes: admitted.scanlineBytes,
    });
  } catch (cause) {
    throw fault('DECODE', 'PNG pixel decoding failed for the admitted RGB/RGBA8 source', cause);
  }
}
