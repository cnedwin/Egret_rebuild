// SPDX-License-Identifier: Apache-2.0
import { copyImageData2DPixels, IMAGE_LIMITS_2D, isImageData2D } from '@egret/contracts';
import { createMeshGeometry3D } from './meshGeometry3D.js';
import type { MeshGeometry3D } from './meshGeometry3D.js';
import type { ImageData2D } from '@egret/contracts';
import type { SceneDirectionalLighting3D, SceneLambertSurface3D, SceneMeshTexture3D } from './sceneFrame3D.js';
import { createLambertSceneWorld3D, createTexturedSceneWorld3D } from './sceneWorld3D.js';
import type { SceneLambertWorld3D, SceneWorld3D, SceneWorldNodeInput3D } from './sceneWorld3D.js';
import { encodeSharedSRGB } from './sharedColor2D.js';

export type StaticGlb3DErrorCode = 'SCENE3D_GLB_INVALID' | 'SCENE3D_GLB_UNSUPPORTED' | 'SCENE3D_GLB_BUDGET';

export class StaticGlb3DError extends Error {
    constructor(readonly code: StaticGlb3DErrorCode, readonly field: string, cause?: unknown) {
        super(code + ': ' + field, { cause });
        this.name = 'StaticGlb3DError';
    }
}

type Record3D = Record<string, unknown>;
type RGB = readonly [number, number, number];
interface Material { readonly color: RGB; readonly textureIndex?: number; }

export interface StaticGlbTexturePrimitive3D {
    readonly geometry: MeshGeometry3D;
    readonly imageIndex: number;
    readonly texcoords: readonly number[];
}
export interface StaticGlbPngImage3D {
    readonly imageIndex: number;
    readonly width: number;
    readonly height: number;
    readonly byteLength: number;
    copyBytes(): Uint8Array<ArrayBuffer>;
}
export interface StaticGlbTexturePlan3D {
    readonly nodes: readonly SceneWorldNodeInput3D[];
    readonly primitives: readonly StaticGlbTexturePrimitive3D[];
    readonly images: readonly StaticGlbPngImage3D[];
}
interface MaterialPrimitive extends StaticGlbTexturePrimitive3D {
    readonly normals?: readonly number[];
}
interface MaterialPlan extends StaticGlbTexturePlan3D {
    readonly primitives: readonly MaterialPrimitive[];
}
interface PngSource extends Omit<StaticGlbPngImage3D, 'copyBytes'> { readonly offset: number; }
interface TexturePlanBuilder {
    readonly images: readonly PngSource[];
    readonly imageViews: ReadonlySet<number>;
    readonly textureImages: readonly number[];
    readonly primitives: MaterialPrimitive[];
}
interface Payload {
    readonly gltf: Record3D;
    readonly binary: DataView;
}
interface Accessor {
    readonly count: number;
    readonly offset: number;
    readonly component: number;
    readonly stride: number;
}

const MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const FLOAT = 5126;
const SHORT = 5123;
const INT = 5125;
const UNLIT = 'KHR_materials_unlit';
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_JSON = 512 * 1024;
const MAX_NODES = 64;
const MAX_ACCESSORS = 192;
const MIN_NORMAL_FLOAT = 1.1754943508222875e-38;
const MAX_UV_MAGNITUDE = 2 ** 20;
const NORMAL_LENGTH_SQUARED_TOLERANCE = 1e-4;
const MAX_PNG_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_PNG_BYTES = 6 * 1024 * 1024;
const MAX_TOTAL_PNG_PIXELS = 4 * IMAGE_LIMITS_2D.maxSourcePixels;
const MAX_PNG_CHUNKS = 1024;
const PNG_IHDR = 0x49484452, PNG_IDAT = 0x49444154, PNG_IEND = 0x49454e44;
const PNG_SRGB = 0x73524742, PNG_GAMA = 0x67414d41, PNG_CHRM = 0x6348524d;
const SRGB_CHROMATICITY = [31270, 32900, 64000, 33000, 30000, 6000, 15000, 6000];

// Intrinsic access also accepts other realms and ignores instance metadata.
const apply = Reflect.apply;
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const tagGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)!.get!;
const bufferGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer')!.get!;
const offsetGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteOffset')!.get!;
const lengthGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength')!.get!;
const bufferLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const resizableGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;

function invalid(field: string, cause?: unknown): never {
    throw new StaticGlb3DError('SCENE3D_GLB_INVALID', field, cause);
}
function unsupported(field: string): never {
    throw new StaticGlb3DError('SCENE3D_GLB_UNSUPPORTED', field);
}
function budget(field: string): never {
    throw new StaticGlb3DError('SCENE3D_GLB_BUDGET', field);
}
function record(value: unknown, field: string): Record3D {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(field);
    return Object.setPrototypeOf(value, null) as Record3D;
}
function list(value: unknown, field: string, limit: number): unknown[] {
    if (!Array.isArray(value) || value.length === 0) invalid(field);
    if (value.length > limit) budget(field);
    return value;
}
function index(value: unknown, maximum: number, field: string): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) invalid(field);
    return value;
}
function fields(value: Record3D, field: string, supported: readonly string[]): void {
    for (const key of Object.keys(value)) if (!supported.includes(key)) unsupported(field + '.' + key);
}
function numbers(value: unknown, length: number, field: string): number[] {
    if (!Array.isArray(value) || value.length !== length ||
        !value.every(component => typeof component === 'number' && Number.isFinite(component))) invalid(field);
    return value;
}

