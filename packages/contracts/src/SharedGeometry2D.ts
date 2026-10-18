// First-party Apache-2.0 implementation. Native admission follows the existing
// first-party ImageData2D pattern; shared-profile geometry policy is independently authored.
declare const sharedGeometry2DBrand: unique symbol;

export type SharedFloatArray2D = Float32Array<ArrayBuffer> | Float64Array<ArrayBuffer>;
export type SharedIndexArray2D = Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
export interface SharedGeometryInput2D {
    readonly positions: SharedFloatArray2D;
    readonly uvs: SharedFloatArray2D;
    readonly lightColors: SharedFloatArray2D;
    readonly darkColors: SharedFloatArray2D;
    readonly indices: SharedIndexArray2D;
}
/** Immutable CPU geometry identity; the brand grants no asset or GPU authority. */
export interface SharedGeometry2D {
    readonly [sharedGeometry2DBrand]: true;
    readonly vertexCount: number;
    readonly indexCount: number;
    readonly triangleCount: number;
    readonly logicalByteLength: number;
    readonly positions: readonly number[];
    readonly uvs: readonly number[];
    readonly lightColors: readonly number[];
    readonly darkColors: readonly number[];
    readonly indices: readonly number[];
}

// Capture normal-realm intrinsics before descriptor callbacks can replace them.
// Admission and copying do not read instance properties, iterators or species.
const Floats32 = Float32Array;
const Floats64 = Float64Array;
const Indices16 = Uint16Array;
const Indices32 = Uint32Array;
const Bytes = Uint8Array;
const Numbers = Array;
const apply = Reflect.apply;
const freeze = Object.freeze;
const defineProperty = Object.defineProperty;
const TypeFault = TypeError;
const RangeFault = RangeError;
const finite = Number.isFinite;
const integer = Number.isInteger;
const safeInteger = Number.isSafeInteger;
const fround = Math.fround;
const abs = Math.abs;
const typedArrayPrototype = Object.getPrototypeOf(Bytes.prototype);
const tagGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)!.get!;
const bufferGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer')!.get!;
const offsetGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteOffset')!.get!;
const lengthGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength')!.get!;
const bufferLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const resizableGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const detachedGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'detached')?.get;
const setElements = typedArrayPrototype.set;
const weakHas = WeakMap.prototype.has;
const weakSet = WeakMap.prototype.set;
const owned = new WeakMap<object, true>();

type FloatTag = 'Float32Array' | 'Float64Array';
type IndexTag = 'Uint16Array' | 'Uint32Array';
type PayloadTag = FloatTag | IndexTag;
type Payload = SharedFloatArray2D | SharedIndexArray2D;

function read(source: object, key: string): unknown {
    try { return (source as Record<string, unknown>)[key]; }
    catch (cause) { throw new TypeFault('Shared geometry descriptor read failed', { cause }); }
}
function floatBrand(value: unknown): FloatTag {
    const tag: unknown = apply(tagGetter, value, []);
    if (tag !== 'Float32Array' && tag !== 'Float64Array') throw new TypeFault('Shared geometry array brand is unsupported');
    return tag;
}
function indexBrand(value: unknown): IndexTag {
    const tag: unknown = apply(tagGetter, value, []);
    if (tag !== 'Uint16Array' && tag !== 'Uint32Array') throw new TypeFault('Shared geometry array brand is unsupported');
    return tag;
}
function elementLength(value: unknown, tag: PayloadTag): number {
    const backing = apply(bufferGetter, value, []) as ArrayBuffer;
    // This captured getter rejects SharedArrayBuffer, including cross realm.
    // Native intrinsic faults escape intact rather than becoming policy errors.
    apply(bufferLengthGetter, backing, []);
    if (resizableGetter && apply(resizableGetter, backing, [])) throw new TypeFault('Shared geometry backing is unsupported');
    if (detachedGetter) {
        if (apply(detachedGetter, backing, [])) throw new TypeFault('Shared geometry backing is unsupported');
    } else {
        // Reuse the established zero-length attachment check for older realms.
        new Bytes(backing, 0, 0);
    }
    apply(offsetGetter, value, []);
    const byteLength: number = apply(lengthGetter, value, []);
    const elementBytes = tag === 'Float64Array' ? 8 : tag === 'Uint16Array' ? 2 : 4;
    return byteLength / elementBytes;
}
function copyPayload(source: unknown, tag: PayloadTag, length: number): Payload {
    const copy = tag === 'Float32Array' ? new Floats32(length) :
        tag === 'Float64Array' ? new Floats64(length) :
        tag === 'Uint16Array' ? new Indices16(length) : new Indices32(length);
    // Native allocation/copy failures escape. TypedArray set reads only the
    // intrinsic used range and cannot invoke the caller's iterator or species.
    apply(setElements, copy, [source]);
    return copy;
}
function canonical(source: Payload, length: number, kind: 'position' | 'uv' | 'unit' | 'index', vertexCount: number): readonly number[] {
    const result = new Numbers<number>(length);
    for (let index = 0; index < length; index++) {
        const value = source[index]!;
        if (!finite(value) ||
            (kind === 'unit' && (value < 0 || value > 1)) ||
            (kind === 'index' && (!integer(value) || value < 0 || value >= vertexCount))) {
            throw new RangeFault('Shared geometry numeric range is invalid');
        }
        // New floating payloads are f32-roundtrip Numbers. This is a declared
        // canonical input representation, not a GPU interpolation error bound.
        const rounded = kind === 'index' ? value : fround(value);
        if (!finite(rounded) || (kind === 'uv' && abs(rounded) > 1048576)) {
            throw new RangeFault('Shared geometry numeric range is invalid');
        }
        // Create own elements rather than invoking an inherited indexed setter.
        // A null-prototype descriptor also excludes inherited get/set fields.
        // Equality with zero converts both signed zeros to positive zero.
        const descriptor = { __proto__: null, value: rounded === 0 ? 0 : rounded,
            writable: true, enumerable: true, configurable: true };
        defineProperty(result, index, descriptor);
    }
    return freeze(result);
}

