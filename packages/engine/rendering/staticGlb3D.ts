// SPDX-License-Identifier: Apache-2.0
import { createMeshGeometry3D } from './meshGeometry3D.js';
import type { MeshGeometry3D } from './meshGeometry3D.js';
import type { SceneWorldNodeInput3D } from './sceneWorld3D.js';
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

function readMaterial(value: unknown): RGB {
    const material = record(value, 'material');
    fields(material, 'material', ['name', 'extras', 'doubleSided', 'alphaMode', 'extensions', 'pbrMetallicRoughness']);
    if (material.doubleSided !== true) unsupported('material.doubleSided');
    if (material.alphaMode !== undefined && material.alphaMode !== 'OPAQUE') unsupported('material.alphaMode');
    if (material.extensions === undefined) unsupported('material.KHR_materials_unlit');
    const extensions = record(material.extensions, 'material.extensions');
    fields(extensions, 'material.extensions', [UNLIT]);
    if (extensions[UNLIT] === undefined) unsupported('material.KHR_materials_unlit');
    fields(record(extensions[UNLIT], 'material.KHR_materials_unlit'), 'material.KHR_materials_unlit', []);
    if (material.pbrMetallicRoughness === undefined) return [1, 1, 1];
    const factors = record(material.pbrMetallicRoughness, 'material.pbrMetallicRoughness');
    fields(factors, 'material.pbrMetallicRoughness', ['baseColorFactor', 'metallicFactor', 'roughnessFactor', 'extras']);
    for (const key of ['metallicFactor', 'roughnessFactor']) {
        const factor = factors[key];
        if (factor !== undefined && (typeof factor !== 'number' || !Number.isFinite(factor) || factor < 0 || factor > 1)) {
            invalid('material.' + key);
        }
    }
    if (factors.baseColorFactor === undefined) return [1, 1, 1];
    const color = numbers(factors.baseColorFactor, 4, 'material.baseColorFactor');
    if (color.some(component => component < 0 || component > 1)) invalid('material.baseColorFactor');
    // OPAQUE ignores the source alpha; the retained scene pipeline always writes alpha 1.
    return [color[0]!, color[1]!, color[2]!];
}

