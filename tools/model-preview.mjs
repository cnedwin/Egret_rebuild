// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/model-preview.mjs <absolute Playwright index.mjs> <model.mjs> <picture.png> [--glb <model.glb>]
// Draws a 3D model from four sides in a headless browser and writes one picture of the four, with the model's numbers:
// the check to run after writing or changing a model in code, so the one who made it, person or agent, looks at it
// before it goes into a game. The four views, left to right and top to bottom: the front (looking along -z), the front
// right from above, the right side, and the back left from above.
//
// The model is a module whose default export makes it, given the exports of @egret/engine/world3d:
//
//   export const meshOptions = { triangles: 4000 };          // for a distance field: the options of createSdfGeometry3D
//   export default function (W) {
//     return W.sdfUnion([W.sdfSphere(0.5, { color: 0xf0a040 }), W.sdfSphere(0.3, { at: [0, 0.6, 0.3] })], { smooth: 0.1 });
//   }
//
// It may return a distance-field shape, a geometry (drawn with its vertex colours) or an object with meshes under it,
// and may be async. The module is served from its own folder, so it can import its neighbours, and @egret/engine/world3d
// resolves to this checkout's build. `--glb` also writes the model as a .glb, as exportGlb3D gives it. Pictures are
// made with software rendering: they show shape, colour and proportion, not a device's speed.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm'
};
const VIEW = 480;

/** The import map of the World3D example page, so the preview reaches every entry the 3D engine does. */
export function previewImportMap() {
  const page = fs.readFileSync(path.join(root, 'examples', 'world3d', 'index.html'), 'utf8');
  const match = /<script type="importmap">\s*(\{[\s\S]*?\})\s*<\/script>/.exec(page);
  if (!match) throw new Error('examples/world3d/index.html has no import map');
  return JSON.parse(match[1]);
}

/** The page that makes the model and turns the camera round it. */
export function previewPage(modelUrl) {
  return `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">${JSON.stringify(previewImportMap())}</script>
<style>html,body{margin:0;background:#c9d3dd}canvas{display:block;width:${VIEW}px;height:${VIEW}px}</style></head>
<body><canvas id="c" width="${VIEW}" height="${VIEW}"></canvas><script type="module">
import * as W from '@egret/engine/world3d';
import { createWorld3DApp } from '@egret/engine/webgl2/world3d';
const report = (value) => { globalThis.__preview = value; };
try {
  const module = await import(${JSON.stringify(modelUrl)});
  if (typeof module.default !== 'function') throw new Error('the model module has no default export to make the model');
  const started = performance.now();
  let made = await module.default(W);
  if (made instanceof W.SdfShape3D) made = W.createSdfGeometry3D(made, module.meshOptions ?? {});
  let model;
  if (made instanceof W.Geometry3D)
    model = new W.Mesh3D(made, W.createStandardMaterial3D({ vertexColors: !!made.getAttribute('color'), roughness: 0.75 }));
  else if (made instanceof W.Object3D) model = made;
  else throw new Error('the model module made neither a distance field, a geometry nor an object');
  const buildMs = performance.now() - started;
  model.updateWorldMatrices?.(true);
  let triangles = 0, vertices = 0, meshes = 0;
  const materials = new Set(), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  model.traverse(o => {
    if (!(o instanceof W.Mesh3D)) return;
    meshes++;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    const g = o.geometry, p = g.getAttribute('position');
    if (!p) return;
    vertices += p.count;
    if (g.topology === 'triangles') triangles += (g.index ? g.index.count : p.count) / 3;
    const e = o.matrixWorld, d = p.data;
    for (let i = 0; i < d.length; i += 3) {
      const x = d[i], y = d[i + 1], z = d[i + 2];
      const w = [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
      for (let a = 0; a < 3; a++) { if (w[a] < min[a]) min[a] = w[a]; if (w[a] > max[a]) max[a] = w[a]; }
    }
  });
  if (meshes === 0 || triangles === 0) throw new Error('the model has no triangles to draw');
  const app = await createWorld3DApp(document.getElementById('c'), { dynamicResolution: false, quality: 'high' });
  const scene = new W.Scene3D();
  scene.background = [0.55, 0.62, 0.7];
  scene.addChild(model);
  const centre = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const radius = Math.max(1e-3, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
  const floor = new W.Mesh3D(W.createPlaneGeometry3D({ width: radius * 60, height: radius * 60 }), W.createStandardMaterial3D({ color: 0x8c8f88, roughness: 1 }));
  floor.setRotation(-Math.PI / 2, 0, 0);
  floor.setPosition(centre[0], min[1] - radius * 0.002, centre[2]);
  scene.addChild(floor);
  scene.addChild(W.createHemisphereLight3D({ color: 0xdfe8ff, groundColor: 0x5a5244, intensity: 0.9 }));
  const sun = W.createDirectionalLight3D({ color: 0xfff3e0, intensity: 2.2, castShadow: true });
  sun.setPosition(centre[0] + radius * 3, centre[1] + radius * 5, centre[2] + radius * 4).lookAt(centre[0], centre[1], centre[2]);
  scene.addChild(sun);
  const fov = 35;
  const camera = W.createPerspectiveCamera3D({ fov, near: radius / 50, far: radius * 50 });
  scene.addChild(camera);
  const distance = (radius / Math.sin((fov / 2) * Math.PI / 180)) * 1.08;
  const views = [[0, 0.12], [Math.PI / 4, 0.45], [Math.PI / 2, 0.12], [Math.PI * 1.25, 0.45]];
  let frames = 0;
  app.show(scene, camera, { onUpdate: () => { frames++; } });
  const settle = async () => { const at = frames; while (frames < at + 4) await new Promise(r => requestAnimationFrame(r)); };
  globalThis.__view = async (i) => {
    const [turn, rise] = views[i];
    camera.setPosition(centre[0] + Math.sin(turn) * Math.cos(rise) * distance, centre[1] + Math.sin(rise) * distance, centre[2] + Math.cos(turn) * Math.cos(rise) * distance);
    camera.lookAt(centre[0], centre[1], centre[2]);
    await settle();
  };
  globalThis.__glb = () => Array.from(W.exportGlb3D(model));
  report({ ok: true, buildMs: Math.round(buildMs), triangles, vertices, meshes, materials: materials.size,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]].map(v => Math.round(v * 1000) / 1000) });
} catch (error) {
  report({ ok: false, error: String(error && error.stack || error) });
}
</script></body></html>`;
}

