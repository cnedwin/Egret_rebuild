export const BYTE_READER_LIMITS = Object.freeze({ maxBytes: 16777216 });
// Capture intrinsic operations, rather than consulting source properties,
// iterators, constructors or species during admission and interpretation.
const Bytes = Uint8Array;
const View = DataView;
const apply = Reflect.apply;
const TypeFault = TypeError;
const RangeFault = RangeError;
const safeInteger = Number.isSafeInteger;
const typedArrayPrototype = Object.getPrototypeOf(Bytes.prototype);
const tagGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag).get;
const bufferGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer").get;
const lengthGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteLength").get;
const bufferLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get;
const resizableGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get;
const detachedGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "detached")?.get;
const setBytes = typedArrayPrototype.set;
const weakGet = WeakMap.prototype.get;
const weakSet = WeakMap.prototype.set;
const signedByte = View.prototype.getInt8;
const unsignedByte = View.prototype.getUint8;
const signedShort = View.prototype.getInt16;
const unsignedShort = View.prototype.getUint16;
const signedInt = View.prototype.getInt32;
const unsignedInt = View.prototype.getUint32;
const float = View.prototype.getFloat32;
const double = View.prototype.getFloat64;
const states = new WeakMap();
function stateOf(receiver) {
    // Weak identity lookup invokes no properties or traps on forged receivers.
    const state = apply(weakGet, states, [receiver]);
    if (state === undefined)
        throw new TypeFault("ByteReader receiver is not authentic");
    return state;
}
function openState(receiver) {
    const state = stateOf(receiver);
    if (state.disposed)
        throw new TypeFault("ByteReader is disposed");
    return state;
}
function byteOrder(value) {
    if (value !== "bigEndian" && value !== "littleEndian")
        throw new TypeFault("Unsupported byte order");
    return value;
}
function integer(value) {
    if (typeof value !== "number")
        throw new TypeFault("Byte position or count must be numeric");
    if (!safeInteger(value) || value < 0)
        throw new RangeFault("Byte position or count must be a nonnegative safe integer");
    return value === 0 ? 0 : value;
}
function requireAvailable(state, count) {
    if (count > state.length - state.position)
        throw new RangeFault("Insufficient bytes");
}
function readScalar(receiver, width, operation) {
    const state = openState(receiver);
    requireAvailable(state, width);
    const position = state.position;
    const value = apply(operation, state.view, [position, state.endian === "littleEndian"]);
    // A native interpretation failure escapes intact before the cursor commits.
    state.position = position + width;
    return value;
}
/** Read-only owned binary snapshot. Explicit Scope.use() can own its lifetime. */
export class ByteReader {
    constructor(source, endian = "bigEndian") {
        if (apply(tagGetter, source, []) !== "Uint8Array")
            throw new TypeFault("Source must be intrinsic Uint8Array");
        const backing = apply(bufferGetter, source, []);
        // Ordinary ArrayBuffer branding rejects shared storage across realms too.
        apply(bufferLengthGetter, backing, []);
        if (resizableGetter && apply(resizableGetter, backing, []))
            throw new TypeFault("Resizable source backing is unsupported");
        if (detachedGetter) {
            if (apply(detachedGetter, backing, []))
                throw new TypeFault("Detached source backing is unsupported");
        }
        else {
            // A zero-payload intrinsic view still distinguishes detached empty input.
            new Bytes(backing, 0, 0);
        }
        const order = byteOrder(endian);
        const length = apply(lengthGetter, source, []);
        if (length > BYTE_READER_LIMITS.maxBytes)
            throw new RangeFault("ByteReader source capacity exceeded");
        // All admission checks precede owned payload allocation. Native bulk copy
        // reads the intrinsic selected range even on subclasses/offset views.
        const bytes = new Bytes(length);
        apply(setBytes, bytes, [source]);
        const view = new View(apply(bufferGetter, bytes, []));
        apply(weakSet, states, [this, { bytes, view, length, position: 0, endian: order, disposed: false }]);
    }
    get length() {
        return stateOf(this).length;
    }
    get position() {
        return stateOf(this).position;
    }
    get bytesAvailable() {
        const state = stateOf(this);
        return state.length - state.position;
    }
    get disposed() {
        return stateOf(this).disposed;
    }
    get endian() {
        return stateOf(this).endian;
    }
    set endian(value) {
        const state = openState(this);
        state.endian = byteOrder(value);
    }
    seek(position) {
        const state = openState(this);
        const next = integer(position);
        if (next > state.length)
            throw new RangeFault("Position exceeds reader length");
        state.position = next;
    }
    skip(count) {
        const state = openState(this);
        const width = integer(count);
        requireAvailable(state, width);
        state.position += width;
    }
    readByte() {
        return readScalar(this, 1, signedByte);
    }
    readUnsignedByte() {
        return readScalar(this, 1, unsignedByte);
    }
    readShort() {
        return readScalar(this, 2, signedShort);
    }
    readUnsignedShort() {
        return readScalar(this, 2, unsignedShort);
    }
    readInt() {
        return readScalar(this, 4, signedInt);
    }
    readUnsignedInt() {
        return readScalar(this, 4, unsignedInt);
    }
    readFloat() {
        return readScalar(this, 4, float);
    }
    readDouble() {
        return readScalar(this, 8, double);
    }
    readBytes(count) {
        const state = openState(this);
        const width = count === undefined ? state.length - state.position : integer(count);
        requireAvailable(state, width);
        const position = state.position;
        const result = new Bytes(width);
        const selected = new Bytes(apply(bufferGetter, state.bytes, []), position, width);
        apply(setBytes, result, [selected]);
        // Fresh output owns its buffer; allocation/copy must finish before commit.
        state.position = position + width;
        return result;
    }
    /** Terminal release drops both storage references without claiming zeroization. */
    dispose() {
        const state = stateOf(this);
        if (state.disposed)
            return;
        state.disposed = true;
        state.bytes = undefined;
        state.view = undefined;
        state.length = 0;
        state.position = 0;
    }
}
//# sourceMappingURL=ByteReader.js.map