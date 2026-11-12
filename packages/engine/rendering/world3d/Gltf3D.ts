// SPDX-License-Identifier: Apache-2.0
// glTF 2.0 reader (.glb and .gltf JSON) producing scene-graph objects.
// Image decoding and external buffer loading are injected so this module
// stays DOM-free. Supported: meshes, PBR/unlit materials, texture transform,
// node hierarchies, skins, morph targets, animations, cameras and punctual
// lights. Compressed geometry or texture extensions are refused explicitly.
import {AnimationClip3D} from './Animation3D.js';
import type {AnimationInterpolation3D, AnimationPath3D, AnimationTrackInput3D} from './Animation3D.js';
import {Camera3D} from './Camera3D.js';
import {World3DError} from './core3D.js';
import {Attribute3D, Geometry3D} from './Geometry3D.js';
import type {MorphTarget3D, Topology3D} from './Geometry3D.js';
import {Light3D} from './Light3D.js';
import {Material3D} from './Material3D.js';
import {Bone3D, Mesh3D, Skeleton3D} from './Mesh3D.js';
import {Object3D} from './Object3D.js';
import {Texture3D} from './Texture3D.js';
import type {TextureColorSpace3D, TextureSource3D, TextureWrap3D} from './Texture3D.js';

export interface GltfImageRequest3D {
    readonly index: number;
    readonly mimeType: string | undefined;
    /** Encoded image bytes when embedded in a buffer or data URI. */
    readonly bytes: Uint8Array | undefined;
    /** Relative or absolute URI when the image is external. */
    readonly uri: string | undefined;
}
export interface GltfLoadOptions3D {
    /** Decode an encoded image into pixels or a host image object. */
    readonly decodeImage?: (request: GltfImageRequest3D) => Promise<TextureSource3D>;
    /** Fetch an external .bin buffer referenced by a .gltf file. */
    readonly loadBuffer?: (uri: string) => Promise<Uint8Array>;
}
export interface GltfAsset3D {
    /** Root of the default scene (or the first one). */
    readonly scene: Object3D;
    readonly scenes: readonly Object3D[];
    readonly animations: readonly AnimationClip3D[];
    readonly cameras: readonly Camera3D[];
    readonly materials: readonly Material3D[];
    readonly textures: readonly Texture3D[];
    readonly geometries: readonly Geometry3D[];
    /** Release every geometry, material and texture created for this asset. */
    dispose(): void;
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const SUPPORTED_EXTENSIONS = new Set(['KHR_materials_unlit', 'KHR_materials_emissive_strength', 'KHR_texture_transform', 'KHR_lights_punctual', 'KHR_mesh_quantization']);
const GLTF_LIMITS = Object.freeze({maxNodes: 65536, maxAccessors: 262144, maxJsonBytes: 67108864} as const);
const COMPONENTS: Record<string, number> = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16};
type TypedArrayConstructor = Int8ArrayConstructor | Uint8ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor;
const ARRAY_TYPES: Record<number, TypedArrayConstructor> = {5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array};

