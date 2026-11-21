// SPDX-License-Identifier: Apache-2.0
import { Mesh3D, Object3D, createStandardMaterial3D } from '@egret/engine/world3d';
import { RACERS } from './original/data.mjs';
import { partsFor } from './original/art.mjs';
import { BOX, CYLINDER, build, rgb } from './original/shapes.mjs';
import { describeTrackModel, addTrackModel } from './original/fit.mjs';

export function makePaint(scope) {
  const colors = new Map();
  function material(color, roughness = 0.75, metallic = 0.05) {
    const linear = typeof color === 'number' ? rgb(color) : color.map((v) => Math.min(1, Math.max(0, v)) ** 2.2);
    const key = [...linear, roughness, metallic].join(',');
    if (!colors.has(key)) colors.set(key, scope.use(createStandardMaterial3D({ color: linear, roughness, metallic })));
    return colors.get(key);
  }
  function part(parent, geometry, color, at, scale, rotation) {
    const mesh = new Mesh3D(geometry, material(color));
    mesh.setPosition(...at);
    if (typeof scale === 'number') mesh.setScale(scale);
    else mesh.setScale(...scale);
    if (rotation) mesh.setRotation(...rotation);
    parent.addChild(mesh);
    return mesh;
  }
  function parts(parent, list) {
    for (const [geometry, at, scale, color, rotation] of list) part(parent, geometry, color, at, scale, rotation);
  }
  return { part, parts, material };
}

// Fit the two unmodified GLBs with the original game's own placement algorithm.
// acquire/release of the page images and GLB meshes belongs to the per-game Scope.
export async function loadPanda(services) {
  const body = await services.loadGlb('panda-kart.glb', { firstPage: 200 });
  const driver = await services.loadGlb('panda-driver.glb', { firstPage: 201 });
  return { body: describeTrackModel(body.scene), driver: describeTrackModel(driver.scene) };
}

function bounds(parts) {
  const merged = build(parts);
  try {
    return [...merged.boundingBox];
  } finally {
    merged.dispose();
  }
}

export function createGrid(scene, race, paint, panda) {
  const hubs = [
    [0.76, 0.31, 0.92],
    [-0.76, 0.31, 0.92],
    [0.82, 0.39, -0.86],
    [-0.82, 0.39, -0.86]
  ];
  const entries = race.karts.map((car) => {
    const root = new Object3D(),
      lean = root.addChild(new Object3D());
    scene.addChild(root);
    const spec = RACERS[car.racer];
    const { kart, driver } = partsFor(spec);
    if (spec.id === 'panda') {
      addTrackModel(lean, panda.body, bounds(kart.paint), { stretch: true });
      addTrackModel(lean, panda.driver, bounds([...driver.body, ...driver.head]));
      paint.parts(lean, driver.extra);
    } else {
      // The original racer-specific procedural silhouettes include each driver's
      // dress, head and ornaments. Geometry and paints are shared across parts.
      paint.parts(lean, [...kart.paint, ...driver.body, ...driver.head, ...driver.extra]);
    }
    paint.parts(lean, [...kart.dark, ...kart.metal]);
    const wheels = hubs.map(([x, y, z], i) => {
      const mount = lean.addChild(new Object3D().setPosition(x, y, z));
      const radius = i < 2 ? 0.31 : 0.39,
        width = i < 2 ? 0.26 : 0.36;
      paint.part(mount, CYLINDER, 0x17171b, [0, 0, 0], [radius, width, radius], [0, 0, Math.PI / 2]);
      paint.part(
        mount,
        CYLINDER,
        0xd9a520,
        [Math.sign(x) * width * 0.4, 0, 0],
        [radius * 0.58, width * 0.25, radius * 0.58],
        [0, 0, Math.PI / 2]
      );
      paint.part(mount, BOX, 0xb52e22, [Math.sign(x) * width * 0.55, 0, 0], [0.02, radius * 0.85, radius * 0.15]);
      return mount;
    });
    return { root, lean, wheels, spin: 0 };
  });
  return {
    update(dt) {
      const human = race.human;
      race.karts.forEach((k, i) => {
        const row = entries[i];
        row.root.visible = Math.hypot(k.x - human.x, k.z - human.z) < 95;
        row.root.setPosition(
          k.x,
          k.y + (k.hop > 0 ? Math.sin((1 - k.hop / 0.28) * Math.PI) * 0.42 : 0) + (k.cloud > 0 ? 1.1 : 0),
          k.z
        );
        const spin = k.spin > 0 ? (1 - k.spin / k.spinTotal) * Math.PI * 4 : 0;
        row.root.setRotation(0, k.heading + (k.drifting ? -k.driftDir * 0.42 : 0) + spin, 0);
        row.root.setScale(k.shrink > 0 ? 0.65 : 1);
        row.lean.setRotation(
          -Math.atan(k.slope) - (k.boost > 0 ? 0.1 : 0),
          0,
          k.steer * Math.min(1, Math.abs(k.speed) / 25) * 0.12
        );
        row.spin += k.speed * dt;
        row.wheels.forEach((wheel, j) =>
          wheel.setRotation(row.spin / (j < 2 ? 0.31 : 0.39), j < 2 ? -k.steer * 0.42 : 0, 0)
        );
      });
    },
    remove() {
      for (const row of entries) row.root.removeFromParent();
    }
  };
}
