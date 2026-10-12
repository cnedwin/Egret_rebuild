# ByteWriter BW1 contract

English | [简体中文](../../Cns/docs/字节写入器BW1契约.md)

ByteWriter is a fixed-capacity binary authoring utility for resource tooling and game infrastructure. It preserves familiar Egret method names and shares ByteReader's byte-order type. BW1 is an engineering choice within the utility roadmap; it does not implement a file format or legacy ByteArray compatibility.

## Public use

```ts
import { ByteWriter, ByteReader } from '@egret/engine';
import type { ByteOrder } from '@egret/engine';

const order: ByteOrder = 'littleEndian';
const writer = new ByteWriter(3, order);
try {
  writer.writeUnsignedShort(4660);
  writer.writeUnsignedByte(171);
  const bytes = writer.toUint8Array(); // [0x34, 0x12, 0xab]
  const reader = new ByteReader(bytes, order);
  try {
    console.log(reader.readUnsignedShort()); // 4660
  } finally {
    reader.dispose();
  }
} finally {
  writer.dispose();
}
```

The runtime root exposes the same `ByteWriter` constructor and frozen `BYTE_WRITER_LIMITS` object. `ByteOrder` remains the existing type-only union `'bigEndian' | 'littleEndian'`. Optional browser, text, input and scene entries acquire no writer export. No package, dependency or public subpath is added; the core stays independent of DOM and Node APIs.

Capacity is a required nonnegative safe integer; negative zero becomes zero. Unsupported numeric values raise RangeError, and non-numbers raise TypeError without coercion. Capacity-domain validation precedes byte-order validation, which precedes the **16,777,216-byte** ceiling and owned allocation. Omitted or explicitly undefined constructor order selects bigEndian. The ceiling bounds one writer's payload, not total process memory or its snapshots.

## Appends and ownership

| API | Meaning |
| --- | --- |
| `capacity`, `length`, `remainingCapacity`, `disposed` | Read-only diagnostics; length starts at zero. |
| `endian` | Read or change byte order for subsequent multi-byte writes. |
| `writeByte`, `writeUnsignedByte` | Append a signed or unsigned 8-bit integer. |
| `writeShort`, `writeUnsignedShort` | Append a signed or unsigned 16-bit integer. |
| `writeInt`, `writeUnsignedInt` | Append a signed or unsigned 32-bit integer. |
| `writeFloat`, `writeDouble` | Append a primitive number using native IEEE binary32 or binary64 conversion. |
| `writeBytes(source)` | Append the selected bytes of an authentic Uint8Array with attached, fixed ordinary ArrayBuffer backing. |
| `toUint8Array()` | Return an independent, tightly backed copy of the committed prefix, including a fresh empty result. |
| `dispose()` | Drop owned storage references synchronously; repeated disposal is harmless. |

Every write returns void. Integer inputs must lie within their signed or unsigned domain: they never wrap or truncate. Floating-point inputs include signed zero, NaN and infinities; rounding, underflow and overflow follow native conversion. NaN payload bits are not promised. Unaligned multi-byte writes are supported.

Bulk writes accept eligible subclass and cross-realm views, and reject shared, resizable or detached backing, other view types and proxies. Source property overrides, iterators and species do not control admission or copying. Later caller mutation cannot change committed bytes. Empty bulk writes are valid even at full capacity. There is no separate source-size limit beyond remaining capacity.

## Failure and lifetime

Writes validate an authentic open receiver, then the input domain, then remaining capacity. Invalid input therefore wins over capacity refusal. TypeError covers receiver, order, source and disposed-operation failures; RangeError covers numeric domains, the ceiling and insufficient capacity. Original allocation and native-write errors propagate unchanged.

Length commits only after successful writing. A controlled faithful native operation that throws after touching the unused tail does not change the committed prefix or length; snapshots exclude that tail. BW1 does not promise isolation from arbitrary modified realms, reentry or real out-of-memory recovery.

After disposal, capacity, length and remainingCapacity become zero, disposed is true and the last endian remains readable. Writes, snapshots and order changes are refused. Previously returned snapshots remain usable. Existing `Scope.use(writer)` can own this disposable without a new ownership API. Reference release does not establish physical reclamation or zeroization.

BW1 provides no growth, seek, overwrite, reset, streaming, text encoding or format importer. Runtime behavior, types, boundary controls and publication status are recorded separately in the [evidence document](byte-writer-bw1-evidence.md). Complete Spine, migration, native SDK, hardware and performance acceptance remain separate work.
