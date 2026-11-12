// SPDX-License-Identifier: Apache-2.0
// Save and restore a World3D subtree as plain JSON-safe data. Node
// transforms, cameras, lights, meshes, materials, geometries, skeletons and
// level-of-detail groups round-trip. Geometry data and small owned textures
// are embedded as base64; other textures are stored by a caller-chosen key
// and resolved again on load, so large images stay outside the saved data.
import {Camera3D} from './Camera3D.js';
import {World3DError} from './core3D.js';
import {Attribute3D, Geometry3D} from './Geometry3D.js';
import type {AttributeArray3D, MorphTarget3D} from './Geometry3D.js';
import {Lod3D, ScreenLayer3D} from './helpers3D.js';
import {Light3D} from './Light3D.js';
import {Material3D} from './Material3D.js';
import {Bone3D, InstancedMesh3D, Mesh3D, Skeleton3D} from './Mesh3D.js';
import {Object3D, Scene3D} from './Object3D.js';
import {ParticleEmitter3D} from './Particles3D.js';
import {RenderTarget3D, Texture3D, isCompressedPixels3D, isTexturePixels3D} from './Texture3D.js';

export const SCENE_DOCUMENT_FORMAT_3D = 'egret.world3d.scene';
export const SCENE_DOCUMENT_VERSION_3D = 1;
export const SERIALIZE3D_LIMITS = Object.freeze({maxNodes: 65536, maxEmbeddedTextureBytes: 1048576, maxDocumentBytes: 268435456} as const);

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface SceneDocument3D {
    readonly format: typeof SCENE_DOCUMENT_FORMAT_3D;
    readonly version: number;
    readonly root: number;
    readonly nodes: readonly Json[];
    readonly geometries: readonly Json[];
    readonly materials: readonly Json[];
    readonly textures: readonly Json[];
    readonly skeletons: readonly Json[];
    /** Names of nodes that were written as plain objects because their type cannot be saved. */
    readonly skipped: readonly string[];
}
export interface SerializeOptions3D {
    /** Stable key for a texture that should be stored by reference, such as its asset id. */
    readonly textureKey?: (texture: Texture3D) => string | undefined;
}
export interface DeserializeOptions3D {
    /** Return the texture for a key written by `textureKey`. */
    readonly resolveTexture?: (key: string) => Texture3D | undefined;
}
export interface DeserializedScene3D {
    readonly root: Object3D;
    readonly cameras: readonly Camera3D[];
    readonly geometries: readonly Geometry3D[];
    readonly materials: readonly Material3D[];
    /** Textures created from embedded pixels; resolved textures stay owned by their provider. */
    readonly textures: readonly Texture3D[];
    /** Release every resource this call created. */
    dispose(): void;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encodeBase64(bytes: Uint8Array): string {
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2];
        out += ALPHABET[a >> 2]! + ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)]!
            + (b === undefined ? '=' : ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)]!) + (c === undefined ? '=' : ALPHABET[c & 63]!);
    }
    return out;
}
function decodeBase64(text: unknown): Uint8Array {
    if (typeof text !== 'string' || text.length % 4 !== 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: base64');
    const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0, out = new Uint8Array(text.length / 4 * 3 - padding);
    let o = 0;
    for (let i = 0; i < text.length; i += 4) {
        let bits = 0;
        for (let k = 0; k < 4; k++) {
            const char = text[i + k]!, value = char === '=' ? 0 : ALPHABET.indexOf(char);
            if (value < 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: base64');
            bits = (bits << 6) | value;
        }
        if (o < out.length) out[o++] = (bits >> 16) & 255;
        if (o < out.length) out[o++] = (bits >> 8) & 255;
        if (o < out.length) out[o++] = bits & 255;
    }
    return out;
}
const ARRAY_TYPES = {f32: Float32Array, u32: Uint32Array, u16: Uint16Array, u8: Uint8Array, i16: Int16Array, i8: Int8Array} as const;
type ArrayTag = keyof typeof ARRAY_TYPES;
function packArray(data: AttributeArray3D): {type: ArrayTag; data: string} {
    const type = (Object.keys(ARRAY_TYPES) as ArrayTag[]).find(tag => data instanceof ARRAY_TYPES[tag])!;
    return {type, data: encodeBase64(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))};
}
function unpackArray(packed: Json): AttributeArray3D {
    const Type = ARRAY_TYPES[packed?.type as ArrayTag];
    if (!Type) throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: array type');
    const bytes = decodeBase64(packed.data);
    if (bytes.byteLength % Type.BYTES_PER_ELEMENT !== 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: array length');
    // Copy into an aligned buffer of the element type.
    return new Type(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}
/** Keep only JSON-representable application data; functions, cycles and class instances are dropped. */
function plainData(value: unknown, depth = 0): unknown {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (depth > 16 || typeof value !== 'object') return undefined;
    if (Array.isArray(value)) return value.map(item => plainData(item, depth + 1) ?? null);
    if (Object.getPrototypeOf(value) !== Object.prototype) return undefined;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) { const plain = plainData(item, depth + 1); if (plain !== undefined) out[key] = plain; }
    return out;
}

const MATERIAL_SCALARS = ['opacity', 'side', 'alphaMode', 'alphaCutoff', 'blending', 'depthTest', 'depthWrite', 'vertexColors', 'fog', 'toneMapped', 'visible',
    'emissiveIntensity', 'normalScale', 'occlusionStrength', 'flatShading', 'wireframe', 'shininess', 'toonSteps', 'clearcoat', 'clearcoatRoughness', 'metallic', 'roughness', 'environmentIntensity', 'billboard',
    'screenSpace', 'sizeAttenuation', 'rotation', 'pointSize'] as const;
const MATERIAL_MAPS = ['map', 'emissiveMap', 'normalMap', 'occlusionMap', 'metallicRoughnessMap'] as const;
const NODE_FLAGS = ['visible', 'layers', 'renderOrder', 'castShadow', 'receiveShadow', 'frustumCulled'] as const;

/** Write the subtree under `root` as JSON-safe data. */
export function serializeScene3D(root: Object3D, options: SerializeOptions3D = {}): SceneDocument3D {
    if (!(root instanceof Object3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'root');
    const nodes: Json[] = [], geometries: Json[] = [], materials: Json[] = [], textures: Json[] = [], skeletons: Json[] = [], skipped: string[] = [];
    const nodeIds = new Map<Object3D, number>(), geometryIds = new Map<Geometry3D, number>(), materialIds = new Map<Material3D, number>();
    const textureIds = new Map<Texture3D, number>(), skeletonIds = new Map<Skeleton3D, number>();
    const pendingSkins: {node: Json; skeleton: Skeleton3D}[] = [];

    const texture = (value: Texture3D | undefined): number | undefined => {
        if (!value || value.isDisposed) return undefined;
        const known = textureIds.get(value);
        if (known !== undefined) return known;
        const entry: Json = {
            name: value.name, wrapS: value.wrapS, wrapT: value.wrapT, magFilter: value.magFilter, minFilter: value.minFilter, mipmaps: value.mipmaps,
            colorSpace: value.colorSpace, flipY: value.flipY, anisotropy: value.anisotropy, offset: [...value.offset], repeat: [...value.repeat], rotation: value.rotation,
        };
        const key = options.textureKey?.(value), source = value.source;
        if (typeof key === 'string' && key.length > 0) entry['key'] = key;
        else if (isTexturePixels3D(source) && source.data.byteLength <= SERIALIZE3D_LIMITS.maxEmbeddedTextureBytes) {
            entry['pixels'] = {width: source.width, height: source.height, data: encodeBase64(source.data)};
        } else if (isCompressedPixels3D(source) && source.levels.reduce((sum, level) => sum + level.byteLength, 0) <= SERIALIZE3D_LIMITS.maxEmbeddedTextureBytes) {
            entry['compressed'] = {width: source.width, height: source.height, format: source.format, levels: source.levels.map(encodeBase64)};
        } else return undefined; // Host images, render targets and large textures need a key.
        textureIds.set(value, textures.length);
        textures.push(entry);
        return textures.length - 1;
    };
    const material = (value: Material3D): number => {
        const known = materialIds.get(value);
        if (known !== undefined) return known;
        const entry: Json = {name: value.name, shading: value.shading, color: [...value.color], emissive: [...value.emissive], specular: [...value.specular]};
        for (const field of MATERIAL_SCALARS) entry[field] = value[field];
        if (value.polygonOffset) entry['polygonOffset'] = [...value.polygonOffset];
        for (const field of MATERIAL_MAPS) { const id = texture(value[field]); if (id !== undefined) entry[field] = id; }
        materialIds.set(value, materials.length);
        materials.push(entry);
        return materials.length - 1;
    };
    const geometry = (value: Geometry3D): number => {
        const known = geometryIds.get(value);
        if (known !== undefined) return known;
        const attributes: Json = {};
        for (const [name, attribute] of value.attributes) attributes[name] = {...packArray(attribute.data), itemSize: attribute.itemSize, normalized: attribute.normalized};
        const entry: Json = {name: value.name, topology: value.topology, attributes, groups: value.groups.map(group => ({...group}))};
        if (value.index) entry['index'] = packArray(value.index.data);
        if (value.morphTargets.length > 0) {
            entry['morphTargets'] = value.morphTargets.map(target => ({
                name: target.name, ...(target.position ? {position: packArray(target.position)} : {}), ...(target.normal ? {normal: packArray(target.normal)} : {}),
            }));
        }
        geometryIds.set(value, geometries.length);
        geometries.push(entry);
        return geometries.length - 1;
    };
    const visit = (object: Object3D, parent: number | undefined): void => {
        if (nodes.length >= SERIALIZE3D_LIMITS.maxNodes) throw new World3DError('WORLD3D_BUDGET', 'saved scene nodes');
        const id = nodes.length;
        const entry: Json = {
            name: object.name, type: 'object', position: [...object.position], quaternion: [...object.quaternion], scale: [...object.scale],
            ...(parent === undefined ? {} : {parent}),
        };
        for (const flag of NODE_FLAGS) entry[flag] = object[flag];
        const userData = plainData(object.userData) as Json | undefined;
        if (userData && Object.keys(userData).length > 0) entry['userData'] = userData;
        nodeIds.set(object, id);
        nodes.push(entry);
        if (object instanceof ParticleEmitter3D || object instanceof ScreenLayer3D) skipped.push(object.name || object.constructor.name);
        else if (object instanceof Scene3D) {
            entry['type'] = 'scene';
            if (Array.isArray(object.background)) entry['background'] = [...object.background];
            entry['backgroundIntensity'] = object.backgroundIntensity; entry['environmentIntensity'] = object.environmentIntensity;
            if (object.fog) entry['fog'] = {...object.fog, color: [...object.fog.color]};
        } else if (object instanceof Camera3D) {
            entry['type'] = 'camera';
            Object.assign(entry, {projection: object.projectionKind, fov: object.fov, orthographicHeight: object.orthographicHeight, aspect: object.aspect,
                near: object.near, far: object.far, zoom: object.zoom, layerMask: object.layerMask});
        } else if (object instanceof Light3D) {
            entry['type'] = 'light';
            Object.assign(entry, {lightType: object.lightType, color: [...object.color], groundColor: [...object.groundColor], intensity: object.intensity,
                range: object.range, angle: object.angle, penumbra: object.penumbra, shadow: {...object.shadow}});
        } else if (object instanceof Mesh3D) {
            entry['type'] = object instanceof InstancedMesh3D ? 'instanced' : 'mesh';
            entry['geometry'] = geometry(object.geometry);
            entry['material'] = Array.isArray(object.material) ? object.material.map(material) : material(object.material);
            if (object.morphWeights.length > 0) entry['morphWeights'] = [...object.morphWeights];
            if (object.skeleton) { entry['bindMatrix'] = [...object.bindMatrix]; pendingSkins.push({node: entry, skeleton: object.skeleton}); }
            if (object instanceof InstancedMesh3D) {
                entry['capacity'] = object.capacity; entry['count'] = object.count; entry['instanceColorSize'] = object.instanceColorSize;
                entry['instanceMatrices'] = packArray(object.instanceMatrices.subarray(0, object.count * 16));
                if (object.instanceColors) entry['instanceColors'] = packArray(object.instanceColors.subarray(0, object.count * object.instanceColorSize));
            }
        } else if (object instanceof Bone3D) entry['type'] = 'bone';
        else if (object instanceof Lod3D) entry['type'] = 'lod';
        for (const child of object.children) visit(child, id);
        if (object instanceof Lod3D) entry['levels'] = object.levels.map(level => ({node: nodeIds.get(level.object), distance: level.distance}));
    };
    visit(root, undefined);
    for (const {node, skeleton} of pendingSkins) {
        let id = skeletonIds.get(skeleton);
        if (id === undefined) {
            const bones = skeleton.bones.map(bone => nodeIds.get(bone));
            // A skeleton whose bones lie outside the saved subtree cannot be restored.
            if (bones.some(bone => bone === undefined)) continue;
            id = skeletons.length;
            skeletonIds.set(skeleton, id);
            skeletons.push({bones, inverseBindMatrices: packArray(skeleton.inverseBindMatrices)});
        }
        node['skeleton'] = id;
    }
    return {format: SCENE_DOCUMENT_FORMAT_3D, version: SCENE_DOCUMENT_VERSION_3D, root: 0, nodes, geometries, materials, textures, skeletons, skipped};
}

function vector(value: unknown, length: number, field: string): number[] {
    if (!Array.isArray(value) || value.length !== length || !value.every(Number.isFinite)) throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: ' + field);
    return value as number[];
}

/** Rebuild a subtree from data produced by serializeScene3D. */
export function deserializeScene3D(saved: SceneDocument3D, options: DeserializeOptions3D = {}): DeserializedScene3D {
    const doc = saved as unknown as Json;
    if (!doc || doc['format'] !== SCENE_DOCUMENT_FORMAT_3D) throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: format');
    if (doc['version'] !== SCENE_DOCUMENT_VERSION_3D) throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: version ' + doc['version']);
    for (const list of ['nodes', 'geometries', 'materials', 'textures', 'skeletons']) if (!Array.isArray(doc[list])) throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: ' + list);
    if (doc['nodes'].length === 0 || doc['nodes'].length > SERIALIZE3D_LIMITS.maxNodes) throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: nodes');
    const created: {dispose(): void}[] = [], ownedTextures: Texture3D[] = [], geometries: Geometry3D[] = [], materials: Material3D[] = [], cameras: Camera3D[] = [];
    try {
        const textures = (doc['textures'] as Json[]).map((entry): Texture3D | undefined => {
            if (typeof entry['key'] === 'string') {
                const resolved = options.resolveTexture?.(entry['key']);
                if (resolved) return resolved;
                return undefined; // A missing reference leaves the slot empty instead of failing the whole scene.
            }
            let source;
            if (entry['pixels']) source = {width: entry['pixels'].width, height: entry['pixels'].height, data: decodeBase64(entry['pixels'].data)};
            else if (entry['compressed']) source = {width: entry['compressed'].width, height: entry['compressed'].height, format: entry['compressed'].format, levels: (entry['compressed'].levels as unknown[]).map(decodeBase64)};
            else throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: texture source');
            const texture = new Texture3D(source, {name: entry['name'], wrapS: entry['wrapS'], wrapT: entry['wrapT'], magFilter: entry['magFilter'], minFilter: entry['minFilter'],
                mipmaps: entry['mipmaps'], colorSpace: entry['colorSpace'], flipY: entry['flipY'], anisotropy: entry['anisotropy']});
            texture.offset.set(vector(entry['offset'], 2, 'texture offset')); texture.repeat.set(vector(entry['repeat'], 2, 'texture repeat')); texture.rotation = entry['rotation'] ?? 0;
            created.push(texture); ownedTextures.push(texture);
            return texture;
        });
        for (const entry of doc['materials'] as Json[]) {
            if (!['unlit', 'lambert', 'phong', 'standard', 'toon', 'matcap'].includes(entry['shading'])) throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: shading');
            const material = new Material3D(entry['shading'], {name: entry['name'] ?? ''});
            created.push(material); materials.push(material);
            material.color.set(vector(entry['color'], 3, 'color')); material.emissive.set(vector(entry['emissive'], 3, 'emissive')); material.specular.set(vector(entry['specular'], 3, 'specular'));
            const target = material as unknown as Json;
            for (const field of MATERIAL_SCALARS) if (entry[field] !== undefined && typeof entry[field] === typeof target[field]) target[field] = entry[field];
            if (entry['polygonOffset']) material.polygonOffset = vector(entry['polygonOffset'], 2, 'polygonOffset') as [number, number];
            for (const field of MATERIAL_MAPS) if (typeof entry[field] === 'number') material[field] = textures[entry[field]];
        }
        for (const entry of doc['geometries'] as Json[]) {
            const geometry = new Geometry3D();
            created.push(geometry); geometries.push(geometry);
            geometry.name = entry['name'] ?? '';
            geometry.topology = entry['topology'];
            // Positions first: the index and morph targets are validated against the vertex count.
            const names = Object.keys(entry['attributes'] ?? {}).sort((a, b) => (a === 'position' ? -1 : 0) - (b === 'position' ? -1 : 0));
            for (const name of names) { const packed = entry['attributes'][name]; geometry.setAttribute(name, new Attribute3D(unpackArray(packed), packed.itemSize, packed.normalized === true)); }
            if (entry['index']) geometry.setIndex(unpackArray(entry['index']) as Uint16Array | Uint32Array);
            for (const group of (entry['groups'] ?? []) as Json[]) geometry.addGroup(group['start'], group['count'], group['materialIndex']);
            if (entry['morphTargets']) {
                geometry.setMorphTargets((entry['morphTargets'] as Json[]).map((target): MorphTarget3D => ({
                    name: target['name'], ...(target['position'] ? {position: unpackArray(target['position']) as Float32Array} : {}),
                    ...(target['normal'] ? {normal: unpackArray(target['normal']) as Float32Array} : {}),
                })));
            }
        }
        const pick = <T>(list: readonly T[], index: unknown, field: string): T => {
            const item = typeof index === 'number' ? list[index] : undefined;
            if (item === undefined) throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: ' + field);
            return item;
        };
        const nodes = (doc['nodes'] as Json[]).map((entry): Object3D => {
            let node: Object3D;
            switch (entry['type']) {
                case 'scene': {
                    const scene = new Scene3D();
                    if (entry['background']) scene.background = vector(entry['background'], 3, 'background') as [number, number, number];
                    scene.backgroundIntensity = entry['backgroundIntensity'] ?? 1; scene.environmentIntensity = entry['environmentIntensity'] ?? 1;
                    if (entry['fog']) scene.fog = entry['fog'];
                    node = scene; break;
                }
                case 'camera': {
                    const camera = new Camera3D(entry['projection'] === 'orthographic' ? 'orthographic' : 'perspective');
                    camera.fov = entry['fov']; camera.orthographicHeight = entry['orthographicHeight']; camera.aspect = entry['aspect'];
                    camera.near = entry['near']; camera.far = entry['far']; camera.zoom = entry['zoom']; camera.layerMask = entry['layerMask'];
                    cameras.push(camera); node = camera; break;
                }
                case 'light': {
                    const light = new Light3D(entry['lightType']);
                    light.color.set(vector(entry['color'], 3, 'light color')); light.groundColor.set(vector(entry['groundColor'], 3, 'ground color'));
                    light.intensity = entry['intensity']; light.range = entry['range']; light.angle = entry['angle']; light.penumbra = entry['penumbra'];
                    Object.assign(light.shadow, entry['shadow']);
                    node = light; break;
                }
                case 'mesh': case 'instanced': {
                    const geometry = pick(geometries, entry['geometry'], 'mesh geometry');
                    const material = Array.isArray(entry['material']) ? (entry['material'] as unknown[]).map(index => pick(materials, index, 'mesh material')) : pick(materials, entry['material'], 'mesh material');
                    if (entry['type'] === 'instanced') {
                        const mesh = new InstancedMesh3D(geometry, material, entry['capacity'], entry['instanceColorSize'] === 4 ? 4 : 3);
                        mesh.count = Math.min(entry['count'], mesh.capacity);
                        mesh.instanceMatrices.set(unpackArray(entry['instanceMatrices']).subarray(0, mesh.count * 16));
                        if (entry['instanceColors']) { mesh.instanceColors = new Float32Array(mesh.capacity * mesh.instanceColorSize).fill(1); mesh.instanceColors.set(unpackArray(entry['instanceColors']).subarray(0, mesh.count * mesh.instanceColorSize)); }
                        mesh.instanceVersion++;
                        node = mesh;
                    } else node = new Mesh3D(geometry, material);
                    const mesh = node as Mesh3D;
                    if (entry['morphWeights']) { mesh.syncMorphWeights(); mesh.morphWeights.set((entry['morphWeights'] as number[]).slice(0, mesh.morphWeights.length)); }
                    break;
                }
                case 'bone': node = new Bone3D(); break;
                case 'lod': node = new Lod3D(); break;
                default: node = new Object3D();
            }
            node.name = typeof entry['name'] === 'string' ? entry['name'] : '';
            node.position.set(vector(entry['position'], 3, 'position')); node.quaternion.set(vector(entry['quaternion'], 4, 'quaternion')); node.scale.set(vector(entry['scale'], 3, 'scale'));
            node.markTransformDirty();
            const target = node as unknown as Json;
            for (const flag of NODE_FLAGS) if (typeof entry[flag] === typeof target[flag]) target[flag] = entry[flag];
            if (entry['userData']) node.userData = plainData(entry['userData']) as Record<string, unknown>;
            return node;
        });
        // Parents always precede their children in the saved data, so one pass links the tree.
        (doc['nodes'] as Json[]).forEach((entry, index) => {
            if (entry['parent'] === undefined) return;
            if (typeof entry['parent'] !== 'number' || entry['parent'] >= index) throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: parent order');
            const parent = nodes[entry['parent']]!, node = nodes[index]!;
            if (parent instanceof Lod3D) return; // Level-of-detail children are attached with their distances below.
            parent.addChild(node);
        });
        (doc['nodes'] as Json[]).forEach((entry, index) => {
            const node = nodes[index]!;
            if (node instanceof Lod3D) for (const level of (entry['levels'] ?? []) as Json[]) node.addLevel(pick(nodes, level['node'], 'lod level'), level['distance']);
        });
        const root = pick(nodes, doc['root'], 'root');
        root.updateWorldMatrices();
        const skeletons = (doc['skeletons'] as Json[]).map(entry => new Skeleton3D((entry['bones'] as unknown[]).map(index => pick(nodes, index, 'bone')), unpackArray(entry['inverseBindMatrices']) as Float32Array));
        (doc['nodes'] as Json[]).forEach((entry, index) => {
            if (entry['skeleton'] === undefined) return;
            const mesh = nodes[index];
            if (mesh instanceof Mesh3D) mesh.bind(pick(skeletons, entry['skeleton'], 'skeleton'), vector(entry['bindMatrix'], 16, 'bindMatrix'));
        });
        let disposed = false;
        return Object.freeze({
            root, cameras: Object.freeze(cameras), geometries: Object.freeze(geometries), materials: Object.freeze(materials), textures: Object.freeze(ownedTextures),
            dispose(): void {
                if (disposed) return;
                disposed = true;
                for (const resource of created) resource.dispose();
            },
        });
    } catch (cause) {
        // Never leak partially created resources when the input is refused midway.
        for (const resource of created) resource.dispose();
        if (cause instanceof World3DError) throw cause;
        throw new World3DError('WORLD3D_INPUT_INVALID', 'saved scene: malformed', cause);
    }
}
void RenderTarget3D;
