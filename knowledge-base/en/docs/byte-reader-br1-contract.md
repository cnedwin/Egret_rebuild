# ByteReader BR1 contract

English | [简体中文](../../Cns/docs/字节读取器BR1契约.md)

ByteReader is a small, synchronous utility for reading owned binary data. It uses familiar Egret read methods with explicit byte order and a read-only cursor interface. It is intended as a building block for resource formats and engineering tools.

Status on 2026-10-11: the implementation has passed isolated compilation, 23 behavioral tests, strict positive type checks, 18 individually checked negative type cases, controlled copy-out failure tests and 156 related regression tests. Complete integration and publication checks remain pending. These results cover this utility, not a new renderer, platform adapter or file-format importer.

## Public entry and ownership

```ts
import { ByteReader, BYTE_READER_LIMITS } from '@egret/engine';
import type { ByteOrder } from '@egret/engine';

const reader = new ByteReader(new Uint8Array([0x34, 0x12, 0xab]), 'littleEndian');
try {
  console.log(reader.readUnsignedShort()); // 4660
  console.log(reader.readUnsignedByte());  // 171
  console.log(reader.bytesAvailable);      // 0
} finally {
  reader.dispose();
}
```

The runtime root exports the same ByteReader and BYTE_READER_LIMITS values. ByteOrder is a type-only union of `'bigEndian' | 'littleEndian'`; it adds no runtime value. There is no new package or package subpath.

Construction requires an authentic Uint8Array backed by an attached, fixed ordinary ArrayBuffer. Eligible subclass and cross-realm views are supported. Shared or resizable backing stores, detached views, other view types and proxy imitations are rejected. Only the view's selected bytes are copied into a tightly owned buffer. Later caller changes cannot change the reader's data. The reader never exposes that buffer.

The frozen `BYTE_READER_LIMITS.maxBytes` is 16,777,216. This bounds one reader's copied payload. Caller buffers and returned copies are separate allocations; it is not a total process-memory budget. Omitted or explicitly undefined constructor byte order selects bigEndian.

## Cursor and read methods

| API | Behavior |
| --- | --- |
| `length`, `position`, `bytesAvailable`, `disposed` | Read-only diagnostics. Position starts at zero. |
| `endian` | Read or set the byte order for subsequent multi-byte reads. |
| `seek(position)` | Set an absolute position in the closed range from zero to length. |
| `skip(count)` | Advance by a nonnegative count within the remaining bytes. |
| `readByte()`, `readUnsignedByte()` | Read one signed or unsigned 8-bit integer. |
| `readShort()`, `readUnsignedShort()` | Read one signed or unsigned 16-bit integer. |
| `readInt()`, `readUnsignedInt()` | Read one signed or unsigned 32-bit integer. |
| `readFloat()`, `readDouble()` | Read IEEE 754 binary32 or binary64 using the selected byte order. |
| `readBytes(count?)` | Return a fresh, tightly backed ordinary Uint8Array and advance. Omitted count reads all remaining bytes; zero returns a fresh empty copy. |
| `dispose()` | Synchronously release owned data references; repeated disposal is harmless. |

Numeric positions and counts must be nonnegative safe integers. Negative zero is normalized to zero. Inputs are not coerced from strings or other objects. Unaligned scalar reads are supported. Floating-point tests cover finite values, signed zero, infinities and NaN classification; NaN payload bits are not a public contract.

A successful read commits its new position after interpretation or copying succeeds. Invalid values, insufficient bytes and abrupt completion during output allocation or copying preserve both the cursor and stored data. Returned copies do not alias each other or the reader's storage.

## Errors and lifetime

TypeError covers an invalid receiver, unsupported source domain, invalid byte-order value or an operation on a disposed reader. RangeError covers invalid numeric positions/counts, out-of-range movement, insufficient bytes and a payload above the public limit. Constructor source validation precedes byte-order validation; valid-source byte order precedes the capacity check. Original abrupt allocation or copying errors propagate unchanged.

After disposal, length, position and bytesAvailable are zero; disposed is true and the last byte-order diagnostic is retained. Further reads, movement and byte-order changes are rejected. ByteReader satisfies the existing disposable shape, so applications may register it with an existing Scope without a new ownership API.

This package adds no text encoding, binary writing, streaming or legacy ByteArray compatibility guarantee. File-format support, including Spine binary decoding, requires separate formats, fixtures and integration validation.

## Verification and provenance

The implementation and fixtures are independently authored first-party code under the repository's Apache-2.0 license. The behavior fixture uses literal binary expectations through the public engine entry. Type cases are compiled without negative-error suppression and checked by exact file, line and compiler code. Controlled CPU faults reach real captured allocation/copy calls in a fresh process; ambient intrinsics are restored and complete remaining data is checked after recovery. This demonstrates the tested exception paths rather than recovery from physical memory exhaustion.

Integration must preserve the existing DOM-free core and exact export boundaries. Only the runtime and engine roots gain the two values and one erased type; unrelated entries keep their previous surfaces. Before release, the full checker, existing regression suite and bilingual publication gates must run against the final selected source.
