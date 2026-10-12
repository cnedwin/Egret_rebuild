import type { Disposable } from "@egret/contracts";
import type { ByteOrder } from "./ByteReader.js";

export const BYTE_WRITER_LIMITS = Object.freeze({ maxBytes: 16777216 } as const);

// Capture native slot access and writes once. Caller properties, iterators and
// species do not participate in admission, append or snapshot ownership.
const Bytes = Uint8Array;
const View = DataView;
const apply = Reflect.apply;
const TypeFault = TypeError;
const RangeFault = RangeError;
const safeInteger = Number.isSafeInteger;
const typedArrayPrototype = Object.getPrototypeOf(Bytes.prototype);
const tagGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)!.get!;
const bufferGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer")!.get!;
const lengthGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteLength")!.get!;
const bufferLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!;
const resizableGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get;
const detachedGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "detached")?.get;
const setBytes = typedArrayPrototype.set;
const weakGet = WeakMap.prototype.get;
const weakSet = WeakMap.prototype.set;
const signedByte = View.prototype.setInt8;
const unsignedByte = View.prototype.setUint8;
const signedShort = View.prototype.setInt16;
const unsignedShort = View.prototype.setUint16;
const signedInt = View.prototype.setInt32;
const unsignedInt = View.prototype.setUint32;
const float = View.prototype.setFloat32;
const double = View.prototype.setFloat64;

interface WriterState {
  bytes: Uint8Array<ArrayBuffer> | undefined;
  view: DataView | undefined;
  capacity: number;
  length: number;
  endian: ByteOrder;
  disposed: boolean;
}
const states = new WeakMap<object, WriterState>();
type ScalarWrite = (byteOffset: number, value: number, littleEndian?: boolean) => void;

function stateOf(receiver: unknown): WriterState {
  // Private identity lookup authenticates without reading receiver properties.
  const state = apply(weakGet, states, [receiver]) as WriterState | undefined;
  if (state === undefined) throw new TypeFault("ByteWriter receiver is not authentic");
  return state;
}

function openState(receiver: unknown): WriterState {
  const state = stateOf(receiver);
  if (state.disposed) throw new TypeFault("ByteWriter is disposed");
  return state;
}

function byteOrder(value: unknown): ByteOrder {
  if (value !== "bigEndian" && value !== "littleEndian") throw new TypeFault("Unsupported byte order");
  return value;
}

function capacityValue(value: unknown): number {
  if (typeof value !== "number") throw new TypeFault("ByteWriter capacity must be numeric");
  if (!safeInteger(value) || value < 0) throw new RangeFault("Capacity must be a nonnegative safe integer");
  return value === 0 ? 0 : value;
}

function requireCapacity(state: WriterState, width: number): void {
  if (width > state.capacity - state.length) throw new RangeFault("Insufficient remaining capacity");
}

function appendScalar(receiver: unknown, value: unknown, width: number, operation: ScalarWrite,
  minimum?: number, maximum?: number): void {
  const state = openState(receiver);
  if (typeof value !== "number") throw new TypeFault("Scalar value must be numeric");
  if (minimum !== undefined && (!safeInteger(value) || value < minimum || value > maximum!)) {
    throw new RangeFault("Integer value is outside its byte domain");
  }
  // Domain refusal wins over capacity refusal. Native IEEE conversion handles
  // every admitted floating number, including signed zero, NaN and infinity.
  requireCapacity(state, width);
  const offset = state.length;
  apply(operation, state.view, [offset, value, state.endian === "littleEndian"]);
  // A faithful native write may throw after touching the uncommitted tail.
  // Publish length only on success; snapshots never expose that failed tail.
  state.length = offset + width;
}

function sourceLength(source: unknown): number {
  if (apply(tagGetter, source, []) !== "Uint8Array") throw new TypeFault("Source must be intrinsic Uint8Array");
  const backing = apply(bufferGetter, source, []) as ArrayBuffer;
  // The ordinary-buffer intrinsic also rejects cross-realm shared backing.
  apply(bufferLengthGetter, backing, []);
  if (resizableGetter && apply(resizableGetter, backing, [])) throw new TypeFault("Resizable source backing is unsupported");
  if (detachedGetter) {
    if (apply(detachedGetter, backing, [])) throw new TypeFault("Detached source backing is unsupported");
  } else {
    // A zero-length view probes attachment even for an empty selected source.
    new Bytes(backing, 0, 0);
  }
  return apply(lengthGetter, source, []) as number;
}

/** Fixed-capacity owned binary appends. Scope.use() can own the writer's lifetime. */
export class ByteWriter implements Disposable {
  declare private readonly byteWriterBrand: void;

  public constructor(capacity: number, endian: ByteOrder = "bigEndian") {
    // Preserve capacity-domain -> order -> ceiling -> allocation precedence.
    const size = capacityValue(capacity);
    const order = byteOrder(endian);
    if (size > BYTE_WRITER_LIMITS.maxBytes) throw new RangeFault("ByteWriter capacity exceeded");
    const bytes = new Bytes(size);
    const view = new View(apply(bufferGetter, bytes, []) as ArrayBuffer);
    // Failed construction publishes no state; intrinsic faults escape intact.
    apply(weakSet, states, [this, { bytes, view, capacity: size, length: 0, endian: order, disposed: false }]);
  }

  public get capacity(): number { return stateOf(this).capacity; }
  public get length(): number { return stateOf(this).length; }
  public get remainingCapacity(): number { const state = stateOf(this); return state.capacity - state.length; }
  public get disposed(): boolean { return stateOf(this).disposed; }
  public get endian(): ByteOrder { return stateOf(this).endian; }
  public set endian(value: ByteOrder) { const state = openState(this); state.endian = byteOrder(value); }

  public writeByte(value: number): void { appendScalar(this, value, 1, signedByte, -128, 127); }
  public writeUnsignedByte(value: number): void { appendScalar(this, value, 1, unsignedByte, 0, 255); }
  public writeShort(value: number): void { appendScalar(this, value, 2, signedShort, -32768, 32767); }
  public writeUnsignedShort(value: number): void { appendScalar(this, value, 2, unsignedShort, 0, 65535); }
  public writeInt(value: number): void { appendScalar(this, value, 4, signedInt, -2147483648, 2147483647); }
  public writeUnsignedInt(value: number): void { appendScalar(this, value, 4, unsignedInt, 0, 4294967295); }
  public writeFloat(value: number): void { appendScalar(this, value, 4, float); }
  public writeDouble(value: number): void { appendScalar(this, value, 8, double); }

  public writeBytes(source: Uint8Array<ArrayBuffer>): void {
    const state = openState(this);
    const width = sourceLength(source);
    requireCapacity(state, width);
    const offset = state.length;
    // Native set uses the selected intrinsic range without a second payload
    // allocation, caller getters, iteration or species-dependent conversion.
    apply(setBytes, state.bytes, [source, offset]);
    state.length = offset + width;
  }

  public toUint8Array(): Uint8Array<ArrayBuffer> {
    const state = openState(this);
    const result = new Bytes(state.length);
    const committed = new Bytes(apply(bufferGetter, state.bytes, []) as ArrayBuffer, 0, state.length);
    // Only the committed prefix is copied into fresh, tightly backed storage.
    // Allocation/copy failure changes no writer state or published snapshot.
    apply(setBytes, result, [committed]);
    return result;
  }

  /** Terminal release drops storage references; prior snapshots stay independent. */
  public dispose(): void {
    const state = stateOf(this);
    if (state.disposed) return;
    state.disposed = true;
    state.bytes = undefined;
    state.view = undefined;
    state.capacity = 0;
    state.length = 0;
  }
}
