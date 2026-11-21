// SPDX-License-Identifier: Apache-2.0
// Writes a model as a binary glTF (.glb): a mesh made in code saved once and loaded fast after, opened in Blender to be
// touched up, or handed to another tool. Geometry (positions, normals, vertex colours, texture coordinates, indices,
// material groups), the node tree with each node's position, rotation and scale, and each material's colour,
// opacity, metalness and roughness are written. Textures, skins, morph targets and animations are not.
import { World3DError } from './core3D.js';
import { Geometry3D } from './Geometry3D.js';
import type { Attribute3D } from './Geometry3D.js';
import type { Material3D } from './Material3D.js';
import { Mesh3D } from './Mesh3D.js';
import { Object3D } from './Object3D.js';

/** How a model is written. */
export interface GlbExportOptions3D {
  /** The name of the root node; that of the object, or 'model', unless given. */
  readonly name?: string;
}

interface Json {
  asset: { version: string; generator: string };
  scene: number;
  scenes: { nodes: number[] }[];
  nodes: Record<string, unknown>[];
  meshes: { primitives: Record<string, unknown>[] }[];
  materials: Record<string, unknown>[];
  accessors: Record<string, unknown>[];
  bufferViews: Record<string, unknown>[];
  buffers: { byteLength: number }[];
}

const FLOAT = 5126,
  UNSIGNED_SHORT = 5123,
  UNSIGNED_INT = 5125;
const ARRAY_BUFFER = 34962,
  ELEMENT_ARRAY_BUFFER = 34963;