export function createSharedGeometry2D(input: SharedGeometryInput2D): SharedGeometry2D {
    if (typeof input !== 'object' || input === null) throw new TypeFault('Shared geometry descriptor must be an object');
    // G1: finish all successful ordered reads before examining any field.
    // Local staging makes descriptor reentry independent of this invocation.
    const positionsInput = read(input, 'positions');
    const uvsInput = read(input, 'uvs');
    const lightColorsInput = read(input, 'lightColors');
    const darkColorsInput = read(input, 'darkColors');
    const indicesInput = read(input, 'indices');
    // G2 must finish for every field before G3 touches the first backing.
    const positionsTag = floatBrand(positionsInput);
    const uvsTag = floatBrand(uvsInput);
    const lightColorsTag = floatBrand(lightColorsInput);
    const darkColorsTag = floatBrand(darkColorsInput);
    const indicesTag = indexBrand(indicesInput);
    const positionsLength = elementLength(positionsInput, positionsTag);
    const uvsLength = elementLength(uvsInput, uvsTag);
    const lightColorsLength = elementLength(lightColorsInput, lightColorsTag);
    const darkColorsLength = elementLength(darkColorsInput, darkColorsTag);
    const indicesLength = elementLength(indicesInput, indicesTag);
    const vertexCount = positionsLength / 2;
    const indexCount = indicesLength;
    // G4: shape outranks capacity; both precede copies and canonical arrays.
    if (!safeInteger(vertexCount) || !safeInteger(indexCount) ||
        uvsLength !== positionsLength || lightColorsLength !== 4 * vertexCount || darkColorsLength !== 3 * vertexCount ||
        !((vertexCount === 0 && indexCount === 0) ||
          (vertexCount >= 3 && indexCount >= 3 && indexCount % 3 === 0))) {
        throw new RangeFault('Shared geometry array shape is invalid');
    }
    const logicalByteLength = 88 * vertexCount + 4 * indexCount;
    if (vertexCount > 65536 || indexCount > 196608 ||
        !safeInteger(logicalByteLength) || logicalByteLength > 4980736) {
        throw new RangeFault('Shared geometry capacity exceeded');
    }
    // G5 capacity above precedes all allocations below. G6 completes all five
    // native copies before G7 examines any copied component.
    const positionsCopy = copyPayload(positionsInput, positionsTag, positionsLength);
    const uvsCopy = copyPayload(uvsInput, uvsTag, uvsLength);
    const lightColorsCopy = copyPayload(lightColorsInput, lightColorsTag, lightColorsLength);
    const darkColorsCopy = copyPayload(darkColorsInput, darkColorsTag, darkColorsLength);
    const indicesCopy = copyPayload(indicesInput, indicesTag, indicesLength);
    const positions = canonical(positionsCopy, positionsLength, 'position', vertexCount);
    const uvs = canonical(uvsCopy, uvsLength, 'uv', vertexCount);
    const lightColors = canonical(lightColorsCopy, lightColorsLength, 'unit', vertexCount);
    const darkColors = canonical(darkColorsCopy, darkColorsLength, 'unit', vertexCount);
    const indices = canonical(indicesCopy, indicesLength, 'index', vertexCount);
    // Logical accounting describes canonical payload units, not physical heap
    // usage or an allocation guarantee. Only the completed frozen value is owned.
    const geometry = freeze({ vertexCount, indexCount, triangleCount: indexCount / 3,
        logicalByteLength, positions, uvs, lightColors, darkColors, indices }) as SharedGeometry2D;
    apply(weakSet, owned, [geometry, true]);
    return geometry;
}

export function isSharedGeometry2D(value: unknown): value is SharedGeometry2D {
    // WeakMap identity performs no property read, even on revoked Proxies.
    return typeof value === 'object' && value !== null && apply(weakHas, owned, [value]);
}