function parseJson(view: DataView, start: number, length: number): Record3D {
    // Decode strict UTF-8 using standard ECMAScript, with no Node or browser dependency.
    const hex = '0123456789abcdef';
    let uri = '';
    for (let offset = start; offset < start + length; offset++) {
        const byte = view.getUint8(offset);
        uri += byte < 128 && byte !== 37 ? String.fromCharCode(byte) : '%' + hex[byte >> 4]! + hex[byte & 15]!;
    }
    let gltf: unknown;
    try { gltf = JSON.parse(decodeURIComponent(uri)); }
    catch (cause) { invalid('JSON chunk', cause); }
    return record(gltf, 'JSON chunk');
}

function readPayload(bytes: Uint8Array): Payload {
    let byteLength: number, byteOffset: number, buffer: ArrayBuffer;
    try {
        if (apply(tagGetter, bytes, []) !== 'Uint8Array') throw new TypeError('Expected intrinsic Uint8Array');
        buffer = apply(bufferGetter, bytes, []) as ArrayBuffer;
        // The ArrayBuffer getter rejects SharedArrayBuffer before any reads.
        apply(bufferLengthGetter, buffer, []);
        if (resizableGetter && apply(resizableGetter, buffer, [])) throw new TypeError('Resizable backing is unsupported');
        byteOffset = apply(offsetGetter, bytes, []);
        byteLength = apply(lengthGetter, bytes, []);
        // Even a zero-length DataView refuses a detached ArrayBuffer.
        new DataView(buffer, byteOffset, 0);
    } catch (cause) { invalid('GLB bytes', cause); }
    if (byteLength > MAX_BYTES) budget('GLB bytes');
    if (byteLength < 28) invalid('GLB header');
    const view = new DataView(buffer, byteOffset, byteLength);
    if (view.getUint32(0, true) !== MAGIC || view.getUint32(8, true) !== byteLength) invalid('GLB header');
    if (view.getUint32(4, true) !== 2) unsupported('GLB version');
    const jsonLength = view.getUint32(12, true);
    if (jsonLength === 0 || jsonLength % 4 !== 0 || jsonLength > byteLength - 28 ||
        view.getUint32(16, true) !== JSON_CHUNK) invalid('JSON chunk');
    if (jsonLength > MAX_JSON) budget('JSON chunk');
    const binStart = 20 + jsonLength;
    const binLength = view.getUint32(binStart, true);
    if (binLength === 0 || binLength % 4 !== 0 || binLength !== byteLength - binStart - 8 ||
        view.getUint32(binStart + 4, true) !== BIN_CHUNK) invalid('BIN chunk');
    const gltf = parseJson(view, 20, jsonLength);
    const buffers = list(gltf.buffers, 'buffers', 1);
    const definition = record(buffers[0], 'buffers[0]');
    fields(definition, 'buffers[0]', ['byteLength', 'name', 'extras']);
    const length = index(definition.byteLength, binLength, 'buffers[0].byteLength');
    if (binLength - length > 3) invalid('BIN padding');
    for (let padding = length; padding < binLength; padding++) {
        if (view.getUint8(binStart + 8 + padding) !== 0) invalid('BIN padding');
    }
    return { gltf, binary: new DataView(buffer, byteOffset + binStart + 8, length) };
}

function readExtensions(value: unknown, field: string): void {
    if (value === undefined) return;
    if (!Array.isArray(value) || value.length === 0) invalid(field);
    if (value.length !== 1 || value[0] !== UNLIT) unsupported(field);
}

