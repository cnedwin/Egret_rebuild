// SPDX-License-Identifier: Apache-2.0
import { InstancedMesh3D, RenderList3D } from '@egret/engine/world3d';

// Full packets are self-contained checkpoints. Deltas carry the complete draw list
// and only reference geometry retained by the acknowledged draw in the same device epoch.
const MAGIC = 0x31443345,
  TEXTURED_MAGIC = 0x32443345,
  DELTA_MAGIC = 0x33443345,
  TEXTURED_DELTA_MAGIC = 0x34443345,
  SKINNED_MAGIC = 0x35443345,
  SKINNED_DELTA_MAGIC = 0x36443345,
  STREAM_MAGIC = 0x37443345,
  BATCH_MAGIC = 0x31473345;
const HEADER = 160,
  DRAW = 88,
  TEXTURED_DRAW = 96,
  SKINNED_DRAW = 128,
  MAX_JOINTS = 56,
  BYTE_LIMIT = 360472,
  TEXTURED_BYTE_LIMIT = 2 * 1024 * 1024,
  RESIDENT_LIMIT = 16 * 1024 * 1024,
  BATCH_HEADER = 24;
const hudFormats = new Set([0x32524745, 0x33524745, 0x34524745, 0x35524745]);

function reject(reason) {
  throw new RangeError('Android World3D profile: ' + reason);
}
function vector(view, offset, values, length) {
  for (let i = 0; i < length; i++) {
    const number = Math.fround(values[i]);
    if (!Number.isFinite(number)) reject('nonfinite vector');
    view.setFloat32(offset + 4 * i, number, true);
  }
}
function colorByte(linear) {
  if (!Number.isFinite(linear) || linear < 0 || linear > 1) reject('background component');
  return Math.round(255 * (linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055));
}
function packGeometry(cache, geometry, texturedFormat, skinFormat) {
  const stride = skinFormat ? 68 : texturedFormat ? 32 : 24;
  const joints = skinFormat ? geometry.getAttribute('joints') : undefined;
  const weights = skinFormat ? geometry.getAttribute('weights') : undefined;
  const colors = skinFormat ? geometry.getAttribute('color') : undefined;
  const uv = texturedFormat ? geometry.getAttribute('uv') : undefined;
  const positions = geometry.getAttribute('position'),
    normals = geometry.getAttribute('normal'),
    index = geometry.index;
  if (
    geometry.isDisposed ||
    geometry.topology !== 'triangles' ||
    geometry.morphTargets.length ||
    positions?.itemSize !== 3 ||
    normals?.itemSize !== 3 ||
    !(positions.data instanceof Float32Array) ||
    !(normals.data instanceof Float32Array) ||
    normals.count !== positions.count ||
    index?.itemSize !== 1 ||
    !index.count ||
    index.count % 3 !== 0 ||
    positions.count < 3 ||
    !Number.isSafeInteger(geometry.id) ||
    geometry.id < 1 ||
    geometry.id > 0xffffffff
  )
    reject('indexed position/normal triangles required');
  if (uv && (uv.itemSize !== 2 || !(uv.data instanceof Float32Array) || uv.count !== positions.count))
    reject('invalid texture coordinates');
  if (Boolean(joints) !== Boolean(weights) || (joints && (joints.itemSize !== 4 || weights.itemSize !== 4 ||
      joints.count !== positions.count || weights.count !== positions.count)))
    reject('expected four joints and weights per vertex');
  if (colors && ((colors.itemSize !== 3 && colors.itemSize !== 4) || colors.count !== positions.count))
    reject('invalid vertex colors');
  const old = cache.get(geometry);
  if (
    old &&
    old.stride === stride &&
    old.uv === uv?.version &&
    old.joints === joints?.version &&
    old.weights === weights?.version &&
    old.colors === colors?.version &&
    old.layout === geometry.layoutVersion &&
    old.vertices === positions.version &&
    old.normals === normals.version &&
    old.indices === index.version
  )
    return old;
  const length = 12 + positions.count * stride + index.count * 4;
  if (
    length >
    (skinFormat ? TEXTURED_BYTE_LIMIT - BATCH_HEADER :
      (texturedFormat ? TEXTURED_BYTE_LIMIT : BYTE_LIMIT) - HEADER - (texturedFormat ? TEXTURED_DRAW : DRAW) - 24)
  )
    reject('geometry exceeds frame budget');
  const bytes = new Uint8Array(length),
    view = new DataView(bytes.buffer);
  view.setUint32(0, geometry.id, true);
  view.setUint32(4, positions.count, true);
  view.setUint32(8, index.count, true);
  let offset = 12, maxJoint = 0;
  for (let i = 0; i < positions.count; i++, offset += stride) {
    vector(view, offset, positions.data.subarray(3 * i, 3 * i + 3), 3);
    vector(view, offset + 12, normals.data.subarray(3 * i, 3 * i + 3), 3);
    if (uv) vector(view, offset + 24, uv.data.subarray(2 * i, 2 * i + 2), 2);
    if (skinFormat) {
      for (let channel = 0; channel < 4; channel++) {
        const joint = joints ? joints.data[i * 4 + channel] : 0;
        const weight = weights ? weights.data[i * 4 + channel] : Number(channel === 0);
        const color = colors && channel < colors.itemSize ? colors.data[i * colors.itemSize + channel] : 1;
        if (!Number.isInteger(joint) || joint < 0 || joint >= MAX_JOINTS ||
            !Number.isFinite(weight) || weight < 0 || weight > 1 ||
            !Number.isFinite(color) || color < 0 || color > 1) reject('invalid skin or color attribute');
        maxJoint = Math.max(maxJoint, joint);
        view.setUint8(offset + 32 + channel, joint);
        view.setFloat32(offset + 36 + channel * 4, weight, true);
        view.setFloat32(offset + 52 + channel * 4, color, true);
      }
    }
  }
  for (const value of index.data) {
    if (!Number.isInteger(value) || value < 0 || value >= positions.count) reject('index outside geometry');
    view.setUint32(offset, value, true);
    offset += 4;
  }
  const packed = {
    stride, maxJoint,
    joints: joints?.version,
    weights: weights?.version,
    colors: colors?.version,
    uv: uv?.version,
    layout: geometry.layoutVersion,
    vertices: positions.version,
    normals: normals.version,
    indices: index.version,
    bytes
  };
  cache.set(geometry, packed);
  return packed;
}

