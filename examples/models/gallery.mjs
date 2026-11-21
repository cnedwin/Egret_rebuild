// SPDX-License-Identifier: Apache-2.0
// The model library on one page: every model of the library made from its module and laid out in rows by kind, each
// scaled to the same height so it can be compared (tick "true sizes" to see them as they are), with its name under it.
// Drag to turn the view, wheel or pinch to come closer.
import { createOrbitControls3D, createWorld3DApp } from '@egret/engine/webgl2/world3d';
import * as W from '@egret/engine/world3d';
import { models } from './index.mjs';

const status = document.getElementById('status');
const canvas = document.getElementById('view');
const app = await createWorld3DApp(canvas, { onError: error => (status.textContent = String(error)) });
const scene = new W.Scene3D();
scene.background = [0.55, 0.62, 0.7];
const camera = W.createPerspectiveCamera3D({ fov: 40, near: 0.05, far: 200 });
scene.addChild(camera);
scene.addChild(W.createHemisphereLight3D({ color: 0xdfe8ff, groundColor: 0x5a5244, intensity: 0.9 }));
const sun = W.createDirectionalLight3D({ color: 0xfff3e0, intensity: 2.2, castShadow: true });
scene.addChild(sun);
const floor = new W.Mesh3D(
  W.createPlaneGeometry3D({ width: 200, height: 200 }),
  W.createStandardMaterial3D({ color: 0x8c8f88, roughness: 1 })
);
floor.setRotation(-Math.PI / 2, 0, 0);
scene.addChild(floor);

const material = W.createStandardMaterial3D({ vertexColors: true, roughness: 0.75 });
const made = [];
const started = performance.now();
for (const name of models) {
  const module = await import(`./${name}.mjs`);
  // A model with a rig is made as its rig and plays its first clip; the others as a plain mesh.
  if (typeof module.rig === 'function') {
    const rig = module.rig(W);
    rig.play(Object.values(rig.clips)[0], 0);
    made.push({ name, about: module.about, mesh: rig.root, box: rig.mesh.geometry.boundingBox, rig });
  } else {
    const shape = module.default(W);
    const geometry = shape instanceof W.SdfShape3D ? W.createSdfGeometry3D(shape, module.meshOptions ?? {}) : shape;
    // A model that names a surface is drawn with it: wood grain, brick courses or plaster between its vertices.
    const own = module.surface ? W.createSurfaceMaterial3D(module.surface) : material;
    made.push({ name, about: module.about, mesh: new W.Mesh3D(geometry, own), box: geometry.boundingBox });
  }
  status.textContent = `${made.length} / ${models.length}`;
  await new Promise(resolve => setTimeout(resolve, 0));
}
const KINDS = ['animal', 'person', 'building', 'plant', 'prop'];
const CELL = 1.6;

function layOut(realSizes) {
  const rows = KINDS.map(kind => made.filter(m => m.about.kind === kind)).filter(row => row.length > 0);
  let widest = 0;
  rows.forEach((row, r) => {
    widest = Math.max(widest, row.length);
    row.forEach((m, i) => {
      const height = m.box[4] - m.box[1],
        size = Math.max(height, m.box[3] - m.box[0], m.box[5] - m.box[2]);
      const s = realSizes ? 1 : (CELL * 0.75) / size;
      m.mesh.setScale(s, s, s);
      m.mesh.setPosition(
        (i - (row.length - 1) / 2) * CELL - ((m.box[0] + m.box[3]) / 2) * s,
        -m.box[1] * s,
        -r * CELL * 1.6 - ((m.box[2] + m.box[5]) / 2) * s
      );
      if (!m.mesh.parent) scene.addChild(m.mesh);
    });
  });
  return { width: widest * CELL, depth: rows.length * CELL * 1.6 };
}
const extent = layOut(false);
sun.setPosition(6, 14, 8).lookAt(0, 0, -extent.depth / 2);
const reach = Math.max(extent.width, extent.depth);
camera.setPosition(0, reach * 0.55, reach * 0.55);
const controls = createOrbitControls3D(camera, canvas, { target: [0, 0.4, -extent.depth / 2 + CELL / 2] });
document.getElementById('real').addEventListener('change', event => layOut(event.target.checked));
const triangles = made.reduce((sum, m) => sum + (m.rig ? m.rig.mesh : m.mesh).geometry.index.count / 3, 0);
status.textContent = `${made.length} models, ${triangles} triangles, made in ${Math.round(performance.now() - started)} ms`;
app.show(scene, camera, {
  onUpdate: seconds => {
    controls.update?.(seconds);
    for (const m of made) m.rig?.update(seconds);
  }
});
globalThis.__gallery = {
  ready: true,
  models: made.map(m => m.name)
};