/** Inspect framing and the opaque color profile in place. Native decode owns the IDAT stream. */
function inspectEmbeddedPng(binary: DataView, offset: number, byteLength: number): { width: number; height: number } {
    if (byteLength < 33 || binary.getUint32(offset) !== 0x89504e47 || binary.getUint32(offset + 4) !== 0x0d0a1a0a ||
        binary.getUint32(offset + 8) !== 13 || binary.getUint32(offset + 12) !== PNG_IHDR) invalid('image PNG header');
    const width = binary.getUint32(offset + 16), height = binary.getUint32(offset + 20);
    if (width === 0 || height === 0) invalid('image PNG dimensions');
    if (width > IMAGE_LIMITS_2D.maxSourceEdge || height > IMAGE_LIMITS_2D.maxSourceEdge ||
        width * height > IMAGE_LIMITS_2D.maxSourcePixels) budget('image PNG dimensions');
    if (binary.getUint8(offset + 24) !== 8 || binary.getUint8(offset + 25) !== 2 ||
        binary.getUint8(offset + 26) !== 0 || binary.getUint8(offset + 27) !== 0 ||
        binary.getUint8(offset + 28) !== 0) unsupported('image PNG RGB8 noninterlaced');

    const end = offset + byteLength, metadata = new Set<number>();
    let idatBytes = 0, idatStarted = false, chunkCount = 1, cursor = offset + 33;
    while (cursor < end) {
        if (++chunkCount > MAX_PNG_CHUNKS) budget('image PNG chunks');
        if (end - cursor < 12) invalid('image PNG chunk framing');
        const size = binary.getUint32(cursor), tag = binary.getUint32(cursor + 4), data = cursor + 8;
        if (size > end - cursor - 12) invalid('image PNG chunk range');
        cursor += size + 12;
        if (tag === PNG_IDAT) {
            idatBytes += size;
            idatStarted = true;
            continue;
        }
        if (tag === PNG_IEND) {
            if (size !== 0 || cursor !== end || idatBytes === 0) invalid('image PNG IEND');
            if ((metadata.has(PNG_GAMA) || metadata.has(PNG_CHRM)) && !metadata.has(PNG_SRGB)) unsupported('image PNG color space');
            return { width, height };
        }
        if (tag === PNG_IHDR) invalid('image PNG duplicate IHDR');
        if (tag !== PNG_SRGB && tag !== PNG_GAMA && tag !== PNG_CHRM) unsupported('image PNG chunk profile');
        const expected = tag === PNG_SRGB ? 1 : tag === PNG_GAMA ? 4 : 32;
        if (size !== expected || idatStarted || metadata.has(tag)) invalid('image PNG color metadata');
        if (tag === PNG_SRGB && binary.getUint8(data) > 3 || tag === PNG_GAMA && binary.getUint32(data) !== 45455 ||
            tag === PNG_CHRM && SRGB_CHROMATICITY.some((value, index) => binary.getUint32(data + index * 4) !== value)) {
            unsupported('image PNG color space');
        }
        metadata.add(tag);
    }
    invalid('image PNG IEND');
}

function readTextureSources(gltf: Record3D, views: readonly unknown[], binary: DataView): TexturePlanBuilder {
    const samplers = gltf.samplers === undefined ? [] : list(gltf.samplers, 'samplers', MAX_NODES);
    for (const row of samplers) {
        const sampler = record(row, 'sampler');
        fields(sampler, 'sampler', ['name', 'extras', 'magFilter', 'minFilter', 'wrapS', 'wrapT']);
        // Missing glTF samplers default to repeat and automatic filtering, outside this profile.
        if (sampler.magFilter !== 9728 || sampler.minFilter !== 9728 || sampler.wrapS !== 33071 || sampler.wrapT !== 33071) {
            unsupported('sampler nearest clamp');
        }
    }
    const imageDefinitions = list(gltf.images, 'images', MAX_NODES);
    const textureImages = list(gltf.textures, 'textures', MAX_NODES).map(row => {
        const texture = record(row, 'texture');
        fields(texture, 'texture', ['name', 'extras', 'sampler', 'source']);
        if (texture.sampler === undefined) unsupported('texture default sampler');
        index(texture.sampler, samplers.length - 1, 'texture.sampler');
        return index(texture.source, imageDefinitions.length - 1, 'texture.source');
    });
    let encoded = 0, pixels = 0;
    const imageViews = new Set<number>();
    const images = imageDefinitions.map((row, imageIndex) => {
        const image = record(row, 'image');
        fields(image, 'image', ['name', 'extras', 'bufferView', 'mimeType']);
        if (image.mimeType !== 'image/png') unsupported('image MIME type');
        const viewIndex = index(image.bufferView, views.length - 1, 'image.bufferView');
        imageViews.add(viewIndex);
        const view = record(views[viewIndex], 'image bufferView');
        fields(view, 'image bufferView', ['buffer', 'byteOffset', 'byteLength', 'name', 'extras']);
        if (view.buffer !== 0) invalid('image bufferView.buffer');
        const offset = index(view.byteOffset === undefined ? 0 : view.byteOffset, binary.byteLength, 'image bufferView.byteOffset');
        const byteLength = index(view.byteLength, binary.byteLength - offset, 'image bufferView.byteLength');
        if (byteLength > MAX_PNG_BYTES) budget('image PNG bytes');
        encoded += byteLength;
        if (encoded > MAX_TOTAL_PNG_BYTES) budget('total image PNG bytes');
        const { width, height } = inspectEmbeddedPng(binary, offset, byteLength);
        pixels += width * height;
        if (pixels > MAX_TOTAL_PNG_PIXELS) budget('total image PNG pixels');
        return { imageIndex, offset, byteLength, width, height };
    });
    return { images, imageViews, textureImages, primitives: [] };
}

