// SPDX-License-Identifier: Apache-2.0
// Only the adapter belongs to the SDK. The game owner's unmodified model, motion
// capture, rules and equipment are staged locally from the pinned browser game.
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, writeFile, rename, rm, lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [input, output, mode] = process.argv.slice(2);
const duel = mode === '--duel';
const encounters = mode === '--encounters';
const yard = mode === '--yard' || duel || encounters;
if (!input || !output || process.argv.length !== (yard ? 5 : 4))
  throw new Error('Usage: node prepare.mjs <PortedGamesEgret/SnowTemple> <new-directory> [--yard | --duel | --encounters]');
const source = path.resolve(input), destination = path.resolve(output);
try {
  await lstat(destination);
  throw new Error('Use a fresh output directory.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const pins = JSON.parse(await readFile(path.join(here, 'source.json'), 'utf8'));
async function checked(file) {
  const bytes = await readFile(path.join(source, file));
  const data = /\.(bin|glb)$/.test(file) ? bytes : Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
  if (createHash('sha256').update(data).digest('hex') !== pins.files[file]) throw new Error('Unexpected game input: ' + file);
  return data;
}
// Hash portable names and the bytes actually staged. The pinned vendor consists
// entirely of text. Normalizing only CRLF allows clean Windows checkouts.
async function stageBrowserVendor(tmp) {
  const rows = [];
  async function visit(relative) {
    const folder = path.join(source, 'vendor', relative);
    for (const item of await readdir(folder, { withFileTypes: true })) {
      const name = path.posix.join(relative, item.name);
      if (item.isDirectory()) { await visit(name); continue; }
      if (!item.isFile()) throw new Error('Unexpected browser input: ' + name);
      rows.push(name);
    }
  }
  await visit('');
  const hash = createHash('sha256');
  for (const name of rows.sort()) {
    const file = await readFile(path.join(source, 'vendor', name));
    const bytes = Buffer.from(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(file).replaceAll('\r\n', '\n'));
    hash.update(name + '\0' + createHash('sha256').update(bytes).digest('hex') + '\n');
    const target = path.join(tmp, 'vendor', name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  if (!rows.length || rows.length !== pins.browserVendor.files || hash.digest('hex') !== pins.browserVendor.sha256)
    throw new Error('Browser game engine does not match the pinned vendor tree');
}
function section(text, start, end) {
  const i = text.indexOf(start), j = text.indexOf(end, i + start.length);
  if (i < 0 || j < 0) throw new Error('Missing source boundary: ' + start);
  return text.slice(i, j);
}
await mkdir(path.dirname(destination), { recursive: true });
const tmp = await mkdtemp(path.join(path.dirname(destination), 'snowtemple-'));
try {
  const original = path.join(tmp, 'original');
  for (const dir of [original, path.join(original, 'rules'), path.join(tmp, 'notices')]) await mkdir(dir);
  for (const file of Object.keys(pins.files)) {
    if (file.startsWith('src/rules/')) await writeFile(path.join(original, file.slice(4)), await checked(file));
    if (file.startsWith('src/view/') && !['models', 'characters'].includes(path.basename(file, '.mjs')))
      await writeFile(path.join(original, path.basename(file)), await checked(file));
  }
  const characters = (await checked('src/view/characters.mjs')).toString();
  await writeFile(path.join(original, 'body.mjs'), "import { Mesh3D } from '@egret/engine/world3d';\nexport " +
    section(characters, 'function bodyParts(', 'async function loadCharacter('));
  const models = (await checked('src/view/models.mjs')).toString();
  // Reuse the browser's exact quantization, winding, vertex colors and normals.
  const idx = JSON.parse(await checked('assets/models-low.json'));
  const packed = await checked('assets/models-low.bin');
  const equipment = yard ? ['spear', 'spearEdge', 'sabre', 'sabreEdge'] : ['spear', 'spearEdge'];
  const assets = yard ? ['hero-low.glb', 'blade-low.glb'] : ['hero-low.glb'];
  if (encounters) {
    assets.push('shield-low.glb', 'bow-low.glb');
    equipment.push('short', 'shortEdge', 'rattan', 'longbow');
  }
  for (const model of assets) await writeFile(path.join(tmp, model), await checked('assets/characters/' + model));
  const infos = {};
  for (const name of equipment) {
    const info = idx[name];
    if (info.offset + info.bytes > packed.length || info.skinned) throw new Error('Invalid equipment span: ' + name);
    infos[name] = { ...info, offset: 0 };
    const file = name + '.bin';
    await writeFile(path.join(tmp, file), packed.subarray(info.offset, info.offset + info.bytes));
    assets.push(file);
  }
  // The native reader uses the pinned archive lengths to fill one destination per weapon.
  const lengths = Object.fromEntries(equipment.map(name => [name + '.bin', infos[name].bytes]));
  await writeFile(path.join(tmp, 'equipment-sizes.mjs'), 'export default ' + JSON.stringify(lengths) + ';\n');
  await writeFile(path.join(original, 'equipment.mjs'),
    section(models, 'import { Attribute3D', 'import { loadModelPack') +
    '\nconst index = ' + JSON.stringify(infos) + ';\n' +
    'export function equipment(name, bytes) {\n  const info = index[name];\n  const bin = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);\n  if (bin.byteLength !== info.bytes) throw new Error("Incomplete equipment");\n  const offset = 0;\n' +
    section(models, '    const n = info.count;', '    models[name] = geometry;') + '  return geometry;\n}\n');
  if (yard && !encounters) await cp(path.join(here, 'duel.mjs'), path.join(tmp, 'duel.mjs'));
  if (encounters) {
    await cp(path.join(here, 'chain.mjs'), path.join(tmp, 'profile.mjs'));
    for (const file of ['encounters.mjs', 'check-encounters.mjs']) await cp(path.join(here, file), path.join(tmp, file));
  } else if (duel) {
    await cp(path.join(here, 'yard.mjs'), path.join(tmp, 'yard.mjs'));
    await cp(path.join(here, 'check-duel.mjs'), path.join(tmp, 'check-duel.mjs'));
    await writeFile(path.join(tmp, 'profile.mjs'), "export { duelControls as controls, openDuel as openScene } from './yard.mjs';\n");
  } else await cp(path.join(here, yard ? 'yard.mjs' : 'solo.mjs'), path.join(tmp, 'profile.mjs'));
  for (const file of ['main.mjs', 'actors.mjs', 'hero.mjs', 'browser.mjs', 'browser.html']) await cp(path.join(here, file), path.join(tmp, file));
  await cp(path.resolve(here, '../roll3d/hud.mjs'), path.join(tmp, 'hud.mjs'));
  for (const [from, to] of [
    ['README.md', 'game.md'], ['assets/characters/README.md', 'character.md'],
    ['docs/locomotion-source.md', 'locomotion.md'], ['docs/combat-motion-source.md', 'combat-motion.md'],
    ['vendor/LICENSE', 'engine-license.txt'], ['vendor/NOTICE', 'engine-notice.txt'], ['vendor/SOURCE.md', 'browser-engine.md']
  ]) {
    const file = 'notices/' + to;
    await writeFile(path.join(tmp, file), await checked(from));
    assets.push(file);
  }
  await writeFile(path.join(tmp, 'notices/source.txt'), pins.repository + '/tree/' + pins.commit + '/SnowTemple\nGame and motion assets retain their original ownership and terms.\n');
  assets.push('notices/source.txt');
  await writeFile(path.join(tmp, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Lin Chong</title><script src="./game.js"></script>\n');
  await writeFile(path.join(tmp, 'project.json'), JSON.stringify({
    name: encounters ? 'Fodder Yard Parties' : duel ? 'Fodder Yard Duel' : yard ? 'Fodder Yard Encounter' : 'Lin Chong', width: 768, height: 432, entry: 'index.html', script: 'main.mjs', pages: [], assets
  }, null, 2) + '\n');
  // The comparison page uses the browser game's shipped World3D. These
  // modules are outside the Android project's asset manifest.
  const importMap = await checked('vendor/importmap.json');
  await stageBrowserVendor(tmp);
  const html = await readFile(path.join(tmp, 'browser.html'), 'utf8');
  await writeFile(path.join(tmp, 'browser.html'), html.replace('<!-- GAME_IMPORT_MAP -->',
    '<script type="importmap">' + importMap.toString().replaceAll('<', '\\u003c') + '</script>'));
  await rename(tmp, destination);
} finally {
  await rm(tmp, { recursive: true, force: true });
}
