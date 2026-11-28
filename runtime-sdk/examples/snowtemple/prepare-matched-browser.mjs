// SPDX-License-Identifier: Apache-2.0
// Stage a browser sibling using the engine build used for the APK, retaining the game owner's vendor page.
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const [prepared, output] = process.argv.slice(2);
if (!prepared || !output || process.argv.length !== 4) throw new Error('Usage: node prepare-matched-browser.mjs <prepared-lit-temple> <new-directory>');
const source = path.resolve(prepared), destination = path.resolve(output);
if (destination === source || destination.startsWith(source + path.sep)) throw new Error('Use a separate fresh output directory');
try { await stat(destination); throw new Error('Output already exists'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const require = createRequire(path.join(repository, 'package.json'));
await mkdir(path.dirname(destination), { recursive: true });
const staging = await mkdtemp(path.join(path.dirname(destination), 'snowtemple-matched-'));
try {
  await cp(source, staging, { recursive: true });
  const receipts = {}, imports = {};
  async function stageModules(folder, prefix) {
    for (const entry of await readdir(folder,{withFileTypes:true})) {
      const from = path.join(folder, entry.name);
      const name = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) { await stageModules(from, name); continue; }
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
      const bytes = await readFile(from);
      const target = path.join(staging,name);
      await mkdir(path.dirname(target),{recursive:true});
      await writeFile(target,bytes);
      receipts[name] = createHash('sha256').update(bytes).digest('hex');
    }
  }
  for (const id of ['contracts', 'runtime', 'engine']) {
    const folder = path.join(repository, 'packages', id), prefix = 'engine-current/' + id;
    const pkg = JSON.parse(await readFile(path.join(folder,'package.json'),'utf8'));
    await stageModules(path.join(folder, 'dist'), prefix + '/dist');
    function add(name, spec) {
      const relative = typeof spec === 'string' ? spec : spec.import;
      const key = path.posix.join(prefix,relative);
      if (!receipts[key]) throw new Error('Missing compiled module for '+name+': '+key);
      imports[name] = './' + key;
    }
    for (const [key,spec] of Object.entries(pkg.exports)) add(pkg.name + (key === '.' ? '' : '/' + key.slice(2)), spec);
    for (const [key,spec] of Object.entries(pkg.imports ?? {})) add(key,spec);
  }
  const robust = require.resolve('robust-predicates');
  await stageModules(path.dirname(robust),'engine-current/robust-predicates');
  imports['robust-predicates'] = './engine-current/robust-predicates/' + path.basename(robust);
  for (const notice of ['LICENSE', 'NOTICE']) {
    await cp(path.join(repository, notice), path.join(staging, 'engine-current', notice));
  }
  await cp(path.join(path.dirname(robust), 'LICENSE'), path.join(staging, 'engine-current/robust-predicates/LICENSE'));
  const page = path.join(staging,'browser.html'), markup = await readFile(page,'utf8');
  const original = /<script type="importmap">[\s\S]*?<\/script>/g;
  if ([...markup.matchAll(original)].length !== 1) throw new Error('Expected the prepared import map');
  const map = JSON.stringify({imports},null,2).replaceAll('<','\\u003c');
  await writeFile(page,markup.replace(original, '<script type="importmap">' + map + '</script>'));
  const entries = Object.entries(receipts).sort(([a],[b])=>a.localeCompare(b));
  await writeFile(path.join(staging,'browser-source-sha256.json'),JSON.stringify(Object.fromEntries(entries),null,2) + '\n');
  await rename(staging,destination);
  console.log(JSON.stringify({ stagedModules: entries.length, mappedNames: Object.keys(imports).length }));
} finally {
  await rm(staging,{recursive:true,force:true});
}
