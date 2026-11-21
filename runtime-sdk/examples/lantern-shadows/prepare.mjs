// SPDX-License-Identifier: Apache-2.0
import { readFile, writeFile, mkdir, copyFile, lstat, mkdtemp, rename, rm } from 'node:fs/promises';
import { prepareLanternAssets } from './assets-prepare.mjs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const pin = '7b774670237666d73247cc793c55530f7f7c1e5f';
const checks = {
  'src/main.mjs': '04f941c52f5e52d07b0dfa5dfbc7d1adada64ca8d1947fa237aac1dd6f8a2c46',
  'src/input.mjs': '81a3368c81b3136470a9951c3eff42313242af1b8f9df4a11800bc1618a7af39',
  'src/puppets.mjs': '129fe3424d921858c033168d281b48dc9e1d3e950053ab8b995e727ad1d679b9',
  'src/records.mjs': '1f730b98056f954ca6febedfa9360798de88fcee4e9997b46a2cf92baace41cb',
  'src/rules/act.mjs': '284ed6c5fa34b631cf2761250224683595c625e9931d8909a65d020d1b090c1a',
  'src/rules/boss.mjs': '96ef4dbb85c88bbc501e314fef315f43ae1d4da066ae37fc841379597d34fe95',
  'src/rules/clones.mjs': '1a535f54cdb3fdceb260843e2f0a3b2e79367e88545b7a25dd536b7d66bf1246',
  'src/rules/erlang.mjs': '5985e57558f3416228bfe24ef1912ec7053ada5f65d67b5548f8754089101b2f',
  'src/rules/foes.mjs': '1a8a33d05cf29be652c3e9185489a88f37b6ef623f38cfb73d6b6caf72271fa8',
  'src/rules/hero.mjs': '8d7df31cdb1ab3d1a6952a5542cbaf52c9d0f0b881333fb0470c275740585234',
  'src/rules/laozi.mjs': '006f9dda374e85d2741f43c2ef8eab267c26bae5be42ae7324d4066ae3dd9519',
  'src/rules/level.mjs': '4606685147dd49955fcce2530723239c8fbf85f13236bc48735273d3564b16fb',
  'index.html': '388efe3b19876a266e665740983c5c4e329100e8e8ef1c5b000eb9a1ed45926f',
  'vendor/LICENSE': 'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4',
  'vendor/NOTICE': '45ca1fe45273afe691d3bf0d34d22c7541dac7da389a85665a8df9d8b992f070',
  'vendor/@esotericsoftware__spine-core/LICENSE':
    '435774fb793b0f67892899fc934f98009e64fd90ad3ab964117274e279a0f50e',
  'vendor/robust-predicates/LICENSE': '88d9b4eb60579c191ec391ca04c16130572d7eedc4a86daa58bf28c6e14c9bcd'
};
const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw Error('Usage: node prepare.mjs <pinned LanternShadows directory> <new local project directory>');
const target = path.resolve(destination);
try {
  await lstat(target);
  throw Error('Use a new output directory');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(path.dirname(target), { recursive: true });
const dest = await mkdtemp(path.join(path.dirname(target), 'lantern-build-'));
try {
  await assemble();
  await rename(dest, target);
} finally {
  await rm(dest, { recursive: true, force: true });
}
async function assemble() {
  await mkdir(path.join(dest, 'rules'), { recursive: true });
  async function checked(p) {
    const bytes = await readFile(path.join(source, p));
    if (checks[p] && createHash('sha256').update(bytes).digest('hex') !== checks[p])
      throw Error('Expected original ' + pin + ': ' + p);
    return bytes.toString('utf8');
  }
  function section(s, a, b) {
    const i = s.indexOf(a),
      j = s.indexOf(b, i + 1);
    if (i < 0 || j <= i || i !== s.lastIndexOf(a)) throw Error('Missing source section ' + a);
    return s.slice(i, j);
  }
  function decoded(s) {
    return s
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&nbsp;', '\u00a0');
  }
  // The upstream playbill is fixed, well-formed HTML with quoted attributes, no
  // inline scripts inside <main>, and only these void elements. Preserve its labels.
  function playbill(sourceHtml) {
    const html = section(sourceHtml, '<main ', '</main>') + '</main>',
      nodes = [],
      stack = [];
    for (const token of html.replace(/<!--[\s\S]*?-->/g, '').match(/<[^>]+>|[^<]+/g)) {
      if (token.startsWith('</')) {
        const name = token.slice(2, -1).trim();
        if (nodes[stack.pop()]?.[0] !== name) throw Error('Unbalanced game markup: ' + name);
      } else if (token.startsWith('<')) {
        const m = /^<([\w-]+)([\s\S]*?)\s*\/?>$/.exec(token);
        if (!m) throw Error('Unexpected markup ' + token);
        const attrs = {};
        for (const a of m[2].matchAll(/([^\s=/"']+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)')?/g))
          attrs[a[1]] = decoded(a[2] ?? a[3] ?? '');
        const i = nodes.push([m[1], attrs, stack.at(-1) ?? -1, '']) - 1;
        if (!/^(?:br|img|hr|input|source|meta|link)$/.test(m[1]) && !token.endsWith('/>')) stack.push(i);
      } else if (stack.length && token.trim()) nodes[stack.at(-1)][3] += decoded(token.trim());
    }
    if (stack.length) throw Error('Unclosed playbill element');
    return nodes;
  }
  for (const file of Object.keys(checks).filter((name) => name.startsWith('src/rules/'))) {
    await writeFile(path.join(dest, 'rules', path.basename(file)), await checked(file));
  }
  await writeFile(path.join(dest, 'records.mjs'), await checked('src/records.mjs'));
  const puppet = await checked('src/puppets.mjs');
  await writeFile(
    path.join(dest, 'puppet.mjs'),
    "import {createSpineInstance,createSpineDisplay} from '@egret/spine';\n" +
      puppet.slice(puppet.indexOf('export function createPuppet('))
  );
  const input = await checked('src/input.mjs');
  const bound = input.slice(input.indexOf('const KEYS =')).replaceAll('export function ', 'function ');
  await writeFile(
    path.join(dest, 'input.mjs'),
    'export function bindGameInputs(window,document) {\nconst createBrowserGamepadInput=()=>undefined;\n' +
      bound +
      '\nreturn {createInput,bindPlayButton};\n}\n'
  );
  const original = await checked('src/main.mjs');
  const imports = original
    .split('\n')
    .filter(
      (line) =>
        line.startsWith('import ') &&
        !['./input.mjs', './sound.mjs', './pictures.mjs', '@egret/engine/web/game', './puppets.mjs'].some(
          (x) => line.includes("'" + x + "'")
        )
    )
    .join('\n');
  const up = original
    .slice(original.indexOf('const STAGE ='))
    .replace(
      section(original, 'const loadPicture = createPictures(', 'const levels = Object.fromEntries('),
      `
const ACTS=['act1','act2','act3'];
const {art,puppetOf,maps}=await host.assets();
const filled=()=>{};
`
    )
    .replace('new URLSearchParams(location.search)', 'host.query')
    .replace('globalThis.localStorage', 'host.storage')
    .replace('globalThis.__lantern =', 'const observed =');
  if (!up.startsWith('const STAGE') || up.includes('import.meta.url') || !up.includes('const observed ='))
    throw Error('Unsupported game entry');
  const shell = `
export async function runLantern(host){
const {document,window,performance,createSound,createBrowserGame} = host;
const {createInput,bindPlayButton}=bindGameInputs(window,document);
const navigator={language:'zh-CN'}, devicePixelRatio=1, addEventListener=window.addEventListener.bind(window);
const matchMedia=()=>({matches:true});
`;
  await writeFile(
    path.join(dest, 'session.mjs'),
    imports +
      "\nimport {createPuppet} from './puppet.mjs';\nimport {bindGameInputs} from './input.mjs';\n" +
      shell +
      up +
      '\nhost.observe(()=>observed);\n}\n'
  );
  const html = await checked('index.html');
  const nodes = playbill(html);
  await writeFile(path.join(dest, 'playbill.mjs'), 'export const playbill=' + JSON.stringify(nodes) + ';\n');
  for (const [src, name] of [
    ['model.mjs', 'model.mjs'],
    ['main.mjs', 'main.mjs']
  ])
    await copyFile(path.join(here, src), path.join(dest, name));
  await writeFile(
    path.join(dest, 'index.html'),
    '<!doctype html><meta charset="utf-8"><script src="./game.js"></script>\n'
  );
  const metadata = await prepareLanternAssets(source, dest, [html, original]);
  await mkdir(path.join(dest, 'notices'), { recursive: true });
  for (const [original, name] of Object.entries({
    'vendor/LICENSE': 'LICENSE',
    'vendor/NOTICE': 'NOTICE',
    'vendor/@esotericsoftware__spine-core/LICENSE': 'Spine-Runtimes.LICENSE',
    'vendor/robust-predicates/LICENSE': 'robust-predicates.LICENSE'
  })) {
    await writeFile(path.join(dest, 'notices', name), await checked(original));
    metadata.assets.push('notices/' + name);
  }
  await writeFile(
    path.join(dest, 'notices', 'game-source.txt'),
    'Lantern Shadows, cnedwin/PortedGamesEgret@' +
      pin +
      '\nGame and generated art: Apache-2.0. The Android adapter replaces browser I/O, keeps the original campaign and control rules, and uses muted audio for the comparison.\n'
  );
  metadata.assets.push('notices/game-source.txt');
  await writeFile(
    path.join(dest, 'project.json'),
    JSON.stringify(
      {
        width: 960,
        height: 540,
        entry: 'index.html',
        script: 'main.mjs',
        pages: metadata.pages,
        assets: metadata.assets
      },
      null,
      2
    ) + '\n'
  );
}
