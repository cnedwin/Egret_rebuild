// SPDX-License-Identifier: Apache-2.0
import { frustumFromMatrix, frustumIntersectsSphere, mat4Invert, mat4LookAt, mat4Multiply, mat4Orthographic } from '@egret/engine/world3d';

const HEADER = 128, POINT = 28;
function refuse(reason) { throw new RangeError('Android World3D profile: ' + reason); }
function store(view, offset, values, nonnegative = false) {
  for (const value of values) {
    const n = Math.fround(value);
    if (!Number.isFinite(n) || (nonnegative && n < 0)) refuse('invalid lighting parameters');
    view.setFloat32(offset, n, true);
    offset += 4;
  }
}
function direction(light) {
  const m = light.matrixWorld, length = Math.hypot(m[8], m[9], m[10]);
  if (!(length > 0)) refuse('invalid directional light');
  return [m[8] / length, m[9] / length, m[10] / length];
}
function shadowMatrix(light) {
  const {extent, near, far} = light.shadow;
  if (!(extent > 0 && near > 0 && far > near) || light.shadow.cascades !== 1) refuse('unsupported shadow projection');
  const eye = light.matrixWorld.subarray(12, 15), axis = direction(light);
  const target = [eye[0] - axis[0], eye[1] - axis[1], eye[2] - axis[2]];
  const basis = mat4LookAt(new Float32Array(16), eye, target, Math.abs(axis[1]) > .99 ? [0, 0, 1] : [0, 1, 0]);
  const view = new Float32Array(16);
  if (!mat4Invert(view, basis)) refuse('invalid shadow light basis');
  const projection = mat4Orthographic(new Float32Array(16), -extent, extent, -extent, extent, near, far);
  return mat4Multiply(new Float32Array(16), projection, view);
}

/** Keep the ordinary envelope unchanged. LIT1 follows its draw table and describes the same game tick. */
export function planWorldLighting(scene, list, shadows) {
  const fog = scene.fog, points = list.pointLights;
  const sun = list.directionalLights[0], fill = list.directionalLights[1];
  if (fog && fog.kind !== 'exponential') refuse('expected exponential fog');
  if (list.directionalLights.length > 2 || list.spotLights.length || list.tiledPointLights.length ||
      list.stats.lightsDropped || points.length > 8) refuse('unsupported lights');
  if (shadows && (!Number.isInteger(shadows.mapSize) || shadows.mapSize < 64 || shadows.mapSize > 2048 ||
      (shadows.mapSize & (shadows.mapSize - 1)) !== 0)) refuse('invalid shadow map size');
  if (shadows && (fill?.castShadow || points.some(light => light.castShadow))) refuse('only one directional shadow map');
  const size = shadows && sun?.castShadow && list.shadowCasters.length ? shadows.mapSize : 0;
  if (!fog && !points.length && !size && !fill) return { items: list.opaque };

  let items = list.opaque, active = items.length, casters;
  const matrix = size ? shadowMatrix(sun) : undefined;
  if (matrix) {
    const planes = frustumFromMatrix(new Float32Array(24), matrix);
    casters = new Set();
    const visible = new Set(items.map(item => item.mesh));
    for (const mesh of list.shadowCasters) {
      const sphere = mesh.worldBoundingSphere;
      if (mesh.frustumCulled && sphere[3] >= 0 && !frustumIntersectsSphere(planes, sphere)) continue;
      // The main pass already filtered invisible material slots on its own draws.
      if (visible.has(mesh)) {
        casters.add(mesh);
        continue;
      }
      if (Array.isArray(mesh.material) && mesh.geometry.groups.length) {
        for (const group of mesh.geometry.groups) {
          const slot = mesh.materialAt(group.materialIndex);
          if (group.count > 0 && slot.visible && !slot.isDisposed && !slot.billboard) refuse('grouped offscreen shadow caster');
        }
        continue;
      }
      const material = mesh.materialAt(0);
      if (!material.visible || material.isDisposed || material.billboard) continue;
      casters.add(mesh);
      if (items === list.opaque) items = items.slice();
      items.push({mesh, geometry: mesh.geometry, material, start: 0, count: mesh.geometry.drawCount});
    }
  }
  if (items.length > 4096) refuse('too many scene and shadow draws');
  const flagStart = HEADER + POINT * points.length;
  const bytes = new Uint8Array(flagStart + Math.ceil(items.length / 4) * 4), view = new DataView(bytes.buffer);
  view.setUint32(0, 0x3154494c, true); // LIT1
  view.setUint32(4, points.length, true);
  view.setUint32(8, size, true);
  if (fog) {
    const rgb = fog.color;
    if (rgb?.length !== 3 || !Number.isFinite(rgb[0]) || !Number.isFinite(rgb[1]) || !Number.isFinite(rgb[2])) {
      refuse('expected three finite fog color components');
    }
    store(view, 12, [fog.density, rgb[0], rgb[1], rgb[2]], true);
  }
  if (matrix) {
    store(view, 28, [sun.shadow.bias]);
    store(view, 32, [sun.shadow.normalBias, sun.shadow.radius], true);
    store(view, 40, matrix);
  }
  if (fill) {
    store(view, 104, direction(fill));
    store(view, 116, fill.color.map(value => value * fill.intensity), true);
  }
  points.forEach((light, i) => {
    const offset = HEADER + POINT * i;
    store(view, offset, light.matrixWorld.subarray(12, 15));
    store(view, offset + 12, [light.range, ...light.color.map(value => value * light.intensity)], true);
  });
  items.forEach(({mesh, material}, i) => {
    bytes[flagStart + i] = (casters?.has(mesh) ? 1 : 0) | (size && mesh.receiveShadow ? 2 : 0) |
      (fog && material.fog ? 4 : 0) | (i >= active ? 8 : 0);
  });
  return {items, bytes};
}
