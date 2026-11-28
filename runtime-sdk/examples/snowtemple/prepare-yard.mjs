// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceHashes = {
  'build.mjs': '189aea46937b8931b161487fcba4fe3f8f6202af1166559465837c2fd49b94d0',
  'scenery.mjs': '9ccaf9798b04dc5f6ce22018313b589100a290309ded54f959d5ef356dc75d9e',
  'view.mjs': '2dad0d6818b8caea057ef1613f9c035e97bef3603c8387599a871fb3fde75fbd',
  'effects.mjs': '198b570a0e09c4551c0e6409ac064f73beac99160b63d2e452822b315c7856a2'
};

export async function prepareLitYard({ source, temporary, adapter }) {
  const folder = path.join(temporary, 'original');
  const view = path.join(folder, 'view');
  await mkdir(view);
  for (const [name, expected] of Object.entries(sourceHashes)) {
    const text = (await readFile(path.join(source, 'src/view', name), 'utf8')).replaceAll('\r\n', '\n');
    if (createHash('sha256').update(text).digest('hex') !== expected) throw new Error('Unexpected Snow Temple source: ' + name);
    if (name === 'scenery.mjs' || name === 'build.mjs') {
      await writeFile(path.join(view, name), text + (name === 'scenery.mjs' ? '\nexport { buildGround, buildCart, brazier };\n' : ''));
    }
  }
  await writeFile(path.join(folder, 'yard-stage.mjs'), [
    "export { buildGround, buildCart, brazier } from './view/scenery.mjs';",
    "export { createBuilder } from './view/build.mjs';",
    "export { ROUNDS as rounds } from './rules/arena.mjs';", ''
  ].join('\n'));
  const result = execFileSync(process.execPath, [
    '--import', pathToFileURL(path.join(temporary, 'vendor/node-register.mjs')).href,
    path.join(adapter, 'bake-yard.mjs'), temporary
  ], { encoding: 'utf8' });
  const sizes = JSON.parse(result);
  await cp(path.join(adapter, 'yard-lighting.mjs'), path.join(temporary, 'yard-lighting.mjs'));
  await cp(path.join(adapter, 'check-lit-temple.mjs'), path.join(temporary, 'check-lit-temple.mjs'));
  const profile = path.join(temporary, 'profile.mjs');
  await cp(profile, path.join(temporary, 'temple.mjs'));
  await writeFile(profile, [
    "import { openScene as temple } from './temple.mjs';",
    "import { createYardLighting } from './yard-lighting.mjs';",
    "export { controls } from './temple.mjs';",
    "export const lightingProfile = true;",
    "export const openScene = services => temple(services, createYardLighting);", ''
  ].join('\n'));
  return sizes;
}