function readMaterial(value: unknown, textureCount: number | undefined): Material {
    const material = record(value, 'material');
    fields(material, 'material', ['name', 'extras', 'doubleSided', 'alphaMode', 'extensions', 'pbrMetallicRoughness']);
    if (material.doubleSided !== true) unsupported('material.doubleSided');
    if (material.alphaMode !== undefined && material.alphaMode !== 'OPAQUE') unsupported('material.alphaMode');
    if (material.extensions === undefined) unsupported('material.KHR_materials_unlit');
    const extensions = record(material.extensions, 'material.extensions');
    fields(extensions, 'material.extensions', [UNLIT]);
    if (extensions[UNLIT] === undefined) unsupported('material.KHR_materials_unlit');
    fields(record(extensions[UNLIT], 'material.KHR_materials_unlit'), 'material.KHR_materials_unlit', []);
    if (material.pbrMetallicRoughness === undefined) return { color: [1, 1, 1] };
    const factors = record(material.pbrMetallicRoughness, 'material.pbrMetallicRoughness');
    const allowed = ['baseColorFactor', 'metallicFactor', 'roughnessFactor', 'extras'];
    if (textureCount !== undefined) allowed.push('baseColorTexture');
    fields(factors, 'material.pbrMetallicRoughness', allowed);
    for (const key of ['metallicFactor', 'roughnessFactor']) {
        const factor = factors[key];
        if (factor !== undefined && (typeof factor !== 'number' || !Number.isFinite(factor) || factor < 0 || factor > 1)) {
            invalid('material.' + key);
        }
    }
    const color = factors.baseColorFactor === undefined ? [1, 1, 1, 1] :
        numbers(factors.baseColorFactor, 4, 'material.baseColorFactor');
    if (color.some(component => component < 0 || component > 1)) invalid('material.baseColorFactor');
    // OPAQUE ignores the source alpha; the retained scene pipeline always writes alpha 1.
    const rgb: RGB = [color[0]!, color[1]!, color[2]!];
    if (factors.baseColorTexture === undefined) return { color: rgb };
    const texture = record(factors.baseColorTexture, 'material.baseColorTexture');
    fields(texture, 'material.baseColorTexture', ['index', 'texCoord', 'extras']);
    if (texture.texCoord !== undefined && texture.texCoord !== 0) unsupported('material.baseColorTexture.texCoord');
    return { color: rgb, textureIndex: index(texture.index, textureCount! - 1, 'material.baseColorTexture.index') };
}

function readAccessor(
    raw: unknown, views: readonly unknown[], binary: DataView,
    type: 'VEC2' | 'VEC3' | 'SCALAR', imageViews?: ReadonlySet<number>,
): Accessor {
    const accessor = record(raw, 'accessor');
    fields(accessor, 'accessor', ['bufferView', 'byteOffset', 'componentType', 'count', 'type', 'normalized', 'min', 'max', 'name', 'extras']);
    const component = accessor.componentType;
    const vertex = type !== 'SCALAR';
    if (accessor.type !== type || (vertex ? component !== FLOAT : component !== SHORT && component !== INT)) unsupported('accessor format');
    if (accessor.normalized !== undefined && accessor.normalized !== false) unsupported('accessor.normalized');
    const size = component === SHORT ? 2 : 4;
    const stride = vertex ? (type === 'VEC2' ? 8 : 12) : size;
    const count = index(accessor.count, Number.MAX_SAFE_INTEGER, 'accessor.count');
    if (count < 3) invalid('accessor.count');
    if (count > (vertex ? 65536 : 196608)) budget('accessor.count');
    const viewIndex = index(accessor.bufferView, views.length - 1, 'accessor.bufferView');
    if (imageViews?.has(viewIndex)) invalid('bufferView used by image and accessor');
    const view = record(views[viewIndex], 'bufferView');
    fields(view, 'bufferView', ['buffer', 'byteOffset', 'byteLength', 'byteStride', 'target', 'name', 'extras']);
    if (view.buffer !== 0) invalid('bufferView.buffer');
    if (view.byteStride !== undefined && (!vertex || view.byteStride !== stride)) unsupported('bufferView.byteStride');
    if (view.target !== undefined && view.target !== (vertex ? 34962 : 34963)) invalid('bufferView.target');
    // Preserve the legacy reader's offset defaults. The new profile rejects an explicit null.
    if (imageViews && (view.byteOffset === null || accessor.byteOffset === null)) invalid('accessor byte offset');
    const start = index(view.byteOffset ?? 0, binary.byteLength, 'bufferView.byteOffset');
    const length = index(view.byteLength, binary.byteLength - start, 'bufferView.byteLength');
    const relative = index(accessor.byteOffset ?? 0, length, 'accessor.byteOffset');
    if (relative % size !== 0 || (start + relative) % size !== 0 ||
        (vertex && relative % 4 !== 0) || count > Math.floor((length - relative) / stride)) invalid('accessor byte range');
    return { count, offset: start + relative, component: component as number, stride };
}

function position(value: number): number {
    if (!Number.isFinite(value) || (value !== 0 && Math.abs(value) < MIN_NORMAL_FLOAT)) invalid('POSITION binary32');
    return value === 0 ? 0 : value;
}
function channel(value: number): number {
    if (!Number.isFinite(value) || value < 0 || value > 1) invalid('COLOR_0 range');
    return value;
}

