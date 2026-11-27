// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function checkNames(names, excludePrivate) {
  if (!Array.isArray(names) || !names.length) throw new Error('Expected an explicit handoff file list');
  const seen = new Set();
  for (const name of names) {
    const parts = typeof name === 'string' ? name.split('/') : [];
    if (!parts.length || parts.some(part => !part || part === '.' || part.endsWith('.') ||
        part.endsWith(' ') || /[\\:\x00-\x1f<>"|?*]/u.test(part) ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) ||
        seen.has(name.normalize('NFC').toLowerCase())) throw new Error('Invalid or duplicate handoff path: ' + name);
    if (excludePrivate && parts.some(part => /^(?:\.git|\.gradle|node_modules|build|local\.properties|\.npmrc|\.env(?:\..*)?)$/i.test(part) ||
        /\.(?:jks|keystore|p12|pfx|pem|key|apk|aab)$/i.test(part))) throw new Error('Private or generated handoff input: ' + name);
    seen.add(name.normalize('NFC').toLowerCase());
  }
}

async function copyRegular(root, name, output) {
  const input = path.join(root, name);
  if (!(await lstat(input)).isFile() || path.relative(root, await realpath(input)) !== path.normalize(name))
    throw new Error('Expected a regular, unaliased handoff file: ' + name);
  const target = path.join(output, name);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(input, target);
  return { name, sha256: await digest(target) };
}

/** Share only files selected by the owner. Preserve paths the game's build resolves. */
export async function copySelected(directory, names, output) {
  checkNames(names, true);
  const root = await realpath(directory);
  const files = [];
  for (const name of [...names].sort()) files.push(await copyRegular(root, name, output));
  return files;
}

export async function createHandoff(options) {
  const { project, plan, kit, out } = options;
  if (!project || !plan || !kit || !out || !/^[a-f0-9]{64}$/.test(options['kit-sha256'] ?? ''))
    throw new Error('Supply --project, --plan, --kit, --kit-sha256 and --out');
  const layout = JSON.parse(await readFile(plan, 'utf8'));
  const root = await realpath(kit);
  const receiptFile = path.join(root, 'kit.json');
  const bytes = await readFile(receiptFile);
  if (createHash('sha256').update(bytes).digest('hex') !== options['kit-sha256'])
    throw new Error('Handoff kit receipt differs from the accepted digest');
  const receipt = JSON.parse(bytes);
  if (layout.schemaVersion !== 1 || receipt.schemaVersion !== 1 || receipt.platform !== process.platform ||
      receipt.arch !== process.arch || receipt.node !== process.versions.node) throw new Error('Unsupported handoff plan or kit');
  checkNames(receipt.files.map(file => file.path), false);
  checkNames(layout.sourceFiles, true);
  if (!layout.sourceFiles.includes('project.json')) throw new Error('Handoff requires the editable project.json');
  const dest = path.resolve(out);
  try { await lstat(dest); throw new Error('Use a new handoff location'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(path.dirname(dest), { recursive: true });
  const temp = await mkdtemp(path.join(path.dirname(dest), '.egret-handoff-'));
  try {
    const tools = path.join(temp, 'kit');
    const game = path.join(temp, 'source');
    const android = path.join(temp, 'android');
    const sourceFiles = await copySelected(project, layout.sourceFiles, game);
    for (const file of receipt.files) {
      const copied = await copyRegular(root, file.path, tools);
      if (copied.sha256 !== file.sha256) throw new Error('Handoff kit mismatch: ' + file.path);
    }
    await writeFile(path.join(tools, 'kit.json'), bytes);
    const args = ['--verify-delivery-inputs', '--project', game, '--out', android, '--aar', path.join(tools, 'libs/egret-player.aar'),
      '--esbuild', path.join(tools, 'node_modules/esbuild')];
    for (const [name, value] of Object.entries(layout.application ?? {})) {
      if (!['id', 'name', 'version-code', 'version-name', 'layout', 'icon', 'channel', 'network'].includes(name) ||
          typeof value !== 'string') throw new Error('Unknown handoff application option: ' + name);
      const local = ['icon', 'channel', 'network'].includes(name);
      if (local && !layout.sourceFiles.includes(value)) throw new Error('Handoff must include ' + value);
      args.push('--' + name, local ? path.join(game, value) : value);
    }
    execFileSync(process.execPath, [path.join(tools, 'runtime-sdk/android/player/create-app.mjs'), ...args], { stdio: 'inherit' });
    let hostFiles = [];
    if (layout.androidFiles || options.android) {
      if (!layout.androidFiles || !options.android) throw new Error('Supply both androidFiles and --android');
      // The generated APK assets and player binary are bound to the supplied game and kit.
      if (layout.androidFiles.some(file => !/^src\/main\/(java|res|jniLibs)\//.test(file) &&
          !['src/main/AndroidManifest.xml', 'build.gradle', 'proguard-rules.pro'].includes(file)))
        throw new Error('Invalid handoff Android override');
      hostFiles = await copySelected(options.android, layout.androidFiles, android);
    }
    await writeFile(path.join(temp, 'handoff.json'), JSON.stringify({
      schemaVersion: 1, kitSha256: options['kit-sha256'], application: layout.application, sourceFiles, hostFiles
    }, null, 2) + '\n');
    for (const name of ['README.md', 'README.zh-CN.md']) await copyFile(path.join(tools, name), path.join(temp, name));
    await rename(temp, dest);
    return { sourceFiles: sourceFiles.length, hostFiles: hostFiles.length, kitFiles: receipt.files.length };
  } finally { await rm(temp, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: Object.fromEntries(
    ['project', 'plan', 'kit', 'kit-sha256', 'android', 'out'].map(name => [name, { type: 'string' }])) });
  console.log(JSON.stringify(await createHandoff(values)));
}
