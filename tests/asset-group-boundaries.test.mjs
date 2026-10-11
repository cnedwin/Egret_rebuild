import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, symlinkSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repository = fileURLToPath(new URL('..', import.meta.url));
const parent = path.join(repository, 'work');
const checked = (result, status, reason) => {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, status, result.stdout + result.stderr);
  if (reason) assert.ok(result.stderr.includes(reason), result.stderr);
  else assert.match(result.stdout, /Boundary check PASS/);
};

// First-party actual-copy scaffold from tests/tween-boundaries.test.mjs, with
// its game-clock/textured-webgpu provenance retained. Every mutant first admits
// the genuine four-package graph using unchanged production checker bytes.
function isolated(action) {
  mkdirSync(parent, { recursive: true });
  const fixture = mkdtempSync(path.join(parent, 'asset-group-boundary-'));
  const checker = readFileSync(path.join(repository, 'tools/check-boundaries.mjs'));
  const checkerHash = createHash('sha256').update(checker).digest('hex');
  const write = (relative, content) => {
    const file = path.join(fixture, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  const edit = (relative, change) => write(relative, change(readFileSync(path.join(fixture, relative), 'utf8')));
  try {
    for (const name of ['contracts', 'runtime', 'engine', 'project']) {
      for (const entry of ['package.json', 'tsconfig.json', 'src', 'dist', ...(name === 'engine' ? ['web', 'rendering', 'tsconfig.web.json', 'tsconfig.rendering.json'] : [])])
        cpSync(path.join(repository, 'packages', name, entry), path.join(fixture, 'packages', name, entry), { recursive: true });
      mkdirSync(path.join(fixture, 'node_modules/@egret'), { recursive: true });
      const packageRoot = path.join(fixture, 'packages', name);
      const link = path.join(fixture, 'node_modules/@egret', name);
      symlinkSync(packageRoot, link, 'junction');
      assert.equal(realpathSync(link), realpathSync(packageRoot));
    }
    for (const name of ['jsonc-parser', 'robust-predicates']) {
      const require = createRequire(path.join(repository, 'packages', name === 'jsonc-parser' ? 'project' : 'engine', 'package.json'));
      const entry = realpathSync(require.resolve(name));
      const installed = name === 'jsonc-parser' ? path.resolve(path.dirname(entry), '../..') : path.dirname(entry);
      cpSync(installed, path.join(fixture, 'node_modules', name), { recursive: true });
    }
    write('tools/check-boundaries.mjs', checker);
    assert.equal(createHash('sha256').update(readFileSync(path.join(fixture, 'tools/check-boundaries.mjs'))).digest('hex'), checkerHash);
    const check = () => spawnSync(process.execPath, ['tools/check-boundaries.mjs'], {
      cwd: fixture, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30000, windowsHide: true,
    });
    return action({ edit, check, checkerHash });
  } finally {
    const resolved = realpathSync(fixture);
    assert.ok(resolved.toLowerCase().startsWith(realpathSync(parent).toLowerCase() + path.sep)
      && path.basename(resolved).startsWith('asset-group-boundary-'));
    for (const name of ['contracts', 'runtime', 'engine', 'project']) {
      const link = path.join(resolved, 'node_modules/@egret', name);
      if (existsSync(link)) assert.equal(realpathSync(link), realpathSync(path.join(resolved, 'packages', name)), 'cleanup stays in the owned copied graph');
    }
    rmSync(resolved, { recursive: true, force: true });
    assert.equal(existsSync(resolved), false);
  }
}

const replaced = (raw, before, after) => {
  assert.equal(raw.split(before).length - 1, 1, 'the assigned mutation has one genuine source anchor');
  return raw.replace(before, after);
};

test('RG1 boundary executable public roots expose no group types factories owners brands or assembly values', async () => {
  // Contracts retains its existing relative public-root route.
  for (const specifier of ['../packages/contracts/dist/index.js', '@egret/runtime', '@egret/engine', '@egret/engine/web', '@egret/engine/webgpu', '@egret/engine/text', '@egret/runtime/text', '@egret/project']) {
    const values = await import(specifier);
    for (const name of ['AssetGroup', 'AssetGroupState', 'AssetGroupOptions', 'AssetGroupOperations', 'createAssetGroup', 'createAssetGroupOwner', 'AssetGroupOwner', 'AssetGroupContext', 'assetGroupBrand'])
      assert.equal(Object.hasOwn(values, name), false, specifier + ': ' + name);
  }
});
test('RG1 boundary genuine four-package baseline passes the exact production checker', t => isolated(f => {
  checked(f.check(), 0);
  t.diagnostic(`Owned four-package graph; unchanged production checker ${f.checkerHash}; source/declaration controls only.`);
}));

const enginePort = "export type { AssetGroup, AssetGroupState, AssetGroupOptions } from './assetGroupTypes.js';";
const runtimePort = "export type { AssetGroupOperations } from './assetManagerOwnerState.js';";
const factorySignature = 'createAssetGroup<T>(scope: Scope, refs: readonly AssetRef<T>[], options?: AssetGroupOptions): AssetGroup<T>';
const mutations = [
  ['missing-source-type', 'packages/engine/src/index.ts', raw => replaced(raw, enginePort, ''), 'root source: exact AssetGroup type-only export surface mismatch'],
  ['missing-declaration-type', 'packages/engine/dist/index.d.ts', raw => replaced(raw, 'AssetGroupState, AssetGroupOptions', 'AssetGroupState'), 'root: exact AssetGroup type-only export surface mismatch'],
  ['source-type-value-clause', 'packages/engine/src/index.ts', raw => replaced(raw, enginePort, enginePort.replace('export type', 'export')), 'root source: exact AssetGroup type-only export surface mismatch'],
  ['declaration-type-value-clause', 'packages/engine/dist/index.d.ts', raw => replaced(raw, enginePort, enginePort.replace('export type', 'export')), 'root: exact AssetGroup type-only export surface mismatch'],
  ['root-extra-type-namespace', 'packages/engine/dist/index.d.ts', raw => raw + "\nexport type * as EscapedGroups from './assetGroupTypes.js';\n", 'root: exact AssetGroup type-only export surface mismatch'],
  ['root-source-factory', 'packages/engine/src/index.ts', raw => raw + '\nexport declare function createAssetGroup(): void;\n', 'root source: private AssetGroup authority leaked: createAssetGroup'],
  ['root-declaration-factory', 'packages/engine/dist/index.d.ts', raw => raw + '\nexport declare function createAssetGroup(): void;\n', 'root: private AssetGroup authority leaked: createAssetGroup'],
  ['root-private-owner', 'packages/engine/dist/index.d.ts', raw => raw + "\nexport { createAssetGroupOwner } from './assetGroup.js';\n", 'root: private AssetGroup authority leaked: createAssetGroupOwner'],
  ['web-private-owner-context', 'packages/engine/dist/web/index.d.ts', raw => raw + '\nexport interface AssetGroupContext {}\n', 'web: private AssetGroup authority leaked: AssetGroupContext'],
  ['runtime-private-owner-type', 'packages/runtime/dist/index.d.ts', raw => raw + '\nexport interface AssetGroupOwner {}\n', 'runtime: private AssetGroup authority leaked: AssetGroupOwner'],
  ['private-module-namespace', 'packages/engine/dist/index.d.ts', raw => raw + "\nexport type * as EscapedGroupOwner from './assetGroup.js';\n", 'root: private AssetGroup module leaked'],
  ['source-private-brand', 'packages/engine/src/index.ts', raw => raw + '\nexport declare const assetGroupBrand: unique symbol;\n', 'root source: private AssetGroup authority leaked: assetGroupBrand'],
  ['declaration-private-brand', 'packages/engine/dist/index.d.ts', raw => raw + '\nexport declare const assetGroupBrand: unique symbol;\n', 'root: private AssetGroup authority leaked: assetGroupBrand'],
  ['canonical-brand-value', 'packages/engine/dist/assetGroupTypes.js', raw => raw + '\nexport const assetGroupBrand = Symbol();\n', 'engine: AssetGroup types emitted runtime values'],
  ['canonical-local-brand-allocation', 'packages/engine/dist/assetGroupTypes.js', raw => raw + '\nconst assetGroupBrand = Symbol();\n', 'engine: AssetGroup types emitted non-erased module code'],
  ['root-group-value', 'packages/engine/dist/index.js', raw => raw + '\nexport const AssetGroup = 1;\n', 'root: executable textured-frame export surface mismatch'],
  ['extra-canonical-type', 'packages/engine/dist/assetGroupTypes.d.ts', raw => raw + '\nexport interface ExtraAssetGroupPort {}\n', 'engine: canonical AssetGroup type inventory mismatch'],
  ['extra-canonical-erased-alias', 'packages/engine/dist/assetGroupTypes.d.ts', raw => raw + '\nexport type { AssetGroup as ExtraAssetGroupPort };\n', 'engine: canonical AssetGroup type inventory mismatch'],
  ['optional-source-brand', 'packages/engine/src/assetGroupTypes.ts', raw => replaced(raw, 'readonly [assetGroupBrand]: true;', 'readonly [assetGroupBrand]?: true;'), 'engine source: canonical AssetGroup contract mismatch'],
  ['optional-declaration-brand', 'packages/engine/dist/assetGroupTypes.d.ts', raw => replaced(raw, 'readonly [assetGroupBrand]: true;', 'readonly [assetGroupBrand]?: true;'), 'engine: canonical AssetGroup contract mismatch'],
  ['missing-source-method', 'packages/engine/src/Engine.ts', raw => replaced(raw, factorySignature, factorySignature.replace('createAssetGroup<T>', 'createRetiredGroup<T>')), 'engine source: exact createAssetGroup signature mismatch'],
  ['optional-declaration-refs', 'packages/engine/dist/Engine.d.ts', raw => replaced(raw, factorySignature, factorySignature.replace('refs: readonly', 'refs?: readonly')), 'engine: exact createAssetGroup signature mismatch'],
  ['runtime-group-type', 'packages/runtime/dist/index.d.ts', raw => raw + '\nexport interface AssetGroup<T> {}\n', 'runtime: Engine-only AssetGroup type leaked: AssetGroup'],
  ['root-assembly-type', 'packages/engine/dist/index.d.ts', raw => raw + '\nexport interface AssetGroupOperations {}\n', 'root: runtime-only AssetGroup assembly type leaked'],
  ['missing-runtime-source-port', 'packages/runtime/src/index.ts', raw => replaced(raw, runtimePort, ''), 'runtime source: exact AssetGroupOperations type-only assembly mismatch'],
  ['runtime-source-value-port', 'packages/runtime/src/index.ts', raw => replaced(raw, runtimePort, runtimePort.replace('export type', 'export')), 'runtime source: exact AssetGroupOperations type-only assembly mismatch'],
  ['missing-runtime-declaration-port', 'packages/runtime/dist/index.d.ts', raw => replaced(raw, runtimePort, ''), 'runtime: exact AssetGroupOperations type-only assembly mismatch'],
  ['extra-runtime-port-namespace', 'packages/runtime/dist/index.d.ts', raw => raw + "\nexport type * as EscapedAssembly from './assetManagerOwnerState.js';\n", 'runtime: exact AssetGroupOperations type-only assembly mismatch'],
  ['new-group-subpath', 'packages/engine/package.json', raw => { const pkg = JSON.parse(raw); pkg.exports['./asset-group'] = { types: './dist/assetGroupTypes.d.ts', import: './dist/assetGroupTypes.js' }; return JSON.stringify(pkg); }, 'engine: text explicit export mapping mismatch'],
  ['automatic-source-time', 'packages/engine/src/assetGroup.ts', raw => raw + '\nconst forbiddenGroupTime = Date.now();\n', 'packages/engine/src/assetGroup.ts: AssetGroup automatic timing dependency'],
  ['automatic-emitted-timer', 'packages/engine/dist/assetGroup.js', raw => raw + '\nsetTimeout(() => {}, 1);\n', 'packages/engine/dist/assetGroup.js: AssetGroup automatic timing dependency'],
  ['DOM-ambient-source-reference', 'packages/engine/src/assetGroupTypes.ts', raw => raw + '\n/// <reference lib="dom" />\n', 'packages/engine/src/assetGroupTypes.ts: host ambient dependency'],
  ['DOM-source-global', 'packages/engine/src/assetGroup.ts', raw => raw + '\nconst forbiddenGroupDOM = window;\n', path.join('packages', 'engine', 'src', 'assetGroup.ts') + ': host ambient dependency'],
];
for (const [name, file, change, reason] of mutations)
  test(`RG1 boundary ${name} reaches its assigned refusal after a valid actual graph`, () => isolated(f => {
    checked(f.check(), 0);
    f.edit(file, change);
    checked(f.check(), 1, reason);
  }));