function readTexcoords(definition: Record3D, uv: Accessor, binary: DataView): readonly number[] {
    const coords: number[] = [], minimum = [Infinity, Infinity], maximum = [-Infinity, -Infinity];
    for (let vertex = 0; vertex < uv.count; vertex++) for (let axis = 0; axis < 2; axis++) {
        const value = binary.getFloat32(uv.offset + vertex * uv.stride + axis * 4, true);
        if (!Number.isFinite(value) || Math.abs(value) > MAX_UV_MAGNITUDE ||
            (value !== 0 && Math.abs(value) < MIN_NORMAL_FLOAT)) invalid('TEXCOORD_0 binary32');
        coords.push(value === 0 ? 0 : value);
        minimum[axis] = Math.min(minimum[axis]!, value);
        maximum[axis] = Math.max(maximum[axis]!, value);
    }
    for (const [key, bound] of [['min', minimum], ['max', maximum]] as const) {
        if (definition[key] === undefined) continue;
        const declared = numbers(definition[key], 2, 'TEXCOORD_0 ' + key).map(Math.fround);
        if (declared.some((value, axis) => value !== bound[axis])) invalid('TEXCOORD_0 bounds');
    }
    return Object.freeze(coords);
}

function readNormals(definition: Record3D, accessor: Accessor, binary: DataView): readonly number[] {
    const normals: number[] = [], minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
    for (let vertex = 0; vertex < accessor.count; vertex++) {
        let lengthSquared = 0;
        for (let axis = 0; axis < 3; axis++) {
            const value = binary.getFloat32(accessor.offset + vertex * accessor.stride + axis * 4, true);
            if (!Number.isFinite(value) || (value !== 0 && Math.abs(value) < MIN_NORMAL_FLOAT)) invalid('NORMAL binary32');
            normals.push(value === 0 ? 0 : value);
            minimum[axis] = Math.min(minimum[axis]!, value);
            maximum[axis] = Math.max(maximum[axis]!, value);
            lengthSquared += value * value;
        }
        if (Math.abs(lengthSquared - 1) > NORMAL_LENGTH_SQUARED_TOLERANCE) invalid('NORMAL unit length');
    }
    for (const [key, bound] of [['min', minimum], ['max', maximum]] as const) {
        if (definition[key] === undefined) continue;
        const declared = numbers(definition[key], 3, 'NORMAL ' + key).map(Math.fround);
        if (declared.some((value, axis) => value !== bound[axis])) invalid('NORMAL bounds');
    }
    return Object.freeze(normals);
}

function readGeometry(
    primitive: Record3D, accessors: readonly unknown[], views: readonly unknown[],
    binary: DataView, materials: readonly Material[], charge: (vertices: number, indices: number, components: number) => void,
    textures: TexturePlanBuilder | undefined, lambert: boolean,
): MeshGeometry3D {
    fields(primitive, 'mesh primitive', ['attributes', 'indices', 'material', 'mode', 'extras']);
    if (primitive.mode !== undefined && primitive.mode !== 4) unsupported('mesh primitive.mode');
    if (primitive.indices === undefined) unsupported('non-indexed primitive');
    const attributes = record(primitive.attributes, 'mesh primitive.attributes');
    const allowedAttributes = ['POSITION', 'COLOR_0'];
    if (textures) allowedAttributes.push('TEXCOORD_0');
    if (lambert) allowedAttributes.push('NORMAL');
    fields(attributes, 'mesh primitive.attributes', allowedAttributes);
    const { color: factor, textureIndex } = materials[index(primitive.material, materials.length - 1, 'mesh primitive.material')]!;
    const positionDefinition = record(accessors[index(attributes.POSITION, accessors.length - 1, 'POSITION accessor')], 'POSITION accessor');
    const positions = readAccessor(positionDefinition, views, binary, 'VEC3', textures?.imageViews);
    const declaredMin = numbers(positionDefinition.min, 3, 'POSITION min').map(Math.fround);
    const declaredMax = numbers(positionDefinition.max, 3, 'POSITION max').map(Math.fround);
    const indices = readAccessor(accessors[index(primitive.indices, accessors.length - 1, 'index accessor')], views, binary, 'SCALAR', textures?.imageViews);
    const colors = attributes.COLOR_0 === undefined ? undefined :
        readAccessor(accessors[index(attributes.COLOR_0, accessors.length - 1, 'COLOR_0 accessor')], views, binary, 'VEC3', textures?.imageViews);
    if (indices.count % 3 !== 0 || (colors !== undefined && colors.count !== positions.count)) invalid('primitive counts');
    if (attributes.TEXCOORD_0 !== undefined && textureIndex === undefined) unsupported('unused TEXCOORD_0');
    const uvDefinition = textureIndex === undefined ? undefined :
        record(accessors[index(attributes.TEXCOORD_0, accessors.length - 1, 'TEXCOORD_0 accessor')], 'TEXCOORD_0 accessor');
    const uv = uvDefinition === undefined ? undefined : readAccessor(uvDefinition, views, binary, 'VEC2', textures!.imageViews);
    if (uv !== undefined && uv.count !== positions.count) invalid('TEXCOORD_0 count');
    // Only the explicit Lambert profile can use glTF normals. Untextured primitives remain unlit.
    if (lambert && textureIndex !== undefined && attributes.NORMAL === undefined) unsupported('Lambert primitive requires NORMAL');
    if (attributes.NORMAL !== undefined && textureIndex === undefined) unsupported('unused NORMAL');
    const normalDefinition = attributes.NORMAL === undefined ? undefined :
        record(accessors[index(attributes.NORMAL, accessors.length - 1, 'NORMAL accessor')], 'NORMAL accessor');
    const normal = normalDefinition === undefined ? undefined : readAccessor(normalDefinition, views, binary, 'VEC3', textures!.imageViews);
    if (normal !== undefined && normal.count !== positions.count) invalid('NORMAL count');
    // Account for every retained stream before reading any geometry payloads.
    charge(positions.count, indices.count, 6 + (uv ? 2 : 0) + (normal ? 3 : 0));
    const xyz: number[] = [];
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    const rgb: number[] = [];
    for (let vertex = 0; vertex < positions.count; vertex++) {
        for (let component = 0; component < 3; component++) {
            const byte = 4 * component;
            const value = position(binary.getFloat32(positions.offset + positions.stride * vertex + byte, true));
            xyz.push(value);
            min[component] = Math.min(min[component]!, value);
            max[component] = Math.max(max[component]!, value);
            const tint = colors === undefined ? 1 : channel(binary.getFloat32(colors.offset + colors.stride * vertex + byte, true));
            // glTF factors/vertex RGB are linear. The legacy mesh packer decodes authored sRGB.
            const encoded = Math.fround(encodeSharedSRGB(tint * factor[component]!));
            if (encoded !== 0 && encoded < MIN_NORMAL_FLOAT) unsupported('COLOR_0 binary32');
            rgb.push(encoded);
        }
    }
    if (min.some((value, component) => value !== declaredMin[component] || max[component] !== declaredMax[component])) {
        invalid('POSITION bounds');
    }
    const triangles: number[] = [];
    for (let item = 0; item < indices.count; item++) {
        const offset = indices.offset + indices.stride * item;
        const value = indices.component === SHORT ? binary.getUint16(offset, true) : binary.getUint32(offset, true);
        if (value >= positions.count || value === (indices.component === SHORT ? 0xffff : 0xffffffff)) invalid('primitive index');
        triangles.push(value);
    }
    const texcoords = uv === undefined ? undefined : readTexcoords(uvDefinition!, uv, binary);
    const normals = normal === undefined ? undefined : readNormals(normalDefinition!, normal, binary);
    const geometry = createMeshGeometry3D({ positions: xyz, colors: rgb, indices: triangles });
    if (textureIndex !== undefined) textures!.primitives.push(Object.freeze({
        geometry, imageIndex: textures!.textureImages[textureIndex]!, texcoords: texcoords!,
        ...(normals === undefined ? {} : { normals }),
    }));
    return geometry;
}