function readAccessor(raw: unknown, views: readonly unknown[], binary: DataView, vertex: boolean): Accessor {
    const accessor = record(raw, 'accessor');
    fields(accessor, 'accessor', ['bufferView', 'byteOffset', 'componentType', 'count', 'type', 'normalized', 'min', 'max', 'name', 'extras']);
    const component = accessor.componentType;
    if (vertex ? component !== FLOAT || accessor.type !== 'VEC3' :
        (component !== SHORT && component !== INT) || accessor.type !== 'SCALAR') unsupported('accessor format');
    if (accessor.normalized !== undefined && accessor.normalized !== false) unsupported('accessor.normalized');
    const size = component === SHORT ? 2 : 4;
    const stride = vertex ? 12 : size;
    const count = index(accessor.count, Number.MAX_SAFE_INTEGER, 'accessor.count');
    if (count < 3) invalid('accessor.count');
    if (count > (vertex ? 65536 : 196608)) budget('accessor.count');
    const view = record(views[index(accessor.bufferView, views.length - 1, 'accessor.bufferView')], 'bufferView');
    fields(view, 'bufferView', ['buffer', 'byteOffset', 'byteLength', 'byteStride', 'target', 'name', 'extras']);
    if (view.buffer !== 0) invalid('bufferView.buffer');
    if (view.byteStride !== undefined && (!vertex || view.byteStride !== stride)) unsupported('bufferView.byteStride');
    if (view.target !== undefined && view.target !== (vertex ? 34962 : 34963)) invalid('bufferView.target');
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

function readGeometry(
    primitive: Record3D, accessors: readonly unknown[], views: readonly unknown[],
    binary: DataView, materials: readonly RGB[], charge: (vertices: number, indices: number) => void,
): MeshGeometry3D {
    fields(primitive, 'mesh primitive', ['attributes', 'indices', 'material', 'mode', 'extras']);
    if (primitive.mode !== undefined && primitive.mode !== 4) unsupported('mesh primitive.mode');
    if (primitive.indices === undefined) unsupported('non-indexed primitive');
    const attributes = record(primitive.attributes, 'mesh primitive.attributes');
    fields(attributes, 'mesh primitive.attributes', ['POSITION', 'COLOR_0']);
    const factor = materials[index(primitive.material, materials.length - 1, 'mesh primitive.material')]!;
    const positionDefinition = record(accessors[index(attributes.POSITION, accessors.length - 1, 'POSITION accessor')], 'POSITION accessor');
    const positions = readAccessor(positionDefinition, views, binary, true);
    const declaredMin = numbers(positionDefinition.min, 3, 'POSITION min').map(Math.fround);
    const declaredMax = numbers(positionDefinition.max, 3, 'POSITION max').map(Math.fround);
    const indices = readAccessor(accessors[index(primitive.indices, accessors.length - 1, 'index accessor')], views, binary, false);
    const colors = attributes.COLOR_0 === undefined ? undefined :
        readAccessor(accessors[index(attributes.COLOR_0, accessors.length - 1, 'COLOR_0 accessor')], views, binary, true);
    if (indices.count % 3 !== 0 || (colors !== undefined && colors.count !== positions.count)) invalid('primitive counts');
    charge(positions.count, indices.count);
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
    return createMeshGeometry3D({ positions: xyz, colors: rgb, indices: triangles });
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
    const { gltf, binary } = readPayload(bytes);
    fields(gltf, 'glTF', ['asset', 'extras', 'extensionsUsed', 'extensionsRequired', 'buffers', 'bufferViews',
        'accessors', 'materials', 'meshes', 'nodes', 'scenes', 'scene']);
    const asset = record(gltf.asset, 'asset');
    if (asset.version !== '2.0' || (asset.minVersion !== undefined && asset.minVersion !== '2.0')) unsupported('asset.version');
    if (gltf.extensionsUsed === undefined) invalid('extensionsUsed');
    readExtensions(gltf.extensionsUsed, 'extensionsUsed');
    readExtensions(gltf.extensionsRequired, 'extensionsRequired');
    const views = list(gltf.bufferViews, 'bufferViews', MAX_ACCESSORS);
    const accessors = list(gltf.accessors, 'accessors', MAX_ACCESSORS);
    const materials = list(gltf.materials, 'materials', MAX_NODES).map(readMaterial);
    const meshes = list(gltf.meshes, 'meshes', MAX_NODES);
    const nodes = list(gltf.nodes, 'nodes', MAX_NODES);
    const scenes = list(gltf.scenes, 'scenes', 1);
    if (gltf.scene !== undefined && gltf.scene !== 0) invalid('scene');
    const scene = record(scenes[0], 'scene');
    fields(scene, 'scene', ['nodes', 'name', 'extras']);
    const roots = list(scene.nodes, 'scene.nodes', MAX_NODES);

    let cpuBytes = 0, packedBytes = 0, geometryCount = 0, drawCount = 0;
    function charge(vertices: number, indices: number): void {
        const cpu = 8 * (6 * vertices + indices);
        cpuBytes += cpu;
        packedBytes += 24 * vertices + 4 * indices;
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
                    .map(primitive => readGeometry(record(primitive, 'mesh primitive'), accessors, views, binary, materials, charge));
                byMesh.set(meshIndex, geometry);
            }
            drawCount += geometry.length;
            if (drawCount > MAX_NODES) budget('scene draw count');
        }
        result.push({ id, localMatrix, ...(parentId === undefined ? {} : { parentId }), ...(geometry === undefined ? {} : { meshes: geometry }) });
        if (node.children !== undefined) {
            for (const child of list(node.children, 'node.children', MAX_NODES)) visit(child, id);
        }
    }
    for (const root of roots) visit(root);
    if (seen.size !== nodes.length || byMesh.size !== meshes.length || drawCount === 0) unsupported('scene must include all nodes and meshes');
    return result;
}