function supportedDraw({ mesh, material: m, geometry, start, count }) {
  if (mesh instanceof InstancedMesh3D || start !== 0 || count !== geometry.index?.count)
    reject('expected whole indexed mesh');
  if (mesh.skeleton && (!geometry.getAttribute('joints') || !geometry.getAttribute('weights')))
    reject('skinned mesh missing joint or weight attributes');
  // Normal-mapped meshes without authored tangents use the browser's UV derivative basis.
  if (m.normalMap && geometry.getAttribute('tangent')) reject('authored tangents with a normal map');
  if (m.vertexColors && !geometry.getAttribute('color')) reject('missing vertex color attribute');
  if (
    m.shading !== 'standard' ||
    (m.side !== 'front' && m.side !== 'double') ||
    m.alphaMode !== 'opaque' ||
    m.opacity !== 1 ||
    !m.depthTest ||
    !m.depthWrite ||
    m.blending !== 'normal' ||
    !m.toneMapped ||
    m.flatShading ||
    m.wireframe ||
    m.occlusionMap ||
    m.emissiveMap ||
    m.lightMap ||
    m.splat ||
    m.shader ||
    m.reflectionMap ||
    m.sheen ||
    m.transmission ||
    m.clearcoat ||
    m.billboard ||
    m.screenSpace ||
    m.polygonOffset
  )
    reject('unsupported Standard material');
  if ([m.roughness, m.metallic, ...m.color].some((x) => !Number.isFinite(x) || x < 0 || x > 1))
    reject('invalid material parameters');
}

