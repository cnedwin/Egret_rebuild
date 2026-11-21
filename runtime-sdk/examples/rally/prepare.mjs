// SPDX-License-Identifier: Apache-2.0
// Build from an owner's local copy of the pinned game. The engine repository
// contains the player adapter; the external rules and art stay in that checkout.
import { createHash } from 'node:crypto';
import { readFile, writeFile, copyFile, mkdir, lstat, mkdtemp, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [input, output] = process.argv.slice(2);
if (!input || !output || process.argv.length !== 4)
  throw new Error('Usage: node prepare.mjs <PortedGamesEgret/Rally> <new-directory>');
const source = path.resolve(input),
  destination = path.resolve(output);
try {
  await lstat(destination);
  throw new Error('Use a fresh output directory.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const pins = JSON.parse(await readFile(path.join(here, 'source.json'), 'utf8'));
async function checked(relative) {
  const bytes = await readFile(path.join(source, relative));
  if (createHash('sha256').update(bytes).digest('hex') !== pins.files[relative])
    throw new Error('Unexpected game source: ' + relative);
  return bytes;
}
// Each extraction is restricted to the checked game version. The mesh parts,
// model fitting and chase camera are the same source functions as the browser.
function before(text, end) {
  const at = text.indexOf(end);
  if (at < 0) throw new Error('Missing source marker: ' + end);
  return text.slice(0, at);
}
function between(text, start, end) {
  const at = text.indexOf(start);
  if (at < 0) throw new Error('Missing source marker: ' + start);
  return before(text.slice(at), end);
}

await mkdir(path.dirname(destination), { recursive: true });
const tmp = await mkdtemp(path.join(path.dirname(destination), 'rally-'));
try {
  const rules = path.join(tmp, 'original');
  await mkdir(rules);
  for (const name of ['sim', 'track', 'data', 'shapes'])
    await writeFile(path.join(rules, name + '.mjs'), await checked('src/' + name + '.mjs'));
  const racers = (await checked('src/racers.mjs')).toString('utf8');
  await writeFile(
    path.join(rules, 'art.mjs'),
    before(racers, '/** A tyre').replace("import { addTrackModel } from './track-models.mjs';", '') +
      '\nexport function partsFor(racer) {return {kart:chassis(racer.body,racer.trim),driver:DRIVERS[racer.id]()};}\n'
  );
  const trackModels = (await checked('src/track-models.mjs')).toString('utf8');
  await writeFile(
    path.join(rules, 'fit.mjs'),
    before(trackModels, 'const DIRECTORY') +
      between(trackModels, 'const ORIGIN', '/** An empty or partially') +
      between(trackModels, 'function fit(bounds', '/** A repeated or moving')
  );
  const originalGate = (await checked('src/start-gate.mjs')).toString('utf8');
  await writeFile(
    path.join(rules, 'gate.mjs'),
    before(originalGate, 'function plaqueTexture').replace("import { addTrackModel } from './track-models.mjs';", '') +
      between(originalGate, 'export function addStartGate', 'const structure =').replace(
        'addStartGate(holder, span, model)',
        'gateParts(span)'
      ) +
      'return parts;\n}\n'
  );
  // Keep the original scatter sequence, including its earlier lily placement.
  const landscape = (await checked('src/scenery.mjs')).toString('utf8');
  await writeFile(
    path.join(rules, 'landscape.mjs'),
    "import {scatterSource} from './shapes.mjs';import {TRACK} from './track.mjs';\nexport function trees(track){const lake=TRACK.lake;\n" +
      between(landscape, 'const chance = scatterSource(20260)', '// ---- sky and light') +
      between(landscape, 'const leaves = [],', 'copies(leaf, leaves') +
      between(landscape, 'const pines = [],', 'copies(trees.pine, pines)') +
      'return {pines,hillPines,blossoms,bamboos};}\n'
  );
  const view = (await checked('src/view.mjs')).toString('utf8');
  await writeFile(
    path.join(rules, 'camera.mjs'),
    "import {wrapAngle} from './track.mjs';\nexport function makeChase(camera,track){\n" +
      between(view, 'const rig =', '/** Circle a point') +
      'return (kart,dt)=>{chase(kart,dt,false);rig.fov+=(rig.fovTarget-rig.fov)*Math.min(1,dt*6);camera.fov=rig.fov;camera.updateProjectionMatrix()};}\n'
  );
  for (const name of ['main', 'circuit', 'cars', 'landmarks'])
    await copyFile(path.join(here, name + '.mjs'), path.join(tmp, name + '.mjs'));
  await copyFile(path.resolve(here, '../roll3d/hud.mjs'), path.join(tmp, 'hud.mjs'));
  const assets = [];
  for (const name of ['panda-kart', 'panda-driver']) {
    const file = name + '.glb';
    await writeFile(path.join(tmp, file), await checked('assets/track-models/' + file));
    assets.push(file);
  }
  await mkdir(path.join(tmp, 'notices'));
  for (const [from, to] of [
    ['assets/track-models/README.md', 'models.md'],
    ['README.md', 'rally.md'],
    ['vendor/LICENSE', 'engine.LICENSE']
  ]) {
    await writeFile(path.join(tmp, 'notices', to), await checked(from));
    assets.push('notices/' + to);
  }
  await writeFile(
    path.join(tmp, 'notices', 'game-source.txt'),
    'Jinxiu Rally: cnedwin/PortedGamesEgret@' +
      pins.commit +
      '\nExternal game code and artwork retain their original ownership. This local build uses the authored panda chassis and driver models without modification.\n'
  );
  assets.push('notices/game-source.txt');
  await writeFile(
    path.join(tmp, 'index.html'),
    '<!doctype html><meta charset="utf-8"><title>Jinxiu Rally</title><script src="./game.js"></script>\n'
  );
  await writeFile(
    path.join(tmp, 'project.json'),
    JSON.stringify(
      { name: 'Jinxiu Rally', width: 873, height: 325, entry: 'index.html', script: 'main.mjs', pages: [], assets },
      null,
      2
    ) + '\n'
  );
  await rename(tmp, destination);
} finally {
  await rm(tmp, { recursive: true, force: true });
}