function matrixFor(node: Record3D): number[] {
    if (node.matrix !== undefined) {
        if (node.translation !== undefined || node.rotation !== undefined || node.scale !== undefined) invalid('node.matrix/TRS');
        const values = numbers(node.matrix, 16, 'node.matrix');
        if (values[3] !== 0 || values[7] !== 0 || values[11] !== 0 || values[15] !== 1) invalid('node.matrix affine');
        // glTF matrices are TRS-decomposable. Reject shear without changing authoring-space units.
        for (const [a, b] of [[0, 4], [0, 8], [4, 8]] as const) {
            const span = Math.hypot(values[a]!, values[a + 1]!, values[a + 2]!) *
                Math.hypot(values[b]!, values[b + 1]!, values[b + 2]!);
            const dot = values[a]! * values[b]! + values[a + 1]! * values[b + 1]! + values[a + 2]! * values[b + 2]!;
            if (!Number.isFinite(span) || !Number.isFinite(dot) || Math.abs(dot) > 1e-6 * span) invalid('node.matrix shear');
        }
        return values;
    }
    const [tx, ty, tz] = node.translation === undefined ? [0, 0, 0] : numbers(node.translation, 3, 'node.translation');
    const [sx, sy, sz] = node.scale === undefined ? [1, 1, 1] : numbers(node.scale, 3, 'node.scale');
    const q = node.rotation === undefined ? [0, 0, 0, 1] : numbers(node.rotation, 4, 'node.rotation');
    const norm = Math.hypot(...q);
    if (Math.abs(norm - 1) > 1e-5) invalid('node.rotation unit quaternion');
    const x = q[0]! / norm, y = q[1]! / norm, z = q[2]! / norm, w = q[3]! / norm;
    const xx = 2 * x * x, yy = 2 * y * y, zz = 2 * z * z;
    const xy = 2 * x * y, xz = 2 * x * z, yz = 2 * y * z;
    const xw = 2 * x * w, yw = 2 * y * w, zw = 2 * z * w;
    // Column-major T * R * S. Parent composition is owned by SceneWorld3D.
    return [
        (1 - yy - zz) * sx!, (xy + zw) * sx!, (xz - yw) * sx!, 0,
        (xy - zw) * sy!, (1 - xx - zz) * sy!, (yz + xw) * sy!, 0,
        (xz + yw) * sz!, (yz - xw) * sz!, (1 - xx - yy) * sz!, 0,
        tx!, ty!, tz!, 1,
    ];
}

/** Bounded GLB subset, independent of transport, model lifetime, and native graphics. */
export function readStaticGlbNodes3D(bytes: Uint8Array): readonly SceneWorldNodeInput3D[] {
    return readStaticGlb(bytes, false);
}