function fail(detail: string, cause?: unknown): never {
    throw new World3DError('WORLD3D_GLTF_INVALID', detail, cause);
}
function decodeBase64(text: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const clean = text.replace(/[^A-Za-z0-9+/]/g, ''), out = new Uint8Array(Math.floor(clean.length * 3 / 4));
    let bits = 0, count = 0, o = 0;
    for (let i = 0; i < clean.length; i++) {
        bits = (bits << 6) | alphabet.indexOf(clean[i]!); count += 6;
        if (count >= 8) { count -= 8; out[o++] = (bits >> count) & 255; }
    }
    return out.subarray(0, o);
}
/** Minimal UTF-8 codec: the DOM-free core cannot rely on TextDecoder being present. */
function decodeUtf8(bytes: Uint8Array): string {
    let out = '', chunk: number[] = [];
    for (let i = 0; i < bytes.length;) {
        const b = bytes[i++]!;
        let code: number;
        if (b < 0x80) code = b;
        else if (b < 0xe0) code = ((b & 0x1f) << 6) | (bytes[i++]! & 0x3f);
        else if (b < 0xf0) { code = ((b & 0x0f) << 12) | ((bytes[i]! & 0x3f) << 6) | (bytes[i + 1]! & 0x3f); i += 2; }
        else { code = ((b & 0x07) << 18) | ((bytes[i]! & 0x3f) << 12) | ((bytes[i + 1]! & 0x3f) << 6) | (bytes[i + 2]! & 0x3f); i += 3; }
        if (code > 0xffff) { code -= 0x10000; chunk.push(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff)); }
        else chunk.push(code);
        if (chunk.length >= 8192) { out += String.fromCharCode(...chunk); chunk = []; }
    }
    return out + String.fromCharCode(...chunk);
}
function encodeUtf8(text: string): Uint8Array {
    const out: number[] = [];
    for (const character of text) {
        const code = character.codePointAt(0)!;
        if (code < 0x80) out.push(code);
        else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    return Uint8Array.from(out);
}
function dataUri(uri: string): {mimeType: string; bytes: Uint8Array} | undefined {
    const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(uri);
    if (!match) return undefined;
    return {mimeType: match[1] ?? '', bytes: match[2] ? decodeBase64(match[3]!) : encodeUtf8(decodeURIComponent(match[3]!))};
}

interface Accessor {
    readonly array: Float32Array | Uint32Array | Uint16Array | Uint8Array | Int16Array | Int8Array;
    readonly itemSize: number;
    readonly count: number;
    readonly normalized: boolean;
}

class GltfReader {
    readonly geometries: Geometry3D[] = [];
    readonly materials: Material3D[] = [];
    readonly textures: Texture3D[] = [];
    private readonly accessorCache = new Map<number, Accessor>();
    private readonly geometryCache = new Map<string, Geometry3D>();
    private readonly materialCache = new Map<string, Material3D>();
    private readonly textureCache = new Map<string, Texture3D>();
    private readonly imageCache = new Map<number, Promise<TextureSource3D>>();
    private nodes: Object3D[] = [];
    /** Mesh objects created for each node, used by skins and weight animations. */
    private nodeMeshes: Mesh3D[][] = [];

    constructor(private readonly json: Json, private readonly buffers: (Uint8Array | undefined)[], private readonly options: GltfLoadOptions3D) {}

    // ---- binary access -------------------------------------------------------
    private bufferView(index: number): {bytes: Uint8Array; stride: number} {
        const view = this.json.bufferViews?.[index] ?? fail('bufferView ' + index);
        const buffer = this.buffers[view.buffer] ?? fail('buffer ' + view.buffer);
        const offset = view.byteOffset ?? 0, length = view.byteLength;
        if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > buffer.byteLength) fail('bufferView range');
        return {bytes: buffer.subarray(offset, offset + length), stride: view.byteStride ?? 0};
    }
    accessor(index: number): Accessor {
        const cached = this.accessorCache.get(index);
        if (cached) return cached;
        const def = this.json.accessors?.[index] ?? fail('accessor ' + index);
        const itemSize = COMPONENTS[def.type] ?? fail('accessor type'), ArrayType = ARRAY_TYPES[def.componentType] ?? fail('accessor componentType');
        const count = def.count;
        if (!Number.isSafeInteger(count) || count < 0 || count * itemSize > 0x7ffffff) fail('accessor count');
        const array = new ArrayType(count * itemSize), bytesPerElement = ArrayType.BYTES_PER_ELEMENT;
        if (def.bufferView !== undefined) this.copyElements(array, def.bufferView, def.byteOffset ?? 0, count, itemSize, bytesPerElement, ArrayType);
        if (def.sparse) {
            const sparse = def.sparse, IndexType = ARRAY_TYPES[sparse.indices.componentType] ?? fail('sparse indices');
            const indices = new IndexType(sparse.count), values = new ArrayType(sparse.count * itemSize);
            this.copyElements(indices, sparse.indices.bufferView, sparse.indices.byteOffset ?? 0, sparse.count, 1, IndexType.BYTES_PER_ELEMENT, IndexType);
            this.copyElements(values, sparse.values.bufferView, sparse.values.byteOffset ?? 0, sparse.count, itemSize, bytesPerElement, ArrayType);
            for (let i = 0; i < sparse.count; i++) {
                const target = indices[i]!;
                if (target >= count) fail('sparse index');
                for (let c = 0; c < itemSize; c++) array[target * itemSize + c] = values[i * itemSize + c]!;
            }
        }
        const result: Accessor = {array, itemSize, count, normalized: def.normalized === true};
        this.accessorCache.set(index, result);
        return result;
    }
    /** Copy possibly interleaved, possibly unaligned elements into a packed array. */
    private copyElements(out: ArrayLike<number> & {[index: number]: number}, viewIndex: number, byteOffset: number, count: number, itemSize: number, bytesPerElement: number, ArrayType: TypedArrayConstructor): void {
        const {bytes, stride} = this.bufferView(viewIndex);
        const elementBytes = itemSize * bytesPerElement, step = stride || elementBytes;
        if (count > 0 && byteOffset + step * (count - 1) + elementBytes > bytes.byteLength) fail('accessor range');
        const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const read = ArrayType === Float32Array ? (o: number) => data.getFloat32(o, true)
            : ArrayType === Uint32Array ? (o: number) => data.getUint32(o, true)
            : ArrayType === Uint16Array ? (o: number) => data.getUint16(o, true)
            : ArrayType === Int16Array ? (o: number) => data.getInt16(o, true)
            : ArrayType === Uint8Array ? (o: number) => data.getUint8(o) : (o: number) => data.getInt8(o);
        for (let i = 0; i < count; i++) {
            const base = byteOffset + i * step;
            for (let c = 0; c < itemSize; c++) out[i * itemSize + c] = read(base + c * bytesPerElement);
        }
    }
    /** Float view of an accessor, expanding normalized integers. */
    private floats(index: number): Float32Array {
        const {array, normalized} = this.accessor(index);
        if (array instanceof Float32Array) return array;
        const out = new Float32Array(array.length);
        const scale = !normalized ? 1 : array instanceof Uint8Array ? 1 / 255 : array instanceof Uint16Array ? 1 / 65535 : array instanceof Int8Array ? 1 / 127 : array instanceof Int16Array ? 1 / 32767 : 1;
        for (let i = 0; i < array.length; i++) out[i] = normalized ? Math.max(array[i]! * scale, -1) : array[i]!;
        return out;
    }

    // ---- textures and materials ------------------------------------------------
    private image(index: number): Promise<TextureSource3D> {
        let pending = this.imageCache.get(index);
        if (pending) return pending;
        const def = this.json.images?.[index] ?? fail('image ' + index);
        const decode = this.options.decodeImage;
        if (!decode) throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'decodeImage is required for textured assets');
        let request: GltfImageRequest3D;
        if (def.bufferView !== undefined) request = {index, mimeType: def.mimeType, bytes: this.bufferView(def.bufferView).bytes, uri: undefined};
        else if (typeof def.uri === 'string') {
            const embedded = dataUri(def.uri);
            request = embedded ? {index, mimeType: def.mimeType ?? embedded.mimeType, bytes: embedded.bytes, uri: undefined}
                : {index, mimeType: def.mimeType, bytes: undefined, uri: def.uri};
        } else fail('image source');
        pending = decode(request);
        this.imageCache.set(index, pending);
        return pending;
    }
    private async texture(info: Json | undefined, colorSpace: TextureColorSpace3D): Promise<Texture3D | undefined> {
        if (!info || typeof info.index !== 'number') return undefined;
        const transform = info.extensions?.KHR_texture_transform;
        const key = info.index + ':' + colorSpace + ':' + (transform ? JSON.stringify(transform) : '');
        const cached = this.textureCache.get(key);
        if (cached) return cached;
        const def = this.json.textures?.[info.index] ?? fail('texture ' + info.index);
        if (def.source === undefined) throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'texture without a core image source');
        const sampler = def.sampler !== undefined ? this.json.samplers?.[def.sampler] ?? {} : {};
        const wrap = (mode: number | undefined): TextureWrap3D => mode === 33071 ? 'clamp' : mode === 33648 ? 'mirror' : 'repeat';
        const min = sampler.minFilter as number | undefined;
        const texture = new Texture3D(await this.image(def.source), {
            name: def.name ?? '', colorSpace, flipY: false, wrapS: wrap(sampler.wrapS), wrapT: wrap(sampler.wrapT),
            magFilter: sampler.magFilter === 9728 ? 'nearest' : 'linear',
            minFilter: min === 9728 || min === 9984 || min === 9986 ? 'nearest' : 'linear',
            mipmaps: min === undefined || min >= 9984,
        });
        if (transform) {
            if (Array.isArray(transform.offset)) texture.offset.set(transform.offset);
            if (Array.isArray(transform.scale)) texture.repeat.set(transform.scale);
            if (typeof transform.rotation === 'number') texture.rotation = transform.rotation;
        }
        this.textures.push(texture);
        this.textureCache.set(key, texture);
        return texture;
    }
    private async material(index: number | undefined, vertexColors: boolean, flat: boolean): Promise<Material3D> {
        const key = index + ':' + vertexColors + ':' + flat;
        const cached = this.materialCache.get(key);
        if (cached) return cached;
        const def: Json = index === undefined ? {} : this.json.materials?.[index] ?? fail('material ' + index);
        const pbr: Json = def.pbrMetallicRoughness ?? {}, extensions: Json = def.extensions ?? {};
        const material = new Material3D(extensions.KHR_materials_unlit ? 'unlit' : 'standard', {name: def.name ?? ''});
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
        if (Array.isArray(def.emissiveFactor)) material.emissive.set(def.emissiveFactor);
        material.emissiveIntensity = extensions.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
        material.normalScale = def.normalTexture?.scale ?? 1;
        material.occlusionStrength = def.occlusionTexture?.strength ?? 1;
        const [map, metallicRoughness, normal, occlusion, emissive] = await Promise.all([
            this.texture(pbr.baseColorTexture, 'srgb'), this.texture(pbr.metallicRoughnessTexture, 'linear'),
            this.texture(def.normalTexture, 'linear'), this.texture(def.occlusionTexture, 'linear'), this.texture(def.emissiveTexture, 'srgb'),
        ]);
        material.map = map; material.metallicRoughnessMap = metallicRoughness; material.normalMap = normal;
        material.occlusionMap = occlusion; material.emissiveMap = emissive;
        this.materials.push(material);
        this.materialCache.set(key, material);
        return material;
    }

    // ---- geometry ----------------------------------------------------------------
    private geometry(primitive: Json, targetNames: readonly string[] | undefined): Geometry3D {
        const key = JSON.stringify([primitive.attributes, primitive.indices, primitive.mode, primitive.targets]);
        const cached = this.geometryCache.get(key);
        if (cached) return cached;
        const attributes: Json = primitive.attributes ?? fail('primitive attributes');
        if (attributes.POSITION === undefined) fail('primitive without POSITION');
        const geometry = new Geometry3D();
        geometry.setAttribute('position', new Attribute3D(this.floats(attributes.POSITION), 3));
        const vertexCount = geometry.vertexCount;
        const add = (semantic: string, name: string, size: number): void => {
            if (attributes[semantic] === undefined) return;
            const data = this.floats(attributes[semantic]);
            if (data.length !== vertexCount * size) fail(semantic + ' length');
            geometry.setAttribute(name, new Attribute3D(data, size));
        };
        add('NORMAL', 'normal', 3); add('TANGENT', 'tangent', 4); add('TEXCOORD_0', 'uv', 2); add('TEXCOORD_1', 'uv1', 2); add('WEIGHTS_0', 'weights', 4);
        if (attributes.COLOR_0 !== undefined) {
            const accessor = this.accessor(attributes.COLOR_0);
            geometry.setAttribute('color', new Attribute3D(this.floats(attributes.COLOR_0), accessor.itemSize));
        }
        if (attributes.JOINTS_0 !== undefined) {
            const joints = this.accessor(attributes.JOINTS_0).array;
            geometry.setAttribute('joints', new Attribute3D(joints instanceof Uint16Array ? joints : Uint16Array.from(joints), 4));
        }
        let indices: Uint16Array | Uint32Array | undefined;
        if (primitive.indices !== undefined) {
            const array = this.accessor(primitive.indices).array;
            indices = array instanceof Uint32Array || array instanceof Uint16Array ? array : Uint16Array.from(array);
            for (let i = 0; i < indices.length; i++) if (indices[i]! >= vertexCount) fail('index out of range');
        }
        const mode: number = primitive.mode ?? 4;
        const topologies: Record<number, Topology3D> = {0: 'points', 1: 'lines', 2: 'line-strip', 3: 'line-strip', 4: 'triangles', 5: 'triangles', 6: 'triangles'};
        geometry.topology = topologies[mode] ?? fail('primitive mode');
        if (mode === 2 || mode === 5 || mode === 6) {
            // Rewrite loops, strips and fans as plain lists the renderer understands.
            const source = indices ?? Uint32Array.from({length: vertexCount}, (_, i) => i), out: number[] = [];
            if (mode === 2) { out.push(...source); if (source.length) out.push(source[0]!); }
            else for (let i = 2; i < source.length; i++) {
                if (mode === 6) out.push(source[0]!, source[i - 1]!, source[i]!);
                else if (i % 2 === 0) out.push(source[i - 2]!, source[i - 1]!, source[i]!);
                else out.push(source[i - 1]!, source[i - 2]!, source[i]!);
            }
            indices = vertexCount > 65535 ? Uint32Array.from(out) : Uint16Array.from(out);
        }
        if (indices) geometry.setIndex(indices);
        if (Array.isArray(primitive.targets) && primitive.targets.length) {
            geometry.setMorphTargets(primitive.targets.map((target: Json, i: number): MorphTarget3D => ({
                name: targetNames?.[i] ?? 'target_' + i,
                ...(target.POSITION !== undefined ? {position: this.floats(target.POSITION)} : {}),
                ...(target.NORMAL !== undefined ? {normal: this.floats(target.NORMAL)} : {}),
            })));
        }
        this.geometries.push(geometry);
        this.geometryCache.set(key, geometry);
        return geometry;
    }
    private async meshes(index: number): Promise<Mesh3D[]> {
        const def = this.json.meshes?.[index] ?? fail('mesh ' + index);
        const primitives: Json[] = Array.isArray(def.primitives) ? def.primitives : fail('mesh primitives');
        const names: string[] | undefined = def.extras?.targetNames;
        return Promise.all(primitives.map(async (primitive, i) => {
            const geometry = this.geometry(primitive, names);
            const lit = geometry.topology === 'triangles';
            const material = await this.material(primitive.material, geometry.getAttribute('color') !== undefined, lit && !geometry.getAttribute('normal'));
            const mesh = new Mesh3D(geometry, material);
            mesh.name = (def.name ?? 'mesh_' + index) + (primitives.length > 1 ? '_' + i : '');
            if (Array.isArray(def.weights)) mesh.morphWeights.set(def.weights.slice(0, mesh.morphWeights.length));
            return mesh;
        }));
    }

    // ---- nodes, skins, scenes -----------------------------------------------------
    private camera(index: number): Camera3D {
        const def = this.json.cameras?.[index] ?? fail('camera ' + index);
        const camera = new Camera3D(def.type === 'orthographic' ? 'orthographic' : 'perspective');
        if (def.type === 'orthographic') {
            const o = def.orthographic ?? fail('camera.orthographic');
            camera.orthographicHeight = o.ymag * 2; camera.aspect = o.xmag / o.ymag; camera.near = o.znear; camera.far = o.zfar;
        } else {
            const p = def.perspective ?? fail('camera.perspective');
            camera.fov = p.yfov * 180 / Math.PI; camera.aspect = p.aspectRatio ?? 1; camera.near = p.znear; camera.far = p.zfar ?? p.znear * 10000;
        }
        camera.name = def.name ?? 'camera_' + index;
        return camera;
    }
    private light(index: number): Light3D {
        const def = this.json.extensions?.KHR_lights_punctual?.lights?.[index] ?? fail('light ' + index);
        const light = new Light3D(def.type === 'point' ? 'point' : def.type === 'spot' ? 'spot' : 'directional');
        if (Array.isArray(def.color)) light.color.set(def.color);
        light.intensity = def.intensity ?? 1;
        light.range = def.range ?? 0;
        if (def.type === 'spot') {
            const outer = def.spot?.outerConeAngle ?? Math.PI / 4, inner = def.spot?.innerConeAngle ?? 0;
            light.angle = outer; light.penumbra = outer > 0 ? 1 - inner / outer : 0;
        }
        light.name = def.name ?? 'light_' + index;
        return light;
    }
    async build(): Promise<{scenes: Object3D[]; cameras: Camera3D[]; animations: AnimationClip3D[]; defaultScene: number}> {
        const json = this.json, nodeDefs: Json[] = json.nodes ?? [];
        if (nodeDefs.length > GLTF_LIMITS.maxNodes) throw new World3DError('WORLD3D_BUDGET', 'gltf nodes');
        const joints = new Set<number>();
        for (const skin of (json.skins ?? []) as Json[]) for (const joint of skin.joints ?? []) joints.add(joint);
        const usedNames = new Set<string>(), cameras: Camera3D[] = [];
        // Animation tracks bind by name, so every node receives a unique one.
        const unique = (name: string): string => {
            let candidate = name, suffix = 1;
            while (usedNames.has(candidate)) candidate = name + '_' + suffix++;
            usedNames.add(candidate);
            return candidate;
        };
        this.nodes = []; this.nodeMeshes = [];
        for (let i = 0; i < nodeDefs.length; i++) {
            const def = nodeDefs[i]!;
            const meshes = def.mesh !== undefined ? await this.meshes(def.mesh) : [];
            // A single-primitive mesh becomes the node itself; otherwise the
            // node is a plain parent holding one mesh per primitive.
            let node: Object3D;
            if (meshes.length === 1 && !joints.has(i)) node = meshes[0]!;
            else { node = joints.has(i) ? new Bone3D() : new Object3D(); for (const mesh of meshes) node.addChild(mesh); }
            node.name = unique(def.name ?? 'node_' + i);
            for (const mesh of meshes) if (mesh !== node) mesh.name = unique(mesh.name);
            if (Array.isArray(def.matrix)) node.setMatrix(def.matrix);
            else {
                if (Array.isArray(def.translation)) node.position.set(def.translation);
                if (Array.isArray(def.rotation)) node.setQuaternion(def.rotation[0], def.rotation[1], def.rotation[2], def.rotation[3]);
                if (Array.isArray(def.scale)) node.scale.set(def.scale);
                node.markTransformDirty();
            }
            if (Array.isArray(def.weights)) for (const mesh of meshes) mesh.morphWeights.set(def.weights.slice(0, mesh.morphWeights.length));
            if (def.camera !== undefined) { const camera = this.camera(def.camera); camera.name = unique(camera.name); node.addChild(camera); cameras.push(camera); }
            const lightIndex = def.extensions?.KHR_lights_punctual?.light;
            if (lightIndex !== undefined) { const light = this.light(lightIndex); light.name = unique(light.name); node.addChild(light); }
            this.nodes.push(node);
            this.nodeMeshes.push(meshes);
        }
        const parented = new Set<number>();
        nodeDefs.forEach((def, i) => {
            for (const child of (def.children ?? []) as number[]) {
                const node = this.nodes[child] ?? fail('node child');
                if (parented.has(child) || child === i) fail('node hierarchy');
                parented.add(child);
                this.nodes[i]!.addChild(node);
            }
        });
        const scenes = ((json.scenes ?? [{nodes: nodeDefs.map((_, i) => i).filter(i => !parented.has(i))}]) as Json[]).map((def, i) => {
            const root = new Object3D();
            root.name = def.name ?? 'scene_' + i;
            for (const index of (def.nodes ?? []) as number[]) root.addChild(this.nodes[index] ?? fail('scene node'));
            root.updateWorldMatrices();
            return root;
        });
        // Skins need final world matrices only when inverse bind data is absent.
        const skeletons = ((json.skins ?? []) as Json[]).map(skin => {
            const bones = (skin.joints as number[]).map(index => this.nodes[index] ?? fail('skin joint'));
            const inverse = skin.inverseBindMatrices !== undefined ? this.floats(skin.inverseBindMatrices) : undefined;
            return new Skeleton3D(bones, inverse);
        });
        nodeDefs.forEach((def, i) => {
            if (def.skin === undefined) return;
            const skeleton = skeletons[def.skin] ?? fail('node skin');
            for (const mesh of this.nodeMeshes[i]!) {
                // glTF ignores the skinned mesh's own transform: bind in world space.
                if (mesh.geometry.getAttribute('joints') && mesh.geometry.getAttribute('weights')) mesh.bind(skeleton, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
            }
        });
        return {scenes, cameras, animations: this.animations(), defaultScene: json.scene ?? 0};
    }
    private animations(): AnimationClip3D[] {
        return ((this.json.animations ?? []) as Json[]).map((def, index) => {
            const tracks: AnimationTrackInput3D[] = [];
            for (const channel of (def.channels ?? []) as Json[]) {
                const sampler = def.samplers?.[channel.sampler] ?? fail('animation sampler');
                const nodeIndex = channel.target?.node, path = channel.target?.path as string;
                if (nodeIndex === undefined) continue;
                const node = this.nodes[nodeIndex] ?? fail('animation target');
                const mapped: AnimationPath3D | undefined = path === 'translation' ? 'position' : path === 'rotation' ? 'quaternion' : path === 'scale' ? 'scale' : path === 'weights' ? 'weights' : undefined;
                if (!mapped) continue;
                const interpolation: AnimationInterpolation3D = sampler.interpolation === 'STEP' ? 'step' : sampler.interpolation === 'CUBICSPLINE' ? 'cubic' : 'linear';
                const times = this.floats(sampler.input), values = this.floats(sampler.output);
                // Morph weights live on mesh objects, which may be children of the node.
                const targets = mapped === 'weights' ? this.nodeMeshes[nodeIndex]!.map(mesh => mesh.name) : [node.name];
                for (const targetName of targets) tracks.push({targetName, path: mapped, times, values, interpolation});
            }
            return new AnimationClip3D(def.name ?? 'animation_' + index, tracks);
        });
    }
}

