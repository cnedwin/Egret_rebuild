import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, symlinkSync, rmSync, realpathSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const repository = fileURLToPath(new URL('..', import.meta.url));
const ownedParent = path.join(repository, 'work');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const checkerPath = path.join(repository, 'tools/check-boundaries.mjs');
const packageNames = ['contracts', 'runtime', 'engine', 'project'];
const checked = (result, expectedExit, reason) => {
  assert.ifError(result.error); assert.equal(result.signal, null);
  assert.equal(result.status, expectedExit, result.stdout + result.stderr);
  if (reason) {
    const errors = [...result.stderr.replaceAll('\\', '/').matchAll(/^Error: (.+)$/gm)].map(row => row[1]);
    assert.deepEqual(errors, [reason], 'Exactly the assigned first refusal is required: ' + result.stderr);
  } else assert.match(result.stdout, /Boundary check PASS/);
};

// Derived from the first-party BW1 actual-copy scaffold; NS1 controls are
// independently specified. Genuine compiled products are copied unchanged.
// No rebuild, generated product facade or geometry-algorithm substitute occurs.
function isolated(action) {
  const checker = readFileSync(checkerPath), checkerHash = hash(checker);
  const copyPlan = [];
  for (const name of packageNames) {
    for (const entry of ['package.json', 'tsconfig.json', 'src', 'dist', ...(name === 'engine' ? ['web', 'rendering', 'tsconfig.web.json', 'tsconfig.rendering.json'] : [])]) {
      const source = path.join(repository, 'packages', name, entry);
      assert.ok(existsSync(source), 'Preflight requires the actual built graph: ' + source);
      copyPlan.push([source, path.join('packages', name, entry)]);
    }
  }
  const dependencies = [];
  for (const [name, owner, version] of [['jsonc-parser', 'project', '3.3.1'], ['robust-predicates', 'engine', '3.0.3']]) {
    const ownerPath = path.join(repository, 'packages', owner, 'package.json');
    assert.equal(JSON.parse(readFileSync(ownerPath, 'utf8')).dependencies[name], version);
    const require = createRequire(ownerPath), entry = realpathSync(require.resolve(name));
    const installed = name === 'jsonc-parser' ? path.resolve(path.dirname(entry), '../..') : path.dirname(entry);
    const metadata = readFileSync(path.join(installed, 'package.json'));
    assert.equal(JSON.parse(metadata).name, name); assert.equal(JSON.parse(metadata).version, version);
    const relativeEntry = path.relative(installed, entry);
    assert.ok(relativeEntry && !relativeEntry.startsWith('..') && !path.isAbsolute(relativeEntry));
    dependencies.push({name, owner, version, installed, relativeEntry, metadataHash: hash(metadata), entryHash: hash(readFileSync(entry))});
  }
  mkdirSync(ownedParent, {recursive:true});
  const fixture = mkdtempSync(path.join(ownedParent, 'nine-slice-boundary-'));
  const fixtureChecker = path.join(fixture, 'tools/check-boundaries.mjs');
  const ownedFile = relative => {
    const target = path.resolve(fixture, relative);
    assert.ok(target.toLowerCase().startsWith(path.resolve(fixture).toLowerCase() + path.sep), 'Mutation remains in the owned fixture');
    return target;
  };
  const write = (relative, content) => {
    const target = ownedFile(relative); mkdirSync(path.dirname(target), {recursive:true}); writeFileSync(target, content);
  };
  let edits = 0;
  const edit = (relative, change) => {
    assert.equal(edits, 0, 'Each assigned control changes exactly one file once');
    assert.notEqual(relative, 'tools/check-boundaries.mjs');
    const target = ownedFile(relative), before = readFileSync(target, 'utf8'), after = change(before);
    assert.notEqual(after, before, 'The real copied production file must change');
    write(relative, after); edits++;
  };
  try {
    for (const [source, relative] of copyPlan) cpSync(source, ownedFile(relative), {recursive:true});
    mkdirSync(path.join(fixture, 'node_modules/@egret'), {recursive:true});
    for (const name of packageNames) {
      const packageRoot = path.join(fixture, 'packages', name), alias = path.join(fixture, 'node_modules/@egret', name);
      assert.equal(existsSync(alias), false); symlinkSync(packageRoot, alias, 'junction');
      assert.equal(realpathSync(alias), realpathSync(packageRoot));
    }
    for (const dependency of dependencies) {
      const target = path.join(fixture, 'node_modules', dependency.name);
      assert.equal(existsSync(target), false); cpSync(dependency.installed, target, {recursive:true});
      assert.equal(hash(readFileSync(path.join(target, 'package.json'))), dependency.metadataHash);
      const require = createRequire(path.join(fixture, 'packages', dependency.owner, 'package.json'));
      const resolved = realpathSync(require.resolve(dependency.name));
      assert.equal(resolved, realpathSync(path.join(target, dependency.relativeEntry)), 'Copied owner resolves its exact installed dependency');
      assert.equal(hash(readFileSync(resolved)), dependency.entryHash);
    }
    write('tools/check-boundaries.mjs', checker);
    const check = () => {
      assert.equal(hash(readFileSync(fixtureChecker)), checkerHash, 'Production checker is never mutated');
      assert.equal(hash(readFileSync(checkerPath)), checkerHash, 'Repository checker identity remains frozen');
      return spawnSync(process.execPath, ['tools/check-boundaries.mjs'], {
        cwd:fixture, encoding:'utf8', maxBuffer:8 * 1024 * 1024, timeout:180000,
      });
    };
    return action({edit, check, checkerHash});
  } finally {
    // Resolve the final Windows deletion target, and each owned junction, before
    // recursively deleting only this fresh child of the repository work folder.
    const resolved = realpathSync(fixture), parent = realpathSync(ownedParent);
    assert.ok(resolved.toLowerCase().startsWith(parent.toLowerCase() + path.sep));
    assert.ok(path.basename(resolved).startsWith('nine-slice-boundary-'));
    for (const name of packageNames) {
      const alias = path.join(resolved, 'node_modules/@egret', name);
      if (existsSync(alias)) assert.equal(realpathSync(alias), realpathSync(path.join(resolved, 'packages', name)));
    }
    assert.equal(hash(readFileSync(checkerPath)), checkerHash, 'Fixture cleanup cannot alter the repository checker');
    rmSync(resolved, {recursive:true, force:true}); assert.equal(existsSync(resolved), false);
  }
}
const replaceOne = (raw, expression, replacement) => {
  const matches = [...raw.matchAll(new RegExp(expression.source, expression.flags.includes('g') ? expression.flags : expression.flags + 'g'))];
  assert.equal(matches.length, 1, 'Mutation requires one genuine original clause');
  return raw.replace(expression, replacement);
};
const rootValue = /export\s*\{\s*createNineSliceGeometry2D\s*\}\s*from\s*["']@egret\/runtime["'];?/;
const runtimeValue = /export\s*\{\s*createNineSliceGeometry2D\s*\}\s*from\s*["']\.\/NineSliceGeometry2D\.js["'];?/;
const runtimeTypes = /export\s+type\s*\{\s*NineSliceInsets2D\s*,\s*NineSliceGeometry2DOptions\s*\}\s*from\s*["']\.\/NineSliceGeometry2D\.js["'];?/;
const leafFactoryImport = /import\s*\{\s*createTexturedGeometry2D\s*\}\s*from\s*["']@egret\/contracts["'];?/;

test('NS1 genuine compiled four-package graph passes the complete production checker', t => isolated(f => {
  checked(f.check(), 0);
  t.diagnostic('Actual copied source/build graph; checker ' + f.checkerHash + '; no geometry evaluation is claimed.');
}));
const controls = [
  ['NSP01 missing runtime source forward', 'packages/runtime/src/index.ts',
    raw => replaceOne(raw, runtimeValue, ''),
    'NS1: runtime exact factory/type forwarding mismatch: packages/runtime/src/index.ts'],
  ['NSP02 split runtime emitted identity', 'packages/runtime/dist/index.js',
    raw => replaceOne(raw, runtimeValue, 'export function createNineSliceGeometry2D() {}'),
    'NS1: runtime canonical factory identity mismatch'],
  ['NSP03 split root emitted identity', 'packages/engine/dist/index.js',
    raw => replaceOne(raw, rootValue, 'export function createNineSliceGeometry2D() {}'),
    'NS1: root canonical factory identity mismatch'],
  ['NSP04 erased root declaration cannot replace a value', 'packages/engine/dist/index.d.ts',
    raw => replaceOne(raw, rootValue, "export type {createNineSliceGeometry2D} from '@egret/runtime';"),
    'NS1: root exact factory/type forwarding mismatch: packages/engine/dist/index.d.ts'],
  ['NSP05 aliased runtime declaration is not the two canonical interfaces', 'packages/runtime/dist/index.d.ts',
    raw => replaceOne(raw, runtimeTypes, "export type {NineSliceInsets2D as RenamedInsets,NineSliceGeometry2DOptions} from './NineSliceGeometry2D.js';"),
    'NS1: runtime exact factory/type forwarding mismatch: packages/runtime/dist/index.d.ts'],
  ['NSP06 root source cannot add a local duplicate', 'packages/engine/src/index.ts',
    raw => raw + '\nconst createNineSliceGeometry2D = () => undefined;\n',
    'NS1: root exact factory/type forwarding mismatch: packages/engine/src/index.ts'],
  ['NSP07 canonical leaf value import cannot target another allowed runtime module', 'packages/runtime/src/NineSliceGeometry2D.ts',
    raw => replaceOne(raw, leafFactoryImport, "import {createTexturedGeometry2D} from './Scope.js';"),
    'NS1: canonical leaf contracts import mismatch: packages/runtime/src/NineSliceGeometry2D.ts'],
  ['NSP08 leaf declaration cannot enlarge the three-export surface', 'packages/runtime/dist/NineSliceGeometry2D.d.ts',
    raw => raw + '\nexport interface NineSliceExtraPort {}\n',
    'NS1: canonical leaf export surface mismatch: packages/runtime/dist/NineSliceGeometry2D.d.ts'],
  ['NSP09 erased interface reference cannot leak into Canvas declarations', 'packages/engine/dist/web/index.d.ts',
    raw => raw + "\nimport type {NineSliceGeometry2DOptions as NSCanvasTypeProbe} from '@egret/runtime';\n",
    'NS1: web root/runtime-only port leaked: NineSliceGeometry2DOptions'],
  ['NSP10 textual private leaf route cannot leak into Canvas declarations', 'packages/engine/dist/web/index.d.ts',
    raw => raw + "\ntype NSCanvasModuleProbe = './NineSliceGeometry2D.js';\n",
    'NS1: web root/runtime-only leaf module leaked'],
  ['NSP11 local NS interface cannot leak through contracts declarations', 'packages/contracts/dist/index.d.ts',
    raw => raw + '\nexport interface NineSliceInsets2D { readonly left: number; }\n',
    'NS1: contracts root/runtime-only port leaked: NineSliceInsets2D'],
  ['NSP12 generic host ambient refusal remains authoritative', 'packages/runtime/dist/NineSliceGeometry2D.d.ts',
    raw => raw + '\ntype NSHostProbe = GPUDevice;\n',
    'packages/runtime/dist/NineSliceGeometry2D.d.ts: host ambient dependency'],
];
// Each assigned mutation is preceded by a full, fresh genuine baseline. These
// controls prove policy routing/identity/type erasure, not scalar/grid behavior.
for (const [name, file, change, reason] of controls) test('NS1 actual baseline then ' + name, () => isolated(f => {
  checked(f.check(), 0); f.edit(file, change); checked(f.check(), 1, reason);
}));