/** Validate the complete model before publishing owned texture requests and geometry. */
export function readStaticGlbTexturePlan3D(bytes: Uint8Array): StaticGlbTexturePlan3D {
    return readStaticGlb(bytes, true);
}

function readStaticGlb(bytes: Uint8Array, textured: false): readonly SceneWorldNodeInput3D[];
function readStaticGlb(bytes: Uint8Array, textured: true, lambert?: boolean): MaterialPlan;
function readStaticGlb(bytes: Uint8Array, textured: boolean, lambert = false): readonly SceneWorldNodeInput3D[] | MaterialPlan {
    const { gltf, binary } = readPayload(bytes);
    const allowed = ['asset', 'extras', 'extensionsUsed', 'extensionsRequired', 'buffers', 'bufferViews',
        'accessors', 'materials', 'meshes', 'nodes', 'scenes', 'scene'];
    if (textured) allowed.push('images', 'textures', 'samplers');
    fields(gltf, 'glTF', allowed);
    const asset = record(gltf.asset, 'asset');
    if (asset.version !== '2.0' || (asset.minVersion !== undefined && asset.minVersion !== '2.0')) unsupported('asset.version');
    if (gltf.extensionsUsed === undefined) invalid('extensionsUsed');
    readExtensions(gltf.extensionsUsed, 'extensionsUsed');
    readExtensions(gltf.extensionsRequired, 'extensionsRequired');
    const views = list(gltf.bufferViews, 'bufferViews', MAX_ACCESSORS);
    const accessors = list(gltf.accessors, 'accessors', MAX_ACCESSORS);
    const textures = textured ? readTextureSources(gltf, views, binary) : undefined;
    const materials = list(gltf.materials, 'materials', MAX_NODES).map(row => readMaterial(row, textures?.textureImages.length));
    const meshes = list(gltf.meshes, 'meshes', MAX_NODES);
    const nodes = list(gltf.nodes, 'nodes', MAX_NODES);
    const scenes = list(gltf.scenes, 'scenes', 1);
    if (gltf.scene !== undefined && gltf.scene !== 0) invalid('scene');
    const scene = record(scenes[0], 'scene');
    fields(scene, 'scene', ['nodes', 'name', 'extras']);
    const roots = list(scene.nodes, 'scene.nodes', MAX_NODES);

    let cpuBytes = 0, packedBytes = 0, geometryCount = 0, drawCount = 0;
    function charge(vertices: number, indices: number, components: number): void {
        const cpu = 8 * (components * vertices + indices);
        cpuBytes += cpu;
        packedBytes += 4 * (components * vertices + indices);
        if (++geometryCount > MAX_NODES || cpu > 4194304 || cpuBytes > 8388608 || packedBytes > 4194304) budget('scene geometry');
    }
    const byMesh = new Map<number, readonly MeshGeometry3D[]>();
    const seen = new Set<number>();
    const result: SceneWorldNodeInput3D[] = [];
    function visit(rawIndex: unknown, parentId?: string): void {
        const nodeIndex = index(rawIndex, nodes.length - 1, 'scene node index');
        if (seen.has(nodeIndex)) invalid('scene node has multiple parents or a cycle');
        seen.add(nodeIndex);
        const id = 'gltf-node-' + nodeIndex;
        const node = record(nodes[nodeIndex], 'node');
        fields(node, 'node', ['mesh', 'children', 'matrix', 'translation', 'rotation', 'scale', 'name', 'extras']);
        const localMatrix = matrixFor(node);
        let geometry: readonly MeshGeometry3D[] | undefined;
        if (node.mesh !== undefined) {
            const meshIndex = index(node.mesh, meshes.length - 1, 'node.mesh');
            geometry = byMesh.get(meshIndex);
            if (geometry === undefined) {
                const mesh = record(meshes[meshIndex], 'mesh');
                fields(mesh, 'mesh', ['primitives', 'name', 'extras']);
                geometry = list(mesh.primitives, 'mesh.primitives', MAX_NODES)
                    .map(primitive => readGeometry(record(primitive, 'mesh primitive'), accessors, views, binary, materials, charge, textures, lambert));
                if (textured) Object.freeze(geometry);
                byMesh.set(meshIndex, geometry);
            }
            drawCount += geometry.length;
            if (drawCount > MAX_NODES) budget('scene draw count');
        }
        const output = { id, localMatrix, ...(parentId === undefined ? {} : { parentId }),
            ...(geometry === undefined ? {} : { meshes: geometry }) };
        if (textured) { Object.freeze(localMatrix); Object.freeze(output); }
        result.push(output);
        if (node.children !== undefined) {
            for (const child of list(node.children, 'node.children', MAX_NODES)) visit(child, id);
        }
    }
    for (const root of roots) visit(root);
    if (seen.size !== nodes.length || byMesh.size !== meshes.length || drawCount === 0) unsupported('scene must include all nodes and meshes');
    if (textures === undefined) return result;
    if (textures.primitives.length === 0) unsupported('scene must include a textured primitive');
    const used = new Set(textures.primitives.map(primitive => primitive.imageIndex));
    // Delay each byte copy until the whole GLB and aggregate budgets are accepted.
    const images = textures.images.filter(image => used.has(image.imageIndex)).map(({ offset, ...image }) => {
        const owned = new Uint8Array(image.byteLength);
        owned.set(new Uint8Array(binary.buffer, binary.byteOffset + offset, image.byteLength));
        return Object.freeze({ ...image, copyBytes: () => owned.slice() });
    });
    return Object.freeze({ nodes: Object.freeze(result), primitives: Object.freeze(textures.primitives), images: Object.freeze(images) });
}

