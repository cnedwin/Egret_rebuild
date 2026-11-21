// SPDX-License-Identifier: Apache-2.0
import {
  Mesh3D,
  Object3D,
  createGeometry3D,
  createDirectionalLight3D,
  createAmbientLight3D,
  createHemisphereLight3D
} from '@egret/engine/world3d';
import { BOX, CYLINDER, SPHERE, TORUS, PYRAMID, rgb } from './original/shapes.mjs';
import { TRACK } from './original/track.mjs';
import { addLandmarks } from './landmarks.mjs';
import { gateParts } from './original/gate.mjs';

// All drivable bands are sampled from the exact centreline, grade and width
// consumed by the simulation. Split at station boundaries for camera culling.
export function createCourse(scene, track, paint, scope) {
  scene.background = rgb(0x9fcfea);
  scene.addChild(createHemisphereLight3D({ color: 0xd3e1f1, groundColor: 0x9b9d82, intensity: 0.56 }));
  scene.addChild(createAmbientLight3D({ intensity: 0.07 }));
  const sun = scene.addChild(createDirectionalLight3D({ color: 0xffdec1, intensity: 1.98 }));
  sun.setPosition(60, 95, -45).lookAt(0, 0, 0);
  const tiles = [],
    objects = [];
  const stride = 84;
  for (let start = 0; start < track.count; start += stride) {
    const groups = new Map();
    function band(i, j, leftA, rightA, leftB, rightB, h, color) {
      if (!groups.has(color)) groups.set(color, { positions: [], indices: [] });
      const g = groups.get(color),
        base = g.positions.length / 3;
      for (const [k, off] of [
        [i, leftA],
        [i, rightA],
        [j, leftB],
        [j, rightB]
      ])
        g.positions.push(track.px[k] - track.tz[k] * off, track.py[k] + h, track.pz[k] + track.tx[k] * off);
      g.indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
    const stop = Math.min(track.count, start + stride);
    for (let i = start; i < stop; i++) {
      const j = (i + 1) % track.count,
        a = track.halfWidth[i],
        b = track.halfWidth[j];
      band(i, j, -a, a, -b, b, 0.045, 0x47494d);
      for (const side of [-1, 1]) {
        function sideBand(innerA, outerA, innerB, outerB, h, color) {
          if (side === 1) band(i, j, innerA, outerA, innerB, outerB, h, color);
          else band(i, j, -outerA, -innerA, -outerB, -innerB, h, color);
        }
        sideBand(a - 0.48, a, b - 0.48, b, 0.064, 0xe8eae0);
        sideBand(a, a + 0.9, b, b + 0.9, 0.065, i % 2 ? 0xb9412f : 0xdbaa55);
        sideBand(
          a + 0.9,
          track.limit[i] + 0.8,
          b + 0.9,
          track.limit[j] + 0.8,
          0.002,
          track.bridge[i] ? 0xb9b4a6 : 0x88a85c
        );
        if (!track.bridge[i])
          sideBand(
            track.limit[i] + 0.8,
            track.limit[i] + 18,
            track.limit[j] + 0.8,
            track.limit[j] + 18,
            -0.32,
            0x7c9b56
          );
      }
      if (i % 4 < 2) band(i, j, -0.12, 0.12, -0.12, 0.12, 0.068, 0xc8a45a);
    }
    const holder = scene.addChild(new Object3D());
    for (const [color, g] of groups) {
      const geometry = scope.use(createGeometry3D(g));
      geometry.computeNormals();
      holder.addChild(new Mesh3D(geometry, paint.material(color)));
    }
    const mid = Math.floor((start + stop) / 2) % track.count;
    tiles.push({ node: holder, x: track.px[mid], z: track.pz[mid], radius: 272 });
  }
  // Coarse distant terrain follows the same height function as the original
  // hills. The road and its shoulders have their own higher-resolution surface.
  for (let x = -480; x < 480; x += 96)
    for (let z = -390; z < 378; z += 96) {
      const positions = [],
        indices = [];
      for (let j = 0; j <= 6; j++)
        for (let i = 0; i <= 6; i++) {
          const xx = x + i * 16,
            zz = z + j * 16;
          const at = track.locate(xx, zz, -1, {});
          const near = Math.abs(at.lateral) < at.halfWidth + 28;
          positions.push(
            xx,
            near ? Math.min(at.y - 2.8, track.terrainHeight(xx, zz) - 1) : track.terrainHeight(xx, zz) - 1,
            zz
          );
          if (j < 6 && i < 6) {
            const n = j * 7 + i;
            indices.push(n, n + 7, n + 1, n + 1, n + 7, n + 8);
          }
        }
      const g = scope.use(createGeometry3D({ positions, indices }));
      g.computeNormals();
      const node = scene.addChild(new Mesh3D(g, paint.material(0x78944e)));
      tiles.push({ node, x: x + 48, z: z + 48, radius: 156 });
    }
  function anchor(p, range = 115) {
    const node = scene.addChild(new Object3D().setPosition(p.x, p.y, p.z).setRotation(0, p.heading ?? 0, 0));
    objects.push({ node, x: p.x, z: p.z, range });
    return node;
  }
  addLandmarks(scene, track, paint, anchor);
  const start = track.sample(0, 0, {});
  const gate = anchor(start, 220);
  paint.parts(gate, gateParts(track.limit[0] + 0.9));
  for (let col = 0; col < 16; col++)
    for (let row = 0; row < 2; row++) {
      const cell = track.halfWidth[0] / 8;
      paint.part(
        gate,
        BOX,
        (col + row) % 2 ? 0x1f2024 : 0xf5f5f0,
        [-track.halfWidth[0] + (col + 0.5) * cell, 0.082, (row - 0.5) * 1.05],
        [cell, 0.022, 1.05]
      );
    }
  const lake = TRACK.lake;
  paint.part(scene, CYLINDER, 0x538d95, [lake.x, TRACK.waterLevel, lake.z], [lake.rx, 0.06, lake.rz]);
  // Low native view keeps the actionable silhouettes and positions of each
  // hazard, pickup and trigger. The simulation owns visibility and cooldown.
  const collectibles = [];
  for (const p of track.pads)
    paint.part(anchor(p), BOX, 0xe7a13c, [0, 0.1, 0], [p.halfWidth * 2, 0.08, p.halfLength * 2]);
  for (const p of track.ramps)
    paint.part(anchor(p), BOX, 0xaf774a, [0, 0.39, 0], [p.halfWidth * 2, 0.36, p.halfLength * 2], [-0.13, 0, 0]);
  for (const p of track.gates) {
    const group = anchor(p);
    paint.part(group, TORUS, 0xeac867, [0, 2.4, 0], [3, 0.32 + 2.2, 0.8]);
  }
  for (const p of track.lions) {
    const group = anchor(p);
    paint.part(group, BOX, 0x8a8b7d, [0, 0.34, 0], [2, 0.68, 1.9]);
    paint.part(group, SPHERE, 0xa49f83, [0, 1.22, 0], [0.85, 1, 0.74]);
    paint.part(group, SPHERE, 0x99967c, [0, 2.1, 0.3], [0.68, 0.69, 0.6]);
  }
  for (const p of track.mud) paint.part(anchor(p), CYLINDER, 0x693f29, [0, 0.1, 0], [p.radius, 0.05, p.radius]);
  for (const [kind, items] of [
    ['coins', track.coins],
    ['boxes', track.boxes],
    ['drums', track.drums]
  ]) {
    const slots = [];
    for (const p of items) {
      const a = anchor(p, 88);
      const mesh =
        kind === 'coins'
          ? paint.part(a, TORUS, 0xe8b936, [0, 1.1, 0], [0.45, 0.45, 0.22])
          : kind === 'boxes'
            ? paint.part(a, SPHERE, 0xde4b2d, [0, 1.7, 0], [0.7, 0.9, 0.7])
            : paint.part(a, CYLINDER, 0xac3d2c, [0, 1.25, 0], [1.25, 1.5, 1.25], [0, 0, Math.PI * 0.5]);
      slots.push(mesh);
    }
    collectibles.push({ kind, slots });
  }
  for (let i = 0; i < track.count; i += 4) {
    if (!track.bridge[i]) continue;
    for (const side of [-1, 1]) {
      const at = track.sample(i * track.step, side * (track.halfWidth[i] + 1.2), {});
      const g = anchor(at, 155);
      paint.part(g, BOX, 0xb8b5a3, [0, 0.68, 0], [0.65, 1.38, track.step * 4]);
      paint.part(g, PYRAMID, 0x8a8b7a, [0, 1.52, 0], [0.44, 0.5, 0.44]);
    }
  }
  return {
    update(race) {
      const k = race.human;
      for (const o of tiles) o.node.visible = (o.x - k.x) ** 2 + (o.z - k.z) ** 2 < o.radius ** 2;
      for (const o of objects) o.node.visible = (o.x - k.x) ** 2 + (o.z - k.z) ** 2 < o.range ** 2;
      for (const { kind, slots } of collectibles)
        slots.forEach((mesh, i) => {
          const event = race[kind][i];
          mesh.visible = !event.timer;
          if (kind === 'drums') {
            const p = track.drums[i];
            mesh.parent.setPosition(
              p.x - Math.cos(p.heading) * event.offset,
              p.y,
              p.z + Math.sin(p.heading) * event.offset
            );
          } else mesh.setRotation(0, race.clock * 2, 0);
        });
    }
  };
}
