// SPDX-License-Identifier: Apache-2.0
// Turned and extruded shapes, painted patterns and worn edges on models made from distance fields; colour-aware
// simplification; models written as .glb; and the page the model preview draws on.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  Mesh3D,
  Object3D,
  createBoxGeometry3D,
  createSdfGeometry3D,
  createStandardMaterial3D,
  exportGlb3D,
  linearColor3D,
  loadGltf3D,
  sdfBox,
  sdfCylinder,
  sdfExtrude,
  sdfLathe,
  sdfPattern,
  sdfSphere,
  simplifyGeometry3D
} from '@egret/engine/world3d';
import { previewImportMap, previewPage } from '../tools/model-preview.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/** The colour a shape gives a point, as the mesh would write it before shading. */
function colorOf(shape, x, y, z) {
  const out = new Float32Array(3);
  shape.colorAt(x, y, z, out, new Float32Array([1, 1, 1]));
  return [...out];
}

// Break caught: a turned or extruded outline at the wrong size, inside out, or with its rounding ignored.
test('SS01 a lathe turns its profile about y, and an extrusion pushes its outline along z', () => {
  // A rectangle from the axis to radius 1, height 2, turned: a cylinder.
  const lathe = sdfLathe([
    [0, 0],
    [1, 0],
    [1, 2],
    [0, 2]
  ]);
  const cylinder = sdfCylinder(1, 2, { at: [0, 1, 0] });
  for (const p of [
    [2, 1, 0],
    [0, 3, 0],
    [0.5, 1, 0.5],
    [0, 1, 0],
    [1.5, -1, 0.3]
  ])
    assert.ok(close(lathe.distance(...p), cylinder.distance(...p), 1e-9), p.join());
  assert.deepEqual([...lathe.bounds], [-1, 0, -1, 1, 2, 1]);
  // A square outline 1 deep is a box.
  const square = sdfExtrude(
    [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5]
    ],
    1
  );
  const box = sdfBox([1, 1, 1]);
  for (const p of [
    [1, 0, 0],
    [0, 0, 2],
    [0.7, 0.7, 0.7],
    [0, 0, 0],
    [0.2, -0.1, 0.3]
  ])
    assert.ok(close(square.distance(...p), box.distance(...p), 1e-9), p.join());
  // The winding of the outline does not matter.
  const reversed = sdfExtrude(
    [
      [-0.5, 0.5],
      [0.5, 0.5],
      [0.5, -0.5],
      [-0.5, -0.5]
    ],
    1
  );
  assert.ok(close(reversed.distance(0, 0, 0), -0.5));
  // Rounded, a corner is cut back.
  const rounded = sdfExtrude(
    [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5]
    ],
    1,
    { round: 0.1 }
  );
  assert.ok(rounded.distance(0.49, 0.49, 0.49) > 0 && rounded.distance(0, 0, 0.45) < 0);
  // A concave outline: an L.
  const ell = sdfExtrude(
    [
      [0, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [1, 2],
      [0, 2]
    ],
    0.5
  );
  assert.ok(ell.distance(0.5, 1.5, 0) < 0 && ell.distance(1.5, 1.5, 0) > 0 && ell.distance(1.5, 0.5, 0) < 0);
  const throws = { code: 'WORLD3D_INPUT_INVALID' };
  assert.throws(
    () =>
      sdfLathe([
        [0, 0],
        [1, 0]
      ]),
    throws
  );
  assert.throws(
    () =>
      sdfLathe([
        [-1, 0],
        [1, 0],
        [1, 1]
      ]),
    throws
  );
  assert.throws(
    () =>
      sdfExtrude(
        [
          [0, 0],
          [1, 0],
          [1, 1]
        ],
        0
      ),
    throws
  );
});

