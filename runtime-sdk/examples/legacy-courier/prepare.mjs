// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { compileExml } from '../../../tools/egret-migrate/exml.mjs';

export function prepareCourier(out, classicBuild) {
  const source = fileURLToPath(new URL('.', import.meta.url));
  fs.mkdirSync(out, { recursive: false });
  fs.copyFileSync(path.join(source, 'main.mjs'), path.join(out, 'main.mjs'));
  let business = fs.readFileSync(path.join(source, 'courier.js'));
  if (classicBuild) {
    const report = JSON.parse(fs.readFileSync(path.join(classicBuild, 'classic-build.json'), 'utf8'));
    const plan = JSON.parse(fs.readFileSync(path.join(classicBuild, 'v8-scripts.json'), 'utf8'));
    const artifact = report.artifacts?.[0];
    if (report.target !== 'es2015' || report.diagnostics?.length !== 0 || report.artifacts.length !== 1 ||
        artifact.source !== 'src/CourierMain.ts' || artifact.file !== 'classic/0000.js' ||
        plan.v8Scripts?.startup?.length !== 0 || plan.v8Scripts?.groups?.courier?.length !== 1 ||
        plan.v8Scripts.groups.courier[0] !== artifact.file) throw new Error('Expected the compiled CourierMain fixture');
    business = fs.readFileSync(path.join(classicBuild, artifact.file));
    if (createHash('sha256').update(business).digest('hex') !== artifact.sha256) throw new Error('Courier script changed after compilation');
  }
  fs.writeFileSync(path.join(out, 'courier.js'), business);
  const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
  const board = compileExml(fs.readFileSync(path.join(source, 'Board.exml'), 'utf8'), { path: 'Board.exml' });
  write('theme.json', { skins: {}, exmls: [board] });
  write('routes.json', [{ name: '北门驿站', marker: 'north_png' }, { name: '南门渡口', marker: 'south_png' }]);
  for (const [file, color] of [['north.png',[45,160,250]], ['south.png',[240,98,42]]]) {
    const rgba = Buffer.alloc(8 * 8 * 4);
    for (let i = 0; i < 64; i++) rgba.set([...color,255], i * 4);
    fs.writeFileSync(path.join(out, file), PNG.sync.write({ width: 8, height: 8, data: rgba }));
  }
  fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><meta charset="utf-8"><script src="game.js"></script>\n');
  write('project.json', { width: 320, height: 180, entry: 'index.html', pages: [],
    assets: ['routes.json','north.png','south.png'], v8Scripts: { groups: { courier: ['courier.js'] } } });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [out, option, build] = process.argv.slice(2);
  if (!out || (option !== undefined && (option !== '--classic-build' || !build)) || process.argv.length > 5)
    throw new Error('Supply a new output directory and optional --classic-build <compiler output>');
  prepareCourier(path.resolve(out), build && path.resolve(build));
}
