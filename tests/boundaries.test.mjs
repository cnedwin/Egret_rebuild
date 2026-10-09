import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('..', import.meta.url));
const checker = readFileSync(path.join(repository, 'tools/check-boundaries.mjs'));
const checkerHash = createHash('sha256').update(checker).digest('hex');
const ownedParent = path.resolve(repository, 'work');
const dependencies = { contracts: [], runtime: ['@egret/contracts'], engine: ['@egret/contracts', '@egret/runtime'] };

// Synthetic facades prove tool policy/resolution only, never core or native behavior.
function fixture({ imported, subtree = 'engine/rendering', declared = false }, run) {
  mkdirSync(ownedParent, { recursive: true });
  const root = mkdtempSync(path.join(ownedParent, 'egret-boundary-policy-'));
  function write(relative, content) {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, typeof content === 'string' || content instanceof Uint8Array ? content : JSON.stringify(content));
  }
  try {
    write('tools/check-boundaries.mjs', checker);
    for (const [name, allowed] of Object.entries(dependencies)) {
      const dependencyMap = Object.fromEntries(allowed.map(value => [value, 'workspace:*']));
      if (name === 'engine') {
        dependencyMap['robust-predicates'] = '3.0.3';
        if (declared) dependencyMap.constructor = '1.0.0';
      }
      const gpuExport = { types: './dist/web/webgpu.d.ts', import: './dist/web/webgpu.js' };
      write(`packages/${name}/package.json`, { name: `@egret/${name}`, private: true, version: '0.0.0', type: 'module', dependencies: dependencyMap, ...(name === 'engine' ? {exports:{'./webgpu':gpuExport}} : {}) });
      write(`packages/${name}/tsconfig.json`, { extends: '../../tsconfig.base.json', references: allowed.map(value => ({ path: `../${value.slice('@egret/'.length)}` })) });
      write(`packages/${name}/src/index.ts`, 'export {};\n');
      write(`packages/${name}/dist/index.js`, 'export {};\n');
      const exports = name === 'engine' ? { '.': './index.js', './web': './web.js', './webgpu':'./webgpu.js' } : './index.js';
      write(`node_modules/@egret/${name}/package.json`, { name: `@egret/${name}`, type: 'module', exports });
      write(`node_modules/@egret/${name}/index.js`, 'export {};\n');
      if (name === 'engine') { write('node_modules/@egret/engine/web.js', 'export function createCanvasHost() {}\n'); write('node_modules/@egret/engine/webgpu.js', 'export function createWebGPUHost() {}\n'); }
    }
    for (const name of ['robust-predicates', 'constructor']) {
      // Deliberately resolve even a deep path; authorization must independently reject it.
      write(`node_modules/${name}/package.json`, { name, version: name === 'robust-predicates' ? '3.0.3' : '1.0.0', type: 'module', exports: { '.': './index.js', './esm/orient2d.js': './index.js' } });
      write(`node_modules/${name}/index.js`, 'export const marker = 1;\n');
    }
    write('packages/engine/web/index.ts', 'export {};\n');
    mkdirSync(path.join(root, 'packages/engine/rendering'), { recursive: true });
    for (const name of ['web', 'rendering']) write(`packages/engine/tsconfig.${name}.json`, readFileSync(path.join(repository, `packages/engine/tsconfig.${name}.json`)));
    write(`packages/${subtree}/Probe.ts`, `import { marker } from ${JSON.stringify(imported)};\nexport const value = marker;\n`);
    const resolution = spawnSync(process.execPath, ['--input-type=module', '--eval', `await import(${JSON.stringify(imported)});`], { cwd: path.join(root, 'packages/engine'), encoding: 'utf8' });
    assert.equal(resolution.status, 0, resolution.stderr);
    const result = spawnSync(process.execPath, ['tools/check-boundaries.mjs'], { cwd: root, encoding: 'utf8' });
    assert.ifError(result.error);
    run(result);
  } finally {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(ownedParent + path.sep) && path.basename(resolved).startsWith('egret-boundary-policy-'));
    rmSync(resolved, { recursive: true, force: true });
    assert.equal(existsSync(resolved), false);
  }
}

test('boundary checker admits the exact external root only in engine rendering', t => {
  t.diagnostic(`Unmodified checker SHA256 ${checkerHash}; generated minimal workspace, synthetic resolution facades, guarded cleanup.`);
  fixture({ imported: 'robust-predicates' }, result => {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Boundary check PASS/);
  });
  for (const subtree of ['engine/src', 'engine/web', 'runtime/src']) fixture({ imported: 'robust-predicates', subtree }, result => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unapproved\/deep package import robust-predicates/);
  });
});
test('boundary checker rejects a resolvable deep dependency import', () => {
  fixture({ imported: 'robust-predicates/esm/orient2d.js' }, result => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unapproved\/deep package import robust-predicates\/esm\/orient2d\.js/);
  });
});
for (const declared of [true, false]) test(`boundary checker rejects resolvable inherited constructor in ${declared ? 'dependency' : 'import'} guard`, () => {
  fixture({ imported: 'constructor', declared }, result => {
    assert.equal(result.status, 1, `resolvable constructor unexpectedly accepted: ${result.stdout}`);
    assert.match(result.stderr, declared ? /engine: dependency DAG mismatch/ : /unapproved\/deep package import constructor/);
  });
});