// Break caught: a pattern that moves the surface, paints the wrong places, or changes from one run to the next.
test('SS02 patterns paint stripes, spots, patches and gradients without moving the surface', () => {
  const ball = sdfSphere(1, { color: 0xffffff });
  const black = linearColor3D(0x000000);
  const stripes = sdfPattern(ball, { kind: 'stripes', color: 0x000000, frequency: 2, size: 0.5 });
  assert.equal(stripes.distance(0.3, 0.2, 0.1), ball.distance(0.3, 0.2, 0.1));
  // Going up through the ball the colour turns dark and light again: stripes across y.
  const shades = [];
  for (let y = -1; y <= 1; y += 0.05) shades.push(colorOf(stripes, 0, y, 0)[0]);
  let changes = 0;
  for (let i = 1; i < shades.length; i++) if (shades[i] < 0.5 !== shades[i - 1] < 0.5) changes++;
  assert.ok(changes >= 4, changes + ' changes');
  assert.ok(Math.min(...shades) < 0.05 && Math.max(...shades) > 0.95);
  // A gradient goes from none at `from` to all at `to`.
  const gradient = sdfPattern(ball, { kind: 'gradient', color: 0x000000, axis: 'y', from: 0, to: -1 });
  assert.ok(close(colorOf(gradient, 0, 0.5, 0)[0], 1));
  assert.ok(close(colorOf(gradient, 0, -1, 0)[0], black[0]));
  // Spots: the same seed the same spots, a share of the surface painted.
  const spots = sdfPattern(ball, { kind: 'spots', color: 0x000000, frequency: 3, size: 0.6, seed: 4 });
  const again = sdfPattern(ball, { kind: 'spots', color: 0x000000, frequency: 3, size: 0.6, seed: 4 });
  let painted = 0,
    total = 0;
  for (let i = 0; i < 400; i++) {
    const a = i * 2.39996,
      y = 1 - (2 * (i + 0.5)) / 400,
      r = Math.sqrt(1 - y * y);
    const p = [Math.cos(a) * r, y, Math.sin(a) * r];
    const c = colorOf(spots, ...p);
    assert.deepEqual(c, colorOf(again, ...p));
    if (c[0] < 0.5) painted++;
    total++;
  }
  assert.ok(painted > total * 0.05 && painted < total * 0.8, painted + ' of ' + total);
  // Noise patches never paint more than `amount`.
  const patches = sdfPattern(ball, { kind: 'noise', color: 0x000000, amount: 0.4 });
  for (let i = 0; i < 50; i++) assert.ok(colorOf(patches, Math.sin(i), Math.cos(i * 1.3), 0.2)[0] >= 0.6 - 1e-6);
  const throws = { code: 'WORLD3D_INPUT_INVALID' };
  assert.throws(() => sdfPattern(ball, { kind: 'plaid', color: 0 }), throws);
  assert.throws(() => sdfPattern(ball, { kind: 'spots' }), throws);
  assert.throws(() => sdfPattern(ball, { kind: 'stripes', color: 0, amount: 2 }), throws);
  assert.throws(() => sdfPattern(ball, { kind: 'gradient', color: 0, from: 1, to: 1 }), throws);
});

// Break caught: worn edges that light the faces too, or none at all.
test('SS03 edges catch light on the outer edges of a box and not on its faces', () => {
  const box = sdfBox([1, 1, 1], { round: 0.03, color: 0x404040 });
  const g = createSdfGeometry3D(box, { occlusion: 0, edges: { amount: 1 }, triangles: 0, resolution: 48 });
  const p = g.getAttribute('position').data,
    c = g.getAttribute('color').data;
  const grey = linearColor3D(0x404040)[0];
  let face = 0,
    edge = 0;
  for (let i = 0; i < g.vertexCount; i++) {
    const a = [Math.abs(p[i * 3]), Math.abs(p[i * 3 + 1]), Math.abs(p[i * 3 + 2])].sort((x, y) => y - x);
    if (a[1] < 0.3) face = Math.max(face, c[i * 3]);
    if (a[1] > 0.48) edge = Math.max(edge, c[i * 3]);
  }
  assert.ok(close(face, grey, 0.02), 'faces keep their colour: ' + face);
  assert.ok(edge > grey * 1.5, 'edges are lighter: ' + edge);
  const tinted = createSdfGeometry3D(box, { occlusion: 0, edges: { amount: 1, color: 0xff0000 }, resolution: 32 });
  const tc = tinted.getAttribute('color').data;
  let reddest = 0;
  for (let i = 0; i < tinted.vertexCount; i++) reddest = Math.max(reddest, tc[i * 3] - tc[i * 3 + 2]);
  assert.ok(reddest > 0.3);
  assert.throws(() => createSdfGeometry3D(box, { edges: { amount: 2 } }), { code: 'WORLD3D_INPUT_INVALID' });
});

// Break caught: a simplifier that smears a painted edge across the model.
test('SS04 simplification keeps a sharp change of colour where it was', () => {
  const half = sdfPattern(sdfSphere(1, { color: 0xff0000 }), {
    kind: 'gradient',
    axis: 'x',
    color: 0x0000ff,
    from: -0.01,
    to: 0.01
  });
  const g = createSdfGeometry3D(half, { occlusion: 0, triangles: 600 });
  assert.ok(g.index.count / 3 <= 600);
  const p = g.getAttribute('position').data,
    c = g.getAttribute('color').data,
    ix = g.index.data;
  // The area of the triangles that run from red to blue: the width of the smear. Without weighing colour it is about
  // twice this bound on this ball; a ball's whole surface is 4 pi.
  let smear = 0;
  for (let f = 0; f < ix.length; f += 3) {
    const tri = [ix[f], ix[f + 1], ix[f + 2]];
    const reds = tri.filter(v => c[v * 3] > c[v * 3 + 2]).length;
    if (reds === 0 || reds === 3) continue;
    const [a, b, d] = tri;
    const u = [0, 1, 2].map(k => p[b * 3 + k] - p[a * 3 + k]),
      w = [0, 1, 2].map(k => p[d * 3 + k] - p[a * 3 + k]);
    smear += Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2;
  }
  assert.ok(smear < 1, 'the triangles across the colour edge cover ' + smear);
});