/** Serves the engine checkout, the model's folder under /__model/, and the preview page at /. */
function serve(modelDir, page) {
  const server = http.createServer((request, response) => {
    const url = decodeURIComponent(new URL(request.url, 'http://x').pathname);
    if (url === '/') {
      response.writeHead(200, { 'content-type': TYPES['.html'] });
      response.end(page);
      return;
    }
    const base = url.startsWith('/__model/') ? modelDir : root;
    const rest = url.startsWith('/__model/') ? url.slice('/__model/'.length) : url.slice(1);
    const file = path.resolve(base, rest);
    if (!file.startsWith(base) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    response.end(fs.readFileSync(file));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** Four views of the model in one picture, its numbers, and its .glb when asked. */
export async function previewModel({ chromium, PNG, model, out, glb }) {
  const modelDir = path.dirname(model);
  const server = await serve(modelDir + path.sep, previewPage('/__model/' + encodeURIComponent(path.basename(model))));
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  try {
    const page = await browser.newPage({ viewport: { width: VIEW, height: VIEW } });
    const logs = [];
    page.on('pageerror', error => logs.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') logs.push(message.text());
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => globalThis.__preview !== undefined, null, { timeout: 120000 });
    const result = await page.evaluate(() => globalThis.__preview);
    if (!result.ok) return { ...result, logs };
    const sheet = new PNG({ width: VIEW * 2, height: VIEW * 2 });
    let blank = 0;
    for (let i = 0; i < 4; i++) {
      await page.evaluate(view => globalThis.__view(view), i);
      const shot = PNG.sync.read(await page.locator('#c').screenshot());
      const colours = new Set();
      for (let p = 0; p < shot.data.length; p += 16)
        colours.add((shot.data[p] >> 4) * 256 + (shot.data[p + 1] >> 4) * 16 + (shot.data[p + 2] >> 4));
      if (colours.size < 4) blank++;
      PNG.bitblt(
        shot,
        sheet,
        0,
        0,
        Math.min(VIEW, shot.width),
        Math.min(VIEW, shot.height),
        (i % 2) * VIEW,
        (i >> 1) * VIEW
      );
    }
    fs.writeFileSync(out, PNG.sync.write(sheet));
    if (glb !== undefined) fs.writeFileSync(glb, Uint8Array.from(await page.evaluate(() => globalThis.__glb())));
    return {
      ...result,
      picture: out,
      ...(glb !== undefined ? { glb } : {}),
      ok: blank === 0,
      ...(blank ? { error: blank + ' views drew nothing' } : {}),
      logs
    };
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const glbAt = args.indexOf('--glb');
  const glb = glbAt >= 0 ? args.splice(glbAt, 2)[1] : undefined;
  const [playwright, model, out] = args;
  if (!playwright || !model || !out || !path.isAbsolute(playwright) || args.length !== 3 || (glbAt >= 0 && !glb))
    throw new Error(
      'Usage: node tools/model-preview.mjs <absolute Playwright index.mjs> <model.mjs> <picture.png> [--glb <model.glb>]'
    );
  const file = path.resolve(model);
  if (!fs.existsSync(file)) throw new Error('There is no model module at ' + file);
  const { chromium } = await import(pathToFileURL(playwright).href),
    { PNG } = createRequire(import.meta.url)('pngjs');
  const report = await previewModel({
    chromium,
    PNG,
    model: file,
    out: path.resolve(out),
    glb: glb === undefined ? undefined : path.resolve(glb)
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