/** Split a .glb container, or parse .gltf JSON text, into JSON plus buffers. */
async function unpack(data: Uint8Array | object, options: GltfLoadOptions3D): Promise<{json: Json; buffers: (Uint8Array | undefined)[]}> {
    let json: Json, binary: Uint8Array | undefined;
    if (data instanceof Uint8Array) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        if (data.byteLength >= 12 && view.getUint32(0, true) === 0x46546c67) {
            if (view.getUint32(4, true) !== 2) throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'only glTF 2.0 containers are supported');
            const total = Math.min(view.getUint32(8, true), data.byteLength);
            let offset = 12, text: Uint8Array | undefined;
            while (offset + 8 <= total) {
                const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
                if (offset + 8 + length > total) fail('glb chunk range');
                const chunk = data.subarray(offset + 8, offset + 8 + length);
                if (type === 0x4e4f534a) text = chunk; else if (type === 0x004e4942 && !binary) binary = chunk;
                offset += 8 + length + ((4 - (length % 4)) % 4);
            }
            if (!text) fail('glb without JSON chunk');
            if (text.byteLength > GLTF_LIMITS.maxJsonBytes) throw new World3DError('WORLD3D_BUDGET', 'gltf json');
            try { json = JSON.parse(decodeUtf8(text)); } catch (cause) { fail('json', cause); }
        } else {
            try { json = JSON.parse(decodeUtf8(data)); } catch (cause) { fail('json', cause); }
        }
    } else if (data && typeof data === 'object') json = data as Json;
    else fail('input');
    if (!json || typeof json !== 'object' || json.asset?.version?.[0] !== '2') throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'asset.version');
    for (const extension of (json.extensionsRequired ?? []) as string[]) {
        if (!SUPPORTED_EXTENSIONS.has(extension)) throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'required extension ' + extension);
    }
    const buffers = await Promise.all(((json.buffers ?? []) as Json[]).map(async (def, index) => {
        if (def.uri === undefined) return index === 0 ? binary : undefined;
        const embedded = dataUri(def.uri);
        if (embedded) return embedded.bytes;
        if (!options.loadBuffer) throw new World3DError('WORLD3D_GLTF_UNSUPPORTED', 'loadBuffer is required for external buffers');
        return options.loadBuffer(def.uri);
    }));
    return {json, buffers};
}