// Image identity is shared with the 2D page registry. A replacement invalidates the
// old binding even when the numerical page ID is immediately reused.
function texturePage(map, geometry, pages, colorSpace) {
  if (!map) return 0;
  if (
    map.isDisposed ||
    map.colorSpace !== colorSpace ||
    map.flipY ||
    map.channel !== 0 ||
    map.hasTransform ||
    map.wrapS !== 'repeat' ||
    map.wrapT !== 'repeat' ||
    map.magFilter !== 'linear' ||
    map.minFilter !== 'linear' ||
    !map.mipmaps ||
    map.anisotropy !== 1
  )
    reject('unsupported texture sampler');
  if (!geometry.getAttribute('uv')) reject('texture requires UVs');
  const page = pages?.get(map.source);
  if (!Number.isInteger(page) || page < 1 || page > 255) reject('texture has no live page');
  return page;
}

// Batches reference immutable definitions until requested by a host; no combined checkpoint is allocated.
function planBatches(geometries, acknowledged) {
  const batches = [];
  let batch;
  for (const [geometry, bytes] of geometries) {
    if (acknowledged?.get(geometry) === bytes) continue;
    if (!batch || batch.length + bytes.length > TEXTURED_BYTE_LIMIT) {
      batch = { length: BATCH_HEADER, definitions: [] };
      batches.push(batch);
    }
    batch.definitions.push(bytes);
    batch.length += bytes.length;
  }
  return batches;
}