const TYPES: Record<number, string> = { 1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4' };
const NAMES: Record<string, string> = { position: 'POSITION', normal: 'NORMAL', color: 'COLOR_0', uv: 'TEXCOORD_0' };

function invalid(what: string): World3DError {
  return new World3DError('WORLD3D_INPUT_INVALID', what);
}

/** UTF-8 bytes of a string; this module runs where no TextEncoder is promised. */
function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

/** The attribute's values as floats, normalized integers turned into 0 to 1 (or -1 to 1). */
function floats(attribute: Attribute3D): Float32Array {
  const data = attribute.data;
  if (data instanceof Float32Array) return data;
  const out = new Float32Array(data.length);
  let scale = 1;
  if (attribute.normalized) {
    if (data instanceof Uint8Array) scale = 1 / 255;
    else if (data instanceof Uint16Array) scale = 1 / 65535;
    else if (data instanceof Int8Array) scale = 1 / 127;
    else if (data instanceof Int16Array) scale = 1 / 32767;
  }
  for (let i = 0; i < data.length; i++) out[i] = data[i]! * scale;
  return out;
}

/**
 * The model as the bytes of a .glb file: a geometry alone (with a plain material that shows its vertex colours), or an
 * object and everything under it. Meshes that draw lines or points are left out.
 */
export function exportGlb3D(source: Geometry3D | Object3D, options: GlbExportOptions3D = {}): Uint8Array {
  if (!(source instanceof Geometry3D) && !(source instanceof Object3D)) throw invalid('export source');
  if (options === null || typeof options !== 'object') throw invalid('export options');
  if (options.name !== undefined && typeof options.name !== 'string') throw invalid('export name');
  const json: Json = {
    asset: { version: '2.0', generator: 'Egret Engine World3D' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [],
    meshes: [],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: []
  };
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  const view = (bytes: Uint8Array, target: number): number => {
    const pad = (4 - (byteLength % 4)) % 4;
    if (pad > 0) {
      chunks.push(new Uint8Array(pad));
      byteLength += pad;
    }
    json.bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.byteLength, target });
    chunks.push(bytes);
    byteLength += bytes.byteLength;
    return json.bufferViews.length - 1;
  };
  const accessor = (values: Float32Array | Uint16Array | Uint32Array, size: number, extra: object): number => {
    const bytes = new Uint8Array(values.buffer.slice(values.byteOffset, values.byteOffset + values.byteLength));
    const isIndex = !(values instanceof Float32Array);
    json.accessors.push({
      bufferView: view(bytes, isIndex ? ELEMENT_ARRAY_BUFFER : ARRAY_BUFFER),
      componentType:
        values instanceof Float32Array ? FLOAT : values instanceof Uint16Array ? UNSIGNED_SHORT : UNSIGNED_INT,
      count: values.length / size,
      type: TYPES[size],
      ...extra
    });
    return json.accessors.length - 1;
  };

  const materialIndex = new Map<Material3D | null, number>();
  const material = (m: Material3D | null): number => {
    const known = materialIndex.get(m);
    if (known !== undefined) return known;
    const entry: Record<string, unknown> =
      m === null
        ? {
            name: 'vertex colours',
            pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.8 }
          }
        : {
            name: m.name || undefined,
            pbrMetallicRoughness: {
              baseColorFactor: [m.color[0], m.color[1], m.color[2], m.opacity],
              metallicFactor: m.metallic,
              roughnessFactor: m.roughness
            },
            ...(m.opacity < 1 ? { alphaMode: 'BLEND' } : {}),
            ...(m.side === 'double' ? { doubleSided: true } : {})
          };
    json.materials.push(entry);
    materialIndex.set(m, json.materials.length - 1);
    return json.materials.length - 1;
  };

  const meshIndex = new Map<string, number>();
  const ids = new WeakMap<object, number>();
  let nextId = 1;
  const idOf = (o: object): number => {
    let id = ids.get(o);
    if (id === undefined) ids.set(o, (id = nextId++));
    return id;
  };
  const attributesOf = new Map<Geometry3D, Record<string, number>>();
  const mesh = (geometry: Geometry3D, materials: readonly (Material3D | null)[]): number | undefined => {
    if (geometry.topology !== 'triangles') return undefined;
    const position = geometry.getAttribute('position');
    if (!position || position.itemSize !== 3 || position.count === 0) return undefined;
    const key = idOf(geometry) + ':' + materials.map(m => (m === null ? 0 : idOf(m))).join(',');
    const known = meshIndex.get(key);
    if (known !== undefined) return known;
    let attributes = attributesOf.get(geometry);
    if (attributes === undefined) {
      attributes = {};
      for (const [name, gltfName] of Object.entries(NAMES)) {
        const attribute = geometry.getAttribute(name);
        if (!attribute) continue;
        if (name === 'position') {
          const p = floats(attribute),
            min = [Infinity, Infinity, Infinity],
            max = [-Infinity, -Infinity, -Infinity];
          for (let i = 0; i < p.length; i += 3)
            for (let a = 0; a < 3; a++) {
              min[a] = Math.min(min[a]!, p[i + a]!);
              max[a] = Math.max(max[a]!, p[i + a]!);
            }
          attributes[gltfName] = accessor(p, 3, { min, max });
        } else if ((name === 'color' && (attribute.itemSize === 3 || attribute.itemSize === 4)) || name !== 'color')
          attributes[gltfName] = accessor(floats(attribute), attribute.itemSize, {});
      }
      attributesOf.set(geometry, attributes);
    }
    const count = position.count;
    const index = geometry.index ? Array.from(geometry.index.data) : Array.from({ length: count }, (_, i) => i);
    const ranges =
      geometry.groups.length > 0
        ? geometry.groups.map(g => ({ start: g.start, count: g.count, material: g.materialIndex }))
        : [{ start: 0, count: index.length, material: 0 }];
    const primitives: Record<string, unknown>[] = [];
    for (const range of ranges) {
      const part = index.slice(range.start, range.start + range.count);
      if (part.length === 0) continue;
      const values = count > 65535 ? Uint32Array.from(part) : Uint16Array.from(part);
      primitives.push({
        attributes,
        indices: accessor(values, 1, {}),
        material: material(materials[Math.min(range.material, materials.length - 1)] ?? null),
        mode: 4
      });
    }
    if (primitives.length === 0) return undefined;
    json.meshes.push({ primitives });
    meshIndex.set(key, json.meshes.length - 1);
    return json.meshes.length - 1;
  };

  const node = (object: Object3D): number => {
    const entry: Record<string, unknown> = {};
    if (object.name) entry.name = object.name;
    const [px, py, pz] = object.position,
      [qx, qy, qz, qw] = object.quaternion,
      [sx, sy, sz] = object.scale;
    if (px !== 0 || py !== 0 || pz !== 0) entry.translation = [px, py, pz];
    if (qx !== 0 || qy !== 0 || qz !== 0 || qw !== 1) entry.rotation = [qx, qy, qz, qw];
    if (sx !== 1 || sy !== 1 || sz !== 1) entry.scale = [sx, sy, sz];
    if (object instanceof Mesh3D) {
      const list = Array.isArray(object.material) ? object.material : [object.material];
      const m = mesh(object.geometry, list);
      if (m !== undefined) entry.mesh = m;
    }
    json.nodes.push(entry);
    const at = json.nodes.length - 1;
    const children = object.children.map(node);
    if (children.length > 0) entry.children = children;
    return at;
  };

  if (source instanceof Geometry3D) {
    const m = mesh(source, [null]);
    if (m === undefined) throw invalid('export geometry');
    json.nodes.push({ name: options.name ?? 'model', mesh: m });
  } else {
    node(source);
    if (options.name !== undefined) json.nodes[0]!.name = options.name;
    else if (json.nodes[0]!.name === undefined) json.nodes[0]!.name = 'model';
  }
  if (json.materials.length === 0) delete (json as Partial<Json>).materials;
  if (json.meshes.length === 0) delete (json as Partial<Json>).meshes;
  if (byteLength === 0) {
    delete (json as Partial<Json>).accessors;
    delete (json as Partial<Json>).bufferViews;
    delete (json as Partial<Json>).buffers;
  } else json.buffers.push({ byteLength: byteLength + ((4 - (byteLength % 4)) % 4) });

  const text = utf8(JSON.stringify(json));
  const jsonLength = text.byteLength + ((4 - (text.byteLength % 4)) % 4);
  const binLength = byteLength === 0 ? 0 : byteLength + ((4 - (byteLength % 4)) % 4);
  const total = 12 + 8 + jsonLength + (binLength > 0 ? 8 + binLength : 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLength, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(text, 20);
  out.fill(0x20, 20 + text.byteLength, 20 + jsonLength);
  if (binLength > 0) {
    let at = 20 + jsonLength;
    dv.setUint32(at, binLength, true);
    dv.setUint32(at + 4, 0x004e4942, true);
    at += 8;
    for (const chunk of chunks) {
      out.set(chunk, at);
      at += chunk.byteLength;
    }
  }
  return out;
}