// Break caught: a .glb the engine's own loader cannot read, or that loses colours, positions or the tree.
test('SS05 exportGlb3D writes a .glb that loads back as it was', async () => {
  const g = createSdfGeometry3D(sdfSphere(0.5, { color: 0x3366cc }), { triangles: 800 });
  const bytes = exportGlb3D(g);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  assert.equal(view.getUint32(8, true), bytes.byteLength);
  assert.equal(bytes.byteLength % 4, 0);
  const asset = await loadGltf3D(bytes);
  const back = asset.geometries[0];
  assert.equal(back.vertexCount, g.vertexCount);
  assert.deepEqual(Array.from(back.index.data), Array.from(g.index.data));
  assert.deepEqual(Array.from(back.getAttribute('color').data), Array.from(g.getAttribute('color').data));
  assert.deepEqual(Array.from(back.getAttribute('position').data), Array.from(g.getAttribute('position').data));
  assert.equal(asset.materials[0].vertexColors, true);
  asset.dispose();

  const root = new Object3D();
  root.name = '驿站';
  const crate = new Mesh3D(createBoxGeometry3D({}), createStandardMaterial3D({ color: 0x336699, roughness: 0.4 }));
  crate.name = 'crate';
  crate.setPosition(1, 2, 3);
  root.addChild(crate);
  const twin = new Mesh3D(crate.geometry, crate.material);
  twin.setPosition(-1, 0, 0);
  root.addChild(twin);
  const tree = await loadGltf3D(exportGlb3D(root));
  const names = [];
  let found;
  tree.scene.traverse(o => {
    names.push(o.name);
    if (o.name === 'crate') found = o;
  });
  assert.ok(names.includes('驿站'));
  assert.deepEqual(Array.from(found.position), [1, 2, 3]);
  assert.ok(close(tree.materials[0].roughness, 0.4));
  assert.ok(close(tree.materials[0].color[2], linearColor3D(0x336699)[2], 1e-6));
  // One mesh written once for the two nodes that share it.
  const json = JSON.parse(
    new TextDecoder().decode(
      exportGlb3D(root).subarray(20, 20 + new DataView(exportGlb3D(root).buffer).getUint32(12, true))
    )
  );
  assert.equal(json.meshes.length, 1);
  tree.dispose();
  assert.throws(() => exportGlb3D({}), { code: 'WORLD3D_INPUT_INVALID' });
  // Colour-blind simplification is still offered for meshes without colours.
  assert.ok(simplifyGeometry3D(createBoxGeometry3D({ widthSegments: 4 }), { ratio: 0.5 }).after > 0);
});

/** Every bare specifier a built module reaches through its imports, as a page would ask for them. */
function bareSpecifiers(entry) {
  const pkgs = Object.fromEntries(
    ['engine', 'runtime', 'contracts'].map(name => [
      name,
      JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', name, 'package.json'), 'utf8'))
    ])
  );
  const target = value =>
    typeof value === 'string' ? value : value && (value.import ?? value.default ?? value.browser);
  const resolve = (spec, from) => {
    if (spec.startsWith('#')) {
      const owner = path.relative(path.join(ROOT, 'packages'), from).split(path.sep)[0];
      const t = target(target(pkgs[owner]?.imports?.[spec]));
      return t && path.join(ROOT, 'packages', owner, t);
    }
    for (const [name, pkg] of Object.entries(pkgs))
      if (spec === pkg.name || spec.startsWith(pkg.name + '/')) {
        const t = target(target(pkg.exports['.' + spec.slice(pkg.name.length)]));
        return t && path.join(ROOT, 'packages', name, t);
      }
    return undefined;
  };
  const seen = new Set(),
    found = new Set(),
    stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop();
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(
      /(?:^|[;\s])(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^import\s*['"]([^'"]+)['"]/gm
    )) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (spec.startsWith('.')) stack.push(path.resolve(path.dirname(file), spec));
      else {
        found.add(spec);
        const next = resolve(spec, file);
        if (next) stack.push(next);
      }
    }
  }
  return found;
}

// Break caught: the 3D engine reaching a module the example pages' import map does not name, so the pages and the
// model preview fail in a browser with "Failed to resolve module specifier".
test('SS06 the World3D import map names every module the 3D entries reach, and the preview page uses it', () => {
  const map = previewImportMap().imports;
  for (const entry of ['web/world3d/index.js', 'web/world3d/webgpu.js', 'rendering/world3d/index.js']) {
    const missing = [...bareSpecifiers(path.join(ROOT, 'packages', 'engine', 'dist', entry))].filter(
      spec => !(spec in map)
    );
    assert.deepEqual(missing, [], entry);
  }
  for (const page of ['features.html', 'landscape.html']) {
    const text = fs.readFileSync(path.join(ROOT, 'examples', 'world3d', page), 'utf8');
    const own = JSON.parse(/<script type="importmap">\s*(\{[\s\S]*?\})\s*<\/script>/.exec(text)[1]).imports;
    assert.deepEqual(
      Object.keys(map).filter(spec => !(spec in own)),
      [],
      page
    );
  }
  for (const target of Object.values(map))
    if (target.startsWith('/')) assert.ok(fs.existsSync(path.join(ROOT, target)), target);
  const page = previewPage('/__model/fox.mjs');
  assert.ok(page.includes('"/__model/fox.mjs"') && page.includes('"importmap"'));
});