export function createWorldProjectEncoder() {
  const cache = new WeakMap(),
    list = new RenderList3D();
  // This profile draws individual objects and only shares the underlying GPU geometry.
  list.autoInstanceThreshold = 0;
  let previous;
  function encode({ scene, camera }, hud, pages, epoch, previousFrameId) {
    if (!(hud instanceof Uint8Array) || hud.byteLength < 24 || hud.byteLength > BYTE_LIMIT) reject('HUD length');
    const h = new DataView(hud.buffer, hud.byteOffset, hud.byteLength);
    if (!hudFormats.has(h.getUint32(0, true)) || h.getUint8(16) !== 0) reject('transparent HUD required');
    if (
      scene.environment ||
      scene.fog ||
      scene.clippingPlanes.length ||
      (scene.background !== undefined && !Array.isArray(scene.background))
    )
      reject('unsupported scene settings');
    // The Android view fits its surface to the logical stage. Match the browser
    // host before building the list so culling and drawing use the same lens.
    const width = h.getUint32(8, true),
      height = h.getUint32(12, true);
    if (!width || width > 16384 || !height || height > 16384) reject('HUD dimensions');
    camera.aspect = width / height;
    list.build(scene, camera);
    if (
      list.transparent.length ||
      list.spotLights.length ||
      list.pointLights.length ||
      list.directionalLights.length > 1 ||
      list.opaque.length > 4096
    )
      reject('unsupported lights or draws');
    const skinFormat = list.opaque.some(({ mesh, material }) =>
      mesh.skeleton || material.vertexColors || material.normalMap || material.metallicRoughnessMap ||
      material.emissive.some((component) => component !== 0));
    const extended = skinFormat || list.opaque.some(({ material }) => material.map || material.side === 'double');
    const format = skinFormat ? SKINNED_MAGIC : extended ? TEXTURED_MAGIC : MAGIC;
    const frameId = h.getUint32(4, true);
    const tracked = Number.isSafeInteger(epoch) && epoch >= 0;
    // The Java player permits one frame in flight. Encoding or enqueueing alone does not establish residency.
    const acknowledged = tracked && previous?.epoch === epoch && previous.id === previousFrameId &&
      frameId === ((previousFrameId + 1) >>> 0) ? previous.geometry : undefined;
    const drawBytes = skinFormat ? SKINNED_DRAW : extended ? TEXTURED_DRAW : DRAW;
    const palettes = new Map();
    let paletteBytes = 0;
    const limit = extended ? TEXTURED_BYTE_LIMIT : BYTE_LIMIT;
    const geometryBytes = new Map();
    let size = HEADER + (skinFormat ? 4 : 0) + drawBytes * list.opaque.length + hud.byteLength;
    let totalGeometry = 0;
    let reusedCount = 0, reusedBytes = 0;
    const base = previous?.format === format ? acknowledged : undefined;
    for (const item of list.opaque) {
      supportedDraw(item);
      const packed = packGeometry(cache, item.geometry, extended, skinFormat);
      const skeleton = item.mesh.skeleton;
      if (skeleton) {
        const count = skeleton.bones.length;
        if (!count || count > MAX_JOINTS || packed.maxJoint >= count) reject('joint outside skin palette');
        if (!palettes.has(skeleton)) {
          palettes.set(skeleton, palettes.size + 1);
          paletteBytes += 4 + 64 * count;
        }
      }
      if (!geometryBytes.has(item.geometry)) {
        const bytes = packed.bytes;
        size += bytes.length;
        totalGeometry += bytes.length;
        if (totalGeometry > RESIDENT_LIMIT) reject('visible geometry exceeds residency budget');
        if (geometryBytes.size >= 64) reject('more than 64 distinct visible geometries in the frame');
        geometryBytes.set(item.geometry, bytes);
        if (base?.get(item.geometry) === bytes) {
          reusedCount++;
          reusedBytes += bytes.length;
        }
      }
    }
    size += paletteBytes;
    // Keep a streamed scene in its resident profile when culling briefly shrinks the visible set.
    const stream = skinFormat && (size > limit || (tracked && previous?.epoch === epoch && previous.format === STREAM_MAGIC));
    if (!stream && size > limit) reject('HUD and draws exceed ' + limit + ' frame bytes (' + size + ')');
    if (stream && !tracked) reject('streamed geometry requires a device epoch');
    const streamBase = previous?.format === STREAM_MAGIC ? acknowledged : undefined;
    const batches = stream ? planBatches(geometryBytes, streamBase) : undefined;
    const delta = !stream && reusedCount > 0;
    const packetSize = stream ? size - totalGeometry + 12 : delta ? size - reusedBytes + 4 : size;
    if (packetSize > limit) reject('draw packet exceeds frame budget');
    const bytes = new Uint8Array(packetSize),
      v = new DataView(bytes.buffer);
    const bg = scene.background ?? [0, 0, 0];
    const rgba = ((colorByte(bg[0]) * 256 + colorByte(bg[1])) * 256 + colorByte(bg[2])) * 256 + 255;
    [
      stream ? STREAM_MAGIC : delta ? (skinFormat ? SKINNED_DELTA_MAGIC : extended ? TEXTURED_DELTA_MAGIC : DELTA_MAGIC) : format,
      frameId,
      hud.byteLength,
      stream ? 0 : geometryBytes.size - reusedCount,
      list.opaque.length,
      rgba
    ].forEach((n, i) => v.setUint32(i * 4, n, true));
    vector(v, 24, camera.viewProjectionMatrix, 16);
    vector(v, 88, camera.matrixWorld.subarray(12, 15), 3);
    const sun = list.directionalLights[0];
    if (sun) {
      // Local -Z is the direction of travel of the light. The shader wants the direction toward it.
      const m = sun.matrixWorld,
        len = Math.hypot(m[8], m[9], m[10]);
      if (!(len > 0)) reject('directional light has no direction');
      vector(v, 100, [m[8] / len, m[9] / len, m[10] / len], 3);
      vector(
        v,
        112,
        sun.color.map((x) => x * sun.intensity),
        3
      );
    } else vector(v, 100, [0, 1, 0], 3);
    vector(v, 124, list.hemisphereSky, 3);
    vector(v, 136, list.hemisphereGround, 3);
    vector(v, 148, list.ambient, 3);
    let offset = HEADER;
    if (stream) {
      v.setUint32(offset, streamBase ? 0 : 1, true);
      v.setUint32(offset + 4, streamBase ? previousFrameId : 0, true);
      v.setUint32(offset + 8, batches.length, true);
      offset += 12;
    } else if (delta) {
      v.setUint32(offset, previousFrameId, true);
      offset += 4;
    }
    if (skinFormat) {
      v.setUint32(offset, paletteBytes, true);
      offset += 4;
    }
    for (const [geometry, packed] of geometryBytes) {
      if (stream || base?.get(geometry) === packed) continue;
      bytes.set(packed, offset);
      offset += packed.length;
    }
    // All primitives sharing a skeleton reference the same pose. Definitions stay resident.
    const tailOffset = offset;
    for (const skeleton of palettes.keys()) {
      v.setUint32(offset, skeleton.bones.length, true);
      vector(v, offset + 4, skeleton.boneMatrices, skeleton.boneMatrices.length);
      offset += 4 + skeleton.boneMatrices.byteLength;
    }
    for (const item of list.opaque) {
      v.setUint32(offset, item.geometry.id, true);
      // The palette already contains world transforms. Apply only the original mesh bind matrix.
      vector(v, offset + 4, item.mesh.skeleton ? item.mesh.bindMatrix : item.mesh.matrixWorld, 16);
      vector(v, offset + 68, item.material.color, 3);
      v.setFloat32(offset + 80, item.material.roughness, true);
      v.setFloat32(offset + 84, item.material.metallic, true);
      if (extended) {
        v.setUint32(offset + 88, texturePage(item.material.map, item.geometry, pages, 'srgb'), true);
        v.setUint32(offset + 92, (item.material.side === 'double' ? 1 : 0) | (item.material.vertexColors ? 2 : 0), true);
      }
      if (skinFormat) {
        v.setUint32(offset + 96, texturePage(item.material.metallicRoughnessMap, item.geometry, pages, 'linear'), true);
        v.setUint32(offset + 100, texturePage(item.material.normalMap, item.geometry, pages, 'linear'), true);
        v.setUint32(offset + 104, palettes.get(item.mesh.skeleton) ?? 0, true);
        vector(v, offset + 108, [item.material.normalScale, item.material.normalScale], 2);
        for (let lane = 0; lane < 3; lane++) {
          const emission = Math.fround(item.material.emissive[lane] * item.material.emissiveIntensity);
          if (!Number.isFinite(emission) || emission < 0) reject('invalid emissive color');
          v.setFloat32(offset + 116 + 4 * lane, emission, true);
        }
      }
      offset += drawBytes;
    }
    bytes.set(hud, offset);
    previous = tracked ? {epoch, id: frameId, format: stream ? STREAM_MAGIC : format, geometry: geometryBytes,
      streamDraw: stream ? bytes : undefined, batches,
      delta: delta ? bytes : undefined, tailOffset, paletteBytes, fullSize: size} : undefined;
    return bytes;
  }

  // A rejected delta still describes one precise game tick. Reconstruct its full wire
  // image from the original draw/HUD and immutable definitions, without advancing the game.
  encode.geometryBatch = (epoch, frameId, ordinal) => {
    if (previous?.epoch !== epoch || previous?.id !== frameId || !Number.isInteger(ordinal) ||
        !previous?.batches?.[ordinal]) reject('geometry batch unavailable');
    const batch = previous.batches[ordinal];
    const bytes = new Uint8Array(batch.length);
    const view = new DataView(bytes.buffer);
    [BATCH_MAGIC, frameId, ordinal, previous.batches.length, batch.definitions.length, SKINNED_MAGIC]
      .forEach((value, index) => view.setUint32(index * 4, value, true));
    let offset = BATCH_HEADER;
    for (const definition of batch.definitions) {
      bytes.set(definition, offset);
      offset += definition.length;
    }
    return bytes;
  };

  encode.recover = (epoch, frameId) => {
    if (previous?.streamDraw && previous.epoch === epoch && previous.id === frameId) {
      previous.batches = planBatches(previous.geometry);
      const bytes = previous.streamDraw.slice();
      const view = new DataView(bytes.buffer);
      view.setUint32(160, 1, true);
      view.setUint32(164, 0, true);
      view.setUint32(168, previous.batches.length, true);
      return bytes;
    }
    if (!previous?.delta || previous.epoch !== epoch || previous.id !== frameId)
      reject('recovery frame unavailable');
    const {delta, tailOffset, format, geometry, fullSize, paletteBytes} = previous;
    const full = new Uint8Array(fullSize);
    full.set(delta.subarray(0, HEADER));
    const view = new DataView(full.buffer);
    view.setUint32(0, format, true);
    view.setUint32(12, geometry.size, true);
    let offset = HEADER;
    if (format === SKINNED_MAGIC) {
      view.setUint32(offset, paletteBytes, true);
      offset += 4;
    }
    for (const definition of geometry.values()) {
      full.set(definition, offset);
      offset += definition.length;
    }
    full.set(delta.subarray(tailOffset), offset);
    return full;
  };
  return encode;
}
