// SPDX-License-Identifier: Apache-2.0
// Construct the reproducible Lantern Guardian input without bundling or downloading Egret 5.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const fixture = fs.realpathSync(import.meta.dirname);
const expectedRuntime = new Map([
  ['egret/egret.js', '032c11f385165b66b4a4bbcd4e199f0ae07aeeca359c0b5bb344067a4257c690'],
  ['egret/egret.web.js', '2236d4eb9f41db9e735220460b52073655781210b16b10c3f0231a547da0a7eb'],
  ['eui/eui.js', '146f21be584e6fab092d8d1a031b29b4b5d03e4f07ad4e77ba9c2dfd5b9c0686'],
  ['assetsmanager/assetsmanager.js', '2cdeff8fda9589b0e73702cf1cdb3694025b1f67a52f84f50ee04a12dc85aa2a'],
  ['dragonBones/dragonBones.js', '19c96f7f1f26e22dc1c0e7d57e1ce0e3c377652b282d448705b84d653b1976b5']
]);
const authored = [
  'egretProperties.json',
  'index.html',
  'manifest.json',
  'fixture-notice.txt',
  'resource/default.res.json',
  'resource/default.thm.json',
  'resource/guardian_ske.json',
  'resource/guardian_tex.json',
  'resource/guardian_tex.png',
  'resource/skins/ActionButtonSkin.exml',
  'resource/skins/ScoreSkin.exml',
  'resource/skins/TrialSkin.exml',
  'resource/trial.json',
  'src/Main.ts'
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

const { values } = parseArgs({
  options: {
    'legacy-libs': { type: 'string' },
    esbuild: { type: 'string' },
    out: { type: 'string' }
  },
  strict: true
});
if (!values['legacy-libs'] || !values.esbuild || !values.out) {
  throw new TypeError(
    'Usage: node prepare.mjs --legacy-libs <Egret 5.2.7 build directory> --esbuild <esbuild 0.27.4 lib/main.js> --out <new directory>'
  );
}
const requested = path.resolve(values.out);
const output = path.join(fs.realpathSync(path.dirname(requested)), path.basename(requested));
const relative = path.relative(fixture, output);
if (relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) {
  throw new TypeError('The output must be outside the repository fixture directory.');
}
if (fs.existsSync(output)) throw new TypeError('The output directory already exists.');

const sdk = fs.realpathSync(values['legacy-libs']);
const files = new Map();
for (const [name, expected] of expectedRuntime) {
  const bytes = fs.readFileSync(path.join(sdk, ...name.split('/')));
  if (hash(bytes) !== expected) throw new TypeError('Expected the original Egret 5.2.7 runtime file: ' + name);
  files.set('libs/modules/' + name, bytes);
}
for (const name of authored) {
  const logical = name === 'fixture-notice.txt' ? 'NOTICE' : name;
  files.set(logical, fs.readFileSync(path.join(fixture, 'project', ...name.split('/'))));
}
const esbuild = (await import(pathToFileURL(path.resolve(values.esbuild)).href)).default;
if (esbuild?.version !== '0.27.4') throw new TypeError('Use esbuild 0.27.4 for the admitted original script bytes.');
const built = await esbuild.transform(files.get('src/Main.ts').toString('utf8'), {
  loader: 'ts',
  target: 'es2017',
  tsconfigRaw: { compilerOptions: { useDefineForClassFields: false } }
});
files.set('bin-debug/Main.js', Buffer.from(built.code));

// Finish all input and compiler checks before creating a new output tree.
fs.mkdirSync(output, { recursive: false });
for (const [name, bytes] of files) {
  const destination = path.join(output, ...name.split('/'));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes, { flag: 'wx' });
}
console.log(
  JSON.stringify(
    {
      output,
      files: files.size,
      runtime: '5.2.7',
      esbuild: esbuild.version,
      builtSha256: hash(files.get('bin-debug/Main.js'))
    },
    null,
    2
  )
);
