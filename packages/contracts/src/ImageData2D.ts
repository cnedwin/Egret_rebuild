declare const imageData2DBrand: unique symbol;

export interface ImageData2DInput {
    readonly width: number;
    readonly height: number;
    readonly pixels: Uint8Array<ArrayBuffer>;
    readonly format?: "rgba8unorm";
    readonly colorSpace?: "srgb";
    readonly alphaMode?: "straight";
    readonly origin?: "top-left";
}
/** Immutable CPU byte identity; the brand conveys no asset or GPU authority. */
export interface ImageData2D {
    readonly [imageData2DBrand]: true;
    readonly width: number;
    readonly height: number;
    readonly bytesPerRow: number;
    readonly byteLength: number;
    readonly format: "rgba8unorm";
    readonly colorSpace: "srgb";
    readonly alphaMode: "straight";
    readonly origin: "top-left";
}
export interface TextureRegion2D {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

// Capture normal-realm intrinsics once. Descriptor code cannot replace the
// validation/copy path with instance getters, iterators, or species callbacks.
const Bytes = Uint8Array;
const apply = Reflect.apply;
const freeze = Object.freeze;
const TypeFault = TypeError;
const RangeFault = RangeError;
const finite = Number.isFinite;
const safeInteger = Number.isSafeInteger;
const typedArrayPrototype = Object.getPrototypeOf(Bytes.prototype);
const tagGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)!.get!;
const bufferGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer')!.get!;
const offsetGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteOffset')!.get!;
const lengthGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength')!.get!;
const bufferLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const resizableGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const detachedGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'detached')?.get;
const setBytes = typedArrayPrototype.set;
const weakHas = WeakMap.prototype.has;
const weakGet = WeakMap.prototype.get;
const weakSet = WeakMap.prototype.set;
const owned = new WeakMap<object, Uint8Array<ArrayBuffer>>();

export const IMAGE_LIMITS_2D = freeze({
    maxSourceEdge: 4096, maxSourcePixels: 1048576,
    maxImagesPerFrame: 64, maxViewsPerFrame: 128,
    maxImageTableBytes: 16777216, maxProjectionBytes: 16777216,
    maxImageScratchBytes: 33554432, maxPendingTextureBytes: 33554432,
} as const);

function read(source: object, key: string): unknown {
    try { return (source as Record<string, unknown>)[key]; }
    catch (cause) { throw new TypeFault('Image descriptor read failed', { cause }); }
}
function dimension(value: unknown): number {
    if (typeof value !== 'number') throw new TypeFault('Image dimension must be numeric');
    if (!finite(value) || !safeInteger(value) || value <= 0) throw new RangeFault('Image dimension must be a positive safe integer');
    return value;
}
function literal(value: unknown, expected: string): void {
    if (value !== undefined && value !== expected) throw new TypeFault('Unsupported image metadata');
}
function cloneBytes(source: Uint8Array<ArrayBuffer>, length: number): Uint8Array<ArrayBuffer> {
    const result = new Bytes(length);
    // Allocation errors escape intact; neither copy route invokes user code.
    apply(setBytes, result, [source]);
    return result;
}

export function createImageData2D(input: ImageData2DInput): ImageData2D {
    if (typeof input !== 'object' || input === null) throw new TypeFault('Image descriptor must be an object');
    // Complete the ordered snapshot before semantic checks. A later throwing
    // getter wins over an earlier malformed field, including during reentry.
    const widthInput = read(input, 'width');
    const heightInput = read(input, 'height');
    const pixels = read(input, 'pixels');
    const format = read(input, 'format');
    const colorSpace = read(input, 'colorSpace');
    const alphaMode = read(input, 'alphaMode');
    const origin = read(input, 'origin');
    const width = dimension(widthInput);
    const height = dimension(heightInput);
    const pixelCount = width * height;
    const bytesPerRow = 4 * width;
    const byteLength = 4 * pixelCount;
    if (width > IMAGE_LIMITS_2D.maxSourceEdge || height > IMAGE_LIMITS_2D.maxSourceEdge ||
        !safeInteger(pixelCount) || pixelCount > IMAGE_LIMITS_2D.maxSourcePixels ||
        !safeInteger(bytesPerRow) || !safeInteger(byteLength)) throw new RangeFault('Image source capacity exceeded');
    literal(format, 'rgba8unorm');
    literal(colorSpace, 'srgb');
    literal(alphaMode, 'straight');
    literal(origin, 'top-left');
    if (apply(tagGetter, pixels, []) !== 'Uint8Array') throw new TypeFault('Image pixels must be intrinsic Uint8Array');
    const backing = apply(bufferGetter, pixels, []) as ArrayBuffer;
    // The ArrayBuffer getter rejects SharedArrayBuffer, including cross realm.
    apply(bufferLengthGetter, backing, []);
    if (resizableGetter && apply(resizableGetter, backing, [])) throw new TypeFault('Resizable image backing is unsupported');
    if (detachedGetter) {
        if (apply(detachedGetter, backing, [])) throw new TypeFault('Detached image backing is unsupported');
    } else {
        // A zero-length intrinsic view still checks attachment in older realms.
        new Bytes(backing, 0, 0);
    }
    apply(offsetGetter, pixels, []);
    if (apply(lengthGetter, pixels, []) !== byteLength) throw new RangeFault('Image pixels must have exact tight byte length');
    const copy = cloneBytes(pixels as Uint8Array<ArrayBuffer>, byteLength);
    const image = freeze({ width, height, bytesPerRow, byteLength, format: 'rgba8unorm', colorSpace: 'srgb', alphaMode: 'straight', origin: 'top-left' }) as ImageData2D;
    apply(weakSet, owned, [image, copy]);
    return image;
}

export function isImageData2D(value: unknown): value is ImageData2D {
    return typeof value === 'object' && value !== null && apply(weakHas, owned, [value]);
}
export function copyImageData2DPixels(image: ImageData2D): Uint8Array<ArrayBuffer> {
    // Identity authentication performs no property reads on forged/proxied values.
    if (!isImageData2D(image)) throw new TypeFault('Image identity is not owned by this module');
    const source = apply(weakGet, owned, [image]) as Uint8Array<ArrayBuffer>;
    return cloneBytes(source, apply(lengthGetter, source, []));
}
