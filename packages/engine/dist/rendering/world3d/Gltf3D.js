// SPDX-License-Identifier: Apache-2.0
// glTF 2.0 reader (.glb and .gltf JSON) producing scene-graph objects.
// Image decoding and external buffer loading are injected so this module
// stays DOM-free. Supported: meshes, PBR/unlit materials, texture transform,
// node hierarchies, skins, morph targets, animations, cameras and punctual
// lights. Meshopt decoding is built in; Draco and Basis use caller-supplied adapters.
import { decodeMeshopt3D } from './Meshopt3D.js';
import { AnimationClip3D } from './Animation3D.js';
import { Camera3D } from './Camera3D.js';
import { World3DError, requireCount3D } from './core3D.js';
import { Attribute3D, Geometry3D } from './Geometry3D.js';
import { Light3D } from './Light3D.js';
import { Material3D } from './Material3D.js';
import { Bone3D, InstancedMesh3D, MESH3D_LIMITS, Mesh3D, Skeleton3D } from './Mesh3D.js';
import { Object3D } from './Object3D.js';
import { isKtx23D, parseKtx23D } from './Ktx23D.js';
import { Texture3D, isCompressedPixels3D } from './Texture3D.js';
import { mat4Compose, mat4Identity } from './math3D.js';
const SUPPORTED_EXTENSIONS = new Set([
    'KHR_materials_unlit',
    'KHR_materials_emissive_strength',
    'KHR_texture_transform',
    'KHR_lights_punctual',
    'KHR_mesh_quantization',
    'KHR_texture_basisu',
    'EXT_mesh_gpu_instancing',
    'EXT_meshopt_compression',
    'KHR_materials_transmission',
    'KHR_materials_ior',
    'KHR_materials_volume',
    'KHR_materials_clearcoat',
    'KHR_materials_sheen'
]);
/** Extensions accepted only when the caller injects the matching decoder. */
const DECODER_EXTENSIONS = Object.freeze({
    KHR_draco_mesh_compression: 'decodeDraco'
});
const GLTF_LIMITS = Object.freeze({
    maxNodes: 65536,
    maxAccessors: 262144,
    maxJsonBytes: 64 * 1024 * 1024,
    maxAccessorBytes: 128 * 1024 * 1024,
    maxDecodedAccessorBytes: 256 * 1024 * 1024,
    maxInstanceMatrixBytes: 64 * 1024 * 1024
});
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const ARRAY_TYPES = {
    5120: Int8Array,
    5121: Uint8Array,
    5122: Int16Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array
};
function fail(detail, cause) {
    throw new World3DError('WORLD3D_GLTF_INVALID', detail, cause);
}
function decodeBase64(text) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const clean = text.replace(/[^A-Za-z0-9+/]/g, ''), out = new Uint8Array(Math.floor((clean.length * 3) / 4));
    let bits = 0, count = 0, o = 0;
    for (let i = 0; i < clean.length; i++) {
        bits = (bits << 6) | alphabet.indexOf(clean[i]);
        count += 6;
        if (count >= 8) {
            count -= 8;
            out[o++] = (bits >> count) & 255;
        }
    }
    return out.subarray(0, o);
}
/** Minimal UTF-8 codec: the DOM-free core cannot rely on TextDecoder being present. */
function decodeUtf8(bytes) {
    let out = '', chunk = [];
    for (let i = 0; i < bytes.length;) {
        const b = bytes[i++];
        let code;
        if (b < 0x80)
            code = b;
        else if (b < 0xe0)
            code = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
        else if (b < 0xf0) {
            code = ((b & 0x0f) << 12) | ((bytes[i] & 0x3f) << 6) | (bytes[i + 1] & 0x3f);
            i += 2;
        }
        else {
            code = ((b & 0x07) << 18) | ((bytes[i] & 0x3f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
            i += 3;
        }
        if (code > 0xffff) {
            code -= 0x10000;
            chunk.push(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
        }
        else
            chunk.push(code);
        if (chunk.length >= 8192) {
            out += String.fromCharCode(...chunk);
            chunk = [];
        }
    }
    return out + String.fromCharCode(...chunk);
}
function encodeUtf8(text) {
    const out = [];
    for (const character of text) {
        const code = character.codePointAt(0);
        if (code < 0x80)
            out.push(code);
        else if (code < 0x800)
            out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        else if (code < 0x10000)
            out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        else
            out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    return Uint8Array.from(out);
}
function dataUri(uri) {
    const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(uri);
    if (!match)
        return undefined;
    return {
        mimeType: match[1] ?? '',
        bytes: match[2] ? decodeBase64(match[3]) : encodeUtf8(decodeURIComponent(match[3]))
    };
}
class GltfReader {
    json;
    buffers;
    options;
    geometries = [];
    materials = [];
    textures = [];
    accessorCache = new Map();
    floatAccessorCache = new Map();
    decodedAccessorBytes = 0;
    instanceMatrixBytes = 0;
    geometryCache = new Map();
    materialCache = new Map();
    textureCache = new Map();
    imageCache = new Map();
    /** Transfer function recorded in a KTX2 container, kept for diagnostics. */
    imageColorSpace = new Map();
    nodes = [];
    /** Mesh objects created for each node, used by skins and weight animations. */
    nodeMeshes = [];
    constructor(json, buffers, options) {
        this.json = json;
        this.buffers = buffers;
        this.options = options;
    }
    // ---- binary access -------------------------------------------------------
    meshoptCache = new Map();
    bufferView(index) {
        const view = this.json.bufferViews?.[index] ?? fail('bufferView ' + index);
        const packed = view.extensions?.EXT_meshopt_compression;
        if (packed) {
            let bytes = this.meshoptCache.get(index);
            if (!bytes) {
                // The built-in decoder is used unless the caller supplies a faster one.
                const decode = this.options.decodeMeshopt ??
                    ((request) => decodeMeshopt3D(request.source, request.count, request.stride, request.mode, request.filter));
                const source = this.buffers[packed.buffer] ?? fail('meshopt buffer ' + packed.buffer);
                const from = packed.byteOffset ?? 0, size = packed.byteLength, count = packed.count, stride = packed.byteStride;
                if (!Number.isSafeInteger(from) ||
                    !Number.isSafeInteger(size) ||
                    from < 0 ||
                    size < 0 ||
                    size > source.byteLength - from)
                    fail('meshopt range');
                if (!Number.isSafeInteger(count) ||
                    !Number.isSafeInteger(stride) ||
                    count < 0 ||
                    stride <= 0 ||
                    stride > 256 ||
                    count * stride > GLTF_LIMITS.maxJsonBytes * 16)
                    fail('meshopt layout');
                if (!['ATTRIBUTES', 'TRIANGLES', 'INDICES'].includes(packed.mode))
                    fail('meshopt mode');
                const filter = packed.filter ?? 'NONE';
                if (!['NONE', 'OCTAHEDRAL', 'QUATERNION', 'EXPONENTIAL'].includes(filter))
                    fail('meshopt filter');
                bytes = decode({ source: source.subarray(from, from + size), count, stride, mode: packed.mode, filter });
                if (!(bytes instanceof Uint8Array) || bytes.byteLength !== count * stride)
                    fail('meshopt decoder output size');
                this.meshoptCache.set(index, bytes);
            }
            // The uncompressed view describes the layout; only its data comes from the decoder.
            return { bytes, stride: view.byteStride ?? 0 };
        }
        const buffer = this.buffers[view.buffer] ?? fail('buffer ' + view.buffer);
        const offset = view.byteOffset ?? 0, length = view.byteLength;
        if (!Number.isSafeInteger(offset) ||
            !Number.isSafeInteger(length) ||
            offset < 0 ||
            length < 0 ||
            length > buffer.byteLength - offset)
            fail('bufferView range');
        return { bytes: buffer.subarray(offset, offset + length), stride: view.byteStride ?? 0 };
    }
    accessor(index) {
        const cached = this.accessorCache.get(index);
        if (cached)
            return cached;
        const def = this.json.accessors?.[index] ?? fail('accessor ' + index);
        const itemSize = COMPONENTS[def.type] ?? fail('accessor type'), ArrayType = ARRAY_TYPES[def.componentType] ?? fail('accessor componentType');
        const count = def.count;
        if (!Number.isSafeInteger(count) || count <= 0)
            fail('accessor count');
        const bytesPerElement = ArrayType.BYTES_PER_ELEMENT;
        const elementBytes = itemSize * bytesPerElement;
        const range = def.bufferView === undefined
            ? undefined
            : this.accessorRange(def.bufferView, def.byteOffset ?? 0, count, elementBytes);
        let sparseData;
        let sparseBytes = 0;
        if (def.sparse) {
            const sparse = def.sparse;
            if (!Number.isSafeInteger(sparse.count) || sparse.count <= 0 || sparse.count > count)
                fail('sparse count');
            const IndexType = ARRAY_TYPES[sparse.indices?.componentType];
            if (IndexType !== Uint8Array && IndexType !== Uint16Array && IndexType !== Uint32Array)
                fail('sparse indices');
            const indices = this.accessorRange(sparse.indices.bufferView, sparse.indices.byteOffset ?? 0, sparse.count, IndexType.BYTES_PER_ELEMENT, false);
            const values = this.accessorRange(sparse.values.bufferView, sparse.values.byteOffset ?? 0, sparse.count, elementBytes, false);
            sparseData = { count: sparse.count, IndexType, indices, values };
            sparseBytes = sparse.count * (IndexType.BYTES_PER_ELEMENT + elementBytes);
        }
        // Validate every backing range and the combined allocation before constructing typed arrays.
        this.reserveAccessorBytes(count * elementBytes + sparseBytes);
        const array = new ArrayType(count * itemSize);
        if (range)
            this.copyElements(array, range, count, itemSize, ArrayType);
        if (sparseData) {
            const { count: sparseCount, IndexType, indices: indexRange, values: valueRange } = sparseData;
            const indices = new IndexType(sparseCount), values = new ArrayType(sparseCount * itemSize);
            this.copyElements(indices, indexRange, sparseCount, 1, IndexType);
            this.copyElements(values, valueRange, sparseCount, itemSize, ArrayType);
            let previous = -1;
            for (let i = 0; i < sparseCount; i++) {
                const target = indices[i];
                if (target <= previous || target >= count)
                    fail('sparse index');
                previous = target;
                for (let c = 0; c < itemSize; c++)
                    array[target * itemSize + c] = values[i * itemSize + c];
            }
        }
        const result = { array, itemSize, count, normalized: def.normalized === true };
        this.accessorCache.set(index, result);
        return result;
    }
    reserveAccessorBytes(bytes) {
        if (bytes > GLTF_LIMITS.maxAccessorBytes ||
            this.decodedAccessorBytes + bytes > GLTF_LIMITS.maxDecodedAccessorBytes) {
            throw new World3DError('WORLD3D_BUDGET', 'gltf decoded accessor bytes');
        }
        this.decodedAccessorBytes += bytes;
    }
    accessorRange(viewIndex, byteOffset, count, elementBytes, allowStride = true) {
        const { bytes, stride } = this.bufferView(viewIndex);
        const step = stride === 0 ? elementBytes : stride;
        if (!Number.isSafeInteger(byteOffset) ||
            byteOffset < 0 ||
            !Number.isSafeInteger(step) ||
            step < elementBytes ||
            (stride !== 0 && !allowStride) ||
            count - 1 > Math.floor((bytes.byteLength - byteOffset - elementBytes) / step))
            fail('accessor range');
        return { bytes, byteOffset, step };
    }
    /** Copy preflighted interleaved elements into a packed array. */
    copyElements(out, { bytes, byteOffset, step }, count, itemSize, ArrayType) {
        const bytesPerElement = ArrayType.BYTES_PER_ELEMENT;
        const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const read = ArrayType === Float32Array
            ? (o) => data.getFloat32(o, true)
            : ArrayType === Uint32Array
                ? (o) => data.getUint32(o, true)
                : ArrayType === Uint16Array
                    ? (o) => data.getUint16(o, true)
                    : ArrayType === Int16Array
                        ? (o) => data.getInt16(o, true)
                        : ArrayType === Uint8Array
                            ? (o) => data.getUint8(o)
                            : (o) => data.getInt8(o);
        for (let i = 0; i < count; i++) {
            const base = byteOffset + i * step;
            for (let c = 0; c < itemSize; c++)
                out[i * itemSize + c] = read(base + c * bytesPerElement);
        }
    }
    /** Float view of an accessor, expanding normalized integers. */
    floats(index) {
        const cached = this.floatAccessorCache.get(index);
        if (cached)
            return cached;
        const { array, normalized } = this.accessor(index);
        if (array instanceof Float32Array)
            return array;
        this.reserveAccessorBytes(array.length * Float32Array.BYTES_PER_ELEMENT);
        const out = new Float32Array(array.length);
        const scale = !normalized
            ? 1
            : array instanceof Uint8Array
                ? 1 / 255
                : array instanceof Uint16Array
                    ? 1 / 65535
                    : array instanceof Int8Array
                        ? 1 / 127
                        : array instanceof Int16Array
                            ? 1 / 32767
                            : 1;
        for (let i = 0; i < array.length; i++)
            out[i] = normalized ? Math.max(array[i] * scale, -1) : array[i];
        this.floatAccessorCache.set(index, out);
        return out;
    }
    // ---- textures and materials ------------------------------------------------
    image(index) {
        let pending = this.imageCache.get(index);
        if (pending)
            return pending;
        const def = this.json.images?.[index] ?? fail('image ' + index);
        const decode = this.options.decodeImage;
        // KTX2 containers are read here; every other encoding goes to the injected decoder.
        const embeddedBytes = def.bufferView !== undefined
            ? this.bufferView(def.bufferView).bytes
            : typeof def.uri === 'string'
                ? dataUri(def.uri)?.bytes
                : undefined;
        if ((embeddedBytes && isKtx23D(embeddedBytes)) ||
            (!embeddedBytes && def.mimeType === 'image/ktx2' && typeof def.uri === 'string' && this.options.loadBuffer)) {
            const transcode = this.options.transcodeKtx2;
            pending = (async () => {
                const bytes = embeddedBytes ?? (await this.options.loadBuffer(def.uri));
                const result = await parseKtx23D(bytes, transcode ? { transcode } : {});
                this.imageColorSpace.set(index, result.colorSpace);
                return result.source;
            })();
            this.imageCache.set(index, pending);
            return pending;
        }
        if (!decode)
            throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'decodeImage is required for textured assets');
        let request;
        if (def.bufferView !== undefined)
            request = { index, mimeType: def.mimeType, bytes: this.bufferView(def.bufferView).bytes, uri: undefined };
        else if (typeof def.uri === 'string') {
            const embedded = dataUri(def.uri);
            request = embedded
                ? { index, mimeType: def.mimeType ?? embedded.mimeType, bytes: embedded.bytes, uri: undefined }
                : { index, mimeType: def.mimeType, bytes: undefined, uri: def.uri };
        }
        else
            fail('image source');
        pending = decode(request);
        this.imageCache.set(index, pending);
        return pending;
    }
    async texture(info, colorSpace, secondSet = false) {
        if (!info || typeof info.index !== 'number')
            return undefined;
        const transform = info.extensions?.KHR_texture_transform;
        const texCoord = transform?.texCoord ?? info.texCoord ?? 0;
        // Occlusion and emissive maps may use the second set, where baked lighting lives.
        if (texCoord !== 0 && !(texCoord === 1 && secondSet))
            throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'texture coordinate set ' + texCoord);
        const key = info.index + ':' + colorSpace + ':' + texCoord + ':' + (transform ? JSON.stringify(transform) : '');
        const cached = this.textureCache.get(key);
        if (cached)
            return cached;
        const def = this.json.textures?.[info.index] ?? fail('texture ' + info.index);
        const imageIndex = def.extensions?.KHR_texture_basisu?.source ?? def.source;
        if (imageIndex === undefined)
            throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'texture without a supported image source');
        const sampler = def.sampler !== undefined ? (this.json.samplers?.[def.sampler] ?? {}) : {};
        const wrap = (mode) => mode === 33071 ? 'clamp' : mode === 33648 ? 'mirror' : 'repeat';
        const min = sampler.minFilter;
        const image = await this.image(imageIndex);
        // A compressed chain carries its own mip levels; none can be generated for it.
        const storedLevels = isCompressedPixels3D(image) ? image.levels.length : 0;
        const texture = new Texture3D(image, {
            name: def.name ?? '',
            colorSpace,
            flipY: false,
            wrapS: wrap(sampler.wrapS),
            wrapT: wrap(sampler.wrapT),
            magFilter: sampler.magFilter === 9728 ? 'nearest' : 'linear',
            minFilter: min === 9728 || min === 9984 || min === 9986 ? 'nearest' : 'linear',
            mipmaps: storedLevels > 0 ? storedLevels > 1 : min === undefined || min >= 9984
        });
        if (transform) {
            if (Array.isArray(transform.offset))
                texture.offset.set(transform.offset);
            if (Array.isArray(transform.scale))
                texture.repeat.set(transform.scale);
            if (typeof transform.rotation === 'number')
                texture.rotation = transform.rotation;
        }
        texture.channel = texCoord === 1 ? 1 : 0;
        this.textures.push(texture);
        this.textureCache.set(key, texture);
        return texture;
    }
    async material(index, vertexColors, flat) {
        const key = index + ':' + vertexColors + ':' + flat;
        const cached = this.materialCache.get(key);
        if (cached)
            return cached;
        const def = index === undefined ? {} : (this.json.materials?.[index] ?? fail('material ' + index));
        const pbr = def.pbrMetallicRoughness ?? {}, extensions = def.extensions ?? {};
        const material = new Material3D(extensions.KHR_materials_unlit ? 'unlit' : 'standard', { name: def.name ?? '' });
        const base = pbr.baseColorFactor ?? [1, 1, 1, 1];
        material.color.set([base[0], base[1], base[2]]);
        material.opacity = base[3] ?? 1;
        material.metallic = pbr.metallicFactor ?? 1;
        material.roughness = pbr.roughnessFactor ?? 1;
        material.alphaMode = def.alphaMode === 'BLEND' ? 'blend' : def.alphaMode === 'MASK' ? 'mask' : 'opaque';
        material.alphaCutoff = def.alphaCutoff ?? 0.5;
        material.depthWrite = material.alphaMode !== 'blend';
        material.side = def.doubleSided ? 'double' : 'front';
        material.vertexColors = vertexColors;
        material.flatShading = flat;
        if (Array.isArray(def.emissiveFactor))
            material.emissive.set(def.emissiveFactor);
        material.emissiveIntensity = extensions.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
        // Surface extensions are read as their plain factors; their own textures are not used.
        const transmission = extensions.KHR_materials_transmission, volume = extensions.KHR_materials_volume, coat = extensions.KHR_materials_clearcoat, sheen = extensions.KHR_materials_sheen;
        if (transmission)
            material.transmission = transmission.transmissionFactor ?? 0;
        if (extensions.KHR_materials_ior)
            material.ior = extensions.KHR_materials_ior.ior ?? 1.5;
        if (volume) {
            material.thickness = volume.thicknessFactor ?? 0;
            if (Array.isArray(volume.attenuationColor))
                material.attenuationColor.set(volume.attenuationColor);
            if (volume.attenuationDistance > 0)
                material.attenuationDistance = volume.attenuationDistance;
        }
        if (coat) {
            material.clearcoat = coat.clearcoatFactor ?? 0;
            material.clearcoatRoughness = coat.clearcoatRoughnessFactor ?? 0;
        }
        if (sheen) {
            material.sheen = 1;
            material.sheenColor.set(sheen.sheenColorFactor ?? [0, 0, 0]);
            material.sheenRoughness = sheen.sheenRoughnessFactor ?? 0;
        }
        material.normalScale = def.normalTexture?.scale ?? 1;
        material.occlusionStrength = def.occlusionTexture?.strength ?? 1;
        const [map, metallicRoughness, normal, occlusion, emissive] = await Promise.all([
            this.texture(pbr.baseColorTexture, 'srgb'),
            this.texture(pbr.metallicRoughnessTexture, 'linear'),
            this.texture(def.normalTexture, 'linear'),
            this.texture(def.occlusionTexture, 'linear', true),
            this.texture(def.emissiveTexture, 'srgb', true)
        ]);
        material.map = map;
        material.metallicRoughnessMap = metallicRoughness;
        material.normalMap = normal;
        material.occlusionMap = occlusion;
        material.emissiveMap = emissive;
        this.materials.push(material);
        this.materialCache.set(key, material);
        return material;
    }
    // ---- geometry ----------------------------------------------------------------
    /** Decode a Draco primitive once and seed the accessor cache with its arrays. */
    dracoDecoded = new Set();
    async prepareDraco(primitive) {
        const packed = primitive.extensions?.KHR_draco_mesh_compression;
        if (!packed || this.dracoDecoded.has(packed.bufferView))
            return;
        const decode = this.options.decodeDraco;
        if (!decode)
            throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'KHR_draco_mesh_compression needs the decodeDraco option');
        const semantics = packed.attributes ?? fail('draco attributes');
        const componentTypes = {};
        for (const semantic of Object.keys(semantics)) {
            const accessor = this.json.accessors?.[primitive.attributes?.[semantic]];
            if (accessor)
                componentTypes[semantic] = accessor.componentType;
        }
        const indexComponentType = primitive.indices === undefined ? undefined : this.json.accessors?.[primitive.indices]?.componentType;
        const result = await decode({
            bytes: this.bufferView(packed.bufferView).bytes,
            attributes: semantics,
            componentTypes,
            indexComponentType
        });
        const seed = (accessorIndex, array, label) => {
            const def = this.json.accessors?.[accessorIndex] ?? fail('accessor ' + accessorIndex);
            const itemSize = COMPONENTS[def.type] ?? fail('accessor type');
            if (!array || !ArrayBuffer.isView(array) || array.length !== def.count * itemSize)
                fail('draco decoder output for ' + label);
            this.accessorCache.set(accessorIndex, { array, itemSize, count: def.count, normalized: def.normalized === true });
        };
        for (const semantic of Object.keys(semantics)) {
            const accessorIndex = primitive.attributes?.[semantic];
            if (accessorIndex !== undefined)
                seed(accessorIndex, result.attributes?.[semantic], semantic);
        }
        if (primitive.indices !== undefined)
            seed(primitive.indices, result.indices, 'indices');
        this.dracoDecoded.add(packed.bufferView);
    }
    geometry(primitive, targetNames) {
        const key = JSON.stringify([primitive.attributes, primitive.indices, primitive.mode, primitive.targets]);
        const cached = this.geometryCache.get(key);
        if (cached)
            return cached;
        const attributes = primitive.attributes ?? fail('primitive attributes');
        if (attributes.POSITION === undefined)
            fail('primitive without POSITION');
        const geometry = new Geometry3D();
        geometry.setAttribute('position', new Attribute3D(this.floats(attributes.POSITION), 3));
        const vertexCount = geometry.vertexCount;
        const add = (semantic, name, size) => {
            if (attributes[semantic] === undefined)
                return;
            const data = this.floats(attributes[semantic]);
            if (data.length !== vertexCount * size)
                fail(semantic + ' length');
            geometry.setAttribute(name, new Attribute3D(data, size));
        };
        add('NORMAL', 'normal', 3);
        add('TANGENT', 'tangent', 4);
        add('TEXCOORD_0', 'uv', 2);
        add('TEXCOORD_1', 'uv1', 2);
        add('WEIGHTS_0', 'weights', 4);
        if (attributes.COLOR_0 !== undefined) {
            const accessor = this.accessor(attributes.COLOR_0);
            geometry.setAttribute('color', new Attribute3D(this.floats(attributes.COLOR_0), accessor.itemSize));
        }
        if (attributes.JOINTS_0 !== undefined) {
            const joints = this.accessor(attributes.JOINTS_0).array;
            geometry.setAttribute('joints', new Attribute3D(joints instanceof Uint16Array ? joints : Uint16Array.from(joints), 4));
        }
        let indices;
        if (primitive.indices !== undefined) {
            const array = this.accessor(primitive.indices).array;
            indices = array instanceof Uint32Array || array instanceof Uint16Array ? array : Uint16Array.from(array);
            for (let i = 0; i < indices.length; i++)
                if (indices[i] >= vertexCount)
                    fail('index out of range');
        }
        const mode = primitive.mode ?? 4;
        const topologies = {
            0: 'points',
            1: 'lines',
            2: 'line-strip',
            3: 'line-strip',
            4: 'triangles',
            5: 'triangles',
            6: 'triangles'
        };
        geometry.topology = topologies[mode] ?? fail('primitive mode');
        if (mode === 2 || mode === 5 || mode === 6) {
            // Rewrite loops, strips and fans as plain lists the renderer understands.
            const source = indices ?? Uint32Array.from({ length: vertexCount }, (_, i) => i), out = [];
            if (mode === 2) {
                out.push(...source);
                if (source.length)
                    out.push(source[0]);
            }
            else
                for (let i = 2; i < source.length; i++) {
                    if (mode === 6)
                        out.push(source[0], source[i - 1], source[i]);
                    else if (i % 2 === 0)
                        out.push(source[i - 2], source[i - 1], source[i]);
                    else
                        out.push(source[i - 1], source[i - 2], source[i]);
                }
            indices = vertexCount > 65535 ? Uint32Array.from(out) : Uint16Array.from(out);
        }
        if (indices)
            geometry.setIndex(indices);
        if (Array.isArray(primitive.targets) && primitive.targets.length) {
            geometry.setMorphTargets(primitive.targets.map((target, i) => ({
                name: targetNames?.[i] ?? 'target_' + i,
                ...(target.POSITION !== undefined ? { position: this.floats(target.POSITION) } : {}),
                ...(target.NORMAL !== undefined ? { normal: this.floats(target.NORMAL) } : {})
            })));
        }
        this.geometries.push(geometry);
        this.geometryCache.set(key, geometry);
        return geometry;
    }
    async meshes(index) {
        const def = this.json.meshes?.[index] ?? fail('mesh ' + index);
        const primitives = Array.isArray(def.primitives) ? def.primitives : fail('mesh primitives');
        const names = def.extras?.targetNames;
        return Promise.all(primitives.map(async (primitive, i) => {
            await this.prepareDraco(primitive);
            const geometry = this.geometry(primitive, names);
            const lit = geometry.topology === 'triangles';
            const material = await this.material(primitive.material, geometry.getAttribute('color') !== undefined, lit && !geometry.getAttribute('normal'));
            const mesh = new Mesh3D(geometry, material);
            mesh.name = (def.name ?? 'mesh_' + index) + (primitives.length > 1 ? '_' + i : '');
            if (Array.isArray(def.weights))
                mesh.morphWeights.set(def.weights.slice(0, mesh.morphWeights.length));
            return mesh;
        }));
    }
    /**
     * EXT_mesh_gpu_instancing: replace a node's meshes with instanced meshes
     * placed by the extension's TRANSLATION, ROTATION and SCALE accessors.
     * An optional _COLOR_0 accessor tints each instance.
     */
    instanced(meshes, extension) {
        const attributes = extension.attributes ?? fail('EXT_mesh_gpu_instancing.attributes');
        const read = (name, itemSize) => {
            const index = attributes[name];
            if (index === undefined)
                return undefined;
            const accessor = this.accessor(index);
            if (accessor.itemSize !== itemSize)
                fail('instancing ' + name);
            return this.floats(index);
        };
        const translation = read('TRANSLATION', 3), rotation = read('ROTATION', 4), scale = read('SCALE', 3);
        const colorIndex = attributes['_COLOR_0'], colorSize = colorIndex === undefined ? 0 : this.accessor(colorIndex).itemSize;
        if (colorSize !== 0 && colorSize !== 3 && colorSize !== 4)
            fail('instancing _COLOR_0');
        const colors = colorIndex === undefined ? undefined : this.floats(colorIndex);
        const counts = [
            translation && translation.length / 3,
            rotation && rotation.length / 4,
            scale && scale.length / 3,
            colors && colors.length / colorSize
        ].filter((n) => n !== undefined);
        const count = counts[0] ?? fail('instancing needs an attribute');
        if (count < 1 || counts.some(n => n !== count))
            fail('instancing accessor counts');
        if (count > MESH3D_LIMITS.maxInstances)
            throw new World3DError('WORLD3D_BUDGET', 'gltf instances');
        // Nodes and primitives may share accessors, but their generated matrices are distinct.
        const matrixBytes = count * meshes.length * 16 * Float32Array.BYTES_PER_ELEMENT;
        if (this.instanceMatrixBytes + matrixBytes > GLTF_LIMITS.maxInstanceMatrixBytes)
            throw new World3DError('WORLD3D_BUDGET', 'gltf instance matrices');
        this.instanceMatrixBytes += matrixBytes;
        const t = [0, 0, 0], q = [0, 0, 0, 1], k = [1, 1, 1];
        return meshes.map(mesh => {
            const instances = new InstancedMesh3D(mesh.geometry, mesh.material, count, colorSize === 4 ? 4 : 3);
            instances.name = mesh.name;
            instances.morphWeights.set(mesh.morphWeights);
            for (let i = 0; i < count; i++) {
                if (translation) {
                    t[0] = translation[i * 3];
                    t[1] = translation[i * 3 + 1];
                    t[2] = translation[i * 3 + 2];
                }
                if (rotation) {
                    // Quantized rotations are only approximately unit length.
                    const x = rotation[i * 4], y = rotation[i * 4 + 1], z = rotation[i * 4 + 2], w = rotation[i * 4 + 3], length = Math.hypot(x, y, z, w) || 1;
                    q[0] = x / length;
                    q[1] = y / length;
                    q[2] = z / length;
                    q[3] = w / length;
                }
                if (scale) {
                    k[0] = scale[i * 3];
                    k[1] = scale[i * 3 + 1];
                    k[2] = scale[i * 3 + 2];
                }
                mat4Compose(instances.instanceMatrices.subarray(i * 16, i * 16 + 16), t, q, k);
            }
            if (colors)
                instances.instanceColors = colors.slice();
            instances.instanceVersion++;
            return instances;
        });
    }
    // ---- nodes, skins, scenes -----------------------------------------------------
    camera(index) {
        const def = this.json.cameras?.[index] ?? fail('camera ' + index);
        const camera = new Camera3D(def.type === 'orthographic' ? 'orthographic' : 'perspective');
        if (def.type === 'orthographic') {
            const o = def.orthographic ?? fail('camera.orthographic');
            camera.orthographicHeight = o.ymag * 2;
            camera.aspect = o.xmag / o.ymag;
            camera.near = o.znear;
            camera.far = o.zfar;
        }
        else {
            const p = def.perspective ?? fail('camera.perspective');
            camera.fov = (p.yfov * 180) / Math.PI;
            camera.aspect = p.aspectRatio ?? 1;
            camera.near = p.znear;
            camera.far = p.zfar ?? p.znear * 10000;
        }
        camera.name = def.name ?? 'camera_' + index;
        return camera;
    }
    light(index) {
        const def = this.json.extensions?.KHR_lights_punctual?.lights?.[index] ?? fail('light ' + index);
        const light = new Light3D(def.type === 'point' ? 'point' : def.type === 'spot' ? 'spot' : 'directional');
        if (Array.isArray(def.color))
            light.color.set(def.color);
        light.intensity = def.intensity ?? 1;
        light.range = def.range ?? 0;
        if (def.type === 'spot') {
            const outer = def.spot?.outerConeAngle ?? Math.PI / 4, inner = def.spot?.innerConeAngle ?? 0;
            light.angle = outer;
            light.penumbra = outer > 0 ? 1 - inner / outer : 0;
        }
        light.name = def.name ?? 'light_' + index;
        return light;
    }
    async build() {
        const json = this.json, nodeDefs = json.nodes ?? [];
        if (nodeDefs.length > GLTF_LIMITS.maxNodes)
            throw new World3DError('WORLD3D_BUDGET', 'gltf nodes');
        const joints = new Set();
        for (const skin of (json.skins ?? []))
            for (const joint of skin.joints ?? [])
                joints.add(joint);
        const usedNames = new Set(), cameras = [];
        // Animation tracks bind by name, so every node receives a unique one.
        const unique = (name) => {
            let candidate = name, suffix = 1;
            while (usedNames.has(candidate))
                candidate = name + '_' + suffix++;
            usedNames.add(candidate);
            return candidate;
        };
        this.nodes = [];
        this.nodeMeshes = [];
        for (let i = 0; i < nodeDefs.length; i++) {
            const def = nodeDefs[i];
            let meshes = def.mesh !== undefined ? await this.meshes(def.mesh) : [];
            const instancing = def.extensions?.EXT_mesh_gpu_instancing;
            if (instancing && meshes.length > 0)
                meshes = this.instanced(meshes, instancing);
            // A single-primitive mesh becomes the node itself; otherwise the
            // node is a plain parent holding one mesh per primitive.
            let node;
            if (meshes.length === 1 && !joints.has(i))
                node = meshes[0];
            else {
                node = joints.has(i) ? new Bone3D() : new Object3D();
                for (const mesh of meshes)
                    node.addChild(mesh);
            }
            node.name = unique(def.name ?? 'node_' + i);
            for (const mesh of meshes)
                if (mesh !== node)
                    mesh.name = unique(mesh.name);
            if (Array.isArray(def.matrix))
                node.setMatrix(def.matrix);
            else {
                if (Array.isArray(def.translation))
                    node.position.set(def.translation);
                if (Array.isArray(def.rotation))
                    node.setQuaternion(def.rotation[0], def.rotation[1], def.rotation[2], def.rotation[3]);
                if (Array.isArray(def.scale))
                    node.scale.set(def.scale);
                node.markTransformDirty();
            }
            if (Array.isArray(def.weights))
                for (const mesh of meshes)
                    mesh.morphWeights.set(def.weights.slice(0, mesh.morphWeights.length));
            if (def.camera !== undefined) {
                const camera = this.camera(def.camera);
                camera.name = unique(camera.name);
                node.addChild(camera);
                cameras.push(camera);
            }
            const lightIndex = def.extensions?.KHR_lights_punctual?.light;
            if (lightIndex !== undefined) {
                const light = this.light(lightIndex);
                light.name = unique(light.name);
                node.addChild(light);
            }
            this.nodes.push(node);
            this.nodeMeshes.push(meshes);
        }
        const parented = new Set();
        nodeDefs.forEach((def, i) => {
            for (const child of (def.children ?? [])) {
                const node = this.nodes[child] ?? fail('node child');
                if (parented.has(child) || child === i)
                    fail('node hierarchy');
                parented.add(child);
                this.nodes[i].addChild(node);
            }
        });
        const assignedRoots = new Set();
        const scenes = (json.scenes ?? [{ nodes: nodeDefs.map((_, i) => i).filter(i => !parented.has(i)) }]).map((def, i) => {
            const root = new Object3D();
            root.name = def.name ?? 'scene_' + i;
            const sceneRoots = new Set();
            for (const index of (def.nodes ?? [])) {
                const node = this.nodes[index] ?? fail('scene node');
                if (parented.has(index) || sceneRoots.has(index))
                    fail('scene root ' + index);
                // A scene node has one owner. Reparenting would silently erase it from an earlier scene.
                if (assignedRoots.has(index))
                    throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'shared scene root ' + index);
                sceneRoots.add(index);
                assignedRoots.add(index);
                root.addChild(node);
            }
            root.updateWorldMatrices();
            return root;
        });
        const skeletons = (json.skins ?? []).map(skin => {
            const jointIndices = skin.joints;
            requireCount3D(jointIndices.length, 'bones', MESH3D_LIMITS.maxBones);
            const bones = jointIndices.map(index => this.nodes[index] ?? fail('skin joint'));
            const matrixLength = bones.length * 16;
            if (skin.inverseBindMatrices !== undefined) {
                const { array, count, itemSize } = this.accessor(skin.inverseBindMatrices);
                if (!(array instanceof Float32Array) || itemSize !== 16 || count < bones.length)
                    fail('inverse bind matrices');
                return new Skeleton3D(bones, array.subarray(0, matrixLength));
            }
            // glTF defines omitted inverse bind matrices as identity for every joint.
            const inverse = new Float32Array(matrixLength);
            for (let offset = 0; offset < matrixLength; offset += 16)
                mat4Identity(inverse.subarray(offset, offset + 16));
            return new Skeleton3D(bones, inverse);
        });
        nodeDefs.forEach((def, i) => {
            if (def.skin === undefined)
                return;
            const skeleton = skeletons[def.skin] ?? fail('node skin');
            for (const mesh of this.nodeMeshes[i]) {
                // glTF ignores the skinned mesh's own transform: bind in world space.
                if (mesh.geometry.getAttribute('joints') && mesh.geometry.getAttribute('weights'))
                    mesh.bind(skeleton, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
            }
        });
        return { scenes, cameras, animations: this.animations(), defaultScene: json.scene ?? 0 };
    }
    animations() {
        return (this.json.animations ?? []).map((def, index) => {
            const tracks = [];
            for (const channel of (def.channels ?? [])) {
                const sampler = def.samplers?.[channel.sampler] ?? fail('animation sampler');
                const nodeIndex = channel.target?.node, path = channel.target?.path;
                if (nodeIndex === undefined)
                    continue;
                const node = this.nodes[nodeIndex] ?? fail('animation target');
                const mapped = path === 'translation'
                    ? 'position'
                    : path === 'rotation'
                        ? 'quaternion'
                        : path === 'scale'
                            ? 'scale'
                            : path === 'weights'
                                ? 'weights'
                                : undefined;
                if (!mapped)
                    continue;
                const interpolation = sampler.interpolation === 'STEP' ? 'step' : sampler.interpolation === 'CUBICSPLINE' ? 'cubic' : 'linear';
                const times = this.floats(sampler.input), values = this.floats(sampler.output);
                // Morph weights live on mesh objects, which may be children of the node.
                const targets = mapped === 'weights' ? this.nodeMeshes[nodeIndex].map(mesh => mesh.name) : [node.name];
                for (const targetName of targets)
                    tracks.push({ targetName, path: mapped, times, values, interpolation });
            }
            return new AnimationClip3D(def.name ?? 'animation_' + index, tracks);
        });
    }
}
/** Split a .glb container, or parse .gltf JSON text, into JSON plus buffers. */
async function unpack(data, options) {
    let json, binary;
    if (data instanceof Uint8Array) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        if (data.byteLength >= 12 && view.getUint32(0, true) === 0x46546c67) {
            if (view.getUint32(4, true) !== 2)
                throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'only glTF 2.0 containers are supported');
            const total = Math.min(view.getUint32(8, true), data.byteLength);
            let offset = 12, text;
            while (offset + 8 <= total) {
                const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
                if (offset + 8 + length > total)
                    fail('glb chunk range');
                const chunk = data.subarray(offset + 8, offset + 8 + length);
                if (type === 0x4e4f534a)
                    text = chunk;
                else if (type === 0x004e4942 && !binary)
                    binary = chunk;
                offset += 8 + length + ((4 - (length % 4)) % 4);
            }
            if (!text)
                fail('glb without JSON chunk');
            if (text.byteLength > GLTF_LIMITS.maxJsonBytes)
                throw new World3DError('WORLD3D_BUDGET', 'gltf json');
            try {
                json = JSON.parse(decodeUtf8(text));
            }
            catch (cause) {
                fail('json', cause);
            }
        }
        else {
            if (data.byteLength > GLTF_LIMITS.maxJsonBytes)
                throw new World3DError('WORLD3D_BUDGET', 'gltf json');
            try {
                json = JSON.parse(decodeUtf8(data));
            }
            catch (cause) {
                fail('json', cause);
            }
        }
    }
    else if (data && typeof data === 'object')
        json = data;
    else
        fail('input');
    if (!json || typeof json !== 'object' || json.asset?.version?.[0] !== '2')
        throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'asset.version');
    if (Array.isArray(json.accessors) && json.accessors.length > GLTF_LIMITS.maxAccessors)
        throw new World3DError('WORLD3D_BUDGET', 'gltf accessors');
    for (const extension of (json.extensionsRequired ?? [])) {
        const decoder = DECODER_EXTENSIONS[extension];
        if (decoder && typeof options[decoder] === 'function')
            continue;
        if (decoder)
            throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'required extension ' + extension + ' needs the ' + decoder + ' option');
        if (!SUPPORTED_EXTENSIONS.has(extension))
            throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'required extension ' + extension);
    }
    const buffers = await Promise.all((json.buffers ?? []).map(async (def, index) => {
        if (def.uri === undefined)
            return index === 0 ? binary : undefined;
        const embedded = dataUri(def.uri);
        if (embedded)
            return embedded.bytes;
        if (!options.loadBuffer)
            throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'loadBuffer is required for external buffers');
        return options.loadBuffer(def.uri);
    }));
    return { json, buffers };
}
/** Parse a glTF 2.0 asset from .glb bytes, .gltf JSON bytes or an already parsed JSON object. */
export async function loadGltf3D(data, options = {}) {
    const { json, buffers } = await unpack(data, options);
    const reader = new GltfReader(json, buffers, options);
    let built;
    try {
        built = await reader.build();
    }
    catch (cause) {
        // Never leak partially created resources when loading fails midway.
        for (const resource of [...reader.geometries, ...reader.materials, ...reader.textures])
            resource.dispose();
        if (cause instanceof World3DError)
            throw cause;
        throw new World3DError('WORLD3D_GLTF_INVALID', 'malformed asset', cause);
    }
    const scene = built.scenes[built.defaultScene] ?? built.scenes[0] ?? new Object3D();
    let disposed = false;
    return Object.freeze({
        scene,
        scenes: Object.freeze(built.scenes),
        animations: Object.freeze(built.animations),
        cameras: Object.freeze(built.cameras),
        materials: Object.freeze(reader.materials),
        textures: Object.freeze(reader.textures),
        geometries: Object.freeze(reader.geometries),
        dispose() {
            if (disposed)
                return;
            disposed = true;
            for (const resource of [...reader.geometries, ...reader.materials, ...reader.textures])
                resource.dispose();
        }
    });
}
//# sourceMappingURL=Gltf3D.js.map