export interface StaticGlbImageRequest3D {
    readonly imageIndex: number;
    readonly width: number;
    readonly height: number;
    readonly byteLength: number;
    copyBytes(): Uint8Array<ArrayBuffer>;
}
export interface StaticGlbImageBinding3D {
    readonly imageIndex: number;
    readonly source: ImageData2D;
}
export interface PreparedTexturedStaticGlb3D {
    readonly images: readonly StaticGlbImageRequest3D[];
    bindImages(bindings: readonly StaticGlbImageBinding3D[]): SceneWorld3D;
}

export interface PreparedLambertStaticGlb3D {
    readonly images: readonly StaticGlbImageRequest3D[];
    bindImages(bindings: readonly StaticGlbImageBinding3D[], lighting: SceneDirectionalLighting3D): SceneLambertWorld3D;
}

function bindOpaqueImages(expected: ReadonlyMap<number, StaticGlbImageRequest3D>,
    bindings: readonly StaticGlbImageBinding3D[]): ReadonlyMap<number, ImageData2D> {
    const sources = new Map<number, ImageData2D>();
    const verified = new Set<ImageData2D>();
    try {
        if (!Array.isArray(bindings) || bindings.length !== expected.size) {
            throw new StaticGlb3DError("SCENE3D_GLB_INVALID", "image bindings");
        }
        for (let index = 0; index < expected.size; index++) {
            const binding = bindings[index];
            const imageIndex = binding?.imageIndex;
            const source = binding?.source;
            if (typeof imageIndex !== "number") throw new StaticGlb3DError("SCENE3D_GLB_INVALID", "image binding index");
            const image = expected.get(imageIndex);
            if (!image || sources.has(imageIndex) || !isImageData2D(source)
                || source.width !== image.width || source.height !== image.height) {
                throw new StaticGlb3DError("SCENE3D_GLB_INVALID", "image binding");
            }
            if (!verified.has(source)) {
                // The existing image page premultiplies alpha. Opaque GLB RGB must survive that conversion.
                const pixels = copyImageData2DPixels(source);
                for (let row = 0; row < source.height; row++) {
                    const end = row * source.bytesPerRow + source.width * 4;
                    for (let offset = row * source.bytesPerRow + 3; offset < end; offset += 4) {
                        if (pixels[offset] !== 255) {
                            throw new StaticGlb3DError("SCENE3D_GLB_UNSUPPORTED", "image binding alpha");
                        }
                    }
                }
                verified.add(source);
            }
            sources.set(imageIndex, source);
        }
    } catch (cause) {
        if (cause instanceof StaticGlb3DError) throw cause;
        throw new StaticGlb3DError("SCENE3D_GLB_INVALID", "image bindings", cause);
    }
    return sources;
}

/** A decode plan with no host dependency. Publish only after every opaque image is owned. */
export function prepareTexturedStaticGlbScene3D(bytes: Uint8Array): PreparedTexturedStaticGlb3D {
    const {images, nodes, primitives} = readStaticGlbTexturePlan3D(bytes);
    const expected = new Map(images.map(image => [image.imageIndex, image]));
    return Object.freeze({
        images,
        bindImages(bindings: readonly StaticGlbImageBinding3D[]): SceneWorld3D {
            const sources = bindOpaqueImages(expected, bindings);
            const textures = new Map<MeshGeometry3D, SceneMeshTexture3D>();
            for (const {geometry, imageIndex, texcoords} of primitives) {
                textures.set(geometry, Object.freeze({source: sources.get(imageIndex)!, texcoords}));
            }
            return createTexturedSceneWorld3D(nodes, textures);
        },
    });
}

/** Apply an explicit Egret Lambert override to the admitted GLB unlit texture profile. */
export function prepareLambertStaticGlbScene3D(bytes: Uint8Array): PreparedLambertStaticGlb3D {
    const { images, nodes, primitives } = readStaticGlb(bytes, true, true);
    const expected = new Map(images.map(image => [image.imageIndex, image]));
    return Object.freeze({
        images,
        bindImages(bindings: readonly StaticGlbImageBinding3D[], lighting: SceneDirectionalLighting3D): SceneLambertWorld3D {
            const sources = bindOpaqueImages(expected, bindings);
            const surfaces = new Map<MeshGeometry3D, SceneLambertSurface3D>();
            for (const { geometry, imageIndex, texcoords, normals } of primitives) {
                // Each textured primitive in this plan has already admitted its own normal stream.
                surfaces.set(geometry, Object.freeze({ source: sources.get(imageIndex)!, texcoords, normals: normals! }));
            }
            return createLambertSceneWorld3D(nodes, surfaces, lighting);
        },
    });
}