/** Parse a glTF 2.0 asset from .glb bytes, .gltf JSON bytes or an already parsed JSON object. */
export async function loadGltf3D(data: Uint8Array | object, options: GltfLoadOptions3D = {}): Promise<GltfAsset3D> {
    const {json, buffers} = await unpack(data, options);
    const reader = new GltfReader(json, buffers, options);
    let built: Awaited<ReturnType<GltfReader['build']>>;
    try { built = await reader.build(); }
    catch (cause) {
        // Never leak partially created resources when loading fails midway.
        for (const resource of [...reader.geometries, ...reader.materials, ...reader.textures]) resource.dispose();
        if (cause instanceof World3DError) throw cause;
        throw new World3DError('WORLD3D_GLTF_INVALID', 'malformed asset', cause);
    }
    const scene = built.scenes[built.defaultScene] ?? built.scenes[0] ?? new Object3D();
    let disposed = false;
    return Object.freeze({
        scene, scenes: Object.freeze(built.scenes), animations: Object.freeze(built.animations), cameras: Object.freeze(built.cameras),
        materials: Object.freeze(reader.materials), textures: Object.freeze(reader.textures), geometries: Object.freeze(reader.geometries),
        dispose(): void {
            if (disposed) return;
            disposed = true;
            for (const resource of [...reader.geometries, ...reader.materials, ...reader.textures]) resource.dispose();
        },
    });
}
