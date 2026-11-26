// SPDX-License-Identifier: Apache-2.0
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { hash, json } from './inspect.mjs';
import { ownerRelativePath, samePhysicalPath } from '../lib/file-identity.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));

async function pack(options) {
  const out = path.resolve(options.out);
  const esbuild = await import(pathToFileURL(path.resolve(options.esbuild)).href);
  const engineTools = [
    'bin.mjs',
    'legacy-web.mjs',
    'legacy-eui.mjs',
    'legacy-bones.mjs',
    'README.md',
    'README.zh-CN.md'
  ];
  fs.mkdirSync(out);
  const temporary = fs.realpathSync(os.tmpdir());
  const stage = fs.mkdtempSync(path.join(temporary, 'egret-migrate-pack-'));
  try {
    // Bundle the admitted Node implementation; the browser bridge stays an independently copied ESM file.
    await esbuild.build({
      entryPoints: [path.join(here, 'cli.mjs')],
      outfile: path.join(stage, 'cli.mjs'),
      platform: 'node',
      target: 'node26',
      format: 'esm',
      mainFields: ['module', 'main'],
      bundle: true,
      legalComments: 'inline',
      banner: {
        js: 'import { createRequire as createBundleRequire } from "node:module"; const require = createBundleRequire(import.meta.url);'
      }
    });
    for (const name of engineTools) fs.copyFileSync(path.join(here, name), path.join(stage, name));
    fs.mkdirSync(path.join(stage, 'skill'));
    for (const name of ['SKILL.md', 'SKILL.zh-CN.md'])
      fs.copyFileSync(path.join(here, 'skill', name), path.join(stage, 'skill', name));
    fs.copyFileSync(path.join(root, 'LICENSE'), path.join(stage, 'LICENSE'));
    fs.copyFileSync(path.join(root, 'NOTICE'), path.join(stage, 'NOTICE'));
    fs.copyFileSync(path.join(root, 'third-party/pngjs-7.0.0.LICENSE'), path.join(stage, 'pngjs.LICENSE'));
    const projectPackage = fileURLToPath(import.meta.resolve('@egret/project'));
    const parser = createRequire(projectPackage).resolve('jsonc-parser/package.json');
    fs.copyFileSync(path.join(path.dirname(parser), 'LICENSE.md'), path.join(stage, 'jsonc-parser.LICENSE.md'));
    const transitive = ['pngjs.LICENSE', 'jsonc-parser.LICENSE.md'];
    fs.writeFileSync(
      path.join(stage, 'package.json'),
      json({
        name: '@egret/migrate',
        version: '0.3.0',
        description: 'Local migration tool for the admitted classic Egret 5 Web 2D project profiles',
        license: 'Apache-2.0',
        type: 'module',
        bin: { 'egret-migrate': './bin.mjs' },
        engines: { node: '>=26.7.0' },
        files: ['cli.mjs', ...engineTools, 'skill', 'LICENSE', 'NOTICE', ...transitive]
      })
    );
    const result = spawnSync(
      process.execPath,
      [path.resolve(options.npm), 'pack', '--ignore-scripts', '--json', '--pack-destination', out],
      { cwd: stage, encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 }
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('npm pack failed: ' + result.stderr.trim());
    const [receipt] = JSON.parse(result.stdout);
    const filename = path.join(out, receipt.filename);
    const report = { ...receipt, sha256: hash(fs.readFileSync(filename)) };
    fs.writeFileSync(path.join(out, 'report.json'), json(report));
    console.log(json(report));
  } finally {
    // Only remove the fresh staging directory created by this invocation.
    if (
      samePhysicalPath(fs.realpathSync(stage), stage) &&
      ownerRelativePath(temporary, stage).startsWith('egret-migrate-pack-')
    )
      fs.rmSync(stage, { recursive: true, force: true });
  }
}

const { values } = parseArgs({
  options: {
    esbuild: { type: 'string' },
    npm: { type: 'string' },
    out: { type: 'string' }
  }
});
if (!values.esbuild || !values.npm || !values.out)
  throw new Error('Usage: node tools/egret-migrate/pack.mjs --esbuild <module> --npm <npm-cli.js> --out <new folder>');
await pack(values);
