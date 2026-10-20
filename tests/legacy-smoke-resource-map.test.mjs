import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resource = '@egret/contracts/resources';
const resourcePath = 'packages/contracts/dist/resources/index.js';

async function policy(imports = undefined) {
  const source = await readFile(resolve(root, 'tools/verify-webgpu.mjs'), 'utf8');
  const start = source.indexOf('const entries='), end = source.indexOf('report.isolation=');
  assert.ok(start >= 0 && end > start, 'The original static closure policy must remain identifiable');
  // Only the verifier's read-only map and static closure function run here; SDK bytes are never evaluated.
  const value = runInNewContext(source.slice(start, end) + '\n({entries,closure})', {
    root, readFile, resolve, dirname, relative,
  }, { timeout: 1000 });
  if (imports) {
    for (const key of Object.keys(value.entries)) delete value.entries[key];
    for (const [name, path] of Object.entries(imports)) {
      assert.ok(path.startsWith('/packages/'), 'Authored mappings stay repository-relative');
      value.entries[name] = path.slice(1);
    }
  }
  return value;
}

async function baseline(value) {
  assert.equal(value.entries[resource], resourcePath);
  for (const name of ['@egret/engine', ...(value.entries['@egret/engine/web'] ? ['@egret/engine/web'] : [])]) {
    const paths = Array.from(await value.closure(value.entries[name]));
    // Resource ownership belongs to the Engine root; the Canvas host stays isolated.
    const ownsResources = name === '@egret/engine';
    for (const resourceFile of [resourcePath, 'packages/contracts/dist/resources/manifestAdmission.js',
      'packages/contracts/dist/resources/sha256.js']) {
      assert.equal(paths.includes(resourceFile), ownsResources, name + ' resource isolation: ' + resourceFile);
    }
  }
}

async function missingAliasControl(value) {
  await baseline(value);
  const original = value.entries[resource];
  const failures = [];
  try {
    delete value.entries[resource];
    await assert.rejects(value.closure(value.entries['@egret/engine']),
      error => error.message === 'Unexpected external import in isolated entry: @egret/contracts/resources');
  } catch (cause) {
    failures.push(cause);
  } finally {
    try { value.entries[resource] = original; } catch (cause) { failures.push(cause); }
  }
  try { await baseline(value); } catch (cause) { failures.push(cause); }
  if (failures.length) throw new AggregateError(failures, 'Legacy smoke resources alias refusal/restoration');
}

test('ordinary WebGPU static isolation keeps the canonical resource edge and refuses its deletion', async () => {
  const value = await policy();
  await missingAliasControl(value);
});

const common = {
  '#egret-textured-frame-state': '/packages/engine/dist/internal/texturedFrameState.js',
  '@egret/engine': '/packages/engine/dist/index.js',
  '@egret/runtime': '/packages/runtime/dist/index.js',
  '@egret/contracts': '/packages/contracts/dist/index.js',
  '@egret/contracts/resources': '/' + resourcePath,
};
const examples = [
  ['canvas-scene', { ...common, '@egret/engine/web': '/packages/engine/dist/web/index.js' }],
  ['webgpu', { ...common, '@egret/engine/web': '/packages/engine/dist/web/index.js',
    '@egret/engine/webgpu': '/packages/engine/dist/web/webgpu.js',
    'robust-predicates': '/packages/engine/node_modules/robust-predicates/index.js' }],
  ['scene3d', { ...common, '@egret/engine/scene3d': '/packages/engine/dist/rendering/scene3d.js',
    '@egret/engine/webgpu/scene3d': '/packages/engine/dist/web/scene3d.js',
    'robust-predicates': '/packages/engine/node_modules/robust-predicates/index.js' }],
];
for (const [name, expected] of examples) test(name + ' authored map preserves its exact ports and reachable resource edge', async () => {
  const html = await readFile(resolve(root, 'examples', name, 'index.html'), 'utf8');
  const matches = [...html.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)];
  assert.equal(matches.length, 1);
  const map = JSON.parse(matches[0][1]);
  assert.deepEqual(Object.keys(map), ['imports']);
  assert.deepEqual(map.imports, expected);
  const metadata = JSON.parse(await readFile(resolve(root, 'packages/contracts/package.json'), 'utf8'));
  assert.deepEqual(metadata.exports['./resources'], {
    types: './dist/resources/index.d.ts', import: './dist/resources/index.js',
  });
  await missingAliasControl(await policy(map.imports));
  assert.equal(await readFile(resolve(root, 'examples', name, 'index.html'), 'utf8'), html);
});
