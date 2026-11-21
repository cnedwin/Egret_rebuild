// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/bake-models.mjs <models folder or model.mjs ...> <new output folder>
// Usage: node tools/bake-models.mjs --gallery
// Makes models written in code once, ahead of time, and writes each as a .glb, so a game loads the finished mesh with
// loadGltf3D in a few milliseconds instead of making it from its distance field while the player waits. A model module
// is one whose default export makes the model from the exports of @egret/engine/world3d and whose `meshOptions` are
// the options of createSdfGeometry3D, as in examples/models; a folder gives every such module in it. Runs in Node:
// no browser is needed. A rig is not baked (a .glb of it would need its skin and clips); make rigs at run time.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** The model modules a list of files and folders names, in order. */
export function modelFiles(inputs) {
  const files = [];
  for (const input of inputs) {
    const at = path.resolve(input);
    if (!fs.existsSync(at)) throw new Error('There is no model file or folder at ' + at);
    if (fs.statSync(at).isDirectory())
      for (const name of fs.readdirSync(at).sort()) {
        if (name.endsWith('.mjs') && name !== 'index.mjs' && name !== 'gallery.mjs') files.push(path.join(at, name));
      }
    else files.push(at);
  }
  return files;
}

function loadWorld3D() {
  return import(pathToFileURL(path.join(root, 'packages', 'engine', 'dist', 'rendering', 'world3d', 'index.js')).href);
}

async function makeModel(W, module) {
  const model = await module.default(W);
  return model instanceof W.SdfShape3D ? W.createSdfGeometry3D(model, module.meshOptions ?? {}) : model;
}

/** Bake the gallery's static geometry in registry order. The live rigs keep their skin and clips in their modules. */
async function bakeGallery() {
  const W = await loadWorld3D();
  const { models } = await import('../examples/models/index.mjs');
  const group = new W.Object3D();
  const material = W.createStandardMaterial3D({ vertexColors: true });
  for (const name of models) {
    const module = await import('../examples/models/' + name + '.mjs');
    if (typeof module.rig === 'function') continue;
    const geometry = await makeModel(W, module);
    if (!(geometry instanceof W.Geometry3D)) throw new Error('Expected gallery geometry for ' + name);
    const mesh = new W.Mesh3D(geometry, material);
    mesh.name = name;
    group.addChild(mesh);
  }
  const bytes = W.exportGlb3D(group, { name: 'gallery' });
  const target = path.join(root, 'examples', 'models', 'static-models.glb');
  fs.writeFileSync(target, bytes);
  console.log('Baked ' + group.children.length + ' static models (' + bytes.byteLength + ' bytes) to ' + target);
}

/** Makes each model and writes it as `<name>.glb` in `out`; returns what was written. */
export async function bakeModels(files, out) {
  const W = await loadWorld3D();
  fs.mkdirSync(out, { recursive: true });
  const report = [];
  for (const file of files) {
    const module = await import(pathToFileURL(file).href);
    if (typeof module.default !== 'function') {
      report.push({ file, skipped: 'no default export that makes a model' });
      continue;
    }
    const started = performance.now();
    const made = await makeModel(W, module);
    if (!(made instanceof W.Geometry3D) && !(made instanceof W.Object3D)) {
      report.push({ file, skipped: 'made neither a shape, a geometry nor an object' });
      continue;
    }
    const bytes = W.exportGlb3D(made, { name: path.basename(file, '.mjs') });
    const target = path.join(out, path.basename(file, '.mjs') + '.glb');
    fs.writeFileSync(target, bytes);
    report.push({
      file,
      glb: target,
      bytes: bytes.byteLength,
      triangles: made instanceof W.Geometry3D ? made.index.count / 3 : undefined,
      ms: Math.round(performance.now() - started)
    });
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--gallery') {
    await bakeGallery();
  } else {
    if (args.length < 2)
      throw new Error('Usage: node tools/bake-models.mjs <models folder or model.mjs ...> <new output folder>');
    const out = path.resolve(args.pop());
    if (fs.existsSync(out) && fs.readdirSync(out).length > 0)
      throw new Error('The output folder must be new or empty: ' + out);
    const report = await bakeModels(modelFiles(args), out);
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.some(entry => entry.skipped) ? 1 : 0);
  }
}
