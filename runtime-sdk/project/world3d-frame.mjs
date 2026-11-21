// SPDX-License-Identifier: Apache-2.0
import { InstancedMesh3D, RenderList3D } from '@egret/engine/world3d';

// Each little-endian E3D1 packet is independently executable after context loss.
// Geometry appears once per frame and keeps its stable resource ID across frames.
const MAGIC = 0x31443345,
  TEXTURED_MAGIC = 0x32443345;
const HEADER = 160,
  DRAW = 88,
  TEXTURED_DRAW = 96,
  BYTE_LIMIT = 360472,
  TEXTURED_BYTE_LIMIT = 2 * 1024 * 1024;
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
function packGeometry(cache, geometry, texturedFormat) {
  const stride = texturedFormat ? 32 : 24;
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
  const old = cache.get(geometry);
  if (
    old &&
    old.stride === stride &&
    old.uv === uv?.version &&
    old.layout === geometry.layoutVersion &&
    old.vertices === positions.version &&
    old.normals === normals.version &&
    old.indices === index.version
  )
    return old.bytes;
  const length = 12 + positions.count * stride + index.count * 4;
  if (
    length >
    (texturedFormat ? TEXTURED_BYTE_LIMIT : BYTE_LIMIT) - HEADER - (texturedFormat ? TEXTURED_DRAW : DRAW) - 24
  )
    reject('geometry exceeds frame budget');
  const bytes = new Uint8Array(length),
    view = new DataView(bytes.buffer);
  view.setUint32(0, geometry.id, true);
  view.setUint32(4, positions.count, true);
  view.setUint32(8, index.count, true);
  let offset = 12;
  for (let i = 0; i < positions.count; i++, offset += stride) {
    vector(view, offset, positions.data.subarray(3 * i, 3 * i + 3), 3);
    vector(view, offset + 12, normals.data.subarray(3 * i, 3 * i + 3), 3);
    if (uv) vector(view, offset + 24, uv.data.subarray(2 * i, 2 * i + 2), 2);
  }
  for (const value of index.data) {
    if (!Number.isInteger(value) || value < 0 || value >= positions.count) reject('index outside geometry');
    view.setUint32(offset, value, true);
    offset += 4;
  }
  cache.set(geometry, {
    stride,
    uv: uv?.version,
    layout: geometry.layoutVersion,
    vertices: positions.version,
    normals: normals.version,
    indices: index.version,
    bytes
  });
  return bytes;
}

function supportedDraw({ mesh, material: m, geometry, start, count }) {
  if (mesh instanceof InstancedMesh3D || mesh.skeleton || start !== 0 || count !== geometry.index?.count)
    reject('expected whole unskinned indexed mesh');
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
    m.normalMap ||
    m.metallicRoughnessMap ||
    m.occlusionMap ||
    m.emissiveMap ||
    m.emissive.some((x) => x !== 0) ||
    m.lightMap ||
    m.vertexColors ||
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
function texturePage(material, geometry, pages) {
  const map = material.map;
  if (!map) return 0;
  if (
    map.isDisposed ||
    map.colorSpace !== 'srgb' ||
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
    reject('unsupported base-color sampler');
  if (!geometry.getAttribute('uv')) reject('base-color texture requires UVs');
  const page = pages?.get(map.source);
  if (!Number.isInteger(page) || page < 1 || page > 255) reject('texture has no live page');
  return page;
}

export function createWorldProjectEncoder() {
  const cache = new WeakMap(),
    list = new RenderList3D();
  // This profile draws individual objects and only shares the underlying GPU geometry.
  list.autoInstanceThreshold = 0;
  return function encode({ scene, camera }, hud, pages) {
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
    const extended = list.opaque.some(({ material }) => material.map || material.side === 'double');
    const drawBytes = extended ? TEXTURED_DRAW : DRAW;
    const limit = extended ? TEXTURED_BYTE_LIMIT : BYTE_LIMIT;
    const geometryBytes = new Map();
    let size = HEADER + drawBytes * list.opaque.length + hud.byteLength;
    for (const item of list.opaque) {
      supportedDraw(item);
      if (!geometryBytes.has(item.geometry)) {
        const bytes = packGeometry(cache, item.geometry, extended);
        size += bytes.length;
        if (size > limit) reject('visible geometry and draws exceed ' + limit + ' frame bytes (' + size + ')');
        if (geometryBytes.size >= 64) reject('more than 64 distinct visible geometries in the frame');
        geometryBytes.set(item.geometry, bytes);
      }
    }
    if (size > limit) reject('HUD and draws exceed ' + limit + ' frame bytes (' + size + ')');
    const bytes = new Uint8Array(size),
      v = new DataView(bytes.buffer);
    const bg = scene.background ?? [0, 0, 0];
    const rgba = ((colorByte(bg[0]) * 256 + colorByte(bg[1])) * 256 + colorByte(bg[2])) * 256 + 255;
    [
      extended ? TEXTURED_MAGIC : MAGIC,
      h.getUint32(4, true),
      hud.byteLength,
      geometryBytes.size,
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
    for (const geometry of geometryBytes.values()) {
      bytes.set(geometry, offset);
      offset += geometry.length;
    }
    for (const item of list.opaque) {
      v.setUint32(offset, item.geometry.id, true);
      vector(v, offset + 4, item.mesh.matrixWorld, 16);
      vector(v, offset + 68, item.material.color, 3);
      v.setFloat32(offset + 80, item.material.roughness, true);
      v.setFloat32(offset + 84, item.material.metallic, true);
      if (extended) {
        v.setUint32(offset + 88, texturePage(item.material, item.geometry, pages), true);
        v.setUint32(offset + 92, item.material.side === 'double' ? 1 : 0, true);
      }
      offset += drawBytes;
    }
    bytes.set(hud, offset);
    return bytes;
  };
}
